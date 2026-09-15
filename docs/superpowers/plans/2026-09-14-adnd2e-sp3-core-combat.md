# SP3 — Core Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `core/combat`/`core/saves` math into real Foundry `Roll`s, interactive chat cards, and initiative — attack rolls with manual damage application, saving throws, and individual initiative (weapon speed + DEX reaction) with a low-goes-first Combat Tracker.

**Architecture:** Two-layer split matching SP1/SP2. A small pure addition (`src/core/combat/initiative.ts`, `src/combat/*.ts`) turns roll inputs/results into fully-formatted chat-card display data — mirroring SP2's `buildCharacterSheetContext` pattern. A thin Foundry shell (`documents/combatant.ts`, `documents/combat.ts`, `sheets/character/combat-rolls.ts`, `chat/chat-listeners.ts`, chat templates) does the actual `Roll` construction, token targeting, and `ChatMessage` posting. Almost none of the game math is new — `core/combat/{attack,damage}.ts` and `core/saves/composer.ts` (Plan 1b.4/1b.3) are reused as-is.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`Roll`, `ChatMessage`, `Combat`/`Combatant` documents, `game.user.targets`, `DialogV2`, the `renderChatMessageHTML` hook).

**Spec:** `docs/superpowers/specs/2026-09-14-adnd2e-sp3-core-combat-design.md` (read it alongside this plan).

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source at `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — **never** `fvtt-types` (a wrong v13-beta).
- **Two-layer contract:** pure files (`src/core/combat/initiative.ts`, `src/combat/{card-types,damage-dice,attack-card,damage-card,save-card}.ts`) import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). The Foundry shell (`documents/combatant.ts`, `documents/combat.ts`, `sheets/character/combat-rolls.ts`, `chat/chat-listeners.ts`, chat templates, sheet action wiring) is typecheck + build gated only, no unit tests, dev-world verified (parent spec §9).
- **The gated-zone config triad** — every new pure file goes in ALL THREE: `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (BOTH the Foundry-globals `ignores` array AND the pure-zone `files` array).
- **Content policy:** mechanical/UI data only. Chat-card templates carry labels via `{{localize}}` keys, never 2E rules prose.
- **Do NOT run** `npm run format` / `prettier` / `npm install` — nothing that touches `package.json`/`package-lock.json`/`node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, **never** `| grep` (SIGPIPE → false "no tests").
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check (final task) is GATED** — the user runs it before `finishing-a-development-branch`, never a deferred checklist item.
- **Damage application is manual** — a deliberate "Apply Damage" chat-card click, never automatic on a hit.
- **Attack rolls read the acting actor's already-cached `system.*` values** (THAC0, weapon dice) — never re-derive them. Only the target's AC/size are read live (any actor type may be targeted).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Reference facts (verified against v14.364 source this session)

- **`Combatant#_getInitiativeFormula()`** (`client/documents/combatant.mjs:193`) — protected instance method, default `return String(CONFIG.Combat.initiative.formula || game.system.initiative);`. Override point for a per-combatant initiative formula.
- **`Combat#_sortCombatants(a, b)`** (`client/documents/combat.mjs:566`) — protected instance method, default `const ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity; const ib = ...; return (ib - ia) || (a.id > b.id ? 1 : -1);` (descending, ties by id). Called as `this.combatants.contents.sort(this._sortCombatants)` (`combat.mjs:492`).
- **`Roll`** (`client/dice/roll.mjs`) — `new Roll(formula)`, `async evaluate(options)`, `async toMessage(messageData, options)`. `roll.total` (a getter) is the final numeric result after `evaluate()`; the natural die result for a `1d20`/`1d10` formula is `roll.dice[0].total` (the single die term) — implementer confirms the exact accessor (`roll.terms[0].results[0].result` is the raw per-die value pre-modifiers; `roll.dice[0].total` sums multiple dice of one term) against `client/dice/roll.mjs` / `common/dice/terms/die.mjs` before using it, since `hitResult()`/save comparisons need the **natural** die, not the modified total.
- **`ChatMessage.create(data)`** — standard `Document.create`, not overridden with special args in `client/documents/chat-message.mjs`. `ChatMessage.getSpeaker({actor})` (`chat-message.mjs:217`) builds the `speaker` field for portrait/name display.
- **`Hooks.callAll("renderChatMessageHTML", this, html)`** (`chat-message.mjs:393,435`) — args are `(message: ChatMessage, html: HTMLElement)`, a raw `HTMLElement` (v14 changed this from the deprecated jQuery-based `renderChatMessage`).
- **`game.user.targets`** (`client/documents/user.mjs:45`) — `targets = new foundry.canvas.placeables.tokens.UserTargets(this)`, a `Set`-like collection of **`Token`** canvas placeables (not `TokenDocument`s). `token.actor` gets the actor. Iterate with `[...game.user.targets]`.
- **`foundry.applications.api.DialogV2.prompt({...})`** — already used in SP2 (`src/sheets/character/sheet.ts` `#onAwardXp`); same pattern reused here for the manual-AC / target-disambiguation dialogs.
- **Cross-actor-type AC/size shape mismatch** (confirmed by reading the DataModels): `character`/`npc` (`src/data/actor/base-actor.ts` `actorCommonSchema()`) have `system.attributes.ac: { normal, rearAttack, surprised, shieldless }` (four contexts) and NO actor-level `size` field (size comes from the embedded `race` item's `system.size`, default `"medium"` if no race). `creature` (`src/data/actor/creature.ts`) has `system.attributes.ac: { value }` (ONE flat number) and `system.details.size` (default `"medium"`). A target-info resolver must branch on `actor.type`.

---

## File Structure

```
src/core/combat/
  initiative.ts              NEW (pure) — initiativeModifiers()
src/core/dice/
  formula.ts                  MODIFY (pure) — add initiativeFormula()
src/combat/
  card-types.ts                NEW (pure) — AttackCardContext/DamageCardContext/SaveCardContext + *Input types
  damage-dice.ts               NEW (pure) — pickDamageDice()
  attack-card.ts                NEW (pure) — buildAttackCardContext()
  damage-card.ts                NEW (pure) — buildDamageCardContext()
  save-card.ts                   NEW (pure) — buildSaveCardContext()

src/documents/
  combatant.ts                  NEW (shell) — Adnd2eCombatant
  combat.ts                     NEW (shell) — Adnd2eCombat
  index.ts                      MODIFY — export both

src/sheets/character/
  combat-rolls.ts                NEW (shell) — rollAttack/rollSave; the target-info resolver
  sheet.ts                       MODIFY (shell) — rollAttack/rollSave actions

src/chat/
  chat-listeners.ts               NEW (shell) — renderChatMessageHTML hook; Roll Damage / Apply Damage

templates/chat/
  attack-roll.hbs                 NEW
  damage-roll.hbs                 NEW
  save-roll.hbs                    NEW

templates/actor/character/
  combat.hbs                      MODIFY — Roll Attack button per weapon
  main.hbs                        MODIFY — Roll button per save row
  partials/save-row.hbs            MODIFY — the Roll button

src/system.ts                     MODIFY — CONFIG.Combatant/Combat.documentClass, register the chat hook

lang/en.json                      MODIFY — ADND2E.chat.* / ADND2E.combat.roll* tree

tsconfig.core.json                MODIFY — include the new pure files
vitest.config.ts                  MODIFY — coverage.include the new pure files
eslint.config.js                  MODIFY — ignores[]/files[] the new pure files

tests/core/combat/
  initiative.test.ts               NEW
tests/combat/
  damage-dice.test.ts              NEW
  attack-card.test.ts              NEW
  damage-card.test.ts              NEW
  save-card.test.ts                 NEW
tests/lang/en-coverage.test.ts     MODIFY — drift block for the new lang keys
```

---

## Task 1: Pure — initiative modifiers + formula

**Files:**
- Create: `src/core/combat/initiative.ts`
- Modify: `src/core/dice/formula.ts`
- Create: `tests/core/combat/initiative.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js` (add ALL the new pure paths listed in File Structure now, to avoid re-touching the triad in Tasks 2–3, same trick SP2 used)

**Interfaces:**
- Produces: `initiativeModifiers(input: InitiativeModifierInput): InitiativeModifierResult`; `initiativeFormula(modifier: number): string` (added to the existing `formula.ts` exports alongside `signedTerm`/`attackFormula`/`damageFormula`).

- [ ] **Step 1: Add every new pure path to the gated triad**

`tsconfig.core.json` — append to `include`: `"src/core/combat/initiative.ts"`, `"src/combat"`, `"tests/core/combat"`, `"tests/combat"`. (`src/core/combat/attack.ts` etc. and `tests/core/combat` may already be covered by a broader `src/core`/`tests/core` glob — check the current file first; if `src/core` and `tests/core` are already blanket-included, you only need to add `"src/combat"` and `"tests/combat"`.)

`vitest.config.ts` — append to `coverage.include`: `"src/core/combat/**/*.ts"` (if not already covered by an existing `src/core/**/*.ts` glob — check first) and `"src/combat/**/*.ts"`.

`eslint.config.js` — append `"src/combat/**"` and `"tests/combat/**"` to BOTH the Foundry-globals `ignores` array AND the pure-zone `files` array. (`src/core/combat` and `tests/core/combat` are almost certainly already covered by existing `src/core/**`/`tests/core/**` entries — check first, don't duplicate.)

- [ ] **Step 2: Write `tests/core/combat/initiative.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { initiativeModifiers } from "../../../src/core/combat/initiative";

describe("initiativeModifiers", () => {
  it("sums weapon speed, reaction, and situational with no defaults given", () => {
    const r = initiativeModifiers({});
    expect(r).toEqual({ total: 0, breakdown: { weaponSpeed: 0, reaction: 0, situational: 0 } });
  });

  it("adds a positive weapon speed factor (slower weapon, worse initiative)", () => {
    const r = initiativeModifiers({ weaponSpeedFactor: 7 });
    expect(r.total).toBe(7);
    expect(r.breakdown.weaponSpeed).toBe(7);
  });

  it("adds a negative reaction adjustment (high DEX, better initiative)", () => {
    const r = initiativeModifiers({ reactionAdj: -2 });
    expect(r.total).toBe(-2);
    expect(r.breakdown.reaction).toBe(-2);
  });

  it("combines all three terms, including a manual situational modifier", () => {
    const r = initiativeModifiers({ weaponSpeedFactor: 5, reactionAdj: -1, situationalModifier: 3 });
    expect(r.total).toBe(7);
    expect(r.breakdown).toEqual({ weaponSpeed: 5, reaction: -1, situational: 3 });
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`npx vitest run tests/core/combat/initiative.test.ts 2>&1 | tail -15`).

- [ ] **Step 4: Write `src/core/combat/initiative.ts`**

```ts
// PHB p.61 / DMG (Individual Initiative optional rule): 1d10, lower total acts
// first. Weapon speed factor and spell casting time modify the roll additively
// (both already roll-signed: a slower weapon/longer cast = a larger positive
// number = a worse, later initiative). DEX reaction adjustment is core PHB
// initiative (Table 3), independent of the weapon-speed optional rule.

export interface InitiativeModifierInput {
  /** the currently equipped weapon's speed factor; 0 if unarmed or the
   *  weaponSpeedInitiative optional rule is off */
  weaponSpeedFactor?: number;
  /** dexterity(dex).reactionAdj — already roll-signed (negative = better) */
  reactionAdj?: number;
  /** a manual per-round entry (e.g. a spell's casting time in segments) */
  situationalModifier?: number;
}

export interface InitiativeModifierResult {
  total: number;
  breakdown: { weaponSpeed: number; reaction: number; situational: number };
}

/** 2E initiative is a straight sum — lower `total` acts first. */
export function initiativeModifiers(input: InitiativeModifierInput): InitiativeModifierResult {
  const weaponSpeed = input.weaponSpeedFactor ?? 0;
  const reaction = input.reactionAdj ?? 0;
  const situational = input.situationalModifier ?? 0;
  return {
    total: weaponSpeed + reaction + situational,
    breakdown: { weaponSpeed, reaction, situational },
  };
}
```

- [ ] **Step 5: Run `initiative.test.ts` — expect PASS.**

- [ ] **Step 6: Add `initiativeFormula` to `src/core/dice/formula.ts`** — append after `damageFormula`:

```ts
/** A 1d10 initiative roll with its total modifier. 2E is ascending: lower total acts first. */
export function initiativeFormula(modifier: number): string {
  return `1d10${signedTerm(modifier)}`;
}
```

- [ ] **Step 7: Write a test for it** — open `tests/core/dice/formula.test.ts` (the existing 1b.4 test file for `signedTerm`/`attackFormula`/`damageFormula`) and append:

```ts
describe("initiativeFormula", () => {
  it("bare 1d10 with no modifier", () => {
    expect(initiativeFormula(0)).toBe("1d10");
  });
  it("adds a positive modifier", () => {
    expect(initiativeFormula(5)).toBe("1d10 + 5");
  });
  it("adds a negative modifier", () => {
    expect(initiativeFormula(-2)).toBe("1d10 - 2");
  });
});
```
Add `initiativeFormula` to that file's existing import line from `"../../../src/core/dice/formula"`.

- [ ] **Step 8: Run the full pure gate**

```bash
npm run typecheck 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npx vitest run tests/core/combat tests/core/dice 2>&1 | tail -15
```

- [ ] **Step 9: `npm run test:coverage` — confirm 100%** (`... 2>&1 | tail -12`).

- [ ] **Step 10: Commit**

```bash
git add src/core/combat/initiative.ts src/core/dice/formula.ts tests/core/combat/initiative.test.ts tests/core/dice/formula.test.ts tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(sp3): pure initiative modifiers + formula builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Pure — damage-dice selection

**Files:**
- Create: `src/combat/damage-dice.ts`
- Create: `tests/combat/damage-dice.test.ts`

**Interfaces:**
- Consumes: `CreatureSize` from `src/core/types.ts`.
- Produces: `pickDamageDice(weapon: WeaponDamageDice, targetSize: CreatureSize | null): string | null`

- [ ] **Step 1: Write `tests/combat/damage-dice.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { pickDamageDice } from "../../src/combat/damage-dice";

describe("pickDamageDice", () => {
  it("picks vsSM for a medium target", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "medium")).toBe("1d6");
  });
  it("picks vsSM for a small or tiny target", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "small")).toBe("1d6");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "tiny")).toBe("1d6");
  });
  it("picks vsL for large, huge, or gargantuan targets", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "large")).toBe("1d8");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "huge")).toBe("1d8");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "gargantuan")).toBe("1d8");
  });
  it("defaults to vsSM (medium) when there is no target", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, null)).toBe("1d6");
  });
  it("falls back to whichever die is defined when the other is null", () => {
    expect(pickDamageDice({ damageVsSM: null, damageVsL: "1d8" }, "medium")).toBe("1d8");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: null }, "large")).toBe("1d6");
  });
  it("returns null when neither die is defined (e.g. a bow with no ammo modeled)", () => {
    expect(pickDamageDice({ damageVsSM: null, damageVsL: null }, "medium")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Write `src/combat/damage-dice.ts`**

```ts
import type { CreatureSize } from "../core/types";

export interface WeaponDamageDice {
  damageVsSM: string | null;
  damageVsL: string | null;
}

const LARGE_AND_UP: ReadonlySet<CreatureSize> = new Set(["large", "huge", "gargantuan"]);

/**
 * PHB p.61: weapons roll different damage against Large+ creatures. `targetSize`
 * `null` (no target selected) defaults to the Small/Medium die. A weapon that
 * defines only one die (or neither — a launcher whose ammo isn't modeled as an
 * item yet, spec §7) falls back to whichever is non-null, or `null` if neither is.
 */
export function pickDamageDice(weapon: WeaponDamageDice, targetSize: CreatureSize | null): string | null {
  const preferLarge = targetSize !== null && LARGE_AND_UP.has(targetSize);
  return preferLarge
    ? (weapon.damageVsL ?? weapon.damageVsSM ?? null)
    : (weapon.damageVsSM ?? weapon.damageVsL ?? null);
}
```

- [ ] **Step 4: Run `damage-dice.test.ts` — expect PASS.**

- [ ] **Step 5: `npm run typecheck && npm run lint && npm run test:coverage`** (each `2>&1 | tail -6`/`tail -12`) — clean, 100%.

- [ ] **Step 6: Commit**

```bash
git add src/combat/damage-dice.ts tests/combat/damage-dice.test.ts
git commit -m "feat(sp3): pure damage-dice selection by target size

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Pure — chat-card content builders

**Files:**
- Create: `src/combat/card-types.ts`
- Create: `src/combat/attack-card.ts`
- Create: `src/combat/damage-card.ts`
- Create: `src/combat/save-card.ts`
- Create: `tests/combat/attack-card.test.ts`
- Create: `tests/combat/damage-card.test.ts`
- Create: `tests/combat/save-card.test.ts`

**Interfaces:**
- Consumes: `HitResult`, `AttackModifierResult` from `src/core/combat/attack.ts`; `damageResult` from `src/core/combat/damage.ts`.
- Produces: `AttackCardContext`, `AttackCardInput`, `DamageCardContext`, `DamageCardInput`, `SaveCardContext`, `SaveCardInput` (in `card-types.ts`); `buildAttackCardContext(input): AttackCardContext`; `buildDamageCardContext(input): DamageCardContext`; `buildSaveCardContext(input): SaveCardContext`.

- [ ] **Step 1: Write `src/combat/card-types.ts`**

```ts
export interface ModifierLine { label: string; value: number }

/* ---------- attack ---------- */

export interface AttackCardInput {
  actorName: string;
  actorImg: string;
  weaponName: string;
  /** the targeted token's actor name, or null if no target was selected */
  targetName: string | null;
  formula: string;
  naturalD20: number;
  /** from core/combat/attack.ts hitResult() */
  hit: { hit: boolean; autoHit: boolean; autoMiss: boolean; needed: number; total: number; margin: number };
  /** from core/combat/attack.ts attackModifiers().breakdown */
  modifierBreakdown: {
    strength: number; dexterityMissile: number; weaponMagic: number;
    proficiency: number; range: number; situational: number;
  };
  /** carried into the chat message's flags so the "Roll Damage" button knows
   *  what to roll; null when there is no weapon item to roll damage from
   *  (should not normally happen — a "Roll Attack" always originates from a weapon row) */
  damageContext: { weaponItemId: string; actorId: string; targetSize: string | null } | null;
}

export interface AttackCardContext {
  actorName: string; actorImg: string;
  weaponName: string; targetName: string | null;
  formula: string; naturalD20: number; total: number;
  needed: number; margin: number;
  hit: boolean; autoHit: boolean; autoMiss: boolean;
  /** zero-value modifiers are omitted — a clean card, not a wall of "+0" lines */
  modifierBreakdown: ModifierLine[];
  damageContext: { weaponItemId: string; actorId: string; targetSize: string | null } | null;
}

/* ---------- damage ---------- */

export interface DamageCardInput {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string;
  rolledBaseDamage: number;
  /** from core/combat/damage.ts damageModifiers().total */
  damageBonus: number;
}

export interface DamageCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string; rolled: number; bonus: number; total: number;
}

/* ---------- save ---------- */

export interface SaveCardInput {
  actorName: string; actorImg: string;
  /** i18n key, e.g. config.saves["ppd"] */
  categoryLabel: string;
  formula: string;
  naturalD20: number;
  rollModifier: number;
  target: number;
}

export interface SaveCardContext {
  actorName: string; actorImg: string;
  categoryLabel: string;
  formula: string; naturalD20: number; total: number;
  target: number; success: boolean;
}
```

- [ ] **Step 2: Write `tests/combat/attack-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildAttackCardContext } from "../../src/combat/attack-card";
import type { AttackCardInput } from "../../src/combat/card-types";

function input(over: Partial<AttackCardInput> = {}): AttackCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    weaponName: "Long Sword", targetName: "Goblin",
    formula: "1d20 + 3", naturalD20: 15,
    hit: { hit: true, autoHit: false, autoMiss: false, needed: 12, total: 18, margin: 6 },
    modifierBreakdown: { strength: 1, dexterityMissile: 0, weaponMagic: 0, proficiency: 0, range: 0, situational: 0 },
    damageContext: { weaponItemId: "w1", actorId: "a1", targetSize: "small" },
    ...over,
  };
}

describe("buildAttackCardContext", () => {
  it("passes through the roll and hit result", () => {
    const c = buildAttackCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.weaponName).toBe("Long Sword");
    expect(c.targetName).toBe("Goblin");
    expect(c.formula).toBe("1d20 + 3");
    expect(c.naturalD20).toBe(15);
    expect(c.total).toBe(18);
    expect(c.needed).toBe(12);
    expect(c.margin).toBe(6);
    expect(c.hit).toBe(true);
    expect(c.autoHit).toBe(false);
    expect(c.autoMiss).toBe(false);
  });

  it("filters zero-value modifiers out of the displayed breakdown", () => {
    const c = buildAttackCardContext(input());
    expect(c.modifierBreakdown).toEqual([{ label: "ADND2E.chat.attack.modStrength", value: 1 }]);
  });

  it("keeps every non-zero modifier, including negative ones", () => {
    const c = buildAttackCardContext(input({
      modifierBreakdown: { strength: 0, dexterityMissile: -1, weaponMagic: 1, proficiency: -2, range: -5, situational: 3 },
    }));
    expect(c.modifierBreakdown).toEqual([
      { label: "ADND2E.chat.attack.modDexMissile", value: -1 },
      { label: "ADND2E.chat.attack.modWeaponMagic", value: 1 },
      { label: "ADND2E.chat.attack.modProficiency", value: -2 },
      { label: "ADND2E.chat.attack.modRange", value: -5 },
      { label: "ADND2E.chat.attack.modSituational", value: 3 },
    ]);
  });

  it("an all-zero breakdown yields an empty modifier list", () => {
    const c = buildAttackCardContext(input({
      modifierBreakdown: { strength: 0, dexterityMissile: 0, weaponMagic: 0, proficiency: 0, range: 0, situational: 0 },
    }));
    expect(c.modifierBreakdown).toEqual([]);
  });

  it("carries a null targetName and damageContext through unchanged", () => {
    const c = buildAttackCardContext(input({ targetName: null, damageContext: null }));
    expect(c.targetName).toBeNull();
    expect(c.damageContext).toBeNull();
  });

  it("carries autoHit/autoMiss through", () => {
    const c1 = buildAttackCardContext(input({ hit: { hit: true, autoHit: true, autoMiss: false, needed: 12, total: 23, margin: 11 } }));
    expect(c1.autoHit).toBe(true);
    const c2 = buildAttackCardContext(input({ hit: { hit: false, autoHit: false, autoMiss: true, needed: 12, total: 1, margin: -11 } }));
    expect(c2.autoMiss).toBe(true);
    expect(c2.hit).toBe(false);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL.**

- [ ] **Step 4: Write `src/combat/attack-card.ts`**

```ts
import type { AttackCardContext, AttackCardInput, ModifierLine } from "./card-types";

const MODIFIER_LABELS: Record<keyof AttackCardInput["modifierBreakdown"], string> = {
  strength: "ADND2E.chat.attack.modStrength",
  dexterityMissile: "ADND2E.chat.attack.modDexMissile",
  weaponMagic: "ADND2E.chat.attack.modWeaponMagic",
  proficiency: "ADND2E.chat.attack.modProficiency",
  range: "ADND2E.chat.attack.modRange",
  situational: "ADND2E.chat.attack.modSituational",
};

/** Turn a resolved attack roll into the chat-card's display data. Zero-value
 *  modifiers are dropped from the breakdown — a clean card, not a wall of "+0"s. */
export function buildAttackCardContext(input: AttackCardInput): AttackCardContext {
  const modifierBreakdown: ModifierLine[] = (
    Object.entries(input.modifierBreakdown) as [keyof AttackCardInput["modifierBreakdown"], number][]
  )
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => ({ label: MODIFIER_LABELS[key], value }));

  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    weaponName: input.weaponName,
    targetName: input.targetName,
    formula: input.formula,
    naturalD20: input.naturalD20,
    total: input.hit.total,
    needed: input.hit.needed,
    margin: input.hit.margin,
    hit: input.hit.hit,
    autoHit: input.hit.autoHit,
    autoMiss: input.hit.autoMiss,
    modifierBreakdown,
    damageContext: input.damageContext,
  };
}
```

- [ ] **Step 5: Run `attack-card.test.ts` — expect PASS.**

- [ ] **Step 6: Write `tests/combat/damage-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildDamageCardContext } from "../../src/combat/damage-card";
import type { DamageCardInput } from "../../src/combat/card-types";

