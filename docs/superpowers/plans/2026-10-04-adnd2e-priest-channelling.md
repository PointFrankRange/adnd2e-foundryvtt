# Priest Channelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clerics and druids with the Channellers toggle on spend a persisted, recoverable priest spell-point pool on every cast, with Table 20 recovery and Table 21 fatigue, the same as wizard channellers.

**Architecture:** The derive layer adds a priest channelling record whose max is the priest spell-point total (Table 26, Wisdom bonus, Constitution adjustment). The actor stores `spellcasting.priest.channelling` alongside the wizard one. The existing channelling glue functions take the caster key, so the priest branch reuses the same spend, recovery and fatigue paths. Memorizing costs nothing from a priest pool under channelling, as for wizards.

**Tech Stack:** TypeScript, Foundry v14 DataModels, vitest, Handlebars.

**Spec:** [docs/superpowers/specs/2026-10-04-adnd2e-priest-channelling-orisons-design.md](../specs/2026-10-04-adnd2e-priest-channelling-orisons-design.md) (PR 2 section)

## Global Constraints

- The Channellers gate is `channellersEnabled(rules)` from `src/core/magic/channellers.ts`. Never restate it.
- The priest pool applies only to the `priest` progression: use `isPriestPoolProgression` from `src/core/magic/class-slots.ts`. Paladins and rangers never channel.
- The priest channelling max is `priestSpellPointTotal(level, wis, conHpAdjustment)` from `src/core/magic/priest-spell-points.ts`, which already includes the Wisdom bonus and applies the book's 4-SP rule. Do not add a second formula.
- Pure code in `src/core/**` and `src/data/derive/**` keeps 100% line, statement and function coverage (branches >= 90).
- Spend per cast uses `magickCost`-based costs for wizards; for priests it uses `priestTheurgyCost(level, type, scope)`. A channelled priest cast spends that cost.
- Orisons cost 1 SP per cast under channelling (`ORISON_COST_SP` from `src/core/magic/priest-orisons.ts`, built in the orison plan), and memorizing them is free. Table 29 has no level-0 row, so orisons never reach `priestTheurgyCost`.
- Do not run `npm install`, `npm update`, or any formatter. Do not use `git stash`. Do not run `npm run build` without asking.
- Read vitest output via tail or redirect into the scratchpad, never grep.
- Preserve CRLF line endings in every file you edit.

---

### Task 1: Derive the priest channelling record and persist it

**Files:**
- Modify: `src/data/derive/character/channellers.ts` (add a priest branch to `deriveChannelling`)
- Modify: `src/data/derive/character/derive.ts` (`mergeCasterChannelling`, around line 117, pass the priest level, Wisdom and Constitution through)
- Modify: `src/data/actor/base-actor.ts` (add `priest.channelling` next to the wizard one, around line 213; extend the derived-cache type around line 350 and the write around line 403)
- Test: `tests/data/derive/character/channellers.test.ts` (extend)

**Interfaces:**
- Consumes: `priestSpellPointTotal` from `src/core/magic/priest-spell-points.ts`; `isPriestPoolProgression` from `src/core/magic/class-slots.ts`.
- Produces:
  - `ChannellingInput` gains `priestLevel: number`, `wisScore: number`, `conHpAdjustment: number` (the Constitution adjustment already exists as a field, keep it), so the priest branch can call `priestSpellPointTotal(priestLevel, wisScore, conHpAdjustment)`.
  - `deriveChannelling` returns `{ wizard?: ChannellingRecord; priest?: ChannellingRecord }`. The priest branch applies when `isPriestPoolProgression(chassis.spellProgressionId)`.
  - `spellcasting.priest.channelling` is a SchemaField `{ current: NumberField(initial 0), max: NumberField(nullable, initial null) }`, same shape as the wizard field.

- [ ] **Step 1: Write the failing test**

Add to `tests/data/derive/character/channellers.test.ts`:

```typescript
it("derives a priest channelling max from the priest spell-point total", () => {
  const out = deriveChannelling({
    chassisId: "cleric", level: 5, specialist: false,
    priestLevel: 5, wisScore: 16, conHpAdjustment: 1,
    wisMagicalDefenseAdj: 0,
  });
  // Table 26 level 5 = 40, Wis 16 bonus = 20, Con +1 = 61
  expect(out.priest?.max).toBe(61);
});

it("does not derive a priest channelling record for a paladin", () => {
  const out = deriveChannelling({
    chassisId: "paladin", level: 9, specialist: false,
    priestLevel: 9, wisScore: 16, conHpAdjustment: 0, wisMagicalDefenseAdj: 0,
  });
  expect(out.priest).toBeUndefined();
});
```

