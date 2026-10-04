import { SYSTEM_ID } from "../constants";

/* Ending a combat ends the encounter: clear every combatant's "has turned" flag.
 * Runs on the active GM's client only, like the casting hooks. */

const isActiveGm = (): boolean => Boolean((game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM);

export function registerTurningHooks(): void {
  Hooks.on("deleteCombat", (combat: unknown) => {
    if (!isActiveGm()) return;
    const c = combat as { combatants: Iterable<{ actor: { getFlag(s: string, k: string): unknown; unsetFlag(s: string, k: string): Promise<unknown> } | null }> };
    for (const combatant of c.combatants) {
      const actor = combatant.actor;
      if (actor?.getFlag(SYSTEM_ID, "turnAttempt")) void actor.unsetFlag(SYSTEM_ID, "turnAttempt");
    }
  });
}
