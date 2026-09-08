# AD&D 2E — Plan 1b.6: Proficiencies (Weapon Specialization + Non-weapon Checks + Thief Skills)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the proficiency layer to the framework-free `src/core/` engine: the weapon non-proficiency / related-weapon penalty and the fighter melee-specialization bonus (+1 hit / +2 damage) with its slot cost and single-class eligibility rule; the 1d20 non-weapon proficiency check (natural-20-always-fails, +1 per extra slot) with the group-crossover slot-cost rule; and the thief-skill resolver (base + racial + Dexterity + armor adjustments, the point budget, the 95% cap, backstab multiplier, and the pick-pockets detection threshold).

**Architecture:** Continues Plans 1b/1b.2/1b.3/1b.4/1b.5's pure `src/core/` engine (pure functions + literal lookup tables, no Foundry imports, enforced by `tsconfig.core.json` + ESLint, 100% Vitest coverage gate). Core is a **math layer**: callers pass resolved numbers (a class's `nonProficiencyPenalty`, an ability score, a d20 roll, allocated skill points) and the engine returns plain data. New: `src/core/proficiencies/` (`weapon.ts`, `nonweapon.ts`, `thief-skills.ts`). Feeds the `proficiencyModifier` / `specializationBonus` inputs that Plan 1b.4's `attackModifiers` / `damageModifiers` already accept.

**Tech Stack:** TypeScript 5 strict; Vitest 5 (`test:coverage` gate at 100% lines/statements/functions, ≥90% branches on `src/core/**`); ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §4 (`core/proficiencies/` — `weapon.ts`, `nonweapon.ts`), §5.6 step 9 (proficiency slot totals in the derived pipeline), §7 (`nonweapon-proficiencies` pack — the master list ships there, not here), §9 (testing), §11 (reference workflow).

**Research source:** `references/research-notes.md` (git-ignored) — section "PLAN 1b.6: PROFICIENCIES" — Tables 26/27/28/29/30 (thief skills), Table 34 (proficiency slots), Table 38 (group crossovers), and the weapon-specialization / NWP-check rules from the user's PHB Ch.5 pp.51-55 and Ch.3 pp.38-40, verified visually.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, the DOM, `fvtt-types`, or any relative path outside `src/core/`. Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `typecheck` gate and the `no-restricted-globals` / `no-restricted-imports` ESLint block on `src/core/**` + `tests/core/**`.
- **`src/core/proficiencies/` takes no runtime dependency on another core domain.** It may `import type` from `../types` and value-import the guards from `../errors`. It must NOT `import` (value) from `../abilities`, `../classes`, `../saves`, `../combat`, `../magic`. A class's non-proficiency penalty arrives as a plain number the caller reads from `ClassChassis.nonProficiencyPenalty`; ability scores arrive as plain numbers.
- Core functions return **plain data** (numbers, records, readonly arrays) — never a Foundry `Roll`.
- TypeScript `strict: true`. Prettier printWidth 100, 2-space, double quotes, semi, trailing-comma all. **Do not run `npm run format`.** Precede any hand-aligned table with `// prettier-ignore`.
- No copyrighted prose in the repo — mechanical/factual values only. Files with a table carry a `// PHB Table N, p.XX` citation comment.
- `src/core/**` stays at **100% lines / statements / functions** and **≥90% branches** (`npm run test:coverage`, enforced in CI). Every task's own tests must hold that.
- `AbilityKey`, `ClassId`, `Race` already exist in `src/core/types.ts`. `assertD20`, `assertAbilityScore(value, label)`, `assertLevel(value, label?)` already exist in `src/core/errors.ts`. Import, do not redefine.

## Proficiency semantics (from `references/research-notes.md` §"PLAN 1b.6")

- **Weapon proficiency penalty** (PHB p.52) — a proficient attacker has no modifier (the combat math assumes proficiency). A non-proficient attacker takes the class-group penalty (`ClassChassis.nonProficiencyPenalty`: warrior −2, wizard −5, priest −3, rogue −3). A **related** weapon takes half that penalty, rounded up toward zero-magnitude: `related = -ceil(|full| / 2)` → warrior −1, wizard −3, priest/rogue −2. "Which weapons are related is left to the DM" — the engine takes the mode.
- **Weapon specialization** (PHB p.52, optional rule) — **single-class fighters only** (`ClassChassis.weaponSpecializationAllowed` is `true` only for the fighter, AND the character must be single-class). Slot cost: a melee weapon or a crossbow costs 2 slots (1 to be proficient + 1 to specialize); any bow (not a crossbow) costs 3 slots. A **melee** specialist gets **+1 to every attack roll and +2 to every damage roll** with that weapon (on top of Strength and magic; these bonuses are not magical). Bow / crossbow specialization grants a point-blank range band and extra attacks per round — **deferred to Plan 1b.7** (needs weapon-category data); this plan's `weaponSpecializationEffect` returns `{ toHit: 0, damage: 0 }` for `"bow"` / `"crossbow"`.
- **Non-weapon proficiency check** (PHB p.55) — roll 1d20; success when `roll <= abilityScore + checkModifier + (slotsInvested - 1) + situationalModifier`. **A natural 20 always fails**; there is no "natural 1 always succeeds" rule. `checkModifier` is the Table-37 value for that proficiency (positive or negative). Each proficiency slot invested **beyond the first** adds +1 to the check ("For every additional proficiency slot … a +1 bonus"). `situationalModifier` is the DM's ad-hoc adjustment to the ability score.
- **NWP slot cost** (PHB p.54) — the Table-37 base cost if the proficiency's group is one of the character's class groups (Table 38), otherwise base cost + 1. The five groups: `general`, `warrior`, `wizard`, `priest`, `rogue`. Table 38 for the four base classes: fighter → {warrior, general}; mage → {wizard, general}; cleric → {priest, general}; thief → {rogue, general}.
- **Thief skills** (PHB pp.38-40) — the eight skills: pick pockets, open locks, find/remove traps, move silently, hide in shadows, detect noise, climb walls, read languages. A skill's score = Table 26 base + Table 27 racial adjustment + Table 28 Dexterity adjustment (only the first five skills; Dexterity outside 9-19 clamps to that range for the lookup) + Table 29 armor adjustment (armor categories: `none`, `leather` [the thief default — all zero], `elven-chain`, `padded-studded`) + points the player has allocated. **Hard cap 95%** including every adjustment; a computed score may be negative (the thief must raise it above 0 to use the skill — a caller gate). Point budget: 60 discretionary points at level 1, +30 per level after, so `60 + (level - 1) * 30` cumulative; per-skill caps (≤30 at level 1, ≤15 per level after) are a caller-side allocation-validity concern, exposed as constants.
- **Backstab** (PHB Table 30, p.40) — damage multiplier by thief level: 1-4 → ×2, 5-8 → ×3, 9-12 → ×4, 13+ → ×5. The multiplier applies to base weapon damage before Strength/magic; the full multiplier math is Plan 1b.7. This plan ships `backstabMultiplier(level)`.
- **Pick-pockets detection** (PHB p.39) — the victim notices the attempt when the thief's pick-pockets **roll** is `>= 100 - 3 * victimLevel`. Optional rule: if the thief's level exceeds the victim's, add `thiefLevel - victimLevel` to that threshold (harder to notice). A level-0 victim's threshold is 100.
- **Out of scope for Plan 1b.6** (later plans / sub-projects): Table 35 specialist attacks-per-round and bow/crossbow point-blank range (Plan 1b.7 — weapon categories); the ~70-entry Table 37 NWP master list (Plan 1c compendium pack + JSON importer — pure data, no logic); Table 36 Secondary Skills (DM-optional flavour roll); fighting-style specialization / weapon-and-shield styles (reserved, Plan 1b.7); "NA-check" passive proficiencies like Blind-fighting (data only — a caller never invokes `nonweaponCheck` for them); the backstab damage-total math (Plan 1b.7); multi-/dual-class proficiency-slot pooling (`progression/` plans); the `data/` layer / `CONFIG.ADND2E` (1c).

