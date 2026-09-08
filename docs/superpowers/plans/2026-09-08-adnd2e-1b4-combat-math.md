# AD&D 2E — Plan 1b.4: Combat Math (Armor Class + Attack Resolution + Damage)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the combat-round math to the framework-free `src/core/` engine: descending armor class from armor/shield/Dexterity/magic/situational; the THAC0-vs-AC attack resolution with the natural-1/20 rule; and damage totals with the minimum-1-on-hit floor. Plus a tiny shared dice-formula string builder.

**Architecture:** Continues Plans 1b/1b.2/1b.3's pure `src/core/` engine (pure functions + literal lookup tables, no Foundry imports, enforced by `tsconfig.core.json` + ESLint, 100% Vitest coverage gate). Core is a **math layer**: callers assemble the modifier inputs (which of Strength-hit / Dexterity-missile applies given the weapon type, proficiency state, range band) and pass numbers; the engine returns numbers and dice-formula **strings**, never a Foundry `Roll`. New: `src/core/combat/` (`armor-class.ts`, `attack.ts`, `damage.ts`) and `src/core/dice/` (`formula.ts`).

**Tech Stack:** TypeScript 5 strict; Vitest 5 (`test:coverage` gate at 100% lines/statements on `src/core/**`); ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §4 (`core/combat/`, `core/dice/`), §5.1 (`thac0`, `ac` by attack type, derived), §9 (testing), §11 (reference workflow).

**Research source:** `references/research-notes.md` (git-ignored) — section "PLAN 1b.4: COMBAT MATH" — Table 46 (armor class ratings), Table 51 (combat modifiers), and the attack/damage rules transcribed from the user's PHB Ch.9 pp.89–100 and Ch.6 p.75 with page citations.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, the DOM, `fvtt-types`, or any relative path outside `src/core/`. Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `typecheck` gate and the `no-restricted-globals` / `no-restricted-imports` ESLint block on `src/core/**` + `tests/core/**`.
- Core functions return **plain data** (numbers, records) or dice-formula **strings** — never a Foundry `Roll`, never construct one.
- TypeScript `strict: true`. Prettier printWidth 100, 2-space, double quotes, semi, trailing-comma all. **Do not run `npm run format`.** Precede any hand-aligned table with `// prettier-ignore`.
- No copyrighted prose in the repo — mechanical/factual values only. Files with a table carry a `// PHB Table N, p.XX` citation comment.
- `src/core/**` stays at **100% lines / statements / functions** and **≥90% branches** (`npm run test:coverage`, enforced in CI). Every task's own tests must hold that.
- `ClassGroup`, `SaveCategory`, `Race`, `AbilityKey`, the `*Modifiers` ability interfaces, `thac0(group, level)`, `ClassChassis` already exist. Import, do not redefine.
- Existing guards in `src/core/errors.ts`: `assertAbilityScore`, `assertLevel`, `assertXp`. Task 1 adds `assertD20`.

## Combat semantics (from `references/research-notes.md` §"PLAN 1b.4")

- **Armor Class is descending**, practical range `[-10, 10]` (PHB p.89 states this scale explicitly). `armorClass()` clamps its result to that range.
- **Base armor AC** (no shield): none 10 · leather/padded 8 · studded/ring 7 · brigandine/scale/hide 6 · chain 5 · splint/banded/bronze-plate 4 · plate mail 3 · field plate 2 · full plate 1. A shield lowers AC by 1 (`shieldBonus`, default 1 when a shield is worn — but this engine takes the number). Magic armor/shield/ring/cloak lowers AC by its bonus.
- **Dexterity defensive adjustment** is `dexterity(dex).defensiveAdj` (AC-style: DEX 18 → −4, DEX 3 → +4). Added directly to the AC number. A *beneficial* (negative) DEX adjustment is dropped when `denyDexBonus` is set (surprised, prone, or rear attack); a DEX *penalty* (positive) still applies. A shield's contribution is dropped when `denyShield` is set (rear / rear-flank attacks).
- **To-hit number** = `thac0 − targetAc` (subtraction naturally handles negative AC).
- **Attack resolution:** roll 1d20; hit when `naturalRoll + attackBonus >= toHitNumber`. **Natural 20 always hits; natural 1 always misses** (PHB p.92) — attacks only.
- **Attack modifiers** (all summed into one die-roll bonus by the caller-facing `attackModifiers()`): Strength to-hit (melee + thrown), Dexterity missile (ranged), weapon magic bonus, proficiency modifier (0 / class non-proficiency penalty / specialization), range penalty (short 0 / medium −2 / long −5), situational (Table 51). This engine does **not** decide which of STR-hit / DEX-missile applies — the caller passes the already-resolved values.
- **Damage total** = base weapon dice + Strength damage adjustment (melee + thrown) + specialization bonus + weapon magic + situational. **A successful hit deals at least 1** — `damageResult()` floors the total at 1.
- **No critical hits** in 2E core. **Weapon-type-vs-armor (Table 52) is an optional rule** — reserved toggle, not implemented (Sub-project 7). **Initiative is out of scope** for this plan.
- **Saving throws have no natural-1/20 rule** — no change to Plan 1b.3's composer; nothing to add here.

