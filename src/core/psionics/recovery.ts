/** Table 6 (p.14): PSPs recovered per hour by the most strenuous activity in the hour. */
export type RecoveryActivity = "hard" | "light" | "rest" | "sleep";

const PER_HOUR: Record<RecoveryActivity, number> = { hard: 0, light: 3, rest: 6, sleep: 12 };

export function recoveryPerHour(activity: RecoveryActivity): number {
  return PER_HOUR[activity];
}

/** Recovers PSPs for `hours` hours; never above the maximum, never lowers the current total. */
export function applyRecovery(current: number, max: number, activity: RecoveryActivity, hours: number): number {
  return Math.max(current, Math.min(max, current + PER_HOUR[activity] * hours));
}
