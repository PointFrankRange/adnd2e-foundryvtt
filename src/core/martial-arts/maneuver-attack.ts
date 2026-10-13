// One special-maneuver attack: to-hit with the Table 21 modifier plus the damage formula. Pure.
import { hitResult } from "../combat/attack";
import { armorAttackPenalty, weaponSizePenalty } from "./modifiers";
import { maneuverById, maneuverDamageFormula, table21Modifier, type ArmorGroup } from "./maneuvers";

export interface ManeuverAttackInput {
  maneuverId: string;
  naturalD20: number;
  /** the attacker's melee THAC0 (already includes the Strength to-hit adjustment) */
  thac0: number;
  targetAc: number;
  attackerArmorType: string;
  opponentWeaponSize: string | null;
  situationalModifier: number;
  /** the TARGET's Table 21 column */
  targetArmorGroup: ArmorGroup;
  /** the active style's damage die; null for a weapon-method style */
  styleDie: string | null;
  level: number;
  strengthAdj: number;
  forcedHit?: boolean;
}

export interface ManeuverAttackResult {
  maneuverId: string;
  hit: boolean;
  naturalD20: number;
  needed: number;
  total: number;
  attackBonus: number;
  penalties: { armor: number; weaponSize: number; situational: number; table21: number };
  /** the dice expression to roll on a hit; null for a parry or a miss */
  damageFormula: string | null;
  /** an unmodified 20 with an attack maneuver */
  stunTrigger: boolean;
}

export function resolveManeuverAttack(input: ManeuverAttackInput): ManeuverAttackResult {
  const def = maneuverById(input.maneuverId);
  if (!def) throw new RangeError(`unknown martial arts maneuver "${input.maneuverId}"`);
  const penalties = {
    armor: armorAttackPenalty(input.attackerArmorType),
    weaponSize: weaponSizePenalty(input.opponentWeaponSize),
    situational: input.situationalModifier,
    table21: table21Modifier(def, input.targetArmorGroup),
  };
  const attackBonus = penalties.armor + penalties.weaponSize + penalties.situational + penalties.table21;
  const base = hitResult({ naturalD20: input.naturalD20, attackBonus, thac0: input.thac0, targetAc: input.targetAc });
  const hit = input.forcedHit === true ? true : base.hit;
  return {
    maneuverId: def.id,
    hit,
    naturalD20: input.naturalD20,
    needed: base.needed,
    total: base.total,
    attackBonus,
    penalties,
    damageFormula: hit ? maneuverDamageFormula(def, { styleDie: input.styleDie, level: input.level, strengthAdj: input.strengthAdj }) : null,
    stunTrigger: def.kind === "attack" && input.naturalD20 === 20,
  };
}
