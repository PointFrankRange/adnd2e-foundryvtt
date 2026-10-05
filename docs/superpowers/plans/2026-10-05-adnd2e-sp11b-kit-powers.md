# Sub-project 11 Plan B: Kit Granted Powers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A kit can carry tracked, parametrized powers (name, uses per day/week/encounter or at-will, scope, key/value params). The PC sheet shows them with a Use button, a per-actor use counter, and rest/reset controls.

**Architecture:** A pure `src/core/kits/powers.ts` (normalize, remaining/spend, rows, reset/prune update builders, chat-card context) is the single source of rules. `KitItemModel` gains a `powers` array (definition only); the base actor gains a persisted `kitPowers` ObjectField (use counts, keyed `"<kitItemId>:<powerId>"`). Foundry glue in a new `src/sheets/character/kit-power-actions.ts` + the PC Features-tab Kits panel. No automation of any power's effect.

**Tech Stack:** TypeScript, Foundry v14 DataModel fields, Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-adnd2e-sp11b-kit-powers-design.md` (Plan A's spec: `2026-10-04-adnd2e-sp11a-kit-engine-design.md`).

## Global Constraints

- **Run `npm run test:coverage` (100% lines/statements/functions gate, 90% branches) before opening the PR.** `src/core/**`, `src/data/derive/**`, `src/data/item/choices.ts` and `src/sheets/character/context.ts` are in the gate; Foundry glue (`src/sheets/character/kit-power-actions.ts`, `sheet.ts`, `item-row-actions.ts`) is not, but is still unit-tested where a pure seam exists and dev-world verified.
- Content policy: mechanical data only, no rulebook prose in shipped content.
- Power ids are slugs matching `/^[a-z0-9-]+$/` (no `.` — they appear in dotted update paths).
- Never write `kitPowers` from `prepareDerivedData`. Only Use / Reset / kit deletion write it.
- Writes target only the acting actor's own `system.kitPowers` (a non-GM player must be able to Use). No target-actor mutation.
- Removing keys from an `ObjectField` needs Foundry's `-=` delete syntax (`system.kitPowers.-=<key>: null`); a plain object update merges and would not remove them. Resets set `{ used: 0 }`; only kit deletion prunes.
- Every new user-visible string goes in `lang/en.json` and is asserted by `tests/lang/en-coverage.test.ts`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `src/core/kits/powers.ts` — pure power rules.
- Modify `src/core/kits/index.ts` — export it.
- Create `tests/core/kits/powers.test.ts`.
- Modify `src/data/item/choices.ts` — export `KIT_POWER_FREQUENCIES`; modify `tests/data/choices.test.ts`.
- Modify `src/data/item/kit.ts` — `powers` field.
- Modify `src/data/actor/base-actor.ts` — `kitPowers` ObjectField.
- Modify `src/data/derive/character/kits.ts` — `KitEntry.powers`; modify `tests/data/derive/kits.test.ts`.
- Create `src/sheets/character/kit-power-actions.ts`; create `tests/sheets/character/kit-power-actions.test.ts`.
- Modify `src/sheets/character/sheet.ts` (context rows, 4 actions, rest hook), `src/sheets/item-row-actions.ts` (prune on kit delete).
- Modify `templates/actor/pc/partials/pc-feature-panels.hbs`; create `templates/chat/kit-power-use.hbs`.
- Modify `lang/en.json`, `tests/lang/en-coverage.test.ts`, `tests/templates/pc-sheet-bindings.test.ts`.
- Modify `packs/kits/_source/sample-duelist.json`, `sample-zealot.json`, `_MANIFEST.md`; modify `tests/packs/content.test.ts`.
- Modify `README.md` (Sub-project 11 row).

---

### Task 1: Pure power rules

**Files:**
- Create: `src/core/kits/powers.ts`
- Modify: `src/core/kits/index.ts`
- Test: `tests/core/kits/powers.test.ts`

**Interfaces:**
- Produces (all exported from `src/core/kits`):
  - `POWER_FREQUENCIES = ["day","week","encounter","at-will"] as const`, `type PowerFrequency`
  - `interface PowerParam { key: string; value: string }`
  - `interface KitPower { id: string; name: string; uses: number; per: PowerFrequency; scope: string; params: PowerParam[] }`
  - `type PowerUsage = Record<string, { used: number }>`
  - `powerKey(kitId: string, powerId: string): string`
  - `normalizePowers(raw: readonly RawPower[]): KitPower[]`
  - `usedCount(usage: PowerUsage, kitId: string, powerId: string): number`
  - `powerRemaining(power: KitPower, used: number): number | null`
  - `canUsePower(power: KitPower, used: number): boolean`
  - `spendPower(power: KitPower, used: number): number`
  - `interface PowerRow { id: string; name: string; per: PowerFrequency; atWill: boolean; uses: number; used: number; remaining: number | null; scope: string; params: PowerParam[]; canUse: boolean; canReset: boolean }`
  - `buildPowerRows(kitId: string, powers: readonly KitPower[], usage: PowerUsage): PowerRow[]`
  - `resetKeys(kits: readonly { id: string; powers: readonly KitPower[] }[], usage: PowerUsage, per: PowerFrequency): string[]`
  - `usageResetUpdate(keys: readonly string[]): Record<string, unknown>`
  - `usageSpendUpdate(key: string, used: number): Record<string, unknown>`
  - `usagePruneUpdate(usage: PowerUsage, kitId: string): Record<string, unknown>`
  - `buildPowerUseCardContext(input: PowerUseCardInput): PowerUseCardContext`

- [ ] **Step 1: Write the failing test** — create `tests/core/kits/powers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  POWER_FREQUENCIES,
  buildPowerRows,
  buildPowerUseCardContext,
  canUsePower,
  normalizePowers,
  powerKey,
  powerRemaining,
  resetKeys,
  spendPower,
  usageResetUpdate,
  usagePruneUpdate,
  usageSpendUpdate,
  usedCount,
  type KitPower,
} from "../../../src/core/kits";

const daily: KitPower = { id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [{ key: "duration", value: "1 hour" }] };
const weekly: KitPower = { id: "rally", name: "Rally", uses: 1, per: "week", scope: "", params: [] };
const fight: KitPower = { id: "feint", name: "Feint", uses: 3, per: "encounter", scope: "", params: [] };
const free: KitPower = { id: "sense", name: "Sense", uses: 0, per: "at-will", scope: "", params: [] };

describe("POWER_FREQUENCIES", () => {
  it("lists the four frequencies", () => {
    expect([...POWER_FREQUENCIES]).toEqual(["day", "week", "encounter", "at-will"]);
  });
});

describe("normalizePowers", () => {
  it("keeps a well-formed power", () => {
    expect(
      normalizePowers([{ id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [{ key: "duration", value: "1 hour" }] }]),
    ).toEqual([daily]);
  });
  it("drops blank, non-slug and duplicate ids, blank names and invalid frequencies", () => {
    const out = normalizePowers([
      { id: "", name: "A", uses: 1, per: "day" },
      { id: "Bad.Id", name: "B", uses: 1, per: "day" },
      { id: 5, name: "C", uses: 1, per: "day" },
      { id: "ok", name: "", uses: 1, per: "day" },
      { id: "ok", name: 7, uses: 1, per: "day" },
      { id: "ok", name: "D", uses: 1, per: "yearly" },
      { id: "good", name: "E", uses: 1, per: "day" },
      { id: "good", name: "F", uses: 1, per: "week" },
    ]);
    expect(out.map((p) => p.id)).toEqual(["good"]);
    expect(out[0]!.name).toBe("E");
  });
  it("treats zero, negative or non-integer uses as at-will, and at-will as zero uses", () => {
    const out = normalizePowers([
      { id: "a", name: "A", uses: 0, per: "day" },
      { id: "b", name: "B", uses: -2, per: "week" },
      { id: "c", name: "C", uses: 1.5, per: "day" },
      { id: "d", name: "D", uses: "x", per: "day" },
      { id: "e", name: "E", uses: 4, per: "at-will" },
    ]);
    for (const p of out) {
      expect(p.per).toBe("at-will");
      expect(p.uses).toBe(0);
    }
    expect(out).toHaveLength(5);
  });
  it("defaults scope to blank and drops malformed params", () => {
    const [p] = normalizePowers([
      { id: "a", name: "A", uses: 1, per: "day", scope: 3, params: [{ key: "k", value: "v" }, { key: "", value: "x" }, { key: "n", value: 4 }, null, "s"] },
    ]);
    expect(p!.scope).toBe("");
    expect(p!.params).toEqual([{ key: "k", value: "v" }]);
  });
  it("treats a non-array params as none", () => {
    const [p] = normalizePowers([{ id: "a", name: "A", uses: 1, per: "day", params: "nope" }]);
    expect(p!.params).toEqual([]);
  });
});

describe("usage maths", () => {
  it("powerKey joins kit and power ids", () => {
    expect(powerKey("kitA", "shape")).toBe("kitA:shape");
  });
  it("usedCount reads a count, defaulting to 0 for missing or malformed entries", () => {
    const usage = { "k:a": { used: 2 }, "k:b": { used: -1 }, "k:c": { used: "x" } } as never;
    expect(usedCount(usage, "k", "a")).toBe(2);
    expect(usedCount(usage, "k", "b")).toBe(0);
    expect(usedCount(usage, "k", "c")).toBe(0);
    expect(usedCount(usage, "k", "missing")).toBe(0);
  });
  it("powerRemaining: null at-will, otherwise uses minus used, floored at 0", () => {
    expect(powerRemaining(free, 5)).toBeNull();
    expect(powerRemaining(daily, 0)).toBe(2);
    expect(powerRemaining(daily, 1)).toBe(1);
    expect(powerRemaining(daily, 9)).toBe(0);
  });
  it("canUsePower: at-will always, others while uses remain", () => {
    expect(canUsePower(free, 99)).toBe(true);
    expect(canUsePower(daily, 1)).toBe(true);
    expect(canUsePower(daily, 2)).toBe(false);
  });
  it("spendPower adds one use, never past the limit, and never counts at-will", () => {
    expect(spendPower(daily, 0)).toBe(1);
    expect(spendPower(daily, 2)).toBe(2);
    expect(spendPower(free, 0)).toBe(0);
  });
});

describe("buildPowerRows", () => {
  it("builds display rows with remaining, canUse and canReset", () => {
    const usage = { "k1:shape": { used: 2 }, "k1:rally": { used: 0 } };
    const rows = buildPowerRows("k1", [daily, weekly, free], usage);
    expect(rows[0]).toEqual({
      id: "shape", name: "Shapechange", per: "day", atWill: false, uses: 2, used: 2, remaining: 0,
      scope: "mammals", params: [{ key: "duration", value: "1 hour" }], canUse: false, canReset: true,
    });
    expect(rows[1]).toMatchObject({ id: "rally", remaining: 1, canUse: true, canReset: false });
    expect(rows[2]).toMatchObject({ id: "sense", atWill: true, remaining: null, canUse: true, canReset: false });
  });
});

describe("reset and prune updates", () => {
  const kits = [{ id: "k1", powers: [daily, weekly, fight, free] }, { id: "k2", powers: [daily] }];
  const usage = { "k1:shape": { used: 1 }, "k1:rally": { used: 1 }, "k1:feint": { used: 0 }, "k2:shape": { used: 2 }, "gone:x": { used: 4 } };
  it("resetKeys lists used, non-at-will powers of the given frequency across kits", () => {
    expect(resetKeys(kits, usage, "day")).toEqual(["k1:shape", "k2:shape"]);
    expect(resetKeys(kits, usage, "week")).toEqual(["k1:rally"]);
    expect(resetKeys(kits, usage, "encounter")).toEqual([]);
    expect(resetKeys(kits, usage, "at-will")).toEqual([]);
  });
  it("usageResetUpdate sets each key's used to 0", () => {
    expect(usageResetUpdate(["k1:shape", "k2:shape"])).toEqual({
      "system.kitPowers.k1:shape": { used: 0 },
      "system.kitPowers.k2:shape": { used: 0 },
    });
    expect(usageResetUpdate([])).toEqual({});
  });
  it("usageSpendUpdate sets one key", () => {
    expect(usageSpendUpdate("k1:shape", 2)).toEqual({ "system.kitPowers.k1:shape": { used: 2 } });
  });
  it("usagePruneUpdate deletes every key of the kit with Foundry's -= operator", () => {
    expect(usagePruneUpdate(usage, "k1")).toEqual({
      "system.kitPowers.-=k1:shape": null,
      "system.kitPowers.-=k1:rally": null,
      "system.kitPowers.-=k1:feint": null,
    });
    expect(usagePruneUpdate(usage, "nothing")).toEqual({});
  });
});

describe("buildPowerUseCardContext", () => {
  it("carries the power, scope, params, remaining uses and a localized frequency key", () => {
    const ctx = buildPowerUseCardContext({
      actorName: "Tam", actorImg: "a.png", power: daily, remaining: 1,
    });
    expect(ctx).toEqual({
      actorName: "Tam", actorImg: "a.png", powerName: "Shapechange", scope: "mammals",
      params: [{ key: "duration", value: "1 hour" }], atWill: false, remaining: 1, uses: 2,
      perKey: "ADND2E.sheet.kits.per.day",
    });
  });
  it("marks an at-will power", () => {
    const ctx = buildPowerUseCardContext({ actorName: "Tam", actorImg: "a.png", power: free, remaining: null });
    expect(ctx.atWill).toBe(true);
    expect(ctx.perKey).toBe("ADND2E.sheet.kits.per.at-will");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/kits/powers.test.ts`
Expected: FAIL (module exports missing).

- [ ] **Step 3: Implement** — create `src/core/kits/powers.ts`:

```ts
/* SP11 Plan B: tracked, parametrized kit powers. Pure; Foundry-free.
 * A power is DEFINITION data on a kit item; how many times it has been used
 * lives on the actor (`system.kitPowers`, keyed "<kitItemId>:<powerId>"). No
 * power's effect is automated — the GM narrates it. */

