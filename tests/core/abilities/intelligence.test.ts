import { describe, expect, it } from "vitest";
import { intelligence } from "../../../src/core/abilities/intelligence";

describe("intelligence()", () => {
  it("very low: no spellcasting capability", () => {
    expect(intelligence(1)).toEqual({ bonusLanguages: 0, maxSpellLevel: null, learnSpellChance: null, maxSpellsPerLevel: null, illusionImmunityLevel: null });
    expect(intelligence(8)).toEqual({ bonusLanguages: 1, maxSpellLevel: null, learnSpellChance: null, maxSpellsPerLevel: null, illusionImmunityLevel: null });
  });
  it("9-18 rows", () => {
    expect(intelligence(9)).toEqual({ bonusLanguages: 2, maxSpellLevel: 4, learnSpellChance: 35, maxSpellsPerLevel: 6, illusionImmunityLevel: null });
    expect(intelligence(10)).toMatchObject({ maxSpellLevel: 5, learnSpellChance: 40, maxSpellsPerLevel: 7 });
    expect(intelligence(12)).toMatchObject({ bonusLanguages: 3, maxSpellLevel: 6, learnSpellChance: 50, maxSpellsPerLevel: 7 });
    expect(intelligence(13)).toMatchObject({ maxSpellsPerLevel: 9 });
    expect(intelligence(14)).toMatchObject({ bonusLanguages: 4, maxSpellLevel: 7, learnSpellChance: 60, maxSpellsPerLevel: 9 });
    expect(intelligence(15)).toMatchObject({ maxSpellsPerLevel: 11 });
    expect(intelligence(16)).toMatchObject({ bonusLanguages: 5, maxSpellLevel: 8, learnSpellChance: 70, maxSpellsPerLevel: 11 });
    expect(intelligence(17)).toMatchObject({ bonusLanguages: 6, learnSpellChance: 75, maxSpellsPerLevel: 14 });
    expect(intelligence(18)).toEqual({ bonusLanguages: 7, maxSpellLevel: 9, learnSpellChance: 85, maxSpellsPerLevel: 18, illusionImmunityLevel: null });
  });
  it("19-25: All spells, illusion immunity", () => {
    expect(intelligence(19)).toEqual({ bonusLanguages: 8, maxSpellLevel: 9, learnSpellChance: 95, maxSpellsPerLevel: null, illusionImmunityLevel: 1 });
    expect(intelligence(20)).toMatchObject({ bonusLanguages: 9, learnSpellChance: 96, illusionImmunityLevel: 2 });
    expect(intelligence(21)).toMatchObject({ bonusLanguages: 10, learnSpellChance: 97, illusionImmunityLevel: 3 });
    expect(intelligence(22)).toMatchObject({ bonusLanguages: 11, learnSpellChance: 98, illusionImmunityLevel: 4 });
    expect(intelligence(23)).toMatchObject({ bonusLanguages: 12, learnSpellChance: 99, illusionImmunityLevel: 5 });
    expect(intelligence(24)).toMatchObject({ bonusLanguages: 15, learnSpellChance: 100, illusionImmunityLevel: 6 });
    expect(intelligence(25)).toEqual({ bonusLanguages: 20, maxSpellLevel: 9, learnSpellChance: 100, maxSpellsPerLevel: null, illusionImmunityLevel: 7 });
  });
  it("rejects invalid", () => { expect(() => intelligence(0)).toThrow(RangeError); });
});
