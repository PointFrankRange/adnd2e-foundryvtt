import { SYSTEM_ID } from "../constants";
import { GRAPPLE_DELETE_OPTIONS, GRAPPLE_FLAG } from "../combat/grapple-state";
import { parseGrappleRecord } from "../core/wrestling";

/* SP7e - removing either grapple condition (held / grappling) from the Token HUD ends the whole grapple:
 * the active GM's client deletes the opponent's mirrored effect. A no-op when the opponent's side is already gone
 * (releaseGrapple / the relay clear both sides, which also fires this hook). Foundry glue; dev-world verified. */

interface GrappleEffect {
  statuses?: ReadonlySet<string>;
  getFlag(scope: string, key: string): unknown;
  delete(): Promise<unknown>;
}
interface OpponentActor {
  effects: Iterable<GrappleEffect>;
}

export function registerWrestlingHooks(): void {
  Hooks.on("deleteActiveEffect", (effect: unknown, options: unknown) => {
    try {
      // The system's own deletes (relay clears / role swaps) are not Token HUD removals.
      if ((options as { adnd2eGrapple?: boolean } | undefined)?.adnd2eGrapple === GRAPPLE_DELETE_OPTIONS.adnd2eGrapple) return;
      if (!(game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM) return;
      const e = effect as GrappleEffect;
      if (!e.statuses?.has("held") && !e.statuses?.has("grappling")) return;
      const record = parseGrappleRecord(e.getFlag(SYSTEM_ID, GRAPPLE_FLAG));
      if (!record) return;
      const opponent = foundry.utils.fromUuidSync(record.opponentUuid as never) as unknown as OpponentActor | null;
      if (!opponent) return;
      for (const other of opponent.effects) {
        if (!other.statuses?.has("held") && !other.statuses?.has("grappling")) continue;
        if (parseGrappleRecord(other.getFlag(SYSTEM_ID, GRAPPLE_FLAG))?.id !== record.id) continue;
        void other.delete().catch((error: unknown) => console.error("adnd2e | ending the mirrored grapple failed", error));
      }
    } catch (error) {
      console.error("adnd2e | wrestling deleteActiveEffect hook failed", error);
    }
  });
}
