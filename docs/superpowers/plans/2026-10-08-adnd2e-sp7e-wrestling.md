# Wrestling (Combat & Tactics ch.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Combat & Tactics wrestling rules (attack, opposed hold check, grip ladder, lock effects, breaking free, temporary damage) behind a new `wrestling` setting, replacing the simplified one-roll grapple when on.

**Architecture:** A pure rules engine in `src/core/wrestling/` (100% covered) decides every opposed roll and grip transition. Grapple state lives on both actors as `held` / `grappling` condition effects carrying a `GrappleRecord` in `flags.adnd2e.grapple`. Contests reuse the SP15 psionic-contest pattern (a pending chat card, then a resolved card), and all cross-actor writes go through the existing GM relay via one new `grapple` request kind.

**Tech Stack:** TypeScript, Foundry VTT v14 (types are fvtt-types v13: cast where v14-only), Vitest (100% statement gate), Handlebars chat templates.

**Spec:** `docs/superpowers/specs/2026-10-08-adnd2e-sp7e-wrestling-design.md`

## Global Constraints

- Content policy: mechanical values only; no rulebook prose in code, lang or pack docs (`system.description` stays `""`).
- `npm run test:coverage` must stay at 100% statements/lines/functions (branches >= 90). Foundry glue files (`src/sheets/**/*-actions.ts`, `src/relay/**`, `src/chat/**`, `src/hooks/**`, `*-ui.ts`) are excluded from the gate and verified in a dev world; every new **pure** file must be added to `vitest.config.ts` coverage `include` if it is outside `src/core/**`, `src/combat/**`, `src/data/derive/**`.
- Run before every PR: `npx tsc --noEmit -p .`, `npx tsc --noEmit -p tsconfig.core.json`, `npm run test:coverage`, `npx eslint src tests`.
- Files use CRLF on disk (git autocrlf): when editing with scripts, read/write with `newline=""` and match the file's line ending; never rewrite whole existing files.
- The setting key is `wrestling` (Boolean, world scope, default **false**, no reload). It requires `combatAndTacticsEnabled`.
- Everyone is *Familiar* (spec): one wrestling attack per round, no skill-level bonuses.
- Branch: create `feat/wrestling` from the spec branch `docs/sp7-wrestling-spec` (the spec commit travels with the work). PR title `feat: wrestling (C&T ch.5) (#93, step 1)`.

## File Structure

| File | Responsibility |
|---|---|
| `src/core/wrestling/types.ts` (create) | `GripRung`, `LockEffectId`, `GrappleRecord`, `parseGrappleRecord` (strict validator) |
| `src/core/wrestling/modifiers.ts` (create) | size modifier, body modifiers, wrestling defense AC |
| `src/core/wrestling/contest.ts` (create) | one side's roll result and the opposed-roll winner |
| `src/core/wrestling/grip.ts` (create) | grip-ladder transitions for hold / improve / hold-on / break-free |
| `src/core/wrestling/locks.ts` (create) | lock-effect table, damage formulas, size limits, press escalation |
| `src/core/wrestling/damage.ts` (create) | temporary (nonlethal) damage arithmetic |
| `src/core/wrestling/index.ts` (create) | barrel |
| `src/combat/grapple-state.ts` (create) | read a `GrappleRecord` off an actor's effects; flag path |
| `src/combat/wrestling-card.ts` (create) | `WrestleContestFlag` + card view builder (pure) |
| `src/core/options.ts`, `src/settings/registry.ts`, `src/settings/sections.ts`, `src/types/global.d.ts`, `lang/en.json` (modify) | the `wrestling` setting |
| `src/conditions.ts`, `packs/conditions/_source/grappling.json`, `packs/conditions/_source/_MANIFEST.md` (modify/create) | the `grappling` condition |
| `src/combat/apply-relay.ts`, `src/relay/apply-effect.ts` (modify) | the `grapple` relay request |
| `src/sheets/character/wrestling-actions.ts` (create) | Foundry glue: start a wrestle, start a contest, answer it, resolve writes |
| `src/chat/chat-listeners.ts` (modify), `templates/chat/wrestling-contest.hbs` (create) | contest card wiring |
| `src/sheets/character/context.ts`, `context-types.ts`, `sheet.ts`, `templates/actor/pc/partials/pc-main-panels.hbs` (modify) | grapple panel on the PC sheet |

---

### Task 1: Opposed-roll engine (modifiers + contest)

**Files:**
- Create: `src/core/wrestling/types.ts`, `src/core/wrestling/modifiers.ts`, `src/core/wrestling/contest.ts`, `src/core/wrestling/index.ts`
- Test: `tests/core/wrestling/contest.test.ts`

**Interfaces:**
- Produces:
  - `type GripRung = "free" | "held" | "locked"`
  - `type SizeKey = "tiny"|"small"|"medium"|"large"|"huge"|"gargantuan"`
  - `sizeModifier(initiatorSize: string | null | undefined, otherSize: string | null | undefined): number`
  - `bodyModifier(t: { immune?: boolean; supple?: boolean }): number`
  - `wrestlingDefenseAc(input: { dexDefensiveAdj: number; magicBonus: number }): number`
  - `interface RollSide { thac0: number; bonus: number; targetAc: number; natural: number }`
  - `interface SideResult { natural: number; total: number; hit: boolean; crit: boolean }`
  - `type Winner = "initiator" | "responder" | "none"`
  - `interface OpposedResult { winner: Winner; initiator: SideResult; responder: SideResult; critical: boolean }`
  - `sideResult(side: RollSide): SideResult`, `resolveOpposed(initiator: RollSide, responder: RollSide): OpposedResult`

- [ ] **Step 1: Write the failing test** — `tests/core/wrestling/contest.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  bodyModifier, resolveOpposed, sideResult, sizeModifier, wrestlingDefenseAc,
} from "../../../src/core/wrestling";

describe("sizeModifier", () => {
  it("is +4 / -4 per size class, from the initiator's point of view", () => {
    expect(sizeModifier("small", "large")).toBe(-8);
    expect(sizeModifier("large", "medium")).toBe(4);
    expect(sizeModifier("medium", "medium")).toBe(0);
  });
  it("treats a missing or unknown size as medium", () => {
    expect(sizeModifier(null, "large")).toBe(-4);
    expect(sizeModifier("bogus", undefined)).toBe(0);
  });
});

describe("bodyModifier", () => {
  it("is -1 for an immune defender, -2 for a supple one, and they stack", () => {
    expect(bodyModifier({})).toBe(0);
    expect(bodyModifier({ immune: true })).toBe(-1);
    expect(bodyModifier({ supple: true })).toBe(-2);
    expect(bodyModifier({ immune: true, supple: true })).toBe(-3);
  });
});

describe("wrestlingDefenseAc", () => {
  it("is 10 plus Dex defensive adjustment minus magic protection, clamped to -10..10", () => {
    expect(wrestlingDefenseAc({ dexDefensiveAdj: 0, magicBonus: 0 })).toBe(10);
    expect(wrestlingDefenseAc({ dexDefensiveAdj: -1, magicBonus: 1 })).toBe(8); // book example: chain mail +1 and Dex 15
    expect(wrestlingDefenseAc({ dexDefensiveAdj: 4, magicBonus: 0 })).toBe(10);
    expect(wrestlingDefenseAc({ dexDefensiveAdj: -4, magicBonus: 30 })).toBe(-10);
  });
});

describe("sideResult", () => {
  it("hits when total reaches thac0 - targetAc, a natural 20 always hits and a natural 1 never does", () => {
    expect(sideResult({ thac0: 17, bonus: 0, targetAc: 10, natural: 7 })).toEqual({ natural: 7, total: 7, hit: true, crit: false });
    expect(sideResult({ thac0: 17, bonus: 0, targetAc: 10, natural: 6 }).hit).toBe(false);
    expect(sideResult({ thac0: 20, bonus: 5, targetAc: -10, natural: 1 }).hit).toBe(false);
    expect(sideResult({ thac0: 20, bonus: 0, targetAc: -10, natural: 20 })).toMatchObject({ hit: true, crit: true });
  });
});

describe("resolveOpposed", () => {
  const anada = (natural: number, bonus: number, targetAc: number) => ({ thac0: 17, bonus, targetAc, natural });
  const bugbear = (natural: number, bonus: number, targetAc: number) => ({ thac0: 17, bonus, targetAc, natural });

  it("both hit: the LOWER total wins (book example, hold check)", () => {
    // Anada: Str +1, one size class smaller (-4), rolls 10 against AC 10; bugbear rolls 18 against AC 8.
    const r = resolveOpposed(anada(10, 1 - 4, 10), bugbear(18, 0, 8));
    expect(r.initiator.hit && r.responder.hit).toBe(true);
    expect(r.winner).toBe("initiator");
    expect(r.critical).toBe(false);
  });

  it("a winning natural 20 is a critical; a losing one is disregarded (book example, breaking free)", () => {
    // Bugbear attacks: +4 size, natural 20; Anada rolls 11 (+1 Str) and wins with the lower total.
    const r = resolveOpposed(bugbear(20, 4, 8), anada(11, 1, 10));
    expect(r.initiator.crit).toBe(true);
    expect(r.winner).toBe("responder");
    expect(r.critical).toBe(false);
  });

  it("exactly one hit: that side wins (book example, lock attempt)", () => {
    const r = resolveOpposed(anada(12, 1, 10), bugbear(2, 0, 8));
    expect(r.responder.hit).toBe(false);
    expect(r.winner).toBe("initiator");
  });

  it("a tie or a double miss is no change", () => {
    expect(resolveOpposed(anada(10, 0, 10), bugbear(10, 0, 10)).winner).toBe("none");
    expect(resolveOpposed(anada(2, 0, 10), bugbear(2, 0, 10)).winner).toBe("none");
  });

  it("the winner's natural 20 is the critical; a higher-total natural 20 loses", () => {
    const r = resolveOpposed(anada(20, 0, 10), bugbear(19, 0, 10));
    expect(r.winner).toBe("responder");
    expect(r.critical).toBe(false);
    const r2 = resolveOpposed(anada(20, 0, 10), bugbear(1, 0, 10)); // responder natural 1 misses
    expect(r2.winner).toBe("initiator");
    expect(r2.critical).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify the suite fails**

Run: `npx vitest run tests/core/wrestling/contest.test.ts`
Expected: FAIL — cannot resolve `src/core/wrestling`.

- [ ] **Step 3: Implement**

`src/core/wrestling/types.ts`:

```ts
// Combat & Tactics wrestling (SP7e). Pure, Foundry-free.

/** free = no grapple; held = the book's "grappled"/"held" rung; locked = the top rung. */
export type GripRung = "free" | "held" | "locked";

export const LOCK_EFFECT_IDS = ["throw", "takedown", "slam", "press", "hammer", "manipulate", "carry"] as const;
export type LockEffectId = (typeof LOCK_EFFECT_IDS)[number];

