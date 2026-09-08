import { describe, expect, it } from "vitest";
import { damageModifiers, damageResult } from "../../../src/core/combat/damage";

describe("damageModifiers()", () => {
  it("sums the four sources", () => {
    const r = damageModifiers({
      strengthDamageAdj: 3, specializationBonus: 2, weaponMagicBonus: 1, situationalModifier: 0,
    });
    expect(r.total).toBe(6);
    expect(r.breakdown).toEqual({ strength: 3, specialization: 2, weaponMagic: 1, situational: 0 });
  });
  it("all defaults -> 0", () => {
    expect(damageModifiers({}).total).toBe(0);
  });
  it("bow (no STR damage) with magic", () => {
    expect(damageModifiers({ weaponMagicBonus: 2 }).total).toBe(2);
  });
});

describe("damageResult()", () => {
  it("rolled + bonus", () => {
    expect(damageResult(5, 3)).toBe(8);
    expect(damageResult(1, 0)).toBe(1);
  });
  it("floors at 1 on a hit (penalties cannot reduce below 1)", () => {
    expect(damageResult(2, -5)).toBe(1);
    expect(damageResult(1, -3)).toBe(1);
    expect(damageResult(4, -4)).toBe(1); // exactly 0 -> 1
  });
});
