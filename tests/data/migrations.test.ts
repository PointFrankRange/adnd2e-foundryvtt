import { describe, expect, it } from "vitest";
import {
  isVersionNewer,
  MIGRATIONS,
  multiclassPendingCleanup,
  pendingMigrations,
  type Migration,
} from "../../src/data/migrations";

describe("isVersionNewer", () => {
  it("compares major / minor / patch numerically", () => {
    expect(isVersionNewer("1.0.0", "0.9.9")).toBe(true);
    expect(isVersionNewer("0.2.0", "0.1.9")).toBe(true);
    expect(isVersionNewer("0.1.2", "0.1.1")).toBe(true);
    expect(isVersionNewer("0.1.1", "0.1.2")).toBe(false);
    expect(isVersionNewer("0.1.0", "0.2.0")).toBe(false);
  });

  it("equal versions are not newer", () => {
    expect(isVersionNewer("0.2.0", "0.2.0")).toBe(false);
  });

  it("a release is newer than its matching prerelease", () => {
    expect(isVersionNewer("0.2.0", "0.2.0-dev.5")).toBe(true);
    expect(isVersionNewer("0.2.0-dev.5", "0.2.0")).toBe(false);
    expect(isVersionNewer("0.2.0-dev.5", "0.2.0-dev.1")).toBe(false); // same core, both prerelease
  });

  it('treats "" and "0" as the lowest possible version', () => {
    expect(isVersionNewer("0.2.0", "")).toBe(true);
    expect(isVersionNewer("0.2.0", "0")).toBe(true);
    expect(isVersionNewer("", "")).toBe(false);
  });

  it("tolerates short version strings", () => {
    expect(isVersionNewer("1", "0.9")).toBe(true);
    expect(isVersionNewer("1.2", "1.1.9")).toBe(true);
  });
});

describe("multiclassPendingCleanup", () => {
  it("unsets the stale key on a character that still has it", () => {
    expect(multiclassPendingCleanup({ multiclassPending: true, classes: [] }, "character")).toEqual({
      "system.-=multiclassPending": null,
    });
  });

  it("unsets it on an npc too", () => {
    expect(multiclassPendingCleanup({ multiclassPending: false }, "npc")).toEqual({
      "system.-=multiclassPending": null,
    });
  });

  it("returns null when the key is absent", () => {
    expect(multiclassPendingCleanup({ classes: [] }, "character")).toBeNull();
  });

  it("returns null for a creature (never had the field)", () => {
    expect(multiclassPendingCleanup({ multiclassPending: true }, "creature")).toBeNull();
  });
});

describe("pendingMigrations", () => {
  const a: Migration = { version: "0.2.0", actorUpdate: () => null };
  const b: Migration = { version: "0.3.0", actorUpdate: () => null };
  const c: Migration = { version: "1.0.0", actorUpdate: () => null };

  it("returns only migrations newer than the stored version, oldest first", () => {
    expect(pendingMigrations("0.2.0", [c, a, b])).toEqual([b, c]);
  });

  it("returns everything for a fresh world", () => {
    expect(pendingMigrations("", [b, a])).toEqual([a, b]);
  });

  it("returns nothing when the world is current", () => {
    expect(pendingMigrations("1.0.0", [a, b, c])).toEqual([]);
  });

  it("defaults to the real MIGRATIONS list", () => {
    expect(pendingMigrations("0.0.0")).toEqual([...MIGRATIONS]);
    expect(pendingMigrations("9.9.9")).toEqual([]);
  });

  it("handles migrations with the same version stably", () => {
    const x: Migration = { version: "0.3.0", actorUpdate: () => null };
    const y: Migration = { version: "0.3.0", actorUpdate: () => null };
    const z: Migration = { version: "0.4.0", actorUpdate: () => null };
    const result = pendingMigrations("0.0.0", [z, x, y]);
    expect(result).toHaveLength(3);
    expect(result[2].version).toBe("0.4.0");
  });

  it("sorts migrations in ascending order regardless of input order", () => {
    const v1: Migration = { version: "0.2.0", actorUpdate: () => null };
    const v2: Migration = { version: "0.3.0", actorUpdate: () => null };
    const v3: Migration = { version: "0.4.0", actorUpdate: () => null };
    const result = pendingMigrations("0.0.0", [v3, v1, v2]);
    expect(result[0].version).toBe("0.2.0");
    expect(result[1].version).toBe("0.3.0");
    expect(result[2].version).toBe("0.4.0");
  });
});

describe("MIGRATIONS", () => {
  it("is the 0.2.0 multiclassPending cleanup, and nothing else yet", () => {
    expect(MIGRATIONS).toHaveLength(1);
    expect(MIGRATIONS[0].version).toBe("0.2.0");
    expect(MIGRATIONS[0].actorUpdate).toBe(multiclassPendingCleanup);
  });

  it("is sorted ascending by version", () => {
    for (let i = 1; i < MIGRATIONS.length; i++) {
      expect(isVersionNewer(MIGRATIONS[i].version, MIGRATIONS[i - 1].version)).toBe(true);
    }
  });
});
