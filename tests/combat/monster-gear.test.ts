import { describe, expect, it } from "vitest";
import {
  MONSTER_ITEM_TYPES,
  monsterDropVerdict,
  monsterWeaponAttackType,
  monsterWeaponDamageFormula,
  monsterWeaponDamageLabel,
} from "../../src/combat/monster-gear";

const sword = { category: "melee", magicBonus: 0, damageVsSM: "1d8", damageVsL: "1d12" };

describe("monsterDropVerdict", () => {
  it("accepts gear and spells", () => {
    expect([...MONSTER_ITEM_TYPES]).toEqual(["weapon", "armor", "equipment", "spell"]);
    for (const t of MONSTER_ITEM_TYPES) expect(monsterDropVerdict(t)).toEqual({ ok: true });
  });
  it.each(["class", "race", "weaponProficiency", "nonweaponProficiency", "trait", "classFeature", "condition", "bogus"])(
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
