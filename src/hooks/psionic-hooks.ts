import { SYSTEM_ID } from "../constants";
import { anyIncapacitating } from "../combat/condition-effects";
import { applyContestTangents, type ContestFlag } from "../sheets/character/psionic-combat";
import type { WildFlag } from "../sheets/character/psionic-wild";
import { hpChangeDisrupts } from "../core/magic/casting-time";
import { getOptionalRules } from "../settings";
import { handlesDisruption } from "./casting-hooks";
import { disruptPreparation, readPreparing } from "../sheets/character/psionic-prep";
import { endFocus, expireProficiencyEffects } from "../sheets/character/psionic-proficiencies";
import { onCombatUpdate } from "../sheets/character/psionic-round";

/* SP15 Plan C - the psychic-contest result hook. When a defender's roll resolves a
 * pending contest card, the ATTACKER's client (and only it) records the tangents on
 * the attacker's own actor, once per contest id. Immediate contests are flagged
 * `applied` (the attack action already wrote the contacts) and are skipped. */

/** Re-renders every contest card of one attacker in this client's chat log, so the card
 *  re-runs its renderChatMessageHTML wiring (Foundry v14: ChatLog#updateMessage, which
 *  re-renders the existing message element). Chat cards are authored by another user and
 *  cannot be edited here, so the "recorded" state is refreshed client-side. */
export function rerenderContestCards(attackerActorUuid: string): void {
  const messages = (game.messages?.contents ?? []) as unknown as { getFlag(scope: string, key: string): unknown }[];
  for (const m of messages) {
    const c = m.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
    if (c?.attackerActorUuid === attackerActorUuid) void (ui.chat as unknown as { updateMessage?(m: unknown): Promise<void> } | undefined)?.updateMessage?.(m);
  }
}

/** Issue #178: re-renders every still-pending contest card, so the attacker's offline-defender fallback appears (or goes away) as users connect and disconnect. */
export function rerenderPendingContestCards(): void {
  const messages = (game.messages?.contents ?? []) as unknown as { getFlag(scope: string, key: string): unknown }[];
  for (const m of messages) {
    const c = m.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
    if (c?.state === "pending") void (ui.chat as unknown as { updateMessage?(m: unknown): Promise<void> } | undefined)?.updateMessage?.(m);
  }
}

/** Re-renders every wild-talent card of one actor (SP15 Plan D) so a just-applied dire result shows "Applied.". */
export function rerenderWildCards(actorUuid: string): void {
  const messages = (game.messages?.contents ?? []) as unknown as { getFlag(scope: string, key: string): unknown }[];
  for (const m of messages) {
    const c = m.getFlag(SYSTEM_ID, "wildTalent") as WildFlag | undefined;
    if (c?.actorUuid === actorUuid) void (ui.chat as unknown as { updateMessage?(m: unknown): Promise<void> } | undefined)?.updateMessage?.(m);
  }
}

const touchesFlag = (changes: Record<string, unknown>, key: string): boolean => {
  const nested = (changes.flags as Record<string, Record<string, unknown> | undefined> | undefined)?.[SYSTEM_ID];
  return (nested !== undefined && key in nested) || `flags.${SYSTEM_ID}.${key}` in changes;
};

