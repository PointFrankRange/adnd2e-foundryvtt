# Sub-project 12 Plan A: Subrace Architecture + Dwarf Subraces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `race` item can carry a `subrace` layer (ability adjustments and ranges, thief adjustments, a Constitution-save adjustment, an XP surcharge) layered over its base PHB race, and the pack ships the six dwarf subraces from *The Complete Book of Dwarves*.

**Architecture:** A pure `src/core/races/subrace.ts` resolves the effective racial tables (layer overrides, else the existing code tables). `RaceItemModel` gains a nullable-field `subrace` SchemaField; every consumer reads the layer through the snapshot or the race item, and the existing helpers take an optional override so no current caller changes. The XP surcharge is added to a kit's XP percentage through one helper that replaces the seven `kitXpPercentFor(activeKitEntries(...))` call sites.

**Tech Stack:** TypeScript, Foundry v14 DataModel fields, Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-adnd2e-sp12a-subrace-architecture-design.md`.

## Global Constraints

- **Every implementer runs `npm run typecheck` (NOT just `tsc -p tsconfig.json`), `npm run lint` and the task's tests before reporting done; the controller runs the full CI sequence `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR.** `npm run typecheck` also runs `tsc -p tsconfig.core.json`, a Foundry-free pass over `src/core`, `src/data/derive`, listed `src/sheets/character/*.ts`, `tests/core`, `tests/sheets`, `tests/combat`, `tests/magic`; a new test that imports Foundry-coupled glue must be added to that config's `exclude`.
- 100% statement/line/function coverage gate (90% branches) on `src/core/**`, `src/data/derive/**`, `src/data/item/choices.ts`, `src/sheets/character/{context,drop-rules,grouping,xp,context-types}.ts`. Foundry glue (`sheet.ts`, `spell-actions.ts`, `combat-rolls.ts`, `proficiency-actions.ts`, `src/data/actor/**`, `src/data/item/*.ts` other than `choices.ts`) is outside the gate but still unit-tested where a seam exists.
- **Foundry DataModel gotcha:** an `ObjectField`/`ArrayField` with an object-literal `initial` is ONE object shared across all models. Every new field here uses scalar defaults, `null`, or `SchemaField`s (not `ObjectField`s). Do NOT introduce an `initial: {}` or `initial: []` on a field that is path-updated.
- Every new schema field has a default; no migration; do not rename or remove existing race-item fields. `raceId` remains the base PHB race.
- Content policy: mechanical data only, no rulebook prose. `system.description` stays `""`; `grantedFeatures` carries short labels only.
- Every new user-visible string goes in `lang/en.json` and is asserted in `tests/lang/en-coverage.test.ts`.
- The six PHB race items and every existing character must behave exactly as before (all new fields default to "inherit"/0).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `src/core/races/subrace.ts`, `src/core/races/index.ts`; modify `src/core/index.ts`.
- Modify `src/core/abilities/racial-adjustments.ts`, `src/core/saves/racial.ts`, `src/core/saves/composer.ts`, `src/core/proficiencies/thief-skills.ts`.
- Modify `src/data/item/race.ts`, `src/data/item/choices.ts` (no change expected beyond what Task 2 needs), `src/data/derive/character/snapshot.ts`, `src/data/actor/snapshot.ts`, `src/data/derive/character/derive.ts`, `src/data/derive/character/saves.ts`, `src/data/derive/character/kits.ts`, `src/data/actor/base-actor.ts`, `src/data/item/class.ts`.
- Modify `src/sheets/character/{context.ts,context-types.ts,sheet.ts,combat-rolls.ts,proficiency-actions.ts,spell-actions.ts}`, `templates/actor/pc/partials/pc-feature-panels.hbs`, `lang/en.json`.
- Create `packs/races/_source/{hill-dwarf,mountain-dwarf,deep-dwarf,duergar,sundered-dwarf,gully-dwarf}.json`; modify `packs/races/_source/_MANIFEST.md`, `README.md`.
- Tests: create `tests/core/races/subrace.test.ts`; modify `tests/core/abilities/racial-adjustments.test.ts`, the saves and thief-skills core tests, `tests/data/derive/character/derive.test.ts`, `tests/data/derive/kits.test.ts`, `tests/sheets/character/context.test.ts`, `tests/lang/en-coverage.test.ts`, `tests/packs/content.test.ts`; create `tests/data/derive/character/xp-percent.test.ts`.

---

### Task 1: Pure subrace rules and optional override parameters

**Files:**
- Create: `src/core/races/subrace.ts`, `src/core/races/index.ts`
- Modify: `src/core/index.ts`, `src/core/abilities/racial-adjustments.ts`, `src/core/saves/racial.ts`, `src/core/saves/composer.ts`, `src/core/proficiencies/thief-skills.ts`
- Test: `tests/core/races/subrace.test.ts` (new); extend `tests/core/abilities/racial-adjustments.test.ts`, the existing saves core test file(s) (find with `grep -rln racialSaveBonus tests`), and the existing thief-skills core test (`grep -rln thiefSkillBaseScore tests`)

**Interfaces:**
- Produces (exported from `src/core/races`, re-exported by `src/core`):
  - `type AbilityAdjustments = Partial<Record<AbilityKey, number>>`
  - `type AbilityRanges = Record<AbilityKey, [number, number]>`
  - `type ThiefAdjustments = Readonly<Record<ThiefSkill, number>>`
  - `interface SubraceLayer { id: string; abilityAdjustments: AbilityAdjustments | null; abilityRanges: AbilityRanges | null; thiefAdjustments: ThiefAdjustments | null; conSaveBonusAdjustment: number; xpModifierPercent: number }`
  - `NO_SUBRACE: SubraceLayer`
  - `interface RawSubrace { id?: unknown; abilityAdjustments?: unknown; abilityRanges?: unknown; thiefAdjustments?: unknown; conSaveBonusAdjustment?: unknown; xpModifierPercent?: unknown }`
  - `normalizeSubrace(raw: RawSubrace | null | undefined): SubraceLayer`
  - `effectiveAbilityAdjustments(race: Race, layer: SubraceLayer | null | undefined): AbilityAdjustments`
  - `effectiveAbilityRanges(race: Race, layer: SubraceLayer | null | undefined): AbilityRanges`
  - `effectiveThiefAdjustments(race: Race, layer: SubraceLayer | null | undefined): ThiefAdjustments`
  - `abilityRangeProblems(scores: AbilityScores, ranges: AbilityRanges): AbilityKey[]`
  - `combineXpPercent(kitPercent: number, racePercent: number): number`
- Modified (all backward compatible via optional params):
  - `applyRacialDeltas(raw, race, adjustments?: AbilityAdjustments)` and `applyRacialAdjustments(raw, race, adjustments?: AbilityAdjustments, ranges?: AbilityRanges)`
  - `racialSaveBonus(race, category, con, tags = [], extra = 0)`
  - `SaveTargetBestInput.racialSaveAdjustment?: number` and `SaveTargetInput.racialSaveAdjustment?: number`, passed to `racialSaveBonus` as `extra`
  - `ThiefSkillContext.racialAdjustments?: ThiefAdjustments`, used by `thiefSkillBaseScore` and `bardSkillBaseScore` instead of `THIEF_RACIAL_ADJUSTMENTS[input.race]` when present

- [ ] **Step 1: Write the failing tests.**

