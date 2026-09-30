# Sub-project 14 Plan A: Wizard Spell Points — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the *Player's Option: Spells & Magic* wizard Spell Point system (Table 17 progression, Table 18 fixed/free magick costs, Table 19 Intelligence bonus) as an alternate-eligibility layer over the existing memorize/cast/rest cycle, behind the `spellsAndMagicEnabled && spellPoints` settings gate.

**Architecture:** A pure `src/core/magic/spell-points.ts` owns the gate helper and Tables 17-19. A pure `src/data/derive/character/spell-points.ts` turns that into a per-actor `SpellPointsRecord` (max spell level, flat per-level cap, SP total/spent/remaining), wired into the existing `deriveCharacter` pipeline alongside (not replacing) `deriveSpellSlots`, and cached onto `system.spellcasting.wizard.spellPoints`. Foundry glue in `spell-actions.ts` gates fixed-magick memorization on this record instead of the classic `SlotRecord` when the rule is on, and adds three new, fully additive functions for free magick (`memorizeFreeMagick`, `castFreeMagick`, `forgetFreeMagick`) — free-magick entries have no `spellItemId` (the spell is chosen at cast time) and are addressed by spell level, since they're fungible. The PC sheet gains an SP bar and a Free Magicks panel; two small `DialogV2` prompts (level picker for memorize, spell picker for cast) live in a new `free-magick-dialog.ts`, mirroring the existing `initiative-modifier-dialog.ts` pattern.

**Tech Stack:** TypeScript, Vite, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-29-adnd2e-sp14-spell-points-design.md` — §1.1 (Tables 17-19), §2 Decisions, §3 Global Constraints, §4-7.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — never `fvtt-types`.
- **Two-layer contract:** pure zone = `src/core/**`, `src/data/derive/**`, and `src/sheets/character/{context,context-types}.ts` (established precedent from the SP9a plan): no Foundry imports, **100% line/statement/function coverage** (branches ≥ 90). Foundry layer = `src/data/actor/base-actor.ts`, `src/sheets/character/{spell-actions,free-magick-dialog,sheet}.ts`, templates, `lang/en.json` — typecheck/lint gated, dev-world verified, not unit-tested.
- **Content policy:** mechanical values only (Tables 17-19 as transcribed in the spec); no rules prose beyond short page citations in comments.
- **Gating (locked, spec §2):** `rules.spellsAndMagicEnabled && rules.spellPoints` is written **exactly once**, as `spellPointsEnabled(rules)` in Task 2. Every consumer calls it.
- **Reload:** `spellPoints` gets `requiresReload: true` (it changes prepare-time derived data feeding sheet display and memorize eligibility).
- **Additive schema only — no migration, no version bump:** `memorizedSchema()` gains one optional field (`magickType`) and widens `spellItemId` to nullable; `wizard.spellPoints` is a new `ObjectField` sibling of the existing `wizard.slots` field, same shape/precedent.
- **Every action re-derives eligibility** from the actor's current state and current settings — never rendered UI state.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; do not touch `package.json`/`package-lock.json`/`node_modules`. Implementers never run `npm run build`/`build:packs` (Foundry must be closed; the controller builds after Task 5, re-confirming with the user first).
- **Read vitest output with `tail`/`head`/redirect, never `| grep`**; rerun a flaky first run 2-3× before concluding anything.
- **The whole-branch review (Task 6) is MANDATORY**, and the dev-world check (Task 6) is GATED.

## Locked design decisions (this plan's own, resolving what the spec left to the plan)

1. **`spellItemId` nullability:** `spellItemId` becomes `nullable: true` (still `required: true`, `blank: false` when non-null) rather than a sentinel string. A free-magick entry stores `spellItemId: null`.
2. **Free-magick addressing:** free-magick entries have no natural id and are mechanically fungible (any one at a given level is interchangeable with another at the same level — same cost, same "any known spell of that level" effect). They are addressed by **spell level, first match** — `memorizeFreeMagick`/`castFreeMagick`/`forgetFreeMagick` all take a `spellLevel`, not an entry id.
3. **Free-magick casting is always immediate** in this plan — it does **not** route through `castOrBegin`/the SP9 Begin→Complete multi-round flow (which is keyed entirely by `spellItemId`). A free-magick cast rolls automation and posts a cast card exactly like an out-of-combat cast, regardless of the `expandedCastingTime` setting or combat state. Extending `CastingState` to support a null-`spellItemId` casting state is out of scope — noted as a follow-up in Task 6's report, not built here.
4. **Memorize-failure warnings stay a single generic message** (`ADND2E.sheet.spells.memorizeBlockedWarning`, reused), matching how the classic path already collapses "no free slot" and "not in spellbook" into one message — not three distinct spell-points-specific messages.
5. **`CharacterDerivedView.spellcasting.wizard.spellPoints` and `MemorizedEntry.magickType` are OPTIONAL fields.** This means no existing test fixture literal anywhere in the test suite needs to change — an object without `spellPoints`/`magickType` remains valid and reads as "rule off" / "fixed magick" everywhere.
6. **`deriveAndCache` follows the existing "Ruling PF-C" precedent** used for `.slots`: `if (derived.spellPoints.wizard) sys.spellcasting.wizard.spellPoints = derived.spellPoints.wizard;` — when there's no wizard-progression caster (or the rule is off), the schema-initialized `{}` default is left in place rather than actively cleared.

---

### Task 1: Wire `spellPoints` into `OptionalRules`

**Files:**
- Modify: `src/core/options.ts`, `src/settings/registry.ts:45-49`, `lang/en.json` (the `spellPoints` hint), `tests/core/options.test.ts`, `tests/settings/registry.test.ts`

**Interfaces:**
- Produces: `OptionalRules.spellPoints: boolean` (default `false`) — consumed by Task 2's gate.

- [ ] **Step 1: Update the tests (they must fail)**

In `tests/core/options.test.ts`: rename the first test to `"has exactly the twenty-one core, combatAndTactics, skillsAndPowers and spellsAndMagic toggles"`, add `"spellPoints"` to the key array (alphabetically, after `"nonweaponProficienciesUsed"` — the array is already alphabetically sorted before `.sort()`, so insert it wherever reads cleanly since `.sort()` normalizes it), and add `spellPoints: false,` to the `expected` object in the second test (after `expandedCastingTime: false,`).

In `tests/settings/registry.test.ts`:
```typescript
  it("registers 22 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(22);
```
stays unchanged (still 22 — `spellPoints` moves from unbound to bound, the total count doesn't change). Update:
```typescript
  it("core, combatAndTactics, skillsAndPowers and three spellsAndMagic settings bind 1:1 to OptionalRules fields", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(21);
    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());
    const unbound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey === null).map((d) => d.key).sort();
    expect(unbound).toEqual(["channelers"]);
  });

  it("exactly the six prepare-time rules require a world reload", () => {
    const reload = ["characterPointBuild", "expandedCastingTime", "skillsAndPowersEnabled", "spellPoints", "spellsAndMagicEnabled", "subAbilityScores"];
    const keys = SETTING_DESCRIPTORS.filter((d) => d.requiresReload === true).map((d) => d.key);
    expect(keys.sort()).toEqual(reload);
    for (const d of SETTING_DESCRIPTORS) {
      if (reload.includes(d.key)) expect(d.requiresReload).toBe(true);
      else expect(d.requiresReload).not.toBe(true);
    }
  });
```
Delete the `"ignores spellsAndMagic keys — they never appear in the bag"` test (it asserted `spellPoints` stays unbound, which is no longer true).

Run `npx vitest run tests/core/options.test.ts tests/settings 2>&1 | tail -20` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/core/options.ts` — update the header comment's last sentence to: "`spellsAndMagic.channelers` is registered but not implemented (a later plan in this sub-project — see the Spell Points design spec)." Add to the interface after `expandedCastingTime`:
```typescript
  /** Sub-project 14 Plan A: Player's Option: Spells & Magic wizard spell points (pp.78, 80). */
  spellPoints: boolean;
