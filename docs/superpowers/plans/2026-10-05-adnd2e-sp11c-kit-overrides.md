# Sub-project 11 Plan C: Kit Base-Class Overrides — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A kit can switch off its class's spellcasting, change how the class turns undead, list removed (unmodeled) base abilities, and give powers level-scaled uses, all through one pure resolver. Ships a Sample Ghosthunter kit.

**Architecture:** A pure `src/core/kits/overrides.ts` (`normalizeOverrides`, `resolveKitOverrides`, `effectiveTurnerLevel`) is the single read point for overrides; `src/core/kits/powers.ts` gains `usesByLevel`/`powerUses`. The kit item schema gains `overrides` and `usesByLevel`. Casting-off is applied at the one derive choke point (the three `mergeCaster*` functions in `derive.ts`, fed by a per-class `castingDisabled` flag on the snapshot) and cleared from the cached derived fields in `deriveAndCache`; spell drop/learn/memorize/cast are hard-blocked; the Spells tab goes inert. Turning reads the kit rule per class. PC sheet only.

**Tech Stack:** TypeScript, Foundry v14 DataModel fields, Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-adnd2e-sp11c-kit-overrides-design.md` (builds on Plan A `2026-10-04-adnd2e-sp11a-kit-engine-design.md` and Plan B `2026-10-05-adnd2e-sp11b-kit-powers-design.md`).

## Global Constraints

- **Before reporting a task done, every implementer runs `npm run typecheck` (NOT just `tsc -p tsconfig.json`), `npm run lint`, and the task's tests; the controller runs the full CI sequence `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR.** `npm run typecheck` also runs `tsc -p tsconfig.core.json`, a Foundry-free pass over `src/core`, `src/data/derive`, `src/sheets/character/{context,drop-rules,...}.ts`, `tests/core`, `tests/sheets`, `tests/combat`, `tests/magic`. A new test that imports Foundry-coupled glue (e.g. `src/sheets/character/*-actions.ts`) must be added to that config's `exclude` (precedent: `spell-actions.test.ts`, `kit-power-actions.test.ts`).
- 100% statement/line/function coverage gate (90% branches) applies to `src/core/**`, `src/data/derive/**`, `src/data/item/choices.ts`, `src/sheets/character/{context,drop-rules,grouping,xp,context-types}.ts`. Foundry glue (`sheet.ts`, `spell-actions.ts`, `turning-actions.ts`, `kit-power-actions.ts`, `item-row-actions.ts`) is outside the gate but is still unit-tested where a seam exists.
- Content policy: mechanical data only, no rulebook prose. The sample kit is the project's own design.
- Power ids are lowercase slugs (`/^[a-z0-9-]+$/`). `kitPowers` is never written from `prepareDerivedData`.
- Plan C does **not** change how `kitPowers` counters are stored or reset (Plan B).
- Existing worlds' kit items lack `overrides` / `usesByLevel`; every new schema field has a default so no migration is needed. Do not rename or remove existing fields.
- Every new user-visible string goes in `lang/en.json` and is asserted in `tests/lang/en-coverage.test.ts`.
- PC sheet only: new controls/markup live inside the Kits panel behind `@root.pcActions`; Character NPC and Monster NPC sheets must not register or render them.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `src/core/kits/overrides.ts`; modify `src/core/kits/powers.ts`, `src/core/kits/index.ts`; modify `src/core/turning/resolve.ts`.
- Create `tests/core/kits/overrides.test.ts`; modify `tests/core/kits/powers.test.ts`, `tests/core/turning/turning.test.ts`.
- Modify `src/data/item/kit.ts`, `src/data/item/choices.ts`, `src/data/derive/character/kits.ts`, `src/data/derive/character/snapshot.ts`, `src/data/actor/snapshot.ts`, `src/data/derive/character/derive.ts`, `src/data/actor/base-actor.ts`.
- Modify `tests/data/choices.test.ts`, `tests/data/derive/kits.test.ts`, `tests/data/derive/character/derive.test.ts`.
- Modify `src/sheets/character/drop-rules.ts`, `src/sheets/character/spell-actions.ts`, `src/sheets/character/casting-actions.ts`, `src/sheets/character/context.ts`, `src/sheets/character/context-types.ts`, `src/sheets/character/sheet.ts`, `src/sheets/character/turning-actions.ts`, `src/sheets/character/kit-power-actions.ts`.
- Modify `tests/sheets/character/drop-rules.test.ts`, `tests/sheets/character/context.test.ts`, `tests/sheets/character/spell-actions.test.ts`, `tests/sheets/character/kit-power-actions.test.ts`.
- Modify `templates/actor/pc/partials/pc-feature-panels.hbs`, `lang/en.json`, `tests/lang/en-coverage.test.ts`.
- Create `packs/kits/_source/sample-ghosthunter.json`; modify `packs/kits/_source/_MANIFEST.md`, `tests/packs/content.test.ts`, `README.md`.

---

### Task 1: Pure override and scaled-uses rules

**Files:**
- Create: `src/core/kits/overrides.ts`
- Modify: `src/core/kits/powers.ts`, `src/core/kits/index.ts`, `src/core/turning/resolve.ts`
- Test: `tests/core/kits/overrides.test.ts` (new), `tests/core/kits/powers.test.ts`, `tests/core/turning/turning.test.ts`

**Interfaces:**
- Produces (exported from `src/core/kits`):
  - `CASTING_MODES = ["inherit","none"] as const`, `type CastingMode`; `TURNING_MODES = ["inherit","offset","none"] as const`, `type TurningMode`
  - `interface TurningRule { mode: TurningMode; offset: number }`, `INHERIT_TURNING: TurningRule`
  - `interface KitOverrides { casting: CastingMode; turning: TurningRule; removedAbilities: string[] }`, `NO_OVERRIDES: KitOverrides`
  - `interface RawOverrides { casting?: unknown; turning?: { mode?: unknown; offset?: unknown } | null; removedAbilities?: unknown }`
  - `normalizeOverrides(raw: RawOverrides | null | undefined): KitOverrides`
  - `interface ResolvedOverrides { castingDisabled: boolean; turning: TurningRule; removedAbilities: string[] }`
  - `resolveKitOverrides(kits: readonly { chassisId: string; overrides: KitOverrides }[], chassisId: string): ResolvedOverrides`
  - `effectiveTurnerLevel(base: number | null, classLevel: number, rule: TurningRule): number | null`
  - `powers.ts`: `interface PowerBracket { minLevel: number; uses: number }`; `KitPower.usesByLevel: PowerBracket[]`; `RawPower.usesByLevel?: unknown`; `powerUses(power: KitPower, classLevel: number): number`; `powerRemaining(power, used, classLevel = 1)`, `canUsePower(power, used, classLevel = 1)`, `spendPower(power, used, classLevel = 1)`; `PowerRow.locked: boolean`; `buildPowerRows(kitId, powers, usage, classLevel = 1)`; `PowerUseCardInput.uses?: number`.
- Produces (`src/core/turning`): `turnerLevel(chassisId, level, rule?: TurningRule)`, `turnerLevelFor(classes: readonly { chassisId: string; level: number; turning?: TurningRule }[])`.

- [ ] **Step 1: Write the failing tests.**

