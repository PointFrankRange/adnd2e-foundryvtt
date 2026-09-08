import { describe, expect, it } from "vitest";
import type { SphereName } from "../../../src/core/types";
import {
  WIZARD_SPELL_PROGRESSION,
  PRIEST_SPELL_PROGRESSION,
  PRIEST_SPHERES,
  CLERIC_SPHERE_ACCESS,
  SPECIALIST_SCHOOLS,
  PALADIN_SPELL_PROGRESSION,
  RANGER_SPELL_PROGRESSION,
  BARD_SPELL_PROGRESSION,
  DRUID_SPHERE_ACCESS,
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
  it("carries the Table 22 minimum ability (keyed by coarse school)", () => {
    expect(SPECIALIST_SCHOOLS.illusion.minAbility).toEqual({ ability: "dex", score: 16 }); // Illusionist
    expect(SPECIALIST_SCHOOLS.abjuration.minAbility).toEqual({ ability: "wis", score: 15 }); // Abjurer
    expect(SPECIALIST_SCHOOLS.alteration.minAbility).toEqual({ ability: "dex", score: 15 }); // Transmuter
    expect(SPECIALIST_SCHOOLS.invocation.minAbility).toEqual({ ability: "con", score: 16 }); // Invoker
  });
});

describe("PALADIN_SPELL_PROGRESSION (PHB Table 17)", () => {
  it("12 rows (level 9-20) of 4 columns", () => {
    expect(PALADIN_SPELL_PROGRESSION).toHaveLength(12);
    for (const row of PALADIN_SPELL_PROGRESSION) expect(row).toHaveLength(4);
  });
  it("spot-checks", () => {
    expect(PALADIN_SPELL_PROGRESSION[0]).toEqual([1, 0, 0, 0]); // L9
    expect(PALADIN_SPELL_PROGRESSION[6]).toEqual([3, 2, 1, 1]); // L15
    expect(PALADIN_SPELL_PROGRESSION[11]).toEqual([3, 3, 3, 3]); // L20
  });
});

describe("RANGER_SPELL_PROGRESSION (PHB Table 18)", () => {
  it("16 rows (level 1-16) of 3 columns", () => {
    expect(RANGER_SPELL_PROGRESSION).toHaveLength(16);
    for (const row of RANGER_SPELL_PROGRESSION) expect(row).toHaveLength(3);
  });
  it("spot-checks", () => {
    expect(RANGER_SPELL_PROGRESSION[6]).toEqual([0, 0, 0]); // L7 — none yet
    expect(RANGER_SPELL_PROGRESSION[7]).toEqual([1, 0, 0]); // L8
    expect(RANGER_SPELL_PROGRESSION[15]).toEqual([3, 3, 3]); // L16
  });
});

describe("BARD_SPELL_PROGRESSION (PHB Table 32)", () => {
  it("20 rows of 6 columns", () => {
    expect(BARD_SPELL_PROGRESSION).toHaveLength(20);
    for (const row of BARD_SPELL_PROGRESSION) expect(row).toHaveLength(6);
  });
  it("spot-checks", () => {
    expect(BARD_SPELL_PROGRESSION[0]).toEqual([0, 0, 0, 0, 0, 0]); // L1
    expect(BARD_SPELL_PROGRESSION[1]).toEqual([1, 0, 0, 0, 0, 0]); // L2
    expect(BARD_SPELL_PROGRESSION[15]).toEqual([4, 3, 3, 3, 2, 1]); // L16
    expect(BARD_SPELL_PROGRESSION[19]).toEqual([4, 4, 4, 4, 4, 3]); // L20
  });
});

describe("DRUID_SPHERE_ACCESS (PHB p.35)", () => {
  it("major to nature spheres, minor to divination", () => {
    expect(DRUID_SPHERE_ACCESS.all).toBe("major");
    expect(DRUID_SPHERE_ACCESS.animal).toBe("major");
    expect(DRUID_SPHERE_ACCESS.elemental).toBe("major");
    expect(DRUID_SPHERE_ACCESS.healing).toBe("major");
    expect(DRUID_SPHERE_ACCESS.plant).toBe("major");
    expect(DRUID_SPHERE_ACCESS.weather).toBe("major");
    expect(DRUID_SPHERE_ACCESS.divination).toBe("minor");
    expect(DRUID_SPHERE_ACCESS.combat ?? "none").toBe("none");
  });
});
