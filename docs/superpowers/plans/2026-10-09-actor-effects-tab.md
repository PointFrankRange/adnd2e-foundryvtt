# Actor Effects Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Effects" tab to the PC, Character NPC and Monster NPC sheets that lists an actor's effects in three groups and lets editors create, toggle, edit, delete custom effects and remove conditions.

**Architecture:** A pure view builder (`src/sheets/effects/view.ts`, in the coverage gate) turns effect-like records into three row groups with per-row control flags. A Foundry-coupled glue module (`src/sheets/effects-actions.ts`) maps real `ActiveEffect` documents to those records and implements the six actions. One shared template (`templates/actor/shared/effects.hbs`) is mounted as an `effects` part/tab on all three sheets.

**Tech Stack:** TypeScript, Foundry VTT v14 (ApplicationV2 sheets, `ActiveEffect` `adnd2e` subtype), Handlebars, vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-adnd2e-actor-effects-tab-design.md`

## Global Constraints

- Three groups, in this order: Conditions, Custom, From items. Empty groups are omitted. Classification precedence (a plan ruling; the spec lists the groups but not a tie-break): an effect whose parent is an Item is **From items**; else `system.isCondition` is **Conditions**; else **Custom**.
- Conditions: remove-only. From items: read-only (the only control is "open source item", always available). Custom: toggle, edit, delete. Create is a header button.
- When the sheet is not editable (`isEditable` false) no row has toggle/edit/delete/remove and `canCreate` is false; "open source item" stays.
- Permissions: anyone for whom `sheet.isEditable` is true; no GM-only checks.
- "New effect" creates `{ name, img, type: "adnd2e" }` through `actor.createEmbeddedDocuments("ActiveEffect", …)` and opens the new effect's existing raw-field sheet. No friendly editor, no create dialog.
- Condition removal MUST go through `actor.toggleStatusEffect(conditionId, { active: false })` (same call as the Token HUD and Stand Up); an effect with a null `conditionId` falls back to `effect.delete()`. Never delete a `held`/`grappling` effect directly.
- Item-sourced effects reach the actor through `actor.allApplicableEffects()` (not `actor.effects`). Toggle/edit/delete/remove handlers act only on `actor.effects` (the actor's own collection).
- Duration label: use `effect.duration.label` only when `effect.isTemporary` is true; otherwise `""` (core returns the word "None" for indefinite effects).
- No new setting, schema, migration, or change to wrestling/conditions/the `adnd2e` effect model.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Pure effects view builder

**Files:**
- Create: `src/sheets/effects/view.ts`
- Create: `tests/sheets/effects/view.test.ts`
- Modify: `vitest.config.ts` (add `"src/sheets/effects/**/*.ts",` to the coverage `include` list, next to `"src/sheets/kit/**/*.ts",`)

**Interfaces:**
- Produces (exported from `src/sheets/effects/view.ts`):
  ```ts
  export interface EffectRecord {
    id: string; name: string; img: string;
    disabled: boolean; suppressed: boolean;
    isCondition: boolean; conditionId: string | null;
    durationLabel: string;                       // "" when indefinite
    source: { id: string; name: string } | null; // owning Item, when the effect lives on one
  }
  export interface EffectRowView {
    id: string; name: string; img: string;
    disabled: boolean; suppressed: boolean; durationLabel: string;
    sourceId: string; sourceName: string;        // "" when none
    canToggle: boolean; canEdit: boolean; canDelete: boolean;
    canRemove: boolean; canOpenSource: boolean;
  }
  export type EffectGroupKey = "conditions" | "custom" | "items";
  export interface EffectGroupView { key: EffectGroupKey; labelKey: string; rows: EffectRowView[] }
  export interface EffectsView { groups: EffectGroupView[]; canCreate: boolean; isEmpty: boolean }
  export function buildEffectsView(records: readonly EffectRecord[], editable: boolean): EffectsView;
  ```
  `labelKey` values: `ADND2E.sheet.effects.groups.conditions`, `.custom`, `.items`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sheets/effects/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildEffectsView, type EffectRecord } from "../../../src/sheets/effects/view";

const rec = (over: Partial<EffectRecord> = {}): EffectRecord => ({
  id: "e1", name: "Bless", img: "icons/svg/aura.svg",
  disabled: false, suppressed: false,
  isCondition: false, conditionId: null,
  durationLabel: "", source: null,
  ...over,
});

describe("buildEffectsView", () => {
  it("groups conditions, custom and item effects in that order and omits empty groups", () => {
    const view = buildEffectsView(
      [
        rec({ id: "i", name: "Ring", source: { id: "it1", name: "Ring of Protection" } }),
        rec({ id: "c", name: "Custom" }),
        rec({ id: "s", name: "Stunned", isCondition: true, conditionId: "stunned" }),
      ],
      true,
    );
    expect(view.groups.map((g) => g.key)).toEqual(["conditions", "custom", "items"]);
    expect(view.groups.map((g) => g.labelKey)).toEqual([
      "ADND2E.sheet.effects.groups.conditions",
      "ADND2E.sheet.effects.groups.custom",
      "ADND2E.sheet.effects.groups.items",
    ]);
    const onlyCustom = buildEffectsView([rec()], true);
    expect(onlyCustom.groups.map((g) => g.key)).toEqual(["custom"]);
    expect(onlyCustom.isEmpty).toBe(false);
  });

  it("is empty with no records, but still offers create when editable", () => {
    const view = buildEffectsView([], true);
    expect(view.groups).toEqual([]);
    expect(view.isEmpty).toBe(true);
    expect(view.canCreate).toBe(true);
  });

  it("an effect on an item is From items even if it is flagged as a condition", () => {
    const view = buildEffectsView(
      [rec({ isCondition: true, conditionId: "held", source: { id: "it1", name: "Net" } })],
      true,
    );
    expect(view.groups.map((g) => g.key)).toEqual(["items"]);
  });

  it("custom rows get toggle/edit/delete; conditions only remove; item rows only open-source", () => {
    const view = buildEffectsView(
      [
        rec({ id: "c" }),
        rec({ id: "s", isCondition: true, conditionId: "stunned" }),
        rec({ id: "i", source: { id: "it1", name: "Ring" } }),
      ],
      true,
    );
    const row = (id: string) => view.groups.flatMap((g) => g.rows).find((r) => r.id === id)!;
    expect(row("c")).toMatchObject({ canToggle: true, canEdit: true, canDelete: true, canRemove: false, canOpenSource: false });
    expect(row("s")).toMatchObject({ canToggle: false, canEdit: false, canDelete: false, canRemove: true, canOpenSource: false });
    expect(row("i")).toMatchObject({
      canToggle: false, canEdit: false, canDelete: false, canRemove: false, canOpenSource: true,
      sourceId: "it1", sourceName: "Ring",
    });
  });

  it("a non-editable sheet hides every mutating control but keeps open-source", () => {
    const view = buildEffectsView(
      [
        rec({ id: "c" }),
        rec({ id: "s", isCondition: true, conditionId: "stunned" }),
        rec({ id: "i", source: { id: "it1", name: "Ring" } }),
      ],
      false,
    );
    expect(view.canCreate).toBe(false);
    const rows = view.groups.flatMap((g) => g.rows);
    for (const r of rows) {
      expect(r.canToggle || r.canEdit || r.canDelete || r.canRemove).toBe(false);
    }
    expect(rows.find((r) => r.id === "i")!.canOpenSource).toBe(true);
  });

  it("passes disabled, suppressed, duration label and image through", () => {
    const view = buildEffectsView(
      [rec({ disabled: true, suppressed: true, durationLabel: "3 rounds", img: "x.svg" })],
      true,
    );
    expect(view.groups[0]!.rows[0]).toMatchObject({
      disabled: true, suppressed: true, durationLabel: "3 rounds", img: "x.svg", sourceId: "", sourceName: "",
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/sheets/effects/view.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/sheets/effects/view.ts`:

