# Condition Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give mechanical effects to unconscious, paralyzed, sleeping, incapacitated, dead, invisible, entangled and frightened (issue #94 remainder).

**Architecture:** Pure helper functions in `src/combat/condition-effects.ts` (unit-tested, in the 100% coverage gate), consumed by the two Foundry-glue attack paths (PC `rollAttack`, creature `rollCreatureAttack`). A helpless target forces a hit by reusing backstab's override; the attack card gains a `helpless` flag and its own text line.

**Tech Stack:** TypeScript, Foundry VTT v14 system, Handlebars chat templates, vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-adnd2e-condition-mechanics-design.md`

## Global Constraints

- All numeric values are this project's own design, not transcribed from a rulebook: invisible target -4 to hit, entangled attacker -2, frightened attacker -2.
- Helpless = unconscious, paralyzed or sleeping. `dead` is never a forced-hit target.
- Cannot-act (attack gate) = stunned, held, mortalFatigue (existing) + unconscious, paralyzed, sleeping, incapacitated, dead.
- `contestAllowed("breakFree", …)` keeps the existing exception: a *held* actor may break free. It additionally refuses paralyzed, sleeping, incapacitated, dead (already refuses stunned, unconscious, mortalFatigue).
- Against a helpless target: roll the d20 anyway, force the hit, a natural 20 still rolls the crit table, a natural 1 NEVER fumbles. Backstab on a helpless target keeps its damage multiplier; card text precedence is backstab, then helpless, then natural 20, then natural 1.
- Manual-AC path (0 or several targets): no target actor is known, so nothing is helpless.
- No new settings, schema, migration or compendium changes. `MANAGED_CONDITIONS` / `ManagedConditionId` are the set of conditions a maneuver can *apply* (used by `src/core/combat/maneuvers.ts`) — do NOT add to them.
- Before opening a PR: `npm run test:coverage` (100% statement gate), `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run lint`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Pure condition rules

**Files:**
- Modify: `src/combat/condition-effects.ts`
- Test: `tests/combat/condition-effects.test.ts`
- Modify: `docs/superpowers/specs/2026-10-08-adnd2e-condition-mechanics-design.md` (one line, see Step 6)

**Interfaces:**
- Produces (all exported from `src/combat/condition-effects.ts`, `StatusSet = ReadonlySet<string> | readonly string[]`):
  - `isHelpless(targetStatuses: StatusSet): boolean`
  - `invisibleTargetPenalty(targetStatuses: StatusSet): number` (`-4` or `0`)
  - `entangledAttackPenalty(actorStatuses: StatusSet): number` (`-2` or `0`)
  - `frightenedAttackPenalty(actorStatuses: StatusSet): number` (`-2` or `0`)
  - `canAct` and `contestAllowed` extended (signatures unchanged).

- [ ] **Step 1: Write the failing tests**

In `tests/combat/condition-effects.test.ts`, add to the import list: `isHelpless, invisibleTargetPenalty, entangledAttackPenalty, frightenedAttackPenalty,`. Then replace the `canAct` describe block's last `it` neighbors by appending inside `describe("canAct", …)` (before its closing `});`):

```ts
  it("is false for every incapacitating condition", () => {
    for (const id of ["unconscious", "paralyzed", "sleeping", "incapacitated", "dead", "mortalFatigue"]) {
      expect(canAct([id])).toBe(false);
    }
  });
  it("stays true for conditions that only modify attacks", () => {
    expect(canAct(["entangled", "frightened", "invisible", "deafened", "poisoned", "charmed"])).toBe(true);
  });
```

Inside `describe("contestAllowed", …)` append:

```ts
  it("refuses every incapacitating condition even to break free", () => {
    for (const id of ["paralyzed", "sleeping", "incapacitated", "dead"]) {
      expect(contestAllowed("breakFree", ["held", id])).toBe(false);
    }
  });
```

Append new describes at the end of the file:

```ts
describe("isHelpless", () => {
  it("is true for unconscious, paralyzed or sleeping", () => {
    for (const id of ["unconscious", "paralyzed", "sleeping"]) {
      expect(isHelpless([id])).toBe(true);
      expect(isHelpless(new Set([id]))).toBe(true);
    }
  });
  it("is false otherwise, including dead and held", () => {
    expect(isHelpless([])).toBe(false);
    expect(isHelpless(["dead", "held", "stunned", "prone"])).toBe(false);
  });
});

