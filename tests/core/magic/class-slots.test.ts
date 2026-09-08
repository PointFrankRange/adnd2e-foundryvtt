import { describe, expect, it } from "vitest";
import { paladinSpellSlots, rangerSpellSlots, bardSpellSlots } from "../../../src/core/magic/class-slots";

describe("paladinSpellSlots() (PHB Table 17)", () => {
  it("no spells before level 9", () => {
    expect(paladinSpellSlots(1)).toEqual([0, 0, 0, 0]);
    expect(paladinSpellSlots(8)).toEqual([0, 0, 0, 0]);
  });
  it("matches the table rows", () => {
    expect(paladinSpellSlots(9)).toEqual([1, 0, 0, 0]);
    expect(paladinSpellSlots(11)).toEqual([2, 1, 0, 0]);
    expect(paladinSpellSlots(14)).toEqual([3, 2, 1, 0]);
    expect(paladinSpellSlots(20)).toEqual([3, 3, 3, 3]);
  });
  it("above 20 reuses the level-20 row", () => {
    expect(paladinSpellSlots(25)).toEqual([3, 3, 3, 3]);
  });
  it("rejects a bad level", () => {
    expect(() => paladinSpellSlots(0)).toThrow(RangeError);
  });
});

describe("rangerSpellSlots() (PHB Table 18)", () => {
  it("no spells before level 8", () => {
    expect(rangerSpellSlots(7)).toEqual([0, 0, 0]);
  });
  it("matches the table rows", () => {
    expect(rangerSpellSlots(8)).toEqual([1, 0, 0]);
    expect(rangerSpellSlots(10)).toEqual([2, 1, 0]);
    expect(rangerSpellSlots(12)).toEqual([2, 2, 1]);
    expect(rangerSpellSlots(16)).toEqual([3, 3, 3]);
  });
  it("above 16 reuses the level-16 row", () => {
    expect(rangerSpellSlots(20)).toEqual([3, 3, 3]);
  });
  it("rejects a bad level", () => {
    expect(() => rangerSpellSlots(0)).toThrow(RangeError);
  });
});

describe("bardSpellSlots() (PHB Table 32)", () => {
  it("no spells before level 2", () => {
    expect(bardSpellSlots({ bardLevel: 1, maxSpellLevelKnown: 6 }).perLevel).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it("matches the table rows, INT-capped", () => {
    expect(bardSpellSlots({ bardLevel: 2, maxSpellLevelKnown: 6 }).perLevel).toEqual([1, 0, 0, 0, 0, 0]);
    expect(bardSpellSlots({ bardLevel: 7, maxSpellLevelKnown: 6 }).perLevel).toEqual([3, 2, 1, 0, 0, 0]);
    expect(bardSpellSlots({ bardLevel: 20, maxSpellLevelKnown: 6 }).perLevel).toEqual([4, 4, 4, 4, 4, 3]);
  });
  it("Intelligence cap zeroes and reports high spell levels", () => {
    const r = bardSpellSlots({ bardLevel: 16, maxSpellLevelKnown: 4 });
    // L16 base [4,3,3,3,2,1] -> 5th & 6th suppressed
    expect(r.perLevel).toEqual([4, 3, 3, 3, 0, 0]);
    expect(r.suppressed).toEqual([5, 6]);
    expect(r.bonus).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it("caps levels with zero base slots", () => {
    const r = bardSpellSlots({ bardLevel: 2, maxSpellLevelKnown: 1 });
    // L2 base [1, 0, 0, 0, 0, 0] -> levels 2-6 capped but only non-zero are reported
    expect(r.perLevel).toEqual([1, 0, 0, 0, 0, 0]);
    expect(r.suppressed).toEqual([]); // level 2 has 0 base, not suppressed
  });
  it("above 20 reuses the level-20 row", () => {
    expect(bardSpellSlots({ bardLevel: 25, maxSpellLevelKnown: 6 }).perLevel).toEqual([4, 4, 4, 4, 4, 3]);
  });
  it("rejects a bad level and a bad spell-level cap", () => {
    expect(() => bardSpellSlots({ bardLevel: 0, maxSpellLevelKnown: 6 })).toThrow(RangeError);
    expect(() => bardSpellSlots({ bardLevel: 2, maxSpellLevelKnown: 0 })).toThrow(RangeError);
  });
});
