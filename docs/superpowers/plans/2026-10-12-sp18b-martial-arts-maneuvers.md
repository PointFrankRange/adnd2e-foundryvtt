# SP18 Plan B1 — Martial Arts Maneuvers (learning engine + Block, Kick, Strike) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A character with the Advanced Martial Arts rule on can learn special maneuvers on an owned style (per-list order, 1 weapon slot each, at most 2 per level) and, with the style active, press **Use** on a known Block/Kick/Strike maneuver to roll it against the targeted token and post a card with the maneuver's modifiers, damage and outcome text.

**Architecture:** A pure registry/rules module `src/core/martial-arts/maneuvers.ts` (10 maneuvers, Table 21 modifiers, armor grouping, damage formulas, learnability), a pure `maneuver-attack.ts` and `buildManeuverCardContext`, and a view extension listing each style's maneuvers. One new schema field `knownManeuvers` on `martialStyle`. Foundry glue adds `learnManeuver`/`useManeuver` to `martial-arts-actions.ts` (sharing a refactored target resolver with the plain attack) and a Maneuvers list inside each style row of the existing panel.

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-12-adnd2e-sp18b-martial-arts-maneuvers-design.md`

## Global Constraints

- Source: PHBR15 ch.4 pp.49-57, Tables 19 and 21. **Content policy:** mechanical values only, short own-wording labels and effect text, no rulebook prose.
- Registry (id, cost, Table 21 light/mail/plate, damage): block:1 Basic Parry (1 attack, none); block:2 Parry All (2 attacks, none); block:3 Grappling Block (1, none); block:4 Arrow Parry (2, none); kick:1 Circle Kick (1, 0/-1/-3, style die + 1d2 + Str); kick:2 Flying Kick (1, -1/-2/-3, style die + 1d4 + Str); kick:3 Backward Kick (1, 0/-1/-3, style die + Str); strike:1 Iron Fist (no extra cost, 0/0/-2, 1d6 + Str); strike:2 Crushing Blow (the round, -1/-2/-3, style die + floor(level/2), no Strength); strike:3 Eagle Claw (the round, -2/-3/-4, 1d8 + Str). Block maneuvers are not on Table 21 (modifier 0) and have no damage.
- Armor groups of the TARGET: light = leather, padded, studded leather, or any creature actor with AC 7 or better; mail = ring, scale, chain, elven chain, splint, banded, plate mail; plate = field plate, full plate; anything else (unarmored) = no Table 21 modifier.
- Damage: dice terms joined by `+`, flat terms summed (a style die of `"1"` is a flat 1; a null style die counts as 0); the rolled total is floored at 0. The book's example: level 11, style die 1d4, Crushing Blow = `1d4+5`.
- Learning: offered by the style (`availableManeuvers`), lowest unlearned difficulty in its list (per-list order), `freeSlots >= 1`, fewer than 2 learned at the character's current level (highest class level). Check order: notOffered, known, order, noSlot, levelCap. Learning appends `{ id, level }` to `knownManeuvers` and adds 1 to `slotsInvested`.
- Only the ACTIVE style's maneuvers can be used. Natural 20 hits and (for attack maneuvers) prompts the stun text; natural 1 misses; a helpless target is a forced hit. Table 16 is not used for maneuvers.
- Parry maneuvers roll against the targeted attacker and report parried / the blow hits; nothing is tracked across rounds.
- New schema field has a function initial (`() => []`) and needs no migration. No new setting.
- The panel is PC-only (`@root.pcActions`); the Character NPC sheet is unchanged. New actions must be added to `PC_ONLY_ACTIONS` in `tests/templates/npc-sheet-bindings.test.ts`.
- Dialogs use `themedPrompt` (guard test). Labels must not end in an ellipsis. Reuse existing CSS classes only (`kit-powers`, `kit-subhead`, `power-row`, `kit-small`, `effect`, `name`, `hint`); the chat census needs no new rule.
- Before opening a PR: `npm run lint`, `npm run typecheck` (incl. the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build` (run it after every task that touches src: invalid UTF-8 bytes in comments pass lint/tsc/vitest but fail the build).
- Files in this repo may be CRLF: prefer the Edit tool; check line endings before scripted edits.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The branch is `feat/sp18b-martial-arts-maneuvers` (holds the spec).

---

### Task 1: Pure maneuver registry and rules

**Files:**
- Create: `src/core/martial-arts/maneuvers.ts`
- Modify: `src/core/martial-arts/index.ts` (add `export * from "./maneuvers";`)
- Create: `tests/core/martial-arts/maneuvers.test.ts`

**Interfaces — produces (exported from `src/core/martial-arts`):**
```ts
export const MANEUVER_LISTS: readonly ["block", "kick", "strike"];
export type ManeuverList = (typeof MANEUVER_LISTS)[number];
export type ManeuverCost = 0 | 1 | 2 | "round";
export type ArmorGroup = "none" | "light" | "mail" | "plate";
export interface ManeuverDef {
  id: string; slug: string; list: ManeuverList; difficulty: number; kind: "parry" | "attack";
  cost: ManeuverCost; extraDie: string | null; ownDie: string | null; addsStrength: boolean; halfLevelBonus: boolean;
  table21: { light: number; mail: number; plate: number };
}
export const MANEUVERS: readonly ManeuverDef[];
export function maneuverById(id: string): ManeuverDef | undefined;
export function armorGroupOf(armorType: string, toughMonster: boolean): ArmorGroup;
export function table21Modifier(def: ManeuverDef, group: ArmorGroup): number;
export function maneuverDamageFormula(def: ManeuverDef, ctx: { styleDie: string | null; level: number; strengthAdj: number }): string | null;
export type LearnReason = "notOffered" | "known" | "order" | "noSlot" | "levelCap";
export type LearnVerdict = { ok: true } | { ok: false; reason: LearnReason };
export function learnability(input: {
  maneuverId: string;
  offered: readonly { list: string; difficulties: readonly number[] }[];
  known: readonly { id: string; level: number }[];
  freeSlots: number;
  level: number;
}): LearnVerdict;
export const MAX_MANEUVERS_PER_LEVEL: 2;
```

- [ ] **Step 1: Write the failing tests**

