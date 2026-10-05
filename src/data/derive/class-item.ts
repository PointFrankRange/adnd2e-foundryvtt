import { getChassis } from "../../core/classes/chassis";
import { levelForXp } from "../../core/classes/progression";
import { scaleChassisXp } from "../../core/kits";
import type { ClassId } from "../../core/types";

/** The class level this embedded `class` item has reached on its own XP total (a kit's XP modifier percent, default 0, scales the thresholds). */
export function classItemLevel(chassisId: ClassId, xp: number, xpModifierPercent = 0): number {
  return levelForXp(scaleChassisXp(getChassis(chassisId), xpModifierPercent), xp);
}

/** True when the class has advanced past the last recorded Hit-Die roll and owes one. */
export function classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number, xpModifierPercent = 0): boolean {
  return classItemLevel(chassisId, xp, xpModifierPercent) > hpRollsLength;
}