```
and `spellPoints: false,` to `DEFAULT_OPTIONAL_RULES` (after `expandedCastingTime: false,`).

`src/settings/registry.ts` — change:
```typescript
  { key: "spellPoints", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
```
to:
```typescript
  { key: "spellPoints", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "spellPoints", requiresReload: true },
```
`lang/en.json` — replace the `spellPoints` hint (currently "Not implemented — ...") with: `"Wizards spend a spell-point pool to memorize fixed magicks (one specific spell) or free magicks (any spell of that level, chosen when cast) instead of filling flat per-level slots for free (Player's Option: Spells & Magic)."`

- [ ] **Step 3: Verify** — `npx vitest run tests/core tests/settings tests/lang tests/config 2>&1 | tail -20` passes; typecheck, lint and `npm run test:coverage` (each redirected to a file under `$TEMP` and read with `tail`) exit 0.

- [ ] **Step 4: Commit**
```bash
git add src/core/options.ts src/settings/registry.ts lang/en.json tests/core/options.test.ts tests/settings/registry.test.ts
git commit -m "feat(sp14a): wire spellPoints into OptionalRules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure spell-points module (Tables 17-19, gate, cost/afford functions)

**Files:**
- Create: `src/core/magic/spell-points.ts`
- Modify: `src/core/magic/index.ts` (append `export * from "./spell-points";`)
- Test: `tests/core/magic/spell-points.test.ts`

**Interfaces:**
- Consumes: `OptionalRules` (Task 1).
- Produces (Task 3): `spellPointsEnabled`, `MagickType`, `wizardMaxSpellLevel`, `wizardMaxPerLevel`, `wizardSpellPointTotal`, `magickCost`, `spellPointsSpent`, `spellsMemorizedAtLevel`, `canAffordMemorize`.

- [ ] **Step 1: Write the failing tests**

Create `tests/core/magic/spell-points.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  canAffordMemorize,
  magickCost,
  spellPointsEnabled,
  spellPointsSpent,
  spellsMemorizedAtLevel,
  wizardMaxPerLevel,
  wizardMaxSpellLevel,
  wizardSpellPointTotal,
} from "../../../src/core/magic/spell-points";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("spellPointsEnabled (the one gate)", () => {
  it("needs the master switch AND the spell-points toggle", () => {
    expect(spellPointsEnabled(rules())).toBe(false);
    expect(spellPointsEnabled(rules({ spellsAndMagicEnabled: true }))).toBe(false);
    expect(spellPointsEnabled(rules({ spellPoints: true }))).toBe(false);
    expect(spellPointsEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true }))).toBe(true);
  });
});

describe("wizardMaxSpellLevel (Table 17)", () => {
  it.each([
    [1, 1], [2, 1], [3, 2], [6, 3], [12, 6], [18, 9], [20, 9],
  ])("wizard level %i -> max spell level %i", (level, expected) => {
    expect(wizardMaxSpellLevel(level)).toBe(expected);
  });

  it("level 21+ freezes at the level-20 max spell level", () => {
    expect(wizardMaxSpellLevel(21)).toBe(9);
    expect(wizardMaxSpellLevel(30)).toBe(9);
  });

  it("rejects a bad level", () => {
    expect(() => wizardMaxSpellLevel(0)).toThrow(RangeError);
  });
});

describe("wizardMaxPerLevel (Table 17, flat cap)", () => {
  it.each([
    [1, false, 2], [1, true, 3],
    [6, false, 4], [6, true, 6],
    [13, false, 6], [13, true, 7],
    [19, false, 7], [19, true, 9],
    [20, false, 7], [20, true, 9],
  ])("wizard level %i, specialist=%s -> cap %i", (level, specialist, expected) => {
    expect(wizardMaxPerLevel(level, specialist)).toBe(expected);
  });

  it("level 21+ freezes the flat cap at the level-20 row", () => {
    expect(wizardMaxPerLevel(25, false)).toBe(7);
    expect(wizardMaxPerLevel(25, true)).toBe(9);
  });
});

describe("wizardSpellPointTotal (Table 17 SP + specialist bonus + Table 19 Int bonus)", () => {
  it("level 1, non-specialist, Int 8 (below bonus threshold): base SP only", () => {
    expect(wizardSpellPointTotal(1, 8, false)).toBe(4);
  });
  it("level 1, non-specialist, Int 9: +2 bonus", () => {
    expect(wizardSpellPointTotal(1, 9, false)).toBe(6);
  });
  it("level 6, specialist, Int 18: base 55 + specialist bonus 20 + Int bonus 7", () => {
    expect(wizardSpellPointTotal(6, 18, true)).toBe(82);
  });
  it("level 21+, non-specialist, Int 10: 800 base + 100/level over 20, + Int bonus 2", () => {
    expect(wizardSpellPointTotal(21, 10, false)).toBe(902);
  });
  it("level 21+ gives no further specialist SP bonus (Table 17's own '(0)')", () => {
    expect(wizardSpellPointTotal(21, 10, true)).toBe(wizardSpellPointTotal(21, 10, false));
  });
  it.each([
    [8, 0], [9, 2], [11, 2], [12, 3], [13, 3], [14, 4], [15, 4],
    [16, 5], [17, 6], [18, 7], [19, 8], [20, 9], [25, 9],
  ])("Table 19 boundary: Int %i -> bonus %i", (intScore, bonus) => {
    expect(wizardSpellPointTotal(1, intScore, false) - wizardSpellPointTotal(1, 1, false)).toBe(bonus);
  });
});

describe("magickCost (Table 18)", () => {
  it.each([
    [1, "fixed", 4], [1, "free", 8],
    [5, "fixed", 22], [5, "free", 44],
    [9, "fixed", 60], [9, "free", 120],
  ] as const)("spell level %i, %s -> %i SP", (level, type, expected) => {
    expect(magickCost(level, type)).toBe(expected);
  });

  it("rejects an out-of-range spell level", () => {
    expect(() => magickCost(0, "fixed")).toThrow(RangeError);
    expect(() => magickCost(10, "fixed")).toThrow(RangeError);
  });
});

describe("spellPointsSpent", () => {
  it("is 0 for an empty list", () => {
    expect(spellPointsSpent([])).toBe(0);
  });
  it("sums mixed fixed/free entries", () => {
    expect(spellPointsSpent([
      { spellLevel: 1, magickType: "fixed" },
      { spellLevel: 2, magickType: "free" },
    ])).toBe(4 + 12);
  });
  it("treats an entry with no magickType as fixed", () => {
    expect(spellPointsSpent([{ spellLevel: 3 }])).toBe(10);
  });
  it("counts an expended entry the same as a fresh one (occupancy, not availability)", () => {
    expect(spellPointsSpent([{ spellLevel: 1, magickType: "fixed", expended: true } as never])).toBe(4);
  });
});

describe("spellsMemorizedAtLevel", () => {
  it("counts entries at the given level only", () => {
    const memorized = [{ spellLevel: 1 }, { spellLevel: 1 }, { spellLevel: 2 }];
    expect(spellsMemorizedAtLevel(memorized, 1)).toBe(2);
    expect(spellsMemorizedAtLevel(memorized, 2)).toBe(1);
    expect(spellsMemorizedAtLevel(memorized, 3)).toBe(0);
  });
});

describe("canAffordMemorize", () => {
  it("allows exactly up to the total", () => {
    expect(canAffordMemorize(40, 36, 1, "fixed")).toBe(true); // 36 + 4 = 40
  });
  it("blocks one point over", () => {
    expect(canAffordMemorize(40, 37, 1, "fixed")).toBe(false); // 37 + 4 = 41
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/core/magic/spell-points.test.ts 2>&1 | tail -15` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/core/magic/spell-points.ts`:
```typescript
// Player's Option: Spells & Magic pp.78, 80 (Sub-project 14 Plan A): the wizard
// Spell Point system. Table 17 (Wizard Spell Point Progression) REPLACES
// wizardSpellSlots's role for a spell-points wizard — it supplies its own
// max-spell-level AND a FLAT max-spells-per-level cap (one number, the same
// for every accessible spell level; NOT Table 21's per-level-varying counts:
// "a 6th-level mage is limited to four spells of any given level, so he can
// memorize up to eight cantrips"). Table 18 (Spell Cost by Level) prices
// memorizing a spell as a fixed magick (one specific spell) or free magick
// (any known spell of that level, chosen at cast time — costs more). Table 19
// (Bonus Spell Points for Intelligence) is additive, mirroring the priest
// Wisdom bonus-spells table. Pure.
import { assertAbilityScore, assertLevel, assertSpellLevel } from "../errors";
import type { OptionalRules } from "../options";

const MAX_TABLE_LEVEL = 20;

/** THE one place the spell-points gate is written (master AND-gate). Every
 *  consumer — derive, the sheet, the memorize/cast glue — calls this; never
 *  restate the expression. */
export function spellPointsEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints">,
): boolean {
  return rules.spellsAndMagicEnabled && rules.spellPoints;
}

