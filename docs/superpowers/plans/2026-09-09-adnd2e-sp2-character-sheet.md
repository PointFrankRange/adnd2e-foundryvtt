# SP2 — PC Character Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SP1 stub raw-field sheet with a real 7-tab ApplicationV2 PC character sheet — all derived/authored display, live field editing, and drag-and-drop item management — for the `character` and `npc` actor types.

**Architecture:** Two layers, matching the rest of the codebase. A **pure render-context layer** (`src/sheets/character/{context,context-types,grouping,xp,drop-rules}.ts`) is Foundry-free, gated by `tsc -p tsconfig.core.json`, ESLint-fenced, and 100% Vitest-covered — it turns plain actor data into a fully-formatted template context. A thin **Foundry shell** (`src/sheets/character/sheet.ts` + templates + SCSS) is an `ActorSheetV2` + `HandlebarsApplicationMixin` class that assembles the plain-data input, calls the pure builder, and wires drag-drop + the three guided actions (Roll HP, Award XP, dual-class toggle). The shell has no unit tests (spec §9) and is verified by a gated dev-world smoke check.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 ApplicationV2 (`foundry.applications.sheets.ActorSheetV2`, `foundry.applications.api.HandlebarsApplicationMixin`, `static TABS` / `static PARTS`), Handlebars templates, SCSS.

**Spec:** `docs/superpowers/specs/2026-09-09-adnd2e-sp2-character-sheet-design.md` (read it alongside this plan).

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source at `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — **never** `fvtt-types` (it pins a wrong v13-beta). No v13 branches added.
- **Two-layer contract:** pure files (`src/sheets/character/context.ts`, `context-types.ts`, `grouping.ts`, `xp.ts`, `drop-rules.ts`, and the new `src/data/derive/character/container-weight.ts`) import nothing from `foundry` / `game` / `CONFIG` / DOM; are gated by `tsconfig.core.json`; are ESLint pure-zone; have **100% line/statement/function Vitest coverage** (branch threshold 90). The Foundry shell (`sheet.ts`, templates, SCSS, `equipment.ts` edit, `index.ts`, `system.ts`) is typecheck + build gated only, no unit tests, dev-world verified.
- **The gated-zone config triad** — every new pure file is added to ALL THREE:
  1. `tsconfig.core.json` `include` array
  2. `vitest.config.ts` `coverage.include` array
  3. `eslint.config.js` — the Foundry-globals `ignores` array **and** the pure-zone `files` array
- **Content policy:** mechanical/UI data only. Templates carry labels via `{{localize}}` keys, never 2E rules prose.
- **Do NOT run** `npm run format` / `prettier` / `npm install`. Prettier is not in the lint gate.
- **Vitest output:** read with `tail` / `head` / redirect, **never** `| grep` (SIGPIPE → false "no tests"). After clearing `node_modules/.vite` + `.vitest` + `.cache`, the first run can flake "no tests" — rerun 2–3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed** (it locks `dist/packs`).
- **`references/`** (PHB/DMG/MM PDFs) is gitignored — never committed. No new table transcription needed.
- **Dev-world smoke check (Task 9) is GATED** — the user runs it (the controller cannot run Foundry) BEFORE `finishing-a-development-branch`, never a deferred checklist item.
- **Authored vs derived binding:** authored `<input>`s bind to `context.source` (= `document._source`); derived values render as text from the prepared model. The SP1 "C1" lesson — never bind an input to the prepared model (racial-adjusted scores + derived overwrites would ratchet on save).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Reference facts (verified against v14.364 source + the SP1 codebase)

**v14 ApplicationV2 tabs** (`client/applications/api/application.mjs`):
- `static TABS = { <groupId>: { tabs: [{ id, icon }], initial: "<id>", labelPrefix: "<i18n prefix>" } }`.
- With exactly one tab group, `ApplicationV2#_prepareContext` already returns `{ tabs: this._prepareTabs(groupId) }` — so `super._prepareContext(options)` populates `context.tabs` (a `Record<tabId, { id, group, active, cssClass, icon, label }>`).
- `_preparePartContext(partId, context)` — set `if (partId in context.tabs) context.tab = context.tabs[partId];` so each tab part template can gate on `{{#if tab.active}}`.
- The nav bar template is Foundry's built-in `"templates/generic/tab-navigation.hbs"` — declare a `tabs` PART pointing at it; it renders `<a data-action="tab" data-group data-tab>` links and ApplicationV2's built-in `tab` action + `changeTab` handle switching.
- Each tab part template's root is `<section class="tab{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">`.

**v14 DocumentSheetV2** (`client/applications/api/document-sheet.mjs`, confirmed in SP1):
- `_prepareContext` sets `context.source = this.document._source`, `context.editable = this.isEditable`, `context.document`, `context.fields = this.document.system.schema.fields`, `context.rootId`.
- `DEFAULT_OPTIONS.form = { handler, submitOnChange, closeOnSubmit }`. Set `submitOnChange: true` for live editing; the built-in handler runs `_prepareSubmitData` → `_processFormData` → `document.update(...)`.
- `_processFormData(event, form, formData)` returns `foundry.utils.expandObject(formData.object)`.
- Inputs named `name="system.<path>"` are collected by `FormDataExtended` and written to `_source` — provided the part template root is **not** a nested `<form>` (SP1 "FR-A1": the frame is already `tag: "form"`; use `<section>`/`<div>`, never `<form>`, inside parts).

**v14 ActorSheetV2** (`client/applications/sheets/actor-sheet.mjs`):
- Provides `get actor()`, drag-drop out of the box: `_onRender` binds `this._dragDrop` (`dragSelector: ".draggable"`, drop on the whole element); `_onDrop` → `_onDropDocument` → `_onDropItem(event, item)`; the default `_onDropItem` creates the embedded item (`Item.implementation.create(data, { parent: this.actor, keepId })`, using `game.items.fromCompendium` for compendium drops).
- Override `_onDropItem(event, item)` to validate first, then `return super._onDropItem(event, item)` to keep the default create.

**v14 actions** (`DEFAULT_OPTIONS.actions = { <name>: <static handler> }`) — a handler is `static #onFoo(this: SheetClass, event: PointerEvent, target: HTMLElement)`; wire buttons with `data-action="foo"`.

**Engine surface SP2 consumes** (all already shipped):
- `src/data/actor/base-actor.ts` `deriveAndCache` writes onto `system.*`: `abilities.<k>.mods` (`StrengthModifiers` etc. from `core/types.ts`), `classes: { chassisId, level, canLevelUp }[]`, `multiclass: { mode: "single"|"multiclass"|"dualclass", dualClass: { dormantChassisId, activeChassisId, surpassed }, hpAveraged }`, `attributes.hp.max`, `attributes.thac0: { base, melee, ranged }`, `attributes.ac: { normal, rearAttack, surprised, shieldless }`, `saves.<ppd|rsw|pp|bw|spell>: { target, rollModifier, effectiveTarget }`, `attributes.movement: { base, current, encumbranceCategory }`, `attributes.encumbrance: { carried, category, movementRate, penalty: { attackRoll, armorClass }, baseMove }`, `spellcasting.wizard.slots` / `.priest.slots` (`Record<number, { max, used }>`), `proficiencies.weapon: { total, spent, available }`, `proficiencies.nonweapon: {...}`, `languagesKnown.max`.
- `src/core/classes/chassis.ts` `getChassis(id: ClassId): ClassChassis` — `.hitDie`, `.group`.
- `src/core/classes/progression.ts` `xpForLevel(chassis, level): number`, `levelForXp(chassis, xp): number`.
- Embedded `class` item `system`: `{ chassisId, specialistSchool, kit, grantedFeatures, xp, hpRolls, dualClassState }` + derived `level`, `canLevelUp` (`src/data/item/class.ts`).
- `src/data/item/*` — field lists per §5.4; `weapon`/`armor`/`equipment` carry the `physical-item` fragment (`quantity, weight, cost, location, identified, equipped, magicBonus`) + derived `totalWeight`.
- `CONFIG.ADND2E` (`src/config.ts` `Adnd2eConfig`) — `abilities`, `saves`, `classGroups`, `schools`, `spheres`, `alignments`, `sizes`, `encumbranceCategories`, … all `Record<key, i18nLabelKey>`.
- `src/sheets/raw-field-sheet.ts` `RawFieldSheetMixin` + `src/sheets/index.ts` `registerSheets()` + `DocumentSheetConfig.registerSheet(documentClass, scope, sheetClass, { makeDefault, types, label })` — the SP1 registration reference.

---

## File Structure

```
src/sheets/character/
  context-types.ts     NEW (pure)  — every input + output interface for the context layer
  xp.ts                NEW (pure)  — xpToNext(), awardXpSplit()
  drop-rules.ts        NEW (pure)  — validateItemDrop()
  grouping.ts          NEW (pure)  — groupInventory() (container nesting)
  context.ts           NEW (pure)  — buildCharacterSheetContext()
  sheet.ts             NEW (shell) — Adnd2eCharacterSheet class
src/sheets/
  handlebars.ts        NEW (shell) — registerSheetPartials() + helpers
  index.ts             MODIFY      — register Adnd2eCharacterSheet default for character+npc; demote RawField sheets
src/data/derive/character/
  container-weight.ts  NEW (pure)  — containerAdjustedCarriedWeight()
  index.ts             MODIFY      — export * from "./container-weight"
src/data/actor/
  snapshot.ts          MODIFY      — carriedWeight uses containerAdjustedCarriedWeight
src/data/item/
  equipment.ts         MODIFY      — add contentsWeightMultiplier NumberField
src/system.ts          MODIFY      — add a `setup` hook calling registerSheetPartials()
templates/actor/character/
  sheet.hbs  main.hbs  combat.hbs  inventory.hbs  skills.hbs  spells.hbs
  features.hbs  biography.hbs                                   NEW
templates/actor/character/partials/
  ability-row.hbs  save-row.hbs  class-row.hbs  item-row.hbs
  slot-table.hbs  encumbrance-gauge.hbs                         NEW
styles/
  system.scss          MODIFY      — @use "actor/character"
  actor/character.scss  NEW
lang/en.json            MODIFY      — ADND2E.sheet.* tree
tsconfig.core.json      MODIFY      — include the 6 new pure files/dirs
vitest.config.ts        MODIFY      — coverage.include the 6 new pure files/dirs
eslint.config.js        MODIFY      — ignores[] + files[] the 6 new pure files/dirs
tests/sheets/character/
  xp.test.ts  drop-rules.test.ts  grouping.test.ts  context.test.ts   NEW
tests/data/derive/
  container-weight.test.ts                                       NEW
tests/lang/en-coverage.test.ts   MODIFY — ADND2E.sheet.* drift block
```

---

## Task 1: Pure helpers — types, XP math, drop rules

**Files:**
- Create: `src/sheets/character/context-types.ts`
- Create: `src/sheets/character/xp.ts`
- Create: `src/sheets/character/drop-rules.ts`
- Create: `tests/sheets/character/xp.test.ts`
- Create: `tests/sheets/character/drop-rules.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js` (add `src/sheets/character` + `tests/sheets`)

