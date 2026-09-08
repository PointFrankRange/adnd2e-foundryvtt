// PHB Ch.3 pp.38-40: thief skill base scores (Table 26), racial (Table 27),
// Dexterity (Table 28) and armor (Table 29) adjustments; the point budget;
// backstab multipliers (Table 30); and the pick-pockets detection threshold.
import { assertAbilityScore, assertLevel } from "../errors";
import type { BardSkill, Race, ThiefArmor, ThiefSkill } from "../types";

export const THIEF_SKILLS: readonly ThiefSkill[] = [
  "pick-pockets",
  "open-locks",
  "find-remove-traps",
  "move-silently",
  "hide-in-shadows",
  "detect-noise",
  "climb-walls",
  "read-languages",
];

// NOTE: a thief's "read-languages" score is computable at any level, but the
// skill cannot be USED until thief level 4 (PHB p.40) — that gate is a caller
// concern, not modelled here.

/** PHB Table 26: THIEVING SKILL BASE SCORES (p.39). */
// prettier-ignore
export const THIEF_SKILL_BASE: Readonly<Record<ThiefSkill, number>> = {
  "pick-pockets": 15, "open-locks": 10, "find-remove-traps": 5, "move-silently": 10,
  "hide-in-shadows": 5, "detect-noise": 15, "climb-walls": 60, "read-languages": 0,
};

/** Build a full per-skill row in Table 26 order (used for Tables 27 and 29). */
function skillRow(
  pp: number,
  ol: number,
  frt: number,
  ms: number,
  his: number,
  dn: number,
  cw: number,
  rl: number,
): Readonly<Record<ThiefSkill, number>> {
  return {
    "pick-pockets": pp,
    "open-locks": ol,
    "find-remove-traps": frt,
    "move-silently": ms,
    "hide-in-shadows": his,
    "detect-noise": dn,
    "climb-walls": cw,
    "read-languages": rl,
  };
}

/** PHB Table 27: THIEVING SKILL RACIAL ADJUSTMENTS (p.39). Human is all zero. */
// prettier-ignore
export const THIEF_RACIAL_ADJUSTMENTS: Readonly<Record<Race, Readonly<Record<ThiefSkill, number>>>> = {
  human:      skillRow(0, 0, 0, 0, 0, 0, 0, 0),
  dwarf:      skillRow(0, 10, 15, 0, 0, 0, -10, -5),
  elf:        skillRow(5, -5, 0, 5, 10, 5, 0, 0),
  gnome:      skillRow(0, 5, 10, 5, 5, 10, -15, 0),
  "half-elf": skillRow(10, 0, 0, 0, 5, 0, 0, 0),
  halfling:   skillRow(5, 5, 5, 10, 15, 5, -15, -5),
};

/**
 * PHB Table 28: THIEVING SKILL DEXTERITY ADJUSTMENTS (p.39). Keyed by Dexterity
 * 9-19; only the five affected skills appear. Rows for DEX 13-15 are empty (all
 * adjustments zero).
 */
// prettier-ignore
export const THIEF_DEXTERITY_ADJUSTMENTS: Readonly<
  Record<number, Partial<Record<ThiefSkill, number>>>
> = {
  9:  { "pick-pockets": -15, "open-locks": -10, "find-remove-traps": -10, "move-silently": -20, "hide-in-shadows": -10 },
  10: { "pick-pockets": -10, "open-locks": -5,  "find-remove-traps": -10, "move-silently": -15, "hide-in-shadows": -5 },
  11: { "pick-pockets": -5,  "open-locks": 0,   "find-remove-traps": -5,  "move-silently": -10, "hide-in-shadows": 0 },
  12: { "pick-pockets": 0,   "open-locks": 0,   "find-remove-traps": 0,   "move-silently": -5,  "hide-in-shadows": 0 },
  13: {},
  14: {},
  15: {},
  16: { "pick-pockets": 0,   "open-locks": 5,   "find-remove-traps": 0,   "move-silently": 0,   "hide-in-shadows": 0 },
  17: { "pick-pockets": 5,   "open-locks": 10,  "find-remove-traps": 0,   "move-silently": 5,   "hide-in-shadows": 5 },
  18: { "pick-pockets": 10,  "open-locks": 15,  "find-remove-traps": 5,   "move-silently": 10,  "hide-in-shadows": 10 },
  19: { "pick-pockets": 15,  "open-locks": 20,  "find-remove-traps": 10,  "move-silently": 15,  "hide-in-shadows": 15 },
};

/** PHB Table 29: THIEVING SKILL ARMOR ADJUSTMENTS (p.39). "leather" is the thief default — all zero. */
// prettier-ignore
export const THIEF_ARMOR_ADJUSTMENTS: Readonly<Record<ThiefArmor, Readonly<Record<ThiefSkill, number>>>> = {
  none:              skillRow(5, 0, 0, 10, 5, 0, 10, 0),
  leather:           skillRow(0, 0, 0, 0, 0, 0, 0, 0),
  "elven-chain":     skillRow(-20, -5, -5, -10, -10, -5, -20, 0),
  "padded-studded":  skillRow(-30, -10, -10, -20, -20, -10, -30, 0),
};

