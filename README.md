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
| **11. Character kit engine** | 🚧 Plan A complete (foundation); Plans B-C not started | A generic character-kit engine. **Plan A (foundation):** an owned `kit` item for a class (one per class): ability/race/alignment qualifications (a failing kit drop is hard-blocked), an XP-per-level percentage that delays that class's levels, typed effects reusing the trait effect set (ability, save, to-hit, proficiency slots, bonus HP — applied regardless of the character-point rule), armor and weapon overrides (`inherit`/`replace`/`extend`), forbidden weapon proficiencies, linked granted features, and a `kits` compendium of three sample kits. The class chassis armor and weapon restrictions, previously unread data, are now enforced as warnings: equipping a disallowed item shows a toast and a ⚠ row mark but still equips. Parametrized granted powers (Plan B) and base-class ability overrides (Plan C) are not implemented. |
| **12. Subrace architecture** | 📋 Not started | Layered subrace data (ability-score range, infravision, XP surcharge) over today's single-race-per-PHB-race model; prerequisite for drow, duergar, deep gnome, and the other named subraces surveyed in `docs/mechanics-review-2026-09.md` |
| **13. Level adjustment / XP surcharge** | 📋 Not started | A generic per-level XP multiplier for playable "powerful" races (humanoid PC races, and several subraces), reusable for any future race, kit, or homebrew |
| **14. Player's Option: Spells & Magic — Wizard Spell Points & Channellers** | ✅ Complete (Plans A–D, plus priest orisons, priest channelling, and paladin/ranger priest spells) | Wizard spell-point pool (Tables 17-19: SP totals, fixed/free magick costs, Intelligence bonus) as an alternate, additive eligibility layer over the classic per-level memorization slots; fixed magick memorizes a specific spell as before, free magick reserves a spell level and lets the wizard choose which known spell to cast at cast time (always immediate — it does not route through the SP9 Begin→Complete casting-time flow). Free-magick memorize/cast/forget is PC-sheet only (a Character NPC sees the SP bar and can still use fixed magick, matching how other PC-only features already work on that shared sheet). **Plan B (Channellers):** a channelling wizard (PC or Character NPC) memorizes fixed/free magicks for free and instead spends a persisted, recoverable spell-point pool every time they cast — the memorized entry is never expended, so the same spell can be cast repeatedly until the pool runs dry; a Recover action (Table 20: activity type + hours) refills it over time. The SP-total formula substitutes Constitution/Wisdom adjustments for the Intelligence bonus classic spell points uses. Works correctly inside the SP9 Expanded Casting Time combat flow too (spends SP when casting begins, same as PHB's "committed when casting begins" rule). **Plan C (Table 21 fatigue):** each channelled cast resolves a fatigue tier from caster level, spell level, current HP and SP (escalating at 50%/25% HP and 50%/75% SP spent), and stacks on existing fatigue; five mutually-exclusive conditions apply real attack, AC and movement penalties, mortal fatigue is a save-or-die, and a Recover from Fatigue action sheds one tier per successful save with a banked bonus on repeated attempts. Works on the PC and Character NPC sheets. **Plan D (priest spell points):** when the spell-points rule is on, priests memorize from a Table 26 SP pool (Wisdom bonus per Table 27, Constitution adjustment ignored if it would drop the total below 4) instead of classic Table 24 slots. Fixed theurgies cost Table 28/29 (minor-sphere access pays the next level up); major and universal free theurgies are chosen at cast time, the major free tier only for major-access spells. **Priest orisons (PR #70):** under the spell-points rule, a priest memorizes level-0 orisons at 1 SP each, up to twice the Table 26 max spells per level, shown in their own group. **Priest channelling (PR #71):** clerics and druids with Channellers on spend the priest pool on each cast (Table 29 costs, orisons 1 SP), recover it under Table 20, and face Table 21 fatigue, banking their own fatigue save bonus. **Paladins and rangers** (PR #67) memorize priest spells from classic slots: paladins from combat, divination, healing and protection; rangers from plant and animal. Overcharging, exceeding the spell-level limit, the three power/time/condition discounts, and cantrips remain unimplemented |
| **15. Player's Option: Psionics** | 📋 Not started | Currently zero coverage. PSP pool + power score, power checks, psionic combat (attack vs. defense modes as psychic contests), disciplines/sciences/devotions, and wild talents for non-psionicist classes |
| **16. Druid shapechanging** | 📋 Not started | Real numeric shapeshifting: heal-on-shift, form-derived AC/movement/attacks, branch-specific frequency and available forms |
| **17. Barbarian class + Wild Fighting** | 📋 Not started | The Barbarian warrior class (non-metal armor, its own two-weapon penalty table, built-in thief-like abilities) plus Wild Fighting, this edition's closest analogue to a rage ability |
| **18. Ninja martial arts** | 📋 Not started | Unarmed-combat styles built from selectable principal methods, named special maneuvers resolved via hit-location/severity tables, and ch'i attacks that let unarmed hits bypass damage resistance by level |
| **19. Paladin bonded mount** | 📋 Not started | A generatable special-mount procedure (species table gated by paladin level, boosted Int/Morale over species baseline, a full stat block for the default war horse) |
| **20. Ranger tracking** | 📋 Not started | A Wisdom-based tracking score modified by terrain/illumination/situational tables, with capped movement while tracking and a secondary quarry-identification check |

Sub-projects 10-20 are candidates sourced from the 2026-09 reference survey (`docs/mechanics-review-2026-09.md`), which also lists smaller Tier 2/3 additions (e.g. wizard signature spells, expanded melee maneuvers, bard signature abilities, racial combat bonuses) — those are folded into whichever sub-project, existing or future, they extend rather than tracked as their own rows.

### Table settings

- **Player-Applied Damage & Effects** (world setting): when a player applies damage, healing or a maneuver effect to a token they don't own, the active GM's client applies it — automatically (default) or after the GM approves each one — and whispers the GM a log line. Needs a GM connected. If the active GM has the world open in more than one browser tab or device, a relayed effect can apply once per tab (Foundry delivers the query to every connection of that user) — keep one GM session open.

### Known backlog items

- **Kit engine limits.** Kit effects author as a JSON list on the item sheet (no per-type item layout yet); armor names `brigandine` and `hide` have no matching item armor type so they never match; a druid's wooden shield isn't modelled so a shield flags as not permitted for druids; kits are PC-sheet only; a kit does not check proficiencies the character already holds when it is dropped (the forbidden-proficiency rule only blocks new weapon-proficiency drops), and a null weapon damage type is treated as permitted for the blunt rule.
- **Turn Undead limits.** Turned undead are a flavor condition (no automatic fleeing or ten-foot break), Character NPC clerics cannot turn (PC sheet only), an attempt made outside combat stays flagged until the GM presses Reset on the character's sheet, in the player-apply "approve" mode the GM gets one confirmation per affected undead, and evil-priest commanding and the shaman/Ghosthunter variants are parked.
- **Monster NPC bows and crossbows still deal no damage.** Ammunition is now modeled for PCs (arrow/bolt items, S-M / L damage, selected per weapon and consumed on every shot, hit or miss) but Monster NPC ranged attacks keep using the existing flat weapon-damage formula, unaffected — a deliberate v1 scope boundary, matching how Monster NPC weapon attacks are already simpler than PC ones elsewhere.
- **A typo in a weapon's damage dice (e.g. `1d8+`) isn't caught:** the attack card posts but the damage roll errors silently — on both PC and Monster NPC attacks. A try/catch with a warning toast would fix it.
- **The full Combat & Tactics maneuver list beyond the curated 4 remains parked.** Sub-project 7 ships only disarm, knock down/trip, grapple, and bull rush (plus 3 called-shot locations), unified as an attack roll with a penalty and an on-hit effect — a deliberate simplification of the book's varied per-maneuver mechanics (some opposed ability checks). The remaining maneuvers are a candidate for a future revisit (spec §7).
- **Conditions have no duration or automatic expiry.** Stunned, held, and prone (applied by called shots and maneuvers, or by hand from the Token HUD) stay until a GM clears them manually. Grapple's `held` (blocks the target from acting and grants all attackers +4) is the strongest of these for its −2 cost, which the plan's value table under-priced; surfaced in the setting hints rather than re-balanced. A round-based expiry mechanism would be the proper fix, and would also let the 11 flavor-only conditions gain mechanics.
- **Skills & Powers scope left out of Sub-project 8.** A custom-class builder, character kits and per-level character-point awards (the pool is a creation budget only), plus the expanded-proficiency options offered but not selected: a larger non-weapon proficiency list, secondary-ability checks, and wiring the `weaponProficienciesUsed`/`nonweaponProficienciesUsed` toggles.
- **Sub-scores and traits are invisible on the NPC's own sheet.** The shared derivation applies them to NPCs (hand-set sub-scores, or traits added while the NPC was switched to the full PC sheet), but the streamlined NPC sheet shows neither. The NPC sheet rejects trait drops; the full PC sheet, when selected for an NPC, does not.
- **The rest of *Player's Option: Spells & Magic* remains unimplemented.** Wizard spell points (Plan A, Tables 17-19), Channellers (Plan B), Table 21 fatigue (Plan C), priest spell points (Plan D, Tables 26-29), priest orisons, priest channelling, and paladin/ranger priest spells have shipped; overcharging ("casting for greater effect"), exceeding the spell-level limit, the three power/time/condition discounts, cantrips are tracked in `docs/mechanics-review-2026-09.md` and the Sub-project 14 specs. Separately, still parked from Sub-project 9: spell mishaps, the Table 56 innate-ability/magic-item initiative modifiers, casting time for creature stat blocks, and structured casting-time fields (only the free-text Casting Time is parsed: a bare number, "N rounds" or "N turns"; anything else casts immediately).
- **Item sheets: open follow-ups.** Item sheets use the character sheet's kit layout, spell schools and spheres are dropdowns with multi-select checkboxes, and list fields are one entry per line (PRs #60–#64). Still open: no per-type item layouts, and the checkbox list is not a themed spell sheet.
- **Sheet redesign follow-ups (all three sheets).** The redesign (PC, Character NPC and Monster NPC) is complete as of Plan R3. On the Character NPC sheet, Award XP, dual-class, thief-point allocation, sub-ability seeding and traits are deliberately PC-only. To get them for an NPC, switch it to the full PC sheet in Sheet Configuration. The Monster NPC sheet has no favorites (★) by design — its attacks are already one click from the Stat Block tab. Also:
  - Clicking an item's name shows its stats but no prose description, and it prints raw values such as `chain-mail` or `piercing-slashing` because there's no label map. Fixing this properly needs new `CONFIG.ADND2E` label maps for armor types and the weapon damage-type enum (neither exists today — the broader spell damage-type map doesn't cover the weapon-specific combined types like `piercing-slashing`), so it's parked as its own follow-up rather than folded into this batch.
  - Deleted items stay in the favorites flag. They're hidden from the panel but not pruned. Still open — the clean fix is pruning at delete-time (in the delete-item action), not during render; parked as its own follow-up.
  - A Monster NPC's locked stat-block view doesn't show the derived-vs-authored AC distinction that THAC0 and saves show; unlock to see the authored value.
  - The Monster NPC sheet's nothing-lost binding test doesn't assert that unlock-only fields are actually gated on the lock (a manual whole-branch-review check found they are; a future test could assert it directly).
- **Casting-time rough edges.** A segment spell's initiative addition stays until initiative is re-rolled; a round spell can be completed at any point during its final round (honor system); a combatant removed from a running combat keeps its casting state until the GM cancels it; near-simultaneous disruptions can post two "spell lost" cards. Automatic disruption needs a GM connected.
