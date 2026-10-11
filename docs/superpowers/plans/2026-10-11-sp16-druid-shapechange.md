# SP16 Druid Shapechanging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A druid of level 7+ can shift into a GM-authored animal form (a tagged Monster NPC actor): spending daily uses with a once-per-category limit, healing 1d6×10% of damage, taking the form's AC, movement and attacks while keeping HP, saves and THAC0; branch kits restrict habitats and frequency; three sample branch kits ship.

**Architecture:** A pure rules module `src/core/shapechange/` (spec resolution from a kit power, form eligibility, shift limits, heal, snapshot, AC/movement overlay, chat card context) in the coverage gate. A new `details.shapechange` group on Monster NPCs tags forms; a new `system.shapechange` state on characters stores uses, categories used today and the snapshot of the current form. `deriveAndCache` applies the snapshot's AC and movement after the normal derive, so every reader of a character's AC sees the form's. Foundry glue (`shapechange-actions.ts`) does the shift, return and daily reset; the PC sheet gets a Shapechange panel, a shifted banner and a form attack panel that reuses the creature attack path.

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, SCSS, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-11-adnd2e-sp16-druid-shapechange-design.md`

## Global Constraints

- Source: PHBR13 (The Complete Druid's Handbook) Druid Characters ch. + branch entries; PH p.37 baseline. **Content policy:** mechanical values only, no rulebook prose; the sample kits are this project's own samples named `Sample …`. The system ships NO animal stat blocks.
- Base spec (PH rule): `minLevel` 7, 3 shifts per day, categories reptile/bird/mammal, once per category per day, no habitat restriction, no giants. A kit power with `id: "shapechange"` overrides via `uses`/`per: "day"` and params `minLevel`, `habitats`, `categories`, `oncePerCategory`, `giant`; a malformed or unknown value falls back to the base value; a non-`day` frequency is ignored.
- Heal: `Math.floor(damageTaken * d6 * 10 / 100)`, never negative, 0 when no damage. Worked example (PHBR13 p.7): damage 15, d6 3 → 4.
- A shifted druid takes the form's AC (all four AC values equal it: no Dexterity, rear-attack or shield variation), land movement and attacks (`name`, `count`, `damage`, `type`); keeps hit points, saves and **THAC0** (the druid's own). Worn gear does not affect AC while shifted.
- The form snapshot is copied at shift time (name, img, category, ac, movement incl. burrow/climb/fly/swim, attacks); there is no live link to the source actor afterwards.
- A Monster NPC is a legal form only if `details.shapechange.category` is one of reptile/bird/mammal. Habitat tags and the giant flag gate it against the druid's resolved spec. Size is the GM's responsibility, not enforced.
- Player-facing form picker lists only world Monster NPCs the current user can at least OBSERVE.
- Shift and return are blocked while `canAct(actor.statuses)` is false (the #142 attack gate). Returning to normal form costs no use. Shifting form-to-form costs a use and heals again.
- New schema fields have initials and need no migration. Arrays/objects in `initial` MUST be functions (shared-literal gotcha: see `kitPowers` in `src/data/actor/base-actor.ts`).
- Dialogs use `themedPrompt` (`src/dialogs/themed-dialog-foundry.ts`), never `DialogV2` directly (a guard test enforces it). The shapechange chat card reuses the existing chat classes (`formula`, `result`, `hint`, `cost`) so the stylesheet census needs no new rule; its template count assertion goes 15 → 16.
- Out of scope: Character NPC druids (panel is PC-sheet only), equipment merging, spell restrictions while shifted, special attacks beyond free text, other branches, Hierophant progression, size enforcement.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Pure shapechange rules

**Files:**
- Create: `src/core/shapechange/rules.ts`
- Create: `src/core/shapechange/index.ts` (`export * from "./rules";`)
- Create: `tests/core/shapechange/rules.test.ts`

(`src/core/**` is already in the coverage include.)

**Interfaces — produces (all exported from `src/core/shapechange/rules.ts`):**
```ts
export const SHAPECHANGE_CATEGORIES = ["reptile", "bird", "mammal"] as const;
export type ShapechangeCategory = (typeof SHAPECHANGE_CATEGORIES)[number];
export const SHAPECHANGE_HABITATS = ["desert","forest","mountains","plains","swamp","arctic","jungle","ocean","underground"] as const;
export interface ShapechangeSpec { minLevel: number; uses: number; categories: ShapechangeCategory[]; oncePerCategory: boolean; habitats: string[]; allowGiant: boolean }
export const BASE_SHAPECHANGE_SPEC: Readonly<ShapechangeSpec>;
export interface PowerLike { id: string; uses: number; per: string; params: { key: string; value: string }[] }
export function resolveShapechangeSpec(power: PowerLike | null | undefined): ShapechangeSpec;
export function shapechangeAvailable(druidLevel: number, spec: ShapechangeSpec): boolean;
export interface FormTags { category: ShapechangeCategory | ""; habitats: readonly string[]; giant: boolean }
export function formEligible(form: FormTags, spec: ShapechangeSpec): boolean;
export interface ShapechangeState { usedToday: number; categoriesUsed: readonly string[] }
export function usesLeft(state: ShapechangeState, spec: ShapechangeSpec): number;
export type ShiftBlock = "noUsesLeft" | "categoryUsed" | "notEligible";
export function canShift(state: ShapechangeState, spec: ShapechangeSpec, form: FormTags): { ok: true } | { ok: false; reason: ShiftBlock };
export function afterShift(state: ShapechangeState, category: ShapechangeCategory): ShapechangeState;
export function afterNewDay(): ShapechangeState;
export function healOnShift(damageTaken: number, d6: number): number;
export interface FormAttack { name: string; count: number; damage: string; type: string }
export interface FormMovement { land: number; burrow: number; climb: number; fly: number; swim: number; flyManeuverability: string }
export interface FormSnapshot { name: string; img: string; category: ShapechangeCategory; ac: number; movement: FormMovement; attacks: FormAttack[] }
export interface FormSource { name: string; img: string; system: { attributes: { ac: { value: number }; movement: Partial<FormMovement> }; attacks: Partial<FormAttack>[]; details: { shapechange: { category: string } } } }
export function snapshotForm(source: FormSource): FormSnapshot | null;   // null when the source category is not reptile/bird/mammal
export function formArmorClass(snapshot: Pick<FormSnapshot, "ac">): { normal: number; rearAttack: number; surprised: number; shieldless: number };
```

- [ ] **Step 1: Write the failing tests**

Create `tests/core/shapechange/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BASE_SHAPECHANGE_SPEC, afterNewDay, afterShift, canShift, formArmorClass, formEligible, healOnShift,
  resolveShapechangeSpec, shapechangeAvailable, snapshotForm, usesLeft, type ShapechangeSpec,
} from "../../../src/core/shapechange";

const base = BASE_SHAPECHANGE_SPEC;
const power = (over: Partial<{ uses: number; per: string; params: { key: string; value: string }[] }> = {}) => ({
  id: "shapechange", uses: 0, per: "day", params: [], ...over,
});

describe("base spec", () => {
  it("is the Player's Handbook rule", () => {
    expect(base).toMatchObject({ minLevel: 7, uses: 3, oncePerCategory: true, habitats: [], allowGiant: false });
    expect([...base.categories]).toEqual(["reptile", "bird", "mammal"]);
  });
});

describe("resolveShapechangeSpec", () => {
  it("falls back to the base spec with no power", () => {
    expect(resolveShapechangeSpec(null)).toEqual(base);
    expect(resolveShapechangeSpec(undefined)).toEqual(base);
  });
  it("reads uses (day only) and params", () => {
    const spec = resolveShapechangeSpec(power({
      uses: 2,
      params: [
        { key: "minLevel", value: "5" }, { key: "habitats", value: " Desert, FOREST ,volcano" },
        { key: "categories", value: "bird, mammal, fish" }, { key: "oncePerCategory", value: "false" }, { key: "giant", value: "true" },
      ],
    }));
    expect(spec).toEqual({ minLevel: 5, uses: 2, categories: ["bird", "mammal"], oncePerCategory: false, habitats: ["desert", "forest"], allowGiant: true });
  });
  it("ignores a non-day frequency and a zero use count", () => {
    expect(resolveShapechangeSpec(power({ uses: 9, per: "week" })).uses).toBe(3);
    expect(resolveShapechangeSpec(power({ uses: 0 })).uses).toBe(3);
  });
  it("falls back on malformed params and ignores a power with another id's params keys", () => {
    const spec = resolveShapechangeSpec(power({ params: [
      { key: "minLevel", value: "zero" }, { key: "categories", value: "fish" }, { key: "habitats", value: "" },
      { key: "oncePerCategory", value: "maybe" }, { key: "giant", value: "yes" }, { key: "other", value: "x" },
    ] }));
    expect(spec).toEqual(base);
  });
  it("rejects a non-positive or fractional minLevel", () => {
    expect(resolveShapechangeSpec(power({ params: [{ key: "minLevel", value: "0" }] })).minLevel).toBe(7);
    expect(resolveShapechangeSpec(power({ params: [{ key: "minLevel", value: "7.5" }] })).minLevel).toBe(7);
  });
  it("does not share arrays with the base spec", () => {
    const spec = resolveShapechangeSpec(null);
    spec.categories.push("bird");
    expect(base.categories).toHaveLength(3);
  });
});

describe("shapechangeAvailable", () => {
  it("needs the spec's level", () => {
    expect(shapechangeAvailable(6, base)).toBe(false);
    expect(shapechangeAvailable(7, base)).toBe(true);
    expect(shapechangeAvailable(0, base)).toBe(false);
  });
});

describe("formEligible", () => {
  const tags = (over = {}) => ({ category: "mammal" as const, habitats: ["forest"], giant: false, ...over });
  it("needs a category the spec allows", () => {
    expect(formEligible(tags({ category: "" }), base)).toBe(false);
    expect(formEligible(tags({ category: "bird" }), { ...base, categories: ["mammal"] })).toBe(false);
    expect(formEligible(tags(), base)).toBe(true);
  });
  it("excludes giants unless allowed", () => {
    expect(formEligible(tags({ giant: true }), base)).toBe(false);
    expect(formEligible(tags({ giant: true }), { ...base, allowGiant: true })).toBe(true);
  });
  it("enforces habitats only when the spec lists some", () => {
    expect(formEligible(tags({ habitats: [] }), base)).toBe(true);
    expect(formEligible(tags({ habitats: ["desert"] }), { ...base, habitats: ["forest"] })).toBe(false);
    expect(formEligible(tags({ habitats: ["desert", "forest"] }), { ...base, habitats: ["forest"] })).toBe(true);
    expect(formEligible(tags({ habitats: [] }), { ...base, habitats: ["forest"] })).toBe(false);
  });
});

describe("limits", () => {
  const state = { usedToday: 0, categoriesUsed: [] as string[] };
  const form = { category: "bird" as const, habitats: [], giant: false };
  it("usesLeft counts down and never goes negative", () => {
    expect(usesLeft(state, base)).toBe(3);
    expect(usesLeft({ usedToday: 5, categoriesUsed: [] }, base)).toBe(0);
  });
  it("blocks with the first applicable reason", () => {
    expect(canShift(state, base, form)).toEqual({ ok: true });
    expect(canShift({ usedToday: 3, categoriesUsed: [] }, base, form)).toEqual({ ok: false, reason: "noUsesLeft" });
    expect(canShift({ usedToday: 1, categoriesUsed: ["bird"] }, base, form)).toEqual({ ok: false, reason: "categoryUsed" });
    expect(canShift(state, base, { ...form, giant: true })).toEqual({ ok: false, reason: "notEligible" });
  });
  it("the same category may repeat when oncePerCategory is off", () => {
    const spec: ShapechangeSpec = { ...base, oncePerCategory: false };
    expect(canShift({ usedToday: 1, categoriesUsed: ["bird"] }, spec, form)).toEqual({ ok: true });
  });
  it("afterShift spends one use and records the category once", () => {
    const s1 = afterShift(state, "bird");
    expect(s1).toEqual({ usedToday: 1, categoriesUsed: ["bird"] });
    expect(afterShift(s1, "bird")).toEqual({ usedToday: 2, categoriesUsed: ["bird"] });
    expect(state).toEqual({ usedToday: 0, categoriesUsed: [] });
  });
  it("afterNewDay clears both counters", () => {
    expect(afterNewDay()).toEqual({ usedToday: 0, categoriesUsed: [] });
  });
});

describe("healOnShift", () => {
  it("matches the handbook's worked example (15 damage, d6 3 -> 4)", () => {
    expect(healOnShift(15, 3)).toBe(4);
  });
  it("is 10% to 60% of the damage, fractions rounded down", () => {
    expect(healOnShift(10, 1)).toBe(1);
    expect(healOnShift(10, 6)).toBe(6);
    expect(healOnShift(7, 1)).toBe(0);
    expect(healOnShift(19, 6)).toBe(11);
  });
  it("is zero with no damage and never negative", () => {
    expect(healOnShift(0, 6)).toBe(0);
    expect(healOnShift(-5, 6)).toBe(0);
  });
});

describe("snapshotForm and formArmorClass", () => {
  const source = {
    name: "Brown Bear", img: "bear.png",
    system: {
      attributes: { ac: { value: 6 }, movement: { land: 12, swim: 6 } },
      attacks: [{ name: "Claw", count: 2, damage: "1d6", type: "melee" }, { name: "Bite", damage: "1d8" }],
      details: { shapechange: { category: "mammal" } },
    },
  };
  it("copies the stat block and fills missing movement and attack fields", () => {
    expect(snapshotForm(source)).toEqual({
      name: "Brown Bear", img: "bear.png", category: "mammal", ac: 6,
      movement: { land: 12, burrow: 0, climb: 0, fly: 0, swim: 6, flyManeuverability: "" },
      attacks: [{ name: "Claw", count: 2, damage: "1d6", type: "melee" }, { name: "Bite", count: 1, damage: "1d8", type: "melee" }],
    });
  });
  it("is null for an untagged source", () => {
    expect(snapshotForm({ ...source, system: { ...source.system, details: { shapechange: { category: "" } } } })).toBeNull();
  });
  it("does not alias the source's attack objects", () => {
    const snap = snapshotForm(source)!;
    snap.attacks[0]!.name = "changed";
    expect(source.system.attacks[0]!.name).toBe("Claw");
  });
  it("the form's AC applies to every AC context", () => {
    expect(formArmorClass({ ac: 6 })).toEqual({ normal: 6, rearAttack: 6, surprised: 6, shieldless: 6 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/shapechange/rules.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/core/shapechange/rules.ts`:

```ts
// Druid shapechanging (SP16, #84), pure and Foundry-free. Source: The Complete Druid's Handbook (PHBR13) Druid
// Characters ch. and branch entries; PH p.37 baseline. Mechanical values only. The system ships no animal stat blocks:
// a form is a GM-authored Monster NPC tagged with `details.shapechange`, snapshotted onto the druid at shift time.

export const SHAPECHANGE_CATEGORIES = ["reptile", "bird", "mammal"] as const;
export type ShapechangeCategory = (typeof SHAPECHANGE_CATEGORIES)[number];

export const SHAPECHANGE_HABITATS = [
  "desert", "forest", "mountains", "plains", "swamp", "arctic", "jungle", "ocean", "underground",
] as const;

export interface ShapechangeSpec {
  minLevel: number;
  /** shifts per day */
  uses: number;
  categories: ShapechangeCategory[];
  /** each category (reptile, bird, mammal) may be used once per day */
  oncePerCategory: boolean;
  /** empty = no habitat restriction */
  habitats: string[];
  allowGiant: boolean;
}

