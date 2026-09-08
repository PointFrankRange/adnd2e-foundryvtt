import { describe, expect, it } from "vitest";
import { armorAcContribution } from "../../../src/data/derive/armor";

describe("armorAcContribution", () => {
  it("body armor: reports its AC rating and magic bonus, no shield component", () => {
    expect(armorAcContribution({ baseAc: 5, magicBonus: 0, isShield: false, shieldAcBonus: 0 }))
      .toEqual({ baseArmorAc: 5, shieldBonus: null, magicBonus: 0 });
    expect(armorAcContribution({ baseAc: 3, magicBonus: 1, isShield: false, shieldAcBonus: 0 }))
      .toEqual({ baseArmorAc: 3, shieldBonus: null, magicBonus: 1 });
  });
  it("shield: reports its bonus magnitude and magic bonus, no body-armor component", () => {
    expect(armorAcContribution({ baseAc: 0, magicBonus: 0, isShield: true, shieldAcBonus: 1 }))
      .toEqual({ baseArmorAc: null, shieldBonus: 1, magicBonus: 0 });
    expect(armorAcContribution({ baseAc: 0, magicBonus: 2, isShield: true, shieldAcBonus: 1 }))
      .toEqual({ baseArmorAc: null, shieldBonus: 1, magicBonus: 2 });
  });
});
