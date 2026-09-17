import { describe, expect, it } from "vitest";
import { toArmorGroup, weaponVsArmorModifier } from "../../src/combat/weapon-vs-armor";
import { ARMOR_TYPES } from "../../src/data/item/choices";
import { DAMAGE_TYPES } from "../../src/data/item/choices";

describe("toArmorGroup", () => {
  it("classifies every one of the 13 real armor types into exactly one of the 4 groups", () => {
    const expected: Record<string, string> = {
      none: "unarmored",
      padded: "padded-leather-studded",
      leather: "padded-leather-studded",
      "studded-leather": "padded-leather-studded",
      "ring-mail": "ring-scale-chain",
      "scale-mail": "ring-scale-chain",
      "chain-mail": "ring-scale-chain",
      "elven-chain": "ring-scale-chain",
      "splint-mail": "splint-banded-plate",
      "banded-mail": "splint-banded-plate",
      "plate-mail": "splint-banded-plate",
      "field-plate": "splint-banded-plate",
      "full-plate": "splint-banded-plate",
    };
    for (const armorType of ARMOR_TYPES) {
      expect(toArmorGroup(armorType)).toBe(expected[armorType]);
    }
  });
});

describe("weaponVsArmorModifier", () => {
  it("is 0 for every damage type against unarmored", () => {
    for (const damageType of DAMAGE_TYPES) {
      expect(weaponVsArmorModifier(damageType, "unarmored")).toBe(0);
    }
  });
  it("slashing worsens against heavier armor groups", () => {
    expect(weaponVsArmorModifier("slashing", "padded-leather-studded")).toBe(0);
    expect(weaponVsArmorModifier("slashing", "ring-scale-chain")).toBe(-1);
    expect(weaponVsArmorModifier("slashing", "splint-banded-plate")).toBe(-2);
  });
  it("piercing is better against light armor, worse against plate", () => {
    expect(weaponVsArmorModifier("piercing", "padded-leather-studded")).toBe(1);
    expect(weaponVsArmorModifier("piercing", "ring-scale-chain")).toBe(0);
    expect(weaponVsArmorModifier("piercing", "splint-banded-plate")).toBe(-1);
  });
  it("bludgeoning is better against heavier armor groups", () => {
    expect(weaponVsArmorModifier("bludgeoning", "padded-leather-studded")).toBe(-1);
    expect(weaponVsArmorModifier("bludgeoning", "ring-scale-chain")).toBe(1);
    expect(weaponVsArmorModifier("bludgeoning", "splint-banded-plate")).toBe(2);
  });
  it("mixed piercing-slashing is mildly worse against heavier armor", () => {
    expect(weaponVsArmorModifier("piercing-slashing", "padded-leather-studded")).toBe(0);
    expect(weaponVsArmorModifier("piercing-slashing", "ring-scale-chain")).toBe(-1);
    expect(weaponVsArmorModifier("piercing-slashing", "splint-banded-plate")).toBe(-1);
  });
  it("mixed piercing-bludgeoning is always neutral", () => {
    expect(weaponVsArmorModifier("piercing-bludgeoning", "padded-leather-studded")).toBe(0);
    expect(weaponVsArmorModifier("piercing-bludgeoning", "ring-scale-chain")).toBe(0);
    expect(weaponVsArmorModifier("piercing-bludgeoning", "splint-banded-plate")).toBe(0);
  });
});
