/* SP12 Plan A: subrace layers over a base PHB race. Pure; Foundry-free.
 * A subrace is a `race` item whose `raceId` stays the base race and whose
 * `subrace` block overrides racial tables; null = inherit the base table. */
import type { AbilityKey, AbilityScores, Race, ThiefSkill } from "../types";
import { RACIAL_ABILITY_ADJUSTMENTS, RACIAL_ABILITY_LIMITS } from "../abilities/racial-adjustments";
import { THIEF_RACIAL_ADJUSTMENTS, THIEF_SKILLS } from "../proficiencies/thief-skills";

export type AbilityAdjustments = Partial<Record<AbilityKey, number>>;
export type AbilityRanges = Record<AbilityKey, [number, number]>;
export type ThiefAdjustments = Readonly<Record<ThiefSkill, number>>;

export interface SubraceLayer {
  /** blank = no subrace */
  id: string;
  abilityAdjustments: AbilityAdjustments | null;
  abilityRanges: AbilityRanges | null;
  thiefAdjustments: ThiefAdjustments | null;
  /** added to the Constitution save bonus only where the base race already gets it */
  conSaveBonusAdjustment: number;
  /** additional XP cost per level, percent (+10 = 10% more) */
  xpModifierPercent: number;
}

export const NO_SUBRACE: SubraceLayer = Object.freeze({
  id: "",
  abilityAdjustments: null,
  abilityRanges: null,
  thiefAdjustments: null,
  conSaveBonusAdjustment: 0,
  xpModifierPercent: 0,
}) as SubraceLayer;

export interface RawSubrace {
  id?: unknown;
  abilityAdjustments?: unknown;
  abilityRanges?: unknown;
  thiefAdjustments?: unknown;
  conSaveBonusAdjustment?: unknown;
  xpModifierPercent?: unknown;
}

const ABILITIES: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

function normalizeAdjustments(raw: unknown): AbilityAdjustments | null {
  if (!raw || typeof raw !== "object") return null;
  const out: AbilityAdjustments = {};
  for (const k of ABILITIES) {
    const v = (raw as Record<string, unknown>)[k];
    if (isInt(v) && v !== 0) out[k] = v;
  }
  return out;
}

function normalizeRanges(raw: unknown): AbilityRanges | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as AbilityRanges;
  for (const k of ABILITIES) {
    const r = (raw as Record<string, { min?: unknown; max?: unknown } | undefined>)[k];
    if (!r || !isInt(r.min) || !isInt(r.max)) return null;
    out[k] = [r.min, r.max];
  }
  return out;
}

function normalizeThief(raw: unknown): ThiefAdjustments | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as Record<ThiefSkill, number>;
  for (const s of THIEF_SKILLS) {
    const v = (raw as Record<string, unknown>)[s];
    if (!isInt(v)) return null;
    out[s] = v;
  }
  return out;
}

/** Lenient read: anything malformed falls back to "inherit"/0. Zero adjustments are dropped, so `{con:2,cha:-2}` round-trips from the six-integer schema form. */
export function normalizeSubrace(raw: RawSubrace | null | undefined): SubraceLayer {
  return {
    id: typeof raw?.id === "string" ? raw.id : "",
    abilityAdjustments: normalizeAdjustments(raw?.abilityAdjustments),
    abilityRanges: normalizeRanges(raw?.abilityRanges),
    thiefAdjustments: normalizeThief(raw?.thiefAdjustments),
    conSaveBonusAdjustment: isInt(raw?.conSaveBonusAdjustment) ? raw.conSaveBonusAdjustment : 0,
    xpModifierPercent: isInt(raw?.xpModifierPercent) ? raw.xpModifierPercent : 0,
  };
}

export function effectiveAbilityAdjustments(race: Race, layer: SubraceLayer | null | undefined): AbilityAdjustments {
  return layer?.abilityAdjustments ?? RACIAL_ABILITY_ADJUSTMENTS[race];
}

export function effectiveAbilityRanges(race: Race, layer: SubraceLayer | null | undefined): AbilityRanges {
  return layer?.abilityRanges ?? RACIAL_ABILITY_LIMITS[race];
}

export function effectiveThiefAdjustments(race: Race, layer: SubraceLayer | null | undefined): ThiefAdjustments {
  return layer?.thiefAdjustments ?? THIEF_RACIAL_ADJUSTMENTS[race];
}

/** The abilities whose score falls outside its [min, max] (inclusive). */
export function abilityRangeProblems(scores: AbilityScores, ranges: AbilityRanges): AbilityKey[] {
  return ABILITIES.filter((k) => scores[k] < ranges[k][0] || scores[k] > ranges[k][1]);
}

/** A kit's XP percentage plus the subrace's: surcharges add. */
export function combineXpPercent(kitPercent: number, racePercent: number): number {
  return kitPercent + racePercent;
}
