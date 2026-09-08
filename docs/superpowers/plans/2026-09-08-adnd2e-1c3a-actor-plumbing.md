# AD&D 2E — Plan 1c.3a: Actor Plumbing + Snapshot-Derive Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the three Actor DataModels (authored schemas), the `documents/` subclasses, and the pure `deriveCharacter` snapshot-derive contract — wired end-to-end but computing only the ability-modifier step — so Plan 1c.3b has a tested pipeline shell to fill; and pay the 1c.2 Item-Schema-typing debt.

**Architecture:** A pure `deriveCharacter(snapshot, options)` in the Foundry-free + 100%-Vitest zone takes an `ActorSnapshot` (plain data) and returns a `CharacterDerived` object the DataModel caches onto `system.*`. `snapshotActor(actor)` is the thin Foundry adapter that builds the snapshot from `actor.system` + `actor.items`. 1c.3a's `deriveCharacter` runs only §5.6 step 2 (ability mods); steps 1 and 3–10 are commented slots for 1c.3b/3c.

**Tech Stack:** TypeScript 5 strict, `fvtt-types` v13-beta, Vite 8 lib build, Vitest 5, ESLint 10 flat config, Foundry VTT **system** (`foundry.abstract.TypeDataModel`, `foundry.data.fields`, `Actor` / `Item` / `ActiveEffect` document classes).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §5.1 (`character`), §5.2 (`npc`), §5.3 (`creature`), §5.6 (derived-data ordering — **steps 1 and 3–10 are deferred to Plans 1c.3b/1c.3c**, see Ruling S1), §4 + §4.1 (two-layer architecture + layer contract), §9 (testing).

## Global Constraints

- **`src/core/**`, `src/data/derive/**`, `src/data/item/{subtypes,choices}.ts`, `src/data/actor/subtypes.ts`, and their tests import NOTHING from `foundry` / `fvtt-types` / `game` / `CONFIG` / `Hooks` / the DOM.** They MAY import from `src/core/**` and (for `src/data/derive/**`) other `src/data/derive/**`. Enforced by `tsconfig.core.json` (`types: []`) and the ESLint `no-restricted-globals` / `no-restricted-imports` block.
- **The DataModel classes, `src/data/actor/snapshot.ts`, `src/data/actor/base-actor.ts`, `src/data/common/**`, and `src/documents/**`** are Foundry-layer — checked only by the base `tsconfig.json`.
- **`defineSchema()` bodies contain no logic** — every choice list from `src/data/item/choices.ts`, every fragment from `src/data/common/` or `src/data/actor/base-actor.ts`. No conditionals, loops, computed values.
- **`core/` and the derive layer never read `game.settings`**; DataModels never construct a `Roll` (spec §4.1). `deriveCharacter` receives the `OptionalRules` bag as a parameter; `CharacterModel.prepareDerivedData` gets it from `getOptionalRules()`.
- **No rulebook prose / spell text / stat blocks.** All HTML description fields ship empty.
- Coverage gate (`npm run test:coverage`): **100%** lines/statements/functions and **≥90%** branches on `src/core/**` + `src/config.ts` + `src/settings/registry.ts` + `src/data/derive/**` + `src/data/item/{subtypes,choices}.ts` + `src/data/actor/subtypes.ts`.
- Full gate = `npm run typecheck && npm run lint && npm run test:coverage && npm run build` (mirrors `.github/workflows/ci.yml`).
- **Do NOT run `npm install` or `npm run format` or any `prettier` command.** Hand-format to satisfy the linter. Vitest cache flake → `rm -rf node_modules/.vite node_modules/.vitest node_modules/.cache` and retry.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Foundry compatibility: `minimum: "13"`, `verified: "14"`.

## Rulings carried from brainstorming

- **S1 — 1c.3a is the first of four slices.** `deriveCharacter` computes only §5.6 step 2 (ability mods). Steps 3–10 (levels, HP, THAC0, AC, saves, slots, proficiency slots, encumbrance) → Plan 1c.3b. Step 1 (`resolveMulticlass` / `resolveDualClass`, which do not yet exist in `core/`) → Plan 1c.3c. `creature`'s `prepareDerivedData` and the `ActiveEffect` `adnd2e` subtype + two-pass affects-base/affects-derived split → Plan 1c.3d. The `ActorSnapshot` type carries forward-looking fields (`classes`) that 1c.3a does not fully consume — this is the contract 1c.3b builds against. Recorded as a plan scope boundary; the spec doc is unchanged.
- **S2 — Item Schema-typing (Task 1) has a fallback ladder.** Preferred: `type Schema = ReturnType<typeof FooItemModel.defineSchema>` (needs the `: foundry.data.fields.DataSchema` return annotation removed so the type is inferred). If that fights the fvtt-types v13-beta generics: write each `Schema` type explicitly. If *that* fights hard: revert Task 1 entirely, keep the loose typing + `this as unknown as {…}` shims, and have `snapshotActor` (Task 5) read embedded-item fields through `Item.SystemOfType<"class">` / `<"race">` casts. The debt is paid at the model or at the one adapter — never both. The implementer picks the rung and records which in the report.
- **S3 — `deriveCharacter` owns the "is this a warrior" decision.** `ActorSnapshot` carries `classes` (with `chassisId`); `deriveCharacter` computes `isWarrior = classes.some((c) => getChassis(c.chassisId).group === "warrior")`. `snapshotActor` only extracts raw data.
- **S4 — a character with no `race` item derives as `"human"`** (no adjustments), and with no `class` items derives as non-warrior. Neither is an error — a freshly-created actor has no embedded items yet.

---

## File Structure

