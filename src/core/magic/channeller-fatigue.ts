// Player's Option: Spells & Magic pp.82-84 (Sub-project 14 Plan C): Table 21
// Spell Fatigue for channelling wizards. Table 21's rows are caster-level
// BANDS (same shape as core/saves/tables.ts's SAVE_MATRICES); its columns are
// which SPELL level causes each tier. Re-expressed here as a literal 9-entry
// (spell levels 1-9) tier array per band rather than range-matching logic —
// every "cantrip"-only cell is simply unreachable (this project's spell
// schema has no level 0, matching how Plans A/B already treat cantrips).
// Pure.
import { assertLevel, assertSpellLevel } from "../errors";
import { channellersEnabled } from "./channellers";
import type { OptionalRules } from "../options";

/** THE one place the fatigue gate is written — nests under Plan B's own gate. */
export function channellerFatigueEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints" | "channelers" | "channellerFatigue">,
): boolean {
  return channellersEnabled(rules) && rules.channellerFatigue;
}

export type FatigueTier = "light" | "moderate" | "heavy" | "severe" | "mortal";

/** Severity order, lowest to highest — index doubles as a shift amount. */
const TIER_ORDER: readonly FatigueTier[] = ["light", "moderate", "heavy", "severe", "mortal"];

function shiftTier(tier: FatigueTier, amount: number): FatigueTier {
  const index = Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + amount);
  return TIER_ORDER[index]!;
}

function worseOf(a: FatigueTier, b: FatigueTier): FatigueTier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

interface FatigueBand {
  minLevel: number;
  /** tiers[spellLevel - 1] for spell levels 1-9. */
  tiers: readonly FatigueTier[];
}

