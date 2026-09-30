// Player's Option: Spells & Magic pp.78, 80 (Sub-project 14 Plan A): the wizard
// Spell Point system. Table 17 (Wizard Spell Point Progression) REPLACES
// wizardSpellSlots's role for a spell-points wizard — it supplies its own
// max-spell-level AND a FLAT max-spells-per-level cap (one number, the same
// for every accessible spell level; NOT Table 21's per-level-varying counts:
// "a 6th-level mage is limited to four spells of any given level, so he can
// memorize up to eight cantrips"). Table 18 (Spell Cost by Level) prices
// memorizing a spell as a fixed magick (one specific spell) or free magick
// (any known spell of that level, chosen at cast time — costs more). Table 19
// (Bonus Spell Points for Intelligence) is additive, mirroring the priest
// Wisdom bonus-spells table. Pure.
import { assertAbilityScore, assertLevel, assertSpellLevel } from "../errors";
import type { OptionalRules } from "../options";

const MAX_TABLE_LEVEL = 20;

/** THE one place the spell-points gate is written (master AND-gate). Every
 *  consumer — derive, the sheet, the memorize/cast glue — calls this; never
 *  restate the expression. */
export function spellPointsEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints">,
): boolean {
  return rules.spellsAndMagicEnabled && rules.spellPoints;
}

export type MagickType = "fixed" | "free";

interface WizardSpellPointRow {
  maxSpellLevel: number;
  maxPerLevel: number;
  specialistMaxPerLevel: number;
  sp: number;
  specialistBonusSp: number;
}

// prettier-ignore
const WIZARD_SPELL_POINT_PROGRESSION: readonly WizardSpellPointRow[] = [
  { maxSpellLevel: 1, maxPerLevel: 2, specialistMaxPerLevel: 3, sp: 4,   specialistBonusSp: 4 },   // L1
  { maxSpellLevel: 1, maxPerLevel: 2, specialistMaxPerLevel: 3, sp: 8,   specialistBonusSp: 4 },   // L2
  { maxSpellLevel: 2, maxPerLevel: 3, specialistMaxPerLevel: 4, sp: 15,  specialistBonusSp: 10 },  // L3
  { maxSpellLevel: 2, maxPerLevel: 4, specialistMaxPerLevel: 5, sp: 25,  specialistBonusSp: 10 },  // L4
  { maxSpellLevel: 3, maxPerLevel: 4, specialistMaxPerLevel: 6, sp: 40,  specialistBonusSp: 20 },  // L5
  { maxSpellLevel: 3, maxPerLevel: 4, specialistMaxPerLevel: 6, sp: 55,  specialistBonusSp: 20 },  // L6
  { maxSpellLevel: 4, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 70,  specialistBonusSp: 35 },  // L7
  { maxSpellLevel: 4, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 95,  specialistBonusSp: 35 },  // L8
  { maxSpellLevel: 5, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 120, specialistBonusSp: 60 },  // L9
  { maxSpellLevel: 5, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 150, specialistBonusSp: 60 },  // L10
  { maxSpellLevel: 5, maxPerLevel: 5, specialistMaxPerLevel: 7, sp: 200, specialistBonusSp: 60 },  // L11
  { maxSpellLevel: 6, maxPerLevel: 5, specialistMaxPerLevel: 7, sp: 250, specialistBonusSp: 90 },  // L12
  { maxSpellLevel: 6, maxPerLevel: 6, specialistMaxPerLevel: 7, sp: 300, specialistBonusSp: 90 },  // L13
  { maxSpellLevel: 7, maxPerLevel: 6, specialistMaxPerLevel: 7, sp: 350, specialistBonusSp: 130 }, // L14
  { maxSpellLevel: 7, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 400, specialistBonusSp: 130 }, // L15
  { maxSpellLevel: 8, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 475, specialistBonusSp: 180 }, // L16
  { maxSpellLevel: 8, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 550, specialistBonusSp: 180 }, // L17
  { maxSpellLevel: 9, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 625, specialistBonusSp: 240 }, // L18
  { maxSpellLevel: 9, maxPerLevel: 7, specialistMaxPerLevel: 9, sp: 700, specialistBonusSp: 240 }, // L19
  { maxSpellLevel: 9, maxPerLevel: 7, specialistMaxPerLevel: 9, sp: 800, specialistBonusSp: 240 }, // L20
];

