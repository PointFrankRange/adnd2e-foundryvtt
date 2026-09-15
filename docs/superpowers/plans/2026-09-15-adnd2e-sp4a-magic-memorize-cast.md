# Sub-project 4a: Magic — Memorize / Forget / Cast / Rest / Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `core/magic` engine and `spell` Item DataModel into a real memorize/forget/cast/rest workflow on the character sheet, with cast auto-rolling a spell's `automation.damage`/`automation.healing` formula and a chat-card Apply button (mirroring SP3's Roll Damage → Apply Damage two-step) applying it to targeted tokens.

**Architecture:** Two-layer split, same contract as SP2/SP3: a new pure `src/magic/` directory holds the cast chat-card content builder plus a priest sphere-access eligibility helper (100%-covered, gated); the Foundry shell adds one schema field, extends the existing pure `context.ts`/`context-types.ts` render-context layer with per-spell memorize/cast eligibility, adds `spell-actions.ts` (the Roll-construction + `actor.update` glue, mirroring SP3's `combat-rolls.ts`), wires four new sheet actions + template buttons, and extends `chat-listeners.ts` with one new, additive chat-card button handler.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`ApplicationV2`, `Roll`, `ChatMessage`), Handlebars.

**Spec:** `docs/superpowers/specs/2026-09-15-adnd2e-sp4-magic-design.md` — this plan implements ONLY §4.1 ("Plan 4a"), the parts of §7 (scope boundary) that apply to memorize/cast/rest/apply, and the "Plan 4a dev-world checklist" in §6. §4.2 (Learn Spell, "Plan 4b") is a separate follow-up plan — do not implement it here.

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`) — never `fvtt-types` (a wrong v13-beta).
- **Two-layer contract:** new pure files (`src/magic/*.ts`) import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). `src/sheets/character/context.ts` / `context-types.ts` are ALSO in the pure zone already (SP2) — changes there follow the same 100%-coverage rule. The Foundry shell (`spell-actions.ts`, `sheet.ts`, `chat-listeners.ts`, templates, the `base-actor.ts` schema field) is typecheck + build gated only, no unit tests, dev-world verified.
- **The gated-zone config triad** — every new pure file goes in ALL THREE of `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (both the Foundry-globals `ignores` array and the pure-zone `files` array).
- **Content policy:** mechanical/UI data only. Chat-card templates carry labels via `{{localize}}` keys, never 2E rules prose.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check is GATED** (Task 5) — the user runs it before `finishing-a-development-branch`, never a deferred checklist item.
- **Actor/document resolution from chat-card button data uses `.uuid` + `fromUuidSync`, never `.id` + `game.actors.get()`** — a confirmed SP3 lesson (an unlinked token's synthetic actor shares its linked actor's `.id` but not its live data). This plan's new `applyCastEffect` handler does not need to resolve an actor by identity at all (it only reads `game.user.targets`, same as SP3's `onApplyDamage`) — but if any future change to this code needs actor resolution from dataset data, this rule applies.
- **SP3's existing `applyDamage` action and its `data-amount` semantics (always positive, always subtracted) MUST NOT CHANGE.** This plan adds a NEW, separate action name (`applyCastEffect`) rather than generalizing the existing one, so already-posted SP3 chat cards in any live world keep working exactly as before.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Pure magic layer — cast chat-card builder + priest sphere-access eligibility

**Files:**
- Create: `src/magic/card-types.ts`
- Create: `src/magic/cast-card.ts`
- Create: `src/magic/priest-sphere-access.ts`
- Test: `tests/magic/cast-card.test.ts`
- Test: `tests/magic/priest-sphere-access.test.ts`
- Modify: `tsconfig.core.json` — add `src/magic/**/*.ts`, `tests/magic/**/*.ts` to `include`
- Modify: `vitest.config.ts` — add `src/magic/**` to `coverage.include`
- Modify: `eslint.config.js` — add `src/magic/**` to both the Foundry-globals `ignores` array and the pure-zone `files` array

**Interfaces:**
- Consumes: `canCastSphereSpell(access, spellLevel): boolean` and `resolveSphereAccess(table, sphere): SphereAccess` from `src/core/magic/spheres.ts`; `CLERIC_SPHERE_ACCESS`/`DRUID_SPHERE_ACCESS: Partial<Record<SphereName, SphereAccess>>` from `src/core/magic/tables.ts`; `SphereAccess`/`SphereName` types from `src/core/types.ts`. All already exist (Plan 1b.5) — do not modify them.
- Produces: `buildCastCardContext(input: CastCardInput): CastCardContext` (Task 3/4 call this from `spell-actions.ts`'s `castSpell`) and `canMemorizePriestSpell(chassisId: string | null, sphereAccessOverride: readonly SphereName[] | null, spellSpheres: readonly SphereName[], spellLevel: number): boolean` (Task 2 calls this from `context.ts`'s `buildSpells`).

First, look at the exact existing pattern this task follows — read `src/combat/card-types.ts` and `src/combat/attack-card.ts` (SP3) before writing anything. Both files already exist in this repo; they are the direct template for `card-types.ts`/`cast-card.ts` below.

- [ ] **Step 1: Write `src/magic/card-types.ts`**

```ts
export interface CastCardInput {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  range: string;
  duration: string;
  castingTime: string;
  /** the spell's `savingThrow` field value — "none" means no save (see `SAVING_THROW_KINDS` in src/data/item/choices.ts) */
  savingThrow: string;
  components: { v: boolean; s: boolean; m: boolean };
  /** the result of rolling the spell's automation.damage/healing formula, or null when neither is set */
  rollResult: { kind: "damage" | "healing"; formula: string; total: number } | null;
}

export interface CastCardContext {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  range: string;
  duration: string;
  castingTime: string;
  savingThrow: string;
  /** true when savingThrow !== "none" — lets the template skip an empty line without a helper */
  hasSavingThrow: boolean;
  components: { v: boolean; s: boolean; m: boolean };
  /** rollResult plus a precomputed i18n label key — templates never build keys themselves */
  rollResult: { kind: "damage" | "healing"; label: string; formula: string; total: number } | null;
  /** carried into the Apply button's dataset; null when rollResult is null (nothing to apply) */
  applyContext: { amount: number; kind: "damage" | "healing" } | null;
}
```

- [ ] **Step 2: Write `tests/magic/cast-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildCastCardContext } from "../../src/magic/cast-card";
import type { CastCardInput } from "../../src/magic/card-types";

function input(over: Partial<CastCardInput> = {}): CastCardInput {
  return {
    actorName: "Aldric",
    actorImg: "icons/svg/mystery-man.svg",
    spellName: "Magic Missile",
    spellLevel: 1,
    range: "60 yd + 10 yd/level",
    duration: "instantaneous",
    castingTime: "1",
    savingThrow: "none",
    components: { v: true, s: true, m: false },
    rollResult: null,
    ...over,
  };
}

