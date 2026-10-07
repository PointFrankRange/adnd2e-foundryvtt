/* SP13: racial level limits and the optional rules for exceeding them. Pure; Foundry-free.
 * `chassis` arguments are already XP-scaled by the race/kit percentage (scaleChassisXp). */
import { levelForXp, xpForLevel } from "./progression";
import type { ClassChassis } from "../types";

/** Complete Book of Dwarves p.35, Bonus Levels Table: single-class bonus levels from the prime requisite. */
export function bonusLevels(primeRequisiteScore: number): number {
  if (primeRequisiteScore >= 19) return 4;
  if (primeRequisiteScore >= 18) return 3;
  if (primeRequisiteScore >= 16) return 2;
  if (primeRequisiteScore >= 14) return 1;
  return 0;
}

export interface LevelRules {
  /** the effective level cap for this class (null = unlimited) */
  limit: number | null;
  /** 0 = the cap is hard; k >= 2 = each XP gap beyond the cap costs k times as much */
  beyondMultiplier: number;
}

export const NO_LEVEL_RULES: LevelRules = Object.freeze({ limit: null, beyondMultiplier: 0 }) as LevelRules;

/** A class view's optional rule fields as LevelRules. */
export function levelRulesOf(view: { levelLimit?: number | null; beyondMultiplier?: number }): LevelRules {
  return { limit: view.levelLimit ?? null, beyondMultiplier: view.beyondMultiplier ?? 0 };
}

/** The limit clamped to the class's own maxLevel (xpForLevel throws beyond it). */
function effectiveLimit(chassis: ClassChassis, limit: number | null): number | null {
  if (limit === null) return null;
  return chassis.maxLevel != null ? Math.min(limit, chassis.maxLevel) : limit;
}

export function levelForXpWithRules(chassis: ClassChassis, xp: number, rules: LevelRules): number {
  const limit = effectiveLimit(chassis, rules.limit);
  if (limit === null) return levelForXp(chassis, xp);
  const k = rules.beyondMultiplier;
  if (k <= 0) return Math.min(levelForXp(chassis, xp), limit);
  const top = xpForLevel(chassis, limit);
  if (xp <= top) return levelForXp(chassis, xp);
  // each XP gap beyond the limit costs k times as much: map the surplus back onto the normal table
  return levelForXp(chassis, top + Math.floor((xp - top) / k));
}

export interface LimitedXpProgress {
  level: number;
  next: number | null;
  toNextLevel: number | null;
  pct: number;
  atLimit: boolean;
}

export function xpToNextWithRules(chassis: ClassChassis, xp: number, rules: LevelRules): LimitedXpProgress {
  const level = levelForXpWithRules(chassis, xp, rules);
  const limit = effectiveLimit(chassis, rules.limit);
  if (limit !== null && rules.beyondMultiplier <= 0 && level >= limit) {
    return { level, next: null, toNextLevel: null, pct: 1, atLimit: true };
  }
  // past the end of the XP table there is no next threshold (the long-standing gate) — unless exceeding the
  // level limit is on and the class extrapolates (xpPerLevelBeyond20) and has not reached its own maxLevel
  const exceeding = limit !== null && rules.beyondMultiplier > 0;
  const hasNext =
    level < chassis.xpThresholds.length ||
    (exceeding && chassis.xpPerLevelBeyond20 > 0 && (chassis.maxLevel == null || level < chassis.maxLevel));
  if (!hasNext) return { level, next: null, toNextLevel: null, pct: 1, atLimit: false };
  const k = limit !== null && rules.beyondMultiplier > 0 ? rules.beyondMultiplier : 1;
  const top = limit !== null ? xpForLevel(chassis, limit) : 0;
  const threshold = (l: number): number =>
    limit !== null && l > limit ? top + k * (xpForLevel(chassis, l) - top) : xpForLevel(chassis, l);
  const bandStart = threshold(level);
  const next = threshold(level + 1);
  const pct = Math.min(1, Math.max(0, (xp - bandStart) / (next - bandStart)));
  return { level, next, toNextLevel: Math.max(0, next - xp), pct, atLimit: false };
}
