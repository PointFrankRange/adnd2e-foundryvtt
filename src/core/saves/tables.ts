// PHB Table 60: CHARACTER SAVING THROWS (p.101).
// Columns: ppd = Paralyzation/Poison/Death Magic, rsw = Rod/Staff/Wand,
// pp = Petrification/Polymorph, bw = Breath Weapon, spell = Spell.
// A band applies from minLevel up to (but not including) the next band's minLevel.
import type { ClassGroup } from "../types";

export interface SaveBand {
  minLevel: number;
  ppd: number;
  rsw: number;
  pp: number;
  bw: number;
  spell: number;
}

function band(minLevel: number, ppd: number, rsw: number, pp: number, bw: number, spell: number): SaveBand {
  return { minLevel, ppd, rsw, pp, bw, spell };
}

export const SAVE_MATRICES: Record<ClassGroup, readonly SaveBand[]> = {
  priest: [
    band(1, 10, 14, 13, 16, 15),
    band(4, 9, 13, 12, 15, 14),
    band(7, 7, 11, 10, 13, 12),
    band(10, 6, 10, 9, 12, 11),
    band(13, 5, 9, 8, 11, 10),
    band(16, 4, 8, 7, 10, 9),
    band(19, 2, 6, 5, 8, 7),
  ],
  rogue: [
    band(1, 13, 14, 12, 16, 15),
    band(5, 12, 12, 11, 15, 13),
    band(9, 11, 10, 10, 14, 11),
    band(13, 10, 8, 9, 13, 9),
    band(17, 9, 6, 8, 12, 7),
    band(21, 8, 4, 7, 11, 5),
  ],
  warrior: [
    band(0, 16, 18, 17, 20, 19),
    band(1, 14, 16, 15, 17, 17),
    band(3, 13, 15, 14, 16, 16),
    band(5, 11, 13, 12, 13, 14),
    band(7, 10, 12, 11, 12, 13),
    band(9, 8, 10, 9, 9, 11),
    band(11, 7, 9, 8, 8, 10),
    band(13, 5, 7, 6, 5, 8),
    band(15, 4, 6, 5, 4, 7),
    band(17, 3, 5, 4, 4, 6),
  ],
  wizard: [
    band(1, 14, 11, 13, 15, 12),
    band(6, 13, 9, 11, 13, 10),
    band(11, 11, 7, 9, 11, 8),
    band(16, 10, 5, 7, 9, 6),
    band(21, 8, 3, 5, 7, 4),
  ],
};
