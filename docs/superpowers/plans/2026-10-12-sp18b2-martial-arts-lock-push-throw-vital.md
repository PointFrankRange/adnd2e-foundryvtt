# SP18 Plan B2 — Martial Arts Maneuvers: Lock, Push, Throw, Vital Area + Apply Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 15 Lock, Push, Throw and Vital Area maneuvers are learnable and usable on the B1 engine, a maneuver card offers an **Apply &lt;condition&gt;** button per condition effect (applied to targeted tokens through the relay, including `paralyzed` and `unconscious` with a rolled duration), and the Learn/Use buttons sit inline on the Martial Arts panel.

**Architecture:** The pure registry in `src/core/martial-arts/maneuvers.ts` gains 15 rows and four optional fields (`noDamage`, `multiplier`, `effects`, a `passive` kind). The relay (`src/combat/apply-relay.ts`, `src/relay/apply-effect.ts`, `conditionDuration`) gains two conditions and an optional validated `rounds`. The card context lists effects with save lines and button data; a generic chat listener rolls the rounds and relays the condition. A small CSS change fixes the row layout.

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, SCSS, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-12-adnd2e-sp18b2-martial-arts-lock-push-throw-vital-design.md`

## Global Constraints

- Source: PHBR15 ch.4 pp.52-59, Tables 19 and 21. **Content policy:** mechanical values only, short own-wording labels and effect text, no rulebook prose.
- New registry rows (id, slug, kind, cost, Table 21 light/mail/plate, damage, effects). `noDamage` rows have a null damage formula. Costs: number of attacks, `"round"`, or 0.
  - lock:1 chokeHold attack round -2/-3/-5, noDamage, effects [unconscious, save null, rounds 1d3]
  - lock:2 lockingBlock attack 1 -1/-1/-1, noDamage, no effects
  - lock:3 incapacitator attack 1 -1/-2/-4, damage style die + 1d4 + Str, effects [limbUseless save 0, no condition]
  - lock:4 immobilizing attack 1 +1/+2/+3, noDamage, effects [held, save null, no rounds]
  - push:1 concentratedPush attack 1 0/-1/-2, noDamage, effects [prone save 0]
  - push:2 stickingTouch attack 1 0/+1/+2, noDamage, no effects
  - push:3 oneFingerPush attack round 0/0/0, noDamage, effects [prone save 0]
  - throw:1 fall passive 0, throw:2 instantStand passive 0 (no Table 21, no damage, no effects)
  - throw:4 greatThrow attack 1 -1/-2/-4, damage (style die + Str) x 2, effects [prone]; throw:3 hurl attack 1 -1/+1/+3, damage style die + 1d4 + Str, effects [prone]
  - vitalArea:1 painTouch attack 1 -3/-4/-5, noDamage, no effects
  - vitalArea:2 stunningTouch attack 1 -2/-4/-4, noDamage, effects [stunned save 0 rounds 1d4]
  - vitalArea:3 paralyzingTouch attack 1 -2/-3/-4, noDamage, effects [paralyzed save -2 rounds 2d4]
  - vitalArea:4 distanceDeath attack round 0/-2/-3, noDamage, effects [pain save null; stunned save -2 rounds 1d4; paralyzed save -4 rounds 2d4; doubleDamage save null]
- Registry list order: block, kick, strike, lock, push, throw, vitalArea (ids `<list>:<difficulty>`, matching the shipped styles' `availableManeuvers` list names).
- Double damage: `(<dice and flat>)*2` for Great Throw; Distance Death's Double Damage alternative = twice the STYLE DIE only (no Strength): `doubleBasicDamageFormula("1d4")` = `(1d4)*2`, `"1"` = `2`, null = `0`.
- Relay: `RELAY_CONDITIONS` becomes `stunned, prone, held, turned, paralyzed, unconscious`. A `condition` request may carry `rounds`, an integer 1..99; anything else is rejected by `validateRelayRequest`. `conditionDuration(id, hasActed, rounds?)` uses `rounds` when given, else the existing table (`stunned: 1`).
- Card effects show only on a hit. A save line reads "Target saves vs. paralyzation" (modifier 0) or "... at -2" / "-4". The Apply button rolls the effect's `rounds` dice first (so they show in chat), then relays the condition to every targeted token; a double-damage alternative gets an Apply Damage button with its own rolled total.
- Passive maneuvers (Fall, Instant Stand) are learnable, show "Always in effect" and have no Use button; `useManeuver` and `resolveManeuverAttack` reject them.
- The B1 engine rules (per-list order, 1 slot, 2 per level, active style only) are unchanged.
- The panel is PC-only; the Character NPC sheet is unchanged. No new setting, no schema change.
- Labels must not end in an ellipsis; reuse existing CSS classes only (chat census needs no new rule); dialogs via `themedPrompt`.
- Before opening a PR: `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100% statements), `npx vite build` (run it after EVERY task that touches src or styles: invalid UTF-8 bytes in comments pass lint/tsc/vitest but fail the build; use plain ASCII `-` in comments).
- Files may be CRLF: prefer the Edit tool. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/sp18b2-martial-arts-lock-push-throw-vital` (holds the spec).

---

### Task 1: Learn/Use button layout fix

**Files:**
- Modify: `styles/actor/pc.scss` (replace the SP16 `.power-row > span + span` rule)
- Create: `tests/styles/power-row-layout.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/styles/power-row-layout.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PC = readFileSync(path.resolve(__dirname, "..", "..", "styles", "actor", "pc.scss"), "utf8");

