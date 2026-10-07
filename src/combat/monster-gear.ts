// Monster NPC (the `creature` actor type) gear rules (post-SP9): which items a
// Monster NPC accepts, and how an equipped weapon becomes an attack — the
// monster's own THAC0 with the weapon's magic bonus, the weapon's S-M / L damage
// by target size. Pure.
//
// `ammo` is accepted as loot. A bow/crossbow has no dice of its own, so its
// damage comes from a matching ammo item the monster carries (#98) — but ammo
// is never consumed by monster attacks (the PC-only tracking in docs/superpowers/
// specs/2026-09-28-adnd2e-ammunition-design.md stays PC-only).
import { damageFormula } from "../core/dice/formula";
import type { CreatureSize } from "../core/types";
import { defaultAmmoSelection, matchingAmmo, type AmmoStock } from "./ammo";
import { pickDamageDice, type WeaponDamageDice } from "./damage-dice";

export const MONSTER_ITEM_TYPES = ["weapon", "armor", "equipment", "ammo", "spell"] as const;

export function monsterDropVerdict(type: string): { ok: true } | { ok: false; reason: string } {
  return (MONSTER_ITEM_TYPES as readonly string[]).includes(type)
    ? { ok: true }
    : { ok: false, reason: "ADND2E.sheet.drop.monsterRejects" };
}

export interface MonsterWeapon {
  category: string;
  magicBonus: number;
  damageVsSM: string | null;
  damageVsL: string | null;
}

export function monsterWeaponAttackType(category: string): "melee" | "ranged" {
  return category === "melee" ? "melee" : "ranged";
}

export type MonsterAmmo = AmmoStock & WeaponDamageDice;

/** A launcher's (bow/crossbow, `ammoType` set) ammo: the selected stock if still valid, else the first matching
 *  item in stock; null when the monster carries none (or the weapon is not a launcher). */
export function monsterLauncherAmmo(
  weapon: { ammoType: string | null; selectedAmmoId: string | null },
  ammo: readonly MonsterAmmo[],
): MonsterAmmo | null {
  if (!weapon.ammoType) return null;
  const pick = defaultAmmoSelection(matchingAmmo(ammo, weapon.ammoType), weapon.selectedAmmoId);
  return pick ? (ammo.find((a) => a.id === pick.id) ?? null) : null;
}

/** The weapon's damage roll against a target of `targetSize` (null = unknown → S-M die), or null when no die is modeled.
 *  A launcher passes its `ammo` — the ammo's dice replace the weapon's (the weapon's magic bonus still applies). */
export function monsterWeaponDamageFormula(
  weapon: MonsterWeapon,
  targetSize: CreatureSize | null,
  ammo: WeaponDamageDice | null = null,
): string | null {
  const dice = pickDamageDice(ammo ?? weapon, targetSize);
  return dice ? damageFormula(dice, weapon.magicBonus) : null;
}

/** "1d8 / 1d12 +1" — S-M / L dice ("—" when missing) and a signed magic bonus when non-zero. */
export function monsterWeaponDamageLabel(weapon: MonsterWeapon): string {
  const dice = `${weapon.damageVsSM ?? "—"} / ${weapon.damageVsL ?? "—"}`;
  if (weapon.magicBonus === 0) return dice;
  return `${dice} ${weapon.magicBonus > 0 ? "+" : ""}${weapon.magicBonus}`;
}
