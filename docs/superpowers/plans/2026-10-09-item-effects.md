# Item Sheet Image Header and Gear Effects Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clickable image in every item sheet header (#148) and give weapon, armor and equipment sheets an Effects section to create, enable/disable, edit, delete effects and toggle whether each transfers to the owner (#146).

**Architecture:** A pure item-effects view builder (`src/sheets/effects/item-view.ts`, in the coverage gate) feeds a new `raw-effects.hbs` partial rendered at the bottom of the generic item sheet for the three gear types. A Foundry-coupled glue module (`src/sheets/item-effects-actions.ts`) implements the actions on the item's own effects; the item sheet class registers them. The header template renders the document image with the core `editImage` action instead of the raw path input.

**Tech Stack:** TypeScript, Foundry VTT v14 (ApplicationV2 item sheets, `adnd2e` ActiveEffect), Handlebars, SCSS, vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-adnd2e-item-effects-design.md`

## Global Constraints

- Effects section only on item types `weapon`, `armor`, `equipment`. Every other item type, the ActiveEffect sheet and any actor rendered by the raw mixin get no `itemEffects` context key and render as before (plus the image header for any document with an `img` row).
- Image header: the portrait is `<img … data-action="editImage" data-edit="img">` (a core DocumentSheetV2 action; no handler added), inert (no `data-action`) when the sheet is not editable. The raw `Image` path input is removed from the header's generic row loop; `name` and the portrait remain.
- New effects from a gear item: `{ name, img: "icons/svg/aura.svg", type: "adnd2e", transfer: true, system: { suppressWhenUnequipped: true } }`, then open the new effect's sheet. Effects stay edited in the existing raw `adnd2e` editor; no friendly editor.
- `disabled` and `transfer` live on the effect document, not in `system`: toggle them with `effect.update({...})` directly, never through the sheet form data.
- Glue acts only on the item's own `effects` collection; each sheet handler gates on `this.isEditable`. Delete confirms with `DialogV2.confirm`; the effect name in the dialog is escaped with `foundry.utils.escapeHTML`.
- Duration label: `effect.duration.label` only when `effect.isTemporary`; otherwise `""` (core returns "None" for indefinite).
- Never put Foundry core's `.disabled` CSS class on a container with clickable controls (core sets `pointer-events: none`; this bit PR #144). Use `effect-disabled`/`effect-suppressed`.
- Copy lives under `ADND2E.sheets.effects.*` (note `sheets`, plural; the actor tab's keys are under `sheet.effects`).
- No schema, setting or migration change. Not in scope: ammo/spell/kit/trait effects, a friendlier effect editor, a change-key catalogue.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Pure item-effects view builder

**Files:**
- Create: `src/sheets/effects/item-view.ts`
- Create: `tests/sheets/effects/item-view.test.ts`

(`vitest.config.ts` already includes `src/sheets/effects/**/*.ts` from the actor Effects tab — verify with a grep; add it only if missing.)

**Interfaces:**
- Produces (exported from `src/sheets/effects/item-view.ts`):
  ```ts
  export interface ItemEffectRecord {
    id: string; name: string; img: string;
    disabled: boolean; transfer: boolean;
    suppressWhenUnequipped: boolean;
    suppressed: boolean;      // the effect's own isSuppressed (e.g. its item is unequipped)
    durationLabel: string;    // "" when indefinite
  }
  export interface ItemEffectRowView extends ItemEffectRecord {
    canToggle: boolean; canEdit: boolean; canDelete: boolean; canTransfer: boolean;
  }
  export interface ItemEffectsView { rows: ItemEffectRowView[]; canCreate: boolean; isEmpty: boolean }
  export function buildItemEffectsView(records: readonly ItemEffectRecord[], editable: boolean): ItemEffectsView;
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/sheets/effects/item-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildItemEffectsView, type ItemEffectRecord } from "../../../src/sheets/effects/item-view";

const rec = (over: Partial<ItemEffectRecord> = {}): ItemEffectRecord => ({
  id: "e1", name: "+1 to hit", img: "icons/svg/aura.svg",
  disabled: false, transfer: true, suppressWhenUnequipped: true,
  suppressed: false, durationLabel: "",
  ...over,
});

