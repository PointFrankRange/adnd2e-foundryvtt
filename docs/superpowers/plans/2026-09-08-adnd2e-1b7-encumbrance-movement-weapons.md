# AD&D 2E — Plan 1b.7: Encumbrance, Movement & Weapon Finish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the last of the framework-free `src/core/` math: the optional encumbrance system (category + Table-48 modified movement + the resulting combat penalties), race base movement, and the weapon-specialization finish carried forward from Plan 1b.6 — Table 35 specialist attacks-per-round, the bow/crossbow point-blank bonus, the `WeaponData` shape, and `resolveWeaponAttackInputs` / `selectDamageDice` that turn a weapon + abilities + attack context into the modifier inputs Plan 1b.4's `attackModifiers` / `damageModifiers` already accept.

**Architecture:** Continues Plans 1b/1b.2–1b.6's pure `src/core/` engine (pure functions + literal lookup tables, no Foundry imports, enforced by `tsconfig.core.json` + ESLint, 100% Vitest coverage gate). Core is a **math layer**: callers pass resolved numbers (a Strength score's `weightAllowance` / `maxPress`, a base move, a carried weight, derived ability adjustments) and the engine returns plain data. New: `src/core/encumbrance/` (`weight-allowance.ts`, `movement.ts`) and `src/core/weapons/` (`data.ts`, `specialist-attacks.ts`, `attack-inputs.ts`). Modifies `src/core/proficiencies/weapon.ts` (`SpecializationEffect` gains a field — a change Plan 1b.6's carry-forward explicitly requires).

**Tech Stack:** TypeScript 5 strict; Vitest 5 (`test:coverage` gate at 100% lines/statements/functions, ≥90% branches on `src/core/**`); ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §4 (`core/encumbrance/` — `weight-allowance.ts`, `movement.ts`; `core/proficiencies/weapon.ts` — "specialization effects"), §5.6 step 10 (encumbrance in the derived pipeline), §5.1 (`thac0` includes specialization), §7 (`weapon` item — the ~70 concrete weapons ship there in 1c, not here), §9, §11 (`movementRate(12, carried, allowance, plateArmor, {}).category === "moderate"` — see Deviations).

**Research source:** `references/research-notes.md` (git-ignored) — section "PLAN 1b.7: ENCUMBRANCE + MOVEMENT + WEAPON FINISH" — Tables 47/48/64 (encumbrance / modified movement / base movement), Table 35 (specialist attacks), the p.79 "Effects of Encumbrance" combat-penalty rules, and the STR/DEX-by-attack-mode rules, from the user's PHB Ch.6 pp.76–79, Ch.14 p.119, Ch.5 p.52, Ch.9 p.91, verified visually.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, the DOM, `fvtt-types`, or any relative path outside `src/core/`. Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `typecheck` gate and the `no-restricted-globals` / `no-restricted-imports` ESLint block on `src/core/**` + `tests/core/**`.
- **`src/core/encumbrance/` and `src/core/weapons/` take no runtime dependency on another core domain.** They may `import type` from `../types` and value-import the guards from `../errors`. They must NOT `import` (value) from `../abilities`, `../classes`, `../saves`, `../combat`, `../magic`, `../proficiencies`. Strength's `weightAllowance` / `maxPress` and Dexterity's `missileAttackAdj` etc. arrive as plain numbers the caller reads from `strength()` / `dexterity()`. **Exception, Task 3 only:** `weapons/attack-inputs.ts` and `proficiencies/weapon.ts` reference each other's *types* — resolve by keeping the shared type (`SpecializationCategory`, already in `../types`) in `../types`; no value import crosses.
- Core functions return **plain data** (numbers, records, readonly arrays) — never a Foundry `Roll`.
- TypeScript `strict: true`. Prettier printWidth 100, 2-space, double quotes, semi, trailing-comma all. **Do not run `npm run format`.** Precede any hand-aligned table with `// prettier-ignore`.
- No copyrighted prose in the repo — mechanical/factual values only. Files with a table carry a `// PHB Table N, p.XX` citation comment.
- `src/core/**` stays at **100% lines / statements / functions** and **≥90% branches** (`npm run test:coverage`, enforced in CI). Every task's own tests must hold that.
- `AbilityKey`, `ClassId`, `Race`, `SpecializationCategory`, `WeaponProficiencyMode` already exist in `src/core/types.ts`. `assertAbilityScore(value, label)`, `assertLevel(value, label?)`, `assertD20` already exist in `src/core/errors.ts`. `weaponSpecializationEffect` / `weaponSpecializationSlotCost` / `weaponAttackPenalty` / `canWeaponSpecialize` already exist in `src/core/proficiencies/weapon.ts`. Import / extend, do not redefine.

## Semantics (from `references/research-notes.md` §"PLAN 1b.7")

- **Encumbrance is an optional rule** with two variants. The engine implements both and the caller picks: `"category"` (basic — five categories with movement multipliers) or `"table48"` (specific — the exact Table-48 threshold lookup).
- **Table 47/48 are derivable, not transcribed.** A Strength score has a `weightAllowance` (= `strength().weightAllowance`, the unencumbered ceiling) and a `maxPress` (= `strength().maxPress`, the absolute carry cap). The twelve Table-48 thresholds are `threshold(i) = weightAllowance + i * encumbranceStep`, `i = 0..11`, where `encumbranceStep` is a small per-score value: `4-5 → 1`, `6-7 → 3`, `8-9 → 5`, `10-11 → 6`, `12-13 → 8`, `14-15 → 10`, `16 → 10`, `17 → 12`, `≥ 18 → 13` (plain 18 and every exceptional band all use 13). Verified exact against Table 47 for STR 18 and STR 18/51-75.
  - **Category boundaries** (Table 47): `unencumbered` when `carried ≤ weightAllowance`; `light` when `≤ threshold(3)`; `moderate` when `≤ threshold(6)`; `heavy` when `≤ threshold(9)`; `severe` when `≤ maxPress`; `immobile` when `> maxPress`.
  - **STR ≤ 3** is a sparse special case (a valid PC minimum for elf / human / half-elf). Its Table-48 row against the base-12 headers is: `carried ≤ 5 → move 12`, `≤ 6 → 10`, `≤ 7 → 8`, `≤ 8 → 5`, `≤ 9 → 3`, `> 9 → immobile`. Its Table-47 bands: `≤ 5` unencumbered, `= 6` light, `= 7` moderate, `8-9` heavy, `= 10` severe, `> 10` immobile. (`weightAllowance` 5, `maxPress` 10.) STR 1-2 are not valid PC scores; they reuse the STR-3 row.
  - **STR ≥ 19** has no PHB Table 47/48 row: use `encumbranceStep = 13` (matches every exceptional band) with `weightAllowance` / `maxPress` from `strength()`. Documented extrapolation.
- **Modified movement rate** (Table 48): find the smallest `i` in `0..11` with `carried <= threshold(i)` (thresholds are **inclusive ceilings** — a character carrying exactly `threshold(i)` moves at `HEADERS[tier][i]`, matching the PHB Tarus example where 140 lb uses the "145 column"); the rate is `HEADERS[tier][i]` where `tier` is `12` (`HEADERS[12] = [12,11,10,9,8,7,6,5,4,3,2,1]`) or `6` (`HEADERS[6] = [6,5,5,4,4,3,3,2,2,1,1,1]`). If `carried > threshold(11)` the character is staggering — rate `1`. If `carried > maxPress` — rate `0` (immobile). The `"category"` rule instead multiplies base move: `unencumbered → base`, `light → floor(base·2/3)`, `moderate → floor(base·1/2)`, `heavy → floor(base·1/3)`, `severe → 1`, `immobile → 0`.
- **Base movement** (Table 64): human 12, dwarf 6, elf 12, half-elf 12, gnome 6, halfling 6.
- **Encumbrance combat penalties** (PHB p.79) — a function of the *resulting* movement, not the category name: `currentMove === 1` and `< baseMove` → `{ attackRoll: -4, armorClass: 3 }`; else `currentMove / baseMove ≤ 1/3` → `{ -2, 1 }`; else `≤ 1/2` → `{ -1, 0 }`; else `{ 0, 0 }`. `armorClass` is additive to the AC number (positive = worse, same sign convention as Plan 1b.4's `situationalModifier`). Magical armor's weight does not count toward these effects — the caller passes the reduced carried weight.
- **Table 35 specialist attacks/round** (PHB p.52) — fighter weapon specialists only (already gated by `canWeaponSpecialize`). Columns by fighter level band: melee / light-crossbow / heavy-crossbow / thrown-dagger / thrown-dart / other-non-bow-missile. **Bow specialists get no extra attacks.** Values are `{ attacks, rounds }` (attacks per that many rounds):

  | Level | melee | light-xbow | heavy-xbow | thrown-dagger | thrown-dart | other-missile |
  |---|---|---|---|---|---|---|
  | 1–6 | 3/2 | 1/1 | 1/2 | 3/1 | 4/1 | 3/2 |
  | 7–12 | 2/1 | 3/2 | 1/1 | 4/1 | 5/1 | 2/1 |
  | 13+ | 5/2 | 2/1 | 3/2 | 5/1 | 6/1 | 5/2 |

- **Weapon specialization range effect** (PHB p.52) — the recorded 1b.6 carry-forward: `weaponSpecializationEffect` must change its return shape. `melee → { toHit: 1, damage: 2, pointBlankAttackBonus: 0 }`; `bow → { toHit: 0, damage: 0, pointBlankAttackBonus: 2 }`; `crossbow → { toHit: 0, damage: 0, pointBlankAttackBonus: 2 }`.
- **STR / DEX by attack mode** (PHB p.91) — for `resolveWeaponAttackInputs`:
  - `melee`: `strengthHitAdj = strHitProb`, `strengthDamageAdj = strDamageAdj`, `dexterityMissileAdj = 0`.
  - `thrown` (hurled — spear, axe, hammer, dagger, dart, javelin, sling): `strengthHitAdj = strHitProb`, `strengthDamageAdj = strDamageAdj`, `dexterityMissileAdj = dexMissileAdj`.
  - `fired`: `dexterityMissileAdj = dexMissileAdj`, `strengthDamageAdj = 0`, `strengthHitAdj = Math.min(0, strHitProb)` for a bow (penalties always apply, bonuses do not without a strength-bow), and `0` for a crossbow (neither).
- **`selectDamageDice(weapon, targetSize)`** — `targetSize === "L"` → `weapon.damageVsL`; `"S"` or `"M"` → `weapon.damageVsSM`.
- **Out of scope for Plan 1b.7** (later plans / sub-projects): the ~70-entry PHB weapon table (Plan 1c compendium pack + JSON importer — `WeaponData` shape ships now, the rows there); the armor data table (Plan 1c); Table 49 (animal carrying capacity) and Table 50 (stowage); initiative from `speedFactor` (Sub-project 3 — Core Combat); the strength-bow / composite-bow flag detail (a `WeaponData` boolean the caller sets — `resolveWeaponAttackInputs` takes a `strengthBow?` context flag); Player's Option: Combat & Tactics weapon-vs-armor and fighting styles; multi-/dual-class attack-per-round interactions; the `data/` layer / `CONFIG.ADND2E` (1c).

---

## File Structure

**Created:**
- `src/core/encumbrance/weight-allowance.ts` — `encumbranceStep`, `encumbranceThresholds`, `encumbranceCategory`, `maxCarriedWeight`.
- `src/core/encumbrance/movement.ts` — `BASE_MOVEMENT`, `modifiedMovementRate`, `encumbrancePenalty`.
- `src/core/encumbrance/index.ts` — barrel.
- `src/core/weapons/data.ts` — `WeaponData` interface + the `DamageType` / `WeaponSize` / `AttackMode` unions.
- `src/core/weapons/specialist-attacks.ts` — `SPECIALIST_ATTACKS_PER_ROUND`, `specialistAttacksPerRound`.
- `src/core/weapons/attack-inputs.ts` — `resolveWeaponAttackInputs`, `selectDamageDice`.
- `src/core/weapons/index.ts` — barrel.
- `tests/core/encumbrance/weight-allowance.test.ts`, `movement.test.ts`
- `tests/core/weapons/specialist-attacks.test.ts`, `attack-inputs.test.ts`

**Modified:**
- `src/core/types.ts` — add `EncumbranceCategory`, `EncumbranceRule`, `MovementTier`.
- `src/core/proficiencies/weapon.ts` — `SpecializationEffect` gains `pointBlankAttackBonus`; `weaponSpecializationEffect` returns it.
- `src/core/index.ts` — add `export * from "./encumbrance";` and `export * from "./weapons";`.
- `tests/core/proficiencies/weapon.test.ts` — update the `weaponSpecializationEffect` assertions for the new field.
- `tests/core/index.test.ts` — extend the barrel smoke test with an encumbrance and a weapons symbol.

---

## Task 1: shared types + `weight-allowance.ts` + barrel wiring

**Files:**
- Modify: `src/core/types.ts`, `src/core/index.ts`
- Create: `src/core/encumbrance/weight-allowance.ts`, `src/core/encumbrance/index.ts`, `tests/core/encumbrance/weight-allowance.test.ts`

**Interfaces:**
- Consumes: `assertAbilityScore` (`../errors`).
- Produces:
  - `type EncumbranceCategory = "unencumbered" | "light" | "moderate" | "heavy" | "severe" | "immobile"`.
  - `type EncumbranceRule = "category" | "table48"`.
  - `type MovementTier = 6 | 12`.
  - `function encumbranceStep(strengthScore: number): number` — `assertAbilityScore(strengthScore, "str")`; `≤ 3 → 5` (the STR-3 special step, unused by the threshold model but returned for completeness), `4-5 → 1`, `6-7 → 3`, `8-9 → 5`, `10-11 → 6`, `12-13 → 8`, `14-15 → 10`, `16 → 10`, `17 → 12`, `≥ 18 → 13`.
  - `function maxCarriedWeight(strengthMaxPress: number): number` — identity pass-through documenting that Table 47's "Max. Carried Weight" is `strength().maxPress`. (Kept as a named function so callers read intent, not `maxPress` directly.)
  - `interface EncumbranceInput { carried: number; strengthScore: number; weightAllowance: number; maxPress: number }`
  - `function encumbranceThresholds(input: Pick<EncumbranceInput, "strengthScore" | "weightAllowance">): readonly number[]` — twelve numbers `weightAllowance + i * encumbranceStep(strengthScore)`, `i = 0..11`. For `strengthScore ≤ 3` returns the STR-3 sparse ceiling list `[5, 6, 7, 8, 9]` (length 5) — callers of this function must handle the short length; `encumbranceCategory` does.
  - `function encumbranceCategory(input: EncumbranceInput): EncumbranceCategory` — STR ≤ 3: `≤ 5` unencumbered, `= 6` light, `= 7` moderate, `8-9` heavy, `= 10` severe, `> 10` immobile. STR ≥ 4: `≤ weightAllowance` unencumbered, `≤ threshold(3)` light, `≤ threshold(6)` moderate, `≤ threshold(9)` heavy, `≤ maxPress` severe, else immobile. `assertAbilityScore(strengthScore, "str")`; `carried` must be a number `≥ 0` (`RangeError` otherwise).

- [ ] **Step 1: Add the shared types to `src/core/types.ts`**

Append after the existing proficiency-type block:

```ts
/** Encumbrance category from carried weight vs. Strength (PHB Table 47). */
export type EncumbranceCategory =
  | "unencumbered"
  | "light"
  | "moderate"
  | "heavy"
  | "severe"
  | "immobile";

/** Which encumbrance variant a caller wants (PHB p.76-79). */
export type EncumbranceRule = "category" | "table48";

/** The two PC base-movement tiers Table 48 is written for (PHB Table 64). */
export type MovementTier = 6 | 12;
```

- [ ] **Step 2: Failing test** — `tests/core/encumbrance/weight-allowance.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  encumbranceStep,
  maxCarriedWeight,
  encumbranceThresholds,
  encumbranceCategory,
} from "../../../src/core/encumbrance/weight-allowance";

describe("encumbranceStep()", () => {
  it("matches the PHB per-score step (Tables 47/48)", () => {
    expect(encumbranceStep(4)).toBe(1);
    expect(encumbranceStep(5)).toBe(1);
    expect(encumbranceStep(7)).toBe(3);
    expect(encumbranceStep(9)).toBe(5);
    expect(encumbranceStep(11)).toBe(6);
    expect(encumbranceStep(13)).toBe(8);
    expect(encumbranceStep(15)).toBe(10);
    expect(encumbranceStep(16)).toBe(10);
    expect(encumbranceStep(17)).toBe(12);
    expect(encumbranceStep(18)).toBe(13);
    expect(encumbranceStep(19)).toBe(13); // extrapolated
    expect(encumbranceStep(3)).toBe(5); // special-case placeholder
  });
  it("rejects a bad score", () => {
    expect(() => encumbranceStep(0)).toThrow(RangeError);
    expect(() => encumbranceStep(26)).toThrow(RangeError);
  });
});

describe("maxCarriedWeight()", () => {
  it("is the Strength max press", () => {
    expect(maxCarriedWeight(255)).toBe(255);
  });
});

describe("encumbranceThresholds()", () => {
  it("STR 18 (allowance 110, step 13) — the twelve Table 48 columns", () => {
    expect(encumbranceThresholds({ strengthScore: 18, weightAllowance: 110 })).toEqual([
      110, 123, 136, 149, 162, 175, 188, 201, 214, 227, 240, 253,
    ]);
  });
  it("STR <= 3 returns the sparse ceiling list", () => {
    expect(encumbranceThresholds({ strengthScore: 3, weightAllowance: 5 })).toEqual([5, 6, 7, 8, 9]);
  });
});

describe("encumbranceCategory()", () => {
  const str18 = { strengthScore: 18, weightAllowance: 110, maxPress: 255 };
  it("STR 18 bands (PHB Table 47: 0-110 / 111-149 / 150-188 / 189-227 / 228-255)", () => {
    expect(encumbranceCategory({ ...str18, carried: 0 })).toBe("unencumbered");
    expect(encumbranceCategory({ ...str18, carried: 110 })).toBe("unencumbered");
    expect(encumbranceCategory({ ...str18, carried: 111 })).toBe("light");
    expect(encumbranceCategory({ ...str18, carried: 149 })).toBe("light");
    expect(encumbranceCategory({ ...str18, carried: 150 })).toBe("moderate");
    expect(encumbranceCategory({ ...str18, carried: 188 })).toBe("moderate");
    expect(encumbranceCategory({ ...str18, carried: 189 })).toBe("heavy");
    expect(encumbranceCategory({ ...str18, carried: 227 })).toBe("heavy");
    expect(encumbranceCategory({ ...str18, carried: 228 })).toBe("severe");
    expect(encumbranceCategory({ ...str18, carried: 255 })).toBe("severe");
    expect(encumbranceCategory({ ...str18, carried: 256 })).toBe("immobile");
  });
  it("STR <= 3 sparse bands (PHB Table 47: 0-5 / 6 / 7 / 8-9 / 10)", () => {
    const s3 = { strengthScore: 3, weightAllowance: 5, maxPress: 10 };
    expect(encumbranceCategory({ ...s3, carried: 5 })).toBe("unencumbered");
    expect(encumbranceCategory({ ...s3, carried: 6 })).toBe("light");
    expect(encumbranceCategory({ ...s3, carried: 7 })).toBe("moderate");
    expect(encumbranceCategory({ ...s3, carried: 8 })).toBe("heavy");
    expect(encumbranceCategory({ ...s3, carried: 9 })).toBe("heavy");
    expect(encumbranceCategory({ ...s3, carried: 10 })).toBe("severe");
    expect(encumbranceCategory({ ...s3, carried: 11 })).toBe("immobile");
  });
  it("rejects a negative carried weight or bad score", () => {
    expect(() => encumbranceCategory({ ...str18, carried: -1 })).toThrow(RangeError);
    expect(() => encumbranceCategory({ carried: 10, strengthScore: 0, weightAllowance: 5, maxPress: 10 })).toThrow(RangeError);
  });
});
```

- [ ] **Step 3: Run — expect failure.** `npm run test -- tests/core/encumbrance/weight-allowance.test.ts`

- [ ] **Step 4: Implement** — `src/core/encumbrance/weight-allowance.ts`

```ts
// PHB Tables 47/48 (p.76-78): character encumbrance. Both tables are derived
// from the Strength weight allowance / max press (Table 1) plus a small
// per-score step; only the step and the STR-3 sparse row are literal here.
import { assertAbilityScore } from "../errors";
import type { EncumbranceCategory } from "../types";

const THRESHOLD_COUNT = 12;
const STR3_CEILINGS: readonly number[] = [5, 6, 7, 8, 9];
const STR3_MAX = 3;

/** PHB Tables 47/48 per-score step. STR <= 3 is a sparse special case (step returned for completeness). */
export function encumbranceStep(strengthScore: number): number {
  assertAbilityScore(strengthScore, "str");
  if (strengthScore <= STR3_MAX) return 5;
  if (strengthScore <= 5) return 1;
  if (strengthScore <= 7) return 3;
  if (strengthScore <= 9) return 5;
  if (strengthScore <= 11) return 6;
  if (strengthScore <= 13) return 8;
  if (strengthScore <= 16) return 10; // PHB bands 14-15 and 16 both step 10
  if (strengthScore === 17) return 12;
  return 13; // 18 and every exceptional band; >= 19 extrapolated
}

/** Table 47's "Max. Carried Weight" is exactly the Strength max press (Table 1). */
export function maxCarriedWeight(strengthMaxPress: number): number {
  return strengthMaxPress;
}

export interface EncumbranceInput {
  /** total weight carried, in pounds (>= 0); magical armour weight excluded by the caller */
  carried: number;
  strengthScore: number;
  /** strength().weightAllowance — the unencumbered ceiling */
  weightAllowance: number;
  /** strength().maxPress — the absolute carry cap */
  maxPress: number;
}

/**
 * The twelve Table-48 weight thresholds, `weightAllowance + i * step`.
 * For STR <= 3 returns the five-entry sparse ceiling list instead.
 */
export function encumbranceThresholds(
  input: Pick<EncumbranceInput, "strengthScore" | "weightAllowance">,
): readonly number[] {
  assertAbilityScore(input.strengthScore, "str");
  if (input.strengthScore <= STR3_MAX) return STR3_CEILINGS;
  const step = encumbranceStep(input.strengthScore);
  return Array.from({ length: THRESHOLD_COUNT }, (_unused, i) => input.weightAllowance + i * step);
}

function str3Category(carried: number): EncumbranceCategory {
  if (carried <= 5) return "unencumbered";
  if (carried === 6) return "light";
  if (carried === 7) return "moderate";
  if (carried <= 9) return "heavy";
  if (carried === 10) return "severe";
  return "immobile";
}

/** The encumbrance category for `carried` weight at this Strength (PHB Table 47). */
export function encumbranceCategory(input: EncumbranceInput): EncumbranceCategory {
  assertAbilityScore(input.strengthScore, "str");
  if (!Number.isFinite(input.carried) || input.carried < 0) {
    throw new RangeError(`carried weight must be a number >= 0, got ${input.carried}`);
  }
  if (input.strengthScore <= STR3_MAX) return str3Category(input.carried);

  const t = encumbranceThresholds(input);
  if (input.carried <= input.weightAllowance) return "unencumbered";
  if (input.carried <= t[3]) return "light";
  if (input.carried <= t[6]) return "moderate";
  if (input.carried <= t[9]) return "heavy";
  if (input.carried <= input.maxPress) return "severe";
  return "immobile";
}
```

- [ ] **Step 5: Create `src/core/encumbrance/index.ts`**

```ts
export * from "./weight-allowance";
```

- [ ] **Step 6: Update `src/core/index.ts`**

Add at the end (keep `./weapons` for Task 3):

```ts
export * from "./encumbrance";
```

- [ ] **Step 7: Run tests + gates**

Run: `npm run test -- tests/core/encumbrance/weight-allowance.test.ts` → PASS
Run: `npm run typecheck` (both `tsc` invocations) → clean
Run: `npm run lint` → clean
Run: `npm run test:coverage` → all pass; `src/core/**` 100%. Branch coverage: every `if` arm of `encumbranceStep` (each score band + the `=== 16` / `=== 17` / fall-through), the `<= STR3_MAX` branch in all three functions, the `Number.isFinite || < 0` throw both sides, every band comparison in `encumbranceCategory` and `str3Category`.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/encumbrance/weight-allowance.ts src/core/encumbrance/index.ts src/core/index.ts tests/core/encumbrance/weight-allowance.test.ts
git commit -m "feat(core): encumbrance category + weight thresholds (PHB Tables 47/48)"
```

---

## Task 2: `movement.ts` — base movement, modified rate, combat penalty

**Files:**
- Create: `src/core/encumbrance/movement.ts`, `tests/core/encumbrance/movement.test.ts`
- Modify: `src/core/encumbrance/index.ts`

**Interfaces:**
- Consumes: `assertAbilityScore` (`../errors`); `encumbranceThresholds`, `encumbranceCategory` (`./weight-allowance`); `Race`, `EncumbranceCategory`, `EncumbranceRule`, `MovementTier` (`../types`).
- Produces:
  - `const BASE_MOVEMENT: Readonly<Record<Race, number>>` — PHB Table 64 (human 12, dwarf 6, elf 12, half-elf 12, gnome 6, halfling 6).
  - `interface MovementInput { baseMove: number; carried: number; strengthScore: number; weightAllowance: number; maxPress: number; rule: EncumbranceRule }`
  - `interface MovementResult { rate: number; category: EncumbranceCategory }`
  - `function modifiedMovementRate(input: MovementInput): MovementResult`
    - `category` = `encumbranceCategory({ carried, strengthScore, weightAllowance, maxPress })`.
    - `rule === "category"`: `rate` = `unencumbered → baseMove`, `light → Math.floor(baseMove * 2 / 3)`, `moderate → Math.floor(baseMove / 2)`, `heavy → Math.floor(baseMove / 3)`, `severe → 1`, `immobile → 0`.
    - `rule === "table48"`: `tier` = `baseMove >= 12 ? 12 : 6`; for STR ≤ 3 use the STR-3 row (`[12, 10, 8, 5, 3]` against ceilings `[5, 6, 7, 8, 9]`, scaled to the tier: a base-6 char is not a valid STR-3 PC, so tier is always 12 there — but guard by clamping the row values to `≤ baseMove`); otherwise find the smallest `i` with `threshold(i) > carried` and return `HEADERS[tier][i]`; `carried > threshold(11)` → `1`; `carried > maxPress` → `0`.
  - `function encumbrancePenalty(input: { baseMove: number; currentMove: number }): { attackRoll: number; armorClass: number }`
    - `currentMove === 1 && currentMove < baseMove` → `{ attackRoll: -4, armorClass: 3 }`.
    - else `currentMove / baseMove <= 1 / 3` → `{ -2, 1 }`.
    - else `currentMove / baseMove <= 1 / 2` → `{ -1, 0 }`.
    - else `{ 0, 0 }`.

- [ ] **Step 1: Failing test** — `tests/core/encumbrance/movement.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { BASE_MOVEMENT, modifiedMovementRate, encumbrancePenalty } from "../../../src/core/encumbrance/movement";

describe("BASE_MOVEMENT (PHB Table 64)", () => {
  it("is 12 for human/elf/half-elf, 6 for dwarf/gnome/halfling", () => {
    expect(BASE_MOVEMENT).toEqual({
      human: 12, elf: 12, "half-elf": 12, dwarf: 6, gnome: 6, halfling: 6,
    });
  });
});

describe("modifiedMovementRate() — category rule", () => {
  const base = { baseMove: 12, strengthScore: 18, weightAllowance: 110, maxPress: 255, rule: "category" as const };
  it("multiplies base move by the category fraction", () => {
    expect(modifiedMovementRate({ ...base, carried: 50 })).toEqual({ rate: 12, category: "unencumbered" });
    expect(modifiedMovementRate({ ...base, carried: 130 })).toEqual({ rate: 8, category: "light" }); // floor(12*2/3)
    expect(modifiedMovementRate({ ...base, carried: 170 })).toEqual({ rate: 6, category: "moderate" }); // floor(12/2)
    expect(modifiedMovementRate({ ...base, carried: 210 })).toEqual({ rate: 4, category: "heavy" }); // floor(12/3)
    expect(modifiedMovementRate({ ...base, carried: 250 })).toEqual({ rate: 1, category: "severe" });
    expect(modifiedMovementRate({ ...base, carried: 300 })).toEqual({ rate: 0, category: "immobile" });
  });
  it("base-6 race, light load", () => {
    expect(
      modifiedMovementRate({ baseMove: 6, strengthScore: 12, weightAllowance: 45, maxPress: 140, rule: "category", carried: 60 }),
    ).toEqual({ rate: 4, category: "light" }); // floor(6*2/3)
  });
});

describe("modifiedMovementRate() — table48 rule", () => {
  it("PHB Tarus example: base 12, STR 17 (allowance 85), 140 lbs -> rate 7", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 140, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(7); // thresholds 85,97,109,121,133,145,... first > 140 is 145 (index 5) -> HEADERS[12][5] = 7
  });
  it("unencumbered stays at base", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 10, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(12);
  });
  it("staggering (past the last threshold but within max press) -> 1", () => {
    // STR 17 threshold(11) = 85 + 11*12 = 217; maxPress 220
    const r = modifiedMovementRate({
      baseMove: 12, carried: 219, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(1);
  });
  it("over max press -> 0", () => {
    const r = modifiedMovementRate({
      baseMove: 12, carried: 221, strengthScore: 17, weightAllowance: 85, maxPress: 220, rule: "table48",
    });
    expect(r.rate).toBe(0);
  });
  it("base-6 tier uses the lower headers", () => {
    // STR 12 allowance 45 step 8: thresholds 45,53,61,...; carried 55 -> first > 55 is 61 (index 2) -> HEADERS[6][2] = 5
    const r = modifiedMovementRate({
      baseMove: 6, carried: 55, strengthScore: 12, weightAllowance: 45, maxPress: 140, rule: "table48",
    });
    expect(r.rate).toBe(5);
  });
  it("STR <= 3 sparse row", () => {
    const at6 = modifiedMovementRate({ baseMove: 12, carried: 6, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(at6.rate).toBe(10);
    const at9 = modifiedMovementRate({ baseMove: 12, carried: 9, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(at9.rate).toBe(3);
    const over = modifiedMovementRate({ baseMove: 12, carried: 11, strengthScore: 3, weightAllowance: 5, maxPress: 10, rule: "table48" });
    expect(over.rate).toBe(0);
  });
});

describe("encumbrancePenalty() (PHB p.79)", () => {
  it("no penalty above half move", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 8 })).toEqual({ attackRoll: 0, armorClass: 0 });
  });
  it("half move -> -1 attack", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 6 })).toEqual({ attackRoll: -1, armorClass: 0 });
  });
  it("a third or less -> -2 attack / +1 AC", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 4 })).toEqual({ attackRoll: -2, armorClass: 1 });
  });
  it("reduced to 1 -> -4 attack / +3 AC", () => {
    expect(encumbrancePenalty({ baseMove: 12, currentMove: 1 })).toEqual({ attackRoll: -4, armorClass: 3 });
  });
  it("a naturally slow (base 1) creature is not penalised", () => {
    expect(encumbrancePenalty({ baseMove: 1, currentMove: 1 })).toEqual({ attackRoll: 0, armorClass: 0 });
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/encumbrance/movement.ts`

```ts
// PHB Table 64 (p.119) base movement + Table 48 (p.78) modified movement +
// the p.79 "Effects of Encumbrance" combat penalties.
import type { EncumbranceCategory, EncumbranceRule, MovementTier, Race } from "../types";
import { encumbranceCategory, encumbranceThresholds } from "./weight-allowance";

/** PHB Table 64: BASE MOVEMENT RATES (p.119). */
// prettier-ignore
export const BASE_MOVEMENT: Readonly<Record<Race, number>> = {
  human: 12, dwarf: 6, elf: 12, "half-elf": 12, gnome: 6, halfling: 6,
};

// prettier-ignore
const HEADERS: Readonly<Record<MovementTier, readonly number[]>> = {
  12: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  6:  [6,  5,  5,  4, 4, 3, 3, 2, 2, 1, 1, 1],
};

// PHB Table 48 STR-3 row: carried ceilings -> base-12 move rate.
// prettier-ignore
const STR3_ROW: readonly { maxCarried: number; rate: number }[] = [
  { maxCarried: 5, rate: 12 },
  { maxCarried: 6, rate: 10 },
  { maxCarried: 7, rate: 8 },
  { maxCarried: 8, rate: 5 },
  { maxCarried: 9, rate: 3 },
];
const STR3_MAX = 3;

export interface MovementInput {
  baseMove: number;
  carried: number;
  strengthScore: number;
  weightAllowance: number;
  maxPress: number;
  rule: EncumbranceRule;
}

export interface MovementResult {
  rate: number;
  category: EncumbranceCategory;
}

const CATEGORY_RATE: Record<EncumbranceCategory, (base: number) => number> = {
  unencumbered: (base) => base,
  light: (base) => Math.floor((base * 2) / 3),
  moderate: (base) => Math.floor(base / 2),
  heavy: (base) => Math.floor(base / 3),
  severe: () => 1,
  immobile: () => 0,
};

function table48Rate(input: MovementInput): number {
  if (input.strengthScore <= STR3_MAX) {
    if (input.carried > input.maxPress) return 0;
    for (const entry of STR3_ROW) {
      if (input.carried <= entry.maxCarried) return Math.min(entry.rate, input.baseMove);
    }
    return input.baseMove <= 1 ? 0 : 1;
  }
  if (input.carried > input.maxPress) return 0;
  const tier: MovementTier = input.baseMove >= 12 ? 12 : 6;
  const thresholds = encumbranceThresholds(input);
  for (let i = 0; i < thresholds.length; i++) {
    if (input.carried <= thresholds[i]) return HEADERS[tier][i]; // inclusive ceiling
  }
  return 1; // staggering: past the last threshold but within max press
}

export function modifiedMovementRate(input: MovementInput): MovementResult {
  const category = encumbranceCategory({
    carried: input.carried,
    strengthScore: input.strengthScore,
    weightAllowance: input.weightAllowance,
    maxPress: input.maxPress,
  });
  const rate =
    input.rule === "category" ? CATEGORY_RATE[category](input.baseMove) : table48Rate(input);
  return { rate, category };
}

/**
 * The attack-roll and AC penalties from encumbrance, based on the *resulting*
 * movement rate (PHB p.79). `armorClass` is additive (positive = worse AC).
 */
export function encumbrancePenalty(input: {
  baseMove: number;
  currentMove: number;
}): { attackRoll: number; armorClass: number } {
  if (input.currentMove === 1 && input.currentMove < input.baseMove) {
    return { attackRoll: -4, armorClass: 3 };
  }
  const ratio = input.currentMove / input.baseMove;
  if (ratio <= 1 / 3) return { attackRoll: -2, armorClass: 1 };
  if (ratio <= 1 / 2) return { attackRoll: -1, armorClass: 0 };
  return { attackRoll: 0, armorClass: 0 };
}
```

- [ ] **Step 4: Update `src/core/encumbrance/index.ts`**

```ts
export * from "./weight-allowance";
export * from "./movement";
```

- [ ] **Step 5: Run — PASS.**  **Step 6: Gates** (`typecheck && lint && test:coverage`, 100%). Branch coverage: `CATEGORY_RATE` — every category key reached by the category-rule tests; `table48Rate` — the `strengthScore <= STR3_MAX` branch both sides, the STR-3 `carried > maxPress` / loop-hit / loop-miss arms, the non-STR3 `carried > maxPress` arm, the `baseMove >= 12` ternary both sides, the threshold loop hit and fall-through (staggering); `encumbrancePenalty` — the `currentMove === 1 && < baseMove` compound (true, and the base-1 false case), each `ratio <=` arm, and the no-penalty fall-through.

- [ ] **Step 7: Commit**

```bash
git add src/core/encumbrance/movement.ts src/core/encumbrance/index.ts tests/core/encumbrance/movement.test.ts
git commit -m "feat(core): modified movement rate + encumbrance combat penalty (PHB Tables 48/64, p.79)"
```

---

## Task 3: `weapons/` — specialist attacks, `WeaponData`, attack-input resolution; finish `weaponSpecializationEffect`

**Files:**
- Create: `src/core/weapons/data.ts`, `src/core/weapons/specialist-attacks.ts`, `src/core/weapons/attack-inputs.ts`, `src/core/weapons/index.ts`, `tests/core/weapons/specialist-attacks.test.ts`, `tests/core/weapons/attack-inputs.test.ts`
- Modify: `src/core/proficiencies/weapon.ts`, `src/core/index.ts`, `tests/core/proficiencies/weapon.test.ts`, `tests/core/index.test.ts`

**Interfaces:**
- Consumes: `assertLevel` (`../errors`); `SpecializationCategory` (`../types`).
- Produces:
  - **`data.ts`:**
    - `type WeaponSize = "S" | "M" | "L"`.
    - `type DamageType = "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning"`.
    - `type WeaponCategory = "melee" | "thrown" | "bow" | "crossbow"`.
    - `type AttackMode = "melee" | "thrown" | "fired"`.
    - `interface WeaponRange { short: number; medium: number; long: number }`
    - `interface WeaponData { name: string; category: WeaponCategory; damageVsSM: string | null; damageVsL: string | null; damageType: DamageType | null; speedFactor: number; weight: number; size: WeaponSize; rateOfFire: string | null; range: WeaponRange | null; proficiencyGroup: string; handsRequired: 1 | 2 }` — the damage triple is nullable because a bow/crossbow itself has no damage (the ammunition carries it).
    - `function selectDamageDice(weapon: Pick<WeaponData, "damageVsSM" | "damageVsL">, targetSize: WeaponSize): string | null` — `targetSize === "L" ? weapon.damageVsL : weapon.damageVsSM` (null for a bow/crossbow itself).
  - **`specialist-attacks.ts`:**
    - `type SpecialistWeaponClass = "melee" | "light-crossbow" | "heavy-crossbow" | "thrown-dagger" | "thrown-dart" | "other-missile"`.
    - `interface AttackRate { attacks: number; rounds: number }`
    - `const SPECIALIST_ATTACKS_PER_ROUND: Readonly<Record<"1-6" | "7-12" | "13+", Readonly<Record<SpecialistWeaponClass, AttackRate>>>>` — PHB Table 35.
    - `function specialistAttacksPerRound(fighterLevel: number, weaponClass: SpecialistWeaponClass): AttackRate` — `assertLevel(fighterLevel, "fighter level")`; band = `≤ 6 → "1-6"`, `≤ 12 → "7-12"`, else `"13+"`. Bow specialists get no extra attacks — a caller must not pass a bow; there is no `"bow"` member of `SpecialistWeaponClass`.
  - **`attack-inputs.ts`:**
    - `interface WeaponAbilityAdjustments { strengthHitProb: number; strengthDamageAdj: number; dexterityMissileAttackAdj: number }` — the caller reads these off `strength()` / `dexterity()`.
    - `interface AttackContext { attackMode: AttackMode; isCrossbow?: boolean; strengthBow?: boolean }`
    - `interface ResolvedAttackInputs { strengthHitAdj: number; dexterityMissileAdj: number; strengthDamageAdj: number }`
    - `function resolveWeaponAttackInputs(abilities: WeaponAbilityAdjustments, context: AttackContext): ResolvedAttackInputs`
      - `attackMode === "melee"`: `{ strengthHitAdj: strengthHitProb, dexterityMissileAdj: 0, strengthDamageAdj: strengthDamageAdj }`.
      - `attackMode === "thrown"`: `{ strengthHitAdj: strengthHitProb, dexterityMissileAdj: dexterityMissileAttackAdj, strengthDamageAdj: strengthDamageAdj }`.
      - `attackMode === "fired"`: `strengthDamageAdj: 0`, `dexterityMissileAdj: dexterityMissileAttackAdj`; `strengthHitAdj` = `0` when `context.isCrossbow`, else `context.strengthBow ? strengthHitProb : Math.min(0, strengthHitProb)`.
  - **`proficiencies/weapon.ts` change:** `interface SpecializationEffect { toHit: number; damage: number; pointBlankAttackBonus: number }`; `weaponSpecializationEffect` returns `melee → { toHit: 1, damage: 2, pointBlankAttackBonus: 0 }`, `bow`/`crossbow` → `{ toHit: 0, damage: 0, pointBlankAttackBonus: 2 }`.

- [ ] **Step 1: Failing tests**

`tests/core/weapons/specialist-attacks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SPECIALIST_ATTACKS_PER_ROUND, specialistAttacksPerRound } from "../../../src/core/weapons/specialist-attacks";

describe("SPECIALIST_ATTACKS_PER_ROUND (PHB Table 35)", () => {
  it("matches the table", () => {
    expect(SPECIALIST_ATTACKS_PER_ROUND["1-6"].melee).toEqual({ attacks: 3, rounds: 2 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["1-6"]["heavy-crossbow"]).toEqual({ attacks: 1, rounds: 2 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["7-12"].melee).toEqual({ attacks: 2, rounds: 1 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["7-12"]["thrown-dart"]).toEqual({ attacks: 5, rounds: 1 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["13+"].melee).toEqual({ attacks: 5, rounds: 2 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["13+"]["light-crossbow"]).toEqual({ attacks: 2, rounds: 1 });
    expect(SPECIALIST_ATTACKS_PER_ROUND["13+"]["other-missile"]).toEqual({ attacks: 5, rounds: 2 });
  });
});

describe("specialistAttacksPerRound()", () => {
  it("selects the level band", () => {
    expect(specialistAttacksPerRound(1, "melee")).toEqual({ attacks: 3, rounds: 2 });
    expect(specialistAttacksPerRound(6, "melee")).toEqual({ attacks: 3, rounds: 2 });
    expect(specialistAttacksPerRound(7, "melee")).toEqual({ attacks: 2, rounds: 1 });
    expect(specialistAttacksPerRound(12, "melee")).toEqual({ attacks: 2, rounds: 1 });
    expect(specialistAttacksPerRound(13, "melee")).toEqual({ attacks: 5, rounds: 2 });
    expect(specialistAttacksPerRound(20, "thrown-dagger")).toEqual({ attacks: 5, rounds: 1 });
  });
  it("rejects a bad level", () => {
    expect(() => specialistAttacksPerRound(0, "melee")).toThrow(RangeError);
  });
});
```

`tests/core/weapons/attack-inputs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveWeaponAttackInputs, selectDamageDice } from "../../../src/core/weapons/attack-inputs";

const strong = { strengthHitProb: 1, strengthDamageAdj: 3, dexterityMissileAttackAdj: 2 };
const weak = { strengthHitProb: -2, strengthDamageAdj: -1, dexterityMissileAttackAdj: 0 };

describe("resolveWeaponAttackInputs()", () => {
  it("melee: Strength hit + Strength damage, no Dexterity", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "melee" })).toEqual({
      strengthHitAdj: 1, dexterityMissileAdj: 0, strengthDamageAdj: 3,
    });
  });
  it("thrown: Strength hit + Strength damage + Dexterity missile", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "thrown" })).toEqual({
      strengthHitAdj: 1, dexterityMissileAdj: 2, strengthDamageAdj: 3,
    });
  });
  it("fired bow: Dexterity missile only; no Strength damage; Strength bonus withheld", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "fired" })).toEqual({
      strengthHitAdj: 0, dexterityMissileAdj: 2, strengthDamageAdj: 0,
    });
  });
  it("fired bow: a Strength penalty still applies", () => {
    expect(resolveWeaponAttackInputs(weak, { attackMode: "fired" })).toEqual({
      strengthHitAdj: -2, dexterityMissileAdj: 0, strengthDamageAdj: 0,
    });
  });
  it("fired strength-bow: the Strength bonus applies", () => {
    expect(resolveWeaponAttackInputs(strong, { attackMode: "fired", strengthBow: true }).strengthHitAdj).toBe(1);
  });
  it("fired crossbow: neither Strength bonus nor penalty", () => {
    expect(resolveWeaponAttackInputs(weak, { attackMode: "fired", isCrossbow: true }).strengthHitAdj).toBe(0);
  });
});

