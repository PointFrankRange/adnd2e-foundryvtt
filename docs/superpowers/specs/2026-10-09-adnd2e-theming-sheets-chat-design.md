# Theming: Active Effect sheet, raw actor sheet and chat cards (#150, part 1) — design

Date: 2026-10-09 · Issue: #150 (theming audit) · Branch: `feat/theming-sheets-chat`

## Background

The kit theme (parchment in Foundry's light theme, dark leather in its dark theme) is defined in `styles/theme/_tokens.scss` and applied in `styles/kit/_kit.scss`, scoped to `.adnd2e.pc-sheet` (the PC, Character NPC and Monster NPC sheets) and `.adnd2e.raw-field-sheet.item` (item sheets). The audit in #150 found the following unthemed:

1. The Active Effect sheet (`src/sheets/active-effect-sheet.ts`, classes `adnd2e sheet active-effect raw-field-sheet`) and the raw actor fallback sheet (`src/sheets/actor-sheet.ts`, classes `adnd2e sheet actor raw-field-sheet`). Both mount the same `templates/sheets/raw-fields.hbs` as the item sheet, but lack the `.item` class the theme requires.
2. All fifteen chat card templates in `templates/chat/` (`adnd2e chat-card <name>`), which have no style rules at all. They share one class vocabulary: `header` (portrait + title), `formula`, `result` with `hit`/`miss`/`success`/`fail`/`failure`/`crit`/`fumble`, `check`, `hint`, `target`, `rung`, `damage`/`damage-roll`, `cost`, `maneuver`, `modifiers`, `lost`, `headline`/`detail`, `powers`, `tangents`, `turn-results`, `spell-details`, `status-*`, `dire`, `loss`, `rejected` and buttons.

Dialogs (about nine custom DialogV2 dialogs) are a later part of #150 and out of scope here.

## Decisions (made with the user)

- **Scope of this item:** the two unthemed sheets plus the chat cards. Dialogs, the Combat Tracker additions and the settings sections are a follow-up.
- **Chat card look:** direction A from the mockups: a parchment card (leather in dark) with a maroon header bar holding the portrait and title, matching the sheets.

## Design

### 1. Widen the sheet theme scope

In `styles/theme/_tokens.scss` and `styles/kit/_kit.scss`, change every selector that targets `.adnd2e.raw-field-sheet.item` to target `.adnd2e.raw-field-sheet` (including the `body.theme-dark …` and `….theme-dark` variants). The item, Active Effect and raw actor sheets then share the parchment/dark-leather look from one template.

- Rules that are genuinely item-specific (the stat strip and layout panels, spell card, the Effects panel) stay under a more specific `.adnd2e.raw-field-sheet.item` block; only the base look (window background, inputs, panels, kit bars, buttons, `.raw-groups`) widens.
- `input.raw-name { flex: 1; min-width: 0 }` moves to the unscoped block, so the name field stretches on the effect sheet (the cosmetic gap logged in PR #149).
- Check the effect editor's fields (the `Changes` JSON textarea, condition id, "Is condition" checkbox, "Suppress when unequipped" checkbox, school tag select) lay out sensibly, and that no actor-only rule leaks (the actor kit rules stay under `.pc-sheet`).

### 2. Chat card stylesheet: `styles/chat/_chat.scss`

New partial, `@use`d from `styles/system.scss`. Chat messages render in the sidebar, outside any sheet window where the kit tokens live, so the stylesheet defines its own tokens on `.adnd2e.chat-card`, derived from the sheet palette, with a `body.theme-dark .adnd2e.chat-card` override (and `.theme-dark` on the card itself, matching how the sheet tokens are written):

- Tokens (light / dark): card background (parchment / leather), card border and header (maroon `#7a0a0a` / `#8c1c1c`, header ink white / `#f6ecd6`), ink, muted ink, row rule, and four result colours: hit/success green, miss/fail red, crit gold, fumble red-brown, each with a light and a dark value chosen for readable contrast on its background.
- **Card:** 1px maroon border, small radius, no outer margin beyond Foundry's own message spacing.
- **Header:** the existing `<header>` becomes a maroon bar with the portrait (26px, rounded) and the `h3` title (13px, no margin, ellipsis on overflow).
- **Body paragraphs:** padding under the header; `.formula` muted; `.target` and `.check` normal weight; `.hint` italic and muted; `.result` bold, coloured per class (`.hit`, `.success` green; `.miss`, `.fail`, `.failure` red; `.crit` gold; `.fumble` red-brown); `.modifiers` a small muted list.
- **Buttons** inside a card: maroon outline, transparent fill, hover fill.
- **Card-specific extras** (minimal): `casting-notice.lost` red header, `.headline`/`.detail`, `wild-talent .dire`, `psionic-contest`/`wrestling-contest` `.rung`/`.damage`/`.tangents`, `turn-undead-roll .turn-results`, `status-*` badges. Anything beyond this vocabulary is not styled.
- **Not touched:** no template markup changes, and Foundry's own roll cards (the dice result line and tooltip rendered below a system card) keep their default look.

### 3. Out of scope

Dialog theming, the Combat Tracker additions, the settings sections UI, any template or TypeScript behaviour change, and any new setting.

## Testing

- A test (`tests/styles/chat-classes.test.ts`) that reads every `templates/chat/*.hbs`, extracts the static class tokens used, and asserts each token that carries a visual meaning (the result/status vocabulary: `hit`, `miss`, `success`, `fail`, `failure`, `crit`, `fumble`, `hint`, `formula`, `lost`, `dire`) appears as a selector in `styles/chat/_chat.scss`, so a new result class can't be added without a rule. A second assertion confirms the sheet theme rules no longer mention `.raw-field-sheet.item` in `_tokens.scss` (it targets `.raw-field-sheet`).
- A guard that no new rule in `_chat.scss` or the widened blocks uses core's bare `.disabled` class.
- `npx vite build` compiles the SCSS; `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100% statements) stay green.
- Colours, contrast and layout cannot be checked headlessly. The manual dev-world checklist, in both Foundry themes, covers: an attack hit, miss and critical, a fumble, a save success and failure, a spell cast and casting notice (including a lost spell), a wrestling contest, a psionic contest and power use, a wild talent, turn undead results, a thief skill and nonweapon check, the effect editor, the raw actor sheet from the sheet picker, and the item and PC sheets (to confirm no regression).

## Risks

- Widening the sheet scope also widens every `.adnd2e.raw-field-sheet` rule; any rule that quietly assumed items only (such as `.raw-strip`, the item-only layout classes) must stay scoped to `.item`. The census test and a read-through of the widened selectors cover this.
- Chat tokens are defined on the card, so the colour set must be checked in both themes; the dark override must key off `body.theme-dark` (Foundry v14's dark mode switch), as the sheet tokens already do.
