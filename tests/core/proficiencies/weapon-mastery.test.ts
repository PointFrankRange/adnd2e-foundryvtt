import { describe, expect, it } from "vitest";
import { weaponMasteryEffect, weaponMasteryTierCost } from "../../../src/core/proficiencies/weapon-mastery";

describe("weaponMasteryEffect", () => {
  it("tier 0 is a no-op for every category", () => {
    expect(weaponMasteryEffect(0, "melee")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
    expect(weaponMasteryEffect(0, "bow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
    expect(weaponMasteryEffect(0, "crossbow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
  });

  it("tier 1 (Specialized) matches weaponSpecializationEffect's melee values", () => {
    expect(weaponMasteryEffect(1, "melee")).toEqual({ toHit: 1, damage: 2, extraAttacks: 0 });
  });

  it("tier 1 (Specialized) matches weaponSpecializationEffect's missile values", () => {
    expect(weaponMasteryEffect(1, "bow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
    expect(weaponMasteryEffect(1, "crossbow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
  });

  it("tier 2 (Mastery) is +2/+3, flat across every category", () => {
    expect(weaponMasteryEffect(2, "melee")).toEqual({ toHit: 2, damage: 3, extraAttacks: 0 });
    expect(weaponMasteryEffect(2, "bow")).toEqual({ toHit: 2, damage: 3, extraAttacks: 0 });
    expect(weaponMasteryEffect(2, "crossbow")).toEqual({ toHit: 2, damage: 3, extraAttacks: 0 });
  });

  it("tier 3 (Grand Mastery) is +3/+3 and one extra attack per round, flat across every category", () => {
    expect(weaponMasteryEffect(3, "melee")).toEqual({ toHit: 3, damage: 3, extraAttacks: 1 });
    expect(weaponMasteryEffect(3, "bow")).toEqual({ toHit: 3, damage: 3, extraAttacks: 1 });
    expect(weaponMasteryEffect(3, "crossbow")).toEqual({ toHit: 3, damage: 3, extraAttacks: 1 });
  });
});

describe("weaponMasteryTierCost", () => {
  it("tier 1 matches weaponSpecializationSlotCost exactly", () => {
    expect(weaponMasteryTierCost(1, "melee")).toBe(2);
    expect(weaponMasteryTierCost(1, "crossbow")).toBe(2);
    expect(weaponMasteryTierCost(1, "bow")).toBe(3);
  });

  it("tier 2 is tier 1's cost plus 2", () => {
    expect(weaponMasteryTierCost(2, "melee")).toBe(4);
    expect(weaponMasteryTierCost(2, "bow")).toBe(5);
  });

  it("tier 3 is tier 1's cost plus 5", () => {
    expect(weaponMasteryTierCost(3, "melee")).toBe(7);
    expect(weaponMasteryTierCost(3, "bow")).toBe(8);
  });
});