**Interfaces:**
- Consumes: `ClassId`, `ClassChassis` from `src/core/types.ts`; `xpForLevel`, `levelForXp` from `src/core/classes/progression.ts`; `getChassis` from `src/core/classes/chassis.ts`.
- Produces:
  - `xpToNext(chassisId: ClassId, xp: number): { level: number; next: number | null; toNextLevel: number | null; pct: number }`
  - `awardXpSplit(total: number, classCount: number): number`
  - `validateItemDrop(input: DropCheckInput): { ok: boolean; reason?: string }` where `DropCheckInput = { dropType: string; dropChassisId?: string | null; hasRace: boolean; existingChassisIds: readonly string[] }`
  - all interfaces in `context-types.ts` (listed in Task 4's Interfaces block — they are declared here, consumed there)

- [ ] **Step 1: Add the three pure paths to the gated triad**

`tsconfig.core.json` — append to `include`: `"src/sheets/character/context-types.ts"`, `"src/sheets/character/xp.ts"`, `"src/sheets/character/drop-rules.ts"`, `"src/sheets/character/grouping.ts"`, `"src/sheets/character/context.ts"`, `"tests/sheets"`.

`vitest.config.ts` — append to `coverage.include`: `"src/sheets/character/context-types.ts"`, `"src/sheets/character/xp.ts"`, `"src/sheets/character/drop-rules.ts"`, `"src/sheets/character/grouping.ts"`, `"src/sheets/character/context.ts"`.

`eslint.config.js` — append the same five `src/sheets/character/*.ts` paths **and** `"tests/sheets/**"` to BOTH the Foundry-globals `ignores` array AND the pure-zone `files` array.

(Adding all five now avoids re-touching the triad in Tasks 2–4. `context-types.ts` is type-only so it contributes no coverage lines; that is fine — v8 reports 100% of 0 executable lines.)

- [ ] **Step 2: Write `tests/sheets/character/xp.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { awardXpSplit, xpToNext } from "../../../src/sheets/character/xp";

describe("xpToNext", () => {
  it("a level-1 fighter with 0 xp needs the level-2 threshold", () => {
    const r = xpToNext("fighter", 0);
    expect(r.level).toBe(1);
    expect(r.next).toBe(2000); // PHB fighter L2
    expect(r.toNextLevel).toBe(2000);
    expect(r.pct).toBe(0);
  });

  it("mid-band progress is a 0..1 fraction of the current band", () => {
    const r = xpToNext("fighter", 1000); // half way from L1 (0) to L2 (2000)
    expect(r.level).toBe(1);
    expect(r.pct).toBeCloseTo(0.5, 5);
    expect(r.toNextLevel).toBe(1000);
  });

  it("at/above the class max level, next is null and pct is 1", () => {
    const hugeXp = 100_000_000;
    const r = xpToNext("fighter", hugeXp);
    expect(r.next).toBeNull();
    expect(r.toNextLevel).toBeNull();
    expect(r.pct).toBe(1);
  });
});

describe("awardXpSplit", () => {
  it("divides evenly and floors", () => {
    expect(awardXpSplit(3000, 2)).toBe(1500);
    expect(awardXpSplit(3001, 2)).toBe(1500);
    expect(awardXpSplit(1000, 3)).toBe(333);
  });
  it("a single class gets the whole award", () => {
    expect(awardXpSplit(3000, 1)).toBe(3000);
  });
  it("zero or negative class count yields 0 (guard)", () => {
    expect(awardXpSplit(3000, 0)).toBe(0);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`npx vitest run tests/sheets/character/xp.test.ts 2>&1 | tail -20` — module not found).

- [ ] **Step 4: Write `src/sheets/character/xp.ts`**

```ts
import { getChassis } from "../../core/classes/chassis";
import { levelForXp, xpForLevel } from "../../core/classes/progression";
import type { ClassId } from "../../core/types";

export interface XpProgress {
  /** current level for this xp total */
  level: number;
  /** xp threshold for the next level, or null at max level */
  next: number | null;
  /** xp still needed to reach the next level, or null at max level */
  toNextLevel: number | null;
  /** 0..1 progress through the current level band (1 at max level) */
  pct: number;
}

/** Level + progress-to-next for an embedded class item's own xp total. */
export function xpToNext(chassisId: ClassId, xp: number): XpProgress {
  const chassis = getChassis(chassisId);
  const level = levelForXp(chassis, xp);
  const bandStart = xpForLevel(chassis, level);
  let next: number | null = null;
  try {
    next = xpForLevel(chassis, level + 1);
  } catch {
    next = null; // past the class's xp table / max level
  }
  if (next === null || next <= bandStart) {
    return { level, next: null, toNextLevel: null, pct: 1 };
  }
  const pct = Math.min(1, Math.max(0, (xp - bandStart) / (next - bandStart)));
  return { level, next, toNextLevel: Math.max(0, next - xp), pct };
}

/** 2E: an xp award to a multiclass character is split evenly among its classes (remainder dropped). */
export function awardXpSplit(total: number, classCount: number): number {
  if (classCount <= 0) return 0;
  return Math.floor(total / classCount);
}
```

(Verify `xpForLevel` throws past the table — read `src/core/classes/progression.ts:5`. If it instead returns a sentinel or the max, adjust the `next === null` branch to match; the test's max-level case is the contract.)

- [ ] **Step 5: Run `xp.test.ts` — expect PASS.**

- [ ] **Step 6: Write `tests/sheets/character/drop-rules.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { validateItemDrop } from "../../../src/sheets/character/drop-rules";

describe("validateItemDrop", () => {
  it("allows a race when the actor has none", () => {
    expect(validateItemDrop({ dropType: "race", hasRace: false, existingChassisIds: [] }))
      .toEqual({ ok: true });
  });
  it("rejects a second race", () => {
    const r = validateItemDrop({ dropType: "race", hasRace: true, existingChassisIds: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateRace");
  });
  it("rejects a duplicate class chassis", () => {
    const r = validateItemDrop({
      dropType: "class", dropChassisId: "fighter", hasRace: true, existingChassisIds: ["fighter"],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateClass");
  });
  it("allows a distinct second class", () => {
    expect(validateItemDrop({
      dropType: "class", dropChassisId: "mage", hasRace: true, existingChassisIds: ["fighter"],
    })).toEqual({ ok: true });
  });
  it("allows any other item type unconditionally", () => {
    for (const t of ["weapon", "armor", "equipment", "spell", "weaponProficiency", "nonweaponProficiency", "classFeature"]) {
      expect(validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] }))
        .toEqual({ ok: true });
    }
  });
});
```

- [ ] **Step 7: Run it — expect FAIL.**

- [ ] **Step 8: Write `src/sheets/character/drop-rules.ts`**

```ts
export interface DropCheckInput {
  /** the dropped item's `type` */
  dropType: string;
  /** the dropped item's `system.chassisId` when `dropType === "class"` */
  dropChassisId?: string | null;
  /** does the actor already have a `race` item */
  hasRace: boolean;
  /** `system.chassisId` of every `class` item already on the actor */
  existingChassisIds: readonly string[];
}

export interface DropVerdict {
  ok: boolean;
  /** i18n key for the rejection toast */
  reason?: string;
}

/** Which compendium/world items a character sheet accepts on drop, and why not. */
export function validateItemDrop(input: DropCheckInput): DropVerdict {
  if (input.dropType === "race") {
    return input.hasRace ? { ok: false, reason: "ADND2E.sheet.drop.duplicateRace" } : { ok: true };
  }
  if (input.dropType === "class") {
    const dup = input.dropChassisId != null && input.existingChassisIds.includes(input.dropChassisId);
    return dup ? { ok: false, reason: "ADND2E.sheet.drop.duplicateClass" } : { ok: true };
  }
  return { ok: true };
}
```

- [ ] **Step 9: Write `src/sheets/character/context-types.ts`** — the full interface set. (Type-only; no test.)

```ts
import type {
  CharismaModifiers, ConstitutionModifiers, DexterityModifiers, IntelligenceModifiers,
  StrengthModifiers, WisdomModifiers,
} from "../../core/types";

/* ---------- input (assembled by sheet.ts from plain data) ---------- */

export interface CharacterSheetInput {
  name: string;
  img: string;
  /** document._source.system — authored values, for <input> binding */
  source: Record<string, unknown>;
  /** the prepared system.* — derived/cached values */
  derived: CharacterDerivedView;
  classItems: ClassItemView[];
  raceItem: RaceItemView | null;
  physicalItems: PhysicalItemView[];
  proficiencyItems: { weapon: WeaponProfView[]; nonweapon: NwpView[] };
  spellItems: SpellItemView[];
  featureItems: FeatureItemView[];
  /** CONFIG.ADND2E — label maps only */
  config: Adnd2eConfigView;
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}

export interface Adnd2eConfigView {
  abilities: Record<string, string>;
  saves: Record<string, string>;
  alignments: Record<string, string>;
  encumbranceCategories: Record<string, string>;
  classGroups: Record<string, string>;
  schools: Record<string, string>;
  spheres: Record<string, string>;
}

export interface CharacterDerivedView {
  abilities: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", {
    score: number;
    mods: StrengthModifiers | DexterityModifiers | ConstitutionModifiers
      | IntelligenceModifiers | WisdomModifiers | CharismaModifiers;
  }>;
  classes: { chassisId: string; level: number; canLevelUp: boolean }[];
  multiclass: {
    mode: "single" | "multiclass" | "dualclass";
    dualClass: { dormantChassisId: string | null; activeChassisId: string | null; surpassed: boolean };
    hpAveraged: boolean;
  };
  attributes: {
    hp: { value: number; max: number; temp: number; nonlethal: number };
    thac0: { base: number; melee: number; ranged: number };
    ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
    movement: { base: number; current: number; encumbranceCategory: string };
    encumbrance: {
      carried: number; category: string; movementRate: number;
      penalty: { attackRoll: number; armorClass: number }; baseMove: number;
    };
  };
  saves: Record<"ppd" | "rsw" | "pp" | "bw" | "spell",
    { target: number; rollModifier: number; effectiveTarget: number }>;
  spellcasting: {
    wizard: { specialistSchool: string | null; slots: Record<string, { max: number; used: number }> };
    priest: { slots: Record<string, { max: number; used: number }> };
  };
  proficiencies: {
    weapon: { total: number; spent: number; available: number };
    nonweapon: { total: number; spent: number; available: number };
  };
  languagesKnown: { max: number };
}

export interface ClassItemView {
  id: string; name: string; img: string;
  chassisId: string; hitDie: number;
  xp: number; level: number; canLevelUp: boolean;
  dualClassState: "primary" | "active" | null;
  specialistSchool: string | null;
}

export interface RaceItemView {
  id: string; name: string; img: string;
  raceId: string; size: string; baseMovement: number; infravision: number;
  grantedFeatures: string[]; bonusLanguages: string[];
}

export interface PhysicalItemView {
  id: string; name: string; img: string; type: "weapon" | "armor" | "equipment";
  quantity: number; weight: number; totalWeight: number;
  location: string; equipped: boolean; identified: boolean; magicBonus: number;
  /** equipment only */
  isContainer: boolean; capacity: number | null; contentsWeightMultiplier: number;
  /** weapon only — pre-derived display strings */
  weapon?: { damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number };
}

export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  slotsInvested: number; specialized: boolean;
}
export interface NwpView {
  id: string; name: string; governingAbility: string; modifier: number;
  slotCost: number; slotsInvested: number; isRacial: boolean;
  /** governing ability score + modifier — display only (checks are SP5) */
  checkTarget: number | null;
}
export interface SpellItemView {
  id: string; name: string; img: string; casterClass: string; level: number;
  schools: string[]; spheres: string[]; range: string; castingTime: string; savingThrow: string;
  inSpellbook: boolean;
}
export interface FeatureItemView {
  id: string; name: string; img: string;
  sourceType: string; activation: string;
  uses: { value: number; max: number; per: string } | null;
  description: string;
}