`tests/core/martial-arts/maneuvers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  MANEUVERS, MANEUVER_LISTS, MAX_MANEUVERS_PER_LEVEL, armorGroupOf, learnability, maneuverById, maneuverDamageFormula, table21Modifier,
} from "../../../src/core/martial-arts";

const def = (id: string) => maneuverById(id)!;

describe("registry — Table 19 for Block, Kick and Strike", () => {
  it("lists the ten maneuvers in order with unique ids", () => {
    expect(MANEUVERS.map((m) => m.id)).toEqual([
      "block:1", "block:2", "block:3", "block:4", "kick:1", "kick:2", "kick:3", "strike:1", "strike:2", "strike:3",
    ]);
    expect(MANEUVER_LISTS).toEqual(["block", "kick", "strike"]);
    for (const m of MANEUVERS) expect(m.id).toBe(`${m.list}:${m.difficulty}`);
  });
  it("carries slugs, kinds and costs", () => {
    expect(MANEUVERS.map((m) => [m.slug, m.kind, m.cost])).toEqual([
      ["basicParry", "parry", 1], ["parryAll", "parry", 2], ["grapplingBlock", "parry", 1], ["arrowParry", "parry", 2],
      ["circleKick", "attack", 1], ["flyingKick", "attack", 1], ["backwardKick", "attack", 1],
      ["ironFist", "attack", 0], ["crushingBlow", "attack", "round"], ["eagleClaw", "attack", "round"],
    ]);
  });
  it("looks up by id and rejects an unknown id", () => {
    expect(maneuverById("kick:1")?.slug).toBe("circleKick");
    expect(maneuverById("bogus:9")).toBeUndefined();
  });
});

describe("Table 21 modifiers and armor grouping", () => {
  it.each([
    ["kick:1", 0, -1, -3], ["kick:2", -1, -2, -3], ["kick:3", 0, -1, -3],
    ["strike:1", 0, 0, -2], ["strike:2", -1, -2, -3], ["strike:3", -2, -3, -4],
    ["block:1", 0, 0, 0], ["block:2", 0, 0, 0], ["block:3", 0, 0, 0], ["block:4", 0, 0, 0],
  ])("%s → %i / %i / %i", (id, light, mail, plate) => {
    expect(def(id).table21).toEqual({ light, mail, plate });
    expect(table21Modifier(def(id), "light")).toBe(light);
    expect(table21Modifier(def(id), "mail")).toBe(mail);
    expect(table21Modifier(def(id), "plate")).toBe(plate);
  });
  it("an unarmored target takes no Table 21 modifier", () => {
    expect(table21Modifier(def("strike:3"), "none")).toBe(0);
  });
  it.each([
    ["leather", "light"], ["padded", "light"], ["studded-leather", "light"],
    ["ring-mail", "mail"], ["scale-mail", "mail"], ["chain-mail", "mail"], ["elven-chain", "mail"],
    ["splint-mail", "mail"], ["banded-mail", "mail"], ["plate-mail", "mail"],
    ["field-plate", "plate"], ["full-plate", "plate"], ["none", "none"], ["mystery", "none"],
  ])("%s → %s", (type, group) => expect(armorGroupOf(type, false)).toBe(group));
  it("a tough-hided monster uses the light column whatever its armor", () => {
    expect(armorGroupOf("none", true)).toBe("light");
  });
});

describe("maneuverDamageFormula", () => {
  const ctx = (styleDie: string | null, level = 5, strengthAdj = 0) => ({ styleDie, level, strengthAdj });
  it("a kick adds its die to the style die and Strength", () => {
    expect(maneuverDamageFormula(def("kick:1"), ctx("1d4", 5, 2))).toBe("1d4+1d2+2");
    expect(maneuverDamageFormula(def("kick:2"), ctx("1d2"))).toBe("1d2+1d4");
  });
  it("a flat style die of 1 hp is a flat term", () => {
    expect(maneuverDamageFormula(def("kick:3"), ctx("1", 5, 1))).toBe("2");
  });
  it("Iron Fist and Eagle Claw use their own die plus Strength", () => {
    expect(maneuverDamageFormula(def("strike:1"), ctx("1d4", 5, 3))).toBe("1d6+3");
    expect(maneuverDamageFormula(def("strike:3"), ctx("1d4", 5, -2))).toBe("1d8-2");
  });
  it("Crushing Blow is the style die plus half the level, with no Strength — the book's 11th-level 1d4 example", () => {
    expect(maneuverDamageFormula(def("strike:2"), ctx("1d4", 11, 4))).toBe("1d4+5");
  });
  it("a weapon-method style (no style die) counts the style die as 0", () => {
    expect(maneuverDamageFormula(def("kick:1"), ctx(null))).toBe("1d2");
    expect(maneuverDamageFormula(def("kick:3"), ctx(null))).toBe("0");
    expect(maneuverDamageFormula(def("kick:3"), ctx(null, 5, -3))).toBe("0");
  });
  it("a parry has no damage", () => {
    expect(maneuverDamageFormula(def("block:1"), ctx("1d4"))).toBeNull();
  });
});

describe("learnability", () => {
  const offered = [{ list: "kick", difficulties: [1, 3] }, { list: "strike", difficulties: [1] }];
  const base = { offered, known: [] as { id: string; level: number }[], freeSlots: 1, level: 3 };
  it("allows the lowest unlearned maneuver in a list", () => {
    expect(learnability({ ...base, maneuverId: "kick:1" })).toEqual({ ok: true });
  });
  it("enforces per-list order but skips difficulties the style does not offer", () => {
    expect(learnability({ ...base, maneuverId: "kick:3" })).toEqual({ ok: false, reason: "order" });
    expect(learnability({ ...base, maneuverId: "kick:3", known: [{ id: "kick:1", level: 1 }] })).toEqual({ ok: true });
    expect(learnability({ ...base, maneuverId: "strike:1" })).toEqual({ ok: true });
  });
  it("refuses a maneuver the style does not offer, or an unknown id", () => {
    expect(learnability({ ...base, maneuverId: "kick:2" })).toEqual({ ok: false, reason: "notOffered" });
    expect(learnability({ ...base, maneuverId: "block:1" })).toEqual({ ok: false, reason: "notOffered" });
    expect(learnability({ ...base, maneuverId: "bogus:9" })).toEqual({ ok: false, reason: "notOffered" });
  });
  it("refuses a known maneuver", () => {
    expect(learnability({ ...base, maneuverId: "kick:1", known: [{ id: "kick:1", level: 1 }] })).toEqual({ ok: false, reason: "known" });
  });
  it("needs a free weapon slot", () => {
    expect(learnability({ ...base, maneuverId: "kick:1", freeSlots: 0 })).toEqual({ ok: false, reason: "noSlot" });
  });
  it("allows at most two per level, and a new level resets it", () => {
    expect(MAX_MANEUVERS_PER_LEVEL).toBe(2);
    const known = [{ id: "kick:1", level: 3 }, { id: "kick:3", level: 3 }];
    expect(learnability({ ...base, maneuverId: "strike:1", known })).toEqual({ ok: false, reason: "levelCap" });
    expect(learnability({ ...base, maneuverId: "strike:1", known, level: 4 })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts/maneuvers.test.ts`
Expected: FAIL — `maneuvers` exports not found.

- [ ] **Step 3: Write the implementation**

`src/core/martial-arts/maneuvers.ts`:
```ts
// PHBR15 Table 19 / Table 21 special maneuvers (Plan B1: Block, Kick, Strike). Pure.

export const MANEUVER_LISTS = ["block", "kick", "strike"] as const;
export type ManeuverList = (typeof MANEUVER_LISTS)[number];

/** Attacks a maneuver costs: 0 = none extra, "round" = the only action of the round. */
export type ManeuverCost = 0 | 1 | 2 | "round";
export type ArmorGroup = "none" | "light" | "mail" | "plate";

export interface ManeuverDef {
  /** `<list>:<difficulty>`, the key stored in a style's knownManeuvers */
  id: string;
  /** i18n leaf under ADND2E.martialManeuvers / martialManeuverEffects / martialManeuverFailures */
  slug: string;
  list: ManeuverList;
  difficulty: number;
  kind: "parry" | "attack";
  cost: ManeuverCost;
  /** a die added to the style's damage die */
  extraDie: string | null;
  /** a die used instead of the style's damage die */
  ownDie: string | null;
  addsStrength: boolean;
  /** adds half the character's level, rounded down */
  halfLevelBonus: boolean;
  /** Table 21 attack modifier by the target's armor group (negative = harder) */
  table21: { light: number; mail: number; plate: number };
}

const NONE = { light: 0, mail: 0, plate: 0 } as const;

export const MANEUVERS: readonly ManeuverDef[] = [
  { id: "block:1", slug: "basicParry", list: "block", difficulty: 1, kind: "parry", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "block:2", slug: "parryAll", list: "block", difficulty: 2, kind: "parry", cost: 2, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "block:3", slug: "grapplingBlock", list: "block", difficulty: 3, kind: "parry", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "block:4", slug: "arrowParry", list: "block", difficulty: 4, kind: "parry", cost: 2, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "kick:1", slug: "circleKick", list: "kick", difficulty: 1, kind: "attack", cost: 1, extraDie: "1d2", ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: 0, mail: -1, plate: -3 } },
  { id: "kick:2", slug: "flyingKick", list: "kick", difficulty: 2, kind: "attack", cost: 1, extraDie: "1d4", ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: -1, mail: -2, plate: -3 } },
  { id: "kick:3", slug: "backwardKick", list: "kick", difficulty: 3, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: 0, mail: -1, plate: -3 } },
  { id: "strike:1", slug: "ironFist", list: "strike", difficulty: 1, kind: "attack", cost: 0, extraDie: null, ownDie: "1d6", addsStrength: true, halfLevelBonus: false, table21: { light: 0, mail: 0, plate: -2 } },
  { id: "strike:2", slug: "crushingBlow", list: "strike", difficulty: 2, kind: "attack", cost: "round", extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: true, table21: { light: -1, mail: -2, plate: -3 } },
  { id: "strike:3", slug: "eagleClaw", list: "strike", difficulty: 3, kind: "attack", cost: "round", extraDie: null, ownDie: "1d8", addsStrength: true, halfLevelBonus: false, table21: { light: -2, mail: -3, plate: -4 } },
];

export function maneuverById(id: string): ManeuverDef | undefined {
  return MANEUVERS.find((m) => m.id === id);
}

const LIGHT = new Set(["leather", "padded", "studded-leather"]);
const MAIL = new Set(["ring-mail", "scale-mail", "chain-mail", "elven-chain", "splint-mail", "banded-mail", "plate-mail"]);
const PLATE = new Set(["field-plate", "full-plate"]);

/** The Table 21 column for a target: a tough-hided monster (a creature with AC 7 or better) uses the light column. */
export function armorGroupOf(armorType: string, toughMonster: boolean): ArmorGroup {
  if (toughMonster) return "light";
  if (LIGHT.has(armorType)) return "light";
  if (MAIL.has(armorType)) return "mail";
  if (PLATE.has(armorType)) return "plate";
  return "none";
}

export function table21Modifier(def: ManeuverDef, group: ArmorGroup): number {
  return group === "none" ? 0 : def.table21[group];
}

/**
 * The damage dice expression for a hit, or null for a parry. Dice terms are joined with "+", flat terms are
 * summed; a style die of "1" is a flat 1 hp and a null style die (a weapon-method style) counts as 0.
 * With no dice the result is a flat number floored at 0; the caller floors a rolled total at 0 too.
 */
export function maneuverDamageFormula(
  def: ManeuverDef,
  ctx: { styleDie: string | null; level: number; strengthAdj: number },
): string | null {
  if (def.kind === "parry") return null;
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
  if (dice.length === 0) return String(Math.max(0, flat));
  return dice.join("+") + (flat > 0 ? `+${flat}` : flat < 0 ? `${flat}` : "");
}

export const MAX_MANEUVERS_PER_LEVEL = 2;

export type LearnReason = "notOffered" | "known" | "order" | "noSlot" | "levelCap";
export type LearnVerdict = { ok: true } | { ok: false; reason: LearnReason };

export function learnability(input: {
  maneuverId: string;
  offered: readonly { list: string; difficulties: readonly number[] }[];
  known: readonly { id: string; level: number }[];
  freeSlots: number;
  level: number;
}): LearnVerdict {
  const def = maneuverById(input.maneuverId);
  const offeredDifficulties = def ? (input.offered.find((o) => o.list === def.list)?.difficulties ?? []) : [];
  if (!def || !offeredDifficulties.includes(def.difficulty)) return { ok: false, reason: "notOffered" };
  const knownIds = new Set(input.known.map((k) => k.id));
  if (knownIds.has(def.id)) return { ok: false, reason: "known" };
  const skipped = offeredDifficulties.some((d) => d < def.difficulty && !knownIds.has(`${def.list}:${d}`));
  if (skipped) return { ok: false, reason: "order" };
  if (input.freeSlots < 1) return { ok: false, reason: "noSlot" };
  if (input.known.filter((k) => k.level === input.level).length >= MAX_MANEUVERS_PER_LEVEL) return { ok: false, reason: "levelCap" };
  return { ok: true };
}
```
`src/core/martial-arts/index.ts`: append `export * from "./maneuvers";`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/core/martial-arts tests/core/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
```bash
git add src/core/martial-arts tests/core/martial-arts
git commit -m "feat(martial-arts): maneuver registry, Table 21, damage formulas and learnability (SP18 Plan B1)"
```
(End the message with the Co-Authored-By line.)

