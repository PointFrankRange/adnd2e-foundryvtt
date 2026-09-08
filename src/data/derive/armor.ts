export interface ArmorAcInput {
  /** the armor's AC rating (10 none .. 1 full plate); ignored for a shield */
  baseAc: number;
  /** this item's magic enchantment bonus (+1 armor, +2 shield …), positive */
  magicBonus: number;
  isShield: boolean;
  /** positive magnitude a shield lowers AC by (0 default; 1 for a normal shield) */
  shieldAcBonus: number;
}

export interface ArmorAcContribution {
  /** the armor's AC rating, to feed `armorClass({ baseArmorAc })`; `null` for a shield */
  baseArmorAc: number | null;
  /** positive magnitude, to feed `armorClass({ shieldBonus })`; `null` for body armor */
  shieldBonus: number | null;
  /** this item's magic protection (positive), to sum into `armorClass({ magicBonus })` */
  magicBonus: number;
}

/**
 * Decompose one armor / shield item into the raw components the engine's
 * `armorClass()` consumes. Item-local — no actor context. Plan 1c.3's AC
 * composer takes `baseArmorAc` from the equipped body armor, `shieldBonus`
 * from the equipped shield, and sums every `magicBonus`.
 */
export function armorAcContribution(input: ArmorAcInput): ArmorAcContribution {
  if (input.isShield) {
    return { baseArmorAc: null, shieldBonus: input.shieldAcBonus, magicBonus: input.magicBonus };
  }
  return { baseArmorAc: input.baseAc, shieldBonus: null, magicBonus: input.magicBonus };
}