describe("selectDamageDice()", () => {
  it("picks the vs-L column for large targets, vs-S/M otherwise", () => {
    const w = { damageVsSM: "1d8", damageVsL: "2d6" };
    expect(selectDamageDice(w, "L")).toBe("2d6");
    expect(selectDamageDice(w, "M")).toBe("1d8");
    expect(selectDamageDice(w, "S")).toBe("1d8");
  });
});
```

Update `tests/core/proficiencies/weapon.test.ts` — the `weaponSpecializationEffect()` describe block:

```ts
  it("melee specialist gets +1 to hit and +2 damage, no point-blank bonus", () => {
    expect(weaponSpecializationEffect("melee")).toEqual({ toHit: 1, damage: 2, pointBlankAttackBonus: 0 });
  });
  it("bow and crossbow specialists get a +2 point-blank bonus, no flat bonus", () => {
    expect(weaponSpecializationEffect("bow")).toEqual({ toHit: 0, damage: 0, pointBlankAttackBonus: 2 });
    expect(weaponSpecializationEffect("crossbow")).toEqual({ toHit: 0, damage: 0, pointBlankAttackBonus: 2 });
  });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`src/core/weapons/data.ts`:

```ts
// The WeaponData shape consumed by the combat engine. The ~70 concrete PHB
// weapons ship as compendium / importer data in Plan 1c, not here.

export type WeaponSize = "S" | "M" | "L";

export type DamageType =
  | "slashing"
  | "piercing"
  | "bludgeoning"
  | "piercing-slashing"
  | "piercing-bludgeoning";

export type WeaponCategory = "melee" | "thrown" | "bow" | "crossbow";

/** How a weapon is being used for a given attack (governs Strength / Dexterity). */
export type AttackMode = "melee" | "thrown" | "fired";

export interface WeaponRange {
  short: number;
  medium: number;
  long: number;
}

export interface WeaponData {
  name: string;
  category: WeaponCategory;
  /**
   * Damage dice vs. Small/Medium targets, e.g. "1d8". `null` for a bow or
   * crossbow itself — the PHB weapon table shows "—" there; the ammunition
   * (arrow / quarrel) carries the damage and type.
   */
  damageVsSM: string | null;
  /** Damage dice vs. Large targets, e.g. "2d6"; `null` for a bow/crossbow itself. */
  damageVsL: string | null;
  /** `null` for a bow/crossbow itself — the ammunition carries the type. */
  damageType: DamageType | null;
  speedFactor: number;
  /** pounds */
  weight: number;
  size: WeaponSize;
  /** rate of fire, e.g. "1", "2", "3/2"; null for weapons with no RoF */
  rateOfFire: string | null;
  /** range increments, in yards (the PHB weapon-table unit); null for pure melee weapons */
  range: WeaponRange | null;
  proficiencyGroup: string;
  handsRequired: 1 | 2;
}

/**
 * The damage-dice string for a target of the given size (PHB weapon table
 * columns). Returns `null` for a weapon with no damage of its own (a bow /
 * crossbow — the caller resolves the ammunition's damage instead).
 */
export function selectDamageDice(
  weapon: Pick<WeaponData, "damageVsSM" | "damageVsL">,
  targetSize: WeaponSize,
): string | null {
  return targetSize === "L" ? weapon.damageVsL : weapon.damageVsSM;
}
```

