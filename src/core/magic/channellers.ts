// Player's Option: Spells & Magic pp.80-82 (Sub-project 14 Plan B): the
// Channellers variant. A channelling wizard's spell selection (fixed/free
// magick) costs nothing from the pool — it only defines the repertoire and,
// via the SAME Table 18 numbers Plan A already prices memorization with, the
// per-CAST cost. The pool itself is a persisted, stateful resource that
// depletes at cast time and recovers gradually (Table 20), replacing the
// Intelligence-bonus SP-total term (Table 19) with a Constitution/Wisdom
// substitution (p.82). "Magical attack adjustment for Wisdom" resolves to
// this codebase's existing magicalDefenseAdj — no separate table for that
// term exists anywhere in the sourcebook (design spec §1.1). Table 21 fatigue
// is Plan C — not built here. Pure.
import { magickCost, spellPointsEnabled, wizardBaseSpellPoints, type MagickType } from "./spell-points";
import type { OptionalRules } from "../options";

/** THE one place the Channellers gate is written — nests under Plan A's own
 *  master gate. Every consumer calls this; never restate the expression. */
export function channellersEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints" | "channelers">,
): boolean {
  return spellPointsEnabled(rules) && rules.channelers;
}

const CHANNELLER_MIN_SP = 4;

/** Table 17 base (+ specialist bonus) with the Table 19 Intelligence bonus
 *  replaced by Constitution's hpAdjustment and Wisdom's magicalDefenseAdj
 *  (p.82: "the character's hit point adjustment for Constitution and his
 *  magical attack adjustment for Wisdom are added to or subtracted from his
 *  spell point total"). Floored at 4 ("all wizards have at least 4 spell
 *  points") — a floor the classic Table 19 addition never needs (it can't go
 *  negative) but this substitution can. */
export function channellerMaxSp(
  wizardLevel: number,
  specialist: boolean,
  conHpAdjustment: number,
  wisMagicalDefenseAdj: number,
): number {
  const base = wizardBaseSpellPoints(wizardLevel, specialist);
  return Math.max(CHANNELLER_MIN_SP, base + conHpAdjustment + wisMagicalDefenseAdj);
}

/** Table 18 (same lookup Plan A prices memorization with) — a channeller pays
 *  this at CAST time instead (p.81). */
export function canAffordCast(current: number, spellLevel: number, magickType: MagickType): boolean {
  return magickCost(spellLevel, magickType) <= current;
}

export function spendCastSp(current: number, spellLevel: number, magickType: MagickType): number {
  return current - magickCost(spellLevel, magickType);
}

export type ChannellerActivity = "hardExertion" | "walkingRiding" | "sittingResting" | "sleeping";

interface RecoveryRate {
  flatPerHour: number;
  percentPerHour: number;
}

// Table 20: Spell Point Recovery for Channellers (p.82).
const ACTIVITY_RECOVERY_RATES: Readonly<Record<ChannellerActivity, RecoveryRate>> = {
  hardExertion: { flatPerHour: 0, percentPerHour: 0 },
  walkingRiding: { flatPerHour: 2, percentPerHour: 2 },
  sittingResting: { flatPerHour: 4, percentPerHour: 5 },
  sleeping: { flatPerHour: 8, percentPerHour: 10 },
};

/** Table 20: per hour, recover the flat rate or the percentage of max,
 *  whichever is BETTER (p.82's own worked example: a 55-max pool sleeping
 *  recovers 8/hr, not the 5.5-rounds-to-6 percentage). Clamped at max. */
export function recoverSp(current: number, max: number, activity: ChannellerActivity, hours: number): number {
  const rate = ACTIVITY_RECOVERY_RATES[activity];
  const perHour = Math.max(rate.flatPerHour, Math.round((rate.percentPerHour / 100) * max));
  return Math.min(max, current + perHour * hours);
}
