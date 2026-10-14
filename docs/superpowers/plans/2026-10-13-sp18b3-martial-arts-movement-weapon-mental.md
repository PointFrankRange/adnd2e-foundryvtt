# SP18 Plan B3 — Martial Arts Maneuvers: Movement, Weapon, Mental/Physical Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The remaining 16 Table 19 maneuvers (Movement 6, Weapon 2, Mental/Physical 7 incl. an inert Ch'i placeholder) are learnable; Feint, Weapon Breaker, Leap, Speed and Levitation can be used from the Martial Arts panel; Ironskin changes derived AC and Blind Fighting softens the blinded/invisible penalties in martial arts rolls; the constant abilities appear in an "Always in effect" summary.

**Architecture:** The pure registry gains 16 rows and kinds `skill`/`utility` plus `basic`/`attackBonus` fields. A new pure `skills.ts` holds the Leap/Speed/Levitation resolvers and the constant-ability helpers (`ironskinAcMod`, `blindFightingPenalty`, `knownManeuverIds`). The card builders gain a skill card and Feint's Table 16 result. Ironskin flows snapshot -> `deriveAc` exactly like the style AC modifier. Glue extends `useManeuver` and the panel.

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-13-adnd2e-sp18b3-martial-arts-movement-weapon-mental-design.md`

## Global Constraints

- Source: PHBR15 ch.4 pp.53-59, Table 19. **Content policy:** mechanical values only, short own-wording labels and text, no rulebook prose.
- Registry rows (id, slug, kind, cost, Table 21 light/mail/plate, notes): movement:1 feint attack `basic` `attackBonus` +3 cost 2 (0/0/0); movement:2 proneFighting passive 0; movement:3 immovability passive 0; movement:4 leap skill 1; movement:5 speed skill 0; movement:6 slowResistance passive 0; weapon:1 weaponBreaker attack 1 `noDamage` (0/0/0); weapon:2 steelCloth passive 0 (-1/-3/-5); mental:1 meditation passive; mental:2 allAroundSight passive; mental:3 mentalResistance passive; mental:4 chiAttacks passive (inert placeholder); mental:5 blindFighting passive; mental:6 ironskin passive; mental:7 levitation utility cost "round". Every row not listed with a Table 21 triple is 0/0/0.
- List order: block, kick, strike, lock, push, throw, vitalArea, movement, weapon, mental. Ids `<list>:<difficulty>` match the shipped styles' `availableManeuvers` (`mental:6` = Ironskin).
- Resolvers: Leap = `hitResult` vs AC 10 with the conditions modifier; standing `{up: 4 + level, forward: 3 + level}`, running `{up: 8 + level, forward: 10 + level}` (level 10: 14/13 and 18/20); failure = Prone offered via an effect button. Speed: success iff `roll <= dexterity` (the compare only); `Math.round` rounds a .5 up (Dex 13, roll 11: 2/4 = 0.5 -> 1); `extraAttacks = success ? Math.round((dex - roll) / 4) : 0`; `restTurns = extraAttacks` (book example: Dex 13, roll 4 -> 2). Levitation: `{ rounds: level, feetPerRound: 5 }`. Feint: bonus +3 on top of the attack modifiers, blow from `martialArtsResult(naturalD20)`, damage `max(0, tableDamage + strengthAdj)` (formula string of that number).
- Constants: known = a `knownManeuvers` entry on ANY owned style. `ironskinAcMod(known, wearingBodyArmor) = known && !wearingBodyArmor ? -2 : 0` (a shield is not body armor). `blindFightingPenalty(p) = Math.max(p, -1)`; applied only to the actor's blinded penalty and the invisible-target penalty inside the martial arts attack and maneuver paths. Derived AC adds Ironskin to the style modifier only while `advancedMartialArts` is on. The AC breakdown gains an "Ironskin" row when non-zero.
- Summary list order: All-Around Sight (mental:2), Mental Resistance (mental:3), Blind Fighting (mental:5), Ironskin (mental:6), each shown only when known on any owned style.
- Existing B1/B2 behaviour is unchanged. `resolveManeuverAttack` rejects every kind except `attack` and `parry`. Existing tests that count registry rows or list the shipped styles' maneuver rows (the "mental is not in B1" view test, the 25-row registry asserts) MUST be updated, not weakened.
- The panel is PC-only; no schema change, no new setting. Labels must not end in an ellipsis; reuse existing CSS classes only.
- Foundry may be running: the default `npx vite build` then fails with EPERM on dist/packs. Check builds with `npx vite build --outDir "C:\Users\Apera\AppData\Local\Temp\claude\c--Users-Apera-OneDrive-Dev-foundry\4f2b5a89-bbac-4b6c-bf25-1896969d1275\scratchpad\dist-check" --emptyOutDir`; never `npm run build` unless Foundry is closed.
- Before opening a PR: `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100% statements), a build check. Use plain ASCII in code comments (an invalid UTF-8 byte breaks only the build). Files may be CRLF: prefer the Edit tool. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/sp18b3-martial-arts-movement-weapon-mental` (holds the spec).

---

### Task 1: Registry — 16 rows, new kinds and lists

**Files:**
- Modify: `src/core/martial-arts/maneuvers.ts`
- Modify: `src/core/martial-arts/view.ts` (`ManeuverRow.kind` union)
- Modify: `tests/core/martial-arts/maneuvers.test.ts`, `tests/core/martial-arts/maneuver-view.test.ts`

**Interfaces — produces:**
```ts
export const MANEUVER_LISTS: readonly ["block","kick","strike","lock","push","throw","vitalArea","movement","weapon","mental"];
// ManeuverDef.kind: "parry" | "attack" | "passive" | "skill" | "utility"
// ManeuverDef gains: basic?: boolean; attackBonus?: number
// ManeuverRow.kind: same union as ManeuverDef.kind
```

- [ ] **Step 1: Write the failing tests**

In `tests/core/martial-arts/maneuvers.test.ts`: update B1/B2's registry-list assertions to the 41 ids (the 25 existing, then `movement:1..6`, `weapon:1..2`, `mental:1..7`) and the ten `MANEUVER_LISTS`; update the slug/kind/cost table to the full 41 rows (new rows below). Then append:
```ts
describe("B3 registry rows", () => {
  it.each([
    ["movement:1", "feint", "attack", 2, 0, 0, 0],
    ["movement:2", "proneFighting", "passive", 0, 0, 0, 0],
    ["movement:3", "immovability", "passive", 0, 0, 0, 0],
    ["movement:4", "leap", "skill", 1, 0, 0, 0],
    ["movement:5", "speed", "skill", 0, 0, 0, 0],
    ["movement:6", "slowResistance", "passive", 0, 0, 0, 0],
    ["weapon:1", "weaponBreaker", "attack", 1, 0, 0, 0],
    ["weapon:2", "steelCloth", "passive", 0, -1, -3, -5],
    ["mental:1", "meditation", "passive", 0, 0, 0, 0],
    ["mental:2", "allAroundSight", "passive", 0, 0, 0, 0],
    ["mental:3", "mentalResistance", "passive", 0, 0, 0, 0],
    ["mental:4", "chiAttacks", "passive", 0, 0, 0, 0],
    ["mental:5", "blindFighting", "passive", 0, 0, 0, 0],
    ["mental:6", "ironskin", "passive", 0, 0, 0, 0],
    ["mental:7", "levitation", "utility", "round", 0, 0, 0],
  ])("%s %s", (id, slug, kind, cost, light, mail, plate) => {
    const m = maneuverById(id)!;
    expect([m.slug, m.kind, m.cost]).toEqual([slug, kind, cost]);
    expect(m.table21).toEqual({ light, mail, plate });
  });

  it("Feint is a basic attack with +3; Weapon Breaker does no damage", () => {
    expect(maneuverById("movement:1")).toMatchObject({ basic: true, attackBonus: 3 });
    expect(maneuverById("weapon:1")!.noDamage).toBe(true);
    for (const m of MANEUVERS.filter((x) => x.id !== "movement:1")) expect(m.basic ?? false, m.id).toBe(false);
  });
  it("skill, utility and passive rows have no damage formula", () => {
    const ctx = { styleDie: "1d4", level: 5, strengthAdj: 2 };
    for (const id of ["movement:4", "movement:5", "mental:7", "weapon:1", "mental:6"]) {
      expect(maneuverDamageFormula(maneuverById(id)!, ctx), id).toBeNull();
    }
  });
  it("learning order skips nothing: Ironskin needs Ch'i and Blind Fighting first when the style offers them", () => {
    const offered = [{ list: "mental", difficulties: [1, 4, 5, 6] }];
    const base = { offered, freeSlots: 1, level: 3 };
    expect(learnability({ ...base, known: [], maneuverId: "mental:6" })).toEqual({ ok: false, reason: "order" });
    const known = [{ id: "mental:1", level: 1 }, { id: "mental:4", level: 1 }, { id: "mental:5", level: 1 }];
    expect(learnability({ ...base, known, maneuverId: "mental:6", level: 2 })).toEqual({ ok: true });
  });
});
```
(Add `MANEUVERS` if the file's import lacks it.) In `tests/core/martial-arts/maneuver-view.test.ts` update B1's "lists only registry maneuvers the style offers" test: its Karate item offers `mental [1, 4]`, which are now registry rows — expect the keys `["block:1","block:2","kick:1","mental:1","mental:4","strike:1","strike:2","strike:3"]` and make the `mental` rows the new ones; the rest of that test is unchanged. Adjust any other assertion that counted rows.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/maneuvers.ts`:
- `MANEUVER_LISTS = [..., "vitalArea", "movement", "weapon", "mental"] as const`.
- `ManeuverDef.kind` becomes `"parry" | "attack" | "passive" | "skill" | "utility"`; add
```ts
  /** the maneuver resolves as the plain Table 16 attack (Feint) */
  basic?: boolean;
  /** a flat bonus to the attack roll (Feint +3) */
  attackBonus?: number;
```
- Append the 16 rows (all `extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false` unless noted; `NONE` for the 0/0/0 Table 21):
```ts
  { id: "movement:1", slug: "feint", list: "movement", difficulty: 1, kind: "attack", cost: 2, extraDie: null, ownDie: null, addsStrength: true, halfLevelBonus: false, table21: NONE, basic: true, attackBonus: 3 },
  { id: "movement:2", slug: "proneFighting", list: "movement", difficulty: 2, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "movement:3", slug: "immovability", list: "movement", difficulty: 3, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "movement:4", slug: "leap", list: "movement", difficulty: 4, kind: "skill", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "movement:5", slug: "speed", list: "movement", difficulty: 5, kind: "skill", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "movement:6", slug: "slowResistance", list: "movement", difficulty: 6, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "weapon:1", slug: "weaponBreaker", list: "weapon", difficulty: 1, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true, effects: [] },
  { id: "weapon:2", slug: "steelCloth", list: "weapon", difficulty: 2, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: { light: -1, mail: -3, plate: -5 }, noDamage: true },
  { id: "mental:1", slug: "meditation", list: "mental", difficulty: 1, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "mental:2", slug: "allAroundSight", list: "mental", difficulty: 2, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "mental:3", slug: "mentalResistance", list: "mental", difficulty: 3, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "mental:4", slug: "chiAttacks", list: "mental", difficulty: 4, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "mental:5", slug: "blindFighting", list: "mental", difficulty: 5, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "mental:6", slug: "ironskin", list: "mental", difficulty: 6, kind: "passive", cost: 0, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
  { id: "mental:7", slug: "levitation", list: "mental", difficulty: 7, kind: "utility", cost: "round", extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE, noDamage: true },
```
`maneuverDamageFormula` already returns null for any kind other than `"attack"` or a `noDamage` row, so no change is needed there (Feint is `basic`; its damage is computed in Task 2).
`src/core/martial-arts/view.ts`: change `ManeuverRow.kind` to `ManeuverDef["kind"]` (import `type ManeuverDef` from `./maneuvers`).