`src/core/weapons/specialist-attacks.ts`:

```ts
// PHB Table 35: SPECIALIST ATTACKS PER ROUND (p.52). Fighter weapon specialists
// only (gated by proficiencies/weapon.ts canWeaponSpecialize). Bow specialists
// gain no extra attacks, so there is no "bow" weapon class here.
import { assertLevel } from "../errors";

export type SpecialistWeaponClass =
  | "melee"
  | "light-crossbow"
  | "heavy-crossbow"
  | "thrown-dagger"
  | "thrown-dart"
  | "other-missile";

export interface AttackRate {
  attacks: number;
  rounds: number;
}

function rate(attacks: number, rounds: number): AttackRate {
  return { attacks, rounds };
}

// prettier-ignore
export const SPECIALIST_ATTACKS_PER_ROUND: Readonly<
  Record<"1-6" | "7-12" | "13+", Readonly<Record<SpecialistWeaponClass, AttackRate>>>
> = {
  "1-6":  { melee: rate(3, 2), "light-crossbow": rate(1, 1), "heavy-crossbow": rate(1, 2), "thrown-dagger": rate(3, 1), "thrown-dart": rate(4, 1), "other-missile": rate(3, 2) },
  "7-12": { melee: rate(2, 1), "light-crossbow": rate(3, 2), "heavy-crossbow": rate(1, 1), "thrown-dagger": rate(4, 1), "thrown-dart": rate(5, 1), "other-missile": rate(2, 1) },
  "13+":  { melee: rate(5, 2), "light-crossbow": rate(2, 1), "heavy-crossbow": rate(3, 2), "thrown-dagger": rate(5, 1), "thrown-dart": rate(6, 1), "other-missile": rate(5, 2) },
};

export function specialistAttacksPerRound(
  fighterLevel: number,
  weaponClass: SpecialistWeaponClass,
): AttackRate {
  assertLevel(fighterLevel, "fighter level");
  const band = fighterLevel <= 6 ? "1-6" : fighterLevel <= 12 ? "7-12" : "13+";
  return SPECIALIST_ATTACKS_PER_ROUND[band][weaponClass];
}
```

