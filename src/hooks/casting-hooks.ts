import { SYSTEM_ID } from "../constants";
import { expandedCastingTimeEnabled, hpChangeDisrupts } from "../core/magic/casting-time";
import { getOptionalRules } from "../settings";
import { disruptCasting, readCasting } from "../sheets/character/casting-actions";

/* ---------------------------------------------------------------------------
 * casting-hooks — SP9a. Automatic spell disruption (PHB p.86) and cleanup.
 *
 * Every handler runs ONLY on the active GM's client (`game.user.isActiveGM`,
 * v14.364 client/documents/user.mjs:86), so it works whoever applied the damage
 * or rolled the save, and never asks a player for permissions they lack.
 * Registered once from the `ready` hook.
 * ------------------------------------------------------------------------- */

const isActiveGm = (): boolean => Boolean((game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM);
const ruleOn = (): boolean => expandedCastingTimeEnabled(getOptionalRules());

export function registerCastingHooks(): void {
  // Hit-point loss while casting disrupts; healing raises the recorded value.
  Hooks.on("updateActor", (actor: unknown, changed: unknown) => {
    if (!isActiveGm() || !ruleOn()) return;
    const doc = actor as Parameters<typeof readCasting>[0] & { update(d: Record<string, unknown>): Promise<unknown> };
    const casting = readCasting(doc);
    if (!casting) return;
    const newHp = foundry.utils.getProperty(changed as object, "system.attributes.hp.value");
    if (typeof newHp !== "number") return;
    if (hpChangeDisrupts(casting.hp, newHp)) void disruptCasting(doc as never, { announce: true });
    else if (newHp > casting.hp) void doc.update({ "system.options.spellsAndMagic.casting.hp": newHp });
  });

  // A failed saving throw while casting disrupts (the save card is flagged by rollSave).
  Hooks.on("createChatMessage", (message: unknown) => {
    if (!isActiveGm() || !ruleOn()) return;
    const flag = (message as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "save") as
      | { actorUuid?: string; success?: boolean }
      | undefined;
    if (!flag || flag.success !== false || !flag.actorUuid) return;
    const actor = foundry.utils.fromUuidSync(flag.actorUuid) as Parameters<typeof readCasting>[0] | null;
    if (actor && readCasting(actor)) void disruptCasting(actor as never, { announce: true });
  });

  // Ending a combat clears every cast that belonged to it (no card — nothing was disrupted).
  Hooks.on("deleteCombat", (combat: unknown) => {
    if (!isActiveGm()) return;
    const c = combat as { id: string; combatants: Iterable<{ actor: unknown }> };
    for (const combatant of c.combatants) {
      const actor = combatant.actor as (Parameters<typeof readCasting>[0] & { update(d: Record<string, unknown>): Promise<unknown> }) | null;
      if (actor && readCasting(actor)?.combatId === c.id) {
        void actor.update({ "system.options.spellsAndMagic.casting": null });
      }
    }
  });
}
