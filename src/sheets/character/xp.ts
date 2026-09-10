import { getChassis } from "../../core/classes/chassis";
import { levelForXp, xpForLevel } from "../../core/classes/progression";
import type { ClassId } from "../../core/types";

export interface XpProgress {
  /** current level for this xp total */
  level: number;
  /** xp threshold for the next level, or null at max level */
  next: number | null;
  /** xp still needed to reach the next level, or null at max level */
  toNextLevel: number | null;
  /** 0..1 progress through the current level band (1 at max level) */
  pct: number;
}

/** Level + progress-to-next for an embedded class item's own xp total. */
export function xpToNext(chassisId: ClassId, xp: number): XpProgress {
  const chassis = getChassis(chassisId);
  const level = levelForXp(chassis, xp);
  const bandStart = xpForLevel(chassis, level);
  // `next` is null once we are past the class's defined xp table (its top
  // published level). `xpForLevel` extrapolates linearly beyond the table for
  // classes with no hard cap, so we gate on the table length rather than
  // relying on it to throw.
  const next: number | null =
    level < chassis.xpThresholds.length ? xpForLevel(chassis, level + 1) : null;
  if (next === null) {
    return { level, next: null, toNextLevel: null, pct: 1 };
  }
  const pct = Math.min(1, Math.max(0, (xp - bandStart) / (next - bandStart)));
  return { level, next, toNextLevel: Math.max(0, next - xp), pct };
}

/** 2E: an xp award to a multiclass character is split evenly among its classes (remainder dropped). */
export function awardXpSplit(total: number, classCount: number): number {
  if (classCount <= 0) return 0;
  return Math.floor(total / classCount);
}
