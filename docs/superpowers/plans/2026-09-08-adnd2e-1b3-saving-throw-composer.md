# AD&D 2E — Plan 1b.3: Saving-Throw Composer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the raw per-class-group saving-throw targets from Plan 1b.2 into the actual d20 target a character rolls against — layering the racial Constitution bonus (dwarf/gnome/halfling), the Wisdom magical-defense adjustment (mind-affecting magic), the Dexterity defensive adjustment (dodgeable effects + breath weapons), and a generic situational modifier — plus the elf/half-elf sleep-and-charm flat resistance.

**Architecture:** Continues Plan 1b/1b.2's framework-free `src/core/` engine (pure functions + literal lookup tables, no Foundry imports, enforced by `tsconfig.core.json` + ESLint, 100% Vitest coverage gate). New files `src/core/saves/racial.ts` and `src/core/saves/composer.ts`; `saves/index.ts` re-exports. The `Race` type moves from `abilities/racial-adjustments.ts` to `types.ts` (deferred cleanup — this plan needs `Race` and is race-adjacent).

**Tech Stack:** TypeScript 5 strict; Vitest 5 (`test:coverage` gate at 100% lines/statements on `src/core/**`); ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §4 (`core/saves/`), §5.1 (the 5 saving-throw categories, derived), §5.6 (derived-data ordering), §9 (testing), §11 (reference workflow).

**Research source:** `references/research-notes.md` (git-ignored) — section "PLAN 1b.3: SAVING-THROW COMPOSER" — Table 9 and the racial / ability-modifier rules transcribed from the user's PHB (pp.14–23, 101–102) with page citations.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, the DOM, `fvtt-types`, or any relative path outside `src/core/`. Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `typecheck` gate and the `no-restricted-globals` / `no-restricted-imports` ESLint block on `src/core/**` + `tests/core/**`.
- Core functions return **plain data** (numbers, records) — no Foundry `Roll`.
- TypeScript `strict: true`. Prettier printWidth 100, 2-space, double quotes, semi, trailing-comma all. **Do not run `npm run format`** — it reflows the aligned lookup tables. Precede any hand-aligned table with `// prettier-ignore`.
- No copyrighted prose in the repo — mechanical/factual values only. Each new file with a table carries a `// PHB Table N, p.XX` citation comment.
- `src/core/**` must stay at **100% lines / statements / functions** and **≥90% branches** coverage (`npm run test:coverage`, enforced in CI). Every task's own tests must hold that.
- Levels are integers ≥ 1; `assertLevel` from `src/core/errors.ts` already exists and is reused. Ability scores are `assertAbilityScore`-validated where a raw score enters (the CON score for Table 9).
- `ClassGroup`, `SaveCategory`, `AbilityKey` already exist in `src/core/types.ts`; `saveBaseTarget` / `SAVE_MATRICES` / `SaveBand` in `src/core/saves/`. Import, do not redefine.

## Saving-throw semantics (from `references/research-notes.md`)

- Modifiers adjust the **die roll**, not the number needed. Success = `d20 + rollModifier >= target`. `effectiveTarget = target - rollModifier` is what you need to show on the die.
- **Racial CON bonus (Table 9):** `+0` (CON ≤ 3), `+1` (4–6), `+2` (7–10), `+3` (11–13), `+4` (14–17), `+5` (CON ≥ 18). Applies to:
  - **dwarf, halfling** — categories `rsw`, `spell`, and `ppd` *when the effect is poison* (tag `"poison"`).
  - **gnome** — categories `rsw`, `spell` only (no poison).
  - **elf, half-elf, human** — never.