---

## File Structure

**Created:**
- `src/core/dice/formula.ts` — `signedTerm`, `attackFormula`, `damageFormula`.
- `src/core/dice/index.ts` — barrel.
- `src/core/combat/armor-class.ts` — `armorClass()`.
- `src/core/combat/attack.ts` — `attackModifiers`, `toHitNumber`, `hitResult`.
- `src/core/combat/damage.ts` — `damageModifiers`, `damageResult`.
- `src/core/combat/index.ts` — barrel.
- `tests/core/dice/formula.test.ts`
- `tests/core/combat/armor-class.test.ts`, `attack.test.ts`, `damage.test.ts`

**Modified:**
- `src/core/errors.ts` — add `assertD20(value)`.
- `src/core/index.ts` — add `export * from "./dice";` and `export * from "./combat";`.
- `tests/core/errors.test.ts` — cases for `assertD20`.
- `tests/core/index.test.ts` — extend the barrel smoke test with a combat symbol.

---

## Task 1: `assertD20` + the dice-formula string builder

**Files:**
- Modify: `src/core/errors.ts`, `src/core/index.ts`, `tests/core/errors.test.ts`
- Create: `src/core/dice/formula.ts`, `src/core/dice/index.ts`, `tests/core/dice/formula.test.ts`

**Interfaces:**
- Produces:
  - `function assertD20(value: number): void` — throws `RangeError` unless `Number.isInteger(value) && value >= 1 && value <= 20`.
  - `function signedTerm(modifier: number): string` — `""` for 0, `" + 3"` for 3, `" - 2"` for −2.
  - `function attackFormula(attackBonus: number): string` — `"1d20"`, `"1d20 + 3"`, `"1d20 - 2"`.
  - `function damageFormula(baseDice: string, damageBonus: number): string` — `"1d8"`, `"1d8 + 3"`, `"2d4 - 1"`. `baseDice` is the weapon's damage-dice string, passed through verbatim.

- [ ] **Step 1: Write failing tests**

Append to `tests/core/errors.test.ts` (merge the import with the existing `from "../../src/core/errors"` line):

```ts
import { assertD20 } from "../../src/core/errors";

describe("assertD20", () => {
  it("accepts integers 1..20", () => {
    expect(() => assertD20(1)).not.toThrow();
    expect(() => assertD20(20)).not.toThrow();
  });
  it("rejects out-of-range and non-integers", () => {
    expect(() => assertD20(0)).toThrow(RangeError);
    expect(() => assertD20(21)).toThrow(RangeError);
    expect(() => assertD20(7.5)).toThrow(RangeError);
    expect(() => assertD20(Number.NaN)).toThrow(RangeError);
  });
});
```

`tests/core/dice/formula.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signedTerm, attackFormula, damageFormula } from "../../../src/core/dice/formula";

describe("signedTerm", () => {
  it("formats a modifier as a formula suffix", () => {
    expect(signedTerm(0)).toBe("");
    expect(signedTerm(3)).toBe(" + 3");
    expect(signedTerm(1)).toBe(" + 1");
    expect(signedTerm(-2)).toBe(" - 2");
    expect(signedTerm(-1)).toBe(" - 1");
  });
});

describe("attackFormula", () => {
  it("builds a d20 attack string", () => {
    expect(attackFormula(0)).toBe("1d20");
    expect(attackFormula(5)).toBe("1d20 + 5");
    expect(attackFormula(-3)).toBe("1d20 - 3");
  });
});

describe("damageFormula", () => {
  it("appends the damage bonus to the weapon dice", () => {
    expect(damageFormula("1d8", 0)).toBe("1d8");
    expect(damageFormula("1d8", 3)).toBe("1d8 + 3");
    expect(damageFormula("2d4", -1)).toBe("2d4 - 1");
    expect(damageFormula("1d6+1", 2)).toBe("1d6+1 + 2"); // baseDice passed through verbatim
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm run test -- tests/core/errors.test.ts tests/core/dice/formula.test.ts` → FAIL (missing `assertD20` / module).

- [ ] **Step 3: Extend `src/core/errors.ts`**

```ts
export function assertD20(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new RangeError(`d20 roll must be an integer in [1, 20], got ${value}`);
  }
}
```

- [ ] **Step 4: Create `src/core/dice/formula.ts`**

