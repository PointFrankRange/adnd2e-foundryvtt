import { describe, expect, it } from "vitest";
import { assertAbilityScore } from "../../src/core/errors";

describe("assertAbilityScore", () => {
  it("accepts integers 1..25", () => {
    expect(() => assertAbilityScore(1, "str")).not.toThrow();
    expect(() => assertAbilityScore(18, "str")).not.toThrow();
    expect(() => assertAbilityScore(25, "str")).not.toThrow();
  });
  it("rejects out-of-range and non-integers with RangeError", () => {
    expect(() => assertAbilityScore(0, "str")).toThrow(RangeError);
    expect(() => assertAbilityScore(26, "str")).toThrow(RangeError);
    expect(() => assertAbilityScore(12.5, "str")).toThrow(RangeError);
    expect(() => assertAbilityScore(Number.NaN, "str")).toThrow(RangeError);
  });
  it("names the offending ability in the message", () => {
    expect(() => assertAbilityScore(0, "wis")).toThrow(/wis/);
  });
});
