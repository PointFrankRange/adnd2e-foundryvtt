import { describe, expect, it } from "vitest";
import { buildContestView, type WrestleContestFlag, type WrestleSide } from "../../src/combat/wrestling-card";

const side = (name: string): WrestleSide => ({ uuid: `Actor.${name}`, name, img: "", size: "medium", thac0: 17, strHit: 0, strDmg: 0, ac: 10 });
const base: WrestleContestFlag = {
  id: "c1", kind: "hold", initiator: side("Anada"), responder: side("Bugbear"),
  initiatorRoll: 10, rungBefore: "free", holderIsInitiator: true, state: "pending",
};

describe("buildContestView", () => {
  it("a pending contest asks the responder to roll", () => {
    const v = buildContestView(base);
    expect(v).toMatchObject({ pending: true, showRoll: true, titleKey: "ADND2E.chat.wrestling.kind.hold", initiatorName: "Anada", responderName: "Bugbear", initiatorRoll: 10 });
  });
  it("a resolved contest shows both rolls, the winner and the outcome line", () => {
    const v = buildContestView({
      ...base, state: "resolved", responderRoll: 18,
      result: { winner: "initiator", critical: false, initiatorTotal: 7, responderTotal: 18, rungAfter: "held", swap: false, lockPending: false, damage: { to: "Bugbear", amount: 2 }, unconscious: false },
    });
    expect(v).toMatchObject({ pending: false, showRoll: false, responderRoll: 18, winnerKey: "ADND2E.chat.wrestling.winner.initiator", rungKey: "ADND2E.chat.wrestling.rung.held", damageText: "Bugbear: 2" });
  });
  it("flags a pending lock, a swap and unconsciousness", () => {
    const v = buildContestView({
      ...base, kind: "improve", state: "resolved", responderRoll: 4,
      result: { winner: "responder", critical: true, initiatorTotal: 12, responderTotal: 5, rungAfter: "locked", swap: true, lockPending: true, damage: null, unconscious: true },
    });
    expect(v).toMatchObject({ swap: true, lockPending: true, unconscious: true, critical: true, damageText: "" });
  });
  it("a no-contest result (a missed attack) has no responder", () => {
    const v = buildContestView({ ...base, kind: "attack", state: "resolved", result: { winner: "none", critical: false, initiatorTotal: 5, responderTotal: 0, rungAfter: "free", swap: false, lockPending: false, damage: null, unconscious: false } });
    expect(v).toMatchObject({ winnerKey: "ADND2E.chat.wrestling.winner.none", showRoll: false });
  });
  it("a pending attack card shows no roll button and no result", () => {
    const v = buildContestView({ ...base, kind: "attack" });
    expect(v).toMatchObject({ pending: true, showRoll: false, winnerKey: "", rungKey: "", hasResponderRoll: false, responderRoll: null });
  });
});
