import type { WeaponData, WeaponCategory, WeaponSize, DamageType, WeaponRange } from "../../core/weapons/data";

export interface WeaponSource {
  name: string;
  category: WeaponCategory;
  damageVsSM: string | null;
  damageVsL: string | null;
  damageType: DamageType | null;
  speedFactor: number;
  weight: number;
  size: WeaponSize;
  rateOfFire: string | null;
  range: WeaponRange | null;
  proficiencyGroup: string;
  handsRequired: 1 | 2;
}

/**
 * Project a `weapon` item's authored fields into the engine's `WeaponData`
 * view. Pure field mapping — no actor context; Plan 1c.3 / Sub-project 3 feed
 * the result to `resolveWeaponAttackInputs` / `selectDamageDice`.
 */
export function toWeaponData(source: WeaponSource): WeaponData {
  return {
    name: source.name,
    category: source.category,
    damageVsSM: source.damageVsSM,
    damageVsL: source.damageVsL,
    damageType: source.damageType,
    speedFactor: source.speedFactor,
    weight: source.weight,
    size: source.size,
    rateOfFire: source.rateOfFire,
    range: source.range,
    proficiencyGroup: source.proficiencyGroup,
    handsRequired: source.handsRequired,
  };
}
