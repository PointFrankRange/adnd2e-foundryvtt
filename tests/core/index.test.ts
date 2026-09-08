import { describe, expect, it } from "vitest";
import {
  saveTarget,
  saveBaseTarget,
  racialSaveBonus,
  sleepCharmResistance,
  armorClass,
  wizardSpellSlots,
  backstabMultiplier,
  encumbranceCategory,
  specialistAttacksPerRound,
} from "../../src/core";

describe("src/core barrel", () => {
  it("re-exports the saves API and it computes", () => {
    expect(saveBaseTarget("wizard", 5, "spell")).toBe(12);
    expect(racialSaveBonus("dwarf", "spell", 15)).toBe(4);
    expect(sleepCharmResistance("elf")).toBe(90);
    expect(
      saveTarget({
        group: "wizard",
        level: 5,
        category: "spell",
        race: "human",
        con: 12,
        wisMagicalDefenseAdj: 0,
        dexDefensiveAdj: 0,
      }).target,
    ).toBe(12);
    expect(armorClass({ baseArmorAc: 10 }).value).toBe(10);
    expect(wizardSpellSlots({ wizardLevel: 1, maxSpellLevelKnown: 4 }).perLevel[0]).toBe(1);
    expect(backstabMultiplier(10)).toBe(4);
    expect(
      encumbranceCategory({ carried: 0, strengthScore: 18, weightAllowance: 110, maxPress: 255 }),
    ).toBe("unencumbered");
    expect(specialistAttacksPerRound(1, "melee")).toEqual({ attacks: 3, rounds: 2 });
  });
});