```ts
// Dice-formula string builders. The engine never constructs a Foundry Roll — it
// returns the formula text for the Foundry layer to roll.

/** A modifier as a formula suffix: 0 -> "", 3 -> " + 3", -2 -> " - 2". */
export function signedTerm(modifier: number): string {
  if (modifier === 0) return "";
  return modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
}

/** A 1d20 attack roll with its total modifier. */
export function attackFormula(attackBonus: number): string {
  return `1d20${signedTerm(attackBonus)}`;
}

/** A weapon damage roll: the weapon's dice string plus the damage bonus. */
export function damageFormula(baseDice: string, damageBonus: number): string {
  return `${baseDice}${signedTerm(damageBonus)}`;
}
```

- [ ] **Step 5: Create `src/core/dice/index.ts`**

```ts
export * from "./formula";
```

- [ ] **Step 6: Update `src/core/index.ts`**

Add (before or after the existing lines; keep `./combat` for Task 2):

```ts
export * from "./dice";
```

- [ ] **Step 7: Run tests + gates**

Run: `npm run test -- tests/core/errors.test.ts tests/core/dice/formula.test.ts` → PASS
Run: `npm run typecheck` (both `tsc` invocations) → clean
Run: `npm run lint` → clean
Run: `npm run test:coverage` → all pass, `src/core/**` 100% lines/statements. (`signedTerm` — the `=== 0`, `> 0`, and `< 0` paths are all hit; `assertD20` throw + non-throw covered.)

- [ ] **Step 8: Commit**

```bash
git add src/core/errors.ts src/core/dice src/core/index.ts tests/core/errors.test.ts tests/core/dice/formula.test.ts
git commit -m "feat(core): dice-formula string builders + assertD20 guard"
```

---

## Task 2: `armor-class.ts` — descending AC

**Files:**
- Create: `src/core/combat/armor-class.ts`, `src/core/combat/index.ts`, `tests/core/combat/armor-class.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: nothing from other core modules (pure arithmetic).
- Produces:
  - `interface ArmorClassInput { baseArmorAc: number; shieldBonus?: number; dexDefensiveAdj?: number; magicBonus?: number; situationalModifier?: number; denyDexBonus?: boolean; denyShield?: boolean }`
    - `baseArmorAc` — the armor's rating (10 unarmored … 1 full plate). Required.
    - `shieldBonus` — how much a shield lowers AC (default `0`; pass `1` for a normal shield).
    - `dexDefensiveAdj` — `dexterity(dex).defensiveAdj`, AC-style (default `0`).
    - `magicBonus` — total magic protection that lowers AC (armor + shield + ring/cloak) (default `0`).
    - `situationalModifier` — added directly to the final AC; negative improves AC, positive worsens it (default `0`).
    - `denyDexBonus` — drop a *beneficial* (negative) `dexDefensiveAdj`; a penalty still applies. (surprised / prone / rear)
    - `denyShield` — drop the shield contribution entirely. (rear / rear-flank)
  - `interface ArmorClassResult { value: number; breakdown: { baseArmorAc: number; shield: number; dexterity: number; magic: number; situational: number } }`
  - `function armorClass(input: ArmorClassInput): ArmorClassResult`
    - `value` = `clamp(baseArmorAc + dexterity − shield − magic + situational, -10, 10)` where `shield` = `denyShield ? 0 : shieldBonus`, `dexterity` = `denyDexBonus ? max(0, dexDefensiveAdj) : dexDefensiveAdj`, `magic` = `magicBonus`.
    - `breakdown` reports each *applied* component (post-deny), with `shield` and `magic` as the amounts subtracted (positive numbers).

- [ ] **Step 1: Failing test** — `tests/core/combat/armor-class.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { armorClass } from "../../../src/core/combat/armor-class";

