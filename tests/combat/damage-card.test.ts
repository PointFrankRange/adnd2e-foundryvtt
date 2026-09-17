import { describe, expect, it } from "vitest";
import { buildDamageCardContext } from "../../src/combat/damage-card";
import type { DamageCardInput } from "../../src/combat/card-types";

function input(over: Partial<DamageCardInput> = {}): DamageCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    weaponName: "Long Sword", formula: "1d8 + 2",
    rolledBaseDamage: 5, damageBonus: 2,
    backstabMultiplier: null,
    critMultiplier: null,
    critFlatBonus: 0,
    ...over,
  };
}

describe("buildDamageCardContext", () => {
  it("computes the final floored total from rolled + bonus", () => {
    const c = buildDamageCardContext(input());
    expect(c.rolled).toBe(5);
    expect(c.bonus).toBe(2);
    expect(c.total).toBe(7);
  });

  it("floors a heavily-penalized roll at 1, never 0 or negative", () => {
    const c = buildDamageCardContext(input({ rolledBaseDamage: 1, damageBonus: -5 }));
    expect(c.total).toBe(1);
  });

  it("passes actor/weapon identity and the formula through unchanged", () => {
    const c = buildDamageCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.weaponName).toBe("Long Sword");
    expect(c.formula).toBe("1d8 + 2");
  });

  it("multiplies the floored total by backstabMultiplier when set", () => {
    // rolled 4 + bonus 2 = 6 (already >= 1, no floor kicks in), ×3 backstab = 18
    const c = buildDamageCardContext({
      actorName: "Sly", actorImg: "img.webp", weaponName: "Dagger",
      formula: "1d4 + 2", rolledBaseDamage: 4, damageBonus: 2, backstabMultiplier: 3,
      critMultiplier: null, critFlatBonus: 0,
    });
    expect(c.total).toBe(18);
    expect(c.backstabMultiplier).toBe(3);
  });

  it("applies the damageResult floor-at-1 rule BEFORE multiplying", () => {
    // rolled 0 + bonus -5 = -5, floored to 1 by damageResult, THEN ×2 backstab = 2
    const c = buildDamageCardContext({
      actorName: "Sly", actorImg: "img.webp", weaponName: "Dagger",
      formula: "1d4 - 5", rolledBaseDamage: 0, damageBonus: -5, backstabMultiplier: 2,
      critMultiplier: null, critFlatBonus: 0,
    });
    expect(c.total).toBe(2);
  });

  it("multiplies the floored total by critMultiplier when set (no backstab)", () => {
    // rolled 4 + bonus 2 = 6, ×2 crit = 12
    const c = buildDamageCardContext(input({ rolledBaseDamage: 4, damageBonus: 2, backstabMultiplier: null, critMultiplier: 2, critFlatBonus: 0 }));
    expect(c.total).toBe(12);
    expect(c.critMultiplier).toBe(2);
  });

  it("adds critFlatBonus AFTER the crit multiplier (brutal-tier crit)", () => {
    // rolled 4 + bonus 2 = 6, ×3 crit + 3 flat = 21
    const c = buildDamageCardContext(input({ rolledBaseDamage: 4, damageBonus: 2, backstabMultiplier: null, critMultiplier: 3, critFlatBonus: 3 }));
    expect(c.total).toBe(21);
  });

  it("never adds critFlatBonus when critMultiplier is null", () => {
    const c = buildDamageCardContext(input({ backstabMultiplier: null, critMultiplier: null, critFlatBonus: 3 }));
    expect(c.total).toBe(7);
  });

  it("prefers backstabMultiplier over critMultiplier when both are somehow set (defensive precedence)", () => {
    const c = buildDamageCardContext(input({ backstabMultiplier: 2, critMultiplier: 3, critFlatBonus: 3 }));
    // multiplier picks backstabMultiplier (2) via ??, but critFlatBonus is still
    // added because it's gated on critMultiplier being set, not on which
    // multiplier won — a defensive pure function, per this plan's Task 3 Step 2.
    expect(c.total).toBe(7 * 2 + 3);
  });
});
