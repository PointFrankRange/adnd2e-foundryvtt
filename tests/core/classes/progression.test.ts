import { describe, expect, it } from "vitest";
import {
  levelForXp, xpForLevel, hitDice, warriorAttacksPerRound,
  weaponProficiencySlots, nonweaponProficiencySlots,
} from "../../../src/core/classes/progression";
import { FIGHTER, MAGE, CLERIC, THIEF } from "../../../src/core/classes/chassis";
import type { ClassChassis } from "../../../src/core/types";

const CAPPED: ClassChassis = {
  ...CLERIC,
  maxLevel: 14,
  // 14 real thresholds (arbitrary ascending values for the test)
  xpThresholds: [0, 2000, 4000, 7500, 12500, 20000, 35000, 60000, 90000, 125000, 200000, 300000, 750000, 1500000],
  xpPerLevelBeyond20: 0,
};

const UNCAPPED_FLAT: ClassChassis = {
  ...CLERIC,
  maxLevel: null,
  xpThresholds: [0, 2000, 4000, 7500, 12500, 20000, 35000, 60000, 90000, 125000, 200000, 300000, 750000, 1500000],
  xpPerLevelBeyond20: 0,
};

describe("levelForXp", () => {
  it("0 XP is level 1", () => {
    expect(levelForXp(FIGHTER, 0)).toBe(1);
  });
  it("exact thresholds and just-below", () => {
    expect(levelForXp(FIGHTER, 2000)).toBe(2);
    expect(levelForXp(FIGHTER, 1999)).toBe(1);
    expect(levelForXp(FIGHTER, 249999)).toBe(8);
    expect(levelForXp(FIGHTER, 250000)).toBe(9);
    expect(levelForXp(MAGE, 250000)).toBe(10);
    expect(levelForXp(CLERIC, 224999)).toBe(8);
    expect(levelForXp(THIEF, 160000)).toBe(10);
  });
  it("level 20 threshold and beyond (extrapolation)", () => {
    expect(levelForXp(FIGHTER, 3000000)).toBe(20);
    expect(levelForXp(FIGHTER, 3250000)).toBe(21); // +250000
    expect(levelForXp(FIGHTER, 3499999)).toBe(21);
    expect(levelForXp(FIGHTER, 3500000)).toBe(22);
    expect(levelForXp(MAGE, 3750000 + 375000 * 3)).toBe(23);
    expect(levelForXp(CLERIC, 2700000 + 225000)).toBe(21);
  });
  it("rejects invalid xp", () => {
    expect(() => levelForXp(FIGHTER, -1)).toThrow(RangeError);
    expect(() => levelForXp(FIGHTER, 10.5)).toThrow(RangeError);
  });
});

describe("xpForLevel", () => {
  it("table levels", () => {
    expect(xpForLevel(FIGHTER, 1)).toBe(0);
    expect(xpForLevel(FIGHTER, 2)).toBe(2000);
    expect(xpForLevel(FIGHTER, 20)).toBe(3000000);
    expect(xpForLevel(MAGE, 10)).toBe(250000);
  });
  it("beyond 20", () => {
    expect(xpForLevel(FIGHTER, 21)).toBe(3250000);
    expect(xpForLevel(FIGHTER, 25)).toBe(3000000 + 250000 * 5);
    expect(xpForLevel(THIEF, 22)).toBe(2200000 + 220000 * 2);
  });
  it("throws past the table when there is no beyond-20 rate", () => {
    expect(xpForLevel(UNCAPPED_FLAT, 14)).toBe(1500000);
    expect(() => xpForLevel(UNCAPPED_FLAT, 15)).toThrow(RangeError);
  });
  it("round-trips with levelForXp", () => {
    for (const lvl of [1, 5, 9, 13, 20, 21, 30]) {
      expect(levelForXp(FIGHTER, xpForLevel(FIGHTER, lvl))).toBe(lvl);
    }
  });
  it("rejects invalid level", () => {
    expect(() => xpForLevel(FIGHTER, 0)).toThrow(RangeError);
    expect(() => xpForLevel(FIGHTER, 2.5)).toThrow(RangeError);
  });
});