/** The grapple state stored on BOTH actors' condition effects (`flags.adnd2e.grapple`); the two sides mirror each other. */
export interface GrappleRecord {
  /** shared by both sides' records */
  id: string;
  role: "holder" | "held";
  opponentUuid: string;
  opponentName: string;
  rung: "held" | "locked";
  /** active lock effects on the held character */
  locks: LockEffectId[];
  /** the lock most recently applied, for "hold on" repeats and press escalation */
  lastLock: LockEffectId | null;
  /** consecutive press count (0 when the last lock was not a press) */
  pressCount: number;
  /** a lock was won and the holder has not chosen its effect yet */
  lockPending: boolean;
}

const isString = (v: unknown): v is string => typeof v === "string" && v !== "";

/** A clean GrappleRecord, or null for anything malformed. The GM relay and the flag reader trust nothing else. */
export function parseGrappleRecord(raw: unknown): GrappleRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.id) || !isString(r.opponentUuid) || !isString(r.opponentName)) return null;
  if (r.role !== "holder" && r.role !== "held") return null;
  if (r.rung !== "held" && r.rung !== "locked") return null;
  if (!Array.isArray(r.locks) || !r.locks.every((l) => (LOCK_EFFECT_IDS as readonly unknown[]).includes(l))) return null;
  if (r.lastLock !== null && !(LOCK_EFFECT_IDS as readonly unknown[]).includes(r.lastLock)) return null;
  if (typeof r.pressCount !== "number" || !Number.isInteger(r.pressCount) || r.pressCount < 0 || r.pressCount > 50) return null;
  if (typeof r.lockPending !== "boolean") return null;
  return {
    id: r.id, role: r.role, opponentUuid: r.opponentUuid, opponentName: r.opponentName, rung: r.rung,
    locks: r.locks as LockEffectId[], lastLock: r.lastLock as LockEffectId | null, pressCount: r.pressCount, lockPending: r.lockPending,
  };
}
```

`src/core/wrestling/modifiers.ts`:

```ts
// Wrestling roll modifiers (C&T "Holds"). Pure.
export const SIZE_ORDER = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type SizeKey = (typeof SIZE_ORDER)[number];

function sizeIndex(size: string | null | undefined): number {
  const i = SIZE_ORDER.indexOf((size ?? "medium") as SizeKey);
  return i === -1 ? SIZE_ORDER.indexOf("medium") : i;
}

/** +4 / -4 per size class of the INITIATOR (the side starting the opposed roll) versus the other side. */
export function sizeModifier(initiatorSize: string | null | undefined, otherSize: string | null | undefined): number {
  return 4 * (sizeIndex(initiatorSize) - sizeIndex(otherSize));
}

/** -1 against a defender normally immune to the attack, -2 against an unusually supple body. */
export function bodyModifier(t: { immune?: boolean; supple?: boolean }): number {
  return (t.immune ? -1 : 0) + (t.supple ? -2 : 0);
}

/** The AC a wrestler is attacked at: 10 regardless of worn armor, plus Dex defensive adjustment (AC-signed, negative = agile) minus magic protection. */
export function wrestlingDefenseAc(input: { dexDefensiveAdj: number; magicBonus: number }): number {
  return Math.min(10, Math.max(-10, 10 + input.dexDefensiveAdj - input.magicBonus));
}
```

`src/core/wrestling/contest.ts`:

```ts
// One opposed wrestling roll (C&T "Holds"). Pure.
import { hitResult } from "../combat/attack";

export interface RollSide {
  thac0: number;
  /** every modifier on this side's roll: Strength, size (initiator only), body, situational */
  bonus: number;
  /** the AC this side attacks (the other side's wrestling AC) */
  targetAc: number;
  /** natural d20 */
  natural: number;
}

export interface SideResult {
  natural: number;
  total: number;
  hit: boolean;
  /** a natural 20 that hit (the system's critical convention) */
  crit: boolean;
}

export type Winner = "initiator" | "responder" | "none";

export interface OpposedResult {
  winner: Winner;
  initiator: SideResult;
  responder: SideResult;
  /** the WINNER's natural 20 — a losing critical is disregarded */
  critical: boolean;
}

export function sideResult(side: RollSide): SideResult {
  const h = hitResult({ naturalD20: side.natural, attackBonus: side.bonus, thac0: side.thac0, targetAc: side.targetAc });
  return { natural: side.natural, total: h.total, hit: h.hit, crit: h.autoHit };
}

/** Both hit: the lower total wins. Exactly one hits: that side wins. A tie or a double miss: no change. */
export function resolveOpposed(initiator: RollSide, responder: RollSide): OpposedResult {
  const i = sideResult(initiator);
  const r = sideResult(responder);
  let winner: Winner = "none";
  if (i.hit && r.hit) winner = i.total < r.total ? "initiator" : r.total < i.total ? "responder" : "none";
  else if (i.hit) winner = "initiator";
  else if (r.hit) winner = "responder";
  const critical = (winner === "initiator" && i.crit) || (winner === "responder" && r.crit);
  return { winner, initiator: i, responder: r, critical };
}
```

`src/core/wrestling/index.ts`:

```ts
export * from "./types";
export * from "./modifiers";
export * from "./contest";
```

- [ ] **Step 4: Run, then add the new folder to coverage if needed**

Run: `npx vitest run tests/core/wrestling/contest.test.ts` — Expected: PASS.
`src/core/**` is already in the coverage include; nothing to add.

- [ ] **Step 5: Add a `parseGrappleRecord` test and commit**

Append to the test file:

```ts
import { parseGrappleRecord } from "../../../src/core/wrestling";

describe("parseGrappleRecord", () => {
  const good = { id: "g1", role: "holder", opponentUuid: "Actor.x", opponentName: "Bugbear", rung: "held", locks: ["press"], lastLock: "press", pressCount: 2, lockPending: false };
  it("accepts a well-formed record unchanged", () => {
    expect(parseGrappleRecord(good)).toEqual(good);
  });
  it("rejects malformed records", () => {
    for (const bad of [null, [], "x", { ...good, id: "" }, { ...good, role: "x" }, { ...good, rung: "free" }, { ...good, locks: ["bad"] },
      { ...good, locks: "press" }, { ...good, lastLock: "bad" }, { ...good, pressCount: -1 }, { ...good, pressCount: 1.5 }, { ...good, lockPending: "no" },
      { ...good, opponentUuid: "" }, { ...good, opponentName: 3 }]) {
      expect(parseGrappleRecord(bad)).toBeNull();
    }
    expect(parseGrappleRecord({ ...good, lastLock: null })?.lastLock).toBeNull();
  });
});
```

Run: `npx vitest run tests/core/wrestling` — Expected: PASS. Then:

```bash
git checkout -q -b feat/wrestling
git add src/core/wrestling tests/core/wrestling
git commit -m "feat(wrestling): opposed-roll engine and grapple record type (#93)"
```

---

### Task 2: Grip ladder, lock effects, temporary damage

**Files:**
- Create: `src/core/wrestling/grip.ts`, `src/core/wrestling/locks.ts`, `src/core/wrestling/damage.ts`
- Modify: `src/core/wrestling/index.ts`
- Test: `tests/core/wrestling/grip.test.ts`, `tests/core/wrestling/locks.test.ts`

**Interfaces:**
- Consumes: `GripRung`, `LockEffectId` from Task 1.
- Produces:
  - `type GripAction = "hold" | "improve" | "holdOn" | "breakFree"`
  - `type Side = "holder" | "held"`
  - `interface GripInput { action: GripAction; rung: GripRung; winner: Side | "none"; critical: boolean }`
  - `interface GripOutcome { rung: GripRung; swap: boolean; lockPending: boolean; damageTo: Side | null; repeatLock: boolean }`
  - `gripOutcome(input: GripInput): GripOutcome`
  - `LOCK_SPECS: Record<LockEffectId, LockSpec>`; `lockDamageFormula(id, ctx)`; `canUseLock(id, holderSize, heldSize)`; `nextPressCount(lastLock, pressCount, chosen)`
  - `temporaryDamage(hp: { value: number; nonlethal: number }, amount: number): { value: number; nonlethal: number; unconscious: boolean }`

- [ ] **Step 1: Write the failing tests** — `tests/core/wrestling/grip.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { gripOutcome, temporaryDamage } from "../../../src/core/wrestling";

const g = (action: "hold" | "improve" | "holdOn" | "breakFree", rung: "free" | "held" | "locked", winner: "holder" | "held" | "none", critical = false) =>
  gripOutcome({ action, rung, winner, critical });

describe("hold (the first check after a hit)", () => {
  it("the holder winning establishes a hold and hurts the held character", () => {
    expect(g("hold", "free", "holder")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: "held", repeatLock: false });
  });
  it("anything else drives the attacker back: the grapple is over", () => {
    expect(g("hold", "free", "held")).toMatchObject({ rung: "free", damageTo: null });
    expect(g("hold", "free", "none")).toMatchObject({ rung: "free", damageTo: null });
  });
});

describe("improve grip", () => {
  it("holder wins: the rung rises to locked, a lock is pending, the held character is hurt", () => {
    expect(g("improve", "held", "holder")).toEqual({ rung: "locked", swap: false, lockPending: true, damageTo: "held", repeatLock: false });
    expect(g("improve", "locked", "holder")).toMatchObject({ rung: "locked", lockPending: true });
  });
  it("held wins: the holder is hurt and the rung falls", () => {
    expect(g("improve", "locked", "held")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: "holder", repeatLock: false });
    expect(g("improve", "held", "held")).toMatchObject({ rung: "free", damageTo: "holder" });
  });
  it("held wins with a critical: roles swap, the old held character locks the old holder", () => {
    expect(g("improve", "held", "held", true)).toEqual({ rung: "locked", swap: true, lockPending: true, damageTo: "holder", repeatLock: false });
  });
  it("no winner: nothing changes", () => {
    expect(g("improve", "held", "none")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: null, repeatLock: false });
  });
});

describe("hold on", () => {
  it("holder wins at held: still held and hurt; at locked: still locked and the last lock repeats", () => {
    expect(g("holdOn", "held", "holder")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: "held", repeatLock: false });
    expect(g("holdOn", "locked", "holder")).toEqual({ rung: "locked", swap: false, lockPending: false, damageTo: null, repeatLock: true });
  });
  it("held wins: the rung falls one place, with no damage and no critical swap", () => {
    expect(g("holdOn", "locked", "held", true)).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: null, repeatLock: false });
    expect(g("holdOn", "held", "held")).toMatchObject({ rung: "free" });
  });
  it("no winner: no change and no damage", () => {
    expect(g("holdOn", "locked", "none")).toEqual({ rung: "locked", swap: false, lockPending: false, damageTo: null, repeatLock: false });
  });
});

describe("break free", () => {
  it("held wins: the holder is hurt and the rung falls; a critical swaps roles", () => {
    expect(g("breakFree", "held", "held")).toEqual({ rung: "free", swap: false, lockPending: false, damageTo: "holder", repeatLock: false });
    expect(g("breakFree", "locked", "held")).toMatchObject({ rung: "held", damageTo: "holder" });
    expect(g("breakFree", "locked", "held", true)).toEqual({ rung: "locked", swap: true, lockPending: true, damageTo: "holder", repeatLock: false });
  });
  it("holder wins: no change, but a critical gives the holder a lock", () => {
    expect(g("breakFree", "held", "holder")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: null, repeatLock: false });
    expect(g("breakFree", "held", "holder", true)).toEqual({ rung: "locked", swap: false, lockPending: true, damageTo: null, repeatLock: false });
  });
  it("no winner: no change", () => {
    expect(g("breakFree", "locked", "none")).toMatchObject({ rung: "locked", damageTo: null });
  });
});

describe("temporaryDamage", () => {
  it("lowers HP, raises nonlethal by the same amount and flags unconsciousness at 0 or below", () => {
    expect(temporaryDamage({ value: 14, nonlethal: 0 }, 3)).toEqual({ value: 11, nonlethal: 3, unconscious: false });
    expect(temporaryDamage({ value: 5, nonlethal: 8 }, 5)).toEqual({ value: 0, nonlethal: 13, unconscious: true });
    expect(temporaryDamage({ value: 2, nonlethal: 0 }, 7)).toEqual({ value: -5, nonlethal: 7, unconscious: true });
  });
  it("ignores a non-positive amount", () => {
    expect(temporaryDamage({ value: 5, nonlethal: 1 }, 0)).toEqual({ value: 5, nonlethal: 1, unconscious: false });
  });
});
```

`tests/core/wrestling/locks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LOCK_SPECS, canUseLock, lockDamageFormula, nextPressCount } from "../../../src/core/wrestling";

describe("LOCK_SPECS", () => {
  it("covers the seven lock effects", () => {
    expect(Object.keys(LOCK_SPECS).sort()).toEqual(["carry", "hammer", "manipulate", "press", "slam", "takedown", "throw"]);
  });
  it("throw frees the target; takedown, slam and throw all leave it prone", () => {
    expect(LOCK_SPECS.throw).toMatchObject({ frees: true, prone: true });
    expect(LOCK_SPECS.takedown).toMatchObject({ frees: false, prone: true });
    expect(LOCK_SPECS.slam).toMatchObject({ frees: false, prone: true, dropsToHold: true });
    expect(LOCK_SPECS.press.prone).toBe(false);
  });
});

describe("lockDamageFormula", () => {
  const ctx = { pressCount: 1, hardSurface: false, strengthAdj: 0 };
  it("returns the dice per effect, adding the holder's Strength damage adjustment", () => {
    expect(lockDamageFormula("takedown", ctx)).toBe("1d3");
    expect(lockDamageFormula("hammer", { ...ctx, strengthAdj: 1 })).toBe("1d2+1");
    expect(lockDamageFormula("manipulate", ctx)).toBe("1d2");
    expect(lockDamageFormula("carry", ctx)).toBeNull();
  });
  it("throw and slam gain +1 on hard ground", () => {
    expect(lockDamageFormula("throw", ctx)).toBe("1d4");
    expect(lockDamageFormula("throw", { ...ctx, hardSurface: true })).toBe("1d4+1");
    expect(lockDamageFormula("slam", ctx)).toBe("1d8");
    expect(lockDamageFormula("slam", { ...ctx, hardSurface: true, strengthAdj: 2 })).toBe("1d8+3");
  });
  it("press escalates +1 per consecutive repeat", () => {
    expect(lockDamageFormula("press", { ...ctx, pressCount: 1 })).toBe("1d6+1");
    expect(lockDamageFormula("press", { ...ctx, pressCount: 5, strengthAdj: 1 })).toBe("1d6+6");
  });
  it("a negative Strength adjustment is written with a minus sign", () => {
    expect(lockDamageFormula("takedown", { ...ctx, strengthAdj: -1 })).toBe("1d3-1");
  });
});

describe("canUseLock", () => {
  it("throw and slam cannot be used on a target two or more size classes larger", () => {
    expect(canUseLock("throw", "medium", "huge")).toBe(false);
    expect(canUseLock("slam", "medium", "large")).toBe(true);
    expect(canUseLock("press", "small", "gargantuan")).toBe(true);
  });
});

describe("nextPressCount", () => {
  it("counts consecutive presses and resets on any other lock", () => {
    expect(nextPressCount(null, 0, "press")).toBe(1);
    expect(nextPressCount("press", 1, "press")).toBe(2);
    expect(nextPressCount("press", 3, "hammer")).toBe(0);
    expect(nextPressCount("takedown", 0, "press")).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/wrestling` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/core/wrestling/grip.ts`:

```ts
// The wrestling grip ladder (C&T "Holds", "Previously Established Holds and Locks", "Breaking Free"). Pure.
import type { GripRung } from "./types";

export type GripAction = "hold" | "improve" | "holdOn" | "breakFree";
export type Side = "holder" | "held";

export interface GripInput {
  action: GripAction;
  /** the rung BEFORE the contest ("free" only for the first hold check) */
  rung: GripRung;
  /** who won the opposed roll, mapped from initiator/responder by the caller */
  winner: Side | "none";
  /** the winner's natural 20 */
  critical: boolean;
}

