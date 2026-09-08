import { describe, expect, it } from "vitest";
import { resolveWeaponAttackInputs, selectDamageDice } from "../../../src/core/weapons/attack-inputs";

const strong = { strengthHitProb: 1, strengthDamageAdj: 3, dexterityMissileAttackAdj: 2 };
const weak = { strengthHitProb: -2, strengthDamageAdj: -1, dexterityMissileAttackAdj: 0 };

describe("resolveWeaponAttackInputs()", () => {
  it("melee: Strength hit + Strength damage, no Dexterity", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "melee" })).toEqual({
      strengthHitAdj: 1, dexterityMissileAdj: 0, strengthDamageAdj: 3,
    });
  });
  it("thrown: Strength hit + Strength damage + Dexterity missile", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "thrown" })).toEqual({
      strengthHitAdj: 1, dexterityMissileAdj: 2, strengthDamageAdj: 3,
    });
  });
  it("fired bow: Dexterity missile only; no Strength damage; Strength bonus withheld", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "fired" })).toEqual({
      strengthHitAdj: 0, dexterityMissileAdj: 2, strengthDamageAdj: 0,
    });
  });
  it("fired bow: a Strength penalty still applies", () => {
    expect(resolveWeaponAttackInputs(weak, { attackMode: "fired" })).toEqual({
      strengthHitAdj: -2, dexterityMissileAdj: 0, strengthDamageAdj: 0,
    });
  });
  it("fired strength-bow: the Strength bonus applies", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "fired", strengthBow: true }).strengthHitAdj).toBe(1);
  });
  it("fired crossbow: neither Strength bonus nor penalty", () => {
    expect(resolveWeaponAttackInputs(weak, { attackMode: "fired", isCrossbow: true }).strengthHitAdj).toBe(0);
  });
});

describe("selectDamageDice()", () => {
  it("picks the vs-L column for large targets, vs-S/M otherwise", () => {
    const w = { damageVsSM: "1d8", damageVsL: "2d6" };
    expect(selectDamageDice(w, "L")).toBe("2d6");
    expect(selectDamageDice(w, "M")).toBe("1d8");
    expect(selectDamageDice(w, "S")).toBe("1d8");
  });
});
