# `kits` pack — source manifest

Four SAMPLE character kits that exercise the kit engine (SP11 Plan A). Plan B adds tracked powers: Duelist (3/encounter), Zealot (2/day with params, plus an at-will power). Plan C adds base-class overrides and level-scaled power uses. They are this project's own design, mechanical data only (content policy: no rulebook prose). Real kit content is user-authored through the importer.

| id | name | chassis | shows off |
|----|------|---------|-----------|
| kSampleDuelist01 | Sample Duelist | fighter | ability minimum, XP modifier, an attack effect, armor `replace`, a tracked power |
| kSampleHedgeMg02 | Sample Hedge Mage | mage | a save effect, armor and weapon `extend`, a forbidden proficiency |
| kSampleZealot003 | Sample Zealot | cleric | race and alignment gates, bonus HP, weapon `extend`, a tracked power |
| kSampleGhosthnt1 | Sample Ghosthunter | paladin | casting off, turning at full class level, removed abilities, level-scaled powers, granted-feature display text (paralysis immunity) |

Power ids (kit `powers[].id`) must be lowercase slugs (`a-z`, `0-9`, `-`) and unique within the kit; a power with any other id is silently hidden.
