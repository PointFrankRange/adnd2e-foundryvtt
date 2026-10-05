import { describe, expect, it } from "vitest";
import { kitXpPercentFor, scaleChassisXp, scaleThreshold } from "../../../src/core/kits";
import { getChassis } from "../../../src/core/classes/chassis";
import { levelForXp } from "../../../src/core/classes/progression";

describe("scaleThreshold", () => {
  it("scales by percent, flooring", () => {
    expect(scaleThreshold(2000, 25)).toBe(2500);
    expect(scaleThreshold(2000, -10)).toBe(1800);
    expect(scaleThreshold(1, 10)).toBe(1);
    expect(scaleThreshold(0, 25)).toBe(0);
    expect(scaleThreshold(2000, 0)).toBe(2000);
  });
});

describe("kitXpPercentFor", () => {
  it("returns the matching kit's percent, else 0", () => {
    const kits = [{ chassisId: "fighter", xpModifierPercent: 25 }];
    expect(kitXpPercentFor(kits, "fighter")).toBe(25);
    expect(kitXpPercentFor(kits, "mage")).toBe(0);
    expect(kitXpPercentFor([], "fighter")).toBe(0);
  });
});

describe("scaleChassisXp", () => {
  const fighter = getChassis("fighter");
  it("returns the same chassis for 0%", () => {
    expect(scaleChassisXp(fighter, 0)).toBe(fighter);
  });
  it("raises every threshold, so a level is reached later", () => {
    const scaled = scaleChassisXp(fighter, 25);
    const level2 = fighter.xpThresholds[1]!;
    expect(levelForXp(fighter, level2)).toBe(2);
    expect(levelForXp(scaled, level2)).toBe(1);
    expect(levelForXp(scaled, scaleThreshold(level2, 25))).toBe(2);
    expect(scaled.xpThresholds[0]).toBe(0);
    expect(scaled.xpPerLevelBeyond20).toBe(scaleThreshold(fighter.xpPerLevelBeyond20, 25));
  });
});