function input(over: Partial<DamageCardInput> = {}): DamageCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    weaponName: "Long Sword", formula: "1d8 + 2",
    rolledBaseDamage: 5, damageBonus: 2,
    ...over,
  };
}

describe("buildDamageCardContext", () => {
  it("computes the final floored total from rolled + bonus", () => {
    const c = buildDamageCardContext(input());
    expect(c.rolled).toBe(5);
    expect(c.bonus).toBe(2);
    expect(c.total).toBe(7);
  });

  it("floors a heavily-penalized roll at 1, never 0 or negative", () => {
    const c = buildDamageCardContext(input({ rolledBaseDamage: 1, damageBonus: -5 }));
    expect(c.total).toBe(1);
  });

  it("passes actor/weapon identity and the formula through unchanged", () => {
    const c = buildDamageCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.weaponName).toBe("Long Sword");
    expect(c.formula).toBe("1d8 + 2");
  });
});
```

- [ ] **Step 7: Run it — expect FAIL.**

- [ ] **Step 8: Write `src/combat/damage-card.ts`**

```ts
import { damageResult } from "../core/combat/damage";
import type { DamageCardContext, DamageCardInput } from "./card-types";

/** Turn a resolved damage roll into the chat-card's display data. Reuses the
 *  existing `damageResult` floor-at-1 rule (core/combat/damage.ts). */
