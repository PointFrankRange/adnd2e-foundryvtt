import { describe, expect, it } from "vitest";
import { BASE_MOVEMENT, modifiedMovementRate, encumbrancePenalty } from "../../../src/core/encumbrance/movement";

describe("BASE_MOVEMENT (PHB Table 64)", () => {
  it("is 12 for human/elf/half-elf, 6 for dwarf/gnome/halfling", () => {
    expect(BASE_MOVEMENT).toEqual({
      human: 12, elf: 12, "half-elf": 12, dwarf: 6, gnome: 6, halfling: 6,
    });
  });
});

describe("modifiedMovementRate() — category rule", () => {
  const base = { baseMove: 12, strengthScore: 18, weightAllowance: 110, maxPress: 255, rule: "category" as const };
  it("multiplies base move by the category fraction", () => {
    expect(modifiedMovementRate({ ...base, carried: 50 })).toEqual({ rate: 12, category: "unencumbered" });
    expect(modifiedMovementRate({ ...base, carried: 130 })).toEqual({ rate: 8, category: "light" }); // floor(12*2/3)
    expect(modifiedMovementRate({ ...base, carried: 170 })).toEqual({ rate: 6, category: "moderate" }); // floor(12/2)
    expect(modifiedMovementRate({ ...base, carried: 210 })).toEqual({ rate: 4, category: "heavy" }); // floor(12/3)
    expect(modifiedMovementRate({ ...base, carried: 250 })).toEqual({ rate: 1, category: "severe" });
    expect(modifiedMovementRate({ ...base, carried: 300 })).toEqual({ rate: 0, category: "immobile" });
  });
  it("base-6 race, light load", () => {
    expect(
      modifiedMovementRate({ baseMove: 6, strengthScore: 12, weightAllowance: 45, maxPress: 140, rule: "category", carried: 60 }),
    ).toEqual({ rate: 4, category: "light" }); // floor(6*2/3)
  });
});

describe("modifiedMovementRate() — table48 rule", () => {
  it("carried exactly at a threshold uses that column (inclusive ceiling)", () => {
    // STR 18, allowance 110, step 13: threshold(0)=110, threshold(1)=123
    const atAllowance = modifiedMovementRate({
      baseMove: 12, carried: 110, strengthScore: 18, weightAllowance: 110, maxPress: 255, rule: "table48",
    });
    expect(atAllowance).toEqual({ rate: 12, category: "unencumbered" });
    const atNext = modifiedMovementRate({
      baseMove: 12, carried: 123, strengthScore: 18, weightAllowance: 110, maxPress: 255, rule: "table48",
    });
    expect(atNext.rate).toBe(11);
  });
  it("PHB Tarus example: base 12, STR 17 (allowance 85), 140 lbs -> rate 7", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 140, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(7); // thresholds 85,97,109,121,133,145,... first >= 140 is 145 (index 5) -> HEADERS[12][5] = 7
  });
  it("unencumbered stays at base", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 10, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(12);
  });
  it("staggering (past the last threshold but within max press) -> 1", () => {
    // STR 17 threshold(11) = 85 + 11*12 = 217; maxPress 220
    const r = modifiedMovementRate({
      baseMove: 12, carried: 219, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(1);
  });
  it("over max press -> 0", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 221, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(0);
  });
  it("base-6 tier uses the lower headers", () => {
    // STR 12 allowance 45 step 8: thresholds 45,53,61,...; carried 55 -> first > 55 is 61 (index 2) -> HEADERS[6][2] = 5
    const r = modifiedMovementRate({
      baseMove: 6, carried: 55, strengthScore: 12, weightAllowance: 45, maxPress: 140, rule: "table48",
    });
    expect(r.rate).toBe(5);
  });
  it("STR <= 3 sparse row", () => {
    const at6 = modifiedMovementRate({ baseMove: 12, carried: 6, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(at6.rate).toBe(10);
    const at9 = modifiedMovementRate({ baseMove: 12, carried: 9, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(at9.rate).toBe(3);
    const pastMax = modifiedMovementRate({ baseMove: 12, carried: 10, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(pastMax.rate).toBe(1); // Beyond all STR3_ROW entries but within maxPress
    const over = modifiedMovementRate({ baseMove: 12, carried: 11, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(over.rate).toBe(0);
  });
  it("non-STR3 carried > maxPress", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 221, strengthScore: 18, weightAllowance: 110, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(0);
  });
});

describe("encumbrancePenalty() (PHB p.79)", () => {
  it("no penalty above half move", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 8 })).toEqual({ attackRoll: 0, armorClass: 0 });
  });
  it("half move -> -1 attack", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 6 })).toEqual({ attackRoll: -1, armorClass: 0 });
  });
  it("a third or less -> -2 attack / +1 AC", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 4 })).toEqual({ attackRoll: -2, armorClass: 1 });
  });
  it("reduced to 1 -> -4 attack / +3 AC", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 1 })).toEqual({ attackRoll: -4, armorClass: 3 });
  });
  it("a naturally slow (base 1) creature is not penalised", () => {
    expect(encumbrancePenalty({ baseMove: 1, currentMove: 1 })).toEqual({ attackRoll: 0, armorClass: 0 });
  });
  it("immobile (move 0) is at least as bad as staggering", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 0 })).toEqual({ attackRoll: -4, armorClass: 3 });
  });
});
