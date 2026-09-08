import { assertLevel } from "../errors";
import type { ClassGroup, SaveCategory } from "../types";
import { SAVE_MATRICES, type SaveBand } from "./tables";

export { SAVE_MATRICES };
export type { SaveBand };

/**
 * Raw d20 target for a saving throw (roll >= target succeeds), before any
 * ability / racial / item modifiers. Those are applied by the saves() composer
 * in a later plan.
 */
export function saveBaseTarget(group: ClassGroup, level: number, category: SaveCategory): number {
  assertLevel(level, "class level");
  const bands = SAVE_MATRICES[group];
  let chosen: SaveBand = bands[0];
  for (const b of bands) {
    if (b.minLevel <= level) {
      chosen = b;
    } else {
      break;
    }
  }
  return chosen[category];
}
