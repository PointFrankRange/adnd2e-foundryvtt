// The character derived-data pipeline (spec §5.6). Pure — takes a snapshot + the
// optional-rules bag, returns the object CharacterModel caches onto system.*.
// Single-class per Ruling S1; full multiclass aggregation is Plan 1c.3c.
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type { ClassId, DerivedAbilities, EncumbranceCategory, SaveCategory } from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import type { ActorSnapshot } from "./snapshot";
import { deriveClassLevels } from "./levels";
import { characterHpMax } from "./hp";
import { deriveThac0 } from "./thac0";
import { deriveAc } from "./ac";
import { deriveSaves } from "./saves";
import { deriveSpellSlots, type SlotRecord } from "./slots";
import { deriveProficiencySlots, type SlotBlock } from "./proficiencies";
import { deriveEncumbrance } from "./encumbrance";

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
  multiclassPending: boolean;
}

export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");

  // §5.6 step 1 — resolveMulticlass / resolveDualClass — Plan 1c.3c
  // §5.6 step 2 — ability modifiers.
  // Scores are already racially adjusted (CharacterModel.prepareBaseData). Pass
  // race:"human" so deriveAbilities' own applyRacialDeltas is a no-op; halflings
  // never get exceptional Strength (PHB p.19), enforced here since we drop the
  // race hint the engine used for that check.
  const percentile = snapshot.race === "halfling" ? null : snapshot.exceptionalStrengthPercentile;
  const abilities = deriveAbilities(snapshot.abilities, {
    race: "human",
    isWarrior,
    options,
    exceptionalStrengthPercentile: percentile,
  });

  // §5.6 step 3 — levelForXp per class -> canLevelUp.
  const classes = deriveClassLevels(snapshot.classes);
  // Ruling S1 — single-class: the caster / thac0 / save / prof steps read
  // snapshot.classes[0]; derived.classes still lists every class.
  const primary = snapshot.classes[0] ?? null;
  const primaryChassis = primary ? getChassis(primary.chassisId) : null;

  // §5.6 step 4 — HP max.
  const hpMax = primary
    ? characterHpMax(primary.chassisId, classes[0].level, primary.hpRolls, abilities.con.hpAdjustment)
    : 0;

  // §5.6 step 5 — THAC0.
  const thac0 = primaryChassis
    ? deriveThac0(primaryChassis.group, classes[0].level, abilities.str.hitProb, abilities.dex.missileAttackAdj)
    : null;

  // §5.6 step 6 — AC.
  const ac = deriveAc({
    equippedArmor: snapshot.equippedArmor,
    equippedShield: snapshot.equippedShield,
    dexDefensiveAdj: abilities.dex.defensiveAdj,
  });

  // §5.6 step 7 — saves.
  const saves = primaryChassis
    ? deriveSaves({
        group: primaryChassis.group,
        level: classes[0].level,
        race: snapshot.race ?? "human",
        con: snapshot.abilities.con,
        wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
        dexDefensiveAdj: abilities.dex.defensiveAdj,
      })
    : null;

  // §5.6 step 8 — spell slots.
  const spellSlots = primary
    ? deriveSpellSlots({
        chassisId: primary.chassisId,
        level: classes[0].level,
        maxSpellLevelKnown: abilities.int.maxSpellLevel,
        wisdomScore: snapshot.abilities.wis,
        wisdomBonusSpells: abilities.wis.bonusPriestSpells,
        specialist: primary.specialistSchool !== null,
        memorized: snapshot.memorized,
      })
    : {};

  // §5.6 step 9 — proficiency slots.
  const proficiencies = primary
    ? deriveProficiencySlots(
        primary.chassisId,
        classes[0].level,
        abilities.int.bonusLanguages,
        snapshot.spentWeaponSlots,
        snapshot.spentNonweaponSlots,
      )
    : null;

  // §5.6 step 10 — encumbrance.
  const encumbrance = deriveEncumbrance({
    carried: snapshot.carriedWeight,
    strengthScore: snapshot.abilities.str,
    weightAllowance: abilities.str.weightAllowance,
    maxPress: abilities.str.maxPress,
    baseMove: snapshot.baseMovement,
  });

  return {
    abilities,
    classes,
    hpMax,
    thac0,
    ac,
    saves,
    spellSlots,
    proficiencies,
    encumbrance,
    multiclassPending: snapshot.classes.length > 1,
  };
}
