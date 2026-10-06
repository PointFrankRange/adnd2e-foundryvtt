# Sub-project 15 Plan A: Psionics Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Psionicist class, a PSP pool with Table 5/4/6 rules, the `power` item type with 23 starter powers, the learning rules, the power check (full/half cost, natural 1/20), maintained powers, and a Psionics tab that exists only for a psionicist.

**Architecture:** Pure Foundry-free `src/core/psionics/` holds every table and rule. A new `psionicist` class chassis (new `ClassGroup` `"psionicist"` for Table 8 saves; THAC0 as a rogue) plugs into the existing class machinery. A `power` item type plus a `system.psionics` actor block (current PSPs, maintained list, derived max/table row) feed a Psionics tab gated on owning the class. Rolls and writes follow the kit-power precedent (`src/sheets/character/kit-power-actions.ts`).

**Tech Stack:** TypeScript, Foundry v14 DataModels/ApplicationV2, Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-adnd2e-sp15-psionics-design.md`. Source: *The Complete Psionics Handbook* (PHBR5) Tables 1-10 and the "Summary of Powers" (book pp.125-127); the tables below were read from the page images, not the OCR text.

## Rulings that refine the spec (recorded here, binding for this plan)

1. **Maintenance is paid per power, one unit at a time.** Each maintained power has a "Pay maintenance" button charging one unit (its `maintenanceCost`, in its own unit: round, turn or hour) plus a "Pay all" button; a power whose cost cannot be paid ends. This replaces the spec's "advance maintenance by time" (no clock coupling, no fractional bookkeeping). Rest is refused while any power is maintained (book: no recovery in an hour spent maintaining).
2. **The current PSP total is `null` until first spent**, meaning "full" (the effective value is `psp ?? max`). No initialization step and no stale zero when a character first gets the class.
3. **Defense modes** are powers of kind `"defense"` (Telepathy chapter): limited by Table 4's "Def. Modes" column and never counted toward discipline, science or devotion totals.
4. **Relearning** (raising a power's score by 1) spends one slot of the same kind from the Table 4 budget (`known + relearns <= table total`).
5. **Out of scope (issues, not this plan):** the +2 save vs enchantment/charm, Table 9 armor penalties to power scores (the optional rule), training time, the Psionicist nonweapon-proficiency group (Plan D), psionic combat (Plan C), the other ~80 powers (Plan B).

## Global Constraints

- **Every implementer runs `npm run typecheck` (both tsc passes, including the Foundry-free `tsconfig.core.json`), `npm run lint` and the task's tests before reporting; the controller runs `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR.** If `npm run build` fails with a LevelDB LOCK error (Foundry open), do NOT kill Foundry; say so.
- 100% statement/line/function coverage on `src/core/**` (so on `src/core/psionics/**`) and `src/data/derive/**`; Foundry glue (`src/data/item/**`, `src/data/actor/**`, `src/sheets/**`) is outside the gate but unit-tested where a seam exists.
- Source files: preserve each file's existing line endings (git normalizes; do NOT convert); all changed files valid UTF-8 (`git diff --name-only master HEAD | while read f; do iconv -f UTF-8 -t UTF-8 "$f" >/dev/null 2>&1 || echo "bad: $f"; done` prints nothing); use plain ASCII hyphens, no em dashes in new source or data.
- **No object or array literal `initial` on Foundry fields** (use `initial: () => ({})` / `() => []`); `tests/data/object-field-initial.test.ts` must keep passing.
- Every new user-visible string goes in `lang/en.json` and is asserted in `tests/lang/en-coverage.test.ts`.
- Anything psionic is invisible or inert for an actor without a `class` item whose `chassisId` is `"psionicist"`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `src/core/psionics/{tables.ts,psp.ts,check.ts,learning.ts,recovery.ts,index.ts}`; export from `src/core/index.ts`.
- Modify class machinery: `src/core/types.ts`, `src/core/classes/{chassis.ts,thac0.ts}`, `src/core/saves/tables.ts`, `src/core/proficiencies/nonweapon.ts`, `src/data/item/choices.ts`, `src/config.ts`, `src/data/derive/creature/derive.ts` (group list only), `lang/en.json`; data: `packs/classes/_source/psionicist.json` and every `packs/races/_source/*.json` race item.
- Create `src/data/item/power.ts`; modify `src/data/item/{subtypes.ts,index.ts,choices.ts}`, `system.json`; create `packs/powers/_source/*.json` (23 files).
- Modify `src/data/actor/base-actor.ts` (psionics block), `src/data/actor/snapshot.ts`, `src/data/derive/character/{snapshot.ts,derive.ts}` (derive block), new `src/data/derive/character/psionics.ts`.
- Create `src/sheets/character/psionic-actions.ts`; modify `src/sheets/character/{drop-rules.ts,sheet.ts,context.ts,context-types.ts}`, `src/sheets/npc/sheet.ts` only if the shared template requires it; create `templates/actor/pc/psionics.hbs`, `templates/actor/pc/partials/pc-psionics-panels.hbs`, `templates/chat/psionic-power-use.hbs`; modify `templates/actor/pc/tabs.hbs` if tabs are listed there; `lang/en.json`.
- Tests: `tests/core/psionics/*.test.ts` (new), plus the class, race, pack, schema, derive, sheet, lang and census tests named in each task.
- Modify `README.md` (SP15 row: Plan A complete).

---

### Task 1: Pure psionics rules

