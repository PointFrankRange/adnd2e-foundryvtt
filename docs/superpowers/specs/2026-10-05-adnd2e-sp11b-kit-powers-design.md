# Character kit engine, Plan B (parametrized granted powers) — Design

Date: 2026-10-05. Source: the 2026-09 mechanics review, Tier 0 ("Generic character-kit engine", "Parametrized granted powers", `docs/mechanics-review-2026-09.md`). Sub-project 11 of the review, Plan B of three. Builds on Plan A (`2026-10-04-adnd2e-sp11a-kit-engine-design.md`, PR #74).

## Approved decisions

- A kit carries **tracked powers**: typed parameters, a use counter, a Use button that posts a chat card, and reset on rest. There is **no automation of a power's actual effect**; the GM narrates shapechange, charm and so on.
- Powers use **one generic schema** (name, frequency, scope label, key/value params), authored through the importer. No typed power kinds, no code change per new power.
- Powers live **inline on the kit item** as a `powers` array, beside `effects`. The existing `grantedFeatures` name list is unchanged.
- Per-actor use counts persist **on the actor**, so the kit item stays a pure definition.
- Rest resets per-day powers: the existing spell Rest button also resets `day` powers, plus explicit New day / New encounter buttons and a per-power reset.
- Sheets: PC, plus Character NPC if it already shows the Kits panel (the plan confirms; if not, left out). Monster NPCs have no kits.
- Content policy holds: mechanical data only, no rulebook prose. Sample powers are generic.

## Data model

`KitItemModel` (`src/data/item/kit.ts`) gains `powers`, an `ArrayField` of `SchemaField`:

- `id`: non-blank slug, unique within the kit. It is the use-tracking key.
- `name`: non-blank string.
- `uses`: integer, min 0. 0 means at-will.
- `per`: choice of `day`, `week`, `encounter`, `at-will`.
- `scope`: string, may be blank (e.g. "mammals").
- `params`: array of `{ key, value }` string pairs.

Normalization is lenient on read: a power with a blank id, a duplicate id, or an invalid `per` is dropped (inert), like a malformed kit effect. `uses: 0` with a non-`at-will` `per` is treated as at-will.

## Per-actor tracking

- New persisted `system.kitPowers` on the base actor: an `ObjectField` (`initial: {}`) keyed `"<kitItemId>:<powerId>"` with `{ used: number }` values.
- Never written by `prepareDerivedData`; only Use, Reset and kit removal write it. This follows the `channelling.current` / `fatigueSaveBonus` precedent. `ObjectField` with `initial: {}` makes an empty object the clean "no usage" signal (the Plan B channellers `ObjectField`-vs-`SchemaField` lesson).
- Stale keys (deleted kit or power) are ignored on read and pruned when a kit item is deleted.

## Rules core: `src/core/kits/powers.ts` (pure, unit-tested)

- `powerRemaining(power, used)` returns remaining uses, or `null` for at-will.
- `canUsePower(power, used)` and `spendPower(power, used)` return the new `used` count.
- `resetPowers(usedMap, kitPowers, per)` clears the entries whose power has the given `per`.
- `buildPowerRows(kitEntries, usedMap)` produces display rows: remaining/total, `per`, scope, formatted params.
- Exported through `src/core/kits/index.ts`.

## Sheet wiring

- A **Powers** block in the Kits panel on the Features tab: name, remaining/max with its `per`, scope, params, a **Use** button (disabled at zero), and a small reset for that one power. At-will powers show Use only.
- Use spends one use and posts a short chat card naming actor, power, scope and remaining uses.
- **New day** resets `day` powers and **New encounter** resets `encounter` powers. `week` powers reset by the per-power reset only. The existing spell Rest action (`restSpellcasting`) also resets `day` powers, so one click covers a rest.
- All writes touch only the actor's own `system.kitPowers`: no target-actor mutation, so a non-GM player seat works (the SP7 Critical).
- Deleting a kit item prunes its keys from `kitPowers`.

## Content and tooling

- The importer, import envelope and pack builder accept `powers`; lang and drift tests cover the new keys; `en` strings added for the block, buttons and chat card.
- The existing sample kits gain one or two generic powers (a Shapechange-style power with a scope and N per day, plus an at-will one) to prove the engine end to end.

## Out of scope

- Automating any power's effect; typed power kinds.
- A general rest system beyond the hooks above.
- Powers that grant spell progressions (the Ninja Spirit Warrior case).
- Plan C: base-class ability overrides (Ghosthunter).
- Bespoke kit mini-mechanics (Wizard Slayer and similar).

## Testing

- Pure tests: remaining/can-use/spend for finite and at-will powers; reset by `per`; row building including params; lenient-read drops (blank id, duplicate id, invalid `per`); stale-key handling.
- Schema, drift and lang tests; the pack builds; `npm run test:coverage` (100% gate) before the PR.
- Dev-world check, **including a non-GM player seat**: use a power to zero (button disables); reset one power; New day and New encounter; the spell Rest button resets day powers; delete the kit and confirm stale counters are gone; import a kit with an invalid `per`; Character NPC sheet if included.