export const POWER_FREQUENCIES = ["day", "week", "encounter", "at-will"] as const;
export type PowerFrequency = (typeof POWER_FREQUENCIES)[number];

export interface PowerParam {
  key: string;
  value: string;
}

export interface KitPower {
  id: string;
  name: string;
  /** 0 ⇔ at-will. */
  uses: number;
  per: PowerFrequency;
  scope: string;
  params: PowerParam[];
}

export type PowerUsage = Record<string, { used: number }>;

export interface RawPower {
  id?: unknown;
  name?: unknown;
  uses?: unknown;
  per?: unknown;
  scope?: unknown;
  params?: unknown;
}

/** Slug ids: no "." (they appear in dotted update paths) and no ":" (the key separator). */
const SLUG = /^[a-z0-9-]+$/;

export function powerKey(kitId: string, powerId: string): string {
  return `${kitId}:${powerId}`;
}

function normalizeParams(raw: unknown): PowerParam[] {
  if (!Array.isArray(raw)) return [];
  const out: PowerParam[] = [];
  for (const p of raw as { key?: unknown; value?: unknown }[]) {
    if (p && typeof p.key === "string" && p.key !== "" && typeof p.value === "string") {
      out.push({ key: p.key, value: p.value });
    }
  }
  return out;
}