---

### Task 2: Maneuver attack, card context and view rows

**Files:**
- Create: `src/core/martial-arts/maneuver-attack.ts`
- Modify: `src/core/martial-arts/card.ts` (add `buildManeuverCardContext`)
- Modify: `src/core/martial-arts/view.ts` (maneuver rows; optional `level`, `freeSlots`)
- Modify: `src/core/martial-arts/index.ts` (add `export * from "./maneuver-attack";`)
- Create: `tests/core/martial-arts/maneuver-attack.test.ts`, `tests/core/martial-arts/maneuver-view.test.ts`
- Modify: `tests/core/martial-arts/card.test.ts` (append a maneuver describe)

**Interfaces — consumes:** Task 1 exports. **Produces:**
```ts
export interface ManeuverAttackInput {
  maneuverId: string; naturalD20: number; thac0: number; targetAc: number;
  attackerArmorType: string; opponentWeaponSize: string | null; situationalModifier: number;
  targetArmorGroup: ArmorGroup; styleDie: string | null; level: number; strengthAdj: number; forcedHit?: boolean;
}
export interface ManeuverAttackResult {
  maneuverId: string; hit: boolean; naturalD20: number; needed: number; total: number; attackBonus: number;
  penalties: { armor: number; weaponSize: number; situational: number; table21: number };
  damageFormula: string | null; stunTrigger: boolean;
}
export function resolveManeuverAttack(input: ManeuverAttackInput): ManeuverAttackResult;   // throws RangeError on an unknown id
export interface ManeuverCardInput { actorName: string; actorImg: string; styleName: string; targetName: string | null; result: ManeuverAttackResult; damageTotal: number }
export interface ManeuverCardContext {
  actorName: string; actorImg: string; styleName: string; targetName: string | null;
  maneuverKey: string; costKey: string; natural: number; total: number; needed: number; hit: boolean;
  breakdown: { labelKey: string; amount: number }[]; resultKey: string; outcomeKey: string;
  formula: string; damage: number; stunTrigger: boolean; blowKey: string;
}
export function buildManeuverCardContext(input: ManeuverCardInput): ManeuverCardContext;
// view.ts additions
export interface ManeuverRow {
  id: string; nameKey: string; listKey: string; difficulty: number; costKey: string; kind: "parry" | "attack";
  state: "known" | "learnable" | "locked"; reasonKey: string; usable: boolean;
}
// StyleRow gains: maneuvers: ManeuverRow[]
// StyleItemLike.system gains: availableManeuvers?: { list: string; difficulties: number[] }[]; knownManeuvers?: { id: string; level: number }[]
// buildMartialArtsView input gains optional: level?: number (default 0); freeSlots?: number (default 0)
```

- [ ] **Step 1: Write the failing tests**

`tests/core/martial-arts/maneuver-attack.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveManeuverAttack, type ManeuverAttackInput } from "../../../src/core/martial-arts";

const base: ManeuverAttackInput = {
  maneuverId: "kick:1", naturalD20: 12, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
  situationalModifier: 0, targetArmorGroup: "mail", styleDie: "1d4", level: 5, strengthAdj: 1,
};

describe("resolveManeuverAttack", () => {
  it("applies the Table 21 modifier for the target's armor group and builds the damage formula", () => {
    const r = resolveManeuverAttack(base);
    expect(r.penalties).toEqual({ armor: 0, weaponSize: 0, situational: 0, table21: -1 });
    expect(r.attackBonus).toBe(-1);
    expect(r.needed).toBe(10);
    expect(r.total).toBe(11);
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBe("1d4+1d2+1");
    expect(r.stunTrigger).toBe(false);
  });
  it("adds the worn-armor and weapon-size penalties", () => {
    const r = resolveManeuverAttack({ ...base, attackerArmorType: "chain-mail", opponentWeaponSize: "L", naturalD20: 17 });
    expect(r.penalties).toEqual({ armor: -2, weaponSize: -4, situational: 0, table21: -1 });
    expect(r.total).toBe(10);
    expect(r.hit).toBe(true);
  });
  it("a miss has no damage formula", () => {
    const r = resolveManeuverAttack({ ...base, naturalD20: 8 });
    expect(r.hit).toBe(false);
    expect(r.damageFormula).toBeNull();
  });
  it("a parry hits for no damage and never prompts the stun text", () => {
    const r = resolveManeuverAttack({ ...base, maneuverId: "block:1", naturalD20: 20 });
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBeNull();
    expect(r.stunTrigger).toBe(false);
    expect(r.penalties.table21).toBe(0);
  });
  it("a natural 20 with an attack maneuver prompts the stun text; a natural 1 misses", () => {
    expect(resolveManeuverAttack({ ...base, naturalD20: 20, targetAc: -10 }).stunTrigger).toBe(true);
    const one = resolveManeuverAttack({ ...base, naturalD20: 1, situationalModifier: 10 });
    expect(one.hit).toBe(false);
    expect(one.stunTrigger).toBe(false);
  });
  it("a forced hit (helpless target) hits regardless", () => {
    const r = resolveManeuverAttack({ ...base, naturalD20: 2, targetAc: -10, forcedHit: true });
    expect(r.hit).toBe(true);
    expect(r.damageFormula).toBe("1d4+1d2+1");
  });
  it("rejects an unknown maneuver id", () => {
    expect(() => resolveManeuverAttack({ ...base, maneuverId: "bogus:9" })).toThrow(RangeError);
  });
});
```

Append to `tests/core/martial-arts/card.test.ts` (add `buildManeuverCardContext, resolveManeuverAttack` to its existing import from `../../../src/core/martial-arts`):
```ts
describe("buildManeuverCardContext", () => {
  const attackInput = {
    maneuverId: "kick:1", naturalD20: 12, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "mail" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("an attack maneuver hit shows its name, cost, modifiers, formula, damage and effect text", () => {
    const ctx = buildManeuverCardContext({
      actorName: "Akira", actorImg: "a.png", styleName: "Karate", targetName: "Ogre",
      result: resolveManeuverAttack(attackInput), damageTotal: 6,
    });
    expect(ctx.maneuverKey).toBe("ADND2E.martialManeuvers.circleKick");
    expect(ctx.costKey).toBe("ADND2E.martialManeuverCosts.one");
    expect(ctx.breakdown).toEqual([{ labelKey: "ADND2E.chat.martialArts.mod.table21", amount: -1 }]);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.hit");
    expect(ctx.outcomeKey).toBe("ADND2E.martialManeuverEffects.circleKick");
    expect(ctx.formula).toBe("1d4+1d2+1");
    expect(ctx.damage).toBe(6);
    expect(ctx.blowKey).toBe("");
  });
  it("a miss shows the failure text and no damage", () => {
    const ctx = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveManeuverAttack({ ...attackInput, naturalD20: 3 }), damageTotal: 0,
    });
    expect(ctx.hit).toBe(false);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.miss");
    expect(ctx.outcomeKey).toBe("ADND2E.martialManeuverFailures.circleKick");
    expect(ctx.formula).toBe("");
    expect(ctx.damage).toBe(0);
  });
  it("a parry reports parried or the blow hits, with the round cost key for a whole-round maneuver", () => {
    const parried = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Bandit",
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "block:2", naturalD20: 15 }), damageTotal: 0,
    });
    expect(parried.resultKey).toBe("ADND2E.chat.martialArts.parried");
    expect(parried.costKey).toBe("ADND2E.martialManeuverCosts.two");
    const notParried = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Bandit",
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "block:1", naturalD20: 2 }), damageTotal: 0,
    });
    expect(notParried.resultKey).toBe("ADND2E.chat.martialArts.notParried");
    const round = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "strike:2", naturalD20: 14 }), damageTotal: 5,
    });
    expect(round.costKey).toBe("ADND2E.martialManeuverCosts.round");
    const none = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "strike:1", naturalD20: 14 }), damageTotal: 5,
    });
    expect(none.costKey).toBe("ADND2E.martialManeuverCosts.none");
  });
});
```

