import { describe, expect, it } from "vitest";
import { strength } from "../../../src/core/abilities/strength";

describe("strength()", () => {
  it("score 1 (weakest)", () => {
    expect(strength(1)).toEqual({
      hitProb: -5, damageAdj: -4, weightAllowance: 1, maxPress: 3,
      openDoors: 1, openDoorsMagical: null, bendBarsLiftGates: 0,
    });
  });

  it("mid ranges use the band the score falls in", () => {
    expect(strength(5)).toMatchObject({ hitProb: -2, damageAdj: -1, weightAllowance: 10, maxPress: 25, openDoors: 3 });
    expect(strength(7)).toMatchObject({ hitProb: -1, damageAdj: 0, weightAllowance: 20, maxPress: 55, openDoors: 4 });
    expect(strength(9)).toMatchObject({ hitProb: 0, damageAdj: 0, weightAllowance: 35, maxPress: 90, openDoors: 5, bendBarsLiftGates: 1 });
    expect(strength(15)).toMatchObject({ weightAllowance: 55, maxPress: 170, openDoors: 8, bendBarsLiftGates: 7 });
    expect(strength(16)).toMatchObject({ hitProb: 0, damageAdj: 1, weightAllowance: 70, bendBarsLiftGates: 10 });
    expect(strength(17)).toMatchObject({ hitProb: 1, damageAdj: 1, weightAllowance: 85, bendBarsLiftGates: 13 });
  });

  it("plain 18 when no exceptional percentile", () => {
    expect(strength(18)).toEqual({
      hitProb: 1, damageAdj: 2, weightAllowance: 110, maxPress: 255,
      openDoors: 11, openDoorsMagical: null, bendBarsLiftGates: 16,
    });
  });

  it("exceptional Strength bands (only for score 18)", () => {
    expect(strength(18, 25)).toMatchObject({ hitProb: 1, damageAdj: 3, weightAllowance: 135, maxPress: 280, openDoors: 12, bendBarsLiftGates: 20 }); // 01-50
    expect(strength(18, 60)).toMatchObject({ hitProb: 2, damageAdj: 3, weightAllowance: 160, bendBarsLiftGates: 25 }); // 51-75
    expect(strength(18, 85)).toMatchObject({ hitProb: 2, damageAdj: 4, weightAllowance: 185, bendBarsLiftGates: 30 }); // 76-90
    expect(strength(18, 95)).toMatchObject({ hitProb: 2, damageAdj: 5, weightAllowance: 235, openDoors: 15, openDoorsMagical: 3, bendBarsLiftGates: 35 }); // 91-99
    expect(strength(18, 100)).toMatchObject({ hitProb: 3, damageAdj: 6, weightAllowance: 335, openDoors: 16, openDoorsMagical: 6, bendBarsLiftGates: 40 }); // 00
  });

  it("percentile ignored when score is not 18", () => {
    expect(strength(17, 100)).toEqual(strength(17));
  });

  it("giant-strength scores 19-25", () => {
    expect(strength(19)).toMatchObject({ hitProb: 3, damageAdj: 7, weightAllowance: 485, maxPress: 640, openDoors: 16, openDoorsMagical: 8, bendBarsLiftGates: 50 });
    expect(strength(22)).toMatchObject({ hitProb: 4, damageAdj: 10, weightAllowance: 785, openDoors: 18, openDoorsMagical: 14, bendBarsLiftGates: 80 });
    expect(strength(25)).toEqual({
      hitProb: 7, damageAdj: 14, weightAllowance: 1535, maxPress: 1750,
      openDoors: 19, openDoorsMagical: 18, bendBarsLiftGates: 99,
    });
  });

  it("rejects invalid input", () => {
    expect(() => strength(0)).toThrow(RangeError);
    expect(() => strength(26)).toThrow(RangeError);
    expect(() => strength(18, 0)).toThrow(RangeError);
    expect(() => strength(18, 101)).toThrow(RangeError);
  });
});
