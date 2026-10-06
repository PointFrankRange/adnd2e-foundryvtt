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

  it("deriveClassLevels honors a class entry's level limit and beyond-limit multiplier (SP13)", () => {
    const entry = { chassisId: "fighter" as const, specialistSchool: null, xp: 5_000_000, hpRolls: [] as number[], dualClassState: null, level: 1 };
    expect(deriveClassLevels([entry])[0]!.level).toBeGreaterThan(15);
    expect(deriveClassLevels([{ ...entry, levelLimit: 15, beyondMultiplier: 0 }])[0]).toMatchObject({ level: 15, canLevelUp: true });
    expect(deriveClassLevels([{ ...entry, xp: 2_250_000, levelLimit: 15, beyondMultiplier: 2 }])[0]!.level).toBe(16);
    expect(deriveClassLevels([{ ...entry, hpRolls: new Array(15).fill(5), levelLimit: 15, beyondMultiplier: 0 }])[0]!.canLevelUp).toBe(false);
  });
});