describe("power-row layout (SP18 B2)", () => {
  it("is a wrapping flex row so the Learn/Use button sits inline after the spans", () => {
    expect(PC).toMatch(/\.adnd2e\.pc-sheet \.power-row\s*\{[^}]*display:\s*flex[^}]*\}/);
    expect(PC).toMatch(/\.adnd2e\.pc-sheet \.power-row\s*\{[^}]*flex-wrap:\s*wrap[^}]*\}/);
    expect(PC).toMatch(/\.adnd2e\.pc-sheet \.power-row\s*\{[^}]*align-items:\s*center[^}]*\}/);
  });
  it("no longer relies on a left margin between adjacent spans", () => {
    expect(PC).not.toMatch(/\.power-row > span \+ span\s*\{\s*margin-left:\s*8px/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/styles/power-row-layout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `styles/actor/pc.scss`, replace the line `.adnd2e.pc-sheet .power-row > span + span { margin-left: 8px; }` (and keep/adjust its comment above) with:
```scss
// SP16/SP18: power and maneuver rows hold a name, adjacent inline spans and a button. A wrapping flex row keeps the
// button inline after the text (no stray line break) and gives the spans room without per-span margins.
.adnd2e.pc-sheet .power-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
}
```

- [ ] **Step 4: Run to verify it passes, then build**

Run: `npx vitest run tests/styles && npx vite build`
Expected: PASS; build succeeds (SCSS compiles).

- [ ] **Step 5: Commit**

```bash
git add styles/actor/pc.scss tests/styles/power-row-layout.test.ts
git commit -m "fix(sheet): keep Learn/Use buttons inline in power and maneuver rows (SP18 Plan B2)"
```

---

### Task 2: Relay — paralyzed, unconscious and a rounds duration

**Files:**
- Modify: `src/combat/apply-relay.ts` (conditions, `rounds` on the request and validator, `parseConditionButton`)
- Modify: `src/combat/condition-effects.ts` (`conditionDuration` third argument)
- Modify: `src/relay/apply-effect.ts` (pass `rounds` through)
- Modify: `tests/combat/apply-relay.test.ts`, `tests/combat/condition-effects.test.ts`

**Interfaces — produces:**
```ts
export const RELAY_CONDITIONS: readonly ["stunned", "prone", "held", "turned", "paralyzed", "unconscious"];
// RelayRequest condition variant: { kind: "condition"; targetUuid: string; conditionId: RelayConditionId; rounds?: number }
export function parseConditionButton(data: { condition?: string; rounds?: string }): { conditionId: RelayConditionId; roundsFormula: string | null } | null;
export function conditionDuration(conditionId: string, targetHasActed: boolean, rounds?: number): { value: number; units: "rounds"; expiry: "turnStart" | "turnEnd" } | null;
```

- [ ] **Step 1: Write the failing tests**

Add to `tests/combat/apply-relay.test.ts` (use its existing `t` target-uuid constant and imports; add `parseConditionButton` to the import from `../../src/combat/apply-relay`). Also update the existing test "pins the query name, conditions and apply modes" so the expected conditions list is `["stunned", "prone", "held", "turned", "paralyzed", "unconscious"]`.
```ts
describe("relay conditions with a duration (SP18 B2)", () => {
  it("accepts paralyzed and unconscious", () => {
    for (const conditionId of ["paralyzed", "unconscious"]) {
      expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId })).toEqual({ kind: "condition", targetUuid: t, conditionId });
    }
  });
  it("accepts an integer rounds between 1 and 99 and carries it", () => {
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "stunned", rounds: 3 })).toEqual({
      kind: "condition", targetUuid: t, conditionId: "stunned", rounds: 3,
    });
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "paralyzed", rounds: 99 })).toMatchObject({ rounds: 99 });
  });
  it.each([0, -1, 100, 2.5, "3", null, NaN])("rejects rounds %s", (rounds) => {
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "stunned", rounds })).toBeNull();
  });
  it("a condition request without rounds has no rounds key", () => {
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "prone" })).toEqual({
      kind: "condition", targetUuid: t, conditionId: "prone",
    });
  });
});

describe("parseConditionButton", () => {
  it("parses a condition with a dice formula or none", () => {
    expect(parseConditionButton({ condition: "stunned", rounds: "1d4" })).toEqual({ conditionId: "stunned", roundsFormula: "1d4" });
    expect(parseConditionButton({ condition: "held", rounds: "" })).toEqual({ conditionId: "held", roundsFormula: null });
    expect(parseConditionButton({ condition: "unconscious" })).toEqual({ conditionId: "unconscious", roundsFormula: null });
  });
  it("rejects an unknown condition or a malformed formula", () => {
    expect(parseConditionButton({ condition: "dead", rounds: "1d4" })).toBeNull();
    expect(parseConditionButton({})).toBeNull();
    expect(parseConditionButton({ condition: "stunned", rounds: "1d4+999" })).toBeNull();
    expect(parseConditionButton({ condition: "stunned", rounds: "banana" })).toBeNull();
    expect(parseConditionButton({ condition: "stunned", rounds: "0d4" })).toBeNull();
  });
});
```
Add to `tests/combat/condition-effects.test.ts` inside the `conditionDuration` describe:
```ts
  it("an explicit rounds value overrides the table and any persistent condition becomes timed", () => {
    expect(conditionDuration("stunned", false, 3)).toEqual({ value: 3, units: "rounds", expiry: "turnStart" });
    expect(conditionDuration("paralyzed", true, 5)).toEqual({ value: 5, units: "rounds", expiry: "turnEnd" });
    expect(conditionDuration("unconscious", true)).toBeNull();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/combat/apply-relay.test.ts tests/combat/condition-effects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/combat/apply-relay.ts`:
- `export const RELAY_CONDITIONS = ["stunned", "prone", "held", "turned", "paralyzed", "unconscious"] as const;` and update its doc comment (mention SP18 B2).
- In the `RelayRequest` union change the condition variant to `{ kind: "condition"; targetUuid: string; conditionId: RelayConditionId; rounds?: number }`.
- Add a helper above `validateRelayRequest`:
```ts
const MAX_ROUNDS = 99;
function isRounds(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_ROUNDS;
}
```
- Replace the `case "condition":` body with:
```ts
    case "condition": {
      if (!(RELAY_CONDITIONS as readonly unknown[]).includes(r.conditionId)) return null;
      const conditionId = r.conditionId as RelayConditionId;
      if (!("rounds" in r)) return { kind: "condition", targetUuid, conditionId };
      return isRounds(r.rounds) ? { kind: "condition", targetUuid, conditionId, rounds: r.rounds } : null;
    }
```
- Append:
```ts
/** The data on a card's Apply-condition button (`data-condition`, `data-rounds`), or null when malformed. The rounds
 *  formula is "NdM" (N, M 1..99); the caller rolls it and sends the integer as `rounds`. */
export function parseConditionButton(data: { condition?: string; rounds?: string }): { conditionId: RelayConditionId; roundsFormula: string | null } | null {
  if (!(RELAY_CONDITIONS as readonly unknown[]).includes(data.condition)) return null;
  const conditionId = data.condition as RelayConditionId;
  const rounds = data.rounds ?? "";
  if (rounds === "") return { conditionId, roundsFormula: null };
  return /^[1-9]\d?d[1-9]\d?$/.test(rounds) ? { conditionId, roundsFormula: rounds } : null;
}
```
`src/combat/condition-effects.ts`:
```ts
export function conditionDuration(
  conditionId: string,
  targetHasActed: boolean,
  rounds?: number,
): { value: number; units: "rounds"; expiry: "turnStart" | "turnEnd" } | null {
  const value = rounds ?? CONDITION_DURATION_ROUNDS[conditionId];
  if (value === undefined) return null;
  return { value, units: "rounds", expiry: targetHasActed ? "turnEnd" : "turnStart" };
}
```
`src/relay/apply-effect.ts`: add a fourth parameter `rounds?: number` to `applyConditionDuration`, call `conditionDuration(conditionId, hasActed, rounds)`, and in the `case "condition":` pass `request.rounds`:
```ts
      await applyConditionDuration(actor, request.conditionId, await actor.toggleStatusEffect(request.conditionId, { active: true }), request.rounds);
```

- [ ] **Step 4: Run to verify they pass, then typecheck and build**

Run: `npx vitest run tests/combat tests/relay 2>/dev/null; npx vitest run tests/combat && npm run typecheck && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(relay): paralyzed and unconscious conditions with a validated rounds duration (SP18 Plan B2)"
```

---

### Task 3: Registry — 15 new maneuvers, passive kind, effects, multiplier

**Files:**
- Modify: `src/core/martial-arts/maneuvers.ts`
- Modify: `tests/core/martial-arts/maneuvers.test.ts` (B1's file: update the list/length assertions it makes, then append)
- Modify: `src/core/martial-arts/view.ts` (`kind` includes `passive`; `usable` excludes passive)
- Modify: `tests/core/martial-arts/maneuver-view.test.ts` (append)

**Interfaces — produces:**
```ts
export const MANEUVER_LISTS: readonly ["block", "kick", "strike", "lock", "push", "throw", "vitalArea"];
export type EffectCondition = "stunned" | "paralyzed" | "unconscious" | "held" | "prone";
export interface ManeuverEffect { id: string; save: null | 0 | -2 | -4; condition: EffectCondition | null; rounds: "1d3" | "1d4" | "2d4" | null; doubleDamage?: boolean }
// ManeuverDef gains: kind: "parry" | "attack" | "passive"; noDamage?: boolean; multiplier?: number | null; effects?: readonly ManeuverEffect[]
export function doubleBasicDamageFormula(styleDie: string | null): string;
// ManeuverRow.kind becomes "parry" | "attack" | "passive"
```

- [ ] **Step 1: Write the failing tests**

In `tests/core/martial-arts/maneuvers.test.ts`: update B1's "lists the ten maneuvers" test to expect 25 ids in order — the 10 B1 ids followed by `lock:1..4, push:1..3, throw:1..4, vitalArea:1..4` — and `MANEUVER_LISTS` to equal the seven lists; update the "carries slugs, kinds and costs" test to the full 25-row table below; and the B1 Table 21 `it.each` stays. Then append:
```ts
describe("B2 registry rows", () => {
  it.each([
    ["lock:1", "chokeHold", "attack", "round", -2, -3, -5],
    ["lock:2", "lockingBlock", "attack", 1, -1, -1, -1],
    ["lock:3", "incapacitator", "attack", 1, -1, -2, -4],
    ["lock:4", "immobilizing", "attack", 1, 1, 2, 3],
    ["push:1", "concentratedPush", "attack", 1, 0, -1, -2],
    ["push:2", "stickingTouch", "attack", 1, 0, 1, 2],
    ["push:3", "oneFingerPush", "attack", "round", 0, 0, 0],
    ["throw:1", "fall", "passive", 0, 0, 0, 0],
    ["throw:2", "instantStand", "passive", 0, 0, 0, 0],
    ["throw:3", "hurl", "attack", 1, -1, 1, 3],
    ["throw:4", "greatThrow", "attack", 1, -1, -2, -4],
    ["vitalArea:1", "painTouch", "attack", 1, -3, -4, -5],
    ["vitalArea:2", "stunningTouch", "attack", 1, -2, -4, -4],
    ["vitalArea:3", "paralyzingTouch", "attack", 1, -2, -3, -4],
    ["vitalArea:4", "distanceDeath", "attack", "round", 0, -2, -3],
  ])("%s %s", (id, slug, kind, cost, light, mail, plate) => {
    const m = maneuverById(id)!;
    expect([m.slug, m.kind, m.cost]).toEqual([slug, kind, cost]);
    expect(m.table21).toEqual({ light, mail, plate });
  });

  it("lists the effects each maneuver offers", () => {
    const eff = (id: string) => (maneuverById(id)!.effects ?? []).map((e) => [e.id, e.save, e.condition, e.rounds]);
    expect(eff("lock:1")).toEqual([["unconscious", null, "unconscious", "1d3"]]);
    expect(eff("lock:2")).toEqual([]);
    expect(eff("lock:3")).toEqual([["limbUseless", 0, null, null]]);
    expect(eff("lock:4")).toEqual([["held", null, "held", null]]);
    expect(eff("push:1")).toEqual([["prone", 0, "prone", null]]);
    expect(eff("push:3")).toEqual([["prone", 0, "prone", null]]);
    expect(eff("throw:3")).toEqual([["prone", null, "prone", null]]);
    expect(eff("throw:4")).toEqual([["prone", null, "prone", null]]);
    expect(eff("vitalArea:1")).toEqual([]);
    expect(eff("vitalArea:2")).toEqual([["stunned", 0, "stunned", "1d4"]]);
    expect(eff("vitalArea:3")).toEqual([["paralyzed", -2, "paralyzed", "2d4"]]);
    expect(eff("vitalArea:4")).toEqual([
      ["pain", null, null, null], ["stunned", -2, "stunned", "1d4"], ["paralyzed", -4, "paralyzed", "2d4"], ["doubleDamage", null, null, null],
    ]);
    expect(maneuverById("vitalArea:4")!.effects!.find((e) => e.id === "doubleDamage")!.doubleDamage).toBe(true);
  });

  const ctx = (styleDie: string | null, strengthAdj = 0) => ({ styleDie, level: 5, strengthAdj });
  it("damage-less maneuvers and passives have no formula", () => {
    for (const id of ["lock:1", "lock:2", "lock:4", "push:1", "push:2", "push:3", "throw:1", "throw:2", "vitalArea:1", "vitalArea:2", "vitalArea:3", "vitalArea:4"]) {
      expect(maneuverDamageFormula(maneuverById(id)!, ctx("1d4", 2)), id).toBeNull();
    }
  });
  it("Incapacitator and Hurl add a die to the style die and Strength", () => {
    expect(maneuverDamageFormula(maneuverById("lock:3")!, ctx("1d4", 2))).toBe("1d4+1d4+2");
    expect(maneuverDamageFormula(maneuverById("throw:3")!, ctx("1d4", 1))).toBe("1d4+1d4+1");
  });
  it("Great Throw doubles the style die plus Strength", () => {
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx("1d4", 1))).toBe("(1d4+1)*2");
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx("1d4", 0))).toBe("(1d4)*2");
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx("1", 0))).toBe("2");
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx(null, 0))).toBe("0");
  });
  it("doubleBasicDamageFormula is twice the style die with no Strength", () => {
    expect(doubleBasicDamageFormula("1d4")).toBe("(1d4)*2");
    expect(doubleBasicDamageFormula("1")).toBe("2");
    expect(doubleBasicDamageFormula(null)).toBe("0");
  });
  it("learnability applies to the new lists the same way", () => {
    const base = { offered: [{ list: "lock", difficulties: [1, 3] }], known: [] as { id: string; level: number }[], freeSlots: 1, level: 3 };
    expect(learnability({ ...base, maneuverId: "lock:1" })).toEqual({ ok: true });
    expect(learnability({ ...base, maneuverId: "lock:3" })).toEqual({ ok: false, reason: "order" });
    expect(learnability({ ...base, maneuverId: "vitalArea:1" })).toEqual({ ok: false, reason: "notOffered" });
  });
});
```
(Add `doubleBasicDamageFormula` to the file's import.) Append to `tests/core/martial-arts/maneuver-view.test.ts`:
```ts
describe("passive maneuvers (SP18 B2)", () => {
  it("Fall and Instant Stand are learnable rows with kind passive and are never usable", () => {
    const item: StyleItemLike = {
      id: "judo", name: "Judo", img: "", type: "martialStyle",
      system: {
        form: "soft", principalMethod: "throw", slotsInvested: 2,
        availableManeuvers: [{ list: "throw", difficulties: [1, 2] }],
        knownManeuvers: [{ id: "throw:1", level: 1 }],
      },
    };
    const v = buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 3, freeSlots: 2, items: [item] });
    const rows = Object.fromEntries(v.styles[0]!.maneuvers.map((m) => [m.id, m]));
    expect(rows["throw:1"]).toMatchObject({ kind: "passive", state: "known", usable: false });
    expect(rows["throw:2"]).toMatchObject({ kind: "passive", state: "learnable", usable: false });
  });
});
```
(`buildMartialArtsView`/`StyleItemLike` are already imported in that file.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/maneuvers.ts`:
- `MANEUVER_LISTS = ["block", "kick", "strike", "lock", "push", "throw", "vitalArea"] as const`.
- Add before `ManeuverDef`:
```ts
export type EffectCondition = "stunned" | "paralyzed" | "unconscious" | "held" | "prone";

/** One thing a hit may do to the target. `save` is the modifier to the target's saving throw vs paralyzation
 *  (null = no save); `condition` is the condition a card button applies; `rounds` is its duration dice. */
export interface ManeuverEffect {
  /** i18n leaf under ADND2E.martialEffects */
  id: string;
  save: null | 0 | -2 | -4;
  condition: EffectCondition | null;
  rounds: "1d3" | "1d4" | "2d4" | null;
  /** this alternative deals twice the style die (Distance Death) */
  doubleDamage?: boolean;
}
```
- In `ManeuverDef` change `kind` to `"parry" | "attack" | "passive"` and add:
```ts
  /** the attack does no damage (touches, locks, pushes); parries and passives are implicitly damage-less */
  noDamage?: boolean;
  /** multiplies the whole damage expression (Great Throw = 2) */
  multiplier?: number | null;
  /** what a hit may do to the target; each condition effect becomes an Apply button on the card */
  effects?: readonly ManeuverEffect[];
```
- Append the 15 rows to `MANEUVERS` (after `strike:3`), each with `extraDie`/`ownDie`/`addsStrength`/`halfLevelBonus` set as below (all others `null`/`false`):
```ts
  { id: "lock:1", slug: "chokeHold", list: "lock", difficulty: 1, kind: "attack", cost: "round", extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: -2, mail: -3, plate: -5 }, noDamage: true,
    effects: [{ id: "unconscious", save: null, condition: "unconscious", rounds: "1d3" }] },
  { id: "lock:2", slug: "lockingBlock", list: "lock", difficulty: 2, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: -1, mail: -1, plate: -1 }, noDamage: true, effects: [] },
  { id: "lock:3", slug: "incapacitator", list: "lock", difficulty: 3, kind: "attack", cost: 1, extraDie: "1d4", ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: -1, mail: -2, plate: -4 },
    effects: [{ id: "limbUseless", save: 0, condition: null, rounds: null }] },
  { id: "lock:4", slug: "immobilizing", list: "lock", difficulty: 4, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: 1, mail: 2, plate: 3 }, noDamage: true,
    effects: [{ id: "held", save: null, condition: "held", rounds: null }] },
  { id: "push:1", slug: "concentratedPush", list: "push", difficulty: 1, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: 0, mail: -1, plate: -2 }, noDamage: true,
    effects: [{ id: "prone", save: 0, condition: "prone", rounds: null }] },
  { id: "push:2", slug: "stickingTouch", list: "push", difficulty: 2, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: 0, mail: 1, plate: 2 }, noDamage: true, effects: [] },
  { id: "push:3", slug: "oneFingerPush", list: "push", difficulty: 3, kind: "attack", cost: "round", extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true,
    effects: [{ id: "prone", save: 0, condition: "prone", rounds: null }] },
  { id: "throw:1", slug: "fall", list: "throw", difficulty: 1, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true, effects: [] },
  { id: "throw:2", slug: "instantStand", list: "throw", difficulty: 2, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true, effects: [] },
  { id: "throw:3", slug: "hurl", list: "throw", difficulty: 3, kind: "attack", cost: 1, extraDie: "1d4", ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: -1, mail: 1, plate: 3 },
    effects: [{ id: "prone", save: null, condition: "prone", rounds: null }] },
  { id: "throw:4", slug: "greatThrow", list: "throw", difficulty: 4, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: -1, mail: -2, plate: -4 }, multiplier: 2,
    effects: [{ id: "prone", save: null, condition: "prone", rounds: null }] },
  { id: "vitalArea:1", slug: "painTouch", list: "vitalArea", difficulty: 1, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: -3, mail: -4, plate: -5 }, noDamage: true, effects: [] },
  { id: "vitalArea:2", slug: "stunningTouch", list: "vitalArea", difficulty: 2, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: -2, mail: -4, plate: -4 }, noDamage: true,
    effects: [{ id: "stunned", save: 0, condition: "stunned", rounds: "1d4" }] },
  { id: "vitalArea:3", slug: "paralyzingTouch", list: "vitalArea", difficulty: 3, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: -2, mail: -3, plate: -4 }, noDamage: true,
    effects: [{ id: "paralyzed", save: -2, condition: "paralyzed", rounds: "2d4" }] },
  { id: "vitalArea:4", slug: "distanceDeath", list: "vitalArea", difficulty: 4, kind: "attack", cost: "round", extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: 0, mail: -2, plate: -3 }, noDamage: true,
    effects: [
      { id: "pain", save: null, condition: null, rounds: null },
      { id: "stunned", save: -2, condition: "stunned", rounds: "1d4" },
      { id: "paralyzed", save: -4, condition: "paralyzed", rounds: "2d4" },
      { id: "doubleDamage", save: null, condition: null, rounds: null, doubleDamage: true },
    ] },
