import { describe, expect, it } from "vitest";
import { PALADIN, RANGER, DRUID, BARD, FIGHTER, THIEF, MAGE, CLERIC, getChassis } from "../../../src/core/classes/chassis";
import { levelForXp, xpForLevel } from "../../../src/core/classes/progression";
import { primeRequisiteXpBonus } from "../../../src/core/abilities";

describe("new chassis — identity & group", () => {
  it("Paladin", () => {
    expect(PALADIN).toMatchObject({
      id: "paladin", group: "warrior", hitDie: 10,
      primeRequisites: ["str", "cha"],
      abilityMinimums: { str: 12, con: 9, wis: 13, cha: 17 },
      spellProgressionId: "paladin", spellStartLevel: 9, maxLevel: null,
      weaponSpecializationAllowed: false, armorAllowed: "any", nonProficiencyPenalty: -2,
    });
  });
  it("Ranger", () => {
    expect(RANGER).toMatchObject({
      id: "ranger", group: "warrior", hitDie: 10,
      primeRequisites: ["str", "dex", "wis"],
      abilityMinimums: { str: 13, dex: 13, con: 14, wis: 14 },
      spellProgressionId: "ranger", spellStartLevel: 8,
    });
  });
  it("Druid", () => {
    expect(DRUID).toMatchObject({
      id: "druid", group: "priest", hitDie: 8,
      primeRequisites: ["wis", "cha"],
      abilityMinimums: { wis: 12, cha: 15 },
      spellProgressionId: "priest", spellStartLevel: 1, maxLevel: 14,
      weaponsAllowed: { names: ["club", "sickle", "dart", "spear", "dagger", "scimitar", "sling", "staff"] },
      armorAllowed: ["leather"],
    });
  });
  it("Bard", () => {
    expect(BARD).toMatchObject({
      id: "bard", group: "rogue", hitDie: 6,
      primeRequisites: ["dex", "cha"],
      abilityMinimums: { dex: 12, int: 13, cha: 15 },
      spellProgressionId: "bard", spellStartLevel: 2,
      thiefSkillAccess: ["pick-pockets", "climb-walls", "detect-noise", "read-languages"],
      armorAllowed: ["padded", "leather", "studded leather", "ring mail", "brigandine", "scale mail", "hide", "chain mail"],
    });
  });
  it("Druid wears leather only; Bard up to chain mail (PHB pp.35/41)", () => {
    expect(DRUID.armorAllowed).toEqual(["leather"]);
    expect(BARD.armorAllowed).not.toContain("plate mail");
  });
  it("Thief has all eight thieving skills; non-rogues have none", () => {
    expect(getChassis("thief").thiefSkillAccess).toEqual([
      "pick-pockets", "open-locks", "find-remove-traps", "move-silently",
      "hide-in-shadows", "detect-noise", "climb-walls", "read-languages",
    ]);
    expect(getChassis("fighter").thiefSkillAccess).toBeNull();
  });
  it("Mage & Cleric cast from level 1; Fighter & Thief never", () => {
    expect(getChassis("mage").spellStartLevel).toBe(1);
    expect(getChassis("cleric").spellStartLevel).toBe(1);
    expect(getChassis("fighter").spellStartLevel).toBeNull();
    expect(getChassis("thief").spellStartLevel).toBeNull();
  });
  it("getChassis covers all eight ids", () => {
    for (const id of ["fighter", "mage", "cleric", "thief", "paladin", "ranger", "druid", "bard"] as const) {
      expect(getChassis(id).id).toBe(id);
    }
  });
});

describe("new chassis — XP progression", () => {
  it("Paladin/Ranger use the Table 14 Paladin-Ranger column", () => {
    expect(xpForLevel(PALADIN, 2)).toBe(2250);
    expect(xpForLevel(PALADIN, 9)).toBe(300000);
    expect(xpForLevel(RANGER, 2)).toBe(2250);
    expect(levelForXp(PALADIN, 2250)).toBe(2);
    expect(xpForLevel(PALADIN, 21)).toBe(3600000 + 300000);
  });
  it("Druid caps at level 14", () => {
    expect(xpForLevel(DRUID, 14)).toBe(1500000);
    expect(() => xpForLevel(DRUID, 15)).toThrow(RangeError);
    expect(levelForXp(DRUID, 999_000_000)).toBe(14);
  });
  it("Bard uses the Thief/Bard column", () => {
    expect(xpForLevel(BARD, 2)).toBe(1250);
    expect(xpForLevel(BARD, 20)).toBe(2200000);
  });
});

describe("prime-req XP bonus for the new classes", () => {
  it("paladin needs str & cha both 16+", () => {
    expect(primeRequisiteXpBonus(PALADIN.primeRequisites, { str: 16, dex: 10, con: 10, int: 10, wis: 13, cha: 17 })).toBe(true);
    expect(primeRequisiteXpBonus(PALADIN.primeRequisites, { str: 15, dex: 10, con: 10, int: 10, wis: 13, cha: 17 })).toBe(false);
  });
});
