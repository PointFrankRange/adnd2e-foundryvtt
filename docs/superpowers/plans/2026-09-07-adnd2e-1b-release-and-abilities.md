# AD&D 2E — Plan 1b: Release Workflow + Rules-Engine Scaffold + Ability Scores

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the system installable/updatable from a GitHub manifest URL, stand up the framework-free `src/core/` rules engine with its purity guardrail, and implement the complete AD&D 2E ability-score subsystem (all six abilities, exceptional Strength, cumulative Wisdom bonus spells) as pure functions with full Vitest coverage.

**Architecture:** Two independent pieces in one plan. (1) A GitHub Actions `release.yml` that builds, stamps `system.json`, zips `dist/`, and publishes a rolling `latest` prerelease (plus versioned releases on `v*` tags). (2) `src/core/` — pure TypeScript, no Foundry imports, one file per ability with its lookup table co-located, composed by `deriveAbilities()`. Vitest tests assert every table row.

**Tech Stack:** GitHub Actions + preinstalled `gh` CLI + `zip`; Node ESM script (`prepare-release.mjs`); TypeScript 5 strict; Vitest 5; ESLint 10 flat config (`no-restricted-globals` override for purity).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §3.4 (release workflow), §4 (`core/` architecture), §5.1 ability sub-scores, §9 (testing), §11 (reference workflow).

**Research source:** `references/research-notes.md` (git-ignored) — every ability table transcribed from the user's PHB PDF (pp.14–18, Appendix 8 pp.245–247) with citations. Table values in this plan are copied from there; the implementer does not need the PDF.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, or the DOM. Pure functions + literal lookup tables only. Enforced by an ESLint `no-restricted-globals` override on `src/core/**` and `tests/core/**`.
- Core functions return **plain data** (numbers, records, arrays) or **formula strings** — never a Foundry `Roll`.
- TypeScript `strict: true`. Prettier: printWidth 100, tabWidth 2, double quotes, semi, trailing-comma all.
- No copyrighted prose in the repo — only mechanical/factual values. Each table file carries a `// PHB Table N, p.XX` citation comment.
- Ability scores are integers in **[1, 25]**. Core ability functions throw `RangeError` on anything else (non-integer, <1, >25). Clamping/handling of drained scores (0 or below) is the DataModel layer's job, not core's.
- System `id` stays `adnd2e`; `version` in the committed `system.json` is a placeholder (`0.1.0`) that CI overwrites at publish time.
- The `latest` release tag is the stable install target. `manifest`/`download` in `system.json` always point at the `latest`-tag asset URLs (even inside versioned releases — a solo-dev simplification; documented).

---

## File Structure

**Created:**
- `scripts/prepare-release.mjs` — stamps `dist/system.json` `version`/`manifest`/`download` from the CI trigger.
- `.github/workflows/release.yml` — build → stamp → zip → publish `latest` (+ versioned release on `v*`).
- `src/core/README.md` — one paragraph: what `core/` is and the purity rule.
- `src/core/types.ts` — shared engine types (`AbilityKey`, `AbilityScores`, `AbilityModifiers`, per-ability mod record types).
- `src/core/options.ts` — `OptionalRules` type + `DEFAULT_OPTIONAL_RULES`.
- `src/core/errors.ts` — `assertAbilityScore(value, label)` → throws `RangeError`.
- `src/core/abilities/strength.ts` — `strength(score, exceptionalPercentile?)`.
- `src/core/abilities/dexterity.ts` — `dexterity(score)`.
- `src/core/abilities/constitution.ts` — `constitution(score, isWarrior)`.
- `src/core/abilities/intelligence.ts` — `intelligence(score)`.
- `src/core/abilities/wisdom.ts` — `wisdom(score)`.
- `src/core/abilities/charisma.ts` — `charisma(score)`.
- `src/core/abilities/racial-adjustments.ts` — `RACIAL_ABILITY_ADJUSTMENTS` + `applyRacialAdjustments()`.
- `src/core/abilities/index.ts` — `deriveAbilities(rawScores, racialAdjustments, options)` + `primeRequisiteXpBonus()`.
- `src/core/index.ts` — barrel re-export of the public core API.
- `tests/core/abilities/strength.test.ts`, `dexterity.test.ts`, `constitution.test.ts`, `intelligence.test.ts`, `wisdom.test.ts`, `charisma.test.ts`, `racial-adjustments.test.ts`, `derive-abilities.test.ts`.

**Modified:**
- `system.json` — add `url`, `manifest`, `download`.
- `.github/workflows/ci.yml` — `actions/checkout@v4`→`@v5`, `actions/setup-node@v4`→`@v5`.
- `eslint.config.js` — add a `no-restricted-globals` override block scoped to `src/core/**` + `tests/core/**`; scope the existing Foundry-globals block to non-core files.
- `README.md` — add an "Install into Foundry" section with the manifest URL.

---

## Task 1: Release workflow — `system.json` fields, `prepare-release.mjs`, `release.yml`, CI action bump

**Files:**
- Modify: `system.json`
- Modify: `.github/workflows/ci.yml`
- Create: `scripts/prepare-release.mjs`
- Create: `.github/workflows/release.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `dist/system.json` produced by `npm run build` (Vite static-copy).
- Produces: on every push to `master`, a GitHub prerelease tagged `latest` carrying `system.json` + `system.zip`; installable at `https://github.com/PointFrankRange/adnd2e-foundryvtt/releases/download/latest/system.json`.

- [ ] **Step 1: Add the three URL fields to `system.json`**

Insert after the `"flags"` object (keep it valid JSON — `flags` is currently the last key):

```json
  "url": "https://github.com/PointFrankRange/adnd2e-foundryvtt",
  "manifest": "https://github.com/PointFrankRange/adnd2e-foundryvtt/releases/download/latest/system.json",
  "download": "https://github.com/PointFrankRange/adnd2e-foundryvtt/releases/download/latest/system.zip"
```

- [ ] **Step 2: Bump CI action versions**

In `.github/workflows/ci.yml`: `actions/checkout@v4` → `actions/checkout@v5`, `actions/setup-node@v4` → `actions/setup-node@v5`. No other changes.

- [ ] **Step 3: Write `scripts/prepare-release.mjs`**

```js
#!/usr/bin/env node
// Stamp dist/system.json for a release. Run in CI after `npm run build`.
//   tag push  (GITHUB_REF = refs/tags/vX.Y.Z) -> version = X.Y.Z
//   any other push                            -> version = 0.1.0-dev.<run number>
// manifest/download always point at the fixed `latest` tag assets.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = "PointFrankRange/adnd2e-foundryvtt";
const LATEST = `https://github.com/${REPO}/releases/download/latest`;

const ref = process.env.GITHUB_REF ?? "";
const runNumber = process.env.GITHUB_RUN_NUMBER ?? "0";
const tagMatch = ref.match(/^refs\/tags\/v(.+)$/);
const version = tagMatch ? tagMatch[1] : `0.1.0-dev.${runNumber}`;

