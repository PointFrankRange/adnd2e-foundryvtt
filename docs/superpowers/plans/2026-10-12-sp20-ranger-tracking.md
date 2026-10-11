# SP20 Ranger Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ranger on the PC sheet can press **Track…**, fill in a themed dialog (terrain, illumination, group size, trail age, rain, helpers, special cases), and get one chat card with the modified Tracking score, the d20 tracking roll, the Table 18 movement limit and (optionally) the identification roll with the information the ranger's level reveals. Primary terrain and the specialization option are stored on the ranger.

**Architecture:** A pure rules module `src/core/tracking/` (Tables 15-19, score builder, check, movement band, cumulative identification, form parser, chat-card context) in the 100% coverage gate. A `system.tracking {primaryTerrain, specialized}` field on the actor common schema (defaults only, no migration). Foundry glue `src/sheets/character/tracking-actions.ts` builds the panel view, runs the `themedPrompt` dialog, rolls and posts the card. A PC-only Tracking panel on the Features tab (ranger class entries only).

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-12-adnd2e-sp20-ranger-tracking-design.md`

## Global Constraints

- Source: PHBR11 (The Complete Ranger's Handbook) Ranger Abilities ch., Tracking pp.14-17, Tables 15-19; primary terrain pp.12-13. **Content policy:** mechanical values only, short own-wording labels, no rulebook prose.
- Score = Wisdom + modifiers. Terrain (Table 15, use one): fresh snow +6; soft/muddy +4; thick brush/dense jungle +3; forests/fields/dusty indoor +2; normal 0; desert/dry sand −2; swamp −5; rock/ice/stone/shallow water −10. Illumination (Table 16, use one): good 0; twilight/light fog/single torch −3; full-moon night/moderate fog −6; overcast night/dense fog/blizzard/blowing sand −10. Special (Table 17, all that apply): +1 per 2 creatures tracked (floor); +1 per 3 ranger levels (floor); +1 per assisting tracker, total capped at the level bonus; +1 animal follower; +2 trail in a specialized ranger's primary terrain; −1 per 12 full hours since the trail was made; −5 per hour of rain/snow/sleet since; −5 quarry hides its trail; −2 more if the quarry hides AND is a specialized ranger in his primary terrain. Non-natural surroundings halve the FINAL modified score (floor) — a stated, tested choice (the book is silent on order).
- Check: success iff `roll <= score` and `roll !== 20`; score `<= 0` means tracking is impossible (nothing is rolled). Movement (Table 18): score 1-6 → quarter, 7-14 → half, 15+ → threeQuarters. Identification uses the SAME score, rolled only after a tracking success and only when the dialog's "Also attempt identification" box is ticked (default on); information is cumulative by ranger level: 1 general type; 3 specific type and heading; 5 probable number; 7 size or age; 8 pace; 9 how recent; 10 special conditions.
- Worked examples (tests): level 7, Wis 15, normal ground, good light, 1 creature → 17. Same ranger, 4 creatures, fresh snow, twilight, 24 h old → 15+2+2+6−3−2 = 20. Rocky + full-moon night → 15+2−10−6 = 1, quarter movement.
- `system.tracking.primaryTerrain` is `""` or one of aquatic, arctic, desert, forest, hill, jungle, mountain, plain, swamp; `specialized` is a boolean. The "trail in my primary terrain" dialog box exists only for a specialized ranger with a primary terrain set. Trail found/lost state is NOT stored.
- The panel is PC-sheet only (`@root.pcActions`) and shows only when the character has a ranger class entry (`chassisId: "ranger"`, level > 0). The Character NPC sheet must render unchanged. Track is blocked while `canAct(actor.statuses)` is false (the #142 gate).
- Dialogs use `themedPrompt` (`src/dialogs/themed-dialog-foundry.ts`), never `DialogV2` directly (a guard test enforces it). The chat card reuses existing chat classes (`formula`, `result` + `hit`/`miss`, `hint`, `modifiers`) so the stylesheet census needs no new rule; the chat template count assertion goes 16 → 17.
- Arrays/objects in schema `initial` must be functions (none are needed here). New schema fields have initials and need no migration.
- Out of scope: persistent tracking state, pre-conditions/interruption triggers, Character NPC rangers, Table 14 random terrain, other primary-terrain features, the PH Tracking NWP for non-rangers.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Files in this repo may be CRLF: check line endings before any scripted replacement (a `str.replace` on CRLF text silently no-ops); prefer the Edit tool.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Pure tracking rules

**Files:**
- Create: `src/core/tracking/rules.ts`
- Create: `src/core/tracking/index.ts`
- Modify: `src/core/index.ts` (add `export * from "./tracking";` after the `./psionics` line)
- Create: `tests/core/tracking/rules.test.ts`

**Interfaces — produces (all exported from `src/core/tracking`):**
```ts
export const TRACKING_TERRAINS: readonly ["freshSnow","softGround","thickBrush","forestField","normal","desert","swamp","rocky"];
export type TrackingTerrain;
export const TERRAIN_MODIFIERS: Readonly<Record<TrackingTerrain, number>>;
export const TRACKING_ILLUMINATIONS: readonly ["good","twilight","moonlit","dark"];
export type TrackingIllumination;
export const ILLUMINATION_MODIFIERS: Readonly<Record<TrackingIllumination, number>>;
export const PRIMARY_TERRAINS: readonly ["aquatic","arctic","desert","forest","hill","jungle","mountain","plain","swamp"];
export type PrimaryTerrain;
export type MovementLimit = "quarter" | "half" | "threeQuarters";
export type IdentificationId = "generalType" | "specificTypeHeading" | "number" | "sizeAge" | "pace" | "recent" | "conditions";
export interface TrackingInput { wisdom: number; level: number; terrain: TrackingTerrain; illumination: TrackingIllumination; creaturesTracked: number; assistingTrackers: number; animalFollower: boolean; trailInPrimaryTerrain: boolean; hoursSinceMade: number; rainHours: number; quarryHidesTrail: boolean; quarryIsSpecializedHiding: boolean; nonNatural: boolean }
export interface ModifierRow { labelKey: string; amount: number }
export interface TrackingScore { score: number; total: number; halved: boolean; breakdown: ModifierRow[] }
export function trackingScore(input: TrackingInput): TrackingScore;
export function canTrack(score: number): boolean;
export function resolveCheck(roll: number, score: number): boolean;
export function movementLimit(score: number): MovementLimit | null;
export function identificationInfo(level: number): IdentificationId[];
export interface TrackingFormValues extends Omit<TrackingInput, "wisdom" | "level"> { identify: boolean }
export function trackingInputFromForm(raw: Record<string, unknown>, specialized: boolean): TrackingFormValues;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/core/tracking/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ILLUMINATION_MODIFIERS, PRIMARY_TERRAINS, TERRAIN_MODIFIERS, TRACKING_ILLUMINATIONS, TRACKING_TERRAINS,
  canTrack, identificationInfo, movementLimit, resolveCheck, trackingInputFromForm, trackingScore, type TrackingInput,
} from "../../../src/core/tracking";

const base: TrackingInput = {
  wisdom: 15, level: 7, terrain: "normal", illumination: "good", creaturesTracked: 1, assistingTrackers: 0,
  animalFollower: false, trailInPrimaryTerrain: false, hoursSinceMade: 0, rainHours: 0,
  quarryHidesTrail: false, quarryIsSpecializedHiding: false, nonNatural: false,
};
const score = (over: Partial<TrackingInput> = {}) => trackingScore({ ...base, ...over }).score;

