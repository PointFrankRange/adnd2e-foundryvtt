import { describe, expect, it } from "vitest";
import { martialArtsResult } from "../../../src/core/martial-arts";

describe("Table 16", () => {
  it.each([
    [20, "headKick", 4], [19, "headKick", 4], [18, "headPunch", 3], [17, "headPunch", 3], [16, "vitalsKick", 3], [15, "vitalsKick", 3],
    [14, "vitalsPunch", 2], [13, "vitalsPunch", 2], [12, "highKick", 2], [11, "highKick", 2], [10, "sideKick", 2], [9, "sideKick", 2],
    [8, "bodyPunch", 1], [6, "bodyPunch", 1], [5, "lowKick", 1], [3, "lowKick", 1], [2, "graze", 0], [1, "graze", 0],
  ])("d20 %i → %s (%i)", (roll, blow, damage) => {
    expect(martialArtsResult(roll)).toEqual({ blow, damage });
  });
  it("rejects a roll outside 1-20", () => {
    expect(() => martialArtsResult(0)).toThrow(RangeError);
    expect(() => martialArtsResult(21)).toThrow(RangeError);
  });
});
