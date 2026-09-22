# Sub-project 7 Plan 7c: Weapon Mastery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing boolean `specialized` weapon-proficiency flag with a 4-step `masteryTier` scale (0 = proficient, 1 = Specialized, 2 = Mastery, 3 = Grand Mastery), migrate existing data, and wire the new tiers' to-hit/damage/extra-attack bonuses into the PC/NPC attack-roll path and sheet UI, gated by the `weaponMastery` optional rule.

**Architecture:** A new pure `src/core/proficiencies/weapon-mastery.ts` module supplies the tier→bonus and tier→slot-cost tables, wrapping the existing `weaponSpecializationEffect`/`weaponSpecializationSlotCost` for tier 1 so the two can never drift apart. The existing `specializeWeapon` action, `resolveProficiencyModifier` roll-time lookup, and the `WeaponProfView` sheet-context row all become tier-aware. A one-time data migration (the first real entry in this system's migration framework) converts any `specialized: true` weapon-proficiency item to `masteryTier: 1`; the migration framework itself gains a second hook (`itemUpdate`) since `masteryTier` lives on an embedded Item, not the actor's own `system` object, which the existing `actorUpdate`-only framework cannot reach.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`ApplicationV2`/`ActorSheetV2`, `Actor#updateEmbeddedDocuments`).

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` — §2 "Weapon mastery tier model" row, §4.3, §5 (error handling), §7 (out of scope: "High Mastery" as a 5th tier), §8 deliverables checklist.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question (this plan's `Actor#updateEmbeddedDocuments` use in particular) is answered by reading `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source — never `fvtt-types` (pinned to a v13-beta, confirmed wrong about several v14 APIs elsewhere in this project).
- **Content policy:** the tier 2/3 bonus values and the tier-cost progression are this project's OWN designed numbers (per spec §3's Global Constraints and §2's locked decision), not transcribed from the Combat & Tactics book. No copyrighted rules prose anywhere.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**, and do not touch `package.json`'s dependencies/`package-lock.json`/`node_modules` (this plan DOES touch `package.json`'s `version` field only — see Task 2 — nothing else in that file).
- **`npm run build` requires Foundry fully closed** — re-confirm with the user before every build attempt.
- **Read vitest output with `tail`/`head`/redirect, never `| grep`** — a cache-clear's first run can genuinely flake; rerun 2-3× before concluding something is wrong.
- **Two-layer architecture:** `src/core/**` (all of it, directory-level wildcard in `tsconfig.core.json`, `vitest.config.ts` coverage `include`, and `eslint.config.js`'s pure-zone `files`/`ignores` — a new file under `src/core/proficiencies/` needs NO triad edit, it's already covered) must import nothing from Foundry, 100% line/branch/function/statement coverage (branches gate is 90%, per `vitest.config.ts`). `src/sheets/character/context.ts` and `src/sheets/character/context-types.ts` are ALSO in the pure zone (listed file-by-file in all three triad configs) — they must stay Foundry-free; `input.optionalRules` is how Foundry-layer settings state reaches this pure layer (already used by `buildSpells`, confirmed at `src/sheets/character/context.ts:413`). `src/sheets/character/sheet.ts`, `src/sheets/character/proficiency-actions.ts`, `src/sheets/character/combat-rolls.ts`, `src/sheets/npc/sheet.ts`, `src/data/migrations.ts`'s Foundry-glue counterpart `src/migrations/run.ts`, and all `templates/**/*.hbs`/`lang/en.json` are Foundry-layer — not unit-tested, verified in the dev world.
- **Duplicate re-validation pattern:** every roll-time/purchase action re-derives its own eligibility server-side from the actor's real current state — never trusts client-side button visibility alone (`advanceWeaponMastery` re-checks tier/category/chassis/slots exactly as `specializeWeapon` does today).
- **Settings gating:** `combatAndTacticsEnabled` is a master AND-gate over `weaponMastery` — every check is `optionalRules.combatAndTacticsEnabled && optionalRules.weaponMastery`. When either is off, the "Advance Mastery" button is simply not rendered (not rendered-then-ignored) — matches spec §5.
- **`WeaponProficiencyItemModel.masteryTier`** already exists on the schema (`NumberField`, `required: true, integer: true, min: 0, initial: 0`) — added in an earlier sub-project, unused until this plan.

---

### Task 1: Pure weapon-mastery core module

**Files:**
- Create: `src/core/proficiencies/weapon-mastery.ts`
- Create: `tests/core/proficiencies/weapon-mastery.test.ts`

**Interfaces:**
- Consumes: `weaponSpecializationEffect(category): SpecializationEffect` and `weaponSpecializationSlotCost(category): number` from `src/core/proficiencies/weapon.ts` (read at `src/core/proficiencies/weapon.ts:21-42`, unchanged by this plan). `SpecializationCategory` type from `src/core/types.ts`.
- Produces: `MasteryEffect { toHit: number; damage: number; extraAttacks: number }`, `weaponMasteryEffect(tier: 0 | 1 | 2 | 3, category: SpecializationCategory): MasteryEffect`, `weaponMasteryTierCost(tier: 1 | 2 | 3, category: SpecializationCategory): number` — both consumed by Task 3 (context.ts), Task 4 (proficiency-actions.ts, combat-rolls.ts).

Locked value table (spec §2's "Weapon mastery tier model" row + this plan's own progression for tier-cost, per the Global Constraints' content-policy line):

| Tier | toHit | damage | extraAttacks | Slot cost to REACH this tier (melee/crossbow) | Slot cost to REACH this tier (bow) |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 |
| 1 (Specialized) | melee: 1, bow/crossbow: 0 | melee: 2, bow/crossbow: 0 | 0 | 2 | 3 |
| 2 (Mastery) | 2 | 3 | 0 | 4 | 5 |
| 3 (Grand Mastery) | 3 | 3 | 1 | 7 | 8 |

Tier 1's `toHit`/`damage` come directly from `weaponSpecializationEffect(category)` (melee gets +1/+2, bow/crossbow get +0/+0 — the existing point-blank-only missile treatment is untouched and out of scope here, same as today). Tiers 2 and 3 apply a flat bonus regardless of category — they do NOT carry forward tier 1's missile/melee split, since that split exists only because of the still-unbuilt point-blank-range mechanic (`weaponSpecializationEffect`'s own doc comment at `src/core/proficiencies/weapon.ts:32-37` — point-blank detection doesn't exist anywhere in this codebase; out of scope for this plan too). Slot costs are cumulative totals needed to reach that tier (mirrors `weaponSpecializationSlotCost`'s existing shape, where the caller charges `max(0, cost(tier) - alreadyInvested)`): tier 2 = tier-1 cost + 2, tier 3 = tier-1 cost + 5 (i.e. +2 then +3, cumulative).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/core/proficiencies/weapon-mastery.test.ts
import { describe, expect, it } from "vitest";
import { weaponMasteryEffect, weaponMasteryTierCost } from "../../../src/core/proficiencies/weapon-mastery";

describe("weaponMasteryEffect", () => {
  it("tier 0 is a no-op for every category", () => {
    expect(weaponMasteryEffect(0, "melee")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
    expect(weaponMasteryEffect(0, "bow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
    expect(weaponMasteryEffect(0, "crossbow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
  });

  it("tier 1 (Specialized) matches weaponSpecializationEffect's melee values", () => {
    expect(weaponMasteryEffect(1, "melee")).toEqual({ toHit: 1, damage: 2, extraAttacks: 0 });
  });

  it("tier 1 (Specialized) matches weaponSpecializationEffect's missile values", () => {
    expect(weaponMasteryEffect(1, "bow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
    expect(weaponMasteryEffect(1, "crossbow")).toEqual({ toHit: 0, damage: 0, extraAttacks: 0 });
  });

  it("tier 2 (Mastery) is +2/+3, flat across every category", () => {
    expect(weaponMasteryEffect(2, "melee")).toEqual({ toHit: 2, damage: 3, extraAttacks: 0 });
    expect(weaponMasteryEffect(2, "bow")).toEqual({ toHit: 2, damage: 3, extraAttacks: 0 });
    expect(weaponMasteryEffect(2, "crossbow")).toEqual({ toHit: 2, damage: 3, extraAttacks: 0 });
  });

  it("tier 3 (Grand Mastery) is +3/+3 and one extra attack per round, flat across every category", () => {
    expect(weaponMasteryEffect(3, "melee")).toEqual({ toHit: 3, damage: 3, extraAttacks: 1 });
    expect(weaponMasteryEffect(3, "bow")).toEqual({ toHit: 3, damage: 3, extraAttacks: 1 });
    expect(weaponMasteryEffect(3, "crossbow")).toEqual({ toHit: 3, damage: 3, extraAttacks: 1 });
  });
});

describe("weaponMasteryTierCost", () => {
  it("tier 1 matches weaponSpecializationSlotCost exactly", () => {
    expect(weaponMasteryTierCost(1, "melee")).toBe(2);
    expect(weaponMasteryTierCost(1, "crossbow")).toBe(2);
    expect(weaponMasteryTierCost(1, "bow")).toBe(3);
  });

  it("tier 2 is tier 1's cost plus 2", () => {
    expect(weaponMasteryTierCost(2, "melee")).toBe(4);
    expect(weaponMasteryTierCost(2, "bow")).toBe(5);
  });

  it("tier 3 is tier 1's cost plus 5", () => {
    expect(weaponMasteryTierCost(3, "melee")).toBe(7);
    expect(weaponMasteryTierCost(3, "bow")).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/proficiencies/weapon-mastery.test.ts > /tmp/wm1.log 2>&1; tail -n 40 /tmp/wm1.log`
Expected: FAIL — `src/core/proficiencies/weapon-mastery.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Write the implementation**

```typescript
// src/core/proficiencies/weapon-mastery.ts
// Player's Option: Combat & Tactics weapon mastery (SP7 Plan 7c). Collapses
// the old specialized:boolean into a 4-step masteryTier scale: 0 = proficient
// only, 1 = Specialized (unchanged from weaponSpecializationEffect/Cost),
// 2 = Mastery, 3 = Grand Mastery. Tier 2/3 bonuses and the tier-cost
// progression are this project's OWN designed numbers (spec §2's "Weapon
// mastery tier model" + this project's content-policy constraint), not
// transcribed from the Combat & Tactics book's actual tables. The book's
// separate "High Mastery" tier is skipped (spec §7, out of scope).
import { weaponSpecializationEffect, weaponSpecializationSlotCost } from "./weapon";
import type { SpecializationCategory } from "../types";

export interface MasteryEffect {
  toHit: number;
  damage: number;
  extraAttacks: number;
}

/**
 * The attack/damage bonus and extra-attacks-per-round grant for a weapon
 * proficiency at `tier` (0-3). Tier 1's values are `weaponSpecializationEffect`'s
 * existing melee/missile split, wrapped directly so the two can never
 * silently drift apart. Tiers 2 and 3 apply a flat bonus regardless of
 * category — unlike tier 1, they do not carry forward the missile-only
 * point-blank distinction (point-blank range detection still doesn't exist
 * anywhere in this codebase — see `weaponSpecializationEffect`'s own doc
 * comment).
 */
export function weaponMasteryEffect(
  tier: 0 | 1 | 2 | 3,
  category: SpecializationCategory,
): MasteryEffect {
  if (tier === 0) return { toHit: 0, damage: 0, extraAttacks: 0 };
  if (tier === 1) {
    const spec = weaponSpecializationEffect(category);
    return { toHit: spec.toHit, damage: spec.damage, extraAttacks: 0 };
  }
  if (tier === 2) return { toHit: 2, damage: 3, extraAttacks: 0 };
  return { toHit: 3, damage: 3, extraAttacks: 1 };
}

/**
 * Total weapon-proficiency slots that must be invested to REACH `tier`
 * (cumulative — matches `weaponSpecializationSlotCost`'s existing shape, so
 * callers charge `max(0, weaponMasteryTierCost(tier, category) -
 * prof.slotsInvested)`). Tier 1 is unchanged from
 * `weaponSpecializationSlotCost`; tiers 2 and 3 extend it by a flat 2 and 3
 * more slots per step respectively (this plan's own progression).
 */
export function weaponMasteryTierCost(tier: 1 | 2 | 3, category: SpecializationCategory): number {
  const tier1 = weaponSpecializationSlotCost(category);
  if (tier === 1) return tier1;
  if (tier === 2) return tier1 + 2;
  return tier1 + 5;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/proficiencies/weapon-mastery.test.ts > /tmp/wm2.log 2>&1; tail -n 40 /tmp/wm2.log`
Expected: PASS, all 8 tests green. If it prints "no tests found" or similarly suspicious output, rerun once or twice before treating it as real (known Vitest cache-clear flake) — never pipe through `grep`.

- [ ] **Step 5: Run coverage to confirm the new pure module is caught by the gate**

Run: `npm run test:coverage > /tmp/wm-cov.log 2>&1; tail -n 60 /tmp/wm-cov.log`
Expected: `src/core/proficiencies/weapon-mastery.ts` appears in the coverage report at 100% lines/statements/functions (branches ≥ 90%) — it needs no triad edit (`src/core/**` is already a directory-level wildcard in `tsconfig.core.json`, `vitest.config.ts`, and `eslint.config.js`), so this step only confirms that's actually true rather than changing any config.

- [ ] **Step 6: Commit**

```bash
git add src/core/proficiencies/weapon-mastery.ts tests/core/proficiencies/weapon-mastery.test.ts
git commit -m "feat(sp7c): add pure weapon-mastery tier effect/cost module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Schema change + migration framework extension + first real migration

**Files:**
- Modify: `src/data/item/weapon-proficiency.ts` (drop `specialized` field)
- Modify: `src/data/item/weapon.ts` (delete dead `specialization` sub-object)
- Modify: `src/data/migrations.ts` (widen `Migration` interface, add the real migration entry)
- Modify: `src/migrations/run.ts` (process the new `itemUpdate` hook)
- Modify: `tests/data/migrations.test.ts` (existing suite — extend for the new hook + the real entry)
- Modify: `package.json`, `system.json` (version bump — see Step 5 for why this is required, not optional)

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `Migration.itemUpdate?(sourceSystem, itemType): Record<string, unknown> | null` (optional, alongside the now-also-optional `Migration.actorUpdate?`) — no other task consumes this directly, but Task 6's dev-world check verifies its effect.

**Current real state** (read before editing — confirmed during this plan's research):

`src/data/item/weapon-proficiency.ts`'s `defineSchema()` currently returns:
```ts
return {
  ...super.defineSchema(),
  weaponOrGroup: new StringField({ required: true, blank: true, initial: "" }),
  isGroup: new BooleanField({ required: true, initial: false }),
  slotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
  specialized: new BooleanField({ required: true, initial: false }),
  styleSpecialization: new StringField({ required: true, nullable: true, initial: null }),
  masteryTier: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
};
```

`src/data/item/weapon.ts`'s `defineSchema()` currently includes this dead, zero-reference sub-object (confirmed via grep across `src/`):
```ts
specialization: new SchemaField({
  profSlotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
  isSpecialized: new BooleanField({ required: true, initial: false }),
  isMastery: new BooleanField({ required: true, initial: false }),
}),
```
and its field destructure line is `const { StringField, NumberField, BooleanField, SchemaField } = foundry.data.fields;` — `BooleanField` is used ONLY inside `specialization`; `SchemaField` is also used by the (unrelated, keep) `range` field.

`src/data/migrations.ts`'s current `Migration` interface and `MIGRATIONS`:
```ts
export interface Migration {
  readonly version: string;
  actorUpdate(sourceSystem: Record<string, unknown>, actorType: string): Record<string, unknown> | null;
}

export const MIGRATIONS: readonly Migration[] = [];
```
This file also has a header comment documenting the v14 "you cannot drop a stale key with `-=`" gotcha — Foundry v14 prunes unknown keys from `_source` automatically once a field is removed from the schema, so this migration does NOT need to explicitly unset `specialized`; it only needs to SET `masteryTier`.

- [ ] **Step 1: Drop `specialized` from the weapon-proficiency schema**

Edit `src/data/item/weapon-proficiency.ts` — remove the `specialized: new BooleanField({ required: true, initial: false }),` line entirely. `BooleanField` stays in the destructure (still used by `isGroup`).

- [ ] **Step 2: Delete the dead `specialization` sub-object from the weapon schema**

Edit `src/data/item/weapon.ts` — remove the entire `specialization: new SchemaField({...}),` block (the last field in the schema object). Change the destructure line from:
```ts
const { StringField, NumberField, BooleanField, SchemaField } = foundry.data.fields;
```
to:
```ts
const { StringField, NumberField, SchemaField } = foundry.data.fields;
```
(`BooleanField` is now unused in this file — leaving it in would fail `@typescript-eslint/no-unused-vars`, configured as `"warn"` project-wide per `eslint.config.js:9`, but still worth removing cleanly.)

- [ ] **Step 3: Run typecheck to confirm nothing else references either dropped field**

Run: `npm run typecheck`
Expected: PASS. (Confirmed during this plan's research: `proficiency-actions.ts` and `combat-rolls.ts` both read `specialized` off weapon-proficiency items, NOT `weapon.system.specialization` — those two files are Task 4's job to update; if this typecheck fails here on something unexpected, treat that as new information and investigate before continuing rather than assuming this plan's research was complete.)

- [ ] **Step 4: Widen the `Migration` interface and write the first real migration**

Edit `src/data/migrations.ts`. Change the interface:
```ts
/**
 * One ordered schema migration. `version` is the `system.json` version that
 * introduced the schema change; a world whose stored migration version is older
 * runs it. `actorUpdate` is called once per world Actor; `itemUpdate` is called
 * once per Item embedded on that Actor (weapon proficiencies, weapons, etc. —
 * anything `masteryTier`-shaped lives on an embedded Item, not the actor's own
 * `system`, which `actorUpdate` alone cannot reach). A migration may define
 * either, both, or (meaninglessly) neither.
 */
export interface Migration {
  readonly version: string;
  /**
   * One actor's raw `_source.system` object + its document `type` → a Foundry
   * `updateDocuments` payload for that actor (dot-notation keys relative to the
   * actor document), or `null` to leave the actor untouched. See the v14 GOTCHA
   * in this file's header before writing a key-removal migration.
   */
  actorUpdate?(sourceSystem: Record<string, unknown>, actorType: string): Record<string, unknown> | null;
  /**
   * One embedded Item's raw `_source.system` object + its `type` → an
   * `updateEmbeddedDocuments("Item", ...)` payload for that item (dot-notation
   * keys relative to the item document), or `null` to leave it untouched.
   */
  itemUpdate?(sourceSystem: Record<string, unknown>, itemType: string): Record<string, unknown> | null;
}
```

Then replace the empty `MIGRATIONS` array with the real entry (the exact `version` string is finalized in Step 5 below — use `"0.3.0"`, matching this task's package/system version bump):
```ts
/** Every migration, ascending by version. SP1 shipped this framework with an
 *  empty list; this is its first real entry (SP7 Plan 7c) — collapses the
 *  retired `specialized: boolean` weapon-proficiency flag into tier 1 of the
 *  new `masteryTier` scale. `specialized` itself needs no explicit unset: once
 *  it's gone from the schema (this plan's own Step 1), Foundry v14 prunes it
 *  from `_source` automatically (see this file's v14 GOTCHA comment above). */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: "0.3.0",
    itemUpdate(sourceSystem, itemType) {
      if (itemType !== "weaponProficiency") return null;
      if (sourceSystem.specialized !== true) return null;
      return { "system.masteryTier": 1 };
    },
  },
];
```

`pendingMigrations` needs NO change — it only reads `.version`, never calls `.actorUpdate`/`.itemUpdate` itself.

- [ ] **Step 5: Bump the system version so this migration is ever eligible to run**

Read `scripts/prepare-release.mjs` first (already read during this plan's research — for the rolling "latest" channel this repo's README installs from, it stamps the BUILT `dist/system.json`'s version as `${manifest.version}-dev.${runNumber}`, taking `manifest.version` straight from the SOURCE `system.json` unchanged). `migrations.ts`'s `isVersionNewer` treats a `-dev.N` suffix as a prerelease, which sorts BEFORE the same `x.y.z` with no suffix (see that file's own doc comment). Concretely: if the source `system.json`'s version stays `"0.2.0"`, every rolling dev build reports itself as `"0.2.0-dev.N"` — never newer than a migration entry versioned `"0.2.0"` or earlier — so a migration entry can NEVER become "pending" for any world without a real version bump landing in this same change. Bump both:
- `system.json`'s `"version"` field: `"0.2.0"` → `"0.3.0"`
- `package.json`'s `"version"` field: `"0.2.0"` → `"0.3.0"`

(This is the one and only touch to `package.json` this plan makes — the Global Constraints ban on modifying `package.json` is about dependencies/scripts, not this required version field.)

- [ ] **Step 6: Wire `itemUpdate` into the Foundry-glue migration runner**

Read `src/migrations/run.ts`'s CURRENT full content first (already read during this plan's research — reproduced below as the starting point). Then read real v14.364 `resources/app/client/documents/actor.mjs` (or wherever `Actor`'s embedded-collection update method lives in that build) to confirm `updateEmbeddedDocuments("Item", updates)` is the correct v14 signature for a bulk embedded-Item update — do not assume from general Foundry knowledge, per this project's Global Constraints.

Current `runMigrations()`:
```ts
export async function runMigrations(): Promise<void> {
  if (!game.user?.isActiveGM) return;

  const stored =
    (game.settings!.get(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey) as string) || "0.0.0";
  const current = game.system!.version;
  const dryRun = game.settings!.get(SYSTEM_ID, DRY_RUN_KEY as SettingKey) as boolean;

  const pending = pendingMigrations(stored, MIGRATIONS);
  if (!isVersionNewer(current, stored)) return; // world already current

  console.log(
    `${SYSTEM_ID} | migration check ${stored} → ${current}` +
      (dryRun ? " (DRY RUN — no writes)" : "") +
      (pending.length === 0 ? " — no migrations to apply" : ""),
  );

  try {
    for (const migration of pending) {
      const updates: Record<string, unknown>[] = [];
      for (const actor of game.actors!) {
        const source = (actor as unknown as { _source: { system: Record<string, unknown> } })._source;
        const payload = migration.actorUpdate(source.system, actor.type);
        if (!payload) continue;
        if (dryRun) {
          console.log(
            `${SYSTEM_ID} | migration ${migration.version} would update "${actor.name}":`,
            payload,
          );
        } else {
          updates.push({ _id: actor.id, ...payload });
        }
      }
      if (!dryRun && updates.length > 0) {
        await CONFIG.Actor.documentClass.updateDocuments(updates);
        console.log(
          `${SYSTEM_ID} | migration ${migration.version}: updated ${updates.length} actor(s)`,
        );
      }
    }

    if (dryRun) {
      if (pending.length > 0) {
        ui.notifications!.info(game.i18n!.localize("ADND2E.migration.dryRunComplete"));
      }
    } else {
      await game.settings!.set(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey, current);
      if (pending.length > 0) {
        ui.notifications!.info(game.i18n!.format("ADND2E.migration.migrated", { version: current }));
      }
    }
  } catch (err) {
    console.error(`${SYSTEM_ID} | migration failed — version left at ${stored}`, err);
    ui.notifications!.error(game.i18n!.localize("ADND2E.migration.failed"));
  }
}
```

Replace the `for (const migration of pending)` block with (only the actor-loop body changes — everything outside it, including the dry-run/version-checkpoint tail, is unchanged):
```ts
    for (const migration of pending) {
      const actorUpdates: Record<string, unknown>[] = [];
      for (const actor of game.actors!) {
        const source = (actor as unknown as { _source: { system: Record<string, unknown> } })._source;
        const payload = migration.actorUpdate?.(source.system, actor.type) ?? null;
        if (payload) {
          if (dryRun) {
            console.log(
              `${SYSTEM_ID} | migration ${migration.version} would update actor "${actor.name}":`,
              payload,
            );
          } else {
            actorUpdates.push({ _id: actor.id, ...payload });
          }
        }

        if (migration.itemUpdate) {
          const itemUpdates: Record<string, unknown>[] = [];
          for (const item of actor.items as Iterable<{
            id: string;
            name: string;
            type: string;
            _source: { system: Record<string, unknown> };
          }>) {
            const itemPayload = migration.itemUpdate(item._source.system, item.type);
            if (!itemPayload) continue;
            if (dryRun) {
              console.log(
                `${SYSTEM_ID} | migration ${migration.version} would update item "${item.name}" on actor "${actor.name}":`,
                itemPayload,
              );
            } else {
              itemUpdates.push({ _id: item.id, ...itemPayload });
            }
          }
          if (!dryRun && itemUpdates.length > 0) {
            await (
              actor as unknown as {
                updateEmbeddedDocuments(type: string, data: Record<string, unknown>[]): Promise<unknown>;
              }
            ).updateEmbeddedDocuments("Item", itemUpdates);
            console.log(
              `${SYSTEM_ID} | migration ${migration.version}: updated ${itemUpdates.length} item(s) on "${actor.name}"`,
            );
          }
        }
      }
      if (!dryRun && actorUpdates.length > 0) {
        await CONFIG.Actor.documentClass.updateDocuments(actorUpdates);
        console.log(
          `${SYSTEM_ID} | migration ${migration.version}: updated ${actorUpdates.length} actor(s)`,
        );
      }
    }
```

- [ ] **Step 7: Extend the pure migration tests**

Read `tests/data/migrations.test.ts`'s current content first. Add test cases for the new real migration entry's `itemUpdate` (the framework-level `parseVersion`/`isVersionNewer`/`pendingMigrations` tests already there are unaffected and need no changes):
```typescript
import { MIGRATIONS } from "../../src/data/migrations";

describe("SP7c weapon-mastery migration (0.3.0)", () => {
  const migration = MIGRATIONS.find((m) => m.version === "0.3.0")!;

  it("sets masteryTier: 1 for a specialized weaponProficiency item", () => {
    expect(migration.itemUpdate?.({ specialized: true }, "weaponProficiency")).toEqual({
      "system.masteryTier": 1,
    });
  });

  it("is a no-op for a non-specialized weaponProficiency item", () => {
    expect(migration.itemUpdate?.({ specialized: false }, "weaponProficiency")).toBeNull();
  });

  it("is a no-op for a specialized: true field on any other item type", () => {
    expect(migration.itemUpdate?.({ specialized: true }, "weapon")).toBeNull();
  });

  it("has no actorUpdate hook — this migration is item-only", () => {
    expect(migration.actorUpdate).toBeUndefined();
  });
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/data/migrations.test.ts > /tmp/mig1.log 2>&1; tail -n 40 /tmp/mig1.log`
Expected: PASS, all tests green (existing + 4 new).

- [ ] **Step 9: Run full typecheck + coverage**

Run: `npm run typecheck > /tmp/mig-tc.log 2>&1; tail -n 40 /tmp/mig-tc.log`
Run: `npm run test:coverage > /tmp/mig-cov.log 2>&1; tail -n 60 /tmp/mig-cov.log`
Expected: both PASS. `src/data/migrations.ts` is already in all three pure-zone triad configs (confirmed during this plan's research) — no config edit needed, this step only confirms coverage still holds with the widened interface and new entry.

- [ ] **Step 10: Commit**

```bash
git add src/data/item/weapon-proficiency.ts src/data/item/weapon.ts src/data/migrations.ts src/migrations/run.ts tests/data/migrations.test.ts package.json system.json
git commit -m "feat(sp7c): migrate specialized weapon proficiencies to masteryTier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Pure sheet-context layer — tier-aware `WeaponProfView`

**Files:**
- Modify: `src/sheets/character/context-types.ts` (`WeaponProfView` interface)
- Modify: `src/sheets/character/context.ts` (`buildWeaponProfRow`, its imports)
- Modify: `tests/sheets/character/context.test.ts` (existing suite — update field names + tier-aware cases)

**Interfaces:**
- Consumes: `weaponMasteryEffect`, `weaponMasteryTierCost` from Task 1's `src/core/proficiencies/weapon-mastery.ts`; `canWeaponSpecialize` from `src/core/proficiencies/weapon.ts` (unchanged import, still used); `CharacterSheetInput["optionalRules"]` (already flows into this file — confirmed at `src/sheets/character/context.ts:413`, `OptionalRules.combatAndTacticsEnabled`/`.weaponMastery` fields confirmed in `src/core/options.ts:30,40`).
- Produces: `WeaponProfView { ...; masteryTier: 0|1|2|3; masteryTierLabelKey: string | null; canAdvanceMastery: boolean }` — consumed by Task 5 (templates) reading it as `w.masteryTier`/`w.masteryTierLabelKey`/`w.canAdvanceMastery`, and by Task 4's `toWeaponProfView` mapper in `sheet.ts` which populates the raw (pre-`buildWeaponProfRow`) placeholder shape.

**Current real state** (confirmed during this plan's research):

`src/sheets/character/context-types.ts:110-139`'s current `WeaponProfView`:
```ts
export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  slotsInvested: number; specialized: boolean;
  category: "melee" | "crossbow" | "bow" | null;
  canSpecialize: boolean;
}
```

`src/sheets/character/context.ts:360-404`'s current `buildWeaponProfRow` (plus its neighbor `resolveWeaponCategory`, unchanged by this task):
```ts
function buildWeaponProfRow(
  prof: WeaponProfView,
  input: CharacterSheetInput,
  weaponSlotsAvailable: number,
): WeaponProfView {
  const category = resolveWeaponCategory(prof, input.physicalItems);
  const primaryChassis = input.classItems[0] ? getChassis(input.classItems[0].chassisId as ClassId) : null;
  const isSingleClass = input.classItems.length === 1;
  const eligible =
    !prof.specialized &&
    category !== null &&
    primaryChassis !== null &&
    canWeaponSpecialize({ specializationAllowed: primaryChassis.weaponSpecializationAllowed, isSingleClass }) &&
    weaponSlotsAvailable >= Math.max(0, weaponSpecializationSlotCost(category) - prof.slotsInvested);
  return { ...prof, category, canSpecialize: eligible };
}
```

- [ ] **Step 1: Update `WeaponProfView`**

Edit `src/sheets/character/context-types.ts`:
```ts
export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  slotsInvested: number; masteryTier: 0 | 1 | 2 | 3;
  masteryTierLabelKey: string | null;
  category: "melee" | "crossbow" | "bow" | null;
  canAdvanceMastery: boolean;
}
```

- [ ] **Step 2: Update `buildWeaponProfRow` and its imports**

Edit `src/sheets/character/context.ts`. Change the import line:
```ts
import { canWeaponSpecialize } from "../../core/proficiencies/weapon";
```
(drop `weaponSpecializationSlotCost` from this import — no longer used here) and add:
```ts
import { weaponMasteryTierCost } from "../../core/proficiencies/weapon-mastery";
```

Add a module-level lookup right above `buildWeaponProfRow` (or wherever this file's other small constant tables live — follow the existing file's convention):
```ts
const MASTERY_TIER_LABEL_KEYS: readonly (string | null)[] = [
  null,
  "ADND2E.sheet.skills.masteryTier.1",
  "ADND2E.sheet.skills.masteryTier.2",
  "ADND2E.sheet.skills.masteryTier.3",
];
```

Replace `buildWeaponProfRow`:
```ts
function buildWeaponProfRow(
  prof: WeaponProfView,
  input: CharacterSheetInput,
  weaponSlotsAvailable: number,
): WeaponProfView {
  const category = resolveWeaponCategory(prof, input.physicalItems);
  const primaryChassis = input.classItems[0] ? getChassis(input.classItems[0].chassisId as ClassId) : null;
  const isSingleClass = input.classItems.length === 1;
  const masteryEnabled = input.optionalRules.combatAndTacticsEnabled && input.optionalRules.weaponMastery;
  const nextTier = (prof.masteryTier + 1) as 1 | 2 | 3;
  const eligible =
    masteryEnabled &&
    prof.masteryTier < 3 &&
    category !== null &&
    primaryChassis !== null &&
    canWeaponSpecialize({ specializationAllowed: primaryChassis.weaponSpecializationAllowed, isSingleClass }) &&
    weaponSlotsAvailable >= Math.max(0, weaponMasteryTierCost(nextTier, category) - prof.slotsInvested);
  return {
    ...prof,
    category,
    masteryTierLabelKey: MASTERY_TIER_LABEL_KEYS[prof.masteryTier] ?? null,
    canAdvanceMastery: eligible,
  };
}
```

- [ ] **Step 3: Update the existing test suite's field names and fixtures**

Read `tests/sheets/character/context.test.ts` in full around the weapon-proficiency section first (confirmed locations during this plan's research: a `weaponProf(...)` fixture helper around line 657 and a block of `canSpecialize`-focused tests spanning roughly lines 1231-1318). Every fixture/assertion using `specialized`/`canSpecialize` needs updating:
- `weaponProf({ specialized: false, ... })` fixtures → `weaponProf({ masteryTier: 0, ... })` (and `{ specialized: true }` → `{ masteryTier: 1 }` for the "already specialized" case).
- Any raw `WeaponProfView` object literal built directly in a test (e.g. the one at line 657: `{ id: "wp1", name: "Sword", weaponOrGroup: "long-sword", isGroup: false, slotsInvested: 1, specialized: false, category: null, canSpecialize: false }`) → replace `specialized: false, category: null, canSpecialize: false` with `masteryTier: 0, category: null, masteryTierLabelKey: null, canAdvanceMastery: false`.
- `row.canSpecialize` / `c.skills.weapon.items[0]!.canSpecialize` assertions → `row.canAdvanceMastery` / `c.skills.weapon.items[0]!.canAdvanceMastery`.
- The test titled `"a non-fighter class (specializationAllowed false) → canSpecialize false even with slots to spare"` (and its siblings) keep their scenario, just renamed assertions/fixtures.

Every test in this whole file that builds a full `CharacterSheetInput` (which `buildWeaponProfRow`'s `masteryEnabled` check now reads via `input.optionalRules`) must already supply an `optionalRules` object — confirm the shared test fixture/builder sets `combatAndTacticsEnabled: true, weaponMastery: true` for the weapon-proficiency-focused tests (add it if the fixture doesn't already default every `OptionalRules` field to a permissive value), and add ONE new test proving the gate itself:
```typescript
it("weaponMastery optional rule off → canAdvanceMastery false even when otherwise eligible", () => {
  const c = buildCharacterSheetContext({
    ...baseCharacterInput(), // however this file's existing tests construct a full valid input
    optionalRules: { ...DEFAULT_OPTIONAL_RULES_FIXTURE, combatAndTacticsEnabled: true, weaponMastery: false },
    proficiencyItems: { weapon: [weaponProf({ masteryTier: 0 })], nonweapon: [] },
    // ...carry over whatever else the existing "single-classed fighter... canSpecialize true" test
    // (around line 1239) used to make this proficiency eligible in every other respect
  });
  expect(c.skills.weapon.items[0]!.canAdvanceMastery).toBe(false);
});
```
(Adjust the fixture-construction details to match this file's actual existing helpers — read them first; the point is one test that isolates the `weaponMastery` toggle as the sole reason eligibility flips to `false`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sheets/character/context.test.ts > /tmp/ctx1.log 2>&1; tail -n 60 /tmp/ctx1.log`
Expected: PASS, every weapon-proficiency test green (both the renamed existing ones and the new gate test).

- [ ] **Step 5: Run typecheck + coverage**

Run: `npm run typecheck > /tmp/ctx-tc.log 2>&1; tail -n 40 /tmp/ctx-tc.log`
Run: `npm run test:coverage > /tmp/ctx-cov.log 2>&1; tail -n 60 /tmp/ctx-cov.log`
Expected: both PASS, 100% coverage maintained on `src/sheets/character/context.ts` (branches ≥ 90%) — the new `masteryEnabled` conjunct and the `nextTier < 3` guard both need true/false coverage, which Step 3's tests should already provide; if coverage reports an uncovered branch, add the missing case rather than weakening the assertion.

- [ ] **Step 6: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts tests/sheets/character/context.test.ts
git commit -m "feat(sp7c): make WeaponProfView mastery-tier-aware, gated by weaponMastery rule

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Foundry-layer glue — advance-mastery action + attack-roll modifier

**Files:**
- Modify: `src/sheets/character/proficiency-actions.ts` (`specializeWeapon` → `advanceWeaponMastery`)
- Modify: `src/sheets/character/combat-rolls.ts` (`resolveProficiencyModifier`)

Not unit-tested (this plan's Global Constraints — Foundry-shell glue) — verified in Task 7's gated dev-world check.

**Interfaces:**
- Consumes: `weaponMasteryTierCost` (proficiency-actions.ts) and `weaponMasteryEffect` (combat-rolls.ts) from Task 1's `src/core/proficiencies/weapon-mastery.ts`; `canWeaponSpecialize` from `src/core/proficiencies/weapon.ts` (unchanged, still consumed by `advanceWeaponMastery`).
- Produces: `advanceWeaponMastery(actor: ProficiencyActor, weaponProfItemId: string): Promise<void>` — consumed by Task 5's `character/sheet.ts` and `npc/sheet.ts` action-map wiring (both currently call `specializeWeapon`, confirmed via grep during this plan's research — `npc/sheet.ts` imports and reuses the SAME function from `character/proficiency-actions.ts`, so this one file's rename covers both sheets).

**Current real state** (confirmed during this plan's research — full files read):

`src/sheets/character/proficiency-actions.ts`'s current `specializeWeapon` (lines 93-123) and its `WeaponProfItemHandle` interface (lines 22-25):
```ts
interface WeaponProfItemHandle {
  id: string;
  system: { weaponOrGroup: string; isGroup: boolean; slotsInvested: number; specialized: boolean };
}
...
export async function specializeWeapon(actor: ProficiencyActor, weaponProfItemId: string): Promise<void> {
  const item = actor.items.get(weaponProfItemId);
  const prof = item as (WeaponProfItemHandle & GenericProficiencyActorItem) | undefined;
  if (!prof || prof.type !== "weaponProficiency" || prof.system.specialized) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.specializeBlockedWarning"));
    return;
  }
  const category = resolveCategory(actor, prof);
  const chassisId = firstClassChassisId(actor);
  const classCount = [...actor.items].filter((i) => i.type === "class").length;
  if (
    !category ||
    !chassisId ||
    !canWeaponSpecialize({
      specializationAllowed: getChassis(chassisId).weaponSpecializationAllowed,
      isSingleClass: classCount === 1,
    })
  ) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.specializeBlockedWarning"));
    return;
  }
  const cost = Math.max(0, weaponSpecializationSlotCost(category) - prof.system.slotsInvested);
  if (actor.system.proficiencies.weapon.available < cost) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.specializeBlockedWarning"));
    return;
  }
  await prof.update({
    "system.specialized": true,
    "system.slotsInvested": prof.system.slotsInvested + cost,
  });
}
```
Import line: `import { canWeaponSpecialize, weaponSpecializationSlotCost } from "../../core/proficiencies/weapon";`. `resolveCategory`/`firstClassChassisId` are unrelated helpers in this file — unchanged by this task.

`src/sheets/character/combat-rolls.ts`'s current `resolveProficiencyModifier` (lines 95-132) — full text already reproduced in this session's research and matches the file read at plan-writing time (import line 7: `import { weaponAttackPenalty, weaponSpecializationEffect } from "../../core/proficiencies/weapon";`).

- [ ] **Step 1: Rename and re-tier `specializeWeapon` → `advanceWeaponMastery`**

Edit `src/sheets/character/proficiency-actions.ts`. Change the import line:
```ts
import { canWeaponSpecialize } from "../../core/proficiencies/weapon";
import { weaponMasteryTierCost } from "../../core/proficiencies/weapon-mastery";
```

Update `WeaponProfItemHandle`:
```ts
interface WeaponProfItemHandle {
  id: string;
  system: { weaponOrGroup: string; isGroup: boolean; slotsInvested: number; masteryTier: 0 | 1 | 2 | 3 };
}
```

Replace `specializeWeapon` with:
```ts
/** Advances a weapon proficiency's mastery tier by exactly 1 (never jumping
 *  tiers): re-derives the SAME eligibility context.ts's `buildWeaponProfRow`
 *  used to decide whether to show the Advance Mastery button (not a group, a
 *  resolved category, the actor's first-class chassis allows specialization,
 *  single-classed, below tier 3, enough available slots for the NEXT tier),
 *  spends that tier's slot-cost delta, and increments `masteryTier`. No-ops
 *  with a toast on any failed re-check — a defensive guard against a stale
 *  button click, not the primary gate. Eligibility re-checks
 *  `canWeaponSpecialize` at EVERY tier advance, not just the first (spec §2's
 *  "Weapon mastery tier model": "no new class-eligibility rule" — the same
 *  gate governs every step of the ladder). */
export async function advanceWeaponMastery(actor: ProficiencyActor, weaponProfItemId: string): Promise<void> {
  const item = actor.items.get(weaponProfItemId);
  const prof = item as (WeaponProfItemHandle & GenericProficiencyActorItem) | undefined;
  if (!prof || prof.type !== "weaponProficiency" || prof.system.masteryTier >= 3) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.advanceMasteryBlockedWarning"));
    return;
  }
  const category = resolveCategory(actor, prof);
  const chassisId = firstClassChassisId(actor);
  const classCount = [...actor.items].filter((i) => i.type === "class").length;
  if (
    !category ||
    !chassisId ||
    !canWeaponSpecialize({
      specializationAllowed: getChassis(chassisId).weaponSpecializationAllowed,
      isSingleClass: classCount === 1,
    })
  ) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.advanceMasteryBlockedWarning"));
    return;
  }
  const nextTier = (prof.system.masteryTier + 1) as 1 | 2 | 3;
  const cost = Math.max(0, weaponMasteryTierCost(nextTier, category) - prof.system.slotsInvested);
  if (actor.system.proficiencies.weapon.available < cost) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.advanceMasteryBlockedWarning"));
    return;
  }
  await prof.update({
    "system.masteryTier": nextTier,
    "system.slotsInvested": prof.system.slotsInvested + cost,
  });
}
```

Also update the doc-comment cross-reference at line 193 (`"any class" rule (which specializeWeapon still needs unchanged)`) to say `advanceWeaponMastery` instead.

- [ ] **Step 2: Switch `resolveProficiencyModifier` from a boolean to a tier**

Edit `src/sheets/character/combat-rolls.ts`. Change the import line:
```ts
import { weaponAttackPenalty } from "../../core/proficiencies/weapon";
import { weaponMasteryEffect } from "../../core/proficiencies/weapon-mastery";
```

Replace `resolveProficiencyModifier`:
```ts
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): number {
  let isProficient = false;
  let masteryTier: 0 | 1 | 2 | 3 = 0;
  let groupMatch: { masteryTier?: 0 | 1 | 2 | 3 } | null = null;
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as { weaponOrGroup?: string; isGroup?: boolean; masteryTier?: 0 | 1 | 2 | 3 };
    if (s.isGroup !== true && s.weaponOrGroup === weapon.name) {
      isProficient = true;
      masteryTier = s.masteryTier ?? 0;
      groupMatch = null;
      break;
    }
    if (s.isGroup === true && s.weaponOrGroup === weapon.system.proficiencyGroup && !groupMatch) {
      groupMatch = s;
    }
  }
  if (!isProficient && groupMatch) {
    isProficient = true;
    masteryTier = groupMatch.masteryTier ?? 0;
  }

  let nonProficiencyPenalty = 0;
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) {
      nonProficiencyPenalty = getChassis(chassisId as ClassId).nonProficiencyPenalty;
      break;
    }
  }

  const base = weaponAttackPenalty(nonProficiencyPenalty, isProficient ? "proficient" : "non-proficient");
  if (!isProficient || masteryTier === 0) return base;

  // Tier 1 (Specialized) is the pre-existing, always-on mechanic — it applies
  // regardless of the weaponMastery toggle, exactly like it did before this
  // plan. Tiers 2-3 are NEW behavior this plan adds, so they're capped back
  // down to tier 1 whenever the optional rule is off — a persisted
  // masteryTier of 2/3 doesn't silently keep granting its bonus after a GM
  // disables the rule (mirrors how criticalHits/armorTypeVsWeaponType are
  // both re-checked at roll time in this same file, not only at UI-render
  // time — spec §5's "not... rendered and then ignored server-side" applies
  // equally to a persisted tier as to an ephemeral per-roll UI choice).
  const rules = getOptionalRules();
  const masteryEnabled = rules.combatAndTacticsEnabled && rules.weaponMastery;
  const effectiveTier = masteryEnabled ? masteryTier : (Math.min(masteryTier, 1) as 0 | 1);

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  return base + weaponMasteryEffect(effectiveTier, category).toHit;
}
```
`getOptionalRules` is already imported in this file (`import { getOptionalRules } from "../../settings";`, confirmed during this plan's research — used elsewhere in this same file for the crit/armor-vs-weapon-type gates Plan 7b added) — no new import needed for it.

Update this function's doc comment (currently: `"0 if proficient; class non-proficiency penalty if not; +1 if specialized"`) to reflect the tiered, toggle-gated bonus instead of a flat `+1`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck > /tmp/glue-tc.log 2>&1; tail -n 40 /tmp/glue-tc.log`
Expected: PASS. (This will still show errors from Task 5's not-yet-done `sheet.ts` import rename — `sheet.ts` still imports `specializeWeapon` by name. If so, that's expected at this point in the plan; Task 5 fixes it. If the errors are anything OTHER than the two `sheet.ts` files' `specializeWeapon` import, investigate before continuing.)

- [ ] **Step 4: Commit**

```bash
git add src/sheets/character/proficiency-actions.ts src/sheets/character/combat-rolls.ts
git commit -m "feat(sp7c): advanceWeaponMastery action + tier-aware attack-roll modifier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sheet UI — templates, lang keys, action-map wiring (PC + NPC)

**Files:**
- Modify: `src/sheets/character/sheet.ts` (mapper + action map)
- Modify: `src/sheets/npc/sheet.ts` (action map — reuses the same imported function)
- Modify: `templates/actor/character/skills.hbs`
- Modify: `templates/actor/npc/main.hbs`
- Modify: `lang/en.json`

Not unit-tested (Foundry-shell glue + templates + lang strings) — verified in Task 7's gated dev-world check.

**Interfaces:**
- Consumes: `advanceWeaponMastery` from Task 4's `proficiency-actions.ts`; the `WeaponProfView` shape from Task 3.
- Produces: nothing further consumed by later tasks — this is the UI's terminal wiring.

**Current real state** (confirmed during this plan's research):

`src/sheets/character/sheet.ts:167-186`'s current `toWeaponProfView` mapper:
```ts
export function toWeaponProfView(it: RawItem): WeaponProfView {
  const s = it.system as {
    weaponOrGroup: string;
    isGroup: boolean;
    slotsInvested: number;
    specialized: boolean;
  };
  return {
    id: it.id,
    name: it.name,
    weaponOrGroup: s.weaponOrGroup,
    isGroup: s.isGroup,
    slotsInvested: s.slotsInvested,
    specialized: s.specialized,
    category: null,
    canSpecialize: false,
  };
}
```

`src/sheets/character/sheet.ts:279`: `specializeWeapon: Adnd2eCharacterSheet.#onSpecializeWeapon,` in the ApplicationV2 action map; `src/sheets/character/sheet.ts:670`: `if (weaponProfItemId) await specializeWeapon(this.document as never, weaponProfItemId);` inside the private `#onSpecializeWeapon` handler; import line 20 includes `specializeWeapon` among several named imports from `./proficiency-actions`.

`src/sheets/npc/sheet.ts:18`: `import { rollNonweaponCheck, rollThiefSkill, specializeWeapon } from "../character/proficiency-actions";`; line 96: `specializeWeapon: Adnd2eNpcSheet.#onSpecializeWeapon,`; line 390: `if (id) await specializeWeapon(this.document as never, id);`.

`templates/actor/character/skills.hbs:9-24` and `templates/actor/npc/main.hbs:151-164` share this identical structure:
```hbs
{{#each adnd2e.skills.weapon.items as |w|}}
  <div class="prof-row" data-item-id="{{w.id}}">
    <span class="name">
      {{w.weaponOrGroup}}
      {{#if w.isGroup}}<span class="badge">{{localize 'ADND2E.sheet.skills.group'}}</span>{{/if}}
    </span>
    <span class="slots">{{w.slotsInvested}}</span>
    {{#if w.specialized}}
      <span class="specialized" title="{{localize 'ADND2E.sheet.skills.specialized'}}">★</span>
    {{/if}}
    {{#if w.canSpecialize}}
      <button type="button" data-action="specializeWeapon" data-item-id="{{w.id}}">
        {{localize 'ADND2E.sheet.skills.specialize'}}
      </button>
    {{/if}}
  </div>
{{/each}}
```

`lang/en.json`'s current `skills` block (lines 272-291) includes `"specialized": "Specialized"`, `"specialize": "Specialize"`, `"specializeBlockedWarning": "That weapon can no longer be specialized — refresh the sheet."` among other unrelated keys that stay unchanged (`weapon`, `nonweapon`, `slots`, `checkTarget`, `group`, `racial`, `none`, `check`, `checkBlockedWarning`, `thief`, etc.). Line 505-508's `weaponMastery` setting descriptor currently has `"hint": "Mastery and grand-mastery weapon tiers beyond specialization (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"`.

- [ ] **Step 1: Update `toWeaponProfView` and the action map in `src/sheets/character/sheet.ts`**

Replace `toWeaponProfView`:
```ts
export function toWeaponProfView(it: RawItem): WeaponProfView {
  const s = it.system as {
    weaponOrGroup: string;
    isGroup: boolean;
    slotsInvested: number;
    masteryTier: 0 | 1 | 2 | 3;
  };
  return {
    id: it.id,
    name: it.name,
    weaponOrGroup: s.weaponOrGroup,
    isGroup: s.isGroup,
    slotsInvested: s.slotsInvested,
    masteryTier: s.masteryTier,
    // Placeholders — buildWeaponProfRow (context.ts) recomputes both from
    // the actor's owned weapon Items + class chassis + available slots.
    category: null,
    masteryTierLabelKey: null,
    canAdvanceMastery: false,
  };
}
```

Change the named import at line 20 from `specializeWeapon` to `advanceWeaponMastery`. Change the action-map entry (line 279) from `specializeWeapon: Adnd2eCharacterSheet.#onSpecializeWeapon,` to `advanceWeaponMastery: Adnd2eCharacterSheet.#onAdvanceWeaponMastery,`. Rename the private handler method `#onSpecializeWeapon` to `#onAdvanceWeaponMastery`, and inside it change `await specializeWeapon(this.document as never, weaponProfItemId);` to `await advanceWeaponMastery(this.document as never, weaponProfItemId);`.

- [ ] **Step 2: Update the action map in `src/sheets/npc/sheet.ts`**

Change the import line 18 from `import { rollNonweaponCheck, rollThiefSkill, specializeWeapon } from "../character/proficiency-actions";` to `import { rollNonweaponCheck, rollThiefSkill, advanceWeaponMastery } from "../character/proficiency-actions";`. Change line 96's action-map entry from `specializeWeapon: Adnd2eNpcSheet.#onSpecializeWeapon,` to `advanceWeaponMastery: Adnd2eNpcSheet.#onAdvanceWeaponMastery,`. Rename the private handler `#onSpecializeWeapon` to `#onAdvanceWeaponMastery`, and inside it change line 390's `await specializeWeapon(this.document as never, id);` to `await advanceWeaponMastery(this.document as never, id);`.

- [ ] **Step 3: Update both weapon-proficiency-row templates**

Edit `templates/actor/character/skills.hbs` (lines 9-24) and `templates/actor/npc/main.hbs` (lines 151-164) identically:
```hbs
{{#each adnd2e.skills.weapon.items as |w|}}
  <div class="prof-row" data-item-id="{{w.id}}">
    <span class="name">
      {{w.weaponOrGroup}}
      {{#if w.isGroup}}<span class="badge">{{localize 'ADND2E.sheet.skills.group'}}</span>{{/if}}
    </span>
    <span class="slots">{{w.slotsInvested}}</span>
    {{#if w.masteryTierLabelKey}}
      <span class="specialized" title="{{localize w.masteryTierLabelKey}}">{{w.masteryTier}}</span>
    {{/if}}
    {{#if w.canAdvanceMastery}}
      <button type="button" data-action="advanceWeaponMastery" data-item-id="{{w.id}}">
        {{localize 'ADND2E.sheet.skills.advanceMastery'}}
      </button>
    {{/if}}
  </div>
{{/each}}
```
(The `.specialized` CSS class name on the tier badge `<span>` is kept as-is — it's a stylesheet hook, not the old field name, and renaming it would require a matching SCSS edit for zero visible benefit; out of scope.)

- [ ] **Step 4: Update `lang/en.json`**

In the `skills` block, remove these three keys entirely:
```json
"specialized": "Specialized",
"specialize": "Specialize",
"specializeBlockedWarning": "That weapon can no longer be specialized — refresh the sheet.",
```
Add in their place:
```json
"masteryTier": {
  "1": "Specialized",
  "2": "Mastery",
  "3": "Grand Mastery"
},
"advanceMastery": "Advance Mastery",
"advanceMasteryBlockedWarning": "That weapon's mastery can no longer be advanced — refresh the sheet.",
```
(Valid JSON — Foundry's `game.i18n.localize` reads nested keys via dot-path, e.g. `ADND2E.sheet.skills.masteryTier.2`, exactly matching Task 3's `MASTERY_TIER_LABEL_KEYS` strings.)

Update the `weaponMastery` setting's hint (around line 507) from:
```json
"hint": "Mastery and grand-mastery weapon tiers beyond specialization (Combat & Tactics). (not yet enforced — lands in a later Combat & Tactics plan)"
```
to:
```json
"hint": "Mastery and grand-mastery weapon tiers beyond specialization (Combat & Tactics)."
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck > /tmp/ui-tc.log 2>&1; tail -n 40 /tmp/ui-tc.log`
Run: `npm run lint > /tmp/ui-lint.log 2>&1; tail -n 60 /tmp/ui-lint.log`
Expected: both PASS — no leftover `specializeWeapon`/`specialized`/`canSpecialize` references anywhere in `src/` (this task's step 1-2 renames were the last two Foundry-layer call sites; Tasks 2-4 already removed every other reference).

- [ ] **Step 6: Run the full test suite once more for a whole-plan sanity check**

Run: `npm run test:coverage > /tmp/ui-cov.log 2>&1; tail -n 80 /tmp/ui-cov.log`
Expected: PASS, coverage thresholds met, zero references to the old field names anywhere in the pure zone's tests.

- [ ] **Step 7: Commit**

```bash
git add src/sheets/character/sheet.ts src/sheets/npc/sheet.ts templates/actor/character/skills.hbs templates/actor/npc/main.hbs lang/en.json
git commit -m "feat(sp7c): wire Advance Mastery UI into PC + NPC weapon-proficiency rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Whole-branch review

**This task is MANDATORY regardless of how clean every prior task's per-task review was.** Both Plan 7a and Plan 7b (the two prior plans in this same sub-project) had real Critical/Important bugs surface ONLY at whole-branch-review time despite fully clean per-task reviews — treat that as the established norm for this codebase, not an exception.

- [ ] Dispatch a whole-branch code review on the most capable available model, covering the full diff from this plan's branch point to the current HEAD (all 5 implementation tasks). Point the reviewer at this plan's Global Constraints and at spec §4.3/§5/§7. Ask it to specifically check:
  - Every deleted/renamed field (`specialized`, `WeaponItemModel.specialization`, `specializeWeapon`, `canSpecialize`) has ZERO remaining references anywhere in `src/`, `templates/`, `lang/en.json`, and test files.
  - The migration's `itemUpdate` hook is correctly scoped to `itemType === "weaponProficiency"` only, and the version bump (`system.json`/`package.json` → `0.3.0`, migration entry `version: "0.3.0"`) is internally consistent.
  - `resolveProficiencyModifier`'s tier-lookup preserves the EXACT same proficient/non-proficient/group-match control flow as the original — only the specialized-boolean-to-tier substitution should have changed, not the surrounding logic.
  - `advanceWeaponMastery` re-derives eligibility fully server-side (category, chassis, single-class, tier ceiling, slot cost) before any `update()` call — matches this codebase's established duplicate-re-validation pattern.
  - The `weaponMastery` optional-rule gate is checked in BOTH `buildWeaponProfRow` (UI eligibility for new purchases) AND `resolveProficiencyModifier` (roll-time — caps a persisted tier back to 1 when the toggle is off, per Task 4 Step 2's design). Confirm both checks are actually present and consistent with each other.
  - No production code changes needed for Foundry's `updateEmbeddedDocuments` call — confirm the reviewer (or an implementer, if a fix round is needed) actually checked real v14.364 source for this API per the Global Constraints, not fvtt-types or general knowledge.
- [ ] Fix every Critical/Important finding via the SAME fix-round process used for every prior task in this plan (resume the implementer, or escalate model tier after 3 failed rounds per subagent-driven-development's standard loop) — the controller never fixes findings directly.
- [ ] Once clean, run `npm run typecheck && npm run lint && npm run test:coverage` one final time on the fully-fixed branch and confirm all green before moving to Task 7.

---

### Task 7: GATED dev-world smoke check

**This is a REQUIRED gated step — never deferred, never skipped**, regardless of how clean the automated tests and whole-branch review were. Confirm with the user before running `npm run build` that Foundry is fully closed.

- [ ] Build and link: confirm Foundry closed, run `npm run build`, then `npm run link` if not already linked, then have the user restart Foundry and load (or create) a test world with `optionalRules.combatAndTacticsEnabled` and `optionalRules.weaponMastery` both ON.
- [ ] **Tier purchase 1→2→3:** on a single-classed fighter-type PC with a weapon proficiency already at tier 1 (Specialized) on a melee weapon, click "Advance Mastery." Confirm: the slot cost charged matches this plan's table (tier 2 costs `weaponMasteryTierCost(2, category) - slotsInvested` more slots than were already invested), the badge updates to show tier 2 ("Mastery"), and the weapon's attack roll's situational/proficiency modifier reflects `+2` to-hit (visible in the attack chat card, same place SP7b's armor-vs-weapon-type modifier was verified). Repeat for tier 2→3, confirming `+3` to-hit and that the button disappears once tier 3 is reached (no tier 4).
  - Also spot-check a bow or crossbb proficiency to confirm tier 1's `+0` to-hit (missile weapons get no flat tier-1 bonus, matching existing specialization behavior) but tier 2/3's flat `+2`/`+3` DO apply uniformly (the one place category-dependence changes above tier 1).
- [ ] **Migration correctness:** before this plan's build, use the console to create (or confirm the test world already has) a weapon-proficiency item with `specialized: true` under the OLD schema — if the world was already updated to the new build, instead directly test via a dry-run: set `game.settings.set("adnd2e", "migrationDryRun", true)`, manually reset `game.settings.set("adnd2e", "systemMigrationVersion", "0.2.0")`, reload, and confirm the console logs a "would update item ... masteryTier: 1" line for that proficiency without actually writing it; then flip `migrationDryRun` back to `false`, reset the stored version again, reload, and confirm the item's `masteryTier` is really `1` afterward (check via `actor.items.get(id).system.masteryTier` in console) and the old `specialized` key is gone from `actor.items.get(id).system`.
- [ ] **Setting gate:** with `optionalRules.weaponMastery` toggled OFF (keep `combatAndTacticsEnabled` ON), confirm the "Advance Mastery" button no longer renders on any weapon-proficiency row, even for an otherwise-eligible tier-0 or tier-1 proficiency. Re-enable it and confirm the button returns.
- [ ] **Tier 3 extra-attack visibility:** on a PC/NPC weapon proficiency at Grand Mastery (tier 3), confirm the `+1 attack/round` value is visible somewhere a GM can see it (the tier badge's tooltip localized via `masteryTierLabelKey` at minimum shows "Grand Mastery" — confirm during this check whether that alone counts as sufficient visibility per this plan's scope, or whether the implementer should also have added the raw bonus values, e.g. `+3/+3/+1 atk`, to the tooltip text; if the live check reveals the tier name alone is confusing/insufficient, that is real information — treat it as a finding to fix via a fresh fix round, not a reason to expand scope beyond what Task 5 already built). Confirm no second "Roll Attack" click is auto-triggered or auto-enabled anywhere — this plan does NOT touch the attack-roll button's click count, matching the researched fact that `warriorAttacksPerRound` (`src/core/classes/progression.ts:56`) is not called from any roll-flow code anywhere in this codebase today, so there is no existing multi-attack mechanism for this feature to hook into.
- [ ] Report each of the 4 items PASS/FAIL to the user via `AskUserQuestion`, following this project's established free-text-answer pattern from Plans 7a/7b's own dev-world checks. Distinguish genuine code defects from test-design mistakes or test-setup gaps before concluding a FAIL (this plan's own established pattern — see Plan 7b's "Hit/Miss vs situational modifier" and missing-`damageType` incidents).
- [ ] Fix any real defects found via the SAME fix-round process, never directly.

---

## After this plan lands

Update `README.md`'s Sub-project 7 row to note Plans 7a-7c are done, only 7d (called shots + curated combat maneuvers) remains. Follow this project's established finishing-a-development-branch default for this project: push and create a pull request without asking (confirmed standing instruction, see project memory).
