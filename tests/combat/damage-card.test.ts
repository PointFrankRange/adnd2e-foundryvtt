import { describe, expect, it } from "vitest";
import { buildDamageCardContext } from "../../src/combat/damage-card";
import type { DamageCardInput } from "../../src/combat/card-types";

function input(over: Partial<DamageCardInput> = {}): DamageCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    weaponName: "Long Sword", formula: "1d8 + 2",
    rolledBaseDamage: 5, damageBonus: 2,
    backstabMultiplier: null,
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
    });
    expect(c.total).toBe(18);
    expect(c.backstabMultiplier).toBe(3);
  });

  it("applies the damageResult floor-at-1 rule BEFORE multiplying", () => {
    // rolled 0 + bonus -5 = -5, floored to 1 by damageResult, THEN ×2 backstab = 2
    const c = buildDamageCardContext({
      actorName: "Sly", actorImg: "img.webp", weaponName: "Dagger",
      formula: "1d4 - 5", rolledBaseDamage: 0, damageBonus: -5, backstabMultiplier: 2,
    });
    expect(c.total).toBe(2);
  });
});
