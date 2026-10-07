/* Race -> class eligibility (PHB Table 8). Pure; Foundry-free.
 * `allowedClasses` empty = unrestricted (a custom race). `allowedMulticlass` empty = no
 * combination check: humans list none, and their two-class case is dual-classing. */
export interface RaceClassTables {
  readonly allowedClasses: readonly string[];
  readonly allowedMulticlass: readonly (readonly string[])[];
}

export type RaceClassVerdict = { ok: true } | { ok: false; reason: "class" | "multiclass" };

/** May a character of this race hold exactly these classes (the set the character would have after the drop)? */
export function raceAllowsClasses(race: RaceClassTables, classIds: readonly string[]): RaceClassVerdict {
  if (race.allowedClasses.length > 0 && classIds.some((c) => !race.allowedClasses.includes(c))) {
    return { ok: false, reason: "class" };
  }
  if (classIds.length > 1 && race.allowedMulticlass.length > 0) {
    const wanted = new Set(classIds);
    const listed = race.allowedMulticlass.some((combo) => combo.length === wanted.size && combo.every((c) => wanted.has(c)));
    if (!listed) return { ok: false, reason: "multiclass" };
  }
  return { ok: true };
}

/** The eligibility tables of a raw race item's `system` (tolerates missing or malformed fields). */
export function raceTablesOf(system: unknown): RaceClassTables {
  const s = (system ?? {}) as { allowedClasses?: unknown; allowedMulticlass?: unknown };
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    allowedClasses: strings(s.allowedClasses),
    allowedMulticlass: Array.isArray(s.allowedMulticlass) ? s.allowedMulticlass.map(strings) : [],
  };
}
