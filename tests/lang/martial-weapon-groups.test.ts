import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WEAPON_GROUP_IDS } from "../../src/core/martial-arts";

const LANG = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "lang", "en.json"), "utf8"));
const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);

describe("weapon group labels", () => {
  it("every registry group has a label and the sheet strings exist", () => {
    for (const id of WEAPON_GROUP_IDS) expect(typeof lookup(`ADND2E.martialWeaponGroups.${id}`), id).toBe("string");
    for (const k of ["weaponGroups", "learnGroup", "unlearnGroup", "unlearnGroupConfirm", "needsStyleWeapon", "weaponGroupsKnown"])
      expect(typeof lookup(`ADND2E.sheet.martialArts.${k}`), k).toBe("string");
  });
});
