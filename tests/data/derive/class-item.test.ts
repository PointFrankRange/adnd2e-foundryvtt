import { describe, expect, it } from "vitest";
import { classItemLevel, classItemCanLevelUp } from "../../../src/data/derive/class-item";

describe("classItemLevel", () => {
  it("resolves the engine level for the class's own XP", () => {
    expect(classItemLevel("fighter", 0)).toBe(1);
    expect(classItemLevel("fighter", 4000)).toBe(3);
    expect(classItemLevel("mage", 250000)).toBe(10);
  });
  it("honours the class's intrinsic level cap", () => {
    expect(classItemLevel("druid", 999_000_000)).toBe(14);
  });
});

describe("classItemCanLevelUp", () => {
  it("true when the resolved level exceeds the number of HD rolls recorded", () => {
    expect(classItemCanLevelUp("fighter", 4000, 2)).toBe(true); // level 3, 2 rolls
    expect(classItemCanLevelUp("fighter", 4000, 3)).toBe(false); // level 3, 3 rolls
    expect(classItemCanLevelUp("fighter", 0, 0)).toBe(true); // level 1, 0 rolls
  });
});
