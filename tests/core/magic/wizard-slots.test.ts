import { describe, expect, it } from "vitest";
import { wizardSpellSlots } from "../../../src/core/magic/wizard-slots";

describe("wizardSpellSlots()", () => {
  it("level 1 mage, INT max 4: one 1st-level slot", () => {
    const r = wizardSpellSlots({ wizardLevel: 1, maxSpellLevelKnown: 4 });
    expect(r.perLevel).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.base).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.bonus).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.suppressed).toEqual([]);
  });

  it("level 5 mage, INT max 5: matches Table 21 row exactly", () => {
    const r = wizardSpellSlots({ wizardLevel: 5, maxSpellLevelKnown: 5 });
    expect(r.perLevel).toEqual([4, 2, 1, 0, 0, 0, 0, 0, 0]);
  });

  it("specialist adds +1 at every castable spell level", () => {
    // L5 base [4,2,1,0,...] -> specialist [5,3,2,0,...]
    const r = wizardSpellSlots({ wizardLevel: 5, maxSpellLevelKnown: 5, specialist: true });
    expect(r.perLevel).toEqual([5, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(r.bonus).toEqual([1, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it("Intelligence cap zeroes spell levels above the max and reports them", () => {
    // L12 base [4,4,4,4,4,1,0,0,0]; INT max 4 -> 5th and 6th suppressed
    const r = wizardSpellSlots({ wizardLevel: 12, maxSpellLevelKnown: 4 });
    expect(r.perLevel).toEqual([4, 4, 4, 4, 0, 0, 0, 0, 0]);
    expect(r.suppressed).toEqual([5, 6]);
  });

  it("INT cap does not report a spell level the wizard has no slots at anyway", () => {
    // L5 base [4,2,1,0,...]; INT max 4 -> nothing above 4 has slots -> suppressed empty
    const r = wizardSpellSlots({ wizardLevel: 5, maxSpellLevelKnown: 4 });
    expect(r.suppressed).toEqual([]);
  });

  it("specialist bonus above the INT cap is also suppressed", () => {
    // L12 specialist base [4,4,4,4,4,1,...] bonus at 6th = 1; INT max 5 -> 6th suppressed
    const r = wizardSpellSlots({ wizardLevel: 12, maxSpellLevelKnown: 5, specialist: true });
    expect(r.perLevel[5]).toBe(0);
    expect(r.suppressed).toEqual([6]);
  });

  it("level above 20 reuses the level-20 row", () => {
    const l20 = wizardSpellSlots({ wizardLevel: 20, maxSpellLevelKnown: 9 });
    const l25 = wizardSpellSlots({ wizardLevel: 25, maxSpellLevelKnown: 9 });
    expect(l25.perLevel).toEqual(l20.perLevel);
    expect(l25.perLevel).toEqual([5, 5, 5, 5, 5, 4, 3, 3, 2]);
  });

  it("rejects a bad level or spell-level cap", () => {
    expect(() => wizardSpellSlots({ wizardLevel: 0, maxSpellLevelKnown: 4 })).toThrow(RangeError);
    expect(() => wizardSpellSlots({ wizardLevel: 5, maxSpellLevelKnown: 0 })).toThrow(RangeError);
    expect(() => wizardSpellSlots({ wizardLevel: 5, maxSpellLevelKnown: 10 })).toThrow(RangeError);
  });
});