- **Wisdom magical-defense adjustment:** the value from `wisdom(score).magicalDefenseAdj` (already a roll bonus: WIS 15 → +1, WIS 1 → −6). Applied only when the save is against mind-affecting magic (tag `"mind-affecting"`).
- **Dexterity defensive adjustment:** the value from `dexterity(score).defensiveAdj` is AC-style (negative = agile, e.g. DEX 18 → −4). As a **save** bonus it is **negated**: DEX 18 → `+4`, DEX 3 (defensiveAdj `+4`) → `−4`. Applied when the save is against a dodgeable effect (tag `"dodgeable"`) **or** the category is `bw` (breath weapon — always dodge-based).
- **Situational modifier:** passed through as-is (PHB's −4…+4 is DM guidance, not a hard clamp).
- **Sleep / charm resistance:** elf `90`, half-elf `30`, others `0` — a percentage chance to ignore a *sleep* or *charm* effect entirely, rolled **before** any saving throw. Not a d20 modifier; a separate function.
- **Multi-class** ("use the best save of your classes") is **out of scope** — `saveTarget` takes one `group` + `level`.

---

## File Structure

**Created:**
- `src/core/saves/racial.ts` — `racialConSaveBonus`, `racialSaveBonus`, `sleepCharmResistance`.
- `src/core/saves/composer.ts` — `saveTarget()` + `SaveTargetInput` / `SaveTargetResult`.
- `tests/core/saves/racial.test.ts`, `tests/core/saves/composer.test.ts`

**Modified:**
- `src/core/types.ts` — add `Race` (moved from `racial-adjustments.ts`) and `SaveEffectTag`.
- `src/core/abilities/racial-adjustments.ts` — `import type { Race } from "../types"` + `export type { Race }` (keeps the abilities barrel re-export working); remove the local `export type Race = …` definition.
- `src/core/saves/index.ts` — re-export `./racial` and `./composer`.

---

## Task 1: Move `Race` to `types.ts`; add `SaveEffectTag`

**Files:**
- Modify: `src/core/types.ts`, `src/core/abilities/racial-adjustments.ts`

**Interfaces:**
- Produces (in `types.ts`):
  - `type Race = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling"` — **identical string union**, just relocated.
  - `type SaveEffectTag = "poison" | "mind-affecting" | "dodgeable"`
- `racial-adjustments.ts` keeps exporting `Race` (re-export) so existing importers (`abilities/index.ts`, the `export * from "./racial-adjustments"` barrel) are unaffected.

- [ ] **Step 1: Add to `src/core/types.ts`**

Place near `ClassGroup` / `AbilityKey`:

```ts
export type Race = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling";

/** Qualifiers on a saving throw that gate category-level modifiers. */
export type SaveEffectTag = "poison" | "mind-affecting" | "dodgeable";
```

- [ ] **Step 2: Update `src/core/abilities/racial-adjustments.ts`**

Replace the local definition:

```ts
export type Race = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling";
```

with a re-export of the moved type. The top of the file becomes:

```ts
// PHB Table 7 (racial ability min/max, p.20) + Table 8 (racial adjustments, p.20).
import type { AbilityKey, AbilityScores, Race } from "../types";

export type { Race };
```

(Everything else in the file — `RACIAL_ABILITY_ADJUSTMENTS`, `RACIAL_ABILITY_LIMITS`, `applyRacialDeltas`, `applyRacialAdjustments` — is unchanged; they already reference `Race`.)

- [ ] **Step 3: Typecheck + full test suite**

Run: `npm run typecheck` — both `tsc` invocations clean. (`abilities/index.ts` imports `type Race` from `./racial-adjustments`; that still resolves via the re-export. The core barrel now also exports `Race` from `./types` — no duplicate-export error because `types.ts` is the single origin and `racial-adjustments.ts` re-exports the same symbol.)
Run: `npm run lint` — clean.
Run: `npm run test:coverage` — all existing tests pass unchanged; `src/core/**` still 100%. (No behavior changed; `types.ts` adds only type declarations, which contribute no coverage.)

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/abilities/racial-adjustments.ts
git commit -m "refactor(core): move Race type to types.ts; add SaveEffectTag"
```

---

## Task 2: `racial.ts` — Table 9 CON bonus, racial save bonus, sleep/charm resistance

**Files:**
- Create: `src/core/saves/racial.ts`, `tests/core/saves/racial.test.ts`
- Modify: `src/core/saves/index.ts`

**Interfaces:**
- Consumes: `Race`, `SaveCategory`, `SaveEffectTag` (types.ts); `assertAbilityScore` (errors.ts).
- Produces:
  - `function racialConSaveBonus(con: number): number` — PHB Table 9. `assertAbilityScore(con, "con")` first. Returns `0` for CON ≤ 3, `1` (4–6), `2` (7–10), `3` (11–13), `4` (14–17), `5` (CON ≥ 18).
  - `function racialSaveBonus(race: Race, category: SaveCategory, con: number, tags?: readonly SaveEffectTag[]): number` — the racial magic/poison save bonus for this race + category. `0` for elf/half-elf/human. For dwarf/halfling: `racialConSaveBonus(con)` when `category` is `"rsw"` or `"spell"`, or when `category` is `"ppd"` and `tags` includes `"poison"`; else `0`. For gnome: `racialConSaveBonus(con)` when `category` is `"rsw"` or `"spell"`; else `0` (gnomes get no poison bonus).
  - `function sleepCharmResistance(race: Race): number` — percentage chance to ignore a sleep/charm effect entirely: `90` for elf, `30` for half-elf, `0` otherwise.

- [ ] **Step 1: Failing test** — `tests/core/saves/racial.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { racialConSaveBonus, racialSaveBonus, sleepCharmResistance } from "../../../src/core/saves/racial";
import type { Race, SaveCategory } from "../../../src/core/types";

describe("racialConSaveBonus", () => {
  it("PHB Table 9 bands", () => {
    expect(racialConSaveBonus(1)).toBe(0);
    expect(racialConSaveBonus(3)).toBe(0);
    expect(racialConSaveBonus(4)).toBe(1);
    expect(racialConSaveBonus(6)).toBe(1);
    expect(racialConSaveBonus(7)).toBe(2);
    expect(racialConSaveBonus(10)).toBe(2);
    expect(racialConSaveBonus(11)).toBe(3);
    expect(racialConSaveBonus(13)).toBe(3);
    expect(racialConSaveBonus(14)).toBe(4);
    expect(racialConSaveBonus(17)).toBe(4);
    expect(racialConSaveBonus(18)).toBe(5);
    expect(racialConSaveBonus(19)).toBe(5);
    expect(racialConSaveBonus(25)).toBe(5); // capped at the table
  });
  it("rejects invalid CON", () => {
    expect(() => racialConSaveBonus(0)).toThrow(RangeError);
    expect(() => racialConSaveBonus(12.5)).toThrow(RangeError);
  });
});

describe("racialSaveBonus", () => {
  const con = 15; // → racialConSaveBonus 4

  it("dwarf: rsw / spell / poison-tagged ppd", () => {
    expect(racialSaveBonus("dwarf", "rsw", con)).toBe(4);
    expect(racialSaveBonus("dwarf", "spell", con)).toBe(4);
    expect(racialSaveBonus("dwarf", "ppd", con, ["poison"])).toBe(4);
    expect(racialSaveBonus("dwarf", "ppd", con)).toBe(0); // ppd without the poison tag (e.g. death magic)
    expect(racialSaveBonus("dwarf", "pp", con)).toBe(0);
    expect(racialSaveBonus("dwarf", "bw", con)).toBe(0);
  });

  it("halfling: same as dwarf (incl. poison)", () => {
    expect(racialSaveBonus("halfling", "rsw", con)).toBe(4);
    expect(racialSaveBonus("halfling", "spell", con)).toBe(4);
    expect(racialSaveBonus("halfling", "ppd", con, ["poison"])).toBe(4);
    expect(racialSaveBonus("halfling", "ppd", con)).toBe(0);
  });

  it("gnome: rsw / spell only, NO poison", () => {
    expect(racialSaveBonus("gnome", "rsw", con)).toBe(4);
    expect(racialSaveBonus("gnome", "spell", con)).toBe(4);
    expect(racialSaveBonus("gnome", "ppd", con, ["poison"])).toBe(0);
    expect(racialSaveBonus("gnome", "ppd", con)).toBe(0);
  });

  it("elf / half-elf / human: nothing", () => {
    for (const race of ["elf", "half-elf", "human"] as Race[]) {
      for (const cat of ["ppd", "rsw", "pp", "bw", "spell"] as SaveCategory[]) {
        expect(racialSaveBonus(race, cat, con, ["poison"])).toBe(0);
      }
    }
  });

  it("scales with CON", () => {
    expect(racialSaveBonus("dwarf", "spell", 8)).toBe(2);
    expect(racialSaveBonus("dwarf", "spell", 3)).toBe(0);
  });
});

describe("sleepCharmResistance", () => {
  it("elf 90, half-elf 30, others 0", () => {
    expect(sleepCharmResistance("elf")).toBe(90);
    expect(sleepCharmResistance("half-elf")).toBe(30);
    expect(sleepCharmResistance("human")).toBe(0);
    expect(sleepCharmResistance("dwarf")).toBe(0);
    expect(sleepCharmResistance("gnome")).toBe(0);
    expect(sleepCharmResistance("halfling")).toBe(0);
  });
});
```

- [ ] **Step 2: Run — FAIL.**  `npm run test -- tests/core/saves/racial.test.ts`

- [ ] **Step 3: Implement** — `src/core/saves/racial.ts`

```ts
// PHB Table 9: CONSTITUTION SAVING THROW BONUSES (p.21) + racial magic/poison save
// rules from the Dwarf (p.21), Gnome (p.22), Halfling (p.23), Elf (p.21),
// Half-Elf (p.22) descriptions.
import { assertAbilityScore } from "../errors";
import type { Race, SaveCategory, SaveEffectTag } from "../types";

/** PHB Table 9. [upper bound of CON band, bonus]; last entry catches CON >= 18. */
const CON_SAVE_BANDS: ReadonlyArray<readonly [number, number]> = [
  [3, 0],
  [6, 1],
  [10, 2],
  [13, 3],
  [17, 4],
  [Infinity, 5],
];

export function racialConSaveBonus(con: number): number {
  assertAbilityScore(con, "con");
  return CON_SAVE_BANDS.find(([max]) => con <= max)![1];
}

// Categories that get the racial CON bonus, by race.
// "poison" here means "ppd only when the effect is poison-tagged".
const RACIAL_SAVE_CATEGORIES: Record<Race, ReadonlySet<SaveCategory | "poison">> = {
  dwarf: new Set(["rsw", "spell", "poison"]),
  halfling: new Set(["rsw", "spell", "poison"]),
  gnome: new Set(["rsw", "spell"]),
  elf: new Set(),
  "half-elf": new Set(),
  human: new Set(),
};

export function racialSaveBonus(
  race: Race,
  category: SaveCategory,
  con: number,
  tags: readonly SaveEffectTag[] = [],
): number {
  const applicable = RACIAL_SAVE_CATEGORIES[race];
  const matches =
    applicable.has(category) || (category === "ppd" && tags.includes("poison") && applicable.has("poison"));
  return matches ? racialConSaveBonus(con) : 0;
}

export function sleepCharmResistance(race: Race): number {
  if (race === "elf") return 90;
  if (race === "half-elf") return 30;
  return 0;
}
```

- [ ] **Step 4: Update `src/core/saves/index.ts`**

Add:

```ts
export * from "./racial";
```

- [ ] **Step 5: Run — PASS.**  `npm run test -- tests/core/saves/racial.test.ts`

- [ ] **Step 6: Gates** — `npm run typecheck && npm run lint && npm run test:coverage` → clean, `src/core/**` 100%. (`CON_SAVE_BANDS.find(...)!` — the `Infinity` entry guarantees a match, so the non-null assertion is sound; the `find` predicate's true and false paths are both hit by the Table-9 test. `racialSaveBonus`'s `||` short-circuit branches and the `matches ? … : 0` both sides are covered by the dwarf/gnome/elf cases. `sleepCharmResistance`'s three returns all covered.)

- [ ] **Step 7: Commit**

```bash
git add src/core/saves/racial.ts src/core/saves/index.ts tests/core/saves/racial.test.ts
git commit -m "feat(core): racial saving-throw bonuses — PHB Table 9 + sleep/charm resistance"
```

---

## Task 3: `composer.ts` — `saveTarget()`

**Files:**
- Create: `src/core/saves/composer.ts`, `tests/core/saves/composer.test.ts`
- Modify: `src/core/saves/index.ts`

**Interfaces:**
- Consumes: `ClassGroup`, `SaveCategory`, `Race`, `SaveEffectTag` (types.ts); `saveBaseTarget` (saves/index.ts, from Plan 1b.2); `racialSaveBonus` (Task 2); `assertLevel` (errors.ts).
- Produces:
  - `interface SaveTargetInput { group: ClassGroup; level: number; category: SaveCategory; race: Race; con: number; wisMagicalDefenseAdj: number; dexDefensiveAdj: number; tags?: readonly SaveEffectTag[]; situationalModifier?: number }`
    - `con` — the character's **adjusted** CON score (post racial adjustment), used only for the Table 9 lookup.
    - `wisMagicalDefenseAdj` — pass `wisdom(wis).magicalDefenseAdj` (already a roll bonus).
    - `dexDefensiveAdj` — pass `dexterity(dex).defensiveAdj` (AC-style; the composer negates it for the save).
  - `interface SaveTargetResult { target: number; rollModifier: number; effectiveTarget: number; breakdown: { base: number; racialConBonus: number; wisdomMagicalDefense: number; dexterityDefensive: number; situational: number } }`
  - `function saveTarget(input: SaveTargetInput): SaveTargetResult`
    - `target` = `saveBaseTarget(group, level, category)` (also `breakdown.base`).
    - `breakdown.racialConBonus` = `racialSaveBonus(race, category, con, tags)`.
    - `breakdown.wisdomMagicalDefense` = `tags` includes `"mind-affecting"` ? `wisMagicalDefenseAdj` : `0`.
    - `breakdown.dexterityDefensive` = (`tags` includes `"dodgeable"` **or** `category === "bw"`) ? `-dexDefensiveAdj` : `0`.
    - `breakdown.situational` = `situationalModifier ?? 0`.
    - `rollModifier` = sum of the four breakdown modifiers.
    - `effectiveTarget` = `target - rollModifier`.
    - Success rule (documented in a JSDoc): a save succeeds when `d20Roll + rollModifier >= target`.

- [ ] **Step 1: Failing test** — `tests/core/saves/composer.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { saveTarget } from "../../../src/core/saves/composer";
import { saveBaseTarget } from "../../../src/core/saves";

describe("saveTarget()", () => {
  const base = {
    group: "wizard" as const,
    level: 5,
    race: "human" as const,
    con: 12,
    wisMagicalDefenseAdj: 0,
    dexDefensiveAdj: 0,
  };

  it("no modifiers: target == saveBaseTarget, rollModifier 0", () => {
    const r = saveTarget({ ...base, category: "spell" });
    expect(r.target).toBe(saveBaseTarget("wizard", 5, "spell")); // 12
    expect(r.rollModifier).toBe(0);
    expect(r.effectiveTarget).toBe(r.target);
    expect(r.breakdown).toEqual({
      base: 12, racialConBonus: 0, wisdomMagicalDefense: 0, dexterityDefensive: 0, situational: 0,
    });
  });

  it("Wisdom magical defense: only when mind-affecting", () => {
    const withWis = { ...base, wisMagicalDefenseAdj: 3 };
    expect(saveTarget({ ...withWis, category: "spell" }).breakdown.wisdomMagicalDefense).toBe(0);
    const r = saveTarget({ ...withWis, category: "spell", tags: ["mind-affecting"] });
    expect(r.breakdown.wisdomMagicalDefense).toBe(3);
    expect(r.rollModifier).toBe(3);
    expect(r.effectiveTarget).toBe(r.target - 3);
  });

  it("Dexterity defensive: negated; applies to bw always, and to dodgeable-tagged", () => {
    // DEX 18 -> defensiveAdj -4 -> save bonus +4
    const agile = { ...base, dexDefensiveAdj: -4 };
    expect(saveTarget({ ...agile, category: "bw" }).breakdown.dexterityDefensive).toBe(4);
    expect(saveTarget({ ...agile, category: "spell" }).breakdown.dexterityDefensive).toBe(0);
    expect(saveTarget({ ...agile, category: "spell", tags: ["dodgeable"] }).breakdown.dexterityDefensive).toBe(4);
    // clumsy: DEX 3 -> defensiveAdj +4 -> save PENALTY -4
    expect(saveTarget({ ...base, dexDefensiveAdj: 4, category: "bw" }).breakdown.dexterityDefensive).toBe(-4);
  });

  it("racial CON bonus flows through (dwarf vs spell)", () => {
    const r = saveTarget({
      group: "warrior", level: 3, category: "spell", race: "dwarf", con: 15,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(r.breakdown.racialConBonus).toBe(4); // Table 9: CON 15 -> +4
    expect(r.breakdown.base).toBe(saveBaseTarget("warrior", 3, "spell"));
    expect(r.rollModifier).toBe(4);
  });

  it("situational modifier passes through unclamped, and modifiers stack", () => {
    const r = saveTarget({
      group: "priest", level: 10, category: "ppd", race: "halfling", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0, tags: ["poison"], situationalModifier: -6,
    });
    // base ppd for priest L10 = 6; racial (halfling, ppd+poison, CON 16) = +4; situational -6
    expect(r.breakdown).toEqual({
      base: 6, racialConBonus: 4, wisdomMagicalDefense: 0, dexterityDefensive: 0, situational: -6,
    });
    expect(r.rollModifier).toBe(-2);
    expect(r.target).toBe(6);
    expect(r.effectiveTarget).toBe(8);
  });

  it("everything at once", () => {
    const r = saveTarget({
      group: "wizard", level: 12, category: "spell", race: "gnome", con: 18,
      wisMagicalDefenseAdj: 2, dexDefensiveAdj: -2,
      tags: ["mind-affecting", "dodgeable"], situationalModifier: 1,
    });
    // base wizard L12 spell = 8; gnome spell CON18 = +5; wis mind = +2; dex dodgeable = +2; situational +1
    expect(r.breakdown).toEqual({
      base: 8, racialConBonus: 5, wisdomMagicalDefense: 2, dexterityDefensive: 2, situational: 1,
    });
    expect(r.rollModifier).toBe(10);
    expect(r.effectiveTarget).toBe(-2);
  });

  it("rejects invalid level (via saveBaseTarget)", () => {
    expect(() => saveTarget({ ...base, level: 0, category: "spell" })).toThrow(RangeError);
  });
});
```

> Verify the base values used above against Plan 1b.2's `SAVE_MATRICES`: wizard L5 spell → band `minLevel 1` → `12`; warrior L3 spell → band `minLevel 3` → `16`; priest L10 ppd → band `minLevel 10` → `6`; wizard L12 spell → band `minLevel 11` → `8`. (If any differs, the test's expected `base` is wrong — fix the test, not the code.)

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/saves/composer.ts`

```ts
// Layers the racial / ability / situational modifiers onto the raw class-group
// saving-throw target from Plan 1b.2. See references/research-notes.md §"PLAN 1b.3".
import type { ClassGroup, Race, SaveCategory, SaveEffectTag } from "../types";
import { saveBaseTarget } from "./index";
import { racialSaveBonus } from "./racial";

export interface SaveTargetInput {
  group: ClassGroup;
  level: number;
  category: SaveCategory;
  race: Race;
  /** adjusted CON score (post racial adjustment) — for the Table 9 lookup */
  con: number;
  /** wisdom(wis).magicalDefenseAdj — already a roll bonus */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-style (negative = agile); negated here for the save */
  dexDefensiveAdj: number;
  tags?: readonly SaveEffectTag[];
  situationalModifier?: number;
}

