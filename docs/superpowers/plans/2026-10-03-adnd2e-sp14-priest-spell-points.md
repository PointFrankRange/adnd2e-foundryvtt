# Priest Spell Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the `spellPoints` rule is on, priests memorize and cast from a Table 26 spell-point pool (fixed and free theurgies, Table 27 Wisdom bonus, Table 28/29 costs) instead of classic Table 24 slots.

**Architecture:** A pure core module (`src/core/magic/priest-spell-points.ts`) holds the Table 26/27/28/29 data and lookups. The derive layer adds a `spellPoints.priest` record beside the wizard's. Memorized entries gain a `theurgyScope` field so a fixed theurgy's cost is stored as major or minor, and a free theurgy's as major or universal. The sheet glue mirrors Plan A's wizard flow (memorize, cast, free-magick dialog, SP bar) for the priest branch.

**Tech Stack:** TypeScript, Foundry v14 DataModels (SchemaField/StringField/ObjectField), vitest, ApplicationV2 sheets, Handlebars templates.

**Spec:** [docs/superpowers/specs/2026-10-03-adnd2e-sp14-priest-spell-points-design.md](../specs/2026-10-03-adnd2e-sp14-priest-spell-points-design.md)

## Global Constraints

- The spell-points gate is `spellPointsEnabled(rules)` from `src/core/magic/spell-points.ts`. Never restate the expression.
- Pure code in `src/core/**` and `src/data/derive/**` imports nothing from Foundry and keeps 100% line/statement/function coverage with branches >= 90.
- Do not run `npm install`, `npm update`, or any formatter.
- Vitest output is read via tail/redirect, never grep.
- Foundry glue is verified by typecheck, lint, and the gated dev-world check.

---

### Task 1: Priest tables and pure lookups

**Files:**
- Create: `src/core/magic/priest-spell-points.ts`
- Test: `tests/core/magic/priest-spell-points.test.ts`

**Interfaces:**
- Consumes: `assertAbilityScore`, `assertLevel`, `assertSpellLevel` from `src/core/errors.ts`.
- Produces:
  - `type TheurgyScope = "major" | "minor" | "universal"`
  - `type TheurgyType = "fixed" | "free"`
  - `priestSpellPointBase(priestLevel: number): number`
  - `priestMaxSpellLevel(priestLevel: number): number`
  - `priestMaxPerLevel(priestLevel: number): number`
  - `priestWisdomBonusSp(priestLevel: number, wisScore: number): number`
  - `priestSpellPointTotal(priestLevel: number, wisScore: number, conHpAdjustment: number): number`
  - `priestTheurgyCost(spellLevel: number, magickType: TheurgyType, scope: TheurgyScope): number`
  - `priestScopeAllowsFree(scope: TheurgyScope): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import {
  priestMaxPerLevel, priestMaxSpellLevel, priestSpellPointBase, priestSpellPointTotal,
  priestTheurgyCost, priestWisdomBonusSp,
} from "../../../src/core/magic/priest-spell-points";

describe("Table 26 priest progression", () => {
  it.each([
    [1, 1, 3, 4], [2, 1, 4, 8], [3, 2, 5, 15], [4, 2, 5, 25], [5, 3, 6, 40],
    [6, 3, 6, 55], [7, 4, 6, 70], [8, 4, 7, 90], [9, 5, 7, 125], [10, 5, 7, 160],
    [11, 6, 8, 200], [12, 6, 8, 240], [13, 6, 8, 290], [14, 7, 9, 340], [15, 7, 9, 400],
    [16, 7, 10, 460], [17, 7, 10, 530], [18, 7, 11, 600], [19, 7, 11, 675], [20, 7, 12, 750],
  ])("level %i: max spell level %i, %i per level, %i SP", (level, maxSpell, perLevel, sp) => {
    expect(priestMaxSpellLevel(level)).toBe(maxSpell);
    expect(priestMaxPerLevel(level)).toBe(perLevel);
    expect(priestSpellPointBase(level)).toBe(sp);
  });

  it("adds 75 SP per level past 20, frozen at 7th level and 12 per level", () => {
    expect(priestSpellPointBase(21)).toBe(825);
    expect(priestSpellPointBase(22)).toBe(900);
    expect(priestMaxSpellLevel(25)).toBe(7);
    expect(priestMaxPerLevel(25)).toBe(12);
  });
});

describe("Table 27 Wisdom bonus SP", () => {
  it("is zero below Wisdom 13", () => {
    expect(priestWisdomBonusSp(5, 12)).toBe(0);
  });

  it.each([
    // [wisdom, [1-2, 3-4, 5-6, 7+]]
    [13, [4, 4, 4, 4]], [14, [8, 8, 8, 8]], [15, [8, 15, 15, 15]], [16, [8, 20, 20, 20]],
    [17, [8, 20, 30, 30]], [18, [8, 20, 30, 45]], [19, [12, 25, 45, 60]],
  ])("Wisdom %i uses the row by character-level band", (wis, row) => {
    expect(priestWisdomBonusSp(1, wis)).toBe(row[0]);
    expect(priestWisdomBonusSp(3, wis)).toBe(row[1]);
    expect(priestWisdomBonusSp(5, wis)).toBe(row[2]);
    expect(priestWisdomBonusSp(7, wis)).toBe(row[3]);
    expect(priestWisdomBonusSp(20, wis)).toBe(row[3]);
  });

  it("uses the Wisdom 19 row for Wisdom 20+ (user decision, spec)", () => {
    expect(priestWisdomBonusSp(5, 22)).toBe(priestWisdomBonusSp(5, 19));
  });
});

describe("priestSpellPointTotal", () => {
  it("adds the Wisdom bonus and the Constitution adjustment", () => {
    expect(priestSpellPointTotal(5, 16, 1)).toBe(40 + 20 + 1);
  });

  it("ignores the Constitution adjustment when it would drop the total below 4", () => {
    // level 1, Wis 13 bonus 4: base 4 + 4 = 8; Con -3 gives 5 (>=4, adjustment kept)
    expect(priestSpellPointTotal(1, 13, -3)).toBe(5);
    // Con -6 would give 2 (<4): adjustment ignored, base + Wisdom bonus kept
    expect(priestSpellPointTotal(1, 13, -6)).toBe(8);
  });
});

describe("Table 28/29 theurgy costs", () => {
  it("prices major fixed and major free from Table 28", () => {
    expect(priestTheurgyCost(1, "fixed", "major")).toBe(4);
    expect(priestTheurgyCost(7, "fixed", "major")).toBe(40);
    expect(priestTheurgyCost(1, "free", "major")).toBe(8);
    expect(priestTheurgyCost(7, "free", "major")).toBe(80);
  });

  it("prices minor fixed and universal free from the next spell level (Table 29)", () => {
    expect(priestTheurgyCost(1, "fixed", "minor")).toBe(6);
    expect(priestTheurgyCost(3, "fixed", "minor")).toBe(15);
    expect(priestTheurgyCost(7, "fixed", "minor")).toBe(50);
    expect(priestTheurgyCost(1, "free", "universal")).toBe(12);
    expect(priestTheurgyCost(7, "free", "universal")).toBe(100);
  });

  it("rejects combinations the book does not allow", () => {
    expect(() => priestTheurgyCost(3, "free", "minor")).toThrow(RangeError);
    expect(() => priestTheurgyCost(3, "fixed", "universal")).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/magic/priest-spell-points.test.ts > scratchpad/priest-t1.log 2>&1; tail -20 scratchpad/priest-t1.log`
