export type CheckResult = "success" | "minimum-success" | "failure" | "automatic-failure";

export interface PowerCheck {
  result: CheckResult;
  success: boolean;
  /** the optional skill-score rule: the roll equals the power score exactly */
  special: boolean;
}

/** A power's score: the character's ability score plus the power's modifier (p.11). */
export function powerScore(abilityScore: number, modifier: number): number {
  return abilityScore + modifier;
}

/** d20 power check (p.11): at or under the score succeeds; a 20 always fails; a 1 always succeeds. */
export function rollPowerCheck(roll: number, score: number): PowerCheck {
  const special = roll === score;
  if (roll === 20) return { result: "automatic-failure", success: false, special: false };
  if (roll <= score) return { result: "success", success: true, special };
  if (roll === 1) return { result: "minimum-success", success: true, special: false };
  return { result: "failure", success: false, special: false };
}

/** PSPs paid for one use: the full cost on a success, half (rounded up) on a failure. */
export function checkCost(cost: number, success: boolean): number {
  return success ? cost : Math.ceil(cost / 2);
}
