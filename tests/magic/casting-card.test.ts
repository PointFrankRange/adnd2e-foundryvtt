import { describe, expect, it } from "vitest";
import { buildCastingNoticeContext } from "../../src/magic/casting-card";

const base = { actorName: "Mira", actorImg: "m.png", spellName: "Fireball", spellLevel: 3 };

describe("buildCastingNoticeContext", () => {
  it("begin, segment spell: headline plus initiative detail", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "begin", completeRound: null, initiativeAdd: 3 })).toEqual({
      ...base,
      headlineKey: "ADND2E.chat.casting.begin",
      detailKey: "ADND2E.chat.casting.initiativeAdded",
      detailValue: 3,
      lost: false,
    });
  });
  it("begin, round spell: completes-at detail", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "begin", completeRound: 5, initiativeAdd: null })).toMatchObject({
      detailKey: "ADND2E.chat.casting.completesRound",
      detailValue: 5,
    });
  });
  it("begin with a zero-segment spell has no detail line", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "begin", completeRound: null, initiativeAdd: 0 })).toMatchObject({
      detailKey: null,
      detailValue: null,
    });
  });
  it("lost: headline only, flagged lost", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "lost", completeRound: 5, initiativeAdd: null })).toEqual({
      ...base,
      headlineKey: "ADND2E.chat.casting.lost",
      detailKey: null,
      detailValue: null,
      lost: true,
    });
  });
});
