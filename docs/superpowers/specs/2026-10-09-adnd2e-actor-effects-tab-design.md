# Actor Effects tab — design

Date: 2026-10-09 · Issue: #128 · Branch: `feat/effects-tab`

## Background

The PC, Character NPC and Monster NPC sheets expose no UI for Active Effects. Testing #106 needed a console macro to add one. The system registers one ActiveEffect subtype, `adnd2e` (fields: `changes`, `conditionId`, `isCondition`, `suppressWhenUnequipped`, `schoolTag`), which already has a raw-field editor sheet (`src/sheets/active-effect-sheet.ts`).

An actor's applicable effects are a mix of three kinds: conditions (status effects such as stunned or held, including `held`/`grappling`, which carry the wrestling grapple record as a flag), effects transferred from owned items (for example equipped gear), and custom effects a user adds by hand.

## Decisions (made with the user)

- **Scope:** show everything, in three groups (below). System-managed effects are protected by being removal-only or read-only, not hidden.
- **Permissions:** anyone with edit permission on the sheet may create, toggle, edit and delete custom effects, matching how owned items behave. A locked or non-editable sheet shows the list with no controls.
- **Creation:** "New effect" creates a blank `adnd2e` effect and opens the existing raw-field editor. No friendly editor, change-key catalogue, or create dialog in this item.

## Design

### 1. Pure view builder — `src/sheets/effects/view.ts`

No Foundry imports; added to the coverage gate in `vitest.config.ts`.

Input: a list of effect-like records (`id`, `name`, `img`, `disabled`, `isSuppressed`, `system.isCondition`, `system.conditionId`, `durationLabel`, and the parent item's `id`/`name` when the effect lives on an item) plus an `editable` boolean.

Output: three groups, each an array of row views, plus per-group control flags:

- **Conditions** (`system.isCondition`): name, icon, optional duration label. Control: remove only.
- **From items** (effect's parent is an Item): name, icon, source item name and id, a suppressed marker. Read-only; the only control is "open source item".
- **Custom** (everything else): name, icon, optional duration label, disabled state. Controls: enable toggle, edit, delete.

Group order is Conditions, Custom, From items. Empty groups are omitted. When `editable` is false, no row carries controls (the list is display-only; "open source item" remains available as a read-only action).

### 2. Shared actions — `src/sheets/effects-actions.ts`

Foundry-coupled glue (dev-world verified), modelled on `src/sheets/kit-actions.ts` and `src/sheets/item-row-actions.ts`. Each action requires the sheet to be editable and acts only on the sheet's own actor.

- `effectCreate`: `actor.createEmbeddedDocuments("ActiveEffect", [{ name, img, type: "adnd2e" }])`, then renders the new effect's sheet.
- `effectToggle`: flips `disabled` on a custom effect.
- `effectEdit`: renders the effect's sheet.
- `effectDelete`: confirms with a `DialogV2`, then deletes a custom effect.
- `effectRemoveCondition`: calls `actor.toggleStatusEffect(conditionId, { active: false })`, the same call the Token HUD and the Stand Up button use, so wrestling's held/grappling cleanup and its HUD-deletion hook behave identically. An effect with no `conditionId` falls back to `effect.delete()`.
- `effectOpenSource`: opens the source item's sheet.

Handlers refuse effects that are not in the actor's own collection, and refuse toggle/delete on any effect that is a condition or item-sourced.

### 3. Panel, tab, and sheets

- One shared partial, `templates/actor/shared/partials/effects-panel.hbs`, rendering the three groups; buttons use the existing `item-control` styling and `data-action` names above.
- A new part/tab `effects` is added to each of the three sheets (PC `src/sheets/character/sheet.ts`, Character NPC `src/sheets/npc/sheet.ts`, Monster NPC `src/sheets/creature/sheet.ts`): PARTS entry, TABS entry (icon `fa-solid fa-wand-magic-sparkles`), the actions registered in `DEFAULT_OPTIONS.actions`, and the view builder's output in the sheet context. Tab label `ADND2E.sheet.tabs.effects`.
- The part's template wraps the partial in the same tab-section markup the other parts use. The sheet's existing `editable` flag drives control visibility. Group and control copy goes in `lang/en.json`.

### 4. Out of scope

A friendly effect editor or change-key catalogue; toggling or editing item-sourced effects from the actor (they are edited on the item); any new setting, schema or migration; any change to wrestling, conditions, or the `adnd2e` effect model.

## Testing

- Unit tests (`tests/sheets/effects/view.test.ts`): grouping and ordering, source item names, suppressed marker, empty groups omitted, duration label passthrough, and the non-editable sheet producing no controls.
- Template-binding and lang-coverage tests (existing `tests/templates/*-sheet-bindings.test.ts` and `tests/lang`) extended so each sheet declares the `effects` part/tab and every new i18n key exists.
- Headless proof (existing harness), if it supports it: creating an `adnd2e` effect through `createEmbeddedDocuments`, toggling `disabled`, and deleting it on a real actor; a transferred item effect appears with its parent item.
- Gates before the PR: `npm run lint`, `npm run typecheck` (including `tsconfig.core.json`), `npm run test:coverage` (100% statements).
- Manual dev-world checklist with stated prerequisites, on all three sheets, from a GM seat and a non-GM seat: create, toggle, edit, delete a custom effect; remove a condition (including `held` from a wrestling grapple); an equipped item's transferred effect appears as read-only with its source and a suppressed marker when unequipped; a locked sheet shows no controls.

## Risks

- Item-transferred effects reach the actor through `allApplicableEffects()`, not `actor.effects`; the sheet context must use the former or the "From items" group will be empty.
- The three sheets duplicate their wiring (PARTS, TABS, actions). All three must be updated together; the past ammo and SP6 whole-branch reviews both flagged this pattern.
- Removing a `held`/`grappling` condition must go through `toggleStatusEffect` so wrestling's grapple cleanup runs.
