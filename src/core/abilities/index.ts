import type { AbilityKey, AbilityScores, ClassGroup, DerivedAbilities, Race } from "../types";
import type { OptionalRules } from "../options";
import { DEFAULT_OPTIONAL_RULES } from "../options";
import { strength } from "./strength";
import { dexterity } from "./dexterity";
import { constitution } from "./constitution";
import { intelligence } from "./intelligence";
import { wisdom } from "./wisdom";
import { charisma } from "./charisma";
import { applyRacialAdjustments, applyRacialDeltas } from "./racial-adjustments";
import { assertAbilityScore } from "../errors";

export * from "./racial-adjustments";
export { strength, dexterity, constitution, intelligence, wisdom, charisma };

export interface DeriveAbilitiesOptions {
  race: Race;
  isWarrior: boolean;
  options?: OptionalRules;
  exceptionalStrengthPercentile?: number | null;
  /** Clamp to Table 7 racial min/max. Creation-time only; default false so
   * live updates (magic items, drain) are not silently truncated. */
  applyRacialLimits?: boolean;
}

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Runs on every actor update. `applyRacialLimits` (default false) opts in to the
 * character-creation clamp to Table 7 min/max; leave it off for live derivation
 * so magic items (STR 19-25) and ability drain are not silently truncated.
 */
export function deriveAbilities(raw: AbilityScores, opts: DeriveAbilitiesOptions): DerivedAbilities {
  for (const k of ABILITY_KEYS) assertAbilityScore(raw[k], k);
  const options = opts.options ?? DEFAULT_OPTIONAL_RULES;
  const scores = opts.applyRacialLimits
    ? applyRacialAdjustments(raw, opts.race)
    : applyRacialDeltas(raw, opts.race);
  const useExceptional =
    options.exceptionalStrength && opts.isWarrior && scores.str === 18 && opts.race !== "halfling"
      ? (opts.exceptionalStrengthPercentile ?? null)
      : null;
  return {
    scores,
    str: strength(scores.str, useExceptional),
    dex: dexterity(scores.dex),
    con: constitution(scores.con, opts.isWarrior),
    int: intelligence(scores.int),
    wis: wisdom(scores.wis),
    cha: charisma(scores.cha),
  };
}

const PRIME_REQUISITE: Record<ClassGroup, keyof AbilityScores> = {
  warrior: "str",
  wizard: "int",
  priest: "wis",
  rogue: "dex",
};

/** PHB ability chapter: +10% earned XP when the group's prime requisite is 16+. */
export function primeRequisiteXpBonus(group: ClassGroup, scores: AbilityScores): boolean {
  return scores[PRIME_REQUISITE[group]] >= 16;
}
