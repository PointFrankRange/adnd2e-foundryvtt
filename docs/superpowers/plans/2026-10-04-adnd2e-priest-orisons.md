# Priest Orisons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Priests under the spell-points rule can memorize orisons (level-0 priest spells) at 1 SP each, up to twice their Table 26 max spells per level.

**Architecture:** A pure module holds the orison cost and cap. The spell item schema accepts level 0 for priest spells. The priest derive prices orisons at 1 SP inside the existing pool total. The sheet and memorize glue add an Orisons group that follows the pool rules.

**Tech Stack:** TypeScript, Foundry v14 DataModels, vitest, Handlebars.

**Spec:** [docs/superpowers/specs/2026-10-04-adnd2e-priest-channelling-orisons-design.md](../specs/2026-10-04-adnd2e-priest-channelling-orisons-design.md) (PR 1 section)

## Global Constraints

- The spell-points gate is `spellPointsEnabled(rules)` from `src/core/magic/spell-points.ts`. Never restate it.
- The priest pool applies only to the `priest` progression: use `isPriestPoolProgression` from `src/core/magic/class-slots.ts`.
- Pure code in `src/core/**` and `src/data/derive/**` imports nothing from Foundry and keeps 100% line, statement and function coverage (branches >= 90).
- Orisons cost 1 SP each as a universal free theurgy (spec, Table 28/29 orison entry).
- A priest may hold at most twice the Table 26 max spells per level (spec). The cap counts memorized orisons only.
- Level 0 is valid only for `casterClass: "priest"` spells. Wizard level 0 stays rejected by the sheet.
- Do not run `npm install`, `npm update`, or any formatter. Do not use `git stash`. Do not run `npm run build` without asking.
- Read vitest output via tail or redirect into the scratchpad, never grep.
- Preserve CRLF line endings in every file you edit.

---

### Task 1: Orison cost and cap (pure)

**Files:**
- Create: `src/core/magic/priest-orisons.ts`
- Test: `tests/core/magic/priest-orisons.test.ts`

**Interfaces:**
- Consumes: `priestMaxPerLevel(priestLevel: number): number` from `src/core/magic/priest-spell-points.ts`.
- Produces:
  - `ORISON_COST_SP = 1` (number constant)
  - `orisonCap(priestLevel: number): number`: twice `priestMaxPerLevel`
  - `orisonAffords(remaining: number, memorizedOrisons: number, cap: number): boolean`: true when `memorizedOrisons < cap` and `remaining >= ORISON_COST_SP`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { ORISON_COST_SP, orisonAffords, orisonCap } from "../../../src/core/magic/priest-orisons";

describe("orison cap", () => {
  it("is twice the Table 26 max spells per level (a 3rd-level priest holds 10)", () => {
    expect(orisonCap(3)).toBe(10);
  });

  it("uses the Table 26 row for the level (a 1st-level priest holds 6)", () => {
    expect(orisonCap(1)).toBe(6);
  });
});