describe("tables", () => {
  it("terrain modifiers are Table 15", () => {
    expect(TERRAIN_MODIFIERS).toEqual({ freshSnow: 6, softGround: 4, thickBrush: 3, forestField: 2, normal: 0, desert: -2, swamp: -5, rocky: -10 });
    expect([...TRACKING_TERRAINS]).toEqual(Object.keys(TERRAIN_MODIFIERS));
  });
  it("illumination modifiers are Table 16", () => {
    expect(ILLUMINATION_MODIFIERS).toEqual({ good: 0, twilight: -3, moonlit: -6, dark: -10 });
    expect([...TRACKING_ILLUMINATIONS]).toEqual(Object.keys(ILLUMINATION_MODIFIERS));
  });
  it("lists the nine primary terrains", () => {
    expect([...PRIMARY_TERRAINS]).toEqual(["aquatic", "arctic", "desert", "forest", "hill", "jungle", "mountain", "plain", "swamp"]);
  });
});

describe("trackingScore", () => {
  it("worked example 1: level 7, Wis 15, normal ground, good light = 17", () => {
    expect(score()).toBe(17);
  });
  it("worked example 2: 4 creatures through fresh snow at twilight, 24 hours old = 20", () => {
    expect(score({ creaturesTracked: 4, terrain: "freshSnow", illumination: "twilight", hoursSinceMade: 24 })).toBe(20);
  });
  it("worked example 3: rocky terrain on a full-moon night = 1", () => {
    expect(score({ terrain: "rocky", illumination: "moonlit" })).toBe(1);
  });
  it.each(Object.entries(TERRAIN_MODIFIERS))("terrain %s adds %i", (terrain, amount) => {
    expect(score({ terrain: terrain as TrackingInput["terrain"] })).toBe(17 + amount);
  });
  it.each(Object.entries(ILLUMINATION_MODIFIERS))("illumination %s adds %i", (illumination, amount) => {
    expect(score({ illumination: illumination as TrackingInput["illumination"] })).toBe(17 + amount);
  });
  it("adds +1 per three ranger levels, rounded down", () => {
    expect([2, 3, 6, 7, 9].map((level) => score({ level }))).toEqual([15, 16, 17, 17, 18]);
  });
  it("adds +1 per two creatures, rounded down", () => {
    expect([1, 2, 3, 5].map((n) => score({ creaturesTracked: n }))).toEqual([17, 18, 18, 19]);
  });
  it("adds one per assisting tracker up to the level bonus", () => {
    expect(score({ assistingTrackers: 1 })).toBe(18);
    expect(score({ assistingTrackers: 5 })).toBe(19); // level 7 bonus is 2
    expect(score({ level: 2, assistingTrackers: 3 })).toBe(15); // level 2 bonus is 0
  });
  it("adds 1 for an animal follower and 2 for a trail in primary terrain", () => {
    expect(score({ animalFollower: true })).toBe(18);
    expect(score({ trailInPrimaryTerrain: true })).toBe(19);
  });
  it("subtracts 1 per full 12 hours since the trail was made", () => {
    expect([0, 11, 12, 25].map((h) => score({ hoursSinceMade: h }))).toEqual([17, 17, 16, 15]);
  });
  it("subtracts 5 per hour of rain, snow or sleet", () => {
    expect(score({ rainHours: 2 })).toBe(7);
  });
  it("subtracts 5 when the quarry hides its trail, 7 when it is a specialized ranger in primary terrain", () => {
    expect(score({ quarryHidesTrail: true })).toBe(12);
    expect(score({ quarryHidesTrail: true, quarryIsSpecializedHiding: true })).toBe(10);
    expect(score({ quarryIsSpecializedHiding: true })).toBe(17); // not hiding: no extra penalty
  });
  it("halves the final score, rounding down, in non-natural surroundings", () => {
    const r = trackingScore({ ...base, nonNatural: true });
    expect(r).toMatchObject({ score: 8, total: 17, halved: true });
    expect(trackingScore({ ...base, terrain: "rocky", illumination: "moonlit", nonNatural: true }).score).toBe(0);
  });
  it("does not halve in natural surroundings", () => {
    expect(trackingScore(base)).toMatchObject({ score: 17, total: 17, halved: false });
  });
  it("clamps negative and non-finite counts to zero", () => {
    expect(score({ creaturesTracked: -4, rainHours: -2, hoursSinceMade: Number.NaN, assistingTrackers: -1 })).toBe(17);
  });
  it("lists the non-zero modifiers in table order, wisdom first", () => {
    const r = trackingScore({ ...base, creaturesTracked: 4, terrain: "freshSnow", illumination: "twilight", hoursSinceMade: 24 });
    expect(r.breakdown).toEqual([
      { labelKey: "ADND2E.tracking.mod.wisdom", amount: 15 },
      { labelKey: "ADND2E.tracking.mod.level", amount: 2 },
      { labelKey: "ADND2E.trackingTerrains.freshSnow", amount: 6 },
      { labelKey: "ADND2E.trackingIlluminations.twilight", amount: -3 },
      { labelKey: "ADND2E.tracking.mod.creatures", amount: 2 },
      { labelKey: "ADND2E.tracking.mod.age", amount: -2 },
    ]);
  });
});

describe("canTrack and resolveCheck", () => {
  it("tracking is possible only above zero", () => {
    expect([-3, 0, 1, 17].map(canTrack)).toEqual([false, false, true, true]);
  });
  it("succeeds on a roll up to the score, including equal", () => {
    expect(resolveCheck(17, 17)).toBe(true);
    expect(resolveCheck(18, 17)).toBe(false);
    expect(resolveCheck(1, 1)).toBe(true);
  });
  it("a natural 20 always fails", () => {
    expect(resolveCheck(20, 25)).toBe(false);
    expect(resolveCheck(19, 25)).toBe(true);
  });
  it("never succeeds with a score of zero or less", () => {
    expect(resolveCheck(1, 0)).toBe(false);
  });
});

describe("movementLimit", () => {
  it("returns the Table 18 bands", () => {
    expect([1, 6].map(movementLimit)).toEqual(["quarter", "quarter"]);
    expect([7, 14].map(movementLimit)).toEqual(["half", "half"]);
    expect([15, 30].map(movementLimit)).toEqual(["threeQuarters", "threeQuarters"]);
  });
  it("is null below 1", () => {
    expect([0, -3].map(movementLimit)).toEqual([null, null]);
  });
});

describe("identificationInfo", () => {
  it("is cumulative by ranger level", () => {
    expect(identificationInfo(0)).toEqual([]);
    expect(identificationInfo(1)).toEqual(["generalType"]);
    expect(identificationInfo(2)).toEqual(["generalType"]);
    expect(identificationInfo(3)).toEqual(["generalType", "specificTypeHeading"]);
    expect(identificationInfo(4)).toEqual(["generalType", "specificTypeHeading"]);
    expect(identificationInfo(5)).toEqual(["generalType", "specificTypeHeading", "number"]);
    expect(identificationInfo(6)).toHaveLength(3);
    expect(identificationInfo(7)).toHaveLength(4);
    expect(identificationInfo(8)).toHaveLength(5);
    expect(identificationInfo(9)).toHaveLength(6);
    expect(identificationInfo(10)).toEqual(["generalType", "specificTypeHeading", "number", "sizeAge", "pace", "recent", "conditions"]);
    expect(identificationInfo(15)).toHaveLength(7);
  });
});

