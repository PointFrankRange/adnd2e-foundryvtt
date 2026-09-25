# Sub-project 9 Plan 9a: Casting Time & Spell Disruption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the PHB's optional casting-time rule (casting time added to initiative; multi-round spells complete at the end of their last round), automatic spell disruption (hit-point loss or a failed save while casting loses the spell), and no Dexterity AC bonus while casting — behind the `spellsAndMagicEnabled && expandedCastingTime` settings gate.

**Architecture:** A pure `src/core/magic/casting-time.ts` owns the gate helper, the free-text casting-time parser, the casting plan, the completion/disruption predicates and the AC rule. The actor stores the in-progress cast in a typed `system.options.spellsAndMagic.casting` field. Foundry glue routes the existing Cast button through Begin → Complete when the caster is in a started combat; a hook module running only on the active GM's client disrupts casts on hit-point loss or a flagged failed-save chat message and clears casts when a combat is deleted.

**Tech Stack:** TypeScript, Vite, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-24-adnd2e-sp9-casting-time-design.md` — §2 Decisions, §3 Global Constraints, §4, §5, §6, §7.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — never `fvtt-types` (pinned to v13-beta, wrong about several v14 APIs).
- **Two-layer contract:** pure zone = `src/core/**`, `src/magic/**`, `src/data/derive/**`, `src/settings/registry.ts`, and the file-by-file listed `src/sheets/character/{context,context-types}.ts`: no Foundry imports, **100% line/statement/function coverage** (branches ≥ 90). Foundry layer = `src/data/actor/*.ts`, `src/documents/*.ts`, `src/sheets/**/sheet.ts`, `src/sheets/character/{spell-actions,casting-actions,combat-rolls}.ts`, the NEW `src/hooks/casting-hooks.ts` (deliberately OUTSIDE `src/magic/**`, which is a pure-zone directory), `src/system.ts`, templates, SCSS, `lang/en.json` — typecheck/lint gated, dev-world verified, not unit-tested.
- **Content policy:** mechanical values only; PHB page citations in comments are fine; no rules prose.
- **Gating (locked, spec §2):** the expression `rules.spellsAndMagicEnabled && rules.expandedCastingTime` is written **exactly once**, as `expandedCastingTimeEnabled(rules)` in Task 2. Every consumer calls it. Do not restate it and do not read `rules.expandedCastingTime` anywhere else except `options.ts`/`registry.ts`.
- **Reload:** `spellsAndMagicEnabled` and `expandedCastingTime` both get `requiresReload: true` (the Dex-AC rule changes prepare-time derived AC).
- **Additive schema only — no migration, no version bump:** `system.options.spellsAndMagic` changes from an untyped `ObjectField` (`initial: {}`) to a typed `SchemaField({ casting: <nullable SchemaField, initial null> })`. Verified during planning (v14.364 `common/data/fields.mjs`): `DataField#clean` returns `getInitialValue` for `undefined` (line 237) and `getInitialValue` returns an explicit `initial` (263-265), so a stored `{}` cleans to `{ casting: null }`; nothing in `src/` reads or writes `system.options.spellsAndMagic` today. Task 3 re-confirms with a grep.
- **Permissions (verified during planning, v14.364 `common/documents/combatant.mjs:76-92`):** a non-GM user who OWNS the combatant's actor may update the combatant's `initiative` and `flags`. Begin/Complete therefore write only to the acting user's own actor and its combatant; every combatant write is still wrapped in try/catch and happens AFTER the user-visible chat card. All automatic disruption and cleanup writes run only on the active GM's client (`game.user.isActiveGM`, `client/documents/user.mjs:86`).
- **Every action re-derives eligibility** from the actor's current state and current settings — never rendered UI state.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; do not touch `package.json`/`package-lock.json`/`node_modules`. Implementers never run `npm run build`/`build:packs` (Foundry must be closed; the controller builds at Task 9 after re-confirming with the user).
- **Read vitest output with `tail`/`head`/redirect, never `| grep`**; a cache-clear's first run can flake — rerun 2-3× before concluding anything.
- **The whole-branch review (Task 8) is MANDATORY**, and the dev-world check (Task 9) is GATED and MUST include a non-GM player seat.

## Locked design decisions (this plan's own, resolving what spec §4 left to the plan)

1. **Parser** (`parseCastingTime`): trimmed, case-insensitive. `^\d+$` → segments (0 allowed); `^(\d+)\s*rounds?$` with n ≥ 1 → rounds n; `^(\d+)\s*turns?$` with n ≥ 1 → rounds 10·n (a turn is 10 rounds); anything else (blank, "special", "1 hour", "1/2", "3 segments") → unknown. Unknown always casts immediately (today's flow).
2. **When the cast is "in combat":** the actor has a combatant in any STARTED combat (`combat.started`), found with `combat.getCombatantsByActor(actor)` (`client/documents/combat.mjs:168-174`, which handles token actors). Not in a started combat → today's immediate cast.
3. **Segment spells:** at Begin, if the combatant's `initiative` is already a number, `initiative += segments` (and no flag); otherwise the combatant flag `adnd2e.castingSegments = segments` is set and `Adnd2eCombatant._getInitiativeFormula` adds it to the situational modifier on the next roll (gated by the helper, so a stale flag is inert with the rule off). The flag is cleared on Complete/Disrupt/Cancel. A 0-segment spell adds nothing.
4. **Completion:** round spells → `combat.round >= completeRound` (the player clicks Complete at the end of that round; the cast stays disruptible until clicked). Segment spells → `combat.round > startRound`, or `combat.round === startRound` and it is the caster's turn (`combat.combatant` is the caster's combatant).
5. **Commitment:** Begin marks the memorized entry `expended` (a disrupted spell is lost, PHB p.86); Complete rolls the spell's automation and posts the normal cast card; Disrupt posts a "spell lost" card; Cancel (GM) clears silently. The entry stays expended in all three outcomes.
6. **Disruption detection (GM client only):** hit points — the casting state records `hp` at Begin; an `updateActor` whose new `system.attributes.hp.value` is BELOW the recorded `hp` disrupts; a higher value (healing) updates the recorded `hp`. Failed save — `rollSave` (PC/NPC) flags its chat message `flags.adnd2e.save = { actorUuid, success }`; a `createChatMessage` hook sees `success === false` for a casting actor and disrupts. No new socket. Combat deletion (`deleteCombat`) clears every cast whose `combatId` matches.
7. **Dex AC:** `acDexAdjWhileCasting(adj, casting)` returns `Math.max(0, adj)` while casting (a beneficial, negative, AC-scale adjustment is dropped; a penalty stays) and `adj` unchanged otherwise. Applied only to the value passed to `deriveAc` (saves are untouched). `deriveCharacter` passes `snapshot.isCasting && expandedCastingTimeEnabled(options)`.
8. **UI:** the shared `spells.hbs` (PC and NPC sheets) shows a Casting panel (spell name, when it completes, Complete for anyone who can edit, Disrupt/Cancel for the GM) and hides every Cast button while casting; the shared `header.hbs` shows a "Casting" badge next to AC. All flags are precomputed in the pure context — no root reference inside any `{{#each}}`.
9. **Parked toggles:** `spellPoints` and `channelers` stay `optionalRulesKey: null`; their hints say they come from *Player's Option: Spells & Magic*, which this system does not reference.

---

### Task 1: Wire the two settings into `OptionalRules`

**Files:**
- Modify: `src/core/options.ts`, `src/settings/registry.ts:45-49`, `lang/en.json` (the four `spellsAndMagic*`/`spellPoints`/`expandedCastingTime`/`channelers` hints), `tests/core/options.test.ts`, `tests/settings/registry.test.ts`

**Interfaces:**
- Produces: `OptionalRules.spellsAndMagicEnabled: boolean` and `OptionalRules.expandedCastingTime: boolean` (both default `false`) — consumed by Task 2's helper.

- [ ] **Step 1: Update the tests (they must fail)**

In `tests/core/options.test.ts`: rename the first test to `"has exactly the twenty core, combatAndTactics, skillsAndPowers and spellsAndMagic toggles"` and add `"expandedCastingTime"` and `"spellsAndMagicEnabled"` to the key list; add `spellsAndMagicEnabled: false, expandedCastingTime: false,` to the `expected` object (after `expandedProficiencies: false,`).

In `tests/settings/registry.test.ts` replace the binding test and the reload test with:
```typescript
  it("core, combatAndTactics, skillsAndPowers and two spellsAndMagic settings bind 1:1 to OptionalRules fields", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(20);
    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());
    const unbound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey === null).map((d) => d.key).sort();
    expect(unbound).toEqual(["channelers", "spellPoints"]);
  });

  it("exactly the five prepare-time rules require a world reload", () => {
    const reload = ["characterPointBuild", "expandedCastingTime", "skillsAndPowersEnabled", "spellsAndMagicEnabled", "subAbilityScores"];
    const keys = SETTING_DESCRIPTORS.filter((d) => d.requiresReload === true).map((d) => d.key);
    expect(keys.sort()).toEqual(reload);
    for (const d of SETTING_DESCRIPTORS) {
      if (reload.includes(d.key)) expect(d.requiresReload).toBe(true);
      else expect(d.requiresReload).not.toBe(true);
    }
  });
```
Run `npx vitest run tests/core/options.test.ts tests/settings 2>&1 | tail -20` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/core/options.ts`: update the header comment's last sentence to "`spellsAndMagic.spellPoints` and `.channelers` are registered but not implemented (they come from *Player's Option: Spells & Magic*, which this system does not reference)."; add to the interface after `expandedProficiencies`:
```typescript
  /** Sub-project 9 master switch — every other spellsAndMagic.* key is a
   *  no-op unless this is also true. */
  spellsAndMagicEnabled: boolean;
  /** Sub-project 9 Plan 9a: PHB casting time + spell disruption (PHB p.86-87, p.95). */
  expandedCastingTime: boolean;
