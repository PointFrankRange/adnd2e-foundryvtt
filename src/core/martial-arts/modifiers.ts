// Attack penalties for an unarmed martial artist. Pure.
const ARMOR_ATTACK_PENALTY: Readonly<Record<string, number>> = {
  "studded-leather": -1,
  "ring-mail": -2, "scale-mail": -2, "chain-mail": -2, "elven-chain": -2,
  "splint-mail": -5, "banded-mail": -5, "plate-mail": -5,
  "field-plate": -8,
  "full-plate": -10,
};
const WEAPON_SIZE_PENALTY: Readonly<Record<string, number>> = { S: -1, M: -2, L: -4, G: -3, H: -1 };

const own = (table: Readonly<Record<string, number>>, key: string): number =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key]! : 0;

/** PHB Table 57: the penalty to the attack roll for the ATTACKER's own worn armor (unlisted types 0). */
export function armorAttackPenalty(armorType: string): number {
  return own(ARMOR_ATTACK_PENALTY, armorType);
}

/** PHBR15 Table 22: the penalty for facing an opponent's wielded weapon of this size (none/unknown 0). */
export function weaponSizePenalty(size: string | null): number {
  return size === null ? 0 : own(WEAPON_SIZE_PENALTY, size);
}
