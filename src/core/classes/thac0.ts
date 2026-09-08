// PHB Table 53: CALCULATED THAC0S (p.91) + Table 54: THAC0 ADVANCEMENT (p.91).
// Levels 1-20 are the literal Table 53 values. Beyond 20, Table 54 gives the
// improvement rate [points] per [levels] advanced past 20th.
import { assertLevel } from "../errors";
import type { ClassGroup } from "../types";

// prettier-ignore
const TABLE_53: Record<ClassGroup, readonly number[]> = {
  priest:  [20, 20, 20, 18, 18, 18, 16, 16, 16, 14, 14, 14, 12, 12, 12, 10, 10, 10, 8, 8],
  rogue:   [20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11],
  warrior: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  wizard:  [20, 20, 20, 19, 19, 19, 18, 18, 18, 17, 17, 17, 16, 16, 16, 15, 15, 15, 14, 14],
};

// PHB Table 54 improvement rate: [pointsImproved, perLevelsAdvanced].
const RATE: Record<ClassGroup, readonly [number, number]> = {
  warrior: [1, 1],
  priest: [2, 3],
  rogue: [1, 2],
  wizard: [1, 3],
};

export function thac0(group: ClassGroup, level: number): number {
  assertLevel(level, "class level");
  if (level <= 20) {
    return TABLE_53[group][level - 1];
  }
  const [points, perLevels] = RATE[group];
  return TABLE_53[group][19] - Math.floor(((level - 20) * points) / perLevels);
}
