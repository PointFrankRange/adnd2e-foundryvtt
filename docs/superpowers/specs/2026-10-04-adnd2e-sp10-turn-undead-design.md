# Turn Undead — Design

Date: 2026-10-04. Source: Player's Handbook, Turning Undead and Table 61 (printed p. 103; PDF page 104). Sub-project 10 of the 2026-09 mechanics review.

## Approved decisions

- A creature gets a general **types** field, chosen from a registry. Undead is the first entry. Turn Undead only asks "is this creature `undead`, and which Table 61 row?".
- Scope: good clerics and paladins, with all four outcomes (turn, destroy, the `D*` bonus, and the can't-turn dash).
- Out of scope, parked: evil priests commanding undead, evil priests turning paladins, the shaman talisman, the Ghosthunter kit (needs Sub-project 11), and Character NPC clerics (the button is PC-only, like the other PC-only sheet actions).

## Rules (PHB p. 103)

- Cross-index the undead's type (or Hit Dice) with the turner's level. A paladin counts as two levels lower.
- A number means roll 1d20; equal or higher succeeds. `T` succeeds automatically. `D` destroys the undead. `D*` destroys, and an additional 2d4 creatures of that type are affected. A dash means that level cannot turn that type.
- Only one die is rolled however many undead are targeted. The result is read separately for each type of undead.
- A successful turn or dispel affects 2d6 undead. In a mixed group, the lowest Hit Dice are turned first.
- Only one attempt per character per encounter. Several characters can attempt at once, each resolved separately.
- Druids cannot turn undead.
- Turned undead retreat or flee; they are not mechanically controlled. If forced within ten feet the turning breaks. Both stay table adjudication, outside the rules module.

### Table 61

Columns are priest level: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10-11, 12-13, 14+.

| Type | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10-11 | 12-13 | 14+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Skeleton / 1 HD | 10 | 7 | 4 | T | T | D | D | D* | D* | D* | D* | D* |
| Zombie | 13 | 10 | 7 | 4 | T | T | D | D | D* | D* | D* | D* |
| Ghoul / 2 HD | 16 | 13 | 10 | 7 | 4 | T | T | D | D | D* | D* | D* |
| Shadow / 3-4 HD | 19 | 16 | 13 | 10 | 7 | 4 | T | T | D | D | D* | D* |
| Wight / 5 HD | 20 | 19 | 16 | 13 | 10 | 7 | 4 | T | T | D | D | D* |
| Ghast | — | 20 | 19 | 16 | 13 | 10 | 7 | 4 | T | T | D | D |
| Wraith / 6 HD | — | — | 20 | 19 | 16 | 13 | 10 | 7 | 4 | T | T | D |
| Mummy / 7 HD | — | — | — | 20 | 19 | 16 | 13 | 10 | 7 | 4 | T | T |
| Spectre / 8 HD | — | — | — | — | 20 | 19 | 16 | 13 | 10 | 7 | 4 | T |
| Vampire / 9 HD | — | — | — | — | — | 20 | 19 | 16 | 13 | 10 | 7 | 4 |
| Ghost / 10 HD | — | — | — | — | — | — | 20 | 19 | 16 | 13 | 10 | 7 |
| Lich / 11+ HD | — | — | — | — | — | — | — | 20 | 19 | 16 | 13 | 10 |
| Special | — | — | — | — | — | — | — | — | 20 | 19 | 16 | 13 |

Special covers unique undead, free-willed undead of the Negative Material plane, certain Powers, and outer-plane undead.

## Rules core (pure, unit-tested): `src/core/turning/`

- `TURN_TABLE`: the table above as data, keyed by row id. A cell is a number, `"T"`, `"D"`, `"D*"` or `null` (dash).
- `turnerLevel(classId, level)`: the cleric's level, or the paladin's level minus 2. Returns `null` for any other class, and for an effective level below 1.
- `resolveTurn(d20, effectiveLevel, row)` returns `cannot`, `fail`, `turned`, `destroyed` or `destroyed-bonus`. Levels of 14 and up use the last column.
- `allocateAffected(candidates, affectedCap, bonusCap)`: given the successful targets (each with its row and Hit Dice), returns who is affected. The lowest Hit Dice are taken first, up to the 2d6 cap. `destroyed-bonus` targets also add up to the 2d4 cap of extra creatures of their own row.

## Data

- `details.types`: an array of type ids on the Monster NPC, default empty, validated against `MONSTER_TYPES`. The registry ships with `undead` only; later passes add types as data.
- `details.turning.row`: the Table 61 row id, default empty. It is shown and used only when `types` includes `undead`.
- Sheet: the Monster NPC stat block gets a Types multi-select (the existing checkbox pattern) and, when undead is ticked, a Turn-row select.
- A `turned` condition, a flavor marker like the other non-mechanical conditions: added to `CONDITIONS` and the conditions pack, covered by the drift test.
- An actor flag records "has attempted a turn this encounter". Combat deletion clears it (the pattern in `casting-hooks.ts`), and the GM can reset it from the sheet.

## Flow

- A **Turn Undead** button on the PC sheet, shown only for cleric and paladin classes, using the same gating as the other PC-only actions.
- It reads the user's targeted tokens, rolls one d20 (plus 2d6, and 2d4 when needed), and resolves each target through its type and row. Targets that are not undead, or undead with no row set, are listed as such and skipped.
- One chat card shows the roll, the effective level, each target's outcome, and who was affected.
- Effects go through the existing relay, so non-GM players work and the Player-Applied setting is honored. `turned` applies the condition. `destroyed` applies `dead` and sets HP to 0. The relay's condition list gains `turned` and `dead`.
- A second attempt in the same encounter is blocked with a warning until the GM resets the flag.

## Testing

- Pure tests: every table cell (spot-checked against the page image), the paladin offset, a roll equal to the target number, dashes, `D*` allocation, mixed-type allocation, and the 14+ column.
- Schema and drift tests: `types` and `turning.row` defaults and validation, and the `turned` condition against the pack.
- Dev-world, including a **non-GM player seat** (the last two relay features only broke there): turn a mixed group, a destroy, a `D*` bonus, a blocked second attempt, a GM reset, a paladin at level 3, and a druid with no button.