export function buildDamageCardContext(input: DamageCardInput): DamageCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    weaponName: input.weaponName,
    formula: input.formula,
    rolled: input.rolledBaseDamage,
    bonus: input.damageBonus,
    total: damageResult(input.rolledBaseDamage, input.damageBonus),
  };
}
```

- [ ] **Step 9: Run `damage-card.test.ts` — expect PASS.**

- [ ] **Step 10: Write `tests/combat/save-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildSaveCardContext } from "../../src/combat/save-card";
import type { SaveCardInput } from "../../src/combat/card-types";

function input(over: Partial<SaveCardInput> = {}): SaveCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    categoryLabel: "ADND2E.saves.ppd",
    formula: "1d20 + 1", naturalD20: 14, rollModifier: 1, target: 12,
    ...over,
  };
}

describe("buildSaveCardContext", () => {
  it("succeeds when natural + modifier meets the target", () => {
    const c = buildSaveCardContext(input());
    expect(c.total).toBe(15);
    expect(c.success).toBe(true);
  });

  it("succeeds exactly at the target (>=, not >)", () => {
    const c = buildSaveCardContext(input({ naturalD20: 11, rollModifier: 1, target: 12 }));
    expect(c.total).toBe(12);
    expect(c.success).toBe(true);
  });

  it("fails when below the target", () => {
    const c = buildSaveCardContext(input({ naturalD20: 5, rollModifier: 1, target: 12 }));
    expect(c.total).toBe(6);
    expect(c.success).toBe(false);
  });

  it("a negative rollModifier can push a save below the target", () => {
    const c = buildSaveCardContext(input({ naturalD20: 12, rollModifier: -1, target: 12 }));
    expect(c.total).toBe(11);
    expect(c.success).toBe(false);
  });

  it("passes actor identity, category label, and formula through unchanged", () => {
    const c = buildSaveCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.categoryLabel).toBe("ADND2E.saves.ppd");
    expect(c.formula).toBe("1d20 + 1");
  });
});
```

- [ ] **Step 11: Run it — expect FAIL.**

- [ ] **Step 12: Write `src/combat/save-card.ts`**

```ts
import type { SaveCardContext, SaveCardInput } from "./card-types";

