import { describe, expect, it } from "vitest";
import { SPECIALIST_ATTACKS_PER_ROUND, specialistAttacksPerRound } from "../../../src/core/weapons/specialist-attacks";

describe("SPECIALIST_ATTACKS_PER_ROUND (PHB Table 35)", () => {
  it("matches the table", () => {
    expect(SPECIALIST_ATTACKS_PER_ROUND["1-6"].melee).toEqual({ attacks: 3, rounds: 2 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["1-6"]["heavy-crossbow"]).toEqual({ attacks: 1, rounds: 2 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["7-12"].melee).toEqual({ attacks: 2, rounds: 1 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["7-12"]["thrown-dart"]).toEqual({ attacks: 5, rounds: 1 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["13+"].melee).toEqual({ attacks: 5, rounds: 2 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["13+"]["light-crossbow"]).toEqual({ attacks: 2, rounds: 1 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["13+"]["other-missile"]).toEqual({ attacks: 5, rounds: 2 });
  });
});

describe("specialistAttacksPerRound()", () => {
  it("selects the level band", () => {
    expect(specialistAttacksPerRound(1, "melee")).toEqual({ attacks: 3, rounds: 2 });
    expect(specialistAttacksPerRound(6, "melee")).toEqual({ attacks: 3, rounds: 2 });
    expect(specialistAttacksPerRound(7, "melee")).toEqual({ attacks: 2, rounds: 1 });
    expect(specialistAttacksPerRound(12, "melee")).toEqual({ attacks: 2, rounds: 1 });
    expect(specialistAttacksPerRound(13, "melee")).toEqual({ attacks: 5, rounds: 2 });
    expect(specialistAttacksPerRound(20, "thrown-dagger")).toEqual({ attacks: 5, rounds: 1 });
  });
  it("rejects a bad level", () => {
    expect(() => specialistAttacksPerRound(0, "melee")).toThrow(RangeError);
  });
});
