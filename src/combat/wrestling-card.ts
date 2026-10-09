// The wrestling contest chat card (SP7e): its flag shape and the pure template context. Foundry-free.
import type { GripRung } from "../core/wrestling";

export type ContestKind = "attack" | "hold" | "improve" | "holdOn" | "breakFree";

/** Everything a roll needs from one wrestler, captured when the contest starts so answering needs only a d20. */
export interface WrestleSide {
  uuid: string;
  name: string;
  img: string;
  size: string;
  thac0: number;
  strHit: number;
  strDmg: number;
  /** this wrestler's wrestling AC (what the OTHER side rolls against) */
  ac: number;
}

export interface ContestResult {
  winner: "initiator" | "responder" | "none";
  critical: boolean;
  initiatorTotal: number;
  responderTotal: number;
  rungAfter: GripRung;
  swap: boolean;
  lockPending: boolean;
  damage: { to: string; amount: number } | null;
  unconscious: boolean;
}

/** The data carried in `flags.adnd2e.wrestleContest` on a contest chat card. */
export interface WrestleContestFlag {
  id: string;
  kind: ContestKind;
  initiator: WrestleSide;
  responder: WrestleSide;
  initiatorRoll: number;
  rungBefore: GripRung;
  /** is the initiator the holder? (hold/improve/holdOn: yes; breakFree: no) */
  holderIsInitiator: boolean;
  state: "pending" | "resolved";
  responderRoll?: number;
  result?: ContestResult;
}

export function buildContestView(c: WrestleContestFlag): Record<string, unknown> {
  const pending = c.state === "pending";
  const r = c.result;
  return {
    titleKey: `ADND2E.chat.wrestling.kind.${c.kind}`,
    initiatorName: c.initiator.name,
    initiatorImg: c.initiator.img,
    responderName: c.responder.name,
    pending,
    showRoll: pending && c.kind !== "attack",
    initiatorRoll: c.initiatorRoll,
    responderRoll: c.responderRoll ?? null,
    hasResponderRoll: c.responderRoll !== undefined,
    winnerKey: r ? `ADND2E.chat.wrestling.winner.${r.winner}` : "",
    critical: r?.critical ?? false,
    rungKey: r ? `ADND2E.chat.wrestling.rung.${r.rungAfter}` : "",
    swap: r?.swap ?? false,
    lockPending: r?.lockPending ?? false,
    unconscious: r?.unconscious ?? false,
    damageText: r?.damage ? `${r.damage.to}: ${r.damage.amount}` : "",
  };
}
