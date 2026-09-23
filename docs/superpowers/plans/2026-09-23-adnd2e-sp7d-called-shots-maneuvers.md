# Sub-project 7 Plan 7d: Called Shots & Combat Maneuvers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 called-shot body-location options and the 4 curated combat maneuvers (disarm, knock down/trip, grapple, bull rush) to the PC/NPC attack-roll flow — each an attack-roll penalty plus an automated on-hit effect, selected via an inline per-weapon-row dropdown, gated by the `calledShots`/`combatManeuvers` optional rules.

**Architecture:** A pure `src/core/combat/maneuvers.ts` lookup table + resolver (7 entries: 3 called-shot locations, 4 maneuvers) feeds a Foundry-shell dropdown selection into the EXISTING, unchanged `rollAttack` flow — the penalty populates the already-unused `situationalModifier` parameter (the exact seam Plan 7b's armor-vs-weapon-type and Plan 7a's condition modifiers already use), and a hit's effect applies via `Actor#toggleStatusEffect` (reusing Plan 7a's real status effects) or a small shared weapon-unequip helper (extracted from Plan 7b's own fumble code, per that code's own planted comment). This is the FINAL plan of Sub-project 7 — after this lands, the whole sub-project is complete.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`Actor#toggleStatusEffect`).

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` — §2 Decisions table (called-shot/maneuver mechanic + UI locked), §4.4, §5 (error handling), §7 (out-of-scope: full maneuver list beyond the curated 4).

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered by reading `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source — never `fvtt-types` (pinned to a v13-beta, confirmed wrong about several v14 APIs elsewhere in this project). `Actor#toggleStatusEffect(statusId, {active, overlay=false}={})` is confirmed real at `client/documents/actor.mjs:552` — call it as `actor.toggleStatusEffect(id, {active: true})`.
- **Content policy:** the called-shot locations' penalties and the 4 maneuvers' penalties/effects are this project's OWN designed numbers (per spec §3's content-policy note), not transcribed from the Combat & Tactics book's actual tables. No copyrighted rules prose anywhere.
- **Unified mechanic (locked, spec §2):** every called-shot/maneuver option is JUST an attack roll vs AC (`rollAttack` unchanged in its core resolution logic) with a penalty populating `situationalModifier`, and an effect applied on a hit. No opposed ability checks, no new roll type.
- **Maneuver/called-shot outcomes are ADDITIVE to normal damage, never a replacement** (this plan's own locked decision, since the spec doesn't specify and this keeps the implementation minimal and consistent with "additive, never silently dropped" in spec §5): a hit still exposes the normal "Roll Damage" button exactly as today, AND applies the maneuver's effect. Nothing in this plan skips or replaces the damage step.
- **Settings gating (locked, spec §2):** `combatAndTacticsEnabled` is a master AND-gate; `calledShots` gates the 3 location options, `combatManeuvers` gates the 4 maneuver options, independently — a GM can enable one without the other. When a gate is off, its options are never rendered in the dropdown (not rendered-then-ignored) — matches spec §5.
- **Scope boundary (confirmed during this plan's research, matching Plan 7b's armor-vs-weapon-type precedent):** this plan is PC/NPC-sheet-only. Creature attacks (`src/sheets/creature/combat-rolls.ts`) use a flat `attacks[]` array with no weapon Item and no `.weapon-row` UI concept — there is nothing to attach a dropdown to and nothing to disarm. Not touched by this plan.
- **A maneuver `unequip` outcome on a target with no equipped weapon is a no-op, not an error** (spec §5, locked) — checked before attempting any update.
- **Two-layer architecture:** `src/core/combat/maneuvers.ts` and `src/sheets/character/context.ts`/`context-types.ts` are in the pure zone (100% Vitest coverage, no Foundry imports) — `src/core/**` is already a directory-level wildcard in `tsconfig.core.json`/`vitest.config.ts`/`eslint.config.js`, and `context.ts`/`context-types.ts` are already listed file-by-file in all three — no triad config edit is needed for this plan. `src/sheets/character/combat-rolls.ts`, `src/sheets/npc/sheet.ts`, `src/sheets/character/sheet.ts`, `src/combat/attack-card.ts`, all `templates/**/*.hbs`, and `lang/en.json` are Foundry-layer — not unit-tested, dev-world verified.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**, and do not touch `package.json`/`package-lock.json`/`node_modules` — this plan needs NO version bump (no schema/data change to existing stored documents, unlike Plan 7c).
- **`npm run build` requires Foundry fully closed** — re-confirm with the user before every build-touching step.
- **Read vitest output with `tail`/`head`/redirect, never `| grep`** — a cache-clear's first run can genuinely flake; rerun 2-3× before concluding something is wrong.
- **The whole-branch review is MANDATORY** regardless of how clean per-task reviews look. Every prior plan in this sub-project (7a, 7b, 7c) has had real Critical/Important bugs surface ONLY at whole-branch-review time — including 7c's two Critical catches (a migration that couldn't fire due to a Foundry schema-pruning timing subtlety, and a UI gate that accidentally disabled an unrelated base mechanic by default). Treat it as the primary safety net, not a formality.
- **Duplicate re-validation pattern:** `rollAttack` must re-derive server-side whether a selected maneuver is actually allowed by the current optional-rule settings before honoring it — never trust that the dropdown only ever contains valid options (a stale render, or the GM flipping a setting mid-session, must not let a blocked option's effect apply).

---

## Locked design decisions (this plan's own, per spec §2's explicit note that RAW's varied per-maneuver mechanics are deliberately simplified)

**3 called-shot locations** (escalating penalty by precision, each effect reusing an existing mechanism — no new condition types):

| Location | Attack penalty | Effect |
|---|---|---|
| Head | −8 | Applies the `stunned` condition to the target |
| Weapon hand | −6 | Target's equipped weapon is unequipped ("knocked away") |
| Leg | −4 | Applies the `prone` condition to the target |

**4 curated maneuvers** (flat −2 penalty each — a maneuver is a targeted combat technique, not called-shot-level precision; each effect reuses an existing mechanism):

| Maneuver | Attack penalty | Effect |
|---|---|---|
| Disarm | −2 | Target's equipped weapon is unequipped |
| Knock down / trip | −2 | Applies the `prone` condition to the target |
| Grapple | −2 | Applies the `held` condition to the target (closest existing managed condition to "restrained/immobilized" — `MANAGED_CONDITIONS` only has `prone`/`blinded`/`stunned`/`held`) |
| Bull rush | −2 | Narrative-only "pushed back" outcome — this codebase has no token-position/movement automation anywhere, so bull rush's `push` effect is a distinct chat-card label with NO persisted state change, matching this plan's minimal-new-mechanics scope |

All 7 conditions/unequip effects apply to the ATTACK's TARGET (the defender), never the attacker — distinct from Plan 7b's fumble `weaponDrops`, which unequips the ATTACKER's OWN weapon on a self-inflicted mistake. Both share the same underlying "set a weapon Item unequipped" operation (Task 2 extracts it into one small helper, per the comment Plan 7b's implementer already left at `combat-rolls.ts:245-249` planning exactly this).

