// The wrestling grip ladder (C&T "Holds", "Previously Established Holds and Locks", "Breaking Free"). Pure.
import type { GripRung } from "./types";

export type GripAction = "hold" | "improve" | "holdOn" | "breakFree";
export type Side = "holder" | "held";

export interface GripInput {
  action: GripAction;
  /** the rung BEFORE the contest ("free" only for the first hold check) */
  rung: GripRung;
  /** who won the opposed roll, mapped from initiator/responder by the caller */
  winner: Side | "none";
  /** the winner's natural 20 */
  critical: boolean;
}

export interface GripOutcome {
  /** the rung after the contest; "free" ends the grapple */
  rung: GripRung;
  /** the roles trade places (the former held character is now the holder) */
  swap: boolean;
  /** the holder (after any swap) has won a lock and must choose its effect */
  lockPending: boolean;
  /** who suffers 1d2 (+ the dealer's Strength damage adjustment); null = nobody */
  damageTo: Side | null;
  /** hold-on at locked: the previous lock effect repeats */
  repeatLock: boolean;
}

const down = (rung: GripRung): GripRung => (rung === "locked" ? "held" : "free");
const outcome = (o: Partial<GripOutcome> & { rung: GripRung }): GripOutcome => ({
  swap: false, lockPending: false, damageTo: null, repeatLock: false, ...o,
});

export function gripOutcome(input: GripInput): GripOutcome {
  const { action, rung, winner, critical } = input;
  switch (action) {
    case "hold":
      return winner === "holder" ? outcome({ rung: "held", damageTo: "held" }) : outcome({ rung: "free" });
    case "improve":
      if (winner === "holder") return outcome({ rung: "locked", lockPending: true, damageTo: "held" });
      if (winner === "held") {
        return critical
          ? outcome({ rung: "locked", swap: true, lockPending: true, damageTo: "holder" })
          : outcome({ rung: down(rung), damageTo: "holder" });
      }
      return outcome({ rung });
    case "holdOn":
      if (winner === "held") return outcome({ rung: down(rung) });
      if (winner === "holder") return rung === "locked" ? outcome({ rung, repeatLock: true }) : outcome({ rung, damageTo: "held" });
      return outcome({ rung });
    case "breakFree":
      if (winner === "held") {
        return critical
          ? outcome({ rung: "locked", swap: true, lockPending: true, damageTo: "holder" })
          : outcome({ rung: down(rung), damageTo: "holder" });
      }
      if (winner === "holder" && critical) return outcome({ rung: "locked", lockPending: true });
      return outcome({ rung });
  }
}
