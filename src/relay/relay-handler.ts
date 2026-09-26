import { RELAY_QUERY, relayEffectText, validateRelayRequest, type RelayResult } from "../combat/apply-relay";
import { getPlayerApplyMode } from "../settings";
import { applyEffectLocally, type EffectTarget } from "./apply-effect";

/* The GM side of the relay: CONFIG.queries["adnd2e.applyEffect"]. v14 runs the
 * handler on the queried user's client with (data, { user, timeout })
 * (client/documents/collections/users.mjs:218-240); a thrown error rejects the
 * player's query. Trusts nothing: re-validates, re-resolves the target, and only
 * acts on the active GM's client. */

async function handleApplyQuery(data: unknown, context: { user: { name: string } }): Promise<RelayResult> {
  const self = game.user as unknown as { isActiveGM?: boolean };
  if (!self.isActiveGM) return { applied: false, reason: "notActiveGm" };
  const request = validateRelayRequest(data);
  if (!request) throw new Error("Invalid adnd2e.applyEffect request");
  const target = (await fromUuid(request.targetUuid)) as unknown as (EffectTarget & { documentName?: string; name: string }) | null;
  if (!target || target.documentName !== "Actor") throw new Error("adnd2e.applyEffect target not found");

  const text = relayEffectText(request);
  const esc = foundry.utils.escapeHTML;
  const names = {
    user: esc(context.user.name),
    effect: game.i18n!.format(text.key, text.data as Record<string, string>),
    target: esc(target.name),
  };
  if (getPlayerApplyMode() === "approve") {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n!.localize("ADND2E.relay.approveTitle") },
      content: `<p>${game.i18n!.format("ADND2E.relay.approvePrompt", names)}</p>`,
    } as never);
    if (ok !== true) return { applied: false, reason: "declined" };
  }

  await applyEffectLocally(target, request);
  const recipients = (ChatMessage as unknown as { getWhisperRecipients(name: string): { id: string }[] })
    .getWhisperRecipients("GM")
    .map((u) => u.id);
  await ChatMessage.create({
    content: `<p>${game.i18n!.format("ADND2E.relay.log", names)}</p>`,
    whisper: recipients,
  } as unknown as ChatMessage.CreateData);
  return { applied: true };
}

/** Registers the relay query. Call once, on `init`. */
export function registerRelayQuery(): void {
  (CONFIG as unknown as { queries: Record<string, unknown> }).queries[RELAY_QUERY] = handleApplyQuery;
}
