import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";
import type { OptionalRules } from "../../src/core/options";

describe("DEFAULT_OPTIONAL_RULES", () => {
  it("has exactly the twenty-three core, combatAndTactics, skillsAndPowers and spellsAndMagic toggles", () => {
    expect(Object.keys(DEFAULT_OPTIONAL_RULES).sort()).toEqual(
      [
        "armorTypeVsWeaponType",
        "calledShots",
        "channelers",
        "channellerFatigue",
        "characterPointBuild",
        "combatAndTacticsEnabled",
        "combatManeuvers",
        "criticalHits",
        "exceptionalStrength",
        "expandedCastingTime",
        "expandedProficiencies",
        "maxSpellsPerLevel",
        "multiclassHpAveraging",
        "nonweaponProficienciesUsed",
        "skillsAndPowersEnabled",
        "spellFailureFromWisdom",
        "spellPoints",
        "spellsAndMagicEnabled",
        "subAbilityScores",
        "trainingRequiredToLevel",
        "weaponMastery",
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
      combatAndTacticsEnabled: false,
      criticalHits: false,
      calledShots: false,
      combatManeuvers: false,
      armorTypeVsWeaponType: false,
      weaponMastery: false,
      skillsAndPowersEnabled: false,
      subAbilityScores: false,
      characterPointBuild: false,
      expandedProficiencies: false,
      spellsAndMagicEnabled: false,
      expandedCastingTime: false,
      spellPoints: false,
      channelers: false,
      channellerFatigue: false,
    };
    expect(DEFAULT_OPTIONAL_RULES).toEqual(expected);
  });
});