export interface GripOutcome {
  /** the rung after the contest; "free" ends the grapple */
  rung: GripRung;
  /** the roles trade places (the former held character is now the holder) */
  swap: boolean;
  /** the holder (after any swap) has won a lock and must choose its effect */
  lockPending: boolean;
  /** who suffers 1d2 (+ the dealer's Strength damage adjustment); null = nobody */
  damageTo: Side | null;
  /** hold-on at locked: the previous lock effect repeats */
  repeatLock: boolean;
}

const down = (rung: GripRung): GripRung => (rung === "locked" ? "held" : "free");
const outcome = (o: Partial<GripOutcome> & { rung: GripRung }): GripOutcome => ({
  swap: false, lockPending: false, damageTo: null, repeatLock: false, ...o,
});

export function gripOutcome(input: GripInput): GripOutcome {
  const { action, rung, winner, critical } = input;
  switch (action) {
    case "hold":
      return winner === "holder" ? outcome({ rung: "held", damageTo: "held" }) : outcome({ rung: "free" });
    case "improve":
      if (winner === "holder") return outcome({ rung: "locked", lockPending: true, damageTo: "held" });
      if (winner === "held") {
        return critical
          ? outcome({ rung: "locked", swap: true, lockPending: true, damageTo: "holder" })
          : outcome({ rung: down(rung), damageTo: "holder" });
      }
      return outcome({ rung });
    case "holdOn":
      if (winner === "held") return outcome({ rung: down(rung) });
      if (winner === "holder") return rung === "locked" ? outcome({ rung, repeatLock: true }) : outcome({ rung, damageTo: "held" });
      return outcome({ rung });
    case "breakFree":
      if (winner === "held") {
        return critical
          ? outcome({ rung: "locked", swap: true, lockPending: true, damageTo: "holder" })
          : outcome({ rung: down(rung), damageTo: "holder" });
      }
      if (winner === "holder" && critical) return outcome({ rung: "locked", lockPending: true });
      return outcome({ rung });
  }
}
```

`src/core/wrestling/damage.ts`:

```ts
// Wrestling damage is temporary: it lowers HP and is also tracked as nonlethal (the book's "temporary" damage).
export function temporaryDamage(
  hp: { value: number; nonlethal: number },
  amount: number,
): { value: number; nonlethal: number; unconscious: boolean } {
  const dealt = amount > 0 ? amount : 0;
  const value = hp.value - dealt;
  return { value, nonlethal: hp.nonlethal + dealt, unconscious: dealt > 0 && value <= 0 };
}
```

`src/core/wrestling/locks.ts`:

```ts
// The seven wrestling lock effects (C&T "Locks"). Values are mechanical only. Pure.
import { sizeModifier } from "./modifiers";
import type { LockEffectId } from "./types";

export interface LockSpec {
  id: LockEffectId;
  /** base damage dice; null = no damage */
  dice: string | null;
  /** +1 damage when the target lands on hard ground (throw, slam) */
  hardSurfaceBonus: boolean;
  /** the grapple ends (the target is flung free) */
  frees: boolean;
  /** the target ends up prone */
  prone: boolean;
  /** slam: the lock drops to a plain hold */
  dropsToHold: boolean;
  /** cannot be used on a target two or more size classes larger */
  sizeLimited: boolean;
  /** a save the GM adjudicates ("breath" breaks a slam hold; "death" is the hammer's knockout), shown on the card */
  save: "breath" | "death" | null;
}

export const LOCK_SPECS: Readonly<Record<LockEffectId, LockSpec>> = {
  throw: { id: "throw", dice: "1d4", hardSurfaceBonus: true, frees: true, prone: true, dropsToHold: false, sizeLimited: true, save: null },
  takedown: { id: "takedown", dice: "1d3", hardSurfaceBonus: false, frees: false, prone: true, dropsToHold: false, sizeLimited: false, save: null },
  slam: { id: "slam", dice: "1d8", hardSurfaceBonus: true, frees: false, prone: true, dropsToHold: true, sizeLimited: true, save: "breath" },
  press: { id: "press", dice: "1d6", hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: null },
  hammer: { id: "hammer", dice: "1d2", hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: "death" },
  manipulate: { id: "manipulate", dice: "1d2", hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: null },
  carry: { id: "carry", dice: null, hardSurfaceBonus: false, frees: false, prone: false, dropsToHold: false, sizeLimited: false, save: null },
};

export interface LockDamageContext {
  /** consecutive press count INCLUDING this one (first press = 1) */
  pressCount: number;
  hardSurface: boolean;
  /** the holder's Strength damage adjustment */
  strengthAdj: number;
}

/** The dice formula for one lock application, or null when the effect deals no damage. */
export function lockDamageFormula(id: LockEffectId, ctx: LockDamageContext): string | null {
  const spec = LOCK_SPECS[id];
  if (spec.dice === null) return null;
  let bonus = ctx.strengthAdj;
  if (id === "press") bonus += ctx.pressCount;
  if (spec.hardSurfaceBonus && ctx.hardSurface) bonus += 1;
  return bonus === 0 ? spec.dice : `${spec.dice}${bonus > 0 ? "+" : ""}${bonus}`;
}

/** Throw and slam fail against a target two or more size classes larger than the holder. */
export function canUseLock(id: LockEffectId, holderSize: string | null | undefined, heldSize: string | null | undefined): boolean {
  if (!LOCK_SPECS[id].sizeLimited) return true;
  return sizeModifier(holderSize, heldSize) > -8; // each size class is 4; -8 or worse = two or more classes larger
}

/** The press counter after applying `chosen`: consecutive presses climb, any other lock resets it. */
export function nextPressCount(lastLock: LockEffectId | null, pressCount: number, chosen: LockEffectId): number {
  if (chosen !== "press") return 0;
  return lastLock === "press" ? pressCount + 1 : 1;
}
```

Update `src/core/wrestling/index.ts` by appending:

```ts
export * from "./grip";
export * from "./damage";
export * from "./locks";
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/wrestling` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit -p tsconfig.core.json
git add src/core/wrestling tests/core/wrestling
git commit -m "feat(wrestling): grip ladder, lock effects and temporary damage (#93)"
```

---

### Task 3: The `wrestling` setting, the `grappling` condition, and hiding the legacy grapple

