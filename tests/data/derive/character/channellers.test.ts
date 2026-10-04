import { describe, expect, it } from "vitest";
import { deriveChannelling } from "../../../../src/data/derive/character/channellers";

describe("deriveChannelling", () => {
  it("a wizard-progression caster gets a max", () => {
    const r = deriveChannelling({
      chassisId: "mage", level: 6, specialist: true, conHpAdjustment: 1, wisMagicalDefenseAdj: 1,
      priestLevel: 6, wisScore: 10,
    });
    expect(r.wizard).toEqual({ max: 77 }); // 55 base + 20 specialist bonus + 1 + 1
  });

  it("floors at 4", () => {
    const r = deriveChannelling({
      chassisId: "mage", level: 1, specialist: false, conHpAdjustment: -2, wisMagicalDefenseAdj: -3,
      priestLevel: 1, wisScore: 10,
    });
    expect(r.wizard).toEqual({ max: 4 });
  });

  it("a non-wizard-progression class (cleric) gets no wizard record", () => {
    const r = deriveChannelling({
      chassisId: "cleric", level: 6, specialist: false, conHpAdjustment: 0, wisMagicalDefenseAdj: 0,
      priestLevel: 6, wisScore: 10,
    });
    expect(r.wizard).toBeUndefined();
  });

  it("derives a priest channelling max from the priest spell-point total", () => {
    const out = deriveChannelling({
      chassisId: "cleric", level: 5, specialist: false,
      priestLevel: 5, wisScore: 16, conHpAdjustment: 1,
      wisMagicalDefenseAdj: 0,
    });
    // Table 26 level 5 = 40, Wis 16 bonus = 20, Con +1 = 61
    expect(out.priest?.max).toBe(61);
  });

  it("does not derive a priest channelling record for a paladin", () => {
    const out = deriveChannelling({
      chassisId: "paladin", level: 9, specialist: false,
      priestLevel: 9, wisScore: 16, conHpAdjustment: 0, wisMagicalDefenseAdj: 0,
    });
    expect(out.priest).toBeUndefined();
  });
});
