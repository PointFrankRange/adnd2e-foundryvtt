import { describe, expect, it } from "vitest";
import { criticalSeverity, fumbleSeverity } from "../../src/combat/critical";

describe("criticalSeverity", () => {
  it("d10 1-5 is a solid hit: x2 damage, no flat bonus", () => {
    for (const d10 of [1, 5]) {
      expect(criticalSeverity(d10)).toEqual({ tier: "solid", damageMultiplier: 2, flatBonus: 0 });
    }
  });
  it("d10 6-9 is a devastating hit: x3 damage, no flat bonus", () => {
    for (const d10 of [6, 9]) {
      expect(criticalSeverity(d10)).toEqual({ tier: "devastating", damageMultiplier: 3, flatBonus: 0 });
    }
  });
  it("d10 10 is a brutal hit: x3 damage + flat +3", () => {
    expect(criticalSeverity(10)).toEqual({ tier: "brutal", damageMultiplier: 3, flatBonus: 3 });
  });
});

describe("fumbleSeverity", () => {
  it("d10 1-5 is just a miss: no effect", () => {
    for (const d10 of [1, 5]) {
      expect(fumbleSeverity(d10)).toEqual({ tier: "miss", effect: "none", selfInjuryDice: null });
    }
  });
  it("d10 6-8 drops the weapon", () => {
    for (const d10 of [6, 8]) {
      expect(fumbleSeverity(d10)).toEqual({ tier: "weaponDrops", effect: "weaponDrops", selfInjuryDice: null });
    }
  });
  it("d10 9-10 causes minor self-injury (1d3)", () => {
    for (const d10 of [9, 10]) {
      expect(fumbleSeverity(d10)).toEqual({ tier: "selfInjury", effect: "selfInjury", selfInjuryDice: "1d3" });
    }
  });
});
