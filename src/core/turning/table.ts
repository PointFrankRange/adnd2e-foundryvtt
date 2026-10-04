/* PHB Table 61: Turning Undead (printed p. 103). Columns are priest level
 * 1, 2, 3, 4, 5, 6, 7, 8, 9, 10-11, 12-13, 14+. A number is a d20 target,
 * "T" turned, "D" destroyed, "D*" destroyed plus an additional 2d4 creatures
 * of the type, null (a dash) cannot turn that type. */

export const TURN_ROW_IDS = [
  "skeleton", "zombie", "ghoul", "shadow", "wight", "ghast", "wraith",
  "mummy", "spectre", "vampire", "ghost", "lich", "special",
] as const;
export type TurnRowId = (typeof TURN_ROW_IDS)[number];

export type TurnCell = number | "T" | "D" | "D*" | null;

export const TURN_TABLE: Readonly<Record<TurnRowId, readonly TurnCell[]>> = {
  skeleton: [10, 7, 4, "T", "T", "D", "D", "D*", "D*", "D*", "D*", "D*"],
  zombie: [13, 10, 7, 4, "T", "T", "D", "D", "D*", "D*", "D*", "D*"],
  ghoul: [16, 13, 10, 7, 4, "T", "T", "D", "D", "D*", "D*", "D*"],
  shadow: [19, 16, 13, 10, 7, 4, "T", "T", "D", "D", "D*", "D*"],
  wight: [20, 19, 16, 13, 10, 7, 4, "T", "T", "D", "D", "D*"],
  ghast: [null, 20, 19, 16, 13, 10, 7, 4, "T", "T", "D", "D"],
  wraith: [null, null, 20, 19, 16, 13, 10, 7, 4, "T", "T", "D"],
  mummy: [null, null, null, 20, 19, 16, 13, 10, 7, 4, "T", "T"],
  spectre: [null, null, null, null, 20, 19, 16, 13, 10, 7, 4, "T"],
  vampire: [null, null, null, null, null, 20, 19, 16, 13, 10, 7, 4],
  ghost: [null, null, null, null, null, null, 20, 19, 16, 13, 10, 7],
  lich: [null, null, null, null, null, null, null, 20, 19, 16, 13, 10],
  special: [null, null, null, null, null, null, null, null, 20, 19, 16, 13],
};

/** The table column for a priest level (0-11), or -1 for a level below 1. Levels 14+ share the last column. */
export function levelColumn(level: number): number {
  if (level < 1) return -1;
  if (level <= 9) return level - 1;
  if (level <= 11) return 9;
  if (level <= 13) return 10;
  return 11;
}