Only single-target attacks (the same branch that already computes `armorVsWeaponModifier`/condition modifiers in `rollAttack`) can have an effect applied — a manual-AC roll (0 or 2+ targets) still gets the attack-roll penalty and the outcome label, but there's no real target actor to mutate. This mirrors how `armorVsWeaponModifier` is already scoped in the current code.

---

### Task 1: Pure maneuvers lookup table + resolver

**Files:**
- Create: `src/core/combat/maneuvers.ts`
- Create: `tests/core/combat/maneuvers.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (foundational).
- Produces: `ManeuverId` (7-member string union), `ManeuverEffect` (discriminated union), `ManeuverCategory` ("calledShot" | "maneuver"), `ManeuverDescriptor { attackPenalty: number; effect: ManeuverEffect; category: ManeuverCategory }`, `MANEUVERS: Record<ManeuverId, ManeuverDescriptor>`, `resolveManeuverOutcome(maneuverId: ManeuverId | null, hit: boolean): ManeuverEffect | null` — all consumed by Task 2 (context.ts) and Task 3 (combat-rolls.ts).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/core/combat/maneuvers.test.ts
import { describe, expect, it } from "vitest";
import { MANEUVERS, resolveManeuverOutcome } from "../../../src/core/combat/maneuvers";

describe("MANEUVERS table", () => {
  it("has exactly 3 called-shot locations with escalating penalties", () => {
    expect(MANEUVERS.calledShotHead).toEqual({
      attackPenalty: -8, category: "calledShot",
      effect: { kind: "condition", conditionId: "stunned" },
    });
    expect(MANEUVERS.calledShotHand).toEqual({
      attackPenalty: -6, category: "calledShot",
      effect: { kind: "unequip" },
    });
    expect(MANEUVERS.calledShotLeg).toEqual({
      attackPenalty: -4, category: "calledShot",
      effect: { kind: "condition", conditionId: "prone" },
    });
  });

  it("has exactly 4 curated maneuvers, each a flat -2 penalty", () => {
    expect(MANEUVERS.disarm).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "unequip" },
    });
    expect(MANEUVERS.tripKnockDown).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "condition", conditionId: "prone" },
    });
    expect(MANEUVERS.grapple).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "condition", conditionId: "held" },
    });
    expect(MANEUVERS.bullRush).toEqual({
      attackPenalty: -2, category: "maneuver",
      effect: { kind: "push" },
    });
  });

  it("has exactly 7 entries total", () => {
    expect(Object.keys(MANEUVERS)).toHaveLength(7);
  });
});

describe("resolveManeuverOutcome", () => {
  it("returns null when no maneuver was selected", () => {
    expect(resolveManeuverOutcome(null, true)).toBeNull();
  });

  it("returns null when the attack missed, regardless of which maneuver was selected", () => {
    expect(resolveManeuverOutcome("disarm", false)).toBeNull();
    expect(resolveManeuverOutcome("calledShotHead", false)).toBeNull();
  });

  it("returns the condition effect for a hit called shot to the head", () => {
    expect(resolveManeuverOutcome("calledShotHead", true)).toEqual({ kind: "condition", conditionId: "stunned" });
  });

  it("returns the unequip effect for a hit disarm", () => {
    expect(resolveManeuverOutcome("disarm", true)).toEqual({ kind: "unequip" });
  });

  it("returns the push effect for a hit bull rush", () => {
    expect(resolveManeuverOutcome("bullRush", true)).toEqual({ kind: "push" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/combat/maneuvers.test.ts > /tmp/man1.log 2>&1; tail -n 40 /tmp/man1.log`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/core/combat/maneuvers.ts
// Player's Option: Combat & Tactics called shots + curated combat maneuvers
// (SP7 Plan 7d). Both are unified into ONE mechanic per spec §2: an attack
// roll vs AC (rollAttack unchanged) with a location/maneuver-specific
// attack-roll penalty, and a specific effect applied on a hit. The 3 called-
// shot locations and 4 curated maneuvers below are all listed in ONE table
// (`category` distinguishes them for independent settings-gating) rather
// than two separate tables, matching the spec's own "unified as one
// mechanic" framing. Every penalty and effect here is this project's OWN
// designed value (content policy) — not transcribed from the Combat &
// Tactics book's actual tables. The full C&T maneuver list beyond these 4
// is explicitly parked for a future revisit (spec §7).
import type { ManagedConditionId } from "../../combat/condition-effects";

export type ManeuverId =
  | "calledShotHead"
  | "calledShotHand"
  | "calledShotLeg"
  | "disarm"
  | "tripKnockDown"
  | "grapple"
  | "bullRush";

export type ManeuverCategory = "calledShot" | "maneuver";

/**
 * The outcome a hit produces. `condition` applies one of this system's real
 * managed conditions (Plan 7a) to the target. `unequip` sets the target's
 * currently-equipped weapon Item to unequipped — the SAME operation as
 * Plan 7b's fumble `weaponDrops` outcome, just aimed at the target instead of
 * the attacker (Task 2 shares one small helper for both). `push` has no
 * persisted state change: this codebase has no token-position/movement
 * automation anywhere, so a successful bull rush is a distinct chat-card
 * outcome line only — a deliberate, minimal scope choice, not an oversight.
 */
