import { describe, expect, it } from "vitest";
import {
  CASTING_MODES,
  INHERIT_TURNING,
  NO_OVERRIDES,
  TURNING_MODES,
  effectiveTurnerLevel,
  normalizeOverrides,
  resolveKitOverrides,
  type KitOverrides,
} from "../../../src/core/kits";

describe("override constants", () => {
  it("lists the modes and the defaults", () => {
    expect([...CASTING_MODES]).toEqual(["inherit", "none"]);
    expect([...TURNING_MODES]).toEqual(["inherit", "offset", "none"]);
    expect(INHERIT_TURNING).toEqual({ mode: "inherit", offset: 0 });
    expect(NO_OVERRIDES).toEqual({ casting: "inherit", turning: { mode: "inherit", offset: 0 }, removedAbilities: [] });
  });
});

describe("normalizeOverrides", () => {
  it("returns the defaults for missing input", () => {
    expect(normalizeOverrides(undefined)).toEqual(NO_OVERRIDES);
    expect(normalizeOverrides(null)).toEqual(NO_OVERRIDES);
    expect(normalizeOverrides({})).toEqual(NO_OVERRIDES);
  });
  it("keeps valid values", () => {
    expect(
      normalizeOverrides({ casting: "none", turning: { mode: "offset", offset: -1 }, removedAbilities: ["Laying on hands", "Disease immunity"] }),
    ).toEqual({ casting: "none", turning: { mode: "offset", offset: -1 }, removedAbilities: ["Laying on hands", "Disease immunity"] });
    expect(normalizeOverrides({ turning: { mode: "none", offset: 3 } }).turning).toEqual({ mode: "none", offset: 0 });
  });
  it("falls back to defaults for malformed values and drops bad ability names", () => {
    const out = normalizeOverrides({
      casting: "banana",
      turning: { mode: "sideways", offset: 2.5 },
      removedAbilities: ["ok", "", 7, null],
    });
    expect(out.casting).toBe("inherit");
    expect(out.turning).toEqual({ mode: "inherit", offset: 0 });
    expect(out.removedAbilities).toEqual(["ok"]);
    expect(normalizeOverrides({ turning: { mode: "offset", offset: "x" } }).turning).toEqual({ mode: "offset", offset: 0 });
    expect(normalizeOverrides({ removedAbilities: "nope" }).removedAbilities).toEqual([]);
  });
});

describe("resolveKitOverrides", () => {
  const ghost: KitOverrides = { casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: ["Laying on hands"] };
  it("returns the defaults when no kit modifies the chassis", () => {
    expect(resolveKitOverrides([], "paladin")).toEqual({ castingDisabled: false, turning: INHERIT_TURNING, removedAbilities: [] });
    expect(resolveKitOverrides([{ chassisId: "fighter", overrides: ghost }], "paladin").castingDisabled).toBe(false);
  });
  it("reads the kit for the chassis", () => {
    expect(resolveKitOverrides([{ chassisId: "paladin", overrides: ghost }], "paladin")).toEqual({
      castingDisabled: true,
      turning: { mode: "offset", offset: 0 },
      removedAbilities: ["Laying on hands"],
    });
    expect(resolveKitOverrides([{ chassisId: "paladin", overrides: NO_OVERRIDES }], "paladin").castingDisabled).toBe(false);
  });
});

describe("effectiveTurnerLevel", () => {
  it("inherit keeps the base level (including null)", () => {
    expect(effectiveTurnerLevel(3, 5, INHERIT_TURNING)).toBe(3);
    expect(effectiveTurnerLevel(null, 5, INHERIT_TURNING)).toBeNull();
  });
  it("none can never turn", () => {
    expect(effectiveTurnerLevel(7, 7, { mode: "none", offset: 0 })).toBeNull();
  });
  it("offset is class level plus the offset, null below 1, and lets a non-turner turn", () => {
    expect(effectiveTurnerLevel(3, 5, { mode: "offset", offset: 0 })).toBe(5);
    expect(effectiveTurnerLevel(null, 4, { mode: "offset", offset: 0 })).toBe(4);
    expect(effectiveTurnerLevel(3, 5, { mode: "offset", offset: -4 })).toBe(1);
    expect(effectiveTurnerLevel(3, 5, { mode: "offset", offset: -5 })).toBeNull();
  });
});
