import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import { deriveAc } from "../../../src/data/derive/character/ac";
import { deriveCharacter } from "../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../src/data/derive/character/snapshot";

describe("deriveAc with a natural AC (PHBR10 p.15)", () => {
  it("uses the natural AC when no armor is worn", () => {
    const ac = deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: 0, naturalAc: 5 });
    expect(ac.normal).toBe(5);
  });
  it("armor rated equal or worse adds +1 protection (studded leather 7 over natural 5)", () => {
    const ac = deriveAc({ equippedArmor: { baseArmorAc: 7, magicBonus: 0 }, equippedShield: null, dexDefensiveAdj: 0, naturalAc: 5 });
    expect(ac.normal).toBe(4);
  });
  it("better armor sets the AC (plate 3 over natural 5)", () => {
    const ac = deriveAc({ equippedArmor: { baseArmorAc: 3, magicBonus: 0 }, equippedShield: null, dexDefensiveAdj: 0, naturalAc: 5 });
    expect(ac.normal).toBe(3);
  });
  it("Dexterity still applies on top of the natural AC", () => {
    const ac = deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: -2, naturalAc: 5 });
    expect(ac.normal).toBe(3);
  });
  it("a shield bonus applies to normal but not shieldless", () => {
    const ac = deriveAc({ equippedArmor: null, equippedShield: { shieldBonus: 1, magicBonus: 0 }, dexDefensiveAdj: 0, naturalAc: 5 });
    expect(ac.normal).toBe(4);
    expect(ac.shieldless).toBe(5);
  });
  it("armor magic applies after the +1 protection rule", () => {
    const ac = deriveAc({ equippedArmor: { baseArmorAc: 7, magicBonus: 1 }, equippedShield: null, dexDefensiveAdj: 0, naturalAc: 5 });
    expect(ac.normal).toBe(3);
  });
  it("without a naturalAc field the result is unchanged", () => {
    const ac = deriveAc({
      equippedArmor: { baseArmorAc: 5, magicBonus: 0 },
      equippedShield: { shieldBonus: 1, magicBonus: 0 },
      dexDefensiveAdj: -1,
    });
    expect(ac.normal).toBe(3);
    expect(deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: 0, naturalAc: null }).normal).toBe(10);
  });
});

describe("deriveCharacter with a natural AC", () => {
  const base: ActorSnapshot = {
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
  it("a snapshot with naturalAc 7 and no armor has AC 7", () => {
    expect(deriveCharacter({ ...base, naturalAc: 7 }, DEFAULT_OPTIONAL_RULES).ac.normal).toBe(7);
  });
  it("a snapshot without naturalAc has AC 10", () => {
    expect(deriveCharacter(base, DEFAULT_OPTIONAL_RULES).ac.normal).toBe(10);
  });
});