// prettier-ignore
const FATIGUE_BANDS: readonly FatigueBand[] = [
  { minLevel: 1,  tiers: ["heavy", "severe", "mortal", "mortal", "mortal", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 3,  tiers: ["moderate", "heavy", "severe", "mortal", "mortal", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 5,  tiers: ["moderate", "moderate", "heavy", "severe", "mortal", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 7,  tiers: ["light", "moderate", "moderate", "heavy", "severe", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 9,  tiers: ["light", "light", "moderate", "moderate", "heavy", "severe", "mortal", "mortal", "mortal"] },
  { minLevel: 12, tiers: ["light", "light", "light", "moderate", "moderate", "heavy", "severe", "mortal", "mortal"] },
  { minLevel: 14, tiers: ["light", "light", "light", "light", "moderate", "moderate", "heavy", "severe", "mortal"] },
  { minLevel: 16, tiers: ["light", "light", "light", "light", "light", "moderate", "moderate", "heavy", "severe"] },
  { minLevel: 18, tiers: ["light", "light", "light", "light", "light", "moderate", "moderate", "heavy", "heavy"] },
  { minLevel: 20, tiers: ["light", "light", "light", "light", "light", "moderate", "moderate", "moderate", "heavy"] },
  { minLevel: 23, tiers: ["light", "light", "light", "light", "light", "light", "moderate", "moderate", "heavy"] },
  { minLevel: 26, tiers: ["light", "light", "light", "light", "light", "light", "moderate", "moderate", "moderate"] },
];

/** Table 21: the base fatigue tier for casting `spellLevel` at `casterLevel`, BEFORE HP/SP escalation or stacking. */
export function baseFatigueTier(casterLevel: number, spellLevel: number): FatigueTier {
  assertLevel(casterLevel, "casterLevel");
  assertSpellLevel(spellLevel);
  let band = FATIGUE_BANDS[0]!;
  for (const b of FATIGUE_BANDS) {
    if (casterLevel >= b.minLevel) band = b;
  }
  return band.tiers[spellLevel - 1]!;
}

/** p.82-83: HP loss escalation, measured BEFORE this cast's own effects. */
export function escalateForHp(tier: FatigueTier, currentHp: number, maxHp: number): FatigueTier {
  if (currentHp <= maxHp * 0.25) return shiftTier(tier, 2);
  if (currentHp <= maxHp * 0.5) return shiftTier(tier, 1);
  return tier;
}

/** p.83: SP loss escalation — `currentSp`/`maxSp` measured BEFORE this cast's own cost is deducted. */
export function escalateForSp(tier: FatigueTier, currentSp: number, maxSp: number): FatigueTier {
  const spentFraction = 1 - currentSp / maxSp;
  if (spentFraction >= 0.75) return shiftTier(tier, 2);
  if (spentFraction >= 0.5) return shiftTier(tier, 1);
  return tier;
}

/** p.83: "increase the fatigue category of the new spell by one level if
 *  moderately fatigued, two if heavily, three if severely fatigued. The
 *  character then acquires the new fatigue level... or stays where he was,
 *  whichever is worse." `currentTier: null` means not currently fatigued. */
export function applyExistingFatigueStacking(newTier: FatigueTier, currentTier: FatigueTier | null): FatigueTier {
  if (currentTier === null || currentTier === "light") return newTier;
  const shiftAmount = currentTier === "moderate" ? 1 : currentTier === "heavy" ? 2 : 3; // "severe"
  return worseOf(shiftTier(newTier, shiftAmount), currentTier);
}

export interface ResolveCastFatigueInput {
  casterLevel: number;
  spellLevel: number;
  /** before this cast's own effects */
  currentHp: number;
  maxHp: number;
  /** before this cast's own cost is deducted */
  currentSp: number;
  maxSp: number;
  currentTier: FatigueTier | null;
}

/** Composes the book's own order: base tier -> HP escalation -> SP escalation -> existing-fatigue stacking. */
export function resolveCastFatigue(input: ResolveCastFatigueInput): FatigueTier {
  let tier = baseFatigueTier(input.casterLevel, input.spellLevel);
  tier = escalateForHp(tier, input.currentHp, input.maxHp);
  tier = escalateForSp(tier, input.currentSp, input.maxSp);
  return applyExistingFatigueStacking(tier, input.currentTier);
}

/** p.83 "Effects of Fatigue" — attack-roll penalty (negative = worse). Mortal
 *  is handled by canAct() blocking the roll entirely (condition-effects.ts),
 *  not a numeric penalty. */
export const FATIGUE_ATTACK_PENALTY: Readonly<Record<FatigueTier, number>> = {
  light: 0, moderate: -1, heavy: -2, severe: -4, mortal: 0,
};

/** Same sign convention as proneArmorClassPenalty (positive = worse AC). The
 *  book gives no numeric AC penalty for mortal (incapacitated instead). */
export const FATIGUE_AC_PENALTY: Readonly<Record<FatigueTier, number>> = {
  light: 0, moderate: 0, heavy: 1, severe: 3, mortal: 0,
};

/** p.83: light/moderate/heavy are fractions of the current rate (floored);
 *  severe is a flat rate of 1 regardless of input; mortal is 0 ("collapse"). */
export function fatigueMovementRate(tier: FatigueTier, currentRate: number): number {
  switch (tier) {
    case "light": return Math.floor(currentRate * 0.75);
    case "moderate": return Math.floor(currentRate * 0.5);
    case "heavy": return Math.floor(currentRate * 0.25);
    case "severe": return 1;
    case "mortal": return 0;
  }
}

/** p.83 "Recovering from Fatigue" — the rest unit each tier's save interval
 *  uses. Display/hint text only (§2 of the spec: honor system, no real-time
 *  enforcement). Mortal has no recovery path of its own (it resolves
 *  immediately via save-or-die) — included only so the type is total. */
export const FATIGUE_RECOVERY_INTERVAL: Readonly<Record<FatigueTier, "round" | "turn" | "hour">> = {
  light: "round", moderate: "round", heavy: "turn", severe: "hour", mortal: "hour",
};

/** The single canonical tier -> CONDITIONS id map (locked design decision 2) — every other consumer imports this, never restates the 5 strings. */
export const FATIGUE_CONDITION_ID: Readonly<Record<FatigueTier, string>> = {
  light: "lightFatigue", moderate: "moderateFatigue", heavy: "heavyFatigue", severe: "severeFatigue", mortal: "mortalFatigue",
};

const CONDITION_ID_TO_TIER: ReadonlyMap<string, FatigueTier> = new Map(
  (Object.entries(FATIGUE_CONDITION_ID) as [FatigueTier, string][]).map(([tier, id]) => [id, tier]),
);

/** Reverse of FATIGUE_CONDITION_ID — null if `conditionId` isn't a fatigue tier id. */
export function tierForConditionId(conditionId: string): FatigueTier | null {
  return CONDITION_ID_TO_TIER.get(conditionId) ?? null;
}

/** One step down the ladder; null means fatigue clears entirely (below light). */
export function nextTierDown(tier: FatigueTier): FatigueTier | null {
  const index = TIER_ORDER.indexOf(tier) - 1;
  return index < 0 ? null : TIER_ORDER[index]!;
}