**Files:**
- Modify: `src/core/options.ts`, `src/settings/registry.ts`, `src/settings/sections.ts`, `src/types/global.d.ts`, `lang/en.json`, `src/conditions.ts`, `src/sheets/character/context.ts` (maneuver options, ~line 588), `packs/conditions/_source/_MANIFEST.md`
- Create: `packs/conditions/_source/grappling.json`
- Test (modify): `tests/core/options.test.ts`, `tests/settings/registry.test.ts`, `tests/settings/sections.test.ts` (auto: it checks every key is placed), `tests/lang/en-coverage.test.ts`, `tests/sheets/character/context.test.ts`

**Interfaces:**
- Produces: `OptionalRules.wrestling: boolean`; `getOptionalRules().wrestling`; condition id `grappling`; maneuver `grapple` omitted from `maneuverOptions` when `rules.wrestling`.

- [ ] **Step 1: Write the failing tests**

In `tests/core/options.test.ts` add `"wrestling",` to the sorted key list (next to `"weaponSpeedInitiative"` — keep the list sorted: after `"weaponSpeedInitiative"` is wrong alphabetically; place `"wrestling"` last) and `wrestling: false,` to the expected defaults object. In `tests/settings/registry.test.ts` change `registers 28 settings` to `registers 29 settings`, both `toHaveLength(28)` to `29`, and `combatAndTactics: 6,` to `combatAndTactics: 7,`. In `tests/lang/en-coverage.test.ts` add to the settings key list:

```ts
      "ADND2E.settings.wrestling.name",
      "ADND2E.settings.wrestling.hint",
```

In `tests/sheets/character/context.test.ts` add (near the other maneuver tests — search for `maneuverOptions`):

```ts
  it("the legacy grapple maneuver is hidden while the wrestling rule is on", () => {
    const on = { ...DEFAULT_OPTIONAL_RULES, combatAndTacticsEnabled: true, combatManeuvers: true, wrestling: true };
    const off = { ...on, wrestling: false };
    const values = (rules: typeof on) =>
      buildCharacterSheetContext({ ...input(), optionalRules: rules }).combat.maneuverOptions.map((m) => m.value);
    expect(values(off)).toContain("grapple");
    expect(values(on)).not.toContain("grapple");
    expect(values(on)).toContain("disarm");
  });
```

(Use the same `input()` helper and imports the surrounding tests in that file already use; add `DEFAULT_OPTIONAL_RULES` to the import list if absent.)

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:coverage` — Expected: FAIL (options/registry/lang/context assertions).

- [ ] **Step 3: Implement**

`src/core/options.ts`: add to `OptionalRules` (after `wildTalents`):

```ts
  /** SP7e: Combat & Tactics wrestling replaces the simplified grapple maneuver (requires combatAndTacticsEnabled). */
  wrestling: boolean;
```
and `wrestling: false,` to `DEFAULT_OPTIONAL_RULES`.

`src/settings/registry.ts`: after the `weaponMastery` line add:

```ts
  { key: "wrestling", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "wrestling" },
```

`src/settings/sections.ts`: the combatAndTactics `keys` array becomes `[..., "weaponMastery", "wrestling"]`.

`src/types/global.d.ts`: add `"adnd2e.wrestling": boolean;` next to `"adnd2e.weaponMastery"`.

`lang/en.json` (inside `ADND2E.settings`):

```json
      "wrestling": {
        "name": "Combat & Tactics: Wrestling",
        "hint": "Use the wrestling rules (opposed holds, locks, breaking free) instead of the simplified grapple maneuver. Requires Combat & Tactics."
      },
```

`src/conditions.ts`: update the header comment count to "Twenty-two" and add after `turned`:

```ts
  { id: "grappling", name: "Grappling", img: "icons/svg/combat.svg" },
```

`packs/conditions/_source/grappling.json` (copy `held.json`'s shape; the `_id` is a new unique 16-char alphanumeric, `_key` is `!items!<_id>`):

```json
{
  "_id": "gRaPpL1nGw7Kd3xZ",
  "_key": "!items!gRaPpL1nGw7Kd3xZ",
  "name": "Grappling",
  "type": "condition",
  "img": "icons/svg/combat.svg",
  "system": {
    "conditionId": "grappling",
    "description": ""
  }
}
```

`packs/conditions/_source/_MANIFEST.md`: change "Twenty-one" to "Twenty-two" and append the table row `| grappling | Grappling | \`icons/svg/combat.svg\` |`.

`src/sheets/character/context.ts` (~line 588), change the maneuver filter to:

```ts
  const maneuverOptions = Object.entries(MANEUVERS)
    .filter(
      ([id, m]) =>
        rules.combatAndTacticsEnabled &&
        (m.category === "calledShot" ? rules.calledShots : rules.combatManeuvers) &&
        !(id === "grapple" && rules.wrestling),
    )
    .map(([id]) => ({ value: id, label: `ADND2E.sheet.combat.maneuver.${id}` }));
```

Also `rollAttack` in `src/sheets/character/combat-rolls.ts` re-validates the maneuver server-side: in the `maneuverAllowed` expression add `&& !(maneuverId === "grapple" && rules.wrestling)`.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:coverage` — Expected: PASS at 100%. If the settings-section test fails it names the unplaced key.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit -p . ; npx eslint src tests
git add -A
git commit -m "feat(wrestling): wrestling setting, grappling condition, hide legacy grapple (#93)"
```

---

### Task 4: Grapple state reader and the `grapple` relay request

**Files:**
- Create: `src/combat/grapple-state.ts`
- Modify: `src/combat/apply-relay.ts`, `src/relay/apply-effect.ts`, `lang/en.json` (relay effect text)
- Test: `tests/combat/grapple-state.test.ts`, `tests/combat/apply-relay.test.ts`

**Interfaces:**
- Consumes: `GrappleRecord`, `parseGrappleRecord` (Task 1), `temporaryDamage` (Task 2).
- Produces:
  - `GRAPPLE_FLAG = "grapple"`; `grappleRecordOf(effects: Iterable<{ statuses: ReadonlySet<string>; getFlag(scope: string, key: string): unknown }>): GrappleRecord | null`
  - `RelayRequest` gains `{ kind: "grapple"; targetUuid: string; set: GrappleRecord | null; damage: number; prone: boolean }`
  - `applyEffectLocally` handles `"grapple"`.

- [ ] **Step 1: Write the failing tests**

`tests/combat/grapple-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { grappleRecordOf } from "../../src/combat/grapple-state";

const record = { id: "g1", role: "holder", opponentUuid: "Actor.x", opponentName: "Bugbear", rung: "held", locks: [], lastLock: null, pressCount: 0, lockPending: false };
const effect = (statuses: string[], flag: unknown) => ({
  statuses: new Set(statuses),
  getFlag: (scope: string, key: string) => (scope === "adnd2e" && key === "grapple" ? flag : undefined),
});

describe("grappleRecordOf", () => {
  it("returns the record carried by a held or grappling effect", () => {
    expect(grappleRecordOf([effect(["prone"], undefined), effect(["grappling"], record)])).toEqual(record);
  });
  it("ignores effects without a valid record, and returns null when there is none", () => {
    expect(grappleRecordOf([effect(["held"], undefined), effect(["held"], { bad: true })])).toBeNull();
    expect(grappleRecordOf([])).toBeNull();
  });
  it("ignores a record on an effect that is neither held nor grappling", () => {
    expect(grappleRecordOf([effect(["stunned"], record)])).toBeNull();
  });
});
```

In `tests/combat/apply-relay.test.ts` add (import `parseGrappleRecord` is not needed; use a literal):

```ts
describe("validateRelayRequest — grapple", () => {
  const rec = { id: "g1", role: "held", opponentUuid: "Actor.a", opponentName: "Anada", rung: "held", locks: [], lastLock: null, pressCount: 0, lockPending: false };
  it("accepts a set request with damage and prone, and a clear request", () => {
    expect(validateRelayRequest({ kind: "grapple", targetUuid: "Actor.t", set: rec, damage: 3, prone: true })).toEqual({
      kind: "grapple", targetUuid: "Actor.t", set: rec, damage: 3, prone: true,
    });
    expect(validateRelayRequest({ kind: "grapple", targetUuid: "Actor.t", set: null, damage: 0, prone: false })).toMatchObject({ set: null, damage: 0 });
  });
  it("rejects a missing or malformed set, damage or prone", () => {
    for (const bad of [
      { kind: "grapple", targetUuid: "Actor.t", damage: 0, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: { nope: 1 }, damage: 0, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: -1, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: 1000, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: 1.5, prone: false },
      { kind: "grapple", targetUuid: "Actor.t", set: null, damage: 0, prone: "yes" },
    ]) expect(validateRelayRequest(bad)).toBeNull();
  });
  it("names the effect for the GM log", () => {
    expect(relayEffectText({ kind: "grapple", targetUuid: "Actor.t", set: null, damage: 0, prone: false }).key).toBe("ADND2E.relay.effect.grapple");
  });
});
```

