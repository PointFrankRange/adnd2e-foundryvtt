import type { AbilityScores, ClassGroup, DerivedAbilities } from "../types";
import type { OptionalRules } from "../options";
import { DEFAULT_OPTIONAL_RULES } from "../options";
import { strength } from "./strength";
import { dexterity } from "./dexterity";
import { constitution } from "./constitution";
import { intelligence } from "./intelligence";
import { wisdom } from "./wisdom";
import { charisma } from "./charisma";
import { applyRacialAdjustments, type Race } from "./racial-adjustments";

export * from "./racial-adjustments";
export { strength, dexterity, constitution, intelligence, wisdom, charisma };

export interface DeriveAbilitiesOptions {
  race: Race;
  isWarrior: boolean;
  options?: OptionalRules;
  exceptionalStrengthPercentile?: number | null;
}

export function deriveAbilities(raw: AbilityScores, opts: DeriveAbilitiesOptions): DerivedAbilities {
  const options = opts.options ?? DEFAULT_OPTIONAL_RULES;
  const scores = applyRacialAdjustments(raw, opts.race);
  const useExceptional =
    options.exceptionalStrength && opts.isWarrior && scores.str === 18
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