/** The Player's Handbook rule: 3 a day from 7th level, each category once, any habitat, no giant forms. */
export const BASE_SHAPECHANGE_SPEC: Readonly<ShapechangeSpec> = {
  minLevel: 7,
  uses: 3,
  categories: [...SHAPECHANGE_CATEGORIES],
  oncePerCategory: true,
  habitats: [],
  allowGiant: false,
};

export interface PowerLike {
  id: string;
  uses: number;
  per: string;
  params: { key: string; value: string }[];
}

const csv = (value: string): string[] => value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** The kit's `shapechange` power read leniently: anything malformed or unknown falls back to the base value. */
export function resolveShapechangeSpec(power: PowerLike | null | undefined): ShapechangeSpec {
  const spec: ShapechangeSpec = { ...BASE_SHAPECHANGE_SPEC, categories: [...BASE_SHAPECHANGE_SPEC.categories], habitats: [] };
  if (!power) return spec;
  if (power.per === "day" && power.uses > 0) spec.uses = power.uses;
  const param = (key: string) => power.params.find((p) => p.key === key)?.value;
  const minLevel = Number(param("minLevel"));
  if (Number.isInteger(minLevel) && minLevel > 0) spec.minLevel = minLevel;
  const categories = csv(param("categories") ?? "").filter((c): c is ShapechangeCategory =>
    (SHAPECHANGE_CATEGORIES as readonly string[]).includes(c));
  if (categories.length) spec.categories = categories;
  const habitats = csv(param("habitats") ?? "").filter((h) => (SHAPECHANGE_HABITATS as readonly string[]).includes(h));
  if (habitats.length) spec.habitats = habitats;
  if (param("oncePerCategory") === "false") spec.oncePerCategory = false;
  if (param("giant") === "true") spec.allowGiant = true;
  return spec;
}