/* ---------- output (consumed by the templates) ---------- */

export interface AbilityRow {
  key: string; label: string;
  score: number; racialDelta: number; effectiveScore: number;
  exceptional: number | null; showExceptional: boolean;
  mods: { label: string; value: string }[];
}
export interface SaveRow {
  key: string; label: string; target: number; rollModifier: number; effectiveTarget: number;
}
export interface ClassRow {
  id: string; name: string; chassisId: string; level: number;
  xp: number; xpToNextLevel: number | null; xpPct: number; nextThreshold: number | null;
  canLevelUp: boolean; hitDie: number;
  isDualPrimary: boolean; isDualActive: boolean; specialistSchool: string | null;
}
export interface SlotRow { level: number; max: number; used: number }
export interface ContainerGroup {
  item: PhysicalItemView; contents: PhysicalItemView[];
  usedWeight: number; capacity: number | null; overCapacity: boolean;
}
export interface EncumbranceGauge {
  carried: number; category: string; categoryLabel: string;
  movementRate: number; baseMove: number;
  penalty: { attackRoll: number; armorClass: number };
}
export interface TabDescriptor { id: string; label: string; icon: string }

export interface CharacterSheetContext {
  identity: {
    name: string; img: string;
    raceName: string | null;
    classLine: string;
    arrangementBadge: string | null;
    alignmentValue: string;
  };
  abilities: AbilityRow[];
  vitals: {
    hp: { value: number; max: number; temp: number; nonlethal: number };
    thac0: { base: number; melee: number; ranged: number };
    ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
    saves: SaveRow[];
    movement: { base: number; current: number; encumbranceCategory: string; encumbranceCategoryLabel: string };
  };
  classes: ClassRow[];
  dualClassToggle: { available: boolean; on: boolean };
  inventory: {
    containers: ContainerGroup[];
    loose: PhysicalItemView[];
    encumbrance: EncumbranceGauge;
    currency: { pp: number; gp: number; ep: number; sp: number; cp: number };
    locationOptions: { value: string; label: string }[];
  };
  combat: {
    weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null }[];
    acBreakdown: { label: string; value: number }[];
    armor: { id: string; name: string; equipped: boolean; isShield: boolean; baseAc: number }[];
  };
  skills: {
    weapon: { total: number; spent: number; available: number; items: WeaponProfView[] };
    nonweapon: { total: number; spent: number; available: number; items: NwpView[] };
  };
  spells: {
    wizardSlots: SlotRow[] | null;
    priestSlots: SlotRow[] | null;
    specialistSchoolLabel: string | null;
    known: { level: number; items: SpellItemView[] }[];
  };
  features: {
    groups: { sourceType: string; items: FeatureItemView[] }[];
    racialAbilities: string[];
    languagesMax: number;
    resources: { reputation: string; henchmen: string; followers: string };
  };
  biography: { detailFields: string[]; showGmNotes: boolean };
  tabs: TabDescriptor[];
}
```

- [ ] **Step 10: Run the full pure gate**

```bash
npm run typecheck 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npx vitest run tests/sheets/character 2>&1 | tail -15
```
Expected: typecheck + lint clean; `xp.test.ts` + `drop-rules.test.ts` green.

- [ ] **Step 11: Run `npm run test:coverage` — confirm still 100%** (`... 2>&1 | tail -12`). The two new pure modules with executable code (`xp.ts`, `drop-rules.ts`) are fully exercised; `context-types.ts` is type-only.

- [ ] **Step 12: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/xp.ts src/sheets/character/drop-rules.ts tests/sheets/character tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(sp2): pure sheet helpers — context types, xp progress, drop rules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Pure — inventory grouping (container nesting)

**Files:**
- Create: `src/sheets/character/grouping.ts`
- Create: `tests/sheets/character/grouping.test.ts`

**Interfaces:**
- Consumes: `PhysicalItemView`, `ContainerGroup` from `context-types.ts`.
- Produces: `groupInventory(items: readonly PhysicalItemView[]): { containers: ContainerGroup[]; loose: PhysicalItemView[] }`

- [ ] **Step 1: Write `tests/sheets/character/grouping.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { groupInventory } from "../../../src/sheets/character/grouping";
import type { PhysicalItemView } from "../../../src/sheets/character/context-types";

function item(over: Partial<PhysicalItemView>): PhysicalItemView {
  return {
    id: "x", name: "x", img: "", type: "equipment",
    quantity: 1, weight: 0, totalWeight: 0,
    location: "", equipped: false, identified: true, magicBonus: 0,
    isContainer: false, capacity: null, contentsWeightMultiplier: 1,
    ...over,
  };
}

