# Sub-project 21: Humanoid player races — design

Date: 2026-10-12 · Issue: #89 · Branch: `feat/sp21-humanoid-races` · Source: The Complete Book of Humanoids (PHBR10), Humanoid Characters ch. pp.7-10 (Tables 1-2, "Exceeding Level Limits") and the Humanoid Races ch. entries pp.15-61. PDF page = printed page + 1; the PDF is scanned, so entries are read from rendered page images (`pdftoppm -r 100`), not OCR.

## Background

PHBR10 makes about thirty monstrous races playable: aarakocra, alaghi, beastman, bugbear, bullywug, centaur, fremlin, giant-kin (firbolg, voadkyn), gnoll (gnoll, flind), goblin, hobgoblin, kobold, lizard man, minotaur, mongrelman, ogre, half-ogre, ogre mage, orc, half-orc, pixie, satyr, saurial (bladeback, finback, flyer, hornhead), swanmay and wemic — the thirty rows of Table 1. Each entry gives ability adjustments and per-ability minimums and maximums, per-class maximum levels (Table 1, with the class lists in each entry), natural armor class, hit dice (player characters use hit dice by class), size, movement, infravision, an XP surcharge, special advantages and disadvantages, monstrous traits, kit lists and starting proficiencies. Humanoid characters may exceed their limits at a 2-4x XP cost (already supported by the SP13 setting) and single-classed humanoids may gain bonus levels (Table 2).

The system has a `race` item (SP5-SP13) with a closed six-value `raceId`, code tables keyed by those six ids (ability adjustments and ranges, thief adjustments, Con-based saves, sleep/charm resistance), a subrace layer (SP12) that overrides the ability tables, thief adjustments, XP percent and a flat save per item, the XP-percent plumbing (`actorXpPercentFor`), the level-limit engine (SP13: `classLevelLimits` read from the race item), and a non-blocking ability-range warning on drop.

## Decisions (made with the user)

- **Scope A — the race data layer only.** Ability adjustments and ranges, class eligibility, level limits, multi-class options, XP surcharge, size, movement, infravision, natural AC, bonus languages. Special advantages and disadvantages (flight, natural weapons, innate spells, size penalties) are listed as terse feature labels and not automated.
- **Architecture B — data-driven races.** `raceId` is any slug; the race item is the source of truth; the six PHB races' code tables stay as defaults; every reader of a `Race`-keyed table goes through an effective lookup with safe defaults for unknown races.
- **Natural AC — option A, refined to the book's rule (PHBR10 p.15).** A race may set a natural AC. It replaces the unarmored base 10. Worn armor rated better than the natural AC sets the base to its own rating; worn armor rated equal or worse still gives +1 protection, so the base is the natural AC minus 1 (a lizard man, natural AC 5, in studded leather is AC 4; in plate mail, AC 3). Dexterity does not count toward the natural AC itself but applies on top as usual, as do shield and magic bonuses.
- **Priest options — option B.** Where a race's only priest option is a Chapter 3 humanoid priest kit (Shaman, Witch Doctor), the race gets no priest class for now; the book's limit is kept in a note on the race. The Chapter 3 kits are a later sub-project.

## Design

### 1. Race identity becomes data-driven

