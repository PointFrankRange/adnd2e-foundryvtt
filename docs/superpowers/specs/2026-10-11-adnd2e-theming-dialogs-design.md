# Theming: system dialogs (#150, part 2) — design

Date: 2026-10-11 · Issue: #150 (theming audit, remaining part) · Branch: `feat/theming-dialogs`

## Background

Part 1 of #150 (PR #151) themed the Active Effect sheet, the raw actor sheet and all chat cards. What remains is the system's own dialogs: 14 call sites in 11 files that call `foundry.applications.api.DialogV2.prompt` or `.confirm` with hand-built HTML content. None sets a window class, so all use Foundry's default dialog look.

- **Confirms (6):** relay approval (`src/relay/relay-handler.ts`), a combat confirm (`src/sheets/character/combat-rolls.ts`), a wild-talent confirm (`src/sheets/character/psionic-wild.ts`), and the delete confirmations for owned items, actor effects and item effects (`src/sheets/item-row-actions.ts`, `src/sheets/effects-actions.ts`, `src/sheets/item-effects-actions.ts`).
- **Prompts (8):** initiative modifier (`src/combat/initiative-modifier-dialog.ts`), manual-AC prompts (`src/sheets/character/combat-rolls.ts`, `src/sheets/creature/combat-rolls.ts`), free magick (2, `src/sheets/character/free-magick-dialog.ts`), recover (`src/sheets/character/recover-dialog.ts`), wild talent (`src/sheets/character/psionic-wild.ts`) and award XP (`src/sheets/character/sheet.ts`).

Foundry's `DialogV2` is an `ApplicationV2` (default `classes: ["dialog"]`, a `<dialog>` element) whose body is `form.dialog-form` containing `div.dialog-content` and `footer.form-footer` with the buttons (`data-action="ok"|"yes"|"no"|…`). `DialogV2.confirm` defaults its focused button to "No". Core already sets the colour scheme through `body.theme-dark`.

The Combat Tracker addition is only an entry in Foundry's own combatant context menu (it opens the initiative-modifier dialog above), and the collapsible settings sections live inside Foundry's own Configure Settings window, so neither needs theming.

## Decisions (made with the user)

- **Approach:** one shared helper that adds the system's window classes, every call site switches to it, and a test keeps it that way. Not per-call hand edits, and not a global restyle of every Foundry dialog (other modules' and core dialogs are never touched).
- **Look:** the sheet look: parchment or leather body, a maroon title bar, themed inputs, a filled maroon primary button and outlined secondary buttons.
- **Out of scope:** the settings sections UI and the combat tracker context-menu entry.

## Design

### 1. Pure options builder — `src/dialogs/themed-dialog.ts`

No Foundry imports, in the coverage gate (`vitest.config.ts` coverage include).

```ts
export const DIALOG_CLASSES = ["adnd2e", "adnd2e-dialog"] as const;
export function withDialogTheme<T extends { classes?: readonly string[] }>(options: T): T & { classes: string[] };
```
Returns the options with `DIALOG_CLASSES` added to any `classes` the caller supplied: existing classes are kept in order, none is duplicated, and every other property is passed through untouched. Does not mutate its argument.

### 2. Foundry wrappers — same file's sibling `src/dialogs/themed-dialog-foundry.ts`

Foundry-coupled (outside the coverage gate; the pure builder lives in a separate file so the gated module has no Foundry imports):
- `themedPrompt(config)` calls `foundry.applications.api.DialogV2.prompt(withDialogTheme(config))`.
- `themedConfirm(config)` calls `foundry.applications.api.DialogV2.confirm(withDialogTheme(config))`.
- Signatures and return types match `DialogV2.prompt` / `.confirm`, so each call site changes by its function name and an import only (the existing `as never` casts stay where they are).

All 14 call sites switch to the wrappers.

### 3. Guard test — `tests/dialogs/dialog-theme-guard.test.ts`

Reads every `src/**/*.ts` file and fails if any file other than `src/dialogs/themed-dialog-foundry.ts` contains `DialogV2.prompt`, `DialogV2.confirm` or `DialogV2.wait` (comments and the type-declaration directory excluded), so a new dialog cannot ship unthemed. A second assertion confirms the wrapper file itself uses `withDialogTheme`.

### 4. Styles — `styles/dialog/_dialog.scss`

Loaded from `styles/system.scss`.
- Tokens: `.adnd2e.adnd2e-dialog` is added to the existing light and dark token blocks in `styles/theme/_tokens.scss` (`body.theme-dark .adnd2e.adnd2e-dialog` and `.adnd2e.adnd2e-dialog.theme-dark`), keyed to the app element like the sheet tokens, so the dialog gets the kit palette.
- Window: `.adnd2e.adnd2e-dialog` background `var(--kit-bg)` with `--kit-bg-image`, ink `var(--kit-ink)`; the title bar `.window-header` maroon (`--kit-maroon`) with `--kit-maroon-ink`, no extra border; content padding unchanged.
- Form: inputs, selects and textareas use `--kit-field-bg/ink/border`, matching the kit rules; the `<p>` hint text inherits the card ink.
- Buttons in `.form-footer`: `button[data-action="ok"]`, `button[data-action="yes"]` are filled (`--kit-maroon` background, `--kit-maroon-ink` text); every other footer button is a maroon outline with hover fill; a `:disabled` state; `min-height: 0` and `font-family: inherit` to reset core's sizing, as the chat buttons do.
- No `!important` and no bare `.disabled`; system.css is unlayered, so it beats core's layered rules.

### 5. Out of scope

Settings sections UI, the combat tracker context menu entry, any change to dialog content or behaviour, and any dialog created by Foundry or another module.

## Testing

- Unit tests (`tests/dialogs/themed-dialog.test.ts`): `withDialogTheme` adds both classes to an options object with no `classes`; keeps existing classes first and adds ours without duplicating; leaves other properties unchanged and does not mutate the input; is idempotent.
- The guard test above; a style census (`tests/styles/dialog-theme.test.ts`) asserting `_dialog.scss` is loaded from `system.scss`, `_tokens.scss` includes `.adnd2e.adnd2e-dialog` in both its light and dark blocks, and `_dialog.scss` has no `!important` or bare `.disabled`.
- Gates before the PR: `npm run lint`, `npm run typecheck` (including `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Manual dev-world checklist in both Foundry themes, one of each dialog: manual AC (attack with nothing targeted, PC and Monster NPC), award XP, initiative modifier (combat tracker → combatant context menu), free magick (memorize and cast), recover, wild talent test, the combat confirm, relay approval (a player applying damage to a non-owned token with the approval setting on), and the three delete confirmations. Confirm Foundry's own dialogs (for example deleting a token) are NOT restyled.

## Risks

- DialogV2 content passes through `foundry.utils.cleanHTML` and is unaffected, but `classes` merging must not drop core's own `dialog` class: the wrapper adds to `classes` and ApplicationV2 merges it with `DEFAULT_OPTIONS.classes` (confirm with a headless read of the merge, or in the dev world).
- The primary-button rule keys on `data-action` values `ok` and `yes` (core's defaults for prompt and confirm). A dialog that passes custom button actions would show outlined buttons; that is acceptable and all current call sites use the defaults.
