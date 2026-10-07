import { describe, expect, it } from "vitest";
import { racialConSaveBonus, racialSaveBonus, poisonSaveAdjustment, racialSaveModifier, sleepCharmResistance } from "../../../src/core/saves/racial";
import type { Race, SaveCategory } from "../../../src/core/types";

describe("racialConSaveBonus", () => {
  it("PHB Table 9 bands", () => {
    expect(racialConSaveBonus(1)).toBe(0);
    expect(racialConSaveBonus(3)).toBe(0);
    expect(racialConSaveBonus(4)).toBe(1);
    expect(racialConSaveBonus(6)).toBe(1);
    expect(racialConSaveBonus(7)).toBe(2);
    expect(racialConSaveBonus(10)).toBe(2);
    expect(racialConSaveBonus(11)).toBe(3);
    expect(racialConSaveBonus(13)).toBe(3);
    expect(racialConSaveBonus(14)).toBe(4);
    expect(racialConSaveBonus(17)).toBe(4);
    expect(racialConSaveBonus(18)).toBe(5);
    expect(racialConSaveBonus(19)).toBe(5);
    expect(racialConSaveBonus(25)).toBe(5); // capped at the table
  });
  it("rejects invalid CON", () => {
    expect(() => racialConSaveBonus(0)).toThrow(RangeError);
    expect(() => racialConSaveBonus(12.5)).toThrow(RangeError);
  });
});

describe("racialSaveBonus", () => {
  const con = 15; // → racialConSaveBonus 4

  it("dwarf: rsw / spell / poison-tagged ppd", () => {
    expect(racialSaveBonus("dwarf", "rsw", con)).toBe(4);
    expect(racialSaveBonus("dwarf", "spell", con)).toBe(4);
    expect(racialSaveBonus("dwarf", "ppd", con, ["poison"])).toBe(4);
    expect(racialSaveBonus("dwarf", "ppd", con)).toBe(0); // ppd without the poison tag (e.g. death magic)
    expect(racialSaveBonus("dwarf", "pp", con)).toBe(0);
    expect(racialSaveBonus("dwarf", "bw", con)).toBe(0);
  });

  it("halfling: same as dwarf (incl. poison)", () => {
    expect(racialSaveBonus("halfling", "rsw", con)).toBe(4);
    expect(racialSaveBonus("halfling", "spell", con)).toBe(4);
    expect(racialSaveBonus("halfling", "ppd", con, ["poison"])).toBe(4);
    expect(racialSaveBonus("halfling", "ppd", con)).toBe(0);
  });

  it("gnome: rsw / spell only, NO poison", () => {
    expect(racialSaveBonus("gnome", "rsw", con)).toBe(4);
    expect(racialSaveBonus("gnome", "spell", con)).toBe(4);
    expect(racialSaveBonus("gnome", "ppd", con, ["poison"])).toBe(0);
    expect(racialSaveBonus("gnome", "ppd", con)).toBe(0);
  });

  it("elf / half-elf / human: nothing", () => {
    for (const race of ["elf", "half-elf", "human"] as Race[]) {
      for (const cat of ["ppd", "rsw", "pp", "bw", "spell"] as SaveCategory[]) {
        expect(racialSaveBonus(race, cat, con, ["poison"])).toBe(0);
      }
    }
  });

  it("scales with CON", () => {
    expect(racialSaveBonus("dwarf", "spell", 8)).toBe(2);
    expect(racialSaveBonus("dwarf", "spell", 3)).toBe(0);
  });

  it("validates CON even when the race/category does not qualify", () => {
    expect(() => racialSaveBonus("human", "spell", 999)).toThrow(RangeError);
    expect(() => racialSaveBonus("elf", "bw", 0)).toThrow(RangeError);
  });

  it("racialSaveBonus adds an extra bonus only where the race already qualifies (SP12 Plan A)", () => {
    expect(racialSaveBonus("dwarf", "rsw", 14, [], 1)).toBe(5); // CON 14 -> +4, extra +1
    expect(racialSaveBonus("dwarf", "ppd", 14, ["poison"], 1)).toBe(5);
    expect(racialSaveBonus("dwarf", "ppd", 14, [], 1)).toBe(0); // not a qualifying save
    expect(racialSaveBonus("human", "rsw", 14, [], 1)).toBe(0); // human never qualifies
    expect(racialSaveBonus("dwarf", "rsw", 14)).toBe(4);
  });
});

