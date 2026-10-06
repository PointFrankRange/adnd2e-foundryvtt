# Sub-project 15 Plan C: Psionic Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Telepathic attack modes versus defense modes as psychic contests (Table 14), tangents and full contact, defense raise/drop, upkeep, and chat-card flows where a player-owned target rolls their own defense.

**Architecture:** Pure `src/core/psionics/combat.ts` (Table 14, contest resolution, series resolution, contacts bookkeeping). Actor state `system.psionics.activeDefense` + `contacts` (attacker-side tangents). Foundry glue in `src/sheets/character/psionic-combat.ts` (actions), chat button listeners in `src/chat/chat-listeners.ts`, a result hook in `src/hooks/psionic-hooks.ts`, a chat card template, and a "Psionic combat" panel on the Psionics tab.

**Spec:** `docs/superpowers/specs/2026-10-08-adnd2e-sp15c-psionic-combat-design.md` (binding; read it first). Rules source: PHBR5 Chapter 2 pp.22-27 and Table 14 (already transcribed into the spec).

## Global Constraints

- Every implementer runs `npm run typecheck` (both tsc passes incl. the Foundry-free `tsconfig.core.json`), `npm run lint` and the task's tests; `npm run test:coverage` (100% statements/lines/functions on `src/core/**`, `src/data/derive/**`, and `context.ts`/`context-types.ts`/`xp.ts`). The controller runs `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR. A new test importing Foundry globals must be added to `tsconfig.core.json` `exclude` like `kit-power-actions.test.ts` / `psionic-actions.test.ts`.
- Preserve each file's line endings; plain ASCII (no em dashes); valid UTF-8; no object or array literal `initial` on Foundry fields (factory `() => []`).
- Every new user-visible string goes in `lang/en.json` and is asserted in `tests/lang/en-coverage.test.ts`.
- Anything psionic is gated on the derived `system.psionics.level > 0` (the Plan A rule, `isPsionicist`). Every write targets the acting actor's own data (a non-GM owner must be able to attack and defend); the target's actor is only ever READ.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Rulings (binding)