export function shapechangeAvailable(druidLevel: number, spec: ShapechangeSpec): boolean {
  return druidLevel >= spec.minLevel;
}

export interface FormTags {
  category: ShapechangeCategory | "";
  habitats: readonly string[];
  giant: boolean;
}

export function formEligible(form: FormTags, spec: ShapechangeSpec): boolean {
  if (form.category === "" || !spec.categories.includes(form.category)) return false;
  if (form.giant && !spec.allowGiant) return false;
  if (spec.habitats.length > 0 && !form.habitats.some((h) => spec.habitats.includes(h))) return false;
  return true;
}

export interface ShapechangeState {
  usedToday: number;
  categoriesUsed: readonly string[];
}

export function usesLeft(state: ShapechangeState, spec: ShapechangeSpec): number {
  return Math.max(0, spec.uses - state.usedToday);
}

export type ShiftBlock = "noUsesLeft" | "categoryUsed" | "notEligible";

export function canShift(
  state: ShapechangeState,
  spec: ShapechangeSpec,
  form: FormTags,
): { ok: true } | { ok: false; reason: ShiftBlock } {
  if (!formEligible(form, spec)) return { ok: false, reason: "notEligible" };
  if (usesLeft(state, spec) === 0) return { ok: false, reason: "noUsesLeft" };
  if (spec.oncePerCategory && form.category !== "" && state.categoriesUsed.includes(form.category)) {
    return { ok: false, reason: "categoryUsed" };
  }
  return { ok: true };
}

export function afterShift(state: ShapechangeState, category: ShapechangeCategory): ShapechangeState {
  return {
    usedToday: state.usedToday + 1,
    categoriesUsed: state.categoriesUsed.includes(category) ? [...state.categoriesUsed] : [...state.categoriesUsed, category],
  };
}

export function afterNewDay(): ShapechangeState {
  return { usedToday: 0, categoriesUsed: [] };
}

/** Assuming a new form heals 1d6 x 10% of the damage taken, fractions rounded down (PHBR13 p.7's worked example: 15, 3 -> 4). */
export function healOnShift(damageTaken: number, d6: number): number {
  return Math.max(0, Math.floor((damageTaken * d6 * 10) / 100));
}

export interface FormAttack {
  name: string;
  count: number;
  damage: string;
  type: string;
}

export interface FormMovement {
  land: number;
  burrow: number;
  climb: number;
  fly: number;
  swim: number;
  flyManeuverability: string;
}

export interface FormSnapshot {
  name: string;
  img: string;
  category: ShapechangeCategory;
  ac: number;
  movement: FormMovement;
  attacks: FormAttack[];
}

export interface FormSource {
  name: string;
  img: string;
  system: {
    attributes: { ac: { value: number }; movement: Partial<FormMovement> };
    attacks: Partial<FormAttack>[];
    details: { shapechange: { category: string } };
  };
}

/** The stat block as copied onto the druid at shift time; null when the source is not tagged as a form. */
export function snapshotForm(source: FormSource): FormSnapshot | null {
  const category = source.system.details.shapechange.category;
  if (!(SHAPECHANGE_CATEGORIES as readonly string[]).includes(category)) return null;
  const m = source.system.attributes.movement;
  return {
    name: source.name,
    img: source.img,
    category: category as ShapechangeCategory,
    ac: source.system.attributes.ac.value,
    movement: {
      land: m.land ?? 0, burrow: m.burrow ?? 0, climb: m.climb ?? 0, fly: m.fly ?? 0, swim: m.swim ?? 0,
      flyManeuverability: m.flyManeuverability ?? "",
    },
    attacks: source.system.attacks.map((a) => ({
      name: a.name ?? "", count: a.count ?? 1, damage: a.damage ?? "", type: a.type ?? "melee",
    })),
  };
}

/** While shifted every AC context is the form's AC (no Dexterity, rear-attack or shield variation). */
export function formArmorClass(snapshot: Pick<FormSnapshot, "ac">): {
  normal: number; rearAttack: number; surprised: number; shieldless: number;
} {
  return { normal: snapshot.ac, rearAttack: snapshot.ac, surprised: snapshot.ac, shieldless: snapshot.ac };
}
```

- [ ] **Step 4: Run to verify pass, then gates and commit**

Run: `npx vitest run tests/core/shapechange && npm run typecheck && npm run lint && npm run test:coverage`
Expected: PASS; 100% statements.

```bash
git add src/core/shapechange tests/core/shapechange
git commit -m "feat(shapechange): pure druid shapechange rules (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema fields, constants copy, and the derive overlay

**Files:**
- Modify: `src/data/actor/creature.ts` (add `details.shapechange`)
- Modify: `src/data/actor/base-actor.ts` (add `shapechange` to the common schema near `kitPowers`; apply the overlay at the end of `deriveAndCache`; extend `DerivedWriteSurface`)
- Create: `src/data/derive/character/shapechange.ts` (pure overlay helper)
- Create: `tests/data/derive/shapechange.test.ts`
- Modify: `src/config.ts` + `lang/en.json` + `tests/config/build-config.test.ts` (label maps `shapechangeCategories`, `habitats`)

