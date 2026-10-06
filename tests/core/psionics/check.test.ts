import { describe, expect, it } from "vitest";
import { checkCost, powerScore, rollPowerCheck } from "../../../src/core/psionics";

describe("powerScore", () => {
  it("is the ability score plus the modifier", () => {
    expect(powerScore(16, -3)).toBe(13);
    expect(powerScore(15, 0)).toBe(15);
  });
});

describe("rollPowerCheck", () => {
  it("at or under the score succeeds; over fails", () => {
    expect(rollPowerCheck(10, 10)).toEqual({ result: "success", success: true, special: true });
    expect(rollPowerCheck(9, 10)).toEqual({ result: "success", success: true, special: false });
    expect(rollPowerCheck(11, 10)).toEqual({ result: "failure", success: false, special: false });
  });
  it("a natural 20 always fails, even against a huge score", () => {
    expect(rollPowerCheck(20, 30)).toEqual({ result: "automatic-failure", success: false, special: false });
    expect(rollPowerCheck(20, 20).success).toBe(false);
  });
  it("a natural 1 always succeeds, even against a negative score (minimum success)", () => {
    expect(rollPowerCheck(1, -4)).toEqual({ result: "minimum-success", success: true, special: false });
    expect(rollPowerCheck(1, 0).result).toBe("minimum-success");
  });
  it("a 1 against a score of 1 or more is an ordinary success; special when the roll equals the score", () => {
    expect(rollPowerCheck(1, 5)).toEqual({ result: "success", success: true, special: false });
    expect(rollPowerCheck(1, 1)).toEqual({ result: "success", success: true, special: true });
  });
});

describe("checkCost", () => {
  it("success pays the full cost; failure pays half, rounded up", () => {
    expect(checkCost(7, true)).toBe(7);
    expect(checkCost(7, false)).toBe(4);
    expect(checkCost(8, false)).toBe(4);
    expect(checkCost(0, false)).toBe(0);
  });
});
