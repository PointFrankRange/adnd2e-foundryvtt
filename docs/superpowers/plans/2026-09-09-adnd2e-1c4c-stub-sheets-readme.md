# AD&D 2E 1c.4c — Stub Raw-Field Sheets + README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship minimal raw-field editor sheets for every Actor, Item, and `adnd2e` ActiveEffect document so data can be hand-entered for testing, and rewrite the stale README — completing Sub-project 1 (Foundation).

**Architecture:** One `HandlebarsApplicationMixin`-based `RawFieldSheetMixin` walks a document's `system` DataModel schema and renders one input per leaf field (scalars as typed inputs, arrays/objects as JSON textareas); three one-line concrete classes apply it over Foundry v14's `ActorSheetV2` / `ItemSheetV2` / `ActiveEffectConfig` bases and are registered as the default sheets. The whole layer is Foundry-coupled and has no unit tests (spec §9) — it is verified in a linked dev world. Real designed sheets are SP2 (PC) and SP6 (NPC/monster).

**Tech Stack:** TypeScript, Vite (library build + static template copy), Foundry VTT v14.364 ApplicationV2 sheet stack (`foundry.applications.*`), Handlebars. `fvtt-types` is v13-beta — read `resources/app` source for the sheet APIs.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §4 (`sheets/` = "STUB registrations only in SP1, raw field dump"; the layer contract), §9 (`data/` / `documents/` / `sheets/` exercised manually in a linked dev world for SP1 — no Foundry mocks, no unit tests), §10 (scope boundary — no real sheet UI), §12.2 (README rewrite), §12.8 (`src/sheets/` — minimal raw-field sheets registered for all types).

## Global Constraints

