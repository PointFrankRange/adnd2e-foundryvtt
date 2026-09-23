# Sub-project 8 Plan 8a: Sub-Ability Scores (+ Skills & Powers Settings Wiring) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all four reserved Skills & Powers toggles into `OptionalRules`, and implement sub-ability scores: 12 authored sub-scores (2 per ability) whose rounded average becomes each ability's main score, with PC-sheet inputs and a "seed from main" action.

**Architecture:** A pure `src/core/abilities/sub-abilities.ts` owns the sub-ability table, the averaging/fallback math, the single shared gate helper (`subAbilitiesEnabled`), and the seed-update builder. `abilities.<k>.sub = {a, b}` (nullable) is added to the actor schema; a new `applySubAbilityScores` step runs in `prepareBaseData` immediately BEFORE the existing `applyRacialAdjustment`, so every downstream table/derive step keeps reading the (now derived) main score untouched. The PC sheet opts in to sub-score inputs via an explicit `subAbilityUi` input flag; the NPC sheet shares the ability-row partial but never sets it.

**Tech Stack:** TypeScript, Vite, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-23-adnd2e-sp8-skills-and-powers-design.md` — §2 Decisions table, §3 Global Constraints, §4.1, §5, §6.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — never `fvtt-types` (pinned to a v13-beta, wrong about several v14 APIs).
- **Two-layer contract:** `src/core/**` (directory-level wildcard in `tsconfig.core.json`, `vitest.config.ts` coverage `include`, and `eslint.config.js` pure-zone `files`/`ignores` — verify, don't assume) and `src/sheets/character/context.ts` + `context-types.ts` (listed file-by-file in all three) are the PURE zone: no Foundry imports, 100% line/statement/function coverage, branches ≥ 90 (`vitest.config.ts`). `src/data/actor/*.ts`, `src/sheets/**/sheet.ts`, `src/sheets/character/sub-ability-actions.ts`, templates, SCSS and `lang/en.json` are the Foundry layer — typecheck/lint gated, dev-world verified, NOT unit-tested.
- **Content policy:** mechanical values only. The twelve sub-ability names are game vocabulary; this plan adds no rules text.
- **Gating (locked, spec §2):** `skillsAndPowersEnabled` is a master AND-gate; the expression `optionalRules.skillsAndPowersEnabled && optionalRules.subAbilityScores` is written **exactly once**, as `subAbilitiesEnabled(rules)` in Task 2, and every consumer calls that helper (Task 3's derivation, Task 5's PC sheet input builder, Task 5's seed action). Do not restate the expression anywhere else. (Plans 7c and 7d each shipped a gate that two files stated differently; this is the fix.)
- **Additive schema only — no migration, no version bump** (`sub` has `initial: null`; nothing is removed or renamed). Task 3 must CONFIRM this against real v14.364 source rather than assume it; SP7c's lesson: removed/renamed fields need `migrateData`, additive initial-valued fields do not.
- **Authored-vs-prepared split (RawFieldSheetMixin C1 lesson):** authored inputs bind `_source` values; the prepared model holds derived values. Writing a derived value back into an authored field ("ratcheting") is the failure mode this plan is designed around — see Task 3's idempotence argument and Task 5's `disabled` main-score input.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**, and do not touch `package.json`/`package-lock.json`/`node_modules`.
- **`npm run build` requires Foundry fully closed** — re-confirm with the user before every build attempt.
- **Read vitest output with `tail`/`head`/redirect, never `| grep`** — SIGPIPE false "no tests"; a cache-clear's first run can genuinely flake, rerun 2-3×.
- **The whole-branch review (Task 6) is MANDATORY**, and the dev-world check (Task 7) is GATED and MUST include a non-GM player seat.

## Locked design decisions (this plan's own, resolving what spec §4.1 left to the plan)

1. **Where the authored score is read from.** `applySubAbilityScores` reads the authored main score from the model's own `_source` (`this._source.abilities[k].score`), NOT from the prepared `this.abilities[k].score`. **Idempotence argument:** Foundry's `Document#prepareData` order is `reset()` → `_initialize()` (re-reads every prepared field from `_source`, verified at `common/abstract/data.mjs:460-526` and `client/documents/abstract/client-document.mjs:296-320`) → `TypeDataModel#prepareBaseData`. So each cycle starts from the authored value; and because this step additionally reads `_source` explicitly, its result depends on no earlier prepare cycle at all. It then assigns the averaged value to the PREPARED `score` only (never `_source`), and the existing `applyRacialAdjustment` reads that prepared value and applies the racial delta once per cycle exactly as today.
2. **Racial adjustment is unchanged and runs AFTER averaging** (spec §2): `score = avg(subs) → applyRacialAdjustment → derived`.
3. **Sheet display while the rule is on:** the main-score `<input>` shows the averaged (pre-racial) value and is `disabled` (NOT `readonly`): `FormDataExtended` (`client/applications/ux/form-data-extended.mjs:23,118-119`) defaults to `disabled=false, readonly=true`, i.e. it EXCLUDES disabled fields but INCLUDES readonly ones — a readonly input would submit the averaged value and overwrite the authored `_source` score on the next `submitOnChange`. `racialDelta` is computed against the averaged value so it still shows only the racial part.
4. **Sub-score inputs:** `<input type="number" min="1" max="25" name="system.abilities.<k>.sub.<a|b>">`, `placeholder` = the authored main score (the value the derivation falls back to). An empty input submits `null` (`form-data-extended.mjs:199-200`), which the nullable `NumberField` accepts (`fields.mjs:1500-1502`). The schema clamps to [1, 25].
5. **Exceptional Strength input** keys off the DISPLAYED main score (averaged when the rule is on, authored when off), matching today's `Number(score) === 18` convention.
6. **Seed action:** ONE button (`data-action="seedSubAbilities"`), all six abilities, writes the authored main score into every `null` sub-score only (never overwrites a non-null one), authored score read from `actor._source`, clamped to [1, 25]. Server-side re-validated: it re-checks `subAbilitiesEnabled(getOptionalRules())` and no-ops with a warning toast when the rule is off or there is nothing to seed. Rendered only when `adnd2e.subAbilities.canSeed`.
7. **NPC sheet:** shares `partials/ability-row.hbs`, so the sub-score UI is **opt-in via `CharacterSheetInput.subAbilityUi?: boolean`** (optional, absent = `false`). Only the PC sheet's `#buildInput` sets it; `src/sheets/npc/sheet.ts` is not touched, so the NPC's main-score input stays editable and un-averaged. The derivation (`prepareBaseData`) still applies to NPC actors — a null-sub NPC is unchanged.
8. **Settings hints:** master and `subAbilityScores` get real wording; `characterPointBuild` and `expandedProficiencies` get "(not yet enforced — lands in a later Skills & Powers plan)" (the SP7a precedent), replacing the now-misleading "Requires Sub-project 8."
9. **Note for Plan 8c (spec correction):** the reserved untyped field is `system.options.skillsAndPowers` (`base-actor.ts`, nested under `options`), not `system.skillsAndPowers`. This plan does not touch it.

---

### Task 1: Wire the four Skills & Powers toggles into `OptionalRules`

**Files:**
- Modify: `src/core/options.ts`
- Modify: `src/settings/registry.ts:38-42`
- Modify: `lang/en.json` (the four `skillsAndPowers*` hints, ~lines 534-549)
- Modify: `tests/core/options.test.ts`
- Modify: `tests/settings/registry.test.ts`

