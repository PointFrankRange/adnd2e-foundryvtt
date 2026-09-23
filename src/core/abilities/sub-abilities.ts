// Player's Option: Skills & Powers sub-ability scores (SP8 Plan 8a). Each of
// the six abilities is split into two authored sub-scores; when the rule is on
// the main score is their rounded average, so every existing table and derive
// step keeps reading the main score untouched (spec §2). A null sub-score is
// "not set yet" and falls back to the ability's authored main score, so
// enabling the rule never changes an existing character. All values here are
// this project's own design (content policy).
import type { OptionalRules } from "../options";
import type { AbilityKey } from "../types";

export type SubAbilityId =
  | "muscle" | "stamina"
  | "aim" | "balance"
  | "health" | "fitness"
  | "reason" | "knowledge"
  | "intuition" | "willpower"
  | "leadership" | "appearance";

export const SUB_ABILITIES: Readonly<Record<AbilityKey, readonly [SubAbilityId, SubAbilityId]>> = {
  str: ["muscle", "stamina"],
  dex: ["aim", "balance"],
  con: ["health", "fitness"],
  int: ["reason", "knowledge"],
  wis: ["intuition", "willpower"],
  cha: ["leadership", "appearance"],
};

const MIN_SCORE = 1;
const MAX_SCORE = 25;

function clampScore(n: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, n));
}

/**
 * THE one place the sub-ability gate is written (master AND-gate, spec §2).
 * prepareBaseData, the PC sheet's input builder and the seed action all call
 * this — never restate the expression.
 */
export function subAbilitiesEnabled(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "subAbilityScores">,
): boolean {
  return rules.skillsAndPowersEnabled && rules.subAbilityScores;
}

/** A null sub-score falls back to the ability's authored main score. */
export function effectiveSubScore(sub: number | null, mainScore: number): number {
  return sub ?? mainScore;
}

/**
 * The main score the rule derives: the rounded average of the two effective
 * sub-scores, clamped to [1, 25]. `Math.round` rounds a .5 average UP
 * (e.g. 14 and 15 -> 15). When BOTH sub-scores are null the authored main score
 * is returned UNCHANGED (not clamped), so enabling the rule never alters an
 * existing character, even one authored outside [1, 25].
 */
export function mainScoreFromSubs(a: number | null, b: number | null, mainScore: number): number {
  if (a === null && b === null) return mainScore;
  return clampScore(Math.round((effectiveSubScore(a, mainScore) + effectiveSubScore(b, mainScore)) / 2));
}

export interface SubScoreSource {
  /** the AUTHORED main score (`_source`), not the prepared/racially-adjusted one */
  score: number;
  sub?: { a: number | null; b: number | null } | null;
}

/**
 * The actor update that seeds every null sub-score from its ability's authored
 * main score (clamped to [1, 25]); never touches a non-null sub-score. Keys are
 * dot-paths relative to the actor document. Empty when nothing needs seeding.
 */
export function subScoreSeedUpdate(abilities: Record<AbilityKey, SubScoreSource>): Record<string, number> {
  const update: Record<string, number> = {};
  for (const key of Object.keys(SUB_ABILITIES) as AbilityKey[]) {
    const { score, sub } = abilities[key];
    for (const side of ["a", "b"] as const) {
      if ((sub?.[side] ?? null) === null) {
        update[`system.abilities.${key}.sub.${side}`] = clampScore(score);
      }
    }
  }
  return update;
}
