import { describe, expect, it } from "vitest";
import manifest from "../../system.json";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";

describe("ITEM_SUBTYPES", () => {
  it("matches system.json documentTypes.Item exactly", () => {
    const declared = Object.keys(
      (manifest as unknown as { documentTypes: { Item: Record<string, unknown> } }).documentTypes.Item,
    ).sort();
    expect([...ITEM_SUBTYPES].sort()).toEqual(declared);
  });

  it("has fourteen entries ending with power", () => {
    expect(ITEM_SUBTYPES).toHaveLength(14);
    expect(ITEM_SUBTYPES[ITEM_SUBTYPES.length - 1]).toBe("power");
  });

  it("has no duplicates", () => {
    expect(new Set(ITEM_SUBTYPES).size).toBe(ITEM_SUBTYPES.length);
  });
});
