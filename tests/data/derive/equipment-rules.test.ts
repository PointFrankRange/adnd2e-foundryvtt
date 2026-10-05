import { describe, expect, it } from "vitest";
import { actorEquipmentRules, itemNotPermitted } from "../../../src/data/derive/character/equipment-rules";

const cls = (chassisId: string) => ({ type: "class", system: { chassisId } });
const kit = (chassisId: string, armor: { mode: string; names: string[] }, weapons = { mode: "inherit", names: [] as string[] }) => ({
  id: "k", name: "K", type: "kit",
  system: {
    chassisId,
    qualifications: { abilityMinimums: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, races: [], alignments: [] },
    xpModifierPercent: 0, effects: [], equipment: { armor, weapons }, forbiddenWeaponProficiencies: [], grantedFeatures: [],
  },
});
const armor = (armorType: string, isShield = false) => ({ type: "armor", system: { armorType, isShield } });
const weapon = (name: string, damageType: string | null = null, baseWeaponName = "") => ({ type: "weapon", name, system: { baseWeaponName, damageType } });

describe("actorEquipmentRules / itemNotPermitted", () => {
  it("a classless actor has no restriction", () => {
    const rules = actorEquipmentRules([]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(false);
  });
  it("a mage cannot wear leather, but a kit can extend the rule", () => {
    const plain = actorEquipmentRules([cls("mage")]);
    expect(itemNotPermitted(plain, armor("leather"))).toBe(true);
    const withKit = actorEquipmentRules([cls("mage"), kit("mage", { mode: "extend", names: ["leather"] })]);
    expect(itemNotPermitted(withKit, armor("leather"))).toBe(false);
    expect(itemNotPermitted(withKit, armor("chain-mail"))).toBe(true);
  });
  it("a kit for a class the actor lacks is ignored", () => {
    const rules = actorEquipmentRules([cls("mage"), kit("fighter", { mode: "replace", names: ["plate-mail"] })]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(true);
  });
  it("weapons: cleric blunt rule, and a mage kit extending a name", () => {
    const cleric = actorEquipmentRules([cls("cleric")]);
    expect(itemNotPermitted(cleric, weapon("Mace", "bludgeoning"))).toBe(false);
    expect(itemNotPermitted(cleric, weapon("Long Sword", "slashing"))).toBe(true);
    const mage = actorEquipmentRules([cls("mage"), kit("mage", { mode: "inherit", names: [] }, { mode: "extend", names: ["short sword"] })]);
    expect(itemNotPermitted(mage, weapon("Short Sword"))).toBe(false);
    expect(itemNotPermitted(mage, weapon("Long Sword"))).toBe(true);
  });
  it("multiclass: permitted when any class permits it", () => {
    const rules = actorEquipmentRules([cls("mage"), cls("fighter")]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(false);
  });
  it("only weapons and armor can be not-permitted", () => {
    const rules = actorEquipmentRules([cls("mage")]);
    expect(itemNotPermitted(rules, { type: "equipment", system: {} })).toBe(false);
  });
  it("a class item with an unknown chassis is ignored rather than throwing", () => {
    const rules = actorEquipmentRules([cls("not-a-class")]);
    expect(rules.armor).toEqual([]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(false);
  });
  it("a weapon item with no display name is matched by its base weapon name", () => {
    const rules = actorEquipmentRules([cls("mage")]);
    expect(itemNotPermitted(rules, { type: "weapon", system: { baseWeaponName: "Dagger", damageType: null } })).toBe(false);
    expect(itemNotPermitted(rules, { type: "weapon", system: { baseWeaponName: "", damageType: null } })).toBe(true);
  });
});
