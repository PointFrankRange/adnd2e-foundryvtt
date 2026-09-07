import { describe, expect, it } from "vitest";
import { RACIAL_ABILITY_ADJUSTMENTS, applyRacialAdjustments } from "../../../src/core/abilities/racial-adjustments";

describe("racial ability adjustments", () => {
  it("Table 8 deltas", () => {
    expect(RACIAL_ABILITY_ADJUSTMENTS.dwarf).toEqual({ con: 1, cha: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS.elf).toEqual({ dex: 1, con: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS.gnome).toEqual({ int: 1, wis: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS.halfling).toEqual({ dex: 1, str: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS["half-elf"]).toEqual({});
    expect(RACIAL_ABILITY_ADJUSTMENTS.human).toEqual({});
  });
  it("applies deltas", () => {
    const raw = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };
    expect(applyRacialAdjustments(raw, "dwarf")).toMatchObject({ con: 13, cha: 11 });
    expect(applyRacialAdjustments(raw, "elf")).toMatchObject({ dex: 13, con: 11 });
  });
  it("clamps to racial min/max (Table 7)", () => {
    // Elf CON max is 18; +1 from a raw 18 stays 18.
    expect(applyRacialAdjustments({ str: 10, dex: 10, con: 18, int: 10, wis: 10, cha: 10 }, "elf").con).toBe(17); // 18 - 1
    // Halfling STR min 7: raw 7, -1 -> clamped up to 7.
    expect(applyRacialAdjustments({ str: 7, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, "halfling").str).toBe(7);
    // Dwarf CON min 11: raw 10 +1 -> 11 (also satisfies min).
    expect(applyRacialAdjustments({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, "dwarf").con).toBe(11);
  });
});
