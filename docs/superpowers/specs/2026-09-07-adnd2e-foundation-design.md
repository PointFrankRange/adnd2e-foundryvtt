# AD&D 2E for Foundry VTT — Sub-project 1: Foundation & Data Architecture

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-07
**Author:** Joshua Frank + Claude

---

## 1. Context

The goal is a full Foundry VTT **game system** for Advanced Dungeons & Dragons
2nd Edition, with **heavy automation** (the system rolls attacks against target
AC, applies damage, tracks and decrements spell slots, enforces proficiency-slot
budgets, computes all derived values live) and eventual coverage of the three
*Player's Option* books (Combat & Tactics, Skills & Powers, Spells & Magic).

That full scope is far too large for one spec or one implementation pass. It is
decomposed into nine sub-projects, each with its own spec → plan → build cycle:

| # | Sub-project | Delivers |
|---|---|---|
| **1** | **Foundation & data architecture** | `system.json`, module→system tooling conversion, all Actor/Item types + DataModel schemas, ability-score sub-scores, the derived-data pipeline, the pure rules engine + its tests. *(This spec.)* |
| 2 | PC character sheet | ApplicationV2 sheet, tabs, editable fields, class/race as droppable items, multi-/dual-class handling, XP→level, HP rolling. |
| 3 | Core combat | THAC0 attack rolls vs. AC, damage, 5 saving-throw categories, initiative (individual + weapon speed + casting time), combat-tracker override. |
| 4 | Magic | Spell items, schools/spheres, wizard spellbook + priest sphere access, memorization slot tables, cast-from-chat with slot tracking. |
| 5 | Proficiencies & skills | Weapon proficiency slots + specialization, non-weapon proficiency checks. |
| 6 | NPC / monster sheet + bestiary scaffolding | Streamlined stat-block sheet, empty compendium packs, item templates for user-owned content. |
| 7 | Player's Option: Combat & Tactics | Maneuvers, critical-hit tables, called shots, expanded initiative. |
| 8 | Player's Option: Skills & Powers | Trait/sub-ability character-point buy, expanded proficiencies. |
| 9 | Player's Option: Spells & Magic | Spell points, expanded casting rules. |

Build order is roughly 1→6 (the playable core) then 7–9 (layered options).

### Starting point

The working directory currently holds a **module** skeleton (not a system):
TypeScript, Vite bundling (`src/module.ts` → `dist/module.js` + `dist/module.css`),
`fvtt-types` (tracks Foundry v13, works on v14), ApplicationV2 UI API, ESLint
(flat config) + Prettier, and `scripts/link-module.mjs` which creates a Windows
directory junction from `dist/` into the Foundry data folder. All of this tooling
carries over to a system almost unchanged; the manifest and the entire `src/`
payload are replaced.

### Prior art

