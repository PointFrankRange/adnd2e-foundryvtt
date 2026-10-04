import { describe, expect, it } from "vitest";
import { SETTING_DESCRIPTORS, readOptionalRules, type SettingDescriptor } from "../../src/settings/registry";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";

describe("SETTING_DESCRIPTORS", () => {
  it("registers 23 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(23);
    const byGroup = SETTING_DESCRIPTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.group] = (acc[d.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(byGroup).toEqual({
      core: 8,
      combatAndTactics: 6,
      skillsAndPowers: 4,
      spellsAndMagic: 5,
    });
  });

  it("keys are unique", () => {
    const keys = SETTING_DESCRIPTORS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every default is a boolean", () => {
    for (const d of SETTING_DESCRIPTORS) expect(typeof d.default).toBe("boolean");
  });

  it("core, combatAndTactics, skillsAndPowers and five spellsAndMagic settings bind 1:1 to OptionalRules fields", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(23);
    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());
    const unbound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey === null).map((d) => d.key).sort();
    expect(unbound).toEqual([]);
  });

  it("exactly the eight prepare-time rules require a world reload", () => {
    const reload = ["channelers", "channellerFatigue", "characterPointBuild", "expandedCastingTime", "skillsAndPowersEnabled", "spellPoints", "spellsAndMagicEnabled", "subAbilityScores"];
    const keys = SETTING_DESCRIPTORS.filter((d) => d.requiresReload === true).map((d) => d.key);
    expect(keys.sort()).toEqual(reload);
    for (const d of SETTING_DESCRIPTORS) {
      if (reload.includes(d.key)) expect(d.requiresReload).toBe(true);
      else expect(d.requiresReload).not.toBe(true);
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

  it("reads a combatAndTactics key through, same as a core key", () => {
    const bag = readOptionalRules((key) => (key === "criticalHits" ? true : undefined));
    expect(bag.criticalHits).toBe(true);
  });

  it("skips a descriptor whose optionalRulesKey is null", () => {
    const descriptors: readonly SettingDescriptor[] = [
      { key: "noRulesKey", group: "core", default: false, config: false, optionalRulesKey: null },
      { key: "criticalHits", group: "core", default: false, config: true, optionalRulesKey: "criticalHits" },
    ];
    const bag = readOptionalRules(() => true, descriptors);
    expect(bag).toEqual({ ...DEFAULT_OPTIONAL_RULES, criticalHits: true });
  });

  it("reads a skillsAndPowers key through, same as a core key", () => {
    const bag = readOptionalRules((key) => (key === "subAbilityScores" ? true : undefined));
    expect(bag.subAbilityScores).toBe(true);
    expect(bag.skillsAndPowersEnabled).toBe(false); // untouched default
  });
});
