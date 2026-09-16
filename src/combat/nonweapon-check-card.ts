import type { NonweaponCheckCardContext, NonweaponCheckCardInput } from "./card-types";

/** Turn a resolved non-weapon proficiency check into the chat-card's display
 *  data. Pure passthrough/flattening — `nonweaponCheck` (core/proficiencies/
 *  nonweapon.ts) already did all the real math; this just reshapes its
 *  result alongside the actor/proficiency display fields. */
export function buildNonweaponCheckCardContext(input: NonweaponCheckCardInput): NonweaponCheckCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    proficiencyName: input.proficiencyName,
    abilityLabel: input.abilityLabel,
    formula: input.formula,
    roll: input.roll,
    target: input.result.target,
    success: input.result.success,
    autoFail: input.result.autoFail,
  };
}