Create `tests/core/kits/overrides.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CASTING_MODES,
  INHERIT_TURNING,
  NO_OVERRIDES,
  TURNING_MODES,
  effectiveTurnerLevel,
  normalizeOverrides,
  resolveKitOverrides,
  type KitOverrides,
} from "../../../src/core/kits";

describe("override constants", () => {
  it("lists the modes and the defaults", () => {
    expect([...CASTING_MODES]).toEqual(["inherit", "none"]);
    expect([...TURNING_MODES]).toEqual(["inherit", "offset", "none"]);
    expect(INHERIT_TURNING).toEqual({ mode: "inherit", offset: 0 });
    expect(NO_OVERRIDES).toEqual({ casting: "inherit", turning: { mode: "inherit", offset: 0 }, removedAbilities: [] });
  });
});

describe("normalizeOverrides", () => {
  it("returns the defaults for missing input", () => {
    expect(normalizeOverrides(undefined)).toEqual(NO_OVERRIDES);
    expect(normalizeOverrides(null)).toEqual(NO_OVERRIDES);
    expect(normalizeOverrides({})).toEqual(NO_OVERRIDES);
  });
  it("keeps valid values", () => {
    expect(
      normalizeOverrides({ casting: "none", turning: { mode: "offset", offset: -1 }, removedAbilities: ["Laying on hands", "Disease immunity"] }),
    ).toEqual({ casting: "none", turning: { mode: "offset", offset: -1 }, removedAbilities: ["Laying on hands", "Disease immunity"] });
    expect(normalizeOverrides({ turning: { mode: "none", offset: 3 } }).turning).toEqual({ mode: "none", offset: 0 });
  });
  it("falls back to defaults for malformed values and drops bad ability names", () => {
    const out = normalizeOverrides({
      casting: "banana",
      turning: { mode: "sideways", offset: 2.5 },
      removedAbilities: ["ok", "", 7, null],
    });
    expect(out.casting).toBe("inherit");
    expect(out.turning).toEqual({ mode: "inherit", offset: 0 });
    expect(out.removedAbilities).toEqual(["ok"]);
    expect(normalizeOverrides({ turning: { mode: "offset", offset: "x" } }).turning).toEqual({ mode: "offset", offset: 0 });
    expect(normalizeOverrides({ removedAbilities: "nope" }).removedAbilities).toEqual([]);
  });
});

describe("resolveKitOverrides", () => {
  const ghost: KitOverrides = { casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: ["Laying on hands"] };
  it("returns the defaults when no kit modifies the chassis", () => {
    expect(resolveKitOverrides([], "paladin")).toEqual({ castingDisabled: false, turning: INHERIT_TURNING, removedAbilities: [] });
    expect(resolveKitOverrides([{ chassisId: "fighter", overrides: ghost }], "paladin").castingDisabled).toBe(false);
  });
  it("reads the kit for the chassis", () => {
    expect(resolveKitOverrides([{ chassisId: "paladin", overrides: ghost }], "paladin")).toEqual({
      castingDisabled: true,
      turning: { mode: "offset", offset: 0 },
      removedAbilities: ["Laying on hands"],
    });
    expect(resolveKitOverrides([{ chassisId: "paladin", overrides: NO_OVERRIDES }], "paladin").castingDisabled).toBe(false);
  });
});

describe("effectiveTurnerLevel", () => {
  it("inherit keeps the base level (including null)", () => {
    expect(effectiveTurnerLevel(3, 5, INHERIT_TURNING)).toBe(3);
    expect(effectiveTurnerLevel(null, 5, INHERIT_TURNING)).toBeNull();
  });
  it("none can never turn", () => {
    expect(effectiveTurnerLevel(7, 7, { mode: "none", offset: 0 })).toBeNull();
  });
  it("offset is class level plus the offset, null below 1, and lets a non-turner turn", () => {
    expect(effectiveTurnerLevel(3, 5, { mode: "offset", offset: 0 })).toBe(5);
    expect(effectiveTurnerLevel(null, 4, { mode: "offset", offset: 0 })).toBe(4);
    expect(effectiveTurnerLevel(3, 5, { mode: "offset", offset: -4 })).toBe(1);
    expect(effectiveTurnerLevel(3, 5, { mode: "offset", offset: -5 })).toBeNull();
  });
});
```

Append to `tests/core/turning/turning.test.ts` (inside a new `describe`; the file already imports `turnerLevel`/`turnerLevelFor`):

```ts
describe("turnerLevel with a kit turning rule (SP11 Plan C)", () => {
  it("offset 0 turns as a cleric of the same level (Ghosthunter)", () => {
    expect(turnerLevel("paladin", 5, { mode: "offset", offset: 0 })).toBe(5);
    expect(turnerLevel("paladin", 5)).toBe(3);
  });
  it("none and a too-negative offset cannot turn; a non-turner with an offset can", () => {
    expect(turnerLevel("cleric", 7, { mode: "none", offset: 0 })).toBeNull();
    expect(turnerLevel("paladin", 3, { mode: "offset", offset: -3 })).toBeNull();
    expect(turnerLevel("fighter", 4, { mode: "offset", offset: 0 })).toBe(4);
  });
  it("turnerLevelFor honours each class's own rule", () => {
    expect(turnerLevelFor([{ chassisId: "paladin", level: 6, turning: { mode: "offset", offset: 0 } }])).toBe(6);
    expect(turnerLevelFor([{ chassisId: "paladin", level: 6 }])).toBe(4);
  });
});
```

Append to `tests/core/kits/powers.test.ts` (extend the existing import list with `powerUses`; `KitPower` literals elsewhere in the file need `usesByLevel: []` added — add it to the four fixtures `daily`, `weekly`, `fight`, `free` and to the expected objects in the existing `normalizePowers`/`buildPowerRows`/card-context tests):

```ts
const dispel: KitPower = {
  id: "dispel-evil", name: "Dispel Evil", uses: 0, per: "day", scope: "", params: [],
  usesByLevel: [{ minLevel: 1, uses: 0 }, { minLevel: 5, uses: 1 }, { minLevel: 10, uses: 2 }, { minLevel: 15, uses: 3 }, { minLevel: 20, uses: 4 }],
};

describe("level-scaled uses (SP11 Plan C)", () => {
  it("powerUses picks the highest bracket at or below the level, 0 below the first, and the flat uses with no table", () => {
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20, 25].map((l) => powerUses(dispel, l))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(powerUses({ ...dispel, usesByLevel: [{ minLevel: 5, uses: 1 }] }, 3)).toBe(0);
    expect(powerUses(daily, 12)).toBe(2);
  });
  it("remaining / canUse / spend follow the level; a scaled power at 0 uses is locked, not at-will", () => {
    expect(powerRemaining(dispel, 0, 4)).toBe(0);
    expect(canUsePower(dispel, 0, 4)).toBe(false);
    expect(powerRemaining(dispel, 0, 5)).toBe(1);
    expect(canUsePower(dispel, 0, 5)).toBe(true);
    expect(spendPower(dispel, 0, 5)).toBe(1);
    expect(spendPower(dispel, 1, 5)).toBe(1);
    expect(spendPower(dispel, 0, 4)).toBe(0);
    expect(powerRemaining(dispel, 3, 10)).toBe(0);
  });
  it("buildPowerRows resolves uses at the class level and flags a locked row", () => {
    const [row4] = buildPowerRows("k1", [dispel], {}, 4);
    expect(row4).toMatchObject({ uses: 0, remaining: 0, canUse: false, locked: true, atWill: false, per: "day" });
    const [row10] = buildPowerRows("k1", [dispel], { "k1:dispel-evil": { used: 1 } }, 10);
    expect(row10).toMatchObject({ uses: 2, used: 1, remaining: 1, canUse: true, locked: false, canReset: true });
    const [flat] = buildPowerRows("k1", [daily], {});
    expect(flat).toMatchObject({ uses: 2, locked: false });
  });
  it("normalizePowers keeps a scaled power's per, sorts brackets, drops bad ones, and rejects scaled at-will", () => {
    const [p] = normalizePowers([
      {
        id: "dispel-evil", name: "Dispel Evil", uses: 9, per: "day",
        usesByLevel: [{ minLevel: 5, uses: 1 }, { minLevel: 1, uses: 0 }, { minLevel: 5, uses: 9 }, { minLevel: 0, uses: 1 }, { minLevel: 2.5, uses: 1 }, { minLevel: 3, uses: -1 }, null, { minLevel: "x", uses: 1 }],
      },
    ]);
    expect(p).toMatchObject({ id: "dispel-evil", per: "day", uses: 0 });
    expect(p!.usesByLevel).toEqual([{ minLevel: 1, uses: 0 }, { minLevel: 5, uses: 1 }]);
    expect(normalizePowers([{ id: "x", name: "X", per: "at-will", usesByLevel: [{ minLevel: 1, uses: 1 }] }])).toEqual([]);
    expect(normalizePowers([{ id: "y", name: "Y", uses: 2, per: "day", usesByLevel: "nope" }])[0]!.usesByLevel).toEqual([]);
  });
  it("the use card shows the resolved uses when given", () => {
    expect(buildPowerUseCardContext({ actorName: "T", actorImg: "i", power: dispel, remaining: 0, uses: 1 }).uses).toBe(1);
    expect(buildPowerUseCardContext({ actorName: "T", actorImg: "i", power: daily, remaining: 1 }).uses).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/kits tests/core/turning`
