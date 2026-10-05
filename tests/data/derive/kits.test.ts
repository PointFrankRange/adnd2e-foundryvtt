import { describe, expect, it } from "vitest";
import { activeKitEntries, toKitEntries } from "../../../src/data/derive/character/kits";
import { resolveTraitTotals } from "../../../src/data/derive/character/traits";
import { deriveClassLevels } from "../../../src/data/derive/character/levels";
import { classItemCanLevelUp, classItemLevel } from "../../../src/data/derive/class-item";
import { getChassis } from "../../../src/core/classes/chassis";
import { scaleThreshold } from "../../../src/core/kits";

const blankEffect = { ability: "", save: "", mode: "", track: "" };
const kitItem = (over: Record<string, unknown> = {}) => ({
  id: "k1",
  name: "Test Kit",
  type: "kit",
  system: {
    chassisId: "fighter",
    qualifications: { abilityMinimums: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, races: [], alignments: [] },
    xpModifierPercent: 25,
    effects: [
      { ...blankEffect, kind: "attackBonus", mode: "melee", amount: 2 },
      { ...blankEffect, kind: "bogus", amount: 1 },
    ],
    equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
    forbiddenWeaponProficiencies: [],
    grantedFeatures: ["Stance"],
    powers: [{ id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [] }, { id: "bad id", name: "X", uses: 1, per: "day" }],
    ...over,
  },
});
const classItem = (chassisId: string) => ({ type: "class", system: { chassisId } });
const rulesOff = { skillsAndPowersEnabled: false, characterPointBuild: false };

describe("toKitEntries / activeKitEntries", () => {
  it("reads kit items and drops malformed effects", () => {
    const [k] = toKitEntries([kitItem(), { type: "weapon", system: {} }]);
    expect(k!.id).toBe("k1");
    expect(k!.chassisId).toBe("fighter");
    expect(k!.xpModifierPercent).toBe(25);
    expect(k!.effects).toEqual([{ kind: "attackBonus", mode: "melee", amount: 2 }]);
    expect(k!.grantedFeatures).toEqual(["Stance"]);
    expect(k!.powers).toEqual([{ id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [] }]);
  });
  it("a kit item with no powers field reads as no powers", () => {
    const item = kitItem();
    delete (item.system as Record<string, unknown>).powers;
    expect(toKitEntries([item])[0]!.powers).toEqual([]);
  });
  it("only kits whose class the actor owns are active", () => {
    expect(activeKitEntries([kitItem(), classItem("fighter")])).toHaveLength(1);
    expect(activeKitEntries([kitItem(), classItem("mage")])).toHaveLength(0);
    expect(activeKitEntries([kitItem()])).toHaveLength(0);
  });
});

describe("kit effects feed the trait totals ungated", () => {
  it("applies while the character-point rule is off", () => {
    const [k] = toKitEntries([kitItem()]);
    const totals = resolveTraitTotals([], rulesOff, k!.effects);
    expect(totals.attackBonus.melee).toBe(2);
  });
  it("is unchanged without kit effects", () => {
    expect(resolveTraitTotals([], rulesOff).attackBonus.melee).toBe(0);
  });
});

describe("the XP modifier delays levels", () => {
  const level2 = getChassis("fighter").xpThresholds[1]!;
  it("classItemLevel and classItemCanLevelUp honour the percent (default 0)", () => {
    expect(classItemLevel("fighter", level2)).toBe(2);
    expect(classItemLevel("fighter", level2, 25)).toBe(1);
    expect(classItemLevel("fighter", scaleThreshold(level2, 25), 25)).toBe(2);
    expect(classItemCanLevelUp("fighter", level2, 1)).toBe(true);
    expect(classItemCanLevelUp("fighter", level2, 1, 25)).toBe(false);
  });
  it("deriveClassLevels reads each class entry's percent", () => {
    const entry = { chassisId: "fighter" as const, specialistSchool: null, xp: level2, hpRolls: [1], dualClassState: null, level: 1 };
    expect(deriveClassLevels([{ ...entry, xpModifierPercent: 25 }])[0]).toEqual({ chassisId: "fighter", level: 1, canLevelUp: false });
    expect(deriveClassLevels([entry])[0]).toEqual({ chassisId: "fighter", level: 2, canLevelUp: true });
  });
});