describe("buildCastCardContext", () => {
  it("no automation roll → rollResult and applyContext both null", () => {
    const c = buildCastCardContext(input());
    expect(c.rollResult).toBeNull();
    expect(c.applyContext).toBeNull();
  });

  it("damage roll → labeled rollResult + a damage applyContext", () => {
    const c = buildCastCardContext(
      input({ rollResult: { kind: "damage", formula: "2d4+2", total: 7 } }),
    );
    expect(c.rollResult).toEqual({ kind: "damage", label: "ADND2E.chat.cast.damageRoll", formula: "2d4+2", total: 7 });
    expect(c.applyContext).toEqual({ amount: 7, kind: "damage" });
  });

  it("healing roll → labeled rollResult + a healing applyContext", () => {
    const c = buildCastCardContext(
      input({ rollResult: { kind: "healing", formula: "1d8+1", total: 6 } }),
    );
    expect(c.rollResult).toEqual({ kind: "healing", label: "ADND2E.chat.cast.healingRoll", formula: "1d8+1", total: 6 });
    expect(c.applyContext).toEqual({ amount: 6, kind: "healing" });
  });

  it("savingThrow 'none' → hasSavingThrow false", () => {
    expect(buildCastCardContext(input({ savingThrow: "none" })).hasSavingThrow).toBe(false);
  });

  it("savingThrow other than 'none' → hasSavingThrow true", () => {
    expect(buildCastCardContext(input({ savingThrow: "negates" })).hasSavingThrow).toBe(true);
  });

  it("passes actor/spell display fields through unchanged", () => {
    const c = buildCastCardContext(input({ spellName: "Cure Light Wounds", spellLevel: 1 }));
    expect(c.spellName).toBe("Cure Light Wounds");
    expect(c.spellLevel).toBe(1);
    expect(c.components).toEqual({ v: true, s: true, m: false });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/magic/cast-card.test.ts 2>&1 | tail -30`
Expected: FAIL — `Cannot find module '../../src/magic/cast-card'`.

- [ ] **Step 4: Write `src/magic/cast-card.ts`**

```ts
import type { CastCardContext, CastCardInput } from "./card-types";

const ROLL_LABELS: Record<"damage" | "healing", string> = {
  damage: "ADND2E.chat.cast.damageRoll",
  healing: "ADND2E.chat.cast.healingRoll",
};

/** Turn a resolved (or automation-less) spell cast into the cast chat-card's
 *  display data. `rollResult` is null when the spell's automation.damage and
 *  automation.healing are both unset — the card then shows spell info only,
 *  with no roll line and no Apply button. */
export function buildCastCardContext(input: CastCardInput): CastCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    spellName: input.spellName,
    spellLevel: input.spellLevel,
    range: input.range,
    duration: input.duration,
    castingTime: input.castingTime,
    savingThrow: input.savingThrow,
    hasSavingThrow: input.savingThrow !== "none",
    components: input.components,
    rollResult: input.rollResult
      ? { ...input.rollResult, label: ROLL_LABELS[input.rollResult.kind] }
      : null,
    applyContext: input.rollResult
      ? { amount: input.rollResult.total, kind: input.rollResult.kind }
      : null,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/magic/cast-card.test.ts 2>&1 | tail -30`
Expected: PASS (6 tests).

- [ ] **Step 6: Write `tests/magic/priest-sphere-access.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { canMemorizePriestSpell } from "../../src/magic/priest-sphere-access";
import type { SphereName } from "../../src/core/types";

describe("canMemorizePriestSpell", () => {
  it("null chassisId (no priest-progression class on the actor) → always false", () => {
    expect(canMemorizePriestSpell(null, null, ["healing"], 1)).toBe(false);
  });

  it("cleric, major-access sphere, level within cap (7) → true", () => {
    expect(canMemorizePriestSpell("cleric", null, ["healing"], 7)).toBe(true);
  });

  it("cleric, minor-access sphere ('elemental'), level within the minor cap (3) → true", () => {
    expect(canMemorizePriestSpell("cleric", null, ["elemental"], 3)).toBe(true);
  });

  it("cleric, minor-access sphere ('elemental'), level above the minor cap (4) → false", () => {
    expect(canMemorizePriestSpell("cleric", null, ["elemental"], 4)).toBe(false);
  });

  it("cleric, no-access sphere ('animal') → false at any level", () => {
    expect(canMemorizePriestSpell("cleric", null, ["animal"], 1)).toBe(false);
  });

  it("multi-sphere spell is memorizable if ANY listed sphere is accessible", () => {
    // "animal" is none for a cleric, "healing" is major — the spell should still be allowed.
    expect(canMemorizePriestSpell("cleric", null, ["animal", "healing"], 5)).toBe(true);
  });

  it("druid, major-access sphere ('plant') → true", () => {
    expect(canMemorizePriestSpell("druid", null, ["plant"], 6)).toBe(true);
  });

  it("druid, sphere the druid table omits ('astral') → false", () => {
    expect(canMemorizePriestSpell("druid", null, ["astral"], 1)).toBe(false);
  });

  it("non-priest chassis id (e.g. a fighter's chassisId leaking in) → false", () => {
    expect(canMemorizePriestSpell("fighter", null, ["healing"], 1)).toBe(false);
  });

  it("sphereAccessOverride replaces the chassis table entirely — listed spheres become major", () => {
    const override: SphereName[] = ["charm"];
    // "charm" is major for a cleric anyway — pick a sphere the cleric table has as "none"
    // ('animal') to prove the override, not the base table, is what's being consulted.
    expect(canMemorizePriestSpell("cleric", ["animal"] as SphereName[], ["animal"], 7)).toBe(true);
    expect(canMemorizePriestSpell("cleric", ["animal"] as SphereName[], ["healing"], 1)).toBe(false);
    void override;
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run tests/magic/priest-sphere-access.test.ts 2>&1 | tail -30`
Expected: FAIL — `Cannot find module '../../src/magic/priest-sphere-access'`.

- [ ] **Step 8: Write `src/magic/priest-sphere-access.ts`**

```ts
import { canCastSphereSpell, resolveSphereAccess } from "../core/magic/spheres";
import { CLERIC_SPHERE_ACCESS, DRUID_SPHERE_ACCESS } from "../core/magic/tables";
import type { SphereAccess, SphereName } from "../core/types";

function priestSphereTableFor(chassisId: string): Partial<Record<SphereName, SphereAccess>> {
  if (chassisId === "cleric") return CLERIC_SPHERE_ACCESS;
  if (chassisId === "druid") return DRUID_SPHERE_ACCESS;
  return {};
}

function effectiveSphereAccess(
  chassisId: string,
  sphereAccessOverride: readonly SphereName[] | null,
): Partial<Record<SphereName, SphereAccess>> {
  if (!sphereAccessOverride) return priestSphereTableFor(chassisId);
  const out: Partial<Record<SphereName, SphereAccess>> = {};
  for (const s of sphereAccessOverride) out[s] = "major";
  return out;
}

/**
 * Whether a priest can memorize a spell belonging to `spellSpheres` at `spellLevel`.
 * A spell is memorizable if ANY of its listed spheres is accessible at a level the
 * access allows (PHB's multi-sphere quantifier — a spell is castable if the priest
 * has access to ANY of its spheres, same rule already established for the wizard's
 * multi-school opposition check).
 *
 * `chassisId` is the priest-progression class item's chassisId on the actor (e.g.
 * "cleric"/"druid"), or null when the actor has no priest-progression class — always
 * returns false in that case. `sphereAccessOverride`, when non-null, REPLACES the
 * chassis table entirely: every listed sphere becomes "major" access, everything
 * else "none" (matches `system.spellcasting.priest.sphereAccessOverride`'s schema
 * shape — a plain list of accessible sphere names, src/data/actor/base-actor.ts).
 */
export function canMemorizePriestSpell(
  chassisId: string | null,
  sphereAccessOverride: readonly SphereName[] | null,
  spellSpheres: readonly SphereName[],
  spellLevel: number,
): boolean {
  if (!chassisId) return false;
  const table = effectiveSphereAccess(chassisId, sphereAccessOverride);
  return spellSpheres.some((sphere) => canCastSphereSpell(resolveSphereAccess(table, sphere), spellLevel));
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/magic/priest-sphere-access.test.ts 2>&1 | tail -30`
Expected: PASS (10 tests).

- [ ] **Step 10: Add the gated-zone config triad entries**

In `tsconfig.core.json`, add to `include`: `"src/magic"`, `"tests/magic"` — this array uses bare directory paths (no glob), e.g. the existing `"src/combat"`/`"tests/combat"` entries; match that exact style, not a `**/*.ts` glob.

In `vitest.config.ts`, add `"src/magic/**/*.ts"` to the `coverage.include` array — matches the existing `"src/combat/**/*.ts"` entry's exact format (WITH the `/*.ts` suffix).

In `eslint.config.js`, add entries for BOTH new directories in BOTH arrays: (a) the Foundry-globals block's `ignores` array gets `"src/magic/**"`, `"tests/magic/**"` (no `/*.ts` suffix — matches that array's existing `"src/combat/**"`, `"tests/combat/**"` style exactly), and (b) the pure-zone block's `files` array gets `"src/magic/**/*.ts"`, `"tests/magic/**/*.ts"` (WITH the `/*.ts` suffix — matches that array's existing `"src/combat/**/*.ts"`, `"tests/combat/**/*.ts"` style). The two arrays use different glob suffixes for the same directories; copy each array's own existing style exactly rather than reusing one pattern for both.

- [ ] **Step 11: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean (both `tsc --noEmit` and the `tsconfig.core.json` pass).

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% statement/line/function coverage (branch ≥ 90%) on `src/magic/**`.

- [ ] **Step 12: Commit**

```bash
git add src/magic/ tests/magic/ tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "$(cat <<'EOF'
feat(sp4a): pure cast chat-card builder + priest sphere-access eligibility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Memorization data — schema field + render-context eligibility wiring

**Files:**
- Modify: `src/data/actor/base-actor.ts` — `memorizedSchema()` gains an `expended` field
- Modify: `src/sheets/character/context-types.ts` — `CharacterDerivedView.spellcasting` and `SpellItemView` grow new fields
- Modify: `src/sheets/character/context.ts` — `buildSpells` computes per-spell memorize/cast eligibility
- Modify: `tests/sheets/character/context.test.ts` — update every existing `spellcasting` fixture + the `spell()` helper for the new fields, add new eligibility test cases

**Interfaces:**
- Consumes: `canMemorizePriestSpell` from Task 1's `src/magic/priest-sphere-access.ts`; `getChassis(chassisId): ClassChassis` from `src/core/classes/chassis.ts` (already exists, used elsewhere in `context.ts`/`sheet.ts`); `ClassChassis.spellProgressionId: "wizard" | "priest" | "paladin" | "ranger" | "bard" | null` (already exists).
- Produces: `SpellItemView` now carries `memorized: boolean`, `expended: boolean`, `canMemorize: boolean`, `canCast: boolean` — Task 3's `spells.hbs` template reads these to show/hide the Memorize/Forget/Cast buttons. `system.spellcasting.{wizard,priest}.memorized[].expended: boolean` is the new schema field Task 3's `spell-actions.ts` reads/writes.

First, read `src/data/actor/base-actor.ts`'s `memorizedSchema()` function (around line 23) and `src/sheets/character/context.ts`'s `buildSpells`/`toSlotRows` functions before making changes — this task edits both in place.

- [ ] **Step 1: Add `expended` to the memorized schema**

In `src/data/actor/base-actor.ts`, find:

```ts
function memorizedSchema() {
  return new ArrayField(
    new SchemaField({
      spellItemId: new StringField({ required: true, blank: false }),
      spellLevel: new NumberField({ required: true, integer: true, min: 1, max: 9 }),
    }),
    { required: true, initial: [] },
  );
}
```

Replace with:

```ts
function memorizedSchema() {
  return new ArrayField(
    new SchemaField({
      spellItemId: new StringField({ required: true, blank: false }),
      spellLevel: new NumberField({ required: true, integer: true, min: 1, max: 9 }),
      /** true once this memorized spell has been cast today — the slot stays
       *  occupied (see slots.ts's toRecord, which counts memorized.length
       *  regardless of expended) until a "Rest" action clears it. */
      expended: new BooleanField({ required: true, initial: false }),
    }),
    { required: true, initial: [] },
  );
}
```

`BooleanField` is already destructured at the top of this file (`const { StringField, NumberField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;` — verify this import line still lists `BooleanField`; if the file's destructure differs, add it there instead of re-declaring).

- [ ] **Step 2: Run typecheck to confirm the schema change compiles**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

- [ ] **Step 3: Extend `context-types.ts`'s `CharacterDerivedView.spellcasting`**

In `src/sheets/character/context-types.ts`, find:

```ts
  spellcasting: {
    wizard: { specialistSchool: string | null; slots: Record<string, { max: number; used: number }> };
    priest: { slots: Record<string, { max: number; used: number }> };
  };
```

Replace with:

```ts
  spellcasting: {
    wizard: {
      specialistSchool: string | null;
      slots: Record<string, { max: number; used: number }>;
      memorized: { spellItemId: string; spellLevel: number; expended: boolean }[];
    };
    priest: {
      slots: Record<string, { max: number; used: number }>;
      memorized: { spellItemId: string; spellLevel: number; expended: boolean }[];
      sphereAccessOverride: string[] | null;
    };
  };
```

(This type is a view over `actor.system` — `sheet.ts`'s `#buildInput` already does `derived: actor.system as never`, so no `sheet.ts` change is needed here: `system.spellcasting.wizard.memorized` and `system.spellcasting.priest.sphereAccessOverride` already exist at runtime as of Step 1 / from the pre-existing schema, this is purely a type-level catch-up.)

- [ ] **Step 4: Extend `SpellItemView`**

In the same file, find:

```ts
export interface SpellItemView {
  id: string; name: string; img: string; casterClass: string; level: number;
  schools: string[]; spheres: string[]; range: string; castingTime: string; savingThrow: string;
  inSpellbook: boolean;
}
```

Replace with:

```ts
export interface SpellItemView {
  id: string; name: string; img: string; casterClass: string; level: number;
  schools: string[]; spheres: string[]; range: string; castingTime: string; savingThrow: string;
  inSpellbook: boolean;
  /** filled by buildSpells (context.ts) — sheet.ts's toSpellView sets placeholders,
   *  same pattern as NwpView's governingAbilityLabel/checkTarget. */
  memorized: boolean;
  expended: boolean;
  canMemorize: boolean;
  canCast: boolean;
}
```

- [ ] **Step 5: Update `sheet.ts`'s `toSpellView` placeholders**

This is a one-line addition in `src/sheets/character/sheet.ts` (NOT part of this task's file list above but required for the type to compile — the object literal must satisfy the now-larger `SpellItemView` interface). Find, inside `toSpellView`:

```ts
    inSpellbook: spellbookIds.has(it.id),
  };
}
```

Replace with:

```ts
    inSpellbook: spellbookIds.has(it.id),
    // Placeholders — buildSpells (context.ts) recomputes all four from the
    // actor's memorized list + slot state + spellbook/sphere-access eligibility.
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
  };
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: FAIL — `context.test.ts`'s existing `spellcasting` fixtures and the `spell()` helper are now missing required fields. This is expected; Step 9 below fixes it.

- [ ] **Step 7: Write the new `buildSpells` (replacing the existing one)**

In `src/sheets/character/context.ts`, add these imports at the top (alongside the existing ones):

```ts
import { getChassis } from "../../core/classes/chassis";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import type { ClassId, DexterityModifiers, SphereName } from "../../core/types";
```

(`ClassId`/`DexterityModifiers` are already imported on the existing first line — merge `SphereName` into that same import statement rather than duplicating it.)

Also add `CharacterDerivedView` to the existing `import type { ... } from "./context-types"` block at the top of `context.ts` (it is already exported from `context-types.ts` — confirm with `grep -n "export interface CharacterDerivedView" src/sheets/character/context-types.ts`; it is used below for `buildSpellRow`'s `sc` parameter type).

Find the existing `/* ---------- spells ---------- */` block:

```ts
/* ---------- spells ---------- */

function buildSpells(input: CharacterSheetInput): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const school = sc.wizard.specialistSchool;
  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const items = input.spellItems.filter((s) => s.level === level);
    if (items.length > 0) known.push({ level, items });
  }
  return {
    wizardSlots: toSlotRows(sc.wizard.slots),
    priestSlots: toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
  };
}
```

Replace with:

```ts
/* ---------- spells ---------- */

function buildSpells(input: CharacterSheetInput): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const school = sc.wizard.specialistSchool;
  const priestChassisId =
    input.classItems.find((c) => getChassis(c.chassisId as ClassId).spellProgressionId === "priest")
      ?.chassisId ?? null;
  const sphereAccessOverride = sc.priest.sphereAccessOverride as SphereName[] | null;

  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const items = input.spellItems
      .filter((s) => s.level === level)
      .map((s) => buildSpellRow(s, sc, priestChassisId, sphereAccessOverride));
    if (items.length > 0) known.push({ level, items });
  }
  return {
    wizardSlots: toSlotRows(sc.wizard.slots),
    priestSlots: toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
  };
}

/** Enriches a raw SpellItemView with memorize/cast eligibility, computed from
 *  the actor's memorized list, its slot state, and (for a priest spell) sphere
 *  access. sheet.ts's toSpellView leaves these four fields as placeholders. */
function buildSpellRow(
  item: SpellItemView,
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;

  const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
  const slotRow = slots[item.level];
  const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    canCast: memorized && !expended,
  };
}
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: still FAIL on `context.test.ts` (Step 6's failure persists — fixed next). `context.ts` and `context-types.ts` themselves should now be clean; if they are not, fix those errors first before moving to the test file.

- [ ] **Step 9: Update `tests/sheets/character/context.test.ts`'s fixtures**

Three edits, all mechanical (add the new required fields with reasonable defaults):

1. Find the base `input()` helper's `spellcasting` line:
```ts
      spellcasting: { wizard: { specialistSchool: null, slots: {} }, priest: { slots: {} } },
```
Replace with:
```ts
      spellcasting: {
        wizard: { specialistSchool: null, slots: {}, memorized: [] },
        priest: { slots: {}, memorized: [], sphereAccessOverride: null },
      },
```

2. In the `"wizard slots become sorted rows"` test, find:
```ts
          spellcasting: {
            wizard: {
              specialistSchool: "evocation",
              slots: { "2": { max: 1, used: 1 }, "1": { max: 2, used: 0 } },
            },
            priest: { slots: {} },
          },
```
Replace with:
```ts
          spellcasting: {
            wizard: {
              specialistSchool: "evocation",
              slots: { "2": { max: 1, used: 1 }, "1": { max: 2, used: 0 } },
              memorized: [],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
```

3. In the `"priest slots become rows too"` test, find:
```ts
          spellcasting: {
            wizard: { specialistSchool: null, slots: {} },
            priest: { slots: { "1": { max: 3, used: 1 } } },
          },
```
Replace with:
```ts
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 3, used: 1 } }, memorized: [], sphereAccessOverride: null },
          },
```

- [ ] **Step 10: Update the `spell()` fixture helper in the "known spells group by level" test**

Find:
```ts
    const spell = (over: Partial<SpellItemView>): SpellItemView => ({
      id: "s",
      name: "Spell",
      img: "",
      casterClass: "wizard",
      level: 1,
      schools: [],
      spheres: [],
      range: "",
      castingTime: "",
      savingThrow: "",
      inSpellbook: true,
      ...over,
    });
```
Replace with:
```ts
    const spell = (over: Partial<SpellItemView>): SpellItemView => ({
      id: "s",
      name: "Spell",
      img: "",
      casterClass: "wizard",
      level: 1,
      schools: [],
      spheres: [],
      range: "",
      castingTime: "",
      savingThrow: "",
      inSpellbook: true,
      memorized: false,
      expended: false,
      canMemorize: false,
      canCast: false,
      ...over,
    });
```

- [ ] **Step 11: Run tests to confirm the existing suite is green again**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -40`
Expected: PASS, no failures (the pre-existing tests didn't assert on the new fields, so their expectations are unaffected once the fixtures compile).

- [ ] **Step 12: Add new eligibility test cases**

Add this new `describe` block to the end of `tests/sheets/character/context.test.ts` (before the file's closing, alongside the other `describe` blocks — do not nest inside an existing one):

```ts
describe("buildCharacterSheetContext — spell memorize/cast eligibility", () => {
  const wizardSpell = (over: Partial<SpellItemView>): SpellItemView => ({
    id: "mm",
    name: "Magic Missile",
    img: "",
    casterClass: "wizard",
    level: 1,
    schools: ["evocation"],
    spheres: [],
    range: "",
    castingTime: "",
    savingThrow: "none",
    inSpellbook: false,
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
    ...over,
  });

  it("wizard spell not in spellbook, slot free → cannot memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 2, used: 0 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });

  it("wizard spell in spellbook, slot free → can memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 2, used: 0 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(true);
  });

  it("wizard spell in spellbook, no free slot (used === max) → cannot memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: { "1": { max: 1, used: 1 } }, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });

  it("memorized, not expended → canCast true, canMemorize false", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: null,
              slots: { "1": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "mm", spellLevel: 1, expended: false }],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    const row = c.spells.known[0]!.items[0]!;
    expect(row.memorized).toBe(true);
    expect(row.expended).toBe(false);
    expect(row.canCast).toBe(true);
    expect(row.canMemorize).toBe(false);
  });

  it("memorized AND expended → canCast false", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: {
              specialistSchool: null,
              slots: { "1": { max: 1, used: 1 } },
              memorized: [{ spellItemId: "mm", spellLevel: 1, expended: true }],
            },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    const row = c.spells.known[0]!.items[0]!;
    expect(row.expended).toBe(true);
    expect(row.canCast).toBe(false);
  });

  it("priest spell within sphere access + level cap, slot free → can memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [
          {
            id: "c1", name: "Cleric", img: "", chassisId: "cleric", hitDie: 8,
            xp: 0, level: 5, canLevelUp: false, dualClassState: null, specialistSchool: null,
          },
        ],
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 2, used: 0 } }, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [
          wizardSpell({
            id: "cure", name: "Cure Light Wounds", casterClass: "priest",
            level: 1, schools: [], spheres: ["healing"], inSpellbook: false,
          }),
        ],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(true);
  });

  it("priest spell in a sphere the cleric table has no access to → cannot memorize", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [
          {
            id: "c1", name: "Cleric", img: "", chassisId: "cleric", hitDie: 8,
            xp: 0, level: 5, canLevelUp: false, dualClassState: null, specialistSchool: null,
          },
        ],
        derived: {
          ...input().derived,
          spellcasting: {
            wizard: { specialistSchool: null, slots: {}, memorized: [] },
            priest: { slots: { "1": { max: 2, used: 0 } }, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [
          wizardSpell({
            id: "speak", name: "Speak With Animals", casterClass: "priest",
            level: 1, schools: [], spheres: ["animal"], inSpellbook: false,
          }),
        ],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canMemorize).toBe(false);
  });
});
```

- [ ] **Step 13: Run the full context test file**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -60`
Expected: PASS, all tests (existing + the 8 new ones) green.

