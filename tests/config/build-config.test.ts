import { describe, expect, it } from "vitest";
import { buildAdnd2eConfig } from "../../src/config";

const cfg = buildAdnd2eConfig();

/** Every value in a label map must be an `ADND2E.`-prefixed i18n key. */
function assertLabelMap(map: Readonly<Record<string, string>>): void {
  for (const v of Object.values(map)) expect(v).toMatch(/^ADND2E\./);
}

describe("buildAdnd2eConfig()", () => {
  it("has every documented top-level entry", () => {
    expect(Object.keys(cfg).sort()).toEqual(
      [
        "abilities", "alignments", "classGroups", "creatureIntelligence",
        "currency", "damageTypes", "encumbranceCategories", "movementModes",
        "saves", "schools", "sizes", "spheres", "treasureTypes",
        "weaponProficiencyGroups", "weaponStyleGroups",
      ].sort(),
    );
  });

  it("ability, save and class-group keysets match the engine unions", () => {
    expect(Object.keys(cfg.abilities).sort()).toEqual(["cha", "con", "dex", "int", "str", "wis"]);
    expect(Object.keys(cfg.saves).sort()).toEqual(["bw", "pp", "ppd", "rsw", "spell"]);
    expect(Object.keys(cfg.classGroups).sort()).toEqual(["priest", "rogue", "warrior", "wizard"]);
  });

  it("schools = the 8 specialist schools + lesser-divination + wild", () => {
    expect(Object.keys(cfg.schools).sort()).toEqual(
      [
        "abjuration", "alteration", "conjuration", "divination", "enchantment",
        "illusion", "invocation", "necromancy", "lesser-divination", "wild",
      ].sort(),
    );
  });

  it("spheres has all 16 priest spheres", () => {
    expect(Object.keys(cfg.spheres)).toHaveLength(16);
    expect(cfg.spheres).toHaveProperty("all");
    expect(cfg.spheres).toHaveProperty("necromantic");
  });

  it("encumbranceCategories includes immobile (6 total)", () => {
    expect(Object.keys(cfg.encumbranceCategories).sort()).toEqual(
      ["heavy", "immobile", "light", "moderate", "severe", "unencumbered"],
    );
  });

  it("alignments, sizes, movementModes", () => {
    expect(Object.keys(cfg.alignments)).toHaveLength(9);
    expect(Object.keys(cfg.sizes)).toEqual(
      ["tiny", "small", "medium", "large", "huge", "gargantuan"],
    );
    expect(Object.keys(cfg.movementModes)).toEqual(["land", "burrow", "climb", "fly", "swim"]);
  });

  it("currency carries copper-piece rates (PHB p.69)", () => {
    expect(cfg.currency.cp.inCp).toBe(1);
    expect(cfg.currency.sp.inCp).toBe(10);
    expect(cfg.currency.ep.inCp).toBe(50);
    expect(cfg.currency.gp.inCp).toBe(100);
    expect(cfg.currency.pp.inCp).toBe(500);
    for (const c of Object.values(cfg.currency)) expect(c.label).toMatch(/^ADND2E\./);
  });

  it("weaponProficiencyGroups is reserved (empty) for Combat & Tactics", () => {
    expect(cfg.weaponProficiencyGroups).toEqual({});
  });

  it("creatureIntelligence and treasureTypes are populated label maps", () => {
    expect(Object.keys(cfg.creatureIntelligence)).toHaveLength(11);
    expect(Object.keys(cfg.treasureTypes)).toHaveLength(26);
  });

  it("all remaining entries are ADND2E-prefixed label maps", () => {
    assertLabelMap(cfg.abilities);
    assertLabelMap(cfg.saves);
    assertLabelMap(cfg.classGroups);
    assertLabelMap(cfg.schools);
    assertLabelMap(cfg.spheres);
    assertLabelMap(cfg.alignments);
    assertLabelMap(cfg.sizes);
    assertLabelMap(cfg.damageTypes);
    assertLabelMap(cfg.movementModes);
    assertLabelMap(cfg.encumbranceCategories);
    assertLabelMap(cfg.creatureIntelligence);
    assertLabelMap(cfg.treasureTypes);
    assertLabelMap(cfg.weaponStyleGroups);
  });

  it("the returned object is frozen", () => {
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.abilities)).toBe(true);
  });
});