describe("groupInventory", () => {
  it("nests items whose location is a container id; leaves the rest loose", () => {
    const pack = item({ id: "pack", name: "Backpack", isContainer: true, capacity: 50, totalWeight: 2 });
    const rope = item({ id: "rope", name: "Rope", location: "pack", totalWeight: 20 });
    const torch = item({ id: "torch", name: "Torch", totalWeight: 1 });
    const r = groupInventory([pack, rope, torch]);
    expect(r.containers).toHaveLength(1);
    expect(r.containers[0].item.id).toBe("pack");
    expect(r.containers[0].contents.map((i) => i.id)).toEqual(["rope"]);
    expect(r.containers[0].usedWeight).toBe(20);
    expect(r.containers[0].overCapacity).toBe(false);
    expect(r.loose.map((i) => i.id)).toEqual(["torch"]); // the container itself is NOT loose
  });

  it("flags over-capacity", () => {
    const pack = item({ id: "pack", isContainer: true, capacity: 10 });
    const rock = item({ id: "rock", location: "pack", totalWeight: 40 });
    const r = groupInventory([pack, rock]);
    expect(r.containers[0].overCapacity).toBe(true);
  });

  it("capacity null means no limit", () => {
    const pack = item({ id: "pack", isContainer: true, capacity: null });
    const rock = item({ id: "rock", location: "pack", totalWeight: 999 });
    expect(groupInventory([pack, rock]).containers[0].overCapacity).toBe(false);
  });

  it("an item pointing at a missing/non-container location falls back to loose", () => {
    const ghost = item({ id: "g", location: "nonexistent" });
    const r = groupInventory([ghost]);
    expect(r.containers).toHaveLength(0);
    expect(r.loose.map((i) => i.id)).toEqual(["g"]);
  });

  it("containers sort before loose is irrelevant — each list preserves input order", () => {
    const b = item({ id: "b", isContainer: true, capacity: null });
    const a = item({ id: "a", isContainer: true, capacity: null });
    expect(groupInventory([b, a]).containers.map((c) => c.item.id)).toEqual(["b", "a"]);
  });

  it("a container nested in another container still renders as its own group (one level of display)", () => {
    const outer = item({ id: "outer", isContainer: true, capacity: null });
    const inner = item({ id: "inner", isContainer: true, capacity: null, location: "outer", totalWeight: 3 });
    const r = groupInventory([outer, inner]);
    expect(r.containers.map((c) => c.item.id)).toEqual(["outer", "inner"]);
    expect(r.containers.find((c) => c.item.id === "outer")!.contents.map((i) => i.id)).toEqual(["inner"]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Write `src/sheets/character/grouping.ts`**

```ts
import type { ContainerGroup, PhysicalItemView } from "./context-types";

/**
 * Split a flat physical-item list into container groups + loose items.
 *
 * - Every `isContainer` item becomes a `ContainerGroup` (in input order), and is
 *   NOT also listed as loose.
 * - A non-container item whose `location` equals a container's id nests under
 *   that container; `usedWeight` is Σ of the contained items' `totalWeight`
 *   (before any weight multiplier — the multiplier affects encumbrance, not the
 *   displayed pack contents).
 * - `overCapacity` is `usedWeight > capacity` (capacity `null` → never over).
 * - An item whose `location` names no container is loose.
 * - Only one level of nesting is displayed: a container inside a container is
 *   still rendered as its own top-level group.
 */
export function groupInventory(
  items: readonly PhysicalItemView[],
): { containers: ContainerGroup[]; loose: PhysicalItemView[] } {
  const containerItems = items.filter((i) => i.isContainer);
  const containerIds = new Set(containerItems.map((i) => i.id));

  const containers: ContainerGroup[] = containerItems.map((item) => {
    const contents = items.filter((i) => i.id !== item.id && i.location === item.id);
    const usedWeight = contents.reduce((sum, i) => sum + i.totalWeight, 0);
    const overCapacity = item.capacity != null && usedWeight > item.capacity;
    return { item, contents, usedWeight, capacity: item.capacity, overCapacity };
  });

  const loose = items.filter(
    (i) => !i.isContainer && !(containerIds.has(i.location)),
  );

  return { containers, loose };
}
```

- [ ] **Step 4: Run `grouping.test.ts` — expect PASS.**

- [ ] **Step 5: Run `npm run typecheck && npm run lint && npm run test:coverage` (each `2>&1 | tail -6`) — clean, 100%.**

- [ ] **Step 6: Commit**

```bash
git add src/sheets/character/grouping.ts tests/sheets/character/grouping.test.ts
git commit -m "feat(sp2): pure inventory grouping — container nesting + capacity

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `equipment.contentsWeightMultiplier` + encumbrance wiring

**Files:**
- Modify: `src/data/item/equipment.ts` (add the field)
- Create: `src/data/derive/character/container-weight.ts` (pure)
- Modify: `src/data/derive/character/index.ts` (export)
- Modify: `src/data/actor/snapshot.ts` (use the helper for `carriedWeight`)
- Create: `tests/data/derive/container-weight.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js` — add `src/data/derive/character/container-weight.ts` is already covered by the existing `src/data/derive` / `src/data/derive/**` entries in all three; **no triad edit needed**. (Confirm: `tsconfig.core.json` includes `"src/data/derive"`, `vitest.config.ts` includes `"src/data/derive/**/*.ts"`, `eslint.config.js` includes `"src/data/derive/**"` in both arrays — it does.)

**Interfaces:**
- Consumes: nothing new.
- Produces: `containerAdjustedCarriedWeight(items: readonly WeightedItem[]): number` where
  `WeightedItem = { id: string; type: string; totalWeight: number; location: string; isContainer: boolean; contentsWeightMultiplier: number }`

- [ ] **Step 1: Write `tests/data/derive/container-weight.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { containerAdjustedCarriedWeight } from "../../../src/data/derive/character/container-weight";

type WI = Parameters<typeof containerAdjustedCarriedWeight>[0][number];
const wi = (o: Partial<WI>): WI => ({
  id: "x", type: "equipment", totalWeight: 0, location: "", isContainer: false, contentsWeightMultiplier: 1, ...o,
});

describe("containerAdjustedCarriedWeight", () => {
  it("sums every weapon/armor/equipment weight when nothing is containerised", () => {
    expect(containerAdjustedCarriedWeight([
      wi({ totalWeight: 10, type: "weapon" }),
      wi({ totalWeight: 5, type: "armor" }),
      wi({ totalWeight: 2, type: "equipment" }),
    ])).toBe(17);
  });

  it("multiplies an item's weight by its container's multiplier", () => {
    const bag = wi({ id: "bag", isContainer: true, totalWeight: 15, contentsWeightMultiplier: 0 });
    const rock = wi({ id: "rock", location: "bag", totalWeight: 100 });
    // bag itself 15 + (rock 100 * 0) = 15
    expect(containerAdjustedCarriedWeight([bag, rock])).toBe(15);
  });

  it("a non-zero multiplier scales proportionally", () => {
    const bag = wi({ id: "bag", isContainer: true, totalWeight: 5, contentsWeightMultiplier: 0.5 });
    const gear = wi({ id: "g", location: "bag", totalWeight: 40 });
    expect(containerAdjustedCarriedWeight([bag, gear])).toBe(5 + 20);
  });

  it("ignores non-physical item types", () => {
    expect(containerAdjustedCarriedWeight([
      wi({ totalWeight: 3, type: "spell" }),
      wi({ totalWeight: 4, type: "class" }),
      wi({ totalWeight: 7, type: "equipment" }),
    ])).toBe(7);
  });

  it("an item in a missing container is counted at full weight", () => {
    expect(containerAdjustedCarriedWeight([wi({ totalWeight: 9, location: "ghost" })])).toBe(9);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Write `src/data/derive/character/container-weight.ts`**

```ts
const PHYSICAL_TYPES = new Set(["weapon", "armor", "equipment"]);

export interface WeightedItem {
  id: string;
  type: string;
  /** the item's own derived total weight (weight * quantity), pounds */
  totalWeight: number;
  /** `system.location` — a container item's id, or "" */
  location: string;
  /** `system.container` (equipment only; false for weapon/armor) */
  isContainer: boolean;
  /** `system.contentsWeightMultiplier` (equipment only; 1 for weapon/armor) */
  contentsWeightMultiplier: number;
}

/**
 * §5.6 step 10 input: total carried weight, with each item's weight scaled by
 * the `contentsWeightMultiplier` of the container it sits in (1 when loose or in
 * a normal container; 0 for a bag-of-holding-type item). The container's own
 * weight is always counted in full.
 */
export function containerAdjustedCarriedWeight(items: readonly WeightedItem[]): number {
  const multiplierByContainerId = new Map<string, number>();
  for (const i of items) {
    if (i.isContainer) multiplierByContainerId.set(i.id, i.contentsWeightMultiplier);
  }
  let total = 0;
  for (const i of items) {
    if (!PHYSICAL_TYPES.has(i.type)) continue;
    const scale = i.location && multiplierByContainerId.has(i.location)
      ? multiplierByContainerId.get(i.location)!
      : 1;
    total += i.totalWeight * scale;
  }
  return total;
}
```

- [ ] **Step 4: Run `container-weight.test.ts` — expect PASS.**

- [ ] **Step 5: `src/data/derive/character/index.ts`** — add `export * from "./container-weight";`.

- [ ] **Step 6: `src/data/item/equipment.ts`** — add to `defineSchema()` after `capacity`:

```ts
      contentsWeightMultiplier: new NumberField({ required: true, min: 0, initial: 1 }),
```

- [ ] **Step 7: `src/data/actor/snapshot.ts`** — replace the `carriedWeight` block:

```ts
  const carriedWeight = containerAdjustedCarriedWeight(
    items.map((i) => {
      const s = i.system as {
        totalWeight?: number; location?: string; container?: boolean; contentsWeightMultiplier?: number;
      };
      return {
        id: (i as { id: string }).id,
        type: i.type,
        totalWeight: s.totalWeight ?? 0,
        location: s.location ?? "",
        isContainer: s.container ?? false,
        contentsWeightMultiplier: s.contentsWeightMultiplier ?? 1,
      };
    }),
  );
```

Add the import: `import { containerAdjustedCarriedWeight } from "../derive/character/container-weight";` and remove the now-unused `PhysicalItemSystem` interface if nothing else uses it (check — `.equipped` is read elsewhere? it is not; safe to drop the interface or leave it, ESLint `no-unused-vars` is `warn` not `error`, but drop it for cleanliness).

- [ ] **Step 8: Full gate**

```bash
npm run typecheck 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npm run test:coverage 2>&1 | tail -12
```
Expected: clean; 100% (the new pure helper is fully covered; `equipment.ts` and `snapshot.ts` are outside the coverage set). Total test count rises by the 5 new `container-weight` tests.

- [ ] **Step 9: Build check** (Foundry must be closed): `npm run build 2>&1 | grep -iE "error|built in" | head`. Expect a clean build. Then reopen not required.

- [ ] **Step 10: Commit**

```bash
git add src/data/item/equipment.ts src/data/derive/character/container-weight.ts src/data/derive/character/index.ts src/data/actor/snapshot.ts tests/data/derive/container-weight.test.ts
git commit -m "feat(sp2): equipment.contentsWeightMultiplier + container-aware carried weight

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `buildCharacterSheetContext` — the pure render-context builder

**Files:**
- Create: `src/sheets/character/context.ts`
- Create: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: every interface from `context-types.ts`; `xpToNext` from `xp.ts`; `groupInventory` from `grouping.ts`.
- Produces: `buildCharacterSheetContext(input: CharacterSheetInput): CharacterSheetContext`

**Design notes for the implementer:**
- This is a pure transform: input plain data → output plain data. No Foundry, no i18n resolution (emit i18n *keys* / already-resolved *label strings from `input.config`*; templates call `{{localize}}` on keys and print label strings directly — the builder passes `config.abilities.str` etc. through as the label since `CONFIG.ADND2E` values are keys, and the template `{{localize}}`s them).
- Keep helper functions small and each covered. Split into: `buildIdentity`, `buildAbilities`, `buildVitals`, `buildClasses`, `buildInventory`, `buildCombat`, `buildSkills`, `buildSpells`, `buildFeatures`, `TABS_DEF`.
- `classLine`: join `"<ChassisLabel> <level>"` per class item with `" / "`. Chassis label = capitalised `chassisId` (there is no `CONFIG.ADND2E.classes` map; use a local `titleCase`). For a dual-class actor show `"<primary> <lvl> → <active> <lvl>"`.
- `arrangementBadge`: `null` for `"single"`; `"multi-class"` for `"multiclass"`; for `"dualclass"` → ``dual-class · ${titleCase(dualClass.dormantChassisId)} ${dualClass.surpassed ? "surpassed" : "dormant"}``.
- `abilities`: for each of str/dex/con/int/wis/cha — `score` from `input.source.system.abilities.<k>.score` (authored), `effectiveScore` from `input.derived.abilities.<k>.score` (post-racial), `racialDelta = effectiveScore - score`, `exceptional` from source, `showExceptional = k === "str" && Number(score) === 18` (the `core.exceptionalStrength` toggle gate is applied by the *template* hiding the field when the value is null AND the toggle is off — but the builder does not read settings; it always emits `showExceptional` on the score condition, and the sheet passes a `perms`-style flag if needed — SIMPLER: emit `showExceptional` purely on `score === 18`; an 18 STR with the toggle off just shows an empty percentile field, harmless). `mods`: turn the `StrengthModifiers`/etc. record into `{ label, value }[]` — `label` is a humanised key (`hitProb` → "Hit Prob", reuse a local `humanize` identical to the SP1 stub's `humanizeKey`), `value` is `String(v)` (numbers, or `"—"` for null).
- `buildVitals`: pass `derived.attributes.*` and `derived.saves` straight through into `SaveRow[]` with labels from `input.config.saves`. `encumbranceCategoryLabel` from `input.config.encumbranceCategories[category]`.
- `buildClasses`: per `input.classItems` → `ClassRow` via `xpToNext(chassisId, xp)`; `isDualPrimary = dualClassState === "primary"`, `isDualActive = dualClassState === "active"`.
- `dualClassToggle`: `available = classItems.length === 2 && classItems.every((c) => c.dualClassState === null)`; `on = classItems.some((c) => c.dualClassState !== null)`.
- `buildInventory`: `groupInventory(input.physicalItems)`, `encumbrance` gauge from `derived.attributes.encumbrance` (+ `categoryLabel`), `currency` from `input.source.system.currency`, `locationOptions` = `[{ value: "", label: "ADND2E.sheet.inventory.noContainer" }, ...containers.map((c) => ({ value: c.item.id, label: c.item.name }))]`.
- `buildCombat`: `weapons` from `input.physicalItems.filter((i) => i.type === "weapon")` → `{ toHitNote, damageNote }` are **display strings only** — `toHitNote = ""` placeholder for SP2 (SP3 fills it), `damageNote = [weapon.damageVsSM, weapon.damageVsL].filter(Boolean).join(" / ")`. `acBreakdown` from the equipped armor/shield views + `derived.abilities.dex.mods.defensiveAdj` → `[{ label: "Base", value }, { label: "Shield", value }, { label: "Magic", value }, { label: "Dex", value }]`. `armor` list = `physicalItems.filter((i) => i.type === "armor")`.
- `buildSkills`: prof totals from `derived.proficiencies.*`; items straight from `input.proficiencyItems`. `NwpView.checkTarget` is precomputed by the *sheet* (it needs the ability score) OR here from `input.derived.abilities[governingAbility].score + modifier` — do it here.
- `buildSpells`: `wizardSlots` = `Object.entries(derived.spellcasting.wizard.slots).map(([level, s]) => ({ level: Number(level), ...s })).sort()` or `null` when the object is empty; same for priest. `specialistSchoolLabel` from `input.config.schools[specialistSchool]` or `null`. `known` = `spellItems` grouped by `level` (1..9), each group `{ level, items }`, dropping empty levels.
- `buildFeatures`: group `featureItems` by `sourceType`; `racialAbilities = input.raceItem?.grantedFeatures ?? []`; `languagesMax = derived.languagesKnown.max`; `resources` from `input.source.system.resources`.
- `biography.showGmNotes = input.perms.isGM`; `detailFields` is a fixed list of `details.*` keys the template iterates (`["age", "sex", "height", "weight", "hairEyes", "homeland", "deity", "kit"]`).
- `tabs`: a constant `[{ id: "main", label: "ADND2E.sheet.tabs.main", icon: "fa-solid fa-user" }, { id: "combat", ..., icon: "fa-solid fa-shield-halved" }, { id: "inventory", ..., icon: "fa-solid fa-box-open" }, { id: "skills", ..., icon: "fa-solid fa-hand-fist" }, { id: "spells", ..., icon: "fa-solid fa-wand-sparkles" }, { id: "features", ..., icon: "fa-solid fa-star" }, { id: "biography", ..., icon: "fa-solid fa-book" }]`.

- [ ] **Step 1: Write `tests/sheets/character/context.test.ts`** — build a full valid `CharacterSheetInput` fixture factory, then assert per section. Minimum cases (each is one `it`):

```ts
import { describe, expect, it } from "vitest";
import { buildCharacterSheetContext } from "../../../src/sheets/character/context";
import type { CharacterSheetInput } from "../../../src/sheets/character/context-types";

// fixture factory — a single-class L7 fighter, human, no items
function input(over: Partial<CharacterSheetInput> = {}): CharacterSheetInput {
  const base: CharacterSheetInput = {
    name: "Aldric", img: "icons/svg/mystery-man.svg",
    source: {
      system: {
        abilities: {
          str: { score: 17, exceptional: null }, dex: { score: 12, exceptional: null },
          con: { score: 15, exceptional: null }, int: { score: 10, exceptional: null },
          wis: { score: 9, exceptional: null }, cha: { score: 13, exceptional: null },
        },
        details: { alignment: "true-neutral", age: 25, sex: "", height: "", weight: "", hairEyes: "", homeland: "", deity: "", kit: "" },
        currency: { pp: 0, gp: 42, ep: 0, sp: 0, cp: 0 },
        resources: { reputation: "", henchmen: "", followers: "" },
      },
    },
    derived: {
      abilities: {
        str: { score: 17, mods: { hitProb: 1, damageAdj: 1, weightAllowance: 85, maxPress: 220, openDoors: 11, openDoorsMagical: null, bendBarsLiftGates: 13 } as never },
        dex: { score: 12, mods: { reactionAdj: 0, missileAttackAdj: 0, defensiveAdj: 0 } as never },
        con: { score: 15, mods: { hpAdjustment: 1, systemShock: 90, resurrectionSurvival: 94, poisonSave: 0, regeneration: "", hitDieMinimumRoll: 1 } as never },
        int: { score: 10, mods: {} as never }, wis: { score: 9, mods: {} as never }, cha: { score: 13, mods: {} as never },
      },
      classes: [{ chassisId: "fighter", level: 7, canLevelUp: false }],
      multiclass: { mode: "single", dualClass: { dormantChassisId: null, activeChassisId: null, surpassed: false }, hpAveraged: false },
      attributes: {
        hp: { value: 52, max: 52, temp: 0, nonlethal: 0 },
        thac0: { base: 14, melee: 13, ranged: 14 },
        ac: { normal: 10, rearAttack: 10, surprised: 10, shieldless: 10 },
        movement: { base: 12, current: 12, encumbranceCategory: "unencumbered" },
        encumbrance: { carried: 0, category: "unencumbered", movementRate: 12, penalty: { attackRoll: 0, armorClass: 0 }, baseMove: 12 },
      },
      saves: {
        ppd: { target: 12, rollModifier: 0, effectiveTarget: 12 }, rsw: { target: 13, rollModifier: 0, effectiveTarget: 13 },
        pp: { target: 14, rollModifier: 0, effectiveTarget: 14 }, bw: { target: 15, rollModifier: 0, effectiveTarget: 15 },
        spell: { target: 16, rollModifier: 0, effectiveTarget: 16 },
      },
      spellcasting: { wizard: { specialistSchool: null, slots: {} }, priest: { slots: {} } },
      proficiencies: { weapon: { total: 4, spent: 0, available: 4 }, nonweapon: { total: 3, spent: 0, available: 3 } },
      languagesKnown: { max: 2 },
    },
    classItems: [{ id: "c1", name: "Fighter", img: "", chassisId: "fighter", hitDie: 10, xp: 70000, level: 7, canLevelUp: false, dualClassState: null, specialistSchool: null }],
    raceItem: null,
    physicalItems: [],
    proficiencyItems: { weapon: [], nonweapon: [] },
    spellItems: [],
    featureItems: [],
    config: {
      abilities: { str: "ADND2E.abilities.str", dex: "ADND2E.abilities.dex", con: "ADND2E.abilities.con", int: "ADND2E.abilities.int", wis: "ADND2E.abilities.wis", cha: "ADND2E.abilities.cha" },
      saves: { ppd: "ADND2E.saves.ppd", rsw: "ADND2E.saves.rsw", pp: "ADND2E.saves.pp", bw: "ADND2E.saves.bw", spell: "ADND2E.saves.spell" },
      alignments: { "true-neutral": "ADND2E.alignments.true-neutral" },
      encumbranceCategories: { unencumbered: "ADND2E.encumbranceCategories.unencumbered" },
      classGroups: {}, schools: {}, spheres: {},
    },
    perms: { isGM: true, isOwner: true, editable: true },
  };
  return { ...base, ...over };
}

describe("buildCharacterSheetContext — identity", () => {
  it("single-class line, no badge", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.identity.classLine).toBe("Fighter 7");
    expect(c.identity.arrangementBadge).toBeNull();
    expect(c.identity.raceName).toBeNull();
  });
  it("multiclass line + badge", () => {
    const c = buildCharacterSheetContext(input({
      derived: { ...input().derived, classes: [{ chassisId: "fighter", level: 7, canLevelUp: false }, { chassisId: "mage", level: 6, canLevelUp: false }], multiclass: { mode: "multiclass", dualClass: { dormantChassisId: null, activeChassisId: null, surpassed: false }, hpAveraged: true } },
      classItems: [
        { id: "c1", name: "Fighter", img: "", chassisId: "fighter", hitDie: 10, xp: 70000, level: 7, canLevelUp: false, dualClassState: null, specialistSchool: null },
        { id: "c2", name: "Mage", img: "", chassisId: "mage", hitDie: 4, xp: 40000, level: 6, canLevelUp: false, dualClassState: null, specialistSchool: null },
      ],
    }));
    expect(c.identity.classLine).toBe("Fighter 7 / Mage 6");
    expect(c.identity.arrangementBadge).toBe("multi-class");
  });
});

describe("buildCharacterSheetContext — abilities", () => {
  it("six rows, racial delta from source vs derived", () => {
    const c = buildCharacterSheetContext(input({
      derived: { ...input().derived, abilities: { ...input().derived.abilities, con: { score: 16, mods: input().derived.abilities.con.mods } } },
    }));
    expect(c.abilities).toHaveLength(6);
    const con = c.abilities.find((a) => a.key === "con")!;
    expect(con.score).toBe(15);
    expect(con.effectiveScore).toBe(16);
    expect(con.racialDelta).toBe(1);
    expect(con.mods.some((m) => m.label === "Hp Adjustment" && m.value === "1")).toBe(true);
  });
  it("exceptional field shows only for an 18 STR", () => {
    expect(buildCharacterSheetContext(input()).abilities.find((a) => a.key === "str")!.showExceptional).toBe(false);
  });
});

describe("buildCharacterSheetContext — vitals / classes / dual-class toggle", () => {
  it("five save rows with labels", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.vitals.saves.map((s) => s.key)).toEqual(["ppd", "rsw", "pp", "bw", "spell"]);
    expect(c.vitals.saves[0].effectiveTarget).toBe(12);
  });
  it("class row carries xp progress", () => {
    const row = buildCharacterSheetContext(input()).classes[0];
    expect(row.level).toBe(7);
    expect(row.canLevelUp).toBe(false);
  });
  it("dual-class toggle unavailable for a single class", () => {
    expect(buildCharacterSheetContext(input()).dualClassToggle).toEqual({ available: false, on: false });
  });
});

describe("buildCharacterSheetContext — inventory / spells / tabs", () => {
  it("currency passes through; loose vs container split", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.inventory.currency.gp).toBe(42);
    expect(c.inventory.containers).toHaveLength(0);
    expect(c.inventory.loose).toHaveLength(0);
  });
  it("no caster class → null slot tables", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.spells.wizardSlots).toBeNull();
    expect(c.spells.priestSlots).toBeNull();
  });
  it("wizard slots become sorted rows", () => {
    const c = buildCharacterSheetContext(input({
      derived: { ...input().derived, spellcasting: { wizard: { specialistSchool: null, slots: { "1": { max: 2, used: 0 }, "2": { max: 1, used: 1 } } }, priest: { slots: {} } } },
    }));
    expect(c.spells.wizardSlots).toEqual([{ level: 1, max: 2, used: 0 }, { level: 2, max: 1, used: 1 }]);
  });
  it("seven tabs in order", () => {
    expect(buildCharacterSheetContext(input()).tabs.map((t) => t.id))
      .toEqual(["main", "combat", "inventory", "skills", "spells", "features", "biography"]);
  });
  it("gm notes hidden for a non-GM", () => {
    expect(buildCharacterSheetContext(input({ perms: { isGM: false, isOwner: true, editable: true } })).biography.showGmNotes).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Write `src/sheets/character/context.ts`** — implement per the design notes above, with each `build*` helper a named function in the file. Use a local `titleCase(s: string)` and `humanize(key: string)` (copy the SP1 stub's `humanizeKey` split-camelCase logic). No Foundry imports.

- [ ] **Step 4: Run `context.test.ts` — iterate to PASS.**

- [ ] **Step 5: `npm run test:coverage 2>&1 | tail -14`** — `context.ts` must be **100%** (lines/statements/functions; branches ≥ 90). Add `it` cases for any uncovered branch the report names (e.g. the dual-class badge path, the `showExceptional === true` path, an item with a weapon view, a race present).

- [ ] **Step 6: `npm run typecheck && npm run lint` — clean.**

- [ ] **Step 7: Commit**

```bash
git add src/sheets/character/context.ts tests/sheets/character/context.test.ts
git commit -m "feat(sp2): buildCharacterSheetContext — the pure render-context builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: The sheet class + frame + Main tab (registered default)

**Files:**
- Create: `src/sheets/character/sheet.ts`
- Create: `src/sheets/handlebars.ts`
- Modify: `src/sheets/index.ts`
- Modify: `src/system.ts` (add a `setup` hook)
- Create: `templates/actor/character/sheet.hbs`, `main.hbs`
- Create: `templates/actor/character/partials/ability-row.hbs`, `save-row.hbs`, `class-row.hbs`
- Create: `styles/actor/character.scss`; Modify: `styles/system.scss`
- Modify: `lang/en.json`; Modify: `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `buildCharacterSheetContext`, `CharacterSheetInput` (Task 4); `validateItemDrop` (Task 1).
- Produces: `Adnd2eCharacterSheet` (a class); `registerSheetPartials()`.

**Not unit-tested** (spec §9) — verified in Task 9.

- [ ] **Step 1: `src/sheets/handlebars.ts`**

```ts
import { TEMPLATE_PATH } from "../constants";

const PARTIALS = [
  "actor/character/partials/ability-row.hbs",
  "actor/character/partials/save-row.hbs",
  "actor/character/partials/class-row.hbs",
  "actor/character/partials/item-row.hbs",
  "actor/character/partials/slot-table.hbs",
  "actor/character/partials/encumbrance-gauge.hbs",
];

/** Register sheet partials + a couple of helpers. Call from the `setup` hook. */
export async function registerSheetPartials(): Promise<void> {
  const paths: Record<string, string> = {};
  for (const rel of PARTIALS) paths[`adnd2e.${rel.split("/").pop()!.replace(".hbs", "")}`] = TEMPLATE_PATH(rel);
  await foundry.applications.handlebars.loadTemplates(paths);

  Handlebars.registerHelper("adnd2ePct", (v: unknown) => `${Math.round(Number(v) * 100)}%`);
  Handlebars.registerHelper("adnd2eSigned", (v: unknown) => {
    const n = Number(v);
    return n > 0 ? `+${n}` : String(n);
  });
}
```

(Verify the v14 loader path — `foundry.applications.handlebars.loadTemplates` vs `foundry.applications.handlebars.getTemplate`; read `resources/app/client/applications/handlebars.mjs`. If partials are better declared per-PART via the `templates: [...]` key on a PART descriptor, do that instead and drop `loadTemplates` — the AE config uses `templates: ["templates/sheets/active-effect/change.hbs"]`. Prefer the PART `templates` key; keep `registerSheetPartials` only for the two helpers.)

- [ ] **Step 2: `src/sheets/character/sheet.ts`**

```ts
import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { buildCharacterSheetContext } from "./context";
import type { CharacterSheetInput } from "./context-types";
import { validateItemDrop } from "./drop-rules";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const Base = HandlebarsApplicationMixin(
  ActorSheetV2 as unknown as abstract new (...args: never[]) => object,
) as unknown as new (...args: never[]) => {
  actor: Actor.Implementation;
  document: Actor.Implementation;
  isEditable: boolean;
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;
  _preparePartContext(partId: string, ctx: Record<string, unknown>): Promise<Record<string, unknown>>;
  _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown>;
};

const T = (p: string) => TEMPLATE_PATH("actor/character", p);

export class Adnd2eCharacterSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "character"],
    position: { width: 720, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollHp: Adnd2eCharacterSheet.#onRollHp,
      takeAverageHp: Adnd2eCharacterSheet.#onTakeAverageHp,
      awardXp: Adnd2eCharacterSheet.#onAwardXp,
      toggleDualClass: Adnd2eCharacterSheet.#onToggleDualClass,
    },
  };

  static PARTS = {
    header: { template: T("partials/header.hbs") }, // or fold into sheet.hbs; see Step 5
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: T("main.hbs"), scrollable: [""], templates: [T("partials/ability-row.hbs"), T("partials/save-row.hbs"), T("partials/class-row.hbs")] },
    combat: { template: T("combat.hbs"), scrollable: [""] },
    inventory: { template: T("inventory.hbs"), scrollable: [""] },
    skills: { template: T("skills.hbs"), scrollable: [""] },
    spells: { template: T("spells.hbs"), scrollable: [""] },
    features: { template: T("features.hbs"), scrollable: [""] },
    biography: { template: T("biography.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "main",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "combat", icon: "fa-solid fa-shield-halved" },
        { id: "inventory", icon: "fa-solid fa-box-open" },
        { id: "skills", icon: "fa-solid fa-hand-fist" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "features", icon: "fa-solid fa-star" },
        { id: "biography", icon: "fa-solid fa-book" },
      ],
    },
  };

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCharacterSheetContext(this.#buildInput(context));
    context.editable = this.isEditable;
    return context;
  }

  override async _preparePartContext(partId: string, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const ctx = await super._preparePartContext(partId, context);
    const tabs = ctx.tabs as Record<string, unknown> | undefined;
    if (tabs && partId in tabs) ctx.tab = tabs[partId];
    return ctx;
  }

  #buildInput(context: Record<string, unknown>): CharacterSheetInput {
    const actor = this.document as unknown as {
      name: string; img: string; _source: { system: Record<string, unknown> };
      system: Record<string, unknown>; items: Iterable<Item.Implementation>;
    };
    const items = [...actor.items] as unknown as { id: string; name: string; img: string; type: string; system: Record<string, unknown> }[];
    const cfg = (CONFIG as { ADND2E: Record<string, Record<string, string>> }).ADND2E;
    // partition items by type, map each to its *View shape (see context-types.ts),
    // reading item.system.* fields per src/data/item/*.ts. Class items: pull hitDie
    // from getChassis(chassisId).hitDie (import from src/core/classes/chassis).
    // ... (mechanical mapping — one small mapper per item type)
    return {
      name: actor.name,
      img: actor.img,
      source: actor._source as unknown as Record<string, unknown>,
      derived: actor.system as never,
      classItems: /* map */ [],
      raceItem: /* map or null */ null,
      physicalItems: /* map */ [],
      proficiencyItems: { weapon: [], nonweapon: [] },
      spellItems: [],
      featureItems: [],
      config: {
        abilities: cfg.abilities, saves: cfg.saves, alignments: cfg.alignments,
        encumbranceCategories: cfg.encumbranceCategories, classGroups: cfg.classGroups,
        schools: cfg.schools, spheres: cfg.spheres,
      },
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: (this.document as unknown as { isOwner: boolean }).isOwner,
        editable: this.isEditable,
      },
    };
  }

  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const actor = this.document as unknown as { items: Iterable<{ type: string; system: { chassisId?: string } }> };
    const existing = [...actor.items];
    const it = item as unknown as { type: string; system: { chassisId?: string | null } };
    const verdict = validateItemDrop({
      dropType: it.type,
      dropChassisId: it.system?.chassisId ?? null,
      hasRace: existing.some((i) => i.type === "race"),
      existingChassisIds: existing.filter((i) => i.type === "class").map((i) => i.system.chassisId ?? "").filter(Boolean),
    });
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason!));
      return null;
    }
    return super._onDropItem(event, item);
  }

  static async #onRollHp(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> { /* Task 8 */ }
  static async #onTakeAverageHp(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> { /* Task 8 */ }
  static async #onAwardXp(this: Adnd2eCharacterSheet): Promise<void> { /* Task 8 */ }
  static async #onToggleDualClass(this: Adnd2eCharacterSheet): Promise<void> { /* Task 8 */ }
}