```
- Replace `maneuverDamageFormula` with:
```ts
export function maneuverDamageFormula(
  def: ManeuverDef,
  ctx: { styleDie: string | null; level: number; strengthAdj: number },
): string | null {
  if (def.kind !== "attack" || def.noDamage === true) return null;
  const dice: string[] = [];
  let flat = 0;
  const base = def.ownDie ?? ctx.styleDie;
  if (base !== null) {
    if (base === "1") flat += 1;
    else dice.push(base);
  }
  if (def.extraDie !== null) dice.push(def.extraDie);
  if (def.halfLevelBonus) flat += Math.floor(ctx.level / 2);
  if (def.addsStrength) flat += ctx.strengthAdj;
  const times = def.multiplier ?? 1;
  if (dice.length === 0) return String(Math.max(0, flat) * times);
  const body = dice.join("+") + (flat > 0 ? `+${flat}` : flat < 0 ? `${flat}` : "");
  return times === 1 ? body : `(${body})*${times}`;
}

/** Distance Death's Double Damage alternative: twice the style die only (no Strength). */
export function doubleBasicDamageFormula(styleDie: string | null): string {
  if (styleDie === null) return "0";
  if (styleDie === "1") return "2";
  return `(${styleDie})*2`;
}
```
`src/core/martial-arts/view.ts`: change `ManeuverRow.kind` to `"parry" | "attack" | "passive"` and `usable: isKnown && isActive && input.canAct && m.kind !== "passive",`.

- [ ] **Step 4: Run to verify they pass, then typecheck and build**

Run: `npx vitest run tests/core/martial-arts tests/core/index.test.ts && npm run typecheck && npx vite build`
Expected: PASS (B1's card/attack tests still pass; `noDamage`/`multiplier`/`effects` are optional).

- [ ] **Step 5: Commit**

```bash
git add src/core/martial-arts tests/core/martial-arts
git commit -m "feat(martial-arts): Lock, Push, Throw and Vital Area maneuvers in the registry (SP18 Plan B2)"
```

---

### Task 4: Attack result and card effects

**Files:**
- Modify: `src/core/martial-arts/maneuver-attack.ts` (passive rejected; `doubleDamageFormula`)
- Modify: `src/core/martial-arts/card.ts` (effects on the maneuver card context)
- Modify: `tests/core/martial-arts/maneuver-attack.test.ts`, `tests/core/martial-arts/card.test.ts` (append)

**Interfaces — produces:**
```ts
// ManeuverAttackResult gains: doubleDamageFormula: string | null   (set on a hit when the maneuver has a doubleDamage effect)
export interface CardEffect {
  id: string; labelKey: string; saveKey: string; saveMod: string;
  condition: string | null; rounds: string | null; damage: number | null;
}
// ManeuverCardInput gains: doubleDamageTotal?: number
// ManeuverCardContext gains: effects: CardEffect[]
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/martial-arts/maneuver-attack.test.ts`:
```ts
describe("B2 maneuver attacks", () => {
  const input = {
    maneuverId: "vitalArea:2", naturalD20: 15, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "light" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("a damage-less touch hits with no damage formula and applies its Table 21 modifier", () => {
    const r = resolveManeuverAttack(input);
    expect(r.penalties.table21).toBe(-2);
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBeNull();
    expect(r.doubleDamageFormula).toBeNull();
  });
  it("Great Throw builds a multiplied formula", () => {
    const r = resolveManeuverAttack({ ...input, maneuverId: "throw:4", naturalD20: 18 });
    expect(r.damageFormula).toBe("(1d4+1)*2");
  });
  it("Distance Death exposes the double-damage formula on a hit only", () => {
    const hit = resolveManeuverAttack({ ...input, maneuverId: "vitalArea:4", naturalD20: 15 });
    expect(hit.damageFormula).toBeNull();
    expect(hit.doubleDamageFormula).toBe("(1d4)*2");
    const miss = resolveManeuverAttack({ ...input, maneuverId: "vitalArea:4", naturalD20: 2 });
    expect(miss.doubleDamageFormula).toBeNull();
  });
  it("rejects a passive maneuver", () => {
    expect(() => resolveManeuverAttack({ ...input, maneuverId: "throw:1" })).toThrow(RangeError);
  });
});
```
Append to `tests/core/martial-arts/card.test.ts` (reuse its `attackInput`; import `buildManeuverCardContext`, `resolveManeuverAttack` already there):
```ts
describe("maneuver card effects (SP18 B2)", () => {
  const base = { ...attackInput, targetArmorGroup: "light" as const };
  const card = (maneuverId: string, naturalD20 = 15, extra: Record<string, unknown> = {}) =>
    buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Ogre",
      result: resolveManeuverAttack({ ...base, maneuverId, naturalD20 }), damageTotal: 0, ...extra,
    });

  it("lists a condition effect with its save line and button data", () => {
    const e = card("vitalArea:3").effects;
    expect(e).toEqual([{
      id: "paralyzed", labelKey: "ADND2E.martialEffects.paralyzed", saveKey: "ADND2E.chat.martialArts.saveAt", saveMod: "-2",
      condition: "paralyzed", rounds: "2d4", damage: null,
    }]);
  });
  it("a zero save modifier uses the plain save line; no save has none", () => {
    expect(card("vitalArea:2").effects[0]).toMatchObject({ saveKey: "ADND2E.chat.martialArts.save", saveMod: "", condition: "stunned", rounds: "1d4" });
    expect(card("throw:3").effects[0]).toMatchObject({ saveKey: "", saveMod: "", condition: "prone", rounds: null });
  });
  it("a non-condition effect has no button data", () => {
    expect(card("lock:3").effects[0]).toMatchObject({ id: "limbUseless", condition: null, rounds: null, saveKey: "ADND2E.chat.martialArts.save" });
  });
  it("Distance Death lists four alternatives and the double-damage one carries its rolled total", () => {
    const e = card("vitalArea:4", 15, { doubleDamageTotal: 6 }).effects;
    expect(e.map((x) => x.id)).toEqual(["pain", "stunned", "paralyzed", "doubleDamage"]);
    expect(e[1]).toMatchObject({ saveKey: "ADND2E.chat.martialArts.saveAt", saveMod: "-2" });
    expect(e[2]).toMatchObject({ saveMod: "-4" });
    expect(e[3]).toMatchObject({ damage: 6, condition: null });
  });
  it("a miss and a parry show no effects", () => {
    expect(card("vitalArea:3", 2).effects).toEqual([]);
    expect(card("block:1", 15).effects).toEqual([]);
  });
});
```
(`card.test.ts` already declares `attackInput` inside its B1 `describe`; if it is block-scoped, hoist it to module scope in this edit.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/maneuver-attack.ts`:
- import `doubleBasicDamageFormula` from `./maneuvers`;
- add `doubleDamageFormula: string | null;` to `ManeuverAttackResult` (doc: "the Double Damage alternative's dice, set on a hit when the maneuver offers one");
- after the unknown-id guard add `if (def.kind === "passive") throw new RangeError(\`maneuver "${input.maneuverId}" is always in effect and cannot be used\`);`;
- in the returned object add
```ts
    doubleDamageFormula: hit && (def.effects ?? []).some((e) => e.doubleDamage === true) ? doubleBasicDamageFormula(input.styleDie) : null,
```
`src/core/martial-arts/card.ts`:
- add the `CardEffect` interface, `doubleDamageTotal?: number` to `ManeuverCardInput`, `effects: CardEffect[]` to `ManeuverCardContext`;
- in `buildManeuverCardContext` compute and return:
```ts
  const effects: CardEffect[] = r.hit
    ? (def.effects ?? []).map((e) => ({
        id: e.id,
        labelKey: `ADND2E.martialEffects.${e.id}`,
        saveKey: e.save === null ? "" : e.save === 0 ? "ADND2E.chat.martialArts.save" : "ADND2E.chat.martialArts.saveAt",
        saveMod: e.save === null || e.save === 0 ? "" : String(e.save),
        condition: e.condition,
        rounds: e.rounds,
        damage: e.doubleDamage === true ? (input.doubleDamageTotal ?? 0) : null,
      }))
    : [];
```
and `effects,` in the returned object.

