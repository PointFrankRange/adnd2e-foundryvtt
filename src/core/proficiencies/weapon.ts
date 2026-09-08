// PHB p.52: weapon proficiency penalties + fighter weapon specialization.
// Specialist attacks-per-round (Table 35) and bow/crossbow point-blank range
// are Plan 1b.7 (they need weapon-category data).
import type { SpecializationCategory, WeaponProficiencyMode } from "../types";

/**
 * The attack-roll modifier for a weapon the attacker is proficient / related /
 * not proficient with. `nonProficiencyPenalty` is the class-group value
 * (ClassChassis.nonProficiencyPenalty, already negative).
 */
export function weaponAttackPenalty(
  nonProficiencyPenalty: number,
  mode: WeaponProficiencyMode,
): number {
  if (mode === "proficient") return 0;
  if (mode === "non-proficient") return nonProficiencyPenalty;
  return -Math.ceil(Math.abs(nonProficiencyPenalty) / 2);
}

/** Proficiency slots to become proficient AND specialize (PHB p.52). */
export function weaponSpecializationSlotCost(category: SpecializationCategory): number {
  return category === "bow" ? 3 : 2;
}

export interface SpecializationEffect {
  toHit: number;
  damage: number;
}

/**
 * The flat attack/damage bonus a specialist gets. Melee: +1 / +2. Bow and
 * crossbow specialists get a point-blank range band instead — modelled in
 * Plan 1b.7 — so they return no flat bonus here.
 */
export function weaponSpecializationEffect(category: SpecializationCategory): SpecializationEffect {
  return category === "melee" ? { toHit: 1, damage: 2 } : { toHit: 0, damage: 0 };
}

/** Weapon specialization is available only to single-class fighters (PHB p.52). */
export function canWeaponSpecialize(input: {
  specializationAllowed: boolean;
  isSingleClass: boolean;
}): boolean {
  return input.specializationAllowed && input.isSingleClass;
}