Object.defineProperty(Adnd2eCharacterSheet, "name", { value: "Adnd2eCharacterSheet", configurable: true });
```

Verify against `resources/app`: the exact `ActorSheetV2` / `HandlebarsApplicationMixin` access path, whether `_preparePartContext` takes a third `options` arg (scene-config passes 3 — match the real signature), and that `super._onDropItem` exists on `ActorSheetV2` (it does — `actor-sheet.mjs`). If the mixin double-applies `HandlebarsApplicationMixin` (ActorSheetV2 already has it in v14?), check `actor-sheet.mjs` line 17 — it extends `DocumentSheetV2` directly, so the mixin is needed here (same as the SP1 stub over `DocumentSheetV2`). Use the same `as unknown as` cast style as `src/sheets/actor-sheet.ts`.

- [ ] **Step 3: `src/sheets/index.ts`** — register the new sheet as default for `character` + `npc`, demote the raw sheet:

```ts
import { Adnd2eCharacterSheet } from "./character/sheet";
// ... in registerSheets(), replace the Actor registration:
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCharacterSheet, {
    makeDefault: true, types: ["character", "npc"], label: "ADND2E.sheet.title",
  });
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eActorSheet, {
    makeDefault: false, label: "ADND2E.sheets.rawActor",
  });
