# AD&D 2E 1c.4b — Content Importer + Migration Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the runtime content importer (`game.system.api.importContent(json)`) and the version-gated world migration framework, including the first real migration (drop the stale `system.multiclassPending` key left by the 1c.3b→1c.3c schema change).

**Architecture:** Two-layer as everywhere else in this system. The decision logic is pure and 100%-tested — `src/data/migrations.ts` (which migrations apply, what each does to one actor) and `src/data/import/envelope.ts` (structural validation of the import JSON). The Foundry glue — `src/migrations/run.ts` and `src/api/import-content.ts` — reads `game.settings` / `game.actors` / `CONFIG` / `Folder`, applies what the pure layer decides, and is verified in a linked dev world (spec §9), not unit-tested.

**Tech Stack:** TypeScript, Vite (library build), Vitest, Foundry VTT v14.364 game system (`fvtt-types` is v13-beta — read `resources/app` source for Foundry APIs).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §7 (content import path), §8 (migration framework), §9 (testing strategy), §10 (scope boundary), §12 items 7 + 10 (deliverables).

## Global Constraints

- **Two-layer architecture.** `src/core/**` + `src/data/derive/**` + `src/data/{item,actor,active-effect}/subtypes.ts` + `src/data/item/choices.ts` + `src/conditions.ts` + **`src/data/migrations.ts` (NEW)** + **`src/data/import/envelope.ts` (NEW)** import NOTHING from `foundry` / `fvtt-types` / `game` / `CONFIG` / DOM. `tsc -p tsconfig.core.json` proves it.
- **The gated-zone config triad.** Every new pure file is added to ALL THREE: `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, and `eslint.config.js` in BOTH the Foundry-globals `ignores` array (line ~14) AND the pure-zone `files` array (line ~28). `tests/data/**` is already in both eslint arrays — new test files under it need no eslint change.
- **Coverage.** 100% lines / statements / functions on the gated zone; branches ≥ 90 (`vitest.config.ts` threshold is 90; the suite has held 100). `src/data/migrations.ts` and `src/data/import/envelope.ts` must reach 100% on every metric.
- **Foundry is v14.364.** `fvtt-types` is v13-beta and wrong about several v14 APIs. For `game.settings.register/get/set`, `game.actors`, `game.user.isActiveGM`, `game.users.activeGM`, `Folder.create`, `CONFIG.Actor.documentClass` / `CONFIG.Item.documentClass`, `ui.notifications`, and `game.system` — **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source, not `fvtt-types`.** See the `foundry-v14-vs-fvtt-types` memory. Any task touching a Foundry API has a "read `resources/app` source" step.
- **Do NOT run `npm run format` / `prettier` / `npm install`.** They churn column-aligned tables / the lockfile.
- **Full gate:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. Vitest sometimes fails at import (`Cannot read properties of undefined (reading 'config')`) — most often on the first run right after a cache clear. Fix: `rm -rf node_modules/.vite node_modules/.vitest node_modules/.cache` and run again. Never `npm install` for this.
- **Commit trailer:** `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. **PR body trailer:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Content policy.** Mechanical/factual values only in the repo. `docs/importing-content.md` examples use invented, minimal stat values — never text transcribed from a rulebook. `references/` stays gitignored.
- **The dev-world smoke check (Task 7) is a REQUIRED gated step before `finishing-a-development-branch`, not a deferred checklist item.** 1c.3d and 1c.4a both merged un-smoke-tested and shipped a world-load crash and an un-installable manifest (hotfixes #16, #17).

---

## File Structure

| File | Layer | Responsibility |
|---|---|---|
| `src/data/migrations.ts` | pure / gated | `Migration` type; `isVersionNewer`; `pendingMigrations`; `multiclassPendingCleanup`; the `MIGRATIONS` list |
| `src/data/import/envelope.ts` | pure / gated | `RawImportDoc`; `parseImportEnvelope` — structural validation of import JSON |
| `src/migrations/run.ts` | Foundry glue | `registerMigrationSettings()`; `runMigrations()` — the `ready`-hook entry point |
| `src/api/import-content.ts` | Foundry glue | `importContent(json, options)` — the public API implementation |
| `src/api/index.ts` | Foundry glue | `buildApi()` — assembles the object assigned to `game.system.api` |
| `docs/importing-content.md` | docs | The import JSON format + worked examples + limitations |
| `tests/data/migrations.test.ts` | pure test | `isVersionNewer`, `pendingMigrations`, `multiclassPendingCleanup`, `MIGRATIONS` |
| `tests/data/import-envelope.test.ts` | pure test | `parseImportEnvelope` accept/reject paths |

**Modified:** `system.json` (version `0.1.0` → `0.2.0`), `src/system.ts` (init + ready wiring), `src/types/global.d.ts` (two `SettingConfig` keys), `lang/en.json` (`ADND2E.settings.migrationDryRun.*` + `ADND2E.migration.*` + `ADND2E.import.*`), `tests/lang/en-coverage.test.ts` (cover the new lang keys), `tests/config/system-json.test.ts` (assert version), `tsconfig.core.json` + `vitest.config.ts` + `eslint.config.js` (gated triad for the two new pure files).

**Out of scope** (note, do not build): compendium-target import; update-by-id / dedup / idempotent re-import; importing folder hierarchies or adventure bundles; a migration confirmation dialog / UI; per-document schema-version flags; importing into locked compendium packs.

---

## Task 1: `src/data/migrations.ts` — pure migration core

**Files:**
- Create: `src/data/migrations.ts`
- Test: `tests/data/migrations.test.ts`
- Modify: `tsconfig.core.json` (add to `include`), `vitest.config.ts` (add to `coverage.include`), `eslint.config.js` (add to both arrays)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Migration { readonly version: string; actorUpdate(sourceSystem: Record<string, unknown>, actorType: string): Record<string, unknown> | null }`
  - `function isVersionNewer(a: string, b: string): boolean`
  - `function pendingMigrations(storedVersion: string, all?: readonly Migration[]): Migration[]`
  - `function multiclassPendingCleanup(sourceSystem: Record<string, unknown>, actorType: string): Record<string, unknown> | null`
  - `const MIGRATIONS: readonly Migration[]`

- [ ] **Step 1: Write the failing test**

Create `tests/data/migrations.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run tests/data/migrations.test.ts`
Expected: FAIL — `Cannot find module '../../src/data/migrations'`.

- [ ] **Step 3: Write `src/data/migrations.ts`**

```ts
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
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run tests/data/migrations.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Add `src/data/migrations.ts` to the gated triad**

`tsconfig.core.json` — append `"src/data/migrations.ts"` to the `include` array (after `"src/data/active-effect/subtypes.ts"`).

`vitest.config.ts` — add `"src/data/migrations.ts"` to `coverage.include` (near `"src/conditions.ts"`).

`eslint.config.js` — add `"src/data/migrations.ts"` to the Foundry-globals `ignores` array (line ~14) AND `"src/data/migrations.ts"` to the pure-zone `files` array (line ~28). Put it next to `"src/conditions.ts"` in both.

- [ ] **Step 6: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage`
Expected: typecheck clean (both `tsc` passes — the second is `tsconfig.core.json`, proving the file is Foundry-free); lint clean; coverage 100% on all four metrics with `src/data/migrations.ts` listed.
If Vitest fails at import: `rm -rf node_modules/.vite node_modules/.vitest node_modules/.cache` and rerun.

- [ ] **Step 7: Commit**

```bash
git add src/data/migrations.ts tests/data/migrations.test.ts tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(migrations): pure migration core — version compare + pending filter + multiclassPending cleanup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `src/data/import/envelope.ts` — pure import-envelope parser

**Files:**
- Create: `src/data/import/envelope.ts`
- Test: `tests/data/import-envelope.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface RawImportDoc { documentType: "Item" | "Actor"; type: string; name: string; system?: Record<string, unknown>; img?: string }`
  - `type ParseResult = { ok: true; documents: RawImportDoc[] } | { ok: false; error: string }`
  - `function parseImportEnvelope(json: unknown): ParseResult`

- [ ] **Step 1: Write the failing test**

Create `tests/data/import-envelope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseImportEnvelope } from "../../src/data/import/envelope";

const spell = { documentType: "Item", type: "spell", name: "Test Bolt" };
const creature = { documentType: "Actor", type: "creature", name: "Test Rat" };

describe("parseImportEnvelope — accepts", () => {
  it("a minimal one-document envelope", () => {
    const r = parseImportEnvelope({ documents: [spell] });
    expect(r).toEqual({ ok: true, documents: [{ documentType: "Item", type: "spell", name: "Test Bolt" }] });
  });

  it("Item and Actor documents together, keeping optional system + img", () => {
    const r = parseImportEnvelope({
      documents: [
        { ...spell, system: { level: 1 }, img: "icons/svg/fire.svg" },
        creature,
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documents[0]).toEqual({
      documentType: "Item",
      type: "spell",
      name: "Test Bolt",
      system: { level: 1 },
      img: "icons/svg/fire.svg",
    });
    expect(r.documents[1]).toEqual({ documentType: "Actor", type: "creature", name: "Test Rat" });
  });

  it("drops a non-object system and an empty img", () => {
    const r = parseImportEnvelope({ documents: [{ ...spell, system: 3, img: "" }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documents[0]).toEqual({ documentType: "Item", type: "spell", name: "Test Bolt" });
  });
});

describe("parseImportEnvelope — rejects with a specific message", () => {
  it("a non-object", () => {
    expect(parseImportEnvelope("nope")).toEqual({ ok: false, error: "import data must be a JSON object" });
    expect(parseImportEnvelope(null)).toEqual({ ok: false, error: "import data must be a JSON object" });
    expect(parseImportEnvelope([spell])).toEqual({ ok: false, error: "import data must be a JSON object" });
  });

  it("a missing or non-array documents field", () => {
    expect(parseImportEnvelope({})).toEqual({
      ok: false,
      error: 'import data must have a "documents" array',
    });
    expect(parseImportEnvelope({ documents: {} })).toEqual({
      ok: false,
      error: 'import data must have a "documents" array',
    });
  });

  it("an empty documents array", () => {
    expect(parseImportEnvelope({ documents: [] })).toEqual({
      ok: false,
      error: '"documents" is empty — nothing to import',
    });
  });

  it("a non-object entry", () => {
    expect(parseImportEnvelope({ documents: [spell, 7] })).toEqual({
      ok: false,
      error: "documents[1] is not an object",
    });
  });

  it("a bad documentType", () => {
    expect(parseImportEnvelope({ documents: [{ documentType: "JournalEntry", type: "x", name: "y" }] })).toEqual({
      ok: false,
      error: 'documents[0].documentType must be "Item" or "Actor"',
    });
  });

  it("a missing / empty type", () => {
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", name: "y" }] })).toEqual({
      ok: false,
      error: "documents[0].type must be a non-empty string",
    });
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", type: "", name: "y" }] })).toEqual({
      ok: false,
      error: "documents[0].type must be a non-empty string",
    });
  });

  it("a missing / empty name", () => {
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", type: "spell" }] })).toEqual({
      ok: false,
      error: "documents[0].name must be a non-empty string",
    });
    expect(parseImportEnvelope({ documents: [{ documentType: "Item", type: "spell", name: "" }] })).toEqual({
      ok: false,
      error: "documents[0].name must be a non-empty string",
    });
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run tests/data/import-envelope.test.ts`
Expected: FAIL — `Cannot find module '../../src/data/import/envelope'`.

- [ ] **Step 3: Write `src/data/import/envelope.ts`**

```ts
// The `importContent` envelope parser (spec §7). Pure structural validation of
// the JSON a GM passes to `game.system.api.importContent()`. Subtype validity and
// per-document schema validation happen in the Foundry glue
// (`src/api/import-content.ts`) — they need CONFIG. No Foundry import — pure,
// gated, 100% covered.

/** One document the caller wants created. */
export interface RawImportDoc {
  documentType: "Item" | "Actor";
  type: string;
  name: string;
  system?: Record<string, unknown>;
  img?: string;
}