```ts
// Pure view model for the actor sheets' Effects tab (#128). No Foundry imports — the Foundry-coupled mapping from real
// ActiveEffect documents lives in src/sheets/effects-actions.ts.

export interface EffectRecord {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  suppressed: boolean;
  isCondition: boolean;
  conditionId: string | null;
  /** "" when the effect has no temporary duration. */
  durationLabel: string;
  /** the owning Item, when the effect lives on one (a transferred item effect). */
  source: { id: string; name: string } | null;
}

export interface EffectRowView {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  suppressed: boolean;
  durationLabel: string;
  sourceId: string;
  sourceName: string;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRemove: boolean;
  canOpenSource: boolean;
}

export type EffectGroupKey = "conditions" | "custom" | "items";

export interface EffectGroupView {
  key: EffectGroupKey;
  labelKey: string;
  rows: EffectRowView[];
}

export interface EffectsView {
  groups: EffectGroupView[];
  canCreate: boolean;
  isEmpty: boolean;
}

const GROUP_ORDER: readonly EffectGroupKey[] = ["conditions", "custom", "items"];

/** An effect on an item is "From items"; otherwise a condition effect is "Conditions"; everything else is "Custom". */
function groupOf(r: EffectRecord): EffectGroupKey {
  if (r.source) return "items";
  return r.isCondition ? "conditions" : "custom";
}

function rowOf(r: EffectRecord, group: EffectGroupKey, editable: boolean): EffectRowView {
  return {
    id: r.id,
    name: r.name,
    img: r.img,
    disabled: r.disabled,
    suppressed: r.suppressed,
    durationLabel: r.durationLabel,
    sourceId: r.source?.id ?? "",
    sourceName: r.source?.name ?? "",
    canToggle: editable && group === "custom",
    canEdit: editable && group === "custom",
    canDelete: editable && group === "custom",
    canRemove: editable && group === "conditions",
    canOpenSource: group === "items",
  };
}

/** Group, order and annotate an actor's effects for the Effects tab. */
export function buildEffectsView(records: readonly EffectRecord[], editable: boolean): EffectsView {
  const groups: EffectGroupView[] = [];
  for (const key of GROUP_ORDER) {
    const rows = records.filter((r) => groupOf(r) === key).map((r) => rowOf(r, key, editable));
    if (rows.length) groups.push({ key, labelKey: `ADND2E.sheet.effects.groups.${key}`, rows });
  }
  return { groups, canCreate: editable, isEmpty: groups.length === 0 };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/sheets/effects/view.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`
