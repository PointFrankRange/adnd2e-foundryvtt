# `races` pack — source manifest

Six PHB player-character races. Mechanical/factual values only; no rulebook prose
(`system.description` stays `""`).

## Naming

Subrace items are named "Base, Subrace" (for example "Dwarf, Deep") so the compendium sorts the PHB
race first and its subraces directly after it. `subrace.displayName` is the name the character
sheet shows ("Deep Dwarf"); blank on the six PHB items, which show their own name.

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
| `hill-dwarf.json` | Dwarf, Hill | |
| `mountain-dwarf.json` | Dwarf, Mountain | |
| `deep-dwarf.json` | Dwarf, Deep | +10% XP, Con-save +1 |
| `duergar.json` | Dwarf, Duergar | +20% XP |
| `sundered-dwarf.json` | Dwarf, Sundered | |
| `gully-dwarf.json` | Dwarf, Gully | |

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
| `aquatic-elf.json` | Elf, Aquatic | infravision 360 |
| `drow.json` | Elf, Drow | +20% XP, infravision 90 |
| `grey-elf.json` | Elf, Grey | +15% XP |
| `high-elf.json` | Elf, High | |
| `sylvan-elf.json` | Elf, Sylvan | |

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
| `rock-gnome.json` | Gnome, Rock | shipped because its Intelligence and Wisdom ranges differ from the PHB gnome (Int 7-19 and Wis 3-17 versus 6-18 and 3-18); its infravision (60) is the same |
| `deep-gnome.json` | Gnome, Deep | infravision 120; flat save bonus +3 on all saves (+2 instead vs poison) |
| `tinker-gnome.json` | Gnome, Tinker | |
| `forest-gnome.json` | Gnome, Forest | infravision 0 |
| `hairfoot.json` | Halfling, Hairfoot | shipped because ranges and infravision differ from the PHB halfling |
| `stout-dexterity.json`, `stout-constitution.json` | Halfling, Stout (...) | "either/or" adjustment: one item per choice |
| `tallfellow-dexterity.json`, `tallfellow-wisdom.json` | Halfling, Tallfellow (...) | "either/or" adjustment: one item per choice |
| `furchin.json` | Halfling, Furchin | |
| `kender.json` | Halfling, Kender | infravision 30 |

The Deep Gnome's flat saving-throw bonus is the subrace block's `flatSaveBonus`
(`{ "all": 3, "poison": 2 }`); every other subrace has `flatSaveBonus: null`. The Athasian halfling
is deliberately not shipped (Dark Sun content is planned separately). Specials are display labels in
`grantedFeatures` only.

## PHBR10 humanoid races

Source: *The Complete Book of Humanoids* (PHBR10), a scanned PDF with no text layer, read page by
page from rendered images (pdftoppm 100-200 dpi, scratch dir only, no page images committed). Each
humanoid is a `race` item whose `raceId` is its own slug and whose `subrace` block carries the
race's own layer (ability adjustments, min-max, XP surcharge); `subrace.id` and `subrace.displayName`
stay blank. Batches 1 and 2 of 3 (twenty races) are shipped so far.

| Printed page | PDF page | What was read |
|--------------|----------|---------------|
| 9 | 10 | Table 1: Humanoid Level Limits (the designated source for each race's group limits; keyed independently in `tests/packs/humanoid-races.test.ts`) |
| 15 | 16 | How to read the entries (natural armor class rule) |
| 16-17 | 17-18 | Aarakocra |
| 18-19 | 19-20 | Alaghi |
| 19-20 | 20-21 | Beastman |
| 21-22 | 22-23 | Bugbear |
| 22-23 | 23-24 | Bullywug (entry titled "Bullywug, Advanced") |
| 24-25 | 25-26 | Centaur |
| 25-26 | 26-27 | Fremlin |
| 27-28 | 28-29 | Giant-kin, Firbolg |
| 29-30 | 30-31 | Giant-kin, Voadkyn |
| 31-32 | 32-33 | Gnoll |
| 32-33 | 33-34 | Gnoll, Flind |
| 35-36 | 36-37 | Goblin |
| 36-38 | 37-39 | Hobgoblin |
| 38-40 | 39-41 | Kobold |
| 40-42 | 41-43 | Lizard Man |
| 42-43 | 43-44 | Minotaur |
| 43-45 | 44-46 | Mongrelman |
| 46-47 | 47-48 | Ogre, Half-Ogre (one shared entry) |
| 47-49 | 48-50 | Ogre Mage |
| 119 | 120 | Table 13: Humanoid Multi-Class Combinations (rotated page, rendered upright) |

### Rules used for every humanoid

- **Size rule:** small under 4 ft, medium 4-7 ft (7 ft is medium), large over 7 ft.
- **Class-group mapping (Table 1):** Wr = fighter, ranger, paladin; Wz = mage (illusionist is a mage
  specialist and shares the mage limit); Pr = cleric, druid; Rg = thief, bard.
- **Chapter 3 priest-kit deferral:** where a race's only priest option is a Chapter 3 kit (shaman,
  witch doctor), the item has no cleric/druid chassis and records the limit as a feature label
  `Shaman (kit) max level N`. Batch 1: aarakocra, bullywug, giant-kin firbolg, giant-kin voadkyn
  (the test's `DEFERRED_PRIEST`); batch 2 adds lizard man (shaman 7), minotaur (witch doctor 7), ogre (shaman 3) and ogre mage (shaman 7). Races that also have a cleric or druid chassis (bugbear, gnoll,
  alaghi, centaur) ship that chassis and omit their shaman/witch doctor limits.
