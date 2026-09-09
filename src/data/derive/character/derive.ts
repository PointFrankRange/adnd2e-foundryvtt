// The character derived-data pipeline (spec §5.6). Pure — takes a snapshot + the
// optional-rules bag, returns the object CharacterModel caches onto system.*.
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type {
  ClassId, DerivedAbilities, EncumbranceCategory, SaveCategory,
} from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import type {
  ArrangementResolution, ClassArrangement, ClassMember, DualClassResolution,
} from "../../../core/classes/multiclass";
import type { ActorSnapshot } from "./snapshot";
import { deriveClassLevels } from "./levels";
import { characterHpMax } from "./hp";
import { deriveThac0 } from "./thac0";
import { deriveAc } from "./ac";
import { deriveSaves } from "./saves";
import { deriveSpellSlots, type SlotRecord } from "./slots";
import { deriveProficiencySlots, type SlotBlock } from "./proficiencies";
import { deriveEncumbrance } from "./encumbrance";
import {
  classifyArrangement, resolveDualClassArrangement, resolveMulticlassArrangement,
} from "./multiclass";

export interface CharacterDerived {
  abilities: DerivedAbilities;
  classes: { chassisId: ClassId; level: number; canLevelUp: boolean }[];
  hpMax: number;
  thac0: { base: number; melee: number; ranged: number } | null;
  ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
  saves: Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }> | null;
  spellSlots: { wizard?: SlotRecord; priest?: SlotRecord };
  proficiencies: { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } | null;
  encumbrance: {
    carried: number;
    category: EncumbranceCategory;
    movementRate: number;
    penalty: { attackRoll: number; armorClass: number };
    baseMove: number;
  };
  multiclass: {
    mode: ClassArrangement;
    dualClass: { dormantChassisId: ClassId | null; activeChassisId: ClassId | null; surpassed: boolean };
    hpAveraged: boolean;
  };
}

const NO_DUAL_CLASS = {
  dormantChassisId: null as ClassId | null,
  activeChassisId: null as ClassId | null,
  surpassed: false,
};

function spellInput(
  m: ClassMember,
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
) {
  return {
    chassisId: m.chassisId,
    level: m.level,
    maxSpellLevelKnown: abilities.int.maxSpellLevel,
    wisdomScore: snapshot.abilities.wis,
    wisdomBonusSpells: abilities.wis.bonusPriestSpells,
    specialist: m.specialistSchool !== null,
    wizardMemorized: snapshot.wizardMemorized,
    priestMemorized: snapshot.priestMemorized,
  };
}

function mergeCasterSlots(
  casters: readonly ClassMember[],
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
): { wizard?: SlotRecord; priest?: SlotRecord } {
  let out: { wizard?: SlotRecord; priest?: SlotRecord } = {};
  for (const c of casters) {
    out = { ...out, ...deriveSpellSlots(spellInput(c, snapshot, abilities)) };
  }
  return out;
}

export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");

  // §5.6 step 2 — ability modifiers. Scores are already racially adjusted
  // (CharacterModel.prepareBaseData). race:"human" makes deriveAbilities' own
  // applyRacialDeltas a no-op; the halfling exceptional-Strength ban is kept by
  // pre-nulling the percentile.
  const percentile = snapshot.race === "halfling" ? null : snapshot.exceptionalStrengthPercentile;
  const abilities = deriveAbilities(snapshot.abilities, {
    race: "human", isWarrior, options, exceptionalStrengthPercentile: percentile,
  });

  const classLevels = deriveClassLevels(snapshot.classes);
  const levels = classLevels.map((c) => c.level);
  const mode = classifyArrangement(snapshot.classes);
  const race = snapshot.race ?? "human";

  // §5.6 step 6 — AC (class-independent).
  const ac = deriveAc({
    equippedArmor: snapshot.equippedArmor,
    equippedShield: snapshot.equippedShield,
    dexDefensiveAdj: abilities.dex.defensiveAdj,
  });

  // §5.6 step 10 — encumbrance (class-independent).
  const encumbrance = deriveEncumbrance({
    carried: snapshot.carriedWeight,
    strengthScore: snapshot.abilities.str,
    weightAllowance: abilities.str.weightAllowance,
    maxPress: abilities.str.maxPress,
    baseMove: snapshot.baseMovement,
  });

  if (mode === "single") {
    const primary = snapshot.classes[0] ?? null;
    const chassis = primary ? getChassis(primary.chassisId) : null;
    const level = primary ? levels[0] : 0;
    const primaryMember: ClassMember | null = primary
      ? { chassisId: primary.chassisId, level, specialistSchool: primary.specialistSchool }
      : null;
    return {
      abilities,
      classes: classLevels,
      hpMax: primary
        ? characterHpMax(primary.chassisId, level, primary.hpRolls, abilities.con.hpAdjustment)
        : 0,
      thac0: chassis
        ? deriveThac0(chassis.group, level, abilities.str.hitProb, abilities.dex.missileAttackAdj)
        : null,
      ac,
      saves: chassis
        ? deriveSaves({
            groups: [{ group: chassis.group, level }],
            race,
            con: snapshot.abilities.con,
            wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
            dexDefensiveAdj: abilities.dex.defensiveAdj,
          })
        : null,
      spellSlots: primaryMember ? mergeCasterSlots([primaryMember], snapshot, abilities) : {},
      proficiencies: primary
        ? deriveProficiencySlots(
            { chassisId: primary.chassisId, level },
            { chassisId: primary.chassisId, level },
            abilities.int.bonusLanguages,
            snapshot.spentWeaponSlots,
            snapshot.spentNonweaponSlots,
          )
        : null,
      encumbrance,
      multiclass: { mode, dualClass: NO_DUAL_CLASS, hpAveraged: false },
    };
  }

  const resolution: ArrangementResolution =
    mode === "dualclass"
      ? resolveDualClassArrangement(snapshot.classes, levels, snapshot.abilities.con)
      : resolveMulticlassArrangement(
          snapshot.classes, levels, snapshot.abilities.con, options.multiclassHpAveraging,
        );

  const dualClass =
    mode === "dualclass"
      ? {
          dormantChassisId: (resolution as DualClassResolution).dormantChassisId,
          activeChassisId: (resolution as DualClassResolution).activeChassisId,
          surpassed: (resolution as DualClassResolution).surpassed,
        }
      : NO_DUAL_CLASS;

  return {
    abilities,
    classes: classLevels,
    hpMax: resolution.hpMax,
    thac0: deriveThac0(
      resolution.bestThac0.group,
      resolution.bestThac0.level,
      abilities.str.hitProb,
      abilities.dex.missileAttackAdj,
    ),
    ac,
    saves: deriveSaves({
      groups: resolution.saveGroups,
      race,
      con: snapshot.abilities.con,
      wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
      dexDefensiveAdj: abilities.dex.defensiveAdj,
    }),
    spellSlots: mergeCasterSlots(resolution.casters, snapshot, abilities),
    proficiencies: deriveProficiencySlots(
      resolution.weaponProfSource,
      resolution.nonweaponProfSource,
      abilities.int.bonusLanguages,
      snapshot.spentWeaponSlots,
      snapshot.spentNonweaponSlots,
    ),
    encumbrance,
    multiclass: {
      mode,
      dualClass,
      hpAveraged: mode === "multiclass" && options.multiclassHpAveraging,
    },
  };
}
