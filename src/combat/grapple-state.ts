// Reading a wrestling grapple off an actor's condition effects (SP7e). Pure.
import { SYSTEM_ID } from "../constants";
import { parseGrappleRecord, type GrappleRecord } from "../core/wrestling";

export const GRAPPLE_FLAG = "grapple";

interface EffectLike {
  statuses: ReadonlySet<string>;
  getFlag(scope: string, key: string): unknown;
}

/** The grapple record carried by this actor's `held` or `grappling` effect, or null when it has none. */
export function grappleRecordOf(effects: Iterable<EffectLike>): GrappleRecord | null {
  for (const e of effects) {
    if (!e.statuses.has("held") && !e.statuses.has("grappling")) continue;
    const parsed = parseGrappleRecord(e.getFlag(SYSTEM_ID, GRAPPLE_FLAG));
    if (parsed) return parsed;
  }
  return null;
}
