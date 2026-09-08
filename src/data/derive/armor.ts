export interface ArmorAcInput {
  /** AC value the armor grants (e.g. plate = 3); ignored for a shield */
  baseAc: number;
  /** enchantment bonus (+1 armor, +2 shield …) */
  magicBonus: number;
  isShield: boolean;
  /** AC improvement a shield gives (usually 1) */
  shieldAcBonus: number;
}

/**
 * This item's contribution to the wearer's AC, already AC-signed so Plan 1c.3
 * can sum contributions. Body armor: `baseAc − magicBonus` (a better AC is a
 * lower number, so magic subtracts). Shield: `−(shieldAcBonus + magicBonus)`.
 */
export function armorAcContribution(input: ArmorAcInput): { acBonus: number } {
  if (input.isShield) {
    return { acBonus: -(input.shieldAcBonus + input.magicBonus) };
  }
  return { acBonus: input.baseAc - input.magicBonus };
}
