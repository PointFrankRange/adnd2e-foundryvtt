import { describe, expect, it } from "vitest";
import { toWeaponData } from "../../../src/data/derive/weapon";

const longSword = {
  name: "Long Sword",
  category: "melee" as const,
  damageVsSM: "1d8",
  damageVsL: "1d12",
  damageType: "slashing" as const,
  speedFactor: 5,
  weight: 4,
  size: "M" as const,
  rateOfFire: null,
  range: null,
  proficiencyGroup: "swords",
  handsRequired: 1 as const,
};

describe("toWeaponData", () => {
  it("projects a weapon item's fields into the engine WeaponData shape", () => {
    expect(toWeaponData(longSword)).toEqual({
      name: "Long Sword",
      category: "melee",
      damageVsSM: "1d8",
      damageVsL: "1d12",
      damageType: "slashing",
      speedFactor: 5,
      weight: 4,
      size: "M",
      rateOfFire: null,
      range: null,
      proficiencyGroup: "swords",
      handsRequired: 1,
    });
  });
  it("carries a range object through unchanged", () => {
    const bow = { ...longSword, category: "bow" as const, damageVsSM: null, damageVsL: null, damageType: null,
      range: { short: 50, medium: 100, long: 150 }, handsRequired: 2 as const };
    expect(toWeaponData(bow).range).toEqual({ short: 50, medium: 100, long: 150 });
    expect(toWeaponData(bow).damageVsSM).toBeNull();
  });
});