/** A save succeeds when `naturalD20 + rollModifier >= target` (the same
 *  contract `core/saves/composer.ts`'s saveTargetBest documents). */
export function buildSaveCardContext(input: SaveCardInput): SaveCardContext {
  const total = input.naturalD20 + input.rollModifier;
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    categoryLabel: input.categoryLabel,
    formula: input.formula,
    naturalD20: input.naturalD20,
    total,
    target: input.target,
    success: total >= input.target,
  };
}
```

- [ ] **Step 13: Run `save-card.test.ts` — expect PASS.**

- [ ] **Step 14: Full pure gate**

```bash
npm run typecheck 2>&1 | tail -8
npm run lint 2>&1 | tail -8
npm run test:coverage 2>&1 | tail -16
```
Expected: clean; **100%** on all four new files (branch ≥ 90; the exhaustive zero/non-zero/all-zero attack-modifier cases and the exact-target/below-target/negative-modifier save cases exist specifically to hit every branch — if the coverage report flags anything uncovered, add the missing case rather than weakening the source).

- [ ] **Step 15: Commit**

```bash
git add src/combat/card-types.ts src/combat/attack-card.ts src/combat/damage-card.ts src/combat/save-card.ts tests/combat/attack-card.test.ts tests/combat/damage-card.test.ts tests/combat/save-card.test.ts
git commit -m "feat(sp3): pure chat-card content builders for attack/damage/save rolls

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Foundry shell — Combatant/Combat document overrides

