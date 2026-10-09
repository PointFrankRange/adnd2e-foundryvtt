# Item sheet image header and gear Effects section (#148, #146) — design

Date: 2026-10-09 · Issues: #148 (item sheets show an image path, not an image), #146 (item Active Effects UI) · Branch: `feat/item-effects`

## Background

Item sheets are the generic raw-field sheets (`src/sheets/raw-field-sheet.ts`, `templates/sheets/raw-fields.hbs`) with designed layouts for weapon, armor, equipment, ammo and spell (PR #147). Two gaps:

- **#148:** the header has an `Image` row rendered as a plain text input holding the file path. No picture is shown and there is no file picker, unlike the actor sheets, whose portrait is `<img data-action="editImage" data-edit="img">` (a built-in action on Foundry's document sheets).
- **#146:** there is no UI for effects on items. The only way to give a weapon or armor an effect that applies to its owner is a console macro. The actor Effects tab (PR #144) lists transferred item effects as read-only "From items" rows, but they cannot be created from the item. Core ActiveEffect has a `transfer` flag (default `true`) that the generic raw editor cannot edit, because it only walks the `system.*` schema; the `adnd2e` effect model already has `suppressWhenUnequipped`, honored for weapon, armor and equipment items only (`Adnd2eActiveEffectModel#isSuppressed`).

## Decisions (made with the user)

- **Scope:** an image header on all fourteen item types, and an Effects section on gear only: weapon, armor and equipment. Ammo, spells, kits and traits get no Effects section (ammo is not covered by the suppression hook; kits and traits have their own effect reducer; spell effects need their own design for durations and targets).
- **Editor:** effects stay edited in the existing raw `adnd2e` effect editor. No friendlier editor and no change-key catalogue in this item.
- **Defaults:** a new effect created from a gear item defaults to `suppressWhenUnequipped: true`, so a magic item only works while equipped.
- **Permissions:** whoever can edit the item sheet can manage its effects (`isEditable`), the same rule as the actor tab.

## Design

### 1. Image header (all item types)

- In `templates/sheets/raw-fields.hbs`, the header renders the document's image beside the name: `<img class="raw-portrait" src="{{imgSrc}}" alt="" data-action="editImage" data-edit="img">`, inside `.raw-title-row`. `editImage` is a core `DocumentSheetV2` action, so no handler is added; the existing `img` row value supplies the source. On a non-editable sheet the image has no `data-action` (inert).
- The raw `Image` path row is removed from the header's generic row loop (only the `name` row and the image remain). The path is still saved by the picker. Any document the mixin renders that has an `img` row (items and the ActiveEffect sheet) gets the portrait.
- Styled in `styles/kit/_kit.scss` inside the item-sheet block: a small square portrait (about 48px) with a pointer cursor and the kit border, next to the name; no new tokens.

### 2. Effects section on gear sheets

Pure builder, `src/sheets/effects/item-view.ts` (new, in the coverage gate, no Foundry imports):

```ts
interface ItemEffectRecord {
  id: string; name: string; img: string;
  disabled: boolean; transfer: boolean;
  suppressWhenUnequipped: boolean;
  suppressed: boolean;            // the effect's own isSuppressed (unequipped gear)
  durationLabel: string;          // "" when indefinite
}
interface ItemEffectRowView { ...the record fields; canToggle; canEdit; canDelete; canTransfer }
interface ItemEffectsView { rows: ItemEffectRowView[]; canCreate: boolean; isEmpty: boolean }
function buildItemEffectsView(records, editable): ItemEffectsView;
```
Every row gets `canToggle/canEdit/canDelete/canTransfer` equal to `editable`; `canCreate` equals `editable`.

Glue, `src/sheets/item-effects-actions.ts` (Foundry-coupled, dev-world verified), acting only on the item's own `effects` collection, each gated by the sheet's `isEditable`:
- `createItemEffect(item)`: `item.createEmbeddedDocuments("ActiveEffect", [{ name, img: "icons/svg/aura.svg", type: "adnd2e", transfer: true, system: { suppressWhenUnequipped: true } }])`, then opens the new effect's sheet.
- `toggleItemEffect(item, id)` flips `disabled`; `toggleItemEffectTransfer(item, id)` flips `transfer`; `editItemEffect(item, id)` opens its sheet; `deleteItemEffect(item, id)` confirms with `DialogV2` (name escaped with `foundry.utils.escapeHTML`) then deletes.
- `itemEffectsContext(item, editable)`: maps `item.effects` to `ItemEffectRecord` (`duration.label` only when `isTemporary`, as in the actor glue) and calls the builder.

Rendering: a new partial `templates/sheets/raw-effects.hbs` renders a final "Effects" kit panel (the list, flags, and the buttons), included at the bottom of `raw-fields.hbs` when the context has `itemEffects`. `_prepareContext` in `raw-field-sheet.ts` sets `context.itemEffects` only when the document is an Item of type `weapon`, `armor` or `equipment`; every other document and type gets no `itemEffects` and renders as before.

The item sheet class (`src/sheets/item-sheet.ts`) registers the five actions (`createItemEffect`, `toggleItemEffect`, `toggleItemEffectTransfer`, `editItemEffect`, `deleteItemEffect`) in its `DEFAULT_OPTIONS.actions`. New en.json copy under `ADND2E.sheets.effects.*` (panel title, empty text, button titles, flags, delete dialog).

Unowned items (world items in the sidebar) work the same: their effects are stored on the item and start applying when the item is owned and, for gear, equipped.

### 3. Out of scope

A friendlier effect editor or change-key catalogue; effects on ammo, spells, kits, traits and the other types; any schema, setting or migration change; changes to how the actor tab lists transferred effects.

## Testing

- Unit tests (`tests/sheets/effects/item-view.test.ts`): rows carry the record fields; control flags all on when editable and all off when not; `canCreate`/`isEmpty`; flags pass through.
- Template/binding tests: the item sheet registers all five actions the effects partial uses; the partial emits exactly those `data-action`s; the header template carries `data-action="editImage" data-edit="img"` and no longer renders the raw `img` path input row; a guard that the effects partial and header do not put core's `.disabled` class on a container (the PR #144 pointer-events bug).
- Lang coverage for the new keys.
- Headless proof (existing harness, real `adnd2e` effect model + real glue): `createItemEffect` creates a valid `adnd2e` effect with `transfer: true` and `suppressWhenUnequipped: true`; toggle, transfer-toggle and delete (with the dialog confirm stubbed true/false) behave; and an effect created on an owned weapon appears in the actor's `effectsContext` "From items" group, with `suppressed` true once the weapon is unequipped.
- Gates before the PR: `npm run lint`, `npm run typecheck` (including `tsconfig.core.json`), `npm run test:coverage` (100% statements).
- Manual dev-world checklist with stated prerequisites, from GM and non-GM seats: image picker on a weapon, a spell, a class and an ActiveEffect sheet; create, toggle, transfer-toggle, edit, delete on weapon, armor and equipment; no Effects panel on ammo, spell, class; an owned, equipped item's effect shows on the actor's Effects tab and turns "Suppressed" when unequipped; a read-only (non-owned) item shows the list with no controls.

## Risks

- The generic header template is shared by items, the ActiveEffect sheet and any actor falling back to the raw sheet; the image change must keep every document that has no `img` row, or a non-picker `img`, rendering without errors.
- Removing the `Image` input from the header must not drop `img` from the submitted form: the picker writes through `data-edit="img"` (DocumentSheetV2 updates the document directly), so nothing depends on the removed input; confirm in the dev world that saving the sheet does not reset the image.
- `transfer` and `disabled` live on the effect document, not in `system`, so toggles must call `effect.update({...})` directly (as the actor glue does), never go through the sheet's form data.
