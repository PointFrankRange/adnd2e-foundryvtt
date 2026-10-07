import { describe, expect, it } from "vitest";
import { raceAllowsClasses, raceTablesOf } from "../../../src/core/races";

const dwarf = { allowedClasses: ["cleric", "fighter", "thief"], allowedMulticlass: [["fighter", "thief"], ["fighter", "cleric"]] };
const halfElf = { allowedClasses: ["fighter", "mage", "cleric"], allowedMulticlass: [["fighter", "mage", "cleric"]] };
const human = { allowedClasses: ["fighter", "mage"], allowedMulticlass: [] };

describe("raceAllowsClasses", () => {
  it("allows a listed single class and blocks an unlisted one", () => {
    expect(raceAllowsClasses(dwarf, ["fighter"])).toEqual({ ok: true });
    expect(raceAllowsClasses(dwarf, ["mage"])).toEqual({ ok: false, reason: "class" });
  });
  it("matches a multiclass combination in any order", () => {
    expect(raceAllowsClasses(dwarf, ["thief", "fighter"])).toEqual({ ok: true });
    expect(raceAllowsClasses(halfElf, ["cleric", "mage", "fighter"])).toEqual({ ok: true });
  });
  it("blocks an allowed-class pair that is not a listed combination", () => {
    expect(raceAllowsClasses(dwarf, ["thief", "cleric"])).toEqual({ ok: false, reason: "multiclass" });
    expect(raceAllowsClasses(halfElf, ["fighter", "mage"])).toEqual({ ok: false, reason: "multiclass" });
  });
  it("reports a disallowed class before a combination problem", () => {
    expect(raceAllowsClasses(dwarf, ["fighter", "mage"])).toEqual({ ok: false, reason: "class" });
  });
  it("does no combination check when the race lists none (humans dual-class)", () => {
    expect(raceAllowsClasses(human, ["fighter", "mage"])).toEqual({ ok: true });
  });
  it("treats an empty class list as unrestricted", () => {
    expect(raceAllowsClasses({ allowedClasses: [], allowedMulticlass: [] }, ["paladin", "bard"])).toEqual({ ok: true });
  });
});

describe("raceTablesOf", () => {
  it("reads the tables and tolerates missing or malformed fields", () => {
    expect(raceTablesOf({ allowedClasses: ["fighter", 3], allowedMulticlass: [["fighter", "thief"], "x"] })).toEqual({
      allowedClasses: ["fighter"],
      allowedMulticlass: [["fighter", "thief"], []],
    });
    expect(raceTablesOf(undefined)).toEqual({ allowedClasses: [], allowedMulticlass: [] });
    expect(raceTablesOf({ allowedClasses: "x", allowedMulticlass: "y" })).toEqual({ allowedClasses: [], allowedMulticlass: [] });
  });
});
