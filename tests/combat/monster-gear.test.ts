import { describe, expect, it } from "vitest";
import {
  MONSTER_ITEM_TYPES,
  monsterDropVerdict,
  monsterLauncherAmmo,
  monsterWeaponAttackType,
  monsterWeaponDamageFormula,
  monsterWeaponDamageLabel,
} from "../../src/combat/monster-gear";

const sword = { category: "melee", magicBonus: 0, damageVsSM: "1d8", damageVsL: "1d12" };

describe("monsterDropVerdict", () => {
  it("accepts gear (including ammo as inert loot) and spells", () => {
    expect([...MONSTER_ITEM_TYPES]).toEqual(["weapon", "armor", "equipment", "ammo", "spell"]);
    for (const t of MONSTER_ITEM_TYPES) expect(monsterDropVerdict(t)).toEqual({ ok: true });
  });
  it.each(["class", "race", "weaponProficiency", "nonweaponProficiency", "trait", "kit", "classFeature", "condition", "bogus"])(
    "rejects %s",
    (t) => {
      expect(monsterDropVerdict(t)).toEqual({ ok: false, reason: "ADND2E.sheet.drop.monsterRejects" });
    },
  );
});

describe("monsterWeaponAttackType", () => {
  it("is melee for melee weapons and ranged for thrown, bow and crossbow", () => {
    expect(monsterWeaponAttackType("melee")).toBe("melee");
    expect(monsterWeaponAttackType("thrown")).toBe("ranged");
    expect(monsterWeaponAttackType("bow")).toBe("ranged");
    expect(monsterWeaponAttackType("crossbow")).toBe("ranged");
  });
});

describe("monsterWeaponDamageFormula", () => {
  it("uses the S-M die for small/medium/unknown targets and the L die for large and up", () => {
    expect(monsterWeaponDamageFormula(sword, null)).toBe("1d8");
    expect(monsterWeaponDamageFormula(sword, "medium")).toBe("1d8");
    expect(monsterWeaponDamageFormula(sword, "large")).toBe("1d12");
    expect(monsterWeaponDamageFormula(sword, "gargantuan")).toBe("1d12");
  });
  it("adds the magic bonus", () => {
    expect(monsterWeaponDamageFormula({ ...sword, magicBonus: 2 }, null)).toBe("1d8 + 2");
    expect(monsterWeaponDamageFormula({ ...sword, magicBonus: -1 }, "huge")).toBe("1d12 - 1");
  });
  it("falls back to the other die, or null when neither is modeled", () => {
    expect(monsterWeaponDamageFormula({ ...sword, damageVsL: null }, "large")).toBe("1d8");
    expect(monsterWeaponDamageFormula({ ...sword, damageVsSM: null, damageVsL: null }, null)).toBeNull();
  });
});

describe("monsterWeaponDamageLabel", () => {
  it("shows S-M / L dice and a signed magic bonus", () => {
    expect(monsterWeaponDamageLabel(sword)).toBe("1d8 / 1d12");
    expect(monsterWeaponDamageLabel({ ...sword, magicBonus: 1 })).toBe("1d8 / 1d12 +1");
    expect(monsterWeaponDamageLabel({ ...sword, magicBonus: -2, damageVsL: null })).toBe("1d8 / — -2");
    expect(monsterWeaponDamageLabel({ ...sword, damageVsSM: null, damageVsL: null })).toBe("— / —");
  });
});

describe("monster launchers (#98)", () => {
  const bow = { category: "bow", magicBonus: 1, damageVsSM: null, damageVsL: null };
  const arrows = { id: "a1", ammoType: "arrow", quantity: 5, damageVsSM: "1d6", damageVsL: "1d6" };
  const flight = { id: "a2", ammoType: "arrow", quantity: 3, damageVsSM: "1d8", damageVsL: "1d10" };
  const bolts = { id: "b1", ammoType: "bolt", quantity: 9, damageVsSM: "1d4+2", damageVsL: "1d6+2" };
  const empty = { id: "a3", ammoType: "arrow", quantity: 0, damageVsSM: "2d6", damageVsL: "2d6" };

  it("a launcher with no ammo item rolls no damage dice", () => {
    expect(monsterWeaponDamageFormula(bow, null)).toBeNull();
  });
  it("the ammo's dice replace the weapon's, keeping the weapon's magic bonus and size pick", () => {
    expect(monsterWeaponDamageFormula(bow, "medium", arrows)).toBe("1d6 + 1");
    expect(monsterWeaponDamageFormula(bow, "large", flight)).toBe("1d10 + 1");
  });
  it("picks the selected matching ammo, else the first matching in stock", () => {
    const all = [empty, bolts, arrows, flight];
    expect(monsterLauncherAmmo({ ammoType: "arrow", selectedAmmoId: "a2" }, all)).toBe(flight);
    expect(monsterLauncherAmmo({ ammoType: "arrow", selectedAmmoId: null }, all)).toBe(arrows);
    expect(monsterLauncherAmmo({ ammoType: "arrow", selectedAmmoId: "gone" }, all)).toBe(arrows);
  });
  it("ignores ammo of the wrong type or out of stock, and non-launchers", () => {
    expect(monsterLauncherAmmo({ ammoType: "arrow", selectedAmmoId: null }, [bolts, empty])).toBeNull();
    expect(monsterLauncherAmmo({ ammoType: null, selectedAmmoId: null }, [arrows])).toBeNull();
  });
});
