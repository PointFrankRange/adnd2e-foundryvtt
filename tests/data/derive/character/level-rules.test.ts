import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { abilityScoresOf, actorLevelRulesFor } from "../../../../src/data/derive/character/kits";

const cls = (chassisId: string) => ({ id: `c-${chassisId}`, name: chassisId, type: "class", system: { chassisId } });
const race = (limits: Record<string, number | null>, xpModifierPercent = 0) => ({
  id: "r", name: "Race", type: "race", system: { raceId: "dwarf", classLevelLimits: limits, subrace: { xpModifierPercent } },
});
const on = { ...DEFAULT_OPTIONAL_RULES, racialLevelLimits: true, exceedLevelLimits: 0 as const, primeRequisiteBonusLevels: false };

describe("abilityScoresOf", () => {
  it("reads prepared scores, ignoring missing or non-numeric entries", () => {
    expect(abilityScoresOf({ abilities: { str: { score: 18 }, dex: { score: 12 }, con: undefined, int: { score: "x" as never } } })).toEqual({ str: 18, dex: 12 });
    expect(abilityScoresOf(undefined)).toEqual({});
    expect(abilityScoresOf({})).toEqual({});
  });
});

describe("actorLevelRulesFor", () => {
  it("takes the limit from the race item and the XP percent from race + kit", () => {
    const items = [race({ fighter: 15, cleric: 10 }, 10), cls("fighter"), cls("cleric")];
    expect(actorLevelRulesFor(items, "fighter", on)).toEqual({ xpPercent: 10, rules: { limit: 15, beyondMultiplier: 0 } });
    expect(actorLevelRulesFor(items, "cleric", on).rules.limit).toBe(10);
  });
  it("a class missing from the limits, a null limit, or no race item is unlimited", () => {
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("thief")], "thief", on).rules.limit).toBeNull();
    expect(actorLevelRulesFor([race({ fighter: null }), cls("fighter")], "fighter", on).rules.limit).toBeNull();
    expect(actorLevelRulesFor([cls("fighter")], "fighter", on)).toEqual({ xpPercent: 0, rules: { limit: null, beyondMultiplier: 0 } });
  });
  it("with enforcement off there are no rules, but the XP percent still applies", () => {
    const off = { ...on, racialLevelLimits: false, exceedLevelLimits: 3 as const, primeRequisiteBonusLevels: true };
    expect(actorLevelRulesFor([race({ fighter: 15 }, 10), cls("fighter")], "fighter", off, { str: 18 })).toEqual({
      xpPercent: 10, rules: { limit: null, beyondMultiplier: 0 },
    });
  });
  it("passes the exceed multiplier through", () => {
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", { ...on, exceedLevelLimits: 3 }).rules).toEqual({ limit: 15, beyondMultiplier: 3 });
  });
  it("bonus levels add to the limit for a single-class character only, from the LOWEST prime requisite", () => {
    const bonus = { ...on, primeRequisiteBonusLevels: true };
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", bonus, { str: 18 }).rules.limit).toBe(18);
    expect(actorLevelRulesFor([race({ fighter: 15, cleric: 10 }), cls("fighter"), cls("cleric")], "fighter", bonus, { str: 18 }).rules.limit).toBe(15);
    expect(actorLevelRulesFor([race({ paladin: 10 }), cls("paladin")], "paladin", bonus, { str: 18, cha: 14 }).rules.limit).toBe(11);
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", bonus).rules.limit).toBe(15);
    expect(actorLevelRulesFor([race({ paladin: 10 }), cls("paladin")], "paladin", bonus, { str: 18 }).rules.limit).toBe(10);
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", on, { str: 18 }).rules.limit).toBe(15);
    expect(actorLevelRulesFor([race({}), cls("fighter")], "fighter", bonus, { str: 18 }).rules.limit).toBeNull();
  });
});