// Item + ActiveEffect registrations unchanged.
```

(`creature` keeps the raw sheet as default — SP6 gives it a real one. Confirm `DocumentSheetConfig.registerSheet` with `types: ["character","npc"]` + a second no-`types` registration for the raw fallback coexist; per SP1's reading of `#registerSheet`, `types` defaults to all subtypes, so the raw one stays available on every type as non-default. Order: register the specific one first.)

- [ ] **Step 4: `src/system.ts`** — add after the `init` hook:

```ts
Hooks.once("setup", () => {
  void registerSheetPartials();
});
```
and `import { registerSheetPartials } from "./sheets/handlebars";`.

- [ ] **Step 5: `templates/actor/character/sheet.hbs`** — the frame. ApplicationV2 injects each PART; `sheet.hbs` is NOT a wrapper of parts (parts render independently). Instead, make `header` a PART too, or fold the header into `main`. **Decision:** no separate `sheet.hbs`; the frame chrome (portrait, name, class line, quick vitals strip) goes in a `header` PART template `templates/actor/character/header.hbs` with root `<header class="adnd2e-char-header">`. Remove `sheet.hbs` from the file list.

`templates/actor/character/header.hbs`:
```handlebars
<header class="adnd2e-char-header">
  <img class="portrait" src="{{adnd2e.identity.img}}" data-action="editImage" data-edit="img" alt="{{adnd2e.identity.name}}">
  <div class="titles">
    <input type="text" name="name" value="{{adnd2e.identity.name}}" placeholder="{{localize 'ADND2E.sheet.namePlaceholder'}}">
    <div class="class-line">{{adnd2e.identity.classLine}}{{#if adnd2e.identity.arrangementBadge}} <span class="badge">{{adnd2e.identity.arrangementBadge}}</span>{{/if}}</div>
  </div>
  <div class="quick-vitals">
    <span title="{{localize 'ADND2E.sheet.vitals.hp'}}">HP {{adnd2e.vitals.hp.value}}/{{adnd2e.vitals.hp.max}}</span>
    <span title="{{localize 'ADND2E.sheet.vitals.ac'}}">AC {{adnd2e.vitals.ac.normal}}</span>
    <span title="{{localize 'ADND2E.sheet.vitals.thac0'}}">THAC0 {{adnd2e.vitals.thac0.melee}}</span>
  </div>
</header>
```

