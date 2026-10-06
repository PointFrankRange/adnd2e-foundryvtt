import { getChassis } from "../../core/classes/chassis";
import { NO_LEVEL_RULES, xpToNextWithRules, type LevelRules } from "../../core/classes/level-limits";
import { scaleChassisXp } from "../../core/kits";
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
  /** SP13: the class is at a hard racial level limit */
  atLimit: boolean;
}

/** Level + progress-to-next for an embedded class item's own xp total. */
export function xpToNext(chassisId: ClassId, xp: number, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES): XpProgress {
  return xpToNextWithRules(scaleChassisXp(getChassis(chassisId), xpModifierPercent), xp, rules);
}

/** 2E: an xp award to a multiclass character is split evenly among its classes (remainder dropped). */
export function awardXpSplit(total: number, classCount: number): number {
  if (classCount <= 0) return 0;
  return Math.floor(total / classCount);
}
