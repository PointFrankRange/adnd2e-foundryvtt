import { describe, expect, it } from "vitest";
import { RANGER_STEALTH, rangerStealth } from "../../../src/core/classes/ranger";

describe("RANGER_STEALTH (PHB Table 18)", () => {
  it("16 rows of [hide, move]", () => {
    expect(RANGER_STEALTH).toHaveLength(16);
    expect(RANGER_STEALTH[0]).toEqual([10, 15]);
    expect(RANGER_STEALTH[15]).toEqual([99, 99]);
  });
});

describe("rangerStealth()", () => {
  it("reads the level row", () => {
    expect(rangerStealth(1)).toEqual({ hideInShadows: 10, moveSilently: 15 });
    expect(rangerStealth(8)).toEqual({ hideInShadows: 49, moveSilently: 62 });
    expect(rangerStealth(13)).toEqual({ hideInShadows: 85, moveSilently: 99 });
  });
  it("above 16 reuses the level-16 row", () => {
    expect(rangerStealth(20)).toEqual({ hideInShadows: 99, moveSilently: 99 });
  });
  it("rejects a bad level", () => {
    expect(() => rangerStealth(0)).toThrow(RangeError);
  });
});
