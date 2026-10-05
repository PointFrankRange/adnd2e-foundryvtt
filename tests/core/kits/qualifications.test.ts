import { describe, expect, it } from "vitest";
import { kitForbidsProficiency, kitQualifies } from "../../../src/core/kits";

const none = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const scores = { str: 10, dex: 14, con: 12, int: 9, wis: 9, cha: 9 };
const actor = { abilities: scores, race: "human" as const, alignment: "lawful-good" as const };

describe("kitQualifies", () => {
  it("passes with no requirements", () => {
    expect(kitQualifies({ abilityMinimums: none, races: [], alignments: [] }, actor)).toEqual({ ok: true });
  });
  it("passes when every minimum is met (equal counts)", () => {
    expect(kitQualifies({ abilityMinimums: { ...none, dex: 14, con: 12 }, races: [], alignments: [] }, actor)).toEqual({ ok: true });
  });
  it("fails an unmet ability minimum", () => {
    expect(kitQualifies({ abilityMinimums: { ...none, dex: 15 }, races: [], alignments: [] }, actor)).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.kitAbility",
    });
  });
  it("a zero minimum is no requirement", () => {
    expect(kitQualifies({ abilityMinimums: { ...none, str: 0 }, races: [], alignments: [] }, { ...actor, abilities: { ...scores, str: 3 } })).toEqual({ ok: true });
  });
  it("fails a race gate, including a race-less actor", () => {
    const q = { abilityMinimums: none, races: ["elf" as const], alignments: [] };
    expect(kitQualifies(q, actor)).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitRace" });
    expect(kitQualifies(q, { ...actor, race: null })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitRace" });
    expect(kitQualifies(q, { ...actor, race: "elf" })).toEqual({ ok: true });
  });
  it("fails an alignment gate", () => {
    const q = { abilityMinimums: none, races: [], alignments: ["chaotic-evil" as const] };
    expect(kitQualifies(q, actor)).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitAlignment" });
  });
});

describe("kitForbidsProficiency", () => {
  it("matches names and groups case-insensitively", () => {
    expect(kitForbidsProficiency(["Long Bow", "Blades"], "long bow")).toBe(true);
    expect(kitForbidsProficiency(["Long Bow", "Blades"], " BLADES ")).toBe(true);
    expect(kitForbidsProficiency(["Long Bow"], "Short Bow")).toBe(false);
    expect(kitForbidsProficiency([], "Long Bow")).toBe(false);
  });
});
