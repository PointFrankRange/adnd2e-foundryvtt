import { hpDamageUpdate, hpHealingUpdate, type RelayRequest } from "../combat/apply-relay";
import { conditionDuration } from "../combat/condition-effects";
import { SYSTEM_ID } from "../constants";
import { GRAPPLE_FLAG } from "../combat/grapple-state";
import { temporaryDamage } from "../core/wrestling";

/* The single place each player-applicable effect is performed on a target actor —
 * used locally (GM / owner) and by the GM query handler. Foundry glue. */

export interface EffectTarget {
  system: { attributes: { hp: { value: number; max: number; temp?: number; nonlethal?: number } } };
  items: Iterable<{ type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }>;
  update(d: Record<string, unknown>): Promise<unknown>;
  toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
  effects?: Iterable<{
    id: string;
    statuses: ReadonlySet<string>;
    getFlag(scope: string, key: string): unknown;
    update(d: Record<string, unknown>): Promise<unknown>;
  }>;
  deleteEmbeddedDocuments?(name: string, ids: string[]): Promise<unknown>;
}

interface DurationEffect {
  update(d: Record<string, unknown>): Promise<unknown>;
}
interface CombatLike {
  started: boolean;
  turn: number | null;
  turns: { id: string }[];
  getCombatantsByActor(actor: unknown): { id: string }[];
}

/** #94: gives a freshly created condition effect its duration, anchored to the TARGET's own turn (Foundry
 *  anchors expiry to whoever was acting when the effect was created — the attacker). `created` is toggleStatusEffect's
 *  result: the new effect, or `true` when the condition was already present (left as is). Best effort: a failure
 *  only leaves the condition indefinite, like a hand-applied one. */
async function applyConditionDuration(actor: unknown, conditionId: string, created: unknown): Promise<void> {
  if (!created || typeof created !== "object") return;
  const combat = (game as unknown as { combat?: CombatLike | null }).combat;
  const live = combat?.started ? combat : null;
  const combatant = live?.getCombatantsByActor(actor)[0];
  const index = combatant ? live!.turns.findIndex((t) => t.id === combatant.id) : -1;
  const hasActed = index >= 0 && live!.turn !== null && index <= live!.turn;
  const duration = conditionDuration(conditionId, hasActed);
  if (!duration) return;
  try {
    await (created as DurationEffect).update({ duration, ...(combatant ? { "start.combatant": combatant.id } : {}) });
  } catch {
    // best effort
  }
}

/** Returns whether the target actually changed — always true for
 *  damage/healing/condition (they always write something), but `unequip` is
 *  a genuine no-op against an unarmed target (nothing equipped to remove).
 *  The caller (relay-handler.ts) uses this to log an accurate GM-whisper
 *  message instead of always claiming the effect was "applied." */
export async function applyEffectLocally(actor: EffectTarget, request: RelayRequest): Promise<boolean> {
  switch (request.kind) {
    case "damage":
      await actor.update(hpDamageUpdate(actor.system.attributes.hp, request.amount));
      return true;
    case "healing":
      await actor.update(hpHealingUpdate(actor.system.attributes.hp, request.amount));
      return true;
    case "condition":
      await applyConditionDuration(actor, request.conditionId, await actor.toggleStatusEffect(request.conditionId, { active: true }));
      return true;
    case "destroy":
      await actor.update({ "system.attributes.hp.value": 0 });
      await actor.toggleStatusEffect("dead", { active: true });
      return true;
    case "grapple": {
      if (request.damage > 0) {
        const r = temporaryDamage({ value: actor.system.attributes.hp.value, nonlethal: actor.system.attributes.hp.nonlethal ?? 0 }, request.damage);
        await actor.update({ "system.attributes.hp.value": r.value, "system.attributes.hp.nonlethal": r.nonlethal });
        if (r.unconscious) await actor.toggleStatusEffect("unconscious", { active: true });
      }
      if (request.prone) await actor.toggleStatusEffect("prone", { active: true });
      const wrestling = () => [...(actor.effects ?? [])].filter((e) => (e.statuses.has("held") || e.statuses.has("grappling")) && e.getFlag(SYSTEM_ID, GRAPPLE_FLAG) !== undefined);
      if (request.set === null) {
        const ids = wrestling().map((e) => e.id);
        if (ids.length > 0) await actor.deleteEmbeddedDocuments?.("ActiveEffect", ids);
        return true;
      }
      const conditionId = request.set.role === "holder" ? "grappling" : "held";
      // Switching roles (a critical swap) leaves the OLD role's effect behind: remove it first.
      const stale = wrestling().filter((e) => !e.statuses.has(conditionId)).map((e) => e.id);
      if (stale.length > 0) await actor.deleteEmbeddedDocuments?.("ActiveEffect", stale);
      const toggled = await actor.toggleStatusEffect(conditionId, { active: true });
      // Foundry only treats a SINGLE-status effect as "the" status effect: use the one it just created, else the existing one.
      const effect =
        toggled && typeof toggled === "object"
          ? (toggled as { update(d: Record<string, unknown>): Promise<unknown> })
          : [...(actor.effects ?? [])].find((e) => e.statuses.size === 1 && e.statuses.has(conditionId));
      if (!effect) return false;
      await effect.update({ [`flags.${SYSTEM_ID}.${GRAPPLE_FLAG}`]: request.set });
      return true;
    }
    case "unequip":
      // the target's FIRST equipped weapon (Plan 7d's first-member-wins rule); unarmed = no-op
      for (const item of actor.items) {
        if (item.type === "weapon" && item.system.equipped) {
          await item.update({ "system.equipped": false });
          return true;
        }
      }
      return false;
  }
}
