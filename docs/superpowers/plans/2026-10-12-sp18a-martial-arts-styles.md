# SP18 Plan A — Martial Arts Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With the new "Advanced Martial Arts (PHBR15)" rule on, a PC can own `martialStyle` items (the 8 Table 17 styles ship in a compendium), pick the style used this round, see its AC modifier applied to their derived AC, and press **Attack** to roll an unarmed martial arts attack that resolves on Table 16 and posts a chat card with an Apply Damage button.

**Architecture:** A pure rules module `src/core/martial-arts/` (Table 18 style derivation, Table 16 results, Table 57 / Table 22 penalties, attack resolution, chat-card context, sheet-view builder) in the 100% coverage gate. A new `martialStyle` item subtype and a `system.martialArts {knowsBasics, activeStyleId}` actor field. The active style's AC modifier folds into `deriveAc` through the snapshot. Foundry glue `src/sheets/character/martial-arts-actions.ts` rolls the attack and posts the card. A PC-only panel on the Main tab beside the Wrestle panel.

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-12-adnd2e-sp18a-martial-arts-styles-design.md` (Task 1 appends the plan-time amendments to it).

## Global Constraints

- Source: PHBR15 (The Complete Ninja's Handbook) ch.4, Tables 16, 17, 18, 22; PHB Table 57. **Content policy:** mechanical values only, short own-wording labels and descriptions, no rulebook prose.
- Table 18: form AC mod hard -1, soft -3, hard/soft -2. Form Dmg Mod hard 2, soft 0, hard/soft 1. Method Dmg Mod: block 1, kick 2, lock 1, movement 1, push 1, strike 2, throw 1, vital area 2, weapon = by weapon (null). Principal attack: block Hand, kick Foot, lock Body, movement Legs, push Hand, strike Hand, throw Body, vital area Hand/Foot, weapon Hand/Arm. Every style gives +1 attack per round while unarmed. Total Dmg Mod rounds UP to the nearest game die: 1 → "1" (1 hp), 2 → 1d2, 3 → 1d3, 4 → 1d4, 5 → 1d6, 7 → 1d8.
- Table 17 styles equal their Table 18 derivation (a test asserts all eight): Aikijutsu soft/throw (AC -3, 1 hp, Body); Atemi hard/vital area (AC -1, 1d4, Hand/Foot); Jujutsu hard-soft/lock (AC -2, 1d2, Body); Karate hard/strike (AC -1, 1d4, Hand); Kung fu hard-soft/strike (AC -2, 1d3, Hand); Ninjutsu hard-soft/movement (AC -2, 1d2, Legs); Sumo hard-soft/push (AC -2, 1d2, Hand); Tae Kwon Do hard/kick (AC -1, 1d4, Foot).
- Table 16 (unmodified d20 on a hit): 19-20 head kick 4; 17-18 head punch 3; 15-16 vitals kick 3; 13-14 vitals punch 2; 11-12 high kick 2; 9-10 side kick 2; 6-8 body punch 1; 3-5 low kick 1; 1-2 graze 0. **Damage = the Table 16 number + the attacker's Strength damage adjustment, minimum 0** (reading R3, decided). The style's damage die is derived and shown but not rolled in Plan A. No "pull" option (the player simply does not press Apply).
- Penalties are to the attack roll: attacker's own worn armor (PHB Table 57): studded leather -1; ring, scale, chain, elven chain -2; splint, banded, plate mail -5; field plate -8; full plate -10; anything else 0. Opponent's wielded weapon size (Table 22): S -1, M -2, L -4, G -3, H -1; unknown/none 0. Table 21 (target armor vs maneuvers) is Plan B.
- Natural 20 hits and, being unmodified, triggers the stun/incapacitate prompt on the card (the card states the rule; nothing is rolled for the target). Natural 1 misses. A helpless target is hit automatically (the #94 rule, like weapon attacks).
- Setting `advancedMartialArts` (world, boolean, default **false**, requires reload). While off: no panel; the AC modifier is not applied. The slot sum counts owned styles regardless (a style item only exists if someone added it).
- Slots: `slotsInvested` (integer ≥ 1, default 1) on a style counts into the weapon-proficiency slots spent. The 2-slots-per-level cap and purchasing maneuvers are Plan B.
- The panel is PC-sheet only (`@root.pcActions`). The Character NPC sheet must render unchanged. Attack is blocked while `canAct(actor.statuses)` is false.
- Arrays/objects in schema `initial` must be functions (shared-literal gotcha). New schema fields have initials and need no migration.
- Dialogs use `themedPrompt`, never `DialogV2` directly (a guard test enforces it). The chat template count assertion goes 17 → 18.
- Out of scope (later plans): special maneuvers, style weapons, ch'i attacks / damage resistance, the 2-per-level cap, a DM style builder, Monster NPC styles, Table 23 hit locations.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Files in this repo may be CRLF: check line endings before any scripted replacement; prefer the Edit tool.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The branch is `feat/sp18a-martial-arts-styles` (already created, holds the spec).

---

### Task 1: Pure martial arts rules, card context and view builder

**Files:**
- Create: `src/core/martial-arts/style.ts`
- Create: `src/core/martial-arts/results.ts`
- Create: `src/core/martial-arts/modifiers.ts`
- Create: `src/core/martial-arts/attack.ts`
- Create: `src/core/martial-arts/card.ts`
- Create: `src/core/martial-arts/view.ts`
- Create: `src/core/martial-arts/index.ts`
- Modify: `src/core/index.ts` (add `export * from "./martial-arts";` after the `./tracking` line)
- Modify: `docs/superpowers/specs/2026-10-12-adnd2e-sp18a-martial-arts-styles-design.md` (append the amendments below)
- Create: `tests/core/martial-arts/style.test.ts`, `results.test.ts`, `modifiers.test.ts`, `attack.test.ts`, `card.test.ts`, `view.test.ts`

**Interfaces — produces (all exported from `src/core/martial-arts`):**
```ts
export const STYLE_FORMS: readonly ["hard", "soft", "hardSoft"];
export const STYLE_METHODS: readonly ["block","kick","lock","movement","push","strike","throw","vitalArea","weapon"];
export type StyleForm; export type StyleMethod;
export type PrincipalAttack = "hand" | "foot" | "body" | "legs" | "handFoot" | "handArm";
export interface StyleStats { extraAttacks: 1; acMod: number; damageMod: number | null; damageDie: string | null; principalAttack: PrincipalAttack }
export function damageDieFor(total: number): string;
export function styleStats(form: StyleForm, method: StyleMethod): StyleStats;
export function resolveActiveStyleId(ids: readonly string[], stored: string): string;
export const BLOW_IDS: readonly [...]; export type BlowId;
export function martialArtsResult(naturalD20: number): { blow: BlowId; damage: number };
export function armorAttackPenalty(armorType: string): number;
export function weaponSizePenalty(size: string | null): number;
export interface MartialAttackInput { naturalD20: number; thac0: number; targetAc: number; attackerArmorType: string; opponentWeaponSize: string | null; situationalModifier: number; strengthDamageAdj: number; forcedHit?: boolean }
export interface MartialAttackResult { hit: boolean; naturalD20: number; needed: number; total: number; attackBonus: number; penalties: { armor: number; weaponSize: number; situational: number }; blow: BlowId | null; tableDamage: number; damage: number; stunTrigger: boolean }
export function resolveMartialAttack(input: MartialAttackInput): MartialAttackResult;
export interface MartialCardInput { actorName: string; actorImg: string; styleName: string; targetName: string | null; result: MartialAttackResult }
export interface MartialCardContext { actorName: string; actorImg: string; styleName: string; targetName: string | null; natural: number; total: number; needed: number; hit: boolean; breakdown: { labelKey: string; amount: number }[]; resultKey: string; blowKey: string; damage: number; stunTrigger: boolean }
export function buildMartialCardContext(input: MartialCardInput): MartialCardContext;
export interface StyleItemLike { id: string; name: string; img: string; type: string; system: { form?: string; principalMethod?: string; slotsInvested?: number } }
export interface StyleRow { id: string; name: string; img: string; formKey: string; methodKey: string; attackFormKey: string; acMod: number; damageDie: string | null; slots: number; active: boolean }
export interface MartialArtsView { visible: boolean; knowsBasics: boolean; canAct: boolean; canAttack: boolean; styles: StyleRow[]; active: StyleRow | null }
export function buildMartialArtsView(input: { enabled: boolean; items: Iterable<StyleItemLike>; knowsBasics: boolean; storedActiveId: string; canAct: boolean }): MartialArtsView;
```

- [ ] **Step 1: Write the failing tests**

`tests/core/martial-arts/style.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { STYLE_FORMS, STYLE_METHODS, damageDieFor, resolveActiveStyleId, styleStats } from "../../../src/core/martial-arts";

describe("damageDieFor — rounds up to the nearest game die", () => {
  it.each([
    [1, "1"], [2, "1d2"], [3, "1d3"], [4, "1d4"], [5, "1d6"], [6, "1d6"], [7, "1d8"], [9, "1d10"], [11, "1d12"], [13, "1d20"], [30, "1d20"],
  ])("total %i → %s", (total, die) => {
    expect(damageDieFor(total)).toBe(die);
  });
});

describe("styleStats — Table 18 derivation reproduces Table 17", () => {
  const TABLE_17: [string, "hard" | "soft" | "hardSoft", (typeof STYLE_METHODS)[number], number, string, string][] = [
    ["Aikijutsu", "soft", "throw", -3, "1", "body"],
    ["Atemi", "hard", "vitalArea", -1, "1d4", "handFoot"],
    ["Jujutsu", "hardSoft", "lock", -2, "1d2", "body"],
    ["Karate", "hard", "strike", -1, "1d4", "hand"],
    ["Kung fu", "hardSoft", "strike", -2, "1d3", "hand"],
    ["Ninjutsu", "hardSoft", "movement", -2, "1d2", "legs"],
    ["Sumo", "hardSoft", "push", -2, "1d2", "hand"],
    ["Tae Kwon Do", "hard", "kick", -1, "1d4", "foot"],
  ];
  it.each(TABLE_17)("%s", (_name, form, method, ac, die, attack) => {
    const s = styleStats(form, method);
    expect(s.acMod).toBe(ac);
    expect(s.damageDie).toBe(die);
    expect(s.principalAttack).toBe(attack);
    expect(s.extraAttacks).toBe(1);
  });
  it("a weapon principal method has no fixed damage mod or die", () => {
    const s = styleStats("hard", "weapon");
    expect(s.damageMod).toBeNull();
    expect(s.damageDie).toBeNull();
    expect(s.principalAttack).toBe("handArm");
  });
  it("lists the forms and methods", () => {
    expect([...STYLE_FORMS]).toEqual(["hard", "soft", "hardSoft"]);
    expect(STYLE_METHODS).toHaveLength(9);
  });
});

