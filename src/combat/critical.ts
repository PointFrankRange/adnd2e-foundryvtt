// This project's own designed severity tables for natural-20/natural-1
// attack rolls (spec §2 "Critical hits/fumbles" — full severity tables, not
// a single toggleable formula). Content policy: mechanical values only, not
// transcribed from any rulebook's actual crit/fumble table.

export type CriticalTier = "solid" | "devastating" | "brutal";

export interface CriticalHitResult {
  tier: CriticalTier;
  /** multiplies the floored damage total, same mechanism as the existing
   *  backstabMultiplier (combat/card-types.ts) */
  damageMultiplier: number;
  /** added on top of the multiplied total */
  flatBonus: number;
}

/** d10 1-5: solid hit (x2). d10 6-9: devastating hit (x3). d10 10: brutal hit
 *  (x3 + flat +3). Backstab and critical hits do not stack — the caller only
 *  invokes this for a non-backstab natural 20 (a locked plan decision, see
 *  this plan's Global Constraints). */
export function criticalSeverity(d10: number): CriticalHitResult {
  if (d10 <= 5) return { tier: "solid", damageMultiplier: 2, flatBonus: 0 };
  if (d10 <= 9) return { tier: "devastating", damageMultiplier: 3, flatBonus: 0 };
  return { tier: "brutal", damageMultiplier: 3, flatBonus: 3 };
}

export type FumbleTier = "miss" | "weaponDrops" | "selfInjury";
export type FumbleEffect = "none" | "weaponDrops" | "selfInjury";

export interface FumbleResult {
  tier: FumbleTier;
  effect: FumbleEffect;
  /** a dice formula string for the caller to roll, or null when there is
   *  no self-injury roll for this tier */
  selfInjuryDice: string | null;
}

/** d10 1-5: just a miss, no extra effect. d10 6-8: the weapon drops (caller
 *  unequips it). d10 9-10: minor self-injury, roll 1d3 against the attacker. */
export function fumbleSeverity(d10: number): FumbleResult {
  if (d10 <= 5) return { tier: "miss", effect: "none", selfInjuryDice: null };
  if (d10 <= 8) return { tier: "weaponDrops", effect: "weaponDrops", selfInjuryDice: null };
  return { tier: "selfInjury", effect: "selfInjury", selfInjuryDice: "1d3" };
}