- **Table 13 (p.119):** combinations containing shamans or witch doctors are dropped; combinations
  naming a chassis the race may not take are dropped; "illusionist" combinations fold into mage.
- **Table 1 wins over an entry** whenever the two disagree; the entry value is noted below.
- Abilities are stored as the race's own `subrace` layer; movement defaults to 12, XP surcharge 0,
  `thiefAdjustments` null (open), and infravision 0 when the entry states none. `common` is not
  listed in `bonusLanguages` (every humanoid PC understands it, p.15); the race's own tongue is.
- Special abilities and drawbacks are display labels in `grantedFeatures` only.

### Judgement calls, batch 1

- **Fremlin thief limit (conflict):** Table 1 (p.9) prints Rg 11; the entry's own class table
  (p.25-26) prints Thief 12. Shipped 11 (Table 1).
- **Exceptional Strength maxima:** beastman prints Str max 18/50 (p.19) and bullywug 18/75 (p.22);
  both are stored as 18 (the range is integer). The exceptional maximum is noted here only.
- **Size not stated:** beastman (p.19, "short, slender") is medium; centaur (p.24-25, horse body,
  takes damage as a large creature) is large. Neither entry states a height or length.
- **Natural AC printed as 10:** bugbear (p.21) and gnoll (p.31) print 10, which equals no armor;
  stored as `null`.
- **Centaur Table 13 vs class table:** Table 13 lists fighter/thief and ranger/shaman, but the
  centaur's class table (p.24) allows no thief; fighter/thief and ranger/shaman are dropped, leaving
  fighter/mage.
- **Fremlin:** mage and illusionist are both 10 (one `mage` entry); Table 13's mage/thief and
  illusionist/thief fold into one combination.
- **Strength minimum 2 (fremlin, p.25):** stored as printed; the structural test allows a minimum
  of 1 or more.
- **Land movement:** none of the ten entries states a land rate (aarakocra flight 36 and fremlin
  flight 12 are labels); all use 12.
- **Infravision:** stated only for the bugbear (60, p.22) and voadkyn (90, p.30); the other eight
  state none and use 0.
- **Firbolg XP:** double the base class's experience points (p.28-29) is stored as `xpModifierPercent: 100`;
  the voadkyn "uses the Paladin XP table" (p.31) is a feature label only.
- **Alaghi druid:** the druid limit of 11 carries a footnote (Int 15, Wis 12, Cha 15, neutral good);
  shipped as an allowed class with the requirement in a feature label.
- **Voadkyn 90% sleep/charm resistance (p.30)** is a feature label only (the code resistance table
  covers PHB races).

### Judgement calls, batch 2

- **Hobgoblin thief limit (conflict):** Table 1 (p.9) prints Rg 11; the entry's class table (p.37)
  prints Thief 12. Shipped 11 (Table 1).
- **Goblin size:** the entry (p.35) says "small humanoids ... about four feet tall"; exactly 4 ft is
  medium by the size rule, but the book calls them small, so shipped small.
- **Minotaur / ogre / half-ogre / ogre mage size:** minotaur 7-7.5 ft (p.43), half-ogre "between seven
  and eight feet" (p.47) are over 7 ft, so large; ogre (9 ft+) and ogre mage (10.5 ft) are large.
- **Natural AC printed as 10:** flind (p.33), goblin (p.35), hobgoblin (p.37), kobold (p.38) store null.
  Lizard man 5 (p.40, matches the p.15 example), minotaur 6, mongrelman 5, ogre 5, half-ogre 8,
  ogre mage 4.
- **Lizard man land movement 6** (p.42, stated); swim 12 is a label. Others use 12.
- **Infravision stated:** goblin 60 (p.36), hobgoblin 60 (p.38), kobold 60 (p.39), minotaur 60 (p.43).
  Flind, lizard man, mongrelman, ogre, half-ogre, ogre mage state none: 0.
- **Ogre mage XP:** "twice as many XP" (p.49) = `xpModifierPercent: 100`.
- **Mongrelman +1:** the free +1 to any one non-Int/Cha ability (p.43) is a label, not an adjustment.
  Mongrelman shaman 7 dropped (it has a cleric 10 chassis). Bard 8 shipped (footnote noted as a label).
- **Ogre vs half-ogre:** one entry (p.46) with paired values (ogre/half-ogre). Half-ogre has cleric 4
  (shipped; Table 1 Pr 4), its shaman/witch doctor 4 dropped; ogre's only priest option is shaman 3
  (DEFERRED_PRIEST). Table 13: ogre has fighter/shaman only (dropped, so no multi-class); half-ogre
  keeps fighter/cleric (printed "allowed if Wisdom is 9+", a requirement not encoded).
- **Table 13 drops:** flind, goblin, hobgoblin, kobold, lizard man fighter/shaman; mongrelman
  fighter/shaman and shaman/thief; ogre mage fighter/shaman; minotaur's Table 13 row (fighter/thief,
  fighter/mage) is kept in full (its class table allows ranger/mage/thief).
- **Languages:** `common` omitted; mongrelman speaks only common (empty list); hobgoblin's rare
  "carnivorous ape" stored as `carnivorous-ape`; ogre/half-ogre `stone-giant`.
- **Disadvantage labels with numbers** (hobgoblin dwarf +1, kobold gnome +1, ogre -4 vs gnomes/dwarves)
  are display-only.
