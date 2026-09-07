// PHB Table 1: STRENGTH (p.14; Appendix 8 p.245). Verified from references/research-notes.md.
import { assertAbilityScore } from "../errors";
import type { StrengthModifiers } from "../types";

type Row = [number, number, number, number, number, number | null, number];

// Non-18 scores, keyed by exact score.
const BY_SCORE: Record<number, Row> = {
  1: [-5, -4, 1, 3, 1, null, 0],
  2: [-3, -2, 1, 5, 1, null, 0],
  3: [-3, -1, 5, 10, 2, null, 0],
  4: [-2, -1, 10, 25, 3, null, 0],
  5: [-2, -1, 10, 25, 3, null, 0],
  6: [-1, 0, 20, 55, 4, null, 0],
  7: [-1, 0, 20, 55, 4, null, 0],
  8: [0, 0, 35, 90, 5, null, 1],
  9: [0, 0, 35, 90, 5, null, 1],
  10: [0, 0, 40, 115, 6, null, 2],
  11: [0, 0, 40, 115, 6, null, 2],
  12: [0, 0, 45, 140, 7, null, 4],
  13: [0, 0, 45, 140, 7, null, 4],
  14: [0, 0, 55, 170, 8, null, 7],
  15: [0, 0, 55, 170, 8, null, 7],
  16: [0, 1, 70, 195, 9, null, 10],
  17: [1, 1, 85, 220, 10, null, 13],
  18: [1, 2, 110, 255, 11, null, 16],
  19: [3, 7, 485, 640, 16, 8, 50],
  20: [3, 8, 535, 700, 17, 10, 60],
  21: [4, 9, 635, 810, 17, 12, 70],
  22: [4, 10, 785, 970, 18, 14, 80],
  23: [5, 11, 935, 1130, 18, 16, 90],
  24: [6, 12, 1235, 1440, 19, 17, 95],
  25: [7, 14, 1535, 1750, 19, 18, 99],
};

// Exceptional Strength bands for score 18, by upper bound of the percentile band.
const EXCEPTIONAL: ReadonlyArray<{ max: number; row: Row }> = [
  { max: 50, row: [1, 3, 135, 280, 12, null, 20] },
  { max: 75, row: [2, 3, 160, 305, 13, null, 25] },
  { max: 90, row: [2, 4, 185, 330, 14, null, 30] },
  { max: 99, row: [2, 5, 235, 380, 15, 3, 35] },
  { max: 100, row: [3, 6, 335, 480, 16, 6, 40] },
];

function toModifiers(r: Row): StrengthModifiers {
  return {
    hitProb: r[0], damageAdj: r[1], weightAllowance: r[2], maxPress: r[3],
    openDoors: r[4], openDoorsMagical: r[5], bendBarsLiftGates: r[6],
  };
}

export function strength(score: number, exceptionalPercentile?: number | null): StrengthModifiers {
  assertAbilityScore(score, "str");
  if (score === 18 && exceptionalPercentile != null) {
    if (!Number.isInteger(exceptionalPercentile) || exceptionalPercentile < 1 || exceptionalPercentile > 100) {
      throw new RangeError(`exceptional Strength percentile must be an integer in [1, 100], got ${exceptionalPercentile}`);
    }
    const band = EXCEPTIONAL.find((b) => exceptionalPercentile <= b.max)!;
    return toModifiers(band.row);
  }
  return toModifiers(BY_SCORE[score]);
}
