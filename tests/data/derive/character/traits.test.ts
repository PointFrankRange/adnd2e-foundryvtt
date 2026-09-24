import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { TRAITS } from "../../../../src/core/skills/traits";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot, TraitEntry } from "../../../../src/data/derive/character/snapshot";
import { applyBonusHp, resolveTraitTotals, toTraitEntries } from "../../../../src/data/derive/character/traits";

const ON = { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true, characterPointBuild: true };

const snap: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [
    { chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [10], dualClassState: null, level: 1 },
  ],
  equippedArmor: null,
  equippedShield: null,
  carriedWeight: 0,
  wizardMemorized: [],
  priestMemorized: [],
  spentWeaponSlots: 0,
  spentNonweaponSlots: 0,
  baseMovement: 12,
  thiefSkillAllocations: [],
  traits: [],
};

function entry(id: string): TraitEntry {
  const t = TRAITS.find((x) => x.id === id)!;
  return { traitId: t.id, cost: t.cost, effect: t.effect };
}
const withTraits = (...ids: string[]): ActorSnapshot => ({ ...snap, traits: ids.map(entry) });

const base = deriveCharacter(snap, ON);

describe("deriveCharacter — trait effects (rule ON)", () => {
  it("Hardy / Frail adjust hpMax", () => {
    expect(deriveCharacter(withTraits("hardy"), ON).hpMax).toBe(base.hpMax + 4);
    expect(deriveCharacter(withTraits("frail"), ON).hpMax).toBe(base.hpMax - 3);
  });

  it("save traits move only their category: rollModifier up, effectiveTarget down, target unchanged", () => {
    const d = deriveCharacter(withTraits("iron-will", "nervous", "nervous"), ON);
    // +1 then -1 -1  => net -1 on spell
    expect(d.saves!.spell.rollModifier).toBe(base.saves!.spell.rollModifier - 1);
    expect(d.saves!.spell.effectiveTarget).toBe(base.saves!.spell.effectiveTarget + 1);
    expect(d.saves!.spell.target).toBe(base.saves!.spell.target);
    expect(d.saves!.ppd).toEqual(base.saves!.ppd);
    const r = deriveCharacter(withTraits("resilient"), ON);
    expect(r.saves!.ppd.rollModifier).toBe(base.saves!.ppd.rollModifier + 1);
    expect(r.saves!.ppd.effectiveTarget).toBe(base.saves!.ppd.effectiveTarget - 1);
  });

  it("attack traits lower (or raise) only that mode's THAC0; base is untouched", () => {
    const b = deriveCharacter(withTraits("brawler"), ON);
    expect(b.thac0!.melee).toBe(base.thac0!.melee - 1);
    expect(b.thac0!.ranged).toBe(base.thac0!.ranged);
    expect(b.thac0!.base).toBe(base.thac0!.base);
    const s = deriveCharacter(withTraits("steady-aim", "poor-aim", "poor-aim"), ON);
    expect(s.thac0!.ranged).toBe(base.thac0!.ranged + 1); // -1 +1 +1
    expect(s.thac0!.melee).toBe(base.thac0!.melee);
  });

  it("proficiency-slot traits move total and available, never spent", () => {
    const q = deriveCharacter(withTraits("quick-study", "weapon-drill"), ON);
    expect(q.proficiencies!.nonweapon.total).toBe(base.proficiencies!.nonweapon.total + 2);
    expect(q.proficiencies!.nonweapon.available).toBe(base.proficiencies!.nonweapon.available + 2);
    expect(q.proficiencies!.weapon.total).toBe(base.proficiencies!.weapon.total + 1);
    expect(q.proficiencies!.weapon.spent).toBe(base.proficiencies!.weapon.spent);
    expect(q.proficiencies!.languagesMax).toBe(base.proficiencies!.languagesMax);
  });

  it("a slot penalty floors total at 0 and can leave available negative when slots were already spent", () => {
    const many: TraitEntry[] = Array.from({ length: 10 }, () => entry("slow-learner"));
    const d = deriveCharacter({ ...snap, spentNonweaponSlots: 1, traits: many }, ON);
    expect(d.proficiencies!.nonweapon.total).toBe(0);
    expect(d.proficiencies!.nonweapon.spent).toBe(1);
    expect(d.proficiencies!.nonweapon.available).toBe(-1);
  });

  it("IGNORES ability traits — those are applied to the prepared score in prepareBaseData, so they can never be double-counted here", () => {
    const d = deriveCharacter(withTraits("powerful", "sturdy", "feeble"), ON);
    expect(d.abilities.scores).toEqual(base.abilities.scores);
    expect(d).toEqual(base);
  });

  it("leaves a class-less actor's null blocks null and its hpMax at 0", () => {
    const empty: ActorSnapshot = { ...snap, classes: [], traits: [entry("hardy"), entry("brawler"), entry("iron-will"), entry("quick-study")] };
    const d = deriveCharacter(empty, ON);
    expect(d.thac0).toBeNull();
    expect(d.saves).toBeNull();
    expect(d.proficiencies).toBeNull();
    expect(d.hpMax).toBe(0);
  });
});

