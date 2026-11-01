/* Issue #179: power preparation times in combat (PHBR5 p.20, "a power disrupted during a preparatory round loses the
 * time invested and spends no PSPs"). Pure. */

/**
 * The preparation time of a power in combat rounds, or null when it has none or cannot be tracked in rounds
 * (0, hours, per-point/per-increase variable times). Bare numbers are rounds; a turn is 10 rounds.
 */
export function preparationRounds(text: string): number | null {
  const t = text.trim().toLowerCase();
  const plain = /^(\d+)$/.exec(t);
  if (plain) return Number(plain[1]) >= 1 ? Number(plain[1]) : null;
  const rounds = /^(\d+)\s*(?:rnds?|rounds?)\.?$/.exec(t);
  if (rounds) return Number(rounds[1]) >= 1 ? Number(rounds[1]) : null;
  const turns = /^(\d+)\s*turns?\.?$/.exec(t);
  if (turns) return Number(turns[1]) >= 1 ? Number(turns[1]) * 10 : null;
  return null;
}

/** A preparation begun in `currentRound` takes effect at the END of its last round; the start round counts as the first. */
export function prepCompleteRound(rounds: number, currentRound: number): number {
  return currentRound + rounds - 1;
}

/** The preparation may be completed once the combat has reached its last round. */
export function canCompletePrep(completeRound: number | null, combatRound: number): boolean {
  return completeRound !== null && combatRound >= completeRound;
}
