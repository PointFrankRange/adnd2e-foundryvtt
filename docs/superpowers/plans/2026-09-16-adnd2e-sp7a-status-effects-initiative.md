# SP7a — Status-Effect Foundation + Initiative UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real, live Foundry status effects (a `condition` Item subtype + programmatic `CONFIG.statusEffects` registration) with mechanical consequences for 4 curated conditions (prone/blinded/stunned/held); add a Combat Tracker UI to set the already-built initiative situational modifier; wire all 6 reserved `combatAndTactics` settings into `OptionalRules`.

**Architecture:** A new pure condition-mechanics module (`src/combat/condition-effects.ts`) plus a pure status-effect-config builder appended to the existing `src/conditions.ts` — both consumed by a handful of lines in `src/system.ts`'s `init` hook and two existing Foundry-shell roll files (`src/sheets/{character,creature}/combat-rolls.ts`). No new sheet, no new chat card shape — this plan is infrastructure other SP7 plans build on.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (ApplicationV2/`CONFIG.statusEffects`/`Actor#toggleStatusEffect`).

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` §4.1 (and §2's locked decisions, §3's Global Constraints)

## Global Constraints

- Foundry v14.364 is the real target; `fvtt-types` is a wrong v13-beta — Foundry-layer code in this plan is grounded in real source already read during planning (cited per task below), never assumed.
- Two-layer contract: `src/combat/**` and `src/conditions.ts` are BOTH already in the pure-zone gated triad (`tsconfig.core.json`, `vitest.config.ts` `coverage.include`, `eslint.config.js` pure-zone `files`/`ignores`) — no new triad entries are needed by this plan; verify this remains true after each pure-file change.
- 100% Vitest coverage (branch ≥ 90) on every new/changed pure file.
- Content policy: the 4 conditions' mechanical numbers (blinded -4 to-hit, prone +2 AC, held +4 attacker bonus) are this project's own designed values, not transcribed from any rulebook.
- Do NOT run `npm run format`/`prettier`/`npm install`/`npm update`. `npm run build` requires Foundry fully closed — re-confirm before every build attempt.
- Read vitest output via `tail`/`head`/redirect — never `| grep` (SIGPIPE causes false "no tests" reports); a cache-clear's first run can genuinely flake, rerun 2-3× before concluding something is wrong.
- Any actor/document resolved from data baked into a chat-card button's dataset uses `.uuid` + `fromUuidSync()`, never `.id` + `game.actors.get()`.
- The gated dev-world smoke check (Task 8) is REQUIRED before `finishing-a-development-branch` — never deferred, never skipped.

---

### Task 1: `condition` Item subtype + Item-typed compendium pack

**Files:**
- Create: `src/data/item/condition.ts`
- Modify: `src/data/item/subtypes.ts`, `src/data/item/index.ts`, `system.json`, `lang/en.json`, `packs/conditions/_source/*.json` (all 15 files)
- Modify: `tests/data/subtypes.test.ts` (already asserts `ITEM_SUBTYPES` ↔ `system.json` — no code change needed, just confirm it still passes), `tests/conditions.test.ts` (rewrite — the pack shape changes from ActiveEffect-shaped to Item-shaped)

**Interfaces:**
- Consumes: `Adnd2eItemModel` (`src/data/item/base-item.ts`, unchanged), `CONDITIONS` (`src/conditions.ts`, unchanged).
- Produces: `ConditionItemModel` (exported from `src/data/item/index.ts`), a `"condition"` `ItemSubtype`, a shippable `packs/conditions` Item-typed compendium.

- [ ] **Step 1: Write the failing subtype-registration test**

`tests/data/subtypes.test.ts` already does `Object.keys(manifest.documentTypes.Item)` vs `ITEM_SUBTYPES` — no new test file needed, this test will fail once `condition` is added to `system.json` but not yet to `subtypes.ts` (or vice versa). Run it now to confirm it currently passes (baseline):

Run: `npx vitest run tests/data/subtypes.test.ts 2>&1 | tail -20`
Expected: PASS (baseline, before any change).

- [ ] **Step 2: Add `condition` to `src/data/item/subtypes.ts`**

```ts
// src/data/item/subtypes.ts
export type ItemSubtype =
  | "class"
  | "race"
  | "weapon"
  | "armor"
  | "equipment"
  | "spell"
  | "weaponProficiency"
  | "nonweaponProficiency"
  | "classFeature"
  | "condition";

export const ITEM_SUBTYPES: readonly ItemSubtype[] = [
  "class",
  "race",
  "weapon",
  "armor",
  "equipment",
  "spell",
  "weaponProficiency",
  "nonweaponProficiency",
  "classFeature",
  "condition",
];
```

- [ ] **Step 3: Add `condition` to `system.json`'s `documentTypes.Item`**

In `system.json`, the `documentTypes.Item` block (currently ending `"classFeature": {}`) gains one entry:

```json
      "classFeature": {},
      "condition": {}
```

Run: `npx vitest run tests/data/subtypes.test.ts 2>&1 | tail -20`
Expected: FAIL — `ConditionItemModel` doesn't exist yet, `ITEM_SUBTYPES`/`system.json` now agree but Step 4 hasn't registered the model, so a LATER test (Step 6) will catch that gap; this step's own test should already PASS since both sides now list `condition`. If it fails, re-check Steps 2/3 match exactly.

- [ ] **Step 4: Create `src/data/item/condition.ts`**

A minimal reference/definition item — mirrors `src/data/item/class-feature.ts`'s shape exactly (a thin subclass adding only the fields this subtype needs beyond the shared `description` field `Adnd2eItemModel` already provides). This item is a catalog entry only; the actual live status-effect behavior comes from `CONFIG.statusEffects` (Task 3), built directly from `src/conditions.ts`'s `CONDITIONS`, independent of this compendium.

```ts
// src/data/item/condition.ts
import { Adnd2eItemModel } from "./base-item";

const { StringField } = foundry.data.fields;

export class ConditionItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      conditionId: new StringField({ required: true, blank: false }),
    };
  }
}
```

- [ ] **Step 5: Register `ConditionItemModel` in `src/data/item/index.ts`**

```ts
// src/data/item/index.ts
import { ConditionItemModel } from "./condition";
// ...(add alongside the other 9 imports)

export {
  // ...(existing 9)
  ConditionItemModel,
};

export const ITEM_DATA_MODELS: Record<ItemSubtype, /* ...unchanged type... */> = {
  // ...(existing 9)
  condition: ConditionItemModel,
};
```

- [ ] **Step 6: Run typecheck + the subtype test**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run tests/data/subtypes.test.ts 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 7: Add `condition` to `lang/en.json`'s `TYPES.Item` block**

```json
      "classFeature": "Class Feature",
      "condition": "Condition"
