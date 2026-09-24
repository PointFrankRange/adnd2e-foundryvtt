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

The system ships seven Item compendium packs:

- `classes` — Character classes
- `races` — Player character races
- `nonweapon-proficiencies` — Non-weapon proficiency items
- `weapon-proficiency-groups` — Weapon proficiency group slots
- `weapon-proficiencies` — One specific-weapon proficiency per weapon name (51), each tagged with its proficiency group (names and group only)
- `conditions` — The 15 status-effect condition markers
- `traits` — The 14 Skills & Powers character-point traits (this project's own designed costs and effects)

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
| **7. Player's Option: Combat & Tactics** | ✅ Complete | Real `CONFIG.statusEffects` wiring (prone/blinded/stunned/held mechanics, the other 11 conditions as flavor markers), a Combat Tracker initiative-modifier UI, critical-hit/fumble severity tables, armor-vs-weapon-type attack modifiers, a 4-tier weapon mastery system (Specialized/Mastery/Grand Mastery, with a real world-data migration), and called shots (head/weapon hand/leg) + 4 curated combat maneuvers (disarm, knock down/trip, grapple, bull rush) via a per-weapon-row dropdown |
| **8. Player's Option: Skills & Powers** | ✅ Complete | The four Skills & Powers toggles wired into `OptionalRules`; sub-ability scores (12 authored sub-scores averaging into the six main scores, with a PC-sheet seed action); expanded proficiencies (a related-weapon penalty: attacking with a weapon in the same group as a specific-weapon proficiency you hold costs half the non-proficiency penalty, plus a 51-item specific-weapon proficiency pack); and the character-point build (a new `trait` item type with a 14-trait compendium, trait effects on ability scores, saves, to-hit, proficiency slots and HP, and a PC Features-tab CP ledger with a GM-editable pool and hard-blocked unaffordable/duplicate trait drops) |
| **9. Player's Option: Spells & Magic** | 🔜 Planned | Spell points, expanded casting rules |

### Known backlog items

- **Creature damage auto-apply.** A creature's damage roll (Sub-project 6) posts via Foundry's plain default chat card and has no "Apply Damage" button, unlike PC weapon attacks — a deliberate v1 scoping decision (the existing button resolves the weapon by item id, which a creature's array-indexed attacks don't have). Revisiting this to give creature attacks an equivalent one-click apply-to-target affordance is a candidate for a future sub-project.
- **PC sheet inventory rows have no way to open an owned Item's own full sheet.** Discovered during Sub-project 7 Plan 7b's live testing — double-clicking an inventory row does nothing, and there's no visible "edit" affordance, so fields not already exposed as inline row inputs (e.g. a weapon's Damage Type) can only be changed by editing the source compendium item and re-dragging it onto the sheet, or via the console. Out of scope for Plan 7b (neither of its tasks touched item-row interaction) — a candidate fix for whichever future sub-project next touches the PC sheet's inventory tab.
- **Weapon specialization/mastery's damage bonus and Grand Mastery's extra attack are never wired into any roll.** `weaponSpecializationEffect`/`weaponMasteryEffect` both compute a `damage` bonus (and, at Grand Mastery, `extraAttacks: 1`), but no damage-roll code anywhere reads either field — only the to-hit half is applied (`resolveProficiencyModifier`, Sub-project 5a and 7c). This is a pre-existing gap from Sub-project 5a that Plan 7c deliberately mirrored rather than expanded (matching its established to-hit-only wiring scope), confirmed as a real, tracked finding during Plan 7c's whole-branch review rather than a regression it introduced. A candidate fix for a future pass over the damage-roll pipeline.
- **The full Combat & Tactics maneuver list beyond the curated 4 remains parked.** Sub-project 7 ships only disarm, knock down/trip, grapple, and bull rush (plus 3 called-shot locations), unified as an attack roll with a penalty and an on-hit effect — a deliberate simplification of the book's varied per-maneuver mechanics (some opposed ability checks). The remaining maneuvers are a candidate for a future revisit (spec §7).
- **Conditions have no duration or automatic expiry.** Stunned, held, and prone (applied by called shots and maneuvers, or by hand from the Token HUD) stay until a GM clears them manually. Grapple's `held` (blocks the target from acting and grants all attackers +4) is the strongest of these for its −2 cost, which the plan's value table under-priced; surfaced in the setting hints rather than re-balanced. A round-based expiry mechanism would be the proper fix, and would also let the 11 flavor-only conditions gain mechanics.
- **Non-GM players can't apply damage or maneuver effects to GM-owned targets.** The Apply Damage button (Sub-project 3) and Plan 7d's maneuver effects both require OWNER permission on the target. Players see a permission warning and the GM applies the result by hand. A GM-relayed apply (socket or a GM-executed macro) would let players resolve these end to end.
- **Expanded proficiencies: pre-existing and hand-made proficiencies can't count as related.** The related-weapon penalty matches on a proficiency's `proficiencyGroup`, which only the new `weapon-proficiencies` pack items carry; proficiencies created before Plan 8b or by hand have an empty group and behave exactly as before (full non-proficiency penalty). The PC sheet has no way to open an owned item to set it, so the workaround is to delete and re-drop the proficiency from the pack (which resets its mastery tier and slots). A future fix could fall back to the group of the owned weapon with the same name.
- **Duplicate weapon-proficiency drops aren't guarded.** Dropping a proficiency the actor already holds creates a second copy and charges a second slot (pre-existing since Sub-project 5a).
- **A weapon's `proficiencyGroup` is free text.** Related-weapon matching needs the exact group name including case (e.g. `Blades`); a dropdown limited to the 8 group names would prevent typos.
- **Skills & Powers scope left out of Sub-project 8.** A custom-class builder, character kits and per-level character-point awards (the pool is a creation budget only), plus the expanded-proficiency options offered but not selected: a larger non-weapon proficiency list, secondary-ability checks, and wiring the `weaponProficienciesUsed`/`nonweaponProficienciesUsed` toggles.
- **Sub-scores and traits are invisible on the NPC's own sheet.** The shared derivation applies them to NPCs (hand-set sub-scores, or traits added while the NPC was switched to the full PC sheet), but the streamlined NPC sheet shows neither. The NPC sheet rejects trait drops; the full PC sheet, when selected for an NPC, does not.
- **Trait ability bonuses show inside the ability row's "racial" delta,** and the exceptional-Strength percentile input keys off the authored score, so STR 17 + Powerful prepares as 18 without the percentile input (the same as a racial +1 today). Cosmetic.
- **Sub-score character-point refunds are uncapped** (a sub-score of 9 or less refunds CP), exactly as specced; only disadvantage traits share the 10-point refund cap. A trait dropped onto a creature sheet is inert.