describe("armorClass()", () => {
  it("unarmored is AC 10", () => {
    expect(armorClass({ baseArmorAc: 10 }).value).toBe(10);
  });

  it("armor + shield + dex + magic (PHB combined model)", () => {
    // chain mail (5) + shield (1) + DEX 16 (-2) + chain +1 (1) => 5 - 1 - 2 - 1 = 1
    const r = armorClass({ baseArmorAc: 5, shieldBonus: 1, dexDefensiveAdj: -2, magicBonus: 1 });
    expect(r.value).toBe(1);
    expect(r.breakdown).toEqual({ baseArmorAc: 5, shield: 1, dexterity: -2, magic: 1, situational: 0 });
  });

  it("Table 46 combos: leather + shield = 7", () => {
    expect(armorClass({ baseArmorAc: 8, shieldBonus: 1 }).value).toBe(7);
  });

  it("clamps to [-10, 10]", () => {
    expect(armorClass({ baseArmorAc: 10, dexDefensiveAdj: 6 }).value).toBe(10); // worse than 10 -> 10
    expect(armorClass({ baseArmorAc: 1, shieldBonus: 1, dexDefensiveAdj: -6, magicBonus: 5 }).value).toBe(-10);
  });

  it("denyShield drops the shield", () => {
    const r = armorClass({ baseArmorAc: 5, shieldBonus: 1, denyShield: true });
    expect(r.value).toBe(5);
    expect(r.breakdown.shield).toBe(0);
  });

  it("denyDexBonus drops a beneficial DEX adj but keeps a penalty", () => {
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: -3, denyDexBonus: true }).value).toBe(8);
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: 4, denyDexBonus: true }).value).toBe(10); // penalty stays (clamped)
    expect(armorClass({ baseArmorAc: 8, dexDefensiveAdj: 2, denyDexBonus: true }).value).toBe(10);
  });

  it("rear attack = denyDexBonus + denyShield", () => {
    const front = armorClass({ baseArmorAc: 5, shieldBonus: 1, dexDefensiveAdj: -4 });
    const rear = armorClass({ baseArmorAc: 5, shieldBonus: 1, dexDefensiveAdj: -4, denyDexBonus: true, denyShield: true });
    expect(front.value).toBe(0);
    expect(rear.value).toBe(5);
  });

  it("situational modifier: negative improves AC", () => {
    expect(armorClass({ baseArmorAc: 8, situationalModifier: -2 }).value).toBe(6); // cover
    expect(armorClass({ baseArmorAc: 8, situationalModifier: 2 }).value).toBe(10);
  });
});
```

- [ ] **Step 2: Run — FAIL.**  `npm run test -- tests/core/combat/armor-class.test.ts`

- [ ] **Step 3: Implement** — `src/core/combat/armor-class.ts`

```ts
// PHB p.89 (descending AC scale, -10..10) + Table 46: ARMOR CLASS RATINGS (p.75).
// Combined model: final AC = baseArmorAc + DEX defensive adj - shield - magic + situational.

const AC_BEST = -10;
const AC_WORST = 10;

export interface ArmorClassInput {
  /** the armor's AC rating: 10 (none) .. 1 (full plate) */
  baseArmorAc: number;
  /** amount a shield lowers AC (0 default; 1 for a normal shield) */
  shieldBonus?: number;
  /** dexterity(dex).defensiveAdj — AC-style (negative = agile) */
  dexDefensiveAdj?: number;
  /** total magic protection that lowers AC (armor + shield + ring/cloak) */
  magicBonus?: number;
  /** added directly to the final AC; negative improves, positive worsens */
  situationalModifier?: number;
  /** drop a beneficial DEX adjustment (surprised / prone / rear); a penalty still applies */
  denyDexBonus?: boolean;
  /** drop the shield contribution (rear / rear-flank attacks) */
  denyShield?: boolean;
}

export interface ArmorClassResult {
  value: number;
  breakdown: {
    baseArmorAc: number;
    /** amount subtracted for the shield (post-deny) */
    shield: number;
    /** DEX defensive adjustment applied (post-deny) */
    dexterity: number;
    /** amount subtracted for magic */
    magic: number;
    situational: number;
  };
}

function clamp(n: number): number {
  return Math.min(AC_WORST, Math.max(AC_BEST, n));
}

