// Player's Option: Combat & Tactics weapon mastery (SP7 Plan 7c). Collapses
// the old specialized:boolean into a 4-step masteryTier scale: 0 = proficient
// only, 1 = Specialized (unchanged from weaponSpecializationEffect/Cost),
// 2 = Mastery, 3 = Grand Mastery. Tier 2/3 bonuses and the tier-cost
// progression are this project's OWN designed numbers (spec §2's "Weapon
// mastery tier model" + this project's content-policy constraint), not
// transcribed from the Combat & Tactics book's actual tables. The book's
// separate "High Mastery" tier is skipped (spec §7, out of scope).
import { weaponSpecializationEffect, weaponSpecializationSlotCost } from "./weapon";
import type { SpecializationCategory } from "../types";

export interface MasteryEffect {
  toHit: number;
  damage: number;
  extraAttacks: number;
}

/**
 * The attack/damage bonus and extra-attacks-per-round grant for a weapon
 * proficiency at `tier` (0-3). Tier 1's values are `weaponSpecializationEffect`'s
 * existing melee/missile split, wrapped directly so the two can never
 * silently drift apart. Tiers 2 and 3 apply a flat bonus regardless of
 * category — unlike tier 1, they do not carry forward the missile-only
 * point-blank distinction (point-blank range detection still doesn't exist
 * anywhere in this codebase — see `weaponSpecializationEffect`'s own doc
 * comment).
 */
export function weaponMasteryEffect(
  tier: 0 | 1 | 2 | 3,
  category: SpecializationCategory,
): MasteryEffect {
  if (tier === 0) return { toHit: 0, damage: 0, extraAttacks: 0 };
  if (tier === 1) {
    const spec = weaponSpecializationEffect(category);
    return { toHit: spec.toHit, damage: spec.damage, extraAttacks: 0 };
  }
  if (tier === 2) return { toHit: 2, damage: 3, extraAttacks: 0 };
  return { toHit: 3, damage: 3, extraAttacks: 1 };
}

/**
 * Total weapon-proficiency slots that must be invested to REACH `tier`
 * (cumulative — matches `weaponSpecializationSlotCost`'s existing shape, so
 * callers charge `max(0, weaponMasteryTierCost(tier, category) -
 * prof.slotsInvested)`). Tier 1 is unchanged from
 * `weaponSpecializationSlotCost`; tiers 2 and 3 extend it by a flat 2 and 3
 * more slots per step respectively (this plan's own progression).
 */
export function weaponMasteryTierCost(tier: 1 | 2 | 3, category: SpecializationCategory): number {
  const tier1 = weaponSpecializationSlotCost(category);
  if (tier === 1) return tier1;
  if (tier === 2) return tier1 + 2;
  return tier1 + 5;
}
