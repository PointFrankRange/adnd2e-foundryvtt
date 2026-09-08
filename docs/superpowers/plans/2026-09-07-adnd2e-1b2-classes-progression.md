# AD&D 2E — Plan 1b.2: Class Chassis + Progression + THAC0 + Saving-Throw Tables

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the AD&D 2E class layer to the `src/core/` rules engine: chassis definitions for the four base classes (Fighter, Mage, Cleric, Thief), XP→level / hit-dice / proficiency-slot progression, THAC0 by group and level, and the raw saving-throw target matrices — all pure functions with full Vitest coverage.

**Architecture:** Continues Plan 1b's framework-free `src/core/` engine (pure functions + literal lookup tables, no Foundry imports, enforced by `tsconfig.core.json` + ESLint). New modules `src/core/classes/` and `src/core/saves/`. Class-group facts (Hit Dice, THAC0, saves, proficiency slots) are keyed by `ClassGroup`; per-class facts live on the `ClassChassis`.

**Tech Stack:** TypeScript 5 strict; Vitest 5 (`test:coverage` gate at 100% lines/statements on `src/core/**`); ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §4 (`core/` architecture: `classes/`, `saves/`), §5.1 (class level/XP on the chassis), §5.6 (derived-data ordering), §9 (testing), §11 (reference workflow).

**Research source:** `references/research-notes.md` (git-ignored) — section "PLAN 1b.2: CLASSES + PROGRESSION + THAC0 + SAVES". Every table (14, 20, 23, 25, 15, 34, 53, 54, 60, 13) transcribed from the user's PHB PDF with page citations. All values in this plan are copied from there.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, the DOM, `fvtt-types`, or any relative path outside `src/core/`. Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `typecheck` gate and by the `no-restricted-globals` / `no-restricted-imports` ESLint block on `src/core/**` + `tests/core/**`.
- Core functions return **plain data** (numbers, records, arrays) — no Foundry `Roll`.
- TypeScript `strict: true`. Prettier printWidth 100, 2-space, double quotes, semi, trailing-comma all. **Do not run `npm run format`** — it reflows the column-aligned lookup tables. Author new tables aligned by hand; if a table would trip a future Prettier gate, precede it with `// prettier-ignore`.
- No copyrighted prose in the repo — mechanical/factual values only. Each table file carries a `// PHB Table N, p.XX` citation comment.
- `src/core/**` must stay at **100% lines / statements / functions** and **≥90% branches** coverage (`npm run test:coverage`, enforced in CI). Every task's own tests must hold that — a task that drops coverage fails its gate.
- Levels are integers ≥ 1. Class functions throw `RangeError` for non-integer or `< 1` levels (reuse the pattern from `src/core/errors.ts`; add a `assertLevel` helper). XP is an integer ≥ 0; `levelForXp` throws for negative or non-integer XP.
- `ClassGroup` (`"warrior" | "wizard" | "priest" | "rogue"`) and `AbilityKey` already exist in `src/core/types.ts` (Plan 1b) — import, do not redefine.

---

## File Structure

**Created:**
- `src/core/classes/chassis.ts` — `getChassis(id)` + the four `ClassChassis` constants (`FIGHTER`, `MAGE`, `CLERIC`, `THIEF`).
- `src/core/classes/progression.ts` — `levelForXp`, `xpForLevel`, `hitDice`, `warriorAttacksPerRound`, `weaponProficiencySlots`, `nonweaponProficiencySlots`.
- `src/core/classes/thac0.ts` — `thac0(group, level)`.
- `src/core/classes/index.ts` — barrel.
- `src/core/saves/tables.ts` — `SAVE_MATRICES` (Table 60).
- `src/core/saves/index.ts` — `saveBaseTarget(group, level, category)` + barrel.
- `tests/core/classes/chassis.test.ts`, `progression.test.ts`, `thac0.test.ts`
- `tests/core/saves/saves.test.ts`

**Modified:**
- `src/core/types.ts` — add `ClassId`, `SaveCategory`, `ProficiencySlotProgression`, `HitDice`, `ClassChassis`.
- `src/core/errors.ts` — add `assertLevel(value: number, label?: string)` and `assertXp(value: number)`.
- `src/core/index.ts` — add `export * from "./classes";` and `export * from "./saves";`.
- `tests/core/errors.test.ts` — cases for `assertLevel` / `assertXp`.

---

## Task 1: Types + guards + class chassis definitions

**Files:**
- Modify: `src/core/types.ts`, `src/core/errors.ts`, `src/core/index.ts`, `tests/core/errors.test.ts`
- Create: `src/core/classes/chassis.ts`, `src/core/classes/index.ts`, `tests/core/classes/chassis.test.ts`

**Interfaces:**
- Produces:
  - `type ClassId = "fighter" | "mage" | "cleric" | "thief"`
  - `type SaveCategory = "ppd" | "rsw" | "pp" | "bw" | "spell"`
  - `interface ProficiencySlotProgression { initial: number; levelsPerSlot: number }`
  - `interface HitDice { count: number; dieType: number; bonus: number }`
  - `interface ClassChassis { … }` (see Step 2)
  - `function assertLevel(value: number, label?: string): void` — throws `RangeError` unless `Number.isInteger(value) && value >= 1`
  - `function assertXp(value: number): void` — throws `RangeError` unless `Number.isInteger(value) && value >= 0`
  - `function getChassis(id: ClassId): ClassChassis`
  - `const FIGHTER, MAGE, CLERIC, THIEF: ClassChassis`
- Consumed by: Tasks 2, 3, 4.

- [ ] **Step 1: Write failing tests** — `tests/core/errors.test.ts` (append), then `tests/core/classes/chassis.test.ts`

Append to `tests/core/errors.test.ts`:

```ts
import { assertLevel, assertXp } from "../../src/core/errors";

describe("assertLevel", () => {
  it("accepts integers >= 1", () => {
    expect(() => assertLevel(1)).not.toThrow();
    expect(() => assertLevel(20)).not.toThrow();
    expect(() => assertLevel(41)).not.toThrow();
  });
  it("rejects < 1 and non-integers", () => {
    expect(() => assertLevel(0)).toThrow(RangeError);
    expect(() => assertLevel(-1)).toThrow(RangeError);
    expect(() => assertLevel(3.5)).toThrow(RangeError);
    expect(() => assertLevel(Number.NaN)).toThrow(RangeError);
  });
  it("includes the label when given", () => {
    expect(() => assertLevel(0, "class level")).toThrow(/class level/);
  });
});

describe("assertXp", () => {
  it("accepts integers >= 0", () => {
    expect(() => assertXp(0)).not.toThrow();
    expect(() => assertXp(250000)).not.toThrow();
  });
  it("rejects < 0 and non-integers", () => {
    expect(() => assertXp(-1)).toThrow(RangeError);
    expect(() => assertXp(12.5)).toThrow(RangeError);
  });
});
```

`tests/core/classes/chassis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getChassis, FIGHTER, MAGE, CLERIC, THIEF } from "../../../src/core/classes/chassis";

describe("class chassis", () => {
  it("getChassis returns the matching constant", () => {
    expect(getChassis("fighter")).toBe(FIGHTER);
    expect(getChassis("mage")).toBe(MAGE);
    expect(getChassis("cleric")).toBe(CLERIC);
    expect(getChassis("thief")).toBe(THIEF);
  });

  it("Fighter — warrior chassis", () => {
    expect(FIGHTER).toMatchObject({
      id: "fighter", group: "warrior", hitDie: 10,
      hpAfterNameLevel: 3, conBonusCutoffLevel: 9,
      primeRequisites: ["str"], abilityMinimums: { str: 9 },
      xpPerLevelBeyond20: 250000,
      weaponProficiencies: { initial: 4, levelsPerSlot: 3 },
      nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
      nonProficiencyPenalty: -2,
      casterType: null,
      weaponSpecializationAllowed: true,
    });
    expect(FIGHTER.xpThresholds).toHaveLength(20);
    expect(FIGHTER.xpThresholds[0]).toBe(0);
    expect(FIGHTER.xpThresholds[1]).toBe(2000);
    expect(FIGHTER.xpThresholds[8]).toBe(250000);   // level 9
    expect(FIGHTER.xpThresholds[19]).toBe(3000000); // level 20
  });

  it("Mage — wizard chassis", () => {
    expect(MAGE).toMatchObject({
      id: "mage", group: "wizard", hitDie: 4,
      hpAfterNameLevel: 1, conBonusCutoffLevel: 10,
      primeRequisites: ["int"], abilityMinimums: { int: 9 },
      xpPerLevelBeyond20: 375000,
      weaponProficiencies: { initial: 1, levelsPerSlot: 6 },
      nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
      nonProficiencyPenalty: -5,
      casterType: "wizard",
      weaponSpecializationAllowed: false,
    });
    expect(MAGE.xpThresholds[1]).toBe(2500);
    expect(MAGE.xpThresholds[9]).toBe(250000);   // level 10
    expect(MAGE.xpThresholds[19]).toBe(3750000); // level 20
  });

  it("Cleric — priest chassis", () => {
    expect(CLERIC).toMatchObject({
      id: "cleric", group: "priest", hitDie: 8,
      hpAfterNameLevel: 2, conBonusCutoffLevel: 9,
      primeRequisites: ["wis"], abilityMinimums: { wis: 9 },
      xpPerLevelBeyond20: 225000,
      weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
      nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
      nonProficiencyPenalty: -3,
      casterType: "priest",
      weaponSpecializationAllowed: false,
    });
    expect(CLERIC.xpThresholds[1]).toBe(1500);
    expect(CLERIC.xpThresholds[8]).toBe(225000);  // level 9
    expect(CLERIC.xpThresholds[19]).toBe(2700000); // level 20
  });

  it("Thief — rogue chassis", () => {
    expect(THIEF).toMatchObject({
      id: "thief", group: "rogue", hitDie: 6,
      hpAfterNameLevel: 2, conBonusCutoffLevel: 10,
      primeRequisites: ["dex"], abilityMinimums: { dex: 9 },
      xpPerLevelBeyond20: 220000,
      weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
      nonweaponProficiencies: { initial: 3, levelsPerSlot: 4 },
      nonProficiencyPenalty: -3,
      casterType: null,
      weaponSpecializationAllowed: false,
    });
    expect(THIEF.xpThresholds[1]).toBe(1250);
    expect(THIEF.xpThresholds[9]).toBe(160000);  // level 10
    expect(THIEF.xpThresholds[19]).toBe(2200000); // level 20
  });

  it("every chassis xpThresholds is 20 strictly-increasing non-negative integers starting at 0", () => {
    for (const c of [FIGHTER, MAGE, CLERIC, THIEF]) {
      expect(c.xpThresholds).toHaveLength(20);
      expect(c.xpThresholds[0]).toBe(0);
      for (let i = 1; i < 20; i++) {
        expect(Number.isInteger(c.xpThresholds[i])).toBe(true);
        expect(c.xpThresholds[i]).toBeGreaterThan(c.xpThresholds[i - 1]);
      }
    }
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm run test -- tests/core/classes/chassis.test.ts` → FAIL (module missing).

- [ ] **Step 3: Extend `src/core/errors.ts`**

```ts
export function assertLevel(value: number, label = "level"): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be an integer >= 1, got ${value}`);
  }
}

export function assertXp(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`experience points must be an integer >= 0, got ${value}`);
  }
}
```

(keep the existing `assertAbilityScore`.)

- [ ] **Step 4: Add types to `src/core/types.ts`**

```ts
export type ClassId = "fighter" | "mage" | "cleric" | "thief";

export type SaveCategory = "ppd" | "rsw" | "pp" | "bw" | "spell";

export interface ProficiencySlotProgression {
  /** slots held at level 1 */
  initial: number;
  /** a new slot is gained at every level evenly divisible by this number */
  levelsPerSlot: number;
}