export function armorClass(input: ArmorClassInput): ArmorClassResult {
  const shieldRaw = input.shieldBonus ?? 0;
  const dexRaw = input.dexDefensiveAdj ?? 0;
  const magic = input.magicBonus ?? 0;
  const situational = input.situationalModifier ?? 0;

  const shield = input.denyShield ? 0 : shieldRaw;
  const dexterity = input.denyDexBonus ? Math.max(0, dexRaw) : dexRaw;

  const value = clamp(input.baseArmorAc + dexterity - shield - magic + situational);
  return {
    value,
    breakdown: { baseArmorAc: input.baseArmorAc, shield, dexterity, magic, situational },
  };
}
```

- [ ] **Step 4: Create `src/core/combat/index.ts`**

```ts
export * from "./armor-class";
```

- [ ] **Step 5: Update `src/core/index.ts`**

Add:

```ts
export * from "./combat";
```

- [ ] **Step 6: Run — PASS.**  **Step 7: Gates** (`typecheck && lint && test:coverage`, 100%). (`denyShield`/`denyDexBonus` ternaries, `Math.max(0, …)` both directions, and `clamp` at both bounds are covered by the tests above.)

- [ ] **Step 8: Commit**

```bash
git add src/core/combat/armor-class.ts src/core/combat/index.ts src/core/index.ts tests/core/combat/armor-class.test.ts
git commit -m "feat(core): armorClass() — descending AC (PHB p.89, Table 46)"
```

---

## Task 3: `attack.ts` — attack modifiers, to-hit number, hit resolution

**Files:**
- Create: `src/core/combat/attack.ts`, `tests/core/combat/attack.test.ts`
- Modify: `src/core/combat/index.ts`

**Interfaces:**
- Consumes: `assertD20` (Task 1); `attackFormula` (Task 1) is **not** used here (the caller can build the string) — keep `attack.ts` free of the dice import.
- Produces:
  - `interface AttackModifierInput { strengthHitAdj?: number; dexterityMissileAdj?: number; weaponMagicBonus?: number; proficiencyModifier?: number; rangePenalty?: number; situationalModifier?: number }` — all default `0`; all already resolved by the caller (e.g. `strengthHitAdj` is `0` for a bow without a strength-bow).
  - `interface AttackModifierResult { total: number; breakdown: { strength: number; dexterityMissile: number; weaponMagic: number; proficiency: number; range: number; situational: number } }`
  - `function attackModifiers(input: AttackModifierInput): AttackModifierResult` — `total` = sum of the six.
  - `function toHitNumber(thac0: number, targetAc: number): number` — `thac0 - targetAc`.
  - `interface HitResult { hit: boolean; autoHit: boolean; autoMiss: boolean; needed: number; total: number; margin: number }`
  - `function hitResult(naturalD20: number, attackBonus: number, thac0: number, targetAc: number): HitResult`
    - `assertD20(naturalD20)`.
    - `needed` = `toHitNumber(thac0, targetAc)`; `total` = `naturalD20 + attackBonus`; `margin` = `total - needed`.
    - `naturalD20 === 20` → `{ hit: true, autoHit: true, autoMiss: false, … }` regardless of `needed`.
    - `naturalD20 === 1` → `{ hit: false, autoHit: false, autoMiss: true, … }` regardless of `needed`.
    - otherwise → `hit` = `total >= needed`.

- [ ] **Step 1: Failing test** — `tests/core/combat/attack.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { attackModifiers, toHitNumber, hitResult } from "../../../src/core/combat/attack";

describe("attackModifiers()", () => {
  it("sums the six modifier sources", () => {
    const r = attackModifiers({
      strengthHitAdj: 2, dexterityMissileAdj: 0, weaponMagicBonus: 1,
      proficiencyModifier: -2, rangePenalty: 0, situationalModifier: 4,
    });
    expect(r.total).toBe(5);
    expect(r.breakdown).toEqual({
      strength: 2, dexterityMissile: 0, weaponMagic: 1, proficiency: -2, range: 0, situational: 4,
    });
  });
  it("all defaults -> 0", () => {
    expect(attackModifiers({}).total).toBe(0);
  });
  it("ranged example: DEX missile + long range penalty", () => {
    expect(attackModifiers({ dexterityMissileAdj: 2, rangePenalty: -5 }).total).toBe(-3);
  });
});

describe("toHitNumber()", () => {
  it("thac0 - targetAc", () => {
    expect(toHitNumber(14, 6)).toBe(8);   // PHB Rath vs orc AC 6
    expect(toHitNumber(11, 5)).toBe(6);   // PHB Rath modified
    expect(toHitNumber(20, 10)).toBe(10); // 1st level vs unarmored
  });
  it("negative target AC adds", () => {
    expect(toHitNumber(10, -3)).toBe(13);
  });
});

