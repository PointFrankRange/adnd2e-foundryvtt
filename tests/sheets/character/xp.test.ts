import { describe, expect, it } from "vitest";
import { awardXpSplit, xpToNext } from "../../../src/sheets/character/xp";

describe("xpToNext", () => {
  it("a level-1 fighter with 0 xp needs the level-2 threshold", () => {
    const r = xpToNext("fighter", 0);
    expect(r.level).toBe(1);
    expect(r.next).toBe(2000); // PHB fighter L2
    expect(r.toNextLevel).toBe(2000);
    expect(r.pct).toBe(0);
  });

  it("mid-band progress is a 0..1 fraction of the current band", () => {
    const r = xpToNext("fighter", 1000); // half way from L1 (0) to L2 (2000)
    expect(r.level).toBe(1);
    expect(r.pct).toBeCloseTo(0.5, 5);
    expect(r.toNextLevel).toBe(1000);
  });

  it("at/above the class max level, next is null and pct is 1", () => {
    const hugeXp = 100_000_000;
    const r = xpToNext("fighter", hugeXp);
    expect(r.next).toBeNull();
    expect(r.toNextLevel).toBeNull();
    expect(r.pct).toBe(1);
  });
});

describe("awardXpSplit", () => {
  it("divides evenly and floors", () => {
    expect(awardXpSplit(3000, 2)).toBe(1500);
    expect(awardXpSplit(3001, 2)).toBe(1500);
    expect(awardXpSplit(1000, 3)).toBe(333);
  });
  it("a single class gets the whole award", () => {
    expect(awardXpSplit(3000, 1)).toBe(3000);
  });
  it("zero or negative class count yields 0 (guard)", () => {
    expect(awardXpSplit(3000, 0)).toBe(0);
  });
});