export type MagickType = "fixed" | "free";

interface WizardSpellPointRow {
  maxSpellLevel: number;
  maxPerLevel: number;
  specialistMaxPerLevel: number;
  sp: number;
  specialistBonusSp: number;
}

// prettier-ignore
const WIZARD_SPELL_POINT_PROGRESSION: readonly WizardSpellPointRow[] = [
  { maxSpellLevel: 1, maxPerLevel: 2, specialistMaxPerLevel: 3, sp: 4,   specialistBonusSp: 4 },   // L1
  { maxSpellLevel: 1, maxPerLevel: 2, specialistMaxPerLevel: 3, sp: 8,   specialistBonusSp: 4 },   // L2
  { maxSpellLevel: 2, maxPerLevel: 3, specialistMaxPerLevel: 4, sp: 15,  specialistBonusSp: 10 },  // L3
  { maxSpellLevel: 2, maxPerLevel: 4, specialistMaxPerLevel: 5, sp: 25,  specialistBonusSp: 10 },  // L4
  { maxSpellLevel: 3, maxPerLevel: 4, specialistMaxPerLevel: 6, sp: 40,  specialistBonusSp: 20 },  // L5
  { maxSpellLevel: 3, maxPerLevel: 4, specialistMaxPerLevel: 6, sp: 55,  specialistBonusSp: 20 },  // L6
  { maxSpellLevel: 4, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 70,  specialistBonusSp: 35 },  // L7
  { maxSpellLevel: 4, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 95,  specialistBonusSp: 35 },  // L8
  { maxSpellLevel: 5, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 120, specialistBonusSp: 60 },  // L9
  { maxSpellLevel: 5, maxPerLevel: 5, specialistMaxPerLevel: 6, sp: 150, specialistBonusSp: 60 },  // L10
  { maxSpellLevel: 5, maxPerLevel: 5, specialistMaxPerLevel: 7, sp: 200, specialistBonusSp: 60 },  // L11
  { maxSpellLevel: 6, maxPerLevel: 5, specialistMaxPerLevel: 7, sp: 250, specialistBonusSp: 90 },  // L12
  { maxSpellLevel: 6, maxPerLevel: 6, specialistMaxPerLevel: 7, sp: 300, specialistBonusSp: 90 },  // L13
  { maxSpellLevel: 7, maxPerLevel: 6, specialistMaxPerLevel: 7, sp: 350, specialistBonusSp: 130 }, // L14
  { maxSpellLevel: 7, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 400, specialistBonusSp: 130 }, // L15
  { maxSpellLevel: 8, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 475, specialistBonusSp: 180 }, // L16
  { maxSpellLevel: 8, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 550, specialistBonusSp: 180 }, // L17
  { maxSpellLevel: 9, maxPerLevel: 6, specialistMaxPerLevel: 8, sp: 625, specialistBonusSp: 240 }, // L18
  { maxSpellLevel: 9, maxPerLevel: 7, specialistMaxPerLevel: 9, sp: 700, specialistBonusSp: 240 }, // L19
  { maxSpellLevel: 9, maxPerLevel: 7, specialistMaxPerLevel: 9, sp: 800, specialistBonusSp: 240 }, // L20
];

function wizardRow(wizardLevel: number): WizardSpellPointRow {
  assertLevel(wizardLevel, "wizardLevel");
  if (wizardLevel <= MAX_TABLE_LEVEL) return WIZARD_SPELL_POINT_PROGRESSION[wizardLevel - 1];
  // Table 17's own "21+" row: +100 SP/level past 20, no further specialist SP
  // bonus, max spell level and the flat per-level cap frozen at the L20 row.
  const l20 = WIZARD_SPELL_POINT_PROGRESSION[MAX_TABLE_LEVEL - 1];
  return { ...l20, sp: l20.sp + 100 * (wizardLevel - MAX_TABLE_LEVEL), specialistBonusSp: 0 };
}

/** Table 17's own max-spell-level column, BEFORE the caller intersects it
 *  with the Intelligence-based cap (`abilities.int.maxSpellLevel`) — see
 *  `deriveSpellPoints`. */
export function wizardMaxSpellLevel(wizardLevel: number): number {
  return wizardRow(wizardLevel).maxSpellLevel;
}

/** Table 17's flat per-level memorized-spell cap — the SAME number for every
 *  spell level the wizard can access (not Table 21's per-level-varying counts). */
export function wizardMaxPerLevel(wizardLevel: number, specialist: boolean): number {
  const row = wizardRow(wizardLevel);
  return specialist ? row.specialistMaxPerLevel : row.maxPerLevel;
}

// prettier-ignore
const BONUS_SP_BY_INTELLIGENCE: readonly { min: number; bonus: number }[] = [
  { min: 20, bonus: 9 },
  { min: 19, bonus: 8 },
  { min: 18, bonus: 7 },
  { min: 17, bonus: 6 },
  { min: 16, bonus: 5 },
  { min: 14, bonus: 4 },
  { min: 12, bonus: 3 },
  { min: 9,  bonus: 2 },
];

/** Table 19: Bonus Spell Points for Intelligence — 0 below score 9. */
function bonusSpForIntelligence(intScore: number): number {
  return BONUS_SP_BY_INTELLIGENCE.find((row) => intScore >= row.min)?.bonus ?? 0;
}

/** Table 17 SP (+ specialist bonus, zero past level 20) + Table 19 Intelligence bonus. */
export function wizardSpellPointTotal(wizardLevel: number, intScore: number, specialist: boolean): number {
  assertAbilityScore(intScore, "int");
  const row = wizardRow(wizardLevel);
  const specialistBonus = specialist ? row.specialistBonusSp : 0;
  return row.sp + specialistBonus + bonusSpForIntelligence(intScore);
}

// prettier-ignore
const MAGICK_COST_BY_SPELL_LEVEL: Readonly<Record<number, { fixed: number; free: number }>> = {
  1: { fixed: 4,  free: 8 },
  2: { fixed: 6,  free: 12 },
  3: { fixed: 10, free: 20 },
  4: { fixed: 15, free: 30 },
  5: { fixed: 22, free: 44 },
  6: { fixed: 30, free: 60 },
  7: { fixed: 40, free: 80 },
  8: { fixed: 50, free: 100 },
  9: { fixed: 60, free: 120 },
};

/** Table 18: Spell Cost by Level (Wizard). Cantrips (level 0) are out of scope (spec §7). */
export function magickCost(spellLevel: number, magickType: MagickType): number {
  assertSpellLevel(spellLevel);
  return MAGICK_COST_BY_SPELL_LEVEL[spellLevel][magickType];
}

interface MemorizedForCost {
  spellLevel: number;
  magickType?: MagickType;
}

/** Total SP currently committed to memorized entries — counts an expended
 *  entry the same as a fresh one (mirrors `slots.ts`'s `toRecord`: occupancy
 *  doesn't change until Rest). An entry with no `magickType` (authored before
 *  this rule was ever on) is treated as fixed. */