`src/core/weapons/attack-inputs.ts`:

```ts
// PHB p.91: which of the Strength / Dexterity adjustments apply to an attack,
// by how the weapon is used. The engine takes the already-derived adjustment
// numbers (strength() / dexterity()) — it does not derive them.
import type { AttackMode } from "./data";

export interface WeaponAbilityAdjustments {
  /** strength().hitProb */
  strengthHitProb: number;
  /** strength().damageAdj */
  strengthDamageAdj: number;
  /** dexterity().missileAttackAdj */
  dexterityMissileAttackAdj: number;
}

export interface AttackContext {
  attackMode: AttackMode;
  /** a crossbow gets neither a Strength bonus nor a Strength penalty */
  isCrossbow?: boolean;
  /** a composite / strength bow: the Strength hit bonus applies */
  strengthBow?: boolean;
}

export interface ResolvedAttackInputs {
  strengthHitAdj: number;
  dexterityMissileAdj: number;
  strengthDamageAdj: number;
}

export function resolveWeaponAttackInputs(
  abilities: WeaponAbilityAdjustments,
  context: AttackContext,
): ResolvedAttackInputs {
  if (context.attackMode === "melee") {
    return {
      strengthHitAdj: abilities.strengthHitProb,
      dexterityMissileAdj: 0,
      strengthDamageAdj: abilities.strengthDamageAdj,
    };
  }
  if (context.attackMode === "thrown") {
    return {
      strengthHitAdj: abilities.strengthHitProb,
      dexterityMissileAdj: abilities.dexterityMissileAttackAdj,
      strengthDamageAdj: abilities.strengthDamageAdj,
    };
  }
  // fired
  let strengthHitAdj: number;
  if (context.isCrossbow) {
    strengthHitAdj = 0;
  } else if (context.strengthBow) {
    strengthHitAdj = abilities.strengthHitProb;
  } else {
    strengthHitAdj = Math.min(0, abilities.strengthHitProb);
  }
  return {
    strengthHitAdj,
    dexterityMissileAdj: abilities.dexterityMissileAttackAdj,
    strengthDamageAdj: 0,
  };
}
```