**Created — pure (join the Foundry-free + coverage gate):**
- `src/data/actor/subtypes.ts` — `ACTOR_SUBTYPES: readonly ActorSubtype[]` + `type ActorSubtype = "character" | "npc" | "creature"`.
- `src/data/derive/character/snapshot.ts` — `interface ActorSnapshot`, `interface ClassEntry`, `type DualClassState`.
- `src/data/derive/character/derive.ts` — `deriveCharacter(snapshot, options): CharacterDerived`, `interface CharacterDerived`.
- `src/data/derive/character/index.ts` — barrel.

**Modified — pure:**
- `src/data/item/choices.ts` — add `ALIGNMENTS`, `MOVEMENT_MODES` (drift-checked vs `core/types.ts`), `DISPOSITIONS`, `SAVE_MODES`, `ATTACK_TYPES` (fixed lists).

**Created — Foundry layer (base `tsconfig.json` only):**
- `src/data/actor/base-actor.ts` — `actorCommonSchema()` + `abstract class Adnd2eActorModel extends foundry.abstract.TypeDataModel`.
- `src/data/actor/character.ts` `npc.ts` `creature.ts` — one `TypeDataModel` subclass each.
- `src/data/actor/snapshot.ts` — `snapshotActor(actor): ActorSnapshot` (thin adapter).
- `src/data/actor/index.ts` — `ACTOR_DATA_MODELS: Record<ActorSubtype, …>`.
- `src/documents/actor.ts` `item.ts` `active-effect.ts` `index.ts` — thin document subclasses.

**Modified — Foundry layer:**
- `src/data/item/base-item.ts` + the 9 `src/data/item/*ItemModel` files — Task 1 (Schema parameterization).
- `src/system.ts` — init hook: `CONFIG.{Actor,Item,ActiveEffect}.documentClass` + `CONFIG.Actor.dataModels`.
- `src/types/global.d.ts` — `DataModelConfig.Actor` augmentation.
- `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js` — add `src/data/actor/subtypes.ts` (the `src/data/derive/**` globs already cover `src/data/derive/character/**` and `tests/data/**` already covers the new tests).

**Created — tests:**
- `tests/data/actor-subtypes.test.ts`
- `tests/data/derive/character/derive.test.ts`
- `tests/data/choices.test.ts` — extended (new arrays).

---

## Task 1: Item Schema-typing debt

**Files:**
- Modify: `src/data/item/base-item.ts`, and all nine of `src/data/item/{class,race,weapon,armor,equipment,spell,weapon-proficiency,nonweapon-proficiency,class-feature}.ts`

**Interfaces:**
- Produces: `export namespace FooItemModel { export type Schema = ReturnType<typeof FooItemModel.defineSchema> }` for each of the nine + the base; each class becomes `extends Adnd2eItemModel<FooItemModel.Schema>` (base: `extends foundry.abstract.TypeDataModel<Adnd2eItemModel.Schema, Item.Implementation>` — see below).

- [ ] **Step 1: Baseline — capture the green suite**

Run: `npm run test:coverage`
Expected: 404 tests pass, 100% coverage. This is the regression check for the whole task — no new tests are added (a `defineSchema()` body cannot run without a Foundry runtime, spec §9).

- [ ] **Step 2: Parameterize `src/data/item/base-item.ts`**

```ts
import { htmlField } from "../common/fields";

export abstract class Adnd2eItemModel<
  Schema extends foundry.data.fields.DataSchema = Adnd2eItemModel.Schema,
> extends foundry.abstract.TypeDataModel<Schema, Item.Implementation> {
  static defineSchema() {
    return { description: htmlField() };
  }

  override prepareDerivedData(): void {
    // Subclasses override; base contributes nothing.
  }
}

export namespace Adnd2eItemModel {
  export type Schema = ReturnType<typeof Adnd2eItemModel.defineSchema>;
}
```

The `: foundry.data.fields.DataSchema` return annotation is **removed** so `ReturnType` sees the real `{ description: HTMLField }` shape.

- [ ] **Step 3: Parameterize each of the nine model files**

For every `src/data/item/<name>.ts`, apply the same three edits. Example — `weapon.ts`:

```ts
export class WeaponItemModel extends Adnd2eItemModel<WeaponItemModel.Schema> {
  static override defineSchema() {                 // ← drop the `: foundry.data.fields.DataSchema`
    return {
      ...super.defineSchema(),
      // …unchanged field declarations…
    };
  }

  override prepareDerivedData(): void {
    // `this.parent`, `this.weight`, `this.category`, … are now typed —
    // replace `const sys = this as unknown as {…}` with direct `this.<field>` reads.
    const name = (this.parent as { name?: string } | undefined)?.name ?? "";
    this.totalWeight = totalWeight({ weight: this.weight, quantity: this.quantity });
    this.weaponData = toWeaponData({ name, category: this.category, /* … */ });
  }
}

export namespace WeaponItemModel {
  export type Schema = ReturnType<typeof WeaponItemModel.defineSchema>;
}
```

Notes:
- The derived properties a model writes (`this.totalWeight`, `this.weaponData`, `this.level`, `this.canLevelUp`, `this.acContribution`) are **not** in `defineSchema`, so `this.x = …` will not type-check against the inferred `Schema`. Declare them on the class: `declare totalWeight: number;` `declare weaponData: import("../derive/weapon").WeaponData;` etc. — one `declare` per derived field, matching the value the helper returns.
- `class.ts` / `race.ts` keep their `import type { ClassId } …` etc. only if still referenced after the shim removal.
- Do the nine in any order; commit once at the end of the task.

- [ ] **Step 4: Gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green, still 404 tests / 100% coverage.

**If `ReturnType<typeof …>` produces a `tsc` error** (circular-reference or fvtt-types generic rejection): per Ruling S2, first try writing each `Schema` type explicitly (a `type Schema = { description: ReturnType<typeof htmlField>; category: foundry.data.fields.StringField<…>; … }` per model). **If that also fights hard after one genuine attempt**, revert every file in this task to its `1c.2` state (`git checkout <the 10 files>`), commit nothing for Task 1, and record in the report that Task 1 is deferred and `snapshotActor` (Task 5) must use `Item.SystemOfType<…>` casts. Then proceed to Task 2.

