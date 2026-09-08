import { getChassis } from "../../core/classes/chassis";
import { levelForXp } from "../../core/classes/progression";
import type { ClassId } from "../../core/types";

/** The class level this embedded `class` item has reached on its own XP total. */
export function classItemLevel(chassisId: ClassId, xp: number): number {
  return levelForXp(getChassis(chassisId), xp);
}

/** True when the class has advanced past the last recorded Hit-Die roll and owes one. */
export function classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number): boolean {
  return classItemLevel(chassisId, xp) > hpRollsLength;
}
