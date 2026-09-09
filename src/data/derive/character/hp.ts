import { getChassis } from "../../../core/classes/chassis";
import type { ClassId } from "../../../core/types";

/**
 * §5.6 step 4 — single-class HP maximum (PHB p.19, 47). Un-rolled levels add 0
 * (Ruling HP1). The CON hp adjustment applies once per rolled level up to
 * `conBonusCutoffLevel`; each rolled level PAST the cutoff instead adds the
 * class's flat `hpAfterNameLevel` (a positive per-level value on the chassis).
 */
export function characterHpMax(
  chassisId: ClassId,
  level: number,
  hpRolls: readonly number[],
  conHpAdjustment: number,
): number {
  const chassis = getChassis(chassisId);
  const rolledLevels = Math.min(hpRolls.length, level);
  const rolledSum = hpRolls.slice(0, rolledLevels).reduce((sum, roll) => sum + roll, 0);
  const conLevels = Math.min(rolledLevels, chassis.conBonusCutoffLevel);
  const flatLevels = Math.max(0, rolledLevels - chassis.conBonusCutoffLevel);
  return rolledSum + conLevels * conHpAdjustment + flatLevels * chassis.hpAfterNameLevel;
}
