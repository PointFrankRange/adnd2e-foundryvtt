# AD&D 2E — Creature Derive + ActiveEffect Subtype + Two-Pass Split (Plan 1c.3d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `creature` actor a derived-data pipeline, register the `adnd2e` ActiveEffect subtype, and make ActiveEffects that target derived paths take effect via a second pass.

**Architecture:** A pure `src/data/derive/creature/` (HP from HD, THAC0-as-fighter-level, saves-as-class — reuses the existing engine, no new `core/` module) mirrors `src/data/derive/character/`. A pure `src/data/derive/effect-keys.ts` classifies an AE change key as base- or derived-targeting. `Adnd2eActor` (`src/documents/actor.ts`) filters suppressed item effects and, after `prepareDerivedData`, re-applies the derived-targeting changes on top of the freshly computed values. `Adnd2eActiveEffectModel` carries the §5.5 fields.

**Tech Stack:** TypeScript 5 strict, Vitest, Foundry v13 DataModels (`fvtt-types` v13-beta), the existing `src/core/**` engine (`thac0`, `saveBaseTarget`).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §5.3 (creature: authored + derived), §5.5 (ActiveEffect subtype fields), §5.6 (derived-data ordering + the two-pass problem), §4.1 (two-layer architecture), §9 (`defineSchema()` can't run without Foundry, so the Foundry layer is dev-world verified not unit-tested).

**Predecessors:** 1c.3a (Actor plumbing, PR #11), 1c.3b (single-class pipeline, PR #12), 1c.3c (multiclass/dual-class, PR #13) all merged. This is the **final 1c.3 slice**. After it the two-layer Foundry data foundation is complete; **1c.4** = compendium packs + `build:packs` + `importContent(json)` + migrations + stub sheets + README.

## Global Constraints

- **Purity / gated zone:** `src/core/**`, `src/data/derive/**`, `src/data/item/{subtypes,choices}.ts`, `src/data/actor/subtypes.ts`, and — added by this plan — `src/data/active-effect/subtypes.ts`, plus every test under `tests/core/**` and `tests/data/**`, import **nothing** from `foundry` / `fvtt-types` / `game` / `CONFIG` / DOM. `tsc -p tsconfig.core.json --noEmit` (second half of `npm run typecheck`) proves it; ESLint's `no-restricted-globals` + `no-restricted-imports` fence the same set. `src/data/derive/creature/**` and `src/data/derive/effect-keys.ts` are already covered by the wholesale `src/data/derive` globs in all three configs — **no config edit for those.** `src/data/active-effect/subtypes.ts` **must be added** to `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, and both ESLint blocks (the Foundry-globals `ignores` list and the pure-zone `files` list).
- **Coverage gate:** `npm run test:coverage` enforces **100%** lines / statements / functions and **≥90%** branches (the pure zone in this codebase sits at 100% branches — keep it there) on the gated `src/` set. Every new pure function and every new branch it introduces gets a hitting test in this plan.
- **`defineSchema()` bodies contain no logic:** hoisted-factory calls, field constructors, literals, and fragment spreads only.
- **Foundry layer** — `src/data/actor/creature.ts` (`prepareDerivedData` + the two free functions), `src/data/active-effect/{adnd2e,index}.ts`, `src/documents/actor.ts`, `src/system.ts`, `src/types/global.d.ts`: **typecheck + build gated, no unit tests** (`defineSchema` / `prepareData` / `applyActiveEffects` need a live Foundry — spec §9). Verified in the dev world.
- **Do NOT run** `npm run format`, `prettier`, or `npm install`. If Vitest flakes at import with a `config` error, clear `node_modules/.vite`, `node_modules/.vitest`, `node_modules/.cache` and retry.
- **Full gate** (mirrors `.github/workflows/ci.yml`): `npm run typecheck && npm run lint && npm run test:coverage && npm run build`.
- **Engine is the authority:** if a hand-computed value in a test is red for a reason other than "not implemented yet", correct the assertion, add a one-line comment, and note it in the report. Never bend a function to match a plan number.
- **No copyrighted prose / stat blocks / spell text** — mechanical values only.
- **Commit trailer:** every commit message ends with
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **PR body trailer:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## Scope boundary (recorded — NOT built here)

- **Creature `details.xpValue` derivation** — deferred. `xpValue` stays fully authored (`NumberField` nullable). The DMG p.47 HD-band + special-ability XP table lands in a later monster-tooling sub-project (SP6), which also needs a structured special-ability field the schema does not have.
- **`isCondition` / `conditionId` behaviour** — the schema fields are defined and registered; status-condition mechanics are SP7.
- **`schoolTag` behaviour** — the field validates against `SPELL_SCHOOLS` and is stored; school-keyed spell resistance / specialist opposition is SP3+.
- **Magic-item ActiveEffect authoring** — the compendium items that carry these effects are 1c.4.
- **`src/documents/item.ts` and `src/documents/active-effect.ts`** stay thin — their override points land with their consumers.
- **I4** (the `core/classes/progression.ts` proficiency-slot off-by-one) — untouched.

## AD&D 2E reference (mechanical facts only)

- **Monster HP** (this plan's convention, approved in design): each Hit Die contributes `round((dieType + 1) / 2)` — d8 → 5, d6 → 4, d10 → 6, d12 → 7, d4 → 3 — so `hp.max = fixedHp ?? floor(count × perDie + bonus)`. `Math.round(4.5) === 5` in JS (round-half-up).
- **Monster THAC0** — a monster with `asFighterLevel` set fights on the warrior table at that level: `thac0("warrior", asFighterLevel)` (PHB Table 53). `thac0("warrior", 5) === 16`.
- **Monster saves** — `mode: "asClass"` uses the class saving-throw matrix (PHB Table 60) at `{ group, level }`: `saveBaseTarget(group, level, category)`. Warrior L5 band (`minLevel 5`) is `[ppd 11, rsw 13, pp 12, bw 13, spell 14]`. `mode: "explicit"` uses the five authored numbers as-is. No racial / ability layering — creatures carry no ability scores.

## Foundry two-pass background (spec §5.6)

Foundry's pipeline: `prepareBaseData()` → *(Foundry applies ActiveEffects)* → `prepareDerivedData()`. An effect whose `change.key` targets a value that `prepareDerivedData` computes (`system.saves.spell.effectiveTarget`, `system.attributes.thac0.melee`, `system.abilities.str.mods.toHit`, …) is applied **before** that value exists and then overwritten. The fix: after `prepareDerivedData` writes the base derived values, **re-apply** those derived-targeting changes on top. Each `change.apply` is a pure function of the current value, so a second application on the correct value composes right (`ADD` / `MULTIPLY` / `UPGRADE` / `OVERRIDE` all).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/data/derive/creature/snapshot.ts` | `CreatureSnapshot` + `CreatureDerived` types (pure) | 1 |
| `src/data/derive/creature/derive.ts` | `deriveCreature(snapshot): CreatureDerived` (pure) | 1 |
| `src/data/derive/creature/index.ts` | barrel | 1 |
| `tests/data/derive/creature/derive.test.ts` | 100% of `deriveCreature` | 1 |
| `src/data/derive/effect-keys.ts` | `isDeferredChangeKey(key, actorType)` (pure) | 2 |
| `tests/data/derive/effect-keys.test.ts` | 100% of the above | 2 |
| `src/data/active-effect/adnd2e.ts` | `Adnd2eActiveEffectModel` (§5.5 fields) | 3 |
| `src/data/active-effect/subtypes.ts` | `ACTIVE_EFFECT_SUBTYPES` + `ActiveEffectSubtype` (gated) | 3 |
| `src/data/active-effect/index.ts` | `ACTIVE_EFFECT_DATA_MODELS` | 3 |
| `tests/data/active-effect-subtypes.test.ts` | drift test vs `system.json` | 3 |
| `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js` | add `src/data/active-effect/subtypes.ts` to the gated set | 3 |
| `src/data/actor/creature.ts` | `saves.effective` schema + `prepareDerivedData` + `snapshotCreature` + `deriveAndCacheCreature` | 4 |
| `src/documents/actor.ts` | `allApplicableEffects` / `_effectSuppressed` / `prepareDerivedData` overrides | 5 |
| `src/system.ts` | `CONFIG.ActiveEffect.dataModels` registration | 5 |
| `src/types/global.d.ts` | `DataModelConfig.ActiveEffect` | 5 |
| `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` | §5.3 (xpValue deferred), §5.6 (concrete mechanism) | 6 |

---

## Task 1: `src/data/derive/creature/` — the pure creature pipeline

**Files:**
- Create: `src/data/derive/creature/snapshot.ts`
- Create: `src/data/derive/creature/derive.ts`
- Create: `src/data/derive/creature/index.ts`
- Test: `tests/data/derive/creature/derive.test.ts`

**Interfaces:**
- Consumes: `thac0(group, level)` from `src/core/classes/thac0.ts`; `saveBaseTarget(group, level, category)` from `src/core/saves` (re-exported by `src/core/saves/index.ts`); `ClassGroup` / `SaveCategory` from `src/core/types.ts`.
- Produces:
  - `interface CreatureSnapshot { hd: { count: number; dieType: number; bonus: number; fixedHp: number | null }; thac0AsFighterLevel: number | null; authoredThac0: number; saveMode: "explicit" | "asClass"; explicitSaves: Record<SaveCategory, number>; asClassSave: { group: ClassGroup | ""; level: number } }`
  - `interface CreatureDerived { hpMax: number; thac0: number; saves: Record<SaveCategory, number> }`
  - `function deriveCreature(snapshot: CreatureSnapshot): CreatureDerived`

- [ ] **Step 1: Write the failing test** — `tests/data/derive/creature/derive.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { deriveCreature } from "../../../../src/data/derive/creature/derive";
import type { CreatureSnapshot } from "../../../../src/data/derive/creature/snapshot";
import type { SaveCategory } from "../../../../src/core/types";

const explicit20: Record<SaveCategory, number> = { ppd: 20, rsw: 20, pp: 20, bw: 20, spell: 20 };

const base: CreatureSnapshot = {
  hd: { count: 3, dieType: 8, bonus: 0, fixedHp: null },
  thac0AsFighterLevel: null,
  authoredThac0: 17,
  saveMode: "explicit",
  explicitSaves: { ...explicit20 },
  asClassSave: { group: "", level: 1 },
};

describe("deriveCreature", () => {
  it("HP: average of the Hit Dice (d8 -> 5/die) plus the flat bonus", () => {
    // 3 * round((8+1)/2)=5 -> 15
    expect(deriveCreature(base).hpMax).toBe(15);
    // 5d8+5 -> 5*5 + 5 = 30
    expect(deriveCreature({ ...base, hd: { count: 5, dieType: 8, bonus: 5, fixedHp: null } }).hpMax).toBe(30);
    // d6 -> 4/die : 4d6 -> 16
    expect(deriveCreature({ ...base, hd: { count: 4, dieType: 6, bonus: 0, fixedHp: null } }).hpMax).toBe(16);
    // fractional HD floors: 0.5 * 5 = 2.5 -> 2
    expect(deriveCreature({ ...base, hd: { count: 0.5, dieType: 8, bonus: 0, fixedHp: null } }).hpMax).toBe(2);
  });

  it("HP: fixedHp overrides the HD average", () => {
    expect(deriveCreature({ ...base, hd: { count: 5, dieType: 8, bonus: 5, fixedHp: 22 } }).hpMax).toBe(22);
    expect(deriveCreature({ ...base, hd: { count: 3, dieType: 8, bonus: 0, fixedHp: 0 } }).hpMax).toBe(0);
  });

  it("THAC0: the fighter table when asFighterLevel is set, else the authored value", () => {
    expect(deriveCreature(base).thac0).toBe(17); // authored, asFighterLevel null
    expect(deriveCreature({ ...base, thac0AsFighterLevel: 5 }).thac0).toBe(16); // thac0("warrior",5)
    expect(deriveCreature({ ...base, thac0AsFighterLevel: 1 }).thac0).toBe(20);
  });

  it("saves: explicit mode passes the five authored numbers through", () => {
    const s = deriveCreature({ ...base, explicitSaves: { ppd: 12, rsw: 13, pp: 11, bw: 15, spell: 14 } });
    expect(s.saves).toEqual({ ppd: 12, rsw: 13, pp: 11, bw: 15, spell: 14 });
  });

  it("saves: asClass mode uses the class matrix at {group, level}", () => {
    const s = deriveCreature({ ...base, saveMode: "asClass", asClassSave: { group: "warrior", level: 5 } });
    // PHB Table 60 warrior band minLevel 5 = [ppd 11, rsw 13, pp 12, bw 13, spell 14]
    expect(s.saves).toEqual({ ppd: 11, rsw: 13, pp: 12, bw: 13, spell: 14 });
  });

  it("saves: asClass with an unset group falls back to the explicit numbers", () => {
    const s = deriveCreature({
      ...base,
      saveMode: "asClass",
      asClassSave: { group: "", level: 1 },
      explicitSaves: { ppd: 9, rsw: 9, pp: 9, bw: 9, spell: 9 },
    });
    expect(s.saves).toEqual({ ppd: 9, rsw: 9, pp: 9, bw: 9, spell: 9 });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/data/derive/creature/derive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/data/derive/creature/snapshot.ts`**

```ts
// The plain-data view of a creature the engine derives from. snapshotCreature
// (src/data/actor/creature.ts) builds this from the Foundry Actor; deriveCreature
// consumes only this.
import type { ClassGroup, SaveCategory } from "../../../core/types";

export interface CreatureSnapshot {
  hd: { count: number; dieType: number; bonus: number; fixedHp: number | null };
  /** attributes.thac0.asFighterLevel — null unless the monster fights on the warrior table */
  thac0AsFighterLevel: number | null;
  /** attributes.thac0.value — the fallback when asFighterLevel is null */
  authoredThac0: number;
  saveMode: "explicit" | "asClass";
  explicitSaves: Record<SaveCategory, number>;
  /** used only when saveMode === "asClass"; group "" means "not configured" */
  asClassSave: { group: ClassGroup | ""; level: number };
}

export interface CreatureDerived {
  hpMax: number;
  thac0: number;
  /** the five effective saving-throw targets → system.saves.effective.* */
  saves: Record<SaveCategory, number>;
}
```

- [ ] **Step 4: Create `src/data/derive/creature/derive.ts`**

```ts
import { thac0 } from "../../../core/classes/thac0";
import { saveBaseTarget } from "../../../core/saves";
import type { ClassGroup, SaveCategory } from "../../../core/types";
import type { CreatureDerived, CreatureSnapshot } from "./snapshot";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

/** §5.3 — the derived values for a monster. Monsters state AC directly, so it is not here. */
export function deriveCreature(snapshot: CreatureSnapshot): CreatureDerived {
  const { hd } = snapshot;
  const perDie = Math.round((hd.dieType + 1) / 2);
  const hpMax = hd.fixedHp ?? Math.floor(hd.count * perDie + hd.bonus);

  const thac0Value =
    snapshot.thac0AsFighterLevel !== null
      ? thac0("warrior", snapshot.thac0AsFighterLevel)
      : snapshot.authoredThac0;

  const saves =
    snapshot.saveMode === "asClass" && snapshot.asClassSave.group !== ""
      ? asClassSaves(snapshot.asClassSave.group, snapshot.asClassSave.level)
      : snapshot.explicitSaves;

  return { hpMax, thac0: thac0Value, saves };
}

function asClassSaves(group: ClassGroup, level: number): Record<SaveCategory, number> {
  const out = {} as Record<SaveCategory, number>;
  for (const category of CATEGORIES) out[category] = saveBaseTarget(group, level, category);
  return out;
}
```

Note: `snapshot.asClassSave.group !== ""` narrows `ClassGroup | ""` to `ClassGroup` for the `asClassSaves` call — TypeScript accepts this.

- [ ] **Step 5: Create `src/data/derive/creature/index.ts`**

```ts
export * from "./snapshot";
export * from "./derive";
```

- [ ] **Step 6: Run — expect PASS**

Run: `npx vitest run tests/data/derive/creature/derive.test.ts`
Expected: PASS. If a save value is red because `saveBaseTarget` genuinely returns a different number, the engine wins — fix the assertion, comment it, note it.

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `src/data/derive/creature/**` at 100% — the tests cover `fixedHp` set / null, `thac0AsFighterLevel` set / null, `saveMode` `asClass`-with-group / `asClass`-without-group / `explicit`.

- [ ] **Step 8: Commit**

```bash
git add src/data/derive/creature tests/data/derive/creature
git commit -m "feat(data): deriveCreature — monster HP / THAC0 / saves pipeline

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `src/data/derive/effect-keys.ts` — classify an AE change key

**Files:**
- Create: `src/data/derive/effect-keys.ts`
- Test: `tests/data/derive/effect-keys.test.ts`

**Interfaces:**
- Produces: `function isDeferredChangeKey(key: string, actorType: "character" | "npc" | "creature"): boolean` — `true` when `key` targets a value written by `prepareDerivedData` (so an ActiveEffect on it must be re-applied in the second pass).

- [ ] **Step 1: Write the failing test** — `tests/data/derive/effect-keys.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isDeferredChangeKey } from "../../../src/data/derive/effect-keys";

describe("isDeferredChangeKey", () => {
  it("character: derived paths return true", () => {
    for (const key of [
      "system.abilities.str.mods.toHit",
      "system.abilities.cha.mods",
      "system.attributes.hp.max",
      "system.attributes.thac0.melee",
      "system.attributes.ac.normal",
      "system.attributes.encumbrance.movementRate",
      "system.attributes.movement.current",
      "system.saves.spell.effectiveTarget",
      "system.proficiencies.weapon.available",
      "system.languagesKnown.max",
      "system.multiclass.hpAveraged",
      "system.spellcasting.wizard.slots",
      "system.classes",
    ]) {
      expect(isDeferredChangeKey(key, "character")).toBe(true);
    }
  });

  it("character: base / authored paths return false", () => {
    for (const key of [
      "system.abilities.str.score",
      "system.abilities.str.exceptional",
      "system.attributes.hp.value",
      "system.attributes.hp.temp",
      "system.details.alignment",
      "system.currency.gp",
      "name",
      "img",
    ]) {
      expect(isDeferredChangeKey(key, "character")).toBe(false);
    }
  });

  it("npc uses the same list as character", () => {
    expect(isDeferredChangeKey("system.saves.spell.effectiveTarget", "npc")).toBe(true);
    expect(isDeferredChangeKey("system.abilities.str.score", "npc")).toBe(false);
  });

  it("creature: only hp.max, thac0.value, and saves.effective.* are derived", () => {
    expect(isDeferredChangeKey("system.attributes.hp.max", "creature")).toBe(true);
    expect(isDeferredChangeKey("system.attributes.thac0.value", "creature")).toBe(true);
    expect(isDeferredChangeKey("system.saves.effective.bw", "creature")).toBe(true);
    // creature has no ability mods, no proficiencies, no multiclass
    expect(isDeferredChangeKey("system.abilities.str.mods.toHit", "creature")).toBe(false);
    expect(isDeferredChangeKey("system.attributes.ac.value", "creature")).toBe(false);
    expect(isDeferredChangeKey("system.saves.explicit.bw", "creature")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/data/derive/effect-keys.test.ts`).

- [ ] **Step 3: Create `src/data/derive/effect-keys.ts`**

```ts
// Splits ActiveEffect changes into "affects base" (default Foundry timing) and
// "affects derived" (re-applied after prepareDerivedData). Pure — a static
// allow-list of the system.* path prefixes that prepareDerivedData writes, per
// actor type. An unlisted derived field just means its effect is a visible no-op
// in the dev world — safer than a base-path deny-list, where a miss double-applies.

type ActorType = "character" | "npc" | "creature";

const CHARACTER_DERIVED_PREFIXES: readonly string[] = [
  "system.abilities.str.mods",
  "system.abilities.dex.mods",
  "system.abilities.con.mods",
  "system.abilities.int.mods",
  "system.abilities.wis.mods",
  "system.abilities.cha.mods",
  "system.attributes.hp.max",
  "system.attributes.thac0.",
  "system.attributes.ac.",
  "system.attributes.encumbrance.",
  "system.attributes.movement.",
  "system.saves.",
  "system.proficiencies.",
  "system.languagesKnown.",
  "system.multiclass.",
  "system.spellcasting.wizard.slots",
  "system.spellcasting.priest.slots",
  "system.classes",
];

const CREATURE_DERIVED_PREFIXES: readonly string[] = [
  "system.attributes.hp.max",
  "system.attributes.thac0.value",
  "system.saves.effective.",
];

const DERIVED_PREFIXES: Record<ActorType, readonly string[]> = {
  character: CHARACTER_DERIVED_PREFIXES,
  npc: CHARACTER_DERIVED_PREFIXES,
  creature: CREATURE_DERIVED_PREFIXES,
};

/**
 * True when an ActiveEffect change on `key` must be re-applied after
 * `prepareDerivedData` (it targets a value that step computes).
 */
export function isDeferredChangeKey(key: string, actorType: ActorType): boolean {
  return DERIVED_PREFIXES[actorType].some((prefix) => key === prefix || key.startsWith(prefix));
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/data/derive/effect-keys.test.ts`).

- [ ] **Step 5: Full gate.** `src/data/derive/effect-keys.ts` at 100% — the tests hit `key === prefix` (`"system.attributes.hp.max"`), `key.startsWith(prefix)` (`"system.saves.spell.effectiveTarget"`), and the no-match path, across all three actor types.

- [ ] **Step 6: Commit**

```bash
git add src/data/derive/effect-keys.ts tests/data/derive/effect-keys.test.ts
git commit -m "feat(data): isDeferredChangeKey — base vs derived ActiveEffect target split

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: the `adnd2e` ActiveEffect subtype + registration surface

**Files:**
- Create: `src/data/active-effect/adnd2e.ts`
- Create: `src/data/active-effect/subtypes.ts`
- Create: `src/data/active-effect/index.ts`
- Test: `tests/data/active-effect-subtypes.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js`

**Interfaces:**
- Consumes: `SPELL_SCHOOLS` from `src/data/item/choices.ts` (the 10-member `readonly SpellSchool[]`).
- Produces:
  - `class Adnd2eActiveEffectModel extends foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, ActiveEffect.Implementation>`
  - `type ActiveEffectSubtype = "adnd2e"` and `const ACTIVE_EFFECT_SUBTYPES: readonly ActiveEffectSubtype[] = ["adnd2e"]`
  - `const ACTIVE_EFFECT_DATA_MODELS: Record<ActiveEffectSubtype, typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, ActiveEffect.Implementation>>`

- [ ] **Step 1: Create `src/data/active-effect/subtypes.ts`**

```ts
// The one ActiveEffect sub-type this system registers (must equal system.json
// documentTypes.ActiveEffect — asserted in tests/data/active-effect-subtypes.test.ts).
export type ActiveEffectSubtype = "adnd2e";

export const ACTIVE_EFFECT_SUBTYPES: readonly ActiveEffectSubtype[] = ["adnd2e"];
```

- [ ] **Step 2: Add it to the gated set — three configs**

`tsconfig.core.json` — append to the `include` array:
```json
"include": ["src/core", "tests/core", "src/config.ts", "src/settings/registry.ts", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts", "src/data/derive", "src/data/active-effect/subtypes.ts"]
```

`vitest.config.ts` — add to `coverage.include` (after `"src/data/actor/subtypes.ts",`):
```ts
        "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts",
        "src/data/active-effect/subtypes.ts",
        "src/data/derive/**/*.ts",
```

`eslint.config.js` — add `"src/data/active-effect/subtypes.ts"` to BOTH lists: the Foundry-globals block's `ignores` array and the pure-zone block's `files` array (both currently end `..., "src/data/actor/subtypes.ts", "tests/data/**" ...` / `..., "src/data/actor/subtypes.ts", "tests/data/**/*.ts"]`).

- [ ] **Step 3: Write the failing drift test** — `tests/data/active-effect-subtypes.test.ts`

```ts
import { describe, expect, it } from "vitest";
import manifest from "../../system.json";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

describe("ACTIVE_EFFECT_SUBTYPES", () => {
  it("matches system.json documentTypes.ActiveEffect exactly", () => {
    const declared = Object.keys(
      (manifest as unknown as { documentTypes: { ActiveEffect: Record<string, unknown> } })
        .documentTypes.ActiveEffect,
    ).sort();
    expect([...ACTIVE_EFFECT_SUBTYPES].sort()).toEqual(declared);
  });

  it("has no duplicates", () => {
    expect(new Set(ACTIVE_EFFECT_SUBTYPES).size).toBe(ACTIVE_EFFECT_SUBTYPES.length);
  });
});
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/data/active-effect-subtypes.test.ts`) — `system.json` already declares `documentTypes.ActiveEffect.adnd2e`, so this passes as soon as `subtypes.ts` exists.

- [ ] **Step 5: Create `src/data/active-effect/adnd2e.ts`**

```ts
// The `adnd2e` ActiveEffect sub-type (spec §5.5). Carries the metadata the
// magic-item / spell-effect / condition systems key on; the two-pass base/derived
// split and suppressWhenUnequipped enforcement live on Adnd2eActor.
import { SPELL_SCHOOLS } from "../item/choices";

const { StringField, BooleanField } = foundry.data.fields;

export class Adnd2eActiveEffectModel extends foundry.abstract.TypeDataModel<
  foundry.data.fields.DataSchema,
  ActiveEffect.Implementation
> {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      conditionId: new StringField({ required: true, nullable: true, blank: false, initial: null }),
      isCondition: new BooleanField({ required: true, initial: false }),
      suppressWhenUnequipped: new BooleanField({ required: true, initial: false }),
      schoolTag: new StringField({
        required: true,
        nullable: true,
        blank: false,
        initial: null,
        choices: SPELL_SCHOOLS,
      }),
    };
  }
}
```

- [ ] **Step 6: Create `src/data/active-effect/index.ts`**

```ts
import type { ActiveEffectSubtype } from "./subtypes";
import { Adnd2eActiveEffectModel } from "./adnd2e";

export { Adnd2eActiveEffectModel };
export { ACTIVE_EFFECT_SUBTYPES } from "./subtypes";
export type { ActiveEffectSubtype } from "./subtypes";

/** Registered on `CONFIG.ActiveEffect.dataModels` in the init hook. Keys ≡ `ACTIVE_EFFECT_SUBTYPES`. */
export const ACTIVE_EFFECT_DATA_MODELS: Record<
  ActiveEffectSubtype,
  typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, ActiveEffect.Implementation>
> = {
  adnd2e: Adnd2eActiveEffectModel,
};
```

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. Both `tsc` passes clean — `tsc -p tsconfig.core.json` now also type-checks `src/data/active-effect/subtypes.ts` and must stay Foundry-free (it is: two lines, no imports). `subtypes.ts` at 100% (the drift test reads it). `adnd2e.ts` / `index.ts` are Foundry-layer — typecheck + build only.

If `TypeDataModel<DataSchema, ActiveEffect.Implementation>` triggers a generic-variance error like the item/actor models' deferred Schema-typing debt (Ruling S2), use the same `this as unknown as {…}` shim pattern the item models use and leave a `// Ruling S2` comment — do **not** spend the task chasing `ReturnType<typeof Self.defineSchema>` (it is known-circular). There is no `prepareDerivedData` on this model, so a shim is unlikely to be needed.

- [ ] **Step 8: Commit**

```bash
git add src/data/active-effect tests/data/active-effect-subtypes.test.ts tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(data): Adnd2eActiveEffectModel + adnd2e subtype registration surface

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `CreatureModel` — schema field + derive wiring

**Files:**
- Modify: `src/data/actor/creature.ts`

**Interfaces:**
- Consumes: `deriveCreature` + `CreatureSnapshot` from `src/data/derive/creature` (Task 1); `SaveCategory` from `src/core/types.ts`.
- Produces: `CreatureModel` gains a `saves.effective` SchemaField and a `prepareDerivedData()`; two module-private free functions `snapshotCreature(actor)` and `deriveAndCacheCreature(model)`.

**Placement note:** `snapshotCreature` and `deriveAndCacheCreature` live in `creature.ts` itself, not in `base-actor.ts` / `snapshot.ts`. The `creature` model is standalone (spec §5.3 — it does not share `actorCommonSchema`), so its Foundry glue stays with it.

- [ ] **Step 1: Add the `saves.effective` SchemaField**

In `src/data/actor/creature.ts`, inside `defineSchema()`, the `saves` SchemaField currently has `mode`, `explicit`, `asClass`. Add `effective` alongside them:

```ts
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
        effective: new SchemaField({
          ppd: new NumberField({ required: true, integer: true, initial: 20 }),
          rsw: new NumberField({ required: true, integer: true, initial: 20 }),
          pp: new NumberField({ required: true, integer: true, initial: 20 }),
          bw: new NumberField({ required: true, integer: true, initial: 20 }),
          spell: new NumberField({ required: true, integer: true, initial: 20 }),
        }),
      }),
```

- [ ] **Step 2: Add the imports and the derive wiring**

At the top of `src/data/actor/creature.ts`, add:

```ts
import { deriveCreature } from "../derive/creature";
import type { CreatureSnapshot } from "../derive/creature";
import type { ClassGroup, SaveCategory } from "../../core/types";
```

The class currently ends:

```ts
  // NO prepareDerivedData — the creature derive path is Plan 1c.3d.
}
```

Replace **both** those lines (the comment **and** the class-closing brace) with the `prepareDerivedData` method, one class-closing brace, and the free functions:

```ts
  override prepareDerivedData(): void {
    deriveAndCacheCreature(this);
  }
}

const SAVE_KEYS: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

/** Ruling S2 shim — the creature model is loosely typed until the Schema-typing debt clears. */
function snapshotCreature(model: foundry.abstract.TypeDataModel.Any): CreatureSnapshot {
  const sys = (model as unknown as { parent: Actor.Implementation }).parent.system as unknown as {
    hd: { count: number; dieType: number; bonus: number; fixedHp: number | null };
    attributes: { thac0: { value: number; asFighterLevel: number | null } };
    saves: {
      mode: "explicit" | "asClass";
      explicit: Record<SaveCategory, number>;
      asClass: { group: string; level: number };
    };
  };
  return {
    hd: { ...sys.hd },
    thac0AsFighterLevel: sys.attributes.thac0.asFighterLevel,
    authoredThac0: sys.attributes.thac0.value,
    saveMode: sys.saves.mode,
    explicitSaves: { ...sys.saves.explicit },
    asClassSave: { group: sys.saves.asClass.group as ClassGroup | "", level: sys.saves.asClass.level },
  };
}

interface CreatureWriteSurface {
  attributes: { hp: { max: number }; thac0: { value: number } };
  saves: { effective: Record<string, number> };
}

/** Runs deriveCreature and writes onto system.* (spec §5.3 derived paths). */
function deriveAndCacheCreature(model: foundry.abstract.TypeDataModel.Any): void {
  const derived = deriveCreature(snapshotCreature(model));
  const sys = model as unknown as CreatureWriteSurface;
  sys.attributes.hp.max = derived.hpMax;
  sys.attributes.thac0.value = derived.thac0;
  for (const k of SAVE_KEYS) sys.saves.effective[k] = derived.saves[k];
}
```

Delete the trailing `}` that used to close the class before the comment — the new class body ends with the `prepareDerivedData` method, then the free functions follow.

- [ ] **Step 3: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `creature.ts` is Foundry-layer (typecheck + build only). Coverage unchanged (no gated file touched). `dist/system.js` grows slightly.

The `asFighterLevel` / `authoredThac0` interplay: `deriveCreature` returns the authored value when `asFighterLevel` is null, so `sys.attributes.thac0.value = derived.thac0` is idempotent then — no guard needed. Same for explicit saves.

- [ ] **Step 4: Commit**

```bash
git add src/data/actor/creature.ts
git commit -m "feat(data): CreatureModel derives HP / THAC0 / effective saves

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `Adnd2eActor` two-pass overrides + registration

**Files:**
- Modify: `src/documents/actor.ts`
- Modify: `src/system.ts`
- Modify: `src/types/global.d.ts`

**Interfaces:**
- Consumes: `isDeferredChangeKey` from `src/data/derive/effect-keys.ts` (Task 2); `ACTIVE_EFFECT_DATA_MODELS` from `src/data/active-effect` (Task 3).
- Produces: `Adnd2eActor` gains `allApplicableEffects()`, `_effectSuppressed()`, `prepareDerivedData()`; `CONFIG.ActiveEffect.dataModels` is set on init; `DataModelConfig.ActiveEffect` is augmented.

- [ ] **Step 1: Rewrite `src/documents/actor.ts`**

```ts
import { isDeferredChangeKey } from "../data/derive/effect-keys";

type ActorType = "character" | "npc" | "creature";

/**
 * System Actor document. Two responsibilities beyond the base class:
 *  - suppress an item-transferred ActiveEffect whose item is unequipped
 *    (`system.suppressWhenUnequipped` on the `adnd2e` effect subtype);
 *  - re-apply ActiveEffect changes that target a *derived* path AFTER
 *    `prepareDerivedData` computes those values (spec §5.6 two-pass).
 */
export class Adnd2eActor extends Actor {
  override *allApplicableEffects(): Generator<ActiveEffect.Implementation, void, void> {
    for (const effect of super.allApplicableEffects()) {
      if (this._effectSuppressed(effect)) continue;
      yield effect;
    }
  }

  /** True for an `adnd2e` effect on a physical item that is not equipped. */
  _effectSuppressed(effect: ActiveEffect.Implementation): boolean {
    const parent = effect.parent;
    return (
      !!(effect.system as { suppressWhenUnequipped?: boolean } | undefined)?.suppressWhenUnequipped &&
      parent instanceof Item &&
      ["weapon", "armor", "equipment"].includes(parent.type) &&
      !(parent.system as { equipped?: boolean }).equipped
    );
  }

  override prepareDerivedData(): void {
    super.prepareDerivedData(); // runs this.system.prepareDerivedData() — the derive+cache
    const actorType = this.type as ActorType;
    for (const effect of this.allApplicableEffects()) {
      if (!effect.active) continue;
      for (const change of effect.changes) {
        if (!change.key || !isDeferredChangeKey(change.key, actorType)) continue;
        const applied = effect.apply(this, change);
        this.overrides = foundry.utils.mergeObject(
          this.overrides ?? {},
          foundry.utils.expandObject(applied as Record<string, unknown>),
        );
      }
    }
  }
}
```

If `override *allApplicableEffects()` does not typecheck against fvtt-types v13-beta after one genuine attempt (generator-method override variance), fall back to filtering inside an `applyActiveEffects()` override: call the parent, then it is too late to skip — so instead override `applyActiveEffects` to replicate the loop with the `_effectSuppressed` guard. Record the choice as **Ruling AE1** in the ledger and keep going. The dev-world smoke check (c) verifies whichever path ships.

- [ ] **Step 2: Register the DataModel — `src/system.ts`**

Add the import:
```ts
import { ACTIVE_EFFECT_DATA_MODELS } from "./data/active-effect";
```
and in the `init` hook, after `CONFIG.ActiveEffect.documentClass = Adnd2eActiveEffect;`:
```ts
  CONFIG.ActiveEffect.dataModels = ACTIVE_EFFECT_DATA_MODELS;
```

- [ ] **Step 3: Augment `DataModelConfig` — `src/types/global.d.ts`**

Add inside the existing `interface DataModelConfig { … }` block, after the `Item: { … }` member:

```ts
    ActiveEffect: {
      adnd2e: typeof import("../data/active-effect/adnd2e").Adnd2eActiveEffectModel;
    };
```

- [ ] **Step 4: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `src/documents/actor.ts` importing `isDeferredChangeKey` from `src/data/derive/effect-keys.ts` is fine — `documents/` is Foundry-layer, and the derive file is pure (a Foundry-layer file importing a pure file is the normal direction). Coverage unchanged. `dist/system.js` builds.

- [ ] **Step 5: Commit**

```bash
git add src/documents/actor.ts src/system.ts src/types/global.d.ts
git commit -m "feat(system): two-pass ActiveEffect split + suppressWhenUnequipped + AE dataModels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: reconcile the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md`

- [ ] **Step 1: §5.3 — mark `xpValue` derivation as deferred**

In the `creature` **Derived** list, change:
```
- `details.xpValue` when override is null (HD-band base + special-ability adds)
```
to:
```
- `details.xpValue` — **deferred to SP6** (monster tooling). `xpValue` stays a
  nullable authored field; nothing derives it in SP1. The DMG p.47 HD-band +
  special-ability table needs a structured special-ability field the schema does
  not yet carry.
```

Also change the `attributes.thac0.value` derived bullet to note it is written unconditionally (idempotent when `asFighterLevel` is null), and `saves.effective` (not `saves.effective` — confirm the spec says `saves.effective`; if it says `saves.<k>` reconcile to `saves.effective.<k>` to match `CreatureModel`).

- [ ] **Step 2: §5.6 — replace the prose mechanism with the concrete one**

The last paragraph of §5.6 currently describes the split abstractly ("keyed by target path prefix"). Replace it with:

```
Anything an ActiveEffect must modify *after* these computations (a "+1 to all
saves" item) is applied as a **second pass**. `Adnd2eActor.prepareDerivedData()`
calls `super` (which runs the derive-and-cache), then re-applies every effect
change whose `key` passes `isDeferredChangeKey(key, actorType)` — a static
allow-list (`src/data/derive/effect-keys.ts`) of the `system.*` prefixes each
actor type's derive step writes. The early (pre-derive) application of those
changes is harmless: `prepareDerivedData` overwrites it and the second pass
re-applies on the correct value. Separately, `Adnd2eActor.allApplicableEffects()`
skips an `adnd2e` effect whose parent item is an unequipped weapon/armor/equipment
(`system.suppressWhenUnequipped`).
```

- [ ] **Step 3: Full gate** (doc-only — the gate is unchanged; run it to be sure nothing else drifted).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md
git commit -m "docs(spec): §5.3 xpValue deferred; §5.6 concrete two-pass mechanism

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final verification (controller, before the whole-branch review)

- [ ] `npm run typecheck && npm run lint && npm run test:coverage && npm run build` — all green from a cleared cache.
- [ ] Coverage: 100% lines / statements / functions and 100% branches across the gated zone; `src/data/derive/creature/**`, `src/data/derive/effect-keys.ts`, and `src/data/active-effect/subtypes.ts` all at 100%.
- [ ] `grep -rn "NO prepareDerivedData" src/` returns nothing (the creature comment is gone).
- [ ] `tsc -p tsconfig.core.json --noEmit` type-checks `src/data/active-effect/subtypes.ts` (the `include` edit took).
- [ ] Dev-world smoke check (record for the PR, run before merge — needs a live Foundry):
  - **(a) creature** — `hd: { count: 5, dieType: 8, bonus: 5 }`, `saves.mode: "asClass"`, `saves.asClass: { group: "warrior", level: 5 }` → `system.attributes.hp.max === 30`, `system.saves.effective.bw === 13`, `system.saves.effective.ppd === 11`; `system.attributes.thac0.value` unchanged while `asFighterLevel` is null, then set `attributes.thac0.asFighterLevel = 5` → `system.attributes.thac0.value === 16`.
  - **(b) character, second pass** — an `adnd2e` ActiveEffect with change `{ key: "system.saves.spell.effectiveTarget", mode: ADD, value: 1 }` → the cached spell-save `effectiveTarget` is 1 higher than without it. A change `{ key: "system.abilities.str.score", mode: ADD, value: 1 }` → `str.score` rises **and** `str.mods` recompute off the raised score (proves base-path changes still run at the default time).
  - **(c) suppression** — an `equipment` item carrying an `adnd2e` effect with `suppressWhenUnequipped: true` and change `{ key: "system.attributes.thac0.melee", mode: ADD, value: -1 }`: unequipped → no THAC0 change; equip it → `thac0.melee` improves by 1.

---

## Self-Review (completed by plan author)

**1. Spec coverage.**
- §5.3 creature Derived — `hp.max` (Task 1/4), `thac0.value` when `asFighterLevel` set (Task 1/4), `saves.effective` when `mode === "asClass"` (Task 1/4), `xpValue` — deferred with a task to record the deferral (Task 6). AC is authored (`attributes.ac.value`) — correctly not derived.
- §5.5 ActiveEffect — the four fields (`conditionId`, `isCondition`, `suppressWhenUnequipped`, `schoolTag`) → Task 3; `extends ActiveEffectTypeDataModel` — the codebase's existing base for typed documents is `foundry.abstract.TypeDataModel<Schema, Doc.Implementation>` (used by every item/actor model), so the plan uses that with `ActiveEffect.Implementation`; `foundry.data.ActiveEffectTypeDataModel` is the same class under an older name.
- §5.6 two-pass — `isDeferredChangeKey` (Task 2), the `prepareDerivedData` re-apply + `allApplicableEffects` suppression (Task 5), spec prose reconciled (Task 6). `prepareBaseData` racial-adjustment timing is already shipped (1c.3b).
- §4.1 two-layer — `derive/creature` + `effect-keys` + `active-effect/subtypes` are pure/gated; everything touching `foundry.*` is typecheck+build gated and dev-world verified. Every task keeps that line.

**2. Placeholder scan.** No "TBD" / "handle edge cases" / "similar to Task N". Every code step has the full code. The one conditional instruction — the `allApplicableEffects` generator-override fallback (Ruling AE1) — is a bounded either/or with both branches specified and a dev-world check that covers whichever ships, not a placeholder.

**3. Type consistency.** `CreatureSnapshot` / `CreatureDerived` (Task 1) are consumed by `snapshotCreature` / `deriveAndCacheCreature` (Task 4) with matching field names (`hd`, `thac0AsFighterLevel`, `authoredThac0`, `saveMode`, `explicitSaves`, `asClassSave`; `hpMax`, `thac0`, `saves`). `isDeferredChangeKey(key, actorType)` (Task 2) is called with `this.type as ActorType` (Task 5) — the `"character" | "npc" | "creature"` union matches. `ACTIVE_EFFECT_DATA_MODELS` (Task 3) → `CONFIG.ActiveEffect.dataModels` (Task 5). `Adnd2eActiveEffectModel` (Task 3) → `DataModelConfig.ActiveEffect.adnd2e` (Task 5) via the same import path. `SAVE_KEYS` (Task 4) and `CATEGORIES` (Task 1) are both the five `SaveCategory` members in the same order — independent local constants by codebase convention (`data/derive/character/saves.ts` does the same), not a shared import.

**4. Ordering / gate-green between tasks.** Tasks 1–3 create new files only (gate green standalone). Task 4 needs Task 1; Task 5 needs Tasks 2 + 3. Task 6 is doc-only. `src/data/active-effect/subtypes.ts` joining `tsc -p tsconfig.core.json` in Task 3 is safe — it has zero imports. The `creature.ts` free-function placement (not `base-actor.ts`) keeps Task 4 from touching the character/npc glue.