Create `tests/core/races/subrace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NO_SUBRACE,
  abilityRangeProblems,
  combineXpPercent,
  effectiveAbilityAdjustments,
  effectiveAbilityRanges,
  effectiveThiefAdjustments,
  normalizeSubrace,
} from "../../../src/core/races";
import { RACIAL_ABILITY_ADJUSTMENTS, RACIAL_ABILITY_LIMITS } from "../../../src/core/abilities/racial-adjustments";
import { THIEF_RACIAL_ADJUSTMENTS } from "../../../src/core/proficiencies/thief-skills";

const ranges = {
  str: [8, 18], dex: [3, 16], con: [13, 19], int: [3, 18], wis: [3, 18], cha: [3, 15],
} as const;
const thief = {
  "pick-pockets": 5, "open-locks": 0, "find-remove-traps": 10, "move-silently": 0,
  "hide-in-shadows": 5, "detect-noise": 0, "climb-walls": -10, "read-languages": -15,
};

describe("NO_SUBRACE", () => {
  it("is the inherit-everything layer", () => {
    expect(NO_SUBRACE).toEqual({
      id: "", abilityAdjustments: null, abilityRanges: null, thiefAdjustments: null,
      conSaveBonusAdjustment: 0, xpModifierPercent: 0,
    });
  });
});

describe("normalizeSubrace", () => {
  it("returns the defaults for missing input", () => {
    expect(normalizeSubrace(undefined)).toEqual(NO_SUBRACE);
    expect(normalizeSubrace(null)).toEqual(NO_SUBRACE);
    expect(normalizeSubrace({})).toEqual(NO_SUBRACE);
  });
  it("keeps valid values", () => {
    const layer = normalizeSubrace({
      id: "deep-dwarf",
      abilityAdjustments: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      abilityRanges: {
        str: { min: 8, max: 18 }, dex: { min: 3, max: 16 }, con: { min: 13, max: 19 },
        int: { min: 3, max: 18 }, wis: { min: 3, max: 18 }, cha: { min: 3, max: 15 },
      },
      thiefAdjustments: thief,
      conSaveBonusAdjustment: 1,
      xpModifierPercent: 10,
    });
    expect(layer.id).toBe("deep-dwarf");
    expect(layer.abilityAdjustments).toEqual({ con: 2, cha: -2 });
    expect(layer.abilityRanges).toEqual(ranges);
    expect(layer.thiefAdjustments).toEqual(thief);
    expect(layer.conSaveBonusAdjustment).toBe(1);
    expect(layer.xpModifierPercent).toBe(10);
  });
  it("treats malformed fields as inherit/0", () => {
    const layer = normalizeSubrace({
      id: 5,
      abilityAdjustments: "x",
      abilityRanges: { str: { min: 8 } },
      thiefAdjustments: { "pick-pockets": "a" },
      conSaveBonusAdjustment: 1.5,
      xpModifierPercent: "lots",
    });
    expect(layer).toEqual(NO_SUBRACE);
    // a non-object adjustment value, non-integer entries and a missing ability are ignored; ranges need all six abilities
    expect(normalizeSubrace({ abilityAdjustments: { con: 1.5, cha: 2, bogus: 3 } }).abilityAdjustments).toEqual({ cha: 2 });
  });
});

describe("effective tables", () => {
  const deep = normalizeSubrace({
    id: "deep-dwarf",
    abilityAdjustments: { con: 2, cha: -2 },
    abilityRanges: {
      str: { min: 8, max: 18 }, dex: { min: 3, max: 16 }, con: { min: 13, max: 19 },
      int: { min: 3, max: 18 }, wis: { min: 3, max: 18 }, cha: { min: 3, max: 15 },
    },
    thiefAdjustments: thief,
  });
  it("fall back to the base race's tables with no layer or an inherit layer", () => {
    for (const race of ["human", "dwarf", "elf", "gnome", "half-elf", "halfling"] as const) {
      expect(effectiveAbilityAdjustments(race, null)).toEqual(RACIAL_ABILITY_ADJUSTMENTS[race]);
      expect(effectiveAbilityAdjustments(race, NO_SUBRACE)).toEqual(RACIAL_ABILITY_ADJUSTMENTS[race]);
      expect(effectiveAbilityRanges(race, undefined)).toEqual(RACIAL_ABILITY_LIMITS[race]);
      expect(effectiveThiefAdjustments(race, NO_SUBRACE)).toEqual(THIEF_RACIAL_ADJUSTMENTS[race]);
    }
  });
  it("use the layer where it overrides", () => {
    expect(effectiveAbilityAdjustments("dwarf", deep)).toEqual({ con: 2, cha: -2 });
    expect(effectiveAbilityRanges("dwarf", deep)).toEqual(ranges);
    expect(effectiveThiefAdjustments("dwarf", deep)).toEqual(thief);
  });
});

describe("abilityRangeProblems", () => {
  const r = { ...ranges, str: [8, 18], dex: [3, 16], con: [13, 19], int: [3, 18], wis: [3, 18], cha: [3, 15] } as never;
  it("lists the abilities outside their min-max", () => {
    expect(abilityRangeProblems({ str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 }, r)).toEqual(["con"]);
    expect(abilityRangeProblems({ str: 7, dex: 17, con: 20, int: 12, wis: 12, cha: 16 }, r)).toEqual(["str", "dex", "con", "cha"]);
  });
  it("lists nothing when every score is in range (bounds are inclusive)", () => {
    expect(abilityRangeProblems({ str: 8, dex: 16, con: 13, int: 3, wis: 18, cha: 15 }, r)).toEqual([]);
  });
});

describe("combineXpPercent", () => {
  it("adds the kit and race surcharges", () => {
    expect(combineXpPercent(10, 20)).toBe(30);
    expect(combineXpPercent(0, 0)).toBe(0);
    expect(combineXpPercent(-10, 10)).toBe(0);
  });
});
```

Append to `tests/core/abilities/racial-adjustments.test.ts`:

```ts
describe("override parameters (SP12 Plan A)", () => {
  const raw = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };
  it("applyRacialDeltas uses an adjustment override, defaulting to the race table", () => {
    expect(applyRacialDeltas(raw, "dwarf")).toMatchObject({ con: 13, cha: 11 });
    expect(applyRacialDeltas(raw, "dwarf", { con: 2, cha: -2 })).toMatchObject({ con: 14, cha: 10 });
    expect(applyRacialDeltas(raw, "dwarf", {})).toEqual(raw);
  });
  it("applyRacialAdjustments uses adjustment and range overrides", () => {
    const ranges = { str: [8, 18], dex: [3, 16], con: [13, 19], int: [3, 18], wis: [3, 18], cha: [3, 15] } as never;
    expect(applyRacialAdjustments(raw, "dwarf", { con: 2, cha: -2 }, ranges)).toMatchObject({ con: 14, cha: 10 });
    expect(applyRacialAdjustments({ ...raw, con: 10 }, "dwarf", { con: 2 }, ranges).con).toBe(13); // clamped up to the override min
  });
});
```
(import `applyRacialDeltas` in that file if it does not already.)

In the saves core test file that already exercises `racialSaveBonus`, add:

```ts
  it("racialSaveBonus adds an extra bonus only where the race already qualifies (SP12 Plan A)", () => {
    expect(racialSaveBonus("dwarf", "rsw", 14, [], 1)).toBe(5); // CON 14 -> +4, extra +1
    expect(racialSaveBonus("dwarf", "ppd", 14, ["poison"], 1)).toBe(5);
    expect(racialSaveBonus("dwarf", "ppd", 14, [], 1)).toBe(0); // not a qualifying save
    expect(racialSaveBonus("human", "rsw", 14, [], 1)).toBe(0); // human never qualifies
    expect(racialSaveBonus("dwarf", "rsw", 14)).toBe(4);
  });
```
and a `saveTargetBest` test that passes `racialSaveAdjustment: 1` for a dwarf and expects `breakdown.racialConBonus` to be one higher than without it.

In the thief-skills core test file, add:

