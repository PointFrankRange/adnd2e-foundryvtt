// PHB Table 4: INTELLIGENCE (p.16; Appendix 8 p.245).
import { assertAbilityScore } from "../errors";
import type { IntelligenceModifiers } from "../types";

type Row = [number, number | null, number | null, number | null, number | null];

const BY_SCORE: Record<number, Row> = {
  1: [0, null, null, null, null],
  2: [1, null, null, null, null],
  3: [1, null, null, null, null],
  4: [1, null, null, null, null],
  5: [1, null, null, null, null],
  6: [1, null, null, null, null],
  7: [1, null, null, null, null],
  8: [1, null, null, null, null],
  9: [2, 4, 35, 6, null],
  10: [2, 5, 40, 7, null],
  11: [2, 5, 45, 7, null],
  12: [3, 6, 50, 7, null],
  13: [3, 6, 55, 9, null],
  14: [4, 7, 60, 9, null],
  15: [4, 7, 65, 11, null],
  16: [5, 8, 70, 11, null],
  17: [6, 8, 75, 14, null],
  18: [7, 9, 85, 18, null],
  19: [8, 9, 95, null, 1],
  20: [9, 9, 96, null, 2],
  21: [10, 9, 97, null, 3],
  22: [11, 9, 98, null, 4],
  23: [12, 9, 99, null, 5],
  24: [15, 9, 100, null, 6],
  25: [20, 9, 100, null, 7],
};

export function intelligence(score: number): IntelligenceModifiers {
  assertAbilityScore(score, "int");
  const [bonusLanguages, maxSpellLevel, learnSpellChance, maxSpellsPerLevel, illusionImmunityLevel] =
    BY_SCORE[score];
  return { bonusLanguages, maxSpellLevel, learnSpellChance, maxSpellsPerLevel, illusionImmunityLevel };
}