Adjust the Wisdom and Constitution values in the first case if the existing fixture uses different names; keep the expected 61 only if the inputs give 40 + 20 + 1.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/derive/character/channellers.test.ts > scratchpad/chan-t1.log 2>&1; tail -20 scratchpad/chan-t1.log`
Expected: FAIL, `out.priest` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/data/derive/character/channellers.ts`, extend the interface and function:

```typescript
export interface ChannellingInput {
  chassisId: ClassId;
  level: number;
  specialist: boolean;
  conHpAdjustment: number;
  wisMagicalDefenseAdj: number;
  priestLevel: number;
  wisScore: number;
}

export function deriveChannelling(input: ChannellingInput): { wizard?: ChannellingRecord; priest?: ChannellingRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType === "wizard" && chassis.spellProgressionId === "wizard") {
    return {
      wizard: { max: channellerMaxSp(input.level, input.specialist, input.conHpAdjustment, input.wisMagicalDefenseAdj) },
    };
  }
  if (chassis.casterType === "priest" && isPriestPoolProgression(chassis.spellProgressionId)) {
    return {
      priest: { max: priestSpellPointTotal(input.priestLevel, input.wisScore, input.conHpAdjustment) },
    };
  }
  return {};
}
```

Add the imports for `priestSpellPointTotal` and `isPriestPoolProgression`.

In `derive.ts`, `mergeCasterChannelling` passes `priestLevel: c.level` and `wisScore: snapshot.abilities.wis` alongside the existing fields, and its return type becomes `{ wizard?: ChannellingRecord; priest?: ChannellingRecord }`.

In `base-actor.ts`, add next to the wizard `channelling` SchemaField a matching `channelling` SchemaField on the `priest` block, with `current` NumberField `initial: 0` and `max` NumberField `nullable: true, initial: null`, copying the wizard field's comments. Extend the derived-cache type with `priest: { channelling: { max: unknown } }`, and write `if (derived.channelling.priest) sys.spellcasting.priest.channelling.max = derived.channelling.priest.max;` beside the wizard write.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/derive > scratchpad/chan-t1.log 2>&1; tail -20 scratchpad/chan-t1.log`
Expected: PASS, including the existing wizard channelling tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/derive/character src/data/actor/base-actor.ts tests/data/derive/character/channellers.test.ts
git commit -m "feat(channelling): derive and persist a priest channelling pool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Spend the priest pool on each cast

**Files:**
- Modify: `src/sheets/character/spell-actions.ts` — `tryChannellingSpend` (line 350), `castSpell` (line 426), `castFreeTheurgy` (line 699), `memorizeSpell` and `memorizeFreeTheurgy` (channelling memorize is free)
- Test: `tests/sheets/character/spell-actions.test.ts` (extend)

**Interfaces:**
- Consumes: `priestTheurgyCost` (`src/core/magic/priest-spell-points.ts`), `canAffordCast`/`spendCastSp` (`src/core/magic/channellers.ts`) — note those two take a `MagickType` and use Table 18 costs, so for priests add a priest-cost variant rather than reusing them.
- Produces:
  - `priestCanAffordCast(current: number, cost: number): boolean` and `priestSpendCast(current: number, cost: number): number` in `src/core/magic/priest-spell-points.ts`.
  - `tryChannellingSpend` gains a `caster: "wizard" | "priest"` parameter and reads `spellcasting[caster].channelling.current`, pricing wizard casts with `magickCost` and priest casts with `priestTheurgyCost`.
  - `castSpell` and `castFreeTheurgy` pass the caster key; a priest channelling cast writes `system.spellcasting.priest.channelling.current`.

- [ ] **Step 1: Write the failing test**

Add to `tests/sheets/character/spell-actions.test.ts`:

```typescript
it("spends the priest pool on a channelled cast and writes the priest channelling current", async () => {
  // actor: priest channelling current 40, spell "clw" priest, level 1, fixed, scope major (cost 4)
  await castSpell(actor, "clw");
  expect(actor.update).toHaveBeenCalledWith(
    expect.objectContaining({ "system.spellcasting.priest.channelling.current": 36 }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/chan-t2.log 2>&1; tail -30 scratchpad/chan-t2.log`
Expected: FAIL, the cast writes the wizard path or nothing.