- [ ] **Step 14: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% statement/line/function coverage maintained on `src/sheets/character/context.ts`.

- [ ] **Step 15: Commit**

```bash
git add src/data/actor/base-actor.ts src/sheets/character/context-types.ts \
  src/sheets/character/context.ts src/sheets/character/sheet.ts \
  tests/sheets/character/context.test.ts
git commit -m "$(cat <<'EOF'
feat(sp4a): memorized.expended schema field + spell memorize/cast eligibility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Memorize / Forget / Cast / Rest actions — sheet wiring

**Files:**
- Create: `src/sheets/character/spell-actions.ts`
- Modify: `src/sheets/character/sheet.ts` — wire 4 new `DEFAULT_OPTIONS.actions`
- Modify: `templates/actor/character/spells.hbs` — Memorize/Forget/Cast buttons per known spell, a Rest button

**Interfaces:**
- Consumes: `buildCastCardContext` from Task 1's `src/magic/cast-card.ts`; `SpellItemView.{memorized,expended,canMemorize,canCast}` from Task 2 (rendered by `spells.hbs`); the `Adnd2eCharacterSheet` `DEFAULT_OPTIONS.actions` pattern already established by `rollAttack`/`rollSave` (`src/sheets/character/sheet.ts`, SP3).
- Produces: `memorizeSpell(actor, spellItemId): Promise<void>`, `forgetSpell(actor, spellItemId): Promise<void>`, `castSpell(actor, spellItemId): Promise<void>`, `restSpellcasting(actor): Promise<void>` — all in `spell-actions.ts`. `castSpell` renders `templates/chat/cast-roll.hbs`, which Task 4 creates — **this task's `npm run build` is expected to fail until Task 4 exists** (same accepted sequencing note as SP3's Task 5/Task 6 split; do not treat this as a defect).

Before writing anything, read `src/sheets/character/combat-rolls.ts` in full (SP3's `rollAttack`/`rollSave`) — it is the direct template for this task's `spell-actions.ts` (same "Foundry-coupled glue, no unit tests, dev-world verified" comment header style, same `TEMPLATE_PATH`/`renderTemplate`/`ChatMessage`/`Roll` usage pattern). Also read `src/sheets/character/sheet.ts`'s `DEFAULT_OPTIONS.actions` block and the `#onRollAttack`/`#onRollSave` static methods — the four new actions below follow that exact shape.