- [ ] **Step 6: `templates/actor/character/main.hbs`** + the three partials. Root `<section class="tab{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">`. Sections: identity (alignment `<select>` bound to `name="system.details.alignment"` with `{{#each adnd2e … }}` — actually iterate `@root.adnd2e...`; use `{{#each adnd2e.abilities as |row|}}{{> adnd2e.ability-row row=row}}{{/each}}`), abilities, classes (`{{#each adnd2e.classes as |c|}}{{> adnd2e.class-row c=c}}{{/each}}` with the Roll HP button `{{#if c.canLevelUp}}<button type="button" data-action="rollHp" data-class-id="{{c.id}}">…</button>{{/if}}` and an `<input type="number" name="…">` — but class xp lives on the *item*, not the actor, so the xp field can't use `name="system…"`. Handle xp edits via a `change` listener in `_onRender` (Task 8) OR a small `data-action="awardXp"`-style inline. **Decision:** xp is edited only via "Award XP" (Task 8) + the raw item sheet; the Main tab shows xp read-only + the progress bar. Simpler and avoids item-field form binding.), vitals panel (HP `value`/`temp` as `name="system.attributes.hp.value"` etc.; the rest read-only text), saves table via `{{> adnd2e.save-row}}`.

`partials/ability-row.hbs`:
```handlebars
<div class="ability-row" data-ability="{{row.key}}">
  <label>{{localize row.label}}</label>
  <input type="number" name="system.abilities.{{row.key}}.score" value="{{row.score}}">
  {{#if row.racialDelta}}<span class="racial">{{adnd2eSigned row.racialDelta}}</span>{{/if}}
  <span class="effective">{{row.effectiveScore}}</span>
  {{#if row.showExceptional}}<input type="number" name="system.abilities.str.exceptional" value="{{row.exceptional}}" placeholder="%">{{/if}}
  <span class="mods">{{#each row.mods as |m|}}<span title="{{m.label}}">{{m.value}}</span>{{/each}}</span>
</div>
```
(`save-row.hbs`, `class-row.hbs` analogous — simple field rows.)

- [ ] **Step 7: The other five tab templates as minimal stubs** so PARTS resolve — each just `<section class="tab{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}"><p>{{localize 'ADND2E.sheet.tabs.<id>'}}</p></section>`. Tasks 6–7 fill them.

- [ ] **Step 8: `styles/actor/character.scss`** — scaffold: `.adnd2e.sheet.character { .adnd2e-char-header { display: grid; grid-template-columns: 64px 1fr auto; … } .tab { display: none; &.active { display: block; } } .ability-row { display: grid; … } }`. Use `--adnd2e-accent`. `styles/system.scss` — add `@use "actor/character";` (verify `@use` vs `@import` — check if system.scss already uses `@use`; it's flat CSS currently, so `@use "actor/character";` at the top).

- [ ] **Step 9: `lang/en.json`** — add an `ADND2E.sheet` object (sibling of `ADND2E.sheets`, `ADND2E.settings`, etc.):

```json
"sheet": {
  "title": "Character Sheet",
  "namePlaceholder": "Character name",
  "tabs": { "main": "Main", "combat": "Combat", "inventory": "Inventory", "skills": "Skills", "spells": "Spells", "features": "Features", "biography": "Biography" },
  "vitals": { "hp": "Hit Points", "ac": "Armor Class", "thac0": "THAC0", "saves": "Saving Throws", "movement": "Movement" },
  "drop": { "duplicateRace": "This character already has a race.", "duplicateClass": "This character already has that class." },
  "xp": { "award": "Award XP", "awardPrompt": "XP to award (split evenly across classes):", "rollHp": "Roll HP", "takeAverage": "Take Average" },
  "dualClass": { "toggle": "Dual-class", "hint": "Mark these two classes as a dual-class progression" },
  "inventory": { "noContainer": "— (carried)", "capacity": "Capacity", "overCapacity": "Over capacity", "currency": "Currency", "encumbrance": "Encumbrance" },
  "spells": { "wizardSlots": "Wizard Spell Slots", "priestSlots": "Priest Spell Slots", "specialist": "Specialist", "known": "Known Spells", "spellbook": "In spellbook" },
  "skills": { "weapon": "Weapon Proficiencies", "nonweapon": "Non-Weapon Proficiencies", "slots": "{spent} / {total} slots", "checkTarget": "Check target" },
  "features": { "languages": "Languages Known", "resources": "Resources", "racial": "Racial Abilities" },
  "biography": { "gmNotes": "GM Notes" }
}
```

- [ ] **Step 10: `tests/lang/en-coverage.test.ts`** — add a `describe("lang/en.json — SP2 sheet strings")` block asserting the key `ADND2E.sheet.tabs.main`, `ADND2E.sheet.drop.duplicateRace`, `ADND2E.sheet.xp.rollHp`, `ADND2E.sheet.dualClass.toggle` resolve to non-empty strings (reuse the existing `resolve` helper).

- [ ] **Step 11: Full gate** — `typecheck`, `lint`, `test:coverage` (lang test grows; coverage unchanged 100%), `build` (Foundry closed). `grep -c "Adnd2eCharacterSheet" dist/system.js` ≥ 1; `ls dist/templates/actor/character/`.

- [ ] **Step 12: Commit**

```bash
git add src/sheets src/system.ts templates/actor styles lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp2): Adnd2eCharacterSheet — ApplicationV2 shell, tabs, Main tab, registration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 13: DEV-WORLD CHECKPOINT (user, quick)** — `npm run link`, launch v14.364, create a `character`: the new sheet opens as default, 7 tabs, Main tab shows abilities + vitals + class line, editing an ability score persists and re-derives. (This is a lightweight interim check; the full gated check is Task 9. If it fails, fix before Task 6.)

---

## Task 6: Combat, Inventory, Features, Biography tabs

**Files:**
- Create/replace: `templates/actor/character/combat.hbs`, `inventory.hbs`, `features.hbs`, `biography.hbs`
- Create: `templates/actor/character/partials/item-row.hbs`, `encumbrance-gauge.hbs`
- Modify: `styles/actor/character.scss`, `lang/en.json` (any new keys)

**Not unit-tested.** Each template consumes `context.adnd2e.<section>` built in Task 4.

- [ ] **Step 1: `combat.hbs`** — weapons list (`{{#each adnd2e.combat.weapons}}` → name, `{{this.damageNote}}`, `{{this.speedFactor}}`, `{{this.range}}`, equipped toggle `<input type="checkbox" name="…">` — but equipped is an *item* field; use `data-action` + `data-item-id` handled in Task 8, OR render read-only here and toggle from Inventory. **Decision:** equip toggles live only on the Inventory tab; Combat shows equipped state read-only). AC breakdown `{{#each adnd2e.combat.acBreakdown}}`.

- [ ] **Step 2: `partials/item-row.hbs`** — one physical-item row: name, `qty` `<input>` (item field → Task 8 handler via `data-field="quantity" data-item-id`), weight, `location` `<select data-field="location" data-item-id>` populated from `adnd2e.inventory.locationOptions`, equipped checkbox (`data-field="equipped"`), magic badge, identified (GM only).

- [ ] **Step 3: `inventory.hbs`** — `{{#each adnd2e.inventory.containers as |grp|}}` → container header (name, `{{grp.usedWeight}}/{{grp.capacity}}`, `{{#if grp.overCapacity}}` warning) then `{{#each grp.contents}}{{> adnd2e.item-row}}{{/each}}`; then `{{#each adnd2e.inventory.loose}}{{> adnd2e.item-row}}{{/each}}`; then `{{> adnd2e.encumbrance-gauge adnd2e.inventory.encumbrance}}`; then currency `<input>`s (`name="system.currency.pp"` … — actor fields, direct binding).

- [ ] **Step 4: `partials/encumbrance-gauge.hbs`** — carried weight, category label, movement rate, penalties (read-only text + a simple bar via `adnd2ePct` if a ratio is available; else just numbers).

- [ ] **Step 5: `features.hbs`** — `{{#each adnd2e.features.groups}}` (grouped by sourceType) → feature name + description (`{{{item.description}}}` triple-brace HTML) + uses; racial abilities list; languages (`adnd2e.features.languagesMax` + a free-text `<textarea name="system.resources...">`? languages aren't a schema list — spec §6.6 says "free-text list"; there is no `languagesKnown` list field, only `.max`. Render `.max` read-only + note "language list is SP4/free-form" — OR add nothing. **Decision:** show `languagesKnown.max` derived; no editable list in SP2); resources (`reputation`/`henchmen`/`followers` `<input name="system.resources.*">`).

- [ ] **Step 6: `biography.hbs`** — `system.biography` via a prose-mirror/HTML editor element (v14: `<prose-mirror name="system.biography" ...>` — read `resources/app` for the v14 editor element; the AE `details.hbs` uses `{{formGroup fields.description ...}}` which renders the editor. Use `{{formGroup @root.fields.biography value=@root.source.system.biography}}` — `context.fields` is set by DocumentSheetV2). `details.*` text `<input>`s. `details.campaignNotes` editor. `{{#if adnd2e.biography.showGmNotes}}` → `details.gmNotes` editor.

- [ ] **Step 7: SCSS** for the new tabs — lists, the container group styling, the gauge.

- [ ] **Step 8: `lang/en.json`** — add any keys the new templates reference; extend the Task 5 drift-test block if you add a top-level `ADND2E.sheet.*` subtree.

- [ ] **Step 9: Full gate** (`typecheck`, `lint`, `test:coverage`, `build` with Foundry closed).

- [ ] **Step 10: Commit**

```bash
git add templates/actor/character styles/actor/character.scss lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp2): Combat / Inventory / Features / Biography tab templates

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Skills & Spells tabs (display-only shells)

**Files:**
- Create/replace: `templates/actor/character/skills.hbs`, `spells.hbs`
- Create: `templates/actor/character/partials/slot-table.hbs`
- Modify: `styles/actor/character.scss`, `lang/en.json`

**Not unit-tested.** These are display shells SP4/SP5 wire interaction into — **no buttons** beyond drag/drop (which `ActorSheetV2` handles).

- [ ] **Step 1: `partials/slot-table.hbs`** — `{{#each rows as |r|}}<tr><td>{{r.level}}</td><td>{{r.max}}</td><td>{{r.used}}</td></tr>{{/each}}` inside a `<table>`.

- [ ] **Step 2: `skills.hbs`** — weapon prof block: totals (`adnd2e.skills.weapon.total/spent/available`), then `{{#each adnd2e.skills.weapon.items}}` → weaponOrGroup, slotsInvested, `{{#if specialized}}★{{/if}}`. Non-weapon block: totals, then `{{#each adnd2e.skills.nonweapon.items}}` → name, governingAbility label, `{{adnd2eSigned modifier}}`, `checkTarget` (read-only), `{{#if isRacial}}(racial){{/if}}`. No check buttons — a comment in the template: `{{! SP5 wires the check buttons here }}`.

- [ ] **Step 3: `spells.hbs`** — `{{#if adnd2e.spells.wizardSlots}}` → `{{localize 'ADND2E.sheet.spells.wizardSlots'}}` + `{{> adnd2e.slot-table rows=adnd2e.spells.wizardSlots}}` + `{{#if adnd2e.spells.specialistSchoolLabel}}` specialist line. Same for priest. Then `{{localize 'ADND2E.sheet.spells.known'}}` → `{{#each adnd2e.spells.known as |grp|}}` level header + `{{#each grp.items}}` name / schools / castingTime / savingThrow / `{{#if inSpellbook}}📖{{/if}}`. Comment: `{{! SP4 wires memorization + casting here }}`.

- [ ] **Step 4: SCSS** for the two tabs (tables, the known-spell groups).

- [ ] **Step 5: `lang/en.json`** — any new keys; extend drift block if needed.

- [ ] **Step 6: Full gate** (`typecheck`, `lint`, `test:coverage`, `build` Foundry-closed).

- [ ] **Step 7: Commit**

```bash
git add templates/actor/character styles/actor/character.scss lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp2): Skills & Spells tab shells (display-only; SP4/SP5 wire interaction)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Interactions — Roll HP, Award XP, dual-class toggle, item-field edits

**Files:**
- Modify: `src/sheets/character/sheet.ts` (fill the four `#on…` handlers + `_onRender` field listeners)
- Create: `src/sheets/character/hp-roll.ts`
- Modify: `lang/en.json` if new strings

**Interfaces:**
- Produces: `rollHitPoints(classItem, opts): Promise<void>` in `hp-roll.ts`.

**`hp-roll.ts` is a thin Foundry file (uses `Roll`, `ChatMessage`) — not unit-tested.** The pure math (`Math.floor(hitDie / 2) + 1`) is trivial; the value that matters (level from xp, hp max from rolls) is already engine-tested.

- [ ] **Step 1: `src/sheets/character/hp-roll.ts`**

```ts
import { getChassis } from "../../core/classes/chassis";
import type { ClassId } from "../../core/types";

interface ClassItemLike {
  system: { chassisId: ClassId; hpRolls: number[]; canLevelUp?: boolean };
  parent: { name: string; system: { abilities: { con: { mods?: { hpAdjustment?: number } } } } } | null;
  name: string;
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Roll (or take the average of) this class's hit die and append it to `system.hpRolls`. */
export async function rollHitPoints(classItem: ClassItemLike, { average = false } = {}): Promise<void> {
  if (!classItem.system.canLevelUp) return;
  const die = getChassis(classItem.system.chassisId).hitDie;
  let dieResult: number;
  let flavor: string;
  if (average) {
    dieResult = Math.floor(die / 2) + 1;
    flavor = game.i18n!.format("ADND2E.sheet.xp.hpAverageFlavor", { die, result: dieResult });
  } else {
    const roll = await new Roll(`1d${die}`).evaluate();
    dieResult = roll.total ?? 0;
    await roll.toMessage({ flavor: game.i18n!.format("ADND2E.sheet.xp.hpRollFlavor", { die, name: classItem.name }) });
    flavor = "";
  }
  const conAdj = classItem.parent?.system.abilities.con.mods?.hpAdjustment ?? 0;
  if (average || flavor) {
    await ChatMessage.create({ content: flavor || game.i18n!.format("ADND2E.sheet.xp.hpApplied", { result: dieResult, con: conAdj }) });
  }
  await classItem.update({ "system.hpRolls": [...classItem.system.hpRolls, dieResult] });
}
```

(Verify `Roll#evaluate` is async and `.total` in v14; `ChatMessage.create` signature. Read `resources/app/client/dice/roll.mjs` if unsure.)

- [ ] **Step 2: Fill `#onRollHp` / `#onTakeAverageHp`** in `sheet.ts`:

```ts
static async #onRollHp(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
  const id = target.dataset.classId;
  const item = (this.document as unknown as { items: { get(id: string): unknown } }).items.get(id!);
  if (item) await rollHitPoints(item as never, { average: false });
}
// #onTakeAverageHp — same, { average: true }.
```

- [ ] **Step 3: `#onAwardXp`** — `DialogV2.prompt` (read `resources/app/client/applications/api/dialog.mjs` for the v14 API) for an integer; then:

```ts
const classItems = [...this.document.items].filter((i) => i.type === "class");
const share = awardXpSplit(amount, classItems.length);
await Promise.all(classItems.map((c) => c.update({ "system.xp": (c.system.xp ?? 0) + share })));
```
(import `awardXpSplit` from `./xp`.)

- [ ] **Step 4: `#onToggleDualClass`** —

```ts
const classItems = [...this.document.items].filter((i) => i.type === "class");
if (classItems.length !== 2) return;
const anyDual = classItems.some((c) => c.system.dualClassState !== null);
if (anyDual) {
  await Promise.all(classItems.map((c) => c.update({ "system.dualClassState": null })));
} else {
  const [older, newer] = [...classItems].sort((a, b) => (a.system.level ?? 1) - (b.system.level ?? 1));
  await older.update({ "system.dualClassState": "primary" });
  await newer.update({ "system.dualClassState": "active" });
}
```

- [ ] **Step 5: `_onRender` — item-field edit listeners.** For inventory rows with `data-field` + `data-item-id` (`quantity`, `location`, `equipped`):

```ts
override async _onRender(context: unknown, options: unknown): Promise<void> {
  await super._onRender(context, options);
  for (const el of this.element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-item-id][data-field]")) {
    el.addEventListener("change", async () => {
      const item = this.document.items.get(el.dataset.itemId!);
      if (!item) return;
      const field = el.dataset.field!;
      const value = el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked
        : el instanceof HTMLInputElement && el.type === "number" ? Number(el.value)
        : el.value;
      await item.update({ [`system.${field}`]: value });
    });
  }
}
```
(Cast `this.element` / `this.document.items` as needed. Verify `_onRender` signature in `resources/app`.)

- [ ] **Step 6: Wire the buttons in the templates** — Main tab class rows: `<button type="button" data-action="rollHp" data-class-id="{{c.id}}">{{localize 'ADND2E.sheet.xp.rollHp'}}</button>` + `data-action="takeAverageHp"`; identity block: `<button type="button" data-action="awardXp">…</button>`; dual-class: `{{#if adnd2e.dualClassToggle.available}}<button data-action="toggleDualClass">…</button>{{else if adnd2e.dualClassToggle.on}}<button data-action="toggleDualClass">{{localize 'ADND2E.sheet.dualClass.clear'}}</button>{{/if}}`.

- [ ] **Step 7: `lang/en.json`** — add `ADND2E.sheet.xp.hpRollFlavor` (`"1d{die} hit points for {name}"`), `hpAverageFlavor`, `hpApplied` (`"Rolled {result} + {con} CON"`), `ADND2E.sheet.dualClass.clear`.

- [ ] **Step 8: Full gate** (`typecheck`, `lint`, `test:coverage` — pure suites unchanged at 100%, `build` Foundry-closed).

- [ ] **Step 9: Commit**

```bash
git add src/sheets/character templates/actor/character lang/en.json
git commit -m "feat(sp2): sheet interactions — Roll HP, Award XP, dual-class toggle, item-field edits

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: GATED dev-world smoke check

**Files:** none — verification. Runs **before** `finishing-a-development-branch`; the branch does not finish until every check passes or a failure becomes a fix (resume the relevant implementer).

**Why gated:** the sheet layer has no unit tests by design (spec §9). SP1's 1c.3d / 1c.4a merged without their dev-world checks and shipped a world-load crash and an un-installable manifest.

- [ ] **Step 1: Build + link**

```bash
npm run build   # Foundry must be closed
npm run link
```
Launch Foundry v14.364; open or create a test world on this system. Confirm the linked `dist/system.json` version is the local `0.2.0` (not a `-dev.N` release — SP1's FR-W3 lesson: an install-from-manifest can clobber the junction; if so, re-run `npm run link` with Foundry closed).

- [ ] **Step 2 – Step 14:** Run the 13-step checklist from **spec §9** verbatim (create a PC; drop Dwarf → CON delta + saves; drop Fighter → class row, THAC0 20; edit STR inline → live re-derive; set Fighter XP to L6 via the raw item sheet or Award XP → level/THAC0/saves/prof-slots update; Roll HP per owed level → chat messages, hp.max climbs; Award XP single-class full award; drop Mage → multi-class badge, both slot tables, average HP; toggle dual-class on/off → badge switches; drop weapon + armor, equip armor → AC updates; create a container equipment item + nest an item → capacity bar; set `contentsWeightMultiplier` 0 → carried weight drops; drop NWP + spell → list on Skills/Spells, no action buttons; drop a 2nd Dwarf → rejected toast; Biography `gmNotes` visible as GM, absent for non-GM).

- [ ] **Step 3: Record** PASS/FAIL per step into the SDD report / ledger. Any FAIL → resume the relevant implementer (Task 5–8) before the branch finishes. Delete the smoke-test actors/items afterward.

---

## Self-Review

**1. Spec coverage.**
- §1.1 shell-not-automation → Tasks 5–8 build display + management; no roll/cast/check buttons (Tasks 7 comments mark SP4/SP5 seams). ✓
- §3 decisions table: ActorSheetV2+Handlebars (T5), submitOnChange (T5 DEFAULT_OPTIONS), authored↔`_source` (T4 builder + T5/T6 templates bind `name="system…"` and render `context.source`), XP/level (T4 `xpToNext` + T8 Award XP), HP rolling (T8 `hp-roll.ts`), multiclass badge + dual-class toggle (T4 + T8), containers via `equipment.container` + `contentsWeightMultiplier` (T2 + T3), npc served by PC sheet (T5 `types: ["character","npc"]`), stub demoted (T5), 7 tabs (T4 `tabs` + T5 `TABS`/`PARTS`). ✓
- §4 code architecture — every file in the §4 file map has a task. ✓
- §4.1 pure context layer at 100% → Tasks 1–4 + triad edits (T1). ✓
- §4.2 Foundry shell → T5 (class), T8 (actions/drop). ✓
- §4.4 `contentsWeightMultiplier` → T3. ✓
- §6 per-tab content → T5 (Main), T6 (Combat/Inventory/Features/Biography), T7 (Skills/Spells). ✓
- §7 error handling — illegal drop (T1 `validateItemDrop` + T8 `_onDropItem`), Roll-HP guard (T8 `hp-roll.ts` `if (!canLevelUp) return`), over-capacity visual only (T2 `overCapacity` flag, T6 template warning), `_source` vs prepared (T4 builder is the single enforcement point). ✓
- §8 testing — pure suites at 100% (T1–T4), lang drift (T5), no shell unit tests, gated §9 check (T9). ✓
- §9 smoke check → T9 runs it verbatim. ✓
- §10 out-of-scope — no task adds rolls/memorization/initiative/NPC-condensed/Player's-Option; Task 7 templates carry `{{! SP4/SP5 … }}` seam comments. ✓

**2. Placeholder scan.** The Foundry-shell tasks (5–8) contain "map per item type" / "analogous" prose in template steps — these are the *dev-world-verified* layer (spec §9, no unit tests), and every such step names the exact fields (from the item models quoted in "Reference facts") and the exact `context.adnd2e.*` path to bind. The pure tasks (1–4) have complete code + complete tests. `sheet.ts` Step 2 has a `#buildInput` body with a `/* map */` comment — acceptable because the mapping target (`*View` interfaces) is fully specified in Task 1's `context-types.ts` and the source fields are in "Reference facts"; the implementer transcribes, they do not design. No "TBD" / "add error handling" / "similar to Task N" without the referenced code.

**3. Type consistency.** `xpToNext` (T1) returns `{ level, next, toNextLevel, pct }`; `ClassRow` (T1 types) has `xpToNextLevel`/`xpPct`/`nextThreshold` — the builder (T4) maps `toNextLevel → xpToNextLevel`, `pct → xpPct`, `next → nextThreshold`. `validateItemDrop` input `DropCheckInput` (T1) is consumed with exactly those fields in `sheet.ts` `_onDropItem` (T5/T8). `groupInventory` (T2) returns `{ containers, loose }` consumed by `buildInventory` inside `context.ts` (T4). `containerAdjustedCarriedWeight` (T3) `WeightedItem` shape is built in `snapshot.ts` (T3 Step 7). `CharacterSheetContext` (T1) is the return of `buildCharacterSheetContext` (T4) and the shape every template in T5–T7 reads as `context.adnd2e`. `registerSheetPartials` (T5) is imported in `system.ts` (T5 Step 4). `rollHitPoints` (T8) is called by `#onRollHp` (T8 Step 2). Consistent.
