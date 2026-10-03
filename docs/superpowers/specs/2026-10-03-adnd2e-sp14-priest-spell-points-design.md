# Sub-project 14 remainder: Priest Spell Points — Design

Date: 2026-10-03. Source: Player's Option: Spells & Magic, Chapter 6 (printed pp. 91–93). Counterpart to the wizard spell points in Plan A (PR #54).

## Scope

In:
- Priest spell-point progression (Table 26), Wisdom bonus SP (Table 27), and theurgy costs (Tables 28 and 29).
- Memorize, cast, and rest for priests on the existing priest flow when the spell-points rule is on.

Out (deferred):
- Orisons (priest cantrips, Appendix 1).
- Priest channelling.
- Lifting the 3rd-level cap on minor-sphere spells (kept, per your answer).

Included, not deferred: the minor-sphere cost shift (Table 29 Minor Fixed column).

## Gating

Priests use the existing `spellPoints` book rule. The book makes it one optional system for priests and wizards, so no new setting. When the rule is on, a priest's classic priest slots (`priest-slots.ts`, PHB Table 24) are replaced by the SP pool, the same way Plan A replaces wizard slots. When the rule is off, nothing changes.

## Data

**Table 26 (priest level → max spell level, max spells per level, SP).** Levels 1–20 are listed; each level above 21 adds 75 SP, with max spell level 7 and 12 spells per level.

| Priest level | Max spell level | Max per level | SP |
|---|---|---|---|
| 1 | 1 | 3 | 4 |
| 2 | 1 | 4 | 8 |
| 3 | 2 | 5 | 15 |
| 4 | 2 | 5 | 25 |
| 5 | 3 | 6 | 40 |
| 6 | 3 | 6 | 55 |
| 7 | 4 | 6 | 70 |
| 8 | 4 | 7 | 90 |
| 9 | 5 | 7 | 125 |
| 10 | 5 | 7 | 160 |
| 11 | 6 | 8 | 200 |
| 12 | 6 | 8 | 240 |
| 13 | 6 | 8 | 290 |
| 14 | 7 | 9 | 340 |
| 15 | 7 | 9 | 400 |
| 16 | 7 | 10 | 460 |
| 17 | 7 | 10 | 530 |
| 18 | 7 | 11 | 600 |
| 19 | 7 | 11 | 675 |
| 20 | 7 | 12 | 750 |
| 21+ | 7 | 12 | +75 per level |

**Table 27 (Wisdom bonus SP).** Columns are character-level bands (1–2, 3–4, 5–6, 7+), each mapping to the spell level it unlocks (1st, 2nd, 3rd, 4th). Rows: Wisdom 13→4/4/4/4; 14→8/8/8/8; 15→8/15/15/15; 16→8/20/20/20; 17→8/20/30/30; 18→8/20/30/45; 19→12/25/45/60. Below Wisdom 13 the bonus is zero. Wisdom 20+ uses the Wisdom 19 row until the book's rows for 20+ are found (user decision).

**Table 28 (theurgy cost, major access).** Fixed/free by spell level: orison free 1; 1st 4/8; 2nd 6/12; 3rd 10/20; 4th 15/30; 5th 22/44; 6th 30/60; 7th 40/80.

**Table 29 (theurgy cost by sphere access).** Major fixed = Table 28 fixed. Major free = Table 28 free. Minor fixed = one spell level higher than Major fixed (1st 6, 2nd 10, 3rd 15, 4th 22, 5th 30, 6th 40, 7th 50). Universal free = one level higher than Major free (1st 12, 2nd 20, 3rd 30, 4th 44, 5th 60, 6th 80, 7th 100), and orison 1. Tables 28 and 29 agree on the major columns.

## Rules

- **Fixed theurgy:** a spell chosen at memorize time, at the fixed cost for the spell's access tier.
- **Free theurgy:** chosen at cast time. A major free theurgy lets the priest pick any spell of that level in a major sphere of access, at the major free cost. A universal free theurgy lets the priest pick any spell of that level, at the universal cost. The book's free theurgy rule is that its cost tier is set by the priest's choice, not the spell's sphere.
- **Minor access:** minor-sphere spells keep the 3rd-level cap. Their fixed theurgies cost the Table 29 Minor Fixed column (one spell level higher than major). Minor access allows fixed theurgies only, never free ones.
- **Max-per-level and max-spell-level caps** from Table 26 apply to the total of fixed and free theurgies at each level, as in Plan A.
- **Constitution adjustment:** the Constitution hit-point adjustment is added to the total SP (base + Wisdom bonus). If that lowers the total below 4, the adjustment is ignored (book p. 93: "he ignores the adjustments; all priests have at least 4 spell points"). This is not a floor at 4: the Wisdom bonus is kept.
- **Recovery:** SP spent on memorize or cast return after 8 hours of rest. Memorizing takes 10 minutes of prayer per spell level and needs a quiet place (book p. 91).
- **Tied-up SP:** an entry holds its SP until the spell is cast, the same as Plan A's tie-up rule.

## Architecture

- **Pure module** `src/core/magic/priest-spell-points.ts`: the Table 26 lookup, the Table 27 bonus lookup, the Table 28/29 cost lookup, `priestSpellPointTotal`, `priestMaxSpellLevel`, `priestSpellsPerLevelCap`, and `magickCost` extended for priest access tiers. Reuses `canAffordMemorize` and `spellPointsEnabled` from `spell-points.ts`.
- **Derive** `src/data/derive/character/priest-spell-points.ts`: produces the same `spellPoints` shape as the wizard's derive (max, spent, remaining, max spell level, per-level caps), merged in `derive.ts`.
- **Glue:** the priest branch in `src/sheets/character/spell-actions.ts` (memorize, cast, free-theurgy choice) and `context.ts` (the pool, bar, and per-spell cost). Reuses Plan A's SP bar and `canCast` logic.
- **Sphere access:** `src/magic/priest-sphere-access.ts` gives `canMemorizePriestSpell` the major or minor tier for a spell, which the cost lookup reads.

## Testing

- Pure tests cover every Table 26 row, every Table 27 row (Wisdom 13–19), the Constitution floor, the Table 28/29 cost columns, and the free-theurgy tiers.
- The derive and sheet paths get the same drift and coverage checks as Plan A.
- A dev-world check: a priest with the rule on memorizes a fixed major theurgy, a free theurgy, and a minor-access spell; casts and rests; and confirms SP totals.

## Decisions

1. **Minor-sphere cost shift: included, not deferred.** Minor-access fixed theurgies cost the Minor Fixed column of Table 29. The 3rd-level cap stays.
2. **Wisdom 20+:** uses the Wisdom 19 row until the book's rows for 20+ are found.
3. **Gate:** priests share the existing `spellPoints` toggle.
