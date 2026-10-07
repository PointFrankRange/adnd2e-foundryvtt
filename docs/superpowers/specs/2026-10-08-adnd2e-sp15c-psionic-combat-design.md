# Psionic combat (Sub-project 15, Plan C) - Design

Date: 2026-10-08. Source: *The Complete Psionics Handbook* (PHBR5) Chapter 2 "Psionic Combat" pp.22-27 (read from the page images) and Table 14 "Attack vs. Defense Modes" (p.26); the telepathic attack and defense mode powers (Chapter 7) are already in the `powers` pack (SP15 Plan B). Builds on SP15 Plans A and B. Tracked as part of issue #83; Plan D (wild talents) follows.

## Approved decisions

- **Automate the economy, keep effects descriptive.** What an attack mode does to an opened mind (ego whip's penalty, psychic crush, etc.) stays the power's text. The system resolves the contest, the PSP costs, the tangents and full contact.
- **Attack button** on each of the five telepathic attack modes (Mind Thrust, Ego Whip, Id Insinuation, Psychic Crush, Psionic Blast), using the user's first targeted token.
- **Defender state is an active defense mode** on the defender's own actor: a Raise button (pays the defense mode's initial cost, marks it active) and a Drop button. A target with no raised defense is treated as undefended (a successful attack is a tangent).
- **Defender rolls:** if the target's actor has a **non-GM owner who is online**, the attacker's client posts a pending contest card and that player rolls their own defense with a "Roll defense" button (the active GM may roll it too). Otherwise (a GM-owned actor, a Monster NPC, an offline owner) the attacker's client rolls the defense automatically and posts the resolved card.
- **Tangents** are tracked per target on the **attacker**: one or two tangents cost 1 PSP per round to hold and only one mind at a time; three tangents are full contact (free to hold, any number of minds). A tangent breaks when the attacker ends it, cannot or does not pay the upkeep, attacks a different target, or is incapacitated (by hand). Starting a tangent on a different target breaks the old partial tangents.
- **One-two punch:** an attack mode makes two attacks per use, both against the same target, each a separate contest. The initial cost covers both: the full initial cost if either check succeeds, half (rounded up) if both fail. If the first attack completes full contact the second is not made.
- **Characters only:** Player Characters and Character NPCs with a psionicist class can raise defenses. Monster NPCs and non-psionic targets are undefended. Psionic monsters stay out of scope (the spec for SP15).
- **Honor-system rules, not automated** (one follow-up issue): one power per round, half movement while using a power, disruption of a power in the preparatory round, a defender keeping a good defense roll for the rest of the round, the +1 bonus for a maintained power in a contest (the pure helper ships, the sheet does not apply it), and psychic lock (a contest between two non-attack powers and the 4d4 PSP backlash).

## Rules summary (PHBR5 pp.22-27)

