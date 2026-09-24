import { describe, expect, it } from "vitest";
import {
  TRAITS,
  TRAIT_ATTACK_MODES,
  TRAIT_EFFECT_KINDS,
  TRAIT_PROFICIENCY_TRACKS,
  TRAIT_SAVE_CATEGORIES,
  abilityScoreWithBonus,
  toTraitEffect,
  traitEffectTotals,
  type RawTraitEffect,
  type TraitEffect,
} from "../../../src/core/skills/traits";

function raw(over: Partial<RawTraitEffect> = {}): RawTraitEffect {
  return { kind: "", ability: "", save: "", mode: "", track: "", amount: 0, ...over };
}

describe("enum tables", () => {
  it("lists the five effect kinds, two attack modes, two proficiency tracks and the five save categories", () => {
    expect([...TRAIT_EFFECT_KINDS]).toEqual(["abilityBonus", "saveBonus", "attackBonus", "proficiencySlots", "bonusHp"]);
    expect([...TRAIT_ATTACK_MODES]).toEqual(["melee", "ranged"]);
    expect([...TRAIT_PROFICIENCY_TRACKS]).toEqual(["weapon", "nonweapon"]);
    expect([...TRAIT_SAVE_CATEGORIES]).toEqual(["ppd", "rsw", "pp", "bw", "spell"]);
  });
});

describe("TRAITS (spec §4.3.1 — the 14 designed traits)", () => {
  it("matches the spec table row for row", () => {
    expect(TRAITS.map((t) => [t.id, t.name, t.cost, t.effect])).toEqual([
      ["hardy", "Hardy", 6, { kind: "bonusHp", amount: 4 }],
      ["iron-will", "Iron Will", 5, { kind: "saveBonus", save: "spell", amount: 1 }],
      ["resilient", "Resilient", 5, { kind: "saveBonus", save: "ppd", amount: 1 }],
      ["steady-aim", "Steady Aim", 8, { kind: "attackBonus", mode: "ranged", amount: 1 }],
      ["brawler", "Brawler", 8, { kind: "attackBonus", mode: "melee", amount: 1 }],
      ["quick-study", "Quick Study", 4, { kind: "proficiencySlots", track: "nonweapon", amount: 2 }],
      ["weapon-drill", "Weapon Drill", 4, { kind: "proficiencySlots", track: "weapon", amount: 1 }],
      ["powerful", "Powerful", 7, { kind: "abilityBonus", ability: "str", amount: 1 }],
      ["sturdy", "Sturdy", 7, { kind: "abilityBonus", ability: "con", amount: 1 }],
      ["frail", "Frail", -4, { kind: "bonusHp", amount: -3 }],
      ["nervous", "Nervous", -4, { kind: "saveBonus", save: "spell", amount: -1 }],
      ["poor-aim", "Poor Aim", -5, { kind: "attackBonus", mode: "ranged", amount: -1 }],
      ["slow-learner", "Slow Learner", -3, { kind: "proficiencySlots", track: "nonweapon", amount: -1 }],
      ["feeble", "Feeble", -5, { kind: "abilityBonus", ability: "str", amount: -1 }],
    ]);
  });

  it("has unique ids and names, nine advantages and five disadvantages", () => {
    expect(new Set(TRAITS.map((t) => t.id)).size).toBe(14);
    expect(new Set(TRAITS.map((t) => t.name)).size).toBe(14);
    expect(TRAITS.filter((t) => t.cost > 0)).toHaveLength(9);
    expect(TRAITS.filter((t) => t.cost < 0)).toHaveLength(5);
  });
});

