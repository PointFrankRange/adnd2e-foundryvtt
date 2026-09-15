import { damageResult } from "../core/combat/damage";
import type { DamageCardContext, DamageCardInput } from "./card-types";

/** Turn a resolved damage roll into the chat-card's display data. Reuses the
 *  existing `damageResult` floor-at-1 rule (core/combat/damage.ts). */
export function buildDamageCardContext(input: DamageCardInput): DamageCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    weaponName: input.weaponName,
    formula: input.formula,
    rolled: input.rolledBaseDamage,
    bonus: input.damageBonus,
    total: damageResult(input.rolledBaseDamage, input.damageBonus),
  };
}
