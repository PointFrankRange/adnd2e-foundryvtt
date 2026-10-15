/* Issue #179: round-based psionic bookkeeping (PHBR5 pp.20-27). Pure. */

/** Per-combatant record of the powers initiated in one combat round. */
export interface PowerRound {
  combatId: string;
  round: number;
  count: number;
}

/**
 * Notes that a power was initiated. Only a power that counts against the one-power-per-round limit is
 * tallied (defense modes never do). `second` is true when this is at least the second such power in the same round.
 */
export function noteInitiation(
  prev: PowerRound | null,
  combatId: string,
  round: number,
  countsAgainstLimit: boolean,
): { next: PowerRound | null; second: boolean } {
  if (!countsAgainstLimit) return { next: prev, second: false };
  if (prev && prev.combatId === combatId && prev.round === round) return { next: { ...prev, count: prev.count + 1 }, second: true };
  return { next: { combatId, round, count: 1 }, second: false };
}

export interface UpkeepInput {
  pool: number;
  maintained: readonly { powerId: string; name: string; cost: number; unit: string }[];
  /** true while any partial tangent is held (1 PSP per round, p.27) */
  partialTangents: boolean;
}

export interface UpkeepResult {
  pool: number;
  paid: number;
  /** powers dropped because their upkeep could not be paid */
  ended: { powerId: string; name: string }[];
  /** true when the tangents were broken for lack of a PSP */
  tangentsBroken: boolean;
}

/** One combat round of upkeep: every per-round maintained power in list order, then the tangent PSP. Per-turn and per-hour powers are left to the player. */
export function roundUpkeep(i: UpkeepInput): UpkeepResult {
  let pool = i.pool;
  let paid = 0;
  const ended: { powerId: string; name: string }[] = [];
  for (const m of i.maintained) {
    if (m.unit !== "round") continue;
    if (pool >= m.cost) {
      pool -= m.cost;
      paid += m.cost;
    } else ended.push({ powerId: m.powerId, name: m.name });
  }
  let tangentsBroken = false;
  if (i.partialTangents) {
    if (pool >= 1) {
      pool -= 1;
      paid += 1;
    } else tangentsBroken = true;
  }
  return { pool, paid, ended, tangentsBroken };
}