**Files:**
- Create: `src/documents/combatant.ts`
- Create: `src/documents/combat.ts`
- Modify: `src/documents/index.ts`
- Modify: `src/system.ts`

**Interfaces:**
- Consumes: `initiativeModifiers`, `initiativeFormula` (Task 1).
- Produces: `Adnd2eCombatant`, `Adnd2eCombat` classes.

**Not unit-tested** (spec §9) — verified in the dev-world check (final task).

- [ ] **Step 1: Write `src/documents/combatant.ts`**

```ts
import { initiativeFormula } from "../core/dice/formula";
import { initiativeModifiers } from "../core/combat/initiative";
import { getOptionalRules } from "../settings";
import { SYSTEM_ID } from "../constants";

/**
 * System Combatant document — individual initiative (PHB Table 3 DEX reaction
 * adjustment, always; weapon speed factor when the `weaponSpeedInitiative`
 * optional rule is on) instead of the manifest's bare `1d10`.
 */
export class Adnd2eCombatant extends Combatant {
  override _getInitiativeFormula(): string {
    const actor = this.actor as unknown as {
      type: string;
      system: { abilities?: { dex?: { mods?: { reactionAdj?: number } } } };
      items: Iterable<{ type: string; system: { equipped?: boolean; speedFactor?: number } }>;
    } | null;
    if (!actor || (actor.type !== "character" && actor.type !== "npc")) {
      // Creatures don't have a DEX-mods/weapon-item combat profile yet (SP6) —
      // fall back to the bare system default rather than guessing.
      return super._getInitiativeFormula();
    }

    const reactionAdj = actor.system.abilities?.dex?.mods?.reactionAdj ?? 0;

    let weaponSpeedFactor = 0;
    if (getOptionalRules().weaponSpeedInitiative) {
      const equippedWeapon = [...actor.items].find((i) => i.type === "weapon" && i.system.equipped);
      weaponSpeedFactor = equippedWeapon?.system.speedFactor ?? 0;
    }

    const situationalModifier = Number(this.getFlag(SYSTEM_ID, "initiativeModifier") ?? 0);

    const { total } = initiativeModifiers({ weaponSpeedFactor, reactionAdj, situationalModifier });
    return initiativeFormula(total);
  }
}
```
(Implementer verifies `Combatant#actor`, `Combatant#getFlag`/`setFlag` signatures against `client/documents/combatant.mjs`, and that `getOptionalRules()` — already exported from `src/settings/index.ts` per SP1 1c.1 — is the right import path; adjust the cast shape if the real `Actor.Implementation` type disagrees.)

- [ ] **Step 2: Write `src/documents/combat.ts`**

```ts
/**
 * System Combat document — 2E initiative is ascending (lower total acts
 * first); Foundry's own default `_sortCombatants` is descending (high-first).
 * Combatants with no roll yet (`initiative` not a finite number) sort to the
 * END under ascending order too (mirrors core's `-Infinity`-for-descending
 * convention, inverted to `Infinity` here), so "hasn't gone yet" still reads
 * as "hasn't gone yet," not "always first."
 */
export class Adnd2eCombat extends Combat {
  override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
    const ia = Number.isFinite(a.initiative as number) ? (a.initiative as number) : Infinity;
    const ib = Number.isFinite(b.initiative as number) ? (b.initiative as number) : Infinity;
    return (ia - ib) || (a.id! > b.id! ? 1 : -1);
  }
}
```

- [ ] **Step 3: `src/documents/index.ts`** — add:
```ts
export { Adnd2eCombatant } from "./combatant";
export { Adnd2eCombat } from "./combat";
```

- [ ] **Step 4: `src/system.ts`** — import the two new classes and register them in the `init` hook, after the existing `CONFIG.ActiveEffect.documentClass` line:
```ts
CONFIG.Combatant.documentClass = Adnd2eCombatant;
CONFIG.Combat.documentClass = Adnd2eCombat;
```
Add `Adnd2eCombatant, Adnd2eCombat` to the existing `import { ... } from "./documents";` line.

- [ ] **Step 5: Gate**

```bash
npm run typecheck 2>&1 | tail -8
npm run lint 2>&1 | tail -8
npm run test:coverage 2>&1 | tail -12
npm run build 2>&1 | tail -15
```
(`npm run build` needs Foundry closed.) Coverage unchanged (no pure files touched this task).

- [ ] **Step 6: Commit**

```bash
git add src/documents/combatant.ts src/documents/combat.ts src/documents/index.ts src/system.ts
git commit -m "feat(sp3): Adnd2eCombatant/Adnd2eCombat — individual initiative + ascending tracker sort

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Foundry shell — attack/save roll actions on the character sheet

**Files:**
- Create: `src/sheets/character/combat-rolls.ts`
- Modify: `src/sheets/character/sheet.ts`
- Modify: `templates/actor/character/combat.hbs`
- Modify: `templates/actor/character/main.hbs`
- Modify: `templates/actor/character/partials/save-row.hbs`
- Modify: `lang/en.json`
- Modify: `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `buildAttackCardContext`, `buildSaveCardContext` (Task 3); `pickDamageDice` (Task 2); `AttackCardContext`/`SaveCardContext` (Task 3).
- Produces: `resolveTargetCombatInfo(targetActor): { ac: number; size: string | null }`; `rollAttack(sheetDocument, weaponItemId): Promise<void>`; `rollSave(sheetDocument, category): Promise<void>` — the sheet's new `rollAttack`/`rollSave` `data-action`s.

**Not unit-tested** (spec §9) — verified in the dev-world check.

- [ ] **Step 1: Write `src/sheets/character/combat-rolls.ts`**

