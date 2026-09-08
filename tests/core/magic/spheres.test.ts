import { describe, expect, it } from "vitest";
import {
  resolveSphereAccess,
  sphereSpellLevelCap,
  canCastSphereSpell,
} from "../../../src/core/magic/spheres";
import { CLERIC_SPHERE_ACCESS } from "../../../src/core/magic/tables";

describe("resolveSphereAccess()", () => {
  it("reads the table", () => {
    expect(resolveSphereAccess(CLERIC_SPHERE_ACCESS, "healing")).toBe("major");
    expect(resolveSphereAccess(CLERIC_SPHERE_ACCESS, "elemental")).toBe("minor");
  });
  it("defaults an absent sphere to none", () => {
    expect(resolveSphereAccess({ healing: "major" }, "combat")).toBe("none");
  });
});

describe("sphereSpellLevelCap()", () => {
  it("major casts all 7 priest spell levels", () => {
    expect(sphereSpellLevelCap("major")).toBe(7);
  });
  it("minor casts only 1st-3rd", () => {
    expect(sphereSpellLevelCap("minor")).toBe(3);
  });
  it("none casts nothing", () => {
    expect(sphereSpellLevelCap("none")).toBe(0);
  });
});

describe("canCastSphereSpell()", () => {
  it("major: any priest spell level", () => {
    expect(canCastSphereSpell("major", 1)).toBe(true);
    expect(canCastSphereSpell("major", 7)).toBe(true);
  });
  it("minor: 3rd yes, 4th no", () => {
    expect(canCastSphereSpell("minor", 3)).toBe(true);
    expect(canCastSphereSpell("minor", 4)).toBe(false);
  });
  it("none: never", () => {
    expect(canCastSphereSpell("none", 1)).toBe(false);
  });
  it("returns false for an out-of-range spell level", () => {
    expect(canCastSphereSpell("major", 0)).toBe(false);
  });
});