- [ ] **Step 3: Write minimal implementation**

In `src/core/magic/priest-spell-points.ts`, add:

```typescript
/** Whether a channelled priest's pool covers one cast's Table 29 cost. */
export function priestCanAffordCast(current: number, cost: number): boolean {
  return cost <= current;
}

/** The pool after one channelled cast of this Table 29 cost. */
export function priestSpendCast(current: number, cost: number): number {
  return current - cost;
}
```

In `spell-actions.ts`, change `tryChannellingSpend` to take the caster key and the cost:

```typescript
export function tryChannellingSpend(
  actor: SpellcasterActor,
  caster: "wizard" | "priest",
  spellLevel: number,
  magickType: "fixed" | "free",
  scope: TheurgyScope,
): number | null {
  const current = actor.system.spellcasting[caster].channelling.current ?? 0;
  if (caster === "wizard") {
    if (!canAffordCast(current, spellLevel, magickType)) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
      return null;
    }
    return spendCastSp(current, spellLevel, magickType);
  }
  // Orisons (level 0) cost 1 SP per cast (priest orisons plan); Table 29 has no level-0 row.
  const cost = spellLevel === 0 ? ORISON_COST_SP : priestTheurgyCost(spellLevel, magickType, scope);
  if (!priestCanAffordCast(current, cost)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return null;
  }
  return priestSpendCast(current, cost);
}
```

Update the callers: `castSpell` passes `key` and the entry's theurgy scope (`entry.theurgyScope ?? "major"` for priests) and writes `system.spellcasting.${key}.channelling.current`. `castFreeTheurgy` passes `"priest"` and `scope`, and writes `system.spellcasting.priest.channelling.current`. Keep the wizard call sites passing `"wizard"` and the scope `"major"`.

