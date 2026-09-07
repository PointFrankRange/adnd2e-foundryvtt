// PHB Table 6: CHARISMA (p.18; Appendix 8 p.246).
import { assertAbilityScore } from "../errors";
import type { CharismaModifiers } from "../types";

type Row = [number, number, number]; // maxHenchmen, loyaltyBase, reactionAdj

const BY_SCORE: Record<number, Row> = {
  1: [0, -8, -7], 2: [1, -7, -6], 3: [1, -6, -5], 4: [1, -5, -4], 5: [2, -4, -3],
  6: [2, -3, -2], 7: [3, -2, -1], 8: [3, -1, 0], 9: [4, 0, 0], 10: [4, 0, 0],
  11: [4, 0, 0], 12: [5, 0, 0], 13: [5, 0, 1], 14: [6, 1, 2], 15: [7, 3, 3],
  16: [8, 4, 5], 17: [10, 6, 6], 18: [15, 8, 7], 19: [20, 10, 8], 20: [25, 12, 9],
  21: [30, 14, 10], 22: [35, 16, 11], 23: [40, 18, 12], 24: [45, 20, 13], 25: [50, 20, 14],
};

export function charisma(score: number): CharismaModifiers {
  assertAbilityScore(score, "cha");
  const [maxHenchmen, loyaltyBase, reactionAdj] = BY_SCORE[score];
  return { maxHenchmen, loyaltyBase, reactionAdj };
}
