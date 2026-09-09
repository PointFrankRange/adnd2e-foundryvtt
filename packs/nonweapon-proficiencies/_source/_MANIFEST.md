# `nonweapon-proficiencies` pack — source manifest

Non-weapon proficiencies transcribed from the **AD&D 2nd Edition Player's Handbook (revised),
Chapter 5 "Proficiencies", Table 37: Nonweapon Proficiency Groups** — printed pp. 54–55
(PDF sheets 55–56; this section has a +1 print/PDF offset).

Mechanical/factual values only. No proficiency descriptions or rulebook prose are stored
(`system.description` is `""`). The PHB PDF is git-ignored and is not part of this repo;
no page images were committed. Column-header fragments used below for mapping only:
"# of Slots Required" → `slotCost`, "Relevant Ability" → `governingAbility`,
"Check Modifier" → `modifier`.

## Sources rendered and read (PyMuPDF, DPI 200 + 340 crops; scratch dir only — no page images committed)

| Book | Printed page | PDF page | What was read |
|------|--------------|----------|---------------|
| Player's Handbook (revised 2E) | 54 | 55 | Table 37 — GENERAL group (29 rows) and PRIEST group (12 rows) |
| Player's Handbook (revised 2E) | 55 | 56 | Table 37 — ROGUE group (16 rows), WARRIOR group (15 rows), WIZARD group (10 rows); Table 38 (group crossovers, context only) |

## Schema mapping

| PHB column | schema field | notes |
|------------|--------------|-------|
| group heading (GENERAL/PRIEST/WARRIOR/WIZARD/ROGUE) | `system.group` | lowercased |
| # of Slots Required | `system.slotCost` | integer ≥ 1 |
| Relevant Ability | `system.governingAbility` | Strength→str, Dexterity→dex, Constitution→con, Intelligence→int, Wisdom→wis, Charisma→cha |
| Check Modifier | `system.modifier` | integer; blank/"—" → 0 |
| — | `system.slotsInvested` | `1` (canonical/template item) |
| — | `system.isRacial` | `false` |
| — | `system.checkPenalty` | `0` |
| — | `system.description` | `""` (content policy) |

## Multi-group proficiencies (dedup rule)

A proficiency listed under more than one group heading is stored **once**, under the most
general group. "General" always wins; otherwise the earliest in the engine enum
`NONWEAPON_GROUPS = [general, warrior, wizard, priest, rogue]` is kept. In every case
below the slot cost / ability / modifier are **identical** across the groups the PHB lists
it in, so only the `group` tag is a lossy choice.

- **Local History** (kept under `priest`): also listed under Rogue (p.55) — identical values
- **Musical Instrument** (kept under `priest`): also listed under Rogue (p.55) — identical values
- **Blind-fighting** (kept under `warrior`): PHB shows Relevant Ability = NA, Check Modifier = NA (no ability check). governingAbility 'dex' + modifier 0 are schema-forced placeholders. also listed under Rogue (p.55). REVIEWER: check.
- **Gaming** (kept under `warrior`): also listed under Rogue (p.55) — identical values
- **Mountaineering** (kept under `warrior`): PHB shows Relevant Ability = NA, Check Modifier = NA (no ability check). governingAbility 'str' + modifier 0 are schema-forced placeholders. REVIEWER: check.
- **Navigation** (kept under `warrior`): also listed under Priest (p.54) and Wizard (p.55) — identical values
- **Set Snares** (kept under `warrior`): also listed under Rogue (p.55) — identical values
- **Ancient History** (kept under `wizard`): also listed under Priest (p.54) and Rogue (p.55) — identical values
- **Astrology** (kept under `wizard`): also listed under Priest (p.54) — identical values
- **Engineering** (kept under `wizard`): also listed under Priest (p.54) — identical values
- **Gem Cutting** (kept under `wizard`): also listed under Rogue (p.55) — identical values
- **Herbalism** (kept under `wizard`): also listed under Priest (p.54) — identical values
- **Languages, Ancient** (kept under `wizard`): also listed under Priest (p.54) — identical values
- **Reading/Writing** (kept under `wizard`): also listed under Priest (p.54) — identical values
- **Religion** (kept under `wizard`): also listed under Priest (p.54) — identical values
- **Spellcraft** (kept under `wizard`): also listed under Priest (p.54) — identical values

## "NA" relevant ability (Blind-fighting, Mountaineering)

The PHB lists these with Relevant Ability = **NA** and Check Modifier = **NA** (they are
not resolved with an ability check). The `nonweaponProficiency` schema requires a
`governingAbility` in the ability enum and an integer `modifier`, so placeholder values
were used: Blind-fighting → `dex`/`0`, Mountaineering → `str`/`0`. Flagged for reviewer.

