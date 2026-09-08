import { describe, expect, it } from "vitest";
import type { SphereName } from "../../../src/core/types";
import {
  WIZARD_SPELL_PROGRESSION,
  PRIEST_SPELL_PROGRESSION,
  PRIEST_SPHERES,
  CLERIC_SPHERE_ACCESS,
  SPECIALIST_SCHOOLS,
} from "../../../src/core/magic/tables";

describe("WIZARD_SPELL_PROGRESSION (PHB Table 21)", () => {
  it("has 20 rows of 9 columns", () => {
    expect(WIZARD_SPELL_PROGRESSION).toHaveLength(20);
    for (const row of WIZARD_SPELL_PROGRESSION) expect(row).toHaveLength(9);
  });
  it("matches PHB spot-check cells", () => {
    expect(WIZARD_SPELL_PROGRESSION[0]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]); // L1
    expect(WIZARD_SPELL_PROGRESSION[4]).toEqual([4, 2, 1, 0, 0, 0, 0, 0, 0]); // L5
    expect(WIZARD_SPELL_PROGRESSION[11]).toEqual([4, 4, 4, 4, 4, 1, 0, 0, 0]); // L12 — first 6th
    expect(WIZARD_SPELL_PROGRESSION[17]).toEqual([5, 5, 5, 5, 5, 3, 3, 2, 1]); // L18 — first 9th
    expect(WIZARD_SPELL_PROGRESSION[19]).toEqual([5, 5, 5, 5, 5, 4, 3, 3, 2]); // L20
  });
});

describe("PRIEST_SPELL_PROGRESSION (PHB Table 24)", () => {
  it("has 20 rows of 7 columns", () => {
    expect(PRIEST_SPELL_PROGRESSION).toHaveLength(20);
    for (const row of PRIEST_SPELL_PROGRESSION) expect(row).toHaveLength(7);
  });
  it("matches PHB spot-check cells", () => {
    expect(PRIEST_SPELL_PROGRESSION[0]).toEqual([1, 0, 0, 0, 0, 0, 0]); // L1
    expect(PRIEST_SPELL_PROGRESSION[4]).toEqual([3, 3, 1, 0, 0, 0, 0]); // L5 — first 3rd
    expect(PRIEST_SPELL_PROGRESSION[10]).toEqual([5, 4, 4, 3, 2, 1, 0]); // L11 — first 6th
    expect(PRIEST_SPELL_PROGRESSION[13]).toEqual([6, 6, 6, 5, 3, 2, 1]); // L14 — first 7th
    expect(PRIEST_SPELL_PROGRESSION[19]).toEqual([9, 9, 9, 8, 7, 5, 2]); // L20
  });
});

describe("PRIEST_SPHERES", () => {
  it("lists all 16 spheres", () => {
    expect(PRIEST_SPHERES).toHaveLength(16);
    expect(PRIEST_SPHERES).toContain("all");
    expect(PRIEST_SPHERES).toContain("necromantic");
    expect(PRIEST_SPHERES).toContain("weather");
  });

  it("PRIEST_SPHERES covers exactly the SphereName union", () => {
    // adding a SphereName member without updating this sentinel is a compile error
    const sentinel: Record<SphereName, true> = {
      all: true,
      animal: true,
      astral: true,
      charm: true,
      combat: true,
      creation: true,
      divination: true,
      elemental: true,
      guardian: true,
      healing: true,
      necromantic: true,
      plant: true,
      protection: true,
      summoning: true,
      sun: true,
      weather: true,
    };
    expect(new Set(PRIEST_SPHERES)).toEqual(new Set(Object.keys(sentinel)));
  });
});

describe("CLERIC_SPHERE_ACCESS (PHB p.33)", () => {
  it("is major everywhere except plant/animal/weather/elemental", () => {
    expect(CLERIC_SPHERE_ACCESS.all).toBe("major");
    expect(CLERIC_SPHERE_ACCESS.healing).toBe("major");
    expect(CLERIC_SPHERE_ACCESS.elemental).toBe("minor");
    expect(CLERIC_SPHERE_ACCESS.animal).toBe("none");
    expect(CLERIC_SPHERE_ACCESS.plant).toBe("none");
    expect(CLERIC_SPHERE_ACCESS.weather).toBe("none");
  });
});

describe("SPECIALIST_SCHOOLS (PHB Table 22)", () => {
  it("has 8 schools, each opposing itself never", () => {
    expect(Object.keys(SPECIALIST_SCHOOLS)).toHaveLength(8);
    for (const [key, profile] of Object.entries(SPECIALIST_SCHOOLS)) {
      expect(profile.school).toBe(key);
      expect(profile.opposition).not.toContain(key);
    }
  });
  it("matches PHB opposition rows", () => {
    expect(SPECIALIST_SCHOOLS.illusion.opposition).toEqual([
      "necromancy",
      "invocation",
      "abjuration",
    ]);
    expect(SPECIALIST_SCHOOLS.divination.opposition).toEqual(["conjuration"]);
    expect(SPECIALIST_SCHOOLS.necromancy.opposition).toEqual(["illusion", "enchantment"]);
  });
});