```
and `spellsAndMagicEnabled: false, expandedCastingTime: false,` to `DEFAULT_OPTIONAL_RULES` (after `expandedProficiencies: false,`).

`src/settings/registry.ts`: change the comment to `// --- spellsAndMagic: Sub-project 9 ---` and the two descriptors to
```typescript
  { key: "spellsAndMagicEnabled", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "spellsAndMagicEnabled", requiresReload: true },
  { key: "spellPoints", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "expandedCastingTime", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "expandedCastingTime", requiresReload: true },
  { key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
```
`lang/en.json` hints:
- `spellsAndMagicEnabled`: `"Master switch for the Spells & Magic option group — every other Spells & Magic rule is a no-op unless this is also on."`
- `spellPoints`: `"Not implemented — spell points come from Player's Option: Spells & Magic, which this system does not reference."`
- `expandedCastingTime`: `"Casting time adds to initiative, multi-round spells finish at the end of their last round, and losing hit points or failing a save while casting loses the spell; no Dexterity AC bonus while casting (PHB optional rule)."`
- `channelers`: `"Not implemented — channelers come from Player's Option: Spells & Magic, which this system does not reference."`

- [ ] **Step 3: Verify** — `npx vitest run tests/core tests/settings tests/lang tests/config 2>&1 | tail -20` passes; typecheck, lint and `npm run test:coverage` (each redirected to a file under `$TEMP` and read with `tail`) exit 0.

- [ ] **Step 4: Commit**
```bash
git add src/core/options.ts src/settings/registry.ts lang/en.json tests/core/options.test.ts tests/settings/registry.test.ts
git commit -m "feat(sp9a): wire the Spells & Magic master and casting-time toggles into OptionalRules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pure casting-time module

**Files:**
- Create: `src/core/magic/casting-time.ts`
- Modify: `src/core/magic/index.ts` (append `export * from "./casting-time";`)
- Test: `tests/core/magic/casting-time.test.ts`

**Interfaces:**
- Consumes: `OptionalRules` (Task 1).
- Produces (Tasks 3-7): `expandedCastingTimeEnabled`, `CastingTime`, `parseCastingTime`, `CastingPlan`, `castingPlan`, `CastingState`, `canCompleteCasting`, `hpChangeDisrupts`, `acDexAdjWhileCasting`.

- [ ] **Step 1: Write the failing tests**

Create `tests/core/magic/casting-time.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  acDexAdjWhileCasting,
  canCompleteCasting,
  castingPlan,
  expandedCastingTimeEnabled,
  hpChangeDisrupts,
  parseCastingTime,
} from "../../../src/core/magic/casting-time";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("expandedCastingTimeEnabled (the one gate)", () => {
  it("needs the master switch AND the casting-time toggle", () => {
    expect(expandedCastingTimeEnabled(rules())).toBe(false);
    expect(expandedCastingTimeEnabled(rules({ spellsAndMagicEnabled: true }))).toBe(false);
    expect(expandedCastingTimeEnabled(rules({ expandedCastingTime: true }))).toBe(false);
    expect(expandedCastingTimeEnabled(rules({ spellsAndMagicEnabled: true, expandedCastingTime: true }))).toBe(true);
  });
});

describe("parseCastingTime", () => {
  it.each([
    ["3", { kind: "segments", value: 3 }],
    ["0", { kind: "segments", value: 0 }],
    [" 12 ", { kind: "segments", value: 12 }],
    ["1 round", { kind: "rounds", value: 1 }],
    ["2 rounds", { kind: "rounds", value: 2 }],
    ["2 Rounds", { kind: "rounds", value: 2 }],
    ["3rounds", { kind: "rounds", value: 3 }],
    ["1 turn", { kind: "rounds", value: 10 }],
    ["2 TURNS", { kind: "rounds", value: 20 }],
  ])("%j -> %j", (text, expected) => {
    expect(parseCastingTime(text)).toEqual(expected);
  });

  it.each(["", "   ", "special", "1 hour", "1/2", "3 segments", "0 rounds", "0 turns", "-1", "1.5", "round"])(
    "%j is unknown",
    (text) => {
      expect(parseCastingTime(text)).toEqual({ kind: "unknown" });
    },
  );
});

describe("castingPlan", () => {
  it("casts an unknown time immediately", () => {
    expect(castingPlan({ kind: "unknown" }, 4)).toEqual({ mode: "immediate" });
  });
  it("adds segments to initiative", () => {
    expect(castingPlan({ kind: "segments", value: 5 }, 4)).toEqual({ mode: "segments", initiativeAdd: 5 });
  });
  it("completes a round spell at the end of its last round (start round counts as the first)", () => {
    expect(castingPlan({ kind: "rounds", value: 1 }, 4)).toEqual({ mode: "rounds", completeRound: 4 });
    expect(castingPlan({ kind: "rounds", value: 3 }, 4)).toEqual({ mode: "rounds", completeRound: 6 });
  });
});

describe("canCompleteCasting", () => {
  it("round spells complete from their complete round on", () => {
    const s = { startRound: 2, completeRound: 3 };
    expect(canCompleteCasting(s, { combatRound: 2, isCasterTurn: true })).toBe(false);
    expect(canCompleteCasting(s, { combatRound: 3, isCasterTurn: false })).toBe(true);
    expect(canCompleteCasting(s, { combatRound: 5, isCasterTurn: false })).toBe(true);
  });
  it("segment spells complete on the caster's turn in the start round, or any later round", () => {
    const s = { startRound: 2, completeRound: null };
    expect(canCompleteCasting(s, { combatRound: 2, isCasterTurn: false })).toBe(false);
    expect(canCompleteCasting(s, { combatRound: 2, isCasterTurn: true })).toBe(true);
    expect(canCompleteCasting(s, { combatRound: 3, isCasterTurn: false })).toBe(true);
    expect(canCompleteCasting(s, { combatRound: 1, isCasterTurn: true })).toBe(false);
  });
});

describe("hpChangeDisrupts", () => {
  it("is true only when hit points fall below the recorded value", () => {
    expect(hpChangeDisrupts(20, 19)).toBe(true);
    expect(hpChangeDisrupts(20, -3)).toBe(true);
    expect(hpChangeDisrupts(20, 20)).toBe(false);
    expect(hpChangeDisrupts(20, 25)).toBe(false);
  });
});