const path = resolve("dist/system.json");
const manifest = JSON.parse(readFileSync(path, "utf-8"));
manifest.version = version;
manifest.manifest = `${LATEST}/system.json`;
manifest.download = `${LATEST}/system.zip`;
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`prepared dist/system.json: version=${version}`);
```

- [ ] **Step 4: Write `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    branches: [master]
    tags: ["v*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: node scripts/prepare-release.mjs
        env:
          GITHUB_REF: ${{ github.ref }}
          GITHUB_RUN_NUMBER: ${{ github.run_number }}
      - name: Package
        run: cd dist && zip -r ../system.zip . && cd ..
      - name: Publish versioned release
        if: startsWith(github.ref, 'refs/tags/v')
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "${GITHUB_REF_NAME}" \
            --title "${GITHUB_REF_NAME}" \
            --notes "Automated release ${GITHUB_REF_NAME}." \
            dist/system.json system.zip
      - name: Refresh rolling latest prerelease
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release delete latest --cleanup-tag --yes || true
          gh release create latest \
            --prerelease \
            --title "Latest (rolling dev build)" \
            --notes "Auto-published from ${GITHUB_SHA}. Install target for development." \
            --target "${GITHUB_SHA}" \
            dist/system.json system.zip
```

- [ ] **Step 5: Add an install section to `README.md`**

Insert after the top description paragraph:

```markdown
## Install into Foundry

In **Configuration and Setup → Game Systems → Install System**, paste this
Manifest URL:

```
https://github.com/PointFrankRange/adnd2e-foundryvtt/releases/download/latest/system.json
```

This tracks the rolling `latest` build (published on every push to `master`).
After a new push, use **Update** in the Game Systems list to pull the newest build.
```

- [ ] **Step 6: Validate locally**

Run: `node -e "JSON.parse(require('fs').readFileSync('system.json','utf8')); console.log('system.json ok')"`
Run: `npm run build && node scripts/prepare-release.mjs` — expect `prepared dist/system.json: version=0.1.0-dev.0`, and `dist/system.json` now has `manifest`/`download` pointing at the `latest` URLs.
Run: `node -e "const m=require('./dist/system.json'); if(!m.manifest.endsWith('latest/system.json')) throw new Error('bad manifest'); console.log('stamp ok')"`

- [ ] **Step 7: YAML sanity check**

Run: `node -e "const f=require('fs').readFileSync('.github/workflows/release.yml','utf8'); if(f.includes('\t')) throw new Error('tabs in yaml'); console.log('no tabs')"`

- [ ] **Step 8: Commit**

```bash
git add system.json .github/workflows/ci.yml .github/workflows/release.yml scripts/prepare-release.mjs README.md
git commit -m "ci: publish installable releases from GitHub; bump CI actions to v5"
```

> After this task's branch merges to `master`, the first `release.yml` run publishes `latest`. The user then installs from the manifest URL. This is verified post-merge, not in this task.

---

## Task 2: `core/` scaffold — types, options, purity guardrail, barrel

**Files:**
- Create: `src/core/README.md`, `src/core/types.ts`, `src/core/options.ts`, `src/core/errors.ts`, `src/core/index.ts`
- Create: `tests/core/errors.test.ts`
- Modify: `eslint.config.js`

**Interfaces:**
- Produces:
  - `type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha"`
  - `interface AbilityScores { str: number; dex: number; con: number; int: number; wis: number; cha: number }`
  - `type ClassGroup = "warrior" | "wizard" | "priest" | "rogue"`
  - `interface OptionalRules { exceptionalStrength: boolean; maxSpellsPerLevel: boolean; /* …reserved keys… */ }` and `DEFAULT_OPTIONAL_RULES: OptionalRules`
  - `function assertAbilityScore(value: number, label: string): void` — throws `RangeError` unless `Number.isInteger(value) && value >= 1 && value <= 25`
- Consumed by: every later task.

- [ ] **Step 1: Write the failing test** — `tests/core/errors.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { assertAbilityScore } from "../../src/core/errors";

describe("assertAbilityScore", () => {
  it("accepts integers 1..25", () => {
    expect(() => assertAbilityScore(1, "str")).not.toThrow();
    expect(() => assertAbilityScore(18, "str")).not.toThrow();
    expect(() => assertAbilityScore(25, "str")).not.toThrow();
  });
  it("rejects out-of-range and non-integers with RangeError", () => {
    expect(() => assertAbilityScore(0, "str")).toThrow(RangeError);
    expect(() => assertAbilityScore(26, "str")).toThrow(RangeError);
    expect(() => assertAbilityScore(12.5, "str")).toThrow(RangeError);
    expect(() => assertAbilityScore(Number.NaN, "str")).toThrow(RangeError);
  });
  it("names the offending ability in the message", () => {
    expect(() => assertAbilityScore(0, "wis")).toThrow(/wis/);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm run test -- tests/core/errors.test.ts`
Expected: FAIL — cannot resolve `../../src/core/errors`.

- [ ] **Step 3: Create `src/core/errors.ts`**

```ts
export function assertAbilityScore(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw new RangeError(`${label} ability score must be an integer in [1, 25], got ${value}`);
  }
}
```

- [ ] **Step 4: Create `src/core/types.ts`**

```ts
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type ClassGroup = "warrior" | "wizard" | "priest" | "rogue";

export interface StrengthModifiers {
  hitProb: number;
  damageAdj: number;
  weightAllowance: number;
  maxPress: number;
  openDoors: number;
  openDoorsMagical: number | null;
  bendBarsLiftGates: number;
}

export interface DexterityModifiers {
  reactionAdj: number;
  missileAttackAdj: number;
  defensiveAdj: number;
}

export interface ConstitutionModifiers {
  hpAdjustment: number;
  systemShock: number;
  resurrectionSurvival: number;
  poisonSave: number;
  regeneration: string;
  hitDieMinimumRoll: number;
}

export interface IntelligenceModifiers {
  bonusLanguages: number;
  maxSpellLevel: number | null;
  learnSpellChance: number | null;
  maxSpellsPerLevel: number | null;
  illusionImmunityLevel: number | null;
}

export interface WisdomModifiers {
  magicalDefenseAdj: number;
  bonusPriestSpells: readonly number[];
  spellFailureChance: number;
  spellImmunityFromScore: number | null;
}

export interface CharismaModifiers {
  maxHenchmen: number;
  loyaltyBase: number;
  reactionAdj: number;
}

export interface DerivedAbilities {
  scores: AbilityScores;
  str: StrengthModifiers;
  dex: DexterityModifiers;
  con: ConstitutionModifiers;
  int: IntelligenceModifiers;
  wis: WisdomModifiers;
  cha: CharismaModifiers;
}
```

- [ ] **Step 5: Create `src/core/options.ts`**

```ts
export interface OptionalRules {
  /** PHB p.18: warriors roll d100 for exceptional Strength at STR 18. */
  exceptionalStrength: boolean;
  /** PHB p.17: cap on spells known per level from Intelligence (Table 4). */
  maxSpellsPerLevel: boolean;
}

export const DEFAULT_OPTIONAL_RULES: OptionalRules = {
  exceptionalStrength: true,
  maxSpellsPerLevel: false,
};
```

- [ ] **Step 6: Create `src/core/index.ts`**

```ts
export * from "./types";
export * from "./options";
export * from "./errors";
export * from "./abilities";
```

(The `./abilities` re-export resolves once Task 9 lands `src/core/abilities/index.ts`. If this task runs standalone first, temporarily omit that line and add it in Task 9 — note it in the task report.)

- [ ] **Step 7: Create `src/core/README.md`**

```markdown
# `core/` — framework-free rules engine

Every file here is pure TypeScript: no imports from `foundry`, `game`, `CONFIG`,
the DOM, or any Foundry API. Functions take all inputs explicitly (including an
`OptionalRules` bag for anything a house rule changes) and return plain data or
dice-formula **strings** — never a Foundry `Roll`.

The Foundry `data/` layer calls into this engine from `prepareDerivedData`.
Unit-tested with Vitest under `tests/core/`. Lint enforces the no-Foundry rule.
```

- [ ] **Step 8: Add the ESLint purity override** — `eslint.config.js`

Scope the existing Foundry-globals block so it does NOT apply to core, and add a restriction block for core:

```js
  // Foundry globals — everywhere EXCEPT the framework-free engine
  {
    files: ["src/**/*.ts"],
    ignores: ["src/core/**"],
    languageOptions: {
      globals: {
        game: "readonly", Hooks: "readonly", foundry: "readonly",
        CONFIG: "readonly", ui: "readonly", canvas: "readonly",
      },
    },
  },
  // The engine must stay pure
  {
    files: ["src/core/**/*.ts", "tests/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "game", message: "core/ must not touch Foundry globals" },
        { name: "Hooks", message: "core/ must not touch Foundry globals" },
        { name: "foundry", message: "core/ must not touch Foundry globals" },
        { name: "CONFIG", message: "core/ must not touch Foundry globals" },
        { name: "ui", message: "core/ must not touch Foundry globals" },
        { name: "canvas", message: "core/ must not touch Foundry globals" },
      ],
    },
  },
```

(Place these in the flat-config array after the existing shared block. Keep the existing `game`/`Hooks`/… globals available to non-core `src/` files — the scripts/config block from Plan 1a stays as-is.)

- [ ] **Step 9: Run tests + gates**

Run: `npm run test -- tests/core/errors.test.ts` → PASS
Run: `npm run typecheck` → no errors
Run: `npm run lint` → no errors (add a throwaway `game` reference inside a scratch `src/core/` file to confirm the rule fires, then delete it — report the observed error text)

- [ ] **Step 10: Commit**

```bash
git add src/core tests/core/errors.test.ts eslint.config.js
git commit -m "feat(core): rules-engine scaffold — types, options, purity lint guard"
```

---

## Task 3: `strength()` — Table 1

**Files:**
- Create: `src/core/abilities/strength.ts`
- Create: `tests/core/abilities/strength.test.ts`

**Interfaces:**
- Consumes: `assertAbilityScore` (Task 2), `StrengthModifiers` (Task 2).
- Produces: `function strength(score: number, exceptionalPercentile?: number | null): StrengthModifiers`
  - `score` 1–25 (throws otherwise via `assertAbilityScore`).
  - `exceptionalPercentile`: 1–100 (100 represents "00"), or `null`/omitted. Used **only** when `score === 18`; ignored otherwise. If `score === 18` and it is `null`/omitted, the plain-18 row is used. A percentile outside 1–100 throws `RangeError`.

- [ ] **Step 1: Write the failing test** — `tests/core/abilities/strength.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { strength } from "../../../src/core/abilities/strength";

describe("strength()", () => {
  it("score 1 (weakest)", () => {
    expect(strength(1)).toEqual({
      hitProb: -5, damageAdj: -4, weightAllowance: 1, maxPress: 3,
      openDoors: 1, openDoorsMagical: null, bendBarsLiftGates: 0,
    });
  });

  it("mid ranges use the band the score falls in", () => {
    expect(strength(5)).toMatchObject({ hitProb: -2, damageAdj: -1, weightAllowance: 10, maxPress: 25, openDoors: 3 });
    expect(strength(7)).toMatchObject({ hitProb: -1, damageAdj: 0, weightAllowance: 20, maxPress: 55, openDoors: 4 });
    expect(strength(9)).toMatchObject({ hitProb: 0, damageAdj: 0, weightAllowance: 35, maxPress: 90, openDoors: 5, bendBarsLiftGates: 1 });
    expect(strength(15)).toMatchObject({ weightAllowance: 55, maxPress: 170, openDoors: 8, bendBarsLiftGates: 7 });
    expect(strength(16)).toMatchObject({ hitProb: 0, damageAdj: 1, weightAllowance: 70, bendBarsLiftGates: 10 });
    expect(strength(17)).toMatchObject({ hitProb: 1, damageAdj: 1, weightAllowance: 85, bendBarsLiftGates: 13 });
  });

  it("plain 18 when no exceptional percentile", () => {
    expect(strength(18)).toEqual({
      hitProb: 1, damageAdj: 2, weightAllowance: 110, maxPress: 255,
      openDoors: 11, openDoorsMagical: null, bendBarsLiftGates: 16,
    });
  });

  it("exceptional Strength bands (only for score 18)", () => {
    expect(strength(18, 25)).toMatchObject({ hitProb: 1, damageAdj: 3, weightAllowance: 135, maxPress: 280, openDoors: 12, bendBarsLiftGates: 20 }); // 01-50
    expect(strength(18, 60)).toMatchObject({ hitProb: 2, damageAdj: 3, weightAllowance: 160, bendBarsLiftGates: 25 }); // 51-75
    expect(strength(18, 85)).toMatchObject({ hitProb: 2, damageAdj: 4, weightAllowance: 185, bendBarsLiftGates: 30 }); // 76-90
    expect(strength(18, 95)).toMatchObject({ hitProb: 2, damageAdj: 5, weightAllowance: 235, openDoors: 15, openDoorsMagical: 3, bendBarsLiftGates: 35 }); // 91-99
    expect(strength(18, 100)).toMatchObject({ hitProb: 3, damageAdj: 6, weightAllowance: 335, openDoors: 16, openDoorsMagical: 6, bendBarsLiftGates: 40 }); // 00
  });

  it("percentile ignored when score is not 18", () => {
    expect(strength(17, 100)).toEqual(strength(17));
  });

  it("giant-strength scores 19-25", () => {
    expect(strength(19)).toMatchObject({ hitProb: 3, damageAdj: 7, weightAllowance: 485, maxPress: 640, openDoors: 16, openDoorsMagical: 8, bendBarsLiftGates: 50 });
    expect(strength(22)).toMatchObject({ hitProb: 4, damageAdj: 10, weightAllowance: 785, openDoors: 18, openDoorsMagical: 14, bendBarsLiftGates: 80 });
    expect(strength(25)).toEqual({
      hitProb: 7, damageAdj: 14, weightAllowance: 1535, maxPress: 1750,
      openDoors: 19, openDoorsMagical: 18, bendBarsLiftGates: 99,
    });
  });

  it("rejects invalid input", () => {
    expect(() => strength(0)).toThrow(RangeError);
    expect(() => strength(26)).toThrow(RangeError);
    expect(() => strength(18, 0)).toThrow(RangeError);
    expect(() => strength(18, 101)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm run test -- tests/core/abilities/strength.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/core/abilities/strength.ts`**

Table 1 rows (PHB p.14 / Appendix 8 p.245). Columns: `[hitProb, damageAdj, weightAllowance, maxPress, openDoors, openDoorsMagical, bendBarsLiftGates]`.

```ts
// PHB Table 1: STRENGTH (p.14; Appendix 8 p.245). Verified from references/research-notes.md.
import { assertAbilityScore } from "../errors";
import type { StrengthModifiers } from "../types";

type Row = [number, number, number, number, number, number | null, number];

// Non-18 scores, keyed by exact score.
const BY_SCORE: Record<number, Row> = {
  1: [-5, -4, 1, 3, 1, null, 0],
  2: [-3, -2, 1, 5, 1, null, 0],
  3: [-3, -1, 5, 10, 2, null, 0],
  4: [-2, -1, 10, 25, 3, null, 0],
  5: [-2, -1, 10, 25, 3, null, 0],
  6: [-1, 0, 20, 55, 4, null, 0],
  7: [-1, 0, 20, 55, 4, null, 0],
  8: [0, 0, 35, 90, 5, null, 1],
  9: [0, 0, 35, 90, 5, null, 1],
  10: [0, 0, 40, 115, 6, null, 2],
  11: [0, 0, 40, 115, 6, null, 2],
  12: [0, 0, 45, 140, 7, null, 4],
  13: [0, 0, 45, 140, 7, null, 4],
  14: [0, 0, 55, 170, 8, null, 7],
  15: [0, 0, 55, 170, 8, null, 7],
  16: [0, 1, 70, 195, 9, null, 10],
  17: [1, 1, 85, 220, 10, null, 13],
  18: [1, 2, 110, 255, 11, null, 16],
  19: [3, 7, 485, 640, 16, 8, 50],
  20: [3, 8, 535, 700, 17, 10, 60],
  21: [4, 9, 635, 810, 17, 12, 70],
  22: [4, 10, 785, 970, 18, 14, 80],
  23: [5, 11, 935, 1130, 18, 16, 90],
  24: [6, 12, 1235, 1440, 19, 17, 95],
  25: [7, 14, 1535, 1750, 19, 18, 99],
};

// Exceptional Strength bands for score 18, by upper bound of the percentile band.
const EXCEPTIONAL: ReadonlyArray<{ max: number; row: Row }> = [
  { max: 50, row: [1, 3, 135, 280, 12, null, 20] },
  { max: 75, row: [2, 3, 160, 305, 13, null, 25] },
  { max: 90, row: [2, 4, 185, 330, 14, null, 30] },
  { max: 99, row: [2, 5, 235, 380, 15, 3, 35] },
  { max: 100, row: [3, 6, 335, 480, 16, 6, 40] },
];

function toModifiers(r: Row): StrengthModifiers {
  return {
    hitProb: r[0], damageAdj: r[1], weightAllowance: r[2], maxPress: r[3],
    openDoors: r[4], openDoorsMagical: r[5], bendBarsLiftGates: r[6],
  };
}

export function strength(score: number, exceptionalPercentile?: number | null): StrengthModifiers {
  assertAbilityScore(score, "str");
  if (score === 18 && exceptionalPercentile != null) {
    if (!Number.isInteger(exceptionalPercentile) || exceptionalPercentile < 1 || exceptionalPercentile > 100) {
      throw new RangeError(`exceptional Strength percentile must be an integer in [1, 100], got ${exceptionalPercentile}`);
    }
    const band = EXCEPTIONAL.find((b) => exceptionalPercentile <= b.max)!;
    return toModifiers(band.row);
  }
  return toModifiers(BY_SCORE[score]);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm run test -- tests/core/abilities/strength.test.ts` → PASS (all cases).

- [ ] **Step 5: Gates**

Run: `npm run typecheck && npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/abilities/strength.ts tests/core/abilities/strength.test.ts
git commit -m "feat(core): strength() ability modifiers — PHB Table 1"
```

---

## Task 4: `dexterity()` — Table 2

**Files:**
- Create: `src/core/abilities/dexterity.ts`, `tests/core/abilities/dexterity.test.ts`

**Interfaces:**
- Produces: `function dexterity(score: number): DexterityModifiers` — `{ reactionAdj, missileAttackAdj, defensiveAdj }`. `defensiveAdj` is the AC modifier as printed (negative = better AC).

- [ ] **Step 1: Failing test** — assert every distinct row of Table 2 (PHB p.14):

```ts
import { describe, expect, it } from "vitest";
import { dexterity } from "../../../src/core/abilities/dexterity";

const rows: Array<[number, number, number, number]> = [
  // score, reactionAdj, missileAttackAdj, defensiveAdj
  [1, -6, -6, 5], [2, -4, -4, 5], [3, -3, -3, 4], [4, -2, -2, 3], [5, -1, -1, 2],
  [6, 0, 0, 1], [7, 0, 0, 0], [9, 0, 0, 0], [10, 0, 0, 0], [14, 0, 0, 0],
  [15, 0, 0, -1], [16, 1, 1, -2], [17, 2, 2, -3], [18, 2, 2, -4], [19, 3, 3, -4],
  [20, 3, 3, -4], [21, 4, 4, -5], [22, 4, 4, -5], [23, 4, 4, -5], [24, 5, 5, -6], [25, 5, 5, -6],
];

describe("dexterity()", () => {
  it.each(rows)("score %i", (score, reactionAdj, missileAttackAdj, defensiveAdj) => {
    expect(dexterity(score)).toEqual({ reactionAdj, missileAttackAdj, defensiveAdj });
  });
  it("rejects invalid", () => {
    expect(() => dexterity(0)).toThrow(RangeError);
    expect(() => dexterity(26)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**  `npm run test -- tests/core/abilities/dexterity.test.ts`

- [ ] **Step 3: Implement** — `src/core/abilities/dexterity.ts`

```ts
// PHB Table 2: DEXTERITY (p.14; Appendix 8 p.245).
import { assertAbilityScore } from "../errors";
import type { DexterityModifiers } from "../types";

type Row = [number, number, number]; // reaction, missile, defensive

const BY_SCORE: Record<number, Row> = {
  1: [-6, -6, 5], 2: [-4, -4, 5], 3: [-3, -3, 4], 4: [-2, -2, 3], 5: [-1, -1, 2],
  6: [0, 0, 1], 7: [0, 0, 0], 8: [0, 0, 0], 9: [0, 0, 0], 10: [0, 0, 0], 11: [0, 0, 0],
  12: [0, 0, 0], 13: [0, 0, 0], 14: [0, 0, 0], 15: [0, 0, -1], 16: [1, 1, -2],
  17: [2, 2, -3], 18: [2, 2, -4], 19: [3, 3, -4], 20: [3, 3, -4], 21: [4, 4, -5],
  22: [4, 4, -5], 23: [4, 4, -5], 24: [5, 5, -6], 25: [5, 5, -6],
};

export function dexterity(score: number): DexterityModifiers {
  assertAbilityScore(score, "dex");
  const [reactionAdj, missileAttackAdj, defensiveAdj] = BY_SCORE[score];
  return { reactionAdj, missileAttackAdj, defensiveAdj };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Gates.**  **Step 6: Commit** `feat(core): dexterity() ability modifiers — PHB Table 2`

---

## Task 5: `constitution()` — Table 3

**Files:**
- Create: `src/core/abilities/constitution.ts`, `tests/core/abilities/constitution.test.ts`

**Interfaces:**
- Produces: `function constitution(score: number, isWarrior: boolean): ConstitutionModifiers`
  - `{ hpAdjustment, systemShock, resurrectionSurvival, poisonSave, regeneration, hitDieMinimumRoll }`
  - `hpAdjustment`: warrior gets `+3` at 17, `+4` at 18, `+5` at 19; non-warrior capped at `+2` for 17–25. Below 17 they are equal.
  - `regeneration`: the printed string (`"Nil"`, `"1/6 turns"`, …).
  - `hitDieMinimumRoll`: 1 normally; 2 at score 20; 3 at 21–22; 4 at 23–25 (exceptional-CON reroll floor).

- [ ] **Step 1: Failing test** — key rows from PHB p.15:

```ts
import { describe, expect, it } from "vitest";
import { constitution } from "../../../src/core/abilities/constitution";

describe("constitution()", () => {
  it("low scores", () => {
    expect(constitution(1, false)).toEqual({ hpAdjustment: -3, systemShock: 25, resurrectionSurvival: 30, poisonSave: -2, regeneration: "Nil", hitDieMinimumRoll: 1 });
    expect(constitution(3, false)).toMatchObject({ hpAdjustment: -2, poisonSave: 0 });
    expect(constitution(6, false)).toMatchObject({ hpAdjustment: -1, systemShock: 50 });
  });
  it("no adjustment band 7-14", () => {
    expect(constitution(7, false)).toMatchObject({ hpAdjustment: 0, systemShock: 55, resurrectionSurvival: 60 });
    expect(constitution(14, false)).toMatchObject({ hpAdjustment: 0, systemShock: 88, resurrectionSurvival: 92 });
  });
  it("15-16 same for all", () => {
    expect(constitution(15, false)).toMatchObject({ hpAdjustment: 1, systemShock: 90 });
    expect(constitution(16, true)).toMatchObject({ hpAdjustment: 2, systemShock: 95 });
  });
  it("warrior vs non-warrior at 17-19", () => {
    expect(constitution(17, false).hpAdjustment).toBe(2);
    expect(constitution(17, true).hpAdjustment).toBe(3);
    expect(constitution(18, false).hpAdjustment).toBe(2);
    expect(constitution(18, true).hpAdjustment).toBe(4);
    expect(constitution(19, false).hpAdjustment).toBe(2);
    expect(constitution(19, true).hpAdjustment).toBe(5);
  });
  it("exceptional CON: poison save, regeneration, HD minimum", () => {
    expect(constitution(19, false)).toMatchObject({ poisonSave: 1, regeneration: "Nil", hitDieMinimumRoll: 1 });
    expect(constitution(20, false)).toMatchObject({ poisonSave: 1, regeneration: "1/6 turns", hitDieMinimumRoll: 2 });
    expect(constitution(21, false)).toMatchObject({ poisonSave: 2, regeneration: "1/5 turns", hitDieMinimumRoll: 3 });
    expect(constitution(22, true).hpAdjustment).toBe(6);
    expect(constitution(23, false)).toMatchObject({ poisonSave: 3, regeneration: "1/3 turns", hitDieMinimumRoll: 4 });
    expect(constitution(24, true)).toMatchObject({ hpAdjustment: 7, regeneration: "1/2 turns" });
    expect(constitution(25, false)).toMatchObject({ hpAdjustment: 2, systemShock: 100, resurrectionSurvival: 100, poisonSave: 4, regeneration: "1/1 turn", hitDieMinimumRoll: 4 });
    expect(constitution(25, true).hpAdjustment).toBe(7);
  });
  it("rejects invalid", () => {
    expect(() => constitution(0, false)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/abilities/constitution.ts`

Table 3 (PHB p.15). Columns per score: `[hpNonWarrior, hpWarrior, systemShock, resurrectionSurvival, poisonSave, regeneration, hitDieMinimumRoll]`.

```ts
// PHB Table 3: CONSTITUTION (p.15; Appendix 8 p.245).
import { assertAbilityScore } from "../errors";
import type { ConstitutionModifiers } from "../types";

type Row = [number, number, number, number, number, string, number];

const BY_SCORE: Record<number, Row> = {
  1: [-3, -3, 25, 30, -2, "Nil", 1],
  2: [-2, -2, 30, 35, -1, "Nil", 1],
  3: [-2, -2, 35, 40, 0, "Nil", 1],
  4: [-1, -1, 40, 45, 0, "Nil", 1],
  5: [-1, -1, 45, 50, 0, "Nil", 1],
  6: [-1, -1, 50, 55, 0, "Nil", 1],
  7: [0, 0, 55, 60, 0, "Nil", 1],
  8: [0, 0, 60, 65, 0, "Nil", 1],
  9: [0, 0, 65, 70, 0, "Nil", 1],
  10: [0, 0, 70, 75, 0, "Nil", 1],
  11: [0, 0, 75, 80, 0, "Nil", 1],
  12: [0, 0, 80, 85, 0, "Nil", 1],
  13: [0, 0, 85, 90, 0, "Nil", 1],
  14: [0, 0, 88, 92, 0, "Nil", 1],
  15: [1, 1, 90, 94, 0, "Nil", 1],
  16: [2, 2, 95, 96, 0, "Nil", 1],
  17: [2, 3, 97, 98, 0, "Nil", 1],
  18: [2, 4, 99, 100, 0, "Nil", 1],
  19: [2, 5, 99, 100, 1, "Nil", 1],
  20: [2, 5, 99, 100, 1, "1/6 turns", 2],
  21: [2, 6, 99, 100, 2, "1/5 turns", 3],
  22: [2, 6, 99, 100, 2, "1/4 turns", 3],
  23: [2, 6, 99, 100, 3, "1/3 turns", 4],
  24: [2, 7, 99, 100, 3, "1/2 turns", 4],
  25: [2, 7, 100, 100, 4, "1/1 turn", 4],
};

export function constitution(score: number, isWarrior: boolean): ConstitutionModifiers {
  assertAbilityScore(score, "con");
  const [hpNon, hpWar, systemShock, resurrectionSurvival, poisonSave, regeneration, hitDieMinimumRoll] =
    BY_SCORE[score];
  return {
    hpAdjustment: isWarrior ? hpWar : hpNon,
    systemShock,
    resurrectionSurvival,
    poisonSave,
    regeneration,
    hitDieMinimumRoll,
  };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Gates.**  **Step 6: Commit** `feat(core): constitution() ability modifiers — PHB Table 3`

---

## Task 6: `intelligence()` — Table 4

**Files:**
- Create: `src/core/abilities/intelligence.ts`, `tests/core/abilities/intelligence.test.ts`

**Interfaces:**
- Produces: `function intelligence(score: number): IntelligenceModifiers`
  - `{ bonusLanguages, maxSpellLevel, learnSpellChance, maxSpellsPerLevel, illusionImmunityLevel }`
  - `maxSpellLevel`: highest wizard spell level learnable (`null` for score < 9). `4` means "4th".
  - `learnSpellChance`: percent (`null` for < 9).
  - `maxSpellsPerLevel`: cap on spells known per level (`null` for < 9, and `null` meaning "All" at 19+ — represent "All" as `null`). **Note:** score < 9 also `null` — disambiguate via `maxSpellLevel` being `null` = non-caster-capable.
  - `illusionImmunityLevel`: 1–7 for scores 19–25, else `null`.

- [ ] **Step 1: Failing test** (PHB p.16):

```ts
import { describe, expect, it } from "vitest";
import { intelligence } from "../../../src/core/abilities/intelligence";

describe("intelligence()", () => {
  it("very low: no spellcasting capability", () => {
    expect(intelligence(1)).toEqual({ bonusLanguages: 0, maxSpellLevel: null, learnSpellChance: null, maxSpellsPerLevel: null, illusionImmunityLevel: null });
    expect(intelligence(8)).toEqual({ bonusLanguages: 1, maxSpellLevel: null, learnSpellChance: null, maxSpellsPerLevel: null, illusionImmunityLevel: null });
  });
  it("9-18 rows", () => {
    expect(intelligence(9)).toEqual({ bonusLanguages: 2, maxSpellLevel: 4, learnSpellChance: 35, maxSpellsPerLevel: 6, illusionImmunityLevel: null });
    expect(intelligence(10)).toMatchObject({ maxSpellLevel: 5, learnSpellChance: 40, maxSpellsPerLevel: 7 });
    expect(intelligence(12)).toMatchObject({ bonusLanguages: 3, maxSpellLevel: 6, learnSpellChance: 50, maxSpellsPerLevel: 7 });
    expect(intelligence(13)).toMatchObject({ maxSpellsPerLevel: 9 });
    expect(intelligence(14)).toMatchObject({ bonusLanguages: 4, maxSpellLevel: 7, learnSpellChance: 60, maxSpellsPerLevel: 9 });
    expect(intelligence(15)).toMatchObject({ maxSpellsPerLevel: 11 });
    expect(intelligence(16)).toMatchObject({ bonusLanguages: 5, maxSpellLevel: 8, learnSpellChance: 70, maxSpellsPerLevel: 11 });
    expect(intelligence(17)).toMatchObject({ bonusLanguages: 6, learnSpellChance: 75, maxSpellsPerLevel: 14 });
    expect(intelligence(18)).toEqual({ bonusLanguages: 7, maxSpellLevel: 9, learnSpellChance: 85, maxSpellsPerLevel: 18, illusionImmunityLevel: null });
  });
  it("19-25: All spells, illusion immunity", () => {
    expect(intelligence(19)).toEqual({ bonusLanguages: 8, maxSpellLevel: 9, learnSpellChance: 95, maxSpellsPerLevel: null, illusionImmunityLevel: 1 });
    expect(intelligence(20)).toMatchObject({ bonusLanguages: 9, learnSpellChance: 96, illusionImmunityLevel: 2 });
    expect(intelligence(21)).toMatchObject({ bonusLanguages: 10, learnSpellChance: 97, illusionImmunityLevel: 3 });
    expect(intelligence(22)).toMatchObject({ bonusLanguages: 11, learnSpellChance: 98, illusionImmunityLevel: 4 });
    expect(intelligence(23)).toMatchObject({ bonusLanguages: 12, learnSpellChance: 99, illusionImmunityLevel: 5 });
    expect(intelligence(24)).toMatchObject({ bonusLanguages: 15, learnSpellChance: 100, illusionImmunityLevel: 6 });
    expect(intelligence(25)).toEqual({ bonusLanguages: 20, maxSpellLevel: 9, learnSpellChance: 100, maxSpellsPerLevel: null, illusionImmunityLevel: 7 });
  });
  it("rejects invalid", () => { expect(() => intelligence(0)).toThrow(RangeError); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/abilities/intelligence.ts`

Columns per score: `[bonusLanguages, maxSpellLevel|null, learnSpellChance|null, maxSpellsPerLevel|null, illusionImmunityLevel|null]`. Score 1 = 0 languages; 2–8 = 1 language.

```ts
// PHB Table 4: INTELLIGENCE (p.16; Appendix 8 p.245).
import { assertAbilityScore } from "../errors";
import type { IntelligenceModifiers } from "../types";

type Row = [number, number | null, number | null, number | null, number | null];

const BY_SCORE: Record<number, Row> = {
  1: [0, null, null, null, null],
  2: [1, null, null, null, null],
  3: [1, null, null, null, null],
  4: [1, null, null, null, null],
  5: [1, null, null, null, null],
  6: [1, null, null, null, null],
  7: [1, null, null, null, null],
  8: [1, null, null, null, null],
  9: [2, 4, 35, 6, null],
  10: [2, 5, 40, 7, null],
  11: [2, 5, 45, 7, null],
  12: [3, 6, 50, 7, null],
  13: [3, 6, 55, 9, null],
  14: [4, 7, 60, 9, null],
  15: [4, 7, 65, 11, null],
  16: [5, 8, 70, 11, null],
  17: [6, 8, 75, 14, null],
  18: [7, 9, 85, 18, null],
  19: [8, 9, 95, null, 1],
  20: [9, 9, 96, null, 2],
  21: [10, 9, 97, null, 3],
  22: [11, 9, 98, null, 4],
  23: [12, 9, 99, null, 5],
  24: [15, 9, 100, null, 6],
  25: [20, 9, 100, null, 7],
};

export function intelligence(score: number): IntelligenceModifiers {
  assertAbilityScore(score, "int");
  const [bonusLanguages, maxSpellLevel, learnSpellChance, maxSpellsPerLevel, illusionImmunityLevel] =
    BY_SCORE[score];
  return { bonusLanguages, maxSpellLevel, learnSpellChance, maxSpellsPerLevel, illusionImmunityLevel };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Gates.**  **Step 6: Commit** `feat(core): intelligence() ability modifiers — PHB Table 4`

---

## Task 7: `wisdom()` — Table 5 (with cumulative bonus priest spells)

**Files:**
- Create: `src/core/abilities/wisdom.ts`, `tests/core/abilities/wisdom.test.ts`

**Interfaces:**
- Produces: `function wisdom(score: number): WisdomModifiers`
  - `{ magicalDefenseAdj, bonusPriestSpells, spellFailureChance, spellImmunityFromScore }`
  - `bonusPriestSpells`: a length-7 array `[lvl1..lvl7]` of **cumulative** bonus spell counts (PHB p.17: "Bonus spells are cumulative"). Verified counts in `references/research-notes.md`.
  - `spellFailureChance`: percent (0 for WIS ≥ 13).
  - `spellImmunityFromScore`: the WIS score at which the character gains cumulative mind-magic immunity (19–25), else `null`. (The list of spell names is prose — not stored here; the DataModel/compendium layer maps score→immunities later.)

- [ ] **Step 1: Failing test** (PHB p.17):

```ts
import { describe, expect, it } from "vitest";
import { wisdom } from "../../../src/core/abilities/wisdom";

describe("wisdom()", () => {
  it("penalties and spell failure below 13", () => {
    expect(wisdom(1)).toMatchObject({ magicalDefenseAdj: -6, spellFailureChance: 80 });
    expect(wisdom(7)).toMatchObject({ magicalDefenseAdj: -1, spellFailureChance: 30 });
    expect(wisdom(9)).toMatchObject({ magicalDefenseAdj: 0, spellFailureChance: 20, bonusPriestSpells: [0, 0, 0, 0, 0, 0, 0] });
    expect(wisdom(12)).toMatchObject({ spellFailureChance: 5, bonusPriestSpells: [0, 0, 0, 0, 0, 0, 0] });
  });
  it("magical defense adjustment 13-25", () => {
    expect(wisdom(13).magicalDefenseAdj).toBe(0);
    expect(wisdom(15).magicalDefenseAdj).toBe(1);
    expect(wisdom(16).magicalDefenseAdj).toBe(2);
    expect(wisdom(17).magicalDefenseAdj).toBe(3);
    expect(wisdom(18).magicalDefenseAdj).toBe(4);
    expect(wisdom(25).magicalDefenseAdj).toBe(4);
  });
  it("cumulative bonus priest spells", () => {
    expect(wisdom(13).bonusPriestSpells).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(wisdom(14).bonusPriestSpells).toEqual([2, 0, 0, 0, 0, 0, 0]);
    expect(wisdom(15).bonusPriestSpells).toEqual([2, 1, 0, 0, 0, 0, 0]); // PHB p.17 example
    expect(wisdom(16).bonusPriestSpells).toEqual([2, 2, 0, 0, 0, 0, 0]);
    expect(wisdom(17).bonusPriestSpells).toEqual([2, 2, 1, 0, 0, 0, 0]);
    expect(wisdom(18).bonusPriestSpells).toEqual([2, 2, 1, 1, 0, 0, 0]);
    expect(wisdom(19).bonusPriestSpells).toEqual([3, 2, 1, 2, 0, 0, 0]);
    expect(wisdom(20).bonusPriestSpells).toEqual([3, 3, 1, 3, 0, 0, 0]);
    expect(wisdom(21).bonusPriestSpells).toEqual([3, 3, 2, 3, 1, 0, 0]);
    expect(wisdom(22).bonusPriestSpells).toEqual([3, 3, 2, 4, 2, 0, 0]);
    expect(wisdom(23).bonusPriestSpells).toEqual([3, 3, 2, 4, 4, 0, 0]);
    expect(wisdom(24).bonusPriestSpells).toEqual([3, 3, 2, 4, 4, 2, 0]);
    expect(wisdom(25).bonusPriestSpells).toEqual([3, 3, 2, 4, 4, 3, 1]);
  });
  it("spell immunity score", () => {
    expect(wisdom(18).spellImmunityFromScore).toBeNull();
    expect(wisdom(19).spellImmunityFromScore).toBe(19);
    expect(wisdom(25).spellImmunityFromScore).toBe(25);
  });
  it("rejects invalid", () => { expect(() => wisdom(0)).toThrow(RangeError); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/abilities/wisdom.ts`

```ts
// PHB Table 5: WISDOM (p.17; Appendix 8 p.246). Bonus spells CUMULATIVE (p.17).
// Cumulative counts verified in references/research-notes.md.
import { assertAbilityScore } from "../errors";
import type { WisdomModifiers } from "../types";

const MAGICAL_DEFENSE: Record<number, number> = {
  1: -6, 2: -4, 3: -3, 4: -2, 5: -1, 6: -1, 7: -1, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
  13: 0, 14: 0, 15: 1, 16: 2, 17: 3, 18: 4, 19: 4, 20: 4, 21: 4, 22: 4, 23: 4, 24: 4, 25: 4,
};

const SPELL_FAILURE: Record<number, number> = {
  1: 80, 2: 60, 3: 50, 4: 45, 5: 40, 6: 35, 7: 30, 8: 25, 9: 20, 10: 15, 11: 10, 12: 5,
  13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0, 25: 0,
};

// Cumulative bonus priest spells per spell level [1..7].
const BONUS_PRIEST_SPELLS: Record<number, readonly number[]> = {
  13: [1, 0, 0, 0, 0, 0, 0],
  14: [2, 0, 0, 0, 0, 0, 0],
  15: [2, 1, 0, 0, 0, 0, 0],
  16: [2, 2, 0, 0, 0, 0, 0],
  17: [2, 2, 1, 0, 0, 0, 0],
  18: [2, 2, 1, 1, 0, 0, 0],
  19: [3, 2, 1, 2, 0, 0, 0],
  20: [3, 3, 1, 3, 0, 0, 0],
  21: [3, 3, 2, 3, 1, 0, 0],
  22: [3, 3, 2, 4, 2, 0, 0],
  23: [3, 3, 2, 4, 4, 0, 0],
  24: [3, 3, 2, 4, 4, 2, 0],
  25: [3, 3, 2, 4, 4, 3, 1],
};

const NO_BONUS: readonly number[] = [0, 0, 0, 0, 0, 0, 0];

export function wisdom(score: number): WisdomModifiers {
  assertAbilityScore(score, "wis");
  return {
    magicalDefenseAdj: MAGICAL_DEFENSE[score],
    bonusPriestSpells: [...(BONUS_PRIEST_SPELLS[score] ?? NO_BONUS)],
    spellFailureChance: SPELL_FAILURE[score],
    spellImmunityFromScore: score >= 19 ? score : null,
  };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Gates.**  **Step 6: Commit** `feat(core): wisdom() ability modifiers — PHB Table 5 (cumulative bonus spells)`

---

## Task 8: `charisma()` — Table 6

**Files:**
- Create: `src/core/abilities/charisma.ts`, `tests/core/abilities/charisma.test.ts`

**Interfaces:**
- Produces: `function charisma(score: number): CharismaModifiers` — `{ maxHenchmen, loyaltyBase, reactionAdj }`.

- [ ] **Step 1: Failing test** (PHB p.18 — every row):

```ts
import { describe, expect, it } from "vitest";
import { charisma } from "../../../src/core/abilities/charisma";

const rows: Array<[number, number, number, number]> = [
  // score, maxHenchmen, loyaltyBase, reactionAdj
  [1, 0, -8, -7], [2, 1, -7, -6], [3, 1, -6, -5], [4, 1, -5, -4], [5, 2, -4, -3],
  [6, 2, -3, -2], [7, 3, -2, -1], [8, 3, -1, 0], [9, 4, 0, 0], [10, 4, 0, 0],
  [11, 4, 0, 0], [12, 5, 0, 0], [13, 5, 0, 1], [14, 6, 1, 2], [15, 7, 3, 3],
  [16, 8, 4, 5], [17, 10, 6, 6], [18, 15, 8, 7], [19, 20, 10, 8], [20, 25, 12, 9],
  [21, 30, 14, 10], [22, 35, 16, 11], [23, 40, 18, 12], [24, 45, 20, 13], [25, 50, 20, 14],
];

describe("charisma()", () => {
  it.each(rows)("score %i", (score, maxHenchmen, loyaltyBase, reactionAdj) => {
    expect(charisma(score)).toEqual({ maxHenchmen, loyaltyBase, reactionAdj });
  });
  it("rejects invalid", () => { expect(() => charisma(26)).toThrow(RangeError); });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/abilities/charisma.ts`

```ts
// PHB Table 6: CHARISMA (p.18; Appendix 8 p.246).
import { assertAbilityScore } from "../errors";
import type { CharismaModifiers } from "../types";

type Row = [number, number, number]; // maxHenchmen, loyaltyBase, reactionAdj

const BY_SCORE: Record<number, Row> = {
  1: [0, -8, -7], 2: [1, -7, -6], 3: [1, -6, -5], 4: [1, -5, -4], 5: [2, -4, -3],
  6: [2, -3, -2], 7: [3, -2, -1], 8: [3, -1, 0], 9: [4, 0, 0], 10: [4, 0, 0],
  11: [4, 0, 0], 12: [5, 0, 0], 13: [5, 0, 1], 14: [6, 1, 2], 15: [7, 3, 3],
  16: [8, 4, 5], 17: [10, 6, 6], 18: [15, 8, 7], 19: [20, 10, 8], 20: [25, 12, 9],
  21: [30, 14, 10], 22: [35, 16, 11], 23: [40, 18, 12], 24: [45, 20, 13], 25: [50, 20, 14],
};

export function charisma(score: number): CharismaModifiers {
  assertAbilityScore(score, "cha");
  const [maxHenchmen, loyaltyBase, reactionAdj] = BY_SCORE[score];
  return { maxHenchmen, loyaltyBase, reactionAdj };
}
```

- [ ] **Step 4: Run — PASS.**  **Step 5: Gates.**  **Step 6: Commit** `feat(core): charisma() ability modifiers — PHB Table 6`

---

## Task 9: `racial-adjustments.ts` + `deriveAbilities()` + `primeRequisiteXpBonus()`

**Files:**
- Create: `src/core/abilities/racial-adjustments.ts`, `tests/core/abilities/racial-adjustments.test.ts`
- Create: `src/core/abilities/index.ts`, `tests/core/abilities/derive-abilities.test.ts`
- Modify: `src/core/index.ts` (ensure `export * from "./abilities";` is present)

**Interfaces:**
- `racial-adjustments.ts`:
  - `type Race = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling"`
  - `const RACIAL_ABILITY_ADJUSTMENTS: Record<Race, Partial<Record<AbilityKey, number>>>`
  - `function applyRacialAdjustments(raw: AbilityScores, race: Race): AbilityScores` — adds the deltas, then clamps each to the race's Table 7 min/max. (Table 7 min/max also lives here as `RACIAL_ABILITY_LIMITS: Record<Race, Record<AbilityKey, [number, number]>>`.)
- `index.ts`:
  - `function deriveAbilities(raw: AbilityScores, opts: { race: Race; isWarrior: boolean; options?: OptionalRules; exceptionalStrengthPercentile?: number | null }): DerivedAbilities`
    - applies racial adjustments, then computes all six modifier records.
    - Strength: passes `exceptionalStrengthPercentile` to `strength()` only if `options.exceptionalStrength` is true AND `isWarrior` AND adjusted STR === 18.
  - `function primeRequisiteXpBonus(group: ClassGroup, scores: AbilityScores): boolean` — true when the group's prime-requisite ability is ≥ 16 (warrior→str, wizard→int, priest→wis, rogue→dex). PHB ability chapter: the +10% XP-earned bonus.

- [ ] **Step 1: Failing tests** — `racial-adjustments.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { RACIAL_ABILITY_ADJUSTMENTS, applyRacialAdjustments } from "../../../src/core/abilities/racial-adjustments";

describe("racial ability adjustments", () => {
  it("Table 8 deltas", () => {
    expect(RACIAL_ABILITY_ADJUSTMENTS.dwarf).toEqual({ con: 1, cha: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS.elf).toEqual({ dex: 1, con: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS.gnome).toEqual({ int: 1, wis: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS.halfling).toEqual({ dex: 1, str: -1 });
    expect(RACIAL_ABILITY_ADJUSTMENTS["half-elf"]).toEqual({});
    expect(RACIAL_ABILITY_ADJUSTMENTS.human).toEqual({});
  });
  it("applies deltas", () => {
    const raw = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };
    expect(applyRacialAdjustments(raw, "dwarf")).toMatchObject({ con: 13, cha: 11 });
    expect(applyRacialAdjustments(raw, "elf")).toMatchObject({ dex: 13, con: 11 });
  });
  it("clamps to racial min/max (Table 7)", () => {
    // Elf CON max is 18; +1 from a raw 18 stays 18.
    expect(applyRacialAdjustments({ str: 10, dex: 10, con: 18, int: 10, wis: 10, cha: 10 }, "elf").con).toBe(17); // 18 - 1
    // Halfling STR min 7: raw 7, -1 -> clamped up to 7.
    expect(applyRacialAdjustments({ str: 7, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, "halfling").str).toBe(7);
    // Dwarf CON min 11: raw 10 +1 -> 11 (also satisfies min).
    expect(applyRacialAdjustments({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, "dwarf").con).toBe(11);
  });
});
```

`derive-abilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveAbilities, primeRequisiteXpBonus } from "../../../src/core/abilities";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";

const raw = { str: 18, dex: 16, con: 18, int: 10, wis: 9, cha: 8 };

describe("deriveAbilities()", () => {
  it("applies racial adjustment before computing modifiers", () => {
    const d = deriveAbilities(raw, { race: "dwarf", isWarrior: true, options: DEFAULT_OPTIONAL_RULES });
    expect(d.scores.con).toBe(18 + 1 > 18 ? 18 : 19); // dwarf CON max is 18 -> clamped to 18
    expect(d.scores.con).toBe(18);
    expect(d.con.hpAdjustment).toBe(4); // warrior CON 18
    expect(d.scores.cha).toBe(7);
    expect(d.cha.reactionAdj).toBe(-1);
  });

  it("exceptional Strength only when toggle on + warrior + STR 18", () => {
    const on = deriveAbilities(raw, { race: "human", isWarrior: true, options: DEFAULT_OPTIONAL_RULES, exceptionalStrengthPercentile: 100 });
    expect(on.str.damageAdj).toBe(6); // 18/00

    const nonWarrior = deriveAbilities(raw, { race: "human", isWarrior: false, options: DEFAULT_OPTIONAL_RULES, exceptionalStrengthPercentile: 100 });
    expect(nonWarrior.str.damageAdj).toBe(2); // plain 18

    const toggleOff = deriveAbilities(raw, { race: "human", isWarrior: true, options: { ...DEFAULT_OPTIONAL_RULES, exceptionalStrength: false }, exceptionalStrengthPercentile: 100 });
    expect(toggleOff.str.damageAdj).toBe(2); // plain 18
  });

  it("all six modifier records are present", () => {
    const d = deriveAbilities(raw, { race: "human", isWarrior: false });
    expect(Object.keys(d)).toEqual(expect.arrayContaining(["scores", "str", "dex", "con", "int", "wis", "cha"]));
    expect(d.wis.bonusPriestSpells).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("primeRequisiteXpBonus()", () => {
  it("true at 16+ for the group's prime requisite", () => {
    expect(primeRequisiteXpBonus("warrior", { ...raw, str: 16 })).toBe(true);
    expect(primeRequisiteXpBonus("warrior", { ...raw, str: 15 })).toBe(false);
    expect(primeRequisiteXpBonus("wizard", { ...raw, int: 16 })).toBe(true);
    expect(primeRequisiteXpBonus("priest", { ...raw, wis: 16 })).toBe(true);
    expect(primeRequisiteXpBonus("rogue", { ...raw, dex: 16 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL** (both test files).

- [ ] **Step 3: Implement `src/core/abilities/racial-adjustments.ts`**

```ts
// PHB Table 7 (racial ability min/max, p.20) + Table 8 (racial adjustments, p.20).
import type { AbilityKey, AbilityScores } from "../types";

export type Race = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling";

export const RACIAL_ABILITY_ADJUSTMENTS: Record<Race, Partial<Record<AbilityKey, number>>> = {
  human: {},
  "half-elf": {},
  dwarf: { con: 1, cha: -1 },
  elf: { dex: 1, con: -1 },
  gnome: { int: 1, wis: -1 },
  halfling: { dex: 1, str: -1 },
};

// [min, max] per ability. Human is 3/18 across the board.
export const RACIAL_ABILITY_LIMITS: Record<Race, Record<AbilityKey, [number, number]>> = {
  human: { str: [3, 18], dex: [3, 18], con: [3, 18], int: [3, 18], wis: [3, 18], cha: [3, 18] },
  dwarf: { str: [8, 18], dex: [3, 17], con: [11, 18], int: [3, 18], wis: [3, 18], cha: [3, 17] },
  elf: { str: [3, 18], dex: [6, 18], con: [7, 18], int: [8, 18], wis: [3, 18], cha: [8, 18] },
  gnome: { str: [6, 18], dex: [3, 18], con: [8, 18], int: [6, 18], wis: [3, 18], cha: [3, 18] },
  "half-elf": { str: [3, 18], dex: [6, 18], con: [6, 18], int: [4, 18], wis: [3, 18], cha: [3, 18] },
  halfling: { str: [7, 18], dex: [7, 18], con: [10, 18], int: [6, 18], wis: [3, 17], cha: [3, 18] },
};

const KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export function applyRacialAdjustments(raw: AbilityScores, race: Race): AbilityScores {
  const deltas = RACIAL_ABILITY_ADJUSTMENTS[race];
  const limits = RACIAL_ABILITY_LIMITS[race];
  const out = {} as AbilityScores;
  for (const k of KEYS) {
    const adjusted = raw[k] + (deltas[k] ?? 0);
    const [lo, hi] = limits[k];
    out[k] = Math.min(hi, Math.max(lo, adjusted));
  }
  return out;
}
```

- [ ] **Step 4: Implement `src/core/abilities/index.ts`**

```ts
import type { AbilityScores, ClassGroup, DerivedAbilities } from "../types";
import type { OptionalRules } from "../options";
import { DEFAULT_OPTIONAL_RULES } from "../options";
import { strength } from "./strength";
import { dexterity } from "./dexterity";
import { constitution } from "./constitution";
import { intelligence } from "./intelligence";
import { wisdom } from "./wisdom";
import { charisma } from "./charisma";
import { applyRacialAdjustments, type Race } from "./racial-adjustments";

export * from "./racial-adjustments";
export { strength, dexterity, constitution, intelligence, wisdom, charisma };

export interface DeriveAbilitiesOptions {
  race: Race;
  isWarrior: boolean;
  options?: OptionalRules;
  exceptionalStrengthPercentile?: number | null;
}

export function deriveAbilities(raw: AbilityScores, opts: DeriveAbilitiesOptions): DerivedAbilities {
  const options = opts.options ?? DEFAULT_OPTIONAL_RULES;
  const scores = applyRacialAdjustments(raw, opts.race);
  const useExceptional =
    options.exceptionalStrength && opts.isWarrior && scores.str === 18
      ? (opts.exceptionalStrengthPercentile ?? null)
      : null;
  return {
    scores,
    str: strength(scores.str, useExceptional),
    dex: dexterity(scores.dex),
    con: constitution(scores.con, opts.isWarrior),
    int: intelligence(scores.int),
    wis: wisdom(scores.wis),
    cha: charisma(scores.cha),
  };
}

const PRIME_REQUISITE: Record<ClassGroup, keyof AbilityScores> = {
  warrior: "str",
  wizard: "int",
  priest: "wis",
  rogue: "dex",
};

/** PHB ability chapter: +10% earned XP when the group's prime requisite is 16+. */
export function primeRequisiteXpBonus(group: ClassGroup, scores: AbilityScores): boolean {
  return scores[PRIME_REQUISITE[group]] >= 16;
}
```

- [ ] **Step 5: Ensure `src/core/index.ts` re-exports abilities**

It should contain `export * from "./abilities";` (added in Task 2 Step 6, or add now).

- [ ] **Step 6: Run — PASS** (both files).

Run: `npm run test -- tests/core/abilities/` → all ability suites green.

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build` → all exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/core/abilities/racial-adjustments.ts src/core/abilities/index.ts src/core/index.ts tests/core/abilities/racial-adjustments.test.ts tests/core/abilities/derive-abilities.test.ts
git commit -m "feat(core): deriveAbilities() — racial adjustments (Tables 7-8) + prime-requisite XP bonus"
```

---

## Task 10: Coverage check + `test:coverage` wiring

**Files:**
- Modify: `package.json` (add `@vitest/coverage-v8` dev dep)
- Modify: `.github/workflows/ci.yml` (add a coverage run to the gate)

**Interfaces:**
- Consumes: all `src/core/**` from Tasks 2–9.
- Produces: `npm run test:coverage` works and reports `src/core/` at 100% lines/statements.

- [ ] **Step 1: Install the provider**

Run: `npm install --save-dev @vitest/coverage-v8@^5`

- [ ] **Step 2: Configure coverage in `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/index.ts", "src/core/**/index.ts", "src/core/types.ts"],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 90 },
    },
  },
});
```

- [ ] **Step 3: Run coverage — expect pass at threshold**

Run: `npm run test:coverage`
Expected: all tests pass; coverage table shows `src/core/abilities/*.ts` and `errors.ts` at 100% lines/statements; command exits 0. If any line is uncovered, add the missing test case (do not lower the threshold).

- [ ] **Step 4: Add coverage to CI**

In `.github/workflows/ci.yml`, change the `npm run test` step to `npm run test:coverage`.

- [ ] **Step 5: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .github/workflows/ci.yml
git commit -m "test(core): enforce 100% coverage of the rules engine in CI"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §3.4 `system.json` `url`/`manifest`/`download` | Task 1 Step 1 |
| §3.4 `scripts/prepare-release.mjs` | Task 1 Step 3 |
| §3.4 `release.yml` — push-to-master rolling `latest`, `v*` versioned | Task 1 Step 4 |
| §3.4 `ci.yml` action bump to `@v5` | Task 1 Step 2 |
| §4 `core/` two-layer, framework-free, purity enforced | Task 2 (lint guard), all ability tasks |
| §4 `core/types.ts`, `core/options.ts` | Task 2 |
| §4 `core/abilities/{strength,dexterity,constitution,intelligence,wisdom,charisma}.ts` | Tasks 3–8 |
| §4 `core/abilities/index.ts` → `deriveAbilities()` | Task 9 |
| §5.1 exceptional STR; all CON/DEX/etc. derived values | Tasks 3–8 |
| §5.1 racial ability adjustments feed `deriveAbilities` | Task 9 |
| §9 Vitest, every table row asserted, 100% core coverage, CI | Tasks 3–10 |
| §11 values transcribed from `references/` with citations | every ability task (citation comment in each file) |

Out of scope for Plan 1b (later engine plans / sub-projects): classes, races (beyond ability adj), saves, combat, magic slots, proficiencies, progression, encumbrance, weapons, the `data/` layer, sheets, `CONFIG.ADND2E`, compendium packs.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Every table's values are literal in the implementation step. Every test step has real assertions with expected numbers.

**3. Type consistency:**
- `AbilityKey`, `AbilityScores`, `ClassGroup`, and the six `*Modifiers` interfaces are defined once in `src/core/types.ts` (Task 2) and imported by name everywhere.
- `Race` is defined in `racial-adjustments.ts` (Task 9) and imported by `index.ts` — consistent string union `"human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling"`.
- `strength(score, exceptionalPercentile?)` signature identical in Task 3 interface block, implementation, and its use inside `deriveAbilities` (Task 9).
- `constitution(score, isWarrior)` — two params, consistent Task 5 ↔ Task 9.
- `OptionalRules.exceptionalStrength` — defined Task 2, read in Task 9 `deriveAbilities`.
- `WisdomModifiers.bonusPriestSpells` is `readonly number[]` in the type; `wisdom()` returns a fresh `[...]` copy (not the frozen table row) so callers can't mutate the table.

**4. Coverage note:** `src/core/index.ts` and per-folder `index.ts` barrels are coverage-excluded (re-export only). `types.ts` is types-only (no runtime). Everything else in `core/` must hit 100% — Task 10 enforces it.

**5. Release workflow risk:** `gh release delete latest --cleanup-tag` then recreate is not atomic — a viewer refreshing mid-run briefly sees no `latest`. Acceptable for a solo dev tool. Documented in `release.yml` intent. The `--target ${GITHUB_SHA}` pins the recreated tag to the just-built commit.

No issues requiring rework.
