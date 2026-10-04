import { describe, expect, it } from "vitest";
import { deriveSpellSlots } from "../../../../src/data/derive/character/slots";

const noMemo = { wizardMemorized: [], priestMemorized: [] };

describe("deriveSpellSlots", () => {
  it("mage L5, maxSpellLevelKnown null (INT cap 1): wizard record capped at level 1", () => {
    const r = deriveSpellSlots({
      chassisId: "mage", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false,
      wizardMemorized: [{ spellItemId: "a", spellLevel: 1 }, { spellItemId: "b", spellLevel: 1 }],
      priestMemorized: [],
    });
    expect(r.wizard![1]).toEqual({ max: 4, used: 2 });
    expect(r.wizard![2].max).toBe(0);
    expect(r.priest).toBeUndefined();
  });

  it("wizard 'used' counts ONLY wizardMemorized — a priest spell of the same level does not leak", () => {
    const r = deriveSpellSlots({
      chassisId: "mage", level: 5, maxSpellLevelKnown: 9, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false,
      wizardMemorized: [{ spellItemId: "w", spellLevel: 1 }],
      priestMemorized: [{ spellItemId: "p", spellLevel: 1 }],
    });
    expect(r.wizard![1].used).toBe(1);
  });

  it("cleric L3, WIS 15: priest record, used from priestMemorized only", () => {
    const r = deriveSpellSlots({
      chassisId: "cleric", level: 3, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false,
      wizardMemorized: [{ spellItemId: "w", spellLevel: 1 }],
      priestMemorized: [{ spellItemId: "p", spellLevel: 1 }],
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.priest![1].used).toBe(1);
    expect(r.wizard).toBeUndefined();
  });

  it("fighter -> neither", () => {
    const r = deriveSpellSlots({
      chassisId: "fighter", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, ...noMemo,
    });
    expect(r).toEqual({});
  });

  it("paladin L9 (Table 17): priest level 1 max 1, no Wisdom bonus, used from priestMemorized only", () => {
    const r = deriveSpellSlots({
      chassisId: "paladin", level: 9, maxSpellLevelKnown: null, wisdomScore: 18,
      wisdomBonusSpells: [4, 3, 2, 1, 0, 0, 0], specialist: false,
      wizardMemorized: [{ spellItemId: "w", spellLevel: 1 }],
      priestMemorized: [{ spellItemId: "p", spellLevel: 1 }],
    });
    expect(r.priest![1]).toEqual({ max: 1, used: 1 });
    expect(r.priest![2]).toEqual({ max: 0, used: 0 });
    expect(r.priest![4]).toEqual({ max: 0, used: 0 });
    expect(r.wizard).toBeUndefined();
  });

  it("paladin below L9 has no priest slots", () => {
    const r = deriveSpellSlots({
      chassisId: "paladin", level: 8, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, ...noMemo,
    });
    expect(r.priest![1]).toEqual({ max: 0, used: 0 });
  });

  it("ranger L8 (Table 18): priest level 1 max 1, no Wisdom bonus", () => {
    const r = deriveSpellSlots({
      chassisId: "ranger", level: 8, maxSpellLevelKnown: null, wisdomScore: 18,
      wisdomBonusSpells: [4, 3, 2, 1, 0, 0, 0], specialist: false,
      wizardMemorized: [],
      priestMemorized: [{ spellItemId: "p", spellLevel: 1 }],
    });
    expect(r.priest![1]).toEqual({ max: 1, used: 1 });
    expect(r.priest![2]).toEqual({ max: 0, used: 0 });
    expect(r.wizard).toBeUndefined();
  });

  it("bard L6 -> {}", () => {
    const r = deriveSpellSlots({
      chassisId: "bard", level: 6, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, ...noMemo,
    });
    expect(r).toEqual({});
  });

  it("druid L5, WIS 15: priest record", () => {
    const r = deriveSpellSlots({
      chassisId: "druid", level: 5, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 1, 0, 0, 0, 0, 0], specialist: false, ...noMemo,
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.wizard).toBeUndefined();
  });
});
