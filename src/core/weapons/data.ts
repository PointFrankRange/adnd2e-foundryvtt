// The WeaponData shape consumed by the combat engine. The ~70 concrete PHB
// weapons ship as compendium / importer data in Plan 1c, not here.

export type WeaponSize = "S" | "M" | "L";

export type DamageType =
  | "slashing"
  | "piercing"
  | "bludgeoning"
  | "piercing-slashing"
  | "piercing-bludgeoning";

export type WeaponCategory = "melee" | "thrown" | "bow" | "crossbow";

/** How a weapon is being used for a given attack (governs Strength / Dexterity). */
export type AttackMode = "melee" | "thrown" | "fired";

export interface WeaponRange {
  short: number;
  medium: number;
  long: number;
}

export interface WeaponData {
  name: string;
  category: WeaponCategory;
  /** damage dice vs. Small/Medium targets, e.g. "1d8" */
  damageVsSM: string;
  /** damage dice vs. Large targets, e.g. "2d6" */
  damageVsL: string;
  damageType: DamageType;
  speedFactor: number;
  /** pounds */
  weight: number;
  size: WeaponSize;
  /** rate of fire, e.g. "1", "2", "3/2"; null for weapons with no RoF */
  rateOfFire: string | null;
  /** range increments in the game's distance unit; null for pure melee weapons */
  range: WeaponRange | null;
  proficiencyGroup: string;
  handsRequired: 1 | 2;
}

/** The damage-dice string for a target of the given size (PHB weapon table columns). */
export function selectDamageDice(
  weapon: Pick<WeaponData, "damageVsSM" | "damageVsL">,
  targetSize: WeaponSize,
): string {
  return targetSize === "L" ? weapon.damageVsL : weapon.damageVsSM;
}