## Full proficiency table (65 documents)

| name | group | ability | slots | modifier | PHB page |
|------|-------|---------|-------|----------|----------|
| Agriculture | general | int | 1 | 0 | 54 |
| Animal Handling | general | wis | 1 | -1 | 54 |
| Animal Training | general | wis | 1 | 0 | 54 |
| Artistic Ability | general | wis | 1 | 0 | 54 |
| Blacksmithing | general | str | 1 | 0 | 54 |
| Brewing | general | int | 1 | 0 | 54 |
| Carpentry | general | str | 1 | 0 | 54 |
| Cobbling | general | dex | 1 | 0 | 54 |
| Cooking | general | int | 1 | 0 | 54 |
| Dancing | general | dex | 1 | 0 | 54 |
| Direction Sense | general | wis | 1 | +1 | 54 |
| Etiquette | general | cha | 1 | 0 | 54 |
| Fire-building | general | wis | 1 | -1 | 54 |
| Fishing | general | wis | 1 | -1 | 54 |
| Heraldry | general | int | 1 | 0 | 54 |
| Languages, Modern | general | int | 1 | 0 | 54 |
| Leatherworking | general | int | 1 | 0 | 54 |
| Mining | general | wis | 2 | -3 | 54 |
| Pottery | general | dex | 1 | -2 | 54 |
| Riding, Airborne | general | wis | 2 | -2 | 54 |
| Riding, Land-based | general | wis | 1 | +3 | 54 |
| Rope Use | general | dex | 1 | 0 | 54 |
| Seamanship | general | dex | 1 | +1 | 54 |
| Seamstress/Tailor | general | dex | 1 | -1 | 54 |
| Singing | general | cha | 1 | 0 | 54 |
| Stonemasonry | general | str | 1 | -2 | 54 |
| Swimming | general | str | 1 | 0 | 54 |
| Weather Sense | general | wis | 1 | -1 | 54 |
| Weaving | general | int | 1 | -1 | 54 |
| Healing | priest | wis | 2 | -2 | 54 |
| Local History | priest | cha | 1 | 0 | 54 |
| Musical Instrument | priest | dex | 1 | -1 | 54 |
| Animal Lore | warrior | int | 1 | 0 | 55 |
| Armorer | warrior | int | 2 | -2 | 55 |
| Blind-fighting | warrior | dex | 2 | 0 | 55 |
| Bowyer/Fletcher | warrior | dex | 1 | -1 | 55 |
| Charioteering | warrior | dex | 1 | +2 | 55 |
| Endurance | warrior | con | 2 | 0 | 55 |
| Gaming | warrior | cha | 1 | 0 | 55 |
| Hunting | warrior | wis | 1 | -1 | 55 |
| Mountaineering | warrior | str | 1 | 0 | 55 |
| Navigation | warrior | int | 1 | -2 | 55 |
| Running | warrior | con | 1 | -6 | 55 |
| Set Snares | warrior | dex | 1 | -1 | 55 |
| Survival | warrior | int | 2 | 0 | 55 |
| Tracking | warrior | wis | 2 | 0 | 55 |
| Weaponsmithing | warrior | int | 3 | -3 | 55 |
| Ancient History | wizard | int | 1 | -1 | 55 |
| Astrology | wizard | int | 2 | 0 | 55 |
| Engineering | wizard | int | 2 | -3 | 55 |
| Gem Cutting | wizard | dex | 2 | -2 | 55 |
| Herbalism | wizard | int | 2 | -2 | 55 |
| Languages, Ancient | wizard | int | 1 | 0 | 55 |
| Reading/Writing | wizard | int | 1 | +1 | 55 |
| Religion | wizard | wis | 1 | 0 | 55 |
| Spellcraft | wizard | int | 1 | -2 | 55 |
| Appraising | rogue | int | 1 | 0 | 55 |
| Disguise | rogue | cha | 1 | -1 | 55 |
| Forgery | rogue | dex | 1 | -1 | 55 |
| Juggling | rogue | dex | 1 | -1 | 55 |
| Jumping | rogue | str | 1 | 0 | 55 |
| Reading Lips | rogue | int | 2 | -2 | 55 |
| Tightrope Walking | rogue | dex | 1 | 0 | 55 |
| Tumbling | rogue | dex | 1 | 0 | 55 |
| Ventriloquism | rogue | int | 1 | -2 | 55 |

### Count by group

- general: 29
- warrior: 15
- wizard: 9
- priest: 3
- rogue: 9
- **total: 65**
