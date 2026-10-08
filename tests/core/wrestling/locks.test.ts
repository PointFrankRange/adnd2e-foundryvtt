import { describe, expect, it } from "vitest";
import { LOCK_SPECS, canUseLock, lockDamageFormula, nextPressCount } from "../../../src/core/wrestling";

describe("LOCK_SPECS", () => {
  it("covers the seven lock effects", () => {
    expect(Object.keys(LOCK_SPECS).sort()).toEqual(["carry", "hammer", "manipulate", "press", "slam", "takedown", "throw"]);
  });
  it("throw frees the target; takedown, slam and throw all leave it prone", () => {
    expect(LOCK_SPECS.throw).toMatchObject({ frees: true, prone: true });
    expect(LOCK_SPECS.takedown).toMatchObject({ frees: false, prone: true });
    expect(LOCK_SPECS.slam).toMatchObject({ frees: false, prone: true, dropsToHold: true });
    expect(LOCK_SPECS.press.prone).toBe(false);
  });
});

describe("lockDamageFormula", () => {
  const ctx = { pressCount: 1, hardSurface: false, strengthAdj: 0 };
  it("returns the dice per effect, adding the holder's Strength damage adjustment", () => {
    expect(lockDamageFormula("takedown", ctx)).toBe("1d3");
    expect(lockDamageFormula("hammer", { ...ctx, strengthAdj: 1 })).toBe("1d2+1");
    expect(lockDamageFormula("manipulate", ctx)).toBe("1d2");
    expect(lockDamageFormula("carry", ctx)).toBeNull();
  });
  it("throw and slam gain +1 on hard ground", () => {
    expect(lockDamageFormula("throw", ctx)).toBe("1d4");
    expect(lockDamageFormula("throw", { ...ctx, hardSurface: true })).toBe("1d4+1");
    expect(lockDamageFormula("slam", ctx)).toBe("1d8");
    expect(lockDamageFormula("slam", { ...ctx, hardSurface: true, strengthAdj: 2 })).toBe("1d8+3");
  });
  it("press escalates +1 per consecutive repeat", () => {
    expect(lockDamageFormula("press", { ...ctx, pressCount: 1 })).toBe("1d6+1");
    expect(lockDamageFormula("press", { ...ctx, pressCount: 5, strengthAdj: 1 })).toBe("1d6+6");
  });
  it("a negative Strength adjustment is written with a minus sign", () => {
    expect(lockDamageFormula("takedown", { ...ctx, strengthAdj: -1 })).toBe("1d3-1");
  });
});

describe("canUseLock", () => {
  it("throw and slam cannot be used on a target two or more size classes larger", () => {
    expect(canUseLock("throw", "medium", "huge")).toBe(false);
    expect(canUseLock("slam", "medium", "large")).toBe(true);
    expect(canUseLock("press", "small", "gargantuan")).toBe(true);
  });
});

describe("nextPressCount", () => {
  it("counts consecutive presses and resets on any other lock", () => {
    expect(nextPressCount(null, 0, "press")).toBe(1);
    expect(nextPressCount("press", 1, "press")).toBe(2);
    expect(nextPressCount("press", 3, "hammer")).toBe(0);
    expect(nextPressCount("takedown", 0, "press")).toBe(1);
  });
});