describe("trackingInputFromForm", () => {
  it("reads a full form", () => {
    expect(
      trackingInputFromForm(
        {
          terrain: "swamp", illumination: "dark", creaturesTracked: "6", assistingTrackers: 2, hoursSinceMade: "30", rainHours: 1,
          animalFollower: true, nonNatural: "on", quarryHidesTrail: true, quarryIsSpecializedHiding: true, trailInPrimaryTerrain: true, identify: false,
        },
        true,
      ),
    ).toEqual({
      terrain: "swamp", illumination: "dark", creaturesTracked: 6, assistingTrackers: 2, hoursSinceMade: 30, rainHours: 1,
      animalFollower: true, nonNatural: true, quarryHidesTrail: true, quarryIsSpecializedHiding: true, trailInPrimaryTerrain: true, identify: false,
    });
  });
  it("defaults an empty or invalid form: normal ground, good light, identification on", () => {
    expect(trackingInputFromForm({ terrain: "lava", illumination: 4, creaturesTracked: "abc", rainHours: -3 }, false)).toEqual({
      terrain: "normal", illumination: "good", creaturesTracked: 0, assistingTrackers: 0, hoursSinceMade: 0, rainHours: 0,
      animalFollower: false, nonNatural: false, quarryHidesTrail: false, quarryIsSpecializedHiding: false, trailInPrimaryTerrain: false, identify: true,
    });
  });
  it("ignores the primary-terrain box unless the ranger is specialized", () => {
    expect(trackingInputFromForm({ trailInPrimaryTerrain: true }, false).trailInPrimaryTerrain).toBe(false);
    expect(trackingInputFromForm({ trailInPrimaryTerrain: true }, true).trailInPrimaryTerrain).toBe(true);
  });
});
```

Run `npx vitest run tests/core/tracking/rules.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement**

Create `src/core/tracking/rules.ts`:

```ts
// Ranger tracking (SP20; PHBR11 pp.14-17, Tables 15-19). Pure rules, no Foundry.

export const TRACKING_TERRAINS = ["freshSnow", "softGround", "thickBrush", "forestField", "normal", "desert", "swamp", "rocky"] as const;
export type TrackingTerrain = (typeof TRACKING_TERRAINS)[number];

/** Table 15 — use the one that applies. */
export const TERRAIN_MODIFIERS: Readonly<Record<TrackingTerrain, number>> = {
  freshSnow: 6, softGround: 4, thickBrush: 3, forestField: 2, normal: 0, desert: -2, swamp: -5, rocky: -10,
};

export const TRACKING_ILLUMINATIONS = ["good", "twilight", "moonlit", "dark"] as const;
export type TrackingIllumination = (typeof TRACKING_ILLUMINATIONS)[number];

/** Table 16 — use the one that applies. */
export const ILLUMINATION_MODIFIERS: Readonly<Record<TrackingIllumination, number>> = {
  good: 0, twilight: -3, moonlit: -6, dark: -10,
};

/** Table 14's nine terrains a ranger may specialize in (optional rule). */
export const PRIMARY_TERRAINS = ["aquatic", "arctic", "desert", "forest", "hill", "jungle", "mountain", "plain", "swamp"] as const;
export type PrimaryTerrain = (typeof PRIMARY_TERRAINS)[number];

export type MovementLimit = "quarter" | "half" | "threeQuarters";
export type IdentificationId = "generalType" | "specificTypeHeading" | "number" | "sizeAge" | "pace" | "recent" | "conditions";

export interface TrackingInput {
  wisdom: number;
  level: number;
  terrain: TrackingTerrain;
  illumination: TrackingIllumination;
  creaturesTracked: number;
  assistingTrackers: number;
  animalFollower: boolean;
  trailInPrimaryTerrain: boolean;
  hoursSinceMade: number;
  rainHours: number;
  quarryHidesTrail: boolean;
  quarryIsSpecializedHiding: boolean;
  nonNatural: boolean;
}

export interface ModifierRow {
  labelKey: string;
  amount: number;
}

export interface TrackingScore {
  /** the modified score the d20 is rolled against (after any halving) */
  score: number;
  /** the sum before the non-natural halving */
  total: number;
  halved: boolean;
  breakdown: ModifierRow[];
}

const count = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Table 15-17: Wisdom plus every applicable modifier; non-natural surroundings halve the final score (rounded down). */
export function trackingScore(input: TrackingInput): TrackingScore {
  const levelBonus = Math.floor(count(input.level) / 3);
  const breakdown: ModifierRow[] = [{ labelKey: "ADND2E.tracking.mod.wisdom", amount: Math.trunc(input.wisdom) }];
  const add = (labelKey: string, amount: number): void => {
    if (amount !== 0) breakdown.push({ labelKey, amount });
  };
  add("ADND2E.tracking.mod.level", levelBonus);
  add(`ADND2E.trackingTerrains.${input.terrain}`, TERRAIN_MODIFIERS[input.terrain]);
  add(`ADND2E.trackingIlluminations.${input.illumination}`, ILLUMINATION_MODIFIERS[input.illumination]);
  add("ADND2E.tracking.mod.creatures", Math.floor(count(input.creaturesTracked) / 2));
  add("ADND2E.tracking.mod.assistants", Math.min(count(input.assistingTrackers), levelBonus));
  add("ADND2E.tracking.mod.animal", input.animalFollower ? 1 : 0);
  add("ADND2E.tracking.mod.primaryTerrain", input.trailInPrimaryTerrain ? 2 : 0);
  add("ADND2E.tracking.mod.age", -Math.floor(count(input.hoursSinceMade) / 12));
  add("ADND2E.tracking.mod.rain", -5 * count(input.rainHours));
  add("ADND2E.tracking.mod.hides", input.quarryHidesTrail ? -5 : 0);
  add("ADND2E.tracking.mod.specializedHiding", input.quarryHidesTrail && input.quarryIsSpecializedHiding ? -2 : 0);
  const total = breakdown.reduce((sum, row) => sum + row.amount, 0);
  return { score: input.nonNatural ? Math.floor(total / 2) : total, total, halved: input.nonNatural, breakdown };
}

/** Tracking is possible only with a modified score above zero. */
export const canTrack = (score: number): boolean => score > 0;

/** d20 at or under the score succeeds; a natural 20 always fails. */
export const resolveCheck = (roll: number, score: number): boolean => roll <= score && roll !== 20;

/** Table 18: the fraction of normal movement the ranger can keep while tracking. */
export function movementLimit(score: number): MovementLimit | null {
  if (score < 1) return null;
  if (score <= 6) return "quarter";
  return score <= 14 ? "half" : "threeQuarters";
}

const IDENTIFICATION_STEPS: readonly { minLevel: number; id: IdentificationId }[] = [
  { minLevel: 1, id: "generalType" },
  { minLevel: 3, id: "specificTypeHeading" },
  { minLevel: 5, id: "number" },
  { minLevel: 7, id: "sizeAge" },
  { minLevel: 8, id: "pace" },
  { minLevel: 9, id: "recent" },
  { minLevel: 10, id: "conditions" },
];

/** Table 19: cumulative — a ranger gets every row up to his level. */
export const identificationInfo = (level: number): IdentificationId[] =>
  IDENTIFICATION_STEPS.filter((s) => level >= s.minLevel).map((s) => s.id);

export interface TrackingFormValues extends Omit<TrackingInput, "wisdom" | "level"> {
  /** also attempt the identification check after a tracking success */
  identify: boolean;
}

const flag = (v: unknown, fallback = false): boolean => (v === undefined ? fallback : v === true || v === "true" || v === "on" || v === 1);
const num = (v: unknown): number => count(Number(v));

/** Coerces the dialog's form data (strings, checkboxes) into typed input; invalid choices fall back to normal ground / good light. */
export function trackingInputFromForm(raw: Record<string, unknown>, specialized: boolean): TrackingFormValues {
  const terrain = TRACKING_TERRAINS.find((t) => t === raw.terrain) ?? "normal";
  const illumination = TRACKING_ILLUMINATIONS.find((i) => i === raw.illumination) ?? "good";
  return {
    terrain,
    illumination,
    creaturesTracked: num(raw.creaturesTracked),
    assistingTrackers: num(raw.assistingTrackers),
    animalFollower: flag(raw.animalFollower),
    trailInPrimaryTerrain: specialized && flag(raw.trailInPrimaryTerrain),
    hoursSinceMade: num(raw.hoursSinceMade),
    rainHours: num(raw.rainHours),
    quarryHidesTrail: flag(raw.quarryHidesTrail),
    quarryIsSpecializedHiding: flag(raw.quarryIsSpecializedHiding),
    nonNatural: flag(raw.nonNatural),
    identify: flag(raw.identify, true),
  };
}
```

