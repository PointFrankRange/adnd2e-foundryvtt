import { describe, expect, it } from "vitest";
import { applyRecovery, recoveryPerHour } from "../../../src/core/psionics";

describe("Table 6", () => {
  it("per-hour rates: hard exertion none, walking/riding 3, sitting/resting/reading 6, rejuvenating/sleeping 12", () => {
    expect((["hard", "light", "rest", "sleep"] as const).map(recoveryPerHour)).toEqual([0, 3, 6, 12]);
  });
  it("applyRecovery adds hours x rate, never above the maximum or below the current", () => {
    expect(applyRecovery(10, 40, "sleep", 2)).toBe(34);
    expect(applyRecovery(10, 40, "sleep", 10)).toBe(40);
    expect(applyRecovery(10, 40, "hard", 8)).toBe(10);
    expect(applyRecovery(45, 40, "rest", 1)).toBe(45);
    expect(applyRecovery(10, 40, "rest", 0)).toBe(10);
  });
});