function wizardRow(wizardLevel: number): WizardSpellPointRow {
  assertLevel(wizardLevel, "wizardLevel");
  if (wizardLevel <= MAX_TABLE_LEVEL) return WIZARD_SPELL_POINT_PROGRESSION[wizardLevel - 1];
  // Table 17's own "21+" row: +100 SP/level past 20, no further specialist SP
  // bonus, max spell level and the flat per-level cap frozen at the L20 row.
  const l20 = WIZARD_SPELL_POINT_PROGRESSION[MAX_TABLE_LEVEL - 1];
  return { ...l20, sp: l20.sp + 100 * (wizardLevel - MAX_TABLE_LEVEL), specialistBonusSp: 0 };
}

/** Table 17's own max-spell-level column, BEFORE the caller intersects it
 *  with the Intelligence-based cap (`abilities.int.maxSpellLevel`) — see
 *  `deriveSpellPoints`. */
export function wizardMaxSpellLevel(wizardLevel: number): number {
  return wizardRow(wizardLevel).maxSpellLevel;
}

/** Table 17's flat per-level memorized-spell cap — the SAME number for every
 *  spell level the wizard can access (not Table 21's per-level-varying counts). */
export function wizardMaxPerLevel(wizardLevel: number, specialist: boolean): number {
  const row = wizardRow(wizardLevel);
  return specialist ? row.specialistMaxPerLevel : row.maxPerLevel;
}

// prettier-ignore
const BONUS_SP_BY_INTELLIGENCE: readonly { min: number; bonus: number }[] = [
  { min: 20, bonus: 9 },
  { min: 19, bonus: 8 },
  { min: 18, bonus: 7 },
  { min: 17, bonus: 6 },
  { min: 16, bonus: 5 },
  { min: 14, bonus: 4 },
  { min: 12, bonus: 3 },
  { min: 9,  bonus: 2 },
];

/** Table 19: Bonus Spell Points for Intelligence — 0 below score 9. */
function bonusSpForIntelligence(intScore: number): number {
  return BONUS_SP_BY_INTELLIGENCE.find((row) => intScore >= row.min)?.bonus ?? 0;
}

/** Table 17 SP (+ specialist bonus, zero past level 20) + Table 19 Intelligence bonus. */
export function wizardSpellPointTotal(wizardLevel: number, intScore: number, specialist: boolean): number {
  assertAbilityScore(intScore, "int");
  const row = wizardRow(wizardLevel);
  const specialistBonus = specialist ? row.specialistBonusSp : 0;
  return row.sp + specialistBonus + bonusSpForIntelligence(intScore);
}

// prettier-ignore
const MAGICK_COST_BY_SPELL_LEVEL: Readonly<Record<number, { fixed: number; free: number }>> = {
  1: { fixed: 4,  free: 8 },
  2: { fixed: 6,  free: 12 },
  3: { fixed: 10, free: 20 },
  4: { fixed: 15, free: 30 },
  5: { fixed: 22, free: 44 },
  6: { fixed: 30, free: 60 },
  7: { fixed: 40, free: 80 },
  8: { fixed: 50, free: 100 },
  9: { fixed: 60, free: 120 },
};

/** Table 18: Spell Cost by Level (Wizard). Cantrips (level 0) are out of scope (spec §7). */
export function magickCost(spellLevel: number, magickType: MagickType): number {
  assertSpellLevel(spellLevel);
  return MAGICK_COST_BY_SPELL_LEVEL[spellLevel][magickType];
}

interface MemorizedForCost {
  spellLevel: number;
  magickType?: MagickType;
}

/** Total SP currently committed to memorized entries — counts an expended
 *  entry the same as a fresh one (mirrors `slots.ts`'s `toRecord`: occupancy
 *  doesn't change until Rest). An entry with no `magickType` (authored before
 *  this rule was ever on) is treated as fixed. */
export function spellPointsSpent(memorized: readonly MemorizedForCost[]): number {
  return memorized.reduce((sum, m) => sum + magickCost(m.spellLevel, m.magickType ?? "fixed"), 0);
}

/** How many currently-held entries occupy a given spell level — checked
 *  against `wizardMaxPerLevel`'s flat cap instead of Table 21's `SlotRecord`. */
export function spellsMemorizedAtLevel(memorized: readonly { spellLevel: number }[], spellLevel: number): number {
  return memorized.filter((m) => m.spellLevel === spellLevel).length;
}

export function canAffordMemorize(
  totalSp: number, spentSp: number, spellLevel: number, magickType: MagickType,
): boolean {
  return spentSp + magickCost(spellLevel, magickType) <= totalSp;
}
