// The character derived-data pipeline (spec §5.6). Pure — takes a snapshot + the
// optional-rules bag, returns the object CharacterModel caches onto system.*.
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type {
  ClassId, DerivedAbilities, EncumbranceCategory, SaveCategory,
} from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import { acDexAdjWhileCasting, expandedCastingTimeEnabled } from "../../../core/magic/casting-time";
import { spellPointsEnabled } from "../../../core/magic/spell-points";
import { channellersEnabled } from "../../../core/magic/channellers";
import type {
  ArrangementResolution, ClassArrangement, ClassMember, DualClassResolution,
} from "../../../core/classes/multiclass";
import type { ActorSnapshot } from "./snapshot";
import { applyTraitEffects, resolveTraitTotals } from "./traits";
import { casterTypesDisabled } from "./kits";
import { deriveClassLevels } from "./levels";
import { characterHpMax } from "./hp";
import { deriveThac0 } from "./thac0";
import { deriveAc } from "./ac";
import { deriveSaves } from "./saves";
import { deriveSpellSlots, type SlotRecord } from "./slots";
import { deriveSpellPoints, type SpellPointsRecord } from "./spell-points";
import { deriveChannelling, type ChannellingRecord } from "./channellers";
import { deriveProficiencySlots, type SlotBlock } from "./proficiencies";
import { deriveThiefSkillPoints, type ThiefSkillPointBlock } from "./thief-skills";
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
  spellPoints: { wizard?: SpellPointsRecord; priest?: SpellPointsRecord };
  channelling: { wizard?: ChannellingRecord; priest?: ChannellingRecord };
  /** SP11 Plan C: caster types a kit has switched off (deriveAndCache clears their cached slots / spell points / channelling max) */
  castingDisabled: { wizard: boolean; priest: boolean };
  proficiencies: { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } | null;
  thiefSkills: ThiefSkillPointBlock;
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

function noDualClass(): CharacterDerived["multiclass"]["dualClass"] {
  return { dormantChassisId: null, activeChassisId: null, surpassed: false };
}

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
    // Sub-project 14 Plan A: a free magick occupies a spell-points cap slot
    // (Table 17), never a classic Table-21 slot — exclude it here (not in
    // slots.ts itself, which stays untouched) so it's truly inert to the
    // classic path whether the spell-points rule is on or off (spec §5).
    wizardMemorized: snapshot.wizardMemorized.filter((mem) => mem.magickType !== "free"),
    // Sub-project 14 priest theurgies: a free theurgy likewise never occupies a classic priest slot.
    priestMemorized: snapshot.priestMemorized.filter((mem) => mem.magickType !== "free"),
  };
}

/** SP11 Plan C: drops classes whose kit switched casting off — the single choke point for slots, spell points and channelling. */
function enabledCasters(casters: readonly ClassMember[], snapshot: ActorSnapshot): ClassMember[] {
  return casters.filter((m) => !snapshot.classes.some((c) => c.chassisId === m.chassisId && c.castingDisabled));
}

function mergeCasterSlots(
  casters: readonly ClassMember[],
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
): { wizard?: SlotRecord; priest?: SlotRecord } {
  let out: { wizard?: SlotRecord; priest?: SlotRecord } = {};
  for (const c of enabledCasters(casters, snapshot)) {
    out = { ...out, ...deriveSpellSlots(spellInput(c, snapshot, abilities)) };
  }
  return out;
}

function mergeCasterSpellPoints(
  casters: readonly ClassMember[],
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
): { wizard?: SpellPointsRecord; priest?: SpellPointsRecord } {
  let out: { wizard?: SpellPointsRecord; priest?: SpellPointsRecord } = {};
  for (const c of enabledCasters(casters, snapshot)) {
    out = {
      ...out,
      ...deriveSpellPoints({
        chassisId: c.chassisId,
        level: c.level,
        intScore: snapshot.abilities.int,
        maxSpellLevelKnown: abilities.int.maxSpellLevel,
        specialist: c.specialistSchool !== null,
        wizardMemorized: snapshot.wizardMemorized,
        priestLevel: c.level,
        wisScore: snapshot.abilities.wis,
        conHpAdjustment: abilities.con.hpAdjustment,
        priestMemorized: snapshot.priestMemorized,
      }),
    };
  }
  return out;
}

