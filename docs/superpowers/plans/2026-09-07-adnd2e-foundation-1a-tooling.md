# AD&D 2E Foundation — Plan 1a: Package & Tooling Conversion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing Foundry *module* skeleton into a valid, empty Foundry *system* (`adnd2e`) that loads in Foundry v13/v14, with Vitest wired in and all quality gates (`typecheck`, `lint`, `test`, `build`) green.

**Architecture:** This is the first of three plans that implement Sub-project 1 of the spec. It touches only tooling and the package manifest — no game logic, no data models, no UI. It produces a "walking skeleton": a system Foundry recognises and can boot a world with, containing zero document types yet. Plans 1b and 1c build the rules engine and the Foundry data layer on top.

**Tech Stack:** TypeScript 5 (strict, ESNext), Vite 8 (library build → `dist/system.js` + `dist/system.css`), `fvtt-types` (v13 line), Vitest (new), ESLint 10 flat config + typescript-eslint, Prettier, `vite-plugin-static-copy`. Node 24, npm, ESM throughout.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md`

## Global Constraints

- Foundry `compatibility`: `minimum: "13"`, `verified: "14"` — verbatim.
- System `id`: exactly `adnd2e`. System `title`: exactly `Advanced Dungeons & Dragons 2nd Edition`.
- No copyrighted text in the repo or packs: no spell descriptions, monster stat blocks, magic-item text, or table flavour prose. Mechanical/factual data only. (No content ships in Plan 1a at all.)
- `src/core/` must import nothing from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, or the DOM. (No `core/` files are created in Plan 1a, but the Vitest setup must not pull Foundry globals in.)
- Prettier: `printWidth: 100`, `tabWidth: 2`, `semi: true`, `singleQuote: false`, `trailingComma: "all"`. TypeScript `strict: true`.
- Package is ESM (`"type": "module"`).
- Rules math (later plans): pure functions return formula **strings**, never construct a Foundry `Roll`.

## Scope of Sub-project 1, across three plans

| Plan | Covers (spec sections) | Deliverable |
|---|---|---|
| **1a (this doc)** | §3 tooling conversion, part of §2 | Empty `adnd2e` system loads in a Foundry world; all gates green. |
| **1b** | §4 `core/` architecture, §5 rules referenced by it, §9 testing, §11 reference workflow | Framework-free rules engine, fully Vitest-covered, verified against the books table-by-table. |
| **1c** | §5 document schemas, §6 config + settings, §7 packs + importer, §8 migrations, §10 stub sheets | Create a `character` in a linked dev world, add race + class items, see correct derived THAC0/AC/saves/HP/slots/encumbrance. |

Plans 1b and 1c are written after 1a is executed and reviewed.

---

## File Structure (Plan 1a)

**Created:**
- `vitest.config.ts` — Vitest config; node environment, test root `tests/`, no Foundry globals.
- `tests/smoke.test.ts` — one trivial test proving the Vitest pipeline runs.
- `system.json` — Foundry system manifest (replaces `module.json`).
- `src/system.ts` — entry point (renamed from `src/module.ts`).
- `scripts/link-system.mjs` — dev junction into `Data/systems/<id>` (renamed from `link-module.mjs`).
- `.github/workflows/ci.yml` — CI running all gates.
- `styles/system.scss` — renamed from `styles/module.scss`.

**Modified:**
- `package.json` — `name` → `adnd2e`; add `vitest` dev dep + `test` / `test:watch` scripts; `link` script path.
- `src/helpers/constants.ts` — `MODULE_ID` → `SYSTEM_ID = "adnd2e"`.
- `src/helpers/settings.ts` — import rename; keep the single example setting for now.
- `src/apps/example-app.ts` — kept but re-pathed to the new constant (removed entirely in 1c when real sheets land). *(See Task 3 note.)*
- `src/types/global.d.ts` — setting key prefix `adnd2e.`.
- `vite.config.ts` — entry/filename/copy targets for a system.
- `eslint.config.js` — add `packs/**` and `coverage/**` to `ignores`.
- `lang/en.json` — top-level key `MY-MODULE` → `ADND2E`; minimal content.
- `README.md` — rewrite for the system.
- `.gitignore` — add `coverage/`.
- `tsconfig.json` — add `"tests"` to `include`.

**Deleted:**
- `module.json` (replaced by `system.json`).
- `src/module.ts` (renamed to `src/system.ts`).
- `styles/module.scss` (renamed to `styles/system.scss`).
- `scripts/link-module.mjs` (renamed to `scripts/link-system.mjs`).

---

## Task 1: Wire in Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`
- Modify: `tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run test` runs Vitest against `tests/**/*.test.ts` in a Node environment with no Foundry globals. Later plans add `tests/core/**` suites.

- [ ] **Step 1: Add the failing smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test pipeline", () => {
  it("runs pure TypeScript with no Foundry globals", () => {
    expect(typeof (globalThis as Record<string, unknown>).game).toBe("undefined");
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 2: Run it — expect failure (Vitest not installed)**

Run: `npm run test`
Expected: FAIL — `test` script does not exist / `vitest: command not found`.

- [ ] **Step 3: Install Vitest and add scripts**

Run: `npm install --save-dev vitest@^3`

Then edit `package.json` `scripts` to add (keep existing entries):

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // core/ is framework-free; no setup file, no Foundry globals.
  },
});
```

- [ ] **Step 5: Add `tests` to `tsconfig.json` `include`**

Change `"include": ["src"]` to:

```json
  "include": ["src", "tests"]
```

- [ ] **Step 6: Add `coverage/` to `.gitignore`**

Append a line `coverage/` to `.gitignore`.

- [ ] **Step 7: Run the smoke test — expect pass**

Run: `npm run test`
Expected: PASS — 1 passed.

- [ ] **Step 8: Run typecheck — expect pass**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke.test.ts tsconfig.json .gitignore
git commit -m "build: add Vitest for the framework-free rules engine"
```

---

## Task 2: Replace `module.json` with `system.json`

**Files:**
- Delete: `module.json`
- Create: `system.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a valid Foundry **system** manifest at repo root. `esmodules` points at `system.js`, `styles` at `system.css` (both produced by Vite in Task 5). No `documentTypes` yet — added in Plan 1c alongside their data models to avoid a state where Foundry warns about type-less models.

- [ ] **Step 1: Create `system.json`**

```json
{
  "id": "adnd2e",
  "title": "Advanced Dungeons & Dragons 2nd Edition",
  "description": "An implementation of the Advanced Dungeons & Dragons 2nd Edition rules, with heavy automation. Game mechanics only — no rulebook content is included.",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "13",
    "verified": "14"
  },
  "authors": [{ "name": "Joshua Frank" }],
  "esmodules": ["system.js"],
  "styles": ["system.css"],
  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" }
  ],
  "grid": { "distance": 5, "units": "ft" },
  "primaryTokenAttribute": "attributes.hp",
  "initiative": "1d10",
  "flags": {
    "adnd2e": {},
    "hotReload": {
      "extensions": ["css", "hbs", "json"],
      "paths": ["styles", "templates", "lang"]
    }
  },
  "url": "",
  "manifest": "",
  "download": ""
}
```

- [ ] **Step 2: Delete `module.json`**

```bash
git rm module.json
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('system.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add system.json
git commit -m "feat: replace module manifest with system.json (adnd2e)"
```

---

## Task 3: Rename entry point and constant

**Files:**
- Create: `src/system.ts` (from `src/module.ts`)
- Delete: `src/module.ts`
- Modify: `src/helpers/constants.ts`
- Modify: `src/helpers/settings.ts`
- Modify: `src/apps/example-app.ts`
- Modify: `src/types/global.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SYSTEM_ID` constant exported from `src/helpers/constants.ts` with value `"adnd2e"`. Entry module is `src/system.ts`. All existing imports resolve.

> **Note on `example-app.ts`:** it is a leftover module demo. Plan 1c deletes it when real stub sheets are added. For now, keep it compiling so `typecheck`/`build` stay green — only its import of the constant changes.

- [ ] **Step 1: Rename the entry file**

```bash
git mv src/module.ts src/system.ts
```

- [ ] **Step 2: Update `src/helpers/constants.ts`**

Replace the file contents with:

```ts
export const SYSTEM_ID = "adnd2e";
```

- [ ] **Step 3: Update `src/system.ts`**

Replace every `MODULE_ID` with `SYSTEM_ID`, update the import, and point the style import at the renamed Sass file (renamed in Task 5 — the import path is written now):

```ts
import "../styles/system.scss";
import { SYSTEM_ID } from "./helpers/constants";
import { registerSettings } from "./helpers/settings";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${SYSTEM_ID} | Ready`);
});
```

(Removes the `example-app` API wiring — it was a module-only demo. The file stays in the tree, just unreferenced from the entry point, until Plan 1c.)

- [ ] **Step 4: Update `src/helpers/settings.ts`**

Replace `MODULE_ID` import and usage with `SYSTEM_ID`; change the localization keys' prefix from `MY-MODULE` to `ADND2E`:

```ts
import { SYSTEM_ID } from "./constants";

export function registerSettings(): void {
  game.settings!.register(SYSTEM_ID, "exampleSetting", {
    name: "ADND2E.settings.exampleSetting.name",
    hint: "ADND2E.settings.exampleSetting.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}
```

- [ ] **Step 5: Update `src/apps/example-app.ts`**

Change the import `import { MODULE_ID } from "../helpers/constants";` to `import { SYSTEM_ID } from "../helpers/constants";` and replace the two `${MODULE_ID}` template usages and the `MY-MODULE.*` i18n keys with `${SYSTEM_ID}` and `ADND2E.*`.

- [ ] **Step 6: Update `src/types/global.d.ts`**

```ts
export {};

declare global {
  interface SettingConfig {
    "adnd2e.exampleSetting": boolean;
  }
}
```

- [ ] **Step 7: Typecheck — expect pass**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename module entry/constant to system (SYSTEM_ID=adnd2e)"
```

---

## Task 4: Rename Sass entry

**Files:**
- Create: `styles/system.scss` (from `styles/module.scss`)
- Delete: `styles/module.scss`

**Interfaces:**
- Consumes: the import path `../styles/system.scss` written in Task 3.
- Produces: `styles/system.scss` exists; Vite (Task 5) bundles it to `dist/system.css`.

- [ ] **Step 1: Rename**

```bash
git mv styles/module.scss styles/system.scss
```

- [ ] **Step 2: Replace the placeholder class name**

Replace the file contents with:

```scss
// AD&D 2E system styles. Real sheet styles land in Plans 1c / 2 / 6.
.adnd2e {
  // namespace root for system UI
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename styles/module.scss to styles/system.scss"
```

---

## Task 5: Point Vite at the system build

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `src/system.ts`, `styles/system.scss`, `system.json`, `lang/`, `templates/`.
- Produces: `npm run build` emits `dist/system.js`, `dist/system.css`, `dist/system.json`, `dist/lang/en.json`, `dist/templates/…`.

- [ ] **Step 1: Rewrite `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/system.ts",
      formats: ["es"],
      fileName: () => "system.js",
      cssFileName: "system",
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "system.json", dest: "." },
        { src: "lang", dest: "." },
        { src: "templates", dest: "." },
      ],
    }),
  ],
});
```

- [ ] **Step 2: Build — expect success**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Verify output**

Run: `ls dist && test -f dist/system.js && test -f dist/system.css && test -f dist/system.json && echo "artifacts ok"`
Expected: `artifacts ok`.

- [ ] **Step 4: Confirm `dist/system.json` id**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('dist/system.json','utf8')).id)"`
Expected: `adnd2e`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "build: emit dist/system.js + dist/system.css for the system"
```

---

## Task 6: Rename the dev-link script for systems

**Files:**
- Create: `scripts/link-system.mjs` (from `scripts/link-module.mjs`)
- Delete: `scripts/link-module.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `foundryconfig.json` (`dataPath`), `system.json` (`id`), `dist/`.
- Produces: `npm run link` junctions `dist/` → `<dataPath>/Data/systems/adnd2e`.

- [ ] **Step 1: Rename**

```bash
git mv scripts/link-module.mjs scripts/link-system.mjs
```

- [ ] **Step 2: Update the script**

In `scripts/link-system.mjs`, change the two references from module to system:

- `JSON.parse(readFileSync(resolve("module.json"), "utf-8"))` → `JSON.parse(readFileSync(resolve("system.json"), "utf-8"))`
- `const modulesDir = join(dataPath, "Data", "modules");` → `const systemsDir = join(dataPath, "Data", "systems");`
- update `mkdirSync(modulesDir, …)` and `join(modulesDir, moduleId)` to use `systemsDir` and rename the local `moduleId` var to `systemId`.
- update the two `console.error` / `console.log` strings that say "module" to say "system".

- [ ] **Step 3: Update `package.json`**

Change `"link": "node scripts/link-module.mjs"` to `"link": "node scripts/link-system.mjs"`.

- [ ] **Step 4: Dry-run the script without `foundryconfig.json`**

Run: `npm run link`
Expected: exits non-zero with the "Missing foundryconfig.json" message (proves the script runs and the rename didn't break it). If `foundryconfig.json` exists locally, expect it to junction into `Data/systems/adnd2e` instead — also acceptable.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build: link dev build into Data/systems instead of Data/modules"
```

---

## Task 7: Localization file, ESLint ignores, README, CI

**Files:**
- Modify: `lang/en.json`
- Modify: `eslint.config.js`
- Modify: `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the i18n keys referenced in `settings.ts` / `example-app.ts` (`ADND2E.*`).
- Produces: green `npm run lint`; CI that runs `typecheck`, `lint`, `test`, `build` on push and PR.

- [ ] **Step 1: Rewrite `lang/en.json`**

```json
{
  "ADND2E": {
    "system": {
      "title": "Advanced Dungeons & Dragons 2nd Edition"
    },
    "exampleApp": {
      "title": "AD&D 2E",
      "message": "Placeholder window. Real sheets arrive in a later plan."
    },
    "settings": {
      "exampleSetting": {
        "name": "Example Setting",
        "hint": "Placeholder world setting. The optional-rules registry replaces this in Plan 1c."
      }
    }
  }
}
```

- [ ] **Step 2: Add ignores to `eslint.config.js`**

Change the `ignores` entry from `["dist/**"]` to:

```js
    ignores: ["dist/**", "packs/**", "coverage/**"],
```

- [ ] **Step 3: Lint — expect pass**

Run: `npm run lint`
Expected: no errors (warnings tolerated).

- [ ] **Step 4: Rewrite `README.md`**

Replace the file with:

```markdown
# Advanced Dungeons & Dragons 2nd Edition — Foundry VTT System

A Foundry VTT **game system** (id `adnd2e`) implementing the AD&D 2nd Edition
rules with heavy automation. Built with TypeScript + Vite, targeting Foundry
v13 (verified v14).

**Content policy:** this repository contains game *mechanics* only — no rulebook
text, spell descriptions, monster stat blocks, or magic-item text. A JSON import
path (added in a later plan) lets you load content you own into your world.

## Architecture

- `src/core/` — framework-free rules engine (pure functions + lookup tables),
  unit-tested with Vitest. Imports nothing from Foundry.
- `src/data/` — Foundry DataModels; thin adapters that delegate computation to `core/`.
- `src/documents/`, `src/sheets/` — Foundry Document and Application subclasses.

Implementation proceeds in sub-projects; see `docs/superpowers/specs/` and
`docs/superpowers/plans/`.

## Setup

```sh
npm install
```

## Scripts

```sh
npm run build        # production build -> dist/
npm run watch        # rebuild on change
npm run test         # Vitest (rules engine)
npm run test:watch
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src
npm run format       # prettier --write src
npm run link         # junction dist/ into <dataPath>/Data/systems/adnd2e
```

## Developing against a local Foundry install

1. Copy `foundryconfig.example.json` to `foundryconfig.json`, set `dataPath` to
   your Foundry user-data directory (the folder containing `Data/`, `Config/`,
   `Logs/`). Gitignored.
2. `npm run build`
3. `npm run link`
4. `npm run watch` while developing; reload the world (F5) after each rebuild.
5. Create or edit a world that uses the "Advanced Dungeons & Dragons 2nd Edition" system.
```

- [ ] **Step 5: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 6: Full gate run — expect all pass**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all four succeed, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: system README, i18n keys, eslint ignores, CI workflow"
```

---

## Task 8: Manual Foundry load check + tag

**Files:** none (verification only).

**Interfaces:**
- Consumes: `dist/` from `npm run build`, `npm run link`.
- Produces: confirmation the system boots; a `v0.1.0-1a` git tag.

- [ ] **Step 1: Build and link**

Run: `npm run build && npm run link`
Expected: both succeed; junction created at `<dataPath>/Data/systems/adnd2e` (requires `foundryconfig.json`).

- [ ] **Step 2: Manual check in Foundry (human step)**

Start Foundry. Confirm:
- "Advanced Dungeons & Dragons 2nd Edition" appears in **Game Systems**.
- Creating a world with it succeeds and the world launches.
- The console shows `adnd2e | Initializing` and `adnd2e | Ready`.
- Expected/acceptable: no document types exist yet, so the Actors/Items sidebars offer no creatable types. Data-model warnings are **not** expected (no `documentTypes` declared until Plan 1c).

Record the result (pass/fail + any console errors) in the execution notes.

- [ ] **Step 3: Tag the milestone**

```bash
git tag -a v0.1.0-1a -m "Plan 1a: empty adnd2e system loads; tooling converted"
```

---

## Self-Review

**1. Spec coverage (Plan 1a's declared scope = spec §3 + part of §2):**

| Spec item | Task |
|---|---|
| §3.1 `system.json` core fields, compatibility, grid, initiative, primaryTokenAttribute, flags | Task 2 |
| §3.1 `documentTypes` | Deferred to Plan 1c (with data models) — noted in Task 2 |
| §3.2 `package.json` name + vitest + test scripts | Tasks 1, 3, 6 |
| §3.2 `vite.config.ts` entry/filename/copy | Task 5 |
| §3.2 `link-module.mjs` → `link-system.mjs`, `Data/systems` | Task 6 |
| §3.2 `README.md` rewrite | Task 7 |
| §3.2 `foundryconfig.example.json` unchanged | Not touched (correct) |
| §3.2 `vitest.config.ts` | Task 1 |
| §3.2 `tsconfig.json` add `tests` | Task 1 |
| §3.2 CI workflow | Task 7 |
| §3.3 keep `fvtt-types` | Untouched (correct) |
| §4 `src/system.ts` entry point (hooks only) | Task 3 |
| §7 pack build pipeline | Deferred to Plan 1c (needs pack content) — noted in scope table |
| §9 CI command sequence | Task 7 Step 5 |

Spec §4 (`core/` layout), §5 (schemas), §6 (config/settings), §8 (migrations), §10 (stub sheets), §11 (reference workflow) are explicitly out of Plan 1a's scope — covered by Plans 1b and 1c per the scope table.

**2. Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"/"similar to Task N". `example-app.ts` is kept deliberately (removal scheduled for 1c) with its exact edit spelled out. All code steps have literal code.

**3. Type consistency:** `SYSTEM_ID` (string `"adnd2e"`) used identically in `constants.ts`, `system.ts`, `settings.ts`, `example-app.ts`. i18n prefix `ADND2E.` consistent across `settings.ts`, `example-app.ts`, `lang/en.json`. Setting key `adnd2e.exampleSetting` consistent between `settings.ts` registration (`SYSTEM_ID`, `"exampleSetting"`) and `global.d.ts`. `system.json` `id` `adnd2e` matches `link-system.mjs` junction target and the `dist/system.json` assertion in Task 5 Step 4.

**4. Vitest version:** pinned `^3` (Task 1 Step 3) — current major. `test:coverage` references `--coverage`; if `@vitest/coverage-v8` is not present the script errors only when run, which is acceptable (not in the CI gate). If the executor wants coverage in CI, add `@vitest/coverage-v8` — out of scope here.

No issues requiring rework.
