import { describe, expect, it } from "vitest";
import { formatAbilityMod } from "../../../src/sheets/kit/ability-mods";

describe("formatAbilityMod", () => {
  it("shows an em dash for null or undefined", () => {
    expect(formatAbilityMod("hitProb", null)).toBe("—");
    expect(formatAbilityMod("openDoorsMagical", undefined)).toBe("—");
  });

  describe("signed keys", () => {
    it("prefixes a non-negative number with +, including zero", () => {
      expect(formatAbilityMod("hitProb", 2)).toBe("+2");
      expect(formatAbilityMod("damageAdj", 0)).toBe("+0");
      expect(formatAbilityMod("reactionAdj", 0)).toBe("+0");
      expect(formatAbilityMod("missileAttackAdj", 1)).toBe("+1");
      expect(formatAbilityMod("defensiveAdj", 3)).toBe("+3");
      expect(formatAbilityMod("hpAdjustment", 2)).toBe("+2");
      expect(formatAbilityMod("poisonSave", 0)).toBe("+0");
      expect(formatAbilityMod("magicalDefenseAdj", 1)).toBe("+1");
      expect(formatAbilityMod("loyaltyBase", 5)).toBe("+5");
    });

    it("leaves a negative number's own minus sign alone", () => {
      expect(formatAbilityMod("hitProb", -1)).toBe("-1");
      expect(formatAbilityMod("defensiveAdj", -4)).toBe("-4");
    });
  });

  describe("percent keys", () => {
    it("appends a % sign", () => {
      expect(formatAbilityMod("systemShock", 90)).toBe("90%");
      expect(formatAbilityMod("resurrectionSurvival", 100)).toBe("100%");
      expect(formatAbilityMod("bendBarsLiftGates", 16)).toBe("16%");
      expect(formatAbilityMod("learnSpellChance", 65)).toBe("65%");
      expect(formatAbilityMod("spellFailureChance", 5)).toBe("5%");
    });
  });

  describe("bonusPriestSpells", () => {
    it("joins non-zero level x count entries, 1-indexed", () => {
      expect(formatAbilityMod("bonusPriestSpells", [2, 1, 0, 0])).toBe("1×2 2×1");
    });

    it("shows an em dash when every entry is zero", () => {
      expect(formatAbilityMod("bonusPriestSpells", [0, 0, 0, 0])).toBe("—");
    });

    it("shows a single entry with no trailing spaces", () => {
      expect(formatAbilityMod("bonusPriestSpells", [0, 0, 3, 0])).toBe("3×3");
    });
  });

  describe("other numbers", () => {
    it("stringifies plainly", () => {
      expect(formatAbilityMod("weightAllowance", 350)).toBe("350");
      expect(formatAbilityMod("maxPress", 700)).toBe("700");
      expect(formatAbilityMod("openDoors", 3)).toBe("3");
      expect(formatAbilityMod("hitDieMinimumRoll", 1)).toBe("1");
      expect(formatAbilityMod("bonusLanguages", 2)).toBe("2");
      expect(formatAbilityMod("maxSpellLevel", 9)).toBe("9");
      expect(formatAbilityMod("maxSpellsPerLevel", 4)).toBe("4");
      expect(formatAbilityMod("illusionImmunityLevel", 8)).toBe("8");
      expect(formatAbilityMod("spellImmunityFromScore", 18)).toBe("18");
      expect(formatAbilityMod("maxHenchmen", 6)).toBe("6");
    });
  });

  describe("other strings", () => {
    it("returns the string as-is", () => {
      expect(formatAbilityMod("regeneration", "Nil")).toBe("Nil");
      expect(formatAbilityMod("regeneration", "1 hp/turn")).toBe("1 hp/turn");
    });
  });
});
