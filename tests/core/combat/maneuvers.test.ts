import { describe, expect, it } from "vitest";
import { MANEUVERS, resolveManeuverOutcome } from "../../../src/core/combat/maneuvers";

describe("MANEUVERS table", () => {
  it("has exactly 3 called-shot locations with escalating penalties", () => {
    expect(MANEUVERS.calledShotHead).toEqual({
      attackPenalty: -8, category: "calledShot",
      effect: { kind: "condition", conditionId: "stunned" },
    });
    expect(MANEUVERS.calledShotHand).toEqual({
      attackPenalty: -6, category: "calledShot",
      effect: { kind: "unequip" },
    });
    expect(MANEUVERS.calledShotLeg).toEqual({
      attackPenalty: -4, category: "calledShot",
      effect: { kind: "condition", conditionId: "prone" },
    });
  });

  it("has exactly 4 curated maneuvers, each a flat -2 penalty", () => {
    expect(MANEUVERS.disarm).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "unequip" },
    });
    expect(MANEUVERS.tripKnockDown).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "condition", conditionId: "prone" },
    });
    expect(MANEUVERS.grapple).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "condition", conditionId: "held" },
    });
    expect(MANEUVERS.bullRush).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "push" },
    });
  });

  it("has exactly 7 entries total", () => {
    expect(Object.keys(MANEUVERS)).toHaveLength(7);
  });
});

describe("resolveManeuverOutcome", () => {
  it("returns null when no maneuver was selected", () => {
    expect(resolveManeuverOutcome(null, true)).toBeNull();
  });

  it("returns null when the attack missed, regardless of which maneuver was selected", () => {
    expect(resolveManeuverOutcome("disarm", false)).toBeNull();
    expect(resolveManeuverOutcome("calledShotHead", false)).toBeNull();
  });

  it("returns the condition effect for a hit called shot to the head", () => {
    expect(resolveManeuverOutcome("calledShotHead", true)).toEqual({ kind: "condition", conditionId: "stunned" });
  });

  it("returns the unequip effect for a hit disarm", () => {
    expect(resolveManeuverOutcome("disarm", true)).toEqual({ kind: "unequip" });
  });

  it("returns the push effect for a hit bull rush", () => {
    expect(resolveManeuverOutcome("bullRush", true)).toEqual({ kind: "push" });
  });
});
