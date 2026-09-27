# Sheet Redesign R1 — Theme Kit + PC Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the PC sheet on a shared parchment/maroon theme kit with a persistent left column (portrait, abilities, saves), six pill tabs, Tidy-style item tables, an edit lock and favorites — without changing any game logic, data, or the Character NPC / Monster NPC sheets.

**Architecture:** Pure helpers in a new `src/sheets/kit/` (favorites, lock state, inventory sections) feed additive fields in the existing pure `buildCharacterSheetContext`. New templates live in a NEW folder `templates/actor/pc/` with a new SCSS layer (`styles/theme/`, `styles/kit/`, `styles/actor/pc.scss`); the PC sheet class switches to them. The OLD `templates/actor/character/**` templates and `styles/actor/character.scss` are left untouched because the Character NPC sheet (and its `header.hbs`/`spells.hbs`/partials reuse) still depends on them until Plan R2.

**Tech Stack:** TypeScript, Vitest, Handlebars/ApplicationV2 (Foundry v14.364), SCSS.

**Spec:** `docs/superpowers/specs/2026-09-26-adnd2e-sheet-redesign-design.md` (mockups: `.superpowers/brainstorm/1256-1790452235/content/pc-layout.html` option **B**, `tables-and-dark.html`).

## Global Constraints

- **Foundry v14.364** source is authoritative — never `fvtt-types`. Verified during planning: v14 applies the dark theme as a `theme-dark` class on `<body>` (and on `.themed` app elements) — `client/game.mjs:1850-1880`; ApplicationV2 tabs come from `static TABS` → `_prepareTabs` (`client/applications/api/application.mjs:704-720`) with `data-action="tab" data-group data-tab` (`templates/generic/tab-navigation.hbs`); `DocumentSheetV2` provides the `editImage` action (`client/applications/api/document-sheet.mjs:61`).
- **No game-logic or data-model change.** The only new persisted data is the owner-written `flags.adnd2e.favorites` (`{ kind, id }[]`).
- **The Character NPC and Monster NPC sheets must render and behave exactly as before.** Do not edit anything under `templates/actor/character/`, `templates/actor/npc/`, `templates/actor/creature/`, `styles/actor/character.scss`, `styles/actor/creature.scss`, `src/sheets/npc/`, `src/sheets/creature/`. Additions to `buildCharacterSheetContext` are additive (the NPC sheet shares it).
- **Nothing lost:** every current PC binding must exist in the new PC templates (list in Task 4 — enforced by an automated test).
- **Two-layer contract:** `src/sheets/kit/**` and `src/sheets/character/{context,context-types}.ts` are pure (no Foundry imports, 100% line/statement/function coverage, branches ≥ 90). `src/sheets/character/sheet.ts`, `src/sheets/kit-dom.ts`, templates, SCSS, lang are glue.
- **Templates compute nothing;** root references inside `{{#each}}` / partials use `@root.`.
- **Locked vs unlocked (locked decision 3 below)** — structural inputs render only when unlocked; handlers keep their `isEditable` checks.
- **No copyrighted art** — no AD&D logo; the parchment texture is CSS gradients + an SVG `feTurbulence` noise we generate.
- No `npm run format`/`prettier`/`npm install`/`npm update`; don't touch package files. Implementers never run `npm run build`; the controller builds at Task 6 after re-confirming Foundry is closed. Vitest via `tail`/redirect, never `| grep`. Working copies are CRLF (scripted edits split on `/\r?\n/`); `lang/en.json` stays valid JSON.
- Mandatory whole-branch review (Task 5); GATED dev-world check in light AND dark mode, GM AND non-GM player seat (Task 6).

## Locked design decisions

