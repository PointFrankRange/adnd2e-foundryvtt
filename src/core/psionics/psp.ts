import { assertLevel } from "../errors";
import { PROGRESSION_ROWS, type PowerProgressionRow } from "./tables";

/** Table 4 row for a level (levels above 20 reuse the level-20 row). */
export function powerProgression(level: number): PowerProgressionRow {
  assertLevel(level, "psionicist level");
  const [disciplines, sciences, devotions, defenseModes] = PROGRESSION_ROWS[Math.min(level, 20) - 1]!;
  return { disciplines, sciences, devotions, defenseModes };
}

/** Table 5 modifier (Wisdom, Intelligence and Constitution): 15 and below none, 16 +1, 17 +2, 18 and above +3. */
export function abilityModifier(score: number): number {
  if (score >= 18) return 3;
  if (score >= 17) return 2;
  if (score >= 16) return 1;
  return 0;
}

/** Table 5 base score for a Wisdom: 20 at 15 or below, then 22/24/26 (26 at 18 and above). */
export function wisdomBase(score: number): number {
  if (score >= 18) return 26;
  if (score >= 17) return 24;
  if (score >= 16) return 22;
  return 20;
}

/** The 1st-level PSP total: the Wisdom base plus the Intelligence and Constitution modifiers (p.13). */
export function inherentPotential(wis: number, int: number, con: number): number {
  return wisdomBase(wis) + abilityModifier(int) + abilityModifier(con);
}

/** Total PSPs at a level: the inherent potential, plus 10 + the Wisdom modifier for each level after the first (p.13). */
export function psionicStrength(wis: number, int: number, con: number, level: number): number {
  assertLevel(level, "psionicist level");
  return inherentPotential(wis, int, con) + (level - 1) * (10 + abilityModifier(wis));
}
