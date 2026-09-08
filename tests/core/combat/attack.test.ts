import { describe, expect, it } from "vitest";
import { attackModifiers, toHitNumber, hitResult } from "../../../src/core/combat/attack";

describe("attackModifiers()", () => {
  it("sums the six modifier sources", () => {
    const r = attackModifiers({
      strengthHitAdj: 2, dexterityMissileAdj: 0, weaponMagicBonus: 1,
      proficiencyModifier: -2, rangePenalty: 0, situationalModifier: 4,
    });
    expect(r.total).toBe(5);
    expect(r.breakdown).toEqual({
      strength: 2, dexterityMissile: 0, weaponMagic: 1, proficiency: -2, range: 0, situational: 4,
    });
  });
  it("all defaults -> 0", () => {
    expect(attackModifiers({}).total).toBe(0);
  });
  it("ranged example: DEX missile + long range penalty", () => {
    expect(attackModifiers({ dexterityMissileAdj: 2, rangePenalty: -5 }).total).toBe(-3);
  });
});

describe("toHitNumber()", () => {
  it("thac0 - targetAc", () => {
    expect(toHitNumber(14, 6)).toBe(8);   // PHB Rath vs orc AC 6
    expect(toHitNumber(11, 5)).toBe(6);   // PHB Rath modified
    expect(toHitNumber(20, 10)).toBe(10); // 1st level vs unarmored
  });
  it("negative target AC adds", () => {
    expect(toHitNumber(10, -3)).toBe(13);
  });
});

describe("hitResult()", () => {
  it("plain hit / miss around the needed number", () => {
    const hit = hitResult(8, 0, 14, 6); // needs 8, rolled 8
    expect(hit).toMatchObject({ hit: true, autoHit: false, autoMiss: false, needed: 8, total: 8, margin: 0 });
    const miss = hitResult(7, 0, 14, 6);
    expect(miss).toMatchObject({ hit: false, needed: 8, total: 7, margin: -1 });
  });
  it("attack bonus is added to the natural roll", () => {
    expect(hitResult(6, 2, 14, 6).hit).toBe(true);  // 6 + 2 = 8 >= 8
    expect(hitResult(5, 2, 14, 6).hit).toBe(false); // 7 < 8
  });
  it("natural 20 always hits, even when needed is impossible", () => {
    const r = hitResult(20, 0, 20, -10); // needs 30
    expect(r).toMatchObject({ hit: true, autoHit: true, autoMiss: false, needed: 30 });
  });
  it("natural 1 always misses, even when needed is trivial", () => {
    const r = hitResult(1, 10, 10, 10); // needs 0, total 11
    expect(r).toMatchObject({ hit: false, autoHit: false, autoMiss: true, needed: 0 });
  });
  it("rejects a non-d20 natural roll", () => {
    expect(() => hitResult(0, 0, 14, 6)).toThrow(RangeError);
    expect(() => hitResult(21, 0, 14, 6)).toThrow(RangeError);
  });
});