describe("sleepCharmResistance", () => {
  it("elf 90, half-elf 30, others 0", () => {
    expect(sleepCharmResistance("elf")).toBe(90);
    expect(sleepCharmResistance("half-elf")).toBe(30);
    expect(sleepCharmResistance("human")).toBe(0);
    expect(sleepCharmResistance("dwarf")).toBe(0);
    expect(sleepCharmResistance("gnome")).toBe(0);
    expect(sleepCharmResistance("halfling")).toBe(0);
  });
});

describe("racialSaveModifier (SP12 Plan C)", () => {
  const flat = { all: 3, poison: 2 };
  const CATEGORIES = ["ppd", "rsw", "pp", "bw", "spell"] as const;
  const RACES = ["human", "dwarf", "elf", "gnome", "half-elf", "halfling"] as const;
  it("a flat bonus is `all` for every category, whatever the race or Constitution", () => {
    for (const race of RACES) for (const category of CATEGORIES) {
      expect(racialSaveModifier({ race, category, con: 3, flat }), `${race} ${category}`).toBe(3);
      expect(racialSaveModifier({ race, category, con: 18, flat }), `${race} ${category}`).toBe(3);
    }
  });
  it("a poison-tagged paralysis/poison save uses the poison value; the tag changes nothing else", () => {
    expect(racialSaveModifier({ race: "gnome", category: "ppd", con: 12, tags: ["poison"], flat })).toBe(2);
    expect(racialSaveModifier({ race: "gnome", category: "rsw", con: 12, tags: ["poison"], flat })).toBe(3);
    expect(racialSaveModifier({ race: "gnome", category: "pp", con: 12, tags: ["poison"], flat })).toBe(3);
  });
  it("a flat bonus REPLACES the Constitution bonus (a gnome with CON 14 would otherwise get +4)", () => {
    expect(racialSaveBonus("gnome", "rsw", 14)).toBe(4);
    expect(racialSaveModifier({ race: "gnome", category: "rsw", con: 14, flat })).toBe(3);
  });
  it("with no flat bonus it equals racialSaveBonus, including the Constitution adjustment", () => {
    for (const race of RACES) for (const category of CATEGORIES) for (const tags of [[], ["poison"]] as const) for (const adj of [0, 1]) {
      expect(racialSaveModifier({ race, category, con: 14, tags, conAdjustment: adj, flat: null }), `${race} ${category}`)
        .toBe(racialSaveBonus(race, category, 14, tags, adj));
      expect(racialSaveModifier({ race, category, con: 14, tags, conAdjustment: adj }))
        .toBe(racialSaveBonus(race, category, 14, tags, adj));
    }
  });
  it("still validates the Constitution score on both paths", () => {
    expect(() => racialSaveModifier({ race: "dwarf", category: "rsw", con: 0, flat })).toThrow();
    expect(() => racialSaveModifier({ race: "dwarf", category: "rsw", con: 0 })).toThrow();
  });
});

describe("poisonSaveAdjustment (#105)", () => {
  it("is the poison-vs-all difference of a flat bonus", () => {
    expect(poisonSaveAdjustment({ all: 3, poison: 2 })).toBe(-1);
    expect(poisonSaveAdjustment({ all: 3, poison: 3 })).toBe(0);
  });
  it("is 0 with no flat bonus", () => {
    expect(poisonSaveAdjustment(null)).toBe(0);
    expect(poisonSaveAdjustment(undefined)).toBe(0);
  });
});