function mergeCasterChannelling(
  casters: readonly ClassMember[],
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
): { wizard?: ChannellingRecord; priest?: ChannellingRecord } {
  let out: { wizard?: ChannellingRecord; priest?: ChannellingRecord } = {};
  for (const c of enabledCasters(casters, snapshot)) {
    out = {
      ...out,
      ...deriveChannelling({
        chassisId: c.chassisId,
        level: c.level,
        specialist: c.specialistSchool !== null,
        conHpAdjustment: abilities.con.hpAdjustment,
        wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
        priestLevel: c.level,
        wisScore: snapshot.abilities.wis,
      }),
    };
  }
  return out;
}

function deriveCharacterBase(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  // NOTE: one flag for deriveAbilities, so abilities.con.mods.hpAdjustment shows
  // the warrior column for any multiclass containing a warrior. The HP *math*
  // (multiclass.ts) uses the correct per-class column; this only affects the
  // cached display value. SP6 sheet should label it per-class if it matters.
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
  const thiefSkills = deriveThiefSkillPoints(snapshot.classes, snapshot.thiefSkillAllocations);
  const levels = classLevels.map((c) => c.level);
  const mode = classifyArrangement(snapshot.classes);
  const race = snapshot.race ?? "human";

  // §5.6 step 6 — AC (class-independent).
  const ac = deriveAc({
    equippedArmor: snapshot.equippedArmor,
    equippedShield: snapshot.equippedShield,
    // PHB p.86 — no Dexterity AC bonus while casting (casting-time rule only)
    dexDefensiveAdj: acDexAdjWhileCasting(
      abilities.dex.defensiveAdj,
      snapshot.isCasting && expandedCastingTimeEnabled(options),
    ),
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
            racialSaveAdjustment: snapshot.raceLayer?.conSaveBonusAdjustment ?? 0,
            racialFlatSaveBonus: snapshot.raceLayer?.flatSaveBonus ?? null,
          })
        : null,
      spellSlots: primaryMember ? mergeCasterSlots([primaryMember], snapshot, abilities) : {},
      spellPoints:
        primaryMember && spellPointsEnabled(options) ? mergeCasterSpellPoints([primaryMember], snapshot, abilities) : {},
      channelling:
        primaryMember && channellersEnabled(options) ? mergeCasterChannelling([primaryMember], snapshot, abilities) : {},
      castingDisabled: casterTypesDisabled(snapshot.classes),
      proficiencies: primary
        ? deriveProficiencySlots(
            { chassisId: primary.chassisId, level },
            { chassisId: primary.chassisId, level },
            abilities.int.bonusLanguages,
            snapshot.spentWeaponSlots,
            snapshot.spentNonweaponSlots,
          )
        : null,
      thiefSkills,
      encumbrance,
      multiclass: { mode, dualClass: noDualClass(), hpAveraged: false },
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
      : noDualClass();

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
      racialSaveAdjustment: snapshot.raceLayer?.conSaveBonusAdjustment ?? 0,
      racialFlatSaveBonus: snapshot.raceLayer?.flatSaveBonus ?? null,
    }),
    spellSlots: mergeCasterSlots(resolution.casters, snapshot, abilities),
    spellPoints: spellPointsEnabled(options) ? mergeCasterSpellPoints(resolution.casters, snapshot, abilities) : {},
    channelling: channellersEnabled(options) ? mergeCasterChannelling(resolution.casters, snapshot, abilities) : {},
    castingDisabled: casterTypesDisabled(snapshot.classes),
    proficiencies: deriveProficiencySlots(
      resolution.weaponProfSource,
      resolution.nonweaponProfSource,
      abilities.int.bonusLanguages,
      snapshot.spentWeaponSlots,
      snapshot.spentNonweaponSlots,
    ),
    thiefSkills,
    encumbrance,
    multiclass: {
      mode,
      dualClass,
      hpAveraged: mode === "multiclass" && options.multiclassHpAveraging,
    },
  };
}

/**
 * The character pipeline (spec §5.6) plus the SP8 Plan 8c trait effects. While
 * the character-point build rule is off `resolveTraitTotals` is all zeros, so
 * this equals the base pipeline exactly.
 */
export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  return applyTraitEffects(deriveCharacterBase(snapshot, options), resolveTraitTotals(snapshot.traits, options, snapshot.kitEffects ?? []));
}