**Interfaces:**
- Consumes: Task 1 (`SHAPECHANGE_CATEGORIES`, `SHAPECHANGE_HABITATS`, `FormSnapshot`, `formArmorClass`).
- Produces:
  - `details.shapechange` on creature actors: `{ category: "" | "reptile" | "bird" | "mammal", habitats: string[], giant: boolean }`.
  - `system.shapechange` on every actor common schema (used by characters): `{ usedToday: number, categoriesUsed: string[], form: null | { name, img, category, ac, movement:{land,burrow,climb,fly,swim,flyManeuverability}, attacks:[{name,count,damage,type}] } }`.
  - `applyShapechangeOverlay(derived, form)` in `src/data/derive/character/shapechange.ts`: returns `{ ac, movement }` where, with a non-null form, `ac` is `formArmorClass(form)` and `movement.current` is `form.movement.land`; with a null form both are returned unchanged.
  - `CONFIG.ADND2E.shapechangeCategories` and `CONFIG.ADND2E.habitats` label maps (`ADND2E.shapechangeCategories.<v>`, `ADND2E.habitats.<v>`).

Read `src/data/actor/creature.ts` (the `details` SchemaField with `types`/`turning`), `src/data/actor/base-actor.ts` (`kitPowers` and `psionics` for the `initial: () => …` pattern; `deriveAndCache` and `DerivedWriteSurface`), `src/config.ts` (the `monsterTypes` and `schools` maps) and `tests/config/build-config.test.ts` (key list and `assertLabelMap` calls) first.

- [ ] **Step 1: Write the failing tests**

Create `tests/data/derive/shapechange.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyShapechangeOverlay } from "../../../src/data/derive/character/shapechange";

const derived = {
  ac: { normal: 4, rearAttack: 8, surprised: 6, shieldless: 6 },
  movement: { base: 12, current: 9, encumbranceCategory: "light" },
};
const form = {
  name: "Wolf", img: "w.png", category: "mammal" as const, ac: 7,
  movement: { land: 18, burrow: 0, climb: 0, fly: 0, swim: 0, flyManeuverability: "" },
  attacks: [{ name: "Bite", count: 1, damage: "1d4+1", type: "melee" }],
};

describe("applyShapechangeOverlay", () => {
  it("returns the derived values untouched in normal form", () => {
    expect(applyShapechangeOverlay(derived, null)).toEqual(derived);
  });
  it("substitutes the form's AC for every context and its land movement for the current rate", () => {
    const out = applyShapechangeOverlay(derived, form);
    expect(out.ac).toEqual({ normal: 7, rearAttack: 7, surprised: 7, shieldless: 7 });
    expect(out.movement).toEqual({ base: 12, current: 18, encumbranceCategory: "light" });
  });
  it("does not mutate its input", () => {
    applyShapechangeOverlay(derived, form);
    expect(derived.ac.normal).toBe(4);
    expect(derived.movement.current).toBe(9);
  });
});
```

Extend `tests/config/build-config.test.ts`: add `"habitats", "shapechangeCategories"` to the expected-keys list (keep its ordering convention) and `assertLabelMap(cfg.habitats); assertLabelMap(cfg.shapechangeCategories);` beside the other `assertLabelMap` calls. Run: `npx vitest run tests/data/derive/shapechange.test.ts tests/config` → FAIL.

- [ ] **Step 2: The overlay helper**

Create `src/data/derive/character/shapechange.ts`:

```ts
// The druid's shapechange overlay on the derived character data (SP16, #84). Pure. The form snapshot lives on the actor
// (system.shapechange.form, copied at shift time); while it is set, AC and the current movement rate come from the form,
// so every reader of system.attributes.ac / .movement (targeting, wrestling, the sheet) sees the shifted values.
import { formArmorClass, type FormSnapshot } from "../../../core/shapechange";

export interface OverlayInput {
  ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
  movement: { base: number; current: number; encumbranceCategory: string };
}

export function applyShapechangeOverlay(derived: OverlayInput, form: FormSnapshot | null): OverlayInput {
  if (!form) return derived;
  return {
    ac: formArmorClass(form),
    movement: { ...derived.movement, current: form.movement.land },
  };
}
```

- [ ] **Step 3: Schema fields**

In `src/data/actor/creature.ts`, in `details: new SchemaField({ … })` after `turning`, add:

```ts
        /** SP16: a GM-authored Monster NPC becomes a druid shapechange FORM by setting a category (blank = not a form). Size is the GM's responsibility. */
        shapechange: new SchemaField({
          category: new StringField({ required: true, blank: true, initial: "", choices: ["", ...SHAPECHANGE_CATEGORIES] }),
          habitats: new ArrayField(new StringField({ required: true, blank: false, choices: SHAPECHANGE_HABITATS }), { required: true, initial: () => [] }),
          giant: new BooleanField({ required: true, initial: false }),
        }),
```
importing `SHAPECHANGE_CATEGORIES`, `SHAPECHANGE_HABITATS` from `../../core/shapechange` and `BooleanField` from the fields destructure if not already there.

In `src/data/actor/base-actor.ts` `actorCommonSchema` after `kitPowers`, add:

