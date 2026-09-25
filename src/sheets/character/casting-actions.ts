import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import {
  canCompleteCasting, castingPlan, expandedCastingTimeEnabled, parseCastingTime, type CastingState,
} from "../../core/magic/casting-time";
import { buildCastingNoticeContext } from "../../magic/casting-card";
import { getOptionalRules } from "../../settings";
import type { CastingStatusInput } from "./context-types";
import {
  casterKey, castSpell, postCastCard, rollSpellAutomation, type SpellcasterActor, type SpellItemHandle,
} from "./spell-actions";

/* ---------------------------------------------------------------------------
 * casting-actions — SP9a (PHB casting time + disruption).
 *
 * Foundry-coupled glue, dev-world verified. The math is the pure
 * core/magic/casting-time.ts; this file finds the caster's combat, writes the
 * caster's OWN actor/combatant (a non-GM owner may update their combatant's
 * `initiative` and `flags` — v14.364 common/documents/combatant.mjs:76-83),
 * and posts chat cards. Combatant writes always come AFTER the card and are
 * wrapped so a failure only produces a notice.
 * ------------------------------------------------------------------------- */

interface CombatantLike {
  id: string;
  initiative: number | null;
  update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
}
interface CombatLike {
  id: string;
  started: boolean;
  round: number;
  turn: number | null;
  turns: { id: string }[];
  combatant: { id: string } | null;
  getCombatantsByActor(actor: unknown): CombatantLike[];
}
type CastingActor = SpellcasterActor & {
  id: string;
  system: SpellcasterActor["system"] & {
    attributes: { hp: { value: number } };
    options?: { spellsAndMagic?: { casting?: CastingState | null } };
  };
};

const combats = (): CombatLike[] => [...((game as unknown as { combats: Iterable<CombatLike> }).combats ?? [])];

/** The started combat holding this actor, and its combatant. */
function findCombat(actor: unknown): { combat: CombatLike; combatant: CombatantLike } | null {
  for (const combat of combats()) {
    if (!combat.started) continue;
    const combatant = combat.getCombatantsByActor(actor)[0];
    if (combatant) return { combat, combatant };
  }
  return null;
}

export function readCasting(actor: { system: { options?: { spellsAndMagic?: { casting?: CastingState | null } } } }): CastingState | null {
  return actor.system.options?.spellsAndMagic?.casting ?? null;
}

async function postNotice(actor: CastingActor, spell: SpellItemHandle | undefined, kind: "begin" | "lost", casting: CastingState): Promise<void> {
  const context = buildCastingNoticeContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell?.name ?? "—",
    spellLevel: spell?.system.level ?? 0,
    kind,
    completeRound: casting.completeRound,
    initiativeAdd: casting.segments,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/casting-notice.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as unknown as ChatMessage.CreateData);
}

async function clearCombatantFlag(combatId: string, actor: unknown): Promise<void> {
  const combat = combats().find((c) => c.id === combatId);
  const combatant = combat?.getCombatantsByActor(actor)[0];
  try {
    await combatant?.unsetFlag(SYSTEM_ID, "castingSegments");
  } catch {
    // best effort — a stale flag is harmless once the cast is cleared (it only adds to the NEXT roll)
  }
}

