import { SYSTEM_ID } from "../constants";
import { applyContestTangents, type ContestFlag } from "../sheets/character/psionic-combat";

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

const touchesApplied = (changes: Record<string, unknown>): boolean => {
  const nested = (changes.flags as Record<string, Record<string, unknown> | undefined> | undefined)?.[SYSTEM_ID];
  return (nested !== undefined && "psionicApplied" in nested) || `flags.${SYSTEM_ID}.psionicApplied` in changes;
};

export function registerPsionicHooks(): void {
  Hooks.on("updateActor", (actor: unknown, changes: unknown) => {
    if (touchesApplied(changes as Record<string, unknown>)) rerenderContestCards((actor as { uuid: string }).uuid);
  });
  Hooks.on("createChatMessage", (message: unknown) => {
    const contest = (message as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
    if (!contest || contest.state !== "resolved" || contest.applied === true) return;
    if (contest.attackerUserId !== game.user?.id) return;
    void applyContestTangents(contest);
  });
}
