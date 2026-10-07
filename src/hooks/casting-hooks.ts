import { SYSTEM_ID } from "../constants";
import { expandedCastingTimeEnabled, hpChangeDisrupts } from "../core/magic/casting-time";
import { getOptionalRules } from "../settings";
import { disruptCasting, readCasting } from "../sheets/character/casting-actions";

/* ---------------------------------------------------------------------------
 * casting-hooks — SP9a. Automatic spell disruption (PHB p.86) and cleanup.
 *
 * The disruption handlers run on ONE client: the active GM's (`game.user.isActiveGM`,
 * v14.364 client/documents/user.mjs:86), so it works whoever applied the damage
 * or rolled the save; with no GM connected, the designated connected owner of the
 * caster (see handlesDisruption). The combat-cleanup handlers are GM-only.
 * Registered once from the `ready` hook.
 * ------------------------------------------------------------------------- */

interface DesignatedUsers {
  activeGM: unknown;
  getDesignatedUser(condition: (user: { active: boolean }) => boolean): unknown;
}

/**
 * Whether THIS client reacts to a change on `actor`: the active GM when one is connected; with no GM,
 * the designated connected owner of that actor, so exactly one client acts (v14.364 users.mjs:70-90).
 */
const handlesDisruption = (actor: unknown): boolean => {
  const users = game.users as unknown as DesignatedUsers;
  if (users.activeGM) return Boolean((game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM);
  const doc = actor as { testUserPermission(user: unknown, level: string): boolean };
  return users.getDesignatedUser((u) => u.active && doc.testUserPermission(u, "OWNER")) === game.user;
};
const isActiveGm = (): boolean => Boolean((game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM);
const ruleOn = (): boolean => expandedCastingTimeEnabled(getOptionalRules());

export function registerCastingHooks(): void {
  // Hit-point loss while casting disrupts; healing raises the recorded value.
  Hooks.on("updateActor", (actor: unknown, changed: unknown) => {
    if (!ruleOn() || !handlesDisruption(actor)) return;
    const doc = actor as Parameters<typeof readCasting>[0] & { update(d: Record<string, unknown>): Promise<unknown> };
    const casting = readCasting(doc);
    if (!casting) return;
    const newHp = foundry.utils.getProperty(changed as object, "system.attributes.hp.value");
    if (typeof newHp !== "number") return;
    if (hpChangeDisrupts(casting.hp, newHp)) void disruptCasting(doc as never, { announce: true });
    else if (newHp > casting.hp) void doc.update({ "system.options.spellsAndMagic.casting.hp": newHp }).catch(() => {});
  });

  // A failed saving throw while casting disrupts (the save card is flagged by rollSave).
  Hooks.on("createChatMessage", (message: unknown) => {
    if (!ruleOn()) return;
    const flag = (message as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "save") as
      | { actorUuid?: string; success?: boolean }
      | undefined;
    if (!flag || flag.success !== false || !flag.actorUuid) return;
    const actor = foundry.utils.fromUuidSync(flag.actorUuid) as Parameters<typeof readCasting>[0] | null;
    if (actor && readCasting(actor) && handlesDisruption(actor)) void disruptCasting(actor as never, { announce: true });
  });

  // A combatant removed from a running combat loses its cast with it (no card — nothing was disrupted).
  Hooks.on("deleteCombatant", (combatant: unknown) => {
    if (!isActiveGm()) return;
    const c = combatant as { actor: unknown; combat?: { id: string } | null; parent?: { id: string } | null };
    const actor = c.actor as (Parameters<typeof readCasting>[0] & { update(d: Record<string, unknown>): Promise<unknown> }) | null;
    const combatId = (c.combat ?? c.parent)?.id;
    if (actor && combatId && readCasting(actor)?.combatId === combatId) {
      void actor.update({ "system.options.spellsAndMagic.casting": null });
    }
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