Channelled priest memorize costs nothing: in `memorizeSpell` and `memorizeFreeTheurgy`, when channelling is on for a priest, skip the pool check and keep the Table 26 caps (per-level cap and max spell level), the same way the wizard path does.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/chan-t2.log 2>&1; tail -30 scratchpad/chan-t2.log`
Expected: PASS, and the wizard channelling tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/core/magic/priest-spell-points.ts src/sheets/character/spell-actions.ts tests/sheets/character/spell-actions.test.ts
git commit -m "feat(channelling): spend the priest pool on channelled casts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Recover the priest pool and apply fatigue

**Files:**
- Modify: `src/sheets/character/spell-actions.ts` — `recoverChannellerSp` (line 749) takes a caster key; `applyCastFatigue` (line 372) reads `spellcasting[caster].channelling.max`
- Modify: `src/sheets/character/sheet.ts` and `src/sheets/character/recover-dialog.ts` only if the recover action needs the caster key passed through
- Test: `tests/sheets/character/spell-actions.test.ts` (extend)

**Interfaces:**
- Consumes: `recoverSp` (`src/core/magic/channellers.ts`), `resolveCastFatigue` (`src/core/magic/channeller-fatigue.ts`).
- Produces: `recoverChannellerSp(actor, caster, activity, hours)` writes `system.spellcasting[caster].channelling.current`. `applyCastFatigue(actor, caster, spellLevel, preDeductionSp)` reads the matching max.

- [ ] **Step 1: Write the failing test**

```typescript
it("recovers the priest pool under Table 20 and writes the priest current", async () => {
  // actor: priest channelling current 10, max 61; resting 8 hours
  await recoverChannellerSp(actor, "priest", "sleeping", 8);
  expect(actor.update).toHaveBeenCalledWith({ "system.spellcasting.priest.channelling.current": 61 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/spell-actions.test.ts > scratchpad/chan-t3.log 2>&1; tail -30 scratchpad/chan-t3.log`
Expected: FAIL, the recover action has no caster parameter.

- [ ] **Step 3: Write minimal implementation**

Change `recoverChannellerSp` to take `caster` as its second parameter and read/write `actor.system.spellcasting[caster].channelling`. Change `applyCastFatigue` to take `caster` and read `actor.system.spellcasting[caster].channelling.max`. Update its callers in `castSpell`, `castFreeTheurgy` and `casting-actions.ts` (the Expanded Casting Time begin path) to pass the caster key.

In `sheet.ts`, the recover action currently dispatches `recoverChannellerSp` for the wizard. Pass `"wizard"` there, and add a priest recover button in `spells.hbs` next to the existing channelling Recover button, which dispatches the same action with `"priest"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character tests/templates > scratchpad/chan-t3.log 2>&1; tail -30 scratchpad/chan-t3.log`
Expected: PASS, including the template binding test.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character templates/actor/pc/spells.hbs tests/sheets/character/spell-actions.test.ts
git commit -m "feat(channelling): recover the priest pool and apply priest fatigue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Priest channelling on the sheet

**Files:**
- Modify: `src/sheets/character/context.ts` — `buildSpells` (around line 680: `channellingOn`, `wizardChannelling`) and `buildSpellRow` (around line 880, the channelling `canCastChannelling` branch)
- Modify: `src/sheets/character/context-types.ts` — add `priestChannelling` to the spells context
- Modify: `templates/actor/pc/spells.hbs` — priest channelling bar in the same else-if chain as the wizard bar
- Test: `tests/sheets/character/context.test.ts` (extend)

**Interfaces:**
- Consumes: `priestPoolOn` (already in `buildSpells`); `priestTheurgyCost`; `priestCanAffordCast` (Task 2).
- Produces: `CharacterSheetContext["spells"].priestChannelling: { current: number; max: number } | null`, and a priest row's `canCast` is live pool affordability under channelling. When channelling is on, the priest SP bar and classic slot rows are hidden, as for wizard channellers.

- [ ] **Step 1: Write the failing test**

```typescript
it("shows the priest channelling bar when channelling is on for a cleric", () => {
  const c = buildCharacterSheetContext(
    priestInputWithPool({ remaining: 40 }, { optionalRules: channellingRules, channelling: { current: 30, max: 61 } }),
  );
  expect(c.spells.priestChannelling).toEqual({ current: 30, max: 61 });
  expect(c.spells.priestSpellPoints).toBeNull();
});
```

`channellingRules` is the optional-rules fixture with `channelers: true` and the spell-points rules on; `channelling` is the priest channelling field on the fixture's derived spellcasting. Reuse the fixture helpers the wizard channelling tests use, and add the `priest.channelling` field to the priest input.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheets/character/context.test.ts > scratchpad/chan-t4.log 2>&1; tail -30 scratchpad/chan-t4.log`
Expected: FAIL, `priestChannelling` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `buildSpells`, compute `priestChannellingOn = channellersEnabled(input.optionalRules) && priestPoolOn`, and set `priestChannelling` to `{ current, max }` when that is true and `max` is a number, else `null`. Set `priestSpellPoints` to `null` when `priestChannellingOn` is true (the pool is replaced by channelling, as for wizards). In `buildSpellRow`, for a priest row under channelling, set `canCast` from `priestCanAffordCast(current, priestTheurgyCost(item.level, type, scope))`, mirroring the wizard row. Add `priestChannelling` to `context-types.ts`.

In `spells.hbs`, add an `{{else if adnd2e.spells.priestChannelling}}` bar beside the wizard channelling bar, with the same markup and the existing channelling Recover button bound to the priest recover action (Task 3).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheets/character tests/lang tests/templates > scratchpad/chan-t4.log 2>&1; tail -30 scratchpad/chan-t4.log`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/context.ts src/sheets/character/context-types.ts templates/actor/pc/spells.hbs tests/sheets/character/context.test.ts
git commit -m "feat(channelling): priest channelling bar and live cast eligibility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Gates and dev-world check

**Files:** none changed in this task.

- [ ] **Step 1: Run the full gate**

Run: `npx vitest run --coverage > scratchpad/chan-gate.log 2>&1; tail -12 scratchpad/chan-gate.log`
Expected: exit 0 with 100% statements, lines and functions.

Run: `npm run typecheck > scratchpad/chan-tc.log 2>&1; tail -8 scratchpad/chan-tc.log`
Expected: clean.

- [ ] **Step 2: Ask the user to build and test**

Ask the user to close Foundry, then run the build from this branch. Dev-world checklist for the user:
1. Turn on Spells & Magic, Spell Points and Channellers. A cleric at level 5 with Wisdom 16 shows a channelling bar at 61.
2. Cast a fixed 1st-level theurgy: the bar drops by 4. Cast a free theurgy: it drops by the Table 28 free cost.
3. Memorize spells: the bar does not change.
4. Rest with the Recover action: the bar climbs back under Table 20.
5. Cast a heavy spell until the pool is low: fatigue appears on the sheet.
6. Repeat on a non-GM player seat.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin <branch>
gh pr create --base master --title "Priest channelling under the Channellers toggle" --body "..."
```

Put a summary, the test plan with the checklist above, and the attribution line in the body.