```

(directly after the existing `classFeature` entry, inside `ADND2E.TYPES.Item`).

- [ ] **Step 8: Convert `packs/conditions/_source/*.json` from ActiveEffect-shaped to Item-shaped docs**

Every one of the 15 files (`blinded.json`, `charmed.json`, `dead.json`, `deafened.json`, `entangled.json`, `frightened.json`, `held.json`, `incapacitated.json`, `invisible.json`, `paralyzed.json`, `poisoned.json`, `prone.json`, `sleeping.json`, `stunned.json`, `unconscious.json`) changes shape identically. `blinded.json` before/after:

Before:
```json
{
  "_id": "FdrpMDqvgq4QwVlc",
  "_key": "!effects!FdrpMDqvgq4QwVlc",
  "name": "Blinded",
  "type": "adnd2e",
  "img": "icons/svg/blind.svg",
  "statuses": ["blinded"],
  "disabled": false,
  "transfer": false,
  "system": {
    "changes": [],
    "conditionId": "blinded",
    "isCondition": true,
    "suppressWhenUnequipped": false,
    "schoolTag": null
  }
}
```

After (keep the same `_id` value — only the surrounding shape changes):
```json
{
  "_id": "FdrpMDqvgq4QwVlc",
  "_key": "!items!FdrpMDqvgq4QwVlc",
  "name": "Blinded",
  "type": "condition",
  "img": "icons/svg/blind.svg",
  "system": {
    "conditionId": "blinded",
    "description": ""
  }
}
```

Apply the same transform (keep each file's own `_id`/`name`/`img`/`system.conditionId`, drop `statuses`/`disabled`/`transfer`/`system.{changes,isCondition,suppressWhenUnequipped,schoolTag}`, change `_key` prefix `!effects!`→`!items!`, change `type` `"adnd2e"`→`"condition"`, add `system.description: ""`) to all 15 files.

- [ ] **Step 9: Add the `conditions` pack to `system.json`**

In the `packs` array (currently 4 entries), add a 5th:

```json
    { "name": "conditions", "label": "Conditions", "path": "packs/conditions", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } }
```

In `packFolders[0].folders` (currently 5 entries ending with `"Bestiary"`), add a 6th:

```json
        { "name": "Conditions", "sorting": "a", "packs": ["conditions"] }
```

- [ ] **Step 10: Rewrite `tests/conditions.test.ts` for the new Item-shaped pack**

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CONDITIONS } from "../src/conditions";

const SRC = path.resolve(__dirname, "..", "packs", "conditions", "_source");

function packDocs() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(SRC, f), "utf8")) as {
      name: string;
      img: string;
      type: string;
      system: { conditionId: string };
    });
}

describe("CONDITIONS ↔ conditions pack", () => {
  it("the pack has exactly one condition Item per CONDITIONS entry", () => {
    const docs = packDocs();
    expect(docs.length).toBe(CONDITIONS.length);
    const byId = new Map(CONDITIONS.map((c) => [c.id, c]));
    for (const doc of docs) {
      expect(doc.type).toBe("condition");
      const c = byId.get(doc.system.conditionId);
      expect(c, doc.system.conditionId).toBeDefined();
      expect(doc.name).toBe(c!.name);
      expect(doc.img).toBe(c!.img);
    }
    expect(new Set(docs.map((d) => d.system.conditionId)).size).toBe(CONDITIONS.length);
  });
});
```

Run: `npx vitest run tests/conditions.test.ts 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 11: Run the full suite + build the packs**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.
Run: `npx vitest run 2>&1 | tail -60` — expect PASS, no regressions.
Run: `npm run build:packs 2>&1 | tail -40` — expect the `conditions` pack compiles 15/15 documents OK (this is the exact gotcha 1c.4a's hotfix caught: `foundryvtt-cli`'s `compileClassicLevel` silently drops any doc missing `_key` — confirm the build log reports 15/15, not fewer).

- [ ] **Step 12: Commit**

```bash
git add src/data/item/condition.ts src/data/item/subtypes.ts src/data/item/index.ts system.json lang/en.json packs/conditions/_source tests/conditions.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7a): condition Item subtype + Item-typed conditions pack

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Pure condition-mechanics module

**Files:**
- Create: `src/combat/condition-effects.ts`
- Test: `tests/combat/condition-effects.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `MANAGED_CONDITIONS: readonly ManagedConditionId[]`, `blindedAttackPenalty(statuses): number`, `proneArmorClassPenalty(statuses): number`, `heldAttackBonus(statuses): number`, `canAct(statuses): boolean` — all accepting `ReadonlySet<string> | readonly string[]`. Task 4 calls all four; Task 3 imports `MANAGED_CONDITIONS` only if useful (optional).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/combat/condition-effects.test.ts
import { describe, expect, it } from "vitest";
import {
  blindedAttackPenalty,
  proneArmorClassPenalty,
  heldAttackBonus,
  canAct,
  MANAGED_CONDITIONS,
} from "../../src/combat/condition-effects";

describe("MANAGED_CONDITIONS", () => {
  it("is exactly the 4 curated conditions", () => {
    expect([...MANAGED_CONDITIONS].sort()).toEqual(["blinded", "held", "prone", "stunned"]);
  });
});

describe("blindedAttackPenalty", () => {
  it("is -4 when blinded is present", () => {
    expect(blindedAttackPenalty(["blinded"])).toBe(-4);
    expect(blindedAttackPenalty(new Set(["blinded"]))).toBe(-4);
  });
  it("is 0 when blinded is absent", () => {
    expect(blindedAttackPenalty([])).toBe(0);
    expect(blindedAttackPenalty(["prone"])).toBe(0);
  });
});

describe("proneArmorClassPenalty", () => {
  it("is +2 (worse AC) when prone is present", () => {
    expect(proneArmorClassPenalty(["prone"])).toBe(2);
  });
  it("is 0 when prone is absent", () => {
    expect(proneArmorClassPenalty([])).toBe(0);
  });
});

describe("heldAttackBonus", () => {
  it("is +4 (easier to hit) when the target is held", () => {
    expect(heldAttackBonus(["held"])).toBe(4);
  });
  it("is 0 when held is absent", () => {
    expect(heldAttackBonus([])).toBe(0);
  });
});

describe("canAct", () => {
  it("is true with no blocking condition", () => {
    expect(canAct([])).toBe(true);
    expect(canAct(["blinded", "prone"])).toBe(true);
  });
  it("is false when stunned", () => {
    expect(canAct(["stunned"])).toBe(false);
  });
  it("is false when held", () => {
    expect(canAct(["held"])).toBe(false);
  });
  it("is false when both are present", () => {
    expect(canAct(["stunned", "held"])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/combat/condition-effects.test.ts 2>&1 | tail -30`
Expected: FAIL with "Cannot find module '../../src/combat/condition-effects'".

- [ ] **Step 3: Implement `src/combat/condition-effects.ts`**

```ts
// Mechanical consequences of the 4 curated status effects this sub-project
// automates (spec §2 "Condition mechanics scope"). The other 11 shipped
// conditions (src/conditions.ts) stay flavor-only markers with no consumer
// here — a GM interprets them by hand until a future sub-project extends this
// list. All numeric values are this project's own design (content policy) —
// not transcribed from any rulebook table.

export type ManagedConditionId = "prone" | "blinded" | "stunned" | "held";

export const MANAGED_CONDITIONS: readonly ManagedConditionId[] = ["prone", "blinded", "stunned", "held"];

type StatusSet = ReadonlySet<string> | readonly string[];

function has(statuses: StatusSet, id: string): boolean {
  return statuses instanceof Set ? statuses.has(id) : statuses.includes(id);
}

/** Blinded: the blinded actor's OWN attack rolls suffer a flat penalty. */
export function blindedAttackPenalty(actorStatuses: StatusSet): number {
  return has(actorStatuses, "blinded") ? -4 : 0;
}

