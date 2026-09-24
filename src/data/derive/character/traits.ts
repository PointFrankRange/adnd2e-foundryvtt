// SP8 Plan 8c: applies the owned traits' typed effects to the cached derived
// block. Pure. `deriveCharacter` (derive.ts) wraps its base derive with this;
// `CharacterModel.prepareBaseData` applies the ABILITY totals separately (right
// after the racial adjustment) using the SAME `resolveTraitTotals`, so the gate
// and the interpretation live in one place and an ability bonus is never
// counted twice — `applyTraitEffects` deliberately ignores `abilityBonus`.
import type { OptionalRules } from "../../../core/options";
import { characterPointBuildEnabled } from "../../../core/skills/character-points";
import {
  toTraitEffect, traitEffectTotals, TRAIT_SAVE_CATEGORIES, type RawTraitEffect, type TraitTotals,
} from "../../../core/skills/traits";
import type { CharacterDerived } from "./derive";
import type { SlotBlock } from "./proficiencies";
import type { TraitEntry } from "./snapshot";

/** Owned `trait` items with a well-formed effect, in item order (a malformed trait is inert). */
export function toTraitEntries(items: Iterable<{ type: string; system: unknown }>): TraitEntry[] {
  const out: TraitEntry[] = [];
  for (const item of items) {
    if (item.type !== "trait") continue;
    const s = item.system as { traitId: string; cost: number; effect: RawTraitEffect };
    const effect = toTraitEffect(s.effect);
    if (effect) out.push({ traitId: s.traitId, cost: s.cost, effect });
  }
  return out;
}

/** THE derive-side gate: all-zero totals while the rule is off, else the reduced trait effects. */
export function resolveTraitTotals(
  traits: readonly TraitEntry[],
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">,
): TraitTotals {
  return traitEffectTotals(characterPointBuildEnabled(rules) ? traits.map((t) => t.effect) : []);
}

/**
 * Bonus hit points on the derived maximum: unchanged for a zero bonus or when
 * there is no HP to adjust (an un-rolled character or a class-less actor
 * conjures none), else `max(1, hpMax + bonus)`.
 */
export function applyBonusHp(hpMax: number, bonus: number): number {
  if (bonus === 0 || hpMax <= 0) return hpMax;
  return Math.max(1, hpMax + bonus);
}

function shiftSlots(block: SlotBlock, amount: number): SlotBlock {
  const total = Math.max(0, block.total + amount);
  return { total, spent: block.spent, available: total - block.spent };
}

function applySaveBonuses(
  saves: NonNullable<CharacterDerived["saves"]>,
  bonus: TraitTotals["saveBonus"],
): NonNullable<CharacterDerived["saves"]> {
  const out = {} as NonNullable<CharacterDerived["saves"]>;
  for (const key of TRAIT_SAVE_CATEGORIES) {
    const s = saves[key];
    // a save succeeds when d20 + rollModifier >= target, so a bonus raises the
    // modifier and lowers the effective target; the class-table target is untouched
    out[key] = {
      target: s.target,
      rollModifier: s.rollModifier + bonus[key],
      effectiveTarget: s.effectiveTarget - bonus[key],
    };
  }
  return out;
}

/** Applies the save / attack / proficiency-slot / bonus-HP totals. Ignores `abilityBonus` (see file header). */
export function applyTraitEffects(derived: CharacterDerived, totals: TraitTotals): CharacterDerived {
  return {
    ...derived,
    hpMax: applyBonusHp(derived.hpMax, totals.bonusHp),
    // a positive to-hit modifier LOWERS THAC0 (descending scale), matching deriveThac0
    thac0: derived.thac0 && {
      base: derived.thac0.base,
      melee: derived.thac0.melee - totals.attackBonus.melee,
      ranged: derived.thac0.ranged - totals.attackBonus.ranged,
    },
    saves: derived.saves && applySaveBonuses(derived.saves, totals.saveBonus),
    proficiencies: derived.proficiencies && {
      ...derived.proficiencies,
      weapon: shiftSlots(derived.proficiencies.weapon, totals.proficiencySlots.weapon),
      nonweapon: shiftSlots(derived.proficiencies.nonweapon, totals.proficiencySlots.nonweapon),
    },
  };
}
