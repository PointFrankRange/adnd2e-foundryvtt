# AD&D 2E — Compendium Pack Tooling + Seed Content (Plan 1c.4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the compendium-pack pipeline (`build:packs` → Foundry v14 LevelDB) and ship the five seed packs — classes, races, non-weapon proficiencies, conditions, weapon-proficiency groups — plus the `TYPES.*` i18n labels.

**Architecture:** Pack source is one-JSON-document-per-file under `packs/<name>/_source/`, compiled to `dist/packs/<name>/` (LevelDB) by `scripts/build-packs.mjs` via `@foundryvtt/foundryvtt-cli`, which `npm run build` runs after Vite. Pack *content* is validated two ways: a pure Vitest suite (`tests/packs/**`) checks structure and cross-checks every enum-typed field against `src/core/**` unions; the schema-true validation happens when Foundry loads the compiled pack (dev-world verified).

**Tech Stack:** `@foundryvtt/foundryvtt-cli` v3 (`compilePack`), Node ESM build scripts, Vitest, the existing `src/core/**` enums (`CLASS_IDS`, `RACE_IDS`, `ABILITY_KEYS`, `NONWEAPON_GROUPS`, `WIZARD_SCHOOLS`), Foundry v14.364 DataModels.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §7 (compendium packs), §11 (reference-material workflow), §12 (deliverables checklist item 9), §10 (scope boundary — SP1 ships mechanical class/race/proficiency data only).

**Predecessors:** 1a–1c.3d all merged (PRs through #14). This is the **first of three 1c.4 slices**: 1c.4b = `game.system.adnd2e.importContent(json)` + format docs + the migration framework + the `multiclassPending → multiclass` migration; 1c.4c = generic raw-field stub sheets + README rewrite.

## Global Constraints

- **Two-layer / gated zone:** `src/core/**`, `src/data/derive/**`, `src/data/item/{subtypes,choices}.ts`, `src/data/actor/subtypes.ts`, `src/data/active-effect/subtypes.ts`, and — added by this plan — `src/conditions.ts`, plus every test under `tests/core/**` and `tests/data/**` and `tests/packs/**`, import **nothing** from `foundry` / `fvtt-types` / `game` / `CONFIG` / DOM. `tsc -p tsconfig.core.json --noEmit` proves it; ESLint's `no-restricted-globals` + `no-restricted-imports` fence the same set. Task 5 adds `src/conditions.ts` to `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, and **both** ESLint blocks. Task 1 adds `tests/packs/**/*.ts` to the ESLint Foundry-globals `ignores` list and the pure-zone `files` list (mirroring `tests/data/**`) — but **not** to `tsconfig.core.json` (test dirs stay out of it per the file's own comment; `tests/packs` type-checks under the base `tsconfig.json` which already has `"include": ["src", "tests"]`).
- **Coverage gate:** `npm run test:coverage` enforces **100%** lines / statements / functions / branches on the gated `src/` set. `src/conditions.ts` is a `const` array with one exported helper at most — it must reach 100% via the drift test. New test files add no coverable source.
- **Foundry is v14.364.** `fvtt-types` pins a v13-beta line and is wrong about several v14 APIs. For `CONFIG.statusEffects` shape and any pack/LevelDB detail, **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`** — plain readable source. (`CONFIG.statusEffects` is a `Proxy([])` at `client/config.mjs:1688`, filled by core.)
- **`npm install` is forbidden for implementers** *except* Task 1's single `npm install --save-dev @foundryvtt/foundryvtt-cli` — Task 1 must run exactly that command and commit the `package.json` + `package-lock.json` delta as its own step; no other `npm install`, no `npm run format`, no `prettier`.
- **Content policy — mechanical / factual values ONLY.** No rulebook prose, flavour text, or descriptions in any pack document: `system.description` (and any HTML field) stays `""`. `references/` (the PHB/DMG/MM PDFs) is git-ignored and never committed. Transcribe from the **rendered PHB pages** per §11: render the PDF page to an image and read the table visually (`pdftotext` OCR is unreliable on these scanned books; PyMuPDF is installed — `pip install PyMuPDF` already done). Every transcription task writes a `packs/<name>/_source/_MANIFEST.md` citing the exact PHB page(s) each value came from.
- **Enum is the authority:** a pack value that fails a `tests/packs/content.test.ts` enum check is a transcription error — fix the pack JSON, never the enum.
- **Full gate:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` now runs `build:packs`; a task must confirm it produces populated `dist/packs/<name>/` LevelDB directories (each contains a `CURRENT`, `LOCK`, `*.ldb`/`*.log`).
- **Do NOT run `npm run format` / `prettier`.**
- **Commit trailer:** `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **PR body trailer:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## Scope boundary (recorded — NOT built here)

- `game.system.adnd2e.importContent(json)` + the content-format docs → **1c.4b**.
- The migration framework (`systemMigrationVersion` flag, ordered list, dry-run logger) + the `multiclassPending → multiclass` migration → **1c.4b**.
- Generic raw-field stub `ActorSheet` / `ItemSheet` + README rewrite → **1c.4c**.
- Equipment / weapons / armor / spell packs — deferred past Sub-project 1 (spec §10).
- Per-condition `changes` mechanics (prone → AC penalty, etc.) → SP3 / SP7. The `conditions` pack ships each effect with `system.changes: []`.
- `scripts/unpack.mjs` (`extractPack` round-trip, for pulling in-world edits back to source) → later 1c.4 follow-up.
- Weapon-proficiency *groups* are a pragmatic starter set, not PHB-formal — SP7 (Combat & Tactics) defines real weapon groups.

## AD&D 2E reference — where each transcribed value lives

The implementer renders these PHB pages to images and reads them directly (§11). Page numbers are the standard 2E PHB (revised, black cover); if a render shows a different layout, locate the same table by its title.

- **Racial ability adjustments / limits** — already in `src/core/abilities/racial-adjustments.ts` (do not re-transcribe; the race pack does not carry ability scores).
- **Base movement** — already in `src/core/encumbrance/movement.ts` `BASE_MOVEMENT`: human 12, dwarf 6, elf 12, half-elf 12, gnome 6, halfling 6.
- **Which single classes each race may take, and the level limit per race×class** — PHB Chapter 2 (Player Character Races), the class-restrictions / level-limit table (around p.26) and each race's own description.
- **Allowed multi-class combinations per race** — PHB Chapter 3 ("Multi-Class Characters", ~p.44), each demihuman's list.
- **Bonus languages per race** — each race's description in Chapter 2 ("A dwarf can also learn the following languages: …").
- **Infravision** — each race description: 60 ft for dwarf, elf, gnome, halfling, and half-elf; humans have none.
- **Non-weapon proficiencies** — PHB Chapter 5, the Non-Weapon Proficiency tables (the group tables at ~p.55 and the per-proficiency list with # of slots / relevant ability / check modifier at ~p.56–58). Groups are `general` / `warrior` / `wizard` (a.k.a. "Wizard") / `priest` (a.k.a. "Priest") / `rogue`.

---

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `package.json`, `package-lock.json` | `@foundryvtt/foundryvtt-cli` dev dep; `build:packs` script; `build` chained | 1 |
| `scripts/build-packs.mjs` | compile every `packs/*/_source` → `dist/packs/*` | 1 |
| `.gitignore` | (verify `dist/` covers `dist/packs/`; no change expected) | 1 |
| `eslint.config.js` | add `tests/packs/**` to both blocks | 1 |
| `tests/packs/source.test.ts` | structural validation of every `_source/*.json` + `system.json` ↔ dirs ↔ `packFolders` consistency | 1 |
| `packs/classes/_source/*.json` | 16 `class` items (8 chassis + 8 wizard specialists) | 2 |
| `packs/races/_source/*.json` + `_MANIFEST.md` | 6 `race` items (Tables: class restrictions, level limits, multiclass, languages) | 3 |
| `packs/nonweapon-proficiencies/_source/*.json` + `_MANIFEST.md` | ~70 `nonweaponProficiency` items (PHB NWP tables) | 4 |
| `packs/conditions/_source/*.json` | ~15 `adnd2e` ActiveEffect docs | 5 |
| `src/conditions.ts` | `CONDITIONS: readonly Condition[]` (id / name / img) | 5 |
| `src/system.ts` | populate `CONFIG.statusEffects` from `CONDITIONS` | 5 |
| `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js` | add `src/conditions.ts` to the gated set | 5 |
| `tests/conditions.test.ts` | `src/conditions.ts` ↔ `conditions` pack drift | 5 |
| `packs/weapon-proficiency-groups/_source/*.json` | 8 `weaponProficiency` group items | 6 |
| `system.json` | `packs` array (5) + `packFolders` (add "Conditions" subfolder, assign packs) | 7 |
| `lang/en.json` | `TYPES` block (Actor 3 / Item 9 / ActiveEffect 1) | 8 |
| `tests/lang/en-coverage.test.ts` | `TYPES` drift vs the subtype constants | 8 |
| `tests/packs/content.test.ts` | count + enum cross-checks against `src/core/**` unions | 9 |

---

## Task 1: Pack build pipeline

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `scripts/build-packs.mjs`
- Modify: `eslint.config.js`
- Create: `tests/packs/source.test.ts`
- Create: `packs/classes/_source/.gitkeep` (temporary — Task 2 replaces it with real docs)

**Interfaces:**
- Produces: `npm run build:packs` compiles `packs/<name>/_source/*.json` → `dist/packs/<name>/`. `npm run build` = `vite build && npm run build:packs`.
- Produces: `tests/packs/source.test.ts` exports nothing; it is the structural gate every later pack task must keep green.

- [ ] **Step 1: Install the CLI**

Run **exactly**: `npm install --save-dev @foundryvtt/foundryvtt-cli`
Expected: `package.json` `devDependencies` gains `"@foundryvtt/foundryvtt-cli": "^3.0.4"` (or the current 3.x), `package-lock.json` updates. This is the ONLY permitted `npm install`.

- [ ] **Step 2: Confirm the programmatic API**

Run: `node -e "import('@foundryvtt/foundryvtt-cli').then(m => console.log(Object.keys(m)))"`
Expected: the export list includes `compilePack` and `extractPack`. If it does NOT (v3 changed the surface), read `node_modules/@foundryvtt/foundryvtt-cli/package.json` `exports` and `node_modules/@foundryvtt/foundryvtt-cli/dist/*.mjs` to find the compile entry point, and adjust Step 3 accordingly — note the deviation in the report.

- [ ] **Step 3: Write `scripts/build-packs.mjs`**

```js
// Compile every packs/<name>/_source into a Foundry v14 LevelDB pack under
// dist/packs/<name>. Runs after `vite build` (which empties dist/ and copies the
// static assets), so we only add the packs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "system.json"), "utf8"));
const packs = manifest.packs ?? [];

if (packs.length === 0) {
  console.log("build-packs: system.json declares no packs — nothing to do.");
  process.exit(0);
}

for (const pack of packs) {
  const src = path.join(root, "packs", pack.name, "_source");
  const dest = path.join(root, "dist", "packs", pack.name);
  console.log(`build-packs: ${pack.name}  ${src} -> ${dest}`);
  await compilePack(src, dest, { log: true, recursive: false });
}
console.log(`build-packs: compiled ${packs.length} pack(s).`);
```

If Step 2 found a different API shape, use it here (same intent: src dir of JSON → dest LevelDB dir).

- [ ] **Step 4: Wire `package.json` scripts**

In `"scripts"`:
- add `"build:packs": "node scripts/build-packs.mjs"`
- change `"build": "vite build"` → `"build": "vite build && npm run build:packs"`

- [ ] **Step 5: ESLint — allow `tests/packs/**`**

In `eslint.config.js`, add `"tests/packs/**"` to the Foundry-globals block's `ignores` array and `"tests/packs/**/*.ts"` to the pure-zone block's `files` array (both currently end `…, "tests/data/**"` / `…, "tests/data/**/*.ts"]`). Also add `"scripts/**/*.mjs"` to the existing Node-tooling `files` block if `build-packs.mjs` trips a `no-undef` on `process` / `console` (there is already a `scripts/**/*.{js,mjs,cjs}` entry — confirm `.mjs` matches).