---

## File Structure

**Created:**
- `src/core/proficiencies/weapon.ts` — `weaponAttackPenalty`, `weaponSpecializationSlotCost`, `weaponSpecializationEffect`, `canWeaponSpecialize`.
- `src/core/proficiencies/nonweapon.ts` — `NonweaponGroup`, `CLASS_PROFICIENCY_GROUPS`, `nonweaponSlotCost`, `nonweaponCheck`.
- `src/core/proficiencies/thief-skills.ts` — the four adjustment tables + `thiefSkillBaseScore`, `resolveThiefSkill`, `thiefSkillPointsAvailable`, `THIEF_SKILL_POINT_RULES`, `backstabMultiplier`, `pickPocketsDetectionThreshold`.
- `src/core/proficiencies/index.ts` — barrel.
- `tests/core/proficiencies/weapon.test.ts`, `nonweapon.test.ts`, `thief-skills.test.ts`

**Modified:**
- `src/core/types.ts` — add `WeaponProficiencyMode`, `SpecializationCategory`, `NonweaponGroup`, `ThiefSkill`, `ThiefArmor`.
- `src/core/index.ts` — add `export * from "./proficiencies";`.
- `tests/core/index.test.ts` — extend the barrel smoke test with a proficiencies symbol.

---

## Task 1: shared types + `weapon.ts` + barrel wiring

**Files:**
- Modify: `src/core/types.ts`, `src/core/index.ts`
- Create: `src/core/proficiencies/weapon.ts`, `src/core/proficiencies/index.ts`, `tests/core/proficiencies/weapon.test.ts`

**Interfaces:**
- Consumes: nothing (pure arithmetic).
- Produces:
  - `type WeaponProficiencyMode = "proficient" | "related" | "non-proficient"`.
  - `type SpecializationCategory = "melee" | "crossbow" | "bow"`.
  - `function weaponAttackPenalty(nonProficiencyPenalty: number, mode: WeaponProficiencyMode): number` — `"proficient"` → `0`; `"non-proficient"` → `nonProficiencyPenalty` (already negative); `"related"` → `-Math.ceil(Math.abs(nonProficiencyPenalty) / 2)`.
  - `function weaponSpecializationSlotCost(category: SpecializationCategory): number` — `"melee"` → `2`, `"crossbow"` → `2`, `"bow"` → `3`.
  - `interface SpecializationEffect { toHit: number; damage: number }` and `function weaponSpecializationEffect(category: SpecializationCategory): SpecializationEffect` — `"melee"` → `{ toHit: 1, damage: 2 }`; `"crossbow"` and `"bow"` → `{ toHit: 0, damage: 0 }` (their point-blank bonus is Plan 1b.7).
  - `function canWeaponSpecialize(input: { specializationAllowed: boolean; isSingleClass: boolean }): boolean` — `input.specializationAllowed && input.isSingleClass`.

- [ ] **Step 1: Add the shared types to `src/core/types.ts`**

Append after the existing `SphereName` / `SpellSlots` block:

```ts
/** How well a character knows the weapon they are attacking with (PHB p.52). */
export type WeaponProficiencyMode = "proficient" | "related" | "non-proficient";

/** The weapon family a fighter specializes in (PHB p.52). */
export type SpecializationCategory = "melee" | "crossbow" | "bow";

/** A non-weapon proficiency's class group (PHB Table 37/38). */
export type NonweaponGroup = "general" | "warrior" | "wizard" | "priest" | "rogue";

/** The eight thieving skills (PHB Table 26). */
export type ThiefSkill =
  | "pick-pockets"
  | "open-locks"
  | "find-remove-traps"
  | "move-silently"
  | "hide-in-shadows"
  | "detect-noise"
  | "climb-walls"
  | "read-languages";

/**
 * Armor category for the thief-skill armor adjustment (PHB Table 29).
 * "leather" is the thief's default and applies no adjustment; "none" is used
 * for an unarmoured thief or one relying on bracers/cloak magic.
 */
export type ThiefArmor = "none" | "leather" | "elven-chain" | "padded-studded";
```

