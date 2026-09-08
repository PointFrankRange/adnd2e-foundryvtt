// PHB Table 24 (p.33) priest spell slots, plus the cumulative Wisdom bonus
// spells (Table 5, p.17) granted only at castable spell levels, and the
// Table 24 footnotes: 6th-level slots need WIS >= 17, 7th-level need WIS >= 18.
import { assertAbilityScore, assertLevel } from "../errors";
import type { SpellSlots } from "../types";
import { PRIEST_SPELL_PROGRESSION } from "./tables";

const MAX_TABLE_LEVEL = 20;
const PRIEST_SPELL_LEVELS = 7;

export interface PriestSlotInput {
  /** priest class level (>= 1); levels above 20 reuse the level-20 row */
  priestLevel: number;
  /** the priest's Wisdom score (1-25); gates 6th (>=17) and 7th (>=18) slots */
  wisdomScore: number;
  /** cumulative Wisdom bonus priest spells — WisdomModifiers.bonusPriestSpells (length 7) */
  wisdomBonusSpells: readonly number[];
}

export function priestSpellSlots(input: PriestSlotInput): SpellSlots {
  assertLevel(input.priestLevel, "priestLevel");
  assertAbilityScore(input.wisdomScore, "wis");
  if (input.wisdomBonusSpells.length !== PRIEST_SPELL_LEVELS) {
    throw new RangeError(
      `wisdomBonusSpells must have ${PRIEST_SPELL_LEVELS} entries, got ${input.wisdomBonusSpells.length}`,
    );
  }

  const rowIndex = Math.min(input.priestLevel, MAX_TABLE_LEVEL) - 1;
  const base = PRIEST_SPELL_PROGRESSION[rowIndex];

  const bonus = base.map((count, i) => (count > 0 ? input.wisdomBonusSpells[i] : 0));
  const suppressed: number[] = [];
  const perLevel = base.map((count, i) => {
    const withBonus = count + bonus[i];
    const spellLevel = i + 1;
    const gated =
      (spellLevel === 6 && input.wisdomScore < 17) || (spellLevel === 7 && input.wisdomScore < 18);
    if (gated) {
      if (withBonus > 0) suppressed.push(spellLevel);
      return 0;
    }
    return withBonus;
  });

  return { perLevel, base: [...base], bonus, suppressed };
}
