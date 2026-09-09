import { describe, expect, it } from "vitest";
import { deriveProficiencySlots } from "../../../../src/data/derive/character/proficiencies";

describe("deriveProficiencySlots", () => {
  it("fighter L7: weapon/nonweapon totals from Table 34, minus spent", () => {
    // fighter weaponProficiencies {initial:4, levelsPerSlot:3}: 4 + floor(7/3) = 6
    // fighter nonweaponProficiencies {initial:3, levelsPerSlot:3}: 3 + floor(7/3) = 5
    const r = deriveProficiencySlots("fighter", 7, 0, 2, 1);
    expect(r.weapon).toEqual({ total: 6, spent: 2, available: 4 });
    expect(r.nonweapon).toEqual({ total: 5, spent: 1, available: 4 });
    expect(r.languagesMax).toBe(0);
  });
  it("INT bonus languages add to languagesMax", () => {
    expect(deriveProficiencySlots("mage", 1, 4, 0, 0).languagesMax).toBe(4);
  });
});
