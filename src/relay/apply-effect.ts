import { hpDamageUpdate, hpHealingUpdate, type RelayRequest } from "../combat/apply-relay";

/* The single place each player-applicable effect is performed on a target actor —
 * used locally (GM / owner) and by the GM query handler. Foundry glue. */

export interface EffectTarget {
  system: { attributes: { hp: { value: number; max: number; temp?: number } } };
  items: Iterable<{ type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }>;
  update(d: Record<string, unknown>): Promise<unknown>;
  toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
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
      await actor.toggleStatusEffect(request.conditionId, { active: true });
      return true;
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
