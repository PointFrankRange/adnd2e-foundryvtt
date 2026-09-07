// PHB Table 7 (racial ability min/max, p.20) + Table 8 (racial adjustments, p.20).
import type { AbilityKey, AbilityScores } from "../types";

export type Race = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling";

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

export function applyRacialAdjustments(raw: AbilityScores, race: Race): AbilityScores {
  const deltas = RACIAL_ABILITY_ADJUSTMENTS[race];
  const limits = RACIAL_ABILITY_LIMITS[race];
  const out = {} as AbilityScores;
  for (const k of KEYS) {
    const adjusted = raw[k] + (deltas[k] ?? 0);
    const [lo, hi] = limits[k];
    out[k] = Math.min(hi, Math.max(lo, adjusted));
  }
  return out;
}
