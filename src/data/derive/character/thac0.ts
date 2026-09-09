import { thac0 } from "../../../core/classes/thac0";
import type { ClassGroup } from "../../../core/types";

/**
 * §5.6 step 5 — THAC0. A positive to-hit modifier LOWERS THAC0 (descending scale).
 *
 * The returned THAC0 does NOT include the step-10 encumbrance attack penalty
 * (`deriveEncumbrance(...).penalty.attackRoll`); the sheet applies it on top.
 */
export function deriveThac0(
  group: ClassGroup,
  level: number,
  strHitProb: number,
  dexMissileAdj: number,
): { base: number; melee: number; ranged: number } {
  const base = thac0(group, level);
  return { base, melee: base - strHitProb, ranged: base - dexMissileAdj };
}
