import type { CastCardContext, CastCardInput } from "./card-types";

const ROLL_LABELS: Record<"damage" | "healing", string> = {
  damage: "ADND2E.chat.cast.damageRoll",
  healing: "ADND2E.chat.cast.healingRoll",
};

/** Turn a resolved (or automation-less) spell cast into the cast chat-card's
 *  display data. `rollResult` is null when the spell's automation.damage and
 *  automation.healing are both unset — the card then shows spell info only,
 *  with no roll line and no Apply button. */
export function buildCastCardContext(input: CastCardInput): CastCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    spellName: input.spellName,
    spellLevel: input.spellLevel,
    range: input.range,
    duration: input.duration,
    castingTime: input.castingTime,
    savingThrow: input.savingThrow,
    hasSavingThrow: input.savingThrow !== "none",
    components: input.components,
    rollResult: input.rollResult
      ? { ...input.rollResult, label: ROLL_LABELS[input.rollResult.kind] }
      : null,
    applyContext: input.rollResult
      ? { amount: input.rollResult.total, kind: input.rollResult.kind }
      : null,
  };
}