- [ ] **Step 1: Write `src/sheets/character/spell-actions.ts`**

```ts
import { buildCastCardContext } from "../../magic/cast-card";
import { TEMPLATE_PATH } from "../../constants";

/* ---------------------------------------------------------------------------
 * spell-actions — SP4a.
 *
 * Foundry-coupled memorize/forget/cast/rest glue for the character sheet's
 * Spells tab — not unit-tested (spec §9-equivalent for this plan), verified
 * in a linked dev world. All chat-card shaping is delegated to the pure
 * magic/cast-card module; this file only reads documents, writes the
 * memorized array, rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

interface MemorizedEntry {
  spellItemId: string;
  spellLevel: number;
  expended: boolean;
}

interface SpellItemHandle {
  id: string;
  name: string;
  system: {
    casterClass: string;
    level: number;
    range: string;
    duration: string;
    castingTime: string;
    savingThrow: string;
    components: { v: boolean; s: boolean; m: boolean };
    automation: { damage: string | null; healing: string | null };
  };
}

interface SpellcasterActor {
  name: string;
  img: string;
  system: {
    spellcasting: {
      wizard: { memorized: MemorizedEntry[] };
      priest: { memorized: MemorizedEntry[] };
    };
  };
  items: { get(id: string): SpellItemHandle | undefined };
  update(data: Record<string, unknown>): Promise<unknown>;
}

function casterKey(spell: SpellItemHandle): "wizard" | "priest" {
  return spell.system.casterClass === "priest" ? "priest" : "wizard";
}

/** Adds `spellItemId` to the actor's memorized list for its own caster type
 *  and spell level, if it isn't already memorized. No-ops (does not write)
 *  if the spell is missing or already memorized — the sheet only shows the
 *  Memorize button when `SpellItemView.canMemorize` is true, so this is a
 *  defensive re-check against a stale button click, not the primary gate. */
export async function memorizeSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) return;
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  if (list.some((m) => m.spellItemId === spellItemId)) return;
  const updated: MemorizedEntry[] = [...list, { spellItemId, spellLevel: spell.system.level, expended: false }];
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
}

/** Removes `spellItemId` from the actor's memorized list, regardless of its
 *  expended state. No-ops if the spell isn't memorized. */
export async function forgetSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) return;
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const updated = list.filter((m) => m.spellItemId !== spellItemId);
  if (updated.length === list.length) return;
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
}

/** Clears every memorized entry's `expended` flag on both casters, without
 *  changing which spells are memorized. */
export async function restSpellcasting(actor: SpellcasterActor): Promise<void> {
  const wizard = actor.system.spellcasting.wizard.memorized.map((m) => ({ ...m, expended: false }));
  const priest = actor.system.spellcasting.priest.memorized.map((m) => ({ ...m, expended: false }));
  await actor.update({
    "system.spellcasting.wizard.memorized": wizard,
    "system.spellcasting.priest.memorized": priest,
  });
}

/** Casts a memorized, non-expended spell: marks it expended, rolls its
 *  automation.damage/healing formula if set (damage takes priority if a
 *  spell somehow set both — the schema doesn't prevent it, but no v1 content
 *  should), and posts a cast chat card with an Apply button when there was a
 *  roll. No-ops if the spell is missing, not memorized, or already expended
 *  (same defensive-re-check role as memorizeSpell). */
export async function castSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) return;
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const entry = list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) return;

  const updated = list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m));
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });

  let rollResult: { kind: "damage" | "healing"; formula: string; total: number } | null = null;
  const { damage, healing } = spell.system.automation;
  if (damage) {
    const roll = await new Roll(damage).evaluate();
    rollResult = { kind: "damage", formula: damage, total: roll.total ?? 0 };
  } else if (healing) {
    const roll = await new Roll(healing).evaluate();
    rollResult = { kind: "healing", formula: healing, total: roll.total ?? 0 };
  }

  const context = buildCastCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell.name,
    spellLevel: spell.system.level,
    range: spell.system.range,
    duration: spell.system.duration,
    castingTime: spell.system.castingTime,
    savingThrow: spell.system.savingThrow,
    components: spell.system.components,
    rollResult,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/cast-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as ChatMessage.CreateData);
}
```

