// One opposed wrestling roll (C&T "Holds"). Pure.
import { hitResult } from "../combat/attack";

export interface RollSide {
  thac0: number;
  /** every modifier on this side's roll: Strength, size (initiator only), body, situational */
  bonus: number;
  /** the AC this side attacks (the other side's wrestling AC) */
  targetAc: number;
  /** natural d20 */
  natural: number;
}

export interface SideResult {
  natural: number;
  total: number;
  hit: boolean;
  /** a natural 20 that hit (the system's critical convention) */
  crit: boolean;
}

export type Winner = "initiator" | "responder" | "none";

export interface OpposedResult {
  winner: Winner;
  initiator: SideResult;
  responder: SideResult;
  /** the WINNER's natural 20 — a losing critical is disregarded */
  critical: boolean;
}

export function sideResult(side: RollSide): SideResult {
  const h = hitResult({ naturalD20: side.natural, attackBonus: side.bonus, thac0: side.thac0, targetAc: side.targetAc });
  return { natural: side.natural, total: h.total, hit: h.hit, crit: h.autoHit };
}

/** Both hit: the lower total wins. Exactly one hits: that side wins. A tie or a double miss: no change. */
export function resolveOpposed(initiator: RollSide, responder: RollSide): OpposedResult {
  const i = sideResult(initiator);
  const r = sideResult(responder);
  let winner: Winner = "none";
  if (i.hit && r.hit) winner = i.total < r.total ? "initiator" : r.total < i.total ? "responder" : "none";
  else if (i.hit) winner = "initiator";
  else if (r.hit) winner = "responder";
  const critical = (winner === "initiator" && i.crit) || (winner === "responder" && r.crit);
  return { winner, initiator: i, responder: r, critical };
}
