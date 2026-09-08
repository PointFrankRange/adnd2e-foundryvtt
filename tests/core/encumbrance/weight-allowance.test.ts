import { describe, expect, it } from "vitest";
import {
  encumbranceStep,
  maxCarriedWeight,
  encumbranceThresholds,
  encumbranceCategory,
} from "../../../src/core/encumbrance/weight-allowance";

describe("encumbranceStep()", () => {
  it("matches the PHB per-score step (Tables 47/48)", () => {
    expect(encumbranceStep(4)).toBe(1);
    expect(encumbranceStep(5)).toBe(1);
    expect(encumbranceStep(7)).toBe(3);
    expect(encumbranceStep(9)).toBe(5);
    expect(encumbranceStep(11)).toBe(6);
    expect(encumbranceStep(13)).toBe(8);
    expect(encumbranceStep(15)).toBe(10);
    expect(encumbranceStep(16)).toBe(10);
    expect(encumbranceStep(17)).toBe(12);
    expect(encumbranceStep(18)).toBe(13);
    expect(encumbranceStep(19)).toBe(13); // extrapolated
    expect(encumbranceStep(3)).toBe(5); // special-case placeholder
  });
  it("rejects a bad score", () => {
    expect(() => encumbranceStep(0)).toThrow(RangeError);
    expect(() => encumbranceStep(26)).toThrow(RangeError);
  });
});

describe("maxCarriedWeight()", () => {
  it("is the Strength max press", () => {
    expect(maxCarriedWeight(255)).toBe(255);
  });
});

describe("encumbranceThresholds()", () => {
  it("STR 18 (allowance 110, step 13) — the twelve Table 48 columns", () => {
    expect(encumbranceThresholds({ strengthScore: 18, weightAllowance: 110 })).toEqual([
      110, 123, 136, 149, 162, 175, 188, 201, 214, 227, 240, 253,
    ]);
  });
  it("STR <= 3 returns the sparse ceiling list", () => {
    expect(encumbranceThresholds({ strengthScore: 3, weightAllowance: 5 })).toEqual([5, 6, 7, 8, 9]);
  });
});

describe("encumbranceCategory()", () => {
  const str18 = { strengthScore: 18, weightAllowance: 110, maxPress: 255 };
  it("STR 18 bands (PHB Table 47: 0-110 / 111-149 / 150-188 / 189-227 / 228-255)", () => {
    expect(encumbranceCategory({ ...str18, carried: 0 })).toBe("unencumbered");
    expect(encumbranceCategory({ ...str18, carried: 110 })).toBe("unencumbered");
    expect(encumbranceCategory({ ...str18, carried: 111 })).toBe("light");
    expect(encumbranceCategory({ ...str18, carried: 149 })).toBe("light");
    expect(encumbranceCategory({ ...str18, carried: 150 })).toBe("moderate");
    expect(encumbranceCategory({ ...str18, carried: 188 })).toBe("moderate");
    expect(encumbranceCategory({ ...str18, carried: 189 })).toBe("heavy");
    expect(encumbranceCategory({ ...str18, carried: 227 })).toBe("heavy");
    expect(encumbranceCategory({ ...str18, carried: 228 })).toBe("severe");
    expect(encumbranceCategory({ ...str18, carried: 255 })).toBe("severe");
    expect(encumbranceCategory({ ...str18, carried: 256 })).toBe("immobile");
  });
  it("STR <= 3 sparse bands (PHB Table 47: 0-5 / 6 / 7 / 8-9 / 10)", () => {
    const s3 = { strengthScore: 3, weightAllowance: 5, maxPress: 10 };
    expect(encumbranceCategory({ ...s3, carried: 5 })).toBe("unencumbered");
    expect(encumbranceCategory({ ...s3, carried: 6 })).toBe("light");
    expect(encumbranceCategory({ ...s3, carried: 7 })).toBe("moderate");
    expect(encumbranceCategory({ ...s3, carried: 8 })).toBe("heavy");
    expect(encumbranceCategory({ ...s3, carried: 9 })).toBe("heavy");
    expect(encumbranceCategory({ ...s3, carried: 10 })).toBe("severe");
    expect(encumbranceCategory({ ...s3, carried: 11 })).toBe("immobile");
  });
  it("rejects a negative carried weight or bad score", () => {
    expect(() => encumbranceCategory({ ...str18, carried: -1 })).toThrow(RangeError);
    expect(() => encumbranceCategory({ carried: 10, strengthScore: 0, weightAllowance: 5, maxPress: 10 })).toThrow(RangeError);
  });
});
