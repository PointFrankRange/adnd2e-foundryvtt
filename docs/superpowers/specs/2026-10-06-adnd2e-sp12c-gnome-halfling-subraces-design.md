# Gnome and halfling subraces, Plan C (flat save bonus + eleven subraces) — Design

Date: 2026-10-06. Source: the 2026-09 mechanics review, Tier 0 ("Generic subrace architecture") and the Plan A engine (`2026-10-06-adnd2e-sp12a-subrace-architecture-design.md`, PR #78); *The Complete Book of Gnomes and Halflings* (PHBR9) ch. 2 "Gnome Subraces" pp. 20-37 (Tables 1-4) and "Halfling Subraces" pp. 66-77 (Tables 5-10), read from the text layer (the Tallfellow table from the page image). Sub-project 12, Plan C (the last content plan; Plan B shipped the elves, PR #79).

## Rules source (PHBR9)

Each subrace lists ability adjustments, a per-ability minimum and maximum (Tables 1-10), languages, infravision, and special features. The book states **no XP costs, level limits or class restrictions** for any of them (apart from extra Dark Sun classes for the Athasian halfling), so they inherit the PHB Gnome and Halfling data. Two features need the engine:

- **Deep Gnomes** (Svirfneblin) "gain a +3 bonus to all saving throws except those against poison (for which they receive a +2 bonus instead)". This is a flat bonus, not the Constitution-based racial bonus Plan A supports.
- **Stout** halflings get "+1 to either Dexterity or Constitution" and **Tallfellow** halflings "+1 to either Dexterity or Wisdom" (a player's choice).

## Approved decisions

- **Engine extension:** an optional `flatSaveBonus` on the subrace layer (`{ all, poison }` or null). When set it **replaces** the race's Constitution-based save bonus.
- **"Either/or" choices become two items each:** "Stout (Dexterity)" and "Stout (Constitution)", "Tallfellow (Dexterity)" and "Tallfellow (Wisdom)". No choice mechanism.
- **Content:** four gnome subraces (Rock, Deep, Tinker, Forest) and seven halfling items (Hairfoot, Stout x2, Tallfellow x2, Furchin, Kender): 11 new `race` items; the races pack goes from 17 to 28. **Rock Gnome** and **Hairfoot** ship as their own items because their ranges and infravision differ slightly from the PHB items (the PHB Gnome and Halfling stay).
- **Specials are display labels only** (magic resistance, innate spells, AC per level, freeze in place, stun darts, Kender fearlessness and taunt, Furchin cold bonus, and the like).
- **The Athasian halfling is not shipped.** It is Dark Sun-only (setting-specific classes). The user plans to implement Dark Sun later, either as an option in this repo or as an add-on module; Dark Sun-only content stays separable and out of the core pack.

## Engine: flat saving-throw bonus

`SubraceLayer` (`src/core/races/subrace.ts`) gains `flatSaveBonus: { all: number; poison: number } | null` (`NO_SUBRACE` has `null`).

- `normalizeSubrace` reads it leniently: a non-object, or a value missing either integer, is `null`.
- A new pure `racialSaveModifier(input)` in `src/core/saves/racial.ts` is the single place the racial save modifier is decided: `{ race, category, con, tags?, conAdjustment?, flat? }`. When `flat` is set it returns `flat.poison` for a poison-tagged `ppd` save and `flat.all` for every other category (a poison-tagged save is the existing `ppd`-with-`poison`-tag case); it does NOT add the Constitution bonus. When `flat` is null it returns `racialSaveBonus(race, category, con, tags, conAdjustment)` exactly as today. `racialSaveBonus` itself is unchanged.
- The save composer (`saveTargetBest` / `saveTarget`, `src/core/saves/composer.ts`) gains an optional `racialFlatSaveBonus?: { all: number; poison: number } | null` on both inputs and calls `racialSaveModifier`; the result is still reported in `breakdown.racialConBonus` (its doc comment is updated to say it is the racial save modifier). `deriveSaves` / `SavesInput` (`src/data/derive/character/saves.ts`) and both `deriveSaves` call sites in `derive.ts` pass `snapshot.raceLayer?.flatSaveBonus ?? null`.
- The cached baseline save block is untagged, so a Deep Gnome shows +3 on every save; the poison value applies where a poison tag is supplied (the core already supports tags; no sheet roll supplies them today).

## Schema

`RaceItemModel.subrace` (`src/data/item/race.ts`) gains `flatSaveBonus`: a SchemaField `{ all: integer, poison: integer }` (defaults 0) declared `{ required: true, nullable: true, initial: null }`, the same nullable-SchemaField precedent as `abilityAdjustments`. Existing items clean to `null`; no migration. No object or array literal `initial`.

## Content: eleven race items (mechanical data only)

Each item: `raceId` is the base PHB race (`gnome` or `halfling`), `size: "small"`, `baseMovement: 6`, `description: ""`; `allowedClasses`, `allowedMulticlass` and `classLevelLimits` COPIED from the PHB item of that race (`packs/races/_source/gnome.json` / `halfling.json`); `subrace.thiefAdjustments: null` (inherit); `conSaveBonusAdjustment: 0`; `xpModifierPercent: 0`; `grantedFeatures` are short labels with no rule numbers. Ids are 16 characters.

| Item | Adjustments | Min-max (str, dex, con, int, wis, cha) | Infravision | Flat save |
|---|---|---|---|---|
| Rock Gnome | int +1, wis -1 | 6-18, 3-18, 8-18, 7-19, 3-17, 3-18 | 60 | null |
| Deep Gnome | dex +1, wis +1, int -1, cha -2 | 6-18, 6-19, 6-18, 3-17, 4-18, 3-16 | 120 | all 3, poison 2 |
| Tinker Gnome | dex +2, str -1, wis -1 | 6-18, 8-18, 8-18, 8-18, 3-12, 3-18 | 60 | null |
| Forest Gnome | dex +1, wis +1, str -1, int -1 | 3-17, 8-19, 8-18, 3-17, 6-18, 3-18 | 0 | null |
| Hairfoot | str -1, dex +1 | 3-17, 8-19, 10-18, 6-18, 3-18, 7-18 | 0 | null |
| Stout (Dexterity) | str -1, dex +1 | 5-17, 8-19, 10-19, 6-18, 3-18, 5-18 | 60 | null |
| Stout (Constitution) | str -1, con +1 | 5-17, 8-19, 10-19, 6-18, 3-18, 5-18 | 60 | null |
| Tallfellow (Dexterity) | str -1, dex +1 | 3-17, 8-19, 10-18, 6-18, 7-19, 5-18 | 0 | null |
| Tallfellow (Wisdom) | str -1, wis +1 | 3-17, 8-19, 10-18, 6-18, 7-19, 5-18 | 0 | null |
| Furchin | con +1, dex +1, str -1, wis -1 | 3-17, 8-19, 10-19, 6-18, 3-17, 7-18 | 0 | null |
| Kender | dex +2, str -1 | 6-16, 8-19, 10-18, 6-18, 3-16, 6-18 | 30 | null |

`subrace.id` values: `rock-gnome`, `deep-gnome`, `tinker-gnome`, `forest-gnome`, `hairfoot`, `stout-dex`, `stout-con`, `tallfellow-dex`, `tallfellow-wis`, `furchin`, `kender`. Ids: `kGnomeRock000001`, `kGnomeDeep000001`, `kGnomeTinker0001`, `kGnomeForest0001`, `kHalfHairfoot001`, `kHalfStoutDex001`, `kHalfStoutCon001`, `kHalfTallDex0001`, `kHalfTallWis0001`, `kHalfFurchin0001`, `kHalfKender00001`.

`bonusLanguages` (the subrace's own tongue excluded): Rock: common, dwarf, halfling, kobold, goblin, burrowing animal. Deep: gnome common, underworld common, drow, kuo-toan, earth elemental. Tinker: gnome common, any human language. Forest: gnome common, elf, treant, forest mammal. Hairfoot: any human language. Stout (both): dwarvish. Tallfellow (both): elvish. Furchin: dwarvish. Kender: krynn common.

`grantedFeatures` (labels only): Rock: none. Deep: "Deep gnome: magic resistance", "Deep gnome: innate illusions", "Deep gnome: freeze in place", "Deep gnome: surprise bonuses", "Deep gnome: improving armor class", "Deep gnome: stun darts". Tinker: "Tinker: unreliable inventions". Forest: "Forest gnome: pass without trace", "Forest gnome: hide in woods", "Forest gnome: armor class bonus vs larger foes". Hairfoot: "Hairfoot: reaction bonus with humans". Stout (both): "Stout: underground detection". Tallfellow (both): "Tallfellow: secret door detection", "Tallfellow: woodland surprise bonus". Furchin: "Furchin: cold-weather survival", "Furchin: cold save bonus", "Furchin: armor class bonus vs larger foes". Kender: "Kender: fearless", "Kender: the taunt", "Kender: natural thieving talent".

## Out of scope

- The Athasian halfling and any Dark Sun content (recorded for later).
- Automating any special (magic resistance, innate spells, AC improvement, freeze in place, stun darts, fearlessness, taunt, cold save bonus) and the Gnome subraces' racial combat bonuses.
- A choice mechanism for "either/or" adjustments.
- Enforcing level limits.

## Testing

- Pure tests: `normalizeSubrace` with `flatSaveBonus` (valid, missing a key, non-object, absent); `racialSaveModifier` (flat set returns all/poison and never adds Constitution; a poison-tagged `ppd` uses the poison value; flat null equals today's `racialSaveBonus` for every race and category; `conAdjustment` still applies only on the Constitution path); `saveTargetBest` / `saveTarget` with `racialFlatSaveBonus`. Existing Plan A tests that build `SubraceLayer` literals gain `flatSaveBonus: null`.
- Derive tests: `deriveCharacter` for a Deep Gnome snapshot (+3 on all five untagged saves, versus a Rock Gnome with the Constitution-based bonus), and null layers unchanged.
- Content test: every new item against the table above (adjustments, ranges, infravision, flat save, languages), the copied class data, 28 items in the pack, unique names, 16-character ids.
- The four CI commands (`npm run typecheck`, `lint`, `test:coverage`, `build`); schema, drift and lang tests; the pack builds with 28 documents.
- Headless proof (the repo's Foundry-in-Node harness): real schema validation and clean defaults for all 28 items (including pre-existing ones without `flatSaveBonus`); the real save derive for a Deep Gnome and a Forest Gnome; real ability adjustments and range-warning computation for the Stout and Tallfellow variants; XP surcharge stays 0.
- Manual (the user, after closing Foundry for the rebuild), including a non-GM player seat: drop Deep Gnome and read the saves (+3 on each, versus a Rock Gnome with a Constitution-based bonus on rod/staff/wand and spell only); drop Stout (Constitution) and see Con +1; the out-of-range toast for a Forest Gnome with low Dexterity.
