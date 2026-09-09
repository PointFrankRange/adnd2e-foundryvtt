// Splits ActiveEffect changes into "affects base" (default Foundry timing) and
// "affects derived" (re-applied after prepareDerivedData). Pure — a static
// allow-list of the system.* path prefixes that prepareDerivedData writes, per
// actor type. An unlisted derived field just means its effect is a visible no-op
// in the dev world — safer than a base-path deny-list, where a miss double-applies.

export type ActorType = "character" | "npc" | "creature";

const CHARACTER_DERIVED_PREFIXES: readonly string[] = [
  "system.abilities.str.mods",
  "system.abilities.dex.mods",
  "system.abilities.con.mods",
  "system.abilities.int.mods",
  "system.abilities.wis.mods",
  "system.abilities.cha.mods",
  "system.attributes.hp.max",
  "system.attributes.thac0.",
  "system.attributes.ac.",
  "system.attributes.encumbrance.",
  "system.attributes.movement.",
  "system.saves.",
  "system.proficiencies.",
  "system.languagesKnown.",
  "system.multiclass.",
  "system.spellcasting.wizard.slots",
  "system.spellcasting.priest.slots",
  "system.classes",
];

const CREATURE_DERIVED_PREFIXES: readonly string[] = [
  "system.attributes.hp.max",
  "system.attributes.thac0.value",
  "system.saves.effective.",
];

const DERIVED_PREFIXES: Record<ActorType, readonly string[]> = {
  character: CHARACTER_DERIVED_PREFIXES,
  npc: CHARACTER_DERIVED_PREFIXES,
  creature: CREATURE_DERIVED_PREFIXES,
};

/**
 * True when an ActiveEffect change on `key` must be re-applied after
 * `prepareDerivedData` (it targets a value that step computes).
 */
export function isDeferredChangeKey(key: string, actorType: ActorType): boolean {
  return DERIVED_PREFIXES[actorType].some((prefix) => key === prefix || key.startsWith(prefix));
}
