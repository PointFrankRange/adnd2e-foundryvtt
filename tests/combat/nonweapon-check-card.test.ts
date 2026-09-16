import { describe, expect, it } from "vitest";
import { buildNonweaponCheckCardContext } from "../../src/combat/nonweapon-check-card";
import type { NonweaponCheckCardInput } from "../../src/combat/card-types";

function input(over: Partial<NonweaponCheckCardInput> = {}): NonweaponCheckCardInput {
  return {
    actorName: "Aldric",
    actorImg: "icons/svg/mystery-man.svg",
    proficiencyName: "Herbalism",
    abilityLabel: "ADND2E.abilities.int",
    formula: "1d20",
    roll: 10,
    result: { success: true, autoFail: false, target: 14 },
    ...over,
  };
}

describe("buildNonweaponCheckCardContext", () => {
  it("passes through actor/proficiency display fields unchanged", () => {
    const c = buildNonweaponCheckCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.proficiencyName).toBe("Herbalism");
    expect(c.abilityLabel).toBe("ADND2E.abilities.int");
    expect(c.formula).toBe("1d20");
  });

  it("a normal success carries success:true, autoFail:false", () => {
    const c = buildNonweaponCheckCardContext(
      input({ roll: 10, result: { success: true, autoFail: false, target: 14 } }),
    );
    expect(c.success).toBe(true);
    expect(c.autoFail).toBe(false);
    expect(c.roll).toBe(10);
    expect(c.target).toBe(14);
  });

  it("a normal failure (roll above target, not a 20) carries success:false, autoFail:false", () => {
    const c = buildNonweaponCheckCardContext(
      input({ roll: 18, result: { success: false, autoFail: false, target: 14 } }),
    );
    expect(c.success).toBe(false);
    expect(c.autoFail).toBe(false);
  });

  it("a natural 20 always carries success:false, autoFail:true, even against a high target", () => {
    const c = buildNonweaponCheckCardContext(
      input({ roll: 20, result: { success: false, autoFail: true, target: 19 } }),
    );
    expect(c.success).toBe(false);
    expect(c.autoFail).toBe(true);
    expect(c.roll).toBe(20);
    expect(c.target).toBe(19);
  });
});
