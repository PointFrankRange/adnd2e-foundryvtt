# `races` pack — source manifest

Six PHB player-character races. Mechanical/factual values only; no rulebook prose
(`system.description` stays `""`).

## Sources rendered and read (PyMuPDF, DPI 170–175, scratch dir only — no page images committed)

| Book | Printed page | PDF page | What was read |
|------|--------------|----------|---------------|
| Player's Handbook (revised 2E) | 20 | 21 | Chapter 2 opener; Table 7 Racial Ability Requirements; Table 8 Racial Ability Adjustments; "Class Restrictions and Level Limits" prose; Dwarves (start) |
| Player's Handbook | 21 | 22 | Dwarves (languages, infravision, class list); Elves (class list, multi-class list, languages, infravision) |
| Player's Handbook | 22 | 23 | Gnomes (class list, multi-class note, languages, infravision); Half-Elves (class list, multi-class list, languages, infravision) |
| Player's Handbook | 23 | 24 | Halflings (class list, multi-class, languages, infravision); Humans (any class / any level) |
| Player's Handbook | 25 | 26 | Chapter 3 opener (class group table, confirms mage vs. illusionist) |
| Player's Handbook | 44 | 45 | **Multi-Class Combinations table** — authoritative list of legal multi-class combos per demihuman race |
| Dungeon Master Guide (revised 2E) | 15 | 16 | **Table 7: Racial Class and Level Limits** — the numeric per-class level caps |

### Why the level caps come from the DMG

The revised 2nd Edition **PHB has no numeric racial level-limit table** — Chapter 2 only
defers non-human level limits to the DM (PHB p.20), and
the PHB index entry "Level limits, racial ... 20" points at that prose. The numeric table
(`Table 7: Racial Class and Level Limits`) lives in the **revised 2E DMG, p.15**. That is
the transcription source for every `classLevelLimits` value below. `U` in the DMG table =
unlimited = `null`; `—` = race cannot take that class (key omitted).

### `classLevelLimits` for `human` = `{}`

Humans are unlimited in every class. Per controller resolution the object is left **empty**
`{}` rather than spelling out every class → `null`; the derive layer treats a missing key
as "unlimited".

### `allowedMulticlass` for `human` = `[]`

Humans dual-class; they do not multi-class (PHB p.44: multi-classing is demihuman-only).

### `illusionist` → `mage`

The engine `CLASS_IDS` enum has no `illusionist`; gnome illusionists and half-elf
"specialist wizards" are recorded under `mage`. DMG Table 7 gnome column: Illusionist 15,
Mage —, so gnome `mage` = 15 is really the illusionist cap.

## Transcribed cells

### `classLevelLimits` (DMG p.15, Table 7 — columns Human/Dwarf/Elf/Gnome/Half-Elf/Halfling)

| class (engine id) | human | dwarf | elf | gnome | half-elf | halfling |
|-------------------|-------|-------|-----|-------|----------|----------|
| fighter | U (—) | 15 | 12 | 11 | 14 | 9 |
| ranger | U (—) | — | 15 | — | 16 | — |
| paladin | U (—) | — | — | — | — | — |
| mage (incl. illusionist) | U (—) | — | 15 | 15 | 12 | — |
| cleric | U (—) | 10 | 12 | 9 | 14 | 8 |
| druid | U (—) | — | — | — | 9 | — |
| thief | U (—) | 12 | 12 | 13 | 12 | 15 |
| bard | U (—) | — | — | — | U → `null` | — |

(`U (—)` in the human column = unlimited, and per the `{}` rule no key is written.)

### `allowedClasses` (PHB Chapter 2 race descriptions)

| race | value | PHB page |
|------|-------|----------|
| human | fighter, paladin, ranger, mage, cleric, druid, thief, bard (any class) | 23 |
| dwarf | cleric, fighter, thief | 20 |
| elf | cleric, fighter, mage, thief, ranger | 21 |
| gnome | fighter, thief, cleric, mage (illusionist) | 22 |
| half-elf | cleric, druid, fighter, ranger, mage (+ specialist wizard), thief, bard | 22 |
| halfling | cleric, fighter, thief | 23 |

### `allowedMulticlass` (PHB p.44, Multi-Class Combinations table — order follows that table; 2-class combos first, then 3-class)

| race | combos | PHB page |
|------|--------|----------|
| human | (none — dual-class only) | 44 |
| dwarf | fighter/thief, fighter/cleric | 44 |
| elf | fighter/mage, fighter/thief, mage/thief, fighter/mage/thief | 44 |
| gnome | fighter/cleric, fighter/illusionist→mage, fighter/thief, cleric/illusionist→mage, cleric/thief, illusionist→mage/thief | 44 |
| half-elf | fighter/cleric, fighter/thief, fighter/druid, fighter/mage, cleric/ranger, cleric/mage, thief/mage, fighter/mage/cleric, fighter/mage/thief | 44 |
| halfling | fighter/thief | 44 |

### `bonusLanguages` (PHB Chapter 2 race descriptions — the enumerated extra languages only; Common and the racial tongue excluded)

