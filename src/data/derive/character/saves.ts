import { saveTarget } from "../../../core/saves/composer";
import type { ClassGroup, Race, SaveCategory } from "../../../core/types";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

export interface SavesInput {
  group: ClassGroup;
  level: number;
  race: Race;
  /** adjusted CON score (for the racial Table 9 bonus) */
  con: number;
  /** wisdom(wis).magicalDefenseAdj */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-signed */
  dexDefensiveAdj: number;
}

/**
 * §5.6 step 7 — all five saving throws with the racial / ability layers.
 *
 * The cached `saves` block is the UNTAGGED baseline. `wisMagicalDefenseAdj` is
 * forwarded to `saveTarget` but only changes the result for `mind-affecting`
 * saves, which require a tag the cached call does not pass; the roll flow
 * re-derives with tags at cast time. So the displayed spell-save number is the
 * baseline, not necessarily what a mind-affecting save will roll against.
 */
export function deriveSaves(
  input: SavesInput,
): Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }> {
  const out = {} as Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }>;
  for (const category of CATEGORIES) {
    const r = saveTarget({
      group: input.group,
      level: input.level,
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