describe("resolveActiveStyleId", () => {
  it("keeps a stored id that is owned", () => expect(resolveActiveStyleId(["a", "b"], "b")).toBe("b"));
  it("falls back to the first owned style", () => expect(resolveActiveStyleId(["a", "b"], "gone")).toBe("a"));
  it("is blank with no styles", () => expect(resolveActiveStyleId([], "x")).toBe(""));
});
```

`tests/core/martial-arts/results.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { martialArtsResult } from "../../../src/core/martial-arts";

describe("Table 16", () => {
  it.each([
    [20, "headKick", 4], [19, "headKick", 4], [18, "headPunch", 3], [17, "headPunch", 3], [16, "vitalsKick", 3], [15, "vitalsKick", 3],
    [14, "vitalsPunch", 2], [13, "vitalsPunch", 2], [12, "highKick", 2], [11, "highKick", 2], [10, "sideKick", 2], [9, "sideKick", 2],
    [8, "bodyPunch", 1], [6, "bodyPunch", 1], [5, "lowKick", 1], [3, "lowKick", 1], [2, "graze", 0], [1, "graze", 0],
  ])("d20 %i → %s (%i)", (roll, blow, damage) => {
    expect(martialArtsResult(roll)).toEqual({ blow, damage });
  });
  it("rejects a roll outside 1-20", () => {
    expect(() => martialArtsResult(0)).toThrow(RangeError);
    expect(() => martialArtsResult(21)).toThrow(RangeError);
  });
});
```

`tests/core/martial-arts/modifiers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { armorAttackPenalty, weaponSizePenalty } from "../../../src/core/martial-arts";

describe("armorAttackPenalty — PHB Table 57", () => {
  it.each([
    ["none", 0], ["padded", 0], ["leather", 0], ["studded-leather", -1], ["ring-mail", -2], ["scale-mail", -2], ["chain-mail", -2],
    ["elven-chain", -2], ["splint-mail", -5], ["banded-mail", -5], ["plate-mail", -5], ["field-plate", -8], ["full-plate", -10],
  ])("%s → %i", (type, penalty) => expect(armorAttackPenalty(type)).toBe(penalty));
  it("an unknown or prototype key is 0", () => {
    expect(armorAttackPenalty("mystery")).toBe(0);
    expect(armorAttackPenalty("constructor")).toBe(0);
  });
});

describe("weaponSizePenalty — Table 22", () => {
  it.each([["S", -1], ["M", -2], ["L", -4], ["G", -3], ["H", -1]])("%s → %i", (size, p) => expect(weaponSizePenalty(size)).toBe(p));
  it("no weapon or an unknown size is 0", () => {
    expect(weaponSizePenalty(null)).toBe(0);
    expect(weaponSizePenalty("X")).toBe(0);
    expect(weaponSizePenalty("toString")).toBe(0);
  });
});
```

`tests/core/martial-arts/attack.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveMartialAttack, type MartialAttackInput } from "../../../src/core/martial-arts";

const base: MartialAttackInput = {
  naturalD20: 13, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null, situationalModifier: 0, strengthDamageAdj: 0,
};

describe("resolveMartialAttack", () => {
  it("the book's example: a 13 is a vitals punch doing 2 hp", () => {
    const r = resolveMartialAttack(base);
    expect(r.hit).toBe(true);
    expect(r.blow).toBe("vitalsPunch");
    expect(r.tableDamage).toBe(2);
    expect(r.damage).toBe(2);
    expect(r.needed).toBe(10);
    expect(r.total).toBe(13);
    expect(r.stunTrigger).toBe(false);
  });
  it("adds the Strength damage adjustment, never below 0", () => {
    expect(resolveMartialAttack({ ...base, strengthDamageAdj: 3 }).damage).toBe(5);
    expect(resolveMartialAttack({ ...base, naturalD20: 4, strengthDamageAdj: -2 }).damage).toBe(0);
  });
  it("applies the armor and weapon-size penalties to the roll", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 10, attackerArmorType: "chain-mail", opponentWeaponSize: "M" });
    expect(r.penalties).toEqual({ armor: -2, weaponSize: -2, situational: 0 });
    expect(r.attackBonus).toBe(-4);
    expect(r.total).toBe(6);
    expect(r.hit).toBe(false);
    expect(r.blow).toBeNull();
    expect(r.damage).toBe(0);
  });
  it("a natural 20 always hits and triggers the stun prompt", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 20, targetAc: -10, attackerArmorType: "full-plate" });
    expect(r.hit).toBe(true);
    expect(r.blow).toBe("headKick");
    expect(r.damage).toBe(4);
    expect(r.stunTrigger).toBe(true);
  });
  it("a natural 1 always misses", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 1, targetAc: 10, situationalModifier: 5 });
    expect(r.hit).toBe(false);
    expect(r.stunTrigger).toBe(false);
  });
  it("a forced hit (helpless target) hits regardless and still reads Table 16", () => {
    const r = resolveMartialAttack({ ...base, naturalD20: 2, targetAc: -10, forcedHit: true });
    expect(r.hit).toBe(true);
    expect(r.blow).toBe("graze");
    expect(r.damage).toBe(0);
  });
});
```

`tests/core/martial-arts/card.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildMartialCardContext, resolveMartialAttack } from "../../../src/core/martial-arts";

// needed = 18 - 10 = 8; bonus = -1 (armor) -4 (weapon) -1 (situational) = -6; total = 14 - 6 = 8 → a hit
const input = { naturalD20: 14, thac0: 18, targetAc: 10, attackerArmorType: "studded-leather", opponentWeaponSize: "L", situationalModifier: -1, strengthDamageAdj: 1 };

describe("buildMartialCardContext", () => {
  it("lists only the non-zero modifiers and the blow with its damage", () => {
    const ctx = buildMartialCardContext({
      actorName: "Akira", actorImg: "a.png", styleName: "Karate", targetName: "Ogre",
      result: resolveMartialAttack(input),
    });
    expect(ctx.breakdown).toEqual([
      { labelKey: "ADND2E.chat.martialArts.mod.armor", amount: -1 },
      { labelKey: "ADND2E.chat.martialArts.mod.weaponSize", amount: -4 },
      { labelKey: "ADND2E.chat.martialArts.mod.situational", amount: -1 },
    ]);
    expect(ctx.hit).toBe(true);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.hit");
    expect(ctx.blowKey).toBe("ADND2E.martialBlows.vitalsPunch");
    expect(ctx.damage).toBe(3);
    expect(ctx.targetName).toBe("Ogre");
  });
  it("a miss has no blow and the miss key", () => {
    const ctx = buildMartialCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveMartialAttack({ ...input, naturalD20: 2, attackerArmorType: "none", opponentWeaponSize: null, situationalModifier: 0 }),
    });
    expect(ctx.breakdown).toEqual([]);
    expect(ctx.hit).toBe(false);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.miss");
    expect(ctx.blowKey).toBe("");
    expect(ctx.damage).toBe(0);
  });
});
```

`tests/core/martial-arts/view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildMartialArtsView, type StyleItemLike } from "../../../src/core/martial-arts";

const style = (id: string, form: string, principalMethod: string, slotsInvested = 1): StyleItemLike => ({
  id, name: id, img: "", type: "martialStyle", system: { form, principalMethod, slotsInvested },
});
const base = { enabled: true, knowsBasics: true, storedActiveId: "", canAct: true };

