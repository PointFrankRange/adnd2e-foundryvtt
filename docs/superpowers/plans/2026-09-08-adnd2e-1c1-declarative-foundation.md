# AD&D 2E — Plan 1c.1: Declarative Foundry Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Foundry data-layer scaffold — `CONFIG.ADND2E`, the optional-rules settings registry, `system.json` document types, global type augmentation, and the localization tree — as pure builders behind thin init-hook glue, so Plans 1c.2–1c.4 have declared interfaces to build on.

**Architecture:** Two new *pure* modules (`src/config.ts`, `src/settings/registry.ts`) join the engine's "framework-free + 100% Vitest-covered" zone (added to `tsconfig.core.json` and the coverage gate). A ~10-line init-hook shim (`src/settings/index.ts` + edits to `src/system.ts`) is the only Foundry-touching code and is exercised in a linked dev world, not unit-tested. The placeholder example app is deleted.

**Tech Stack:** TypeScript 5 (strict), Vite 8 lib build, Vitest 5, ESLint 10 flat config, `fvtt-types` v13 line, Foundry VTT **system** (`system.json`).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §3.1 (`system.json`), §4 (two-layer architecture + layer contract), §6.1 (`CONFIG.ADND2E`), §6.2 (optional-rules registry). Design refinements approved in the 2026-09-08 brainstorming conversation (recorded in this plan's rulings).

## Global Constraints

- **`src/core/**` and the two new pure modules (`src/config.ts`, `src/settings/registry.ts`) import NOTHING from `foundry`, `fvtt-types`, `game`, `CONFIG`, `Hooks`, or the DOM.** Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `npm run typecheck` gate and by the ESLint `no-restricted-globals` / `no-restricted-imports` block.
- **`core/` never reads `game.settings`.** The `OptionalRules` bag is always passed in as a parameter (spec §4.1).
- **No rulebook prose / stat blocks / spell text / magic-item text anywhere in the repo.** Mechanical and factual values only (class names, ability labels, coin rates). English UI strings that paraphrase a rule's *name* (e.g. a setting hint) are fine; copied rule *text* is not.
- **Descending AC, THAC0, low-initiative-first** are the system's conventions but 1c.1 ships no combat logic.
- **Do NOT run `npm run format`** (it reflows the column-aligned lookup tables). Hand-format to satisfy the linter.
- **Do NOT run `npm install`.** If Vitest fails at import with a `config` / `describe` TypeError, run `rm -rf node_modules/.vite node_modules/.vitest node_modules/.cache` and retry.
- **The full gate is** `npm run typecheck && npm run lint && npm run test:coverage && npm run build` (mirrors `.github/workflows/ci.yml`). `src/core/**` + `src/config.ts` + `src/settings/registry.ts` must hold **100%** lines/statements/functions and **≥90%** branches.
- Commit message trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Foundry compatibility: `minimum: "13"`, `verified: "14"`.

## Rulings carried from brainstorming

- **R1 — CONFIG built complete now.** All 15 `CONFIG.ADND2E` entries from spec §6.1 are populated in this plan. The two Combat-&-Tactics-dependent entries (`weaponProficiencyGroups`) ship as an empty map with a "populated in Sub-project 7" comment — PHB core has no named weapon groups.
- **R2 — `OptionalRules` = `core.*` only.** All ~22 setting keys are registered as world settings; `getOptionalRules(): OptionalRules` returns only the eight `core`-group toggles. The `combatAndTactics.*` / `skillsAndPowers.*` / `spellsAndMagic.*` keys persist but are not in the typed bag until their sub-project.
- **R3 — pure core + thin adapter.** Logic lives in `buildAdnd2eConfig()` / `readOptionalRules(get)` / the `SETTING_DESCRIPTORS` data array — all pure, all covered. `registerSettings()` and `getOptionalRules()` are untested glue.
- **R4 — `encumbranceCategories` in CONFIG is labels only.** Spec §6.1 says "+ move multipliers"; the multipliers stay solely in `core/encumbrance/movement.ts` (single source of truth). CONFIG carries the six labels.
- **R5 — `SpellSchool` reuses `WizardSchool`.** `SpellSchool = WizardSchool | "lesser-divination" | "wild"` (10 members) — the nine 2E schools plus Wild. `WizardSchool` stays the eight *specialist* schools.
- **R6 — `packs` stays `[]`.** 1c.1 declares `documentTypes` and the `packFolders` tree; the compendium pack entries (spec §7) arrive in 1c.4.
- **R7 — flag / `game.system` typing is deferred.** `global.d.ts` augments `CONFIG.ADND2E` and `SettingConfig` (the 22 keys). Flag-config and `game.system` narrowing are added by the first plan that needs them (YAGNI).

---

## File Structure

**Created:**
- `src/config.ts` — pure. `buildAdnd2eConfig(): Adnd2eConfig` returns a frozen plain object of enum→i18n-label-key maps and coin rates. Exports `Adnd2eConfig` and the config-local unions (`CurrencyKey`, `WeaponStyleGroup`, `ConfigDamageType`, `CreatureIntelligenceBand`, `TreasureType`).
- `src/settings/registry.ts` — pure. `SETTING_DESCRIPTORS: readonly SettingDescriptor[]` (22 rows) + `readOptionalRules(get: (key: string) => unknown): OptionalRules`. Exports `SettingDescriptor`, `SettingGroup`.
- `src/settings/index.ts` — glue. `registerSettings()` (loops descriptors → `game.settings.register`), `getOptionalRules()` (wraps `readOptionalRules`).
- `src/constants.ts` — `SYSTEM_ID = "adnd2e"` (moved from `src/helpers/constants.ts`), `TEMPLATE_PATH(...)`.
- `tests/config/build-config.test.ts`, `tests/config/system-json.test.ts`
- `tests/settings/registry.test.ts`
- `tests/core/options.test.ts`
- `tests/lang/en-coverage.test.ts`
- `templates/.gitkeep`

**Modified:**
- `src/core/types.ts` — add `SpellSchool`, `CreatureSize`, `MovementMode`, `Alignment`.
- `src/core/options.ts` — expand `OptionalRules` + `DEFAULT_OPTIONAL_RULES` from 2 to 8 keys.
- `src/system.ts` — init hook: `CONFIG.ADND2E = buildAdnd2eConfig()` + `registerSettings()`.
- `src/types/global.d.ts` — augment `CONFIG.ADND2E`; replace the single `exampleSetting` `SettingConfig` entry with the 22 real keys.
- `system.json` — fill `documentTypes` (3 Actor / 9 Item / 1 ActiveEffect), add `packFolders`, keep `packs` absent.
- `lang/en.json` — replace `exampleApp` / `exampleSetting` with the full `ADND2E.*` tree.
- `tsconfig.core.json` — `include` gains only `src/config.ts` and `src/settings/registry.ts`; test dirs stay out (JSON/node type graphs).
- `vitest.config.ts` — `coverage.include` gains `src/config.ts`, `src/settings/registry.ts`.
- `eslint.config.js` — the "framework-free" `files` list and the "Foundry globals" `ignores` list gain the two pure modules and their test dirs.

**Deleted:**
- `src/apps/example-app.ts` (and the now-empty `src/apps/`)
- `src/helpers/constants.ts`, `src/helpers/settings.ts` (and the now-empty `src/helpers/`)
- `templates/example-app.hbs`

---

## Task 1: New engine type unions + `OptionalRules` expansion

**Files:**
- Modify: `src/core/types.ts` (append after the existing `WizardSchool` block, ~line 183)
- Modify: `src/core/options.ts` (whole file)
- Test: `tests/core/options.test.ts` (create)

**Interfaces:**
- Consumes: existing `WizardSchool` from `src/core/types.ts`.
- Produces:
  - `SpellSchool = WizardSchool | "lesser-divination" | "wild"` (type)
  - `CreatureSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan"` (type)
  - `MovementMode = "land" | "burrow" | "climb" | "fly" | "swim"` (type)
  - `Alignment = "lawful-good" | "neutral-good" | "chaotic-good" | "lawful-neutral" | "true-neutral" | "chaotic-neutral" | "lawful-evil" | "neutral-evil" | "chaotic-evil"` (type)
  - `interface OptionalRules` with 8 boolean fields (below)
  - `const DEFAULT_OPTIONAL_RULES: OptionalRules`

- [ ] **Step 1: Write the failing test** — `tests/core/options.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";
import type { OptionalRules } from "../../src/core/options";

describe("DEFAULT_OPTIONAL_RULES", () => {
  it("has exactly the eight core-rule toggles", () => {
    expect(Object.keys(DEFAULT_OPTIONAL_RULES).sort()).toEqual(
      [
        "exceptionalStrength",
        "maxSpellsPerLevel",
        "multiclassHpAveraging",
        "nonweaponProficienciesUsed",
        "spellFailureFromWisdom",
        "trainingRequiredToLevel",
        "weaponProficienciesUsed",
        "weaponSpeedInitiative",
      ].sort(),
    );
  });

  it("every value is a boolean and matches the documented default", () => {
    const expected: OptionalRules = {
      exceptionalStrength: true,
      maxSpellsPerLevel: false,
      weaponSpeedInitiative: false,
      spellFailureFromWisdom: true,
      trainingRequiredToLevel: false,
      nonweaponProficienciesUsed: true,
      weaponProficienciesUsed: true,
      multiclassHpAveraging: true,
    };
    expect(DEFAULT_OPTIONAL_RULES).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/options.test.ts`
Expected: FAIL — `DEFAULT_OPTIONAL_RULES` currently has only `exceptionalStrength` and `maxSpellsPerLevel`.

- [ ] **Step 3: Rewrite `src/core/options.ts`**

```ts
/**
 * The optional-rules toggle bag passed into every `core/` function whose result
 * a rule switch can change. `data/` builds this from `game.settings`
 * (`getOptionalRules()`); `core/` only ever receives it as a parameter.
 *
 * Only the `core`-group toggles live here. `combatAndTactics.*` /
 * `skillsAndPowers.*` / `spellsAndMagic.*` settings are registered but are not
 * part of this bag until their sub-project wires the branches (spec §6.2).
 */
export interface OptionalRules {
  /** PHB p.18: warriors roll d100 for exceptional Strength at STR 18. */
  exceptionalStrength: boolean;
  /** PHB p.17: cap on spells known per level from Intelligence (Table 4). */
  maxSpellsPerLevel: boolean;
  /** PHB p.79 / DMG: weapon speed factors modify initiative. Branch is Sub-project 3. */
  weaponSpeedInitiative: boolean;
  /** PHB Table 5: a priest's chance of spell failure from low Wisdom. */
  spellFailureFromWisdom: boolean;
  /** DMG optional: a character must train (time + money) before gaining a level. */
  trainingRequiredToLevel: boolean;
  /** PHB p.51: the non-weapon proficiency system is in use. */
  nonweaponProficienciesUsed: boolean;
  /** PHB p.51: the weapon proficiency system is in use. */
  weaponProficienciesUsed: boolean;
  /** PHB p.44: a multi-class character's hit points are the averaged roll. */
  multiclassHpAveraging: boolean;
}

export const DEFAULT_OPTIONAL_RULES: OptionalRules = {
  exceptionalStrength: true,
  maxSpellsPerLevel: false,
  weaponSpeedInitiative: false,
  spellFailureFromWisdom: true,
  trainingRequiredToLevel: false,
  nonweaponProficienciesUsed: true,
  weaponProficienciesUsed: true,
  multiclassHpAveraging: true,
};
```

- [ ] **Step 4: Append the new unions to `src/core/types.ts`** (after the `WizardSchool` type, before the `SpellSlots` doc comment)

```ts
/**
 * The nine schools of magic (PHB p.42) plus Wild (Tome of Magic). Distinct from
 * `WizardSchool`, which is only the eight *specialist* schools of Table 22:
 * `SpellSchool` adds Lesser Divination (no specialist) and Wild.
 */
export type SpellSchool = WizardSchool | "lesser-divination" | "wild";

/** Creature size categories (PHB p.101 / Monstrous Manual). */
export type CreatureSize =
  | "tiny"
  | "small"
  | "medium"
  | "large"
  | "huge"
  | "gargantuan";

/** Movement modes a creature can have (Monstrous Manual stat blocks). */
export type MovementMode = "land" | "burrow" | "climb" | "fly" | "swim";

/** The nine alignments (PHB p.49). */
export type Alignment =
  | "lawful-good"
  | "neutral-good"
  | "chaotic-good"
  | "lawful-neutral"
  | "true-neutral"
  | "chaotic-neutral"
  | "lawful-evil"
  | "neutral-evil"
  | "chaotic-evil";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/core/options.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage`
Expected: both `tsc` invocations exit 0; ESLint clean; coverage still 100% on `src/core/**` (the new type aliases are non-executable; `options.ts` object literal lines are executed on import by the new test). If `core/` coverage dips because an `OptionalRules` consumer now has an unreached branch: it will not — no `core/` code branches on the six new fields yet.

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/options.ts tests/core/options.test.ts
git commit -m "feat(core): add SpellSchool/CreatureSize/MovementMode/Alignment; expand OptionalRules to the 8 core toggles"
```

---

## Task 2: `src/config.ts` — `buildAdnd2eConfig()`

**Files:**
- Create: `src/config.ts`
- Create: `tests/config/build-config.test.ts`
- Modify: `tsconfig.core.json` (`include` array)
- Modify: `vitest.config.ts` (`coverage.include` array)
- Modify: `eslint.config.js` (two arrays — see Step 6)

**Interfaces:**
- Consumes: `AbilityKey`, `SaveCategory`, `ClassGroup`, `SphereName`, `EncumbranceCategory`, `SpellSchool`, `CreatureSize`, `MovementMode`, `Alignment` from `src/core/types.ts`.
- Produces:
  - `type CurrencyKey = "pp" | "gp" | "ep" | "sp" | "cp"`
  - `type WeaponStyleGroup = "single-weapon" | "two-weapon" | "weapon-and-shield" | "two-handed-weapon"`
  - `type ConfigDamageType = "slashing" | "piercing" | "bludgeoning" | "acid" | "cold" | "electricity" | "fire" | "force" | "poison" | "sonic" | "necrotic" | "radiant"`
  - `type CreatureIntelligenceBand = "non" | "animal" | "semi" | "low" | "average" | "very" | "high" | "exceptional" | "genius" | "supra-genius" | "godlike"`
  - `type TreasureType` — `"A" | "B" | … | "Z"`
  - `interface CurrencyDef { readonly label: string; readonly inCp: number }`
  - `interface Adnd2eConfig { … }` (15 readonly members — see Step 3)
  - `function buildAdnd2eConfig(): Adnd2eConfig` — returns a deep-frozen object.

- [ ] **Step 1: Write the failing test** — `tests/config/build-config.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildAdnd2eConfig } from "../../src/config";

