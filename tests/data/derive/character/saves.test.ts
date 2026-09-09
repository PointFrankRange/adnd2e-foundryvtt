import { describe, expect, it } from "vitest";
import { deriveSaves } from "../../../../src/data/derive/character/saves";

describe("deriveSaves", () => {
  it("returns a target/rollModifier/effectiveTarget per category", () => {
    const s = deriveSaves({
      group: "warrior", level: 7, race: "human", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(Object.keys(s).sort()).toEqual(["bw", "pp", "ppd", "rsw", "spell"]);
    // warrior L7 breath-weapon base save = 12 (SAVE_MATRICES warrior band minLevel 7)
    expect(s.bw.target).toBe(12);
    expect(s.bw.effectiveTarget).toBe(s.bw.target - s.bw.rollModifier);
  });
  it("dwarf CON 16 gets the +3 racial bonus vs rod/staff/wand and spell", () => {
    const s = deriveSaves({
      group: "warrior", level: 1, race: "dwarf", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(s.rsw.rollModifier).toBeGreaterThan(0);
  });
});
