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

- **A relayed disarm against an unarmed Monster NPC logs "applied a disarm" though nothing changed** (the monster has no equipped weapon item). Harmless; the log could say so.
- **Monster NPC bows and crossbows still deal no damage.** Ammunition is now modeled for PCs (arrow/bolt items, S-M / L damage, selected per weapon and consumed on every shot, hit or miss) but Monster NPC ranged attacks keep using the existing flat weapon-damage formula, unaffected — a deliberate v1 scope boundary, matching how Monster NPC weapon attacks are already simpler than PC ones elsewhere.
- **Monster NPC weapon attacks are simpler than PC ones:** they skip the Combat & Tactics weapon-vs-armor modifier against an armored target, and a "weapon drops" fumble doesn't unequip the monster's weapon (both deliberate v1 scope).
- **A typo in a weapon's damage dice (e.g. `1d8+`) isn't caught:** the attack card posts but the damage roll errors silently — on both PC and Monster NPC attacks. A try/catch with a warning toast would fix it.
- **Grand Mastery's extra attack per round is never wired into any roll.** `weaponMasteryEffect` computes `extraAttacks: 1` at Grand Mastery (tier 3), but nothing reads it — a player has no way to declare or roll the second attack. (The sibling gap, the specialization/mastery damage bonus, was wired into "Roll Damage" — see `resolveProficiencyModifier`'s `damage` half and `chat-listeners.ts`'s `onRollDamage`.) A candidate fix would need new per-round attack-count UI, likely alongside the pre-existing fighter-specialist "attacks per round" table (`core/weapons/specialist-attacks.ts`), which has the same kind of gap already.
- **The full Combat & Tactics maneuver list beyond the curated 4 remains parked.** Sub-project 7 ships only disarm, knock down/trip, grapple, and bull rush (plus 3 called-shot locations), unified as an attack roll with a penalty and an on-hit effect — a deliberate simplification of the book's varied per-maneuver mechanics (some opposed ability checks). The remaining maneuvers are a candidate for a future revisit (spec §7).
- **Conditions have no duration or automatic expiry.** Stunned, held, and prone (applied by called shots and maneuvers, or by hand from the Token HUD) stay until a GM clears them manually. Grapple's `held` (blocks the target from acting and grants all attackers +4) is the strongest of these for its −2 cost, which the plan's value table under-priced; surfaced in the setting hints rather than re-balanced. A round-based expiry mechanism would be the proper fix, and would also let the 11 flavor-only conditions gain mechanics.
- **Expanded proficiencies: pre-existing and hand-made proficiencies start with no group.** The related-weapon penalty matches on a proficiency's `proficiencyGroup`, which only the `weapon-proficiencies` pack items carry pre-set; a proficiency created before Plan 8b or by hand has an empty group and behaves as before (full non-proficiency penalty) until its group is set — open it with the row's ✎ control and fill in Proficiency Group. A future improvement could fall back to the group of the owned weapon with the same name.
- **Duplicate weapon-proficiency drops aren't guarded.** Dropping a proficiency the actor already holds creates a second copy and charges a second slot (pre-existing since Sub-project 5a).
- **A weapon's `proficiencyGroup` is free text.** Related-weapon matching needs the exact group name including case (e.g. `Blades`); a dropdown limited to the 8 group names would prevent typos.
- **A specific-weapon proficiency matches its weapon item by exact display-name string, so a renamed or magic weapon (e.g. "Long Sword +1") never matches a "Long Sword" proficiency.** Both `context.ts`'s `resolveWeaponCategory` (gates the Advance Mastery button) and `combat-rolls.ts`'s `resolveProficiencyModifier` (applies the to-hit/damage bonus at roll time) do `weapon.name === prof.weaponOrGroup`. There's no separate base-weapon-type field distinct from the item's freeform `name`, so a mismatched name silently falls through to a *group* proficiency match (if held) or non-proficient — the specific-weapon proficiency bonus (including any specialization/mastery tier) just doesn't apply, with no warning. A GROUP proficiency is unaffected (it matches on the weapon's `proficiencyGroup` field, not its name). Found while testing the specialization damage bonus (PR #43) with a "+1" weapon name. A proper fix needs a base-weapon-type identifier independent of display name, touching both the eligibility check and the roll-time resolver. **Related design gap, same discovery:** `buildWeaponProfRow`'s `eligible` check also requires an owned matching weapon item just to resolve a `category` (melee/bow/crossbow) for the Advance Mastery button — so a fighter can't specialize in a weapon type at all until they own a copy of it. Per PHB 2E, specialization is chosen at character creation/level-up independent of current inventory; owning zero, one, or several of that weapon type shouldn't gate the CHOICE, only whether the bonus has anything to apply to in play. A proper fix separates "which weapon type is this specific-weapon proficiency for" (its own field, not derived from an owned item's category) from "is a matching weapon currently equipped" (still needed at roll time for the bonus to functionally apply) — likely the same base-weapon-type identifier fix above would resolve both at once.
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