describe("invisibleTargetPenalty", () => {
  it("is -4 against an invisible target, else 0", () => {
    expect(invisibleTargetPenalty(["invisible"])).toBe(-4);
    expect(invisibleTargetPenalty(["blinded"])).toBe(0);
  });
});

describe("entangledAttackPenalty", () => {
  it("is -2 when entangled, else 0", () => {
    expect(entangledAttackPenalty(["entangled"])).toBe(-2);
    expect(entangledAttackPenalty([])).toBe(0);
  });
});

describe("frightenedAttackPenalty", () => {
  it("is -2 when frightened, else 0", () => {
    expect(frightenedAttackPenalty(new Set(["frightened"]))).toBe(-2);
    expect(frightenedAttackPenalty([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/combat/condition-effects.test.ts`
Expected: FAIL (new exports undefined; extended `canAct` cases fail).

- [ ] **Step 3: Implement**

In `src/combat/condition-effects.ts`:

1. Replace the header comment's second sentence (the "The other 11 shipped conditions … flavor-only markers" sentence) with: `Beyond the 4 curated ones, unconscious / paralyzed / sleeping (helpless), incapacitated, dead, invisible, entangled and frightened gained effects in #94; deafened, poisoned and charmed remain flavor-only markers a GM interprets by hand.` Keep the "own design" sentence.

2. Replace `canAct` and the body of `contestAllowed`'s non-breakFree-exception logic with a shared set. Replace the existing `canAct` and `contestAllowed` functions with:

```ts
/** Conditions that leave an actor unable to take any action; `held` and `stunned` are listed separately in the two
 *  gates below because a held actor may still try to break free. */
const INCAPACITATING: readonly string[] = ["unconscious", "paralyzed", "sleeping", "incapacitated", "dead", "mortalFatigue"];

function anyOf(statuses: StatusSet, ids: readonly string[]): boolean {
  return ids.some((id) => has(statuses, id));
}

/** #94: a target the attacker simply cannot miss — unconscious, paralyzed or asleep. Dead is deliberately not helpless
 *  (there is nothing left to hit). */
export function isHelpless(targetStatuses: StatusSet): boolean {
  return anyOf(targetStatuses, ["unconscious", "paralyzed", "sleeping"]);
}

/** #94: attackers suffer a flat penalty against an invisible target (no see-invisible logic). */
export function invisibleTargetPenalty(targetStatuses: StatusSet): number {
  return has(targetStatuses, "invisible") ? -4 : 0;
}

/** #94: an entangled actor's OWN attack rolls suffer a flat penalty. */
export function entangledAttackPenalty(actorStatuses: StatusSet): number {
  return has(actorStatuses, "entangled") ? -2 : 0;
}

/** #94: a frightened actor's OWN attack rolls suffer a flat penalty. */
export function frightenedAttackPenalty(actorStatuses: StatusSet): number {
  return has(actorStatuses, "frightened") ? -2 : 0;
}

/** Stunned, held or incapacitated (unconscious, paralyzed, sleeping, incapacitated, dead, mortally fatigued): the actor
 *  cannot take an attack action this round. Scoped to attack rolls only (a deliberate v1 simplification) — saving
 *  throws are NOT gated by this, since resisting something happening to you is treated as still possible. */
export function canAct(actorStatuses: StatusSet): boolean {
  return !has(actorStatuses, "stunned") && !has(actorStatuses, "held") && !anyOf(actorStatuses, INCAPACITATING);
}

/** Wrestling follow-ups (SP7e): a holder acts like anyone else, but a HELD character may still try to break free
 *  (being held is what breaking free is for); stunned or any incapacitating condition still rules it out. */
export function contestAllowed(kind: string, actorStatuses: StatusSet): boolean {
  if (kind !== "breakFree") return canAct(actorStatuses);
  return !has(actorStatuses, "stunned") && !anyOf(actorStatuses, INCAPACITATING);
}
```

(Delete the old `canAct` and `contestAllowed` definitions and their doc comments.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/combat/condition-effects.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Correct the spec and commit**

In the spec, in "### 1. Pure rules", replace the last bullet (`MANAGED_CONDITIONS` and the header comment …) with: `- The header comment is updated to list the newly automated conditions. \`MANAGED_CONDITIONS\` is unchanged: it is the set a maneuver can apply, not the set with effects.`

```bash
git add src/combat/condition-effects.ts tests/combat/condition-effects.test.ts docs/superpowers/specs/2026-10-08-adnd2e-condition-mechanics-design.md
git commit -m "feat(conditions): helpless/invisible/entangled/frightened rules and wider can't-act gate (#94)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Attack card `helpless` flag, template and copy

**Files:**
- Modify: `src/combat/card-types.ts` (AttackCardInput ~line 49 area, AttackCardContext ~line 49-60)
- Modify: `src/combat/attack-card.ts`
- Modify: `templates/chat/attack-roll.hbs`
- Modify: `lang/en.json` (`chat.attack`, ~line 868-875)
- Test: `tests/combat/attack-card.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `AttackCardInput.helpless: boolean` (required) and `AttackCardContext.helpless: boolean`; i18n key `ADND2E.chat.attack.helplessHit`. Task 3 passes `helpless` to `buildAttackCardContext`.

- [ ] **Step 1: Write the failing test**

In `tests/combat/attack-card.test.ts`, in the `input()` fixture add `helpless: false,` directly after the `backstab: false,` line (line 13). Append inside `describe("buildAttackCardContext", …)` after the backstab test:

```ts
  it("carries helpless through unchanged, independently of backstab", () => {
    expect(buildAttackCardContext(input({ helpless: true })).helpless).toBe(true);
    expect(buildAttackCardContext(input({ helpless: false })).helpless).toBe(false);
    const both = buildAttackCardContext(input({ helpless: true, backstab: true }));
    expect(both.helpless).toBe(true);
    expect(both.backstab).toBe(true);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/combat/attack-card.test.ts`
Expected: FAIL (`helpless` undefined on the context; `input()` fixture type error is a typecheck issue only).

- [ ] **Step 3: Implement**

`src/combat/card-types.ts`: in `AttackCardInput`, after the `backstab: boolean;` field add:

```ts
  /** true when the single targeted actor is helpless (unconscious / paralyzed / sleeping): the hit was forced. Templates
   *  check `backstab`, then `helpless`, before `autoHit`, because a forced hit on any natural roll must not read
   *  "Natural 20". */
  helpless: boolean;
```

In `AttackCardContext`, change `hit: boolean; autoHit: boolean; autoMiss: boolean; backstab: boolean;` to `hit: boolean; autoHit: boolean; autoMiss: boolean; backstab: boolean; helpless: boolean;`.

`src/combat/attack-card.ts`: after `backstab: input.backstab,` add `helpless: input.helpless,`.

`templates/chat/attack-roll.hbs`: replace the line
`  {{#if backstab}}<p class="result hit">{{localize 'ADND2E.chat.attack.backstabHit'}}</p>` with
```hbs
  {{#if backstab}}<p class="result hit">{{localize 'ADND2E.chat.attack.backstabHit'}}</p>
  {{else if helpless}}<p class="result hit">{{localize 'ADND2E.chat.attack.helplessHit'}}</p>
```

`lang/en.json`: after the `"backstabHit": …` line add `"helplessHit": "Helpless target — automatic hit",`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/combat/attack-card.test.ts tests/lang`
Expected: PASS. (`npm run typecheck` will now FAIL in the two attack paths because `helpless` is a required input — Task 3 fixes that; do not commit with a failing typecheck: do Step 5 only after Task 3, or proceed straight on and commit both together at the end of Task 3.)

- [ ] **Step 5: Commit (together with Task 3 if typecheck is red)**

```bash
git add src/combat/card-types.ts src/combat/attack-card.ts templates/chat/attack-roll.hbs lang/en.json tests/combat/attack-card.test.ts
git commit -m "feat(conditions): helpless flag and card copy on the attack card (#94)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wire both attack paths

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts` (imports lines 5-14; `situationalModifier` ~344; hit/crit/fumble ~364-380; `maneuverEffect` ~404-ish; `buildAttackCardContext` call ~400)
- Modify: `src/sheets/creature/combat-rolls.ts` (imports lines 1-12; `situationalModifier` ~212; hit/crit/fumble ~220-226; `buildAttackCardContext` call ~241)
- Modify: `lang/en.json` (`chat.attack.cannotActWarning`)

**Interfaces:**
- Consumes: Task 1 `isHelpless`, `invisibleTargetPenalty`, `entangledAttackPenalty`, `frightenedAttackPenalty`; Task 2 `helpless` field on `buildAttackCardContext` input.
- Produces: nothing for later tasks.

These two files are Foundry glue outside the coverage gate; correctness is checked by typecheck plus the manual dev-world checklist in Task 4. Read each file around the quoted lines first — line numbers drift.

- [ ] **Step 1: PC path — imports and modifiers**

In `src/sheets/character/combat-rolls.ts` add to the `condition-effects` import: `entangledAttackPenalty, frightenedAttackPenalty, invisibleTargetPenalty, isHelpless,`. In the `attackModifiers({ … situationalModifier: … })` call extend the sum:

```ts
    situationalModifier:
      blindedAttackPenalty(actor.statuses) +
      fatigueAttackPenalty(actor.statuses) +
      entangledAttackPenalty(actor.statuses) +
      frightenedAttackPenalty(actor.statuses) +
      invisibleTargetPenalty(targetStatuses) +
      heldAttackBonus(targetStatuses) +
      armorVsWeaponModifier +
      maneuverPenalty,
```

- [ ] **Step 2: PC path — forced hit, crit, fumble, maneuver, card**

Replace

```ts
  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  const hit = backstabActive ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;
```
with
```ts
  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  // #94: a helpless target (unconscious / paralyzed / sleeping) is a forced hit, like a backstab. targetStatuses is
  // empty on the manual-AC path, so nothing is helpless there. The d20 is still rolled so a natural 20 can crit.
  const helpless = isHelpless(targetStatuses);
  const hit = backstabActive || helpless ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;
```
Leave the `crit` line as is (it already uses `baseHit.autoHit && !backstabActive`, so a helpless natural 20 still crits). Change the fumble line's condition to `critEnabled && baseHit.autoMiss && !backstabActive && !helpless`, and extend its preceding comment with one sentence: `A helpless target cannot dodge or parry, so a natural 1 never fumbles against one either.`

Change `const maneuverEffect = resolveManeuverOutcome(effectiveManeuverId, baseHit.hit);` to `resolveManeuverOutcome(effectiveManeuverId, baseHit.hit || helpless)` and add to its comment: `A helpless target is hit automatically, so a piggy-backed maneuver lands too (unlike backstab, which is deliberately excluded).`

In the `buildAttackCardContext({…})` call add `helpless,` after `backstab: backstabActive,`.

- [ ] **Step 3: Creature path**

In `src/sheets/creature/combat-rolls.ts` add the same four imports. Extend `situationalModifier`:

```ts
    situationalModifier:
      blindedAttackPenalty(actor.statuses) +
      fatigueAttackPenalty(actor.statuses) +
      entangledAttackPenalty(actor.statuses) +
      frightenedAttackPenalty(actor.statuses) +
      invisibleTargetPenalty(targetStatuses) +
      heldAttackBonus(targetStatuses) +
      armorVsWeaponModifier,
```

Replace

```ts
  const hit = hitResult({ naturalD20, attackBonus, thac0, targetAc });

  const critEnabled = rules.combatAndTacticsEnabled && rules.criticalHits;
  const crit = critEnabled && hit.autoHit ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  const fumble = critEnabled && hit.autoMiss ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;
```
with
```ts
  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  // #94: a helpless target is a forced hit. crit/fumble read baseHit so a helpless natural 20 still crits but a
  // natural 1 never fumbles; every later use of `hit` (card, damage roll) sees the forced result.
  const helpless = isHelpless(targetStatuses);
  const hit = helpless ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const critEnabled = rules.combatAndTacticsEnabled && rules.criticalHits;
  const crit = critEnabled && baseHit.autoHit ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  const fumble = critEnabled && baseHit.autoMiss && !helpless ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;
```
In its `buildAttackCardContext({…})` call change `hit, backstab: false,` to `hit, backstab: false, helpless,`.

- [ ] **Step 4: Update the cannot-act warning copy**

In `lang/en.json` change `"cannotActWarning"` to `"This actor is stunned, held, unconscious or otherwise unable to act and cannot attack."`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/sheets/creature/combat-rolls.ts lang/en.json
git commit -m "feat(conditions): wire helpless forced hit and new attack modifiers into both attack paths (#94)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Docs, full gate, dev-world checklist

**Files:**
- Modify: `README.md` (line ~73 `conditions` bullet says "The 15 status-effect condition markers"; line ~88 SP7 row says "the other 11 conditions as flavor markers")

**Interfaces:** none.

- [ ] **Step 1: README**

In the SP7 row replace `prone/blinded/stunned/held mechanics, the other 11 conditions as flavor markers` with `prone/blinded/stunned/held mechanics, plus helpless (unconscious/paralyzed/sleeping: attacks against them are a forced hit), cannot-act (incapacitated, dead), invisible-target, entangled and frightened modifiers; deafened, poisoned and charmed stay flavor markers`. Do not touch the `conditions` pack bullet unless it is factually wrong (check `ls packs/conditions/_source | wc -l`; if the pack count differs from "15", leave it — out of scope).

- [ ] **Step 2: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage`
Expected: green, 100% statement/line/function coverage.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: condition mechanics in the README (#94)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Manual dev-world checklist (hand to the user; Foundry must be rebuilt/loaded from this branch)**

Prerequisites: Combat & Tactics on, Critical hits on. A PC with a Fighter class item and an equipped melee weapon. A Monster NPC with one stat-block attack. A target token with an AC. Reset any setting you change between checks. Test once as GM and once as a non-GM player seat.

1. Target a token, give it **Sleeping** from the Token HUD, roll the PC's attack: the card says "Helpless target — automatic hit" and offers Roll Damage, regardless of the d20.
2. Repeat with **Unconscious** and **Paralyzed** (same result) and **Dead** (normal roll, not forced).
3. Monster NPC attacks the sleeping target: card shows the helpless line and the damage card appears automatically.
4. Force a natural 1 against a sleeping target (see the force-dice recipe memory): no fumble text, no weapon dropped. Force a natural 20: crit text appears.
5. Target **Invisible**: attack card's Situational modifier line shows -4. Give the attacker **Entangled** then **Frightened**: -2 each (and -4 with both).
6. Give the attacker each of Unconscious / Paralyzed / Sleeping / Incapacitated / Dead: attack refused with the new warning text.
7. Held PC with Wrestling on: Break Free still allowed; a held AND paralyzed PC is refused.
8. Deafened / Poisoned / Charmed change nothing.

---

## Self-Review

- **Spec coverage:** §1 pure rules → Task 1; §2 attack paths (modifiers, forced hit, crit/no-fumble, backstab precedence, manual-AC, canAct gate retained) → Task 3 (backstab multiplier untouched; precedence in template, Task 2); §3 card flag/template/copy → Task 2; §4 copy/docs → Task 3 Step 4 and Task 4 (the HUD hint strings about expiry are stale since #140 but unrelated to the new effects; intentionally left); Testing → Tasks 1, 2, 4. The spec's headless-proof item is dropped: both attack paths are Foundry glue (`Roll`, `game.user.targets`, `DialogV2`) the existing harness does not drive, and their new logic is two lines each; coverage comes from the manual checklist.
- **Deviation from spec:** `maneuverEffect` also treats a helpless target as hit (a forced hit should land a piggy-backed called shot/maneuver); the spec was silent. `MANAGED_CONDITIONS` stays unchanged (spec corrected in Task 1 Step 6).
- **Type consistency:** `helpless` is a required boolean on both card types; both callers pass it; `isHelpless`, `invisibleTargetPenalty`, `entangledAttackPenalty`, `frightenedAttackPenalty` names match across tasks.
