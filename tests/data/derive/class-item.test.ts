import { describe, expect, it } from "vitest";
import { levelForXp } from "../../../src/core/classes/progression";
import { getChassis } from "../../../src/core/classes/chassis";
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

  it("classItemLevel and classItemCanLevelUp honor level rules, defaulting to none (SP13)", () => {
    expect(classItemLevel("fighter", 5_000_000)).toBe(levelForXp(getChassis("fighter"), 5_000_000));
    expect(classItemLevel("fighter", 5_000_000, 0, { limit: 15, beyondMultiplier: 0 })).toBe(15);
    expect(classItemLevel("fighter", 2_250_000, 0, { limit: 15, beyondMultiplier: 2 })).toBe(16);
    expect(classItemCanLevelUp("fighter", 5_000_000, 15, 0, { limit: 15, beyondMultiplier: 0 })).toBe(false);
    expect(classItemCanLevelUp("fighter", 5_000_000, 14, 0, { limit: 15, beyondMultiplier: 0 })).toBe(true);
  });
});