/** Lenient read, like a malformed trait effect: a bad power is dropped (inert).
 *  Afterwards at-will ⇔ `per === "at-will"` ⇔ `uses === 0`. */
export function normalizePowers(raw: readonly RawPower[]): KitPower[] {
  const seen = new Set<string>();
  const out: KitPower[] = [];
  for (const p of raw) {
    if (typeof p.id !== "string" || !SLUG.test(p.id) || seen.has(p.id)) continue;
    if (typeof p.name !== "string" || p.name === "") continue;
    if (!(POWER_FREQUENCIES as readonly unknown[]).includes(p.per)) continue;
    seen.add(p.id);
    const finite = typeof p.uses === "number" && Number.isInteger(p.uses) && p.uses > 0;
    const atWill = !finite || p.per === "at-will";
    out.push({
      id: p.id,
      name: p.name,
      uses: atWill ? 0 : (p.uses as number),
      per: atWill ? "at-will" : (p.per as PowerFrequency),
      scope: typeof p.scope === "string" ? p.scope : "",
      params: normalizeParams(p.params),
    });
  }
  return out;
}

export function usedCount(usage: PowerUsage, kitId: string, powerId: string): number {
  const n = usage[powerKey(kitId, powerId)]?.used;
  return typeof n === "number" && n > 0 ? n : 0;
}

export function powerRemaining(power: KitPower, used: number): number | null {
  return power.per === "at-will" ? null : Math.max(0, power.uses - used);
}

export function canUsePower(power: KitPower, used: number): boolean {
  const remaining = powerRemaining(power, used);
  return remaining === null || remaining > 0;
}

/** The new `used` count after one use; at-will powers are never counted. */
export function spendPower(power: KitPower, used: number): number {
  return power.per === "at-will" || !canUsePower(power, used) ? used : used + 1;
}

export interface PowerRow {
  id: string;
  name: string;
  per: PowerFrequency;
  atWill: boolean;
  uses: number;
  used: number;
  remaining: number | null;
  scope: string;
  params: PowerParam[];
  canUse: boolean;
  canReset: boolean;
}

export function buildPowerRows(kitId: string, powers: readonly KitPower[], usage: PowerUsage): PowerRow[] {
  return powers.map((p) => {
    const used = usedCount(usage, kitId, p.id);
    return {
      id: p.id,
      name: p.name,
      per: p.per,
      atWill: p.per === "at-will",
      uses: p.uses,
      used,
      remaining: powerRemaining(p, used),
      scope: p.scope,
      params: p.params,
      canUse: canUsePower(p, used),
      canReset: p.per !== "at-will" && used > 0,
    };
  });
}

