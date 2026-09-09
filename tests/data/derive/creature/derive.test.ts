import { describe, expect, it } from "vitest";
import { deriveCreature } from "../../../../src/data/derive/creature/derive";
import type { CreatureSnapshot } from "../../../../src/data/derive/creature/snapshot";
import type { SaveCategory } from "../../../../src/core/types";

const explicit20: Record<SaveCategory, number> = { ppd: 20, rsw: 20, pp: 20, bw: 20, spell: 20 };

const base: CreatureSnapshot = {
  hd: { count: 3, dieType: 8, bonus: 0, fixedHp: null },
  thac0AsFighterLevel: null,
  authoredThac0: 17,
  saveMode: "explicit",
  explicitSaves: { ...explicit20 },
  asClassSave: { group: "", level: 1 },
};

describe("deriveCreature", () => {
  it("HP: average of the Hit Dice (d8 -> 5/die) plus the flat bonus", () => {
    // 3 * round((8+1)/2)=5 -> 15
    expect(deriveCreature(base).hpMax).toBe(15);
    // 5d8+5 -> 5*5 + 5 = 30
    expect(deriveCreature({ ...base, hd: { count: 5, dieType: 8, bonus: 5, fixedHp: null } }).hpMax).toBe(30);
    // d6 -> 4/die : 4d6 -> 16
    expect(deriveCreature({ ...base, hd: { count: 4, dieType: 6, bonus: 0, fixedHp: null } }).hpMax).toBe(16);
    // fractional HD floors: 0.5 * 5 = 2.5 -> 2
    expect(deriveCreature({ ...base, hd: { count: 0.5, dieType: 8, bonus: 0, fixedHp: null } }).hpMax).toBe(2);
  });

  it("HP: fixedHp overrides the HD average", () => {
    expect(deriveCreature({ ...base, hd: { count: 5, dieType: 8, bonus: 5, fixedHp: 22 } }).hpMax).toBe(22);
    expect(deriveCreature({ ...base, hd: { count: 3, dieType: 8, bonus: 0, fixedHp: 0 } }).hpMax).toBe(0);
  });

  it("THAC0: the fighter table when asFighterLevel is set, else the authored value", () => {
    expect(deriveCreature(base).thac0).toBe(17); // authored, asFighterLevel null
    expect(deriveCreature({ ...base, thac0AsFighterLevel: 5 }).thac0).toBe(16); // thac0("warrior",5)
    expect(deriveCreature({ ...base, thac0AsFighterLevel: 1 }).thac0).toBe(20);
  });

  it("saves: explicit mode passes the five authored numbers through", () => {
    const s = deriveCreature({ ...base, explicitSaves: { ppd: 12, rsw: 13, pp: 11, bw: 15, spell: 14 } });
    expect(s.saves).toEqual({ ppd: 12, rsw: 13, pp: 11, bw: 15, spell: 14 });
  });

  it("saves: asClass mode uses the class matrix at {group, level}", () => {
    const s = deriveCreature({ ...base, saveMode: "asClass", asClassSave: { group: "warrior", level: 5 } });
    // PHB Table 60 warrior band minLevel 5 = [ppd 11, rsw 13, pp 12, bw 13, spell 14]
    expect(s.saves).toEqual({ ppd: 11, rsw: 13, pp: 12, bw: 13, spell: 14 });
  });

  it("saves: asClass with an unset group falls back to the explicit numbers", () => {
    const s = deriveCreature({
      ...base,
      saveMode: "asClass",
      asClassSave: { group: "", level: 1 },
      explicitSaves: { ppd: 9, rsw: 9, pp: 9, bw: 9, spell: 9 },
    });
    expect(s.saves).toEqual({ ppd: 9, rsw: 9, pp: 9, bw: 9, spell: 9 });
  });
});
