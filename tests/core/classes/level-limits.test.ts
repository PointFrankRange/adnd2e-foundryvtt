import { describe, expect, it } from "vitest";
import { getChassis } from "../../../src/core/classes/chassis";
import {
  NO_LEVEL_RULES,
  bonusLevels,
  levelForXpWithRules,
  levelRulesOf,
  xpToNextWithRules,
} from "../../../src/core/classes/level-limits";
import { levelForXp } from "../../../src/core/classes/progression";
import { scaleChassisXp } from "../../../src/core/kits";

const fighter = getChassis("fighter"); // level 15 = 1,750,000; 16 = 2,000,000; 17 = 2,250,000
const druid = getChassis("druid"); // maxLevel 14

describe("bonusLevels (Complete Book of Dwarves p.35)", () => {
  it("follows the table at every boundary", () => {
    expect([12, 13, 14, 15, 16, 17, 18, 19, 20, 25].map(bonusLevels)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 4, 4]);
  });
});

describe("levelRulesOf", () => {
  it("reads a class view's optional fields, defaulting to no limit", () => {
    expect(levelRulesOf({})).toEqual({ limit: null, beyondMultiplier: 0 });
    expect(levelRulesOf({ levelLimit: 15, beyondMultiplier: 2 })).toEqual({ limit: 15, beyondMultiplier: 2 });
    expect(levelRulesOf({ levelLimit: null })).toEqual(NO_LEVEL_RULES);
  });
});

describe("levelForXpWithRules", () => {
  it("no limit equals levelForXp", () => {
    for (const xp of [0, 1999, 2000, 1_750_000, 9_000_000]) expect(levelForXpWithRules(fighter, xp, NO_LEVEL_RULES)).toBe(levelForXp(fighter, xp));
  });
  it("a limit with multiplier 0 caps the level", () => {
    const r = { limit: 15, beyondMultiplier: 0 };
    expect(levelForXpWithRules(fighter, 1_749_999, r)).toBe(14);
    expect(levelForXpWithRules(fighter, 1_750_000, r)).toBe(15);
    expect(levelForXpWithRules(fighter, 5_000_000, r)).toBe(15);
  });
  it("beyond the limit each XP gap costs k times as much (x2, x3, x4), exactly at the threshold and one short", () => {
    // gap 15 -> 16 is 250,000; 16 -> 17 is 250,000
    const at = (k: number, xp: number) => levelForXpWithRules(fighter, xp, { limit: 15, beyondMultiplier: k });
    expect(at(2, 2_249_999)).toBe(15);
    expect(at(2, 2_250_000)).toBe(16);
    expect(at(2, 2_749_999)).toBe(16);
    expect(at(2, 2_750_000)).toBe(17);
    expect(at(3, 2_499_999)).toBe(15);
    expect(at(3, 2_500_000)).toBe(16);
    expect(at(4, 2_749_999)).toBe(15);
    expect(at(4, 2_750_000)).toBe(16);
    expect(at(2, 1_000_000)).toBe(12); // below the limit: unchanged
  });
  it("stacks with the race/kit percentage (the scaled gaps are multiplied by k)", () => {
    const scaled = scaleChassisXp(fighter, 10); // level 15 = 1,925,000, level 16 = 2,200,000
    const r = { limit: 15, beyondMultiplier: 2 };
    expect(levelForXpWithRules(scaled, 2_474_999, r)).toBe(15);
    expect(levelForXpWithRules(scaled, 2_475_000, r)).toBe(16);
  });
  it("a class's own maxLevel still applies", () => {
    expect(levelForXpWithRules(druid, 99_000_000, { limit: 20, beyondMultiplier: 0 })).toBe(14);
    expect(levelForXpWithRules(druid, 99_000_000, { limit: 20, beyondMultiplier: 2 })).toBe(14);
  });
});

describe("xpToNextWithRules", () => {
  it("below any limit it is the normal progress", () => {
    const p = xpToNextWithRules(fighter, 8000, { limit: 15, beyondMultiplier: 0 });
    expect(p).toMatchObject({ level: 4, next: 16000, toNextLevel: 8000, atLimit: false });
    expect(p.pct).toBeCloseTo(0);
  });
  it("capped: at the limit with multiplier 0 there is no next threshold", () => {
    expect(xpToNextWithRules(fighter, 2_000_000, { limit: 15, beyondMultiplier: 0 })).toEqual({
      level: 15, next: null, toNextLevel: null, pct: 1, atLimit: true,
    });
  });
  it("beyond the limit with x2 the next threshold is the multiplied one", () => {
    const p = xpToNextWithRules(fighter, 2_000_000, { limit: 15, beyondMultiplier: 2 });
    expect(p).toMatchObject({ level: 15, next: 2_250_000, toNextLevel: 250_000, atLimit: false });
    expect(p.pct).toBeCloseTo(0.5);
    const q = xpToNextWithRules(fighter, 2_300_000, { limit: 15, beyondMultiplier: 2 });
    expect(q).toMatchObject({ level: 16, next: 2_750_000, atLimit: false }); // 1,750,000 + 2 * (2,250,000 - 1,750,000)
  });
  it("no limit past the XP table is the existing end-of-table result", () => {
    expect(xpToNextWithRules(druid, 99_000_000, NO_LEVEL_RULES)).toEqual({ level: 14, next: null, toNextLevel: null, pct: 1, atLimit: false });
  });
  it("past the XP table a class that can still advance shows the extrapolated next threshold (#107)", () => {
    const top = fighter.xpThresholds[fighter.xpThresholds.length - 1];
    const lvl20 = xpToNextWithRules(fighter, top, { limit: 20, beyondMultiplier: 2 });
    expect(lvl20).toMatchObject({ level: 20, next: top + 2 * fighter.xpPerLevelBeyond20, atLimit: false });
    expect(xpToNextWithRules(fighter, top, NO_LEVEL_RULES).next).toBeNull(); // no exceed rule: unchanged
  });
  it("a class with a maxLevel stops at it even past the table rule", () => {
    expect(xpToNextWithRules(druid, 99_000_000, { limit: 14, beyondMultiplier: 2 }).next).toBeNull();
  });
  it("is clamped to 0..1 even when xp sits below the band start", () => {
    expect(xpToNextWithRules(fighter, 0, NO_LEVEL_RULES).pct).toBe(0);
  });
});
