// PHB Ch.3 pp.30-31 + Table 4 (p.16): learning wizard spells. The engine
// consumes the already-derived IntelligenceModifiers (no runtime dependency on
// the abilities domain) and applies the specialist learn modifier (Table 22)
// and the optional "Maximum Number of Spells per Level" cap.
import { assertSpellLevel } from "../errors";
import type { OptionalRules } from "../options";
import type { IntelligenceModifiers, WizardSchool } from "../types";
import { SPECIALIST_SCHOOLS } from "./tables";

const CHANCE_MAX = 100;

export interface SpellbookLimits {
  /** highest spell level learnable/castable; null if INT < 9 */
  maxSpellLevel: number | null;
  /** percent chance to learn a new spell; null if INT < 9 */
  chanceToLearn: number | null;
  /** cap on spells known per spell level; null = no cap ("All") */
  maxSpellsPerLevel: number | null;
}

export function spellbookLimits(int: IntelligenceModifiers): SpellbookLimits {
  return {
    maxSpellLevel: int.maxSpellLevel,
    chanceToLearn: int.learnSpellChance,
    maxSpellsPerLevel: int.maxSpellsPerLevel,
  };
}

/**
 * PHB Table 22: +15% to learn a spell of your own specialty school, -15% for
 * any other school, and opposition-school spells cannot be learned (null).
 * A non-specialist mage (specialistSchool null) has no modifier.
 */
export function specialistLearnModifier(
  spellSchool: WizardSchool,
  specialistSchool: WizardSchool | null,
): number | null {
  if (specialistSchool === null) return 0;
  if (spellSchool === specialistSchool) return 15;
  if (SPECIALIST_SCHOOLS[specialistSchool].opposition.includes(spellSchool)) return null;
  return -15;
}

export type LearnRejection =
  "int-too-low" | "spell-level-exceeds-int" | "opposition-school" | "per-level-cap-reached";

/**
 * Checks whether a wizard can learn a spell. Does not check the wizard's class
 * level — the caller must first confirm the wizard can cast this spell level
 * (wizardSpellSlots(...).perLevel[spellLevel - 1] > 0).
 */
export interface CanLearnInput {
  int: IntelligenceModifiers;
  spellLevel: number;
  spellSchool: WizardSchool;
  specialistSchool?: WizardSchool | null;
  /** spells already known at this spell level (for the optional per-level cap) */
  knownAtThisLevel?: number;
  options?: OptionalRules;
}

export interface CanLearnResult {
  allowed: boolean;
  /** effective learn chance in percent (20-100); 0 when not allowed */
  chance: number;
  reason: LearnRejection | null;
}

function rejected(reason: LearnRejection): CanLearnResult {
  return { allowed: false, chance: 0, reason };
}

export function canLearnSpell(input: CanLearnInput): CanLearnResult {
  assertSpellLevel(input.spellLevel);

  const limits = spellbookLimits(input.int);
  if (limits.maxSpellLevel === null || limits.chanceToLearn === null) {
    return rejected("int-too-low");
  }
  if (input.spellLevel > limits.maxSpellLevel) {
    return rejected("spell-level-exceeds-int");
  }

  const mod = specialistLearnModifier(input.spellSchool, input.specialistSchool ?? null);
  if (mod === null) {
    return rejected("opposition-school");
  }

  if (
    input.options?.maxSpellsPerLevel &&
    limits.maxSpellsPerLevel !== null &&
    (input.knownAtThisLevel ?? 0) >= limits.maxSpellsPerLevel
  ) {
    return rejected("per-level-cap-reached");
  }

  // Cap at 100 (certainty); no floor — chanceToLearn >= 35 and mod >= -15, so >= 20.
  const chance = Math.min(CHANCE_MAX, limits.chanceToLearn + mod);
  return { allowed: true, chance, reason: null };
}

/** Resolve a learn-spell attempt: d100 (1-100) succeeds when <= chance. */
export function learnSpellRoll(d100: number, chance: number): boolean {
  if (!Number.isInteger(d100) || d100 < 1 || d100 > 100) {
    throw new RangeError(`d100 roll must be an integer in [1, 100], got ${d100}`);
  }
  return d100 <= chance;
}
