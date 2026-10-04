import { TURN_TABLE, levelColumn, type TurnRowId } from "./table";

export type TurnOutcome = "cannot" | "fail" | "turned" | "destroyed" | "destroyed-bonus";

/** A cleric turns at class level, a paladin two levels lower (PHB p. 103); no other class turns. */
export function turnerLevel(chassisId: string, level: number): number | null {
  const effective = chassisId === "cleric" ? level : chassisId === "paladin" ? level - 2 : null;
  return effective !== null && effective >= 1 ? effective : null;
}

/** The best turning level across an actor's classes, or null when none can turn. */
export function turnerLevelFor(classes: readonly { chassisId: string; level: number }[]): number | null {
  let best: number | null = null;
  for (const c of classes) {
    const level = turnerLevel(c.chassisId, c.level);
    if (level !== null && (best === null || level > best)) best = level;
  }
  return best;
}

export function resolveTurn(d20: number, level: number, row: TurnRowId): TurnOutcome {
  const column = levelColumn(level);
  if (column < 0) return "cannot";
  const cell = TURN_TABLE[row][column];
  if (cell === null || cell === undefined) return "cannot";
  if (cell === "T") return "turned";
  if (cell === "D") return "destroyed";
  if (cell === "D*") return "destroyed-bonus";
  return d20 >= cell ? "turned" : "fail";
}

export interface TurnCandidate {
  id: string;
  row: TurnRowId;
  hd: number;
  outcome: TurnOutcome;
}

/** Of the targets whose roll succeeded, who is actually affected: the lowest Hit Dice first, up to `cap`
 *  (the 2d6 roll). A "destroyed-bonus" target past the cap is still affected while fewer than `bonusCap`
 *  extra creatures of its row (the 2d4 roll) have been added. */
export function allocateAffected(
  candidates: readonly TurnCandidate[],
  cap: number,
  bonusCap: number,
): { affected: string[] } {
  const sorted = [...candidates].sort((a, b) => a.hd - b.hd);
  const affected: string[] = [];
  const bonusUsed = new Map<TurnRowId, number>();
  for (const c of sorted) {
    if (affected.length < cap) {
      affected.push(c.id);
      continue;
    }
    if (c.outcome === "destroyed-bonus") {
      const used = bonusUsed.get(c.row) ?? 0;
      if (used < bonusCap) {
        bonusUsed.set(c.row, used + 1);
        affected.push(c.id);
      }
    }
  }
  return { affected };
}

export interface TurnTarget {
  id: string;
  isUndead: boolean;
  row: TurnRowId | null;
  hd: number;
}

export type TurnStatus = "notUndead" | "untagged" | "cannot" | "fail" | "turned" | "destroyed" | "unaffected";

/** One d20 read separately for every target, then allocated against the 2d6 / 2d4 caps. */
export function resolveAttempt(args: {
  d20: number;
  level: number;
  targets: readonly TurnTarget[];
  cap: number;
  bonusCap: number;
}): { id: string; status: TurnStatus }[] {
  const statuses = new Map<string, TurnStatus>();
  const candidates: TurnCandidate[] = [];
  for (const t of args.targets) {
    if (!t.isUndead) {
      statuses.set(t.id, "notUndead");
      continue;
    }
    if (!t.row) {
      statuses.set(t.id, "untagged");
      continue;
    }
    const outcome = resolveTurn(args.d20, args.level, t.row);
    if (outcome === "cannot" || outcome === "fail") statuses.set(t.id, outcome);
    else candidates.push({ id: t.id, row: t.row, hd: t.hd, outcome });
  }
  const hit = new Set(allocateAffected(candidates, args.cap, args.bonusCap).affected);
  for (const c of candidates) {
    statuses.set(c.id, !hit.has(c.id) ? "unaffected" : c.outcome === "turned" ? "turned" : "destroyed");
  }
  return args.targets.map((t) => ({ id: t.id, status: statuses.get(t.id) as TurnStatus }));
}
