import { describe, expect, it } from "vitest";
import enJson from "../../../lang/en.json";
import { CHOICE_LABEL_MAPS, choiceLabelKey } from "../../../src/sheets/item-layouts/labels";
import { ARMOR_TYPES, DAMAGE_TYPES, WEAPON_CATEGORIES, WEAPON_SIZES, SPELL_SCHOOLS, SPHERE_NAMES } from "../../../src/data/item/choices";

const LANG = enJson as unknown as { ADND2E: Record<string, Record<string, string>> };

describe("choiceLabelKey", () => {
  it("maps the four item enum fields to their label map keys", () => {
    expect(choiceLabelKey("system.armorType", "chain-mail")).toBe("ADND2E.armorTypes.chain-mail");
    expect(choiceLabelKey("system.damageType", "piercing-slashing")).toBe("ADND2E.weaponDamageTypes.piercing-slashing");
    expect(choiceLabelKey("system.category", "bow")).toBe("ADND2E.weaponCategories.bow");
    expect(choiceLabelKey("system.size", "M")).toBe("ADND2E.weaponSizes.M");
    expect(choiceLabelKey("system.spheres", "healing")).toBe("ADND2E.spheres.healing");
  });
  it("returns null for any unmapped path", () => {
    expect(choiceLabelKey("system.casterClass", "wizard")).toBeNull();
    expect(choiceLabelKey("name", "x")).toBeNull();
  });
});

describe("label map copy", () => {
  const cases: [string, readonly string[]][] = [
    ["armorTypes", ARMOR_TYPES], ["weaponDamageTypes", DAMAGE_TYPES],
    ["weaponCategories", WEAPON_CATEGORIES], ["weaponSizes", WEAPON_SIZES],
    ["schools", SPELL_SCHOOLS], ["spheres", SPHERE_NAMES],
  ];
  for (const [map, values] of cases) {
    it(`${map} has an en.json label for every enum value`, () => {
      expect(Object.values(CHOICE_LABEL_MAPS)).toContain(map);
      for (const v of values) expect(LANG.ADND2E[map]?.[v], `${map}.${v}`).toBeTruthy();
    });
  }
});