export const THIEF_SKILL_POINT_RULES = {
  level1Points: 60,
  pointsPerLevelAfter: 30,
  level1PerSkillCap: 30,
  perLevelPerSkillCap: 15,
  hardCap: 95,
} as const;

const DEX_ADJ_MIN = 9;
const DEX_ADJ_MAX = 19;

/** Cumulative discretionary skill points a thief has by `level` (PHB p.38). */
export function thiefSkillPointsAvailable(level: number): number {
  assertLevel(level, "thief level");
  return (
    THIEF_SKILL_POINT_RULES.level1Points + (level - 1) * THIEF_SKILL_POINT_RULES.pointsPerLevelAfter
  );
}

export interface ThiefSkillContext {
  race: Race;
  dexterity: number;
  armor: ThiefArmor;
}

/** Table 26 + Table 27 + Table 28 + Table 29. May be negative; no cap applied here. */
export function thiefSkillBaseScore(skill: ThiefSkill, input: ThiefSkillContext): number {
  assertAbilityScore(input.dexterity, "dex");
  const dexKey = Math.min(DEX_ADJ_MAX, Math.max(DEX_ADJ_MIN, input.dexterity));
  const dexAdj = THIEF_DEXTERITY_ADJUSTMENTS[dexKey][skill] ?? 0;
  return (
    THIEF_SKILL_BASE[skill] +
    THIEF_RACIAL_ADJUSTMENTS[input.race][skill] +
    dexAdj +
    THIEF_ARMOR_ADJUSTMENTS[input.armor][skill]
  );
}

/** The thief's effective skill percentage: base score + allocated points, capped at 95. */
export function resolveThiefSkill(
  skill: ThiefSkill,
  input: ThiefSkillContext & { allocatedPoints: number },
): number {
  return Math.min(
    THIEF_SKILL_POINT_RULES.hardCap,
    thiefSkillBaseScore(skill, input) + input.allocatedPoints,
  );
}

/** PHB Table 30: BACKSTAB DAMAGE MULTIPLIERS (p.40). */
export function backstabMultiplier(thiefLevel: number): number {
  assertLevel(thiefLevel, "thief level");
  if (thiefLevel <= 4) return 2;
  if (thiefLevel <= 8) return 3;
  if (thiefLevel <= 12) return 4;
  return 5;
}

/**
 * The pick-pockets roll at or above which the victim notices the attempt
 * (PHB p.39). With `options`, a thief of higher level than the victim is
 * harder to notice by the level difference.
 */
export function pickPocketsDetectionThreshold(
  victimLevel: number,
  options?: { thiefLevel: number },
): number {
  if (!Number.isInteger(victimLevel) || victimLevel < 0) {
    throw new RangeError(`victim level must be an integer >= 0, got ${victimLevel}`);
  }
  if (options) {
    assertLevel(options.thiefLevel, "thief level");
  }
  let threshold = 100 - 3 * victimLevel;
  if (options && options.thiefLevel > victimLevel) {
    threshold += options.thiefLevel - victimLevel;
  }
  return threshold;
}

/** PHB Table 33: BARD THIEVING SKILL BASE SCORES (p.42). */
export const BARD_SKILL_BASE: Readonly<Record<BardSkill, number>> = {
  "pick-pockets": 10,
  "detect-noise": 20,
  "climb-walls": 50,
  "read-languages": 5,
};

export const BARD_SKILL_POINT_RULES = {
  level1Points: 20,
  pointsPerLevelAfter: 15,
  hardCap: 95,
} as const;

/** Cumulative discretionary skill points a bard has by `level` (PHB p.42). */
export function bardSkillPointsAvailable(level: number): number {
  assertLevel(level, "bard level");
  return (
    BARD_SKILL_POINT_RULES.level1Points +
    (level - 1) * BARD_SKILL_POINT_RULES.pointsPerLevelAfter
  );
}

/**
 * A bard's thieving-skill base score: Table 33 base + the thief racial
 * (Table 27), Dexterity (Table 28) and armor (Table 29) adjustments.
 * May be negative; no cap applied here.
 */
export function bardSkillBaseScore(skill: BardSkill, input: ThiefSkillContext): number {
  assertAbilityScore(input.dexterity, "dex");
  const dexKey = Math.min(DEX_ADJ_MAX, Math.max(DEX_ADJ_MIN, input.dexterity));
  const dexAdj = THIEF_DEXTERITY_ADJUSTMENTS[dexKey][skill] ?? 0;
  return (
    BARD_SKILL_BASE[skill] +
    THIEF_RACIAL_ADJUSTMENTS[input.race][skill] +
    dexAdj +
    THIEF_ARMOR_ADJUSTMENTS[input.armor][skill]
  );
}
