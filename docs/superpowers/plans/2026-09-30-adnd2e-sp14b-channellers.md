# Sub-project 14 Plan B: Channellers (core mechanic) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the *Player's Option: Spells & Magic* Channellers variant (pp.80-82) for wizards: a persisted, spend-per-cast spell-point pool (replacing Plan A's derived-only pool for a channelling wizard) and Table 20 time-based recovery, behind the `spellsAndMagicEnabled && spellPoints && channelers` settings gate. Table 21 fatigue is out of scope (Plan C).

**Architecture:** A pure `src/core/magic/channellers.ts` owns the nested gate, the Constitution/Wisdom SP-total substitution, per-cast afford/spend arithmetic (reusing Plan A's `magickCost`), and Table 20 recovery math. A pure `src/data/derive/character/channellers.ts` turns that into a per-actor `{ max }` record, wired into `deriveCharacter` alongside (not replacing) Plan A's `deriveSpellPoints`. The actor schema gains a genuinely **persisted** `channelling.current` field (mirroring the existing `hp.value`/`hp.max` split — `current` survives `prepareDerivedData` untouched, `max` is recomputed every prepare). Foundry glue in `spell-actions.ts` skips the pool-cost check at memorize time for a channeller and adds a channelling branch to `castSpell`/`castFreeMagick` that deducts from the persisted pool instead of marking the entry `expended`, plus a new `recoverChannellerSp` action with a `DialogV2` activity/hours picker mirroring the existing `free-magick-dialog.ts` pattern. The PC sheet's SP bar becomes channelling-aware (current/max + a Recover button), mutually exclusive with Plan A's derived-only bar.

**Tech Stack:** TypeScript, Vite, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-30-adnd2e-sp14b-channellers-design.md` — §1.1-1.2 (rules source, existing code), §2 Decisions, §3 Global Constraints, §4-7.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — never `fvtt-types`.
- **Two-layer contract:** pure zone = `src/core/**`, `src/data/derive/**`: no Foundry imports, **100% line/statement/function coverage** (branches ≥ 90). Foundry layer = `src/data/actor/base-actor.ts`, `src/sheets/character/{spell-actions,recover-dialog,sheet}.ts`, templates, `lang/en.json` — typecheck/lint gated, dev-world verified, not unit-tested.
- **Content policy:** mechanical values only (the Con/Wis SP-total substitution, the floor of 4, Table 20's four activity rates); no rules prose beyond short page citations in comments.
- **Gating (locked, spec §2):** `channellersEnabled(rules) = spellPointsEnabled(rules) && rules.channelers`, written **exactly once** in Task 2. Every consumer calls it.
- **Reload:** `channelers` gets `requiresReload: true` (it changes prepare-time derived data feeding sheet display and memorize eligibility).
- **Additive schema only — no migration, no version bump:** `spellcasting.wizard` gains one new nested schema object (`channelling: { current, max }`); `MemorizedEntry` is untouched.
- **Every action re-derives eligibility** from the actor's current state and current settings — never rendered UI state.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; do not touch `package.json`/`package-lock.json`/`node_modules`. Implementers never run `npm run build`/`build:packs` (Foundry must be closed; the controller builds after Task 5, re-confirming with the user first).
- **Read vitest output with `tail`/`head`/redirect, never `| grep`**; rerun a flaky first run 2-3× before concluding anything.
- **The whole-branch review (Task 6) is MANDATORY**, and the dev-world check (Task 6) is GATED.

## Locked design decisions (this plan's own, resolving what the spec left to the plan)

1. **Multi-round casting (SP9's `castOrBegin`) is untouched.** `castOrBegin` marks a memorized entry `expended: true` at the moment casting *begins* (PHB p.86: "the spell is committed when casting begins"), regardless of Channellers. This plan's channelling branch lives entirely inside `castSpell`/`castFreeMagick` (the immediate-cast path); a channelling wizard using the expanded-casting-time multi-round flow still has their entry marked `expended` at begin and freed at `completeCasting`/`Rest` exactly like today. Extending the begin/complete flow to a spend-without-expending model is out of scope — a follow-up noted in Task 6's report, not built here (same "noted, not built" treatment Plan A gave free magick's own casting-time interaction).
2. **`forgetFreeMagick`'s existing `(actor, spellLevel, expended)` signature needs no change.** A channelling free-magick entry's `expended` stays `false` forever (never set `true`, per decision below), so the sheet's existing `data-expended="{{m.expended}}"` always passes `false` for a channelling row — `forgetFreeMagick(actor, spellLevel, false)` already matches it correctly with zero changes to that function.
3. **Rounding for Table 20 recovery is `Math.round`**, matching the book's own worked example exactly (a 55-max pool: 10% = 5.5, rounds to 6 — but the flat rate of 8 wins the `max()` comparison either way, so this is only distinguishable at the crossover point tested in Task 2).
4. **The channelling SP bar and Plan A's derived SP bar are mutually exclusive in the template** via `{{#if channelling}}...{{else if spellPoints}}...{{/if}}` — `spellPoints` itself is still computed unconditionally by `buildSpells` exactly as Plan A left it; only the template's display order changes.
5. **A channelling row's `canCast` reflects live pool affordability, not `expended`** (which never becomes `true` for a channelling entry) — recomputed on every render from the actor's current `channelling.current`, so a wizard who casts their pool dry sees Cast buttons disable in real time, not just get a blocked-cast toast after clicking.

---

### Task 1: Wire `channelers` into `OptionalRules`

**Files:**
- Modify: `src/core/options.ts`, `src/settings/registry.ts:49`, `lang/en.json` (the `channelers` setting hint), `tests/core/options.test.ts`, `tests/settings/registry.test.ts`

**Interfaces:**
- Produces: `OptionalRules.channelers: boolean` (default `false`) — consumed by Task 2's gate.

- [ ] **Step 1: Update the tests (they must fail)**

In `tests/core/options.test.ts`: rename the first test to `"has exactly the twenty-two core, combatAndTactics, skillsAndPowers and spellsAndMagic toggles"`, add `"channelers"` to the key array (anywhere — the array is `.sort()`-compared), and add `channelers: false,` to the `expected` object in the second test (after `spellPoints: false,`).

In `tests/settings/registry.test.ts`, update:
```typescript
  it("core, combatAndTactics, skillsAndPowers and four spellsAndMagic settings bind 1:1 to OptionalRules fields", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(22);
    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());
    const unbound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey === null).map((d) => d.key).sort();
    expect(unbound).toEqual([]);
  });

  it("exactly the seven prepare-time rules require a world reload", () => {
    const reload = ["channelers", "characterPointBuild", "expandedCastingTime", "skillsAndPowersEnabled", "spellPoints", "spellsAndMagicEnabled", "subAbilityScores"];
    const keys = SETTING_DESCRIPTORS.filter((d) => d.requiresReload === true).map((d) => d.key);
    expect(keys.sort()).toEqual(reload);
    for (const d of SETTING_DESCRIPTORS) {
      if (reload.includes(d.key)) expect(d.requiresReload).toBe(true);
      else expect(d.requiresReload).not.toBe(true);
    }
  });
```
(These replace the current `"...three spellsAndMagic settings..."` and `"...six prepare-time rules..."` tests — same `it` blocks, new bodies. `"registers 22 settings across the 4 groups"` and its `byGroup` object are unchanged: `channelers` already exists as a descriptor today, just unbound.)

Run `npx vitest run tests/core/options.test.ts tests/settings 2>&1 | tail -20` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/core/options.ts` — change the header comment's last sentence from *"`spellsAndMagic.channelers` is registered but not implemented (a later plan in this sub-project — see the Spell Points design spec)."* to: *"Sub-project 14 Plan B implements `spellsAndMagic.channelers`; Table 21 fatigue (Plan C) is not yet built."* Add to the interface after `spellPoints`:
```typescript
  /** Sub-project 14 Plan B: Player's Option: Spells & Magic Channellers — spend-per-cast SP, no fatigue yet (pp.80-82). */
  channelers: boolean;
```
and `channelers: false,` to `DEFAULT_OPTIONAL_RULES` (after `spellPoints: false,`).

`src/settings/registry.ts` — change:
```typescript
  { key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
```
to:
```typescript
  { key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "channelers", requiresReload: true },
```

`lang/en.json` — replace the `channelers` setting's `hint` (currently "Not implemented — ...") with: `"Wizards may cast a memorized spell repeatedly by spending spell points from a recoverable pool instead of losing it after one cast; memorizing costs nothing from the pool — only casting does (Player's Option: Spells & Magic). Fatigue from overcasting is a later plan."`

- [ ] **Step 3: Verify** — `npx vitest run tests/core tests/settings tests/lang tests/config 2>&1 | tail -20` passes; typecheck, lint and `npm run test:coverage` (each redirected to a file under `$TEMP` and read with `tail`) exit 0.

- [ ] **Step 4: Commit**
```bash
git add src/core/options.ts src/settings/registry.ts lang/en.json tests/core/options.test.ts tests/settings/registry.test.ts
git commit -m "feat(sp14b): wire channelers into OptionalRules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure `channellers.ts` module (gate, SP-total substitution, per-cast afford/spend, Table 20 recovery)

**Files:**
- Modify: `src/core/magic/spell-points.ts` (extract `wizardBaseSpellPoints`), `src/core/magic/index.ts` (append `export * from "./channellers";`)
- Create: `src/core/magic/channellers.ts`
- Test: `tests/core/magic/spell-points.test.ts` (append), `tests/core/magic/channellers.test.ts` (create)

**Interfaces:**
- Consumes: `OptionalRules` (Task 1); `magickCost`, `spellPointsEnabled`, `type MagickType` (existing, `spell-points.ts`).
- Produces (Task 3): `channellersEnabled`, `channellerMaxSp`, `canAffordCast`, `spendCastSp`, `type ChannellerActivity`, `recoverSp`.

- [ ] **Step 1: Extract `wizardBaseSpellPoints` from `spell-points.ts` (failing test first)**

Append to `tests/core/magic/spell-points.test.ts`:
```typescript
describe("wizardBaseSpellPoints (Table 17 base + specialist bonus, no Int)", () => {
  it("matches Table 17's own numbers with no Intelligence term", () => {
    expect(wizardBaseSpellPoints(1, false)).toBe(4);
    expect(wizardBaseSpellPoints(6, true)).toBe(75); // 55 base + 20 specialist bonus
  });
  it("wizardSpellPointTotal equals wizardBaseSpellPoints plus the Table 19 Int bonus, always", () => {
    expect(wizardSpellPointTotal(6, 18, true)).toBe(wizardBaseSpellPoints(6, true) + 7); // Int 18 -> +7
  });
});
```
Add `wizardBaseSpellPoints` to the existing import from `"../../../src/core/magic/spell-points"`. Run `npx vitest run tests/core/magic/spell-points.test.ts 2>&1 | tail -15` — FAIL (not exported).

- [ ] **Step 2: Implement the extraction**

In `src/core/magic/spell-points.ts`, replace:
```typescript
/** Table 17 SP (+ specialist bonus, zero past level 20) + Table 19 Intelligence bonus. */
export function wizardSpellPointTotal(wizardLevel: number, intScore: number, specialist: boolean): number {
  assertAbilityScore(intScore, "int");
  const row = wizardRow(wizardLevel);
  const specialistBonus = specialist ? row.specialistBonusSp : 0;
  return row.sp + specialistBonus + bonusSpForIntelligence(intScore);
}
```
with:
```typescript
/** Table 17 base SP + specialist bonus (zero past level 20) — WITHOUT the
 *  Table 19 Intelligence bonus. Exported for Sub-project 14 Plan B's
 *  Channellers, which substitutes a Constitution/Wisdom term for Intelligence
 *  (design spec §1.1) instead of adding to this same base. */
export function wizardBaseSpellPoints(wizardLevel: number, specialist: boolean): number {
  const row = wizardRow(wizardLevel);
  const specialistBonus = specialist ? row.specialistBonusSp : 0;
  return row.sp + specialistBonus;
}

/** Table 17 SP (+ specialist bonus, zero past level 20) + Table 19 Intelligence bonus. */
export function wizardSpellPointTotal(wizardLevel: number, intScore: number, specialist: boolean): number {
  assertAbilityScore(intScore, "int");
  return wizardBaseSpellPoints(wizardLevel, specialist) + bonusSpForIntelligence(intScore);
}
```

- [ ] **Step 3: Run to verify Step 1's test passes** — `npx vitest run tests/core/magic/spell-points.test.ts 2>&1 | tail -15` → PASS. Also re-run the full spell-points suite to confirm no regression: same command, all existing tests still pass (the refactor is behavior-preserving).

- [ ] **Step 4: Write the failing tests for the new `channellers.ts` module**

Create `tests/core/magic/channellers.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  canAffordCast,
  channellerMaxSp,
  channellersEnabled,
  recoverSp,
  spendCastSp,
} from "../../../src/core/magic/channellers";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("channellersEnabled (nested gate)", () => {
  it("needs spellPointsEnabled AND the channelers toggle", () => {
    expect(channellersEnabled(rules())).toBe(false);
    expect(channellersEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true }))).toBe(false);
    expect(channellersEnabled(rules({ spellsAndMagicEnabled: true, channelers: true }))).toBe(false);
    expect(channellersEnabled(rules({ spellPoints: true, channelers: true }))).toBe(false); // master switch still off
    expect(
      channellersEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true, channelers: true })),
    ).toBe(true);
  });
});

describe("channellerMaxSp (Table 17 base, Con/Wis substituted for Int)", () => {
  it("level 6 specialist, Con hpAdjustment +1, Wis magicalDefenseAdj +1: 55 base + 20 specialist bonus + 1 + 1", () => {
    expect(channellerMaxSp(6, true, 1, 1)).toBe(77);
  });
  it("level 6 non-specialist, Con +2, Wis +4: 55 base + 2 + 4", () => {
    expect(channellerMaxSp(6, false, 2, 4)).toBe(61);
  });
  it("floors at 4 when Con/Wis adjustments would push a level-1 wizard below it", () => {
    expect(channellerMaxSp(1, false, -2, -3)).toBe(4); // 4 base - 2 - 3 = -1, floored
  });
  it("does not floor when the raw total is already >= 4", () => {
    expect(channellerMaxSp(1, false, 0, 0)).toBe(4); // 4 base exactly, floor is a no-op here
  });
});

describe("canAffordCast / spendCastSp (reuse magickCost, Table 18)", () => {
  it("allows exactly enough and blocks one short", () => {
    expect(canAffordCast(4, 1, "fixed")).toBe(true);
    expect(canAffordCast(3, 1, "fixed")).toBe(false);
  });
  it("spends the correct Table 18 amount", () => {
    expect(spendCastSp(10, 1, "fixed")).toBe(6);
    expect(spendCastSp(20, 2, "free")).toBe(8);
  });
});

describe("recoverSp (Table 20)", () => {
  it("hard exertion recovers nothing regardless of hours", () => {
    expect(recoverSp(0, 100, "hardExertion", 5)).toBe(0);
  });
  it("the book's own worked example: a 55-max pool sleeping recovers 8/hr (flat beats the 5.5-rounds-to-6 percentage)", () => {
    expect(recoverSp(0, 55, "sleeping", 1)).toBe(8);
  });
  it("walking/riding: flat and percent tie at max=100", () => {
    expect(recoverSp(0, 100, "walkingRiding", 5)).toBe(10); // 2/hr * 5
  });
  it("sitting/resting at max=25: percent (1.25 -> rounds to 1) loses to the flat rate of 4", () => {
    expect(recoverSp(0, 25, "sittingResting", 3)).toBe(12); // 4/hr * 3
  });
  it("crossover point: at max=85 sleeping, the percentage (8.5 -> rounds to 9) beats the flat rate of 8", () => {
    expect(recoverSp(0, 85, "sleeping", 1)).toBe(9);
  });
  it("clamps at max", () => {
    expect(recoverSp(80, 85, "sleeping", 1)).toBe(85); // 80 + 9 would be 89, clamped
  });
});
```

Run `npx vitest run tests/core/magic/channellers.test.ts 2>&1 | tail -20` — FAIL (module not found).

- [ ] **Step 5: Implement**

Create `src/core/magic/channellers.ts`:
```typescript
// Player's Option: Spells & Magic pp.80-82 (Sub-project 14 Plan B): the
// Channellers variant. A channelling wizard's spell selection (fixed/free
// magick) costs nothing from the pool — it only defines the repertoire and,
// via the SAME Table 18 numbers Plan A already prices memorization with, the
// per-CAST cost. The pool itself is a persisted, stateful resource that
// depletes at cast time and recovers gradually (Table 20), replacing the
// Intelligence-bonus SP-total term (Table 19) with a Constitution/Wisdom
// substitution (p.82). "Magical attack adjustment for Wisdom" resolves to
// this codebase's existing magicalDefenseAdj — no separate table for that
// term exists anywhere in the sourcebook (design spec §1.1). Table 21 fatigue
// is Plan C — not built here. Pure.
import { magickCost, spellPointsEnabled, wizardBaseSpellPoints, type MagickType } from "./spell-points";
import type { OptionalRules } from "../options";

/** THE one place the Channellers gate is written — nests under Plan A's own
 *  master gate. Every consumer calls this; never restate the expression. */
export function channellersEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints" | "channelers">,
): boolean {
  return spellPointsEnabled(rules) && rules.channelers;
}

const CHANNELLER_MIN_SP = 4;

/** Table 17 base (+ specialist bonus) with the Table 19 Intelligence bonus
 *  replaced by Constitution's hpAdjustment and Wisdom's magicalDefenseAdj
 *  (p.82: "the character's hit point adjustment for Constitution and his
 *  magical attack adjustment for Wisdom are added to or subtracted from his
 *  spell point total"). Floored at 4 ("all wizards have at least 4 spell
 *  points") — a floor the classic Table 19 addition never needs (it can't go
 *  negative) but this substitution can. */
export function channellerMaxSp(
  wizardLevel: number,
  specialist: boolean,
  conHpAdjustment: number,
  wisMagicalDefenseAdj: number,
): number {
  const base = wizardBaseSpellPoints(wizardLevel, specialist);
  return Math.max(CHANNELLER_MIN_SP, base + conHpAdjustment + wisMagicalDefenseAdj);
}

/** Table 18 (same lookup Plan A prices memorization with) — a channeller pays
 *  this at CAST time instead (p.81). */
export function canAffordCast(current: number, spellLevel: number, magickType: MagickType): boolean {
  return magickCost(spellLevel, magickType) <= current;
}

export function spendCastSp(current: number, spellLevel: number, magickType: MagickType): number {
  return current - magickCost(spellLevel, magickType);
}

export type ChannellerActivity = "hardExertion" | "walkingRiding" | "sittingResting" | "sleeping";

interface RecoveryRate {
  flatPerHour: number;
  percentPerHour: number;
}

// Table 20: Spell Point Recovery for Channellers (p.82).
const ACTIVITY_RECOVERY_RATES: Readonly<Record<ChannellerActivity, RecoveryRate>> = {
  hardExertion: { flatPerHour: 0, percentPerHour: 0 },
  walkingRiding: { flatPerHour: 2, percentPerHour: 2 },
  sittingResting: { flatPerHour: 4, percentPerHour: 5 },
  sleeping: { flatPerHour: 8, percentPerHour: 10 },
};

/** Table 20: per hour, recover the flat rate or the percentage of max,
 *  whichever is BETTER (p.82's own worked example: a 55-max pool sleeping
 *  recovers 8/hr, not the 5.5-rounds-to-6 percentage). Clamped at max. */
export function recoverSp(current: number, max: number, activity: ChannellerActivity, hours: number): number {
  const rate = ACTIVITY_RECOVERY_RATES[activity];
  const perHour = Math.max(rate.flatPerHour, Math.round((rate.percentPerHour / 100) * max));
  return Math.min(max, current + perHour * hours);
}
```
Append `export * from "./channellers";` to `src/core/magic/index.ts`.

- [ ] **Step 6: Verify** — both focused test files pass; typecheck, lint and `npm run test:coverage` exit 0 with `channellers.ts` and `spell-points.ts` at 100%.

- [ ] **Step 7: Commit**
```bash
git add src/core/magic tests/core/magic/spell-points.test.ts tests/core/magic/channellers.test.ts
git commit -m "feat(sp14b): pure channellers module (SP-total substitution, per-cast spend, Table 20 recovery)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Schema, derive layer, and actor caching

**Files:**
- Modify: `src/data/actor/base-actor.ts` (the `wizard` spellcasting schema, `DerivedWriteSurface`, `deriveAndCache`), `src/data/derive/character/derive.ts`
- Create: `src/data/derive/character/channellers.ts`
- Test: `tests/data/derive/character/channellers.test.ts`

**Interfaces:**
- Consumes: `channellerMaxSp` (Task 2); `abilities.con.hpAdjustment`, `abilities.wis.magicalDefenseAdj` (existing `DerivedAbilities`, already computed in `deriveCharacterBase`).
- Produces (Task 4): actor field `system.spellcasting.wizard.channelling: { current: number; max: number }` (current persisted, max derived).

- [ ] **Step 1: Failing tests**

Create `tests/data/derive/character/channellers.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { deriveChannelling } from "../../../../src/data/derive/character/channellers";

describe("deriveChannelling", () => {
  it("a wizard-progression caster gets a max", () => {
    const r = deriveChannelling({
      chassisId: "mage", level: 6, specialist: true, conHpAdjustment: 1, wisMagicalDefenseAdj: 1,
    });
    expect(r.wizard).toEqual({ max: 77 }); // 55 base + 20 specialist bonus + 1 + 1
  });

  it("floors at 4", () => {
    const r = deriveChannelling({
      chassisId: "mage", level: 1, specialist: false, conHpAdjustment: -2, wisMagicalDefenseAdj: -3,
    });
    expect(r.wizard).toEqual({ max: 4 });
  });

  it("a non-wizard-progression class (cleric) gets no record", () => {
    const r = deriveChannelling({
      chassisId: "cleric", level: 6, specialist: false, conHpAdjustment: 0, wisMagicalDefenseAdj: 0,
    });
    expect(r.wizard).toBeUndefined();
  });
});
```
Run `npx vitest run tests/data/derive/character/channellers.test.ts 2>&1 | tail -20` — FAIL (module not found).

- [ ] **Step 2: Implement the pure derive module**

Create `src/data/derive/character/channellers.ts`:
```typescript
// Sub-project 14 Plan B — Channellers (Player's Option: Spells & Magic
// pp.80-82). Only wizard-progression casters get a result; priest channelling
// is out of scope (design spec §2). The caller gates this on
// channellersEnabled(rules) — this module takes no rules bag, mirroring
// deriveSpellPoints's own precedent (spell-points.ts, Plan A).
import { getChassis } from "../../../core/classes/chassis";
import { channellerMaxSp } from "../../../core/magic/channellers";
import type { ClassId } from "../../../core/types";

export interface ChannellingRecord {
  max: number;
}

export interface ChannellingInput {
  chassisId: ClassId;
  level: number;
  specialist: boolean;
  conHpAdjustment: number;
  wisMagicalDefenseAdj: number;
}

export function deriveChannelling(input: ChannellingInput): { wizard?: ChannellingRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType !== "wizard" || chassis.spellProgressionId !== "wizard") return {};
  return {
    wizard: { max: channellerMaxSp(input.level, input.specialist, input.conHpAdjustment, input.wisMagicalDefenseAdj) },
  };
}
```

- [ ] **Step 3: Add the schema field**

`src/data/actor/base-actor.ts` — in the `wizard: new SchemaField({ ... })` block (inside `spellcasting`), add a sibling of `spellPoints` right after it:
```typescript
        /** Sub-project 14 Plan B: `current` is genuinely PERSISTED (like
         *  attributes.hp.value — never touched by prepareDerivedData; only
         *  explicit casts/Recover change it). `max` is derived-overwritten
         *  every prepare cycle (like attributes.hp.max), from
         *  deriveChannelling's channellerMaxSp result. */
        channelling: new SchemaField({
          current: new NumberField({ required: true, integer: true, initial: 0 }),
          max: new NumberField({ required: true, integer: true, initial: 0 }),
        }),
```

- [ ] **Step 4: Wire into `deriveCharacter` and `deriveAndCache`**

`src/data/derive/character/derive.ts`:
- Add the imports: `import { deriveChannelling, type ChannellingRecord } from "./channellers";` and `import { channellersEnabled } from "../../../core/magic/channellers";`.
- Add `channelling: { wizard?: ChannellingRecord };` to the `CharacterDerived` interface, right after `spellPoints`.
- Add a merge helper right after `mergeCasterSpellPoints`:
  ```typescript
  function mergeCasterChannelling(
    casters: readonly ClassMember[],
    abilities: DerivedAbilities,
  ): { wizard?: ChannellingRecord } {
    let out: { wizard?: ChannellingRecord } = {};
    for (const c of casters) {
      out = {
        ...out,
        ...deriveChannelling({
          chassisId: c.chassisId,
          level: c.level,
          specialist: c.specialistSchool !== null,
          conHpAdjustment: abilities.con.hpAdjustment,
          wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
        }),
      };
    }
    return out;
  }
  ```
- In the `mode === "single"` branch, add right after the existing `spellPoints: primaryMember && spellPointsEnabled(options) ? mergeCasterSpellPoints([primaryMember], snapshot, abilities) : {},` line:
  ```typescript
      channelling:
        primaryMember && channellersEnabled(options) ? mergeCasterChannelling([primaryMember], abilities) : {},
  ```
- In the multiclass/dualclass return, add right after the existing `spellPoints: spellPointsEnabled(options) ? mergeCasterSpellPoints(resolution.casters, snapshot, abilities) : {},` line:
  ```typescript
    channelling: channellersEnabled(options) ? mergeCasterChannelling(resolution.casters, abilities) : {},
  ```

`src/data/actor/base-actor.ts`'s `DerivedWriteSurface` and `deriveAndCache`:
- Change `spellcasting: { wizard: { slots: unknown; spellPoints: unknown }; priest: { slots: unknown } };` to `spellcasting: { wizard: { slots: unknown; spellPoints: unknown; channelling: { max: unknown } }; priest: { slots: unknown } };`.
- Add, right after the existing `if (derived.spellPoints.wizard) sys.spellcasting.wizard.spellPoints = derived.spellPoints.wizard;` line:
  ```typescript
    // channelling.current is PERSISTED — only .max is overwritten here (mirrors attributes.hp.max, line 343).
    if (derived.channelling.wizard) sys.spellcasting.wizard.channelling.max = derived.channelling.wizard.max;
  ```

- [ ] **Step 5: Verify** — `npx vitest run tests/data 2>&1 | tail -30` passes; typecheck, lint, `npm run test:coverage` exit 0; `channellers.ts` (derive) at 100%. If `tests/data/derive/character/derive.test.ts` (or any other test in `tests/data`) asserts a full `CharacterDerived`-shaped object with `toEqual` and doesn't already include a `channelling` key, add `channelling: {}` to that literal (grep `spellPoints: {}` first — any fixture that needed that for Plan A needs the same fix here).

- [ ] **Step 6: Commit**
```bash
git add src/data tests/data
git commit -m "feat(sp14b): derive and cache the channelling SP max alongside Plan A's derived pool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Foundry glue — free memorization, spend-per-cast, and the Recover action

**Files:**
- Modify: `src/sheets/character/spell-actions.ts`, `src/sheets/character/sheet.ts`, `lang/en.json`
- Create: `src/sheets/character/recover-dialog.ts`
- Test: append to `tests/lang/en-coverage.test.ts` (lang only — this task's `.ts` changes beyond lang are Foundry-coupled, typecheck/lint gated, dev-world verified, per Global Constraints)

**Interfaces:**
- Consumes: `channellersEnabled`, `canAffordCast`, `spendCastSp`, `recoverSp`, `type ChannellerActivity` (Task 2); `actor.system.spellcasting.wizard.channelling` (Task 3).
- Produces (Task 5): `recoverChannellerSp(actor, activity, hours)`, `promptRecoverChannelling()`.

- [ ] **Step 1: Lang (failing test first)**

Append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — SP14b Channellers sheet strings", () => {
  it("resolves every ADND2E.sheet.spells.channelling* key", () => {
    for (const key of [
      "ADND2E.sheet.spells.channelling",
      "ADND2E.sheet.spells.channellingRecover",
      "ADND2E.sheet.spells.channellingRecoverTitle",
      "ADND2E.sheet.spells.channellingActivityLabel",
      "ADND2E.sheet.spells.channellingHoursLabel",
      "ADND2E.sheet.spells.channellingBlockedWarning",
      "ADND2E.sheet.spells.channellingActivity.hardExertion",
      "ADND2E.sheet.spells.channellingActivity.walkingRiding",
      "ADND2E.sheet.spells.channellingActivity.sittingResting",
      "ADND2E.sheet.spells.channellingActivity.sleeping",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run `npx vitest run tests/lang 2>&1 | tail -15` — FAIL. Add inside `ADND2E.sheet.spells` (sibling of `freeMagickRuleOffHint`):
```json
        "channelling": "Channelling",
        "channellingRecover": "Recover",
        "channellingRecoverTitle": "Recover Spell Points",
        "channellingActivityLabel": "Activity",
        "channellingHoursLabel": "Hours",
        "channellingBlockedWarning": "Channellers isn't active for this character — refresh the sheet.",
        "channellingActivity": {
          "hardExertion": "Hard Exertion (combat, forced march) — no recovery",
          "walkingRiding": "Walking or Riding",
          "sittingResting": "Sitting or Resting",
          "sleeping": "Sleeping"
        }
```
Re-run — pass.

- [ ] **Step 2: `spell-actions.ts` — skip the pool-cost check at memorize time for a channeller**

Add the import: `import { canAffordCast, channellersEnabled, recoverSp, spendCastSp, type ChannellerActivity } from "../../core/magic/channellers";`.

Add `channelling: { current?: number; max?: number };` to the `SpellcasterActor` interface's `wizard` block, right after `spellPoints`.

In `canMemorizeWizardSpellPoints`, change:
```typescript
  const atLevel = spellsMemorizedAtLevel(actor.system.spellcasting.wizard.memorized, spellLevel);
  if (atLevel >= (sp.maxPerLevel ?? 0)) return false;
  return canAffordMemorize(sp.sp ?? 0, sp.spent ?? 0, spellLevel, magickType);
}
```
to:
```typescript
  const atLevel = spellsMemorizedAtLevel(actor.system.spellcasting.wizard.memorized, spellLevel);
  if (atLevel >= (sp.maxPerLevel ?? 0)) return false;
  // Sub-project 14 Plan B: a channeller's slate selection costs nothing from
  // the pool (design spec §1.1) — only the Table 17 caps above still gate it.
  if (channellersEnabled(getOptionalRules())) return true;
  return canAffordMemorize(sp.sp ?? 0, sp.spent ?? 0, spellLevel, magickType);
}
```

- [ ] **Step 3: `spell-actions.ts` — spend-per-cast for `castSpell`**

Replace the whole `castSpell` function:
```typescript
export async function castSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const channelling = key === "wizard" && channellersEnabled(getOptionalRules());
  // A channelling entry is never expended (spec §2) — any match is castable
  // subject to affordability, checked below; the classic path still requires
  // a non-expended entry.
  const entry = channelling
    ? list.find((m) => m.spellItemId === spellItemId)
    : list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  if (channelling) {
    const current = actor.system.spellcasting.wizard.channelling.current ?? 0;
    if (!canAffordCast(current, entry.spellLevel, entry.magickType ?? "fixed")) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
      return;
    }
    const rolled = await rollSpellAutomation(spell);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spendCastSp(current, entry.spellLevel, entry.magickType ?? "fixed"),
    });
    await postCastCard(actor, spell, rolled);
    return;
  }
  const rolled = await rollSpellAutomation(spell);
  if (!rolled) return;
  const updated = list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m));
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
  await postCastCard(actor, spell, rolled);
}
```

- [ ] **Step 4: `spell-actions.ts` — spend-per-cast for `castFreeMagick`**

Replace the whole `castFreeMagick` function:
```typescript
export async function castFreeMagick(
  actor: SpellcasterActor,
  spellLevel: number,
  chosenSpellItemId: string,
): Promise<void> {
  const list = actor.system.spellcasting.wizard.memorized;
  const channelling = channellersEnabled(getOptionalRules());
  const index = channelling
    ? list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel)
    : list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel && !m.expended);
  const chosen = actor.items.get(chosenSpellItemId);
  const eligible =
    Boolean(chosen) &&
    chosen!.system.casterClass === "wizard" &&
    chosen!.system.level === spellLevel &&
    actor.system.spellcasting.wizard.spellbookItemIds.includes(chosenSpellItemId);
  if (index === -1 || !eligible || !chosen) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  if (channelling) {
    const current = actor.system.spellcasting.wizard.channelling.current ?? 0;
    if (!canAffordCast(current, spellLevel, "free")) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
      return;
    }
    const rolled = await rollSpellAutomation(chosen);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spendCastSp(current, spellLevel, "free"),
    });
    await postCastCard(actor, chosen, rolled);
    return;
  }
  const rolled = await rollSpellAutomation(chosen);
  if (!rolled) return;
  const updated = list.map((m, i) => (i === index ? { ...m, expended: true } : m));
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
  await postCastCard(actor, chosen, rolled);
}
```

- [ ] **Step 5: `spell-actions.ts` — the Recover action**

Append at the end of the file:
```typescript
/** Sub-project 14 Plan B: Table 20 recovery. No-op with a warning if
 *  Channellers isn't active for this actor (defensive re-check, matching
 *  every other action in this file). */
export async function recoverChannellerSp(
  actor: SpellcasterActor,
  activity: ChannellerActivity,
  hours: number,
): Promise<void> {
  if (!channellersEnabled(getOptionalRules())) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.channellingBlockedWarning"));
    return;
  }
  const { current, max } = actor.system.spellcasting.wizard.channelling;
  await actor.update({
    "system.spellcasting.wizard.channelling.current": recoverSp(current ?? 0, max ?? 0, activity, hours),
  });
}
```

- [ ] **Step 6: `recover-dialog.ts` — the activity/hours `DialogV2` prompt**

Create `src/sheets/character/recover-dialog.ts`:
```typescript
// Sub-project 14 Plan B: a small DialogV2 prompt for Table 20 recovery —
// picking an activity type and a number of hours. Mirrors the existing
// free-magick-dialog.ts DialogV2.prompt pattern.
import type { ChannellerActivity } from "../../core/magic/channellers";

const ACTIVITIES: readonly ChannellerActivity[] = ["hardExertion", "walkingRiding", "sittingResting", "sleeping"];

/** Prompts for an activity type and a whole number of hours. Returns null if
 *  cancelled or the hours field isn't a positive integer. */
export async function promptRecoverChannelling(): Promise<{ activity: ChannellerActivity; hours: number } | null> {
  const options = ACTIVITIES.map(
    (a) => `<option value="${a}">${game.i18n!.localize(`ADND2E.sheet.spells.channellingActivity.${a}`)}</option>`,
  ).join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.sheet.spells.channellingRecoverTitle") },
    content: `<div class="form-group">
        <label>${game.i18n!.localize("ADND2E.sheet.spells.channellingActivityLabel")}</label>
        <select name="activity" autofocus>${options}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n!.localize("ADND2E.sheet.spells.channellingHoursLabel")}</label>
        <input type="number" name="hours" value="1" min="1" step="1">
      </div>`,
    ok: {
      label: game.i18n!.localize("ADND2E.sheet.spells.channellingRecoverTitle"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const activitySelect = button.form?.elements.namedItem("activity");
        const hoursInput = button.form?.elements.namedItem("hours");
        const activity = activitySelect instanceof HTMLSelectElement ? activitySelect.value : null;
        const hours = hoursInput instanceof HTMLInputElement ? Number(hoursInput.value) : null;
        if (!activity || !hours || !Number.isInteger(hours) || hours < 1) return null;
        return { activity: activity as ChannellerActivity, hours };
      },
    },
  });
  return (value as { activity: ChannellerActivity; hours: number } | null) ?? null;
}
```

- [ ] **Step 7: Wire the Recover action into `sheet.ts`**

Add to the import from `./spell-actions`: `recoverChannellerSp,`. Add a new import: `import { promptRecoverChannelling } from "./recover-dialog";`.

In the action-map object, add right after `restSpellcasting: Adnd2eCharacterSheet.#onRestSpellcasting,`:
```typescript
      recoverChannellerSp: Adnd2eCharacterSheet.#onRecoverChannellerSp,
```
Add the handler near `#onRestSpellcasting`:
```typescript
  static async #onRecoverChannellerSp(this: Adnd2eCharacterSheet): Promise<void> {
    const result = await promptRecoverChannelling();
    if (result) await recoverChannellerSp(this.document as never, result.activity, result.hours);
  }
```

- [ ] **Step 8: Verify** — `npx vitest run tests/lang 2>&1 | tail -15` passes; typecheck and lint exit 0 (this task's `.ts` changes beyond lang are not unit-tested per Global Constraints — dev-world verification happens in Task 6).

- [ ] **Step 9: Commit**
```bash
git add src/sheets/character/spell-actions.ts src/sheets/character/recover-dialog.ts src/sheets/character/sheet.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp14b): free memorization, spend-per-cast, and the Recover action for channellers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sheet context, template, and the channelling SP bar

**Files:**
- Modify: `src/sheets/character/context-types.ts` (`CharacterDerivedView.spellcasting.wizard`, `CharacterSheetContext["spells"]`), `src/sheets/character/context.ts` (`buildSpells`, `buildSpellRow`), `templates/actor/pc/spells.hbs`
- Test: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `channellersEnabled`, `canAffordCast` (Task 2); the cached `channelling` field (Task 3).
- Produces: `CharacterSheetContext.spells.channelling`.

- [ ] **Step 1: Types**

`src/sheets/character/context-types.ts` — add to `CharacterDerivedView.spellcasting.wizard`, right after `spellPoints`:
```typescript
      /** Sub-project 14 Plan B. Same "?? {}"-defaulting story as spellPoints
       *  above. `current` is PERSISTED (never overwritten by
       *  prepareDerivedData); `max` is derived-overwritten every prepare
       *  cycle. */
      channelling?: { current?: number; max?: number };
```
Add to `CharacterSheetContext["spells"]`, right after `spellPoints`:
```typescript
    /** Sub-project 14 Plan B: null when Channellers is off or the actor has no wizard levels */
    channelling: { current: number; max: number } | null;
```

- [ ] **Step 2: Failing tests**

Append to `tests/sheets/character/context.test.ts` (reuse the existing `DEFAULT_OPTIONAL_RULES` import):
```typescript
describe("buildCharacterSheetContext — Channellers (SP14b)", () => {
  const channellingRules = {
    ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true, channelers: true,
  };
  const withChannelling = (over: Record<string, unknown> = {}) => ({
    ...input().derived,
    spellcasting: {
      wizard: {
        specialistSchool: null,
        slots: {},
        spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 15, spent: 0, remaining: 15 },
        channelling: { current: 8, max: 15 },
        memorized: [{ spellItemId: "s1", spellLevel: 1, expended: false, magickType: "fixed" }],
        ...over,
      },
      priest: { slots: {}, memorized: [], sphereAccessOverride: null },
    },
  });
  const spell = (over: Record<string, unknown> = {}) => ({
    id: "s1", name: "Magic Missile", img: "", casterClass: "wizard", level: 1,
    schools: ["evocation"], spheres: [], range: "", castingTime: "1", savingThrow: "none",
    inSpellbook: true, memorized: false, expended: false, canMemorize: false, canCast: false, canLearn: false,
    ...over,
  });

  it("rule off: no channelling bar, Plan A's spell-points bar still shows when that rule alone is on", () => {
    const spellPointsOnly = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true };
    const c = buildCharacterSheetContext(
      input({
        derived: withChannelling({ channelling: undefined }),
        optionalRules: spellPointsOnly,
      }),
    );
    expect(c.spells.channelling).toBeNull();
    expect(c.spells.spellPoints).toEqual({ max: 15, spent: 0, remaining: 15 });
  });

  it("rule on: exposes the channelling bar", () => {
    const c = buildCharacterSheetContext(input({ derived: withChannelling(), optionalRules: channellingRules }));
    expect(c.spells.channelling).toEqual({ current: 8, max: 15 });
  });

  it("memorizing a fixed magick needs no spell points when channelling — only the Table 17 caps", () => {
    const derived = withChannelling({
      spellPoints: { maxSpellLevel: 2, maxPerLevel: 1, sp: 0, spent: 0, remaining: 0 }, // 0 SP available
      channelling: { current: 0, max: 0 },
      memorized: [],
    });
    const c = buildCharacterSheetContext(
      input({ derived, spellItems: [spell()], optionalRules: channellingRules }),
    );
    expect(c.spells.known[0].items[0].canMemorize).toBe(true); // 0 SP is fine — memorizing is free for a channeller
  });

  it("a memorized fixed magick's canCast reflects live pool affordability, not expended", () => {
    const affordable = buildCharacterSheetContext(
      input({
        derived: withChannelling({ channelling: { current: 4, max: 15 } }),
        spellItems: [spell()],
        optionalRules: channellingRules,
      }),
    );
    expect(affordable.spells.known[0].items[0].canCast).toBe(true); // 4 SP available, level-1 fixed costs 4

    const tooPoor = buildCharacterSheetContext(
      input({
        derived: withChannelling({ channelling: { current: 3, max: 15 } }),
        spellItems: [spell()],
        optionalRules: channellingRules,
      }),
    );
    expect(tooPoor.spells.known[0].items[0].canCast).toBe(false); // needs 4, only 3 left
  });

  it("a channelling free magick's canCast reflects live pool affordability", () => {
    // Table 18: a level-2 free magick costs 12 SP.
    const tooPoor = buildCharacterSheetContext(
      input({
        derived: withChannelling({
          memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free" }],
          channelling: { current: 11, max: 15 },
        }),
        optionalRules: channellingRules,
      }),
    );
    expect(tooPoor.spells.freeMagicks).toEqual([{ level: 2, expended: false, canCast: false }]);

    const affordable = buildCharacterSheetContext(
      input({
        derived: withChannelling({
          memorized: [{ spellItemId: null, spellLevel: 2, expended: false, magickType: "free" }],
          channelling: { current: 12, max: 15 },
        }),
        optionalRules: channellingRules,
      }),
    );
    expect(affordable.spells.freeMagicks).toEqual([{ level: 2, expended: false, canCast: true }]);
  });
});
```

Run `npx vitest run tests/sheets 2>&1 | tail -30` — FAIL.

- [ ] **Step 3: Implement `context.ts`**

Add the import: `import { canAffordCast, channellersEnabled } from "../../core/magic/channellers";`.

In `buildSpells`, add right after the existing `const wizardSp = sc.wizard.spellPoints ?? {};` line:
```typescript
  const channellingOn = channellersEnabled(input.optionalRules);
  const wizardChannelling = sc.wizard.channelling ?? {};
```
Change the loop's call to `buildSpellRow` to pass the two new args:
```typescript
    let items = levelItems.map((s) =>
      buildSpellRow(s, sc, priestChassisId, sphereAccessOverride, learnCtx, fav, spellPointsOn, wizardSp, channellingOn, wizardChannelling),
    );
```
Change the returned object's `freeMagicks` line:
```typescript
    freeMagicks: sc.wizard.memorized
      .filter((m) => m.magickType === "free")
      .map((m) => ({
        level: m.spellLevel,
        expended: m.expended,
        canCast:
          !casting &&
          (channellingOn ? canAffordCast(wizardChannelling.current ?? 0, m.spellLevel, "free") : !m.expended),
      })),
```
Add the new field to the returned object, right after `spellPoints`:
```typescript
    channelling:
      channellingOn && typeof wizardChannelling.max === "number"
        ? { current: wizardChannelling.current ?? 0, max: wizardChannelling.max }
        : null,
```

Change `buildSpellRow`'s signature and body:
```typescript
function buildSpellRow(
  item: SpellItemView,
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
  learnCtx: LearnEligibilityContext,
  fav: FavCheck,
  spellPointsOn: boolean,
  wizardSp: CharacterDerivedView["spellcasting"]["wizard"]["spellPoints"],
  channellingOn: boolean,
  wizardChannelling: CharacterDerivedView["spellcasting"]["wizard"]["channelling"],
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;

  let hasFreeSlot: boolean;
  if (isWizard && spellPointsOn && wizardSp && typeof wizardSp.maxSpellLevel === "number") {
    const atLevelOk =
      item.level <= wizardSp.maxSpellLevel &&
      spellsMemorizedAtLevel(sc.wizard.memorized, item.level) < (wizardSp.maxPerLevel ?? 0);
    // Sub-project 14 Plan B: memorizing costs nothing from a channeller's
    // pool (design spec §1.1) — only the Table 17 caps above still gate it.
    hasFreeSlot = channellingOn ? atLevelOk : atLevelOk && (wizardSp.remaining ?? 0) >= magickCost(item.level, "fixed");
  } else {
    const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
    const slotRow = slots[item.level];
    hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
  }

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  // Sub-project 14 Plan B: a channelling entry is never expended, so its
  // castability instead tracks live pool affordability, recomputed on every
  // render — a wizard who casts their pool dry sees the Cast button disable.
  const canCastChannelling =
    isWizard && channellingOn && entry
      ? canAffordCast(wizardChannelling?.current ?? 0, item.level, entry.magickType ?? "fixed")
      : null;

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    canCast: memorized && (canCastChannelling ?? !expended),
    canLearn: isWizard && !item.inSpellbook && canLearnForRow(item, learnCtx),
    favorite: fav("spell", item.id),
  };
}
```

- [ ] **Step 4: Template**

`templates/actor/pc/spells.hbs` — replace the existing Plan A SP-bar block:
```hbs
  {{#if adnd2e.spells.spellPoints}}
    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.spells.spellPoints'}}</div>
      <div class="kit-body">
        <p>{{adnd2e.spells.spellPoints.remaining}} / {{adnd2e.spells.spellPoints.max}}</p>
      </div>
    </section>
  {{/if}}
```
with:
```hbs
  {{#if adnd2e.spells.channelling}}
    <section class="kit-panel">
      <div class="kit-bar">
        {{localize 'ADND2E.sheet.spells.channelling'}}
        <button type="button" class="kit-small" data-action="recoverChannellerSp" style="margin-left:auto">
          {{localize 'ADND2E.sheet.spells.channellingRecover'}}
        </button>
      </div>
      <div class="kit-body">
        <p>{{adnd2e.spells.channelling.current}} / {{adnd2e.spells.channelling.max}}</p>
      </div>
    </section>
  {{else if adnd2e.spells.spellPoints}}
    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.spells.spellPoints'}}</div>
      <div class="kit-body">
        <p>{{adnd2e.spells.spellPoints.remaining}} / {{adnd2e.spells.spellPoints.max}}</p>
      </div>
    </section>
  {{/if}}
```
No other template changes are needed: the known-spells list and Free Magicks panel already key their Cast buttons off `s.canCast`/`m.canCast`, which `context.ts` now computes correctly for a channelling entry.

- [ ] **Step 5: Verify** — `npx vitest run tests/sheets 2>&1 | tail -30` passes; typecheck, lint, `npm run test:coverage` exit 0; `context.ts`/`context-types.ts` keep 100% line/stmt/func.

- [ ] **Step 6: Commit**
```bash
git add src/sheets/character/context.ts src/sheets/character/context-types.ts templates/actor/pc/spells.hbs tests/sheets/character/context.test.ts
git commit -m "feat(sp14b): channelling SP bar and live-affordability Cast buttons on the PC sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Whole-branch review, gated dev-world check, README update

- [ ] **Step 1: Whole-branch review (MANDATORY)** — run the project's `/code-review` (or equivalent) across every commit on this branch against the full diff from `master`, not task-by-task. Pay particular attention to: `canMemorizeWizardSpellPoints`'s channelling skip only affecting the pool-cost check (Table 17 caps must still apply); `castSpell`/`castFreeMagick`'s channelling branch never writing `expended`; `channelling.current` never being touched anywhere in the derive/prepare path (grep every `sys.spellcasting.wizard.channelling` write site — there must be exactly one, in `deriveAndCache`, and it must only ever touch `.max`); and that Task 1's "Locked design decision 1" (multi-round casting stays unchanged) doesn't leave a channelling wizard's entry silently stuck `expended` after a `castOrBegin`-initiated multi-round cast completes (confirm `completeCasting`'s existing behavior — it never touches `expended` itself, only the begin step does, and Rest still clears it, exactly as for a classic wizard).

- [ ] **Step 2: Ask the user to close Foundry, then run `npm run build`** (never run this yourself without asking first, per Global Constraints).

- [ ] **Step 3: Gated dev-world check** — in a linked dev world, with a wizard PC that has `spellsAndMagicEnabled` + `spellPoints` already on:
  - Rule off (`channelers` off): sheet behaves exactly like Plan A alone — the derived SP bar shows, memorizing costs SP, casting expends the entry.
  - Turn on `channelers`, reload: the SP bar switches to "current / max" (channelling); Plan A's derived bar is gone.
  - Memorize a fixed magick with 0 SP available: succeeds (memorizing is free for a channeller) as long as the Table 17 per-level cap and max spell level allow it; hitting the flat per-level cap still blocks it.
  - Cast that memorized spell: the SP bar's current drops by the correct Table 18 cost; the spell stays memorized (no "Cast today" badge) and the Cast button stays enabled if SP remains.
  - Keep casting the same spell until the pool can't afford another cast: the Cast button disables (no toast needed — `canCast` already reflects it) and a forced click (e.g. a stale render) shows the blocked-cast warning with no state change.
  - Memorize and cast a free magick the same way: memorizing is free, each cast picks a spell and debits the pool without expending the reserved level.
  - Click Recover, choose each of the four activity types with a few different hour values: the SP bar's current increases by the expected amount per Table 20 and clamps at max; "Hard Exertion" recovers nothing.
  - Rest: `expended` flags clear (a no-op for channelling entries, which are never expended) — the SP bar is unaffected by Rest, only by Recover.
  - Turn `channelers` off again (leaving `spellPoints` on), reload: sheet reverts fully to Plan A's classic spell-points behavior; the actor's stored `channelling.current`/`.max` values are simply unused (per spec §5).
  - A non-wizard actor (e.g. a cleric) with `channelers` on: no channelling bar, no change to priest slots.

- [ ] **Step 4: README update** — update Sub-project 14's row: Plan B (Channellers core mechanic) complete; note Plan C (Table 21 fatigue) and priest spell points/channelling remain tracked separately. Commit:
```bash
git add README.md
git commit -m "docs: mark Sub-project 14 Plan B (Channellers core mechanic) complete

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push and open the PR** (per this project's standing preference — always push + PR when a branch is done, without asking first).
