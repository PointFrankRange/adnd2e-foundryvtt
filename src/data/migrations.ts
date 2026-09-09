// The system migration framework's pure core (spec §8). `src/migrations/run.ts`
// is the Foundry glue that reads game.settings, iterates game.actors, and applies
// what these functions decide. No Foundry import — pure, gated, 100% covered.

/**
 * One ordered schema migration. `version` is the `system.json` version that
 * introduced the schema change; a world whose stored migration version is older
 * runs it. `actorUpdate` is called once per world Actor.
 */
export interface Migration {
  readonly version: string;
  /**
   * Given one actor's raw `_source.system` object and its document `type`, the
   * update payload to apply to that actor document (dot-notation keys relative to
   * the actor — e.g. `{ "system.-=multiclassPending": null }`), or `null` to
   * leave the actor untouched.
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

/**
 * 1c.3c replaced the derived `system.multiclassPending` boolean (1c.3b) with the
 * `system.multiclass` SchemaField. Both are recomputed every prepare cycle, so
 * nothing needs computing — just drop the stale key from any actor whose stored
 * `_source.system` still carries it. Idempotent: a `-=` on a missing key is a
 * no-op, so re-running or running on a fresh world is harmless.
 */
export function multiclassPendingCleanup(
  sourceSystem: Record<string, unknown>,
  actorType: string,
): Record<string, unknown> | null {
  if (actorType !== "character" && actorType !== "npc") return null;
  if (!("multiclassPending" in sourceSystem)) return null;
  return { "system.-=multiclassPending": null };
}

/** Every migration, ascending by version. Appended to by each later slice that changes schema. */
export const MIGRATIONS: readonly Migration[] = [
  { version: "0.2.0", actorUpdate: multiclassPendingCleanup },
];

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
