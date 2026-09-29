import { describe, expect, it } from "vitest";
import {
  weaponAttackPenalty,
  weaponSpecializationSlotCost,
  weaponSpecializationEffect,
  canWeaponSpecialize,
  categoryForProficiencyGroup,
  WEAPON_PROFICIENCY_GROUPS,
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
  it("melee specialist gets +1 to hit and +2 damage, no point-blank bonus", () => {
    expect(weaponSpecializationEffect("melee")).toEqual({ toHit: 1, damage: 2, pointBlankAttackBonus: 0 });
  });
  it("bow and crossbow specialists get a +2 point-blank bonus, no flat bonus", () => {
    expect(weaponSpecializationEffect("bow")).toEqual({ toHit: 0, damage: 0, pointBlankAttackBonus: 2 });
    expect(weaponSpecializationEffect("crossbow")).toEqual({ toHit: 0, damage: 0, pointBlankAttackBonus: 2 });
  });
});

describe("canWeaponSpecialize()", () => {
  it("only a single-class fighter (specialization-allowed) may specialize", () => {
    expect(canWeaponSpecialize({ specializationAllowed: true, isSingleClass: true })).toBe(true);
    expect(canWeaponSpecialize({ specializationAllowed: true, isSingleClass: false })).toBe(false);
    expect(canWeaponSpecialize({ specializationAllowed: false, isSingleClass: true })).toBe(false);
  });
});

describe("categoryForProficiencyGroup()", () => {
  it("Bows and Crossbows get their own category", () => {
    expect(categoryForProficiencyGroup("Bows")).toBe("bow");
    expect(categoryForProficiencyGroup("Crossbows")).toBe("crossbow");
  });
  it("every other known group collapses to melee", () => {
    expect(categoryForProficiencyGroup("Blades")).toBe("melee");
    expect(categoryForProficiencyGroup("Bludgeoning")).toBe("melee");
    expect(categoryForProficiencyGroup("Hafted")).toBe("melee");
    expect(categoryForProficiencyGroup("Hurled")).toBe("melee");
    expect(categoryForProficiencyGroup("Pole Arms")).toBe("melee");
    expect(categoryForProficiencyGroup("Slings")).toBe("melee");
  });
  it("an empty or unrecognized group is null, not a guess", () => {
    expect(categoryForProficiencyGroup("")).toBeNull();
    expect(categoryForProficiencyGroup("bow")).toBeNull(); // case-sensitive
    expect(categoryForProficiencyGroup("Typo'd Group")).toBeNull();
  });
  it("every canonical group resolves to a non-null category", () => {
    for (const group of WEAPON_PROFICIENCY_GROUPS) {
      expect(categoryForProficiencyGroup(group)).not.toBeNull();
    }
  });
});

describe("WEAPON_PROFICIENCY_GROUPS", () => {
  it("is the 8 fixed Sub-project 8b group names", () => {
    expect(WEAPON_PROFICIENCY_GROUPS).toEqual([
      "Blades", "Bludgeoning", "Bows", "Crossbows", "Hafted", "Hurled", "Pole Arms", "Slings",
    ]);
  });
});
