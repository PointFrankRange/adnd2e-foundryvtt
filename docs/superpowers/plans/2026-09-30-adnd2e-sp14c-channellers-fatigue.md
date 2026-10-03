# Sub-project 14 Plan C: Channellers Fatigue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Table 21 Spell Fatigue (*Player's Option: Spells & Magic* pp.82-84) for channelling wizards: 5 mutually-exclusive fatigue conditions with real roll-time combat penalties, HP/SP-based escalation, existing-fatigue stacking, a mortal-tier save-or-die, and a save-based recovery action — behind the `spellsAndMagicEnabled && spellPoints && channelers && channellerFatigue` settings gate.

**Architecture:** A pure `src/core/magic/channeller-fatigue.ts` owns the gate, Table 21's band lookup, HP/SP escalation, existing-fatigue stacking, and the per-tier combat/movement values. Two new pure functions in the existing `src/combat/condition-effects.ts` (Sub-project 7's own file) extend that file's established pattern — fatigue's attack/AC penalties are computed **live at roll time** by reading `actor.statuses`, exactly like `blindedAttackPenalty`/`proneArmorClassPenalty` already are, consumed at the same call sites in `src/sheets/character/combat-rolls.ts` and `src/sheets/creature/combat-rolls.ts`. A new Foundry-glue `applyCastFatigue` (in `spell-actions.ts`) runs right after a channelling cast's SP spend succeeds, at all three cast entry points Plan B's own final-review fix wave already touched; it applies the resolved condition via `actor.toggleStatusEffect` (the same real API this project already uses for maneuver-applied conditions) and triggers a save-or-die at the mortal tier. A new `src/sheets/character/fatigue-actions.ts` holds the two save-driven state machines (mortal save-or-die, Recover-from-Fatigue) using a small direct roll-and-return-boolean helper, not the existing player-facing `rollSave` (which posts a result asynchronously via a chat flag rather than returning it). Movement is the one display-only penalty, threaded through the sheet exactly like Plan B's casting status already is.

**Tech Stack:** TypeScript, Vite, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-30-adnd2e-sp14c-channellers-fatigue-design.md` — §1 (Table 21, escalation/stacking/recovery rules verbatim), §2 Decisions, §3 Global Constraints, §4-7.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — never `fvtt-types`.
- **Two-layer contract:** pure zone = `src/core/magic/channeller-fatigue.ts` and the 2 new functions added to `src/combat/condition-effects.ts` — no Foundry imports, **100% line/statement/function coverage** (branches ≥ 90). `context.ts`'s `buildVitals` movement-adjustment addition stays in that file's own existing pure/100%-covered zone with its own unit tests, per established Sub-project 2 precedent. Foundry layer (condition toggling, the cast-time hook, the two save-driven state machines, sheet wiring, templates) is typecheck/lint gated, dev-world verified, not unit-tested.
- **Content policy:** mechanical values only (Table 21's per-band-per-level tier lookup, the HP/SP escalation thresholds, the per-tier attack/AC/movement values, the per-tier recovery-interval labels) — no rules prose beyond short page citations in comments. The mortal tier gets no numeric AC penalty (the book gives none — do not invent one).
- **Gating (locked, spec §2):** `channellerFatigueEnabled(rules) = channellersEnabled(rules) && rules.channellerFatigue`, written **exactly once**, in Task 2. Every consumer calls it.
- **Reload:** `channellerFatigue` gets `requiresReload: true`, matching every other `spellsAndMagic` leaf toggle.
- **Additive schema only — no migration, no version bump:** one new persisted `fatigueSaveBonus: number` field (sibling of `channelling` on `spellcasting.wizard`); 5 new `CONDITIONS` entries + 5 new compendium pack documents.
- **Every action re-derives eligibility** from the actor's current state and current settings — never rendered UI state.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; implementers never run `npm run build`/`build:packs` (Foundry must be closed; the controller builds after the sheet task, re-confirming with the user first).
- **Read vitest output with `tail`/`head`/redirect, never `| grep`**; rerun a flaky first run 2-3× before concluding anything.
- **The whole-branch review (final task) is MANDATORY**, and the dev-world check is GATED — per the spec's own §3 note, budget specifically for testing the Expanded-Casting-Time combat-flow interaction, since that is the exact spot Plan B's own final review found a real bug in the sibling mechanic.

## Locked design decisions (this plan's own, resolving what the spec left to the plan)

1. **`MANAGED_CONDITIONS`/`ManagedConditionId` (`condition-effects.ts`) are NOT extended.** That type is specifically "conditions a combat maneuver can apply" (consumed by `core/combat/maneuvers.ts`), a different concern from "conditions with a roll-time mechanical consumer." Fatigue conditions are never a maneuver outcome. The existing `"is exactly the 4 curated conditions"` test is untouched.
2. **One canonical tier↔conditionId map.** `channeller-fatigue.ts` exports `FATIGUE_CONDITION_ID: Readonly<Record<FatigueTier, string>>` (`{light:"lightFatigue", moderate:"moderateFatigue", heavy:"heavyFatigue", severe:"severeFatigue", mortal:"mortalFatigue"}`) — the single place these 5 strings are written. `condition-effects.ts`'s two new functions, the cast-time apply logic, and the sheet's current-tier reader all import and use this same map; none restate the id strings.
3. **The movement penalty overwrites, not adds a field.** `buildVitals` applies `fatigueMovementRate` directly onto the existing `movement.current` number — `CharacterSheetContext.vitals.movement`'s shape is unchanged; the sheet already shows one movement number and continues to.
4. **`rollParalyzationSave` reuses `buildSaveCardContext`/`chat/save-roll.hbs`** (the same chat-card shape `rollSave` already posts) but is its own function, since both save-driven mechanics here need the pass/fail boolean synchronously, which `rollSave`'s fire-and-flag design does not provide. It takes an explicit `bonus` parameter added on top of the actor's own cached `saves.ppd.rollModifier` (0 for the mortal-fatigue save, the banked `fatigueSaveBonus` counter for a Recover attempt).
5. **`SpellcasterActor` (spell-actions.ts) is widened directly** with everything `applyCastFatigue`/the two save-driven functions need (`uuid`, `statuses`, `toggleStatusEffect`, `system.attributes.hp`, `system.saves.ppd`, `system.spellcasting.wizard.fatigueSaveBonus`) rather than creating a parallel narrower type. `casting-actions.ts`'s existing `CastingActor = SpellcasterActor & {...}` keeps its own `attributes.hp.value` extension untouched — the two declarations now overlap harmlessly (TypeScript intersects them without conflict) and `casting-actions.ts` does not need touching to gain the wider type.

---

### Task 1: Wire `channellerFatigue` into `OptionalRules`

**Files:**
- Modify: `src/core/options.ts`, `src/settings/registry.ts`, `lang/en.json`, `tests/core/options.test.ts`, `tests/settings/registry.test.ts`

**Interfaces:**
- Produces: `OptionalRules.channellerFatigue: boolean` (default `false`) — consumed by Task 2's gate.

- [ ] **Step 1: Update the tests (they must fail)**

In `tests/core/options.test.ts`: rename the first test to `"has exactly the twenty-three core, combatAndTactics, skillsAndPowers and spellsAndMagic toggles"`, add `"channellerFatigue"` to the key array, and add `channellerFatigue: false,` to the `expected` object (after `channelers: false,`).

In `tests/settings/registry.test.ts`, update:
```typescript
  it("registers 23 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(23);
    const byGroup = SETTING_DESCRIPTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.group] = (acc[d.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(byGroup).toEqual({
      core: 8,
      combatAndTactics: 6,
      skillsAndPowers: 4,
      spellsAndMagic: 5,
    });
  });
```
(this replaces the current `"registers 22 settings..."` test — `spellsAndMagic` grows from 4 to 5, total from 22 to 23). Update:
```typescript
  it("core, combatAndTactics, skillsAndPowers and five spellsAndMagic settings bind 1:1 to OptionalRules fields", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(23);
    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());
    const unbound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey === null).map((d) => d.key).sort();
    expect(unbound).toEqual([]);
  });

  it("exactly the eight prepare-time rules require a world reload", () => {
    const reload = ["channelers", "channellerFatigue", "characterPointBuild", "expandedCastingTime", "skillsAndPowersEnabled", "spellPoints", "spellsAndMagicEnabled", "subAbilityScores"];
    const keys = SETTING_DESCRIPTORS.filter((d) => d.requiresReload === true).map((d) => d.key);
    expect(keys.sort()).toEqual(reload);
    for (const d of SETTING_DESCRIPTORS) {
      if (reload.includes(d.key)) expect(d.requiresReload).toBe(true);
      else expect(d.requiresReload).not.toBe(true);
    }
  });
