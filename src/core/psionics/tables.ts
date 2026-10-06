/* The Complete Psionics Handbook (PHBR5) Table 4 (p.12), read from the page image. Foundry-free. */
export const DISCIPLINES = ["clairsentience", "psychokinesis", "psychometabolism", "psychoportation", "telepathy", "metapsionics"] as const;
export type Discipline = (typeof DISCIPLINES)[number];
export type PowerKind = "science" | "devotion" | "defense";

export interface PowerProgressionRow {
  disciplines: number;
  sciences: number;
  devotions: number;
  defenseModes: number;
}

// prettier-ignore
const ROWS: readonly (readonly [number, number, number, number])[] = [
  [1, 1, 3, 1], [2, 1, 5, 1], [2, 2, 7, 2], [2, 2, 9, 2], [2, 3, 10, 3],
  [3, 3, 11, 3], [3, 4, 12, 4], [3, 4, 13, 4], [3, 5, 14, 5], [4, 5, 15, 5],
  [4, 6, 16, 5], [4, 6, 17, 5], [4, 7, 18, 5], [5, 7, 19, 5], [5, 8, 20, 5],
  [5, 8, 21, 5], [5, 9, 22, 5], [6, 9, 23, 5], [6, 10, 24, 5], [6, 10, 25, 5],
];

export const PROGRESSION_ROWS = ROWS;
