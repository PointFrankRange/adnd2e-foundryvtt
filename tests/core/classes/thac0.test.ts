import { describe, expect, it } from "vitest";
import { thac0 } from "../../../src/core/classes/thac0";
import type { ClassGroup } from "../../../src/core/types";

// PHB Table 53, levels 1..20
const TABLE_53: Record<ClassGroup, number[]> = {
  priest:  [20, 20, 20, 18, 18, 18, 16, 16, 16, 14, 14, 14, 12, 12, 12, 10, 10, 10, 8, 8],
  rogue:   [20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11],
  warrior: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  wizard:  [20, 20, 20, 19, 19, 19, 18, 18, 18, 17, 17, 17, 16, 16, 16, 15, 15, 15, 14, 14],
};

describe("thac0()", () => {
  it("reproduces PHB Table 53 for every group, levels 1-20", () => {
    for (const group of Object.keys(TABLE_53) as ClassGroup[]) {
      for (let level = 1; level <= 20; level++) {
        expect(thac0(group, level)).toBe(TABLE_53[group][level - 1]);
      }
    }
  });

  it("all 1st-level characters have THAC0 20", () => {
    for (const g of ["priest", "rogue", "warrior", "wizard"] as ClassGroup[]) {
      expect(thac0(g, 1)).toBe(20);
    }
  });

  it("extends past level 20 by the Table 54 improvement rate", () => {
    // warrior 1 point / 1 level, from THAC0 1 at L20
    expect(thac0("warrior", 21)).toBe(0);
    expect(thac0("warrior", 25)).toBe(-4);
    // rogue 1 point / 2 levels, from THAC0 11 at L20
    expect(thac0("rogue", 21)).toBe(11);
    expect(thac0("rogue", 22)).toBe(10);
    expect(thac0("rogue", 24)).toBe(9);
    // priest 2 points / 3 levels, from THAC0 8 at L20
    expect(thac0("priest", 21)).toBe(8);
    expect(thac0("priest", 22)).toBe(7);
    expect(thac0("priest", 23)).toBe(6);
    // wizard 1 point / 3 levels, from THAC0 14 at L20
    expect(thac0("wizard", 21)).toBe(14);
    expect(thac0("wizard", 23)).toBe(13);
  });

  it("rejects invalid level", () => {
    expect(() => thac0("warrior", 0)).toThrow(RangeError);
    expect(() => thac0("warrior", 1.5)).toThrow(RangeError);
  });
});