1. The attacker rolls BOTH attack d20s up front (the one-two punch); `resolveSeries` decides which attacks were actually made (an attack after full contact is not made).
2. Cost: the attack mode's initial cost is paid once per use: the full cost if at least one MADE attack's power check succeeds, else half rounded up. Refused when the pool is below the full cost.
3. A pending contest card is posted only when a defense roll is actually needed (some made attack's check succeeded and its roll is not above the defense score); otherwise the contest resolves immediately without bothering the defender.
4. The player-owned test: the target actor has an owner who is not a GM and is online (`user.active`); otherwise automatic.
5. Defense modes are paid at Raise (the initial cost); dropping is free; there is no per-round maintenance of a raised defense.

## File Structure

- Create `src/core/psionics/combat.ts` (+ export from `index.ts`), `src/sheets/character/psionic-combat.ts`, `src/hooks/psionic-hooks.ts`, `templates/chat/psionic-contest.hbs`.
- Modify `src/data/actor/base-actor.ts`, `src/sheets/character/{psionic-actions.ts (shared helpers only if needed),context.ts,context-types.ts,sheet.ts}`, `src/chat/chat-listeners.ts`, `src/system.ts` (register the hook), `templates/actor/pc/partials/pc-psionics-panels.hbs` (+ the power row partial for the Attack button), `lang/en.json`, `README.md`.
- Tests: `tests/core/psionics/combat.test.ts`, `tests/sheets/character/psionic-combat.test.ts`, `tests/hooks/psionic-hooks.test.ts`, plus context, lang, bindings and chat-listener tests where they exist.

---

### Task 1: Pure combat rules

**Files:** Create `src/core/psionics/combat.ts`; modify `src/core/psionics/index.ts`; test `tests/core/psionics/combat.test.ts`.

**Interfaces (Produces):**
- `ATTACK_MODES`, `DEFENSE_MODES` (readonly name tuples, see below); `isAttackMode(name)`, `isDefenseMode(name)` (case-insensitive, trimmed); `attackModifier(attack: string, defense: string | null): number` (Table 14; null or an unknown defense -> 0; an unknown attack -> 0).
- `ContestResult = { attackSuccess: boolean; winner: "attacker" | "defender"; reason: "unopposed" | "attack-failed" | "automatic" | "attacker-only" | "higher" | "tie" }`; `needsDefenseRoll(attackRoll, attackScore, defenseScore: number | null): boolean`; `resolveContest({ attackRoll, attackScore, defenseRoll, defenseScore }): ContestResult`.
- `AttackStep = { roll: number; score: number }`; `SeriesOutcome = { steps: { made: boolean; result: ContestResult | null; defenseRoll: number | null }[]; tangentsGained: number; fullContact: boolean; anySuccess: boolean }`; `resolveSeries(steps: readonly AttackStep[], defenseScore: number | null, defenseRolls: readonly (number | null)[], startingTangents: number): SeriesOutcome`.
- `FULL_CONTACT = 3`; `Contact = { target: string; name: string; tangents: number }`; `recordTangents(contacts, target, name, count): Contact[]`; `breakTangents(contacts, target?: string): Contact[]`; `endContact(contacts, target): Contact[]`; `isFullContact(c: Contact): boolean`; `upkeepDue(contacts): number`; `tangentsOn(contacts, target): number`; `maintainedCheck(roll, score): PowerCheck`.

- [ ] **Step 1: Write the failing tests** `tests/core/psionics/combat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ATTACK_MODES, DEFENSE_MODES, FULL_CONTACT, attackModifier, breakTangents, endContact, isAttackMode, isDefenseMode, isFullContact,
  maintainedCheck, needsDefenseRoll, recordTangents, resolveContest, resolveSeries, tangentsOn, upkeepDue, type Contact,
} from "../../../src/core/psionics";

describe("Table 14 (PHBR5 p.26)", () => {
  const want: Record<string, number[]> = {
    "Mind Thrust": [5, -2, -4, -4, -5],
    "Ego Whip": [5, 0, -3, -4, -3],
    "Id Insinuation": [-3, 2, 4, -1, -3],
    "Psychic Crush": [1, -3, -1, -3, -4],
    "Psionic Blast": [2, 3, 0, -1, -2],
  };
  it("matches every cell, in the book's defense order", () => {
    expect([...DEFENSE_MODES]).toEqual(["Mind Blank", "Thought Shield", "Mental Barrier", "Intellect Fortress", "Tower of Iron Will"]);
    expect([...ATTACK_MODES]).toEqual(Object.keys(want));
    for (const [attack, row] of Object.entries(want)) DEFENSE_MODES.forEach((d, i) => expect(attackModifier(attack, d), `${attack} vs ${d}`).toBe(row[i]));
  });
  it("no defense, unknown names and case/whitespace", () => {
    expect(attackModifier("Ego Whip", null)).toBe(0);
    expect(attackModifier("Ego Whip", "Nothing")).toBe(0);
    expect(attackModifier("Fireball", "Mind Blank")).toBe(0);
    expect(attackModifier("  ego whip ", "mind BLANK")).toBe(5);
    expect(isAttackMode(" psychic crush")).toBe(true);
    expect(isAttackMode("Contact")).toBe(false);
    expect(isDefenseMode("tower of iron will")).toBe(true);
    expect(isDefenseMode("Mind Thrust")).toBe(false);
  });
});

describe("resolveContest: the book's example (attack score 15, defense score 12)", () => {
  const r = (attackRoll: number, defenseRoll: number | null) => resolveContest({ attackRoll, attackScore: 15, defenseRoll, defenseScore: 12 });
  it("11 vs 6: attacker, higher roll", () => expect(r(11, 6)).toEqual({ attackSuccess: true, winner: "attacker", reason: "higher" }));
  it("3 vs 9: defender, higher roll", () => expect(r(3, 9)).toEqual({ attackSuccess: true, winner: "defender", reason: "higher" }));
  it("4 vs 18: attacker, only the attack succeeded", () => expect(r(4, 18)).toEqual({ attackSuccess: true, winner: "attacker", reason: "attacker-only" }));
  it("16 vs 10: defender, the attack failed", () => expect(r(16, 10)).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" }));
  it("19 vs 15: defender wins by default (both failed)", () => expect(r(19, 15)).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" }));
  it("8 vs 8: a tie goes to the defender", () => expect(r(8, 8)).toEqual({ attackSuccess: true, winner: "defender", reason: "tie" }));
  it("15 vs (none): the attack roll beats the defense score, so the attacker wins automatically", () => {
    expect(r(15, null)).toEqual({ attackSuccess: true, winner: "attacker", reason: "automatic" });
    expect(needsDefenseRoll(15, 15, 12)).toBe(false);
    expect(needsDefenseRoll(11, 15, 12)).toBe(true);
    expect(needsDefenseRoll(16, 15, 12)).toBe(false); // attack failed: no defense roll needed
  });
  it("natural 1 always succeeds (even against a negative attack score) and a 20 always fails", () => {
    expect(resolveContest({ attackRoll: 1, attackScore: -3, defenseRoll: 1, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "defender", reason: "tie" });
    expect(resolveContest({ attackRoll: 1, attackScore: -3, defenseRoll: 5, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "defender", reason: "higher" });
    expect(resolveContest({ attackRoll: 1, attackScore: -3, defenseRoll: 18, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "attacker", reason: "attacker-only" });
    expect(resolveContest({ attackRoll: 20, attackScore: 30, defenseRoll: null, defenseScore: 5 })).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" });
  });
  it("unopposed: no defender at all", () => {
    expect(resolveContest({ attackRoll: 10, attackScore: 12, defenseRoll: null, defenseScore: null })).toEqual({ attackSuccess: true, winner: "attacker", reason: "unopposed" });
    expect(resolveContest({ attackRoll: 13, attackScore: 12, defenseRoll: null, defenseScore: null })).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" });
    expect(needsDefenseRoll(10, 12, null)).toBe(false);
  });
  it("a needed defense roll that is missing is a programming error", () => {
    expect(() => resolveContest({ attackRoll: 5, attackScore: 15, defenseRoll: null, defenseScore: 12 })).toThrow();
  });
});

describe("maintainedCheck (p.24): +1 to the score; a failed check counts as a success of 1", () => {
  it("applies the bonus and the failure rule", () => {
    expect(maintainedCheck(10, 9)).toEqual({ result: "success", success: true, special: true, roll: 10, score: 10 });
    expect(maintainedCheck(15, 9)).toEqual({ result: "minimum-success", success: true, special: false, roll: 1, score: 10 });
  });
});

describe("resolveSeries (the one-two punch)", () => {
  it("two attacks, each resolved; tangents add up", () => {
    const out = resolveSeries([{ roll: 4, score: 15 }, { roll: 5, score: 15 }], 12, [18, 18], 0);
    expect(out.tangentsGained).toBe(2);
    expect(out.fullContact).toBe(false);
    expect(out.anySuccess).toBe(true);
    expect(out.steps.map((s) => s.made)).toEqual([true, true]);
  });
  it("stops after full contact: the second attack is not made", () => {
    const out = resolveSeries([{ roll: 4, score: 15 }, { roll: 5, score: 15 }], null, [null, null], 2);
    expect(out.tangentsGained).toBe(1);
    expect(out.fullContact).toBe(true);
    expect(out.steps.map((s) => s.made)).toEqual([true, false]);
    expect(out.steps[1]).toEqual({ made: false, result: null, defenseRoll: null });
  });
  it("both attacks fail: no tangents, no success (the cost is half)", () => {
    const out = resolveSeries([{ roll: 19, score: 15 }, { roll: 20, score: 15 }], 12, [null, null], 0);
    expect(out).toMatchObject({ tangentsGained: 0, anySuccess: false, fullContact: false });
  });
  it("a defender win produces no tangent; a missing needed defense roll throws", () => {
    expect(resolveSeries([{ roll: 3, score: 15 }], 12, [9], 0)).toMatchObject({ tangentsGained: 0, anySuccess: true });
    expect(() => resolveSeries([{ roll: 3, score: 15 }], 12, [null], 0)).toThrow();
  });
  it("starting tangents already at 3 make no attack", () => {
    expect(resolveSeries([{ roll: 3, score: 15 }], null, [null], 3).steps[0]!.made).toBe(false);
  });
});

describe("contacts", () => {
  const c = (target: string, tangents: number): Contact => ({ target, name: target.toUpperCase(), tangents });
  it("recordTangents adds, caps at 3 and reaches full contact", () => {
    expect(recordTangents([], "a", "A", 2)).toEqual([{ target: "a", name: "A", tangents: 2 }]);
    expect(recordTangents([c("a", 2)], "a", "A", 5)[0]!.tangents).toBe(FULL_CONTACT);
    expect(isFullContact(c("a", 3))).toBe(true);
    expect(isFullContact(c("a", 2))).toBe(false);
    expect(recordTangents([c("a", 2)], "a", "A", 0)).toEqual([c("a", 2)]);
  });
  it("tangents on a different target break the old partial tangents but keep full contacts", () => {
    const next = recordTangents([c("a", 2), c("b", 3)], "c", "C", 1);
    expect(next.map((x) => [x.target, x.tangents])).toEqual([["b", 3], ["c", 1]]);
  });
  it("breakTangents and endContact", () => {
    expect(breakTangents([c("a", 2), c("b", 3)]).map((x) => x.target)).toEqual(["b"]);
    expect(breakTangents([c("a", 2), c("b", 2)], "a").map((x) => x.target)).toEqual(["b"]);
    expect(endContact([c("a", 2), c("b", 3)], "b").map((x) => x.target)).toEqual(["a"]);
  });
  it("upkeep is 1 PSP while any partial tangent exists, else 0; tangentsOn", () => {
    expect(upkeepDue([c("a", 1)])).toBe(1);
    expect(upkeepDue([c("a", 3)])).toBe(0);
    expect(upkeepDue([])).toBe(0);
    expect(tangentsOn([c("a", 2)], "a")).toBe(2);
    expect(tangentsOn([c("a", 2)], "z")).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail** (`npx vitest run tests/core/psionics`).
- [ ] **Step 3: Implement** `combat.ts`:

```ts
import { rollPowerCheck, type PowerCheck } from "./check";

export const ATTACK_MODES = ["Mind Thrust", "Ego Whip", "Id Insinuation", "Psychic Crush", "Psionic Blast"] as const;
export const DEFENSE_MODES = ["Mind Blank", "Thought Shield", "Mental Barrier", "Intellect Fortress", "Tower of Iron Will"] as const;

const norm = (s: string): string => s.trim().toLowerCase();
const indexOfName = (list: readonly string[], name: string): number => list.findIndex((n) => norm(n) === norm(name));

export const isAttackMode = (name: string): boolean => indexOfName(ATTACK_MODES, name) >= 0;
export const isDefenseMode = (name: string): boolean => indexOfName(DEFENSE_MODES, name) >= 0;

/** PHBR5 Table 14 (p.26), rows in ATTACK_MODES order, columns in DEFENSE_MODES order. */
// prettier-ignore
const TABLE_14: readonly (readonly number[])[] = [
  [5, -2, -4, -4, -5],
  [5, 0, -3, -4, -3],
  [-3, 2, 4, -1, -3],
  [1, -3, -1, -3, -4],
  [2, 3, 0, -1, -2],
];

export function attackModifier(attack: string, defense: string | null): number {
  if (defense === null) return 0;
  const row = indexOfName(ATTACK_MODES, attack);
  const col = indexOfName(DEFENSE_MODES, defense);
  return row < 0 || col < 0 ? 0 : TABLE_14[row]![col]!;
}

export interface ContestResult {
  attackSuccess: boolean;
  winner: "attacker" | "defender";
  reason: "unopposed" | "attack-failed" | "automatic" | "attacker-only" | "higher" | "tie";
}

/** True when the contest cannot be settled without the defender's roll. */
export function needsDefenseRoll(attackRoll: number, attackScore: number, defenseScore: number | null): boolean {
  if (defenseScore === null) return false;
  return rollPowerCheck(attackRoll, attackScore).success && attackRoll <= defenseScore;
}

/** A psychic contest (PHBR5 p.22): higher successful roll wins; ties and double failures go to the defender; an attack roll above the defense score wins outright. */
export function resolveContest(i: { attackRoll: number; attackScore: number; defenseRoll: number | null; defenseScore: number | null }): ContestResult {
  const attack = rollPowerCheck(i.attackRoll, i.attackScore);
  if (!attack.success) return { attackSuccess: false, winner: "defender", reason: "attack-failed" };
  if (i.defenseScore === null) return { attackSuccess: true, winner: "attacker", reason: "unopposed" };
  if (i.attackRoll > i.defenseScore) return { attackSuccess: true, winner: "attacker", reason: "automatic" };
  if (i.defenseRoll === null) throw new Error("resolveContest: a defense roll is required");
  const defense = rollPowerCheck(i.defenseRoll, i.defenseScore);
  if (!defense.success) return { attackSuccess: true, winner: "attacker", reason: "attacker-only" };
  if (i.attackRoll > i.defenseRoll) return { attackSuccess: true, winner: "attacker", reason: "higher" };
  return { attackSuccess: true, winner: "defender", reason: i.attackRoll === i.defenseRoll ? "tie" : "higher" };
}

/** A maintained power in a contest (p.24): +1 to the score, and a failed check counts as a success of 1. */
export function maintainedCheck(roll: number, score: number): PowerCheck & { roll: number; score: number } {
  const boosted = score + 1;
  const check = rollPowerCheck(roll, boosted);
  if (check.success) return { ...check, roll, score: boosted };
  return { result: "minimum-success", success: true, special: false, roll: 1, score: boosted };
}
```
(`rollPowerCheck(20, boosted)` fails so a maintained 20 is also treated as a success of 1; this is the book's "ignores the failed check" rule. The test expectations in Step 1 for `maintainedCheck(10, 9)` -> a success at score 10; `maintainedCheck(15, 9)` -> minimum-success roll 1.)

```ts
export interface AttackStep { roll: number; score: number }
export interface SeriesOutcome {
  steps: { made: boolean; result: ContestResult | null; defenseRoll: number | null }[];
  tangentsGained: number;
  fullContact: boolean;
  anySuccess: boolean;
}

export const FULL_CONTACT = 3;

/** Resolves an attack mode's one-two punch (p.25): each attack is a separate contest; after full contact no more attacks are made. */
export function resolveSeries(steps: readonly AttackStep[], defenseScore: number | null, defenseRolls: readonly (number | null)[], startingTangents: number): SeriesOutcome {
  let tangents = startingTangents;
  let gained = 0;
  let anySuccess = false;
  const out: SeriesOutcome["steps"] = [];
  steps.forEach((s, i) => {
    if (tangents >= FULL_CONTACT) {
      out.push({ made: false, result: null, defenseRoll: null });
      return;
    }
    const need = needsDefenseRoll(s.roll, s.score, defenseScore);
    const defenseRoll = need ? (defenseRolls[i] ?? null) : null;
    if (need && defenseRoll === null) throw new Error("resolveSeries: a defense roll is required");
    const result = resolveContest({ attackRoll: s.roll, attackScore: s.score, defenseRoll, defenseScore });
    if (result.attackSuccess) anySuccess = true;
    if (result.winner === "attacker") { tangents += 1; gained += 1; }
    out.push({ made: true, result, defenseRoll });
  });
  return { steps: out, tangentsGained: gained, fullContact: tangents >= FULL_CONTACT, anySuccess };
}

export interface Contact { target: string; name: string; tangents: number }

export const isFullContact = (c: Contact): boolean => c.tangents >= FULL_CONTACT;
export const tangentsOn = (contacts: readonly Contact[], target: string): number => contacts.find((c) => c.target === target)?.tangents ?? 0;

/** Adds tangents on one target (capped at full contact); partial tangents on any other target are broken (p.26-27), full contacts are kept. */
export function recordTangents(contacts: readonly Contact[], target: string, name: string, count: number): Contact[] {
  if (count <= 0) return contacts.map((c) => ({ ...c }));
  const kept = contacts.filter((c) => c.target === target || isFullContact(c)).map((c) => ({ ...c }));
  const mine = kept.find((c) => c.target === target);
  if (mine) mine.tangents = Math.min(FULL_CONTACT, mine.tangents + count);
  else kept.push({ target, name, tangents: Math.min(FULL_CONTACT, count) });
  return kept;
}

/** Breaks partial tangents (all, or only one target's); a full contact is never broken this way. */
export function breakTangents(contacts: readonly Contact[], target?: string): Contact[] {
  return contacts.filter((c) => isFullContact(c) || (target !== undefined && c.target !== target)).map((c) => ({ ...c }));
}

export const endContact = (contacts: readonly Contact[], target: string): Contact[] => contacts.filter((c) => c.target !== target).map((c) => ({ ...c }));

/** 1 PSP per round while any partial tangent is held; full contact is free (p.26-27). */
export const upkeepDue = (contacts: readonly Contact[]): number => (contacts.some((c) => c.tangents > 0 && !isFullContact(c)) ? 1 : 0);
```
Export from `index.ts`. 
- [ ] **Step 4: Run** `npx vitest run tests/core/psionics && npm run typecheck && npm run lint && npm run test:coverage` (100% on `combat.ts`; add tests for any uncovered branch). **Step 5: Commit** "feat(psionics): pure psionic combat rules (Table 14, contests, tangents) (SP15 Plan C)".

---

### Task 2: Actor state and the non-contest actions

**Files:** `src/data/actor/base-actor.ts`, `src/sheets/character/psionic-combat.ts` (new), `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/sheets/character/psionic-combat.test.ts` (new), `tests/data/object-field-initial.test.ts`, `tsconfig.core.json` if needed.

**Interfaces:**
- Schema: `system.psionics` gains `activeDefense: StringField({ required: true, blank: true, initial: "" })` and `contacts: ArrayField(SchemaField({ target: StringField({ required: true, blank: false }), name: StringField({ required: true, blank: true, initial: "" }), tangents: NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }) }), { required: true, initial: () => [] })` (read how the Plan A `maintained` field is declared and mirror it; extend the typed shim and the `PsionicActor` interface in `psionic-actions.ts` with `activeDefense: string; contacts: Contact[]`; add a regression guard for the `contacts` factory initial next to the `maintained` one in `object-field-initial.test.ts`).
- `psionic-combat.ts` exports `raiseDefense(actor, powerId)`, `dropDefense(actor)`, `payUpkeep(actor)`, `endContactAction(actor, target)` (reuse `currentPsp`, `requirePsionicist`-style gating and `warn` toasts: export what you need from `psionic-actions.ts` rather than duplicating).
  - `raiseDefense`: psionicist only; the power must be an owned `power` item of kind `defense` and a recognized defense mode (`isDefenseMode(name)`); pool at least its initial cost (else the existing `notEnoughPsp` toast, no write); one update: `psp` minus the cost and `activeDefense` set to the power id; raising the already-active one is refused (no write, info toast `ADND2E.sheet.psionics.combat.alreadyRaised`).
  - `dropDefense`: psionicist only; sets `activeDefense` to "" (no cost); no write when none is active.
  - `payUpkeep`: psionicist only; `due = upkeepDue(contacts)`; due 0 -> info toast `ADND2E.sheet.psionics.combat.noUpkeep`, no write; pool >= 1 -> `psp` minus 1; pool 0 -> the partial tangents are broken (`breakTangents(contacts)`) with a warn toast `ADND2E.sheet.psionics.combat.tangentsBroken`.
  - `endContactAction`: removes the contact (`endContact`), one update.
- New lang keys under `ADND2E.sheet.psionics.combat.{title,defense,noDefense,raise,drop,contacts,noContacts,fullContact,tangents,payUpkeep,end,attack,alreadyRaised,noUpkeep,tangentsBroken}` (short plain strings); assert them all in en-coverage.

- [ ] **Step 1: Tests first** with fake actors (follow `tests/sheets/character/psionic-actions.test.ts` setup: stub `ui`, `game.i18n`), exact writes: raise pays e.g. Thought Shield cost 1 (PSP 20 -> 19, `activeDefense` set), refused when the pool is 0 or the power is not a defense mode or not owned; drop; drop with none; upkeep with a partial tangent (PSP 10 -> 9), with none (no write), with PSP 0 (tangents broken, full contacts kept); endContact; every action refuses a non-psionicist (`psionics.level` 0) with no write. Schema defaults: a source-pinned check that `activeDefense` and `contacts` are declared with a blank initial and a factory initial (like the Plan A tests), and the headless proof (Task 5) validates them against the real schema.
- [ ] **Step 2-4:** run to fail, implement, run `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`; **Step 5: Commit** "feat(psionics): active defense, contacts state and upkeep actions (SP15 Plan C)".

---

### Task 3: The attack-mode flow, the defender's roll and the result hook

**Files:** `src/sheets/character/psionic-combat.ts` (extend), `src/chat/chat-listeners.ts`, `src/hooks/psionic-hooks.ts` (new), `src/system.ts` (register `registerPsionicHooks()` beside the casting/turning hooks), `templates/chat/psionic-contest.hbs` (new), `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/sheets/character/psionic-combat.test.ts`, `tests/hooks/psionic-hooks.test.ts` (new), a chat-listener test if one exists, `tsconfig.core.json` excludes as needed.

**Interfaces and behavior** (read first: `src/sheets/character/psionic-actions.ts` `usePower`, `src/chat/chat-listeners.ts` `renderChatMessageHTML` pattern and `onApplyCastEffect` for `game.user.targets`, `src/hooks/casting-hooks.ts` `createChatMessage` + flag pattern):
- `attackMode(actor, powerId, deps?)` (`deps` injectable for tests: `roll: () => Promise<number>`, `targets: () => TargetLike[]`, `hasOnlineOwner: (targetActor) => boolean`, `userId: string`):
  1. Gates: psionicist; the power is an owned `power` item whose name `isAttackMode`; exactly one target (else toast `ADND2E.sheet.psionics.combat.noTarget`; more than one: use the first); the target's actor is not the attacker; pool >= the power's initial cost (else `notEnoughPsp`).
  2. The target's defense: the target actor's `system.psionics.activeDefense` item (an owned `defense` power of a psionicist target, `psionics.level > 0`), giving `{ name, score }` where score = `powerScore(target ability, modifier + scoreBonus)`; none -> `null` (undefended). The attack score for each step = attacker's `powerScore(...)` + `attackModifier(power.name, defense?.name ?? null)`.
  3. Roll both attacks (`roll()` twice). `startingTangents = tangentsOn(actor contacts, target.uuid)`.
  4. If `needsDefenseRoll` for any step that `resolveSeries` would make AND the defense exists AND `hasOnlineOwner(target.actor)` -> **pending**: pay the cost now (`checkCost(cost, anySuccess)` where `anySuccess` assumes the made attacks' checks: compute from the attack checks only, stopping at the starting full contact), write `psp`, and post a pending chat card whose message flags `flags.adnd2e.psionicContest = { id, attackerActorUuid, attackerUserId, targetActorUuid, targetName, powerName, defense: { name, score }, steps: [{ roll, score }], startingTangents, state: "pending" }`; return.
  5. Otherwise **immediate**: roll the needed defense rolls with `roll()`, call `resolveSeries`, pay `checkCost(cost, outcome.anySuccess)`, and in ONE `actor.update`: `psp` and `contacts` = `recordTangents(contacts, target.uuid, target.name, outcome.tangentsGained)` (when `tangentsGained > 0`); post one resolved card (the same template) flagged `state: "resolved"` with the per-step results.
- `rollDefense(messageId)` (the defender's button): reads the message's `psionicContest` flag (must be `pending`); allowed for the target actor's owner or a GM (else toast); rolls one d20 per step that needs it (same `needsDefenseRoll`/`resolveSeries` logic, with the defender's `roll()`), posts the resolved card with flags `{ ...contest, state: "resolved", outcome }` (author = the clicker, speaker = the target actor); idempotent: a message already answered (track `answered` in a flag you set on the pending message via `message.setFlag`, allowed for GM/author only, else detect an existing resolved card with the same `contest.id` among `game.messages`) is refused with a toast.
- The result hook `registerPsionicHooks()`: `Hooks.on("createChatMessage", message => ...)`: when the message has `flags.adnd2e.psionicContest.state === "resolved"` with `outcome.tangentsGained > 0` and `flag.attackerUserId === game.user.id` and the attacker actor exists and is owned by this user: apply `recordTangents` to the attacker's `system.psionics.contacts` (via `actor.update`), once per contest id (keep a list of the last 50 applied contest ids in an actor flag `flags.adnd2e.psionicApplied`). For an IMMEDIATE contest the action already wrote the contacts, so the immediate card sets `flags.adnd2e.psionicContest.applied = true` and the hook skips it.
- Card buttons wired in `chat-listeners.ts` (follow the existing `renderChatMessageHTML` pattern): `data-action="psionicRollDefense"` (pending cards, shown only to the target's owners and GMs by `data-owner`/visibility logic you resolve at render: render the button for everyone and let `rollDefense` refuse, or hide it for others when the message flag lets you tell; choose the simpler safe option and note it) and `data-action="psionicRecordTangent"` (resolved cards where `applied` is false and `tangentsGained > 0`, for the attacker actor's owners: calls the same apply function).
- `templates/chat/psionic-contest.hbs`: header with the attacker name and the power; per step: "attack roll / score (modifier note)", the defense line ("defense mode, roll / score" or "undefended"), the result text by `reason`, "Not made (full contact)"; a footer with PSPs paid, tangents ("N tangents" or "Full contact"), and the buttons above. All strings localized; new lang keys under `ADND2E.chat.psionicContest.*` and `ADND2E.sheet.psionics.combat.noTarget` etc.
- [ ] **Step 1: Tests first** (exact numbers): immediate vs undefended (attacker Wis 17 Mind Thrust score 17-3=... use the real Mind Thrust numbers from the pack `packs/powers/_source/mind-thrust.json` and assert the exact scores, cost and PSP): both attacks succeed -> 2 tangents recorded; against a Mind Blank target the Table 14 modifier applies to the attack score (assert the exact score on the card context); both attacks fail -> half cost; one succeeds -> full cost; starting at 2 tangents the first success makes full contact and the second attack is "not made"; the pending path only when `hasOnlineOwner` is true AND a defense roll is needed (otherwise immediate); `rollDefense` by the target owner resolves with injected defense rolls, refuses a non-owner non-GM, refuses a second answer; the hook applies tangents once for the attacker's user only and skips `applied: true` immediate cards and other users' clients; refusals (no target, not an attack mode, not enough PSPs, non-psionicist) leave no writes and no cards.
- [ ] **Step 2-4:** implement; `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`; **Step 5: Commit** "feat(psionics): attack modes as psychic contests with player-rolled defense (SP15 Plan C)".

---

### Task 4: The Psionic combat panel

**Files:** `src/sheets/character/{context.ts,context-types.ts,sheet.ts}`, `templates/actor/pc/partials/pc-psionics-panels.hbs` and `pc-psionic-power-row.hbs`, `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/sheets/character/context.test.ts`, `tests/templates/pc-sheet-bindings.test.ts`, `README.md`.

**Interfaces:** `PsionicsView` gains `combat: { activeDefense: { id, name } | null; defenses: { id, name }[]; contacts: { target, name, tangents, full: boolean }[]; hasUpkeep: boolean }`; each power row gains `isAttackMode: boolean` (by `isAttackMode(name)`). `PsionicsInput` gains `activeDefense: string` and `contacts: Contact[]` (read from `system.psionics`, defaulting to "" and `[]`). Sheet actions (registered in `DEFAULT_OPTIONS.actions` and `PC_ONLY_ACTIONS`): `psionicRaiseDefense` (reads the chosen id from a `[data-psionic-defense]` select, no `name=`), `psionicDropDefense`, `psionicAttack` (button on an attack-mode row: `data-power-id`), `psionicPayUpkeep`, `psionicEndContact` (`data-target`). The panel section "Psionic combat" (title `ADND2E.sheet.psionics.combat.title`) shows the active defense (or "None") with the select + Raise + Drop, the contacts list ("Full contact" or "N tangents") with Pay upkeep (when `hasUpkeep`) and End, and an Attack button on each attack-mode row. README SP15 row -> "Plans A-C complete (foundation, catalog, psionic combat); D not started".
- [ ] Tests first: `buildPsionicsView` combat block (no defense, a raised defense resolved to its name, a stale `activeDefense` id that no longer exists resolves to `null` and is not shown, contacts with `full` for 3 tangents, `hasUpkeep` true only with a partial tangent, `isAttackMode` true for Mind Thrust and false for Contact); the bindings test (every new `data-action` registered, `PC_ONLY_ACTIONS`, no `name=` on the new select); lang keys. Implement, run the full test suite, typecheck, lint, coverage; **Commit** "feat(psionics): the Psionic combat panel on the Psionics tab (SP15 Plan C)".

---

### Task 5: Verification gates (no new feature code unless a gate fails)

- [ ] Full CI sequence; whole-branch review (most capable model) covering: Table 14 and the book's example outcomes (spot-check the cells against the page image: PDF page 29 = book p.26), the pending/resolved flow edge cases (a GM-owned target, an offline owner, the defender pressing twice, the attacker offline, two attackers vs one target, the pending card visible and the button usable only by the right people), cost arithmetic, tangent bookkeeping (target switch, full contact free, upkeep at 0 PSP), every write on the actor's own data, gating, lang keys, and the non-GM seats.
- [ ] Headless proof (controller): real schema for `activeDefense`/`contacts` (pre-Plan-C actor cleans to ""/[]; no shared arrays); real contests with the real pack powers (Ego Whip vs Mind Blank score arithmetic, Thought Shield, the book's example outcomes through `resolveContest`); the real action functions with fake actors for the immediate flow and the pending flow with injected rolls through real `updateSource`; the real hook function; the chat card and the panel rendered with a localize stub.
- [ ] Rebuild the installed system if Foundry is closed; push; open the PR; hand the user a manual checklist WITH PREREQUISITES AND EXACT NUMBERS: two player seats (attacker and defender, each with a Psionicist class item, Wis 17, Con 16, Int 12, level 5, the needed powers: Contact, Mindlink, a defense mode such as Thought Shield for the defender; Ego Whip or Mind Thrust for the attacker) plus a GM-owned NPC target; expected scores and PSP changes; the pending card flow; tangents 1-2-3 and full contact; upkeep; target switching.

---

## Self-review notes

- Spec coverage: pure rules (Task 1); actor state, raise/drop/upkeep/end (Task 2); attack flow, player-rolled defense, hook (Task 3); sheet panel (Task 4); testing and gates (Task 5). Out-of-scope items stay honor-system (follow-up issue to file in Task 5).
- Names are consistent across tasks: `activeDefense`, `contacts`, `Contact`, `resolveSeries`, `needsDefenseRoll`, `attackModifier`, `isAttackMode`/`isDefenseMode`, `psionicContest` flag, `attackMode`/`rollDefense`/`raiseDefense`/`dropDefense`/`payUpkeep`/`endContactAction`.
- Judgment points left to the implementers (named): the exact chat-card visibility mechanism for the defender's button, the d20 roll helper, the actor typings, and the existing census tests that must be extended.
