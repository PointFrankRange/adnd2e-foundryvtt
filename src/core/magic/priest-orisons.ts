// Player's Option: Spells & Magic Ch.6 (Orisons, printed p.93): an orison costs
// 1 spell point and is a free theurgy; a priest may memorize twice the maximum
// spells of one level. Pure.
import { priestMaxPerLevel } from "./priest-spell-points";

export const ORISON_COST_SP = 1;

/** Twice the Table 26 max spells per level for this priest level. */
export function orisonCap(priestLevel: number): number {
  return 2 * priestMaxPerLevel(priestLevel);
}

/** Whether one more orison fits under the cap and the pool still covers 1 SP. */
export function orisonAffords(remaining: number, memorizedOrisons: number, cap: number): boolean {
  return memorizedOrisons < cap && remaining >= ORISON_COST_SP;
}