- [ ] **Step 2: Wire the four actions into `sheet.ts`**

In `src/sheets/character/sheet.ts`, add this import alongside the existing `combat-rolls` import:

```ts
import { castSpell, forgetSpell, memorizeSpell, restSpellcasting } from "./spell-actions";
```

Find the `DEFAULT_OPTIONS.actions` block:

```ts
    actions: {
      rollHp: Adnd2eCharacterSheet.#onRollHp,
      takeAverageHp: Adnd2eCharacterSheet.#onTakeAverageHp,
      awardXp: Adnd2eCharacterSheet.#onAwardXp,
      toggleDualClass: Adnd2eCharacterSheet.#onToggleDualClass,
      rollAttack: Adnd2eCharacterSheet.#onRollAttack,
      rollSave: Adnd2eCharacterSheet.#onRollSave,
    },
```

Replace with:

```ts
    actions: {
      rollHp: Adnd2eCharacterSheet.#onRollHp,
      takeAverageHp: Adnd2eCharacterSheet.#onTakeAverageHp,
      awardXp: Adnd2eCharacterSheet.#onAwardXp,
      toggleDualClass: Adnd2eCharacterSheet.#onToggleDualClass,
      rollAttack: Adnd2eCharacterSheet.#onRollAttack,
      rollSave: Adnd2eCharacterSheet.#onRollSave,
      memorizeSpell: Adnd2eCharacterSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eCharacterSheet.#onForgetSpell,
      castSpell: Adnd2eCharacterSheet.#onCastSpell,
      restSpellcasting: Adnd2eCharacterSheet.#onRestSpellcasting,
    },
```