Expected: FAIL (missing exports; `usesByLevel` undefined).

- [ ] **Step 3: Implement.**

Create `src/core/kits/overrides.ts`:

```ts
/* SP11 Plan C: kit overrides of base-class abilities. Pure; Foundry-free.
 * `resolveKitOverrides` is the ONE read point: consumers never read a kit's
 * `overrides` directly, so a later override (e.g. a kit that grants a spell
 * progression) plugs in here without touching every consumer again. */

export const CASTING_MODES = ["inherit", "none"] as const;
export type CastingMode = (typeof CASTING_MODES)[number];

export const TURNING_MODES = ["inherit", "offset", "none"] as const;
export type TurningMode = (typeof TURNING_MODES)[number];

export interface TurningRule {
  mode: TurningMode;
  /** only meaningful for `offset`: turning level = class level + offset (0 = full class level) */
  offset: number;
}

export interface KitOverrides {
  casting: CastingMode;
  turning: TurningRule;
  /** free-text names of base-class abilities the kit removes; display only (the engine models none of them) */
  removedAbilities: string[];
}

export const INHERIT_TURNING: TurningRule = { mode: "inherit", offset: 0 };
export const NO_OVERRIDES: KitOverrides = { casting: "inherit", turning: INHERIT_TURNING, removedAbilities: [] };

export interface RawOverrides {
  casting?: unknown;
  turning?: { mode?: unknown; offset?: unknown } | null;
  removedAbilities?: unknown;
}

/** Lenient read, like a malformed trait effect: anything invalid falls back to "no override". */
export function normalizeOverrides(raw: RawOverrides | null | undefined): KitOverrides {
  const turning = raw?.turning ?? undefined;
  const mode = (TURNING_MODES as readonly unknown[]).includes(turning?.mode) ? (turning?.mode as TurningMode) : "inherit";
  const rawOffset = turning?.offset;
  const offset = typeof rawOffset === "number" && Number.isInteger(rawOffset) ? rawOffset : 0;
  const removedRaw = raw?.removedAbilities;
  const removed = Array.isArray(removedRaw) ? (removedRaw as unknown[]) : [];
  return {
    casting: raw?.casting === "none" ? "none" : "inherit",
    turning: { mode, offset: mode === "offset" ? offset : 0 },
    removedAbilities: removed.filter((n): n is string => typeof n === "string" && n !== ""),
  };
}

export interface ResolvedOverrides {
  castingDisabled: boolean;
  turning: TurningRule;
  removedAbilities: string[];
}

/** The overrides of the kit modifying this chassis (Plan A allows one kit per class), or the defaults. */
export function resolveKitOverrides(
  kits: readonly { chassisId: string; overrides: KitOverrides }[],
  chassisId: string,
): ResolvedOverrides {
  const kit = kits.find((k) => k.chassisId === chassisId);
  if (!kit) return { castingDisabled: false, turning: INHERIT_TURNING, removedAbilities: [] };
  return {
    castingDisabled: kit.overrides.casting === "none",
    turning: kit.overrides.turning,
    removedAbilities: kit.overrides.removedAbilities,
  };
}

/** The turning level after a kit rule. `base` is the class's normal turning level (null = cannot turn). */
export function effectiveTurnerLevel(base: number | null, classLevel: number, rule: TurningRule): number | null {
  if (rule.mode === "none") return null;
  if (rule.mode === "offset") {
    const level = classLevel + rule.offset;
    return level >= 1 ? level : null;
  }
  return base;
}
```

`src/core/kits/index.ts` — add `export * from "./overrides";`.

`src/core/turning/resolve.ts` — change the first import line area and the two functions:

```ts
import { TURN_TABLE, levelColumn, type TurnRowId } from "./table";
import { INHERIT_TURNING, effectiveTurnerLevel, type TurningRule } from "../kits/overrides";
```

```ts
/** A cleric turns at class level, a paladin two levels lower (PHB p. 103); no other class turns. A kit's turning rule (SP11 Plan C) may change that. */
export function turnerLevel(chassisId: string, level: number, rule: TurningRule = INHERIT_TURNING): number | null {
  const effective = chassisId === "cleric" ? level : chassisId === "paladin" ? level - 2 : null;
  const base = effective !== null && effective >= 1 ? effective : null;
  return effectiveTurnerLevel(base, level, rule);
}

/** The best turning level across an actor's classes, or null when none can turn. */
export function turnerLevelFor(
  classes: readonly { chassisId: string; level: number; turning?: TurningRule }[],
): number | null {
  let best: number | null = null;
  for (const c of classes) {
    const level = turnerLevel(c.chassisId, c.level, c.turning);
    if (level !== null && (best === null || level > best)) best = level;
  }
  return best;
}
```

`src/core/kits/powers.ts` edits:

1. After `PowerParam`, add `export interface PowerBracket { minLevel: number; uses: number }`; add `usesByLevel: PowerBracket[];` to `KitPower` (after `params`); add `usesByLevel?: unknown;` to `RawPower`.
2. Add above `normalizePowers`:

```ts
function normalizeBrackets(raw: unknown): PowerBracket[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: PowerBracket[] = [];
  for (const b of raw as { minLevel?: unknown; uses?: unknown }[]) {
    if (!b || typeof b.minLevel !== "number" || !Number.isInteger(b.minLevel) || b.minLevel < 1) continue;
    if (typeof b.uses !== "number" || !Number.isInteger(b.uses) || b.uses < 0) continue;
    if (seen.has(b.minLevel)) continue;
    seen.add(b.minLevel);
    out.push({ minLevel: b.minLevel, uses: b.uses });
  }
  return out.sort((a, b) => a.minLevel - b.minLevel);
}
```

3. Replace the body of `normalizePowers`' loop after the name/per checks. The loop becomes:

```ts
  for (const p of raw) {
    if (typeof p.id !== "string" || !SLUG.test(p.id) || seen.has(p.id)) continue;
    if (typeof p.name !== "string" || p.name === "") continue;
    if (!(POWER_FREQUENCIES as readonly unknown[]).includes(p.per)) continue;
    const usesByLevel = normalizeBrackets(p.usesByLevel);
    if (usesByLevel.length > 0 && p.per === "at-will") continue;
    seen.add(p.id);
    const scaled = usesByLevel.length > 0;
    const finite = typeof p.uses === "number" && Number.isInteger(p.uses) && p.uses > 0;
    const atWill = !scaled && (!finite || p.per === "at-will");
    out.push({
      id: p.id,
      name: p.name,
      uses: atWill || scaled ? 0 : (p.uses as number),
      per: atWill ? "at-will" : (p.per as PowerFrequency),
      scope: typeof p.scope === "string" ? p.scope : "",
      params: normalizeParams(p.params),
      usesByLevel,
    });
  }
```

4. Replace `powerRemaining`, `canUsePower`, `spendPower` and add `powerUses`:

```ts
/** The uses available at this class level: the highest `usesByLevel` bracket at or below it (0 below the first), or the flat `uses` with no table. */
export function powerUses(power: KitPower, classLevel: number): number {
  if (power.usesByLevel.length === 0) return power.uses;
  let uses = 0;
  for (const b of power.usesByLevel) if (b.minLevel <= classLevel) uses = b.uses;
  return uses;
}

export function powerRemaining(power: KitPower, used: number, classLevel = 1): number | null {
  return power.per === "at-will" ? null : Math.max(0, powerUses(power, classLevel) - used);
}

export function canUsePower(power: KitPower, used: number, classLevel = 1): boolean {
  const remaining = powerRemaining(power, used, classLevel);
  return remaining === null || remaining > 0;
}

/** The new `used` count after one use; at-will powers are never counted. */
export function spendPower(power: KitPower, used: number, classLevel = 1): number {
  return power.per === "at-will" || !canUsePower(power, used, classLevel) ? used : used + 1;
}
```

