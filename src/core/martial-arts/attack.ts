// One unarmed martial arts attack: to-hit resolution plus the Table 16 blow. Pure.
import { hitResult } from "../combat/attack";
import { martialArtsResult, type BlowId } from "./results";
import { armorAttackPenalty, weaponSizePenalty } from "./modifiers";

export interface MartialAttackInput {
  naturalD20: number;
  /** the attacker's melee THAC0 (already includes the Strength to-hit adjustment) */
  thac0: number;
  targetAc: number;
  attackerArmorType: string;
  opponentWeaponSize: string | null;
  /** summed condition modifiers (blinded, fatigued, invisible target, ...) */
  situationalModifier: number;
  strengthDamageAdj: number;
  /** a helpless target is hit automatically */
  forcedHit?: boolean;
}

export interface MartialAttackResult {
  hit: boolean;
  naturalD20: number;
  needed: number;
  total: number;
  attackBonus: number;
  penalties: { armor: number; weaponSize: number; situational: number };
  blow: BlowId | null;
  tableDamage: number;
  /** Table 16 damage + Strength damage adjustment, minimum 0; 0 on a miss */
  damage: number;
  /** an unmodified 20: the target must save vs paralyzation or be stunned/incapacitated */
  stunTrigger: boolean;
}

export function resolveMartialAttack(input: MartialAttackInput): MartialAttackResult {
  const penalties = {
    armor: armorAttackPenalty(input.attackerArmorType),
    weaponSize: weaponSizePenalty(input.opponentWeaponSize),
    situational: input.situationalModifier,
  };
  const attackBonus = penalties.armor + penalties.weaponSize + penalties.situational;
  const base = hitResult({ naturalD20: input.naturalD20, attackBonus, thac0: input.thac0, targetAc: input.targetAc });
  const hit = input.forcedHit === true ? true : base.hit;
  const row = hit ? martialArtsResult(input.naturalD20) : null;
  const tableDamage = row?.damage ?? 0;
  return {
    hit,
    naturalD20: input.naturalD20,
    needed: base.needed,
    total: base.total,
    attackBonus,
    penalties,
    blow: row?.blow ?? null,
    tableDamage,
    damage: hit ? Math.max(0, tableDamage + input.strengthDamageAdj) : 0,
    stunTrigger: input.naturalD20 === 20,
  };
}