export function spellPointsSpent(memorized: readonly MemorizedForCost[]): number {
  return memorized.reduce((sum, m) => sum + magickCost(m.spellLevel, m.magickType ?? "fixed"), 0);
}

/** How many currently-held entries occupy a given spell level — checked
 *  against `wizardMaxPerLevel`'s flat cap instead of Table 21's `SlotRecord`. */
export function spellsMemorizedAtLevel(memorized: readonly { spellLevel: number }[], spellLevel: number): number {
  return memorized.filter((m) => m.spellLevel === spellLevel).length;
}

export function canAffordMemorize(
  totalSp: number, spentSp: number, spellLevel: number, magickType: MagickType,
): boolean {
  return spentSp + magickCost(spellLevel, magickType) <= totalSp;
}
```
Append `export * from "./spell-points";` to `src/core/magic/index.ts`.

- [ ] **Step 4: Verify** — the focused test passes; typecheck, lint and `npm run test:coverage` exit 0 with `spell-points.ts` at 100%.

- [ ] **Step 5: Commit**
```bash
git add src/core/magic tests/core/magic/spell-points.test.ts
git commit -m "feat(sp14a): pure wizard spell-points module (Tables 17-19)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Schema, derive layer, and actor caching

**Files:**
- Modify: `src/data/actor/base-actor.ts` (`memorizedSchema()`, the `wizard` spellcasting schema, `DerivedWriteSurface`, `deriveAndCache`), `src/data/derive/character/derive.ts`
- Create: `src/data/derive/character/spell-points.ts`
- Test: `tests/data/derive/character/spell-points.test.ts`
- Modify test: `tests/data/derive/character/derive.test.ts` (only if it asserts a full `spellSlots`/`spellcasting`-shaped object with `toEqual` — see Step 1)

**Interfaces:**
- Consumes: `spellPointsEnabled`, `wizardMaxSpellLevel`, `wizardMaxPerLevel`, `wizardSpellPointTotal`, `spellPointsSpent` (Task 2).
- Produces (Task 4): actor field `system.spellcasting.wizard.spellPoints: { maxSpellLevel, maxPerLevel, sp, spent, remaining } | {}`.

- [ ] **Step 1: Confirm no existing test breaks the "optional field" premise** — run `grep -rn "spellSlots\b" tests/data` and `grep -rn "CharacterDerived\b" tests/data | head -20`; if any test does `expect(deriveCharacter(...)).toEqual({ ...a full literal without a spellPoints key... })` it will still pass unmodified (an object literal comparison via `toEqual` treats a missing optional key and an explicit `undefined` the same only when the ACTUAL value is also absent — since `CharacterDerived.spellPoints` will be `{}` when the rule is off, not omitted, any such test needs `spellPoints: {}` added to its expected literal). Note in your report which files (if any) needed this.

- [ ] **Step 2: Failing tests**

Create `tests/data/derive/character/spell-points.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { deriveSpellPoints } from "../../../../src/data/derive/character/spell-points";

const base = {
  chassisId: "mage" as const,
  level: 6,
  intScore: 18,
  maxSpellLevelKnown: 9,
  specialist: true,
  wizardMemorized: [],
};

describe("deriveSpellPoints", () => {
  it("a wizard-progression caster gets a full record", () => {
    const r = deriveSpellPoints(base);
    expect(r.wizard).toEqual({ maxSpellLevel: 3, maxPerLevel: 6, sp: 82, spent: 0, remaining: 82 });
  });

  it("intersects Table 17's max spell level with the Intelligence-based cap", () => {
    const r = deriveSpellPoints({ ...base, maxSpellLevelKnown: 2 });
    expect(r.wizard!.maxSpellLevel).toBe(2); // Table 17 L6 -> 3rd, but INT caps at 2nd
  });

  it("spent/remaining reflect the memorized list, regardless of expended", () => {
    const r = deriveSpellPoints({
      ...base,
      wizardMemorized: [
        { spellItemId: "a", spellLevel: 1, magickType: "fixed" as const, expended: true },
        { spellItemId: null, spellLevel: 2, magickType: "free" as const, expended: false },
      ],
    });
    expect(r.wizard!.spent).toBe(4 + 12);
    expect(r.wizard!.remaining).toBe(82 - 16);
  });

  it("a non-wizard-progression class (cleric) gets no record", () => {
    expect(deriveSpellPoints({ ...base, chassisId: "cleric" as const }).wizard).toBeUndefined();
  });
});
```
Run `npx vitest run tests/data/derive/character/spell-points.test.ts 2>&1 | tail -20` — FAIL (module not found).

- [ ] **Step 3: Implement the pure derive module**

Create `src/data/derive/character/spell-points.ts`:
```typescript
// Sub-project 14 Plan A — wizard spell points (Player's Option: Spells & Magic
// Table 17). Only wizard-progression casters get a result; priest spell
// points are out of scope (spec §7). Table 17's own max-spell-level is
// intersected with the Intelligence-based cap, exactly as classic
// `wizardSpellSlots` already does for the level 21+ formula.
import { getChassis } from "../../../core/classes/chassis";
import {
  spellPointsSpent, wizardMaxPerLevel, wizardMaxSpellLevel, wizardSpellPointTotal,
} from "../../../core/magic/spell-points";
import type { ClassId } from "../../../core/types";
import type { MemorizedEntry } from "./snapshot";

export interface SpellPointsRecord {
  maxSpellLevel: number;
  maxPerLevel: number;
  sp: number;
  spent: number;
  remaining: number;
}

export interface SpellPointsInput {
  chassisId: ClassId;
  level: number;
  intScore: number;
  /** intelligence(int).maxSpellLevel — intersected with Table 17's own cap */
  maxSpellLevelKnown: number;
  specialist: boolean;
  wizardMemorized: readonly MemorizedEntry[];
}

export function deriveSpellPoints(input: SpellPointsInput): { wizard?: SpellPointsRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType !== "wizard" || chassis.spellProgressionId !== "wizard") return {};
  const maxSpellLevel = Math.min(wizardMaxSpellLevel(input.level), input.maxSpellLevelKnown);
  const maxPerLevel = wizardMaxPerLevel(input.level, input.specialist);
  const sp = wizardSpellPointTotal(input.level, input.intScore, input.specialist);
  const spent = spellPointsSpent(input.wizardMemorized);
  return { wizard: { maxSpellLevel, maxPerLevel, sp, spent, remaining: sp - spent } };
}
```

- [ ] **Step 4: Widen `MemorizedEntry` and add the `magickType` schema field (optional — no fixture changes needed anywhere)**

