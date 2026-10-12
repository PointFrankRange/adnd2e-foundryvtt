# SP18 Plan B1 — Martial arts special maneuvers: learning engine + Block, Kick, Strike (PHBR15 ch.4)

Issue: #86. Source: *The Complete Ninja's Handbook* (PHBR15) ch.4 pp.49-57, Tables 19 and 21 (all values read from the page images). Builds on Plan A (PR #160): the `martialStyle` item, the Martial Arts panel, `resolveMartialAttack`, the chat card.

## Decomposition of Plan B

| Plan | Scope |
|---|---|
| **B1 (this spec)** | The maneuver registry, the learning engine (order, slot, 2-per-level cap), the "use a maneuver" flow, and the **Block (4), Kick (3), Strike (3)** lists = 10 maneuvers |
| B2 | Lock (4), Throw (4), Push (3), Vital Area (4): maneuvers needing target conditions (held, stunned, paralyzed, unconscious, prone) |
| B3 | Movement (6), Weapon (2), Mental/Physical Training (7): constant abilities as derived bonuses, style weapons |

Ch'i attacks (Mental 4) and the damage-resistance hook stay Plan C.

## Automation depth (decided: option A, "roll plus clear text")

Automated: the attack roll, its modifiers (Table 57, Table 22, conditions, Table 21), the damage formula, learnability rules, slot spend. Everything the system has no mechanism for (attack cost per round, multi-blow parries, Strength contests, falling prone, AC worsening, object breaking) appears as one line of card text for the GM.

## Rules (B1)

### Learning
- A maneuver is learnable on an owned style when: the style offers it (its `availableManeuvers`), it is the **lowest-difficulty unlearned maneuver in its list** (per-list order — the book's own example learns Kick 1 then Kick 3), the character has a free weapon-proficiency slot (it costs 1), and fewer than **2** maneuvers were learned on that style at the character's current level.
- "Level" is the character's highest class level (multiclass ambiguity ruled here).
- Learning writes `{ id, level }` onto the style's `knownManeuvers` and raises `slotsInvested` by 1 (the existing counter feeds `spentWeaponSlots`).
- Only the **active** style's maneuvers can be used.

### Registry (Table 19 / Table 21; attack-roll modifiers by the TARGET's armor group)
Armor groups: **light** = leather, padded, studded leather, and any monster (creature actor) with AC 7 or better; **mail** = ring, scale, chain, elven chain, splint, banded, plate mail (the book's "all chain and mail armors, brigandine"); **plate** = field plate, full plate; unarmored targets get no Table 21 modifier.

| Id | Maneuver | Cost | Table 21 (light / mail / plate) | Damage on a hit |
|---|---|---|---|---|
| block:1 | Basic Parry | 1 attack | none | — (parries the first blow) |
| block:2 | Parry All | 2 attacks | none | — (a roll per blow) |
| block:3 | Grappling Block | 1 attack | none | — (pins the weapon) |
| block:4 | Arrow Parry | 2 attacks | none | — (missiles) |
| kick:1 | Circle Kick | 1 attack | 0 / -1 / -3 | style die + 1d2 + Str |
| kick:2 | Flying Kick | 1 attack | -1 / -2 / -3 | style die + 1d4 + Str |
| kick:3 | Backward Kick | 1 attack | 0 / -1 / -3 | style die + Str |
| strike:1 | Iron Fist | none (replaces damage) | 0 / 0 / -2 | 1d6 + Str |
| strike:2 | Crushing Blow | the round | -1 / -2 / -3 | style die + floor(level / 2) (no Strength) |
| strike:3 | Eagle Claw | the round | -2 / -3 / -4 | 1d8 + Str |

Strength damage = the character's damage adjustment (`abilities.str.mods.damageAdj`), minimum total 0. The style die is the Plan A derived die (a weapon-method style has none: its maneuvers add to 0... the Weapon list is B3, so B1 maneuvers on a weapon-method style use the maneuver's own additions only and the card says so).

### The attack
- To-hit bonus = Table 57 worn-armor penalty + Table 22 opponent-weapon-size penalty + conditions + the maneuver's Table 21 modifier for the target's armor group. Natural 20 hits, natural 1 misses, a helpless target is a forced hit (as Plan A).
- Table 16 is NOT used (the maneuver is the result); an unmodified 20 still prompts the stun/incapacitate text like the plain attack.
- Block maneuvers roll against the attacker (the targeted token) and the card reads "parried" / "the blow hits".
- Failure text keys per maneuver (not automated): Basic Parry "the blow hits"; Grappling Block "your weapon is fouled and may be yanked free"; Arrow Parry "the missile strikes"; Circle Kick "next attack lost, AC worsened by 2 until next round"; Flying Kick "you fall prone adjacent and spend a round getting up"; Backward Kick "no ill effect"; Iron Fist "the blow does not land"; Crushing Blow "a hard object injures your hand: damage to you, hand unusable 24 hours"; Eagle Claw "no damage, no ill effect".

## Data model
- `martialStyle.knownManeuvers`: array of `{ id: string, level: integer >= 1 }`, initial `() => []` (defaults only, no migration).
- No new setting, no actor field.

## Architecture
- `src/core/martial-arts/maneuvers.ts` (pure): `MANEUVERS` registry, `maneuverById`, `armorGroupOf(armorType, isToughMonster)`, `table21Modifier(maneuverId, group)`, `maneuverDamageFormula(...)`, `learnability(...)`.
- `src/core/martial-arts/maneuver-attack.ts` (pure): `resolveManeuverAttack(...)` composing Plan A's penalties with the Table 21 modifier.
- Card context gains optional maneuver fields; the template gains a maneuver header, outcome text and the formula line.
- Glue: `martial-arts-actions.ts` gains `learnManeuver(actor, styleId, maneuverId)` and `useManeuver(actor, maneuverId)`; the panel row gains the Maneuvers list (Known/Use, Learnable/Learn, locked with reason).

## Testing and verification
Unit tests reproducing Table 19 names/difficulties and Table 21 for the 10 maneuvers; learnability (order, slot, cap, not offered, already known); damage formulas (the book's "11th-level, 1d4 style = 1d4+5" crushing blow example); armor grouping; the attack. Headless proof for the schema and card rendering; CI sequence incl. coverage; a dev-world checklist with a fixture script.

## Out of scope
Lock/Throw/Push/Vital Area/Movement/Weapon/Mental lists (B2, B3), ch'i attacks and damage resistance (C), per-round attack/cost tracking, the Master's maneuver-count limit (the style's `availableManeuvers` is the only source), a DM style builder.
