import type { DamageType, WeaponCategory } from "./data";

/**
 * Whether a weapon is backstab-eligible: a melee weapon dealing piercing
 * and/or slashing damage (PHB p.40 — thrown/missile weapons and blunt
 * (bludgeoning-only) weapons cannot be used to backstab).
 */
export function canBackstab(weapon: { category: WeaponCategory; damageType: DamageType | null }): boolean {
  return weapon.category === "melee" && weapon.damageType !== null && weapon.damageType !== "bludgeoning";
}