`src/core/weapons/index.ts`:

```ts
export * from "./data";
export * from "./specialist-attacks";
export * from "./attack-inputs";
```

Edit `src/core/proficiencies/weapon.ts` — the `SpecializationEffect` interface and `weaponSpecializationEffect`:

```ts
export interface SpecializationEffect {
  toHit: number;
  damage: number;
  /** the +2 point-blank attack bonus a bow/crossbow specialist gains (PHB p.52); 0 for melee */
  pointBlankAttackBonus: number;
}

/**
 * The flat attack/damage bonus a specialist gets, plus the point-blank bonus.
 * Melee: +1 / +2, no point-blank. Bow and crossbow: no flat bonus, +2 at
 * point-blank range (extra attacks per round for crossbows are Table 35 —
 * specialistAttacksPerRound in weapons/).
 */
export function weaponSpecializationEffect(category: SpecializationCategory): SpecializationEffect {
  return category === "melee"
    ? { toHit: 1, damage: 2, pointBlankAttackBonus: 0 }
    : { toHit: 0, damage: 0, pointBlankAttackBonus: 2 };
}
```

Update `src/core/index.ts` — add:

```ts
export * from "./weapons";
```

- [ ] **Step 4: Extend the barrel smoke test** — `tests/core/index.test.ts`

