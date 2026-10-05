import type { ClassChassis } from "../types";

/* Kit XP-per-level modifier (SP11 Plan A). Pure. */

/** The XP modifier percent of the kit modifying this chassis, or 0. */
export function kitXpPercentFor(
  kits: readonly { chassisId: string; xpModifierPercent: number }[],
  chassisId: string,
): number {
  return kits.find((k) => k.chassisId === chassisId)?.xpModifierPercent ?? 0;
}

/** `base` scaled by `percent` (+25 = 25% more), floored. */
export function scaleThreshold(base: number, percent: number): number {
  return Math.floor((base * (100 + percent)) / 100);
}

/** The chassis with its XP thresholds (and per-level step beyond 20) scaled. 0% returns the same object. */
export function scaleChassisXp(chassis: ClassChassis, percent: number): ClassChassis {
  if (percent === 0) return chassis;
  return {
    ...chassis,
    xpThresholds: chassis.xpThresholds.map((t) => scaleThreshold(t, percent)),
    xpPerLevelBeyond20: scaleThreshold(chassis.xpPerLevelBeyond20, percent),
  };
}
