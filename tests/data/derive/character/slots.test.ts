import { describe, expect, it } from "vitest";
import { deriveSpellSlots } from "../../../../src/data/derive/character/slots";

describe("deriveSpellSlots", () => {
  it("mage L5, maxSpellLevelKnown null (INT cap 1): wizard record capped at level 1", () => {
    const r = deriveSpellSlots({
      chassisId: "mage", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false,
      memorized: [{ spellItemId: "a", spellLevel: 1 }, { spellItemId: "b", spellLevel: 1 }],
    });
    // PHB Table 21 wizard L5 = 4/2/1/0/0, but maxSpellLevelKnown: null -> ?? 1 gives level 1 cap
    expect(r.wizard![1]).toEqual({ max: 4, used: 2 });
    expect(r.wizard![2].max).toBe(0); // INT cap suppresses level 2+
    expect(r.priest).toBeUndefined();
  });
  it("cleric L3, WIS 15: priest record", () => {
    const r = deriveSpellSlots({
      chassisId: "cleric", level: 3, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false, memorized: [],
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.wizard).toBeUndefined();
  });
  it("fighter -> neither", () => {
    const r = deriveSpellSlots({
      chassisId: "fighter", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, memorized: [],
    });
    expect(r).toEqual({});
  });
  it("paladin -> null (limited casters are a 1c.3b follow-up, Ruling CASTER1)", () => {
    const r = deriveSpellSlots({
      chassisId: "paladin", level: 9, maxSpellLevelKnown: null, wisdomScore: 14,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false, memorized: [],
    });
    expect(r).toEqual({});
  });
  it("bard L6 (casterType wizard, spellProgressionId bard) -> neither", () => {
    const r = deriveSpellSlots({
      chassisId: "bard", level: 6, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, memorized: [],
    });
    expect(r).toEqual({});
  });
  it("druid L5, WIS 15: priest record (full priest progression)", () => {
    const r = deriveSpellSlots({
      chassisId: "druid", level: 5, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 1, 0, 0, 0, 0, 0], specialist: false, memorized: [],
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.wizard).toBeUndefined();
  });
});