```
Note `"channellerFatigue"` sorts right after `"channelers"` (comparing character by character: both share the `"channel"` prefix, then `"channelers"` has `e` at the next position while `"channellerFatigue"` has `l` — `e` sorts first) and before `"characterPointBuild"` (`"channellerFatigue"` and `"characterPointBuild"` share only `"cha"`, then `n` vs `r` — `n` sorts first).

Run `npx vitest run tests/core/options.test.ts tests/settings 2>&1 | tail -20` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/core/options.ts` — add to the interface after `channelers`:
```typescript
  /** Sub-project 14 Plan C: Table 21 spell fatigue for channelling wizards (pp.82-84). */
  channellerFatigue: boolean;
```
and `channellerFatigue: false,` to `DEFAULT_OPTIONAL_RULES` (after `channelers: false,`). Update the header comment's description to mention Plan C exists now.

`src/settings/registry.ts` — add a new descriptor right after the `channelers` line:
```typescript
  { key: "channellerFatigue", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "channellerFatigue", requiresReload: true },
```

`lang/en.json` — add a new setting entry inside `ADND2E.settings` (sibling of `channelers`):
```json
      "channellerFatigue": {
        "name": "Spells & Magic: Channeller Fatigue",
        "hint": "Casting as a channeller risks escalating fatigue (Table 21) — real movement/attack/Armor Class penalties, up to incapacitation and a save-or-die at the worst tier. Requires Channelers to also be on."
      },
```

- [ ] **Step 3: Verify** — `npx vitest run tests/core tests/settings tests/lang tests/config 2>&1 | tail -20` passes; typecheck, lint and `npm run test:coverage` (each redirected to a file under `$TEMP` and read with `tail`) exit 0.

- [ ] **Step 4: Commit**
```bash
git add src/core/options.ts src/settings/registry.ts lang/en.json tests/core/options.test.ts tests/settings/registry.test.ts
git commit -m "feat(sp14c): wire channellerFatigue into OptionalRules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure `channeller-fatigue.ts` module (Table 21, escalation, stacking, per-tier values)

**Files:**
- Create: `src/core/magic/channeller-fatigue.ts`
- Modify: `src/core/magic/index.ts` (append `export * from "./channeller-fatigue";`)
- Test: `tests/core/magic/channeller-fatigue.test.ts`

**Interfaces:**
- Consumes: `OptionalRules` (Task 1); `channellersEnabled` (existing, `src/core/magic/channellers.ts`).
- Produces (Tasks 4-6): `channellerFatigueEnabled`, `type FatigueTier`, `FATIGUE_CONDITION_ID`, `baseFatigueTier`, `escalateForHp`, `escalateForSp`, `applyExistingFatigueStacking`, `resolveCastFatigue`, `FATIGUE_ATTACK_PENALTY`, `FATIGUE_AC_PENALTY`, `fatigueMovementRate`, `FATIGUE_RECOVERY_INTERVAL`, `nextTierDown`, `tierForConditionId`.

- [ ] **Step 1: Write the failing tests**

Create `tests/core/magic/channeller-fatigue.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  applyExistingFatigueStacking,
  baseFatigueTier,
  channellerFatigueEnabled,
  escalateForHp,
  escalateForSp,
  FATIGUE_AC_PENALTY,
  FATIGUE_ATTACK_PENALTY,
  FATIGUE_CONDITION_ID,
  FATIGUE_RECOVERY_INTERVAL,
  fatigueMovementRate,
  nextTierDown,
  resolveCastFatigue,
  tierForConditionId,
  type FatigueTier,
} from "../../../src/core/magic/channeller-fatigue";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("channellerFatigueEnabled (nested gate)", () => {
  it("needs channellersEnabled AND the channellerFatigue toggle", () => {
    expect(channellerFatigueEnabled(rules())).toBe(false);
    expect(
      channellerFatigueEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true, channelers: true })),
    ).toBe(false);
    expect(
      channellerFatigueEnabled(
        rules({ spellsAndMagicEnabled: true, spellPoints: true, channelers: true, channellerFatigue: true }),
      ),
    ).toBe(true);
    // channellerFatigue true but channelers false -> still false (nested gate)
    expect(
      channellerFatigueEnabled(
        rules({ spellsAndMagicEnabled: true, spellPoints: true, channellerFatigue: true }),
      ),
    ).toBe(false);
  });
});

describe("baseFatigueTier (Table 21)", () => {
  it("a 1st- or 2nd-level wizard: only heavy/severe/mortal are reachable (cantrip cells unreachable)", () => {
    expect(baseFatigueTier(1, 1)).toBe("heavy");
    expect(baseFatigueTier(2, 2)).toBe("severe");
    expect(baseFatigueTier(1, 3)).toBe("mortal");
    expect(baseFatigueTier(2, 9)).toBe("mortal");
  });
  it("a 7th/8th-level wizard matches the book's own worked examples (p.83): 1st=light, 2nd=moderate", () => {
    expect(baseFatigueTier(8, 1)).toBe("light");
    expect(baseFatigueTier(8, 2)).toBe("moderate");
    expect(baseFatigueTier(7, 3)).toBe("moderate");
    expect(baseFatigueTier(8, 4)).toBe("heavy");
    expect(baseFatigueTier(7, 5)).toBe("severe");
    expect(baseFatigueTier(8, 6)).toBe("mortal");
  });
  it("a 5th/6th-level wizard: fireball (3rd level) is heavy", () => {
    expect(baseFatigueTier(5, 3)).toBe("heavy");
  });
  it("the highest bands (26+) never reach heavy/severe/mortal", () => {
    expect(baseFatigueTier(30, 1)).toBe("light");
    expect(baseFatigueTier(30, 6)).toBe("light");
    expect(baseFatigueTier(30, 7)).toBe("moderate");
    expect(baseFatigueTier(30, 9)).toBe("moderate");
  });
  it("rejects an out-of-range spell level", () => {
    expect(() => baseFatigueTier(5, 0)).toThrow(RangeError);
    expect(() => baseFatigueTier(5, 10)).toThrow(RangeError);
  });
});

describe("escalateForHp (p.82-83)", () => {
  it("the book's own worked example: a 5th-level wizard (16 max HP) casting fireball (base: heavy)", () => {
    expect(escalateForHp("heavy", 16, 16)).toBe("heavy"); // full HP, no escalation
    expect(escalateForHp("heavy", 8, 16)).toBe("severe"); // exactly 50% -> +1
    expect(escalateForHp("heavy", 4, 16)).toBe("mortal"); // exactly 25% -> +2
  });
  it("clamps at mortal rather than overshooting", () => {
    expect(escalateForHp("severe", 1, 16)).toBe("mortal"); // +2 from severe would overshoot; clamp
  });
});

describe("escalateForSp (p.83)", () => {
  it("below 50% spent: no escalation", () => {
    expect(escalateForSp("moderate", 51, 100)).toBe("moderate"); // 49% spent
  });
  it("exactly 50% spent -> +1 tier", () => {
    expect(escalateForSp("moderate", 50, 100)).toBe("heavy");
  });
  it("just over 50% spent -> +1 tier (same band as exactly 50%)", () => {
    expect(escalateForSp("moderate", 49, 100)).toBe("heavy"); // 51% spent
  });
  it("exactly 75% spent -> +2 tiers", () => {
    expect(escalateForSp("moderate", 25, 100)).toBe("severe");
  });
  it("90% spent -> +2 tiers (same band as exactly 75%)", () => {
    expect(escalateForSp("light", 10, 100)).toBe("heavy"); // light shifted by 2 = heavy
  });
});

describe("applyExistingFatigueStacking (p.83) — the book's own worked example", () => {
  it("already moderately fatigued, casts a 2nd-level spell at level 7-8 (base moderate) -> becomes heavy", () => {
    expect(applyExistingFatigueStacking("moderate", "moderate")).toBe("heavy");
  });
  it("already moderately fatigued, casts a 1st-level spell at level 7-8 (base light) -> remains moderate", () => {
    expect(applyExistingFatigueStacking("light", "moderate")).toBe("moderate");
  });
  it("not currently fatigued (null) -> no shift, new tier used as-is", () => {
    expect(applyExistingFatigueStacking("heavy", null)).toBe("heavy");
  });
  it("heavily fatigued shifts the new cast's tier by 2", () => {
    expect(applyExistingFatigueStacking("light", "heavy")).toBe("heavy"); // light+2=heavy, worse-of(heavy,heavy)=heavy
  });
  it("severely fatigued shifts the new cast's tier by 3, clamped at mortal when it would overshoot", () => {
    expect(applyExistingFatigueStacking("heavy", "severe")).toBe("mortal"); // heavy+3 overshoots past mortal -> clamped
  });
});