`src/data/derive/character/snapshot.ts` — change:
```typescript
export interface MemorizedEntry {
  spellItemId: string;
  /** 1–9 */
  spellLevel: number;
}
```
to:
```typescript
export interface MemorizedEntry {
  /** null for a free magick — the spell is chosen at cast time (Sub-project 14 Plan A) */
  spellItemId: string | null;
  /** 1–9 */
  spellLevel: number;
  /** Sub-project 14 Plan A; absent (fixed) for any entry created before this rule ever ran */
  magickType?: "fixed" | "free";
}
```
`src/sheets/character/spell-actions.ts` — widen its own `MemorizedEntry` the same way (it's a separate declaration, not imported from `snapshot.ts`):
```typescript
export interface MemorizedEntry {
  spellItemId: string | null;
  spellLevel: number;
  expended: boolean;
  /** Sub-project 14 Plan A; absent means fixed magick (or the rule has never been on for this entry) */
  magickType?: "fixed" | "free";
}
```
`src/sheets/character/context-types.ts` — widen the inline memorized-entry shape in `CharacterDerivedView.spellcasting.wizard.memorized` (and leave `priest.memorized` alone — spell points is wizard-only):
```typescript
      memorized: { spellItemId: string | null; spellLevel: number; expended: boolean; magickType?: "fixed" | "free" }[];
```
and add a sibling field to `CharacterDerivedView.spellcasting.wizard`, right after `slots`:
```typescript
      /** Sub-project 14 Plan A. The whole field is optional (test fixtures may
       *  omit it entirely); every subfield is ALSO optional because real system
       *  data's `ObjectField` default is `{}` (present but empty) whenever the
       *  rule is off or the actor has no wizard levels — never a fully-populated
       *  object with some fields missing, but never "undefined" from live data
       *  either. Always default with `?? {}` before reading a subfield. */
      spellPoints?: {
        maxSpellLevel?: number; maxPerLevel?: number; sp?: number; spent?: number; remaining?: number;
      };
```

`src/data/actor/base-actor.ts`:
- In `memorizedSchema()`, change `spellItemId: new StringField({ required: true, blank: false }),` to `spellItemId: new StringField({ required: true, nullable: true, blank: false }),` and add, after `expended`:
  ```typescript
      /** Sub-project 14 Plan A: which spell-point magick this is; absent for an entry created before the rule ever ran (treated as fixed, see core/magic/spell-points.ts). */
      magickType: new StringField({ required: true, nullable: true, initial: null, choices: ["fixed", "free"] }),
  ```
- In the `wizard: new SchemaField({ ... })` block (inside `spellcasting`), add a sibling of `slots` right after it:
  ```typescript
        /** Sub-project 14 Plan A: cached deriveSpellPoints() output (see slots's own precedent — Ruling PF-C: left alone, not cleared, when there's no wizard-progression caster). */
        spellPoints: new ObjectField({ required: true, initial: {} }),
  ```

- [ ] **Step 5: Wire into `deriveCharacter` and `deriveAndCache`**

`src/data/derive/character/derive.ts`:
- Add the import: `import { deriveSpellPoints, type SpellPointsRecord } from "./spell-points";` and `import { spellPointsEnabled } from "../../../core/magic/spell-points";`.
- Add `spellPoints: { wizard?: SpellPointsRecord };` to the `CharacterDerived` interface, right after `spellSlots`.
- Add a merge helper right after `mergeCasterSlots`:
  ```typescript
  function mergeCasterSpellPoints(
    casters: readonly ClassMember[],
    snapshot: ActorSnapshot,
    abilities: DerivedAbilities,
  ): { wizard?: SpellPointsRecord } {
    let out: { wizard?: SpellPointsRecord } = {};
    for (const c of casters) {
      out = {
        ...out,
        ...deriveSpellPoints({
          chassisId: c.chassisId,
          level: c.level,
          intScore: snapshot.abilities.int,
          maxSpellLevelKnown: abilities.int.maxSpellLevel,
          specialist: c.specialistSchool !== null,
          wizardMemorized: snapshot.wizardMemorized,
        }),
      };
    }
    return out;
  }
  ```
- In the `mode === "single"` branch, add right after the existing `spellSlots: primaryMember ? mergeCasterSlots([primaryMember], snapshot, abilities) : {},` line:
  ```typescript
      spellPoints:
        primaryMember && spellPointsEnabled(options) ? mergeCasterSpellPoints([primaryMember], snapshot, abilities) : {},
  ```
- In the multiclass/dualclass return, add right after the existing `spellSlots: mergeCasterSlots(resolution.casters, snapshot, abilities),` line:
  ```typescript
    spellPoints: spellPointsEnabled(options) ? mergeCasterSpellPoints(resolution.casters, snapshot, abilities) : {},
  ```

`src/data/actor/base-actor.ts`'s `DerivedWriteSurface` and `deriveAndCache`:
- Change `spellcasting: { wizard: { slots: unknown }; priest: { slots: unknown } };` to `spellcasting: { wizard: { slots: unknown; spellPoints: unknown }; priest: { slots: unknown } };`.
- Add, right after the existing `if (derived.spellSlots.wizard) sys.spellcasting.wizard.slots = derived.spellSlots.wizard;` line:
  ```typescript
    if (derived.spellPoints.wizard) sys.spellcasting.wizard.spellPoints = derived.spellPoints.wizard;
  ```

- [ ] **Step 6: Verify** — `npx vitest run tests/data 2>&1 | tail -30` passes (apply the Step-1 fixture fixes, if any, before this run); typecheck, lint, `npm run test:coverage` exit 0; `spell-points.ts` (derive) at 100%.

- [ ] **Step 7: Commit**
```bash
git add src/data tests/data
git commit -m "feat(sp14a): derive and cache wizard spell points alongside classic slots

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Foundry glue — memorize/cast/forget for fixed and free magick

**Files:**
- Modify: `src/sheets/character/spell-actions.ts`
- Create: `src/sheets/character/free-magick-dialog.ts`
- Modify: `src/sheets/character/sheet.ts`, `lang/en.json`
- Test: append to `tests/lang/en-coverage.test.ts` (lang only — this task's `.ts` changes are Foundry-coupled, typecheck/lint gated, dev-world verified, per Global Constraints)

**Interfaces:**
- Consumes: `spellPointsEnabled`, `magickCost`, `canAffordMemorize`, `spellsMemorizedAtLevel` (Task 2); `actor.system.spellcasting.wizard.spellPoints` (Task 3).
- Produces (Task 5): `memorizeFreeMagick(actor, spellLevel)`, `castFreeMagick(actor, spellLevel, chosenSpellItemId)`, `forgetFreeMagick(actor, spellLevel)`, `promptFreeMagickLevel(maxSpellLevel)`, `promptFreeMagickSpell(actor, spellLevel)`.

- [ ] **Step 1: Lang (failing test first)**

Append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — SP14a spell-points sheet strings", () => {
  it("resolves every ADND2E.sheet.spells.freeMagick* and spellPoints key", () => {
    for (const key of [
      "ADND2E.sheet.spells.spellPoints",
      "ADND2E.sheet.spells.freeMagick",
      "ADND2E.sheet.spells.freeMagickEntry",
      "ADND2E.sheet.spells.memorizeFreeMagick",
      "ADND2E.sheet.spells.freeMagickLevelTitle",
      "ADND2E.sheet.spells.freeMagickLevelHint",
      "ADND2E.sheet.spells.freeMagickCastTitle",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run `npx vitest run tests/lang 2>&1 | tail -15` — FAIL. Add inside `ADND2E.sheet.spells` (sibling of `orphaned`/`orphanedEntry`):
```json
        "spellPoints": "Spell Points",
        "freeMagick": "Free Magicks",
        "freeMagickEntry": "Free magick — any level {level} spell",
        "memorizeFreeMagick": "Memorize Free Magick",
        "freeMagickLevelTitle": "Memorize Free Magick",
        "freeMagickLevelHint": "Reserve a spell level rather than a specific spell — you'll choose which known spell to cast when you cast it.",
        "freeMagickCastTitle": "Cast Free Magick — Choose a Spell"
```
Re-run — pass.

- [ ] **Step 2: `spell-actions.ts` — Table-17-based fixed-magick eligibility**

Add the import: `import { canAffordMemorize, magickCost, spellPointsEnabled, spellsMemorizedAtLevel } from "../../core/magic/spell-points";` and `import { getOptionalRules } from "../../settings";` (already imported — confirm, don't duplicate).

Add, right before `canReMemorize`:
```typescript
/** Table-17-based eligibility for a wizard spell-points memorize (fixed or
 *  free magick): the spell's level must be within the wizard's cached Table
 *  17/Intelligence max, there must be room under the flat per-level cap, and
 *  enough spell points left. `sp.maxSpellLevel` is absent (cached as `{}`)
 *  when the rule is off or the actor has no wizard levels. */
function canMemorizeWizardSpellPoints(actor: SpellcasterActor, spellLevel: number, magickType: "fixed" | "free"): boolean {
  const sp = actor.system.spellcasting.wizard.spellPoints;
  if (typeof sp.maxSpellLevel !== "number") return false;
  if (spellLevel > sp.maxSpellLevel) return false;
  const atLevel = spellsMemorizedAtLevel(actor.system.spellcasting.wizard.memorized, spellLevel);
  if (atLevel >= (sp.maxPerLevel ?? 0)) return false;
  return canAffordMemorize(sp.sp ?? 0, sp.spent ?? 0, spellLevel, magickType);
}
```
Change `canReMemorize`'s slot check from:
```typescript
  const slotRow = sc.slots[spell.system.level];
  const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
  if (!hasFreeSlot) return false;
```
to:
```typescript
  if (key === "wizard" && spellPointsEnabled(getOptionalRules())) {
    if (!canMemorizeWizardSpellPoints(actor, spell.system.level, "fixed")) return false;
  } else {
    const slotRow = sc.slots[spell.system.level];
    const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
    if (!hasFreeSlot) return false;
  }
```
(the type `SpellcasterActor`'s `spellcasting.wizard` gains `spellPoints: { maxSpellLevel?: number; maxPerLevel?: number; sp?: number; spent?: number; remaining?: number }` — add this field to the interface, right after `slots`.)

In `memorizeSpell`, attach `magickType` when the rule is on:
```typescript
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const magickType: "fixed" | undefined = key === "wizard" && spellPointsEnabled(getOptionalRules()) ? "fixed" : undefined;
  const updated: MemorizedEntry[] = [...list, { spellItemId, spellLevel: spell.system.level, expended: false, magickType }];
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
```

- [ ] **Step 3: `spell-actions.ts` — free magick (memorize / cast / forget)**

Append at the end of the file:
```typescript
/** Sub-project 14 Plan A: memorizes a free magick — reserves a spell LEVEL
 *  rather than a specific spell; the actual spell is chosen when it's cast
 *  (see castFreeMagick). Wizard-only. A no-op with a warning when the rule is
 *  off, or the wizard can't fit/afford another entry at that level. */
export async function memorizeFreeMagick(actor: SpellcasterActor, spellLevel: number): Promise<void> {
  if (!spellPointsEnabled(getOptionalRules()) || !canMemorizeWizardSpellPoints(actor, spellLevel, "free")) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.memorizeBlockedWarning"));
    return;
  }
  const list = actor.system.spellcasting.wizard.memorized;
  const updated: MemorizedEntry[] = [
    ...list,
    { spellItemId: null, spellLevel, expended: false, magickType: "free" },
  ];
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
}

