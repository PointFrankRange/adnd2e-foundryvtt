import { describe, expect, it } from "vitest";
import { effectiveBaseArmorAc } from "../../../src/core/combat";

describe("effectiveBaseArmorAc (PHBR10 p.15)", () => {
  it("is the armor's AC when the race has no natural AC", () => {
    expect(effectiveBaseArmorAc(7, null)).toBe(7);
    expect(effectiveBaseArmorAc(10, null)).toBe(10);
  });
  it("is the natural AC when no armor is worn", () => {
    expect(effectiveBaseArmorAc(10, 5)).toBe(5);
  });
  it("is the armor's AC when the armor is rated better than the natural AC", () => {
    expect(effectiveBaseArmorAc(3, 5)).toBe(3); // lizard man in plate mail
    expect(effectiveBaseArmorAc(4, 5)).toBe(4);
  });
  it("gives +1 protection when the armor is rated equal or worse than the natural AC", () => {
    expect(effectiveBaseArmorAc(7, 5)).toBe(4); // lizard man in studded leather
    expect(effectiveBaseArmorAc(5, 5)).toBe(4);
  });
  it("never goes below -10", () => {
    expect(effectiveBaseArmorAc(9, -10)).toBe(-10);
  });
});
