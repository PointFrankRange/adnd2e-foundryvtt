# `kits` pack — source manifest

Seven SAMPLE character kits that exercise the kit engine (SP11 Plan A). Plan B adds tracked powers: Duelist (3/encounter), Zealot (2/day with params, plus an at-will power). Plan C adds base-class overrides and level-scaled power uses. They are this project's own design, mechanical data only (content policy: no rulebook prose). Real kit content is user-authored through the importer.

| id | name | chassis | shows off |
|----|------|---------|-----------|
| kSampleDuelist01 | Sample Duelist | fighter | ability minimum, XP modifier, an attack effect, armor `replace`, a tracked power |
| kSampleHedgeMg02 | Sample Hedge Mage | mage | a save effect, armor and weapon `extend`, a forbidden proficiency |
| kSampleZealot003 | Sample Zealot | cleric | race and alignment gates, bonus HP, weapon `extend`, a tracked power |
| kSampleGhosthnt1 | Sample Ghosthunter | paladin | casting off, turning at full class level, removed abilities, level-scaled powers, granted-feature display text (paralysis immunity) |
| kSampleDesertDr1 | Sample Desert Druid | druid | a shapechange power with habitat params (desert) |
| kSampleMountainD | Sample Mountain Druid | druid | a shapechange power with no habitat restriction (the book names none), Strength minimum |
| kSampleSwampDru1 | Sample Swamp Druid | druid | a shapechange power with habitat params (swamp), Charisma 12 minimum |

Power ids (kit `powers[].id`) must be lowercase slugs (`a-z`, `0-9`, `-`) and unique within the kit; a power with any other id is silently hidden.

Druid branch kits (SP16, #84): source The Complete Druid's Handbook (PHBR13), Chapter 1 branch entries - Desert Druid (printed p. 12 for ability minimums, p. 13 for the shapechange entry), Mountain Druid (printed p. 17), Swamp Druid (printed p. 18 for the minimums, continuing onto p. 19), and the Shapechanging section (printed pp. 6-8). Minimums: desert Wis 12 / Con 12 / Cha 15, mountain Str 9 / Wis 12 / Cha 15, swamp Wis 12 / Cha 12. The kits' shapechange powers carry `habitats`, `categories`, `oncePerCategory`, `minLevel` (and `giant`) params read by `resolveShapechangeSpec`. The Mountain Druid entry restricts forms by category only, so its kit has no `habitats` param. Racial qualifications are encoded per the book: desert human, mountain human or half-elf, swamp human.