Create `src/core/tracking/index.ts`:
```ts
export * from "./rules";
```
Add `export * from "./tracking";` to `src/core/index.ts` after the `./psionics` line (check the file for a name collision first: `grep -rn "export.* canTrack\|MovementLimit\|ModifierRow" src/core`; if a name collides, rename the new export with a `Tracking` prefix and update tests).

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run tests/core/tracking && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green; `src/core/tracking/rules.ts` 100% statements.

```bash
git add src/core/tracking src/core/index.ts tests/core/tracking
git commit -m "feat(tracking): pure ranger tracking rules, tables 15-19 (#88)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Chat-card context, template and copy

**Files:**
- Create: `src/core/tracking/card.ts` + `tests/core/tracking/card.test.ts`; re-export from `src/core/tracking/index.ts`
- Create: `templates/chat/ranger-tracking.hbs`
- Modify: `tests/styles/chat-classes.test.ts` (template count 16 → 17 and its title "finds all seventeen chat templates")
- Modify: `lang/en.json` (rule labels `ADND2E.trackingTerrains.*`, `ADND2E.trackingIlluminations.*`, `ADND2E.primaryTerrains.*`, `ADND2E.tracking.*`; chat copy `ADND2E.chat.tracking.*`)

**Interfaces:**
- Consumes: Task 1 (`canTrack`, `resolveCheck`, `movementLimit`, `identificationInfo`, `ModifierRow`, `IdentificationId`, `MovementLimit`).
- Produces (`src/core/tracking/card.ts`):
```ts
export interface TrackingCardInput {
  actorName: string; actorImg: string; level: number;
  score: number; halved: boolean; breakdown: ModifierRow[];
  /** the tracking d20; null when tracking was impossible (no roll made) */
  roll: number | null;
  /** the identification d20; null when it was not attempted */
  identifyRoll: number | null;
}
export interface TrackingCardContext {
  actorName: string; actorImg: string; headlineKey: string;
  score: number; halved: boolean; breakdown: ModifierRow[];
  possible: boolean; roll: number | null; success: boolean; resultKey: string;
  movementKey: string;            // "" when tracking is impossible
  identification: null | { roll: number; success: boolean; resultKey: string; infoKeys: string[] };
}
export function buildTrackingCardContext(input: TrackingCardInput): TrackingCardContext;
```
Keys: `headlineKey` `ADND2E.chat.tracking.title`; `resultKey` `ADND2E.chat.tracking.notPossible` / `.found` / `.lost`; identification `resultKey` `ADND2E.chat.tracking.identified` / `.notIdentified`; `movementKey` `ADND2E.tracking.movement.<limit>`; `infoKeys` `ADND2E.tracking.info.<id>` (empty on an identification failure).

- [ ] **Step 1: Write the failing test**

Create `tests/core/tracking/card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTrackingCardContext, trackingScore } from "../../../src/core/tracking";

const sc = trackingScore({
  wisdom: 15, level: 7, terrain: "normal", illumination: "good", creaturesTracked: 1, assistingTrackers: 0, animalFollower: false,
  trailInPrimaryTerrain: false, hoursSinceMade: 0, rainHours: 0, quarryHidesTrail: false, quarryIsSpecializedHiding: false, nonNatural: false,
});
const input = { actorName: "Rowan", actorImg: "r.png", level: 7, score: sc.score, halved: sc.halved, breakdown: sc.breakdown, roll: 10, identifyRoll: null };

describe("buildTrackingCardContext", () => {
  it("reports a found trail with its movement limit", () => {
    expect(buildTrackingCardContext(input)).toEqual({
      actorName: "Rowan", actorImg: "r.png", headlineKey: "ADND2E.chat.tracking.title",
      score: 17, halved: false, breakdown: sc.breakdown,
      possible: true, roll: 10, success: true, resultKey: "ADND2E.chat.tracking.found",
      movementKey: "ADND2E.tracking.movement.threeQuarters", identification: null,
    });
  });
  it("reports a lost trail on a miss and on a natural 20", () => {
    expect(buildTrackingCardContext({ ...input, roll: 18 })).toMatchObject({ success: false, resultKey: "ADND2E.chat.tracking.lost" });
    expect(buildTrackingCardContext({ ...input, roll: 20 })).toMatchObject({ success: false, resultKey: "ADND2E.chat.tracking.lost" });
  });
  it("reports an impossible track (score zero or less) with no roll and no movement limit", () => {
    expect(buildTrackingCardContext({ ...input, score: 0, roll: null })).toMatchObject({
      possible: false, roll: null, success: false, resultKey: "ADND2E.chat.tracking.notPossible", movementKey: "", identification: null,
    });
  });
  it("lists the cumulative information on an identification success", () => {
    const ctx = buildTrackingCardContext({ ...input, level: 5, identifyRoll: 3 });
    expect(ctx.identification).toEqual({
      roll: 3, success: true, resultKey: "ADND2E.chat.tracking.identified",
      infoKeys: ["ADND2E.tracking.info.generalType", "ADND2E.tracking.info.specificTypeHeading", "ADND2E.tracking.info.number"],
    });
  });
  it("gives no information on an identification failure", () => {
    expect(buildTrackingCardContext({ ...input, identifyRoll: 19 }).identification).toEqual({
      roll: 19, success: false, resultKey: "ADND2E.chat.tracking.notIdentified", infoKeys: [],
    });
  });
});
```
Run `npx vitest run tests/core/tracking/card.test.ts` → FAIL.

- [ ] **Step 2: The pure builder**

Create `src/core/tracking/card.ts`:

```ts
// Chat-card context for a ranger tracking check (SP20). Pure.
import { canTrack, identificationInfo, movementLimit, resolveCheck, type ModifierRow } from "./rules";

export interface TrackingCardInput {
  actorName: string;
  actorImg: string;
  level: number;
  score: number;
  halved: boolean;
  breakdown: ModifierRow[];
  /** the tracking d20; null when tracking was impossible (no roll made) */
  roll: number | null;
  /** the identification d20; null when it was not attempted */
  identifyRoll: number | null;
}

export interface TrackingCardContext {
  actorName: string;
  actorImg: string;
  headlineKey: string;
  score: number;
  halved: boolean;
  breakdown: ModifierRow[];
  possible: boolean;
  roll: number | null;
  success: boolean;
  resultKey: string;
  movementKey: string;
  identification: null | { roll: number; success: boolean; resultKey: string; infoKeys: string[] };
}

