// PHB Table 17 (Paladin), Table 18 (Ranger), Table 32 (Bard): limited-caster
// spell slots. Paladin and Ranger get no Wisdom bonus spells (PHB p.28-29);
// Bards cast wizard spells and never specialise.
import { assertLevel, assertSpellLevel } from "../errors";
import type { SpellProgressionId, SpellSlots } from "../types";
import {
  BARD_SPELL_PROGRESSION,
  PALADIN_SPELL_PROGRESSION,
  RANGER_SPELL_PROGRESSION,
} from "./tables";

/**
 * Whether a chassis progression casts from the priest spell list (on classic
 * slots, and with the priest sphere-access tables): cleric/druid ("priest"),
 * paladin, and ranger. Wizard and bard are not priest progressions.
 */
export function isPriestSpellProgression(progressionId: SpellProgressionId | null): boolean {
  return progressionId === "priest" || progressionId === "paladin" || progressionId === "ranger";
}

/**
 * Whether a priest-progression chassis casts from the spell-points priest pool
 * (cleric and druid, "priest" only). Paladins and rangers have no pool: they
 * stay on classic slots even when the spell-points rule is on.
 */
export function isPriestPoolProgression(progressionId: SpellProgressionId | null): boolean {
  return progressionId === "priest";
}

const PALADIN_START = 9;
const RANGER_START = 8;
const RANGER_TABLE_MAX = RANGER_SPELL_PROGRESSION.length;
const BARD_TABLE_MAX = BARD_SPELL_PROGRESSION.length;

/** Priest spell slots for a paladin (PHB Table 17). No Wisdom bonus. */
export function paladinSpellSlots(paladinLevel: number): readonly number[] {
  assertLevel(paladinLevel, "paladinLevel");
  if (paladinLevel < PALADIN_START) return [0, 0, 0, 0];
  const row = Math.min(
    paladinLevel,
    PALADIN_START + PALADIN_SPELL_PROGRESSION.length - 1,
  ) - PALADIN_START;
  return [...PALADIN_SPELL_PROGRESSION[row]];
}

/** Priest spell slots for a ranger (PHB Table 18). No Wisdom bonus. */
export function rangerSpellSlots(rangerLevel: number): readonly number[] {
  assertLevel(rangerLevel, "rangerLevel");
  if (rangerLevel < RANGER_START) return [0, 0, 0];
  return [...RANGER_SPELL_PROGRESSION[Math.min(rangerLevel, RANGER_TABLE_MAX) - 1]];
}

export interface BardSlotInput {
  bardLevel: number;
  /** highest castable spell level — IntelligenceModifiers.maxSpellLevel (1-9) */
  maxSpellLevelKnown: number;
}

/** Wizard spell slots for a bard (PHB Table 32), Intelligence-capped, never specialised. */
export function bardSpellSlots(input: BardSlotInput): SpellSlots {
  assertLevel(input.bardLevel, "bardLevel");
  assertSpellLevel(input.maxSpellLevelKnown);
  const base = BARD_SPELL_PROGRESSION[Math.min(input.bardLevel, BARD_TABLE_MAX) - 1];
  const bonus = base.map(() => 0);
  const suppressed: number[] = [];
  const perLevel = base.map((count, i) => {
    if (i + 1 > input.maxSpellLevelKnown) {
      if (count > 0) suppressed.push(i + 1);
      return 0;
    }
    return count;
  });
  return { perLevel, base: [...base], bonus, suppressed };
}
