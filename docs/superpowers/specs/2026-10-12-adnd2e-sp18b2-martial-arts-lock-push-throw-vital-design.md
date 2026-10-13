# SP18 Plan B2 — Martial arts maneuvers: Lock, Push, Throw, Vital Area + card Apply buttons (PHBR15 ch.4)

Issue: #86. Source: *The Complete Ninja's Handbook* (PHBR15) ch.4 pp.52-59, Tables 19 and 21 (read from the page images). Builds on Plan A (styles, plain attack) and Plan B1 (maneuver registry, learning engine, use flow, Block/Kick/Strike).

## Scope

15 maneuvers on the B1 engine — **Lock (4), Push (3), Throw (4), Vital Area (4)** — plus:
- a narrow **relay extension** so a card can apply `paralyzed` and `unconscious` (and a rounds duration) to a target;
- card **Apply buttons** for effects that map to a condition;
- the **Learn/Use button layout fix** on the Martial Arts panel (CSS).

B3 (Movement, Weapon, Mental/Physical Training) and Plan C (ch'i + damage resistance) stay later. The automation depth (decided): the roll, modifiers, damage and an **Apply button per condition effect**; the target's saving throw is a prompt line (nothing is rolled for the target); everything with no mechanism (Pain Touch's -2/+2, Sticking Touch's contact bonus, trapped limbs, 24-hour limbs, knock-back distance) is card text.

## Registry additions (id, cost, Table 21 light/mail/plate, damage, effects)

Costs: a number of attacks, "round" (the only action of the round), or 0 (passive). `noDamage` = the attack does no damage.

| Id | Maneuver | Kind / cost | Table 21 | Damage | Effects offered on a hit |
|---|---|---|---|---|---|
| lock:1 | Choke Hold | attack / round | -2 / -3 / -5 | none | Unconscious 1d3 rounds (the hold must be kept to the end of the next round; the victim may break free with an attack roll at -2) |
| lock:2 | Locking Block | attack / 1 | -1 / -1 / -1 | none | text: weapon/arm/leg trapped; +4 to hit with the feet; breaking it costs an attack |
| lock:3 | Incapacitator | attack / 1 | -1 / -2 / -4 | style die + 1d4 + Str | save vs paralyzation or a limb is useless 24 hours (text) |
| lock:4 | Immobilizing | attack / 1 | +1 / +2 / +3 | none | Held (persistent); escape by spending an attack at -6 |
| push:1 | Concentrated Push | attack / 1 | 0 / -1 / -2 | none | knocked back 1 ft per level; past 3 ft: save vs paralyzation or Prone |
| push:2 | Sticking Touch | attack / 1 | 0 / +1 / +2 | none | text: +2 to hit and AC improves 2 while in contact |
| push:3 | One Finger Push | attack / round | none listed (0/0/0) | none | as Concentrated Push, at range 1 ft per level |
| throw:1 | Fall | passive / 0 | none listed | — | always: half damage from falls |
| throw:2 | Instant Stand | passive / 0 | none listed | — | always: regain your feet without the lost round |
| throw:3 | Hurl | attack / 1 | -1 / +1 / +3 | style die + 1d4 + Str | thrown 1d4 feet: Prone; failure loses remaining attacks and next initiative |
| throw:4 | Great Throw | attack / 1 | -1 / -2 / -4 | (style die + Str) x 2 | thrown 1 ft per level (6 ft + 1 per level against a charger): Prone |
| vital:1 | Pain Touch | attack / 1 | -3 / -4 / -5 | none | text: -2 to hit, +2 AC for 1d3 rounds (humans and humanoids only) |
| vital:2 | Stunning Touch | attack / 1 | -2 / -4 / -4 | none | save vs paralyzation or Stunned 1d4 rounds |
| vital:3 | Paralyzing Touch | attack / 1 | -2 / -3 / -4 | none | save at -2 or Paralyzed 2d4 rounds |
| vital:4 | Distance Death | attack / round | 0 / -2 / -3 | none | range 1 ft per level; choose ONE: Pain (no save); Stunning (save -2); Paralysis (save -4); Double Damage (twice the style die, no save) |

Failure text per maneuver is a lang key (the book's "when the attack roll fails" line). Table 21 values for Hurl and Great Throw: Hurl -1/+1/+3, Great Throw -1/-2/-4.

### Registry field changes (B1 `ManeuverDef` extended; B1 rows unchanged)
- `kind` gains `"passive"` (no Use button; the row shows "Always in effect").
- `noDamage: boolean` (parries from B1 and the damage-less attacks above; formula is null).
- `multiplier: number | null` (Great Throw = 2): the formula becomes `(<dice and flat>)*2`.
- `effects: ManeuverEffect[]`, each `{ id, labelKey, save: null | 0 | -2 | -4, condition: null | "stunned" | "paralyzed" | "unconscious" | "held" | "prone", rounds: null | "1d3" | "1d4" | "2d4", doubleDamage?: boolean }`. `save` is the modifier to the target's saving throw vs paralyzation (null = no save).
- The learning engine, order, slot and per-level rules are unchanged; the lists `lock`, `push`, `throw`, `vital` (the style data uses `"vitalArea"` as the list name from Table 17 — the registry list id is `vitalArea`) are added to `MANEUVER_LISTS`.

## Relay extension (security-sensitive, kept narrow)
- `RELAY_CONDITIONS` gains `"paralyzed"` and `"unconscious"` (both already exist as status effects).
- The `condition` request gains an optional `rounds`: integer 1..99. The validator rejects anything else (a float, a string, 0, 100).
- `applyConditionDuration` uses `request.rounds` when present; otherwise the existing table (`stunned: 1`). `held`/`prone` remain persistent.
- The existing approve/auto player-apply setting governs it; the GM-side validator stays authoritative. No new permission surface beyond two more condition ids.

## Card and listener
- A maneuver card lists its effects. An effect with a `save` shows "Target saves vs. paralyzation (modifier)"; an effect with a `condition` shows one button `Apply <Condition> (<rounds>)` (`data-action="applyCondition" data-condition data-rounds`). Pressing it rolls the rounds dice (so they show in chat), then sends `{kind:"condition", conditionId, rounds}` through `requestApply` for every targeted token — a generic chat listener beside `onApplyDamage`.
- Distance Death shows its four alternatives; the Double Damage alternative carries its own rolled total and an Apply Damage button.
- Maneuver damage and `noDamage` behaviour are as B1 (a miss shows the failure text; a natural 20 prompts the stun text for attack maneuvers).

## Layout fix
`.power-row` (shared by the kits panel and the maneuver list) becomes a wrapping flex row (`align-items: center`, small row/column gap) so Learn/Use sit inline after the name and cost text; the `span + span` left margin is replaced by the flex gap. Buttons keep `kit-small`. No template change.

## Testing and verification
Unit tests: the 15 registry rows (Table 21, saves, conditions, rounds, multiplier, passive), the multiplier formula, the view (passive rows have no Use, lock/push/throw/vital rows appear), relay validator (new conditions and `rounds` bounds), duration selection, card effect rows and button data. Headless proof: relay validate round trip for paralyzed/unconscious with rounds, card rendering with effect buttons. CI sequence incl. coverage 100%, `npx vite build` after every task, and a dev-world checklist with a fixture script (non-GM seat applying Stunned/Paralyzed to a token it does not own through the relay).

## Out of scope
Rolling the target's save, Pain Touch / Sticking Touch / Locking Block ongoing effects as conditions, fall damage, B3 lists, ch'i/damage resistance, per-round attack tracking.
