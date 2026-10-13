import { describe, expect, it } from "vitest";
import { resolveManeuverAttack, type ManeuverAttackInput } from "../../../src/core/martial-arts";

const base: ManeuverAttackInput = {
  maneuverId: "kick:1", naturalD20: 12, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
  situationalModifier: 0, targetArmorGroup: "mail", styleDie: "1d4", level: 5, strengthAdj: 1,
};

describe("resolveManeuverAttack", () => {
  it("applies the Table 21 modifier for the target's armor group and builds the damage formula", () => {
    const r = resolveManeuverAttack(base);
    expect(r.penalties).toEqual({ armor: 0, weaponSize: 0, situational: 0, table21: -1 });
    expect(r.attackBonus).toBe(-1);
    expect(r.needed).toBe(10);
    expect(r.total).toBe(11);
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBe("1d4+1d2+1");
    expect(r.stunTrigger).toBe(false);
  });
  it("adds the worn-armor and weapon-size penalties", () => {
    const r = resolveManeuverAttack({ ...base, attackerArmorType: "chain-mail", opponentWeaponSize: "L", naturalD20: 17 });
    expect(r.penalties).toEqual({ armor: -2, weaponSize: -4, situational: 0, table21: -1 });
    expect(r.total).toBe(10);
    expect(r.hit).toBe(true);
  });
  it("a miss has no damage formula", () => {
    const r = resolveManeuverAttack({ ...base, naturalD20: 8 });
    expect(r.hit).toBe(false);
    expect(r.damageFormula).toBeNull();
  });
  it("a parry hits for no damage and never prompts the stun text", () => {
    const r = resolveManeuverAttack({ ...base, maneuverId: "block:1", naturalD20: 20 });
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBeNull();
    expect(r.stunTrigger).toBe(false);
    expect(r.penalties.table21).toBe(0);
  });
  it("a natural 20 with an attack maneuver prompts the stun text; a natural 1 misses", () => {
    expect(resolveManeuverAttack({ ...base, naturalD20: 20, targetAc: -10 }).stunTrigger).toBe(true);
    const one = resolveManeuverAttack({ ...base, naturalD20: 1, situationalModifier: 10 });
    expect(one.hit).toBe(false);
    expect(one.stunTrigger).toBe(false);
  });
  it("a forced hit (helpless target) hits regardless", () => {
    const r = resolveManeuverAttack({ ...base, naturalD20: 2, targetAc: -10, forcedHit: true });
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBe("1d4+1d2+1");
  });
  it("rejects an unknown maneuver id", () => {
    expect(() => resolveManeuverAttack({ ...base, maneuverId: "bogus:9" })).toThrow(RangeError);
  });
});

describe("B2 maneuver attacks", () => {
  const input = {
    maneuverId: "vitalArea:2", naturalD20: 15, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "light" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("a damage-less touch hits with no damage formula and applies its Table 21 modifier", () => {
    const r = resolveManeuverAttack(input);
    expect(r.penalties.table21).toBe(-2);
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBeNull();
    expect(r.doubleDamageFormula).toBeNull();
  });
  it("Great Throw builds a multiplied formula", () => {
    const r = resolveManeuverAttack({ ...input, maneuverId: "throw:4", naturalD20: 18 });
    expect(r.damageFormula).toBe("(1d4+1)*2");
  });
  it("Distance Death exposes the double-damage formula on a hit only", () => {
    const hit = resolveManeuverAttack({ ...input, maneuverId: "vitalArea:4", naturalD20: 15 });
    expect(hit.damageFormula).toBeNull();
    expect(hit.doubleDamageFormula).toBe("(1d4)*2");
    const miss = resolveManeuverAttack({ ...input, maneuverId: "vitalArea:4", naturalD20: 2 });
    expect(miss.doubleDamageFormula).toBeNull();
  });
  it("rejects a passive maneuver", () => {
    expect(() => resolveManeuverAttack({ ...input, maneuverId: "throw:1" })).toThrow(RangeError);
  });
});