/** Keys of used, non-at-will powers with the given frequency, across the given kits. */
export function resetKeys(
  kits: readonly { id: string; powers: readonly KitPower[] }[],
  usage: PowerUsage,
  per: PowerFrequency,
): string[] {
  const keys: string[] = [];
  for (const kit of kits) {
    for (const p of kit.powers) {
      if (p.per === per && p.per !== "at-will" && usedCount(usage, kit.id, p.id) > 0) keys.push(powerKey(kit.id, p.id));
    }
  }
  return keys;
}

/** Actor update that zeroes the given keys (set, not delete: an ObjectField update merges). */
export function usageResetUpdate(keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [`system.kitPowers.${k}`, { used: 0 }]));
}

export function usageSpendUpdate(key: string, used: number): Record<string, unknown> {
  return { [`system.kitPowers.${key}`]: { used } };
}

/** Actor update that deletes every counter of a removed kit (Foundry's `-=` operator). */
export function usagePruneUpdate(usage: PowerUsage, kitId: string): Record<string, unknown> {
  const prefix = `${kitId}:`;
  return Object.fromEntries(
    Object.keys(usage)
      .filter((k) => k.startsWith(prefix))
      .map((k) => [`system.kitPowers.-=${k}`, null]),
  );
}

export interface PowerUseCardInput {
  actorName: string;
  actorImg: string;
  power: KitPower;
  /** Remaining uses AFTER this use; null for at-will. */
  remaining: number | null;
}

export interface PowerUseCardContext {
  actorName: string;
  actorImg: string;
  powerName: string;
  scope: string;
  params: PowerParam[];
  atWill: boolean;
  remaining: number | null;
  uses: number;
  perKey: string;
}

export function buildPowerUseCardContext(input: PowerUseCardInput): PowerUseCardContext {
  const { power } = input;
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    powerName: power.name,
    scope: power.scope,
    params: power.params,
    atWill: power.per === "at-will",
    remaining: input.remaining,
    uses: power.uses,
    perKey: `ADND2E.sheet.kits.per.${power.per}`,
  };
}
```

Then modify `src/core/kits/index.ts` — add the line `export * from "./powers";`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/core/kits/powers.test.ts`
Expected: PASS. If a `normalizePowers` expectation about the 8-row drop test fails, re-check that the `"ok"` duplicate rows are all dropped for *other* reasons (blank name, non-string name, bad `per`) so `"ok"` never enters `seen`.

- [ ] **Step 5: Commit**

```bash
git add src/core/kits/powers.ts src/core/kits/index.ts tests/core/kits/powers.test.ts
git commit -m "feat(kits): pure kit-power rules (normalize, spend, rows, reset/prune updates)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema fields and derive entries

**Files:**
- Modify: `src/data/item/choices.ts:89`
- Modify: `src/data/item/kit.ts`
- Modify: `src/data/actor/base-actor.ts` (after `resources`, ~line 195)
- Modify: `src/data/derive/character/kits.ts`
- Test: `tests/data/choices.test.ts`, `tests/data/derive/kits.test.ts`

**Interfaces:**
- Consumes: `POWER_FREQUENCIES`, `normalizePowers`, `KitPower`, `RawPower` (Task 1).
- Produces: `KIT_POWER_FREQUENCIES` (choices); `KitEntry.powers: KitPower[]`; schema `system.powers` on kit items, `system.kitPowers` on actors.

- [ ] **Step 1: Write the failing tests.**

In `tests/data/choices.test.ts` add `KIT_POWER_FREQUENCIES` to the import from `../../src/data/item/choices` and append:

```ts
describe("kit power frequencies (SP11 Plan B)", () => {
  it("match the pure frequencies", () => {
    expect([...KIT_POWER_FREQUENCIES]).toEqual(["day", "week", "encounter", "at-will"]);
  });
});
```

In `tests/data/derive/kits.test.ts`, extend the `kitItem` default `system` with `powers: [{ id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [] }, { id: "bad id", name: "X", uses: 1, per: "day" }],` and add to the first test (`reads kit items and drops malformed effects`):

```ts
    expect(k!.powers).toEqual([{ id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [] }]);