(Add `relayEffectText` and `validateRelayRequest` to that file's existing import from `../../src/combat/apply-relay` if missing.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/combat` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/combat/grapple-state.ts`:

```ts
// Reading a wrestling grapple off an actor's condition effects (SP7e). Pure.
import { SYSTEM_ID } from "../constants";
import { parseGrappleRecord, type GrappleRecord } from "../core/wrestling";

export const GRAPPLE_FLAG = "grapple";

interface EffectLike {
  statuses: ReadonlySet<string>;
  getFlag(scope: string, key: string): unknown;
}

/** The grapple record carried by this actor's `held` or `grappling` effect, or null when it has none. */
export function grappleRecordOf(effects: Iterable<EffectLike>): GrappleRecord | null {
  for (const e of effects) {
    if (!e.statuses.has("held") && !e.statuses.has("grappling")) continue;
    const parsed = parseGrappleRecord(e.getFlag(SYSTEM_ID, GRAPPLE_FLAG));
    if (parsed) return parsed;
  }
  return null;
}
```

`src/combat/apply-relay.ts`:
- add `import { parseGrappleRecord, type GrappleRecord } from "../core/wrestling";` at the top;
- extend the union: `| { kind: "grapple"; targetUuid: string; set: GrappleRecord | null; damage: number; prone: boolean };`
- in `validateRelayRequest`, before `default:`:

```ts
    case "grapple": {
      if (!("set" in r)) return null;
      const set = r.set === null ? null : parseGrappleRecord(r.set);
      if (r.set !== null && set === null) return null;
      if (typeof r.damage !== "number" || !Number.isInteger(r.damage) || r.damage < 0 || r.damage > MAX_AMOUNT) return null;
      if (typeof r.prone !== "boolean") return null;
      return { kind: "grapple", targetUuid, set, damage: r.damage, prone: r.prone };
    }
```
- in `relayEffectText`, before the closing brace add `case "grapple": return { key: "ADND2E.relay.effect.grapple", data: {} };`

`lang/en.json`: under `ADND2E.relay.effect` add `"grapple": "a wrestling grapple change"` (match the neighbouring keys' phrasing; open the file and look at `relay.effect.destroy`).

`src/relay/apply-effect.ts`: extend `EffectTarget` with optional members and add the case. Add near the top:

```ts
import { SYSTEM_ID } from "../constants";
import { GRAPPLE_FLAG } from "../combat/grapple-state";
import { temporaryDamage } from "../core/wrestling";
```
Extend the interface:

```ts
  effects?: Iterable<{
    id: string;
    statuses: ReadonlySet<string>;
    getFlag(scope: string, key: string): unknown;
    update(d: Record<string, unknown>): Promise<unknown>;
  }>;
  deleteEmbeddedDocuments?(name: string, ids: string[]): Promise<unknown>;
```
and `system.attributes.hp` gains `nonlethal?: number` (change the hp type to `{ value: number; max: number; temp?: number; nonlethal?: number }`). Add the case in `applyEffectLocally`:

```ts
    case "grapple": {
      if (request.damage > 0) {
        const r = temporaryDamage({ value: actor.system.attributes.hp.value, nonlethal: actor.system.attributes.hp.nonlethal ?? 0 }, request.damage);
        await actor.update({ "system.attributes.hp.value": r.value, "system.attributes.hp.nonlethal": r.nonlethal });
        if (r.unconscious) await actor.toggleStatusEffect("unconscious", { active: true });
      }
      if (request.prone) await actor.toggleStatusEffect("prone", { active: true });
      const wrestling = () => [...(actor.effects ?? [])].filter((e) => (e.statuses.has("held") || e.statuses.has("grappling")) && e.getFlag(SYSTEM_ID, GRAPPLE_FLAG) !== undefined);
      if (request.set === null) {
        const ids = wrestling().map((e) => e.id);
        if (ids.length > 0) await actor.deleteEmbeddedDocuments?.("ActiveEffect", ids);
        return true;
      }
      const conditionId = request.set.role === "holder" ? "grappling" : "held";
      // Switching roles (a critical swap) leaves the OLD role's effect behind: remove it first.
      const stale = wrestling().filter((e) => !e.statuses.has(conditionId)).map((e) => e.id);
      if (stale.length > 0) await actor.deleteEmbeddedDocuments?.("ActiveEffect", stale);
      await actor.toggleStatusEffect(conditionId, { active: true });
      const effect = [...(actor.effects ?? [])].find((e) => e.statuses.has(conditionId));
      await effect?.update({ [`flags.${SYSTEM_ID}.${GRAPPLE_FLAG}`]: request.set });
      return true;
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:coverage && npx tsc --noEmit -p . && npx tsc --noEmit -p tsconfig.core.json` — Expected: PASS at 100%. The `apply-effect.ts` branch is glue (excluded); `grapple-state.ts` and `apply-relay.ts` are covered by the new tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(wrestling): grapple state reader and GM-relay grapple request (#93)"
```

---

### Task 5: The contest card (pure view) and the contest glue

**Files:**
- Create: `src/combat/wrestling-card.ts`, `templates/chat/wrestling-contest.hbs`, `src/sheets/character/wrestling-actions.ts`
- Modify: `src/chat/chat-listeners.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`
- Test: `tests/combat/wrestling-card.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2 and 4.
- Produces:
  - `type ContestKind = "attack" | "hold" | "improve" | "holdOn" | "breakFree"` (`attack` = the first wrestling attack vs AC 10 resolved on the spot; included so the card can show it)
  - `interface WrestleSide { uuid: string; name: string; img: string; size: string; thac0: number; strHit: number; strDmg: number; ac: number }`
  - `interface WrestleContestFlag { id: string; kind: ContestKind; initiator: WrestleSide; responder: WrestleSide; initiatorRoll: number; rungBefore: GripRung; holderIsInitiator: boolean; state: "pending" | "resolved"; responderRoll?: number; summary?: ... }`
  - `buildContestView(flag: WrestleContestFlag): Record<string, unknown>` (pure)
  - glue exports: `startWrestle(actor)`, `startContest(actor, kind)`, `answerContest(messageId, asGm)`, `chooseLock(actor, lockId)`, `releaseGrapple(actor)`

- [ ] **Step 1: Write the failing test** — `tests/combat/wrestling-card.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildContestView, type WrestleContestFlag, type WrestleSide } from "../../src/combat/wrestling-card";

const side = (name: string): WrestleSide => ({ uuid: `Actor.${name}`, name, img: "", size: "medium", thac0: 17, strHit: 0, strDmg: 0, ac: 10 });
const base: WrestleContestFlag = {
  id: "c1", kind: "hold", initiator: side("Anada"), responder: side("Bugbear"),
  initiatorRoll: 10, rungBefore: "free", holderIsInitiator: true, state: "pending",
};

describe("buildContestView", () => {
  it("a pending contest asks the responder to roll", () => {
    const v = buildContestView(base);
    expect(v).toMatchObject({ pending: true, showRoll: true, titleKey: "ADND2E.chat.wrestling.kind.hold", initiatorName: "Anada", responderName: "Bugbear", initiatorRoll: 10 });
  });
  it("a resolved contest shows both rolls, the winner and the outcome line", () => {
    const v = buildContestView({
      ...base, state: "resolved", responderRoll: 18,
      result: { winner: "initiator", critical: false, initiatorTotal: 7, responderTotal: 18, rungAfter: "held", swap: false, lockPending: false, damage: { to: "Bugbear", amount: 2 }, unconscious: false },
    });
    expect(v).toMatchObject({ pending: false, showRoll: false, responderRoll: 18, winnerKey: "ADND2E.chat.wrestling.winner.initiator", rungKey: "ADND2E.chat.wrestling.rung.held", damageText: "Bugbear: 2" });
  });
  it("flags a pending lock, a swap and unconsciousness", () => {
    const v = buildContestView({
      ...base, kind: "improve", state: "resolved", responderRoll: 4,
      result: { winner: "responder", critical: true, initiatorTotal: 12, responderTotal: 5, rungAfter: "locked", swap: true, lockPending: true, damage: null, unconscious: true },
    });
    expect(v).toMatchObject({ swap: true, lockPending: true, unconscious: true, critical: true, damageText: "" });
  });
  it("a no-contest result (a missed attack) has no responder", () => {
    const v = buildContestView({ ...base, kind: "attack", state: "resolved", result: { winner: "none", critical: false, initiatorTotal: 5, responderTotal: 0, rungAfter: "free", swap: false, lockPending: false, damage: null, unconscious: false } });
    expect(v).toMatchObject({ winnerKey: "ADND2E.chat.wrestling.winner.none", showRoll: false });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/combat/wrestling-card.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement the pure card view**

`src/combat/wrestling-card.ts`:

```ts
// The wrestling contest chat card (SP7e): its flag shape and the pure template context. Foundry-free.
import type { GripRung } from "../core/wrestling";

export type ContestKind = "attack" | "hold" | "improve" | "holdOn" | "breakFree";

/** Everything a roll needs from one wrestler, captured when the contest starts so answering needs only a d20. */
export interface WrestleSide {
  uuid: string;
  name: string;
  img: string;
  size: string;
  thac0: number;
  strHit: number;
  strDmg: number;
  /** this wrestler's wrestling AC (what the OTHER side rolls against) */
  ac: number;
}

export interface ContestResult {
  winner: "initiator" | "responder" | "none";
  critical: boolean;
  initiatorTotal: number;
  responderTotal: number;
  rungAfter: GripRung;
  swap: boolean;
  lockPending: boolean;
  damage: { to: string; amount: number } | null;
  unconscious: boolean;
}

/** The data carried in `flags.adnd2e.wrestleContest` on a contest chat card. */
export interface WrestleContestFlag {
  id: string;
  kind: ContestKind;
  initiator: WrestleSide;
  responder: WrestleSide;
  initiatorRoll: number;
  rungBefore: GripRung;
  /** is the initiator the holder? (hold/improve/holdOn: yes; breakFree: no) */
  holderIsInitiator: boolean;
  state: "pending" | "resolved";
  responderRoll?: number;
  result?: ContestResult;
}

export function buildContestView(c: WrestleContestFlag): Record<string, unknown> {
  const pending = c.state === "pending";
  const r = c.result;
  return {
    titleKey: `ADND2E.chat.wrestling.kind.${c.kind}`,
    initiatorName: c.initiator.name,
    initiatorImg: c.initiator.img,
    responderName: c.responder.name,
    pending,
    showRoll: pending && c.kind !== "attack",
    initiatorRoll: c.initiatorRoll,
    responderRoll: c.responderRoll ?? null,
    hasResponderRoll: c.responderRoll !== undefined,
    winnerKey: r ? `ADND2E.chat.wrestling.winner.${r.winner}` : "",
    critical: r?.critical ?? false,
    rungKey: r ? `ADND2E.chat.wrestling.rung.${r.rungAfter}` : "",
    swap: r?.swap ?? false,
    lockPending: r?.lockPending ?? false,
    unconscious: r?.unconscious ?? false,
    damageText: r?.damage ? `${r.damage.to}: ${r.damage.amount}` : "",
  };
}
```

`templates/chat/wrestling-contest.hbs`:

```hbs
<div class="adnd2e chat-card wrestling-contest">
  <header>
    <img src="{{initiatorImg}}" alt="{{initiatorName}}">
    <h3>{{initiatorName}} - {{localize titleKey}}</h3>
  </header>
  <p class="target">{{localize 'ADND2E.chat.wrestling.against' target=responderName}}</p>
  <p class="check"><strong>{{initiatorName}}:</strong> {{initiatorRoll}}</p>
  {{#if hasResponderRoll}}<p class="check"><strong>{{responderName}}:</strong> {{responderRoll}}</p>{{/if}}
  {{#if pending}}
  <p class="hint">{{localize 'ADND2E.chat.wrestling.awaiting'}}</p>
  {{#if showRoll}}
  <button type="button" data-action="wrestleRollDefense">{{localize 'ADND2E.chat.wrestling.rollDefense'}}</button>
  <button type="button" data-action="wrestleResolveForThem">{{localize 'ADND2E.chat.wrestling.resolveForThem'}}</button>
  {{/if}}
  {{else}}
  <p class="result"><strong>{{localize winnerKey}}</strong>{{#if critical}} - {{localize 'ADND2E.chat.wrestling.critical'}}{{/if}}</p>
  <p class="rung">{{localize rungKey}}{{#if swap}} - {{localize 'ADND2E.chat.wrestling.swapped'}}{{/if}}</p>
  {{#if damageText}}<p class="damage">{{localize 'ADND2E.chat.wrestling.damage'}}: {{damageText}}</p>{{/if}}
  {{#if lockPending}}<p class="hint">{{localize 'ADND2E.chat.wrestling.lockPending'}}</p>{{/if}}
  {{#if unconscious}}<p class="hint">{{localize 'ADND2E.chat.wrestling.unconscious'}}</p>{{/if}}
  {{/if}}
</div>
```

`lang/en.json`: add a `wrestling` object under `ADND2E.chat`:

```json
      "wrestling": {
        "against": "against {target}",
        "awaiting": "Waiting for the defender to roll.",
        "rollDefense": "Roll defense",
        "resolveForThem": "Resolve for them (GM)",
        "critical": "critical!",
        "swapped": "roles reversed",
        "damage": "Temporary damage",
        "lockPending": "A lock was won: the holder chooses its effect on their sheet.",
        "unconscious": "Knocked unconscious.",
        "kind": { "attack": "Wrestling attack", "hold": "Hold check", "improve": "Improve grip", "holdOn": "Hold on", "breakFree": "Break free" },
        "winner": { "initiator": "Initiator wins", "responder": "Defender wins", "none": "No change" },
        "rung": { "free": "Free", "held": "Held", "locked": "Locked" },
        "notYourDefense": "Only the defender's owner or a GM can answer this roll.",
        "alreadyAnswered": "This contest was already answered.",
        "noTarget": "Target exactly one token to wrestle.",
        "selfTarget": "You cannot wrestle yourself.",
        "alreadyGrappling": "This character is already in a grapple.",
        "notGrappling": "This character is not in a grapple.",
        "cannotAct": "You cannot take a wrestling action right now.",
        "lockNotAllowed": "That lock cannot be used on a target this much larger.",
        "released": "{name} lets go.",
        "lock": { "throw": "Throw", "takedown": "Takedown", "slam": "Slam", "press": "Press", "hammer": "Hammer", "manipulate": "Manipulate", "carry": "Carry" },
        "lockApplied": "{name} applies a {lock} lock.",
        "lockSave": { "breath": "The target may save vs. breath weapon to break free (GM adjudicates).", "death": "Save vs. death or be knocked unconscious for 3d10 rounds (GM adjudicates)." }
      },
```

Add every new `ADND2E.chat.wrestling.*` leaf key to `tests/lang/en-coverage.test.ts` in a new `it("resolves the wrestling chat keys", ...)` that loops over the list (copy the style of the neighbouring `it` blocks there).

- [ ] **Step 4: Implement the glue** — `src/sheets/character/wrestling-actions.ts`

```ts
import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { canAct } from "../../combat/condition-effects";
import { grappleRecordOf } from "../../combat/grapple-state";
import { buildContestView, type ContestKind, type WrestleContestFlag, type WrestleSide } from "../../combat/wrestling-card";
import type { RelayRequest } from "../../combat/apply-relay";
import {
  LOCK_SPECS, bodyModifier, canUseLock, gripOutcome, lockDamageFormula, nextPressCount, resolveOpposed, sideResult, sizeModifier,
  wrestlingDefenseAc, type GrappleRecord, type LockEffectId,
} from "../../core/wrestling";
import type { EffectTarget } from "../../relay/apply-effect";
import { requestApply } from "../../relay/relay-client";
import { getOptionalRules } from "../../settings";
import { resolveTargetCombatInfo } from "./combat-rolls";

/* SP7e - wrestling (C&T ch.5). Foundry glue; the rules live in core/wrestling. Writes to either actor go through
 * requestApply (local for a GM/owner, otherwise the GM relay). Dev-world verified. */

type WrestleActor = EffectTarget & {
  uuid: string; name: string; img: string; isOwner: boolean; type: string; statuses: ReadonlySet<string>;
  system: Record<string, unknown> & { attributes: { hp: { value: number; max: number; nonlethal?: number } } };
  items: Iterable<{ type: string; system: Record<string, unknown> }>;
  effects: Iterable<{ id: string; statuses: ReadonlySet<string>; getFlag(scope: string, key: string): unknown; update(d: Record<string, unknown>): Promise<unknown> }>;
};

const warn = (key: string): void => void ui.notifications?.warn(game.i18n!.localize(key));
const d20 = async (): Promise<number> => (await new Roll("1d20").evaluate()).total ?? 1;

/** Reads one wrestler's numbers from their actor (PC/NPC and creature actors store them differently). */
export function wrestlerStats(actor: WrestleActor): WrestleSide {
  const sys = actor.system as {
    attributes?: { thac0?: { melee?: number; value?: number } };
    abilities?: { str?: { mods?: { hitProb?: number; damageAdj?: number } }; dex?: { mods?: { defensiveAdj?: number } } };
  };
  const isCreature = actor.type === "creature";
  const thac0 = isCreature ? sys.attributes?.thac0?.value ?? 20 : sys.attributes?.thac0?.melee ?? 20;
  const info = resolveTargetCombatInfo(actor as never);
  const magicBonus = isCreature
    ? 0
    : [...actor.items].filter((i) => i.type === "armor" && i.system.equipped === true).reduce((n, i) => n + Number(i.system.magicBonus ?? 0), 0);
  return {
    uuid: actor.uuid, name: actor.name, img: actor.img, size: info.size ?? "medium",
    thac0, strHit: sys.abilities?.str?.mods?.hitProb ?? 0, strDmg: sys.abilities?.str?.mods?.damageAdj ?? 0,
    ac: wrestlingDefenseAc({ dexDefensiveAdj: sys.abilities?.dex?.mods?.defensiveAdj ?? 0, magicBonus }),
  };
}

const myRecord = (actor: WrestleActor) => grappleRecordOf(actor.effects);

async function postContest(flag: WrestleContestFlag): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/wrestling-contest.hbs"), buildContestView(flag));
  const actor = foundry.utils.fromUuidSync(flag.initiator.uuid);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }), content, flags: { [SYSTEM_ID]: { wrestleContest: flag } },
  } as never);
}

/** Rolls `formula` and returns the total (0 for a null formula). */
async function rollDamage(formula: string | null): Promise<number> {
  if (formula === null) return 0;
  return Math.max(0, (await new Roll(formula).evaluate()).total ?? 0);
}

const targetOf = (): WrestleActor | null => {
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: WrestleActor | null }> } }).user.targets];
  return targets.length === 1 ? targets[0]!.actor : null;
};

/** The "Wrestle" button: a wrestling attack against AC 10-based wrestling AC. */
export async function startWrestle(actor: WrestleActor): Promise<void> {
  const rules = getOptionalRules();
  if (!rules.combatAndTacticsEnabled || !rules.wrestling) return;
  if (!canAct(actor.statuses)) return warn("ADND2E.chat.wrestling.cannotAct");
  if (myRecord(actor)) return warn("ADND2E.chat.wrestling.alreadyGrappling");
  const target = targetOf();
  if (!target) return warn("ADND2E.chat.wrestling.noTarget");
  if (target.uuid === actor.uuid) return warn("ADND2E.chat.wrestling.selfTarget");
  if (myRecord(target)) return warn("ADND2E.chat.wrestling.alreadyGrappling");

  const me = wrestlerStats(actor);
  const them = wrestlerStats(target);
  const natural = await d20();
  const attack = sideResult({ thac0: me.thac0, bonus: me.strHit, targetAc: them.ac, natural });
  const base: WrestleContestFlag = {
    id: foundry.utils.randomID(), kind: "attack", initiator: me, responder: them, initiatorRoll: natural,
    rungBefore: "free", holderIsInitiator: true, state: "resolved",
  };
  if (!attack.hit) {
    await postContest({ ...base, result: { winner: "none", critical: false, initiatorTotal: attack.total, responderTotal: 0, rungAfter: "free", swap: false, lockPending: false, damage: null, unconscious: false } });
    return;
  }
  if (attack.crit) {
    // A natural 20 holds the target outright; the attacker may try for a lock next (Improve grip).
    const amount = await rollDamage(me.strDmg ? `1d2+${me.strDmg}`.replace("+-", "-") : "1d2");
    await writeGrapple({ id: base.id, rung: "held", locks: [], lastLock: null, pressCount: 0, lockPending: false, holder: actor, held: target, damageToHeld: amount, damageToHolder: 0, prone: false });
    await postContest({ ...base, result: { winner: "initiator", critical: true, initiatorTotal: attack.total, responderTotal: 0, rungAfter: "held", swap: false, lockPending: false, damage: { to: target.name, amount }, unconscious: false } });
    return;
  }
  // A plain hit: the hold check is an opposed roll the defender answers.
  const size = sizeModifier(me.size, them.size) + bodyModifier({});
  await postContest({ ...base, kind: "hold", initiatorRoll: await d20(), state: "pending", rungBefore: "free", result: undefined, initiator: { ...me, strHit: me.strHit + size } });
}

/** Starts a follow-up contest for an existing grapple. */
export async function startContest(actor: WrestleActor, kind: Exclude<ContestKind, "attack" | "hold">): Promise<void> {
  const rules = getOptionalRules();
  if (!rules.combatAndTacticsEnabled || !rules.wrestling) return;
  const record = myRecord(actor);
  if (!record) return warn("ADND2E.chat.wrestling.notGrappling");
  if (record.lockPending && kind !== "breakFree") return;
  const opponent = foundry.utils.fromUuidSync(record.opponentUuid) as WrestleActor | null;
  if (!opponent) return warn("ADND2E.chat.wrestling.notGrappling");
  const holderIsInitiator = kind !== "breakFree";
  if (holderIsInitiator !== (record.role === "holder")) return warn("ADND2E.chat.wrestling.notGrappling");
  const me = wrestlerStats(actor);
  const them = wrestlerStats(opponent);
  const size = sizeModifier(me.size, them.size);
  await postContest({
    id: foundry.utils.randomID(), kind, initiator: { ...me, strHit: me.strHit + size }, responder: them, initiatorRoll: await d20(),
    rungBefore: record.rung, holderIsInitiator, state: "pending",
  });
}

const answering = new Set<string>();

/** The defender's Roll defense (or the GM's Resolve for them): rolls the responder's d20, resolves, writes and posts the result. */
export async function answerContest(messageId: string): Promise<void> {
  const g = game as unknown as { user: { isGM: boolean }; messages: { get(id: string): { getFlag(s: string, k: string): unknown } | undefined; contents: { getFlag(s: string, k: string): unknown }[] } };
  const flag = g.messages.get(messageId)?.getFlag(SYSTEM_ID, "wrestleContest") as WrestleContestFlag | undefined;
  if (!flag || flag.state !== "pending") return;
  const responderActor = foundry.utils.fromUuidSync(flag.responder.uuid) as WrestleActor | null;
  if (!g.user.isGM && !responderActor?.isOwner) return warn("ADND2E.chat.wrestling.notYourDefense");
  const answered = g.messages.contents.some((m) => {
    const f = m.getFlag(SYSTEM_ID, "wrestleContest") as WrestleContestFlag | undefined;
    return f?.id === flag.id && f.state === "resolved";
  });
  if (answered || answering.has(flag.id)) return warn("ADND2E.chat.wrestling.alreadyAnswered");
  answering.add(flag.id);
  try {
    const initiatorActor = foundry.utils.fromUuidSync(flag.initiator.uuid) as WrestleActor | null;
    if (!initiatorActor || !responderActor) return;
    const responderRoll = await d20();
    const opposed = resolveOpposed(
      { thac0: flag.initiator.thac0, bonus: flag.initiator.strHit, targetAc: flag.responder.ac, natural: flag.initiatorRoll },
      { thac0: flag.responder.thac0, bonus: flag.responder.strHit, targetAc: flag.initiator.ac, natural: responderRoll },
    );
    const holder = flag.holderIsInitiator ? initiatorActor : responderActor;
    const held = flag.holderIsInitiator ? responderActor : initiatorActor;
    const holderSide = flag.holderIsInitiator ? flag.initiator : flag.responder;
    const heldSide = flag.holderIsInitiator ? flag.responder : flag.initiator;
    const winnerSide = opposed.winner === "none" ? "none" : (opposed.winner === "initiator") === flag.holderIsInitiator ? "holder" : "held";
    const grip = gripOutcome({ action: flag.kind as "hold" | "improve" | "holdOn" | "breakFree", rung: flag.rungBefore, winner: winnerSide, critical: opposed.critical });
    const record = myRecord(holder) ?? myRecord(held);

    // 1d2 temporary damage from the winner's side, plus that side's Strength damage adjustment.
    const dealerStr = grip.damageTo === "held" ? holderSide.strDmg : heldSide.strDmg;
    const dealt = grip.damageTo ? await rollDamage(dealerStr ? `1d2${dealerStr > 0 ? "+" : ""}${dealerStr}` : "1d2") : 0;
    // Hold on at locked repeats the previous lock effect (with press escalation).
    let repeated = 0;
    const lastLock = grip.swap ? null : record?.lastLock ?? null;
    let pressCount = grip.swap ? 0 : record?.pressCount ?? 0;
    if (grip.repeatLock && lastLock) {
      pressCount = nextPressCount(lastLock, pressCount, lastLock);
      repeated = await rollDamage(lockDamageFormula(lastLock, { pressCount, hardSurface: false, strengthAdj: holderSide.strDmg }));
    }
    const toHeld = (grip.damageTo === "held" ? dealt : 0) + repeated;
    const toHolder = grip.damageTo === "holder" ? dealt : 0;
    const newHolder = grip.swap ? held : holder;
    const newHeld = grip.swap ? holder : held;
    await writeGrapple({
      id: record?.id ?? flag.id, rung: grip.rung === "free" ? "held" : grip.rung, locks: grip.swap ? [] : record?.locks ?? [], lastLock, pressCount,
      lockPending: grip.lockPending, holder: newHolder, held: newHeld, damageToHeld: toHeld, damageToHolder: toHolder, prone: false, end: grip.rung === "free",
    });
    const damaged = toHeld > 0 ? held : toHolder > 0 ? holder : null;
    const total = toHeld > 0 ? toHeld : toHolder;
    await postContest({
      ...flag, state: "resolved", responderRoll,
      result: {
        winner: opposed.winner, critical: opposed.critical, initiatorTotal: opposed.initiator.total, responderTotal: opposed.responder.total,
        rungAfter: grip.rung, swap: grip.swap, lockPending: grip.lockPending,
        damage: damaged ? { to: damaged.name, amount: total } : null,
        unconscious: damaged ? damaged.system.attributes.hp.value - total <= 0 : false,
      },
    });
  } finally {
    answering.delete(flag.id);
  }
}

interface WriteArgs {
  id: string; rung: "held" | "locked"; locks: LockEffectId[]; lastLock: LockEffectId | null; pressCount: number; lockPending: boolean;
  holder: WrestleActor; held: WrestleActor; damageToHeld: number; damageToHolder: number; prone: boolean; end?: boolean;
}

/** Writes (or clears) the mirrored grapple records and any temporary damage on both actors. */
async function writeGrapple(a: WriteArgs): Promise<void> {
  const mk = (role: "holder" | "held"): GrappleRecord => {
    const opp = role === "holder" ? a.held : a.holder;
    return { id: a.id, role, opponentUuid: opp.uuid, opponentName: opp.name, rung: a.rung, locks: a.locks, lastLock: a.lastLock, pressCount: a.pressCount, lockPending: role === "holder" && a.lockPending };
  };
  const req = (target: WrestleActor, role: "holder" | "held", damage: number, prone: boolean): RelayRequest => ({
    kind: "grapple", targetUuid: target.uuid, set: a.end ? null : mk(role), damage, prone,
  });
  await requestApply(a.holder as never, req(a.holder, "holder", a.damageToHolder, false));
  await requestApply(a.held as never, req(a.held, "held", a.damageToHeld, a.prone));
}

/** The holder chooses a lock effect after winning one: applies its damage/prone/frees and records it. */
export async function chooseLock(actor: WrestleActor, lockId: LockEffectId): Promise<void> {
  const record = myRecord(actor);
  if (!record || record.role !== "holder" || !record.lockPending) return warn("ADND2E.chat.wrestling.notGrappling");
  const opponent = foundry.utils.fromUuidSync(record.opponentUuid) as WrestleActor | null;
  if (!opponent) return warn("ADND2E.chat.wrestling.notGrappling");
  const me = wrestlerStats(actor);
  const them = wrestlerStats(opponent);
  if (!canUseLock(lockId, me.size, them.size)) return warn("ADND2E.chat.wrestling.lockNotAllowed");
  const spec = LOCK_SPECS[lockId];
  const pressCount = nextPressCount(record.lastLock, record.pressCount, lockId);
  const amount = await rollDamage(lockDamageFormula(lockId, { pressCount, hardSurface: false, strengthAdj: me.strDmg }));
  const locks = Array.from(new Set<LockEffectId>([...record.locks, lockId]));
  await writeGrapple({
    id: record.id, rung: spec.dropsToHold ? "held" : "locked", locks: spec.frees ? [] : locks, lastLock: lockId, pressCount, lockPending: false,
    holder: actor, held: opponent, damageToHeld: amount, damageToHolder: 0, prone: spec.prone, end: spec.frees,
  });
  const save = spec.save ? `<p>${game.i18n!.localize(`ADND2E.chat.wrestling.lockSave.${spec.save}`)}</p>` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content: `<p>${game.i18n!.format("ADND2E.chat.wrestling.lockApplied", { name: foundry.utils.escapeHTML(actor.name), lock: game.i18n!.localize(`ADND2E.chat.wrestling.lock.${lockId}`) })}${amount > 0 ? ` (${amount})` : ""}</p>${save}`,
  } as never);
}

/** The holder lets go: clears the grapple on both actors. */
export async function releaseGrapple(actor: WrestleActor): Promise<void> {
  const record = myRecord(actor);
  if (!record) return warn("ADND2E.chat.wrestling.notGrappling");
  const opponent = foundry.utils.fromUuidSync(record.opponentUuid) as WrestleActor | null;
  const clear = (t: WrestleActor): RelayRequest => ({ kind: "grapple", targetUuid: t.uuid, set: null, damage: 0, prone: false });
  await requestApply(actor as never, clear(actor));
  if (opponent) await requestApply(opponent as never, clear(opponent));
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content: `<p>${game.i18n!.format("ADND2E.chat.wrestling.released", { name: foundry.utils.escapeHTML(actor.name) })}</p>`,
  } as never);
}
```

NOTE for the implementer: this file was written without a compiler. Expect type adjustments (`as never` casts, the fvtt-types v13 mismatches) but keep the behaviour: (1) a hit that is not a natural 20 posts a **pending `hold`** card whose initiator `strHit` already includes the size modifier; (2) `answerContest` maps initiator/responder to holder/held, calls `gripOutcome`, writes both actors via `requestApply`, and posts a resolved card; (3) when `grip.swap` is true the record is rewritten with roles exchanged and the locks reset; (4) a free rung writes `end: true` (clears both records).

Wire the card buttons in `src/chat/chat-listeners.ts`: add inside `registerChatListeners` before the existing `rollDamage` wiring:

```ts
    wireWrestleContest(message as { id: string; getFlag(s: string, k: string): unknown }, html);
```
and the function (imports `answerContest` from `../sheets/character/wrestling-actions` and `WrestleContestFlag` from `../combat/wrestling-card`):

```ts
/** Wrestling contest cards (SP7e): Roll defense for the defender's owner or a GM; Resolve for them for a GM only. answerContest re-checks and is authoritative. */
function wireWrestleContest(message: { id: string; getFlag(s: string, k: string): unknown }, html: HTMLElement): void {
  const flag = message.getFlag(SYSTEM_ID, "wrestleContest") as WrestleContestFlag | undefined;
  if (!flag) return;
  const isGm = Boolean(game.user?.isGM);
  const responder = foundry.utils.fromUuidSync(flag.responder.uuid) as { isOwner?: boolean } | null;
  const roll = html.querySelector<HTMLButtonElement>('[data-action="wrestleRollDefense"]');
  const resolve = html.querySelector<HTMLButtonElement>('[data-action="wrestleResolveForThem"]');
  if (!isGm && !responder?.isOwner) roll?.remove();
  if (!isGm) resolve?.remove();
  for (const button of [roll, resolve]) {
    button?.addEventListener("click", () => {
      button.disabled = true;
      void answerContest(message.id);
    });
  }
}
```

- [ ] **Step 5: Run the gates, then commit**

Run: `npx tsc --noEmit -p . ; npx tsc --noEmit -p tsconfig.core.json ; npm run test:coverage ; npx eslint src tests`
Expected: all green (the glue is excluded from the coverage gate; `wrestling-card.ts` is covered by its test — it lives in `src/combat/**`).

```bash
git add -A
git commit -m "feat(wrestling): contest card, answer/resolve flow and lock choice (#93)"
```

---

### Task 6: PC-sheet grapple panel and actions

**Files:**
- Modify: `src/sheets/character/context.ts`, `src/sheets/character/context-types.ts`, `src/sheets/character/sheet.ts`, `templates/actor/pc/partials/pc-main-panels.hbs`, `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/templates/npc-sheet-bindings.test.ts`
- Test: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `grappleRecordOf` (Task 4), the glue exports of Task 5, `canUseLock` (Task 2).
- Produces: `CharacterSheetInput.grapple?: GrappleRecord | null`; `vitals.grapple: { role, opponentName, rungKey, locks: string[], lockPending, canImprove, canBreakFree, lockOptions: { id, labelKey }[] } | null`; sheet actions `wrestle`, `improveGrip`, `holdOn`, `breakFree`, `releaseGrapple`, `chooseLock` (with `data-lock`).

- [ ] **Step 1: Write the failing test** (add to `tests/sheets/character/context.test.ts`, using the file's `input()` helper)

```ts
  it("exposes the grapple panel for a holder and a held character, and none otherwise", () => {
    const rec = { id: "g1", role: "holder" as const, opponentUuid: "Actor.o", opponentName: "Bugbear", rung: "held" as const, locks: [], lastLock: null, pressCount: 0, lockPending: false };
    expect(buildCharacterSheetContext({ ...input() }).vitals.grapple).toBeNull();
    const holder = buildCharacterSheetContext({ ...input(), grapple: rec }).vitals.grapple!;
    expect(holder).toMatchObject({ role: "holder", opponentName: "Bugbear", rungKey: "ADND2E.chat.wrestling.rung.held", canImprove: true, canBreakFree: false, lockPending: false, lockOptions: [] });
    const pending = buildCharacterSheetContext({ ...input(), grapple: { ...rec, rung: "locked", lockPending: true } }).vitals.grapple!;
    expect(pending.canImprove).toBe(false);
    expect(pending.lockOptions.map((l) => l.id)).toEqual(["throw", "takedown", "slam", "press", "hammer", "manipulate", "carry"]);
    const held = buildCharacterSheetContext({ ...input(), grapple: { ...rec, role: "held" as const } }).vitals.grapple!;
    expect(held).toMatchObject({ role: "held", canImprove: false, canBreakFree: true });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/sheets/character/context.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`context-types.ts`: import `GrappleRecord` from `../../core/wrestling`; add to `CharacterSheetInput` (next to `prone`): `grapple?: GrappleRecord | null;`. Add to `vitals`:

```ts
    /** SP7e: null while not in a grapple. */
    grapple: {
      role: "holder" | "held";
      opponentName: string;
      rungKey: string;
      locks: string[];
      lockPending: boolean;
      canImprove: boolean;
      canBreakFree: boolean;
      lockOptions: { id: string; labelKey: string }[];
    } | null;
```

`context.ts` (in the vitals builder, next to `prone: input.prone === true`; import `LOCK_EFFECT_IDS` from `../../core/wrestling`):

```ts
    grapple: input.grapple
      ? {
          role: input.grapple.role,
          opponentName: input.grapple.opponentName,
          rungKey: `ADND2E.chat.wrestling.rung.${input.grapple.rung}`,
          locks: input.grapple.locks.map((l) => `ADND2E.chat.wrestling.lock.${l}`),
          lockPending: input.grapple.lockPending,
          canImprove: input.grapple.role === "holder" && !input.grapple.lockPending,
          canBreakFree: input.grapple.role === "held",
          lockOptions:
            input.grapple.role === "holder" && input.grapple.lockPending
              ? LOCK_EFFECT_IDS.map((id) => ({ id, labelKey: `ADND2E.chat.wrestling.lock.${id}` }))
              : [],
        }
      : null,
```

`sheet.ts`: import the glue (`startWrestle`, `startContest`, `releaseGrapple`, `chooseLock` from `./wrestling-actions`) and `grappleRecordOf`; add to the `actions` map:

```ts
      wrestle: Adnd2eCharacterSheet.#onWrestle,
      improveGrip: Adnd2eCharacterSheet.#onImproveGrip,
      holdOn: Adnd2eCharacterSheet.#onHoldOn,
      breakFree: Adnd2eCharacterSheet.#onBreakFree,
      releaseGrapple: Adnd2eCharacterSheet.#onReleaseGrapple,
      chooseLock: Adnd2eCharacterSheet.#onChooseLock,
```
handlers (next to `#onStandUp`):

```ts
  static async #onWrestle(this: Adnd2eCharacterSheet): Promise<void> {
    await startWrestle(this.document as never);
  }
  static async #onImproveGrip(this: Adnd2eCharacterSheet): Promise<void> {
    await startContest(this.document as never, "improve");
  }
  static async #onHoldOn(this: Adnd2eCharacterSheet): Promise<void> {
    await startContest(this.document as never, "holdOn");
  }
  static async #onBreakFree(this: Adnd2eCharacterSheet): Promise<void> {
    await startContest(this.document as never, "breakFree");
  }
  static async #onReleaseGrapple(this: Adnd2eCharacterSheet): Promise<void> {
    await releaseGrapple(this.document as never);
  }
  static async #onChooseLock(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const lock = target.dataset.lock;
    if (lock) await chooseLock(this.document as never, lock as never);
  }
```
and in the sheet's context input (next to `prone: actorStatuses.has("prone")`): `grapple: grappleRecordOf((this.document as unknown as { effects: Iterable<never> }).effects),`.

`templates/actor/pc/partials/pc-main-panels.hbs`: after the prone panel add:

```hbs
  {{#if adnd2e.combat.wrestling}}
    <section class="kit-panel kit-wrestle">
      <div class="kit-bar">{{localize 'ADND2E.sheet.combat.wrestleTitle'}}</div>
      <div class="kit-body">
        {{#if adnd2e.vitals.grapple}}
          <p class="detail">{{localize 'ADND2E.sheet.combat.grappleWith' name=adnd2e.vitals.grapple.opponentName}} - {{localize adnd2e.vitals.grapple.rungKey}}</p>
          {{#if @root.pcActions}}
            {{#if adnd2e.vitals.grapple.canImprove}}
              <button type="button" class="kit-roll" data-action="improveGrip">{{localize 'ADND2E.chat.wrestling.kind.improve'}}</button>
              <button type="button" class="kit-roll" data-action="holdOn">{{localize 'ADND2E.chat.wrestling.kind.holdOn'}}</button>
              <button type="button" data-action="releaseGrapple">{{localize 'ADND2E.sheet.combat.release'}}</button>
            {{/if}}
            {{#if adnd2e.vitals.grapple.canBreakFree}}<button type="button" class="kit-roll" data-action="breakFree">{{localize 'ADND2E.chat.wrestling.kind.breakFree'}}</button>{{/if}}
            {{#each adnd2e.vitals.grapple.lockOptions as |l|}}<button type="button" class="kit-roll" data-action="chooseLock" data-lock="{{l.id}}">{{localize l.labelKey}}</button>{{/each}}
          {{/if}}
        {{else}}
          {{#if @root.pcActions}}<button type="button" class="kit-roll" data-action="wrestle">{{localize 'ADND2E.sheet.combat.wrestle'}}</button>{{/if}}
        {{/if}}
      </div>
    </section>
  {{/if}}
```

`adnd2e.combat.wrestling` must be a boolean on the combat block: in `context-types.ts` add `wrestling: boolean;` to the `combat` return type and in `context.ts` `buildCombat` return `{ weapons, acBreakdown, armor, maneuverOptions, wrestling: rules.combatAndTacticsEnabled && rules.wrestling }`. Add a test line asserting it is false by default and true when both rules are on.

`lang/en.json` (`ADND2E.sheet.combat`): `"wrestleTitle": "Wrestling"`, `"wrestle": "Wrestle"`, `"grappleWith": "In a grapple with {name}"`, `"release": "Release"`. Add these four keys to `tests/lang/en-coverage.test.ts`.

`tests/templates/npc-sheet-bindings.test.ts`: add to `PC_ONLY_ACTIONS` the strings `"wrestle", "improveGrip", "holdOn", "breakFree", "releaseGrapple", "chooseLock"` with a comment `// SP7e: the wrestling panel is PC-only (gated behind @root.pcActions)`.

- [ ] **Step 4: Run to verify pass**

Run: `npx tsc --noEmit -p . ; npx tsc --noEmit -p tsconfig.core.json ; npm run test:coverage ; npx eslint src tests`
Expected: PASS at 100%.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(wrestling): PC-sheet grapple panel and actions (#93)"
```

---

### Task 7: Docs, full gate, PR and dev-world checklist

**Files:**
- Modify: `README.md` (the Combat & Tactics row of the sub-project table: note wrestling), `docs/importing-content.md` only if it lists conditions (grep first)
- No new tests.

- [ ] **Step 1: Update the README**

Find the Sub-project 7 row (`grep -n "Combat & Tactics" README.md`) and append a sentence: "Wrestling (opposed holds, lock effects, breaking free; temporary damage) is implemented behind the Wrestling setting; overbearing/pins, brawling, pummeling, martial arts and subdual are tracked in #93." Run `grep -rn "twenty-one\|21 conditions\|21 status" README.md docs src tests` and update any stale "21 conditions" counts to 22.

- [ ] **Step 2: Run the full CI sequence**

Run:
```bash
npx tsc --noEmit -p . ; npx tsc --noEmit -p tsconfig.core.json ; npm run test:coverage ; npx eslint src tests
```
Expected: all green, statements 100%.

- [ ] **Step 3: Rebuild the install (Foundry must be closed), push and open the PR**

```bash
npm run build
git add -A
git commit -m "docs: wrestling in the README (#93)"
git push -u origin HEAD
gh pr create --title "feat: wrestling (C&T ch.5) (#93, step 1)" --body "<summary of the spec + the dev-world checklist below + 'Part of #93 (step 1 of 4); #93 stays open'>"
```

- [ ] **Step 4: Hand the user this dev-world checklist (include a non-GM seat; checklists must state prerequisites)**

Prerequisites: Combat & Tactics ON, Wrestling ON, a combat running with two PCs (A, B) and a Monster NPC (M); A has the Wrestle button on the main tab. Reset these settings afterwards.
1. A targets M and clicks **Wrestle**: a "Wrestling attack" card; a miss ends it; a plain hit posts a pending **Hold check** with Roll defense / Resolve for them (GM only sees the second).
2. GM clicks **Resolve for them**: one resolved card; on a win both A (Grappling) and M (Held) show conditions, M takes temporary damage (HP down, nonlethal up), and A's sheet shows the grapple panel with Improve grip / Hold on / Release.
3. A clicks **Improve grip**: pending card, GM resolves; on a win the rung becomes Locked and the seven lock buttons appear; click **Press**: damage, pressed again via **Hold on** escalates by +1.
4. M (as the held side, GM) cannot use the PC-only button; verify **Break free** on a PC defender (B) holding-wise: B grapples A, A clicks **Break free**; on a win the rung falls; on a critical roles swap.
5. Choose **Throw** (target medium or small): grapple ends, target prone. Choose **Slam** on a target two classes larger: refused with a toast.
6. Reduce a target to 0 HP with wrestling damage: **Unconscious** condition appears, no death.
7. Player seat: a player (non-GM) owning A runs steps 1-3 and answers a contest as the defender owning B.
8. Wrestling OFF: the legacy Grapple maneuver returns in the attack dialog and no Wrestle panel shows.

---

## Self-Review

- **Spec coverage:** attack roll vs AC 10 + critical auto-hold (T5 `startWrestle`), opposed hold check with size/Str/body modifiers and the lower-wins rule (T1), grip ladder with improve/hold-on/break-free and critical swap (T2), the seven locks with dice, size limits, hard-ground bonus and press escalation (T2/T5), temporary damage + unconscious (T2/T4), conditions on both actors with a stored record (T3/T4/T5), each-side-rolls-their-own with Resolve-for-them and the GM relay (T4/T5), PC-sheet panel (T6), setting that hides the legacy grapple (T3), tests and dev-world checklist (all/T7).
- **Deliberate deviations from the spec to tell the user:** (1) the slam's break-free save and the hammer's knockout save are printed on the card for the GM to adjudicate rather than auto-rolled; (2) *carry* has no weight check (GM-adjudicated); (3) the *immune/supple* body modifiers exist in the pure engine but the glue passes none (no actor data models them yet); (4) no headless-proof test is added because the grapple record lives in plain `flags` (no schema), so there is no new data-model surface to validate; (5) monster/NPC wrestlers cannot start a wrestle from their own sheet (PC-only button), though they can be targeted, answer contests, and be cleared via the Token HUD.
- **Type consistency:** `GrappleRecord` fields (`id, role, opponentUuid, opponentName, rung, locks, lastLock, pressCount, lockPending`) are identical in `types.ts`, `parseGrappleRecord`, the relay validator, `writeGrapple` and the context test; `GripOutcome` fields (`rung, swap, lockPending, damageTo, repeatLock`) match between `grip.ts`, its tests and `answerContest`; `WrestleContestFlag.result` shape matches `ContestResult` and `buildContestView`.
