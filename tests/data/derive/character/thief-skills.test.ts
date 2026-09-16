import { describe, expect, it } from "vitest";
import { deriveThiefSkillPoints } from "../../../../src/data/derive/character/thief-skills";

describe("deriveThiefSkillPoints", () => {
  it("returns a full thief budget when a thief class is present", () => {
    const r = deriveThiefSkillPoints([{ chassisId: "thief", level: 3 }], []);
    // thiefSkillPointsAvailable(3) = 60 + 2*30 = 120
    expect(r).toEqual({ total: 120, spent: 0, available: 120 });
  });

  it("returns a bard budget when a bard class is present", () => {
    const r = deriveThiefSkillPoints([{ chassisId: "bard", level: 2 }], []);
    // bardSkillPointsAvailable(2) = 20 + 1*15 = 35
    expect(r).toEqual({ total: 35, spent: 0, available: 35 });
  });

  it("subtracts every allocation's points from available, summed across all skills", () => {
    const r = deriveThiefSkillPoints(
      [{ chassisId: "thief", level: 1 }],
      [
        { skill: "pick-pockets", allocatedPoints: 20 },
        { skill: "open-locks", allocatedPoints: 15 },
      ],
    );
    // thiefSkillPointsAvailable(1) = 60
    expect(r).toEqual({ total: 60, spent: 35, available: 25 });
  });

  it("returns a zeroed block for a class with no thief-skill access", () => {
    const r = deriveThiefSkillPoints([{ chassisId: "fighter", level: 5 }], []);
    expect(r).toEqual({ total: 0, spent: 0, available: 0 });
  });

  it("returns a zeroed block for a class-less actor", () => {
    const r = deriveThiefSkillPoints([], []);
    expect(r).toEqual({ total: 0, spent: 0, available: 0 });
  });

  it("prefers the FIRST thief/bard class found when multiple classes are present (multiclass simplification)", () => {
    const r = deriveThiefSkillPoints(
      [{ chassisId: "fighter", level: 5 }, { chassisId: "thief", level: 5 }],
      [],
    );
    // thiefSkillPointsAvailable(5) = 60 + 4*30 = 180 — the thief entry is found despite not being first
    expect(r.total).toBe(180);
  });
});