**Files:**
- Create: `src/core/psionics/tables.ts`, `psp.ts`, `check.ts`, `learning.ts`, `recovery.ts`, `index.ts`
- Modify: `src/core/index.ts` (add `export * from "./psionics";`, following that file's style)
- Test: `tests/core/psionics/psp.test.ts`, `check.test.ts`, `learning.test.ts`, `recovery.test.ts`

**Interfaces (Produces, all exported from `src/core/psionics`):**
- `type Discipline = "clairsentience" | "psychokinesis" | "psychometabolism" | "psychoportation" | "telepathy" | "metapsionics"`; `DISCIPLINES: readonly Discipline[]`
- `type PowerKind = "science" | "devotion" | "defense"`
- `interface PowerProgressionRow { disciplines: number; sciences: number; devotions: number; defenseModes: number }`; `powerProgression(level: number): PowerProgressionRow` (levels above 20 use the level-20 row; level < 1 throws via `assertLevel`)
- `abilityModifier(score: number): number` (Table 5 modifier: <=15 -> 0, 16 -> 1, 17 -> 2, >=18 -> 3); `wisdomBase(score: number): number` (<=15 -> 20, 16 -> 22, 17 -> 24, >=18 -> 26)
- `inherentPotential(wis, int, con): number`; `psionicStrength(wis, int, con, level): number`
- `powerScore(abilityScore: number, modifier: number): number`
- `type CheckResult = "success" | "minimum-success" | "failure" | "automatic-failure"`; `interface PowerCheck { result: CheckResult; success: boolean; special: boolean }`; `rollPowerCheck(roll: number, score: number): PowerCheck`; `checkCost(cost: number, success: boolean): number`
- `interface KnownPower { id: string; discipline: Discipline; kind: PowerKind; scoreBonus: number }`; `type LearnProblem = "discipline-access" | "science-limit" | "devotion-limit" | "defense-limit" | "devotion-ratio" | "primary-cap" | "no-budget"`; `type LearnResult = { ok: true } | { ok: false; reason: LearnProblem }`; `primaryDiscipline(known: readonly KnownPower[]): Discipline | null`; `canLearn(known: readonly KnownPower[], candidate: { discipline: Discipline; kind: PowerKind }, level: number): LearnResult`; `canRelearn(known: readonly KnownPower[], id: string, level: number): LearnResult`
- `type RecoveryActivity = "hard" | "light" | "rest" | "sleep"`; `recoveryPerHour(activity): number` (0, 3, 6, 12); `applyRecovery(current: number, max: number, activity: RecoveryActivity, hours: number): number`

- [ ] **Step 1: Write the failing tests.**

`tests/core/psionics/psp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { abilityModifier, inherentPotential, powerProgression, psionicStrength, wisdomBase } from "../../../src/core/psionics";

describe("Table 5 (inherent potential)", () => {
  it("modifier: <=15 none, then +1/+2/+3 capped at 18", () => {
    expect([3, 12, 15, 16, 17, 18, 19, 25].map(abilityModifier)).toEqual([0, 0, 0, 1, 2, 3, 3, 3]);
  });
  it("Wisdom base: 20/22/24/26, floor 20 and cap 26", () => {
    expect([9, 15, 16, 17, 18, 19].map(wisdomBase)).toEqual([20, 20, 22, 24, 26, 26]);
  });
  it("the book's example: Wis 17, Con 16, Int 12 has inherent potential 25", () => {
    expect(inherentPotential(17, 12, 16)).toBe(25);
  });
});

describe("psionicStrength", () => {
  it("level 1 is the inherent potential; each later level adds 10 + the Wisdom modifier (book: Wis 17 gains 12)", () => {
    expect(psionicStrength(17, 12, 16, 1)).toBe(25);
    expect(psionicStrength(17, 12, 16, 2)).toBe(37);
    expect(psionicStrength(17, 12, 16, 5)).toBe(25 + 4 * 12);
  });
  it("a Wisdom of 15 gains a flat 10 per level; levels past 20 keep adding", () => {
    expect(psionicStrength(15, 10, 11, 3)).toBe(20 + 20);
    expect(psionicStrength(18, 18, 18, 22)).toBe(26 + 3 + 3 + 21 * 13);
  });
  it("level below 1 throws", () => {
    expect(() => psionicStrength(15, 10, 10, 0)).toThrow();
  });
});

describe("Table 4 progression", () => {
  it("matches the book at every row", () => {
    const rows = Array.from({ length: 20 }, (_, i) => powerProgression(i + 1));
    expect(rows.map((r) => [r.disciplines, r.sciences, r.devotions, r.defenseModes])).toEqual([
      [1, 1, 3, 1], [2, 1, 5, 1], [2, 2, 7, 2], [2, 2, 9, 2], [2, 3, 10, 3],
      [3, 3, 11, 3], [3, 4, 12, 4], [3, 4, 13, 4], [3, 5, 14, 5], [4, 5, 15, 5],
      [4, 6, 16, 5], [4, 6, 17, 5], [4, 7, 18, 5], [5, 7, 19, 5], [5, 8, 20, 5],
      [5, 8, 21, 5], [5, 9, 22, 5], [6, 9, 23, 5], [6, 10, 24, 5], [6, 10, 25, 5],
    ]);
  });
  it("levels past 20 use the level-20 row; below 1 throws", () => {
    expect(powerProgression(27)).toEqual(powerProgression(20));
    expect(() => powerProgression(0)).toThrow();
  });
});
```

`tests/core/psionics/check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkCost, powerScore, rollPowerCheck } from "../../../src/core/psionics";

describe("powerScore", () => {
  it("is the ability score plus the modifier", () => {
    expect(powerScore(16, -3)).toBe(13);
    expect(powerScore(15, 0)).toBe(15);
  });
});

describe("rollPowerCheck", () => {
  it("at or under the score succeeds; over fails", () => {
    expect(rollPowerCheck(10, 10)).toEqual({ result: "success", success: true, special: true });
    expect(rollPowerCheck(9, 10)).toEqual({ result: "success", success: true, special: false });
    expect(rollPowerCheck(11, 10)).toEqual({ result: "failure", success: false, special: false });
  });
  it("a natural 20 always fails, even against a huge score", () => {
    expect(rollPowerCheck(20, 30)).toEqual({ result: "automatic-failure", success: false, special: false });
    expect(rollPowerCheck(20, 20).success).toBe(false);
  });
  it("a natural 1 always succeeds, even against a negative score (minimum success)", () => {
    expect(rollPowerCheck(1, -4)).toEqual({ result: "minimum-success", success: true, special: false });
    expect(rollPowerCheck(1, 0).result).toBe("minimum-success");
  });
  it("a 1 against a score of 1 or more is an ordinary success; special when the roll equals the score", () => {
    expect(rollPowerCheck(1, 5)).toEqual({ result: "success", success: true, special: false });
    expect(rollPowerCheck(1, 1)).toEqual({ result: "success", success: true, special: true });
  });
});

describe("checkCost", () => {
  it("success pays the full cost; failure pays half, rounded up", () => {
    expect(checkCost(7, true)).toBe(7);
    expect(checkCost(7, false)).toBe(4);
    expect(checkCost(8, false)).toBe(4);
    expect(checkCost(0, false)).toBe(0);
  });
});
```

`tests/core/psionics/learning.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canLearn, canRelearn, primaryDiscipline, type KnownPower } from "../../../src/core/psionics";

let n = 0;
const p = (discipline: KnownPower["discipline"], kind: KnownPower["kind"], scoreBonus = 0): KnownPower => ({ id: `p${n++}`, discipline, kind, scoreBonus });
const many = (count: number, d: KnownPower["discipline"], k: KnownPower["kind"]) => Array.from({ length: count }, () => p(d, k));

describe("primaryDiscipline", () => {
  it("is the discipline of the first science or devotion; defense modes never set it", () => {
    expect(primaryDiscipline([])).toBeNull();
    expect(primaryDiscipline([p("telepathy", "defense"), p("clairsentience", "devotion"), p("psychokinesis", "science")])).toBe("clairsentience");
  });
});

describe("canLearn", () => {
  it("level 1 starts with one science and three devotions in a single discipline (devotions first)", () => {
    let known: KnownPower[] = [];
    for (let i = 0; i < 3; i++) { expect(canLearn(known, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: true }); known = [...known, p("clairsentience", "devotion")]; }
    expect(canLearn(known, { discipline: "clairsentience", kind: "science" }, 1)).toEqual({ ok: true });
    expect(canLearn(known, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: false, reason: "devotion-limit" });
  });
  it("a science needs devotions >= 2 x (sciences + 1) in its discipline (the book's Lena example)", () => {
    // 3 sciences, 7 devotions in the primary (level 9: table 5/14, 3 disciplines)
    const known = [...many(3, "clairsentience", "science"), ...many(7, "clairsentience", "devotion")];
    expect(canLearn(known, { discipline: "clairsentience", kind: "science" }, 9)).toEqual({ ok: false, reason: "devotion-ratio" });
    const eight = [...known, p("clairsentience", "devotion")];
    expect(canLearn(eight, { discipline: "clairsentience", kind: "science" }, 9)).toEqual({ ok: true });
  });
  it("another discipline can never reach the primary's counts (Lena: at most 2 sciences or 6 devotions elsewhere)", () => {
    const known = [...many(3, "clairsentience", "science"), ...many(7, "clairsentience", "devotion")];
    const other = (k: KnownPower["kind"], c: number) => many(c, "psychokinesis", k);
    expect(canLearn([...known, ...other("science", 1)], { discipline: "psychokinesis", kind: "science" }, 9)).toEqual({ ok: false, reason: "devotion-ratio" });
    expect(canLearn([...known, ...other("devotion", 6)], { discipline: "psychokinesis", kind: "devotion" }, 12)).toEqual({ ok: false, reason: "primary-cap" });
    expect(canLearn([...known, ...other("devotion", 5)], { discipline: "psychokinesis", kind: "devotion" }, 12)).toEqual({ ok: true });
  });
  it("discipline access: a new discipline beyond the level's count is refused; defense modes use their own limit", () => {
    const known = many(3, "clairsentience", "devotion");
    expect(canLearn(known, { discipline: "psychokinesis", kind: "devotion" }, 1)).toEqual({ ok: false, reason: "discipline-access" });
    expect(canLearn(known, { discipline: "psychokinesis", kind: "devotion" }, 2)).toEqual({ ok: true });
    expect(canLearn([p("telepathy", "defense")], { discipline: "telepathy", kind: "defense" }, 1)).toEqual({ ok: false, reason: "defense-limit" });
    expect(canLearn([p("telepathy", "defense")], { discipline: "telepathy", kind: "defense" }, 3)).toEqual({ ok: true });
    expect(canLearn([], { discipline: "telepathy", kind: "defense" }, 1)).toEqual({ ok: true });
  });
  it("totals: the science limit is reported when sciences are full", () => {
    const known = [...many(1, "clairsentience", "science"), ...many(5, "clairsentience", "devotion")];
    expect(canLearn(known, { discipline: "clairsentience", kind: "science" }, 2)).toEqual({ ok: false, reason: "science-limit" });
  });
});

describe("canRelearn", () => {
  it("spends one slot of the same kind from the table budget", () => {
    const known = [...many(2, "clairsentience", "devotion")];
    known[0] = { ...known[0]!, scoreBonus: 0 };
    expect(canRelearn(known, known[0]!.id, 1)).toEqual({ ok: true }); // 2 known of 3 allowed
    const full = [...many(3, "clairsentience", "devotion")];
    expect(canRelearn(full, full[0]!.id, 1)).toEqual({ ok: false, reason: "no-budget" });
    const bonus = [p("clairsentience", "devotion", 1), p("clairsentience", "devotion"), p("clairsentience", "devotion")];
    expect(canRelearn(bonus, bonus[1]!.id, 1)).toEqual({ ok: false, reason: "no-budget" }); // 3 known + 1 relearn > 3
  });
  it("an unknown id is refused", () => {
    expect(canRelearn([], "nope", 1)).toEqual({ ok: false, reason: "no-budget" });
  });
});
```

`tests/core/psionics/recovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyRecovery, recoveryPerHour } from "../../../src/core/psionics";

describe("Table 6", () => {
  it("per-hour rates: hard exertion none, walking/riding 3, sitting/resting/reading 6, rejuvenating/sleeping 12", () => {
    expect((["hard", "light", "rest", "sleep"] as const).map(recoveryPerHour)).toEqual([0, 3, 6, 12]);
  });
  it("applyRecovery adds hours x rate, never above the maximum or below the current", () => {
    expect(applyRecovery(10, 40, "sleep", 2)).toBe(34);
    expect(applyRecovery(10, 40, "sleep", 10)).toBe(40);
    expect(applyRecovery(10, 40, "hard", 8)).toBe(10);
    expect(applyRecovery(45, 40, "rest", 1)).toBe(45);
    expect(applyRecovery(10, 40, "rest", 0)).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run tests/core/psionics`; expect FAIL (module missing).

- [ ] **Step 3: Implement.**

`src/core/psionics/tables.ts`:

```ts
/* The Complete Psionics Handbook (PHBR5) Table 4 (p.12), read from the page image. Foundry-free. */
export const DISCIPLINES = ["clairsentience", "psychokinesis", "psychometabolism", "psychoportation", "telepathy", "metapsionics"] as const;
export type Discipline = (typeof DISCIPLINES)[number];
export type PowerKind = "science" | "devotion" | "defense";

export interface PowerProgressionRow {
  disciplines: number;
  sciences: number;
  devotions: number;
  defenseModes: number;
}

// prettier-ignore
const ROWS: readonly (readonly [number, number, number, number])[] = [
  [1, 1, 3, 1], [2, 1, 5, 1], [2, 2, 7, 2], [2, 2, 9, 2], [2, 3, 10, 3],
  [3, 3, 11, 3], [3, 4, 12, 4], [3, 4, 13, 4], [3, 5, 14, 5], [4, 5, 15, 5],
  [4, 6, 16, 5], [4, 6, 17, 5], [4, 7, 18, 5], [5, 7, 19, 5], [5, 8, 20, 5],
  [5, 8, 21, 5], [5, 9, 22, 5], [6, 9, 23, 5], [6, 10, 24, 5], [6, 10, 25, 5],
];

export const PROGRESSION_ROWS = ROWS;
```

`src/core/psionics/psp.ts`:

```ts
import { assertLevel } from "../errors";
import { PROGRESSION_ROWS, type PowerProgressionRow } from "./tables";

/** Table 4 row for a level (levels above 20 reuse the level-20 row). */
export function powerProgression(level: number): PowerProgressionRow {
  assertLevel(level, "psionicist level");
  const [disciplines, sciences, devotions, defenseModes] = PROGRESSION_ROWS[Math.min(level, 20) - 1]!;
  return { disciplines, sciences, devotions, defenseModes };
}

/** Table 5 modifier (Wisdom, Intelligence and Constitution): 15 and below none, 16 +1, 17 +2, 18 and above +3. */
export function abilityModifier(score: number): number {
  if (score >= 18) return 3;
  if (score >= 17) return 2;
  if (score >= 16) return 1;
  return 0;
}

/** Table 5 base score for a Wisdom: 20 at 15 or below, then 22/24/26 (26 at 18 and above). */
export function wisdomBase(score: number): number {
  if (score >= 18) return 26;
  if (score >= 17) return 24;
  if (score >= 16) return 22;
  return 20;
}

/** The 1st-level PSP total: the Wisdom base plus the Intelligence and Constitution modifiers (p.13). */
export function inherentPotential(wis: number, int: number, con: number): number {
  return wisdomBase(wis) + abilityModifier(int) + abilityModifier(con);
}

/** Total PSPs at a level: the inherent potential, plus 10 + the Wisdom modifier for each level after the first (p.13). */
export function psionicStrength(wis: number, int: number, con: number, level: number): number {
  assertLevel(level, "psionicist level");
  return inherentPotential(wis, int, con) + (level - 1) * (10 + abilityModifier(wis));
}
```

`src/core/psionics/check.ts`:

```ts
export type CheckResult = "success" | "minimum-success" | "failure" | "automatic-failure";

export interface PowerCheck {
  result: CheckResult;
  success: boolean;
  /** the optional skill-score rule: the roll equals the power score exactly */
  special: boolean;
}

/** A power's score: the character's ability score plus the power's modifier (p.11). */
export function powerScore(abilityScore: number, modifier: number): number {
  return abilityScore + modifier;
}

/** d20 power check (p.11): at or under the score succeeds; a 20 always fails; a 1 always succeeds. */
export function rollPowerCheck(roll: number, score: number): PowerCheck {
  const special = roll === score;
  if (roll === 20) return { result: "automatic-failure", success: false, special: false };
  if (roll <= score) return { result: "success", success: true, special };
  if (roll === 1) return { result: "minimum-success", success: true, special: false };
  return { result: "failure", success: false, special: false };
}

/** PSPs paid for one use: the full cost on a success, half (rounded up) on a failure. */
export function checkCost(cost: number, success: boolean): number {
  return success ? cost : Math.ceil(cost / 2);
}
```
(Check against the tests: roll 20 vs score 20: `roll === 20` first -> automatic-failure, `special` false. Roll 1, score 1: roll <= score -> success with special true. Roll 1, score -4: falls to the minimum-success branch with special false. Roll 20, score 30: automatic-failure. Good.)

`src/core/psionics/learning.ts`:

```ts
import { powerProgression } from "./psp";
import type { Discipline, PowerKind } from "./tables";

export interface KnownPower {
  id: string;
  discipline: Discipline;
  kind: PowerKind;
  /** points added by relearning (each spends one slot of its kind) */
  scoreBonus: number;
}

export type LearnProblem =
  | "discipline-access"
  | "science-limit"
  | "devotion-limit"
  | "defense-limit"
  | "devotion-ratio"
  | "primary-cap"
  | "no-budget";

export type LearnResult = { ok: true } | { ok: false; reason: LearnProblem };

const OK: LearnResult = { ok: true };
const no = (reason: LearnProblem): LearnResult => ({ ok: false, reason });

const countOf = (known: readonly KnownPower[], discipline: Discipline, kind: PowerKind): number =>
  known.filter((k) => k.discipline === discipline && k.kind === kind).length;

const slotsUsed = (known: readonly KnownPower[], kind: PowerKind): number =>
  known.filter((k) => k.kind === kind).reduce((n, k) => n + 1 + k.scoreBonus, 0);

/** The first science or devotion learned fixes the primary discipline; defense modes never do (p.12). */
export function primaryDiscipline(known: readonly KnownPower[]): Discipline | null {
  return known.find((k) => k.kind !== "defense")?.discipline ?? null;
}

/** Checks the Table 4 totals and the two learning rules (p.12) for adding one power. A science is added only after the devotions for it exist. */
export function canLearn(known: readonly KnownPower[], candidate: { discipline: Discipline; kind: PowerKind }, level: number): LearnResult {
  const row = powerProgression(level);
  const { discipline, kind } = candidate;
  if (kind === "defense") return slotsUsed(known, "defense") + 1 > row.defenseModes ? no("defense-limit") : OK;
  const heldDisciplines = new Set(known.filter((k) => k.kind !== "defense").map((k) => k.discipline));
  if (!heldDisciplines.has(discipline) && heldDisciplines.size + 1 > row.disciplines) return no("discipline-access");
  if (kind === "science" && slotsUsed(known, "science") + 1 > row.sciences) return no("science-limit");
  if (kind === "devotion" && slotsUsed(known, "devotion") + 1 > row.devotions) return no("devotion-limit");
  if (kind === "science" && countOf(known, discipline, "devotion") < 2 * (countOf(known, discipline, "science") + 1)) return no("devotion-ratio");
  const primary = primaryDiscipline(known);
  if (primary !== null && discipline !== primary && countOf(known, discipline, kind) + 1 >= countOf(known, primary, kind)) return no("primary-cap");
  return OK;
}

/** Relearning raises one known power's score by 1 and spends one slot of its kind from the Table 4 budget. */
export function canRelearn(known: readonly KnownPower[], id: string, level: number): LearnResult {
  const power = known.find((k) => k.id === id);
  if (!power) return no("no-budget");
  const row = powerProgression(level);
  const allowed = power.kind === "science" ? row.sciences : power.kind === "devotion" ? row.devotions : row.defenseModes;
  return slotsUsed(known, power.kind) + 1 > allowed ? no("no-budget") : OK;
}
```
(Verify the Lena example in the test: primary clairsentience has 3 sciences, 7 devotions at level 9 (table: 5 sciences, 14 devotions, 3 disciplines). Adding a psychokinesis science: the ratio check fails first (0 devotions < 2) -> `devotion-ratio`, matching the test. Adding the 6th psychokinesis devotion at level 12: 5 held + 1 = 6 >= 7? 6 >= 7 is false -> OK?? The test expects `primary-cap` with 6 already known, adding a 7th: `countOf = 6`, 6 + 1 = 7 >= 7 -> primary-cap. The test builds `other("devotion", 6)` (six known) and asks to add one more, so the test is right and the book's "cannot know more than six devotions elsewhere" is satisfied (6 known is allowed; a 7th is refused). The second assertion has 5 known, adding the 6th -> 6 >= 7 false -> ok.)

`src/core/psionics/recovery.ts`:

```ts
/** Table 6 (p.14): PSPs recovered per hour by the most strenuous activity in the hour. */
export type RecoveryActivity = "hard" | "light" | "rest" | "sleep";

const PER_HOUR: Record<RecoveryActivity, number> = { hard: 0, light: 3, rest: 6, sleep: 12 };

export function recoveryPerHour(activity: RecoveryActivity): number {
  return PER_HOUR[activity];
}

/** Recovers PSPs for `hours` hours; never above the maximum, never lowers the current total. */
export function applyRecovery(current: number, max: number, activity: RecoveryActivity, hours: number): number {
  return Math.max(current, Math.min(max, current + PER_HOUR[activity] * hours));
}
```

`src/core/psionics/index.ts`: `export * from "./tables"; export * from "./psp"; export * from "./check"; export * from "./learning"; export * from "./recovery";`

- [ ] **Step 4: Run to verify they pass** — `npx vitest run tests/core/psionics && npm run typecheck && npm run lint`. Expected PASS with 100% coverage of the new files (add a test for any uncovered branch).
- [ ] **Step 5: Commit** — `git add src/core tests/core && git commit -m "feat(psionics): pure PSP, power-check, learning and recovery rules (SP15 Plan A)"` (with the Co-Authored-By trailer).

---

### Task 2: The Psionicist class, its tables and the race data

**Files:**
- Modify: `src/core/types.ts`, `src/core/classes/chassis.ts`, `src/core/classes/thac0.ts`, `src/core/saves/tables.ts`, `src/core/proficiencies/nonweapon.ts`, `src/data/item/choices.ts`, `src/config.ts`, `src/data/derive/creature/derive.ts`, `lang/en.json`
- Create: `packs/classes/_source/psionicist.json`
- Modify: every `packs/races/_source/*.json` that is a race item (28 files)
- Test: `tests/core/classes/psionicist.test.ts` (new), plus whichever existing tests pin class counts, group lists, the classes pack count, race `allowedClasses`/limits (`tests/packs/content.test.ts`, `tests/data/choices.test.ts`, `tests/core/saves/*.test.ts`, `tests/core/classes/thac0.test.ts`, `tests/lang/en-coverage.test.ts`); read each failing test and update its expectation to include the psionicist (the expectations are lists and counts; do NOT loosen any assertion).

**Interfaces:** Produces `ClassId` including `"psionicist"`; `ClassGroup` including `"psionicist"`; `PSIONICIST: ClassChassis` exported from `chassis.ts` and registered in `BY_ID`; `getChassis("psionicist")`.

- [ ] **Step 1: Write the failing test** `tests/core/classes/psionicist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PSIONICIST, getChassis } from "../../../src/core/classes/chassis";
import { thac0 } from "../../../src/core/classes/thac0";
import { levelForXp, xpForLevel } from "../../../src/core/classes/progression";
import { saveBaseTarget } from "../../../src/core/saves";

describe("Psionicist chassis (PHBR5 Table 2, 7-10)", () => {
  it("identity, requirements and proficiencies", () => {
    expect(getChassis("psionicist")).toBe(PSIONICIST);
    expect(PSIONICIST).toMatchObject({
      id: "psionicist", group: "psionicist", hitDie: 6, hpAfterNameLevel: 2, conBonusCutoffLevel: 9,
      primeRequisites: ["con", "wis"], abilityMinimums: { con: 11, int: 12, wis: 15 },
      weaponProficiencies: { initial: 2, levelsPerSlot: 5 }, nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
      nonProficiencyPenalty: -4, casterType: null, maxLevel: null, thiefSkillAccess: null,
    });
    expect(PSIONICIST.armorAllowed).toEqual(["padded", "leather", "studded leather", "hide"]);
  });
  it("Table 2 experience", () => {
    const want = [0, 2200, 4400, 8800, 16500, 30000, 55000, 100000, 200000, 400000, 600000, 800000, 1000000, 1200000, 1500000, 1800000, 2100000, 2400000, 2700000, 3000000];
    expect(want.map((_, i) => xpForLevel(PSIONICIST, i + 1))).toEqual(want);
    expect(levelForXp(PSIONICIST, 2199)).toBe(1);
    expect(levelForXp(PSIONICIST, 2200)).toBe(2);
    expect(xpForLevel(PSIONICIST, 21)).toBe(3_300_000);
  });
  it("Table 7 THAC0 is the rogue rate", () => {
    const want = [20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11];
    expect(want.map((_, i) => thac0("psionicist", i + 1))).toEqual(want);
  });
  it("Table 8 saves (ppd, rsw, pp, bw, spell) by band", () => {
    const at = (l: number) => (["ppd", "rsw", "pp", "bw", "spell"] as const).map((c) => saveBaseTarget("psionicist", l, c));
    expect(at(1)).toEqual([13, 15, 10, 16, 15]);
    expect(at(4)).toEqual([13, 15, 10, 16, 15]);
    expect(at(5)).toEqual([12, 13, 9, 15, 14]);
    expect(at(9)).toEqual([11, 11, 8, 13, 12]);
    expect(at(13)).toEqual([10, 9, 7, 12, 11]);
    expect(at(17)).toEqual([9, 7, 6, 11, 9]);
    expect(at(21)).toEqual([8, 5, 5, 9, 7]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/core/classes/psionicist.test.ts`.

- [ ] **Step 3: Implement.**
  - `src/core/types.ts`: add `| "psionicist"` to `ClassId`; `ClassGroup = "warrior" | "wizard" | "priest" | "rogue" | "psionicist"`.
  - `chassis.ts`: add `PSIONICIST_XP` (the Table 2 array in the test, 20 values), and:

```ts
const PSIONICIST_WEAPONS = [
  "short bow", "hand crossbow", "light crossbow", "dagger", "dirk", "knife", "club", "hand axe", "throwing axe",
  "horseman's mace", "horseman's pick", "scimitar", "spear", "short sword", "war hammer",
] as const;

export const PSIONICIST: ClassChassis = {
  id: "psionicist",
  name: "Psionicist",
  group: "psionicist",
  hitDie: 6,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 9,
  primeRequisites: ["con", "wis"],
  abilityMinimums: { con: 11, int: 12, wis: 15 },
  xpThresholds: PSIONICIST_XP,
  xpPerLevelBeyond20: 300000,
  weaponProficiencies: { initial: 2, levelsPerSlot: 5 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
  nonProficiencyPenalty: -4,
  casterType: null,
  armorAllowed: ["padded", "leather", "studded leather", "hide"],
  weaponsAllowed: { names: [...PSIONICIST_WEAPONS] },
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
  maxLevel: null,
  spellStartLevel: null,
  spellProgressionId: null,
  thiefSkillAccess: null,
};
```
    and `psionicist: PSIONICIST,` in `BY_ID`. Before settling the armor/weapon names, read `src/data/item/choices.ts` and the armor/weapon name census (`tests/data/choices.test.ts`, the thief's lists) so the strings match the existing armor-type and weapon naming conventions (the DRUID and THIEF lists above show the style); a name that has no matching item type is accepted (it never matches; the SP11 backlog already notes `hide`).
  - `thac0.ts`: `RATE` gains `psionicist: [1, 2]`.
  - `saves/tables.ts`: add the `psionicist` bands (`band(1, 13, 15, 10, 16, 15), band(5, 12, 13, 9, 15, 14), band(9, 11, 11, 8, 13, 12), band(13, 10, 9, 7, 12, 11), band(17, 9, 7, 6, 11, 9), band(21, 8, 5, 5, 9, 7)`).
  - `nonweapon.ts`: the class -> groups map gains `psionicist: ["general"]` (the Psionicist group arrives in Plan D).
  - `choices.ts`: `CLASS_IDS` gains `"psionicist"`; `CLASS_GROUPS` gains `"psionicist"`. `creature/derive.ts` `CLASS_GROUPS` gains `"psionicist"`. `config.ts` `classGroups` label gains the psionicist entry (the compiler shows the exact shape); lang key `ADND2E.classGroups.psionicist` = "Psionicist" (follow the neighbouring group labels), plus a class name key if classes have lang keys (grep `ADND2E.classes`).
  - Run `npm run typecheck` and fix every exhaustiveness error it reports (these are the `Record<ClassId|ClassGroup, ...>` sites).
  - `packs/classes/_source/psionicist.json`: copy `thief.json`'s shape with `"_id": "ClsPsionicist00"` (16 characters), `"_key": "!items!ClsPsionicist00"`, `"name": "Psionicist"`, `"img": "icons/svg/aura.svg"`, `"chassisId": "psionicist"`.
  - **Race data** (all 28 files in `packs/races/_source`; edit each race item, keeping its other data): add `"psionicist"` to `allowedClasses` for human, halfling, dwarf, gnome, elf and half-elf and every subrace of those (every race item EXCEPT none: all 28 are subraces or PHB races of those six, so all 28 gain it); add `["fighter", "psionicist"]` and `["thief", "psionicist"]` to `allowedMulticlass` for the dwarf and halfling items and their subraces only (Table at book p.8; gnomes, elves and half-elves cannot multiclass psionicist); add the `classLevelLimits` entry `psionicist`: halfling items 10, gnome items 9, dwarf items 8, half-elf 7, elf items 7, human items none (unlimited). Subrace items copy their PHB race's data (the content tests assert this), so apply the same values to every subrace. Use a one-off script (not committed) that rewrites each JSON preserving formatting (check one file's indentation first) and run `git diff --stat packs/races` to confirm 28 files changed.
  - Update the pinned expectations in `tests/packs/content.test.ts` (`want.limits`, class counts), `tests/data/choices.test.ts` and any other failing census.

- [ ] **Step 4: Run** — `npx vitest run && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** — "feat(classes): the Psionicist class chassis, its saves/THAC0, and psionicist race data (SP15 Plan A)".

---

### Task 3: The `power` item type and the starter powers pack

**Files:**
- Create: `src/data/item/power.ts`, `packs/powers/_source/*.json` (23 files, generated by a one-off script)
- Modify: `src/data/item/{subtypes.ts,index.ts,choices.ts}`, `system.json`, `lang/en.json`
- Test: `tests/data/subtypes.test.ts` (count 14), `tests/config/system-json.test.ts`, `tests/packs/content.test.ts` (new `powers pack content` block), `tests/data/power-model.test.ts` (new, headless-style schema test following the nearest existing item-model test such as the kit/trait model tests), `tests/lang/en-coverage.test.ts`.

**Interfaces:** Produces item type `"power"` with `system`: `discipline`, `kind`, `abilityKey` (an `AbilityKey`), `abilityModifier` (int), `initialCost` (int >= 0), `costNote` (string, e.g. "10+" or "contact"), `maintenanceCost` (int >= 0), `maintenanceUnit` (`"none" | "round" | "turn" | "hour"`), `range`, `preparation`, `areaOfEffect` (strings), `scoreBonus` (int >= 0, the relearn increments), `description` (inherited from the base item model). Exports `POWER_DISCIPLINES`, `POWER_KINDS`, `POWER_MAINTENANCE_UNITS` from `choices.ts` (re-export `DISCIPLINES`/the kinds from `src/core/psionics`).

- [ ] **Step 1: Write the failing tests.** (a) `subtypes`: the list now has 14 entries ending `"power"` and equals `system.json` `documentTypes.Item`; (b) power-model test: the schema accepts a full power document (use the Clairvoyance data below), rejects an unknown discipline/kind/unit, defaults a blank power to `discipline: "clairsentience"`, `kind: "devotion"`, costs 0, `maintenanceUnit: "none"`, and `schema.clean` of `{}` validates; (c) the `powers` pack: 23 documents, unique names and 16-character `_id`s, every `kind` and `discipline` valid, exactly 5 `defense` powers (all telepathy), and for each non-defense discipline at least one science and at least two devotions; the data pins the table below. (d) `system-json` test: the pack list includes `powers`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.**
  - `power.ts`:

```ts
import { Adnd2eItemModel } from "./base-item";
import { ABILITY_KEYS, POWER_DISCIPLINES, POWER_KINDS, POWER_MAINTENANCE_UNITS } from "./choices";

const { StringField, NumberField } = foundry.data.fields;

/** SP15 Plan A: a psionic power (PHBR5 "Summary of Powers"). The check, cost and maintenance are automated; the effect is descriptive text. */
export class PowerItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      discipline: new StringField({ required: true, blank: false, initial: "clairsentience", choices: POWER_DISCIPLINES }),
      kind: new StringField({ required: true, blank: false, initial: "devotion", choices: POWER_KINDS }),
      abilityKey: new StringField({ required: true, blank: false, initial: "wis", choices: ABILITY_KEYS }),
      abilityModifier: new NumberField({ required: true, integer: true, initial: 0 }),
      initialCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      costNote: new StringField({ required: true, blank: true, initial: "" }),
      maintenanceCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      maintenanceUnit: new StringField({ required: true, blank: false, initial: "none", choices: POWER_MAINTENANCE_UNITS }),
      range: new StringField({ required: true, blank: true, initial: "" }),
      preparation: new StringField({ required: true, blank: true, initial: "" }),
      areaOfEffect: new StringField({ required: true, blank: true, initial: "" }),
      scoreBonus: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    };
  }
}
```
  Register it exactly as the neighbouring models are (read `src/data/item/index.ts` and `subtypes.ts`: add `"power"` to the `ItemSubtype` union and `ITEM_SUBTYPES`, update the "thirteen" comment to fourteen, and map `power: PowerItemModel`); add `"power": {}` to `system.json` `documentTypes.Item`; add the `powers` pack entry (copy the `kits` entry shape: `"name": "powers", "label": "Powers", "path": "packs/powers"`) and add `"powers"` to a `packFolders` folder (the "Classes & Races" folder is for classes; create a new folder entry `{ "name": "Psionics", "sorting": "a", "packs": ["powers"] }` beside the existing ones). Read `scripts/build-packs.mjs` to confirm it discovers packs from `system.json` or the directory; follow whatever it needs so `npm run build:packs` compiles the new pack (skip the compile and say so if Foundry holds the LevelDB lock).
  - `choices.ts`: `POWER_DISCIPLINES = DISCIPLINES`, `POWER_KINDS: readonly string[] = ["science", "devotion", "defense"]`, `POWER_MAINTENANCE_UNITS = ["none", "round", "turn", "hour"]`.
  - The 23 pack documents (each `{ _id, _key: "!items!<_id>", name, type: "power", img: "icons/svg/aura.svg", system: {...} }`; ids are 16 characters, e.g. `kPwrClairvoy0001`, built by a one-off generator script from this table). Costs, scores, ranges, preparation and areas are from the book's Summary of Powers; `kind` S = science, D = devotion, X = defense mode; maintenance "-" means none:

| Name | Disc. | Kind | Ability, mod | Cost | Maint. | Range | Prep | Area |
|---|---|---|---|---|---|---|---|---|
| Clairvoyance | clairsentience | S | wis, -4 | 7 | 4 / round | unlimited | 0 | special |
| Danger Sense | clairsentience | D | wis, -3 | 4 | 3 / turn | special | 0 | 10 yds. |
| Feel Light | clairsentience | D | wis, -3 | 7 | 5 / round | 0 | 0 | special |
| Project Force | psychokinesis | S | con, -2 | 10 | - | 200 yds. | 0 | - |
| Ballistic Attack | psychokinesis | D | con, -2 | 5 | - | 30 yds. | 0 | 1 item, 1 lb. |
| Control Body | psychokinesis | D | con, -2 | 8 | 8 / round | 80 yds. | 0 | individual |
| Complete Healing | psychometabolism | S | con, 0 | 30 | - | 0 | 24 hrs. | personal |
| Biofeedback | psychometabolism | D | con, -2 | 6 | 3 / round | 0 | 0 | personal |
| Body Equilibrium | psychometabolism | D | con, -3 | 2 | 2 / round | 0 | 0 | personal |
| Teleport | psychoportation | S | int, 0 | 10 (note "10+") | - | infinite | 0 | personal |
| Astral Projection | psychoportation | D | int, 0 | 6 | 2 / hour | - | 1 | personal |
| Dimensional Door | psychoportation | D | con, -1 | 4 | 2 / round | 50 yds. + | 0 | - |
| Psionic Blast | telepathy | S | wis, -5 | 10 | - | 20/40/60 yds. | 0 | individual |
| Ego Whip | telepathy | D | wis, -3 | 4 | - | 40/80/120 yds. | 0 | individual |
| Id Insinuation | telepathy | D | wis, -4 | 5 | - | 60/120/180 yds. | 0 | individual |
| Aura Alteration | metapsionics | S | wis, -4 | 10 | - | touch | 5 | individual |
| Psionic Sense | metapsionics | D | wis, -3 | 4 | 1 / round | 0 | 0 | 200-yd. radius |
| Martial Trance | metapsionics | D | wis, -3 | 7 | - | 0 | 1 | personal |
| Intellect Fortress | telepathy | X | wis, -3 | 4 | - | 0 | 0 | 3-yd. radius |
| Mental Barrier | telepathy | X | wis, -2 | 3 | - | 0 | 0 | personal |
| Mind Blank | telepathy | X | wis, -7 | 0 | 0 | 0 | 0 | personal |
| Thought Shield | telepathy | X | wis, -3 | 1 | - | 0 | 0 | personal |
| Tower of Iron Will | telepathy | X | wis, -2 | 6 | - | 0 | 0 | 1 yd. |

  Each description is one sentence of original plain text stating the power's effect in your own words ("Lets the user see and hear a distant place the user has visited." etc.); do NOT copy the book's text. The preparation column is in rounds/hours as printed (store the printed string, e.g. "24 hrs."). Mind Blank has cost 0 and maintenance 0 (`maintenanceUnit: "none"`).

- [ ] **Step 4: Run** — `npx vitest run && npm run typecheck && npm run lint` (and `npm run build:packs` if the pack lock allows; otherwise note that the build was skipped).
- [ ] **Step 5: Commit** — "feat(psionics): the power item type and 23 starter powers (SP15 Plan A)".

---

### Task 4: Actor psionics state and the derive block

**Files:**
- Modify: `src/data/actor/base-actor.ts`, `src/data/derive/character/{snapshot.ts,derive.ts}`, `src/data/actor/snapshot.ts`
- Create: `src/data/derive/character/psionics.ts`
- Test: `tests/data/derive/character/psionics.test.ts` (new), the derive snapshot/golden tests that enumerate derived keys, `tests/data/object-field-initial.test.ts`

**Interfaces:**
- Consumes: `psionicStrength`, `powerProgression`, `PowerProgressionRow` (Task 1); the `psionicist` class entry from `deriveClassLevels`.
- Produces: `derivePsionics(input: { classes: { chassisId: string; level: number }[]; scores: { wis: number; int: number; con: number } }): { max: number; level: number; row: PowerProgressionRow } | null` (null when there is no psionicist class entry); actor schema `system.psionics = { psp: number | null (nullable int >= 0, initial null), maintained: [{ powerId: string }] (initial `() => []`), max: int >= 0 (derived cache, initial 0), level: int >= 0 (derived cache, initial 0) }`; `deriveCharacter` returns `psionics: DerivedPsionics | null` and `deriveAndCache` writes `max` and `level` (and zero both when null).

- [ ] **Step 1: Write the failing tests** in `tests/data/derive/character/psionics.test.ts`: `derivePsionics` returns null with no psionicist; with a level-5 psionicist and Wis 17, Int 12, Con 16 returns `max` 73 (25 + 4 x 12), `level` 5 and the Table 4 level-5 row; uses the highest psionicist entry when two exist is NOT needed (one class item per chassis); a multiclass fighter/psionicist returns the psionicist level only; and extend the existing `deriveCharacter` tests with a psionicist snapshot (read how the existing derive tests build snapshots) asserting `derived.psionics.max`; a non-psionicist snapshot asserts `derived.psionics === null`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** `psionics.ts`:

```ts
import { powerProgression, psionicStrength, type PowerProgressionRow } from "../../../core/psionics";