- [ ] **Step 5: Commit** (skip if Task 1 was reverted)

```bash
git add src/data/item
git commit -m "refactor(data): parameterize Item DataModels with named Schema types; drop the loose-cast shims"
```

---

## Task 2: `choices.ts` additions + `src/data/actor/subtypes.ts`

**Files:**
- Modify: `src/data/item/choices.ts`
- Create: `src/data/actor/subtypes.ts`
- Create: `tests/data/actor-subtypes.test.ts`
- Modify: `tests/data/choices.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js`

**Interfaces:**
- Consumes: `Alignment`, `MovementMode` from `src/core/types.ts`.
- Produces:
  - `choices.ts`: `ALIGNMENTS: readonly Alignment[]`, `MOVEMENT_MODES: readonly MovementMode[]`, `DISPOSITIONS: readonly string[]` (`["friendly","neutral","hostile"]`), `SAVE_MODES: readonly string[]` (`["explicit","asClass"]`), `ATTACK_TYPES: readonly string[]` (`["melee","ranged"]`).
  - `subtypes.ts`: `type ActorSubtype = "character" | "npc" | "creature"`, `const ACTOR_SUBTYPES: readonly ActorSubtype[]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/data/choices.test.ts`:

```ts
import {
  ALIGNMENTS, MOVEMENT_MODES, DISPOSITIONS, SAVE_MODES, ATTACK_TYPES,
} from "../../src/data/item/choices";

describe("actor schema choice arrays", () => {
  it("ALIGNMENTS = the 9 core Alignment members", () => {
    expect([...ALIGNMENTS].sort()).toEqual(
      [
        "lawful-good", "neutral-good", "chaotic-good",
        "lawful-neutral", "true-neutral", "chaotic-neutral",
        "lawful-evil", "neutral-evil", "chaotic-evil",
      ].sort(),
    );
  });
  it("MOVEMENT_MODES = land/burrow/climb/fly/swim", () => {
    expect(MOVEMENT_MODES).toEqual(["land", "burrow", "climb", "fly", "swim"]);
  });
  it("fixed lists", () => {
    expect([...DISPOSITIONS].sort()).toEqual(["friendly", "hostile", "neutral"]);
    expect([...SAVE_MODES].sort()).toEqual(["asClass", "explicit"]);
    expect([...ATTACK_TYPES].sort()).toEqual(["melee", "ranged"]);
  });
});
```

`tests/data/actor-subtypes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import manifest from "../../system.json";
import { ACTOR_SUBTYPES } from "../../src/data/actor/subtypes";

describe("ACTOR_SUBTYPES", () => {
  it("matches system.json documentTypes.Actor exactly", () => {
    const declared = Object.keys(
      (manifest as unknown as { documentTypes: { Actor: Record<string, unknown> } }).documentTypes.Actor,
    ).sort();
    expect([...ACTOR_SUBTYPES].sort()).toEqual(declared);
  });
  it("has no duplicates", () => {
    expect(new Set(ACTOR_SUBTYPES).size).toBe(ACTOR_SUBTYPES.length);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/data/choices.test.ts tests/data/actor-subtypes.test.ts`
Expected: FAIL — new exports / module missing.

- [ ] **Step 3: Extend `src/data/item/choices.ts`**

Add `Alignment`, `MovementMode` to the `import type … from "../../core/types"` line, then append:

```ts
export const ALIGNMENTS: readonly Alignment[] = [
  "lawful-good", "neutral-good", "chaotic-good",
  "lawful-neutral", "true-neutral", "chaotic-neutral",
  "lawful-evil", "neutral-evil", "chaotic-evil",
];

export const MOVEMENT_MODES: readonly MovementMode[] = ["land", "burrow", "climb", "fly", "swim"];

export const DISPOSITIONS: readonly string[] = ["friendly", "neutral", "hostile"];
export const SAVE_MODES: readonly string[] = ["explicit", "asClass"];
export const ATTACK_TYPES: readonly string[] = ["melee", "ranged"];
```

- [ ] **Step 4: Create `src/data/actor/subtypes.ts`**

```ts
// The three Actor sub-types this system registers (must equal system.json
// documentTypes.Actor — asserted in tests/data/actor-subtypes.test.ts).
export type ActorSubtype = "character" | "npc" | "creature";

export const ACTOR_SUBTYPES: readonly ActorSubtype[] = ["character", "npc", "creature"];
```

- [ ] **Step 5: Wire the pure zone**

- `tsconfig.core.json` `include`: append `"src/data/actor/subtypes.ts"`.
- `vitest.config.ts` `coverage.include`: append `"src/data/actor/subtypes.ts"`.
- `eslint.config.js`: append `"src/data/actor/subtypes.ts"` to BOTH the Foundry-globals `ignores` array and the pure-zone `files` array.

(`src/data/derive/character/**` needs no new config — `"src/data/derive/**"` / `"src/data/derive/**/*.ts"` already cover it in all three places, and `tests/data/**` already covers the new test dir.)

- [ ] **Step 6: Run tests + gate**

Run: `npx vitest run tests/data/` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `choices.ts` + `subtypes.ts` at 100%.

- [ ] **Step 7: Commit**

```bash
git add src/data/item/choices.ts src/data/actor/subtypes.ts tests/data/ tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(data): actor subtype list + alignment/movement/disposition schema enums"
```

---

## Task 3: The pure `deriveCharacter` contract

**Files:**
- Create: `src/data/derive/character/snapshot.ts`, `src/data/derive/character/derive.ts`, `src/data/derive/character/index.ts`
- Create: `tests/data/derive/character/derive.test.ts`