Expected: FAIL, module `priest-spell-points` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// Player's Option: Spells & Magic Chapter 6 (printed pp. 92-93, Sub-project 14
// remainder). Priest spell points replace the classic Table 24 slots when the
// spell-points rule is on. Pure.
import { assertAbilityScore, assertLevel, assertSpellLevel } from "../errors";

const MAX_TABLE_LEVEL = 20;

export type TheurgyType = "fixed" | "free";
export type TheurgyScope = "major" | "minor" | "universal";

interface PriestSpellPointRow {
  maxSpellLevel: number;
  maxPerLevel: number;
  sp: number;
}

// prettier-ignore
const PRIEST_SPELL_POINT_PROGRESSION: readonly PriestSpellPointRow[] = [
  { maxSpellLevel: 1, maxPerLevel: 3,  sp: 4 },    // L1
  { maxSpellLevel: 1, maxPerLevel: 4,  sp: 8 },    // L2
  { maxSpellLevel: 2, maxPerLevel: 5,  sp: 15 },   // L3
  { maxSpellLevel: 2, maxPerLevel: 5,  sp: 25 },   // L4
  { maxSpellLevel: 3, maxPerLevel: 6,  sp: 40 },   // L5
  { maxSpellLevel: 3, maxPerLevel: 6,  sp: 55 },   // L6
  { maxSpellLevel: 4, maxPerLevel: 6,  sp: 70 },   // L7
  { maxSpellLevel: 4, maxPerLevel: 7,  sp: 90 },   // L8
  { maxSpellLevel: 5, maxPerLevel: 7,  sp: 125 },  // L9
  { maxSpellLevel: 5, maxPerLevel: 7,  sp: 160 },  // L10
  { maxSpellLevel: 6, maxPerLevel: 8,  sp: 200 },  // L11
  { maxSpellLevel: 6, maxPerLevel: 8,  sp: 240 },  // L12
  { maxSpellLevel: 6, maxPerLevel: 8,  sp: 290 },  // L13
  { maxSpellLevel: 7, maxPerLevel: 9,  sp: 340 },  // L14
  { maxSpellLevel: 7, maxPerLevel: 9,  sp: 400 },  // L15
  { maxSpellLevel: 7, maxPerLevel: 10, sp: 460 },  // L16
  { maxSpellLevel: 7, maxPerLevel: 10, sp: 530 },  // L17
  { maxSpellLevel: 7, maxPerLevel: 11, sp: 600 },  // L18
  { maxSpellLevel: 7, maxPerLevel: 11, sp: 675 },  // L19
  { maxSpellLevel: 7, maxPerLevel: 12, sp: 750 },  // L20
];

