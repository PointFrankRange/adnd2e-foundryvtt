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
- **Foundry layer** — `src/data/` DataModels (schema + `prepareDerivedData` delegating to `core`), `src/documents/` (thin Document subclasses), `src/sheets/` (the PC character sheet from Sub-project 2, plus the Sub-project 1 raw-field editor for the remaining document types), `src/combat/` + `src/chat/` (combat chat-card content builders and listeners from Sub-project 3), `src/api/` (`importContent`), `src/migrations/` (version-gated world migrations), `src/config.ts` / `src/settings/`.

### Source directory map

- `src/core/` — pure rules engine
- `src/data/` — DataModels + `derive/**` layer
- `src/documents/` — Foundry Document subclasses
- `src/sheets/` — PC character sheet (Sub-project 2) + raw-field editor for remaining document types
- `src/combat/`, `src/chat/` — combat chat-card content builders + listeners (Sub-project 3)
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
| **2. PC character sheet** | ✅ Complete | ApplicationV2 sheet, tabs, editable fields, class/race as droppable items, multi-/dual-class handling, XP→level, HP rolling |
| **3. Core combat** | ✅ Complete | THAC0 attack rolls vs AC, damage, the 5 saving-throw categories, initiative (individual + weapon speed + casting time), combat-tracker override |
| **4. Magic** | ✅ Complete | Spell items, schools/spheres, wizard spellbook + priest sphere access, memorization slot tables, cast-from-chat with slot tracking |
| **5. Proficiencies & skills** | ✅ Complete | Weapon proficiency slots + specialization, non-weapon proficiency checks, thief/bard skill points + rolls, backstab |
| **6. NPC / monster sheet + bestiary scaffolding** | ✅ Complete | Single-page creature stat-block sheet (fully editable), streamlined 3-tab NPC sheet, empty Bestiary compendium folder + authoring docs |
| **7. Player's Option: Combat & Tactics** | 🚧 In progress (Plans 7a-7c/4 done) | Real `CONFIG.statusEffects` wiring (prone/blinded/stunned/held mechanics, the other 11 conditions as flavor markers), a Combat Tracker initiative-modifier UI, critical-hit/fumble severity tables, armor-vs-weapon-type attack modifiers, and a 4-tier weapon mastery system (Specialized/Mastery/Grand Mastery, replacing the old `specialized` flag, with a real world-data migration) — called shots/combat maneuvers still to come (Plan 7d) |
| **8. Player's Option: Skills & Powers** | 🔜 Planned | Trait/sub-ability character-point buy, expanded proficiencies |
| **9. Player's Option: Spells & Magic** | 🔜 Planned | Spell points, expanded casting rules |

### Known backlog items

- **Creature damage auto-apply.** A creature's damage roll (Sub-project 6) posts via Foundry's plain default chat card and has no "Apply Damage" button, unlike PC weapon attacks — a deliberate v1 scoping decision (the existing button resolves the weapon by item id, which a creature's array-indexed attacks don't have). Revisiting this to give creature attacks an equivalent one-click apply-to-target affordance is a candidate for a future sub-project.
- **PC sheet inventory rows have no way to open an owned Item's own full sheet.** Discovered during Sub-project 7 Plan 7b's live testing — double-clicking an inventory row does nothing, and there's no visible "edit" affordance, so fields not already exposed as inline row inputs (e.g. a weapon's Damage Type) can only be changed by editing the source compendium item and re-dragging it onto the sheet, or via the console. Out of scope for Plan 7b (neither of its tasks touched item-row interaction) — a candidate fix for whichever future sub-project next touches the PC sheet's inventory tab.
- **Weapon specialization/mastery's damage bonus and Grand Mastery's extra attack are never wired into any roll.** `weaponSpecializationEffect`/`weaponMasteryEffect` both compute a `damage` bonus (and, at Grand Mastery, `extraAttacks: 1`), but no damage-roll code anywhere reads either field — only the to-hit half is applied (`resolveProficiencyModifier`, Sub-project 5a and 7c). This is a pre-existing gap from Sub-project 5a that Plan 7c deliberately mirrored rather than expanded (matching its established to-hit-only wiring scope), confirmed as a real, tracked finding during Plan 7c's whole-branch review rather than a regression it introduced. A candidate fix for a future pass over the damage-roll pipeline.
