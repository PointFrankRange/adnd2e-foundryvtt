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
  /** summed Table 51 situational modifiers */
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

export function hitResult(
  naturalD20: number,
  attackBonus: number,
  thac0: number,
  targetAc: number,
): HitResult {
  assertD20(naturalD20);
  const needed = toHitNumber(thac0, targetAc);
  const total = naturalD20 + attackBonus;
  const margin = total - needed;
  if (naturalD20 === 20) {
    return { hit: true, autoHit: true, autoMiss: false, needed, total, margin };
  }
  if (naturalD20 === 1) {
    return { hit: false, autoHit: false, autoMiss: true, needed, total, margin };
  }
  return { hit: total >= needed, autoHit: false, autoMiss: false, needed, total, margin };
}
