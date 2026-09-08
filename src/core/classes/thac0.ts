// PHB Table 53: CALCULATED THAC0S (p.91) + Table 54: THAC0 ADVANCEMENT (p.91).
// THAC0 improves by [points] per [perLevels] levels; the closed form reproduces
// every cell of Table 53 (levels 1-20) and extends past it at the Table 54 rate.
// The literal Table 53 lives in thac0.test.ts as an independent cross-check.
import { assertLevel } from "../errors";
import type { ClassGroup } from "../types";

// PHB Table 54: [pointsImproved, perLevelsAdvanced].
const RATE: Record<ClassGroup, readonly [number, number]> = {
  warrior: [1, 1],
  priest: [2, 3],
  rogue: [1, 2],
  wizard: [1, 3],
};

export function thac0(group: ClassGroup, level: number): number {
  assertLevel(level, "class level");
  const [points, perLevels] = RATE[group];
  return 20 - points * Math.floor((level - 1) / perLevels);
}