describe("hitResult()", () => {
  it("plain hit / miss around the needed number", () => {
    const hit = hitResult(8, 0, 14, 6); // needs 8, rolled 8
    expect(hit).toMatchObject({ hit: true, autoHit: false, autoMiss: false, needed: 8, total: 8, margin: 0 });
    const miss = hitResult(7, 0, 14, 6);
    expect(miss).toMatchObject({ hit: false, needed: 8, total: 7, margin: -1 });
  });
  it("attack bonus is added to the natural roll", () => {
    expect(hitResult(6, 2, 14, 6).hit).toBe(true);  // 6 + 2 = 8 >= 8
    expect(hitResult(5, 2, 14, 6).hit).toBe(false); // 7 < 8
  });
  it("natural 20 always hits, even when needed is impossible", () => {
    const r = hitResult(20, 0, 20, -10); // needs 30
    expect(r).toMatchObject({ hit: true, autoHit: true, autoMiss: false, needed: 30 });
  });
  it("natural 1 always misses, even when needed is trivial", () => {
    const r = hitResult(1, 10, 10, 10); // needs 0, total 11
    expect(r).toMatchObject({ hit: false, autoHit: false, autoMiss: true, needed: 0 });
  });
  it("rejects a non-d20 natural roll", () => {
    expect(() => hitResult(0, 0, 14, 6)).toThrow(RangeError);
    expect(() => hitResult(21, 0, 14, 6)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/combat/attack.ts`

```ts
// PHB Ch.9 pp.89-92: THAC0 attack resolution + Table 51 combat modifiers.
import { assertD20 } from "../errors";

export interface AttackModifierInput {
  /** strength().hitProb, if it applies to this weapon (melee + thrown); else 0 */
  strengthHitAdj?: number;
  /** dexterity().missileAttackAdj for a ranged attack; 0 for melee */
  dexterityMissileAdj?: number;
  /** weapon magic bonus (+1 sword -> +1) */
  weaponMagicBonus?: number;
  /** 0 if proficient; class non-proficiency penalty if not; +1 if specialized */
  proficiencyModifier?: number;
  /** 0 short, -2 medium, -5 long */
  rangePenalty?: number;
  /** summed Table 51 situational modifiers */
  situationalModifier?: number;
}

export interface AttackModifierResult {
  total: number;
  breakdown: {
    strength: number;
    dexterityMissile: number;
    weaponMagic: number;
    proficiency: number;
    range: number;
    situational: number;
  };
}

export function attackModifiers(input: AttackModifierInput): AttackModifierResult {
  const strength = input.strengthHitAdj ?? 0;
  const dexterityMissile = input.dexterityMissileAdj ?? 0;
  const weaponMagic = input.weaponMagicBonus ?? 0;
  const proficiency = input.proficiencyModifier ?? 0;
  const range = input.rangePenalty ?? 0;
  const situational = input.situationalModifier ?? 0;
  return {
    total: strength + dexterityMissile + weaponMagic + proficiency + range + situational,
    breakdown: { strength, dexterityMissile, weaponMagic, proficiency, range, situational },
  };
}

/** The d20 result needed to hit: THAC0 minus the target's Armor Class. */
export function toHitNumber(thac0: number, targetAc: number): number {
  return thac0 - targetAc;
}

export interface HitResult {
  hit: boolean;
  /** natural 20 */
  autoHit: boolean;
  /** natural 1 */
  autoMiss: boolean;
  needed: number;
  total: number;
  margin: number;
}

export function hitResult(
  naturalD20: number,
  attackBonus: number,
  thac0: number,
  targetAc: number,
): HitResult {
  assertD20(naturalD20);
  const needed = toHitNumber(thac0, targetAc);
  const total = naturalD20 + attackBonus;
  const margin = total - needed;
  if (naturalD20 === 20) {
    return { hit: true, autoHit: true, autoMiss: false, needed, total, margin };
  }
  if (naturalD20 === 1) {
    return { hit: false, autoHit: false, autoMiss: true, needed, total, margin };
  }
  return { hit: total >= needed, autoHit: false, autoMiss: false, needed, total, margin };
}
```

- [ ] **Step 4: Update `src/core/combat/index.ts`**

```ts
export * from "./armor-class";
export * from "./attack";
```

- [ ] **Step 5: Run — PASS.**  **Step 6: Gates** (`typecheck && lint && test:coverage`, 100%). (The `=== 20`, `=== 1`, and default branches of `hitResult` plus every `?? 0` in `attackModifiers` are covered.)

- [ ] **Step 7: Commit**

```bash
git add src/core/combat/attack.ts src/core/combat/index.ts tests/core/combat/attack.test.ts
git commit -m "feat(core): attack resolution — THAC0 vs AC, natural 1/20 (PHB Ch.9, Table 51)"
```

---

## Task 4: `damage.ts` — damage modifiers and total

**Files:**
- Create: `src/core/combat/damage.ts`, `tests/core/combat/damage.test.ts`
- Modify: `src/core/combat/index.ts`, `tests/core/index.test.ts`

**Interfaces:**
- Consumes: nothing from other core modules (pure arithmetic).
- Produces:
  - `interface DamageModifierInput { strengthDamageAdj?: number; specializationBonus?: number; weaponMagicBonus?: number; situationalModifier?: number }` — all default `0`; all caller-resolved (`strengthDamageAdj` is `0` for a bow without a strength-bow).
  - `interface DamageModifierResult { total: number; breakdown: { strength: number; specialization: number; weaponMagic: number; situational: number } }`
  - `function damageModifiers(input: DamageModifierInput): DamageModifierResult` — `total` = sum of the four.
  - `function damageResult(rolledBaseDamage: number, damageBonus: number): number` — `Math.max(1, rolledBaseDamage + damageBonus)`. A successful hit deals at least 1.

- [ ] **Step 1: Failing test** — `tests/core/combat/damage.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { damageModifiers, damageResult } from "../../../src/core/combat/damage";

describe("damageModifiers()", () => {
  it("sums the four sources", () => {
    const r = damageModifiers({
      strengthDamageAdj: 3, specializationBonus: 2, weaponMagicBonus: 1, situationalModifier: 0,
    });
    expect(r.total).toBe(6);
    expect(r.breakdown).toEqual({ strength: 3, specialization: 2, weaponMagic: 1, situational: 0 });
  });
  it("all defaults -> 0", () => {
    expect(damageModifiers({}).total).toBe(0);
  });
  it("bow (no STR damage) with magic", () => {
    expect(damageModifiers({ weaponMagicBonus: 2 }).total).toBe(2);
  });
});

describe("damageResult()", () => {
  it("rolled + bonus", () => {
    expect(damageResult(5, 3)).toBe(8);
    expect(damageResult(1, 0)).toBe(1);
  });
  it("floors at 1 on a hit (penalties cannot reduce below 1)", () => {
    expect(damageResult(2, -5)).toBe(1);
    expect(damageResult(1, -3)).toBe(1);
    expect(damageResult(4, -4)).toBe(1); // exactly 0 -> 1
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/combat/damage.ts`

```ts
// PHB p.89, p.91: weapon damage = base dice + Strength + specialization + magic + situational.
// A successful hit deals at least 1 point (PHB p.89 describes damage as "as little as 1 point";
// a hit reduced below 1 by penalties is treated as 1).

export interface DamageModifierInput {
  /** strength().damageAdj, if it applies (melee + thrown); else 0 */
  strengthDamageAdj?: number;
  /** weapon-specialization damage bonus (fighter = +2); else 0 */
  specializationBonus?: number;
  /** weapon magic bonus (+1 sword -> +1) */
  weaponMagicBonus?: number;
  situationalModifier?: number;
}

export interface DamageModifierResult {
  total: number;
  breakdown: {
    strength: number;
    specialization: number;
    weaponMagic: number;
    situational: number;
  };
}

export function damageModifiers(input: DamageModifierInput): DamageModifierResult {
  const strength = input.strengthDamageAdj ?? 0;
  const specialization = input.specializationBonus ?? 0;
  const weaponMagic = input.weaponMagicBonus ?? 0;
  const situational = input.situationalModifier ?? 0;
  return {
    total: strength + specialization + weaponMagic + situational,
    breakdown: { strength, specialization, weaponMagic, situational },
  };
}

/** Final damage from a successful hit: rolled dice + bonus, floored at 1. */
export function damageResult(rolledBaseDamage: number, damageBonus: number): number {
  return Math.max(1, rolledBaseDamage + damageBonus);
}
```

- [ ] **Step 4: Update `src/core/combat/index.ts`**

```ts
export * from "./armor-class";
export * from "./attack";
export * from "./damage";
```

- [ ] **Step 5: Extend the barrel smoke test** — `tests/core/index.test.ts`

Add one assertion inside the existing `it(...)` block (import `armorClass` from the barrel alongside the existing imports):

```ts
    expect(armorClass({ baseArmorAc: 10 }).value).toBe(10);
```

- [ ] **Step 6: Run — PASS.**  **Step 7: Full gate** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0, `src/core/**` 100% lines/statements. (`Math.max(1, …)` both directions covered by the "rolled + bonus" and "floors at 1" cases; every `?? 0` covered.)

- [ ] **Step 8: Commit**

```bash
git add src/core/combat/damage.ts src/core/combat/index.ts tests/core/combat/damage.test.ts tests/core/index.test.ts
git commit -m "feat(core): damage totals — modifiers + minimum-1-on-hit (PHB p.89, p.91)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §4 `core/dice/formula.ts` — string builders | Task 1 |
| §4 `core/combat/armor-class.ts` — `ac({...})` | Task 2 |
| §4 `core/combat/attack.ts` — `attackFormula` (string) / `hitResult` (not rolled) | Tasks 1, 3 |
| §5.1 AC by attack type (normal / rear / surprised) | Task 2 (`denyDexBonus` / `denyShield` flags) |
| §5.1 THAC0 → to-hit — consumes `thac0(group, level)` from 1b.2 | Task 3 (`toHitNumber`) |
| §9 Vitest, PHB example values asserted, 100% core coverage in CI | all tasks |
| §11 values transcribed from `references/` with citations | file header comments in `armor-class.ts`, `attack.ts`, `damage.ts` |

Out of scope for Plan 1b.4 (later plans / sub-projects): initiative (individual + weapon speed + casting time); which of STR-hit / DEX-missile applies for a given weapon type, and range-band determination (the caller / a weapon plan resolves these — 1b.7); weapon damage-dice data and the vs-S/M vs vs-L split (1b.7); proficiency-slot spending & specialization eligibility (1b.6); weapon-type-vs-armor Table 52 (optional rule → SP7); critical hits & called shots (SP7); multi-attack sequencing; the `data/` layer / `CONFIG.ADND2E` (1c).

**2. Placeholder scan:** No "TBD" / "handle edge cases" / "similar to Task N". Every function body and every test assertion is literal. Table 46 base-AC values and Table 51 modifiers appear as concrete numbers in the implementation notes and are re-derived in the tests (e.g. leather+shield = 7, Rath's THAC0 14 vs AC 6 = 8). The "minimum-1-on-hit" behavior is documented as *behavior* (with the PHB p.89 basis), not claimed as verbatim RAW.

**3. Type consistency:**
- `assertD20` — defined once in `errors.ts` (Task 1), imported by `attack.ts` (Task 3). Signature `(value: number): void`.
- `signedTerm` / `attackFormula` / `damageFormula` — defined once in `dice/formula.ts` (Task 1); `damageFormula(baseDice: string, damageBonus: number)` two-param shape is consistent between the interface block, implementation, and tests.
- `armorClass(input: ArmorClassInput): ArmorClassResult` — the `breakdown` keys (`baseArmorAc`, `shield`, `dexterity`, `magic`, `situational`) are identical in the interface, the returned object, and every `toEqual` in `armor-class.test.ts`.
- `attackModifiers` / `damageModifiers` — `breakdown` keys match interface ↔ implementation ↔ tests (`strength`, `dexterityMissile`, `weaponMagic`, `proficiency`, `range`, `situational` for attack; `strength`, `specialization`, `weaponMagic`, `situational` for damage).
- `hitResult(input: HitInput)` — one object param `{ naturalD20, attackBonus, thac0, targetAc }`, `HitResult` return with `{ hit, autoHit, autoMiss, needed, total, margin }` — consistent Task 3 interface ↔ implementation ↔ test `toMatchObject` calls. (The earlier pseudocode in this plan shows the pre-review positional signature `hitResult(naturalD20, attackBonus, thac0, targetAc)`; the final-review fix wave moved it to the object form — see point 6.)
- `toHitNumber(thac0, targetAc)` — used by `hitResult` internally exactly as its own tests call it.

**4. Coverage:** every new file is small pure functions. `formula.ts` — `signedTerm`'s three branches (`=== 0`, `> 0`, `< 0`) hit by the test; `attackFormula`/`damageFormula` are one-liners over it. `armor-class.ts` — `denyShield`/`denyDexBonus` ternaries both sides, `Math.max(0, …)` both directions, `clamp` at `AC_WORST` and `AC_BEST`. `attack.ts` — `hitResult`'s `=== 20` / `=== 1` / default arms, `assertD20` throw, all `?? 0`. `damage.ts` — `Math.max(1, …)` both directions, all `?? 0`. `errors.ts` — `assertD20` throw + non-throw. No `/* v8 ignore */`. `dice/index.ts` and `combat/index.ts` are `export *` barrels (zero executable statements → 100% by construction, like the sibling `saves/racial` re-export).

**5. Sign conventions — the two places to get right (both mirrored in `references/research-notes.md`):**
- **AC:** lower is better. `dexDefensiveAdj` is added as-is (already negative for agile). `shieldBonus` and `magicBonus` are *subtracted* (they improve AC). `situationalModifier` is added as-is, so a DM ad-hoc AC bonus is passed as a negative number — documented on the field. (Cover is an *attack* penalty in 2E, not an AC adjustment; the earlier draft used it as the field's exemplar and the fix wave corrected that.)
- **To-hit:** `toHitNumber = thac0 - targetAc`. A negative `targetAc` makes the subtraction *increase* the needed number (`thac0 - (-3) = thac0 + 3`), matching PHB p.89 "if the Armor Class is a negative number, you add it". `hitResult` adds `attackBonus` to the *natural* roll, and the natural-20/natural-1 checks look at the natural roll, not the total — so a +15 bonus never turns a natural 1 into a hit.

**6. Deviations from the spec (`docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md`), all deliberate improvements:**
- Spec §4 lists `combat/attack.ts → attackFormula(thac0, targetAc, mods)` and a separate `combat/resolution.ts → hitResult(attackTotal, thac0, targetAc)`. This plan puts `attackFormula(attackBonus)` in `dice/formula.ts`, keeps `hitResult` in `attack.ts` (no `resolution.ts`), and `hitResult` takes the **natural** d20 (not a pre-summed `attackTotal`) — the natural-1/20 rule is unimplementable without the natural die.
- Spec §5.6 writes `ac = 10 − armor − shield − dexDefensive − magic + situational`. This plan uses `baseArmorAc + dexDefensiveAdj − shieldBonus − magicBonus + situationalModifier`: the `10` is folded into `baseArmorAc` (armor "none" = 10), and `dexDefensiveAdj` is **added** because `dexterity(dex).defensiveAdj` is already AC-signed (negative = agile) — the spec's `− dexDefensive` would invert it.
- Spec §4 and §5.6 were updated to match these APIs in the final-review fix wave (commit `41c9f8f`), so Plan 1c consumes a spec that already describes the built design.

No issues requiring rework.
