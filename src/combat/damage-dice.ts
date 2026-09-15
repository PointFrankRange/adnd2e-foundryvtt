import type { CreatureSize } from "../core/types";

export interface WeaponDamageDice {
  damageVsSM: string | null;
  damageVsL: string | null;
}

const LARGE_AND_UP: ReadonlySet<CreatureSize> = new Set(["large", "huge", "gargantuan"] as const);

/**
 * PHB p.61: weapons roll different damage against Large+ creatures. `targetSize`
 * `null` (no target selected) defaults to the Small/Medium die. A weapon that
 * defines only one die (or neither — a launcher whose ammo isn't modeled as an
 * item yet, spec §7) falls back to whichever is non-null, or `null` if neither is.
 */
export function pickDamageDice(weapon: WeaponDamageDice, targetSize: CreatureSize | null): string | null {
  const preferLarge = targetSize !== null && LARGE_AND_UP.has(targetSize);
  return preferLarge
    ? (weapon.damageVsL ?? weapon.damageVsSM ?? null)
    : (weapon.damageVsSM ?? weapon.damageVsL ?? null);
}
