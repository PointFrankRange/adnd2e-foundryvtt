import { describe, expect, it } from "vitest";
import { spellbookLimits, specialistLearnModifier, canLearnSpell, learnSpellRoll } from "../../../src/core/magic/spellbook";
import { intelligence } from "../../../src/core/abilities/intelligence";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";

describe("spellbookLimits()", () => {
  it("projects the spellbook-relevant Intelligence fields", () => {
    expect(spellbookLimits(intelligence(16))).toEqual({
      maxSpellLevel: 8,
      chanceToLearn: 70,
      maxSpellsPerLevel: 11,
    });
  });
  it("is all-null below INT 9", () => {
    expect(spellbookLimits(intelligence(8))).toEqual({
      maxSpellLevel: null,
      chanceToLearn: null,
      maxSpellsPerLevel: null,
    });
  });
  it("INT 19+ has no per-level cap", () => {
    expect(spellbookLimits(intelligence(19)).maxSpellsPerLevel).toBeNull();
  });
});

describe("specialistLearnModifier()", () => {
  it("no specialist school -> 0", () => {
    expect(specialistLearnModifier("illusion", null)).toBe(0);
  });
  it("own school -> +15", () => {
    expect(specialistLearnModifier("illusion", "illusion")).toBe(15);
  });
  it("opposition school -> null (cannot learn)", () => {
    expect(specialistLearnModifier("necromancy", "illusion")).toBeNull();
  });
  it("any other school -> -15", () => {
    expect(specialistLearnModifier("conjuration", "illusion")).toBe(-15);
  });
});

describe("canLearnSpell()", () => {
  const int16 = intelligence(16);

  it("mage learns an in-range spell at the base chance", () => {
    const r = canLearnSpell({ int: int16, spellLevel: 4, spellSchool: "alteration" });
    expect(r).toEqual({ allowed: true, chance: 70, reason: null });
  });

  it("INT too low", () => {
    const r = canLearnSpell({ int: intelligence(8), spellLevel: 1, spellSchool: "alteration" });
    expect(r).toEqual({ allowed: false, chance: 0, reason: "int-too-low" });
  });

  it("rejects when the learn chance is unavailable (defensive null branch)", () => {
    const noChance = { ...intelligence(16), learnSpellChance: null };
    const r = canLearnSpell({ int: noChance, spellLevel: 1, spellSchool: "alteration" });
    expect(r.reason).toBe("int-too-low");
  });

  it("spell level above the INT max", () => {
    const r = canLearnSpell({ int: int16, spellLevel: 9, spellSchool: "alteration" });
    expect(r.reason).toBe("spell-level-exceeds-int"); // INT 16 max is 8th
  });

  it("specialist gets +15 for their own school (clamped at 99)", () => {
    const r = canLearnSpell({
      int: intelligence(18), // chanceToLearn 85
      spellLevel: 3,
      spellSchool: "illusion",
      specialistSchool: "illusion",
    });
    expect(r).toEqual({ allowed: true, chance: 99, reason: null }); // 85 + 15 -> 100 -> clamp 99
  });

  it("specialist cannot learn an opposition-school spell", () => {
    const r = canLearnSpell({
      int: int16,
      spellLevel: 2,
      spellSchool: "necromancy",
      specialistSchool: "illusion",
    });
    expect(r.reason).toBe("opposition-school");
  });

  it("specialist gets -15 for a non-opposed other school (chance floored at 1)", () => {
    const r = canLearnSpell({
      int: intelligence(9), // chanceToLearn 35
      spellLevel: 1,
      spellSchool: "abjuration",
      specialistSchool: "conjuration",
    });
    expect(r.chance).toBe(20); // 35 - 15
  });

  it("per-level cap: enforced only when the option is on", () => {
    const base = {
      int: int16, // maxSpellsPerLevel 11
      spellLevel: 1 as const,
      spellSchool: "alteration" as const,
      knownAtThisLevel: 11,
    };
    expect(canLearnSpell(base).allowed).toBe(true); // option off by default
    const r = canLearnSpell({ ...base, options: { ...DEFAULT_OPTIONAL_RULES, maxSpellsPerLevel: true } });
    expect(r).toEqual({ allowed: false, chance: 0, reason: "per-level-cap-reached" });
  });

  it("per-level cap: no cap (INT 19+) means the option never blocks", () => {
    const r = canLearnSpell({
      int: intelligence(19),
      spellLevel: 1,
      spellSchool: "alteration",
      knownAtThisLevel: 99,
      options: { ...DEFAULT_OPTIONAL_RULES, maxSpellsPerLevel: true },
    });
    expect(r.allowed).toBe(true);
  });

  it("rejects a nonsense spell level", () => {
    expect(() => canLearnSpell({ int: int16, spellLevel: 0, spellSchool: "alteration" })).toThrow(RangeError);
  });
});

describe("learnSpellRoll()", () => {
  it("d100 <= chance is a success", () => {
    expect(learnSpellRoll(20, 20)).toBe(true);
    expect(learnSpellRoll(21, 20)).toBe(false);
  });
  it("rejects an out-of-range roll", () => {
    expect(() => learnSpellRoll(0, 50)).toThrow(RangeError);
    expect(() => learnSpellRoll(101, 50)).toThrow(RangeError);
    expect(() => learnSpellRoll(5.5, 50)).toThrow(RangeError);
  });
});
