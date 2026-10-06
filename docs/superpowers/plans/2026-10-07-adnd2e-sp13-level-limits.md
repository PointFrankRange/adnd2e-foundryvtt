# Sub-project 13: Racial Level Limits and Exceeding Them — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the racial class level limits that race items already carry (setting on by default), with two optional rules: exceeding a limit at 2x/3x/4x XP per level beyond it, and prime-requisite bonus levels (Dwarves book table).

**Architecture:** A pure `src/core/classes/level-limits.ts` (`bonusLevels`, `LevelRules`, `levelForXpWithRules`, `xpToNextWithRules`) feeds the existing level lookups. One new helper `actorLevelRulesFor` next to `actorXpPercentFor` returns `{ xpPercent, rules }` for a class; every level lookup that used `actorXpPercentFor` switches to it, so levels, level-up checks and thresholds get the rules from one place. Three world settings carry the options.

**Tech Stack:** TypeScript, Foundry v14 settings, Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-adnd2e-sp13-level-limits-design.md`.

## Global Constraints

- **Every implementer runs `npm run typecheck` (NOT just `tsc -p tsconfig.json`; it also runs the Foundry-free `tsconfig.core.json` pass), `npm run lint` and the task's tests before reporting done; the controller runs the full CI sequence `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR.** If `npm run build` fails with a LevelDB LOCK error (Foundry is open), do NOT kill Foundry; verify the pack compile another way and tell the controller.
- 100% statement/line/function coverage gate (90% branches) on `src/core/**`, `src/data/derive/**`, `src/settings/registry.ts`, `src/sheets/character/{context,context-types,xp}.ts`. Foundry glue (`src/settings/index.ts`, `src/data/item/class.ts`, `src/data/actor/**`, `src/sheets/character/{sheet,combat-rolls,proficiency-actions,spell-actions}.ts`, `src/sheets/npc/sheet.ts`) is outside the gate but unit-tested where a seam exists.
- **Defaults must reproduce today's behavior everywhere a caller passes no rules:** `classItemLevel(...)`, `classItemCanLevelUp(...)`, `xpToNext(...)` with no rules argument behave exactly as before; every existing level-threshold test passes unchanged.
- The level limit comes from the race item's `classLevelLimits[chassisId]` (a number); missing or null = unlimited. Do NOT change race item data.
- Source files use CRLF line endings (preserve them); all changed files valid UTF-8 (`git diff --name-only master HEAD | while read f; do iconv -f UTF-8 -t UTF-8 "$f" >/dev/null 2>&1 || echo "bad: $f"; done` prints nothing). No object/array-literal `initial` on Foundry fields (this plan adds no schema fields).
- Every new user-visible string goes in `lang/en.json` and is asserted in `tests/lang/en-coverage.test.ts`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `src/core/classes/level-limits.ts`; modify `src/core/classes/index.ts` (export it), `src/core/options.ts`, `src/settings/registry.ts`, `src/settings/index.ts`, `src/types/global.d.ts`, `lang/en.json`.
- Modify `src/data/derive/class-item.ts`, `src/data/derive/character/levels.ts`, `src/data/derive/character/snapshot.ts`, `src/data/derive/character/kits.ts`, `src/data/derive/character/derive.ts` (only if the snapshot signature needs it), `src/data/actor/snapshot.ts`, `src/data/actor/base-actor.ts`, `src/data/item/class.ts`.
- Modify `src/sheets/character/{xp.ts,context.ts,context-types.ts,sheet.ts,combat-rolls.ts,proficiency-actions.ts,spell-actions.ts}`, `src/sheets/npc/sheet.ts`, `templates/actor/pc/partials/pc-class-row.hbs`.
- Tests: create `tests/core/classes/level-limits.test.ts`; modify `tests/settings/registry.test.ts`, `tests/core/options.test.ts` (if it enumerates the bag), `tests/data/derive/class-item.test.ts`, `tests/data/derive/character/levels.test.ts`, `tests/data/derive/kits.test.ts` or a new `tests/data/derive/character/level-rules.test.ts`, `tests/sheets/character/xp.test.ts`, `tests/sheets/character/context.test.ts`, `tests/lang/en-coverage.test.ts`.
- Modify `README.md`.

---

### Task 1: Pure level-limit rules and the three settings

