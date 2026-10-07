import { describe, expect, it } from "vitest";
import { SETTING_DESCRIPTORS, readOptionalRules, type SettingDescriptor } from "../../src/settings/registry";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";

describe("SETTING_DESCRIPTORS", () => {
  it("registers 26 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(26);
    const byGroup = SETTING_DESCRIPTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.group] = (acc[d.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(byGroup).toEqual({
      core: 11,
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

  it("core, combatAndTactics, skillsAndPowers and spellsAndMagic settings bind 1:1 to OptionalRules fields (exceedLevelLimits is a string choice, not a descriptor)", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(26);
    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    const expectedKeys = Object.keys(DEFAULT_OPTIONAL_RULES)
      .filter((k) => k !== "exceedLevelLimits") // string choice, handled separately
      .sort();
    expect(boundKeys).toEqual(expectedKeys);
    const unbound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey === null).map((d) => d.key).sort();
    expect(unbound).toEqual([]);
  });

  it("exactly the eleven prepare-time rules require a world reload", () => {
    const reload = ["channelers", "channellerFatigue", "characterPointBuild", "expandedCastingTime", "primeRequisiteBonusLevels", "racialLevelLimits", "skillsAndPowersEnabled", "spellPoints", "spellsAndMagicEnabled", "subAbilityScores", "wildTalents"];
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

  it("reads the SP15 wildTalents setting (default false, true when set)", () => {
    expect(readOptionalRules(() => undefined).wildTalents).toBe(false);
    expect(readOptionalRules((k) => (k === "wildTalents" ? true : undefined)).wildTalents).toBe(true);
  });

  it("reads the SP13 level-limit settings (racialLevelLimits defaults ON; exceedLevelLimits maps off/x2/x3/x4 to 0/2/3/4; garbage = 0)", () => {
    const none = readOptionalRules(() => undefined);
    expect(none.racialLevelLimits).toBe(true);
    expect(none.primeRequisiteBonusLevels).toBe(false);
    expect(none.exceedLevelLimits).toBe(0);
    expect(readOptionalRules((k) => (k === "racialLevelLimits" ? false : undefined)).racialLevelLimits).toBe(false);
    expect(readOptionalRules((k) => (k === "primeRequisiteBonusLevels" ? true : undefined)).primeRequisiteBonusLevels).toBe(true);
    const exceed = (v: unknown) => readOptionalRules((k) => (k === "exceedLevelLimits" ? v : undefined)).exceedLevelLimits;
    expect([exceed("off"), exceed("x2"), exceed("x3"), exceed("x4")]).toEqual([0, 2, 3, 4]);
    for (const bad of ["x5", "toString", "", 3, true, null]) expect(exceed(bad), String(bad)).toBe(0);
  });
});
