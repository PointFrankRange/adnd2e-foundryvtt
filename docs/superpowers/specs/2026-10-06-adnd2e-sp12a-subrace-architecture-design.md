# Subrace architecture, Plan A (engine + the six dwarf subraces) — Design

Date: 2026-10-06. Source: the 2026-09 mechanics review, Tier 0 ("Generic subrace architecture", `docs/mechanics-review-2026-09.md`); *The Complete Book of Dwarves* (PHBR6) ch. 4 "Character Creation" pp. 28-36 (text layer) and the subrace thieving-skill table p. 36 (page image). Sub-project 12 of the review, Plan A. Plan B (elf subraces, PHBR8) and Plan C (gnome and halfling subraces, PHBR9) are later content plans on this engine.

## Rules source (PHBR6 pp. 28-36)

Each dwarf subrace is one bundle: ability adjustments; a per-ability minimum and maximum; languages; infravision; special advantages and disadvantages; racial enmities; an additional XP cost ("+10% means the character must earn an additional 10% experience points to increase in level", applied to every class of a multiclass character); life expectancy; class level limits per subrace (warrior / priest / rogue); a subrace thieving-skill table; and a Constitution saving-throw bonus (deep dwarves add +1 to it). All dwarves are warriors, priests, thieves, or warrior/priest and warrior/thief multiclass.

## Approved decisions

- **A subrace is a `race` item with a `subrace` layer.** `raceId` stays the base PHB race (`dwarf`), so every existing consumer, including kit race qualifications, keeps working. The six PHB race items and every existing character are untouched; every new field defaults to "inherit".
- **Mechanics covered:** ability adjustments and per-ability min/max; extra XP cost percent; level limits (data the race item already carries); thieving-skill adjustments; the Constitution save bonus adjustment. Special advantages and disadvantages are **display text only** (the existing `grantedFeatures`); enmities, innate powers and bespoke specials are not automated.
- **XP surcharge stacks additively with a kit's XP percentage** (+10% subrace and +20% kit = +30%), through one helper, so Sub-project 13 reuses it.
- **Content:** the engine plus all six dwarf subraces. Elves (Plan B) and gnomes and halflings (Plan C) follow.
- **Applies to any actor with a race item** (PC and Character NPC); no new sheet actions.

## Data model

`RaceItemModel` (`src/data/item/race.ts`) gains `subrace` (SchemaField):

- `id`: string, blank means "no subrace".
- `abilityAdjustments`: nullable SchemaField of six integers (`str`..`cha`); `null` inherits the base race's table.
- `abilityRanges`: nullable SchemaField of six `{ min, max }` integer pairs (0-25); `null` inherits.
- `thiefAdjustments`: nullable SchemaField of the eight thief skills (integers); `null` inherits.
- `conSaveBonusAdjustment`: integer, default 0. Added to the Constitution save bonus only where the base race already receives it.
- `xpModifierPercent`: integer, min -90, default 0.

Nullable SchemaFields follow the existing `uses` precedent on `classFeature`. Size, movement, infravision, languages, level limits, allowed classes and multiclass pairs already exist on the race item; a subrace item sets them.

## Rules core: `src/core/races/subrace.ts` (pure, unit-tested)

- `SubraceLayer` type; `normalizeSubrace(raw)` reads leniently: any malformed field falls back to "inherit".
- `effectiveAbilityAdjustments(race, layer)`, `effectiveAbilityRanges(race, layer)`, `effectiveThiefAdjustments(race, layer)`: the layered table, falling back to the existing `RACIAL_ABILITY_ADJUSTMENTS`, `RACIAL_ABILITY_LIMITS` and `THIEF_RACIAL_ADJUSTMENTS`.
- `abilityRangeProblems(scores, ranges)`: the abilities that fall outside their min/max.
- `combineXpPercent(kitPercent, racePercent)`: their sum.
- Existing helpers gain an optional override parameter so no current caller changes: `applyRacialDeltas(raw, race, adjustments?)`, the thief skill math (an optional racial adjustment table), and `racialSaveBonus(race, category, con, tags, extra = 0)` where `extra` is added only when the race qualifies.

## Plumbing

- **Ability scores:** `applyRacialAdjustment` (`src/data/actor/base-actor.ts`) reads the race item's `subrace` layer and applies `effectiveAbilityAdjustments`.
- **Snapshot:** `ActorSnapshot` gains `raceLayer` (the normalized layer or `null`), built in `src/data/actor/snapshot.ts` from the race item. `deriveCharacter` passes it to the saves and thief-skill derivations.
- **XP:** a new `actorXpPercentFor(items, chassisId)` in `src/data/derive/character/kits.ts` returns `combineXpPercent(kit percent for the chassis, the race item's subrace percent)`. It replaces the seven call sites that read `kitXpPercentFor(activeKitEntries(...), chassisId)`: `src/data/actor/snapshot.ts`, `src/data/item/class.ts`, `src/sheets/character/combat-rolls.ts`, `src/sheets/character/proficiency-actions.ts`, the class view in `src/sheets/character/sheet.ts`, and the two level lookups in `src/sheets/character/spell-actions.ts`. Every level threshold, level-up check and multiclass class gets the surcharge from that one helper.
- **Ability ranges:** data, plus a non-blocking warning toast when a race item with `abilityRanges` is dropped and the character's authored scores plus that subrace's adjustments fall outside the ranges (`abilityRangeProblems`). The book lets scores drift after creation, so nothing is enforced later.
- **Level limits** remain data only today; this plan does not enforce them.

