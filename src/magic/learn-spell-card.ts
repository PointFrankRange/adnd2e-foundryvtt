import type { LearnRejection } from "../core/magic/spellbook";
import type { LearnSpellCardContext, LearnSpellCardInput } from "./card-types";

const REJECTION_LABELS: Record<LearnRejection, string> = {
  "int-too-low": "ADND2E.chat.learnSpell.rejection.intTooLow",
  "spell-level-exceeds-int": "ADND2E.chat.learnSpell.rejection.spellLevelExceedsInt",
  "opposition-school": "ADND2E.chat.learnSpell.rejection.oppositionSchool",
  "per-level-cap-reached": "ADND2E.chat.learnSpell.rejection.perLevelCapReached",
};

/** Turn a resolved (or rejected) Learn Spell attempt into the chat-card's
 *  display data. `roll` is null when `result.allowed` is false — a rejected
 *  attempt never gets a d100 roll. */
export function buildLearnSpellCardContext(input: LearnSpellCardInput): LearnSpellCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    spellName: input.spellName,
    spellLevel: input.spellLevel,
    allowed: input.result.allowed,
    chance: input.result.chance,
    reasonLabel: input.result.reason ? REJECTION_LABELS[input.result.reason] : null,
    roll: input.roll,
  };
}
