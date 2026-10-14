/* Prototype-token link defaults. Foundry never links tokens by default, so a
 * player character dropped on a scene would get its own synthetic actor and
 * token statuses would never reach the sheet. PCs are linked by default. */

/**
 * Whether a new actor's prototype token should be force-linked.
 * `true` = set `prototypeToken.actorLink` to true; `null` = leave it alone.
 * An explicit value in the creation data (import, duplicate) is respected, and
 * non-character actor types (Character NPC `npc`, Monster NPC `creature`) stay
 * unlinked.
 */
export function prototypeTokenLinkDefault(actorType: string, explicit: boolean | undefined): boolean | null {
  if (actorType !== "character") return null;
  if (explicit !== undefined) return null;
  return true;
}