- [ ] **Step 4: Run to verify they pass, then typecheck and build check**

Run: `npx vitest run tests/core/martial-arts tests/core/index.test.ts && npm run typecheck` then the scratch build.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/martial-arts tests/core/martial-arts
git commit -m "feat(martial-arts): Movement, Weapon and Mental/Physical Training maneuvers in the registry (SP18 Plan B3)"
```

---

### Task 2: Pure resolvers, Feint, skill cards and the view's constants

**Files:**
- Create: `src/core/martial-arts/skills.ts`
- Modify: `src/core/martial-arts/maneuver-attack.ts` (basic attacks, kind guard, `maneuverBonus`, `blow`)
- Modify: `src/core/martial-arts/card.ts` (Feint fields, `buildSkillCardContext`)
- Modify: `src/core/martial-arts/view.ts` (`constants`, `wearingBodyArmor`)
- Modify: `src/core/martial-arts/index.ts` (`export * from "./skills";`)
- Create: `tests/core/martial-arts/skills.test.ts`
- Modify: `tests/core/martial-arts/maneuver-attack.test.ts`, `card.test.ts`, `maneuver-view.test.ts` (append)

**Interfaces — produces:**
```ts
// skills.ts
export interface LeapResult { hit: boolean; naturalD20: number; needed: number; total: number; standing: { up: number; forward: number }; running: { up: number; forward: number } }
export function resolveLeap(input: { naturalD20: number; thac0: number; situationalModifier: number; level: number }): LeapResult;
export interface SpeedResult { success: boolean; naturalD20: number; dexterity: number; extraAttacks: number; restTurns: number }
export function resolveSpeed(input: { naturalD20: number; dexterity: number }): SpeedResult;
export function levitationInfo(level: number): { rounds: number; feetPerRound: 5 };
export function ironskinAcMod(known: boolean, wearingBodyArmor: boolean): number;
export function blindFightingPenalty(penalty: number): number;
export function knownManeuverIds(styles: readonly { knownManeuvers?: readonly { id: string }[] }[]): Set<string>;
// maneuver-attack.ts: ManeuverAttackResult gains maneuverBonus: number; blow: BlowId | null
// card.ts
export interface CardLine { key: string; n1?: number; n2?: number }
export interface SkillCardContext extends ManeuverCardContext { lines: CardLine[]; noRoll: boolean }
export type SkillCardInput = { actorName: string; actorImg: string; styleName: string; maneuverId: string } & (
  | { skill: "leap"; result: LeapResult }
  | { skill: "speed"; result: SpeedResult }
  | { skill: "levitation"; level: number }
);
export function buildSkillCardContext(input: SkillCardInput): SkillCardContext;
// view.ts
export interface MartialConstants {
  allAroundSight: boolean; mentalResistance: boolean; blindFighting: boolean; ironskin: boolean; ironskinAcMod: number;
  summary: { nameKey: string; effectKey: string }[];
}
// MartialArtsView gains: constants: MartialConstants ; buildMartialArtsView input gains optional wearingBodyArmor?: boolean
```

- [ ] **Step 1: Write the failing tests**

`tests/core/martial-arts/skills.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  blindFightingPenalty, ironskinAcMod, knownManeuverIds, levitationInfo, resolveLeap, resolveSpeed,
} from "../../../src/core/martial-arts";