describe("orison cost and affordability", () => {
  it("costs 1 SP", () => {
    expect(ORISON_COST_SP).toBe(1);
  });

  it("is affordable under the cap with 1 SP left", () => {
    expect(orisonAffords(1, 9, 10)).toBe(true);
  });

  it("is refused at the cap even with SP to spare", () => {
    expect(orisonAffords(50, 10, 10)).toBe(false);
  });

  it("is refused with no SP left", () => {
    expect(orisonAffords(0, 0, 10)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/magic/priest-orisons.test.ts > scratchpad/orison-t1.log 2>&1; tail -20 scratchpad/orison-t1.log`
Expected: FAIL, module `priest-orisons` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// Player's Option: Spells & Magic Ch.6 (Orisons, printed p.93): an orison costs
// 1 spell point and is a free theurgy; a priest may memorize twice the maximum
// spells of one level. Pure.
import { priestMaxPerLevel } from "./priest-spell-points";

export const ORISON_COST_SP = 1;

/** Twice the Table 26 max spells per level for this priest level. */
export function orisonCap(priestLevel: number): number {
  return 2 * priestMaxPerLevel(priestLevel);
}

/** Whether one more orison fits under the cap and the pool still covers 1 SP. */
export function orisonAffords(remaining: number, memorizedOrisons: number, cap: number): boolean {
  return memorizedOrisons < cap && remaining >= ORISON_COST_SP;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/magic/priest-orisons.test.ts > scratchpad/orison-t1.log 2>&1; tail -20 scratchpad/orison-t1.log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/magic/priest-orisons.ts tests/core/magic/priest-orisons.test.ts
git commit -m "feat(orisons): orison cost and cap (pure)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Accept level 0 on priest spell items

**Files:**
- Modify: `src/data/item/spell.ts:11` (the `level` NumberField, `min: 1`)
- Test: `tests/data/item/spell.test.ts` (create if no spell schema test exists; otherwise extend it)

**Interfaces:**
- Consumes: none.
- Produces: spell items may store `level: 0`. The sheet (Task 5) is the only place that treats level 0 as an orison.

- [ ] **Step 1: Write the failing test**

Check first whether `tests/data/item/` already has a spell test (`ls tests/data/item`). Extend it if so. The test asserts a priest spell item can be created at level 0 and a wizard one is still rejected by the sheet's own rule. Use the existing schema test helpers in that directory. Write:

```typescript
it("accepts level 0 for a priest spell (orison)", () => {
  expect(() => SpellItemModel.validateJSON({ casterClass: "priest", level: 0 })).not.toThrow();
});
```

If `validateJSON` is not the helper the existing tests use, use the same call they use.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/item > scratchpad/orison-t2.log 2>&1; tail -20 scratchpad/orison-t2.log`
Expected: FAIL, level 0 is below min 1.

- [ ] **Step 3: Write minimal implementation**

In `src/data/item/spell.ts`, change line 11 from:

```typescript
      level: new NumberField({ required: true, integer: true, min: 1, max: 9, initial: 1 }),
```

to:

```typescript
      // 0 = an orison (priest-only, Spells & Magic Ch.6); wizard cantrips stay unsupported.
      level: new NumberField({ required: true, integer: true, min: 0, max: 9, initial: 1 }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/item > scratchpad/orison-t2.log 2>&1; tail -20 scratchpad/orison-t2.log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/item/spell.ts tests/data/item
git commit -m "feat(orisons): spell items may be level 0 (orisons)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Price orisons inside the priest pool total

**Files:**
- Modify: `src/data/derive/character/spell-points.ts` (the priest branch's `spent` reduction, currently calling `priestTheurgyCost(m.spellLevel, ...)`)
- Test: `tests/data/derive/character/spell-points.test.ts` (extend the priest describe block)

**Interfaces:**
- Consumes: `ORISON_COST_SP` from `src/core/magic/priest-orisons.ts` (Task 1).
- Produces: a priest memorized entry with `spellLevel: 0` costs `ORISON_COST_SP` in `priest.spent`; other entries are priced as before.

- [ ] **Step 1: Write the failing test**

Add to the priest describe block in `tests/data/derive/character/spell-points.test.ts`:

```typescript
it("prices a memorized orison at 1 SP", () => {
  const out = deriveSpellPoints({
    ...priestBase,
    priestMemorized: [{ spellItemId: "o1", spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" }],
  });
  expect(out.priest?.spent).toBe(1);
});
```

`priestBase` is the existing priest fixture in that file; if it has a different name, use the one the other priest tests use.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/derive/character/spell-points.test.ts > scratchpad/orison-t3.log 2>&1; tail -20 scratchpad/orison-t3.log`
Expected: FAIL, `priestTheurgyCost` throws for level 0 (RangeError) or `spent` is wrong.

- [ ] **Step 3: Write minimal implementation**

In `src/data/derive/character/spell-points.ts`, replace the priest branch's `spent` reduction with:

```typescript
    const spent = input.priestMemorized.reduce(
      (sum, m) =>
        sum +
        (m.spellLevel === 0
          ? ORISON_COST_SP
          : priestTheurgyCost(m.spellLevel, m.magickType ?? "fixed", (m.theurgyScope ?? "major") as TheurgyScope)),
      0,
    );
```

Add the import: `import { ORISON_COST_SP } from "../../../core/magic/priest-orisons";`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/derive/character > scratchpad/orison-t3.log 2>&1; tail -20 scratchpad/orison-t3.log`
Expected: PASS, including the existing priest tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/derive/character/spell-points.ts tests/data/derive/character/spell-points.test.ts
git commit -m "feat(orisons): price memorized orisons at 1 SP in the priest pool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Memorize and forget orisons

**Files:**
- Modify: `src/sheets/character/spell-actions.ts` — `memorizeSpell` (line 242) and `canReMemorize`
- Test: `tests/sheets/character/spell-actions.test.ts` (extend)

**Interfaces:**
- Consumes: `orisonCap`, `orisonAffords` (Task 1); `priestPoolOn`/`priestPoolAffords` helpers already in this file.
- Produces: `canReMemorize` returns true for a priest orison only when the pool is on, the caster is a `priest`-pool chassis, and `orisonAffords(remaining, currentOrisonCount, orisonCap(level))` holds. `memorizeSpell` writes `{ spellItemId, spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" }`.

- [ ] **Step 1: Write the failing test**

Add to `tests/sheets/character/spell-actions.test.ts`, reusing the existing pool-actor fixture in that file (it sets a priest pool with `remaining`, `maxPerLevel` and `maxSpellLevel`; set `remaining: 5`, `maxPerLevel: 5` for a 3rd-level priest). The test:

```typescript
it("memorizes an orison at 1 SP under the pool and the 2 x maxPerLevel cap", async () => {
  // actor: pool remaining 5, maxPerLevel 5 (cap 10), no orisons memorized, orison spell item id "o1" level 0
  await memorizeSpell(actor, "o1");
  expect(actor.update).toHaveBeenCalledWith({
    "system.spellcasting.priest.memorized": [
      { spellItemId: "o1", spellLevel: 0, expended: false, magickType: "fixed", theurgyScope: "universal" },
    ],
  });
});

it("refuses an orison once the orison cap is reached", async () => {
  // actor: ten memorized level-0 orisons, pool remaining 5, maxPerLevel 5
  await memorizeSpell(actor, "o11");
  expect(actor.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/orison-t4.log 2>&1; tail -30 scratchpad/orison-t4.log`
Expected: FAIL, the orison is not memorizable (level 0 misses the Table 26 path).

- [ ] **Step 3: Write minimal implementation**

In `canReMemorize`, before the existing priest-pool check, add:

```typescript
  if (key === "priest" && spell.system.level === 0) {
    if (!priestPoolOn(actor)) return false;
    const memorizedOrisons = sc.memorized.filter((m) => m.spellLevel === 0).length;
    const pool = actor.system.spellcasting.priest.spellPoints;
    return orisonAffords(pool.remaining ?? 0, memorizedOrisons, orisonCap(findPriestLevel(actor)));
  }
```

`findPriestLevel(actor)` returns the actor's priest-progression class level, the same way `findPriestChassisId` finds the chassis. Add it next to `findPriestChassisId`, using the same loop over class items and their `level` field.

In `memorizeSpell`, when `spell.system.level === 0`, write the orison entry shown in Step 1 instead of the standard priest entry.

Add the imports `orisonAffords, orisonCap, ORISON_COST_SP` from `../../core/magic/priest-orisons`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/orison-t4.log 2>&1; tail -30 scratchpad/orison-t4.log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/spell-actions.ts tests/sheets/character/spell-actions.test.ts
git commit -m "feat(orisons): memorize orisons against the pool and the orison cap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Orisons group on the sheet

**Files:**
- Modify: `src/sheets/character/context.ts` — `buildSpells` (around line 680) and `buildSpellRow` (around line 880)
- Modify: `src/sheets/character/context-types.ts` — add an `orisons` field to the spells context
- Modify: `templates/actor/pc/spells.hbs` — render the Orisons group above Known Spells
- Modify: `lang/en.json` — add `"orisons": "Orisons"` under `ADND2E.sheet.spells`
- Test: `tests/sheets/character/context.test.ts` (extend the priest spell points describe block)

**Interfaces:**
- Consumes: `orisonCap`, `orisonAffords` (Task 1); `priestPoolOn` from `buildSpells`.
- Produces: `CharacterSheetContext["spells"].orisons: SpellItemView[]`, the level-0 priest rows with `canMemorize` set by the same orison rule as Task 4. Level-0 rows are excluded from the `known` list. With the rule off, `orisons` is `[]`.

- [ ] **Step 1: Write the failing test**

Add to `tests/sheets/character/context.test.ts`, reusing `priestInputWithPool` and `priestSpell`:

```typescript
it("lists a level-0 priest spell under orisons with canMemorize while under the cap", () => {
  const c = buildCharacterSheetContext(
    priestInputWithPool({ remaining: 5, maxPerLevel: 5 }, { spellItems: [priestSpell({ id: "o1", level: 0, name: "Alleviate" })] }),
  );
  expect(c.spells.orisons.map((r) => r.name)).toEqual(["Alleviate"]);
  expect(c.spells.orisons[0]!.canMemorize).toBe(true);
  expect(c.spells.known.flatMap((g) => g.items).some((r) => r.level === 0)).toBe(false);
});

it("shows no orisons with the rule off", () => {
  const c = buildCharacterSheetContext(priestInputWithPool({ remaining: 5 }, { optionalRules: DEFAULT_OPTIONAL_RULES, spellItems: [priestSpell({ level: 0 })] }));
  expect(c.spells.orisons).toEqual([]);
});
```

If `priestInputWithPool` does not accept `maxPerLevel`, set it through its existing pool parameter the same way the other pool tests do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/context.test.ts > scratchpad/orison-t5.log 2>&1; tail -30 scratchpad/orison-t5.log`
Expected: FAIL, `orisons` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `buildSpells`, split the level-0 items out of the `known` loop, and build `orisons` with `buildSpellRow` for the level-0 priest items when `priestPoolOn` is true. When it is false, `orisons` is `[]`. Add `orisons` to the returned object, and add the field to `CharacterSheetContext["spells"]` in `context-types.ts`.

In `templates/actor/pc/spells.hbs`, add above the Known Spells panel:

```handlebars
{{#if adnd2e.spells.orisons.length}}
  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.spells.orisons'}}</div>
    <div class="kit-body">
      {{#each adnd2e.spells.orisons as |s|}}
        <div class="spell-row">
          <span class="name">{{s.name}}</span>
          {{#if s.canMemorize}}
            <button type="button" data-action="memorizeSpell" data-item-id="{{s.id}}">
              {{localize 'ADND2E.sheet.spells.memorize'}}
            </button>
          {{/if}}
          {{#if s.memorized}}
            <button type="button" data-action="forgetSpell" data-item-id="{{s.id}}">
              {{localize 'ADND2E.sheet.spells.forget'}}
            </button>
          {{/if}}
        </div>
      {{/each}}
    </div>
  </section>
{{/if}}
```

Match the classes and localize keys of the existing Known Spells rows if they differ; the rows must look and behave like the rest of the list. Add `"orisons": "Orisons"` to `lang/en.json` under `ADND2E.sheet.spells`, keeping CRLF.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character tests/lang tests/templates > scratchpad/orison-t5.log 2>&1; tail -30 scratchpad/orison-t5.log`
Expected: PASS, including the drift tests.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/context.ts src/sheets/character/context-types.ts templates/actor/pc/spells.hbs lang/en.json tests/sheets/character/context.test.ts
git commit -m "feat(orisons): show orisons in their own group on the priest sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Gates and dev-world check

**Files:** none changed in this task.

- [ ] **Step 1: Run the full gate**

Run: `npx vitest run --coverage > scratchpad/orison-gate.log 2>&1; tail -12 scratchpad/orison-gate.log`
Expected: exit 0 with 100% statements, lines and functions.

Run: `npm run typecheck > scratchpad/orison-tc.log 2>&1; tail -8 scratchpad/orison-tc.log`
Expected: clean.

- [ ] **Step 2: Ask the user to build and test**

Ask the user to close Foundry, then run the build from this branch. Dev-world checklist for the user:
1. Under the spell-points rule, a cleric at level 3 with a level-0 spell sees it under Orisons.
2. Memorize orisons; the pool drops by 1 for each. Ten memorized is the cap; an eleventh is refused.
3. Forget one; the pool returns 1 SP.
4. Turn the rule off: the Orisons group disappears.
5. Repeat the memorize on a non-GM player seat.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin <branch>
gh pr create --base master --title "Priest orisons under the spell-points rule" --body "..."
```

Put a summary, the test plan with the checklist above, and the attribution line in the body.