## Sheet

The race row already shows the item's name ("Deep Dwarf"). The racial Features panel lists the item's `grantedFeatures` labels and, when the subrace XP percent is non-zero, one line "XP per level: +N%". No new actions; PC sheet and Character NPC use the same race item.

## Content: six dwarf subraces in the `races` pack

Mechanical values only (`description` stays `""`). Each is a `race` item with `raceId: "dwarf"`, `size: "small"`, `baseMovement: 6`, the PHB dwarf's `allowedClasses` and `allowedMulticlass`, and a `subrace` block.

| Subrace | Ability adjustments | Min-max (str, dex, con, int, wis, cha) | Infravision | XP | Con save adj | Level limits (fighter / cleric / thief) |
|---|---|---|---|---|---|---|
| Hill | Con +1, Cha -1 | 8-18, 3-17, 11-18, 3-18, 3-18, 3-17 | 60 | 0 | 0 | 15 / 10 / 12 |
| Mountain | Con +1, Cha -1 | 8-18, 3-17, 11-19, 3-18, 3-18, 3-16 | 60 | 0 | 0 | 16 / 10 / 12 |
| Deep | Con +2, Cha -2 | 8-18, 3-16, 13-19, 3-18, 3-18, 3-15 | 90 | +10 | +1 | 14 / 12 / 10 |
| Duergar | Con +1, Cha -2 | 8-18, 3-17, 11-18, 3-16, 3-18, 3-15 | 120 | +20 | 0 | 12 / 12 / 14 |
| Sundered | Str +1, Con +1, Cha -1 | 8-18, 3-17, 11-18, 3-16, 3-18, 3-16 | 30 | 0 | 0 | 14 / 10 / 15 |
| Gully | Str +1, Dex +1, Cha -2 | 6-18, 6-18, 8-16, 3-12, 3-14, 3-12 | 60 | 0 | 0 | 8 / 8 / 16 |

Thieving-skill adjustments (pick pockets, open locks, find/remove traps, move silently, hide in shadows, detect noise, climb walls, read languages):

- Hill and Mountain: 0, +10, +15, 0, 0, 0, -10, -5 (equal to the PHB dwarf).
- Deep: +5, 0, +10, 0, +5, 0, -10, -15.
- Duergar: +5, 0, +10, +10, +5, +10, -10, -15.
- Sundered: 0, +5, +10, +5, +5, 0, 0, -10.
- Gully: +10, -5, +5, 0, -5, 0, -5, -25.

Languages (the existing `bonusLanguages` list, the subrace's own tongue excluded): hill: gnome, goblin, kobold, orc; mountain: gnome, goblin, kobold, orc, ogre, troll; deep: duergar, drow, illithid, kua-toa, troll, troglodyte, svirfneblin, undercommon; duergar: deep dwarf, drow, illithid, kua-toa, troll, troglodyte, undercommon; sundered: elf, goblin, orc, gnome, kobold, halfling, hobgoblin; gully: gnome, orc, goblin.

`grantedFeatures` carries short labels only (names, no rule prose), for example "Deep dwarf: -1 in bright light", "Duergar: stealthy (surprise bonus)", "Duergar: innate enlarge and invisibility", "Sundered: claustrophobia", "Gully: groveling".

## Out of scope

- Elf subraces (Plan B) and gnome and halfling subraces (Plan C).
- Automating enmities, innate powers, surprise bonuses, light penalties, claustrophobia, groveling or magic-item malfunction chances.
- Enforcing level limits; general level adjustment and monstrous races (Sub-project 13).
- Any change to kit race qualifications (they keep matching the base race).

## Testing

- Pure tests: `normalizeSubrace` (valid, malformed, null), the three `effective*` functions (inherit versus override, every base race), `abilityRangeProblems`, `combineXpPercent`, the new optional parameters on the existing helpers (default behavior unchanged), and `racialSaveBonus` with `extra` (applies only to qualifying races and categories).
- Derive tests: `deriveCharacter` with a deep-dwarf layer (Constitution save bonus +1, thief skills), ability adjustment through `applyRacialAdjustment`, and XP thresholds with kit plus subrace stacking at each of the seven call sites' shared helper.
- Content test: every dwarf subrace item against the table above (adjustments, ranges, infravision, XP, limits, thief rows, languages), schema vocabularies, unique ids.
- Schema, drift and lang tests; the pack builds with 12 race items; the four CI commands (`npm run typecheck`, `lint`, `test:coverage`, `build`) pass.
- Headless proof (the repo's Foundry-in-Node harness): real schema validation and defaults for all race items, including pre-existing items without `subrace`; the real ability, save, thief and XP derive for each subrace; the XP helper at its call sites; the drop warning for an out-of-range character.
- Manual (the user), including a **non-GM player seat**: drop a subrace and see the adjusted scores, the XP-per-level line and the toast for an out-of-range character; a multiclass dwarf's XP thresholds with a kit.
