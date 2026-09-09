# Advanced Dungeons & Dragons 2nd Edition — Foundry VTT System

A Foundry VTT **game system** (id `adnd2e`) implementing the AD&D 2nd Edition rules with heavy automation. Built with TypeScript + Vite, targeting **Foundry v14** (compatibility: minimum 13, verified 14).

## Install

In **Configuration and Setup → Game Systems → Install System**, paste this Manifest URL:

```
https://github.com/PointFrankRange/adnd2e-foundryvtt/releases/download/latest/system.json
```

This tracks the rolling `latest` build (published on every push to `master`).
After a new push, use **Update** in the Game Systems list to pull the newest build.

## Content policy

This repository contains game *mechanics* only — no rulebook text, spell descriptions, monster stat blocks, or magic-item text. To add content you own into your world, use the in-world importer:

```javascript
game.system.api.importContent(json)
```

See [`docs/importing-content.md`](docs/importing-content.md) for the JSON format and limitations.

## Development

1. Clone the repository
2. `npm install`
3. Copy `foundryconfig.example.json` to `foundryconfig.json` and set `dataPath` to your Foundry user-data directory (the folder containing `Data/`, `Config/`, `Logs/`)
4. `npm run build`
5. `npm run link` (creates junctions from `dist/` into `Data/systems/adnd2e`)
6. Restart Foundry; create or edit a world using the "Advanced Dungeons & Dragons 2nd Edition" system

### Development commands

- `npm run typecheck` — runs TypeScript twice (the second pass, `tsconfig.core.json`, proves the pure rules engine imports nothing from Foundry)
- `npm run lint` — ESLint
- `npm run test` / `npm run test:coverage` — Vitest (100% line/branch/function coverage on the pure zone)
- `npm run build` — Vite library build + `build:packs`

## Architecture

The system follows a two-layer contract:

- **`src/core/`** — a framework-free rules engine (pure functions, lookup tables, no Foundry imports, deterministic). Returns plain data or formula strings; exhaustively unit-tested.
- **`src/data/derive/`** — pure snapshot-to-derived-values layer.
- **Foundry layer** — `src/data/` DataModels (schema + `prepareDerivedData` delegating to `core`), `src/documents/` (thin Document subclasses), `src/sheets/` (Sub-project 1 raw-field editor only; designed sheets are Sub-project 2 and later), `src/api/` (`importContent`), `src/migrations/` (version-gated world migrations), `src/config.ts` / `src/settings/`.

### Source directory map

- `src/core/` — pure rules engine
- `src/data/` — DataModels + `derive/**` layer
- `src/documents/` — Foundry Document subclasses
- `src/sheets/` — raw-field editor (sheets designed in later sub-projects)
- `src/api/` — `importContent`
- `src/migrations/` — version-gated world migrations
- `src/config.ts` — `CONFIG.ADND2E` registry
- `src/settings/` — optional-rules toggles
- `src/constants.ts` — shared constants
- `src/types/global.d.ts` — Foundry type augmentations

## Compendium content

The system ships four Item compendium packs:

- `classes` — Character classes
- `races` — Player character races
- `nonweapon-proficiencies` — Non-weapon proficiency items
- `weapon-proficiency-groups` — Weapon proficiency group slots

Pack sources are JSON files under `packs/<name>/_source/`, one document per file, compiled to LevelDB by `npm run build:packs`. Mechanical values are transcribed from the PHB and DMG with page citations in each pack's `_MANIFEST.md`.

## Sub-project status

| Sub-project | Status | Scope |
|-------------|--------|-------|
| **1. Foundation & data architecture** | ✅ Complete | Core rules engine + all DataModels + `deriveCharacter` / `deriveCreature` + ActiveEffect two-pass + 4 compendium packs + `build:packs` + `importContent` + migration framework + stub sheets |
| **2. PC character sheet** | 🔜 Planned | ApplicationV2 sheet, tabs, editable fields, class/race as droppable items, multi-/dual-class handling, XP→level, HP rolling |
| **3. Core combat** | 🔜 Planned | THAC0 attack rolls vs AC, damage, the 5 saving-throw categories, initiative (individual + weapon speed + casting time), combat-tracker override |
| **4. Magic** | 🔜 Planned | Spell items, schools/spheres, wizard spellbook + priest sphere access, memorization slot tables, cast-from-chat with slot tracking |
| **5. Proficiencies & skills** | 🔜 Planned | Weapon proficiency slots + specialization, non-weapon proficiency checks |
| **6. NPC / monster sheet + bestiary scaffolding** | 🔜 Planned | Streamlined stat-block sheet, item templates for user-owned content |
| **7. Player's Option: Combat & Tactics** | 🔜 Planned | Maneuvers, critical-hit tables, called shots, expanded initiative |
| **8. Player's Option: Skills & Powers** | 🔜 Planned | Trait/sub-ability character-point buy, expanded proficiencies |
| **9. Player's Option: Spells & Magic** | 🔜 Planned | Spell points, expanded casting rules |