export type ManeuverEffect =
  | { kind: "condition"; conditionId: ManagedConditionId }
  | { kind: "unequip" }
  | { kind: "push" };

export interface ManeuverDescriptor {
  attackPenalty: number;
  effect: ManeuverEffect;
  category: ManeuverCategory;
}

export const MANEUVERS: Record<ManeuverId, ManeuverDescriptor> = {
  calledShotHead: { attackPenalty: -8, category: "calledShot", effect: { kind: "condition", conditionId: "stunned" } },
  calledShotHand: { attackPenalty: -6, category: "calledShot", effect: { kind: "unequip" } },
  calledShotLeg: { attackPenalty: -4, category: "calledShot", effect: { kind: "condition", conditionId: "prone" } },
  disarm: { attackPenalty: -2, category: "maneuver", effect: { kind: "unequip" } },
  tripKnockDown: { attackPenalty: -2, category: "maneuver", effect: { kind: "condition", conditionId: "prone" } },
  grapple: { attackPenalty: -2, category: "maneuver", effect: { kind: "condition", conditionId: "held" } },
  bullRush: { attackPenalty: -2, category: "maneuver", effect: { kind: "push" } },
};

/**
 * The effect a selected maneuver/called-shot produces, given whether the
 * attack hit. `null` when no maneuver was selected, or the attack missed —
 * a maneuver's effect only ever applies on a genuine hit.
 */
export function resolveManeuverOutcome(maneuverId: ManeuverId | null, hit: boolean): ManeuverEffect | null {
  if (!maneuverId || !hit) return null;
  return MANEUVERS[maneuverId].effect;
}
```

Verify `ManagedConditionId` is the real, current exported type name from `src/combat/condition-effects.ts` before using it in the import (confirmed during this plan's research: `export type ManagedConditionId = "prone" | "blinded" | "stunned" | "held";` at that file's line 8) — re-check it hasn't changed since.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/combat/maneuvers.test.ts > /tmp/man2.log 2>&1; tail -n 40 /tmp/man2.log`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Run coverage to confirm the pure module is caught by the gate**

Run: `npm run test:coverage > /tmp/man-cov.log 2>&1; tail -n 60 /tmp/man-cov.log`
Expected: `src/core/combat/maneuvers.ts` at 100% lines/statements/functions (branches ≥90%) — no triad edit needed (`src/core/**` is already a directory-level wildcard in all three configs); this step only confirms that's actually true.

- [ ] **Step 6: Commit**

```bash
git add src/core/combat/maneuvers.ts tests/core/combat/maneuvers.test.ts
git commit -m "feat(sp7d): add pure called-shot/maneuver lookup table and resolver

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure sheet-context layer — maneuver dropdown options

**Files:**
- Modify: `src/sheets/character/context-types.ts`
- Modify: `src/sheets/character/context.ts`
- Modify: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `MANEUVERS`, `ManeuverDescriptor`, `ManeuverId`, `ManeuverCategory` from Task 1's `src/core/combat/maneuvers.ts`. `input.optionalRules.combatAndTacticsEnabled`/`.calledShots`/`.combatManeuvers` (already flows into this pure file — confirmed precedent at `context.ts`'s existing `buildSpells`/`buildWeaponProfRow` functions, both already read `input.optionalRules`).
- Produces: `CharacterSheetContext["combat"]["maneuverOptions"]: { value: string; label: string }[]` — consumed by Task 4's templates as `@root.adnd2e.combat.maneuverOptions` (a TOP-LEVEL context field, not per-weapon-row — every weapon row shares the identical option list, computed once).

**Current real state** (confirmed during this plan's research):

`src/sheets/character/context-types.ts`'s current `combat` field on `CharacterSheetContext`:
```ts
combat: {
  weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null; canBackstab: boolean }[];
  acBreakdown: { label: string; value: number }[];
  armor: { id: string; name: string; equipped: boolean; isShield: boolean; baseAc: number }[];
};
```

`src/sheets/character/context.ts`'s current `buildCombat` (full function, ~lines 234-275):
```ts
function buildCombat(input: CharacterSheetInput): CharacterSheetContext["combat"] {
  const isThief = input.classItems.some((c) => c.chassisId === "thief");
  const weapons = input.physicalItems
    .filter((i) => i.type === "weapon")
    .map((i) => {
      const w = i.weapon as NonNullable<PhysicalItemView["weapon"]>;
      return {
        id: i.id,
        name: i.name,
        equipped: i.equipped,
        toHitNote: "",
        damageNote: [w.damageVsSM, w.damageVsL].filter(Boolean).join(" / "),
        speedFactor: w.speedFactor,
        range: w.range,
        canBackstab: isThief && canBackstab({ category: w.category, damageType: w.damageType }),
      };
    });

  const armorItems = input.physicalItems.filter((i) => i.type === "armor");
  const worn = armorItems.find((i) => i.equipped && !i.armor!.isShield);
  const shield = armorItems.find((i) => i.equipped && i.armor!.isShield);
  const dexMods = input.derived.abilities.dex.mods as DexterityModifiers;
  const acBreakdown = [
    { label: "ADND2E.sheet.combat.acBase", value: worn ? worn.armor!.baseAc : 10 },
    { label: "ADND2E.sheet.combat.acShield", value: shield ? shield.armor!.shieldAcBonus : 0 },
    {
      label: "ADND2E.sheet.combat.acMagic",
      value: (worn ? worn.magicBonus : 0) + (shield ? shield.magicBonus : 0),
    },
    { label: "ADND2E.sheet.combat.acDex", value: dexMods.defensiveAdj },
  ];

  const armor = armorItems.map((i) => ({
    id: i.id,
    name: i.name,
    equipped: i.equipped,
    isShield: i.armor!.isShield,
    baseAc: i.armor!.baseAc,
  }));

  return { weapons, acBreakdown, armor };
}
```

- [ ] **Step 1: Add `maneuverOptions` to the type**

Edit `src/sheets/character/context-types.ts` — add a sibling field to `weapons`/`acBreakdown`/`armor`:
```ts
combat: {
  weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null; canBackstab: boolean }[];
  acBreakdown: { label: string; value: number }[];
  armor: { id: string; name: string; equipped: boolean; isShield: boolean; baseAc: number }[];
  maneuverOptions: { value: string; label: string }[];
};
```

- [ ] **Step 2: Compute `maneuverOptions` in `buildCombat`**

Edit `src/sheets/character/context.ts`. Add the import:
```ts
import { MANEUVERS } from "../../core/combat/maneuvers";
```

Add, inside `buildCombat`, right before the `return`:
```ts
  const rules = input.optionalRules;
  const maneuverOptions = Object.entries(MANEUVERS)
    .filter(
      ([, m]) =>
        rules.combatAndTacticsEnabled && (m.category === "calledShot" ? rules.calledShots : rules.combatManeuvers),
    )
    .map(([id]) => ({ value: id, label: `ADND2E.sheet.combat.maneuver.${id}` }));

  return { weapons, acBreakdown, armor, maneuverOptions };