describe("buildMartialArtsView", () => {
  it("lists only martialStyle items with derived stats and activates the first by default", () => {
    const v = buildMartialArtsView({
      ...base,
      items: [{ id: "w", name: "Sword", img: "", type: "weapon", system: {} }, style("karate", "hard", "strike"), style("sumo", "hardSoft", "push", 2)],
    });
    expect(v.visible).toBe(true);
    expect(v.styles.map((s) => s.id)).toEqual(["karate", "sumo"]);
    expect(v.styles[0]).toMatchObject({
      formKey: "ADND2E.martialForms.hard", methodKey: "ADND2E.martialMethods.strike", attackFormKey: "ADND2E.martialAttackForms.hand",
      acMod: -1, damageDie: "1d4", slots: 1, active: true,
    });
    expect(v.styles[1]).toMatchObject({ acMod: -2, damageDie: "1d2", slots: 2, active: false });
    expect(v.active?.id).toBe("karate");
    expect(v.canAttack).toBe(true);
  });
  it("honors a stored active id and defaults a missing slot count to 1", () => {
    const s = style("sumo", "hardSoft", "push");
    delete (s.system as { slotsInvested?: number }).slotsInvested;
    const v = buildMartialArtsView({ ...base, storedActiveId: "sumo", items: [style("karate", "hard", "strike"), s] });
    expect(v.active?.id).toBe("sumo");
    expect(v.styles[1]!.slots).toBe(1);
  });
  it("cannot attack with no style or when unable to act; hidden when the rule is off", () => {
    expect(buildMartialArtsView({ ...base, items: [] })).toMatchObject({ visible: true, active: null, canAttack: false, styles: [] });
    expect(buildMartialArtsView({ ...base, canAct: false, items: [style("karate", "hard", "strike")] }).canAttack).toBe(false);
    expect(buildMartialArtsView({ ...base, enabled: false, items: [] }).visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts`
Expected: FAIL — cannot resolve `src/core/martial-arts`.

- [ ] **Step 3: Write the implementation**

`src/core/martial-arts/style.ts`:
```ts
// PHBR15 ch.4, Table 18: a martial arts style's basics derive from its form and principal method. Pure.
export const STYLE_FORMS = ["hard", "soft", "hardSoft"] as const;
export type StyleForm = (typeof STYLE_FORMS)[number];

export const STYLE_METHODS = ["block", "kick", "lock", "movement", "push", "strike", "throw", "vitalArea", "weapon"] as const;
export type StyleMethod = (typeof STYLE_METHODS)[number];

export type PrincipalAttack = "hand" | "foot" | "body" | "legs" | "handFoot" | "handArm";

const FORM_AC: Readonly<Record<StyleForm, number>> = { hard: -1, soft: -3, hardSoft: -2 };
const FORM_DAMAGE: Readonly<Record<StyleForm, number>> = { hard: 2, soft: 0, hardSoft: 1 };
/** null = "by weapon" (the weapon's own damage). */
const METHOD_DAMAGE: Readonly<Record<StyleMethod, number | null>> = {
  block: 1, kick: 2, lock: 1, movement: 1, push: 1, strike: 2, throw: 1, vitalArea: 2, weapon: null,
};
const METHOD_ATTACK: Readonly<Record<StyleMethod, PrincipalAttack>> = {
  block: "hand", kick: "foot", lock: "body", movement: "legs", push: "hand", strike: "hand", throw: "body", vitalArea: "handFoot", weapon: "handArm",
};

/** Die sizes used in the game; 1 means a flat 1 hp. A Dmg Mod total rounds UP to the nearest. */
const DIE_SIZES = [1, 2, 3, 4, 6, 8, 10, 12, 20] as const;

export function damageDieFor(total: number): string {
  const size = DIE_SIZES.find((s) => s >= total) ?? 20;
  return size === 1 ? "1" : `1d${size}`;
}

export interface StyleStats {
  /** every style adds exactly one attack per round, only while unarmed */
  extraAttacks: 1;
  /** added to the character's AC, worn armor or not (negative = better) */
  acMod: number;
  damageMod: number | null;
  /** the style's basic unarmed damage die; null for a weapon-method style */
  damageDie: string | null;
  principalAttack: PrincipalAttack;
}

export function styleStats(form: StyleForm, method: StyleMethod): StyleStats {
  const methodDamage = METHOD_DAMAGE[method];
  const damageMod = methodDamage === null ? null : FORM_DAMAGE[form] + methodDamage;
  return {
    extraAttacks: 1,
    acMod: FORM_AC[form],
    damageMod,
    damageDie: damageMod === null ? null : damageDieFor(damageMod),
    principalAttack: METHOD_ATTACK[method],
  };
}

/** The style used this round: the stored id when still owned, else the first owned style, else "". */
export function resolveActiveStyleId(ids: readonly string[], stored: string): string {
  return ids.includes(stored) ? stored : (ids[0] ?? "");
}
```

`src/core/martial-arts/results.ts`:
```ts
// PHBR15 Table 16: martial arts results (replaces the Complete Fighter's Handbook table). Pure.
import { assertD20 } from "../errors";

export const BLOW_IDS = [
  "headKick", "headPunch", "vitalsKick", "vitalsPunch", "highKick", "sideKick", "bodyPunch", "lowKick", "graze",
] as const;
export type BlowId = (typeof BLOW_IDS)[number];

/** Highest threshold first; a roll takes the first row whose `min` it reaches. */
const TABLE_16: readonly { min: number; blow: BlowId; damage: number }[] = [
  { min: 19, blow: "headKick", damage: 4 },
  { min: 17, blow: "headPunch", damage: 3 },
  { min: 15, blow: "vitalsKick", damage: 3 },
  { min: 13, blow: "vitalsPunch", damage: 2 },
  { min: 11, blow: "highKick", damage: 2 },
  { min: 9, blow: "sideKick", damage: 2 },
  { min: 6, blow: "bodyPunch", damage: 1 },
  { min: 3, blow: "lowKick", damage: 1 },
  { min: 1, blow: "graze", damage: 0 },
];

/** The blow and its damage for the UNMODIFIED d20 of a successful attack. */
export function martialArtsResult(naturalD20: number): { blow: BlowId; damage: number } {
  assertD20(naturalD20);
  const row = TABLE_16.find((r) => naturalD20 >= r.min)!;
  return { blow: row.blow, damage: row.damage };
}
```

`src/core/martial-arts/modifiers.ts`:
```ts
// Attack penalties for an unarmed martial artist. Pure.
const ARMOR_ATTACK_PENALTY: Readonly<Record<string, number>> = {
  "studded-leather": -1,
  "ring-mail": -2, "scale-mail": -2, "chain-mail": -2, "elven-chain": -2,
  "splint-mail": -5, "banded-mail": -5, "plate-mail": -5,
  "field-plate": -8,
  "full-plate": -10,
};
const WEAPON_SIZE_PENALTY: Readonly<Record<string, number>> = { S: -1, M: -2, L: -4, G: -3, H: -1 };

const own = (table: Readonly<Record<string, number>>, key: string): number =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key]! : 0;

/** PHB Table 57: the penalty to the attack roll for the ATTACKER's own worn armor (unlisted types 0). */
export function armorAttackPenalty(armorType: string): number {
  return own(ARMOR_ATTACK_PENALTY, armorType);
}

/** PHBR15 Table 22: the penalty for facing an opponent's wielded weapon of this size (none/unknown 0). */
export function weaponSizePenalty(size: string | null): number {
  return size === null ? 0 : own(WEAPON_SIZE_PENALTY, size);
}
```

`src/core/martial-arts/attack.ts`:
```ts
// One unarmed martial arts attack: to-hit resolution plus the Table 16 blow. Pure.
import { hitResult } from "../combat/attack";
import { martialArtsResult, type BlowId } from "./results";
import { armorAttackPenalty, weaponSizePenalty } from "./modifiers";

export interface MartialAttackInput {
  naturalD20: number;
  /** the attacker's melee THAC0 (already includes the Strength to-hit adjustment) */
  thac0: number;
  targetAc: number;
  attackerArmorType: string;
  opponentWeaponSize: string | null;
  /** summed condition modifiers (blinded, fatigued, invisible target, ...) */
  situationalModifier: number;
  strengthDamageAdj: number;
  /** a helpless target is hit automatically */
  forcedHit?: boolean;
}

export interface MartialAttackResult {
  hit: boolean;
  naturalD20: number;
  needed: number;
  total: number;
  attackBonus: number;
  penalties: { armor: number; weaponSize: number; situational: number };
  blow: BlowId | null;
  tableDamage: number;
  /** Table 16 damage + Strength damage adjustment, minimum 0; 0 on a miss */
  damage: number;
  /** an unmodified 20: the target must save vs paralyzation or be stunned/incapacitated */
  stunTrigger: boolean;
}

export function resolveMartialAttack(input: MartialAttackInput): MartialAttackResult {
  const penalties = {
    armor: armorAttackPenalty(input.attackerArmorType),
    weaponSize: weaponSizePenalty(input.opponentWeaponSize),
    situational: input.situationalModifier,
  };
  const attackBonus = penalties.armor + penalties.weaponSize + penalties.situational;
  const base = hitResult({ naturalD20: input.naturalD20, attackBonus, thac0: input.thac0, targetAc: input.targetAc });
  const hit = input.forcedHit === true ? true : base.hit;
  const row = hit ? martialArtsResult(input.naturalD20) : null;
  const tableDamage = row?.damage ?? 0;
  return {
    hit,
    naturalD20: input.naturalD20,
    needed: base.needed,
    total: base.total,
    attackBonus,
    penalties,
    blow: row?.blow ?? null,
    tableDamage,
    damage: hit ? Math.max(0, tableDamage + input.strengthDamageAdj) : 0,
    stunTrigger: input.naturalD20 === 20,
  };
}
```

`src/core/martial-arts/card.ts`:
```ts
// Chat-card context for a martial arts attack (SP18). Pure.
import type { MartialAttackResult } from "./attack";

export interface MartialCardInput {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  result: MartialAttackResult;
}

export interface MartialCardContext {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  natural: number;
  total: number;
  needed: number;
  hit: boolean;
  breakdown: { labelKey: string; amount: number }[];
  resultKey: string;
  blowKey: string;
  damage: number;
  stunTrigger: boolean;
}

export function buildMartialCardContext(input: MartialCardInput): MartialCardContext {
  const r = input.result;
  const rows: [string, number][] = [
    ["ADND2E.chat.martialArts.mod.armor", r.penalties.armor],
    ["ADND2E.chat.martialArts.mod.weaponSize", r.penalties.weaponSize],
    ["ADND2E.chat.martialArts.mod.situational", r.penalties.situational],
  ];
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    styleName: input.styleName,
    targetName: input.targetName,
    natural: r.naturalD20,
    total: r.total,
    needed: r.needed,
    hit: r.hit,
    breakdown: rows.filter(([, amount]) => amount !== 0).map(([labelKey, amount]) => ({ labelKey, amount })),
    resultKey: r.hit ? "ADND2E.chat.martialArts.hit" : "ADND2E.chat.martialArts.miss",
    blowKey: r.blow ? `ADND2E.martialBlows.${r.blow}` : "",
    damage: r.damage,
    stunTrigger: r.hit && r.stunTrigger,
  };
}
```

`src/core/martial-arts/view.ts`:
```ts
// The PC sheet's Martial Arts panel view. Pure: Foundry glue passes plain item data in.
import { resolveActiveStyleId, styleStats, type StyleForm, type StyleMethod } from "./style";

export interface StyleItemLike {
  id: string;
  name: string;
  img: string;
  type: string;
  system: { form?: string; principalMethod?: string; slotsInvested?: number };
}

export interface StyleRow {
  id: string;
  name: string;
  img: string;
  formKey: string;
  methodKey: string;
  attackFormKey: string;
  acMod: number;
  /** null for a weapon-method style (its weapon's own damage) */
  damageDie: string | null;
  slots: number;
  active: boolean;
}

export interface MartialArtsView {
  visible: boolean;
  knowsBasics: boolean;
  canAct: boolean;
  canAttack: boolean;
  styles: StyleRow[];
  active: StyleRow | null;
}

export function buildMartialArtsView(input: {
  enabled: boolean;
  items: Iterable<StyleItemLike>;
  knowsBasics: boolean;
  storedActiveId: string;
  canAct: boolean;
}): MartialArtsView {
  const owned = [...input.items].filter((i) => i.type === "martialStyle");
  const activeId = resolveActiveStyleId(owned.map((i) => i.id), input.storedActiveId);
  const styles = owned.map((i): StyleRow => {
    const form = i.system.form as StyleForm;
    const method = i.system.principalMethod as StyleMethod;
    const stats = styleStats(form, method);
    return {
      id: i.id,
      name: i.name,
      img: i.img,
      formKey: `ADND2E.martialForms.${form}`,
      methodKey: `ADND2E.martialMethods.${method}`,
      attackFormKey: `ADND2E.martialAttackForms.${stats.principalAttack}`,
      acMod: stats.acMod,
      damageDie: stats.damageDie,
      slots: i.system.slotsInvested ?? 1,
      active: i.id === activeId,
    };
  });
  const active = styles.find((s) => s.active) ?? null;
  return {
    visible: input.enabled,
    knowsBasics: input.knowsBasics,
    canAct: input.canAct,
    canAttack: input.canAct && active !== null,
    styles,
    active,
  };
}
```

`src/core/martial-arts/index.ts`:
```ts
export * from "./style";
export * from "./results";
export * from "./modifiers";
export * from "./attack";
export * from "./card";
export * from "./view";
```

`src/core/index.ts`: add `export * from "./martial-arts";` after the `./tracking` line.

Spec amendments — append to the end of the spec file:
```markdown

## Amendments made at plan time (2026-10-12)

- The 2-slots-per-level cap and `levelLearned` move to Plan B, where maneuvers are actually bought; Plan A stores `slotsInvested` only.
- Owned styles always count into the weapon-slot sum (a style only exists if someone added it); the setting gates the panel and the AC modifier only.
- Stun/incapacitate is a card prompt stating the rule; no automated target save.
- There is no "pull" option; the player does not press Apply.
- The panel is PC-only (the Character NPC sheet is unchanged, as with SP20 tracking) and lives on the Main tab beside Wrestle, with the owned styles listed inside it.
- The active style's AC modifier is applied through derived AC (snapshot -> `deriveAc`), gated by the setting.
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/core/martial-arts tests/core/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.
```bash
git add src/core/martial-arts src/core/index.ts tests/core/martial-arts docs/superpowers/specs/2026-10-12-adnd2e-sp18a-martial-arts-styles-design.md
git commit -m "feat(martial-arts): pure style, Table 16 results, penalties, attack, card and view (SP18 Plan A)"
```
(End the commit message with the Co-Authored-By line.)

---

### Task 2: `martialStyle` item subtype, actor field and the rule setting

**Files:**
- Create: `src/data/item/martial-style.ts`
- Modify: `src/data/item/choices.ts` (append the two vocabularies)
- Modify: `src/data/item/index.ts` (import, export, `ITEM_DATA_MODELS`)
- Modify: `src/data/item/subtypes.ts` (type union, `ITEM_SUBTYPES`, header comment "fifteen")
- Modify: `system.json` (`documentTypes.Item.martialStyle`; the `martial-styles` pack entry and a "Martial Arts" pack folder are added in Task 4)
- Modify: `src/data/actor/base-actor.ts` (`martialArts` field after `tracking`)
- Modify: `src/core/options.ts` (`advancedMartialArts` in the interface and defaults)
- Modify: `src/settings/registry.ts` (descriptor), `src/settings/sections.ts` (section), `src/types/global.d.ts` (`"adnd2e.advancedMartialArts": boolean;`)
- Modify: `lang/en.json` (see Step 3)
- Modify: `src/sheets/item-layouts/labels.ts` (two map entries)
- Modify tests: `tests/config/system-json.test.ts`, `tests/data/subtypes.test.ts`, `tests/core/options.test.ts`, `tests/settings/registry.test.ts`, `tests/settings/sections.test.ts`, `tests/lang/en-coverage.test.ts`
- Create: `tests/data/martial-style-model.test.ts`

**Interfaces — consumes:** `STYLE_FORMS`, `STYLE_METHODS` (Task 1). **Produces:** item type `"martialStyle"` with `system.{form, principalMethod, slotsInvested, availableManeuvers, weaponGroups}`; actor `system.martialArts.{knowsBasics, activeStyleId}`; `OptionalRules.advancedMartialArts`; setting key `advancedMartialArts`.

- [ ] **Step 1: Write the failing tests**

`tests/data/martial-style-model.test.ts` (source-pinned, like `power-model.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STYLE_FORMS, STYLE_METHODS } from "../../src/core/martial-arts";
import { MARTIAL_STYLE_FORMS, MARTIAL_STYLE_METHODS } from "../../src/data/item/choices";

const read = (...p: string[]) => readFileSync(path.resolve(__dirname, "..", "..", ...p), "utf8");
const SRC = read("src", "data", "item", "martial-style.ts");
const INDEX = read("src", "data", "item", "index.ts");
const ACTOR = read("src", "data", "actor", "base-actor.ts");
const line = (src: string, field: string) => src.split("\n").find((l) => new RegExp("^\\s*" + field + ":\\s*new ").test(l)) ?? "";

describe("MartialStyleItemModel schema (source-pinned)", () => {
  it("is registered", () => {
    expect(INDEX).toContain("martialStyle: MartialStyleItemModel");
  });
  it("defaults to a hard strike style with one slot", () => {
    expect(line(SRC, "form")).toContain('initial: "hard"');
    expect(line(SRC, "form")).toContain("choices: MARTIAL_STYLE_FORMS");
    expect(line(SRC, "principalMethod")).toContain('initial: "strike"');
    expect(line(SRC, "principalMethod")).toContain("choices: MARTIAL_STYLE_METHODS");
    expect(line(SRC, "slotsInvested")).toMatch(/integer: true, min: 1, initial: 1/);
  });
  it("uses function initials for its arrays (shared-literal gotcha)", () => {
    expect(SRC).not.toMatch(/initial: [[{]/);
    expect(SRC.match(/initial: \(\) => \[\]/g)!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("martial arts vocabularies and actor field", () => {
  it("re-exports the pure vocabularies", () => {
    expect([...MARTIAL_STYLE_FORMS]).toEqual([...STYLE_FORMS]);
    expect([...MARTIAL_STYLE_METHODS]).toEqual([...STYLE_METHODS]);
  });
  it("the actor common schema carries martialArts with defaults only", () => {
    expect(ACTOR).toMatch(/martialArts: new SchemaField\(/);
    expect(ACTOR).toMatch(/knowsBasics: new BooleanField\(\{ required: true, initial: false \}\)/);
    expect(ACTOR).toMatch(/activeStyleId: new StringField\(\{ required: true, blank: true, initial: "" \}\)/);
  });
});
```

Update existing tests (each is a small edit; run the file first and fix what it reports):
- `tests/config/system-json.test.ts`: the Item subtype list gains `"martialStyle"` (sorted position: after `"kit"`), the title says "fifteen". (Pack count assertions change in Task 4, not here.)
- `tests/data/subtypes.test.ts`: the "has fourteen entries ending with power" test becomes fifteen entries ending with `martialStyle`; the new subtype is appended LAST in `ITEM_SUBTYPES`.
- `tests/core/options.test.ts`: add `"advancedMartialArts"` to the sorted key list (near line 33) and `advancedMartialArts: false` to the defaults object (near line 73).
- `tests/settings/registry.test.ts`: `toHaveLength(29)` → `30`; the reload list gains `"advancedMartialArts"` (rename the test "exactly the twelve prepare-time rules require a world reload").
- `tests/settings/sections.test.ts`: run it; if it enumerates section ids, add `martialArts`.
- `tests/lang/en-coverage.test.ts`: add `"ADND2E.settings.advancedMartialArts.name"` and `".hint"` next to the `wildTalents` pair (near line 858); add `"ADND2E.settings.sections.martialArts"` wherever the other section ids are listed (grep `sections.psionics`).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/martial-style-model.test.ts tests/data/subtypes.test.ts tests/core/options.test.ts tests/settings tests/config`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/data/item/choices.ts` — append:
```ts
/** SP18 Plan A: martial arts styles (PHBR15 Table 18). */
import { STYLE_FORMS, STYLE_METHODS } from "../../core/martial-arts";
export const MARTIAL_STYLE_FORMS: readonly string[] = STYLE_FORMS;
export const MARTIAL_STYLE_METHODS: readonly string[] = STYLE_METHODS;
```
(If an `import` mid-file offends the lint config, move the import to the top import block of the file.)

`src/data/item/martial-style.ts`:
```ts
import { Adnd2eItemModel } from "./base-item";
import { MARTIAL_STYLE_FORMS, MARTIAL_STYLE_METHODS } from "./choices";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

/**
 * SP18 Plan A: a martial arts style (PHBR15 ch.4). AC mod, damage die and principal attack DERIVE from `form` and
 * `principalMethod` (core/martial-arts `styleStats`); only the choices are stored. `availableManeuvers` and
 * `weaponGroups` are data-only in Plan A (Table 17's lists, used by Plan B).
 */
export class MartialStyleItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      form: new StringField({ required: true, blank: false, initial: "hard", choices: MARTIAL_STYLE_FORMS }),
      principalMethod: new StringField({ required: true, blank: false, initial: "strike", choices: MARTIAL_STYLE_METHODS }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      availableManeuvers: new ArrayField(
        new SchemaField({
          list: new StringField({ required: true, blank: false }),
          difficulties: new ArrayField(new NumberField({ required: true, integer: true, min: 1 }), { required: true, initial: () => [] }),
        }),
        { required: true, initial: () => [] },
      ),
      weaponGroups: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: () => [] }),
    };
  }
}
```

`src/data/item/index.ts`: `import { MartialStyleItemModel } from "./martial-style";`, add `MartialStyleItemModel,` to the export list and `martialStyle: MartialStyleItemModel,` to `ITEM_DATA_MODELS`.

`src/data/item/subtypes.ts`: add `| "martialStyle"` to the union, `"martialStyle",` last in `ITEM_SUBTYPES`, and change the header comment to "fifteen".

`system.json`: in `documentTypes.Item` add `"martialStyle": {}` after `"power": {}` (mind the comma on `"power": {}`).

`src/data/actor/base-actor.ts` — after the `tracking` field:
```ts
    /** SP18 Plan A: Advanced Martial Arts (PHBR15). `knowsBasics` = the character knows basic martial arts (the prerequisite for learning a style); `activeStyleId` = the owned martialStyle item used this round ("" = the first owned style). Defaults only, no migration. */
    martialArts: new SchemaField({
      knowsBasics: new BooleanField({ required: true, initial: false }),
      activeStyleId: new StringField({ required: true, blank: true, initial: "" }),
    }),
```

`src/core/options.ts`: interface — after `wrestling`:
```ts
  /** SP18 Plan A: PHBR15 Advanced Martial Arts — martial arts styles, the unarmed attack and the style AC modifier. */
  advancedMartialArts: boolean;
```
defaults — `advancedMartialArts: false,`.

`src/settings/registry.ts` — after the `wildTalents` line:
```ts
  { key: "advancedMartialArts", group: "core", default: false, config: true, optionalRulesKey: "advancedMartialArts", requiresReload: true },
```
`src/settings/sections.ts` — after the `psionics` line:
```ts
  { id: "martialArts", kind: "optional", keys: ["advancedMartialArts"] },
```
`src/types/global.d.ts` — after `"adnd2e.wildTalents": boolean;`: `"adnd2e.advancedMartialArts": boolean;`.

`src/sheets/item-layouts/labels.ts` — add to `CHOICE_LABEL_MAPS`:
```ts
  "system.form": "martialForms",
  "system.principalMethod": "martialMethods",
```

`lang/en.json` (match the file's nesting; keys are siblings of the existing ones named in each bullet):
- Item type label, next to `"power": "Psionic Power"`: `"martialStyle": "Martial Arts Style"`.
- Settings, next to `wildTalents`: `"advancedMartialArts": { "name": "Advanced martial arts", "hint": "Characters can learn martial arts styles (Complete Ninja's Handbook). Adds a Martial Arts panel with an unarmed attack, and the active style's AC modifier. Needs a reload." }`.
- `settings.sections.martialArts`: `"Martial Arts"`.
- Top-level `ADND2E` maps (siblings of `trackingTerrains`):
  - `martialForms`: `hard` "Hard", `soft` "Soft", `hardSoft` "Hard/Soft".
  - `martialMethods`: `block` "Block", `kick` "Kick", `lock` "Lock", `movement` "Movement", `push` "Push", `strike` "Strike", `throw` "Throw", `vitalArea` "Vital area", `weapon` "Weapon".
  - `martialAttackForms`: `hand` "Hand", `foot` "Foot", `body` "Body", `legs` "Legs", `handFoot` "Hand/Foot", `handArm` "Hand/Arm".
  - `martialBlows`: `headKick` "Head kick", `headPunch` "Head punch", `vitalsKick` "Vitals kick", `vitalsPunch` "Vitals punch", `highKick` "High kick", `sideKick` "Side kick", `bodyPunch` "Body punch", `lowKick` "Low kick", `graze` "Graze".

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/data tests/core tests/settings tests/config tests/lang tests/sheets/item-layouts`
Expected: PASS. (`tests/packs` is untouched until Task 4.)

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
```bash
git add -A src system.json lang tests
git commit -m "feat(martial-arts): martialStyle item type, actor field and advancedMartialArts setting (SP18 Plan A)"
```

---

### Task 3: Slot sum and the style AC modifier in derivation

**Files:**
- Modify: `src/data/derive/character/ac.ts` (`situationalModifier`)
- Modify: `src/data/derive/character/snapshot.ts` (`martialArtsAcMod?: number` on `ActorSnapshot`)
- Modify: `src/data/derive/character/derive.ts` (pass the modifier to `deriveAc`, gated by the option)
- Modify: `src/data/actor/snapshot.ts` (slot sum includes styles; compute `martialArtsAcMod`)
- Modify: `tests/data/derive/character/ac.test.ts`
- Create: `tests/data/derive/character/martial-arts-ac.test.ts`

**Interfaces — consumes:** `styleStats`, `resolveActiveStyleId` (Task 1); `OptionalRules.advancedMartialArts` (Task 2). **Produces:** `AcInput.situationalModifier?: number` (negative improves); `ActorSnapshot.martialArtsAcMod?: number`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/data/derive/character/ac.test.ts`:
```ts
describe("deriveAc — situational modifier", () => {
  it("a negative modifier improves every AC variant", () => {
    const ac = deriveAc({ equippedArmor: { baseArmorAc: 5, magicBonus: 0 }, equippedShield: null, dexDefensiveAdj: 0, situationalModifier: -2 });
    expect(ac).toEqual({ normal: 3, shieldless: 3, surprised: 3, rearAttack: 3 });
  });
  it("absent means 0", () => {
    expect(deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: 0 }).normal).toBe(10);
  });
});
```

`tests/data/derive/character/martial-arts-ac.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";

const ON = { ...DEFAULT_OPTIONAL_RULES, advancedMartialArts: true };

const fighter: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [{ chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [8], dualClassState: null, level: 1 }],
  equippedArmor: null,
  equippedShield: null,
  carriedWeight: 0,
  wizardMemorized: [],
  priestMemorized: [],
  spentWeaponSlots: 0,
  spentNonweaponSlots: 0,
  baseMovement: 12,
  thiefSkillAllocations: [],
  traits: [],
  isCasting: false,
};

describe("deriveCharacter — the active martial arts style's AC modifier", () => {
  it("applies the modifier to every AC variant while the rule is on", () => {
    const ac = deriveCharacter({ ...fighter, martialArtsAcMod: -3 }, ON).ac;
    expect(ac).toEqual({ normal: 7, shieldless: 7, surprised: 7, rearAttack: 7 });
  });
  it("is clamped at the AC floor like any other AC", () => {
    expect(deriveCharacter({ ...fighter, martialArtsAcMod: -30 }, ON).ac.normal).toBe(-10);
  });
  it("does nothing while the rule is off or the modifier is absent", () => {
    expect(deriveCharacter({ ...fighter, martialArtsAcMod: -3 }, DEFAULT_OPTIONAL_RULES).ac.normal).toBe(10);
    expect(deriveCharacter(fighter, ON).ac.normal).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/derive/character/ac.test.ts tests/data/derive/character/martial-arts-ac.test.ts`
Expected: FAIL (`situationalModifier` is not part of `AcInput`; the AC stays 10).

- [ ] **Step 3: Write the implementation**

`src/data/derive/character/ac.ts` — add to `AcInput`:
```ts
  /** SP18: added directly to AC (negative improves) — the active martial arts style's modifier */
  situationalModifier?: number;
```
and change the `common` line to:
```ts
  const common = { baseArmorAc, shieldBonus, dexDefensiveAdj: input.dexDefensiveAdj, situationalModifier: input.situationalModifier ?? 0 };
```

`src/data/derive/character/snapshot.ts` — on `ActorSnapshot`, after `isCasting`:
```ts
  /** SP18 Plan A: the active martial arts style's AC modifier (negative = better; absent = none) — applied only while `advancedMartialArts` is on */
  martialArtsAcMod?: number;
```

`src/data/derive/character/derive.ts` — in the `deriveAc({...})` call (the one at "§5.6 step 6 — AC"), add the argument:
```ts
    // SP18 Plan A: the active martial arts style's AC modifier (rule-gated)
    situationalModifier: options.advancedMartialArts ? (snapshot.martialArtsAcMod ?? 0) : 0,
```

`src/data/actor/snapshot.ts`:
- add `import { resolveActiveStyleId, styleStats, type StyleForm, type StyleMethod } from "../../core/martial-arts";`
- extend the `doc.system` cast with `martialArts?: { activeStyleId?: string };`
- replace the `spentWeaponSlots` computation with:
```ts
  // SP18: an owned martial arts style spends weapon-proficiency slots like a weapon proficiency
  const spentWeaponSlots = items
    .filter((i) => i.type === "weaponProficiency" || i.type === "martialStyle")
    .reduce((s, i) => s + (i.system as ProfItemSystem).slotsInvested, 0);
```
- before the `return {`, add:
```ts
  const styles = items.filter((i) => i.type === "martialStyle") as unknown as { id: string; system: { form: StyleForm; principalMethod: StyleMethod } }[];
  const activeStyleId = resolveActiveStyleId(styles.map((s) => s.id), doc.system.martialArts?.activeStyleId ?? "");
  const activeStyle = styles.find((s) => s.id === activeStyleId);
  const martialArtsAcMod = activeStyle ? styleStats(activeStyle.system.form, activeStyle.system.principalMethod).acMod : 0;
```
- and in the returned object, after `isCasting: ...,` add `martialArtsAcMod,`.

(`items` in this file is already the array built earlier in `snapshotActor`; if it is a lazily typed iterable, use the same local the `spentWeaponSlots` code uses.)

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/data`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
```bash
git add src tests
git commit -m "feat(martial-arts): count style slots and fold the active style's AC modifier into derived AC (SP18 Plan A)"
```

---

### Task 4: The `martial-styles` compendium pack

**Files:**
- Create: `packs/martial-styles/_source/*.json` (8 files, generated by the script below)
- Modify: `system.json` (pack entry; "Martial Arts" pack folder)
- Modify: `tests/config/system-json.test.ts` (pack count 9 → 10, names list gains `"martial-styles"`)
- Modify: `tests/packs/content.test.ts` (new `describe`)
- Check: `tests/packs/source.test.ts` (generic; run it)

**Interfaces — consumes:** the `martialStyle` schema (Task 2), `styleStats` (Task 1).

- [ ] **Step 1: Write the failing test**

Append to `tests/packs/content.test.ts` (reuse the file's existing `docs(pack)` and `sys(d)` helpers, as the `kits pack content` block does):
```ts
describe("martial-styles pack content", () => {
  const items = docs("martial-styles");
  const NAMES = ["Aikijutsu", "Atemi", "Jujutsu", "Karate", "Kung Fu", "Ninjutsu", "Sumo", "Tae Kwon Do"];

  it("has the eight Table 17 styles, uniquely named and identified", () => {
    expect(items.map((d) => String(d.name)).sort()).toEqual([...NAMES].sort());
    expect(new Set(items.map((d) => String(d._id))).size).toBe(8);
    for (const d of items) expect(d.type, String(d.name)).toBe("martialStyle");
  });

  it("every style's forms and methods are from the vocabularies and each carries a maneuver list", () => {
    for (const d of items) {
      const s = sys(d) as { form: string; principalMethod: string; slotsInvested: number; availableManeuvers: { list: string; difficulties: number[] }[]; weaponGroups: string[] };
      expect(STYLE_FORMS, String(d.name)).toContain(s.form);
      expect(STYLE_METHODS, String(d.name)).toContain(s.principalMethod);
      expect(s.slotsInvested).toBe(1);
      expect(s.availableManeuvers.length, String(d.name)).toBeGreaterThan(0);
      for (const m of s.availableManeuvers) expect(m.difficulties.length).toBeGreaterThan(0);
    }
  });

  it("derives Table 17's AC and damage die for every style", () => {
    const expected: Record<string, [number, string]> = {
      Aikijutsu: [-3, "1"], Atemi: [-1, "1d4"], Jujutsu: [-2, "1d2"], Karate: [-1, "1d4"],
      "Kung Fu": [-2, "1d3"], Ninjutsu: [-2, "1d2"], Sumo: [-2, "1d2"], "Tae Kwon Do": [-1, "1d4"],
    };
    for (const d of items) {
      const s = sys(d) as { form: StyleForm; principalMethod: StyleMethod };
      const stats = styleStats(s.form, s.principalMethod);
      expect([stats.acMod, stats.damageDie], String(d.name)).toEqual(expected[String(d.name)]);
    }
  });
});
```
Add the import `import { STYLE_FORMS, STYLE_METHODS, styleStats, type StyleForm, type StyleMethod } from "../../src/core/martial-arts";` at the top of the file.

In `tests/config/system-json.test.ts`: the pack count `toHaveLength(9)` → `10` (test title "ships the 10 Item compendium packs") and add `"martial-styles"` to the sorted names list (between `"kits"` and `"nonweapon-proficiencies"`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/packs tests/config`
Expected: FAIL (no pack docs; the pack count is still 9).

- [ ] **Step 3: Generate the pack source**

Write this script to the scratchpad directory (not the repo) and run it from the repo root with `node <scratchpad>/gen-martial-styles.mjs`:
```js
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = path.join("packs", "martial-styles", "_source");
mkdirSync(dir, { recursive: true });

// [file slug, name, form, principalMethod, maneuver lists, weapon groups, own-wording description]
const STYLES = [
  ["aikijutsu", "Aikijutsu", "soft", "throw",
    [["lock", [1, 2, 3]], ["block", [1, 2, 3, 4]], ["movement", [1, 3]], ["throw", [1, 2, 3, 4]], ["mental", [1, 2, 3, 4, 5]]],
    ["Staves", "Fencing Blades", "Oriental Blades", "Medium Blades"],
    "A defensive Japanese style built on evasion and throws."],
  ["atemi", "Atemi", "hard", "vitalArea",
    [["block", [1, 2]], ["movement", [1]], ["push", [3]], ["strike", [1]], ["vitalArea", [1, 2, 3]]],
    ["Clubbing Weapons", "Staves"],
    "A hard style that targets an opponent's vital points."],
  ["jujutsu", "Jujutsu", "hardSoft", "lock",
    [["lock", [1, 2, 3, 4]], ["throw", [1, 2, 3, 4]], ["movement", [1, 3]], ["vitalArea", [1, 2]], ["mental", [1, 2, 3]]],
    ["Fencing Blades", "Oriental Blades", "Medium Blades"],
    "A grappling style of locks and throws with some strikes."],
  ["karate", "Karate", "hard", "strike",
    [["strike", [1, 2, 3]], ["kick", [1]], ["block", [1, 2]], ["movement", [1]], ["mental", [1, 4]]],
    ["Karate Weapons"],
    "An empty-hand striking style from Okinawa."],
  ["kung-fu", "Kung Fu", "hardSoft", "strike",
    [["lock", [1]], ["strike", [1, 2]], ["kick", [2]], ["block", [1, 2, 3, 4]], ["mental", [4, 6]]],
    ["Any Tight Group of Melee Weapons"],
    "A broad family of Chinese styles mixing hard and soft technique."],
  ["ninjutsu", "Ninjutsu", "hardSoft", "movement",
    [["kick", [1, 3]], ["lock", [1, 3]], ["movement", [1, 2, 4]], ["strike", [1]], ["throw", [1, 2]], ["block", [1, 3, 4]], ["mental", [2, 4]]],
    ["Short Blades", "Oriental Blades", "Chain Weapons", "Rope Weapons"],
    "The deceptive style of the ninja: throw an opponent down, then get away."],
  ["sumo", "Sumo", "hardSoft", "push",
    [["lock", [2]], ["movement", [3]], ["push", [1, 2]], ["throw", [1, 3]], ["block", [1]]],
    [],
    "Japanese wrestling of shoves, slaps and throws."],
  ["tae-kwon-do", "Tae Kwon Do", "hard", "kick",
    [["kick", [1, 2, 3]], ["strike", [1]], ["throw", [4]], ["block", [1, 2]], ["movement", [4]]],
    ["Medium Blades", "Staves", "Clubbing Weapons"],
    "A hard Korean style that emphasizes punching and kicking."],
];

for (const [slug, name, form, principalMethod, lists, weaponGroups, description] of STYLES) {
  const id = ("kMs" + name.replace(/\s+/g, "")).slice(0, 15).padEnd(15, "0") + "1";
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name,
    type: "martialStyle",
    img: "icons/svg/combat.svg",
    system: {
      description,
      form,
      principalMethod,
      slotsInvested: 1,
      availableManeuvers: lists.map(([list, difficulties]) => ({ list, difficulties })),
      weaponGroups,
    },
  };
  writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
}
console.log(`wrote ${STYLES.length} style files to ${dir}`);
```
Expected output: `wrote 8 style files to packs\martial-styles\_source`. Open one generated file and confirm the `_id` is 16 characters and `_key` matches.

`system.json` — add to `packs`:
```json
    { "name": "martial-styles", "label": "Martial Arts Styles", "path": "packs/martial-styles", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } }
```
and to `packFolders[0].folders` (the list holding "Psionics"): `{ "name": "Martial Arts", "sorting": "a", "packs": ["martial-styles"] }`. Mind the commas.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/packs tests/config`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packs/martial-styles system.json tests
git commit -m "feat(martial-arts): the eight Table 17 styles in a martial-styles compendium (SP18 Plan A)"
```

---

### Task 5: Sheet glue — panel, attack roll, chat card, drop rule

**Files:**
- Create: `src/sheets/character/martial-arts-actions.ts`
- Create: `templates/chat/martial-arts-attack.hbs`
- Modify: `src/sheets/character/sheet.ts` (import; `DEFAULT_OPTIONS.actions` `martialArtsAttack`, `useMartialStyle`; `_prepareContext` key `martialArts`; two static handlers; drop handling)
- Modify: `src/sheets/character/drop-rules.ts` (martialStyle rule)
- Modify: `templates/actor/pc/partials/pc-main-panels.hbs` (panel after the Wrestle block)
- Modify: `lang/en.json` (`ADND2E.sheet.martialArts.*`, `ADND2E.chat.martialArts.*`, `ADND2E.sheet.drop.styleNeedsBasics`, `ADND2E.sheet.drop.styleDuplicate`)
- Modify: `tests/styles/chat-classes.test.ts` (template count 17 → 18; "finds all eighteen chat templates")
- Modify: `tests/sheets/character/drop-rules.test.ts` (new cases; the file name may differ — `grep -rln validateItemDrop tests`)
- Create: `tests/templates/martial-arts-bindings.test.ts`

**Interfaces — consumes:** everything from Task 1; `resolveTargetCombatInfo`, `resolveTargetArmorType` from `./combat-rolls`; `getOptionalRules` from `../../settings`. **Produces:** `martialArtsView(actor)`, `setActiveStyle(actor, itemId)`, `rollMartialArtsAttack(actor)`.

- [ ] **Step 1: Write the failing tests**

Add to the drop-rules test file:
```ts
describe("validateItemDrop — martial arts styles (SP18)", () => {
  const base = { dropType: "martialStyle", hasRace: false, existingChassisIds: [] as string[] };
  it("requires basic martial arts", () => {
    expect(validateItemDrop({ ...base, knowsBasicMartialArts: false })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.styleNeedsBasics" });
  });
  it("rejects a style the character already owns", () => {
    expect(validateItemDrop({ ...base, knowsBasicMartialArts: true, dropStyleName: "Karate", existingStyleNames: ["Karate"] })).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.styleDuplicate",
    });
  });
  it("accepts a new style", () => {
    expect(validateItemDrop({ ...base, knowsBasicMartialArts: true, dropStyleName: "Sumo", existingStyleNames: ["Karate"] })).toEqual({ ok: true });
    expect(validateItemDrop({ ...base, knowsBasicMartialArts: true, dropStyleName: "Sumo" })).toEqual({ ok: true });
  });
});
```

`tests/templates/martial-arts-bindings.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const MAIN = read("templates", "actor", "pc", "partials", "pc-main-panels.hbs");
const CHAT = read("templates", "chat", "martial-arts-attack.hbs");
const SHEET = read("src", "sheets", "character", "sheet.ts");
const NPC_SHEET = read("src", "sheets", "npc", "sheet.ts");
const ACTIONS = read("src", "sheets", "character", "martial-arts-actions.ts");
const CARD = read("src", "core", "martial-arts", "card.ts");
const LANG = JSON.parse(read("lang", "en.json")) as Record<string, unknown>;

const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);
const keysIn = (src: string, re: RegExp): string[] => [...new Set([...src.matchAll(re)].map((m) => m[0]))];

describe("martial arts bindings (SP18 Plan A)", () => {
  it("the panel is PC-only, rule-gated, with Attack and a Use button per style", () => {
    expect(MAIN).toMatch(/@root\.pcActions[\s\S]*@root\.martialArts\.visible[\s\S]*data-action="martialArtsAttack"/);
    const attack = MAIN.split(/\r?\n/).find((l) => l.includes('data-action="martialArtsAttack"'))!;
    expect(attack.match(/disabled/g)).toHaveLength(1);
    expect(attack).toContain("martialArts.canAttack");
    expect(MAIN).toContain('data-action="useMartialStyle"');
    expect(MAIN).toContain('name="system.martialArts.knowsBasics"');
  });
  it("the PC sheet registers both actions; the Character NPC sheet sets neither pcActions nor martialArts", () => {
    expect(SHEET).toMatch(/^\s+martialArtsAttack: Adnd2eCharacterSheet\.#on/m);
    expect(SHEET).toMatch(/^\s+useMartialStyle: Adnd2eCharacterSheet\.#on/m);
    expect(NPC_SHEET).not.toMatch(/context\.(pcActions|martialArts)\s*=/);
  });
  it("every sheet, chat and drop key used exists in lang/en.json", () => {
    const keys = new Set([
      ...keysIn(MAIN, /ADND2E\.sheet\.martialArts\.[A-Za-z]+/g),
      ...keysIn(ACTIONS, /ADND2E\.(sheet|chat)\.martialArts\.[A-Za-z]+/g),
      ...keysIn(CHAT, /ADND2E\.chat\.martialArts\.[A-Za-z]+/g),
      ...keysIn(CARD, /ADND2E\.chat\.martialArts\.(?:mod\.)?[A-Za-z]+/g),
      "ADND2E.sheet.drop.styleNeedsBasics", "ADND2E.sheet.drop.styleDuplicate",
    ]);
    expect(keys.size).toBeGreaterThan(10);
    for (const key of keys) expect(typeof lookup(key), key).toBe("string");
  });
  it("the card reuses the generic applyDamage action", () => {
    expect(CHAT).toContain('data-action="applyDamage"');
    expect(CHAT).toContain('data-amount="{{damage}}"');
  });
  it("the manual-AC prompt goes through themedPrompt, never DialogV2 directly", () => {
    expect(ACTIONS).toContain("themedPrompt");
    expect(ACTIONS).not.toContain("DialogV2");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sheets tests/templates tests/styles`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/sheets/character/drop-rules.ts` — add to `DropCheckInput`:
```ts
  /** martialStyle drops: does the character know basic martial arts (the PHBR15 prerequisite) */
  knowsBasicMartialArts?: boolean;
  /** martialStyle drops: the dropped style's name and the names of owned styles */
  dropStyleName?: string;
  existingStyleNames?: readonly string[];
```
and in `validateItemDrop`, before the `spell` branch:
```ts
  if (input.dropType === "martialStyle") {
    if (!input.knowsBasicMartialArts) return { ok: false, reason: "ADND2E.sheet.drop.styleNeedsBasics" };
    if ((input.existingStyleNames ?? []).includes(input.dropStyleName ?? "")) return { ok: false, reason: "ADND2E.sheet.drop.styleDuplicate" };
    return { ok: true };
  }
```

`templates/chat/martial-arts-attack.hbs`:
```hbs
<div class="adnd2e chat-card martial-arts-attack">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{styleName}}</h3>
  </header>
  {{#if targetName}}<p class="hint">{{localize 'ADND2E.chat.martialArts.against' target=targetName}}</p>{{/if}}
  {{#if breakdown.length}}
    <ul class="modifiers">
      {{#each breakdown as |m|}}<li>{{localize m.labelKey}}: {{adnd2eSigned m.amount}}</li>{{/each}}
    </ul>
  {{/if}}
  <p class="formula">1d20 = <strong>{{natural}}</strong> — {{localize 'ADND2E.chat.martialArts.needed' total=total needed=needed}}</p>
  <p class="result {{#if hit}}hit{{else}}miss{{/if}}">{{localize resultKey}}</p>
  {{#if hit}}
    <p class="formula">{{localize blowKey}} — {{localize 'ADND2E.chat.martialArts.damage' damage=damage}}</p>
    {{#if stunTrigger}}<p class="hint">{{localize 'ADND2E.chat.martialArts.stun'}}</p>{{/if}}
    <button type="button" data-action="applyDamage" data-amount="{{damage}}">{{localize 'ADND2E.chat.damage.applyToTargets'}}</button>
  {{/if}}
</div>
```

`src/sheets/character/martial-arts-actions.ts`:
```ts
import { TEMPLATE_PATH } from "../../constants";
import {
  blindedAttackPenalty, canAct, entangledAttackPenalty, fatigueArmorClassPenalty, fatigueAttackPenalty, frightenedAttackPenalty,
  heldAttackBonus, invisibleTargetPenalty, isHelpless, proneArmorClassPenalty,
} from "../../combat/condition-effects";
import { buildMartialArtsView, buildMartialCardContext, resolveMartialAttack, type MartialArtsView, type StyleItemLike } from "../../core/martial-arts";
import { themedPrompt } from "../../dialogs/themed-dialog-foundry";
import { getOptionalRules } from "../../settings";
import { resolveTargetArmorType, resolveTargetCombatInfo } from "./combat-rolls";

/* SP18 Plan A — Advanced Martial Arts. Foundry glue only; every decision lives in src/core/martial-arts.
 * Nothing but the active style id is written to the actor: an attack is a roll plus a chat card whose
 * Apply Damage button reuses the generic applyDamage chat action. */

type Statuses = ReadonlySet<string> | readonly string[];

export interface MartialArtsActor {
  name: string;
  img: string;
  statuses: Statuses;
  system: {
    martialArts: { knowsBasics: boolean; activeStyleId: string };
    attributes?: { thac0?: { melee?: number } };
    abilities?: { str?: { mods?: { damageAdj?: number } } };
  };
  items: Iterable<StyleItemLike & { system: Record<string, unknown> }>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

export function martialArtsView(actor: MartialArtsActor): MartialArtsView {
  return buildMartialArtsView({
    enabled: getOptionalRules().advancedMartialArts,
    items: actor.items,
    knowsBasics: actor.system.martialArts.knowsBasics,
    storedActiveId: actor.system.martialArts.activeStyleId,
    canAct: canAct(actor.statuses),
  });
}

/** Choose the style used this round. */
export async function setActiveStyle(actor: MartialArtsActor, itemId: string): Promise<void> {
  if (![...actor.items].some((i) => i.type === "martialStyle" && i.id === itemId)) return;
  await actor.update({ "system.martialArts.activeStyleId": itemId });
}

/** The size ("S"/"M"/"L") of the weapon the target is wielding, or null. */
function wieldedWeaponSize(target: { items: Iterable<{ type: string; system: { equipped?: boolean; size?: string } }> }): string | null {
  const weapon = [...target.items].find((i) => i.type === "weapon" && i.system.equipped === true);
  return weapon?.system.size ?? null;
}

/** Rolls one unarmed attack with the active style against the targeted token (or a typed-in AC) and posts the card. */
export async function rollMartialArtsAttack(actor: MartialArtsActor): Promise<void> {
  const view = martialArtsView(actor);
  if (!view.visible) return;
  if (!view.active) return warn("ADND2E.sheet.martialArts.noActive");
  if (!view.canAct) return warn("ADND2E.chat.attack.cannotActWarning");

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let opponentWeaponSize: string | null = null;
  let targetStatuses: ReadonlySet<string> = new Set<string>();

  if (targets.length === 1) {
    const t = targets[0]!;
    const targetActor = t.actor as Parameters<typeof resolveTargetCombatInfo>[0] & { statuses?: ReadonlySet<string> };
    targetName = t.name;
    targetStatuses = targetActor.statuses ?? new Set<string>();
    targetAc = resolveTargetCombatInfo(targetActor).ac + proneArmorClassPenalty(targetStatuses) + fatigueArmorClassPenalty(targetStatuses);
    opponentWeaponSize = wieldedWeaponSize(targetActor as never);
  } else {
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
    if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return;
    targetAc = manualAc;
  }

  const roll = await new Roll("1d20").evaluate();
  const result = resolveMartialAttack({
    naturalD20: roll.dice[0]?.total ?? roll.total ?? 1,
    thac0: actor.system.attributes?.thac0?.melee ?? 20,
    targetAc,
    attackerArmorType: resolveTargetArmorType(actor as never),
    opponentWeaponSize,
    situationalModifier:
      blindedAttackPenalty(actor.statuses) +
      fatigueAttackPenalty(actor.statuses) +
      entangledAttackPenalty(actor.statuses) +
      frightenedAttackPenalty(actor.statuses) +
      invisibleTargetPenalty(targetStatuses) +
      heldAttackBonus(targetStatuses),
    strengthDamageAdj: actor.system.abilities?.str?.mods?.damageAdj ?? 0,
    forcedHit: isHelpless(targetStatuses),
  });

  const context = buildMartialCardContext({
    actorName: actor.name, actorImg: actor.img, styleName: view.active.name, targetName, result,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/martial-arts-attack.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}
```
(Check `resolveTargetArmorType`'s parameter type in `combat-rolls.ts`; it takes an actor-like `{ type, items }`. A PC attacker is passed through the same helper — the `as never` cast mirrors the file's other call sites. If `heldAttackBonus`/`isHelpless` expect a `ReadonlySet<string>` the empty set above satisfies them, as in `rollAttack`.)

`src/sheets/character/sheet.ts` edits (anchor strings are from the current file):
1. After `import { trackQuarry, trackingView } from "./tracking-actions";` add `import { martialArtsView, rollMartialArtsAttack, setActiveStyle } from "./martial-arts-actions";`.
2. In `DEFAULT_OPTIONS.actions`, after `trackQuarry: Adnd2eCharacterSheet.#onTrackQuarry,` add:
```ts
      martialArtsAttack: Adnd2eCharacterSheet.#onMartialArtsAttack,
      useMartialStyle: Adnd2eCharacterSheet.#onUseMartialStyle,
```
3. In `_prepareContext`, after `context.tracking = trackingView(this.document as never);` add `context.martialArts = martialArtsView(this.document as never);`.
4. After the `#onTrackQuarry` handler add:
```ts
  // Interaction handlers — SP18 martial arts.
  static async #onMartialArtsAttack(this: Adnd2eCharacterSheet): Promise<void> {
    if (this.isEditable) await rollMartialArtsAttack(this.document as never);
  }

  static async #onUseMartialStyle(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const itemId = target.dataset.itemId ?? "";
    if (this.isEditable && itemId) await setActiveStyle(this.document as never, itemId);
  }
```
5. Drop handling, after `if (dropped.type === "kit" && !isNewDrop) return super._onDropItem(event, item);` add:
```ts
    if (dropped.type === "martialStyle" && !isNewDrop) return super._onDropItem(event, item);
```
and before `const verdict = validateItemDrop({` add:
```ts
    const styleInputs: Partial<DropCheckInput> =
      dropped.type === "martialStyle"
        ? {
            knowsBasicMartialArts: Boolean((this.document as unknown as { system: { martialArts?: { knowsBasics?: boolean } } }).system.martialArts?.knowsBasics),
            dropStyleName: dropped.name,
            existingStyleNames: others.filter((i) => i.type === "martialStyle").map((i) => i.name),
          }
        : {};
```
then `...styleInputs,` after `...kitInputs,` in the `validateItemDrop({...})` argument.

`templates/actor/pc/partials/pc-main-panels.hbs` — directly after the `{{/if}}{{/if}}` that closes the Wrestle block:
```hbs
  {{#if @root.pcActions}}{{#if @root.martialArts.visible}}
    <section class="kit-panel kit-martial-arts">
      <div class="kit-bar">{{localize 'ADND2E.sheet.martialArts.title'}}</div>
      <div class="kit-body">
        {{#if @root.adnd2e.lock.unlocked}}
          <label class="detail-field"><input type="checkbox" name="system.martialArts.knowsBasics"{{#if @root.martialArts.knowsBasics}} checked{{/if}}> <span>{{localize 'ADND2E.sheet.martialArts.knowsBasics'}}</span></label>
        {{else}}
          <p class="hint">{{#if @root.martialArts.knowsBasics}}{{localize 'ADND2E.sheet.martialArts.basicsKnown'}}{{else}}{{localize 'ADND2E.sheet.martialArts.basicsUnknown'}}{{/if}}</p>
        {{/if}}
        {{#each @root.martialArts.styles as |s|}}
          <div class="trait-row" data-item-id="{{s.id}}">
            <span class="name">{{s.name}}{{#if s.active}} — {{localize 'ADND2E.sheet.martialArts.active'}}{{/if}}</span>
            <span class="effect">{{localize s.formKey}} / {{localize s.methodKey}} ({{localize s.attackFormKey}})</span>
            <span class="effect">{{localize 'ADND2E.sheet.martialArts.acMod'}} {{adnd2eSigned s.acMod}}</span>
            <span class="effect">{{localize 'ADND2E.sheet.martialArts.damageDie'}} {{#if s.damageDie}}{{s.damageDie}}{{else}}{{localize 'ADND2E.sheet.martialArts.byWeapon'}}{{/if}}</span>
            <span class="effect">{{localize 'ADND2E.sheet.martialArts.slots'}} {{s.slots}}</span>
            <button type="button" class="kit-small" data-action="useMartialStyle" data-item-id="{{s.id}}"{{#if s.active}} disabled{{/if}}>{{localize 'ADND2E.sheet.martialArts.use'}}</button>
            {{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=s.id deletable=true}}{{/if}}
          </div>
        {{else}}
          <p class="kit-empty">{{localize 'ADND2E.sheet.martialArts.noStyles'}}</p>
        {{/each}}
        <p class="hint">{{localize 'ADND2E.sheet.martialArts.extraAttack'}}</p>
        <button type="button" class="kit-roll" data-action="martialArtsAttack"{{#unless @root.martialArts.canAttack}} disabled{{/unless}}>{{localize 'ADND2E.sheet.martialArts.attack'}}</button>
      </div>
    </section>
  {{/if}}{{/if}}
```

`lang/en.json` additions (labels must not end in an ellipsis):
- `ADND2E.sheet.martialArts`: `title` "Martial Arts", `knowsBasics` "Knows basic martial arts", `basicsKnown` "Knows basic martial arts.", `basicsUnknown` "Does not know basic martial arts (needed to learn a style).", `noStyles` "No martial arts styles.", `active` "in use", `use` "Use", `attack` "Martial arts attack", `acMod` "AC", `damageDie` "Style damage", `byWeapon` "by weapon", `slots` "Slots", `extraAttack` "Each style adds one attack per round while unarmed.", `noActive` "Choose a martial arts style first."
- `ADND2E.chat.martialArts`: `against` "against {target}", `needed` "rolled {total}, needed {needed}", `hit` "Hit", `miss` "Miss", `damage` "{damage} hp", `stun` "Natural 20: the target saves vs. paralyzation or is stunned (d20 under its HD or level: stunned 1d6 rounds) or incapacitated (d20 over: 1d3 hours).", and `mod`: `armor` "Worn armor", `weaponSize` "Opponent's weapon", `situational` "Conditions".
- `ADND2E.sheet.drop`: `styleNeedsBasics` "Learning a martial arts style requires knowing basic martial arts.", `styleDuplicate` "This character already has that style."

`tests/styles/chat-classes.test.ts`: the template count 17 → 18 and the title "finds all eighteen chat templates". Every class token used by the new template already has a rule (`hint`, `modifiers`, `formula`, `result`, `hit`, `miss`); run the census to confirm.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/sheets tests/templates tests/styles tests/lang`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`
```bash
git add -A src templates lang tests
git commit -m "feat(martial-arts): Martial Arts panel, attack roll, chat card and drop rule (SP18 Plan A)"
```

---

### Task 6: Gates, headless proof, README and the manual checklist

**Files:**
- Modify: `README.md` (find the SP18 / "Ninja" row: `grep -n "SP18\|18\. \|Ninja" -i README.md`; mark Plan A done and keep the row open for Plans B/C, in the style of the SP14/SP15 rows)
- Create: `.superpowers/proof/martial-styles.proof.ts`

- [ ] **Step 1: Write the headless proof**

Create `.superpowers/proof/martial-styles.proof.ts` using the harness boilerplate from `.superpowers/proof/humanoid-races.proof.ts` (copy its header through `beforeAll`, importing `MartialStyleItemModel` from `src/data/item/martial-style`, `base-actor`, `snapshot`, `derive`, `options`). Assertions:

1. All eight `packs/martial-styles/_source/*.json` clean and validate against `MartialStyleItemModel.schema` (`schema.validate(clean(sys))` is `undefined`); `form: "bogus"` and `slotsInvested: 0` are rejected with `F.data.validation.DataModelValidationFailure`.
2. A blank item cleans to form `hard`, principalMethod `strike`, slotsInvested 1, and its `availableManeuvers`/`weaponGroups` arrays are NOT shared between two cleans (mutate one, the other stays empty).
3. The actor common schema cleans `martialArts` to `{ knowsBasics: false, activeStyleId: "" }` (an old actor without the key).
4. Derivation: an actor with a fighter + a Sumo `martialStyle` item (id `s1`, `slotsInvested: 2`) + a Karate item (id `s2`): with `advancedMartialArts: true` the derived `ac.normal` is 8 with no active id (first owned = Sumo, -2), 9 with `activeStyleId: "s2"` (Karate, -1), and 10 with the rule off; `spentWeaponSlots` in the snapshot is 3.
5. The shipped chat template and panel partial compile with Handlebars (register `localize`, `adnd2eSigned` helpers as the other proofs do) and render the card for a hit and a miss context built with `buildMartialCardContext`.

Run: `npx vitest run --config .superpowers/proof/vitest.proof.config.ts .superpowers/proof/martial-styles.proof.ts`
Expected: PASS. (Foundry need not be running; the harness loads `common/server.mjs`.)

- [ ] **Step 2: Run the full CI sequence**

Run, in order: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npx vite build`.
Expected: all green; coverage statements 100%. If `src/core/martial-arts/*` shows uncovered branches, add the missing test rather than lowering anything.

- [ ] **Step 3: README and commit**

Update the README row, then:
```bash
git add README.md .superpowers/proof/martial-styles.proof.ts
git commit -m "docs: SP18 Plan A martial arts styles complete (#86)"
```

- [ ] **Step 4: Rebuild the installed system (only with Foundry closed) and hand the user the manual checklist**

If Foundry is closed: `npm run build` (a LevelDB LOCK blocks the pack build while Foundry is open — skip and say so if it is open).

Manual dev-world checklist to give the user (prerequisites stated, per the SP12 lesson):
1. **Setup:** Configure Settings → turn ON "Advanced martial arts", accept the reload. Create a PC with a **Fighter** class item. Unlock the sheet, tick **Knows basic martial arts**, lock.
2. **Drop:** From the Martial Arts Styles compendium drag **Karate** onto the sheet → it appears in the Martial Arts panel (Main tab) with `Hard / Strike (Hand)`, AC -1, Style damage 1d4, Slots 1. Dragging Karate again is refused; with the box unticked a drop is refused with the "requires basic martial arts" toast.
3. **AC:** note the AC shown on the sheet with no style; with Karate active it is exactly 1 better. Drop **Sumo** (AC -2), press **Use** on it → AC is now 2 better than the no-style value; Karate's Use is enabled again.
4. **Attack:** target a token and press **Martial arts attack** → a card shows the roll, "rolled N, needed M", the blow (e.g. "Vitals punch") and "2 hp", plus **Apply Damage**; pressing it reduces the target's HP by that amount. With no target a prompt asks for an AC.
5. **Penalties:** equip chain mail (or any -2 armor) → the card's modifiers list shows "Worn armor: -2".
6. **Rule off:** turn the setting off and reload → the panel is gone and AC is back to the no-style value.
7. **Non-GM seat:** log in as a player owning the PC; steps 3-4 work, and Apply Damage on a token the player does not own still resolves through the GM relay.
8. **Character NPC:** open a Character NPC sheet → no Martial Arts panel and no change.
**Reset the setting between checks if an earlier step changed it.** The numbers to expect on the sheet are the derived AC (not a tooltip).

- [ ] **Step 5: Open the PR (never ask; always push + PR)**

```bash
git push -u origin feat/sp18a-martial-arts-styles
gh pr create --title "feat(martial-arts): SP18 Plan A - martial arts styles and the unarmed attack (#86)" --body "..."
```
PR body: summary of Plan A scope, "Part of #86 (Plans B and C remain)", the R3 damage decision, test plan with the CI sequence and the manual checklist, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; ask the user to merge (the auto-mode classifier blocks `gh pr merge`).

---

## Self-Review

**Spec coverage:** style data model and derivation (Tasks 1-2); slot accounting (Task 3, cap deferred and documented); 8 styles pack (Task 4); attack roll + Table 16 + Table 57/22 + stun prompt (Tasks 1, 5); rule toggle (Tasks 2-3); sheet panel, drop prerequisite (Task 5); testing and verification gates (Task 6). Amendments to the spec are appended in Task 1.

**Placeholder scan:** none. Test names and file paths that depend on existing files I could not fully read (`tests/sheets/character/drop-rules.test.ts`, `tests/settings/sections.test.ts`, the `en-coverage` section list) carry an explicit "run it and add" instruction.

**Type consistency:** `styleStats`/`resolveActiveStyleId` (Task 1) are used by `snapshot.ts` (Task 3) and `view.ts`; `MartialArtsView.canAttack` (Task 1) is what the template's disabled condition and the binding test read; `knowsBasicMartialArts`/`dropStyleName`/`existingStyleNames` (Task 5) match between `drop-rules.ts`, its test and the sheet edit; `ADND2E.martialBlows.*` keys produced by the card match the lang block in Task 2.
