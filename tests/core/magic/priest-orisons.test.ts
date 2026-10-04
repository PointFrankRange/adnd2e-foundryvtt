import { describe, expect, it } from "vitest";
import { ORISON_COST_SP, orisonAffords, orisonCap } from "../../../src/core/magic/priest-orisons";

describe("orison cap", () => {
  it("is twice the Table 26 max spells per level (a 3rd-level priest holds 10)", () => {
    expect(orisonCap(3)).toBe(10);
  });

  it("uses the Table 26 row for the level (a 1st-level priest holds 6)", () => {
    expect(orisonCap(1)).toBe(6);
  });
});

describe("orison cost and affordability", () => {
  it("costs 1 SP", () => {
    expect(ORISON_COST_SP).toBe(1);
  });

  it("is affordable under the cap with 1 SP left", () => {
    expect(orisonAffords(1, 9, 10)).toBe(true);
  });

  it("is refused at the cap even with SP to spare", () => {
    expect(orisonAffords(50, 10, 10)).toBe(false);
  });

  it("is refused with no SP left", () => {
    expect(orisonAffords(0, 0, 10)).toBe(false);
  });
});
