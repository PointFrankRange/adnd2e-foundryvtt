import { describe, expect, it } from "vitest";
import { deriveThac0 } from "../../../../src/data/derive/character/thac0";

describe("deriveThac0", () => {
  it("base from the class table; melee subtracts STR hit prob, ranged subtracts DEX missile adj", () => {
    // warrior L7 base = 20 - 1*floor(6/1) = 14; STR 17 hitProb 1; DEX 16 missileAdj 1
    expect(deriveThac0("warrior", 7, 1, 1)).toEqual({ base: 14, melee: 13, ranged: 13 });
  });
  it("no ability bonuses -> melee == ranged == base", () => {
    expect(deriveThac0("wizard", 1, 0, 0)).toEqual({ base: 20, melee: 20, ranged: 20 });
  });
});
