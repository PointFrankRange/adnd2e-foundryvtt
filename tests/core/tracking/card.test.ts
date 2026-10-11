import { describe, expect, it } from "vitest";
import { buildTrackingCardContext, trackingScore } from "../../../src/core/tracking";

const sc = trackingScore({
  wisdom: 15,
  level: 7,
  terrain: "normal",
  illumination: "good",
  creaturesTracked: 1,
  assistingTrackers: 0,
  animalFollower: false,
  trailInPrimaryTerrain: false,
  hoursSinceMade: 0,
  rainHours: 0,
  quarryHidesTrail: false,
  quarryIsSpecializedHiding: false,
  nonNatural: false,
});
const input = { actorName: "Rowan", actorImg: "r.png", level: 7, score: sc.score, halved: sc.halved, breakdown: sc.breakdown, roll: 10, identifyRoll: null };

describe("buildTrackingCardContext", () => {
  it("reports a found trail with its movement limit", () => {
    expect(buildTrackingCardContext(input)).toEqual({
      actorName: "Rowan",
      actorImg: "r.png",
      headlineKey: "ADND2E.chat.tracking.title",
      score: 17,
      halved: false,
      breakdown: sc.breakdown,
      possible: true,
      roll: 10,
      success: true,
      resultKey: "ADND2E.chat.tracking.found",
      movementKey: "ADND2E.tracking.movement.threeQuarters",
      identification: null,
    });
  });
  it("reports a lost trail on a miss and on a natural 20", () => {
    expect(buildTrackingCardContext({ ...input, roll: 18 })).toMatchObject({ success: false, resultKey: "ADND2E.chat.tracking.lost" });
    expect(buildTrackingCardContext({ ...input, roll: 20 })).toMatchObject({ success: false, resultKey: "ADND2E.chat.tracking.lost" });
  });
  it("reports an impossible track (score zero or less) with no roll and no movement limit", () => {
    expect(buildTrackingCardContext({ ...input, score: 0, roll: null })).toMatchObject({
      possible: false,
      roll: null,
      success: false,
      resultKey: "ADND2E.chat.tracking.notPossible",
      movementKey: "",
      identification: null,
    });
  });
  it("lists the cumulative information on an identification success", () => {
    const ctx = buildTrackingCardContext({ ...input, level: 5, identifyRoll: 3 });
    expect(ctx.identification).toEqual({
      roll: 3,
      success: true,
      resultKey: "ADND2E.chat.tracking.identified",
      infoKeys: ["ADND2E.tracking.info.generalType", "ADND2E.tracking.info.specificTypeHeading", "ADND2E.tracking.info.number"],
    });
  });
  it("gives no information on an identification failure", () => {
    expect(buildTrackingCardContext({ ...input, identifyRoll: 19 }).identification).toEqual({
      roll: 19,
      success: false,
      resultKey: "ADND2E.chat.tracking.notIdentified",
      infoKeys: [],
    });
  });
});