```

- [ ] **Step 3: Extend `tests/sheets/character/context.test.ts`**

Read the file's existing `buildCombat`/`combat` test block first (search for `"combat"` or `acBreakdown` to find it) to match this file's real current helper/fixture conventions before adding tests. Add tests proving:
```typescript
it("maneuverOptions is empty when combatAndTacticsEnabled is off, even with calledShots/combatManeuvers on", () => {
  const c = buildCharacterSheetContext({
    ...baseCharacterInput(), // this file's existing full-valid-input helper — read it first
    optionalRules: { ...DEFAULT_OPTIONAL_RULES_FIXTURE, combatAndTacticsEnabled: false, calledShots: true, combatManeuvers: true },
  });
  expect(c.combat.maneuverOptions).toEqual([]);
});

it("maneuverOptions includes only the 3 called-shot locations when calledShots is on and combatManeuvers is off", () => {
  const c = buildCharacterSheetContext({
    ...baseCharacterInput(),
    optionalRules: { ...DEFAULT_OPTIONAL_RULES_FIXTURE, combatAndTacticsEnabled: true, calledShots: true, combatManeuvers: false },
  });
  const values = c.combat.maneuverOptions.map((o) => o.value);
  expect(values).toEqual(["calledShotHead", "calledShotHand", "calledShotLeg"]);
});

it("maneuverOptions includes only the 4 curated maneuvers when combatManeuvers is on and calledShots is off", () => {
  const c = buildCharacterSheetContext({
    ...baseCharacterInput(),
    optionalRules: { ...DEFAULT_OPTIONAL_RULES_FIXTURE, combatAndTacticsEnabled: true, calledShots: false, combatManeuvers: true },
  });
  const values = c.combat.maneuverOptions.map((o) => o.value);
  expect(values).toEqual(["disarm", "tripKnockDown", "grapple", "bullRush"]);
});

it("maneuverOptions includes all 7 when both toggles are on", () => {
  const c = buildCharacterSheetContext({
    ...baseCharacterInput(),
    optionalRules: { ...DEFAULT_OPTIONAL_RULES_FIXTURE, combatAndTacticsEnabled: true, calledShots: true, combatManeuvers: true },
  });
  expect(c.combat.maneuverOptions).toHaveLength(7);
});
```
Adjust the exact fixture-construction calls (`baseCharacterInput()`, `DEFAULT_OPTIONAL_RULES_FIXTURE` or whatever this file's real helpers are actually named — read them first) to match this file's real, current conventions; the point is these 4 scenarios (both off, called-shots-only, maneuvers-only, both on), each asserting the exact resulting option set.

- [ ] **Step 4: Run tests, typecheck, coverage**

Run: `npx vitest run tests/sheets/character/context.test.ts > /tmp/ctx1.log 2>&1; tail -n 60 /tmp/ctx1.log`
Run: `npm run typecheck > /tmp/ctx-tc.log 2>&1; tail -n 40 /tmp/ctx-tc.log`
Run: `npm run test:coverage > /tmp/ctx-cov.log 2>&1; tail -n 60 /tmp/ctx-cov.log`
Expected: all PASS, coverage thresholds held on `context.ts` (the new `.filter` conjunct needs both true/false covered for each of `combatAndTacticsEnabled` and the ternary between `calledShots`/`combatManeuvers` — Step 3's 4 tests should already provide this).

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts tests/sheets/character/context.test.ts
git commit -m "feat(sp7d): compute gated maneuver dropdown options in the pure sheet context

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Foundry-layer glue — wire maneuvers into `rollAttack`

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts`
- Modify: `src/combat/card-types.ts`
- Modify: `src/combat/attack-card.ts`
- Modify: `templates/chat/attack-roll.hbs`

Not unit-tested (Foundry-shell glue) — verified in Task 6's gated dev-world check.

**Interfaces:**
- Consumes: `MANEUVERS`, `resolveManeuverOutcome`, `ManeuverId` from Task 1's `src/core/combat/maneuvers.ts`.
- Produces: `rollAttack(actor, weaponItemId, backstab?, maneuverId?)` — a new 4th parameter, consumed by Task 4's `character/sheet.ts` and `npc/sheet.ts` call sites. `AttackCardInput`/`AttackCardContext` gain a `maneuverLabel: string | null` field, mirroring `critLabel`/`fumbleLabel` exactly.

