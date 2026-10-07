import { describe, expect, it } from "vitest";
import { awardWithPrimeBonus, primeRequisiteXpBonus } from "../../../src/core/abilities/index";

describe("primeRequisiteXpBonus", () => {
  const scores = { str: 16, dex: 16, con: 10, int: 12, wis: 15, cha: 17 };
  it("single prime requisite met", () => {
    expect(primeRequisiteXpBonus(["str"], scores)).toBe(true);
    expect(primeRequisiteXpBonus(["wis"], scores)).toBe(false); // 15
  });
  it("multi prime requisite needs 16+ in every one", () => {
    expect(primeRequisiteXpBonus(["str", "cha"], scores)).toBe(true); // 16 & 17
    expect(primeRequisiteXpBonus(["str", "dex", "wis"], scores)).toBe(false); // wis 15
    expect(primeRequisiteXpBonus(["dex", "cha"], scores)).toBe(true);
  });
  it("empty list is vacuously true", () => {
    expect(primeRequisiteXpBonus([], scores)).toBe(true);
  });
});

describe("awardWithPrimeBonus", () => {
  const hi = { str: 16, int: 17 };
  it("adds 10% (rounded down) when every prime is 16+ and the rule is on", () => {
    expect(awardWithPrimeBonus(1000, ["str"], hi, true)).toEqual({ amount: 1100, bonus: 100 });
    expect(awardWithPrimeBonus(555, ["str", "int"], hi, true)).toEqual({ amount: 610, bonus: 55 });
  });
  it("gives nothing when the rule is off, a prime is below 16 or missing, or there are no primes", () => {
    expect(awardWithPrimeBonus(1000, ["str"], hi, false).bonus).toBe(0);
    expect(awardWithPrimeBonus(1000, ["str", "wis"], { ...hi, wis: 15 }, true).bonus).toBe(0);
    expect(awardWithPrimeBonus(1000, ["wis"], hi, true)).toEqual({ amount: 1000, bonus: 0 });
    expect(awardWithPrimeBonus(1000, [], hi, true).bonus).toBe(0);
  });
});
