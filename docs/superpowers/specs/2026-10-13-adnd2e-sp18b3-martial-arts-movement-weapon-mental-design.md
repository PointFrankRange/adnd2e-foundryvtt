# SP18 Plan B3 — Martial arts maneuvers: Movement, Weapon, Mental/Physical Training (PHBR15 ch.4)

Issue: #86. Source: *The Complete Ninja's Handbook* (PHBR15) ch.4 pp.53-59, Tables 19 and 21 (read from the page images). Builds on Plans A, B1 and B2 (styles, plain attack, maneuver registry/learning/use flow, card effects, relay conditions).

## Scope

The remaining 16 Table 19 maneuvers: **Movement (6), Weapon (2), Mental/Physical Training (7, Ch'i Attacks as an inert placeholder)**. After B3 the whole Table 19 catalogue is in the registry. Left for later plans: style weapons (the tight-group slot purchase, "Weapons Allowed"), ch'i attacks' effect and damage resistance (Plan C), the Mental Resistance saves and All-Around Sight rear-AC pipelines (option C was declined), per-day and per-round tracking.

Automation depth (decided, option B): registry + roll cards for the roll-able ones, **real numbers for Ironskin (derived AC) and Blind Fighting (attack penalties)**, text/summary for the rest.

## Registry additions (id, slug, kind, cost, Table 21, behaviour)

| Id | Maneuver | Kind / cost | Table 21 | Behaviour |
|---|---|---|---|---|
| movement:1 | Feint | attack (`basic`) / 2 attacks | none | plain Table 16 attack at +3 to hit; the card shows the blow, damage = table number + Strength |
| movement:2 | Prone Fighting | passive / 0 | none | no penalties fighting from the ground (text) |
| movement:3 | Immovability | passive / 0 | none | save vs paralyzation to stay on your feet when knocked down, lifted or thrown (text) |
| movement:4 | Leap | skill / 1 | none | d20 vs AC 10 (conditions apply); the card prints standing and running-start distances; failure = full distance, then Prone |
| movement:5 | Speed | skill / 0 | none | once per day: d20 vs the Dexterity score; extra attacks = round((Dex - roll) / 4) for one round; rest one turn per extra attack |
| movement:6 | Slow Resistance | passive / 0 | none | immune to *slow* effects (text) |
| weapon:1 | Weapon Breaker | attack / 1 | none | attack roll, no damage; a hit breaks the opponent's normal weapon (magical weapons unharmed) |
| weapon:2 | Steel Cloth | passive / 0 | -1 / -3 / -5 | a 6-10 ft cloth is a spear (text) |
| mental:1 | Meditation | passive / 0 | none | 1 hour = 2 hours of sleep (text) |
| mental:2 | All-Around Sight | passive / 0 | none | aware of all non-invisible foes, never struck from behind (summary line) |
| mental:3 | Mental Resistance | passive / 0 | none | +2 on saves vs mental attacks (charm, illusion, hold) (summary line) |
| mental:4 | Ch'i Attacks | passive / 0 | none | unarmed hits count as magical weapons by level (Table 20); inert until Plan C |
| mental:5 | Blind Fighting | passive / 0 | none | only -1 when blinded, in darkness, or against invisible foes (**applied** to martial arts rolls) |
| mental:6 | Ironskin | passive / 0 | none | AC -2 while wearing no body armor (**applied** to derived AC) |
| mental:7 | Levitation | utility / the round | none | info card: float 5 ft/round for (level) rounds; one turn of concentration first, rest one round after |

`Ch'i Attacks` is a placeholder row so the per-list order (the styles offer mental 4 before mental 5 and 6) does not block Blind Fighting and Ironskin; its text states it has no effect until the damage-resistance rules exist.

### Registry field changes
- `MANEUVER_LISTS` gains `movement`, `weapon`, `mental` (ids `movement:1` ... `mental:7`, matching the shipped styles' `availableManeuvers`).
- `ManeuverDef.kind` gains `"skill"` and `"utility"`; new optional `basic?: boolean` (the maneuver resolves as the plain Table 16 attack) and `attackBonus?: number` (Feint +3).
- The panel's "Always in effect" summary lists exactly these known constants, in this order: All-Around Sight (`mental:2`), Mental Resistance (`mental:3`), Blind Fighting (`mental:5`), Ironskin (`mental:6`); every other passive keeps its own row text.

## Resolvers (pure)
- **Leap:** `resolveLeap({ naturalD20, thac0, situationalModifier, level })` -> hit vs AC 10 via `hitResult`, plus `standing { up: 4 + level, forward: 3 + level }` and `running { up: 8 + level, forward: 10 + level }`.
- **Speed:** `resolveSpeed({ naturalD20, dexterity })` -> `{ success: roll <= dex, extraAttacks: success ? Math.round((dex - roll) / 4) : 0, restTurns: extraAttacks }` (the book's example: Dex 13, roll 4 -> 9 / 4 = 2.25 -> 2).
- **Levitation:** `levitationInfo(level)` -> `{ rounds: level, feetPerRound: 5 }`.
- **Feint:** `resolveManeuverAttack` handles `basic`: bonus includes +3; on a hit the blow comes from `martialArtsResult(naturalD20)` and `damageFormula = String(max(0, tableDamage + strengthAdj))`; the result carries `blow`.

## Constant abilities as numbers
- "Known" means a `knownManeuvers` entry on ANY owned style (constant abilities are not limited to the active style).
- **Ironskin:** `ironskinAcMod(known, wearingBodyArmor)` = -2 when known and no body armor (a shield does not count as armor here). The snapshot supplies `ironskinAcMod`; derived AC subtracts it together with the style modifier, gated by `advancedMartialArts`. The AC breakdown gains an **Ironskin** row when non-zero.
- **Blind Fighting:** `blindFightingPenalty(penalty)` = `max(penalty, -1)` for a blinded actor and an invisible target in `situationalModifier` of the martial arts attack and maneuver paths only; darkness has no condition and is not covered (card note).
- **Summary:** the panel shows an "Always in effect" list built from the known constants (`labelKey` per maneuver).

## Card and panel
- Roll-able kinds post through the existing `martial-arts-attack.hbs` with optional `lines: { key, n1?, n2? }[]` (rendered as hint lines) and no Table 16 section unless Feint. Leap's failure offers an Apply Knocked down (Prone) button using the existing effects mechanism.
- Rows: passive = "Always in effect" (no Use), skill/utility/attack = Use. No target is required for skill and utility rows.

## Testing and verification
Unit tests: the 16 registry rows (ids, kinds, costs, Table 21 for Steel Cloth, `basic`/`attackBonus`), learnability across the new lists (including the ch'i-before-Blind-Fighting order), Leap (level 10: standing 14 up / 13 forward; running 18 / 20), Speed rounding cases, Levitation, Feint (table blow + Strength + 3), Ironskin with and without armor, Blind Fighting clamp, the view's constants and rows, derive with Ironskin, the card lines. Headless proof for the Foundry schema and card rendering; CI sequence including coverage 100% and a build check after every task; a dev-world checklist.

## Out of scope
Style weapons / "Weapons Allowed" slot purchase; ch'i attacks' effect; Mental Resistance and All-Around Sight in the saves/rear-AC pipelines; darkness condition; once-per-day and rest tracking; the Leap's landing on a target.
