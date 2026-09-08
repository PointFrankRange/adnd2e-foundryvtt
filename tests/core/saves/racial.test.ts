import { describe, expect, it } from "vitest";
import { racialConSaveBonus, racialSaveBonus, sleepCharmResistance } from "../../../src/core/saves/racial";
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