/** Forgets one free-magick entry at spellLevel (first match, regardless of
 *  expended state) — free magicks are fungible, so which specific entry is
 *  removed doesn't matter mechanically. Silent no-op if none exist (mirrors
 *  forgetSpell — the sheet only shows Forget when one exists). */
export async function forgetFreeMagick(actor: SpellcasterActor, spellLevel: number): Promise<void> {
  const list = actor.system.spellcasting.wizard.memorized;
  const index = list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel);
  if (index === -1) return;
  const updated = [...list.slice(0, index), ...list.slice(index + 1)];
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
}

/** Casts a free magick: rolls the CHOSEN spell's automation (the spell is
 *  picked at cast time, not at memorization — spec §1.1), then expends one
 *  matching non-expended free-magick entry at spellLevel. Does NOT route
 *  through the SP9 Begin/Complete casting-time flow (castOrBegin) — a
 *  free-magick cast is always immediate in this plan (Locked design decision
 *  3; extending CastingState to a null-spellItemId state is a follow-up). */
export async function castFreeMagick(
  actor: SpellcasterActor,
  spellLevel: number,
  chosenSpellItemId: string,
): Promise<void> {
  const list = actor.system.spellcasting.wizard.memorized;
  const index = list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel && !m.expended);
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
  const rolled = await rollSpellAutomation(chosen);
  if (!rolled) return;
  const updated = list.map((m, i) => (i === index ? { ...m, expended: true } : m));
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
  await postCastCard(actor, chosen, rolled);
}
```

- [ ] **Step 4: `free-magick-dialog.ts` — the two `DialogV2` prompts**

Create `src/sheets/character/free-magick-dialog.ts`:
```typescript
// Sub-project 14 Plan A: small DialogV2 prompts for free magick — picking a
// spell LEVEL to memorize (any spell of that level, chosen later) and picking
// which known spell to cast a memorized free magick as (the choice happens at
// cast time, not at memorization — spec §1.1). Mirrors the existing
// combat/initiative-modifier-dialog.ts DialogV2.prompt pattern.
export interface FreeMagickCastActor {
  system: { spellcasting: { wizard: { spellbookItemIds: string[] } } };
  items: Iterable<{ id: string; name: string; type: string; system: { casterClass?: string; level?: number } }>;
}

/** Prompts for a spell level (1..maxSpellLevel) to memorize as a free magick. Returns null if cancelled. */
export async function promptFreeMagickLevel(maxSpellLevel: number): Promise<number | null> {
  const options = Array.from({ length: maxSpellLevel }, (_, i) => i + 1)
    .map((lvl) => `<option value="${lvl}">${lvl}</option>`)
    .join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.sheet.spells.freeMagickLevelTitle") },
    content: `<p>${game.i18n!.localize("ADND2E.sheet.spells.freeMagickLevelHint")}</p>
      <select name="level" autofocus>${options}</select>`,
    ok: {
      label: game.i18n!.localize("ADND2E.sheet.spells.memorizeFreeMagick"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const select = button.form?.elements.namedItem("level");
        return select instanceof HTMLSelectElement ? Number(select.value) : null;
      },
    },
  });
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Prompts for which known wizard spell of `spellLevel` to cast a free magick
 *  as. Returns null (and shows a warning) if the spellbook has no eligible
 *  spell at that level, or the dialog is cancelled. */
export async function promptFreeMagickSpell(actor: FreeMagickCastActor, spellLevel: number): Promise<string | null> {
  const eligible = [...actor.items].filter(
    (i) =>
      i.type === "spell" &&
      i.system.casterClass === "wizard" &&
      i.system.level === spellLevel &&
      actor.system.spellcasting.wizard.spellbookItemIds.includes(i.id),
  );
  if (eligible.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return null;
  }
  const options = eligible.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.sheet.spells.freeMagickCastTitle") },
    content: `<select name="spell" autofocus>${options}</select>`,
    ok: {
      label: game.i18n!.localize("ADND2E.sheet.spells.cast"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const select = button.form?.elements.namedItem("spell");
        return select instanceof HTMLSelectElement ? select.value : null;
      },
    },
  });
  return typeof value === "string" ? value : null;
}
```

- [ ] **Step 5: Wire the three new actions into `sheet.ts`**

Add to the import from `./spell-actions`: `memorizeFreeMagick, castFreeMagick, forgetFreeMagick,`. Add a new import: `import { promptFreeMagickLevel, promptFreeMagickSpell } from "./free-magick-dialog";`.

In the action-map object (alongside `memorizeSpell: Adnd2eCharacterSheet.#onMemorizeSpell,` etc.), add:
```typescript
      memorizeFreeMagick: Adnd2eCharacterSheet.#onMemorizeFreeMagick,
      castFreeMagick: Adnd2eCharacterSheet.#onCastFreeMagick,
      forgetFreeMagick: Adnd2eCharacterSheet.#onForgetFreeMagick,
```
Add the three handlers near `#onMemorizeSpell`/`#onCastSpell`/`#onForgetSpell`:
```typescript
  static async #onMemorizeFreeMagick(this: Adnd2eCharacterSheet): Promise<void> {
    const actor = this.document as unknown as { system: { spellcasting: { wizard: { spellPoints?: { maxSpellLevel?: number } } } } };
    const maxSpellLevel = actor.system.spellcasting.wizard.spellPoints?.maxSpellLevel;
    if (!maxSpellLevel) return;
    const level = await promptFreeMagickLevel(maxSpellLevel);
    if (level !== null) await memorizeFreeMagick(this.document as never, level);
  }

  static async #onCastFreeMagick(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const level = Number(target.dataset.level);
    if (!level) return;
    const spellId = await promptFreeMagickSpell(this.document as never, level);
    if (spellId) await castFreeMagick(this.document as never, level, spellId);
  }

  static async #onForgetFreeMagick(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const level = Number(target.dataset.level);
    if (level) await forgetFreeMagick(this.document as never, level);
  }
```