- [ ] **Step 2: Failing test** — `tests/core/proficiencies/weapon.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  weaponAttackPenalty,
  weaponSpecializationSlotCost,
  weaponSpecializationEffect,
  canWeaponSpecialize,
} from "../../../src/core/proficiencies/weapon";

describe("weaponAttackPenalty()", () => {
  it("proficient is no penalty", () => {
    expect(weaponAttackPenalty(-2, "proficient")).toBe(0);
    expect(weaponAttackPenalty(-5, "proficient")).toBe(0);
  });
  it("non-proficient is the full class penalty", () => {
    expect(weaponAttackPenalty(-2, "non-proficient")).toBe(-2); // warrior
    expect(weaponAttackPenalty(-5, "non-proficient")).toBe(-5); // wizard
    expect(weaponAttackPenalty(-3, "non-proficient")).toBe(-3); // priest / rogue
  });
  it("related weapon is half the penalty, rounded up toward zero magnitude", () => {
    expect(weaponAttackPenalty(-2, "related")).toBe(-1); // warrior
    expect(weaponAttackPenalty(-5, "related")).toBe(-3); // wizard: ceil(5/2) = 3
    expect(weaponAttackPenalty(-3, "related")).toBe(-2); // priest / rogue: ceil(3/2) = 2
  });
});

describe("weaponSpecializationSlotCost()", () => {
  it("melee and crossbow cost 2, any bow costs 3", () => {
    expect(weaponSpecializationSlotCost("melee")).toBe(2);
    expect(weaponSpecializationSlotCost("crossbow")).toBe(2);
    expect(weaponSpecializationSlotCost("bow")).toBe(3);
  });
});

describe("weaponSpecializationEffect()", () => {
  it("melee specialist gets +1 to hit and +2 damage", () => {
    expect(weaponSpecializationEffect("melee")).toEqual({ toHit: 1, damage: 2 });
  });
  it("bow and crossbow have no flat bonus here (point-blank is Plan 1b.7)", () => {
    expect(weaponSpecializationEffect("bow")).toEqual({ toHit: 0, damage: 0 });
    expect(weaponSpecializationEffect("crossbow")).toEqual({ toHit: 0, damage: 0 });
  });
});

describe("canWeaponSpecialize()", () => {
  it("only a single-class fighter (specialization-allowed) may specialize", () => {
    expect(canWeaponSpecialize({ specializationAllowed: true, isSingleClass: true })).toBe(true);
    expect(canWeaponSpecialize({ specializationAllowed: true, isSingleClass: false })).toBe(false);
    expect(canWeaponSpecialize({ specializationAllowed: false, isSingleClass: true })).toBe(false);
  });
});
```

- [ ] **Step 3: Run — FAIL.** `npm run test -- tests/core/proficiencies/weapon.test.ts`

- [ ] **Step 4: Implement** — `src/core/proficiencies/weapon.ts`

```ts
// PHB p.52: weapon proficiency penalties + fighter weapon specialization.
// Specialist attacks-per-round (Table 35) and bow/crossbow point-blank range
// are Plan 1b.7 (they need weapon-category data).
import type { SpecializationCategory, WeaponProficiencyMode } from "../types";

/**
 * The attack-roll modifier for a weapon the attacker is proficient / related /
 * not proficient with. `nonProficiencyPenalty` is the class-group value
 * (ClassChassis.nonProficiencyPenalty, already negative).
 */
export function weaponAttackPenalty(
  nonProficiencyPenalty: number,
  mode: WeaponProficiencyMode,
): number {
  if (mode === "proficient") return 0;
  if (mode === "non-proficient") return nonProficiencyPenalty;
  return -Math.ceil(Math.abs(nonProficiencyPenalty) / 2);
}

/** Proficiency slots to become proficient AND specialize (PHB p.52). */
export function weaponSpecializationSlotCost(category: SpecializationCategory): number {
  return category === "bow" ? 3 : 2;
}

export interface SpecializationEffect {
  toHit: number;
  damage: number;
}

/**
 * The flat attack/damage bonus a specialist gets. Melee: +1 / +2. Bow and
 * crossbow specialists get a point-blank range band instead — modelled in
 * Plan 1b.7 — so they return no flat bonus here.
 */
export function weaponSpecializationEffect(category: SpecializationCategory): SpecializationEffect {
  return category === "melee" ? { toHit: 1, damage: 2 } : { toHit: 0, damage: 0 };
}

/** Weapon specialization is available only to single-class fighters (PHB p.52). */
export function canWeaponSpecialize(input: {
  specializationAllowed: boolean;
  isSingleClass: boolean;
}): boolean {
  return input.specializationAllowed && input.isSingleClass;
}
```

- [ ] **Step 5: Create `src/core/proficiencies/index.ts`**

```ts
export * from "./weapon";
```

- [ ] **Step 6: Update `src/core/index.ts`**

Add at the end:

```ts
export * from "./proficiencies";
```

- [ ] **Step 7: Run tests + gates**

Run: `npm run test -- tests/core/proficiencies/weapon.test.ts` → PASS
Run: `npm run typecheck` (both `tsc` invocations) → clean
Run: `npm run lint` → clean
Run: `npm run test:coverage` → all pass; `src/core/**` 100%. Branch coverage: `weaponAttackPenalty`'s three arms; `weaponSpecializationSlotCost`'s ternary both sides; `weaponSpecializationEffect`'s ternary both sides; `canWeaponSpecialize`'s `&&` both sides.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/proficiencies/weapon.ts src/core/proficiencies/index.ts src/core/index.ts tests/core/proficiencies/weapon.test.ts
git commit -m "feat(core): weapon proficiency penalty + fighter specialization bonus (PHB p.52)"
```

---

## Task 2: `nonweapon.ts` — the 1d20 non-weapon proficiency check

**Files:**
- Create: `src/core/proficiencies/nonweapon.ts`, `tests/core/proficiencies/nonweapon.test.ts`
- Modify: `src/core/proficiencies/index.ts`

**Interfaces:**
- Consumes: `assertD20`, `assertAbilityScore`, `assertLevel` (`../errors`); `AbilityKey`, `ClassId`, `NonweaponGroup` (`../types`).
- Produces:
  - `const CLASS_PROFICIENCY_GROUPS: Readonly<Record<ClassId, readonly NonweaponGroup[]>>` — PHB Table 38 for the four base classes.
  - `function nonweaponSlotCost(baseCost: number, proficiencyGroup: NonweaponGroup, classId: ClassId): number` — `baseCost` if `proficiencyGroup` is in `CLASS_PROFICIENCY_GROUPS[classId]`, else `baseCost + 1`.
  - `interface NonweaponCheckInput { ability: AbilityKey; abilityScore: number; checkModifier: number; slotsInvested?: number; situationalModifier?: number; roll: number }` — `slotsInvested` defaults to `1` (guarded ≥ 1); `situationalModifier` defaults to `0`.
  - `interface NonweaponCheckResult { success: boolean; autoFail: boolean; target: number; roll: number }`
  - `function nonweaponCheck(input: NonweaponCheckInput): NonweaponCheckResult`
    - `assertD20(input.roll)`; `assertAbilityScore(input.abilityScore, input.ability)`; `assertLevel(slotsInvested, "slotsInvested")`.
    - `target = abilityScore + checkModifier + (slotsInvested - 1) + situationalModifier`.
    - `autoFail = roll === 20`.
    - `success = !autoFail && roll <= target`.

- [ ] **Step 1: Failing test** — `tests/core/proficiencies/nonweapon.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { CLASS_PROFICIENCY_GROUPS, nonweaponSlotCost, nonweaponCheck } from "../../../src/core/proficiencies/nonweapon";