1. **New files, old files untouched:** PC templates → `templates/actor/pc/`; the PC sheet's class list becomes `["adnd2e", "sheet", "actor", "pc-sheet"]` (drops `character`, so the old `:is(.character, .npc)` SCSS no longer styles it; the new SCSS is scoped to `.adnd2e.pc-sheet`).
2. **Layout B:** window content is a CSS grid — the `left` part spans the full height of column 1 (portrait, six abilities, saves); column 2 stacks `header`, `tabs`, and the active tab part.
3. **Edit lock:** `#unlocked` (default `false`) on the sheet instance, toggled by `toggleLock` (only when `isEditable`), never persisted. **Always available (play inputs, locked or not):** HP value/temp, currency, equipped checkbox, all roll/cast/memorize/forget/learn/rest/award-XP/HP-roll/allocate buttons. **Only when unlocked:** name, alignment, ability scores / exceptional / sub-scores / seed, detail fields, resources, CP pool (still also `canEditPool`), item quantity/location/identified inputs, ✎/🗑 (and the race's), dual-class toggle, `removeTrait`, prose editors enabled.
4. **Six tabs:** `main`, `inventory`, `proficiencies`, `spells`, `features`, `journal`. Main = Favorites, Attacks (equipped weapons with backstab + maneuver picker inside `.weapon-row`), Armor, AC breakdown, Classes/XP/HP/dual-class, Casting panel.
5. **Favorites:** kinds `item`, `spell`, `thiefSkill`; star shown to owners only; a weapon favorite rolls an attack when equipped, other items open their sheet (`editItem`); a spell favorite casts when `canCast`; a thief skill rolls when `usable`.
6. **Item tables:** collapse state per viewer in `localStorage` (`adnd2e.collapsed.<sheetKey>.<sectionId>`, try/catch), filter box client-side (no `name`, no writes), click a name to expand the item's summary.

---

### Task 1: Pure kit helpers (favorites, lock, inventory sections)

**Files:**
- Create: `src/sheets/kit/favorites.ts`, `src/sheets/kit/lock.ts`, `src/sheets/kit/inventory-sections.ts`
- Create tests: `tests/sheets/kit/favorites.test.ts`, `tests/sheets/kit/lock.test.ts`, `tests/sheets/kit/inventory-sections.test.ts`
- Modify: `vitest.config.ts` (coverage `include`), `tsconfig.core.json` (`include`), `eslint.config.js` (both pure-zone lists) — add `"src/sheets/kit"` / `"src/sheets/kit/**"` / `"src/sheets/kit/**/*.ts"` next to the existing `src/sheets/character/context.ts` entries (tests already covered by `tests/sheets/**`).

**Interfaces — Produces:** `FavoriteKind`, `FavoriteEntry`, `normalizeFavorites(raw: unknown): FavoriteEntry[]`, `isFavorite(list, kind, id): boolean`, `toggleFavoriteList(list, entry): FavoriteEntry[]`, `FavoriteSources`, `FavoriteRow`, `buildFavoriteRows(list, sources): FavoriteRow[]`; `LockState`, `lockState(editable: boolean, unlocked: boolean): LockState`; `InventoryRow`, `InventorySection`, `buildInventorySections(inv, isFav: (id: string) => boolean): InventorySection[]`.

- [ ] **Step 1: Failing tests.**

`tests/sheets/kit/favorites.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  buildFavoriteRows,
  isFavorite,
  normalizeFavorites,
  toggleFavoriteList,
  type FavoriteSources,
} from "../../../src/sheets/kit/favorites";

describe("normalizeFavorites", () => {
  it("returns [] for anything that isn't an array", () => {
    expect(normalizeFavorites(undefined)).toEqual([]);
    expect(normalizeFavorites(null)).toEqual([]);
    expect(normalizeFavorites({ kind: "item", id: "a" })).toEqual([]);
  });
  it("keeps valid entries, drops malformed ones and de-duplicates", () => {
    expect(
      normalizeFavorites([
        { kind: "item", id: "a" },
        { kind: "spell", id: "b" },
        { kind: "thiefSkill", id: "climb-walls" },
        { kind: "item", id: "a" },
        { kind: "bogus", id: "x" },
        { kind: "item", id: "" },
        { kind: "item" },
        null,
        "item:a",
      ]),
    ).toEqual([
      { kind: "item", id: "a" },
      { kind: "spell", id: "b" },
      { kind: "thiefSkill", id: "climb-walls" },
    ]);
  });
});

describe("isFavorite / toggleFavoriteList", () => {
  const list = [{ kind: "item" as const, id: "a" }];
  it("matches on kind AND id", () => {
    expect(isFavorite(list, "item", "a")).toBe(true);
    expect(isFavorite(list, "spell", "a")).toBe(false);
    expect(isFavorite(list, "item", "b")).toBe(false);
  });
  it("adds an entry that isn't there and removes one that is", () => {
    expect(toggleFavoriteList(list, { kind: "spell", id: "s" })).toEqual([
      { kind: "item", id: "a" },
      { kind: "spell", id: "s" },
    ]);
    expect(toggleFavoriteList(list, { kind: "item", id: "a" })).toEqual([]);
  });
});

describe("buildFavoriteRows", () => {
  const sources: FavoriteSources = {
    items: [
      { id: "w1", name: "Long Sword", img: "sword.png", type: "weapon", equipped: true },
      { id: "w2", name: "Dagger", img: "dagger.png", type: "weapon", equipped: false },
      { id: "e1", name: "Rope", img: "rope.png", type: "equipment", equipped: false },
    ],
    spells: [
      { id: "s1", name: "Sleep", img: "sleep.png", canCast: true },
      { id: "s2", name: "Light", img: "light.png", canCast: false },
    ],
    thiefSkills: [
      { skill: "climb-walls", label: "ADND2E.chat.thiefSkill.skills.climbWalls", effective: 85, usable: true },
      { skill: "read-languages", label: "ADND2E.chat.thiefSkill.skills.readLanguages", effective: 0, usable: false },
    ],
  };

  it("builds a row per favorite in list order, with the right one-click action", () => {
    const rows = buildFavoriteRows(
      [
        { kind: "spell", id: "s1" },
        { kind: "item", id: "w1" },
        { kind: "item", id: "w2" },
        { kind: "item", id: "e1" },
        { kind: "spell", id: "s2" },
        { kind: "thiefSkill", id: "climb-walls" },
        { kind: "thiefSkill", id: "read-languages" },
      ],
      sources,
    );
    expect(rows).toEqual([
      { kind: "spell", id: "s1", name: "Sleep", img: "sleep.png", nameIsKey: false, detail: "", action: "castSpell", itemId: "s1", skill: null },
      { kind: "item", id: "w1", name: "Long Sword", img: "sword.png", nameIsKey: false, detail: "", action: "rollAttack", itemId: "w1", skill: null },
      { kind: "item", id: "w2", name: "Dagger", img: "dagger.png", nameIsKey: false, detail: "", action: "editItem", itemId: "w2", skill: null },
      { kind: "item", id: "e1", name: "Rope", img: "rope.png", nameIsKey: false, detail: "", action: "editItem", itemId: "e1", skill: null },
      { kind: "spell", id: "s2", name: "Light", img: "light.png", nameIsKey: false, detail: "", action: null, itemId: "s2", skill: null },
      { kind: "thiefSkill", id: "climb-walls", name: "ADND2E.chat.thiefSkill.skills.climbWalls", img: "", nameIsKey: true, detail: "85%", action: "rollThiefSkill", itemId: null, skill: "climb-walls" },
      { kind: "thiefSkill", id: "read-languages", name: "ADND2E.chat.thiefSkill.skills.readLanguages", img: "", nameIsKey: true, detail: "0%", action: null, itemId: null, skill: "read-languages" },
    ]);
  });

  it("silently drops favorites whose item, spell or skill no longer exists", () => {
    expect(
      buildFavoriteRows(
        [
          { kind: "item", id: "gone" },
          { kind: "spell", id: "gone" },
          { kind: "thiefSkill", id: "gone" },
        ],
        sources,
      ),
    ).toEqual([]);
  });
});
```
`tests/sheets/kit/lock.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { lockState } from "../../../src/sheets/kit/lock";

describe("lockState", () => {
  it("only an editor can unlock, and only an editor is ever unlocked", () => {
    expect(lockState(true, false)).toEqual({ canUnlock: true, unlocked: false });
    expect(lockState(true, true)).toEqual({ canUnlock: true, unlocked: true });
    expect(lockState(false, true)).toEqual({ canUnlock: false, unlocked: false });
    expect(lockState(false, false)).toEqual({ canUnlock: false, unlocked: false });
  });
});
```
`tests/sheets/kit/inventory-sections.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { buildInventorySections } from "../../../src/sheets/kit/inventory-sections";
import type { PhysicalItemView } from "../../../src/sheets/character/context-types";

function item(over: Partial<PhysicalItemView>): PhysicalItemView {
  return {
    id: "x", name: "x", img: "", type: "equipment", quantity: 1, weight: 1, totalWeight: 1,
    location: "", equipped: false, identified: true, magicBonus: 0,
    isContainer: false, capacity: null, contentsWeightMultiplier: 1,
    sourceType: "", activation: "", uses: null, description: "",
    ...over,
  };
}

describe("buildInventorySections", () => {
  const sword = item({ id: "w1", name: "Sword", type: "weapon" });
  const mail = item({ id: "a1", name: "Mail", type: "armor" });
  const rope = item({ id: "e1", name: "Rope" });
  const pack = item({ id: "c1", name: "Backpack", isContainer: true, capacity: 30 });
  const torch = item({ id: "e2", name: "Torch", location: "c1" });

  it("groups loose items by type, then one section per container (container row first), marking favorites", () => {
    const sections = buildInventorySections(
      {
        loose: [sword, mail, rope],
        containers: [{ item: pack, contents: [torch], usedWeight: 1, capacity: 30, overCapacity: false }],
      },
      (id) => id === "w1" || id === "e2",
    );
    expect(sections).toEqual([
      { id: "weapons", labelKey: "ADND2E.sheet.kit.sections.weapons", label: null, containerId: null, capacity: null, rows: [{ item: sword, favorite: true }] },
      { id: "armor", labelKey: "ADND2E.sheet.kit.sections.armor", label: null, containerId: null, capacity: null, rows: [{ item: mail, favorite: false }] },
      { id: "equipment", labelKey: "ADND2E.sheet.kit.sections.equipment", label: null, containerId: null, capacity: null, rows: [{ item: rope, favorite: false }] },
      {
        id: "container-c1", labelKey: null, label: "Backpack", containerId: "c1",
        capacity: { used: 1, max: 30, over: false },
        rows: [{ item: pack, favorite: false }, { item: torch, favorite: true }],
      },
    ]);
  });

  it("keeps the three type sections even when empty", () => {
    const sections = buildInventorySections({ loose: [], containers: [] }, () => false);
    expect(sections.map((s) => [s.id, s.rows.length])).toEqual([["weapons", 0], ["armor", 0], ["equipment", 0]]);
  });
});
```
(If `PhysicalItemView` in `context-types.ts` has a different required-field set than the `item()` factory above, adjust ONLY the factory defaults to match the real type and note it.) Run `npx vitest run tests/sheets/kit > "$TEMP/kit.log" 2>&1; tail -10 "$TEMP/kit.log"` → FAIL.

- [ ] **Step 2: Implement.**

`src/sheets/kit/favorites.ts`:
```typescript
// Sheet favorites (sheet redesign R1). A per-actor list of pinned items, spells
// and thief skills, stored as `flags.adnd2e.favorites` = `{ kind, id }[]`, and the
// display rows the Favorites panel renders with their one-click action. Pure.

export type FavoriteKind = "item" | "spell" | "thiefSkill";
export interface FavoriteEntry {
  kind: FavoriteKind;
  id: string;
}

const KINDS: readonly FavoriteKind[] = ["item", "spell", "thiefSkill"];

/** The stored flag, cleaned: valid `{kind, id}` entries only, first occurrence wins. */
export function normalizeFavorites(raw: unknown): FavoriteEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: FavoriteEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { kind, id } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || !KINDS.includes(kind as FavoriteKind)) continue;
    if (!isFavorite(out, kind as FavoriteKind, id)) out.push({ kind: kind as FavoriteKind, id });
  }
  return out;
}

export function isFavorite(list: readonly FavoriteEntry[], kind: FavoriteKind, id: string): boolean {
  return list.some((e) => e.kind === kind && e.id === id);
}

/** Adds the entry if absent, removes it if present. */
export function toggleFavoriteList(list: readonly FavoriteEntry[], entry: FavoriteEntry): FavoriteEntry[] {
  return isFavorite(list, entry.kind, entry.id)
    ? list.filter((e) => !(e.kind === entry.kind && e.id === entry.id))
    : [...list, { kind: entry.kind, id: entry.id }];
}

export interface FavoriteSources {
  items: readonly { id: string; name: string; img: string; type: string; equipped: boolean }[];
  spells: readonly { id: string; name: string; img: string; canCast: boolean }[];
  thiefSkills: readonly { skill: string; label: string; effective: number; usable: boolean }[];
}

export interface FavoriteRow {
  kind: FavoriteKind;
  id: string;
  name: string;
  img: string;
  /** true when `name` is an i18n key (thief skills) */
  nameIsKey: boolean;
  detail: string;
  /** the sheet action this row's button triggers, or null when it can't be used now */
  action: "rollAttack" | "castSpell" | "rollThiefSkill" | "editItem" | null;
  /** dataset for the action button: `data-item-id` (items, spells) or `data-skill` (thief skills) */
  itemId: string | null;
  skill: string | null;
}

/** One row per favorite whose target still exists, in list order. */
export function buildFavoriteRows(list: readonly FavoriteEntry[], sources: FavoriteSources): FavoriteRow[] {
  const rows: FavoriteRow[] = [];
  for (const fav of list) {
    if (fav.kind === "item") {
      const it = sources.items.find((i) => i.id === fav.id);
      if (!it) continue;
      rows.push({
        kind: "item", id: it.id, name: it.name, img: it.img, nameIsKey: false, detail: "",
        action: it.type === "weapon" && it.equipped ? "rollAttack" : "editItem",
        itemId: it.id, skill: null,
      });
    } else if (fav.kind === "spell") {
      const sp = sources.spells.find((s) => s.id === fav.id);
      if (!sp) continue;
      rows.push({
        kind: "spell", id: sp.id, name: sp.name, img: sp.img, nameIsKey: false, detail: "",
        action: sp.canCast ? "castSpell" : null, itemId: sp.id, skill: null,
      });
    } else {
      const t = sources.thiefSkills.find((s) => s.skill === fav.id);
      if (!t) continue;
      rows.push({
        kind: "thiefSkill", id: t.skill, name: t.label, img: "", nameIsKey: true, detail: `${t.effective}%`,
        action: t.usable ? "rollThiefSkill" : null, itemId: null, skill: t.skill,
      });
    }
  }
  return rows;
}
```
`src/sheets/kit/lock.ts`:
```typescript
// The sheet edit lock (sheet redesign R1): a sheet opens locked; only a user who
// can edit the actor can unlock it, and only they are ever treated as unlocked. Pure.

export interface LockState {
  canUnlock: boolean;
  unlocked: boolean;
}

export function lockState(editable: boolean, unlocked: boolean): LockState {
  return { canUnlock: editable, unlocked: editable && unlocked };
}
```
`src/sheets/kit/inventory-sections.ts`:
```typescript
// Inventory item-table sections (sheet redesign R1): loose weapons, armor and
// equipment, then one section per container (the container itself first, then
// its contents), each row marked favorite or not. Pure.
import type { ContainerGroup, PhysicalItemView } from "../character/context-types";

export interface InventoryRow {
  item: PhysicalItemView;
  favorite: boolean;
}

export interface InventorySection {
  id: string;
  /** i18n key for the three type sections; null for a container (use `label`) */
  labelKey: string | null;
  label: string | null;
  containerId: string | null;
  capacity: { used: number; max: number | null; over: boolean } | null;
  rows: InventoryRow[];
}

export function buildInventorySections(
  inv: { containers: readonly ContainerGroup[]; loose: readonly PhysicalItemView[] },
  isFav: (id: string) => boolean,
): InventorySection[] {
  const row = (item: PhysicalItemView): InventoryRow => ({ item, favorite: isFav(item.id) });
  const typed = (id: "weapons" | "armor" | "equipment", type: PhysicalItemView["type"]): InventorySection => ({
    id,
    labelKey: `ADND2E.sheet.kit.sections.${id}`,
    label: null,
    containerId: null,
    capacity: null,
    rows: inv.loose.filter((i) => i.type === type).map(row),
  });
  return [
    typed("weapons", "weapon"),
    typed("armor", "armor"),
    typed("equipment", "equipment"),
    ...inv.containers.map((c) => ({
      id: `container-${c.item.id}`,
      labelKey: null,
      label: c.item.name,
      containerId: c.item.id,
      capacity: { used: c.usedWeight, max: c.capacity, over: c.overCapacity },
      rows: [row(c.item), ...c.contents.map(row)],
    })),
  ];
}
```
- [ ] **Step 3: Verify** — `npx vitest run tests/sheets/kit` passes; typecheck, lint, `npm run test:coverage` exit 0; the three kit files at 100%.
- [ ] **Step 4: Commit** — `feat(sheets): pure kit helpers — favorites, edit lock, inventory sections` (+ `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

---

### Task 2: PC context additions (lock, favorites, inventory sections, row favorite flags)

**Files:** Modify `src/sheets/character/context-types.ts`, `src/sheets/character/context.ts`, `src/sheets/character/sheet.ts` (only the `toSpellView` placeholder for the new required field), `tests/sheets/character/context.test.ts`.

**Interfaces — Consumes:** Task 1. **Produces:** `CharacterSheetInput.unlocked?: boolean`, `CharacterSheetInput.favorites?: unknown`; context `lock: LockState`, `favorites: { canFavorite: boolean; rows: FavoriteRow[] }`, `inventory.sections: InventorySection[]`; `combat.weapons[].favorite: boolean`; `SpellItemView.favorite: boolean`; `ThiefSkillRow.favorite: boolean`.

- [ ] **Step 1: Failing tests** — append to `tests/sheets/character/context.test.ts` (uses the file's `input()` factory; add imports for `PhysicalItemView`/`SpellItemView` if not present):
```typescript
describe("buildCharacterSheetContext — sheet redesign R1 fields", () => {
  it("is locked by default; only an editor can unlock", () => {
    expect(buildCharacterSheetContext(input()).lock).toEqual({ canUnlock: true, unlocked: false });
    expect(buildCharacterSheetContext(input({ unlocked: true })).lock).toEqual({ canUnlock: true, unlocked: true });
    const viewer = input({ unlocked: true, perms: { isGM: false, isOwner: false, editable: false } });
    expect(buildCharacterSheetContext(viewer).lock).toEqual({ canUnlock: false, unlocked: false });
  });

  it("only owners can favorite; favorites build rows and flag the matching rows", () => {
    const sword: PhysicalItemView = {
      id: "w1", name: "Long Sword", img: "s.png", type: "weapon", quantity: 1, weight: 4, totalWeight: 4,
      location: "", equipped: true, identified: true, magicBonus: 0, isContainer: false, capacity: null,
      contentsWeightMultiplier: 1, sourceType: "", activation: "", uses: null, description: "",
      weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", damageType: "slashing" },
    };
    const c = buildCharacterSheetContext(input({ physicalItems: [sword], favorites: [{ kind: "item", id: "w1" }] }));
    expect(c.favorites.canFavorite).toBe(true);
    expect(c.favorites.rows).toEqual([
      { kind: "item", id: "w1", name: "Long Sword", img: "s.png", nameIsKey: false, detail: "", action: "rollAttack", itemId: "w1", skill: null },
    ]);
    expect(c.combat.weapons.find((w) => w.id === "w1")!.favorite).toBe(true);
    expect(c.inventory.sections[0]).toMatchObject({ id: "weapons", rows: [{ favorite: true }] });

    const stranger = buildCharacterSheetContext(
      input({ physicalItems: [sword], favorites: [{ kind: "item", id: "w1" }], perms: { isGM: false, isOwner: false, editable: false } }),
    );
    expect(stranger.favorites.canFavorite).toBe(false);
  });

  it("with no favorites flag the panel is empty and nothing is flagged", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.favorites.rows).toEqual([]);
    expect(c.inventory.sections.map((s) => s.id)).toEqual(["weapons", "armor", "equipment"]);
  });
});
```
Also extend an existing spell-row test and an existing thief-skill test (or add small ones) to assert `favorite: false` by default and `favorite: true` when `favorites: [{ kind: "spell", id: <that spell id> }]` / `[{ kind: "thiefSkill", id: <skill> }]`. Adjust the literal `sword` object above to the real `PhysicalItemView`/`weapon` sub-shape if it differs (report it). Run → FAIL.

- [ ] **Step 2: Implement.**
  - `context-types.ts`: add to `CharacterSheetInput`: `/** sheet redesign R1: the viewer's unlock state (never persisted) */ unlocked?: boolean;` and `/** raw flags.adnd2e.favorites */ favorites?: unknown;`. Add `favorite: boolean;` to `SpellItemView` and `ThiefSkillRow`; add `favorite: boolean` to the `combat.weapons` element type; add to `CharacterSheetContext`: `lock: LockState;` and `favorites: { canFavorite: boolean; rows: FavoriteRow[] };` and to `inventory`: `sections: InventorySection[];` (import the types from `../kit/*`).
  - `sheet.ts`: in `toSpellView`, add `favorite: false,` next to the other placeholders (context recomputes it).
  - `context.ts`: at the top of `buildCharacterSheetContext`, compute `const favs = normalizeFavorites(input.favorites);` and `const fav = (kind: FavoriteKind, id: string) => isFavorite(favs, kind, id);` and pass what each builder needs:
    - `buildCombat`: each weapon row gets `favorite: fav("item", w.id)`.
    - `buildSpells`: each built spell row gets `favorite: fav("spell", row.id)` (set in `buildSpellRow` or right after; keep the SP9 `canCast` override while casting).
    - `buildSkills`: each thief row gets `favorite: fav("thiefSkill", t.skill)`.
    - `buildInventory`: add `sections: buildInventorySections({ containers, loose }, (id) => fav("item", id))` from the containers/loose it already computes.
    - add `lock: lockState(input.perms.editable, input.unlocked === true)`.
    - add `favorites: { canFavorite: input.perms.isOwner, rows: buildFavoriteRows(favs, { items: input.physicalItems.map((i) => ({ id: i.id, name: i.name, img: i.img, type: i.type, equipped: i.equipped })), spells: <the built spells.known rows flattened, mapped to { id, name, img, canCast }>, thiefSkills: <built thief rows or []> }) }` — build the favorites AFTER spells/skills so `canCast`/`usable` are the final values.
  Keep every existing field exactly as it is (the Character NPC sheet shares this builder).
- [ ] **Step 3: Verify** — `npx vitest run tests/sheets` passes; typecheck, lint, coverage exit 0; `context.ts` keeps 100% line/stmt/func.
- [ ] **Step 4: Commit** — `feat(sheets): PC context — lock state, favorites and inventory sections` (+ trailer).

---

### Task 3: Theme tokens, kit styles and PC layout styles

**Files:** Create `styles/theme/_tokens.scss`, `styles/kit/_kit.scss`, `styles/actor/pc.scss`; Modify `styles/system.scss`.

Styles only — no template or TS change; verified visually at Task 6.

- [ ] **Step 1:** `styles/theme/_tokens.scss`:
```scss
// Sheet redesign theme tokens. Light = parchment (the reference sheet's look);
// Foundry dark mode (body.theme-dark, or an app element with .theme-dark —
// client/game.mjs:1850-1880) = "dark leather". The noise texture is our own
// SVG feTurbulence, no external art.
$noise: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.1  0 0 0 .18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");

.adnd2e.pc-sheet {
  --kit-bg: #e6d3a3;
  --kit-bg-image: #{$noise}, radial-gradient(circle at 25% 15%, #f1e3bf 0, #d8bf88 70%, #c9ad74 100%);
  --kit-maroon: #7a0a0a;
  --kit-maroon-ink: #ffffff;
  --kit-tan: #a8895a;
  --kit-tan-ink: #ffffff;
  --kit-ink: #1a1208;
  --kit-muted: #5a3e14;
  --kit-field-bg: #ffffff;
  --kit-field-ink: #1a1208;
  --kit-field-border: #7a0a0a;
  --kit-row-rule: #d8c7a0;
  --kit-expand-bg: #f6efdc;
}

body.theme-dark .adnd2e.pc-sheet,
.adnd2e.pc-sheet.theme-dark {
  --kit-bg: #2a211b;
  --kit-bg-image: #{$noise}, radial-gradient(circle at 25% 15%, #3a2d24 0, #241b16 70%, #1b1411 100%);
  --kit-maroon: #8c1c1c;
  --kit-maroon-ink: #f6ecd6;
  --kit-tan: #7d6440;
  --kit-tan-ink: #f6ecd6;
  --kit-ink: #eee3cc;
  --kit-muted: #c7b08a;
  --kit-field-bg: #3b302a;
  --kit-field-ink: #f1e6cf;
  --kit-field-border: #9a6a3a;
  --kit-row-rule: #4a3b31;
  --kit-expand-bg: #33291f;
}
```
- [ ] **Step 2:** `styles/kit/_kit.scss` — the reusable building blocks, all scoped to `.adnd2e.pc-sheet`:
```scss
.adnd2e.pc-sheet {
  .window-content {
    background-color: var(--kit-bg);
    background-image: var(--kit-bg-image);
    color: var(--kit-ink);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
  }

  input[type="text"], input[type="number"], select, textarea {
    background: var(--kit-field-bg);
    color: var(--kit-field-ink);
    border: 1px solid var(--kit-field-border);
    border-radius: 2px;
  }

  button { cursor: pointer; }

  .kit-bar {
    background: var(--kit-maroon);
    color: var(--kit-maroon-ink);
    font-weight: 700;
    font-size: 12px;
    padding: 2px 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .kit-panel {
    margin-bottom: 8px;
    > .kit-body {
      background: var(--kit-field-bg);
      color: var(--kit-field-ink);
      border: 1px solid var(--kit-field-border);
      border-top: none;
      padding: 4px 6px;
    }
  }

  .kit-stat {
    text-align: center;
    min-width: 58px;
    .kit-big {
      display: block;
      background: var(--kit-field-bg);
      color: var(--kit-field-ink);
      border: 1px solid var(--kit-field-border);
      font-size: 18px;
      font-weight: 700;
      padding: 3px 0;
    }
  }

  .kit-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    border: none;
    margin: 4px 0 6px;
    a {
      background: var(--kit-maroon);
      color: var(--kit-maroon-ink);
      font-weight: 700;
      border-radius: 6px;
      padding: 3px 12px;
      text-shadow: none;
      &.active { background: var(--kit-tan); color: var(--kit-tan-ink); }
    }
  }

  .kit-lock {
    background: var(--kit-maroon);
    color: var(--kit-maroon-ink);
    border: none;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
  }

  .kit-filter { margin: 0 0 6px; width: 200px; }

  .kit-table {
    margin-bottom: 8px;
    > .kit-bar { cursor: pointer; }
    .kit-caret::before { content: "▾"; }
    &.collapsed .kit-caret::before { content: "▸"; }
    &.collapsed .kit-rows { display: none; }
    .kit-rows { background: var(--kit-field-bg); color: var(--kit-field-ink); border: 1px solid var(--kit-field-border); border-top: none; }
    .kit-head, .kit-row > .kit-cells { display: grid; grid-template-columns: var(--kit-cols, 1fr auto); gap: 6px; align-items: center; padding: 2px 6px; }
    .kit-head { background: var(--kit-tan); color: var(--kit-tan-ink); font-size: 11px; font-weight: 700; }
    .kit-row { border-bottom: 1px solid var(--kit-row-rule); }
    .kit-row[hidden] { display: none; }
    .kit-name { cursor: pointer; display: flex; align-items: center; gap: 4px; img { width: 20px; height: 20px; border: none; } }
    .kit-summary { display: none; background: var(--kit-expand-bg); padding: 4px 8px; font-size: 12px; }
    .kit-row.expanded .kit-summary { display: block; }
    .kit-empty { padding: 4px 6px; font-style: italic; opacity: .8; }
  }

  .kit-star { background: none; border: none; color: var(--kit-muted); padding: 0 2px; width: auto; &.on { color: #c8960c; } }
  .kit-roll { background: var(--kit-maroon); color: var(--kit-maroon-ink); border: none; border-radius: 4px; padding: 1px 8px; width: auto; }
  .kit-small { font-size: 11px; padding: 1px 6px; width: auto; }

  .item-controls {
    display: inline-flex; gap: 2px; margin-left: auto;
    .item-control { background: none; border: none; width: auto; padding: 0 3px; color: var(--kit-maroon); }
  }
}
```
- [ ] **Step 3:** `styles/actor/pc.scss` — layout B:
```scss
.adnd2e.pc-sheet {
  .window-content {
    display: grid;
    grid-template-columns: 210px 1fr;
    grid-template-rows: auto auto 1fr;
    gap: 0 10px;
    padding: 8px;
    overflow: hidden;
  }
  .pc-left { grid-column: 1; grid-row: 1 / -1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .pc-header { grid-column: 2; grid-row: 1; }
  .kit-tabs { grid-column: 2; grid-row: 2; }
  .window-content > .tab { grid-column: 2; grid-row: 3; overflow-y: auto; }

  .portrait { width: 100%; max-height: 220px; object-fit: cover; border: 2px solid var(--kit-maroon); cursor: pointer; }

  .kit-ability {
    .kit-ability-body { display: flex; align-items: center; gap: 6px; background: var(--kit-field-bg); color: var(--kit-field-ink); border: 1px solid var(--kit-field-border); border-top: none; padding: 2px 6px; }
    .kit-big { font-size: 18px; font-weight: 700; min-width: 28px; text-align: center; }
    input[type="number"] { width: 48px; }
    .exceptional { width: 44px; }
    .racial { color: var(--kit-maroon); font-weight: 700; }
    .kit-mods { font-size: 10px; color: var(--kit-muted); display: flex; flex-wrap: wrap; gap: 2px 6px; padding: 1px 2px; }
    .sub-scores { display: flex; flex-wrap: wrap; gap: 4px; padding: 2px; input { width: 40px; } }
  }

  .kit-save { display: grid; grid-template-columns: 1fr auto auto; gap: 4px; align-items: center; padding: 1px 0; }

  .pc-header {
    .pc-title-row { display: flex; align-items: center; gap: 8px; }
    .pc-name { flex: 1; font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 700; color: var(--kit-maroon); margin: 0; border: none; background: transparent; }
    input.pc-name { background: var(--kit-field-bg); border: 1px solid var(--kit-field-border); }
    .pc-class-line { color: var(--kit-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 2px 0 6px; }
    .pc-vitals { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-end; input[type="number"] { width: 50px; } }
    .casting-badge { font-weight: 700; color: var(--kit-maroon); }
  }

  .weapon-row, .armor-row, .class-row, .prof-row, .spell-row, .feature-row, .trait-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 3px 6px; border-bottom: 1px solid var(--kit-row-rule);
  }
  .expended { opacity: .6; }
  .casting.panel, .kit-casting { border-left: 3px solid var(--kit-maroon); padding-left: 6px; }
  .overspent, .warning { color: var(--kit-maroon); font-weight: 700; }
  .currency-inputs { display: flex; flex-wrap: wrap; gap: 6px; input { width: 60px; } }
  .detail-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 10px; }
}
```
- [ ] **Step 4:** `styles/system.scss` — add `@use "theme/tokens";`, `@use "kit/kit";`, `@use "actor/pc";` after the existing `@use` lines (keep `actor/character` and `actor/creature`).
- [ ] **Step 5: Verify** — `npm run typecheck`, `npm run lint` exit 0 (SCSS is compiled only by the build; the implementer must NOT run the build — the controller compiles it at Task 6). Double-check SCSS syntax by reading it back (balanced braces, `@use` names match file basenames without underscore).
- [ ] **Step 6: Commit** — `feat(sheets): parchment/maroon theme tokens, dark-leather variant and kit/PC layout styles` (+ trailer).

---

### Task 4: New PC templates, sheet wiring, lang, nothing-lost test

**Files:**
- Create: `templates/actor/pc/{left,header,tabs,main,inventory,proficiencies,spells,features,journal}.hbs`, `templates/actor/pc/partials/{pc-ability,pc-class-row,pc-item-table}.hbs`
- Create: `src/sheets/kit-dom.ts`
- Modify: `src/sheets/handlebars.ts` (register the three new partials), `src/sheets/character/sheet.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`
- Test: `tests/templates/pc-sheet-bindings.test.ts`

**Interfaces — Consumes:** Task 2 context fields; Task 1 `normalizeFavorites`, `toggleFavoriteList`, `FavoriteKind`.

**The nothing-lost list** (every binding in the CURRENT PC templates — the new templates must contain all of them):
- `data-action`: `advanceWeaponMastery`, `allocateThiefSkillPoint`, `awardXp`, `cancelCasting`, `castSpell`, `completeCasting`, `deallocateThiefSkillPoint`, `deleteItem`, `disruptCasting`, `editImage`, `editItem`, `forgetSpell` (spell rows AND orphaned rows), `learnSpell`, `memorizeSpell`, `removeTrait`, `restSpellcasting`, `rollAttack`, `rollHp`, `rollNonweaponCheck`, `rollSave`, `rollThiefSkill`, `seedSubAbilities`, `takeAverageHp`, `toggleDualClass` (both the toggle and the clear label).
- `name=`: `name`, `system.abilities.{{row.key}}.score`, `system.abilities.str.exceptional`, `{{sub.name}}`, `system.attributes.hp.value`, `system.attributes.hp.temp`, `system.biography`, `system.currency.pp`, `.gp`, `.ep`, `.sp`, `.cp`, `system.details.alignment`, `system.details.campaignNotes`, `system.details.gmNotes`, `system.details.{{field}}`, `system.options.skillsAndPowers.characterPoints.pool`, `system.resources.reputation`, `.henchmen`, `.followers`.
- `data-field` (inline item edits, bound in `_onRender`): `quantity`, `location`, `equipped`, `identified`.
- DOM contracts read by handlers: `.weapon-row` containing `.backstab-toggle` and `.maneuver-select` (the `rollAttack` handler reads them via `closest(".weapon-row")`).

- [ ] **Step 1: Failing binding test** — `tests/templates/pc-sheet-bindings.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const PC_DIR = path.join(ROOT, "templates", "actor", "pc");

function allHbs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? allHbs(p) : p.endsWith(".hbs") ? [p] : [];
  });
}
const TEMPLATES = allHbs(PC_DIR).map((p) => readFileSync(p, "utf8")).join("\n")
  // the shared item-controls partial is reused by the PC templates
  + readFileSync(path.join(ROOT, "templates", "actor", "character", "partials", "item-controls.hbs"), "utf8");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "character", "sheet.ts"), "utf8");

const NOTHING_LOST_ACTIONS = [
  "advanceWeaponMastery", "allocateThiefSkillPoint", "awardXp", "cancelCasting", "castSpell", "completeCasting",
  "deallocateThiefSkillPoint", "deleteItem", "disruptCasting", "editImage", "editItem", "forgetSpell", "learnSpell",
  "memorizeSpell", "removeTrait", "restSpellcasting", "rollAttack", "rollHp", "rollNonweaponCheck", "rollSave",
  "rollThiefSkill", "seedSubAbilities", "takeAverageHp", "toggleDualClass",
];
const NOTHING_LOST_NAMES = [
  'name="name"', 'name="system.abilities.{{row.key}}.score"', 'name="system.abilities.str.exceptional"',
  'name="{{sub.name}}"', 'name="system.attributes.hp.value"', 'name="system.attributes.hp.temp"', 'name="system.biography"',
  'name="system.currency.pp"', 'name="system.currency.gp"', 'name="system.currency.ep"', 'name="system.currency.sp"',
  'name="system.currency.cp"', 'name="system.details.alignment"', 'name="system.details.campaignNotes"',
  'name="system.details.gmNotes"', 'name="system.details.{{field}}"', 'name="system.options.skillsAndPowers.characterPoints.pool"',
  'name="system.resources.reputation"', 'name="system.resources.henchmen"', 'name="system.resources.followers"',
];
const NOTHING_LOST_FIELDS = ['data-field="quantity"', 'data-field="location"', 'data-field="equipped"', 'data-field="identified"'];
const CORE_ACTIONS = new Set(["tab", "editImage"]);

describe("PC sheet templates (sheet redesign R1)", () => {
  it("keep every pre-redesign binding (nothing lost)", () => {
    for (const a of NOTHING_LOST_ACTIONS) expect(TEMPLATES, a).toContain(`data-action="${a}"`);
    for (const n of NOTHING_LOST_NAMES) expect(TEMPLATES, n).toContain(n);
    for (const f of NOTHING_LOST_FIELDS) expect(TEMPLATES, f).toContain(f);
    expect(TEMPLATES).toContain('class="weapon-row');
    expect(TEMPLATES).toContain('class="backstab-toggle"');
    expect(TEMPLATES).toContain('class="maneuver-select"');
  });

  it("every data-action used by a PC template is registered on the PC sheet (or is a core action)", () => {
    const used = new Set([...TEMPLATES.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
    const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eCharacterSheet\.#on/gm)].map((m) => m[1]!));
    for (const a of used) expect(registered.has(a) || CORE_ACTIONS.has(a), a).toBe(true);
  });
});
```
Run `npx vitest run tests/templates > "$TEMP/tpl.log" 2>&1; tail -10 "$TEMP/tpl.log"` → FAIL (no templates yet).

- [ ] **Step 2: Lang** — add inside `ADND2E.sheet.tabs`: `"proficiencies": "Proficiencies"`, `"journal": "Journal"`; add a new `ADND2E.sheet.kit` object:
```json
      "kit": {
        "lock": "Unlock to edit",
        "unlock": "Lock (play mode)",
        "favorites": "Favorites",
        "noFavorites": "Star weapons, gear, spells or thief skills to pin them here.",
        "favorite": "Toggle favorite",
        "filter": "Filter…",
        "attacks": "Attacks",
        "sections": { "weapons": "Weapons", "armor": "Armor", "equipment": "Equipment" },
        "cols": { "name": "Name", "damage": "Dmg S-M / L", "speed": "Spd", "qty": "Qty", "weight": "Wt", "location": "Location", "equipped": "Equipped", "identified": "Identified" }
      },
```
and append to `tests/lang/en-coverage.test.ts` a describe asserting these keys resolve (`ADND2E.sheet.tabs.proficiencies`, `.journal`, `ADND2E.sheet.kit.lock`, `.unlock`, `.favorites`, `.noFavorites`, `.favorite`, `.filter`, `.attacks`, `.sections.weapons`, `.sections.armor`, `.sections.equipment`, and every `.cols.*`).

- [ ] **Step 3: Partials** — register in `src/sheets/handlebars.ts` `PARTIALS`: `"actor/pc/partials/pc-ability.hbs"`, `"actor/pc/partials/pc-class-row.hbs"`, `"actor/pc/partials/pc-item-table.hbs"` (ids `adnd2e.pc-ability`, `adnd2e.pc-class-row`, `adnd2e.pc-item-table`).

`templates/actor/pc/partials/pc-ability.hbs` (params: `row`, `unlocked`):
```hbs
<div class="kit-ability" data-ability="{{row.key}}">
  <div class="kit-bar">{{localize row.label}}</div>
  <div class="kit-ability-body">
    {{#if unlocked}}
      <input type="number" name="system.abilities.{{row.key}}.score" value="{{row.score}}"{{#if row.scoreLocked}} disabled title="{{localize 'ADND2E.sheet.subAbilities.mainLocked'}}"{{/if}}>
    {{else}}
      <span class="kit-big">{{row.effectiveScore}}</span>
    {{/if}}
    {{#if row.racialDelta}}<span class="racial">{{adnd2eSigned row.racialDelta}}</span>{{/if}}
    {{#if row.showExceptional}}
      {{#if unlocked}}
        <input type="number" class="exceptional" name="system.abilities.str.exceptional" value="{{row.exceptional}}" placeholder="%">
      {{else if row.exceptional}}
        <span class="exceptional">/{{row.exceptional}}</span>
      {{/if}}
    {{/if}}
  </div>
  <div class="kit-mods">{{#each row.mods as |m|}}<span title="{{m.label}}">{{m.value}}</span>{{/each}}</div>
  {{#if row.subs}}{{#if unlocked}}
    <div class="sub-scores">
      {{#each row.subs as |sub|}}
        <label class="sub-score">{{localize sub.label}}<input type="number" min="1" max="25" name="{{sub.name}}" value="{{sub.value}}" placeholder="{{sub.placeholder}}"></label>
      {{/each}}
    </div>
  {{/if}}{{/if}}
</div>
```
`templates/actor/pc/partials/pc-class-row.hbs` (params: `c`, `unlocked`):
```hbs
<div class="class-row" data-class-id="{{c.id}}">
  <span class="name">
    {{c.name}}
    {{#if c.isDualPrimary}}<span class="badge dual-primary">{{localize 'ADND2E.sheet.dualClass.toggle'}}</span>{{/if}}
    {{#if c.isDualActive}}<span class="badge dual-active">{{localize 'ADND2E.sheet.dualClass.toggle'}}</span>{{/if}}
  </span>
  <span class="level">L{{c.level}}</span>
  <span class="hit-die">d{{c.hitDie}}</span>
  {{#if c.specialistSchool}}<span class="specialist">{{c.specialistSchool}}</span>{{/if}}
  <span class="xp">{{c.xp}}{{#if c.nextThreshold}} / {{c.nextThreshold}}{{/if}} <span class="pct">{{adnd2ePct c.xpPct}}</span> <progress value="{{c.xpPct}}" max="1"></progress></span>
  {{#if c.canLevelUp}}
    <button type="button" class="kit-roll" data-action="rollHp" data-class-id="{{c.id}}">{{localize 'ADND2E.sheet.xp.rollHp'}}</button>
    <button type="button" class="kit-small" data-action="takeAverageHp" data-class-id="{{c.id}}">{{localize 'ADND2E.sheet.xp.takeAverage'}}</button>
  {{/if}}
  {{#if unlocked}}{{> adnd2e.item-controls id=c.id deletable=true}}{{/if}}
</div>
```
`templates/actor/pc/partials/pc-item-table.hbs` (params: `section`, `sheet` = the sheet root context passed as `sheet=@root`):
```hbs
<section class="kit-table" data-kit-section="{{section.id}}" style="--kit-cols: 1fr 90px 40px 44px 110px auto">
  <div class="kit-bar" data-kit-section-toggle>
    <span class="kit-caret"></span>
    {{#if section.labelKey}}{{localize section.labelKey}}{{else}}{{section.label}}{{/if}}
    ({{section.rows.length}})
    {{#if section.capacity}}<span class="weight">{{section.capacity.used}}{{#if section.capacity.max}} / {{section.capacity.max}}{{/if}}</span>{{#if section.capacity.over}}<span class="warning">{{localize 'ADND2E.sheet.inventory.overCapacity'}}</span>{{/if}}{{/if}}
  </div>
  <div class="kit-rows">
    <div class="kit-head"><span>{{localize 'ADND2E.sheet.kit.cols.name'}}</span><span>{{localize 'ADND2E.sheet.kit.cols.damage'}}</span><span>{{localize 'ADND2E.sheet.kit.cols.weight'}}</span><span>{{localize 'ADND2E.sheet.kit.cols.qty'}}</span><span>{{localize 'ADND2E.sheet.kit.cols.location'}}</span><span></span></div>
    {{#each section.rows as |r|}}
      <div class="kit-row" data-kit-row data-kit-name="{{r.item.name}}" data-item-id="{{r.item.id}}">
        <div class="kit-cells">
          <span class="kit-name" data-kit-expand>{{#if r.item.img}}<img src="{{r.item.img}}" alt="">{{/if}}{{r.item.name}}{{#if r.item.magicBonus}} <span class="badge magic">{{adnd2eSigned r.item.magicBonus}}</span>{{/if}}</span>
          <span>{{#if r.item.weapon}}{{r.item.weapon.damageVsSM}} / {{r.item.weapon.damageVsL}}{{/if}}</span>
          <span>{{r.item.totalWeight}}</span>
          <span>{{#if @root.adnd2e.lock.unlocked}}<input type="number" min="0" value="{{r.item.quantity}}" data-item-id="{{r.item.id}}" data-field="quantity" style="width:40px">{{else}}{{r.item.quantity}}{{/if}}</span>
          <span>{{#if @root.adnd2e.lock.unlocked}}<select data-item-id="{{r.item.id}}" data-field="location">{{#each @root.adnd2e.inventory.locationOptions as |opt|}}<option value="{{opt.value}}" {{#if (eq opt.value r.item.location)}}selected{{/if}}>{{#if opt.value}}{{opt.label}}{{else}}{{localize opt.label}}{{/if}}</option>{{/each}}</select>{{/if}}</span>
          <span class="kit-row-actions">
            <label title="{{localize 'ADND2E.sheet.kit.cols.equipped'}}"><input type="checkbox" data-item-id="{{r.item.id}}" data-field="equipped" {{checked r.item.equipped}}></label>
            {{#if @root.user.isGM}}{{#if @root.adnd2e.lock.unlocked}}<label title="{{localize 'ADND2E.sheet.kit.cols.identified'}}"><input type="checkbox" data-item-id="{{r.item.id}}" data-field="identified" {{checked r.item.identified}}></label>{{/if}}{{/if}}
            {{#if @root.adnd2e.favorites.canFavorite}}<button type="button" class="kit-star{{#if r.favorite}} on{{/if}}" data-action="toggleFavorite" data-kind="item" data-id="{{r.item.id}}" title="{{localize 'ADND2E.sheet.kit.favorite'}}">★</button>{{/if}}
            {{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=r.item.id deletable=true}}{{/if}}
          </span>
        </div>
        <div class="kit-summary">{{{r.item.description}}}</div>
      </div>
    {{else}}
      <p class="kit-empty">{{localize 'ADND2E.sheet.inventory.empty'}}</p>
    {{/each}}
  </div>
</section>
```
(`eq` and `checked` are core v14 Handlebars helpers — the existing `item-row.hbs` already uses both. `@root.user` is provided by `DocumentSheetV2._prepareContext`, as the current inventory template's `@root.user.isGM` relies on.)

- [ ] **Step 4: Page templates.** Create each file exactly as below.

`templates/actor/pc/left.hbs`:
```hbs
<aside class="pc-left">
  <img class="portrait" src="{{adnd2e.identity.img}}" data-action="editImage" data-edit="img" alt="{{adnd2e.identity.name}}">
  {{#if adnd2e.lock.unlocked}}{{#if adnd2e.subAbilities.canSeed}}
    <button type="button" class="kit-small" data-action="seedSubAbilities">{{localize 'ADND2E.sheet.subAbilities.seed'}}</button>
  {{/if}}{{/if}}
  {{#each adnd2e.abilities as |row|}}
    {{> adnd2e.pc-ability row=row unlocked=@root.adnd2e.lock.unlocked}}
  {{/each}}
  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.vitals.saves'}}</div>
    <div class="kit-body">
      {{#each adnd2e.vitals.saves as |row|}}
        <div class="kit-save" data-save="{{row.key}}">
          <span class="label">{{localize row.label}}</span>
          <span class="value" title="{{row.target}} {{adnd2eSigned row.rollModifier}}">{{row.effectiveTarget}}</span>
          <button type="button" class="kit-roll" data-action="rollSave" data-save="{{row.key}}" title="{{localize 'ADND2E.sheet.combat.rollSave'}}"><i class="fa-solid fa-dice-d20" inert></i></button>
        </div>
      {{/each}}
    </div>
  </section>
</aside>
```
`templates/actor/pc/header.hbs`:
```hbs
<header class="pc-header">
  <div class="pc-title-row">
    {{#if adnd2e.lock.unlocked}}
      <input type="text" class="pc-name" name="name" value="{{adnd2e.identity.name}}" placeholder="{{localize 'ADND2E.sheet.namePlaceholder'}}">
    {{else}}
      <h1 class="pc-name">{{adnd2e.identity.name}}</h1>
    {{/if}}
    {{#if adnd2e.lock.canUnlock}}
      <button type="button" class="kit-lock" data-action="toggleLock" title="{{#if adnd2e.lock.unlocked}}{{localize 'ADND2E.sheet.kit.unlock'}}{{else}}{{localize 'ADND2E.sheet.kit.lock'}}{{/if}}">
        <i class="fa-solid {{#if adnd2e.lock.unlocked}}fa-lock-open{{else}}fa-lock{{/if}}" inert></i>
      </button>
    {{/if}}
  </div>
  <div class="pc-class-line">
    {{#if adnd2e.identity.raceName}}<span class="race">{{adnd2e.identity.raceName}}</span>{{#if adnd2e.lock.unlocked}}{{#if adnd2e.identity.raceItemId}}{{> adnd2e.item-controls id=adnd2e.identity.raceItemId deletable=true}}{{/if}}{{/if}}{{/if}}
    <span class="classes">{{adnd2e.identity.classLine}}</span>
    {{#if adnd2e.identity.arrangementBadge}}<span class="badge">{{adnd2e.identity.arrangementBadge}}</span>{{/if}}
    {{#if adnd2e.lock.unlocked}}
      <select name="system.details.alignment">{{selectOptions alignments selected=adnd2e.identity.alignmentValue localize=true}}</select>
    {{else}}
      <span class="alignment">{{localize (lookup alignments adnd2e.identity.alignmentValue)}}</span>
    {{/if}}
  </div>
  <div class="pc-vitals">
    <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.hp'}}</div>
      <span class="kit-big"><input type="number" name="system.attributes.hp.value" value="{{adnd2e.vitals.hp.value}}"> / {{adnd2e.vitals.hp.max}}</span></div>
    <div class="kit-stat"><div class="kit-bar">+ HP</div>
      <span class="kit-big"><input type="number" name="system.attributes.hp.temp" value="{{adnd2e.vitals.hp.temp}}"></span></div>
    <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.ac'}}</div><span class="kit-big">{{adnd2e.vitals.ac.normal}}</span></div>
    <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.thac0'}}</div><span class="kit-big">{{adnd2e.vitals.thac0.melee}}</span></div>
    <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.movement'}}</div><span class="kit-big" title="{{localize adnd2e.vitals.movement.encumbranceCategoryLabel}}">{{adnd2e.vitals.movement.current}}</span></div>
    {{#if adnd2e.vitals.casting}}<span class="casting-badge" title="{{localize 'ADND2E.sheet.casting.badgeHint'}}">{{localize 'ADND2E.sheet.casting.badge'}}</span>{{/if}}
  </div>
</header>
```
(`alignments` is set on the root context by `_prepareContext` today; if `localize (lookup …)` renders the raw key because `CONFIG.ADND2E.alignments` values are already i18n keys, it is correct; verify the rendered text in the report.)

`templates/actor/pc/tabs.hbs`:
```hbs
<nav class="kit-tabs tabs" aria-roledescription="{{localize 'SHEETS.FormNavLabel'}}">
  {{#each tabs as |tab|}}
    <a data-action="tab" data-group="{{tab.group}}" data-tab="{{tab.id}}"{{#if tab.cssClass}} class="{{tab.cssClass}}"{{/if}}>
      {{#if tab.icon}}<i class="{{tab.icon}}" inert></i>{{/if}} <span>{{localize tab.label}}</span>
    </a>
  {{/each}}
</nav>
```
`templates/actor/pc/main.hbs`:
```hbs
<section class="tab main{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">

  <section class="kit-panel favorites">
    <div class="kit-bar">★ {{localize 'ADND2E.sheet.kit.favorites'}}</div>
    <div class="kit-body">
      {{#each adnd2e.favorites.rows as |f|}}
        <div class="favorite-row">
          {{#if f.img}}<img src="{{f.img}}" alt="" width="20" height="20">{{/if}}
          <span class="name">{{#if f.nameIsKey}}{{localize f.name}}{{else}}{{f.name}}{{/if}}</span>
          {{#if f.detail}}<span class="detail">{{f.detail}}</span>{{/if}}
          {{#if f.action}}<button type="button" class="kit-roll" data-action="{{f.action}}"{{#if f.itemId}} data-item-id="{{f.itemId}}"{{/if}}{{#if f.skill}} data-skill="{{f.skill}}"{{/if}}><i class="fa-solid fa-dice-d20" inert></i></button>{{/if}}
          {{#if @root.adnd2e.favorites.canFavorite}}<button type="button" class="kit-star on" data-action="toggleFavorite" data-kind="{{f.kind}}" data-id="{{f.id}}" title="{{localize 'ADND2E.sheet.kit.favorite'}}">★</button>{{/if}}
        </div>
      {{else}}
        <p class="kit-empty">{{localize 'ADND2E.sheet.kit.noFavorites'}}</p>
      {{/each}}
    </div>
  </section>

  {{#if adnd2e.spells.casting}}
    <section class="kit-panel kit-casting">
      <div class="kit-bar">{{localize 'ADND2E.sheet.casting.title'}}: {{adnd2e.spells.casting.spellName}}</div>
      <div class="kit-body">
        <p class="detail">{{localize adnd2e.spells.casting.detailKey value=adnd2e.spells.casting.detailValue}}</p>
        {{#if adnd2e.spells.casting.canComplete}}<button type="button" class="kit-roll" data-action="completeCasting">{{localize 'ADND2E.sheet.casting.complete'}}</button>{{/if}}
        {{#if adnd2e.spells.casting.canGmControl}}
          <button type="button" data-action="disruptCasting">{{localize 'ADND2E.sheet.casting.disrupt'}}</button>
          <button type="button" data-action="cancelCasting">{{localize 'ADND2E.sheet.casting.cancel'}}</button>
        {{/if}}
      </div>
    </section>
  {{/if}}

  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.kit.attacks'}}</div>
    <div class="kit-body">
      {{#each adnd2e.combat.weapons as |w|}}
        <div class="weapon-row{{#if w.equipped}} equipped{{/if}}" data-item-id="{{w.id}}">
          <span class="name">{{w.name}}</span>
          <span class="equipped-state">{{#if w.equipped}}{{localize 'ADND2E.sheet.combat.equipped'}}{{else}}{{localize 'ADND2E.sheet.combat.notEquipped'}}{{/if}}</span>
          <span class="damage">{{w.damageNote}}</span>
          <span class="speed" title="{{localize 'ADND2E.sheet.combat.speedFactor'}}">{{w.speedFactor}}</span>
          {{#if w.range}}<span class="range">{{w.range}}</span>{{/if}}
          {{#if w.equipped}}
            {{#if w.canBackstab}}<label class="backstab-label"><input type="checkbox" class="backstab-toggle" data-item-id="{{w.id}}"> {{localize 'ADND2E.sheet.combat.backstab'}}</label>{{/if}}
            {{#if @root.adnd2e.combat.maneuverOptions.length}}
              <select class="maneuver-select" data-item-id="{{w.id}}">
                <option value="">{{localize 'ADND2E.sheet.combat.maneuverNone'}}</option>
                {{#each @root.adnd2e.combat.maneuverOptions as |opt|}}<option value="{{opt.value}}">{{localize opt.label}}</option>{{/each}}
              </select>
            {{/if}}
            <button type="button" class="kit-roll" data-action="rollAttack" data-item-id="{{w.id}}">{{localize 'ADND2E.sheet.combat.rollAttack'}}</button>
          {{/if}}
          {{#if @root.adnd2e.favorites.canFavorite}}<button type="button" class="kit-star{{#if w.favorite}} on{{/if}}" data-action="toggleFavorite" data-kind="item" data-id="{{w.id}}" title="{{localize 'ADND2E.sheet.kit.favorite'}}">★</button>{{/if}}
          {{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=w.id deletable=true}}{{/if}}
        </div>
      {{else}}
        <p class="kit-empty">{{localize 'ADND2E.sheet.combat.noWeapons'}}</p>
      {{/each}}
    </div>
  </section>

  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.combat.armor'}}</div>
    <div class="kit-body">
      {{#each adnd2e.combat.armor as |a|}}
        <div class="armor-row{{#if a.equipped}} equipped{{/if}}" data-item-id="{{a.id}}">
          <span class="name">{{a.name}}{{#if a.isShield}} <span class="badge">{{localize 'ADND2E.sheet.combat.shield'}}</span>{{/if}}</span>
          <span class="ac">{{a.baseAc}}</span>
          <span class="equipped-state">{{#if a.equipped}}{{localize 'ADND2E.sheet.combat.equipped'}}{{else}}{{localize 'ADND2E.sheet.combat.notEquipped'}}{{/if}}</span>
          {{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=a.id deletable=true}}{{/if}}
        </div>
      {{else}}
        <p class="kit-empty">{{localize 'ADND2E.sheet.combat.noArmor'}}</p>
      {{/each}}
      <ul class="derived">
        {{#each adnd2e.combat.acBreakdown as |row|}}<li><span class="label">{{localize row.label}}</span> <span class="value">{{row.value}}</span></li>{{/each}}
      </ul>
    </div>
  </section>

  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.sections.classes'}}
      <button type="button" class="kit-small" data-action="awardXp" style="margin-left:auto">{{localize 'ADND2E.sheet.xp.award'}}</button>
    </div>
    <div class="kit-body">
      {{#each adnd2e.classes as |c|}}
        {{> adnd2e.pc-class-row c=c unlocked=@root.adnd2e.lock.unlocked}}
      {{else}}
        <p class="kit-empty">{{localize 'ADND2E.sheet.sections.classes'}}</p>
      {{/each}}
      {{#if adnd2e.lock.unlocked}}
        {{#if adnd2e.dualClassToggle.available}}
          <button type="button" data-action="toggleDualClass">{{localize 'ADND2E.sheet.dualClass.toggle'}}</button>
        {{else if adnd2e.dualClassToggle.on}}
          <button type="button" data-action="toggleDualClass">{{localize 'ADND2E.sheet.dualClass.clear'}}</button>
        {{/if}}
      {{/if}}
    </div>
  </section>

</section>
```
`templates/actor/pc/inventory.hbs`:
```hbs
<section class="tab inventory{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
  <input type="text" class="kit-filter" data-kit-filter="inventory" placeholder="{{localize 'ADND2E.sheet.kit.filter'}}">
  <div data-kit-filter-scope="inventory">
    {{#each adnd2e.inventory.sections as |section|}}
      {{> adnd2e.pc-item-table section=section}}
    {{/each}}
  </div>
  {{> adnd2e.encumbrance-gauge gauge=adnd2e.inventory.encumbrance}}
  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.inventory.currency'}}</div>
    <div class="kit-body currency-inputs">
      <label>PP <input type="number" min="0" name="system.currency.pp" value="{{adnd2e.inventory.currency.pp}}"></label>
      <label>GP <input type="number" min="0" name="system.currency.gp" value="{{adnd2e.inventory.currency.gp}}"></label>
      <label>EP <input type="number" min="0" name="system.currency.ep" value="{{adnd2e.inventory.currency.ep}}"></label>
      <label>SP <input type="number" min="0" name="system.currency.sp" value="{{adnd2e.inventory.currency.sp}}"></label>
      <label>CP <input type="number" min="0" name="system.currency.cp" value="{{adnd2e.inventory.currency.cp}}"></label>
    </div>
  </section>
</section>
```
`templates/actor/pc/proficiencies.hbs` — the current `templates/actor/character/skills.hbs` content with these changes: section class `tab proficiencies`; each panel uses `<section class="kit-panel"><div class="kit-bar">…</div><div class="kit-body">…</div></section>`; `{{> adnd2e.item-controls id=… deletable=@root.editable}}` becomes `{{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=… deletable=true}}{{/if}}`; the thief-skill row gains, before its roll button, `{{#if @root.adnd2e.favorites.canFavorite}}<button type="button" class="kit-star{{#if t.favorite}} on{{/if}}" data-action="toggleFavorite" data-kind="thiefSkill" data-id="{{t.skill}}" title="{{localize 'ADND2E.sheet.kit.favorite'}}">★</button>{{/if}}`. Every `data-action` of the old file (`advanceWeaponMastery`, `rollNonweaponCheck`, `deallocateThiefSkillPoint`, `allocateThiefSkillPoint`, `rollThiefSkill`) stays unchanged.

`templates/actor/pc/spells.hbs` — the current `templates/actor/character/spells.hbs` WITHOUT the casting panel block (it moved to Main), with: section class `tab spells`; panels as `kit-panel`; each spell row gains `{{#if @root.adnd2e.favorites.canFavorite}}<button type="button" class="kit-star{{#if s.favorite}} on{{/if}}" data-action="toggleFavorite" data-kind="spell" data-id="{{s.id}}" title="{{localize 'ADND2E.sheet.kit.favorite'}}">★</button>{{/if}}` and its item controls wrapped `{{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=s.id deletable=true}}{{/if}}`. Keep `restSpellcasting`, `learnSpell`, `memorizeSpell`, `forgetSpell` (rows and orphaned), `castSpell` and the `adnd2e.slot-table` partial usages unchanged.

`templates/actor/pc/features.hbs` — the current `templates/actor/character/features.hbs` with: section class `tab features`; panels as `kit-panel`; the feature rows' and trait rows' `item-controls` wrapped in `{{#if @root.adnd2e.lock.unlocked}}…deletable=true…{{/if}}`; the trait **Remove** button only when unlocked (`{{#if @root.adnd2e.lock.unlocked}}{{#if row.canRemove}}…{{/if}}{{/if}}`); the CP pool input rendered only when `adnd2e.lock.unlocked` (else the pool as text), keeping its `disabled` when `!canEditPool`; the three resource inputs (`system.resources.*`) only when unlocked (else text).

`templates/actor/pc/journal.hbs` — the current `templates/actor/character/biography.hbs` with: section class `tab journal`; the detail-field `<input name="system.details.{{field}}">` only when `@root.adnd2e.lock.unlocked` (else `{{lookup @root.source.system.details field}}` as text); the three `formInput` prose fields use `disabled=proseDisabled` instead of `disabled=notEditable`.

- [ ] **Step 5: `src/sheets/kit-dom.ts`** (glue):
```typescript
// DOM behaviour for the sheet kit (sheet redesign R1): collapsible item-table
// sections (state per viewer in localStorage), the client-side filter box, and
// click-to-expand item summaries. No document writes. Foundry-free DOM glue,
// dev-world verified.

const key = (sheetKey: string, section: string): string => `adnd2e.collapsed.${sheetKey}.${section}`;

function readCollapsed(sheetKey: string, section: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key(sheetKey, section)) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(sheetKey: string, section: string, collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(key(sheetKey, section), collapsed ? "1" : "0");
  } catch {
    // storage unavailable (private mode, blocked site data) — collapse just isn't remembered
  }
}

export function bindSheetKit(root: HTMLElement, sheetKey: string): void {
  for (const section of root.querySelectorAll<HTMLElement>("[data-kit-section]")) {
    const id = section.dataset.kitSection ?? "";
    if (readCollapsed(sheetKey, id)) section.classList.add("collapsed");
    section.querySelector<HTMLElement>("[data-kit-section-toggle]")?.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button, input, select, a")) return;
      writeCollapsed(sheetKey, id, section.classList.toggle("collapsed"));
    });
  }
  for (const input of root.querySelectorAll<HTMLInputElement>("input[data-kit-filter]")) {
    const scope = root.querySelector<HTMLElement>(`[data-kit-filter-scope="${input.dataset.kitFilter}"]`);
    if (!scope) continue;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      for (const row of scope.querySelectorAll<HTMLElement>("[data-kit-name]")) {
        row.hidden = q !== "" && !(row.dataset.kitName ?? "").toLowerCase().includes(q);
      }
    });
    // the filter is not a form field: keep its keystrokes out of submitOnChange
    input.addEventListener("change", (event) => event.stopPropagation());
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-kit-expand]")) {
    el.addEventListener("click", () => el.closest("[data-kit-row]")?.classList.toggle("expanded"));
  }
}
```

- [ ] **Step 6: Sheet wiring** — in `src/sheets/character/sheet.ts`:
  1. `DEFAULT_OPTIONS.classes` → `["adnd2e", "sheet", "actor", "pc-sheet"]`; `position` → `{ width: 860, height: 880 }`.
  2. `actions`: add `toggleLock: Adnd2eCharacterSheet.#onToggleLock,` and `toggleFavorite: Adnd2eCharacterSheet.#onToggleFavorite,`.
  3. `const TP = (p: string): string => TEMPLATE_PATH("actor/pc", p);` and replace `PARTS` with:
  ```typescript
  static PARTS = {
    left: { template: TP("left.hbs") },
    header: { template: TP("header.hbs") },
    tabs: { template: TP("tabs.hbs") },
    main: { template: TP("main.hbs"), scrollable: [""] },
    inventory: { template: TP("inventory.hbs"), scrollable: [""] },
    proficiencies: { template: TP("proficiencies.hbs"), scrollable: [""] },
    spells: { template: TP("spells.hbs"), scrollable: [""] },
    features: { template: TP("features.hbs"), scrollable: [""] },
    journal: { template: TP("journal.hbs"), scrollable: [""] },
  };
  ```
  (remove the old `T(...)` helper only if nothing else in the file uses it.)
  4. `TABS.primary.tabs` → `main` (`fa-solid fa-user`), `inventory` (`fa-solid fa-box-open`), `proficiencies` (`fa-solid fa-hand-fist`), `spells` (`fa-solid fa-wand-sparkles`), `features` (`fa-solid fa-star`), `journal` (`fa-solid fa-book`); `initial: "main"`, `labelPrefix: "ADND2E.sheet.tabs"`.
  5. Add the instance field `#unlocked = false;`. In `_prepareContext` add `context.proseDisabled = !this.isEditable || !this.#unlocked;`. In `#buildInput` add `unlocked: this.#unlocked,` and `favorites: (this.document as unknown as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "favorites"),` (import `SYSTEM_ID` from `../../constants` if not imported).
  6. At the end of `_onRender` add `bindSheetKit(this.element, `pc-${(this.document as unknown as { id: string }).id}`);` (import from `../kit-dom`). Leave the existing `[data-item-id][data-field]` change listener exactly as is.
  7. Handlers:
  ```typescript
  static async #onToggleLock(this: Adnd2eCharacterSheet): Promise<void> {
    if (!this.isEditable) return;
    this.#unlocked = !this.#unlocked;
    await this.render();
  }

  static async #onToggleFavorite(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const actor = this.document as unknown as {
      isOwner: boolean;
      getFlag(scope: string, key: string): unknown;
      setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    };
    const kind = target.dataset.kind as FavoriteKind | undefined;
    const id = target.dataset.id;
    if (!actor.isOwner || !kind || !id) return;
    const current = normalizeFavorites(actor.getFlag(SYSTEM_ID, "favorites"));
    await actor.setFlag(SYSTEM_ID, "favorites", toggleFavoriteList(current, { kind, id }));
  }
  ```
  (`render` may need a cast in the Base type; add `render(options?: unknown): Promise<unknown>;` to the Base member list if typecheck requires.)

- [ ] **Step 7: Verify** — `npx vitest run tests/templates tests/lang tests/sheets > "$TEMP/t4.log" 2>&1; tail -10 "$TEMP/t4.log"` passes; typecheck, lint, `npm run test:coverage` exit 0. Confirm by `git status` that NOTHING under `templates/actor/character/`, `templates/actor/npc/`, `templates/actor/creature/`, `src/sheets/npc/`, `src/sheets/creature/`, `styles/actor/character.scss`, `styles/actor/creature.scss` changed.
- [ ] **Step 8: Commit** — `feat(sheets): rebuild the PC sheet on the parchment kit — left column, six tabs, item tables, edit lock, favorites` (+ trailer).

---

### Task 5: Whole-branch review (MANDATORY)

Most capable model over base..HEAD with this plan, the spec and this risk list:
- **Nothing lost** — the automated test passes AND a manual walk: every old PC template's visible data (ability mods, racial delta, exceptional STR, sub-scores, class XP bars, HP rolls, dual-class, AC breakdown, armor list, weapons with backstab/maneuver, encumbrance gauge, containers + contents, currency, weapon/NWP/thief rows, spell slots, known spells with badges, orphaned spells, learn/memorize/forget/cast, casting panel, features by source, racial abilities, languages, resources, traits panel + CP ledger + overspend/refund warnings, details, biography, campaign notes, GM notes GM-only) appears in the new templates.
- **Character NPC and Monster NPC untouched:** no file under the forbidden paths changed; the NPC sheet still points at `templates/actor/character/*` and still renders (its context builder only gained fields); the old `.character`/`.npc` SCSS still applies to the NPC sheet; the PC sheet no longer carries the `character` class.
- **Lock semantics:** locked mode renders no structural inputs (decision 3 lists); play inputs stay; a non-editor never sees the lock, stars (unless owner), or ✎/🗑; `toggleLock` no-ops for non-editors; the lock state never persists.
- **Favorites:** only owners write the flag; stale ids drop; favorites for thief skills/spells/weapons invoke existing handlers with the dataset those handlers read (`data-item-id` / `data-skill`); `rollAttack` from Favorites (no `.weapon-row`) rolls with no backstab/maneuver and doesn't throw.
- **Templates:** `@root.` inside every `{{#each}}`/partial; helpers used (`eq`, `checked`, `selectOptions`, `lookup`, `concat`, `adnd2eSigned`, `adnd2ePct`) exist; partials registered; `tab.cssClass` gives the active pill.
- **Form behavior:** filter input never submits a value (no `name`, change propagation stopped); the unnamed checkbox/selects with `data-field` still go through the `_onRender` listener; locked mode can't trigger a submit that blanks data (no disabled/omitted field wipes an authored value — FormDataExtended only sends present, enabled fields).
- **Dark theme:** selector `body.theme-dark .adnd2e.pc-sheet, .adnd2e.pc-sheet.theme-dark` matches v14 (`client/game.mjs:1850-1880`); contrast is legible.
- **localStorage** wrapped in try/catch; no Foundry imports in `src/sheets/kit/**`; coverage/typecheck/lint green (re-run).
One fix wave + scoped re-review for Critical/Important.

---

### Task 6: GATED dev-world smoke check (light + dark, GM + player seat)

Confirm Foundry closed → `npm run build` → `npm run link` → restart. Use a PC with a class, race, weapons (one equipped), armor, a container with contents, spells (memorized), a thief class or multiclass with thief skills, a trait (with the S&P rules on), and a Character NPC and a Monster NPC.

- [ ] **Look:** parchment background, maroon bars, white fields, pill tabs (tan active), serif name, no logo; switch Foundry to dark mode (Settings → Core → Color Scheme) → dark leather, readable.
- [ ] **Layout:** left column (portrait, six abilities with mods, saves with roll buttons) stays on every tab; header shows name, class line, alignment, HP/+HP/AC/THAC0/Move.
- [ ] **Lock:** opens locked (no structural inputs, no ✎/🗑); unlock → name, alignment, ability scores (and sub-scores + seed when the rule is on), exceptional STR, quantities/locations, ✎/🗑, dual-class toggle, pool, resources, details, prose editors appear; lock again hides them; closing/reopening starts locked.
- [ ] **Nothing lost (walk every binding):** award XP; roll HP / take average; dual-class toggle; roll every save; roll an attack with backstab and a maneuver; equip/unequip; quantity/location/identified (GM); ✎ opens an item, 🗑 deletes with confirm; currency; weapon mastery advance; NWP check; thief allocate/deallocate/roll; rest; learn; memorize; forget (row + orphaned); cast (and in combat with casting time: begin/complete/disrupt/cancel on Main); traits remove + pool edit + overspend warning; seed sub-scores; edit HP; details/biography/campaign/GM notes.
- [ ] **Item tables:** sections collapse/expand and stay collapsed after re-render and reopening; the filter narrows rows; clicking a name shows its summary.
- [ ] **Favorites:** star a weapon, a piece of gear, a spell and a thief skill → they appear in Main's Favorites; their buttons attack / open / cast / roll; unstar removes; delete a starred item → it silently disappears from Favorites.
- [ ] **Character NPC & Monster NPC:** both sheets look and behave exactly as before this plan.
- [ ] **Player seat:** as the owning player: lock/unlock works, stars work, all play actions work; as a non-owner observer: no lock, no stars, no ✎/🗑, read-only.
- [ ] Report PASS/FAIL via `AskUserQuestion`.

## After this plan lands

Push + PR (standing default). Plan R2 (Character NPC sheet on the kit — then remove the now-unused old `templates/actor/character/**` that only the NPC still uses) and R3 (Monster NPC sheet) follow.
