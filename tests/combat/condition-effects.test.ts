import { describe, expect, it } from "vitest";
import {
  blindedAttackPenalty,
  proneArmorClassPenalty,
  heldAttackBonus,
  canAct,
  MANAGED_CONDITIONS,
  fatigueAttackPenalty,
  fatigueArmorClassPenalty,
  conditionDuration,
} from "../../src/combat/condition-effects";

describe("MANAGED_CONDITIONS", () => {
  it("is exactly the 4 curated conditions", () => {
    expect([...MANAGED_CONDITIONS].sort()).toEqual(["blinded", "held", "prone", "stunned"]);
  });
});

describe("blindedAttackPenalty", () => {
  it("is -4 when blinded is present", () => {
    expect(blindedAttackPenalty(["blinded"])).toBe(-4);
    expect(blindedAttackPenalty(new Set(["blinded"]))).toBe(-4);
  });
  it("is 0 when blinded is absent", () => {
    expect(blindedAttackPenalty([])).toBe(0);
    expect(blindedAttackPenalty(["prone"])).toBe(0);
  });
});

describe("proneArmorClassPenalty", () => {
  it("is +2 (worse AC) when prone is present", () => {
    expect(proneArmorClassPenalty(["prone"])).toBe(2);
  });
  it("is 0 when prone is absent", () => {
    expect(proneArmorClassPenalty([])).toBe(0);
  });
});

describe("heldAttackBonus", () => {
  it("is +4 (easier to hit) when the target is held", () => {
    expect(heldAttackBonus(["held"])).toBe(4);
  });
  it("is 0 when held is absent", () => {
    expect(heldAttackBonus([])).toBe(0);
  });
});

describe("canAct", () => {
  it("is true with no blocking condition", () => {
    expect(canAct([])).toBe(true);
    expect(canAct(["blinded", "prone"])).toBe(true);
  });
  it("is false when stunned", () => {
    expect(canAct(["stunned"])).toBe(false);
  });
  it("is false when held", () => {
    expect(canAct(["held"])).toBe(false);
  });
  it("is false when both are present", () => {
    expect(canAct(["stunned", "held"])).toBe(false);
  });
});

describe("fatigueAttackPenalty", () => {
  it("matches FATIGUE_ATTACK_PENALTY for each tier's condition id", () => {
    expect(fatigueAttackPenalty(["lightFatigue"])).toBe(0);
    expect(fatigueAttackPenalty(["moderateFatigue"])).toBe(-1);
    expect(fatigueAttackPenalty(["heavyFatigue"])).toBe(-2);
    expect(fatigueAttackPenalty(["severeFatigue"])).toBe(-4);
    expect(fatigueAttackPenalty(["mortalFatigue"])).toBe(0);
  });
  it("is 0 when no fatigue condition is present", () => {
    expect(fatigueAttackPenalty([])).toBe(0);
    expect(fatigueAttackPenalty(["prone"])).toBe(0);
  });
});

describe("fatigueArmorClassPenalty", () => {
  it("matches FATIGUE_AC_PENALTY for each tier's condition id", () => {
    expect(fatigueArmorClassPenalty(["heavyFatigue"])).toBe(1);
    expect(fatigueArmorClassPenalty(["severeFatigue"])).toBe(3);
    expect(fatigueArmorClassPenalty(["lightFatigue"])).toBe(0);
    expect(fatigueArmorClassPenalty(["mortalFatigue"])).toBe(0);
  });
  it("is 0 when no fatigue condition is present", () => {
    expect(fatigueArmorClassPenalty([])).toBe(0);
  });
});

describe("canAct — mortal fatigue", () => {
  it("blocks acting while mortally fatigued, same as stunned/held", () => {
    expect(canAct(["mortalFatigue"])).toBe(false);
  });
  it("does not block acting at any other fatigue tier", () => {
    expect(canAct(["severeFatigue"])).toBe(true);
    expect(canAct(["lightFatigue"])).toBe(true);
  });
});

describe("conditionDuration (#94)", () => {
  it("gives the managed conditions a round count and an expiry that depends on whether the target has acted", () => {
    expect(conditionDuration("stunned", false)).toEqual({ value: 1, units: "rounds", expiry: "turnStart" });
    expect(conditionDuration("prone", true)).toEqual({ value: 1, units: "rounds", expiry: "turnEnd" });
    expect(conditionDuration("held", false)).toEqual({ value: 2, units: "rounds", expiry: "turnStart" });
  });
  it("leaves every other condition indefinite", () => {
    expect(conditionDuration("turned", false)).toBeNull();
    expect(conditionDuration("blinded", true)).toBeNull();
  });
});