export interface HitDice {
  /** number of dice rolled */
  count: number;
  /** die size (4, 6, 8, 10) */
  dieType: number;
  /** flat hit points added after the Hit-Die cutoff level (no CON bonus) */
  bonus: number;
}

export interface ClassChassis {
  id: ClassId;
  name: string;
  group: ClassGroup;
  hitDie: 4 | 6 | 8 | 10;
  /** flat hp per level gained after `conBonusCutoffLevel` */
  hpAfterNameLevel: number;
  /** highest level that grants a rolled Hit Die and a CON hp bonus */
  conBonusCutoffLevel: number;
  primeRequisites: readonly AbilityKey[];
  abilityMinimums: Partial<Record<AbilityKey, number>>;
  /** cumulative XP to REACH each level; index 0 = level 1 (0 XP), index 19 = level 20 */
  xpThresholds: readonly number[];
  /** XP added per level beyond 20 */
  xpPerLevelBeyond20: number;
  weaponProficiencies: ProficiencySlotProgression;
  nonweaponProficiencies: ProficiencySlotProgression;
  /** attack-roll penalty for using a non-proficient weapon (negative) */
  nonProficiencyPenalty: number;
  casterType: "wizard" | "priest" | null;
  /** allowed armor categories; `["none"]` means no armor */
  armorAllowed: readonly string[];
  /** `"any"` or an explicit allow-list of weapon names */
  weaponsAllowed: "any" | readonly string[];
  weaponSpecializationAllowed: boolean;
  /**
   * Race id -> maximum attainable level (`null` = unlimited).
   * Placeholder for Plan 1b.2 — populated by the race plan. Currently `{}`.
   */
  raceLevelLimits: Readonly<Record<string, number | null>>;
}
```

- [ ] **Step 5: Create `src/core/classes/chassis.ts`**

XP thresholds from PHB Tables 14/20/23/25 (`references/research-notes.md`). Armor/weapon lists from the class descriptions.

```ts
// PHB Chapter 3 class descriptions + Table 13 (p.25), Table 14 (p.26),
// Table 20 (p.30), Table 23 (p.33), Table 25 (p.38), Table 34 (p.51).
import type { ClassChassis, ClassId } from "../types";

// prettier-ignore
const FIGHTER_XP: readonly number[] = [
  0, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000,
  750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000, 2750000, 3000000,
];
// prettier-ignore
const MAGE_XP: readonly number[] = [
  0, 2500, 5000, 10000, 20000, 40000, 60000, 90000, 135000, 250000,
  375000, 750000, 1125000, 1500000, 1875000, 2250000, 2625000, 3000000, 3375000, 3750000,
];
// prettier-ignore
const CLERIC_XP: readonly number[] = [
  0, 1500, 3000, 6000, 13000, 27500, 55000, 110000, 225000, 450000,
  675000, 900000, 1125000, 1350000, 1575000, 1800000, 2025000, 2250000, 2475000, 2700000,
];
// prettier-ignore
const THIEF_XP: readonly number[] = [
  0, 1250, 2500, 5000, 10000, 20000, 40000, 70000, 110000, 160000,
  220000, 440000, 660000, 880000, 1100000, 1320000, 1540000, 1760000, 1980000, 2200000,
];

const MAGE_WEAPONS = ["dagger", "staff", "dart", "knife", "sling"] as const;
const THIEF_WEAPONS = [
  "club", "dagger", "dart", "hand crossbow", "knife", "lasso", "short bow", "sling",
  "broad sword", "long sword", "short sword", "staff",
] as const;

export const FIGHTER: ClassChassis = {
  id: "fighter",
  name: "Fighter",
  group: "warrior",
  hitDie: 10,
  hpAfterNameLevel: 3,
  conBonusCutoffLevel: 9,
  primeRequisites: ["str"],
  abilityMinimums: { str: 9 },
  xpThresholds: FIGHTER_XP,
  xpPerLevelBeyond20: 250000,
  weaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
  nonProficiencyPenalty: -2,
  casterType: null,
  armorAllowed: ["any"],
  weaponsAllowed: "any",
  weaponSpecializationAllowed: true,
  raceLevelLimits: {},
};

export const MAGE: ClassChassis = {
  id: "mage",
  name: "Mage",
  group: "wizard",
  hitDie: 4,
  hpAfterNameLevel: 1,
  conBonusCutoffLevel: 10,
  primeRequisites: ["int"],
  abilityMinimums: { int: 9 },
  xpThresholds: MAGE_XP,
  xpPerLevelBeyond20: 375000,
  weaponProficiencies: { initial: 1, levelsPerSlot: 6 },
  nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonProficiencyPenalty: -5,
  casterType: "wizard",
  armorAllowed: ["none"],
  weaponsAllowed: [...MAGE_WEAPONS],
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
};

export const CLERIC: ClassChassis = {
  id: "cleric",
  name: "Cleric",
  group: "priest",
  hitDie: 8,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 9,
  primeRequisites: ["wis"],
  abilityMinimums: { wis: 9 },
  xpThresholds: CLERIC_XP,
  xpPerLevelBeyond20: 225000,
  weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
  nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonProficiencyPenalty: -3,
  casterType: "priest",
  armorAllowed: ["any"],
  weaponsAllowed: ["blunt"],
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
};

export const THIEF: ClassChassis = {
  id: "thief",
  name: "Thief",
  group: "rogue",
  hitDie: 6,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 10,
  primeRequisites: ["dex"],
  abilityMinimums: { dex: 9 },
  xpThresholds: THIEF_XP,
  xpPerLevelBeyond20: 220000,
  weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 4 },
  nonProficiencyPenalty: -3,
  casterType: null,
  armorAllowed: ["leather", "studded leather", "padded", "elven chain"],
  weaponsAllowed: [...THIEF_WEAPONS],
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
};

const BY_ID: Record<ClassId, ClassChassis> = {
  fighter: FIGHTER,
  mage: MAGE,
  cleric: CLERIC,
  thief: THIEF,
};

