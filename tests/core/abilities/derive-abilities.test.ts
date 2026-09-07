import { describe, expect, it } from "vitest";
import { deriveAbilities, primeRequisiteXpBonus } from "../../../src/core/abilities";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";

const raw = { str: 18, dex: 16, con: 18, int: 10, wis: 9, cha: 8 };

describe("deriveAbilities()", () => {
  it("applies racial adjustment before computing modifiers (with racial limits, creation-time)", () => {
    const d = deriveAbilities(raw, { race: "dwarf", isWarrior: true, options: DEFAULT_OPTIONAL_RULES, applyRacialLimits: true });
    // dwarf's +1 CON on a raw 18 is clamped to the racial maximum of 18
    expect(d.scores.con).toBe(18);
    expect(d.con.hpAdjustment).toBe(4); // warrior CON 18
    expect(d.scores.cha).toBe(7);
    expect(d.cha.reactionAdj).toBe(-1);
  });

  it("without applyRacialLimits, the racial delta is NOT clamped (live derivation)", () => {
    const d = deriveAbilities(raw, { race: "dwarf", isWarrior: true, options: DEFAULT_OPTIONAL_RULES });
    // dwarf +1 CON on raw 18 -> 19, not truncated to the racial max
    expect(d.scores.con).toBe(19);
  });

  it("does not truncate giant-range Strength from magic items (STR 20, human)", () => {
    const d = deriveAbilities({ ...raw, str: 20 }, { race: "human", isWarrior: true, options: DEFAULT_OPTIONAL_RULES });
    expect(d.str.damageAdj).toBe(8); // Table 1 STR 20 row is reachable
  });

  it("validates raw scores first — an out-of-range score throws RangeError", () => {
    expect(() => deriveAbilities({ ...raw, str: 0 }, { race: "human", isWarrior: false })).toThrow(RangeError);
  });

  it("halfling fighters do not roll exceptional Strength (PHB)", () => {
    // raw 19 - halfling's -1 STR delta -> effective 18; the exceptional gate must
    // still skip the percentile roll because the race is halfling.
    const d = deriveAbilities({ ...raw, str: 19 }, { race: "halfling", isWarrior: true, options: DEFAULT_OPTIONAL_RULES, exceptionalStrengthPercentile: 100 });
    expect(d.scores.str).toBe(18);
    expect(d.str.damageAdj).toBe(2); // plain 18, no 18/00
  });

  it("exceptional Strength only when toggle on + warrior + STR 18", () => {
    const on = deriveAbilities(raw, { race: "human", isWarrior: true, options: DEFAULT_OPTIONAL_RULES, exceptionalStrengthPercentile: 100 });
    expect(on.str.damageAdj).toBe(6); // 18/00

    const nonWarrior = deriveAbilities(raw, { race: "human", isWarrior: false, options: DEFAULT_OPTIONAL_RULES, exceptionalStrengthPercentile: 100 });
    expect(nonWarrior.str.damageAdj).toBe(2); // plain 18

    const toggleOff = deriveAbilities(raw, { race: "human", isWarrior: true, options: { ...DEFAULT_OPTIONAL_RULES, exceptionalStrength: false }, exceptionalStrengthPercentile: 100 });
    expect(toggleOff.str.damageAdj).toBe(2); // plain 18
  });

  it("all six modifier records are present", () => {
    const d = deriveAbilities(raw, { race: "human", isWarrior: false });
    expect(Object.keys(d)).toEqual(expect.arrayContaining(["scores", "str", "dex", "con", "int", "wis", "cha"]));
    expect(d.wis.bonusPriestSpells).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("primeRequisiteXpBonus()", () => {
  it("true at 16+ for the group's prime requisite", () => {
    expect(primeRequisiteXpBonus("warrior", { ...raw, str: 16 })).toBe(true);
    expect(primeRequisiteXpBonus("warrior", { ...raw, str: 15 })).toBe(false);
    expect(primeRequisiteXpBonus("wizard", { ...raw, int: 16 })).toBe(true);
    expect(primeRequisiteXpBonus("priest", { ...raw, wis: 16 })).toBe(true);
    expect(primeRequisiteXpBonus("rogue", { ...raw, dex: 16 })).toBe(true);
  });
});
