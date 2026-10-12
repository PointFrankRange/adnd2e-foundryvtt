# SP18 Plan A — Martial arts styles and the unarmed attack (PHBR15 ch.4)

Issue: #86 (SP18: Ninja martial arts). Source: *The Complete Ninja's Handbook* (PHBR15) ch.4, pp.39-61; the PHB p.97 Table 57.
All table values below were read from the page images, not the OCR.

## Decomposition

| Plan | Scope |
|---|---|
| **A (this spec)** | The `martialStyle` item, slot accounting, the 8 Table 17 styles, an unarmed attack roll with Table 16 results, armor/weapon penalties, stun/incapacitate |
| B | Special maneuvers (Tables 19/21 rows, Table 23 hit locations if wanted), style weapons |
| C | Ch'i attacks (Table 20) and a general "needs a +N weapon to hit" damage-resistance hook (does not exist in the system yet) |

Deferred and not in any plan yet: DM style builder UI, Monster NPC styles, the ninja thief-skill table (separate backlog item).

## Rules summary (what Plan A implements)

- A style has a **form** (hard/soft/hard-soft) and a **principal method** (Table 18). #AT, AC mod, damage and principal attack all derive from those two choices.
  - #AT: always +1 attack per round, **only while unarmed**.
  - AC mod: hard -1, soft -3, hard/soft -2. Added to the character's AC (negative = better), worn armor or not.
  - Dmg Mod = form (hard 2, soft 0, hard/soft 1) + method (Block 1, Kick 2, Lock 1, Movement 1, Push 1, Strike 2, Throw 1, Vital Area 2; Weapon = by weapon). The total maps to a die: 1 = 1 hp, 2 = d2, 3 = d3, 4 = d4, 5 = d6.
  - Principal attack: Block Hand, Kick Foot, Lock Body, Movement Legs, Push Hand, Strike Hand, Throw Body, Vital Area Hand/Foot.
- Table 17's eight styles equal their Table 18 derivation (a unit test asserts it).
- **Attack roll:** normal THAC0 vs the target's AC, Strength to-hit applies. On a hit, the **unmodified** d20 is looked up on Table 16 for the blow and its damage:

| d20 | Blow | Damage |
|---|---|---|
| 19-20 | Head kick | 4 |
| 17-18 | Head punch | 3 |
| 15-16 | Vitals kick | 3 |
| 13-14 | Vitals punch | 2 |
| 11-12 | High kick | 2 |
| 9-10 | Side kick | 2 |
| 6-8 | Body punch | 1 |
| 3-5 | Low kick | 1 |
| 1-2 | Graze | 0 |

  **Damage rule (decided, reading R3):** the Table 16 number is the hp dealt, plus the attacker's Strength damage bonus (the book's worked example: a 13 is a vitals punch doing 2 hp plus Strength). The style's damage die is derived and shown on the style, but Plan A does not roll it; Plan B's maneuvers use it ("add 1d4 hp to normal martial arts damage"). Unit tests pin this with the book's printed examples.
