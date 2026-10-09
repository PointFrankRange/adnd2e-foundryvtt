# Condition mechanics (issue #94 remainder) — design

Date: 2026-10-08 · Issue: #94 · Branch: `feat/condition-mechanics`

## Background

Timed expiry for system-applied conditions shipped in PR #140 (stunned lasts 1 round; prone and held are deliberately persistent per Combat & Tactics). Grapple escape is covered by the wrestling work (#141, held characters may attempt a break-free contest). What remains of #94 is that 11 shipped conditions are still flavor-only markers.

`src/combat/condition-effects.ts` automates only prone, blinded, stunned and held (plus fatigue tiers and the wrestling gate). This sub-project gives mechanics to a further set. All numeric values are this project's own design, not transcribed from a rulebook.

## Scope (decided)

| Condition | Effect |
|---|---|
| unconscious, paralyzed, sleeping | The actor cannot act (attack gate). Attacks against them are a forced hit ("helpless"). |
| incapacitated, dead | The actor cannot act (attack gate). Dead is never a forced-hit target. |
| invisible (the target) | Attackers suffer -4 to hit. Applies only when the target is invisible; no see-invisible logic. |
| entangled (the attacker) | -2 to the attacker's own attack rolls. |
| frightened (the attacker) | -2 to the attacker's own attack rolls. |
| deafened, poisoned, charmed | Remain labels; the GM adjudicates them. |

Out of scope: spell and psionic attacks, saves, durations/expiry for the new conditions, any new setting, schema or migration, and changes to the `conditions` compendium (the conditions already exist).

## Design

### 1. Pure rules — `src/combat/condition-effects.ts`

No Foundry imports.

- `isHelpless(targetStatuses)` — true for unconscious, paralyzed or sleeping.
- `invisibleTargetPenalty(targetStatuses)` — `-4` when the target is invisible, else `0`.
- `entangledAttackPenalty(actorStatuses)` and `frightenedAttackPenalty(actorStatuses)` — `-2` each when present, else `0`.
- `canAct` additionally returns false for unconscious, paralyzed, sleeping, incapacitated and dead (on top of stunned, held and mortalFatigue).
- `contestAllowed` blocks the same new conditions. The existing exception stands: a *held* character may still attempt `breakFree`.
- `MANAGED_CONDITIONS` and the header comment are updated to match (the "other 11 stay flavor-only" note is replaced by the list of three remaining labels).

### 2. Attack paths — PC and creature

Files: `src/sheets/character/combat-rolls.ts`, `src/sheets/creature/combat-rolls.ts`.

- The new penalties join the existing `situationalModifier` sum alongside blinded, fatigue and held.
- When the single targeted actor is helpless, the hit is forced using the same override backstab already uses (`hit: true, autoHit: true, autoMiss: false`). The d20 is still rolled.
- Crit: because the override leaves `baseHit` untouched, a natural 20 still rolls the crit table (the existing `baseHit.autoHit` check), exactly as for any attack.
- Fumble: never produced against a helpless target (no weapon drop, no self-injury), mirroring the backstab non-stacking rule.
- Backstab on a helpless target: the backstab multiplier still applies. Backstab takes precedence in the card text.
- Manual-AC prompt path (zero or several targets): no target actor is known, so nothing is helpless and the roll resolves normally.
- A helpless forced hit still does not skip the `canAct` check on the attacker.

### 3. Attack card

Files: `src/combat/card-types.ts`, `src/combat/attack-card.ts`, `templates/chat/attack-roll.hbs`, `lang/en.json`.

- `AttackCardInput` and `AttackCardContext` gain a `helpless: boolean`.
- Template precedence: backstab, then helpless, then natural 20, then natural 1. A helpless hit shows a new "Helpless target — automatic hit" line instead of "Natural 20 — automatic hit", which would be wrong on any other roll.

### 4. Copy and docs

- Token HUD hint strings in `lang/en.json` that say conditions have no automatic effect are corrected where they apply.
- The README conditions section gains a sentence listing which conditions now have effects.

## Testing

- Unit tests (`tests/combat/condition-effects.test.ts`) for every new function, including the held/`breakFree` exception and the extended `canAct`.
- Attack-card context tests for helpless, backstab, and backstab plus helpless.
- Coverage gate: `npm run test:coverage` (100%) and the CI typecheck sequence, including the Foundry-free `tsconfig.core.json` typecheck, before opening the PR.
- Headless proof (existing harness, if it supports it): an attack against a sleeping target in both the PC and creature paths forces the hit, rolls no fumble, and posts the helpless card text.
- Manual dev-world checklist (prerequisites stated explicitly): a PC attacker with a weapon, a Monster NPC attacker, a target with each of sleeping / invisible, an attacker with entangled / frightened; run from a GM seat and a non-GM seat. Reset any changed settings between checks.

## Risks

- The two attack paths duplicate their modifier wiring; both must be updated together (the SP6 "display-only" and ammo whole-branch reviews flagged this pattern).
- Forced-hit plumbing differs slightly between the PC path (explicit `hit` override) and the creature path (`hit` from `hitResult`); the implementation plan must read both before editing.
