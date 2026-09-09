import { describe, expect, it } from "vitest";
import manifest from "../../system.json";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

describe("ACTIVE_EFFECT_SUBTYPES", () => {
  it("matches system.json documentTypes.ActiveEffect exactly", () => {
    const declared = Object.keys(
      (manifest as unknown as { documentTypes: { ActiveEffect: Record<string, unknown> } })
        .documentTypes.ActiveEffect,
    ).sort();
    expect([...ACTIVE_EFFECT_SUBTYPES].sort()).toEqual(declared);
  });

  it("has no duplicates", () => {
    expect(new Set(ACTIVE_EFFECT_SUBTYPES).size).toBe(ACTIVE_EFFECT_SUBTYPES.length);
  });
});