describe("deriveCharacter — trait effects are skipped entirely while the rule is off", () => {
  const all = withTraits("hardy", "iron-will", "brawler", "quick-study", "weapon-drill", "frail");
  it.each([
    ["everything off", DEFAULT_OPTIONAL_RULES],
    ["master only", { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true }],
    ["toggle only", { ...DEFAULT_OPTIONAL_RULES, characterPointBuild: true }],
  ])("%s → identical to a trait-less derive", (_label, rules) => {
    expect(deriveCharacter(all, rules)).toEqual(deriveCharacter(snap, rules));
  });
});

describe("applyBonusHp", () => {
  it("returns hpMax unchanged for a zero bonus or when there is no HP to adjust", () => {
    expect(applyBonusHp(10, 0)).toBe(10);
    expect(applyBonusHp(0, 4)).toBe(0);
    expect(applyBonusHp(-2, 4)).toBe(-2);
  });
  it("otherwise adds the bonus with a floor of 1", () => {
    expect(applyBonusHp(10, 4)).toBe(14);
    expect(applyBonusHp(10, -3)).toBe(7);
    expect(applyBonusHp(2, -5)).toBe(1);
  });
});

describe("resolveTraitTotals", () => {
  it("is all zeros while the rule is off and the real totals while it is on", () => {
    const traits = [entry("hardy"), entry("powerful")];
    expect(resolveTraitTotals(traits, DEFAULT_OPTIONAL_RULES).bonusHp).toBe(0);
    expect(resolveTraitTotals(traits, DEFAULT_OPTIONAL_RULES).abilityBonus.str).toBe(0);
    const on = resolveTraitTotals(traits, ON);
    expect(on.bonusHp).toBe(4);
    expect(on.abilityBonus.str).toBe(1);
  });
});

describe("toTraitEntries", () => {
  const effect = (over: Record<string, unknown> = {}) => ({ kind: "bonusHp", ability: "", save: "", mode: "", track: "", amount: 4, ...over });
  it("keeps only owned trait items with a well-formed effect, in item order", () => {
    const items = [
      { type: "weapon", system: {} },
      { type: "trait", system: { traitId: "hardy", cost: 6, effect: effect() } },
      { type: "trait", system: { traitId: "broken", cost: 3, effect: effect({ kind: "" }) } },
      { type: "trait", system: { traitId: "iron-will", cost: 5, effect: effect({ kind: "saveBonus", save: "spell", amount: 1 }) } },
    ];
    expect(toTraitEntries(items)).toEqual([
      { traitId: "hardy", cost: 6, effect: { kind: "bonusHp", amount: 4 } },
      { traitId: "iron-will", cost: 5, effect: { kind: "saveBonus", save: "spell", amount: 1 } },
    ]);
  });
  it("returns [] for an actor with no traits", () => {
    expect(toTraitEntries([])).toEqual([]);
  });
});