**Interfaces:**
- Consumes: `deriveAbilities` from `src/core/abilities`; `getChassis` from `src/core/classes/chassis`; `AbilityScores`, `Race`, `ClassId`, `WizardSchool`, `DerivedAbilities` from `src/core/types`; `OptionalRules` from `src/core/options`.
- Produces:
  - `type DualClassState = "primary" | "suppressed" | "active"`
  - `interface ClassEntry { chassisId: ClassId; specialistSchool: WizardSchool | null; xp: number; hpRolls: readonly number[]; dualClassState: DualClassState | null }`
  - `interface ActorSnapshot { abilities: AbilityScores; exceptionalStrengthPercentile: number | null; race: Race | null; classes: readonly ClassEntry[] }`
  - `interface CharacterDerived { abilities: DerivedAbilities }`
  - `function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived`

- [ ] **Step 1: Write the failing test** — `tests/data/derive/character/derive.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";

const base: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [],
};

const fighterClass = {
  chassisId: "fighter" as const,
  specialistSchool: null,
  xp: 0,
  hpRolls: [] as number[],
  dualClassState: null,
};
const mageClass = { ...fighterClass, chassisId: "mage" as const };

describe("deriveCharacter", () => {
  it("returns ability mods (§5.6 step 2)", () => {
    const d = deriveCharacter(base, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores).toEqual(base.abilities);
    expect(d.abilities.str.hitProb).toBe(0); // STR 12 -> no hit bonus
    expect(d.abilities.con.hpAdjustment).toBe(0); // CON 12 -> no hp adj
  });

  it("no race item -> derives as human (no racial adjustment)", () => {
    const dwarfLike = deriveCharacter({ ...base, race: null, abilities: { ...base.abilities, con: 14 } }, DEFAULT_OPTIONAL_RULES);
    expect(dwarfLike.abilities.scores.con).toBe(14); // human: no delta
  });

  it("applies the racial delta when a race is present", () => {
    const d = deriveCharacter({ ...base, race: "dwarf", abilities: { ...base.abilities, con: 14, cha: 14 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores.con).toBe(15); // dwarf +1 CON
    expect(d.abilities.scores.cha).toBe(13); // dwarf -1 CHA
  });

  it("a warrior class unlocks the full Constitution hp bonus band", () => {
    const nonWarrior = deriveCharacter({ ...base, classes: [mageClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    const warrior = deriveCharacter({ ...base, classes: [fighterClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    expect(warrior.abilities.con.hpAdjustment).toBeGreaterThan(nonWarrior.abilities.con.hpAdjustment);
  });

  it("a mixed class list counts as warrior if any class is a warrior", () => {
    const d = deriveCharacter({ ...base, classes: [mageClass, fighterClass], abilities: { ...base.abilities, con: 18 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.con.hpAdjustment).toBeGreaterThan(0);
  });

  it("exceptional Strength: warrior, STR 18, percentile set, toggle on", () => {
    const d = deriveCharacter(
      { ...base, classes: [fighterClass], abilities: { ...base.abilities, str: 18 }, exceptionalStrengthPercentile: 100 },
      DEFAULT_OPTIONAL_RULES,
    );
    expect(d.abilities.str.hitProb).toBe(3); // 18/00 -> +3 to hit
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/data/derive/character/derive.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/data/derive/character/snapshot.ts`**

```ts
// The plain-data view of a character the engine derives from. `snapshotActor`
// (src/data/actor/snapshot.ts) builds this from the Foundry Actor; deriveCharacter
// consumes only this. Fields beyond what 1c.3a uses (`classes`) are the forward
// contract Plan 1c.3b fills.
import type { AbilityScores, ClassId, Race, WizardSchool } from "../../../core/types";

export type DualClassState = "primary" | "suppressed" | "active";

export interface ClassEntry {
  chassisId: ClassId;
  specialistSchool: WizardSchool | null;
  xp: number;
  hpRolls: readonly number[];
  dualClassState: DualClassState | null;
}

export interface ActorSnapshot {
  abilities: AbilityScores;
  /** `abilities.str.exceptional` — the d100 exceptional-Strength roll, or `null` */
  exceptionalStrengthPercentile: number | null;
  /** the embedded `race` item's `raceId`, or `null` for a race-less actor */
  race: Race | null;
  classes: readonly ClassEntry[];
}
```

- [ ] **Step 4: Create `src/data/derive/character/derive.ts`**

```ts
// The character derived-data pipeline (spec §5.6). Pure — takes a snapshot + the
// optional-rules bag, returns the object CharacterModel caches onto system.*.
// 1c.3a implements step 2 only; the numbered slots below are Plan 1c.3b/1c.3c.
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type { DerivedAbilities } from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import type { ActorSnapshot } from "./snapshot";

export interface CharacterDerived {
  abilities: DerivedAbilities;
}

export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");

  // §5.6 step 1 — resolveMulticlass / resolveDualClass — Plan 1c.3c
  // §5.6 step 2 — ability modifiers
  const abilities = deriveAbilities(snapshot.abilities, {
    race: snapshot.race ?? "human",
    isWarrior,
    options,
    exceptionalStrengthPercentile: snapshot.exceptionalStrengthPercentile,
  });
  // §5.6 step 3 — levelForXp per class -> canLevelUp — Plan 1c.3b
  // §5.6 step 4 — HP max — Plan 1c.3b
  // §5.6 step 5 — THAC0 — Plan 1c.3b
  // §5.6 step 6 — AC — Plan 1c.3b
  // §5.6 step 7 — saves — Plan 1c.3b
  // §5.6 step 8 — spell slots — Plan 1c.3b
  // §5.6 step 9 — proficiency slots — Plan 1c.3b
  // §5.6 step 10 — encumbrance — Plan 1c.3b

  return { abilities };
}
```

- [ ] **Step 5: Create `src/data/derive/character/index.ts`**

```ts
export * from "./snapshot";
export * from "./derive";
```

- [ ] **Step 6: Run test + gate**

