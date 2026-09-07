import { describe, expect, it } from "vitest";
import { wisdom } from "../../../src/core/abilities/wisdom";

describe("wisdom()", () => {
  it("penalties and spell failure below 13", () => {
    expect(wisdom(1)).toMatchObject({ magicalDefenseAdj: -6, spellFailureChance: 80 });
    expect(wisdom(7)).toMatchObject({ magicalDefenseAdj: -1, spellFailureChance: 30 });
    expect(wisdom(9)).toMatchObject({ magicalDefenseAdj: 0, spellFailureChance: 20, bonusPriestSpells: [0, 0, 0, 0, 0, 0, 0] });
    expect(wisdom(12)).toMatchObject({ spellFailureChance: 5, bonusPriestSpells: [0, 0, 0, 0, 0, 0, 0] });
  });
  it("magical defense adjustment 13-25", () => {
    expect(wisdom(13).magicalDefenseAdj).toBe(0);
    expect(wisdom(15).magicalDefenseAdj).toBe(1);
    expect(wisdom(16).magicalDefenseAdj).toBe(2);
    expect(wisdom(17).magicalDefenseAdj).toBe(3);
    expect(wisdom(18).magicalDefenseAdj).toBe(4);
    expect(wisdom(25).magicalDefenseAdj).toBe(4);
  });
  it("cumulative bonus priest spells", () => {
    expect(wisdom(13).bonusPriestSpells).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(wisdom(14).bonusPriestSpells).toEqual([2, 0, 0, 0, 0, 0, 0]);
    expect(wisdom(15).bonusPriestSpells).toEqual([2, 1, 0, 0, 0, 0, 0]); // PHB p.17 example
    expect(wisdom(16).bonusPriestSpells).toEqual([2, 2, 0, 0, 0, 0, 0]);
    expect(wisdom(17).bonusPriestSpells).toEqual([2, 2, 1, 0, 0, 0, 0]);
    expect(wisdom(18).bonusPriestSpells).toEqual([2, 2, 1, 1, 0, 0, 0]);
    expect(wisdom(19).bonusPriestSpells).toEqual([3, 2, 1, 2, 0, 0, 0]);
    expect(wisdom(20).bonusPriestSpells).toEqual([3, 3, 1, 3, 0, 0, 0]);
    expect(wisdom(21).bonusPriestSpells).toEqual([3, 3, 2, 3, 1, 0, 0]);
    expect(wisdom(22).bonusPriestSpells).toEqual([3, 3, 2, 4, 2, 0, 0]);
    expect(wisdom(23).bonusPriestSpells).toEqual([3, 3, 2, 4, 4, 0, 0]);
    expect(wisdom(24).bonusPriestSpells).toEqual([3, 3, 2, 4, 4, 2, 0]);
    expect(wisdom(25).bonusPriestSpells).toEqual([3, 3, 2, 4, 4, 3, 1]);
  });
  it("spell immunity score", () => {
    expect(wisdom(18).spellImmunityFromScore).toBeNull();
    expect(wisdom(19).spellImmunityFromScore).toBe(19);
    expect(wisdom(25).spellImmunityFromScore).toBe(25);
  });
  it("rejects invalid", () => { expect(() => wisdom(0)).toThrow(RangeError); });
});
