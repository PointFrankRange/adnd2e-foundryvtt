// The seven wrestling lock effects (C&T "Locks"). Values are mechanical only. Pure.
import { sizeModifier } from "./modifiers";
import type { LockEffectId } from "./types";

export interface LockSpec {
  id: LockEffectId;
  /** base damage dice; null = no damage */
  dice: string | null;
  /** +1 damage when the target lands on hard ground (throw, slam) */
  hardSurfaceBonus: boolean;
  /** the grapple ends (the target is flung free) */
  frees: boolean;
  /** the target ends up prone */
  prone: boolean;
  /** slam: the lock drops to a plain hold */
  dropsToHold: boolean;
  /** cannot be used on a target two or more size classes larger */
  sizeLimited: boolean;
  /** a save the GM adjudicates ("breath" breaks a slam hold; "death" is the hammer's knockout), shown on the card */
  save: "breath" | "death" | null;
}

export const LOCK_SPECS: Readonly<Record<LockEffectId, LockSpec>> = {
  throw: { id: "throw", dice: "1d4", hardSurfaceBonus: true, frees: true, prone: true, dropsToHold: false, sizeLimited: true, save: null },
  takedown: { id: "takedown", dice: "1d3", hardSurfaceBonus: false, frees: false, prone: true, dropsToHold: false, sizeLimited: false, save: null },
  slam: { id: "slam", dice: "1d8", hardSurfaceBonus: true, frees: false, prone: true, dropsToHold: true, sizeLimited: true, save: "breath" },
  press: { id: "press", dice: "1d6", hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: null },
  hammer: { id: "hammer", dice: "1d2", hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: "death" },
  manipulate: { id: "manipulate", dice: "1d2", hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: null },
  carry: { id: "carry", dice: null, hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: null },
};

export interface LockDamageContext {
  /** consecutive press count INCLUDING this one (first press = 1) */
  pressCount: number;
  hardSurface: boolean;
  /** the holder's Strength damage adjustment */
  strengthAdj: number;
}

/** The dice formula for one lock application, or null when the effect deals no damage. */
export function lockDamageFormula(id: LockEffectId, ctx: LockDamageContext): string | null {
  const spec = LOCK_SPECS[id];
  if (spec.dice === null) return null;
  let bonus = ctx.strengthAdj;
  if (id === "press") bonus += ctx.pressCount;
  if (spec.hardSurfaceBonus && ctx.hardSurface) bonus += 1;
  return bonus === 0 ? spec.dice : `${spec.dice}${bonus > 0 ? "+" : ""}${bonus}`;
}

/** Throw and slam fail against a target two or more size classes larger than the holder. */
export function canUseLock(id: LockEffectId, holderSize: string | null | undefined, heldSize: string | null | undefined): boolean {
  if (!LOCK_SPECS[id].sizeLimited) return true;
  return sizeModifier(holderSize, heldSize) > -8; // each size class is 4; -8 or worse = two or more classes larger
}

/** The press counter after applying `chosen`: consecutive presses climb, any other lock resets it. */
export function nextPressCount(lastLock: LockEffectId | null, pressCount: number, chosen: LockEffectId): number {
  if (chosen !== "press") return 0;
  return lastLock === "press" ? pressCount + 1 : 1;
}