- `Race` in `src/core/types.ts` widens: `PhbRace` is the six PHB literals (the keys of the code tables), `Race = string`. `RACE_IDS` in `src/data/item/choices.ts` stays the core six and keeps a name that says so (`PHB_RACE_IDS`), no longer the schema's `choices` for `raceId`.
- `raceId` on the race item is a required, non-blank slug string (lowercase letters, digits and hyphens; validated by the schema's `validate`), defaulting to `"human"`. `kit.qualifications.races` becomes a free-slug array the same way. Existing items need no migration.
- New pure helpers in `src/core/races/` (the effective lookups), each taking `(race: Race, layer)` and returning the layer's table when set, else the code table for a PHB race, else the safe default:
  - `effectiveAbilityAdjustments` — default `{}`.
  - `effectiveAbilityRanges` — default 3-18 for every ability.
  - `effectiveThiefAdjustments` — default all zero.
  - `racialSaveCategories(race)` — default none (no Con-based bonus).
  - `sleepCharmResistance(race)` — default 0.
  The existing SP12 functions in `subrace.ts` are changed in place to do this, so every current caller gets the safe default without edits.
- Callers read `raceId` as a plain string and index code tables only through the effective helpers: `src/core/abilities/racial-adjustments.ts` (the `Record<Race, …>` tables become `Record<PhbRace, …>` and their direct indexing is replaced by the helpers), `src/core/proficiencies/thief-skills.ts`, `src/core/saves/racial.ts` and `composer.ts`, `src/core/kits/qualifications.ts`, `src/data/derive/character/saves.ts`, `src/sheets/character/context.ts`, `proficiency-actions.ts`, `subrace-warning.ts`, `psionic-wild.ts` (already compares to `"human"`), the actor snapshot types. The implementation plan lists the exact call sites after a full grep; a census test fails if a direct `RACIAL_… [race]` index remains outside the helpers.
- A humanoid race item uses the existing `subrace` block as its own layer (`abilityAdjustments`, `abilityRanges`, `xpModifierPercent`), with `subrace.id` blank and `subrace.displayName` blank (the item name shows). No rename of the block (it would need a migration); the manifest and the schema comment say that for a non-PHB `raceId` the block is the race's own layer.

### 2. Race data

- New nullable field `naturalAc` on the race item: an integer from -10 to 10, `null` = none (the six PHB races and any race the book gives no natural AC). A nullable SchemaField/NumberField with `nullable: true, initial: null` (the same presence-signal pattern as `abilityAdjustments`).
- Pure `effectiveBaseArmorAc(armorAc: number, naturalAc: number | null): number`: `naturalAc === null` → `armorAc`; armor rated 10 or worse (none) → `naturalAc`; armor rated better than `naturalAc` (a lower number) → `armorAc`; otherwise `Math.max(-10, naturalAc - 1)`. Applied where the character derive builds `baseArmorAc` for `armorClass()` (`src/core/combat/armor-class.ts` is unchanged; the derive passes the lowered base). Dexterity, shield, magic and situational terms apply as before. The AC tooltip on the sheet shows the natural AC as the base source when it won.
- Each of the thirty entries supplies: `size`, `baseMovement`, `infravision`, `classLevelLimits` (Table 1, plus any per-class limit in the entry for classes that map to a chassis), `allowedClasses`, `allowedMulticlass`, `bonusLanguages`, `subrace.abilityAdjustments`, `subrace.abilityRanges`, `subrace.xpModifierPercent` (the entry's XP surcharge or reduction), `naturalAc`, and `grantedFeatures` (terse labels such as `Flight 18 (maneuverability C)`; no rulebook prose).
- Class mapping: Table 1 columns Wr/Wz/Pr/Rg and the entry class lists map onto this system's chassis ids (fighter, ranger, paladin, mage, cleric, druid, thief, bard; illusionist and the other specialists are mage specialists). Entries list classes this system has no chassis for (Shaman, Witch Doctor, Oracle and the other Chapter 3 priest roles); those are not given a priest chassis (see decisions) and their limit is recorded in a `grantedFeatures` note such as `Shaman (kit) max level 7`. Races whose entry allows a normal Cleric or Druid keep that chassis.
- Saves: unknown races have no Con-based bonus. An entry that lists a racial saving-throw bonus uses the existing flat-save field (`subrace.flatSaveBonus`) where its shape fits (`all` / `poison`); any other save rule becomes a feature label.
- Movement modes (flight, swim, burrow) are feature labels with the rate, not a stat on the sheet; `baseMovement` is the land rate.

### 3. Pack and surface

- Thirty race items in `packs/races/_source`, one per Table 1 row, named after the entry ("Aarakocra", "Giant-kin, Firbolg", "Giant-kin, Voadkyn", "Gnoll, Flind", "Ogre, Half-", "Orc, Half-", "Saurial, Bladeback"). Names sort next to the PHB races; the manifest `packs/races/_source/_MANIFEST.md` gains the PHBR10 page table (printed page, PDF page, what was read), the class-mapping note, and the Shaman/Witch Doctor deferral. The pack count in the manifest and the `tests/packs/content.test.ts` census go from 28 to 58.
- No sheet redesign: the race slot, the ability-range warning (non-blocking, already uses the effective ranges), the level-limit tag on the class row and the XP-percent plumbing all work through the existing paths.
- `lang`: any new label (the AC tooltip source line) is added to `lang/en.json`.

### 4. Out of scope

The Chapter 3 humanoid kits (including the Shaman and Witch Doctor priest kits); Chapters 4-5 proficiencies, monstrous traits and superstitions; a natural-attack, flight or innate-spell engine; Table 2 humanoid bonus levels (the SP13 prime-requisite setting keeps the Dwarves table for now); hit-dice quirks (player characters use class hit dice); per-race starting weapon and nonweapon proficiency lists; the rule that only swanmays benefit from *raise dead*; Dark Sun.

## Testing

- Unit tests for the effective lookups with a PHB race, a race with a layer and an unknown race with and without a layer (adjustments, ranges, thief, saves, sleep/charm), the slug validator, and `effectiveBaseArmorAc` (null; no armor; armor better than natural; armor equal; armor worse; the lizard man examples AC 4 and AC 3; the -10 floor).
- A census test that no code table is indexed directly by race outside the helpers (a source grep, like the existing census tests).
- Derive tests: a natural-AC race unarmored, with armor rated worse, equal and better than the natural AC, with a shield, Dexterity and magic; an unknown race with no layer (safe defaults); the six PHB races unchanged (existing tests stay green).
- Pack tests: every one of the thirty items validates against the real `RaceItemModel` schema; each Table 1 row matches its item's `classLevelLimits` (a table in the test, transcribed independently from the item JSON, so a transcription slip fails); every `allowedClasses` entry is a real chassis; every ability range has min <= max and lies within 3-25; ids are unique slugs; no priest chassis on the deferred-kit races.
- Headless proof against the real data models: load several shipped humanoids (an aarakocra with natural AC 7 and a flight label, a half-ogre, a centaur, a saurial) and run the real derive for an unarmored and an armored character; the ability-range warning; the level limit with and without the exceed setting; a kit gated on a humanoid race; an unknown-race homebrew item.
- Gates before the PR: `npm run lint`, `npm run typecheck` (including `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Manual dev-world checklist including a non-GM seat: drop three or four humanoid races on characters, ability-range warnings, a natural-AC character with and without armor (AC panel numbers), level limits and the exceed setting, a kit with a humanoid-race qualification, a homebrew race item, the Character NPC sheet, both Foundry themes.

## Risks

- **Transcription:** about thirty entries read from page images. Mitigation: Table 1 is re-keyed independently in a pack test, the per-entry ranges are checked for sanity (min <= max, adjustments consistent with the range), and the manifest cites the page for every entry; the implementation plan uses one verification pass per batch of races.
- **Breadth of the `Race` change:** many readers. Mitigation: the effective helpers are the only indexers, a census test enforces it, and the type change makes every direct index fail typecheck.
- **XP surcharges:** entries state them in different forms (a flat percent, "x2"); each is normalized to a percent and the manifest records the original wording of the source number.
- **Priest deferral** leaves some races without a priest class until the kit sub-project; the manifest and issue list say which.