describe("resolveCastFatigue — end to end against the book's own worked examples", () => {
  it("5th-level wizard, fireball (3rd level), at 50% HP, not previously fatigued -> severe", () => {
    expect(
      resolveCastFatigue({
        casterLevel: 5, spellLevel: 3, currentHp: 8, maxHp: 16, currentSp: 40, maxSp: 40, currentTier: null,
      }),
    ).toBe("severe");
  });
  it("same cast at 25% HP -> mortal", () => {
    expect(
      resolveCastFatigue({
        casterLevel: 5, spellLevel: 3, currentHp: 4, maxHp: 16, currentSp: 40, maxSp: 40, currentTier: null,
      }),
    ).toBe("mortal");
  });
});

describe("per-tier combat/movement/recovery data", () => {
  it("FATIGUE_ATTACK_PENALTY matches the book exactly", () => {
    expect(FATIGUE_ATTACK_PENALTY).toEqual({ light: 0, moderate: -1, heavy: -2, severe: -4, mortal: 0 });
  });
  it("FATIGUE_AC_PENALTY matches the book exactly (positive = worse AC)", () => {
    expect(FATIGUE_AC_PENALTY).toEqual({ light: 0, moderate: 0, heavy: 1, severe: 3, mortal: 0 });
  });
  it("fatigueMovementRate: light/moderate/heavy multiply and floor, severe is a flat 1, mortal is 0", () => {
    expect(fatigueMovementRate("light", 12)).toBe(9); // floor(12*0.75)
    expect(fatigueMovementRate("moderate", 12)).toBe(6);
    expect(fatigueMovementRate("heavy", 12)).toBe(3);
    expect(fatigueMovementRate("severe", 12)).toBe(1);
    expect(fatigueMovementRate("severe", 1)).toBe(1);
    expect(fatigueMovementRate("mortal", 12)).toBe(0);
  });
  it("FATIGUE_RECOVERY_INTERVAL matches the book", () => {
    expect(FATIGUE_RECOVERY_INTERVAL).toEqual({
      light: "round", moderate: "round", heavy: "turn", severe: "hour", mortal: "hour",
    });
  });
});

describe("FATIGUE_CONDITION_ID / tierForConditionId", () => {
  it("round-trips every tier through its condition id", () => {
    const tiers: FatigueTier[] = ["light", "moderate", "heavy", "severe", "mortal"];
    for (const t of tiers) expect(tierForConditionId(FATIGUE_CONDITION_ID[t])).toBe(t);
  });
  it("returns null for a non-fatigue status id", () => {
    expect(tierForConditionId("prone")).toBeNull();
  });
});

describe("nextTierDown", () => {
  it("steps down the ladder, null below light", () => {
    expect(nextTierDown("mortal")).toBe("severe");
    expect(nextTierDown("severe")).toBe("heavy");
    expect(nextTierDown("heavy")).toBe("moderate");
    expect(nextTierDown("moderate")).toBe("light");
    expect(nextTierDown("light")).toBeNull();
  });
});
```

Run `npx vitest run tests/core/magic/channeller-fatigue.test.ts 2>&1 | tail -30` — FAIL (module not found).

- [ ] **Step 2: Implement**

Create `src/core/magic/channeller-fatigue.ts`:
```typescript
// Player's Option: Spells & Magic pp.82-84 (Sub-project 14 Plan C): Table 21
// Spell Fatigue for channelling wizards. Table 21's rows are caster-level
// BANDS (same shape as core/saves/tables.ts's SAVE_MATRICES); its columns are
// which SPELL level causes each tier. Re-expressed here as a literal 9-entry
// (spell levels 1-9) tier array per band rather than range-matching logic —
// every "cantrip"-only cell is simply unreachable (this project's spell
// schema has no level 0, matching how Plans A/B already treat cantrips).
// Pure.
import { assertLevel, assertSpellLevel } from "../errors";
import { channellersEnabled } from "./channellers";
import type { OptionalRules } from "../options";

/** THE one place the fatigue gate is written — nests under Plan B's own gate. */
export function channellerFatigueEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints" | "channelers" | "channellerFatigue">,
): boolean {
  return channellersEnabled(rules) && rules.channellerFatigue;
}

export type FatigueTier = "light" | "moderate" | "heavy" | "severe" | "mortal";

/** Severity order, lowest to highest — index doubles as a shift amount. */
const TIER_ORDER: readonly FatigueTier[] = ["light", "moderate", "heavy", "severe", "mortal"];

function shiftTier(tier: FatigueTier, amount: number): FatigueTier {
  const index = Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + amount);
  return TIER_ORDER[index]!;
}

function worseOf(a: FatigueTier, b: FatigueTier): FatigueTier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

interface FatigueBand {
  minLevel: number;
  /** tiers[spellLevel - 1] for spell levels 1-9. */
  tiers: readonly FatigueTier[];
}

