# AD&D 2E for Foundry VTT — Sheet redesign (structure & styling)

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-26
**Author:** Joshua Frank + Claude
**References:** styling — `references/ADnD-2E-sheet.png` (the Roll20 AD&D 2E sheet; gitignored, user-supplied); structure — the Tidy 5E Sheets module (https://github.com/kgar/foundry-vtt-tidy-5e-sheets). Brainstorm mockups: `.superpowers/brainstorm/1256-1790452235/content/` (pc-layout.html option **B**, tables-and-dark.html).

---

## 1. Goal

Restructure and restyle the three actor sheets — **PC** (`character`), **Character NPC** (`npc`) and **Monster NPC** (`creature`) — to the look of the reference image and the navigation model of Tidy 5E, without changing any game logic or data.

## 2. Decisions (locked in brainstorming)

| Decision | Value |
|---|---|
| Slicing | **Three sequential plans:** **R1** shared theme kit + the PC sheet; **R2** Character NPC sheet; **R3** Monster NPC sheet. Each ships and is testable alone. |
| Styling | **Faithful to the reference:** parchment background, maroon label bars with bold white text over white fields, maroon pill tabs with a tan active tab. **No AD&D logo** (trademark art) — a serif text title instead. |
| Dark mode | **Parchment in light mode; "dark leather" in Foundry dark mode:** warm dark-brown textured background, brighter maroon bars, dark fields with maroon/tan borders. |
| Page layout | **Persistent left column** (mockup B): portrait, the six abilities (stacked) and the saving throws visible on every tab; name, class line, vitals boxes, tabs and tab content on the right. |
| PC tabs | **Six:** **Main** (Favorites, attacks + maneuver picker + backstab, AC breakdown, classes/XP/HP rolls/dual-class, the SP9 casting panel), **Inventory**, **Proficiencies** (weapon, non-weapon, thief skills), **Spells**, **Features** (class/racial features, traits + CP ledger, languages, resources), **Journal** (details, biography, GM notes). |
| Edit lock | Every sheet **opens locked** (play mode). The unlock is held on the open window for that viewer only — never saved. Only users who can edit the actor see the lock. Unlocked shows inputs, ✎/🗑, + Add and inline quantity. |
| Item tables | Tidy-style: collapsible sections (collapse state remembered per viewer in the browser), column headers, click-a-name to expand a summary, ★ favorite, lock-aware controls, and a **filter box** (client-side, no writes). |
| Favorites | Weapons & gear, spells, thief skills. Stored per actor in `flags.adnd2e.favorites` (`{ kind, id }[]`); only owners can star; the Favorites panel gives one-click attack / cast / skill roll. (Non-weapon proficiencies are **not** favoritable.) |

## 3. Global Constraints

- **Foundry v14.364** source is authoritative — never `fvtt-types`.
- **No game-logic or data-model change.** The only new persisted data is the owner-written `flags.adnd2e.favorites`. Everything else is templates, styles, and additive pure context fields.
- **Preserve every existing feature and binding:** each current `data-action` handler and `name=` form binding on the three sheets must still be reachable (possibly only when unlocked). Each plan's whole-branch review checks a **"nothing lost" list** generated from the pre-change templates.
- **Two-layer contract:** all new logic (favorites rows/toggle payloads, item-table grouping, lock-derived row flags, tab descriptors) lives in the pure context builders or pure helpers at 100% line/statement/function coverage; sheets/templates/SCSS are Foundry glue (typecheck/lint gated, dev-world verified).
- **Templates compute nothing;** root references inside `{{#each}}` use `@root.`.
- **Permissions:** handlers keep their `isEditable` checks; server-side permissions remain the real guard; a non-editor sees read-only text and no lock/favorite/✎/🗑.
- **Assets:** no copyrighted art; the parchment texture is CSS gradients/our own generated noise.
- No `npm run format`/`prettier`/`npm install`/`npm update`; `npm run build` needs Foundry closed (re-confirm); vitest via `tail`/redirect, never `| grep`; CRLF working copies.
- Each plan: mandatory whole-branch review; GATED dev-world check in **light and dark mode**, GM and **non-GM player seat**.

## 4. Architecture

### 4.1 Theme kit (R1, shared)

- **`styles/theme/`**: CSS custom properties on `.adnd2e.sheet` — `--adnd2e-parchment`, `--adnd2e-maroon`, `--adnd2e-tan`, `--adnd2e-ink`, `--adnd2e-field-bg`, `--adnd2e-field-border`, plus the texture; a `.theme-dark .adnd2e.sheet` (Foundry v14 dark-theme body/app class — the plan confirms the exact selector from source) override with the dark-leather values. Existing sheet SCSS migrates to the tokens.
- **Partials** (registered like `adnd2e.item-controls`): `adnd2e.panel` (maroon bar + body), `adnd2e.stat-box`, `adnd2e.pill-tabs` (renders ApplicationV2 `tabs` context with `data-action="tab"` semantics already used by Foundry), `adnd2e.item-table` (section header with collapse toggle, count, + Add when unlocked; rows with icon, name/expand, configured columns, ★, lock-aware controls), `adnd2e.filter-box`, `adnd2e.lock-toggle`, `adnd2e.favorites-panel`.
- **Edit-lock mixin** (`src/sheets/edit-lock.ts`): adds `#unlocked` (default false) to a sheet, a `toggleLock` action (re-render), `context.unlocked`, `context.canUnlock = isEditable`; root CSS class `locked`/`unlocked`.
- **Favorites** (pure `src/sheets/favorites.ts`): `favoriteRows(favorites, items, thiefSkills)` → display rows with `{ kind, id, name, img, action, dataset }` (dropping stale ids); `toggleFavoriteUpdate(current, entry)` → the `flags.adnd2e.favorites` payload. Glue action `toggleFavorite` (owner only).
- **Collapse & filter** (glue): section collapse state in `localStorage` keyed by sheet+section (try/catch); the filter box hides non-matching rows client-side.

### 4.2 PC sheet (R1)

Templates rebuilt on the kit (`templates/actor/character/**`), `PARTS` = header/left-column + tab parts; `TABS` = main, inventory, proficiencies, spells, features, journal (IDs change; the plan maps every old part's content to its new home). Context builder gains: `favorites`, `inventoryTables` (sections: weapons, armor, equipment, containers with contents), `lock`-aware row flags, and `tabs` descriptors for the six tabs. All existing context fields and actions carry over.

### 4.3 Character NPC sheet (R2)

Same kit and left column; tabs **Main** (favorites, attacks, classes, casting panel), **Inventory**, **Spells**, **Journal** (details) — the plan confirms against the current three-tab content and the Character NPC's reduced feature set.

### 4.4 Monster NPC sheet (R3)

Same kit; left column = portrait, HD/HP, AC, THAC0, movement, saves; tabs **Stat Block** (authored stats, stat-block attacks, weapon-attack rows, special attacks/defenses), **Gear** (item tables), **Spells**, **Notes** (description, treasure, XP, number appearing…). Stat-block authoring inputs appear only when unlocked.

## 5. Error handling

Stale favorite ids (deleted items) are silently dropped from the panel and cleaned on the next toggle. `localStorage` failures fall back to all-expanded. A locked sheet never submits (no enabled inputs).

## 6. Testing

Pure: favorites rows/toggle payloads (every kind, stale ids, non-owner), item-table grouping (containers, sorting, empty sections), lock-derived flags, tab descriptors. A drift test asserts every `data-action` in each sheet's templates is registered in that sheet's `DEFAULT_OPTIONS.actions` (plus core `tab`/`editImage`). Dev world per plan: every feature on the new layout, light + dark, GM + player seat.

## 7. Out of scope

Per-user custom themes/colors (Tidy's theme settings), a separate Effects tab, container drag-reordering, sheet-level search beyond the per-table filter, and any rules change.
