// PHB p.91: which of the Strength / Dexterity adjustments apply to an attack,
// by how the weapon is used. The engine takes the already-derived adjustment
// numbers (strength() / dexterity()) — it does not derive them.
import type { AttackMode } from "./data";

export interface WeaponAbilityAdjustments {
  /** strength().hitProb */
  strengthHitProb: number;
  /** strength().damageAdj */
  strengthDamageAdj: number;
  /** dexterity().missileAttackAdj */
  dexterityMissileAttackAdj: number;
}

export interface AttackContext {
  attackMode: AttackMode;
  /** a crossbow gets neither a Strength bonus nor a Strength penalty */
  isCrossbow?: boolean;
  /** a composite / strength bow: the Strength hit bonus applies */
  strengthBow?: boolean;
}

export interface ResolvedAttackInputs {
  strengthHitAdj: number;
  dexterityMissileAdj: number;
  strengthDamageAdj: number;
}

export function resolveWeaponAttackInputs(
  abilities: WeaponAbilityAdjustments,
  context: AttackContext,
): ResolvedAttackInputs {
  if (context.attackMode === "melee") {
    return {
      strengthHitAdj: abilities.strengthHitProb,
      dexterityMissileAdj: 0,
      strengthDamageAdj: abilities.strengthDamageAdj,
    };
  }
  if (context.attackMode === "thrown") {
    return {
      strengthHitAdj: abilities.strengthHitProb,
      dexterityMissileAdj: abilities.dexterityMissileAttackAdj,
      strengthDamageAdj: abilities.strengthDamageAdj,
    };
  }
  // fired
  let strengthHitAdj: number;
  if (context.isCrossbow) {
    strengthHitAdj = 0;
  } else if (context.strengthBow) {
    strengthHitAdj = abilities.strengthHitProb;
  } else {
    strengthHitAdj = Math.min(0, abilities.strengthHitProb);
  }
  return {
    strengthHitAdj,
    dexterityMissileAdj: abilities.dexterityMissileAttackAdj,
    strengthDamageAdj: 0,
  };
}