// prettier-ignore
const FATIGUE_BANDS: readonly FatigueBand[] = [
  { minLevel: 1,  tiers: ["heavy", "severe", "mortal", "mortal", "mortal", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 3,  tiers: ["moderate", "heavy", "severe", "mortal", "mortal", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 5,  tiers: ["moderate", "moderate", "heavy", "severe", "mortal", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 7,  tiers: ["light", "moderate", "moderate", "heavy", "severe", "mortal", "mortal", "mortal", "mortal"] },
  { minLevel: 9,  tiers: ["light", "light", "moderate", "moderate", "heavy", "severe", "mortal", "mortal", "mortal"] },
  { minLevel: 12, tiers: ["light", "light", "light", "moderate", "moderate", "heavy", "severe", "mortal", "mortal"] },
  { minLevel: 14, tiers: ["light", "light", "light", "light", "moderate", "moderate", "heavy", "severe", "mortal"] },
  { minLevel: 16, tiers: ["light", "light", "light", "light", "light", "moderate", "moderate", "heavy", "severe"] },
  { minLevel: 18, tiers: ["light", "light", "light", "light", "light", "moderate", "moderate", "heavy", "heavy"] },
  { minLevel: 20, tiers: ["light", "light", "light", "light", "light", "moderate", "moderate", "moderate", "heavy"] },
  { minLevel: 23, tiers: ["light", "light", "light", "light", "light", "light", "moderate", "moderate", "heavy"] },
  { minLevel: 26, tiers: ["light", "light", "light", "light", "light", "light", "moderate", "moderate", "moderate"] },
];

/** Table 21: the base fatigue tier for casting `spellLevel` at `casterLevel`, BEFORE HP/SP escalation or stacking. */
export function baseFatigueTier(casterLevel: number, spellLevel: number): FatigueTier {
  assertLevel(casterLevel, "casterLevel");
  assertSpellLevel(spellLevel);
  let band = FATIGUE_BANDS[0]!;
  for (const b of FATIGUE_BANDS) {
    if (casterLevel >= b.minLevel) band = b;
  }
  return band.tiers[spellLevel - 1]!;
}

/** p.82-83: HP loss escalation, measured BEFORE this cast's own effects. */
export function escalateForHp(tier: FatigueTier, currentHp: number, maxHp: number): FatigueTier {
  if (currentHp <= maxHp * 0.25) return shiftTier(tier, 2);
  if (currentHp <= maxHp * 0.5) return shiftTier(tier, 1);
  return tier;
}

/** p.83: SP loss escalation — `currentSp`/`maxSp` measured BEFORE this cast's own cost is deducted. */
export function escalateForSp(tier: FatigueTier, currentSp: number, maxSp: number): FatigueTier {
  const spentFraction = 1 - currentSp / maxSp;
  if (spentFraction >= 0.75) return shiftTier(tier, 2);
  if (spentFraction >= 0.5) return shiftTier(tier, 1);
  return tier;
}

/** p.83: "increase the fatigue category of the new spell by one level if
 *  moderately fatigued, two if heavily, three if severely fatigued. The
 *  character then acquires the new fatigue level... or stays where he was,
 *  whichever is worse." `currentTier: null` means not currently fatigued. */
export function applyExistingFatigueStacking(newTier: FatigueTier, currentTier: FatigueTier | null): FatigueTier {
  if (currentTier === null || currentTier === "light") return newTier;
  const shiftAmount = currentTier === "moderate" ? 1 : currentTier === "heavy" ? 2 : 3; // "severe"
  return worseOf(shiftTier(newTier, shiftAmount), currentTier);
}

export interface ResolveCastFatigueInput {
  casterLevel: number;
  spellLevel: number;
  /** before this cast's own effects */
  currentHp: number;
  maxHp: number;
  /** before this cast's own cost is deducted */
  currentSp: number;
  maxSp: number;
  currentTier: FatigueTier | null;
}

/** Composes the book's own order: base tier -> HP escalation -> SP escalation -> existing-fatigue stacking. */
export function resolveCastFatigue(input: ResolveCastFatigueInput): FatigueTier {
  let tier = baseFatigueTier(input.casterLevel, input.spellLevel);
  tier = escalateForHp(tier, input.currentHp, input.maxHp);
  tier = escalateForSp(tier, input.currentSp, input.maxSp);
  return applyExistingFatigueStacking(tier, input.currentTier);
}

/** p.83 "Effects of Fatigue" — attack-roll penalty (negative = worse). Mortal
 *  is handled by canAct() blocking the roll entirely (condition-effects.ts),
 *  not a numeric penalty. */
export const FATIGUE_ATTACK_PENALTY: Readonly<Record<FatigueTier, number>> = {
  light: 0, moderate: -1, heavy: -2, severe: -4, mortal: 0,
};

/** Same sign convention as proneArmorClassPenalty (positive = worse AC). The
 *  book gives no numeric AC penalty for mortal (incapacitated instead). */
export const FATIGUE_AC_PENALTY: Readonly<Record<FatigueTier, number>> = {
  light: 0, moderate: 0, heavy: 1, severe: 3, mortal: 0,
};

/** p.83: light/moderate/heavy are fractions of the current rate (floored);
 *  severe is a flat rate of 1 regardless of input; mortal is 0 ("collapse"). */
export function fatigueMovementRate(tier: FatigueTier, currentRate: number): number {
  switch (tier) {
    case "light": return Math.floor(currentRate * 0.75);
    case "moderate": return Math.floor(currentRate * 0.5);
    case "heavy": return Math.floor(currentRate * 0.25);
    case "severe": return 1;
    case "mortal": return 0;
  }
}

/** p.83 "Recovering from Fatigue" — the rest unit each tier's save interval
 *  uses. Display/hint text only (§2 of the spec: honor system, no real-time
 *  enforcement). Mortal has no recovery path of its own (it resolves
 *  immediately via save-or-die) — included only so the type is total. */
export const FATIGUE_RECOVERY_INTERVAL: Readonly<Record<FatigueTier, "round" | "turn" | "hour">> = {
  light: "round", moderate: "round", heavy: "turn", severe: "hour", mortal: "hour",
};

/** The single canonical tier -> CONDITIONS id map (locked design decision 2) — every other consumer imports this, never restates the 5 strings. */
export const FATIGUE_CONDITION_ID: Readonly<Record<FatigueTier, string>> = {
  light: "lightFatigue", moderate: "moderateFatigue", heavy: "heavyFatigue", severe: "severeFatigue", mortal: "mortalFatigue",
};

const CONDITION_ID_TO_TIER: ReadonlyMap<string, FatigueTier> = new Map(
  (Object.entries(FATIGUE_CONDITION_ID) as [FatigueTier, string][]).map(([tier, id]) => [id, tier]),
);

/** Reverse of FATIGUE_CONDITION_ID — null if `conditionId` isn't a fatigue tier id. */
export function tierForConditionId(conditionId: string): FatigueTier | null {
  return CONDITION_ID_TO_TIER.get(conditionId) ?? null;
}

/** One step down the ladder; null means fatigue clears entirely (below light). */
export function nextTierDown(tier: FatigueTier): FatigueTier | null {
  const index = TIER_ORDER.indexOf(tier) - 1;
  return index < 0 ? null : TIER_ORDER[index]!;
}
```
Append `export * from "./channeller-fatigue";` to `src/core/magic/index.ts`.

- [ ] **Step 3: Verify** — the focused test passes; typecheck, lint and `npm run test:coverage` exit 0 with `channeller-fatigue.ts` at 100%.

- [ ] **Step 4: Commit**
```bash
git add src/core/magic tests/core/magic/channeller-fatigue.test.ts
git commit -m "feat(sp14c): pure channeller-fatigue module (Table 21, escalation, stacking)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: The 5 fatigue conditions (CONDITIONS + compendium pack)

**Files:**
- Modify: `src/conditions.ts`, `packs/conditions/_source/_MANIFEST.md`
- Create: `packs/conditions/_source/light-fatigue.json`, `packs/conditions/_source/moderate-fatigue.json`, `packs/conditions/_source/heavy-fatigue.json`, `packs/conditions/_source/severe-fatigue.json`, `packs/conditions/_source/mortal-fatigue.json`

**Interfaces:**
- Consumes: `FATIGUE_CONDITION_ID` (Task 2, for the exact ids — `lightFatigue`/`moderateFatigue`/`heavyFatigue`/`severeFatigue`/`mortalFatigue`).
- Produces (Tasks 4-6): 5 new entries actors can carry in `actor.statuses`.

- [ ] **Step 1: Add the 5 entries to `CONDITIONS`**

In `src/conditions.ts`, append to the `CONDITIONS` array (after `dead`):
```typescript
  { id: "lightFatigue", name: "Lightly Fatigued", img: "icons/svg/degen.svg" },
  { id: "moderateFatigue", name: "Moderately Fatigued", img: "icons/svg/downgrade.svg" },
  { id: "heavyFatigue", name: "Heavily Fatigued", img: "icons/svg/stoned.svg" },
  { id: "severeFatigue", name: "Severely Fatigued", img: "icons/svg/frozen.svg" },
  { id: "mortalFatigue", name: "Mortally Fatigued", img: "icons/svg/death-hand.svg" },
```
Update the file's own header comment to note the count is now 20, Sub-project 14 Plan C added the 5 fatigue entries.

- [ ] **Step 2: Add the 5 compendium pack source documents**

Create `packs/conditions/_source/light-fatigue.json`:
```json
{
  "_id": "FatigueLight0001",
  "_key": "!items!FatigueLight0001",
  "name": "Lightly Fatigued",
  "type": "condition",
  "img": "icons/svg/degen.svg",
  "system": {
    "conditionId": "lightFatigue",
    "description": ""
  }
}
```
Create `packs/conditions/_source/moderate-fatigue.json`:
```json
{
  "_id": "FatigueModrt0002",
  "_key": "!items!FatigueModrt0002",
  "name": "Moderately Fatigued",
  "type": "condition",
  "img": "icons/svg/downgrade.svg",
  "system": {
    "conditionId": "moderateFatigue",
    "description": ""
  }
}
```
Create `packs/conditions/_source/heavy-fatigue.json`:
```json
{
  "_id": "FatigueHeavy0003",
  "_key": "!items!FatigueHeavy0003",
  "name": "Heavily Fatigued",
  "type": "condition",
  "img": "icons/svg/stoned.svg",
  "system": {
    "conditionId": "heavyFatigue",
    "description": ""
  }
}
```
Create `packs/conditions/_source/severe-fatigue.json`:
```json
{
  "_id": "FatigueSevre0004",
  "_key": "!items!FatigueSevre0004",
  "name": "Severely Fatigued",
  "type": "condition",
  "img": "icons/svg/frozen.svg",
  "system": {
    "conditionId": "severeFatigue",
    "description": ""
  }
}
```
Create `packs/conditions/_source/mortal-fatigue.json`:
```json
{
  "_id": "FatigueMortl0005",
  "_key": "!items!FatigueMortl0005",
  "name": "Mortally Fatigued",
  "type": "condition",
  "img": "icons/svg/death-hand.svg",
  "system": {
    "conditionId": "mortalFatigue",
    "description": ""
  }
}
```

Update `packs/conditions/_source/_MANIFEST.md`'s condition table to add the 5 new rows (after `dead`) and change "Fifteen status conditions" to "Twenty status conditions" in the opening paragraph.

- [ ] **Step 3: Verify** — `npx vitest run tests/conditions.test.ts 2>&1 | tail -20` passes with no changes to that test file (it drift-checks dynamically against `CONDITIONS.length`); typecheck and lint exit 0.

- [ ] **Step 4: Commit**
```bash
git add src/conditions.ts packs/conditions/_source
git commit -m "feat(sp14c): add the 5 fatigue conditions (CONDITIONS + compendium pack)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Roll-time combat penalties (`condition-effects.ts` + both combat-rolls.ts files)

**Files:**
- Modify: `src/combat/condition-effects.ts`, `src/sheets/character/combat-rolls.ts`, `src/sheets/creature/combat-rolls.ts`
- Test: append to `tests/combat/condition-effects.test.ts`

**Interfaces:**
- Consumes: `FATIGUE_CONDITION_ID`, `FATIGUE_ATTACK_PENALTY`, `FATIGUE_AC_PENALTY`, `type FatigueTier` (Task 2).
- Produces (Tasks 5-6 don't need these directly; this task is self-contained for roll-time combat): `fatigueAttackPenalty`, `fatigueArmorClassPenalty`, `canAct`'s widened exclusion.

- [ ] **Step 1: Failing tests**

First, change the file's existing import line from:
```typescript
import {
  blindedAttackPenalty,
  proneArmorClassPenalty,
  heldAttackBonus,
  canAct,
  MANAGED_CONDITIONS,
} from "../../src/combat/condition-effects";
```
to add the two new names (do not add a second, separate import statement for the same module):
```typescript
import {
  blindedAttackPenalty,
  proneArmorClassPenalty,
  heldAttackBonus,
  canAct,
  MANAGED_CONDITIONS,
  fatigueAttackPenalty,
  fatigueArmorClassPenalty,
} from "../../src/combat/condition-effects";
```
Then append the new tests:
```typescript
describe("fatigueAttackPenalty", () => {
  it("matches FATIGUE_ATTACK_PENALTY for each tier's condition id", () => {
    expect(fatigueAttackPenalty(["lightFatigue"])).toBe(0);
    expect(fatigueAttackPenalty(["moderateFatigue"])).toBe(-1);
    expect(fatigueAttackPenalty(["heavyFatigue"])).toBe(-2);
    expect(fatigueAttackPenalty(["severeFatigue"])).toBe(-4);
    expect(fatigueAttackPenalty(["mortalFatigue"])).toBe(0);
  });
  it("is 0 when no fatigue condition is present", () => {
    expect(fatigueAttackPenalty([])).toBe(0);
    expect(fatigueAttackPenalty(["prone"])).toBe(0);
  });
});

describe("fatigueArmorClassPenalty", () => {
  it("matches FATIGUE_AC_PENALTY for each tier's condition id", () => {
    expect(fatigueArmorClassPenalty(["heavyFatigue"])).toBe(1);
    expect(fatigueArmorClassPenalty(["severeFatigue"])).toBe(3);
    expect(fatigueArmorClassPenalty(["lightFatigue"])).toBe(0);
    expect(fatigueArmorClassPenalty(["mortalFatigue"])).toBe(0);
  });
  it("is 0 when no fatigue condition is present", () => {
    expect(fatigueArmorClassPenalty([])).toBe(0);
  });
});

describe("canAct — mortal fatigue", () => {
  it("blocks acting while mortally fatigued, same as stunned/held", () => {
    expect(canAct(["mortalFatigue"])).toBe(false);
  });
  it("does not block acting at any other fatigue tier", () => {
    expect(canAct(["severeFatigue"])).toBe(true);
    expect(canAct(["lightFatigue"])).toBe(true);
  });
});
```
(`canAct` is already imported at the top of this test file.) Run `npx vitest run tests/combat/condition-effects.test.ts 2>&1 | tail -30` — FAIL (new exports don't exist yet).

- [ ] **Step 2: Implement in `condition-effects.ts`**

Add the import at the top: `import { FATIGUE_ATTACK_PENALTY, FATIGUE_AC_PENALTY, FATIGUE_CONDITION_ID } from "../core/magic/channeller-fatigue";`.

Add, after `heldAttackBonus`:
```typescript
/** Sub-project 14 Plan C: a fatigued actor's own attack-roll penalty (p.83).
 *  At most one fatigue tier is ever present on an actor (mutually exclusive). */
export function fatigueAttackPenalty(actorStatuses: StatusSet): number {
  for (const [tier, id] of Object.entries(FATIGUE_CONDITION_ID)) {
    if (has(actorStatuses, id)) return FATIGUE_ATTACK_PENALTY[tier as keyof typeof FATIGUE_ATTACK_PENALTY];
  }
  return 0;
}

/** Sub-project 14 Plan C: a fatigued actor's own Armor Class penalty (p.83),
 *  same sign convention as proneArmorClassPenalty. */
export function fatigueArmorClassPenalty(actorStatuses: StatusSet): number {
  for (const [tier, id] of Object.entries(FATIGUE_CONDITION_ID)) {
    if (has(actorStatuses, id)) return FATIGUE_AC_PENALTY[tier as keyof typeof FATIGUE_AC_PENALTY];
  }
  return 0;
}
```
Change `canAct`:
```typescript
export function canAct(actorStatuses: StatusSet): boolean {
  return !has(actorStatuses, "stunned") && !has(actorStatuses, "held") && !has(actorStatuses, "mortalFatigue");
}
```

- [ ] **Step 3: Wire into both `combat-rolls.ts` files**

`src/sheets/character/combat-rolls.ts`:
- Add `fatigueAttackPenalty, fatigueArmorClassPenalty,` to the existing import from `../../combat/condition-effects`.
- Line ~281, change:
  ```typescript
    targetAc = info.ac + proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>());
  ```
  to:
  ```typescript
    targetAc =
      info.ac +
      proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>()) +
      fatigueArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>());
  ```
- Line ~329, change:
  ```typescript
      situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + armorVsWeaponModifier + maneuverPenalty,
  ```
  to:
  ```typescript
      situationalModifier:
        blindedAttackPenalty(actor.statuses) +
        fatigueAttackPenalty(actor.statuses) +
        heldAttackBonus(targetStatuses) +
        armorVsWeaponModifier +
        maneuverPenalty,
  ```

`src/sheets/creature/combat-rolls.ts`:
- Add `fatigueAttackPenalty, fatigueArmorClassPenalty,` to the existing import from `../../combat/condition-effects`.
- Change:
  ```typescript
    targetAc = info.ac + proneArmorClassPenalty(targetStatuses);
  ```
  to:
  ```typescript
    targetAc = info.ac + proneArmorClassPenalty(targetStatuses) + fatigueArmorClassPenalty(targetStatuses);
  ```
- Change:
  ```typescript
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + armorVsWeaponModifier,
  ```
  to:
  ```typescript
    situationalModifier:
      blindedAttackPenalty(actor.statuses) +
      fatigueAttackPenalty(actor.statuses) +
      heldAttackBonus(targetStatuses) +
      armorVsWeaponModifier,
  ```

Both files get this wiring even though only PC/Character-NPC wizards can ever become fatigued through gameplay — every condition's mechanical effect is universal across actor types in this codebase already (locked design decision; see spec §4.4).

- [ ] **Step 4: Verify** — `npx vitest run tests/combat/condition-effects.test.ts 2>&1 | tail -30` passes; typecheck, lint, `npm run test:coverage` exit 0 with `condition-effects.ts` at 100%. The two `combat-rolls.ts` changes are Foundry-coupled (not independently unit-tested per this project's two-layer contract) — confirm only typecheck/lint pass for them.

- [ ] **Step 5: Commit**
```bash
git add src/combat/condition-effects.ts src/sheets/character/combat-rolls.ts src/sheets/creature/combat-rolls.ts tests/combat/condition-effects.test.ts
git commit -m "feat(sp14c): fatigue attack/AC penalties at roll time, mortal fatigue blocks acting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Schema + cast-time fatigue application

