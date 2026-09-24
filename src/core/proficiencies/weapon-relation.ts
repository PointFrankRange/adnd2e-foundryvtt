// Player's Option: Skills & Powers expanded weapon proficiencies (SP8 Plan 8b).
// Core has long defined a "related" WeaponProficiencyMode (half the
// non-proficiency penalty — see weaponAttackPenalty in ./weapon) that nothing
// ever resolved. This module supplies the missing resolution: an attacker who
// is not proficient with a weapon but holds a specific-weapon proficiency in the
// same weapon group attacks at the half penalty. Pure — the caller (the
// Foundry-layer roll flow) computes the three booleans from the actor's items.
import type { OptionalRules } from "../options";
import type { WeaponProficiencyMode } from "../types";

/**
 * THE one place the expanded-proficiencies gate is written (master AND-gate,
 * spec §2). The roll flow calls this — never restate the expression.
 */
export function expandedProficienciesEnabled(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "expandedProficiencies">,
): boolean {
  return rules.skillsAndPowersEnabled && rules.expandedProficiencies;
}

/**
 * True when the attacked weapon's group is non-empty and equals the group of
 * at least one held SPECIFIC-weapon proficiency. An unset group (empty string)
 * on either side never matches.
 */
export function isRelatedGroup(weaponGroup: string, heldSpecificGroups: readonly string[]): boolean {
  return weaponGroup !== "" && heldSpecificGroups.includes(weaponGroup);
}

export interface WeaponProficiencyMatch {
  /** a specific-weapon proficiency names this exact weapon */
  exactMatch: boolean;
  /** a group proficiency covers this weapon's group */
  groupMatch: boolean;
  /** the rule is on AND a held specific proficiency shares this weapon's group */
  relatedGroupMatch: boolean;
}

/**
 * Precedence: exact or group match -> "proficient" (a real match is never
 * demoted to "related"); else a related-group match -> "related"; else
 * "non-proficient".
 */
export function weaponProficiencyMode(match: WeaponProficiencyMatch): WeaponProficiencyMode {
  if (match.exactMatch || match.groupMatch) return "proficient";
  if (match.relatedGroupMatch) return "related";
  return "non-proficient";
}