Find the end of the class (the `#onRollSave` static method, right before the closing `}` of `Adnd2eCharacterSheet`):

```ts
  static async #onRollSave(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const category = target.dataset.save as SaveCategory | undefined;
    if (category) await rollSave(this.document as never, category);
  }
}
```

Replace with:

```ts
  static async #onRollSave(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const category = target.dataset.save as SaveCategory | undefined;
    if (category) await rollSave(this.document as never, category);
  }

  // Interaction handlers — SP4a.
  static async #onMemorizeSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await memorizeSpell(this.document as never, spellItemId);
  }

  static async #onForgetSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await forgetSpell(this.document as never, spellItemId);
  }

  static async #onCastSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await castSpell(this.document as never, spellItemId);
  }

  static async #onRestSpellcasting(this: Adnd2eCharacterSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }
}
```

- [ ] **Step 3: Add the sheet UI**

In `templates/actor/character/spells.hbs`, find:

```hbs
  <div class="known-spells panel">
    <h3>{{localize 'ADND2E.sheet.spells.known'}}</h3>
    {{#each adnd2e.spells.known as |grp|}}
      <div class="spell-level-group">
        <h4>{{localize 'ADND2E.sheet.spells.level' level=grp.level}}</h4>
        {{#each grp.items as |s|}}
          <div class="spell-row" data-item-id="{{s.id}}">
            <span class="name">
              {{s.name}}
              {{#if s.inSpellbook}}
                <span class="badge" title="{{localize 'ADND2E.sheet.spells.spellbook'}}">📖</span>
              {{/if}}
            </span>
            {{#if s.schools.length}}
              <span class="schools">{{#each s.schools}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</span>
            {{/if}}
            <span class="casting-time">{{s.castingTime}}</span>
            <span class="saving-throw">{{s.savingThrow}}</span>
          </div>
        {{/each}}
      </div>
    {{else}}
      <p class="placeholder">{{localize 'ADND2E.sheet.spells.none'}}</p>
    {{/each}}
  </div>

  {{! SP4 wires memorization + casting here }}

</section>
```

Replace with:

