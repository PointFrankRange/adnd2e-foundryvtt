import { describe, expect, it } from "vitest";
import { deriveEncumbrance } from "../../../../src/data/derive/character/encumbrance";

describe("deriveEncumbrance", () => {
  it("STR 12 (allowance 40, maxPress 115), carrying 30 -> unencumbered, full move", () => {
    const r = deriveEncumbrance({ carried: 30, strengthScore: 12, weightAllowance: 40, maxPress: 115, baseMove: 12 });
    expect(r.category).toBe("unencumbered");
    expect(r.movementRate).toBe(12);
    expect(r.penalty).toEqual({ attackRoll: 0, armorClass: 0 });
  });
  it("carrying past the allowance -> a lighter category + reduced move + penalties", () => {
    const r = deriveEncumbrance({ carried: 60, strengthScore: 12, weightAllowance: 40, maxPress: 115, baseMove: 12 });
    expect(r.category).not.toBe("unencumbered");
    expect(r.movementRate).toBeLessThan(12);
  });
  it("carries baseMove through for the sheet", () => {
    expect(deriveEncumbrance({ carried: 0, strengthScore: 12, weightAllowance: 40, maxPress: 115, baseMove: 9 }).baseMove).toBe(9);
  });
});
