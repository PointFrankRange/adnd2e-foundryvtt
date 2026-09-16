import type { ThiefSkillCardContext, ThiefSkillCardInput } from "./card-types";

/** Turn a resolved thief/bard-skill check into the chat-card's display data.
 *  Pure passthrough/flatten — `target`/`success` are pulled out of
 *  `input.result` directly onto the context, mirroring
 *  `buildNonweaponCheckCardContext`. */
export function buildThiefSkillCardContext(input: ThiefSkillCardInput): ThiefSkillCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    skillLabel: input.skillLabel,
    formula: input.formula,
    roll: input.roll,
    target: input.result.target,
    success: input.result.success,
  };
}
