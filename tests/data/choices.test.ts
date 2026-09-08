import { describe, expect, it } from "vitest";
import {
  CLASS_IDS, RACE_IDS, ABILITY_KEYS, SPHERE_NAMES, SPELL_SCHOOLS, WIZARD_SCHOOLS,
  DAMAGE_TYPES, WEAPON_SIZES, WEAPON_CATEGORIES, NONWEAPON_GROUPS, CREATURE_SIZES,
  CASTER_CLASSES, SAVING_THROW_KINDS, DUAL_CLASS_STATES, FEATURE_SOURCE_TYPES, FEATURE_ACTIVATIONS,
} from "../../src/data/item/choices";

describe("item schema choice arrays match the engine unions", () => {
  it("CLASS_IDS = the 8 ClassId", () => {
    expect([...CLASS_IDS].sort()).toEqual(
      ["bard", "cleric", "druid", "fighter", "mage", "paladin", "ranger", "thief"],
    );
  });
  it("RACE_IDS = the 6 Race", () => {
    expect([...RACE_IDS].sort()).toEqual(["dwarf", "elf", "gnome", "half-elf", "halfling", "human"]);
  });
  it("ABILITY_KEYS", () => {
    expect([...ABILITY_KEYS].sort()).toEqual(["cha", "con", "dex", "int", "str", "wis"]);
  });
  it("SPHERE_NAMES has all 16", () => {
    expect(SPHERE_NAMES).toHaveLength(16);
    expect(SPHERE_NAMES).toContain("all");
    expect(SPHERE_NAMES).toContain("necromantic");
  });
  it("SPELL_SCHOOLS = 8 specialist schools + lesser-divination + wild (10)", () => {
    expect([...SPELL_SCHOOLS].sort()).toEqual(
      ["abjuration", "alteration", "conjuration", "divination", "enchantment",
       "illusion", "invocation", "lesser-divination", "necromancy", "wild"].sort(),
    );
  });
  it("WIZARD_SCHOOLS = the 8 specialist schools", () => {
    expect(WIZARD_SCHOOLS).toHaveLength(8);
    expect(WIZARD_SCHOOLS).not.toContain("wild");
  });
  it("DAMAGE_TYPES matches the weapon DamageType union", () => {
    expect([...DAMAGE_TYPES].sort()).toEqual(
      ["bludgeoning", "piercing", "piercing-bludgeoning", "piercing-slashing", "slashing"].sort(),
    );
  });
  it("WEAPON_SIZES / WEAPON_CATEGORIES", () => {
    expect(WEAPON_SIZES).toEqual(["S", "M", "L"]);
    expect([...WEAPON_CATEGORIES].sort()).toEqual(["bow", "crossbow", "melee", "thrown"]);
  });
  it("NONWEAPON_GROUPS", () => {
    expect([...NONWEAPON_GROUPS].sort()).toEqual(["general", "priest", "rogue", "warrior", "wizard"]);
  });
  it("CREATURE_SIZES", () => {
    expect(CREATURE_SIZES).toEqual(["tiny", "small", "medium", "large", "huge", "gargantuan"]);
  });
  it("small fixed lists", () => {
    expect([...CASTER_CLASSES].sort()).toEqual(["priest", "wizard"]);
    expect([...SAVING_THROW_KINDS].sort()).toEqual(["half", "negates", "none", "special"]);
    expect([...DUAL_CLASS_STATES].sort()).toEqual(["active", "primary", "suppressed"]);
    expect([...FEATURE_SOURCE_TYPES].sort()).toEqual(["class", "kit", "other", "race"]);
    expect([...FEATURE_ACTIVATIONS].sort()).toEqual(["action", "daily", "passive"]);
  });
});
