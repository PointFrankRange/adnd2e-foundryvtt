import { describe, expect, it } from "vitest";
import {
  ILLUMINATION_MODIFIERS, PRIMARY_TERRAINS, TERRAIN_MODIFIERS, TRACKING_ILLUMINATIONS, TRACKING_TERRAINS,
  canTrack, identificationInfo, movementLimit, resolveCheck, trackingInputFromForm, trackingScore, type TrackingInput,
} from "../../../src/core/tracking";

const base: TrackingInput = {
  wisdom: 15, level: 7, terrain: "normal", illumination: "good", creaturesTracked: 1, assistingTrackers: 0,
  animalFollower: false, trailInPrimaryTerrain: false, hoursSinceMade: 0, rainHours: 0,
  quarryHidesTrail: false, quarryIsSpecializedHiding: false, nonNatural: false,
};
const score = (over: Partial<TrackingInput> = {}) => trackingScore({ ...base, ...over }).score;

describe("tables", () => {
  it("terrain modifiers are Table 15", () => {
    expect(TERRAIN_MODIFIERS).toEqual({ freshSnow: 6, softGround: 4, thickBrush: 3, forestField: 2, normal: 0, desert: -2, swamp: -5, rocky: -10 });
    expect([...TRACKING_TERRAINS]).toEqual(Object.keys(TERRAIN_MODIFIERS));
  });
  it("illumination modifiers are Table 16", () => {
    expect(ILLUMINATION_MODIFIERS).toEqual({ good: 0, twilight: -3, moonlit: -6, dark: -10 });
    expect([...TRACKING_ILLUMINATIONS]).toEqual(Object.keys(ILLUMINATION_MODIFIERS));
  });
  it("lists the nine primary terrains", () => {
    expect([...PRIMARY_TERRAINS]).toEqual(["aquatic", "arctic", "desert", "forest", "hill", "jungle", "mountain", "plain", "swamp"]);
  });
});

describe("trackingScore", () => {
  it("worked example 1: level 7, Wis 15, normal ground, good light = 17", () => {
    expect(score()).toBe(17);
  });
  it("worked example 2: 4 creatures through fresh snow at twilight, 24 hours old = 20", () => {
    expect(score({ creaturesTracked: 4, terrain: "freshSnow", illumination: "twilight", hoursSinceMade: 24 })).toBe(20);
  });
  it("worked example 3: rocky terrain on a full-moon night = 1", () => {
    expect(score({ terrain: "rocky", illumination: "moonlit" })).toBe(1);
  });
  it.each(Object.entries(TERRAIN_MODIFIERS))("terrain %s adds %i", (terrain, amount) => {
    expect(score({ terrain: terrain as TrackingInput["terrain"] })).toBe(17 + amount);
  });
  it.each(Object.entries(ILLUMINATION_MODIFIERS))("illumination %s adds %i", (illumination, amount) => {
    expect(score({ illumination: illumination as TrackingInput["illumination"] })).toBe(17 + amount);
  });
  it("adds +1 per three ranger levels, rounded down", () => {
    expect([2, 3, 6, 7, 9].map((level) => score({ level }))).toEqual([15, 16, 17, 17, 18]);
  });
  it("adds +1 per two creatures, rounded down", () => {
    expect([1, 2, 3, 5].map((n) => score({ creaturesTracked: n }))).toEqual([17, 18, 18, 19]);
  });
  it("adds one per assisting tracker up to the level bonus", () => {
    expect(score({ assistingTrackers: 1 })).toBe(18);
    expect(score({ assistingTrackers: 5 })).toBe(19); // level 7 bonus is 2
    expect(score({ level: 2, assistingTrackers: 3 })).toBe(15); // level 2 bonus is 0
  });
  it("adds 1 for an animal follower and 2 for a trail in primary terrain", () => {
    expect(score({ animalFollower: true })).toBe(18);
    expect(score({ trailInPrimaryTerrain: true })).toBe(19);
  });
  it("subtracts 1 per full 12 hours since the trail was made", () => {
    expect([0, 11, 12, 25].map((h) => score({ hoursSinceMade: h }))).toEqual([17, 17, 16, 15]);
  });
  it("subtracts 5 per hour of rain, snow or sleet", () => {
    expect(score({ rainHours: 2 })).toBe(7);
  });
  it("subtracts 5 when the quarry hides its trail, 7 when it is a specialized ranger in primary terrain", () => {
    expect(score({ quarryHidesTrail: true })).toBe(12);
    expect(score({ quarryHidesTrail: true, quarryIsSpecializedHiding: true })).toBe(10);
    expect(score({ quarryIsSpecializedHiding: true })).toBe(17); // not hiding: no extra penalty
  });
  it("halves the final score, rounding down, in non-natural surroundings", () => {
    const r = trackingScore({ ...base, nonNatural: true });
    expect(r).toMatchObject({ score: 8, total: 17, halved: true });
    expect(trackingScore({ ...base, terrain: "rocky", illumination: "moonlit", nonNatural: true }).score).toBe(0);
  });
  it("does not halve in natural surroundings", () => {
    expect(trackingScore(base)).toMatchObject({ score: 17, total: 17, halved: false });
  });
  it("clamps negative and non-finite counts to zero", () => {
    expect(score({ creaturesTracked: -4, rainHours: -2, hoursSinceMade: Number.NaN, assistingTrackers: -1 })).toBe(17);
  });
  it("lists the non-zero modifiers in table order, wisdom first", () => {
    const r = trackingScore({ ...base, creaturesTracked: 4, terrain: "freshSnow", illumination: "twilight", hoursSinceMade: 24 });
    expect(r.breakdown).toEqual([
      { labelKey: "ADND2E.tracking.mod.wisdom", amount: 15 },
      { labelKey: "ADND2E.tracking.mod.level", amount: 2 },
      { labelKey: "ADND2E.trackingTerrains.freshSnow", amount: 6 },
      { labelKey: "ADND2E.trackingIlluminations.twilight", amount: -3 },
      { labelKey: "ADND2E.tracking.mod.creatures", amount: 2 },
      { labelKey: "ADND2E.tracking.mod.age", amount: -2 },
    ]);
  });
});