```ts
    /** SP16 druid shapechanging: shifts used today, the categories used today, and the CURRENT FORM snapshot (null in normal form; copied from a tagged Monster NPC at shift time, never a live link). PERSISTED; only the shift, return and new-day actions write it. `categoriesUsed` initial MUST be a function (shared-literal gotcha, see kitPowers). */
    shapechange: new SchemaField({
      usedToday: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      categoriesUsed: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: () => [] }),
      form: new SchemaField(
        {
          name: new StringField({ required: true, blank: true, initial: "" }),
          img: new StringField({ required: true, blank: true, initial: "" }),
          category: new StringField({ required: true, blank: false, initial: "mammal", choices: SHAPECHANGE_CATEGORIES }),
          ac: new NumberField({ required: true, integer: true, initial: 10 }),
          movement: new SchemaField({
            land: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            burrow: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            climb: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            fly: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            swim: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            flyManeuverability: new StringField({ required: true, blank: true, initial: "" }),
          }),
          attacks: new ArrayField(
            new SchemaField({
              name: new StringField({ required: true, blank: true, initial: "" }),
              count: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
              damage: new StringField({ required: true, blank: true, initial: "" }),
              type: new StringField({ required: true, blank: true, initial: "melee" }),
            }),
            { required: true, initial: () => [] },
          ),
        },
        { required: true, nullable: true, initial: null },
      ),
    }),
```
(imports for `SHAPECHANGE_CATEGORIES` from `../../core/shapechange`; reuse the file's existing field-class destructure.) Then in `deriveAndCache`, extend `DerivedWriteSurface` with `shapechange: { form: FormSnapshot | null }` (import the type) and, immediately after the `sys.attributes.movement = { … }` assignment, add:

```ts
  // SP16: a shapechanged druid takes the form's AC and land movement; HP, saves and THAC0 are the druid's own.
  const overlaid = applyShapechangeOverlay(
    { ac: derived.ac, movement: sys.attributes.movement as OverlayInput["movement"] },
    sys.shapechange.form,
  );
  sys.attributes.ac = overlaid.ac;
  sys.attributes.movement = overlaid.movement;
```
(import `applyShapechangeOverlay`, `OverlayInput` from `../derive/character/shapechange`.) Note `sys.shapechange.form` is a plain object or null at prepare time; check what Foundry exposes for a nullable SchemaField (null when unset).

- [ ] **Step 4: Label maps and copy**

In `src/config.ts` add to the interface and builder: `readonly shapechangeCategories: LabelMap<ShapechangeCategory>; readonly habitats: LabelMap<(typeof SHAPECHANGE_HABITATS)[number]>;` with literals `{ reptile: "ADND2E.shapechangeCategories.reptile", bird: …, mammal: … }` and `{ desert: "ADND2E.habitats.desert", forest: …, mountains: …, plains: …, swamp: …, arctic: …, jungle: …, ocean: …, underground: … }`. In `lang/en.json` beside `ADND2E.monsterTypes` add `"shapechangeCategories": { "reptile": "Reptile", "bird": "Bird", "mammal": "Mammal" }` and `"habitats": { "desert": "Desert", "forest": "Forest", "mountains": "Mountains", "plains": "Plains", "swamp": "Swamp", "arctic": "Arctic", "jungle": "Jungle", "ocean": "Ocean", "underground": "Underground" }`. Preserve line endings; confirm the JSON parses.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: all green; 100% statements.

```bash
git add src/data/actor/creature.ts src/data/actor/base-actor.ts src/data/derive/character/shapechange.ts tests/data/derive/shapechange.test.ts src/config.ts lang/en.json tests/config/build-config.test.ts
git commit -m "feat(shapechange): form tags, druid state and the derive overlay (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Chat card and Foundry glue (shift, return, new day)

**Files:**
- Create: `src/core/shapechange/card.ts` + `tests/core/shapechange/card.test.ts` (pure card context); re-export from `src/core/shapechange/index.ts`
- Create: `templates/chat/shapechange-use.hbs`
- Create: `src/sheets/character/shapechange-actions.ts`
- Modify: `tests/styles/chat-classes.test.ts` (template count 15 → 16 and its title)
- Modify: `lang/en.json` (`ADND2E.chat.shapechange.*`, `ADND2E.sheet.shapechange.*`)

**Interfaces:**
- Consumes: Task 1 rules; Task 2 schema.
- Produces (pure, `src/core/shapechange/card.ts`):
  ```ts
  export interface ShapechangeCardInput { actorName: string; actorImg: string; formName: string; d6: number; healed: number; usesLeft: number; usesMax: number; returning: boolean }
  export interface ShapechangeCardContext extends ShapechangeCardInput { headlineKey: string }  // "ADND2E.chat.shapechange.shift" | ".return"
  export function buildShapechangeCardContext(input: ShapechangeCardInput): ShapechangeCardContext;
  ```
- Produces (glue, `src/sheets/character/shapechange-actions.ts`, structural `ShapechangeActor` type with `name, img, statuses, items, system.{ classes, attributes.hp, shapechange }`, `update`, `uuid`):
  - `shapechangeView(actor): ShapechangeView` — `{ visible, level, usesLeft, usesMax, categoriesUsed, form (snapshot|null), canAct }` for the sheet (uses `activeKitEntries`, `resolveShapechangeSpec`, the druid class level).
  - `eligibleForms(actor, game): { id, name, img, category, blocked: ShiftBlock | null }[]` — world Monster NPCs the current user can observe whose `details.shapechange.category` is set; `blocked` from `canShift`.
  - `shiftToForm(actor, formActorId): Promise<void>` — checks `canAct`, spec and `canShift`; rolls `1d6`; computes `healOnShift(max - value, d6)`; ONE `actor.update` that writes `system.shapechange.{usedToday,categoriesUsed,form}` and `system.attributes.hp.value` (capped at max); posts the chat card.
  - `returnToNormal(actor): Promise<void>` — sets `system.shapechange.form` to null (use `null`, not deletion); no use cost; posts a short card with `returning: true`.
  - `resetShapechangeDay(actor): Promise<void>` — writes `usedToday: 0, categoriesUsed: []` (leaves the form).
  - `promptShift(actor): Promise<void>` — opens the form picker with `themedPrompt` (a `<select name="form">` of eligible forms; blocked ones are `disabled` with the reason text) and calls `shiftToForm` for the choice.

- [ ] **Step 1: Write the failing card test**

Create `tests/core/shapechange/card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildShapechangeCardContext } from "../../../src/core/shapechange";

const input = { actorName: "Rowan", actorImg: "r.png", formName: "Brown Bear", d6: 3, healed: 4, usesLeft: 2, usesMax: 3, returning: false };

describe("buildShapechangeCardContext", () => {
  it("passes the fields through and names the shift headline", () => {
    expect(buildShapechangeCardContext(input)).toEqual({ ...input, headlineKey: "ADND2E.chat.shapechange.shift" });
  });
  it("names the return headline when returning to normal form", () => {
    expect(buildShapechangeCardContext({ ...input, returning: true }).headlineKey).toBe("ADND2E.chat.shapechange.return");
  });
});
```
Run `npx vitest run tests/core/shapechange/card.test.ts` → FAIL.

- [ ] **Step 2: The pure card builder**

Create `src/core/shapechange/card.ts`:

```ts
// Chat-card context for a shapechange (SP16). Pure.
export interface ShapechangeCardInput {
  actorName: string;
  actorImg: string;
  formName: string;
  d6: number;
  healed: number;
  usesLeft: number;
  usesMax: number;
  returning: boolean;
}

export interface ShapechangeCardContext extends ShapechangeCardInput {
  headlineKey: string;
}

