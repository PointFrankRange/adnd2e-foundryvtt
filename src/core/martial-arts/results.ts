// PHBR15 Table 16: martial arts results (replaces the Complete Fighter's Handbook table). Pure.
import { assertD20 } from "../errors";

export const BLOW_IDS = [
  "headKick", "headPunch", "vitalsKick", "vitalsPunch", "highKick", "sideKick", "bodyPunch", "lowKick", "graze",
] as const;
export type BlowId = (typeof BLOW_IDS)[number];

/** Highest threshold first; a roll takes the first row whose `min` it reaches. */
const TABLE_16: readonly { min: number; blow: BlowId; damage: number }[] = [
  { min: 19, blow: "headKick", damage: 4 },
  { min: 17, blow: "headPunch", damage: 3 },
  { min: 15, blow: "vitalsKick", damage: 3 },
  { min: 13, blow: "vitalsPunch", damage: 2 },
  { min: 11, blow: "highKick", damage: 2 },
  { min: 9, blow: "sideKick", damage: 2 },
  { min: 6, blow: "bodyPunch", damage: 1 },
  { min: 3, blow: "lowKick", damage: 1 },
  { min: 1, blow: "graze", damage: 0 },
];

/** The blow and its damage for the UNMODIFIED d20 of a successful attack. */
export function martialArtsResult(naturalD20: number): { blow: BlowId; damage: number } {
  assertD20(naturalD20);
  const row = TABLE_16.find((r) => naturalD20 >= r.min)!;
  return { blow: row.blow, damage: row.damage };
}