export function buildTrackingCardContext(input: TrackingCardInput): TrackingCardContext {
  const possible = canTrack(input.score);
  const success = possible && input.roll !== null && resolveCheck(input.roll, input.score);
  const limit = possible ? movementLimit(input.score) : null;
  let identification: TrackingCardContext["identification"] = null;
  if (input.identifyRoll !== null) {
    const identified = resolveCheck(input.identifyRoll, input.score);
    identification = {
      roll: input.identifyRoll,
      success: identified,
      resultKey: identified ? "ADND2E.chat.tracking.identified" : "ADND2E.chat.tracking.notIdentified",
      infoKeys: identified ? identificationInfo(input.level).map((id) => `ADND2E.tracking.info.${id}`) : [],
    };
  }
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    headlineKey: "ADND2E.chat.tracking.title",
    score: input.score,
    halved: input.halved,
    breakdown: input.breakdown,
    possible,
    roll: input.roll,
    success,
    resultKey: !possible ? "ADND2E.chat.tracking.notPossible" : success ? "ADND2E.chat.tracking.found" : "ADND2E.chat.tracking.lost",
    movementKey: limit ? `ADND2E.tracking.movement.${limit}` : "",
    identification,
  };
}
```
Append `export * from "./card";` to `src/core/tracking/index.ts`.

- [ ] **Step 3: The chat template**

Create `templates/chat/ranger-tracking.hbs` (existing classes only; the variable parts go in the body, not the title, so nothing truncates). Use `templates/chat/attack-roll.hbs` for the `.modifiers` list markup and the `adnd2eSigned` helper:

```hbs
<div class="adnd2e chat-card ranger-tracking">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{localize headlineKey}}</h3>
  </header>
  <ul class="modifiers">
    {{#each breakdown as |m|}}<li>{{localize m.labelKey}}: {{adnd2eSigned m.amount}}</li>{{/each}}
  </ul>
  {{#if halved}}<p class="hint">{{localize 'ADND2E.chat.tracking.halved'}}</p>{{/if}}
  <p class="formula">{{localize 'ADND2E.chat.tracking.score' score=score}}</p>
  {{#if possible}}<p class="formula">1d20 = <strong>{{roll}}</strong></p>{{/if}}
  <p class="result {{#if success}}hit{{else}}miss{{/if}}">{{localize resultKey}}</p>
  {{#if movementKey}}<p class="hint">{{localize movementKey}}</p>{{/if}}
  {{#if identification}}
    <p class="formula">{{localize 'ADND2E.chat.tracking.identify'}}: 1d20 = <strong>{{identification.roll}}</strong></p>
    <p class="result {{#if identification.success}}hit{{else}}miss{{/if}}">{{localize identification.resultKey}}</p>
    {{#if identification.infoKeys.length}}
      <ul class="modifiers">
        {{#each identification.infoKeys}}<li>{{localize this}}</li>{{/each}}
      </ul>
    {{/if}}
  {{/if}}
</div>
```
In `tests/styles/chat-classes.test.ts` change the template-count assertion and its title from 16 to 17 ("finds all seventeen chat templates"). Edit with the Edit tool (check CRLF first).

- [ ] **Step 4: Copy**

Edit `lang/en.json` (keep the file's nesting and line endings; parse-check with `node -e "JSON.parse(require('fs').readFileSync('lang/en.json','utf8'))"` afterwards). Top level of `ADND2E`, next to `habitats` (line ~71):

```json
"trackingTerrains": { "freshSnow": "Fresh snow", "softGround": "Soft or muddy ground", "thickBrush": "Thick brush or dense jungle", "forestField": "Forest, field or dusty floor", "normal": "Normal ground", "desert": "Desert or dry sand", "swamp": "Swamp", "rocky": "Rock, ice, stone or shallow water" },
"trackingIlluminations": { "good": "Good light", "twilight": "Twilight, light fog or a single torch", "moonlit": "Full-moon night or moderate fog", "dark": "Overcast night, dense fog, blizzard or blowing sand" },
"primaryTerrains": { "aquatic": "Aquatic", "arctic": "Arctic", "desert": "Desert", "forest": "Forest", "hill": "Hill", "jungle": "Jungle", "mountain": "Mountain", "plain": "Plain", "swamp": "Swamp" },
"tracking": {
  "mod": { "wisdom": "Wisdom", "level": "Ranger level", "creatures": "Creatures tracked", "assistants": "Assisting trackers", "animal": "Animal follower", "primaryTerrain": "Trail in primary terrain", "age": "Age of the trail", "rain": "Rain, snow or sleet since", "hides": "Quarry hides its trail", "specializedHiding": "Quarry is a specialized ranger in his terrain" },
  "movement": { "quarter": "Tracking movement: 1/4 of normal", "half": "Tracking movement: 1/2 of normal", "threeQuarters": "Tracking movement: 3/4 of normal" },
  "info": { "generalType": "General type of creature", "specificTypeHeading": "Specific type and heading", "number": "Probable number of creatures", "sizeAge": "Approximate size or age", "pace": "Pace", "recent": "How recent the trail is", "conditions": "Special conditions" }
},
```
Under `ADND2E.chat` add a `tracking` object: `"title": "Tracking"`, `"score": "Tracking score: {score}"`, `"halved": "Non-natural surroundings: score halved."`, `"found": "Trail found"`, `"lost": "Trail lost"`, `"notPossible": "Tracking is not possible"`, `"identify": "Identification"`, `"identified": "Identified"`, `"notIdentified": "Nothing identified"`.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add src/core/tracking tests/core/tracking templates/chat/ranger-tracking.hbs tests/styles/chat-classes.test.ts lang/en.json
git commit -m "feat(tracking): tracking chat card and rule labels (#88)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Schema field and config label maps

**Files:**
- Modify: `src/data/actor/base-actor.ts` (`actorCommonSchema`: add `tracking` next to `shapechange`)
- Modify: `src/config.ts` (label maps `trackingTerrains`, `trackingIlluminations`, `primaryTerrains`; interface entries + frozen config)
- Modify: `tests/config/build-config.test.ts` (key list near line 17, and `assertLabelMap` calls near line 82)
- Modify: `lang/en.json` (the sheet copy used by Task 4 is added there, not here)

**Interfaces:**
- Consumes: Task 1 id lists (`TRACKING_TERRAINS`, `TRACKING_ILLUMINATIONS`, `PRIMARY_TERRAINS` and their types).
- Produces: `actor.system.tracking: { primaryTerrain: "" | PrimaryTerrain; specialized: boolean }`; `CONFIG.ADND2E.trackingTerrains | trackingIlluminations | primaryTerrains` as `LabelMap`s keyed by the id lists, values `ADND2E.<map>.<id>`.

- [ ] **Step 1: The schema field**

Read the `shapechange` field in `src/data/actor/base-actor.ts` (~line 205) and its import of `SHAPECHANGE_CATEGORIES` (~line 11). Add, directly after the `shapechange` field:

```ts
    /** SP20 ranger tracking: the ranger's primary terrain ("" = none chosen) and whether he specialized in it (PHBR11 optional rule). Edited on the Tracking panel; defaults only, no migration. */
    tracking: new SchemaField({
      primaryTerrain: new StringField({ required: true, blank: true, initial: "", choices: PRIMARY_TERRAINS }),
      specialized: new BooleanField({ required: true, initial: false }),
    }),
```
and extend the import: `import { PRIMARY_TERRAINS } from "../../core/tracking";`. (`StringField` with `blank: true` and `choices` accepts `""`; confirm in Step 4's headless check.)

- [ ] **Step 2: The config maps**

In `src/config.ts` follow the `shapechangeCategories`/`habitats` pattern exactly: type imports from `./core/tracking`; interface members `readonly trackingTerrains: LabelMap<TrackingTerrain>`, `readonly trackingIlluminations: LabelMap<TrackingIllumination>`, `readonly primaryTerrains: LabelMap<PrimaryTerrain>`; object literals with one `ADND2E.<map>.<id>` entry per id (all ids from Task 1; the lang keys already exist from Task 2).

- [ ] **Step 3: Tests**

In `tests/config/build-config.test.ts` add the three map names to the sorted key list (line ~17, keep it alphabetical) and `assertLabelMap(cfg.trackingTerrains); assertLabelMap(cfg.trackingIlluminations); assertLabelMap(cfg.primaryTerrains);` next to the existing calls. Add one more test in the same file (or a new `tests/core/tracking/config.test.ts`) asserting the map keys equal the id lists and every label resolves in `lang/en.json`:

```ts
it("tracking label maps cover every id and resolve in lang/en.json", () => {
  const lang = JSON.parse(readFileSync(path.join(ROOT, "lang", "en.json"), "utf8")) as Record<string, unknown>;
  const lookup = (key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], lang);
  expect(Object.keys(cfg.trackingTerrains)).toEqual([...TRACKING_TERRAINS]);
  expect(Object.keys(cfg.trackingIlluminations)).toEqual([...TRACKING_ILLUMINATIONS]);
  expect(Object.keys(cfg.primaryTerrains)).toEqual([...PRIMARY_TERRAINS]);
  for (const map of [cfg.trackingTerrains, cfg.trackingIlluminations, cfg.primaryTerrains]) {
    for (const key of Object.values(map)) expect(typeof lookup(key), key).toBe("string");
  }
});
```
(Match that file's existing imports and `ROOT`/`cfg` names; adapt, don't duplicate.)

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green. (The schema itself is proven headlessly in Task 5.)

```bash
git add src/data/actor/base-actor.ts src/config.ts tests/config lang/en.json
git commit -m "feat(tracking): system.tracking primary-terrain fields and label maps (#88)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Track dialog, roll glue, and the PC Tracking panel

**Files:**
- Create: `src/sheets/character/tracking-actions.ts`
- Modify: `src/sheets/character/sheet.ts` (import; `DEFAULT_OPTIONS.actions` `trackQuarry`; `_prepareContext` keys `tracking` and `primaryTerrains`; one private static handler)
- Modify: `templates/actor/pc/partials/pc-feature-panels.hbs` (Tracking panel inside the existing `{{#if @root.pcActions}}` block, directly after the shapechange panel)
- Modify: `lang/en.json` (`ADND2E.sheet.tracking.*`)
- Create: `tests/templates/tracking-bindings.test.ts`

**Interfaces:**
- Consumes: Task 1 (`trackingScore`, `trackingInputFromForm`, `canTrack`, `movementLimit`, `TRACKING_TERRAINS`, `TRACKING_ILLUMINATIONS`), Task 2 (`buildTrackingCardContext`, `ranger-tracking.hbs`), Task 3 (`system.tracking`, config maps).
- Produces (glue, `src/sheets/character/tracking-actions.ts`):
```ts
export interface TrackingActor {
  name: string; img: string; statuses: ReadonlySet<string> | readonly string[];
  system: { abilities: { wis: { score: number } }; classes?: { chassisId: string; level: number }[]; tracking: { primaryTerrain: string; specialized: boolean } };
}
export interface TrackingView { visible: boolean; level: number; wisdom: number; primaryTerrain: string; specialized: boolean; canAct: boolean }
export function trackingView(actor: TrackingActor): TrackingView;
export function trackQuarry(actor: TrackingActor): Promise<void>;   // dialog → roll(s) → chat card
```

- [ ] **Step 1: Read the neighbours first**

Read `src/sheets/character/shapechange-actions.ts` (view builder, `canAct` gate, `warn`, `postCard` with `renderTemplate(TEMPLATE_PATH(...))` + `ChatMessage.create`, `themedPrompt` with an `ok.callback`) and `src/sheets/character/sheet.ts` around the shapechange context (~line 478) and its three action handlers (~line 1190), and `templates/actor/pc/partials/pc-feature-panels.hbs`' shapechange panel. Mirror them. Note how `selectOptions` consumes config maps (`templates/actor/creature/header.hbs:17`).

- [ ] **Step 2: The glue**

Create `src/sheets/character/tracking-actions.ts`:

```ts
import { TEMPLATE_PATH } from "../../constants";
import { canAct } from "../../combat/condition-effects";
import {
  TRACKING_ILLUMINATIONS, TRACKING_TERRAINS, buildTrackingCardContext, canTrack, movementLimit, trackingInputFromForm, trackingScore,
} from "../../core/tracking";
import { themedPrompt } from "../../dialogs/themed-dialog-foundry";

/* SP20 — ranger tracking. Foundry glue only; every decision lives in src/core/tracking. Nothing is written to the actor:
 * a Track is a roll plus a chat card (trail found/lost state is deliberately not stored). */

export interface TrackingActor {
  name: string;
  img: string;
  statuses: ReadonlySet<string> | readonly string[];
  system: {
    abilities: { wis: { score: number } };
    classes?: { chassisId: string; level: number }[];
    tracking: { primaryTerrain: string; specialized: boolean };
  };
}

export interface TrackingView {
  visible: boolean;
  level: number;
  wisdom: number;
  primaryTerrain: string;
  specialized: boolean;
  canAct: boolean;
}

const rangerLevel = (actor: TrackingActor): number => actor.system.classes?.find((c) => c.chassisId === "ranger")?.level ?? 0;

export function trackingView(actor: TrackingActor): TrackingView {
  const level = rangerLevel(actor);
  const { primaryTerrain, specialized } = actor.system.tracking;
  return { visible: level > 0, level, wisdom: actor.system.abilities.wis.score, primaryTerrain, specialized, canAct: canAct(actor.statuses) };
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

const esc = (s: string): string => foundry.utils.escapeHTML(s);

function dialogContent(view: TrackingView): string {
  const i18n = game.i18n!;
  const L = (key: string): string => esc(i18n.localize(key));
  const options = (ids: readonly string[], prefix: string, selected: string): string =>
    ids.map((id) => `<option value="${id}"${id === selected ? " selected" : ""}>${L(`${prefix}.${id}`)}</option>`).join("");
  const number = (name: string, labelKey: string): string =>
    `<label class="tracking-field"><span>${L(labelKey)}</span><input type="number" name="${name}" min="0" step="1" value="0"></label>`;
  const check = (name: string, labelKey: string, checked = false): string =>
    `<label class="tracking-check"><input type="checkbox" name="${name}"${checked ? " checked" : ""}> <span>${L(labelKey)}</span></label>`;
  const inPrimary = view.specialized && view.primaryTerrain !== "";
  return `<div class="tracking-dialog">
    <label class="tracking-field"><span>${L("ADND2E.sheet.tracking.terrain")}</span><select name="terrain">${options(TRACKING_TERRAINS, "ADND2E.trackingTerrains", "normal")}</select></label>
    <label class="tracking-field"><span>${L("ADND2E.sheet.tracking.illumination")}</span><select name="illumination">${options(TRACKING_ILLUMINATIONS, "ADND2E.trackingIlluminations", "good")}</select></label>
    ${number("creaturesTracked", "ADND2E.sheet.tracking.creatures")}
    ${number("assistingTrackers", "ADND2E.sheet.tracking.assistants")}
    ${number("hoursSinceMade", "ADND2E.sheet.tracking.hours")}
    ${number("rainHours", "ADND2E.sheet.tracking.rainHours")}
    ${check("animalFollower", "ADND2E.sheet.tracking.animalFollower")}
    ${inPrimary ? check("trailInPrimaryTerrain", "ADND2E.sheet.tracking.inPrimaryTerrain") : ""}
    ${check("nonNatural", "ADND2E.sheet.tracking.nonNatural")}
    ${check("quarryHidesTrail", "ADND2E.sheet.tracking.quarryHides")}
    ${check("quarryIsSpecializedHiding", "ADND2E.sheet.tracking.quarrySpecialized")}
    ${check("identify", "ADND2E.sheet.tracking.identify", true)}
    <p class="hint tracking-preview"><output name="preview"></output></p>
  </div>`;
}

/** Reads the dialog form into typed input (pure parsing lives in core). */
function readForm(form: HTMLFormElement, view: TrackingView) {
  const raw = new foundry.applications.ux.FormDataExtended(form).object as Record<string, unknown>;
  return trackingInputFromForm(raw, view.specialized && view.primaryTerrain !== "");
}

function previewText(view: TrackingView, form: HTMLFormElement): string {
  const i18n = game.i18n!;
  const result = trackingScore({ wisdom: view.wisdom, level: view.level, ...readForm(form, view) });
  if (!canTrack(result.score)) return i18n.format("ADND2E.sheet.tracking.previewImpossible", { score: result.score });
  const limit = movementLimit(result.score);
  return i18n.format("ADND2E.sheet.tracking.preview", { score: result.score, movement: i18n.localize(`ADND2E.tracking.movement.${limit}`) });
}

/** Opens the dialog, rolls tracking (and identification after a success when asked), and posts one chat card. */
export async function trackQuarry(actor: TrackingActor): Promise<void> {
  const view = trackingView(actor);
  if (!view.visible) return;
  if (!view.canAct) return warn("ADND2E.sheet.tracking.cannotAct");
  const i18n = game.i18n!;
  const values = await themedPrompt({
    window: { title: i18n.localize("ADND2E.sheet.tracking.dialogTitle") },
    content: dialogContent(view),
    render: (_event: Event, dialog: { element: HTMLElement }) => {
      const form = dialog.element.querySelector("form");
      const out = dialog.element.querySelector("output[name='preview']");
      if (!form || !out) return;
      const update = (): void => {
        out.textContent = previewText(view, form);
      };
      form.addEventListener("input", update);
      form.addEventListener("change", update);
      update();
    },
    ok: {
      label: i18n.localize("ADND2E.sheet.tracking.roll"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => (button.form ? readForm(button.form, view) : null),
    },
  } as never);
  if (!values) return;

  const { identify, ...rest } = values as ReturnType<typeof trackingInputFromForm>;
  const result = trackingScore({ wisdom: view.wisdom, level: view.level, ...rest });
  const possible = canTrack(result.score);
  const roll = possible ? ((await new Roll("1d20").evaluate()).total ?? 1) : null;
  const found = possible && roll !== null && roll <= result.score && roll !== 20;
  const identifyRoll = found && identify ? ((await new Roll("1d20").evaluate()).total ?? 1) : null;

  const context = buildTrackingCardContext({
    actorName: actor.name, actorImg: actor.img, level: view.level,
    score: result.score, halved: result.halved, breakdown: result.breakdown, roll, identifyRoll,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/ranger-tracking.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}
```
Notes for the implementer: (a) `found` duplicates `resolveCheck`; import and call `resolveCheck(roll, result.score)` instead of the inline comparison; (b) the dialog's OK button must not close on a preview-only edit — preview updates `<output>` only; (c) confirm in the Foundry v14 `DialogV2` source (`resources/app/client/applications/api/dialog.mjs`) that the `render` config callback exists with signature `(event, dialog)`; if it does not, attach the listeners with a `MutationObserver`-free alternative documented in the code (the dialog `element` is available after `await`), and tell the controller; (d) `Roll` / `ChatMessage` / `ui` / `game` are used as globals exactly as `shapechange-actions.ts` does.

- [ ] **Step 3: Sheet wiring**

In `src/sheets/character/sheet.ts`: import `{ trackQuarry, trackingView }` from `./tracking-actions`; register `trackQuarry: Adnd2eCharacterSheet.#onTrackQuarry,` in `DEFAULT_OPTIONS.actions` beside `shapechangeShift`; in `_prepareContext` after `context.shapechange` add `context.tracking = trackingView(this.document as never);` and `context.primaryTerrains = CONFIG.ADND2E.primaryTerrains;` (use whatever accessor the neighbouring code uses for the config, e.g. the `cfg` the creature sheet reads — do not invent one); add the handler next to the shapechange handlers:

```ts
  // Interaction handlers — SP20 ranger tracking.
  static async #onTrackQuarry(this: Adnd2eCharacterSheet): Promise<void> {
    if (this.isEditable) await trackQuarry(this.document as never);
  }
```
Do NOT set `context.tracking` or `context.pcActions` in `src/sheets/npc/sheet.ts` — the Character NPC sheet must render unchanged.

- [ ] **Step 4: The panel and copy**

In `templates/actor/pc/partials/pc-feature-panels.hbs`, inside the existing `{{#if @root.pcActions}}` block directly after the shapechange `{{/if}}`:

```hbs
  {{#if @root.tracking.visible}}
  <section class="kit-panel tracking-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.tracking.title'}}</div>
    <div class="kit-body">
      <p class="hint">{{localize 'ADND2E.sheet.tracking.score' wisdom=@root.tracking.wisdom level=@root.tracking.level}}</p>
      {{#if @root.adnd2e.lock.unlocked}}
        <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.tracking.primaryTerrain'}}</span>
          <select name="system.tracking.primaryTerrain">{{selectOptions @root.primaryTerrains selected=@root.tracking.primaryTerrain localize=true blank=''}}</select>
        </label>
        <label class="detail-field"><input type="checkbox" name="system.tracking.specialized"{{#if @root.tracking.specialized}} checked{{/if}}> <span>{{localize 'ADND2E.sheet.tracking.specialized'}}</span></label>
      {{else}}
        <p class="hint">{{localize 'ADND2E.sheet.tracking.primaryTerrain'}}: {{#if @root.tracking.primaryTerrain}}{{adnd2eLabel 'primaryTerrains' @root.tracking.primaryTerrain}}{{#if @root.tracking.specialized}} ({{localize 'ADND2E.sheet.tracking.specializedShort'}}){{/if}}{{else}}—{{/if}}</p>
      {{/if}}
      <button type="button" class="kit-small" data-action="trackQuarry"{{#unless @root.tracking.canAct}} disabled{{/unless}}>{{localize 'ADND2E.sheet.tracking.track'}}</button>
    </div>
  </section>
  {{/if}}
```
Verify the `selectOptions` `blank` argument produces an empty first option in Foundry v14's helper (read `resources/app/client/applications/handlebars.mjs`); adjust the arguments if not (`blank=''` is the documented form). The `adnd2eLabel` helper takes the CONFIG map name as a string, as the shapechange panel does with `'shapechangeCategories'`.

In `lang/en.json` under `ADND2E.sheet` add a `tracking` object: `"title": "Tracking"`, `"score": "Base score: Wisdom {wisdom}, ranger level {level}"`, `"primaryTerrain": "Primary terrain"`, `"specialized": "Specialized in this terrain"`, `"specializedShort": "specialized"`, `"track": "Track…"`, `"dialogTitle": "Track a quarry"`, `"terrain": "Terrain"`, `"illumination": "Light"`, `"creatures": "Creatures tracked"`, `"assistants": "Assisting trackers"`, `"hours": "Hours since the trail was made"`, `"rainHours": "Hours of rain, snow or sleet since"`, `"animalFollower": "Animal follower assisting"`, `"inPrimaryTerrain": "Trail is in my primary terrain"`, `"nonNatural": "Non-natural surroundings (score halved)"`, `"quarryHides": "Quarry hides its trail"`, `"quarrySpecialized": "Quarry is a specialized ranger hiding in his terrain"`, `"identify": "Also attempt identification"`, `"roll": "Roll"`, `"preview": "Tracking score {score}. {movement}"`, `"previewImpossible": "Tracking score {score}: tracking is not possible"`, `"cannotAct": "This ranger cannot act and cannot track right now."`.

- [ ] **Step 5: Binding tests**

Create `tests/templates/tracking-bindings.test.ts` modelled on `tests/templates/shapechange-bindings.test.ts` (same `read`/`lookup` helpers):
- the Features panel has `data-action="trackQuarry"`, is inside `@root.pcActions` and `@root.tracking.visible`, and the button has exactly one `disabled` condition referencing `tracking.canAct`;
- the unlocked branch has `name="system.tracking.primaryTerrain"` and `name="system.tracking.specialized"`;
- `SHEET` registers `trackQuarry: Adnd2eCharacterSheet.#on`; `NPC_SHEET` does not match `/context\.(pcActions|tracking)\s*=/`;
- every `ADND2E.sheet.tracking.*` key used in the template AND in `tracking-actions.ts` (regex over `"ADND2E\.sheet\.tracking\.[A-Za-z]+"`) exists in `lang/en.json`; likewise every `ADND2E.chat.tracking.*` key in `templates/chat/ranger-tracking.hbs` and `src/core/tracking/card.ts`, and every `ADND2E.tracking.*` key built in `rules.ts` (`mod` keys literal; `movement`/`info` ids via the id lists);
- `tracking-actions.ts` contains `themedPrompt` and not `DialogV2`.
Use the Edit/Write tools, not a shell heredoc (a `\b` through a heredoc becomes a backspace); after writing run `grep -nP '[\x00-\x08]' tests/templates/tracking-bindings.test.ts` and expect no output.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add src/sheets/character/tracking-actions.ts src/sheets/character/sheet.ts templates/actor/pc/partials/pc-feature-panels.hbs lang/en.json tests/templates/tracking-bindings.test.ts
git commit -m "feat(tracking): Track dialog, roll and the ranger Tracking panel (#88)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gates, headless proof, README and the manual checklist

**Files:**
- Modify: `README.md` (find the SP20 / "Ranger" row: `grep -n "SP20\|20\. \|tracking" -i README.md`; mark it `✅ Complete` with a one-paragraph scope in the style of the SP16 row)
- Scratch (git-ignored, do NOT commit): `.superpowers/proof/tracking.proof.ts`

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage && npx vite build --outDir "<scratchpad>/build-final"`
Expected: green; 100% statement coverage.

- [ ] **Step 2: Headless proof (best effort)**

Recipe: memory note `foundry-headless-proof-harness`; copy the setup from `.superpowers/proof/shapechange.proof.ts`. Prove with the REAL data models and Handlebars:
1. `system.tracking` defaults (`primaryTerrain: ""`, `specialized: false`) validate on a character; a round trip with `primaryTerrain: "forest", specialized: true` validates; an invalid terrain (`"lava"`) is rejected.
2. The three worked examples end to end through `trackingScore`/`movementLimit` (17; 20; 1 + quarter) and one halved case.
3. `trackingView` for a fake actor: ranger level 7 visible; non-ranger not visible; `stunned` makes `canAct` false.
4. Render `templates/actor/pc/partials/pc-feature-panels.hbs` for a ranger (unlocked → selects/checkbox; locked → text; a disabled Track button when `canAct` false), a non-ranger (no panel), and with `pcActions` unset (no panel — the Character NPC case). Render `templates/chat/ranger-tracking.hbs` for a success with identification (level 10), a miss, an impossible track and a natural-20.
Report proven and not proven (real dialog and clicks, `Roll`, the live preview, the non-GM seat).

- [ ] **Step 3: README and commit**

```bash
git add README.md
git commit -m "docs: SP20 ranger tracking complete (#88)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch. Characters (offer a console script that creates them): a level 7 Ranger with Wisdom 15 (add a Ranger class item); a level 2 ranger; a level 10 ranger; a wizard (non-ranger); a non-GM seat owning the level 7 ranger.
1. Ranger sheet → Features tab shows a Tracking panel ("Wisdom 15, ranger level 7"); the wizard and a Character NPC ranger show none and the NPC sheet looks unchanged.
2. Unlock the sheet: choose a primary terrain and tick "Specialized"; lock again: the text shows the terrain and "(specialized)".
3. **Track…** opens the themed dialog. With defaults the preview reads score 17, three-quarters movement. Set 4 creatures, Fresh snow, Twilight, 24 hours: 20. Set Rock + Full-moon night with 1 creature: 1 with quarter movement. Tick Non-natural on the default form: 8, half movement.
4. "Trail is in my primary terrain" appears only for a specialized ranger with a primary terrain; it adds +2. Quarry hides: −5; also "specialized ranger hiding": −7 total; the extra box without hides changes nothing.
5. Press Roll: one chat card with the modifier list, score, `1d20 = n`, Trail found / lost (a natural 20 is always lost), and the movement limit. Force dice if needed (memory note `foundry-force-dice-recipe`).
6. Identification: with the box ticked and a tracking success, a second roll and the info list: level 2 → general type only; level 7 → five rows up to size/age; level 10 → all seven; an identification miss lists nothing. Unticked → no second roll.
7. A score of 0 or less (e.g. Wis 3, Rock, dark) → the card says tracking is not possible and no d20 is shown.
8. A stunned ranger: Track is disabled; forcing it via macro warns.
9. Non-GM seat: repeat 2-6 on the owned ranger (fields editable when unlocked, card posts under the player).
10. The card looks right in both Foundry themes, and the dialog is themed; no other sheet or card changed.
Reset any setting you change between checks.
```

---

## Self-Review

- **Spec coverage:** §1 pure rules, all tables, score, canTrack, resolveCheck, movement, identification → Task 1; §2 data → Task 3; §3 panel and dialog (terrain, illumination, counts, checkboxes incl. the specialized-only box, identify default on, live score + movement) → Task 4; §4 roll and one chat card with existing classes, census 16 → 17 → Tasks 2 and 4; §5 out of scope respected (no persistence, PC sheet only); Testing: every table row, special modifier, assistant cap, halving and rounding, zero/negative, `resolveCheck` natural 20 and equality, three movement bands and below-1, identification levels 1-10 and 15 → Task 1 tests; schema/lang/config → Task 3; bindings, guard, NPC-unchanged → Task 4; headless proof, gates, README, non-GM checklist → Task 5. Risks: halving order stated in Global Constraints and tested; assistant cap tested.
- **Placeholders:** none in the pure code (Tasks 1-2 complete with tests); Tasks 3-4 give complete code for the schema field, glue, panel and copy and name the neighbour files to read first.
- **Consistency:** `trackingScore`, `TrackingInput`, `ModifierRow`, `canTrack`, `resolveCheck`, `movementLimit`, `identificationInfo`, `trackingInputFromForm`, `buildTrackingCardContext`, `trackingView`, `trackQuarry` and the lang key prefixes (`ADND2E.tracking.*`, `ADND2E.trackingTerrains.*`, `ADND2E.trackingIlluminations.*`, `ADND2E.primaryTerrains.*`, `ADND2E.chat.tracking.*`, `ADND2E.sheet.tracking.*`) match across tasks; the action name `trackQuarry` matches template, sheet and binding test.
