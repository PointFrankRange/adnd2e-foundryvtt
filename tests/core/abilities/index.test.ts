import { describe, expect, it } from "vitest";
import { primeRequisiteXpBonus } from "../../../src/core/abilities/index";

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
