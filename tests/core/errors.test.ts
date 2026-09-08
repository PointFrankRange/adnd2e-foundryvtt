import { describe, expect, it } from "vitest";
import { assertAbilityScore, assertLevel, assertXp, assertD20 } from "../../src/core/errors";

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

describe("assertLevel", () => {
  it("accepts integers >= 1", () => {
    expect(() => assertLevel(1)).not.toThrow();
    expect(() => assertLevel(20)).not.toThrow();
    expect(() => assertLevel(41)).not.toThrow();
  });
  it("rejects < 1 and non-integers", () => {
    expect(() => assertLevel(0)).toThrow(RangeError);
    expect(() => assertLevel(-1)).toThrow(RangeError);
    expect(() => assertLevel(3.5)).toThrow(RangeError);
    expect(() => assertLevel(Number.NaN)).toThrow(RangeError);
  });
  it("includes the label when given", () => {
    expect(() => assertLevel(0, "class level")).toThrow(/class level/);
  });
});

describe("assertXp", () => {
  it("accepts integers >= 0", () => {
    expect(() => assertXp(0)).not.toThrow();
    expect(() => assertXp(250000)).not.toThrow();
  });
  it("rejects < 0 and non-integers", () => {
    expect(() => assertXp(-1)).toThrow(RangeError);
    expect(() => assertXp(12.5)).toThrow(RangeError);
  });
});

describe("assertD20", () => {
  it("accepts integers 1..20", () => {
    expect(() => assertD20(1)).not.toThrow();
    expect(() => assertD20(20)).not.toThrow();
  });
  it("rejects out-of-range and non-integers", () => {
    expect(() => assertD20(0)).toThrow(RangeError);
    expect(() => assertD20(21)).toThrow(RangeError);
    expect(() => assertD20(7.5)).toThrow(RangeError);
    expect(() => assertD20(Number.NaN)).toThrow(RangeError);
  });
});
