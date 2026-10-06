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
| **6. NPC / monster sheet + bestiary scaffolding** | ✅ Complete | Single-page **Monster NPC** stat-block sheet (the `creature` type, fully editable; gear list, an attack row per equipped weapon — monster THAC0 + weapon magic, weapon damage by target size — and spells with Cast; equipped armor leaves the stat-block AC unchanged), streamlined 3-tab **Character NPC** sheet (the `npc` type), empty Bestiary compendium folder + authoring docs |
| **7. Player's Option: Combat & Tactics** | ✅ Complete | Real `CONFIG.statusEffects` wiring (prone/blinded/stunned/held mechanics, the other 11 conditions as flavor markers), a Combat Tracker initiative-modifier UI, critical-hit/fumble severity tables, armor-vs-weapon-type attack modifiers, a 4-tier weapon mastery system (Specialized/Mastery/Grand Mastery, with a real world-data migration), and called shots (head/weapon hand/leg) + 4 curated combat maneuvers (disarm, knock down/trip, grapple, bull rush) via a per-weapon-row dropdown |
| **8. Player's Option: Skills & Powers** | ✅ Complete | The four Skills & Powers toggles wired into `OptionalRules`; sub-ability scores (12 authored sub-scores averaging into the six main scores, with a PC-sheet seed action); expanded proficiencies (a related-weapon penalty: attacking with a weapon in the same group as a specific-weapon proficiency you hold costs half the non-proficiency penalty, plus a 51-item specific-weapon proficiency pack); and the character-point build (a new `trait` item type with a 14-trait compendium, trait effects on ability scores, saves, to-hit, proficiency slots and HP, and a PC Features-tab CP ledger with a GM-editable pool and hard-blocked unaffordable/duplicate trait drops) |
| **9. Player's Option: Spells & Magic** | ✅ Complete | Grounded in the PHB's optional casting rules (the *Spells & Magic* supplement isn't in this project's references): a spell's casting time adds to initiative, multi-round spells take effect at the end of their last round via a Begin → Complete casting flow in combat, losing hit points or failing a save while casting disrupts and loses the spell (detected on the GM's client), and a caster gets no Dexterity AC bonus while casting |
| **10. Turn Undead** | ✅ Complete | Table 61 turning for clerics and paladins (paladins two levels lower; druids cannot): one d20 read per targeted Monster NPC by its Table 61 row, with turn/destroy/D* outcomes, the 2d6 affected count (lowest Hit Dice first) and the 2d4 D* bonus, one chat card, a `turned` condition and destruction applied through the player-apply relay, and one attempt per encounter (cleared when combat ends, or reset by the GM). Monster NPCs gain a general multi-select Types field (undead first) and a Table 61 row select. Evil-priest commanding, evil priests turning paladins, the shaman talisman and the Ghosthunter kit are not implemented. |
| **11. Character kit engine** | ✅ Complete | A generic character-kit engine. **Plan A (foundation):** an owned `kit` item for a class (one per class): ability/race/alignment qualifications (a failing kit drop is hard-blocked), an XP-per-level percentage that delays that class's levels, typed effects reusing the trait effect set (ability, save, to-hit, proficiency slots, bonus HP — applied regardless of the character-point rule), armor and weapon overrides (`inherit`/`replace`/`extend`), forbidden weapon proficiencies, linked granted features, and a `kits` compendium of sample kits. The class chassis armor and weapon restrictions, previously unread data, are now enforced as warnings: equipping a disallowed item shows a toast and a ⚠ row mark but still equips. **Plan B (parametrized granted powers):** kits can declare tracked powers with per-encounter/day/at-will frequencies, use tracking on the PC Kits panel, and reset mechanics. **Plan C (base-class overrides):** kits can override class abilities (casting and turning mechanics) and define level-scaled power uses; the Sample Ghosthunter kit exercises casting-off, turning offset, removed abilities, and level-scaled powers. |
| **12. Subrace architecture** | ✅ Plans A-C complete (engine, the six dwarf subraces, the five elf subraces, the four gnome and seven halfling subraces, and a flat saving-throw bonus) | A subrace layer (a race item's `subrace` block: ability adjustments and ranges, thieving adjustments, Constitution-save adjustment, XP surcharge) over the PHB race, with the six dwarf subraces from The Complete Book of Dwarves. The five elf subraces (aquatic, drow, grey, high, sylvan) come from The Complete Book of Elves. The four gnome (rock, deep, tinker, forest) and seven halfling (hairfoot, stout, tallfellow, furchin, kender) subraces come from The Complete Book of Gnomes and Halflings, with the Deep Gnome's flat saving-throw bonus; the Athasian halfling and Dark Sun content are deferred; level limits are still data only; enmities, innate powers, spell-likes, magic resistance, reaction modifiers and other bespoke specials are display labels only. Originally: Layered subrace data (ability-score range, infravision, XP surcharge) over today's single-race-per-PHB-race model; prerequisite for drow, duergar, deep gnome, and the other named subraces surveyed in `docs/mechanics-review-2026-09.md` |
| **13. Racial level limits** | ✅ Complete | Racial class-level limits enforced from the race item's `classLevelLimits` (on by default); an optional exceed rule (each level beyond the limit costs x2/x3/x4 XP, cumulative with race and kit XP percentages) and optional prime-requisite bonus levels (the Dwarves book table, single-class characters only) |
| **14. Player's Option: Spells & Magic — Wizard Spell Points & Channellers** | ✅ Complete (Plans A–D, plus priest orisons, priest channelling, and paladin/ranger priest spells) | Wizard spell-point pool (Tables 17-19: SP totals, fixed/free magick costs, Intelligence bonus) as an alternate, additive eligibility layer over the classic per-level memorization slots; fixed magick memorizes a specific spell as before, free magick reserves a spell level and lets the wizard choose which known spell to cast at cast time (always immediate — it does not route through the SP9 Begin→Complete casting-time flow). Free-magick memorize/cast/forget is PC-sheet only (a Character NPC sees the SP bar and can still use fixed magick, matching how other PC-only features already work on that shared sheet). **Plan B (Channellers):** a channelling wizard (PC or Character NPC) memorizes fixed/free magicks for free and instead spends a persisted, recoverable spell-point pool every time they cast — the memorized entry is never expended, so the same spell can be cast repeatedly until the pool runs dry; a Recover action (Table 20: activity type + hours) refills it over time. The SP-total formula substitutes Constitution/Wisdom adjustments for the Intelligence bonus classic spell points uses. Works correctly inside the SP9 Expanded Casting Time combat flow too (spends SP when casting begins, same as PHB's "committed when casting begins" rule). **Plan C (Table 21 fatigue):** each channelled cast resolves a fatigue tier from caster level, spell level, current HP and SP (escalating at 50%/25% HP and 50%/75% SP spent), and stacks on existing fatigue; five mutually-exclusive conditions apply real attack, AC and movement penalties, mortal fatigue is a save-or-die, and a Recover from Fatigue action sheds one tier per successful save with a banked bonus on repeated attempts. Works on the PC and Character NPC sheets. **Plan D (priest spell points):** when the spell-points rule is on, priests memorize from a Table 26 SP pool (Wisdom bonus per Table 27, Constitution adjustment ignored if it would drop the total below 4) instead of classic Table 24 slots. Fixed theurgies cost Table 28/29 (minor-sphere access pays the next level up); major and universal free theurgies are chosen at cast time, the major free tier only for major-access spells. **Priest orisons (PR #70):** under the spell-points rule, a priest memorizes level-0 orisons at 1 SP each, up to twice the Table 26 max spells per level, shown in their own group. **Priest channelling (PR #71):** clerics and druids with Channellers on spend the priest pool on each cast (Table 29 costs, orisons 1 SP), recover it under Table 20, and face Table 21 fatigue, banking their own fatigue save bonus. **Paladins and rangers** (PR #67) memorize priest spells from classic slots: paladins from combat, divination, healing and protection; rangers from plant and animal. Overcharging, exceeding the spell-level limit, the three power/time/condition discounts, and cantrips remain unimplemented |
| **15. Player's Option: Psionics** | 🚧 Plan A complete (foundation); Plans B-D (catalog, psionic combat, wild talents) not started | **Plan A (foundation):** the Psionicist class (PHBR5 saves/THAC0 and race data), a `power` item type with 23 starter powers, and a PSP pool derived from Wisdom, Intelligence, Constitution and level (Tables 1-4, incl. the multiclass formula). A Psionics tab (only for a psionicist) shows the PSP bar, a rest row (Table 6 recovery), maintained powers with Pay/End, powers grouped by discipline with a d20 power check on Use (full cost on success, half on failure), Relearn (+1 score) and defense modes. Dropping a power enforces the Table 4 totals and the learning rules. Still to come: the full power catalog, psionic combat, and wild talents for non-psionicist classes |
| **16. Druid shapechanging** | 📋 Not started | Real numeric shapeshifting: heal-on-shift, form-derived AC/movement/attacks, branch-specific frequency and available forms |
| **17. Barbarian class + Wild Fighting** | 📋 Not started | The Barbarian warrior class (non-metal armor, its own two-weapon penalty table, built-in thief-like abilities) plus Wild Fighting, this edition's closest analogue to a rage ability |
| **18. Ninja martial arts** | 📋 Not started | Unarmed-combat styles built from selectable principal methods, named special maneuvers resolved via hit-location/severity tables, and ch'i attacks that let unarmed hits bypass damage resistance by level |
| **19. Paladin bonded mount** | 📋 Not started | A generatable special-mount procedure (species table gated by paladin level, boosted Int/Morale over species baseline, a full stat block for the default war horse) |
| **20. Ranger tracking** | 📋 Not started | A Wisdom-based tracking score modified by terrain/illumination/situational tables, with capped movement while tracking and a secondary quarry-identification check |
| **21. Humanoid player races** | 📋 Not started | The ~28 player-character humanoid races of The Complete Book of Humanoids (PHBR10): per-race ability ranges, level limits (Table 1), XP multipliers, hit-dice rules and kits; needs the closed six-value race id generalized to data-driven races |

Sub-projects 10-20 are candidates sourced from the 2026-09 reference survey (`docs/mechanics-review-2026-09.md`), which also lists smaller Tier 2/3 additions (e.g. wizard signature spells, expanded melee maneuvers, bard signature abilities, racial combat bonuses) — those are folded into whichever sub-project, existing or future, they extend rather than tracked as their own rows.

### Table settings

- **Player-Applied Damage & Effects** (world setting): when a player applies damage, healing or a maneuver effect to a token they don't own, the active GM's client applies it — automatically (default) or after the GM approves each one — and whispers the GM a log line. Needs a GM connected. If the active GM has the world open in more than one browser tab or device, a relayed effect can apply once per tab (Foundry delivers the query to every connection of that user) — keep one GM session open.

### Roadmap and backlog

Planned sub-projects, rules gaps, known bugs, tech debt and sheet/UI follow-ups are tracked as [GitHub Issues](https://github.com/PointFrankRange/adnd2e-foundryvtt/issues) (labels `sub-project`, `rules-gap`, `backlog`, `tech-debt`, `sheet-ui`, `dark-sun`) on the [roadmap project board](https://github.com/users/PointFrankRange/projects/1). Source-book research behind them is in `docs/mechanics-review-2026-09.md`.
