import { describe, expect, it } from "vitest";
import { SAVE_MATRICES, saveBaseTarget } from "../../../src/core/saves";
import type { ClassGroup, SaveCategory } from "../../../src/core/types";

const CATS: SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

// PHB Table 60 — [minLevel, ppd, rsw, pp, bw, spell]
const EXPECTED: Record<ClassGroup, number[][]> = {
  priest: [
    [1, 10, 14, 13, 16, 15],
    [4, 9, 13, 12, 15, 14],
    [7, 7, 11, 10, 13, 12],
    [10, 6, 10, 9, 12, 11],
    [13, 5, 9, 8, 11, 10],
    [16, 4, 8, 7, 10, 9],
    [19, 2, 6, 5, 8, 7],
  ],
  rogue: [
    [1, 13, 14, 12, 16, 15],
    [5, 12, 12, 11, 15, 13],
    [9, 11, 10, 10, 14, 11],
    [13, 10, 8, 9, 13, 9],
    [17, 9, 6, 8, 12, 7],
    [21, 8, 4, 7, 11, 5],
  ],
  warrior: [
    [0, 16, 18, 17, 20, 19],
    [1, 14, 16, 15, 17, 17],
    [3, 13, 15, 14, 16, 16],
    [5, 11, 13, 12, 13, 14],
    [7, 10, 12, 11, 12, 13],
    [9, 8, 10, 9, 9, 11],
    [11, 7, 9, 8, 8, 10],
    [13, 5, 7, 6, 5, 8],
    [15, 4, 6, 5, 4, 7],
    [17, 3, 5, 4, 4, 6],
  ],
  wizard: [
    [1, 14, 11, 13, 15, 12],
    [6, 13, 9, 11, 13, 10],
    [11, 11, 7, 9, 11, 8],
    [16, 10, 5, 7, 9, 6],
    [21, 8, 3, 5, 7, 4],
  ],
};

describe("SAVE_MATRICES", () => {
  it("matches PHB Table 60 exactly", () => {
    for (const group of Object.keys(EXPECTED) as ClassGroup[]) {
      const bands = SAVE_MATRICES[group];
      expect(bands.map((b) => [b.minLevel, b.ppd, b.rsw, b.pp, b.bw, b.spell])).toEqual(EXPECTED[group]);
    }
  });
});

describe("saveBaseTarget()", () => {
  it("selects the band by highest minLevel <= level", () => {
    expect(saveBaseTarget("priest", 1, "ppd")).toBe(10);
    expect(saveBaseTarget("priest", 3, "ppd")).toBe(10);
    expect(saveBaseTarget("priest", 4, "ppd")).toBe(9);
    expect(saveBaseTarget("priest", 19, "spell")).toBe(7);
    expect(saveBaseTarget("priest", 99, "spell")).toBe(7); // clamps to top band
    expect(saveBaseTarget("warrior", 1, "bw")).toBe(17);
    expect(saveBaseTarget("warrior", 2, "bw")).toBe(17);
    expect(saveBaseTarget("warrior", 3, "bw")).toBe(16);
    expect(saveBaseTarget("warrior", 13, "bw")).toBe(5);
    expect(saveBaseTarget("wizard", 5, "rsw")).toBe(11);
    expect(saveBaseTarget("wizard", 6, "rsw")).toBe(9);
    expect(saveBaseTarget("rogue", 21, "rsw")).toBe(4);
  });

  it("covers every category for a mid band", () => {
    const got = CATS.map((c) => saveBaseTarget("warrior", 10, c));
    expect(got).toEqual([8, 10, 9, 9, 11]); // warrior band minLevel 9
  });

  it("rejects invalid level", () => {
    expect(() => saveBaseTarget("warrior", 0, "ppd")).toThrow(RangeError);
    expect(() => saveBaseTarget("warrior", 2.5, "ppd")).toThrow(RangeError);
  });
});
