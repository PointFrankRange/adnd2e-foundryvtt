import { describe, expect, it } from "vitest";
import { buildDamageCardContext } from "../../src/combat/damage-card";
import type { DamageCardInput } from "../../src/combat/card-types";

function input(over: Partial<DamageCardInput> = {}): DamageCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    weaponName: "Long Sword", formula: "1d8 + 2",
    rolledBaseDamage: 5, damageBonus: 2,
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
});
