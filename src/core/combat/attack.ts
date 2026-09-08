// PHB Ch.9 pp.89-92: THAC0 attack resolution + Table 51 combat modifiers.
import { assertD20 } from "../errors";

export interface AttackModifierInput {
  /** strength().hitProb, if it applies to this weapon (melee + thrown); else 0 */
  strengthHitAdj?: number;
  /** dexterity().missileAttackAdj for a ranged attack; 0 for melee */
  dexterityMissileAdj?: number;
  /** weapon magic bonus (+1 sword -> +1) */
  weaponMagicBonus?: number;
  /** 0 if proficient; class non-proficiency penalty if not; +1 if specialized */
  proficiencyModifier?: number;
  /** 0 short, -2 medium, -5 long */
  rangePenalty?: number;
  /**
   * Summed Table 51 situational modifiers, EXCLUDING the missile-range rows
   * (long -5 / medium -2) — those belong in `rangePenalty`.
   */
  situationalModifier?: number;
}

export interface AttackModifierResult {
  total: number;
  breakdown: {
    strength: number;
    dexterityMissile: number;
    weaponMagic: number;
    proficiency: number;
    range: number;
    situational: number;
  };
}

export function attackModifiers(input: AttackModifierInput): AttackModifierResult {
  const strength = input.strengthHitAdj ?? 0;
  const dexterityMissile = input.dexterityMissileAdj ?? 0;
  const weaponMagic = input.weaponMagicBonus ?? 0;
  const proficiency = input.proficiencyModifier ?? 0;
  const range = input.rangePenalty ?? 0;
  const situational = input.situationalModifier ?? 0;
  return {
    total: strength + dexterityMissile + weaponMagic + proficiency + range + situational,
    breakdown: { strength, dexterityMissile, weaponMagic, proficiency, range, situational },
  };
}

/** The d20 result needed to hit: THAC0 minus the target's Armor Class. */
export function toHitNumber(thac0: number, targetAc: number): number {
  return thac0 - targetAc;
}

export interface HitResult {
  hit: boolean;
  /** natural 20 */
  autoHit: boolean;
  /** natural 1 */
  autoMiss: boolean;
  needed: number;
  total: number;
  margin: number;
}

export interface HitInput {
  naturalD20: number;
  attackBonus: number;
  thac0: number;
  targetAc: number;
}

/**
 * Resolve one attack roll. Natural 20 always hits; natural 1 always misses
 * (PHB p.92) — both gate on the natural die, not the modified total.
 *
 * Table 51's "defender sleeping or held → Automatic" is not modeled here: RAW,
 * no attack roll is made — the caller skips hitResult and applies a hit directly.
 */
export function hitResult(input: HitInput): HitResult {
  assertD20(input.naturalD20);
  const needed = toHitNumber(input.thac0, input.targetAc);
  const total = input.naturalD20 + input.attackBonus;
  const margin = total - needed;
  if (input.naturalD20 === 20) {
    return { hit: true, autoHit: true, autoMiss: false, needed, total, margin };
  }
  if (input.naturalD20 === 1) {
    return { hit: false, autoHit: false, autoMiss: true, needed, total, margin };
  }
  return { hit: total >= needed, autoHit: false, autoMiss: false, needed, total, margin };
}