```hbs
  <div class="known-spells panel">
    <div class="panel-header">
      <h3>{{localize 'ADND2E.sheet.spells.known'}}</h3>
      <button type="button" data-action="restSpellcasting">
        {{localize 'ADND2E.sheet.spells.rest'}}
      </button>
    </div>
    {{#each adnd2e.spells.known as |grp|}}
      <div class="spell-level-group">
        <h4>{{localize 'ADND2E.sheet.spells.level' level=grp.level}}</h4>
        {{#each grp.items as |s|}}
          <div class="spell-row{{#if s.expended}} expended{{/if}}" data-item-id="{{s.id}}">
            <span class="name">
              {{s.name}}
              {{#if s.inSpellbook}}
                <span class="badge" title="{{localize 'ADND2E.sheet.spells.spellbook'}}">📖</span>
              {{/if}}
              {{#if s.expended}}
                <span class="badge expended-badge" title="{{localize 'ADND2E.sheet.spells.expended'}}">✓</span>
              {{/if}}
            </span>
            {{#if s.schools.length}}
              <span class="schools">{{#each s.schools}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</span>
            {{/if}}
            <span class="casting-time">{{s.castingTime}}</span>
            <span class="saving-throw">{{s.savingThrow}}</span>
            {{#if s.canMemorize}}
              <button type="button" data-action="memorizeSpell" data-item-id="{{s.id}}">
                {{localize 'ADND2E.sheet.spells.memorize'}}
              </button>
            {{/if}}
            {{#if s.memorized}}
              <button type="button" data-action="forgetSpell" data-item-id="{{s.id}}">
                {{localize 'ADND2E.sheet.spells.forget'}}
              </button>
            {{/if}}
            {{#if s.canCast}}
              <button type="button" data-action="castSpell" data-item-id="{{s.id}}">
                {{localize 'ADND2E.sheet.spells.cast'}}
              </button>
            {{/if}}
          </div>
        {{/each}}
      </div>
    {{else}}
      <p class="placeholder">{{localize 'ADND2E.sheet.spells.none'}}</p>
    {{/each}}
  </div>

</section>
```

- [ ] **Step 4: Add the new `lang/en.json` keys this template references**

In `lang/en.json`, find the `"spells"` block under `"sheet"`:

```json
      "spells": {
        "wizardSlots": "Wizard Spell Slots",
        "priestSlots": "Priest Spell Slots",
        "specialist": "Specialist",
        "known": "Known Spells",
        "spellbook": "In spellbook",
        "level": "Level {level}",
        "slotLevel": "Level",
        "slotsMax": "Max",
        "slotsUsed": "Used",
        "none": "No spells known."
      },
```

Replace with:

```json
      "spells": {
        "wizardSlots": "Wizard Spell Slots",
        "priestSlots": "Priest Spell Slots",
        "specialist": "Specialist",
        "known": "Known Spells",
        "spellbook": "In spellbook",
        "level": "Level {level}",
        "slotLevel": "Level",
        "slotsMax": "Max",
        "slotsUsed": "Used",
        "none": "No spells known.",
        "memorize": "Memorize",
        "forget": "Forget",
        "cast": "Cast",
        "rest": "Rest",
        "expended": "Cast today — expended until Rest"
      },
```

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

- [ ] **Step 6: Attempt a build (expected to fail — do not treat as a defect)**

Run: `npm run build 2>&1 | tail -40`
Expected: FAILS, referencing `chat/cast-roll.hbs` not found (or a similar missing-template error) — `spell-actions.ts`'s `castSpell` references a template Task 4 has not created yet. This mirrors SP3's Task 5/Task 6 split exactly; do not create a stub template to work around it. Confirm the failure is ONLY about the missing template (re-read the error output) before moving on.

