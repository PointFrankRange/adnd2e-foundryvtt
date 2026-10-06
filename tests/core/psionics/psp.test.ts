import { describe, expect, it } from "vitest";
import { abilityModifier, inherentPotential, powerProgression, psionicStrength, wisdomBase } from "../../../src/core/psionics";

describe("Table 5 (inherent potential)", () => {
  it("modifier: <=15 none, then +1/+2/+3 capped at 18", () => {
    expect([3, 12, 15, 16, 17, 18, 19, 25].map(abilityModifier)).toEqual([0, 0, 0, 1, 2, 3, 3, 3]);
  });
  it("Wisdom base: 20/22/24/26, floor 20 and cap 26", () => {
    expect([9, 15, 16, 17, 18, 19].map(wisdomBase)).toEqual([20, 20, 22, 24, 26, 26]);
  });
  it("the book's example: Wis 17, Con 16, Int 12 has inherent potential 25", () => {
    expect(inherentPotential(17, 12, 16)).toBe(25);
  });
});

describe("psionicStrength", () => {
  it("level 1 is the inherent potential; each later level adds 10 + the Wisdom modifier (book: Wis 17 gains 12)", () => {
    expect(psionicStrength(17, 12, 16, 1)).toBe(25);
    expect(psionicStrength(17, 12, 16, 2)).toBe(37);
    expect(psionicStrength(17, 12, 16, 5)).toBe(25 + 4 * 12);
  });
  it("a Wisdom of 15 gains a flat 10 per level; levels past 20 keep adding", () => {
    expect(psionicStrength(15, 10, 11, 3)).toBe(20 + 20);
    expect(psionicStrength(18, 18, 18, 22)).toBe(26 + 3 + 3 + 21 * 13);
  });
  it("level below 1 throws", () => {
    expect(() => psionicStrength(15, 10, 10, 0)).toThrow();
  });
});

describe("Table 4 progression", () => {
  it("matches the book at every row", () => {
    const rows = Array.from({ length: 20 }, (_, i) => powerProgression(i + 1));
    expect(rows.map((r) => [r.disciplines, r.sciences, r.devotions, r.defenseModes])).toEqual([
      [1, 1, 3, 1], [2, 1, 5, 1], [2, 2, 7, 2], [2, 2, 9, 2], [2, 3, 10, 3],
      [3, 3, 11, 3], [3, 4, 12, 4], [3, 4, 13, 4], [3, 5, 14, 5], [4, 5, 15, 5],
      [4, 6, 16, 5], [4, 6, 17, 5], [4, 7, 18, 5], [5, 7, 19, 5], [5, 8, 20, 5],
      [5, 8, 21, 5], [5, 9, 22, 5], [6, 9, 23, 5], [6, 10, 24, 5], [6, 10, 25, 5],
    ]);
  });
  it("levels past 20 use the level-20 row; below 1 throws", () => {
    expect(powerProgression(27)).toEqual(powerProgression(20));
    expect(() => powerProgression(0)).toThrow();
  });
});