describe("hitDice", () => {
  it("below/at the cutoff: full dice, no bonus", () => {
    expect(hitDice(FIGHTER, 1)).toEqual({ count: 1, dieType: 10, bonus: 0 });
    expect(hitDice(FIGHTER, 9)).toEqual({ count: 9, dieType: 10, bonus: 0 });
    expect(hitDice(MAGE, 10)).toEqual({ count: 10, dieType: 4, bonus: 0 });
  });
  it("above the cutoff: capped dice + flat bonus", () => {
    expect(hitDice(FIGHTER, 10)).toEqual({ count: 9, dieType: 10, bonus: 3 });   // 9+3
    expect(hitDice(FIGHTER, 12)).toEqual({ count: 9, dieType: 10, bonus: 9 });   // 9+9
    expect(hitDice(FIGHTER, 20)).toEqual({ count: 9, dieType: 10, bonus: 33 });  // 9+33
    expect(hitDice(MAGE, 11)).toEqual({ count: 10, dieType: 4, bonus: 1 });      // 10+1
    expect(hitDice(MAGE, 20)).toEqual({ count: 10, dieType: 4, bonus: 10 });     // 10+10
    expect(hitDice(CLERIC, 10)).toEqual({ count: 9, dieType: 8, bonus: 2 });     // 9+2
    expect(hitDice(CLERIC, 20)).toEqual({ count: 9, dieType: 8, bonus: 22 });    // 9+22
    expect(hitDice(THIEF, 11)).toEqual({ count: 10, dieType: 6, bonus: 2 });     // 10+2
    expect(hitDice(THIEF, 20)).toEqual({ count: 10, dieType: 6, bonus: 20 });    // 10+20
  });
  it("rejects invalid level", () => {
    expect(() => hitDice(FIGHTER, 0)).toThrow(RangeError);
  });
});

describe("warriorAttacksPerRound", () => {
  it("PHB Table 15 bands", () => {
    expect(warriorAttacksPerRound(1)).toEqual({ attacks: 1, rounds: 1 });
    expect(warriorAttacksPerRound(6)).toEqual({ attacks: 1, rounds: 1 });
    expect(warriorAttacksPerRound(7)).toEqual({ attacks: 3, rounds: 2 });
    expect(warriorAttacksPerRound(12)).toEqual({ attacks: 3, rounds: 2 });
    expect(warriorAttacksPerRound(13)).toEqual({ attacks: 2, rounds: 1 });
    expect(warriorAttacksPerRound(30)).toEqual({ attacks: 2, rounds: 1 });
  });
  it("rejects invalid level", () => {
    expect(() => warriorAttacksPerRound(0)).toThrow(RangeError);
  });
});

describe("proficiency slots", () => {
  it("weapon slots — Table 34 gain rate", () => {
    expect(weaponProficiencySlots(FIGHTER, 1)).toBe(4);
    expect(weaponProficiencySlots(FIGHTER, 2)).toBe(4);
    expect(weaponProficiencySlots(FIGHTER, 3)).toBe(5);
    expect(weaponProficiencySlots(FIGHTER, 6)).toBe(6);
    expect(weaponProficiencySlots(FIGHTER, 9)).toBe(7);
    expect(weaponProficiencySlots(MAGE, 1)).toBe(1);
    expect(weaponProficiencySlots(MAGE, 6)).toBe(2);
    expect(weaponProficiencySlots(MAGE, 12)).toBe(3);
    expect(weaponProficiencySlots(CLERIC, 4)).toBe(3);
    expect(weaponProficiencySlots(THIEF, 4)).toBe(3);
    expect(weaponProficiencySlots(THIEF, 8)).toBe(4);
  });
  it("nonweapon slots", () => {
    expect(nonweaponProficiencySlots(FIGHTER, 1)).toBe(3);
    expect(nonweaponProficiencySlots(FIGHTER, 3)).toBe(4);
    expect(nonweaponProficiencySlots(MAGE, 1)).toBe(4);
    expect(nonweaponProficiencySlots(MAGE, 3)).toBe(5);
    expect(nonweaponProficiencySlots(THIEF, 4)).toBe(4);
    expect(nonweaponProficiencySlots(THIEF, 8)).toBe(5);
  });
  it("rejects invalid level", () => {
    expect(() => weaponProficiencySlots(FIGHTER, 0)).toThrow(RangeError);
    expect(() => nonweaponProficiencySlots(FIGHTER, -1)).toThrow(RangeError);
  });
});

describe("progression with a maxLevel cap", () => {
  it("levelForXp never exceeds maxLevel", () => {
    expect(levelForXp(CAPPED, 1500000)).toBe(14);
    expect(levelForXp(CAPPED, 99_000_000)).toBe(14);
    expect(levelForXp(CAPPED, 90000)).toBe(9);
  });
  it("xpForLevel throws past the cap", () => {
    expect(xpForLevel(CAPPED, 14)).toBe(1500000);
    expect(() => xpForLevel(CAPPED, 15)).toThrow(RangeError);
  });
});
