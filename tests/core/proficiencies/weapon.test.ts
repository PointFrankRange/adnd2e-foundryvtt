import { describe, expect, it } from "vitest";
import {
  weaponAttackPenalty,
  weaponSpecializationSlotCost,
  weaponSpecializationEffect,
  canWeaponSpecialize,
} from "../../../src/core/proficiencies/weapon";

describe("weaponAttackPenalty()", () => {
  it("proficient is no penalty", () => {
    expect(weaponAttackPenalty(-2, "proficient")).toBe(0);
    expect(weaponAttackPenalty(-5, "proficient")).toBe(0);
  });
  it("non-proficient is the full class penalty", () => {
    expect(weaponAttackPenalty(-2, "non-proficient")).toBe(-2); // warrior
    expect(weaponAttackPenalty(-5, "non-proficient")).toBe(-5); // wizard
    expect(weaponAttackPenalty(-3, "non-proficient")).toBe(-3); // priest / rogue
  });
  it("related weapon is half the penalty, rounded up toward zero magnitude", () => {
    expect(weaponAttackPenalty(-2, "related")).toBe(-1); // warrior
    expect(weaponAttackPenalty(-5, "related")).toBe(-3); // wizard: ceil(5/2) = 3
    expect(weaponAttackPenalty(-3, "related")).toBe(-2); // priest / rogue: ceil(3/2) = 2
  });
});

describe("weaponSpecializationSlotCost()", () => {
  it("melee and crossbow cost 2, any bow costs 3", () => {
    expect(weaponSpecializationSlotCost("melee")).toBe(2);
    expect(weaponSpecializationSlotCost("crossbow")).toBe(2);
    expect(weaponSpecializationSlotCost("bow")).toBe(3);
  });
});

describe("weaponSpecializationEffect()", () => {
  it("melee specialist gets +1 to hit and +2 damage", () => {
    expect(weaponSpecializationEffect("melee")).toEqual({ toHit: 1, damage: 2 });
  });
  it("bow and crossbow have no flat bonus here (point-blank is Plan 1b.7)", () => {
    expect(weaponSpecializationEffect("bow")).toEqual({ toHit: 0, damage: 0 });
    expect(weaponSpecializationEffect("crossbow")).toEqual({ toHit: 0, damage: 0 });
  });
});

describe("canWeaponSpecialize()", () => {
  it("only a single-class fighter (specialization-allowed) may specialize", () => {
    expect(canWeaponSpecialize({ specializationAllowed: true, isSingleClass: true })).toBe(true);
    expect(canWeaponSpecialize({ specializationAllowed: true, isSingleClass: false })).toBe(false);
    expect(canWeaponSpecialize({ specializationAllowed: false, isSingleClass: true })).toBe(false);
  });
});