Expected: clean.

```bash
git add src/sheets/effects/view.ts tests/sheets/effects/view.test.ts vitest.config.ts
git commit -m "feat(effects): pure Effects tab view builder (#128)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Glue module, shared template, and copy

**Files:**
- Create: `src/sheets/effects-actions.ts`
- Create: `templates/actor/shared/effects.hbs`
- Modify: `lang/en.json` (add `"effects": "Effects"` to `sheet.tabs`; add a `sheet.effects` object beside `sheet.itemControls`)

**Interfaces:**
- Consumes: Task 1 `buildEffectsView`, `EffectsView`, `EffectRecord`.
- Produces (exported from `src/sheets/effects-actions.ts`; `actor` is typed structurally, callers cast `this.document as never`):
  - `effectsContext(actor, editable: boolean): EffectsView`
  - `createEffect(actor): Promise<void>`
  - `toggleEffect(actor, effectId: string): Promise<void>`
  - `editEffect(actor, effectId: string): void`
  - `deleteEffect(actor, effectId: string): Promise<void>`
  - `removeCondition(actor, effectId: string): Promise<void>`
  - `openEffectSource(actor, itemId: string): void`
- Template reads the context key `effectsView` (an `EffectsView`) and emits these `data-action` names: `createEffect`, `toggleEffect`, `editEffect`, `deleteEffect`, `removeCondition`, `openEffectSource`, with `data-effect-id` (and `data-item-id` for `openEffectSource`).

This is Foundry glue outside the coverage gate; it is verified by typecheck, the binding test in Task 3, and the headless proof / manual checklist in Task 4.

- [ ] **Step 1: Write the glue module**

Create `src/sheets/effects-actions.ts`:

```ts
// Effects-tab glue shared by the PC, Character NPC and Monster NPC sheets (#128). Foundry-coupled — verified in the dev
// world. Mapping from real ActiveEffect documents to the pure view model, plus the six tab actions. Every mutating
// action acts only on the actor's OWN effects collection (never an item's transferred effect), and the sheet handlers
// gate on isEditable before calling in.
import { buildEffectsView, type EffectRecord, type EffectsView } from "./effects/view";

