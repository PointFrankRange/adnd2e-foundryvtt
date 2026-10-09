import { describe, expect, it } from "vitest";
import { ITEM_LAYOUTS } from "../../../src/sheets/item-layouts/layouts";
import { OTHER_TITLE_KEY } from "../../../src/sheets/item-layouts/apply";
import LANG from "../../../lang/en.json";

const hasKey = (key: string): boolean =>
  key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), LANG) !== undefined;

const claimed = (type: string): string[] => {
  const l = ITEM_LAYOUTS[type]!;
  return [
    ...(l.strip ?? []).map((e) => (typeof e === "string" ? e : e.path)),
    ...l.panels.flatMap((p) => [...p.paths]),
  ];
};

describe("ITEM_LAYOUTS", () => {
  it("defines exactly the five designed types", () => {
    expect(Object.keys(ITEM_LAYOUTS).sort()).toEqual(["ammo", "armor", "equipment", "spell", "weapon"]);
  });

  for (const type of ["weapon", "armor", "equipment", "ammo", "spell"]) {
    it(`${type}: no path is claimed twice and every path is a system path`, () => {
      const paths = claimed(type);
      expect(new Set(paths).size).toBe(paths.length);
      for (const p of paths) expect(p.startsWith("system."), p).toBe(true);
    });
    it(`${type}: every panel title key exists in en.json`, () => {
      for (const panel of ITEM_LAYOUTS[type]!.panels) expect(hasKey(panel.titleKey), panel.titleKey).toBe(true);
    });
  }

  it("the Other panel title exists in en.json", () => {
    expect(hasKey(OTHER_TITLE_KEY)).toBe(true);
  });

  it("the spell card strip uses badge, chips and pill hints and places the description after the Casting panel", () => {
    const spell = ITEM_LAYOUTS.spell!;
    const displays = Object.fromEntries((spell.strip ?? []).map((e) => (typeof e === "string" ? [e, "field"] : [e.path, e.display])));
    expect(displays["system.level"]).toBe("badge");
    expect(displays["system.schools"]).toBe("chips");
    expect(displays["system.spheres"]).toBe("chips");
    for (const c of ["v", "s", "m"]) expect(displays[`system.components.${c}`]).toBe("pill");
    expect(spell.panels[spell.descriptionAfterPanel!]!.titleKey).toBe("ADND2E.sheets.layout.casting");
  });
});
