import { describe, expect, it } from "vitest";
import {
  NO_SUBRACE,
  abilityRangeProblems,
  combineXpPercent,
  effectiveAbilityAdjustments,
  effectiveAbilityRanges,
  effectiveThiefAdjustments,
  normalizeSubrace,
} from "../../../src/core/races";
import { RACIAL_ABILITY_ADJUSTMENTS, RACIAL_ABILITY_LIMITS } from "../../../src/core/abilities/racial-adjustments";
import { THIEF_RACIAL_ADJUSTMENTS } from "../../../src/core/proficiencies/thief-skills";

const ranges = {
  str: [8, 18], dex: [3, 16], con: [13, 19], int: [3, 18], wis: [3, 18], cha: [3, 15],
} as const;
const thief = {
  "pick-pockets": 5, "open-locks": 0, "find-remove-traps": 10, "move-silently": 0,
  "hide-in-shadows": 5, "detect-noise": 0, "climb-walls": -10, "read-languages": -15,
};

describe("NO_SUBRACE", () => {
  it("is the inherit-everything layer", () => {
    expect(NO_SUBRACE).toEqual({
      id: "", abilityAdjustments: null, abilityRanges: null, thiefAdjustments: null,
      conSaveBonusAdjustment: 0, xpModifierPercent: 0, flatSaveBonus: null,
    });
  });
});

describe("normalizeSubrace", () => {
  it("returns the defaults for missing input", () => {
    expect(normalizeSubrace(undefined)).toEqual(NO_SUBRACE);
    expect(normalizeSubrace(null)).toEqual(NO_SUBRACE);
    expect(normalizeSubrace({})).toEqual(NO_SUBRACE);
  });
  it("keeps valid values", () => {
    const layer = normalizeSubrace({
      id: "deep-dwarf",
      abilityAdjustments: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      abilityRanges: {
        str: { min: 8, max: 18 }, dex: { min: 3, max: 16 }, con: { min: 13, max: 19 },
        int: { min: 3, max: 18 }, wis: { min: 3, max: 18 }, cha: { min: 3, max: 15 },
      },
      thiefAdjustments: thief,
      conSaveBonusAdjustment: 1,
      xpModifierPercent: 10,
      flatSaveBonus: { all: 3, poison: 2 },
    });
    expect(layer.id).toBe("deep-dwarf");
    expect(layer.abilityAdjustments).toEqual({ con: 2, cha: -2 });
    expect(layer.abilityRanges).toEqual(ranges);
    expect(layer.thiefAdjustments).toEqual(thief);
    expect(layer.conSaveBonusAdjustment).toBe(1);
    expect(layer.xpModifierPercent).toBe(10);
    expect(layer.flatSaveBonus).toEqual({ all: 3, poison: 2 });
  });
  it("treats malformed fields as inherit/0", () => {
    const layer = normalizeSubrace({
      id: 5,
      abilityAdjustments: "x",
      abilityRanges: { str: { min: 8 } },
      thiefAdjustments: { "pick-pockets": "a" },
      conSaveBonusAdjustment: 1.5,
      xpModifierPercent: "lots",
    });
    expect(layer).toEqual(NO_SUBRACE);
    // a non-object adjustment value, non-integer entries and a missing ability are ignored; ranges need all six abilities
    expect(normalizeSubrace({ abilityAdjustments: { con: 1.5, cha: 2, bogus: 3 } }).abilityAdjustments).toEqual({ cha: 2 });
  });
  it("reads flatSaveBonus leniently: both integers or null", () => {
    expect(normalizeSubrace({ flatSaveBonus: { all: 3, poison: 2 } }).flatSaveBonus).toEqual({ all: 3, poison: 2 });
    expect(normalizeSubrace({ flatSaveBonus: { all: 0, poison: 0 } }).flatSaveBonus).toEqual({ all: 0, poison: 0 });
    for (const bad of [undefined, null, "x", 7, {}, { all: 3 }, { poison: 2 }, { all: 3, poison: "2" }, { all: 3.5, poison: 2 }]) {
      expect(normalizeSubrace({ flatSaveBonus: bad }).flatSaveBonus, JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("effective tables", () => {
  const deep = normalizeSubrace({
    id: "deep-dwarf",
    abilityAdjustments: { con: 2, cha: -2 },
    abilityRanges: {
      str: { min: 8, max: 18 }, dex: { min: 3, max: 16 }, con: { min: 13, max: 19 },
      int: { min: 3, max: 18 }, wis: { min: 3, max: 18 }, cha: { min: 3, max: 15 },
    },
    thiefAdjustments: thief,
  });
  it("fall back to the base race's tables with no layer or an inherit layer", () => {
    for (const race of ["human", "dwarf", "elf", "gnome", "half-elf", "halfling"] as const) {
      expect(effectiveAbilityAdjustments(race, null)).toEqual(RACIAL_ABILITY_ADJUSTMENTS[race]);
      expect(effectiveAbilityAdjustments(race, NO_SUBRACE)).toEqual(RACIAL_ABILITY_ADJUSTMENTS[race]);
      expect(effectiveAbilityRanges(race, undefined)).toEqual(RACIAL_ABILITY_LIMITS[race]);
      expect(effectiveThiefAdjustments(race, NO_SUBRACE)).toEqual(THIEF_RACIAL_ADJUSTMENTS[race]);
    }
  });
  it("use the layer where it overrides", () => {
    expect(effectiveAbilityAdjustments("dwarf", deep)).toEqual({ con: 2, cha: -2 });
    expect(effectiveAbilityRanges("dwarf", deep)).toEqual(ranges);
    expect(effectiveThiefAdjustments("dwarf", deep)).toEqual(thief);
  });
});

describe("abilityRangeProblems", () => {
  const r = { ...ranges, str: [8, 18], dex: [3, 16], con: [13, 19], int: [3, 18], wis: [3, 18], cha: [3, 15] } as never;
  it("lists the abilities outside their min-max", () => {
    expect(abilityRangeProblems({ str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 }, r)).toEqual(["con"]);
    expect(abilityRangeProblems({ str: 7, dex: 17, con: 20, int: 12, wis: 12, cha: 16 }, r)).toEqual(["str", "dex", "con", "cha"]);
  });
  it("lists nothing when every score is in range (bounds are inclusive)", () => {
    expect(abilityRangeProblems({ str: 8, dex: 16, con: 13, int: 3, wis: 18, cha: 15 }, r)).toEqual([]);
  });
});

describe("combineXpPercent", () => {
  it("adds the kit and race surcharges", () => {
    expect(combineXpPercent(10, 20)).toBe(30);
    expect(combineXpPercent(0, 0)).toBe(0);
    expect(combineXpPercent(-90, -20)).toBe(-90);
    expect(combineXpPercent(-10, 10)).toBe(0);
  });
});
