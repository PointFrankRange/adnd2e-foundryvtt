// PHB Table 21 (p.30) wizard spell slots, adjusted for the Intelligence
// spell-level cap (Table 4) and the specialist wizard's +1 spell/level (p.31).
import { assertLevel, assertSpellLevel } from "../errors";
import type { SpellSlots } from "../types";
import { WIZARD_SPELL_PROGRESSION } from "./tables";

const MAX_TABLE_LEVEL = 20;

export interface WizardSlotInput {
  /** wizard class level (>= 1); levels above 20 reuse the level-20 row */
  wizardLevel: number;
  /** highest castable spell level — IntelligenceModifiers.maxSpellLevel (1-9) */
  maxSpellLevelKnown: number;
  /** true for a specialist wizard (+1 spell at every castable spell level) */
  specialist?: boolean;
}

export function wizardSpellSlots(input: WizardSlotInput): SpellSlots {
  assertLevel(input.wizardLevel, "wizardLevel");
  assertSpellLevel(input.maxSpellLevelKnown);

  const rowIndex = Math.min(input.wizardLevel, MAX_TABLE_LEVEL) - 1;
  const base = WIZARD_SPELL_PROGRESSION[rowIndex];
  const specialist = input.specialist ?? false;

  const bonus = base.map((count) => (specialist && count > 0 ? 1 : 0));
  const suppressed: number[] = [];
  const perLevel = base.map((count, i) => {
    const withBonus = count + bonus[i];
    if (i + 1 > input.maxSpellLevelKnown) {
      if (withBonus > 0) suppressed.push(i + 1);
      return 0;
    }
    return withBonus;
  });

  return { perLevel, base: [...base], bonus, suppressed };
}