export interface DerivedPsionics {
  max: number;
  level: number;
  row: PowerProgressionRow;
}

/** SP15: the psionic block for an actor with a psionicist class entry (null otherwise). */
export function derivePsionics(input: {
  classes: readonly { chassisId: string; level: number }[];
  scores: { wis: number; int: number; con: number };
}): DerivedPsionics | null {
  const entry = input.classes.find((c) => c.chassisId === "psionicist");
  if (!entry) return null;
  const { wis, int, con } = input.scores;
  return { max: psionicStrength(wis, int, con, entry.level), level: entry.level, row: powerProgression(entry.level) };
}
```
  In `derive.ts` call it with the derived class levels (`deriveClassLevels` output) and the PREPARED ability scores (read how `deriveCharacter` already reads the final scores for other derivations, e.g. `scores`/`abilities` in the snapshot) and add `psionics` to the derived result type; follow how `deriveSpellPoints` threads its result. In `base-actor.ts` add the schema block (read how `spellPoints` and the neighbouring blocks are declared and mirror them; use `NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null })` for `psp`, an `ArrayField` of `SchemaField({ powerId: StringField })` with `initial: () => []` for `maintained`, and plain integer `NumberField`s for `max` and `level`), add the cache write in `deriveAndCache` (`sys.psionics.max = derived.psionics?.max ?? 0; sys.psionics.level = derived.psionics?.level ?? 0`) and extend the typed system shim there. Existing characters have no `psionics` data: the schema's initials supply it (no migration; verify with `schema.clean` in the test).
- [ ] **Step 4: Run** — `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage` (100% on `src/data/derive/**`).
- [ ] **Step 5: Commit** — "feat(psionics): actor PSP state and the derived psionics block (SP15 Plan A)".

---

### Task 5: Actions (use, relearn, rest, maintenance) and the drop rule

**Files:**
- Create: `src/sheets/character/psionic-actions.ts`, `templates/chat/psionic-power-use.hbs`, `tests/sheets/character/psionic-actions.test.ts`
- Modify: `src/sheets/character/drop-rules.ts`, `tests/sheets/character/drop-rules.test.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`; `tsconfig.core.json` `exclude` gets `tests/sheets/character/psionic-actions.test.ts` ONLY IF the test imports Foundry globals (see the SP11 Plan B precedent: `kit-power-actions.test.ts` is excluded for that reason; run `npm run typecheck` to find out).

**Interfaces:**
- Consumes: Task 1 (`rollPowerCheck`, `checkCost`, `powerScore`, `applyRecovery`, `canLearn`, `canRelearn`, `primaryDiscipline`), Task 3 (`power` items), Task 4 (`system.psionics`).
- Produces (all exported from `psionic-actions.ts`): `interface PsionicActor` (name, img, items with `{ id, name, type, system, update?, delete? }`, `system: { abilities, psionics, classes }`, `update(data)`); `currentPsp(actor): number` (`psp ?? max`, clamped to max); `usePower(actor, powerId, roll?: () => Promise<number>)`; `relearnPower(actor, powerId)`; `rest(actor, activity, hours)`; `payMaintenance(actor, powerId | null)` (null = all); `endPower(actor, powerId)`. And in `drop-rules.ts`: `checkPowerDrop(actor, item)` returning `{ ok: true } | { ok: false; messageKey: string }` using `canLearn`.

- [ ] **Step 1: Write the failing tests** (pure-ish, with a fake actor like `kit-power-actions.test.ts` does; read it and `drop-rules.test.ts` for the fake shapes, and stub `ChatMessage`, `ui`, `game.i18n`, `foundry.applications.handlebars.renderTemplate` the same way). Cases, each asserting exact numbers:
  - `usePower` with PSP 20, a power score 10 (Wis 14 -4), cost 7: a roll of 10 pays 7 (PSP 13), posts one chat message whose rendered context says success; a roll of 11 pays 4 (PSP 16); a roll of 20 pays 4 and is "automatic failure"; a roll of 1 against a negative score pays the full 7; refused (toast, no roll, no write, no chat message) when PSP is below the full cost? RULING: refuse only when the pool is below the **full** cost (so a failure's half cost can never overdraw); a power used with a maintenance cost and a success adds `{ powerId }` to `maintained` (once); a non-psionicist actor is refused.
  - `relearnPower` increments the power item's `scoreBonus` by 1 when `canRelearn` allows; refuses (toast) otherwise.
  - `rest`: refused with a toast when `maintained` is non-empty; otherwise `psp` becomes `applyRecovery(current, max, activity, hours)` (e.g. PSP 10, max 40, sleep, 2 hours -> 34).
  - `payMaintenance(actor, id)`: deducts `maintenanceCost` once; when the pool is below the cost the power is removed from `maintained` and a toast says it ended; `payMaintenance(actor, null)` charges every maintained power in list order and ends those it cannot pay.
  - `endPower` removes the entry.
  - `checkPowerDrop`: refuses on an actor with no psionicist class (message key `ADND2E.sheet.psionics.noClass`); refuses with the `canLearn` reason mapped to `ADND2E.sheet.psionics.learn.<reason>`; allows a legal drop; allows re-dropping nothing special for non-power items (returns ok for any other item type).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** `psionic-actions.ts` follows `kit-power-actions.ts` exactly in structure (actor interface, `TEMPLATE_PATH("chat/psionic-power-use.hbs")`, `ChatMessage.create` with `ChatMessage.getSpeaker`). The d20 roll: reuse the roll helper the codebase already uses for a plain d20 (read `proficiency-actions.ts` / `turning-actions.ts` for how they evaluate `1d20` and read `.total`; accept an injectable `roll` argument defaulting to that helper so tests pass a fixed number). The power's score is `powerScore(actor.system.abilities[power.abilityKey].score, power.abilityModifier + power.scoreBonus)`. Writes: `actor.update({ "system.psionics.psp": next })`, and for `maintained` add/remove build the whole new array (`actor.update({ "system.psionics.maintained": [...] })`). `usePower` order: validate class and pool (full cost) -> roll -> pay `checkCost` -> update PSP and maintained -> chat. The chat template `psionic-power-use.hbs`:

```hbs
<div class="adnd2e chat-card psionic-power-use">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} - {{powerName}}</h3>
  </header>
  <p class="check"><strong>{{localize 'ADND2E.chat.psionic.roll'}}:</strong> {{roll}} / {{score}} - {{localize resultKey}}</p>
  {{#if special}}<p class="hint">{{localize 'ADND2E.chat.psionic.special'}}</p>{{/if}}
  <p class="cost">{{localize 'ADND2E.chat.psionic.cost'}}: {{cost}} - {{localize 'ADND2E.chat.psionic.remaining'}}: {{remaining}} / {{max}}</p>
</div>
```
  (`resultKey` is `ADND2E.chat.psionic.result.<success|minimum-success|failure|automatic-failure>`.) Lang keys to add and assert: `ADND2E.chat.psionic.{roll,special,cost,remaining}`, the four `result.*`, `ADND2E.sheet.psionics.{noClass,notEnoughPsp,restBlocked,maintenanceEnded,relearned}` and `ADND2E.sheet.psionics.learn.{discipline-access,science-limit,devotion-limit,defense-limit,devotion-ratio,primary-cap,no-budget}` (short plain sentences). `drop-rules.ts`: read how the kit-qualification drop check is structured (a pure function returning a result plus a message key; `sheet.ts` shows the toast) and add `checkPowerDrop` the same way, building `KnownPower[]` from the actor's owned `power` items (`{ id, discipline, kind, scoreBonus }`).
- [ ] **Step 4: Run** — `npx vitest run && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** — "feat(psionics): power checks, relearning, rest, maintenance and the power drop rule (SP15 Plan A)".

---

### Task 6: The Psionics tab

**Files:**
- Create: `templates/actor/pc/psionics.hbs`, `templates/actor/pc/partials/pc-psionics-panels.hbs`
- Modify: `src/sheets/character/{sheet.ts,context.ts,context-types.ts}`, `templates/actor/pc/tabs.hbs` (if tabs are enumerated there), `src/sheets/npc/sheet.ts` (only if the shared template requires it), `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/sheets/character/context.test.ts`, `tests/templates/pc-sheet-bindings.test.ts`, `README.md`.

**Interfaces:**
- Consumes: Tasks 1, 4 and 5.
- Produces: `PsionicsView | null` on the sheet context: `{ psp, max, level, row, activities: ["hard","light","rest","sleep"], maintained: [{ powerId, name, cost, unit }], groups: [{ discipline, powers: [{ id, name, kind, score, cost, costNote, maintenance, unit, range, scoreBonus }] }], defense: [...], problems: string[] }` built by `buildPsionicsView(input)` in `context.ts`; `null` when the actor has no psionicist class (so the tab and the panel are not rendered). Sheet actions `usePsionicPower`, `relearnPsionicPower`, `psionicRest`, `payPsionicMaintenance`, `endPsionicPower` wired to Task 5.

- [ ] **Step 1: Write the failing tests.** `context.test.ts`: `buildPsionicsView` returns null without the class; with a psionicist (level 5, Wis 17 Con 16 Int 12 and three owned powers) it returns `psp` = `max` (73) when the stored `psp` is null, `psp` = the stored value when set (clamped to max), the powers grouped by discipline with each `score` equal to `abilityScore + abilityModifier + scoreBonus`, defense modes listed separately, and `maintained` entries joined to their power names; the tab list contains the psionics tab only when the view is non-null. Bindings test (follow the existing `pc-sheet-bindings.test.ts` approach for every `data-action` and `name=` in the new templates: each action name exists in the sheet's `DEFAULT_OPTIONS.actions`).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Read how an existing tab is declared (`TABS` in `sheet.ts` around line 372, `PARTS`, `tabs.hbs`) and how the kits panel in `pc-feature-panels.hbs` renders a list with per-row buttons and an "add" area; add a `psionics` part and tab shown only when the view is non-null (filter the tab list in the same place other conditional tabs, such as spells for non-casters, are decided; mirror that mechanism). `psionics.hbs` renders the panel partial. The panel shows: the PSP bar (`current / max`, reusing the SP14 spell-points bar markup and classes), a rest row (a select of activities plus an hours number input and a Rest button), the maintained list with Pay and End buttons and a Pay-all button, the powers grouped by discipline (each row: name, kind, score, cost with note, maintenance `cost / unit`, range, a Use button and, when learn budget remains, a Relearn button), the defense modes, and the `problems` warnings. Use the kit theme classes already used by neighbouring panels. Powers are added by dragging a `power` item onto the sheet (Task 5's drop rule runs); the drop handler follows the existing drop path in `sheet.ts` (`_onDropItem` and `drop-rules.ts` usage; the toast mechanism for a refused kit drop is the model: a refused power drop shows the message key from `checkPowerDrop` through `game.i18n.localize`). Lang keys: `ADND2E.sheet.tabs.psionics`, `ADND2E.sheet.psionics.{title,psp,rest,hours,activity.hard,activity.light,activity.rest,activity.sleep,maintained,payMaintenance,payAll,end,use,relearn,score,cost,maintenance,primary,defense,noPowers}` (and the unit labels `ADND2E.sheet.psionics.unit.{round,turn,hour}`), each asserted in `en-coverage.test.ts`. `README.md`: SP15 row becomes `🚧 Plan A complete (foundation); Plans B-D (catalog, psionic combat, wild talents) not started` with a short description of Plan A.
- [ ] **Step 4: Run** — `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage` (100% on `context.ts`, `context-types.ts`, `xp.ts`).
- [ ] **Step 5: Commit** — "feat(psionics): the Psionics tab with PSP, powers, rest and maintenance (SP15 Plan A)".

---

### Task 7: Verification gates (no new feature code unless a gate fails)

- [ ] **Step 1: The full CI sequence** `npm run typecheck && npm run lint && npm run test:coverage && npm run build` (build only if Foundry is not holding the pack lock).
- [ ] **Step 2: Whole-branch review** (most capable model) on `git diff master...HEAD`. Attention: every `Record<ClassId|ClassGroup>` site; the races data (28 files consistent with the PHB items, the multiclass pairs only on dwarf and halfling lines); the derive uses PREPARED scores; `psp: null` handling (a `psp` of 0 is a real value; `psp ?? max`); the maintained list holds ids of powers that still exist (a deleted power must not strand an entry or crash the view); a non-psionicist actor sees no psionic UI and cannot drop a power; a Character NPC with the class; `initial` factories; the chat card for every result; refusals leave no partial writes.
- [ ] **Step 3: Headless proof** (controller; see the `foundry-headless-proof-harness` memory): real schema validation of the power items (all 23 pack documents) and actor `system.psionics` defaults (`schema.clean` of a pre-SP15 actor); the real `deriveCharacter`/`derivePsionics` for a level-5 psionicist (Wis 17, Con 16, Int 12 -> 73 PSPs) and a non-psionicist (null); the real action functions with a fake actor and seeded rolls (success/failure/1/20 and exact PSP arithmetic); the Psionics tab template rendered with a localize stub for a populated and an empty view.
- [ ] **Step 4: Rebuild the installed system** only if Foundry is closed.
- [ ] **Step 5: Push and open the PR**; hand the user a manual checklist WITH PREREQUISITES AND EXACT NUMBERS. Prerequisites: the character needs a **Psionicist class item** (drag it from the Classes compendium) and ability scores Wis 17, Con 16, Int 12; expected: level 1 shows 25 PSPs, level 5 shows 73, a Wis 15 / Con 11 / Int 12 character shows 20 at level 1 and 40 at level 3; dragging Clairvoyance (a science) before three devotions is refused ("devotion ratio"), dragging three devotions then a science succeeds, a fourth devotion at level 1 is refused; a Use with a roll at or under the score costs the full PSPs, otherwise half rounded up; Rest is refused while a power is maintained; sleeping 2 hours recovers 24; an actor without the class shows no Psionics tab and refuses a power drop; check a non-GM seat. Settings need no reload (there are none).

---

## Self-Review notes

- Spec coverage: the class (Table 1-3, 7-10) -> Task 2; PSP, power score, check, learning, recovery (Tables 4-6) -> Task 1; `power` items and the starter catalog -> Task 3; actor state and derive -> Task 4; use/relearn/rest/maintenance and the drop rule -> Task 5; the tab -> Task 6; testing and gates -> Task 7. Plans B-D remain architecture-only per the spec.
- Types are consistent across tasks: `Discipline`, `PowerKind`, `KnownPower`, `canLearn`/`canRelearn`, `psionicStrength`, `derivePsionics`/`DerivedPsionics`, `PsionicActor`, `PsionicsView`, `system.psionics { psp, maintained, max, level }`.
- Judgment points left to the implementers (named so they are not silent): exact armor/weapon name strings, the d20 roll helper, the actor typings at the sheet seams, the tab-visibility mechanism, the pack build discovery, and the existing census tests that must be extended.
