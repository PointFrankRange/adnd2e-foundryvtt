# `traits` pack — source manifest

Fourteen character traits for the Skills & Powers character-point build (Sub-project 8, Plan 8c). Each document is a `trait` Item: `system.traitId`, `system.cost` (negative = a disadvantage that refunds CP, capped at 10 CP in total), and `system.effect` — the flat typed effect (`kind` plus the one target member that kind uses; unused members are `""`).

Names, costs and amounts are this project's OWN designed values (no book tables or trait descriptions are reproduced); `system.description` is `""`. Docs are drift-tested against the pure `TRAITS` table (`src/core/skills/traits.ts`) by `tests/packs/content.test.ts`. `_id` is the first 16 hex characters of SHA-1 of `adnd2e-trait:<name>`; `_key` is `!items!<_id>` (docs without `_key` compile to an EMPTY pack).

| traitId | name | cost | effect |
|---|---|---|---|
| hardy | Hardy | 6 | bonusHp +4 |
| iron-will | Iron Will | 5 | saveBonus spell +1 |
| resilient | Resilient | 5 | saveBonus ppd +1 |
| steady-aim | Steady Aim | 8 | attackBonus ranged +1 |
| brawler | Brawler | 8 | attackBonus melee +1 |
| quick-study | Quick Study | 4 | proficiencySlots nonweapon +2 |
| weapon-drill | Weapon Drill | 4 | proficiencySlots weapon +1 |
| powerful | Powerful | 7 | abilityBonus str +1 |
| sturdy | Sturdy | 7 | abilityBonus con +1 |
| frail | Frail | −4 | bonusHp −3 |
| nervous | Nervous | −4 | saveBonus spell −1 |
| poor-aim | Poor Aim | −5 | attackBonus ranged −1 |
| slow-learner | Slow Learner | −3 | proficiencySlots nonweapon −1 |
| feeble | Feeble | −5 | abilityBonus str −1 |
