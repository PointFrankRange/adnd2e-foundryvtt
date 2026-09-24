// Player's Option: Skills & Powers traits (SP8 Plan 8c). A trait is a purchasable
// (or, at a negative cost, refunding) character feature whose mechanical effect
// is one entry of a CLOSED typed set, interpreted by pure derive code — never an
// ActiveEffect (spec §2). Every name, cost and amount below is this project's
// OWN design (content policy). No Foundry imports.
import type { AbilityKey, SaveCategory } from "../types";

export const TRAIT_EFFECT_KINDS = ["abilityBonus", "saveBonus", "attackBonus", "proficiencySlots", "bonusHp"] as const;
export type TraitEffectKind = (typeof TRAIT_EFFECT_KINDS)[number];

export const TRAIT_ATTACK_MODES = ["melee", "ranged"] as const;
export type TraitAttackMode = (typeof TRAIT_ATTACK_MODES)[number];

export const TRAIT_PROFICIENCY_TRACKS = ["weapon", "nonweapon"] as const;
export type TraitProficiencyTrack = (typeof TRAIT_PROFICIENCY_TRACKS)[number];

export const TRAIT_SAVE_CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

const ABILITY_IDS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export type TraitEffect =
  | { kind: "abilityBonus"; ability: AbilityKey; amount: number }
  | { kind: "saveBonus"; save: SaveCategory; amount: number }
  | { kind: "attackBonus"; mode: TraitAttackMode; amount: number }
  | { kind: "proficiencySlots"; track: TraitProficiencyTrack; amount: number }
  | { kind: "bonusHp"; amount: number };

/** The flat authored shape stored on a `trait` Item's `system.effect`. */
export interface RawTraitEffect {
  kind: string;
  ability: string;
  save: string;
  mode: string;
  track: string;
  amount: number;
}

export interface Trait {
  id: string;
  name: string;
  /** CP cost; negative for a disadvantage (a refund) */
  cost: number;
  effect: TraitEffect;
}

/** The 14 designed traits (spec §4.3.1), in spec order. */
export const TRAITS: readonly Trait[] = [
  { id: "hardy", name: "Hardy", cost: 6, effect: { kind: "bonusHp", amount: 4 } },
  { id: "iron-will", name: "Iron Will", cost: 5, effect: { kind: "saveBonus", save: "spell", amount: 1 } },
  { id: "resilient", name: "Resilient", cost: 5, effect: { kind: "saveBonus", save: "ppd", amount: 1 } },
  { id: "steady-aim", name: "Steady Aim", cost: 8, effect: { kind: "attackBonus", mode: "ranged", amount: 1 } },
  { id: "brawler", name: "Brawler", cost: 8, effect: { kind: "attackBonus", mode: "melee", amount: 1 } },
  { id: "quick-study", name: "Quick Study", cost: 4, effect: { kind: "proficiencySlots", track: "nonweapon", amount: 2 } },
  { id: "weapon-drill", name: "Weapon Drill", cost: 4, effect: { kind: "proficiencySlots", track: "weapon", amount: 1 } },
  { id: "powerful", name: "Powerful", cost: 7, effect: { kind: "abilityBonus", ability: "str", amount: 1 } },
  { id: "sturdy", name: "Sturdy", cost: 7, effect: { kind: "abilityBonus", ability: "con", amount: 1 } },
  { id: "frail", name: "Frail", cost: -4, effect: { kind: "bonusHp", amount: -3 } },
  { id: "nervous", name: "Nervous", cost: -4, effect: { kind: "saveBonus", save: "spell", amount: -1 } },
  { id: "poor-aim", name: "Poor Aim", cost: -5, effect: { kind: "attackBonus", mode: "ranged", amount: -1 } },
  { id: "slow-learner", name: "Slow Learner", cost: -3, effect: { kind: "proficiencySlots", track: "nonweapon", amount: -1 } },
  { id: "feeble", name: "Feeble", cost: -5, effect: { kind: "abilityBonus", ability: "str", amount: -1 } },
];

function isMember<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

/**
 * The typed effect a stored `system.effect` describes, or `null` when it is
 * malformed (blank/unknown kind, a missing or invalid target for that kind, a
 * non-integer amount). A `null` effect is INERT — the trait still costs or
 * refunds its `cost` in the ledger but changes nothing on the character.
 */
export function toTraitEffect(raw: RawTraitEffect): TraitEffect | null {
  if (!Number.isInteger(raw.amount)) return null;
  const amount = raw.amount;
  switch (raw.kind) {
    case "abilityBonus":
      return isMember(ABILITY_IDS, raw.ability) ? { kind: "abilityBonus", ability: raw.ability, amount } : null;
    case "saveBonus":
      return isMember(TRAIT_SAVE_CATEGORIES, raw.save) ? { kind: "saveBonus", save: raw.save, amount } : null;
    case "attackBonus":
      return isMember(TRAIT_ATTACK_MODES, raw.mode) ? { kind: "attackBonus", mode: raw.mode, amount } : null;
    case "proficiencySlots":
      return isMember(TRAIT_PROFICIENCY_TRACKS, raw.track) ? { kind: "proficiencySlots", track: raw.track, amount } : null;
    case "bonusHp":
      return { kind: "bonusHp", amount };
    default:
      return null;
  }
}

export interface TraitTotals {
  abilityBonus: Record<AbilityKey, number>;
  saveBonus: Record<SaveCategory, number>;
  attackBonus: Record<TraitAttackMode, number>;
  proficiencySlots: Record<TraitProficiencyTrack, number>;
  bonusHp: number;
}

/** The pure reducer over the owned traits' typed effects. */
export function traitEffectTotals(effects: readonly TraitEffect[]): TraitTotals {
  const totals: TraitTotals = {
    abilityBonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    saveBonus: { ppd: 0, rsw: 0, pp: 0, bw: 0, spell: 0 },
    attackBonus: { melee: 0, ranged: 0 },
    proficiencySlots: { weapon: 0, nonweapon: 0 },
    bonusHp: 0,
  };
  for (const effect of effects) {
    switch (effect.kind) {
      case "abilityBonus":
        totals.abilityBonus[effect.ability] += effect.amount;
        break;
      case "saveBonus":
        totals.saveBonus[effect.save] += effect.amount;
        break;
      case "attackBonus":
        totals.attackBonus[effect.mode] += effect.amount;
        break;
      case "proficiencySlots":
        totals.proficiencySlots[effect.track] += effect.amount;
        break;
      case "bonusHp":
        totals.bonusHp += effect.amount;
        break;
    }
  }
  return totals;
}

const MIN_SCORE = 1;
const MAX_SCORE = 25;

/**
 * An ability score after a trait bonus: the score UNCHANGED for a zero bonus
 * (so rule-off / no ability trait leaves prepared scores byte-identical, even an
 * authored score outside [1, 25]), else `score + bonus` clamped to [1, 25].
 */
export function abilityScoreWithBonus(score: number, bonus: number): number {
  if (bonus === 0) return score;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, score + bonus));
}
