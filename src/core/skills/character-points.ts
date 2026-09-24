// Player's Option: Skills & Powers character-point build (SP8 Plan 8c). CP is a
// creation budget spent on sub-scores and traits; spent CP is DERIVED from the
// authored sub-scores and owned traits, so removing a trait refunds it
// automatically (spec §2). The cost curve, the pool default and the refund cap
// are this project's OWN designed numbers (content policy). No Foundry imports.
import { SUB_ABILITIES, subAbilitiesEnabled } from "../abilities/sub-abilities";
import type { OptionalRules } from "../options";
import type { AbilityKey } from "../types";

/** Total CP that disadvantage traits may refund; a disadvantage past the cap still applies its effect. */
export const DISADVANTAGE_REFUND_CAP = 10;

/** The authored pool a new character starts with (GM-editable). */
export const DEFAULT_CHARACTER_POINT_POOL = 60;

/**
 * THE one place the character-point-build gate is written (master AND-gate,
 * spec §2). Everything else — the ledger helper, the derive/prepare trait
 * totals, the drop rule — is built on this; never restate the expression.
 */
export function characterPointBuildEnabled(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">,
): boolean {
  return rules.skillsAndPowersEnabled && rules.characterPointBuild;
}

/**
 * CP cost of one sub-score (spec §4.3): <= 6 -> -4 (the maximum refund); 7..14 ->
 * score - 10 (baseline 10 costs 0); 15..17 -> 4 + 2 * (score - 14); 18..25 ->
 * 10 + 3 * (score - 17). Reaching 25 costs 34.
 */
export function subScoreCpCost(score: number): number {
  if (score <= 6) return -4;
  if (score <= 14) return score - 10;
  if (score <= 17) return 4 + 2 * (score - 14);
  return 10 + 3 * (score - 17);
}

/** Total CP the disadvantage traits refund, capped at `DISADVANTAGE_REFUND_CAP`. */
export function disadvantageRefund(traitCosts: readonly number[]): number {
  return Math.min(DISADVANTAGE_REFUND_CAP, uncappedRefund(traitCosts));
}

function uncappedRefund(traitCosts: readonly number[]): number {
  return traitCosts.reduce((sum, cost) => (cost < 0 ? sum - cost : sum), 0);
}

export interface CharacterPointLedger {
  pool: number;
  /** Σ subScoreCpCost over the AUTHORED (non-null) sub-scores */
  subSpent: number;
  /** Σ positive trait costs */
  traitSpent: number;
  /** disadvantage refund after the cap */
  refund: number;
  /** disadvantage refund before the cap */
  refundUncapped: number;
  /** subSpent + traitSpent - refund (may be negative: sub-score refunds are uncapped) */
  spent: number;
  available: number;
  overspent: boolean;
}

/**
 * The CP ledger. A `null` sub-score is uncommitted and costs 0 (even though the
 * derivation falls back to the main score for it), so an existing character
 * with authored main scores shows no false overspend when the rules are enabled.
 */
export function characterPointLedger(input: {
  pool: number;
  subScores: readonly (number | null)[];
  traitCosts: readonly number[];
}): CharacterPointLedger {
  const subSpent = input.subScores.reduce<number>((sum, s) => (s === null ? sum : sum + subScoreCpCost(s)), 0);
  const traitSpent = input.traitCosts.reduce((sum, cost) => (cost > 0 ? sum + cost : sum), 0);
  const refundUncapped = uncappedRefund(input.traitCosts);
  const refund = Math.min(DISADVANTAGE_REFUND_CAP, refundUncapped);
  const spent = subSpent + traitSpent - refund;
  const available = input.pool - spent;
  return { pool: input.pool, subSpent, traitSpent, refund, refundUncapped, spent, available, overspent: available < 0 };
}

type AuthoredAbilities = Partial<
  Record<AbilityKey, { sub?: { a: number | null; b: number | null } | null }>
>;

/** The twelve AUTHORED sub-scores (null = unset), in ability order: str a,b, dex a,b, ... */
export function authoredSubScores(abilities: AuthoredAbilities): (number | null)[] {
  const out: (number | null)[] = [];
  for (const key of Object.keys(SUB_ABILITIES) as AbilityKey[]) {
    const sub = abilities[key]?.sub;
    out.push(sub?.a ?? null, sub?.b ?? null);
  }
  return out;
}

/**
 * The ledger for an actor, or `null` while the character-point build rule is off
 * (so a `null` ledger IS the gate for the sheet context and the drop handler).
 * Sub-scores count toward the ledger only when sub-ability scores are ALSO on.
 */
export function characterPointLedgerFor(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild" | "subAbilityScores">,
  input: { pool: number; abilities: AuthoredAbilities; traitCosts: readonly number[] },
): CharacterPointLedger | null {
  if (!characterPointBuildEnabled(rules)) return null;
  return characterPointLedger({
    pool: input.pool,
    subScores: subAbilitiesEnabled(rules) ? authoredSubScores(input.abilities) : [],
    traitCosts: input.traitCosts,
  });
}

export type TraitDropVerdict = { ok: true; refund: number } | { ok: false; reason: string };

/**
 * Whether a trait may be taken. Rejects a duplicate `traitId` (a blank id — a
 * hand-made custom trait — never duplicates) and an advantage costing more than
 * `available`. A disadvantage is always allowed; the verdict's `refund` is the
 * CP it actually returns after the cap (`refundedSoFar` = the cap already used).
 */
export function canAffordTrait(input: {
  traitCost: number;
  traitId: string;
  ownedTraitIds: readonly string[];
  available: number;
  refundedSoFar: number;
}): TraitDropVerdict {
  if (input.traitId !== "" && input.ownedTraitIds.includes(input.traitId)) {
    return { ok: false, reason: "ADND2E.sheet.drop.duplicateTrait" };
  }
  if (input.traitCost < 0) {
    const room = Math.max(0, DISADVANTAGE_REFUND_CAP - input.refundedSoFar);
    return { ok: true, refund: Math.min(-input.traitCost, room) };
  }
  if (input.traitCost > 0 && input.traitCost > input.available) {
    return { ok: false, reason: "ADND2E.sheet.drop.insufficientCp" };
  }
  return { ok: true, refund: 0 };
}