function priestRow(priestLevel: number): PriestSpellPointRow {
  assertLevel(priestLevel, "priestLevel");
  if (priestLevel <= MAX_TABLE_LEVEL) return PRIEST_SPELL_POINT_PROGRESSION[priestLevel - 1];
  // Table 26's "21+" row: +75 SP per level past 20; max spell level and per-level cap frozen.
  const l20 = PRIEST_SPELL_POINT_PROGRESSION[MAX_TABLE_LEVEL - 1];
  return { ...l20, sp: l20.sp + 75 * (priestLevel - MAX_TABLE_LEVEL) };
}

export function priestSpellPointBase(priestLevel: number): number {
  return priestRow(priestLevel).sp;
}

export function priestMaxSpellLevel(priestLevel: number): number {
  return priestRow(priestLevel).maxSpellLevel;
}

export function priestMaxPerLevel(priestLevel: number): number {
  return priestRow(priestLevel).maxPerLevel;
}

// prettier-ignore
// Table 27 rows by Wisdom 13..19; each row is the bonus for the character-level
// band 1-2 / 3-4 / 5-6 / 7+.
const WISDOM_BONUS_ROWS: Readonly<Record<number, readonly number[]>> = {
  13: [4, 4, 4, 4],
  14: [8, 8, 8, 8],
  15: [8, 15, 15, 15],
  16: [8, 20, 20, 20],
  17: [8, 20, 30, 30],
  18: [8, 20, 30, 45],
  19: [12, 25, 45, 60],
};

function bandIndex(priestLevel: number): number {
  if (priestLevel <= 2) return 0;
  if (priestLevel <= 4) return 1;
  if (priestLevel <= 6) return 2;
  return 3;
}

/** Table 27. Wisdom below 13 gives no bonus; Wisdom 20+ uses the Wisdom 19 row (spec decision). */
export function priestWisdomBonusSp(priestLevel: number, wisScore: number): number {
  assertLevel(priestLevel, "priestLevel");
  assertAbilityScore(wisScore, "wis");
  if (wisScore < 13) return 0;
  const row = WISDOM_BONUS_ROWS[Math.min(wisScore, 19)];
  return row[bandIndex(priestLevel)];
}

/** Table 26 SP + Table 27 Wisdom bonus, plus the Constitution hit-point
 *  adjustment. If the adjustment would drop the total below 4, it is ignored
 *  (book p. 93). */
export function priestSpellPointTotal(priestLevel: number, wisScore: number, conHpAdjustment: number): number {
  const base = priestSpellPointBase(priestLevel) + priestWisdomBonusSp(priestLevel, wisScore);
  const adjusted = base + conHpAdjustment;
  return adjusted < 4 ? base : adjusted;
}

// prettier-ignore
// Table 29, spell levels 1-7 (index 0 = 1st level). Minor fixed and universal
// free are one spell level higher than major (Table 28), per the book's
// minor-access rule; both columns are listed explicitly in the book.
const MAJOR_FIXED: readonly number[]     = [4, 6, 10, 15, 22, 30, 40];
const MAJOR_FREE: readonly number[]      = [8, 12, 20, 30, 44, 60, 80];
const MINOR_FIXED: readonly number[]     = [6, 10, 15, 22, 30, 40, 50];
const UNIVERSAL_FREE: readonly number[] = [12, 20, 30, 44, 60, 80, 100];

/** Table 29 cost of one theurgy. Fixed theurgies come only from major or minor
 *  access; free theurgies from major or universal only (minor access allows no
 *  free theurgy, per the book). */
export function priestTheurgyCost(spellLevel: number, magickType: TheurgyType, scope: TheurgyScope): number {
  assertSpellLevel(spellLevel);
  if (spellLevel > 7) throw new RangeError("priest theurgies stop at 7th level");
  const index = spellLevel - 1;
  if (magickType === "fixed" && scope === "major") return MAJOR_FIXED[index];
  if (magickType === "fixed" && scope === "minor") return MINOR_FIXED[index];
  if (magickType === "free" && scope === "major") return MAJOR_FREE[index];
  if (magickType === "free" && scope === "universal") return UNIVERSAL_FREE[index];
  throw new RangeError(`no theurgy cost for ${magickType} ${scope}`);
}

