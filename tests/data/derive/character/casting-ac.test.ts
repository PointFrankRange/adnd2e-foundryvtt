import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";

const ON = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, expandedCastingTime: true };

// DEX 17 -> defensiveAdj -3 (AC 10 unarmored -> 7)
const agile: ActorSnapshot = {
  abilities: { str: 12, dex: 17, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [{ chassisId: "mage", specialistSchool: null, xp: 0, hpRolls: [4], dualClassState: null, level: 1 }],
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

describe("deriveCharacter — no Dexterity AC bonus while casting", () => {
  it("drops the Dex bonus from normal and shieldless AC only while casting with the rule on", () => {
    const idle = deriveCharacter(agile, ON);
    const casting = deriveCharacter({ ...agile, isCasting: true }, ON);
    expect(idle.ac.normal).toBe(7);
    expect(casting.ac.normal).toBe(10);
    expect(casting.ac.shieldless).toBe(10);
    // surprised / rear already deny Dex — unchanged
    expect(casting.ac.surprised).toBe(idle.ac.surprised);
    expect(casting.ac.rearAttack).toBe(idle.ac.rearAttack);
  });

  it("keeps a Dex AC penalty while casting", () => {
    const clumsy = { ...agile, abilities: { ...agile.abilities, dex: 3 }, isCasting: true };
    expect(deriveCharacter(clumsy, ON).ac.normal).toBe(deriveCharacter({ ...clumsy, isCasting: false }, ON).ac.normal);
  });

  it.each([
    ["everything off", DEFAULT_OPTIONAL_RULES],
    ["master only", { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true }],
    ["toggle only", { ...DEFAULT_OPTIONAL_RULES, expandedCastingTime: true }],
  ])("rule off (%s): a casting flag changes nothing", (_label, rules) => {
    expect(deriveCharacter({ ...agile, isCasting: true }, rules)).toEqual(deriveCharacter(agile, rules));
  });

  it("does not touch saves while casting", () => {
    expect(deriveCharacter({ ...agile, isCasting: true }, ON).saves).toEqual(deriveCharacter(agile, ON).saves);
  });
});
