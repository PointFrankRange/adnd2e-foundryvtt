import { RELAY_QUERY, type RelayRequest, type RelayResult } from "../combat/apply-relay";
import { applyEffectLocally, type EffectTarget } from "./apply-effect";

/* Routes a player-applied effect: GM or owner → applied here, exactly as before;
 * otherwise relayed to the active GM through v14's User#query
 * (client/documents/user.mjs:289-321). The relayed path never throws (failures
 * are warning toasts); the local GM/owner path propagates errors exactly as the
 * direct calls it replaced did. */

const TIMEOUT_MS = 120_000;

export async function requestApply(
  target: EffectTarget & { uuid: string; isOwner: boolean },
  request: RelayRequest,
): Promise<void> {
  const g = game as unknown as {
    user: { isGM: boolean };
    users: { activeGM: { query(name: string, data: unknown, opts: { timeout: number }): Promise<unknown> } | null };
  };
  if (g.user.isGM || target.isOwner) {
    const changed = await applyEffectLocally(target, request);
    if (!changed) ui.notifications?.info(game.i18n!.localize("ADND2E.relay.noEffectInfo"));
    return;
  }
  if ((request.kind === "damage" || request.kind === "healing") && request.amount < 1) return;
  const gm = g.users.activeGM;
  if (!gm) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.relay.noGmWarning"));
    return;
  }
  try {
    const result = (await gm.query(RELAY_QUERY, request, { timeout: TIMEOUT_MS })) as RelayResult | undefined;
    if (result?.applied) {
      if (!result.changed) ui.notifications?.info(game.i18n!.localize("ADND2E.relay.noEffectInfo"));
      return;
    }
    const key = result && !result.applied && result.reason === "declined" ? "ADND2E.relay.declinedWarning" : "ADND2E.relay.failedWarning";
    ui.notifications?.warn(game.i18n!.localize(key));
  } catch {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.relay.failedWarning"));
  }
}
