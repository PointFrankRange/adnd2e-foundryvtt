import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import {
  canCompleteCasting, castingPlan, expandedCastingTimeEnabled, parseCastingTime, type CastingState,
} from "../../core/magic/casting-time";
import { buildCastingNoticeContext } from "../../magic/casting-card";
import { getOptionalRules } from "../../settings";
import type { CastingStatusInput } from "./context-types";
import { resolveMortalFatigue } from "./fatigue-actions";
import {
  applyCastFatigue, casterKey, castingBlockedByKit, castSpell, channellingActive, postCastCard, rollSpellAutomation, tryChannellingSpend,
  type SpellcasterActor, type SpellItemHandle,
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

/** The Cast button: today's immediate cast unless the rule is on, the caster
 *  is in a started combat and the casting time parses. Sub-project 14 Plan B:
 *  for a channelling wizard, beginning the cast spends spell points right
 *  away (afford-checked below via the shared `tryChannellingSpend` helper)
 *  instead of marking the memorized entry expended — see the "commit" note
 *  further down. */
export async function castOrBegin(actor: CastingActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  // SP11 Plan C: a kit that switches this caster type off blocks the cast before any state is read or written.
  if (spell && castingBlockedByKit(actor, casterKey(spell))) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.kitCastingDisabledWarning"));
    return;
  }
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
  // Sub-project 14 Plan B: a channelling entry is never expended (spec §2) —
  // any match is castable subject to affordability, checked below; the
  // classic path still requires a non-expended entry. Mirrors castSpell's own
  // lookup exactly.
  const channelling = channellingActive(actor, key);
  const entry = channelling
    ? list.find((m) => m.spellItemId === spellItemId)
    : list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  // Afford-check BEFORE any state is built or written — a failed check aborts
  // with no side effects, same as every other cast entry point.
  let channellingSpent: number | null = null;
  const preDeductionSp = actor.system.spellcasting[key].channelling.current ?? 0;
  if (channelling) {
    channellingSpent = tryChannellingSpend(actor, key, entry.spellLevel, entry.magickType ?? "fixed", entry.theurgyScope ?? "major");
    if (channellingSpent === null) return;
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
  // PHB p.86: the spell is committed when casting begins — a disruption loses
  // it. For a channelling caster "committed" means the SP is spent NOW (Sub-
  // project 14 Plan B) instead of the memorized entry being marked expended;
  // completeCasting/disruptCasting need no further changes either way.
  await actor.update({
    ...(channelling
      ? { [`system.spellcasting.${key}.channelling.current`]: channellingSpent }
      : {
          [`system.spellcasting.${key}.memorized`]: list.map((m) =>
            m.spellItemId === spellItemId ? { ...m, expended: true } : m,
          ),
        }),
    "system.options.spellsAndMagic.casting": casting,
  });
  await postNotice(actor, spell, "begin", casting);
  if (channelling) {
    const resolvedTier = await applyCastFatigue(actor, key, entry.spellLevel, preDeductionSp);
    if (resolvedTier === "mortal") await resolveMortalFatigue(actor);
  }
  if (plan.mode === "segments" && plan.initiativeAdd > 0) {
    try {
      let wrote = false;
      let applied = 0;
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
          applied = plan.initiativeAdd;
        } else {
          // (c) the caster hasn't acted yet and isn't current: v14's default (pin to the current
          // combatant, who isn't the caster) already leaves the pointer untouched.
          await ctx.combatant.update({ initiative: newInitiative });
          wrote = true;
          applied = plan.initiativeAdd;
        }
      } else {
        await ctx.combatant.update({ [`flags.${SYSTEM_ID}.castingSegments`]: plan.initiativeAdd });
        wrote = true;
      }
      if (applied > 0) await actor.update({ "system.options.spellsAndMagic.casting.initiativeApplied": applied });
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

/** Takes back the segments a begun cast added to the caster's rolled initiative — only within the round it began (a later round has re-rolled). */
async function restoreInitiative(actor: CastingActor, casting: CastingState): Promise<void> {
  const applied = casting.initiativeApplied ?? 0;
  if (applied <= 0) return;
  const combat = combats().find((c) => c.id === casting.combatId && c.started);
  const combatant = combat?.getCombatantsByActor(actor)[0];
  if (!combat || !combatant || combat.round !== casting.startRound || typeof combatant.initiative !== "number") return;
  try {
    const initiative = combatant.initiative - applied;
    // As in castOrBegin: when the caster is the current combatant, pin the turn pointer where it is.
    if (combat.combatant?.id === combatant.id) await combatant.update({ initiative }, { combatTurn: combat.turn });
    else await combatant.update({ initiative });
    (actor as unknown as { sheet?: { render(force?: boolean): unknown } }).sheet?.render(false);
  } catch {
    // best effort — a stale slot only matters until the next initiative roll
  }
}

/** Disrupts (announce: posts "spell lost") or cancels the cast. The memorized entry stays expended either way. */
export async function disruptCasting(actor: CastingActor, opts: { announce: boolean }): Promise<void> {
  const casting = readCasting(actor);
  // Two near-simultaneous disruptions (e.g. damage and a failed save) both read the cast before
  // either clears it; the in-flight guard lets only the first through, so one "spell lost" card.
  if (!casting || disrupting.has(actor.id)) return;
  disrupting.add(actor.id);
  try {
    await actor.update({ "system.options.spellsAndMagic.casting": null });
    if (opts.announce) await postNotice(actor, actor.items.get(casting.spellItemId), "lost", casting);
    await clearCombatantFlag(casting.combatId, actor);
    await restoreInitiative(actor, casting);
  } finally {
    disrupting.delete(actor.id);
  }
}

const disrupting = new Set<string>();

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