describe("resolveLeap", () => {
  it("level 10: standing 14 up / 13 forward, running 18 / 20 (the book's 10th-level example)", () => {
    const r = resolveLeap({ naturalD20: 12, thac0: 11, situationalModifier: 0, level: 10 });
    expect(r.standing).toEqual({ up: 14, forward: 13 });
    expect(r.running).toEqual({ up: 18, forward: 20 });
  });
  it("is a THAC0 attack roll against AC 10", () => {
    // needed = 20 - 10 = 10
    expect(resolveLeap({ naturalD20: 10, thac0: 20, situationalModifier: 0, level: 1 })).toMatchObject({ needed: 10, total: 10, hit: true });
    expect(resolveLeap({ naturalD20: 9, thac0: 20, situationalModifier: 0, level: 1 }).hit).toBe(false);
    expect(resolveLeap({ naturalD20: 9, thac0: 20, situationalModifier: 1, level: 1 }).hit).toBe(true);
  });
  it("a natural 20 lands and a natural 1 does not", () => {
    expect(resolveLeap({ naturalD20: 20, thac0: 25, situationalModifier: -5, level: 1 }).hit).toBe(true);
    expect(resolveLeap({ naturalD20: 1, thac0: 5, situationalModifier: 5, level: 1 }).hit).toBe(false);
  });
});

describe("resolveSpeed", () => {
  it("the book's example: Dex 13, roll 4 -> 9 under, 2 extra attacks (2.25 rounds to 2)", () => {
    expect(resolveSpeed({ naturalD20: 4, dexterity: 13 })).toEqual({ success: true, naturalD20: 4, dexterity: 13, extraAttacks: 2, restTurns: 2 });
  });
  it.each([
    [13, 13, 0, true], [13, 12, 0, true], [13, 11, 1, true], [13, 10, 1, true], [13, 9, 1, true], [13, 8, 1, true], [13, 7, 2, true],
  ])("Dex %i roll %i -> %i extra", (dexterity, naturalD20, extra, success) => {
    expect(resolveSpeed({ naturalD20, dexterity })).toMatchObject({ success, extraAttacks: extra });
  });
  it("a roll over Dexterity fails with no extra attacks", () => {
    expect(resolveSpeed({ naturalD20: 14, dexterity: 13 })).toMatchObject({ success: false, extraAttacks: 0, restTurns: 0 });
  });
});

describe("levitationInfo", () => {
  it("lasts level rounds at 5 ft per round", () => {
    expect(levitationInfo(7)).toEqual({ rounds: 7, feetPerRound: 5 });
  });
});