```ts
import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";

/** Resolve an ANY-type target actor's AC (context-appropriate) and creature
 *  size — character/npc and creature store both under different paths and
 *  shapes (§4.1's "Reference facts" — confirmed by reading both DataModels). */
export function resolveTargetCombatInfo(
  targetActor: { type: string; system: Record<string, unknown>; items: Iterable<{ type: string; system: { size?: string } }> },
): { ac: number; size: string | null } {
  if (targetActor.type === "creature") {
    const sys = targetActor.system as { attributes?: { ac?: { value?: number } }; details?: { size?: string } };
    return { ac: sys.attributes?.ac?.value ?? 10, size: sys.details?.size ?? "medium" };
  }
  const sys = targetActor.system as { attributes?: { ac?: { normal?: number } } };
  const raceItem = [...targetActor.items].find((i) => i.type === "race");
  return { ac: sys.attributes?.ac?.normal ?? 10, size: raceItem?.system.size ?? "medium" };
}

interface AttackerActor {
  name: string; img: string;
  system: { attributes?: { thac0?: { melee?: number; ranged?: number } } };
  items: { get(id: string): WeaponItemHandle | undefined };
}
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
  };
}

/** Roll one attack for `weaponItemId` against the current token target(s) (or
 *  a manually-entered AC, via DialogV2, when zero or more than one is
 *  targeted). Posts an attack-roll chat card; a hit exposes a "Roll Damage"
 *  button (chat/chat-listeners.ts). */
export async function rollAttack(actor: AttackerActor, weaponItemId: string): Promise<void> {
  const weapon = actor.items.get(weaponItemId);
  if (!weapon) return;

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let targetSize: string | null = null;

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    const info = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]);
    targetAc = info.ac;
    targetSize = info.size;
  } else {
    const manualAc = await foundry.applications.api.DialogV2.prompt({
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
    });
    if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return;
    targetAc = manualAc;
  }

  const isRanged = weapon.system.category !== "melee";
  const thac0 = isRanged ? (actor.system.attributes?.thac0?.ranged ?? 20) : (actor.system.attributes?.thac0?.melee ?? 20);
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    // Proficiency/STR/DEX modifiers are intentionally NOT wired in SP3 — they
    // require the weaponProficiency-item lookup and ability-mod plumbing SP5
    // owns; a bare weapon-magic-only bonus is the honest v1 (spec §7 boundary).
  });
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = /* the raw d20 term result — implementer confirms the exact
    accessor against client/dice/roll.mjs / common/dice/terms/die.mjs (e.g.
    roll.terms[0].results[0].result) */ 0;
  const hit = hitResult({ naturalD20, attackBonus, thac0, targetAc });

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    damageContext: hit.hit ? { weaponItemId, actorId: (actor as unknown as { id: string }).id, targetSize } : null,
  });

  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context,
  );
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
    flags: { adnd2e: { card: "attack", ...context.damageContext } },
  });
}

/** Roll one of the 5 saving-throw categories using the actor's already-cached
 *  system.saves.<category>. */
export async function rollSave(
  actor: { name: string; img: string; system: { saves: Record<SaveCategory, { target: number; rollModifier: number }> } },
  category: SaveCategory,
): Promise<void> {
  const save = actor.system.saves[category];
  const roll = await new Roll(`1d20${save.rollModifier ? (save.rollModifier > 0 ? ` + ${save.rollModifier}` : ` - ${Math.abs(save.rollModifier)}`) : ""}`).evaluate();
  const naturalD20 = /* same natural-die accessor as rollAttack */ 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: `ADND2E.saves.${category}`,
    formula: roll.formula, naturalD20, rollModifier: save.rollModifier, target: save.target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content });
}
```

Implementer resolves the two `/* ... */` natural-d20-accessor placeholders by reading `client/dice/roll.mjs` and `common/dice/terms/die.mjs` (NOT a placeholder left in the delivered code — read the source, write the real accessor, e.g. `(roll.terms[0] as { results: { result: number }[] }).results[0].result`, and note in the task report which one it was). Also confirms `foundry.applications.handlebars.renderTemplate` is the correct v14 namespace (it replaced the old global `renderTemplate` — used already by nothing in this codebase yet, so check `client/applications/handlebars.mjs`).

- [ ] **Step 2: Wire the two actions into `src/sheets/character/sheet.ts`**

Add to the `actions` block in `DEFAULT_OPTIONS` (alongside `rollHp`/`takeAverageHp`/`awardXp`/`toggleDualClass`):
```ts
rollAttack: Adnd2eCharacterSheet.#onRollAttack,
rollSave: Adnd2eCharacterSheet.#onRollSave,
```
Add the import: `import { rollAttack, rollSave } from "./combat-rolls";` and `import type { SaveCategory } from "../../core/types";`. Add the two static handlers (same shape as `#onRollHp`):
```ts
static async #onRollAttack(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
  const weaponItemId = target.dataset.itemId;
  if (weaponItemId) await rollAttack(this.document as never, weaponItemId);
}

static async #onRollSave(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
  const category = target.dataset.save as SaveCategory | undefined;
  if (category) await rollSave(this.document as never, category);
}
```

- [ ] **Step 3: `templates/actor/character/combat.hbs`** — add a Roll Attack button to each weapon row, inside `.weapon-row`, after the existing spans:
```handlebars
{{#if w.equipped}}
  <button type="button" data-action="rollAttack" data-item-id="{{w.id}}">
    {{localize 'ADND2E.sheet.combat.rollAttack'}}
  </button>
{{/if}}
```
(Only equipped weapons get an attack button — matches the existing equip-gated display convention on this tab.)

- [ ] **Step 4: `templates/actor/character/partials/save-row.hbs`** — add a Roll button. Current file:
```handlebars
<tr class="save-row" data-save="{{row.key}}">
  <th scope="row">{{localize row.label}}</th>
  <td class="target">{{row.target}}</td>
  <td class="mod">{{adnd2eSigned row.rollModifier}}</td>
  <td class="effective">{{row.effectiveTarget}}</td>
</tr>
```
Add a 5th `<td>` with the button, and a 5th `<th>` column header in `main.hbs`'s save table (`templates/actor/character/main.hbs`, the `<thead><tr>` above the save rows):
```handlebars
<td class="roll">
  <button type="button" data-action="rollSave" data-save="{{row.key}}">
    {{localize 'ADND2E.sheet.combat.rollSave'}}
  </button>
</td>
```

- [ ] **Step 5: `lang/en.json`** — add under `ADND2E.sheet.combat` (extend the existing object): `"rollAttack": "Attack"`, `"rollSave": "Save"`. Add a new top-level `ADND2E.chat` tree (sibling of `ADND2E.sheet`):
```json
"chat": {
  "attack": {
    "rollAttack": "Roll Attack",
    "manualAcTitle": "Target Armor Class",
    "noTargetHint": "No token is targeted. Enter the target's Armor Class:",
    "multiTargetHint": "More than one token is targeted. Enter the intended target's Armor Class:",
    "hit": "Hit",
    "miss": "Miss",
    "autoHit": "Natural 20 — automatic hit",
    "autoMiss": "Natural 1 — automatic miss",
    "modStrength": "Strength", "modDexMissile": "Dexterity (missile)",
    "modWeaponMagic": "Weapon magic", "modProficiency": "Proficiency",
    "modRange": "Range", "modSituational": "Situational",
    "rollDamage": "Roll Damage"
  },
  "damage": {
    "applyToTargets": "Apply to Targeted Token(s)",
    "noTargetsWarning": "No token is targeted — nothing to apply damage to.",
    "notOwnerWarning": "You don't have permission to apply damage to one or more targeted tokens."
  },
  "save": {
    "success": "Success", "failure": "Failure"
  }
}
```

- [ ] **Step 6: `tests/lang/en-coverage.test.ts`** — add a `describe("lang/en.json — SP3 chat/combat strings")` block asserting `ADND2E.sheet.combat.{rollAttack,rollSave}` and every `ADND2E.chat.{attack,damage,save}.*` key above resolves to a non-empty string (follow the file's existing `resolve()` pattern).

- [ ] **Step 7: Gate**

```bash
npm run typecheck 2>&1 | tail -8
npm run lint 2>&1 | tail -8
npm run test:coverage 2>&1 | tail -14
npm run build 2>&1 | tail -15
```
`npm run build` will fail if `templates/chat/attack-roll.hbs`/`save-roll.hbs` don't exist yet — Task 6 creates them. **If Task 5 is executed before Task 6 exists, skip the build step here and note it in the report; the full gate is re-verified at the end of Task 6.**

- [ ] **Step 8: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/sheets/character/sheet.ts templates/actor/character/combat.hbs templates/actor/character/main.hbs templates/actor/character/partials/save-row.hbs lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp3): Roll Attack + Roll Save actions on the character sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Foundry shell — chat templates + Roll Damage / Apply Damage

**Files:**
- Create: `templates/chat/attack-roll.hbs`
- Create: `templates/chat/damage-roll.hbs`
- Create: `templates/chat/save-roll.hbs`
- Create: `src/chat/chat-listeners.ts`
- Modify: `src/system.ts`
- Modify: `lang/en.json` (if any key was missed in Task 5)