/** Prone: the prone actor's AC worsens by a flat amount, uniformly regardless
 *  of the attacker's range (a deliberate v1 simplification — PHB has a
 *  melee/missile split this system does not model). Positive = worse AC,
 *  matching core/combat/armor-class.ts's ArmorClassInput.situationalModifier
 *  sign convention. */
export function proneArmorClassPenalty(targetStatuses: StatusSet): number {
  return has(targetStatuses, "prone") ? 2 : 0;
}

/** Held: an attacker gets a flat to-hit bonus against a held target. */
export function heldAttackBonus(targetStatuses: StatusSet): number {
  return has(targetStatuses, "held") ? 4 : 0;
}

/** Stunned or held: the actor cannot take an attack action this round.
 *  Scoped to attack rolls only (a deliberate v1 simplification) — saving
 *  throws are NOT gated by this, since resisting something happening to you
 *  is treated as still possible while stunned/held. */
export function canAct(actorStatuses: StatusSet): boolean {
  return !has(actorStatuses, "stunned") && !has(actorStatuses, "held");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/combat/condition-effects.test.ts 2>&1 | tail -30`
Expected: PASS, all 10 assertions.

- [ ] **Step 5: Run coverage**

Run: `npm run test:coverage 2>&1 | tail -60`
Expected: `src/combat/condition-effects.ts` at 100% statements/functions/lines, branches ≥ 90 (every `has()` branch is exercised by the tests above — both the Set and array input shapes, and both the present/absent case for all 4 conditions).

- [ ] **Step 6: Commit**

```bash
git add src/combat/condition-effects.ts tests/combat/condition-effects.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7a): pure mechanical effects for prone/blinded/stunned/held

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `CONFIG.statusEffects` / `CONFIG.specialStatusEffects` wiring

**Files:**
- Modify: `src/conditions.ts`, `src/system.ts`

**Interfaces:**
- Consumes: `CONDITIONS` (`src/conditions.ts`, unchanged), the existing `adnd2e` ActiveEffect subtype (`src/data/active-effect/adnd2e.ts`, UNCHANGED by this task).
- Produces: `buildStatusEffects(): readonly StatusEffectConfig[]` (exported from `src/conditions.ts`) — no other task consumes this directly, it's wired once in `system.ts`.