**Files:**
- Modify: `src/data/actor/base-actor.ts`, `src/sheets/character/spell-actions.ts`, `src/sheets/character/casting-actions.ts`, `lang/en.json`
- Test: append to `tests/lang/en-coverage.test.ts` (lang only — the rest of this task is Foundry-coupled, typecheck/lint gated, dev-world verified)

**Interfaces:**
- Consumes: `resolveCastFatigue`, `channellerFatigueEnabled`, `FATIGUE_CONDITION_ID`, `tierForConditionId`, `type FatigueTier` (Task 2); `tryChannellingSpend` (existing, Plan B).
- Produces (Task 6): `applyCastFatigue(actor, spellLevel): Promise<void>`, consumed by Task 6's `resolveMortalFatigue`.

- [ ] **Step 1: Schema field**

In `src/data/actor/base-actor.ts`, in the `wizard: new SchemaField({ ... })` block, add a sibling of `channelling` right after it:
```typescript
        /** Sub-project 14 Plan C: a banked bonus toward the next Recover-from-
         *  Fatigue saving throw — persisted exactly like channelling.current;
         *  resets to 0 on a successful recovery save, increments by 1 on a
         *  failed one. */
        fatigueSaveBonus: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
```

- [ ] **Step 2: Widen `SpellcasterActor`**

In `src/sheets/character/spell-actions.ts`, change the `SpellcasterActor` interface:
```typescript
export interface SpellcasterActor {
  name: string;
  img: string;
  statuses: ReadonlySet<string>;
  system: {
    abilities: { int: { mods: IntelligenceModifiers } };
    attributes: { hp: { value: number; max: number } };
    saves: { ppd: { target: number; rollModifier: number } };
    spellcasting: {
      wizard: {
        specialistSchool: string | null;
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        spellPoints: { maxSpellLevel?: number; maxPerLevel?: number; sp?: number; spent?: number; remaining?: number };
        channelling: { current?: number; max?: number };
        fatigueSaveBonus: number;
        spellbookItemIds: string[];
      };
      priest: {
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        sphereAccessOverride: string[] | null;
      };
    };
  };
  items: { get(id: string): SpellItemHandle | undefined } & Iterable<GenericItemHandle>;
  update(data: Record<string, unknown>): Promise<unknown>;
  toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
}
```
(`casting-actions.ts`'s own `CastingActor = SpellcasterActor & {...}` needs no change — its existing `attributes.hp.value` extension now simply overlaps harmlessly with this wider base type. No `uuid` field is needed — this task's new code posts chat messages the same way `postCastCard` already does, via `ChatMessage.getSpeaker({ actor: actor as never })`, never a direct `.uuid` read.)