```ts
  it("an explicit racialAdjustments table replaces the race lookup (SP12 Plan A)", () => {
    const deepDwarf = { "pick-pockets": 5, "open-locks": 0, "find-remove-traps": 10, "move-silently": 0, "hide-in-shadows": 5, "detect-noise": 0, "climb-walls": -10, "read-languages": -15 };
    const ctx = { race: "dwarf" as const, dexterity: 13, armor: "none" as const };
    expect(thiefSkillBaseScore("pick-pockets", { ...ctx, racialAdjustments: deepDwarf })).toBe(
      thiefSkillBaseScore("pick-pockets", ctx) + 5, // PHB dwarf pick pockets is 0, the override is +5
    );
    expect(thiefSkillBaseScore("open-locks", { ...ctx, racialAdjustments: deepDwarf })).toBe(
      thiefSkillBaseScore("open-locks", ctx) - 10, // PHB dwarf +10 -> override 0
    );
  });
```
(use the file's existing `armor` literal style; add the same assertion for `bardSkillBaseScore` with a bard skill, e.g. `"pick-pockets"`.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core`
Expected: FAIL (missing module / signatures).

- [ ] **Step 3: Implement.**

Create `src/core/races/subrace.ts`:

```ts
/* SP12 Plan A: subrace layers over a base PHB race. Pure; Foundry-free.
 * A subrace is a `race` item whose `raceId` stays the base race and whose
 * `subrace` block overrides racial tables; null = inherit the base table. */
import type { AbilityKey, AbilityScores, Race, ThiefSkill } from "../types";
import { RACIAL_ABILITY_ADJUSTMENTS, RACIAL_ABILITY_LIMITS } from "../abilities/racial-adjustments";
import { THIEF_RACIAL_ADJUSTMENTS, THIEF_SKILLS } from "../proficiencies/thief-skills";

export type AbilityAdjustments = Partial<Record<AbilityKey, number>>;
export type AbilityRanges = Record<AbilityKey, [number, number]>;
export type ThiefAdjustments = Readonly<Record<ThiefSkill, number>>;

export interface SubraceLayer {
  /** blank = no subrace */
  id: string;
  abilityAdjustments: AbilityAdjustments | null;
  abilityRanges: AbilityRanges | null;
  thiefAdjustments: ThiefAdjustments | null;
  /** added to the Constitution save bonus only where the base race already gets it */
  conSaveBonusAdjustment: number;
  /** additional XP cost per level, percent (+10 = 10% more) */
  xpModifierPercent: number;
}

export const NO_SUBRACE: SubraceLayer = Object.freeze({
  id: "",
  abilityAdjustments: null,
  abilityRanges: null,
  thiefAdjustments: null,
  conSaveBonusAdjustment: 0,
  xpModifierPercent: 0,
}) as SubraceLayer;

export interface RawSubrace {
  id?: unknown;
  abilityAdjustments?: unknown;
  abilityRanges?: unknown;
  thiefAdjustments?: unknown;
  conSaveBonusAdjustment?: unknown;
  xpModifierPercent?: unknown;
}

const ABILITIES: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

function normalizeAdjustments(raw: unknown): AbilityAdjustments | null {
  if (!raw || typeof raw !== "object") return null;
  const out: AbilityAdjustments = {};
  for (const k of ABILITIES) {
    const v = (raw as Record<string, unknown>)[k];
    if (isInt(v) && v !== 0) out[k] = v;
  }
  return out;
}

function normalizeRanges(raw: unknown): AbilityRanges | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as AbilityRanges;
  for (const k of ABILITIES) {
    const r = (raw as Record<string, { min?: unknown; max?: unknown } | undefined>)[k];
    if (!r || !isInt(r.min) || !isInt(r.max)) return null;
    out[k] = [r.min, r.max];
  }
  return out;
}

function normalizeThief(raw: unknown): ThiefAdjustments | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as Record<ThiefSkill, number>;
  for (const s of THIEF_SKILLS) {
    const v = (raw as Record<string, unknown>)[s];
    if (!isInt(v)) return null;
    out[s] = v;
  }
  return out;
}

/** Lenient read: anything malformed falls back to "inherit"/0. Zero adjustments are dropped, so `{con:2,cha:-2}` round-trips from the six-integer schema form. */
export function normalizeSubrace(raw: RawSubrace | null | undefined): SubraceLayer {
  return {
    id: typeof raw?.id === "string" ? raw.id : "",
    abilityAdjustments: normalizeAdjustments(raw?.abilityAdjustments),
    abilityRanges: normalizeRanges(raw?.abilityRanges),
    thiefAdjustments: normalizeThief(raw?.thiefAdjustments),
    conSaveBonusAdjustment: isInt(raw?.conSaveBonusAdjustment) ? raw.conSaveBonusAdjustment : 0,
    xpModifierPercent: isInt(raw?.xpModifierPercent) ? raw.xpModifierPercent : 0,
  };
}

export function effectiveAbilityAdjustments(race: Race, layer: SubraceLayer | null | undefined): AbilityAdjustments {
  return layer?.abilityAdjustments ?? RACIAL_ABILITY_ADJUSTMENTS[race];
}

export function effectiveAbilityRanges(race: Race, layer: SubraceLayer | null | undefined): AbilityRanges {
  return layer?.abilityRanges ?? RACIAL_ABILITY_LIMITS[race];
}

export function effectiveThiefAdjustments(race: Race, layer: SubraceLayer | null | undefined): ThiefAdjustments {
  return layer?.thiefAdjustments ?? THIEF_RACIAL_ADJUSTMENTS[race];
}

/** The abilities whose score falls outside its [min, max] (inclusive). */
export function abilityRangeProblems(scores: AbilityScores, ranges: AbilityRanges): AbilityKey[] {
  return ABILITIES.filter((k) => scores[k] < ranges[k][0] || scores[k] > ranges[k][1]);
}

/** A kit's XP percentage plus the subrace's: surcharges add. */
export function combineXpPercent(kitPercent: number, racePercent: number): number {
  return kitPercent + racePercent;
}
```

Note: `normalizeSubrace` drops zero adjustments so the persisted six-integer object (with zeros) maps to the sparse `AbilityAdjustments` the rest of core uses; the Task 1 test's "keeps valid values" expects `{ con: 2, cha: -2 }` for the six-integer input — that is the same behavior.

Create `src/core/races/index.ts`: `export * from "./subrace";`. In `src/core/index.ts` add `export * from "./races";` after `export * from "./kits";`.

`src/core/abilities/racial-adjustments.ts` — change the two functions:

```ts
export function applyRacialDeltas(
  raw: AbilityScores,
  race: Race,
  adjustments: Partial<Record<AbilityKey, number>> = RACIAL_ABILITY_ADJUSTMENTS[race],
): AbilityScores {
  const out = {} as AbilityScores;
  for (const k of KEYS) {
    out[k] = raw[k] + (adjustments[k] ?? 0);
  }
  return out;
}

export function applyRacialAdjustments(
  raw: AbilityScores,
  race: Race,
  adjustments?: Partial<Record<AbilityKey, number>>,
  ranges: Record<AbilityKey, [number, number]> = RACIAL_ABILITY_LIMITS[race],
): AbilityScores {
  const deltaed = applyRacialDeltas(raw, race, adjustments);
  const out = {} as AbilityScores;
  for (const k of KEYS) {
    const [lo, hi] = ranges[k];
    out[k] = Math.min(hi, Math.max(lo, deltaed[k]));
  }
  return out;
}
```
(Keep the surrounding comments; `const deltas`/`limits` locals go away.)

`src/core/saves/racial.ts` — extend `racialSaveBonus`:

```ts
export function racialSaveBonus(
  race: Race,
  category: SaveCategory,
  con: number,
  tags: readonly SaveEffectTag[] = [],
  extra = 0,
): number {
  assertAbilityScore(con, "con");
  const applicable = RACIAL_SAVE_CATEGORIES[race];
  const matches =
    applicable.has(category) ||
    (category === "ppd" && tags.includes("poison") && applicable.has("poison"));
  return matches ? racialConSaveBonus(con) + extra : 0;
}
```
and update its doc comment with one line: `extra` is a subrace's Constitution-save adjustment (SP12 Plan A), added only where the race qualifies.

`src/core/saves/composer.ts` — add `racialSaveAdjustment?: number;` to both `SaveTargetInput` and `SaveTargetBestInput` (doc: SP12 Plan A subrace Constitution-save adjustment), change the `racialSaveBonus(...)` call to `racialSaveBonus(input.race, input.category, input.con, tags, input.racialSaveAdjustment ?? 0)`, and forward `racialSaveAdjustment: input.racialSaveAdjustment` in `saveTarget`'s call to `saveTargetBest`.

`src/core/proficiencies/thief-skills.ts` — add `racialAdjustments?: Readonly<Record<ThiefSkill, number>>;` (doc: SP12 Plan A subrace table; replaces the race lookup when present) to `ThiefSkillContext`, and in both `thiefSkillBaseScore` and `bardSkillBaseScore` replace `THIEF_RACIAL_ADJUSTMENTS[input.race][skill]` with `(input.racialAdjustments ?? THIEF_RACIAL_ADJUSTMENTS[input.race])[skill]`. (`bardSkillBaseScore`'s `skill` is a `BardSkill`, a subset of `ThiefSkill`, so the index type-checks.)

- [ ] **Step 4: Run to verify they pass, plus typecheck**

Run: `npx vitest run tests/core && npm run typecheck`
Expected: PASS. If `tests/core/index.test.ts` asserts the exact set of core exports, add the new names there.

- [ ] **Step 5: Commit**

```bash
git add src/core tests/core
git commit -m "feat(races): pure subrace layer and optional racial override parameters

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Race item schema, snapshot, ability scores and saves

**Files:**
- Modify: `src/data/item/race.ts`, `src/data/derive/character/snapshot.ts`, `src/data/actor/snapshot.ts`, `src/data/derive/character/saves.ts`, `src/data/derive/character/derive.ts`, `src/data/actor/base-actor.ts`
- Test: `tests/data/derive/character/derive.test.ts`, `tests/data/derive/character/saves.test.ts`

**Interfaces:**
- Consumes: `SubraceLayer`, `normalizeSubrace`, `effectiveAbilityAdjustments`, `RawSubrace` (Task 1); `SaveTargetBestInput.racialSaveAdjustment`.
- Produces: race-item `system.subrace` (schema); `ActorSnapshot.raceLayer?: SubraceLayer | null`; `SavesInput.racialSaveAdjustment?: number`; `applyRacialAdjustment` honoring the layer.

- [ ] **Step 1: Write the failing tests.**

In `tests/data/derive/character/saves.test.ts` (match the file's existing fixture style) add:

```ts
  it("a subrace Constitution-save adjustment raises the racial bonus only for a race that qualifies (SP12 Plan A)", () => {
    const input = { groups: [{ group: "warrior" as const, level: 3 }], race: "dwarf" as const, con: 15, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0 };
    const plain = deriveSaves(input);
    const deep = deriveSaves({ ...input, racialSaveAdjustment: 1 });
    expect(deep.rsw.rollModifier).toBe(plain.rsw.rollModifier + 1);
    expect(deep.spell.rollModifier).toBe(plain.spell.rollModifier + 1);
    expect(deep.pp.rollModifier).toBe(plain.pp.rollModifier); // paralysis is not a racial-bonus save
    const human = deriveSaves({ ...input, race: "human", racialSaveAdjustment: 1 });
    expect(human.rsw.rollModifier).toBe(0);
  });
```

In `tests/data/derive/character/derive.test.ts` add (reusing `base`, `fighterClass`, `DEFAULT_OPTIONAL_RULES`; give the snapshot `race: "dwarf"` and a class so saves derive):

```ts
describe("deriveCharacter — subrace layer (SP12 Plan A)", () => {
  const dwarfFighter = { ...base, race: "dwarf" as const, classes: [{ ...fighterClass, level: 3, xp: 4000 }], abilities: { ...base.abilities, con: 15 } };
  const deepLayer = {
    id: "deep-dwarf", abilityAdjustments: { con: 2, cha: -2 }, abilityRanges: null, thiefAdjustments: null,
    conSaveBonusAdjustment: 1, xpModifierPercent: 10,
  };
  it("a deep-dwarf layer adds +1 to the Constitution save modifier of the qualifying saves", () => {
    const plain = deriveCharacter(dwarfFighter, DEFAULT_OPTIONAL_RULES);
    const deep = deriveCharacter({ ...dwarfFighter, raceLayer: deepLayer }, DEFAULT_OPTIONAL_RULES);
    expect(deep.saves!.rsw.rollModifier).toBe(plain.saves!.rsw.rollModifier + 1);
    expect(deep.saves!.spell.rollModifier).toBe(plain.saves!.spell.rollModifier + 1);
    expect(deep.saves!.pp.rollModifier).toBe(plain.saves!.pp.rollModifier);
  });
  it("no layer or the inherit layer leaves the derive unchanged", () => {
    const plain = deriveCharacter(dwarfFighter, DEFAULT_OPTIONAL_RULES);
    expect(deriveCharacter({ ...dwarfFighter, raceLayer: null }, DEFAULT_OPTIONAL_RULES)).toEqual(plain);
  });
});
```

(`classes` entries carry their own `level`; if the file's `deriveClassLevels` recomputes level from `xp`, use an `xp` that yields level 3 for the fighter, 4000 = level 3 per `FIGHTER_XP`.)

For the ability-score and schema parts there is no Foundry-free seam, so cover them in Task 6's headless proof; the Foundry-bound edits below must be small and mechanical.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/derive`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/data/item/race.ts` — import `ABILITY_KEYS` from `"./choices"` and `THIEF_SKILLS` from `"../../core/proficiencies/thief-skills"`, add `SchemaField` to the destructured `foundry.data.fields`, and add after `grantedFeatures`:

```ts
      /** SP12 Plan A: a subrace layer over `raceId` (the base PHB race). Every nullable field defaults to null = inherit the base race's table; existing race items need no migration. */
      subrace: new SchemaField({
        id: new StringField({ required: true, blank: true, initial: "" }),
        abilityAdjustments: new SchemaField(
          Object.fromEntries(ABILITY_KEYS.map((k) => [k, new NumberField({ required: true, integer: true, initial: 0 })])),
          { required: true, nullable: true, initial: null },
        ),
        abilityRanges: new SchemaField(
          Object.fromEntries(
            ABILITY_KEYS.map((k) => [
              k,
              new SchemaField({
                min: new NumberField({ required: true, integer: true, min: 0, max: 25, initial: 3 }),
                max: new NumberField({ required: true, integer: true, min: 0, max: 25, initial: 18 }),
              }),
            ]),
          ),
          { required: true, nullable: true, initial: null },
        ),
        thiefAdjustments: new SchemaField(
          Object.fromEntries(THIEF_SKILLS.map((s) => [s, new NumberField({ required: true, integer: true, initial: 0 })])),
          { required: true, nullable: true, initial: null },
        ),
        conSaveBonusAdjustment: new NumberField({ required: true, integer: true, initial: 0 }),
        xpModifierPercent: new NumberField({ required: true, integer: true, min: -90, initial: 0 }),
      }),
```

`src/data/derive/character/snapshot.ts` — add `import type { SubraceLayer } from "../../../core/races";` and to `ActorSnapshot` after `race`:

```ts
  /** SP12: the race item's subrace layer (null/absent = the plain base race) */
  raceLayer?: SubraceLayer | null;
```

`src/data/actor/snapshot.ts` — import `normalizeSubrace` from `"../../core/races"`, and in the returned snapshot after `race:` add:

```ts
    raceLayer: raceItem ? normalizeSubrace((raceItem.system as RaceItemSystem).subrace) : null,
```
and add `subrace?: RawSubrace` (import the type) to the local `RaceItemSystem` interface.

`src/data/derive/character/saves.ts` — add `/** SP12 Plan A: a subrace's Constitution-save adjustment */ racialSaveAdjustment?: number;` to `SavesInput` and pass `racialSaveAdjustment: input.racialSaveAdjustment` in the `saveTargetBest` call.

`src/data/derive/character/derive.ts` — at both `deriveSaves({...})` call sites add `racialSaveAdjustment: snapshot.raceLayer?.conSaveBonusAdjustment ?? 0,`.

`src/data/actor/base-actor.ts` `applyRacialAdjustment` — change the parent typing to `{ items: Iterable<{ type: string; system: { raceId?: Race; subrace?: RawSubrace } }> }` (import `normalizeSubrace`, `effectiveAbilityAdjustments`, `type RawSubrace` from `"../../core/races"`), and replace the `applyRacialDeltas` line with:

```ts
  const race = raceItem.system.raceId as Race;
  const adj = applyRacialDeltas(raw, race, effectiveAbilityAdjustments(race, normalizeSubrace(raceItem.system.subrace)));
```

- [ ] **Step 4: Run to verify they pass, plus typecheck**

Run: `npx vitest run tests/data && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(races): race-item subrace schema; layered ability adjustments and Constitution-save adjustment

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: XP surcharge threaded through every level lookup

**Files:**
- Modify: `src/data/derive/character/kits.ts`, `src/data/actor/snapshot.ts`, `src/data/item/class.ts`, `src/sheets/character/combat-rolls.ts`, `src/sheets/character/proficiency-actions.ts`, `src/sheets/character/sheet.ts`, `src/sheets/character/spell-actions.ts`
- Test: `tests/data/derive/character/xp-percent.test.ts` (new)

**Interfaces:**
- Consumes: `combineXpPercent`, `normalizeSubrace` (Task 1); `activeKitEntries`, `kitXpPercentFor`.
- Produces (`src/data/derive/character/kits.ts`):
  - `raceXpPercentOf(items: Iterable<{ type: string; system: unknown }>): number`: the first `race` item's `subrace.xpModifierPercent` (0 with none).
  - `actorXpPercentFor(items: Iterable<{ id?: string; name?: string; type: string; system: unknown }>, chassisId: string): number` = `combineXpPercent(kitXpPercentFor(activeKitEntries(items), chassisId), raceXpPercentOf(items))`.

- [ ] **Step 1: Write the failing test.** Create `tests/data/derive/character/xp-percent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { actorXpPercentFor, raceXpPercentOf } from "../../../../src/data/derive/character/kits";

const kitSystem = (chassisId: string, xpModifierPercent: number) => ({
  chassisId, xpModifierPercent,
  qualifications: { abilityMinimums: {}, races: [], alignments: [] },
  effects: [], equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
  forbiddenWeaponProficiencies: [], grantedFeatures: [], powers: [],
});
const kit = (chassisId: string, pct: number) => ({ id: `k-${chassisId}`, name: "K", type: "kit", system: kitSystem(chassisId, pct) });
const cls = (chassisId: string) => ({ id: `c-${chassisId}`, name: chassisId, type: "class", system: { chassisId } });
const race = (xpModifierPercent: number) => ({ id: "r", name: "Deep Dwarf", type: "race", system: { raceId: "dwarf", subrace: { xpModifierPercent } } });

describe("raceXpPercentOf", () => {
  it("reads the race item's subrace percent, 0 with no race item or no subrace field", () => {
    expect(raceXpPercentOf([race(10)])).toBe(10);
    expect(raceXpPercentOf([])).toBe(0);
    expect(raceXpPercentOf([{ type: "race", system: { raceId: "dwarf" } }])).toBe(0);
    expect(raceXpPercentOf([cls("fighter")])).toBe(0);
  });
});

describe("actorXpPercentFor", () => {
  it("adds the active kit's percent for the chassis and the subrace percent", () => {
    const items = [cls("fighter"), kit("fighter", 20), race(10)];
    expect(actorXpPercentFor(items, "fighter")).toBe(30);
  });
  it("applies the subrace percent to a class with no kit (every class of a multiclass)", () => {
    const items = [cls("fighter"), cls("cleric"), kit("fighter", 20), race(10)];
    expect(actorXpPercentFor(items, "cleric")).toBe(10);
  });
  it("is the kit percent alone with no race item, and 0 with nothing", () => {
    expect(actorXpPercentFor([cls("fighter"), kit("fighter", 20)], "fighter")).toBe(20);
    expect(actorXpPercentFor([], "fighter")).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/data/derive/character/xp-percent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/data/derive/character/kits.ts` — import `combineXpPercent, normalizeSubrace, kitXpPercentFor` (kitXpPercentFor from `"../../../core/kits"`, `combineXpPercent`/`normalizeSubrace` from `"../../../core/races"`) and append:

```ts
/** SP12 Plan A: the first race item's subrace XP surcharge percent (0 with none). */
export function raceXpPercentOf(items: Iterable<{ type: string; system: unknown }>): number {
  for (const item of items) {
    if (item.type === "race") return normalizeSubrace((item.system as { subrace?: RawSubrace }).subrace).xpModifierPercent;
  }
  return 0;
}

/** SP12 Plan A: the XP-per-level percentage for a class — its kit's percent plus the race's subrace surcharge. The single helper behind every level lookup. */
export function actorXpPercentFor(
  items: Iterable<{ id?: string; name?: string; type: string; system: unknown }>,
  chassisId: string,
): number {
  const all = [...items];
  return combineXpPercent(kitXpPercentFor(activeKitEntries(all), chassisId), raceXpPercentOf(all));
}
```
(import `type RawSubrace`; reuse the file's existing `ItemLike` type for the parameter if one is already declared there.)

Now replace each call site (read each before editing; keep the surrounding logic identical):

- `src/data/actor/snapshot.ts` (~line 70, inside the `classes` map): `xpModifierPercent: combineXpPercent(kitXpPercentFor(kitEntries, s.chassisId), racePercent),` with `const racePercent = raceItem ? normalizeSubrace((raceItem.system as RaceItemSystem).subrace).xpModifierPercent : 0;` computed once above the map (move/define after `raceItem`).
- `src/data/item/class.ts` `prepareDerivedData`: `const percent = actorXpPercentFor(actor?.items ?? [], sys.chassisId);` (drop the now-unused `kitXpPercentFor`/`activeKitEntries` imports if unused).
- `src/sheets/character/combat-rolls.ts` `resolveThiefBackstabInfo`: `const percent = actorXpPercentFor(actor.items, "thief");`.
- `src/sheets/character/proficiency-actions.ts` `primaryClassLevel`: `actorXpPercentFor(actor.items, s.chassisId)`.
- `src/sheets/character/spell-actions.ts` (two level lookups, ~lines 144 and 181): `actorXpPercentFor(a.items, chassisId)` (use the same actor variable the line uses).
- `src/sheets/character/sheet.ts` (~line 471): replace `kitXpPercentFor(kitEntries, view.chassisId)` with `combineXpPercent(kitXpPercentFor(kitEntries, view.chassisId), raceXpPercentOf(items))` (import both; `items` is the array already in scope).

Remove any import that becomes unused (eslint will flag).

- [ ] **Step 4: Run to verify, plus the full CI-style checks**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS (existing level-threshold tests keep passing because a missing/zero subrace percent changes nothing).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(races): subrace XP surcharge added to the kit percentage at every level lookup

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sheet — thief skills, ability display, XP line, range warning

**Files:**
- Modify: `src/sheets/character/context-types.ts`, `src/sheets/character/context.ts`, `src/sheets/character/sheet.ts`, `src/sheets/character/proficiency-actions.ts`, `templates/actor/pc/partials/pc-feature-panels.hbs`, `lang/en.json`
- Test: `tests/sheets/character/context.test.ts`, `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `SubraceLayer`, `normalizeSubrace`, `effectiveAbilityAdjustments`, `effectiveThiefAdjustments`, `abilityRangeProblems`, `effectiveAbilityRanges` (Task 1); `ThiefSkillContext.racialAdjustments`.
- Produces: `RaceItemView.subrace?: SubraceLayer | null`; `CharacterSheetContext.features.racialXpPercent: number` and `racialXpLabel: string` (`"+20%"`, `"-10%"`, or `""` when 0); lang keys `ADND2E.sheet.features.racialXp` and `ADND2E.sheet.drop.subraceRangeWarning`.

- [ ] **Step 1: Write the failing tests.**

In `tests/sheets/character/context.test.ts`, using the file's existing input builder and a `raceItem` view (copy the shape of a nearby test that supplies `raceItem`), add:

```ts
  it("the racial ability delta uses the subrace layer's adjustments (SP12 Plan A)", () => {
    const deepLayer = { id: "deep-dwarf", abilityAdjustments: { con: 2, cha: -2 }, abilityRanges: null, thiefAdjustments: null, conSaveBonusAdjustment: 1, xpModifierPercent: 10 };
    const withLayer = buildCharacterSheetContext(inputWith({ raceItem: { ...dwarfRaceView, subrace: deepLayer } }));
    const plain = buildCharacterSheetContext(inputWith({ raceItem: dwarfRaceView }));
    expect(withLayer.abilities.find((a) => a.key === "con")!.racialDelta).toBe(2);
    expect(plain.abilities.find((a) => a.key === "con")!.racialDelta).toBe(1);
    expect(withLayer.abilities.find((a) => a.key === "cha")!.racialDelta).toBe(-2);
  });
  it("the thieving skill base uses the subrace thief table when present (SP12 Plan A)", () => {
    // build a thief character input; deep-dwarf pick pockets is +5 versus the PHB dwarf's 0
    /* use the nearest existing thief-skills context test as the template; assert base differs by exactly +5 for pick-pockets */
  });
  it("features.racialXpPercent carries the subrace XP surcharge, 0 otherwise", () => {
    const layer = { id: "duergar", abilityAdjustments: null, abilityRanges: null, thiefAdjustments: null, conSaveBonusAdjustment: 0, xpModifierPercent: 20 };
    const feat = (raceItem: unknown) => buildCharacterSheetContext(inputWith({ raceItem: raceItem as never })).features;
    expect(feat({ ...dwarfRaceView, subrace: layer })).toMatchObject({ racialXpPercent: 20, racialXpLabel: "+20%" });
    expect(feat({ ...dwarfRaceView, subrace: { ...layer, xpModifierPercent: -10 } })).toMatchObject({ racialXpPercent: -10, racialXpLabel: "-10%" });
    expect(feat(dwarfRaceView)).toMatchObject({ racialXpPercent: 0, racialXpLabel: "" });
    expect(feat(null)).toMatchObject({ racialXpPercent: 0, racialXpLabel: "" });
  });
```
The names `inputWith`, `dwarfRaceView`, `buildCharacterSheetContext` stand for whatever the file already uses (read the top of the file and an existing racial-delta test; adapt exactly, keeping the three assertions). The thief test must be a real test with real assertions modeled on the closest existing thief-skill context test; do not leave the comment placeholder.

`tests/lang/en-coverage.test.ts`: append a block asserting `ADND2E.sheet.features.racialXp` and `ADND2E.sheet.drop.subraceRangeWarning` resolve to non-empty strings.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sheets tests/lang`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/sheets/character/context-types.ts` — import `type SubraceLayer` from `"../../core/races"`; add to `RaceItemView`: `/** SP12 Plan A: the subrace layer (null/absent = the plain base race) */ subrace?: SubraceLayer | null;`; add to the `features` object type (next to `racialAbilities: string[]`): `/** SP12 Plan A: the subrace XP-per-level surcharge percent (0 = none) */ racialXpPercent: number;` and `/** the same as a display string: "+20%", "-10%", or "" when 0 */ racialXpLabel: string;`.

`src/sheets/character/sheet.ts` `toRaceView` — add `subrace?: RawSubrace` to its local `s` type, import `normalizeSubrace`/`RawSubrace`, and add `subrace: normalizeSubrace(s.subrace),` to the returned view.

`src/sheets/character/context.ts`:
1. Import `effectiveAbilityAdjustments`, `effectiveThiefAdjustments` from `"../../core/races"`.
2. Ability display (line ~181): replace `const postRacial = applyRacialDeltas(scores, race);` with `const postRacial = applyRacialDeltas(scores, race, effectiveAbilityAdjustments(race, input.raceItem?.subrace));`.
3. Thief skills (line ~566): `const ctx = { race, dexterity: dexScore, armor: armorCategory as never, racialAdjustments: effectiveThiefAdjustments(race, input.raceItem?.subrace) };`.
4. Features (line ~1059): add, beside `racialAbilities`, `racialXpPercent` and `racialXpLabel`, computed once from `const racialXp = input.raceItem?.subrace?.xpModifierPercent ?? 0;` as `racialXpPercent: racialXp, racialXpLabel: racialXp === 0 ? "" : `${racialXp > 0 ? "+" : ""}${racialXp}%`,`.

`src/sheets/character/proficiency-actions.ts` — next to `resolveActorRace`, add:

```ts
/** SP12 Plan A: the race item's subrace thieving-skill table, or undefined (use the base race's). */
function resolveActorRacialThiefAdjustments(actor: ThiefSkillsActor): Readonly<Record<ThiefSkill, number>> | undefined {
  for (const item of actor.items) {
    if (item.type !== "race") continue;
    return normalizeSubrace((item.system as { subrace?: RawSubrace }).subrace).thiefAdjustments ?? undefined;
  }
  return undefined;
}
```
and add `racialAdjustments: resolveActorRacialThiefAdjustments(actor),` to the `checkInput` object (import `normalizeSubrace`, `type RawSubrace` from `"../../core/races"` and `type ThiefSkill` from `"../../core/types"` if not already imported).

`templates/actor/pc/partials/pc-feature-panels.hbs` — in the racial Features panel (the `<ul class="kit-chips">` that iterates `adnd2e.features.racialAbilities`), after the `{{/each}}` and before `</ul>` add nothing; instead add directly after the closing `</ul>`:

```hbs
      {{#if adnd2e.features.racialXpLabel}}<p class="hint">{{localize 'ADND2E.sheet.features.racialXp'}}: {{adnd2e.features.racialXpLabel}}</p>{{/if}}
```

`lang/en.json` — add `"racialXp": "XP per level"` inside `ADND2E.sheet.features`, and `"subraceRangeWarning": "This character's ability scores are outside the subrace's allowed range: {abilities}."` inside `ADND2E.sheet.drop`.

Drop warning (`sheet.ts`, drop handler, after the `if (!verdict.ok) {...}` block and before `super._onDropItem`): when `dropped.type === "race"` and `isNewDrop`, compute and warn (non-blocking):

```ts
    const droppedLayer =
      dropped.type === "race" && isNewDrop
        ? normalizeSubrace((dropped.system as unknown as { subrace?: RawSubrace }).subrace)
        : null;
    // Only a race item that carries its OWN ability ranges (a subrace) warns; the six plain PHB races behave exactly as before.
    if (droppedLayer?.abilityRanges) {
      const layer = droppedLayer;
      const raceId = ((dropped.system as unknown as { raceId?: Race }).raceId ?? "human") as Race;
      const a = this.document as unknown as { system: { abilities: Record<AbilityKey, { score: number }> } };
      const raw = Object.fromEntries(ABILITY_KEYS.map((k) => [k, a.system.abilities[k].score])) as unknown as AbilityScores;
      const adjusted = applyRacialDeltas(raw, raceId, effectiveAbilityAdjustments(raceId, layer));
      const problems = abilityRangeProblems(adjusted, effectiveAbilityRanges(raceId, layer));
      if (problems.length > 0) {
        ui.notifications?.warn(
          game.i18n!.format("ADND2E.sheet.drop.subraceRangeWarning", {
            abilities: problems.map((k) => (CONFIG as unknown as { ADND2E: { abilities: Record<string, string> } }).ADND2E.abilities[k]).join(", "),
          }),
        );
      }
    }
```
(Import the helpers from `"../../core/races"`/`"../../core/abilities"`; `AbilityScores` and `Race` types from core types. This warns only; it never blocks the drop, and it never fires for a race item without its own `abilityRanges`.)

- [ ] **Step 4: Run to verify they pass, plus CI-style checks**

Run: `npx vitest run tests/sheets tests/lang tests/templates && npm run typecheck && npm run lint`
Expected: PASS. No new `data-action` was added, so the template bindings tests are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src tests templates lang
git commit -m "feat(races): subrace on the PC sheet — ability delta, thief skills, XP line, out-of-range toast

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The six dwarf subraces, manifest, README

**Files:**
- Create: `packs/races/_source/hill-dwarf.json`, `mountain-dwarf.json`, `deep-dwarf.json`, `duergar.json`, `sundered-dwarf.json`, `gully-dwarf.json`
- Modify: `packs/races/_source/_MANIFEST.md`, `tests/packs/content.test.ts`, `README.md`
- Check: the races pack builder (`scripts/build-packs.mjs`) needs no change if it compiles every JSON in `_source`.

**Interfaces:** Consumes the schema (Task 2) and `normalizeSubrace`/`effective*` (Task 1).

- [ ] **Step 1: Write the failing test.** In `tests/packs/content.test.ts`, replace the `races pack content` count test (`has 6 documents, one per RaceId`) with `has the 6 PHB races plus the 6 dwarf subraces` (`toHaveLength(12)`; the set of `raceId`s is still exactly `RACE_IDS`, since every subrace's `raceId` is a base race; assert that the six items with a non-blank `subrace.id` all have `raceId: "dwarf"`). Add (import `normalizeSubrace` from `../../src/core/races`, `THIEF_SKILLS` from `../../src/core/proficiencies/thief-skills`, `ABILITY_KEYS` from the same place the file already imports it):

```ts
  const DWARF = {
    "hill-dwarf":     { adj: { con: 1, cha: -1 }, ranges: [[8,18],[3,17],[11,18],[3,18],[3,18],[3,17]], infra: 60,  xp: 0,  conSave: 0, limits: { fighter: 15, cleric: 10, thief: 12 }, thief: [0, 10, 15, 0, 0, 0, -10, -5] },
    "mountain-dwarf":{ adj: { con: 1, cha: -1 }, ranges: [[8,18],[3,17],[11,19],[3,18],[3,18],[3,16]], infra: 60,  xp: 0,  conSave: 0, limits: { fighter: 16, cleric: 10, thief: 12 }, thief: [0, 10, 15, 0, 0, 0, -10, -5] },
    "deep-dwarf":    { adj: { con: 2, cha: -2 }, ranges: [[8,18],[3,16],[13,19],[3,18],[3,18],[3,15]], infra: 90,  xp: 10, conSave: 1, limits: { fighter: 14, cleric: 12, thief: 10 }, thief: [5, 0, 10, 0, 5, 0, -10, -15] },
    "duergar":       { adj: { con: 1, cha: -2 }, ranges: [[8,18],[3,17],[11,18],[3,16],[3,18],[3,15]], infra: 120, xp: 20, conSave: 0, limits: { fighter: 12, cleric: 12, thief: 14 }, thief: [5, 0, 10, 10, 5, 10, -10, -15] },
    "sundered-dwarf":{ adj: { str: 1, con: 1, cha: -1 }, ranges: [[8,18],[3,17],[11,18],[3,16],[3,18],[3,16]], infra: 30, xp: 0, conSave: 0, limits: { fighter: 14, cleric: 10, thief: 15 }, thief: [0, 5, 10, 5, 5, 0, 0, -10] },
    "gully-dwarf":   { adj: { str: 1, dex: 1, cha: -2 }, ranges: [[6,18],[6,18],[8,16],[3,12],[3,14],[3,12]], infra: 60, xp: 0, conSave: 0, limits: { fighter: 8, cleric: 8, thief: 16 }, thief: [10, -5, 5, 0, -5, 0, -5, -25] },
  } as const;

  it("every dwarf subrace matches The Complete Book of Dwarves (PHBR6 ch. 4)", () => {
    const subraces = items.filter((d) => (sys(d).subrace as { id?: string } | undefined)?.id);
    expect(subraces.map((d) => (sys(d).subrace as { id: string }).id).sort()).toEqual(Object.keys(DWARF).sort());
    for (const d of subraces) {
      const id = (sys(d).subrace as { id: keyof typeof DWARF }).id;
      const want = DWARF[id];
      const layer = normalizeSubrace(sys(d).subrace as never);
      expect(sys(d).raceId, id).toBe("dwarf");
      expect(layer.abilityAdjustments, id).toEqual(want.adj);
      expect(ABILITY_KEYS.map((k) => layer.abilityRanges![k]), id).toEqual(want.ranges);
      expect(layer.xpModifierPercent, id).toBe(want.xp);
      expect(layer.conSaveBonusAdjustment, id).toBe(want.conSave);
      expect(THIEF_SKILLS.map((s) => layer.thiefAdjustments![s]), id).toEqual(want.thief);
      expect(sys(d).infravision, id).toBe(want.infra);
      expect(sys(d).classLevelLimits, id).toEqual(want.limits);
      expect(sys(d).size, id).toBe("small");
      expect(sys(d).baseMovement, id).toBe(6);
      expect(sys(d).description, id).toBe("");
    }
  });
  it("race documents have unique names and 16-character ids", () => {
    expect(new Set(items.map((d) => d.name)).size).toBe(items.length);
    for (const d of items) {
      expect(String(d._id)).toHaveLength(16);
      expect(String(d._key)).toBe(`!items!${String(d._id)}`);
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/packs/content.test.ts`
Expected: FAIL (only six races; no subraces).

- [ ] **Step 3: Implement.** Create the six JSON files. Each has this shape; the table below gives the per-file values (ids are exactly 16 characters). `allowedClasses` and `allowedMulticlass` are copied from `packs/races/_source/dwarf.json`; `size` `"small"`, `baseMovement` 6, `description` `""`.

```json
{
  "_id": "kDwarfHill000001",
  "_key": "!items!kDwarfHill000001",
  "name": "Hill Dwarf",
  "type": "race",
  "img": "icons/svg/mountain.svg",
  "system": {
    "description": "",
    "raceId": "dwarf",
    "size": "small",
    "baseMovement": 6,
    "infravision": 60,
    "classLevelLimits": { "cleric": 10, "fighter": 15, "thief": 12 },
    "allowedClasses": ["cleric", "fighter", "thief"],
    "allowedMulticlass": [["fighter", "thief"], ["fighter", "cleric"]],
    "bonusLanguages": ["gnome", "goblin", "kobold", "orc"],
    "grantedFeatures": [],
    "subrace": {
      "id": "hill-dwarf",
      "abilityAdjustments": { "str": 0, "dex": 0, "con": 1, "int": 0, "wis": 0, "cha": -1 },
      "abilityRanges": {
        "str": { "min": 8, "max": 18 }, "dex": { "min": 3, "max": 17 }, "con": { "min": 11, "max": 18 },
        "int": { "min": 3, "max": 18 }, "wis": { "min": 3, "max": 18 }, "cha": { "min": 3, "max": 17 }
      },
      "thiefAdjustments": {
        "pick-pockets": 0, "open-locks": 10, "find-remove-traps": 15, "move-silently": 0,
        "hide-in-shadows": 0, "detect-noise": 0, "climb-walls": -10, "read-languages": -5
      },
      "conSaveBonusAdjustment": 0,
      "xpModifierPercent": 0
    }
  }
}
```

Per file (fill the same shape; `subrace.id`, ability adjustments, ranges, thieving row and `xpModifierPercent`/`conSaveBonusAdjustment` exactly as in the content test's `DWARF` table above; level limits, infravision, languages and features below):

| file | `_id` | name | `bonusLanguages` | `grantedFeatures` |
|---|---|---|---|---|
| hill-dwarf.json | `kDwarfHill000001` | Hill Dwarf | gnome, goblin, kobold, orc | none |
| mountain-dwarf.json | `kDwarfMount00001` | Mountain Dwarf | gnome, goblin, kobold, orc, ogre, troll | none |
| deep-dwarf.json | `kDwarfDeep000001` | Deep Dwarf | duergar, drow, illithid, kua-toa, troll, troglodyte, svirfneblin, undercommon | "Deep dwarf: -1 in bright light" |
| duergar.json | `kDwarfDuergar001` | Duergar | deep dwarf, drow, illithid, kua-toa, troll, troglodyte, undercommon | "Duergar: stealthy (surprise bonus)", "Duergar: innate enlarge and invisibility", "Duergar: bright-light penalties" |
| sundered-dwarf.json | `kDwarfSunder0001` | Sundered Dwarf | elf, goblin, orc, gnome, kobold, halfling, hobgoblin | "Sundered: claustrophobia" |
| gully-dwarf.json | `kDwarfGully00001` | Gully Dwarf | gnome, orc, goblin | "Gully: groveling", "Gully: magic items fail 40%" |

(`_id` strings above are exactly 16 characters; double-check each with the content test's length assertion. `classLevelLimits` per file: hill {cleric 10, fighter 15, thief 12}; mountain {16, 10, 12}; deep {fighter 14, cleric 12, thief 10}; duergar {fighter 12, cleric 12, thief 14}; sundered {fighter 14, cleric 10, thief 15}; gully {fighter 8, cleric 8, thief 16}.)

`_MANIFEST.md` — append a section "Dwarf subraces (SP12 Plan A)" stating the source (*The Complete Book of Dwarves* ch. 4 pp. 28-36, read from the text layer; the subrace thieving table from the page image), listing the six items and noting that mechanical values only are shipped and special advantages are labels only.

`README.md` — update the Sub-project 12 row: `📋 Not started` → `🚧 Plan A complete (engine + the six dwarf subraces)`; describe the subrace layer and note that the elf subraces (Plan B) and gnome and halfling subraces (Plan C) are pending, level limits are still data only, and enmities/innate powers/bespoke specials are display labels only.

- [ ] **Step 4: Run to verify it passes, then build the pack**

Run: `npx vitest run tests/packs tests/data && npm run build:packs`
Expected: PASS; `build-packs: races  12/12 documents OK`.

- [ ] **Step 5: Commit**

```bash
git add packs README.md tests/packs
git commit -m "feat(races): the six dwarf subraces from PHBR6, manifest and README (SP12 Plan A)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verification gates (no new feature code unless a gate fails)

- [ ] **Step 1: The full CI sequence, exactly as `.github/workflows/ci.yml` runs it.** Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. Expected: all green, 100% statements/lines/functions.
- [ ] **Step 2: Whole-branch review** with superpowers:requesting-code-review on `git diff master...HEAD` using the most capable model. Blocking: any Critical/Important. Pay particular attention to: every `kitXpPercentFor(...)` call site was replaced (grep `kitXpPercentFor` — only the helper definition, its tests, and the new combine call sites may remain); the layered tables fall back correctly for the six PHB races and for existing characters whose race item has no `subrace` data (schema defaults, `normalizeSubrace`); an actor with no race item; the Constitution-save adjustment only applying where the base race already qualifies; thieving-skill display and roll using the same table; kit race qualifications still matching the base race; the drop warning never blocking; the `ObjectField`-shared-initial hazard (no new `initial: {}`/`[]`); non-GM seat (all effects are derived locally).
- [ ] **Step 3: Headless proof (controller, per the `foundry-headless-proof-harness` and `foundry-objectfield-initial-shared` memories).** With real Foundry classes and the shipped dwarf JSON: `RaceItemModel.schema.validate(schema.clean(copy))` accepts all 12 race items and a pre-existing item without `subrace` cleans to the inherit defaults; the real `applyRacialAdjustment` (fake model + parent items) gives Deep Dwarf Con +2 / Cha -2 and Hill Dwarf Con +1 / Cha -1, and an item without `subrace` is unchanged; the real `deriveCharacter` via `snapshotActor` gives the deep dwarf +1 on the Constitution saves; the real `actorXpPercentFor` gives a deep-dwarf fighter 10, plus a +20 kit = 30, and both classes of a deep-dwarf fighter/cleric 10; real level thresholds with that percent (a deep-dwarf fighter needs 2,200 XP for level 2 per the book's own worked example; a deep-dwarf fighter/cleric needs 1,650 for level 2 priest); the real thieving-skill base for a deep-dwarf thief versus a PHB dwarf thief; the rendered racial Features panel line "XP per level: +10%"; the real drop-warning computation for an out-of-range character.
- [ ] **Step 4: Rebuild the installed system** (`npm run build`) only if Foundry is closed (check for a running process first).
- [ ] **Step 5: Push and open the PR** (branch-finishing preference: always push + PR, never ask). PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Confirm CI is green; do NOT retry `gh pr merge`; ask the user to merge. Hand the user a short **manual checklist** for what the harness cannot prove: as a non-GM player seat, drop Deep Dwarf on a fresh character and see the adjusted scores, the "XP per level: +10%" line, the XP thresholds, and the out-of-range toast for a character with low Constitution; drop Hill Dwarf and confirm nothing changes versus the PHB Dwarf; a deep-dwarf thief's skill table; a multiclass dwarf's thresholds with a kit.

---

## Self-Review notes

- Spec coverage: data model → Task 2; pure core and optional params → Task 1; ability, saves, snapshot plumbing → Task 2; XP helper at all seven sites → Task 3; sheet (race row via item name, XP line, thief display, ability delta) and the non-blocking range toast → Task 4; the six dwarf items, manifest, README → Task 5; testing, gates, headless proof, manual checklist → Task 6.
- Names are consistent across tasks: `SubraceLayer`, `NO_SUBRACE`, `normalizeSubrace`, `RawSubrace`, `effectiveAbilityAdjustments` / `Ranges` / `ThiefAdjustments`, `abilityRangeProblems`, `combineXpPercent`, `raceXpPercentOf`, `actorXpPercentFor`, `ActorSnapshot.raceLayer`, `SavesInput.racialSaveAdjustment`, `ThiefSkillContext.racialAdjustments`, `RaceItemView.subrace`, `features.racialXpPercent`.
- Judgment points left to implementers, flagged in-task: the existing fixture/builder names in `context.test.ts` and the saves/thief core tests, the `gt` helper versus a precomputed label (prefer the label), and whether `tests/core/index.test.ts` enumerates exports.