**Files:**
- Create: `src/core/classes/level-limits.ts`
- Modify: `src/core/classes/index.ts`, `src/core/options.ts`, `src/settings/registry.ts`, `src/settings/index.ts`, `src/types/global.d.ts`, `lang/en.json`
- Test: `tests/core/classes/level-limits.test.ts` (new), `tests/settings/registry.test.ts`, `tests/lang/en-coverage.test.ts`, `tests/core/options.test.ts` (only if it pins the bag's keys)

**Interfaces:**
- Produces (exported from `src/core/classes`):
  - `bonusLevels(primeRequisiteScore: number): number`
  - `interface LevelRules { limit: number | null; beyondMultiplier: number }`, `NO_LEVEL_RULES`
  - `levelRulesOf(view: { levelLimit?: number | null; beyondMultiplier?: number }): LevelRules`
  - `levelForXpWithRules(chassis: ClassChassis, xp: number, rules: LevelRules): number` (`chassis` is already XP-scaled)
  - `interface LimitedXpProgress { level: number; next: number | null; toNextLevel: number | null; pct: number; atLimit: boolean }`
  - `xpToNextWithRules(chassis: ClassChassis, xp: number, rules: LevelRules): LimitedXpProgress`
- Produces (settings): `OptionalRules.racialLevelLimits: boolean` (default true), `OptionalRules.exceedLevelLimits: 0 | 2 | 3 | 4` (default 0), `OptionalRules.primeRequisiteBonusLevels: boolean` (default false); registry descriptors `racialLevelLimits` and `primeRequisiteBonusLevels`; `EXCEED_LEVEL_LIMIT_CHOICES = ["off","x2","x3","x4"] as const` read by `readOptionalRules` from the setting key `exceedLevelLimits`.

- [ ] **Step 1: Write the failing tests.**

Create `tests/core/classes/level-limits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getChassis } from "../../../src/core/classes/chassis";
import {
  NO_LEVEL_RULES,
  bonusLevels,
  levelForXpWithRules,
  levelRulesOf,
  xpToNextWithRules,
} from "../../../src/core/classes/level-limits";
import { levelForXp } from "../../../src/core/classes/progression";
import { scaleChassisXp } from "../../../src/core/kits";

const fighter = getChassis("fighter"); // level 15 = 1,750,000; 16 = 2,000,000; 17 = 2,250,000
const druid = getChassis("druid"); // maxLevel 14

describe("bonusLevels (Complete Book of Dwarves p.35)", () => {
  it("follows the table at every boundary", () => {
    expect([12, 13, 14, 15, 16, 17, 18, 19, 20, 25].map(bonusLevels)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 4, 4]);
  });
});

describe("levelRulesOf", () => {
  it("reads a class view's optional fields, defaulting to no limit", () => {
    expect(levelRulesOf({})).toEqual({ limit: null, beyondMultiplier: 0 });
    expect(levelRulesOf({ levelLimit: 15, beyondMultiplier: 2 })).toEqual({ limit: 15, beyondMultiplier: 2 });
    expect(levelRulesOf({ levelLimit: null })).toEqual(NO_LEVEL_RULES);
  });
});

describe("levelForXpWithRules", () => {
  it("no limit equals levelForXp", () => {
    for (const xp of [0, 1999, 2000, 1_750_000, 9_000_000]) expect(levelForXpWithRules(fighter, xp, NO_LEVEL_RULES)).toBe(levelForXp(fighter, xp));
  });
  it("a limit with multiplier 0 caps the level", () => {
    const r = { limit: 15, beyondMultiplier: 0 };
    expect(levelForXpWithRules(fighter, 1_749_999, r)).toBe(14);
    expect(levelForXpWithRules(fighter, 1_750_000, r)).toBe(15);
    expect(levelForXpWithRules(fighter, 5_000_000, r)).toBe(15);
  });
  it("beyond the limit each XP gap costs k times as much (x2, x3, x4), exactly at the threshold and one short", () => {
    // gap 15 -> 16 is 250,000; 16 -> 17 is 250,000
    const at = (k: number, xp: number) => levelForXpWithRules(fighter, xp, { limit: 15, beyondMultiplier: k });
    expect(at(2, 2_249_999)).toBe(15);
    expect(at(2, 2_250_000)).toBe(16);
    expect(at(2, 2_749_999)).toBe(16);
    expect(at(2, 2_750_000)).toBe(17);
    expect(at(3, 2_499_999)).toBe(15);
    expect(at(3, 2_500_000)).toBe(16);
    expect(at(4, 2_749_999)).toBe(15);
    expect(at(4, 2_750_000)).toBe(16);
    expect(at(2, 1_000_000)).toBe(12); // below the limit: unchanged
  });
  it("stacks with the race/kit percentage (the scaled gaps are multiplied by k)", () => {
    const scaled = scaleChassisXp(fighter, 10); // level 15 = 1,925,000, level 16 = 2,200,000
    const r = { limit: 15, beyondMultiplier: 2 };
    expect(levelForXpWithRules(scaled, 2_474_999, r)).toBe(15);
    expect(levelForXpWithRules(scaled, 2_475_000, r)).toBe(16);
  });
  it("a class's own maxLevel still applies", () => {
    expect(levelForXpWithRules(druid, 99_000_000, { limit: 20, beyondMultiplier: 0 })).toBe(14);
    expect(levelForXpWithRules(druid, 99_000_000, { limit: 20, beyondMultiplier: 2 })).toBe(14);
  });
});

describe("xpToNextWithRules", () => {
  it("below any limit it is the normal progress", () => {
    const p = xpToNextWithRules(fighter, 8000, { limit: 15, beyondMultiplier: 0 });
    expect(p).toMatchObject({ level: 4, next: 16000, toNextLevel: 8000, atLimit: false });
    expect(p.pct).toBeCloseTo(0);
  });
  it("capped: at the limit with multiplier 0 there is no next threshold", () => {
    expect(xpToNextWithRules(fighter, 2_000_000, { limit: 15, beyondMultiplier: 0 })).toEqual({
      level: 15, next: null, toNextLevel: null, pct: 1, atLimit: true,
    });
  });
  it("beyond the limit with x2 the next threshold is the multiplied one", () => {
    const p = xpToNextWithRules(fighter, 2_000_000, { limit: 15, beyondMultiplier: 2 });
    expect(p).toMatchObject({ level: 15, next: 2_250_000, toNextLevel: 250_000, atLimit: false });
    expect(p.pct).toBeCloseTo(0.5);
    const q = xpToNextWithRules(fighter, 2_300_000, { limit: 15, beyondMultiplier: 2 });
    expect(q).toMatchObject({ level: 16, next: 2_750_000, atLimit: false }); // 1,750,000 + 2 * (2,250,000 - 1,750,000)
  });
  it("no limit past the XP table is the existing end-of-table result", () => {
    expect(xpToNextWithRules(druid, 99_000_000, NO_LEVEL_RULES)).toEqual({ level: 14, next: null, toNextLevel: null, pct: 1, atLimit: false });
  });
  it("is clamped to 0..1 even when xp sits below the band start", () => {
    expect(xpToNextWithRules(fighter, 0, NO_LEVEL_RULES).pct).toBe(0);
  });
});
```

In `tests/settings/registry.test.ts` (match the file's existing style) add:

```ts
  it("reads the SP13 level-limit settings (racialLevelLimits defaults ON; exceedLevelLimits maps off/x2/x3/x4 to 0/2/3/4; garbage = 0)", () => {
    const none = readOptionalRules(() => undefined);
    expect(none.racialLevelLimits).toBe(true);
    expect(none.primeRequisiteBonusLevels).toBe(false);
    expect(none.exceedLevelLimits).toBe(0);
    expect(readOptionalRules((k) => (k === "racialLevelLimits" ? false : undefined)).racialLevelLimits).toBe(false);
    expect(readOptionalRules((k) => (k === "primeRequisiteBonusLevels" ? true : undefined)).primeRequisiteBonusLevels).toBe(true);
    const exceed = (v: unknown) => readOptionalRules((k) => (k === "exceedLevelLimits" ? v : undefined)).exceedLevelLimits;
    expect([exceed("off"), exceed("x2"), exceed("x3"), exceed("x4")]).toEqual([0, 2, 3, 4]);
    for (const bad of ["x5", "toString", "", 3, true, null]) expect(exceed(bad), String(bad)).toBe(0);
  });
```

In `tests/lang/en-coverage.test.ts` append a block asserting these keys resolve to non-empty strings: `ADND2E.settings.racialLevelLimits.name`, `.hint`; `ADND2E.settings.primeRequisiteBonusLevels.name`, `.hint`; `ADND2E.settings.exceedLevelLimits.name`, `.hint`, `.off`, `.x2`, `.x3`, `.x4`; `ADND2E.sheet.xp.atLimit`. (The existing settings-coverage test will also require name/hint for the two new descriptors.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/classes tests/settings tests/lang`
Expected: FAIL (module/fields missing).

- [ ] **Step 3: Implement.**

Create `src/core/classes/level-limits.ts`:

```ts
/* SP13: racial level limits and the optional rules for exceeding them. Pure; Foundry-free.
 * `chassis` arguments are already XP-scaled by the race/kit percentage (scaleChassisXp). */
import { levelForXp, xpForLevel } from "./progression";
import type { ClassChassis } from "../types";

/** Complete Book of Dwarves p.35, Bonus Levels Table: single-class bonus levels from the prime requisite. */
export function bonusLevels(primeRequisiteScore: number): number {
  if (primeRequisiteScore >= 19) return 4;
  if (primeRequisiteScore >= 18) return 3;
  if (primeRequisiteScore >= 16) return 2;
  if (primeRequisiteScore >= 14) return 1;
  return 0;
}

export interface LevelRules {
  /** the effective level cap for this class (null = unlimited) */
  limit: number | null;
  /** 0 = the cap is hard; k >= 2 = each XP gap beyond the cap costs k times as much */
  beyondMultiplier: number;
}

export const NO_LEVEL_RULES: LevelRules = Object.freeze({ limit: null, beyondMultiplier: 0 }) as LevelRules;

/** A class view's optional rule fields as LevelRules. */
export function levelRulesOf(view: { levelLimit?: number | null; beyondMultiplier?: number }): LevelRules {
  return { limit: view.levelLimit ?? null, beyondMultiplier: view.beyondMultiplier ?? 0 };
}

/** The limit clamped to the class's own maxLevel (xpForLevel throws beyond it). */
function effectiveLimit(chassis: ClassChassis, limit: number | null): number | null {
  if (limit === null) return null;
  return chassis.maxLevel != null ? Math.min(limit, chassis.maxLevel) : limit;
}

export function levelForXpWithRules(chassis: ClassChassis, xp: number, rules: LevelRules): number {
  const limit = effectiveLimit(chassis, rules.limit);
  if (limit === null) return levelForXp(chassis, xp);
  const k = rules.beyondMultiplier;
  if (k <= 0) return Math.min(levelForXp(chassis, xp), limit);
  const top = xpForLevel(chassis, limit);
  if (xp <= top) return levelForXp(chassis, xp);
  // each XP gap beyond the limit costs k times as much: map the surplus back onto the normal table
  return levelForXp(chassis, top + Math.floor((xp - top) / k));
}

export interface LimitedXpProgress {
  level: number;
  next: number | null;
  toNextLevel: number | null;
  pct: number;
  atLimit: boolean;
}

export function xpToNextWithRules(chassis: ClassChassis, xp: number, rules: LevelRules): LimitedXpProgress {
  const level = levelForXpWithRules(chassis, xp, rules);
  const limit = effectiveLimit(chassis, rules.limit);
  if (limit !== null && rules.beyondMultiplier <= 0 && level >= limit) {
    return { level, next: null, toNextLevel: null, pct: 1, atLimit: true };
  }
  // past the end of the class's XP table there is no next threshold (same gate the sheet always used)
  if (level >= chassis.xpThresholds.length) return { level, next: null, toNextLevel: null, pct: 1, atLimit: false };
  const k = limit !== null && rules.beyondMultiplier > 0 ? rules.beyondMultiplier : 1;
  const top = limit !== null ? xpForLevel(chassis, limit) : 0;
  const threshold = (l: number): number =>
    limit !== null && l > limit ? top + k * (xpForLevel(chassis, l) - top) : xpForLevel(chassis, l);
  const bandStart = threshold(level);
  const next = threshold(level + 1);
  const pct = Math.min(1, Math.max(0, (xp - bandStart) / (next - bandStart)));
  return { level, next, toNextLevel: Math.max(0, next - xp), pct, atLimit: false };
}
```

`src/core/classes/index.ts` — add `export * from "./level-limits";` (read the file first and follow its export style; if it uses named exports, add the equivalent).

`src/core/options.ts` — add to `OptionalRules`:

```ts
  /** Sub-project 13: enforce the racial class level limits carried by the race item (core 2E rule; ON by default). */
  racialLevelLimits: boolean;
  /** Sub-project 13: exceeding a racial level limit costs this many times the XP per level (0 = off, or 2, 3, 4). Only meaningful with racialLevelLimits on. */
  exceedLevelLimits: 0 | 2 | 3 | 4;
  /** Sub-project 13: bonus levels past a racial limit from a high prime requisite (single-class; Complete Book of Dwarves table). */
  primeRequisiteBonusLevels: boolean;
```
and to `DEFAULT_OPTIONAL_RULES`: `racialLevelLimits: true, exceedLevelLimits: 0, primeRequisiteBonusLevels: false,`.

`src/settings/registry.ts` — add the two descriptors to `SETTING_DESCRIPTORS` after the `multiclassHpAveraging` entry (core group):

```ts
  { key: "racialLevelLimits", group: "core", default: true, config: true, optionalRulesKey: "racialLevelLimits", requiresReload: true },
  { key: "primeRequisiteBonusLevels", group: "core", default: false, config: true, optionalRulesKey: "primeRequisiteBonusLevels", requiresReload: true },
```
and below the descriptors export:

```ts
/** SP13: the exceedLevelLimits choice setting (a String choice, registered separately in src/settings/index.ts like playerAppliedEffects). */
export const EXCEED_LEVEL_LIMIT_CHOICES = ["off", "x2", "x3", "x4"] as const;
const EXCEED_MULTIPLIERS: Readonly<Record<(typeof EXCEED_LEVEL_LIMIT_CHOICES)[number], 0 | 2 | 3 | 4>> = { off: 0, x2: 2, x3: 3, x4: 4 };
```
In `readOptionalRules`, after the descriptor loop and before `return bag;` add:

```ts
  const exceed = get("exceedLevelLimits");
  bag.exceedLevelLimits =
    typeof exceed === "string" && Object.prototype.hasOwnProperty.call(EXCEED_MULTIPLIERS, exceed)
      ? EXCEED_MULTIPLIERS[exceed as keyof typeof EXCEED_MULTIPLIERS]
      : 0;
```

`src/settings/index.ts` — import `EXCEED_LEVEL_LIMIT_CHOICES` and, after the `playerAppliedEffects` registration inside `registerSettings`, add:

```ts
  game.settings!.register(SYSTEM_ID, "exceedLevelLimits" as SettingKey, {
    name: "ADND2E.settings.exceedLevelLimits.name",
    hint: "ADND2E.settings.exceedLevelLimits.hint",
    scope: "world",
    config: true,
    type: String,
    choices: Object.fromEntries(EXCEED_LEVEL_LIMIT_CHOICES.map((c) => [c, `ADND2E.settings.exceedLevelLimits.${c}`])),
    default: "off",
    requiresReload: true,
  } as never);
```
`src/types/global.d.ts` — add the three new setting keys (`racialLevelLimits`, `primeRequisiteBonusLevels` booleans; `exceedLevelLimits` string) to the `SettingConfig` augmentation next to the existing ones (read the file and follow its pattern exactly; `playerAppliedEffects` is the string precedent).

`lang/en.json` — add under `ADND2E.settings` (follow the neighbouring entries' shape):

```json
      "racialLevelLimits": {
        "name": "Racial level limits",
        "hint": "Enforce the class level limits listed on a character's race (PHB / DMG): a character cannot advance past their race's maximum level for a class."
      },
      "exceedLevelLimits": {
        "name": "Exceeding level limits",
        "hint": "Let characters advance past their racial level limit by earning this many times the normal experience for each level beyond it (cumulative with a race's own experience cost). Needs racial level limits on.",
        "off": "Off (limits are hard)",
        "x2": "Double experience",
        "x3": "Triple experience",
        "x4": "Quadruple experience"
      },
      "primeRequisiteBonusLevels": {
        "name": "Bonus levels for high prime requisites",
        "hint": "A single-classed character with a high prime requisite may exceed the racial limit by 1 level (score 14-15), 2 (16-17), 3 (18) or 4 (19+). Needs racial level limits on."
      },
```
and `"atLimit": "limit"` inside `ADND2E.sheet.xp`.

- [ ] **Step 4: Run to verify they pass, plus typecheck**

Run: `npx vitest run tests/core tests/settings tests/lang && npm run typecheck`
Expected: PASS. If an existing test pins the full `OptionalRules` key set or `DEFAULT_OPTIONAL_RULES` with `toEqual`, add the three keys there.

- [ ] **Step 5: Commit**

```bash
git add src tests lang
git commit -m "feat(classes): pure racial level-limit rules and the three level-limit settings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Derive layer — class levels honor the rules

**Files:**
- Modify: `src/data/derive/class-item.ts`, `src/data/derive/character/levels.ts`, `src/data/derive/character/snapshot.ts`, `src/data/derive/character/kits.ts`, `src/data/actor/snapshot.ts`, `src/data/actor/base-actor.ts`
- Test: `tests/data/derive/class-item.test.ts`, `tests/data/derive/character/levels.test.ts`, new `tests/data/derive/character/level-rules.test.ts`

**Interfaces:**
- Consumes: `LevelRules`, `NO_LEVEL_RULES`, `bonusLevels`, `levelForXpWithRules`, `levelRulesOf` (Task 1); `OptionalRules` fields (Task 1); `actorXpPercentFor`.
- Produces:
  - `classItemLevel(chassisId, xp, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES)`; `classItemCanLevelUp(chassisId, xp, hpRollsLength, xpModifierPercent = 0, rules = NO_LEVEL_RULES)`
  - `ClassEntry.levelLimit?: number | null`, `ClassEntry.beyondMultiplier?: number`
  - `abilityScoresOf(system: { abilities?: Record<string, { score?: number } | undefined> } | null | undefined): Partial<Record<AbilityKey, number>>` and `actorLevelRulesFor(items: Iterable<ItemLike>, chassisId: string, options: OptionalRules, scores?: Partial<Record<AbilityKey, number>>): { xpPercent: number; rules: LevelRules }` (both in `src/data/derive/character/kits.ts`)
  - `snapshotActor(actor, options: OptionalRules = getOptionalRules())`

- [ ] **Step 1: Write the failing tests.**

Create `tests/data/derive/character/level-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { abilityScoresOf, actorLevelRulesFor } from "../../../../src/data/derive/character/kits";

const cls = (chassisId: string) => ({ id: `c-${chassisId}`, name: chassisId, type: "class", system: { chassisId } });
const race = (limits: Record<string, number | null>, xpModifierPercent = 0) => ({
  id: "r", name: "Race", type: "race", system: { raceId: "dwarf", classLevelLimits: limits, subrace: { xpModifierPercent } },
});
const on = { ...DEFAULT_OPTIONAL_RULES, racialLevelLimits: true, exceedLevelLimits: 0 as const, primeRequisiteBonusLevels: false };

describe("abilityScoresOf", () => {
  it("reads prepared scores, ignoring missing or non-numeric entries", () => {
    expect(abilityScoresOf({ abilities: { str: { score: 18 }, dex: { score: 12 }, con: undefined, int: { score: "x" as never } } })).toEqual({ str: 18, dex: 12 });
    expect(abilityScoresOf(undefined)).toEqual({});
    expect(abilityScoresOf({})).toEqual({});
  });
});

describe("actorLevelRulesFor", () => {
  it("takes the limit from the race item and the XP percent from race + kit", () => {
    const items = [race({ fighter: 15, cleric: 10 }, 10), cls("fighter"), cls("cleric")];
    expect(actorLevelRulesFor(items, "fighter", on)).toEqual({ xpPercent: 10, rules: { limit: 15, beyondMultiplier: 0 } });
    expect(actorLevelRulesFor(items, "cleric", on).rules.limit).toBe(10);
  });
  it("a class missing from the limits, a null limit, or no race item is unlimited", () => {
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("thief")], "thief", on).rules.limit).toBeNull();
    expect(actorLevelRulesFor([race({ fighter: null }), cls("fighter")], "fighter", on).rules.limit).toBeNull();
    expect(actorLevelRulesFor([cls("fighter")], "fighter", on)).toEqual({ xpPercent: 0, rules: { limit: null, beyondMultiplier: 0 } });
  });
  it("with enforcement off there are no rules, but the XP percent still applies", () => {
    const off = { ...on, racialLevelLimits: false, exceedLevelLimits: 3 as const, primeRequisiteBonusLevels: true };
    expect(actorLevelRulesFor([race({ fighter: 15 }, 10), cls("fighter")], "fighter", off, { str: 18 })).toEqual({
      xpPercent: 10, rules: { limit: null, beyondMultiplier: 0 },
    });
  });
  it("passes the exceed multiplier through", () => {
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", { ...on, exceedLevelLimits: 3 }).rules).toEqual({ limit: 15, beyondMultiplier: 3 });
  });
  it("bonus levels add to the limit for a single-class character only, from the LOWEST prime requisite", () => {
    const bonus = { ...on, primeRequisiteBonusLevels: true };
    // fighter: prime requisite STR 18 -> +3
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", bonus, { str: 18 }).rules.limit).toBe(18);
    // multiclass: no bonus levels
    expect(actorLevelRulesFor([race({ fighter: 15, cleric: 10 }), cls("fighter"), cls("cleric")], "fighter", bonus, { str: 18 }).rules.limit).toBe(15);
    // paladin: STR and CHA are prime requisites; the lowest (CHA 14 -> +1) is used
    expect(actorLevelRulesFor([race({ paladin: 10 }), cls("paladin")], "paladin", bonus, { str: 18, cha: 14 }).rules.limit).toBe(11);
    // no scores supplied: no bonus
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", bonus).rules.limit).toBe(15);
    // a missing prime requisite score counts as no bonus
    expect(actorLevelRulesFor([race({ paladin: 10 }), cls("paladin")], "paladin", bonus, { str: 18 }).rules.limit).toBe(10);
    // bonus off: none
    expect(actorLevelRulesFor([race({ fighter: 15 }), cls("fighter")], "fighter", on, { str: 18 }).rules.limit).toBe(15);
    // an unlimited class stays unlimited whatever the bonus
    expect(actorLevelRulesFor([race({}), cls("fighter")], "fighter", bonus, { str: 18 }).rules.limit).toBeNull();
  });
});
```

In `tests/data/derive/class-item.test.ts` add (use the file's import style):

```ts
  it("classItemLevel and classItemCanLevelUp honor level rules, defaulting to none (SP13)", () => {
    expect(classItemLevel("fighter", 5_000_000)).toBe(levelForXp(getChassis("fighter"), 5_000_000));
    expect(classItemLevel("fighter", 5_000_000, 0, { limit: 15, beyondMultiplier: 0 })).toBe(15);
    expect(classItemLevel("fighter", 2_250_000, 0, { limit: 15, beyondMultiplier: 2 })).toBe(16);
    expect(classItemCanLevelUp("fighter", 5_000_000, 15, 0, { limit: 15, beyondMultiplier: 0 })).toBe(false);
    expect(classItemCanLevelUp("fighter", 5_000_000, 14, 0, { limit: 15, beyondMultiplier: 0 })).toBe(true);
  });
```
(import `levelForXp` from `../../../src/core/classes/progression` and `getChassis` if not already imported.)

In `tests/data/derive/character/levels.test.ts` add:

```ts
  it("deriveClassLevels honors a class entry's level limit and beyond-limit multiplier (SP13)", () => {
    const entry = { chassisId: "fighter" as const, specialistSchool: null, xp: 5_000_000, hpRolls: [] as number[], dualClassState: null, level: 1 };
    expect(deriveClassLevels([entry])[0]!.level).toBeGreaterThan(15);
    expect(deriveClassLevels([{ ...entry, levelLimit: 15, beyondMultiplier: 0 }])[0]).toMatchObject({ level: 15, canLevelUp: true });
    expect(deriveClassLevels([{ ...entry, xp: 2_250_000, levelLimit: 15, beyondMultiplier: 2 }])[0]!.level).toBe(16);
    expect(deriveClassLevels([{ ...entry, hpRolls: new Array(15).fill(5), levelLimit: 15, beyondMultiplier: 0 }])[0]!.canLevelUp).toBe(false);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/derive`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/data/derive/class-item.ts`:

```ts
import { getChassis } from "../../core/classes/chassis";
import { NO_LEVEL_RULES, levelForXpWithRules, type LevelRules } from "../../core/classes/level-limits";
import { scaleChassisXp } from "../../core/kits";
import type { ClassId } from "../../core/types";

/** The class level this embedded `class` item has reached on its own XP total (a kit's/race's XP modifier percent scales the thresholds; SP13 level rules cap or re-price levels past a racial limit). */
export function classItemLevel(chassisId: ClassId, xp: number, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES): number {
  return levelForXpWithRules(scaleChassisXp(getChassis(chassisId), xpModifierPercent), xp, rules);
}

/** True when the class has advanced past the last recorded Hit-Die roll and owes one. */
export function classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES): boolean {
  return classItemLevel(chassisId, xp, xpModifierPercent, rules) > hpRollsLength;
}
```
(The previous `levelForXp` import is no longer used there; remove it.)

`src/data/derive/character/snapshot.ts` — add to `ClassEntry`:

```ts
  /** SP13: the racial level limit for this class (absent/null = unlimited) */
  levelLimit?: number | null;
  /** SP13: 0 = the limit is hard; 2-4 = each level beyond it costs that many times the XP */
  beyondMultiplier?: number;
```

`src/data/derive/character/levels.ts`:

```ts
import { levelRulesOf } from "../../../core/classes/level-limits";
...
  return classes.map((c) => {
    const rules = levelRulesOf({ levelLimit: c.levelLimit, beyondMultiplier: c.beyondMultiplier });
    const percent = c.xpModifierPercent ?? 0;
    const level = classItemLevel(c.chassisId, c.xp, percent, rules);
    return { chassisId: c.chassisId, level, canLevelUp: classItemCanLevelUp(c.chassisId, c.xp, c.hpRolls.length, percent, rules) };
  });
```

`src/data/derive/character/kits.ts` — add imports (`bonusLevels`, `NO_LEVEL_RULES`, `type LevelRules` from `"../../../core/classes/level-limits"`; `getChassis` is already imported there; `type OptionalRules` from `"../../../core/options"`; `type AbilityKey` from `"../../../core/types"`) and append:

```ts
const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/** SP13: an actor's PREPARED ability scores (post-racial) from `system.abilities`, ignoring missing/non-numeric entries. */
export function abilityScoresOf(
  system: { abilities?: Record<string, { score?: unknown } | undefined> } | null | undefined,
): Partial<Record<AbilityKey, number>> {
  const out: Partial<Record<AbilityKey, number>> = {};
  for (const k of ABILITY_KEYS) {
    const score = system?.abilities?.[k]?.score;
    if (typeof score === "number") out[k] = score;
  }
  return out;
}

/**
 * SP13: the XP-per-level percentage AND the racial level rules for a class. The limit is the first race item's
 * `classLevelLimits[chassisId]` (missing/null = unlimited); with the bonus-levels option on and exactly one class,
 * the limit grows by `bonusLevels(lowest prime requisite score)`. The single helper behind every level lookup.
 */
export function actorLevelRulesFor(
  items: Iterable<ItemLike>,
  chassisId: string,
  options: OptionalRules,
  scores: Partial<Record<AbilityKey, number>> = {},
): { xpPercent: number; rules: LevelRules } {
  const all = [...items];
  const xpPercent = actorXpPercentFor(all, chassisId);
  if (!options.racialLevelLimits) return { xpPercent, rules: NO_LEVEL_RULES };
  const race = all.find((i) => i.type === "race");
  const raw = (race?.system as { classLevelLimits?: Record<string, unknown> } | undefined)?.classLevelLimits?.[chassisId];
  const base = typeof raw === "number" ? raw : null;
  let limit = base;
  if (base !== null && options.primeRequisiteBonusLevels && all.filter((i) => i.type === "class").length === 1) {
    const prime = getChassis(chassisId as ClassId).primeRequisites.map((k) => scores[k]);
    if (prime.length > 0 && prime.every((s): s is number => typeof s === "number")) limit = base + bonusLevels(Math.min(...prime));
  }
  return { xpPercent, rules: { limit, beyondMultiplier: options.exceedLevelLimits } };
}
```
(import `type ClassId` too if not present.)

`src/data/actor/snapshot.ts` — change the signature to `export function snapshotActor(actor: Actor.Implementation, options: OptionalRules = getOptionalRules()): ActorSnapshot` (import `getOptionalRules` from `"../../settings"` and `type OptionalRules` from `"../../core/options"`; `abilityScoresOf`, `actorLevelRulesFor` from the kits module). In the `classes` map replace the `racePercent`/`combineXpPercent` line with:

```ts
      const lr = actorLevelRulesFor(items, s.chassisId, options, abilityScoresOf(doc.system));
      return {
        ...
        xpModifierPercent: lr.xpPercent,
        levelLimit: lr.rules.limit,
        beyondMultiplier: lr.rules.beyondMultiplier,
        castingDisabled: ...,
      };
```
and remove now-unused imports/variables (`racePercent`, `normalizeSubrace` if unused elsewhere in the file, `combineXpPercent`, `kitXpPercentFor` if unused). `doc.system` already has `abilities: Record<string, { score: number; ... }>` which satisfies `abilityScoresOf`'s parameter. `src/data/actor/base-actor.ts` `deriveAndCache`: `const options = getOptionalRules(); const derived = deriveCharacter(snapshotActor(parent, options), options);`.

- [ ] **Step 4: Run to verify they pass, plus the CI-style checks**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS (the existing level-threshold tests pass unchanged).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(classes): class levels honor racial level limits via actorLevelRulesFor and the snapshot

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Every level lookup, the sheet and the class row

**Files:**
- Modify: `src/data/item/class.ts`, `src/sheets/character/{xp.ts,context.ts,context-types.ts,sheet.ts,combat-rolls.ts,proficiency-actions.ts,spell-actions.ts}`, `src/sheets/npc/sheet.ts`, `templates/actor/pc/partials/pc-class-row.hbs`, `README.md`
- Test: `tests/sheets/character/xp.test.ts`, `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2 exports.
- Produces: `xpToNext(chassisId, xp, xpModifierPercent = 0, rules = NO_LEVEL_RULES)` returning `XpProgress` with `atLimit: boolean`; `ClassItemView.levelLimit?: number | null`, `ClassItemView.beyondMultiplier?: number`; `ClassRow.atLimit: boolean`.

- [ ] **Step 1: Write the failing tests.**

In `tests/sheets/character/xp.test.ts` (the existing `xpToNext` expectations gain `atLimit: false` where they `toEqual` whole results) add:

```ts
  it("honors level rules and reports atLimit (SP13)", () => {
    expect(xpToNext("fighter", 2_000_000, 0, { limit: 15, beyondMultiplier: 0 })).toEqual({ level: 15, next: null, toNextLevel: null, pct: 1, atLimit: true });
    expect(xpToNext("fighter", 2_000_000, 0, { limit: 15, beyondMultiplier: 2 })).toMatchObject({ level: 15, next: 2_250_000, atLimit: false });
    expect(xpToNext("fighter", 8000)).toMatchObject({ level: 4, next: 16000, atLimit: false });
    // +10%: level 15 = 1,925,000, so 1,900,000 is level 14 (not capped) and 2,000,000 is level 15 (capped)
    expect(xpToNext("fighter", 1_900_000, 10, { limit: 15, beyondMultiplier: 0 }).atLimit).toBe(false);
    expect(xpToNext("fighter", 2_000_000, 10, { limit: 15, beyondMultiplier: 0 }).atLimit).toBe(true);
  });
```

In `tests/sheets/character/context.test.ts` (use the file's real input builder and class-item view fixture; copy a nearby class-row test) add:

```ts
  it("a class view with a hard level limit shows atLimit, no next threshold, and the capped bar (SP13)", () => {
    // `rowFor(view)` = the file's existing way of building a context from one class item view and returning classes[0]
    // (copy the setup from the nearest existing class-row test; the fighter view has xp 2_000_000).
    const base = { /* the existing fighter ClassItemView fixture with xp: 2_000_000 */ };
    const capped = rowFor({ ...base, levelLimit: 15, beyondMultiplier: 0 });
    expect(capped).toMatchObject({ atLimit: true, nextThreshold: null, xpPct: 1 });
    const exceeding = rowFor({ ...base, levelLimit: 15, beyondMultiplier: 2 });
    expect(exceeding).toMatchObject({ atLimit: false, nextThreshold: 2_250_000 });
    expect(rowFor(base).atLimit).toBe(false);
  });
```
The implementer fills `rowFor` and `base` from the file's real fixtures (no placeholders may remain in the committed test).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sheets`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/sheets/character/xp.ts`: import `NO_LEVEL_RULES, xpToNextWithRules, type LevelRules` from `"../../core/classes/level-limits"`; add `atLimit: boolean;` (doc: SP13: the class is at a hard racial level limit) to `XpProgress`; replace the `xpToNext` body with:

```ts
export function xpToNext(chassisId: ClassId, xp: number, xpModifierPercent = 0, rules: LevelRules = NO_LEVEL_RULES): XpProgress {
  return xpToNextWithRules(scaleChassisXp(getChassis(chassisId), xpModifierPercent), xp, rules);
}
```
(drop the now-unused imports `levelForXp`, `xpForLevel`; keep `awardXpSplit`.)

`src/sheets/character/context-types.ts`: add to `ClassItemView`: `/** SP13: the racial level limit for this class (absent/null = unlimited) */ levelLimit?: number | null; /** SP13: 0 = hard limit; 2-4 = each level beyond it costs that many times the XP */ beyondMultiplier?: number;` and to `ClassRow` (the row type with `nextThreshold`): `/** SP13: at a hard racial level limit */ atLimit: boolean;`.

`src/sheets/character/context.ts`: import `levelRulesOf` from `"../../core/classes/level-limits"`. In `buildClasses`: `const rules = levelRulesOf(c); const progress = xpToNext(c.chassisId as ClassId, c.xp, c.xpModifierPercent ?? 0, rules);` and add `atLimit: progress.atLimit,` to the returned row. At the priest-level line (~777) pass the rules: `classItemLevel(priestClass.chassisId as ClassId, priestClass.xp, priestClass.xpModifierPercent ?? 0, levelRulesOf(priestClass))`.

`templates/actor/pc/partials/pc-class-row.hbs`: after `<span class="level">L{{c.level}}</span>` add `{{#if c.atLimit}}<span class="level-limit">({{localize 'ADND2E.sheet.xp.atLimit'}})</span>{{/if}}`.

Level lookups (each currently `actorXpPercentFor(...)` + `classItemLevel(...)`; read each site and keep its logic, replacing the percent with the helper's pair and passing `rules`; import `getOptionalRules` from `"../../settings"` and `abilityScoresOf`, `actorLevelRulesFor` from `"../../data/derive/character/kits"`; the actor's scores come from its `system` — cast the actor to `{ system?: { abilities?: Record<string, { score?: unknown } | undefined> } }` where its local type lacks it):
- `src/data/item/class.ts` `prepareDerivedData`: only call the helper when an actor exists (so a compendium item with no parent never touches `game.settings`):

```ts
    const actorDoc = (this as unknown as { parent?: { parent?: { items?: Iterable<{ type: string; system: unknown }>; system?: { abilities?: Record<string, { score?: unknown } | undefined> } } } }).parent?.parent;
    const { xpPercent, rules } = actorDoc
      ? actorLevelRulesFor(actorDoc.items ?? [], sys.chassisId, getOptionalRules(), abilityScoresOf(actorDoc.system))
      : { xpPercent: 0, rules: NO_LEVEL_RULES };
    sys.level = classItemLevel(sys.chassisId, sys.xp, xpPercent, rules);
    sys.canLevelUp = classItemCanLevelUp(sys.chassisId, sys.xp, sys.hpRolls.length, xpPercent, rules);
```
- `src/sheets/character/combat-rolls.ts` `resolveThiefBackstabInfo`: `const { xpPercent, rules } = actorLevelRulesFor(actor.items, "thief", getOptionalRules(), abilityScoresOf((actor as unknown as { system?: never }).system));` then `classItemLevel("thief", s.xp ?? 0, xpPercent, rules)`.
- `src/sheets/character/proficiency-actions.ts` `primaryClassLevel` and `src/sheets/character/spell-actions.ts` (the two lookups ~lines 161 and 198): same replacement.
- `src/sheets/character/sheet.ts` class view (~line 484): replace the `xpModifierPercent: combineXpPercent(kitXpPercentFor(...), raceXpPct)` with `const lr = actorLevelRulesFor(items, view.chassisId, getOptionalRules(), abilityScoresOf(actor.system)); classItems.push({ ...view, xpModifierPercent: lr.xpPercent, levelLimit: lr.rules.limit, beyondMultiplier: lr.rules.beyondMultiplier });` (the surrounding `actor` variable is the document in `#buildInput`; remove the now-unused `raceXpPct`/`raceXpPercentOf`/`combineXpPercent`/`kitXpPercentFor` imports and the hoisted variable if they become unused).
- `src/sheets/npc/sheet.ts` (~line 232): the same `lr` replacement.

`README.md`: Sub-project 13 row: `📋 Not started` -> `✅ Complete`, rewritten to describe racial level limits (enforced from the race item's `classLevelLimits`, on by default), the optional exceed rule (x2/x3/x4 per level beyond the limit, cumulative with race and kit XP percentages) and the optional prime-requisite bonus levels (Dwarves book table, single-class); add a new row after row 20: `| **21. Humanoid player races** | 📋 Not started | The ~28 player-character humanoid races of The Complete Book of Humanoids (PHBR10): per-race ability ranges, level limits (Table 1), XP multipliers, hit-dice rules and kits; needs the closed six-value race id generalized to data-driven races |`.

- [ ] **Step 4: Run to verify they pass, plus the CI-style checks**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: PASS, 100% statements/lines/functions.

- [ ] **Step 5: Commit**

```bash
git add src tests templates README.md
git commit -m "feat(classes): every level lookup honors racial level limits; class row shows the limit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verification gates (no new feature code unless a gate fails)

- [ ] **Step 1: The full CI sequence** `npm run typecheck && npm run lint && npm run test:coverage && npm run build` (build only if Foundry is not holding the pack lock). Expected: all green, 100% statements/lines/functions.
- [ ] **Step 2: Whole-branch review** (most capable model) on `git diff master...HEAD`. Pay attention to: every former `actorXpPercentFor` level-lookup site now uses `actorLevelRulesFor` (`grep -rn "actorXpPercentFor" src` should show only the helper definitions and `actorLevelRulesFor`'s own use); `classItemLevel` call sites that pass a percent but NOT rules (they would ignore the limit); the class item's `prepareDerivedData` (no actor, compendium contexts, `game.settings` availability); the ability scores used for bonus levels are the prepared post-racial scores; `snapshotActor`'s new `options` parameter and its callers (tests, `deriveAndCache`); defaults reproduce today's behavior for characters of unlimited races (humans) and for the setting off; a character already above a limit (capped; HP rolls beyond the level); NPC path; the settings keys in `global.d.ts` and the reload flags; the choice setting registration; lang keys.
- [ ] **Step 3: Headless proof (controller; see the `foundry-headless-proof-harness` memory).** Real Foundry classes + real race data + the real `snapshotActor` -> `deriveCharacter` (settings stub returning each scenario's values): a Hill Dwarf fighter (limit 15) with huge XP derives level 15 with enforcement on and its uncapped level with it off; with exceed x2 the same character reaches 16 at exactly twice the normal gap (2,250,000 for a plain fighter); with bonus levels on and STR 18 the cap is 18; a Mountain Dwarf (16); a human fighter unlimited; a Deep Dwarf (+10% race) with x3 stacking (`1.1 x 3`); a Dwarf fighter/cleric multiclass (each class its own cap, no bonus levels); a Character-NPC-shaped actor; `classItemLevel` equals the derive's level; the `xpToNext` class-row data (`atLimit`, `nextThreshold`); the settings reader with the real descriptors.
- [ ] **Step 4: Rebuild the installed system** only if Foundry is closed (check for a running process first).
- [ ] **Step 5: Push and open the PR** (branch-finishing preference: always push + PR, never ask). PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Confirm CI is green; do NOT retry `gh pr merge`; ask the user to merge. Hand the user a manual checklist WITH PREREQUISITES AND EXACT NUMBERS (the character must have a class item): a Hill Dwarf Fighter given 2,000,000 XP shows "L15 (limit)" with no next threshold and no Level-Up (a plain Human Fighter with the same XP shows L16); with Exceeding level limits set to "Double experience" the Dwarf shows L15 with next threshold 2,250,000 and reaches L16 at 2,250,000; with "Bonus levels for high prime requisites" on and Strength 18 the cap rises to 18; turning "Racial level limits" off lifts the cap; a Dwarf Fighter/Cleric shows each class capped at its own limit (15 and 10); a Character NPC behaves the same. Settings changes need a world reload.

---

## Self-Review notes

- Spec coverage: settings and reader -> Task 1; pure rules (`bonusLevels`, `levelForXpWithRules`, `xpToNextWithRules`) -> Task 1; `actorLevelRulesFor`, `abilityScoresOf`, `classItemLevel`/`classItemCanLevelUp`, `deriveClassLevels`, snapshot and `ClassEntry` -> Task 2; every call site, `xpToNext`, the class row and README -> Task 3; tests/gates/headless proof/manual checklist -> Task 4.
- Names are consistent: `LevelRules`, `NO_LEVEL_RULES`, `levelRulesOf`, `levelForXpWithRules`, `xpToNextWithRules`, `LimitedXpProgress`, `bonusLevels`, `actorLevelRulesFor`, `abilityScoresOf`, `ClassEntry.levelLimit` / `beyondMultiplier`, `ClassItemView.levelLimit` / `beyondMultiplier`, `ClassRow.atLimit`, settings keys `racialLevelLimits` / `exceedLevelLimits` / `primeRequisiteBonusLevels`.
- Judgment points flagged for the implementers: the exact existing fixtures in the named test files, the local actor typings at each lookup site, and the `global.d.ts` augmentation shape.
