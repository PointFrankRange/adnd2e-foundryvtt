import { describe, expect, it } from "vitest";
import { PSIONICIST, getChassis } from "../../../src/core/classes/chassis";
import { thac0 } from "../../../src/core/classes/thac0";
import { levelForXp, xpForLevel } from "../../../src/core/classes/progression";
import { saveBaseTarget } from "../../../src/core/saves";

describe("Psionicist chassis (PHBR5 Table 2, 7-10)", () => {
  it("identity, requirements and proficiencies", () => {
    expect(getChassis("psionicist")).toBe(PSIONICIST);
    expect(PSIONICIST).toMatchObject({
      id: "psionicist", group: "psionicist", hitDie: 6, hpAfterNameLevel: 2, conBonusCutoffLevel: 9,
      primeRequisites: ["con", "wis"], abilityMinimums: { con: 11, int: 12, wis: 15 },
      weaponProficiencies: { initial: 2, levelsPerSlot: 5 }, nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
      nonProficiencyPenalty: -4, casterType: null, maxLevel: null, thiefSkillAccess: null,
    });
    expect(PSIONICIST.armorAllowed).toEqual(["padded", "leather", "studded leather", "hide"]);
  });
  it("Table 2 experience", () => {
    const want = [0, 2200, 4400, 8800, 16500, 30000, 55000, 100000, 200000, 400000, 600000, 800000, 1000000, 1200000, 1500000, 1800000, 2100000, 2400000, 2700000, 3000000];
    expect(want.map((_, i) => xpForLevel(PSIONICIST, i + 1))).toEqual(want);
    expect(levelForXp(PSIONICIST, 2199)).toBe(1);
    expect(levelForXp(PSIONICIST, 2200)).toBe(2);
    expect(xpForLevel(PSIONICIST, 21)).toBe(3_300_000);
  });
  it("Table 7 THAC0 is the rogue rate", () => {
    const want = [20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11];
    expect(want.map((_, i) => thac0("psionicist", i + 1))).toEqual(want);
  });
  it("Table 8 saves (ppd, rsw, pp, bw, spell) by band", () => {
    const at = (l: number) => (["ppd", "rsw", "pp", "bw", "spell"] as const).map((c) => saveBaseTarget("psionicist", l, c));
    expect(at(1)).toEqual([13, 15, 10, 16, 15]);
    expect(at(4)).toEqual([13, 15, 10, 16, 15]);
    expect(at(5)).toEqual([12, 13, 9, 15, 14]);
    expect(at(9)).toEqual([11, 11, 8, 13, 12]);
    expect(at(13)).toEqual([10, 9, 7, 12, 11]);
    expect(at(17)).toEqual([9, 7, 6, 11, 9]);
    expect(at(21)).toEqual([8, 5, 5, 9, 7]);
  });
});