describe("CLASS_PROFICIENCY_GROUPS (PHB Table 38)", () => {
  it("maps each base class to its groups, always including general", () => {
    expect(CLASS_PROFICIENCY_GROUPS.fighter).toEqual(["warrior", "general"]);
    expect(CLASS_PROFICIENCY_GROUPS.mage).toEqual(["wizard", "general"]);
    expect(CLASS_PROFICIENCY_GROUPS.cleric).toEqual(["priest", "general"]);
    expect(CLASS_PROFICIENCY_GROUPS.thief).toEqual(["rogue", "general"]);
  });
});

describe("nonweaponSlotCost()", () => {
  it("base cost for an in-group proficiency", () => {
    expect(nonweaponSlotCost(1, "general", "mage")).toBe(1);
    expect(nonweaponSlotCost(2, "wizard", "mage")).toBe(2);
  });
  it("one extra slot for an out-of-group proficiency", () => {
    expect(nonweaponSlotCost(1, "warrior", "mage")).toBe(2);
    expect(nonweaponSlotCost(2, "rogue", "cleric")).toBe(3);
  });
});

describe("nonweaponCheck()", () => {
  it("succeeds when the roll is at or under the adjusted ability score", () => {
    const r = nonweaponCheck({ ability: "wis", abilityScore: 14, checkModifier: -1, roll: 13 });
    expect(r).toEqual({ success: true, autoFail: false, target: 13, roll: 13 });
  });
  it("fails when the roll is over the target", () => {
    const r = nonweaponCheck({ ability: "wis", abilityScore: 14, checkModifier: -1, roll: 14 });
    expect(r).toMatchObject({ success: false, autoFail: false, target: 13 });
  });
  it("a natural 20 always fails, even when the target is 20+", () => {
    // Str 18, modifier +3, +3 situational -> target 24, but the natural 20 still fails
    const r = nonweaponCheck({
      ability: "str",
      abilityScore: 18,
      checkModifier: 3,
      situationalModifier: 3,
      roll: 20,
    });
    expect(r).toMatchObject({ success: false, autoFail: true, target: 24 });
  });
  it("each slot beyond the first adds +1 to the check", () => {
    // Str 15, modifier 0, 3 slots invested -> target 15 + 0 + 2 = 17
    const r = nonweaponCheck({ ability: "str", abilityScore: 15, checkModifier: 0, slotsInvested: 3, roll: 17 });
    expect(r).toMatchObject({ success: true, target: 17 });
  });
  it("the situational modifier adjusts the target", () => {
    const easier = nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, situationalModifier: 4, roll: 16 });
    expect(easier).toMatchObject({ success: true, target: 16 });
    const harder = nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, situationalModifier: -4, roll: 9 });
    expect(harder).toMatchObject({ success: false, target: 8 });
  });
  it("rejects a bad roll, ability score, or slot count", () => {
    expect(() => nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, roll: 21 })).toThrow(RangeError);
    expect(() => nonweaponCheck({ ability: "int", abilityScore: 0, checkModifier: 0, roll: 10 })).toThrow(RangeError);
    expect(() => nonweaponCheck({ ability: "int", abilityScore: 12, checkModifier: 0, slotsInvested: 0, roll: 10 })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/proficiencies/nonweapon.ts`

```ts
// PHB p.54-55: the 1d20 non-weapon proficiency check + the group-crossover
// slot-cost rule (Table 38). The ~70-entry Table 37 master list ships as a
// compendium pack / importer data in Plan 1c, not here.
import { assertAbilityScore, assertD20, assertLevel } from "../errors";
import type { AbilityKey, ClassId, NonweaponGroup } from "../types";

/** PHB Table 38 — the non-weapon proficiency groups each base class can pick from. */
// prettier-ignore
export const CLASS_PROFICIENCY_GROUPS: Readonly<Record<ClassId, readonly NonweaponGroup[]>> = {
  fighter: ["warrior", "general"],
  mage:    ["wizard", "general"],
  cleric:  ["priest", "general"],
  thief:   ["rogue", "general"],
};

/**
 * Proficiency slots a non-weapon proficiency costs: the Table-37 base cost when
 * its group is one of the class's groups, otherwise one slot more (PHB p.54).
 */
export function nonweaponSlotCost(
  baseCost: number,
  proficiencyGroup: NonweaponGroup,
  classId: ClassId,
): number {
  return CLASS_PROFICIENCY_GROUPS[classId].includes(proficiencyGroup) ? baseCost : baseCost + 1;
}

export interface NonweaponCheckInput {
  /** which ability governs this proficiency (PHB Table 37) */
  ability: AbilityKey;
  abilityScore: number;
  /** the Table-37 check modifier for this proficiency (may be negative) */
  checkModifier: number;
  /** total slots invested in the proficiency (>= 1); each beyond the first is +1 */
  slotsInvested?: number;
  /** the DM's ad-hoc adjustment to the ability score for this attempt */
  situationalModifier?: number;
  /** the 1d20 result */
  roll: number;
}

export interface NonweaponCheckResult {
  success: boolean;
  /** natural 20 — always a failure (PHB p.55) */
  autoFail: boolean;
  /** the number the roll must be at or under */
  target: number;
  roll: number;
}

export function nonweaponCheck(input: NonweaponCheckInput): NonweaponCheckResult {
  assertD20(input.roll);
  assertAbilityScore(input.abilityScore, input.ability);
  const slotsInvested = input.slotsInvested ?? 1;
  assertLevel(slotsInvested, "slotsInvested");

  const target =
    input.abilityScore + input.checkModifier + (slotsInvested - 1) + (input.situationalModifier ?? 0);
  const autoFail = input.roll === 20;
  return { success: !autoFail && input.roll <= target, autoFail, target, roll: input.roll };
}
```

- [ ] **Step 4: Update `src/core/proficiencies/index.ts`**

```ts
export * from "./weapon";
export * from "./nonweapon";
```

- [ ] **Step 5: Run — PASS.**  **Step 6: Gates** (`typecheck && lint && test:coverage`, 100%). Branch coverage: `includes(...)` ternary both sides; `slotsInvested ?? 1` both sides; `situationalModifier ?? 0` both sides; `autoFail` true/false; `!autoFail && roll <= target` — the natural-20 test hits `autoFail` true (short-circuit), the pass/fail tests hit `roll <= target` both ways.

- [ ] **Step 7: Commit**

```bash
git add src/core/proficiencies/nonweapon.ts src/core/proficiencies/index.ts tests/core/proficiencies/nonweapon.test.ts
git commit -m "feat(core): non-weapon proficiency check + group-crossover slot cost (PHB p.54-55)"
```

---

## Task 3: `thief-skills.ts` — thief-skill resolver, point budget, backstab, detection

**Files:**
- Create: `src/core/proficiencies/thief-skills.ts`, `tests/core/proficiencies/thief-skills.test.ts`
- Modify: `src/core/proficiencies/index.ts`, `tests/core/index.test.ts`

**Interfaces:**
- Consumes: `assertAbilityScore`, `assertLevel` (`../errors`); `Race`, `ThiefSkill`, `ThiefArmor` (`../types`).
- Produces:
  - `const THIEF_SKILLS: readonly ThiefSkill[]` — all eight, in Table 26 order.
  - `const THIEF_SKILL_BASE: Readonly<Record<ThiefSkill, number>>` — PHB Table 26.
  - `const THIEF_RACIAL_ADJUSTMENTS: Readonly<Record<Race, Readonly<Record<ThiefSkill, number>>>>` — PHB Table 27 (human = all `0`).
  - `const THIEF_DEXTERITY_ADJUSTMENTS: Readonly<Record<number, Partial<Record<ThiefSkill, number>>>>` — PHB Table 28, keyed by Dexterity 9-19; only the five affected skills appear per row.
  - `const THIEF_ARMOR_ADJUSTMENTS: Readonly<Record<ThiefArmor, Readonly<Record<ThiefSkill, number>>>>` — PHB Table 29 (`leather` = all `0`).
  - `const THIEF_SKILL_POINT_RULES: { level1Points: 60; pointsPerLevelAfter: 30; level1PerSkillCap: 30; perLevelPerSkillCap: 15; hardCap: 95 }`
  - `function thiefSkillPointsAvailable(level: number): number` — `60 + (level - 1) * 30`.
  - `function thiefSkillBaseScore(skill: ThiefSkill, input: { race: Race; dexterity: number; armor: ThiefArmor }): number` — Table 26 + Table 27 + Table 28 (Dexterity clamped to `[9, 19]` for the lookup; skills not in Table 28 contribute `0`) + Table 29. May be negative.
  - `function resolveThiefSkill(skill: ThiefSkill, input: { race: Race; dexterity: number; armor: ThiefArmor; allocatedPoints: number }): number` — `Math.min(THIEF_SKILL_POINT_RULES.hardCap, thiefSkillBaseScore(skill, input) + allocatedPoints)`. May be negative; never above 95.
  - `function backstabMultiplier(thiefLevel: number): number` — PHB Table 30: `1-4` → `2`, `5-8` → `3`, `9-12` → `4`, `13+` → `5`.
  - `function pickPocketsDetectionThreshold(victimLevel: number, options?: { thiefLevel: number }): number` — `100 - 3 * victimLevel`, plus `thiefLevel - victimLevel` when `options` is given and `options.thiefLevel > victimLevel`. `victimLevel` must be an integer `>= 0`.

- [ ] **Step 1: Failing test** — `tests/core/proficiencies/thief-skills.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  THIEF_SKILLS,
  THIEF_SKILL_BASE,
  THIEF_RACIAL_ADJUSTMENTS,
  THIEF_DEXTERITY_ADJUSTMENTS,
  THIEF_ARMOR_ADJUSTMENTS,
  THIEF_SKILL_POINT_RULES,
  thiefSkillPointsAvailable,
  thiefSkillBaseScore,
  resolveThiefSkill,
  backstabMultiplier,
  pickPocketsDetectionThreshold,
} from "../../../src/core/proficiencies/thief-skills";