- **Psychic contest:** both sides make their power check. The character with the higher *successful* roll wins; if neither check succeeds, or the rolls are equal, the defender wins. If only the attacker's check succeeds the attacker wins; if only the defender's succeeds the defender wins. If the attacker's successful roll is higher than the defender's power score the attacker wins automatically (no defense roll can beat it). With no defender the attacker wins on a successful check. A natural 1 is always a success and a 20 always a failure (Plan A's `rollPowerCheck`).
- **Table 14:** the attack mode's modifier against the defender's active defense mode is added to the attacker's power score (positive is a bonus):

| | Mind Blank | Thought Shield | Mental Barrier | Intellect Fortress | Tower of Iron Will |
|---|---|---|---|---|---|
| Mind Thrust | +5 | -2 | -4 | -4 | -5 |
| Ego Whip | +5 | 0 | -3 | -4 | -3 |
| Id Insinuation | -3 | +2 | +4 | -1 | -3 |
| Psychic Crush | +1 | -3 | -1 | -3 | -4 |
| Psionic Blast | +2 | +3 | 0 | -1 | -2 |

- **Tangents:** each time an attack mode overcomes a defense mode (or succeeds against someone using none) the attacker has a tangent; three tangents equal full contact, after which the attacker can make no more attacks that round and may use any telepathic power against the target the next round. Maintaining one or two tangents costs 1 PSP per round, on one mind at a time; full contact can be kept on any number of minds.

## Pure rules: `src/core/psionics/combat.ts`

- `ATTACK_MODES`, `DEFENSE_MODES` (the five names each) and `attackModifier(attack, defense | null)`: the Table 14 matrix, 0 for no defense.
- `resolveContest({ attackRoll, attackScore, defenseRoll, defenseScore })` returning `{ winner: "attacker" | "defender", reason: "unopposed" | "automatic" | "higher" | "attacker-only" | "defender-only" | "neither" | "tie" }`. `defenseRoll`/`defenseScore` are null when there is no defender; `defenseRoll` is null when only the automatic-win test is needed.
- `maintainedCheck(roll, score)`: the +1 bonus and the "failed check counts as a success of 1" rule (helper only).
- `FULL_CONTACT = 3`; `Contact { target: string; name: string; tangents: number }`; `recordTangent(contacts, target, name)` (adds one tangent, capped at 3; breaks the partial tangents on any other target; a full contact on another target is kept); `breakTangents(contacts, target?)`; `isFullContact(c)`; `upkeepDue(contacts)` (1 PSP when any partial tangent exists, else 0). All Foundry-free, 100% covered.

## Data

`system.psionics` (SP15 Plan A) gains `activeDefense: string` (an owned defense-mode power item id, blank = none) and `contacts: ArrayField(SchemaField({ target: string, name: string, tangents: int 0..3 }))` with `initial: () => []`. No migration (schema defaults). The derived psionics block and the gating (`psionics.level > 0`) are unchanged.

## Actions and chat (Foundry glue)

- `raiseDefense(actor, powerId)` / `dropDefense(actor)`: psionicist only; the power must be an owned `defense` power; Raise pays its initial cost (refused when the pool is short) and sets `activeDefense`.
- `attackMode(actor, powerId)`: psionicist only; the power must be one of the five attack modes (by name), an owned `power` item; needs one targeted token (else a toast); pool at least the full initial cost; refuses a target that is the attacker. Resolution per attack (one or two): the attacker rolls their power check (score = ability + modifier + scoreBonus + Table 14 modifier for the target's active defense); the defense score is the target's active defense power's score (target's prepared ability + modifier + scoreBonus; none = unopposed). Cost paid once (see above) on the attacker's actor in the same update that records the tangents when the result is immediate.
  - **Automatic target** (no online non-GM owner, or undefended): the attacker's client rolls the defense and posts one resolved chat card per attack (or one card with both attacks), then updates the attacker's contacts.
  - **Player-owned target** with a raised defense: the attacker's client posts a pending contest card whose flags carry the attack roll, score, modifier, the attacker's actor uuid and user id and a contest id; the target's owner (or the active GM) presses "Roll defense" on the card, their client rolls the defense, posts the resolved card (flagged with the result) and the **attacker's client** (on `createChatMessage`, matching the attacker user id) records the tangent on the attacker's actor, idempotent by contest id. If the attacker is offline the resolved card carries a "Record tangent" button for the attacker actor's owners.
- `payUpkeep(actor)` (1 PSP; when the pool is short the partial tangents end), `endContact(actor, target)`.
- A chat card template for pending, resolved (attack roll against score, the modifier, the defense roll against score, the winner and reason, the tangent count or full contact) and the lang keys. Chat buttons use the existing `renderChatMessageHTML` listener pattern in `src/chat/chat-listeners.ts`; the result hook follows `src/hooks/casting-hooks.ts`.

## Sheet

The Psionics tab gains a "Psionic combat" panel: the active defense (select of owned defense modes with Raise and Drop), the contacts list (name, tangents or "Full contact", Pay upkeep and End), and an Attack button on each attack-mode power row. Shown only with the Psionics tab (gating unchanged).

## Out of scope

Everything listed under "Honor-system rules"; psionic monsters; per-power effect automation; combat cards; the "psychic lock" 4d4 backlash.

## Testing

Pure tests for Table 14 (every cell), `resolveContest` (every outcome in the book's example table: 11 vs 6, 3 vs 9, 4 vs 18, 16 vs 10, 19 vs 15, 8 vs 8, 15 vs automatic win; natural 1 and 20), `recordTangent`/`breakTangents`/`upkeepDue` at 0-3 tangents and the target switch. Action tests with fake actors and exact PSP arithmetic and exact writes (raise, drop, attack with and without a defense, the one-two punch cost rule, full contact stopping the second attack, upkeep, refusals). Chat flow tests with the pending and resolved cards and the result hook's idempotence. Schema defaults, lang and bindings tests. Headless proof: the real schema (`activeDefense`, `contacts`), the real contests against the real catalog's defense powers and scores, the real hook logic, the rendered cards and panel. Manual dev-world check (the user; psionicist PCs with defense modes; two player seats: attacker and a defending player; a GM-owned NPC target): the contest outcomes with exact scores, the defender's Roll defense button on a pending card, tangents 1-2-3 and full contact, upkeep and breaking, a non-GM attacker and a non-GM defender.