`tests/core/martial-arts/maneuver-view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildMartialArtsView, type StyleItemLike } from "../../../src/core/martial-arts";

const karate = (over: Partial<StyleItemLike["system"]> = {}): StyleItemLike => ({
  id: "karate", name: "Karate", img: "", type: "martialStyle",
  system: {
    form: "hard", principalMethod: "strike", slotsInvested: 1,
    availableManeuvers: [
      { list: "strike", difficulties: [1, 2, 3] }, { list: "kick", difficulties: [1] },
      { list: "block", difficulties: [1, 2] }, { list: "mental", difficulties: [1, 4] },
    ],
    knownManeuvers: [],
    ...over,
  },
});
const base = { enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 3, freeSlots: 2 };
const rowsOf = (v: ReturnType<typeof buildMartialArtsView>) => Object.fromEntries(v.styles[0]!.maneuvers.map((m) => [m.id, m]));

describe("maneuver rows", () => {
  it("lists only registry maneuvers the style offers (mental is not in B1) with their states", () => {
    const rows = rowsOf(buildMartialArtsView({ ...base, items: [karate()] }));
    expect(Object.keys(rows).sort()).toEqual(["block:1", "block:2", "kick:1", "strike:1", "strike:2", "strike:3"]);
    expect(rows["strike:1"]).toMatchObject({
      state: "learnable", usable: false, nameKey: "ADND2E.martialManeuvers.ironFist", listKey: "ADND2E.martialManeuverLists.strike",
      costKey: "ADND2E.martialManeuverCosts.none", kind: "attack", difficulty: 1, reasonKey: "",
    });
    expect(rows["strike:2"]).toMatchObject({ state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.order" });
  });
  it("a known maneuver is usable only on the active style while able to act", () => {
    const item = karate({ knownManeuvers: [{ id: "strike:1", level: 1 }] });
    expect(rowsOf(buildMartialArtsView({ ...base, items: [item] }))["strike:1"]).toMatchObject({ state: "known", usable: true });
    expect(rowsOf(buildMartialArtsView({ ...base, canAct: false, items: [item] }))["strike:1"]!.usable).toBe(false);
    const other: StyleItemLike = { ...karate(), id: "sumo", name: "Sumo" };
    const v = buildMartialArtsView({ ...base, storedActiveId: "sumo", items: [item, other] });
    expect(v.styles[0]!.maneuvers.find((m) => m.id === "strike:1")!.usable).toBe(false);
  });
  it("shows the lock reason when there is no slot or the level cap is reached", () => {
    expect(rowsOf(buildMartialArtsView({ ...base, freeSlots: 0, items: [karate()] }))["strike:1"]).toMatchObject({
      state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.noSlot",
    });
    const capped = karate({ knownManeuvers: [{ id: "kick:1", level: 3 }, { id: "block:1", level: 3 }] });
    expect(rowsOf(buildMartialArtsView({ ...base, items: [capped] }))["strike:1"]).toMatchObject({
      state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.levelCap",
    });
  });
  it("a style with no availableManeuvers has an empty list, and the new inputs are optional", () => {
    const v = buildMartialArtsView({
      enabled: true, knowsBasics: true, storedActiveId: "", canAct: true,
      items: [{ id: "x", name: "X", img: "", type: "martialStyle", system: { form: "soft", principalMethod: "throw" } }],
    });
    expect(v.styles[0]!.maneuvers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts`
Expected: FAIL — `resolveManeuverAttack`, `buildManeuverCardContext` and `maneuvers` rows missing.

- [ ] **Step 3: Write the implementation**

`src/core/martial-arts/maneuver-attack.ts`:
```ts
// One special-maneuver attack: to-hit with the Table 21 modifier plus the damage formula. Pure.
import { hitResult } from "../combat/attack";
import { armorAttackPenalty, weaponSizePenalty } from "./modifiers";
import { maneuverById, maneuverDamageFormula, table21Modifier, type ArmorGroup } from "./maneuvers";

export interface ManeuverAttackInput {
  maneuverId: string;
  naturalD20: number;
  /** the attacker's melee THAC0 (already includes the Strength to-hit adjustment) */
  thac0: number;
  targetAc: number;
  attackerArmorType: string;
  opponentWeaponSize: string | null;
  situationalModifier: number;
  /** the TARGET's Table 21 column */
  targetArmorGroup: ArmorGroup;
  /** the active style's damage die; null for a weapon-method style */
  styleDie: string | null;
  level: number;
  strengthAdj: number;
  forcedHit?: boolean;
}

export interface ManeuverAttackResult {
  maneuverId: string;
  hit: boolean;
  naturalD20: number;
  needed: number;
  total: number;
  attackBonus: number;
  penalties: { armor: number; weaponSize: number; situational: number; table21: number };
  /** the dice expression to roll on a hit; null for a parry or a miss */
  damageFormula: string | null;
  /** an unmodified 20 with an attack maneuver */
  stunTrigger: boolean;
}

export function resolveManeuverAttack(input: ManeuverAttackInput): ManeuverAttackResult {
  const def = maneuverById(input.maneuverId);
  if (!def) throw new RangeError(`unknown martial arts maneuver "${input.maneuverId}"`);
  const penalties = {
    armor: armorAttackPenalty(input.attackerArmorType),
    weaponSize: weaponSizePenalty(input.opponentWeaponSize),
    situational: input.situationalModifier,
    table21: table21Modifier(def, input.targetArmorGroup),
  };
  const attackBonus = penalties.armor + penalties.weaponSize + penalties.situational + penalties.table21;
  const base = hitResult({ naturalD20: input.naturalD20, attackBonus, thac0: input.thac0, targetAc: input.targetAc });
  const hit = input.forcedHit === true ? true : base.hit;
  return {
    maneuverId: def.id,
    hit,
    naturalD20: input.naturalD20,
    needed: base.needed,
    total: base.total,
    attackBonus,
    penalties,
    damageFormula: hit ? maneuverDamageFormula(def, { styleDie: input.styleDie, level: input.level, strengthAdj: input.strengthAdj }) : null,
    stunTrigger: def.kind === "attack" && input.naturalD20 === 20,
  };
}
```
`src/core/martial-arts/index.ts`: append `export * from "./maneuver-attack";`.

`src/core/martial-arts/card.ts` — add imports at the top:
```ts
import type { ManeuverAttackResult } from "./maneuver-attack";
import { maneuverById } from "./maneuvers";
```
and append:
```ts
export interface ManeuverCardInput {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  result: ManeuverAttackResult;
  /** the rolled damage total, floored at 0 by the caller; 0 when there is no damage */
  damageTotal: number;
}

export interface ManeuverCardContext {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  maneuverKey: string;
  costKey: string;
  natural: number;
  total: number;
  needed: number;
  hit: boolean;
  breakdown: { labelKey: string; amount: number }[];
  resultKey: string;
  outcomeKey: string;
  formula: string;
  damage: number;
  stunTrigger: boolean;
  /** always blank: a maneuver is the result, so the Table 16 blow line is not shown */
  blowKey: string;
}

const COST_KEY: Readonly<Record<string, string>> = { "0": "none", "1": "one", "2": "two", round: "round" };

export function buildManeuverCardContext(input: ManeuverCardInput): ManeuverCardContext {
  const r = input.result;
  const def = maneuverById(r.maneuverId)!;
  const rows: [string, number][] = [
    ["ADND2E.chat.martialArts.mod.armor", r.penalties.armor],
    ["ADND2E.chat.martialArts.mod.weaponSize", r.penalties.weaponSize],
    ["ADND2E.chat.martialArts.mod.situational", r.penalties.situational],
    ["ADND2E.chat.martialArts.mod.table21", r.penalties.table21],
  ];
  const parry = def.kind === "parry";
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    styleName: input.styleName,
    targetName: input.targetName,
    maneuverKey: `ADND2E.martialManeuvers.${def.slug}`,
    costKey: `ADND2E.martialManeuverCosts.${COST_KEY[String(def.cost)]}`,
    natural: r.naturalD20,
    total: r.total,
    needed: r.needed,
    hit: r.hit,
    breakdown: rows.filter(([, amount]) => amount !== 0).map(([labelKey, amount]) => ({ labelKey, amount })),
    resultKey: parry
      ? r.hit ? "ADND2E.chat.martialArts.parried" : "ADND2E.chat.martialArts.notParried"
      : r.hit ? "ADND2E.chat.martialArts.hit" : "ADND2E.chat.martialArts.miss",
    outcomeKey: `${r.hit ? "ADND2E.martialManeuverEffects" : "ADND2E.martialManeuverFailures"}.${def.slug}`,
    formula: r.damageFormula ?? "",
    damage: r.hit && r.damageFormula !== null ? input.damageTotal : 0,
    stunTrigger: r.hit && r.stunTrigger,
    blowKey: "",
  };
}
```

