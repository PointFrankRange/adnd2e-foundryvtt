// PHB p.89, p.91: weapon damage = base dice + Strength + specialization + magic + situational.
// A successful hit deals at least 1 point (PHB p.89 describes damage as "as little as 1 point";
// a hit reduced below 1 by penalties is treated as 1).

export interface DamageModifierInput {
  /** strength().damageAdj, if it applies (melee + thrown); else 0 */
  strengthDamageAdj?: number;
  /** weapon-specialization damage bonus (fighter = +2); else 0 */
  specializationBonus?: number;
  /** weapon magic bonus (+1 sword -> +1) */
  weaponMagicBonus?: number;
  situationalModifier?: number;
}

export interface DamageModifierResult {
  total: number;
  breakdown: {
    strength: number;
    specialization: number;
    weaponMagic: number;
    situational: number;
  };
}

export function damageModifiers(input: DamageModifierInput): DamageModifierResult {
  const strength = input.strengthDamageAdj ?? 0;
  const specialization = input.specializationBonus ?? 0;
  const weaponMagic = input.weaponMagicBonus ?? 0;
  const situational = input.situationalModifier ?? 0;
  return {
    total: strength + specialization + weaponMagic + situational,
    breakdown: { strength, specialization, weaponMagic, situational },
  };
}

/**
 * Final damage from a successful weapon hit: rolled dice + bonus, floored at 1.
 * This is the weapon-hit floor only — damage resistance, immunity, and energy
 * type are applied by the caller AFTER this.
 */
export function damageResult(rolledBaseDamage: number, damageBonus: number): number {
  return Math.max(1, rolledBaseDamage + damageBonus);
}