- [ ] **Step 6: Write the structural test** — `tests/packs/source.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import manifest from "../../system.json";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

const ROOT = path.resolve(__dirname, "..", "..");
const PACKS = (manifest as unknown as { packs?: { name: string; path: string; type: string }[] }).packs ?? [];

function sourceFiles(packName: string): string[] {
  const dir = path.join(ROOT, "packs", packName, "_source");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
}

describe("pack source structure", () => {
  it("system.json packs each have a packs/<name>/_source directory", () => {
    for (const p of PACKS) {
      const dir = path.join(ROOT, "packs", p.name, "_source");
      expect(existsSync(dir) && statSync(dir).isDirectory(), `${p.name}/_source`).toBe(true);
      expect(p.path, p.name).toBe(`packs/${p.name}`);
    }
  });

  it("every _source document parses and has _id / name / type", () => {
    for (const p of PACKS) {
      for (const file of sourceFiles(p.name)) {
        const doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
        expect(typeof doc._id, file).toBe("string");
        expect((doc._id as string).length, file).toBe(16);
        expect(/^[A-Za-z0-9]{16}$/.test(doc._id as string), `${file} _id charset`).toBe(true);
        expect(typeof doc.name, file).toBe("string");
        expect((doc.name as string).length, file).toBeGreaterThan(0);
        expect(typeof doc.type, file).toBe("string");
      }
    }
  });

  it("document type matches the pack's declared document type + a registered subtype", () => {
    for (const p of PACKS) {
      for (const file of sourceFiles(p.name)) {
        const doc = JSON.parse(readFileSync(file, "utf8")) as { type: string };
        if (p.type === "Item") expect(ITEM_SUBTYPES as readonly string[], file).toContain(doc.type);
        else if (p.type === "ActiveEffect") expect(ACTIVE_EFFECT_SUBTYPES as readonly string[], file).toContain(doc.type);
        else throw new Error(`${p.name}: unexpected pack type ${p.type}`);
      }
    }
  });

  it("_id values are unique within each pack", () => {
    for (const p of PACKS) {
      const ids = sourceFiles(p.name).map((f) => (JSON.parse(readFileSync(f, "utf8")) as { _id: string })._id);
      expect(new Set(ids).size, p.name).toBe(ids.length);
    }
  });

  it("every packFolders pack reference resolves to a declared pack", () => {
    const declared = new Set(PACKS.map((p) => p.name));
    const folders = (manifest as unknown as { packFolders?: unknown[] }).packFolders ?? [];
    const collect = (node: unknown): string[] => {
      if (!node || typeof node !== "object") return [];
      const n = node as { packs?: string[]; folders?: unknown[] };
      return [...(n.packs ?? []), ...(n.folders ?? []).flatMap(collect)];
    };
    for (const ref of folders.flatMap(collect)) {
      expect(declared.has(ref), `packFolders ref "${ref}"`).toBe(true);
    }
  });
});
```

