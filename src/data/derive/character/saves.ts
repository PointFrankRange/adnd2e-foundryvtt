import { saveTargetBest } from "../../../core/saves/composer";
import type { GroupLevel, Race, SaveCategory } from "../../../core/types";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

export interface SavesInput {
  /** one entry for a single class; several for multi-class / dual-class best-of */
  groups: readonly GroupLevel[];
  race: Race;
  /** adjusted CON score (for the racial Table 9 bonus) */
  con: number;
  /** wisdom(wis).magicalDefenseAdj */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-signed */
  dexDefensiveAdj: number;
}

/**
 * §5.6 step 7 — all five saving throws, taking the best base among `groups` per
 * category. The cached block is the UNTAGGED baseline: `wisMagicalDefenseAdj`
 * only moves `mind-affecting` saves, which need a tag the roll flow adds later.
 */
export function deriveSaves(
  input: SavesInput,
): Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }> {
  const out = {} as Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }>;
  for (const category of CATEGORIES) {
    const r = saveTargetBest({
      groups: input.groups,
      category,
      race: input.race,
      con: input.con,
      wisMagicalDefenseAdj: input.wisMagicalDefenseAdj,
      dexDefensiveAdj: input.dexDefensiveAdj,
    });
    out[category] = { target: r.target, rollModifier: r.rollModifier, effectiveTarget: r.effectiveTarget };
  }
  return out;
}
