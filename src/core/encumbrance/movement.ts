// PHB Table 64 (p.119) base movement + Table 48 (p.78) modified movement +
// the p.79 "Effects of Encumbrance" combat penalties.
import type { EncumbranceCategory, EncumbranceRule, MovementTier, Race } from "../types";
import { encumbranceCategory, encumbranceThresholds } from "./weight-allowance";

/** PHB Table 64: BASE MOVEMENT RATES (p.119). */
// prettier-ignore
export const BASE_MOVEMENT: Readonly<Record<Race, number>> = {
  human: 12, dwarf: 6, elf: 12, "half-elf": 12, gnome: 6, halfling: 6,
};

// prettier-ignore
const HEADERS: Readonly<Record<MovementTier, readonly number[]>> = {
  12: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  6:  [6,  5,  5,  4, 4, 3, 3, 2, 2, 1, 1, 1],
};

// PHB Table 48 STR-3 row: carried ceilings -> base-12 move rate.
// prettier-ignore
const STR3_ROW: readonly { maxCarried: number; rate: number }[] = [
  { maxCarried: 5, rate: 12 },
  { maxCarried: 6, rate: 10 },
  { maxCarried: 7, rate: 8 },
  { maxCarried: 8, rate: 5 },
  { maxCarried: 9, rate: 3 },
];
const STR3_MAX = 3;

export interface MovementInput {
  baseMove: number;
  carried: number;
  strengthScore: number;
  weightAllowance: number;
  maxPress: number;
  rule: EncumbranceRule;
}

export interface MovementResult {
  rate: number;
  category: EncumbranceCategory;
}

const CATEGORY_RATE: Record<EncumbranceCategory, (base: number) => number> = {
  unencumbered: (base) => base,
  light: (base) => Math.floor((base * 2) / 3),
  moderate: (base) => Math.floor(base / 2),
  heavy: (base) => Math.floor(base / 3),
  severe: () => 1,
  immobile: () => 0,
};

function table48Rate(input: MovementInput): number {
  // STR <= 3: carried in (last ceiling, maxPress] is "staggering" (severe) -> rate 1; > maxPress -> immobile (0).
  if (input.strengthScore <= STR3_MAX) {
    if (input.carried > input.maxPress) return 0;
    for (const entry of STR3_ROW) {
      if (input.carried <= entry.maxCarried) return Math.min(entry.rate, input.baseMove);
    }
    return 1;
  }
  if (input.carried > input.maxPress) return 0;
  // PC precondition: base moves are 6 or 12 (Table 64); a faster actor is capped to the 12-column headers.
  const tier: MovementTier = input.baseMove >= 12 ? 12 : 6;
  const thresholds = encumbranceThresholds(input);
  for (let i = 0; i < thresholds.length; i++) {
    if (input.carried <= thresholds[i]) return HEADERS[tier][i]; // inclusive ceiling
  }
  return 1; // staggering: past the last threshold but within max press
}

export function modifiedMovementRate(input: MovementInput): MovementResult {
  const category = encumbranceCategory({
    carried: input.carried,
    strengthScore: input.strengthScore,
    weightAllowance: input.weightAllowance,
    maxPress: input.maxPress,
  });
  const rate =
    input.rule === "category" ? CATEGORY_RATE[category](input.baseMove) : table48Rate(input);
  return { rate, category };
}

/**
 * The attack-roll and AC penalties from encumbrance, based on the *resulting*
 * movement rate (PHB p.79). `armorClass` is additive (positive = worse AC).
 */
export function encumbrancePenalty(input: {
  baseMove: number;
  currentMove: number;
}): { attackRoll: number; armorClass: number } {
  if (input.currentMove <= 1 && input.currentMove < input.baseMove) {
    return { attackRoll: -4, armorClass: 3 };
  }
  const ratio = input.currentMove / input.baseMove;
  if (ratio <= 1 / 3) return { attackRoll: -2, armorClass: 1 };
  if (ratio <= 1 / 2) return { attackRoll: -1, armorClass: 0 };
  return { attackRoll: 0, armorClass: 0 };
}