/** Whether a memorized theurgy of this scope may be a free theurgy. */
export function priestScopeAllowsFree(scope: TheurgyScope): boolean {
  return scope === "major" || scope === "universal";
}
```

Note: `assertSpellLevel` must accept 1–9 but the table covers 1–7. Spell level 8/9 would index `undefined`. Add a bound check in `priestTheurgyCost`: `if (spellLevel > 7) throw new RangeError("priest theurgies stop at 7th level")` before the table lookup. The test in Step 1 does not cover it; add it inline in this step.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/magic/priest-spell-points.test.ts > scratchpad/priest-t1.log 2>&1; tail -20 scratchpad/priest-t1.log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/magic/priest-spell-points.ts tests/core/magic/priest-spell-points.test.ts
git commit -m "feat(sp14-priest): Table 26/27/28/29 priest spell-point lookups"
```

---

### Task 2: Theurgy scope on memorized entries and the priest derive record

**Files:**
- Modify: `src/data/actor/base-actor.ts` (`memorizedSchema()` around line 31; derived cache around lines 346 and 395-396)
- Modify: `src/data/derive/character/snapshot.ts` (`MemorizedEntry`, lines 20-27)
- Modify: `src/data/derive/character/spell-points.ts`
- Modify: `src/data/derive/character/derive.ts` (`mergeCasterSpellPoints`, lines 95-115; `CharacterDerived.spellPoints` line 40; both branches lines 206-208 and 260)
- Test: `tests/data/derive/character/spell-points.test.ts`

**Interfaces:**
- Consumes: `priestMaxSpellLevel`, `priestMaxPerLevel`, `priestSpellPointTotal`, `priestTheurgyCost`, `TheurgyScope` from Task 1.
- Produces:
  - `MemorizedEntry.theurgyScope?: "major" | "minor" | "universal"` (absent for wizard entries).
  - `deriveSpellPoints` input gains `priestLevel`, `wisScore`, `conHpAdjustment`, `priestMemorized`, and its result gains `priest?: SpellPointsRecord`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { deriveSpellPoints } from "../../../../src/data/derive/character/spell-points";

const base = {
  chassisId: "cleric", level: 5, intScore: 10, maxSpellLevelKnown: null, specialist: false, wizardMemorized: [],
  priestLevel: 5, wisScore: 16, conHpAdjustment: 1, priestMemorized: [],
};

