// Player's Option: Spells & Magic Chapter 6 (printed pp. 92-93, Sub-project 14
// remainder). Priest spell points replace the classic Table 24 slots when the
// spell-points rule is on. Pure.
import { assertAbilityScore, assertLevel, assertSpellLevel } from "../errors";
import { spellsMemorizedAtLevel } from "./spell-points";
import { ORISON_COST_SP } from "./priest-orisons";

const MAX_TABLE_LEVEL = 20;

export type TheurgyType = "fixed" | "free";
export type TheurgyScope = "major" | "minor" | "universal";

interface PriestSpellPointRow {
  maxSpellLevel: number;
  maxPerLevel: number;
  sp: number;
}

// prettier-ignore
const PRIEST_SPELL_POINT_PROGRESSION: readonly PriestSpellPointRow[] = [
  { maxSpellLevel: 1, maxPerLevel: 3,  sp: 4 },    // L1
  { maxSpellLevel: 1, maxPerLevel: 4,  sp: 8 },    // L2
  { maxSpellLevel: 2, maxPerLevel: 5,  sp: 15 },   // L3
  { maxSpellLevel: 2, maxPerLevel: 5,  sp: 25 },   // L4
  { maxSpellLevel: 3, maxPerLevel: 6,  sp: 40 },   // L5
  { maxSpellLevel: 3, maxPerLevel: 6,  sp: 55 },   // L6
  { maxSpellLevel: 4, maxPerLevel: 6,  sp: 70 },   // L7
  { maxSpellLevel: 4, maxPerLevel: 7,  sp: 90 },   // L8
  { maxSpellLevel: 5, maxPerLevel: 7,  sp: 125 },  // L9
  { maxSpellLevel: 5, maxPerLevel: 7,  sp: 160 },  // L10
  { maxSpellLevel: 6, maxPerLevel: 8,  sp: 200 },  // L11
  { maxSpellLevel: 6, maxPerLevel: 8,  sp: 240 },  // L12
  { maxSpellLevel: 6, maxPerLevel: 8,  sp: 290 },  // L13
  { maxSpellLevel: 7, maxPerLevel: 9,  sp: 340 },  // L14
  { maxSpellLevel: 7, maxPerLevel: 9,  sp: 400 },  // L15
  { maxSpellLevel: 7, maxPerLevel: 10, sp: 460 },  // L16
  { maxSpellLevel: 7, maxPerLevel: 10, sp: 530 },  // L17
  { maxSpellLevel: 7, maxPerLevel: 11, sp: 600 },  // L18
  { maxSpellLevel: 7, maxPerLevel: 11, sp: 675 },  // L19
  { maxSpellLevel: 7, maxPerLevel: 12, sp: 750 },  // L20
];

function priestRow(priestLevel: number): PriestSpellPointRow {
  assertLevel(priestLevel, "priestLevel");
  if (priestLevel <= MAX_TABLE_LEVEL) return PRIEST_SPELL_POINT_PROGRESSION[priestLevel - 1];
  // Table 26's "21+" row: +75 SP per level past 20; max spell level and per-level cap frozen.
  const l20 = PRIEST_SPELL_POINT_PROGRESSION[MAX_TABLE_LEVEL - 1];
  return { ...l20, sp: l20.sp + 75 * (priestLevel - MAX_TABLE_LEVEL) };
}

export function priestSpellPointBase(priestLevel: number): number {
  return priestRow(priestLevel).sp;
}

export function priestMaxSpellLevel(priestLevel: number): number {
  return priestRow(priestLevel).maxSpellLevel;
}

export function priestMaxPerLevel(priestLevel: number): number {
  return priestRow(priestLevel).maxPerLevel;
}

// prettier-ignore
// Table 27 rows by Wisdom 13..19; each row is the bonus for the character-level
// band 1-2 / 3-4 / 5-6 / 7+.
const WISDOM_BONUS_ROWS: Readonly<Record<number, readonly number[]>> = {
  13: [4, 4, 4, 4],
  14: [8, 8, 8, 8],
  15: [8, 15, 15, 15],
  16: [8, 20, 20, 20],
  17: [8, 20, 30, 30],
  18: [8, 20, 30, 45],
  19: [12, 25, 45, 60],
};

function bandIndex(priestLevel: number): number {
  if (priestLevel <= 2) return 0;
  if (priestLevel <= 4) return 1;
  if (priestLevel <= 6) return 2;
  return 3;
}

