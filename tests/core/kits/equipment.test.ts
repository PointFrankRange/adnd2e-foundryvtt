import { describe, expect, it } from "vitest";
import {
  ARMOR_TYPE_IDS, armorPermitted, armorPermittedByAny, baseArmorRule, baseWeaponRule, resolveArmorRule,
  resolveWeaponRule, weaponPermitted, weaponPermittedByAny,
} from "../../../src/core/kits";
import { getChassis } from "../../../src/core/classes/chassis";
import { ARMOR_TYPES, CLASS_IDS } from "../../../src/data/item/choices";

describe("ARMOR_TYPE_IDS", () => {
  it("equals the item schema's ARMOR_TYPES", () => {
    expect([...ARMOR_TYPE_IDS]).toEqual([...ARMOR_TYPES]);
  });
});

describe("chassis restriction data normalizes", () => {
  it("every armor name maps to an item armor type except the two the item schema has no id for", () => {
    const unmapped = CLASS_IDS.flatMap((id) => baseArmorRule(getChassis(id).armorAllowed).unmapped);
    expect([...new Set(unmapped)].sort()).toEqual(["brigandine", "hide"]);
  });
  it("every weapon category is the one the normalizer understands (blunt)", () => {
    for (const id of CLASS_IDS) {
      const allowed = getChassis(id).weaponsAllowed;
      expect(baseWeaponRule(allowed).unmappedCategories, id).toEqual([]);
    }
  });
});

describe("baseArmorRule / armorPermitted", () => {
  it("any permits everything", () => {
    const { rule } = baseArmorRule("any");
    expect(armorPermitted(rule, { armorType: "full-plate", isShield: false })).toBe(true);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(true);
  });
  it("none permits no armor and no shield, but bare skin (type none) is fine", () => {
    const { rule } = baseArmorRule("none");
    expect(armorPermitted(rule, { armorType: "leather", isShield: false })).toBe(false);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(false);
    expect(armorPermitted(rule, { armorType: "none", isShield: false })).toBe(true);
  });
  it("a name list maps names to ids (studded leather, elven chain) and ignores unknown names", () => {
    const { rule, unmapped } = baseArmorRule(["leather", "studded leather", "padded", "elven chain", "hide"]);
    expect(unmapped).toEqual(["hide"]);
    expect(armorPermitted(rule, { armorType: "studded-leather", isShield: false })).toBe(true);
    expect(armorPermitted(rule, { armorType: "elven-chain", isShield: false })).toBe(true);
    expect(armorPermitted(rule, { armorType: "chain-mail", isShield: false })).toBe(false);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(false);
  });
  it('"shield" in a list permits shields', () => {
    const { rule } = baseArmorRule(["leather", "shield"]);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(true);
  });
});

describe("baseWeaponRule / weaponPermitted", () => {
  const mage = baseWeaponRule({ names: ["dagger", "staff"] }).rule;
  const blunt = baseWeaponRule({ categories: ["blunt"] }).rule;
  it("matches a name case-insensitively, preferring the base weapon name", () => {
    expect(weaponPermitted(mage, { name: "Dagger", baseWeaponName: "", damageType: "piercing" })).toBe(true);
    expect(weaponPermitted(mage, { name: "Frostbite", baseWeaponName: "Dagger", damageType: "piercing" })).toBe(true);
    expect(weaponPermitted(mage, { name: "Long Sword", baseWeaponName: "", damageType: "slashing" })).toBe(false);
  });
  it("blunt permits any bludgeoning or piercing-bludgeoning weapon", () => {
    expect(weaponPermitted(blunt, { name: "Mace", baseWeaponName: "", damageType: "bludgeoning" })).toBe(true);
    expect(weaponPermitted(blunt, { name: "Flail", baseWeaponName: "", damageType: "piercing-bludgeoning" })).toBe(true);
    expect(weaponPermitted(blunt, { name: "Sword", baseWeaponName: "", damageType: "slashing" })).toBe(false);
    expect(weaponPermitted(blunt, { name: "Rock", baseWeaponName: "", damageType: null })).toBe(false);
  });
  it("any permits everything", () => {
    expect(weaponPermitted(baseWeaponRule("any").rule, { name: "x", baseWeaponName: "", damageType: null })).toBe(true);
  });
});

describe("kit overrides", () => {
  const mageArmor = baseArmorRule("none").rule;
  it("inherit keeps the base rule", () => {
    expect(resolveArmorRule(mageArmor, { mode: "inherit", names: ["leather"] })).toBe(mageArmor);
  });
  it("replace swaps the rule, even from any", () => {
    const r = resolveArmorRule(baseArmorRule("any").rule, { mode: "replace", names: ["leather"] });
    expect(armorPermitted(r, { armorType: "leather", isShield: false })).toBe(true);
    expect(armorPermitted(r, { armorType: "chain-mail", isShield: false })).toBe(false);
  });
  it("extend adds to a restricted base and leaves any alone", () => {
    const r = resolveArmorRule(mageArmor, { mode: "extend", names: ["leather"] });
    expect(armorPermitted(r, { armorType: "leather", isShield: false })).toBe(true);
    const any = baseArmorRule("any").rule;
    expect(resolveArmorRule(any, { mode: "extend", names: ["leather"] })).toBe(any);
  });
  it("weapon extend unions names and the blunt flag", () => {
    const base = baseWeaponRule({ names: ["dagger"] }).rule;
    const r = resolveWeaponRule(base, { mode: "extend", names: ["Short Sword", "blunt"] });
    expect(weaponPermitted(r, { name: "Dagger", baseWeaponName: "", damageType: null })).toBe(true);
    expect(weaponPermitted(r, { name: "Short Sword", baseWeaponName: "", damageType: null })).toBe(true);
    expect(weaponPermitted(r, { name: "Mace", baseWeaponName: "", damageType: "bludgeoning" })).toBe(true);
  });
});

describe("permittedByAny (multiclass)", () => {
  const cleric = baseArmorRule("any").rule;
  const mage = baseArmorRule("none").rule;
  it("no classes means no restriction", () => {
    expect(armorPermittedByAny([], { armorType: "plate-mail", isShield: false })).toBe(true);
    expect(weaponPermittedByAny([], { name: "x", baseWeaponName: "", damageType: null })).toBe(true);
  });
  it("is permitted if any class permits it", () => {
    expect(armorPermittedByAny([mage, cleric], { armorType: "plate-mail", isShield: false })).toBe(true);
    expect(armorPermittedByAny([mage], { armorType: "plate-mail", isShield: false })).toBe(false);
  });
});
