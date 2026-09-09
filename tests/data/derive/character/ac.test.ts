import { describe, expect, it } from "vitest";
import { deriveAc } from "../../../../src/data/derive/character/ac";

describe("deriveAc", () => {
  it("chain (AC 5) + shield (1) + DEX 16 (defensiveAdj -1)", () => {
    const ac = deriveAc({
      equippedArmor: { baseArmorAc: 5, magicBonus: 0 },
      equippedShield: { shieldBonus: 1, magicBonus: 0 },
      dexDefensiveAdj: -1,
    });
    // normal: 5 - 1(shield) - 1(dex) = 3
    expect(ac.normal).toBe(3);
    // shieldless: 5 - 1(dex) = 4
    expect(ac.shieldless).toBe(4);
    // surprised (deny DEX): 5 - 1(shield) = 4
    expect(ac.surprised).toBe(4);
    // rearAttack (deny shield + deny beneficial DEX): 5
    expect(ac.rearAttack).toBe(5);
  });
  it("magic shield's bonus drops with the shield in denyShield variants", () => {
    const ac = deriveAc({
      equippedArmor: { baseArmorAc: 5, magicBonus: 1 },
      equippedShield: { shieldBonus: 1, magicBonus: 2 },
      dexDefensiveAdj: 0,
    });
    // normal: 5 + 0 - 1(shield) - (1+2)(magic) = 1
    expect(ac.normal).toBe(1);
    // shieldless: 5 + 0 - 0 - 1(armor magic only) = 4
    expect(ac.shieldless).toBe(4);
    // surprised (deny DEX; dex 0 here): 5 + 0 - 1 - 3 = 1
    expect(ac.surprised).toBe(1);
    // rearAttack: 5 + 0 - 0 - 1 = 4
    expect(ac.rearAttack).toBe(4);
  });
  it("no armor -> AC 10 base", () => {
    const ac = deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: 0 });
    expect(ac.normal).toBe(10);
  });
});