| race | value | PHB page | source phrase |
|------|-------|----------|---------------|
| human | (none) | 20 | PHB p.20: humans begin with only their regional language, no bonus languages |
| dwarf | gnome, goblin, kobold, orc | 21 | "common, dwarf, gnome, goblin, kobold, orc, and any others your DM allows" |
| elf | gnome, halfling, goblin, hobgoblin, orc, gnoll | 21 | "common, elf, gnome, halfling, goblin, hobgoblin, orc, and gnoll" |
| gnome | dwarf, halfling, goblin, kobold | 22 | "common, dwarf, gnome, halfling, goblin, kobold, and the simple common speech of burrowing mammals …" (the burrowing-mammal speech is not transcribed — not a discrete language word) |
| half-elf | elf, gnome, halfling, goblin, hobgoblin, orc, gnoll | 22 | "common, elf, gnome, halfling, goblin, hobgoblin, orc, and gnoll" (half-elves have no language of their own per PHB p.22, so `elf` is a learnable bonus language, not the racial tongue) |
| halfling | dwarf, elf, gnome, goblin, orc | 23 | "common, halfling, dwarf, elf, gnome, goblin, and orc" |

### Known values (from brief — not re-derived)

`size`, `baseMovement`, `infravision`, `grantedFeatures: []` as given in `task-3-brief.md`.

## `img` choices (all verified present in `resources/app/public/icons/svg/`)

| race | icon |
|------|------|
| human | `icons/svg/mystery-man.svg` |
| dwarf | `icons/svg/mountain.svg` |
| elf | `icons/svg/oak.svg` |
| gnome | `icons/svg/burrow.svg` |
| half-elf | `icons/svg/mystery-man-black.svg` |
| halfling | `icons/svg/house.svg` |

## Dwarf subraces (SP12 Plan A)

Source: *The Complete Book of Dwarves* (PHBR6) ch. 4, pp. 28-36, read from the text layer;
the subrace thieving-skill table was read from the page image. Six `race` items, each with
`raceId: "dwarf"` (the PHB dwarf's `allowedClasses` / `allowedMulticlass` copied) and a
`subrace` block (ability adjustments and min-max, thieving adjustments, Constitution-save
adjustment, XP surcharge percent):

| file | name | notes |
|------|------|-------|
| `hill-dwarf.json` | Hill Dwarf | |
| `mountain-dwarf.json` | Mountain Dwarf | |
| `deep-dwarf.json` | Deep Dwarf | +10% XP, Con-save +1 |
| `duergar.json` | Duergar | +20% XP |
| `sundered-dwarf.json` | Sundered Dwarf | |
| `gully-dwarf.json` | Gully Dwarf | |

Mechanical values only are shipped; special advantages and drawbacks (enmities, innate
powers, light penalties, claustrophobia, groveling, magic-item failure) are display labels in
`grantedFeatures` only.

## Elf subraces (SP12 Plan B)

Source: *The Complete Book of Elves* (PHBR8) ch. 10 "Character Creation and Kits", "The Elf
Subraces", pp. 76-82, read from the text layer and page images. Five `race` items, each with
`raceId: "elf"` (the PHB elf's `allowedClasses`, `allowedMulticlass` and `classLevelLimits`
copied; the book gives subraces no limits of their own) and a `subrace` block (ability
adjustments and min-max, XP surcharge percent; `thiefAdjustments: null` inherits the PHB elf's
table):

| file | name | notes |
|------|------|-------|
| `aquatic-elf.json` | Aquatic Elf | infravision 360 |
| `drow.json` | Drow | +20% XP, infravision 90 |
| `grey-elf.json` | Grey Elf | +15% XP |
| `high-elf.json` | High Elf | |
| `sylvan-elf.json` | Sylvan Elf | |

Half-elves have no adjustments in the book, so the PHB Half-Elf is unchanged (no new item).
Mechanical values only are shipped; special abilities and drawbacks (spell-likes, magic
resistance, light penalties, reaction modifiers, library access) are display labels in
`grantedFeatures` only.

## Gnome and halfling subraces (SP12 Plan C)

Source: *The Complete Book of Gnomes and Halflings* (PHBR9) ch. 2, pp. 20-37 and 66-77, read from
the text layer and, for the Tallfellow table, the page image. Eleven `race` items (four gnome,
seven halfling), each with the base race's `raceId` and a `subrace` block (ability adjustments and
min-max; `thiefAdjustments: null`, `conSaveBonusAdjustment: 0`, `xpModifierPercent: 0`). The PHB
gnome's/halfling's `allowedClasses`, `allowedMulticlass` and `classLevelLimits` are copied; the
book gives subraces no limits or class lists of their own.

| file | name | notes |
|------|------|-------|
| `rock-gnome.json` | Rock Gnome | shipped because its Intelligence and Wisdom ranges differ from the PHB gnome (Int 7-19 and Wis 3-17 versus 6-18 and 3-18); its infravision (60) is the same |
| `deep-gnome.json` | Deep Gnome | infravision 120; flat save bonus +3 on all saves (+2 instead vs poison) |
| `tinker-gnome.json` | Tinker Gnome | |
| `forest-gnome.json` | Forest Gnome | infravision 0 |
| `hairfoot.json` | Hairfoot | shipped because ranges and infravision differ from the PHB halfling |
| `stout-dexterity.json`, `stout-constitution.json` | Stout | "either/or" adjustment: one item per choice |
| `tallfellow-dexterity.json`, `tallfellow-wisdom.json` | Tallfellow | "either/or" adjustment: one item per choice |
| `furchin.json` | Furchin | |
| `kender.json` | Kender | infravision 30 |

The Deep Gnome's flat saving-throw bonus is the subrace block's `flatSaveBonus`
(`{ "all": 3, "poison": 2 }`); every other subrace has `flatSaveBonus: null`. The Athasian halfling
is deliberately not shipped (Dark Sun content is planned separately). Specials are display labels in
`grantedFeatures` only.