- **`src/sheets/**` is the Foundry layer.** It MAY import from `foundry` / `game` / `CONFIG` / DOM. It is NOT pure. Do NOT add it to `tsconfig.core.json`, `vitest.config.ts` `coverage.include`, or `eslint.config.js`'s pure-zone blocks. The base `tsconfig.json` (`include: ["src", "tests"]`) and the base ESLint config already lint and typecheck it. **This plan makes NO gated-triad changes.**
- **The pure-zone 100% coverage rule is untouched.** This plan adds no pure code, so `npm run test:coverage` stays green at its current numbers with nothing new to cover. The only test additions (four lang keys) live in `tests/lang/`, already covered.
- **Foundry is v14.364; `fvtt-types` is v13-beta and wrong about `foundry.applications.*`** — `ApplicationV2`, `HandlebarsApplicationMixin`, `ActorSheetV2` / `ItemSheetV2` / `ActiveEffectConfig`, `DocumentSheetV2`, `DocumentSheetConfig.registerSheet`. The authority is `C:\Program Files\Foundry Virtual Tabletop\resources\app\client\applications\**\*.mjs`. Every task touching a sheet API has a "read `resources/app` source" step. Type the Foundry-side calls with `as unknown as { … }` casts at the call site — the codebase convention (see `src/system.ts`'s `(game.system as unknown as { api: … })`, `src/documents/actor.ts`) — not global augmentation.
- **Content policy:** mechanics and structure only, everywhere including `README.md` — never quote AD&D 2E rulebook text.
- **Do NOT run** `npm run format` / `prettier` / `npm install`.
- **Full gate:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. Read vitest output with `tail` / `head` / a file redirect — **never `| grep`** (a SIGPIPE makes vitest falsely report "no tests"). The first run right after clearing `node_modules/.vite` + `.vitest` + `.cache` can also genuinely report "no tests" — rerun 2–3×; it passes on a warm cache. Never `npm install` to fix it.
- **`npm run build` must copy `templates/sheets/raw-fields.hbs` into `dist/templates/sheets/`** — `vite.config.ts` already static-copies `templates/` wholesale, so the file just needs to exist; confirm it lands in `dist/`.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. PR body trailer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **The dev-world smoke check (Task 4) is a REQUIRED gated step before `finishing-a-development-branch`**, not a deferred checklist item — 1c.3d and 1c.4a merged un-smoke-tested and shipped a world-load crash and an un-installable manifest (hotfixes #16, #17). `foundryconfig.json` exists on this machine (`{"dataPath":"C:/Users/Apera/AppData/Local/FoundryVTT"}`); `npm run link` works.

---

## File Structure

| File | Layer | Responsibility |
|---|---|---|
| `src/sheets/raw-field-sheet.ts` | Foundry | `RawFieldSheetMixin(Base)` — the schema walk (`buildFieldRows`), `humanizeKey`, `_prepareContext`, `_processFormData` (JSON textarea handling) |
| `templates/sheets/raw-fields.hbs` | template | Renders the flat `rows` list + a Save button |
| `src/sheets/actor-sheet.ts` | Foundry | `Adnd2eActorSheet extends RawFieldSheetMixin(ActorSheetV2)` |
| `src/sheets/item-sheet.ts` | Foundry | `Adnd2eItemSheet extends RawFieldSheetMixin(ItemSheetV2)` |
| `src/sheets/active-effect-sheet.ts` | Foundry | `Adnd2eActiveEffectConfig extends RawFieldSheetMixin(ActiveEffectConfig)` (or `DocumentSheetV2` fallback) |
| `src/sheets/index.ts` | Foundry | `registerSheets()` — three `DocumentSheetConfig.registerSheet` calls |

**Modified:** `src/system.ts` (call `registerSheets()` on `init`), `lang/en.json` (`ADND2E.sheets.*`), `tests/lang/en-coverage.test.ts` (assert the sheet keys), `src/types/global.d.ts` (only if a cast can't be done at the call site), `README.md` (full rewrite).

**Not touched:** `vite.config.ts` (already copies `templates/`), `system.json`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.js`.

**Out of scope** (note, do not build): any styled/designed sheet layout, tabs, drag-drop item management, class/race droppable affordances, XP→level or HP-roll UI, a file-picker for `img`, per-array add/remove row controls, an ActiveEffect `changes` editor. All are SP2 / SP3 / SP6.

---

## Task 1: `RawFieldSheetMixin` + the template

**Files:**
- Create: `src/sheets/raw-field-sheet.ts`
- Create: `templates/sheets/raw-fields.hbs`

**Interfaces:**
- Consumes: `foundry.applications.api.HandlebarsApplicationMixin`, `foundry.data.fields.*`, `foundry.utils.{getProperty,setProperty,deleteProperty}` — all Foundry globals, no repo imports.
- Produces: `export function RawFieldSheetMixin<TBase>(Base: TBase)` returning a class with `static DEFAULT_OPTIONS`, `static PARTS`, `_prepareContext`, `_processFormData`. Task 2's three concrete classes each do `class X extends RawFieldSheetMixin(<V2 base>) {}`.

- [ ] **Step 1: Read the v14 source for the APIs this file uses**

Read, in `C:\Program Files\Foundry Virtual Tabletop\resources\app`:
- `client/applications/api/application.mjs` — `_initializeApplicationOptions` (`:438`): `DEFAULT_OPTIONS` is auto-merged across the inheritance chain via `#mergeApplicationOptions`, so a subclass declares only its **delta**. Confirm the `window`/`position`/`form` sub-object shapes.
- `client/applications/api/handlebars-application.mjs` — `static PARTS` (`:51`) is **not** auto-merged; each class declares its own. `_renderHTML` (`:118`) renders each part with `_preparePartContext(partId, context, options)` (`:153`) which by default returns the shared `context`. So a single-part sheet needs no `_preparePartContext` override.
- `client/applications/api/document-sheet.mjs` — `_prepareContext` (`:172`) calls `super._prepareContext` then adds `document`, `source`, `fields`, `editable: this.isEditable` (`:180`), `rootId`, `user`. `get isEditable` (`:123`). `_processFormData(event, form, formData)` (`:506`) returns `foundry.utils.expandObject(formData.object)`. `DEFAULT_OPTIONS.form` (`:64`) = `{ handler: this.#onSubmitDocumentForm, submitOnChange: false, closeOnSubmit: false }` — so the default is already a Save-on-submit form; our delta just needs `position`/`window`.
- `common/data/fields.mjs` — the exact class names and how to detect each: `SchemaField` (has `.fields`), `NumberField`, `BooleanField`, `StringField` (`.choices` may be an array, a plain object, or a function — read `StringField#_prepareChoiceConfig` / how `choices` is stored), `HTMLField` (subclass of `StringField` — test it **before** `StringField`), `ArrayField` (`.element`), `ObjectField`, `SetField`, `TypedObjectField`, `DocumentIdField`, `FilePathField`, `ColorField`, `AngleField`, `AlphaField`, `IntegerSortField`. Note which extend which (e.g. `AngleField`/`AlphaField` extend `NumberField`; `FilePathField`/`ColorField`/`DocumentIdField` extend `StringField`).
- `common/utils/helpers.mjs` — `getProperty` / `setProperty` / `deleteProperty` (`:879`) signatures.

Note anything that forces a change to the code below.

- [ ] **Step 2: Write `src/sheets/raw-field-sheet.ts`**

```ts
// The SP1 stub sheet (spec §4, §12.8): walks a document's `system` DataModel
// schema and renders one input per leaf field so data can be hand-entered for
// testing. Scalars use typed inputs; arrays/objects use a JSON textarea. No
// designed layout — real sheets are SP2 (PC) / SP6 (NPC/monster). Foundry-coupled
// (the walk is `instanceof foundry.data.fields.*`); no unit tests (spec §9) —
// verified in a linked dev world.

const fields = foundry.data.fields;
const { getProperty, setProperty, deleteProperty } = foundry.utils;

type RowKind = "text" | "textarea" | "number" | "checkbox" | "select" | "json";

interface FieldRow {
  /** dot-path used as the input `name` and as the update key: "name", "img", "system.<path>" */
  path: string;
  label: string;
  indent: number; // px, = depth * 12
  header?: boolean; // a SchemaField group heading — no input
  kind?: RowKind;
  value?: unknown;
  choices?: { value: string; label: string; selected: boolean }[];
}

/** "chassisId" -> "Chassis Id", "hp_rolls" -> "Hp Rolls". */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Normalise a StringField's `choices` (array | object | function) to option rows. */
function toChoiceRows(raw: unknown, current: unknown): FieldRow["choices"] {
  let entries: [string, string][];
  const resolved = typeof raw === "function" ? (raw as () => unknown)() : raw;
  if (Array.isArray(resolved)) entries = resolved.map((v) => [String(v), String(v)]);
  else if (resolved && typeof resolved === "object") {
    entries = Object.entries(resolved as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
  } else return undefined;
  return entries.map(([value, label]) => ({ value, label, selected: value === String(current ?? "") }));
}

/** True for a field that should be rendered as a single JSON textarea (not walked). */
function isComplexField(field: unknown): boolean {
  return (
    field instanceof fields.ArrayField ||
    field instanceof fields.ObjectField ||
    field instanceof fields.SetField ||
    field instanceof fields.TypedObjectField
  );
}

function walk(
  schema: foundry.data.fields.SchemaField,
  doc: foundry.abstract.Document,
  prefix: string, // "system" or "system.<...>"
  depth: number,
  out: FieldRow[],
): void {
  for (const [key, field] of Object.entries(schema.fields)) {
    const path = `${prefix}.${key}`;
    const value = getProperty(doc, path);

    if (field instanceof fields.SchemaField) {
      out.push({ path, label: humanizeKey(key), indent: depth * 12, header: true });
      walk(field, doc, path, depth + 1, out);
      continue;
    }
    if (isComplexField(field)) {
      out.push({
        path,
        label: humanizeKey(key),
        indent: depth * 12,
        kind: "json",
        value: JSON.stringify(value ?? null, null, 2),
      });
      continue;
    }
    if (field instanceof fields.BooleanField) {
      out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "checkbox", value: Boolean(value) });
      continue;
    }
    if (field instanceof fields.NumberField) {
      out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "number", value: value ?? "" });
      continue;
    }
    if (field instanceof fields.StringField) {
      const choices = toChoiceRows((field as unknown as { choices?: unknown }).choices, value);
      if (choices && choices.length) {
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind: "select", value, choices });
      } else {
        const kind: RowKind = field instanceof fields.HTMLField ? "textarea" : "text";
        out.push({ path, label: humanizeKey(key), indent: depth * 12, kind, value: value ?? "" });
      }
      continue;
    }
    // Unknown / unhandled field type — fall back to JSON so it is at least visible & editable.
    out.push({
      path,
      label: humanizeKey(key),
      indent: depth * 12,
      kind: "json",
      value: JSON.stringify(value ?? null, null, 2),
    });
  }
}

/** Build the flat row list for a document: top-level name/img + the whole `system` tree. */
function buildFieldRows(doc: foundry.abstract.Document): FieldRow[] {
  const rows: FieldRow[] = [];
  rows.push({ path: "name", label: "Name", indent: 0, kind: "text", value: (doc as { name?: string }).name ?? "" });
  const docSchema = (doc as unknown as { schema?: { fields?: Record<string, unknown> } }).schema;
  if (docSchema?.fields && "img" in docSchema.fields) {
    rows.push({ path: "img", label: "Image", indent: 0, kind: "text", value: (doc as { img?: string }).img ?? "" });
  }
  const sys = (doc as unknown as { system?: { schema?: foundry.data.fields.SchemaField } }).system;
  if (sys?.schema) {
    rows.push({ path: "system", label: "System", indent: 0, header: true });
    walk(sys.schema, doc, "system", 1, rows);
  }
  return rows;
}

/**
 * Adds raw-field rendering + JSON-textarea round-tripping to any v14 DocumentSheetV2
 * subclass (ActorSheetV2 / ItemSheetV2 / ActiveEffectConfig).
 */
export function RawFieldSheetMixin<TBase extends abstract new (...args: never[]) => object>(Base: TBase) {
  const Mixed = foundry.applications.api.HandlebarsApplicationMixin(
    Base as unknown as new (...args: never[]) => object,
  );

  abstract class RawFieldSheet extends (Mixed as unknown as new (...args: never[]) => {
    _prepareContext(options: unknown): Promise<Record<string, unknown>>;
    _processFormData(event: unknown, form: HTMLFormElement, formData: unknown): Record<string, unknown>;
    document: foundry.abstract.Document;
  }) {
    static DEFAULT_OPTIONS = {
      position: { width: 560, height: 680 },
      window: { resizable: true },
      form: { closeOnSubmit: false },
    };

    static PARTS = {
      body: { template: "systems/adnd2e/templates/sheets/raw-fields.hbs", scrollable: [""] },
    };

    override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
      const context = await super._prepareContext(options);
      context.rows = buildFieldRows(this.document);
      return context;
    }

    override _processFormData(
      event: unknown,
      form: HTMLFormElement,
      formData: unknown,
    ): Record<string, unknown> {
      const submitData = super._processFormData(event, form, formData);
      for (const el of Array.from(form.querySelectorAll<HTMLTextAreaElement>('[data-json="true"]'))) {
        const path = el.name;
        try {
          setProperty(submitData, path, JSON.parse(el.value));
        } catch {
          deleteProperty(submitData, path);
          ui.notifications?.error(game.i18n.format("ADND2E.sheets.badJson", { field: path }));
        }
      }
      return submitData;
    }
  }

  return RawFieldSheet as unknown as TBase &
    (new (...args: never[]) => InstanceType<typeof RawFieldSheet>);
}
```

If Step 1 showed a class name or detection method is wrong for v14.364 (e.g. `choices` is stored under a private key, or `TypedObjectField` doesn't exist), adjust and note it in the report. The `as unknown as` gymnastics around the mixin are expected — `fvtt-types` v13-beta does not model `HandlebarsApplicationMixin` generically; keep them minimal and at this one file.

- [ ] **Step 3: Write `templates/sheets/raw-fields.hbs`**

```handlebars
<form class="adnd2e raw-field-sheet" autocomplete="off">
  <div class="raw-field-list">
    {{#each rows}}
      {{#if this.header}}
        <h3 class="raw-field-header" style="margin-left:{{this.indent}}px">{{this.label}}</h3>
      {{else}}
        <div class="form-group" style="margin-left:{{this.indent}}px">
          <label>{{this.label}}</label>
          <div class="form-fields">
            {{#if (eq this.kind "checkbox")}}
              <input type="checkbox" name="{{this.path}}" {{#if this.value}}checked{{/if}}
                {{#unless @root.editable}}disabled{{/unless}}>
            {{else if (eq this.kind "select")}}
              <select name="{{this.path}}" {{#unless @root.editable}}disabled{{/unless}}>
                {{#each this.choices}}
                  <option value="{{this.value}}" {{#if this.selected}}selected{{/if}}>{{this.label}}</option>
                {{/each}}
              </select>
            {{else if (eq this.kind "json")}}
              <textarea name="{{this.path}}" data-json="true" rows="4"
                {{#unless @root.editable}}readonly{{/unless}}>{{this.value}}</textarea>
            {{else if (eq this.kind "number")}}
              <input type="number" step="any" name="{{this.path}}" value="{{this.value}}"
                {{#unless @root.editable}}readonly{{/unless}}>
            {{else if (eq this.kind "textarea")}}
              <textarea name="{{this.path}}" rows="3"
                {{#unless @root.editable}}readonly{{/unless}}>{{this.value}}</textarea>
            {{else}}
              <input type="text" name="{{this.path}}" value="{{this.value}}"
                {{#unless @root.editable}}readonly{{/unless}}>
            {{/if}}
          </div>
        </div>
      {{/if}}
    {{/each}}
  </div>

  {{#if editable}}
    <footer class="sheet-footer flexrow">
      <button type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button>
    </footer>
  {{/if}}
</form>
```

`eq` is a confirmed built-in Foundry Handlebars helper (`client/applications/handlebars.mjs:139`). `{{else if (eq …)}}` is standard Handlebars `{{else}}{{#if}}` sugar and needs no registration. `{{#if this.value}}checked{{/if}}` and per-option `{{#if this.selected}}selected{{/if}}` avoid the `checked`/`selected` helpers entirely — if Step 1 confirms those helpers exist you may use them, but the `{{#if}}` form is fine.

- [ ] **Step 4: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint`
Expected: both clean. If the mixin generics won't satisfy `tsc`, widen the `as unknown as` casts inside `raw-field-sheet.ts` (do NOT touch `tsconfig.json`). The template is not typechecked.

Run: `npm run build`
Expected: clean; then `ls dist/templates/sheets/raw-fields.hbs` exists.

Run: `npm run test:coverage` — Expected: unchanged (no pure code; all existing tests pass, coverage still 100%). Read the output with `tail`, not `grep`.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/raw-field-sheet.ts templates/sheets/raw-fields.hbs
git commit -m "feat(sheets): RawFieldSheetMixin — walk the system schema into a raw editor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Concrete sheets, registration, wiring

**Files:**
- Create: `src/sheets/actor-sheet.ts`, `src/sheets/item-sheet.ts`, `src/sheets/active-effect-sheet.ts`, `src/sheets/index.ts`
- Modify: `src/system.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`; `src/types/global.d.ts` only if unavoidable

**Interfaces:**
- Consumes: `RawFieldSheetMixin` from `src/sheets/raw-field-sheet.ts`; `SYSTEM_ID` from `src/constants.ts`; `foundry.applications.sheets.{ActorSheetV2,ItemSheetV2,ActiveEffectConfig}`, `foundry.applications.apps.DocumentSheetConfig`.
- Produces: `export function registerSheets(): void` from `src/sheets/index.ts` — called by `src/system.ts` on `init`.

- [ ] **Step 1: Read the v14 source**

Read, in `C:\Program Files\Foundry Virtual Tabletop\resources\app`:
- `client/applications/sheets/_module.mjs` — the export names/paths for `ActorSheetV2`, `ItemSheetV2`, `ActiveEffectConfig` (confirm they are reachable as `foundry.applications.sheets.*`).
- `client/applications/sheets/actor-sheet.mjs` + `item-sheet.mjs` — both `extends DocumentSheetV2`; their `DEFAULT_OPTIONS` (any `classes` / `window` they set that our mixin should preserve — the auto-merge handles this, but note conflicts).
- `client/applications/sheets/active-effect-config.mjs` — it has its own `static PARTS` (`:40`) and custom `_prepareContext` / `_processFormData` for the `changes` array. **Our mixin replaces `PARTS` wholesale and overrides `_prepareContext`/`_processFormData`.** Decide: does `class extends RawFieldSheetMixin(ActiveEffectConfig)` still construct and render cleanly (our single `body` part + our context), or does `ActiveEffectConfig`'s constructor/other hooks assume its own parts exist? If it fights the mixin, use `RawFieldSheetMixin(foundry.applications.api.DocumentSheetV2)` for the AE stub instead and register it with `types: ["adnd2e"]`. **Record which base you used and why.**
- `client/applications/apps/document-sheet-config.mjs` — `registerSheet(documentClass, scope, sheetClass, options)` (`:410`); options `{ label, types, makeDefault, canBeDefault, canConfigure }`. `#registerSheet` (`:432`) respects an existing user default and only forces `makeDefault` when there is none — so **no `unregisterSheet` of the core default is needed**. `sheetClass` must be `isSubclass(…, foundry.applications.api.DocumentSheetV2)` — our mixin chain satisfies this. Confirm `Actor` / `Item` / `ActiveEffect` are the right first argument (the global document classes) and the `types` option is `string[]` of subtype names.
- Confirm registration must happen in the `init` hook (before `game.ready`) — the config is queued as `#pending` and applied on setup.

- [ ] **Step 2: Write the three concrete sheet classes**

`src/sheets/actor-sheet.ts`:
```ts
import { RawFieldSheetMixin } from "./raw-field-sheet";

export class Adnd2eActorSheet extends RawFieldSheetMixin(
  foundry.applications.sheets.ActorSheetV2 as unknown as abstract new (...args: never[]) => object,
) {
  static override DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "raw-field-sheet"],
  };
}
```

`src/sheets/item-sheet.ts`:
```ts
import { RawFieldSheetMixin } from "./raw-field-sheet";

export class Adnd2eItemSheet extends RawFieldSheetMixin(
  foundry.applications.sheets.ItemSheetV2 as unknown as abstract new (...args: never[]) => object,
) {
  static override DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "item", "raw-field-sheet"],
  };
}
```

`src/sheets/active-effect-sheet.ts` (base chosen per Step 1 — this shows the `ActiveEffectConfig` variant; swap to `foundry.applications.api.DocumentSheetV2` if Step 1 said so):
```ts
import { RawFieldSheetMixin } from "./raw-field-sheet";

export class Adnd2eActiveEffectConfig extends RawFieldSheetMixin(
  foundry.applications.sheets.ActiveEffectConfig as unknown as abstract new (...args: never[]) => object,
) {
  static override DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "active-effect", "raw-field-sheet"],
  };
}
```

- [ ] **Step 3: Write `src/sheets/index.ts`**

```ts
import { SYSTEM_ID } from "../constants";
import { Adnd2eActiveEffectConfig } from "./active-effect-sheet";
import { Adnd2eActorSheet } from "./actor-sheet";
import { Adnd2eItemSheet } from "./item-sheet";

/** Register the SP1 raw-field editor as the default sheet for every document type. Call on `init`. */
export function registerSheets(): void {
  const DSC = foundry.applications.apps.DocumentSheetConfig as unknown as {
    registerSheet(
      documentClass: unknown,
      scope: string,
      sheetClass: unknown,
      options: { label?: string; types?: string[]; makeDefault?: boolean },
    ): void;
  };
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eActorSheet, {
    makeDefault: true,
    label: "ADND2E.sheets.rawActor",
  });
  DSC.registerSheet(Item, SYSTEM_ID, Adnd2eItemSheet, {
    makeDefault: true,
    label: "ADND2E.sheets.rawItem",
  });
  DSC.registerSheet(ActiveEffect, SYSTEM_ID, Adnd2eActiveEffectConfig, {
    makeDefault: true,
    types: ["adnd2e"],
    label: "ADND2E.sheets.rawEffect",
  });
}
```

- [ ] **Step 4: Wire `src/system.ts`**

Add the import (with the others):
```ts
import { registerSheets } from "./sheets";
```
As the **last** statement inside the `Hooks.once("init", …)` callback:
```ts
  registerSheets();
```

- [ ] **Step 5: Write the failing lang test**

Append to `tests/lang/en-coverage.test.ts`:
```ts
describe("lang/en.json — sheet strings", () => {
  it("resolves every sheet label + message the sheet layer references", () => {
    for (const key of [
      "ADND2E.sheets.rawActor",
      "ADND2E.sheets.rawItem",
      "ADND2E.sheets.rawEffect",
      "ADND2E.sheets.badJson",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run: `npx vitest run tests/lang/en-coverage.test.ts 2>&1 | tail -15` — Expected: FAIL (keys resolve to `undefined`).

- [ ] **Step 6: Add the lang strings**

In `lang/en.json`, inside the top-level `ADND2E` object, add a `sheets` sub-object as a **sibling** of `settings` / `migration` / `import` (do NOT put it inside `settings` — `tests/config/settings-augmentation.test.ts` asserts `ADND2E.settings` keys are exactly the `SETTING_DESCRIPTORS` list):
```json
  "sheets": {
    "rawActor": "Raw Fields (Actor)",
    "rawItem": "Raw Fields (Item)",
    "rawEffect": "Raw Fields (Effect)",
    "badJson": "{field}: invalid JSON — not saved"
  }
```
Keep `lang/en.json` valid JSON (comma placement). Run the lang test again — Expected: PASS. Run `npx vitest run tests/config/settings-augmentation.test.ts 2>&1 | tail -10` — Expected: still PASS.

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build` — all green; coverage unchanged (the new test lines are in `tests/lang/`, already covered). Read vitest output with `tail`.

If `tsc` cannot resolve `Actor` / `Item` / `ActiveEffect` as values in `src/sheets/index.ts`, they are ambient globals in this project (used already in `src/data/**`); if a specific `tsc` error appears, cast: `(Actor as unknown as ...)`. Only touch `src/types/global.d.ts` if there is genuinely no call-site cast that works — and then add the narrowest possible `declare` and record it in the report.

- [ ] **Step 8: Commit**

```bash
git add src/sheets/actor-sheet.ts src/sheets/item-sheet.ts src/sheets/active-effect-sheet.ts src/sheets/index.ts src/system.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sheets): register the raw-field editor as the default sheet for all types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Add `src/types/global.d.ts` to the `git add` only if Step 7 forced a change there.)

---

## Task 3: README rewrite

**Files:**
- Modify (full rewrite): `README.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Gather the current facts**

- `system.json` — `version`, `compatibility` (`{minimum:"13", verified:"14"}`), the manifest URL.
- `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` §1 — the real names/order of Sub-projects 2–9. Use those, not guesses.
- `package.json` `scripts` — the exact gate commands.
- Is there a `LICENSE` file? (`ls LICENSE*`). If yes, name it; if no, omit the licence section.
- `docs/importing-content.md` exists (link it).
- The 4 shipped packs: `classes`, `races`, `nonweapon-proficiencies`, `weapon-proficiency-groups` (the `conditions` pack was dropped — v14's manifest installer rejects `ActiveEffect` compendia; see `docs/superpowers/plans/2026-09-09-adnd2e-1c4a-pack-tooling-content.md` follow-ups).

- [ ] **Step 2: Write `README.md`**

Replace the whole file. Sections, in order (no rulebook prose anywhere — describe mechanics and structure only):

1. **`# Advanced Dungeons & Dragons 2nd Edition — Foundry VTT System`** + a 2–3 sentence intro: a Foundry VTT **game system** (id `adnd2e`) implementing the AD&D 2nd Edition rules with heavy automation; TypeScript + Vite; **Foundry v14** (compatibility: minimum 13, verified 14).
2. **`## Install`** — keep the existing manifest-URL block and the "Update pulls the newest `latest` build" note.
3. **`## Content policy`** — the repo ships game *mechanics* only: no rulebook text, spell descriptions, monster stat blocks, or magic-item text. To add content you own, use the in-world importer `game.system.api.importContent(json)` — see [`docs/importing-content.md`](docs/importing-content.md).
4. **`## Development`** — clone; `npm install`; `cp foundryconfig.example.json foundryconfig.json` and set `dataPath` to your Foundry user-data directory; `npm run build`; `npm run link` (junctions `dist/` into `Data/systems/adnd2e`); restart Foundry. Then a short list of the gate commands from `package.json`: `npm run typecheck` (runs `tsc` twice — the second pass, `tsconfig.core.json`, proves the pure rules engine imports nothing from Foundry), `npm run lint`, `npm run test` / `npm run test:coverage` (Vitest; the pure zone holds 100% line/branch/function coverage), `npm run build` (Vite library build + `build:packs`).
5. **`## Architecture`** — the two-layer contract in ~4 sentences: `src/core/**` is a framework-free rules engine (pure functions + lookup tables, no Foundry imports, deterministic, returns plain data / formula strings); `src/data/derive/**` is the pure snapshot→derived-values layer; the Foundry layer is `src/data/*` DataModels (schema + `prepareDerivedData` delegating to `core`), `src/documents/` (thin Document subclasses), `src/sheets/` (SP1: a raw-field editor only — designed sheets are SP2/SP6), `src/api/` (`importContent`), `src/migrations/` (version-gated world migrations), `src/config.ts` / `src/settings/`. Then a compact `src/` directory map (one line per top-level dir).
6. **`## Compendium content`** — four Item packs (`classes`, `races`, `nonweapon-proficiencies`, `weapon-proficiency-groups`); source is one JSON document per file under `packs/<name>/_source/`, compiled to LevelDB by `npm run build:packs`. Values are transcribed from the PHB/DMG (mechanical only) with page citations in each pack's `_MANIFEST.md`.
7. **`## Sub-project status`** — a table. Row 1: **SP1 — Foundation — ✅ complete** — "core rules engine + all DataModels + `deriveCharacter` / `deriveCreature` + ActiveEffect two-pass + 4 compendium packs + `build:packs` + `importContent` + migration framework + stub sheets". Then one row per SP2–SP9 using the real names from §1, each "🔜 planned" with a one-line scope.
8. **`## Licence`** — only if a `LICENSE` file exists: one line pointing at it. Otherwise omit.

- [ ] **Step 3: Verify + commit**

Run: `npm run lint 2>&1 | tail -5` (markdown isn't linted, but confirm nothing else regressed).
Check every relative link resolves (`docs/importing-content.md`, `foundryconfig.example.json`).

```bash
git add README.md
git commit -m "docs: rewrite README — v14, dev setup, two-layer architecture, SP status

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Dev-world smoke check (REQUIRED gated step)

**Files:** none — verification. Runs **before** `finishing-a-development-branch`; the branch does not finish until every check passes or a failure becomes a fix.

**Why gated:** the sheet layer has no unit tests by design (spec §9). 1c.3d and 1c.4a merged without their dev-world checks and shipped a world-load crash and an un-installable manifest (hotfixes #16, #17). 1c.4b's gated check caught issues before the PR.

- [ ] **Step 1: Build + link**

```bash
npm run build
npm run link
```
Restart Foundry v14.364; open or create a test world on this system.

- [ ] **Step 2: Actor sheet — render**

Create a `character` actor. Expect: the raw-field sheet opens as the **default** sheet; it shows a `Name` field, an `Image` field, then a `System` header and the full `system` tree with indented sub-headers (Abilities, Attributes, Saves, Classes, Multiclass, Proficiencies, …); scalar fields are typed inputs, `system.classes` / `system.multiclass` / `classLevelLimits`-style fields are JSON textareas; no console error.

- [ ] **Step 3: Actor sheet — edit + save + derive**

In the sheet: set `system.abilities.str.score` to `17`; set the `system.classes` textarea to `[{"chassisId":"fighter","level":7}]`; click **Save**. Then in the console:
```js
const a = game.actors.getName("<the actor name>");
[a.system.abilities.str.score, a.system.classes[0]?.chassisId, a.system.attributes?.thac0, a.system.attributes?.hp?.max]
```
Expect: `17`, `"fighter"`, and a recomputed THAC0 / HP for an L7 fighter (non-null, plausible).

- [ ] **Step 4: Actor sheet — bad JSON is isolated**

Reopen the sheet. Put `[{bad` in the `system.classes` textarea, change `Name` to something new, click **Save**. Expect: a red notification naming `system.classes`; the `Name` change **did** persist; `a.system.classes` is unchanged from Step 3.

- [ ] **Step 5: Item sheet**

Create a `weapon` Item in the sidebar (or drag one from a compendium). Expect: raw-field sheet opens; edit a scalar (e.g. `system.speedFactor`) and a JSON field, Save, confirm both persist via console.

- [ ] **Step 6: ActiveEffect sheet**

On the character, create an ActiveEffect of type `adnd2e` (sidebar → the actor's Effects tab, or `await a.createEmbeddedDocuments("ActiveEffect", [{name:"Test", type:"adnd2e"}])` then open it). Expect: the raw config opens; it shows `system.conditionId`, `system.isCondition`, `system.suppressWhenUnequipped`, `system.schoolTag`, and `system.changes` as a JSON textarea. Set `conditionId` to `blinded`, tick `isCondition`, Save; confirm via `effect.system.conditionId === "blinded"`.

- [ ] **Step 7: Regression — compendium drag + derive + type names**

Drag `Fighter` (classes pack) and `Human` (races pack) onto a fresh `character`. Expect: both embed as items; the derived `system.attributes.thac0` / `.ac` / `.saves` / `.hp.max` compute. Open **Create Actor** and **Create Item** dialogs — the type dropdowns show friendly names ("Character", "Weapon", "Weapon Proficiency", …), not `TYPES.Actor.character`.

- [ ] **Step 8: Record**

Write PASS/FAIL per step into the SDD report / ledger. Any FAIL becomes a fix (resume the relevant implementer) before the branch finishes. Delete the smoke-test actors/items/effects afterward.

---

## Self-Review

**1. Spec coverage.**
- §4 "`sheets/` — STUB registrations only in SP1 (raw field dump); `actor-sheet.ts` `item-sheet.ts`" → Task 1 (the mixin + template) + Task 2 (`actor-sheet.ts`, `item-sheet.ts`, plus `active-effect-sheet.ts` and `index.ts`). The plan adds `raw-field-sheet.ts` and `index.ts` beyond the spec's two filenames — a reasonable decomposition (shared logic + registration), noted here.
- §9 "no Foundry mocks; `data/` / `documents/` / `sheets/` exercised manually in a linked dev world for SP1" → the sheet layer gets no unit tests; Task 4 is the manual dev-world exercise, gated.
- §10 "No real sheet UI. `sheets/` ships a minimal raw-field editor only" → the whole design is a raw field dump; the "Out of scope" list bars every designed-sheet affordance.
- §12.2 "README rewrite" → Task 3.
- §12.8 "`src/sheets/` — minimal raw-field sheets registered for all types" → Task 2 Step 3 registers for Actor, Item, and the `adnd2e` ActiveEffect subtype. (The spec's SP1 deliverable list item 6, "`src/documents/` — … Combatant subclass", and item 7's "handlebars.ts", are pre-existing / not this slice — `src/sheets/handlebars.ts` is created only if Task 1 Step 3 finds a missing helper, and the design avoids that by using `{{#if}}` forms.)

**2. Placeholder scan.** No "TBD" / "add error handling" / "similar to Task N". Every code step has a complete block. Task 3 specifies the README section-by-section with the actual content to write, not "document the architecture". Task 4's console assertions are concrete. The only conditional branches ("if Step 1 shows X, adjust") are genuine v14-API-verification forks, each with a stated fallback (the AE base-class choice; the mixin cast widening) — not deferred work.

**3. Type consistency.**
- `RawFieldSheetMixin(Base)` — defined in Task 1, consumed by Task 2's three classes with the exact `foundry.applications.sheets.*` bases named in Task 2 Step 2.
- `registerSheets(): void` — Task 2 Step 3 defines it in `src/sheets/index.ts`; Task 2 Step 4 imports `{ registerSheets }` from `./sheets` into `src/system.ts`.
- `FieldRow` shape (`path`, `label`, `indent`, `header?`, `kind?`, `value?`, `choices?`) — produced by `buildFieldRows` in Task 1, consumed only by `templates/sheets/raw-fields.hbs` in Task 1 (same task). The template's `kind` strings (`checkbox`/`select`/`json`/`number`/`textarea`/`text`) exactly match `RowKind`.
- Lang keys `ADND2E.sheets.{rawActor,rawItem,rawEffect,badJson}` — `badJson` is `game.i18n.format`'d in Task 1's `_processFormData` with `{ field }`; `rawActor`/`rawItem`/`rawEffect` are the `label`s in Task 2 Step 3; all four are defined in Task 2 Step 6 and asserted in Task 2 Step 5.
- `templates/sheets/raw-fields.hbs` path — written in Task 1 Step 3, referenced as `"systems/adnd2e/templates/sheets/raw-fields.hbs"` in Task 1's `static PARTS`.

No gaps found.

---

## Execution Handoff

Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, a spec + quality review between tasks, a whole-branch review at the end, then the gated Task 4 smoke check before the finish menu.

**2. Inline Execution** — batch execution with checkpoints in this session.

Which approach?
