// PHB Tables 47/48 (p.76-78): character encumbrance. Both tables are derived
// from the Strength weight allowance / max press (Table 1) plus a small
// per-score step; only the step and the STR-3 sparse row are literal here.
import { assertAbilityScore } from "../errors";
import type { EncumbranceCategory } from "../types";

const THRESHOLD_COUNT = 12;
const STR3_CEILINGS: readonly number[] = [5, 6, 7, 8, 9];
const STR3_MAX = 3;

/** PHB Tables 47/48 per-score step. STR <= 3 is a sparse special case (step returned for completeness). */
export function encumbranceStep(strengthScore: number): number {
  assertAbilityScore(strengthScore, "str");
  if (strengthScore <= STR3_MAX) return 5;
  if (strengthScore <= 5) return 1;
  if (strengthScore <= 7) return 3;
  if (strengthScore <= 9) return 5;
  if (strengthScore <= 11) return 6;
  if (strengthScore <= 13) return 8;
  if (strengthScore <= 16) return 10; // PHB bands 14-15 and 16 both step 10
  if (strengthScore === 17) return 12;
  return 13; // 18 and every exceptional band; >= 19 extrapolated
}

/** Table 47's "Max. Carried Weight" is exactly the Strength max press (Table 1). */
export function maxCarriedWeight(strengthMaxPress: number): number {
  return strengthMaxPress;
}

export interface EncumbranceInput {
  /** total weight carried, in pounds (>= 0); magical armour weight excluded by the caller */
  carried: number;
  strengthScore: number;
  /** strength().weightAllowance — the unencumbered ceiling */
  weightAllowance: number;
  /** strength().maxPress — the absolute carry cap */
  maxPress: number;
}

/**
 * The twelve Table-48 weight thresholds, `weightAllowance + i * step`.
 * For STR <= 3 returns the five-entry sparse ceiling list instead.
 */
export function encumbranceThresholds(
  input: Pick<EncumbranceInput, "strengthScore" | "weightAllowance">,
): readonly number[] {
  assertAbilityScore(input.strengthScore, "str");
  if (input.strengthScore <= STR3_MAX) return STR3_CEILINGS;
  const step = encumbranceStep(input.strengthScore);
  return Array.from({ length: THRESHOLD_COUNT }, (_unused, i) => input.weightAllowance + i * step);
}

function str3Category(carried: number): EncumbranceCategory {
  if (carried <= 5) return "unencumbered";
  if (carried === 6) return "light";
  if (carried === 7) return "moderate";
  if (carried <= 9) return "heavy";
  if (carried === 10) return "severe";
  return "immobile";
}

/** The encumbrance category for `carried` weight at this Strength (PHB Table 47). */
export function encumbranceCategory(input: EncumbranceInput): EncumbranceCategory {
  assertAbilityScore(input.strengthScore, "str");
  if (!Number.isFinite(input.carried) || input.carried < 0) {
    throw new RangeError(`carried weight must be a number >= 0, got ${input.carried}`);
  }
  if (input.strengthScore <= STR3_MAX) return str3Category(input.carried);

  const t = encumbranceThresholds(input);
  if (input.carried <= input.weightAllowance) return "unencumbered";
  if (input.carried <= t[3]) return "light";
  if (input.carried <= t[6]) return "moderate";
  if (input.carried <= t[9]) return "heavy";
  if (input.carried <= input.maxPress) return "severe";
  return "immobile";
}