**Interfaces:**
- Produces: `OptionalRules` gains `skillsAndPowersEnabled`, `subAbilityScores`, `characterPointBuild`, `expandedProficiencies` (all `boolean`, all default `false`) — consumed by Task 2 (`subAbilitiesEnabled`) and by Plans 8b/8c.

**Current real state** (confirmed during planning): `src/core/options.ts` has 14 fields (last: `weaponMastery`); `DEFAULT_OPTIONAL_RULES` lists them; `src/settings/registry.ts` lines 39-42 are the four descriptors with `optionalRulesKey: null`; `readOptionalRules` skips descriptors whose `optionalRulesKey` is `null`. `src/types/global.d.ts` already declares all 22 `SettingConfig` keys (no change). No file other than `options.ts` and `tests/core/options.test.ts:41` constructs a full `OptionalRules` literal (grep-confirmed).

- [ ] **Step 1: Update the tests first (they must fail)**

Edit `tests/core/options.test.ts`. Replace the first test's title and key list, and the expected object:
```typescript
  it("has exactly the eighteen core, combatAndTactics and skillsAndPowers toggles", () => {
    expect(Object.keys(DEFAULT_OPTIONAL_RULES).sort()).toEqual(
      [
        "armorTypeVsWeaponType",
        "calledShots",
        "characterPointBuild",
        "combatAndTacticsEnabled",
        "combatManeuvers",
        "criticalHits",
        "exceptionalStrength",
        "expandedProficiencies",
        "maxSpellsPerLevel",
        "multiclassHpAveraging",
        "nonweaponProficienciesUsed",
        "skillsAndPowersEnabled",
        "spellFailureFromWisdom",
        "subAbilityScores",
        "trainingRequiredToLevel",
        "weaponMastery",
        "weaponProficienciesUsed",
        "weaponSpeedInitiative",
      ].sort(),
    );
  });
```
and add these four lines to the `expected: OptionalRules` object after `weaponMastery: false,`:
```typescript
      skillsAndPowersEnabled: false,
      subAbilityScores: false,
      characterPointBuild: false,
      expandedProficiencies: false,
```

Edit `tests/settings/registry.test.ts`. Replace the fourth `it` (currently "core and combatAndTactics settings bind 1:1…") with:
```typescript
  it("core, combatAndTactics and skillsAndPowers settings bind 1:1 to OptionalRules fields; spellsAndMagic binds to null", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(18);
    for (const d of bound) expect(["core", "combatAndTactics", "skillsAndPowers"]).toContain(d.group);

    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());

    for (const d of SETTING_DESCRIPTORS.filter((x) => x.group === "spellsAndMagic")) {
      expect(d.optionalRulesKey).toBeNull();
    }
  });
```
and replace the last `it` of the `readOptionalRules()` describe ("ignores skillsAndPowers/spellsAndMagic keys…") with these two:
```typescript
  it("reads a skillsAndPowers key through, same as a core key", () => {
    const bag = readOptionalRules((key) => (key === "subAbilityScores" ? true : undefined));
    expect(bag.subAbilityScores).toBe(true);
    expect(bag.skillsAndPowersEnabled).toBe(false); // untouched default
  });

  it("ignores spellsAndMagic keys — they never appear in the bag", () => {
    const bag = readOptionalRules((key) => (key === "spellPoints" ? true : undefined));
    expect(bag).not.toHaveProperty("spellPoints");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/options.test.ts tests/settings/registry.test.ts > /tmp/8a1.log 2>&1; tail -n 40 /tmp/8a1.log`
Expected: FAIL (the bag has 14 keys, 4 descriptors are unbound).

- [ ] **Step 3: Implement**

Edit `src/core/options.ts`. Replace the header comment's second paragraph (currently: "`core` and `combatAndTactics` group toggles both live here (Sub-project 7 wired the latter). `skillsAndPowers.*` / `spellsAndMagic.*` settings are registered but are not part of this bag until their sub-project wires the branches (spec §6.2).") with:
```
 * `core`, `combatAndTactics` and `skillsAndPowers` group toggles all live here
 * (Sub-projects 7 and 8 wired the latter two). `spellsAndMagic.*` settings are
 * registered but are not part of this bag until Sub-project 9 wires the
 * branches (spec §6.2).
```
Add to the `OptionalRules` interface, after `weaponMastery: boolean;`:
```typescript
  /** Sub-project 8 master switch — every other skillsAndPowers.* key is a
   *  no-op unless this is also true. */
  skillsAndPowersEnabled: boolean;
  /** Sub-project 8 Plan 8a: sub-ability scores (12 sub-scores average into the 6 main scores). */
  subAbilityScores: boolean;
  /** Sub-project 8 Plan 8c: the character-point build (sub-scores + traits). */
  characterPointBuild: boolean;
  /** Sub-project 8 Plan 8b: related-weapon proficiency penalty + specific-weapon proficiencies. */
  expandedProficiencies: boolean;
```
and to `DEFAULT_OPTIONAL_RULES`, after `weaponMastery: false,`:
```typescript
  skillsAndPowersEnabled: false,
  subAbilityScores: false,
  characterPointBuild: false,
  expandedProficiencies: false,
```

Edit `src/settings/registry.ts` lines 38-42 to:
```typescript
  // --- skillsAndPowers: Sub-project 8 ---
  { key: "skillsAndPowersEnabled", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "skillsAndPowersEnabled" },
  { key: "subAbilityScores", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "subAbilityScores" },
  { key: "characterPointBuild", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "characterPointBuild" },
  { key: "expandedProficiencies", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "expandedProficiencies" },
```

Edit `lang/en.json` — replace the four hints (keep every `name` as is):
```json
      "skillsAndPowersEnabled": {
        "name": "Skills & Powers: Enabled",
        "hint": "Master switch for the Skills & Powers option group — every other Skills & Powers rule is a no-op unless this is also on."
      },
      "subAbilityScores": {
        "name": "Skills & Powers: Sub-Ability Scores",
        "hint": "Split each ability into two sub-scores; the main score becomes their rounded average (Skills & Powers)."
      },
      "characterPointBuild": {
        "name": "Skills & Powers: Character Point Build",
        "hint": "Buy sub-scores and traits with character points (Skills & Powers). (not yet enforced — lands in a later Skills & Powers plan)"
      },
      "expandedProficiencies": {
        "name": "Skills & Powers: Expanded Proficiencies",
        "hint": "Related-weapon proficiency penalties and the specific-weapon proficiency list (Skills & Powers). (not yet enforced — lands in a later Skills & Powers plan)"
      },
```

- [ ] **Step 4: Run tests, typecheck, lint, coverage**

Run: `npx vitest run tests/core/options.test.ts tests/settings/registry.test.ts tests/config/settings-augmentation.test.ts > /tmp/8a1b.log 2>&1; tail -n 40 /tmp/8a1b.log`
Run: `npm run typecheck > /tmp/8a1-tc.log 2>&1; tail -n 30 /tmp/8a1-tc.log`
Run: `npm run lint > /tmp/8a1-lint.log 2>&1; tail -n 30 /tmp/8a1-lint.log`
Run: `npm run test:coverage > /tmp/8a1-cov.log 2>&1; tail -n 60 /tmp/8a1-cov.log`
Expected: all PASS, coverage thresholds held. If typecheck finds any other full `OptionalRules` literal that this plan's grep missed, add the four fields there (all `false`) — do not loosen the type.