`src/core/martial-arts/view.ts` — add imports and types, extend rows. Replace the file's header import line with:
```ts
import { resolveActiveStyleId, styleStats, type StyleForm, type StyleMethod } from "./style";
import { MANEUVERS, learnability, type ManeuverCost } from "./maneuvers";
```
Extend `StyleItemLike.system` to:
```ts
  system: {
    form?: string;
    principalMethod?: string;
    slotsInvested?: number;
    availableManeuvers?: { list: string; difficulties: number[] }[];
    knownManeuvers?: { id: string; level: number }[];
  };
```
Add before `StyleRow`:
```ts
export interface ManeuverRow {
  id: string;
  nameKey: string;
  listKey: string;
  difficulty: number;
  costKey: string;
  kind: "parry" | "attack";
  state: "known" | "learnable" | "locked";
  /** why a locked maneuver cannot be learned (i18n key); blank otherwise */
  reasonKey: string;
  /** known, on the active style, and the character can act */
  usable: boolean;
}

const COST_KEY: Readonly<Record<string, string>> = { "0": "none", "1": "one", "2": "two", round: "round" };
const costKey = (cost: ManeuverCost): string => `ADND2E.martialManeuverCosts.${COST_KEY[String(cost)]}`;
```
Add `maneuvers: ManeuverRow[];` to `StyleRow`. In `buildMartialArtsView`, add `level?: number; freeSlots?: number;` to the input type, and inside the `owned.map(...)` callback compute the rows and return them:
```ts
    const offered = i.system.availableManeuvers ?? [];
    const known = i.system.knownManeuvers ?? [];
    const knownIds = new Set(known.map((k) => k.id));
    const isActive = i.id === activeId;
    const maneuvers = MANEUVERS.filter((m) => offered.some((o) => o.list === m.list && o.difficulties.includes(m.difficulty))).map(
      (m): ManeuverRow => {
        const verdict = learnability({ maneuverId: m.id, offered, known, freeSlots: input.freeSlots ?? 0, level: input.level ?? 0 });
        const isKnown = knownIds.has(m.id);
        return {
          id: m.id,
          nameKey: `ADND2E.martialManeuvers.${m.slug}`,
          listKey: `ADND2E.martialManeuverLists.${m.list}`,
          difficulty: m.difficulty,
          costKey: costKey(m.cost),
          kind: m.kind,
          state: isKnown ? "known" : verdict.ok ? "learnable" : "locked",
          reasonKey: isKnown || verdict.ok ? "" : `ADND2E.sheet.martialArts.locked.${verdict.reason}`,
          usable: isKnown && isActive && input.canAct,
        };
      },
    );
```
and include `maneuvers,` in the returned `StyleRow` object (keep `active: i.id === activeId`).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/core/martial-arts tests/core/index.test.ts`
Expected: PASS (the Plan A view/card tests still pass: `maneuvers` is `[]` for them).

- [ ] **Step 5: Typecheck, build and commit**

Run: `npm run typecheck && npx vite build`
```bash
git add src/core/martial-arts tests/core/martial-arts
git commit -m "feat(martial-arts): maneuver attack, card context and maneuver rows in the view (SP18 Plan B1)"
```

---

### Task 3: `knownManeuvers` schema field and rule-label copy

**Files:**
- Modify: `src/data/item/martial-style.ts` (field + doc comment)
- Modify: `lang/en.json` (rule-label maps below; sheet/chat keys come in Task 4)
- Modify: `tests/data/martial-style-model.test.ts`
- Create: `tests/lang/martial-maneuver-labels.test.ts`

**Interfaces — consumes:** `MANEUVERS`, `MANEUVER_LISTS` (Task 1). **Produces:** `system.knownManeuvers: { id: string; level: number }[]`; lang maps `ADND2E.martialManeuvers.<slug>`, `ADND2E.martialManeuverLists.<list>`, `ADND2E.martialManeuverEffects.<slug>`, `ADND2E.martialManeuverFailures.<slug>`, `ADND2E.martialManeuverCosts.{none,one,two,round}`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/data/martial-style-model.test.ts` (inside a new `describe`, using its existing `SRC` and `line` helpers):
```ts
describe("knownManeuvers (SP18 Plan B1)", () => {
  it("is an array of {id, level} with a function initial", () => {
    expect(SRC).toMatch(/knownManeuvers: new ArrayField\(/);
    expect(SRC).toMatch(/id: new StringField\(\{ required: true, blank: false \}\)/);
    expect(SRC).toMatch(/level: new NumberField\(\{ required: true, integer: true, min: 1 \}\)/);
    expect(SRC.match(/initial: \(\) => \[\]/g)!.length).toBeGreaterThanOrEqual(4);
    expect(SRC).not.toMatch(/initial: [[{]/);
  });
});
```
`tests/lang/martial-maneuver-labels.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { MANEUVERS, MANEUVER_LISTS } from "../../src/core/martial-arts";

const LANG = (enJson as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;

describe("martial maneuver labels", () => {
  it("every registry slug has a name, an effect and a failure text", () => {
    for (const m of MANEUVERS) {
      expect(LANG.martialManeuvers?.[m.slug], `name ${m.slug}`).toBeTruthy();
      expect(LANG.martialManeuverEffects?.[m.slug], `effect ${m.slug}`).toBeTruthy();
      expect(LANG.martialManeuverFailures?.[m.slug], `failure ${m.slug}`).toBeTruthy();
    }
  });
  it("every list and cost has a label, and none ends in an ellipsis", () => {
    for (const l of MANEUVER_LISTS) expect(LANG.martialManeuverLists?.[l], l).toBeTruthy();
    for (const c of ["none", "one", "two", "round"]) expect(LANG.martialManeuverCosts?.[c], c).toBeTruthy();
    for (const map of ["martialManeuvers", "martialManeuverEffects", "martialManeuverFailures", "martialManeuverLists", "martialManeuverCosts"]) {
      for (const [k, v] of Object.entries(LANG[map]!)) expect(v.endsWith("…") || v.endsWith("..."), `${map}.${k}`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/martial-style-model.test.ts tests/lang/martial-maneuver-labels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/data/item/martial-style.ts` — add to the schema after `weaponGroups`:
```ts
      /** SP18 Plan B1: the special maneuvers this character has learned on this style ({ id: "<list>:<difficulty>", level learned at }). */
      knownManeuvers: new ArrayField(
        new SchemaField({
          id: new StringField({ required: true, blank: false }),
          level: new NumberField({ required: true, integer: true, min: 1 }),
        }),
        { required: true, initial: () => [] },
      ),
```
and update the class doc comment to mention `knownManeuvers` (Plan B1).

`lang/en.json` — add these top-level `ADND2E` maps as siblings of `martialBlows` (own-wording, short, no rulebook prose):
- `martialManeuverLists`: `block` "Block", `kick` "Kick", `strike` "Strike".
- `martialManeuverCosts`: `none` "No extra attack", `one` "Costs 1 attack", `two` "Costs 2 attacks", `round` "Takes the whole round".
- `martialManeuvers`: `basicParry` "Basic Parry", `parryAll` "Parry All", `grapplingBlock` "Grappling Block", `arrowParry` "Arrow Parry", `circleKick` "Circle Kick", `flyingKick` "Flying Kick", `backwardKick` "Backward Kick", `ironFist` "Iron Fist", `crushingBlow` "Crushing Blow", `eagleClaw` "Eagle Claw".
- `martialManeuverEffects` (shown on a success):
  - `basicParry`: "The first blow this round is parried."
  - `parryAll`: "Every melee blow this round is parried (roll for each)."
  - `grapplingBlock`: "The blow is parried and the weapon is pinned; the attacker must win a Strength check to free it."
  - `arrowParry`: "Every missile aimed at you this round is parried (roll for each)."
  - `circleKick`: "A spinning kick; the extra damage is included."
  - `flyingKick`: "A leaping kick that needs 5 feet of running space; the extra damage is included."
  - `backwardKick`: "A kick at someone directly behind you."
  - `ironFist`: "Hardened hands: this damage replaces normal damage on each attack with the principal attack form's hands, otherwise on one attack per round."
  - `crushingBlow`: "Your only action this round; can also shatter wood (half an inch per level) or brittle stone."
  - `eagleClaw`: "Your only action this round; can also shatter spear shafts and crush stone or metal items."
- `martialManeuverFailures` (shown on a miss):
  - `basicParry`: "The blow hits you."
  - `parryAll`: "That blow hits you."
  - `grapplingBlock`: "Your weapon fouls the attacker's; they may yank it free and disarm you."
  - `arrowParry`: "The missile strikes you."
  - `circleKick`: "You lose your next attack and your AC is 2 worse until next round."
  - `flyingKick`: "You fall prone beside the target and spend a round getting up."
  - `backwardKick`: "No ill effect."
  - `ironFist`: "The blow does not land."
  - `crushingBlow`: "Against a hard object you injure your hand: it takes the damage and is useless for 24 hours."
  - `eagleClaw`: "Nothing is damaged and there is no ill effect."

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/data tests/lang`
Expected: PASS. Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('lang/en.json','utf8'))"`.

- [ ] **Step 5: Typecheck, build and commit**

Run: `npm run typecheck && npx vite build`
```bash
git add src/data/item/martial-style.ts lang/en.json tests
git commit -m "feat(martial-arts): knownManeuvers on martial styles and maneuver rule labels (SP18 Plan B1)"
```

---

### Task 4: Sheet glue — learn, use, card and panel

