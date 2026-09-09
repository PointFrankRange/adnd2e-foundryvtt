import { classItemCanLevelUp, classItemLevel } from "../class-item";
import type { ClassEntry } from "./snapshot";
import type { ClassId } from "../../../core/types";

/** §5.6 step 3 — per-class level + "owes a Hit-Die roll" flag, from the class item's own XP. */
export function deriveClassLevels(
  classes: readonly ClassEntry[],
): { chassisId: ClassId; level: number; canLevelUp: boolean }[] {
  return classes.map((c) => {
    const level = classItemLevel(c.chassisId, c.xp);
    return { chassisId: c.chassisId, level, canLevelUp: classItemCanLevelUp(c.chassisId, c.xp, c.hpRolls.length) };
  });
}
