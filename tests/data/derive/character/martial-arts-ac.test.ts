import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";

const ON = { ...DEFAULT_OPTIONAL_RULES, advancedMartialArts: true };

const fighter: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [{ chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [8], dualClassState: null, level: 1 }],
  equippedArmor: null,
  equippedShield: null,
  carriedWeight: 0,
  wizardMemorized: [],
  priestMemorized: [],
  spentWeaponSlots: 0,
  spentNonweaponSlots: 0,
  baseMovement: 12,
  thiefSkillAllocations: [],
  traits: [],
  isCasting: false,
};

describe("deriveCharacter — the active martial arts style's AC modifier", () => {
  it("applies the modifier to every AC variant while the rule is on", () => {
    const ac = deriveCharacter({ ...fighter, martialArtsAcMod: -3 }, ON).ac;
    expect(ac).toEqual({ normal: 7, shieldless: 7, surprised: 7, rearAttack: 7 });
  });
  it("is clamped at the AC floor like any other AC", () => {
    expect(deriveCharacter({ ...fighter, martialArtsAcMod: -30 }, ON).ac.normal).toBe(-10);
  });
  it("does nothing while the rule is off or the modifier is absent", () => {
    expect(deriveCharacter({ ...fighter, martialArtsAcMod: -3 }, DEFAULT_OPTIONAL_RULES).ac.normal).toBe(10);
    expect(deriveCharacter(fighter, ON).ac.normal).toBe(10);
  });
});

describe("deriveCharacter - Ironskin (SP18 B3)", () => {
  it("adds its modifier to the style modifier while the rule is on", () => {
    expect(deriveCharacter({ ...fighter, martialArtsAcMod: -1, ironskinAcMod: -2 }, ON).ac.normal).toBe(7);
    expect(deriveCharacter({ ...fighter, ironskinAcMod: -2 }, ON).ac.normal).toBe(8);
  });
  it("does nothing while the rule is off or absent", () => {
    expect(deriveCharacter({ ...fighter, ironskinAcMod: -2 }, DEFAULT_OPTIONAL_RULES).ac.normal).toBe(10);
    expect(deriveCharacter(fighter, ON).ac.normal).toBe(10);
  });
});