- [ ] **Step 5: Commit**

```bash
git add src/core/options.ts src/settings/registry.ts lang/en.json tests/core/options.test.ts tests/settings/registry.test.ts
git commit -m "feat(sp8a): wire the four skillsAndPowers toggles into OptionalRules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure sub-ability core module

**Files:**
- Create: `src/core/abilities/sub-abilities.ts`
- Modify: `src/core/abilities/index.ts` (one re-export line)
- Create: `tests/core/abilities/sub-abilities.test.ts`

**Interfaces:**
- Consumes: `OptionalRules` (Task 1), `AbilityKey` from `src/core/types.ts`.
- Produces (consumed by Tasks 3, 4, 5): `SubAbilityId`; `SUB_ABILITIES: Readonly<Record<AbilityKey, readonly [SubAbilityId, SubAbilityId]>>`; `subAbilitiesEnabled(rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "subAbilityScores">): boolean`; `effectiveSubScore(sub: number | null, mainScore: number): number`; `mainScoreFromSubs(a: number | null, b: number | null, mainScore: number): number`; `SubScoreSource { score: number; sub?: { a: number | null; b: number | null } | null }`; `subScoreSeedUpdate(abilities: Record<AbilityKey, SubScoreSource>): Record<string, number>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/core/abilities/sub-abilities.test.ts
import { describe, expect, it } from "vitest";
import {
  SUB_ABILITIES,
  effectiveSubScore,
  mainScoreFromSubs,
  subAbilitiesEnabled,
  subScoreSeedUpdate,
} from "../../../src/core/abilities/sub-abilities";

describe("SUB_ABILITIES", () => {
  it("names two sub-abilities for each of the six abilities", () => {
    expect(SUB_ABILITIES).toEqual({
      str: ["muscle", "stamina"],
      dex: ["aim", "balance"],
      con: ["health", "fitness"],
      int: ["reason", "knowledge"],
      wis: ["intuition", "willpower"],
      cha: ["leadership", "appearance"],
    });
  });
});

describe("subAbilitiesEnabled", () => {
  it("requires BOTH the master switch and the sub-ability toggle", () => {
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: true, subAbilityScores: true })).toBe(true);
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: true, subAbilityScores: false })).toBe(false);
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: false, subAbilityScores: true })).toBe(false);
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: false, subAbilityScores: false })).toBe(false);
  });
});

describe("effectiveSubScore", () => {
  it("returns the authored sub-score when set", () => {
    expect(effectiveSubScore(12, 10)).toBe(12);
  });
  it("falls back to the main score when the sub-score is null", () => {
    expect(effectiveSubScore(null, 14)).toBe(14);
  });
});

describe("mainScoreFromSubs", () => {
  it("averages two authored sub-scores", () => {
    expect(mainScoreFromSubs(10, 10, 99)).toBe(10);
    expect(mainScoreFromSubs(18, 14, 99)).toBe(16);
  });
  it("rounds a .5 average UP (Math.round tie-break)", () => {
    expect(mainScoreFromSubs(14, 15, 10)).toBe(15);
    expect(mainScoreFromSubs(10, 11, 10)).toBe(11);
    expect(mainScoreFromSubs(1, 2, 10)).toBe(2);
  });
  it("a null sub-score falls back to the main score, per side", () => {
    expect(mainScoreFromSubs(null, null, 14)).toBe(14);
    expect(mainScoreFromSubs(12, null, 14)).toBe(13);
    expect(mainScoreFromSubs(null, 13, 14)).toBe(14); // (14 + 13) / 2 = 13.5 -> 14
  });
  it("clamps the result to [1, 25]", () => {
    expect(mainScoreFromSubs(25, 25, 10)).toBe(25);
    expect(mainScoreFromSubs(null, null, 30)).toBe(25);
    expect(mainScoreFromSubs(1, 1, 10)).toBe(1);
    expect(mainScoreFromSubs(null, null, 0)).toBe(1);
  });
});