describe("acDexAdjWhileCasting", () => {
  it("is unchanged when not casting", () => {
    expect(acDexAdjWhileCasting(-3, false)).toBe(-3);
    expect(acDexAdjWhileCasting(2, false)).toBe(2);
    expect(acDexAdjWhileCasting(0, false)).toBe(0);
  });
  it("drops a beneficial (negative) adjustment but keeps a penalty while casting", () => {
    expect(acDexAdjWhileCasting(-3, true)).toBe(0);
    expect(acDexAdjWhileCasting(2, true)).toBe(2);
    expect(acDexAdjWhileCasting(0, true)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/core/magic/casting-time.test.ts 2>&1 | tail -15` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/core/magic/casting-time.ts`:
```typescript
// PHB optional casting-time and spell-disruption rules (Sub-project 9 Plan 9a):
// a bare-number casting time adds to the caster's initiative; a spell of a
// round or more takes effect at the end of its last round (PHB p.87, p.95,
// Table 56); a caster who is hit or fails a save before the spell takes effect
// loses it, and gains no Dexterity AC bonus while casting (PHB p.86). Pure.
import type { OptionalRules } from "../options";

/**
 * THE one place the casting-time gate is written (master AND-gate). Every
 * consumer — derive, the sheet, the cast routing, the GM hooks, the combatant
 * initiative formula — calls this; never restate the expression.
 */
export function expandedCastingTimeEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "expandedCastingTime">,
): boolean {
  return rules.spellsAndMagicEnabled && rules.expandedCastingTime;
}

export type CastingTime =
  | { kind: "segments"; value: number }
  | { kind: "rounds"; value: number }
  | { kind: "unknown" };

const ROUNDS_PER_TURN = 10;

/** Reads a spell item's free-text `castingTime`. Anything it does not recognise is "unknown" (cast immediately). */
export function parseCastingTime(text: string): CastingTime {
  const t = text.trim().toLowerCase();
  if (/^\d+$/.test(t)) return { kind: "segments", value: Number(t) };
  const rounds = /^(\d+)\s*rounds?$/.exec(t);
  if (rounds && Number(rounds[1]) >= 1) return { kind: "rounds", value: Number(rounds[1]) };
  const turns = /^(\d+)\s*turns?$/.exec(t);
  if (turns && Number(turns[1]) >= 1) return { kind: "rounds", value: Number(turns[1]) * ROUNDS_PER_TURN };
  return { kind: "unknown" };
}

export type CastingPlan =
  | { mode: "immediate" }
  | { mode: "segments"; initiativeAdd: number }
  | { mode: "rounds"; completeRound: number };

/** How a cast begun in `currentRound` resolves. The start round counts as the first round of casting. */
export function castingPlan(ct: CastingTime, currentRound: number): CastingPlan {
  switch (ct.kind) {
    case "segments":
      return { mode: "segments", initiativeAdd: ct.value };
    case "rounds":
      return { mode: "rounds", completeRound: currentRound + ct.value - 1 };
    default:
      return { mode: "immediate" };
  }
}

/** The in-progress cast stored on the actor at `system.options.spellsAndMagic.casting`. */
export interface CastingState {
  spellItemId: string;
  casterKey: "wizard" | "priest";
  combatId: string;
  startRound: number;
  /** round spells: the round at whose end the spell takes effect; null for segment spells */
  completeRound: number | null;
  /** segment spells: the initiative addition; null for round spells */
  segments: number | null;
  /** hit points when the cast began (raised by healing); a drop below this disrupts */
  hp: number;
}

/** Whether the caster may complete the cast now. */
export function canCompleteCasting(
  state: Pick<CastingState, "startRound" | "completeRound">,
  now: { combatRound: number; isCasterTurn: boolean },
): boolean {
  if (state.completeRound !== null) return now.combatRound >= state.completeRound;
  return now.combatRound > state.startRound || (now.combatRound === state.startRound && now.isCasterTurn);
}

/** A cast is disrupted when hit points fall below the recorded value (PHB p.86: struck before the spell is cast). */
export function hpChangeDisrupts(recordedHp: number, newHp: number): boolean {
  return newHp < recordedHp;
}

/**
 * The Dexterity defensive adjustment used for AC (AC-signed: negative = better).
 * While casting, a beneficial adjustment is dropped (PHB p.86); a penalty stays.
 */
export function acDexAdjWhileCasting(dexDefensiveAdj: number, casting: boolean): number {
  return casting ? Math.max(0, dexDefensiveAdj) : dexDefensiveAdj;
}
```
Append `export * from "./casting-time";` to `src/core/magic/index.ts`.

- [ ] **Step 4: Verify** — the focused test passes; typecheck, lint and `npm run test:coverage` exit 0 with `casting-time.ts` at 100%. If `export *` collides with an existing barrel name, report it rather than renaming plan names.

- [ ] **Step 5: Commit**
```bash
git add src/core/magic tests/core/magic/casting-time.test.ts
git commit -m "feat(sp9a): add pure casting-time module (gate, parser, plan, disruption, Dex AC)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Typed casting state, snapshot flag and the Dex-AC rule in derive

**Files:**
- Modify: `src/data/actor/base-actor.ts` (the `options.spellsAndMagic` field), `src/data/actor/snapshot.ts`, `src/data/derive/character/snapshot.ts`, `src/data/derive/character/derive.ts`, `tests/data/derive/character/derive.test.ts`, `tests/data/derive/character/traits.test.ts`
- Test: `tests/data/derive/character/casting-ac.test.ts`

**Interfaces:**
- Consumes: `expandedCastingTimeEnabled`, `acDexAdjWhileCasting` (Task 2).
- Produces: `ActorSnapshot.isCasting: boolean` (REQUIRED); actor field `system.options.spellsAndMagic.casting: CastingState | null`.

- [ ] **Step 1: Confirm the no-migration premise** — run `grep -rn "spellsAndMagic" src templates packs` and confirm the only hits are `options.ts`, `registry.ts`, `global.d.ts`, `base-actor.ts` and lang (nothing reads/writes the actor field). Write the result in your report.

- [ ] **Step 2: Failing tests**

Add `isCasting: false,` to EVERY object literal typed `ActorSnapshot` in `tests/data/derive/character/derive.test.ts` and `tests/data/derive/character/traits.test.ts` (grep `thiefSkillAllocations:` in `tests/data` to find them). Create `tests/data/derive/character/casting-ac.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";

const ON = { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true, expandedCastingTime: true };

// DEX 17 -> defensiveAdj -3 (AC 10 unarmored -> 7)
const agile: ActorSnapshot = {
  abilities: { str: 12, dex: 17, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [{ chassisId: "mage", specialistSchool: null, xp: 0, hpRolls: [4], dualClassState: null, level: 1 }],
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

describe("deriveCharacter — no Dexterity AC bonus while casting", () => {
  it("drops the Dex bonus from normal and shieldless AC only while casting with the rule on", () => {
    const idle = deriveCharacter(agile, ON);
    const casting = deriveCharacter({ ...agile, isCasting: true }, ON);
    expect(idle.ac.normal).toBe(7);
    expect(casting.ac.normal).toBe(10);
    expect(casting.ac.shieldless).toBe(10);
    // surprised / rear already deny Dex — unchanged
    expect(casting.ac.surprised).toBe(idle.ac.surprised);
    expect(casting.ac.rearAttack).toBe(idle.ac.rearAttack);
  });

  it("keeps a Dex AC penalty while casting", () => {
    const clumsy = { ...agile, abilities: { ...agile.abilities, dex: 3 }, isCasting: true };
    expect(deriveCharacter(clumsy, ON).ac.normal).toBe(deriveCharacter({ ...clumsy, isCasting: false }, ON).ac.normal);
  });

  it.each([
    ["everything off", DEFAULT_OPTIONAL_RULES],
    ["master only", { ...DEFAULT_OPTIONAL_RULES, spellsAndMagicEnabled: true }],
    ["toggle only", { ...DEFAULT_OPTIONAL_RULES, expandedCastingTime: true }],
  ])("rule off (%s): a casting flag changes nothing", (_label, rules) => {
    expect(deriveCharacter({ ...agile, isCasting: true }, rules)).toEqual(deriveCharacter(agile, rules));
  });

  it("does not touch saves while casting", () => {
    expect(deriveCharacter({ ...agile, isCasting: true }, ON).saves).toEqual(deriveCharacter(agile, ON).saves);
  });
});
```
Run `npx vitest run tests/data/derive 2>&1 | tail -20` — FAIL (`isCasting` unknown / AC unchanged).

NOTE for the implementer: the expected AC values above assume DEX 17 gives `defensiveAdj` −3 and DEX 3 gives a positive penalty in this repo's PHB Table 2. Check `src/core/abilities/dexterity.ts` and adjust the literal numbers (NOT the assertions' meaning) if the table differs; say so in the report.

- [ ] **Step 3: Implement**

`src/data/derive/character/snapshot.ts` — add to `ActorSnapshot` after `traits`:
```typescript
  /** true while `system.options.spellsAndMagic.casting` is set — honoured only while the casting-time rule is on */
  isCasting: boolean;
```
`src/data/derive/character/derive.ts` — add the import `import { acDexAdjWhileCasting, expandedCastingTimeEnabled } from "../../../core/magic/casting-time";` and, in `deriveCharacterBase`, change the AC call's `dexDefensiveAdj: abilities.dex.defensiveAdj,` to
```typescript
    // PHB p.86 — no Dexterity AC bonus while casting (casting-time rule only)
    dexDefensiveAdj: acDexAdjWhileCasting(
      abilities.dex.defensiveAdj,
      snapshot.isCasting && expandedCastingTimeEnabled(options),
    ),
```
(leave every other use of `abilities.dex.defensiveAdj`, e.g. saves, unchanged).

`src/data/actor/base-actor.ts` — replace the `spellsAndMagic` line inside `options: new SchemaField({ … })` with:
```typescript
      spellsAndMagic: new SchemaField({
        /** Sub-project 9 Plan 9a: the in-progress cast (null when idle). See core/magic/casting-time.ts CastingState. */
        casting: new SchemaField(
          {
            spellItemId: new StringField({ required: true, blank: false }),
            casterKey: new StringField({ required: true, blank: false, choices: ["wizard", "priest"] }),
            combatId: new StringField({ required: true, blank: false }),
            startRound: new NumberField({ required: true, integer: true, min: 0 }),
            completeRound: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
            segments: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
            hp: new NumberField({ required: true, integer: true }),
          },
          { required: true, nullable: true, initial: null },
        ),
      }),
```
`src/data/actor/snapshot.ts` — extend the local `doc` type's `system` with `options?: { spellsAndMagic?: { casting?: unknown } };` and add `isCasting: Boolean(doc.system.options?.spellsAndMagic?.casting),` to the returned object (after `traits`).

- [ ] **Step 4: Verify** — `npx vitest run tests/data 2>&1 | tail -20` passes; typecheck, lint, `npm run test:coverage` exit 0.

- [ ] **Step 5: Commit**
```bash
git add src/data tests/data
git commit -m "feat(sp9a): typed casting state and no Dex AC bonus while casting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Casting notice chat card (pure builder + template + lang)

**Files:**
- Create: `src/magic/casting-card.ts`, `templates/chat/casting-notice.hbs`
- Modify: `src/magic/card-types.ts`, `lang/en.json` (`ADND2E.chat.casting.*`), `tests/lang/en-coverage.test.ts`
- Test: `tests/magic/casting-card.test.ts`

**Interfaces:**
- Produces: `CastingNoticeInput`, `CastingNoticeContext`, `buildCastingNoticeContext(input)` — consumed by Task 6/7 glue.

- [ ] **Step 1: Failing tests**

Create `tests/magic/casting-card.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { buildCastingNoticeContext } from "../../src/magic/casting-card";

const base = { actorName: "Mira", actorImg: "m.png", spellName: "Fireball", spellLevel: 3 };

describe("buildCastingNoticeContext", () => {
  it("begin, segment spell: headline plus initiative detail", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "begin", completeRound: null, initiativeAdd: 3 })).toEqual({
      ...base,
      headlineKey: "ADND2E.chat.casting.begin",
      detailKey: "ADND2E.chat.casting.initiativeAdded",
      detailValue: 3,
      lost: false,
    });
  });
  it("begin, round spell: completes-at detail", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "begin", completeRound: 5, initiativeAdd: null })).toMatchObject({
      detailKey: "ADND2E.chat.casting.completesRound",
      detailValue: 5,
    });
  });
  it("begin with a zero-segment spell has no detail line", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "begin", completeRound: null, initiativeAdd: 0 })).toMatchObject({
      detailKey: null,
      detailValue: null,
    });
  });
  it("lost: headline only, flagged lost", () => {
    expect(buildCastingNoticeContext({ ...base, kind: "lost", completeRound: 5, initiativeAdd: null })).toEqual({
      ...base,
      headlineKey: "ADND2E.chat.casting.lost",
      detailKey: null,
      detailValue: null,
      lost: true,
    });
  });
});
```
Append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — SP9a casting chat strings", () => {
  it("resolves every ADND2E.chat.casting.* key", () => {
    for (const key of [
      "ADND2E.chat.casting.begin",
      "ADND2E.chat.casting.lost",
      "ADND2E.chat.casting.initiativeAdded",
      "ADND2E.chat.casting.completesRound",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run `npx vitest run tests/magic tests/lang 2>&1 | tail -20` — FAIL.

- [ ] **Step 2: Implement**

Append to `src/magic/card-types.ts`:
```typescript
export interface CastingNoticeInput {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  /** "begin" when a timed cast starts in combat; "lost" when it is disrupted */
  kind: "begin" | "lost";
  /** round spells: the round at whose end it takes effect */
  completeRound: number | null;
  /** segment spells: the initiative addition */
  initiativeAdd: number | null;
}

export interface CastingNoticeContext {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  headlineKey: string;
  /** i18n key of the detail line, or null when there is none */
  detailKey: string | null;
  detailValue: number | null;
  lost: boolean;
}
```
Create `src/magic/casting-card.ts`:
```typescript
import type { CastingNoticeContext, CastingNoticeInput } from "./card-types";

/** The "begins casting" / "spell lost" chat card's display data. */
export function buildCastingNoticeContext(input: CastingNoticeInput): CastingNoticeContext {
  const identity = {
    actorName: input.actorName,
    actorImg: input.actorImg,
    spellName: input.spellName,
    spellLevel: input.spellLevel,
  };
  if (input.kind === "lost") {
    return { ...identity, headlineKey: "ADND2E.chat.casting.lost", detailKey: null, detailValue: null, lost: true };
  }
  let detailKey: string | null = null;
  let detailValue: number | null = null;
  if (input.completeRound !== null) {
    detailKey = "ADND2E.chat.casting.completesRound";
    detailValue = input.completeRound;
  } else if (input.initiativeAdd !== null && input.initiativeAdd > 0) {
    detailKey = "ADND2E.chat.casting.initiativeAdded";
    detailValue = input.initiativeAdd;
  }
  return { ...identity, headlineKey: "ADND2E.chat.casting.begin", detailKey, detailValue, lost: false };
}
```
Create `templates/chat/casting-notice.hbs`:
```hbs
<div class="adnd2e chat-card casting-notice{{#if lost}} lost{{/if}}">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{spellName}} ({{localize 'ADND2E.sheet.spells.level' level=spellLevel}})</h3>
  </header>
  <p class="headline">{{localize headlineKey}}</p>
  {{#if detailKey}}<p class="detail">{{localize detailKey value=detailValue}}</p>{{/if}}
</div>
```
`lang/en.json` — add a `casting` object inside `ADND2E.chat` (sibling of `cast`):
```json
      "casting": {
        "begin": "begins casting.",
        "lost": "The spell is disrupted and lost.",
        "initiativeAdded": "Casting time +{value} to initiative; takes effect on the caster's turn.",
        "completesRound": "Takes effect at the end of round {value}."
      },
```

- [ ] **Step 3: Verify** — focused tests pass; typecheck, lint, `npm run test:coverage` exit 0 with `casting-card.ts` at 100%.

- [ ] **Step 4: Commit**
```bash
git add src/magic templates/chat/casting-notice.hbs lang/en.json tests/magic/casting-card.test.ts tests/lang/en-coverage.test.ts
git commit -m "feat(sp9a): casting notice chat card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pure sheet context — casting panel, hidden Cast buttons, AC badge flag

**Files:**
- Modify: `src/sheets/character/context-types.ts`, `src/sheets/character/context.ts`, `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `canCompleteCasting` (Task 2).
- Produces (Task 6): `CastingStatusInput`; `CharacterSheetInput.castingStatus?: CastingStatusInput | null`; `CharacterSheetContext.spells.casting: CastingPanel | null`; `CharacterSheetContext.vitals.casting: boolean`.

- [ ] **Step 1: Failing tests**

Append to `tests/sheets/character/context.test.ts` (uses its existing `input()` factory; add `CastingStatusInput` and `SpellItemView` to the type import if not already imported):
```typescript
describe("buildCharacterSheetContext — casting (SP9a)", () => {
  const status = (over: Partial<CastingStatusInput> = {}): CastingStatusInput => ({
    spellName: "Fireball",
    startRound: 2,
    completeRound: 3,
    segments: null,
    combatRound: 2,
    isCasterTurn: false,
    ...over,
  });
  const spell = (over: Partial<SpellItemView> = {}): SpellItemView => ({
    id: "s1", name: "Magic Missile", img: "", casterClass: "wizard", level: 1,
    schools: ["evocation"], spheres: [], range: "", castingTime: "1", savingThrow: "none",
    inSpellbook: true, memorized: false, expended: false, canMemorize: false, canCast: false, canLearn: false,
    ...over,
  });
  const memorizedWizard = () => {
    const d = input().derived;
    return {
      ...d,
      spellcasting: {
        ...d.spellcasting,
        wizard: { ...d.spellcasting.wizard, slots: { 1: { max: 1, used: 1 } }, memorized: [{ spellItemId: "s1", spellLevel: 1, expended: false }] },
      },
    };
  };

  it("with no casting status: no panel, no badge, and a memorized spell stays castable", () => {
    const c = buildCharacterSheetContext(input({ derived: memorizedWizard(), spellItems: [spell()] }));
    expect(c.spells.casting).toBeNull();
    expect(c.vitals.casting).toBe(false);
    expect(c.spells.known[0].items[0].canCast).toBe(true);
  });

  it("while casting: shows the panel and badge and hides every Cast button", () => {
    const c = buildCharacterSheetContext(input({ derived: memorizedWizard(), spellItems: [spell()], castingStatus: status() }));
    expect(c.vitals.casting).toBe(true);
    expect(c.spells.known[0].items[0].canCast).toBe(false);
    expect(c.spells.casting).toEqual({
      spellName: "Fireball",
      detailKey: "ADND2E.sheet.casting.completesRound",
      detailValue: 3,
      canComplete: false,
      canGmControl: true,
    });
  });

  it("a round spell can be completed from its complete round", () => {
    const c = buildCharacterSheetContext(input({ castingStatus: status({ combatRound: 3 }) }));
    expect(c.spells.casting!.canComplete).toBe(true);
  });

  it("a segment spell shows its initiative addition and completes on the caster's turn", () => {
    const seg = status({ completeRound: null, segments: 3 });
    const waiting = buildCharacterSheetContext(input({ castingStatus: seg })).spells.casting!;
    expect(waiting).toMatchObject({ detailKey: "ADND2E.sheet.casting.onYourTurn", detailValue: 3, canComplete: false });
    expect(buildCharacterSheetContext(input({ castingStatus: { ...seg, isCasterTurn: true } })).spells.casting!.canComplete).toBe(true);
  });

  it("a segment spell with no recorded segments shows 0", () => {
    const c = buildCharacterSheetContext(input({ castingStatus: status({ completeRound: null, segments: null }) }));
    expect(c.spells.casting!.detailValue).toBe(0);
  });

  it("cannot be completed outside a started combat (combatRound null) or by a viewer who cannot edit", () => {
    expect(buildCharacterSheetContext(input({ castingStatus: status({ combatRound: null }) })).spells.casting!.canComplete).toBe(false);
    const viewer = input({ castingStatus: status({ combatRound: 3 }), perms: { isGM: false, isOwner: false, editable: false } });
    expect(buildCharacterSheetContext(viewer).spells.casting).toMatchObject({ canComplete: false, canGmControl: false });
  });
});
```
If any EXISTING test compares a whole `vitals` object or a whole `spells` object with `toEqual`, add `casting: false` / `casting: null` to that expectation.

Run `npx vitest run tests/sheets 2>&1 | tail -20` — FAIL.

- [ ] **Step 2: Implement**

`src/sheets/character/context-types.ts` — add near `SubScoreCell`:
```typescript
/** Sub-project 9a: the in-progress cast, assembled by sheet.ts ONLY while the casting-time rule is on. */
export interface CastingStatusInput {
  spellName: string;
  startRound: number;
  completeRound: number | null;
  segments: number | null;
  /** the cast's combat round, or null when that combat no longer exists / has not started */
  combatRound: number | null;
  /** it is currently the caster's combatant's turn */
  isCasterTurn: boolean;
}

export interface CastingPanel {
  spellName: string;
  /** i18n key taking a `value` argument */
  detailKey: string;
  detailValue: number;
  canComplete: boolean;
  canGmControl: boolean;
}
```
add to `CharacterSheetInput`:
```typescript
  /** Sub-project 9a: the in-progress cast; absent/null when idle or the rule is off */
  castingStatus?: CastingStatusInput | null;
```
add `casting: boolean;` to `CharacterSheetContext["vitals"]` and `casting: CastingPanel | null;` to `CharacterSheetContext["spells"]`.

`src/sheets/character/context.ts` — import `canCompleteCasting` from `"../../core/magic/casting-time"` and `CastingPanel` (type) from `./context-types`. In `buildVitals` add `casting: Boolean(input.castingStatus),` to the returned object. Add:
```typescript
/* ---------- casting (SP9a) ---------- */

function buildCastingPanel(input: CharacterSheetInput): CastingPanel | null {
  const s = input.castingStatus;
  if (!s) return null;
  const isRounds = s.completeRound !== null;
  return {
    spellName: s.spellName,
    detailKey: isRounds ? "ADND2E.sheet.casting.completesRound" : "ADND2E.sheet.casting.onYourTurn",
    detailValue: isRounds ? (s.completeRound as number) : (s.segments ?? 0),
    canComplete:
      input.perms.editable &&
      s.combatRound !== null &&
      canCompleteCasting(s, { combatRound: s.combatRound, isCasterTurn: s.isCasterTurn }),
    canGmControl: input.perms.isGM,
  };
}
```
In `buildSpells`: compute `const casting = buildCastingPanel(input);`, after building each level's `items` map them with `casting ? items.map((r) => ({ ...r, canCast: false })) : items` (keep the existing variable names; one extra line), and add `casting,` to the returned object.

- [ ] **Step 3: Verify** — `npx vitest run tests/sheets 2>&1 | tail -20` passes; typecheck, lint, `npm run test:coverage` exit 0; `context.ts` keeps 100% line/stmt/func.

- [ ] **Step 4: Commit**
```bash
git add src/sheets/character/context.ts src/sheets/character/context-types.ts tests/sheets/character/context.test.ts
git commit -m "feat(sp9a): casting panel and badge in the sheet context

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Begin / Complete / Disrupt / Cancel glue, initiative, sheets and templates

**Files:**
- Create: `src/sheets/character/casting-actions.ts`
- Modify: `src/sheets/character/spell-actions.ts`, `src/documents/combatant.ts`, `src/sheets/character/sheet.ts`, `src/sheets/npc/sheet.ts`, `templates/actor/character/spells.hbs`, `templates/actor/character/header.hbs`, `styles/actor/character.scss`, `lang/en.json`, `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: Task 2 (`expandedCastingTimeEnabled`, `parseCastingTime`, `castingPlan`, `canCompleteCasting`, `CastingState`), Task 4 (`buildCastingNoticeContext`), Task 5 (`CastingStatusInput`, context fields).
- Produces (Task 7): `disruptCasting(actor, { announce: boolean }): Promise<void>` and `readCasting(actor): CastingState | null` exported from `casting-actions.ts`.

Foundry layer: typecheck/lint gated, dev-world verified; only the lang test is unit-tested.

- [ ] **Step 1: Lang (failing test first)**

Append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — SP9a casting sheet strings", () => {
  it("resolves every ADND2E.sheet.casting.* and casting warning key", () => {
    for (const key of [
      "ADND2E.sheet.casting.title",
      "ADND2E.sheet.casting.badge",
      "ADND2E.sheet.casting.badgeHint",
      "ADND2E.sheet.casting.completesRound",
      "ADND2E.sheet.casting.onYourTurn",
      "ADND2E.sheet.casting.complete",
      "ADND2E.sheet.casting.disrupt",
      "ADND2E.sheet.casting.cancel",
      "ADND2E.sheet.casting.busyWarning",
      "ADND2E.sheet.casting.notReadyWarning",
      "ADND2E.sheet.casting.initiativeNotice",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run the lang test (FAIL), then add inside `ADND2E.sheet` (sibling of `spells`):
```json
      "casting": {
        "title": "Casting",
        "badge": "Casting",
        "badgeHint": "No Dexterity bonus to AC while casting.",
        "completesRound": "Takes effect at the end of round {value}.",
        "onYourTurn": "Takes effect on your turn (+{value} initiative).",
        "complete": "Complete casting",
        "disrupt": "Disrupt",
        "cancel": "Cancel",
        "busyWarning": "Already casting a spell — complete or cancel it first.",
        "notReadyWarning": "That spell can't be completed yet.",
        "initiativeNotice": "Casting time couldn't be added to initiative — the GM must adjust it."
      },
```
Re-run — pass.

- [ ] **Step 2: Refactor `castSpell` into reusable pieces (behavior-preserving)**

In `src/sheets/character/spell-actions.ts`, export the `SpellcasterActor`, `SpellItemHandle` and `MemorizedEntry` interfaces, export `casterKey`, and split `castSpell`'s roll and card code into two exported helpers — `castSpell` must behave EXACTLY as before (same toasts, same order: roll, then mark expended, then card):
```typescript
export type SpellRoll = Awaited<ReturnType<InstanceType<typeof Roll>["evaluate"]>>;
export type SpellRollResult = { kind: "damage" | "healing"; formula: string; total: number };

/** Rolls the spell's automation formula (damage wins over healing). `null` means the formula failed to roll — a toast was shown. */
export async function rollSpellAutomation(
  spell: SpellItemHandle,
): Promise<{ roll: SpellRoll | null; rollResult: SpellRollResult | null } | null> {
  const { damage, healing } = spell.system.automation;
  const formula = damage || healing;
  if (!formula) return { roll: null, rollResult: null };
  try {
    const roll = await new Roll(formula).evaluate();
    return { roll, rollResult: { kind: damage ? "damage" : "healing", formula, total: roll.total ?? 0 } };
  } catch {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castRollFailedWarning"));
    return null;
  }
}

/** Posts the normal cast chat card (with an Apply button when there was a roll). */
export async function postCastCard(
  actor: SpellcasterActor,
  spell: SpellItemHandle,
  rolled: { roll: SpellRoll | null; rollResult: SpellRollResult | null },
): Promise<void> {
  const context = buildCastCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell.name,
    spellLevel: spell.system.level,
    range: spell.system.range,
    duration: spell.system.duration,
    castingTime: spell.system.castingTime,
    savingThrow: spell.system.savingThrow,
    components: spell.system.components,
    rollResult: rolled.rollResult,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/cast-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  const speaker = ChatMessage.getSpeaker({ actor: actor as never });
  if (rolled.roll) {
    await rolled.roll.toMessage({ speaker, content } as unknown as Roll.MessageData);
  } else {
    await ChatMessage.create({ speaker, content } as unknown as ChatMessage.CreateData);
  }
}
```
and reduce `castSpell` (keeping its doc comment) to:
```typescript
export async function castSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const entry = list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const rolled = await rollSpellAutomation(spell);
  if (!rolled) return;
  const updated = list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m));
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
  await postCastCard(actor, spell, rolled);
}
```

- [ ] **Step 3: Initiative formula reads the casting-segments flag**

In `src/documents/combatant.ts`, import `expandedCastingTimeEnabled` from `"../core/magic/casting-time"`, read the rules once (`const rules = getOptionalRules();`, reusing it for the existing `weaponSpeedInitiative` check), and replace the `situationalModifier` computation with:
```typescript
    const getFlag = (key: string) =>
      (this as unknown as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, key);
    // SP9a: a segment spell begun before this round's roll adds its casting time here (PHB p.95).
    const castingSegments = expandedCastingTimeEnabled(rules) ? Number(getFlag("castingSegments") ?? 0) : 0;
    const situationalModifier = Number(getFlag("initiativeModifier") ?? 0) + castingSegments;
```

- [ ] **Step 4: `casting-actions.ts`**

Create `src/sheets/character/casting-actions.ts`:
```typescript
import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import {
  canCompleteCasting, castingPlan, expandedCastingTimeEnabled, parseCastingTime, type CastingState,
} from "../../core/magic/casting-time";
import { buildCastingNoticeContext } from "../../magic/casting-card";
import { getOptionalRules } from "../../settings";
import type { CastingStatusInput } from "./context-types";
import {
  casterKey, castSpell, postCastCard, rollSpellAutomation, type SpellcasterActor, type SpellItemHandle,
} from "./spell-actions";

/* ---------------------------------------------------------------------------
 * casting-actions — SP9a (PHB casting time + disruption).
 *
 * Foundry-coupled glue, dev-world verified. The math is the pure
 * core/magic/casting-time.ts; this file finds the caster's combat, writes the
 * caster's OWN actor/combatant (a non-GM owner may update their combatant's
 * `initiative` and `flags` — v14.364 common/documents/combatant.mjs:76-83),
 * and posts chat cards. Combatant writes always come AFTER the card and are
 * wrapped so a failure only produces a notice.
 * ------------------------------------------------------------------------- */

interface CombatantLike {
  id: string;
  initiative: number | null;
  update(data: Record<string, unknown>): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
}
interface CombatLike {
  id: string;
  started: boolean;
  round: number;
  combatant: { id: string } | null;
  getCombatantsByActor(actor: unknown): CombatantLike[];
}
type CastingActor = SpellcasterActor & {
  id: string;
  system: SpellcasterActor["system"] & {
    attributes: { hp: { value: number } };
    options?: { spellsAndMagic?: { casting?: CastingState | null } };
  };
};

const combats = (): CombatLike[] => [...((game as unknown as { combats: Iterable<CombatLike> }).combats ?? [])];

/** The started combat holding this actor, and its combatant. */
function findCombat(actor: unknown): { combat: CombatLike; combatant: CombatantLike } | null {
  for (const combat of combats()) {
    if (!combat.started) continue;
    const combatant = combat.getCombatantsByActor(actor)[0];
    if (combatant) return { combat, combatant };
  }
  return null;
}

export function readCasting(actor: { system: { options?: { spellsAndMagic?: { casting?: CastingState | null } } } }): CastingState | null {
  return actor.system.options?.spellsAndMagic?.casting ?? null;
}

async function postNotice(actor: CastingActor, spell: SpellItemHandle | undefined, kind: "begin" | "lost", casting: CastingState): Promise<void> {
  const context = buildCastingNoticeContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell?.name ?? "—",
    spellLevel: spell?.system.level ?? 0,
    kind,
    completeRound: casting.completeRound,
    initiativeAdd: casting.segments,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/casting-notice.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as unknown as ChatMessage.CreateData);
}

async function clearCombatantFlag(combatId: string, actor: unknown): Promise<void> {
  const combat = combats().find((c) => c.id === combatId);
  const combatant = combat?.getCombatantsByActor(actor)[0];
  try {
    await combatant?.unsetFlag(SYSTEM_ID, "castingSegments");
  } catch {
    // best effort — a stale flag is harmless once the cast is cleared (it only adds to the NEXT roll)
  }
}

/** The Cast button: today's immediate cast unless the rule is on, the caster is in a started combat and the casting time parses. */
export async function castOrBegin(actor: CastingActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  const ctx = expandedCastingTimeEnabled(getOptionalRules()) && spell ? findCombat(actor) : null;
  const plan = ctx && spell ? castingPlan(parseCastingTime(spell.system.castingTime), ctx.combat.round) : { mode: "immediate" as const };
  if (!ctx || !spell || plan.mode === "immediate") {
    await castSpell(actor, spellItemId);
    return;
  }
  if (readCasting(actor)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.casting.busyWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  if (!list.some((m) => m.spellItemId === spellItemId && !m.expended)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const casting: CastingState = {
    spellItemId,
    casterKey: key,
    combatId: ctx.combat.id,
    startRound: ctx.combat.round,
    completeRound: plan.mode === "rounds" ? plan.completeRound : null,
    segments: plan.mode === "segments" ? plan.initiativeAdd : null,
    hp: actor.system.attributes.hp.value,
  };
  // PHB p.86: the spell is committed when casting begins — a disruption loses it.
  await actor.update({
    [`system.spellcasting.${key}.memorized`]: list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m)),
    "system.options.spellsAndMagic.casting": casting,
  });
  await postNotice(actor, spell, "begin", casting);
  if (plan.mode === "segments" && plan.initiativeAdd > 0) {
    try {
      if (typeof ctx.combatant.initiative === "number") {
        await ctx.combatant.update({ initiative: ctx.combatant.initiative + plan.initiativeAdd });
      } else {
        await ctx.combatant.update({ [`flags.${SYSTEM_ID}.castingSegments`]: plan.initiativeAdd });
      }
    } catch {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.casting.initiativeNotice"));
    }
  }
}

/** Complete casting: re-checks that the cast may complete now, rolls the spell and posts its normal cast card. */
export async function completeCasting(actor: CastingActor): Promise<void> {
  const casting = readCasting(actor);
  const combat = casting ? combats().find((c) => c.id === casting.combatId && c.started) : undefined;
  const combatant = combat?.getCombatantsByActor(actor)[0];
  const spell = casting ? actor.items.get(casting.spellItemId) : undefined;
  const ready =
    expandedCastingTimeEnabled(getOptionalRules()) &&
    casting !== null && combat !== undefined && combatant !== undefined && spell !== undefined &&
    canCompleteCasting(casting, { combatRound: combat.round, isCasterTurn: combat.combatant?.id === combatant.id });
  if (!ready || !casting || !spell) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.casting.notReadyWarning"));
    return;
  }
  const rolled = await rollSpellAutomation(spell);
  if (!rolled) return;
  await actor.update({ "system.options.spellsAndMagic.casting": null });
  await postCastCard(actor, spell, rolled);
  await clearCombatantFlag(casting.combatId, actor);
}

/** Disrupts (announce: posts "spell lost") or cancels the cast. The memorized entry stays expended either way. */
export async function disruptCasting(actor: CastingActor, opts: { announce: boolean }): Promise<void> {
  const casting = readCasting(actor);
  if (!casting) return;
  await actor.update({ "system.options.spellsAndMagic.casting": null });
  if (opts.announce) await postNotice(actor, actor.items.get(casting.spellItemId), "lost", casting);
  await clearCombatantFlag(casting.combatId, actor);
}

/** The sheet's casting status — null while idle or while the rule is off. */
export function readCastingStatus(actor: CastingActor): CastingStatusInput | null {
  const casting = expandedCastingTimeEnabled(getOptionalRules()) ? readCasting(actor) : null;
  if (!casting) return null;
  const combat = combats().find((c) => c.id === casting.combatId);
  const combatant = combat?.getCombatantsByActor(actor)[0];
  return {
    spellName: actor.items.get(casting.spellItemId)?.name ?? "—",
    startRound: casting.startRound,
    completeRound: casting.completeRound,
    segments: casting.segments,
    combatRound: combat?.started ? combat.round : null,
    isCasterTurn: Boolean(combatant) && combat?.combatant?.id === combatant?.id,
  };
}
```
If `unsetFlag` with a path-style key or `update` with a `flags.adnd2e.*` key fails typecheck, cast through `unknown` in the existing style; do not change behavior.

- [ ] **Step 5: Wire the PC and NPC sheets**

In BOTH `src/sheets/character/sheet.ts` and `src/sheets/npc/sheet.ts`:
1. Import `castOrBegin, completeCasting, disruptCasting, readCastingStatus` from the casting-actions module (`./casting-actions` / `../character/casting-actions`).
2. Change the existing `#onCastSpell` handler to call `castOrBegin(this.document as never, id)` instead of `castSpell(...)` (remove the now-unused `castSpell` import if lint flags it).
3. Add actions `completeCasting`, `disruptCasting`, `cancelCasting` to `DEFAULT_OPTIONS.actions` with handlers:
```typescript
  static async #onCompleteCasting(this: <SheetClass>): Promise<void> {
    if (this.isEditable) await completeCasting(this.document as never);
  }
  static async #onDisruptCasting(this: <SheetClass>): Promise<void> {
    if (game.user?.isGM) await disruptCasting(this.document as never, { announce: true });
  }
  static async #onCancelCasting(this: <SheetClass>): Promise<void> {
    if (game.user?.isGM) await disruptCasting(this.document as never, { announce: false });
  }
```
(`<SheetClass>` = `Adnd2eCharacterSheet` / `Adnd2eNpcSheet`.)
4. In the input builder, add `castingStatus: readCastingStatus(this.document as never),` to the returned `CharacterSheetInput`.

- [ ] **Step 6: Templates + styles**

`templates/actor/character/spells.hbs` — insert directly after the opening `<section …>` line:
```hbs
  {{#if adnd2e.spells.casting}}
    <div class="casting panel">
      <h3>{{localize 'ADND2E.sheet.casting.title'}}: {{adnd2e.spells.casting.spellName}}</h3>
      <p class="detail">{{localize adnd2e.spells.casting.detailKey value=adnd2e.spells.casting.detailValue}}</p>
      <div class="casting-actions">
        {{#if adnd2e.spells.casting.canComplete}}
          <button type="button" data-action="completeCasting">{{localize 'ADND2E.sheet.casting.complete'}}</button>
        {{/if}}
        {{#if adnd2e.spells.casting.canGmControl}}
          <button type="button" data-action="disruptCasting">{{localize 'ADND2E.sheet.casting.disrupt'}}</button>
          <button type="button" data-action="cancelCasting">{{localize 'ADND2E.sheet.casting.cancel'}}</button>
        {{/if}}
      </div>
    </div>
  {{/if}}
```
`templates/actor/character/header.hbs` — directly after the AC `<span …>AC {{adnd2e.vitals.ac.normal}}</span>`:
```hbs
    {{#if adnd2e.vitals.casting}}<span class="casting-badge" title="{{localize 'ADND2E.sheet.casting.badgeHint'}}">{{localize 'ADND2E.sheet.casting.badge'}}</span>{{/if}}
```
`styles/actor/character.scss` — inside the existing sheet scope used by the Spells tab styles, add:
```scss
  .casting.panel {
    border-left: 3px solid var(--adnd2e-accent);

    .casting-actions {
      display: flex;
      gap: 0.5rem;
    }
  }

  .casting-badge {
    font-weight: 700;
    color: var(--adnd2e-accent);
  }
```

- [ ] **Step 7: Verify** — typecheck, lint, `npm run test:coverage` exit 0; `npx vitest run tests/lang 2>&1 | tail -10` passes. Do NOT run build. In your report, walk `castSpell` before/after and confirm its observable behavior (toasts, order, card) is unchanged with the rule off.

- [ ] **Step 8: Commit**
```bash
git add src/sheets src/documents/combatant.ts templates styles lang tests/lang
git commit -m "feat(sp9a): begin/complete casting in combat, casting-time initiative, casting panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: GM-client disruption and cleanup hooks; flag save messages

**Files:**
- Create: `src/hooks/casting-hooks.ts`
- Modify: `src/sheets/character/combat-rolls.ts` (`rollSave`), `src/system.ts`

**Interfaces:**
- Consumes: `disruptCasting`, `readCasting` (Task 6); `expandedCastingTimeEnabled`, `hpChangeDisrupts` (Task 2).
- Produces: `registerCastingHooks(): void`.

Foundry layer — dev-world verified.

- [ ] **Step 1: Flag the save message**

In `rollSave` (`src/sheets/character/combat-rolls.ts`) add `uuid: string;` to the `actor` parameter type and change the final line to
```typescript
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
    // SP9a: lets the active GM's client disrupt a cast on a failed save (PHB p.86)
    flags: { [SYSTEM_ID]: { save: { actorUuid: actor.uuid, success: context.success } } },
  } as never);
```
(`SYSTEM_ID` is already imported in this file; add the import if not.) The creature sheet's own save roll is unchanged.

- [ ] **Step 2: The hooks module**

Create `src/hooks/casting-hooks.ts`:
```typescript
import { SYSTEM_ID } from "../constants";
import { expandedCastingTimeEnabled, hpChangeDisrupts } from "../core/magic/casting-time";
import { getOptionalRules } from "../settings";
import { disruptCasting, readCasting } from "../sheets/character/casting-actions";

/* ---------------------------------------------------------------------------
 * casting-hooks — SP9a. Automatic spell disruption (PHB p.86) and cleanup.
 *
 * Every handler runs ONLY on the active GM's client (`game.user.isActiveGM`,
 * v14.364 client/documents/user.mjs:86), so it works whoever applied the damage
 * or rolled the save, and never asks a player for permissions they lack.
 * Registered once from the `ready` hook.
 * ------------------------------------------------------------------------- */

const isActiveGm = (): boolean => Boolean((game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM);
const ruleOn = (): boolean => expandedCastingTimeEnabled(getOptionalRules());

export function registerCastingHooks(): void {
  // Hit-point loss while casting disrupts; healing raises the recorded value.
  Hooks.on("updateActor", (actor: unknown, changed: unknown) => {
    if (!isActiveGm() || !ruleOn()) return;
    const doc = actor as Parameters<typeof readCasting>[0] & { update(d: Record<string, unknown>): Promise<unknown> };
    const casting = readCasting(doc);
    if (!casting) return;
    const newHp = foundry.utils.getProperty(changed as object, "system.attributes.hp.value");
    if (typeof newHp !== "number") return;
    if (hpChangeDisrupts(casting.hp, newHp)) void disruptCasting(doc as never, { announce: true });
    else if (newHp > casting.hp) void doc.update({ "system.options.spellsAndMagic.casting.hp": newHp });
  });

  // A failed saving throw while casting disrupts (the save card is flagged by rollSave).
  Hooks.on("createChatMessage", (message: unknown) => {
    if (!isActiveGm() || !ruleOn()) return;
    const flag = (message as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "save") as
      | { actorUuid?: string; success?: boolean }
      | undefined;
    if (!flag || flag.success !== false || !flag.actorUuid) return;
    const actor = foundry.utils.fromUuidSync(flag.actorUuid) as Parameters<typeof readCasting>[0] | null;
    if (actor && readCasting(actor)) void disruptCasting(actor as never, { announce: true });
  });

  // Ending a combat clears every cast that belonged to it (no card — nothing was disrupted).
  Hooks.on("deleteCombat", (combat: unknown) => {
    if (!isActiveGm()) return;
    const c = combat as { id: string; combatants: Iterable<{ actor: unknown }> };
    for (const combatant of c.combatants) {
      const actor = combatant.actor as (Parameters<typeof readCasting>[0] & { update(d: Record<string, unknown>): Promise<unknown> }) | null;
      if (actor && readCasting(actor)?.combatId === c.id) {
        void actor.update({ "system.options.spellsAndMagic.casting": null });
      }
    }
  });
}
```
Verify in v14 source (write the evidence in your report): (a) `updateActor` hook arguments are `(document, changed, options, userId)` and fire on every client including for the GM (`client/documents/abstract/client-document.mjs` `_onUpdate` → `Hooks.callAll`); (b) whether `updateActor` also fires for an UNLINKED token's synthetic actor when its delta changes hp (read `client/documents/actor-delta.mjs` / token `_onUpdate`); if it does not, record it as a known limitation in the report (the dev-world check uses a linked PC); (c) `foundry.utils.fromUuidSync` exists in v14 (else use the global `fromUuidSync`); (d) `createChatMessage` fires on the GM client for a player-created message.

- [ ] **Step 3: Register**

In `src/system.ts` import `registerCastingHooks` from `"./hooks/casting-hooks"` and call it in the `ready` hook right after `registerChatListeners();`.

- [ ] **Step 4: Verify** — typecheck, lint, `npm run test:coverage` exit 0 (the new file lives outside every coverage/pure-zone include — confirm `src/hooks` is not matched by `vitest.config.ts`/`tsconfig.core.json`/the ESLint pure zone). Do NOT run build.

- [ ] **Step 5: Commit**
```bash
git add src/hooks src/sheets/character/combat-rolls.ts src/system.ts
git commit -m "feat(sp9a): automatic spell disruption and combat-end cleanup on the active GM client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Whole-branch review

**MANDATORY regardless of how clean every per-task review was.** Every plan in Sub-project 7 had a real Critical/Important bug caught ONLY here; 8a found one Important; 8b and 8c were clean because the checklist below grew from those catches. This plan has more cross-client behavior than any since 7d — treat it as the primary safety net.

- [ ] Dispatch a whole-branch review on the most capable available model over the full range from this branch's base to HEAD. Point it at this plan's Global Constraints, "Locked design decisions", and spec §2/§4/§5/§7. Ask it to check, specifically:
  - **Gate stated once.** `grep` for `expandedCastingTime` / `spellsAndMagicEnabled`: outside `options.ts`, `registry.ts`, `casting-time.ts` (`expandedCastingTimeEnabled`) and tests, nothing restates the `&&` or reads the flag. Consumers: derive, combatant formula, `castOrBegin`, `completeCasting`, `readCastingStatus`, the two GM hooks.
  - **Reload.** Both settings have `requiresReload: true`; the registry test pins exactly five reload keys.
  - **Rule-off byte-for-byte.** With the rule off (each of the three off combinations): AC identical (`acDexAdjWhileCasting(adj, false)`), the combatant formula identical (castingSegments 0), the Cast button runs the refactored `castSpell` with identical toasts/order/card, no casting panel/badge, GM hooks return early. Walk the `castSpell` refactor line by line against the base.
  - **A mutation the acting non-GM user may not be permitted to make.** Begin/Complete write only the acting user's own actor (sheet requires `isEditable`) and that actor's combatant (`initiative`/`flags` only — allowed for an OWNER per `common/documents/combatant.mjs:76-83`); combatant writes happen AFTER the card and are caught; Disrupt/Cancel buttons are GM-only in both template and handler; the three hooks run only when `game.user.isActiveGM`; no toast precedes a user-visible card; nothing writes another user's document from a player client.
  - **Hook correctness.** No update loop (disrupt writes only `casting`; the healing branch writes only `casting.hp`); `hpChangeDisrupts` compares against the recorded value; a failed save by the caster disrupts, a successful one does not; `deleteCombat` clears only matching `combatId`; what happens for unlinked token actors (Task 7's report).
  - **Template binding:** the casting panel and badge reference only top-level `adnd2e.*` paths (none inside an `{{#each}}`); every Cast button is hidden while casting (row `canCast` false).
  - **NPC sheet shares the flow:** the NPC sheet routes Cast through `castOrBegin`, has the three new actions, and passes `castingStatus`; the shared `spells.hbs`/`header.hbs` render for both.
  - **Schema pruning / migration:** `options.spellsAndMagic` ObjectField→SchemaField: nothing previously stored there; stored `{}` cleans to `{ casting: null }`; nullable `casting` validates `null`; no version bump.
  - **Combat-end / stale state:** a cast whose combat ended or was deleted can't be completed (`notReadyWarning`), a GM can Cancel it, `deleteCombat` clears it; a stale `castingSegments` flag is inert with the rule off and only affects the next roll.
  - **Derive purity and coverage:** `src/core/**`, `src/magic/**`, `src/data/derive/**`, context files import nothing from Foundry; coverage/typecheck/lint green (re-run independently).
  - **PHB semantics:** segment casting time adds to initiative (later is worse — ascending order); round spells complete at the end of `start + N − 1`; the spell is expended at Begin and stays expended on disruption; Dex AC dropped only for normal/shieldless AC while casting, saves untouched.
- [ ] Fix every Critical/Important finding via the standard fix-round process (the controller never fixes findings directly); one scoped re-review of the fix wave.
- [ ] Once clean, run `npm run typecheck && npm run lint && npm run test:coverage` and confirm green before Task 9.

---

### Task 9: GATED dev-world smoke check

**REQUIRED — never deferred, never skipped, and it MUST include a non-GM player seat.** Confirm with the user that Foundry is fully closed before `npm run build`, then `npm run link`, then have the user restart Foundry. Both settings prompt a world reload when toggled — accept it each time.

Setup: a single-class **mage** PC with DEX 16+ (a Dex AC bonus), hit points rolled, and three memorized spells authored as world Items dragged onto the PC: "Test Missile" (castingTime `1`, automation damage `1d4+1`), "Test Web" (castingTime `2 rounds`), "Test Ritual" (castingTime `special`). A second **Player-role** user (private window) owns the PC. An NPC mage with one memorized "Test Missile". A combat containing the PC, the NPC and a GM-owned monster.

- [ ] **Rule off = today:** (each of everything off / master only / toggle only) in a started combat, Cast "Test Missile" posts the normal cast card immediately and marks it expended; no casting panel or badge; initiative unchanged; AC unchanged.
- [ ] **Segment spell (rule on):** before rolling initiative, Cast "Test Missile" → "begins casting … +1 initiative" card, spell shows expended, casting panel + "Casting" badge, AC loses the Dex bonus; roll initiative → the PC's total includes +1. When the PC's turn comes, "Complete casting" appears → click → the normal cast card with the damage roll and Apply button; panel and badge gone; AC restored. Repeat with initiative already rolled: the combatant's initiative increases by 1 immediately.
- [ ] **Round spell:** in round N Cast "Test Web" → card "takes effect at the end of round N+1"; Complete is not offered in round N; in round N+1 it is; completing posts the cast card.
- [ ] **Unknown time:** "Test Ritual" casts immediately even in combat.
- [ ] **Busy guard:** while casting, every Cast button is hidden (and a forced second begin shows the busy warning).
- [ ] **Disruption by damage:** begin "Test Web", then the GM applies damage to the PC (Apply Damage from an attack card, or edit HP down) → "The spell is disrupted and lost" card; panel/badge cleared; spell stays expended. Healing the caster mid-cast does NOT disrupt; later damage below the healed value does.
- [ ] **Disruption by failed save:** begin a spell, roll a save from the PC sheet until one fails → spell lost; a successful save does not disrupt.
- [ ] **GM controls:** Disrupt posts the lost card; Cancel clears silently; neither button is visible to the player.
- [ ] **Combat end:** begin a round spell, then end/delete the combat → casting cleared; out of combat Cast is immediate again.
- [ ] **NPC:** the NPC sheet shows the same flow (begin, panel, complete).
- [ ] **NON-GM PLAYER SEAT:** as the Player (private window) owning the PC: begin "Test Missile" in combat (no permission error; the initiative addition applies), see the panel and badge, click Complete on their turn → cast card; begin "Test Web", have the GM damage them → the player sees the lost card and the panel clear; the player sees no Disrupt/Cancel buttons and cannot change the world settings.
- [ ] Report each item PASS/FAIL to the user via `AskUserQuestion`, following this project's established pattern; distinguish a genuine defect from a test-setup gap (spell not memorized, combat not started, wrong casting-time text, rule/reload not applied) before concluding a FAIL. Fix real defects via the standard fix-round process, never directly.

---

## After this plan lands

Update `README.md` (controller wrap-up): Sub-project table row 9 → `✅ Complete` with the PHB-grounded scope (casting time + initiative, multi-round casting, automatic disruption on damage or a failed save, no Dex AC while casting); "Known backlog items" gains: spell points and channelers (need *Player's Option: Spells & Magic*, not in `references/` — their toggles stay registered with "not implemented" hints); spell mishaps; Table 56 innate-ability/magic-item initiative modifiers; casting time for creature stat blocks; structured casting-time fields on spell items (only free text is parsed); and any unlinked-token-actor disruption limitation recorded in Task 7. Follow this project's established finishing default: push and create a pull request without asking. With Sub-project 9 merged, all nine sub-projects in the parent spec are complete.