describe("thief-skill tables", () => {
  it("Table 26 base scores", () => {
    expect(THIEF_SKILL_BASE).toEqual({
      "pick-pockets": 15,
      "open-locks": 10,
      "find-remove-traps": 5,
      "move-silently": 10,
      "hide-in-shadows": 5,
      "detect-noise": 15,
      "climb-walls": 60,
      "read-languages": 0,
    });
    expect(THIEF_SKILLS).toHaveLength(8);
  });
  it("Table 27 spot-checks (human is all zero)", () => {
    for (const skill of THIEF_SKILLS) expect(THIEF_RACIAL_ADJUSTMENTS.human[skill]).toBe(0);
    expect(THIEF_RACIAL_ADJUSTMENTS.dwarf["find-remove-traps"]).toBe(15);
    expect(THIEF_RACIAL_ADJUSTMENTS.halfling["hide-in-shadows"]).toBe(15);
    expect(THIEF_RACIAL_ADJUSTMENTS.gnome["climb-walls"]).toBe(-15);
  });
  it("Table 28 spot-checks (only five skills, DEX 13-15 all zero)", () => {
    expect(THIEF_DEXTERITY_ADJUSTMENTS[9]["move-silently"]).toBe(-20);
    expect(THIEF_DEXTERITY_ADJUSTMENTS[19]["open-locks"]).toBe(20);
    expect(THIEF_DEXTERITY_ADJUSTMENTS[13]["pick-pockets"] ?? 0).toBe(0);
    expect(THIEF_DEXTERITY_ADJUSTMENTS[16]["open-locks"]).toBe(5);
  });
  it("Table 29 spot-checks (leather is all zero)", () => {
    for (const skill of THIEF_SKILLS) expect(THIEF_ARMOR_ADJUSTMENTS.leather[skill]).toBe(0);
    expect(THIEF_ARMOR_ADJUSTMENTS.none["climb-walls"]).toBe(10);
    expect(THIEF_ARMOR_ADJUSTMENTS["padded-studded"]["pick-pockets"]).toBe(-30);
    expect(THIEF_ARMOR_ADJUSTMENTS["elven-chain"]["move-silently"]).toBe(-10);
  });
});

describe("thiefSkillPointsAvailable()", () => {
  it("60 at level 1, +30 per level after", () => {
    expect(thiefSkillPointsAvailable(1)).toBe(60);
    expect(thiefSkillPointsAvailable(2)).toBe(90);
    expect(thiefSkillPointsAvailable(10)).toBe(330);
  });
  it("exposes the per-skill caps", () => {
    expect(THIEF_SKILL_POINT_RULES).toEqual({
      level1Points: 60,
      pointsPerLevelAfter: 30,
      level1PerSkillCap: 30,
      perLevelPerSkillCap: 15,
      hardCap: 95,
    });
  });
});