(The brackets are sorted ascending by `normalizeBrackets`, so the loop's last match is the highest bracket at or below the level.)

5. `PowerRow` gets `locked: boolean;` and `buildPowerRows` becomes:

```ts
export function buildPowerRows(kitId: string, powers: readonly KitPower[], usage: PowerUsage, classLevel = 1): PowerRow[] {
  return powers.map((p) => {
    const used = usedCount(usage, kitId, p.id);
    const uses = powerUses(p, classLevel);
    return {
      id: p.id,
      name: p.name,
      per: p.per,
      atWill: p.per === "at-will",
      uses,
      used,
      remaining: powerRemaining(p, used, classLevel),
      scope: p.scope,
      params: p.params,
      canUse: canUsePower(p, used, classLevel),
      canReset: p.per !== "at-will" && used > 0,
      locked: p.per !== "at-will" && uses === 0,
    };
  });
}
```

6. `PowerUseCardInput` gets `/** resolved uses at the class level; defaults to the power's flat uses */ uses?: number;` and `buildPowerUseCardContext` sets `uses: input.uses ?? power.uses`.

- [ ] **Step 4: Run to verify they pass, plus typecheck**

Run: `npx vitest run tests/core && npm run typecheck`
Expected: PASS. If existing `powers.test.ts` assertions fail only because the `KitPower`/row literals lack `usesByLevel: []` / `locked: false`, update those literals (that is the expected fallout, not a design problem).

- [ ] **Step 5: Commit**

```bash
git add src/core tests/core
git commit -m "feat(kits): pure kit overrides, turning rule, level-scaled power uses

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema fields and kit entries

**Files:**
- Modify: `src/data/item/kit.ts`, `src/data/item/choices.ts`, `src/data/derive/character/kits.ts`
- Test: `tests/data/choices.test.ts`, `tests/data/derive/kits.test.ts`

**Interfaces:**
- Consumes: `CASTING_MODES`, `TURNING_MODES`, `normalizeOverrides`, `KitOverrides`, `RawOverrides` (Task 1).
- Produces: `KIT_CASTING_MODES`, `KIT_TURNING_MODES` (choices); `KitEntry.overrides: KitOverrides`; schema `system.overrides` and per-power `usesByLevel` on kit items.

- [ ] **Step 1: Write the failing tests.**

In `tests/data/choices.test.ts` add `KIT_CASTING_MODES, KIT_TURNING_MODES` to the choices import and append:

```ts
describe("kit override choices (SP11 Plan C)", () => {
  it("match the pure modes", () => {
    expect([...KIT_CASTING_MODES]).toEqual(["inherit", "none"]);
    expect([...KIT_TURNING_MODES]).toEqual(["inherit", "offset", "none"]);
  });
});
```

In `tests/data/derive/kits.test.ts`: extend the default `kitItem` `system` with `overrides: { casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: ["Laying on hands", ""] },` and the first power fixture with `usesByLevel: [{ minLevel: 5, uses: 1 }, { minLevel: 1, uses: 0 }]` (update that test's expected power accordingly: `uses: 0`, `usesByLevel` sorted `[{minLevel:1,uses:0},{minLevel:5,uses:1}]`; since a scaled power is not at-will its `per` stays `"day"`). Add to the first test:

```ts
    expect(k!.overrides).toEqual({ casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: ["Laying on hands"] });
```

and a new test in the same `describe`:

```ts
  it("a kit item with no overrides field reads as no overrides", () => {
    const item = kitItem();
    delete (item.system as Record<string, unknown>).overrides;
    expect(toKitEntries([item])[0]!.overrides).toEqual({ casting: "inherit", turning: { mode: "inherit", offset: 0 }, removedAbilities: [] });
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/choices.test.ts tests/data/derive/kits.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/data/item/choices.ts` — beside the existing `KIT_POWER_FREQUENCIES` re-export add:

```ts
export { CASTING_MODES as KIT_CASTING_MODES, TURNING_MODES as KIT_TURNING_MODES } from "../../core/kits";
```

`src/data/item/kit.ts` — add `KIT_CASTING_MODES, KIT_TURNING_MODES` to the `./choices` import. In the `powers` element `SchemaField`, add after `params: new ArrayField(...)`:

```ts
          /** SP11 Plan C: level brackets for the uses per `per`; empty = the flat `uses`. A scaled power is never at-will. */
          usesByLevel: new ArrayField(
            new SchemaField({
              minLevel: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
              uses: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            }),
            { required: true, initial: [] },
          ),
```

and after the `powers` field add:

```ts
      /** SP11 Plan C: overrides of the base class. `toKitEntries` reads this leniently via `normalizeOverrides`. */
      overrides: new SchemaField({
        casting: new StringField({ required: true, blank: false, initial: "inherit", choices: KIT_CASTING_MODES }),
        turning: new SchemaField({
          mode: new StringField({ required: true, blank: false, initial: "inherit", choices: KIT_TURNING_MODES }),
          offset: new NumberField({ required: true, integer: true, initial: 0 }),
        }),
        removedAbilities: names(),
      }),
```

Extend the class doc comment with `Plan C adds \`overrides\` and per-power \`usesByLevel\`.`

`src/data/derive/character/kits.ts` — import `normalizeOverrides, type KitOverrides, type RawOverrides` from `../../../core/kits`; add `overrides: KitOverrides;` to `KitEntry`, `overrides?: RawOverrides;` to `KitSystem`, and `overrides: normalizeOverrides(s.overrides),` to the pushed entry (after `powers`).

- [ ] **Step 4: Run to verify they pass, plus typecheck and the data tests**

Run: `npx vitest run tests/data && npm run typecheck`
Expected: PASS. Fix any `KitEntry` literal elsewhere that now lacks `overrides` (tsc will list them).

- [ ] **Step 5: Commit**

```bash
git add src/data tests/data
git commit -m "feat(kits): kit overrides and usesByLevel schema, kit-entry plumbing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Casting off in the derive pipeline

**Files:**
- Modify: `src/data/derive/character/kits.ts`, `src/data/derive/character/snapshot.ts`, `src/data/actor/snapshot.ts`, `src/data/derive/character/derive.ts`, `src/data/actor/base-actor.ts`
- Test: `tests/data/derive/kits.test.ts`, `tests/data/derive/character/derive.test.ts`

**Interfaces:**
- Consumes: `resolveKitOverrides` (Task 1), `KitEntry.overrides` (Task 2).
- Produces:
  - `casterTypesDisabled(classes: readonly { chassisId: string; castingDisabled?: boolean }[]): { wizard: boolean; priest: boolean }` (in `src/data/derive/character/kits.ts`; a type is off when at least one class has that `casterType` and every such class has `castingDisabled`).
  - `ClassEntry.castingDisabled?: boolean` (snapshot); `CharacterDerived.castingDisabled: { wizard: boolean; priest: boolean }`.

- [ ] **Step 1: Write the failing tests.**

In `tests/data/derive/kits.test.ts` (add `casterTypesDisabled` to the import from `../../../src/data/derive/character/kits`):

```ts
describe("casterTypesDisabled (SP11 Plan C)", () => {
  it("a type is off only when every class of that caster type has casting disabled", () => {
    expect(casterTypesDisabled([{ chassisId: "paladin", castingDisabled: true }])).toEqual({ wizard: false, priest: true });
    expect(casterTypesDisabled([{ chassisId: "paladin" }])).toEqual({ wizard: false, priest: false });
    expect(casterTypesDisabled([{ chassisId: "mage", castingDisabled: true }, { chassisId: "cleric" }])).toEqual({ wizard: true, priest: false });
    expect(
      casterTypesDisabled([{ chassisId: "cleric", castingDisabled: true }, { chassisId: "paladin" }]),
    ).toEqual({ wizard: false, priest: false });
  });
  it("non-casters and no classes never disable anything", () => {
    expect(casterTypesDisabled([{ chassisId: "fighter", castingDisabled: true }])).toEqual({ wizard: false, priest: false });
    expect(casterTypesDisabled([])).toEqual({ wizard: false, priest: false });
  });
});
```

In `tests/data/derive/character/derive.test.ts` add (reusing the file's `base`, `fighterClass`, `DEFAULT_OPTIONAL_RULES`; a level-10 Paladin needs 600000 XP, but the snapshot's own `level` field is what `deriveClassLevels` reads, so set `level: 10`):

```ts
describe("deriveCharacter — kit casting override (SP11 Plan C)", () => {
  const paladin = { ...fighterClass, chassisId: "paladin" as const, level: 10, xp: 600000 };
  it("a level-10 Paladin has priest slots by default", () => {
    const d = deriveCharacter({ ...base, classes: [paladin] }, DEFAULT_OPTIONAL_RULES);
    expect(d.spellSlots.priest).toBeDefined();
    expect(d.castingDisabled).toEqual({ wizard: false, priest: false });
  });
  it("with the kit's casting disabled the Paladin derives no slots, spell points or channelling", () => {
    const rules = { ...DEFAULT_OPTIONAL_RULES };
    const d = deriveCharacter({ ...base, classes: [{ ...paladin, castingDisabled: true }] }, rules);
    expect(d.spellSlots).toEqual({});
    expect(d.spellPoints).toEqual({});
    expect(d.channelling).toEqual({});
    expect(d.castingDisabled).toEqual({ wizard: false, priest: true });
  });
});
```

(If the file's rule-toggle shape for spell points / channellers differs, also assert the same with those rules switched on, using the existing tests in this file as the model for turning them on.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/derive`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/data/derive/character/kits.ts` — add imports `getChassis` from `"../../../core/classes/chassis"` and append:

```ts
/** SP11 Plan C: which caster types a kit has switched off. A type is off when the actor has at least one class of that caster type and every such class has `castingDisabled`. */
export function casterTypesDisabled(
  classes: readonly { chassisId: string; castingDisabled?: boolean }[],
): { wizard: boolean; priest: boolean } {
  const result = { wizard: false, priest: false };
  for (const type of ["wizard", "priest"] as const) {
    const ofType = classes.filter((c) => getChassis(c.chassisId as ClassId).casterType === type);
    result[type] = ofType.length > 0 && ofType.every((c) => c.castingDisabled === true);
  }
  return result;
}
```

(import `type ClassId` from `"../../../core/types"`).

`src/data/derive/character/snapshot.ts` — in `ClassEntry` add:

```ts
  /** SP11 Plan C: the owning kit switches this class's spellcasting off (absent = false) */
  castingDisabled?: boolean;
```

`src/data/actor/snapshot.ts` — import `resolveKitOverrides` from `"../../core/kits"` (alongside `kitXpPercentFor`) and in the `classes` map add after `xpModifierPercent`:

```ts
        castingDisabled: resolveKitOverrides(kitEntries, s.chassisId).castingDisabled,
```

`src/data/derive/character/derive.ts` — import `casterTypesDisabled` from `"./kits"`; add to `CharacterDerived`:

```ts
  /** SP11 Plan C: caster types a kit has switched off (deriveAndCache clears their cached slots / spell points / channelling max) */
  castingDisabled: { wizard: boolean; priest: boolean };
```

Add a helper above `mergeCasterSlots`:

```ts
/** SP11 Plan C: drops classes whose kit switched casting off — the single choke point for slots, spell points and channelling. */
function enabledCasters(casters: readonly ClassMember[], snapshot: ActorSnapshot): ClassMember[] {
  return casters.filter((m) => !snapshot.classes.some((c) => c.chassisId === m.chassisId && c.castingDisabled));
}
```

and change the `for (const c of casters)` loop in each of `mergeCasterSlots`, `mergeCasterSpellPoints`, `mergeCasterChannelling` to `for (const c of enabledCasters(casters, snapshot))`. In both return objects of `deriveCharacterBase` (single and multi/dual) add `castingDisabled: casterTypesDisabled(snapshot.classes),` (after `channelling`).

`src/data/actor/base-actor.ts` — in `deriveAndCache`, after the existing channelling writes, add:

```ts
  // SP11 Plan C: a kit that switches casting off must also CLEAR the cached derived records (the writes above only run when something was derived, so stale values would otherwise linger).
  for (const key of ["wizard", "priest"] as const) {
    if (!derived.castingDisabled[key]) continue;
    sys.spellcasting[key].slots = {};
    sys.spellcasting[key].spellPoints = {};
    sys.spellcasting[key].channelling.max = null;
  }
```

and widen `DerivedWriteSurface.spellcasting` to `{ wizard: { slots: unknown; spellPoints: unknown; channelling: { max: unknown } }; priest: { slots: unknown; spellPoints: unknown; channelling: { max: unknown } } }` (it already has this shape; just confirm assignment of `{}` and `null` typechecks).

- [ ] **Step 4: Run to verify they pass, plus the full CI-style typecheck**

Run: `npx vitest run tests/data && npm run typecheck`
Expected: PASS. Any existing test that asserts the exact `deriveCharacter` result shape (`toEqual` on the whole object) needs `castingDisabled: { wizard: false, priest: false }` added; update those.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(kits): kit casting override at the derive choke point, cleared from cached spell data

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Casting off — drops, actions and the Spells tab

**Files:**
- Modify: `src/sheets/character/drop-rules.ts`, `src/sheets/character/spell-actions.ts`, `src/sheets/character/casting-actions.ts`, `src/sheets/character/context.ts`, `src/sheets/character/context-types.ts`, `src/sheets/character/sheet.ts`, `lang/en.json`
- Test: `tests/sheets/character/drop-rules.test.ts`, `tests/sheets/character/context.test.ts`, `tests/sheets/character/spell-actions.test.ts`, `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `casterTypesDisabled` (Task 3), `resolveKitOverrides`, `activeKitEntries`.
- Produces:
  - `DropCheckInput.kitDisablesCasting?: boolean` — a `spell` drop with it true returns `{ ok: false, reason: "ADND2E.sheet.drop.kitCastingDisabled" }`.
  - `CharacterSheetInput.castingDisabled?: { wizard: boolean; priest: boolean }` (context-types).
  - `castingBlockedByKit(actor: SpellcasterActor, key: "wizard" | "priest"): boolean` exported from `spell-actions.ts`.
  - lang keys `ADND2E.sheet.drop.kitCastingDisabled`, `ADND2E.sheet.spells.kitCastingDisabledWarning`.

- [ ] **Step 1: Write the failing tests.**

`tests/sheets/character/drop-rules.test.ts` — add (reuse the file's existing minimal input shape; the required fields are `dropType`, `hasRace`, `existingChassisIds`):

```ts
  it("refuses a spell drop when the owning kit disables that caster type's casting (SP11 Plan C)", () => {
    const base = { dropType: "spell", hasRace: false, existingChassisIds: ["paladin"] };
    expect(validateItemDrop({ ...base, kitDisablesCasting: true })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitCastingDisabled" });
    expect(validateItemDrop({ ...base, kitDisablesCasting: false })).toEqual({ ok: true });
    expect(validateItemDrop(base)).toEqual({ ok: true });
  });
```

`tests/lang/en-coverage.test.ts` — append a block asserting these keys resolve (same shape as the Plan B block): `ADND2E.sheet.drop.kitCastingDisabled`, `ADND2E.sheet.spells.kitCastingDisabledWarning`.

`tests/sheets/character/spell-actions.test.ts` — add a test using the file's existing actor fixture helper (read the top of the file: it builds a `SpellcasterActor`; the new test needs `items` that include a `class` item for `paladin` and a `kit` item with `overrides.casting: "none"` for the `paladin` chassis, in the shape `activeKitEntries` reads — see `tests/data/derive/kits.test.ts` `kitItem()` for that shape). Assert `memorizeSpell`, `castSpell` and `learnSpell` each make no `actor.update` call and warn with `ADND2E.sheet.spells.kitCastingDisabledWarning` for a priest spell, and that the same calls work (existing behavior) with the kit's casting `inherit`. Also assert `castingBlockedByKit(actor, "priest")` is true and `castingBlockedByKit(actor, "wizard")` is false.

`tests/sheets/character/context.test.ts` — add two tests using the file's existing `input` builder (copy how a nearby test passes a priest class and `spellItems`): with `castingDisabled: { wizard: false, priest: true }` in the input, every `known[].items[]` row with `casterClass: "priest"` has `canMemorize === false`, `canCast === false` and `canLearn === false`; `priestSlots` is `[]`/null-equivalent (falsy in the template, i.e. empty); `orisons` is `[]`; `priestPoolOn` is `false`; and with `wizard: true`, `freeMagicks[*].canCast` is `false` and wizard rows are inert. With `castingDisabled` absent the output is unchanged (guards a regression).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sheets tests/lang`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/sheets/character/drop-rules.ts` — add to `DropCheckInput`:

```ts
  /** spell drops: true when the owning kit switches that caster type's casting off (SP11 Plan C) */
  kitDisablesCasting?: boolean;
```

and in `validateItemDrop`, before the final `return { ok: true }`:

```ts
  if (input.dropType === "spell" && input.kitDisablesCasting) {
    return { ok: false, reason: "ADND2E.sheet.drop.kitCastingDisabled" };
  }
```

`lang/en.json` — add `"kitCastingDisabled": "That class's kit disables spellcasting."` inside `ADND2E.sheet.drop` and `"kitCastingDisabledWarning": "Your kit disables this class's spellcasting."` inside `ADND2E.sheet.spells`.

`src/sheets/character/spell-actions.ts` — import `activeKitEntries` from `"../../data/derive/character/kits"`, `casterTypesDisabled` likewise, and `resolveKitOverrides` from `"../../core/kits"`. Add (near `casterKey`):

```ts
/** SP11 Plan C: true when a kit has switched off this caster type's casting. Defensive re-check behind the hidden UI, same role as the other guards in this file. */
export function castingBlockedByKit(actor: SpellcasterActor, key: "wizard" | "priest"): boolean {
  const items = [...actor.items] as unknown as { id?: string; name?: string; type: string; system: unknown }[];
  const kits = activeKitEntries(items);
  const classes = items
    .filter((i) => i.type === "class")
    .map((i) => {
      const chassisId = (i.system as { chassisId: string }).chassisId;
      return { chassisId, castingDisabled: resolveKitOverrides(kits, chassisId).castingDisabled };
    });
  return casterTypesDisabled(classes)[key];
}

function warnKitCasting(): void {
  ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.kitCastingDisabledWarning"));
}
```

Add at the top of `memorizeSpell`, `castSpell` and `learnSpell`, after the `const spell = actor.items.get(spellItemId);` line (use `casterKey(spell)`; guard `spell` is defined first):

```ts
  if (spell && castingBlockedByKit(actor, casterKey(spell))) {
    warnKitCasting();
    return;
  }
```

For `memorizeFreeMagick`, `castFreeMagick` (wizard) and `memorizeFreeTheurgy`, `castFreeTheurgy` (priest), add as the first statement `if (castingBlockedByKit(actor, "wizard")) { warnKitCasting(); return; }` (priest for the two theurgy functions). Read each signature first; the actor parameter is `actor` in each.

`src/sheets/character/casting-actions.ts` — in `castOrBegin`, before any state is read or written, add the same guard using `castingBlockedByKit` and `casterKey` on the resolved spell (import both from `./spell-actions`; if importing creates a cycle, move `castingBlockedByKit`/`warnKitCasting` into a new `src/sheets/character/kit-casting.ts` and import from there in both files — keep the exported name and tests' import pointing at the file that exports it).

`src/sheets/character/context-types.ts` — add to `CharacterSheetInput`:

```ts
  /** SP11 Plan C: caster types a kit switched off (absent = none) */
  castingDisabled?: { wizard: boolean; priest: boolean };
```

`src/sheets/character/context.ts` — in `buildSpells`, at the top:

```ts
  const off = input.castingDisabled ?? { wizard: false, priest: false };
```

then:
- `const priestPoolOn = !off.priest && spellPointsOn && isPriestPoolProgression(...)` (add the `!off.priest &&` guard to the existing expression);
- after `items = casting ? ... : items;` add `items = items.map((r) => (off[r.casterClass === "priest" ? "priest" : "wizard"] ? { ...r, canMemorize: false, canCast: false, canLearn: false } : r));` (confirm the three flag names on `SpellItemView` rows from `context-types.ts`; use the real names);
- `freeMagicks`: `canCast: !off.wizard && !casting && (...)`;
- in the returned object, `priestSlots: priestPoolOn || off.priest ? [] : toSlotRows(sc.priest.slots)` and `wizardSlots: off.wizard ? [] : toSlotRows(sc.wizard.slots)`.

`src/sheets/character/sheet.ts` — in `#buildInput` add `castingDisabled` computed from the actor's items (import `casterTypesDisabled`, `resolveKitOverrides` already available via `activeKitEntries`; `kitEntries` and the class items are in scope there):

```ts
      castingDisabled: casterTypesDisabled(
        classItems.map((c) => ({ chassisId: c.chassisId, castingDisabled: resolveKitOverrides(kitEntries, c.chassisId).castingDisabled })),
      ),
```

and in the drop handler's `kitInputs` assembly add a branch for spell drops:

```ts
    } else if (dropped.type === "spell") {
      const key = dropped.system?.casterClass === "priest" ? "priest" : "wizard";
      const kits = activeKitEntries(existing);
      kitInputs = {
        kitDisablesCasting: casterTypesDisabled(
          existing
            .filter((i) => i.type === "class")
            .map((i) => ({ chassisId: i.system.chassisId ?? "", castingDisabled: resolveKitOverrides(kits, i.system.chassisId ?? "").castingDisabled })),
        )[key],
      };
    }
```

(Match the existing `kitInputs` type; widen it to `Partial<DropCheckInput>` if needed.)

- [ ] **Step 4: Run to verify they pass, plus the full CI-style checks**

Run: `npx vitest run tests/sheets tests/lang tests/templates && npm run typecheck && npm run lint`
Expected: PASS. Add `tests/sheets/character/spell-actions.test.ts` is already in the core-config exclude; if you create `kit-casting.ts` and a new test file for it that imports Foundry globals, add that file to `tsconfig.core.json` `exclude`.

- [ ] **Step 5: Commit**

```bash
git add src tests lang tsconfig.core.json
git commit -m "feat(kits): hard-block spell drops/learn/memorize/cast and inert Spells tab when a kit disables casting

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Turning, scaled powers and the Kits panel

**Files:**
- Modify: `src/sheets/character/turning-actions.ts`, `src/sheets/character/kit-power-actions.ts`, `src/sheets/character/sheet.ts`, `templates/actor/pc/partials/pc-feature-panels.hbs`, `lang/en.json`
- Test: `tests/sheets/character/kit-power-actions.test.ts`, `tests/lang/en-coverage.test.ts`, a new `tests/sheets/character/turning-actions.test.ts`

**Interfaces:**
- Consumes: `turnerLevelFor` with `turning` (Task 1), `buildPowerRows(..., classLevel)`, `powerRemaining/canUsePower/spendPower(..., classLevel)`, `buildPowerUseCardContext({... uses})`, `resolveKitOverrides`, `activeKitEntries`.
- Produces: `turningPanel`/`turnUndead` honour the kit's turning rule; `usePower` resolves scaled uses at the kit class's level; Kits panel shows overrides.

- [ ] **Step 1: Write the failing tests.**

Create `tests/sheets/character/turning-actions.test.ts` (this file imports Foundry-coupled glue, so add it to `tsconfig.core.json` `exclude` too):

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { turningPanel } from "../../../src/sheets/character/turning-actions";

beforeEach(() => {
  (globalThis as Record<string, unknown>).game = { user: { isGM: false } };
});

const kit = (overrides: unknown) => ({
  id: "k1", name: "Kit", type: "kit",
  system: {
    chassisId: "paladin",
    qualifications: { abilityMinimums: {}, races: [], alignments: [] },
    xpModifierPercent: 0, effects: [], equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
    forbiddenWeaponProficiencies: [], grantedFeatures: [], powers: [], overrides,
  },
});
const actor = (items: unknown[], level = 6) =>
  ({
    name: "Tam", img: "t.png", isOwner: true,
    system: { classes: [{ chassisId: "paladin", level }] },
    items,
    getFlag: () => undefined, setFlag: async () => undefined, unsetFlag: async () => undefined,
  }) as never;

describe("turningPanel with a kit turning rule (SP11 Plan C)", () => {
  const paladinClass = { id: "c1", name: "Paladin", type: "class", system: { chassisId: "paladin" } };
  it("a plain Paladin turns two levels lower", () => {
    expect(turningPanel(actor([paladinClass])).level).toBe(4);
  });
  it("a kit with turning offset 0 turns at full class level", () => {
    const ghost = kit({ casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: [] });
    expect(turningPanel(actor([paladinClass, ghost])).level).toBe(6);
  });
  it("a kit with turning none cannot turn", () => {
    const none = kit({ casting: "inherit", turning: { mode: "none", offset: 0 }, removedAbilities: [] });
    expect(turningPanel(actor([paladinClass, none])).canTurn).toBe(false);
  });
});
```

In `tests/sheets/character/kit-power-actions.test.ts` add (the file's `kit()` helper builds a kit item; extend its `system` with `overrides` default if the test file's schema reads it; the `actor()` helper needs `system.classes: [{ chassisId: "fighter", level: n }]`):

```ts
describe("usePower with a level-scaled power (SP11 Plan C)", () => {
  const scaled = { id: "dispel-evil", name: "Dispel Evil", uses: 0, per: "day", scope: "", params: [], usesByLevel: [{ minLevel: 1, uses: 0 }, { minLevel: 5, uses: 1 }] };
  it("is refused (warn, no write) below the first bracket and works at the level that unlocks it", async () => {
    const low = actor({}, [scaled]);
    low.a.system.classes = [{ chassisId: "fighter", level: 4 }];
    await usePower(low.a, "k1", "dispel-evil");
    expect(low.updates).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);

    const high = actor({}, [scaled]);
    high.a.system.classes = [{ chassisId: "fighter", level: 5 }];
    await usePower(high.a, "k1", "dispel-evil");
    expect(high.updates).toEqual([{ "system.kitPowers.k1:dispel-evil": { used: 1 } }]);
    await usePower(high.a, "k1", "dispel-evil");
    expect(high.updates).toHaveLength(1);
  });
});
```

(`KitPowerActor` gets `system.classes?: { chassisId: string; level: number }[]`; update the test fixture type accordingly. The kit in this file's `kit()` helper is for the `fighter` chassis, matching the class level above.)

`tests/lang/en-coverage.test.ts` — append a block asserting `ADND2E.sheet.kits.castingDisabled`, `ADND2E.sheet.kits.removed`, `ADND2E.sheet.kits.turning.offset`, `ADND2E.sheet.kits.turning.none` resolve to non-empty strings.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sheets tests/lang`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/sheets/character/turning-actions.ts` — import `activeKitEntries` from `"../../data/derive/character/kits"` and `resolveKitOverrides` from `"../../core/kits"`. Extend `TurnerActor` with `items: Iterable<{ id: string; name: string; type: string; system: unknown }>;`. Add:

```ts
/** The actor's classes with each class's kit turning rule (SP11 Plan C). */
function turnClasses(actor: TurnerActor): { chassisId: string; level: number; turning: ReturnType<typeof resolveKitOverrides>["turning"] }[] {
  const kits = activeKitEntries(actor.items);
  return actor.system.classes.map((c) => ({ ...c, turning: resolveKitOverrides(kits, c.chassisId).turning }));
}
```

and replace both `turnerLevelFor(actor.system.classes)` calls (in `turningPanel` and `turnUndead`) with `turnerLevelFor(turnClasses(actor))`.

`src/sheets/character/kit-power-actions.ts` — extend `KitPowerActor.system` with `classes?: { chassisId: string; level: number }[]`. Add:

```ts
/** The level of the kit's class (1 when unknown), for level-scaled uses. */
function classLevelOf(actor: KitPowerActor, chassisId: string): number {
  return actor.system.classes?.find((c) => c.chassisId === chassisId)?.level ?? 1;
}
```

In `usePower`, after `const { power } = found;` use `const level = classLevelOf(actor, found.kit.chassisId);` and pass `level` as the third argument to `canUsePower(power, used, level)` and `spendPower(power, used, level)`; `powerRemaining(power, next, level)`; and add `uses: powerUses(power, level)` to the `buildPowerUseCardContext` call (import `powerUses` from `"../../core/kits"`).

`src/sheets/character/sheet.ts` — in the `context.kits` mapping (inside `_prepareContext`), compute `const classLevel = ((this.document as unknown as { system: { classes?: { chassisId: string; level: number }[] } }).system.classes ?? []).find((c) => c.chassisId === k.chassisId)?.level ?? 1;` and change the powers line to `buildPowerRows(k.id, k.powers, usage, classLevel).map(...)`. Add to each mapped kit:

```ts
      overrides: {
        castingDisabled: k.overrides.casting === "none",
        turningKey: k.overrides.turning.mode === "inherit" ? "" : `ADND2E.sheet.kits.turning.${k.overrides.turning.mode}`,
        turningOffsetLabel:
          k.overrides.turning.mode === "offset"
            ? (k.overrides.turning.offset >= 0 ? `+${k.overrides.turning.offset}` : String(k.overrides.turning.offset))
            : "",
        removedAbilities: k.overrides.removedAbilities,
      },
```

`templates/actor/pc/partials/pc-feature-panels.hbs` — inside the Kits `{{#each @root.kits as |k|}}` row, directly after the `grantedFeatures` line and before the powers block, insert:

```hbs
          {{#if k.overrides.castingDisabled}}<span class="effect">{{localize 'ADND2E.sheet.kits.castingDisabled'}}</span>{{/if}}
          {{#if k.overrides.turningKey}}<span class="effect">{{localize k.overrides.turningKey}}{{#if k.overrides.turningOffsetLabel}} {{k.overrides.turningOffsetLabel}}{{/if}}</span>{{/if}}
          {{#if k.overrides.removedAbilities.length}}<span class="effect">{{localize 'ADND2E.sheet.kits.removed'}}: {{#each k.overrides.removedAbilities}}<s class="removed">{{this}}</s>{{#unless @last}}, {{/unless}}{{/each}}</span>{{/if}}
```

`lang/en.json` — inside `ADND2E.sheet.kits` add:

```json
        "castingDisabled": "Spellcasting disabled",
        "removed": "Removed abilities",
        "turning": {
          "offset": "Turning level",
          "none": "Cannot turn undead"
        },
```

- [ ] **Step 4: Run to verify they pass, plus CI-style checks**

Run: `npx vitest run tests && npm run typecheck && npm run lint`
Expected: PASS. If `tests/templates/*-bindings.test.ts` still passes, the template change added no `data-action`s (it adds none).

- [ ] **Step 5: Commit**

```bash
git add src tests templates lang tsconfig.core.json
git commit -m "feat(kits): kit turning rule, level-scaled power uses and override display on the Kits panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sample Ghosthunter, manifest, README

**Files:**
- Create: `packs/kits/_source/sample-ghosthunter.json`
- Modify: `packs/kits/_source/_MANIFEST.md`, `tests/packs/content.test.ts`, `README.md`

**Interfaces:** Consumes the full engine (Tasks 1-5). Importer unchanged (it passes `system` through).

- [ ] **Step 1: Write the failing test.** In `tests/packs/content.test.ts`, in `describe("kits pack content")`: change the kit count test to expect **four** kits (`toHaveLength(4)`, `new Set(...).size).toBe(4)`, title "has four uniquely named..."). Add `normalizeOverrides, powerUses, TURNING_MODES, CASTING_MODES` to the `../../src/core/kits` import and append:

```ts
  it("the Sample Ghosthunter exercises casting-off, turning offset, removed abilities and level-scaled powers", () => {
    const ghost = items.find((d) => d.name === "Sample Ghosthunter");
    expect(ghost).toBeDefined();
    const s = sys(ghost!) as { chassisId: string; overrides: unknown; powers: unknown[] };
    expect(s.chassisId).toBe("paladin");
    const o = normalizeOverrides(s.overrides as never);
    expect(o).toEqual({ casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: ["Laying on hands", "Immunity to disease", "Curing diseases"] });
    expect(CASTING_MODES as readonly string[]).toContain(o.casting);
    expect(TURNING_MODES as readonly string[]).toContain(o.turning.mode);
    const powers = normalizePowers(s.powers as never);
    expect(powers).toHaveLength(s.powers.length);
    const dispel = powers.find((p) => p.id === "dispel-evil")!;
    const remove = powers.find((p) => p.id === "remove-paralysis")!;
    expect([1, 5, 10, 15, 20].map((l) => powerUses(dispel, l))).toEqual([0, 1, 2, 3, 4]);
    expect([1, 5, 10, 15, 20].map((l) => powerUses(remove, l))).toEqual([3, 4, 5, 6, 7]);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/packs/content.test.ts`
Expected: FAIL (only three kits; no Ghosthunter).

- [ ] **Step 3: Implement.** Create `packs/kits/_source/sample-ghosthunter.json` (id is exactly 16 characters):

```json
{
  "_id": "kSampleGhosthnt1",
  "_key": "!items!kSampleGhosthnt1",
  "name": "Sample Ghosthunter",
  "type": "kit",
  "img": "icons/svg/upgrade.svg",
  "system": {
    "description": "",
    "chassisId": "paladin",
    "qualifications": {
      "abilityMinimums": { "str": 0, "dex": 0, "con": 0, "int": 0, "wis": 0, "cha": 0 },
      "races": [],
      "alignments": []
    },
    "xpModifierPercent": 0,
    "effects": [],
    "equipment": {
      "armor": { "mode": "inherit", "names": [] },
      "weapons": { "mode": "inherit", "names": [] }
    },
    "forbiddenWeaponProficiencies": [],
    "grantedFeatures": [],
    "powers": [
      {
        "id": "dispel-evil", "name": "Dispel Evil", "uses": 0, "per": "day", "scope": "", "params": [],
        "usesByLevel": [
          { "minLevel": 1, "uses": 0 }, { "minLevel": 5, "uses": 1 }, { "minLevel": 10, "uses": 2 },
          { "minLevel": 15, "uses": 3 }, { "minLevel": 20, "uses": 4 }
        ]
      },
      {
        "id": "remove-paralysis", "name": "Remove Paralysis", "uses": 0, "per": "day", "scope": "", "params": [],
        "usesByLevel": [
          { "minLevel": 1, "uses": 3 }, { "minLevel": 5, "uses": 4 }, { "minLevel": 10, "uses": 5 },
          { "minLevel": 15, "uses": 6 }, { "minLevel": 20, "uses": 7 }
        ]
      }
    ],
    "overrides": {
      "casting": "none",
      "turning": { "mode": "offset", "offset": 0 },
      "removedAbilities": ["Laying on hands", "Immunity to disease", "Curing diseases"]
    }
  }
}
```

`_MANIFEST.md` — change "Three SAMPLE" to "Four SAMPLE", mention Plan C in the intro (`Plan C adds base-class overrides and level-scaled power uses.`), and add the row:

`| kSampleGhosthnt1 | Sample Ghosthunter | paladin | casting off, turning at full class level, removed abilities, level-scaled powers |`

README: Sub-project 11 row — note Plan C (base-class overrides, level-scaled powers, Sample Ghosthunter) complete, so Sub-project 11 is complete.

- [ ] **Step 4: Run to verify it passes, then the full CI sequence**

Run: `npx vitest run tests/packs tests/data && npm run build:packs`
Expected: PASS; `build-packs: kits  4/4 documents OK`.

- [ ] **Step 5: Commit**

```bash
git add packs README.md tests/packs
git commit -m "feat(kits): Sample Ghosthunter kit, manifest, README (SP11 Plan C)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verification gates (no new feature code unless a gate fails)

- [ ] **Step 1: The full CI sequence, exactly as `.github/workflows/ci.yml` runs it.** Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. Expected: all green, 100% statements/lines/functions. If `src/core/kits/overrides.ts` or a `src/data/derive/**` file shows an uncovered line, add the missing case to its test file.
- [ ] **Step 2: Whole-branch review** with superpowers:requesting-code-review on `git diff master...HEAD`. Blocking: any Critical/Important. Pay particular attention to: stale cached spell data (deriveAndCache clearing vs. a kit later removed — slots must refill on the next prepare); a multiclass actor where only one class's kit disables casting (the other caster type must keep working); known-but-inert spells not flagged orphaned; every spell entry point guarded; non-GM seat (all writes are to the actor's own data); the turning panel for a kit on a non-turner class; PC-only gating.
- [ ] **Step 3: Headless proof (controller does this, not a subagent; see the `foundry-headless-proof-harness` memory).** Extend or recreate `.superpowers/proof/` to prove with real Foundry classes: the real `KitItemModel.schema.validate` accepts Sample Ghosthunter and rejects an invalid `overrides.casting` / `turning.mode`; a level-10 Paladin run through the real `deriveCharacter` has priest slots without the kit and none with it; `turnerLevelFor` for a level-10 Paladin gives 8 without the kit and 10 with it; `powerUses` for Dispel Evil / Remove Paralysis across levels 1/5/10/15/20; the real `memorizeSpell`/`castSpell`/`learnSpell` refuse with the toast and write nothing; the real `validateItemDrop` refuses a priest spell drop; the rendered Kits panel shows "Spellcasting disabled", the turning note, struck-through removed abilities, and a locked "0 / 0 per day" Dispel Evil at level 4 but "1 / 1 per day" at level 5; Character NPC / Monster NPC render none of it.
- [ ] **Step 4: Rebuild the installed system** (`npm run build`; Foundry's `Data/systems/adnd2e` is a junction to `dist/`) only if Foundry is closed.
- [ ] **Step 5: Push and open the PR** (branch-finishing preference: always push + PR, never ask). PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Confirm CI is green; do NOT retry `gh pr merge` if blocked, ask the user to merge. Hand the user a short **manual checklist** for what the harness cannot prove: as a non-GM player seat on a Paladin with Sample Ghosthunter — the Spells tab shows no priest casting section and a dropped spell is refused with the toast; Turn Undead works at full class level (compare against the same Paladin without the kit); Dispel Evil is locked below level 5 and Use works from level 5; the Kits panel shows the struck-through abilities and notes.

---

## Self-Review notes

- Spec coverage: data model → Task 2; pure core + `powerUses` + turning rule → Task 1; casting off (derive choke point, cached-data clearing, drops/actions guards, Spells tab) → Tasks 3-4; turning wiring → Task 5; scaled powers in rows/use → Tasks 1 and 5; Kits panel display + lang → Task 5; sample kit, manifest, content test, README → Task 6; testing/gates/headless proof/manual checklist → Task 7.
- Type/name consistency: `KitOverrides`, `TurningRule`, `ResolvedOverrides`, `resolveKitOverrides`, `normalizeOverrides`, `effectiveTurnerLevel`, `powerUses`, `casterTypesDisabled`, `castingBlockedByKit`, `ClassEntry.castingDisabled`, `CharacterDerived.castingDisabled`, `DropCheckInput.kitDisablesCasting`, `CharacterSheetInput.castingDisabled` are used identically across tasks.
- Known judgment points left to the implementers, flagged in-task: the exact `SpellItemView` flag names in `context.ts`, the existing actor/input fixture helpers in the sheet tests, and whether `castingBlockedByKit` needs its own file to avoid an import cycle with `casting-actions.ts`.