**Current real state** (confirmed during this plan's research — full `rollAttack` function, `src/sheets/character/combat-rolls.ts` lines 169-287):
```ts
export async function rollAttack(actor: AttackerActor, weaponItemId: string, backstab = false): Promise<void> {
  const weapon = actor.items.get(weaponItemId);
  if (!weapon) return;

  if (!canAct(actor.statuses)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.cannotActWarning"));
    return;
  }

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let targetSize: string | null = null;
  let targetStatuses: ReadonlySet<string> = new Set<string>();
  let armorVsWeaponModifier = 0;

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    const info = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]);
    targetAc = info.ac + proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>());
    targetSize = info.size;
    targetStatuses = (t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>();
    const rules = getOptionalRules();
    if (rules.combatAndTacticsEnabled && rules.armorTypeVsWeaponType && weapon.system.damageType) {
      const targetArmorType = resolveTargetArmorType(t.actor as Parameters<typeof resolveTargetArmorType>[0]);
      armorVsWeaponModifier = weaponVsArmorModifier(weapon.system.damageType as never, toArmorGroup(targetArmorType));
    }
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
    proficiencyModifier: resolveProficiencyModifier(actor, weapon),
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + armorVsWeaponModifier,
  });
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const { isThief, thiefLevel } = resolveThiefBackstabInfo(actor);
  const backstabEligible = isThief && canBackstab({ category: weapon.system.category as never, damageType: weapon.system.damageType as never });
  const backstabActive = backstab && backstabEligible;

  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  const hit = backstabActive ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const critEnabled = getOptionalRules().combatAndTacticsEnabled && getOptionalRules().criticalHits;
  const crit = critEnabled && baseHit.autoHit && !backstabActive ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  const fumble = critEnabled && baseHit.autoMiss && !backstabActive ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;

  if (fumble?.effect === "weaponDrops") {
    // Inline for now — a future plan (SP7 Plan 7d, combat maneuvers) will
    // need the identical "unequip a weapon Item" operation for its own
    // disarm-maneuver outcome; extract this into a shared helper THEN, when
    // there are genuinely two call sites, not preemptively for one.
    await (weapon as unknown as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.equipped": false });
  }
  if (fumble?.effect === "selfInjury" && fumble.selfInjuryDice) {
    const selfRoll = await new Roll(fumble.selfInjuryDice).evaluate();
    await selfRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.localize("ADND2E.chat.attack.fumbleSelfInjury"),
    } as unknown as Roll.MessageData);
  }

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    backstab: backstabActive,
    critLabel: crit ? `ADND2E.chat.attack.crit.${crit.tier}` : null,
    fumbleLabel: fumble ? `ADND2E.chat.attack.fumble.${fumble.tier}` : null,
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
          critMultiplier: crit?.damageMultiplier ?? null,
          critFlatBonus: crit?.flatBonus ?? 0,
        }
      : null,
  });

  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      content,
      flags: { adnd2e: { card: "attack", ...context.damageContext } },
    } as unknown as Roll.MessageData,
  );
}
```

- [ ] **Step 1: Add imports**

Edit `src/sheets/character/combat-rolls.ts` — add:
```ts
import { MANEUVERS, resolveManeuverOutcome } from "../../core/combat/maneuvers";
import type { ManeuverId } from "../../core/combat/maneuvers";
```

- [ ] **Step 2: Extract the shared unequip helper**

Add this small private function anywhere near the top of the file (e.g. right above `resolveTargetCombatInfo`, or right above `rollAttack` — follow this file's existing ordering convention for helpers):
```ts
/** Sets a weapon Item to unequipped — the "weapon knocked away" operation
 *  shared by a fumble's weaponDrops outcome (on the ATTACKER's own weapon)
 *  and a disarm maneuver/called-shot's unequip outcome (on the TARGET's
 *  weapon, resolved by `resolveTargetEquippedWeapon`) — same operation,
 *  different whose-weapon the caller decides. */
async function unequipWeapon(weaponItem: { update(d: Record<string, unknown>): Promise<unknown> }): Promise<void> {
  await weaponItem.update({ "system.equipped": false });
}

/** Finds the target actor's FIRST equipped weapon Item (first-member-wins,
 *  matching this codebase's established multi-match tie-break convention —
 *  see e.g. proficiency-actions.ts's `firstClassChassisId`). Returns `null`
 *  for an unarmed target — a maneuver's `unequip` outcome is then correctly
 *  a no-op (spec §5), not an error. */
function resolveTargetEquippedWeapon(
  targetActor: { items: Iterable<{ id: string; type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }> },
): { update(d: Record<string, unknown>): Promise<unknown> } | null {
  for (const item of targetActor.items) {
    if (item.type === "weapon" && item.system.equipped) return item;
  }
  return null;
}
```

- [ ] **Step 3: Replace the inline fumble weaponDrops block to use the new helper**

Replace:
```ts
  if (fumble?.effect === "weaponDrops") {
    // Inline for now — a future plan (SP7 Plan 7d, combat maneuvers) will
    // need the identical "unequip a weapon Item" operation for its own
    // disarm-maneuver outcome; extract this into a shared helper THEN, when
    // there are genuinely two call sites, not preemptively for one.
    await (weapon as unknown as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.equipped": false });
  }
```
with:
```ts
  if (fumble?.effect === "weaponDrops") {
    await unequipWeapon(weapon as unknown as { update(d: Record<string, unknown>): Promise<unknown> });
  }
```

- [ ] **Step 4: Add the `maneuverId` parameter and gate it server-side**

Change the function signature:
```ts
export async function rollAttack(
  actor: AttackerActor,
  weaponItemId: string,
  backstab = false,
  maneuverId: ManeuverId | null = null,
): Promise<void> {
```

Right after the existing `const isRanged = ...` / `const thac0 = ...` lines (before `attackModifiers` is called), add:
```ts
  const rules = getOptionalRules();
  const maneuverAllowed =
    maneuverId !== null &&
    rules.combatAndTacticsEnabled &&
    (MANEUVERS[maneuverId].category === "calledShot" ? rules.calledShots : rules.combatManeuvers);
  const effectiveManeuverId = maneuverAllowed ? maneuverId : null;
  const maneuverPenalty = effectiveManeuverId ? MANEUVERS[effectiveManeuverId].attackPenalty : 0;
```
(`getOptionalRules` is already imported in this file — do not re-import it. Note this introduces a SECOND `const rules = getOptionalRules();` — the single-target branch above already declares one inside its own `if` block, at a different scope, so there's no name collision; if you'd rather not call `getOptionalRules()` twice, hoist ONE call to the top of the function and reuse it in both places — either is fine, just don't leave a stale duplicate.)

Update the `situationalModifier` sum:
```ts
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + armorVsWeaponModifier + maneuverPenalty,
```

- [ ] **Step 5: Resolve and apply the maneuver outcome after `hit` is known**

Right after the existing fumble-handling block (`if (fumble?.effect === "selfInjury" ...)`), add:
```ts
  const maneuverEffect = resolveManeuverOutcome(effectiveManeuverId, hit.hit);
  if (maneuverEffect && targets.length === 1) {
    const targetActor = targets[0]!.actor as {
      toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
      items: Iterable<{ id: string; type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }>;
    };
    if (maneuverEffect.kind === "condition") {
      await targetActor.toggleStatusEffect(maneuverEffect.conditionId, { active: true });
    } else if (maneuverEffect.kind === "unequip") {
      const targetWeapon = resolveTargetEquippedWeapon(targetActor);
      if (targetWeapon) await unequipWeapon(targetWeapon);
    }
    // "push" (bull rush): narrative-only — no persisted state change. The
    // card's maneuverLabel line below already communicates the outcome.
  }
```

- [ ] **Step 6: Add `maneuverLabel` to the card context**

Update the `buildAttackCardContext({...})` call — add one new field alongside `critLabel`/`fumbleLabel`:
```ts
    maneuverLabel: effectiveManeuverId && maneuverEffect ? `ADND2E.chat.attack.maneuverLabel.${effectiveManeuverId}` : null,
```

- [ ] **Step 7: Extend `card-types.ts`**

Edit `src/combat/card-types.ts`. Add `maneuverLabel: string | null;` to BOTH `AttackCardInput` (right after `fumbleLabel`, with a doc comment mirroring `critLabel`/`fumbleLabel`'s style: `/** an i18n key naming the called-shot/maneuver outcome, or null when no maneuver was selected or it missed. */`) and `AttackCardContext` (same field, no comment needed there since `AttackCardInput`'s comment is the canonical one — matches this file's existing convention where `AttackCardContext` re-lists fields without re-documenting them).

- [ ] **Step 8: Extend `attack-card.ts`**

Edit `src/combat/attack-card.ts`'s `buildAttackCardContext` — add `maneuverLabel: input.maneuverLabel,` to the returned object, right after `fumbleLabel: input.fumbleLabel,`.

- [ ] **Step 9: Extend `attack-roll.hbs`**

Edit `templates/chat/attack-roll.hbs` — add, right after the existing `{{#if fumbleLabel}}` line:
```hbs
  {{#if maneuverLabel}}<p class="result maneuver">{{localize maneuverLabel}}</p>{{/if}}
```

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck > /tmp/glue-tc.log 2>&1; tail -n 40 /tmp/glue-tc.log`
Expected: PASS. (This will still show errors from Task 4's not-yet-done `sheet.ts`/`npc/sheet.ts` call sites, which still call the 3-argument `rollAttack` — TypeScript allows omitting a parameter with a default, so this should actually typecheck CLEAN already; if it does NOT, investigate before continuing rather than assuming Task 4 will fix it.)

- [ ] **Step 11: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/combat/card-types.ts src/combat/attack-card.ts templates/chat/attack-roll.hbs
git commit -m "feat(sp7d): wire called-shot/maneuver penalty and on-hit effect into rollAttack

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Sheet UI — dropdown, action-map wiring, lang keys (PC + NPC)

**Files:**
- Modify: `templates/actor/character/combat.hbs`
- Modify: `templates/actor/npc/main.hbs`
- Modify: `src/sheets/character/sheet.ts`
- Modify: `src/sheets/npc/sheet.ts`
- Modify: `lang/en.json`
- Modify: `tests/lang/en-coverage.test.ts` (only if it needs updating for the new keys — check first; Plan 7c hit exactly this situation, see that plan's own precedent)

Not unit-tested (Foundry-shell glue + templates + lang strings) — verified in Task 6's gated dev-world check.

**Interfaces:**
- Consumes: `rollAttack`'s new 4th parameter from Task 3; `CharacterSheetContext["combat"]["maneuverOptions"]` from Task 2.
- Produces: nothing further consumed by later tasks — this is the UI's terminal wiring.

**Current real state** (confirmed during this plan's research):

`templates/actor/character/combat.hbs`'s current weapon-row block:
```hbs
{{#each adnd2e.combat.weapons as |w|}}
  <div class="weapon-row{{#if w.equipped}} equipped{{/if}}" data-item-id="{{w.id}}">
    <span class="name">{{w.name}}</span>
    <span class="equipped-state">
      {{#if w.equipped}}{{localize 'ADND2E.sheet.combat.equipped'}}{{else}}{{localize 'ADND2E.sheet.combat.notEquipped'}}{{/if}}
    </span>
    ...
    {{#if w.range}}<span class="range">{{w.range}}</span>{{/if}}
    {{#if w.equipped}}
      {{#if w.canBackstab}}
        <label class="backstab-label">
          <input type="checkbox" class="backstab-toggle" data-item-id="{{w.id}}">
          {{localize 'ADND2E.sheet.combat.backstab'}}
        </label>
      {{/if}}
      <button type="button" data-action="rollAttack" data-item-id="{{w.id}}">
        {{localize 'ADND2E.sheet.combat.rollAttack'}}
      </button>
    {{/if}}
  </div>
{{/each}}
```
`templates/actor/npc/main.hbs` has the IDENTICAL structure (literal duplicated markup, not a shared partial — confirmed by direct comparison during this plan's research), reading the SAME `adnd2e.combat.weapons`/`adnd2e.combat.maneuverOptions` context (the NPC sheet calls the same `buildCharacterSheetContext`).

`src/sheets/character/sheet.ts`'s current `#onRollAttack` handler:
```ts
static async #onRollAttack(this: Adnd2eCharacterSheet, event: PointerEvent, target: HTMLElement): Promise<void> {
  const weaponItemId = target.dataset.itemId;
  if (!weaponItemId) return;
  const backstabCheckbox = target.closest(".weapon-row")?.querySelector<HTMLInputElement>(".backstab-toggle");
  await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false);
}
```
`src/sheets/npc/sheet.ts`'s equivalent (same body, imports `rollAttack` from `../character/combat-rolls`).

- [ ] **Step 1: Add the dropdown to both templates**

Edit `templates/actor/character/combat.hbs` and `templates/actor/npc/main.hbs` identically — insert, right after the `.backstab-label` block's `{{/if}}` and before the `<button data-action="rollAttack">`:
```hbs
      {{#if @root.adnd2e.combat.maneuverOptions.length}}
        <select class="maneuver-select" data-item-id="{{w.id}}">
          <option value="">{{localize 'ADND2E.sheet.combat.maneuverNone'}}</option>
          {{#each @root.adnd2e.combat.maneuverOptions as |opt|}}
            <option value="{{opt.value}}">{{localize opt.label}}</option>
          {{/each}}
        </select>
      {{/if}}
```
**Note the `@root.` prefix is required** — this block is inside `{{#each adnd2e.combat.weapons as |w|}}`, which rebinds `this` to the loop item (`w`) each iteration; a bare `adnd2e.combat.maneuverOptions` reference here would silently resolve against `w` (undefined) instead of the top-level context, producing an empty `<select>` with no error (this exact class of bug is a documented SP2 lesson in this project's own history — `@root.` is depth-invariant, always reaching the top-level context regardless of nesting).

- [ ] **Step 2: Read the dropdown's value in both sheets' `#onRollAttack`**

Edit `src/sheets/character/sheet.ts`:
```ts
static async #onRollAttack(this: Adnd2eCharacterSheet, event: PointerEvent, target: HTMLElement): Promise<void> {
  const weaponItemId = target.dataset.itemId;
  if (!weaponItemId) return;
  const weaponRow = target.closest(".weapon-row");
  const backstabCheckbox = weaponRow?.querySelector<HTMLInputElement>(".backstab-toggle");
  const maneuverSelect = weaponRow?.querySelector<HTMLSelectElement>(".maneuver-select");
  const maneuverId = (maneuverSelect?.value || null) as ManeuverId | null;
  await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false, maneuverId);
}
```
Add the import: `import type { ManeuverId } from "../../core/combat/maneuvers";` (read the file's existing import block first to place this consistently, e.g. alongside its other `import type` lines).

Apply the identical change to `src/sheets/npc/sheet.ts`'s `#onRollAttack` (same body, same new `ManeuverId` type import — read that file's existing import style first).

- [ ] **Step 3: Add lang keys and update the setting hints**

Edit `lang/en.json`. In the `sheet.combat` block, add:
```json
"maneuverNone": "None",
"maneuver": {
  "calledShotHead": "Called Shot: Head",
  "calledShotHand": "Called Shot: Weapon Hand",
  "calledShotLeg": "Called Shot: Leg",
  "disarm": "Disarm",
  "tripKnockDown": "Knock Down / Trip",
  "grapple": "Grapple",
  "bullRush": "Bull Rush"
}
```
In the `chat.attack` block, add:
```json
"maneuverLabel": {
  "calledShotHead": "Called shot to the head — target is stunned!",
  "calledShotHand": "Called shot to the weapon hand — target's weapon is knocked away!",
  "calledShotLeg": "Called shot to the leg — target is knocked prone!",
  "disarm": "Disarm succeeds — target's weapon is knocked away!",
  "tripKnockDown": "Trip succeeds — target is knocked prone!",
  "grapple": "Grapple succeeds — target is held!",
  "bullRush": "Bull rush succeeds — target is pushed back!"
}
```
Update the two setting hints (in the `settings` block, `combatAndTactics` group) from:
```json
"calledShots": {
  "name": "Combat & Tactics: Called Shots",
  "hint": "Target specific body locations at an attack penalty (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
},
"combatManeuvers": {
  "name": "Combat & Tactics: Combat Maneuvers",
  "hint": "Disarm, trip, overbear, and similar maneuvers (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
},
```
to:
```json
"calledShots": {
  "name": "Combat & Tactics: Called Shots",
  "hint": "Target the head, weapon hand, or leg at an attack penalty for a location-specific effect (Combat & Tactics)."
},
"combatManeuvers": {
  "name": "Combat & Tactics: Combat Maneuvers",
  "hint": "Disarm, knock down/trip, grapple, and bull rush at an attack penalty (Combat & Tactics)."
},
```
(Valid JSON — watch trailing commas.)

- [ ] **Step 4: Check whether `tests/lang/en-coverage.test.ts` needs updating**

Read this file's current content. If it's a drift-coverage test that walks every `ADND2E.*` key referenced anywhere in `src/`/`templates/` and asserts it resolves to a non-empty string in `lang/en.json` (this is the exact situation Plan 7c hit with the same file over its own lang-key changes — see that plan's precedent), it likely does NOT need any manual edit for NEW keys (a drift test typically discovers new references automatically) — but DOES need checking if it has any HARDCODED key-count assertion or literal key list that would need extending. Run it and see:

Run: `npx vitest run tests/lang/en-coverage.test.ts > /tmp/lang1.log 2>&1; tail -n 40 /tmp/lang1.log`

If it fails, read the failure output and fix the file accordingly (mirroring whatever minimal, surgical edit Plan 7c made to this same file for its own key changes — a couple of line-level assertions, not a rewrite).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck > /tmp/ui-tc.log 2>&1; tail -n 40 /tmp/ui-tc.log`
Run: `npm run lint > /tmp/ui-lint.log 2>&1; tail -n 60 /tmp/ui-lint.log`
Expected: both PASS.

- [ ] **Step 6: Run the full test suite once more for a whole-plan sanity check**

Run: `npm run test:coverage > /tmp/ui-cov.log 2>&1; tail -n 80 /tmp/ui-cov.log`
Expected: PASS, coverage thresholds met.

- [ ] **Step 7: Commit**

```bash
git add templates/actor/character/combat.hbs templates/actor/npc/main.hbs src/sheets/character/sheet.ts src/sheets/npc/sheet.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(sp7d): wire the called-shot/maneuver dropdown into PC + NPC weapon rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(Omit `tests/lang/en-coverage.test.ts` from the `git add` if Step 4 found no changes needed there.)

---

### Task 5: Whole-branch review

**This task is MANDATORY regardless of how clean every prior task's per-task review was.** Every prior plan in this sub-project (7a, 7b, 7c) has had real Critical/Important bugs surface ONLY at whole-branch-review time despite fully clean per-task reviews — treat that as the established norm for this codebase, not an exception.

- [ ] Dispatch a whole-branch code review on the most capable available model, covering the full diff from this plan's branch point to the current HEAD (all 4 implementation tasks). Point the reviewer at this plan's Global Constraints, the "Locked design decisions" section, and spec §2/§4.4/§5/§7. Ask it to specifically check:
  - Every one of the 7 `ManeuverId`s' penalty/effect/category values in `maneuvers.ts` matches this plan's own locked table exactly (a copy-paste/typo risk given 7 near-identical entries).
  - `rollAttack`'s server-side re-validation (`maneuverAllowed`) actually blocks a `calledShot`-category id when `calledShots` is off (even with `combatAndTacticsEnabled`/`combatManeuvers` both on), and blocks a `maneuver`-category id when `combatManeuvers` is off — test BOTH directions, not just "the toggle exists."
  - The `unequip` effect correctly targets the DEFENDER's weapon (via `resolveTargetEquippedWeapon` on the target actor), never the attacker's own weapon — distinct from the (correctly-attacker-targeting) fumble `weaponDrops` refactor in the same file; confirm both call sites of the new `unequipWeapon` helper pass the RIGHT weapon item.
  - A `condition`-kind effect only ever applies when `targets.length === 1` (never on a manual-AC 0-or-2+-target roll) — and that this doesn't silently swallow the attack-roll PENALTY too (the penalty must still apply even without a real target to mutate; only the on-hit EFFECT is target-gated).
  - The maneuver-dropdown's `@root.` prefix is actually present in BOTH templates (this exact class of bug — a bare reference inside a `{{#each}}` silently resolving to nothing — is a documented recurring risk in this project's own history).
  - `maneuverLabel`'s chat-card display coexists sensibly with `critLabel`/`fumbleLabel`/`backstab` display when several could theoretically be present on the same card (e.g. a called shot that also happens to be a natural 20 crit) — confirm nothing is silently dropped or visually broken when more than one applies at once.
  - No copyrighted rules text anywhere in the new lang.json strings or code comments (content policy).
- [ ] Fix every Critical/Important finding via the SAME fix-round process used for every prior task in this plan (resume the implementer, or escalate model tier after 3 failed rounds per subagent-driven-development's standard loop) — the controller never fixes findings directly.
- [ ] Once clean, run `npm run typecheck && npm run lint && npm run test:coverage` one final time on the fully-fixed branch and confirm all green before moving to Task 6.

---

### Task 6: GATED dev-world smoke check

**This is a REQUIRED gated step — never deferred, never skipped**, regardless of how clean the automated tests and whole-branch review were. Confirm with the user before running `npm run build` that Foundry is fully closed.

- [ ] Build and link: confirm Foundry closed, run `npm run build`, then `npm run link` if not already linked, then have the user restart Foundry and load a test world with `optionalRules.combatAndTacticsEnabled`, `optionalRules.calledShots`, AND `optionalRules.combatManeuvers` all ON.
- [ ] **Called shot:** on a PC with an equipped weapon and a real token target, select "Called Shot: Leg" from the weapon row's new dropdown and Roll Attack. Confirm: (a) the situational-modifier line on the chat card reflects the −4 penalty (compare a roll with vs. without the called shot selected, or check the modifier breakdown list directly), (b) on a hit, the card shows the "target is knocked prone" outcome line, and the target actually gains the `prone` status (visible on the token / actor sheet). Repeat briefly for "Called Shot: Weapon Hand" (confirm the target's weapon becomes unequipped on a hit) and "Called Shot: Head" (confirm the target gains `stunned`) — at minimum spot-check the effect actually applies for each of the 3, even if full re-rolling to force a hit isn't done for every one.
- [ ] **Maneuvers:** repeat the same spot-check for all 4 maneuvers (disarm → target's weapon unequips on a hit; knock down/trip → target gains `prone`; grapple → target gains `held`; bull rush → the chat card shows the "pushed back" outcome line, confirm no error and no unintended persisted state change). If forcing natural hits is slow via normal re-rolling, use the console technique this session already established for SP7b (`CONFIG.Dice.randomUniform = () => 0.999; Math.random = () => 0.999;` before rolling, to force favorable outcomes, then restore `CONFIG.Dice.randomUniform` afterward) — adapt it here to just force a HIGH roll (not specifically a natural 20, since a called shot/maneuver should resolve as a genuine graded hit against the penalized total, not an auto-hit).
- [ ] **Settings gate, both directions:** with `combatManeuvers` toggled OFF (leave `calledShots` and `combatAndTacticsEnabled` ON), confirm the weapon row's dropdown no longer offers any of the 4 maneuvers, but STILL offers the 3 called-shot locations. Then flip it the other way (`calledShots` OFF, `combatManeuvers` ON) and confirm the reverse. Re-enable both afterward.
- [ ] **Scope confirmation:** confirm the creature sheet (a `creature`-type actor's stat-block sheet) has NO called-shot/maneuver dropdown anywhere — this plan is deliberately PC/NPC-sheet-only, per this plan's own Global Constraints; this check exists to catch an accidental over-application, not because one is expected.
- [ ] Report each item PASS/FAIL to the user via `AskUserQuestion`, following this project's established free-text-answer pattern from Plans 7a/7b/7c's own dev-world checks. Distinguish genuine code defects from test-design mistakes or test-setup gaps before concluding a FAIL.
- [ ] Fix any real defects found via the SAME fix-round process, never directly.

---

## After this plan lands

This is the FINAL plan of Sub-project 7. Update `README.md`'s Sub-project 7 row to `✅ Complete`, matching rows 1-6's exact formatting, with a scope summary covering all 4 plans (status effects/conditions, initiative UI, crit/fumble severity, armor-vs-weapon-type, weapon mastery, called shots, combat maneuvers). Add to "Known backlog items": the full Combat & Tactics maneuver list beyond the curated 4 (disarm, knock down/trip, grapple, bull rush) remains parked for a future revisit, per spec §7's explicit out-of-scope note — carry forward the exact wording precedent already used for other parked-scope backlog entries in this file. Follow this project's established finishing-a-development-branch default: push and create a pull request without asking (confirmed standing instruction, see project memory).
