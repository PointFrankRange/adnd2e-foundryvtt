# Character kit engine, Plan C (base-class overrides) — Design

Date: 2026-10-05. Source: the 2026-09 mechanics review, Tier 0 ("Override, not just add", `docs/mechanics-review-2026-09.md`); *The Complete Paladin's Handbook* (PHBR12) pp. 56-57, the Ghosthunter kit and Tables 17-18, read from the page images (the scan has no text layer). Sub-project 11 of the review, Plan C of three. Builds on Plan A (`2026-10-04-adnd2e-sp11a-kit-engine-design.md`, PR #74) and Plan B (`2026-10-05-adnd2e-sp11b-kit-powers-design.md`, PR #76).

## Rules source (PHBR12 pp. 56-57, Ghosthunter)

- Benefits: innate *dispel evil* from 5th level, uses per day by level bracket (Table 17: levels 1-4 none, 5-9 one, 10-14 two, 15-19 three, 20+ four); innate *remove paralysis* (3 / 4 / 5 / 6 / 7 per day across the same brackets); 95% immunity to paralysis caused by undead; "turns undead as a cleric of the same level" (Table 18).
- Hindrances: cannot learn or cast priest spells; cannot restore hit points by laying on hands; no magical immunity to diseases; cannot cure diseases in others.

## Approved decisions

- **Narrow typed overrides plus one resolver seam.** A kit gets an `overrides` block with only what real kits need now. A single pure `resolveKitOverrides` is the one place consumers read it, so later overrides (for example a kit that grants a spell progression) plug in without touching consumers again.
- **Casting off is hard-blocked** (spell drops, learning and memorizing are refused with a reason toast), matching Plan A's drop rules; the Spells tab hides that class's casting section; spells already known stay but go inert.
- **Turning is a kit rule**: `inherit`, `offset` (level plus an integer, 0 = full class level) or `none`.
- **Abilities the engine does not model** (laying on hands, disease immunity, disease cure, and the like) are listed on the kit as free-text `removedAbilities`, shown struck through on the Kits panel. Display only; no mechanics are invented for them.
- **Level-scaled power uses**: Plan B powers gain `usesByLevel` brackets.
- A **Sample Ghosthunter** kit ships in the `kits` pack (own mechanical data, no book prose) to prove the engine end to end.
- **PC sheets only.** Character NPC and Monster NPC sheets do not show kits.

## Data model

`KitItemModel` (`src/data/item/kit.ts`) gains:

- `overrides` (SchemaField):
  - `casting`: choice `inherit` | `none`, default `inherit`.
  - `turning`: SchemaField `{ mode: inherit | offset | none (default inherit), offset: integer (default 0) }`.
  - `removedAbilities`: array of non-blank strings, default `[]`.
- On each entry of `powers` (Plan B): `usesByLevel`, an array of `{ minLevel: integer >= 1, uses: integer >= 0 }`, default `[]`.

Existing kits and sample kits need no migration: every new field has a default.

## Rules core: `src/core/kits/overrides.ts` and `powers.ts` (pure, unit-tested)

- `resolveKitOverrides(kits, chassisId)` returns `{ castingDisabled: boolean; turning: { mode; offset }; removedAbilities: string[] }`, defaults when no active kit modifies that chassis. Reads one kit per chassis (Plan A hard-blocks a second).
- `effectiveTurnerLevel(chassisId, level, rule)`: `inherit` keeps today's `turnerLevel` (Cleric = level, Paladin = level - 2, everyone else cannot turn); `offset n` is `level + n` and `null` below 1; `none` is `null`. A kit may make a class that cannot normally turn able to (offset on a non-turner).
- `powers.ts`: `powerUses(power, classLevel)` picks the highest `usesByLevel` bracket whose `minLevel` is at or below the level, `0` below the first bracket, or the flat `uses` when the table is empty. `normalizePowers` keeps a scaled power's `per` (a power with a non-empty `usesByLevel` is never coerced to at-will, unlike a flat `uses: 0`). Remaining and `canUse` are computed from `powerUses`; a scaled power with 0 uses at the current level is locked (Use disabled), not at-will. `buildPowerRows` takes the kit's class level.

