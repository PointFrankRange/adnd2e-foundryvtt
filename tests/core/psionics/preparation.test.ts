import { describe, expect, it } from "vitest";
import { canCompletePrep, prepCompleteRound, preparationRounds } from "../../../src/core/psionics";

describe("preparationRounds (the pack's preparation strings)", () => {
  it("bare numbers are rounds; zero is no preparation", () => {
    expect(preparationRounds("1")).toBe(1);
    expect(preparationRounds(" 5 ")).toBe(5);
    expect(preparationRounds("10")).toBe(10);
    expect(preparationRounds("0")).toBeNull();
  });
  it("rounds and turns are read; a turn is 10 rounds", () => {
    expect(preparationRounds("10 rnds.")).toBe(10);
    expect(preparationRounds("2 rounds")).toBe(2);
    expect(preparationRounds("1 rnd")).toBe(1);
    expect(preparationRounds("1 turn")).toBe(10);
    expect(preparationRounds("2 Turns")).toBe(20);
    expect(preparationRounds("0 rnds.")).toBeNull();
    expect(preparationRounds("0 turns")).toBeNull();
  });
  it("hours and variable or unknown times are not tracked in rounds", () => {
    for (const t of ["24 hrs.", "2 hrs.", "1 rnd./point", "1/increase", "# spliced", "", "unlimited"]) expect(preparationRounds(t), t).toBeNull();
  });
});

describe("prepCompleteRound / canCompletePrep", () => {
  it("the start round counts as the first round of preparation", () => {
    expect(prepCompleteRound(1, 4)).toBe(4);
    expect(prepCompleteRound(3, 4)).toBe(6);
  });
  it("completes once the combat reaches the last round", () => {
    expect(canCompletePrep(6, 5)).toBe(false);
    expect(canCompletePrep(6, 6)).toBe(true);
    expect(canCompletePrep(6, 9)).toBe(true);
    expect(canCompletePrep(null, 9)).toBe(false);
  });
});
