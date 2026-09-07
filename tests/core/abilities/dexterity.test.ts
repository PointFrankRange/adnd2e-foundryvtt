import { describe, expect, it } from "vitest";
import { dexterity } from "../../../src/core/abilities/dexterity";

const rows: Array<[number, number, number, number]> = [
  // score, reactionAdj, missileAttackAdj, defensiveAdj
  [1, -6, -6, 5], [2, -4, -4, 5], [3, -3, -3, 4], [4, -2, -2, 3], [5, -1, -1, 2],
  [6, 0, 0, 1], [7, 0, 0, 0], [9, 0, 0, 0], [10, 0, 0, 0], [14, 0, 0, 0],
  [15, 0, 0, -1], [16, 1, 1, -2], [17, 2, 2, -3], [18, 2, 2, -4], [19, 3, 3, -4],
  [20, 3, 3, -4], [21, 4, 4, -5], [22, 4, 4, -5], [23, 4, 4, -5], [24, 5, 5, -6], [25, 5, 5, -6],
];

describe("dexterity()", () => {
  it.each(rows)("score %i", (score, reactionAdj, missileAttackAdj, defensiveAdj) => {
    expect(dexterity(score)).toEqual({ reactionAdj, missileAttackAdj, defensiveAdj });
  });
  it("rejects invalid", () => {
    expect(() => dexterity(0)).toThrow(RangeError);
    expect(() => dexterity(26)).toThrow(RangeError);
  });
});