- **Pull the attack:** the attacker may deal no damage.
- **Armor penalty (attacker's own worn armor, PHB Table 57):** studded leather -1; chain, ring, scale -2; banded, splint, plate mail -5; field plate -8; full plate -10. A penalty to the attack roll. Elven chain counts as chain.
- **Armed opponent (Table 22):** attack penalty by the opponent's weapon size: S -1, M -2, L -4, G -3, H -1. Weapon items carry S/M/L only; G and H apply to creature attacks if their weapon size is recorded, otherwise 0.
- **Stun / incapacitate:** an unmodified natural 20 forces the target to save vs paralyzation. On a failed save, a d20 is compared to the target's HD or level: lower = stunned 1d6 rounds, higher = incapacitated 1d3 hours (equal: treated as stunned; the book leaves it unspecified, and the card says so).
- **Slots:** the basics cost 1 weapon slot. Each further special maneuver or weapon group costs 1 more (Plan B). At most 2 slots per style per experience level.

### Interpretation notes

- Table 21's maneuver penalties apply to special maneuvers and belong to Plan B. A basic attack takes only the Table 57 and Table 22 penalties.
- The book says the style's AC bonus "doesn't help" in some circumstances and points at "Unarmed vs. Armor", which lists none. Plan A applies the AC mod unconditionally and records this as a known ambiguity.
- Table 23 hit locations are explicitly cosmetic and are not built.
- The simple "specialize in martial arts" rules are alternative to the Advanced rules ("should not also use"). Plan A builds the Advanced rules only.
- "Knows basic martial arts" is an actor boolean (default off). A style item's learning prerequisite reads it. Campaign/culture rules are not modelled.

## Data model

New Item subtype `martialStyle` (the fifteenth; `system.json` documentTypes, `ITEM_SUBTYPES`, type registry, subtype test):

- `form`: `hard | soft | hardSoft`
- `principalMethod`: `block | kick | lock | movement | push | strike | throw | vitalArea | weapon`
- `slotsInvested`: integer >= 1 (default 1), counted into `spentWeaponSlots` in the character snapshot
- `levelLearned`: integer, set when `slotsInvested` rises, used for the 2-per-level cap
- `availableManeuvers`: array of `{ list, difficulties[] }`, data-only from Table 17 (for Plan B)
- `weaponGroups`: array of tight-group names (data-only, for Plan B)
- Actor: `system.martialArts` = `{ knowsBasics: boolean, activeStyleId: string }`. Both default off/empty, via `initial` functions (not a shared object; see the ObjectField lesson).

A new optional-rule setting **Advanced Martial Arts (PHBR15)**, default off. While off, no panel or list renders, the slot sum ignores styles, and existing wrestling is untouched.

## Architecture

- `src/core/martial-arts/` is pure and Foundry-free: `style.ts` (Table 18 derivation, die mapping), `results.ts` (Table 16), `modifiers.ts` (Table 57, Table 22), `stun.ts`, `slots.ts` (2-per-level cap), `index.ts`.
- `src/data/item/martial-style.ts` is the item model. `src/data/derive/character/` sums style slots into the snapshot.
- Sheet glue mirrors `wrestling-actions.ts`: a Martial Arts panel on the PC Combat tab, a Styles list with the existing ✎/🗑 row controls on Proficiencies, an active-style select, and an Attack button. The attack card reuses the damage-apply relay, so a non-GM seat works. The Character NPC sheet shares the wiring.
- Pack `martial-styles` with the 8 styles.
- Unarmed attack count: `warriorAttacksPerRound` already supplies the class value; the panel shows "+1 attack per round while unarmed" and does not enforce per-round counts (the system does not enforce attack counts elsewhere).

## Testing and verification

- Unit tests for every pure function, including the book's worked examples, the Table 17 = Table 18 equivalence, and the die mapping edge values.
- Headless proof (the Foundry-server harness): schema, `-=` prune not needed, pack import of all 8 styles, slot summing, and the setting-off no-op.
- CI sequence including `npm run test:coverage` (100% gate) before the PR.
- Manual dev-world checklist with explicit prerequisites (give the character a class; set `knowsBasics`; enable the rule; reset the setting between checks), a non-GM seat, and what number the UI shows.

## Risks

- Damage follows reading R3 (Table 16 number only; decided with the user). If play shows martial artists too weak without the style die, revisit when Plan B lands, since the style die is already stored and derived.
- A new item subtype touches registries and the drop rules; follow the `kit` precedent file-for-file and use the census tests.

## Amendments made at plan time (2026-10-12)

- The 2-slots-per-level cap and `levelLearned` move to Plan B, where maneuvers are actually bought; Plan A stores `slotsInvested` only.
- Owned styles always count into the weapon-slot sum (a style only exists if someone added it); the setting gates the panel and the AC modifier only.
- Stun/incapacitate is a card prompt stating the rule; no automated target save.
- There is no "pull" option; the player does not press Apply.
- The panel is PC-only (the Character NPC sheet is unchanged, as with SP20 tracking) and lives on the Main tab beside Wrestle, with the owned styles listed inside it.
- The active style's AC modifier is applied through derived AC (snapshot -> `deriveAc`), gated by the setting.