const cfg = buildAdnd2eConfig();

/** Every value in a label map must be an `ADND2E.`-prefixed i18n key. */
function assertLabelMap(map: Readonly<Record<string, string>>): void {
  for (const v of Object.values(map)) expect(v).toMatch(/^ADND2E\./);
}

describe("buildAdnd2eConfig()", () => {
  it("has every documented top-level entry", () => {
    expect(Object.keys(cfg).sort()).toEqual(
      [
        "abilities", "alignments", "classGroups", "creatureIntelligence",
        "currency", "damageTypes", "encumbranceCategories", "movementModes",
        "saves", "schools", "sizes", "spheres", "treasureTypes",
        "weaponProficiencyGroups", "weaponStyleGroups",
      ].sort(),
    );
  });

  it("ability, save and class-group keysets match the engine unions", () => {
    expect(Object.keys(cfg.abilities).sort()).toEqual(["cha", "con", "dex", "int", "str", "wis"]);
    expect(Object.keys(cfg.saves).sort()).toEqual(["bw", "pp", "ppd", "rsw", "spell"]);
    expect(Object.keys(cfg.classGroups).sort()).toEqual(["priest", "rogue", "warrior", "wizard"]);
  });

  it("schools = the 8 specialist schools + lesser-divination + wild", () => {
    expect(Object.keys(cfg.schools).sort()).toEqual(
      [
        "abjuration", "alteration", "conjuration", "divination", "enchantment",
        "illusion", "invocation", "necromancy", "lesser-divination", "wild",
      ].sort(),
    );
  });

  it("spheres has all 16 priest spheres", () => {
    expect(Object.keys(cfg.spheres)).toHaveLength(16);
    expect(cfg.spheres).toHaveProperty("all");
    expect(cfg.spheres).toHaveProperty("necromantic");
  });

  it("encumbranceCategories includes immobile (6 total)", () => {
    expect(Object.keys(cfg.encumbranceCategories).sort()).toEqual(
      ["heavy", "immobile", "light", "moderate", "severe", "unencumbered"],
    );
  });

  it("alignments, sizes, movementModes", () => {
    expect(Object.keys(cfg.alignments)).toHaveLength(9);
    expect(Object.keys(cfg.sizes)).toEqual(
      ["tiny", "small", "medium", "large", "huge", "gargantuan"],
    );
    expect(Object.keys(cfg.movementModes)).toEqual(["land", "burrow", "climb", "fly", "swim"]);
  });

  it("currency carries copper-piece rates (PHB p.69)", () => {
    expect(cfg.currency.cp.inCp).toBe(1);
    expect(cfg.currency.sp.inCp).toBe(10);
    expect(cfg.currency.ep.inCp).toBe(50);
    expect(cfg.currency.gp.inCp).toBe(100);
    expect(cfg.currency.pp.inCp).toBe(500);
    for (const c of Object.values(cfg.currency)) expect(c.label).toMatch(/^ADND2E\./);
  });

  it("weaponProficiencyGroups is reserved (empty) for Combat & Tactics", () => {
    expect(cfg.weaponProficiencyGroups).toEqual({});
  });

  it("creatureIntelligence and treasureTypes are populated label maps", () => {
    expect(Object.keys(cfg.creatureIntelligence)).toHaveLength(11);
    expect(Object.keys(cfg.treasureTypes)).toHaveLength(26);
  });

  it("all remaining entries are ADND2E-prefixed label maps", () => {
    assertLabelMap(cfg.abilities);
    assertLabelMap(cfg.saves);
    assertLabelMap(cfg.classGroups);
    assertLabelMap(cfg.schools);
    assertLabelMap(cfg.spheres);
    assertLabelMap(cfg.alignments);
    assertLabelMap(cfg.sizes);
    assertLabelMap(cfg.damageTypes);
    assertLabelMap(cfg.movementModes);
    assertLabelMap(cfg.encumbranceCategories);
    assertLabelMap(cfg.creatureIntelligence);
    assertLabelMap(cfg.treasureTypes);
    assertLabelMap(cfg.weaponStyleGroups);
  });

  it("the returned object is frozen", () => {
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.abilities)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/build-config.test.ts`
Expected: FAIL — `Cannot find module '../../src/config'`.

- [ ] **Step 3: Create `src/config.ts`**

```ts
// Builds CONFIG.ADND2E (spec §6.1): enum -> i18n-label-key maps + coin rates.
// Pure and framework-free — assigned to `CONFIG.ADND2E` on `init` by system.ts,
// typed into the global scope by src/types/global.d.ts.
import type {
  AbilityKey,
  Alignment,
  ClassGroup,
  CreatureSize,
  EncumbranceCategory,
  MovementMode,
  SaveCategory,
  SpellSchool,
  SphereName,
} from "./core/types";

export type CurrencyKey = "pp" | "gp" | "ep" | "sp" | "cp";

export type WeaponStyleGroup =
  | "single-weapon"
  | "two-weapon"
  | "weapon-and-shield"
  | "two-handed-weapon";

/** Damage taxonomy for ActiveEffect tagging and resistances (broader than the weapon `DamageType`). */
export type ConfigDamageType =
  | "slashing"
  | "piercing"
  | "bludgeoning"
  | "acid"
  | "cold"
  | "electricity"
  | "fire"
  | "force"
  | "poison"
  | "sonic"
  | "necrotic"
  | "radiant";

/** Monstrous Manual intelligence descriptor bands (MM p.7). */
export type CreatureIntelligenceBand =
  | "non"
  | "animal"
  | "semi"
  | "low"
  | "average"
  | "very"
  | "high"
  | "exceptional"
  | "genius"
  | "supra-genius"
  | "godlike";

export type TreasureType =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

export interface CurrencyDef {
  readonly label: string;
  /** value of one coin of this denomination in copper pieces (PHB p.69) */
  readonly inCp: number;
}

type LabelMap<K extends string> = Readonly<Record<K, string>>;

export interface Adnd2eConfig {
  readonly abilities: LabelMap<AbilityKey>;
  readonly saves: LabelMap<SaveCategory>;
  readonly classGroups: LabelMap<ClassGroup>;
  readonly schools: LabelMap<SpellSchool>;
  readonly spheres: LabelMap<SphereName>;
  readonly alignments: LabelMap<Alignment>;
  readonly sizes: LabelMap<CreatureSize>;
  readonly movementModes: LabelMap<MovementMode>;
  readonly damageTypes: LabelMap<ConfigDamageType>;
  readonly encumbranceCategories: LabelMap<EncumbranceCategory>;
  readonly creatureIntelligence: LabelMap<CreatureIntelligenceBand>;
  readonly treasureTypes: LabelMap<TreasureType>;
  readonly weaponStyleGroups: LabelMap<WeaponStyleGroup>;
  /** Reserved for the Combat & Tactics weapon-group rules (Sub-project 7). PHB core has no named groups. */
  readonly weaponProficiencyGroups: Readonly<Record<string, string>>;
  readonly currency: Readonly<Record<CurrencyKey, CurrencyDef>>;
}

/**
 * Freeze `node` and every nested object. Written with no dead branches: the
 * config object contains only strings and plain objects — never `null` — so a
 * bare `typeof v === "object"` test suffices and both arms are exercised.
 */
function deepFreeze(node: Record<string, unknown>): void {
  Object.freeze(node);
  for (const v of Object.values(node)) {
    if (typeof v === "object") deepFreeze(v as Record<string, unknown>);
  }
}

export function buildAdnd2eConfig(): Adnd2eConfig {
  const cfg: Adnd2eConfig = {
    abilities: {
      str: "ADND2E.abilities.str",
      dex: "ADND2E.abilities.dex",
      con: "ADND2E.abilities.con",
      int: "ADND2E.abilities.int",
      wis: "ADND2E.abilities.wis",
      cha: "ADND2E.abilities.cha",
    },
    saves: {
      ppd: "ADND2E.saves.ppd",
      rsw: "ADND2E.saves.rsw",
      pp: "ADND2E.saves.pp",
      bw: "ADND2E.saves.bw",
      spell: "ADND2E.saves.spell",
    },
    classGroups: {
      warrior: "ADND2E.classGroups.warrior",
      wizard: "ADND2E.classGroups.wizard",
      priest: "ADND2E.classGroups.priest",
      rogue: "ADND2E.classGroups.rogue",
    },
    schools: {
      abjuration: "ADND2E.schools.abjuration",
      alteration: "ADND2E.schools.alteration",
      conjuration: "ADND2E.schools.conjuration",
      divination: "ADND2E.schools.divination",
      enchantment: "ADND2E.schools.enchantment",
      illusion: "ADND2E.schools.illusion",
      invocation: "ADND2E.schools.invocation",
      necromancy: "ADND2E.schools.necromancy",
      "lesser-divination": "ADND2E.schools.lesser-divination",
      wild: "ADND2E.schools.wild",
    },
    spheres: {
      all: "ADND2E.spheres.all",
      animal: "ADND2E.spheres.animal",
      astral: "ADND2E.spheres.astral",
      charm: "ADND2E.spheres.charm",
      combat: "ADND2E.spheres.combat",
      creation: "ADND2E.spheres.creation",
      divination: "ADND2E.spheres.divination",
      elemental: "ADND2E.spheres.elemental",
      guardian: "ADND2E.spheres.guardian",
      healing: "ADND2E.spheres.healing",
      necromantic: "ADND2E.spheres.necromantic",
      plant: "ADND2E.spheres.plant",
      protection: "ADND2E.spheres.protection",
      summoning: "ADND2E.spheres.summoning",
      sun: "ADND2E.spheres.sun",
      weather: "ADND2E.spheres.weather",
    },
    alignments: {
      "lawful-good": "ADND2E.alignments.lawful-good",
      "neutral-good": "ADND2E.alignments.neutral-good",
      "chaotic-good": "ADND2E.alignments.chaotic-good",
      "lawful-neutral": "ADND2E.alignments.lawful-neutral",
      "true-neutral": "ADND2E.alignments.true-neutral",
      "chaotic-neutral": "ADND2E.alignments.chaotic-neutral",
      "lawful-evil": "ADND2E.alignments.lawful-evil",
      "neutral-evil": "ADND2E.alignments.neutral-evil",
      "chaotic-evil": "ADND2E.alignments.chaotic-evil",
    },
    sizes: {
      tiny: "ADND2E.sizes.tiny",
      small: "ADND2E.sizes.small",
      medium: "ADND2E.sizes.medium",
      large: "ADND2E.sizes.large",
      huge: "ADND2E.sizes.huge",
      gargantuan: "ADND2E.sizes.gargantuan",
    },
    movementModes: {
      land: "ADND2E.movementModes.land",
      burrow: "ADND2E.movementModes.burrow",
      climb: "ADND2E.movementModes.climb",
      fly: "ADND2E.movementModes.fly",
      swim: "ADND2E.movementModes.swim",
    },
    damageTypes: {
      slashing: "ADND2E.damageTypes.slashing",
      piercing: "ADND2E.damageTypes.piercing",
      bludgeoning: "ADND2E.damageTypes.bludgeoning",
      acid: "ADND2E.damageTypes.acid",
      cold: "ADND2E.damageTypes.cold",
      electricity: "ADND2E.damageTypes.electricity",
      fire: "ADND2E.damageTypes.fire",
      force: "ADND2E.damageTypes.force",
      poison: "ADND2E.damageTypes.poison",
      sonic: "ADND2E.damageTypes.sonic",
      necrotic: "ADND2E.damageTypes.necrotic",
      radiant: "ADND2E.damageTypes.radiant",
    },
    encumbranceCategories: {
      unencumbered: "ADND2E.encumbranceCategories.unencumbered",
      light: "ADND2E.encumbranceCategories.light",
      moderate: "ADND2E.encumbranceCategories.moderate",
      heavy: "ADND2E.encumbranceCategories.heavy",
      severe: "ADND2E.encumbranceCategories.severe",
      immobile: "ADND2E.encumbranceCategories.immobile",
    },
    creatureIntelligence: {
      non: "ADND2E.creatureIntelligence.non",
      animal: "ADND2E.creatureIntelligence.animal",
      semi: "ADND2E.creatureIntelligence.semi",
      low: "ADND2E.creatureIntelligence.low",
      average: "ADND2E.creatureIntelligence.average",
      very: "ADND2E.creatureIntelligence.very",
      high: "ADND2E.creatureIntelligence.high",
      exceptional: "ADND2E.creatureIntelligence.exceptional",
      genius: "ADND2E.creatureIntelligence.genius",
      "supra-genius": "ADND2E.creatureIntelligence.supra-genius",
      godlike: "ADND2E.creatureIntelligence.godlike",
    },
    treasureTypes: Object.fromEntries(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => [l, `ADND2E.treasureTypes.${l}`]),
    ) as LabelMap<TreasureType>,
    weaponStyleGroups: {
      "single-weapon": "ADND2E.weaponStyleGroups.single-weapon",
      "two-weapon": "ADND2E.weaponStyleGroups.two-weapon",
      "weapon-and-shield": "ADND2E.weaponStyleGroups.weapon-and-shield",
      "two-handed-weapon": "ADND2E.weaponStyleGroups.two-handed-weapon",
    },
    weaponProficiencyGroups: {},
    currency: {
      pp: { label: "ADND2E.currency.pp", inCp: 500 },
      gp: { label: "ADND2E.currency.gp", inCp: 100 },
      ep: { label: "ADND2E.currency.ep", inCp: 50 },
      sp: { label: "ADND2E.currency.sp", inCp: 10 },
      cp: { label: "ADND2E.currency.cp", inCp: 1 },
    },
  };
  deepFreeze(cfg as unknown as Record<string, unknown>);
  return cfg;
}
```

- [ ] **Step 4: Add `src/config.ts` to the Foundry-free typecheck** — `tsconfig.core.json`

Change the `include` array to add **only the shipped pure module** (not the test dirs — the base `tsconfig.json` already typechecks `tests/**`, and the ESLint pure-zone from Step 6 forbids Foundry globals there):

```jsonc
  "include": ["src/core", "tests/core", "src/config.ts"]
```

Task 3 adds `src/settings/registry.ts` to this same array. Leave `compilerOptions` (`types: []`, `lib: ["ESNext"]`) untouched.

- [ ] **Step 5: Add `src/config.ts` to the coverage gate** — `vitest.config.ts`

```ts
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/config.ts"],
      exclude: ["src/core/index.ts", "src/core/types.ts"],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 90 },
    },
```

- [ ] **Step 6: Extend the ESLint pure-zone** — `eslint.config.js`

In the block whose comment is `// Foundry globals — available everywhere EXCEPT the framework-free engine.`, change:
```js
    ignores: ["src/core/**", "tests/core/**"],
```
to:
```js
    ignores: ["src/core/**", "tests/core/**", "src/config.ts", "src/settings/registry.ts", "tests/config/**", "tests/settings/**", "tests/lang/**"],
```

In the block whose comment is `// The engine must stay pure — no Foundry globals under core/.`, change:
```js
    files: ["src/core/**/*.ts", "tests/core/**/*.ts"],
```
to:
```js
    files: ["src/core/**/*.ts", "tests/core/**/*.ts", "src/config.ts", "src/settings/registry.ts", "tests/config/**/*.ts", "tests/settings/**/*.ts", "tests/lang/**/*.ts"],
```

- [ ] **Step 7: Run the test + gate**

Run: `npx vitest run tests/config/build-config.test.ts` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green. `src/config.ts` at 100% coverage (every line of the single `return` executes; `deepFreeze` recurses over the object). `tsc -p tsconfig.core.json` proves `src/config.ts` pulls in no Foundry types.

- [ ] **Step 8: Commit**

```bash
git add src/config.ts tests/config/build-config.test.ts tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(config): buildAdnd2eConfig() — CONFIG.ADND2E entries per spec §6.1"
```

---

## Task 3: `src/settings/registry.ts` — descriptors + `readOptionalRules`

**Files:**
- Create: `src/settings/registry.ts`
- Create: `tests/settings/registry.test.ts`
- Modify: `tsconfig.core.json` (`include` — add `src/settings/registry.ts`, `tests/settings`)

**Interfaces:**
- Consumes: `OptionalRules`, `DEFAULT_OPTIONAL_RULES` from `src/core/options.ts`.
- Produces:
  - `type SettingGroup = "core" | "combatAndTactics" | "skillsAndPowers" | "spellsAndMagic"`
  - `interface SettingDescriptor { readonly key: string; readonly group: SettingGroup; readonly default: boolean; readonly config: boolean; readonly optionalRulesKey: keyof OptionalRules | null }`
  - `const SETTING_DESCRIPTORS: readonly SettingDescriptor[]` (22 rows; every `scope` is `"world"`, every `type` is boolean — both are constant, so they are not descriptor fields)
  - `function readOptionalRules(get: (key: string) => unknown): OptionalRules`

- [ ] **Step 1: Write the failing test** — `tests/settings/registry.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { SETTING_DESCRIPTORS, readOptionalRules } from "../../src/settings/registry";
import { DEFAULT_OPTIONAL_RULES } from "../../src/core/options";

describe("SETTING_DESCRIPTORS", () => {
  it("registers 22 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(22);
    const byGroup = SETTING_DESCRIPTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.group] = (acc[d.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(byGroup).toEqual({
      core: 8,
      combatAndTactics: 6,
      skillsAndPowers: 4,
      spellsAndMagic: 4,
    });
  });

  it("keys are unique", () => {
    const keys = SETTING_DESCRIPTORS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every default is a boolean", () => {
    for (const d of SETTING_DESCRIPTORS) expect(typeof d.default).toBe("boolean");
  });

  it("core settings bind 1:1 to OptionalRules fields; reserved groups bind to null", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(8);
    for (const d of bound) expect(d.group).toBe("core");

    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());

    for (const d of SETTING_DESCRIPTORS.filter((x) => x.group !== "core")) {
      expect(d.optionalRulesKey).toBeNull();
    }
  });

  it("a bound descriptor's default matches the OptionalRules default", () => {
    for (const d of SETTING_DESCRIPTORS) {
      if (d.optionalRulesKey === null) continue;
      expect(d.default).toBe(DEFAULT_OPTIONAL_RULES[d.optionalRulesKey]);
    }
  });
});