interface EffectDoc {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  isSuppressed: boolean;
  isTemporary: boolean;
  duration: { label?: string };
  system: { isCondition?: boolean; conditionId?: string | null };
  parent: { documentName: string; id: string; name: string } | null;
  sheet: { render(options?: { force?: boolean }): unknown } | null;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

interface EffectOwner {
  effects: { get(id: string): EffectDoc | undefined };
  items: { get(id: string): { sheet: { render(options?: { force?: boolean }): unknown } | null } | undefined };
  allApplicableEffects(): Iterable<EffectDoc>;
  createEmbeddedDocuments(type: "ActiveEffect", data: Record<string, unknown>[]): Promise<EffectDoc[]>;
  toggleStatusEffect(id: string, options: { active: boolean }): Promise<unknown>;
}

function recordOf(effect: EffectDoc): EffectRecord {
  const onItem = effect.parent?.documentName === "Item";
  return {
    id: effect.id,
    name: effect.name,
    img: effect.img,
    disabled: effect.disabled,
    suppressed: effect.isSuppressed,
    isCondition: !!effect.system.isCondition,
    conditionId: effect.system.conditionId ?? null,
    // core reports the word "None" for an indefinite duration — only label genuinely timed effects
    durationLabel: effect.isTemporary ? (effect.duration.label ?? "") : "",
    source: onItem ? { id: effect.parent!.id, name: effect.parent!.name } : null,
  };
}

/** The Effects tab's view model. Uses allApplicableEffects() so effects transferred from owned items appear too. */
export function effectsContext(actor: unknown, editable: boolean): EffectsView {
  const owner = actor as EffectOwner;
  return buildEffectsView([...owner.allApplicableEffects()].map(recordOf), editable);
}

/** "New effect": a blank adnd2e effect on the actor, opened in the existing raw-field editor. */
export async function createEffect(actor: unknown): Promise<void> {
  const owner = actor as EffectOwner;
  const [created] = await owner.createEmbeddedDocuments("ActiveEffect", [
    { name: game.i18n!.localize("ADND2E.sheet.effects.newName"), img: "icons/svg/aura.svg", type: "adnd2e" },
  ]);
  created?.sheet?.render({ force: true });
}

/** Custom effects only: a condition is removed, never toggled. */
export async function toggleEffect(actor: unknown, effectId: string): Promise<void> {
  const effect = (actor as EffectOwner).effects.get(effectId);
  if (!effect || effect.system.isCondition) return;
  await effect.update({ disabled: !effect.disabled });
}

export function editEffect(actor: unknown, effectId: string): void {
  (actor as EffectOwner).effects.get(effectId)?.sheet?.render({ force: true });
}

/** Custom effects only, after confirmation. */
export async function deleteEffect(actor: unknown, effectId: string): Promise<void> {
  const effect = (actor as EffectOwner).effects.get(effectId);
  if (!effect || effect.system.isCondition) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n!.localize("ADND2E.sheet.effects.deleteTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheet.effects.deleteConfirm", { name: effect.name })}</p>`,
  });
  if (confirmed) await effect.delete();
}

/** Remove a condition through the same call as the Token HUD and the Stand Up button, so wrestling's held/grappling
 *  cleanup runs. An effect with no condition id falls back to a plain delete. */
export async function removeCondition(actor: unknown, effectId: string): Promise<void> {
  const owner = actor as EffectOwner;
  const effect = owner.effects.get(effectId);
  if (!effect?.system.isCondition) return;
  if (effect.system.conditionId) await owner.toggleStatusEffect(effect.system.conditionId, { active: false });
  else await effect.delete();
}

export function openEffectSource(actor: unknown, itemId: string): void {
  (actor as EffectOwner).items.get(itemId)?.sheet?.render({ force: true });
}
```

- [ ] **Step 2: Write the shared template**

Create `templates/actor/shared/effects.hbs`:

```hbs
<section class="tab effects{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
  <section class="kit-panel">
    <div class="kit-bar">
      <span>{{localize 'ADND2E.sheet.effects.title'}}</span>
      {{#if effectsView.canCreate}}
        <button type="button" class="item-control" data-action="createEffect" title="{{localize 'ADND2E.sheet.effects.new'}}" aria-label="{{localize 'ADND2E.sheet.effects.new'}}"><i class="fa-solid fa-plus"></i></button>
      {{/if}}
    </div>
    <div class="kit-body">
      {{#if effectsView.isEmpty}}<p class="hint">{{localize 'ADND2E.sheet.effects.empty'}}</p>{{/if}}
      {{#each effectsView.groups as |group|}}
        <h4 class="effects-group">{{localize group.labelKey}}</h4>
        <ul class="effects-list">
          {{#each group.rows as |row|}}
            <li class="effect-row{{#if row.disabled}} disabled{{/if}}{{#if row.suppressed}} suppressed{{/if}}">
              <img src="{{row.img}}" alt="" width="24" height="24">
              <span class="effect-name">{{row.name}}</span>
              {{#if row.sourceName}}<span class="effect-source">{{localize 'ADND2E.sheet.effects.source'}}: {{row.sourceName}}</span>{{/if}}
              {{#if row.durationLabel}}<span class="effect-duration">{{row.durationLabel}}</span>{{/if}}
              {{#if row.suppressed}}<span class="effect-flag">{{localize 'ADND2E.sheet.effects.suppressed'}}</span>{{/if}}
              {{#if row.disabled}}<span class="effect-flag">{{localize 'ADND2E.sheet.effects.disabled'}}</span>{{/if}}
              <span class="item-controls">
                {{#if row.canToggle}}<button type="button" class="item-control" data-action="toggleEffect" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheet.effects.toggle'}}" aria-label="{{localize 'ADND2E.sheet.effects.toggle'}}"><i class="fa-solid fa-power-off"></i></button>{{/if}}
                {{#if row.canEdit}}<button type="button" class="item-control" data-action="editEffect" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheet.effects.edit'}}" aria-label="{{localize 'ADND2E.sheet.effects.edit'}}"><i class="fa-solid fa-pen-to-square"></i></button>{{/if}}
                {{#if row.canDelete}}<button type="button" class="item-control" data-action="deleteEffect" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheet.effects.delete'}}" aria-label="{{localize 'ADND2E.sheet.effects.delete'}}"><i class="fa-solid fa-trash"></i></button>{{/if}}
                {{#if row.canRemove}}<button type="button" class="item-control" data-action="removeCondition" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheet.effects.remove'}}" aria-label="{{localize 'ADND2E.sheet.effects.remove'}}"><i class="fa-solid fa-xmark"></i></button>{{/if}}
                {{#if row.canOpenSource}}<button type="button" class="item-control" data-action="openEffectSource" data-item-id="{{row.sourceId}}" title="{{localize 'ADND2E.sheet.effects.openSource'}}" aria-label="{{localize 'ADND2E.sheet.effects.openSource'}}"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>{{/if}}
              </span>
            </li>
          {{/each}}
        </ul>
      {{/each}}
    </div>
  </section>
</section>
```

- [ ] **Step 3: Add the copy**

In `lang/en.json`: in `sheet.tabs` (the object containing `"main": "Main"` … `"notes": "Notes"`), add `"effects": "Effects"` after `"notes": "Notes"` (add the comma). Immediately after the `sheet.itemControls` object (the one ending with `"deleteConfirm": "Delete {name} from this character? This can't be undone."`), add:

```json
      "effects": {
        "title": "Effects",
        "new": "New effect",
        "newName": "New Effect",
        "empty": "No effects on this actor.",
        "source": "From",
        "suppressed": "Suppressed",
        "disabled": "Disabled",
        "toggle": "Enable or disable this effect",
        "edit": "Edit this effect",
        "delete": "Delete this effect",
        "remove": "Remove this condition",
        "openSource": "Open the item that grants this effect",
        "deleteTitle": "Delete Effect",
        "deleteConfirm": "Delete the effect {name}? This can't be undone.",
        "groups": {
          "conditions": "Conditions",
          "custom": "Custom effects",
          "items": "From items"
        }
      },
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm run lint && npx vitest run tests/lang`
Expected: green (the lang tests may report unused/missing keys — every key above is used by the template/glue).

```bash
git add src/sheets/effects-actions.ts templates/actor/shared/effects.hbs lang/en.json
git commit -m "feat(effects): Effects tab glue, shared template and copy (#128)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the tab into all three sheets

**Files:**
- Modify: `src/sheets/character/sheet.ts` (PARTS ~391, TABS ~404, actions ~340-389, `_prepareContext` ~440, handlers near `#onEditItem` ~894)
- Modify: `src/sheets/npc/sheet.ts` (PARTS ~142, TABS ~152, actions ~111-135, `_prepareContext` ~165, handlers near `#onEditItem` ~540)
- Modify: `src/sheets/creature/sheet.ts` (PARTS ~80, TABS ~90, actions ~58-77, `_prepareContext` ~100, handlers near `#onEditItem` ~329)
- Create: `tests/templates/effects-bindings.test.ts`

**Interfaces:**
- Consumes: Task 2 `effectsContext`, `createEffect`, `toggleEffect`, `editEffect`, `deleteEffect`, `removeCondition`, `openEffectSource`; the template path `actor/shared/effects.hbs`; the context key `effectsView`.

Read each file around the quoted lines first — line numbers drift. The three sheets follow the same shape; apply the same edit to each, using that file's own class name (`Adnd2eCharacterSheet`, `Adnd2eNpcSheet`, `Adnd2eCreatureSheet`) and its own template-path helper (the PC sheet uses a local `TP(...)` for `actor/pc`; the NPC and creature sheets use `TEMPLATE_PATH("actor/<dir>", "<file>")` — use `TEMPLATE_PATH("actor/shared", "effects.hbs")` in all three, importing `TEMPLATE_PATH` in the PC sheet only if it is not already imported there).

- [ ] **Step 1: Write the failing binding test**

Create `tests/templates/effects-bindings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");

const TEMPLATE = read("templates", "actor", "shared", "effects.hbs");
const SHEETS = [
  { name: "Adnd2eCharacterSheet", src: read("src", "sheets", "character", "sheet.ts") },
  { name: "Adnd2eNpcSheet", src: read("src", "sheets", "npc", "sheet.ts") },
  { name: "Adnd2eCreatureSheet", src: read("src", "sheets", "creature", "sheet.ts") },
];

describe("Effects tab bindings (#128)", () => {
  const used = [...new Set([...TEMPLATE.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!))];

  it("the shared template uses exactly the six effect actions", () => {
    expect(used.sort()).toEqual(
      ["createEffect", "deleteEffect", "editEffect", "openEffectSource", "removeCondition", "toggleEffect"],
    );
  });

  for (const sheet of SHEETS) {
    it(`${sheet.name} registers every action the template uses`, () => {
      for (const action of used) {
        expect(sheet.src, action).toMatch(new RegExp(`^\\s+${action}: ${sheet.name}\\.#on`, "m"));
      }
    });
    it(`${sheet.name} declares the effects part, the effects tab and the effectsView context`, () => {
      expect(sheet.src).toContain("actor/shared");
      expect(sheet.src).toMatch(/effects: \{ template: .*effects\.hbs/);
      expect(sheet.src).toMatch(/\{ id: "effects"/);
      expect(sheet.src).toContain("effectsView");
    });
  }
});
```

Run: `npx vitest run tests/templates/effects-bindings.test.ts`
Expected: FAIL (the sheets do not declare the part/actions yet).

- [ ] **Step 2: PC sheet**

In `src/sheets/character/sheet.ts`:

1. Import: `import { createEffect, deleteEffect, editEffect, effectsContext, openEffectSource, removeCondition, toggleEffect } from "../effects-actions";`
2. In `static PARTS`, after the `features` entry add: `effects: { template: TEMPLATE_PATH("actor/shared", "effects.hbs"), scrollable: [""] },`.
3. In `static TABS.primary.tabs`, after the `features` tab add: `{ id: "effects", icon: "fa-solid fa-wand-magic-sparkles" },`.
4. In `DEFAULT_OPTIONS.actions`, after `deleteItem: Adnd2eCharacterSheet.#onDeleteItem,` add:
```ts
      createEffect: Adnd2eCharacterSheet.#onCreateEffect,
      toggleEffect: Adnd2eCharacterSheet.#onToggleEffect,
      editEffect: Adnd2eCharacterSheet.#onEditEffect,
      deleteEffect: Adnd2eCharacterSheet.#onDeleteEffect,
      removeCondition: Adnd2eCharacterSheet.#onRemoveCondition,
      openEffectSource: Adnd2eCharacterSheet.#onOpenEffectSource,
```
5. In `_prepareContext`, after `context.pcActions = true;` add: `context.effectsView = effectsContext(this.document, this.isEditable);`
6. After `#onDeleteItem` add the handlers:
```ts
  static async #onCreateEffect(this: Adnd2eCharacterSheet): Promise<void> {
    if (this.isEditable) await createEffect(this.document);
  }

  static async #onToggleEffect(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.effectId;
    if (id && this.isEditable) await toggleEffect(this.document, id);
  }

  static #onEditEffect(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): void {
    const id = target.dataset.effectId;
    if (id && this.isEditable) editEffect(this.document, id);
  }

  static async #onDeleteEffect(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.effectId;
    if (id && this.isEditable) await deleteEffect(this.document, id);
  }

  static async #onRemoveCondition(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.effectId;
    if (id && this.isEditable) await removeCondition(this.document, id);
  }

  static #onOpenEffectSource(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): void {
    const id = target.dataset.itemId;
    if (id) openEffectSource(this.document, id);
  }
```

