import { describe, expect, it } from "vitest";
import {
  expandedProficienciesEnabled,
  isRelatedGroup,
  weaponProficiencyMode,
} from "../../../src/core/proficiencies/weapon-relation";
import { weaponAttackPenalty } from "../../../src/core/proficiencies/weapon";

describe("expandedProficienciesEnabled", () => {
  it("requires BOTH the master switch and the expanded-proficiencies toggle", () => {
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: true, expandedProficiencies: true })).toBe(true);
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: true, expandedProficiencies: false })).toBe(false);
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: false, expandedProficiencies: true })).toBe(false);
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: false, expandedProficiencies: false })).toBe(false);
  });
});

describe("isRelatedGroup", () => {
  it("is true when a held specific proficiency is in the weapon's group", () => {
    expect(isRelatedGroup("Blades", ["Bows", "Blades"])).toBe(true);
  });
  it("is false when no held proficiency is in the weapon's group", () => {
    expect(isRelatedGroup("Blades", ["Bows", "Hafted"])).toBe(false);
  });
  it("is false when nothing is held", () => {
    expect(isRelatedGroup("Blades", [])).toBe(false);
  });
  it("is false for a weapon with no group, even if an empty string is 'held'", () => {
    expect(isRelatedGroup("", [""])).toBe(false);
    expect(isRelatedGroup("", ["Blades"])).toBe(false);
  });
});

describe("weaponProficiencyMode — precedence exact > group > related > non-proficient", () => {
  const cases: [boolean, boolean, boolean, string][] = [
    [true, true, true, "proficient"],
    [true, true, false, "proficient"],
    [true, false, true, "proficient"], // an exact match is never demoted to related
    [true, false, false, "proficient"],
    [false, true, true, "proficient"], // a group match is never demoted to related
    [false, true, false, "proficient"],
    [false, false, true, "related"],
    [false, false, false, "non-proficient"],
  ];
  for (const [exactMatch, groupMatch, relatedGroupMatch, expected] of cases) {
    it(`exact=${exactMatch} group=${groupMatch} related=${relatedGroupMatch} -> ${expected}`, () => {
      expect(weaponProficiencyMode({ exactMatch, groupMatch, relatedGroupMatch })).toBe(expected);
    });
  }
});

describe("mode feeds the existing weaponAttackPenalty", () => {
  it("a related weapon takes half the non-proficiency penalty, rounded up", () => {
    expect(weaponAttackPenalty(-2, "related")).toBe(-1); // warrior
    expect(weaponAttackPenalty(-3, "related")).toBe(-2); // priest / rogue
    expect(weaponAttackPenalty(-5, "related")).toBe(-3); // wizard (5/2 = 2.5 -> 3)
  });
});
