// The three Actor sub-types this system registers (must equal system.json
// documentTypes.Actor — asserted in tests/data/actor-subtypes.test.ts).
export type ActorSubtype = "character" | "npc" | "creature";

export const ACTOR_SUBTYPES: readonly ActorSubtype[] = ["character", "npc", "creature"];
