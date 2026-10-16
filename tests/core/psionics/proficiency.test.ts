import { describe, expect, it } from "vitest";
import {
  applyRecovery, FOCUS_SECONDS, focusModifier, harnessBonusPsp, harnessEndPool, HARNESS_SECONDS, knownPsionicProficiencies, proficiencyExpired, recoveryPerHour,
} from "../../../src/core/psionics";

describe("Harness Subconscious", () => {
  it("adds 20% of the usual maximum, rounded up", () => {
    expect(harnessBonusPsp(73)).toBe(15);
    expect(harnessBonusPsp(30)).toBe(6);
    expect(harnessBonusPsp(0)).toBe(0);
  });
  it("loses the gained points at the end but never goes below 0", () => {
    expect(harnessEndPool(88, 15)).toBe(73);
    expect(harnessEndPool(10, 15)).toBe(0);
  });
  it("lasts 72 hours and Meditative Focus 24", () => {
    expect(HARNESS_SECONDS).toBe(259200);
    expect(FOCUS_SECONDS).toBe(86400);
  });
  it("recovery is capped at the usual maximum, so the bonus cannot be regained", () => {
    expect(applyRecovery(60, 73, "sleep", 8)).toBe(73);
    expect(applyRecovery(80, 73, "sleep", 8)).toBe(80); // above the usual maximum: nothing recovered, nothing lost
  });
});

describe("Meditative Focus", () => {
  it("+2 to the chosen discipline, -1 to the others", () => {
    expect(focusModifier("telepathy", "telepathy", 10)).toBe(2);
    expect(focusModifier("telepathy", "psychokinesis", 10)).toBe(-1);
  });
  it("nothing without a focus or with an empty pool", () => {
    expect(focusModifier("", "telepathy", 10)).toBe(0);
    expect(focusModifier("telepathy", "telepathy", 0)).toBe(0);
  });
});

describe("helpers", () => {
  it("proficiencyExpired compares to the world time (null = never)", () => {
    expect(proficiencyExpired(null, 999)).toBe(false);
    expect(proficiencyExpired(100, 99)).toBe(false);
    expect(proficiencyExpired(100, 100)).toBe(true);
  });
  it("knownPsionicProficiencies reads the three names", () => {
    expect(knownPsionicProficiencies(["Hypnosis"])).toEqual({ harness: false, focus: false, rejuvenation: false });
    expect(knownPsionicProficiencies(["Harness Subconscious", "Rejuvenation"])).toEqual({ harness: true, focus: false, rejuvenation: true });
    expect(knownPsionicProficiencies(["Meditative Focus"]).focus).toBe(true);
  });
  it("meditating (Rejuvenation) recovers at the sleeping rate", () => {
    expect(recoveryPerHour("meditate")).toBe(recoveryPerHour("sleep"));
  });
});
