// PHB p.54-55: the 1d20 non-weapon proficiency check + the group-crossover
// slot-cost rule (Table 38). The ~70-entry Table 37 master list ships as a
// compendium pack / importer data in Plan 1c, not here.
import { assertAbilityScore, assertD20, assertLevel } from "../errors";
import type { AbilityKey, ClassId, NonweaponGroup } from "../types";

/** PHB Table 38 — the non-weapon proficiency groups each base class can pick from. */
// prettier-ignore
export const CLASS_PROFICIENCY_GROUPS: Readonly<Record<ClassId, readonly NonweaponGroup[]>> = {
  fighter: ["warrior", "general"],
  mage:    ["wizard", "general"],
  cleric:  ["priest", "general"],
  thief:   ["rogue", "general"],
};

/**
 * Proficiency slots a non-weapon proficiency costs: the Table-37 base cost when
 * its group is one of the class's groups, otherwise one slot more (PHB p.54).
 */
export function nonweaponSlotCost(
  baseCost: number,
  proficiencyGroup: NonweaponGroup,
  classId: ClassId,
): number {
  return CLASS_PROFICIENCY_GROUPS[classId].includes(proficiencyGroup) ? baseCost : baseCost + 1;
}

export interface NonweaponCheckInput {
  /** which ability governs this proficiency (PHB Table 37) */
  ability: AbilityKey;
  abilityScore: number;
  /** the Table-37 check modifier for this proficiency (may be negative) */
  checkModifier: number;
  /** total slots invested in the proficiency (>= 1); each beyond the first is +1 */
  slotsInvested?: number;
  /** the DM's ad-hoc adjustment to the ability score for this attempt */
  situationalModifier?: number;
  /** the 1d20 result */
  roll: number;
}

export interface NonweaponCheckResult {
  success: boolean;
  /** natural 20 — always a failure (PHB p.55) */
  autoFail: boolean;
  /** the number the roll must be at or under */
  target: number;
  roll: number;
}

export function nonweaponCheck(input: NonweaponCheckInput): NonweaponCheckResult {
  assertD20(input.roll);
  assertAbilityScore(input.abilityScore, input.ability);
  const slotsInvested = input.slotsInvested ?? 1;
  assertLevel(slotsInvested, "slotsInvested");

  const target =
    input.abilityScore + input.checkModifier + (slotsInvested - 1) + (input.situationalModifier ?? 0);
  const autoFail = input.roll === 20;
  return { success: !autoFail && input.roll <= target, autoFail, target, roll: input.roll };
}
