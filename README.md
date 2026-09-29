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

### Table settings

- **Player-Applied Damage & Effects** (world setting): when a player applies damage, healing or a maneuver effect to a token they don't own, the active GM's client applies it — automatically (default) or after the GM approves each one — and whispers the GM a log line. Needs a GM connected. If the active GM has the world open in more than one browser tab or device, a relayed effect can apply once per tab (Foundry delivers the query to every connection of that user) — keep one GM session open.

### Known backlog items

- **Monster NPC bows and crossbows still deal no damage.** Ammunition is now modeled for PCs (arrow/bolt items, S-M / L damage, selected per weapon and consumed on every shot, hit or miss) but Monster NPC ranged attacks keep using the existing flat weapon-damage formula, unaffected — a deliberate v1 scope boundary, matching how Monster NPC weapon attacks are already simpler than PC ones elsewhere.
- **Monster NPC weapon-attack parity with the PC sheet — fixed.** An equipped-weapon attack (`rollWeaponAttack`) now applies the same Combat & Tactics weapon-vs-armor modifier the PC sheet does (reusing `resolveTargetArmorType` unchanged — it already treats a creature *target's* armor as inert, matching the Monster NPC design ruling), and a "weapon drops" fumble now unequips the monster's weapon, same as a PC's. A stat-block attack (`rollAttack`, no weapon Item to read a damage type from or unequip) is unaffected by either — still simpler by design.
- **A disarm against an already-unarmed target used to claim success everywhere — fixed, including the permanent chat log.** `applyEffectLocally` now reports whether it actually changed anything (only `unequip` against an unarmed target can be a no-op), fixing the GM-whisper log's wording, and `RelayResult`'s success variant carries `changed: boolean` so `requestApply` can show the attacking player an info toast too. Dev-world testing found a toast alone wasn't enough — it's transient, while the chat log is the permanent record, and the attack card's "Disarm succeeds!" line necessarily posts *before* the relay resolves (the attacker's client can't see a GM-owned target's inventory in advance to know better). `requestApply` now returns whether anything changed, and `rollAttack` (character/combat-rolls.ts) uses that to patch the already-posted message's content in place — re-rendering the same card with the maneuver line swapped to "Disarm attempted — the target had nothing equipped" — for the one maneuver-effect kind (`unequip`, i.e. disarm and the called-shot weapon-hand) that can turn out to have done nothing.
- **A typo in a weapon's damage dice (e.g. `1d8+`) isn't caught:** the attack card posts but the damage roll errors silently — on both PC and Monster NPC attacks. A try/catch with a warning toast would fix it.
- **Both fighter "extra attacks per round" mechanics are informational badges only, not enforced.** A weapon at Grand Mastery (tier 3) shows a "Grand Mastery: +1 attack/round" badge (`grandMasteryExtraAttack`); a weapon a single-class fighter is Specialized in (tier 1+) with its `specialistWeaponClass` set shows PHB Table 35's rate, e.g. "3/2 attacks" (`specialistAttackRate`, `context.ts`'s `resolveSpecialistAttackRate`) — both on the Combat-tab row. Neither is gated: nothing in this codebase tracks or limits attacks per round anywhere (no combat round-state exists for that), so these are reminders, not gates, matching the same PHB-vs-Combat&Tactics on/off split the roll-time bonuses already use (Table 35 is base-rules, always on; Grand Mastery needs the `weaponMastery` optional rule). Table 35's own 6-way weapon-class split (light vs heavy crossbow, thrown dagger vs dart vs other) isn't derivable from anything else on a weapon item, so `specialistWeaponClass` is a new explicit per-weapon dropdown the GM sets when it matters — blank by default, showing no rate. The badge deliberately doesn't try to compute which round of the fraction you're currently in (would need to read the active Combat's round counter, a new kind of live-state coupling); the player tracks that themselves, same as everything else here.
- **The full Combat & Tactics maneuver list beyond the curated 4 remains parked.** Sub-project 7 ships only disarm, knock down/trip, grapple, and bull rush (plus 3 called-shot locations), unified as an attack roll with a penalty and an on-hit effect — a deliberate simplification of the book's varied per-maneuver mechanics (some opposed ability checks). The remaining maneuvers are a candidate for a future revisit (spec §7).
- **Conditions have no duration or automatic expiry.** Stunned, held, and prone (applied by called shots and maneuvers, or by hand from the Token HUD) stay until a GM clears them manually. Grapple's `held` (blocks the target from acting and grants all attackers +4) is the strongest of these for its −2 cost, which the plan's value table under-priced; surfaced in the setting hints rather than re-balanced. A round-based expiry mechanism would be the proper fix, and would also let the 11 flavor-only conditions gain mechanics.
- **Duplicate weapon-proficiency drops aren't guarded.** Dropping a proficiency the actor already holds creates a second copy and charges a second slot (pre-existing since Sub-project 5a).
- **A weapon's/weapon-proficiency's `proficiencyGroup` used to be free text, needing the exact name including case — fixed.** Both schemas' `proficiencyGroup` field now has `choices` (the 8 fixed group names, `core/proficiencies/weapon.ts`'s `WEAPON_PROFICIENCY_GROUPS`), rendered as a dropdown by the shared raw item sheet — no more typos. A pre-existing/hand-made proficiency with a blank group still behaves exactly as before (full non-proficiency penalty, no specialization-category-without-owning) until a GM picks its group from the row's ✎ control, same workflow as before — just foolproof now instead of exact-case free text. No pack-file changes or migration: an existing blank or mismatched group loads unchanged (Foundry only enforces `choices` on a new save, not on load).
- **Weapon proficiencies previously matched a weapon item by exact display-name string, breaking on a renamed/magic weapon, and required owning a matching weapon just to resolve a specialization category.** Fixed: `WeaponItemModel` gained a `baseWeaponName` field (blank falls back to the item's own `name` — every pre-existing weapon is unaffected until renamed) that `resolveProficiencyModifier`/`resolveWeaponCategory`/`resolveCategory` now match against instead of the raw display name; and `resolveWeaponCategory` now derives the Advance Mastery button's category from the proficiency's own `proficiencyGroup` (Sub-project 8b's 8 fixed names) first, so a fighter can choose to specialize in a weapon type before ever owning one, falling back to the old owned-weapon lookup only for a pre-8b/hand-made proficiency with no group set.
- **Skills & Powers scope left out of Sub-project 8.** A custom-class builder, character kits and per-level character-point awards (the pool is a creation budget only), plus the expanded-proficiency options offered but not selected: a larger non-weapon proficiency list, secondary-ability checks, and wiring the `weaponProficienciesUsed`/`nonweaponProficienciesUsed` toggles.
- **Sub-scores and traits are invisible on the NPC's own sheet.** The shared derivation applies them to NPCs (hand-set sub-scores, or traits added while the NPC was switched to the full PC sheet), but the streamlined NPC sheet shows neither. The NPC sheet rejects trait drops; the full PC sheet, when selected for an NPC, does not.
- **Trait ability bonuses show inside the ability row's "racial" delta,** and the exceptional-Strength percentile input keys off the authored score, so STR 17 + Powerful prepares as 18 without the percentile input (the same as a racial +1 today). Cosmetic.
- **Sub-score character-point refunds are uncapped** (a sub-score of 9 or less refunds CP), exactly as specced; only disadvantage traits share the 10-point refund cap. A trait dropped onto a creature sheet is inert.
- **Spell points and channelers are not implemented.** They come from *Player's Option: Spells & Magic*, which isn't in this project's references; their toggles stay registered with "not implemented" hints. Also parked from Sub-project 9: spell mishaps, the Table 56 innate-ability/magic-item initiative modifiers, casting time for creature stat blocks, and structured casting-time fields (only the free-text Casting Time is parsed: a bare number, "N rounds" or "N turns"; anything else casts immediately).
- **Sheet redesign follow-ups (all three sheets).** The redesign (PC, Character NPC and Monster NPC) is complete as of Plan R3. On the Character NPC sheet, Award XP, dual-class, thief-point allocation, sub-ability seeding and traits are deliberately PC-only. To get them for an NPC, switch it to the full PC sheet in Sheet Configuration. The Monster NPC sheet has no favorites (★) by design — its attacks are already one click from the Stat Block tab. Also:
  - Clicking an item's name shows its stats but no prose description, and it prints raw values such as `chain-mail` or `piercing-slashing` because there's no label map.
  - A weapon with no damage dice shows a bare ` / `.
  - Deleted items stay in the favorites flag. They're hidden from the panel but not pruned.
  - A non-owner observer's inventory filter box is disabled by Foundry's read-only form handling.
  - Expanded item summaries collapse on every re-render.
  - When unlocked, the exceptional-Strength input is the same size as the score input.
  - A Monster NPC's locked stat-block view doesn't show the derived-vs-authored AC distinction that THAC0 and saves show; unlock to see the authored value.
  - The Monster NPC sheet's nothing-lost binding test doesn't assert that unlock-only fields are actually gated on the lock (a manual whole-branch-review check found they are; a future test could assert it directly).
- **Casting-time rough edges.** A segment spell's initiative addition stays until initiative is re-rolled; a round spell can be completed at any point during its final round (honor system); a combatant removed from a running combat keeps its casting state until the GM cancels it; near-simultaneous disruptions can post two "spell lost" cards. Automatic disruption needs a GM connected.