export function buildShapechangeCardContext(input: ShapechangeCardInput): ShapechangeCardContext {
  return { ...input, headlineKey: input.returning ? "ADND2E.chat.shapechange.return" : "ADND2E.chat.shapechange.shift" };
}
```
Add `export * from "./card";` to `src/core/shapechange/index.ts`.

- [ ] **Step 3: The chat template**

Create `templates/chat/shapechange-use.hbs` (reuses only the existing chat classes so the stylesheet census needs no new rule):

```hbs
<div class="adnd2e chat-card shapechange-use">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{localize headlineKey}}: {{formName}}</h3>
  </header>
  {{#unless returning}}
    <p class="formula">1d6 = <strong>{{d6}}</strong></p>
    <p class="result">{{localize 'ADND2E.chat.shapechange.healed' amount=healed}}</p>
    <p class="cost">{{localize 'ADND2E.chat.shapechange.usesLeft' left=usesLeft max=usesMax}}</p>
    <p class="hint">{{localize 'ADND2E.chat.shapechange.takesARound'}}</p>
  {{else}}
    <p class="hint">{{localize 'ADND2E.chat.shapechange.backToNormal'}}</p>
  {{/unless}}
</div>
```
In `tests/styles/chat-classes.test.ts` change the template count assertion and its title from 15 to 16 ("finds all sixteen chat templates").

- [ ] **Step 4: Copy**

In `lang/en.json` add (matching nesting; parse-check afterwards): under `ADND2E.chat` a `shapechange` object: `"shift": "Shapechange"`, `"return": "Returns to normal form"`, `"healed": "Heals {amount} hit points"`, `"usesLeft": "Shapechanges left today: {left} / {max}"`, `"takesARound": "The change takes one round; the druid can take no other action."`, `"backToNormal": "Resumes normal shape."`. Under `ADND2E.sheet` a `shapechange` object: `"title": "Shapechange"`, `"usesLeft": "Left today: {left} / {max}"`, `"categoriesUsed": "Forms used today"`, `"shift": "Shift…"`, `"shiftTitle": "Shapechange"`, `"pick": "Choose a form"`, `"noForms": "No eligible forms. The GM tags Monster NPCs as shapechange forms and gives players Observer permission."`, `"returnToNormal": "Return to normal form"`, `"newDay": "New day"`, `"shifted": "Shapechanged: {name}"`, `"blocked": { "noUsesLeft": "no uses left", "categoryUsed": "category already used today", "notEligible": "not allowed for this druid" }`, `"formAttacks": "Form attacks"`, `"rollFormAttack": "Roll attack"`, `"cannotAct": "This druid cannot act and cannot change shape right now."`.

- [ ] **Step 5: The glue**

Create `src/sheets/character/shapechange-actions.ts` following `src/sheets/character/kit-power-actions.ts` (read it first: `usePower`'s card posting with `TEMPLATE_PATH` and `ChatMessage.create`, `activeKitEntries`, `classLevelOf`) and `src/sheets/character/recover-dialog.ts` / `free-magick-dialog.ts` (the `themedPrompt` dialog pattern) for the dialog. Implement the functions listed under Interfaces. Requirements:
- The druid level is `system.classes.find((c) => c.chassisId === "druid")?.level ?? 0`; the spec is `resolveShapechangeSpec(<the "shapechange" power of the first active kit with chassisId "druid">)`; `visible` = level>0 && `shapechangeAvailable`.
- `shiftToForm` re-validates everything server-side-of-the-click (druid level, `canAct(actor.statuses)` from `src/combat/condition-effects.ts`, `canShift`, the source actor still tagged) and warns with `ADND2E.sheet.shapechange.cannotAct` / `…blocked.<reason>` when refused. The d6 is `new Roll("1d6").evaluate()`; the heal is `healOnShift(Math.max(0, hp.max - hp.value), d6)`; hit points are capped at `hp.max`.
- `snapshotForm(source)` is fed the source actor's data (`name`, `img`, `system`); a null snapshot refuses the shift.
- All writes go through the acting actor's own `update` so a non-GM owner can shift; reading the form actor needs only `game.actors` + `testUserPermission(game.user, "OBSERVER")`.
- The picker uses `themedPrompt`; do not reference `DialogV2` (the guard test).
- Post the chat message with `buildShapechangeCardContext` + `renderTemplate(TEMPLATE_PATH("chat/shapechange-use.hbs"), …)` + `ChatMessage.create`.

This glue is Foundry-coupled and outside the coverage gate; it is verified by typecheck, lint and the headless proof/manual checklist in Task 7.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add src/core/shapechange src/sheets/character/shapechange-actions.ts templates/chat/shapechange-use.hbs tests/core/shapechange/card.test.ts tests/styles/chat-classes.test.ts lang/en.json
git commit -m "feat(shapechange): shift, return and new-day actions and the chat card (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: PC sheet — Shapechange panel, banner, form attacks

**Files:**
- Modify: `src/sheets/character/sheet.ts` (context key `shapechange`; five actions `shapechangeShift`, `shapechangeReturn`, `shapechangeNewDay`, `rollFormAttack`; new-day kit action also resets shapechange)
- Modify: `src/sheets/character/context-types.ts` only if the view type belongs there
- Modify: `templates/actor/pc/partials/pc-feature-panels.hbs` (the Shapechange panel on the Features tab)
- Modify: `templates/actor/pc/header.hbs` (the shifted banner)
- Modify: `templates/actor/pc/partials/pc-main-panels.hbs` (replace the weapon list with the form's attacks while shifted)
- Modify: `src/sheets/creature/combat-rolls.ts` (export `rollFormAttack`)
- Modify: `styles/actor/pc.scss` if the banner/panel need rules (use existing tokens)
- Test: `tests/templates/shapechange-bindings.test.ts`

**Interfaces:**
- Consumes: Task 3 `shapechangeView`, `promptShift`, `returnToNormal`, `resetShapechangeDay`; Task 1 snapshot type.
- Produces: `rollFormAttack(actor, attackIndex)` exported from `src/sheets/creature/combat-rolls.ts`: reads `actor.system.shapechange.form.attacks[attackIndex]` and calls the existing private `rollCreatureAttack(actor, { name, thac0: <the druid's melee THAC0, or ranged for type "ranged">, weaponMagicBonus: 0, damageFormula: () => attack.damage, damageType: null, weaponItem: null })`. The druid's THAC0 is `actor.system.attributes.thac0.melee` / `.ranged` (see how the PC `rollAttack` reads it in `src/sheets/character/combat-rolls.ts`).

Read `src/sheets/character/sheet.ts` (`_prepareContext`, `DEFAULT_OPTIONS.actions`, the kits context and `#onNewDayKitPowers`), `templates/actor/pc/partials/pc-feature-panels.hbs` (the turning and kits panels as the model), `pc-main-panels.hbs` (the weapons section, `pcActions` gating), `src/sheets/creature/combat-rolls.ts` (`rollAttack`, `AttackSource`, `rollCreatureAttack`), and `tests/templates/pc-sheet-bindings.test.ts` first.

- [ ] **Step 1: Write the failing binding test**

Create `tests/templates/shapechange-bindings.test.ts` (same readFileSync pattern as `tests/templates/effects-bindings.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const FEATURES = read("templates", "actor", "pc", "partials", "pc-feature-panels.hbs");
const HEADER = read("templates", "actor", "pc", "header.hbs");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const ACTIONS = ["shapechangeShift", "shapechangeReturn", "shapechangeNewDay", "rollFormAttack"];

describe("shapechange sheet bindings (SP16)", () => {
  it("the Features panel is PC-only and offers shift, return and new day", () => {
    expect(FEATURES).toContain("shapechange");
    expect(FEATURES).toContain('data-action="shapechangeShift"');
    expect(FEATURES).toContain('data-action="shapechangeNewDay"');
    expect(FEATURES).toMatch(/pcActions/);
  });
  it("the header shows the shifted banner with a return button", () => {
    expect(HEADER).toContain('data-action="shapechangeReturn"');
  });
  it("the main panel lists form attacks while shifted", () => {
    expect(MAIN).toContain('data-action="rollFormAttack"');
  });
  for (const action of ACTIONS) {
    it(`the PC sheet registers ${action}`, () => {
      expect(SHEET).toMatch(new RegExp(`^\\s+${action}: Adnd2eCharacterSheet\\.#on`, "m"));
    });
  }
});
```
Run: `npx vitest run tests/templates/shapechange-bindings.test.ts` → FAIL.

- [ ] **Step 2: The sheet context and actions**

In `src/sheets/character/sheet.ts`: import from `./shapechange-actions` (`shapechangeView`, `promptShift`, `returnToNormal`, `resetShapechangeDay`) and `rollFormAttack` from `../creature/combat-rolls`; in `_prepareContext` set `context.shapechange = shapechangeView(this.document as never);` (only meaningful for the PC; the Character NPC sheet is out of scope, so do not set it in `src/sheets/npc/sheet.ts`). Register the four actions in `DEFAULT_OPTIONS.actions` with private static handlers, each gated on `this.isEditable` (the attack handler reads `data-index`): `#onShapechangeShift` → `promptShift(this.document)`, `#onShapechangeReturn` → `returnToNormal`, `#onShapechangeNewDay` → `resetShapechangeDay`, `#onRollFormAttack` → `rollFormAttack(this.document, Number(target.dataset.index))`. Extend `#onNewDayKitPowers` to also `await resetShapechangeDay(this.document as never)` after `resetKitPowers`.

- [ ] **Step 3: Templates**

Features panel (a new `kit-panel` in `pc-feature-panels.hbs` after the turning panel, shown `{{#if @root.pcActions}}{{#if @root.shapechange.visible}}…`): bar title `ADND2E.sheet.shapechange.title`; body shows `usesLeft` / `usesMax`, the used categories (localized via the `adnd2eLabel` helper with map `shapechangeCategories`), a "Shift…" button (`data-action="shapechangeShift"`, disabled when `!shapechange.canAct` or no uses left) and a "New day" button (`data-action="shapechangeNewDay"`), plus a "Return to normal form" button when `shapechange.form` is set.

Header banner: in `header.hbs` after the class line, `{{#if @root.pcActions}}{{#if @root.shapechange.form}}<div class="shapechange-banner">…{{localize 'ADND2E.sheet.shapechange.shifted' name=@root.shapechange.form.name}} <button type="button" class="kit-small" data-action="shapechangeReturn">{{localize 'ADND2E.sheet.shapechange.returnToNormal'}}</button></div>{{/if}}{{/if}}`.

Main panel (`pc-main-panels.hbs`): when `@root.shapechange.form` is set render, instead of the `adnd2e.combat.weapons` loop, a "Form attacks" list: each `{{#each @root.shapechange.form.attacks}}` row shows the name, count, damage and a `rollFormAttack` button with `data-index="{{@index}}"`; else the existing weapon list unchanged. Keep every existing weapon binding intact (the existing `pc-sheet-bindings` test must still pass).

