import { describe, expect, it } from "vitest";
import { WEAPON_GROUPS, WEAPON_GROUP_IDS, normalizeWeaponName, offeredGroupIds, weaponGroupIdsFor, weaponGroupLabelKey } from "../../../src/core/martial-arts";

describe("normalizeWeaponName", () => {
  it("lowercases, strips magic bonuses, punctuation and parentheses", () => {
    expect(normalizeWeaponName("Katana +1")).toBe("katana");
    expect(normalizeWeaponName("Long Sword, +2 (flaming)")).toBe("long sword");
    expect(normalizeWeaponName("Footman's Mace")).toBe("footmans mace");
    expect(normalizeWeaponName("Main-gauche")).toBe("main gauche");
  });
});

describe("weaponGroupIdsFor", () => {
  it("finds every group a weapon belongs to (overlaps allowed)", () => {
    expect(weaponGroupIdsFor("Dagger")).toEqual(["fencingBlades", "shortBlades"]);
    expect(weaponGroupIdsFor("Katana +1")).toEqual(["mediumBlades", "orientalBlades"]);
    expect(weaponGroupIdsFor("Sai")).toEqual(["karateWeapons"]);
  });
  it("tries each name given (base name first) and returns nothing for unknown weapons", () => {
    expect(weaponGroupIdsFor("Sword of Doom", "Long Sword")).toEqual(["mediumBlades"]);
    expect(weaponGroupIdsFor("Lasso")).toEqual([]);
    expect(weaponGroupIdsFor("")).toEqual([]);
  });
});

describe("offeredGroupIds", () => {
  it("maps the shipped style names to ids and drops unknown names", () => {
    expect(offeredGroupIds(["Staves", "Fencing Blades", "Oriental Blades", "Medium Blades"])).toEqual(["fencingBlades", "mediumBlades", "orientalBlades", "staves"]);
    expect(offeredGroupIds(["Nonsense"])).toEqual([]);
  });
  it("'Any Tight Group of Melee Weapons' offers every group", () => {
    expect(offeredGroupIds(["Any Tight Group of Melee Weapons"])).toEqual([...WEAPON_GROUP_IDS]);
  });
});

describe("registry shape", () => {
  it("has unique ids and non-empty members, and a label key per id", () => {
    expect(new Set(WEAPON_GROUPS.map((g) => g.id)).size).toBe(WEAPON_GROUPS.length);
    for (const g of WEAPON_GROUPS) expect(g.members.length, g.id).toBeGreaterThan(0);
    expect(weaponGroupLabelKey("staves")).toBe("ADND2E.martialWeaponGroups.staves");
  });
});