Real v14.364 facts this task is grounded in (confirmed by direct source read during planning, `client/config.mjs`):
- `CONFIG.statusEffects` is a `Proxy` around an array with built-in id-based dedup — `.push({id, ...})` is safe: if `id` already exists it replaces that entry in place, otherwise it appends. No special care needed beyond calling `.push()`.
- An entry's shape is `{id, name, img, order?, hud?, ...anything else valid on ActiveEffectData}` — critically, **`type` is a legal field**, and `Actor#toggleStatusEffect` → `ActiveEffect.fromStatusEffect` (`client/documents/actor.mjs:552-584`, `client/documents/active-effect.mjs:127-138`) deep-clones the WHOLE entry (only stripping `id`/`hud`) into the constructed `ActiveEffectData`, so setting `type: "adnd2e"` on an entry makes a Token HUD toggle create a real `adnd2e`-subtype `ActiveEffect` with whatever `system` defaults the entry carries — no `Actor#toggleStatusEffect` override needed.
- `CONFIG.specialStatusEffects.BLIND` (default `"blind"`) is read by real core vision/detection code (`client/canvas/placeables/token.mjs`, `client/canvas/perception/detection-modes/invisibility-perception.mjs`) to drive actual blindness. Since this system's own condition id is `"blinded"` (not `"blind"`), it must reassign `CONFIG.specialStatusEffects.BLIND = "blinded"` at `init` for core vision code to recognize it — otherwise core keeps checking for the literal id `"blind"`, which this system never creates.

- [ ] **Step 1: Add `buildStatusEffects()` to `src/conditions.ts`**

```ts
// src/conditions.ts — append below the existing CONDITIONS export.

/** The exact shape a CONFIG.statusEffects entry needs (real v14.364 fields:
 *  id/name/img/hud always read; `type` is a legal ActiveEffectData field that
 *  Actor#toggleStatusEffect/ActiveEffect.fromStatusEffect deep-clone through,
 *  so setting it here makes a Token HUD toggle create a real `adnd2e`-subtype
 *  ActiveEffect with these `system` defaults — no extra wiring needed). */
export interface StatusEffectConfig {
  id: string;
  name: string;
  img: string;
  type: "adnd2e";
  hud: boolean;
  system: { conditionId: string; isCondition: true; suppressWhenUnequipped: false; schoolTag: null };
}

export function buildStatusEffects(): readonly StatusEffectConfig[] {
  return CONDITIONS.map((c) => ({
    id: c.id,
    name: c.name,
    img: c.img,
    type: "adnd2e" as const,
    hud: true,
    system: { conditionId: c.id, isCondition: true as const, suppressWhenUnequipped: false as const, schoolTag: null },
  }));
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/conditions.test.ts — add a new describe block (keep the existing pack test from Task 1)
import { buildStatusEffects } from "../src/conditions";

describe("buildStatusEffects", () => {
  it("produces one entry per CONDITIONS row, id/name/img matching exactly", () => {
    const effects = buildStatusEffects();
    expect(effects).toHaveLength(CONDITIONS.length);
    for (let i = 0; i < CONDITIONS.length; i++) {
      expect(effects[i]!.id).toBe(CONDITIONS[i]!.id);
      expect(effects[i]!.name).toBe(CONDITIONS[i]!.name);
      expect(effects[i]!.img).toBe(CONDITIONS[i]!.img);
      expect(effects[i]!.type).toBe("adnd2e");
      expect(effects[i]!.hud).toBe(true);
      expect(effects[i]!.system.conditionId).toBe(CONDITIONS[i]!.id);
      expect(effects[i]!.system.isCondition).toBe(true);
    }
  });
});
```

Run: `npx vitest run tests/conditions.test.ts 2>&1 | tail -30`
Expected: FAIL — `buildStatusEffects` doesn't exist yet.

- [ ] **Step 3: Confirm the implementation passes it**

Run: `npx vitest run tests/conditions.test.ts 2>&1 | tail -30`
Expected: PASS (Step 1's implementation already covers this).

- [ ] **Step 4: Wire `system.ts`'s `init` hook**

```ts
// src/system.ts
import { buildStatusEffects } from "./conditions";
// ...(add alongside existing imports)

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  CONFIG.Item.dataModels = ITEM_DATA_MODELS;
  CONFIG.Actor.documentClass = Adnd2eActor;
  CONFIG.Item.documentClass = Adnd2eItem;
  CONFIG.ActiveEffect.documentClass = Adnd2eActiveEffect;
  CONFIG.Combatant.documentClass = Adnd2eCombatant;
  CONFIG.Combat.documentClass = Adnd2eCombat;
  Object.assign(CONFIG.ActiveEffect.dataModels, ACTIVE_EFFECT_DATA_MODELS);
  CONFIG.Actor.dataModels = ACTOR_DATA_MODELS;
  // CONFIG.statusEffects is a Proxy with built-in id-based dedup (real v14.364
  // source, client/config.mjs) — .push() is safe even if a later Foundry
  // version adds a core default with the same id. specialStatusEffects.BLIND
  // is reassigned so core's own vision/detection code (which checks for the
  // literal id "blind") recognizes this system's "blinded" condition instead.
  for (const effect of buildStatusEffects()) {
    (CONFIG.statusEffects as unknown as { push(e: unknown): void }).push(effect);
  }
  CONFIG.specialStatusEffects.BLIND = "blinded";
  registerSettings();
  registerMigrationSettings();
  registerSheets();
});
```

- [ ] **Step 5: Run the full suite**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.
Run: `npx vitest run 2>&1 | tail -60` — expect PASS, no regressions.
Run: `npm run test:coverage 2>&1 | tail -60` — expect `src/conditions.ts` still 100%.

- [ ] **Step 6: Commit**

```bash
git add src/conditions.ts src/system.ts tests/conditions.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7a): wire CONFIG.statusEffects from CONDITIONS at init

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire condition mechanics into the attack-roll flow

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts`, `src/sheets/creature/combat-rolls.ts`

**Interfaces:**
- Consumes: `blindedAttackPenalty`/`proneArmorClassPenalty`/`heldAttackBonus`/`canAct` (Task 2, `src/combat/condition-effects.ts`).
- Produces: nothing new consumed by later tasks — this is a leaf integration.

Scope note recorded here so it isn't lost: condition-based modifiers apply ONLY in the auto-resolved single-target branch of `rollAttack` (where a real target-actor reference exists) — the manual-AC dialog path (0 or 2+ targets) is unaffected, since a GM typing in an AC number is assumed to already account for any situational effects they want reflected. `blindedAttackPenalty` is the one exception: it depends only on the ACTING actor, so it applies unconditionally (both branches).

- [ ] **Step 1: Add the `canAct` gate + `blindedAttackPenalty` to `src/sheets/character/combat-rolls.ts`'s `rollAttack`**

`AttackerActor`'s interface needs a `statuses` field (real v14.364 fact confirmed during planning: `Actor#statuses` is a live `Set<string>`, `client/documents/actor.mjs:94-97`). Add it, then gate at the top of `rollAttack` and populate `attackModifiers()`'s `situationalModifier`:

```ts
// src/sheets/character/combat-rolls.ts
import { blindedAttackPenalty, canAct, heldAttackBonus, proneArmorClassPenalty } from "../../combat/condition-effects";

interface AttackerActor {
  name: string; img: string; uuid: string;
  statuses: ReadonlySet<string>;
  system: { attributes?: { thac0?: { melee?: number; ranged?: number } } };
  items: { get(id: string): WeaponItemHandle | undefined } & Iterable<GenericAttackerItem>;
}
```

At the top of `rollAttack`, after the `weapon` guard:

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
  let targetStatuses: ReadonlySet<string> = new Set();

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    const info = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]);
    targetAc = info.ac + proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set());
    targetSize = info.size;
    targetStatuses = (t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set();
  } else {
    // ...(unchanged manual-AC dialog block)
    targetAc = manualAc;
  }