export function getChassis(id: ClassId): ClassChassis {
  return BY_ID[id];
}
```

- [ ] **Step 6: Create `src/core/classes/index.ts`**

```ts
export * from "./chassis";
```

- [ ] **Step 7: Update `src/core/index.ts`**

Add after the existing exports:

```ts
export * from "./classes";
```

(`./saves` is added in Task 4.)

- [ ] **Step 8: Run tests + gates**

Run: `npm run test -- tests/core/errors.test.ts tests/core/classes/chassis.test.ts` → PASS
Run: `npm run typecheck` (both `tsc` invocations) → clean
Run: `npm run lint` → clean
Run: `npm run test:coverage` → all pass, `src/core/**` still 100% lines/statements (chassis.ts is all literal data + one function, fully hit by the tests; `errors.ts` new functions covered by the appended cases).

- [ ] **Step 9: Commit**

```bash
git add src/core/types.ts src/core/errors.ts src/core/index.ts src/core/classes tests/core/errors.test.ts tests/core/classes/chassis.test.ts
git commit -m "feat(core): class chassis — Fighter/Mage/Cleric/Thief (PHB Tables 13-14, 20, 23, 25, 34)"
```

---

## Task 2: `progression.ts` — level, hit dice, proficiency slots, attacks/round

**Files:**
- Create: `src/core/classes/progression.ts`, `tests/core/classes/progression.test.ts`
- Modify: `src/core/classes/index.ts`

**Interfaces:**
- Consumes: `ClassChassis`, `HitDice` (Task 1); `assertLevel`, `assertXp` (Task 1).
- Produces:
  - `function levelForXp(chassis: ClassChassis, xp: number): number` — the character's level for a given total XP. `xp` 0 → level 1. Beyond the level-20 threshold, extrapolates with `chassis.xpPerLevelBeyond20`. Throws `RangeError` for negative/non-integer `xp`.
  - `function xpForLevel(chassis: ClassChassis, level: number): number` — cumulative XP to reach `level`. Throws for `level < 1`.
  - `function hitDice(chassis: ClassChassis, level: number): HitDice` — `{ count, dieType, bonus }`. At/below `conBonusCutoffLevel`: `count = level`, `bonus = 0`. Above: `count = conBonusCutoffLevel`, `bonus = (level - cutoff) * hpAfterNameLevel`.
  - `function warriorAttacksPerRound(level: number): { attacks: number; rounds: number }` — PHB Table 15. `1-6 → {1,1}`, `7-12 → {3,2}`, `13+ → {2,1}`. Warrior group only (caller's responsibility); the function just maps a level.
  - `function weaponProficiencySlots(chassis: ClassChassis, level: number): number` — `initial + floor(level / levelsPerSlot)`. Does **not** include weapon-specialization spending.
  - `function nonweaponProficiencySlots(chassis: ClassChassis, level: number): number` — same shape. Does **not** include the INT bonus-language slots (added by the caller).

- [ ] **Step 1: Failing test** — `tests/core/classes/progression.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  levelForXp, xpForLevel, hitDice, warriorAttacksPerRound,
  weaponProficiencySlots, nonweaponProficiencySlots,
} from "../../../src/core/classes/progression";
import { FIGHTER, MAGE, CLERIC, THIEF } from "../../../src/core/classes/chassis";

describe("levelForXp", () => {
  it("0 XP is level 1", () => {
    expect(levelForXp(FIGHTER, 0)).toBe(1);
  });
  it("exact thresholds and just-below", () => {
    expect(levelForXp(FIGHTER, 2000)).toBe(2);
    expect(levelForXp(FIGHTER, 1999)).toBe(1);
    expect(levelForXp(FIGHTER, 249999)).toBe(8);
    expect(levelForXp(FIGHTER, 250000)).toBe(9);
    expect(levelForXp(MAGE, 250000)).toBe(10);
    expect(levelForXp(CLERIC, 224999)).toBe(8);
    expect(levelForXp(THIEF, 160000)).toBe(10);
  });
  it("level 20 threshold and beyond (extrapolation)", () => {
    expect(levelForXp(FIGHTER, 3000000)).toBe(20);
    expect(levelForXp(FIGHTER, 3250000)).toBe(21); // +250000
    expect(levelForXp(FIGHTER, 3499999)).toBe(21);
    expect(levelForXp(FIGHTER, 3500000)).toBe(22);
    expect(levelForXp(MAGE, 3750000 + 375000 * 3)).toBe(23);
    expect(levelForXp(CLERIC, 2700000 + 225000)).toBe(21);
  });
  it("rejects invalid xp", () => {
    expect(() => levelForXp(FIGHTER, -1)).toThrow(RangeError);
    expect(() => levelForXp(FIGHTER, 10.5)).toThrow(RangeError);
  });
});

describe("xpForLevel", () => {
  it("table levels", () => {
    expect(xpForLevel(FIGHTER, 1)).toBe(0);
    expect(xpForLevel(FIGHTER, 2)).toBe(2000);
    expect(xpForLevel(FIGHTER, 20)).toBe(3000000);
    expect(xpForLevel(MAGE, 10)).toBe(250000);
  });
  it("beyond 20", () => {
    expect(xpForLevel(FIGHTER, 21)).toBe(3250000);
    expect(xpForLevel(FIGHTER, 25)).toBe(3000000 + 250000 * 5);
    expect(xpForLevel(THIEF, 22)).toBe(2200000 + 220000 * 2);
  });
  it("round-trips with levelForXp", () => {
    for (const lvl of [1, 5, 9, 13, 20, 21, 30]) {
      expect(levelForXp(FIGHTER, xpForLevel(FIGHTER, lvl))).toBe(lvl);
    }
  });
  it("rejects invalid level", () => {
    expect(() => xpForLevel(FIGHTER, 0)).toThrow(RangeError);
    expect(() => xpForLevel(FIGHTER, 2.5)).toThrow(RangeError);
  });
});

describe("hitDice", () => {
  it("below/at the cutoff: full dice, no bonus", () => {
    expect(hitDice(FIGHTER, 1)).toEqual({ count: 1, dieType: 10, bonus: 0 });
    expect(hitDice(FIGHTER, 9)).toEqual({ count: 9, dieType: 10, bonus: 0 });
    expect(hitDice(MAGE, 10)).toEqual({ count: 10, dieType: 4, bonus: 0 });
  });
  it("above the cutoff: capped dice + flat bonus", () => {
    expect(hitDice(FIGHTER, 10)).toEqual({ count: 9, dieType: 10, bonus: 3 });   // 9+3
    expect(hitDice(FIGHTER, 12)).toEqual({ count: 9, dieType: 10, bonus: 9 });   // 9+9
    expect(hitDice(FIGHTER, 20)).toEqual({ count: 9, dieType: 10, bonus: 33 });  // 9+33
    expect(hitDice(MAGE, 11)).toEqual({ count: 10, dieType: 4, bonus: 1 });      // 10+1
    expect(hitDice(MAGE, 20)).toEqual({ count: 10, dieType: 4, bonus: 10 });     // 10+10
    expect(hitDice(CLERIC, 10)).toEqual({ count: 9, dieType: 8, bonus: 2 });     // 9+2
    expect(hitDice(CLERIC, 20)).toEqual({ count: 9, dieType: 8, bonus: 22 });    // 9+22
    expect(hitDice(THIEF, 11)).toEqual({ count: 10, dieType: 6, bonus: 2 });     // 10+2
    expect(hitDice(THIEF, 20)).toEqual({ count: 10, dieType: 6, bonus: 20 });    // 10+20
  });
  it("rejects invalid level", () => {
    expect(() => hitDice(FIGHTER, 0)).toThrow(RangeError);
  });
});

describe("warriorAttacksPerRound", () => {
  it("PHB Table 15 bands", () => {
    expect(warriorAttacksPerRound(1)).toEqual({ attacks: 1, rounds: 1 });
    expect(warriorAttacksPerRound(6)).toEqual({ attacks: 1, rounds: 1 });
    expect(warriorAttacksPerRound(7)).toEqual({ attacks: 3, rounds: 2 });
    expect(warriorAttacksPerRound(12)).toEqual({ attacks: 3, rounds: 2 });
    expect(warriorAttacksPerRound(13)).toEqual({ attacks: 2, rounds: 1 });
    expect(warriorAttacksPerRound(30)).toEqual({ attacks: 2, rounds: 1 });
  });
  it("rejects invalid level", () => {
    expect(() => warriorAttacksPerRound(0)).toThrow(RangeError);
  });
});

describe("proficiency slots", () => {
  it("weapon slots — Table 34 gain rate", () => {
    expect(weaponProficiencySlots(FIGHTER, 1)).toBe(4);
    expect(weaponProficiencySlots(FIGHTER, 2)).toBe(4);
    expect(weaponProficiencySlots(FIGHTER, 3)).toBe(5);
    expect(weaponProficiencySlots(FIGHTER, 6)).toBe(6);
    expect(weaponProficiencySlots(FIGHTER, 9)).toBe(7);
    expect(weaponProficiencySlots(MAGE, 1)).toBe(1);
    expect(weaponProficiencySlots(MAGE, 6)).toBe(2);
    expect(weaponProficiencySlots(MAGE, 12)).toBe(3);
    expect(weaponProficiencySlots(CLERIC, 4)).toBe(3);
    expect(weaponProficiencySlots(THIEF, 4)).toBe(3);
    expect(weaponProficiencySlots(THIEF, 8)).toBe(4);
  });
  it("nonweapon slots", () => {
    expect(nonweaponProficiencySlots(FIGHTER, 1)).toBe(3);
    expect(nonweaponProficiencySlots(FIGHTER, 3)).toBe(4);
    expect(nonweaponProficiencySlots(MAGE, 1)).toBe(4);
    expect(nonweaponProficiencySlots(MAGE, 3)).toBe(5);
    expect(nonweaponProficiencySlots(THIEF, 4)).toBe(4);
    expect(nonweaponProficiencySlots(THIEF, 8)).toBe(5);
  });
  it("rejects invalid level", () => {
    expect(() => weaponProficiencySlots(FIGHTER, 0)).toThrow(RangeError);
    expect(() => nonweaponProficiencySlots(FIGHTER, -1)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**  `npm run test -- tests/core/classes/progression.test.ts`

- [ ] **Step 3: Implement** — `src/core/classes/progression.ts`

```ts
// PHB Tables 14/20/23/25 (XP + Hit Dice), Table 15 (warrior attacks), Table 34 (proficiency slots).
import { assertLevel, assertXp } from "../errors";
import type { ClassChassis, HitDice } from "../types";

const TABLE_MAX_LEVEL = 20;

export function xpForLevel(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  if (level <= TABLE_MAX_LEVEL) {
    return chassis.xpThresholds[level - 1];
  }
  return chassis.xpThresholds[TABLE_MAX_LEVEL - 1] + (level - TABLE_MAX_LEVEL) * chassis.xpPerLevelBeyond20;
}

export function levelForXp(chassis: ClassChassis, xp: number): number {
  assertXp(xp);
  const top = chassis.xpThresholds[TABLE_MAX_LEVEL - 1];
  if (xp >= top) {
    return TABLE_MAX_LEVEL + Math.floor((xp - top) / chassis.xpPerLevelBeyond20);
  }
  // highest table level whose threshold is <= xp
  let level = 1;
  for (let i = 1; i < TABLE_MAX_LEVEL; i++) {
    if (xp >= chassis.xpThresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export function hitDice(chassis: ClassChassis, level: number): HitDice {
  assertLevel(level, "class level");
  const cutoff = chassis.conBonusCutoffLevel;
  if (level <= cutoff) {
    return { count: level, dieType: chassis.hitDie, bonus: 0 };
  }
  return {
    count: cutoff,
    dieType: chassis.hitDie,
    bonus: (level - cutoff) * chassis.hpAfterNameLevel,
  };
}

export function warriorAttacksPerRound(level: number): { attacks: number; rounds: number } {
  assertLevel(level, "class level");
  if (level <= 6) return { attacks: 1, rounds: 1 };
  if (level <= 12) return { attacks: 3, rounds: 2 };
  return { attacks: 2, rounds: 1 };
}

export function weaponProficiencySlots(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  const { initial, levelsPerSlot } = chassis.weaponProficiencies;
  return initial + Math.floor(level / levelsPerSlot);
}

export function nonweaponProficiencySlots(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  const { initial, levelsPerSlot } = chassis.nonweaponProficiencies;
  return initial + Math.floor(level / levelsPerSlot);
}
```

- [ ] **Step 4: Update `src/core/classes/index.ts`**

```ts
export * from "./chassis";
export * from "./progression";
```

- [ ] **Step 5: Run — PASS.**  `npm run test -- tests/core/classes/progression.test.ts`

- [ ] **Step 6: Gates** — `npm run typecheck && npm run lint && npm run test:coverage` → all clean, `src/core/**` 100%.

- [ ] **Step 7: Commit**

```bash
git add src/core/classes/progression.ts src/core/classes/index.ts tests/core/classes/progression.test.ts
git commit -m "feat(core): class progression — levelForXp, hitDice, proficiency slots, attacks/round"
```

---

## Task 3: `thac0.ts` — THAC0 by group and level

**Files:**
- Create: `src/core/classes/thac0.ts`, `tests/core/classes/thac0.test.ts`
- Modify: `src/core/classes/index.ts`

**Interfaces:**
- Consumes: `ClassGroup` (types.ts), `assertLevel`.
- Produces: `function thac0(group: ClassGroup, level: number): number` — the "to hit AC 0" number. Levels 1–20 from PHB Table 53; beyond 20, the PHB Table 54 improvement rate (which the closed form below extends). Can return values ≤ 0 (warriors past level 20).

- [ ] **Step 1: Failing test** — `tests/core/classes/thac0.test.ts`

Literal Table 53 rows for the cross-check (from `references/research-notes.md`):

```ts
import { describe, expect, it } from "vitest";
import { thac0 } from "../../../src/core/classes/thac0";
import type { ClassGroup } from "../../../src/core/types";

// PHB Table 53, levels 1..20
const TABLE_53: Record<ClassGroup, number[]> = {
  priest:  [20, 20, 20, 18, 18, 18, 16, 16, 16, 14, 14, 14, 12, 12, 12, 10, 10, 10, 8, 8],
  rogue:   [20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11],
  warrior: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  wizard:  [20, 20, 20, 19, 19, 19, 18, 18, 18, 17, 17, 17, 16, 16, 16, 15, 15, 15, 14, 14],
};

describe("thac0()", () => {
  it("reproduces PHB Table 53 for every group, levels 1-20", () => {
    for (const group of Object.keys(TABLE_53) as ClassGroup[]) {
      for (let level = 1; level <= 20; level++) {
        expect(thac0(group, level)).toBe(TABLE_53[group][level - 1]);
      }
    }
  });

  it("all 1st-level characters have THAC0 20", () => {
    for (const g of ["priest", "rogue", "warrior", "wizard"] as ClassGroup[]) {
      expect(thac0(g, 1)).toBe(20);
    }
  });

  it("extends past level 20 by the Table 54 rate", () => {
    expect(thac0("warrior", 21)).toBe(0);   // 1/1
    expect(thac0("warrior", 25)).toBe(-4);
    expect(thac0("priest", 22)).toBe(6);    // 2/3, next step at level 22
    expect(thac0("priest", 21)).toBe(8);
    expect(thac0("rogue", 21)).toBe(11);    // 1/2, next step at 21
    expect(thac0("rogue", 22)).toBe(10);
    expect(thac0("wizard", 22)).toBe(13);   // 1/3, next step at 22
  });

  it("rejects invalid level", () => {
    expect(() => thac0("warrior", 0)).toThrow(RangeError);
    expect(() => thac0("warrior", 1.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/classes/thac0.ts`

The closed forms below are verified in `references/research-notes.md` to reproduce every Table 53 row (the test in Step 1 also asserts this).

```ts
// PHB Table 53: CALCULATED THAC0S (p.91) + Table 54: THAC0 ADVANCEMENT (p.91).
// Closed form per group reproduces Table 53 for levels 1-20 and extends past 20 at the
// Table 54 improvement rate. Verified against the literal table in the tests.
import { assertLevel } from "../errors";
import type { ClassGroup } from "../types";

export function thac0(group: ClassGroup, level: number): number {
  assertLevel(level, "class level");
  const n = level - 1;
  switch (group) {
    case "warrior":
      return 20 - n; // 1 point / level
    case "priest":
      return 20 - 2 * Math.floor(n / 3); // 2 points / 3 levels
    case "rogue":
      return 20 - Math.floor(n / 2); // 1 point / 2 levels
    case "wizard":
      return 20 - Math.floor(n / 3); // 1 point / 3 levels
  }
}
```

- [ ] **Step 4: Update `src/core/classes/index.ts`**

```ts
export * from "./chassis";
export * from "./progression";
export * from "./thac0";
```

- [ ] **Step 5: Run — PASS.**  **Step 6: Gates** (`typecheck && lint && test:coverage`, 100%).

- [ ] **Step 7: Commit**

```bash
git add src/core/classes/thac0.ts src/core/classes/index.ts tests/core/classes/thac0.test.ts
git commit -m "feat(core): thac0(group, level) — PHB Tables 53-54"
```

---

## Task 4: `saves/` — raw saving-throw target matrices

**Files:**
- Create: `src/core/saves/tables.ts`, `src/core/saves/index.ts`, `tests/core/saves/saves.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `ClassGroup`, `SaveCategory` (types.ts), `assertLevel`.
- Produces:
  - `const SAVE_MATRICES: Record<ClassGroup, readonly SaveBand[]>` where `SaveBand = { minLevel: number; ppd: number; rsw: number; pp: number; bw: number; spell: number }`, ordered ascending by `minLevel`.
  - `function saveBaseTarget(group: ClassGroup, level: number, category: SaveCategory): number` — the d20 target (roll ≥ this succeeds), **before** ability/racial/item modifiers (those are Plan 1b.3's composer). Picks the band with the greatest `minLevel <= level`. Requires `level >= 1` (throws otherwise); the `minLevel: 0` warrior band is retained in the data for future 0-level NPC support but is not reachable through this function at `level >= 1`.

- [ ] **Step 1: Failing test** — `tests/core/saves/saves.test.ts`

PHB Table 60, verbatim (`references/research-notes.md`). Column order: `[ppd, rsw, pp, bw, spell]`.

```ts
import { describe, expect, it } from "vitest";
import { SAVE_MATRICES, saveBaseTarget } from "../../../src/core/saves";
import type { ClassGroup, SaveCategory } from "../../../src/core/types";

const CATS: SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

// PHB Table 60 — [minLevel, ppd, rsw, pp, bw, spell]
const EXPECTED: Record<ClassGroup, number[][]> = {
  priest: [
    [1, 10, 14, 13, 16, 15],
    [4, 9, 13, 12, 15, 14],
    [7, 7, 11, 10, 13, 12],
    [10, 6, 10, 9, 12, 11],
    [13, 5, 9, 8, 11, 10],
    [16, 4, 8, 7, 10, 9],
    [19, 2, 6, 5, 8, 7],
  ],
  rogue: [
    [1, 13, 14, 12, 16, 15],
    [5, 12, 12, 11, 15, 13],
    [9, 11, 10, 10, 14, 11],
    [13, 10, 8, 9, 13, 9],
    [17, 9, 6, 8, 12, 7],
    [21, 8, 4, 7, 11, 5],
  ],
  warrior: [
    [0, 16, 18, 17, 20, 19],
    [1, 14, 16, 15, 17, 17],
    [3, 13, 15, 14, 16, 16],
    [5, 11, 13, 12, 13, 14],
    [7, 10, 12, 11, 12, 13],
    [9, 8, 10, 9, 9, 11],
    [11, 7, 9, 8, 8, 10],
    [13, 5, 7, 6, 5, 8],
    [15, 4, 6, 5, 4, 7],
    [17, 3, 5, 4, 4, 6],
  ],
  wizard: [
    [1, 14, 11, 13, 15, 12],
    [6, 13, 9, 11, 13, 10],
    [11, 11, 7, 9, 11, 8],
    [16, 10, 5, 7, 9, 6],
    [21, 8, 3, 5, 7, 4],
  ],
};

describe("SAVE_MATRICES", () => {
  it("matches PHB Table 60 exactly", () => {
    for (const group of Object.keys(EXPECTED) as ClassGroup[]) {
      const bands = SAVE_MATRICES[group];
      expect(bands.map((b) => [b.minLevel, b.ppd, b.rsw, b.pp, b.bw, b.spell])).toEqual(EXPECTED[group]);
    }
  });
});

describe("saveBaseTarget()", () => {
  it("selects the band by highest minLevel <= level", () => {
    expect(saveBaseTarget("priest", 1, "ppd")).toBe(10);
    expect(saveBaseTarget("priest", 3, "ppd")).toBe(10);
    expect(saveBaseTarget("priest", 4, "ppd")).toBe(9);
    expect(saveBaseTarget("priest", 19, "spell")).toBe(7);
    expect(saveBaseTarget("priest", 99, "spell")).toBe(7); // clamps to top band
    expect(saveBaseTarget("warrior", 1, "bw")).toBe(17);
    expect(saveBaseTarget("warrior", 2, "bw")).toBe(17);
    expect(saveBaseTarget("warrior", 3, "bw")).toBe(16);
    expect(saveBaseTarget("warrior", 13, "bw")).toBe(5);
    expect(saveBaseTarget("wizard", 5, "rsw")).toBe(11);
    expect(saveBaseTarget("wizard", 6, "rsw")).toBe(9);
    expect(saveBaseTarget("rogue", 21, "rsw")).toBe(4);
  });

  it("covers every category for a mid band", () => {
    const got = CATS.map((c) => saveBaseTarget("warrior", 10, c));
    expect(got).toEqual([8, 10, 9, 9, 11]); // warrior band minLevel 9
  });

  it("rejects invalid level", () => {
    expect(() => saveBaseTarget("warrior", 0, "ppd")).toThrow(RangeError);
    expect(() => saveBaseTarget("warrior", 2.5, "ppd")).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/saves/tables.ts`

```ts
// PHB Table 60: CHARACTER SAVING THROWS (p.101).
// Columns: ppd = Paralyzation/Poison/Death Magic, rsw = Rod/Staff/Wand,
// pp = Petrification/Polymorph, bw = Breath Weapon, spell = Spell.
// A band applies from minLevel up to (but not including) the next band's minLevel.
import type { ClassGroup } from "../types";

export interface SaveBand {
  minLevel: number;
  ppd: number;
  rsw: number;
  pp: number;
  bw: number;
  spell: number;
}

function band(minLevel: number, ppd: number, rsw: number, pp: number, bw: number, spell: number): SaveBand {
  return { minLevel, ppd, rsw, pp, bw, spell };
}

export const SAVE_MATRICES: Record<ClassGroup, readonly SaveBand[]> = {
  priest: [
    band(1, 10, 14, 13, 16, 15),
    band(4, 9, 13, 12, 15, 14),
    band(7, 7, 11, 10, 13, 12),
    band(10, 6, 10, 9, 12, 11),
    band(13, 5, 9, 8, 11, 10),
    band(16, 4, 8, 7, 10, 9),
    band(19, 2, 6, 5, 8, 7),
  ],
  rogue: [
    band(1, 13, 14, 12, 16, 15),
    band(5, 12, 12, 11, 15, 13),
    band(9, 11, 10, 10, 14, 11),
    band(13, 10, 8, 9, 13, 9),
    band(17, 9, 6, 8, 12, 7),
    band(21, 8, 4, 7, 11, 5),
  ],
  warrior: [
    band(0, 16, 18, 17, 20, 19),
    band(1, 14, 16, 15, 17, 17),
    band(3, 13, 15, 14, 16, 16),
    band(5, 11, 13, 12, 13, 14),
    band(7, 10, 12, 11, 12, 13),
    band(9, 8, 10, 9, 9, 11),
    band(11, 7, 9, 8, 8, 10),
    band(13, 5, 7, 6, 5, 8),
    band(15, 4, 6, 5, 4, 7),
    band(17, 3, 5, 4, 4, 6),
  ],
  wizard: [
    band(1, 14, 11, 13, 15, 12),
    band(6, 13, 9, 11, 13, 10),
    band(11, 11, 7, 9, 11, 8),
    band(16, 10, 5, 7, 9, 6),
    band(21, 8, 3, 5, 7, 4),
  ],
};
```

- [ ] **Step 4: Implement** — `src/core/saves/index.ts`

```ts
import { assertLevel } from "../errors";
import type { ClassGroup, SaveCategory } from "../types";
import { SAVE_MATRICES, type SaveBand } from "./tables";

export { SAVE_MATRICES };
export type { SaveBand };

/**
 * Raw d20 target for a saving throw (roll >= target succeeds), before any
 * ability / racial / item modifiers. Those are applied by the saves() composer
 * in a later plan.
 */