- [ ] **Step 3: `applyCastFatigue`**

Add the import to `spell-actions.ts`: `import { channellerFatigueEnabled, FATIGUE_CONDITION_ID, resolveCastFatigue, tierForConditionId, type FatigueTier } from "../../core/magic/channeller-fatigue";` and `import { classItemLevel } from "../../data/derive/class-item";`.

Add a new helper right after `findPriestChassisId` (mirroring its exact "scan owned class items, ask `getChassis` for the matching progression" pattern, but for wizards and returning a derived level, not just the chassis id):
```typescript
/** Finds the actor's wizard-progression class item (if any) and returns its
 *  current level, derived from its xp exactly like context.ts's own class
 *  rows are (classItemLevel). Returns 0 if no such class exists — in
 *  practice applyCastFatigue is only ever called once a channelling cast has
 *  already succeeded, so a real wizard-progression class is guaranteed. */
function wizardCasterLevel(actor: SpellcasterActor): number {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = item.system.chassisId as ClassId | undefined;
    if (chassisId && getChassis(chassisId).spellProgressionId === "wizard") {
      return classItemLevel(chassisId, (item.system.xp as number | undefined) ?? 0);
    }
  }
  return 0;
}
```

Append near `tryChannellingSpend`:
```typescript
/** Sub-project 14 Plan C: resolves and applies this cast's fatigue tier —
 *  called AFTER a channelling cast's SP spend has already succeeded, with the
 *  PRE-deduction current SP (the book counts spell points "before the spell
 *  is cast", p.83). No-ops entirely when the rule is off. Clears any other
 *  fatigue condition before applying the new one (they're mutually
 *  exclusive). Does not itself resolve the mortal-tier save-or-die — the
 *  caller checks the return value and, if it's "mortal", invokes
 *  fatigue-actions.ts's resolveMortalFatigue (Task 6) separately, since that
 *  needs a dice roll this pure-glue function does not perform. */
export async function applyCastFatigue(
  actor: SpellcasterActor,
  spellLevel: number,
  preDeductionSp: number,
): Promise<FatigueTier | null> {
  if (!channellerFatigueEnabled(getOptionalRules())) return null;
  const currentTier = [...actor.statuses].map(tierForConditionId).find((t) => t !== null) ?? null;
  const maxSp = actor.system.spellcasting.wizard.channelling.max ?? 0;
  const resolved = resolveCastFatigue({
    casterLevel: wizardCasterLevel(actor),
    spellLevel,
    currentHp: actor.system.attributes.hp.value,
    maxHp: actor.system.attributes.hp.max,
    currentSp: preDeductionSp,
    maxSp,
    currentTier,
  });
  if (resolved === currentTier) return resolved;
  for (const id of Object.values(FATIGUE_CONDITION_ID)) {
    if (id !== FATIGUE_CONDITION_ID[resolved] && actor.statuses.has(id)) {
      await actor.toggleStatusEffect(id, { active: false });
    }
  }
  if (resolved !== "mortal") {
    await actor.toggleStatusEffect(FATIGUE_CONDITION_ID[resolved], { active: true });
  }
  return resolved;
}
```
(When `resolved === "mortal"`, this function deliberately does NOT toggle the `mortalFatigue` condition itself — Task 6's `resolveMortalFatigue` handles that as part of resolving the save-or-die, since a *successful* save means the actor becomes `severeFatigue`, not `mortalFatigue`, and the condition should never visibly flash to mortal first.)

- [ ] **Step 4: Wire into the 3 cast call sites**

Add one more import to `spell-actions.ts`: `import { resolveMortalFatigue } from "./fatigue-actions";` (Task 6 creates this file — tasks run in sequence, so it exists by the time this task's own verify step runs after Task 6; if you are implementing Task 5 in isolation before Task 6 exists, typecheck will fail only on this one import until Task 6 lands, which is expected).

In `castSpell`'s channelling branch, change:
```typescript
  if (channelling) {
    const spent = tryChannellingSpend(actor, entry.spellLevel, entry.magickType ?? "fixed");
    if (spent === null) return;
    const rolled = await rollSpellAutomation(spell);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spent,
    });
    await postCastCard(actor, spell, rolled);
    return;
  }
```
to:
```typescript
  if (channelling) {
    const preDeductionSp = actor.system.spellcasting.wizard.channelling.current ?? 0;
    const spent = tryChannellingSpend(actor, entry.spellLevel, entry.magickType ?? "fixed");
    if (spent === null) return;
    const rolled = await rollSpellAutomation(spell);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spent,
    });
    await postCastCard(actor, spell, rolled);
    const resolvedTier = await applyCastFatigue(actor, entry.spellLevel, preDeductionSp);
    if (resolvedTier === "mortal") await resolveMortalFatigue(actor);
    return;
  }
```
(`preDeductionSp` is captured BEFORE `tryChannellingSpend` runs — that function only computes and returns the new value, it does not itself write anything, so the actor's live `channelling.current` is still the pre-cast number right up until the `actor.update` call three lines later. Fatigue is resolved AFTER `postCastCard`, so the chat log reads "spell cast" then, if applicable, "fatigue sets in" — not the other way around.)

Apply the equivalent fix to `castFreeMagick`'s channelling branch, changing:
```typescript
  if (channelling) {
    const spent = tryChannellingSpend(actor, spellLevel, "free");
    if (spent === null) return;
    const rolled = await rollSpellAutomation(chosen);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spent,
    });
    await postCastCard(actor, chosen, rolled);
    return;
  }
```
to:
```typescript
  if (channelling) {
    const preDeductionSp = actor.system.spellcasting.wizard.channelling.current ?? 0;
    const spent = tryChannellingSpend(actor, spellLevel, "free");
    if (spent === null) return;
    const rolled = await rollSpellAutomation(chosen);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spent,
    });
    await postCastCard(actor, chosen, rolled);
    const resolvedTier = await applyCastFatigue(actor, spellLevel, preDeductionSp);
    if (resolvedTier === "mortal") await resolveMortalFatigue(actor);
    return;
  }
```

In `casting-actions.ts`'s `castOrBegin`, add the imports: `applyCastFatigue,` to the existing import list already there from `./spell-actions`, and a new `import { resolveMortalFatigue } from "./fatigue-actions";`. Capture the pre-deduction value before the existing `tryChannellingSpend` call — change:
```typescript
  let channellingSpent: number | null = null;
  if (channelling) {
    channellingSpent = tryChannellingSpend(actor, entry.spellLevel, entry.magickType ?? "fixed");
    if (channellingSpent === null) return;
  }
```
to:
```typescript
  let channellingSpent: number | null = null;
  const preDeductionSp = actor.system.spellcasting.wizard.channelling.current ?? 0;
  if (channelling) {
    channellingSpent = tryChannellingSpend(actor, entry.spellLevel, entry.magickType ?? "fixed");
    if (channellingSpent === null) return;
  }
```
(reading it unconditionally is harmless — it's simply unused on the non-channelling path). Then, right after the existing:
```typescript
  await actor.update({
    ...(channelling
      ? { "system.spellcasting.wizard.channelling.current": channellingSpent }
      : {
          [`system.spellcasting.${key}.memorized`]: list.map((m) =>
            m.spellItemId === spellItemId ? { ...m, expended: true } : m,
          ),
        }),
    "system.options.spellsAndMagic.casting": casting,
  });
  await postNotice(actor, spell, "begin", casting);
```
add, right after that `postNotice` call:
```typescript
  if (channelling) {
    const resolvedTier = await applyCastFatigue(actor, entry.spellLevel, preDeductionSp);
    if (resolvedTier === "mortal") await resolveMortalFatigue(actor);
  }
```
(`channelling` and `entry` are both already in scope as local `const`s earlier in this function. Placing this after `postNotice` matches the same "primary notification first, fatigue consequence after" ordering used in `castSpell`/`castFreeMagick` above — before the segment-initiative-adjustment block that follows, so a mortal-fatigue death doesn't leave a stale initiative bump for a caster who no longer needs one... though note that block's own `try/catch` already tolerates the actor being in an unexpected state, so this ordering is a readability choice, not a correctness requirement.)

- [ ] **Step 5: Lang (failing test first)**

Append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — SP14c fatigue strings", () => {
  it("resolves every ADND2E.sheet.spells.fatigue* key", () => {
    for (const key of [
      "ADND2E.sheet.spells.fatigueBadge",
      "ADND2E.sheet.spells.fatigueBadgeHint",
      "ADND2E.sheet.spells.recoverFromFatigue",
      "ADND2E.sheet.spells.fatigueRecoveryHint",
      "ADND2E.sheet.spells.fatigueRecoverySuccess",
      "ADND2E.sheet.spells.fatigueRecoveryFailure",
      "ADND2E.sheet.spells.fatigueRecoveryNotFatigued",
      "ADND2E.sheet.spells.mortalFatigueSurvived",
      "ADND2E.sheet.spells.mortalFatigueDied",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run `npx vitest run tests/lang 2>&1 | tail -15` — FAIL. Add inside `ADND2E.sheet.spells` (sibling of the Plan B `channelling*` keys):
```json
        "fatigueBadge": "Fatigued",
        "fatigueBadgeHint": "Current fatigue tier from channelling",
        "recoverFromFatigue": "Recover from Fatigue",
        "fatigueRecoveryHint": "Attempt a saving throw vs. paralyzation to shake off one tier of fatigue (rest a {interval} between attempts for the bonus to apply).",
        "fatigueRecoverySuccess": "The fatigue eases — one tier recovered.",
        "fatigueRecoveryFailure": "No improvement yet.",
        "fatigueRecoveryNotFatigued": "You aren't currently fatigued.",
        "mortalFatigueSurvived": "The strain nearly kills them — they collapse unconscious.",
        "mortalFatigueDied": "The strain is too much. They perish."
```
Re-run — pass.

- [ ] **Step 6: Verify** — `npx vitest run tests/lang 2>&1 | tail -15` passes; typecheck and lint exit 0 for the Foundry-coupled changes (dev-world verification happens in the final task). Note: typecheck will not fully pass until Task 6 creates `fatigue-actions.ts` — if running this task in isolation, confirm the ONLY typecheck errors are "cannot find module './fatigue-actions'" and its two named exports; everything else must be clean.

- [ ] **Step 7: Commit**
```bash
git add src/data/actor/base-actor.ts src/sheets/character/spell-actions.ts src/sheets/character/casting-actions.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp14c): fatigueSaveBonus schema field + cast-time fatigue resolution

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Save-driven state machines + sheet UI

**Files:**
- Create: `src/sheets/character/fatigue-actions.ts`
- Modify: `src/sheets/character/sheet.ts`, `src/sheets/character/context.ts`, `src/sheets/character/context-types.ts`, `templates/actor/pc/header.hbs`, `templates/actor/pc/partials/pc-main-panels.hbs`
- Test: append to `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `FATIGUE_CONDITION_ID`, `tierForConditionId`, `nextTierDown`, `fatigueMovementRate`, `FATIGUE_RECOVERY_INTERVAL`, `channellerFatigueEnabled`, `type FatigueTier` (Task 2); `CONDITIONS` (existing, `src/conditions.ts`, Task 3's new entries); the widened `SpellcasterActor` (Task 5).
- Produces: `resolveMortalFatigue(actor): Promise<void>` — Task 5's `applyCastFatigue` call sites already call this (that wiring was written in Task 5, forward-referencing this task's export, since the two tasks run back-to-back in sequence); `recoverFromFatigue(actor): Promise<void>`, wired into the sheet's new action button in this task's own Step 2.

- [ ] **Step 1: `fatigue-actions.ts` — the two save-driven state machines**

Create `src/sheets/character/fatigue-actions.ts`:
```typescript
// Sub-project 14 Plan C: the two save-driven fatigue mechanics — a mortal-
// fatigue save-or-die, and the player-initiated Recover-from-Fatigue action.
// Foundry-coupled glue, dev-world verified. Both need the save's pass/fail
// result SYNCHRONOUSLY to decide the next state change, unlike the existing
// player-facing combat-rolls.ts's rollSave (which posts a result
// asynchronously via a chat-message flag for SP9a's disruption hook to react
// to later) — so this file has its own small, direct roll-and-return helper
// rather than reusing that one.
import {
  channellerFatigueEnabled, FATIGUE_CONDITION_ID, nextTierDown, tierForConditionId,
} from "../../core/magic/channeller-fatigue";
import { buildSaveCardContext } from "../../combat/save-card";
import { TEMPLATE_PATH } from "../../constants";
import { getOptionalRules } from "../../settings";
import type { SpellcasterActor } from "./spell-actions";

/** Rolls 1d20 + the actor's cached ppd save target's rollModifier + `bonus`
 *  against that same target, posts a chat card for transparency (same shape
 *  combat-rolls.ts's rollSave already posts), and returns the pass/fail
 *  result synchronously. */
async function rollParalyzationSave(
  actor: SpellcasterActor,
  bonus: number,
): Promise<boolean> {
  const save = actor.system.saves.ppd;
  const totalModifier = save.rollModifier + bonus;
  const roll = await new Roll(
    `1d20${totalModifier ? (totalModifier > 0 ? ` + ${totalModifier}` : ` - ${Math.abs(totalModifier)}`) : ""}`,
  ).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: "ADND2E.saves.ppd",
    formula: roll.formula, naturalD20, rollModifier: totalModifier, target: save.target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
  return context.success;
}

/** Called when a cast resolves to the mortal tier (spell-actions.ts's
 *  applyCastFatigue, Task 5): rolls the save (no bonus — the book specifies
 *  none for this roll); on failure, HP to 0 + apply "dead"; on success,
 *  apply "unconscious" + set the condition straight to severeFatigue
 *  (modeling "awakes severely fatigued" as being severely fatigued
 *  immediately, since fatigue has no mechanical effect while already
 *  unconscious — spec §2). */
export async function resolveMortalFatigue(
  actor: SpellcasterActor,
): Promise<void> {
  const survived = await rollParalyzationSave(actor, 0);
  if (!survived) {
    await actor.update({ "system.attributes.hp.value": 0 });
    await actor.toggleStatusEffect("dead", { active: true });
    ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.mortalFatigueDied"));
    return;
  }
  await actor.toggleStatusEffect("unconscious", { active: true });
  await actor.toggleStatusEffect(FATIGUE_CONDITION_ID.severe, { active: true });
  ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.mortalFatigueSurvived"));
}

/** The Recover-from-Fatigue sheet action: one saving throw using the banked
 *  `fatigueSaveBonus` counter. Success drops one tier (clearing the
 *  condition entirely from light) and resets the counter; failure increments
 *  it. No-ops with a warning if not currently fatigued or the rule is off. */
export async function recoverFromFatigue(
  actor: SpellcasterActor,
): Promise<void> {
  if (!channellerFatigueEnabled(getOptionalRules())) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.channellingBlockedWarning"));
    return;
  }
  const currentTier = [...actor.statuses].map(tierForConditionId).find((t) => t !== null) ?? null;
  if (currentTier === null) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.fatigueRecoveryNotFatigued"));
    return;
  }
  const bonus = actor.system.spellcasting.wizard.fatigueSaveBonus;
  const succeeded = await rollParalyzationSave(actor, bonus);
  if (succeeded) {
    const next = nextTierDown(currentTier);
    await actor.toggleStatusEffect(FATIGUE_CONDITION_ID[currentTier], { active: false });
    if (next !== null) await actor.toggleStatusEffect(FATIGUE_CONDITION_ID[next], { active: true });
    await actor.update({ "system.spellcasting.wizard.fatigueSaveBonus": 0 });
    ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.fatigueRecoverySuccess"));
  } else {
    await actor.update({ "system.spellcasting.wizard.fatigueSaveBonus": bonus + 1 });
    ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.spells.fatigueRecoveryFailure"));
  }
}
```

- [ ] **Step 2: Wire into `sheet.ts`**

Add imports: `import { recoverFromFatigue } from "./fatigue-actions";` and `import { tierForConditionId } from "../../core/magic/channeller-fatigue";`.

In the action-map object, add right after `recoverChannellerSp: Adnd2eCharacterSheet.#onRecoverChannellerSp,`:
```typescript
      recoverFromFatigue: Adnd2eCharacterSheet.#onRecoverFromFatigue,
```
Add the handler near `#onRecoverChannellerSp`:
```typescript
  static async #onRecoverFromFatigue(this: Adnd2eCharacterSheet): Promise<void> {
    await recoverFromFatigue(this.document as never);
  }
```

Find the existing line `castingStatus: readCastingStatus(this.document as never),` (in the method that assembles `CharacterSheetInput`) and add, right above the object literal it belongs to, a local variable:
```typescript
    const actorStatuses = (this.document as unknown as { statuses: ReadonlySet<string> }).statuses;
    const fatigueTier = [...actorStatuses].map(tierForConditionId).find((t) => t !== null) ?? null;
```
then add `fatigueTier,` as a shorthand property inside the `CharacterSheetInput` object literal, alongside `castingStatus: readCastingStatus(this.document as never),`.

- [ ] **Step 3: Types + `buildVitals`**

`src/sheets/character/context-types.ts` — add to `CharacterSheetInput`, right after `castingStatus?: CastingStatusInput | null;`:
```typescript
  /** Sub-project 14 Plan C: the actor's current fatigue tier, read from live `actor.statuses`; null while unfatigued or the rule is off. */
  fatigueTier?: FatigueTier | null;
```
(import `type { FatigueTier } from "../../core/magic/channeller-fatigue";` at the top of this file). Add to `CharacterSheetContext["vitals"]`, right after `casting: boolean;`:
```typescript
  /** Sub-project 14 Plan C: null while unfatigued. */
  fatigue: { label: string; recoveryIntervalLabel: string } | null;
```

`src/sheets/character/context.ts` — add the import: `import { CONDITIONS } from "../../conditions";` and `import { FATIGUE_CONDITION_ID, FATIGUE_RECOVERY_INTERVAL, fatigueMovementRate } from "../../core/magic/channeller-fatigue";`. Change `buildVitals`:
```typescript
function buildVitals(input: CharacterSheetInput): CharacterSheetContext["vitals"] {
  const a = input.derived.attributes;
  const saves: SaveRow[] = SAVE_KEYS.map((key) => {
    const s = input.derived.saves[key];
    return {
      key,
      label: input.config.saves[key],
      target: s.target,
      rollModifier: s.rollModifier,
      effectiveTarget: s.effectiveTarget,
      shortLabel: `ADND2E.sheet.saves.short.${key}`,
    };
  });
  const fatigueTier = input.fatigueTier ?? null;
  const currentMovement = fatigueTier ? fatigueMovementRate(fatigueTier, a.movement.current) : a.movement.current;
  const fatigue = fatigueTier
    ? {
        label: CONDITIONS.find((c) => c.id === FATIGUE_CONDITION_ID[fatigueTier])?.name ?? fatigueTier,
        recoveryIntervalLabel: FATIGUE_RECOVERY_INTERVAL[fatigueTier],
      }
    : null;
  return {
    hp: a.hp,
    thac0: a.thac0,
    ac: a.ac,
    saves,
    movement: {
      base: a.movement.base,
      current: currentMovement,
      encumbranceCategory: a.movement.encumbranceCategory,
      encumbranceCategoryLabel: input.config.encumbranceCategories[a.movement.encumbranceCategory],
    },
    casting: Boolean(input.castingStatus),
    fatigue,
  };
}
```

- [ ] **Step 4: Failing tests**

Append to `tests/sheets/character/context.test.ts`:
```typescript
describe("buildCharacterSheetContext — Channellers fatigue (SP14c)", () => {
  it("no fatigue tier: vitals.fatigue is null, movement unaffected", () => {
    const c = buildCharacterSheetContext(input());
    expect(c.vitals.fatigue).toBeNull();
  });

  it("a fatigue tier adjusts the displayed movement rate and exposes a label", () => {
    // the fixture's base movement.current is 12 (unencumbered) -> heavy is floor(12*0.25) = 3
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "heavy" });
    expect(c.vitals.movement.current).toBe(3);
    expect(c.vitals.fatigue).toEqual({ label: "Heavily Fatigued", recoveryIntervalLabel: "turn" });
  });

  it("severe fatigue is a flat movement rate of 1 regardless of the base rate", () => {
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "severe" });
    expect(c.vitals.movement.current).toBe(1);
  });

  it("mortal fatigue is a movement rate of 0", () => {
    const c = buildCharacterSheetContext({ ...input(), fatigueTier: "mortal" });
    expect(c.vitals.movement.current).toBe(0);
  });
});
```
Run `npx vitest run tests/sheets 2>&1 | tail -30` — FAIL (new fields don't exist on the input/context types yet).

- [ ] **Step 5: Verify** — `npx vitest run tests/sheets 2>&1 | tail -30` passes; typecheck, lint, `npm run test:coverage` exit 0; `context.ts`/`context-types.ts` keep 100% line/stmt/func.

- [ ] **Step 6: Templates**

`templates/actor/pc/header.hbs` — add right after the existing casting badge line:
```hbs
        {{#if adnd2e.vitals.fatigue}}<span class="fatigue-badge" title="{{localize 'ADND2E.sheet.spells.fatigueBadgeHint'}}">{{adnd2e.vitals.fatigue.label}}</span>{{/if}}
```

`templates/actor/pc/partials/pc-main-panels.hbs` — add right after the existing casting panel's closing `{{/if}}`:
```hbs
  {{#if adnd2e.vitals.fatigue}}
    <section class="kit-panel kit-fatigue">
      <div class="kit-bar">{{adnd2e.vitals.fatigue.label}}</div>
      <div class="kit-body">
        <p class="detail">{{localize 'ADND2E.sheet.spells.fatigueRecoveryHint' interval=adnd2e.vitals.fatigue.recoveryIntervalLabel}}</p>
        <button type="button" class="kit-roll" data-action="recoverFromFatigue">{{localize 'ADND2E.sheet.spells.recoverFromFatigue'}}</button>
      </div>
    </section>
  {{/if}}
```

- [ ] **Step 7: Verify** — full suite (`npx vitest run 2>&1 | tail -40`), typecheck, lint all clean.

- [ ] **Step 8: Commit**
```bash
git add src/sheets/character/fatigue-actions.ts src/sheets/character/sheet.ts src/sheets/character/context.ts src/sheets/character/context-types.ts templates/actor/pc/header.hbs templates/actor/pc/partials/pc-main-panels.hbs tests/sheets/character/context.test.ts
git commit -m "feat(sp14c): mortal save-or-die, Recover-from-Fatigue, and the sheet's fatigue badge/panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Whole-branch review, gated dev-world check, README update

- [ ] **Step 1: Whole-branch review (MANDATORY)** — run the project's `/code-review` (or equivalent) across every commit on this branch against the full diff from `master`, not task-by-task. Pay particular attention to: `applyCastFatigue` never toggling `mortalFatigue` itself (only `resolveMortalFatigue` does, and only on a successful save does it set `severeFatigue` instead); the mutual-exclusivity clearing loop in `applyCastFatigue` correctly removing every OTHER fatigue id before applying the new one; `canAct`'s mortal-fatigue exclusion not accidentally blocking saving throws (it must only gate the attack-roll call sites, exactly like the existing stunned/held exclusions already do — grep every `canAct` call site to confirm); and the Expanded-Casting-Time (`castOrBegin`) fatigue wiring specifically, since that is the exact mechanic Plan B's own final review found a real bug in.

- [ ] **Step 2: Ask the user to close Foundry, then run `npm run build`** (never run this yourself without asking first, per Global Constraints).

- [ ] **Step 3: Gated dev-world check** — in a linked dev world, with a channelling wizard PC (and a Character NPC channeller) that have `spellsAndMagicEnabled`/`spellPoints`/`channelers` already on:
  - Rule off (`channellerFatigue` off): channelling behaves exactly like Plan B alone — no fatigue conditions ever appear, no combat penalties, no movement change.
  - Turn on `channellerFatigue`, reload: casting spells that should trigger each of the 5 tiers (use the book's own worked examples from the spec as a guide — e.g. a low-level wizard's first cast should land on `heavy` per Table 21) shows the correct condition, the correct fatigue badge/panel on the sheet, and the correct movement-rate change.
  - Combat penalties: a fatigued wizard's own weapon-attack roll shows the correct to-hit penalty; attacking a fatigued actor (PC or Monster NPC, toggled manually via Token HUD for the latter) shows the correct AC penalty.
  - Existing-fatigue stacking: cast again while already fatigued and confirm the tier shifts per the book's worked example (moderate + a 2nd-level cast at level 7-8 → heavy).
  - HP/SP escalation: drop the caster's HP to ≤50%/≤25% of max before casting and confirm the extra tier shift(s), matching the spec's fireball worked example.
  - Mortal fatigue: trigger it and confirm both outcomes occur correctly across repeated attempts — a failed save sets HP to 0 and applies `dead`; a successful save applies `unconscious` + `severeFatigue`.
  - Recover from Fatigue: click it repeatedly while fatigued and confirm a failure increments the banked bonus (and the next attempt's roll reflects it) while a success drops exactly one tier and resets the bonus to 0; confirm it correctly clears the condition entirely from `light`.
  - **The Expanded Casting Time interaction (the spec's own called-out highest-risk spot):** with `expandedCastingTime` also on, cast a segment-time spell in a started combat as a channelling wizard close enough to a fatigue threshold to trigger a tier change, and confirm the fatigue condition applies correctly at the moment casting *begins* (not deferred to `completeCasting`), matching how the SP spend itself already works there.
  - A Character NPC channeller fatigues and recovers the same way a PC does.
  - A non-channelling actor (classic wizard, non-wizard, or Monster NPC) never gets a fatigue condition through normal gameplay, regardless of settings.

- [ ] **Step 4: README update** — update Sub-project 14's row: Plan C (fatigue) complete; Sub-project 14 now fully done except priest spell points/channelling (a separate, not-yet-scoped future plan). Commit:
```bash
git add README.md
git commit -m "docs: mark Sub-project 14 Plan C (Channellers fatigue) complete

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push and open the PR** (per this project's standing preference — always push + PR when a branch is done, without asking first).