- [ ] **Step 7: Run it — expect PASS (vacuously)**

Run: `npx vitest run tests/packs/source.test.ts`
Expected: PASS. `system.json` has no `packs` key yet, so `PACKS` is `[]` and every test is a no-op loop. The `classes/_source/.gitkeep` keeps the dir in git for Task 2.

- [ ] **Step 8: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `npm run build` runs `build:packs`, which prints "system.json declares no packs — nothing to do." and exits 0. Coverage unchanged (no new source).

**Ruling slot (record in the ledger if hit):** if `@foundryvtt/foundryvtt-cli` fails to install or build in CI (it pulls `classic-level`, a native module), gate `build:packs` with an env check — `if (process.env.SKIP_PACKS) process.exit(0)` at the top of `build-packs.mjs` — and set `SKIP_PACKS=1` in the CI `build` step, leaving local `npm run build` to compile packs. Prefer the un-gated path; only fall back on a real CI failure.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json scripts/build-packs.mjs eslint.config.js tests/packs/source.test.ts packs/classes/_source/.gitkeep
git commit -m "build(packs): compilePack pipeline + structural source test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `classes` pack (16 documents)

**Files:**
- Create: `packs/classes/_source/*.json` (16 files)
- Delete: `packs/classes/_source/.gitkeep`

**Interfaces:**
- Consumes: the `class` item schema — `system` fields `chassisId` (choices `CLASS_IDS`), `specialistSchool` (nullable, choices `WIZARD_SCHOOLS`), `kit` (nullable), `grantedFeatures` (string[]), `xp` (int ≥ 0), `hpRolls` (int[]), `dualClassState` (nullable), `description` (HTML).

**Content (no PHB render needed — this is a known list):**

The 8 chassis, one file each. File name = `<chassisId>.json`. Each:
```json
{
  "_id": "<16 random alphanumerics>",
  "name": "Fighter",
  "type": "class",
  "img": "icons/svg/sword.svg",
  "system": {
    "description": "",
    "chassisId": "fighter",
    "specialistSchool": null,
    "kit": null,
    "grantedFeatures": [],
    "xp": 0,
    "hpRolls": [],
    "dualClassState": null
  }
}
```
- `fighter` → name "Fighter", img `icons/svg/sword.svg`
- `mage` → "Mage", `icons/svg/book.svg`
- `cleric` → "Cleric", `icons/svg/angel.svg`
- `thief` → "Thief", `icons/svg/coins.svg`
- `paladin` → "Paladin", `icons/svg/holy-shield.svg`
- `ranger` → "Ranger", `icons/svg/oak.svg`
- `druid` → "Druid", `icons/svg/tree.svg`
- `bard` → "Bard", `icons/svg/sound.svg`

The 8 wizard specialists, one file each. File name = `<school>.json`. Each has `chassisId: "mage"`, `specialistSchool: "<school>"`, img `icons/svg/book.svg`:
- `abjuration` → name "Abjurer"
- `alteration` → "Transmuter"
- `conjuration` → "Conjurer"
- `divination` → "Diviner"
- `enchantment` → "Enchanter"
- `illusion` → "Illusionist"
- `invocation` → "Invoker"
- `necromancy` → "Necromancer"