```

Then the `attackModifiers()` call gains `situationalModifier`:

```ts
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    proficiencyModifier: resolveProficiencyModifier(actor, weapon),
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses),
  });
```

- [ ] **Step 2: Add the localization key `ADND2E.chat.attack.cannotActWarning`**

In `lang/en.json`, inside the existing `ADND2E.chat.attack` block (alongside `manualAcTitle`/`noTargetHint`/etc.), add:

```json
        "cannotActWarning": "This actor is stunned or held and cannot attack this round."
```

Add drift-test coverage for this key in `tests/lang/en-coverage.test.ts` following this file's established per-key pattern (locate the existing `ADND2E.chat.attack.*` coverage block and add one line for `cannotActWarning`).

- [ ] **Step 3: Apply the identical change to `src/sheets/creature/combat-rolls.ts`'s `rollAttack`**

```ts
// src/sheets/creature/combat-rolls.ts
import { blindedAttackPenalty, canAct, heldAttackBonus, proneArmorClassPenalty } from "../../combat/condition-effects";

interface CreatureActor {
  name: string; img: string; uuid: string;
  statuses: ReadonlySet<string>;
  system: {
    attributes: { thac0: { value: number } };
    attacks: CreatureAttack[];
    saves: { effective: Record<SaveCategory, number> };
  };
}

export async function rollAttack(actor: CreatureActor, attackIndex: number): Promise<void> {
  const attack = actor.system.attacks[attackIndex];
  if (!attack) return;

  if (!canAct(actor.statuses)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.cannotActWarning"));
    return;
  }

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let targetStatuses: ReadonlySet<string> = new Set();

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    targetStatuses = (t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set();
    targetAc = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]).ac
      + proneArmorClassPenalty(targetStatuses);
  } else {
    // ...(unchanged manual-AC dialog block)
    targetAc = manualAc;
  }

  const thac0 = attack.thac0Override ?? actor.system.attributes.thac0.value;
  const { total: attackBonus, breakdown } = attackModifiers({
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses),
  });
```

(The rest of the function — roll, `hitResult`, card building, the on-hit damage roll — is unchanged.)

- [ ] **Step 4: Run typecheck + lint**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -60`
Expected: PASS, no regressions (both files are Foundry-shell, no unit tests of their own — this confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/sheets/creature/combat-rolls.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7a): wire prone/blinded/held/stunned into both attack-roll paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Initiative situational-modifier UI

**Files:**
- Modify: `src/documents/combatant.ts` (NO logic change — confirm it already reads the flag correctly, this task adds nothing here beyond verification), `src/system.ts` (register the hook)
- Create: `src/combat/initiative-modifier-dialog.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks in this plan.
- Produces: nothing consumed by later tasks — a leaf UI feature.

Real v14.364 facts this task is grounded in (confirmed by direct source read during planning): `CombatTracker._getEntryContextOptions()` fires `Hooks.callAll("getCombatTrackerContextOptions", app, optionsArray)` (`client/applications/api/application.mjs`'s `get{}ContextOptions` template resolves to the class name `CombatTracker`) — **the JSDoc comment directly above the call site in `combat-tracker.mjs` says `@fires {hookEvents:getCombatantContextOptions}`, a DIFFERENT name; this is a stale/mismatched doc comment, not the real hook name.** Step 1 below verifies the real name empirically before relying on it, exactly because this mismatch was flagged as uncertain during planning.

- [ ] **Step 1: Empirically verify the real Combat Tracker context-menu hook name**

Before writing any production code, confirm which hook actually fires. In a scratch/throwaway test (or directly in a linked dev-world console once Foundry is available — do this check as part of dev-world testing if it can't be confirmed statically), add a temporary listener for BOTH candidate names and observe which one fires when right-clicking a combatant row:

```js
Hooks.on("getCombatTrackerContextOptions", (app, options) => console.log("getCombatTrackerContextOptions fired", options));
Hooks.on("getCombatantContextOptions", (app, options) => console.log("getCombatantContextOptions fired", options));
```

Use whichever one actually logs. If this can't be verified before Step 2 is written (e.g. no dev-world access yet at this point in the task), write Step 2 against `"getCombatTrackerContextOptions"` (the name mechanically derived from real source during planning) and flag it explicitly in the task report for the reviewer to double-check against Task 8's dev-world test — do not silently guess without recording the uncertainty.

- [ ] **Step 2: Create the dialog helper**

Mirrors this codebase's own established single-field `DialogV2.prompt` pattern (e.g. `src/sheets/character/sheet.ts`'s Award XP dialog) rather than inventing a new one:

```ts
// src/combat/initiative-modifier-dialog.ts
import { SYSTEM_ID } from "../constants";