describe("readOptionalRules()", () => {
  it("returns the defaults when the store is empty", () => {
    expect(readOptionalRules(() => undefined)).toEqual(DEFAULT_OPTIONAL_RULES);
  });

  it("reads a stored boolean through", () => {
    const bag = readOptionalRules((key) => (key === "exceptionalStrength" ? false : undefined));
    expect(bag.exceptionalStrength).toBe(false);
    expect(bag.maxSpellsPerLevel).toBe(false); // untouched default
  });

  it("falls back to the default when the stored value is not a boolean", () => {
    const bag = readOptionalRules(() => "true" as unknown);
    expect(bag).toEqual(DEFAULT_OPTIONAL_RULES);
  });

  it("ignores reserved-group keys — they never appear in the bag", () => {
    const bag = readOptionalRules((key) => (key === "criticalHits" ? true : undefined));
    expect(bag).not.toHaveProperty("criticalHits");
    expect(bag).toEqual(DEFAULT_OPTIONAL_RULES);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settings/registry.test.ts`
Expected: FAIL — `Cannot find module '../../src/settings/registry'`.

- [ ] **Step 3: Create `src/settings/registry.ts`**

```ts
// The optional-rules settings registry (spec §6.2). Pure data + a pure reader:
// `src/settings/index.ts` turns SETTING_DESCRIPTORS into game.settings.register
// calls, and wraps readOptionalRules() as getOptionalRules().
import type { OptionalRules } from "../core/options";
import { DEFAULT_OPTIONAL_RULES } from "../core/options";

export type SettingGroup = "core" | "combatAndTactics" | "skillsAndPowers" | "spellsAndMagic";

export interface SettingDescriptor {
  /** unique, dot-free key; the Foundry setting name and the i18n leaf (`ADND2E.settings.<key>.{name,hint}`) */
  readonly key: string;
  readonly group: SettingGroup;
  readonly default: boolean;
  /** shown in Foundry's Configure Settings UI */
  readonly config: boolean;
  /** the `OptionalRules` field this key populates (core group only); `null` for a reserved key */
  readonly optionalRulesKey: keyof OptionalRules | null;
}

/** Every setting is `scope: "world"`, `type: Boolean` — constants, not per-row fields. */
export const SETTING_DESCRIPTORS: readonly SettingDescriptor[] = [
  // --- core: wired into OptionalRules ---
  { key: "exceptionalStrength", group: "core", default: true, config: true, optionalRulesKey: "exceptionalStrength" },
  { key: "maxSpellsPerLevel", group: "core", default: false, config: true, optionalRulesKey: "maxSpellsPerLevel" },
  { key: "weaponSpeedInitiative", group: "core", default: false, config: true, optionalRulesKey: "weaponSpeedInitiative" },
  { key: "spellFailureFromWisdom", group: "core", default: true, config: true, optionalRulesKey: "spellFailureFromWisdom" },
  { key: "trainingRequiredToLevel", group: "core", default: false, config: true, optionalRulesKey: "trainingRequiredToLevel" },
  { key: "nonweaponProficienciesUsed", group: "core", default: true, config: true, optionalRulesKey: "nonweaponProficienciesUsed" },
  { key: "weaponProficienciesUsed", group: "core", default: true, config: true, optionalRulesKey: "weaponProficienciesUsed" },
  { key: "multiclassHpAveraging", group: "core", default: true, config: true, optionalRulesKey: "multiclassHpAveraging" },
  // --- combatAndTactics: reserved for Sub-project 7 ---
  { key: "combatAndTacticsEnabled", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "criticalHits", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "calledShots", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "combatManeuvers", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "armorTypeVsWeaponType", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "weaponMastery", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  // --- skillsAndPowers: reserved for Sub-project 8 ---
  { key: "skillsAndPowersEnabled", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  { key: "subAbilityScores", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  { key: "characterPointBuild", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  { key: "expandedProficiencies", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  // --- spellsAndMagic: reserved for Sub-project 9 ---
  { key: "spellsAndMagicEnabled", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "spellPoints", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "expandedCastingTime", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
];

/**
 * Build the typed `OptionalRules` bag from a raw getter (setting key -> stored
 * value, or `undefined` when unset). A stored value that is not a boolean falls
 * back to the descriptor default, so a corrupt or half-migrated world is safe.
 */
export function readOptionalRules(get: (key: string) => unknown): OptionalRules {
  const bag: OptionalRules = { ...DEFAULT_OPTIONAL_RULES };
  for (const d of SETTING_DESCRIPTORS) {
    if (d.optionalRulesKey === null) continue;
    const raw = get(d.key);
    bag[d.optionalRulesKey] = typeof raw === "boolean" ? raw : d.default;
  }
  return bag;
}
```

- [ ] **Step 4: Extend `tsconfig.core.json`** — add the second shipped pure module

```jsonc
  "include": ["src/core", "tests/core", "src/config.ts", "src/settings/registry.ts"]
```

- [ ] **Step 5: Extend the coverage gate** — `vitest.config.ts`

```ts
      include: ["src/core/**/*.ts", "src/config.ts", "src/settings/registry.ts"],
```

- [ ] **Step 6: Run the test + gate**

Run: `npx vitest run tests/settings/registry.test.ts` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green; `src/settings/registry.ts` 100% (the `continue` branch and both sides of the `typeof raw === "boolean"` ternary are hit by the four `readOptionalRules` cases).

- [ ] **Step 7: Commit**

```bash
git add src/settings/registry.ts tests/settings/registry.test.ts tsconfig.core.json vitest.config.ts
git commit -m "feat(settings): pure optional-rules registry — SETTING_DESCRIPTORS + readOptionalRules()"
```

---

## Task 4: `system.json` — document types + pack folders

**Files:**
- Modify: `system.json`
- Create: `tests/config/system-json.test.ts`

**Interfaces:**
- Produces: the `documentTypes` key sets that 1c.2 (Item DataModels) and 1c.3 (Actor DataModels) register against.

- [ ] **Step 1: Enable JSON imports for `tsc`** — `tsconfig.json`

Add `"resolveJsonModule": true` to `compilerOptions` (needed by this task's and Task 7's tests, which import `system.json` / `lang/en.json` directly). Vite already handles JSON; this is only for the typecheck pass. If `tsc` then reports the imported JSON "is not under 'rootDir'" or "not listed within the file list", also add `"system.json"` and `"lang/en.json"` to the base `tsconfig.json` `include` array. Do **not** add them to `tsconfig.core.json` — the JSON-reading tests are not in the Foundry-free zone.

- [ ] **Step 2: Write the failing test** — `tests/config/system-json.test.ts`

```ts
import { describe, expect, it } from "vitest";
import manifestJson from "../../system.json";

const manifest = manifestJson as unknown as {
  documentTypes: Record<string, Record<string, unknown>>;
  packFolders: { name: string; sorting: string; color?: string; packs?: string[]; folders?: unknown[] }[];
  packs?: unknown[];
};

describe("system.json documentTypes", () => {
  it("declares the three Actor subtypes", () => {
    expect(Object.keys(manifest.documentTypes.Actor).sort()).toEqual(
      ["character", "creature", "npc"],
    );
  });

  it("declares the nine Item subtypes (camelCase, no hyphens)", () => {
    expect(Object.keys(manifest.documentTypes.Item).sort()).toEqual(
      [
        "armor", "class", "classFeature", "equipment", "nonweaponProficiency",
        "race", "spell", "weapon", "weaponProficiency",
      ].sort(),
    );
    for (const k of Object.keys(manifest.documentTypes.Item)) {
      expect(k).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });

  it("declares the adnd2e ActiveEffect subtype", () => {
    expect(Object.keys(manifest.documentTypes.ActiveEffect)).toEqual(["adnd2e"]);
  });
});

describe("system.json packFolders", () => {
  it("is an array of well-formed folder nodes with no packs yet", () => {
    expect(Array.isArray(manifest.packFolders)).toBe(true);
    expect(manifest.packFolders.length).toBeGreaterThan(0);
    for (const f of manifest.packFolders) {
      expect(typeof f.name).toBe("string");
      expect(f.sorting).toMatch(/^[am]$/);
    }
  });

  it("ships no compendium packs in 1c.1", () => {
    expect(manifest.packs ?? []).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/config/system-json.test.ts`
Expected: FAIL — `documentTypes` is not yet a key of `system.json`.

- [ ] **Step 4: Edit `system.json`** — insert `documentTypes` after `"initiative"` and `packFolders` after it; do not add a `packs` key.

```jsonc
  "initiative": "1d10",

  "documentTypes": {
    "Actor": {
      "character": {},
      "npc": {},
      "creature": {}
    },
    "Item": {
      "class": {},
      "race": {},
      "weapon": {},
      "armor": {},
      "equipment": {},
      "spell": {},
      "weaponProficiency": {},
      "nonweaponProficiency": {},
      "classFeature": {}
    },
    "ActiveEffect": {
      "adnd2e": {}
    }
  },

  "packFolders": [
    {
      "name": "AD&D 2E — Rules Content",
      "sorting": "m",
      "color": "#5d0000",
      "folders": [
        { "name": "Classes & Races", "sorting": "a", "packs": [] },
        { "name": "Proficiencies", "sorting": "a", "packs": [] },
        { "name": "Equipment", "sorting": "a", "packs": [] },
        { "name": "Spells", "sorting": "a", "packs": [] }
      ],
      "packs": []
    }
  ],
```

- [ ] **Step 5: Run the test + gate**

Run: `npx vitest run tests/config/system-json.test.ts` → PASS
Run: `npm run typecheck && npm run test:coverage && npm run build`
Expected: green. `resolveJsonModule` lets the base `tsc` pass accept the `system.json` import; `npm run build` copies `system.json` to `dist/` unchanged.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json system.json tests/config/system-json.test.ts
git commit -m "feat(system): declare all documentTypes + packFolders scaffold"
```

---

## Task 5: Init-hook glue — `constants.ts`, `settings/index.ts`, `system.ts`; delete `helpers/`

**Files:**
- Create: `src/constants.ts`
- Create: `src/settings/index.ts`
- Modify: `src/system.ts`
- Delete: `src/helpers/constants.ts`, `src/helpers/settings.ts`

**Interfaces:**
- Consumes: `buildAdnd2eConfig` (Task 2), `SETTING_DESCRIPTORS` + `readOptionalRules` (Task 3).
- Produces: `SYSTEM_ID` (`src/constants.ts`), `registerSettings()` + `getOptionalRules(): OptionalRules` (`src/settings/index.ts`) — consumed by `data/` in 1c.2/1c.3.

- [ ] **Step 1: Create `src/constants.ts`**

```ts
export const SYSTEM_ID = "adnd2e";

/** Absolute path to a bundled Handlebars template, e.g. `TEMPLATE_PATH("actor", "character.hbs")`. */
export function TEMPLATE_PATH(...segments: string[]): string {
  return `systems/${SYSTEM_ID}/templates/${segments.join("/")}`;
}
```

- [ ] **Step 2: Create `src/settings/index.ts`**

```ts
// Thin Foundry glue over the pure registry. Not unit-tested (spec §9 — exercised
// in a linked dev world); all logic lives in ./registry.
import { SYSTEM_ID } from "../constants";
import type { OptionalRules } from "../core/options";
import { readOptionalRules, SETTING_DESCRIPTORS } from "./registry";

/** Register every optional-rules toggle as a world setting. Call once, on `init`. */
export function registerSettings(): void {
  for (const d of SETTING_DESCRIPTORS) {
    game.settings!.register(SYSTEM_ID, d.key, {
      name: `ADND2E.settings.${d.key}.name`,
      hint: `ADND2E.settings.${d.key}.hint`,
      scope: "world",
      config: d.config,
      type: Boolean,
      default: d.default,
    });
  }
}

/** The current optional-rules bag, read from `game.settings`. Pass into `core/`. */
export function getOptionalRules(): OptionalRules {
  return readOptionalRules((key) => game.settings!.get(SYSTEM_ID, key));
}
```

- [ ] **Step 3: Rewrite `src/system.ts`**

```ts
import "../styles/system.scss";
import { buildAdnd2eConfig } from "./config";
import { SYSTEM_ID } from "./constants";
import { registerSettings } from "./settings";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${SYSTEM_ID} | Ready`);
});
```

- [ ] **Step 4: Delete the old helpers**

```bash
git rm src/helpers/constants.ts src/helpers/settings.ts
```

(`src/helpers/` is now empty; git tracks no directories, so nothing else to do. If any file still imports `./helpers/...`, the typecheck in Step 5 catches it — only `src/system.ts` did, and Step 3 fixed it.)

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `tsc` (base config) resolves `CONFIG.ADND2E` via the augmentation from Task 6 — **if Task 6 is not yet done, this step fails with `Property 'ADND2E' does not exist on type 'CONFIG'`.** Reorder: do Task 6 before this step, or accept the known failure and let Task 6's gate be the joint checkpoint. The executor should run Task 6 immediately after Task 5's edits and treat the two as one review unit if needed.

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/settings/index.ts src/system.ts
git commit -m "feat(system): wire CONFIG.ADND2E + settings registry into init; drop helpers/"
```

---

## Task 6: Global type augmentation — `src/types/global.d.ts`

**Files:**
- Modify: `src/types/global.d.ts` (whole file)

**Interfaces:**
- Consumes: `Adnd2eConfig` (Task 2), the 22 keys from `SETTING_DESCRIPTORS` (Task 3).
- Produces: `CONFIG.ADND2E` typed globally; `game.settings.get("adnd2e", "<key>")` typed as `boolean` for each of the 22 keys.

- [ ] **Step 1: Rewrite `src/types/global.d.ts`**

```ts
import type { Adnd2eConfig } from "../config";

export {};

declare global {
  interface CONFIG {
    ADND2E: Adnd2eConfig;
  }

  interface SettingConfig {
    // core — wired into OptionalRules
    "adnd2e.exceptionalStrength": boolean;
    "adnd2e.maxSpellsPerLevel": boolean;
    "adnd2e.weaponSpeedInitiative": boolean;
    "adnd2e.spellFailureFromWisdom": boolean;
    "adnd2e.trainingRequiredToLevel": boolean;
    "adnd2e.nonweaponProficienciesUsed": boolean;
    "adnd2e.weaponProficienciesUsed": boolean;
    "adnd2e.multiclassHpAveraging": boolean;
    // combatAndTactics — reserved for Sub-project 7
    "adnd2e.combatAndTacticsEnabled": boolean;
    "adnd2e.criticalHits": boolean;
    "adnd2e.calledShots": boolean;
    "adnd2e.combatManeuvers": boolean;
    "adnd2e.armorTypeVsWeaponType": boolean;
    "adnd2e.weaponMastery": boolean;
    // skillsAndPowers — reserved for Sub-project 8
    "adnd2e.skillsAndPowersEnabled": boolean;
    "adnd2e.subAbilityScores": boolean;
    "adnd2e.characterPointBuild": boolean;
    "adnd2e.expandedProficiencies": boolean;
    // spellsAndMagic — reserved for Sub-project 9
    "adnd2e.spellsAndMagicEnabled": boolean;
    "adnd2e.spellPoints": boolean;
    "adnd2e.expandedCastingTime": boolean;
    "adnd2e.channelers": boolean;
  }
}
```

- [ ] **Step 2: Verify the augmentation compiles and is used**

Run: `npm run typecheck`
Expected: base `tsc` exits 0 — `src/system.ts`'s `CONFIG.ADND2E = buildAdnd2eConfig()` now type-checks, and `game.settings.get(SYSTEM_ID, d.key)` in `src/settings/index.ts` is `boolean`.

If `interface CONFIG` is not the shape `fvtt-types` exposes for global `CONFIG` augmentation (the v13 beta line has moved this around), the implementer adjusts to the form `fvtt-types` documents — e.g.:
```ts
declare module "fvtt-types/configuration" {
  interface CONFIG { ADND2E: Adnd2eConfig; }
}
```
The **acceptance criterion is behavioural**: `CONFIG.ADND2E` is typed as `Adnd2eConfig` at every use site and `npm run typecheck` is clean. Try `interface CONFIG` first; fall back to the `fvtt-types/configuration` module augmentation if the direct global interface merge does not take.

- [ ] **Step 3: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green (this is the joint checkpoint for Tasks 5 + 6).

- [ ] **Step 4: Commit**

```bash
git add src/types/global.d.ts
git commit -m "feat(types): augment CONFIG.ADND2E and the 22 setting keys"
```

---

## Task 7: Example-app teardown + localization tree

**Files:**
- Delete: `src/apps/example-app.ts`, `templates/example-app.hbs`
- Create: `templates/.gitkeep`
- Modify: `lang/en.json` (whole file)
- Create: `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `buildAdnd2eConfig()` label keys (Task 2), `SETTING_DESCRIPTORS` keys (Task 3).
- Produces: the `ADND2E.*` i18n tree every sheet and setting reads.

- [ ] **Step 1: Write the failing test** — `tests/lang/en-coverage.test.ts`

```ts
import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { buildAdnd2eConfig } from "../../src/config";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";

const en = enJson as unknown as Record<string, unknown>;

/** Resolve a dotted i18n key against the nested lang object. */
function resolve(key: string): unknown {
  return key.split(".").reduce<unknown>((node, seg) => {
    if (node && typeof node === "object" && seg in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[seg];
    }
    return undefined;
  }, en);
}

/** Every string value reachable from buildAdnd2eConfig() that looks like an i18n key. */
function configLabelKeys(): string[] {
  const cfg = buildAdnd2eConfig() as unknown as Record<string, Record<string, unknown>>;
  const keys: string[] = [];
  for (const entry of Object.values(cfg)) {
    for (const v of Object.values(entry)) {
      if (typeof v === "string" && v.startsWith("ADND2E.")) keys.push(v);
      else if (v && typeof v === "object" && "label" in v) keys.push((v as { label: string }).label);
    }
  }
  return keys;
}

describe("lang/en.json coverage", () => {
  it("resolves every CONFIG.ADND2E label key to a string", () => {
    for (const key of configLabelKeys()) {
      expect(typeof resolve(key), key).toBe("string");
    }
  });

  it("resolves name + hint for every registered setting", () => {
    for (const d of SETTING_DESCRIPTORS) {
      expect(typeof resolve(`ADND2E.settings.${d.key}.name`), d.key).toBe("string");
      expect(typeof resolve(`ADND2E.settings.${d.key}.hint`), d.key).toBe("string");
    }
  });

  it("no longer references the deleted example app", () => {
    expect(JSON.stringify(en)).not.toContain("exampleApp");
    expect(JSON.stringify(en)).not.toContain("exampleSetting");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lang/en-coverage.test.ts`
Expected: FAIL — the config label keys are not in `lang/en.json` yet.

- [ ] **Step 3: Delete the example app**

```bash
git rm src/apps/example-app.ts templates/example-app.hbs
```

Create `templates/.gitkeep` (empty file) so the `templates/` directory — still a `viteStaticCopy` target and a `hotReload` path — survives in git until 1c.4 adds real templates.

Verify nothing imports the deleted module:
Run: `grep -rn "example-app\|ExampleApplication" src/` → no matches (it was never wired into `system.ts`).

- [ ] **Step 4: Rewrite `lang/en.json`**

```json
{
  "ADND2E": {
    "system": {
      "title": "Advanced Dungeons & Dragons 2nd Edition"
    },
    "abilities": {
      "str": "Strength",
      "dex": "Dexterity",
      "con": "Constitution",
      "int": "Intelligence",
      "wis": "Wisdom",
      "cha": "Charisma"
    },
    "saves": {
      "ppd": "Paralyzation, Poison & Death Magic",
      "rsw": "Rod, Staff & Wand",
      "pp": "Petrification & Polymorph",
      "bw": "Breath Weapon",
      "spell": "Spell"
    },
    "classGroups": {
      "warrior": "Warrior",
      "wizard": "Wizard",
      "priest": "Priest",
      "rogue": "Rogue"
    },
    "schools": {
      "abjuration": "Abjuration",
      "alteration": "Alteration",
      "conjuration": "Conjuration / Summoning",
      "divination": "Divination (Greater)",
      "enchantment": "Enchantment / Charm",
      "illusion": "Illusion / Phantasm",
      "invocation": "Invocation / Evocation",
      "necromancy": "Necromancy",
      "lesser-divination": "Divination (Lesser)",
      "wild": "Wild Magic"
    },
    "spheres": {
      "all": "All",
      "animal": "Animal",
      "astral": "Astral",
      "charm": "Charm",
      "combat": "Combat",
      "creation": "Creation",
      "divination": "Divination",
      "elemental": "Elemental",
      "guardian": "Guardian",
      "healing": "Healing",
      "necromantic": "Necromantic",
      "plant": "Plant",
      "protection": "Protection",
      "summoning": "Summoning",
      "sun": "Sun",
      "weather": "Weather"
    },
    "alignments": {
      "lawful-good": "Lawful Good",
      "neutral-good": "Neutral Good",
      "chaotic-good": "Chaotic Good",
      "lawful-neutral": "Lawful Neutral",
      "true-neutral": "True Neutral",
      "chaotic-neutral": "Chaotic Neutral",
      "lawful-evil": "Lawful Evil",
      "neutral-evil": "Neutral Evil",
      "chaotic-evil": "Chaotic Evil"
    },
    "sizes": {
      "tiny": "Tiny",
      "small": "Small",
      "medium": "Medium",
      "large": "Large",
      "huge": "Huge",
      "gargantuan": "Gargantuan"
    },
    "movementModes": {
      "land": "Land",
      "burrow": "Burrow",
      "climb": "Climb",
      "fly": "Fly",
      "swim": "Swim"
    },
    "damageTypes": {
      "slashing": "Slashing",
      "piercing": "Piercing",
      "bludgeoning": "Bludgeoning",
      "acid": "Acid",
      "cold": "Cold",
      "electricity": "Electricity",
      "fire": "Fire",
      "force": "Force",
      "poison": "Poison",
      "sonic": "Sonic",
      "necrotic": "Necrotic",
      "radiant": "Radiant"
    },
    "encumbranceCategories": {
      "unencumbered": "Unencumbered",
      "light": "Light",
      "moderate": "Moderate",
      "heavy": "Heavy",
      "severe": "Severe",
      "immobile": "Immobile"
    },
    "creatureIntelligence": {
      "non": "Non-Intelligent",
      "animal": "Animal",
      "semi": "Semi-Intelligent",
      "low": "Low",
      "average": "Average",
      "very": "Very Intelligent",
      "high": "Highly Intelligent",
      "exceptional": "Exceptionally Intelligent",
      "genius": "Genius",
      "supra-genius": "Supra-Genius",
      "godlike": "Godlike"
    },
    "treasureTypes": {
      "A": "A", "B": "B", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G",
      "H": "H", "I": "I", "J": "J", "K": "K", "L": "L", "M": "M", "N": "N",
      "O": "O", "P": "P", "Q": "Q", "R": "R", "S": "S", "T": "T", "U": "U",
      "V": "V", "W": "W", "X": "X", "Y": "Y", "Z": "Z"
    },
    "weaponStyleGroups": {
      "single-weapon": "Single-Weapon Style",
      "two-weapon": "Two-Weapon Style",
      "weapon-and-shield": "Weapon-and-Shield Style",
      "two-handed-weapon": "Two-Handed-Weapon Style"
    },
    "currency": {
      "pp": "Platinum",
      "gp": "Gold",
      "ep": "Electrum",
      "sp": "Silver",
      "cp": "Copper"
    },
    "settings": {
      "exceptionalStrength": {
        "name": "Exceptional Strength",
        "hint": "Warriors with Strength 18 roll d100 for an exceptional-Strength band (PHB p.18)."
      },
      "maxSpellsPerLevel": {
        "name": "Enforce Spells Known Per Level",
        "hint": "Cap a wizard's spells recorded per spell level by Intelligence (PHB Table 4)."
      },
      "weaponSpeedInitiative": {
        "name": "Weapon Speed Affects Initiative",
        "hint": "Add weapon speed factors and casting times to individual initiative. Requires Sub-project 3."
      },
      "spellFailureFromWisdom": {
        "name": "Priest Spell Failure",
        "hint": "Apply a priest's chance of spell failure from low Wisdom (PHB Table 5)."
      },
      "trainingRequiredToLevel": {
        "name": "Training Required To Advance",
        "hint": "A character must spend time and money training before gaining a level (DMG optional rule)."
      },
      "nonweaponProficienciesUsed": {
        "name": "Use Non-Weapon Proficiencies",
        "hint": "Enable the non-weapon proficiency system (PHB p.51)."
      },
      "weaponProficienciesUsed": {
        "name": "Use Weapon Proficiencies",
        "hint": "Enable the weapon proficiency system and non-proficiency penalties (PHB p.51)."
      },
      "multiclassHpAveraging": {
        "name": "Average Multi-Class Hit Points",
        "hint": "A multi-class character's hit points are the averaged roll across classes (PHB p.44)."
      },
      "combatAndTacticsEnabled": {
        "name": "Combat & Tactics: Enabled",
        "hint": "Master switch for the Combat & Tactics option group. Individual rules below have no effect until this is on. Requires Sub-project 7."
      },
      "criticalHits": {
        "name": "Combat & Tactics: Critical Hits",
        "hint": "Natural 20 confirms for extra damage (Combat & Tactics). Requires Sub-project 7."
      },
      "calledShots": {
        "name": "Combat & Tactics: Called Shots",
        "hint": "Target specific body locations at an attack penalty (Combat & Tactics). Requires Sub-project 7."
      },
      "combatManeuvers": {
        "name": "Combat & Tactics: Combat Maneuvers",
        "hint": "Disarm, trip, overbear, and similar maneuvers (Combat & Tactics). Requires Sub-project 7."
      },
      "armorTypeVsWeaponType": {
        "name": "Combat & Tactics: Armor vs. Weapon Type",
        "hint": "Weapon-type modifiers versus armor type (Combat & Tactics). Requires Sub-project 7."
      },
      "weaponMastery": {
        "name": "Combat & Tactics: Weapon Mastery",
        "hint": "Mastery and high-mastery weapon tiers beyond specialization (Combat & Tactics). Requires Sub-project 7."
      },
      "skillsAndPowersEnabled": {
        "name": "Skills & Powers: Enabled",
        "hint": "Master switch for the Skills & Powers option group. Requires Sub-project 8."
      },
      "subAbilityScores": {
        "name": "Skills & Powers: Sub-Ability Scores",
        "hint": "Split each ability into two sub-scores (Skills & Powers). Requires Sub-project 8."
      },
      "characterPointBuild": {
        "name": "Skills & Powers: Character Point Build",
        "hint": "Buy class and race features with character points (Skills & Powers). Requires Sub-project 8."
      },
      "expandedProficiencies": {
        "name": "Skills & Powers: Expanded Proficiencies",
        "hint": "The expanded proficiency list and rules (Skills & Powers). Requires Sub-project 8."
      },
      "spellsAndMagicEnabled": {
        "name": "Spells & Magic: Enabled",
        "hint": "Master switch for the Spells & Magic option group. Requires Sub-project 9."
      },
      "spellPoints": {
        "name": "Spells & Magic: Spell Points",
        "hint": "Cast from a spell-point pool instead of fixed slots (Spells & Magic). Requires Sub-project 9."
      },
      "expandedCastingTime": {
        "name": "Spells & Magic: Expanded Casting Time",
        "hint": "The expanded casting-time and interruption rules (Spells & Magic). Requires Sub-project 9."
      },
      "channelers": {
        "name": "Spells & Magic: Channelers",
        "hint": "The channeler wizard variant (Spells & Magic). Requires Sub-project 9."
      }
    }
  }
}
```

- [ ] **Step 5: Run the test + gate**

Run: `npx vitest run tests/lang/en-coverage.test.ts` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green. `npm run build` copies `lang/` and `templates/` (now holding only `.gitkeep`) to `dist/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(i18n): full ADND2E localization tree; remove placeholder example app"
```

---

## Self-Review

**1. Spec coverage.**

| Spec section | Task |
|---|---|
| §3.1 `documentTypes` (3 Actor / 9 Item / 1 AE, camelCase) | Task 4 |
| §3.1 `packFolders` | Task 4 (tree; `packs` deferred to 1c.4 per R6) |
| §4 `src/config.ts`, `src/constants.ts`, `src/types/global.d.ts` layout | Tasks 2, 5, 6 |
| §4.1 layer contract — `core/` pure, bag passed in | Task 1 (`OptionalRules`), enforced by tsconfig.core + eslint (Tasks 2–3) |
| §6.1 all `CONFIG.ADND2E` entries | Task 2 (R1: `weaponProficiencyGroups` empty) |
| §6.1 `encumbranceCategories` "+ move multipliers" | Task 2 — labels only (R4); multipliers stay in `core/encumbrance/movement.ts` |
| §6.2 registry, 4 groups, all keys, `getOptionalRules()` | Tasks 3, 5 (R2: bag = `core.*` only) |
| §9 pure-core testing, no Foundry mocks | Tasks 2–3 covered; Task 5 glue untested by design (R3) |

Gaps: none for 1c.1's declared scope. `data/`, `documents/`, `sheets/`, packs, migrations are 1c.2–1c.4.

**2. Placeholder scan.** No "TBD"/"handle edge cases"/"similar to Task N". Task 6 Step 2 gives a concrete fallback augmentation form rather than "adjust as needed" — the acceptance criterion is behavioural and stated. Every code step has a full code block.

**3. Type consistency.**
- `OptionalRules` — 8 field names identical across Task 1 (definition), Task 3 (`optionalRulesKey` values + test), Task 6 (`SettingConfig` keys), Task 7 (`settings.*` i18n keys). Cross-checked: `exceptionalStrength, maxSpellsPerLevel, weaponSpeedInitiative, spellFailureFromWisdom, trainingRequiredToLevel, nonweaponProficienciesUsed, weaponProficienciesUsed, multiclassHpAveraging`.
- The 22 setting keys — identical list in Task 3 (`SETTING_DESCRIPTORS`), Task 6 (`SettingConfig`), Task 7 (`lang` + test iterates `SETTING_DESCRIPTORS`). Task 7's test derives keys from `SETTING_DESCRIPTORS`, so drift fails the build.
- `Adnd2eConfig` — 15 members (13 label maps + `weaponProficiencyGroups` + `currency`); Task 2 test asserts the exact keyset; Task 7 test walks the built object.
- `SpellSchool = WizardSchool | "lesser-divination" | "wild"` — Task 1 defines, Task 2 `schools` map has exactly those 10 keys, Task 2 test + Task 7 lang assert 10.
- `buildAdnd2eConfig` / `readOptionalRules` / `SETTING_DESCRIPTORS` / `registerSettings` / `getOptionalRules` / `SYSTEM_ID` / `TEMPLATE_PATH` — names used identically in every consuming task.

**4. Execution-order note.** Task 5 and Task 6 form one typecheck checkpoint (`CONFIG.ADND2E` assignment needs the augmentation). Run them back-to-back; a reviewer may treat them as a pair. All other tasks pass their gate standalone. Task 2's `tsconfig.core.json` edit lists only `src/config.ts`/`tests/config`; Task 3 extends it — do not pre-list `src/settings/registry.ts` before it exists.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-adnd2e-1c1-declarative-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — tasks in this session with checkpoints.

**Which approach?**
