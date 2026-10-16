import { SYSTEM_ID } from "../../constants";
import { getOptionalRules } from "../../settings";
import { isDefenseMode } from "../../core/psionics/combat";
import { noteInitiation as noteInitiationPure, roundUpkeep, type PowerRound } from "../../core/psionics/round";

/* Issue #179: the Foundry glue for round-based psionic bookkeeping. */

interface CombatantLike {
  actor: unknown;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}
interface CombatLike {
  id: string;
  started: boolean;
  round: number;
  combatants: Iterable<CombatantLike & { actor: PsionicRoundActor | null }>;
  getCombatantsByActor(actor: unknown): CombatantLike[];
}

export interface PsionicRoundActor {
  name: string;
  system: { psionics?: { level: number; psp: number | null; max: number; maintained: { powerId: string }[]; contacts?: { tangents: number }[] } };
  items: Iterable<{ id: string; name: string; type: string; system: Record<string, unknown> }>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

const combats = (): CombatLike[] => [...((game as unknown as { combats?: Iterable<CombatLike> }).combats ?? [])];

/**
 * A power was initiated: tally it on the actor's combatant for this round. Returns whether the actor is in a
 * started combat (the card then reminds about half movement) and warns when it is a second power in the round.
 * Defense modes never count. Writes only the actor's own combatant flag.
 */
export async function noteInitiation(actor: unknown, power: { name: string; system: Record<string, unknown> }): Promise<{ inCombat: boolean }> {
  for (const combat of combats()) {
    if (!combat.started) continue;
    const combatant = combat.getCombatantsByActor(actor)[0];
    if (!combatant) continue;
    const counts = power.system.kind !== "defense" && !isDefenseMode(power.name);
    const prev = (combatant.getFlag(SYSTEM_ID, "psionicRound") as PowerRound | undefined) ?? null;
    const { next, second } = noteInitiationPure(prev, combat.id, combat.round, counts);
    if (next !== prev) await combatant.setFlag(SYSTEM_ID, "psionicRound", next);
    if (second) ui.notifications?.warn(game.i18n!.format("ADND2E.sheet.psionics.combat.secondPower", { name: (actor as { name: string }).name }));
    return { inCombat: true };
  }
  return { inCombat: false };
}

/** The new combat round has begun: pay every combatant's per-round upkeep (the GM's client only; see the hook). */
export async function payRoundUpkeep(combat: CombatLike, round: number): Promise<void> {
  const lines: string[] = [];
  const i18n = game.i18n!;
  for (const c of combat.combatants) {
    const actor = c.actor;
    const p = actor?.system.psionics;
    if (!actor || !p || p.level <= 0) continue;
    const power = (id: string) => [...actor.items].find((i) => i.id === id && i.type === "power");
    const maintained = p.maintained.flatMap((m) => {
      const item = power(m.powerId);
      return item ? [{ powerId: m.powerId, name: item.name, cost: Number(item.system.maintenanceCost ?? 0), unit: String(item.system.maintenanceUnit ?? "none") }] : [];
    });
    const partial = (p.contacts ?? []).some((t) => t.tangents > 0 && t.tangents < 3);
    if (!maintained.some((m) => m.unit === "round") && !partial) continue;
    const result = roundUpkeep({ pool: Math.min(p.psp ?? p.max, p.max), maintained, partialTangents: partial });
    const update: Record<string, unknown> = { "system.psionics.psp": result.pool };
    if (result.ended.length > 0) update["system.psionics.maintained"] = p.maintained.filter((m) => !result.ended.some((e) => e.powerId === m.powerId));
    if (result.tangentsBroken) update["system.psionics.contacts"] = (p.contacts ?? []).filter((t) => t.tangents >= 3);
    await actor.update(update);
    if (result.paid > 0) lines.push(i18n.format("ADND2E.chat.psionicContest.upkeepPaid", { name: actor.name, paid: String(result.paid) }));
    for (const e of result.ended) lines.push(i18n.format("ADND2E.chat.psionicContest.upkeepEnded", { name: actor.name, power: e.name }));
    if (result.tangentsBroken) lines.push(i18n.format("ADND2E.chat.psionicContest.upkeepBroken", { name: actor.name }));
  }
  if (lines.length === 0) return;
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const title = i18n.format("ADND2E.chat.psionicContest.upkeepTitle", { round: String(round) });
  await ChatMessage.create({ content: `<div class="adnd2e chat-card psionic-upkeep"><header><h3>${esc(title)}</h3></header>${lines.map((l) => `<p class="check">${esc(l)}</p>`).join("")}</div>` } as never);
}

/** `updateCombat`: the round advanced (not the first round, not a step back) with the rule on, on the one active GM. */
export async function onCombatUpdate(combat: CombatLike, changed: { round?: number }, options: { direction?: number }): Promise<void> {
  if (typeof changed.round !== "number" || changed.round <= 1 || (options.direction ?? 0) <= 0) return;
  if (!getOptionalRules().psionicAutoUpkeep) return;
  const g = game as unknown as { user: { id: string }; users: { activeGM?: { id: string } | null } };
  if (g.users.activeGM?.id !== g.user.id) return;
  await payRoundUpkeep(combat, changed.round);
}