describe("subScoreSeedUpdate", () => {
  const scores = (over: Record<string, unknown> = {}) =>
    ({
      str: { score: 17 }, dex: { score: 12 }, con: { score: 15 },
      int: { score: 10 }, wis: { score: 9 }, cha: { score: 13 },
      ...over,
    }) as Parameters<typeof subScoreSeedUpdate>[0];

  it("seeds every null sub-score from its ability's authored score (12 entries when no sub key exists)", () => {
    const update = subScoreSeedUpdate(scores());
    expect(Object.keys(update)).toHaveLength(12);
    expect(update["system.abilities.str.sub.a"]).toBe(17);
    expect(update["system.abilities.str.sub.b"]).toBe(17);
    expect(update["system.abilities.wis.sub.a"]).toBe(9);
    expect(update["system.abilities.cha.sub.b"]).toBe(13);
  });

  it("treats a null sub object the same as a missing one", () => {
    expect(Object.keys(subScoreSeedUpdate(scores({ str: { score: 17, sub: null } })))).toHaveLength(12);
  });

  it("never overwrites an authored (non-null) sub-score", () => {
    const update = subScoreSeedUpdate(scores({ str: { score: 17, sub: { a: 18, b: null } } }));
    expect(update).not.toHaveProperty("system.abilities.str.sub.a");
    expect(update["system.abilities.str.sub.b"]).toBe(17);
  });

  it("returns an empty update when everything is already authored", () => {
    const full = Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map((k) => [k, { score: 10, sub: { a: 10, b: 10 } }]),
    );
    expect(subScoreSeedUpdate(scores(full))).toEqual({});
  });

  it("clamps a seeded value to [1, 25]", () => {
    const update = subScoreSeedUpdate(scores({ str: { score: 30 }, dex: { score: 0 } }));
    expect(update["system.abilities.str.sub.a"]).toBe(25);
    expect(update["system.abilities.dex.sub.a"]).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/abilities/sub-abilities.test.ts > /tmp/8a2.log 2>&1; tail -n 30 /tmp/8a2.log`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/core/abilities/sub-abilities.ts
// Player's Option: Skills & Powers sub-ability scores (SP8 Plan 8a). Each of
// the six abilities is split into two authored sub-scores; when the rule is on
// the main score is their rounded average, so every existing table and derive
// step keeps reading the main score untouched (spec §2). A null sub-score is
// "not set yet" and falls back to the ability's authored main score, so
// enabling the rule never changes an existing character. All values here are
// this project's own design (content policy).
import type { OptionalRules } from "../options";
import type { AbilityKey } from "../types";

export type SubAbilityId =
  | "muscle" | "stamina"
  | "aim" | "balance"
  | "health" | "fitness"
  | "reason" | "knowledge"
  | "intuition" | "willpower"
  | "leadership" | "appearance";

export const SUB_ABILITIES: Readonly<Record<AbilityKey, readonly [SubAbilityId, SubAbilityId]>> = {
  str: ["muscle", "stamina"],
  dex: ["aim", "balance"],
  con: ["health", "fitness"],
  int: ["reason", "knowledge"],
  wis: ["intuition", "willpower"],
  cha: ["leadership", "appearance"],
};

const MIN_SCORE = 1;
const MAX_SCORE = 25;

function clampScore(n: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, n));
}

/**
 * THE one place the sub-ability gate is written (master AND-gate, spec §2).
 * prepareBaseData, the PC sheet's input builder and the seed action all call
 * this — never restate the expression.
 */
export function subAbilitiesEnabled(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "subAbilityScores">,
): boolean {
  return rules.skillsAndPowersEnabled && rules.subAbilityScores;
}

/** A null sub-score falls back to the ability's authored main score. */
export function effectiveSubScore(sub: number | null, mainScore: number): number {
  return sub ?? mainScore;
}

/**
 * The main score the rule derives: the rounded average of the two effective
 * sub-scores, clamped to [1, 25]. `Math.round` rounds a .5 average UP
 * (e.g. 14 and 15 -> 15).
 */
export function mainScoreFromSubs(a: number | null, b: number | null, mainScore: number): number {
  return clampScore(Math.round((effectiveSubScore(a, mainScore) + effectiveSubScore(b, mainScore)) / 2));
}

export interface SubScoreSource {
  /** the AUTHORED main score (`_source`), not the prepared/racially-adjusted one */
  score: number;
  sub?: { a: number | null; b: number | null } | null;
}

/**
 * The actor update that seeds every null sub-score from its ability's authored
 * main score (clamped to [1, 25]); never touches a non-null sub-score. Keys are
 * dot-paths relative to the actor document. Empty when nothing needs seeding.
 */
export function subScoreSeedUpdate(abilities: Record<AbilityKey, SubScoreSource>): Record<string, number> {
  const update: Record<string, number> = {};
  for (const key of Object.keys(SUB_ABILITIES) as AbilityKey[]) {
    const { score, sub } = abilities[key];
    for (const side of ["a", "b"] as const) {
      if ((sub?.[side] ?? null) === null) {
        update[`system.abilities.${key}.sub.${side}`] = clampScore(score);
      }
    }
  }
  return update;
}
```

Add one line to `src/core/abilities/index.ts` after `export * from "./racial-adjustments";`:
```typescript
export * from "./sub-abilities";
```

- [ ] **Step 4: Run tests, typecheck, coverage**

Run: `npx vitest run tests/core/abilities/sub-abilities.test.ts > /tmp/8a2b.log 2>&1; tail -n 30 /tmp/8a2b.log`
Run: `npm run typecheck > /tmp/8a2-tc.log 2>&1; tail -n 30 /tmp/8a2-tc.log`
Run: `npm run test:coverage > /tmp/8a2-cov.log 2>&1; tail -n 60 /tmp/8a2-cov.log`
Expected: PASS; `src/core/abilities/sub-abilities.ts` at 100% statements/lines/functions and ≥90% branches — no triad-config edit is needed (`src/core/**` is a directory-level wildcard in `tsconfig.core.json`, `vitest.config.ts` and `eslint.config.js`); this step only confirms that is really true.

- [ ] **Step 5: Commit**

```bash
git add src/core/abilities/sub-abilities.ts src/core/abilities/index.ts tests/core/abilities/sub-abilities.test.ts
git commit -m "feat(sp8a): add pure sub-ability scores core module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Schema `sub` field + `prepareBaseData` derivation

**Files:**
- Modify: `src/data/actor/base-actor.ts` (schema entry, imports, new exported function)
- Modify: `src/data/actor/character.ts`
- Modify: `src/data/actor/npc.ts`

Foundry-layer — not unit-tested (all math is Task 2's pure code); verified by typecheck/lint here and in Task 7's dev-world check.

**Interfaces:**
- Consumes: `mainScoreFromSubs`, `subAbilitiesEnabled` (re-exported from `src/core/abilities` by Task 2); `getOptionalRules` (already imported in `base-actor.ts` — used by `deriveAndCache`; confirm by reading the file's import block).
- Produces: `abilities.<k>.sub: { a: number | null; b: number | null }` on the prepared and source actor data; `applySubAbilityScores(model)` exported from `base-actor.ts`.

**Current real state** (confirmed during planning): `abilitiesSchema()` builds `entry()` = `SchemaField({ score: NumberField(required, integer, min 1, initial 10), exceptional: NumberField(required, nullable, integer, min 1, max 100, initial null) })`. `applyRacialAdjustment(model)` reads the PREPARED `sys.abilities[k].score` for every key, applies `applyRacialDeltas`, writes `Math.max(1, adj[k])` back onto the prepared score, no-op without a `race` item. `CharacterModel.prepareBaseData()` and `NpcModel.prepareBaseData()` each contain exactly `applyRacialAdjustment(this);`.

- [ ] **Step 1: Confirm the additive-schema claim against real v14.364 source**

Read `C:\Program Files\Foundry Virtual Tabletop\resources\app\common\data\fields.mjs` — `DataField#clean` (~lines 227-260) and `SchemaField#_cleanType`/`#cleanKeys` (~lines 1075-1140) — and confirm that a **required** field/sub-object missing from an existing document's stored source is filled from its `initial` at construction (so existing actors gain `abilities.<k>.sub = {a: null, b: null}` with no migration). Record the file:line evidence in your report. If it is NOT true, STOP and report BLOCKED — the plan's "no migration" premise would be wrong. (Corroborating precedent already in this codebase: SP5b added `thiefSkills` to `actorCommonSchema()` and SP7c/8a-style additive fields shipped without migrations.)

- [ ] **Step 2: Add the `sub` field to the schema**

In `src/data/actor/base-actor.ts`, replace `abilitiesSchema()` with:
```typescript
function abilitiesSchema() {
  const subScore = () =>
    new NumberField({ required: true, nullable: true, integer: true, min: 1, max: 25, initial: null });
  const entry = () =>
    new SchemaField({
      score: new NumberField({ required: true, integer: true, min: 1, initial: 10 }),
      exceptional: new NumberField({ required: true, nullable: true, integer: true, min: 1, max: 100, initial: null }),
      /** Sub-project 8 Plan 8a: the two authored sub-scores. Null = "not set" —
       *  the derivation falls back to `score`. Read only when the rule is on. */
      sub: new SchemaField({ a: subScore(), b: subScore() }),
    });
  return new SchemaField(Object.fromEntries(ABILITY_KEYS.map((k) => [k, entry()])));
}
```

- [ ] **Step 3: Add the derivation step**

In `src/data/actor/base-actor.ts`, change the core-abilities import (currently `import { applyRacialDeltas } from "../../core/abilities";`) to:
```typescript
import { applyRacialDeltas, mainScoreFromSubs, subAbilitiesEnabled } from "../../core/abilities";
```
and add, immediately ABOVE `applyRacialAdjustment`'s doc comment:
```typescript
/**
 * Sub-project 8 Plan 8a: when the sub-ability rule is on, sets every PREPARED
 * `system.abilities.<k>.score` to the rounded average of the two sub-scores
 * (null sub-score -> the authored main score). MUST run before
 * `applyRacialAdjustment` — racial deltas apply to the averaged score.
 *
 * Idempotent, no ratchet: the authored main score is read from the model's own
 * `_source` (never from the prepared score this function overwrites), and the
 * result is written to the prepared score only — never to `_source`. Foundry
 * also re-reads every prepared field from `_source` before each prepare cycle
 * (`reset()` -> `_initialize()`), so no cycle depends on an earlier one.
 * Rule off -> `sub` is never read and nothing changes.
 */
export function applySubAbilityScores(model: foundry.abstract.TypeDataModel.Any): void {
  if (!subAbilitiesEnabled(getOptionalRules())) return;
  const sys = model as unknown as {
    abilities: Record<string, { score: number; sub: { a: number | null; b: number | null } }>;
    _source: { abilities: Record<string, { score: number }> };
  };
  for (const k of ABILITY_KEYS) {
    sys.abilities[k].score = mainScoreFromSubs(
      sys.abilities[k].sub.a,
      sys.abilities[k].sub.b,
      sys._source.abilities[k].score,
    );
  }
}
```

- [ ] **Step 4: Call it from both models, BEFORE the racial adjustment**

`src/data/actor/character.ts`: change the import to
`import { actorCommonSchema, Adnd2eActorModel, applyRacialAdjustment, applySubAbilityScores, deriveAndCache } from "./base-actor";`
and `prepareBaseData` to:
```typescript
  override prepareBaseData(): void {
    applySubAbilityScores(this);
    applyRacialAdjustment(this);
  }
```
`src/data/actor/npc.ts`: same import change and same two-line body in its `prepareBaseData`.

- [ ] **Step 5: Typecheck, lint, full test run**

Run: `npm run typecheck > /tmp/8a3-tc.log 2>&1; tail -n 30 /tmp/8a3-tc.log`
Run: `npm run lint > /tmp/8a3-lint.log 2>&1; tail -n 30 /tmp/8a3-lint.log`
Run: `npm run test:coverage > /tmp/8a3-cov.log 2>&1; tail -n 40 /tmp/8a3-cov.log`
Expected: all PASS (no test changes in this task — `base-actor.ts`/`character.ts`/`npc.ts` are outside the coverage `include`).

- [ ] **Step 6: Commit**

```bash
git add src/data/actor/base-actor.ts src/data/actor/character.ts src/data/actor/npc.ts
git commit -m "feat(sp8a): add abilities.<k>.sub and derive the main score from it before racial adjustment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Pure sheet-context layer — sub-score rows

**Files:**
- Modify: `src/sheets/character/context-types.ts`
- Modify: `src/sheets/character/context.ts`
- Modify: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `SUB_ABILITIES`, `mainScoreFromSubs` from Task 2's `src/core/abilities/sub-abilities.ts`.
- Produces (consumed by Task 5's template/sheet): `CharacterSheetInput.subAbilityUi?: boolean`; `SubScoreCell { id: string; label: string; name: string; value: number | null; placeholder: number }`; `AbilityRow` gains `subs: SubScoreCell[] | null` and `scoreLocked: boolean`; `CharacterSheetContext.subAbilities: { enabled: boolean; canSeed: boolean }`.

**Current real state** (confirmed during planning): `SourceView.system.abilities` is `Record<AbilityKey, { score: number; exceptional: number | null }>` (`context.ts:67-75`); `buildAbilities` (`context.ts:129-151`) returns `{ key, label, score: authored.score, racialDelta: effectiveScore - score, effectiveScore: derived.score, exceptional, showExceptional: key === "str" && Number(score) === 18, mods }`; `buildCharacterSheetContext` (`context.ts:599-617`) returns the section builders' results; `CharacterSheetInput` ends with `optionalRules: OptionalRules;` (`context-types.ts:31`); `AbilityRow` is at `context-types.ts:190-195`; the test fixture `input(over)` at `tests/sheets/character/context.test.ts:14` builds `source.system.abilities` WITHOUT any `sub` key (so the new code MUST tolerate a missing `sub`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/sheets/character/context.test.ts` (read the file's helper/fixture conventions first; `input()` and `buildCharacterSheetContext` are already imported):
```typescript
describe("sub-ability rows (SP8a)", () => {
  type AbilitySource = { score: number; exceptional: number | null; sub?: { a: number | null; b: number | null } };
  function withSubs(subs: Record<string, { a: number | null; b: number | null }>): CharacterSheetInput["source"] {
    const src = structuredClone(input().source) as { system: { abilities: Record<string, AbilitySource> } };
    for (const [k, sub] of Object.entries(subs)) src.system.abilities[k]!.sub = sub;
    return src as unknown as CharacterSheetInput["source"];
  }
  const allSet = { a: 10, b: 10 };
  const everyAbility = { str: allSet, dex: allSet, con: allSet, int: allSet, wis: allSet, cha: allSet };

  it("rule off (subAbilityUi absent): no sub cells, main score unlocked and authored, nothing to seed", () => {
    const c = buildCharacterSheetContext(input());
    for (const row of c.abilities) {
      expect(row.subs).toBeNull();
      expect(row.scoreLocked).toBe(false);
    }
    expect(c.abilities.find((a) => a.key === "str")!.score).toBe(17);
    expect(c.subAbilities).toEqual({ enabled: false, canSeed: false });
  });

  it("rule on, no sub keys in the source: cells are empty with the authored score as placeholder; main falls back to authored", () => {
    const c = buildCharacterSheetContext(input({ subAbilityUi: true }));
    const str = c.abilities.find((a) => a.key === "str")!;
    expect(str.scoreLocked).toBe(true);
    expect(str.score).toBe(17);
    expect(str.subs).toEqual([
      { id: "muscle", label: "ADND2E.sheet.subAbilities.muscle", name: "system.abilities.str.sub.a", value: null, placeholder: 17 },
      { id: "stamina", label: "ADND2E.sheet.subAbilities.stamina", name: "system.abilities.str.sub.b", value: null, placeholder: 17 },
    ]);
    expect(c.subAbilities).toEqual({ enabled: true, canSeed: true });
  });

  it("rule on, authored sub-scores: displayed main score is their average; racialDelta is measured from it", () => {
    const c = buildCharacterSheetContext(
      input({ subAbilityUi: true, source: withSubs({ str: { a: 18, b: 14 } }) }),
    );
    const str = c.abilities.find((a) => a.key === "str")!;
    expect(str.score).toBe(16); // (18 + 14) / 2
    expect(str.effectiveScore).toBe(17); // derived fixture value
    expect(str.racialDelta).toBe(1); // 17 - 16, NOT 17 - authored 17
    expect(str.subs!.map((s) => s.value)).toEqual([18, 14]);
  });

  it("exceptional Strength keys off the displayed (averaged) main score", () => {
    const c = buildCharacterSheetContext(
      input({ subAbilityUi: true, source: withSubs({ str: { a: 18, b: 18 } }) }),
    );
    expect(c.abilities.find((a) => a.key === "str")!.showExceptional).toBe(true); // authored 17, averaged 18
  });

  it("canSeed is false once every sub-score of every ability is authored", () => {
    const c = buildCharacterSheetContext(input({ subAbilityUi: true, source: withSubs(everyAbility) }));
    expect(c.subAbilities).toEqual({ enabled: true, canSeed: false });
  });

  it("canSeed is true while any single sub-score is still null", () => {
    const c = buildCharacterSheetContext(
      input({ subAbilityUi: true, source: withSubs({ ...everyAbility, cha: { a: 10, b: null } }) }),
    );
    expect(c.subAbilities.canSeed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sheets/character/context.test.ts > /tmp/8a4.log 2>&1; tail -n 40 /tmp/8a4.log`
Expected: FAIL (type errors / missing fields).

- [ ] **Step 3: Update the types**

`src/sheets/character/context-types.ts`:
- Add to `CharacterSheetInput` after `optionalRules: OptionalRules;`:
```typescript
  /** Sub-project 8 Plan 8a: true ONLY when this sheet renders the sub-score
   *  inputs (the PC sheet, with `subAbilitiesEnabled(rules)` true). Optional so
   *  every other consumer of this builder — notably the NPC sheet, which shares
   *  the ability-row partial — is off by default. */
  subAbilityUi?: boolean;
```
- Add above `AbilityRow`:
```typescript
export interface SubScoreCell {
  /** the sub-ability id, e.g. "muscle" */
  id: string;
  /** i18n key — templates wrap it in `{{localize}}` */
  label: string;
  /** the form field name, e.g. "system.abilities.str.sub.a" */
  name: string;
  /** the AUTHORED sub-score, null when unset */
  value: number | null;
  /** the authored main score the derivation falls back to while `value` is null */
  placeholder: number;
}
```
- Replace `AbilityRow` with:
```typescript
export interface AbilityRow {
  key: string; label: string;
  score: number; racialDelta: number; effectiveScore: number;
  exceptional: number | null; showExceptional: boolean;
  mods: { label: string; value: string }[];
  /** true while sub-scores derive the main score — the main input renders `disabled` */
  scoreLocked: boolean;
  /** the two sub-score cells, or null when the sub-score UI is off */
  subs: SubScoreCell[] | null;
}
```
- Add to `CharacterSheetContext` right after `abilities: AbilityRow[];`:
```typescript
  subAbilities: { enabled: boolean; canSeed: boolean };
```

- [ ] **Step 4: Update the builder**

`src/sheets/character/context.ts`:
- Add the import (with the other `../../core/...` imports): `import { mainScoreFromSubs, SUB_ABILITIES } from "../../core/abilities/sub-abilities";`
- Change `SourceView.system.abilities` to:
```typescript
    abilities: Record<
      AbilityKey,
      { score: number; exceptional: number | null; sub?: { a: number | null; b: number | null } | null }
    >;
```
- Replace `buildAbilities` with:
```typescript
function buildAbilities(input: CharacterSheetInput): AbilityRow[] {
  const src = input.source as unknown as SourceView;
  const subsOn = input.subAbilityUi === true;
  return ABILITY_KEYS.map((key) => {
    const authored = src.system.abilities[key];
    const derived = input.derived.abilities[key];
    const sub = authored.sub ?? { a: null, b: null };
    // While the rule is on, the displayed main score is the averaged (pre-racial)
    // value — the same pure function prepareBaseData uses — so racialDelta below
    // is only the racial part. Off: the authored score, exactly as before.
    const score = subsOn ? mainScoreFromSubs(sub.a, sub.b, authored.score) : authored.score;
    const effectiveScore = derived.score;
    const mods = Object.entries(derived.mods).map(([k, v]) => ({
      label: humanize(k),
      value: v == null ? "—" : String(v),
    }));
    const [idA, idB] = SUB_ABILITIES[key];
    return {
      key,
      label: input.config.abilities[key],
      score,
      racialDelta: effectiveScore - score,
      effectiveScore,
      exceptional: authored.exceptional,
      showExceptional: key === "str" && Number(score) === 18,
      mods,
      scoreLocked: subsOn,
      subs: subsOn
        ? [
            { id: idA, label: `ADND2E.sheet.subAbilities.${idA}`, name: `system.abilities.${key}.sub.a`, value: sub.a, placeholder: authored.score },
            { id: idB, label: `ADND2E.sheet.subAbilities.${idB}`, name: `system.abilities.${key}.sub.b`, value: sub.b, placeholder: authored.score },
          ]
        : null,
    };
  });
}

function buildSubAbilities(input: CharacterSheetInput): CharacterSheetContext["subAbilities"] {
  const enabled = input.subAbilityUi === true;
  const src = input.source as unknown as SourceView;
  const canSeed =
    enabled &&
    ABILITY_KEYS.some((k) => {
      const sub = src.system.abilities[k].sub;
      return sub == null || sub.a === null || sub.b === null;
    });
  return { enabled, canSeed };
}
```
- In `buildCharacterSheetContext`, add `subAbilities: buildSubAbilities(input),` directly after `abilities: buildAbilities(input),`.

- [ ] **Step 5: Run tests, typecheck, coverage**

Run: `npx vitest run tests/sheets/character/context.test.ts > /tmp/8a4b.log 2>&1; tail -n 40 /tmp/8a4b.log`
Run: `npm run typecheck > /tmp/8a4-tc.log 2>&1; tail -n 30 /tmp/8a4-tc.log`
Run: `npm run test:coverage > /tmp/8a4-cov.log 2>&1; tail -n 60 /tmp/8a4-cov.log`
Expected: PASS; `context.ts` keeps 100% statements/lines/functions and ≥90% branches (the new `subsOn`, `authored.sub ?? …`, and each `canSeed` disjunct are all exercised by Step 1's six tests). If typecheck reports another consumer constructing `AbilityRow`/`CharacterSheetContext` literals, add the new fields there — do not make them optional to dodge it.

- [ ] **Step 6: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts tests/sheets/character/context.test.ts
git commit -m "feat(sp8a): add gated sub-score rows to the pure sheet context

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: PC sheet UI — inputs, seed action, lang keys

**Files:**
- Modify: `templates/actor/character/partials/ability-row.hbs`
- Modify: `templates/actor/character/main.hbs`
- Modify: `styles/actor/character.scss`
- Create: `src/sheets/character/sub-ability-actions.ts`
- Modify: `src/sheets/character/sheet.ts`
- Modify: `lang/en.json`
- Modify: `tests/lang/en-coverage.test.ts`

Foundry-layer/templates/SCSS/lang — not unit-tested except the lang test. `src/sheets/npc/sheet.ts` and `templates/actor/npc/main.hbs` are deliberately NOT touched (Locked decision 7).

**Interfaces:**
- Consumes: `subAbilitiesEnabled`, `subScoreSeedUpdate`, `SubScoreSource`, `SUB_ABILITIES` (Task 2); `CharacterSheetInput.subAbilityUi`, `AbilityRow.subs`/`scoreLocked`, `CharacterSheetContext.subAbilities` (Task 4).
- Produces: `seedSubAbilities(actor)` in `sub-ability-actions.ts`; the `seedSubAbilities` sheet action.

**Current real state** (confirmed during planning): `ability-row.hbs` is 12 lines: a `.ability-row` div containing a label, the main `<input type="number" name="system.abilities.{{row.key}}.score" value="{{row.score}}" />`, the racial delta, the effective score, the optional exceptional input, and the mods; it is shared by `templates/actor/character/main.hbs:17-19` and `templates/actor/npc/main.hbs:31-33`. `.ability-row` in `styles/actor/character.scss:68-76` is `display: grid; grid-template-columns: 4rem 4rem 2.5rem 2.5rem auto; gap: 0.35rem; align-items: center;` with an `input[type="number"] { width: 100% }` rule. `sheet.ts`: `DEFAULT_OPTIONS.actions` (~line 269-) maps action names to `static async #onX(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement)` handlers (e.g. `takeAverageHp: Adnd2eCharacterSheet.#onTakeAverageHp` at ~271/554); `#buildInput()` (~line 358) ends its returned object with `optionalRules: getOptionalRules(),` (~line 441).

- [ ] **Step 1: The ability-row partial**

Replace `templates/actor/character/partials/ability-row.hbs` with:
```hbs
<div class="ability-row" data-ability="{{row.key}}">
  <label>{{localize row.label}}</label>
  <input type="number" name="system.abilities.{{row.key}}.score" value="{{row.score}}"{{#if row.scoreLocked}} disabled title="{{localize 'ADND2E.sheet.subAbilities.mainLocked'}}"{{/if}} />
  {{#if row.racialDelta}}<span class="racial">{{adnd2eSigned row.racialDelta}}</span>{{/if}}
  <span class="effective">{{row.effectiveScore}}</span>
  {{#if row.showExceptional}}
    <input type="number" name="system.abilities.str.exceptional" value="{{row.exceptional}}" placeholder="%" />
  {{/if}}
  <span class="mods">
    {{#each row.mods as |m|}}<span title="{{m.label}}">{{m.value}}</span>{{/each}}
  </span>
  {{#if row.subs}}
    <div class="sub-scores">
      {{#each row.subs as |sub|}}
        <label class="sub-score">
          {{localize sub.label}}
          <input type="number" min="1" max="25" name="{{sub.name}}" value="{{sub.value}}" placeholder="{{sub.placeholder}}" />
        </label>
      {{/each}}
    </div>
  {{/if}}
</div>
```
The main-score input is **`disabled`, never `readonly`** when locked (Locked decision 3 — `FormDataExtended` submits readonly fields and would overwrite the authored `_source` score). The partial references only `row`/`sub` (no root context), so the `{{#each}}`-rebinding `@root.` gotcha does not apply here.

- [ ] **Step 2: The seed button**

In `templates/actor/character/main.hbs`, inside the `.abilities.panel` div, add right after the `<h3>…abilities…</h3>` line (`main.hbs:16`):
```hbs
    {{#if adnd2e.subAbilities.canSeed}}
      <button type="button" data-action="seedSubAbilities">
        {{localize 'ADND2E.sheet.subAbilities.seed'}}
      </button>
    {{/if}}
```
(This is at the tab template's top level, not inside an `{{#each}}`, so the plain `adnd2e.` reference is correct.)

- [ ] **Step 3: Layout**

In `styles/actor/character.scss`, inside the `.ability-row { … }` block, after its existing `input[type="number"] { width: 100%; }` rule, add:
```scss
    .sub-scores {
      grid-column: 1 / -1;
      display: flex;
      gap: 0.75rem;

      .sub-score {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      input[type="number"] {
        width: 3.5rem;
      }
    }
```

- [ ] **Step 4: The seed action module**

Create `src/sheets/character/sub-ability-actions.ts`:
```typescript
import { subAbilitiesEnabled, subScoreSeedUpdate } from "../../core/abilities/sub-abilities";
import type { SubScoreSource } from "../../core/abilities/sub-abilities";
import type { AbilityKey } from "../../core/types";
import { getOptionalRules } from "../../settings";

/* ---------------------------------------------------------------------------
 * sub-ability-actions — SP8 Plan 8a.
 *
 * Foundry-coupled glue for the PC sheet's "Seed Sub-Scores From Main" button —
 * not unit-tested, verified in a linked dev world. The math (which sub-scores
 * to seed, with what value) is the pure `subScoreSeedUpdate`; this file only
 * re-checks the gate, reads the AUTHORED scores off `_source`, and writes the
 * update to the actor the user already owns (no cross-actor mutation).
 * ------------------------------------------------------------------------- */

interface SubAbilityActor {
  _source: { system: { abilities: Record<AbilityKey, SubScoreSource> } };
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Writes each null sub-score's ability's authored main score into it. Re-derives
 *  eligibility server-side (rule on, something to seed) — never trusts the button
 *  having been rendered — and no-ops with a toast otherwise. */
export async function seedSubAbilities(actor: SubAbilityActor): Promise<void> {
  const update = subAbilitiesEnabled(getOptionalRules()) ? subScoreSeedUpdate(actor._source.system.abilities) : {};
  if (Object.keys(update).length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.subAbilities.seedBlockedWarning"));
    return;
  }
  await actor.update(update);
}
```

- [ ] **Step 5: Wire the sheet**

In `src/sheets/character/sheet.ts`:
1. Add imports (read the file's existing import block first and place consistently): `import { subAbilitiesEnabled } from "../../core/abilities/sub-abilities";` and `import { seedSubAbilities } from "./sub-ability-actions";`
2. In `DEFAULT_OPTIONS.actions`, add: `seedSubAbilities: Adnd2eCharacterSheet.#onSeedSubAbilities,`
3. Add the handler next to `#onTakeAverageHp`:
```typescript
  static async #onSeedSubAbilities(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    _target: HTMLElement,
  ): Promise<void> {
    await seedSubAbilities(this.document as never);
  }
```
4. In `#buildInput()`: add `const rules = getOptionalRules();` immediately before the `return {`, and replace `optionalRules: getOptionalRules(),` with:
```typescript
      optionalRules: rules,
      subAbilityUi: subAbilitiesEnabled(rules),
```
`src/sheets/npc/sheet.ts` is NOT edited — its input never sets `subAbilityUi`, so the NPC keeps an editable, un-averaged main score and no sub-score inputs.

- [ ] **Step 6: Lang keys**

In `lang/en.json`, inside the `sheet` block (next to `"sections"`), add:
```json
      "subAbilities": {
        "muscle": "Muscle",
        "stamina": "Stamina",
        "aim": "Aim",
        "balance": "Balance",
        "health": "Health",
        "fitness": "Fitness",
        "reason": "Reason",
        "knowledge": "Knowledge",
        "intuition": "Intuition",
        "willpower": "Willpower",
        "leadership": "Leadership",
        "appearance": "Appearance",
        "seed": "Seed Sub-Scores From Main",
        "mainLocked": "Derived from the two sub-scores below",
        "seedBlockedWarning": "Sub-scores can't be seeded right now — refresh the sheet."
      },
```
(valid JSON — mind commas.) In `tests/lang/en-coverage.test.ts` add this import next to the existing `../../src/...` imports (top of file), and append this block at the end of the file (it uses the file's own `resolve(key)` helper, defined at line 12, and derives the twelve keys from the pure table instead of hard-coding them, so a future sub-ability can't ship without a label):
```typescript
import { SUB_ABILITIES } from "../../src/core/abilities/sub-abilities";
```
```typescript
describe("lang/en.json — SP8a sub-ability strings", () => {
  it("has a non-empty label for every sub-ability in SUB_ABILITIES", () => {
    for (const ids of Object.values(SUB_ABILITIES)) {
      for (const id of ids) {
        const key = `ADND2E.sheet.subAbilities.${id}`;
        expect(typeof resolve(key), key).toBe("string");
        expect((resolve(key) as string).length, key).toBeGreaterThan(0);
      }
    }
  });

  it("has the seed / main-locked / blocked strings", () => {
    for (const leaf of ["seed", "mainLocked", "seedBlockedWarning"]) {
      const key = `ADND2E.sheet.subAbilities.${leaf}`;
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `npm run typecheck > /tmp/8a5-tc.log 2>&1; tail -n 30 /tmp/8a5-tc.log`
Run: `npm run lint > /tmp/8a5-lint.log 2>&1; tail -n 30 /tmp/8a5-lint.log`
Run: `npm run test:coverage > /tmp/8a5-cov.log 2>&1; tail -n 60 /tmp/8a5-cov.log`
Expected: all PASS, thresholds met. Confirm `node -e "require('./lang/en.json')"` parses.

- [ ] **Step 8: Commit**

```bash
git add templates/actor/character/partials/ability-row.hbs templates/actor/character/main.hbs styles/actor/character.scss src/sheets/character/sub-ability-actions.ts src/sheets/character/sheet.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp8a): PC sheet sub-score inputs and seed action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Whole-branch review

**MANDATORY regardless of how clean every per-task review was.** Every plan in Sub-project 7 (7a, 7b, 7c, 7d) had a real Critical or Important bug caught ONLY here; treat it as the primary safety net.

- [ ] Dispatch a whole-branch review on the most capable available model over the full range from this branch's base to HEAD. Point it at this plan's Global Constraints, "Locked design decisions", and spec §2/§4.1/§5. Ask it to check, specifically:
  - **Authored-vs-prepared ratchet.** `applySubAbilityScores` reads `_source` for the authored score and writes only the PREPARED score; nothing anywhere writes a derived/averaged value back into `_source`. Trace the PC sheet form path end to end: with the rule on, the main-score input is `disabled` (excluded by `FormDataExtended`), so a `submitOnChange` from editing a sub-score cannot overwrite the authored `score`. Confirm `disabled` (not `readonly`) in the partial, against `client/applications/ux/form-data-extended.mjs`.
  - **Ordering.** `applySubAbilityScores(this)` runs BEFORE `applyRacialAdjustment(this)` in BOTH `character.ts` and `npc.ts`; racial deltas apply to the averaged score once.
  - **A gate stated differently in two files.** `grep` the whole diff for `skillsAndPowersEnabled` / `subAbilityScores`: outside `options.ts`, `registry.ts`, `sub-abilities.ts` (the single `subAbilitiesEnabled`) and tests, no file may restate the `&&` expression. The three consumers (derivation, PC `#buildInput`, seed action) must all call `subAbilitiesEnabled`.
  - **Template context binding.** Inside `{{#each}}` blocks, any reference to a ROOT context value needs `@root.` (a bare reference silently resolves to nothing — a recurring project bug class). The partial should only reference `row`/`sub`; the seed button is at tab top level.
  - **NPC isolation.** `src/sheets/npc/sheet.ts` and `templates/actor/npc/main.hbs` are untouched; the NPC's `subAbilityUi` is absent so its main input is editable and un-averaged and no sub inputs render. Confirm the shared partial still renders an NPC ability row exactly as before with the rule ON.
  - **A mutation the acting non-GM user may not be permitted to make.** The seed action and sub-score edits write only to the actor the user owns (`actor.update` on `this.document`); confirm there is no cross-actor write and that the seed action re-checks the gate server-side.
  - **Additive schema, no migration.** Confirm nothing was removed/renamed, no `system.json`/`package.json` version change, and the Task 3 report cites real v14.364 evidence that a missing required `sub` object is initialised for pre-existing actors.
  - **Rounding/clamp edge cases** in `mainScoreFromSubs` and `subScoreSeedUpdate`, and that the tests pin the .5 tie-break.
  - **Content policy:** no rules prose introduced.
  - Coverage/typecheck/lint green (re-run independently).
- [ ] Fix every Critical/Important finding via the standard fix-round process (the controller never fixes findings directly); one scoped re-review of the fix wave.
- [ ] Once clean, run `npm run typecheck && npm run lint && npm run test:coverage` and confirm green before Task 7.

---

### Task 7: GATED dev-world smoke check

**REQUIRED — never deferred, never skipped.** Confirm with the user that Foundry is fully closed before `npm run build`, then `npm run link`, then have the user restart Foundry. **This check MUST include a non-GM player seat.**

Setup: a test world with at least one PC that has a race item (a dwarf, for a CON racial delta) and authored scores you can read off the sheet, one NPC, and a second **Player-role** user account (open it in a private/incognito window) that owns the PC but not the NPC. Note the PC's authored scores and a few derived numbers (e.g. CON HP adjustment, STR hit/damage) BEFORE enabling anything.

- [ ] **Rules off (baseline):** no sub-score inputs anywhere; the main-score inputs are editable; nothing changed.
- [ ] **Master gate, both directions:** turn ON only `subAbilityScores` (master OFF) → sheet unchanged. Turn ON only the master (`subAbilityScores` OFF) → sheet unchanged. Turn ON both → sub-score inputs appear.
- [ ] **Enabling on an existing character changes nothing:** with both ON and no sub-scores set, every main score and every derived number still equals the baseline; the inputs show empty with the authored score as placeholder; the main-score inputs are greyed/disabled with the "Derived from…" tooltip; the "Seed Sub-Scores From Main" button is visible.
- [ ] **Seed:** click it → every sub-score fills with its ability's authored score; main scores and derived numbers still unchanged; the button disappears.
- [ ] **Averaging + racial ordering:** set STR sub-scores 18 and 14 → main shows 16; set the dwarf's CON sub-scores 15 and 14 → averaged 14.5 rounds UP to 15, then the racial +1 applies → effective CON 16 (`racial +1` shown, `effective 16`) and the CON-derived numbers match a CON 16. Set STR sub-scores 18 and 18 → the exceptional-Strength `%` input appears.
- [ ] **Empty falls back:** clear one sub-score → it falls back to the authored main score (main recomputes); no error, no stuck value.
- [ ] **No ratchet, no overwrite:** reload the world twice and edit a sub-score several times — the main score does not creep. Then turn the rule OFF: every main score returns to its ORIGINAL authored value (proof that the derived/averaged value was never written into the authored field).
- [ ] **Master independently disables:** with `subAbilityScores` ON, turn the master OFF → scores revert to authored, inputs vanish.
- [ ] **NPC sheet:** with the rule ON, the NPC sheet shows NO sub-score inputs, no seed button, and its main-score inputs remain editable and behave as before.
- [ ] **NON-GM PLAYER SEAT:** as the Player user (private window), open the owned PC with the rule ON: edit sub-scores and use "Seed Sub-Scores From Main" — both persist, the derived numbers update, no permission error toast; confirm the player cannot change the world settings; confirm the player cannot see sub-score inputs on an NPC they don't own (or the NPC sheet is read-only for them as before).
- [ ] Report each item PASS/FAIL to the user via `AskUserQuestion`, following this project's established pattern; distinguish a genuine code defect from a test-design mistake or test-setup gap (e.g. wrong character, race item missing) before concluding a FAIL. Fix real defects via the standard fix-round process, never directly.

---

## After this plan lands

Update `README.md`'s Sub-project table row 8 from `🔜 Planned` to `🚧 In progress (Plan 8a/3 done)` with a short scope note (four toggles wired, sub-ability scores), following the 7a-7c "Plans 7a-7x/4 done" convention. Follow this project's established finishing default: push and create a pull request without asking. Plan 8b (expanded proficiencies) is next; write it against the same spec (§4.2) — remember the corrected field path for 8c: the reserved untyped field is `system.options.skillsAndPowers`.
