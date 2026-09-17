import { describe, expect, it } from "vitest";
import {
  blindedAttackPenalty,
  proneArmorClassPenalty,
  heldAttackBonus,
  canAct,
  MANAGED_CONDITIONS,
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