describe("deriveSpellPoints priest branch", () => {
  it("derives the Table 26/27 record for a priest-progression chassis", () => {
    const out = deriveSpellPoints(base);
    expect(out.priest).toEqual({ maxSpellLevel: 3, maxPerLevel: 6, sp: 40 + 20 + 1, spent: 0, remaining: 61 });
  });

  it("prices memorized theurgies from their stored scope", () => {
    const out = deriveSpellPoints({
      ...base,
      priestMemorized: [
        { spellItemId: "a", spellLevel: 2, expended: false, magickType: "fixed", theurgyScope: "minor" },
        { spellItemId: null, spellLevel: 1, expended: false, magickType: "free", theurgyScope: "universal" },
      ],
    });
    expect(out.priest?.spent).toBe(10 + 12);
  });

  it("is absent for a wizard chassis", () => {
    expect(deriveSpellPoints({ ...base, chassisId: "mage" }).priest).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/derive/character/spell-points.test.ts > scratchpad/priest-t2.log 2>&1; tail -20 scratchpad/priest-t2.log`
Expected: FAIL, `out.priest` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/data/derive/character/spell-points.ts`, extend the input and result:

```typescript
import {
  priestMaxPerLevel, priestMaxSpellLevel, priestSpellPointTotal, priestTheurgyCost,
  type TheurgyScope,
} from "../../../core/magic/priest-spell-points";

export interface SpellPointsInput {
  // ...existing wizard fields unchanged...
  /** priest class level for the priest branch */
  priestLevel: number;
  wisScore: number;
  conHpAdjustment: number;
  priestMemorized: readonly MemorizedEntry[];
}

export function deriveSpellPoints(input: SpellPointsInput): { wizard?: SpellPointsRecord; priest?: SpellPointsRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType === "priest" && chassis.spellProgressionId === "priest") {
    const sp = priestSpellPointTotal(input.priestLevel, input.wisScore, input.conHpAdjustment);
    const spent = input.priestMemorized.reduce(
      (sum, m) => sum + priestTheurgyCost(m.spellLevel, m.magickType ?? "fixed", (m.theurgyScope ?? "major") as TheurgyScope),
      0,
    );
    return {
      priest: {
        maxSpellLevel: priestMaxSpellLevel(input.priestLevel),
        maxPerLevel: priestMaxPerLevel(input.priestLevel),
        sp, spent, remaining: sp - spent,
      },
    };
  }
  // ...existing wizard branch unchanged, returning { wizard: ... }...
}
```

Keep the existing wizard return shape `{ wizard: ... }` for the wizard branch.

In `src/data/derive/character/snapshot.ts`, add to `MemorizedEntry`:

```typescript
  /** Sub-project 14 priest theurgies: which Table 29 column prices this entry. Absent for wizard entries. */
  theurgyScope?: "major" | "minor" | "universal";
```

In `src/data/actor/base-actor.ts`, add to `memorizedSchema()`:

```typescript
      /** Sub-project 14 priest theurgies: the Table 29 column (major / minor for fixed; major / universal for free). null for wizard entries. */
      theurgyScope: new StringField({ required: true, nullable: true, initial: null, choices: ["major", "minor", "universal"] }),
```

Also extend the derived spell-points cache: the type at line 346 gains `priest: { remaining: unknown }` in the spellcasting typing, and line ~396 gets `if (derived.spellPoints.priest) sys.spellcasting.priest.spellPoints = derived.spellPoints.priest;`. Add `spellPoints: new ObjectField({ required: true, initial: {} })` to the `priest` SchemaField (base-actor.ts around line 228), mirroring the wizard field at line 205.

In `src/data/derive/character/derive.ts`, add `priest?: SpellPointsRecord` to `CharacterDerived.spellPoints`, and pass the new inputs from `mergeCasterSpellPoints`: `priestLevel: c.level`, `wisScore: snapshot.abilities.wis`, `conHpAdjustment: abilities.con.hpAdjustment`, `priestMemorized: snapshot.priestMemorized`. Change its return type to `{ wizard?: SpellPointsRecord; priest?: SpellPointsRecord }`. Replace the `spellPointsEnabled(options)` gates unchanged; they already cover both branches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/derive/character/spell-points.test.ts tests/data/derive > scratchpad/priest-t2.log 2>&1; tail -30 scratchpad/priest-t2.log`
Expected: PASS. Existing wizard derive tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/data/actor/base-actor.ts src/data/derive/character tests/data/derive/character
git commit -m "feat(sp14-priest): priest spell-point derive record and theurgy scope on memorized entries"
```

---

### Task 3: Priest access tier for the memorize cost

**Files:**
- Modify: `src/magic/priest-sphere-access.ts`
- Test: `tests/magic/priest-sphere-access.test.ts` (extend the existing file)

**Interfaces:**
- Consumes: `resolveSphereAccess`, `canCastSphereSpell`, `SphereAccess` (existing).
- Produces: `priestAccessScope(chassisId, sphereAccessOverride, spellSpheres, spellLevel): "major" | "minor" | null`. Returns `"major"` if any sphere grants major access at this level, else `"minor"` if any sphere grants minor access at this level, else `null`.

- [ ] **Step 1: Write the failing test**

```typescript
import { priestAccessScope } from "../../src/magic/priest-sphere-access";

describe("priestAccessScope", () => {
  it("returns major when any sphere is major at this level", () => {
    expect(priestAccessScope("cleric", ["healing"], ["healing"], 5)).toBe("major");
  });

  it("returns minor for a minor-only sphere capped at 3rd level", () => {
    // override lists are major-only, so use the chassis table with a known minor-only sphere
    expect(priestAccessScope("cleric", null, ["divination"], 3)).toBe("minor");
    expect(priestAccessScope("cleric", null, ["divination"], 4)).toBeNull();
  });

  it("returns null when no sphere grants access", () => {
    expect(priestAccessScope(null, null, ["healing"], 1)).toBeNull();
  });
});
```

(Check the actual minor-only and major sphere names against `CLERIC_SPHERE_ACCESS` in `src/core/magic/tables.ts` before running; replace `divination` and `healing` with a real minor and major sphere for the cleric.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/magic/priest-sphere-access.test.ts > scratchpad/priest-t3.log 2>&1; tail -20 scratchpad/priest-t3.log`
Expected: FAIL, `priestAccessScope` is not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
/** The Table 29 column a memorize of this spell is priced under: "major" when a
 *  listed sphere grants major access at this level, "minor" when only minor
 *  access applies, null when none does. Same override/chassis rules as
 *  canMemorizePriestSpell. */
export function priestAccessScope(
  chassisId: string | null,
  sphereAccessOverride: readonly SphereName[] | null,
  spellSpheres: readonly SphereName[],
  spellLevel: number,
): "major" | "minor" | null {
  if (!chassisId) return null;
  const table = effectiveSphereAccess(chassisId, sphereAccessOverride);
  let best: "major" | "minor" | null = null;
  for (const sphere of spellSpheres) {
    const access = resolveSphereAccess(table, sphere);
    if (access === "major" && canCastSphereSpell(access, spellLevel)) return "major";
    if (access === "minor" && canCastSphereSpell(access, spellLevel)) best = "minor";
  }
  return best;
}
```

Then rewrite `canMemorizePriestSpell` to `return priestAccessScope(...) !== null;` so there is one source of truth.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/magic/priest-sphere-access.test.ts > scratchpad/priest-t3.log 2>&1; tail -20 scratchpad/priest-t3.log`
Expected: PASS. Existing `canMemorizePriestSpell` tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/magic/priest-sphere-access.ts tests/magic/priest-sphere-access.test.ts
git commit -m "feat(sp14-priest): priestAccessScope picks the Table 29 column for a spell"
```

---

### Task 4: Fixed theurgy memorize and the priest SP eligibility

**Files:**
- Modify: `src/sheets/character/spell-actions.ts` (`canReMemorize` lines 148-172; `memorizeSpell` lines 182-193; `canMemorizeWizardSpellPoints` lines 131-141)
- Test: `tests/sheets/character/spell-actions.test.ts` (extend; add cases for priest pool)

**Interfaces:**
- Consumes: `priestTheurgyCost`, `priestScopeAllowsFree`, `TheurgyScope` (Task 1); `priestAccessScope` (Task 3); `actor.system.spellcasting.priest.spellPoints` (Task 2).
- Produces: `canMemorizePriestSpellPoints(actor, spellLevel, scope): boolean` (module-private, same shape as `canMemorizeWizardSpellPoints`).

- [ ] **Step 1: Write the failing test**

Add to `tests/sheets/character/spell-actions.test.ts`:

```typescript
it("memorizes a priest fixed theurgy when the rule is on and the pool affords it", async () => {
  // actor: priest pool { maxSpellLevel: 3, maxPerLevel: 6, sp: 40, spent: 0, remaining: 40 }, priest chassis cleric, spell "cure light wounds" (healing, level 1, major access)
  await memorizeSpell(actor, "clw-id");
  expect(actor.update).toHaveBeenCalledWith({
    "system.spellcasting.priest.memorized": [
      { spellItemId: "clw-id", spellLevel: 1, expended: false, magickType: "fixed", theurgyScope: "major" },
    ],
  });
});

it("refuses a priest memorize the pool cannot afford", async () => {
  // same actor with sp 40 and spent 39; a major fixed 1st-level costs 4
  await memorizeSpell(actor, "clw-id");
  expect(actor.update).not.toHaveBeenCalled();
});
```

Use the existing test fixtures in that file for the actor and the spell item shape; match their construction helper rather than writing a new one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/priest-t4.log 2>&1; tail -30 scratchpad/priest-t4.log`
Expected: FAIL, the priest path still uses slots and writes no `magickType` or `theurgyScope`.

- [ ] **Step 3: Write minimal implementation**

In `spell-actions.ts`, add a priest-pool eligibility mirroring `canMemorizeWizardSpellPoints`:

```typescript
/** Priest spell-points eligibility for a fixed theurgy of this access scope:
 *  the spell's level must be within Table 26's max spell level, the flat
 *  per-level cap must have room, and the pool must afford the Table 29 cost. */
function canMemorizePriestSpellPoints(actor: SpellcasterActor, spellLevel: number, scope: TheurgyScope): boolean {
  const sp = actor.system.spellcasting.priest.spellPoints;
  if (typeof sp.maxSpellLevel !== "number") return false;
  if (spellLevel > sp.maxSpellLevel) return false;
  const atLevel = spellsMemorizedAtLevel(actor.system.spellcasting.priest.memorized, spellLevel);
  if (atLevel >= (sp.maxPerLevel ?? 0)) return false;
  return (sp.remaining ?? 0) >= priestTheurgyCost(spellLevel, "fixed", scope);
}
```

In `canReMemorize`, replace the priest half: when `key === "priest" && spellPointsEnabled(getOptionalRules())`, compute `const scope = priestAccessScope(priestChassisId, sphereAccessOverride, spell.system.spheres as SphereName[], spell.system.level)`; return false if null or if `!canMemorizePriestSpellPoints(actor, spell.system.level, scope)`; otherwise skip the classic slot check. When the rule is off, keep the existing slot check.

In `memorizeSpell`, when the priest pool path applies, write `{ spellItemId, spellLevel, expended: false, magickType: "fixed", theurgyScope: scope }`. Keep the wizard entry shape unchanged, with `theurgyScope` absent.

Also: `canMemorizeWizardSpellPoints` is a wizard path and must not change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/priest-t4.log 2>&1; tail -30 scratchpad/priest-t4.log`
Expected: PASS, and the existing wizard and classic-priest tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/spell-actions.ts tests/sheets/character/spell-actions.test.ts
git commit -m "feat(sp14-priest): memorize fixed theurgies against the priest SP pool"
```

---

### Task 5: Free theurgies for priests

**Files:**
- Modify: `src/sheets/character/spell-actions.ts` (`memorizeFreeMagick` lines 477-496, `forgetFreeMagick` lines 498-515, `castFreeMagick` lines 517-560; generalize over `casterKey` where the wizard-only lookups sit)
- Modify: `src/sheets/character/free-magick-dialog.ts` (`promptFreeMagickSpell` lines 31-40: add a priest branch that filters priest spells by level and, for `scope === "major"`, by `priestAccessScope`)
- Test: `tests/sheets/character/spell-actions.test.ts` (extend)

**Interfaces:**
- Consumes: `priestTheurgyCost`, `priestScopeAllowsFree`, `TheurgyScope` (Task 1); `priestAccessScope` (Task 3); the pool eligibility from Task 4.
- Produces:
  - `memorizeFreeTheurgy(actor, spellLevel, scope: "major" | "universal"): Promise<void>` writes `{ spellItemId: null, spellLevel, expended: false, magickType: "free", theurgyScope: scope }` into `system.spellcasting.priest.memorized`.
  - `castFreeTheurgy(actor, spellLevel, scope)` chooses the spell at cast time, via `promptFreeMagickSpell` with the priest branch, then posts the normal cast card and expends the first unexpended matching entry.

- [ ] **Step 1: Write the failing test**

```typescript
it("memorizes a major free theurgy at the Table 28 free cost", async () => {
  // priest pool sp 40, spent 0; 3rd level major free costs 20
  await memorizeFreeTheurgy(actor, 3, "major");
  expect(actor.update).toHaveBeenCalledWith({
    "system.spellcasting.priest.memorized": [
      { spellItemId: null, spellLevel: 3, expended: false, magickType: "free", theurgyScope: "major" },
    ],
  });
});

it("refuses a minor-scope free theurgy (the book allows none)", async () => {
  // typed as "major" | "universal" so this is a compile-time error; assert the runtime guard too
  await expect(memorizeFreeTheurgy(actor, 3, "minor" as never)).rejects.toThrow(RangeError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/priest-t5.log 2>&1; tail -30 scratchpad/priest-t5.log`
Expected: FAIL, `memorizeFreeTheurgy` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add `memorizeFreeTheurgy` next to `memorizeFreeMagick`. It guards with `priestScopeAllowsFree(scope)` (throw `RangeError` if false), then reuses `canMemorizePriestSpellPoints` with the scope, and writes the entry shown in Step 1. Use `priestTheurgyCost(spellLevel, "free", scope)` for the affordability check.

Add `castFreeTheurgy(actor, spellLevel, scope)` mirroring `castFreeMagick`: prompt with `promptFreeMagickSpell` (priest branch: priest spells at `spellLevel`; for `scope === "major"`, also require `priestAccessScope(...) === "major"`), then post the cast card and set `expended: true` on the first unexpended matching `magickType: "free"` priest entry at that level and scope.

In `free-magick-dialog.ts`, add the priest branch to `promptFreeMagickSpell`. It takes the `scope` argument and filters by the access rule. Keep the wizard branch unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/priest-t5.log 2>&1; tail -30 scratchpad/priest-t5.log`
Expected: PASS, and the existing wizard free-magick tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/spell-actions.ts src/sheets/character/free-magick-dialog.ts tests/sheets/character/spell-actions.test.ts
git commit -m "feat(sp14-priest): major and universal free theurgies"
```

---

### Task 6: Sheet context, SP bar, and template

**Files:**
- Modify: `src/sheets/character/context.ts` (`buildSpells` lines 658-715; `buildSpellRow` lines 782-830; `CharacterSheetInput` gains `priestSpellPoints`)
- Modify: `src/sheets/character/context-types.ts` (`CharacterSheetContext["spells"]` gains a `priestSpellPoints` entry, same shape as `spellPoints`)
- Modify: `templates/actor/pc/spells.hbs` (add a priest SP bar in the same `else-if` mutual-exclusion block as the wizard bar; hide the priest classic slot rows when the rule is on)
- Modify: `lang/en.json` (strings for the priest pool label; reuse existing SP strings where possible)
- Test: `tests/sheets/character/context.test.ts` (extend the spells describe block)

**Interfaces:**
- Consumes: `sc.priest.spellPoints` (Task 2); `priestTheurgyCost` (Task 1); `priestAccessScope` (Task 3).
- Produces: `CharacterSheetContext["spells"].priestSpellPoints: { max; spent; remaining } | null`, and a per-row `canMemorize` for priest rows that reflects pool affordability at the row's access scope.

- [ ] **Step 1: Write the failing test**

```typescript
it("shows the priest SP bar and disables a priest spell row the pool cannot afford", () => {
  const ctx = buildCharacterSheetContext(priestInputWithPool({ remaining: 3 }), optionalRulesWith({ spellPoints: true }));
  expect(ctx.spells.priestSpellPoints).toEqual({ max: 40, spent: 37, remaining: 3 });
  const row = ctx.spells.known[0].items.find((r) => r.name === "Cure Light Wounds");
  expect(row.canMemorize).toBe(false); // 1st-level major fixed costs 4 > remaining 3
});

it("hides the priest classic slot rows when the rule is on", () => {
  const ctx = buildCharacterSheetContext(priestInputWithPool({ remaining: 40 }), optionalRulesWith({ spellPoints: true }));
  expect(ctx.spells.priestSlots).toEqual([]);
});
```

Use the existing fixture helpers in `context.test.ts`. Name them after what they build, and match the existing wizard `spellPoints` test pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/context.test.ts > scratchpad/priest-t6.log 2>&1; tail -30 scratchpad/priest-t6.log`
Expected: FAIL, `priestSpellPoints` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `buildSpells`, compute `priestSp = sc.priest.spellPoints ?? {}` (the `?? {}` covers the absent-field fixture case, as the wizard branch does). Add:

```typescript
priestSpellPoints:
  spellPointsOn && typeof priestSp.remaining === "number"
    ? { max: priestSp.sp ?? 0, spent: priestSp.spent ?? 0, remaining: priestSp.remaining }
    : null,
```

When `spellPointsOn` is true, set `priestSlots: []` so the classic priest slot rows are hidden. Otherwise keep `toSlotRows(sc.priest.slots)`.

In `buildSpellRow`, when `!isWizard && spellPointsOn`, set `hasFreeSlot` to whether the priest pool affords a fixed theurgy at the row's scope. The scope is `priestAccessScope(priestChassisId, sphereAccessOverride, item.spheres, item.level)`. If it is null, the row is not eligible. Otherwise compute the cost with `priestTheurgyCost(item.level, "fixed", scope)` and compare against `priestSp.remaining` and the per-level cap. Pass the priest pool into `buildSpellRow` the same way the wizard's `wizardSp` is passed.

In `templates/actor/pc/spells.hbs`, add a priest SP bar in the `else-if` chain next to the wizard bar, reading `adnd2e.spells.priestSpellPoints`. Reuse the wizard bar's markup and classes so the kit styling matches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character/context.test.ts > scratchpad/priest-t6.log 2>&1; tail -30 scratchpad/priest-t6.log`
Expected: PASS.

Then run the template/lang drift checks: `npx vitest run tests/templates tests/lang > scratchpad/priest-t6b.log 2>&1; tail -20 scratchpad/priest-t6b.log`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/context.ts src/sheets/character/context-types.ts templates/actor/pc/spells.hbs lang/en.json tests/sheets/character/context.test.ts
git commit -m "feat(sp14-priest): priest SP bar, pool-aware memorize eligibility, and hidden classic slots"
```

---

### Task 7: Full verification, README, and PR

**Files:**
- Modify: `README.md` (Sub-project 14 row and a Plan D paragraph; backlog line drops "priest spell points")

- [ ] **Step 1: Run the full pure suite and typecheck**

Run: `npx vitest run > scratchpad/priest-full.log 2>&1; tail -40 scratchpad/priest-full.log`
Expected: all tests pass. Known pre-existing coverage gaps (derive.ts line 78, registry.ts line 61, damage-dice.ts, context.ts) are not this work. Confirm no new uncovered lines in `priest-spell-points.ts`, `priest-sphere-access.ts`, or the priest derive branch.

Run: `npm run typecheck > scratchpad/priest-tc.log 2>&1; tail -20 scratchpad/priest-tc.log`
Run: `npm run lint > scratchpad/priest-lint.log 2>&1; tail -20 scratchpad/priest-lint.log`
Expected: both clean.

- [ ] **Step 2: Gated dev-world check (user)**

Do not run `npm run build` without asking the user and confirming Foundry is closed. Give the user this checklist, with one non-GM player seat as the test actor:
1. Turn on the Spells & Magic and Spell Points rules. Create a priest at level 5 with Wisdom 16 and a cleric chassis.
2. The SP bar shows 61 (40 + 20 Wisdom bonus + Constitution adjustment as applicable). Classic priest slot rows are hidden.
3. Memorize a major fixed 1st-level theurgy. Pool drops by 4. Forget it. Pool returns.
4. Memorize a minor-sphere 3rd-level spell. Pool drops by 15 (Minor Fixed), not 10.
5. Memorize a major free 2nd-level theurgy and cast it. The spell is chosen at cast time and only major-sphere spells are offered.
6. Memorize a universal free 2nd-level theurgy. Any priest spell of that level is offered.
7. Cast a memorized theurgy; it shows expended, the pool stays spent. Rest; expended clears, the pool stays spent until forgotten.
8. Turn the rule off. Classic priest slots return; the pool bar disappears.
9. Repeat steps 3 and 5 on a non-GM player seat.

- [ ] **Step 3: README and PR**

Update the README Sub-project 14 row to "Complete (Plans A, B, C & D)" and add a short Plan D paragraph. Remove "priest spell points" from the backlog line.

```bash
git checkout -b feat/adnd2e-sp14d
git add README.md
git commit -m "docs: mark Sub-project 14 Plan D (priest spell points) complete"
git push -u origin feat/adnd2e-sp14d
gh pr create --base master --title "Sub-project 14 Plan D: priest spell points" --body "$(cat <<'EOF'
## Summary
- Priest spell points (Tables 26-29) on the existing `spellPoints` rule.
- Fixed theurgies (major and minor-sphere cost shift), major and universal free theurgies.
- Pool-aware priest SP bar; classic priest slots hidden when the rule is on.

## Test plan
- [ ] Pure suite and typecheck/lint green
- [ ] Gated dev-world check (steps 1-9 in the plan), including a non-GM player seat

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Commit**

The commit and PR steps above are the last ones. The branch is pushed and the PR opened. The user merges it.
</content>
