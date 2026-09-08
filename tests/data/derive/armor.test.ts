import { describe, expect, it } from "vitest";
import { armorAcContribution } from "../../../src/data/derive/armor";

describe("armorAcContribution", () => {
  it("body armor: baseAc minus the magic bonus (magic lowers AC)", () => {
    expect(armorAcContribution({ baseAc: 5, magicBonus: 0, isShield: false, shieldAcBonus: 0 }).acBonus).toBe(5);
    expect(armorAcContribution({ baseAc: 3, magicBonus: 1, isShield: false, shieldAcBonus: 0 }).acBonus).toBe(2);
  });
  it("shield: contributes minus (shieldAcBonus + magicBonus), AC-signed", () => {
    expect(armorAcContribution({ baseAc: 0, magicBonus: 0, isShield: true, shieldAcBonus: 1 }).acBonus).toBe(-1);
    expect(armorAcContribution({ baseAc: 0, magicBonus: 2, isShield: true, shieldAcBonus: 1 }).acBonus).toBe(-3);
  });
});
