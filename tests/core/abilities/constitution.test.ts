import { describe, expect, it } from "vitest";
import { constitution } from "../../../src/core/abilities/constitution";

describe("constitution()", () => {
  it("low scores", () => {
    expect(constitution(1, false)).toEqual({ hpAdjustment: -3, systemShock: 25, resurrectionSurvival: 30, poisonSave: -2, regeneration: "Nil", hitDieMinimumRoll: 1 });
    expect(constitution(3, false)).toMatchObject({ hpAdjustment: -2, poisonSave: 0 });
    expect(constitution(6, false)).toMatchObject({ hpAdjustment: -1, systemShock: 50 });
  });
  it("no adjustment band 7-14", () => {
    expect(constitution(7, false)).toMatchObject({ hpAdjustment: 0, systemShock: 55, resurrectionSurvival: 60 });
    expect(constitution(14, false)).toMatchObject({ hpAdjustment: 0, systemShock: 88, resurrectionSurvival: 92 });
  });
  it("15-16 same for all", () => {
    expect(constitution(15, false)).toMatchObject({ hpAdjustment: 1, systemShock: 90 });
    expect(constitution(16, true)).toMatchObject({ hpAdjustment: 2, systemShock: 95 });
  });
  it("warrior vs non-warrior at 17-19", () => {
    expect(constitution(17, false).hpAdjustment).toBe(2);
    expect(constitution(17, true).hpAdjustment).toBe(3);
    expect(constitution(18, false).hpAdjustment).toBe(2);
    expect(constitution(18, true).hpAdjustment).toBe(4);
    expect(constitution(19, false).hpAdjustment).toBe(2);
    expect(constitution(19, true).hpAdjustment).toBe(5);
  });
  it("exceptional CON: poison save, regeneration, HD minimum", () => {
    expect(constitution(19, false)).toMatchObject({ poisonSave: 1, regeneration: "Nil", hitDieMinimumRoll: 1 });
    expect(constitution(20, false)).toMatchObject({ poisonSave: 1, regeneration: "1/6 turns", hitDieMinimumRoll: 2 });
    expect(constitution(21, false)).toMatchObject({ poisonSave: 2, regeneration: "1/5 turns", hitDieMinimumRoll: 3 });
    expect(constitution(22, true).hpAdjustment).toBe(6);
    expect(constitution(23, false)).toMatchObject({ poisonSave: 3, regeneration: "1/3 turns", hitDieMinimumRoll: 4 });
    expect(constitution(24, true)).toMatchObject({ hpAdjustment: 7, regeneration: "1/2 turns" });
    expect(constitution(25, false)).toMatchObject({ hpAdjustment: 2, systemShock: 100, resurrectionSurvival: 100, poisonSave: 4, regeneration: "1/1 turn", hitDieMinimumRoll: 4 });
    expect(constitution(25, true).hpAdjustment).toBe(7);
  });
  it("rejects invalid", () => {
    expect(() => constitution(0, false)).toThrow(RangeError);
  });
});