- [ ] **Step 7: Run the full test suite (unaffected by this task's shell-only changes)**

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, same count as Task 2's end state (no new tests — this task has no pure-zone changes).

- [ ] **Step 8: Commit**

```bash
git add src/sheets/character/spell-actions.ts src/sheets/character/sheet.ts \
  templates/actor/character/spells.hbs lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp4a): memorize/forget/cast/rest actions on the character sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Cast chat card + Apply (damage/healing) chat listener

**Files:**
- Create: `templates/chat/cast-roll.hbs`
- Modify: `src/chat/chat-listeners.ts` — add the `applyCastEffect` action, additively
- Modify: `lang/en.json` — `ADND2E.chat.cast.*` keys
- Modify: `tests/lang/en-coverage.test.ts` — drift block for the new keys

**Interfaces:**
- Consumes: `CastCardContext` shape from Task 1 (`rollResult.label`/`applyContext.{amount,kind}` etc.) — this task's template renders exactly those fields; the existing `ADND2E.chat.damage.{applyToTargets,noTargetsWarning,notOwnerWarning}` keys (SP3) — reused as-is for the Apply button and its warnings, no new keys needed for those three.
- Produces: nothing new for later tasks — this is the last implementation task before the dev-world check.

Before writing anything, read `templates/chat/damage-roll.hbs` and `src/chat/chat-listeners.ts` in full (both already exist from SP3) — they are the direct templates for this task.

- [ ] **Step 1: Write `templates/chat/cast-roll.hbs`**

```hbs
<div class="adnd2e chat-card cast-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{spellName}} ({{localize 'ADND2E.sheet.spells.level' level=spellLevel}})</h3>
  </header>
  <ul class="spell-details">
    {{#if range}}<li>{{localize 'ADND2E.chat.cast.range'}}: {{range}}</li>{{/if}}
    {{#if duration}}<li>{{localize 'ADND2E.chat.cast.duration'}}: {{duration}}</li>{{/if}}
    {{#if castingTime}}<li>{{localize 'ADND2E.chat.cast.castingTime'}}: {{castingTime}}</li>{{/if}}
    {{#if hasSavingThrow}}<li>{{localize 'ADND2E.chat.cast.savingThrow'}}: {{savingThrow}}</li>{{/if}}
  </ul>
  {{#if rollResult}}
    <p class="formula">
      {{localize rollResult.label}}: {{rollResult.formula}} = <strong>{{rollResult.total}}</strong>
    </p>
    <button type="button" data-action="applyCastEffect" data-amount="{{applyContext.amount}}" data-kind="{{applyContext.kind}}">
      {{localize 'ADND2E.chat.damage.applyToTargets'}}
    </button>
  {{/if}}
</div>
```

- [ ] **Step 2: Add the `applyCastEffect` handler to `chat-listeners.ts`**

In `src/chat/chat-listeners.ts`, add this new function BELOW the existing `onApplyDamage` (do not modify `onRollDamage` or `onApplyDamage` — this is purely additive):

```ts
/** Applies a cast spell's rolled damage or healing to every currently
 *  targeted token. A NEW, separate action from SP3's applyDamage (which
 *  always subtracts an unsigned amount and MUST NOT change behavior for
 *  chat cards already posted before this plan) — this handler branches on
 *  an explicit data-kind attribute instead of a signed amount. */
async function onApplyCastEffect(button: HTMLButtonElement): Promise<void> {
  const { amount, kind } = button.dataset as { amount?: string; kind?: string };
  const signedAmount = Number(amount ?? 0);
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: unknown }> } }).user.targets];
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.noTargetsWarning"));
    return;
  }
  const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
  for (const t of targets) {
    const actor = t.actor as {
      isOwner: boolean;
      system: { attributes: { hp: { value: number; max: number; temp?: number } } };
      update(data: Record<string, unknown>): Promise<unknown>;
    } | null;
    if (!actor) continue;
    if (!isGM && !actor.isOwner) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.notOwnerWarning"));
      continue;
    }
    const hp = actor.system.attributes.hp;
    if (kind === "healing") {
      await actor.update({ "system.attributes.hp.value": Math.min(hp.max, hp.value + signedAmount) });
      continue;
    }
    const temp = hp.temp ?? 0;
    const fromTemp = Math.min(temp, signedAmount);
    const fromValue = signedAmount - fromTemp;
    const update: Record<string, unknown> = { "system.attributes.hp.value": hp.value - fromValue };
    if ("temp" in hp) update["system.attributes.hp.temp"] = temp - fromTemp;
    await actor.update(update);
  }
}
```

Then find `registerChatListeners`:

```ts
export function registerChatListeners(): void {
  Hooks.on("renderChatMessageHTML", (_message: unknown, html: HTMLElement) => {
    html.querySelector<HTMLButtonElement>('[data-action="rollDamage"]')?.addEventListener("click", (ev) => {
      void onRollDamage(ev.currentTarget as HTMLButtonElement);
    });
    html.querySelector<HTMLButtonElement>('[data-action="applyDamage"]')?.addEventListener("click", (ev) => {
      void onApplyDamage(ev.currentTarget as HTMLButtonElement);
    });
  });
}
```

Replace with (adding one more `querySelector` line, everything else unchanged):

```ts
export function registerChatListeners(): void {
  Hooks.on("renderChatMessageHTML", (_message: unknown, html: HTMLElement) => {
    html.querySelector<HTMLButtonElement>('[data-action="rollDamage"]')?.addEventListener("click", (ev) => {
      void onRollDamage(ev.currentTarget as HTMLButtonElement);
    });
    html.querySelector<HTMLButtonElement>('[data-action="applyDamage"]')?.addEventListener("click", (ev) => {
      void onApplyDamage(ev.currentTarget as HTMLButtonElement);
    });
    html.querySelector<HTMLButtonElement>('[data-action="applyCastEffect"]')?.addEventListener("click", (ev) => {
      void onApplyCastEffect(ev.currentTarget as HTMLButtonElement);
    });
  });
}
```

- [ ] **Step 3: Add the `ADND2E.chat.cast.*` lang keys**

In `lang/en.json`, find the `"chat"` block's closing (right after the existing `"save"` block, before `"chat"`'s own closing `}`):

```json
      "save": {
        "success": "Success", "failure": "Failure"
      }
    },
```

Replace with:

```json
      "save": {
        "success": "Success", "failure": "Failure"
      },
      "cast": {
        "range": "Range",
        "duration": "Duration",
        "castingTime": "Casting Time",
        "savingThrow": "Saving Throw",
        "damageRoll": "Damage",
        "healingRoll": "Healing"
      }
    },
```

- [ ] **Step 4: Add the drift-test block**

In `tests/lang/en-coverage.test.ts`, find the end of the existing `describe("lang/en.json — SP3 chat/combat strings", ...)` block (its closing `});`), and add this new block immediately after it:

```ts
describe("lang/en.json — SP4a spell memorize/cast strings", () => {
  it("resolves every ADND2E.sheet.spells.{memorize,forget,cast,rest,expended} + ADND2E.chat.cast.* key the spell-actions layer references", () => {
    for (const key of [
      "ADND2E.sheet.spells.memorize",
      "ADND2E.sheet.spells.forget",
      "ADND2E.sheet.spells.cast",
      "ADND2E.sheet.spells.rest",
      "ADND2E.sheet.spells.expended",
      "ADND2E.chat.cast.range",
      "ADND2E.chat.cast.duration",
      "ADND2E.chat.cast.castingTime",
      "ADND2E.chat.cast.savingThrow",
      "ADND2E.chat.cast.damageRoll",
      "ADND2E.chat.cast.healingRoll",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 5: Run the lang drift test**

Run: `npx vitest run tests/lang/en-coverage.test.ts 2>&1 | tail -40`
Expected: PASS.

- [ ] **Step 6: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, coverage unchanged from Task 2's end state on the pure zone (this task touches no pure files).

Ask the user (or check yourself if you have shell access to confirm) whether Foundry is closed, then run:

Run: `npm run build 2>&1 | tail -60`
Expected: clean full build — this is the FIRST clean build of this plan (the `chat/cast-roll.hbs` this task adds is what Task 3's `castSpell` was missing). If it still fails, re-read the error; do not proceed to commit on a failing build.

- [ ] **Step 7: Commit**

```bash
git add templates/chat/cast-roll.hbs src/chat/chat-listeners.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp4a): cast chat card + Apply (damage/healing) button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: GATED dev-world smoke check (Plan 4a)

**Files:** none — this task is verification only, run by the user in a live linked Foundry v14.364 world.

**Interfaces:**
- Consumes: the fully built system from Tasks 1-4.
- Produces: PASS/FAIL confirmation for each step below, required before `finishing-a-development-branch`.

This step is REQUIRED before finishing the branch — never deferred, never skipped, per this repo's standing rule (established the hard way in Sub-project 1, reinforced in SP2 and SP3: code review alone has repeatedly missed real bugs a human click-through caught immediately).

- [ ] **Step 1: Build and link, ask the user to test in their world**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world and, on a wizard character with a known spell in their spellbook and a free slot at that spell's level, walk through spec §6's "Plan 4a dev-world checklist":

1. Memorize a known, spellbook-eligible spell with a free slot — confirm it appears in the memorized list and the level's `used` count increments.
2. Cast it — confirm the entry becomes expended (Cast button disables/disappears), the chat card posts with the spell's info.
3. A spell with `automation.damage` set (create/edit one via the raw-field item sheet or an authored compendium item if none exists — `system.automation.damage` takes a bare dice-formula string like `"3d6"`) — casting it rolls and shows the damage total on the card with an Apply button; clicking Apply (with a token targeted) reduces the target's HP correctly (temp-first, same as SP3).
4. A spell with `automation.healing` set — casting it rolls and shows the healing total; Apply increases the target's `value`, capped at `hp.max`.
5. Forget a memorized (non-expended) spell — it disappears from the memorized list, the slot's `used` count decrements, it's memorizable again.
6. Click Rest — every expended flag clears across both casters; memorized selections are unchanged.
7. A priest character (Cleric or Druid) — confirm sphere-access level-capped spells above the cap cannot be memorized (button absent), and within-cap ones can, with no spellbook/Learn-Spell step involved.
8. Attempt to memorize past a level's slot cap — button is absent once `used === max`.

- [ ] **Step 2: Record the result**

If any step fails, diagnose (console errors, `game.actors.get`/direct document inspection as needed — same debugging pattern established in SP3) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 8 steps PASS.

---

After Task 5 passes: use **superpowers:finishing-a-development-branch**. After merge: Plan 4a complete — Plan 4b (Learn Spell) is the next plan under the same spec.