interface ModifiableCombatant {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  initiative: number | null;
  id: string;
  combat: { rollInitiative(ids: string[]): Promise<unknown> } | null;
}

/** Prompts for a new situational initiative modifier and stores it on the
 *  combatant (read by src/documents/combatant.ts's _getInitiativeFormula,
 *  unchanged by this task). If the combatant has already rolled this round,
 *  immediately re-rolls so the change is visibly reflected without requiring
 *  a separate manual reroll. */
export async function promptInitiativeModifier(combatant: ModifiableCombatant): Promise<void> {
  const current = Number(combatant.getFlag(SYSTEM_ID, "initiativeModifier") ?? 0);
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.combat.initiativeModifier.title") },
    content: `<p>${game.i18n!.localize("ADND2E.combat.initiativeModifier.hint")}</p>
      <input type="number" name="modifier" value="${current}" step="1" autofocus>`,
    ok: {
      label: game.i18n!.localize("ADND2E.combat.initiativeModifier.set"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const input = button.form?.elements.namedItem("modifier");
        return input instanceof HTMLInputElement ? input.valueAsNumber : NaN;
      },
    },
  });
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  await combatant.setFlag(SYSTEM_ID, "initiativeModifier", value);
  if (typeof combatant.initiative === "number" && combatant.combat) {
    await combatant.combat.rollInitiative([combatant.id]);
  }
}
```

- [ ] **Step 3: Add the 3 new lang keys**

In `lang/en.json`, add a new `ADND2E.combat.initiativeModifier` block (create the `ADND2E.combat` parent object if it doesn't already exist — check first):

```json
    "combat": {
      "initiativeModifier": {
        "title": "Set Initiative Modifier",
        "hint": "A one-off situational adjustment for this combatant's initiative this round (e.g. a spell's casting time). Lower is better.",
        "set": "Set"
      }
    }
```

Add drift-test coverage for these 3 keys in `tests/lang/en-coverage.test.ts`, following this file's established per-block pattern.

- [ ] **Step 4: Wire the hook in `src/system.ts`**

```ts
// src/system.ts
import { promptInitiativeModifier } from "./combat/initiative-modifier-dialog";
// ...(add alongside existing imports)

Hooks.once("ready", async () => {
  console.log(`${SYSTEM_ID} | Ready`);
  (game.system as unknown as { api: ReturnType<typeof buildApi> }).api = buildApi();
  await runMigrations();
  registerChatListeners();
  Hooks.on("getCombatTrackerContextOptions", (_app: unknown, options: unknown[]) => {
    options.push({
      name: "ADND2E.combat.initiativeModifier.title",
      icon: '<i class="fa-solid fa-dice-d10"></i>',
      condition: (li: HTMLElement) => Boolean((li.closest("[data-combatant-id]") as HTMLElement | null)?.dataset.combatantId),
      callback: (li: HTMLElement) => {
        const id = (li.closest("[data-combatant-id]") as HTMLElement | null)?.dataset.combatantId;
        const combatant = id ? game.combat?.combatants.get(id) : undefined;
        if (combatant) void promptInitiativeModifier(combatant as never);
      },
    });
  });
});
```

(If Step 1's empirical check found the actual DOM attribute/selector or context-menu-entry shape differs from what's written here — e.g. `data-combatant-id` isn't the real attribute name, or the entry object wants `label` instead of `name` — correct this step to match what was actually observed, and note the correction in the task report.)

- [ ] **Step 5: Run typecheck + lint**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -60` — expect PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/combat/initiative-modifier-dialog.ts src/system.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7a): Combat Tracker UI for the initiative situational modifier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire the 6 `combatAndTactics` settings into `OptionalRules`

