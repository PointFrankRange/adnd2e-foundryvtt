// PHB Table 9: CONSTITUTION SAVING THROW BONUSES (p.21) + racial magic/poison save
// rules from the Dwarf (p.21), Gnome (p.22), Halfling (p.23), Elf (p.21),
// Half-Elf (p.22) descriptions.
import { assertAbilityScore } from "../errors";
import type { Race, SaveCategory, SaveEffectTag } from "../types";

/** PHB Table 9. [upper bound of CON band, bonus]; last entry catches CON >= 18. */
const CON_SAVE_BANDS: ReadonlyArray<readonly [number, number]> = [
  [3, 0],
  [6, 1],
  [10, 2],
  [13, 3],
  [17, 4],
  [Infinity, 5],
];

/** PHB Table 9 Constitution saving-throw bonus. Only demihumans use it — see racialSaveBonus. */
export function racialConSaveBonus(con: number): number {
  assertAbilityScore(con, "con");
  return CON_SAVE_BANDS.find(([max]) => con <= max)![1];
}

// Categories that get the racial CON bonus, by race.
// "poison" here means "ppd only when the effect is poison-tagged".
const RACIAL_SAVE_CATEGORIES: Record<Race, ReadonlySet<SaveCategory | "poison">> = {
  dwarf: new Set<SaveCategory | "poison">(["rsw", "spell", "poison"]),
  halfling: new Set<SaveCategory | "poison">(["rsw", "spell", "poison"]),
  gnome: new Set<SaveCategory | "poison">(["rsw", "spell"]),
  elf: new Set<SaveCategory | "poison">(),
  "half-elf": new Set<SaveCategory | "poison">(),
  human: new Set<SaveCategory | "poison">(),
};

/**
 * The PHB Table 9 bonus this race gets on a saving throw of this category, or 0
 * if the race does not qualify. Dwarves/halflings: rod-staff-wand, spell, and
 * poison (a `ppd` save tagged "poison"). Gnomes: rod-staff-wand and spell only.
 */
export function racialSaveBonus(
  race: Race,
  category: SaveCategory,
  con: number,
  tags: readonly SaveEffectTag[] = [],
): number {
  assertAbilityScore(con, "con");
  const applicable = RACIAL_SAVE_CATEGORIES[race];
  const matches =
    applicable.has(category) ||
    (category === "ppd" && tags.includes("poison") && applicable.has("poison"));
  return matches ? racialConSaveBonus(con) : 0;
}

/**
 * Percentage chance to ignore a *sleep* or *charm* effect entirely (elf 90,
 * half-elf 30, others 0). Roll d100 BEFORE the saving throw; on `roll <= result`
 * the effect is negated and no save is made. This is NOT a d20 modifier — never
 * add it to a saveTarget rollModifier.
 */
export function sleepCharmResistance(race: Race): number {
  if (race === "elf") return 90;
  if (race === "half-elf") return 30;
  return 0;
}
