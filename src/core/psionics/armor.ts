import type { ArmorType } from "../types";

/* PHBR5 Table 9 (optional rule): a psionicist may wear any armor, but metal armor
 * lowers every power score. Shields carry no penalty. Elven chain is not in the
 * table; it is treated as chain mail. Pure. */

const PENALTY: Record<ArmorType, number> = {
  none: 0,
  padded: 0,
  leather: 0,
  "studded-leather": 0,
  "ring-mail": -1,
  "scale-mail": -1,
  "splint-mail": -1,
  "chain-mail": -2,
  "elven-chain": -2,
  "banded-mail": -2,
  "plate-mail": -3,
  "field-plate": -5,
  "full-plate": -7,
};

/** The power-score reduction (<= 0) for wearing one armor type. */
export function psionicArmorPenalty(armorType: ArmorType): number {
  return PENALTY[armorType] ?? 0;
}

/** The worst penalty among the worn body armors (shields ignored); `armor` is the offender's index, or null when there is none. */
export function worstArmorPenalty(worn: readonly { armorType: ArmorType; isShield: boolean }[]): { penalty: number; armor: number | null } {
  let penalty = 0;
  let armor: number | null = null;
  worn.forEach((a, i) => {
    if (a.isShield) return;
    const p = psionicArmorPenalty(a.armorType);
    if (p < penalty) {
      penalty = p;
      armor = i;
    }
  });
  return { penalty, armor };
}
