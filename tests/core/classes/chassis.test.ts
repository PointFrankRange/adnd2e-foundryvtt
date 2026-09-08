import { describe, expect, it } from "vitest";
import { getChassis, FIGHTER, MAGE, CLERIC, THIEF } from "../../../src/core/classes/chassis";

describe("class chassis", () => {
  it("getChassis returns the matching constant", () => {
    expect(getChassis("fighter")).toBe(FIGHTER);
    expect(getChassis("mage")).toBe(MAGE);
    expect(getChassis("cleric")).toBe(CLERIC);
    expect(getChassis("thief")).toBe(THIEF);
  });

  it("Fighter — warrior chassis", () => {
    expect(FIGHTER).toMatchObject({
      id: "fighter", group: "warrior", hitDie: 10,
      hpAfterNameLevel: 3, conBonusCutoffLevel: 9,
      primeRequisites: ["str"], abilityMinimums: { str: 9 },
      xpPerLevelBeyond20: 250000,
      weaponProficiencies: { initial: 4, levelsPerSlot: 3 },
      nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
      nonProficiencyPenalty: -2,
      casterType: null,
      weaponSpecializationAllowed: true,
    });
    expect(FIGHTER.xpThresholds).toHaveLength(20);
    expect(FIGHTER.xpThresholds[0]).toBe(0);
    expect(FIGHTER.xpThresholds[1]).toBe(2000);
    expect(FIGHTER.xpThresholds[8]).toBe(250000);   // level 9
    expect(FIGHTER.xpThresholds[19]).toBe(3000000); // level 20
  });

  it("Mage — wizard chassis", () => {
    expect(MAGE).toMatchObject({
      id: "mage", group: "wizard", hitDie: 4,
      hpAfterNameLevel: 1, conBonusCutoffLevel: 10,
      primeRequisites: ["int"], abilityMinimums: { int: 9 },
      xpPerLevelBeyond20: 375000,
      weaponProficiencies: { initial: 1, levelsPerSlot: 6 },
      nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
      nonProficiencyPenalty: -5,
      casterType: "wizard",
      weaponSpecializationAllowed: false,
    });
    expect(MAGE.xpThresholds[1]).toBe(2500);
    expect(MAGE.xpThresholds[9]).toBe(250000);   // level 10
    expect(MAGE.xpThresholds[19]).toBe(3750000); // level 20
  });

  it("Cleric — priest chassis", () => {
    expect(CLERIC).toMatchObject({
      id: "cleric", group: "priest", hitDie: 8,
      hpAfterNameLevel: 2, conBonusCutoffLevel: 9,
      primeRequisites: ["wis"], abilityMinimums: { wis: 9 },
      xpPerLevelBeyond20: 225000,
      weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
      nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
      nonProficiencyPenalty: -3,
      casterType: "priest",
      weaponSpecializationAllowed: false,
    });
    expect(CLERIC.xpThresholds[1]).toBe(1500);
    expect(CLERIC.xpThresholds[8]).toBe(225000);  // level 9
    expect(CLERIC.xpThresholds[19]).toBe(2700000); // level 20
  });

  it("Thief — rogue chassis", () => {
    expect(THIEF).toMatchObject({
      id: "thief", group: "rogue", hitDie: 6,
      hpAfterNameLevel: 2, conBonusCutoffLevel: 10,
      primeRequisites: ["dex"], abilityMinimums: { dex: 9 },
      xpPerLevelBeyond20: 220000,
      weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
      nonweaponProficiencies: { initial: 3, levelsPerSlot: 4 },
      nonProficiencyPenalty: -3,
      casterType: null,
      weaponSpecializationAllowed: false,
    });
    expect(THIEF.xpThresholds[1]).toBe(1250);
    expect(THIEF.xpThresholds[9]).toBe(160000);  // level 10
    expect(THIEF.xpThresholds[19]).toBe(2200000); // level 20
  });

  it("every chassis xpThresholds is 20 strictly-increasing non-negative integers starting at 0", () => {
    for (const c of [FIGHTER, MAGE, CLERIC, THIEF]) {
      expect(c.xpThresholds).toHaveLength(20);
      expect(c.xpThresholds[0]).toBe(0);
      for (let i = 1; i < 20; i++) {
        expect(Number.isInteger(c.xpThresholds[i])).toBe(true);
        expect(c.xpThresholds[i]).toBeGreaterThan(c.xpThresholds[i - 1]);
      }
    }
  });
});
