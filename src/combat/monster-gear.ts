// Monster NPC (the `creature` actor type) gear rules (post-SP9): which items a
// Monster NPC accepts, and how an equipped weapon becomes an attack — the
// monster's own THAC0 with the weapon's magic bonus, the weapon's S-M / L damage
// by target size. Pure.
//
// `ammo` is accepted as inert loot (Gear panel listing only) — a monster's
// ranged attacks stay on the flat monsterWeaponDamageFormula path regardless
// of what ammo it's carrying (docs/superpowers/specs/2026-09-28-adnd2e-
// ammunition-design.md's "PCs only" scope; ammo tracking/consumption is
// deliberately never wired into monster attacks).
import { damageFormula } from "../core/dice/formula";
import type { CreatureSize } from "../core/types";
import { pickDamageDice } from "./damage-dice";

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

/** The weapon's damage roll against a target of `targetSize` (null = unknown → S-M die), or null when no die is modeled. */
export function monsterWeaponDamageFormula(weapon: MonsterWeapon, targetSize: CreatureSize | null): string | null {
  const dice = pickDamageDice(weapon, targetSize);
  return dice ? damageFormula(dice, weapon.magicBonus) : null;
}

/** "1d8 / 1d12 +1" — S-M / L dice ("—" when missing) and a signed magic bonus when non-zero. */
export function monsterWeaponDamageLabel(weapon: MonsterWeapon): string {
  const dice = `${weapon.damageVsSM ?? "—"} / ${weapon.damageVsL ?? "—"}`;
  if (weapon.magicBonus === 0) return dice;
  return `${dice} ${weapon.magicBonus > 0 ? "+" : ""}${weapon.magicBonus}`;
}
