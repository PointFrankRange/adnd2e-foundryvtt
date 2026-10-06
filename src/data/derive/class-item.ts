import { getChassis } from "../../core/classes/chassis";
import { NO_LEVEL_RULES, levelForXpWithRules, type LevelRules } from "../../core/classes/level-limits";
import { scaleChassisXp } from "../../core/kits";
import type { ClassId } from "../../core/types";

/** The class level this embedded `class` item has reached on its own XP total (a kit's/race's XP modifier percent scales the thresholds; SP13 level rules cap or re-price levels past a racial limit). */
export function classItemLevel(chassisId: ClassId, xp: number, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES): number {
  return levelForXpWithRules(scaleChassisXp(getChassis(chassisId), xpModifierPercent), xp, rules);
}

/** True when the class has advanced past the last recorded Hit-Die roll and owes one. */
export function classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES): boolean {
  return classItemLevel(chassisId, xp, xpModifierPercent, rules) > hpRollsLength;
}
