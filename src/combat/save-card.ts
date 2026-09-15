import type { SaveCardContext, SaveCardInput } from "./card-types";

/** A save succeeds when `naturalD20 + rollModifier >= target` (the same
 *  contract `core/saves/composer.ts`'s saveTargetBest documents). */
export function buildSaveCardContext(input: SaveCardInput): SaveCardContext {
  const total = input.naturalD20 + input.rollModifier;
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    categoryLabel: input.categoryLabel,
    formula: input.formula,
    naturalD20: input.naturalD20,
    total,
    target: input.target,
    success: total >= input.target,
  };
}
