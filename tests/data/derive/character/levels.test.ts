import { describe, expect, it } from "vitest";
import { deriveClassLevels } from "../../../../src/data/derive/character/levels";
import type { ClassId } from "../../../../src/core/types";

const entry = (chassisId: ClassId, xp: number, hpRolls: number[]) => ({
  chassisId, specialistSchool: null, xp, hpRolls, dualClassState: null, level: 0,
});

describe("deriveClassLevels", () => {
  it("resolves level + canLevelUp per class from XP and hp-roll count", () => {
    expect(deriveClassLevels([entry("fighter", 4000, [8, 6])])).toEqual([
      { chassisId: "fighter", level: 3, canLevelUp: true }, // level 3, only 2 rolls
    ]);
    expect(deriveClassLevels([entry("fighter", 4000, [8, 6, 7])])).toEqual([
      { chassisId: "fighter", level: 3, canLevelUp: false },
    ]);
  });
  it("empty class list -> empty", () => {
    expect(deriveClassLevels([])).toEqual([]);
  });
});
