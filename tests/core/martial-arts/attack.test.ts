import { describe, expect, it } from "vitest";
import { resolveMartialAttack, type MartialAttackInput } from "../../../src/core/martial-arts";

const base: MartialAttackInput = {
  naturalD20: 13, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null, situationalModifier: 0, strengthDamageAdj: 0,
};

describe("resolveMartialAttack", () => {
  it("the book's example: a 13 is a vitals punch doing 2 hp", () => {
    const r = resolveMartialAttack(base);
    expect(r.hit).toBe(true);
    expect(r.blow).toBe("vitalsPunch");
    expect(r.tableDamage).toBe(2);
    expect(r.damage).toBe(2);
    expect(r.needed).toBe(10);
    expect(r.total).toBe(13);
    expect(r.stunTrigger).toBe(false);
  });
  it("adds the Strength damage adjustment, never below 0", () => {
    expect(resolveMartialAttack({ ...base, strengthDamageAdj: 3 }).damage).toBe(5);
    expect(resolveMartialAttack({ ...base, naturalD20: 4, strengthDamageAdj: -2 }).damage).toBe(0);
  });
  it("applies the armor and weapon-size penalties to the roll", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 10, attackerArmorType: "chain-mail", opponentWeaponSize: "M" });
    expect(r.penalties).toEqual({ armor: -2, weaponSize: -2, situational: 0 });
    expect(r.attackBonus).toBe(-4);
    expect(r.total).toBe(6);
    expect(r.hit).toBe(false);
    expect(r.blow).toBeNull();
    expect(r.damage).toBe(0);
  });
  it("a natural 20 always hits and triggers the stun prompt", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 20, targetAc: -10, attackerArmorType: "full-plate" });
    expect(r.hit).toBe(true);
    expect(r.blow).toBe("headKick");
    expect(r.damage).toBe(4);
    expect(r.stunTrigger).toBe(true);
  });
  it("a natural 1 always misses", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 1, targetAc: 10, situationalModifier: 5 });
    expect(r.hit).toBe(false);
    expect(r.stunTrigger).toBe(false);
  });
  it("a forced hit (helpless target) hits regardless and still reads Table 16", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 2, targetAc: -10, forcedHit: true });
    expect(r.hit).toBe(true);
    expect(r.blow).toBe("graze");
    expect(r.damage).toBe(0);
  });
});