**Files:**
- Modify: `src/sheets/character/martial-arts-actions.ts` (view inputs; shared target resolver; `learnManeuver`, `useManeuver`)
- Modify: `src/sheets/character/sheet.ts` (import, two actions, two handlers)
- Modify: `templates/chat/martial-arts-attack.hbs` (maneuver lines)
- Modify: `templates/actor/pc/partials/pc-main-panels.hbs` (Maneuvers list in each style row)
- Modify: `lang/en.json` (`ADND2E.sheet.martialArts.{maneuvers, learn, useManeuver, known, notKnown}`, `ADND2E.sheet.martialArts.locked.{notOffered, known, order, noSlot, levelCap}`, `ADND2E.chat.martialArts.{parried, notParried, mod.table21}`)
- Modify: `tests/templates/npc-sheet-bindings.test.ts` (`PC_ONLY_ACTIONS` gains `learnManeuver`, `useManeuver`)
- Create: `tests/templates/martial-maneuvers-bindings.test.ts`

**Interfaces — consumes:** Tasks 1-3; `resolveTargetArmorType`, `resolveTargetCombatInfo` (existing). **Produces:** exported `learnManeuver(actor, styleId, maneuverId)` and `useManeuver(actor, maneuverId)`; sheet actions `learnManeuver` (`data-item-id` = style id, `data-maneuver-id`) and `useManeuver` (`data-maneuver-id`).

- [ ] **Step 1: Write the failing tests**

`tests/templates/martial-maneuvers-bindings.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MANEUVERS } from "../../src/core/martial-arts";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const CHAT = read("templates", "chat", "martial-arts-attack.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const NPC_SHEET = read("src", "sheets", "npc", "sheet.ts");
const ACTIONS = read("src", "sheets", "character", "martial-arts-actions.ts");
const CARD = read("src", "core", "martial-arts", "card.ts");
const VIEW = read("src", "core", "martial-arts", "view.ts");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;

const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);
const keysIn = (src: string, re: RegExp): string[] => [...new Set([...src.matchAll(re)].map((m) => m[0]))];

describe("martial arts maneuver bindings (SP18 Plan B1)", () => {
  it("the panel lists maneuvers per style with Learn and Use buttons", () => {
    expect(MAIN).toContain("data-action=\"learnManeuver\"");
    expect(MAIN).toContain("data-action=\"useManeuver\"");
    expect(MAIN).toMatch(/data-maneuver-id="\{\{m\.id\}\}"/);
    const use = MAIN.split(/\r?\n/).find((l) => l.includes('data-action="useManeuver"'))!;
    expect(use.match(/disabled/g)).toHaveLength(1);
    expect(use).toContain("m.usable");
  });
  it("the PC sheet registers both actions; the Character NPC sheet gets neither", () => {
    expect(SHEET).toMatch(/^\s+learnManeuver: Adnd2eCharacterSheet\.#on/m);
    expect(SHEET).toMatch(/^\s+useManeuver: Adnd2eCharacterSheet\.#on/m);
    expect(NPC_SHEET).not.toContain("learnManeuver");
    expect(NPC_SHEET).not.toContain("useManeuver");
  });
  it("every sheet, chat and lock-reason key used exists in lang/en.json", () => {
    const keys = new Set([
      ...keysIn(MAIN, /ADND2E\.sheet\.martialArts\.[A-Za-z]+/g),
      ...keysIn(ACTIONS, /ADND2E\.(sheet|chat)\.martialArts\.[A-Za-z.]+/g).filter((k) => !k.endsWith(".")),
      ...keysIn(CHAT, /ADND2E\.chat\.martialArts\.[A-Za-z]+/g),
      ...keysIn(CARD, /ADND2E\.chat\.martialArts\.(?:mod\.)?[A-Za-z0-9]+/g),
      ...["notOffered", "known", "order", "noSlot", "levelCap"].map((r) => `ADND2E.sheet.martialArts.locked.${r}`),
      "ADND2E.sheet.martialArts.maneuvers", "ADND2E.sheet.martialArts.learn", "ADND2E.sheet.martialArts.useManeuver",
      "ADND2E.chat.martialArts.parried", "ADND2E.chat.martialArts.notParried", "ADND2E.chat.martialArts.mod.table21",
    ]);
    for (const key of keys) expect(typeof lookup(key), key).toBe("string");
  });
  it("the view builds lock-reason keys the lang table covers and the registry's costs are labelled", () => {
    expect(VIEW).toContain("ADND2E.sheet.martialArts.locked.");
    for (const m of MANEUVERS) expect(lookup(`ADND2E.martialManeuvers.${m.slug}`), m.slug).toBeTruthy();
  });
  it("the card shows the maneuver line and outcome text, and still reuses applyDamage", () => {
    expect(CHAT).toContain("maneuverKey");
    expect(CHAT).toContain("outcomeKey");
    expect(CHAT).toContain('data-action="applyDamage"');
  });
  it("learning re-validates through the pure rules and writes via the item", () => {
    expect(ACTIONS).toContain("learnability(");
    expect(ACTIONS).toContain("system.knownManeuvers");
    expect(ACTIONS).toContain("system.slotsInvested");
  });
  it("prompts still go through themedPrompt, never DialogV2 directly", () => {
    expect(ACTIONS).toContain("themedPrompt");
    expect(ACTIONS).not.toContain("DialogV2");
  });
});
```
In `tests/templates/npc-sheet-bindings.test.ts` add `"learnManeuver", "useManeuver"` to the `PC_ONLY_ACTIONS` list (next to `martialArtsAttack`, `useMartialStyle`).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/templates`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/sheets/character/martial-arts-actions.ts` — replace the whole file with the version below (the plain attack keeps its behavior; target resolution is shared):
```ts
import { TEMPLATE_PATH } from "../../constants";
import {
  blindedAttackPenalty, canAct, entangledAttackPenalty, fatigueArmorClassPenalty, fatigueAttackPenalty, frightenedAttackPenalty,
  heldAttackBonus, invisibleTargetPenalty, isHelpless, proneArmorClassPenalty,
} from "../../combat/condition-effects";
import {
  armorGroupOf, buildMartialArtsView, buildMartialCardContext, buildManeuverCardContext, learnability, maneuverById,
  resolveManeuverAttack, resolveMartialAttack, type ArmorGroup, type MartialArtsView, type StyleItemLike,
} from "../../core/martial-arts";
import { themedPrompt } from "../../dialogs/themed-dialog-foundry";
import { getOptionalRules } from "../../settings";
import { resolveTargetArmorType, resolveTargetCombatInfo } from "./combat-rolls";

/* SP18 — Advanced Martial Arts. Foundry glue only; every decision lives in src/core/martial-arts.
 * Writes: the active style id (Plan A) and, when a maneuver is learned, that style item's knownManeuvers and
 * slotsInvested. An attack is a roll plus a chat card whose Apply Damage button reuses the generic applyDamage
 * chat action. */

type Statuses = ReadonlySet<string> | readonly string[];

type OwnedItem = StyleItemLike & { system: Record<string, unknown>; update?(data: Record<string, unknown>): Promise<unknown> };

export interface MartialArtsActor {
  name: string;
  img: string;
  statuses: Statuses;
  system: {
    martialArts: { knowsBasics: boolean; activeStyleId: string };
    attributes?: { thac0?: { melee?: number } };
    abilities?: { str?: { mods?: { damageAdj?: number } } };
    /** derived class entries (Plan B1: the character's level is the highest) */
    classes?: { level: number }[];
    proficiencies?: { weapon?: { available?: number } };
  };
  items: Iterable<OwnedItem>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

const characterLevel = (actor: MartialArtsActor): number => Math.max(0, ...(actor.system.classes ?? []).map((c) => c.level));
const freeWeaponSlots = (actor: MartialArtsActor): number => actor.system.proficiencies?.weapon?.available ?? 0;

export function martialArtsView(actor: MartialArtsActor): MartialArtsView {
  return buildMartialArtsView({
    enabled: getOptionalRules().advancedMartialArts,
    items: actor.items,
    knowsBasics: actor.system.martialArts.knowsBasics,
    storedActiveId: actor.system.martialArts.activeStyleId,
    canAct: canAct(actor.statuses),
    level: characterLevel(actor),
    freeSlots: freeWeaponSlots(actor),
  });
}

/** Choose the style used this round. */
export async function setActiveStyle(actor: MartialArtsActor, itemId: string): Promise<void> {
  if (![...actor.items].some((i) => i.type === "martialStyle" && i.id === itemId)) return;
  await actor.update({ "system.martialArts.activeStyleId": itemId });
}

/** Learn a special maneuver on an owned style: re-validated here (the DOM is never trusted), then 1 slot is spent. */
export async function learnManeuver(actor: MartialArtsActor, styleId: string, maneuverId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as { availableManeuvers?: { list: string; difficulties: number[] }[]; knownManeuvers?: { id: string; level: number }[]; slotsInvested?: number };
  const known = sys.knownManeuvers ?? [];
  const level = characterLevel(actor);
  const verdict = learnability({ maneuverId, offered: sys.availableManeuvers ?? [], known, freeSlots: freeWeaponSlots(actor), level });
  if (!verdict.ok) return warn(`ADND2E.sheet.martialArts.locked.${verdict.reason}`);
  await item.update({
    "system.knownManeuvers": [...known.map((k) => ({ id: k.id, level: k.level })), { id: maneuverId, level }],
    "system.slotsInvested": (sys.slotsInvested ?? 1) + 1,
  });
}

/** The size ("S"/"M"/"L") of the weapon the target is wielding, or null (a missing size means no penalty). */
function wieldedWeaponSize(target: { items: Iterable<{ type: string; system: { equipped?: boolean; size?: string } }> }): string | null {
  const weapon = [...target.items].find((i) => i.type === "weapon" && i.system.equipped === true);
  return weapon?.system.size ?? null;
}

interface TargetInfo {
  targetName: string | null;
  targetAc: number;
  opponentWeaponSize: string | null;
  targetStatuses: ReadonlySet<string>;
  targetArmorGroup: ArmorGroup;
}

/** The targeted token's numbers, or a typed-in AC when zero or several tokens are targeted; null when cancelled. */
async function resolveTarget(): Promise<TargetInfo | null> {
  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  if (targets.length === 1) {
    const t = targets[0]!;
    const targetActor = t.actor as Parameters<typeof resolveTargetCombatInfo>[0] & { statuses?: ReadonlySet<string> };
    const targetStatuses = targetActor.statuses ?? new Set<string>();
    const info = resolveTargetCombatInfo(targetActor);
    // Table 21's "monsters": a creature with AC 7 or better has a tough hide
    const toughMonster = targetActor.type === "creature" && info.ac <= 7;
    return {
      targetName: t.name,
      targetAc: info.ac + proneArmorClassPenalty(targetStatuses) + fatigueArmorClassPenalty(targetStatuses),
      opponentWeaponSize: wieldedWeaponSize(targetActor as never),
      targetStatuses,
      targetArmorGroup: armorGroupOf(resolveTargetArmorType(targetActor as never), toughMonster),
    };
  }
  const manualAc = await themedPrompt({
    window: { title: game.i18n!.localize("ADND2E.chat.attack.manualAcTitle") },
    content: `<p>${game.i18n!.localize(
      targets.length === 0 ? "ADND2E.chat.attack.noTargetHint" : "ADND2E.chat.attack.multiTargetHint",
    )}</p><input type="number" name="ac" value="10" step="1" autofocus>`,
    ok: {
      label: game.i18n!.localize("ADND2E.chat.attack.rollAttack"),
      callback: (_e: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const input = button.form?.elements.namedItem("ac");
        return input instanceof HTMLInputElement ? input.valueAsNumber : NaN;
      },
    },
  } as never);
  if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return null;
  return { targetName: null, targetAc: manualAc, opponentWeaponSize: null, targetStatuses: new Set<string>(), targetArmorGroup: "none" };
}

/** Summed condition modifiers on the attack roll (the same set the weapon attack uses). */
function situationalModifier(actor: MartialArtsActor, targetStatuses: ReadonlySet<string>): number {
  return (
    blindedAttackPenalty(actor.statuses) +
    fatigueAttackPenalty(actor.statuses) +
    entangledAttackPenalty(actor.statuses) +
    frightenedAttackPenalty(actor.statuses) +
    invisibleTargetPenalty(targetStatuses) +
    heldAttackBonus(targetStatuses)
  );
}

async function postCard(actor: MartialArtsActor, roll: Roll, template: string, context: object): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH(template), context as unknown as Record<string, unknown>);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}

/** Rolls one unarmed attack with the active style against the targeted token (or a typed-in AC) and posts the card. */
export async function rollMartialArtsAttack(actor: MartialArtsActor): Promise<void> {
  const view = martialArtsView(actor);
  if (!view.visible) return;
  if (!view.active) return warn("ADND2E.sheet.martialArts.noActive");
  if (!view.canAct) return warn("ADND2E.chat.attack.cannotActWarning");
  const target = await resolveTarget();
  if (!target) return;

  const roll = await new Roll("1d20").evaluate();
  const result = resolveMartialAttack({
    naturalD20: roll.dice[0]?.total ?? roll.total ?? 1,
    thac0: actor.system.attributes?.thac0?.melee ?? 20,
    targetAc: target.targetAc,
    attackerArmorType: resolveTargetArmorType(actor as never),
    opponentWeaponSize: target.opponentWeaponSize,
    situationalModifier: situationalModifier(actor, target.targetStatuses),
    strengthDamageAdj: actor.system.abilities?.str?.mods?.damageAdj ?? 0,
    forcedHit: isHelpless(target.targetStatuses),
  });
  const context = buildMartialCardContext({
    actorName: actor.name, actorImg: actor.img, styleName: view.active.name, targetName: target.targetName, result,
  });
  await postCard(actor, roll, "chat/martial-arts-attack.hbs", context);
}

/** Uses a known maneuver of the active style: one d20 against the target, a damage roll on a hit, one card. */
export async function useManeuver(actor: MartialArtsActor, maneuverId: string): Promise<void> {
  const view = martialArtsView(actor);
  if (!view.visible) return;
  if (!view.active) return warn("ADND2E.sheet.martialArts.noActive");
  if (!view.canAct) return warn("ADND2E.chat.attack.cannotActWarning");
  const row = view.active.maneuvers.find((m) => m.id === maneuverId);
  if (!maneuverById(maneuverId) || row?.state !== "known") return warn("ADND2E.sheet.martialArts.notKnown");
  const target = await resolveTarget();
  if (!target) return;

  const roll = await new Roll("1d20").evaluate();
  const result = resolveManeuverAttack({
    maneuverId,
    naturalD20: roll.dice[0]?.total ?? roll.total ?? 1,
    thac0: actor.system.attributes?.thac0?.melee ?? 20,
    targetAc: target.targetAc,
    attackerArmorType: resolveTargetArmorType(actor as never),
    opponentWeaponSize: target.opponentWeaponSize,
    situationalModifier: situationalModifier(actor, target.targetStatuses),
    targetArmorGroup: target.targetArmorGroup,
    styleDie: view.active.damageDie,
    level: characterLevel(actor),
    strengthAdj: actor.system.abilities?.str?.mods?.damageAdj ?? 0,
    forcedHit: isHelpless(target.targetStatuses),
  });
  let damageTotal = 0;
  if (result.damageFormula) damageTotal = Math.max(0, (await new Roll(result.damageFormula).evaluate()).total ?? 0);
  const context = buildManeuverCardContext({
    actorName: actor.name, actorImg: actor.img, styleName: view.active.name, targetName: target.targetName, result, damageTotal,
  });
  await postCard(actor, roll, "chat/martial-arts-attack.hbs", context);
}
```

