import { encumbranceCategory } from "../../../core/encumbrance/weight-allowance";
import { encumbrancePenalty, modifiedMovementRate } from "../../../core/encumbrance/movement";
import type { EncumbranceCategory } from "../../../core/types";

export interface EncumbranceInput {
  carried: number;
  strengthScore: number;
  /** strength(str).weightAllowance */
  weightAllowance: number;
  /** strength(str).maxPress */
  maxPress: number;
  baseMove: number;
}

/** §5.6 step 10 — carried-weight category, resulting movement rate, and the penalties. */
export function deriveEncumbrance(input: EncumbranceInput): {
  carried: number;
  category: EncumbranceCategory;
  movementRate: number;
  penalty: { attackRoll: number; armorClass: number };
  baseMove: number;
} {
  const category = encumbranceCategory({
    carried: input.carried,
    strengthScore: input.strengthScore,
    weightAllowance: input.weightAllowance,
    maxPress: input.maxPress,
  });
  const { rate } = modifiedMovementRate({
    baseMove: input.baseMove,
    carried: input.carried,
    strengthScore: input.strengthScore,
    weightAllowance: input.weightAllowance,
    maxPress: input.maxPress,
    rule: "category",
  });
  const penalty = encumbrancePenalty({ baseMove: input.baseMove, currentMove: rate });
  return { carried: input.carried, category, movementRate: rate, penalty, baseMove: input.baseMove };
}
