// Bow/crossbow ammunition matching (docs/superpowers/specs/2026-09-28-
// adnd2e-ammunition-design.md): which owned ammo items a launcher can use,
// and which one its selector defaults to. Pure — no actor/Foundry access;
// call sites (sheets/character/context.ts, sheets/character/combat-rolls.ts)
// project the actor's items into AmmoStock first.
export interface AmmoStock {
  id: string;
  ammoType: string;
  quantity: number;
}

/** Ammo usable with a launcher whose ammoType is `ammoType`: same tag, still in stock. */
export function matchingAmmo(ammo: readonly AmmoStock[], ammoType: string): AmmoStock[] {
  return ammo.filter((a) => a.ammoType === ammoType && a.quantity > 0);
}

/** The candidate a weapon's ammo selector defaults to: the persisted choice
 *  if it's still a valid candidate, else the first candidate, else none. */
export function defaultAmmoSelection(
  candidates: readonly AmmoStock[],
  selectedAmmoId: string | null,
): AmmoStock | null {
  return candidates.find((a) => a.id === selectedAmmoId) ?? candidates[0] ?? null;
}