`templates/chat/martial-arts-attack.hbs` — replace with:
```hbs
<div class="adnd2e chat-card martial-arts-attack">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{styleName}}</h3>
  </header>
  {{#if maneuverKey}}<p class="formula">{{localize maneuverKey}} — {{localize costKey}}</p>{{/if}}
  {{#if targetName}}<p class="hint">{{localize 'ADND2E.chat.martialArts.against' target=targetName}}</p>{{/if}}
  {{#if breakdown.length}}
    <ul class="modifiers">
      {{#each breakdown as |m|}}<li>{{localize m.labelKey}}: {{adnd2eSigned m.amount}}</li>{{/each}}
    </ul>
  {{/if}}
  <p class="formula">1d20 = <strong>{{natural}}</strong> — {{localize 'ADND2E.chat.martialArts.needed' total=total needed=needed}}</p>
  <p class="result {{#if hit}}hit{{else}}miss{{/if}}">{{localize resultKey}}</p>
  {{#if outcomeKey}}<p class="hint">{{localize outcomeKey}}</p>{{/if}}
  {{#if hit}}
    {{#if blowKey}}<p class="formula">{{localize blowKey}} — {{localize 'ADND2E.chat.martialArts.damage' damage=damage}}</p>{{/if}}
    {{#if formula}}<p class="formula">{{formula}} = <strong>{{damage}}</strong> {{localize 'ADND2E.chat.martialArts.hp'}}</p>{{/if}}
    {{#if stunTrigger}}<p class="hint">{{localize 'ADND2E.chat.martialArts.stun'}}</p>{{/if}}
    {{#if damage}}<button type="button" data-action="applyDamage" data-amount="{{damage}}">{{localize 'ADND2E.chat.damage.applyToTargets'}}</button>{{/if}}
  {{/if}}
</div>
```
(The Plan A context has no `maneuverKey`/`outcomeKey`/`formula`, so a plain attack renders exactly as before.)

`templates/actor/pc/partials/pc-main-panels.hbs` — inside each `{{#each @root.martialArts.styles as |s|}}` row, directly before its closing `</div>` (after the item-controls line), add:
```hbs
            {{#if s.maneuvers.length}}
              <div class="kit-powers">
                <h5 class="kit-subhead">{{localize 'ADND2E.sheet.martialArts.maneuvers'}}</h5>
                {{#each s.maneuvers as |m|}}
                  <div class="power-row" data-maneuver-id="{{m.id}}">
                    <span class="name">{{localize m.nameKey}}</span>
                    <span class="effect">{{localize m.listKey}} {{m.difficulty}} — {{localize m.costKey}}</span>
                    {{#if m.reasonKey}}<span class="effect">{{localize m.reasonKey}}</span>{{/if}}
                    {{#if (eq m.state 'known')}}
                      <button type="button" class="kit-small" data-action="useManeuver" data-maneuver-id="{{m.id}}"{{#unless m.usable}} disabled{{/unless}}>{{localize 'ADND2E.sheet.martialArts.useManeuver'}}</button>
                    {{else if (eq m.state 'learnable')}}
                      <button type="button" class="kit-small" data-action="learnManeuver" data-item-id="{{s.id}}" data-maneuver-id="{{m.id}}">{{localize 'ADND2E.sheet.martialArts.learn'}}</button>
                    {{/if}}
                  </div>
                {{/each}}
              </div>
            {{/if}}
```
(`eq` is already used in `pc-item-table.hbs`.)