export function registerPsionicHooks(): void {
  // issue #179: automatic per-round upkeep (optional rule; the active GM's client only)
  Hooks.on("updateCombat", (combat: unknown, changed: unknown, options: unknown) => {
    void onCombatUpdate(combat as never, changed as never, options as never);
  });
  Hooks.on("userConnected", () => rerenderPendingContestCards());
  // issue #180: a Harness Subconscious boost and a Meditative Focus end with the world time (the active GM's client only)
  Hooks.on("updateWorldTime", (worldTime: number) => {
    const g = game as unknown as { user: { id: string }; users: { activeGM?: { id: string } | null }; actors: Iterable<unknown> };
    if (g.users.activeGM?.id !== g.user.id) return;
    void expireProficiencyEffects(g.actors as never, worldTime);
  });
  Hooks.on("updateActor", (actor: unknown, changes: unknown, _options?: unknown, userId?: string) => {
    const uuid = (actor as { uuid: string }).uuid;
    // issue #180: a Meditative Focus ends when the PSPs reach 0 (the client that spent them clears it)
    const c = changes as { system?: { psionics?: { psp?: unknown } } } & Record<string, unknown>;
    const spentToZero = c.system?.psionics?.psp === 0 || c["system.psionics.psp"] === 0;
    const focused = ((actor as { system?: { psionics?: { focus?: { discipline?: string } } } }).system?.psionics?.focus?.discipline ?? "") !== "";
    if (spentToZero && focused && userId === game.user?.id) void endFocus(actor as never);
    // issue #179: hit points lost while preparing a power disrupt it; healing raises the recorded value (the one disrupting client acts)
    const newHp = (changes as { system?: { attributes?: { hp?: { value?: unknown } } } }).system?.attributes?.hp?.value;
    const prep = readPreparing(actor as never);
    if (typeof newHp === "number" && prep && getOptionalRules().psionicPrepTimes && handlesDisruption(actor)) {
      if (hpChangeDisrupts(prep.hp, newHp)) void disruptPreparation(actor as never, { announce: true });
      else if (newHp > prep.hp) void (actor as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.psionics.preparing.hp": newHp }).catch(() => {});
    }
    if (touchesFlag(changes as Record<string, unknown>, "psionicApplied")) rerenderContestCards(uuid);
    if (touchesFlag(changes as Record<string, unknown>, "wildApplied")) rerenderWildCards(uuid);
  });
  // p.27: tangents (full contacts included) are broken when the attacker is incapacitated. Only the client that
  // applied the condition writes, once, on the incapacitated actor itself.
  Hooks.on("createActiveEffect", (effect: unknown, _options: unknown, userId: string) => {
    if (userId !== game.user?.id) return;
    const e = effect as { statuses?: Iterable<string>; parent?: { documentName?: string; name?: string; system?: { psionics?: { contacts?: unknown[] } }; update?(d: Record<string, unknown>): Promise<unknown> } };
    const actor = e.parent;
    if (!actor || actor.documentName !== "Actor" || !actor.update) return;
    if ((actor.system?.psionics?.contacts ?? []).length === 0) return;
    if (!anyIncapacitating(e.statuses ?? [])) return;
    void actor.update({ "system.psionics.contacts": [] }).then(() => {
      ui.notifications?.info(game.i18n!.format("ADND2E.sheet.psionics.combat.incapacitatedBroken", { name: actor.name ?? "" }));
    });
  });
  // issue #179: a combatant removed from a combat, or the combat itself ending, drops any preparation that belonged to it (no card)
  Hooks.on("deleteCombatant", (combatant: unknown) => {
    const g = game as unknown as { user?: { isActiveGM?: boolean } };
    if (!g.user?.isActiveGM) return;
    const c = combatant as { actor: unknown; combat?: { id: string } | null; parent?: { id: string } | null };
    const combatId = (c.combat ?? c.parent)?.id;
    const prep = c.actor ? readPreparing(c.actor as never) : null;
    if (prep && combatId && prep.combatId === combatId) void (c.actor as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.psionics.preparing.powerId": "" });
  });
  Hooks.on("deleteCombat", (combat: unknown) => {
    const g = game as unknown as { user?: { isActiveGM?: boolean } };
    if (!g.user?.isActiveGM) return;
    const c = combat as { id: string; combatants: Iterable<{ actor: unknown }> };
    for (const combatant of c.combatants) {
      const prep = combatant.actor ? readPreparing(combatant.actor as never) : null;
      if (prep && prep.combatId === c.id) void (combatant.actor as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.psionics.preparing.powerId": "" });
    }
  });
  Hooks.on("createChatMessage", (message: unknown) => {
    // issue #179: a failed saving throw while preparing disrupts (the save card is flagged by rollSave)
    const saveFlag = (message as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "save") as { actorUuid?: string; success?: boolean } | undefined;
    if (saveFlag && saveFlag.success === false && saveFlag.actorUuid && getOptionalRules().psionicPrepTimes) {
      const saver = foundry.utils.fromUuidSync(saveFlag.actorUuid) as { id?: string } | null;
      if (saver && readPreparing(saver as never) && handlesDisruption(saver)) void disruptPreparation(saver as never, { announce: true });
    }
    const contest = (message as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
    if (!contest || contest.state !== "resolved" || contest.applied === true) return;
    if (contest.attackerUserId !== game.user?.id) return;
    void applyContestTangents(contest);
  });
}