describe("toTraitEffect", () => {
  it("builds each of the five kinds from its own target member", () => {
    expect(toTraitEffect(raw({ kind: "abilityBonus", ability: "dex", amount: 2 }))).toEqual({ kind: "abilityBonus", ability: "dex", amount: 2 });
    expect(toTraitEffect(raw({ kind: "saveBonus", save: "bw", amount: -1 }))).toEqual({ kind: "saveBonus", save: "bw", amount: -1 });
    expect(toTraitEffect(raw({ kind: "attackBonus", mode: "melee", amount: 1 }))).toEqual({ kind: "attackBonus", mode: "melee", amount: 1 });
    expect(toTraitEffect(raw({ kind: "proficiencySlots", track: "weapon", amount: 3 }))).toEqual({ kind: "proficiencySlots", track: "weapon", amount: 3 });
    expect(toTraitEffect(raw({ kind: "bonusHp", amount: 4 }))).toEqual({ kind: "bonusHp", amount: 4 });
  });

  it("ignores target members that do not belong to its kind", () => {
    expect(toTraitEffect(raw({ kind: "bonusHp", ability: "str", save: "ppd", mode: "melee", track: "weapon", amount: 2 }))).toEqual({ kind: "bonusHp", amount: 2 });
  });

  it("returns null for a blank or unknown kind", () => {
    expect(toTraitEffect(raw())).toBeNull();
    expect(toTraitEffect(raw({ kind: "bogus", amount: 1 }))).toBeNull();
  });

  it("returns null when the kind's target is blank or not a real member", () => {
    expect(toTraitEffect(raw({ kind: "abilityBonus", ability: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "abilityBonus", ability: "luck", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "saveBonus", save: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "saveBonus", save: "fort", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "attackBonus", mode: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "attackBonus", mode: "thrown", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "proficiencySlots", track: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "proficiencySlots", track: "language", amount: 1 }))).toBeNull();
  });

  it("returns null for a non-integer amount, whatever the kind", () => {
    expect(toTraitEffect(raw({ kind: "bonusHp", amount: 1.5 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "bonusHp", amount: Number.NaN }))).toBeNull();
  });
});

describe("traitEffectTotals", () => {
  it("is all zeros for no effects", () => {
    expect(traitEffectTotals([])).toEqual({
      abilityBonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      saveBonus: { ppd: 0, rsw: 0, pp: 0, bw: 0, spell: 0 },
      attackBonus: { melee: 0, ranged: 0 },
      proficiencySlots: { weapon: 0, nonweapon: 0 },
      bonusHp: 0,
    });
  });

  it("sums every kind into its own slot, and stacking effects add", () => {
    const effects: TraitEffect[] = [
      { kind: "abilityBonus", ability: "str", amount: 1 },
      { kind: "abilityBonus", ability: "str", amount: -1 },
      { kind: "abilityBonus", ability: "con", amount: 1 },
      { kind: "saveBonus", save: "spell", amount: 1 },
      { kind: "saveBonus", save: "spell", amount: 1 },
      { kind: "saveBonus", save: "ppd", amount: -1 },
      { kind: "attackBonus", mode: "melee", amount: 1 },
      { kind: "attackBonus", mode: "ranged", amount: -1 },
      { kind: "proficiencySlots", track: "weapon", amount: 1 },
      { kind: "proficiencySlots", track: "nonweapon", amount: 2 },
      { kind: "proficiencySlots", track: "nonweapon", amount: -1 },
      { kind: "bonusHp", amount: 4 },
      { kind: "bonusHp", amount: -3 },
    ];
    expect(traitEffectTotals(effects)).toEqual({
      abilityBonus: { str: 0, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
      saveBonus: { ppd: -1, rsw: 0, pp: 0, bw: 0, spell: 2 },
      attackBonus: { melee: 1, ranged: -1 },
      proficiencySlots: { weapon: 1, nonweapon: 1 },
      bonusHp: 1,
    });
  });

  it("returns a fresh object each call (no shared mutable zero record)", () => {
    const a = traitEffectTotals([]);
    a.bonusHp = 99;
    a.abilityBonus.str = 5;
    expect(traitEffectTotals([]).bonusHp).toBe(0);
    expect(traitEffectTotals([]).abilityBonus.str).toBe(0);
  });
});

describe("abilityScoreWithBonus", () => {
  it("returns the score untouched for a zero bonus, even outside [1, 25]", () => {
    expect(abilityScoreWithBonus(30, 0)).toBe(30);
    expect(abilityScoreWithBonus(0, 0)).toBe(0);
    expect(abilityScoreWithBonus(12, 0)).toBe(12);
  });

  it("adds a non-zero bonus and clamps the result to [1, 25]", () => {
    expect(abilityScoreWithBonus(12, 1)).toBe(13);
    expect(abilityScoreWithBonus(12, -2)).toBe(10);
    expect(abilityScoreWithBonus(25, 1)).toBe(25);
    expect(abilityScoreWithBonus(1, -1)).toBe(1);
    expect(abilityScoreWithBonus(24, 5)).toBe(25);
  });
});
