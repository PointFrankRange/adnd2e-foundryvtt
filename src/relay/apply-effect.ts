import { hpDamageUpdate, hpHealingUpdate, type RelayRequest } from "../combat/apply-relay";

/* The single place each player-applicable effect is performed on a target actor —
 * used locally (GM / owner) and by the GM query handler. Foundry glue. */

export interface EffectTarget {
  system: { attributes: { hp: { value: number; max: number; temp?: number } } };
  items: Iterable<{ type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }>;
  update(d: Record<string, unknown>): Promise<unknown>;
  toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
}

export async function applyEffectLocally(actor: EffectTarget, request: RelayRequest): Promise<void> {
  switch (request.kind) {
    case "damage":
      await actor.update(hpDamageUpdate(actor.system.attributes.hp, request.amount));
      return;
    case "healing":
      await actor.update(hpHealingUpdate(actor.system.attributes.hp, request.amount));
      return;
    case "condition":
      await actor.toggleStatusEffect(request.conditionId, { active: true });
      return;
    case "unequip":
      // the target's FIRST equipped weapon (Plan 7d's first-member-wins rule); unarmed = no-op
      for (const item of actor.items) {
        if (item.type === "weapon" && item.system.equipped) {
          await item.update({ "system.equipped": false });
          return;
        }
      }
      return;
  }
}
