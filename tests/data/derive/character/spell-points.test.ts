import { describe, expect, it } from "vitest";
import { deriveSpellPoints } from "../../../../src/data/derive/character/spell-points";

const base = {
  chassisId: "mage" as const,
  level: 6,
  intScore: 18,
  maxSpellLevelKnown: 9,
  specialist: true,
  wizardMemorized: [],
};

describe("deriveSpellPoints", () => {
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