describe("thiefSkillBaseScore()", () => {
  it("sums base + racial + dexterity + armor", () => {
    // halfling, DEX 17, leather: move-silently = 10 + 10 (race) + 5 (DEX 17) + 0 = 25
    expect(
      thiefSkillBaseScore("move-silently", { race: "halfling", dexterity: 17, armor: "leather" }),
    ).toBe(25);
  });
  it("skills outside Table 28 get no dexterity adjustment", () => {
    // climb-walls: 60 + 0 (human) + 0 (DEX not in table) + 10 (no armor) = 70
    expect(
      thiefSkillBaseScore("climb-walls", { race: "human", dexterity: 19, armor: "none" }),
    ).toBe(70);
  });
  it("clamps dexterity to [9, 19] for the adjustment lookup", () => {
    const at19 = thiefSkillBaseScore("open-locks", { race: "human", dexterity: 19, armor: "leather" });
    const at25 = thiefSkillBaseScore("open-locks", { race: "human", dexterity: 25, armor: "leather" });
    expect(at25).toBe(at19); // both use the DEX 19 row (+20) -> 10 + 20 = 30
    expect(at25).toBe(30);
  });
  it("can be negative (gnome climb walls in heavy leather)", () => {
    // 60 + (-15) race + 0 DEX + (-30) armor = 15 ... use padded-studded for a negative case:
    expect(
      thiefSkillBaseScore("pick-pockets", { race: "human", dexterity: 9, armor: "padded-studded" }),
    ).toBe(15 - 15 - 30); // 15 base, DEX 9 -15, armor -30 = -30
  });
});

describe("resolveThiefSkill()", () => {
  it("adds allocated points and caps at 95", () => {
    expect(
      resolveThiefSkill("climb-walls", { race: "human", dexterity: 15, armor: "leather", allocatedPoints: 20 }),
    ).toBe(80); // 60 + 20
    expect(
      resolveThiefSkill("climb-walls", { race: "human", dexterity: 15, armor: "leather", allocatedPoints: 50 }),
    ).toBe(95); // 60 + 50 = 110 -> cap 95
  });
  it("does not floor a negative score", () => {
    expect(
      resolveThiefSkill("pick-pockets", { race: "human", dexterity: 9, armor: "padded-studded", allocatedPoints: 0 }),
    ).toBe(-30);
  });
});

describe("backstabMultiplier()", () => {
  it("PHB Table 30 by level band", () => {
    expect(backstabMultiplier(1)).toBe(2);
    expect(backstabMultiplier(4)).toBe(2);
    expect(backstabMultiplier(5)).toBe(3);
    expect(backstabMultiplier(8)).toBe(3);
    expect(backstabMultiplier(9)).toBe(4);
    expect(backstabMultiplier(12)).toBe(4);
    expect(backstabMultiplier(13)).toBe(5);
    expect(backstabMultiplier(20)).toBe(5);
  });
  it("rejects a bad level", () => {
    expect(() => backstabMultiplier(0)).toThrow(RangeError);
  });
});

