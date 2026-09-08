import { describe, expect, it } from "vitest";
import { armorClass } from "../../../src/core/combat/armor-class";

describe("armorClass()", () => {
  it("unarmored is AC 10", () => {
    expect(armorClass({ baseArmorAc: 10 }).value).toBe(10);
  });

  it("armor + shield + dex + magic (PHB combined model)", () => {
    // chain mail (5) + shield (1) + DEX 16 (-2) + chain +1 (1) => 5 - 1 - 2 - 1 = 1
    const r = armorClass({ baseArmorAc: 5, shieldBonus: 1, dexDefensiveAdj: -2, magicBonus: 1 });
    expect(r.value).toBe(1);
    expect(r.breakdown).toEqual({ baseArmorAc: 5, shield: 1, dexterity: -2, magic: 1, situational: 0 });
  });

  it("Table 46 combos: leather + shield = 7", () => {
    expect(armorClass({ baseArmorAc: 8, shieldBonus: 1 }).value).toBe(7);
  });

  it("clamps to [-10, 10]", () => {
    expect(armorClass({ baseArmorAc: 10, dexDefensiveAdj: 6 }).value).toBe(10); // worse than 10 -> 10
    expect(armorClass({ baseArmorAc: 1, shieldBonus: 1, dexDefensiveAdj: -6, magicBonus: 5 }).value).toBe(-10);
    expect(armorClass({ baseArmorAc: 10, dexDefensiveAdj: 6 }).raw).toBe(16);
    expect(armorClass({ baseArmorAc: 1, shieldBonus: 1, dexDefensiveAdj: -6, magicBonus: 5 }).raw).toBe(-11);
  });

  it("denyShield drops the shield", () => {
    const r = armorClass({ baseArmorAc: 5, shieldBonus: 1, denyShield: true });
    expect(r.value).toBe(5);
    expect(r.breakdown.shield).toBe(0);
  });

  it("denyDexBonus drops a beneficial DEX adj but keeps a penalty", () => {
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: -3, denyDexBonus: true }).value).toBe(8);
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: 4, denyDexBonus: true }).value).toBe(10); // penalty stays (clamped)
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: 4, denyDexBonus: true }).raw).toBe(12);
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: 2, denyDexBonus: true }).value).toBe(10);
  });

  it("rear attack = denyDexBonus + denyShield", () => {
    const front = armorClass({ baseArmorAc: 5, shieldBonus: 1, dexDefensiveAdj: -4 });
    const rear = armorClass({ baseArmorAc: 5, shieldBonus: 1, dexDefensiveAdj: -4, denyDexBonus: true, denyShield: true });
    expect(front.value).toBe(0);
    expect(rear.value).toBe(5);
  });

  it("situational modifier: negative improves AC", () => {
    expect(armorClass({ baseArmorAc: 8, situationalModifier: -2 }).value).toBe(6); // DM ad-hoc AC bonus
    expect(armorClass({ baseArmorAc: 8, situationalModifier: 2 }).value).toBe(10);
  });
});
