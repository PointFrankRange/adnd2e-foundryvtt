// PHB Table 18: RANGER ABILITIES (p.28) — the Hide in Shadows / Move Silently
// columns. Base percentages, usable only in natural terrain and in studded
// leather or lighter armour; the caller applies the race / Dexterity / armour
// adjustments (Plan 1b.6 thief tables) and halves the result in non-natural
// surroundings (PHB p.29).
import { assertLevel } from "../errors";

const TABLE_MAX_LEVEL = 16;

/** [hideInShadows, moveSilently] percent, index 0 = ranger level 1. */
// prettier-ignore
export const RANGER_STEALTH: readonly (readonly [number, number])[] = [
  [10, 15], [15, 21], [20, 27], [25, 33], [31, 40], [37, 47], [43, 55], [49, 62],
  [56, 70], [63, 78], [70, 86], [77, 94], [85, 99], [93, 99], [99, 99], [99, 99],
];

export interface RangerStealth {
  hideInShadows: number;
  moveSilently: number;
}

export function rangerStealth(rangerLevel: number): RangerStealth {
  assertLevel(rangerLevel, "rangerLevel");
  const [hideInShadows, moveSilently] = RANGER_STEALTH[
    Math.min(rangerLevel, TABLE_MAX_LEVEL) - 1
  ];
  return { hideInShadows, moveSilently };
}
