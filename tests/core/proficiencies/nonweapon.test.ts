import { describe, expect, it } from "vitest";
import { CLASS_PROFICIENCY_GROUPS, nonweaponSlotCost, nonweaponCheck } from "../../../src/core/proficiencies/nonweapon";

describe("CLASS_PROFICIENCY_GROUPS (PHB Table 38)", () => {
  it("maps each base class to its groups, always including general", () => {
    expect(CLASS_PROFICIENCY_GROUPS.fighter).toEqual(["warrior", "general"]);
    expect(CLASS_PROFICIENCY_GROUPS.mage).toEqual(["wizard", "general"]);
    expect(CLASS_PROFICIENCY_GROUPS.cleric).toEqual(["priest", "general"]);
    expect(CLASS_PROFICIENCY_GROUPS.thief).toEqual(["rogue", "general"]);
  });
});

describe("nonweaponSlotCost()", () => {
  it("base cost for an in-group proficiency", () => {
    expect(nonweaponSlotCost(1, "general", "mage")).toBe(1);
    expect(nonweaponSlotCost(2, "wizard", "mage")).toBe(2);
  });
  it("one extra slot for an out-of-group proficiency", () => {
    expect(nonweaponSlotCost(1, "warrior", "mage")).toBe(2);
    expect(nonweaponSlotCost(2, "rogue", "cleric")).toBe(3);
  });
});

describe("nonweaponCheck()", () => {
  it("succeeds when the roll is at or under the adjusted ability score", () => {
    const r = nonweaponCheck({ ability: "wis", abilityScore: 14, checkModifier: -1, roll: 13 });
    expect(r).toEqual({ success: true, autoFail: false, target: 13, roll: 13 });
  });
  it("fails when the roll is over the target", () => {
    const r = nonweaponCheck({ ability: "wis", abilityScore: 14, checkModifier: -1, roll: 14 });
    expect(r).toMatchObject({ success: false, autoFail: false, target: 13 });
  });
  it("a natural 20 always fails, even when the target is 20+", () => {
    // Str 18, modifier +3, +3 situational -> target 24, but the natural 20 still fails
    const r = nonweaponCheck({
      ability: "str",
      abilityScore: 18,
      checkModifier: 3,
      situationalModifier: 3,
      roll: 20,
    });
    expect(r).toMatchObject({ success: false, autoFail: true, target: 24 });
  });
  it("each slot beyond the first adds +1 to the check", () => {
    // Str 15, modifier 0, 3 slots invested -> target 15 + 0 + 2 = 17
    const r = nonweaponCheck({ ability: "str", abilityScore: 15, checkModifier: 0, slotsInvested: 3, roll: 17 });
    expect(r).toMatchObject({ success: true, target: 17 });
  });
  it("the situational modifier adjusts the target", () => {
    const easier = nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, situationalModifier: 4, roll: 16 });
    expect(easier).toMatchObject({ success: true, target: 16 });
    const harder = nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, situationalModifier: -4, roll: 9 });
    expect(harder).toMatchObject({ success: false, target: 8 });
  });
  it("rejects a bad roll, ability score, or slot count", () => {
    expect(() => nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, roll: 21 })).toThrow(RangeError);
    expect(() => nonweaponCheck({ ability: "int", abilityScore: 0, checkModifier: 0, roll: 10 })).toThrow(RangeError);
    expect(() => nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, slotsInvested: 0, roll: 10 })).toThrow(RangeError);
  });
});
