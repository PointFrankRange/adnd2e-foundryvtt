import { describe, expect, it } from "vitest";
import { characterHpMax } from "../../../../src/data/derive/character/hp";

describe("characterHpMax", () => {
  it("sums entered rolls + CON adjustment per rolled level", () => {
    // fighter L3, CON adj +2, rolls [8,6,7] -> (8+6+7) + 3*2 = 27
    expect(characterHpMax("fighter", 3, [8, 6, 7], 2)).toBe(27);
  });
  it("un-rolled levels contribute 0 (Ruling HP1)", () => {
    // fighter L3, only 2 rolls entered -> (8+6) + 2*2 = 18
    expect(characterHpMax("fighter", 3, [8, 6], 2)).toBe(18);
  });
  it("adds the flat post-name-level bonus for rolled levels past the CON cutoff", () => {
    // fighter cutoff 9, hpAfterNameLevel 3; L11 with 11 rolls of 1 + CON adj 0
    // = Σrolls(11) + 9*0 (CON only to cutoff) + 2*3 (levels 10,11 flat) = 11 + 6 = 17
    expect(characterHpMax("fighter", 11, Array(11).fill(1), 0)).toBe(17);
  });
  it("CON adjustment only applies up to the cutoff level", () => {
    // fighter cutoff 9, L10, 10 rolls of 5, CON adj +2 -> Σ(50) + 9*2 + 1*3 = 50 + 18 + 3 = 71
    expect(characterHpMax("fighter", 10, Array(10).fill(5), 2)).toBe(71);
  });
});
