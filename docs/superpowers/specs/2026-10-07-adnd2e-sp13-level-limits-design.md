# Racial level limits and exceeding them (Sub-project 13) — Design

Date: 2026-10-07. Source: the 2026-09 mechanics review, Tier 0 ("XP-multiplier / level adjustment for powerful races"); *The Complete Book of Dwarves* (PHBR6) p. 35 ("Character Class Maximum Levels", "Exceeding Level Limits", the Bonus Levels Table); *The Complete Book of Elves* (PHBR8) p. 69 ("Level Limit Expansion"); *The Complete Book of Humanoids* (PHBR10) pp. 8-10 (Tables 1-2, "Exceeding Level Limits": "two, three or even four times the amount of experience points normally required for each level... cumulative with other experience point multipliers that a humanoid race might have"). Builds on the Sub-project 12 subrace XP surcharge (`actorXpPercentFor`).

## What is already done, and what this adds

Sub-project 12 already ships a per-race XP percentage (a race item's `subrace.xpModifierPercent`, applied at every level lookup through `actorXpPercentFor`); "x2" is simply +100%. What is **not** implemented: racial **level limits** are data only (each race item holds `classLevelLimits`; nothing enforces them, so a dwarf fighter can reach level 20), and the books' **optional rules for exceeding them** do not exist. Humanoid player races (PHBR10) are out of scope (the race id is a closed six-value list); they become a later sub-project.

## Approved decisions

- Three world settings: **`racialLevelLimits`** (boolean, **on by default**: the limits are core 2E), **`exceedLevelLimits`** (choice Off / x2 / x3 / x4, default Off), **`primeRequisiteBonusLevels`** (boolean, default off). Exceeding and bonus levels do nothing unless limits are enforced.
- At a limit, the level stops and XP stops converting to levels; the Level-Up button follows automatically (it appears only when the class has a level it has not yet rolled hit points for).
- Exceeding: each level beyond the limit costs `k` times its normal XP gap, cumulative with the race and kit XP percentage (the percentage scales the gaps first, then `k` multiplies them).
- Bonus levels use the Dwarves book's table, **single-class characters only**; for a class with several prime requisites the **lowest** of them is used.
- Each class is capped by its own limit; a missing or null limit means unlimited (humans, custom races); Character NPCs behave like PCs.
- A character already above a limit is capped when enforcement is on (a GM can switch the setting off).

## Settings

`src/settings/registry.ts` and `src/core/options.ts`:

- `OptionalRules` gains `racialLevelLimits: boolean` (default true), `exceedLevelLimits: 0 | 2 | 3 | 4` (0 = off, default 0), `primeRequisiteBonusLevels: boolean` (default false), each with a doc comment.
- Two boolean descriptors in the registry (`group: "core"`, `config: true`, `requiresReload: true`; the level is derived at prepare time like the other prepare-time rules). `exceedLevelLimits` is registered as a String choice setting beside `playerAppliedEffects` in `src/settings/index.ts` (`choices` off / x2 / x3 / x4, `requiresReload: true`), and `readOptionalRules` maps its stored value (`"off" | "x2" | "x3" | "x4"`, anything else = off) to `0 | 2 | 3 | 4`. Lang keys `ADND2E.settings.<key>.name` / `.hint` for all three plus `ADND2E.settings.exceedLevelLimits.{off,x2,x3,x4}`.

## Pure rules: `src/core/classes/level-limits.ts`

- `bonusLevels(primeRequisiteScore: number): number` returns 0 below 14, 1 for 14-15, 2 for 16-17, 3 for 18, 4 for 19 or more.
- `interface LevelRules { limit: number | null; beyondMultiplier: number }`; `NO_LEVEL_RULES = { limit: null, beyondMultiplier: 0 }`.
- `levelForXpWithRules(chassis, xp, rules)` where `chassis` is already XP-scaled by the race/kit percentage: with `limit === null` it is `levelForXp`; with a limit and `beyondMultiplier === 0` it is `min(levelForXp, limit)`; with a limit and `beyondMultiplier = k > 0`, let `T(L) = xpForLevel(chassis, limit)`: the effective XP is `xp` when `xp <= T(L)`, else `T(L) + floor((xp - T(L)) / k)`, and the level is `levelForXp(chassis, effectiveXp)`. (This is exactly "each XP gap beyond the limit costs k times as much"; the class's own `maxLevel`, e.g. the druid's 14, still applies.)
- `xpToNextWithRules(chassis, xp, rules)` for the sheet progress bar: the same level, plus `next`, `toNextLevel`, `pct`, and `atLimit` (true when `beyondMultiplier === 0`, a limit exists, and the level has reached it; then `next` and `toNextLevel` are null and `pct` is 1). Beyond a limit with `k > 0`, `next = T(L) + k * (T(level + 1) - T(L))` and the band start is `T(L) + k * (T(level) - T(L))`.

## Data layer

- `src/data/derive/class-item.ts`: `classItemLevel(chassisId, xp, xpModifierPercent = 0, rules = NO_LEVEL_RULES)` and `classItemCanLevelUp(chassisId, xp, hpRollsLength, xpModifierPercent = 0, rules = NO_LEVEL_RULES)` use `levelForXpWithRules` over the scaled chassis. Defaults reproduce today's behavior exactly.
- `src/data/derive/character/kits.ts`: new `actorLevelRulesFor(items, chassisId, options, abilityScores)` returning `{ xpPercent, rules }`, where `xpPercent = actorXpPercentFor(items, chassisId)` and `rules` is: unenforced (`!options.racialLevelLimits`) gives `NO_LEVEL_RULES`; otherwise `base` is the first race item's `classLevelLimits[chassisId]` (a number, else null), `bonus` is `bonusLevels(min of the class chassis's prime requisite scores)` only when `options.primeRequisiteBonusLevels` and the actor has exactly one `class` item (else 0), `limit = base === null ? null : base + bonus`, and `beyondMultiplier = options.exceedLevelLimits`.
- `ClassEntry` (the snapshot) gains `levelLimit?: number | null` and `beyondMultiplier?: number`; `deriveClassLevels` passes them to `classItemLevel` / `classItemCanLevelUp`. `snapshotActor(actor, options = getOptionalRules())` fills them with `actorLevelRulesFor` (ability scores from the actor's prepared `system.abilities[k].score`).
- Every level lookup that today calls `actorXpPercentFor` switches to `actorLevelRulesFor` (read `{ xpPercent, rules }`): `src/data/item/class.ts`, `src/sheets/character/combat-rolls.ts` (thief backstab level), `src/sheets/character/proficiency-actions.ts`, `src/sheets/character/spell-actions.ts` (two lookups), and the class view in `src/sheets/character/sheet.ts` and `src/sheets/npc/sheet.ts` (which also gain the new fields on `ClassItemView`: `levelLimit`, `beyondMultiplier`). The pure `xpToNext` in `src/sheets/character/xp.ts` takes the rules and returns `atLimit`.

## Sheet

The class row (`templates/actor/pc/partials/pc-class-row.hbs`, shared with the Character NPC sheet) shows a "(limit)" tag when `atLimit`; the XP bar stops at 100%. New lang keys: `ADND2E.sheet.classRow.atLimit` and the three settings' texts. No new actions.

## Out of scope

- Humanoid player races (PHBR10); a README row for them is added.
- Enforcing which classes a race may take (`allowedClasses`); training time before levelling; how XP is awarded.
- The DMG's alternative prime-requisite XP bonus.

## Testing

- Pure tests: `bonusLevels` at every table boundary (13, 14, 15, 16, 17, 18, 19, 20); `levelForXpWithRules` (no limit unchanged; capped; x2/x3/x4 beyond the limit at the exact thresholds and one XP short; stacking with a scaled chassis; the druid `maxLevel`); `xpToNextWithRules` (capped, beyond the limit, below the limit); the settings reader (booleans, the choice mapping, garbage values).
- Derive tests: `deriveClassLevels` for a dwarf fighter with XP past the limit in each mode; `actorLevelRulesFor` (limit from the race item, missing/null limit, enforcement off, bonus levels single-class versus multiclass, lowest prime requisite, exceed multiplier); a kit/race percentage combined with exceeding.
- Registry and lang tests; the four CI commands; the existing level-threshold tests pass unchanged (defaults reproduce today's behavior).
- Headless proof (real Foundry classes, real shipped race data): the real `deriveCharacter` for a Hill Dwarf fighter (limit 15) with huge XP (capped at 15; with x2 level 16 needs twice the gap; with prime requisite 18 and bonus levels the cap is 18), a Mountain Dwarf (16), a human (unlimited), a deep dwarf (race +10% and x3 stacking), a multiclass dwarf (each class its own cap, no bonus levels), and the Character NPC path; plus the class-row tag.
- Manual (the user; the character needs a class): a Hill Dwarf Fighter with enough XP to pass level 15 shows "(limit)" at 15 and no Level-Up; with the exceed setting at x2 the same character advances past 15 only after twice the normal XP gap; a human is unaffected; turning the enforcement setting off lifts the cap.
