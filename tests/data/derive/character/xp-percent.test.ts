import { describe, expect, it } from "vitest";
import { actorXpPercentFor, raceXpPercentOf } from "../../../../src/data/derive/character/kits";

const kitSystem = (chassisId: string, xpModifierPercent: number) => ({
  chassisId, xpModifierPercent,
  qualifications: { abilityMinimums: {}, races: [], alignments: [] },
  effects: [], equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
  forbiddenWeaponProficiencies: [], grantedFeatures: [], powers: [],
});
const kit = (chassisId: string, pct: number) => ({ id: `k-${chassisId}`, name: "K", type: "kit", system: kitSystem(chassisId, pct) });
const cls = (chassisId: string) => ({ id: `c-${chassisId}`, name: chassisId, type: "class", system: { chassisId } });
const race = (xpModifierPercent: number) => ({ id: "r", name: "Deep Dwarf", type: "race", system: { raceId: "dwarf", subrace: { xpModifierPercent } } });

describe("raceXpPercentOf", () => {
  it("reads the race item's subrace percent, 0 with no race item or no subrace field", () => {
    expect(raceXpPercentOf([race(10)])).toBe(10);
    expect(raceXpPercentOf([])).toBe(0);
    expect(raceXpPercentOf([{ type: "race", system: { raceId: "dwarf" } }])).toBe(0);
    expect(raceXpPercentOf([cls("fighter")])).toBe(0);
  });
});

describe("actorXpPercentFor", () => {
  it("adds the active kit's percent for the chassis and the subrace percent", () => {
    const items = [cls("fighter"), kit("fighter", 20), race(10)];
    expect(actorXpPercentFor(items, "fighter")).toBe(30);
  });
  it("applies the subrace percent to a class with no kit (every class of a multiclass)", () => {
    const items = [cls("fighter"), cls("cleric"), kit("fighter", 20), race(10)];
    expect(actorXpPercentFor(items, "cleric")).toBe(10);
  });
  it("is the kit percent alone with no race item, and 0 with nothing", () => {
    expect(actorXpPercentFor([cls("fighter"), kit("fighter", 20)], "fighter")).toBe(20);
    expect(actorXpPercentFor([], "fighter")).toBe(0);
  });
});