/** The Cast button: today's immediate cast unless the rule is on, the caster is in a started combat and the casting time parses. */
export async function castOrBegin(actor: CastingActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  const ctx = expandedCastingTimeEnabled(getOptionalRules()) && spell ? findCombat(actor) : null;
  const plan = ctx && spell ? castingPlan(parseCastingTime(spell.system.castingTime), ctx.combat.round) : { mode: "immediate" as const };
  if (!ctx || !spell || plan.mode === "immediate") {
    await castSpell(actor, spellItemId);
    return;
  }
  if (readCasting(actor)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.casting.busyWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  if (!list.some((m) => m.spellItemId === spellItemId && !m.expended)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const casting: CastingState = {
    spellItemId,
    casterKey: key,
    combatId: ctx.combat.id,
    startRound: ctx.combat.round,
    completeRound: plan.mode === "rounds" ? plan.completeRound : null,
    segments: plan.mode === "segments" ? plan.initiativeAdd : null,
    hp: actor.system.attributes.hp.value,
  };
  // PHB p.86: the spell is committed when casting begins — a disruption loses it.
  await actor.update({
    [`system.spellcasting.${key}.memorized`]: list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m)),
    "system.options.spellsAndMagic.casting": casting,
  });
  await postNotice(actor, spell, "begin", casting);
  if (plan.mode === "segments" && plan.initiativeAdd > 0) {
    try {
      let wrote = false;
      if (typeof ctx.combatant.initiative === "number") {
        const newInitiative = ctx.combatant.initiative + plan.initiativeAdd;
        const isCurrent = ctx.combat.combatant?.id === ctx.combatant.id;
        const turnIndex = ctx.combat.turns.findIndex((t) => t.id === ctx.combatant.id);
        const hasActed = ctx.combat.turn !== null && turnIndex >= 0 && turnIndex < ctx.combat.turn;
        if (hasActed) {
          // (b) the caster already acted this round: no second slot to grant. The cast completes next
          // round instead, once canCompleteCasting's `round > startRound` branch opens it up.
        } else if (isCurrent) {
          // (a) the caster IS the current combatant. v14 combatant.mjs _preUpdateOperation (~248-258)
          // re-sorts a CLONE of the combat with the new initiative and, whenever `operation.combatTurn`
          // is undefined, pins the pointer to the CURRENT combatant's index in that NEW order — i.e. it
          // follows the caster to their later slot, skipping everyone in between (and, if the caster had
          // already acted, handing them a second turn). Passing today's turn INDEX as `combatTurn` keeps
          // the pointer where it is, so play advances to the next combatant and the caster comes back up
          // later in the round, where Complete unlocks (ruling: Plan 9a whole-branch review, finding I1).
          await ctx.combatant.update({ initiative: newInitiative }, { combatTurn: ctx.combat.turn });
          wrote = true;
        } else {
          // (c) the caster hasn't acted yet and isn't current: v14's default (pin to the current
          // combatant, who isn't the caster) already leaves the pointer untouched.
          await ctx.combatant.update({ initiative: newInitiative });
          wrote = true;
        }
      } else {
        await ctx.combatant.update({ [`flags.${SYSTEM_ID}.castingSegments`]: plan.initiativeAdd });
        wrote = true;
      }
      // Combatant-only updates don't trigger a re-render of the actor's own sheet.
      if (wrote) (actor as unknown as { sheet?: { render(force?: boolean): unknown } }).sheet?.render(false);
    } catch {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.casting.initiativeNotice"));
    }
  }
}

/** Complete casting: re-checks that the cast may complete now, rolls the spell and posts its normal cast card. */
export async function completeCasting(actor: CastingActor): Promise<void> {
  const casting = readCasting(actor);
  const combat = casting ? combats().find((c) => c.id === casting.combatId && c.started) : undefined;
  const combatant = combat?.getCombatantsByActor(actor)[0];
  const spell = casting ? actor.items.get(casting.spellItemId) : undefined;
  const ready =
    expandedCastingTimeEnabled(getOptionalRules()) &&
    casting !== null && combat !== undefined && combatant !== undefined && spell !== undefined &&
    canCompleteCasting(casting, { combatRound: combat.round, isCasterTurn: combat.combatant?.id === combatant.id });
  if (!ready || !casting || !spell) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.casting.notReadyWarning"));
    return;
  }
  const rolled = await rollSpellAutomation(spell);
  if (!rolled) return;
  await actor.update({ "system.options.spellsAndMagic.casting": null });
  await postCastCard(actor, spell, rolled);
  await clearCombatantFlag(casting.combatId, actor);
}

/** Disrupts (announce: posts "spell lost") or cancels the cast. The memorized entry stays expended either way. */
export async function disruptCasting(actor: CastingActor, opts: { announce: boolean }): Promise<void> {
  const casting = readCasting(actor);
  if (!casting) return;
  await actor.update({ "system.options.spellsAndMagic.casting": null });
  if (opts.announce) await postNotice(actor, actor.items.get(casting.spellItemId), "lost", casting);
  await clearCombatantFlag(casting.combatId, actor);
}

/** The sheet's casting status — null while idle or while the rule is off. */
export function readCastingStatus(actor: CastingActor): CastingStatusInput | null {
  const casting = expandedCastingTimeEnabled(getOptionalRules()) ? readCasting(actor) : null;
  if (!casting) return null;
  const combat = combats().find((c) => c.id === casting.combatId);
  const combatant = combat?.getCombatantsByActor(actor)[0];
  return {
    spellName: actor.items.get(casting.spellItemId)?.name ?? "—",
    startRound: casting.startRound,
    completeRound: casting.completeRound,
    segments: casting.segments,
    combatRound: combat?.started ? combat.round : null,
    isCasterTurn: Boolean(combatant) && combat?.combatant?.id === combatant?.id,
  };
}