Styles: a small `.shapechange-banner` rule in `styles/actor/pc.scss` using existing kit tokens (a maroon-bordered bar, `--kit-accent-ink` text).

- [ ] **Step 3: `rollFormAttack`**

In `src/sheets/creature/combat-rolls.ts` add (read how `rollAttack` builds its source and how `rollCreatureAttack` types its actor — it needs `name`, `img`, `statuses`; a character actor satisfies it structurally, cast as the file does elsewhere):

```ts
/** SP16: a shapechanged druid attacks with the FORM's attack (its damage and count), at the druid's own THAC0. */
export async function rollFormAttack(actor: FormAttackActor, attackIndex: number): Promise<void> {
  const attack = actor.system.shapechange.form?.attacks[attackIndex];
  if (!attack) return;
  const thac0 = attack.type === "ranged" ? actor.system.attributes.thac0.ranged : actor.system.attributes.thac0.melee;
  await rollCreatureAttack(actor as never, {
    name: attack.name,
    thac0,
    weaponMagicBonus: 0,
    damageFormula: () => attack.damage,
    damageType: null,
    weaponItem: null,
  });
}
```
with a small local `FormAttackActor` interface. The helpless forced hit, condition modifiers and crit/fumble logic in `rollCreatureAttack` apply unchanged.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage && npx vite build --outDir <scratchpad>/build-sp16`
Expected: green; the existing `pc-sheet-bindings` test still passes.

```bash
git add src/sheets/character/sheet.ts src/sheets/creature/combat-rolls.ts templates/actor/pc styles/actor/pc.scss tests/templates/shapechange-bindings.test.ts
git commit -m "feat(shapechange): PC sheet panel, shifted banner and form attacks (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Monster NPC form tagging panel

**Files:**
- Modify: `templates/actor/creature/statblock.hbs` (a "Shapechange form" panel next to the Turning row, around the existing `details.turning.row` field)
- Modify: `src/sheets/creature/sheet.ts` and `src/sheets/creature/context.ts` / `context-types.ts` only as needed to expose the choice lists
- Modify: `lang/en.json` (`ADND2E.sheet.creature.shapechange*` labels)
- Test: `tests/templates/creature-sheet-bindings.test.ts` (extend) or a new `tests/templates/shapechange-form-panel.test.ts`

**Interfaces:**
- Consumes: Task 2 `details.shapechange` schema and the `shapechangeCategories` / `habitats` label maps in `CONFIG.ADND2E`.
- Produces: an unlocked-edit / locked-display panel with `name="system.details.shapechange.category"` (a select with a blank "not a form" option), `name="system.details.shapechange.habitats"` (a multi-select; follow how `details.types` is rendered on this sheet — read `statblock.hbs` and how the `types` multi-select and its form parsing work in `src/sheets/creature/sheet.ts`, including the `toggleMonsterType` action), and `name="system.details.shapechange.giant"` (a checkbox).

Read `templates/actor/creature/statblock.hbs` (the `types` toggle chips and the turning select), `src/sheets/creature/sheet.ts` (`#onToggleMonsterType`, `_prepareContext` choice lists) and `tests/templates/creature-sheet-bindings.test.ts` first.

- [ ] **Step 1: Write the failing test**

Add a test (new file `tests/templates/shapechange-form-panel.test.ts`) asserting the stat block template contains `system.details.shapechange.category`, `system.details.shapechange.giant`, and a habitats control bound to the habitats field, and that every `data-action` it adds is registered on `Adnd2eCreatureSheet` (same regex pattern as the other binding tests). Run → FAIL.

- [ ] **Step 2: Implement**

Mirror the Monster Types chips for habitats (a `toggleHabitat` action with a private static handler, writing `system.details.shapechange.habitats` as the toggled array, gated on `isEditable`), a category `<select>` (`selectOptions shapechangeCategories selected=… localize=true blank=""`, with the config labels passed in context like `turnRows`), and a giant checkbox; locked view shows the values as text (`adnd2eOrDash`). Copy keys under `ADND2E.sheet.creature`: `shapechangeTitle` "Shapechange form", `shapechangeCategory` "Category", `shapechangeHabitats` "Habitats", `shapechangeGiant` "Giant form", `shapechangeNotAForm` "Not a shapechange form", `shapechangeHint` "Tag a Monster NPC as a form for druids; the GM chooses legal animals (bullfrog to black bear) and gives players Observer permission."

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add templates/actor/creature src/sheets/creature lang/en.json tests/templates
git commit -m "feat(shapechange): tag Monster NPCs as shapechange forms (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sample branch kits, manifest and docs

**Files:**
- Create: `packs/kits/_source/sample-desert-druid.json`, `sample-mountain-druid.json`, `sample-swamp-druid.json`
- Modify: `packs/kits/_source/_MANIFEST.md`
- Modify: `tests/packs/content.test.ts` (kits count 4 → 7; keep every existing assertion; add the shapechange-power checks below)
- Modify: `docs/bestiary-content.md` (a "Shapechange forms" section)

**Interfaces:**
- Consumes: Task 1 `resolveShapechangeSpec`; the kit schema (`src/data/item/kit.ts`) and the `sample-ghosthunter.json` shape.
- Produces: three kit documents with 16-character ids (`kSampleDesertDr1`, `kSampleMountainD`, `kSampleSwampDru`), `_key` `!items!<id>`, `chassisId: "druid"`, names `Sample Desert Druid`, `Sample Mountain Druid`, `Sample Swamp Druid`, and one power each with `id: "shapechange"`, `name: "Shapechange"`, `per: "day"`, `uses: 3`, `params` as below, and `grantedFeatures` holding short mechanical notes only (no rulebook prose).

Before writing, VERIFY each branch's values against the PDF `references/PHBR13 - The Complete Druid's Handbook.pdf` (extract with `pdftotext -layout -f 1 -l 30` into the scratchpad; the PDF page labels are garbled in places, so cite by the printed page number you can confirm and the branch name): desert druid (shapechange: 3 a day at 7th, one each of mammal, reptile, bird; desert-habitat animals only), mountain druid (reptile, bird or mammal, 3 a day at 7th, each form once a day, no giant forms), swamp druid (reptile, bird or mammal, 3 a day at 7th, swamp/wetland creatures only, each once a day). If the book says otherwise, the book wins; report any difference.

Power params: desert `[{ key: "habitats", value: "desert" }, { key: "categories", value: "mammal,reptile,bird" }]`; mountain `[{ key: "habitats", value: "mountains" }, { key: "categories", value: "reptile,bird,mammal" }, { key: "giant", value: "false" }]`; swamp `[{ key: "habitats", value: "swamp" }, { key: "categories", value: "reptile,bird,mammal" }]`; each also `oncePerCategory` `"true"` and `minLevel` `"7"`. Qualifications use `abilityMinimums` wis 12, cha 15 (PHBR13's branch minimums; confirm), races `[]`, alignments `[]`, `xpModifierPercent` 0, empty `effects`, `equipment` inherit, `overrides` default (casting `inherit`, turning `{ mode: "inherit", offset: 0 }`, `removedAbilities: []`). Add `_MANIFEST.md` rows for the three kits ("a shapechange power with habitat params") and a citation line (book, branch names, printed pages). Update the manifest's "Four SAMPLE" sentence to seven.

In `tests/packs/content.test.ts`: change `has four …` to seven (counts 4 → 7 in the uniqueness assertions and the test title) and add:

```ts
  it("the druid branch kits carry a resolvable shapechange power", () => {
    for (const d of items.filter((i) => (sys(i) as { chassisId: string }).chassisId === "druid")) {
      const powers = (sys(d) as { powers: { id: string; uses: number; per: string; params: { key: string; value: string }[] }[] }).powers;
      const power = powers.find((p) => p.id === "shapechange");
      expect(power, String(d.name)).toBeTruthy();
      const spec = resolveShapechangeSpec(power!);
      expect(spec.uses, String(d.name)).toBe(3);
      expect(spec.habitats.length, String(d.name)).toBeGreaterThan(0);
      expect(spec.minLevel, String(d.name)).toBe(7);
    }
  });