- [ ] **Step 3: Character NPC sheet**

In `src/sheets/npc/sheet.ts`: same import (path `"../effects-actions"`); PARTS entry `effects: { template: TEMPLATE_PATH("actor/shared", "effects.hbs"), scrollable: [""] },` after `spells`; TABS entry `{ id: "effects", icon: "fa-solid fa-wand-magic-sparkles" },` after `spells` and before `journal`; the six action registrations with `Adnd2eNpcSheet.#on…`; `context.effectsView = effectsContext(this.document, this.isEditable);` in `_prepareContext` after `context.notEditable`/`editable` assignments (do NOT set `context.pcActions`); and the six handlers, identical to Step 2 with `this: Adnd2eNpcSheet`.

- [ ] **Step 4: Monster NPC sheet**

In `src/sheets/creature/sheet.ts`: same import; PARTS entry after `spells`: `effects: { template: TEMPLATE_PATH("actor/shared", "effects.hbs"), scrollable: [""] },`; TABS entry after `spells` and before `notes`: `{ id: "effects", icon: "fa-solid fa-wand-magic-sparkles" },`; the six action registrations with `Adnd2eCreatureSheet.#on…`; `context.effectsView = effectsContext(this.document, this.isEditable);` after `context.editable = this.isEditable;`; handlers identical to Step 2 with `this: Adnd2eCreatureSheet`.

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/templates tests/lang && npm run typecheck && npm run lint`
Expected: PASS (the new binding test now passes; the existing PC/NPC/creature binding tests still pass — their data-action scans do not include `templates/actor/shared`).

- [ ] **Step 6: Commit**

```bash
git add src/sheets/character/sheet.ts src/sheets/npc/sheet.ts src/sheets/creature/sheet.ts tests/templates/effects-bindings.test.ts
git commit -m "feat(effects): Effects tab on the PC, Character NPC and Monster NPC sheets (#128)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gates, headless proof, README, manual checklist