- [ ] **Step 4: Run to verify they pass, then typecheck and build**

Run: `npx vitest run tests/core/martial-arts && npm run typecheck && npx vite build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/martial-arts tests/core/martial-arts
git commit -m "feat(martial-arts): maneuver card effects with save lines and apply data (SP18 Plan B2)"
```

---

### Task 5: Sheet glue — effects on the card, Apply listener, passive rows, labels

**Files:**
- Modify: `src/sheets/character/martial-arts-actions.ts` (`useManeuver`: passive guard, double-damage roll)
- Modify: `src/chat/chat-listeners.ts` (`onApplyCondition` + registration)
- Modify: `templates/chat/martial-arts-attack.hbs` (effects block)
- Modify: `templates/actor/pc/partials/pc-main-panels.hbs` (passive rows)
- Modify: `lang/en.json` (see below)
- Modify: `tests/lang/martial-maneuver-labels.test.ts`, `tests/templates/martial-maneuvers-bindings.test.ts`
- Check: `tests/styles/chat-classes.test.ts` (no new class is used)

**Interfaces — consumes:** Tasks 2-4. **Produces:** the `applyCondition` chat action (`data-condition`, `data-rounds`).

- [ ] **Step 1: Write the failing tests**

In `tests/lang/martial-maneuver-labels.test.ts` extend the first `it` so that every registry slug has a name and an effect text, and a failure text unless the maneuver is passive:
```ts
      if (m.kind !== "passive") expect(LANG.martialManeuverFailures?.[m.slug], `failure ${m.slug}`).toBeTruthy();
```
(replace B1's unconditional failure assertion), and add:
```ts
  it("every effect id has a label and every list label exists", () => {
    const ids = new Set(MANEUVERS.flatMap((m) => (m.effects ?? []).map((e) => e.id)));
    expect(ids.size).toBeGreaterThanOrEqual(7);
    for (const id of ids) expect(LANG.martialEffects?.[id], `effect ${id}`).toBeTruthy();
    for (const l of MANEUVER_LISTS) expect(LANG.martialManeuverLists?.[l], l).toBeTruthy();
  });
```
Add `"martialEffects"` to the ellipsis-guard map list. In `tests/templates/martial-maneuvers-bindings.test.ts` append (reading the chat template as `CHAT` and the listener source):
```ts
  it("the card renders effects with a condition button and a damage button, and the listener is registered", () => {
    expect(CHAT).toContain('data-action="applyCondition"');
    expect(CHAT).toContain("data-condition=");
    expect(CHAT).toContain("data-rounds=");
    expect(CHAT).toContain("effects");
    const LISTENERS = read("src", "chat", "chat-listeners.ts");
    expect(LISTENERS).toContain('[data-action="applyCondition"]');
    expect(LISTENERS).toContain("parseConditionButton");
  });
  it("the panel shows passive maneuvers without a Use button", () => {
    expect(MAIN).toContain("m.kind 'passive'");
    expect(MAIN).toContain("ADND2E.sheet.martialArts.passive");
  });
  it("the new card and sheet keys exist in lang/en.json", () => {
    for (const key of [
      "ADND2E.chat.martialArts.save", "ADND2E.chat.martialArts.saveAt", "ADND2E.chat.martialArts.applyPrefix",
      "ADND2E.chat.martialArts.roundsRoll", "ADND2E.sheet.martialArts.passive",
    ]) expect(typeof lookup(key), key).toBe("string");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/lang tests/templates tests/styles`
Expected: FAIL.

- [ ] **Step 3: Implement**

`lang/en.json` (siblings of the B1 maps; own-wording; no label ends in an ellipsis):
- `martialManeuverLists`: add `lock` "Lock", `push` "Push", `throw` "Throw", `vitalArea` "Vital area".
- `martialManeuvers`: add `chokeHold` "Choke Hold", `lockingBlock` "Locking Block", `incapacitator` "Incapacitator", `immobilizing` "Immobilizing", `concentratedPush` "Concentrated Push", `stickingTouch` "Sticking Touch", `oneFingerPush` "One Finger Push", `fall` "Fall", `instantStand` "Instant Stand", `hurl` "Hurl", `greatThrow` "Great Throw", `painTouch` "Pain Touch", `stunningTouch` "Stunning Touch", `paralyzingTouch` "Paralyzing Touch", `distanceDeath` "Distance Death".
- `martialManeuverEffects` (on a hit): `chokeHold` "Keep the choke to the end of next round; the victim can break free with an attack roll at -2, otherwise they pass out."; `lockingBlock` "Their weapon, arm or leg is trapped and unusable; you attack with your feet at +4; they must spend an attack to break free."; `incapacitator` "A limb is wrenched; the damage includes an extra 1d4. If they fail the save the limb is useless for 24 hours."; `immobilizing` "One hand holds them so they cannot act; you can still attack; they can break free by spending an attack at -6."; `concentratedPush` "They are knocked back 1 foot per level; past 3 feet they save or fall; hitting a solid object does falling damage."; `stickingTouch` "While you stay in contact you gain +2 to hit and your AC improves by 2; unarmed only."; `oneFingerPush` "As Concentrated Push, at a range of 1 foot per level; it is your only action this round."; `fall` "Always in effect: you take half damage from falls."; `instantStand` "Always in effect: you regain your feet at once instead of losing a round."; `hurl` "They are thrown 1d4 feet to the ground; the damage includes an extra 1d4."; `greatThrow` "They are thrown 1 foot per level (6 feet plus 1 per level if charging) for double damage."; `painTouch` "They feel as if on fire: -2 to hit and +2 AC for 1d3 rounds. Humans and humanoids only."; `stunningTouch` "If they fail a saving throw vs. paralyzation they are stunned for 1d4 rounds."; `paralyzingTouch` "If they fail a saving throw vs. paralyzation at -2 they are paralyzed for 2d4 rounds."; `distanceDeath` "At range 1 foot per level choose one: pain, stunning (save -2), paralysis (save -4) or double damage (no save). It is your only action this round."
- `martialManeuverFailures` (on a miss; none for the passives): `chokeHold` "No ill effect."; `lockingBlock` "Against an unarmed foe you lose an attack; against a weapon you are hit by it for normal damage without Strength."; `incapacitator` "No ill effect."; `immobilizing` "You suffer -4 on your next attack."; `concentratedPush` "Until the round ends all your opponents get +2 to hit you."; `stickingTouch` "The touch does not stick."; `oneFingerPush` "The push has no effect."; `hurl` "You lose your remaining attacks this round and next round's initiative."; `greatThrow` "They counter and knock you down; you lose initiative next round."; `painTouch` "No effect."; `stunningTouch` "No effect."; `paralyzingTouch` "No effect."; `distanceDeath` "No special effect and no damage."
- New top-level map `martialEffects`: `unconscious` "Unconscious", `held` "Held", `prone` "Knocked down", `stunned` "Stunned", `paralyzed` "Paralyzed", `limbUseless` "Limb useless (24 hours)", `pain` "Pain", `doubleDamage` "Double damage".
- `ADND2E.chat.martialArts`: add `save` "Target saves vs. paralyzation", `saveAt` "Target saves vs. paralyzation at {mod}", `applyPrefix` "Apply", `roundsRoll` "Duration in rounds".
- `ADND2E.sheet.martialArts`: add `passive` "Always in effect".

`templates/chat/martial-arts-attack.hbs` — in the `{{#if hit}}` block, after the `{{#if formula}}` line and before the stun hint, add:
```hbs
    {{#if effects.length}}
      <ul class="modifiers">
        {{#each effects as |e|}}
          <li>
            <strong>{{localize e.labelKey}}</strong>
            {{#if e.saveKey}} - {{localize e.saveKey mod=e.saveMod}}{{/if}}
            {{#if e.condition}}
              <button type="button" data-action="applyCondition" data-condition="{{e.condition}}" data-rounds="{{e.rounds}}">{{localize 'ADND2E.chat.martialArts.applyPrefix'}} {{localize e.labelKey}}{{#if e.rounds}} ({{e.rounds}}){{/if}}</button>
            {{/if}}
            {{#if e.damage}}
              <button type="button" data-action="applyDamage" data-amount="{{e.damage}}">{{localize 'ADND2E.chat.damage.applyToTargets'}} ({{e.damage}})</button>
            {{/if}}
          </li>
        {{/each}}
      </ul>
    {{/if}}
```
`templates/actor/pc/partials/pc-main-panels.hbs` — in the maneuver row replace the `{{#if (eq m.state 'known')}} ... {{else if (eq m.state 'learnable')}} ... {{/if}}` buttons with:
```hbs
                    {{#if (eq m.kind 'passive')}}
                      {{#if (eq m.state 'known')}}<span class="effect">{{localize 'ADND2E.sheet.martialArts.passive'}}</span>{{/if}}
                    {{/if}}
                    {{#if (eq m.state 'known')}}
                      {{#unless (eq m.kind 'passive')}}<button type="button" class="kit-small" data-action="useManeuver" data-maneuver-id="{{m.id}}"{{#unless m.usable}} disabled{{/unless}}>{{localize 'ADND2E.sheet.martialArts.useManeuver'}}</button>{{/unless}}
                    {{else if (eq m.state 'learnable')}}
                      <button type="button" class="kit-small" data-action="learnManeuver" data-item-id="{{s.id}}" data-maneuver-id="{{m.id}}">{{localize 'ADND2E.sheet.martialArts.learn'}}</button>
                    {{/if}}
```
(Keep exactly one `disabled` on the Use line so the B1 bindings test still passes.)

`src/sheets/character/martial-arts-actions.ts` — in `useManeuver`:
- import `doubleBasicDamageFormula`? not needed (the result carries the formula).
- after the `maneuverById`/known guard add a passive guard using the row kind:
```ts
  if (row.kind === "passive") return warn("ADND2E.sheet.martialArts.passive");
```
(place it after the `row?.state !== "known"` check, so `row` is defined).
- after the `damageTotal` roll add:
```ts
  let doubleDamageTotal = 0;
  if (result.doubleDamageFormula) doubleDamageTotal = Math.max(0, (await new Roll(result.doubleDamageFormula).evaluate()).total ?? 0);
```
and pass `doubleDamageTotal` into `buildManeuverCardContext({... damageTotal, doubleDamageTotal, styleDieIsNull: ... })`.

`src/chat/chat-listeners.ts`:
- add `import { parseConditionButton } from "../combat/apply-relay";` (merge with the existing import from that module if present).
- add after `onApplyDamage`:
```ts
/** Applies the condition on a martial arts card (SP18 B2) to every targeted token: any duration dice are rolled in chat
 *  first, then the condition goes through the relay like every other target-side effect. */
async function onApplyCondition(button: HTMLButtonElement): Promise<void> {
  const parsed = parseConditionButton(button.dataset as { condition?: string; rounds?: string });
  if (!parsed) return;
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: unknown }> } }).user.targets];
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.noTargetsWarning"));
    return;
  }
  let rounds: number | undefined;
  if (parsed.roundsFormula) {
    const roll = await new Roll(parsed.roundsFormula).evaluate();
    rounds = Math.min(99, Math.max(1, roll.total ?? 1));
    await roll.toMessage({ flavor: game.i18n!.localize("ADND2E.chat.martialArts.roundsRoll") } as never);
  }
  for (const t of targets) {
    const actor = t.actor as (EffectTarget & { uuid: string; isOwner: boolean }) | null;
    if (!actor) continue;
    await requestApply(actor, {
      kind: "condition", targetUuid: actor.uuid, conditionId: parsed.conditionId, ...(rounds === undefined ? {} : { rounds }),
    });
  }
}
```
- in `registerChatListeners`, next to the `applyDamage` listener add:
```ts
    html.querySelector<HTMLButtonElement>('[data-action="applyCondition"]')?.addEventListener("click", (ev) => {
      void onApplyCondition(ev.currentTarget as HTMLButtonElement);
    });
```
NOTE: a card can contain several Apply buttons (Distance Death); `querySelector` binds only the first. Use `querySelectorAll` for the new action:
```ts
    html.querySelectorAll<HTMLButtonElement>('[data-action="applyCondition"]').forEach((b) =>
      b.addEventListener("click", (ev) => void onApplyCondition(ev.currentTarget as HTMLButtonElement)),
    );
```
and change the existing `applyDamage` binding to `querySelectorAll` as well so Distance Death's Double Damage button works next to a main Apply Damage button.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/templates tests/styles tests/lang tests/core tests/combat tests/sheets tests/data`
Expected: PASS. (If `tests/styles/chat-classes.test.ts` flags a class, the new markup uses only `modifiers`, `hint`, `formula`, `result`, `hit`, `miss`.)

- [ ] **Step 5: Typecheck, lint, build and commit**

Run: `npm run typecheck && npx eslint src/chat/chat-listeners.ts src/sheets/character/martial-arts-actions.ts src/core/martial-arts src/combat && npx vite build`
```bash
git add -A src templates lang tests
git commit -m "feat(martial-arts): effect buttons on maneuver cards, passive rows and the apply-condition listener (SP18 Plan B2)"
```

---

### Task 6: Gates, headless proof, README and the manual checklist

**Files:**
- Create: `.superpowers/proof/martial-b2.proof.ts` (git-ignored)
- Modify: `README.md` (SP18 row only)

- [ ] **Step 1: Write the headless proof**

Create `.superpowers/proof/martial-b2.proof.ts` from `.superpowers/proof/martial-maneuvers.proof.ts` (the B1 proof) boilerplate. Assertions:
1. `validateRelayRequest` round trip: `{kind:"condition", targetUuid, conditionId:"paralyzed", rounds:4}` is accepted with `rounds` 4; `rounds: 100`, `0`, `2.5`, `"3"` are rejected; `conditionId:"dead"` is rejected; `parseConditionButton({condition:"unconscious", rounds:"1d3"})` parses; `conditionDuration("paralyzed", true, 4)` is `{value:4, units:"rounds", expiry:"turnEnd"}`.
2. Every shipped style's `availableManeuvers` entries for lists lock/push/throw/vitalArea resolve to registry ids (`maneuverById`), and `buildMartialArtsView` over the real cleaned Ninjutsu/Jujutsu/Atemi items (level 3, freeSlots 2) lists them with the lowest difficulty `learnable` and passive Throw rows (`kind: "passive"`) never usable even when known.
3. `resolveManeuverAttack` for `vitalArea:3` against a plate target (-4) and `throw:4` with style die `1d4`, Str +1 gives `(1d4+1)*2`; `vitalArea:4` yields `doubleDamageFormula` `(1d4)*2` and four card effects with saves null/-2/-4/null.
4. The shipped `templates/chat/martial-arts-attack.hbs` compiles (register `localize`, `adnd2eSigned`) and renders: a Paralyzing Touch hit card containing one `data-action="applyCondition"` button with `data-condition="paralyzed"` and `data-rounds="2d4"` and the "saves vs. paralyzation at -2" text; a Distance Death card with three condition-or-damage buttons; a miss card with none; a Plan A plain card unchanged.

Run: `npx vitest run --config .superpowers/proof/vitest.proof.config.ts .superpowers/proof/martial-b2.proof.ts`
Expected: PASS. A failing assertion that exposes a real defect is reported, not papered over.

- [ ] **Step 2: Run the full CI sequence**

Run, in order: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npx vite build`.
Expected: green; coverage statements 100%. Add a missing test rather than lowering anything.

- [ ] **Step 3: README and commit**

Update the SP18 row: Plans A, B1 and **B2 complete** (adds Lock, Push, Throw, Vital Area maneuvers; Apply buttons for stunned/paralyzed/unconscious/held/prone with rolled durations; relay extended), B3 (Movement, Weapon, Mental/Physical Training) and C (ch'i + damage resistance) not started. Only that row changes (check `git diff --stat`).
```bash
git add README.md
git commit -m "docs: SP18 Plan B2 martial arts maneuvers complete (#86)"
```

- [ ] **Step 4: Rebuild the installed system and hand the user the checklist**

If Foundry is closed (`tasklist | grep -i foundry`): `npm run build` (re-run once if the pack build prints a transient LEVEL_ITERATOR_NOT_OPEN).

Checklist (prerequisites stated; offer to recreate the fixture macro if wanted):
1. **Setup:** rule ON (reload). A PC Fighter with "Knows basic martial arts" ticked, free weapon slots, and a style that offers these lists: drop **Ninjutsu** (kick/lock/movement/strike/throw/block) and **Atemi** (vitalArea 1-3, push 3, block, strike 1). Place a "Target Dummy" Monster NPC token (AC 10) and a **non-GM player** user who owns the PC.
2. **Layout:** the Learn and Use buttons now sit on the same line as the maneuver name and cost (no separate line).
3. **Learn and order:** Throw shows Fall (learnable), Instant Stand, Hurl, Great Throw in order; learning Fall shows "Always in effect" and no Use button.
4. **Vital area:** learn Pain, then Stunning Touch (on Atemi); Use Stunning Touch on the dummy: the card shows "Target saves vs. paralyzation" and an **Apply Stunned (1d4)** button; press it with the dummy targeted: a 1d4 roll appears in chat and the dummy gets Stunned that many rounds (check the token's effects). Paralyzing Touch gives **Apply Paralyzed (2d4)** and "at -2".
5. **Lock:** learn Choke Hold; the card shows **Apply Unconscious (1d3)**; pressing it applies Unconscious for that many rounds.
6. **Throw:** Great Throw's card shows a damage line like `(1d4+1)*2 = N hp`, an Apply Damage button, and **Apply Knocked down** (Prone).
7. **Distance Death** (if the style offers it): four alternatives; the Double Damage one shows its own amount and Apply Damage button.
8. **Non-GM seat:** as the player, steps 4-5 apply Stunned/Paralyzed/Unconscious to the GM-owned dummy through the relay (with the world's player-apply mode "auto", or after the GM approves in "approve").
9. **Relay safety:** nothing else changed: damage/healing/Prone/Held apply as before; the Character NPC sheet is unchanged.
Reset the setting between checks if a step changed it.

- [ ] **Step 5: Open the PR (always push + PR, never ask)**

```bash
git push -u origin feat/sp18b2-martial-arts-lock-push-throw-vital
gh pr create --title "feat(martial-arts): SP18 Plan B2 - Lock, Push, Throw, Vital Area maneuvers + apply-condition buttons (#86)" --body "..."
```
Body: scope (15 maneuvers, Table 21, relay extension with `paralyzed`/`unconscious`/`rounds`, layout fix), "Part of #86 (B3 and C remain)", the rulings, the test plan (CI sequence, proof, checklist), ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; ask the user to hand-merge.

---

## Self-Review

**Spec coverage:** layout fix (Task 1); relay extension with validator, duration and listener parser (Task 2, Task 5); 15 registry rows with Table 21, effects, passive kind, multiplier and no-damage handling (Task 3); attack result (double-damage formula, passive rejection) and card effects with save lines and button data (Task 4); the card/listener/panel/lang glue (Task 5); proof, CI, README, checklist, PR (Task 6). Out-of-scope items (target save rolling, Pain/Sticking/Locking as conditions, fall damage, B3, Plan C) are not built.

**Placeholder scan:** none; the PR body is the only elided string and is described by its contents.

**Type consistency:** `ManeuverDef.effects`/`ManeuverEffect` (Task 3) feed `CardEffect` (Task 4) and the template fields `e.labelKey`, `e.saveKey`, `e.saveMod`, `e.condition`, `e.rounds`, `e.damage` (Task 5); `parseConditionButton` and `RELAY_CONDITIONS` (Task 2) are what the listener (Task 5) and the proof (Task 6) use; `ManeuverRow.kind: "passive"` (Task 3) is what the panel `(eq m.kind 'passive')` branch reads; lang keys `martialEffects.*`, `chat.martialArts.{save,saveAt,applyPrefix,roundsRoll}`, `sheet.martialArts.passive` match the card/view code.