```
(import `resolveShapechangeSpec` from `../../src/core/shapechange`).

`docs/bestiary-content.md`: add a "Shapechange forms (druids)" section: tag your own Monster NPC animals (`details.shapechange` category/habitats/giant), give players Observer permission on the animal folder, the GM judges size (bullfrog to black bear), no stat blocks ship.

- [ ] **Verify and commit**

Run: `npx vitest run tests/packs && npm run build:packs` (if the project's pack build runs in CI; otherwise just the tests) `&& npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add packs/kits docs/bestiary-content.md tests/packs/content.test.ts
git commit -m "feat(shapechange): sample desert, mountain and swamp druid kits (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Gates, headless proof, README, and the manual checklist

**Files:**
- Modify: `README.md` (the sub-project table: SP16 `📋 Not started` → `✅ Complete` with a one-paragraph scope; grep `SP16\|16. Druid`)
- Scratch (git-ignored, do NOT commit): `.superpowers/proof/shapechange.proof.ts`

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage && npx vite build --outDir "<scratchpad>/build-final"`
Expected: green; 100% statement coverage.

- [ ] **Step 2: Headless proof (best effort)**

Recipe: memory note `foundry-headless-proof-harness` (real Foundry `common/server.mjs`, `globalThis.foundry` before importing repo src, stubs for `game.i18n`/`ui`/`logger`/`ChatMessage`/`Roll`; reuse `.superpowers/proof/` files from earlier proofs if present). Prove with the REAL data models:
1. `details.shapechange` and `system.shapechange` defaults validate; a snapshot round trips through the real schema (`form` nullable: null by default, set and cleared).
2. A character with a snapshot: `deriveAndCache` (or the model's prepareDerivedData) yields `attributes.ac` all four values = the form's AC and `attributes.movement.current` = the form's land; with `form: null` the normal derive is unchanged; HP max, saves and THAC0 are identical in both cases.
3. `shiftToForm` against a fake druid actor and fake world actors: a level-7 druid with no kit uses the base spec; spends one use and records the category; heal equals `healOnShift`; HP capped at max; refuses a second use of the same category, a 4th shift, an untagged actor, a giant form, a wrong-habitat form for a desert druid kit, and a level-6 druid; refuses when `statuses` contains `stunned`; the picker (`eligibleForms`) includes only actors with `testUserPermission` OBSERVER and shows blocked reasons.
4. `returnToNormal` sets `form` to null and costs no use; `resetShapechangeDay` zeroes counters and keeps the form.
5. The three sample kit JSONs validate against `KitItemModel.schema` and `resolveShapechangeSpec` gives the expected spec for each.
6. Render `templates/actor/pc/partials/pc-feature-panels.hbs`, `header.hbs` and `pc-main-panels.hbs` with Handlebars for: a normal druid (panel visible, no banner, weapon list), a shifted druid (banner, form attacks, no weapon list), a level-6 druid and a non-druid (no panel). Render `templates/chat/shapechange-use.hbs` for a shift and a return.
Report proven and not proven (real clicks, dialog, the non-GM seat, derive inside a real prepared actor, `Roll`).

- [ ] **Step 3: README and commit**

Update the SP16 row in the README. If the rest of the README lists the kit samples count or sub-project 16 status elsewhere, fix those too.

```bash
git add README.md
git commit -m "docs: SP16 druid shapechanging complete (#84)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch. A world with: a PC with a Druid class item at level 7 (set the class level or XP) and a Sample Desert Druid kit dropped on it; a plain level-7 druid PC (no kit); a level-6 druid; a wizard (non-druid). Several Monster NPC animals YOU author (name, AC, a movement rate, an attack with damage) in a folder with default permission **Observer** for players: a mammal (forest), a reptile (desert), a bird (desert), a giant mammal. Tag them on the Monster NPC sheet's Shapechange form panel (category, habitats, giant). A non-GM player seat owning the druid. Reset any setting you change.
1. Monster NPC sheet: the Shapechange form panel edits category, habitats and giant; locked view shows them.
2. PC druid sheet, Features tab: the Shapechange panel shows "Left today: 3 / 3". The level-6 druid and the wizard have no panel.
3. **Shift…** lists the eligible forms. For the plain druid: the mammal, reptile and bird (not the giant). For the Sample Desert Druid: only the desert reptile and bird (forest mammal missing).
4. Take 10 damage first, then shift: the chat card shows 1d6, "Heals N hit points" (N = floor(10 × d6 / 10)), uses left 2/3; the druid's HP rose accordingly and not above max.
5. The header banner "Shapechanged: <form>" appears; the character AC and movement show the form's values; HP max, saves and THAC0 are unchanged.
6. The main panel shows the form's attacks, not the weapons; roll one at a target: the attack card and damage use the form's damage and the druid's THAC0; attacks against the shifted druid use the form's AC (target it from another token).
7. Shift again into the same category: refused with "category already used today". Shift into a different category: allowed and heals again; the 4th shift is refused.
8. **Return to normal form** restores the weapon list and normal AC/movement; the use count does not change. **New day** (and the kit "New day") resets uses and categories.
9. A stunned druid cannot shift or return (warning).
10. Non-GM seat: repeat 3-8 on the owned druid; a player who cannot observe an animal does not see it in the picker; the form's own Monster NPC actor is never modified by the shift.
11. The PC, NPC, monster and item sheets and the chat cards look unchanged otherwise (no regression).
```

---

## Self-Review

- **Spec coverage:** §1 pure rules (spec resolution, availability, eligibility, limits, heal, overlay, snapshot) → Task 1; §2 Monster NPC form data and the tagging panel → Tasks 2 (schema, labels) and 5 (panel); §3 actor state and snapshot → Task 2; §4 shifted state (derive overlay, attacks, banner, equipment note, return) → Tasks 2 (overlay) and 4 (attacks, banner); §5 Shift action, picker with Observer filter, chat card, new-day reset, `canAct` gate → Tasks 3 and 4; §6 branch kits and samples → Task 6; §7 out of scope respected; Testing: unit tests (Tasks 1-3), binding/census tests (Tasks 3-5), pack tests (Task 6), headless proof, gates and manual checklist with a non-GM seat (Task 7). Risks: AC readers all see the form's AC because the overlay writes `system.attributes.ac` in `deriveAndCache` (Task 2); permissions via the Observer filter (Task 3) and checklist; attack-path reuse through `rollCreatureAttack` (Task 4); snapshot staleness intended.
- **Spec deviation:** the spec's sample branch kits are named `Sample …` per the kit pack's own-design convention (content policy), mechanical data only.
- **Placeholders:** none in the pure code (Tasks 1-2 complete); Tasks 3-6 give exact shapes and require reading named neighbouring code before editing, since they are Foundry glue, templates and content; every behavior they must have is listed.
- **Consistency:** `FormSnapshot`, `ShapechangeState`, `ShapechangeSpec`, `resolveShapechangeSpec`, `canShift`, `afterShift`, `afterNewDay`, `healOnShift`, `snapshotForm`, `formArmorClass`, `applyShapechangeOverlay`, `buildShapechangeCardContext` names match across tasks; the `system.shapechange` schema field names (`usedToday`, `categoriesUsed`, `form`) match Task 3's writes and Task 7's proof; the five action names match the binding test.