export interface SaveTargetResult {
  /** raw d20 target from the class table */
  target: number;
  /** total bonus added to the d20 roll */
  rollModifier: number;
  /** target - rollModifier: what the die alone must show */
  effectiveTarget: number;
  breakdown: {
    base: number;
    racialConBonus: number;
    wisdomMagicalDefense: number;
    dexterityDefensive: number;
    situational: number;
  };
}

/**
 * The saving-throw target and its modifier breakdown. A save succeeds when
 * `d20Roll + result.rollModifier >= result.target`.
 */
export function saveTarget(input: SaveTargetInput): SaveTargetResult {
  const tags = input.tags ?? [];
  const base = saveBaseTarget(input.group, input.level, input.category);
  const racialConBonus = racialSaveBonus(input.race, input.category, input.con, tags);
  const wisdomMagicalDefense = tags.includes("mind-affecting") ? input.wisMagicalDefenseAdj : 0;
  const dexterityDefensive =
    tags.includes("dodgeable") || input.category === "bw" ? -input.dexDefensiveAdj : 0;
  const situational = input.situationalModifier ?? 0;

  const rollModifier = racialConBonus + wisdomMagicalDefense + dexterityDefensive + situational;
  return {
    target: base,
    rollModifier,
    effectiveTarget: base - rollModifier,
    breakdown: { base, racialConBonus, wisdomMagicalDefense, dexterityDefensive, situational },
  };
}
```

> `import { saveBaseTarget } from "./index"` — importing from the sibling barrel is fine and matches how `racial.ts` is re-exported. If the reviewer prefers, `from "./index"` can be `from "./index.js"`-style is **not** needed (bundler resolution). Keep `"./index"`.

- [ ] **Step 4: Update `src/core/saves/index.ts`**

Add:

```ts
export * from "./composer";
```

Final `src/core/saves/index.ts` exports: `SAVE_MATRICES`, `SaveBand`, `saveBaseTarget` (existing), `./racial` (Task 2), `./composer` (this task).

- [ ] **Step 5: Run — PASS.**  `npm run test -- tests/core/saves/composer.test.ts`

- [ ] **Step 6: Full gate** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0, `src/core/**` 100% lines/statements. (Branches: `tags.includes` guards, the `|| category === "bw"` short-circuit, and `?? 0` / `?? []` each have both paths hit by the test cases above.)

- [ ] **Step 7: Commit**

```bash
git add src/core/saves/composer.ts src/core/saves/index.ts tests/core/saves/composer.test.ts
git commit -m "feat(core): saveTarget() — racial/Wisdom/Dexterity/situational save composer"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §4 `core/saves/` — composer over the raw matrices | Tasks 2–3 |
| §5.1 the 5 saving-throw categories with their modifiers (racial, ability, situational) | Task 3 |
| §5.6 the `saves` derived-data step consumes racial CON + WIS + DEX | Tasks 2–3 supply the pure functions the DataModel will call |
| §9 Vitest, every Table 9 band asserted, 100% core coverage in CI | all tasks |
| §11 values transcribed from `references/` with citations | `racial.ts` header comment |
| Deferred `Race` → `types.ts` cleanup (from the 1b/1b.2 final reviews) | Task 1 |

Out of scope for Plan 1b.3 (later plans): multi-class "best save" resolution; the level-0 warrior save band (NPC plan); per-item / per-spell save modifiers beyond the generic `situationalModifier`; wiring `saveTarget` into the Foundry `data/` layer (1c); attack resolution, damage, spell slots (1b.4/1b.5).

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Table 9 values are literal in the implementation and independently restated in the test. The base-target values used in `composer.test.ts` are annotated with which `SAVE_MATRICES` band they come from and a "fix the test not the code" note.

**3. Type consistency:**
- `Race` — one origin (`types.ts` after Task 1), re-exported by `racial-adjustments.ts`; the string union is byte-identical to the old one, so no existing `race: "dwarf"` literal breaks.
- `SaveEffectTag` (`"poison" | "mind-affecting" | "dodgeable"`) — defined once in `types.ts` (Task 1), imported by `racial.ts` and `composer.ts`.
- `SaveCategory` (`"ppd" | "rsw" | "pp" | "bw" | "spell"`) — from `types.ts` (Plan 1b.2), used unchanged.
- `saveBaseTarget(group, level, category)` — the 1b.2 signature, called by `composer.ts` exactly as its tests call it.
- `racialSaveBonus(race, category, con, tags?)` — 4 params, `tags` optional defaulting to `[]`; identical between the Task 2 interface block, the implementation, and both test files (Task 2 direct, Task 3 via the composer).
- `SaveTargetResult.breakdown` keys (`base`, `racialConBonus`, `wisdomMagicalDefense`, `dexterityDefensive`, `situational`) — identical in the interface, the implementation's returned object, and every `toEqual` in `composer.test.ts`.

**4. Coverage:** `racial.ts` — `racialConSaveBonus` (`find` predicate both branches via the 12 Table-9 assertions + the `assertAbilityScore` throw), `racialSaveBonus` (`||` and ternary both sides via dwarf/gnome/elf), `sleepCharmResistance` (3 returns). `composer.ts` — every `tags.includes(...)` guard, the `|| category === "bw"` short-circuit, `?? 0` / `?? []` — all have both paths in `composer.test.ts`. `types.ts` additions are type-only (no runtime, no coverage). No `/* v8 ignore */`.

**5. `dexDefensiveAdj` sign — the one subtle point.** `dexterity(score).defensiveAdj` returns the AC-style value (DEX 18 → −4, DEX 3 → +4). For a save, a nimble character is *better off*, so the save roll bonus is `-defensiveAdj` (DEX 18 → +4, DEX 3 → −4). `composer.ts` negates it exactly once, and `composer.test.ts` checks both the agile (`-4` in → `+4` out) and clumsy (`+4` in → `-4` out) directions. This matches `references/research-notes.md` §"PLAN 1b.3" ("NOTE THE SIGN").

No issues requiring rework.
