import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";
import type { OptionalRules } from "../../src/core/options";

describe("DEFAULT_OPTIONAL_RULES", () => {
  it("has exactly the eight core-rule toggles", () => {
    expect(Object.keys(DEFAULT_OPTIONAL_RULES).sort()).toEqual(
      [
        "exceptionalStrength",
        "maxSpellsPerLevel",
        "multiclassHpAveraging",
        "nonweaponProficienciesUsed",
        "spellFailureFromWisdom",
        "trainingRequiredToLevel",
        "weaponProficienciesUsed",
        "weaponSpeedInitiative",
      ].sort(),
    );
  });

  it("every value is a boolean and matches the documented default", () => {
    const expected: OptionalRules = {
      exceptionalStrength: true,
      maxSpellsPerLevel: false,
      weaponSpeedInitiative: false,
      spellFailureFromWisdom: true,
      trainingRequiredToLevel: false,
      nonweaponProficienciesUsed: true,
      weaponProficienciesUsed: true,
      multiclassHpAveraging: true,
    };
    expect(DEFAULT_OPTIONAL_RULES).toEqual(expected);
  });
});
