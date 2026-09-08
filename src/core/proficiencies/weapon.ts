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
  /** the +2 point-blank attack bonus a bow/crossbow specialist gains (PHB p.52); 0 for melee. Point-blank range is 6-30 ft for bows, 6-60 ft for crossbows; the caller decides when the target is in that band. */
  pointBlankAttackBonus: number;
}

/**
 * The flat attack/damage bonus a specialist gets, plus the point-blank bonus.
 * Melee: +1 / +2, no point-blank. Bow and crossbow: no flat bonus, +2 at
 * point-blank range (extra attacks per round for crossbows are Table 35 —
 * specialistAttacksPerRound in weapons/).
 */
export function weaponSpecializationEffect(category: SpecializationCategory): SpecializationEffect {
  return category === "melee"
    ? { toHit: 1, damage: 2, pointBlankAttackBonus: 0 }
    : { toHit: 0, damage: 0, pointBlankAttackBonus: 2 };
}

/** Weapon specialization is available only to single-class fighters (PHB p.52). */
export function canWeaponSpecialize(input: {
  specializationAllowed: boolean;
  isSingleClass: boolean;
}): boolean {
  return input.specializationAllowed && input.isSingleClass;
}
