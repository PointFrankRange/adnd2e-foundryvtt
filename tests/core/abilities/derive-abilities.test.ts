import { describe, expect, it } from "vitest";
import { deriveAbilities, primeRequisiteXpBonus } from "../../../src/core/abilities";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";

const raw = { str: 18, dex: 16, con: 18, int: 10, wis: 9, cha: 8 };

describe("deriveAbilities()", () => {
  it("applies racial adjustment before computing modifiers", () => {
    const d = deriveAbilities(raw, { race: "dwarf", isWarrior: true, options: DEFAULT_OPTIONAL_RULES });
    // eslint-disable-next-line no-constant-condition -- deliberate inline clamp check per task brief
    expect(d.scores.con).toBe(18 + 1 > 18 ? 18 : 19); // dwarf CON max is 18 -> clamped to 18
    expect(d.scores.con).toBe(18);
    expect(d.con.hpAdjustment).toBe(4); // warrior CON 18
    expect(d.scores.cha).toBe(7);
    expect(d.cha.reactionAdj).toBe(-1);
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
