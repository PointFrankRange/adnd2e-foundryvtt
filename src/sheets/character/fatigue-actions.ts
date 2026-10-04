// Sub-project 14 Plan C: the two save-driven fatigue mechanics — a mortal-
// fatigue save-or-die, and the player-initiated Recover-from-Fatigue action.
// Foundry-coupled glue, dev-world verified. Both need the save's pass/fail
// result SYNCHRONOUSLY to decide the next state change, unlike the existing
// player-facing combat-rolls.ts's rollSave (which posts a result
// asynchronously via a chat-message flag for SP9a's disruption hook to react
// to later) — so this file has its own small, direct roll-and-return helper
// rather than reusing that one.
import {
  channellerFatigueEnabled, FATIGUE_CONDITION_ID, nextTierDown, tierForConditionId,
} from "../../core/magic/channeller-fatigue";
import { buildSaveCardContext } from "../../combat/save-card";
import { TEMPLATE_PATH } from "../../constants";
import { getOptionalRules } from "../../settings";
import type { SpellcasterActor } from "./spell-actions";

/** Rolls 1d20 + the actor's cached ppd save target's rollModifier + `bonus`
 *  against that same target, posts a chat card for transparency (same shape
 *  combat-rolls.ts's rollSave already posts), and returns the pass/fail
 *  result synchronously. */
async function rollParalyzationSave(
  actor: SpellcasterActor,
  bonus: number,
): Promise<boolean> {
  const save = actor.system.saves.ppd;
  const totalModifier = save.rollModifier + bonus;
  const roll = await new Roll(
    `1d20${totalModifier ? (totalModifier > 0 ? ` + ${totalModifier}` : ` - ${Math.abs(totalModifier)}`) : ""}`,
  ).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: "ADND2E.saves.ppd",
    formula: roll.formula, naturalD20, rollModifier: totalModifier, target: save.target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
  return context.success;
}

/** Called when a cast resolves to the mortal tier (spell-actions.ts's
 *  applyCastFatigue, Task 5): rolls the save (no bonus — the book specifies
 *  none for this roll); on failure, HP to 0 + apply "dead"; on success,
 *  apply "unconscious" + set the condition straight to severeFatigue
 *  (modeling "awakes severely fatigued" as being severely fatigued
 *  immediately, since fatigue has no mechanical effect while already
 *  unconscious — spec §2). */
export async function resolveMortalFatigue(
  actor: SpellcasterActor,
): Promise<void> {
  const survived = await rollParalyzationSave(actor, 0);
  if (!survived) {
    await actor.update({ "system.attributes.hp.value": 0 });
    await actor.toggleStatusEffect("dead", { active: true });
    ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.mortalFatigueDied"));
    return;
  }
  // Whole-branch review M6: explicitly clear mortalFatigue regardless of path
  // — if a GM had manually applied it via the Token HUD before this function
  // ran (outside normal gameplay, but a real inconsistent-state risk), nothing
  // else here ever turns it back off, which would otherwise leave both
  // mortalFatigue and severeFatigue active simultaneously.
  await actor.toggleStatusEffect(FATIGUE_CONDITION_ID.mortal, { active: false });
  await actor.toggleStatusEffect("unconscious", { active: true });
  await actor.toggleStatusEffect(FATIGUE_CONDITION_ID.severe, { active: true });
  ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.mortalFatigueSurvived"));
}

/** The caster whose banked `fatigueSaveBonus` a Recover-from-Fatigue roll uses.
 *  A priest-only channeller (its priest channelling max derived, the wizard's
 *  not) banks its own counter. Everyone else, including a wizard/priest
 *  multiclass, keeps the wizard counter, exactly as before. */
export function fatigueCasterKey(actor: SpellcasterActor): "wizard" | "priest" {
  const priestOnly =
    typeof actor.system.spellcasting.priest.channelling.max === "number" &&
    typeof actor.system.spellcasting.wizard.channelling.max !== "number";
  return priestOnly ? "priest" : "wizard";
}

/** The Recover-from-Fatigue sheet action: one saving throw using the banked
 *  `fatigueSaveBonus` counter of `fatigueCasterKey(actor)`. Success drops one
 *  tier (clearing the condition entirely from light) and resets the counter;
 *  failure increments it. No-ops with a warning if not currently fatigued or
 *  the rule is off. */
export async function recoverFromFatigue(
  actor: SpellcasterActor,
): Promise<void> {
  const caster = fatigueCasterKey(actor);
  const counterPath = `system.spellcasting.${caster}.fatigueSaveBonus`;
  if (!channellerFatigueEnabled(getOptionalRules())) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.channellingBlockedWarning"));
    return;
  }
  const currentTier = [...actor.statuses].map(tierForConditionId).find((t) => t !== null) ?? null;
  if (currentTier === null) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.fatigueRecoveryNotFatigued"));
    return;
  }
  const bonus = actor.system.spellcasting[caster].fatigueSaveBonus;
  const succeeded = await rollParalyzationSave(actor, bonus);
  if (succeeded) {
    const next = nextTierDown(currentTier);
    await actor.toggleStatusEffect(FATIGUE_CONDITION_ID[currentTier], { active: false });
    if (next !== null) await actor.toggleStatusEffect(FATIGUE_CONDITION_ID[next], { active: true });
    await actor.update({ [counterPath]: 0 });
    ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.fatigueRecoverySuccess"));
  } else {
    await actor.update({ [counterPath]: bonus + 1 });
    ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.fatigueRecoveryFailure"));
  }
}