- [ ] **Step 6: Verify** — `npx vitest run tests/lang 2>&1 | tail -15` passes; typecheck and lint exit 0 (this task's `.ts` changes beyond lang are not unit-tested per Global Constraints — dev-world verification happens in Task 6).

- [ ] **Step 7: Commit**
```bash
git add src/sheets/character/spell-actions.ts src/sheets/character/free-magick-dialog.ts src/sheets/character/sheet.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp14a): fixed-magick spell-points gate + free-magick memorize/cast/forget

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sheet context, template, and the SP bar / Free Magicks panel

**Files:**
- Modify: `src/sheets/character/context-types.ts` (`CharacterSheetContext["spells"]`), `src/sheets/character/context.ts` (`buildSpells`, `buildSpellRow`), `templates/actor/pc/spells.hbs`, `lang/en.json`
- Test: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `spellPointsEnabled`, `magickCost`, `spellsMemorizedAtLevel` (Task 2); the cached `spellPoints`/widened `memorized` shape (Task 3).
- Produces: `CharacterSheetContext.spells.spellPoints`, `CharacterSheetContext.spells.freeMagicks`.

- [ ] **Step 1: Types**

`src/sheets/character/context-types.ts` — add to `CharacterSheetContext["spells"]` (sibling of `orphaned`):
```typescript
    /** Sub-project 14 Plan A: null when the rule is off or the actor has no wizard levels */
    spellPoints: { max: number; spent: number; remaining: number } | null;
    /** Sub-project 14 Plan A: one row per currently-memorized free magick, across all levels */
    freeMagicks: { level: number; expended: boolean }[];
```

- [ ] **Step 2: Failing tests**

Append to `tests/sheets/character/context.test.ts` (this file already imports `DEFAULT_OPTIONAL_RULES` for other sub-projects' toggle tests — reuse it; add the import only if it's somehow missing):
```typescript
describe("buildCharacterSheetContext — wizard spell points (SP14a)", () => {
  const spellPointsRules = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, spellPoints: true };
  const withSpellPoints = (over: Record<string, unknown> = {}) => ({
    ...input().derived,
    spellcasting: {
      wizard: {
        specialistSchool: null,
        slots: {},
        spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 15, spent: 4, remaining: 11 },
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

  it("rule off: no SP bar, no free magicks", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.spells.spellPoints).toBeNull();
    expect(c.spells.freeMagicks).toEqual([]);
  });

  it("rule on: exposes the SP bar", () => {
    const c = buildCharacterSheetContext(input({ derived: withSpellPoints(), optionalRules: spellPointsRules }));
    expect(c.spells.spellPoints).toEqual({ max: 15, spent: 4, remaining: 11 });
  });

  it("lists each memorized free magick, expended or not (independent of the rule's current on/off state — see plan's Locked design decisions)", () => {
    const derived = withSpellPoints({
      memorized: [
        { spellItemId: "s1", spellLevel: 1, expended: false, magickType: "fixed" },
        { spellItemId: null, spellLevel: 2, expended: false, magickType: "free" },
        { spellItemId: null, spellLevel: 2, expended: true, magickType: "free" },
      ],
    });
    const c = buildCharacterSheetContext(input({ derived, spellItems: [spell()], optionalRules: spellPointsRules }));
    expect(c.spells.freeMagicks).toEqual([
      { level: 2, expended: false },
      { level: 2, expended: true },
    ]);
  });

  it("a fixed-magick row's canMemorize gates on the flat per-level cap and remaining SP, not the classic SlotRecord", () => {
    const derived = withSpellPoints({ spellPoints: { maxSpellLevel: 2, maxPerLevel: 1, sp: 15, spent: 4, remaining: 11 }, memorized: [] });
    const atCap = buildCharacterSheetContext(
      input({
        derived: { ...derived, spellcasting: { ...derived.spellcasting, wizard: { ...derived.spellcasting.wizard, memorized: [{ spellItemId: "other", spellLevel: 1, expended: false, magickType: "fixed" }] } } },
        spellItems: [spell()],
        optionalRules: spellPointsRules,
      }),
    );
    expect(atCap.spells.known[0].items[0].canMemorize).toBe(false); // maxPerLevel 1, already 1 held at level 1

    const tooPoor = buildCharacterSheetContext(
      input({
        derived: { ...derived, spellcasting: { ...derived.spellcasting, wizard: { ...derived.spellcasting.wizard, spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 3, spent: 0, remaining: 3 } } } },
        spellItems: [spell()],
        optionalRules: spellPointsRules,
      }),
    );
    expect(tooPoor.spells.known[0].items[0].canMemorize).toBe(false); // needs 4 SP (level 1 fixed), only 3 available

    const affordable = buildCharacterSheetContext(
      input({
        derived: { ...derived, spellcasting: { ...derived.spellcasting, wizard: { ...derived.spellcasting.wizard, spellPoints: { maxSpellLevel: 2, maxPerLevel: 3, sp: 4, spent: 0, remaining: 4 } } } },
        spellItems: [spell()],
        optionalRules: spellPointsRules,
      }),
    );
    expect(affordable.spells.known[0].items[0].canMemorize).toBe(true); // exactly 4 SP for a level-1 fixed magick, room under the cap
  });
});
```
If any EXISTING test in this file compares the whole `spells` object with `toEqual` (grep `spells: {` results before this addition — none of the earlier fixtures set `spellPoints`/`freeMagicks`, so they need `spellPoints: null, freeMagicks: []` added to any such literal), fix it. Run `npx vitest run tests/sheets 2>&1 | tail -30` — FAIL.

- [ ] **Step 3: Implement**

`src/sheets/character/context.ts` — add the import: `import { magickCost, spellPointsEnabled, spellsMemorizedAtLevel } from "../../core/magic/spell-points";` and `import { getOptionalRules } from "../../settings";` if not already present under a different alias (check the existing import list first — `input.optionalRules` is already threaded through `CharacterSheetInput`, so prefer that over calling `getOptionalRules()` directly, matching this file's existing "no live Foundry API calls, everything comes through `input`" convention).

Change `buildSpells` to compute and pass through the new fields:
```typescript
function buildSpells(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const school = sc.wizard.specialistSchool;
  const priestChassisId =
    input.classItems.find((c) => getChassis(c.chassisId as ClassId).spellProgressionId === "priest")
      ?.chassisId ?? null;
  const sphereAccessOverride = sc.priest.sphereAccessOverride as SphereName[] | null;
  const int = input.derived.abilities.int.mods as IntelligenceModifiers;
  const specialistSchool = school as WizardSchool | null;
  const casting = buildCastingPanel(input);
  const spellPointsOn = spellPointsEnabled(input.optionalRules);
  // `?? {}` handles BOTH shapes the field can take: a test fixture that omits
  // it entirely (undefined), and real system data's ObjectField default of
  // `{}` (present but empty) when the rule is off or there's no wizard caster.
  const wizardSp = sc.wizard.spellPoints ?? {};

  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const levelItems = input.spellItems.filter((s) => s.level === level);
    const knownAtThisLevel = levelItems.filter((s) => s.casterClass === "wizard" && s.inSpellbook).length;
    const castableAtThisLevel = (sc.wizard.slots[level]?.max ?? 0) > 0;
    const learnCtx: LearnEligibilityContext = {
      int, specialistSchool, knownAtThisLevel, castableAtThisLevel, optionalRules: input.optionalRules,
    };
    let items = levelItems.map((s) =>
      buildSpellRow(s, sc, priestChassisId, sphereAccessOverride, learnCtx, fav, spellPointsOn, wizardSp),
    );
    items = casting ? items.map((r) => ({ ...r, canCast: false })) : items;
    if (items.length > 0) known.push({ level, items });
  }
  return {
    wizardSlots: toSlotRows(sc.wizard.slots),
    priestSlots: toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
    orphaned: buildOrphanedSpells(input, sc),
    casting,
    spellPoints:
      spellPointsOn && typeof wizardSp.remaining === "number"
        ? { max: wizardSp.sp ?? 0, spent: wizardSp.spent ?? 0, remaining: wizardSp.remaining }
        : null,
    freeMagicks: sc.wizard.memorized
      .filter((m) => m.magickType === "free")
      .map((m) => ({ level: m.spellLevel, expended: m.expended })),
  };
}
```
Change `buildSpellRow`'s signature and eligibility computation:
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
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;

  let hasFreeSlot: boolean;
  if (isWizard && spellPointsOn && wizardSp && typeof wizardSp.maxSpellLevel === "number") {
    hasFreeSlot =
      item.level <= wizardSp.maxSpellLevel &&
      spellsMemorizedAtLevel(sc.wizard.memorized, item.level) < (wizardSp.maxPerLevel ?? 0) &&
      (wizardSp.remaining ?? 0) >= magickCost(item.level, "fixed");
  } else {
    const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
    const slotRow = slots[item.level];
    hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
  }

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    canCast: memorized && !expended,
    canLearn: isWizard && !item.inSpellbook && canLearnForRow(item, learnCtx),
    favorite: fav("spell", item.id),
  };
}
```

