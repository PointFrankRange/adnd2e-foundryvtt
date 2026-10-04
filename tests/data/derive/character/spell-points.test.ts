import { describe, expect, it } from "vitest";
import { deriveSpellPoints } from "../../../../src/data/derive/character/spell-points";

const base = {
  chassisId: "mage" as const,
  level: 6,
  intScore: 18,
  maxSpellLevelKnown: 9,
  specialist: true,
  wizardMemorized: [],
  priestLevel: 5, wisScore: 16, conHpAdjustment: 1, priestMemorized: [],
};

describe("deriveSpellPoints", () => {
  it("a paladin or ranger (classic slots) gets no spell-point record", () => {
    expect(deriveSpellPoints({ ...base, chassisId: "paladin", priestLevel: 9 })).toEqual({});
    expect(deriveSpellPoints({ ...base, chassisId: "ranger", priestLevel: 8 })).toEqual({});
  });

  it("a wizard-progression caster gets a full record", () => {
    const r = deriveSpellPoints(base);
    expect(r.wizard).toEqual({ maxSpellLevel: 3, maxPerLevel: 6, sp: 82, spent: 0, remaining: 82 });
  });

  it("intersects Table 17's max spell level with the Intelligence-based cap", () => {
    const r = deriveSpellPoints({ ...base, maxSpellLevelKnown: 2 });
    expect(r.wizard!.maxSpellLevel).toBe(2); // Table 17 L6 -> 3rd, but INT caps at 2nd
  });

  it("spent/remaining reflect the memorized list, regardless of expended", () => {
    const r = deriveSpellPoints({
      ...base,
      wizardMemorized: [
        // occupancy/spend counts regardless of expended (see core/magic/spell-points.ts
        // spellPointsSpent) — MemorizedEntry at this pure-derive layer has no `expended`
        // field at all (that's spell-actions.ts's own separate UI-facing shape).
        { spellItemId: "a", spellLevel: 1, magickType: "fixed" as const },
        { spellItemId: null, spellLevel: 2, magickType: "free" as const },
      ],
    });
    expect(r.wizard!.spent).toBe(4 + 12);
    expect(r.wizard!.remaining).toBe(82 - 16);
  });

  it("a non-wizard-progression class (cleric) gets no record", () => {
    expect(deriveSpellPoints({ ...base, chassisId: "cleric" as const }).wizard).toBeUndefined();
  });

  it("null maxSpellLevelKnown (e.g. INT below 9) falls back to 1st level, mirroring wizardSpellSlots", () => {
    const r = deriveSpellPoints({ ...base, maxSpellLevelKnown: null });
    expect(r.wizard!.maxSpellLevel).toBe(1);
  });
});

describe("deriveSpellPoints priest branch", () => {
  const priestBase = {
    chassisId: "cleric" as const, level: 5, intScore: 10, maxSpellLevelKnown: null, specialist: false, wizardMemorized: [],
    priestLevel: 5, wisScore: 16, conHpAdjustment: 1, priestMemorized: [],
  };

  it("derives the Table 26/27 record for a priest-progression chassis", () => {
    const out = deriveSpellPoints(priestBase);
    expect(out.priest).toEqual({ maxSpellLevel: 3, maxPerLevel: 6, sp: 40 + 20 + 1, spent: 0, remaining: 61 });
  });

  it("prices memorized theurgies from their stored scope", () => {
    const out = deriveSpellPoints({
      ...priestBase,
      priestMemorized: [
        { spellItemId: "a", spellLevel: 2, magickType: "fixed", theurgyScope: "minor" },
        { spellItemId: null, spellLevel: 1, magickType: "free", theurgyScope: "universal" },
      ],
    });
    expect(out.priest?.spent).toBe(10 + 12);
  });

  it("prices a legacy memorized entry with no magickType or theurgyScope as fixed major (Ruling 3)", () => {
    const out = deriveSpellPoints({
      ...priestBase,
      priestMemorized: [{ spellItemId: "a", spellLevel: 3 }],
    });
    expect(out.priest?.spent).toBe(10); // Table 29 fixed major, level 3
  });

  it("prices an unpriceable stored entry at 0 SP instead of throwing", () => {
    const out = deriveSpellPoints({
      ...priestBase,
      priestMemorized: [{ spellItemId: "bad", spellLevel: 1, magickType: "fixed", theurgyScope: "universal" }],
    });
    expect(out.priest?.spent).toBe(0);
  });

  it("prices a memorized orison at 1 SP", () => {
    const out = deriveSpellPoints({
      ...priestBase,
      priestMemorized: [{ spellItemId: "o1", spellLevel: 0, magickType: "fixed", theurgyScope: "universal" }],
    });
    expect(out.priest?.spent).toBe(1);
  });

  it("is absent for a wizard chassis", () => {
    expect(deriveSpellPoints({ ...priestBase, chassisId: "mage" }).priest).toBeUndefined();
  });
});