Run: `npx vitest run tests/data/derive/character/` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `deriveCharacter` at 100% — the `?? "human"` branch (race null / non-null) and the `.some()` predicate (warrior / non-warrior class) are all exercised by the tests above. `index.ts` is an `export *` barrel (no executable statements) — if v8 flags it, add `"src/data/derive/character/index.ts"` to `vitest.config.ts` `coverage.exclude` alongside `src/core/index.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/data/derive/character tests/data/derive/character
git commit -m "feat(data): pure deriveCharacter contract — ActorSnapshot + step-2 ability mods"
```

---

## Task 4: The three Actor DataModels

**Files:**
- Create: `src/data/actor/base-actor.ts`, `src/data/actor/character.ts`, `src/data/actor/npc.ts`, `src/data/actor/creature.ts`, `src/data/actor/index.ts`

**Interfaces:**
- Consumes: `foundry.data.fields` + `foundry.abstract.TypeDataModel` (globals); `htmlField` / `currencySchema` from `src/data/common/fields.ts`; `ALIGNMENTS`, `MOVEMENT_MODES`, `DISPOSITIONS`, `SAVE_MODES`, `ATTACK_TYPES`, `ABILITY_KEYS`, `CREATURE_SIZES`, `CLASS_IDS`, `SPELL_SCHOOLS`, `SPHERE_NAMES` from `src/data/item/choices.ts`; `ActorSubtype` from `src/data/actor/subtypes.ts`; `deriveCharacter` from `src/data/derive/character`; `snapshotActor` from `src/data/actor/snapshot.ts` (Task 5 — but Task 4's `character.ts` imports it; create a stub `snapshot.ts` in Task 4 Step 4 and flesh it in Task 5, OR order Task 5's `snapshot.ts` before Task 4's `character.ts` — see the task note).
- Produces: `Adnd2eActorModel` (abstract), `CharacterModel`, `NpcModel`, `CreatureModel`, `ACTOR_DATA_MODELS: Record<ActorSubtype, …>`.

**Task note:** `character.ts`/`npc.ts` reference `snapshotActor`. To keep this task self-contained, **Step 4 of this task creates `src/data/actor/snapshot.ts` with a minimal working `snapshotActor`** (enough for the smoke check); Task 5 then hardens it (race/class walk edge cases, the Schema-cast fallback from Ruling S2). If you are executing tasks strictly in order, that is the sequence; if not, ensure `snapshot.ts` exists before `character.ts` compiles.

- [ ] **Step 1: `src/data/actor/base-actor.ts`**

```ts
// Shared authored-schema fragment for `character` + `npc`, and the abstract
// TypeDataModel base for all three actor models. Foundry-layer; no logic.
import { htmlField } from "../common/fields";
import { ABILITY_KEYS, ALIGNMENTS, SPELL_SCHOOLS, SPHERE_NAMES } from "../item/choices";

const { StringField, NumberField, SchemaField, ArrayField, ObjectField } = foundry.data.fields;

function abilitiesSchema() {
  const entry = () =>
    new SchemaField({
      score: new NumberField({ required: true, integer: true, min: 1, initial: 10 }),
      exceptional: new NumberField({ required: true, nullable: true, integer: true, min: 1, max: 100, initial: null }),
    });
  return new SchemaField(Object.fromEntries(ABILITY_KEYS.map((k) => [k, entry()])));
}

export function actorCommonSchema(): foundry.data.fields.DataSchema {
  return {
    abilities: abilitiesSchema(),
    details: new SchemaField({
      alignment: new StringField({ required: true, blank: false, initial: "true-neutral", choices: ALIGNMENTS }),
      deity: new StringField({ required: true, blank: true, initial: "" }),
      kit: new StringField({ required: true, blank: true, initial: "" }),
      homeland: new StringField({ required: true, blank: true, initial: "" }),
      age: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      sex: new StringField({ required: true, blank: true, initial: "" }),
      height: new StringField({ required: true, blank: true, initial: "" }),
      weight: new StringField({ required: true, blank: true, initial: "" }),
      hairEyes: new StringField({ required: true, blank: true, initial: "" }),
      campaignNotes: htmlField(),
      gmNotes: htmlField(),
    }),
    attributes: new SchemaField({
      hp: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 0 }),
        rolls: new ArrayField(new NumberField({ required: true, integer: true, min: 0 }), { required: true, initial: [] }),
        temp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        nonlethal: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
    }),
    currency: new SchemaField({
      pp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      gp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ep: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      sp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      cp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    }),
    resources: new SchemaField({
      reputation: new StringField({ required: true, blank: true, initial: "" }),
      henchmen: new StringField({ required: true, blank: true, initial: "" }),
      followers: new StringField({ required: true, blank: true, initial: "" }),
    }),
    spellcasting: new SchemaField({
      wizard: new SchemaField({
        specialistSchool: new StringField({ required: true, nullable: true, initial: null, choices: SPELL_SCHOOLS }),
        opposedSchools: new ArrayField(new StringField({ required: true, blank: false, choices: SPELL_SCHOOLS }), { required: true, initial: [] }),
        spellbookItemIds: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
      }),
      priest: new SchemaField({
        sphereAccessOverride: new ArrayField(new StringField({ required: true, blank: false, choices: SPHERE_NAMES }), { required: true, nullable: true, initial: null }),
      }),
    }),
    biography: htmlField(),
    options: new SchemaField({
      combatAndTactics: new foundry.data.fields.ObjectField({ required: true, initial: {} }),
      skillsAndPowers: new foundry.data.fields.ObjectField({ required: true, initial: {} }),
      spellsAndMagic: new foundry.data.fields.ObjectField({ required: true, initial: {} }),
    }),
  };
}

export abstract class Adnd2eActorModel<
  Schema extends foundry.data.fields.DataSchema = foundry.data.fields.DataSchema,
> extends foundry.abstract.TypeDataModel<Schema, Actor.Implementation> {
  override prepareDerivedData(): void {
    // Subclasses override.
  }
}
```

(The `memorized` sub-arrays from spec §5.1 — `MemorizedEntry[]` — are deferred to Plan 1c.3b/1c.3d with the spell-slot pipeline; not in this schema yet. Note it in the report.)

- [ ] **Step 2: `src/data/actor/character.ts`**

```ts
import { deriveCharacter } from "../derive/character";
import { getOptionalRules } from "../../settings";
import { actorCommonSchema, Adnd2eActorModel } from "./base-actor";
import { snapshotActor } from "./snapshot";

export class CharacterModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { ...actorCommonSchema() };
  }

  override prepareDerivedData(): void {
    const derived = deriveCharacter(snapshotActor(this.parent), getOptionalRules());
    const abil = this as unknown as {
      abilities: Record<string, { score: number; mods?: unknown }>;
    };
    for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      abil.abilities[k].mods = derived.abilities[k];
    }
  }
}
```

(`this.parent` is the `Actor` document. The `this as unknown as {…}` here is the *actor-model* shim — Ruling S2's Task 1 covers the item models; the actor models get named `Schema` types in Plan 1c.3b when the pipeline's write surface is known. Keep the shim for 1c.3a.)

- [ ] **Step 3: `src/data/actor/npc.ts`**

```ts
import { deriveCharacter } from "../derive/character";
import { getOptionalRules } from "../../settings";
import { DISPOSITIONS } from "../item/choices";
import { actorCommonSchema, Adnd2eActorModel } from "./base-actor";
import { snapshotActor } from "./snapshot";

const { StringField, NumberField, SchemaField } = foundry.data.fields;

export class NpcModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...actorCommonSchema(),
      npc: new SchemaField({
        morale: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        xpValue: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        disposition: new StringField({ required: true, blank: false, initial: "neutral", choices: DISPOSITIONS }),
      }),
    };
  }

  override prepareDerivedData(): void {
    const derived = deriveCharacter(snapshotActor(this.parent), getOptionalRules());
    const abil = this as unknown as {
      abilities: Record<string, { score: number; mods?: unknown }>;
    };
    for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      abil.abilities[k].mods = derived.abilities[k];
    }
  }
}
```

**Ruling A1 (make it, record it):** spec §5.2 places `morale` under `attributes` and `xpValue` / `disposition` under `details`. Re-opening a shared `SchemaField` to inject fields is fragile in `foundry.data.fields`, so the three NPC-only fields go in one dedicated `npc` `SchemaField` (`system.npc.{morale,xpValue,disposition}`) and `actorCommonSchema()` is spread untouched. Cost if wrong: the NPC sheet (SP6) reads `system.npc.disposition` instead of `system.details.disposition` — a template path change, no data migration.

- [ ] **Step 4: `src/data/actor/creature.ts`** (standalone §5.3 schema)

```ts
import { htmlField } from "../common/fields";
import { ALIGNMENTS, ATTACK_TYPES, CLASS_IDS, CREATURE_SIZES, MOVEMENT_MODES, SAVE_MODES } from "../item/choices";
import { Adnd2eActorModel } from "./base-actor";

const { StringField, NumberField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;

export class CreatureModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      hd: new SchemaField({
        count: new NumberField({ required: true, min: 0, initial: 1 }),
        dieType: new NumberField({ required: true, integer: true, initial: 8 }),
        bonus: new NumberField({ required: true, integer: true, initial: 0 }),
        fixedHp: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
      }),
      attributes: new SchemaField({
        hp: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        }),
        ac: new SchemaField({ value: new NumberField({ required: true, integer: true, initial: 10 }) }),
        thac0: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 20 }),
          asFighterLevel: new NumberField({ required: true, nullable: true, integer: true, min: 1, initial: null }),
        }),
        movement: new SchemaField(
          Object.fromEntries(MOVEMENT_MODES.map((m) => [m, new NumberField({ required: true, integer: true, min: 0, initial: m === "land" ? 12 : 0 })])),
        ),
        flyManeuverability: new StringField({ required: true, blank: true, initial: "" }),
      }),
      attacks: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true, blank: true, initial: "" }),
          count: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
          damage: new StringField({ required: true, blank: true, initial: "" }),
          thac0Override: new NumberField({ required: true, nullable: true, integer: true, initial: null }),
          type: new StringField({ required: true, blank: false, initial: "melee", choices: ATTACK_TYPES }),
          special: new StringField({ required: true, blank: true, initial: "" }),
        }),
        { required: true, initial: [] },
      ),
      saves: new SchemaField({
        mode: new StringField({ required: true, blank: false, initial: "explicit", choices: SAVE_MODES }),
        explicit: new SchemaField({
          ppd: new NumberField({ required: true, integer: true, initial: 20 }),
          rsw: new NumberField({ required: true, integer: true, initial: 20 }),
          pp: new NumberField({ required: true, integer: true, initial: 20 }),
          bw: new NumberField({ required: true, integer: true, initial: 20 }),
          spell: new NumberField({ required: true, integer: true, initial: 20 }),
        }),
        asClass: new SchemaField({
          group: new StringField({ required: true, blank: true, initial: "" }),
          level: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
        }),
      }),
      details: new SchemaField({
        size: new StringField({ required: true, blank: false, initial: "medium", choices: CREATURE_SIZES }),
        alignment: new StringField({ required: true, blank: false, initial: "true-neutral", choices: ALIGNMENTS }),
        intelligence: new StringField({ required: true, blank: true, initial: "" }),
        morale: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        magicResistance: new NumberField({ required: true, integer: true, min: 0, max: 100, initial: 0 }),
        treasureType: new StringField({ required: true, blank: true, initial: "" }),
        numberAppearing: new StringField({ required: true, blank: true, initial: "" }),
        xpValue: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
        specialAttacks: htmlField(),
        specialDefenses: htmlField(),
        description: htmlField(),
      }),
      biography: htmlField(),
    };
  }
  // NO prepareDerivedData — the creature derive path is Plan 1c.3d.
}
```

(`CLASS_IDS` / `BooleanField` imports appear if you use them; `saves.asClass.group` is a free-text string here rather than a `ClassGroup` choice because monster stat blocks say "as a 10th-level fighter" loosely — a stricter choice can come in 1c.3d.)

- [ ] **Step 5: `src/data/actor/index.ts`**

```ts
import type { ActorSubtype } from "./subtypes";
import { CharacterModel } from "./character";
import { NpcModel } from "./npc";
import { CreatureModel } from "./creature";

export { CharacterModel, NpcModel, CreatureModel };

export const ACTOR_DATA_MODELS: Record<
  ActorSubtype,
  typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, Actor.Implementation>
> = {
  character: CharacterModel,
  npc: NpcModel,
  creature: CreatureModel,
};
```

(Same `Record<ActorSubtype, …>` completeness-guard pattern as 1c.2's `ITEM_DATA_MODELS`. Widen the value type per the 1c.2 precedent only if `tsc` rejects the narrow form.)

- [ ] **Step 6: Gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. No new unit tests (Foundry-layer). `npm run build` bundles the three models.

- [ ] **Step 7: Commit**

```bash
git add src/data/actor
git commit -m "feat(data): character/npc/creature Actor DataModels (authored schemas)"
```

---

## Task 5: `snapshotActor` + `documents/` + registration

**Files:**
- Create (or finish): `src/data/actor/snapshot.ts`
- Create: `src/documents/actor.ts`, `src/documents/item.ts`, `src/documents/active-effect.ts`, `src/documents/index.ts`
- Modify: `src/system.ts`, `src/types/global.d.ts`

**Interfaces:**
- Consumes: `ActorSnapshot`, `ClassEntry`, `DualClassState` from `src/data/derive/character`; `Race`, `ClassId`, `WizardSchool` from `src/core/types`; `ACTOR_DATA_MODELS` from `src/data/actor`.
- Produces: `snapshotActor(actor): ActorSnapshot`; `Adnd2eActor`, `Adnd2eItem`, `Adnd2eActiveEffect`.

- [ ] **Step 1: Finish `src/data/actor/snapshot.ts`**

```ts
// Thin Foundry adapter: builds the pure ActorSnapshot from a character/npc Actor.
// Not unit-tested (spec §9) — dev-world verified. All logic lives in deriveCharacter.
import type { ActorSnapshot, ClassEntry, DualClassState } from "../derive/character";
import type { ClassId, Race, WizardSchool } from "../../core/types";

interface ClassItemSystem {
  chassisId: ClassId;
  specialistSchool: WizardSchool | null;
  xp: number;
  hpRolls: readonly number[];
  dualClassState: DualClassState | null;
}
interface RaceItemSystem {
  raceId: Race;
}

export function snapshotActor(actor: {
  system: { abilities: Record<string, { score: number; exceptional: number | null }> };
  items: Iterable<{ type: string; system: unknown }>;
}): ActorSnapshot {
  const items = [...actor.items];
  const raceItem = items.find((i) => i.type === "race");
  const classes: ClassEntry[] = items
    .filter((i) => i.type === "class")
    .map((i) => {
      const s = i.system as ClassItemSystem;
      return {
        chassisId: s.chassisId,
        specialistSchool: s.specialistSchool,
        xp: s.xp,
        hpRolls: s.hpRolls,
        dualClassState: s.dualClassState,
      };
    });
  const a = actor.system.abilities;
  return {
    abilities: {
      str: a.str.score, dex: a.dex.score, con: a.con.score,
      int: a.int.score, wis: a.wis.score, cha: a.cha.score,
    },
    exceptionalStrengthPercentile: a.str.exceptional,
    race: raceItem ? (raceItem.system as RaceItemSystem).raceId : null,
    classes,
  };
}
```

If Ruling S2's Task 1 succeeded, replace the `as ClassItemSystem` / `as RaceItemSystem` casts with `Item.SystemOfType<"class">` / `<"race">`. If Task 1 was reverted (loose typing kept), the casts above are the fallback Ruling S2 names — keep them and note it.

- [ ] **Step 2: `src/documents/actor.ts` / `item.ts` / `active-effect.ts`**

```ts
// src/documents/actor.ts
/** System Actor document. Thin — prepare-ordering + getRollData overrides land with
 *  the derived-data pipeline (Plan 1c.3b) and the two-pass ActiveEffect split (1c.3d). */
export class Adnd2eActor extends Actor {}
```

```ts
// src/documents/item.ts
export class Adnd2eItem extends Item {}
```

```ts
// src/documents/active-effect.ts
export class Adnd2eActiveEffect extends ActiveEffect {}
```

If `extends Actor` / `Item` / `ActiveEffect` (bare globals) is rejected by fvtt-types v13-beta, use `extends foundry.documents.BaseActor` etc. or the form the beta documents — acceptance criterion: `npm run typecheck` clean and the class is assignable to `CONFIG.Actor.documentClass`.

- [ ] **Step 3: `src/documents/index.ts`**

```ts
export { Adnd2eActor } from "./actor";
export { Adnd2eItem } from "./item";
export { Adnd2eActiveEffect } from "./active-effect";
```

- [ ] **Step 4: Wire `src/system.ts`**

Add imports and, in the `init` hook after the existing `CONFIG.Item.dataModels` line:

```ts
import { ACTOR_DATA_MODELS } from "./data/actor";
import { Adnd2eActiveEffect, Adnd2eActor, Adnd2eItem } from "./documents";
// …
  CONFIG.Actor.documentClass = Adnd2eActor;
  CONFIG.Item.documentClass = Adnd2eItem;
  CONFIG.ActiveEffect.documentClass = Adnd2eActiveEffect;
  CONFIG.Actor.dataModels = ACTOR_DATA_MODELS;
```

Cast the RHS (`as typeof CONFIG.Actor.dataModels` etc.) only if `tsc` demands it, matching the 1c.2 precedent for `CONFIG.Item.dataModels`.

- [ ] **Step 5: `src/types/global.d.ts` — `DataModelConfig.Actor`**

Add inside the `declare global` block, next to the existing `DataModelConfig.Item`:

```ts
  interface DataModelConfig {
    Actor: {
      character: typeof import("../data/actor/character").CharacterModel;
      npc: typeof import("../data/actor/npc").NpcModel;
      creature: typeof import("../data/actor/creature").CreatureModel;
    };
    Item: {
      // …unchanged 9 entries…
    };
  }
```

(Merge into the one `interface DataModelConfig` — do not declare it twice.)

- [ ] **Step 6: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green. `dist/system.js` now bundles the actor models + `deriveCharacter` + the document classes. Verify no scratch file left behind.

- [ ] **Step 7: Commit**

```bash
git add src/data/actor/snapshot.ts src/documents src/system.ts src/types/global.d.ts
git commit -m "feat(system): register Actor DataModels + document classes; snapshotActor adapter"
```

---

## Self-Review

**1. Spec coverage.**

| Spec | Task | Notes |
|---|---|---|
| §5.1 `character` authored schema | Task 4 (`actorCommonSchema` + `CharacterModel`) | `memorized: MemorizedEntry[]` deferred to 1c.3b with the slot pipeline (noted in Task 4 Step 1) |
| §5.1 derived — `abilities.<k>.mods` | Task 3 (`deriveCharacter` step 2) + Task 4/5 (wire) | all other derived fields → Plan 1c.3b (Ruling S1) |
| §5.2 `npc` = shared + morale/xpValue/disposition | Task 4 (`NpcModel`) | Ruling A1 — NPC-only detail fields in a separate `npcDetails` SchemaField |
| §5.3 `creature` authored schema | Task 4 (`CreatureModel`) | no `prepareDerivedData` — Plan 1c.3d (Ruling S1) |
| §5.6 pipeline ordering | Task 3 (`derive.ts` numbered slots) | steps 1, 3–10 are commented slots — Plan 1c.3b/1c.3c |
| §5.5 `ActiveEffect` `adnd2e` subtype | — | Plan 1c.3d (Ruling S1); `Adnd2eActiveEffect` document stub only, here |
| §4 `documents/` thin subclasses | Task 5 | empty bodies — override points land with their consumers |
| §4 `CONFIG.Actor.dataModels` + `documentClass` | Task 5 | |
| §4 `global.d.ts` augmentation | Task 5 | |
| §9 pure-core testing | Tasks 2–3 (100% gate); Tasks 1, 4, 5 typecheck + `build` + dev-world | |
| 1c.2 carry-forward — Item Schema typing | Task 1 | Ruling S2 fallback ladder |

Gaps: none for 1c.3a's declared scope. `MemorizedEntry`, the ActiveEffect subtype, and pipeline steps 1/3–10 are explicitly deferred.

**2. Placeholder scan.** No "TBD" / "handle edge cases" / "similar to Task N". Every schema and the derive function are written out. The fvtt-types fallbacks (S2, document `extends`, `Record<ActorSubtype>` widening) are concrete alternatives with stated acceptance criteria.

**3. Type consistency.**
- `ActorSubtype` / `ACTOR_SUBTYPES` — 3 names identical in Task 2 (def), Task 4 (`Record<ActorSubtype>`), Task 5 (`global.d.ts`), and `system.json` (Task 2's test asserts equality).
- `ActorSnapshot` / `ClassEntry` / `DualClassState` — Task 3 defines; Task 5's `snapshotActor` builds exactly those fields; Task 4's models pass `snapshotActor(this.parent)` into `deriveCharacter`.
- `deriveCharacter(snapshot, options)` → `CharacterDerived { abilities: DerivedAbilities }` — Task 3 signature; Task 4 `CharacterModel`/`NpcModel` consume `derived.abilities[k]`.
- `deriveCharacter` computes `isWarrior` itself (Ruling S3) — `snapshotActor` does NOT set it, and `ActorSnapshot` has no `isWarrior` field. Consistent across Task 3 + Task 5.
- New `choices.ts` arrays (`ALIGNMENTS`, `MOVEMENT_MODES`, `DISPOSITIONS`, `SAVE_MODES`, `ATTACK_TYPES`) — Task 2 defines; Task 4 consumes by those exact names.
- `actorCommonSchema` / `Adnd2eActorModel` — Task 4 Step 1; extended by `CharacterModel`/`NpcModel` (Steps 2–3), not `CreatureModel` (standalone).

**4. Execution-order note.** Task 1 is independent (and may be reverted per S2). Task 2 → Task 3 (derive is in the pure zone Task 2's config edits touch, though the `src/data/derive/**` globs already cover it) and Task 2 → Task 4 (choice arrays). Task 3 → Task 4 (`deriveCharacter`). Task 4 creates a minimal `snapshot.ts`; Task 5 hardens it + adds `documents/` + registration. Tasks 4 + 5 are one typecheck unit in spirit (Task 5's `global.d.ts` augmentation makes `item.system` / `actor.system` fully typed) — run them back-to-back; a reviewer may treat them as a pair.

**5. Dev-world smoke check (manual, at merge — no automated coverage for `defineSchema` / documents).** Link the world. Create one `character`, one `npc`, one `creature`. Each opens (raw-field sheet) with no console error. On the `character`, set STR 18 and confirm `system.abilities.str.mods` is populated (open the console: `game.actors.getName("…").system.abilities.str.mods`). Confirm `CONFIG.Actor.documentClass === Adnd2eActor`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-adnd2e-1c3a-actor-plumbing.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — tasks in this session with checkpoints.

**Which approach?**