- [ ] **Step 4: Template**

`templates/actor/pc/spells.hbs` — add an SP bar right after the wizard-slots panel's `{{/if}}` (before the priest-slots `{{#if}}`):
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
Add a Free Magicks panel right after the known-spells `</section>` (before the orphaned-spells `{{#if}}`):
```hbs
  {{#if adnd2e.spells.freeMagicks.length}}
    <section class="kit-panel">
      <div class="kit-bar">
        {{localize 'ADND2E.sheet.spells.freeMagick'}}
        <button type="button" class="kit-small" data-action="memorizeFreeMagick" style="margin-left:auto">
          {{localize 'ADND2E.sheet.spells.memorizeFreeMagick'}}
        </button>
      </div>
      <div class="kit-body">
        {{#each adnd2e.spells.freeMagicks as |m|}}
          <div class="spell-row{{#if m.expended}} expended{{/if}}">
            <span class="name">
              {{localize 'ADND2E.sheet.spells.freeMagickEntry' level=m.level}}
              {{#if m.expended}}
                <span class="badge expended-badge" title="{{localize 'ADND2E.sheet.spells.expended'}}">✓</span>
              {{/if}}
            </span>
            {{#unless m.expended}}
              <button type="button" data-action="castFreeMagick" data-level="{{m.level}}">
                {{localize 'ADND2E.sheet.spells.cast'}}
              </button>
            {{/unless}}
            <button type="button" data-action="forgetFreeMagick" data-level="{{m.level}}">
              {{localize 'ADND2E.sheet.spells.forget'}}
            </button>
          </div>
        {{/each}}
      </div>
    </section>
  {{/if}}
```
Also show the memorize option for free magick on the "Memorize" button's neighborhood — since a per-item row's Memorize button is for FIXED magick only (it targets one specific spell), the standalone `memorizeFreeMagick` button above (in the Free Magicks panel's bar) is the only entry point for free magick, and it's always shown whenever the panel has at least one existing free magick OR `spellPoints` is active; loosen the panel's guard to also show when `spellPoints` is active with zero entries yet:
```hbs
  {{#if adnd2e.spells.spellPoints}}
    <section class="kit-panel">
      <div class="kit-bar">
        {{localize 'ADND2E.sheet.spells.freeMagick'}}
        <button type="button" class="kit-small" data-action="memorizeFreeMagick" style="margin-left:auto">
          {{localize 'ADND2E.sheet.spells.memorizeFreeMagick'}}
        </button>
      </div>
      <div class="kit-body">
        {{#each adnd2e.spells.freeMagicks as |m|}}
          <div class="spell-row{{#if m.expended}} expended{{/if}}">
            <span class="name">
              {{localize 'ADND2E.sheet.spells.freeMagickEntry' level=m.level}}
              {{#if m.expended}}
                <span class="badge expended-badge" title="{{localize 'ADND2E.sheet.spells.expended'}}">✓</span>
              {{/if}}
            </span>
            {{#unless m.expended}}
              <button type="button" data-action="castFreeMagick" data-level="{{m.level}}">
                {{localize 'ADND2E.sheet.spells.cast'}}
              </button>
            {{/unless}}
            <button type="button" data-action="forgetFreeMagick" data-level="{{m.level}}">
              {{localize 'ADND2E.sheet.spells.forget'}}
            </button>
          </div>
        {{else}}
          <p class="placeholder">{{localize 'ADND2E.sheet.spells.none'}}</p>
        {{/each}}
      </div>
    </section>
  {{/if}}
```
(replacing the earlier `{{#if adnd2e.spells.freeMagicks.length}}` block with this `{{#if adnd2e.spells.spellPoints}}`-gated one — write only ONE such block in the final file, not both).

- [ ] **Step 5: Verify** — `npx vitest run tests/sheets 2>&1 | tail -30` passes; typecheck, lint, `npm run test:coverage` exit 0; `context.ts`/`context-types.ts` keep 100% line/stmt/func.

- [ ] **Step 6: Commit**
```bash
git add src/sheets/character/context.ts src/sheets/character/context-types.ts templates/actor/pc/spells.hbs lang/en.json tests/sheets/character/context.test.ts
git commit -m "feat(sp14a): SP bar and Free Magicks panel on the PC sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Whole-branch review, gated dev-world check, README update

- [ ] **Step 1: Whole-branch review (MANDATORY)** — run the project's `/code-review` (or equivalent) across every commit on this branch against the full diff from `master`, not task-by-task. Pay particular attention to: the `spellItemId: string | null` widening not silently breaking any code path that assumes a non-null id (grep every `.spellItemId` use across `src/`); the "Ruling PF-C" precedent being followed correctly in `deriveAndCache`; and that `canMemorizeWizardSpellPoints`/`spellsMemorizedAtLevel` are re-derived fresh on every call (never reading stale rendered UI state).

- [ ] **Step 2: Ask the user to close Foundry, then run `npm run build`** (never run this yourself without asking first, per Global Constraints).

- [ ] **Step 3: Gated dev-world check** — in a linked dev world:
  - Rule off: the wizard Spells tab looks and behaves exactly as before (classic slots panel, no SP bar, no Free Magicks panel).
  - Turn on `spellsAndMagicEnabled` + `spellPoints`, reload: the SP bar appears with the correct max/remaining; the classic wizard-slots panel is replaced in *effect* (memorize eligibility now follows the flat per-level cap + SP, even though the slots panel itself still renders using the old numbers — confirm this is acceptable display-only staleness, or note it as a follow-up if it's confusing in practice).
  - Memorize a fixed magick: SP bar's remaining drops by the correct Table 18 cost; hitting the flat per-level cap blocks a further memorize even with SP left; running out of SP blocks a further memorize even with a level slot open.
  - Memorize a free magick via the Free Magicks panel's button: a level-picker dialog appears (capped at the wizard's current max spell level); after confirming, a new "any level N spell" row appears and the SP bar debits the free-magick cost.
  - Cast the free magick: a spell-picker dialog appears, scoped to known wizard spells of that level; casting posts the normal cast card for the chosen spell and marks the row expended.
  - Forget a free magick (expended or not): the row disappears and the SP bar's remaining recovers.
  - Rest: `expended` clears on both fixed and free magick rows; the SP bar is unchanged (spend isn't released until the entry itself is forgotten, per spec §2).
  - A non-wizard actor (e.g. a cleric) with the rule on: no SP bar, no Free Magicks panel, priest slots unaffected.

- [ ] **Step 4: README update** — change row 14's status from 🔜 Planned next to ✅ Complete (Plan A scope only — wizard spell points); note Plan B (Channellers) remains tracked separately pending its own spec. Commit:
```bash
git add README.md
git commit -m "docs: mark Sub-project 14 Plan A (Wizard Spell Points) complete

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push and open the PR** (per this project's standing preference — always push + PR when a branch is done, without asking first).
