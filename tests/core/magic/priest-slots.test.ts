import { describe, expect, it } from "vitest";
import { priestSpellSlots } from "../../../src/core/magic/priest-slots";

const NO_BONUS: readonly number[] = [0, 0, 0, 0, 0, 0, 0];
// WisdomModifiers.bonusPriestSpells for the given score (see wisdom.ts):
const WIS13 = [1, 0, 0, 0, 0, 0, 0];
const WIS15 = [2, 1, 0, 0, 0, 0, 0];
const WIS17 = [2, 2, 1, 0, 0, 0, 0];
const WIS18 = [2, 2, 1, 1, 0, 0, 0];

describe("priestSpellSlots()", () => {
  it("level 1 cleric, WIS 10: one 1st-level slot, no bonus", () => {
    const r = priestSpellSlots({ priestLevel: 1, wisdomScore: 10, wisdomBonusSpells: NO_BONUS });
    expect(r.perLevel).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(r.base).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(r.bonus).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(r.suppressed).toEqual([]);
  });

  it("level 5 cleric, WIS 15: base row plus bonus only where castable", () => {
    // L5 base [3,3,1,0,0,0,0]; WIS15 bonus [2,1,0,...] -> all 3 spell levels castable
    const r = priestSpellSlots({ priestLevel: 5, wisdomScore: 15, wisdomBonusSpells: WIS15 });
    expect(r.perLevel).toEqual([5, 4, 1, 0, 0, 0, 0]);
    expect(r.bonus).toEqual([2, 1, 0, 0, 0, 0, 0]);
  });

  it("bonus is withheld at a spell level the priest cannot yet cast", () => {
    // L1 base [1,0,...]; WIS 15 bonus [2,1,...] — the 2nd-level bonus (1) is withheld
    // because a level-1 priest has no 2nd-level slots yet.
    const r = priestSpellSlots({ priestLevel: 1, wisdomScore: 15, wisdomBonusSpells: WIS15 });
    expect(r.perLevel).toEqual([3, 0, 0, 0, 0, 0, 0]); // 1 base + 2 bonus at 1st; 0 at 2nd
    expect(r.bonus).toEqual([2, 0, 0, 0, 0, 0, 0]);
  });

  it("level 3 cleric, WIS 13: the 1st-level bonus applies, 2nd-level base has no bonus row", () => {
    // L3 base [2,1,0,...]; WIS13 bonus [1,0,...]
    const r = priestSpellSlots({ priestLevel: 3, wisdomScore: 13, wisdomBonusSpells: WIS13 });
    expect(r.perLevel).toEqual([3, 1, 0, 0, 0, 0, 0]);
    expect(r.bonus).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("WIS 17 unlocks 6th-level slots", () => {
    // L11 base [5,4,4,3,2,1,0]; WIS17 -> 6th (base 1) stays
    const r = priestSpellSlots({ priestLevel: 11, wisdomScore: 17, wisdomBonusSpells: WIS17 });
    expect(r.perLevel[5]).toBe(1);
    expect(r.suppressed).toEqual([]);
  });

  it("WIS 16 suppresses 6th-level slots the priest would otherwise have", () => {
    const r = priestSpellSlots({
      priestLevel: 11,
      wisdomScore: 16,
      wisdomBonusSpells: [2, 2, 0, 0, 0, 0, 0],
    });
    expect(r.perLevel[5]).toBe(0);
    expect(r.suppressed).toEqual([6]);
  });

  it("WIS 17 still suppresses 7th-level slots (needs 18)", () => {
    // L14 base [6,6,6,5,3,2,1]; WIS17 -> 6th ok, 7th suppressed
    const r = priestSpellSlots({ priestLevel: 14, wisdomScore: 17, wisdomBonusSpells: WIS17 });
    expect(r.perLevel[5]).toBe(2);
    expect(r.perLevel[6]).toBe(0);
    expect(r.suppressed).toEqual([7]);
  });

  it("WIS 18 unlocks both 6th and 7th", () => {
    const r = priestSpellSlots({ priestLevel: 14, wisdomScore: 18, wisdomBonusSpells: WIS18 });
    expect(r.perLevel[5]).toBe(2);
    expect(r.perLevel[6]).toBe(1);
    expect(r.suppressed).toEqual([]);
  });

  it("level above 20 reuses the level-20 row", () => {
    const r = priestSpellSlots({ priestLevel: 30, wisdomScore: 18, wisdomBonusSpells: NO_BONUS });
    expect(r.base).toEqual([9, 9, 9, 8, 7, 5, 2]);
  });

  it("rejects a bad level, score, or bonus-array length", () => {
    expect(() =>
      priestSpellSlots({ priestLevel: 0, wisdomScore: 12, wisdomBonusSpells: NO_BONUS }),
    ).toThrow(RangeError);
    expect(() =>
      priestSpellSlots({ priestLevel: 5, wisdomScore: 0, wisdomBonusSpells: NO_BONUS }),
    ).toThrow(RangeError);
    expect(() =>
      priestSpellSlots({ priestLevel: 5, wisdomScore: 12, wisdomBonusSpells: [0, 0, 0] }),
    ).toThrow(RangeError);
  });
});