export type ParseResult =
  | { ok: true; documents: RawImportDoc[] }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate the outer shape of import JSON. On success, returns a normalised
 * `documents` array (optional `system` / `img` present only when well-formed).
 */
export function parseImportEnvelope(json: unknown): ParseResult {
  if (!isObject(json)) return { ok: false, error: "import data must be a JSON object" };
  const { documents } = json;
  if (!Array.isArray(documents)) return { ok: false, error: 'import data must have a "documents" array' };
  if (documents.length === 0) return { ok: false, error: '"documents" is empty — nothing to import' };

  const out: RawImportDoc[] = [];
  for (let i = 0; i < documents.length; i++) {
    const d: unknown = documents[i];
    if (!isObject(d)) return { ok: false, error: `documents[${i}] is not an object` };
    if (d.documentType !== "Item" && d.documentType !== "Actor") {
      return { ok: false, error: `documents[${i}].documentType must be "Item" or "Actor"` };
    }
    if (typeof d.type !== "string" || d.type.length === 0) {
      return { ok: false, error: `documents[${i}].type must be a non-empty string` };
    }
    if (typeof d.name !== "string" || d.name.length === 0) {
      return { ok: false, error: `documents[${i}].name must be a non-empty string` };
    }
    const doc: RawImportDoc = { documentType: d.documentType, type: d.type, name: d.name };
    if (isObject(d.system)) doc.system = d.system;
    if (typeof d.img === "string" && d.img.length > 0) doc.img = d.img;
    out.push(doc);
  }
  return { ok: true, documents: out };
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run tests/data/import-envelope.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `src/data/import/envelope.ts` to the gated triad**

`tsconfig.core.json` `include` — append `"src/data/import/envelope.ts"`.
`vitest.config.ts` `coverage.include` — add `"src/data/import/envelope.ts"`.
`eslint.config.js` — add `"src/data/import/envelope.ts"` to BOTH the `ignores` array (line ~14) and the pure-zone `files` array (line ~28).

- [ ] **Step 6: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage`
Expected: all green; `src/data/import/envelope.ts` at 100%.

- [ ] **Step 7: Commit**

```bash
git add src/data/import/envelope.ts tests/data/import-envelope.test.ts tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(import): pure import-envelope parser — structural validation of importContent JSON

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `src/migrations/run.ts` — the migration runner (Foundry glue)

**Files:**
- Create: `src/migrations/run.ts`

**Interfaces:**
- Consumes: `MIGRATIONS`, `pendingMigrations` from `src/data/migrations.ts`; `SYSTEM_ID` from `src/constants.ts`.
- Produces:
  - `function registerMigrationSettings(): void` — called from `src/system.ts` on `init`
  - `function runMigrations(): Promise<void>` — called from `src/system.ts` on `ready`

**No unit test** (spec §9 — Foundry glue is dev-world verified, Task 7).

- [ ] **Step 1: Read the v14 source for the APIs this file uses**

Read these in `C:\Program Files\Foundry Virtual Tabletop\resources\app`:
- `client/documents/user.mjs` — confirm `get isActiveGM()` returns `this === game.users.activeGM` (exactly one client returns true).
- `client/helpers/client-settings.mjs` (or wherever `ClientSettings` lives) — `game.settings.register(namespace, key, config)` shape; `type: String` / `type: Boolean`; `scope: "world"`; `config: false` hides it from the Configure Settings UI. Confirm `.get` / `.set` signatures and that `set` returns a Promise.
- `client/utils/helpers.mjs` — `getDocumentClass(name)` returns `CONFIG[name]?.documentClass`. Bulk update: confirm `<DocClass>.updateDocuments(updates)` where each entry is `{ _id, ...changes }`.
- Confirm `game.actors` is iterable (a `WorldCollection`) and each actor exposes `.id`, `.name`, `.type`, and `._source.system` (the raw stored system object, pre-derived-data).
- `ui.notifications.info` / `.error` — confirm they exist at `ready` time.

Note anything that differs from the code below and adjust.

- [ ] **Step 2: Write `src/migrations/run.ts`**

```ts
// Foundry glue for the migration framework (spec §8). All decision logic is in
// the pure `src/data/migrations.ts`; this file registers the two world settings,
// and on `ready` (GM only) applies every pending migration to the world's actors.
// Not unit-tested (spec §9) — verified in a linked dev world.
import { SYSTEM_ID } from "../constants";
import { MIGRATIONS, pendingMigrations } from "../data/migrations";

type SettingKey = foundry.helpers.ClientSettings.KeyFor<typeof SYSTEM_ID>;

const MIGRATION_VERSION_KEY = "systemMigrationVersion";
const DRY_RUN_KEY = "migrationDryRun";

/** Register the framework's two world settings. Call once, on `init`. */
export function registerMigrationSettings(): void {
  game.settings!.register(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey, {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
  game.settings!.register(SYSTEM_ID, DRY_RUN_KEY as SettingKey, {
    name: "ADND2E.settings.migrationDryRun.name",
    hint: "ADND2E.settings.migrationDryRun.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}

/**
 * Compare the stored migration version to the running system version and apply
 * every newer migration to the world's actors. GM-only; call on `ready`.
 * On success advances the stored version; on any error leaves it unchanged.
 */
export async function runMigrations(): Promise<void> {
  if (!game.user?.isActiveGM) return;

  const stored =
    (game.settings!.get(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey) as string) || "0.0.0";
  const current = game.system!.version;
  const dryRun = game.settings!.get(SYSTEM_ID, DRY_RUN_KEY as SettingKey) as boolean;

  const pending = pendingMigrations(stored, MIGRATIONS);
  if (pending.length === 0) return;

  console.log(
    `${SYSTEM_ID} | migrating world ${stored} \u2192 ${current}${dryRun ? " (DRY RUN — no writes)" : ""}`,
  );

  try {
    for (const migration of pending) {
      const updates: Record<string, unknown>[] = [];
      for (const actor of game.actors!) {
        const source = (actor as unknown as { _source: { system: Record<string, unknown> } })._source;
        const payload = migration.actorUpdate(source.system, actor.type);
        if (!payload) continue;
        if (dryRun) {
          console.log(
            `${SYSTEM_ID} | migration ${migration.version} would update "${actor.name}":`,
            payload,
          );
        } else {
          updates.push({ _id: actor.id, ...payload });
        }
      }
      if (!dryRun && updates.length > 0) {
        await CONFIG.Actor.documentClass.updateDocuments(updates);
        console.log(
          `${SYSTEM_ID} | migration ${migration.version}: updated ${updates.length} actor(s)`,
        );
      }
    }

    if (dryRun) {
      ui.notifications!.info(game.i18n!.localize("ADND2E.migration.dryRunComplete"));
    } else {
      await game.settings!.set(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey, current);
      ui.notifications!.info(game.i18n!.format("ADND2E.migration.migrated", { version: current }));
    }
  } catch (err) {
    console.error(`${SYSTEM_ID} | migration failed — version left at ${stored}`, err);
    ui.notifications!.error(game.i18n!.localize("ADND2E.migration.failed"));
  }
}
```

If Step 1 showed `CONFIG.Actor.documentClass.updateDocuments` is wrong for v14, use the form the source confirms (e.g. `foundry.documents.Actor.updateDocuments` or `getDocumentClass("Actor").updateDocuments`) and note the change in the report.

- [ ] **Step 3: Run the gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: clean. (`test:coverage` unaffected — no pure code added; run it anyway to confirm still 100%.)
The `type: String` / `type: Boolean` fields may need `as SettingKey` casts exactly as `src/settings/index.ts` does — match that file's pattern. If `game.i18n.format`'s typing complains, cast `game.i18n` the way other glue files do, or use `game.i18n!.localize` + manual interpolation.

- [ ] **Step 4: Commit**

```bash
git add src/migrations/run.ts
git commit -m "feat(migrations): ready-hook runner + settings registration (Foundry glue)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `src/api/import-content.ts` + `src/api/index.ts` — the importer API

**Files:**
- Create: `src/api/import-content.ts`, `src/api/index.ts`

**Interfaces:**
- Consumes: `parseImportEnvelope`, `RawImportDoc` from `src/data/import/envelope.ts`; `SYSTEM_ID` from `src/constants.ts`.
- Produces:
  - `interface ImportedRef { id: string; name: string; type: string; documentType: "Item" | "Actor" }`
  - `interface ImportFailure { index: number; name: string; error: string }`
  - `interface ImportResult { created: ImportedRef[]; failed: ImportFailure[]; folders: { Item?: string; Actor?: string } }`
  - `function importContent(json: unknown, options?: { folderName?: string }): Promise<ImportResult>`
  - `function buildApi(): { importContent: typeof importContent }`

**No unit test** (spec §9 — dev-world verified, Task 7).

- [ ] **Step 1: Read the v14 source for the APIs this file uses**

Read in `C:\Program Files\Foundry Virtual Tabletop\resources\app`:
- `common/documents/folder.mjs` — `Folder` schema: `type` is a `DocumentTypeField` over `CONST.FOLDER_DOCUMENT_TYPES` (includes `"Item"`, `"Actor"`); `name` required. `Folder.create({ name, type })` returns `Promise<Folder | undefined>`.
- How to find an existing world folder: `game.folders` is the world `Folders` collection — `game.folders.find(f => f.type === dt && f.name === name)`.
- `CONFIG.Item.dataModels` / `CONFIG.Actor.dataModels` — a `Record<subtype, DataModelClass>`; `subtype in CONFIG.Item.dataModels` is the registered-subtype check.
- `getDocumentClass("Item")` / `getDocumentClass("Actor")` → the configured document class; `.create(data, operation?)` returns `Promise<Doc | undefined>`. Confirm `{ keepId: false }` is the default and whether `create` throws or returns `undefined` on a validation failure (the code below assumes it throws a descriptive `Error`; if it returns `undefined`, treat that as a failure with a generic message).
- `game.user.isGM` — a boolean getter on the User document.

- [ ] **Step 2: Write `src/api/import-content.ts`**

```ts
// The public content importer (spec §7). GM passes a JSON envelope (validated by
// the pure `parseImportEnvelope`); this creates the documents in a world folder,
// one at a time so a single bad document does not abort the batch. Create-only —
// re-importing the same file makes duplicates. Not unit-tested (spec §9).
import { SYSTEM_ID } from "../constants";
import { parseImportEnvelope, type RawImportDoc } from "../data/import/envelope";

export interface ImportedRef {
  id: string;
  name: string;
  type: string;
  documentType: "Item" | "Actor";
}
export interface ImportFailure {
  index: number;
  name: string;
  error: string;
}
export interface ImportResult {
  created: ImportedRef[];
  failed: ImportFailure[];
  folders: { Item?: string; Actor?: string };
}

const DEFAULT_FOLDER_NAME = "Imported Content";

async function getOrCreateFolder(documentType: "Item" | "Actor", name: string) {
  const existing = game.folders!.find((f) => f.type === documentType && f.name === name);
  if (existing) return existing;
  const created = await CONFIG.Folder?.documentClass?.create?.({ name, type: documentType });
  if (!created) throw new Error(`could not create the "${name}" ${documentType} folder`);
  return created;
}

/**
 * Import documents from a validated JSON envelope. GM-only. Returns a summary and
 * also posts a notification; per-document failures are collected, not thrown.
 */
export async function importContent(
  json: unknown,
  options: { folderName?: string } = {},
): Promise<ImportResult> {
  if (!game.user?.isGM) throw new Error("importContent is GM-only");

  const parsed = parseImportEnvelope(json);
  if (!parsed.ok) throw new Error(parsed.error);

  const folderName = options.folderName ?? DEFAULT_FOLDER_NAME;
  const result: ImportResult = { created: [], failed: [], folders: {} };
  const folderByType: Partial<Record<"Item" | "Actor", { id: string | null }>> = {};

  for (const dt of ["Item", "Actor"] as const) {
    if (parsed.documents.some((d) => d.documentType === dt)) {
      const folder = await getOrCreateFolder(dt, folderName);
      folderByType[dt] = folder;
      if (folder.id) result.folders[dt] = folder.id;
    }
  }

  for (let i = 0; i < parsed.documents.length; i++) {
    const d: RawImportDoc = parsed.documents[i];
    try {
      const models = CONFIG[d.documentType].dataModels as Record<string, unknown>;
      if (!(d.type in models)) {
        throw new Error(`unknown ${d.documentType} subtype "${d.type}"`);
      }
      const cls = CONFIG[d.documentType].documentClass;
      const doc = await cls.create({
        name: d.name,
        type: d.type,
        folder: folderByType[d.documentType]?.id ?? null,
        ...(d.img ? { img: d.img } : {}),
        ...(d.system ? { system: d.system } : {}),
      });
      if (!doc?.id) throw new Error("document creation returned nothing (schema validation failed?)");
      result.created.push({ id: doc.id, name: doc.name ?? d.name, type: d.type, documentType: d.documentType });
    } catch (err) {
      result.failed.push({
        index: i,
        name: d.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const total = parsed.documents.length;
  const key = result.failed.length ? "ADND2E.import.doneWithFailures" : "ADND2E.import.done";
  ui.notifications!.info(
    game.i18n!.format(key, { created: result.created.length, total, failed: result.failed.length }),
  );
  if (result.failed.length) console.warn(`${SYSTEM_ID} | import failures`, result.failed);

  return result;
}
```

If Step 1 showed `CONFIG[d.documentType]` doesn't narrow in TS, replace with an explicit `d.documentType === "Item" ? CONFIG.Item : CONFIG.Actor` switch. If `CONFIG.Folder.documentClass.create` is wrong, use `getDocumentClass("Folder").create` or `Folder.create` per the source.

- [ ] **Step 3: Write `src/api/index.ts`**

```ts
// Assembles the object exposed as `game.system.api` (spec §7, §12.10). Wired in
// `src/system.ts` on `ready`.
import { importContent } from "./import-content";

export function buildApi() {
  return { importContent };
}
```

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green; coverage still 100% (no pure code added).

- [ ] **Step 5: Commit**

```bash
git add src/api/import-content.ts src/api/index.ts
git commit -m "feat(api): importContent — GM content importer into a world folder (Foundry glue)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Wiring — version bump, `system.ts`, lang strings, types, config tests

**Files:**
- Modify: `system.json`, `src/system.ts`, `src/types/global.d.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/config/system-json.test.ts`

**Interfaces:**
- Consumes: `registerMigrationSettings`, `runMigrations` from `src/migrations/run.ts`; `buildApi` from `src/api/index.ts`.
- Produces: nothing new (wiring only).

- [ ] **Step 1: Write the failing config test**

In `tests/config/system-json.test.ts`, add a new `describe`/`it` after the `documentTypes` block:

```ts
describe("system.json version", () => {
  it("is 0.2.0 (the migration-framework release — anchors the first migration)", () => {
    expect((manifest as unknown as { version: string }).version).toBe("0.2.0");
  });
});
```

Run: `npx vitest run tests/config/system-json.test.ts` — Expected: FAIL (`expected '0.1.0' to be '0.2.0'`).

- [ ] **Step 2: Bump the version**

`system.json` — change `"version": "0.1.0"` to `"version": "0.2.0"`. Also `package.json` `"version": "0.1.0"` → `"0.2.0"` (keep them in step; `scripts/prepare-release.mjs` overwrites `system.json`'s at release time but the committed value should match).

Run: `npx vitest run tests/config/system-json.test.ts` — Expected: PASS.

- [ ] **Step 3: Write the failing lang test**

In `tests/lang/en-coverage.test.ts`, add a new `describe` block at the end:

```ts
describe("lang/en.json — migration + import strings", () => {
  it("resolves the migrationDryRun setting name + hint", () => {
    expect(typeof resolve("ADND2E.settings.migrationDryRun.name")).toBe("string");
    expect(typeof resolve("ADND2E.settings.migrationDryRun.hint")).toBe("string");
  });

  it("resolves every migration + import notification key", () => {
    for (const key of [
      "ADND2E.migration.migrated",
      "ADND2E.migration.dryRunComplete",
      "ADND2E.migration.failed",
      "ADND2E.import.done",
      "ADND2E.import.doneWithFailures",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

Run: `npx vitest run tests/lang/en-coverage.test.ts` — Expected: FAIL (keys resolve to `undefined`).

- [ ] **Step 4: Add the lang strings**

In `lang/en.json`, inside the `ADND2E` object: add `migrationDryRun` inside the existing `settings` object (keep it alphabetical-ish / grouped with the other settings), and add two new top-level `ADND2E` sub-objects `migration` and `import`:

```json
    "migrationDryRun": {
      "name": "Migration Dry Run",
      "hint": "When on, data migrations run on load but only log what they would change — nothing is written and the migration version is not advanced. Turn off and reload to apply migrations for real."
    }
```

```json
  "migration": {
    "migrated": "AD&D 2E: world migrated to {version}.",
    "dryRunComplete": "AD&D 2E: migration dry run complete — see the console. No data was changed.",
    "failed": "AD&D 2E: migration failed — see the console. Your world was not fully migrated."
  },
  "import": {
    "done": "AD&D 2E: imported {created} of {total} document(s).",
    "doneWithFailures": "AD&D 2E: imported {created} of {total} document(s); {failed} failed — see the console."
  }
```

Run: `npx vitest run tests/lang/en-coverage.test.ts` — Expected: PASS.

- [ ] **Step 5: Add the `SettingConfig` keys**

`src/types/global.d.ts` — in the `interface SettingConfig` block, add (after the `spellsAndMagic` group):

```ts
    // migration framework (1c.4b) — not optional-rules toggles
    "adnd2e.systemMigrationVersion": string;
    "adnd2e.migrationDryRun": boolean;
```

- [ ] **Step 6: Wire `src/system.ts`**

Add imports:

```ts
import { buildApi } from "./api";
import { registerMigrationSettings, runMigrations } from "./migrations/run";
```

In the `init` hook, after `registerSettings();`:

```ts
  registerMigrationSettings();
```

Replace the `ready` hook body:

```ts
Hooks.once("ready", async () => {
  console.log(`${SYSTEM_ID} | Ready`);
  (game.system as unknown as { api: ReturnType<typeof buildApi> }).api = buildApi();
  await runMigrations();
});
```

(`game.system.api` is set first so it is available immediately even if `runMigrations` is slow or throws.)

- [ ] **Step 7: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green; 100% coverage held (no new pure code — the two config-test / lang-test additions live in already-covered test dirs).

- [ ] **Step 8: Commit**

```bash
git add system.json package.json src/system.ts src/types/global.d.ts lang/en.json tests/lang/en-coverage.test.ts tests/config/system-json.test.ts
git commit -m "feat(system): wire the migration runner + importContent api; bump to 0.2.0

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `docs/importing-content.md`

**Files:**
- Create: `docs/importing-content.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Write the doc**

Create `docs/importing-content.md` with these sections (fill each — no placeholders):

1. **Purpose.** `game.system.api.importContent(json)` lets a GM bulk-create Items and Actors from a JSON file — the intended path for content the GM has transcribed from books they own (spell text, monster stat blocks, magic items). The system itself ships only mechanical class/race/proficiency data; it ships no rulebook prose, and this importer is how you add your own.

2. **Calling it.** GM-only, from the browser console or a macro:
   ```js
   const result = await game.system.api.importContent(myJson, { folderName: "My Homebrew" });
   console.log(result); // { created: [...], failed: [...], folders: {...} }
   ```
   `folderName` is optional (default `"Imported Content"`). Documents are created in a world folder of the matching type, created if it does not exist.

3. **The JSON envelope.** A single object with a `documents` array:
   ```json
   {
     "documents": [
       {
         "documentType": "Item",
         "type": "spell",
         "name": "Magic Missile",
         "img": "icons/svg/explosion.svg",
         "system": { "level": 1, "school": "invocation" }
       },
       {
         "documentType": "Actor",
         "type": "creature",
         "name": "Giant Rat",
         "system": { "hd": { "count": 1, "dieType": 8, "bonus": 0 } }
       }
     ]
   }
   ```
   - `documentType` — `"Item"` or `"Actor"` (required).
   - `type` — an Item or Actor subtype (required). Item subtypes: `class`, `race`, `weapon`, `armor`, `equipment`, `spell`, `weaponProficiency`, `nonweaponProficiency`, `classFeature`. Actor subtypes: `character`, `npc`, `creature`.
   - `name` — required, non-empty.
   - `img` — optional icon path.
   - `system` — optional; the subtype's `system` fields. Fields you omit take their schema defaults. The authoritative field list for each subtype is its DataModel: `src/data/item/<subtype>.ts` and `src/data/actor/<subtype>.ts` in this repo.

4. **What you get back.** `{ created: [{id,name,type,documentType}], failed: [{index,name,error}], folders: {Item?,Actor?} }`. Each document is created independently — one document with a bad `system` field lands in `failed` with the validation error, and the rest still import. A notification summarises the run; failures are also logged to the console.

5. **Limitations (this release).** Create-only — importing the same file twice makes duplicate documents; there is no update-by-id or dedup. No compendium target (documents go to a world folder; move them into a compendium yourself afterward). No folder hierarchy / adventure bundles. These are planned for a later release.

6. **Content policy.** Only import content you have the right to use — your own transcriptions from books you own, or freely-licensed material. Do not share worlds or exports containing copyrighted rulebook text.

- [ ] **Step 2: Commit**

```bash
git add docs/importing-content.md
git commit -m "docs: importing-content.md — the importContent JSON format + limitations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Dev-world smoke check (REQUIRED gated step)

**Files:** none — this is verification, not code. It runs **before** `finishing-a-development-branch`, and the branch does not finish until every check below passes or a failure is turned into a fix.

**Why gated:** 1c.3d (PR #14) and 1c.4a (PR #15) both merged without their dev-world smoke check being run and shipped, respectively, a world-load crash (`foundry.data.ActiveEffectTypeDataModel` undefined) and an un-installable manifest (`ActiveEffect` compendium type) — hotfixes #16 and #17. The Foundry glue in this plan (`runMigrations`, `importContent`, the `system.ts` wiring) has no unit-test coverage by design (spec §9); this check is its only verification.

- [ ] **Step 1: Build + link**

```bash
npm run build
npm run link   # junctions dist/ into the Foundry data dir; needs foundryconfig.json
```

- [ ] **Step 2: Migration — fresh run**

Launch Foundry v14.364, open (or create) a test world on this system.
- Console shows `adnd2e | migrating world 0.0.0 → 0.2.0` (or from whatever was stored) once, then `adnd2e | migration 0.2.0: updated N actor(s)` (N may be 0), then a "world migrated to 0.2.0" notification.
- Run in console: `game.settings.get("adnd2e", "systemMigrationVersion")` → `"0.2.0"`.
- Reload the world. The migration console line does **not** appear again (nothing pending).

- [ ] **Step 3: Migration — dry run**

- Configure Settings → enable "Migration Dry Run". Reload.
- First set the stored version back so a migration is pending: `await game.settings.set("adnd2e","systemMigrationVersion","0.0.0")`, then reload.
- Console shows `... would update "<name>": {...}` lines (or none if no actor carries the stale key) and a "dry run complete" notification. **No** "world migrated" notification.
- `game.settings.get("adnd2e","systemMigrationVersion")` → still `"0.0.0"` (not advanced).
- Turn "Migration Dry Run" off, reload → the real migration runs and the version advances to `"0.2.0"`.

- [ ] **Step 4: `multiclassPending` cleanup (if a suitable actor exists)**

If the dev world has an actor created before PR #13 (or you can hand-craft one): `actor._source.system.multiclassPending` exists before migration. After the real run: `actor._source.system.multiclassPending` is `undefined` and `actor.system.multiclass` is a populated object. If no such actor exists, note that in the report — the pure logic is unit-tested; this is a best-effort live check.

- [ ] **Step 5: `importContent` — happy path**

In the console (as GM):

```js
await game.system.api.importContent({
  documents: [
    { documentType: "Item", type: "spell", name: "Smoke Test Bolt", system: { level: 1 } },
    { documentType: "Actor", type: "creature", name: "Smoke Test Rat", system: {} }
  ]
});
```

- Returns `{ created: [<2 refs>], failed: [], folders: { Item: "...", Actor: "..." } }`.
- The Items sidebar has an "Imported Content" folder containing "Smoke Test Bolt"; the Actors sidebar has one containing "Smoke Test Rat".
- Opening each document shows no console error.

- [ ] **Step 6: `importContent` — partial failure**

```js
await game.system.api.importContent({
  documents: [
    { documentType: "Item", type: "spell", name: "Good Spell", system: { level: 2 } },
    { documentType: "Item", type: "notARealType", name: "Bad Type" },
    { documentType: "Actor", type: "creature", name: "Good Rat" }
  ]
});
```

- Returns `created.length === 2`, `failed.length === 1`, `failed[0] === { index: 1, name: "Bad Type", error: 'unknown Item subtype "notARealType"' }`.
- "Good Spell" and "Good Rat" exist; "Bad Type" does not. A notification says "imported 2 of 3 document(s); 1 failed".

- [ ] **Step 7: `importContent` — permission + envelope errors**

- As a non-GM user (or `game.user.isGM` temporarily false): `importContent({documents:[...]})` rejects with `Error: importContent is GM-only`.
- `importContent({})` rejects with `Error: import data must have a "documents" array`.
- `importContent({documents:[]})` rejects with `Error: "documents" is empty — nothing to import`.

- [ ] **Step 8: Record the result**

Write a short PASS/FAIL line per step into the SDD report / ledger. Any FAIL becomes a fix (resume the relevant implementer) before the branch finishes. Clean up the smoke-test documents (delete the "Imported Content" / "Smoke Test" docs) so they are not left in the dev world.

---

## Self-Review

**1. Spec coverage.**
- §7 "content import path — `adnd2e.importContent(json)` … validates against the item schemas and creates documents in a target compendium or folder. Format documented in `docs/`." → Task 2 (envelope), Task 4 (`importContent`, folder target, per-doc DataModel validation via `create`), Task 6 (`docs/importing-content.md`). Compendium target is explicitly deferred (noted in scope + the doc).
- §8 "migration framework — `system.json` version is source of truth; `flags.adnd2e.systemMigrationVersion` records last-migrated; on `ready` (GM only) compares versions and runs an ordered list newer than stored, then writes the new version; SP1 ships framework + list + dry-run logger." → Task 1 (pure: ordered `MIGRATIONS`, `pendingMigrations`, version compare), Task 3 (`ready`-hook GM-only runner, advances version on success, dry-run toggle), Task 5 (version bump anchors it). Note: the spec says `flags.adnd2e.systemMigrationVersion`; this plan uses a **world setting** `adnd2e.systemMigrationVersion` — the idiomatic Foundry equivalent (`flags` are per-document; "world setting" in the same spec sentence confirms the intent). Called out here as a deliberate, minor deviation.
- §9 "no Foundry mocks; `data/`, `documents/`, `sheets/` exercised manually in a linked dev world for SP1." → pure modules unit-tested (Tasks 1–2), Foundry glue dev-world verified (Task 7, gated).
- §10 scope boundary — nothing here adds sheet UI, roll execution, protected content, or Player's Option logic. The importer creates raw documents; editing them is the (deferred) sheet's job.
- §12.7 "`src/helpers/` — settings registry, handlebars setup, migration framework" → migration framework lands in `src/migrations/` + `src/data/migrations.ts` (the repo dropped `src/helpers/` in 1c.1 for `src/constants.ts` + `src/settings/`; `src/migrations/` follows that structure). §12.10 "`game.system.importContent()` API + format docs" → Tasks 4 + 6. Exposed as `game.system.api.importContent` (the current Foundry-blessed slot); `game.system.importContent` directly would pollute the `System` package instance.

**2. Placeholder scan.** No "TBD" / "add error handling" / "similar to Task N" / bare "write tests". Every code step has a complete code block; every test step has real assertions. Task 6's doc is specified section-by-section with the actual content to write, not "document the format".

**3. Type consistency.**
- `Migration.actorUpdate(sourceSystem: Record<string, unknown>, actorType: string): Record<string, unknown> | null` — identical in Task 1's interface, Task 1's `multiclassPendingCleanup`, and Task 3's call site.
- `pendingMigrations(storedVersion: string, all?: readonly Migration[])` — Task 1 defines; Task 3 calls `pendingMigrations(stored, MIGRATIONS)`.
- `parseImportEnvelope(json: unknown): ParseResult` with `RawImportDoc { documentType: "Item"|"Actor"; type; name; system?; img? }` — Task 2 defines; Task 4 consumes exactly those fields.
- `ImportResult { created: ImportedRef[]; failed: ImportFailure[]; folders: {Item?; Actor?} }` — Task 4 defines; Task 7 asserts against those exact keys.
- `buildApi(): { importContent }` — Task 4 defines; Task 5 wires `(game.system as ...).api = buildApi()`.
- Lang keys: `ADND2E.migration.{migrated,dryRunComplete,failed}` and `ADND2E.import.{done,doneWithFailures}` and `ADND2E.settings.migrationDryRun.{name,hint}` — used in Tasks 3–4, defined in Task 5, tested in Task 5.
- Setting keys: `"systemMigrationVersion"` / `"migrationDryRun"` (Task 3 constants) → `SettingConfig` `"adnd2e.systemMigrationVersion"` / `"adnd2e.migrationDryRun"` (Task 5).

No gaps found.

---

## Execution Handoff

Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, a spec+quality review between tasks, a whole-branch review at the end, then the gated Task 7 smoke check before finishing.

**2. Inline Execution** — batch execution with checkpoints in this session.

Which approach?