describe("pickPocketsDetectionThreshold()", () => {
  it("100 - 3x victim level", () => {
    expect(pickPocketsDetectionThreshold(0)).toBe(100);
    expect(pickPocketsDetectionThreshold(9)).toBe(73);
    expect(pickPocketsDetectionThreshold(13)).toBe(61);
  });
  it("optional rule: a higher-level thief is harder to notice", () => {
    expect(pickPocketsDetectionThreshold(9, { thiefLevel: 15 })).toBe(73 + 6);
    expect(pickPocketsDetectionThreshold(9, { thiefLevel: 9 })).toBe(73); // not higher -> no bonus
    expect(pickPocketsDetectionThreshold(9, { thiefLevel: 3 })).toBe(73); // lower -> no bonus
  });
  it("rejects a non-integer or negative victim level", () => {
    expect(() => pickPocketsDetectionThreshold(-1)).toThrow(RangeError);
    expect(() => pickPocketsDetectionThreshold(2.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/proficiencies/thief-skills.ts`

```ts
// PHB Ch.3 pp.38-40: thief skill base scores (Table 26), racial (Table 27),
// Dexterity (Table 28) and armor (Table 29) adjustments; the point budget;
// backstab multipliers (Table 30); and the pick-pockets detection threshold.
import { assertAbilityScore, assertLevel } from "../errors";
import type { Race, ThiefArmor, ThiefSkill } from "../types";

export const THIEF_SKILLS: readonly ThiefSkill[] = [
  "pick-pockets",
  "open-locks",
  "find-remove-traps",
  "move-silently",
  "hide-in-shadows",
  "detect-noise",
  "climb-walls",
  "read-languages",
];

/** PHB Table 26: THIEVING SKILL BASE SCORES (p.39). */
// prettier-ignore
export const THIEF_SKILL_BASE: Readonly<Record<ThiefSkill, number>> = {
  "pick-pockets": 15, "open-locks": 10, "find-remove-traps": 5, "move-silently": 10,
  "hide-in-shadows": 5, "detect-noise": 15, "climb-walls": 60, "read-languages": 0,
};

function racialRow(
  pp: number, ol: number, frt: number, ms: number, his: number, dn: number, cw: number, rl: number,
): Readonly<Record<ThiefSkill, number>> {
  return {
    "pick-pockets": pp, "open-locks": ol, "find-remove-traps": frt, "move-silently": ms,
    "hide-in-shadows": his, "detect-noise": dn, "climb-walls": cw, "read-languages": rl,
  };
}

/** PHB Table 27: THIEVING SKILL RACIAL ADJUSTMENTS (p.39). Human is all zero. */
// prettier-ignore
export const THIEF_RACIAL_ADJUSTMENTS: Readonly<Record<Race, Readonly<Record<ThiefSkill, number>>>> = {
  human:      racialRow(0, 0, 0, 0, 0, 0, 0, 0),
  dwarf:      racialRow(0, 10, 15, 0, 0, 0, -10, -5),
  elf:        racialRow(5, -5, 0, 5, 10, 5, 0, 0),
  gnome:      racialRow(0, 5, 10, 5, 5, 10, -15, 0),
  "half-elf": racialRow(10, 0, 0, 0, 5, 0, 0, 0),
  halfling:   racialRow(5, 5, 5, 10, 15, 5, -15, -5),
};

/**
 * PHB Table 28: THIEVING SKILL DEXTERITY ADJUSTMENTS (p.39). Keyed by Dexterity
 * 9-19; only the five affected skills appear. Rows for DEX 13-15 are empty (all
 * adjustments zero).
 */
// prettier-ignore
export const THIEF_DEXTERITY_ADJUSTMENTS: Readonly<
  Record<number, Partial<Record<ThiefSkill, number>>>
> = {
  9:  { "pick-pockets": -15, "open-locks": -10, "find-remove-traps": -10, "move-silently": -20, "hide-in-shadows": -10 },
  10: { "pick-pockets": -10, "open-locks": -5,  "find-remove-traps": -10, "move-silently": -15, "hide-in-shadows": -5 },
  11: { "pick-pockets": -5,  "open-locks": 0,   "find-remove-traps": -5,  "move-silently": -10, "hide-in-shadows": 0 },
  12: { "pick-pockets": 0,   "open-locks": 0,   "find-remove-traps": 0,   "move-silently": -5,  "hide-in-shadows": 0 },
  13: {},
  14: {},
  15: {},
  16: { "pick-pockets": 0,   "open-locks": 5,   "find-remove-traps": 0,   "move-silently": 0,   "hide-in-shadows": 0 },
  17: { "pick-pockets": 5,   "open-locks": 10,  "find-remove-traps": 0,   "move-silently": 5,   "hide-in-shadows": 5 },
  18: { "pick-pockets": 10,  "open-locks": 15,  "find-remove-traps": 5,   "move-silently": 10,  "hide-in-shadows": 10 },
  19: { "pick-pockets": 15,  "open-locks": 20,  "find-remove-traps": 10,  "move-silently": 15,  "hide-in-shadows": 15 },
};

function armorRow(
  pp: number, ol: number, frt: number, ms: number, his: number, dn: number, cw: number, rl: number,
): Readonly<Record<ThiefSkill, number>> {
  return {
    "pick-pockets": pp, "open-locks": ol, "find-remove-traps": frt, "move-silently": ms,
    "hide-in-shadows": his, "detect-noise": dn, "climb-walls": cw, "read-languages": rl,
  };
}

/** PHB Table 29: THIEVING SKILL ARMOR ADJUSTMENTS (p.39). "leather" is the thief default — all zero. */
// prettier-ignore
export const THIEF_ARMOR_ADJUSTMENTS: Readonly<Record<ThiefArmor, Readonly<Record<ThiefSkill, number>>>> = {
  none:              armorRow(5, 0, 0, 10, 5, 0, 10, 0),
  leather:           armorRow(0, 0, 0, 0, 0, 0, 0, 0),
  "elven-chain":     armorRow(-20, -5, -5, -10, -10, -5, -20, 0),
  "padded-studded":  armorRow(-30, -10, -10, -20, -20, -10, -30, 0),
};

export const THIEF_SKILL_POINT_RULES = {
  level1Points: 60,
  pointsPerLevelAfter: 30,
  level1PerSkillCap: 30,
  perLevelPerSkillCap: 15,
  hardCap: 95,
} as const;

const DEX_ADJ_MIN = 9;
const DEX_ADJ_MAX = 19;

/** Cumulative discretionary skill points a thief has by `level` (PHB p.38). */
export function thiefSkillPointsAvailable(level: number): number {
  assertLevel(level, "thief level");
  return THIEF_SKILL_POINT_RULES.level1Points + (level - 1) * THIEF_SKILL_POINT_RULES.pointsPerLevelAfter;
}

export interface ThiefSkillContext {
  race: Race;
  dexterity: number;
  armor: ThiefArmor;
}

/** Table 26 + Table 27 + Table 28 + Table 29. May be negative; no cap applied here. */
export function thiefSkillBaseScore(skill: ThiefSkill, input: ThiefSkillContext): number {
  assertAbilityScore(input.dexterity, "dex");
  const dexKey = Math.min(DEX_ADJ_MAX, Math.max(DEX_ADJ_MIN, input.dexterity));
  const dexAdj = THIEF_DEXTERITY_ADJUSTMENTS[dexKey][skill] ?? 0;
  return (
    THIEF_SKILL_BASE[skill] +
    THIEF_RACIAL_ADJUSTMENTS[input.race][skill] +
    dexAdj +
    THIEF_ARMOR_ADJUSTMENTS[input.armor][skill]
  );
}

/** The thief's effective skill percentage: base score + allocated points, capped at 95. */
export function resolveThiefSkill(
  skill: ThiefSkill,
  input: ThiefSkillContext & { allocatedPoints: number },
): number {
  return Math.min(THIEF_SKILL_POINT_RULES.hardCap, thiefSkillBaseScore(skill, input) + input.allocatedPoints);
}

/** PHB Table 30: BACKSTAB DAMAGE MULTIPLIERS (p.40). */
export function backstabMultiplier(thiefLevel: number): number {
  assertLevel(thiefLevel, "thief level");
  if (thiefLevel <= 4) return 2;
  if (thiefLevel <= 8) return 3;
  if (thiefLevel <= 12) return 4;
  return 5;
}

/**
 * The pick-pockets roll at or above which the victim notices the attempt
 * (PHB p.39). With `options`, a thief of higher level than the victim is
 * harder to notice by the level difference.
 */
export function pickPocketsDetectionThreshold(
  victimLevel: number,
  options?: { thiefLevel: number },
): number {
  if (!Number.isInteger(victimLevel) || victimLevel < 0) {
    throw new RangeError(`victim level must be an integer >= 0, got ${victimLevel}`);
  }
  let threshold = 100 - 3 * victimLevel;
  if (options && options.thiefLevel > victimLevel) {
    threshold += options.thiefLevel - victimLevel;
  }
  return threshold;
}
```

- [ ] **Step 4: Update `src/core/proficiencies/index.ts`**

```ts
export * from "./weapon";
export * from "./nonweapon";
export * from "./thief-skills";
```

- [ ] **Step 5: Extend the barrel smoke test** — `tests/core/index.test.ts`

Import `backstabMultiplier` from the barrel alongside the existing imports and add one assertion inside the existing `it(...)` block:

```ts
    expect(backstabMultiplier(10)).toBe(4);
```

- [ ] **Step 6: Run — PASS.**  **Step 7: Full gate** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0; `src/core/**` 100% lines/statements/functions, ≥90% branches. Branch coverage: `?? 0` in `thiefSkillBaseScore` (DEX 13-15 empty row hits the `?? 0`; a populated row hits the value); `Math.min`/`Math.max` DEX clamp at both bounds and inside; `Math.min` cap in `resolveThiefSkill` at and below 95; `backstabMultiplier`'s four bands; `pickPocketsDetectionThreshold` — the `!Number.isInteger || < 0` throw both sides, `options` present/absent, `options.thiefLevel > victimLevel` true/false.

- [ ] **Step 8: Commit**

```bash
git add src/core/proficiencies/thief-skills.ts src/core/proficiencies/index.ts tests/core/proficiencies/thief-skills.test.ts tests/core/index.test.ts
git commit -m "feat(core): thief-skill resolver + point budget + backstab (PHB Tables 26-30)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §4 `core/proficiencies/weapon.ts` — "slot totals from progression; specialization effects" | Task 1 (`weaponSpecializationSlotCost`, `weaponSpecializationEffect`; slot *totals* from class progression already exist in `classes/progression.ts` since 1b.2) |
| §4 `core/proficiencies/nonweapon.ts` — `checkTarget(governingAbility, modifier, options)` | Task 2 (`nonweaponCheck({ ability, abilityScore, checkModifier, ... })`) |
| §5.6 step 9 — proficiency slot totals in the derived pipeline | already delivered in 1b.2 (`weaponProficiencySlots` / `nonweaponProficiencySlots`); 1b.6 adds the *spending* rules (`nonweaponSlotCost`, `weaponSpecializationSlotCost`) |
| §7 `nonweapon-proficiencies` pack | **not** this plan — Table 37 ships as importer/compendium data in 1c; 1b.6 provides the check + cost mechanics it will use |
| §9 Vitest, PHB example values asserted, 100% core coverage in CI | all tasks |
| §11 values transcribed from `references/` with citations | file header comments in every `proficiencies/` file |

Out of scope for Plan 1b.6 (later plans / sub-projects): Table 35 specialist attacks-per-round and bow/crossbow point-blank range (Plan 1b.7); the ~70-entry Table 37 NWP master list (Plan 1c); Table 36 Secondary Skills; fighting-style / weapon-and-shield specialization (Plan 1b.7); "NA-check" passive proficiencies (data only); the backstab damage-total math (Plan 1b.7); multi-/dual-class proficiency-slot pooling; the `data/` layer / `CONFIG.ADND2E` (1c).

**2. Placeholder scan:** No "TBD" / "handle edge cases" / "similar to Task N". Every function body and every test assertion is literal. The four thief-skill tables appear as concrete records and are spot-checked cell-by-cell against the PHB in `thief-skills.test.ts` (base row exact, three racial cells, four Dexterity cells including an empty DEX-13 row, three armor cells). `weaponAttackPenalty`'s "related" cases are re-derived in the test (`ceil(5/2) = 3`, `ceil(3/2) = 2`). The 95% cap and the possibly-negative score are documented as behaviour with the PHB p.38 basis.

**3. Type consistency:**
- `WeaponProficiencyMode` / `SpecializationCategory` / `NonweaponGroup` / `ThiefSkill` / `ThiefArmor` — defined once in `types.ts` (Task 1); `weapon.ts` consumes the first two, `nonweapon.ts` the third, `thief-skills.ts` the last two. `ClassId` and `Race` are the existing unions.
- `CLASS_PROFICIENCY_GROUPS` keys are exactly the `ClassId` union (`fighter` / `mage` / `cleric` / `thief`); `nonweaponSlotCost` indexes it by `classId: ClassId`.
- `nonweaponCheck` — `NonweaponCheckInput` `{ ability, abilityScore, checkModifier, slotsInvested?, situationalModifier?, roll }` and `NonweaponCheckResult` `{ success, autoFail, target, roll }` are consistent interface ↔ implementation ↔ tests.
- `thiefSkillBaseScore` and `resolveThiefSkill` share the `ThiefSkillContext` `{ race, dexterity, armor }` shape (`resolveThiefSkill` intersects it with `{ allocatedPoints }`).
- `THIEF_SKILL_BASE` / `THIEF_RACIAL_ADJUSTMENTS[race]` / `THIEF_ARMOR_ADJUSTMENTS[armor]` are total `Record<ThiefSkill, number>`; `THIEF_DEXTERITY_ADJUSTMENTS[dex]` is `Partial<Record<ThiefSkill, number>>` (only five skills), hence the `?? 0` in `thiefSkillBaseScore`.

**4. Coverage:** every new file is small pure functions or `const` data.
- `weapon.ts` — `weaponAttackPenalty`'s `"proficient"` / `"non-proficient"` / `"related"` arms; both ternary sides of `weaponSpecializationSlotCost` and `weaponSpecializationEffect`; both `&&` operands of `canWeaponSpecialize` (the three test cases cover T/T, T/F, F/T).
- `nonweapon.ts` — `CLASS_PROFICIENCY_GROUPS` is `const` data; `includes(...)` ternary both sides; `?? 1` and `?? 0` both sides; `autoFail` true/false; `!autoFail && roll <= target` — natural-20 hits the `autoFail` short-circuit, the pass/fail tests hit `roll <= target` both ways; the three guard throws.
- `thief-skills.ts` — the table `const`s have no executable statements (`racialRow`/`armorRow` helpers are exercised by every table entry); `?? 0` both sides (empty DEX-13 row vs a populated row); the DEX clamp `Math.min`/`Math.max` at both ends and in-range; `resolveThiefSkill`'s `Math.min` at and below 95; `backstabMultiplier`'s four bands + the `assertLevel` throw; `pickPocketsDetectionThreshold`'s `!Number.isInteger(...) || ... < 0` (non-integer and negative both tested), `options` present/absent, `thiefLevel > victimLevel` true/false.
- No `/* v8 ignore */`. `proficiencies/index.ts` is an `export *` barrel (zero executable statements → 100% by construction).

**5. The rules easy to get wrong (all mirrored in `references/research-notes.md`):**
- **Related-weapon penalty rounds up in magnitude:** `-Math.ceil(Math.abs(p) / 2)`, so a wizard's −5 becomes −3 (not −2 or −2.5). The engine takes the mode; it does not decide which weapons are related (DM's call, PHB p.52).
- **A slot beyond the first adds `+1`, so the check bonus is `slotsInvested - 1`, not `slotsInvested`.** A proficiency held with the minimum one slot gets no bonus.
- **The thief-skill 95% cap is applied after every adjustment (race, Dexterity, armor, points); a raw score can be negative** and is not floored — the "raise it above 0 before using" rule is the caller's gate, not this engine's.
- **`leather` armor and `human` race are the zero baselines** — they appear explicitly in the tables (all-zero rows) rather than being absent, so `THIEF_ARMOR_ADJUSTMENTS` / `THIEF_RACIAL_ADJUSTMENTS` stay total `Record`s and no lookup can miss.

**6. Deviations from the spec (`docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md`):**
- Spec §4 sketches `nonweapon.ts` as `checkTarget(governingAbility, modifier, options)`. This plan uses `nonweaponCheck({ ability, abilityScore, checkModifier, slotsInvested?, situationalModifier?, roll })` returning `{ success, autoFail, target, roll }` — an object-parameter function matching the `saveTarget` / `armorClass` / `hitResult` / `wizardSpellSlots` convention the engine settled on, and it resolves the whole check (including the natural-20 rule and the roll) rather than only returning the target number, because the natural-20-always-fails rule is unrepresentable in a bare target.
- Spec §4 co-locates the tables in `core/tables/`. Plans 1b.2-1b.5 co-located each domain's tables with its logic; `thief-skills.ts` follows that. No separate `tables/` file.
- The Table 37 NWP master list is deferred to Plan 1c (compendium pack + importer) per the user's scope decision on 2026-09-08 — recorded here so a 1c author knows `nonweaponSlotCost` / `nonweaponCheck` expect `{ group, slots (base cost), ability, checkModifier }` per entry.

No issues requiring rework.