**Files:**
- Modify: `src/core/options.ts`, `src/settings/registry.ts`, `tests/settings/registry.test.ts`, `lang/en.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `OptionalRules.combatAndTacticsEnabled`/`.criticalHits`/`.calledShots`/`.combatManeuvers`/`.armorTypeVsWeaponType`/`.weaponMastery` — consumed by Plans 7b/7c/7d (not this plan).

- [ ] **Step 1: Update the failing tests first**

`tests/settings/registry.test.ts` currently asserts (a) exactly 8 bound descriptors, all `group === "core"`, and (b) `readOptionalRules` "ignores reserved-group keys — they never appear in the bag" using `criticalHits` as the literal example. Both assertions become wrong once this task lands. Rewrite:

```ts
// tests/settings/registry.test.ts
describe("SETTING_DESCRIPTORS", () => {
  it("registers 22 settings across the 4 groups", () => {
    expect(SETTING_DESCRIPTORS).toHaveLength(22);
    const byGroup = SETTING_DESCRIPTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.group] = (acc[d.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(byGroup).toEqual({
      core: 8,
      combatAndTactics: 6,
      skillsAndPowers: 4,
      spellsAndMagic: 4,
    });
  });

  it("keys are unique", () => {
    const keys = SETTING_DESCRIPTORS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every default is a boolean", () => {
    for (const d of SETTING_DESCRIPTORS) expect(typeof d.default).toBe("boolean");
  });

  it("core and combatAndTactics settings bind 1:1 to OptionalRules fields; skillsAndPowers/spellsAndMagic bind to null", () => {
    const bound = SETTING_DESCRIPTORS.filter((d) => d.optionalRulesKey !== null);
    expect(bound).toHaveLength(14);
    for (const d of bound) expect(["core", "combatAndTactics"]).toContain(d.group);

    const boundKeys = bound.map((d) => d.optionalRulesKey).sort();
    expect(boundKeys).toEqual(Object.keys(DEFAULT_OPTIONAL_RULES).sort());

    for (const d of SETTING_DESCRIPTORS.filter((x) => x.group === "skillsAndPowers" || x.group === "spellsAndMagic")) {
      expect(d.optionalRulesKey).toBeNull();
    }
  });

  it("a bound descriptor's default matches the OptionalRules default", () => {
    for (const d of SETTING_DESCRIPTORS) {
      if (d.optionalRulesKey === null) continue;
      expect(d.default).toBe(DEFAULT_OPTIONAL_RULES[d.optionalRulesKey]);
    }
  });
});

describe("readOptionalRules()", () => {
  it("returns the defaults when the store is empty", () => {
    expect(readOptionalRules(() => undefined)).toEqual(DEFAULT_OPTIONAL_RULES);
  });

  it("reads a stored boolean through", () => {
    const bag = readOptionalRules((key) => (key === "exceptionalStrength" ? false : undefined));
    expect(bag.exceptionalStrength).toBe(false);
    expect(bag.maxSpellsPerLevel).toBe(false); // untouched default
  });

  it("falls back to the default when the stored value is not a boolean", () => {
    const bag = readOptionalRules(() => "true" as unknown);
    expect(bag).toEqual(DEFAULT_OPTIONAL_RULES);
  });

  it("reads a combatAndTactics key through, same as a core key", () => {
    const bag = readOptionalRules((key) => (key === "criticalHits" ? true : undefined));
    expect(bag.criticalHits).toBe(true);
  });

  it("ignores skillsAndPowers/spellsAndMagic keys — they never appear in the bag", () => {
    const bag = readOptionalRules((key) => (key === "subAbilityScores" ? true : undefined));
    expect(bag).not.toHaveProperty("subAbilityScores");
  });
});
```

Run: `npx vitest run tests/settings/registry.test.ts 2>&1 | tail -30`
Expected: FAIL — `OptionalRules` doesn't have the 6 new fields yet, `SETTING_DESCRIPTORS` still has `optionalRulesKey: null` for all 6.

- [ ] **Step 2: Add the 6 fields to `OptionalRules` + `DEFAULT_OPTIONAL_RULES`**

```ts
// src/core/options.ts
export interface OptionalRules {
  exceptionalStrength: boolean;
  maxSpellsPerLevel: boolean;
  weaponSpeedInitiative: boolean;
  spellFailureFromWisdom: boolean;
  trainingRequiredToLevel: boolean;
  nonweaponProficienciesUsed: boolean;
  weaponProficienciesUsed: boolean;
  multiclassHpAveraging: boolean;
  /** Sub-project 7 master switch — every other combatAndTactics.* key is a
   *  no-op unless this is also true. */
  combatAndTacticsEnabled: boolean;
  /** Sub-project 7 Plan 7b: critical-hit/fumble severity tables. */
  criticalHits: boolean;
  /** Sub-project 7 Plan 7d: called shots. */
  calledShots: boolean;
  /** Sub-project 7 Plan 7d: the curated combat-maneuver set. */
  combatManeuvers: boolean;
  /** Sub-project 7 Plan 7b: weapon-damageType vs armor-type modifiers. */
  armorTypeVsWeaponType: boolean;
  /** Sub-project 7 Plan 7c: the weapon-mastery tier system. */
  weaponMastery: boolean;
}

export const DEFAULT_OPTIONAL_RULES: OptionalRules = {
  exceptionalStrength: true,
  maxSpellsPerLevel: false,
  weaponSpeedInitiative: false,
  spellFailureFromWisdom: true,
  trainingRequiredToLevel: false,
  nonweaponProficienciesUsed: true,
  weaponProficienciesUsed: true,
  multiclassHpAveraging: true,
  combatAndTacticsEnabled: false,
  criticalHits: false,
  calledShots: false,
  combatManeuvers: false,
  armorTypeVsWeaponType: false,
  weaponMastery: false,
};
```

Also update the file's own header comment (currently: "Only the `core`-group toggles live here. `combatAndTactics.*` / ... are registered but are not part of this bag until their sub-project wires the branches") — this is now stale for `combatAndTactics.*` specifically:

```ts
/**
 * The optional-rules toggle bag passed into every `core/` function whose result
 * a rule switch can change. `data/` builds this from `game.settings`
 * (`getOptionalRules()`); `core/` only ever receives it as a parameter.
 *
 * `core` and `combatAndTactics` group toggles both live here (Sub-project 7
 * wired the latter). `skillsAndPowers.*` / `spellsAndMagic.*` settings are
 * registered but are not part of this bag until their sub-project wires the
 * branches (spec §6.2).
 */
```

- [ ] **Step 3: Wire the 6 descriptors' `optionalRulesKey` in `src/settings/registry.ts`**

```ts
// src/settings/registry.ts
  // --- combatAndTactics: Sub-project 7 ---
  { key: "combatAndTacticsEnabled", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "combatAndTacticsEnabled" },
  { key: "criticalHits", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "criticalHits" },
  { key: "calledShots", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "calledShots" },
  { key: "combatManeuvers", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "combatManeuvers" },
  { key: "armorTypeVsWeaponType", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "armorTypeVsWeaponType" },
  { key: "weaponMastery", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "weaponMastery" },
```

(Replaces the existing 6-entry block whose `optionalRulesKey` was `null` on every row — same `key`/`group`/`default`/`config` values, only `optionalRulesKey` changes.)

- [ ] **Step 4: Update the 6 hint texts in `lang/en.json`**

Each of the 6 `combatAndTactics.*` hints currently ends "Requires Sub-project 7" — now literally true (the toggle exists and is flippable) but the underlying mechanic still doesn't exist until Plans 7b/7c/7d land. Update each hint to say so precisely, following the established "(not yet enforced)" convention this file already uses elsewhere:

```json
      "combatAndTacticsEnabled": {
        "name": "Combat & Tactics: Enabled",
        "hint": "Master switch for the Combat & Tactics option group. Individual rules below have no effect until this is on."
      },
      "criticalHits": {
        "name": "Combat & Tactics: Critical Hits",
        "hint": "Natural 20 confirms for extra damage (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
      },
      "calledShots": {
        "name": "Combat & Tactics: Called Shots",
        "hint": "Target specific body locations at an attack penalty (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
      },
      "combatManeuvers": {
        "name": "Combat & Tactics: Combat Maneuvers",
        "hint": "Disarm, trip, overbear, and similar maneuvers (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
      },
      "armorTypeVsWeaponType": {
        "name": "Combat & Tactics: Armor vs. Weapon Type",
        "hint": "Weapon-type modifiers versus armor type (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
      },
      "weaponMastery": {
        "name": "Combat & Tactics: Weapon Mastery",
        "hint": "Mastery and grand-mastery weapon tiers beyond specialization (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
      },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/settings/registry.test.ts 2>&1 | tail -30`
Expected: PASS, all assertions.

Run: `npx vitest run tests/config/settings-augmentation.test.ts 2>&1 | tail -30`
Expected: PASS unchanged — `src/types/global.d.ts`'s `SettingConfig` already declares all 6 keys as `boolean` (confirmed during planning), and `lang/en.json`'s key SET doesn't change in Step 4 (only hint text), so this test's two assertions (augmented-keys-match-descriptors, lang-has-no-orphans) both still hold without any `global.d.ts` edit.

- [ ] **Step 6: Run the full suite**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.
Run: `npx vitest run 2>&1 | tail -60` — expect PASS, no regressions.
Run: `npm run test:coverage 2>&1 | tail -60` — expect `src/core/options.ts` and `src/settings/registry.ts` still 100%.

- [ ] **Step 7: Commit**

```bash
git add src/core/options.ts src/settings/registry.ts tests/settings/registry.test.ts lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp7a): wire the 6 combatAndTactics settings into OptionalRules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Whole-branch review