/** Table 27. Wisdom below 13 gives no bonus; Wisdom 20+ uses the Wisdom 19 row (spec decision). */
export function priestWisdomBonusSp(priestLevel: number, wisScore: number): number {
  assertLevel(priestLevel, "priestLevel");
  assertAbilityScore(wisScore, "wis");
  if (wisScore < 13) return 0;
  const row = WISDOM_BONUS_ROWS[Math.min(wisScore, 19)];
  return row[bandIndex(priestLevel)];
}

/** Table 26 SP + Table 27 Wisdom bonus, plus the Constitution hit-point
 *  adjustment. If the adjustment would drop the total below 4, it is ignored
 *  (book p. 93). */
export function priestSpellPointTotal(priestLevel: number, wisScore: number, conHpAdjustment: number): number {
  const base = priestSpellPointBase(priestLevel) + priestWisdomBonusSp(priestLevel, wisScore);
  const adjusted = base + conHpAdjustment;
  return adjusted < 4 ? base : adjusted;
}

// prettier-ignore
// Table 29, spell levels 1-7 (index 0 = 1st level). Minor fixed and universal
// free are one spell level higher than major (Table 28), per the book's
// minor-access rule; both columns are listed explicitly in the book.
const MAJOR_FIXED: readonly number[]     = [4, 6, 10, 15, 22, 30, 40];
const MAJOR_FREE: readonly number[]      = [8, 12, 20, 30, 44, 60, 80];
const MINOR_FIXED: readonly number[]     = [6, 10, 15, 22, 30, 40, 50];
const UNIVERSAL_FREE: readonly number[] = [12, 20, 30, 44, 60, 80, 100];

/** Table 29 cost of one theurgy. Fixed theurgies come only from major or minor
 *  access; free theurgies from major or universal only (minor access allows no
 *  free theurgy, per the book). */
export function priestTheurgyCost(spellLevel: number, magickType: TheurgyType, scope: TheurgyScope): number {
  assertSpellLevel(spellLevel);
  if (spellLevel > 7) throw new RangeError("priest theurgies stop at 7th level");
  const index = spellLevel - 1;
  if (magickType === "fixed" && scope === "major") return MAJOR_FIXED[index];
  if (magickType === "fixed" && scope === "minor") return MINOR_FIXED[index];
  if (magickType === "free" && scope === "major") return MAJOR_FREE[index];
  if (magickType === "free" && scope === "universal") return UNIVERSAL_FREE[index];
  throw new RangeError(`no theurgy cost for ${magickType} ${scope}`);
}

/** Channelled cost of one priest cast: a level-0 orison costs ORISON_COST_SP
 *  (Table 29 has no level-0 row); every other spell costs its Table 29 cost. */
export function priestChannellingCost(spellLevel: number, magickType: TheurgyType, scope: TheurgyScope): number {
  if (spellLevel === 0) return ORISON_COST_SP;
  return priestTheurgyCost(spellLevel, magickType, scope);
}

/** Whether a channelled priest's pool covers one cast's Table 29 cost. */
export function priestCanAffordCast(current: number, cost: number): boolean {
  return cost <= current;
}

/** The pool after one channelled cast of this Table 29 cost. */
export function priestSpendCast(current: number, cost: number): number {
  return current - cost;
}

/** Whether a memorized theurgy of this scope may be a free theurgy. */
export function priestScopeAllowsFree(scope: TheurgyScope): boolean {
  return scope === "major" || scope === "universal";
}

/** The priest pool fields a memorize check reads (the derived `spellPoints`
 *  record; every field optional because the ObjectField defaults to `{}`). */
export interface PriestPoolView {
  maxSpellLevel?: number;
  maxPerLevel?: number;
  remaining?: number;
}

/** Whether the priest pool can take one more theurgy of this type and scope at
 *  `spellLevel`: within Table 26's max spell level, under the flat per-level
 *  cap, and with `remaining` covering the Table 29 cost. Shared by the sheet's
 *  row/free-theurgy eligibility and memorize's re-check so they cannot drift. */
export function priestPoolAffords(
  pool: PriestPoolView,
  memorized: readonly { spellLevel: number }[],
  spellLevel: number,
  magickType: TheurgyType,
  scope: TheurgyScope,
): boolean {
  if (typeof pool.maxSpellLevel !== "number") return false;
  if (spellLevel > pool.maxSpellLevel) return false;
  if (spellsMemorizedAtLevel(memorized, spellLevel) >= (pool.maxPerLevel ?? 0)) return false;
  return (pool.remaining ?? 0) >= priestTheurgyCost(spellLevel, magickType, scope);
}