Import `encumbranceCategory` and `specialistAttacksPerRound` from the barrel alongside the existing imports and add inside the existing `it(...)` block:

```ts
    expect(
      encumbranceCategory({ carried: 0, strengthScore: 18, weightAllowance: 110, maxPress: 255 }),
    ).toBe("unencumbered");
    expect(specialistAttacksPerRound(1, "melee")).toEqual({ attacks: 3, rounds: 2 });
```

- [ ] **Step 5: Run — PASS.**  **Step 6: Full gate** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0; `src/core/**` 100% lines/statements/functions, ≥90% branches. Branch coverage: `specialistAttacksPerRound`'s two band ternaries (all three bands) + the `assertLevel` throw; `selectDamageDice`'s ternary both sides; `resolveWeaponAttackInputs`'s `melee` / `thrown` / `fired` arms and inside `fired` the `isCrossbow` / `strengthBow` / `Math.min` three-way (each hit by a named test); `weaponSpecializationEffect`'s ternary both sides (melee + bow/crossbow tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/weapons src/core/proficiencies/weapon.ts src/core/index.ts tests/core/weapons tests/core/proficiencies/weapon.test.ts tests/core/index.test.ts
git commit -m "feat(core): weapon data shape, specialist attacks, attack-input resolution (PHB Table 35, p.91)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §4 `core/encumbrance/weight-allowance.ts` — `allowance(strengthMods) -> {unencumbered, …, max}` | Task 1 (`encumbranceThresholds` + `encumbranceCategory` + `maxCarriedWeight`) |
| §4 `core/encumbrance/movement.ts` — `movementRate(baseMove, carried, allowance, armor, options)` | Task 2 (`modifiedMovementRate({ baseMove, carried, weightAllowance, maxPress, strengthScore, rule })` — see Deviations for the `armor` param) |
| §4 `core/proficiencies/weapon.ts` — "specialization effects" | Task 3 (`weaponSpecializationEffect` gains `pointBlankAttackBonus`) + `specialistAttacksPerRound` in `weapons/` |
| §5.6 step 10 — encumbrance in the derived pipeline (`weightAllowance` vs Σ item weight → category → `movementRate`) | Tasks 1, 2 (the `data/` layer wires it — 1c) |
| §5.1 `thac0` — "best of class tables + STR (melee) / DEX (ranged) + specialization" | Task 3 (`resolveWeaponAttackInputs` produces the STR/DEX inputs; specialization via `weaponSpecializationEffect`) |
| §7 `weapon` item fields | Task 3 (`WeaponData` — the shape; the ~70 rows are 1c compendium/importer data) |
| §9 Vitest, PHB example values (the Tarus movement example) asserted, 100% core coverage in CI | all tasks |
| §11 values transcribed from `references/` with citations | file header comments in every new file |

Out of scope for Plan 1b.7 (later plans / sub-projects): the ~70-entry PHB weapon table (Plan 1c); armor data table (Plan 1c); Table 49 / Table 50 (animals / stowage); initiative from `speedFactor` (Sub-project 3); C&T weapon-vs-armor and fighting styles; multi-/dual-class attack-rate interactions; the `data/` layer / `CONFIG.ADND2E` (1c).

**2. Placeholder scan:** No "TBD" / "handle edge cases" / "similar to Task N". Every function body and every test assertion is literal. The encumbrance model is proven against the PHB by re-deriving Table 47's STR-18 and STR-18/51-75 bands from `weightAllowance + i*step` in the semantics section and asserting the exact band boundaries in `weight-allowance.test.ts`. The Tarus movement example (PHB p.78: STR 17, 140 lbs → rate 7) is asserted in `movement.test.ts`. Table 35 is asserted cell-by-cell. The STR ≥ 19 extrapolation and the STR ≤ 3 sparse row are documented as such with the PHB basis.

**3. Type consistency:**
- `EncumbranceCategory` / `EncumbranceRule` / `MovementTier` — defined once in `types.ts` (Task 1); `weight-allowance.ts` returns `EncumbranceCategory`, `movement.ts` consumes all three.
- `MovementResult` `{ rate, category }` and `MovementInput` `{ baseMove, carried, strengthScore, weightAllowance, maxPress, rule }` — consistent interface ↔ implementation ↔ tests.
- `WeaponData` / `AttackMode` / `WeaponSize` — defined once in `weapons/data.ts`; `attack-inputs.ts` imports `AttackMode` (type-only) from `./data`.
- `SpecializationEffect` — the interface, `weaponSpecializationEffect`'s return, and every `toEqual` in `weapon.test.ts` all carry the three fields `{ toHit, damage, pointBlankAttackBonus }` after the Task 3 change.
- `SpecialistWeaponClass` deliberately has no `"bow"` member — bow specialists get no extra attacks (PHB p.52), so a caller cannot ask for a rate that does not exist.
- `AttackRate` `{ attacks, rounds }` is consistent across `SPECIALIST_ATTACKS_PER_ROUND`, `specialistAttacksPerRound`, and the tests.

**4. Coverage:** every new file is small pure functions or `const` data.
- `weight-allowance.ts` — `encumbranceStep`'s nine `if` bands + fall-through; the `<= STR3_MAX` branch in `encumbranceStep` / `encumbranceThresholds` / `encumbranceCategory`; the `Number.isFinite(...) || ... < 0` throw both sides; every band comparison in `encumbranceCategory` and `str3Category`; `Array.from` callback exercised by the STR-18 test.
- `movement.ts` — `BASE_MOVEMENT` is `const` data; `CATEGORY_RATE` every key (six category tests); `table48Rate` — `strengthScore <= STR3_MAX` both sides, the STR-3 `carried > maxPress` / loop-hit / loop-fall-through arms, the non-STR3 `carried > maxPress` arm, `baseMove >= 12` ternary both sides, the threshold loop hit and the staggering fall-through; `encumbrancePenalty` — the `currentMove === 1 && < baseMove` compound (true via the "reduced to 1" test, false-second-operand via the base-1 test), each `ratio <=` arm, the no-penalty fall-through.
- `data.ts` — `selectDamageDice` ternary both sides; the rest is types.
- `specialist-attacks.ts` — `SPECIALIST_ATTACKS_PER_ROUND` is `const` data (the `rate` helper is exercised by every entry); `specialistAttacksPerRound`'s two nested ternaries (all three bands via level 1/6/7/12/13/20) + the `assertLevel` throw.
- `attack-inputs.ts` — `resolveWeaponAttackInputs`'s three `attackMode` arms; inside `fired` the `isCrossbow` / `else if strengthBow` / `else Math.min` three-way, each with its own test; `Math.min(0, …)` both directions (the `weak` fired test → `-2`; the `strong` fired test → `0`).
- No `/* v8 ignore */`. `encumbrance/index.ts` and `weapons/index.ts` are `export *` barrels (zero executable statements → 100% by construction).

**5. The rules easy to get wrong (all mirrored in `references/research-notes.md`):**
- **Table 47/48 are one derived model, not two lookups.** The category boundaries *are* Table-48 columns 3/6/9; `severe`'s ceiling is `maxPress`, which is past Table 48's twelfth column. Getting `light`/`moderate`/`heavy` from `threshold(3)`/`threshold(6)`/`threshold(9)` (not `threshold(4)`/`threshold(7)`/`threshold(10)`) is the off-by-one to watch — verified against the STR-18 row where `threshold(3) = 149` is exactly Table 47's light ceiling.
- **The `"category"` movement multipliers floor, and `severe` is a flat `1`, not `floor(base/6)`.** Light `floor(base·2/3)`, moderate `floor(base/2)`, heavy `floor(base/3)`.
- **The combat penalty keys off the resulting move, not the category.** `currentMove === 1` is only `-4/+3` when it is *below* `baseMove` — a base-1 creature carrying nothing is unpenalised.
- **A thrown weapon gets both Strength (hit + damage) and Dexterity (hit).** A fired bow gets Dexterity hit only, a Strength *penalty* but not a Strength bonus (unless `strengthBow`), and no Strength damage. A fired crossbow gets neither Strength effect.
- **`selectDamageDice` splits at Large:** vs-S and vs-M both use `damageVsSM`; only vs-L uses `damageVsL`.

**6. Deviations from the spec (`docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md`):**
- Spec §4 / §11 sketch `movementRate(baseMove, carried, allowance, armor, options)` returning something with `.category`. This plan uses `modifiedMovementRate({ baseMove, carried, strengthScore, weightAllowance, maxPress, rule })` → `{ rate, category }`. The **`armor` parameter is dropped**: PHB 2E movement is purely encumbrance-based — armour slows a character only through its *weight* contributing to `carried` (PHB p.79; magical armour's weight is explicitly excluded from the effect, which the caller handles by passing a reduced `carried`). There is no separate armour movement penalty in the core rules (that is Combat & Tactics). `strengthScore` is passed because the `step` and the STR-3 special row need it; `weightAllowance` / `maxPress` come from `strength()`.
- Spec §4 sketch `allowance(strengthMods) -> {unencumbered, …, max}` returns a bundle; this plan splits it into `encumbranceThresholds` (the numbers), `encumbranceCategory` (the classification), and `maxCarriedWeight` — object-parameter functions matching the `saveTarget` / `armorClass` / `wizardSpellSlots` convention, and `encumbranceCategory` is what step 10 of the derived pipeline actually needs.
- Spec §4 co-locates tables in `core/tables/`; Plans 1b.2–1b.6 co-located each domain's tables with its logic — `encumbrance/` and `weapons/` follow that.
- `weaponSpecializationEffect`'s return type changes (`SpecializationEffect` gains `pointBlankAttackBonus`) — this is the explicit Plan 1b.6 carry-forward ("1b.7 must CHANGE the signature … do NOT quietly fill in the zeros"), recorded in memory and now discharged.
- The ~70 concrete weapons are deferred to Plan 1c per the user's 2026-09-08 scope decision — recorded here so a 1c author knows the `WeaponData` shape they populate.

No issues requiring rework.