## Casting off

- Slots, spell points and channelling all derive from one list of caster classes (`casterMembers`, `src/core/classes/multiclass.ts`, consumed by the `mergeCaster*` functions in `src/data/derive/character/derive.ts`). A kit with `casting: none` removes that class from the list, so all three derive nothing in one place.
- The Spells tab does the same filtering at its priest-class lookup (`src/sheets/character/context.ts`), so that class's casting section is not shown.
- `validateItemDrop` (`src/sheets/character/drop-rules.ts`) gains a `kitDisablesCasting` input: a spell drop for a class whose kit disables casting is refused with a reason toast. Learn and memorize actions refuse the same way.
- Spells already known stay on the sheet but are inert; the plan verifies they are not flagged as orphaned.

## Turning

`turnerLevelFor` and `turningPanel` (`src/core/turning`, `src/sheets/character/turning-actions.ts`) receive the actor's active kits and call `effectiveTurnerLevel` per class. The Ghosthunter is `offset 0`, which yields "as a cleric of the same level" using the existing Table 61 data (the book's Table 18 is the cleric progression).

## Sheet and display

The Kits panel (PC only, behind the existing `pcActions` gate) shows: struck-through removed abilities, a "casting disabled" note, a turning note, and scaled uses (`remaining / uses per day` computed at the class level; locked powers show 0 / 0). `buildPowerRows` receives the kit's class level from the sheet context.

## Content and tooling

- A Sample Ghosthunter kit in `packs/kits/_source`: Paladin chassis; no kit ability minimums (the book's Requirements are "Standard", i.e. the Paladin's own, so all zero), no races or alignments restriction, `xpModifierPercent: 0`; `casting: none`; `turning: offset 0`; `removedAbilities`: laying on hands, disease immunity, curing diseases; powers: Dispel Evil (`per: day`, `usesByLevel` brackets at levels 1, 5, 10, 15, 20 giving 0, 1, 2, 3, 4) and Remove Paralysis (3, 4, 5, 6, 7). Manifest, content test and README updated; the pack count assertions are updated from three kits to four.
- The importer passes `system` through to the DataModel, so no importer change.

## Out of scope

- Granting a spell progression (the Ninja Spirit Warrior case) and any other chassis override (hit die, proficiency slots, thief skills, specialization).
- Modeling laying on hands, disease immunity, holy sword or the other unmodeled paladin abilities as real mechanics.
- The 95% undead-paralysis immunity as a mechanic (kept as a free-text benefit only).
- Character NPC and Monster NPC sheets; multiclass handling (Paladins cannot multiclass).

## Testing

- Pure tests: `resolveKitOverrides` with and without a kit; `effectiveTurnerLevel` for inherit, offset 0, offset negative, none, and offset on a non-turner; `powerUses` across levels 1, 4, 5, 9, 10, 20 and an empty table; `normalizePowers` with a scaled power; `buildPowerRows` locked and unlocked; derive tests: a Paladin with the kit gets no spell slots, spell points or channelling, without it unchanged; drop-rule verdicts; schema, drift and lang tests; the pack builds; the four CI commands (`npm run typecheck`, `lint`, `test:coverage`, `build`) pass.
- Headless proof (the repo's Foundry-in-Node harness): real schema validation of the sample kit, casting-off through the real derive, spell drop blocked, turn level with and without the kit, scaled uses at several levels, and the rendered Kits panel.
- Manual (the user), including a **non-GM player seat**: the Spells tab actually hides that class's casting section; a spell drop is refused with the toast; Use on a locked power is blocked; the struck-through abilities and notes display correctly.