Two AD&D 2E systems exist on GitHub (neither on Foundry's package listing):

- [`thelensrpg/dnd2e-foundry`](https://github.com/thelensrpg/dnd2e-foundry) —
  Unlicense (public domain), plain JavaScript, no DataModels, no TypeScript,
  calculation-focused but low automation, incomplete spell DB.
- [`keithhannen/FVTT_ADnD2E`](https://github.com/keithhannen/FVTT_ADnD2E) —
  template/starting-point only, plain JS + Gulp/SCSS, no DataModels.

Neither fits the goals (heavy automation, full 2E + Player's Option, modern
TS/Vite/DataModel stack). **Decision: build fresh.** `thelensrpg/dnd2e-foundry`
may be read for schema ideas only — not forked.

### Legal / content constraint

The PHB and DMG are copyrighted WotC material and 2E has no open licence. Game
*mechanics* (THAC0, saving-throw tables, XP progressions, the proficiency system,
ability-score modifier tables) are factual and not copyrightable — the system
implements them faithfully. Descriptive prose (spell effect text, monster stat
blocks, magic-item descriptions, table flavour text) is protected and is **not**
shipped in compendia. The books are a reference for getting mechanics right, not
a source of shipped content. The system ships mechanical/factual data (class and
race definitions with their progressions, proficiency names + governing ability,
spell name/level/school) plus an import path (JSON/CSV) for the user to bulk-load
content they have transcribed from books they own.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| First-version scope | Full 2E incl. Player's Option (decomposed; this spec = Foundation only) |
| Automation level | Heavy automation |
| Foundry target | `minimum: "13"`, `verified: "14"` |
| Shipped content | Mechanical/factual data OK, **no prose**; plus a JSON/CSV import path for user-owned content |
| Rules-math architecture | Pure framework-free TypeScript core + thin Foundry adapters, unit-tested with Vitest |
| Version control | git initialised; design doc committed |
| System id | `adnd2e` |
| System title | "Advanced Dungeons & Dragons 2nd Edition" |

---

## 3. Package identity & tooling conversion

### 3.1 `system.json` (replaces `module.json`)

Key fields beyond the current manifest:

```jsonc
{
  "id": "adnd2e",
  "title": "Advanced Dungeons & Dragons 2nd Edition",
  "description": "...",
  "version": "0.1.0",
  "compatibility": { "minimum": "13", "verified": "14" },
  "esmodules": ["system.js"],
  "styles": ["system.css"],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],

  "documentTypes": {
    "Actor": { "character": {}, "npc": {}, "creature": {} },
    "Item": {
      "class": {}, "race": {},
      "weapon": {}, "armor": {}, "equipment": {}, "spell": {},
      "weaponProficiency": {}, "nonweaponProficiency": {},
      "classFeature": {}
    },
    "ActiveEffect": { "adnd2e": {} }
  },

  "grid": { "distance": 5, "units": "ft" },
  "primaryTokenAttribute": "hp",
  "initiative": "1d10",

  "packs": [ /* see §7 */ ],
  "packFolders": [ /* organisation for the compendium sidebar */ ],

  "flags": {
    "adnd2e": {},
    "hotReload": { "extensions": ["css", "hbs", "json"], "paths": ["styles", "templates", "lang"] }
  }
}
```

Notes:

- `grid.distance` is 5 ft as a sane Foundry default; 2E's own movement is handled
  by the encumbrance/movement calc, not the grid.
- `initiative: "1d10"` sets the Combatant roll formula. 2E initiative is
  **low-goes-first** and Foundry sorts descending — the sort override and the
  weapon-speed / casting-time modifiers are **Sub-project 3**, not here. The
  formula string is all that belongs in the manifest now.
- `documentTypes` keys are the machine sub-type names used everywhere in code.
  `weaponProficiency` / `nonweaponProficiency` use camelCase (Foundry requires a
  valid identifier; no hyphens).

### 3.2 Build & dev tooling changes

| File | Change |
|---|---|
| `package.json` | `name` → `adnd2e`; add `vitest` (dev dep) and `"test": "vitest run"`, `"test:watch": "vitest"`; keep build/watch/lint/format/typecheck. |
| `vite.config.ts` | `lib.entry` → `src/system.ts`; `fileName` → `system.js`; `cssFileName` → `system`; static-copy `system.json` (not `module.json`), `lang/`, `templates/`, and `packs/` (built LevelDB — see §7). |
| `scripts/link-module.mjs` → `scripts/link-system.mjs` | junction target `Data/systems/<id>` instead of `Data/modules/<id>`; read `id` from `system.json`. `npm run link` unchanged. |
| `README.md` | rewrite for system context. |
| `foundryconfig.example.json` | unchanged (still points at the Foundry user-data dir). |
| new `vitest.config.ts` | test root `tests/`, node environment, no Foundry globals. |
| `tsconfig.json` | add `tests` to `include`; keep `types: ["fvtt-types"]` (core/ simply never references Foundry types). |
| CI (new, `.github/workflows/ci.yml`) | `npm ci && npm run typecheck && npm run lint && npm run test && npm run build`. |

### 3.3 fvtt-types

`fvtt-types` types the module case but the system APIs (`Actor`, `Item`,
`TypeDataModel`, `DataModel`, `foundry.data.fields.*`, `CONFIG`) are the same
surface. Keep it. The `core/` layer references none of it.

---

## 4. Code architecture — two layers

```
src/
  system.ts              entry point — hooks only (init, i18nInit, setup, ready)
  config.ts              builds CONFIG.ADND2E (see §6.1)
  constants.ts           SYSTEM_ID = "adnd2e", template paths, flag scopes

  core/                  FRAMEWORK-FREE rules engine.
                         Imports NOTHING from `foundry`, `game`, `CONFIG`, DOM.
                         Pure functions + lookup tables. 100% Vitest-covered.
    types.ts             shared engine types (AbilityScore, ClassProgression, …)
    options.ts           OptionalRules type — the toggle bag passed into core fns
    abilities/
      strength.ts        strength(score, exceptional?) -> StrengthMods
      dexterity.ts       reaction / missile-attack / defensive-AC adjustments
      constitution.ts    hp adjustment, system shock %, resurrection %, regen
      intelligence.ts    max spell level, learn-spell %, max spells/level, langs
      wisdom.ts          bonus priest spells, spell-failure %, magic defence adj
      charisma.ts        max henchmen, loyalty base, reaction adjustment
      index.ts           deriveAbilities(rawScores, racialAdj, options)
    classes/
      chassis.ts         ClassChassis type + helpers (group, prime reqs, XP bonus)
      thac0.ts           thac0(chassis, level) -> number
      progression.ts     levelForXp(chassis, xp), xpForLevel, hd(chassis, level)
    races/
      race.ts            RaceDefinition type, ability adj/min/max, level limits
    saves/
      tables.ts          per-class-group save matrices
      index.ts           saves(classLevels[], race, abilityMods, options)
    combat/
      armor-class.ts     ac({ armor, shield, dexDefensive, magic, situational })
      attack.ts          attackFormula(thac0, targetAc, mods) -> string  (NOT rolled)
      resolution.ts      hitResult(attackTotal, thac0, targetAc) -> {hit, byHowMuch}
    magic/
      wizard-slots.ts    slotsByLevel(wizardLevel, intMax, specialistBonus)
      priest-slots.ts    slotsByLevel(priestLevel, wisBonus, sphereAccess)
      spheres.ts         sphere access resolution
    proficiencies/
      weapon.ts          slot totals from progression; specialization effects
      nonweapon.ts       checkTarget(governingAbility, modifier, options)
    progression/
      multiclass.ts      resolveMulticlass(classes[]) -> effective levels, HP rule
      dualclass.ts       resolveDualClass(classes[]) -> active/suppressed abilities
    encumbrance/
      weight-allowance.ts allowance(strengthMods) -> {unencumbered, …, max}
      movement.ts        movementRate(baseMove, carried, allowance, armor, options)
    dice/
      formula.ts         string builders — e.g. `${base}${sign(mod)}${mod}`
    tables/              the raw numbers, as typed `const` (or JSON imported)
      ability-*.ts  class-*.ts  save-*.ts  wizard-slots.ts  priest-slots.ts
      encumbrance.ts  nonweapon-proficiencies.ts

  data/                  Foundry DataModels — thin adapters. Call into core/.
    common/
      fields.ts          reusable SchemaField fragments
      physical-item.ts   weight/qty/cost/location/identified
      modifier.ts        { source, target, value, type }
    actor/
      base-actor.ts      shared schema + prepare hooks
      character.ts
      npc.ts
      creature.ts
    item/
      base-item.ts
      class.ts  race.ts
      weapon.ts  armor.ts  equipment.ts  spell.ts
      weapon-proficiency.ts  nonweapon-proficiency.ts
      class-feature.ts
    active-effect/
      effect.ts          ActiveEffectTypeDataModel subclass

  documents/             Document subclasses — thin
    actor.ts  item.ts  active-effect.ts  combatant.ts

  sheets/                STUB registrations only in SP1 (raw field dump)
    actor-sheet.ts  item-sheet.ts

  helpers/
    settings.ts          optional-rules toggle registry (see §6.2)
    handlebars.ts        partial registration + helpers
    migrations.ts        migration framework (see §8)

  types/
    global.d.ts          module augmentation: game.system, CONFIG.ADND2E, flags

tests/                   mirrors src/core/ ; Vitest
packs/                   source JSON for compendium packs (see §7)
templates/
lang/en.json
docs/superpowers/specs/
```

### 4.1 The layer contract

- **`core/`** — no side effects, no globals, deterministic. Every function takes
  its inputs explicitly, including an `OptionalRules` object for anything a
  toggle affects. Returns plain data (numbers, records, formula **strings**).
  Never constructs a Foundry `Roll`, never reads `game.settings`.
- **`data/`** — DataModels define the schema (`static defineSchema()` using
  `foundry.data.fields`) and compute derived data by gathering the actor's
  current state + the active toggle bag (from `game.settings`) and delegating to
  `core/`. Results are cached onto `this` (e.g. `this.thac0.melee`).
- **`documents/`** — override points Foundry needs on the Document class
  (`prepareData` ordering, `getRollData`, embedded-document lifecycle). Kept thin.
- **`sheets/`** — SP1 shipping only a minimal sheet that renders the raw schema
  so data entry is possible for testing. Real sheets are SP2 / SP6.

---

## 5. Document types & schemas

Authored = entered by user / content import. Derived = computed each prepare
cycle by `core/` and cached on `system.*`.

### 5.1 Actor: `character`

**Authored**

- `abilities.<str|dex|con|int|wis|cha>`: `{ score: number, exceptional: number|null }`
  (`exceptional` only meaningful for `str` at score 18 with the
  `core.exceptionalStrength` toggle on)
- `details`: `{ alignment, deity, kit, homeland, age, sex, height, weight,
  hairEyes, campaignNotes (HTML), gmNotes (HTML) }`
- `attributes.hp`: `{ value: number, rolls: number[], temp: number, nonlethal: number }`
  (`max` is derived)
- `currency`: `{ pp, gp, ep, sp, cp }` (numbers; not an item — YAGNI)
- `resources`: reputation, henchmen count, followers (free text for SP1)
- `spellcasting.wizard`: `{ specialistSchool: string|null, opposedSchools: string[],
  spellbookItemIds: string[], memorized: MemorizedEntry[] }`
- `spellcasting.priest`: `{ sphereAccessOverride: string[]|null,
  memorized: MemorizedEntry[] }`
- `biography` (HTML)
- Reserved sub-objects (schema present, unused until SP7–9):
  `options.combatAndTactics`, `options.skillsAndPowers` (sub-ability scores),
  `options.spellsAndMagic`

Embedded Items provide: race (1× `race`), classes (1–3× `class`, each carrying
its own `xp` and `hpRolls`), proficiencies (`weaponProficiency` /
`nonweaponProficiency`), inventory (`weapon` / `armor` / `equipment`), spells
(`spell`), features (`classFeature`).

> **Class level & XP live on the embedded `class` item**, not the actor, so
> multiclass / dual-class is naturally represented as multiple class items.
> Schema for `class` item instance adds: `xp: number`, `hpRolls: number[]`,
> `dualClassState: "primary" | "suppressed" | "active" | null`.

**Derived (cached on `system`)**

- `abilities.<k>.mods`: full modifier record from `core/abilities` (e.g.
  `str.mods = { toHit, damage, weightAllowance, maxPress, openDoors, bendBars }`)
- `classes` summary: `effectiveLevels: Record<classId, number>`,
  `totalLevelLabel: string`, `primeRequisiteMet: Record<classId, boolean>`
- `attributes.hp.max`
- `attributes.thac0`: `{ melee, ranged, base }`
- `attributes.ac`: `{ normal, rearAttack, surprised, byArmorType?, shieldless }`
- `saves.<ppd|rsw|pp|bw|spell>`: `{ base, modified }`
- `attributes.movement`: `{ base, current, encumbranceCategory }`
- `attributes.encumbrance`: `{ carried, allowance: {…}, category, penalty }`
- `spellcasting.wizard.slots` / `.priest.slots`: `Record<1..9, { max, used }>`
- `proficiencies.weapon`: `{ slotsTotal, slotsSpent, slotsAvailable }`
- `proficiencies.nonweapon`: `{ slotsTotal, slotsSpent, slotsAvailable }`
- `languagesKnown.max`

### 5.2 Actor: `npc`

Same schema as `character` (shares `base-actor` + a mixin), plus:
`attributes.morale: number`, `details.xpValue: number` (derived from HD/level +
special abilities), `details.disposition`. The sheet (SP6) is condensed; the data
shape is intentionally identical so a built NPC can be promoted to a PC.

### 5.3 Actor: `creature` (monster)

**Authored**

- `hd`: `{ count: number, dieType: number (default 8), bonus: number,
  fixedHp: number|null }`
- `attributes.ac`: `{ value: number }` (explicit — monsters state AC directly)
- `attributes.thac0`: `{ value: number, asFighterLevel: number|null }`
  (if `asFighterLevel` set, THAC0 derives from the fighter table)
- `attacks`: `AttackEntry[]` — `{ name, count, damage: string, thac0Override?,
  type: "melee"|"ranged", special?: string }`
- `attributes.movement`: `{ land, burrow, climb, fly, swim, flyManeuverability }`
- `saves`: `{ mode: "explicit"|"asClass", explicit?: {ppd,rsw,pp,bw,spell},
  asClass?: {group, level} }`
- `details`: `{ size, alignment, intelligence, morale, magicResistance,
  treasureType, numberAppearing, xpValue (override|null),
  specialAttacks (HTML), specialDefenses (HTML), description (HTML) }`

**Derived**

- `attributes.hp.max` / `.value` (rolled from HD, or `fixedHp`)
- `attributes.thac0.value` when `asFighterLevel` set
- `saves.effective` when `mode === "asClass"`
- `details.xpValue` when override is null (HD-band base + special-ability adds)

### 5.4 Items

Common fragment `physical-item`: `{ quantity, weight, cost: {value, currency},
location: string, identified: boolean, equipped: boolean, magicBonus: number }`.

| Item type | Schema highlights |
|---|---|
| **class** | `group: "warrior"|"wizard"|"priest"|"rogue"`, `hitDie: number`, `hpAfterName: number` (flat HP/level past name level), `primeRequisites: string[]`, `xpBonusRule`, `thac0Table: TableRef`, `saveTable: TableRef`, `xpTable: number[]`, `weaponSlots: {initial, perLevels}`, `nonweaponSlots: {initial, perLevels}`, `weaponProfPenalty: number`, `armorAllowed`, `weaponsAllowed`, `spellProgression: TableRef|null`, `casterType: "wizard"|"priest"|null`, `abilities: EmbeddedFeatureRef[]`, `raceLevelLimits: Record<raceId, number|null>`, `multiclassWith: classId[]`. Instance-only (when embedded on an actor): `xp`, `hpRolls[]`, `dualClassState`. |
| **race** | `abilityAdjustments: Partial<Record<ability, number>>`, `abilityMinMax: Partial<Record<ability, {min,max}>>`, `classLevelLimits: Record<classId, number|null>`, `allowedClasses: classId[]`, `allowedMulticlass: classId[][]`, `infravision: number`, `size`, `baseMovement: number`, `saveBonusPerCon: boolean` (dwarf/gnome/halfling vs. poison/wands), `resistances`, `specialAbilities: EmbeddedFeatureRef[]`, `bonusLanguages: string[]`, `naturalThief: Record<skill, number>` (racial % adjustments). |
| **weapon** | `physical-item` + `weaponType: "melee"|"ranged"|"thrown"`, `damage: {vsSM: string, vsL: string}`, `speedFactor: number`, `rof: string`, `range: {short, medium, long}|null`, `size: "S"|"M"|"L"`, `proficiencyGroup: string`, `handsRequired: 1|2`, `materialToHit: number` (e.g. +1 to hit certain creatures), `specialization` (reserved: `{profSlotsInvested, isSpecialized, isMastery}`), `styleGroup`. |
| **armor** | `physical-item` + `baseAc: number`, `armorType: string` (for effect interactions), `movementPenalty: number`, `checkPenalty: number` (reserved for C&T), `isShield: boolean`, `shieldAcBonus: number`. |
| **equipment** | `physical-item` + `category: string`, `charges: {value, max}|null`, `consumable: boolean`, `container: boolean`, `capacity: number|null`. |
| **spell** | `casterClass: "wizard"|"priest"`, `level: 1..9`, `schools: string[]`, `spheres: string[]`, `range`, `components: {v,s,m}`, `materialComponent: string`, `duration`, `castingTime: string`, `areaOfEffect`, `savingThrow: "none"|"negates"|"half"|"special"`, `reversible: boolean`, `isReversedForm: boolean`, `automation: {damage: string|null, healing: string|null, effectRefs: string[], targetType}`, `description: HTML (empty by default)`. |
| **weaponProficiency** | `weaponOrGroup: string`, `isGroup: boolean`, `slotsInvested: number`, `specialized: boolean`, `styleSpecialization: string|null`, `masteryTier: number` (reserved C&T). |
| **nonweaponProficiency** | `governingAbility: ability`, `modifier: number`, `slotCost: number`, `group: string`, `checkPenalty: number`, `slotsInvested: number` (multi-slot for improvement), `isRacial: boolean`. |
| **classFeature** | `sourceType: "class"|"kit"|"race"|"other"`, `activation: "passive"|"action"|"daily"`, `uses: {value, max, per}|null`, `effectRefs: string[]`, `description: HTML`. |

**Deferred:** `container` as its own type (SP2 — `equipment.container` flag covers
SP1 needs), currency as an item (never — actor fields).

### 5.5 ActiveEffect

Subtype `adnd2e` extends `foundry.data.ActiveEffectTypeDataModel`. Carries
`{ conditionId: string|null, isCondition: boolean, suppressWhenUnequipped: boolean,
schoolTag: string|null }`. Used for magic-item bonuses, spell effects, and
conditions.

### 5.6 Derived-data ordering & the two-pass problem

Foundry's pipeline: `prepareData()` → `prepareBaseData()` →
`prepareEmbeddedDocuments()` → `applyActiveEffects()` → `prepareDerivedData()`.

- **`prepareBaseData`** — set raw scores, apply racial ability adjustments,
  compute values that ActiveEffects should be able to target (e.g. base ability
  scores, base movement).
- *(Foundry applies ActiveEffects here — an effect can bump `system.abilities.str.score`)*
- **`prepareDerivedData`** — everything in the §5.1 "Derived" list, in this order:
  1. `resolveMulticlass` / `resolveDualClass` → `effectiveLevels`, HP averaging rule, active/suppressed abilities
  2. `deriveAbilities` (post-AE scores + exceptional STR) → `abilities.<k>.mods`
  3. `levelForXp` per class → `canLevelUp` flag
  4. HP max — Σ per-class(`hpRolls` + CON adjustment, honouring multiclass averaging and warrior CON cap)
  5. `thac0` — best of class tables + STR (melee) / DEX (ranged) + specialization
  6. `ac` — `10 − armor − shield − dexDefensive − magic + situational`, per attack context
  7. `saves` — best-of class/level matrix + racial (per-CON) + ability mods
  8. spell slots — wizard(`level`, INT max-spell-level cap) / priest(`level`, WIS bonus, sphere access)
  9. proficiency slot totals — class progression + INT bonus-language slots
  10. encumbrance — STR `weightAllowance` vs. Σ item weight → category → `movementRate`

Anything an ActiveEffect must modify *after* these computations (e.g. a
"+1 to all saves" item) is applied as a **second pass**: derived values are
written, then AE changes whose `key` targets a derived path are re-applied. The
implementation uses the well-trodden pattern of splitting effects into
"affects base" (default Foundry timing) and "affects derived" (manual
re-application at the end of `prepareDerivedData`), keyed by target path prefix.

---

## 6. Config & optional rules

### 6.1 `CONFIG.ADND2E`

Built in `config.ts`, assigned on `init`, augmented into types in `global.d.ts`.
Contents (enums / label maps / table references):

- `abilities` — `str dex con int wis cha` + i18n labels
- `saves` — `ppd rsw pp bw spell` (Paralyzation/Poison/Death, Rod/Staff/Wand,
  Petrification/Polymorph, Breath Weapon, Spell) + labels
- `classGroups` — `warrior wizard priest rogue`
- `schools` — the 9 schools of magic (+ Wild for options)
- `spheres` — the priest spheres
- `alignments` — 9
- `sizes` — `T S M L H G`
- `weaponProficiencyGroups`, `weaponStyleGroups`
- `damageTypes` — `slashing piercing bludgeoning` (+ energy types for effects)
- `movementModes` — `land burrow climb fly swim`
- `currency` — `pp gp ep sp cp` + conversion rates
- `encumbranceCategories` — `unencumbered light moderate heavy severe` + move multipliers
- `creatureIntelligence` — the 0–21+ descriptive bands (labels only)
- `treasureTypes` — letter labels only (no tables shipped)

### 6.2 Optional-rules toggle registry

`helpers/settings.ts` registers world-scoped settings, grouped by source:

| Group | Example keys (SP1 registers all; only `core.*` are wired to logic in SP1) |
|---|---|
| `core` | `exceptionalStrength`, `weaponSpeedInitiative`, `spellFailureFromWisdom`, `trainingRequiredToLevel`, `nonweaponProficienciesUsed`, `weaponProficienciesUsed`, `multiclassHpAveraging` |
| `combatAndTactics` | `enabled`, `criticalHits`, `calledShots`, `combatManeuvers`, `armorTypeVsWeaponType`, `weaponMastery` |
| `skillsAndPowers` | `enabled`, `subAbilityScores`, `characterPointBuild`, `expandedProficiencies` |
| `spellsAndMagic` | `enabled`, `spellPoints`, `expandedCastingTime`, `channelers` |

A single accessor `getOptionalRules(): OptionalRules` reads all keys once and
returns the typed bag that DataModels pass into `core/`. `core/` never imports
this module — the bag is always a parameter.

Sub-projects 7–9 implement the branches these toggles gate; SP1 only reserves the
keys, the schema fields, and the plumbing.

---

## 7. Compendium packs

`system.json` declares packs; source lives in `packs/<name>/` as JSON and is
compiled to LevelDB at build time (via `@foundryvtt/foundryvtt-cli`, added as a
dev dependency and invoked from a `build:packs` script that `build` runs before
Vite copy).

| Pack | Type | SP1 contents |
|---|---|---|
| `classes` | Item | The core PHB classes as `class` items — **mechanical data only** (HD, progressions, prime reqs, slot rules, level limits). No descriptive prose. |
| `races` | Item | The core PHB races as `race` items — adjustments, limits, racial abilities as mechanical fields. |
| `nonweapon-proficiencies` | Item | NWP entries — name + governing ability + modifier + slot cost + group. No descriptions. |
| `weapon-proficiency-groups` | JournalEntry or Item | Group definitions for the proficiency system. |
| `conditions` | ActiveEffect (or Item) | Standard status conditions the system references. |
| `tables` (rollable) | RollTable | Empty/placeholder — no DMG tables shipped. |

**Content import path:** a small `adnd2e.importContent(json)` API (exposed on
`game.system`) that validates against the item schemas and creates documents in a
target compendium or folder. Format documented in `docs/`. This is how the user
loads spell text, monster stat blocks, and magic items transcribed from books
they own. SP1 ships the importer + schema + docs; no protected content.

---

## 8. Migration framework

- `system.json` `version` is the source of truth; a separate
  `flags.adnd2e.systemMigrationVersion` world setting records the last-migrated
  version.
- On `ready` (GM only), `helpers/migrations.ts` compares versions and runs an
  ordered list of `{ version, migrate(world) }` entries whose version is newer
  than the stored one, then writes the new version.
- SP1 ships the framework + an empty migration list + a dry-run logger. Each later
  sub-project that changes schema appends a migration.

---

## 9. Testing strategy

- **Vitest** unit tests for **all of `core/`**, written test-first (TDD skill
  applies during implementation). Coverage target: every table lookup and every
  formula path.
  - Examples: `thac0(fighterChassis, 7) === 14`;
    `strength(18, 91).damage === 4`; `strength(18, 0)` treated as 18/01–50 band;
    `resolveMulticlass([F1, M1]).hpRule === "average"`;
    `saves(["fighter",7]).bw.base === 9`;
    `movementRate(12, carried, allowance, plateArmor, {}).category === "moderate"`.
- **No Foundry mocks** — `core/` has no Foundry surface to mock. `data/`,
  `documents/`, `sheets/` are exercised manually in a linked dev world for SP1
  (automated in-Foundry tests via Quench are a later addition).
- **CI**: `npm run typecheck && npm run lint && npm run test && npm run build`
  on push / PR.

---

## 10. Scope boundary — what Sub-project 1 does NOT include

- **No real sheet UI.** `sheets/` ships a minimal raw-field editor only, so data
  can be entered for testing. Designed sheets are SP2 (PC) and SP6 (NPC/monster).
- **No roll execution.** `core/combat/attack.ts` returns a formula **string**;
  nothing constructs a Foundry `Roll` or posts to chat. That is SP3.
- **No compendium prose / stat blocks / spell text / magic items.** Only
  mechanical class/race/proficiency data + the importer.
- **No Player's Option rule logic.** Toggle keys, schema fields, and the
  `OptionalRules` plumbing exist; the branches are SP7–9.
- **No combat-tracker / initiative sort override, no weapon-speed / casting-time
  initiative modifiers.** That is SP3.
- **No `container` item type, no encumbrance-by-container.** SP2.
- **No multiclass/dual-class *sheet* affordances.** The `core/` resolution
  functions and the data shape (class level/XP on the embedded item) exist and
  are tested; wiring them into an editable UI is SP2.

---

## 11. Reference-material workflow

Implementation needs specific 2E tables: ability-score modifier tables
(all six), class XP / THAC0 / saving-throw progressions, wizard & priest
spell-slot tables, the non-weapon proficiency list, and encumbrance / movement
tables.

Workflow: Claude drafts each table from established 2E mechanics, cites the
PHB/DMG table it corresponds to (e.g. "PHB Table 2: Strength"), and the user
verifies it against their book before it is locked into a `core/tables/` file
and its tests. `thelensrpg/dnd2e-foundry` (public domain) may be consulted for
schema/structure ideas only.

---

## 12. Deliverables checklist for Sub-project 1

1. `system.json` with all `documentTypes`, packs, config
2. Tooling conversion: `vite.config.ts`, `link-system.mjs`, `package.json`,
   `vitest.config.ts`, CI workflow, README rewrite
3. `src/core/` — full rules engine with Vitest suites (test-first)
4. `src/config.ts` + `CONFIG.ADND2E` + type augmentation
5. `src/data/` — every Actor and Item DataModel, with derived-data delegating
   to `core/`
6. `src/documents/` — Actor / Item / ActiveEffect / Combatant subclasses
7. `src/helpers/` — settings registry, handlebars setup, migration framework
8. `src/sheets/` — minimal raw-field sheets registered for all types
9. `packs/` — mechanical class/race/proficiency source + build script
10. `game.system.importContent()` API + format docs
11. A linked dev world where a `character` actor can be created, given a race +
    class item, and shows correct derived THAC0 / AC / saves / HP / slots /
    encumbrance
