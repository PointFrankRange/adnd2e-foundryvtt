# `weapon-proficiencies` pack — source manifest

51 specific-weapon proficiency items (`weaponProficiency`, `isGroup: false`), one per weapon name, each
carrying its weapon group in `system.proficiencyGroup` (one of the 8 groups in `weapon-proficiency-groups`).
Used by the Skills & Powers expanded-proficiencies rule (Sub-project 8 Plan 8b): holding one of these
makes every OTHER weapon in the same group "related" (half the non-proficiency attack penalty).

Names are PHB weapon vocabulary; the weapon -> group assignment is this project's own design.
Names and group assignment ONLY — no weapon statistics, no rules prose (`system.description` is `""`).
Weapons that fit none of the 8 groups (whip, net, blowgun, lasso, garrot, ...) are intentionally omitted.
`_id` = first 16 hex chars of SHA-1("adnd2e-weapon-proficiency:" + name); files are named by kebab-case slug.
