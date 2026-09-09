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
  wizardMemorized: [],
  priestMemorized: [],
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
    wizardMemorized: [],
    priestMemorized: [],
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
    expect(d.multiclass.mode).toBe("single");
  });

  it("a 0-class actor: level-dependent blocks are null", () => {
    const d = deriveCharacter({ ...fighter7, classes: [] }, DEFAULT_OPTIONAL_RULES);
    expect(d.classes).toEqual([]);
    expect(d.thac0).toBeNull();
    expect(d.saves).toBeNull();
    expect(d.spellSlots).toEqual({});
    expect(d.hpMax).toBe(0);
    expect(d.multiclass.mode).toBe("single");
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

});

describe("deriveCharacter — multiclass (§5.6 step 1)", () => {
  const elfFM: ActorSnapshot = {
    abilities: { str: 13, dex: 16, con: 15, int: 15, wis: 10, cha: 10 },
    exceptionalStrengthPercentile: null,
    race: "elf",
    classes: [
      // xp set so deriveClassLevels resolves fighter 5 / mage 6 (fixture `level` alone is not read)
      { chassisId: "fighter", specialistSchool: null, xp: 16000, hpRolls: [10, 9, 8, 10, 7], dualClassState: null, level: 5 },
      { chassisId: "mage", specialistSchool: null, xp: 40000, hpRolls: [4, 3, 4, 2, 3, 4], dualClassState: null, level: 6 },
    ],
    equippedArmor: null,
    equippedShield: null,
    carriedWeight: 0,
    wizardMemorized: [],
    priestMemorized: [],
    spentWeaponSlots: 0,
    spentNonweaponSlots: 0,
    baseMovement: 12,
  };

  it("Fighter 5 / Mage 6: averaged HP, best THAC0, best-of saves, split prof classes", () => {
    const d = deriveCharacter(elfFM, DEFAULT_OPTIONAL_RULES);
    expect(d.multiclass.mode).toBe("multiclass");
    expect(d.multiclass.hpAveraged).toBe(true);
    expect(d.hpMax).toBe(37);
    // best THAC0 = warrior L5 = 16 ; STR 13 hitProb 0 ; DEX 16 missile +1
    expect(d.thac0).toEqual({ base: 16, melee: 16, ranged: 15 });
    // saves: rsw wins from wizard (9), ppd from warrior (11)
    expect(d.saves!.rsw.target).toBe(9);
    expect(d.saves!.ppd.target).toBe(11);
    // weapon from fighter (5), nonweapon from mage (6)
    expect(d.proficiencies!.weapon.total).toBe(5);
    expect(d.proficiencies!.nonweapon.total).toBe(6);
    // only the mage casts
    expect(d.spellSlots.wizard).toBeDefined();
    expect(d.spellSlots.priest).toBeUndefined();
    expect(d.multiclass.dualClass).toEqual({ dormantChassisId: null, activeChassisId: null, surpassed: false });
  });

  it("multiclassHpAveraging off -> highest single class HP", () => {
    const d = deriveCharacter(elfFM, { ...DEFAULT_OPTIONAL_RULES, multiclassHpAveraging: false });
    expect(d.hpMax).toBe(49); // characterHpMax(fighter,5,...,+1)
    expect(d.multiclass.hpAveraged).toBe(false);
  });

  it("half-elf Fighter/Mage/Cleric: both spell records populated", () => {
    const fmc: ActorSnapshot = {
      ...elfFM,
      race: "half-elf",
      abilities: { str: 13, dex: 12, con: 15, int: 12, wis: 15, cha: 10 },
      classes: [
        { chassisId: "fighter", specialistSchool: null, xp: 8000, hpRolls: [10, 8, 9, 7], dualClassState: null, level: 4 },
        { chassisId: "mage", specialistSchool: null, xp: 10000, hpRolls: [4, 3, 4, 2], dualClassState: null, level: 4 },
        { chassisId: "cleric", specialistSchool: null, xp: 6000, hpRolls: [8, 6, 7, 8], dualClassState: null, level: 4 },
      ],
    };
    const d = deriveCharacter(fmc, DEFAULT_OPTIONAL_RULES);
    expect(d.hpMax).toBe(29); // floor((38+17+33)/3)
    expect(d.spellSlots.wizard).toBeDefined();
    expect(d.spellSlots.priest).toBeDefined();
    expect(d.thac0!.base).toBe(17); // warrior L4
  });
});

describe("deriveCharacter — dual-class (§5.6 step 1)", () => {
  const humanFtoM = (mageLevel: number, mageRolls: number[]): ActorSnapshot => ({
    abilities: { str: 15, dex: 12, con: 16, int: 15, wis: 10, cha: 10 },
    exceptionalStrengthPercentile: null,
    race: "human",
    classes: [
      // xp set so deriveClassLevels resolves fighter 6 (primary) / mage `mageLevel` (active)
      { chassisId: "fighter", specialistSchool: null, xp: 32000, hpRolls: [10, 8, 9, 10, 7, 8], dualClassState: "primary", level: 6 },
      { chassisId: "mage", specialistSchool: null, xp: mageLevel >= 7 ? 60000 : 5000, hpRolls: mageRolls, dualClassState: "active", level: mageLevel },
    ],
    equippedArmor: null,
    equippedShield: null,
    carriedWeight: 0,
    wizardMemorized: [],
    priestMemorized: [],
    spentWeaponSlots: 0,
    spentNonweaponSlots: 0,
    baseMovement: 12,
  });

  it("suppressed (mage 3 <= fighter 6): mage THAC0/saves, HP frozen, mage spells", () => {
    const d = deriveCharacter(humanFtoM(3, [4, 3, 4]), DEFAULT_OPTIONAL_RULES);
    expect(d.multiclass.mode).toBe("dualclass");
    expect(d.multiclass.dualClass).toEqual({ dormantChassisId: "fighter", activeChassisId: "mage", surpassed: false });
    expect(d.hpMax).toBe(64); // frozen fighter L6 total (CON 16 -> +2)
    expect(d.thac0!.base).toBe(20); // thac0("wizard",3)
    expect(d.saves!.spell.target).toBe(12); // wizard band minLevel 1
    expect(d.spellSlots.wizard).toBeDefined();
  });

  it("surpassed (mage 7 > fighter 6): best-of THAC0 & saves, HP frozen + mage L7 die", () => {
    const d = deriveCharacter(humanFtoM(7, [4, 3, 4, 2, 3, 4, 3]), DEFAULT_OPTIONAL_RULES);
    expect(d.multiclass.dualClass.surpassed).toBe(true);
    expect(d.hpMax).toBe(69);
    expect(d.thac0!.base).toBe(15); // best of warrior L6 (15) vs wizard L7 (18)
    expect(d.saves!.rsw.target).toBe(9); // wizard L7 band
    expect(d.saves!.ppd.target).toBe(11); // warrior band minLevel 5
  });
});
