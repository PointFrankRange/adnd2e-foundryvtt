import { describe, expect, it } from "vitest";
import { SETTING_DESCRIPTORS, readOptionalRules } from "../../src/settings/registry";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";

describe("SETTING_DESCRIPTORS", () => {
  it("registers 22 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(22);
    const byGroup = SETTING_DESCRIPTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.group] = (acc[d.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(byGroup).toEqual({
      core: 8,
      combatAndTactics: 6,
      skillsAndPowers: 4,
      spellsAndMagic: 4,
    });
  });

  it("keys are unique", () => {
    const keys = SETTING_DESCRIPTORS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every default is a boolean", () => {
    for (const d of SETTING_DESCRIPTORS) expect(typeof d.default).toBe("boolean");
  });

  it("core settings bind 1:1 to OptionalRules fields; reserved groups bind to null", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(8);
    for (const d of bound) expect(d.group).toBe("core");

    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());

    for (const d of SETTING_DESCRIPTORS.filter((x) => x.group !== "core")) {
      expect(d.optionalRulesKey).toBeNull();
    }
  });

  it("a bound descriptor's default matches the OptionalRules default", () => {
    for (const d of SETTING_DESCRIPTORS) {
      if (d.optionalRulesKey === null) continue;
      expect(d.default).toBe(DEFAULT_OPTIONAL_RULES[d.optionalRulesKey]);
    }
  });
});

describe("readOptionalRules()", () => {
  it("returns the defaults when the store is empty", () => {
    expect(readOptionalRules(() => undefined)).toEqual(DEFAULT_OPTIONAL_RULES);
  });

  it("reads a stored boolean through", () => {
    const bag = readOptionalRules((key) => (key === "exceptionalStrength" ? false : undefined));
    expect(bag.exceptionalStrength).toBe(false);
    expect(bag.maxSpellsPerLevel).toBe(false); // untouched default
  });

  it("falls back to the default when the stored value is not a boolean", () => {
    const bag = readOptionalRules(() => "true" as unknown);
    expect(bag).toEqual(DEFAULT_OPTIONAL_RULES);
  });

  it("ignores reserved-group keys — they never appear in the bag", () => {
    const bag = readOptionalRules((key) => (key === "criticalHits" ? true : undefined));
    expect(bag).not.toHaveProperty("criticalHits");
    expect(bag).toEqual(DEFAULT_OPTIONAL_RULES);
  });
});
