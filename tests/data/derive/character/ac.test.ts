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
  it("no armor -> AC 10 base", () => {
    const ac = deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: 0 });
    expect(ac.normal).toBe(10);
  });
});