export function saveBaseTarget(group: ClassGroup, level: number, category: SaveCategory): number {
  assertLevel(level, "class level");
  const bands = SAVE_MATRICES[group];
  let chosen: SaveBand = bands[0];
  for (const b of bands) {
    if (b.minLevel <= level) {
      chosen = b;
    } else {
      break;
    }
  }
  return chosen[category];
}
```

- [ ] **Step 5: Update `src/core/index.ts`**

Add:

```ts
export * from "./saves";
```

- [ ] **Step 6: Run — PASS.**  **Step 7: Full gate** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0, `src/core/**` 100% lines/statements.

- [ ] **Step 8: Commit**

```bash
git add src/core/saves src/core/index.ts tests/core/saves/saves.test.ts
git commit -m "feat(core): saveBaseTarget(group, level, category) — PHB Table 60 matrices"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §4 `core/classes/chassis.ts` — class chassis type + data | Task 1 |
| §4 `core/classes/thac0.ts` — `thac0(chassis/group, level)` | Task 3 |
| §4 `core/classes/progression.ts` — `levelForXp`, `xpForLevel`, `hd` | Task 2 |
| §4 `core/saves/tables.ts` — per-class-group save matrices | Task 4 |
| §5.1 class level & XP represented via the chassis (`xpThresholds`, `levelForXp`) | Tasks 1–2 |
| §5.1 HP max inputs — Hit Dice by level incl. post-name-level flat hp | Task 2 (`hitDice`) |
| §5.1 proficiency slot totals from class progression | Task 2 (`weapon/nonweaponProficiencySlots`) — INT bonus added by caller |
| §9 Vitest, every table row asserted, 100% core coverage in CI | all tasks |
| §11 values transcribed from `references/` with citations | every file's header comment |

Out of scope for Plan 1b.2 (later plans): the `saves()` composer with ability/racial/item modifiers (1b.3); attack resolution & damage (1b.4); spell-slot tables (1b.5); weapon-specialization slot spending & thief-skill values (proficiencies plan); multi-/dual-class resolution; `raceLevelLimits` population (race plan); Paladin/Ranger/Druid/Bard/specialist chassis (1b.2b); turn-undead, class special abilities; the `data/` layer / sheets / `CONFIG.ADND2E`.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Every table's values are literal in the implementation step and independently restated in the test step. `raceLevelLimits: {}` is an intentional, documented empty placeholder (the field's shape is needed now; its data is a different plan).

**3. Type consistency:**
- `ClassGroup` / `AbilityKey` imported from `src/core/types.ts` (Plan 1b), never redefined.
- `ClassId`, `SaveCategory`, `ProficiencySlotProgression`, `HitDice`, `ClassChassis` defined once in `types.ts` (Task 1), imported by name in Tasks 2–4.
- `thac0(group, level)` takes a `ClassGroup` (Task 3) — consistent between its interface block, implementation, and the test. (Chassis callers pass `chassis.group`.)
- `hitDice` returns `HitDice` `{count, dieType, bonus}` — same shape in the type, the implementation, and every test assertion.
- `saveBaseTarget(group, level, category)` — three params, `SaveCategory` union, consistent Task 4 interface ↔ implementation ↔ test.
- `xpThresholds` indexing convention (`[level-1]`, length 20) stated in the type doc-comment and used identically in `chassis.ts` data and `progression.ts` (`xpForLevel`/`levelForXp`).
- `warriorAttacksPerRound` returns `{attacks, rounds}` — the plan uses this exact shape in the interface, implementation, and test (no drift to `{count, per}`).

**4. Coverage:** every new file is literal data + small pure functions. `chassis.ts` — `getChassis` + 4 constants, all hit by `chassis.test.ts`. `progression.ts` — all six functions + both `hitDice` branches + `levelForXp`'s table-scan and extrapolation branches covered. `thac0.ts` — all four `switch` arms covered by the "every group, levels 1-20" loop; the `assertLevel` throw covered. `saves/tables.ts` — pure data + `band()` helper (called at module load, so covered). `saves/index.ts` — `saveBaseTarget` band-scan loop, the `else break`, and the top-band clamp all covered. No `/* v8 ignore */` needed. If the branch metric dips below 90% the implementer adds the missing case (do not lower the threshold).

**5. THAC0 closed-form risk:** the closed forms are asserted against the full literal Table 53 (80 checks: 4 groups × 20 levels) in `thac0.test.ts` Step 1, so a transcription/derivation error fails the test rather than shipping silently. The `switch` has no `default`: TypeScript's control-flow analysis proves the four `case` arms exhaust `ClassGroup`, so the function type-checks as returning `number` on all paths, and adding a fifth group later becomes a compile error (no arm → possible `undefined` return). No unreachable `default` branch is added (it would be uncoverable and drop the branch metric).

No issues requiring rework.