```

and a new test inside the same `describe`:

```ts
  it("a kit item with no powers field reads as no powers", () => {
    const item = kitItem();
    delete (item.system as Record<string, unknown>).powers;
    expect(toKitEntries([item])[0]!.powers).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/choices.test.ts tests/data/derive/kits.test.ts`
Expected: FAIL (`KIT_POWER_FREQUENCIES` not exported; `powers` undefined).

- [ ] **Step 3: Implement.**

`src/data/item/choices.ts` — below the existing `KIT_EQUIPMENT_MODES` re-export (line 89) add:

```ts
export { POWER_FREQUENCIES as KIT_POWER_FREQUENCIES } from "../../core/kits";
```

`src/data/item/kit.ts` — add `KIT_POWER_FREQUENCIES` to the `./choices` import list, and add this field after `grantedFeatures: names(),`:

```ts
      /** SP11 Plan B: tracked powers. Definition only — use counts live on the actor (`system.kitPowers`). `toKitEntries` reads this leniently (a malformed power is dropped). */
      powers: new ArrayField(
        new SchemaField({
          id: new StringField({ required: true, blank: true, initial: "" }),
          name: new StringField({ required: true, blank: true, initial: "" }),
          uses: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          per: new StringField({ required: true, blank: false, initial: "day", choices: KIT_POWER_FREQUENCIES }),
          scope: new StringField({ required: true, blank: true, initial: "" }),
          params: new ArrayField(
            new SchemaField({
              key: new StringField({ required: true, blank: true, initial: "" }),
              value: new StringField({ required: true, blank: true, initial: "" }),
            }),
            { required: true, initial: [] },
          ),
        }),
        { required: true, initial: [] },
      ),
```

Also extend the class doc comment with one line: `Plan B adds \`powers\`.`

`src/data/actor/base-actor.ts` — after the `resources: new SchemaField({...}),` block (before whatever field follows it) add:

```ts
    /** SP11 Plan B: kit-power use counts, keyed "<kitItemId>:<powerId>" → { used }. PERSISTED, never touched by prepareDerivedData (like channelling.current); only Use / Reset / kit deletion write it. An ObjectField with initial {} makes "no usage" an empty object. */
    kitPowers: new ObjectField({ required: true, initial: {} }),
```

`src/data/derive/character/kits.ts` — change the first import to `import { normalizePowers, type EquipmentOverride, type KitPower, type KitQualifications, type RawPower } from "../../../core/kits";`, add `powers: KitPower[];` to `KitEntry` (after `grantedFeatures`), `powers?: RawPower[];` to `KitSystem`, and `powers: normalizePowers(s.powers ?? []),` to the pushed entry (after `grantedFeatures`).

- [ ] **Step 4: Run to verify they pass, plus typecheck and the drift/schema tests**

Run: `npx vitest run tests/data tests/config && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors. If a drift test enumerates actor `system` top-level keys, add `kitPowers` where it lists them.

- [ ] **Step 5: Commit**

```bash
git add src/data tests/data
git commit -m "feat(kits): kit powers schema, actor kitPowers counter, derive entry

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Actions, sheet wiring, template, lang

**Files:**
- Create: `src/sheets/character/kit-power-actions.ts`, `templates/chat/kit-power-use.hbs`
- Modify: `src/sheets/character/sheet.ts` (context `kits` map ~line 390; action registry ~line 347; `#onRestSpellcasting` ~line 941; add four handlers)
- Modify: `src/sheets/item-row-actions.ts`
- Modify: `templates/actor/pc/partials/pc-feature-panels.hbs` (Kits panel, lines 36-52)
- Modify: `lang/en.json`
- Test: `tests/sheets/character/kit-power-actions.test.ts`, `tests/lang/en-coverage.test.ts`, `tests/templates/pc-sheet-bindings.test.ts`

**Interfaces:**
- Consumes: Task 1 exports; `activeKitEntries` (`src/data/derive/character/kits.ts`) with `KitEntry.powers` (Task 2); `SYSTEM_ID`, `TEMPLATE_PATH` from `src/constants`.
- Produces (`kit-power-actions.ts`):
  - `interface KitPowerActor { name: string; img: string; items: Iterable<{ id: string; name: string; type: string; system: unknown }>; system: { kitPowers?: PowerUsage }; update(data: Record<string, unknown>): Promise<unknown> }`
  - `usePower(actor, kitId, powerId): Promise<void>`
  - `resetPower(actor, kitId, powerId): Promise<void>`
  - `resetKitPowers(actor, per: PowerFrequency): Promise<void>`
  - sheet actions `useKitPower`, `resetKitPower`, `newDayKitPowers`, `newEncounterKitPowers`.

- [ ] **Step 1: Write the failing tests.**

Create `tests/sheets/character/kit-power-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetKitPowers, resetPower, usePower, type KitPowerActor } from "../../../src/sheets/character/kit-power-actions";

const created: unknown[] = [];
let warn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  created.length = 0;
  warn = vi.fn();
  (globalThis as Record<string, unknown>).game = { i18n: { localize: (k: string) => k, format: (k: string) => k } };
  (globalThis as Record<string, unknown>).ui = { notifications: { warn } };
  (globalThis as Record<string, unknown>).ChatMessage = {
    getSpeaker: () => ({ alias: "Tam" }),
    create: async (data: unknown) => created.push(data),
  };
  (globalThis as Record<string, unknown>).foundry = {
    applications: { handlebars: { renderTemplate: async () => "<card/>" } },
  };
});

const kit = (powers: unknown[]) => ({
  id: "k1", name: "Kit", type: "kit",
  system: {
    chassisId: "fighter",
    qualifications: { abilityMinimums: {}, races: [], alignments: [] },
    xpModifierPercent: 0, effects: [], equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
    forbiddenWeaponProficiencies: [], grantedFeatures: [], powers,
  },
});
const cls = { id: "c1", name: "Fighter", type: "class", system: { chassisId: "fighter" } };
const daily = { id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [] };
const free = { id: "sense", name: "Sense", uses: 0, per: "at-will", scope: "", params: [] };

function actor(usage: Record<string, { used: number }>, powers: unknown[] = [daily, free]) {
  const updates: Record<string, unknown>[] = [];
  const a: KitPowerActor = {
    name: "Tam", img: "t.png",
    items: [cls, kit(powers)],
    system: { kitPowers: usage },
    update: async (d) => void updates.push(d),
  };
  return { a, updates };
}

describe("usePower", () => {
  it("spends one use, writes the counter and posts a card", async () => {
    const { a, updates } = actor({});
    await usePower(a, "k1", "shape");
    expect(updates).toEqual([{ "system.kitPowers.k1:shape": { used: 1 } }]);
    expect(created).toHaveLength(1);
  });
  it("warns and does nothing when no uses remain", async () => {
    const { a, updates } = actor({ "k1:shape": { used: 2 } });
    await usePower(a, "k1", "shape");
    expect(updates).toEqual([]);
    expect(created).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("an at-will power posts a card without writing a counter", async () => {
    const { a, updates } = actor({});
    await usePower(a, "k1", "sense");
    expect(updates).toEqual([]);
    expect(created).toHaveLength(1);
  });
  it("ignores an unknown kit or power", async () => {
    const { a, updates } = actor({});
    await usePower(a, "nope", "shape");
    await usePower(a, "k1", "nope");
    expect(updates).toEqual([]);
    expect(created).toHaveLength(0);
  });
  it("ignores a kit whose class the actor does not own", async () => {
    const { a, updates } = actor({});
    a.items = [kit([daily])];
    await usePower(a, "k1", "shape");
    expect(updates).toEqual([]);
  });
});

describe("resetPower", () => {
  it("zeroes one power's counter", async () => {
    const { a, updates } = actor({ "k1:shape": { used: 2 } });
    await resetPower(a, "k1", "shape");
    expect(updates).toEqual([{ "system.kitPowers.k1:shape": { used: 0 } }]);
  });
  it("does nothing when the power is unused or unknown", async () => {
    const { a, updates } = actor({});
    await resetPower(a, "k1", "shape");
    await resetPower(a, "k1", "nope");
    expect(updates).toEqual([]);
  });
});

describe("resetKitPowers", () => {
  it("zeroes every used power of the frequency in one update", async () => {
    const { a, updates } = actor({ "k1:shape": { used: 1 } });
    await resetKitPowers(a, "day");
    expect(updates).toEqual([{ "system.kitPowers.k1:shape": { used: 0 } }]);
  });
  it("makes no update when there is nothing to reset", async () => {
    const { a, updates } = actor({});
    await resetKitPowers(a, "day");
    await resetKitPowers(a, "encounter");
    expect(updates).toEqual([]);
  });
  it("tolerates an actor with no kitPowers object", async () => {
    const { a, updates } = actor({});
    delete (a.system as { kitPowers?: unknown }).kitPowers;
    await resetKitPowers(a, "day");
    expect(updates).toEqual([]);
  });
});
```

Append to `tests/lang/en-coverage.test.ts`:

```ts
describe("lang/en.json — SP11 Plan B (kit powers)", () => {
  it("resolves the kit-power sheet and chat keys", () => {
    for (const key of [
      "ADND2E.sheet.kits.powers",
      "ADND2E.sheet.kits.use",
      "ADND2E.sheet.kits.resetPower",
      "ADND2E.sheet.kits.newDay",
      "ADND2E.sheet.kits.newEncounter",
      "ADND2E.sheet.kits.noUsesLeft",
      "ADND2E.sheet.kits.per.day",
      "ADND2E.sheet.kits.per.week",
      "ADND2E.sheet.kits.per.encounter",
      "ADND2E.sheet.kits.per.at-will",
      "ADND2E.chat.kitPower.title",
      "ADND2E.chat.kitPower.remaining",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

In `tests/templates/pc-sheet-bindings.test.ts` extend `PC_ONLY_ACTIONS` with `"useKitPower", "resetKitPower", "newDayKitPowers", "newEncounterKitPowers"` (the Kits panel sits inside `@root.pcActions`).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sheets/character/kit-power-actions.test.ts tests/lang`
Expected: FAIL (module missing; lang keys missing).

- [ ] **Step 3: Implement.**

Create `src/sheets/character/kit-power-actions.ts`:

```ts
import { TEMPLATE_PATH } from "../../constants";
import {
  buildPowerUseCardContext,
  canUsePower,
  powerKey,
  powerRemaining,
  resetKeys,
  spendPower,
  usageResetUpdate,
  usageSpendUpdate,
  usedCount,
  type PowerFrequency,
  type PowerUsage,
} from "../../core/kits";
import { activeKitEntries } from "../../data/derive/character/kits";

/* SP11 Plan B — kit powers. Foundry glue only; the rules live in
 * src/core/kits/powers.ts. Every write targets the acting actor's own
 * `system.kitPowers`, so a non-GM owner can Use a power. */

export interface KitPowerActor {
  name: string;
  img: string;
  items: Iterable<{ id: string; name: string; type: string; system: unknown }>;
  system: { kitPowers?: PowerUsage };
  update(data: Record<string, unknown>): Promise<unknown>;
}

function findPower(actor: KitPowerActor, kitId: string, powerId: string) {
  const kit = activeKitEntries(actor.items).find((k) => k.id === kitId);
  const power = kit?.powers.find((p) => p.id === powerId);
  return kit && power ? { kit, power } : null;
}

const usageOf = (actor: KitPowerActor): PowerUsage => actor.system.kitPowers ?? {};

/** Spends one use (at-will powers are free) and posts the chat card. */
export async function usePower(actor: KitPowerActor, kitId: string, powerId: string): Promise<void> {
  const found = findPower(actor, kitId, powerId);
  if (!found) return;
  const { power } = found;
  const used = usedCount(usageOf(actor), kitId, powerId);
  if (!canUsePower(power, used)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.kits.noUsesLeft"));
    return;
  }
  const next = spendPower(power, used);
  if (next !== used) await actor.update(usageSpendUpdate(powerKey(kitId, powerId), next));

  const context = buildPowerUseCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    power,
    remaining: powerRemaining(power, next),
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/kit-power-use.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as never);
}

/** Manual reset of one power's counter. */
export async function resetPower(actor: KitPowerActor, kitId: string, powerId: string): Promise<void> {
  if (!findPower(actor, kitId, powerId)) return;
  if (usedCount(usageOf(actor), kitId, powerId) === 0) return;
  await actor.update(usageResetUpdate([powerKey(kitId, powerId)]));
}

/** Zeroes every used power of one frequency across the actor's active kits (New day / New encounter / Rest). */
export async function resetKitPowers(actor: KitPowerActor, per: PowerFrequency): Promise<void> {
  const keys = resetKeys(activeKitEntries(actor.items), usageOf(actor), per);
  if (keys.length > 0) await actor.update(usageResetUpdate(keys));
}
```

Create `templates/chat/kit-power-use.hbs`:

```hbs
<div class="adnd2e chat-card kit-power-use">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{powerName}}</h3>
  </header>
  {{#if scope}}<p class="scope">{{scope}}</p>{{/if}}
  {{#each params}}<p class="param"><strong>{{this.key}}:</strong> {{this.value}}</p>{{/each}}
  <p class="hint">{{#if atWill}}{{localize 'ADND2E.sheet.kits.per.at-will'}}{{else}}{{localize 'ADND2E.chat.kitPower.remaining'}}: {{remaining}} / {{uses}} {{localize perKey}}{{/if}}</p>
</div>
```

`lang/en.json` — inside `ADND2E.sheet.kits` (after `"features": "Granted features",`) add:

```json
        "powers": "Powers",
        "use": "Use",
        "resetPower": "Reset",
        "newDay": "New day",
        "newEncounter": "New encounter",
        "noUsesLeft": "No uses of that power remain.",
        "per": {
          "day": "per day",
          "week": "per week",
          "encounter": "per encounter",
          "at-will": "at will"
        },
```

and inside `ADND2E.chat` (sibling of `turn`) add:

```json
      "kitPower": {
        "title": "Kit power",
        "remaining": "Remaining"
      },
```

`src/sheets/character/sheet.ts`:

1. Import: `import { resetKitPowers, resetPower, usePower } from "./kit-power-actions";` and `buildPowerRows` from `../../core/kits` (add to an existing core import or add one). Import `type PowerUsage` too if needed.
2. In the `kits` map (line ~392-403), add after `grantedFeatures: k.grantedFeatures,`:
   ```ts
      powers: buildPowerRows(k.id, k.powers, (this.document as unknown as { system: { kitPowers?: PowerUsage } }).system.kitPowers ?? {}),
   ```
3. Register four actions after `resetTurnAttempt:`:
   ```ts
      useKitPower: Adnd2eCharacterSheet.#onUseKitPower,
      resetKitPower: Adnd2eCharacterSheet.#onResetKitPower,
      newDayKitPowers: Adnd2eCharacterSheet.#onNewDayKitPowers,
      newEncounterKitPowers: Adnd2eCharacterSheet.#onNewEncounterKitPowers,
   ```
4. Change `#onRestSpellcasting` to:
   ```ts
  static async #onRestSpellcasting(this: Adnd2eCharacterSheet): Promise<void> {
    await restSpellcasting(this.document as never);
    await resetKitPowers(this.document as never, "day");
  }

  static async #onUseKitPower(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const { kitId, powerId } = target.dataset;
    if (kitId && powerId && this.isEditable) await usePower(this.document as never, kitId, powerId);
  }

  static async #onResetKitPower(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const { kitId, powerId } = target.dataset;
    if (kitId && powerId && this.isEditable) await resetPower(this.document as never, kitId, powerId);
  }

  static async #onNewDayKitPowers(this: Adnd2eCharacterSheet): Promise<void> {
    if (this.isEditable) await resetKitPowers(this.document as never, "day");
  }

  static async #onNewEncounterKitPowers(this: Adnd2eCharacterSheet): Promise<void> {
    if (this.isEditable) await resetKitPowers(this.document as never, "encounter");
  }
   ```

`src/sheets/item-row-actions.ts` — add `import { usagePruneUpdate, type PowerUsage } from "../core/kits";`, and in `deleteOwnedItem`, directly after the `if (item.type === "spell") { ... }` block add:

```ts
  if (item.type === "kit") {
    const usage = (actor.system as { kitPowers?: PowerUsage }).kitPowers ?? {};
    const prune = usagePruneUpdate(usage, item.id);
    if (Object.keys(prune).length > 0) await actor.update(prune);
  }
```

Update the file's header comment list with `- a kit: its kit-power use counters are pruned (pure \`usagePruneUpdate\`);`.

`templates/actor/pc/partials/pc-feature-panels.hbs` — inside the Kits `{{#each @root.kits as |k|}}` row (line 40-48), directly before the lock-gated `item-controls` line, insert:

```hbs
          {{#if k.powers.length}}
            <div class="kit-powers">
              <h5 class="kit-subhead">{{localize 'ADND2E.sheet.kits.powers'}}</h5>
              {{#each k.powers as |p|}}
                <div class="power-row" data-power-id="{{p.id}}">
                  <span class="name">{{p.name}}</span>
                  {{#if p.atWill}}<span class="uses">{{localize 'ADND2E.sheet.kits.per.at-will'}}</span>{{else}}<span class="uses">{{p.remaining}} / {{p.uses}} {{localize p.perKey}}</span>{{/if}}
                  {{#if p.scope}}<span class="effect">{{p.scope}}</span>{{/if}}
                  {{#each p.params as |q|}}<span class="effect">{{q.key}}: {{q.value}}</span>{{/each}}
                  <button type="button" class="kit-small" data-action="useKitPower" data-kit-id="{{k.id}}" data-power-id="{{p.id}}"{{#unless p.canUse}} disabled{{/unless}}>{{localize 'ADND2E.sheet.kits.use'}}</button>
                  {{#if p.canReset}}<button type="button" class="kit-small" data-action="resetKitPower" data-kit-id="{{k.id}}" data-power-id="{{p.id}}">{{localize 'ADND2E.sheet.kits.resetPower'}}</button>{{/if}}
                </div>
              {{/each}}
            </div>
          {{/if}}
```

and after the closing `{{/each}}` of the kits loop (before `</div>` of `kit-body`, line ~49-50) add:

```hbs
      <button type="button" class="kit-small" data-action="newDayKitPowers">{{localize 'ADND2E.sheet.kits.newDay'}}</button>
      <button type="button" class="kit-small" data-action="newEncounterKitPowers">{{localize 'ADND2E.sheet.kits.newEncounter'}}</button>
```

The template uses `p.perKey`, so in the sheet context map (step 2 above) build the rows as `buildPowerRows(k.id, k.powers, usage).map((p) => ({ ...p, perKey: \`ADND2E.sheet.kits.per.${p.per}\` }))` (no Handlebars helper is needed).

- [ ] **Step 4: Run to verify they pass, plus typecheck and lint**

Run: `npx vitest run tests/sheets tests/lang tests/templates && npx tsc --noEmit -p tsconfig.json && npx eslint src tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src templates lang tests
git commit -m "feat(kits): use/reset kit powers from the PC Kits panel, rest reset, prune on kit delete

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sample content, importer check, README

**Files:**
- Modify: `packs/kits/_source/sample-duelist.json`, `packs/kits/_source/sample-zealot.json`, `packs/kits/_source/_MANIFEST.md`
- Modify: `tests/packs/content.test.ts` (the `kits pack content` describe, ~line 187)
- Modify: `README.md`
- Check: `src/data/import/envelope.ts`

**Interfaces:** Consumes `normalizePowers`, `POWER_FREQUENCIES` (Task 1).

- [ ] **Step 1: Write the failing test.** In `tests/packs/content.test.ts` add `normalizePowers` to the `../../src/core/kits` import (alongside `EQUIPMENT_MODES`) and add inside `describe("kits pack content")`:

```ts
  it("every kit's powers are well-formed and at least one kit ships a finite and an at-will power", () => {
    let finite = 0;
    let atWill = 0;
    for (const d of items) {
      const raw = (sys(d) as { powers: { id: string }[] }).powers;
      expect(Array.isArray(raw), String(d.name)).toBe(true);
      const kept = normalizePowers(raw);
      expect(kept, `${String(d.name)} has a malformed or duplicate power`).toHaveLength(raw.length);
      for (const p of kept) p.per === "at-will" ? atWill++ : finite++;
    }
    expect(finite).toBeGreaterThan(0);
    expect(atWill).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/packs/content.test.ts`
Expected: FAIL (`powers` undefined on the sample kits).

- [ ] **Step 3: Implement.**

In `sample-duelist.json` replace `"grantedFeatures": ["Sample Duelist Stance"]` with:

```json
    "grantedFeatures": ["Sample Duelist Stance"],
    "powers": [
      { "id": "riposte-reserve", "name": "Riposte Reserve", "uses": 3, "per": "encounter", "scope": "melee", "params": [] }
    ]
```

In `sample-zealot.json` replace `"grantedFeatures": []` with:

```json
    "grantedFeatures": [],
    "powers": [
      { "id": "zealous-shape", "name": "Zealous Shape", "uses": 2, "per": "day", "scope": "mammals", "params": [{ "key": "duration", "value": "1 hour" }] },
      { "id": "sense-faith", "name": "Sense Faith", "uses": 0, "per": "at-will", "scope": "", "params": [] }
    ]
```

In `sample-hedge-mage.json` add `"powers": []` after `"grantedFeatures": []` (add the comma). Append to `_MANIFEST.md`'s intro sentence: ` Plan B adds tracked powers: Duelist (3/encounter), Zealot (2/day with params, plus an at-will power).` and extend the "shows off" cells for those two rows with `, a tracked power`.

Importer check: open `src/data/import/envelope.ts`. If it validates item `system` against a per-type field list, add `powers` for `kit`; if it passes `system` through to the DataModel (expected), no change. Record which in the commit message.

README: in the Sub-project 11 row, note Plan B (parametrized granted powers) complete; Plan C (base-class overrides) still pending.

- [ ] **Step 4: Rebuild the pack source if the repo has a build step for it and run the suite**

Run: `npx vitest run tests/packs tests/data && npm run build 2>&1 | tail -5` (use whatever pack-build script `package.json` defines; if none, skip the build).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packs README.md tests/packs src/data/import
git commit -m "feat(kits): sample kit powers, manifest, README (SP11 Plan B)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verification gates (no new code unless a gate fails)

- [ ] **Step 1: Full suite and the coverage gate.** Run: `npm run test:coverage` and `npx tsc --noEmit -p tsconfig.json` and `npx eslint src tests`. Expected: all green, 100% lines/statements/functions. If `src/core/kits/powers.ts` shows an uncovered line, add the missing case to `tests/core/kits/powers.test.ts`.

- [ ] **Step 2: Whole-branch review.** Use superpowers:requesting-code-review on the full branch diff (`git diff master...HEAD`). Treat any Critical/Important as blocking; fix with a test first. Pay particular attention to: the `-=` prune on kit delete, a non-GM seat's ability to Use, stale keys, and the `ObjectField` merge-vs-replace behavior.

- [ ] **Step 3: Gated dev-world check (user runs it by hand, guided in chat; Foundry GUI is not available to the agent).** Required, including a **non-GM player seat**:
  1. Import/drop Sample Zealot on a cleric; its Powers block shows "2 / 2 per day" with scope and the `duration` param, and an at-will power with Use only.
  2. Use Zealous Shape twice: counter goes 1/2 then 0/2, chat card posts each time, Use disables at zero; a Reset button appears.
  3. Reset it by hand → 2/2.
  4. Use again, press the spell **Rest** button → day powers reset; encounter powers are untouched.
  5. Use Riposte Reserve (3/encounter) on a fighter; **New encounter** resets it; **New day** does not.
  6. As a non-GM player seat: Use, Reset, New day all work and the chat card posts.
  7. Delete the kit (🗑) → its counters are gone (`actor.system.kitPowers` has no `<kitId>:` keys), no console errors; re-adding the kit shows fresh counts.
  8. Import a kit whose power has an invalid `per` or a duplicate id → that power is simply not shown; the rest of the kit works.
  9. The Character NPC and Monster NPC sheets still open without errors (they don't show the Kits panel).

- [ ] **Step 4: Push and open the PR** (branch-finishing preference: always push + PR, never ask). PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do NOT retry `gh pr merge` if blocked — ask the user to merge.

---

## Self-Review notes

- Spec coverage: data model → Task 2; per-actor tracking + prune → Tasks 1-3; pure core → Task 1; sheet wiring (Use, reset, New day/encounter, spell-Rest hook, chat card) → Task 3; `week` resets per-power only → Task 1 `resetKeys` is generic but no `week` button exists, matching the spec; content/importer/README → Task 4; tests/gates → Task 5. Character NPC: the Kits panel lives inside `@root.pcActions`, so it is PC-only and the NPC sheet is intentionally untouched (spec: "if not, left out").
- Names are consistent across tasks: `KitPower`, `PowerUsage`, `usageSpendUpdate`, `usageResetUpdate`, `usagePruneUpdate`, `resetKeys`, `buildPowerRows`, `buildPowerUseCardContext`, `KIT_POWER_FREQUENCIES`, sheet actions `useKitPower`/`resetKitPower`/`newDayKitPowers`/`newEncounterKitPowers`.
