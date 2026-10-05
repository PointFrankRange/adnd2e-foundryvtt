import { describe, expect, it } from "vitest";
import { deriveSaves } from "../../../../src/data/derive/character/saves";

describe("deriveSaves", () => {
  it("single group: target/rollModifier/effectiveTarget per category", () => {
    const s = deriveSaves({
      groups: [{ group: "warrior", level: 7 }], race: "human", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(Object.keys(s).sort()).toEqual(["bw", "pp", "ppd", "rsw", "spell"]);
    expect(s.bw.target).toBe(12); // warrior band minLevel 7
    expect(s.bw.effectiveTarget).toBe(s.bw.target - s.bw.rollModifier);
  });

  it("dwarf CON 16 gets the +4 racial bonus vs rod/staff/wand", () => {
    const s = deriveSaves({
      groups: [{ group: "warrior", level: 1 }], race: "dwarf", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(s.rsw.rollModifier).toBeGreaterThan(0);
  });

  it("two groups: each category takes the better (lower) base", () => {
    // warrior L5 band = [ppd 11, rsw 13, pp 12, bw 13, spell 14]
    // wizard  L6 band = [ppd 13, rsw  9, pp 11, bw 13, spell 10]
    const s = deriveSaves({
      groups: [{ group: "warrior", level: 5 }, { group: "wizard", level: 6 }],
      race: "elf", con: 14, wisMagicalDefenseAdj: 0, dexDefensiveAdj: -2,
    });
    expect(s.ppd.target).toBe(11);
    expect(s.rsw.target).toBe(9);
    expect(s.pp.target).toBe(11);
    expect(s.spell.target).toBe(10);
    expect(s.bw.target).toBe(13);
    expect(s.bw.rollModifier).toBe(2); // breath weapon: -(-2)
  });
  it("a subrace Constitution-save adjustment raises the racial bonus only for a race that qualifies (SP12 Plan A)", () => {
    const input = { groups: [{ group: "warrior" as const, level: 3 }], race: "dwarf" as const, con: 15, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0 };
    const plain = deriveSaves(input);
    const deep = deriveSaves({ ...input, racialSaveAdjustment: 1 });
    expect(deep.rsw.rollModifier).toBe(plain.rsw.rollModifier + 1);
    expect(deep.spell.rollModifier).toBe(plain.spell.rollModifier + 1);
    expect(deep.pp.rollModifier).toBe(plain.pp.rollModifier); // paralysis is not a racial-bonus save
    const human = deriveSaves({ ...input, race: "human", racialSaveAdjustment: 1 });
    expect(human.rsw.rollModifier).toBe(0);
  });
});