describe("buildItemEffectsView", () => {
  it("is empty with no records but still offers create when editable", () => {
    const view = buildItemEffectsView([], true);
    expect(view.rows).toEqual([]);
    expect(view.isEmpty).toBe(true);
    expect(view.canCreate).toBe(true);
  });

  it("an editable sheet gives every row all four controls, in input order", () => {
    const view = buildItemEffectsView([rec({ id: "a" }), rec({ id: "b" })], true);
    expect(view.isEmpty).toBe(false);
    expect(view.rows.map((r) => r.id)).toEqual(["a", "b"]);
    for (const r of view.rows) {
      expect(r).toMatchObject({ canToggle: true, canEdit: true, canDelete: true, canTransfer: true });
    }
  });

  it("a non-editable sheet shows the list with no controls and no create", () => {
    const view = buildItemEffectsView([rec()], false);
    expect(view.canCreate).toBe(false);
    expect(view.rows[0]).toMatchObject({ canToggle: false, canEdit: false, canDelete: false, canTransfer: false });
    expect(view.isEmpty).toBe(false);
  });

  it("passes every record field through unchanged", () => {
    const record = rec({
      id: "x", name: "Flame", img: "i.svg", disabled: true, transfer: false,
      suppressWhenUnequipped: false, suppressed: true, durationLabel: "3 rounds",
    });
    expect(buildItemEffectsView([record], true).rows[0]).toMatchObject(record);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/sheets/effects/item-view.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/sheets/effects/item-view.ts`:

```ts
// Pure view model for the Effects section of the gear item sheets (#146). No Foundry imports — the Foundry-coupled
// mapping from real ActiveEffect documents lives in src/sheets/item-effects-actions.ts.

export interface ItemEffectRecord {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  /** core `transfer`: whether the effect applies to the item's owner */
  transfer: boolean;
  suppressWhenUnequipped: boolean;
  /** the effect's own `isSuppressed` (e.g. its gear item is unequipped) */
  suppressed: boolean;
  /** "" when the effect has no temporary duration */
  durationLabel: string;
}

export interface ItemEffectRowView extends ItemEffectRecord {
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canTransfer: boolean;
}

export interface ItemEffectsView {
  rows: ItemEffectRowView[];
  canCreate: boolean;
  isEmpty: boolean;
}

/** Annotate an item's own effects with the controls the viewer may use (all of them when editable, none otherwise). */
export function buildItemEffectsView(records: readonly ItemEffectRecord[], editable: boolean): ItemEffectsView {
  const rows = records.map((r) => ({
    ...r,
    canToggle: editable,
    canEdit: editable,
    canDelete: editable,
    canTransfer: editable,
  }));
  return { rows, canCreate: editable, isEmpty: rows.length === 0 };
}
```

- [ ] **Step 4: Run to verify pass, then typecheck/lint/commit**

Run: `npx vitest run tests/sheets/effects/item-view.test.ts && npm run typecheck && npm run lint`
Expected: PASS and clean.

```bash
git add src/sheets/effects/item-view.ts tests/sheets/effects/item-view.test.ts
git commit -m "feat(item-effects): pure item effects view builder (#146)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Item-effects glue, the Effects partial, and copy

**Files:**
- Create: `src/sheets/item-effects-actions.ts`
- Create: `templates/sheets/raw-effects.hbs`
- Modify: `src/sheets/handlebars.ts` (register the new partial in the path list, as `raw-field-row.hbs` and `raw-group.hbs` are; confirm it gets the id `adnd2e.raw-effects`)
- Modify: `lang/en.json` (add a `sheets.effects` object inside the existing top-level `sheets` object, beside `sheets.layout`)
- Test: `tests/templates/item-effects-partial.test.ts`

**Interfaces:**
- Consumes: Task 1 `buildItemEffectsView`, `ItemEffectRecord`, `ItemEffectsView`.
- Produces (exported from `src/sheets/item-effects-actions.ts`; `item` is typed structurally, callers pass `this.document`):
  - `itemEffectsContext(item, editable: boolean): ItemEffectsView`
  - `createItemEffect(item): Promise<void>`
  - `toggleItemEffect(item, effectId: string): Promise<void>`
  - `toggleItemEffectTransfer(item, effectId: string): Promise<void>`
  - `editItemEffect(item, effectId: string): void`
  - `deleteItemEffect(item, effectId: string): Promise<void>`
- The partial reads context key `itemEffects` (an `ItemEffectsView`) and emits exactly these `data-action`s: `createItemEffect`, `toggleItemEffect`, `toggleItemEffectTransfer`, `editItemEffect`, `deleteItemEffect`, each with `data-effect-id` (create has none).

This task's glue is outside the coverage gate; it is verified by typecheck, the template test below, and the headless proof / manual checklist in Task 4.

- [ ] **Step 1: Write the failing template test**

Create `tests/templates/item-effects-partial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PARTIAL = readFileSync(path.resolve(__dirname, "..", "..", "templates", "sheets", "raw-effects.hbs"), "utf8");

describe("raw-effects.hbs (#146)", () => {
  it("emits exactly the five item-effect actions", () => {
    const used = [...new Set([...PARTIAL.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!))].sort();
    expect(used).toEqual(
      ["createItemEffect", "deleteItemEffect", "editItemEffect", "toggleItemEffect", "toggleItemEffectTransfer"],
    );
  });
  it("renders from the itemEffects context key", () => {
    expect(PARTIAL).toContain("itemEffects");
  });
  it("does not put core's .disabled class on a container (core sets pointer-events:none, killing its buttons)", () => {
    expect(PARTIAL).not.toMatch(/[ }"]disabled[ {"]/);
    expect(PARTIAL).toContain("effect-disabled");
  });
});
```

Run: `npx vitest run tests/templates/item-effects-partial.test.ts` → FAIL (file not found).

- [ ] **Step 2: The glue module**

Create `src/sheets/item-effects-actions.ts`:

```ts
// Item Effects-section glue for the gear item sheets (#146). Foundry-coupled — verified in the dev world. Maps an item's
// own ActiveEffect documents to the pure view model and implements the five section actions. Every action acts only on
// the item's OWN effects collection, and the sheet handlers gate on isEditable before calling in. `disabled` and
// `transfer` live on the effect document (not in `system`), so they are updated directly, never through form data.
import { buildItemEffectsView, type ItemEffectRecord, type ItemEffectsView } from "./effects/item-view";

interface ItemEffectDoc {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  transfer: boolean;
  isSuppressed: boolean;
  isTemporary: boolean;
  duration: { label?: string };
  system: { suppressWhenUnequipped?: boolean };
  sheet: { render(options?: { force?: boolean }): unknown } | null;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

interface EffectItem {
  effects: Iterable<ItemEffectDoc> & { get(id: string): ItemEffectDoc | undefined };
  createEmbeddedDocuments(type: "ActiveEffect", data: Record<string, unknown>[]): Promise<ItemEffectDoc[]>;
}

function recordOf(effect: ItemEffectDoc): ItemEffectRecord {
  return {
    id: effect.id,
    name: effect.name,
    img: effect.img,
    disabled: effect.disabled,
    transfer: effect.transfer,
    suppressWhenUnequipped: !!effect.system.suppressWhenUnequipped,
    suppressed: effect.isSuppressed,
    // core reports the word "None" for an indefinite duration — only label genuinely timed effects
    durationLabel: effect.isTemporary ? (effect.duration.label ?? "") : "",
  };
}

/** The Effects section's view model: the item's own effects (not transferred ones from elsewhere). */
export function itemEffectsContext(item: unknown, editable: boolean): ItemEffectsView {
  return buildItemEffectsView([...(item as EffectItem).effects].map(recordOf), editable);
}

/** "New effect": a blank adnd2e effect that transfers to the owner and is suppressed while the gear is unequipped,
 *  opened in the existing raw-field editor. */
export async function createItemEffect(item: unknown): Promise<void> {
  const [created] = await (item as EffectItem).createEmbeddedDocuments("ActiveEffect", [
    {
      name: game.i18n!.localize("ADND2E.sheets.effects.newName"),
      img: "icons/svg/aura.svg",
      type: "adnd2e",
      transfer: true,
      system: { suppressWhenUnequipped: true },
    },
  ]);
  created?.sheet?.render({ force: true });
}

export async function toggleItemEffect(item: unknown, effectId: string): Promise<void> {
  const effect = (item as EffectItem).effects.get(effectId);
  if (effect) await effect.update({ disabled: !effect.disabled });
}

/** Whether the effect applies to the item's owner (core `transfer`; the raw editor cannot edit it). */
export async function toggleItemEffectTransfer(item: unknown, effectId: string): Promise<void> {
  const effect = (item as EffectItem).effects.get(effectId);
  if (effect) await effect.update({ transfer: !effect.transfer });
}

export function editItemEffect(item: unknown, effectId: string): void {
  (item as EffectItem).effects.get(effectId)?.sheet?.render({ force: true });
}

/** Delete after confirmation. */
export async function deleteItemEffect(item: unknown, effectId: string): Promise<void> {
  const effect = (item as EffectItem).effects.get(effectId);
  if (!effect) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n!.localize("ADND2E.sheets.effects.deleteTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheets.effects.deleteConfirm", {
      name: foundry.utils.escapeHTML(effect.name),
    })}</p>`,
  } as never);
  if (confirmed) await effect.delete();
}
```
(If `escapeHTML` needs the same `as never` cast the existing `src/sheets/effects-actions.ts` / `item-row-actions.ts` use, follow that file's exact pattern; read `src/sheets/effects-actions.ts` `deleteEffect` first and mirror its dialog and escaping code.)

- [ ] **Step 3: The partial**

Create `templates/sheets/raw-effects.hbs`:

```hbs
<section class="kit-panel raw-effects">
  <div class="kit-bar">
    <span>{{localize 'ADND2E.sheets.effects.title'}}</span>
    {{#if itemEffects.canCreate}}
      <button type="button" class="item-control" data-action="createItemEffect" title="{{localize 'ADND2E.sheets.effects.new'}}" aria-label="{{localize 'ADND2E.sheets.effects.new'}}"><i class="fa-solid fa-plus"></i></button>
    {{/if}}
  </div>
  <div class="kit-body">
    {{#if itemEffects.isEmpty}}<p class="hint">{{localize 'ADND2E.sheets.effects.empty'}}</p>{{/if}}
    <ul class="effects-list">
      {{#each itemEffects.rows as |row|}}
        <li class="effect-row{{#if row.disabled}} effect-disabled{{/if}}{{#if row.suppressed}} effect-suppressed{{/if}}">
          <img src="{{row.img}}" alt="" width="24" height="24">
          <span class="effect-name">{{row.name}}</span>
          {{#if row.durationLabel}}<span class="effect-duration">{{row.durationLabel}}</span>{{/if}}
          <span class="effect-flag">{{#if row.transfer}}{{localize 'ADND2E.sheets.effects.appliesToOwner'}}{{else}}{{localize 'ADND2E.sheets.effects.notTransferred'}}{{/if}}</span>
          {{#if row.suppressWhenUnequipped}}<span class="effect-flag">{{localize 'ADND2E.sheets.effects.whileEquipped'}}</span>{{/if}}
          {{#if row.suppressed}}<span class="effect-flag">{{localize 'ADND2E.sheets.effects.suppressed'}}</span>{{/if}}
          {{#if row.disabled}}<span class="effect-flag">{{localize 'ADND2E.sheets.effects.off'}}</span>{{/if}}
          <span class="item-controls">
            {{#if row.canTransfer}}<button type="button" class="item-control" data-action="toggleItemEffectTransfer" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheets.effects.transferToggle'}}" aria-label="{{localize 'ADND2E.sheets.effects.transferToggle'}}"><i class="fa-solid fa-person-arrow-up-from-line"></i></button>{{/if}}
            {{#if row.canToggle}}<button type="button" class="item-control" data-action="toggleItemEffect" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheets.effects.toggle'}}" aria-label="{{localize 'ADND2E.sheets.effects.toggle'}}"><i class="fa-solid fa-power-off"></i></button>{{/if}}
            {{#if row.canEdit}}<button type="button" class="item-control" data-action="editItemEffect" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheets.effects.edit'}}" aria-label="{{localize 'ADND2E.sheets.effects.edit'}}"><i class="fa-solid fa-pen-to-square"></i></button>{{/if}}
            {{#if row.canDelete}}<button type="button" class="item-control" data-action="deleteItemEffect" data-effect-id="{{row.id}}" title="{{localize 'ADND2E.sheets.effects.delete'}}" aria-label="{{localize 'ADND2E.sheets.effects.delete'}}"><i class="fa-solid fa-trash"></i></button>{{/if}}
          </span>
        </li>
      {{/each}}
    </ul>
  </div>
</section>
```
(If `fa-person-arrow-up-from-line` is not a Font Awesome free icon in Foundry v14's bundled FA, use `fa-share-from-square`; the icon is cosmetic.)

- [ ] **Step 4: Register the partial and add the copy**

In `src/sheets/handlebars.ts`, add `"sheets/raw-effects.hbs"` (the same form as the existing `sheets/raw-field-row.hbs` entry — read the list) so it registers as `adnd2e.raw-effects`.

In `lang/en.json`, inside the top-level `sheets` object, beside `layout`, add (match indentation; confirm the file still parses with `node -e "JSON.parse(require('fs').readFileSync('lang/en.json','utf8'))"`):

```json
      "effects": {
        "title": "Effects",
        "new": "New effect",
        "newName": "New Effect",
        "empty": "No effects on this item.",
        "appliesToOwner": "Applies to owner",
        "notTransferred": "Not transferred",
        "whileEquipped": "Only while equipped",
        "suppressed": "Suppressed",
        "off": "Disabled",
        "transferToggle": "Apply this effect to the item's owner, or not",
        "toggle": "Enable or disable this effect",
        "edit": "Edit this effect",
        "delete": "Delete this effect",
        "deleteTitle": "Delete Effect",
        "deleteConfirm": "Delete the effect {name}? This can't be undone."
      },
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/templates/item-effects-partial.test.ts tests/lang && npm run typecheck && npm run lint`
Expected: PASS and clean.

```bash
git add src/sheets/item-effects-actions.ts templates/sheets/raw-effects.hbs src/sheets/handlebars.ts lang/en.json tests/templates/item-effects-partial.test.ts
git commit -m "feat(item-effects): item effects glue, Effects partial and copy (#146)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the sheet: image header, the Effects section, actions, styles

**Files:**
- Modify: `src/sheets/item-sheet.ts` (register five actions + handlers)
- Modify: `src/sheets/raw-field-sheet.ts` (`_prepareContext`: `portrait` and `itemEffects`)
- Modify: `templates/sheets/raw-fields.hbs` (header portrait, skip the raw img row, include the effects partial)
- Modify: `styles/kit/_kit.scss` (portrait + Effects panel rules)
- Test: `tests/templates/item-header.test.ts` (new) and `tests/templates/item-sheet-actions.test.ts` (new)

**Interfaces:**
- Consumes: Task 2 glue functions, partial `adnd2e.raw-effects`, context key `itemEffects`, the i18n keys.
- Produces: context keys `portrait` (the image path string, or undefined when the document has no `img` row) and `itemEffects` (an `ItemEffectsView`, only for item types weapon/armor/equipment).

Read `src/sheets/item-sheet.ts`, `src/sheets/raw-field-sheet.ts` (`_prepareContext`, `groupFieldRows`) and `templates/sheets/raw-fields.hbs` in full first (line numbers drift).

- [ ] **Step 1: Write the failing tests**

Create `tests/templates/item-header.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TEMPLATE = readFileSync(path.resolve(__dirname, "..", "..", "templates", "sheets", "raw-fields.hbs"), "utf8");

describe("item sheet header image (#148)", () => {
  it("renders the image through the core editImage action", () => {
    expect(TEMPLATE).toContain('data-action="editImage"');
    expect(TEMPLATE).toContain('data-edit="img"');
    expect(TEMPLATE).toContain("raw-portrait");
  });
  it("no longer renders the raw image path as a form input", () => {
    expect(TEMPLATE).toContain('(eq this.path "img")');
  });
  it("includes the Effects partial for gear sheets", () => {
    expect(TEMPLATE).toContain("adnd2e.raw-effects");
    expect(TEMPLATE).toContain("itemEffects");
  });
});
```

Create `tests/templates/item-sheet-actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const PARTIAL = readFileSync(path.join(ROOT, "templates", "sheets", "raw-effects.hbs"), "utf8");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "item-sheet.ts"), "utf8");
const RAW = readFileSync(path.join(ROOT, "src", "sheets", "raw-field-sheet.ts"), "utf8");

describe("item sheet Effects wiring (#146)", () => {
  const used = [...new Set([...PARTIAL.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!))];
  it("the item sheet registers every action the Effects partial uses", () => {
    for (const action of used) expect(SHEET, action).toMatch(new RegExp(`^\\s+${action}: Adnd2eItemSheet\\.#on`, "m"));
  });
  it("only weapon, armor and equipment get the Effects section", () => {
    expect(RAW).toMatch(/itemEffects/);
    expect(RAW).toMatch(/\["weapon", "armor", "equipment"\]/);
  });
});
```

Run: `npx vitest run tests/templates/item-header.test.ts tests/templates/item-sheet-actions.test.ts` → FAIL.

- [ ] **Step 2: Context in `_prepareContext`**

In `src/sheets/raw-field-sheet.ts`: import `itemEffectsContext` from `./item-effects-actions`. After the existing `context.subtitle = …` assignment and before `return context;`, add:

```ts
      // #148: the document's image (the header shows it as a clickable portrait instead of a path input)
      const imgRow = rows.find((r) => r.path === "img");
      context.portrait = imgRow ? String(imgRow.value ?? "") : undefined;
      // #146: gear items get an Effects section; every other document/type renders without one
      context.itemEffects =
        itemType && ["weapon", "armor", "equipment"].includes(itemType)
          ? itemEffectsContext(this.document, Boolean((context as { editable?: unknown }).editable))
          : undefined;
```
Check that `context.editable` is what the template already reads as `@root.editable` (the mixin/DocumentSheetV2 supplies it); use exactly that value, or `(this as unknown as { isEditable: boolean }).isEditable` if `context.editable` is not set at this point.

- [ ] **Step 3: The item sheet actions**

In `src/sheets/item-sheet.ts`: import the five functions from `./item-effects-actions`. Extend `DEFAULT_OPTIONS`:

```ts
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "item", "raw-field-sheet"],
    actions: {
      createItemEffect: Adnd2eItemSheet.#onCreateItemEffect,
      toggleItemEffect: Adnd2eItemSheet.#onToggleItemEffect,
      toggleItemEffectTransfer: Adnd2eItemSheet.#onToggleItemEffectTransfer,
      editItemEffect: Adnd2eItemSheet.#onEditItemEffect,
      deleteItemEffect: Adnd2eItemSheet.#onDeleteItemEffect,
    },
  };
```
and add the handlers inside the class (the Base is typed as a bare constructor, so cast `this`):

```ts
  static async #onCreateItemEffect(this: Adnd2eItemSheet): Promise<void> {
    const sheet = this as unknown as { document: unknown; isEditable: boolean };
    if (sheet.isEditable) await createItemEffect(sheet.document);
  }

  static async #onToggleItemEffect(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const sheet = this as unknown as { document: unknown; isEditable: boolean };
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) await toggleItemEffect(sheet.document, id);
  }

  static async #onToggleItemEffectTransfer(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const sheet = this as unknown as { document: unknown; isEditable: boolean };
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) await toggleItemEffectTransfer(sheet.document, id);
  }

  static #onEditItemEffect(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): void {
    const sheet = this as unknown as { document: unknown; isEditable: boolean };
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) editItemEffect(sheet.document, id);
  }

  static async #onDeleteItemEffect(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const sheet = this as unknown as { document: unknown; isEditable: boolean };
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) await deleteItemEffect(sheet.document, id);
  }
```
(If TypeScript rejects the `Adnd2eItemSheet.#on…` references inside the static initializer because of declaration order, follow how `src/sheets/creature/sheet.ts` declares its static `actions` with private static handlers and mirror it exactly.)

- [ ] **Step 4: The template**

In `templates/sheets/raw-fields.hbs`: replace the header's name-and-generic loop body so that it (a) renders the portrait in the title row, (b) skips the raw `img` row:

```hbs
        {{#each header}}
          {{#if (eq this.path "name")}}
            <div class="raw-title-row">
              {{#if @root.portrait}}
                <img class="raw-portrait" src="{{@root.portrait}}" alt=""
                  {{#if @root.editable}}data-action="editImage" data-edit="img"{{/if}}>
              {{/if}}
              <input type="text" class="raw-name" name="name" value="{{this.value}}" placeholder="{{this.label}}"
                {{#unless @root.editable}}readonly{{/unless}}>
            </div>
            {{#if @root.subtitle}}<div class="raw-subtitle">{{@root.subtitle}}</div>{{/if}}
          {{else if (eq this.path "img")}}
            {{!-- #148: the image is shown as the portrait above and chosen with the file picker, not typed as a path --}}
          {{else}}
            (the existing generic form-group block, unchanged)
          {{/if}}
        {{/each}}
```
Keep everything else in the header as is. Then, just before the closing `</div>` of `.raw-field-list` (after `<div class="raw-groups">…</div>`), add:

```hbs
    {{#if itemEffects}}{{> adnd2e.raw-effects}}{{/if}}
```
(`raw-effects.hbs` reads `itemEffects` from the context it is given; Handlebars passes the current context to a partial invoked without an argument.)

- [ ] **Step 5: Styles**

In `styles/kit/_kit.scss`, inside the item-sheet block (`.adnd2e.raw-field-sheet.item { … }`, near `.raw-title-row`), add using only existing tokens (read `styles/theme/_tokens.scss` for names):

```scss
  .raw-portrait {
    width: 48px; height: 48px; object-fit: cover; flex: none;
    border: 1px solid var(--kit-row-rule); border-radius: 4px;
  }
  .raw-portrait[data-action="editImage"] { cursor: pointer; }
  .raw-effects .effects-list { list-style: none; margin: 0; padding: 0; }
  .raw-effects .effect-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 2px 6px;
    border-bottom: 1px solid var(--kit-row-rule);
    &.effect-disabled, &.effect-suppressed { opacity: .55; }
    .item-controls { margin-left: auto; }
  }
  .raw-effects .effect-duration, .raw-effects .effect-flag { font-size: 11px; color: var(--kit-muted); }
```

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npx vite build`
Expected: all green; the build compiles the SCSS.

```bash
git add src/sheets/item-sheet.ts src/sheets/raw-field-sheet.ts templates/sheets/raw-fields.hbs styles/kit/_kit.scss tests/templates/item-header.test.ts tests/templates/item-sheet-actions.test.ts
git commit -m "feat(item-effects): image header on item sheets and an Effects section on gear sheets (#146, #148)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gates, headless proof, and the manual checklist

**Files:**
- Scratch (git-ignored, do NOT commit): `.superpowers/proof/item-effects.proof.ts`
- Modify: `README.md` only if it says item sheets have no image or effects UI (`grep -n -i "item sheet\|active effect" README.md`); otherwise skip.

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage && npx vite build`
Expected: green; 100% statement coverage.

- [ ] **Step 2: Headless proof (best effort)**

Recipe: memory note `foundry-headless-proof-harness` (load real Foundry `common/server.mjs`, set `globalThis.foundry` before importing repo `src/**`, stub `game.i18n` with `localize`/`format`/`has` backed by `lang/en.json`, `ui`, `logger`; a fake item whose `createEmbeddedDocuments` validates data against the REAL `Adnd2eActiveEffectModel`). Reuse the pattern from the earlier `effects.proof.ts` / `item-layouts.proof.ts` if present in `.superpowers/proof/`. Prove, with the real glue in `src/sheets/item-effects-actions.ts` and the real model:
1. `createItemEffect` creates `{ type: "adnd2e", transfer: true, system.suppressWhenUnequipped: true }`, the data validates, and the new effect's sheet is rendered.
2. `toggleItemEffect` flips `disabled`; `toggleItemEffectTransfer` flips `transfer`; both call `update` with exactly one key.
3. `deleteItemEffect` deletes only when the stubbed `DialogV2.confirm` returns true; the effect name in the dialog content is HTML-escaped (use a name like `<img src=x onerror=alert(1)>` and assert the escaped form).
4. `itemEffectsContext` maps `isTemporary` false to `durationLabel ""` and true to the label, and passes `suppressed`/`transfer`.
5. Render `templates/sheets/raw-fields.hbs` (with `raw-field-row`, `raw-group`, `raw-effects` partials, and `localize`/`eq`/`checked`/`adnd2eLabel` helpers) for a weapon item with two effects: the Effects panel appears with the five actions; for a spell item it does not; for an editable vs read-only sheet the buttons appear/disappear; the header contains `data-action="editImage"` only when editable, and no `name="img"` input.
6. Cross-link: an effect created on an owned weapon shows up in the existing actor `effectsContext` "From items" group (`src/sheets/effects-actions.ts`), with `suppressed` true once the weapon is unequipped (use a fake actor whose `allApplicableEffects()` yields it).
Report what was proven and what was not (real clicks, the file picker, the non-GM seat, styling, saving the sheet not resetting the image).

- [ ] **Step 3: README (only if needed) and commit**

If the grep finds an outdated statement, update it and commit `docs: item sheet image and effects (#146, #148)`; otherwise no commit.

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch. A world with a PC that has a Fighter class item and an equipped weapon and a piece of armor. A world weapon in the Items sidebar. A second item you do not own (or set Limited/Observer permission). A non-GM player seat owning the PC. Reset any setting you change.
1. Image: open a weapon, a spell, a class and an Active Effect sheet. Each header shows the image beside the name (default icons count); clicking it opens the file picker; pick a new image and the sheet shows it. Close and reopen: it persisted. Then edit another field and press Save: the image must not revert.
2. On the non-owned (read-only) item, the image shows but clicking does nothing.
3. Effects section: weapon, armor and equipment sheets have an "Effects" panel at the bottom; ammo, spell, class and kit sheets do not.
4. On the weapon: + New effect adds "New Effect" with the flags "Applies to owner" and "Only while equipped" and opens the raw editor; set a change there (e.g. key `system.attributes.thac0.melee`... or any harmless key) and save.
5. Toggle: the row dims and shows "Disabled"; toggle again clears it. Transfer toggle: the row's flag flips between "Applies to owner" and "Not transferred".
6. Edit reopens the raw editor. Delete asks for confirmation; Cancel keeps it, Confirm removes it.
7. Owned, equipped weapon with a transferred effect: the PC's Effects tab lists it under "From items" with "From: <weapon>". Unequip the weapon: the item's row shows "Suppressed" and the PC tab row shows "Suppressed". Set "Not transferred" and confirm the effect leaves the PC's list.
8. Non-GM seat: repeat 1 and 4-6 on the owned weapon (works); the non-owned item's Effects panel lists effects with no buttons.
9. A world weapon in the sidebar: create an effect, then drag the weapon onto a PC: the effect comes with it.
```

---

## Self-Review

- **Spec coverage:** §1 image header on all item types with `editImage`, inert when read-only, raw path row removed → Task 3 (template, context `portrait`, styles) and its header test; §2 view builder → Task 1; glue (create/toggle/transfer/edit/delete, escape, `duration.label` only when temporary, defaults) → Task 2; partial + copy + registration → Task 2; section only for weapon/armor/equipment, five actions on the item sheet class → Task 3; unowned items work the same → covered by the glue acting on `item.effects` (checklist step 9). §3 out of scope respected. Testing: unit (Task 1), template/binding/lang guards incl. the `.disabled` guard (Tasks 2-3), headless proof (Task 4), gates, manual checklist with non-GM seat (Task 4). Risks: shared header for other documents (Task 3 `portrait` undefined when no `img` row); picker saving (checklist step 1); direct `update` for `disabled`/`transfer` (Task 2, Global Constraints).
- **Placeholder scan:** none. Where a step says "mirror the existing pattern" (dialog escaping cast, static-action declaration, FA icon fallback) it points to the exact adjacent file to read.
- **Type consistency:** `ItemEffectRecord`/`ItemEffectRowView`/`ItemEffectsView`/`buildItemEffectsView` (Task 1) match their use in Task 2's glue; the five action names, `data-effect-id`, the `itemEffects` and `portrait` context keys and the `ADND2E.sheets.effects.*` keys match across Tasks 2-3 and the tests.
