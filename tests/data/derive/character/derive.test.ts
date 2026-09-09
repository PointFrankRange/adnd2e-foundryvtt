import { describe, expect, it } from "vitest";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";

const base: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [],
  equippedArmor: null,
  equippedShield: null,
  carriedWeight: 0,
  memorized: [],
  spentWeaponSlots: 0,
  spentNonweaponSlots: 0,
  baseMovement: 12,
};

const fighterClass = {
  chassisId: "fighter" as const,
  specialistSchool: null,
  xp: 0,
  hpRolls: [] as number[],
  dualClassState: null,
  level: 1,
};
const mageClass = { ...fighterClass, chassisId: "mage" as const };

describe("deriveCharacter", () => {
  it("returns ability mods (§5.6 step 2)", () => {
    const d = deriveCharacter(base, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores).toEqual(base.abilities);
    expect(d.abilities.str.hitProb).toBe(0); // STR 12 -> no hit bonus
    expect(d.abilities.con.hpAdjustment).toBe(0); // CON 12 -> no hp adj
  });

  it("takes ability scores as-is — racial adjustment is prepareBaseData's job now (F3)", () => {
    const d = deriveCharacter({ ...base, race: "dwarf", abilities: { ...base.abilities, con: 15, cha: 13 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores.con).toBe(15); // no further delta
    expect(d.abilities.scores.cha).toBe(13);
  });

  it("no race still derives cleanly", () => {
    const d = deriveCharacter({ ...base, race: null }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores).toEqual(base.abilities);
  });

  it("halfling never gets exceptional Strength even at STR 18 / percentile 100 (F3 guard)", () => {
    const d = deriveCharacter(
      { ...base, race: "halfling", classes: [fighterClass], abilities: { ...base.abilities, str: 18 }, exceptionalStrengthPercentile: 100 },
      DEFAULT_OPTIONAL_RULES,
    );
    expect(d.abilities.str.hitProb).toBe(1); // STR 18 row, not the exceptional 18/00 row's 3
  });

  it("a warrior class unlocks the full Constitution hp bonus band", () => {
    const nonWarrior = deriveCharacter({ ...base, classes: [mageClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    const warrior = deriveCharacter({ ...base, classes: [fighterClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    expect(warrior.abilities.con.hpAdjustment).toBeGreaterThan(nonWarrior.abilities.con.hpAdjustment);
  });

  it("a mixed class list counts as warrior if any class is a warrior", () => {
    const d = deriveCharacter({ ...base, classes: [mageClass, fighterClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.con.hpAdjustment).toBeGreaterThan(0);
  });

  it("exceptional Strength: warrior, STR 18, percentile set, toggle on", () => {
    const d = deriveCharacter(
      { ...base, classes: [fighterClass], abilities: { ...base.abilities, str: 18 }, exceptionalStrengthPercentile: 100 },
      DEFAULT_OPTIONAL_RULES,
    );
    expect(d.abilities.str.hitProb).toBe(3); // 18/00 -> +3 to hit
  });
});