**Files:**
- Modify: `README.md` (only if it states that actor sheets have no effects UI — `grep -n -i "active effect" README.md`; if nothing says so, leave it)
- Scratch (git-ignored, do NOT commit): `.superpowers/proof/effects.proof.ts`

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage`
Expected: green; 100% statement coverage.

- [ ] **Step 2: Headless proof (best effort)**

Recipe: the memory note `foundry-headless-proof-harness` (load real Foundry `common/server.mjs`, set `globalThis.foundry`, stub `game.i18n`/`ui`/`logger`, wrap a fake actor in a Proxy that throws on unexpected property access). Write `.superpowers/proof/effects.proof.ts` and run it with the proof vitest config. Prove against the real `Adnd2eActiveEffectModel` schema and the real glue in `src/sheets/effects-actions.ts`:
1. `createEffect` creates `{ type: "adnd2e", name, img }` and its data validates against the model schema.
2. `toggleEffect` flips `disabled` on a custom effect and does nothing for an `isCondition` effect.
3. `deleteEffect` (with a stubbed `DialogV2.confirm` returning true, then false) deletes only on true and refuses a condition.
4. `removeCondition` calls `toggleStatusEffect(conditionId, { active: false })` for `held` and falls back to `delete()` when `conditionId` is null.
5. `effectsContext` puts an effect with an Item parent in the From items group with the item's name, and uses `allApplicableEffects()`.
6. Render `templates/actor/shared/effects.hbs` with Handlebars (a `localize` helper reading `lang/en.json`) for an editable and a non-editable view; assert the `data-action` buttons appear/disappear accordingly.
Report what was proven and what was not (real clicks, permissions for a non-GM seat, sheet render). If a step cannot be done with the harness, say so; do not stub around it.

- [ ] **Step 3: README**

Only if Step 3's grep finds a statement that actor sheets have no effects UI, update it to say there is an Effects tab. Otherwise skip.

- [ ] **Step 4: Commit (if README changed)**

```bash
git add README.md
git commit -m "docs: actor Effects tab (#128)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Manual dev-world checklist (controller hands this to the user)**

