// Player-applied damage & effects relay (post-SP9). The request a player's
// client sends to the active GM when it can't modify a target itself, the
// strict validator the GM handler runs on it, and the HP arithmetic shared by
// the local and relayed paths (moved verbatim from chat/chat-listeners.ts so
// the two can't drift). Pure — no Foundry imports.

export const RELAY_QUERY = "adnd2e.applyEffect";

/** The conditions a maneuver may relay (Plan 7d's called shots + grapple). */
export const RELAY_CONDITIONS = ["stunned", "prone", "held"] as const;
export type RelayConditionId = (typeof RELAY_CONDITIONS)[number];

export const PLAYER_APPLY_MODES = ["auto", "approve"] as const;
export type PlayerApplyMode = (typeof PLAYER_APPLY_MODES)[number];
export const DEFAULT_PLAYER_APPLY_MODE: PlayerApplyMode = "auto";

const MAX_AMOUNT = 999;

export type RelayRequest =
  | { kind: "damage"; targetUuid: string; amount: number }
  | { kind: "healing"; targetUuid: string; amount: number }
  | { kind: "condition"; targetUuid: string; conditionId: RelayConditionId }
  | { kind: "unequip"; targetUuid: string };

export type RelayResult = { applied: true } | { applied: false; reason: "declined" | "notActiveGm" };

function isAmount(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_AMOUNT;
}

/** A clean, well-formed request, or null for anything malformed. The GM handler trusts nothing else. */
export function validateRelayRequest(raw: unknown): RelayRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const targetUuid = r.targetUuid;
  if (typeof targetUuid !== "string" || targetUuid === "") return null;
  switch (r.kind) {
    case "damage":
    case "healing":
      return isAmount(r.amount) ? { kind: r.kind, targetUuid, amount: r.amount } : null;
    case "condition":
      return (RELAY_CONDITIONS as readonly unknown[]).includes(r.conditionId)
        ? { kind: "condition", targetUuid, conditionId: r.conditionId as RelayConditionId }
        : null;
    case "unequip":
      return { kind: "unequip", targetUuid };
    default:
      return null;
  }
}

/** Damage: temp HP absorbs first; `temp` is written only when the hp object has that key. */
export function hpDamageUpdate(hp: { value: number; temp?: number }, amount: number): Record<string, number> {
  const temp = hp.temp ?? 0;
  const fromTemp = Math.min(temp, amount);
  const update: Record<string, number> = { "system.attributes.hp.value": hp.value - (amount - fromTemp) };
  if ("temp" in hp) update["system.attributes.hp.temp"] = temp - fromTemp;
  return update;
}

/** Healing: adds, capped at max. */
export function hpHealingUpdate(hp: { value: number; max: number }, amount: number): Record<string, number> {
  return { "system.attributes.hp.value": Math.min(hp.max, hp.value + amount) };
}

/** The i18n key + format data naming a request's effect (GM log line / approval prompt). */
export function relayEffectText(request: RelayRequest): { key: string; data: Record<string, string | number> } {
  switch (request.kind) {
    case "damage":
    case "healing":
      return { key: `ADND2E.relay.effect.${request.kind}`, data: { amount: request.amount } };
    case "condition":
      return { key: "ADND2E.relay.effect.condition", data: { condition: request.conditionId } };
    case "unequip":
      return { key: "ADND2E.relay.effect.unequip", data: {} };
  }
}
