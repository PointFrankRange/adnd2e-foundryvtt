import { RELAY_QUERY, type RelayRequest, type RelayResult } from "../combat/apply-relay";
import { applyEffectLocally, type EffectTarget } from "./apply-effect";

/* Routes a player-applied effect: GM or owner → applied here, exactly as before;
 * otherwise relayed to the active GM through v14's User#query
 * (client/documents/user.mjs:289-321). The relayed path never throws (failures
 * are warning toasts); the local GM/owner path propagates errors exactly as the
 * direct calls it replaced did. */

const TIMEOUT_MS = 120_000;

/** Returns whether the target actually changed — true for every case except a
 *  relayed/local `unequip` against an already-unarmed target (the only
 *  no-op-capable request kind today). A caller that posted a chat card
 *  BEFORE the effect resolved (e.g. a maneuver's "Disarm succeeds!" line,
 *  necessarily written before the relay round-trip, possibly before the GM
 *  even responds) can use this to correct that card afterward — this
 *  function's own info toast alone isn't a durable record; the chat log is.
 *  True is also returned for every early-return guard (no GM connected, a
 *  degenerate 0-amount request) — those already have their own warning, or
 *  need none, so they're not additionally reported as "no effect." */
export async function requestApply(
  target: EffectTarget & { uuid: string; isOwner: boolean },
  request: RelayRequest,
): Promise<boolean> {
  const g = game as unknown as {
    user: { isGM: boolean };
    users: { activeGM: { query(name: string, data: unknown, opts: { timeout: number }): Promise<unknown> } | null };
  };
  if (g.user.isGM || target.isOwner) {
    const changed = await applyEffectLocally(target, request);
    if (!changed) ui.notifications?.info(game.i18n!.localize("ADND2E.relay.noEffectInfo"));
    return changed;
  }
  if ((request.kind === "damage" || request.kind === "healing") && request.amount < 1) return true;
  const gm = g.users.activeGM;
  if (!gm) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.relay.noGmWarning"));
    return true;
  }
  try {
    const result = (await gm.query(RELAY_QUERY, request, { timeout: TIMEOUT_MS })) as RelayResult | undefined;
    if (result?.applied) {
      if (!result.changed) ui.notifications?.info(game.i18n!.localize("ADND2E.relay.noEffectInfo"));
      return result.changed;
    }
    const key = result && !result.applied && result.reason === "declined" ? "ADND2E.relay.declinedWarning" : "ADND2E.relay.failedWarning";
    ui.notifications?.warn(game.i18n!.localize(key));
    return true;
  } catch {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.relay.failedWarning"));
    return true;
  }
}
