import { describe, expect, it } from "vitest";
import manifestJson from "../../system.json";

const manifest = manifestJson as unknown as {
  documentTypes: Record<string, Record<string, unknown>>;
  packFolders: { name: string; sorting: string; color?: string; packs?: string[]; folders?: unknown[] }[];
  packs?: unknown[];
};

describe("system.json documentTypes", () => {
  it("declares the three Actor subtypes", () => {
    expect(Object.keys(manifest.documentTypes.Actor).sort()).toEqual(
      ["character", "creature", "npc"],
    );
  });

  it("declares the nine Item subtypes (camelCase, no hyphens)", () => {
    expect(Object.keys(manifest.documentTypes.Item).sort()).toEqual(
      [
        "armor", "class", "classFeature", "equipment", "nonweaponProficiency",
        "race", "spell", "weapon", "weaponProficiency",
      ].sort(),
    );
    for (const k of Object.keys(manifest.documentTypes.Item)) {
      expect(k).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });

  it("declares the adnd2e ActiveEffect subtype", () => {
    expect(Object.keys(manifest.documentTypes.ActiveEffect)).toEqual(["adnd2e"]);
  });
});

describe("system.json packFolders", () => {
  it("is an array of well-formed folder nodes (packs are assigned in 1c.4a)", () => {
    expect(Array.isArray(manifest.packFolders)).toBe(true);
    expect(manifest.packFolders.length).toBeGreaterThan(0);
    for (const f of manifest.packFolders) {
      expect(typeof f.name).toBe("string");
      expect(f.sorting).toMatch(/^[am]$/);
    }
  });

  it("ships 5 compendium packs in 1c.4a", () => {
    expect(manifest.packs ?? []).toHaveLength(5);
    const names = (manifest.packs ?? []).map((p: unknown) => (p as Record<string, unknown>).name).sort();
    expect(names).toEqual(["classes", "conditions", "nonweapon-proficiencies", "races", "weapon-proficiency-groups"]);
  });
});