`src/sheets/character/sheet.ts` — extend the Plan A import to `import { learnManeuver, martialArtsView, rollMartialArtsAttack, setActiveStyle, useManeuver } from "./martial-arts-actions";`; in `DEFAULT_OPTIONS.actions` after `useMartialStyle: ...` add:
```ts
      learnManeuver: Adnd2eCharacterSheet.#onLearnManeuver,
      useManeuver: Adnd2eCharacterSheet.#onUseManeuver,
```
and after `#onUseMartialStyle` add:
```ts
  static async #onLearnManeuver(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const styleId = target.dataset.itemId ?? "";
    const maneuverId = target.dataset.maneuverId ?? "";
    if (this.isEditable && styleId && maneuverId) await learnManeuver(this.document as never, styleId, maneuverId);
  }

  static async #onUseManeuver(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const maneuverId = target.dataset.maneuverId ?? "";
    if (this.isEditable && maneuverId) await useManeuver(this.document as never, maneuverId);
  }
```

`lang/en.json` additions:
- `ADND2E.sheet.martialArts`: `maneuvers` "Special maneuvers", `learn` "Learn", `useManeuver` "Use", `notKnown` "You have not learned that maneuver with the active style.", and `locked`: `notOffered` "This style does not teach it.", `known` "Already learned.", `order` "Learn the easier maneuvers in this list first.", `noSlot` "No free weapon proficiency slot.", `levelCap` "Two maneuvers per level on a style.".
- `ADND2E.chat.martialArts`: `parried` "Parried", `notParried` "Not parried", `hp` "hp", and under `mod`: `table21` "Target's armor".

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/templates tests/styles tests/lang tests/core tests/sheets tests/data`
Expected: PASS. If `tests/styles/chat-classes.test.ts` flags a class, the template uses only `hint`, `formula`, `modifiers`, `result`, `hit`, `miss` — all already styled.

- [ ] **Step 5: Typecheck, lint, build and commit**

Run: `npm run typecheck && npx eslint src/sheets/character/martial-arts-actions.ts src/sheets/character/sheet.ts src/core/martial-arts && npx vite build`
```bash
git add -A src templates lang tests
git commit -m "feat(martial-arts): learn and use special maneuvers from the Martial Arts panel (SP18 Plan B1)"
```

---

### Task 5: Gates, headless proof, README and the manual checklist

**Files:**
- Create: `.superpowers/proof/martial-maneuvers.proof.ts` (git-ignored, like the other proofs)
- Modify: `README.md` (the SP18 row: B1 done; B2/B3 and C open)

- [ ] **Step 1: Write the headless proof**

Create `.superpowers/proof/martial-maneuvers.proof.ts` from the harness boilerplate in `.superpowers/proof/martial-styles.proof.ts` (the Plan A proof; if it is missing use `.superpowers/proof/humanoid-races.proof.ts`). Assertions:
1. The real `MartialStyleItemModel.schema` cleans a Karate pack source (`packs/martial-styles/_source/karate.json`) to an empty `knownManeuvers`, two cleans do not share the array, and `{ id: "kick:1", level: 3 }` validates while `{ id: "", level: 3 }` and `{ id: "kick:1", level: 0 }` are rejected (`F.data.validation.DataModelValidationFailure`).
2. For every shipped style, every `availableManeuvers` list that is a registry list (block, kick, strike) resolves to registry ids via `maneuverById`, and `buildMartialArtsView` over the real cleaned item with `level: 3, freeSlots: 2` lists exactly those rows with the lowest-difficulty one `learnable` and the rest `locked`/`order`.
3. Learn/use pipeline on plain data: learning `strike:1` then `strike:2` on Karate gives rows known/learnable; a third learn at the same level is `levelCap`; the same at level 4 is learnable; `resolveManeuverAttack` for `strike:2` at level 11 with style die `1d4` and a mail target yields formula `1d4+5` and `penalties.table21 === -2`.
4. The shipped chat template (`templates/chat/martial-arts-attack.hbs`) compiles with Handlebars (register `localize`, `adnd2eSigned`) and renders a maneuver hit card (contains the maneuver name key output, the formula and the Apply button) and a parry card (no Apply button), and a Plan A plain card is unchanged (no maneuver line).

Run: `npx vitest run --config .superpowers/proof/vitest.proof.config.ts .superpowers/proof/martial-maneuvers.proof.ts`
Expected: PASS. A failing assertion that exposes a real defect is reported, not papered over.

- [ ] **Step 2: Run the full CI sequence**

Run, in order: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npx vite build`.
Expected: all green; coverage statements 100%. Add a missing test rather than lowering anything.

- [ ] **Step 3: README and commit**

Update the SP18 row: Plan A complete, **Plan B1 complete** (learning engine; Block, Kick, Strike; Table 21), B2 (Lock, Throw, Push, Vital Area) and B3 (Movement, Weapon, Mental/Physical Training) not started, Plan C not started.
```bash
git add README.md
git commit -m "docs: SP18 Plan B1 martial arts maneuvers complete (#86)"
```

- [ ] **Step 4: Rebuild the installed system and hand the user the manual checklist**

If Foundry is closed (`tasklist | grep -i foundry`): `npm run build` (a running Foundry holds a LevelDB lock — skip and say so if open).

Checklist for the user (prerequisites stated; the Plan A fixture macro was deleted — offer to recreate it from the Plan A plan if wanted):
1. **Setup:** rule ON (reload). A PC with a **Fighter** class (level 1 gives 4 free weapon slots) with "Knows basic martial arts" ticked and **Karate** dropped (the style offers strike 1-3, kick 1, block 1-2).
2. **Locked states:** open the Martial Arts panel → under Karate, Special maneuvers lists Iron Fist, Crushing Blow, Eagle Claw, Circle Kick, Basic Parry, Parry All. Only the lowest of each list shows **Learn** (Iron Fist, Circle Kick, Basic Parry); Crushing Blow shows "Learn the easier maneuvers in this list first."
3. **Learn:** click Learn on Iron Fist → it becomes Known with a Use button; the style's Slots goes 1 → 2; weapon slots free drops by 1. Learn Circle Kick (2nd this level) → fine. Try Basic Parry (3rd) → "Two maneuvers per level on a style."
4. **Use:** target a dummy, click **Use** on Circle Kick → a card shows "Circle Kick — Costs 1 attack", the roll, the formula `1d4+1d2(+Str)` with its total, an Apply Damage button, and the effect or failure line. Against a mail-armored target the modifiers list shows "Target's armor: -1".
5. **Parry:** (after a level-up or with a second character) Basic Parry against a targeted attacker → "Parried" or "Not parried" and no damage button.
6. **Not known / inactive style:** a maneuver of a second, non-active style has a disabled Use button.
7. **Non-GM seat:** steps 3-4 work for a player-owned PC; Apply Damage resolves through the GM relay.
8. **Character NPC:** no Martial Arts panel, unchanged.
Reset the setting between checks if an earlier step changed it.

- [ ] **Step 5: Open the PR (always push + PR, never ask)**

```bash
git push -u origin feat/sp18b-martial-arts-maneuvers
gh pr create --title "feat(martial-arts): SP18 Plan B1 - special maneuvers: learning engine + Block, Kick, Strike (#86)" --body "..."
```
Body: scope (10 maneuvers, learning rules, Table 21), "Part of #86 (B2, B3, C remain)", the rulings (per-list order, highest class level, mail group, maneuvers roll the style die), test plan incl. the CI sequence, proof, manual checklist, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; ask the user to hand-merge.

---

## Self-Review

**Spec coverage:** registry + Table 19/21 values (Task 1); learning rules incl. per-list order, slot, 2-per-level cap, highest class level (Tasks 1, 4); damage formulas incl. the book's 1d4+5 example (Task 1); attack composition (Task 2); card + outcome text and parry reporting (Tasks 2, 4); `knownManeuvers` schema and labels (Task 3); panel rows, Learn/Use, PC-only wiring and the NPC census (Task 4); proof, CI, README, checklist, PR (Task 5). Out-of-scope lists (B2/B3/C, per-round tracking, master limit) are not built.

**Placeholder scan:** none; the PR body is the only elided string and is described by contents.

**Type consistency:** `learnability`, `maneuverById`, `armorGroupOf`, `ArmorGroup` (Task 1) are used by `maneuver-attack.ts`, `view.ts` and the glue (Tasks 2, 4); `ManeuverRow`/`StyleRow.maneuvers` (Task 2) are what the panel template reads (`m.id`, `m.nameKey`, `m.listKey`, `m.difficulty`, `m.costKey`, `m.reasonKey`, `m.state`, `m.usable`); `buildManeuverCardContext` keys (`ADND2E.martialManeuvers.*`, `*Effects`, `*Failures`, `*Costs.none|one|two|round`, `chat.martialArts.parried|notParried|mod.table21`) match the lang blocks in Tasks 3-4; the view's `ADND2E.sheet.martialArts.locked.<reason>` keys match `LearnReason`.