If any listed `icons/svg/*.svg` path does not exist in the installed Foundry (`C:\Program Files\Foundry Virtual Tabletop\resources\app\public\icons\svg\`), substitute the closest one that does and note the swap.

- [ ] **Step 1: Generate 16 `_id` values**

Run: `node -e "for(let i=0;i<16;i++)console.log([...Array(16)].map(()=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join(''))"`
Use one per file. (Foundry's own id charset.)

- [ ] **Step 2: Write the 16 files** per the content above. Delete `.gitkeep`.

- [ ] **Step 3: Verify against the structural test**

Run: `npx vitest run tests/packs/source.test.ts`
Expected: PASS — 16 `classes` docs, all `type: "class"`, unique 16-char ids.

- [ ] **Step 4: Full gate + confirm the pack compiles**

Run: `npm run build`
Expected: `build-packs` prints `build-packs: classes …` and creates `dist/packs/classes/` containing LevelDB files (`CURRENT`, `LOCK`, `MANIFEST-*`, `*.log`). Then `npm run typecheck && npm run lint && npm run test:coverage`.

Note: `system.json` still has no `packs` entry for `classes` yet (Task 7), so `build-packs` won't see it. To smoke-test the compile in isolation, temporarily add a `packs: [{ "name": "classes", "path": "packs/classes", "type": "Item", "system": "adnd2e" }]` to `system.json`, run `npm run build`, confirm `dist/packs/classes/`, then **revert that `system.json` edit** (Task 7 owns it). Or skip the isolation check and rely on Task 7's gate. State which you did.

- [ ] **Step 5: Commit**

```bash
git add packs/classes
git commit -m "content(packs): classes — 8 chassis + 8 wizard specialists

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `races` pack (6 documents — TRANSCRIPTION)

**Files:**
- Create: `packs/races/_source/*.json` (6 files — `human.json`, `dwarf.json`, `elf.json`, `gnome.json`, `half-elf.json`, `halfling.json`)
- Create: `packs/races/_source/_MANIFEST.md` (PHB page citations)

**Interfaces:**
- Consumes: the `race` item schema — `system` fields `raceId` (choices `RACE_IDS`), `size` (choices `CREATURE_SIZES` = tiny/small/medium/large/huge/gargantuan), `baseMovement` (int ≥ 0), `infravision` (int ≥ 0), `classLevelLimits` (free-form object), `allowedClasses` (string[], choices `CLASS_IDS`), `allowedMulticlass` (string[][], choices `CLASS_IDS`), `bonusLanguages` (string[]), `grantedFeatures` (string[]), `description` (HTML — stays `""`).

**Known values (do NOT re-derive):**
- `size`: human "medium", dwarf "small", elf "medium", gnome "small", half-elf "medium", halfling "small".
- `baseMovement`: human 12, dwarf 6, elf 12, gnome 6, half-elf 12, halfling 6 (matches `src/core/encumbrance/movement.ts` `BASE_MOVEMENT`).
- `infravision`: human 0; dwarf / elf / gnome / halfling / half-elf 60.
- `grantedFeatures`: `[]` for all (class-feature refs are a later slice).

**Transcribe from the rendered PHB (cite every page in `_MANIFEST.md`):**
- `classLevelLimits`: an object `{ "<classId>": <maxLevel | null>, … }` — one key per class the race may reach, value = the level cap (`null` = unlimited). Human = `{}` **or** every class → `null` (choose `{}` — the derive layer treats a missing key as "unlimited"; put a `_MANIFEST.md` note). Demihumans: transcribe the per-class caps from the PHB race/class level-limit table.
- `allowedClasses`: the class ids the race may take as a **single-class** character (PHB Chapter 2 / the class-restrictions table). E.g. dwarves cannot be mages; only humans can be paladins.
- `allowedMulticlass`: the legal **multi-class combinations** (PHB Chapter 3, ~p.44), each as an array of class ids, e.g. elf `[["fighter","mage"],["fighter","thief"],["mage","thief"],["fighter","mage","thief"], …]`. Human = `[]` (humans dual-class, they do not multi-class).
- `bonusLanguages`: the extra languages the race's description lists it "may also learn" (lowercase, space-separated words as single strings, e.g. `"goblin"`, `"kobold"`).

- [ ] **Step 1: Render the PHB pages**

Use PyMuPDF to render the relevant PHB pages to PNGs into a scratch dir (NOT under `packs/` or `src/`), read them, and record every page number in `_MANIFEST.md`. The pages you need: Chapter 2 (Player Character Races) — each race's description + the class-restrictions/level-limits table (~p.26); Chapter 3 — "Multi-Class Characters" (~p.44).

```py
import fitz  # PyMuPDF
doc = fitz.open("references/Player's Handbook.pdf")
for n in range(13, 46):  # adjust once you see the chapter boundaries
    pix = doc[n].get_pixmap(dpi=200)
    pix.save(f"/tmp/phb_{n+1:03d}.png")
```

- [ ] **Step 2: Write `_MANIFEST.md`**

A table: `| field | race | value | PHB page |` for every transcribed cell, so the reviewer can spot-check.

- [ ] **Step 3: Write the 6 JSON files**

```json
{
  "_id": "<16 alphanumerics>",
  "name": "Dwarf",
  "type": "race",
  "img": "icons/svg/mountain.svg",
  "system": {
    "description": "",
    "raceId": "dwarf",
    "size": "small",
    "baseMovement": 6,
    "infravision": 60,
    "classLevelLimits": { "fighter": 15, "cleric": 10, "thief": 12 },
    "allowedClasses": ["fighter", "cleric", "thief"],
    "allowedMulticlass": [["fighter", "cleric"], ["fighter", "thief"], ["cleric", "thief"]],
    "bonusLanguages": ["gnome", "goblin", "kobold", "orc"],
    "grantedFeatures": []
  }
}
```
(The `classLevelLimits` / `allowedClasses` / `allowedMulticlass` / `bonusLanguages` values above are **illustrative** — replace with what the rendered PHB actually shows and cite the page.)

- [ ] **Step 4: Structural + content test**

Run: `npx vitest run tests/packs/`
Expected: `source.test.ts` PASS. (`content.test.ts` is Task 9 — it will then enforce the enum checks.)

- [ ] **Step 5: Full gate + compile check** (as Task 2 Step 4).

- [ ] **Step 6: Commit**

```bash
git add packs/races
git commit -m "content(packs): races — 6 PHB races (level limits, multiclass, languages)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `nonweapon-proficiencies` pack (~70 documents — TRANSCRIPTION)

**Files:**
- Create: `packs/nonweapon-proficiencies/_source/*.json` (one file per proficiency, file name = kebab-case of the proficiency name, e.g. `animal-handling.json`)
- Create: `packs/nonweapon-proficiencies/_source/_MANIFEST.md`

**Interfaces:**
- Consumes: the `nonweaponProficiency` item schema — `system` fields `governingAbility` (choices `ABILITY_KEYS` = str/dex/con/int/wis/cha), `modifier` (int, the check modifier — usually `0`, sometimes negative), `slotCost` (int ≥ 1, the number of proficiency slots to acquire it), `group` (choices `NONWEAPON_GROUPS` = general/warrior/wizard/priest/rogue), `slotsInvested` (int ≥ 1 — set to `1` on the canonical item), `isRacial` (bool — `false`), `checkPenalty` (int — `0`), `description` (HTML — `""`).

**Field mapping from the PHB NWP tables:**
- The PHB lists each proficiency under a **group** heading (General, Priest, Warrior, Wizard, Rogue) → `system.group` (lowercase; "Priest"→`priest`, "Wizard"→`wizard`, "Rogue"→`rogue`, "Warrior"→`warrior`, "General"→`general`).
- "# of Slots" column → `system.slotCost`.
- "Relevant Ability" column → `system.governingAbility` (map the ability name to its 3-letter key; e.g. "Intelligence"→`int`).
- "Modifier" / "Check Modifier" column → `system.modifier` (a value like `-1`, `0`, `+2` → the integer).
- A proficiency listed in more than one group (some appear under General **and** a class group) → create it once under the **most general** group it appears in (General if present), and note the duplication in `_MANIFEST.md`.

- [ ] **Step 1: Render the PHB NWP pages** (Chapter 5, ~p.55–58) to PNGs; read them; record page numbers.

- [ ] **Step 2: Write `_MANIFEST.md`** — a full table `| name | group | ability | slots | modifier | PHB page |`, one row per proficiency, for the reviewer to spot-check against their book.

- [ ] **Step 3: Write one JSON file per proficiency**

```json
{
  "_id": "<16 alphanumerics>",
  "name": "Animal Handling",
  "type": "nonweaponProficiency",
  "img": "icons/svg/pawprint.svg",
  "system": {
    "description": "",
    "governingAbility": "wis",
    "modifier": -1,
    "slotCost": 1,
    "group": "general",
    "slotsInvested": 1,
    "isRacial": false,
    "checkPenalty": 0
  }
}
```
Use one `img` for all of them if picking per-proficiency icons is slow — `icons/svg/book.svg` is acceptable; the icon is cosmetic.

- [ ] **Step 4: Structural test** (`npx vitest run tests/packs/source.test.ts` — PASS).

- [ ] **Step 5: Full gate + compile check.**

- [ ] **Step 6: Commit**

```bash
git add packs/nonweapon-proficiencies
git commit -m "content(packs): non-weapon proficiencies — PHB Chapter 5 tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `conditions` pack + `CONFIG.statusEffects` wiring

**Files:**
- Create: `packs/conditions/_source/*.json` (15 files — `<id>.json`)
- Create: `src/conditions.ts`
- Modify: `src/system.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js`
- Create: `tests/conditions.test.ts`

**Interfaces:**
- Produces: `src/conditions.ts` exports `interface Condition { id: string; name: string; img: string }` and `const CONDITIONS: readonly Condition[]`.
- Produces: `src/system.ts` init populates `CONFIG.statusEffects` from `CONDITIONS`.

**Condition list (id — name — img). Icons are from `resources/app/public/icons/svg/`; swap any that doesn't exist and note it:**

| id | name | img |
|---|---|---|
| blinded | Blinded | `icons/svg/blind.svg` |
| deafened | Deafened | `icons/svg/deaf.svg` |
| prone | Prone | `icons/svg/falling.svg` |
| stunned | Stunned | `icons/svg/daze.svg` |
| unconscious | Unconscious | `icons/svg/unconscious.svg` |
| paralyzed | Paralyzed | `icons/svg/paralysis.svg` |
| poisoned | Poisoned | `icons/svg/poison.svg` |
| held | Held | `icons/svg/net.svg` |
| entangled | Entangled | `icons/svg/net.svg` |
| invisible | Invisible | `icons/svg/invisible.svg` |
| sleeping | Sleeping | `icons/svg/sleep.svg` |
| charmed | Charmed | `icons/svg/terror.svg` |
| frightened | Frightened | `icons/svg/terror.svg` |
| incapacitated | Incapacitated | `icons/svg/downgrade.svg` |
| dead | Dead | `icons/svg/skull.svg` |

- [ ] **Step 1: Write `src/conditions.ts`**

```ts
// The status conditions the system ships (SP1). Each is also an ActiveEffect
// document in the `conditions` compendium; the two are drift-tested. Per-condition
// mechanical `changes` are SP3 / SP7 — this file and the pack carry id / name /
// icon only. No Foundry import — pure data.

export interface Condition {
  id: string;
  name: string;
  img: string;
}

export const CONDITIONS: readonly Condition[] = [
  { id: "blinded", name: "Blinded", img: "icons/svg/blind.svg" },
  { id: "deafened", name: "Deafened", img: "icons/svg/deaf.svg" },
  { id: "prone", name: "Prone", img: "icons/svg/falling.svg" },
  { id: "stunned", name: "Stunned", img: "icons/svg/daze.svg" },
  { id: "unconscious", name: "Unconscious", img: "icons/svg/unconscious.svg" },
  { id: "paralyzed", name: "Paralyzed", img: "icons/svg/paralysis.svg" },
  { id: "poisoned", name: "Poisoned", img: "icons/svg/poison.svg" },
  { id: "held", name: "Held", img: "icons/svg/net.svg" },
  { id: "entangled", name: "Entangled", img: "icons/svg/net.svg" },
  { id: "invisible", name: "Invisible", img: "icons/svg/invisible.svg" },
  { id: "sleeping", name: "Sleeping", img: "icons/svg/sleep.svg" },
  { id: "charmed", name: "Charmed", img: "icons/svg/terror.svg" },
  { id: "frightened", name: "Frightened", img: "icons/svg/terror.svg" },
  { id: "incapacitated", name: "Incapacitated", img: "icons/svg/downgrade.svg" },
  { id: "dead", name: "Dead", img: "icons/svg/skull.svg" },
];
```

- [ ] **Step 2: Add `src/conditions.ts` to the gated set**

- `tsconfig.core.json` `include` — append `"src/conditions.ts"`.
- `vitest.config.ts` `coverage.include` — add `"src/conditions.ts"` (near `src/config.ts`).
- `eslint.config.js` — add `"src/conditions.ts"` to BOTH the Foundry-globals `ignores` array and the pure-zone `files` array.

- [ ] **Step 3: Populate `CONFIG.statusEffects` in `src/system.ts`**

First read `C:\Program Files\Foundry Virtual Tabletop\resources\app\client\config.mjs` around line 1688 to confirm the shape of `CONFIG.statusEffects` entries in v14 (`{ id, name, img }`, possibly `label` legacy). Then in the `init` hook, after `registerSettings();`:

```ts
  for (const c of CONDITIONS) {
    CONFIG.statusEffects.push({ id: c.id, name: c.name, img: c.img });
  }
```

Import `CONDITIONS` from `./conditions`. Use `push` (append to Foundry's set) unless the v14 source shows the array is not yet populated at `init` time, in which case assign `CONFIG.statusEffects = [...CONFIG.statusEffects, ...CONDITIONS.map(c => ({ id: c.id, name: c.name, img: c.img }))]`.

**Ruling slot:** if `CONFIG.statusEffects` in v14 is a `Proxy` that rejects `push` at `init`, or the timing means core overwrites our additions, ship `src/conditions.ts` + the pack + the drift test and **defer the `CONFIG.statusEffects` line to SP3** with a `// TODO(SP3)` and a ledger note. The data + pack + drift test are the load-bearing deliverable; the HUD wiring is a bonus.

- [ ] **Step 4: Write the 15 condition JSON files**

```json
{
  "_id": "<16 alphanumerics>",
  "name": "Blinded",
  "type": "adnd2e",
  "img": "icons/svg/blind.svg",
  "statuses": ["blinded"],
  "disabled": false,
  "transfer": false,
  "system": {
    "changes": [],
    "conditionId": "blinded",
    "isCondition": true,
    "suppressWhenUnequipped": false,
    "schoolTag": null
  }
}
```
`name` / `img` / `statuses[0]` / `system.conditionId` all match the `CONDITIONS` row.

- [ ] **Step 5: Write the drift test** — `tests/conditions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CONDITIONS } from "../src/conditions";

const SRC = path.resolve(__dirname, "..", "packs", "conditions", "_source");

function packDocs() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(SRC, f), "utf8")) as {
      name: string;
      img: string;
      statuses: string[];
      type: string;
      system: { conditionId: string; isCondition: boolean; changes: unknown[] };
    });
}

describe("CONDITIONS ↔ conditions pack", () => {
  it("the pack has exactly one adnd2e ActiveEffect per CONDITIONS entry", () => {
    const docs = packDocs();
    expect(docs.length).toBe(CONDITIONS.length);
    const byId = new Map(CONDITIONS.map((c) => [c.id, c]));
    for (const doc of docs) {
      expect(doc.type).toBe("adnd2e");
      expect(doc.system.isCondition).toBe(true);
      expect(doc.system.changes).toEqual([]);
      expect(doc.statuses).toEqual([doc.system.conditionId]);
      const c = byId.get(doc.system.conditionId);
      expect(c, doc.system.conditionId).toBeDefined();
      expect(doc.name).toBe(c!.name);
      expect(doc.img).toBe(c!.img);
    }
    expect(new Set(docs.map((d) => d.system.conditionId)).size).toBe(CONDITIONS.length);
  });
});
```

- [ ] **Step 6: Run tests** (`npx vitest run tests/conditions.test.ts tests/packs/source.test.ts` — PASS).

- [ ] **Step 7: Full gate** — `src/conditions.ts` at 100% (the drift test iterates `CONDITIONS`). `tsc -p tsconfig.core.json` now type-checks `src/conditions.ts` Foundry-free (it is — no imports).

- [ ] **Step 8: Commit**

```bash
git add packs/conditions src/conditions.ts src/system.ts tsconfig.core.json vitest.config.ts eslint.config.js tests/conditions.test.ts
git commit -m "content(packs): conditions — 15 status effects + CONFIG.statusEffects

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `weapon-proficiency-groups` pack (8 documents)

**Files:**
- Create: `packs/weapon-proficiency-groups/_source/*.json` (8 files — `<kebab-name>.json`)

**Interfaces:**
- Consumes: the `weaponProficiency` item schema — `system` fields `weaponOrGroup` (string), `isGroup` (bool), `slotsInvested` (int ≥ 0), `specialized` (bool), `styleSpecialization` (nullable string), `masteryTier` (int ≥ 0), `description` (HTML — `""`).

**Content — 8 pragmatic broad categories (not PHB-formal; SP7 extends):**

`Blades`, `Bludgeoning`, `Bows`, `Crossbows`, `Hafted`, `Hurled`, `Pole Arms`, `Slings`. Each:
```json
{
  "_id": "<16 alphanumerics>",
  "name": "Blades",
  "type": "weaponProficiency",
  "img": "icons/svg/sword.svg",
  "system": {
    "description": "",
    "weaponOrGroup": "Blades",
    "isGroup": true,
    "slotsInvested": 0,
    "specialized": false,
    "styleSpecialization": null,
    "masteryTier": 0
  }
}
```

- [ ] **Step 1: Write the 8 files.**
- [ ] **Step 2: Structural test** (PASS).
- [ ] **Step 3: Full gate + compile check.**
- [ ] **Step 4: Commit**

```bash
git add packs/weapon-proficiency-groups
git commit -m "content(packs): weapon-proficiency groups — 8 broad categories

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `system.json` — `packs` + `packFolders`

**Files:**
- Modify: `system.json`

- [ ] **Step 1: Add the `packs` array**

After `documentTypes` (and before `packFolders`), add:

```json
  "packs": [
    { "name": "classes", "label": "Classes", "path": "packs/classes", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } },
    { "name": "races", "label": "Races", "path": "packs/races", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } },
    { "name": "nonweapon-proficiencies", "label": "Non-Weapon Proficiencies", "path": "packs/nonweapon-proficiencies", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } },
    { "name": "weapon-proficiency-groups", "label": "Weapon-Proficiency Groups", "path": "packs/weapon-proficiency-groups", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } },
    { "name": "conditions", "label": "Conditions", "path": "packs/conditions", "type": "ActiveEffect", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } }
  ],
```

- [ ] **Step 2: Assign packs to folders + add "Conditions"**

In `packFolders[0]`:
- `"Classes & Races"` `packs` → `["classes", "races"]`
- `"Proficiencies"` `packs` → `["weapon-proficiency-groups", "nonweapon-proficiencies"]`
- `"Equipment"` `packs` → `[]` (unchanged)
- `"Spells"` `packs` → `[]` (unchanged)
- add a 5th subfolder: `{ "name": "Conditions", "sorting": "a", "packs": ["conditions"] }`
- `packFolders[0].packs` stays `[]`

- [ ] **Step 3: Verify the folder name is clean**

Run: `grep "Rules Content" system.json | od -An -c | grep -o '342 200 224'`
Expected: matches (`342 200 224` = the UTF-8 bytes of `—` U+2014). The name `"AD&D 2E — Rules Content"` is **already correct** — do not "fix" it; a `cat -v` rendering it as `M-bM-^@M-^T` is just escaping, not corruption. If the bytes are anything else (e.g. `303 242 342`…), replace with a literal U+2014.

- [ ] **Step 4: Run the pack tests + build**

Run: `npx vitest run tests/packs/ && npm run build`
Expected: `source.test.ts` now validates all 5 packs; `npm run build` compiles all 5 into `dist/packs/` (5 populated LevelDB dirs). Then `npm run typecheck && npm run lint && npm run test:coverage`.

- [ ] **Step 5: Commit**

```bash
git add system.json
git commit -m "feat(system): declare the 5 compendium packs + folder assignment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `lang/en.json` — `TYPES` labels

**Files:**
- Modify: `lang/en.json`
- Modify: `tests/lang/en-coverage.test.ts`

- [ ] **Step 1: Add the `TYPES` block** to `lang/en.json` (top-level, alongside `ADND2E`):

```json
  "TYPES": {
    "Actor": {
      "character": "Character",
      "npc": "NPC",
      "creature": "Creature"
    },
    "Item": {
      "class": "Class",
      "race": "Race",
      "weapon": "Weapon",
      "armor": "Armor",
      "equipment": "Equipment",
      "spell": "Spell",
      "weaponProficiency": "Weapon Proficiency",
      "nonweaponProficiency": "Non-Weapon Proficiency",
      "classFeature": "Class Feature"
    },
    "ActiveEffect": {
      "adnd2e": "AD&D 2E Effect"
    }
  }
```

- [ ] **Step 2: Write the failing drift test** — append to `tests/lang/en-coverage.test.ts`:

```ts
import { ACTOR_SUBTYPES } from "../../src/data/actor/subtypes";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

describe("lang/en.json TYPES", () => {
  const types = (en as { TYPES?: { Actor?: object; Item?: object; ActiveEffect?: object } }).TYPES ?? {};

  it("TYPES.Actor keys == ACTOR_SUBTYPES", () => {
    expect(Object.keys(types.Actor ?? {}).sort()).toEqual([...ACTOR_SUBTYPES].sort());
  });
  it("TYPES.Item keys == ITEM_SUBTYPES", () => {
    expect(Object.keys(types.Item ?? {}).sort()).toEqual([...ITEM_SUBTYPES].sort());
  });
  it("TYPES.ActiveEffect keys == ACTIVE_EFFECT_SUBTYPES", () => {
    expect(Object.keys(types.ActiveEffect ?? {}).sort()).toEqual([...ACTIVE_EFFECT_SUBTYPES].sort());
  });
  it("every TYPES value is a non-empty string", () => {
    for (const group of Object.values(types)) {
      for (const [k, v] of Object.entries(group as Record<string, unknown>)) {
        expect(typeof v, k).toBe("string");
        expect((v as string).length, k).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 3: Run — expect PASS** (`npx vitest run tests/lang/en-coverage.test.ts`).

- [ ] **Step 4: Full gate.**

- [ ] **Step 5: Commit**

```bash
git add lang/en.json tests/lang/en-coverage.test.ts
git commit -m "i18n: TYPES labels for every Actor / Item / ActiveEffect subtype

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `tests/packs/content.test.ts` — enum cross-checks

**Files:**
- Create: `tests/packs/content.test.ts`

**Interfaces:**
- Consumes: every pack's `_source/*.json` (Tasks 2–6) and the `src/core` / `src/data` enum exports.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLASS_IDS, RACE_IDS, ABILITY_KEYS, WIZARD_SCHOOLS, NONWEAPON_GROUPS } from "../../src/data/item/choices";

const ROOT = path.resolve(__dirname, "..", "..");
function docs(pack: string): Record<string, unknown>[] {
  const dir = path.join(ROOT, "packs", pack, "_source");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Record<string, unknown>);
}
const sys = (d: Record<string, unknown>) => d.system as Record<string, unknown>;

describe("classes pack content", () => {
  const items = docs("classes");
  it("has 16 documents: 8 chassis + 8 wizard specialists", () => {
    expect(items).toHaveLength(16);
    expect(items.every((d) => d.type === "class")).toBe(true);
  });
  it("every chassisId is a valid ClassId", () => {
    for (const d of items) expect(CLASS_IDS as readonly string[]).toContain(sys(d).chassisId);
  });
  it("the 8 non-null specialistSchool docs are mage + a distinct WizardSchool", () => {
    const specialists = items.filter((d) => sys(d).specialistSchool !== null);
    expect(specialists).toHaveLength(8);
    for (const d of specialists) {
      expect(sys(d).chassisId).toBe("mage");
      expect(WIZARD_SCHOOLS as readonly string[]).toContain(sys(d).specialistSchool);
    }
    expect(new Set(specialists.map((d) => sys(d).specialistSchool)).size).toBe(8);
  });
  it("plain (non-specialist) classes cover all 8 chassis", () => {
    const plain = items.filter((d) => sys(d).specialistSchool === null).map((d) => sys(d).chassisId);
    expect(new Set(plain)).toEqual(new Set(CLASS_IDS));
  });
});

describe("races pack content", () => {
  const items = docs("races");
  it("has 6 documents, one per RaceId", () => {
    expect(items).toHaveLength(6);
    expect(new Set(items.map((d) => sys(d).raceId))).toEqual(new Set(RACE_IDS));
  });
  it("allowedClasses + allowedMulticlass entries are all valid ClassIds", () => {
    for (const d of items) {
      for (const c of sys(d).allowedClasses as string[]) expect(CLASS_IDS as readonly string[]).toContain(c);
      for (const combo of sys(d).allowedMulticlass as string[][]) {
        for (const c of combo) expect(CLASS_IDS as readonly string[]).toContain(c);
      }
    }
  });
  it("classLevelLimits keys are valid ClassIds; values are null or a positive int", () => {
    for (const d of items) {
      for (const [k, v] of Object.entries(sys(d).classLevelLimits as Record<string, unknown>)) {
        expect(CLASS_IDS as readonly string[]).toContain(k);
        expect(v === null || (typeof v === "number" && Number.isInteger(v) && v > 0), `${d.name}.${k}`).toBe(true);
      }
    }
  });
});

describe("nonweapon-proficiencies pack content", () => {
  const items = docs("nonweapon-proficiencies");
  it("has 60–80 documents", () => {
    expect(items.length).toBeGreaterThanOrEqual(60);
    expect(items.length).toBeLessThanOrEqual(80);
  });
  it("every entry: valid ability + group, slotCost >= 1, integer modifier", () => {
    for (const d of items) {
      expect(ABILITY_KEYS as readonly string[]).toContain(sys(d).governingAbility);
      expect(NONWEAPON_GROUPS as readonly string[]).toContain(sys(d).group);
      expect(sys(d).slotCost as number).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(sys(d).modifier as number)).toBe(true);
    }
  });
  it("names are unique", () => {
    expect(new Set(items.map((d) => d.name)).size).toBe(items.length);
  });
});

describe("weapon-proficiency-groups pack content", () => {
  const items = docs("weapon-proficiency-groups");
  it("has 8 group documents", () => {
    expect(items).toHaveLength(8);
    for (const d of items) {
      expect(d.type).toBe("weaponProficiency");
      expect(sys(d).isGroup).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run — expect PASS** (all packs exist by now).

Run: `npx vitest run tests/packs/content.test.ts`
If a check is red, the pack JSON has a transcription error — **fix the JSON** (or, if a real count is legitimately outside 60–80 / 8, adjust the assertion with a comment noting the actual PHB count).

- [ ] **Step 3: Full gate.**

- [ ] **Step 4: Commit**

```bash
git add tests/packs/content.test.ts
git commit -m "test(packs): cross-check every enum-typed pack field vs the core unions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final verification (controller, before the whole-branch review)

- [ ] `npm run typecheck && npm run lint && npm run test:coverage && npm run build` — all green from a cleared cache.
- [ ] `dist/packs/` contains 5 populated LevelDB directories after `npm run build`.
- [ ] Coverage: 100% on the gated zone; `src/conditions.ts` at 100%.
- [ ] `tests/packs/source.test.ts` + `tests/packs/content.test.ts` + `tests/conditions.test.ts` all green.
- [ ] `git grep -n "description" packs/` — every `system.description` is `""` (content policy).
- [ ] Both `_MANIFEST.md` files exist and cite PHB pages.
- [ ] Dev-world smoke check (record for the PR, run before merge — needs the linked v14.364 world):
  - `npm run build && npm run link`, open the world.
  - Compendium sidebar shows "AD&D 2E — Rules Content" with subfolders **Classes & Races** (Classes, Races), **Proficiencies** (Weapon-Proficiency Groups, Non-Weapon Proficiencies), **Conditions** (Conditions), plus empty **Equipment** / **Spells**.
  - Open the Classes pack → 16 entries; open "Fighter" → no console error, `system.chassisId === "fighter"`. Open "Abjurer" → `specialistSchool === "abjuration"`.
  - Open Races → "Dwarf" → `system.classLevelLimits` / `allowedMulticlass` populated.
  - Open Non-Weapon Proficiencies → ~70 entries; open one → valid.
  - Open Conditions → 15 `adnd2e` effects.
  - Drag "Fighter" + "Human" from the compendiums onto a new `character` actor → `system.attributes.thac0` / `.hp.max` / `saves` still compute (the derive pipeline reads the embedded items).
  - Token HUD: the 15 conditions appear as togg(able) status icons **if** Task 5's `CONFIG.statusEffects` line shipped; if it was deferred, note that.
  - Create → Actor / Create → Item dialogs show the friendly type names ("Character", "Weapon Proficiency", …) not `TYPES.Actor.character`.

---

## Self-Review (completed by plan author)

**1. Spec coverage.** §7 pack table → `classes` (T2), `races` (T3), `nonweapon-proficiencies` (T4), `conditions` (T5), `weapon-proficiency-groups` (T6); `tables` (rollable, "empty/placeholder") — **not shipped** (nothing references it in SP1; deferred, noted). §7 `importContent` → **1c.4b** (scope boundary). §11 reference workflow → T3/T4 render-and-cite + `_MANIFEST.md`. §12 item 1 (`system.json` … packs, config) → T7; item 9 (`packs/` source + build script) → T1–T6; item 8 (minimal sheets) → **1c.4c**. §10 (mechanical only) → the content-policy constraint + the `description: ""` check.

**2. Placeholder scan.** T3/T4 carry *illustrative* JSON values (dwarf level limits, Animal Handling) explicitly labelled "replace with the rendered PHB value" — that is the §11 workflow, not a placeholder: the real values come from the render, the manifest cites the page, the review pass checks them, and `content.test.ts` enforces the enum shape. Every other task has complete, final content. No "TBD" / "handle X".

**3. Type consistency.** `system.*` field names checked against the live schemas: `class` (`chassisId`, `specialistSchool`, `kit`, `grantedFeatures`, `xp`, `hpRolls`, `dualClassState`), `race` (`raceId`, `size`, `baseMovement`, `infravision`, `classLevelLimits`, `allowedClasses`, `allowedMulticlass`, `bonusLanguages`, `grantedFeatures`), `nonweaponProficiency` (`governingAbility`, `modifier`, `slotCost`, `group`, `slotsInvested`, `isRacial`, `checkPenalty`), `weaponProficiency` (`weaponOrGroup`, `isGroup`, `slotsInvested`, `specialized`, `styleSpecialization`, `masteryTier`), `adnd2e` AE (`conditionId`, `isCondition`, `suppressWhenUnequipped`, `schoolTag`, `changes`). `CONDITIONS` (T5) is consumed by `tests/conditions.test.ts` (T5) and `src/system.ts` (T5) with the `{ id, name, img }` shape throughout. `content.test.ts` imports the enum names that actually exist in `src/data/item/choices.ts` (`CLASS_IDS`, `RACE_IDS`, `ABILITY_KEYS`, `WIZARD_SCHOOLS`, `NONWEAPON_GROUPS`).

**4. Ordering / gate-green between tasks.** T1 creates the pipeline with `system.json` still pack-less (tests vacuous, build a no-op) — green. T2–T6 add pack source; `source.test.ts` validates them but `system.json` doesn't list them until T7, so `npm run build` doesn't compile them mid-sequence (the per-task "compile check" uses a temporary revert-me `system.json` edit or is skipped — stated in the task). T7 turns them all on at once; T9's `content.test.ts` needs T2–T6 done. T5's gated-config edit for `src/conditions.ts` is safe (the file has zero imports). `noUnusedLocals` note: T8's test adds three imports it uses; T5's `src/system.ts` uses its `CONDITIONS` import.

---

## Post-1c.4a follow-ups (from the whole-branch review)

Recorded here (not the gitignored ledger) so they survive. Raised by the opus
whole-branch review of `feat/adnd2e-1c4a`; the fix wave landed C1 (`_key` on all
110 pack docs) + I2 (empty-pack guards) + I3/I4 (reverted the premature
`CONFIG.statusEffects` wiring in `src/system.ts`) + a 5-item Minor sweep.

- **`conditions` compendium — REMOVED from `system.json` post-merge (hotfix
  branch `fix/adnd2e-conditions-pack-type`).** v14.364's server-side
  manifest installer (`dist/packages/*.mjs`, behind `SetupView.handlePost` →
  `installPackage`) rejects a compendium `"type": "ActiveEffect"` with
  "not a valid choice" — even though `CONST.COMPENDIUM_DOCUMENT_TYPES` in the
  client/common layer lists it and `@foundryvtt/foundryvtt-cli` compiles it
  fine. Declaring the pack broke install-from-manifest for everyone. The 15
  condition docs (`packs/conditions/_source/`, `_key`-tagged, `_MANIFEST.md`)
  and `src/conditions.ts` stay in the repo, drift-tested by
  `tests/conditions.test.ts`. **SP3 ships the conditions compendium** — as an
  `Item`-typed pack with a `condition` Item subtype, or whatever v14 supports
  then — together with the `CONFIG.statusEffects` wiring below (they're the
  same piece of work). 4 Item packs ship in 1c.4a.
- **SP3 — wire `CONFIG.statusEffects` properly.** The reverted 1c.4a loop
  blind-appended `{id,name,img}` onto core's 34 built-ins (duplicate Token-HUD
  entries for blind/deaf/stun/sleep/paralysis/poison/fear, and it misaligned
  `CONFIG.specialStatusEffects.BLIND`); a HUD toggle also created a `base`-type
  ActiveEffect unlinked to the `conditions` pack. Do it right: curate condition
  ids to adopt core's where the semantics match, set
  `CONFIG.specialStatusEffects.BLIND` (and any other special slots), push full
  `adnd2e` effect payloads (`_id` / `type` / `system`) so a HUD toggle
  instantiates the subtype and links the pack, and use `ADND2E.Conditions.*`
  i18n keys instead of literal English (opus review I3 + I4 + M7). `src/conditions.ts`
  stays the drift-tested source of truth.
- **`scripts/unpack.mjs` (`extractPack` round-trip).** Deferred from 1c.4a
  design. Now that every source doc carries `_key` in the exact shape
  `extractPack` writes back (`!items!<id>` / `!effects!<id>`), an
  unpack → recompile round-trip is byte-consistent and safe to add.
- **`npm run watch`.** `vite build --watch` with `emptyOutDir: true` wipes
  `dist/packs/` on every incremental rebuild and nothing recompiles it — the
  linked dev world loses its compendia mid-session (opus review M3). Fix
  options: drop `emptyOutDir`, run a separate watcher that chases with
  `build:packs`, or document the limitation.
- **`tests/packs/source.test.ts` hardening** (opus review M4–M6): assert
  `label` present, `type ∈ CONST.COMPENDIUM_DOCUMENT_TYPES`, `system: "adnd2e"`
  present, `ownership` keys/values legal; flag an orphan `packs/<dir>/` not
  declared in `system.json`; assert cross-pack `_id` uniqueness.
- **NWP schema** (from Rulings D-1 / D-2): a "no ability check" representation
  for Blind-fighting / Mountaineering (currently schema-forced `dex`/`0` and
  `str`/`0` placeholders); multi-group membership (set/array, or derive from
  PHB Table 38) so cross-group slot-cost crossovers are expressible.
- **`npm audit`**: 9 vulns (3 moderate / 6 high), all in the dev-only
  `@foundryvtt/foundryvtt-cli` tree (yargs / nedb / esm transitive) — not in the
  shipped bundle. Revisit on a CLI bump.
