// PHB Table 5: WISDOM (p.17; Appendix 8 p.246). Bonus spells CUMULATIVE (p.17).
// Cumulative counts verified in references/research-notes.md.
import { assertAbilityScore } from "../errors";
import type { WisdomModifiers } from "../types";

const MAGICAL_DEFENSE: Record<number, number> = {
  1: -6, 2: -4, 3: -3, 4: -2, 5: -1, 6: -1, 7: -1, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
  13: 0, 14: 0, 15: 1, 16: 2, 17: 3, 18: 4, 19: 4, 20: 4, 21: 4, 22: 4, 23: 4, 24: 4, 25: 4,
};

const SPELL_FAILURE: Record<number, number> = {
  1: 80, 2: 60, 3: 50, 4: 45, 5: 40, 6: 35, 7: 30, 8: 25, 9: 20, 10: 15, 11: 10, 12: 5,
  13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0, 25: 0,
};

// Cumulative bonus priest spells per spell level [1..7].
const BONUS_PRIEST_SPELLS: Record<number, readonly number[]> = {
  13: [1, 0, 0, 0, 0, 0, 0],
  14: [2, 0, 0, 0, 0, 0, 0],
  15: [2, 1, 0, 0, 0, 0, 0],
  16: [2, 2, 0, 0, 0, 0, 0],
  17: [2, 2, 1, 0, 0, 0, 0],
  18: [2, 2, 1, 1, 0, 0, 0],
  19: [3, 2, 1, 2, 0, 0, 0],
  20: [3, 3, 1, 3, 0, 0, 0],
  21: [3, 3, 2, 3, 1, 0, 0],
  22: [3, 3, 2, 4, 2, 0, 0],
  23: [3, 3, 2, 4, 4, 0, 0],
  24: [3, 3, 2, 4, 4, 2, 0],
  25: [3, 3, 2, 4, 4, 3, 1],
};

const NO_BONUS: readonly number[] = [0, 0, 0, 0, 0, 0, 0];

export function wisdom(score: number): WisdomModifiers {
  assertAbilityScore(score, "wis");
  return {
    magicalDefenseAdj: MAGICAL_DEFENSE[score],
    bonusPriestSpells: [...(BONUS_PRIEST_SPELLS[score] ?? NO_BONUS)],
    spellFailureChance: SPELL_FAILURE[score],
    spellImmunityFromScore: score >= 19 ? score : null,
  };
}
