import { describe, expect, it } from "vitest";
import { applyRacialAdjustments, applyRacialDeltas, racialAbilityAdjustments, racialAbilityRanges } from "../../../src/core/abilities/racial-adjustments";
import { THIEF_RACIAL_ADJUSTMENTS, THIEF_SKILLS, racialThiefAdjustments } from "../../../src/core/proficiencies/thief-skills";
import { racialSaveCategories, sleepCharmResistance } from "../../../src/core/saves/racial";
import { effectiveAbilityAdjustments, effectiveAbilityRanges, effectiveThiefAdjustments, isRaceSlug, normalizeSubrace } from "../../../src/core/races";

const PROTO = ["constructor", "__proto__", "toString"];
const raw = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

describe("racial ability helpers", () => {
  it("adjustments", () => {
    expect(racialAbilityAdjustments("dwarf")).toEqual({ con: 1, cha: -1 });
    expect(racialAbilityAdjustments("aarakocra")).toEqual({});
    for (const p of PROTO) expect(racialAbilityAdjustments(p)).toEqual({});
  });
  it("ranges", () => {
    expect(racialAbilityRanges("elf").dex).toEqual([6, 18]);
    for (const r of ["aarakocra", ...PROTO]) {
      for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) expect(racialAbilityRanges(r)[k]).toEqual([3, 18]);
    }
  });
  it("unknown race leaves scores unchanged; PHB unchanged", () => {
    expect(applyRacialDeltas(raw, "aarakocra")).toEqual(raw);
    expect(applyRacialAdjustments(raw, "aarakocra")).toEqual(raw);
    expect(applyRacialAdjustments({ ...raw, str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 }, "dwarf")).toMatchObject({ con: 13, cha: 11 });
  });
});

describe("racial thief / save helpers", () => {
  it("thief adjustments", () => {
    expect(racialThiefAdjustments("dwarf")).toEqual(THIEF_RACIAL_ADJUSTMENTS.dwarf);
    for (const r of ["aarakocra", ...PROTO]) for (const s of THIEF_SKILLS) expect(racialThiefAdjustments(r)[s]).toBe(0);
  });
  it("save categories", () => {
    expect(racialSaveCategories("gnome")).toEqual(new Set(["rsw", "spell"]));
    expect(racialSaveCategories("dwarf")).toEqual(new Set(["rsw", "spell", "poison"]));
    expect(racialSaveCategories("aarakocra").size).toBe(0);
    expect(racialSaveCategories("constructor").size).toBe(0);
  });
  it("sleep/charm resistance", () => {
    expect(sleepCharmResistance("elf")).toBe(90);
    expect(sleepCharmResistance("half-elf")).toBe(30);
    expect(sleepCharmResistance("ogre-mage")).toBe(0);
  });
});

describe("effective lookups", () => {
  it("fall back safely for a non-PHB race, use the layer when present", () => {
    expect(effectiveAbilityAdjustments("aarakocra", null)).toEqual({});
    const layer = normalizeSubrace({ abilityAdjustments: { dex: 1, str: -1 } });
    expect(effectiveAbilityAdjustments("aarakocra", layer)).toEqual({ dex: 1, str: -1 });
    expect(effectiveAbilityRanges("aarakocra", null).str).toEqual([3, 18]);
    for (const s of THIEF_SKILLS) expect(effectiveThiefAdjustments("aarakocra", null)[s]).toBe(0);
  });
});

describe("isRaceSlug", () => {
  it("accepts slugs", () => {
    for (const s of ["human", "giant-kin-firbolg", "a1"]) expect(isRaceSlug(s)).toBe(true);
  });
  it("rejects non-slugs", () => {
    for (const s of ["", "Half-Ogre", "half_ogre", "-a", "a-", "a--b", " a", "a".repeat(41), 42, null]) expect(isRaceSlug(s)).toBe(false);
  });
});
