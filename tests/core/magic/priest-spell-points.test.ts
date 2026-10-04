import { describe, expect, it } from "vitest";
import {
  priestMaxPerLevel, priestMaxSpellLevel, priestSpellPointBase, priestSpellPointTotal,
  priestScopeAllowsFree, priestTheurgyCost, priestWisdomBonusSp,
} from "../../../src/core/magic/priest-spell-points";

describe("Table 26 priest progression", () => {
  it.each([
    [1, 1, 3, 4], [2, 1, 4, 8], [3, 2, 5, 15], [4, 2, 5, 25], [5, 3, 6, 40],
    [6, 3, 6, 55], [7, 4, 6, 70], [8, 4, 7, 90], [9, 5, 7, 125], [10, 5, 7, 160],
    [11, 6, 8, 200], [12, 6, 8, 240], [13, 6, 8, 290], [14, 7, 9, 340], [15, 7, 9, 400],
    [16, 7, 10, 460], [17, 7, 10, 530], [18, 7, 11, 600], [19, 7, 11, 675], [20, 7, 12, 750],
  ])("level %i: max spell level %i, %i per level, %i SP", (level, maxSpell, perLevel, sp) => {
    expect(priestMaxSpellLevel(level)).toBe(maxSpell);
    expect(priestMaxPerLevel(level)).toBe(perLevel);
    expect(priestSpellPointBase(level)).toBe(sp);
  });

  it("adds 75 SP per level past 20, frozen at 7th level and 12 per level", () => {
    expect(priestSpellPointBase(21)).toBe(825);
    expect(priestSpellPointBase(22)).toBe(900);
    expect(priestMaxSpellLevel(25)).toBe(7);
    expect(priestMaxPerLevel(25)).toBe(12);
  });
});

describe("Table 27 Wisdom bonus SP", () => {
  it("is zero below Wisdom 13", () => {
    expect(priestWisdomBonusSp(5, 12)).toBe(0);
  });

  it.each([
    // [wisdom, [1-2, 3-4, 5-6, 7+]]
    [13, [4, 4, 4, 4]], [14, [8, 8, 8, 8]], [15, [8, 15, 15, 15]], [16, [8, 20, 20, 20]],
    [17, [8, 20, 30, 30]], [18, [8, 20, 30, 45]], [19, [12, 25, 45, 60]],
  ])("Wisdom %i uses the row by character-level band", (wis, row) => {
    expect(priestWisdomBonusSp(1, wis)).toBe(row[0]);
    expect(priestWisdomBonusSp(3, wis)).toBe(row[1]);
    expect(priestWisdomBonusSp(5, wis)).toBe(row[2]);
    expect(priestWisdomBonusSp(7, wis)).toBe(row[3]);
    expect(priestWisdomBonusSp(20, wis)).toBe(row[3]);
  });

  it("uses the Wisdom 19 row for Wisdom 20+ (user decision, spec)", () => {
    expect(priestWisdomBonusSp(5, 22)).toBe(priestWisdomBonusSp(5, 19));
  });
});

describe("priestSpellPointTotal", () => {
  it("adds the Wisdom bonus and the Constitution adjustment", () => {
    expect(priestSpellPointTotal(5, 16, 1)).toBe(40 + 20 + 1);
  });

  it("ignores the Constitution adjustment when it would drop the total below 4", () => {
    // level 1, Wis 13 bonus 4: base 4 + 4 = 8; Con -3 gives 5 (>=4, adjustment kept)
    expect(priestSpellPointTotal(1, 13, -3)).toBe(5);
    // Con -6 would give 2 (<4): adjustment ignored, base + Wisdom bonus kept
    expect(priestSpellPointTotal(1, 13, -6)).toBe(8);
  });
});

describe("Table 28/29 theurgy costs", () => {
  it("prices major fixed and major free from Table 28", () => {
    expect(priestTheurgyCost(1, "fixed", "major")).toBe(4);
    expect(priestTheurgyCost(7, "fixed", "major")).toBe(40);
    expect(priestTheurgyCost(1, "free", "major")).toBe(8);
    expect(priestTheurgyCost(7, "free", "major")).toBe(80);
  });

  it("prices minor fixed and universal free from the next spell level (Table 29)", () => {
    expect(priestTheurgyCost(1, "fixed", "minor")).toBe(6);
    expect(priestTheurgyCost(3, "fixed", "minor")).toBe(15);
    expect(priestTheurgyCost(7, "fixed", "minor")).toBe(50);
    expect(priestTheurgyCost(1, "free", "universal")).toBe(12);
    expect(priestTheurgyCost(7, "free", "universal")).toBe(100);
  });

  it("rejects combinations the book does not allow", () => {
    expect(() => priestTheurgyCost(3, "free", "minor")).toThrow(RangeError);
    expect(() => priestTheurgyCost(3, "fixed", "universal")).toThrow(RangeError);
  });
});

describe("priest theurgy bounds and scope rules", () => {
  it("stops at 7th level", () => {
    expect(() => priestTheurgyCost(8, "fixed", "major")).toThrow(RangeError);
    expect(() => priestTheurgyCost(9, "free", "universal")).toThrow(RangeError);
  });

  it("allows free theurgies only from major or universal scope", () => {
    expect(priestScopeAllowsFree("major")).toBe(true);
    expect(priestScopeAllowsFree("universal")).toBe(true);
    expect(priestScopeAllowsFree("minor")).toBe(false);
  });
});
