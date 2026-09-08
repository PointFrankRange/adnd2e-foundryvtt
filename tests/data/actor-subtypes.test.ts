import { describe, expect, it } from "vitest";
import manifest from "../../system.json";
import { ACTOR_SUBTYPES } from "../../src/data/actor/subtypes";

describe("ACTOR_SUBTYPES", () => {
  it("matches system.json documentTypes.Actor exactly", () => {
    const declared = Object.keys(
      (manifest as unknown as { documentTypes: { Actor: Record<string, unknown> } }).documentTypes.Actor,
    ).sort();
    expect([...ACTOR_SUBTYPES].sort()).toEqual(declared);
  });
  it("has no duplicates", () => {
    expect(new Set(ACTOR_SUBTYPES).size).toBe(ACTOR_SUBTYPES.length);
  });
});
