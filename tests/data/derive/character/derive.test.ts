import { describe, expect, it } from "vitest";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";

const base: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [],
  equippedArmor: null,
  equippedShield: null,
  carriedWeight: 0,
  memorized: [],
  spentWeaponSlots: 0,
  spentNonweaponSlots: 0,
  baseMovement: 12,
};

const fighterClass = {
  chassisId: "fighter" as const,
  specialistSchool: null,
  xp: 0,
  hpRolls: [] as number[],
  dualClassState: null,
  level: 1,
};
const mageClass = { ...fighterClass, chassisId: "mage" as const };

describe("deriveCharacter", () => {
  it("returns ability mods (§5.6 step 2)", () => {
    const d = deriveCharacter(base, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores).toEqual(base.abilities);
    expect(d.abilities.str.hitProb).toBe(0); // STR 12 -> no hit bonus
    expect(d.abilities.con.hpAdjustment).toBe(0); // CON 12 -> no hp adj
  });

  it("takes ability scores as-is — racial adjustment is prepareBaseData's job now (F3)", () => {
    const d = deriveCharacter({ ...base, race: "dwarf", abilities: { ...base.abilities, con: 15, cha: 13 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores.con).toBe(15); // no further delta
    expect(d.abilities.scores.cha).toBe(13);
  });

  it("no race still derives cleanly", () => {
    const d = deriveCharacter({ ...base, race: null }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores).toEqual(base.abilities);
  });

  it("halfling never gets exceptional Strength even at STR 18 / percentile 100 (F3 guard)", () => {
    const d = deriveCharacter(
      { ...base, race: "halfling", classes: [fighterClass], abilities: { ...base.abilities, str: 18 }, exceptionalStrengthPercentile: 100 },
      DEFAULT_OPTIONAL_RULES,
    );
    expect(d.abilities.str.hitProb).toBe(1); // STR 18 row, not the exceptional 18/00 row's 3
  });

  it("a warrior class unlocks the full Constitution hp bonus band", () => {
    const nonWarrior = deriveCharacter({ ...base, classes: [mageClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    const warrior = deriveCharacter({ ...base, classes: [fighterClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    expect(warrior.abilities.con.hpAdjustment).toBeGreaterThan(nonWarrior.abilities.con.hpAdjustment);
  });

  it("a mixed class list counts as warrior if any class is a warrior", () => {
    const d = deriveCharacter({ ...base, classes: [mageClass, fighterClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.con.hpAdjustment).toBeGreaterThan(0);
  });

  it("exceptional Strength: warrior, STR 18, percentile set, toggle on", () => {
    const d = deriveCharacter(
      { ...base, classes: [fighterClass], abilities: { ...base.abilities, str: 18 }, exceptionalStrengthPercentile: 100 },
      DEFAULT_OPTIONAL_RULES,
    );
    expect(d.abilities.str.hitProb).toBe(3); // 18/00 -> +3 to hit
  });
});

describe("deriveCharacter — full single-class pipeline (§5.6 steps 3-10)", () => {
  const fighter7: ActorSnapshot = {
    abilities: { str: 17, dex: 16, con: 16, int: 10, wis: 10, cha: 10 }, // post-racial (human)
    exceptionalStrengthPercentile: null,
    race: "human",
    classes: [{ chassisId: "fighter", specialistSchool: null, xp: 70000, hpRolls: [10, 8, 9, 7, 10, 6, 8], dualClassState: null, level: 7 }],
    equippedArmor: { baseArmorAc: 5, magicBonus: 0 }, // chain
    equippedShield: { shieldBonus: 1, magicBonus: 0 },
    carriedWeight: 60,
    memorized: [],
    spentWeaponSlots: 3,
    spentNonweaponSlots: 2,
    baseMovement: 12,
  };

  it("levels, HP, THAC0, AC, saves, proficiencies, encumbrance", () => {
    const d = deriveCharacter(fighter7, DEFAULT_OPTIONAL_RULES);
    expect(d.classes).toEqual([{ chassisId: "fighter", level: 7, canLevelUp: false }]);
    // HP: Σ[10,8,9,7,10,6,8]=58 + 7*(CON16 warrior adj +2) = 58 + 14 = 72
    expect(d.hpMax).toBe(72);
    // THAC0: warrior L7 base 14; STR 17 hitProb 1; DEX 16 missile +1
    expect(d.thac0).toEqual({ base: 14, melee: 13, ranged: 13 });
    // AC normal: chain 5 - shield 1 - DEX16 defensiveAdj 2 = 2 (engine: DEX 16 defensive adj is -2)
    expect(d.ac.normal).toBe(2);
    // warrior L7 breath-weapon save target (SAVE_MATRICES warrior band minLevel 7)
    expect(d.saves!.bw.target).toBe(12);
    // weapon slots: 4 + floor(7/3) = 6; spent 3 -> available 3
    expect(d.proficiencies!.weapon).toEqual({ total: 6, spent: 3, available: 3 });
    // 60 lb vs STR 17 allowance -> a category; movementRate <= 12
    expect(d.encumbrance.movementRate).toBeLessThanOrEqual(12);
    expect(d.multiclassPending).toBe(false);
  });

  it("a 0-class actor: level-dependent blocks are null", () => {
    const d = deriveCharacter({ ...fighter7, classes: [] }, DEFAULT_OPTIONAL_RULES);
    expect(d.classes).toEqual([]);
    expect(d.thac0).toBeNull();
    expect(d.saves).toBeNull();
    expect(d.spellSlots).toEqual({});
    expect(d.hpMax).toBe(0);
    expect(d.multiclassPending).toBe(false);
  });

  it("mage L5 INT 16 -> wizard spell slots", () => {
    const mage: ActorSnapshot = {
      ...fighter7,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      classes: [{ chassisId: "mage", specialistSchool: null, xp: 40000, hpRolls: [4, 3, 4, 2, 3], dualClassState: null, level: 5 }],
      equippedArmor: null, equippedShield: null,
    };
    const d = deriveCharacter(mage, DEFAULT_OPTIONAL_RULES);
    expect(d.spellSlots.wizard![1].max).toBe(4);
  });

  it("two classes -> derives from the first + flags multiclassPending", () => {
    const d = deriveCharacter({
      ...fighter7,
      classes: [
        { chassisId: "fighter", specialistSchool: null, xp: 70000, hpRolls: [10], dualClassState: null, level: 7 },
        { chassisId: "mage", specialistSchool: null, xp: 40000, hpRolls: [4], dualClassState: null, level: 5 },
      ],
    }, DEFAULT_OPTIONAL_RULES);
    expect(d.multiclassPending).toBe(true);
    expect(d.classes).toHaveLength(2);
    expect(d.thac0!.base).toBe(14); // fighter (classes[0]) table
  });
});
