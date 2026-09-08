// PHB Table 7 (racial ability min/max, p.20) + Table 8 (racial adjustments, p.20).
import type { AbilityKey, AbilityScores, Race } from "../types";

export const RACIAL_ABILITY_ADJUSTMENTS: Record<Race, Partial<Record<AbilityKey, number>>> = {
  human: {},
  "half-elf": {},
  dwarf: { con: 1, cha: -1 },
  elf: { dex: 1, con: -1 },
  gnome: { int: 1, wis: -1 },
  halfling: { dex: 1, str: -1 },
};

// [min, max] per ability. Human is 3/18 across the board.
export const RACIAL_ABILITY_LIMITS: Record<Race, Record<AbilityKey, [number, number]>> = {
  human: { str: [3, 18], dex: [3, 18], con: [3, 18], int: [3, 18], wis: [3, 18], cha: [3, 18] },
  dwarf: { str: [8, 18], dex: [3, 17], con: [11, 18], int: [3, 18], wis: [3, 18], cha: [3, 17] },
  elf: { str: [3, 18], dex: [6, 18], con: [7, 18], int: [8, 18], wis: [3, 18], cha: [8, 18] },
  gnome: { str: [6, 18], dex: [3, 18], con: [8, 18], int: [6, 18], wis: [3, 18], cha: [3, 18] },
  "half-elf": { str: [3, 18], dex: [6, 18], con: [6, 18], int: [4, 18], wis: [3, 18], cha: [3, 18] },
  halfling: { str: [7, 18], dex: [7, 18], con: [10, 18], int: [6, 18], wis: [3, 17], cha: [3, 18] },
};

const KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

// Adds the racial deltas but does NOT clamp — the delta is all that changes.
// Use this on every derive (magic items can push STR to 19-25; drain can drop scores).
export function applyRacialDeltas(raw: AbilityScores, race: Race): AbilityScores {
  const deltas = RACIAL_ABILITY_ADJUSTMENTS[race];
  const out = {} as AbilityScores;
  for (const k of KEYS) {
    out[k] = raw[k] + (deltas[k] ?? 0);
  }
  return out;
}

// Character-creation rule: adds the racial deltas AND clamps to Table 7 min/max.
export function applyRacialAdjustments(raw: AbilityScores, race: Race): AbilityScores {
  const limits = RACIAL_ABILITY_LIMITS[race];
  const deltaed = applyRacialDeltas(raw, race);
  const out = {} as AbilityScores;
  for (const k of KEYS) {
    const [lo, hi] = limits[k];
    out[k] = Math.min(hi, Math.max(lo, deltaed[k]));
  }
  return out;
}
