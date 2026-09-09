// The system migration framework's pure core (spec §8). SP1 ships the framework
// + a dry-run logger + an EMPTY migration list. `src/migrations/run.ts` is the
// Foundry glue that reads game.settings / game.actors and applies what these
// functions decide. No Foundry import — pure, gated, 100% covered.
//
// ADDING A MIGRATION (a future slice): append `{ version, actorUpdate }` to
// MIGRATIONS in ascending version order — `version` is the system.json version
// that introduced the schema change; a world whose stored migration version is
// older runs it. `actorUpdate(sourceSystem, actorType)` returns a Foundry
// `updateDocuments` payload for one actor, or `null` to skip it.
//
// v14 GOTCHA — you CANNOT drop a stale/unknown key with a
// `{ "system.-=foo": null }` payload. Foundry v14 prunes unknown keys from
// `_source` on every DataModel construction, so a key removed from the schema
// is already gone from `actor._source.system` by `ready`; and even a visible
// `-=` is pruned out of the update by `client-backend.mjs` cleanData before it
// reaches the DB. Dead bytes in the stored row are harmless (Foundry ignores
// them; they vanish on the actor's next full write). A migration that genuinely
// must rewrite `system` shape has to do a non-recursive replacement, which
// belongs in `run.ts` — the pure layer only decides *whether* an actor needs it.

/**
 * One ordered schema migration. `version` is the `system.json` version that
 * introduced the schema change; a world whose stored migration version is older
 * runs it. `actorUpdate` is called once per world Actor.
 */
export interface Migration {
  readonly version: string;
  /**
   * One actor's raw `_source.system` object + its document `type` → a Foundry
   * `updateDocuments` payload for that actor (dot-notation keys relative to the
   * actor document), or `null` to leave the actor untouched. See the v14 GOTCHA
   * in this file's header before writing a key-removal migration.
   */
  actorUpdate(sourceSystem: Record<string, unknown>, actorType: string): Record<string, unknown> | null;
}

/**
 * Parse a version string into `[major, minor, patch, isPrerelease]`. An empty
 * string or `"0"` → all zeros. A `-suffix` (e.g. `-dev.5`) marks a prerelease,
 * which by semver precedence sorts *before* the same `x.y.z` with no suffix.
 * Non-numeric or missing segments read as `0`.
 */
function parseVersion(v: string): [number, number, number, boolean] {
  if (!v || v === "0") return [0, 0, 0, false];
  const [core, ...rest] = v.split("-");
  const nums = core.split(".").map((n) => Number.parseInt(n, 10));
  return [nums[0] || 0, nums[1] || 0, nums[2] || 0, rest.length > 0];
}

/** `true` iff version `a` is strictly newer than version `b`. */
export function isVersionNewer(a: string, b: string): boolean {
  const [aMaj, aMin, aPat, aPre] = parseVersion(a);
  const [bMaj, bMin, bPat, bPre] = parseVersion(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  if (aPat !== bPat) return aPat > bPat;
  if (aPre !== bPre) return !aPre; // release (a) beats matching prerelease (b)
  return false;
}

/** Every migration, ascending by version. Empty for SP1 (spec §8) — the
 *  framework's proving case is a future slice's real schema change. */
export const MIGRATIONS: readonly Migration[] = [];

/** The migrations a world on `storedVersion` still needs, oldest first. */
export function pendingMigrations(
  storedVersion: string,
  all: readonly Migration[] = MIGRATIONS,
): Migration[] {
  return all
    .filter((m) => isVersionNewer(m.version, storedVersion))
    .sort((x, y) => {
      if (isVersionNewer(x.version, y.version)) return 1;
      if (isVersionNewer(y.version, x.version)) return -1;
      return 0;
    });
}
