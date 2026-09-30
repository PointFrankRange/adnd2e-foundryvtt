import { describe, expect, it } from "vitest";
import { deriveChannelling } from "../../../../src/data/derive/character/channellers";

describe("deriveChannelling", () => {
  it("a wizard-progression caster gets a max", () => {
    const r = deriveChannelling({
      chassisId: "mage", level: 6, specialist: true, conHpAdjustment: 1, wisMagicalDefenseAdj: 1,
    });
    expect(r.wizard).toEqual({ max: 77 }); // 55 base + 20 specialist bonus + 1 + 1
  });

  it("floors at 4", () => {
    const r = deriveChannelling({
      chassisId: "mage", level: 1, specialist: false, conHpAdjustment: -2, wisMagicalDefenseAdj: -3,
    });
    expect(r.wizard).toEqual({ max: 4 });
  });

  it("a non-wizard-progression class (cleric) gets no record", () => {
    const r = deriveChannelling({
      chassisId: "cleric", level: 6, specialist: false, conHpAdjustment: 0, wisMagicalDefenseAdj: 0,
    });
    expect(r.wizard).toBeUndefined();
  });
});