**Files:** none — review only.

- [ ] **Step 1: Generate the review package for the full branch diff**

Run the subagent-driven-development skill's `scripts/review-package` against `BASE` = this plan's starting commit (`master` at the time Task 1 was dispatched) and `HEAD` = Task 6's commit.

- [ ] **Step 2: Dispatch a whole-branch review on the most capable available model**

Explicitly ask the reviewer to check, beyond the standard full review: (a) that `condition` Item docs and the live `CONFIG.statusEffects`-driven `ActiveEffect`s stay correctly decoupled (the compendium is catalog-only, never read at runtime by Task 3's wiring); (b) that `blindedAttackPenalty`/`heldAttackBonus`/`proneArmorClassPenalty` signs are applied correctly in BOTH `combat-rolls.ts` files (a sign-flip bug here would be invisible to any automated gate); (c) that Task 5's hook-name uncertainty (§Task 5 Step 1) was actually resolved, not left as an unverified guess; (d) that `tests/settings/registry.test.ts`'s and `tests/conditions.test.ts`'s rewrites didn't silently weaken any assertion the originals made.

- [ ] **Step 3: Handle findings**

Per the skill's own process: one fix dispatch for any findings, one scoped re-review, adjudicate residuals. Record every finding and its resolution in the plan's SDD ledger.

---

### Task 8: GATED dev-world smoke check

**Files:** none — verification only, run by the user in a live linked Foundry v14.364 world.

This step is REQUIRED before `finishing-a-development-branch` — never deferred, never skipped, per this repo's standing rule.

- [ ] **Step 1: Build and link, ask the user to test**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world and walk through:

1. Open the Token HUD for a `character`/`npc`/`creature` token and confirm all 15 conditions appear as toggleable icons. Toggle "Prone" on: confirm a real `ActiveEffect` of type `adnd2e` appears on the actor (inspect via the Effects tab or console). Toggle it off: confirm the effect is removed.
2. With a token Prone, have another token attack it: confirm the effective target AC used in the attack roll is worse (2 higher, in this system's descending-AC numbers) than the un-prone value shown on the sheet.
3. Toggle "Blinded" on the attacking token, attack again: confirm the roll's situational modifier includes a -4 penalty (visible in the chat card's modifier breakdown).
4. Toggle "Held" on the target, attack again (target not also stunned/held on the attacker's side): confirm a +4 bonus applies.
5. Toggle "Stunned" on the attacking token, attempt to attack: confirm the action is refused with the warning message, and no roll is posted.
6. Toggle one of the other 11 conditions (e.g. "Charmed"): confirm it applies as a marker with zero mechanical effect on any roll (this is intentional, not a bug).
7. Open the Combat Tracker with an active combat, right-click a combatant row: confirm a "Set Initiative Modifier" (or equivalent) option appears, opens a dialog, and setting a nonzero value changes that combatant's rolled initiative.
8. Open Foundry's Configure Settings, find the 6 new "Combat & Tactics" toggles: confirm they appear under the right group heading, default to off, and can be flipped without error.

- [ ] **Step 2: Record the result**

If any step fails, diagnose (console errors, direct document inspection as needed — the same debugging pattern established in every prior sub-project) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 8 steps PASS.

---

After Task 8 passes: use **superpowers:finishing-a-development-branch**. After merge: **Plan 7a is complete — Plan 7b (Critical hits/fumbles + armor-vs-weapon-type) is next.**