describe("canTrack and resolveCheck", () => {
  it("tracking is possible only above zero", () => {
    expect([-3, 0, 1, 17].map(canTrack)).toEqual([false, false, true, true]);
  });
  it("succeeds on a roll up to the score, including equal", () => {
    expect(resolveCheck(17, 17)).toBe(true);
    expect(resolveCheck(18, 17)).toBe(false);
    expect(resolveCheck(1, 1)).toBe(true);
  });
  it("a natural 20 always fails", () => {
    expect(resolveCheck(20, 25)).toBe(false);
    expect(resolveCheck(19, 25)).toBe(true);
  });
  it("never succeeds with a score of zero or less", () => {
    expect(resolveCheck(1, 0)).toBe(false);
  });
});

describe("movementLimit", () => {
  it("returns the Table 18 bands", () => {
    expect([1, 6].map(movementLimit)).toEqual(["quarter", "quarter"]);
    expect([7, 14].map(movementLimit)).toEqual(["half", "half"]);
    expect([15, 30].map(movementLimit)).toEqual(["threeQuarters", "threeQuarters"]);
  });
  it("is null below 1", () => {
    expect([0, -3].map(movementLimit)).toEqual([null, null]);
  });
});

describe("identificationInfo", () => {
  it("is cumulative by ranger level", () => {
    expect(identificationInfo(0)).toEqual([]);
    expect(identificationInfo(1)).toEqual(["generalType"]);
    expect(identificationInfo(2)).toEqual(["generalType"]);
    expect(identificationInfo(3)).toEqual(["generalType", "specificTypeHeading"]);
    expect(identificationInfo(4)).toEqual(["generalType", "specificTypeHeading"]);
    expect(identificationInfo(5)).toEqual(["generalType", "specificTypeHeading", "number"]);
    expect(identificationInfo(6)).toHaveLength(3);
    expect(identificationInfo(7)).toHaveLength(4);
    expect(identificationInfo(8)).toHaveLength(5);
    expect(identificationInfo(9)).toHaveLength(6);
    expect(identificationInfo(10)).toEqual(["generalType", "specificTypeHeading", "number", "sizeAge", "pace", "recent", "conditions"]);
    expect(identificationInfo(15)).toHaveLength(7);
  });
});

describe("trackingInputFromForm", () => {
  it("reads a full form", () => {
    expect(
      trackingInputFromForm(
        {
          terrain: "swamp", illumination: "dark", creaturesTracked: "6", assistingTrackers: 2, hoursSinceMade: "30", rainHours: 1,
          animalFollower: true, nonNatural: "on", quarryHidesTrail: true, quarryIsSpecializedHiding: true, trailInPrimaryTerrain: true, identify: false,
        },
        true,
      ),
    ).toEqual({
      terrain: "swamp", illumination: "dark", creaturesTracked: 6, assistingTrackers: 2, hoursSinceMade: 30, rainHours: 1,
      animalFollower: true, nonNatural: true, quarryHidesTrail: true, quarryIsSpecializedHiding: true, trailInPrimaryTerrain: true, identify: false,
    });
  });
  it("defaults an empty or invalid form: normal ground, good light, identification on", () => {
    expect(trackingInputFromForm({ terrain: "lava", illumination: 4, creaturesTracked: "abc", rainHours: -3 }, false)).toEqual({
      terrain: "normal", illumination: "good", creaturesTracked: 0, assistingTrackers: 0, hoursSinceMade: 0, rainHours: 0,
      animalFollower: false, nonNatural: false, quarryHidesTrail: false, quarryIsSpecializedHiding: false, trailInPrimaryTerrain: false, identify: true,
    });
  });
  it("ignores the primary-terrain box unless the ranger is specialized", () => {
    expect(trackingInputFromForm({ trailInPrimaryTerrain: true }, false).trailInPrimaryTerrain).toBe(false);
    expect(trackingInputFromForm({ trailInPrimaryTerrain: true }, true).trailInPrimaryTerrain).toBe(true);
  });
});