Prerequisites: Foundry closed, then `npm run build` and relaunch so the installed system has this branch. A world with a PC (give it a Fighter class item), a Character NPC, a Monster NPC. A weapon or armor item on the PC with a transferred `adnd2e` effect (create it on the item's Effects, mark it transfer, set "Suppress when unequipped"). Run once as GM and once from a non-GM player seat owning the PC. Reset any setting you change.
1. Each of the three sheets has an Effects tab; with no effects it shows "No effects on this actor.".
2. + New effect adds "New Effect" under Custom effects and opens its raw editor; rename it there; the list updates.
3. Toggle: the row shows "Disabled" and dims; toggle again clears it.
4. Edit reopens the editor; Delete asks for confirmation; Cancel keeps it, Confirm removes it.
5. Apply Stunned from the Token HUD: it appears under Conditions with only a remove (×) control; clicking × removes it (same as the HUD).
6. With Wrestling on, make the PC `held`; remove it from the Effects tab: the grapple clears the same way as the HUD (the holder's `grappling` condition goes too, no console errors).
7. The equipped item's transferred effect shows under From items with "From: <item name>" and an open-item button that opens the item; unequip the item: the row shows "Suppressed". No toggle/delete on it.
8. Non-GM seat on the PC: steps 2-5 work (owner can edit); on a Character NPC or Monster NPC the player does NOT own, the tab lists effects but shows no create/toggle/edit/delete/remove controls.
9. A sheet viewed read-only (Limited/Observer) shows the list with no controls.
```

---

## Self-Review

- **Spec coverage:** §1 view builder, groups, order, omitted-empty, control flags, non-editable → Task 1 (plus the precedence ruling stated in Global Constraints). §2 six actions with own-collection guard, confirm dialog, `toggleStatusEffect` removal, null-`conditionId` fallback → Task 2 (handlers add the `isEditable` gate in Task 3). §3 shared partial/template, tab + part + context + actions on all three sheets, i18n → Tasks 2-3. §4 out of scope respected (no editor, schema, setting). Testing: view unit tests (Task 1), binding + lang tests (Task 3), headless proof and gates (Task 4), manual checklist with prerequisites and a non-GM seat (Task 4 Step 5). Risks: `allApplicableEffects()` (Task 2 `effectsContext`), three-sheet duplication (Task 3 + binding test), `toggleStatusEffect` (Task 2).
- **Spec deviation:** the spec describes a shared *partial*; the plan uses one shared *template* mounted as each sheet's part (no partial registration needed). Same effect, less wiring.
- **Placeholder scan:** none; every code step contains full code. Task 3 gives full handler code once and applies it per sheet by class name.
- **Type consistency:** `EffectsView`/`buildEffectsView`/`effectsContext` names, the `effectsView` context key, the six action names, `data-effect-id`/`data-item-id`, and the i18n keys match across Tasks 1-3 and the binding test.