**Interfaces:**
- Consumes: `AttackCardContext`, `DamageCardContext`, `SaveCardContext` (Task 3); `pickDamageDice` (Task 2); `resolveTargetCombatInfo` (Task 5).
- Produces: `registerChatListeners(): void`.

**Not unit-tested** (spec §9) — verified in the dev-world check.

- [ ] **Step 1: `templates/chat/attack-roll.hbs`**

```handlebars
<div class="adnd2e chat-card attack-roll">
  <header>
    <img src="{{img}}" alt="{{actorName}}">
    <div>
      <h3>{{actorName}} — {{weaponName}}</h3>
      {{#if targetName}}<p class="target">{{localize 'ADND2E.chat.attack.rollAttack'}} → {{targetName}}</p>{{/if}}
    </div>
  </header>
  <p class="formula">{{formula}} = <strong>{{total}}</strong> ({{localize 'ADND2E.chat.attack.hit'}}/{{localize 'ADND2E.chat.attack.miss'}}: {{needed}})</p>
  {{#if autoHit}}<p class="result hit">{{localize 'ADND2E.chat.attack.autoHit'}}</p>
  {{else if autoMiss}}<p class="result miss">{{localize 'ADND2E.chat.attack.autoMiss'}}</p>
  {{else if hit}}<p class="result hit">{{localize 'ADND2E.chat.attack.hit'}} ({{margin}})</p>
  {{else}}<p class="result miss">{{localize 'ADND2E.chat.attack.miss'}} ({{margin}})</p>{{/if}}
  {{#if modifierBreakdown.length}}
    <ul class="modifiers">
      {{#each modifierBreakdown as |m|}}<li>{{localize m.label}}: {{adnd2eSigned m.value}}</li>{{/each}}
    </ul>
  {{/if}}
  {{#if (and hit damageContext)}}
    <button type="button" data-action="rollDamage"
      data-actor-id="{{damageContext.actorId}}" data-weapon-item-id="{{damageContext.weaponItemId}}"
      data-target-size="{{damageContext.targetSize}}">
      {{localize 'ADND2E.chat.attack.rollDamage'}}
    </button>
  {{/if}}
</div>
```
(Verify `and` is a real built-in Handlebars helper in v14 — `client/applications/handlebars.mjs`, same file the implementer already checked for `eq`/`concat`/`lookup` in SP2; if it isn't, restructure with a nested `{{#if hit}}{{#if damageContext}}...{{/if}}{{/if}}`.)

- [ ] **Step 2: `templates/chat/damage-roll.hbs`**

```handlebars
<div class="adnd2e chat-card damage-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{weaponName}}</h3>
  </header>
  <p class="formula">{{formula}} = <strong>{{total}}</strong></p>
  <button type="button" data-action="applyDamage" data-amount="{{total}}">
    {{localize 'ADND2E.chat.damage.applyToTargets'}}
  </button>
</div>
```

- [ ] **Step 3: `templates/chat/save-roll.hbs`**

```handlebars
<div class="adnd2e chat-card save-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{localize categoryLabel}}</h3>
  </header>
  <p class="formula">{{formula}} = <strong>{{total}}</strong> ({{localize 'ADND2E.chat.attack.hit'}}/{{localize 'ADND2E.chat.attack.miss'}}: {{target}})</p>
  {{#if success}}<p class="result hit">{{localize 'ADND2E.chat.save.success'}}</p>
  {{else}}<p class="result miss">{{localize 'ADND2E.chat.save.failure'}}</p>{{/if}}
</div>
```
(Reusing `ADND2E.chat.attack.hit`/`.miss` as generic "target:" labels here is a deliberate small reuse, not a bug — both mean "the number needed"; rename if it reads awkwardly once seen live.)

- [ ] **Step 4: Write `src/chat/chat-listeners.ts`**

```ts
import { buildDamageCardContext } from "../combat/damage-card";
import { pickDamageDice } from "../combat/damage-dice";
import { damageModifiers } from "../core/combat/damage";
import { damageFormula } from "../core/dice/formula";
import { TEMPLATE_PATH } from "../constants";
import { SYSTEM_ID } from "../constants";

async function onRollDamage(button: HTMLButtonElement): Promise<void> {
  const { actorId, weaponItemId, targetSize } = button.dataset as {
    actorId?: string; weaponItemId?: string; targetSize?: string;
  };
  const actor = (game as unknown as { actors: { get(id: string): { name: string; img: string; items: { get(id: string): { name: string; system: { damageVsSM: string | null; damageVsL: string | null; magicBonus: number } } | undefined } } | undefined } }).actors.get(actorId ?? "");
  const weapon = actor?.items.get(weaponItemId ?? "");
  if (!actor || !weapon) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.noTargetsWarning"));
    return;
  }
  const dice = pickDamageDice(
    { damageVsSM: weapon.system.damageVsSM, damageVsL: weapon.system.damageVsL },
    (targetSize as never) || null,
  );
  if (!dice) return; // no dice modeled (e.g. a ranged weapon with no ammo item — spec §7)

  const { total: damageBonus } = damageModifiers({ weaponMagicBonus: weapon.system.magicBonus });
  const formula = damageFormula(dice, damageBonus);
  const roll = await new Roll(formula).evaluate();
  const rolledBaseDamage = /* the base-dice sub-total, pre-bonus — implementer
    confirms the exact accessor (likely roll.terms[0] before the OperatorTerm/
    NumericTerm bonus) against client/dice/roll.mjs */ 0;

  const context = buildDamageCardContext({
    actorName: actor.name, actorImg: actor.img, weaponName: weapon.name,
    formula, rolledBaseDamage, damageBonus,
  });
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/damage-roll.hbs"), context);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content });
}

async function onApplyDamage(button: HTMLButtonElement): Promise<void> {
  const amount = Number(button.dataset.amount ?? 0);
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: unknown }> } }).user.targets];
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.noTargetsWarning"));
    return;
  }
  const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
  for (const t of targets) {
    const actor = t.actor as { isOwner: boolean; system: { attributes: { hp: { value: number; temp?: number } } }; update(data: Record<string, unknown>): Promise<unknown> } | null;
    if (!actor) continue;
    if (!isGM && !actor.isOwner) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.notOwnerWarning"));
      continue;
    }
    const hp = actor.system.attributes.hp;
    const temp = hp.temp ?? 0;
    const fromTemp = Math.min(temp, amount);
    const fromValue = amount - fromTemp;
    const update: Record<string, unknown> = { "system.attributes.hp.value": hp.value - fromValue };
    if ("temp" in hp) update["system.attributes.hp.temp"] = temp - fromTemp;
    await actor.update(update);
  }
}

/** Wires the "Roll Damage" / "Apply Damage" buttons on SP3's chat cards. Call
 *  once from the `ready` hook. */
export function registerChatListeners(): void {
  Hooks.on("renderChatMessageHTML", (_message: unknown, html: HTMLElement) => {
    html.querySelector<HTMLButtonElement>('[data-action="rollDamage"]')?.addEventListener("click", (ev) => {
      void onRollDamage(ev.currentTarget as HTMLButtonElement);
    });
    html.querySelector<HTMLButtonElement>('[data-action="applyDamage"]')?.addEventListener("click", (ev) => {
      void onApplyDamage(ev.currentTarget as HTMLButtonElement);
    });
  });
}
```
Implementer resolves the `rolledBaseDamage` placeholder the same way as Task 5's natural-d20 accessor (read `client/dice/roll.mjs`'s term structure for a `damageFormula` result like `"1d8 + 2"` — the base dice sub-total is the roll's total MINUS the flat bonus, which is simpler and more robust than reading terms directly: `const rolledBaseDamage = roll.total! - damageBonus;`; use that instead of parsing terms if it's cleaner — implementer's call, note which approach was used in the report).

- [ ] **Step 5: `src/system.ts`** — import `registerChatListeners` from `./chat/chat-listeners` and call it inside the existing `ready` hook, after `game.system.api = buildApi()`:
```ts
registerChatListeners();
```

- [ ] **Step 6: Full gate**

```bash
npm run typecheck 2>&1 | tail -8
npm run lint 2>&1 | tail -8
npm run test:coverage 2>&1 | tail -16
npm run build 2>&1 | tail -20
```
(`npm run build` needs Foundry closed.) After a clean build: `ls dist/templates/chat/` (3 files) and `grep -c "Adnd2eCombatant\|registerChatListeners" dist/system.js` (≥ 2).

- [ ] **Step 7: Commit**

```bash
git add templates/chat/attack-roll.hbs templates/chat/damage-roll.hbs templates/chat/save-roll.hbs src/chat/chat-listeners.ts src/system.ts
git commit -m "feat(sp3): Roll Damage / Apply Damage chat-card flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: GATED dev-world smoke check

**Files:** none — verification. Runs **before** `finishing-a-development-branch`; the branch does not finish until every check passes or a failure becomes a fix.

**Why gated:** the Foundry shell (rolls, chat cards, document overrides) has no unit tests by design (parent spec §9). SP1/SP2 both found real, review-invisible bugs only at this step.

- [ ] **Step 1: Build + link.**

```bash
npm run build   # Foundry must be closed
npm run link
```
Launch Foundry v14.364, open the test world.

- [ ] **Step 2: Attack roll, hit.** Place two tokens on a scene: an attacker `character` with an equipped weapon, a defender with a known AC (a `character`/`npc` or a `creature` — try one of each across this checklist). Target the defender, click **Attack** on the weapon row. Chat card shows the formula, the natural d20, the hit/miss line, and (if any weapon magic bonus is set) the modifier breakdown.

- [ ] **Step 3: Roll Damage → Apply.** On a hit, click **Roll Damage** — the card shows the right die for the target's size (try a Large target to confirm `damageVsL` is picked over `damageVsSM`). Click **Apply to Targeted Token(s)** — the target's HP drops by the rolled total; if the target has temp HP set, confirm it absorbs first and the remainder comes off `value`.

- [ ] **Step 4: No-target / multi-target dialogs.** Clear all targets, click Attack again — a manual-AC dialog appears and the roll still resolves against the number you enter. Target two tokens at once, click Attack — the same dialog appears (multi-target hint wording).

- [ ] **Step 5: Saving throws.** Click **Save** on each of the 5 save rows (Main tab) — each chat card's target/pass-fail matches the sheet's already-displayed `system.saves.<k>` numbers.

- [ ] **Step 6: Initiative — weapon speed on.** Turn on the `weaponSpeedInitiative` world setting. Create a Combat encounter, add 3+ combatants (mixed DEX and weapon speed factors — at least one unarmed). Roll initiative for all. Confirm: (a) the Combat Tracker order is **ascending** — lowest total goes first, shown as a **positive** number (not negative); (b) a combatant with a slower (higher speed-factor) weapon goes later, all else equal; (c) a high-DEX combatant (negative reaction adj) goes earlier, all else equal.

- [ ] **Step 7: Initiative — weapon speed off.** Turn the setting off, re-roll. Confirm weapon speed no longer shifts the total (DEX reaction adjustment still does) — i.e. two combatants with different weapons but the same DEX now tie (or differ only by the manual situational-modifier flag, if set).

- [ ] **Step 8: Record.** Write PASS/FAIL per step into the SDD report / ledger. Any FAIL becomes a fix (resume the relevant implementer) before the branch finishes. Delete the smoke-test actors/tokens/combat encounter afterward.

---

## Self-Review

**1. Spec coverage.**
- §2 "Damage application: manual, via a chat-card button" → Task 6 (`onApplyDamage`, no auto-apply anywhere). ✓
- §2 "Attack targeting: native token targeting + manual-AC fallback" → Task 5 `rollAttack` (`game.user.targets`, 0/many → `DialogV2`). ✓
- §2 "Initiative: DEX reaction always + weapon speed on toggle + manual situational field" → Task 4 `Adnd2eCombatant._getInitiativeFormula`. ✓
- §2 "Damage-dice pick: auto-detect from target size" → Task 2 `pickDamageDice` + Task 6's `onRollDamage` call site. ✓
- §2 "Group initiative: out of scope" → no task implements it; not referenced anywhere. ✓
- §2 "Saving throws: roll button, no apply-consequence automation" → Task 5 `rollSave` / `templates/chat/save-roll.hbs` (pass/fail only, no follow-up action). ✓
- §2 "Combat-tracker sort: ascending" → Task 4 `Adnd2eCombat._sortCombatants`. ✓
- §4.1/§4.2 pure/shell file map → every file in the plan's File Structure section matches. ✓
- §5 error handling — no-cached-thac0 (n/a, thac0 always has a default per SP1's derive contract, noted); 0/multi-target dialog (Task 5); zero-targets-on-apply / non-owner-apply (Task 6 `onApplyDamage`'s two warnings); weapon-deleted-before-damage-roll (Task 6 `onRollDamage`'s `if (!actor || !weapon)` guard). ✓
- §6 testing strategy — pure 100% (Tasks 1–3); the 7-step dev-world check → Task 7 verbatim. ✓
- §7 scope boundary — no task adds ability checks, spellcasting, Combat & Tactics maneuvers, group initiative, creature roll buttons, resistance automation, or save-consequence automation. The ammunition/ranged-damage gap is explicitly handled (`pickDamageDice` returning `null`, Task 6's early-return). ✓

**2. Placeholder scan.** Two `/* ... */` spots remain in Tasks 5–6's code (the natural-d20 accessor, the rolled-base-damage accessor) — both are Foundry-API specifics the plan explicitly instructs the implementer to resolve by reading real v14 `Roll`/`Die` source (not a deferred design decision — the *behavior* is fully specified: "the raw natural d20", "the base dice sub-total pre-bonus", with a concrete suggested expression for the latter). This matches the established, reviewer-accepted pattern from SP2's Task 5 (Ruling PF-3: Foundry-layer specifics verified against source during implementation, gated by the dev-world check) — not a "TBD". No other placeholder patterns found.

**3. Type consistency.** `initiativeModifiers`/`initiativeFormula` (Task 1) signatures match their Task 4 call site exactly. `pickDamageDice(weapon: WeaponDamageDice, targetSize: CreatureSize | null)` (Task 2) matches both call sites (Task 5's `damageContext.targetSize` threading and Task 6's `onRollDamage`). `AttackCardInput`/`DamageCardInput`/`SaveCardInput` → `*CardContext` (Task 3) field names match Task 5/6's construction call sites field-for-field (`hit`, `modifierBreakdown`, `damageContext`, `rolledBaseDamage`, `damageBonus`, `categoryLabel`, `rollModifier`). `resolveTargetCombatInfo` (Task 5) return shape `{ac, size}` matches its one call site in `rollAttack`. `ADND2E.chat.*`/`ADND2E.sheet.combat.roll*` lang keys introduced in Task 5 are exactly the keys Tasks 5–6's templates/builders reference — no drift.
