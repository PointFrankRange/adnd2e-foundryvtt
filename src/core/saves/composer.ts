// Layers the racial / ability / situational modifiers onto the raw class-group
// saving-throw target from Plan 1b.2. See references/research-notes.md §"PLAN 1b.3".
import type { ClassGroup, Race, SaveCategory, SaveEffectTag } from "../types";
import { saveBaseTarget } from "./index";
import { racialSaveBonus } from "./racial";

export interface SaveTargetInput {
  group: ClassGroup;
  level: number;
  category: SaveCategory;
  race: Race;
  /** adjusted CON score (post racial adjustment) — for the Table 9 lookup */
  con: number;
  /** wisdom(wis).magicalDefenseAdj — already a roll bonus */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-style (negative = agile); negated here for the save */
  dexDefensiveAdj: number;
  tags?: readonly SaveEffectTag[];
  situationalModifier?: number;
}

export interface SaveTargetResult {
  /** raw d20 target from the class table */
  target: number;
  /** total bonus added to the d20 roll */
  rollModifier: number;
  /** target - rollModifier: what the die alone must show */
  effectiveTarget: number;
  breakdown: {
    base: number;
    racialConBonus: number;
    wisdomMagicalDefense: number;
    dexterityDefensive: number;
    situational: number;
  };
}

/**
 * The saving-throw target and its modifier breakdown. A save succeeds when
 * `d20Roll + result.rollModifier >= result.target`.
 */
export function saveTarget(input: SaveTargetInput): SaveTargetResult {
  const tags = input.tags ?? [];
  const base = saveBaseTarget(input.group, input.level, input.category);
  const racialConBonus = racialSaveBonus(input.race, input.category, input.con, tags);
  const wisdomMagicalDefense = tags.includes("mind-affecting") ? input.wisMagicalDefenseAdj : 0;
  const dexterityDefensive =
    tags.includes("dodgeable") || input.category === "bw" ? -input.dexDefensiveAdj : 0;
  const situational = input.situationalModifier ?? 0;

  const rollModifier = racialConBonus + wisdomMagicalDefense + dexterityDefensive + situational;
  return {
    target: base,
    rollModifier,
    effectiveTarget: base - rollModifier,
    breakdown: { base, racialConBonus, wisdomMagicalDefense, dexterityDefensive, situational },
  };
}