describe("constant abilities", () => {
  it("Ironskin is -2 only when known and wearing no body armor", () => {
    expect(ironskinAcMod(true, false)).toBe(-2);
    expect(ironskinAcMod(true, true)).toBe(0);
    expect(ironskinAcMod(false, false)).toBe(0);
  });
  it("Blind Fighting caps a penalty at -1 and leaves smaller ones alone", () => {
    expect(blindFightingPenalty(-4)).toBe(-1);
    expect(blindFightingPenalty(-1)).toBe(-1);
    expect(blindFightingPenalty(0)).toBe(0);
  });
  it("knownManeuverIds unions the known ids across every style", () => {
    const ids = knownManeuverIds([{ knownManeuvers: [{ id: "mental:6" }] }, { knownManeuvers: [{ id: "kick:1" }, { id: "mental:6" }] }, {}]);
    expect([...ids].sort()).toEqual(["kick:1", "mental:6"]);
  });
});
```
Append to `tests/core/martial-arts/maneuver-attack.test.ts`:
```ts
describe("B3 attacks", () => {
  const input = {
    maneuverId: "movement:1", naturalD20: 14, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "none" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("Feint adds +3, takes the Table 16 blow and damage plus Strength", () => {
    const r = resolveManeuverAttack(input);
    expect(r.maneuverBonus).toBe(3);
    expect(r.attackBonus).toBe(3);
    expect(r.total).toBe(17);
    expect(r.blow).toBe("vitalsPunch");
    expect(r.damageFormula).toBe("3");
  });
  it("Feint's +3 can turn a miss into a hit; a miss has no blow or damage", () => {
    expect(resolveManeuverAttack({ ...input, naturalD20: 7, targetAc: 10 }).hit).toBe(true);
    const miss = resolveManeuverAttack({ ...input, naturalD20: 2, targetAc: 5 });
    expect(miss.hit).toBe(false);
    expect(miss.blow).toBeNull();
    expect(miss.damageFormula).toBeNull();
  });
  it("other maneuvers carry no maneuver bonus and no blow", () => {
    const r = resolveManeuverAttack({ ...input, maneuverId: "kick:1" });
    expect(r.maneuverBonus).toBe(0);
    expect(r.blow).toBeNull();
  });
  it("Weapon Breaker hits for no damage", () => {
    const r = resolveManeuverAttack({ ...input, maneuverId: "weapon:1", naturalD20: 15 });
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBeNull();
  });
  it.each(["movement:4", "movement:5", "mental:7", "mental:6"])("rejects %s (not an attack or parry)", (maneuverId) => {
    expect(() => resolveManeuverAttack({ ...input, maneuverId })).toThrow(RangeError);
  });
});
```
Append to `tests/core/martial-arts/card.test.ts` (imports: add `buildSkillCardContext`, `resolveLeap`, `resolveSpeed`):
```ts
describe("Feint and skill cards (SP18 B3)", () => {
  const feint = {
    maneuverId: "movement:1", naturalD20: 14, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "none" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("a Feint card shows the blow, a +3 maneuver row and costs 2 attacks, with no separate formula", () => {
    const ctx = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null, result: resolveManeuverAttack(feint), damageTotal: 3,
    });
    expect(ctx.blowKey).toBe("ADND2E.martialBlows.vitalsPunch");
    expect(ctx.costKey).toBe("ADND2E.martialManeuverCosts.two");
    expect(ctx.breakdown).toEqual([{ labelKey: "ADND2E.chat.martialArts.mod.maneuver", amount: 3 }]);
    expect(ctx.formula).toBe("");
    expect(ctx.damage).toBe(3);
  });
  it("a Leap card prints both distances and offers Prone on a failed landing", () => {
    const landed = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:4", skill: "leap",
      result: resolveLeap({ naturalD20: 15, thac0: 20, situationalModifier: 0, level: 10 }),
    });
    expect(landed.noRoll).toBe(false);
    expect(landed.hit).toBe(true);
    expect(landed.resultKey).toBe("ADND2E.chat.martialArts.landed");
    expect(landed.lines).toEqual([
      { key: "ADND2E.chat.martialArts.leapStanding", n1: 14, n2: 13 },
      { key: "ADND2E.chat.martialArts.leapRunning", n1: 18, n2: 20 },
    ]);
    expect(landed.effects).toEqual([]);
    const fell = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:4", skill: "leap",
      result: resolveLeap({ naturalD20: 3, thac0: 20, situationalModifier: 0, level: 10 }),
    });
    expect(fell.resultKey).toBe("ADND2E.chat.martialArts.fell");
    expect(fell.effects).toEqual([{
      id: "prone", labelKey: "ADND2E.martialEffects.prone", saveKey: "", saveMod: "", condition: "prone", rounds: null, damage: null, deferred: false,
    }]);
  });
  it("a Speed card reports the extra attacks, or none on a failure", () => {
    const ok = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:5", skill: "speed", result: resolveSpeed({ naturalD20: 4, dexterity: 13 }),
    });
    expect(ok.resultKey).toBe("ADND2E.chat.martialArts.speedYes");
    expect(ok.lines).toEqual([
      { key: "ADND2E.chat.martialArts.speedExtra", n1: 2 },
      { key: "ADND2E.chat.martialArts.speedOnce" },
    ]);
    const no = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:5", skill: "speed", result: resolveSpeed({ naturalD20: 18, dexterity: 13 }),
    });
    expect(no.resultKey).toBe("ADND2E.chat.martialArts.speedNo");
    expect(no.lines).toEqual([{ key: "ADND2E.chat.martialArts.speedOnce" }]);
  });
  it("a Levitation card has no roll and states rate, duration and rules", () => {
    const ctx = buildSkillCardContext({ actorName: "A", actorImg: "", styleName: "S", maneuverId: "mental:7", skill: "levitation", level: 7 });
    expect(ctx.noRoll).toBe(true);
    expect(ctx.lines).toEqual([
      { key: "ADND2E.chat.martialArts.levitationRate", n1: 5 },
      { key: "ADND2E.chat.martialArts.levitationDuration", n1: 7 },
      { key: "ADND2E.chat.martialArts.levitationRules" },
    ]);
    expect(ctx.costKey).toBe("ADND2E.martialManeuverCosts.round");
  });
});
```
Append to `tests/core/martial-arts/maneuver-view.test.ts`:
```ts
describe("constants (SP18 B3)", () => {
  const style = (known: string[], id = "s1"): StyleItemLike => ({
    id, name: id, img: "", type: "martialStyle",
    system: {
      form: "soft", principalMethod: "throw", slotsInvested: 1,
      availableManeuvers: [{ list: "mental", difficulties: [1, 2, 3, 4, 5, 6, 7] }],
      knownManeuvers: known.map((k) => ({ id: k, level: 1 })),
    },
  });
  const view = (items: StyleItemLike[], wearingBodyArmor = false) =>
    buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 5, freeSlots: 2, wearingBodyArmor, items });

  it("collects constants across ALL owned styles, not only the active one", () => {
    const v = view([style(["mental:2"], "a"), style(["mental:5", "mental:6"], "b")]);
    expect(v.constants).toMatchObject({ allAroundSight: true, mentalResistance: false, blindFighting: true, ironskin: true });
    expect(v.constants.summary.map((s) => s.nameKey)).toEqual([
      "ADND2E.martialManeuvers.allAroundSight", "ADND2E.martialManeuvers.blindFighting", "ADND2E.martialManeuvers.ironskin",
    ]);
    expect(v.constants.summary[2]).toEqual({ nameKey: "ADND2E.martialManeuvers.ironskin", effectKey: "ADND2E.martialManeuverEffects.ironskin" });
  });
  it("Ironskin's AC modifier is -2 only without body armor", () => {
    expect(view([style(["mental:6"])], false).constants.ironskinAcMod).toBe(-2);
    expect(view([style(["mental:6"])], true).constants.ironskinAcMod).toBe(0);
    expect(view([style([])]).constants.ironskinAcMod).toBe(0);
  });
  it("no styles means no constants", () => {
    expect(view([]).constants).toMatchObject({ ironskin: false, ironskinAcMod: 0, summary: [] });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/skills.ts`:
```ts
// PHBR15 Movement/Mental skills and the constant abilities that change numbers. Pure.
import { hitResult } from "../combat/attack";

export interface LeapResult {
  hit: boolean;
  naturalD20: number;
  needed: number;
  total: number;
  /** from a standing start (costs one attack) */
  standing: { up: number; forward: number };
  /** from a running start (needs a 10 ft run-up) */
  running: { up: number; forward: number };
}

/** The leap: a normal attack roll against AC 10 to land safely; distances grow 1 foot per level. */
export function resolveLeap(input: { naturalD20: number; thac0: number; situationalModifier: number; level: number }): LeapResult {
  const base = hitResult({
    naturalD20: input.naturalD20, attackBonus: input.situationalModifier, thac0: input.thac0, targetAc: 10,
  });
  return {
    hit: base.hit,
    naturalD20: input.naturalD20,
    needed: base.needed,
    total: base.total,
    standing: { up: 4 + input.level, forward: 3 + input.level },
    running: { up: 8 + input.level, forward: 10 + input.level },
  };
}

export interface SpeedResult {
  success: boolean;
  naturalD20: number;
  dexterity: number;
  extraAttacks: number;
  /** turns of rest owed afterwards: one per extra attack */
  restTurns: number;
}

/** Speed: a Dexterity check; one extra attack per 4 points made (rounded to the nearest), for one round. */
export function resolveSpeed(input: { naturalD20: number; dexterity: number }): SpeedResult {
  const success = input.naturalD20 <= input.dexterity;
  const extraAttacks = success ? Math.round((input.dexterity - input.naturalD20) / 4) : 0;
  return { success, naturalD20: input.naturalD20, dexterity: input.dexterity, extraAttacks, restTurns: extraAttacks };
}

/** Levitation: floats 5 ft per round for a number of rounds equal to the level. */
export function levitationInfo(level: number): { rounds: number; feetPerRound: 5 } {
  return { rounds: level, feetPerRound: 5 };
}

/** Ironskin: AC improves by 2 while the character wears no body armor (a shield does not count). */
export function ironskinAcMod(known: boolean, wearingBodyArmor: boolean): number {
  return known && !wearingBodyArmor ? -2 : 0;
}

/** Blind Fighting: a darkness/blinded/invisible-opponent penalty never exceeds -1. */
export function blindFightingPenalty(penalty: number): number {
  return Math.max(penalty, -1);
}

/** Every maneuver id known on any of the given styles (constant abilities are not limited to the active style). */
export function knownManeuverIds(styles: readonly { knownManeuvers?: readonly { id: string }[] }[]): Set<string> {
  return new Set(styles.flatMap((s) => (s.knownManeuvers ?? []).map((k) => k.id)));
}
```
`src/core/martial-arts/index.ts`: append `export * from "./skills";`.

`src/core/martial-arts/maneuver-attack.ts`:
- imports: add `martialArtsResult, type BlowId` from `./results`;
- `ManeuverAttackResult` gains `maneuverBonus: number;` and `blow: BlowId | null;` (doc comments);
- replace the passive guard with `if (def.kind !== "attack" && def.kind !== "parry") throw new RangeError(\`maneuver "${input.maneuverId}" is not an attack or parry\`);`;
- `const maneuverBonus = def.attackBonus ?? 0;` and `attackBonus = armor + weaponSize + situational + table21 + maneuverBonus`;
- after computing `hit`: `const row = hit && def.basic === true ? martialArtsResult(input.naturalD20) : null;`
- return `maneuverBonus,` `blow: row?.blow ?? null,` and
```ts
    damageFormula: row
      ? String(Math.max(0, row.damage + input.strengthAdj))
      : hit ? maneuverDamageFormula(def, { styleDie: input.styleDie, level: input.level, strengthAdj: input.strengthAdj }) : null,
```
(a `basic` hit uses the table damage; every other maneuver keeps its formula).

`src/core/martial-arts/card.ts`:
- import `LeapResult`, `SpeedResult`, `levitationInfo` from `./skills`;
- in `buildManeuverCardContext`: add the maneuver row `["ADND2E.chat.martialArts.mod.maneuver", r.maneuverBonus]` to `rows`; set `blowKey: r.blow ? \`ADND2E.martialBlows.${r.blow}\` : ""` (replacing the always-blank value, update its doc comment: blank unless the maneuver is a basic attack), and `formula: r.blow ? "" : (r.damageFormula ?? "")`;
- append the skill card:
```ts
export interface CardLine {
  key: string;
  n1?: number;
  n2?: number;
}

export interface SkillCardContext extends ManeuverCardContext {
  /** extra explanatory lines, rendered as hints with up to two numeric parameters */
  lines: CardLine[];
  /** no d20 was rolled (Levitation): the template hides the roll and result lines */
  noRoll: boolean;
}

export type SkillCardInput = { actorName: string; actorImg: string; styleName: string; maneuverId: string } & (
  | { skill: "leap"; result: LeapResult }
  | { skill: "speed"; result: SpeedResult }
  | { skill: "levitation"; level: number }
);

const PRONE_EFFECT: CardEffect = {
  id: "prone", labelKey: "ADND2E.martialEffects.prone", saveKey: "", saveMod: "", condition: "prone", rounds: null, damage: null, deferred: false,
};

export function buildSkillCardContext(input: SkillCardInput): SkillCardContext {
  const def = maneuverById(input.maneuverId)!;
  const base: SkillCardContext = {
    actorName: input.actorName,
    actorImg: input.actorImg,
    styleName: input.styleName,
    targetName: null,
    maneuverKey: `ADND2E.martialManeuvers.${def.slug}`,
    costKey: `ADND2E.martialManeuverCosts.${COST_KEY[String(def.cost)]}`,
    natural: 0,
    total: 0,
    needed: 0,
    hit: true,
    breakdown: [],
    resultKey: "",
    outcomeKey: "",
    formula: "",
    damage: 0,
    stunTrigger: false,
    noStyleDie: false,
    blowKey: "",
    effects: [],
    lines: [],
    noRoll: false,
  };
  if (input.skill === "leap") {
    const r = input.result;
    return {
      ...base,
      natural: r.naturalD20,
      total: r.total,
      needed: r.needed,
      hit: r.hit,
      resultKey: r.hit ? "ADND2E.chat.martialArts.landed" : "ADND2E.chat.martialArts.fell",
      effects: r.hit ? [] : [PRONE_EFFECT],
      lines: [
        { key: "ADND2E.chat.martialArts.leapStanding", n1: r.standing.up, n2: r.standing.forward },
        { key: "ADND2E.chat.martialArts.leapRunning", n1: r.running.up, n2: r.running.forward },
      ],
    };
  }
  if (input.skill === "speed") {
    const r = input.result;
    return {
      ...base,
      natural: r.naturalD20,
      total: r.naturalD20,
      needed: r.dexterity,
      hit: r.success,
      resultKey: r.success ? "ADND2E.chat.martialArts.speedYes" : "ADND2E.chat.martialArts.speedNo",
      lines: [
        ...(r.success ? [{ key: "ADND2E.chat.martialArts.speedExtra", n1: r.extraAttacks }] : []),
        { key: "ADND2E.chat.martialArts.speedOnce" },
      ],
    };
  }
  const info = levitationInfo(input.level);
  return {
    ...base,
    noRoll: true,
    lines: [
      { key: "ADND2E.chat.martialArts.levitationRate", n1: info.feetPerRound },
      { key: "ADND2E.chat.martialArts.levitationDuration", n1: info.rounds },
      { key: "ADND2E.chat.martialArts.levitationRules" },
    ],
  };
}
```
(`CardEffect` and `COST_KEY` already exist in this file from B2; `ManeuverCardContext` is declared above.)

`src/core/martial-arts/view.ts`:
- import `knownManeuverIds, ironskinAcMod` from `./skills`;
- add `MartialConstants` (as in the interfaces block) and `constants: MartialConstants` on `MartialArtsView`; the view input gains `wearingBodyArmor?: boolean`;
- before the final `return`, compute:
```ts
  const knownIds = knownManeuverIds(owned.map((i) => ({ knownManeuvers: i.system.knownManeuvers })));
  const ironskin = knownIds.has("mental:6");
  const SUMMARY: [string, string][] = [["mental:2", "allAroundSight"], ["mental:3", "mentalResistance"], ["mental:5", "blindFighting"], ["mental:6", "ironskin"]];
  const constants: MartialConstants = {
    allAroundSight: knownIds.has("mental:2"),
    mentalResistance: knownIds.has("mental:3"),
    blindFighting: knownIds.has("mental:5"),
    ironskin,
    ironskinAcMod: ironskinAcMod(ironskin, input.wearingBodyArmor ?? false),
    summary: SUMMARY.filter(([id]) => knownIds.has(id)).map(([, slug]) => ({
      nameKey: `ADND2E.martialManeuvers.${slug}`,
      effectKey: `ADND2E.martialManeuverEffects.${slug}`,
    })),
  };
```
and add `constants,` to the returned object.

- [ ] **Step 4: Run to verify they pass, then typecheck and build check**

Run: `npx vitest run tests/core/martial-arts tests/core/index.test.ts && npm run typecheck` then the scratch build.
Expected: PASS (B1/B2 card/attack tests stay green: `maneuverBonus` is 0 and `blow` null for their maneuvers).

- [ ] **Step 5: Commit**

```bash
git add src/core/martial-arts tests/core/martial-arts
git commit -m "feat(martial-arts): Leap, Speed, Levitation, Feint and the constant-ability helpers (SP18 Plan B3)"
```

---

### Task 3: Ironskin in derived AC and the AC breakdown

**Files:**
- Modify: `src/data/derive/character/snapshot.ts` (`ironskinAcMod?: number`)
- Modify: `src/data/derive/character/derive.ts` (sum into the AC situational modifier)
- Modify: `src/data/actor/snapshot.ts` (compute it)
- Modify: `src/sheets/character/context-types.ts`, `src/sheets/character/context.ts` (breakdown row)
- Modify: `src/sheets/character/sheet.ts` (pass the value)
- Modify: `lang/en.json` (`ADND2E.sheet.combat.acIronskin`)
- Modify: `tests/data/derive/character/martial-arts-ac.test.ts`, `tests/sheets/character/context.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/data/derive/character/martial-arts-ac.test.ts` (it already defines `fighter` and `ON`):
```ts
describe("deriveCharacter - Ironskin (SP18 B3)", () => {
  it("adds its modifier to the style modifier while the rule is on", () => {
    expect(deriveCharacter({ ...fighter, martialArtsAcMod: -1, ironskinAcMod: -2 }, ON).ac.normal).toBe(7);
    expect(deriveCharacter({ ...fighter, ironskinAcMod: -2 }, ON).ac.normal).toBe(8);
  });
  it("does nothing while the rule is off or absent", () => {
    expect(deriveCharacter({ ...fighter, ironskinAcMod: -2 }, DEFAULT_OPTIONAL_RULES).ac.normal).toBe(10);
    expect(deriveCharacter(fighter, ON).ac.normal).toBe(10);
  });
});
```
Append to `tests/sheets/character/context.test.ts` (follow the file's existing helper for building an input; mirror its B-Plan-A `martialArtsAcMod` AC-breakdown test):
```ts
  it("shows an Ironskin row in the AC breakdown only when non-zero (SP18 B3)", () => {
    const withRow = buildCharacterContext({ ...baseInput, ironskinAcMod: -2 } as never);
    expect(withRow.ac.breakdown).toContainEqual({ label: "ADND2E.sheet.combat.acIronskin", value: -2 });
    const without = buildCharacterContext({ ...baseInput, ironskinAcMod: 0 } as never);
    expect(without.ac.breakdown.some((r: { label: string }) => r.label === "ADND2E.sheet.combat.acIronskin")).toBe(false);
  });
```
(Use the exact names the existing Plan A style-row test in that file uses for the builder, base input and breakdown path; copy its shape.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/derive/character/martial-arts-ac.test.ts tests/sheets/character/context.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/data/derive/character/snapshot.ts` — after `martialArtsAcMod?`:
```ts
  /** SP18 Plan B3: Ironskin's AC modifier (-2 with the maneuver known and no body armor; absent = none) - applied only while `advancedMartialArts` is on */
  ironskinAcMod?: number;
```
`src/data/derive/character/derive.ts` — change the argument added in Plan A to:
```ts
    situationalModifier: options.advancedMartialArts ? (snapshot.martialArtsAcMod ?? 0) + (snapshot.ironskinAcMod ?? 0) : 0,
```
`src/data/actor/snapshot.ts` (the adapter): import `ironskinAcMod, knownManeuverIds` from `../../core/martial-arts`; widen the local `styles` cast's `system` to include `knownManeuvers?: { id: string }[]`; before the `return`, compute with the adapter's existing equipped body armor value (its `equippedArmor` local, null when none):
```ts
  const hasIronskin = knownManeuverIds(styles.map((s) => ({ knownManeuvers: s.system.knownManeuvers }))).has("mental:6");
  const ironskinMod = ironskinAcMod(hasIronskin, equippedArmor !== null);
```
and add `ironskinAcMod: ironskinMod,` after `martialArtsAcMod,` in the returned snapshot. (If the adapter names the equipped body armor differently, use that value: "an equipped armor item that is not a shield".)
`src/sheets/character/context-types.ts` — next to `martialArtsAcMod?`:
```ts
  /** SP18 Plan B3: Ironskin's AC modifier while the rule is on (negative = better); absent/0 = no breakdown row */
  ironskinAcMod?: number;
```
`src/sheets/character/context.ts` — after the style row lines:
```ts
  const ironskinMod = input.ironskinAcMod ?? 0;
  if (ironskinMod !== 0) acBreakdown.push({ label: "ADND2E.sheet.combat.acIronskin", value: ironskinMod });
```
`src/sheets/character/sheet.ts` — where `martialArtsAcMod:` is passed, add next to it:
```ts
      ironskinAcMod: ((v) => (v.visible ? v.constants.ironskinAcMod : 0))(martialArtsView(this.document as never)),
```
(`martialArtsView` supplies `wearingBodyArmor`, added in Task 4; until then the view's value is 0 for a no-armor default - Task 4 wires it.)
`lang/en.json`: add `"acIronskin": "Ironskin"` beside `acStyle` under `ADND2E.sheet.combat`.

- [ ] **Step 4: Run to verify they pass, then typecheck and build check**

Run: `npx vitest run tests/data tests/sheets tests/lang && npm run typecheck` then the scratch build.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src lang tests
git commit -m "feat(martial-arts): Ironskin folds into derived AC and the AC breakdown (SP18 Plan B3)"
```

---

### Task 4: Sheet glue — use flow, constants summary, labels

**Files:**
- Modify: `src/sheets/character/martial-arts-actions.ts`
- Modify: `templates/chat/martial-arts-attack.hbs`
- Modify: `templates/actor/pc/partials/pc-main-panels.hbs`
- Modify: `lang/en.json`
- Modify: `tests/lang/martial-maneuver-labels.test.ts`, `tests/templates/martial-maneuvers-bindings.test.ts`

**Interfaces — consumes:** Tasks 1-3. **Produces:** `useManeuver` handling for kinds `skill` and `utility`; the summary list in the panel.

- [ ] **Step 1: Write the failing tests**

`tests/lang/martial-maneuver-labels.test.ts` — change the failure-text rule to "required for kinds `attack` and `parry` only" (passive, skill, utility need none), and append:
```ts
  it("the B3 card, summary and breakdown keys exist", () => {
    for (const key of [
      "mod.maneuver", "landed", "fell", "leapStanding", "leapRunning", "speedYes", "speedNo", "speedExtra", "speedOnce",
      "levitationRate", "levitationDuration", "levitationRules",
    ]) expect(LANG.chat?.martialArts?.[key] ?? (LANG as never as { chat?: { martialArts?: Record<string, unknown> } }).chat?.martialArts?.[key], key).toBeTruthy();
  });
```
(That test file reads `LANG` as `ADND2E` map of string maps; if `chat.martialArts` is nested more deeply than its `LANG` type, look the keys up by walking `enJson.ADND2E.chat.martialArts` instead — the assertion is that each key above resolves to a non-empty string, including `mod.maneuver` under `chat.martialArts.mod`.) In `tests/templates/martial-maneuvers-bindings.test.ts` append:
```ts
  it("the card renders skill lines, hides the roll for Levitation and shows effects outside the hit block", () => {
    expect(CHAT).toContain("noRoll");
    expect(CHAT).toContain("lines");
    expect(CHAT).toContain("l.key");
    // the effects block follows the hit block's last element (the Apply Damage button), so it is not gated on `hit`
    expect(CHAT.indexOf("effects.length")).toBeGreaterThan(CHAT.indexOf('data-action="applyDamage"'));
  });
  it("the panel lists the always-in-effect constants", () => {
    expect(MAIN).toContain("martialArts.constants.summary");
    expect(MAIN).toContain("ADND2E.sheet.martialArts.constants");
  });
  it("use handles skill and utility rows and passes body armor and Blind Fighting through the glue", () => {
    expect(ACTIONS).toContain("resolveLeap");
    expect(ACTIONS).toContain("resolveSpeed");
    expect(ACTIONS).toContain("buildSkillCardContext");
    expect(ACTIONS).toContain("blindFightingPenalty");
    expect(ACTIONS).toContain("wearingBodyArmor");
  });
```
(Keep the card/hit-order assertion simple: the real requirement is that the effects block is rendered whether or not `hit`; the grep assertions above plus the proof cover it.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/lang tests/templates tests/styles`
Expected: FAIL.

- [ ] **Step 3: Implement**

`lang/en.json` (siblings of the B1/B2 maps; own wording, no ellipses):
- `martialManeuverLists`: add `movement` "Movement", `weapon` "Weapon", `mental` "Mental and physical training".
- `martialManeuvers`: `feint` "Feint", `proneFighting` "Prone Fighting", `immovability` "Immovability", `leap` "Leap", `speed` "Speed", `slowResistance` "Slow Resistance", `weaponBreaker` "Weapon Breaker", `steelCloth` "Steel Cloth", `meditation` "Meditation", `allAroundSight` "All-Around Sight", `mentalResistance` "Mental Resistance", `chiAttacks` "Ch'i Attacks", `blindFighting` "Blind Fighting", `ironskin` "Ironskin", `levitation` "Levitation".
- `martialManeuverEffects`: `feint` "A false attack to draw them off balance: +3 to hit; the damage is the regular blow."; `proneFighting` "Always in effect: you fight from the ground without penalty, and attackers lose their ground bonuses against you."; `immovability` "Always in effect: you save vs. paralyzation to stay on your feet when an attack would knock you down, lift or throw you."; `leap` "A leap by channeling ch'i; a d20 against AC 10 lands it safely."; `speed` "Once per day, a Dexterity check; each 4 points made gives one extra attack for one round, then rest a turn per extra attack."; `slowResistance` "Always in effect: you are immune to slow effects."; `weaponBreaker` "A swift blow or twist breaks the opponent's normal weapon (magical weapons are unharmed); no damage to creatures."; `steelCloth` "Always in effect: a 6-10 ft cloth you hold becomes a spear (long spear above 8 ft) and is automatically usable."; `meditation` "Always in effect: each hour of meditation gives the rest of two hours of sleep."; `allAroundSight` "Always in effect: you notice all non-invisible foes around you and can never be struck from behind."; `mentalResistance` "Always in effect: +2 on saving throws against mental attacks such as charm, illusion and hold."; `chiAttacks` "Always in effect: your unarmed hits count as magical weapons by level (Table 20); applied by the damage-resistance rules."; `blindFighting` "Always in effect: only -1 when blinded, in darkness or against invisible foes (applied to your martial arts rolls)."; `ironskin` "Always in effect: your AC improves by 2 while you wear no body armor."; `levitation` "Float up, down or sideways; one turn of concentration first and a round of rest after."
- `martialManeuverFailures` (attack/parry kinds only, new rows): `feint` "The feint does not hit; no ill effect."; `weaponBreaker` "The weapon is unharmed."
- `ADND2E.chat.martialArts`: `mod.maneuver` "Maneuver", `landed` "Landed safely", `fell` "Fell", `leapStanding` "Standing start (1 attack): up {n1} ft, forward {n2} ft.", `leapRunning` "Running start (10 ft run-up): up {n1} ft, forward {n2} ft.", `speedYes` "Speed works", `speedNo` "Speed fails", `speedExtra` "Extra attacks this round: {n1}. Rest one turn per extra attack.", `speedOnce` "Usable once per day.", `levitationRate` "Float up, down or sideways at {n1} ft per round.", `levitationDuration` "Lasts {n1} rounds.", `levitationRules` "Needs one turn of concentration first; no actions while floating; rest one round afterwards."
- `ADND2E.sheet.martialArts`: `constants` "Always in effect".

`templates/chat/martial-arts-attack.hbs` — (a) wrap the existing `1d20 = ...` formula line and the `result` line in `{{#unless noRoll}} ... {{/unless}}`; (b) add after the result/outcome lines, before `{{#if hit}}`, the skill lines:
```hbs
  {{#each lines as |l|}}<p class="hint">{{localize l.key n1=l.n1 n2=l.n2}}</p>{{/each}}
```
(c) move the `{{#if effects.length}} ... {{/if}}` effects block (added in B2) OUT of the `{{#if hit}}` block to follow the hit block (effects are empty on a miss for attacks, and Leap puts Prone there on a failed landing). The damage/blow/stun lines and the Apply Damage button stay inside `{{#if hit}}`.

`templates/actor/pc/partials/pc-main-panels.hbs` — inside the Martial Arts panel body, after the styles list and before the "each style adds one attack" hint, add:
```hbs
        {{#if @root.martialArts.constants.summary.length}}
          <h5 class="kit-subhead">{{localize 'ADND2E.sheet.martialArts.constants'}}</h5>
          {{#each @root.martialArts.constants.summary as |c|}}
            <p class="hint"><strong>{{localize c.nameKey}}</strong> - {{localize c.effectKey}}</p>
          {{/each}}
        {{/if}}
```
`src/sheets/character/martial-arts-actions.ts`:
- imports: add `blindFightingPenalty, buildSkillCardContext, levitationInfo, resolveLeap, resolveSpeed` from `../../core/martial-arts` (drop unused names);
- add to the actor type `abilities?: { str?: ...; dex?: { score?: number } }`;
- `martialArtsView` passes `wearingBodyArmor`:
```ts
    wearingBodyArmor: [...actor.items].some((i) => i.type === "armor" && i.system.equipped === true && i.system.isShield !== true),
```
- `situationalModifier(actor, targetStatuses, blindFighting = false)`: replace the two terms with
```ts
    (blindFighting ? blindFightingPenalty(blindedAttackPenalty(actor.statuses)) : blindedAttackPenalty(actor.statuses)) +
    ...
    (blindFighting ? blindFightingPenalty(invisibleTargetPenalty(targetStatuses)) : invisibleTargetPenalty(targetStatuses)) +
```
and pass `view.constants.blindFighting` at BOTH call sites (`rollMartialArtsAttack` and `useManeuver`);
- in `useManeuver`, after the passive guard (`row.kind === "passive"`) and BEFORE `resolveTarget()`, add the no-target kinds:
```ts
  const def = maneuverById(maneuverId)!;
  if (def.kind === "utility") {
    const card = buildSkillCardContext({
      actorName: actor.name, actorImg: actor.img, styleName: view.active.name, maneuverId, skill: "levitation", level: characterLevel(actor),
    });
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/martial-arts-attack.hbs"), card as unknown as Record<string, unknown>);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
    return;
  }
  if (def.kind === "skill") {
    const roll = await new Roll("1d20").evaluate();
    const natural = roll.dice[0]?.total ?? roll.total ?? 1;
    const card =
      def.slug === "leap"
        ? buildSkillCardContext({
            actorName: actor.name, actorImg: actor.img, styleName: view.active.name, maneuverId, skill: "leap",
            result: resolveLeap({
              naturalD20: natural, thac0: actor.system.attributes?.thac0?.melee ?? 20,
              situationalModifier: situationalModifier(actor, new Set<string>(), view.constants.blindFighting), level: characterLevel(actor),
            }),
          })
        : buildSkillCardContext({
            actorName: actor.name, actorImg: actor.img, styleName: view.active.name, maneuverId, skill: "speed",
            result: resolveSpeed({ naturalD20: natural, dexterity: actor.system.abilities?.dex?.score ?? 10 }),
          });
    await postCard(actor, roll, "chat/martial-arts-attack.hbs", card);
    return;
  }
```
(`levitationInfo` is used by `buildSkillCardContext`; drop it from the import if the linter flags it unused.)

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/templates tests/styles tests/lang tests/core tests/combat tests/sheets tests/data`
Expected: PASS. (If `tests/styles/chat-classes.test.ts` flags a class: the new markup uses only `hint`, `modifiers`, `formula`, `result`.)

- [ ] **Step 5: Typecheck, lint, build check and commit**

Run: `npm run typecheck && npx eslint src/sheets/character/martial-arts-actions.ts src/core/martial-arts src/data` then the scratch build.
```bash
git add -A src templates lang tests
git commit -m "feat(martial-arts): use Feint, Leap, Speed, Levitation and Weapon Breaker; constants summary and Blind Fighting (SP18 Plan B3)"
```

---

### Task 5: Gates, headless proof, README and the manual checklist

**Files:**
- Create: `.superpowers/proof/martial-b3.proof.ts` (git-ignored)
- Modify: `README.md` (SP18 row only)

- [ ] **Step 1: Write the headless proof**

Create `.superpowers/proof/martial-b3.proof.ts` from `.superpowers/proof/martial-b2.proof.ts` boilerplate. Assertions:
1. Every shipped style's `availableManeuvers` entry for the lists `movement`, `weapon`, `mental` resolves to registry ids (`maneuverById`), including `mental:4` (the Ch'i placeholder) and `mental:6`; `buildMartialArtsView` over the real cleaned Kung Fu item (offers mental 4 and 6) with level 3 / freeSlots 2 lists `mental:4` learnable and `mental:6` locked/`order`.
2. `resolveLeap` level 10 gives 14/13 and 18/20; `resolveSpeed({naturalD20:4, dexterity:13})` gives 2 extra attacks; `resolveManeuverAttack` for `movement:1` gives bonus +3, a Table 16 blow and a flat damage string.
3. Constants: a cleaned Ninjutsu item with `knownManeuvers` containing `mental:6` on a view with `wearingBodyArmor:false` has `ironskinAcMod -2`, and `deriveCharacter` over a snapshot with `ironskinAcMod:-2` and `advancedMartialArts:true` yields AC 8 (the rule off: 10); Blind Fighting `blindFightingPenalty(-4) === -1`.
4. The shipped chat template compiles (register `localize`, `adnd2eSigned`) and renders: a Leap fail card with an `applyCondition` Prone button and both distance lines; a Levitation card without the `1d20 =` line; a Feint hit card with the blow line; a B2 Paralyzing Touch card unchanged (one applyCondition button).

Run: `npx vitest run --config .superpowers/proof/vitest.proof.config.ts .superpowers/proof/martial-b3.proof.ts`
Expected: PASS. A failing assertion that exposes a real defect is reported, not papered over.

- [ ] **Step 2: Run the full CI sequence**

Run, in order: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, then the build check (scratch outDir while Foundry runs, else `npx vite build`).
Expected: green; coverage statements 100%. Add a missing test rather than lowering anything.

- [ ] **Step 3: README and commit**

Update the SP18 row only: Plans A, B1, B2 and **B3 complete** (the full Table 19 catalogue: Movement, Weapon, Mental/Physical Training; Ironskin applied to AC, Blind Fighting applied to martial arts rolls; Leap/Speed/Levitation/Feint/Weapon Breaker cards); still to come: style weapons (the tight-group slot purchase) and Plan C (ch'i attacks and damage resistance; Mental Resistance saves and All-Around Sight rear AC as numbers). Check `git diff --stat` shows only that row.
```bash
git add README.md
git commit -m "docs: SP18 Plan B3 martial arts maneuvers complete (#86)"
```

- [ ] **Step 4: Rebuild the installed system (only with Foundry closed) and hand the user the checklist**

If Foundry is closed: `npm run build` (re-run once on a transient LEVEL_ITERATOR_NOT_OPEN). Checklist for the user (prerequisites stated):
1. **Setup:** rule ON (reload). A PC Fighter with a class and "Knows basic martial arts" ticked; a high level so there are free weapon slots (XP 1,750,000 = level 15, 9 weapon slots). Drop **Ninjutsu** (movement 1,2,4; mental 2,4) and **Kung Fu** (mental 4,6). A Monster NPC dummy token.
2. **Rows:** Ninjutsu lists Feint, Prone Fighting, Leap (Movement), All-Around Sight, Ch'i Attacks (Mental). Kung Fu lists Ch'i Attacks and Ironskin (Ironskin locked until Ch'i is learned: "Learn the easier maneuvers in this list first").
3. **Ironskin:** learn Ch'i Attacks then Ironskin on Kung Fu (two at one level is the cap; level up between style learns if needed). With no body armor equipped the AC breakdown shows an **Ironskin -2** row and the total is 2 better; equip any body armor (a shield does not count) and the row disappears.
4. **Summary:** the panel shows "Always in effect" with Ironskin (and All-Around Sight once learned), with its text.
5. **Feint:** Use on the dummy: the card shows "Feint - Costs 2 attacks", a "Maneuver: +3" modifier, the roll, a Table 16 blow name and damage with Apply Damage.
6. **Leap:** Use (no target needed): a d20 vs AC 10 card with "Standing start ... up X ft, forward Y ft" and "Running start ...", numbers = 4/3 + level and 8/10 + level; a failed landing shows **Apply Knocked down**.
7. **Speed / Levitation** (shortcut: edit `knownManeuvers` in the console as in the B2 checklist, or learn them): Speed shows the roll vs Dex and "Extra attacks this round: N" when it works; Levitation shows rate 5 ft and duration = level rounds with no roll line.
8. **Blind Fighting:** with it known, blind the PC (Blinded condition) and use the plain attack against a dummy: the card's "Conditions" modifier shows -1 instead of -4.
9. **Non-GM seat:** the player can learn and use all of the above; the Leap Prone button applies through the relay.
10. **Unchanged:** B1/B2 maneuvers and the plain attack behave as before; Character NPC sheet unchanged.
Reset the setting between checks if a step changed it.

- [ ] **Step 5: Open the PR (always push + PR, never ask)**

```bash
git push -u origin feat/sp18b3-martial-arts-movement-weapon-mental
gh pr create --title "feat(martial-arts): SP18 Plan B3 - Movement, Weapon and Mental/Physical Training maneuvers (#86)" --body "..."
```
Body: scope (16 maneuvers, the full Table 19 catalogue; Ironskin AC; Blind Fighting; Leap/Speed/Levitation/Feint/Weapon Breaker), "Part of #86 (style weapons and Plan C remain)", the rulings (Ch'i placeholder row, shields do not cancel Ironskin, Leap shows both distances, Speed once/day not tracked, Mental Resistance and All-Around Sight display only), the test plan and the checklist, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; ask the user to hand-merge.

---

## Self-Review

**Spec coverage:** the 16 registry rows with kinds/costs/Table 21 (Task 1); Leap, Speed, Levitation, Feint, Weapon Breaker, constants helpers, view constants and the skill card (Task 2); Ironskin in derived AC and the breakdown row (Task 3); use flow for skill/utility, Blind Fighting, summary list, labels (Task 4); proof, CI, README, checklist, PR (Task 5). Out-of-scope (style weapons, ch'i effect, Mental Resistance/All-Around Sight pipelines, darkness, per-day tracking) is not built.

**Placeholder scan:** none; the PR body is the only elided string. Task 3's context test says to mirror the file's existing Plan A style-row test shape because that test's local helper names are not repeated here.

**Type consistency:** `ManeuverDef.kind` (Task 1) is what `ManeuverRow.kind`, `resolveManeuverAttack`'s guard and `useManeuver`'s `def.kind` branches use; `MartialConstants`/`constants.ironskinAcMod` (Task 2) feed the sheet's `ironskinAcMod` (Task 3) and the panel summary (Task 4); `buildSkillCardContext`'s `CardLine`/`noRoll` match the template's `lines`/`noRoll` (Task 4); lang keys `chat.martialArts.{mod.maneuver, landed, fell, leapStanding, leapRunning, speedYes, speedNo, speedExtra, speedOnce, levitationRate, levitationDuration, levitationRules}` match the builder.
