# Sub-project 8 Plan 8c: Character-Point Build (Traits + CP Ledger) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Skills & Powers character-point build: a new `trait` Item subtype with a 14-trait compendium, a pure character-point (CP) cost/ledger module, trait effects applied by the derive layer, a hard-blocking trait drop rule, and a PC Features-tab Traits panel with the CP ledger.

**Architecture:** Two pure modules under `src/core/skills/` own everything mechanical: `traits.ts` (the `TRAITS` table, the closed `TraitEffect` union, the tolerant `toTraitEffect` normaliser, the `traitEffectTotals` reducer, `abilityScoreWithBonus`) and `character-points.ts` (the ONE gate helper `characterPointBuildEnabled`, `subScoreCpCost`, the ledger, `canAffordTrait`). Trait effects are applied in two places that both read the SAME `resolveTraitTotals` (which contains the gate): ability bonuses in `prepareBaseData` right after the racial adjustment (so `snapshot.abilities` and the sheet's displayed score already include them), and the other four kinds (save / attack / proficiency slots / bonus HP) in a new pure `src/data/derive/character/traits.ts` wrapper around `deriveCharacter`. The PC sheet gets a Traits panel and CP ledger driven by a pure context builder; the drop handler re-derives the ledger from the actor's current authored state at drop time.

**Tech Stack:** TypeScript, Vite, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-23-adnd2e-sp8-skills-and-powers-design.md` — §2 Decisions table, §3 Global Constraints, §4.3 (+ §4.3.1 the 14 traits), §5, §6, §7.

## Global Constraints

- **Foundry target:** v14.364. Any Foundry-layer API question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` — never `fvtt-types` (pinned to v13-beta, wrong about several v14 APIs).
- **Two-layer contract:** `src/core/**` (directory-level wildcard in `tsconfig.core.json`, `vitest.config.ts` coverage `include`, and the ESLint pure zone), `src/data/derive/**`, `src/data/item/subtypes.ts` + `choices.ts`, and the file-by-file listed `src/sheets/character/{context,context-types,drop-rules}.ts` are the PURE zone: no Foundry imports, 100% line/statement/function coverage, branches ≥ 90. `src/data/actor/*.ts`, `src/data/item/trait.ts`, `src/data/item/index.ts`, `src/sheets/**/sheet.ts`, `src/sheets/character/trait-actions.ts`, templates, SCSS and `lang/en.json` are the Foundry layer — typecheck/lint gated, dev-world verified, NOT unit-tested.
- **Content policy:** mechanical values only. The trait names, costs and amounts (spec §4.3.1) and the CP cost curve (spec §4.3) are this project's OWN designed numbers; add no rules prose, no book tables, no descriptions (`system.description` ships `""`).
- **Gating (locked, spec §2):** `skillsAndPowersEnabled` is a master AND-gate. The expression `rules.skillsAndPowersEnabled && rules.characterPointBuild` is written **exactly once**, as `characterPointBuildEnabled(rules)` in Task 2. Every consumer goes through it — directly, or through the two helpers built on it: `characterPointLedgerFor(rules, …)` (null ⇔ rule off; used by the sheet context and the drop handler) and `resolveTraitTotals(traits, rules)` (zero totals ⇔ rule off; used by `deriveCharacter` and `prepareBaseData`). Do not restate the expression anywhere else, and do not read the VALUE `rules.characterPointBuild` outside `character-points.ts`/`registry.ts`/`options.ts` (type-only `Pick<OptionalRules, …>` parameter types are fine). (Plans 7c and 7d each shipped a gate that two files stated differently; this is the fix.)
- **Prepare-time rule → `requiresReload: true`** on the `characterPointBuild` setting (Plan 8a's whole-branch Important: prepared actor data is not recomputed when a setting flips).
- **Additive schema only — no migration, no version bump:** the new `trait` Item subtype, and `system.options.skillsAndPowers` changing from an untyped `ObjectField` (`initial: {}`) to a typed `SchemaField` whose leaf has an `initial`. Task 6 must CONFIRM against real v14.364 source that stored `{}` cleans to the initials (SP7c lesson: removed/renamed fields need `migrateData`; additive initial-valued fields do not).
- **Authored-vs-prepared split:** authored inputs bind `_source` values; the prepared model holds derived values. The CP pool input is `disabled` for non-GMs (`FormDataExtended` excludes disabled fields — `client/applications/ux/form-data-extended.mjs:23,118-119`), so a player's sheet submit can never write the pool. Ability bonuses are written to the PREPARED score only, and Foundry re-reads every prepared field from `_source` each prepare cycle (`reset()` → `_initialize()`, `common/abstract/data.mjs:460-526`), so no cycle ratchets.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**, and do not touch `package.json`/`package-lock.json`/`node_modules`.
- **`npm run build` requires Foundry fully closed** — re-confirm with the user before every build attempt. Implementers must NOT run `npm run build`/`build:packs` (the controller runs the first real pack compile at Task 10).
- **Read vitest output with `tail`/`head`/redirect, never `| grep`** — SIGPIPE false "no tests"; a cache-clear's first run can genuinely flake, rerun 2-3×.
- **Every gated action re-derives its own eligibility server-side from the actor's current authored state and current settings** — never trusts rendered UI state.
- **The whole-branch review (Task 9) is MANDATORY**, and the dev-world check (Task 10) is GATED and MUST include a non-GM player seat.

## Locked design decisions (this plan's own, resolving what spec §4.3 left to the plan)

1. **One gate, two derived helpers** (see Global Constraints). `characterPointLedgerFor` counts sub-scores in the ledger only when `subAbilitiesEnabled(rules)` (8a's helper) is ALSO true — spec §4.3 "with it off, the ledger counts traits only". The trait drop rule receives `availableCp: number | null`, where `null` means "the rule is off" (the ledger was `null`), so the drop rule never restates the gate.
2. **Ability bonuses are applied in `prepareBaseData`, not in the derive wrapper** (a refinement of spec §4.3's "adapter applies ability bonuses after racial adjustment"). Reason: `snapshot.abilities` is documented as the post-racial-adjustment score, the sheet displays `system.abilities.<k>.score`, and saves/encumbrance/every table read `snapshot.abilities.*` directly — applying the bonus in `prepareBaseData` (order: sub-scores → racial → **traits**) makes the displayed score, the mods, the CON/STR-dependent saves and encumbrance all agree, exactly like the racial delta. `deriveCharacter` therefore IGNORES `abilityBonus` totals (a test pins this so the bonus can never be double-counted). `abilityScoreWithBonus(score, bonus)` returns the score UNCHANGED when `bonus === 0` (rule off / no ability trait ⇒ byte-identical prepared scores, even outside [1, 25]) and clamps to [1, 25] otherwise.
3. **Traits apply to `character` AND `npc` actor models** (both share `prepareBaseData` + `deriveAndCache`; the creature model has its own derive and is untouched) — the same shared-derivation stance as Plan 8a's sub-scores (spec §2 "the shared derivation still applies to NPCs"). The NPC's own streamlined sheet renders no Traits UI and **rejects a trait drop** (`ADND2E.sheet.drop.traitsPcOnly`) so a GM cannot silently attach invisible effects to an NPC; an NPC opened on the PC sheet (the picker allows it) has the full Traits UI. A trait dropped on a creature sheet is inert (creature derive ignores traits) — documented, not guarded.
4. **Save / attack / slot / HP semantics.** `saveBonus n`: `rollModifier += n`, `effectiveTarget -= n`, `target` unchanged (a save succeeds when `d20 + rollModifier >= target`). `attackBonus n` (melee|ranged): that mode's cached THAC0 `-= n` (a positive to-hit modifier LOWERS THAC0, matching `deriveThac0`); `base` untouched. `proficiencySlots n`: `total = max(0, total + n)`, `available = total - spent` (a character can end up over-spent; existing proficiencies are never removed). `bonusHp n`: `applyBonusHp(hpMax, n)` returns `hpMax` unchanged when `n === 0` or `hpMax <= 0` (an un-rolled character or a class-less actor conjures no HP), else `max(1, hpMax + n)`.
5. **Refund model.** The cap (`DISADVANTAGE_REFUND_CAP = 10`) applies to DISADVANTAGE TRAITS only; sub-score refunds (a sub-score ≤ 9 costs negative CP) are uncapped exactly as spec §4.3 states — the ledger's `spent` may therefore be negative. Overspend is a soft warning everywhere except trait drops (hard block).
6. **Trait drop rule.** A trait drop is REJECTED when the rule is off (`traitsDisabled`), when the `traitId` is already owned (`duplicateTrait`; a blank `traitId` — a hand-made custom trait — never counts as a duplicate), or when an advantage costs more than `availableCp` (`insufficientCp`; a cost-0 trait is always affordable). A disadvantage is always allowed; the verdict reports the refund actually granted after the cap, and the sheet shows an info toast when the cap reduced it. Re-sorting an already-owned trait within the same actor is NOT a purchase and is never validated (the existing drop handler validates before it knows whether the drop is new — this plan computes `isNewDrop` first for traits).
7. **The pool** is authored `system.options.skillsAndPowers.characterPoints.pool` (integer ≥ 0, initial `DEFAULT_CHARACTER_POINT_POOL = 60`, defined once in `character-points.ts`), editable only by a GM on the sheet (`canEditPool = perms.isGM && perms.editable`; the input is `disabled` otherwise). Creation-budget only; spent CP is derived (sub-score curve over AUTHORED non-null sub-scores + owned traits), so removing a trait refunds it automatically.
8. **Trait effect storage** is a flat `SchemaField` (`kind`, `ability`, `save`, `mode`, `track`, `amount`) whose string members are `blank: true` `choices` fields (real v14.364 `StringField#_validateSpecial` accepts `""` before consulting `choices` — `common/data/fields.mjs:1707-1723`); the pure `toTraitEffect` picks the members its `kind` needs and returns `null` for anything malformed (blank kind, a missing/invalid target, a non-integer amount). A malformed trait is INERT (no effect, still costs/refunds its `cost` in the ledger). The raw Item sheet (already registered for every Item type) is the editor for custom traits.
9. **Sheet.** The Traits panel lives on the PC Features tab, rendered only when the ledger is non-null. Each row shows name, cost, and the effect as `{summaryAmount} {localize summaryTargetKey}` (a signed amount plus an i18n key for the target — ability/save labels come from the existing `config.abilities`/`config.saves`); a `removeTrait` action deletes the embedded item (refund is automatic). Row-level flags (`canRemove`) are precomputed in the pure context so the template needs no `@root.` references inside `{{#each}}`.
10. **Pack.** `packs/traits` holds 14 Item docs (`type: "trait"`, ids = first 16 hex chars of SHA-1 of `adnd2e-trait:<name>`, `img` `icons/svg/upgrade.svg` for advantages / `icons/svg/downgrade.svg` for disadvantages, `description: ""`), registered in `system.json` `packs` plus a new "Skills & Powers" pack folder, and drift-tested against the pure `TRAITS` table (the `CONDITIONS` precedent).
11. **Deferred to the README backlog (controller wrap-up):** the parked custom-class builder / per-level CP awards / kits; NPC-sheet invisibility of sub-scores and traits (the "hand-set NPC sub-scores" quirk generalised); sub-score refunds are uncapped (spec); a trait dropped on a creature sheet is inert.

---

### Task 1: Pure trait table, effect union and reducer

**Files:**
- Create: `src/core/skills/traits.ts`
- Create: `src/core/skills/index.ts`
- Modify: `src/core/index.ts` (add `export * from "./skills";`)
- Test: `tests/core/skills/traits.test.ts`

**Interfaces:**
- Produces (all consumed by Tasks 2-8):
  - `TRAIT_EFFECT_KINDS`, `TRAIT_ATTACK_MODES`, `TRAIT_PROFICIENCY_TRACKS` (readonly tuples), `TRAIT_SAVE_CATEGORIES: readonly SaveCategory[]`
  - `type TraitEffectKind`, `TraitAttackMode`, `TraitProficiencyTrack`
  - `type TraitEffect` (discriminated union on `kind`) and `interface RawTraitEffect { kind: string; ability: string; save: string; mode: string; track: string; amount: number }`
  - `interface Trait { id: string; name: string; cost: number; effect: TraitEffect }` and `TRAITS: readonly Trait[]` (14 rows, spec §4.3.1 order)
  - `toTraitEffect(raw: RawTraitEffect): TraitEffect | null`
  - `interface TraitTotals { abilityBonus: Record<AbilityKey, number>; saveBonus: Record<SaveCategory, number>; attackBonus: Record<TraitAttackMode, number>; proficiencySlots: Record<TraitProficiencyTrack, number>; bonusHp: number }` and `traitEffectTotals(effects: readonly TraitEffect[]): TraitTotals`
  - `abilityScoreWithBonus(score: number, bonus: number): number`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/skills/traits.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  TRAITS,
  TRAIT_ATTACK_MODES,
  TRAIT_EFFECT_KINDS,
  TRAIT_PROFICIENCY_TRACKS,
  TRAIT_SAVE_CATEGORIES,
  abilityScoreWithBonus,
  toTraitEffect,
  traitEffectTotals,
  type RawTraitEffect,
  type TraitEffect,
} from "../../../src/core/skills/traits";

function raw(over: Partial<RawTraitEffect> = {}): RawTraitEffect {
  return { kind: "", ability: "", save: "", mode: "", track: "", amount: 0, ...over };
}

describe("enum tables", () => {
  it("lists the five effect kinds, two attack modes, two proficiency tracks and the five save categories", () => {
    expect([...TRAIT_EFFECT_KINDS]).toEqual(["abilityBonus", "saveBonus", "attackBonus", "proficiencySlots", "bonusHp"]);
    expect([...TRAIT_ATTACK_MODES]).toEqual(["melee", "ranged"]);
    expect([...TRAIT_PROFICIENCY_TRACKS]).toEqual(["weapon", "nonweapon"]);
    expect([...TRAIT_SAVE_CATEGORIES]).toEqual(["ppd", "rsw", "pp", "bw", "spell"]);
  });
});

describe("TRAITS (spec §4.3.1 — the 14 designed traits)", () => {
  it("matches the spec table row for row", () => {
    expect(TRAITS.map((t) => [t.id, t.name, t.cost, t.effect])).toEqual([
      ["hardy", "Hardy", 6, { kind: "bonusHp", amount: 4 }],
      ["iron-will", "Iron Will", 5, { kind: "saveBonus", save: "spell", amount: 1 }],
      ["resilient", "Resilient", 5, { kind: "saveBonus", save: "ppd", amount: 1 }],
      ["steady-aim", "Steady Aim", 8, { kind: "attackBonus", mode: "ranged", amount: 1 }],
      ["brawler", "Brawler", 8, { kind: "attackBonus", mode: "melee", amount: 1 }],
      ["quick-study", "Quick Study", 4, { kind: "proficiencySlots", track: "nonweapon", amount: 2 }],
      ["weapon-drill", "Weapon Drill", 4, { kind: "proficiencySlots", track: "weapon", amount: 1 }],
      ["powerful", "Powerful", 7, { kind: "abilityBonus", ability: "str", amount: 1 }],
      ["sturdy", "Sturdy", 7, { kind: "abilityBonus", ability: "con", amount: 1 }],
      ["frail", "Frail", -4, { kind: "bonusHp", amount: -3 }],
      ["nervous", "Nervous", -4, { kind: "saveBonus", save: "spell", amount: -1 }],
      ["poor-aim", "Poor Aim", -5, { kind: "attackBonus", mode: "ranged", amount: -1 }],
      ["slow-learner", "Slow Learner", -3, { kind: "proficiencySlots", track: "nonweapon", amount: -1 }],
      ["feeble", "Feeble", -5, { kind: "abilityBonus", ability: "str", amount: -1 }],
    ]);
  });

  it("has unique ids and names, nine advantages and five disadvantages", () => {
    expect(new Set(TRAITS.map((t) => t.id)).size).toBe(14);
    expect(new Set(TRAITS.map((t) => t.name)).size).toBe(14);
    expect(TRAITS.filter((t) => t.cost > 0)).toHaveLength(9);
    expect(TRAITS.filter((t) => t.cost < 0)).toHaveLength(5);
  });
});

describe("toTraitEffect", () => {
  it("builds each of the five kinds from its own target member", () => {
    expect(toTraitEffect(raw({ kind: "abilityBonus", ability: "dex", amount: 2 }))).toEqual({ kind: "abilityBonus", ability: "dex", amount: 2 });
    expect(toTraitEffect(raw({ kind: "saveBonus", save: "bw", amount: -1 }))).toEqual({ kind: "saveBonus", save: "bw", amount: -1 });
    expect(toTraitEffect(raw({ kind: "attackBonus", mode: "melee", amount: 1 }))).toEqual({ kind: "attackBonus", mode: "melee", amount: 1 });
    expect(toTraitEffect(raw({ kind: "proficiencySlots", track: "weapon", amount: 3 }))).toEqual({ kind: "proficiencySlots", track: "weapon", amount: 3 });
    expect(toTraitEffect(raw({ kind: "bonusHp", amount: 4 }))).toEqual({ kind: "bonusHp", amount: 4 });
  });

  it("ignores target members that do not belong to its kind", () => {
    expect(toTraitEffect(raw({ kind: "bonusHp", ability: "str", save: "ppd", mode: "melee", track: "weapon", amount: 2 }))).toEqual({ kind: "bonusHp", amount: 2 });
  });

  it("returns null for a blank or unknown kind", () => {
    expect(toTraitEffect(raw())).toBeNull();
    expect(toTraitEffect(raw({ kind: "bogus", amount: 1 }))).toBeNull();
  });

  it("returns null when the kind's target is blank or not a real member", () => {
    expect(toTraitEffect(raw({ kind: "abilityBonus", ability: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "abilityBonus", ability: "luck", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "saveBonus", save: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "saveBonus", save: "fort", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "attackBonus", mode: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "attackBonus", mode: "thrown", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "proficiencySlots", track: "", amount: 1 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "proficiencySlots", track: "language", amount: 1 }))).toBeNull();
  });

  it("returns null for a non-integer amount, whatever the kind", () => {
    expect(toTraitEffect(raw({ kind: "bonusHp", amount: 1.5 }))).toBeNull();
    expect(toTraitEffect(raw({ kind: "bonusHp", amount: Number.NaN }))).toBeNull();
  });
});

describe("traitEffectTotals", () => {
  it("is all zeros for no effects", () => {
    expect(traitEffectTotals([])).toEqual({
      abilityBonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      saveBonus: { ppd: 0, rsw: 0, pp: 0, bw: 0, spell: 0 },
      attackBonus: { melee: 0, ranged: 0 },
      proficiencySlots: { weapon: 0, nonweapon: 0 },
      bonusHp: 0,
    });
  });

  it("sums every kind into its own slot, and stacking effects add", () => {
    const effects: TraitEffect[] = [
      { kind: "abilityBonus", ability: "str", amount: 1 },
      { kind: "abilityBonus", ability: "str", amount: -1 },
      { kind: "abilityBonus", ability: "con", amount: 1 },
      { kind: "saveBonus", save: "spell", amount: 1 },
      { kind: "saveBonus", save: "spell", amount: 1 },
      { kind: "saveBonus", save: "ppd", amount: -1 },
      { kind: "attackBonus", mode: "melee", amount: 1 },
      { kind: "attackBonus", mode: "ranged", amount: -1 },
      { kind: "proficiencySlots", track: "weapon", amount: 1 },
      { kind: "proficiencySlots", track: "nonweapon", amount: 2 },
      { kind: "proficiencySlots", track: "nonweapon", amount: -1 },
      { kind: "bonusHp", amount: 4 },
      { kind: "bonusHp", amount: -3 },
    ];
    expect(traitEffectTotals(effects)).toEqual({
      abilityBonus: { str: 0, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
      saveBonus: { ppd: -1, rsw: 0, pp: 0, bw: 0, spell: 2 },
      attackBonus: { melee: 1, ranged: -1 },
      proficiencySlots: { weapon: 1, nonweapon: 1 },
      bonusHp: 1,
    });
  });

  it("returns a fresh object each call (no shared mutable zero record)", () => {
    const a = traitEffectTotals([]);
    a.bonusHp = 99;
    a.abilityBonus.str = 5;
    expect(traitEffectTotals([]).bonusHp).toBe(0);
    expect(traitEffectTotals([]).abilityBonus.str).toBe(0);
  });
});

describe("abilityScoreWithBonus", () => {
  it("returns the score untouched for a zero bonus, even outside [1, 25]", () => {
    expect(abilityScoreWithBonus(30, 0)).toBe(30);
    expect(abilityScoreWithBonus(0, 0)).toBe(0);
    expect(abilityScoreWithBonus(12, 0)).toBe(12);
  });

  it("adds a non-zero bonus and clamps the result to [1, 25]", () => {
    expect(abilityScoreWithBonus(12, 1)).toBe(13);
    expect(abilityScoreWithBonus(12, -2)).toBe(10);
    expect(abilityScoreWithBonus(25, 1)).toBe(25);
    expect(abilityScoreWithBonus(1, -1)).toBe(1);
    expect(abilityScoreWithBonus(24, 5)).toBe(25);
  });
});
```
- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/skills/traits.test.ts 2>&1 | tail -20`
Expected: FAIL (module `src/core/skills/traits` not found).

- [ ] **Step 3: Implement**

Create `src/core/skills/traits.ts`:
```typescript
// Player's Option: Skills & Powers traits (SP8 Plan 8c). A trait is a purchasable
// (or, at a negative cost, refunding) character feature whose mechanical effect
// is one entry of a CLOSED typed set, interpreted by pure derive code — never an
// ActiveEffect (spec §2). Every name, cost and amount below is this project's
// OWN design (content policy). No Foundry imports.
import type { AbilityKey, SaveCategory } from "../types";

export const TRAIT_EFFECT_KINDS = ["abilityBonus", "saveBonus", "attackBonus", "proficiencySlots", "bonusHp"] as const;
export type TraitEffectKind = (typeof TRAIT_EFFECT_KINDS)[number];

export const TRAIT_ATTACK_MODES = ["melee", "ranged"] as const;
export type TraitAttackMode = (typeof TRAIT_ATTACK_MODES)[number];

export const TRAIT_PROFICIENCY_TRACKS = ["weapon", "nonweapon"] as const;
export type TraitProficiencyTrack = (typeof TRAIT_PROFICIENCY_TRACKS)[number];

export const TRAIT_SAVE_CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

const ABILITY_IDS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export type TraitEffect =
  | { kind: "abilityBonus"; ability: AbilityKey; amount: number }
  | { kind: "saveBonus"; save: SaveCategory; amount: number }
  | { kind: "attackBonus"; mode: TraitAttackMode; amount: number }
  | { kind: "proficiencySlots"; track: TraitProficiencyTrack; amount: number }
  | { kind: "bonusHp"; amount: number };

/** The flat authored shape stored on a `trait` Item's `system.effect`. */
export interface RawTraitEffect {
  kind: string;
  ability: string;
  save: string;
  mode: string;
  track: string;
  amount: number;
}

export interface Trait {
  id: string;
  name: string;
  /** CP cost; negative for a disadvantage (a refund) */
  cost: number;
  effect: TraitEffect;
}

/** The 14 designed traits (spec §4.3.1), in spec order. */
export const TRAITS: readonly Trait[] = [
  { id: "hardy", name: "Hardy", cost: 6, effect: { kind: "bonusHp", amount: 4 } },
  { id: "iron-will", name: "Iron Will", cost: 5, effect: { kind: "saveBonus", save: "spell", amount: 1 } },
  { id: "resilient", name: "Resilient", cost: 5, effect: { kind: "saveBonus", save: "ppd", amount: 1 } },
  { id: "steady-aim", name: "Steady Aim", cost: 8, effect: { kind: "attackBonus", mode: "ranged", amount: 1 } },
  { id: "brawler", name: "Brawler", cost: 8, effect: { kind: "attackBonus", mode: "melee", amount: 1 } },
  { id: "quick-study", name: "Quick Study", cost: 4, effect: { kind: "proficiencySlots", track: "nonweapon", amount: 2 } },
  { id: "weapon-drill", name: "Weapon Drill", cost: 4, effect: { kind: "proficiencySlots", track: "weapon", amount: 1 } },
  { id: "powerful", name: "Powerful", cost: 7, effect: { kind: "abilityBonus", ability: "str", amount: 1 } },
  { id: "sturdy", name: "Sturdy", cost: 7, effect: { kind: "abilityBonus", ability: "con", amount: 1 } },
  { id: "frail", name: "Frail", cost: -4, effect: { kind: "bonusHp", amount: -3 } },
  { id: "nervous", name: "Nervous", cost: -4, effect: { kind: "saveBonus", save: "spell", amount: -1 } },
  { id: "poor-aim", name: "Poor Aim", cost: -5, effect: { kind: "attackBonus", mode: "ranged", amount: -1 } },
  { id: "slow-learner", name: "Slow Learner", cost: -3, effect: { kind: "proficiencySlots", track: "nonweapon", amount: -1 } },
  { id: "feeble", name: "Feeble", cost: -5, effect: { kind: "abilityBonus", ability: "str", amount: -1 } },
];

function isMember<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

/**
 * The typed effect a stored `system.effect` describes, or `null` when it is
 * malformed (blank/unknown kind, a missing or invalid target for that kind, a
 * non-integer amount). A `null` effect is INERT — the trait still costs or
 * refunds its `cost` in the ledger but changes nothing on the character.
 */
export function toTraitEffect(raw: RawTraitEffect): TraitEffect | null {
  if (!Number.isInteger(raw.amount)) return null;
  const amount = raw.amount;
  switch (raw.kind) {
    case "abilityBonus":
      return isMember(ABILITY_IDS, raw.ability) ? { kind: "abilityBonus", ability: raw.ability, amount } : null;
    case "saveBonus":
      return isMember(TRAIT_SAVE_CATEGORIES, raw.save) ? { kind: "saveBonus", save: raw.save, amount } : null;
    case "attackBonus":
      return isMember(TRAIT_ATTACK_MODES, raw.mode) ? { kind: "attackBonus", mode: raw.mode, amount } : null;
    case "proficiencySlots":
      return isMember(TRAIT_PROFICIENCY_TRACKS, raw.track) ? { kind: "proficiencySlots", track: raw.track, amount } : null;
    case "bonusHp":
      return { kind: "bonusHp", amount };
    default:
      return null;
  }
}

export interface TraitTotals {
  abilityBonus: Record<AbilityKey, number>;
  saveBonus: Record<SaveCategory, number>;
  attackBonus: Record<TraitAttackMode, number>;
  proficiencySlots: Record<TraitProficiencyTrack, number>;
  bonusHp: number;
}

/** The pure reducer over the owned traits' typed effects. */
export function traitEffectTotals(effects: readonly TraitEffect[]): TraitTotals {
  const totals: TraitTotals = {
    abilityBonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    saveBonus: { ppd: 0, rsw: 0, pp: 0, bw: 0, spell: 0 },
    attackBonus: { melee: 0, ranged: 0 },
    proficiencySlots: { weapon: 0, nonweapon: 0 },
    bonusHp: 0,
  };
  for (const effect of effects) {
    switch (effect.kind) {
      case "abilityBonus":
        totals.abilityBonus[effect.ability] += effect.amount;
        break;
      case "saveBonus":
        totals.saveBonus[effect.save] += effect.amount;
        break;
      case "attackBonus":
        totals.attackBonus[effect.mode] += effect.amount;
        break;
      case "proficiencySlots":
        totals.proficiencySlots[effect.track] += effect.amount;
        break;
      case "bonusHp":
        totals.bonusHp += effect.amount;
        break;
    }
  }
  return totals;
}

const MIN_SCORE = 1;
const MAX_SCORE = 25;

/**
 * An ability score after a trait bonus: the score UNCHANGED for a zero bonus
 * (so rule-off / no ability trait leaves prepared scores byte-identical, even an
 * authored score outside [1, 25]), else `score + bonus` clamped to [1, 25].
 */
export function abilityScoreWithBonus(score: number, bonus: number): number {
  if (bonus === 0) return score;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, score + bonus));
}
```

Create `src/core/skills/index.ts`:
```typescript
export * from "./traits";
```
(Task 2 appends `export * from "./character-points";`.) Add `export * from "./skills";` to `src/core/index.ts` after the `./proficiencies` line.

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `npx vitest run tests/core/skills/traits.test.ts 2>&1 | tail -20` — Expected: all pass.
Run: `npm run typecheck > "$TEMP/tc.log" 2>&1; echo "tc $?"; tail -5 "$TEMP/tc.log"` and `npm run lint > "$TEMP/lint.log" 2>&1; echo "lint $?"; tail -5 "$TEMP/lint.log"` — Expected: exit 0 both.
Run: `npm run test:coverage > "$TEMP/cov.log" 2>&1; echo "cov $?"; tail -20 "$TEMP/cov.log"` — Expected: exit 0, `src/core/skills/traits.ts` at 100%.

- [ ] **Step 5: Commit**

```bash
git add src/core/skills src/core/index.ts tests/core/skills
git commit -m "feat(sp8c): add pure trait table, effect union and reducer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure character-point module

**Files:**
- Create: `src/core/skills/character-points.ts`
- Modify: `src/core/skills/index.ts` (append `export * from "./character-points";`)
- Test: `tests/core/skills/character-points.test.ts`

**Interfaces:**
- Consumes: `OptionalRules` (`src/core/options.ts`), `subAbilitiesEnabled` and `SUB_ABILITIES` (`src/core/abilities/sub-abilities.ts`), `AbilityKey`.
- Produces (consumed by Tasks 5-8):
  - `DISADVANTAGE_REFUND_CAP = 10`, `DEFAULT_CHARACTER_POINT_POOL = 60`
  - `characterPointBuildEnabled(rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">): boolean` — THE one gate
  - `subScoreCpCost(score: number): number`
  - `disadvantageRefund(traitCosts: readonly number[]): number`
  - `interface CharacterPointLedger { pool; subSpent; traitSpent; refund; refundUncapped; spent; available; overspent }` and `characterPointLedger(input: { pool: number; subScores: readonly (number | null)[]; traitCosts: readonly number[] }): CharacterPointLedger`
  - `authoredSubScores(abilities: Partial<Record<AbilityKey, { sub?: { a: number | null; b: number | null } | null }>>): (number | null)[]`
  - `characterPointLedgerFor(rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild" | "subAbilityScores">, input: { pool: number; abilities: <same as authoredSubScores>; traitCosts: readonly number[] }): CharacterPointLedger | null` — `null` ⇔ the rule is off
  - `type TraitDropVerdict = { ok: true; refund: number } | { ok: false; reason: string }` and `canAffordTrait(input: { traitCost: number; traitId: string; ownedTraitIds: readonly string[]; available: number; refundedSoFar: number }): TraitDropVerdict`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/skills/character-points.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  DEFAULT_CHARACTER_POINT_POOL,
  DISADVANTAGE_REFUND_CAP,
  authoredSubScores,
  canAffordTrait,
  characterPointBuildEnabled,
  characterPointLedger,
  characterPointLedgerFor,
  disadvantageRefund,
  subScoreCpCost,
} from "../../../src/core/skills/character-points";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("constants", () => {
  it("pins the refund cap and the default pool", () => {
    expect(DISADVANTAGE_REFUND_CAP).toBe(10);
    expect(DEFAULT_CHARACTER_POINT_POOL).toBe(60);
  });
});

describe("characterPointBuildEnabled (the one gate)", () => {
  it("needs the master switch AND the character-point toggle", () => {
    expect(characterPointBuildEnabled(rules())).toBe(false);
    expect(characterPointBuildEnabled(rules({ skillsAndPowersEnabled: true }))).toBe(false);
    expect(characterPointBuildEnabled(rules({ characterPointBuild: true }))).toBe(false);
    expect(characterPointBuildEnabled(rules({ skillsAndPowersEnabled: true, characterPointBuild: true }))).toBe(true);
  });
});

describe("subScoreCpCost — every range boundary", () => {
  it.each([
    [1, -4], [5, -4], [6, -4],
    [7, -3], [8, -2], [9, -1], [10, 0],
    [11, 1], [12, 2], [13, 3], [14, 4],
    [15, 6], [16, 8], [17, 10],
    [18, 13], [19, 16], [24, 31], [25, 34],
  ])("score %i costs %i", (score, cost) => {
    expect(subScoreCpCost(score)).toBe(cost);
  });
});

describe("disadvantageRefund", () => {
  it("sums the negative costs and caps the total at DISADVANTAGE_REFUND_CAP", () => {
    expect(disadvantageRefund([])).toBe(0);
    expect(disadvantageRefund([6, 8])).toBe(0);
    expect(disadvantageRefund([-4])).toBe(4);
    expect(disadvantageRefund([-4, -5, 6])).toBe(9);
    expect(disadvantageRefund([-4, -4, -5])).toBe(10);
    expect(disadvantageRefund([-10])).toBe(10);
  });
});

describe("characterPointLedger", () => {
  it("an untouched character has the whole pool available", () => {
    expect(characterPointLedger({ pool: 60, subScores: [], traitCosts: [] })).toEqual({
      pool: 60, subSpent: 0, traitSpent: 0, refund: 0, refundUncapped: 0, spent: 0, available: 60, overspent: false,
    });
  });

  it("sub-scores cost by the curve; null sub-scores are uncommitted and cost nothing", () => {
    const l = characterPointLedger({ pool: 60, subScores: [18, 10, null, 6], traitCosts: [] });
    expect(l.subSpent).toBe(9); // 13 + 0 + (-4)
    expect(l.spent).toBe(9);
    expect(l.available).toBe(51);
  });

  it("advantages add, cost-0 traits add nothing, disadvantages refund up to the cap", () => {
    const l = characterPointLedger({ pool: 60, subScores: [], traitCosts: [6, 8, 0, -4, -5, -3] });
    expect(l.traitSpent).toBe(14);
    expect(l.refundUncapped).toBe(12);
    expect(l.refund).toBe(10);
    expect(l.spent).toBe(4); // 14 - 10
    expect(l.available).toBe(56);
  });

  it("spent can be negative (uncapped sub-score refunds) and available exceeds the pool", () => {
    const l = characterPointLedger({ pool: 60, subScores: Array(12).fill(6), traitCosts: [] });
    expect(l.spent).toBe(-48);
    expect(l.available).toBe(108);
    expect(l.overspent).toBe(false);
  });

  it("is overspent only when available drops below zero", () => {
    expect(characterPointLedger({ pool: 8, subScores: [], traitCosts: [8] }).overspent).toBe(false);
    const over = characterPointLedger({ pool: 5, subScores: [], traitCosts: [8] });
    expect(over.available).toBe(-3);
    expect(over.overspent).toBe(true);
  });
});

describe("authoredSubScores", () => {
  it("flattens the twelve sub-scores in ability order (str a,b then dex a,b ...)", () => {
    const abilities = {
      str: { sub: { a: 1, b: 2 } },
      dex: { sub: { a: 3, b: 4 } },
      con: { sub: { a: 5, b: 6 } },
      int: { sub: { a: 7, b: 8 } },
      wis: { sub: { a: 9, b: 10 } },
      cha: { sub: { a: 11, b: 12 } },
    };
    expect(authoredSubScores(abilities)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("treats a missing ability, a missing/null sub object and null members as null", () => {
    expect(
      authoredSubScores({ str: { sub: { a: 14, b: null } }, dex: { sub: null }, con: {} }),
    ).toEqual([14, null, null, null, null, null, null, null, null, null, null, null]);
  });
});

describe("characterPointLedgerFor", () => {
  const abilities = { str: { sub: { a: 18, b: 14 } } };
  const input = { pool: 60, abilities, traitCosts: [6] };

  it("is null while the rule is off, in any of its three off combinations", () => {
    expect(characterPointLedgerFor(rules(), input)).toBeNull();
    expect(characterPointLedgerFor(rules({ skillsAndPowersEnabled: true }), input)).toBeNull();
    expect(characterPointLedgerFor(rules({ characterPointBuild: true, subAbilityScores: true }), input)).toBeNull();
  });

  it("counts traits only when sub-ability scores are not also on", () => {
    const l = characterPointLedgerFor(rules({ skillsAndPowersEnabled: true, characterPointBuild: true }), input)!;
    expect(l.subSpent).toBe(0);
    expect(l.spent).toBe(6);
  });

  it("counts the authored sub-scores when sub-ability scores are also on", () => {
    const l = characterPointLedgerFor(
      rules({ skillsAndPowersEnabled: true, characterPointBuild: true, subAbilityScores: true }),
      input,
    )!;
    expect(l.subSpent).toBe(17); // 13 (18) + 4 (14)
    expect(l.spent).toBe(23);
    expect(l.available).toBe(37);
  });
});

describe("canAffordTrait", () => {
  const base = { traitCost: 6, traitId: "hardy", ownedTraitIds: [] as string[], available: 10, refundedSoFar: 0 };

  it("rejects a trait the actor already owns", () => {
    expect(canAffordTrait({ ...base, ownedTraitIds: ["hardy"] })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.duplicateTrait" });
  });

  it("never treats a blank traitId (a hand-made custom trait) as a duplicate", () => {
    expect(canAffordTrait({ ...base, traitId: "", ownedTraitIds: [""] })).toEqual({ ok: true, refund: 0 });
  });

  it("allows an advantage costing exactly what is available, rejects one costing more", () => {
    expect(canAffordTrait({ ...base, traitCost: 10 })).toEqual({ ok: true, refund: 0 });
    expect(canAffordTrait({ ...base, traitCost: 11 })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.insufficientCp" });
  });

  it("always allows a free trait, even when the ledger is already overspent", () => {
    expect(canAffordTrait({ ...base, traitCost: 0, available: -3 })).toEqual({ ok: true, refund: 0 });
  });

  it("allows a disadvantage with its full refund while under the cap", () => {
    expect(canAffordTrait({ ...base, traitCost: -4, refundedSoFar: 3 })).toEqual({ ok: true, refund: 4 });
  });

  it("allows a disadvantage but clamps its refund at the remaining cap", () => {
    expect(canAffordTrait({ ...base, traitCost: -8, refundedSoFar: 5 })).toEqual({ ok: true, refund: 5 });
  });

  it("still allows a disadvantage once the cap is spent, refunding nothing", () => {
    expect(canAffordTrait({ ...base, traitCost: -4, refundedSoFar: 10 })).toEqual({ ok: true, refund: 0 });
    expect(canAffordTrait({ ...base, traitCost: -4, refundedSoFar: 12 })).toEqual({ ok: true, refund: 0 });
  });

  it("allows a disadvantage even when the ledger is overspent", () => {
    expect(canAffordTrait({ ...base, traitCost: -4, available: -9 })).toEqual({ ok: true, refund: 4 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/skills/character-points.test.ts 2>&1 | tail -20`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/core/skills/character-points.ts`:
```typescript
// Player's Option: Skills & Powers character-point build (SP8 Plan 8c). CP is a
// creation budget spent on sub-scores and traits; spent CP is DERIVED from the
// authored sub-scores and owned traits, so removing a trait refunds it
// automatically (spec §2). The cost curve, the pool default and the refund cap
// are this project's OWN designed numbers (content policy). No Foundry imports.
import { SUB_ABILITIES, subAbilitiesEnabled } from "../abilities/sub-abilities";
import type { OptionalRules } from "../options";
import type { AbilityKey } from "../types";

/** Total CP that disadvantage traits may refund; a disadvantage past the cap still applies its effect. */
export const DISADVANTAGE_REFUND_CAP = 10;

/** The authored pool a new character starts with (GM-editable). */
export const DEFAULT_CHARACTER_POINT_POOL = 60;

/**
 * THE one place the character-point-build gate is written (master AND-gate,
 * spec §2). Everything else — the ledger helper, the derive/prepare trait
 * totals, the drop rule — is built on this; never restate the expression.
 */
export function characterPointBuildEnabled(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">,
): boolean {
  return rules.skillsAndPowersEnabled && rules.characterPointBuild;
}

/**
 * CP cost of one sub-score (spec §4.3): <= 6 -> -4 (the maximum refund); 7..14 ->
 * score - 10 (baseline 10 costs 0); 15..17 -> 4 + 2 * (score - 14); 18..25 ->
 * 10 + 3 * (score - 17). Reaching 25 costs 34.
 */
export function subScoreCpCost(score: number): number {
  if (score <= 6) return -4;
  if (score <= 14) return score - 10;
  if (score <= 17) return 4 + 2 * (score - 14);
  return 10 + 3 * (score - 17);
}

/** Total CP the disadvantage traits refund, capped at `DISADVANTAGE_REFUND_CAP`. */
export function disadvantageRefund(traitCosts: readonly number[]): number {
  return Math.min(DISADVANTAGE_REFUND_CAP, uncappedRefund(traitCosts));
}

function uncappedRefund(traitCosts: readonly number[]): number {
  return traitCosts.reduce((sum, cost) => (cost < 0 ? sum - cost : sum), 0);
}

export interface CharacterPointLedger {
  pool: number;
  /** Σ subScoreCpCost over the AUTHORED (non-null) sub-scores */
  subSpent: number;
  /** Σ positive trait costs */
  traitSpent: number;
  /** disadvantage refund after the cap */
  refund: number;
  /** disadvantage refund before the cap */
  refundUncapped: number;
  /** subSpent + traitSpent - refund (may be negative: sub-score refunds are uncapped) */
  spent: number;
  available: number;
  overspent: boolean;
}

/**
 * The CP ledger. A `null` sub-score is uncommitted and costs 0 (even though the
 * derivation falls back to the main score for it), so an existing character
 * with authored main scores shows no false overspend when the rules are enabled.
 */
export function characterPointLedger(input: {
  pool: number;
  subScores: readonly (number | null)[];
  traitCosts: readonly number[];
}): CharacterPointLedger {
  const subSpent = input.subScores.reduce<number>((sum, s) => (s === null ? sum : sum + subScoreCpCost(s)), 0);
  const traitSpent = input.traitCosts.reduce((sum, cost) => (cost > 0 ? sum + cost : sum), 0);
  const refundUncapped = uncappedRefund(input.traitCosts);
  const refund = Math.min(DISADVANTAGE_REFUND_CAP, refundUncapped);
  const spent = subSpent + traitSpent - refund;
  const available = input.pool - spent;
  return { pool: input.pool, subSpent, traitSpent, refund, refundUncapped, spent, available, overspent: available < 0 };
}

type AuthoredAbilities = Partial<
  Record<AbilityKey, { sub?: { a: number | null; b: number | null } | null }>
>;

/** The twelve AUTHORED sub-scores (null = unset), in ability order: str a,b, dex a,b, ... */
export function authoredSubScores(abilities: AuthoredAbilities): (number | null)[] {
  const out: (number | null)[] = [];
  for (const key of Object.keys(SUB_ABILITIES) as AbilityKey[]) {
    const sub = abilities[key]?.sub;
    out.push(sub?.a ?? null, sub?.b ?? null);
  }
  return out;
}

/**
 * The ledger for an actor, or `null` while the character-point build rule is off
 * (so a `null` ledger IS the gate for the sheet context and the drop handler).
 * Sub-scores count toward the ledger only when sub-ability scores are ALSO on.
 */
export function characterPointLedgerFor(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild" | "subAbilityScores">,
  input: { pool: number; abilities: AuthoredAbilities; traitCosts: readonly number[] },
): CharacterPointLedger | null {
  if (!characterPointBuildEnabled(rules)) return null;
  return characterPointLedger({
    pool: input.pool,
    subScores: subAbilitiesEnabled(rules) ? authoredSubScores(input.abilities) : [],
    traitCosts: input.traitCosts,
  });
}

export type TraitDropVerdict = { ok: true; refund: number } | { ok: false; reason: string };

/**
 * Whether a trait may be taken. Rejects a duplicate `traitId` (a blank id — a
 * hand-made custom trait — never duplicates) and an advantage costing more than
 * `available`. A disadvantage is always allowed; the verdict's `refund` is the
 * CP it actually returns after the cap (`refundedSoFar` = the cap already used).
 */
export function canAffordTrait(input: {
  traitCost: number;
  traitId: string;
  ownedTraitIds: readonly string[];
  available: number;
  refundedSoFar: number;
}): TraitDropVerdict {
  if (input.traitId !== "" && input.ownedTraitIds.includes(input.traitId)) {
    return { ok: false, reason: "ADND2E.sheet.drop.duplicateTrait" };
  }
  if (input.traitCost < 0) {
    const room = Math.max(0, DISADVANTAGE_REFUND_CAP - input.refundedSoFar);
    return { ok: true, refund: Math.min(-input.traitCost, room) };
  }
  if (input.traitCost > 0 && input.traitCost > input.available) {
    return { ok: false, reason: "ADND2E.sheet.drop.insufficientCp" };
  }
  return { ok: true, refund: 0 };
}
```
Append `export * from "./character-points";` to `src/core/skills/index.ts`.

- [ ] **Step 4: Run tests, typecheck, lint, coverage**

Run: `npx vitest run tests/core/skills 2>&1 | tail -20` — all pass.
Run typecheck, lint and `npm run test:coverage` as in Task 1 Step 4 — exit 0; `src/core/skills/*.ts` at 100%.

- [ ] **Step 5: Commit**

```bash
git add src/core/skills tests/core/skills
git commit -m "feat(sp8c): add pure character-point module (cost curve, ledger, trait affordability)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `trait` Item subtype

**Files:**
- Create: `src/data/item/trait.ts`
- Modify: `src/data/item/subtypes.ts`, `src/data/item/choices.ts`, `src/data/item/index.ts`, `system.json` (`documentTypes.Item`), `lang/en.json` (`TYPES.Item`)
- Test: `tests/data/choices.test.ts` (extend)

**Interfaces:**
- Consumes: `TRAIT_EFFECT_KINDS`, `TRAIT_ATTACK_MODES`, `TRAIT_PROFICIENCY_TRACKS`, `TRAIT_SAVE_CATEGORIES` (Task 1), `ABILITY_KEYS` (`choices.ts`), `Adnd2eItemModel`.
- Produces: `ItemSubtype` gains `"trait"`; `choices.ts` re-exports the four trait choice arrays; `TraitItemModel` with `system.traitId: string`, `system.cost: number`, `system.effect: { kind, ability, save, mode, track, amount }` (the `RawTraitEffect` shape).

- [ ] **Step 1: Failing tests first**

In `tests/data/choices.test.ts`, add `TRAIT_EFFECT_KINDS, TRAIT_ATTACK_MODES, TRAIT_PROFICIENCY_TRACKS, TRAIT_SAVE_CATEGORIES` to the import from `"../../src/data/item/choices"` and append:
```typescript
describe("trait effect choice arrays (SP8 Plan 8c)", () => {
  it("match the pure trait enums", () => {
    expect([...TRAIT_EFFECT_KINDS]).toEqual(["abilityBonus", "saveBonus", "attackBonus", "proficiencySlots", "bonusHp"]);
    expect([...TRAIT_ATTACK_MODES]).toEqual(["melee", "ranged"]);
    expect([...TRAIT_PROFICIENCY_TRACKS]).toEqual(["weapon", "nonweapon"]);
    expect([...TRAIT_SAVE_CATEGORIES]).toEqual(["ppd", "rsw", "pp", "bw", "spell"]);
  });
});
```
Run `npx vitest run tests/data 2>&1 | tail -20` — Expected: choices test FAILS to compile/import; `tests/data/subtypes.test.ts` still passes until `system.json` changes (do the edits below together so it stays green).

- [ ] **Step 2: Implement**

1. `src/data/item/subtypes.ts`: change the header comment to "eleven Item sub-types", append `| "trait"` to the `ItemSubtype` union and `"trait"` to `ITEM_SUBTYPES`.
2. `src/data/item/choices.ts`: add at the end
```typescript
export {
  TRAIT_EFFECT_KINDS, TRAIT_ATTACK_MODES, TRAIT_PROFICIENCY_TRACKS, TRAIT_SAVE_CATEGORIES,
} from "../../core/skills/traits";
```
3. Create `src/data/item/trait.ts`:
```typescript
import { Adnd2eItemModel } from "./base-item";
import {
  ABILITY_KEYS, TRAIT_ATTACK_MODES, TRAIT_EFFECT_KINDS, TRAIT_PROFICIENCY_TRACKS, TRAIT_SAVE_CATEGORIES,
} from "./choices";

const { StringField, NumberField, SchemaField } = foundry.data.fields;

/** A blank-able choice string: real v14.364 `StringField#_validateSpecial` accepts "" before it consults `choices` (common/data/fields.mjs:1707-1723). */
const choice = (choices: readonly string[]) =>
  new StringField({ required: true, blank: true, initial: "", choices });

/**
 * SP8 Plan 8c: a purchasable (cost > 0) or refunding (cost < 0) character trait
 * whose effect is one entry of the closed typed set. The members of `effect`
 * that a `kind` does not use stay "" — the pure `toTraitEffect` picks the ones
 * it needs and treats anything malformed as inert.
 */
export class TraitItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      traitId: new StringField({ required: true, blank: true, initial: "" }),
      cost: new NumberField({ required: true, integer: true, initial: 0 }),
      effect: new SchemaField({
        kind: choice(TRAIT_EFFECT_KINDS),
        ability: choice(ABILITY_KEYS),
        save: choice(TRAIT_SAVE_CATEGORIES),
        mode: choice(TRAIT_ATTACK_MODES),
        track: choice(TRAIT_PROFICIENCY_TRACKS),
        amount: new NumberField({ required: true, integer: true, initial: 0 }),
      }),
    };
  }
}
```
4. `src/data/item/index.ts`: import `TraitItemModel` from `"./trait"`, add it to the `export { … }` list and `trait: TraitItemModel` to `ITEM_DATA_MODELS`.
5. `system.json`: add `"trait": {}` after `"condition": {}` in `documentTypes.Item` (mind the comma).
6. `lang/en.json`: add `"trait": "Trait"` to `TYPES.Item` (after `"condition": "Condition"`, mind the comma).

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/data tests/lang tests/config 2>&1 | tail -25` — Expected: all pass (`ITEM_SUBTYPES` ≡ `system.json` `documentTypes.Item`, `TYPES.Item` keys ≡ `ITEM_SUBTYPES`).
Run typecheck + lint + `npm run test:coverage` (exit 0).
**Additive check (write the answer in your report):** confirm no existing world data can contain a `trait` item, so no migration is needed, and that `system.json` `version` and `package.json` are untouched.

- [ ] **Step 4: Commit**

```bash
git add src/data/item system.json lang/en.json tests/data/choices.test.ts
git commit -m "feat(sp8c): register the trait Item subtype

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `packs/traits` compendium (14 traits)

**Files:**
- Create: `packs/traits/_source/*.json` (14 docs) and `packs/traits/_source/_MANIFEST.md`
- Modify: `system.json` (`packs` + `packFolders`), `tests/config/system-json.test.ts`, `tests/packs/content.test.ts`

**Interfaces:**
- Consumes: `TRAITS`, `toTraitEffect` (Task 1); the `trait` subtype (Task 3).
- Produces: a 14-doc Item pack named `traits`.

**Do NOT run `npm run build`/`build:packs`** — the controller compiles the pack at Task 10; the source + drift tests cover structure until then.

- [ ] **Step 1: Failing tests first**

In `tests/config/system-json.test.ts` change the pack test to:
```typescript
  it("ships the 7 Item compendium packs", () => {
    expect(manifest.packs ?? []).toHaveLength(7);
    const names = (manifest.packs ?? []).map((p: unknown) => (p as Record<string, unknown>).name).sort();
    expect(names).toEqual(["classes", "conditions", "nonweapon-proficiencies", "races", "traits", "weapon-proficiencies", "weapon-proficiency-groups"]);
  });
```
(Keep the surrounding test bodies otherwise unchanged; if a test TITLE elsewhere in the file hard-codes "6", update it.)

Append to `tests/packs/content.test.ts` (reuse the file's existing `docs(pack)` and `sys(d)` helpers and add the imports `import { TRAITS, toTraitEffect, type RawTraitEffect } from "../../src/core/skills/traits";` at the top with the other imports):
```typescript
describe("traits pack content (drift-tested against the pure TRAITS table)", () => {
  const items = docs("traits");

  it("has exactly one trait Item per TRAITS row (14), with unique ids and names", () => {
    expect(items).toHaveLength(14);
    expect(items).toHaveLength(TRAITS.length);
    expect(new Set(items.map((d) => d._id)).size).toBe(14);
    expect(new Set(items.map((d) => d.name)).size).toBe(14);
    for (const d of items) expect(d.type, String(d.name)).toBe("trait");
  });

  it("every doc matches its TRAITS row: name, cost, img, traitId and effect", () => {
    for (const t of TRAITS) {
      const d = items.find((x) => sys(x).traitId === t.id);
      expect(d, t.id).toBeDefined();
      expect(d!.name, t.id).toBe(t.name);
      expect(sys(d!).cost, t.id).toBe(t.cost);
      expect(sys(d!).description, t.id).toBe("");
      expect(d!.img, t.id).toBe(t.cost < 0 ? "icons/svg/downgrade.svg" : "icons/svg/upgrade.svg");
      // round-trip: the stored flat effect must normalise to exactly the table's typed effect
      expect(toTraitEffect(sys(d!).effect as RawTraitEffect), t.id).toEqual(t.effect);
    }
  });

  it("stores the flat effect with every member present (unused members blank)", () => {
    for (const d of items) {
      const e = sys(d).effect as Record<string, unknown>;
      expect(Object.keys(e).sort(), String(d.name)).toEqual(["ability", "amount", "kind", "mode", "save", "track"]);
    }
  });
});
```
Run: `npx vitest run tests/config tests/packs 2>&1 | tail -25` — Expected FAIL (no `traits` pack yet).

- [ ] **Step 2: Generate the 14 docs**

Write this generator OUTSIDE the repo (e.g. `$TEMP/gen-traits.mjs`) and run it from the repo root with `node "$TEMP/gen-traits.mjs"`. It prints the files it wrote; do not commit the script.
```javascript
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve("packs", "traits", "_source");
mkdirSync(dir, { recursive: true });

// [id, name, cost, kind, ability, save, mode, track, amount]
const ROWS = [
  ["hardy", "Hardy", 6, "bonusHp", "", "", "", "", 4],
  ["iron-will", "Iron Will", 5, "saveBonus", "", "spell", "", "", 1],
  ["resilient", "Resilient", 5, "saveBonus", "", "ppd", "", "", 1],
  ["steady-aim", "Steady Aim", 8, "attackBonus", "", "", "ranged", "", 1],
  ["brawler", "Brawler", 8, "attackBonus", "", "", "melee", "", 1],
  ["quick-study", "Quick Study", 4, "proficiencySlots", "", "", "", "nonweapon", 2],
  ["weapon-drill", "Weapon Drill", 4, "proficiencySlots", "", "", "", "weapon", 1],
  ["powerful", "Powerful", 7, "abilityBonus", "str", "", "", "", 1],
  ["sturdy", "Sturdy", 7, "abilityBonus", "con", "", "", "", 1],
  ["frail", "Frail", -4, "bonusHp", "", "", "", "", -3],
  ["nervous", "Nervous", -4, "saveBonus", "", "spell", "", "", -1],
  ["poor-aim", "Poor Aim", -5, "attackBonus", "", "", "ranged", "", -1],
  ["slow-learner", "Slow Learner", -3, "proficiencySlots", "", "", "", "nonweapon", -1],
  ["feeble", "Feeble", -5, "abilityBonus", "str", "", "", "", -1],
];

for (const [traitId, name, cost, kind, ability, save, mode, track, amount] of ROWS) {
  const _id = createHash("sha1").update(`adnd2e-trait:${name}`).digest("hex").slice(0, 16);
  const doc = {
    _id,
    _key: `!items!${_id}`,
    name,
    type: "trait",
    img: cost < 0 ? "icons/svg/downgrade.svg" : "icons/svg/upgrade.svg",
    system: { description: "", traitId, cost, effect: { kind, ability, save, mode, track, amount } },
  };
  const file = path.join(dir, `${traitId}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log("wrote", file);
}
```
Then create `packs/traits/_source/_MANIFEST.md`:
```markdown
# `traits` pack — source manifest

Fourteen character traits for the Skills & Powers character-point build (Sub-project 8, Plan 8c). Each document is a `trait` Item: `system.traitId`, `system.cost` (negative = a disadvantage that refunds CP, capped at 10 CP in total), and `system.effect` — the flat typed effect (`kind` plus the one target member that kind uses; unused members are `""`).

Names, costs and amounts are this project's OWN designed values (no book tables or trait descriptions are reproduced); `system.description` is `""`. Docs are drift-tested against the pure `TRAITS` table (`src/core/skills/traits.ts`) by `tests/packs/content.test.ts`. `_id` is the first 16 hex characters of SHA-1 of `adnd2e-trait:<name>`; `_key` is `!items!<_id>` (docs without `_key` compile to an EMPTY pack).

| traitId | name | cost | effect |
|---|---|---|---|
| hardy | Hardy | 6 | bonusHp +4 |
| iron-will | Iron Will | 5 | saveBonus spell +1 |
| resilient | Resilient | 5 | saveBonus ppd +1 |
| steady-aim | Steady Aim | 8 | attackBonus ranged +1 |
| brawler | Brawler | 8 | attackBonus melee +1 |
| quick-study | Quick Study | 4 | proficiencySlots nonweapon +2 |
| weapon-drill | Weapon Drill | 4 | proficiencySlots weapon +1 |
| powerful | Powerful | 7 | abilityBonus str +1 |
| sturdy | Sturdy | 7 | abilityBonus con +1 |
| frail | Frail | −4 | bonusHp −3 |
| nervous | Nervous | −4 | saveBonus spell −1 |
| poor-aim | Poor Aim | −5 | attackBonus ranged −1 |
| slow-learner | Slow Learner | −3 | proficiencySlots nonweapon −1 |
| feeble | Feeble | −5 | abilityBonus str −1 |
```

- [ ] **Step 3: Register the pack in `system.json`**

Append to `packs` (after the `conditions` entry, adding a comma to it):
```json
    { "name": "traits", "label": "Traits", "path": "packs/traits", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } }
```
and to the `folders` array of the "AD&D 2E — Rules Content" pack folder, after the "Conditions" entry (adding a comma to it):
```json
        { "name": "Skills & Powers", "sorting": "a", "packs": ["traits"] }
```

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/config tests/packs 2>&1 | tail -25` — Expected: all pass (including the generic `tests/packs/source.test.ts` structure checks: every doc has `_id`/`_key`/`name`/`type`, `type` ∈ `ITEM_SUBTYPES`).
Run typecheck + lint + `npm run test:coverage` (exit 0). Confirm `git status` shows 14 `.json` docs + `_MANIFEST.md` under `packs/traits/_source/` and no generator script in the repo.

- [ ] **Step 5: Commit**

```bash
git add packs/traits system.json tests/config/system-json.test.ts tests/packs/content.test.ts
git commit -m "feat(sp8c): add the traits compendium pack (14 designed traits)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Pure derive layer — trait adapter

**Files:**
- Create: `src/data/derive/character/traits.ts`
- Modify: `src/data/derive/character/snapshot.ts`, `src/data/derive/character/derive.ts`, `src/data/derive/character/index.ts`, `tests/data/derive/character/derive.test.ts` (fixtures)
- Test: `tests/data/derive/character/traits.test.ts`

**Interfaces:**
- Consumes: `characterPointBuildEnabled` (Task 2), `traitEffectTotals`, `toTraitEffect`, `TraitTotals`, `TraitEffect`, `RawTraitEffect` (Task 1), `CharacterDerived`, `SlotBlock`.
- Produces (consumed by Task 6):
  - `interface TraitEntry { traitId: string; cost: number; effect: TraitEffect }` (in `snapshot.ts`) and `ActorSnapshot.traits: readonly TraitEntry[]` (REQUIRED)
  - `toTraitEntries(items: Iterable<{ type: string; system: unknown }>): TraitEntry[]` — owned `trait` items with a well-formed effect, in item order
  - `resolveTraitTotals(traits: readonly TraitEntry[], rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">): TraitTotals` — zero totals when the rule is off (THE derive-side gate)
  - `applyBonusHp(hpMax: number, bonus: number): number`
  - `applyTraitEffects(derived: CharacterDerived, totals: TraitTotals): CharacterDerived` — applies save / attack / proficiency-slot / bonus-HP totals; **ignores `abilityBonus`** (Task 6 applies those in `prepareBaseData`)
  - `deriveCharacter` keeps its signature and now returns the trait-adjusted result

- [ ] **Step 1: Write the failing tests**

Create `tests/data/derive/character/traits.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { TRAITS } from "../../../../src/core/skills/traits";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot, TraitEntry } from "../../../../src/data/derive/character/snapshot";
import { applyBonusHp, resolveTraitTotals, toTraitEntries } from "../../../../src/data/derive/character/traits";

const ON = { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true, characterPointBuild: true };

const snap: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [
    { chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [10], dualClassState: null, level: 1 },
  ],
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
};

function entry(id: string): TraitEntry {
  const t = TRAITS.find((x) => x.id === id)!;
  return { traitId: t.id, cost: t.cost, effect: t.effect };
}
const withTraits = (...ids: string[]): ActorSnapshot => ({ ...snap, traits: ids.map(entry) });

const base = deriveCharacter(snap, ON);

describe("deriveCharacter — trait effects (rule ON)", () => {
  it("Hardy / Frail adjust hpMax", () => {
    expect(deriveCharacter(withTraits("hardy"), ON).hpMax).toBe(base.hpMax + 4);
    expect(deriveCharacter(withTraits("frail"), ON).hpMax).toBe(base.hpMax - 3);
  });

  it("save traits move only their category: rollModifier up, effectiveTarget down, target unchanged", () => {
    const d = deriveCharacter(withTraits("iron-will", "nervous", "nervous"), ON);
    // +1 then -1 -1  => net -1 on spell
    expect(d.saves!.spell.rollModifier).toBe(base.saves!.spell.rollModifier - 1);
    expect(d.saves!.spell.effectiveTarget).toBe(base.saves!.spell.effectiveTarget + 1);
    expect(d.saves!.spell.target).toBe(base.saves!.spell.target);
    expect(d.saves!.ppd).toEqual(base.saves!.ppd);
    const r = deriveCharacter(withTraits("resilient"), ON);
    expect(r.saves!.ppd.rollModifier).toBe(base.saves!.ppd.rollModifier + 1);
    expect(r.saves!.ppd.effectiveTarget).toBe(base.saves!.ppd.effectiveTarget - 1);
  });

  it("attack traits lower (or raise) only that mode's THAC0; base is untouched", () => {
    const b = deriveCharacter(withTraits("brawler"), ON);
    expect(b.thac0!.melee).toBe(base.thac0!.melee - 1);
    expect(b.thac0!.ranged).toBe(base.thac0!.ranged);
    expect(b.thac0!.base).toBe(base.thac0!.base);
    const s = deriveCharacter(withTraits("steady-aim", "poor-aim", "poor-aim"), ON);
    expect(s.thac0!.ranged).toBe(base.thac0!.ranged + 1); // -1 +1 +1
    expect(s.thac0!.melee).toBe(base.thac0!.melee);
  });

  it("proficiency-slot traits move total and available, never spent", () => {
    const q = deriveCharacter(withTraits("quick-study", "weapon-drill"), ON);
    expect(q.proficiencies!.nonweapon.total).toBe(base.proficiencies!.nonweapon.total + 2);
    expect(q.proficiencies!.nonweapon.available).toBe(base.proficiencies!.nonweapon.available + 2);
    expect(q.proficiencies!.weapon.total).toBe(base.proficiencies!.weapon.total + 1);
    expect(q.proficiencies!.weapon.spent).toBe(base.proficiencies!.weapon.spent);
    expect(q.proficiencies!.languagesMax).toBe(base.proficiencies!.languagesMax);
  });

  it("a slot penalty floors total at 0 and can leave available negative when slots were already spent", () => {
    const many: TraitEntry[] = Array.from({ length: 10 }, () => entry("slow-learner"));
    const d = deriveCharacter({ ...snap, spentNonweaponSlots: 1, traits: many }, ON);
    expect(d.proficiencies!.nonweapon.total).toBe(0);
    expect(d.proficiencies!.nonweapon.spent).toBe(1);
    expect(d.proficiencies!.nonweapon.available).toBe(-1);
  });

  it("IGNORES ability traits — those are applied to the prepared score in prepareBaseData, so they can never be double-counted here", () => {
    const d = deriveCharacter(withTraits("powerful", "sturdy", "feeble"), ON);
    expect(d.abilities.scores).toEqual(base.abilities.scores);
    expect(d).toEqual(base);
  });

  it("leaves a class-less actor's null blocks null and its hpMax at 0", () => {
    const empty: ActorSnapshot = { ...snap, classes: [], traits: [entry("hardy"), entry("brawler"), entry("iron-will"), entry("quick-study")] };
    const d = deriveCharacter(empty, ON);
    expect(d.thac0).toBeNull();
    expect(d.saves).toBeNull();
    expect(d.proficiencies).toBeNull();
    expect(d.hpMax).toBe(0);
  });
});

describe("deriveCharacter — trait effects are skipped entirely while the rule is off", () => {
  const all = withTraits("hardy", "iron-will", "brawler", "quick-study", "weapon-drill", "frail");
  it.each([
    ["everything off", DEFAULT_OPTIONAL_RULES],
    ["master only", { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true }],
    ["toggle only", { ...DEFAULT_OPTIONAL_RULES, characterPointBuild: true }],
  ])("%s → identical to a trait-less derive", (_label, rules) => {
    expect(deriveCharacter(all, rules)).toEqual(deriveCharacter(snap, rules));
  });
});

describe("applyBonusHp", () => {
  it("returns hpMax unchanged for a zero bonus or when there is no HP to adjust", () => {
    expect(applyBonusHp(10, 0)).toBe(10);
    expect(applyBonusHp(0, 4)).toBe(0);
    expect(applyBonusHp(-2, 4)).toBe(-2);
  });
  it("otherwise adds the bonus with a floor of 1", () => {
    expect(applyBonusHp(10, 4)).toBe(14);
    expect(applyBonusHp(10, -3)).toBe(7);
    expect(applyBonusHp(2, -5)).toBe(1);
  });
});

describe("resolveTraitTotals", () => {
  it("is all zeros while the rule is off and the real totals while it is on", () => {
    const traits = [entry("hardy"), entry("powerful")];
    expect(resolveTraitTotals(traits, DEFAULT_OPTIONAL_RULES).bonusHp).toBe(0);
    expect(resolveTraitTotals(traits, DEFAULT_OPTIONAL_RULES).abilityBonus.str).toBe(0);
    const on = resolveTraitTotals(traits, ON);
    expect(on.bonusHp).toBe(4);
    expect(on.abilityBonus.str).toBe(1);
  });
});

describe("toTraitEntries", () => {
  const effect = (over: Record<string, unknown> = {}) => ({ kind: "bonusHp", ability: "", save: "", mode: "", track: "", amount: 4, ...over });
  it("keeps only owned trait items with a well-formed effect, in item order", () => {
    const items = [
      { type: "weapon", system: {} },
      { type: "trait", system: { traitId: "hardy", cost: 6, effect: effect() } },
      { type: "trait", system: { traitId: "broken", cost: 3, effect: effect({ kind: "" }) } },
      { type: "trait", system: { traitId: "iron-will", cost: 5, effect: effect({ kind: "saveBonus", save: "spell", amount: 1 }) } },
    ];
    expect(toTraitEntries(items)).toEqual([
      { traitId: "hardy", cost: 6, effect: { kind: "bonusHp", amount: 4 } },
      { traitId: "iron-will", cost: 5, effect: { kind: "saveBonus", save: "spell", amount: 1 } },
    ]);
  });
  it("returns [] for an actor with no traits", () => {
    expect(toTraitEntries([])).toEqual([]);
  });
});
```

Also, in `tests/data/derive/character/derive.test.ts`, add `traits: [],` to EVERY object literal typed `ActorSnapshot` (the shared `base` at the top and each inline snapshot literal — grep `thiefSkillAllocations:` to find them all).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/data/derive 2>&1 | tail -25`
Expected: FAIL (`traits` not on `ActorSnapshot`, module `traits` not found).

- [ ] **Step 3: Implement**

`src/data/derive/character/snapshot.ts`: add near the top (with the other imports/types)
```typescript
import type { TraitEffect } from "../../../core/skills/traits";
```
```typescript
export interface TraitEntry {
  traitId: string;
  /** CP cost (negative = disadvantage) */
  cost: number;
  effect: TraitEffect;
}
```
and add to `ActorSnapshot` (after `thiefSkillAllocations`):
```typescript
  /** every owned `trait` item whose stored effect is well-formed, in item order — applied only while the character-point build rule is on */
  traits: readonly TraitEntry[];
```

Create `src/data/derive/character/traits.ts`:
```typescript
// SP8 Plan 8c: applies the owned traits' typed effects to the cached derived
// block. Pure. `deriveCharacter` (derive.ts) wraps its base derive with this;
// `CharacterModel.prepareBaseData` applies the ABILITY totals separately (right
// after the racial adjustment) using the SAME `resolveTraitTotals`, so the gate
// and the interpretation live in one place and an ability bonus is never
// counted twice — `applyTraitEffects` deliberately ignores `abilityBonus`.
import type { OptionalRules } from "../../../core/options";
import { characterPointBuildEnabled } from "../../../core/skills/character-points";
import {
  toTraitEffect, traitEffectTotals, TRAIT_SAVE_CATEGORIES, type RawTraitEffect, type TraitTotals,
} from "../../../core/skills/traits";
import type { CharacterDerived } from "./derive";
import type { SlotBlock } from "./proficiencies";
import type { TraitEntry } from "./snapshot";

/** Owned `trait` items with a well-formed effect, in item order (a malformed trait is inert). */
export function toTraitEntries(items: Iterable<{ type: string; system: unknown }>): TraitEntry[] {
  const out: TraitEntry[] = [];
  for (const item of items) {
    if (item.type !== "trait") continue;
    const s = item.system as { traitId: string; cost: number; effect: RawTraitEffect };
    const effect = toTraitEffect(s.effect);
    if (effect) out.push({ traitId: s.traitId, cost: s.cost, effect });
  }
  return out;
}

/** THE derive-side gate: all-zero totals while the rule is off, else the reduced trait effects. */
export function resolveTraitTotals(
  traits: readonly TraitEntry[],
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">,
): TraitTotals {
  return traitEffectTotals(characterPointBuildEnabled(rules) ? traits.map((t) => t.effect) : []);
}

/**
 * Bonus hit points on the derived maximum: unchanged for a zero bonus or when
 * there is no HP to adjust (an un-rolled character or a class-less actor
 * conjures none), else `max(1, hpMax + bonus)`.
 */
export function applyBonusHp(hpMax: number, bonus: number): number {
  if (bonus === 0 || hpMax <= 0) return hpMax;
  return Math.max(1, hpMax + bonus);
}

function shiftSlots(block: SlotBlock, amount: number): SlotBlock {
  const total = Math.max(0, block.total + amount);
  return { total, spent: block.spent, available: total - block.spent };
}

function applySaveBonuses(
  saves: NonNullable<CharacterDerived["saves"]>,
  bonus: TraitTotals["saveBonus"],
): NonNullable<CharacterDerived["saves"]> {
  const out = {} as NonNullable<CharacterDerived["saves"]>;
  for (const key of TRAIT_SAVE_CATEGORIES) {
    const s = saves[key];
    // a save succeeds when d20 + rollModifier >= target, so a bonus raises the
    // modifier and lowers the effective target; the class-table target is untouched
    out[key] = {
      target: s.target,
      rollModifier: s.rollModifier + bonus[key],
      effectiveTarget: s.effectiveTarget - bonus[key],
    };
  }
  return out;
}

/** Applies the save / attack / proficiency-slot / bonus-HP totals. Ignores `abilityBonus` (see file header). */
export function applyTraitEffects(derived: CharacterDerived, totals: TraitTotals): CharacterDerived {
  return {
    ...derived,
    hpMax: applyBonusHp(derived.hpMax, totals.bonusHp),
    // a positive to-hit modifier LOWERS THAC0 (descending scale), matching deriveThac0
    thac0: derived.thac0 && {
      base: derived.thac0.base,
      melee: derived.thac0.melee - totals.attackBonus.melee,
      ranged: derived.thac0.ranged - totals.attackBonus.ranged,
    },
    saves: derived.saves && applySaveBonuses(derived.saves, totals.saveBonus),
    proficiencies: derived.proficiencies && {
      ...derived.proficiencies,
      weapon: shiftSlots(derived.proficiencies.weapon, totals.proficiencySlots.weapon),
      nonweapon: shiftSlots(derived.proficiencies.nonweapon, totals.proficiencySlots.nonweapon),
    },
  };
}
```
`src/data/derive/character/derive.ts`: add `import { applyTraitEffects, resolveTraitTotals } from "./traits";` with the other imports; rename the existing `export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {` to `function deriveCharacterBase(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {` (body untouched) and append at the end of the file:
```typescript
/**
 * The character pipeline (spec §5.6) plus the SP8 Plan 8c trait effects. While
 * the character-point build rule is off `resolveTraitTotals` is all zeros, so
 * this equals the base pipeline exactly.
 */
export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  return applyTraitEffects(deriveCharacterBase(snapshot, options), resolveTraitTotals(snapshot.traits, options));
}
```
Update the doc comment above `deriveCharacterBase` only if it now reads wrongly (it starts "The character derived-data pipeline" — leave the file header). Append `export * from "./traits";` to `src/data/derive/character/index.ts`.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/data tests/core 2>&1 | tail -25` — all pass (existing derive tests unchanged in outcome).
Run typecheck, lint, `npm run test:coverage` — exit 0; `src/data/derive/character/traits.ts` at 100% (every `&&` null/non-null arm is covered by the class-less-actor test; if a branch shows uncovered, add the missing case rather than lowering the bar). `snapshotActor` (Task 6) will not compile until it supplies `traits` — that is expected to be fixed in Task 6; **run typecheck now and expect exactly one error: `src/data/actor/snapshot.ts` missing `traits`**. To keep this task's commit green, ALSO add the minimal placeholder `traits: [],` to the returned object in `src/data/actor/snapshot.ts` (Task 6 replaces it with the real read).

- [ ] **Step 5: Commit**

```bash
git add src/data tests/data
git commit -m "feat(sp8c): apply trait effects in the pure derive layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Actor glue — typed pool, ability bonuses, snapshot, setting reload

**Files:**
- Modify: `src/data/actor/base-actor.ts`, `src/data/actor/character.ts`, `src/data/actor/npc.ts`, `src/data/actor/snapshot.ts`, `src/settings/registry.ts`, `lang/en.json`, `tests/settings/registry.test.ts`

**Interfaces:**
- Consumes: `toTraitEntries`, `resolveTraitTotals` (Task 5), `abilityScoreWithBonus`, `DEFAULT_CHARACTER_POINT_POOL`.
- Produces: `system.options.skillsAndPowers.characterPoints.pool` (authored, integer ≥ 0, initial 60); trait ability bonuses in the PREPARED scores (character + npc); `ActorSnapshot.traits` filled from the actor's items; `characterPointBuild` prompts a reload.

This is the Foundry layer (typecheck/lint gated, dev-world verified) plus one pure registry test.

- [ ] **Step 1: Confirm "additive, no migration" against real source (write the evidence in the report)**

Read `C:\Program Files\Foundry Virtual Tabletop\resources\app\common\data\fields.mjs` and confirm, citing line numbers: (a) `DataField#clean` fills a missing/`undefined` value with the field's `initial` for a required field (the SP8 notes cite ~237 and ~265), and (b) `SchemaField#_cleanType` recurses into every declared sub-field, so an actor whose stored `system.options.skillsAndPowers` is `{}` cleans to `{ characterPoints: { pool: 60 } }` at construction. Also confirm nothing in `src/` reads `system.options.skillsAndPowers` today (`grep -rn "options.skillsAndPowers" src`) and that no ActiveEffect key targets it. If (a)/(b) do not hold, STOP and report — a `migrateData` shim would then be required.

- [ ] **Step 2: Typed pool in the actor schema**

In `src/data/actor/base-actor.ts`, add to the imports `import { DEFAULT_CHARACTER_POINT_POOL } from "../../core/skills/character-points";` and replace the `skillsAndPowers` line in `options: new SchemaField({ … })`:
```typescript
      skillsAndPowers: new SchemaField({
        /** Sub-project 8 Plan 8c: the authored character-point build budget (creation only; GM-editable). */
        characterPoints: new SchemaField({
          pool: new NumberField({ required: true, integer: true, min: 0, initial: DEFAULT_CHARACTER_POINT_POOL }),
        }),
      }),
```
(`SchemaField`/`NumberField` are already destructured at the top of the file.)

- [ ] **Step 3: Ability bonuses in `prepareBaseData`**

In `src/data/actor/base-actor.ts` extend the imports:
```typescript
import { abilityScoreWithBonus } from "../../core/skills/traits";
import { resolveTraitTotals, toTraitEntries } from "../derive/character";
```
(merge `resolveTraitTotals, toTraitEntries` into the existing `import { deriveCharacter } from "../derive/character";` line.) Add, directly after `applyRacialAdjustment`:
```typescript
/**
 * Sub-project 8 Plan 8c: applies the owned traits' ability bonuses onto the
 * PREPARED `system.abilities.<k>.score`, AFTER the racial adjustment (order:
 * sub-scores -> racial -> traits), clamped to [1, 25]. Uses the same
 * `resolveTraitTotals` as `deriveCharacter` — the ONLY place the character-point
 * gate is consulted for traits — so rule off (or no ability trait) is a no-op
 * that leaves every prepared score byte-identical. Writes the prepared score only
 * (never `_source`); Foundry rebuilds prepared fields from `_source` every cycle
 * (`reset()` -> `_initialize()`), so it cannot ratchet. `deriveCharacter`
 * deliberately ignores `abilityBonus`, so a bonus is never counted twice.
 */
export function applyTraitAbilityBonuses(model: foundry.abstract.TypeDataModel.Any): void {
  const sys = model as unknown as {
    abilities: Record<string, { score: number }>;
    parent: { items: Iterable<{ type: string; system: unknown }> };
  };
  const totals = resolveTraitTotals(toTraitEntries(sys.parent.items), getOptionalRules());
  for (const k of ABILITY_KEYS) {
    sys.abilities[k].score = abilityScoreWithBonus(sys.abilities[k].score, totals.abilityBonus[k]);
  }
}
```
In `src/data/actor/character.ts` and `src/data/actor/npc.ts` import `applyTraitAbilityBonuses` from `./base-actor` and call it as the LAST line of `prepareBaseData()` (after `applyRacialAdjustment(this);`). The creature model is NOT touched.

- [ ] **Step 4: Snapshot the traits**

In `src/data/actor/snapshot.ts` import `toTraitEntries` (`import { toTraitEntries } from "../derive/character";` — merge into the existing `../derive/character` import) and replace the Task 5 placeholder `traits: [],` with `traits: toTraitEntries(items),` (`items` is the already-spread `[...doc.items]` array). The gate lives in `deriveCharacter`, not here.

- [ ] **Step 5: `requiresReload` on the setting + hint**

`src/settings/registry.ts`: add `, requiresReload: true` to the `characterPointBuild` descriptor. `tests/settings/registry.test.ts`: update the reload test to
```typescript
  it("exactly skillsAndPowersEnabled, subAbilityScores and characterPointBuild require a world reload", () => {
    const reload = ["characterPointBuild", "skillsAndPowersEnabled", "subAbilityScores"];
    const keys = SETTING_DESCRIPTORS.filter((d) => d.requiresReload === true).map((d) => d.key);
    expect(keys.sort()).toEqual(reload);
    for (const d of SETTING_DESCRIPTORS) {
      if (reload.includes(d.key)) {
        expect(d.requiresReload).toBe(true);
      } else {
        expect(d.requiresReload).not.toBe(true);
      }
    }
  });
```
`lang/en.json` `ADND2E.settings.characterPointBuild.hint` →
`"Spend a character-point pool on sub-scores and traits when building a character (Skills & Powers). Trait effects apply only while this is on."`

- [ ] **Step 6: Verify**

Run: `npx vitest run tests/settings tests/lang tests/config 2>&1 | tail -20` — pass.
Run typecheck, lint, `npm run test:coverage` — exit 0 (the whole tree compiles now; `src/data/actor/*.ts` are not in the coverage set).

- [ ] **Step 7: Commit**

```bash
git add src/data/actor src/settings/registry.ts lang/en.json tests/settings/registry.test.ts
git commit -m "feat(sp8c): typed CP pool, trait ability bonuses in prepareBaseData, trait snapshot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Pure sheet layer — drop rule + Traits/ledger context

**Files:**
- Modify: `src/sheets/character/drop-rules.ts`, `src/sheets/character/context-types.ts`, `src/sheets/character/context.ts`
- Test: `tests/sheets/character/drop-rules.test.ts`, `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `canAffordTrait`, `characterPointLedgerFor`, `DEFAULT_CHARACTER_POINT_POOL`, `CharacterPointLedger` (Task 2); `toTraitEffect`, `TraitEffect`, `RawTraitEffect` (Task 1).
- Produces (consumed by Task 8):
  - `DropCheckInput` gains optional `dropTraitCost?: number`, `dropTraitId?: string`, `ownedTraitIds?: readonly string[]`, `availableCp?: number | null` (`null`/absent = the rule is off), `refundedSoFar?: number`; `validateItemDrop` gains a `"trait"` branch.
  - `TraitItemView { id; name; img; traitId; cost; effect: RawTraitEffect }`; `CharacterSheetInput.traitItems?: TraitItemView[]`.
  - `TraitRow { id; name; img; cost; active; summaryAmount: string; summaryTargetKey: string; canRemove }`; `CharacterSheetContext.traits: { enabled: boolean; canEditPool: boolean; pool: number; ledger: CharacterPointLedger | null; rows: TraitRow[]; refundCapped: boolean }`.

- [ ] **Step 1: Failing tests**

Append to `tests/sheets/character/drop-rules.test.ts` (use its existing `validateItemDrop` import and any existing base-input helper; if none, spread a literal `{ dropType: "trait", hasRace: false, existingChassisIds: [] }`):
```typescript
describe("validateItemDrop — trait drops (SP8 Plan 8c)", () => {
  const trait = { dropType: "trait", hasRace: false, existingChassisIds: [] as string[] };

  it("rejects every trait drop while the rule is off (availableCp null or absent)", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: 4, dropTraitId: "hardy", availableCp: null })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.traitsDisabled" });
    expect(validateItemDrop({ ...trait, dropTraitCost: 4, dropTraitId: "hardy" })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.traitsDisabled" });
  });

  it("rejects a duplicate trait id", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: 6, dropTraitId: "hardy", ownedTraitIds: ["hardy"], availableCp: 50, refundedSoFar: 0 })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.duplicateTrait" });
  });

  it("rejects an advantage costing more than the available CP, allows one that fits", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: 8, dropTraitId: "brawler", ownedTraitIds: [], availableCp: 7, refundedSoFar: 0 })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.insufficientCp" });
    expect(validateItemDrop({ ...trait, dropTraitCost: 8, dropTraitId: "brawler", ownedTraitIds: [], availableCp: 8, refundedSoFar: 0 })).toEqual({ ok: true });
  });

  it("always allows a disadvantage, even overspent or past the refund cap", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: -4, dropTraitId: "frail", ownedTraitIds: [], availableCp: -9, refundedSoFar: 10 })).toEqual({ ok: true });
  });

  it("defaults a missing cost to 0, id to blank, owned ids to none and refund to 0", () => {
    expect(validateItemDrop({ ...trait, availableCp: 0 })).toEqual({ ok: true });
  });
});
```
Append to `tests/sheets/character/context.test.ts` (add `import type { TraitItemView } from "../../../src/sheets/character/context-types";` to the existing type import and `import type { RawTraitEffect } from "../../../src/core/skills/traits";`; the file already defines the `input()` factory and imports `DEFAULT_OPTIONAL_RULES`):
```typescript
describe("buildCharacterSheetContext — traits + character points (SP8 Plan 8c)", () => {
  const ON = { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true, characterPointBuild: true };
  const fx = (over: Partial<RawTraitEffect> = {}): RawTraitEffect => ({ kind: "bonusHp", ability: "", save: "", mode: "", track: "", amount: 4, ...over });
  const trait = (over: Partial<TraitItemView> = {}): TraitItemView => ({ id: "t1", name: "Hardy", img: "", traitId: "hardy", cost: 6, effect: fx(), ...over });
  /** the fixture source with `system` keys merged in */
  function src(sys: Record<string, unknown>): Record<string, unknown> {
    const s = input().source as { system: Record<string, unknown> };
    return { ...s, system: { ...s.system, ...sys } };
  }
  const abilitiesWithStrSubs = () => {
    const a = (input().source as { system: { abilities: Record<string, unknown> } }).system.abilities;
    return { ...a, str: { ...(a.str as object), sub: { a: 18, b: 14 } } };
  };

  it("is disabled with no ledger and no rows while the rule is off — in each off combination, even with traits owned", () => {
    for (const rules of [
      DEFAULT_OPTIONAL_RULES,
      { ...DEFAULT_OPTIONAL_RULES, skillsAndPowersEnabled: true },
      { ...DEFAULT_OPTIONAL_RULES, characterPointBuild: true },
    ]) {
      const t = buildCharacterSheetContext(input({ optionalRules: rules, traitItems: [trait()] })).traits;
      expect(t.enabled).toBe(false);
      expect(t.ledger).toBeNull();
      expect(t.rows).toEqual([]);
      expect(t.refundCapped).toBe(false);
    }
  });

  it("rule on, nothing owned and no options in the source: the default 60-point pool is all available", () => {
    const t = buildCharacterSheetContext(input({ optionalRules: ON })).traits;
    expect(t.enabled).toBe(true);
    expect(t.pool).toBe(60);
    expect(t.rows).toEqual([]);
    expect(t.ledger).toMatchObject({ pool: 60, spent: 0, available: 60, overspent: false });
  });

  it("reads the authored pool from the source", () => {
    const source = src({ options: { skillsAndPowers: { characterPoints: { pool: 45 } } } });
    const t = buildCharacterSheetContext(input({ optionalRules: ON, source })).traits;
    expect(t.pool).toBe(45);
    expect(t.ledger!.available).toBe(45);
  });

  it("builds a row with a signed amount and the target key, and charges the ledger", () => {
    const t = buildCharacterSheetContext(input({ optionalRules: ON, traitItems: [trait()] })).traits;
    expect(t.rows).toEqual([
      { id: "t1", name: "Hardy", img: "", cost: 6, active: true, summaryAmount: "+4", summaryTargetKey: "ADND2E.sheet.traits.target.hp", canRemove: true },
    ]);
    expect(t.ledger).toMatchObject({ spent: 6, available: 54 });
  });

  it("maps every effect kind to its target key (ability/save labels come from the config)", () => {
    const rows = buildCharacterSheetContext(
      input({
        optionalRules: ON,
        traitItems: [
          trait({ id: "a", effect: fx({ kind: "abilityBonus", ability: "str", amount: 1 }) }),
          trait({ id: "b", effect: fx({ kind: "saveBonus", save: "spell", amount: -1 }) }),
          trait({ id: "c", effect: fx({ kind: "attackBonus", mode: "ranged", amount: 1 }) }),
          trait({ id: "d", effect: fx({ kind: "proficiencySlots", track: "weapon", amount: 2 }) }),
          trait({ id: "e", effect: fx({ kind: "bonusHp", amount: 0 }) }),
        ],
      }),
    ).traits.rows;
    expect(rows.map((r) => [r.summaryAmount, r.summaryTargetKey])).toEqual([
      ["+1", "ADND2E.abilities.str"],
      ["-1", "ADND2E.saves.spell"],
      ["+1", "ADND2E.sheet.traits.mode.ranged"],
      ["+2", "ADND2E.sheet.traits.track.weapon"],
      ["0", "ADND2E.sheet.traits.target.hp"],
    ]);
    expect(rows.every((r) => r.active)).toBe(true);
  });

  it("shows a malformed trait as inert while still charging its cost", () => {
    const t = buildCharacterSheetContext(input({ optionalRules: ON, traitItems: [trait({ cost: 5, effect: fx({ kind: "" }) })] })).traits;
    expect(t.rows[0]).toMatchObject({ active: false, summaryAmount: "—", summaryTargetKey: "ADND2E.sheet.traits.target.none" });
    expect(t.ledger!.spent).toBe(5);
  });

  it("counts authored sub-scores in the ledger only when sub-ability scores are also on", () => {
    const source = src({ abilities: abilitiesWithStrSubs() });
    const off = buildCharacterSheetContext(input({ optionalRules: ON, source })).traits;
    expect(off.ledger!.subSpent).toBe(0);
    const on = buildCharacterSheetContext(input({ optionalRules: { ...ON, subAbilityScores: true }, source })).traits;
    expect(on.ledger!.subSpent).toBe(17);
    expect(on.ledger!.available).toBe(43);
  });

  it("flags overspend without hiding anything", () => {
    const source = src({ options: { skillsAndPowers: { characterPoints: { pool: 5 } } } });
    const t = buildCharacterSheetContext(input({ optionalRules: ON, source, traitItems: [trait({ cost: 8 })] })).traits;
    expect(t.ledger).toMatchObject({ available: -3, overspent: true });
    expect(t.rows).toHaveLength(1);
  });

  it("flags a capped disadvantage refund only when the raw refund exceeds the cap", () => {
    const capped = buildCharacterSheetContext(
      input({ optionalRules: ON, traitItems: [trait({ id: "x", cost: -8 }), trait({ id: "y", cost: -5 })] }),
    ).traits;
    expect(capped.ledger).toMatchObject({ refund: 10, refundUncapped: 13 });
    expect(capped.refundCapped).toBe(true);
    const under = buildCharacterSheetContext(input({ optionalRules: ON, traitItems: [trait({ cost: -4 })] })).traits;
    expect(under.refundCapped).toBe(false);
  });

  it("only a GM who can edit may change the pool; anyone who can edit may remove a trait", () => {
    const rules = { optionalRules: ON, traitItems: [trait()] };
    const gm = buildCharacterSheetContext(input({ ...rules, perms: { isGM: true, isOwner: true, editable: true } })).traits;
    expect([gm.canEditPool, gm.rows[0].canRemove]).toEqual([true, true]);
    const player = buildCharacterSheetContext(input({ ...rules, perms: { isGM: false, isOwner: true, editable: true } })).traits;
    expect([player.canEditPool, player.rows[0].canRemove]).toEqual([false, true]);
    const viewer = buildCharacterSheetContext(input({ ...rules, perms: { isGM: true, isOwner: false, editable: false } })).traits;
    expect([viewer.canEditPool, viewer.rows[0].canRemove]).toEqual([false, false]);
  });
});
```
Run: `npx vitest run tests/sheets 2>&1 | tail -25` — Expected FAIL.

- [ ] **Step 2: Implement**

`src/sheets/character/drop-rules.ts`: add `import { canAffordTrait } from "../../core/skills/character-points";` at the top; add to `DropCheckInput`:
```typescript
  /** trait drops: the dropped trait's CP cost (negative = a disadvantage) */
  dropTraitCost?: number;
  /** trait drops: the dropped trait's `system.traitId` ("" for a hand-made custom trait) */
  dropTraitId?: string;
  /** `system.traitId` of every `trait` item already on the actor */
  ownedTraitIds?: readonly string[];
  /** CP currently available — `null`/absent means the character-point build rule is off
   *  (the ledger was null), which rejects every trait drop */
  availableCp?: number | null;
  /** disadvantage refund already counted against the cap */
  refundedSoFar?: number;
```
and, before the final `return { ok: true };` of `validateItemDrop`:
```typescript
  if (input.dropType === "trait") {
    if (input.availableCp == null) return { ok: false, reason: "ADND2E.sheet.drop.traitsDisabled" };
    const verdict = canAffordTrait({
      traitCost: input.dropTraitCost ?? 0,
      traitId: input.dropTraitId ?? "",
      ownedTraitIds: input.ownedTraitIds ?? [],
      available: input.availableCp,
      refundedSoFar: input.refundedSoFar ?? 0,
    });
    return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
  }
```
`src/sheets/character/context-types.ts`: import `import type { CharacterPointLedger } from "../../core/skills/character-points";` and `import type { RawTraitEffect } from "../../core/skills/traits";`; add to `CharacterSheetInput`:
```typescript
  /** Sub-project 8 Plan 8c: every owned `trait` item. Absent = none (the NPC sheet never sets it). */
  traitItems?: TraitItemView[];
```
define (near the other `*View` types)
```typescript
export interface TraitItemView {
  id: string; name: string; img: string;
  traitId: string; cost: number;
  /** the stored flat effect (`system.effect`) */
  effect: RawTraitEffect;
}
```
and (near `SubScoreCell`)
```typescript
export interface TraitRow {
  id: string; name: string; img: string; cost: number;
  /** false for a malformed (inert) trait */
  active: boolean;
  /** signed, e.g. "+4"; "—" for an inert trait */
  summaryAmount: string;
  /** i18n key of what the amount applies to */
  summaryTargetKey: string;
  canRemove: boolean;
}
```
and add to `CharacterSheetContext`:
```typescript
  traits: {
    /** true only while the ledger exists, i.e. the character-point build rule is on */
    enabled: boolean;
    canEditPool: boolean;
    /** the authored pool */
    pool: number;
    ledger: CharacterPointLedger | null;
    rows: TraitRow[];
    /** disadvantage refunds exceed the cap, so part of them is not returned */
    refundCapped: boolean;
  };
```
`src/sheets/character/context.ts`: add imports
```typescript
import { characterPointLedgerFor, DEFAULT_CHARACTER_POINT_POOL } from "../../core/skills/character-points";
import { toTraitEffect, type TraitEffect } from "../../core/skills/traits";
```
(and `TraitRow` to the existing `./context-types` type import); extend `SourceView.system` with
```typescript
    options?: { skillsAndPowers?: { characterPoints?: { pool?: number } } };
```
add, before the `/* ---------- entry point ---------- */` block:
```typescript
/* ---------- traits + character-point ledger (SP8 Plan 8c) ---------- */

function signedAmount(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function traitTargetKey(effect: TraitEffect, config: CharacterSheetInput["config"]): string {
  switch (effect.kind) {
    case "abilityBonus":
      return config.abilities[effect.ability];
    case "saveBonus":
      return config.saves[effect.save];
    case "attackBonus":
      return `ADND2E.sheet.traits.mode.${effect.mode}`;
    case "proficiencySlots":
      return `ADND2E.sheet.traits.track.${effect.track}`;
    case "bonusHp":
      return "ADND2E.sheet.traits.target.hp";
  }
}

function buildTraits(input: CharacterSheetInput): CharacterSheetContext["traits"] {
  const src = input.source as unknown as SourceView;
  const items = input.traitItems ?? [];
  const pool = src.system.options?.skillsAndPowers?.characterPoints?.pool ?? DEFAULT_CHARACTER_POINT_POOL;
  // null while the rule is off — the ledger IS the gate (never restate it here)
  const ledger = characterPointLedgerFor(input.optionalRules, {
    pool,
    abilities: src.system.abilities,
    traitCosts: items.map((t) => t.cost),
  });
  const rows: TraitRow[] = items.map((t) => {
    const effect = toTraitEffect(t.effect);
    return {
      id: t.id,
      name: t.name,
      img: t.img,
      cost: t.cost,
      active: effect !== null,
      summaryAmount: effect ? signedAmount(effect.amount) : "—",
      summaryTargetKey: effect ? traitTargetKey(effect, input.config) : "ADND2E.sheet.traits.target.none",
      canRemove: input.perms.editable,
    };
  });
  return {
    enabled: ledger !== null,
    canEditPool: input.perms.isGM && input.perms.editable,
    pool,
    ledger,
    rows: ledger ? rows : [],
    refundCapped: ledger !== null && ledger.refundUncapped > ledger.refund,
  };
}
```
and add `    traits: buildTraits(input),` to the object returned by `buildCharacterSheetContext` (after `features:`).

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/sheets 2>&1 | tail -25` — pass.
Run typecheck, lint, `npm run test:coverage` — exit 0; `context.ts`, `context-types.ts` and `drop-rules.ts` at 100% line/stmt/func (branches ≥ 90). If a branch is uncovered add the missing test.

- [ ] **Step 4: Commit**

```bash
git add src/sheets/character tests/sheets
git commit -m "feat(sp8c): trait drop rule and Traits/CP-ledger sheet context

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: PC sheet glue — Traits panel, drop handler, remove action, NPC guard, lang

**Files:**
- Create: `src/sheets/character/trait-actions.ts`
- Modify: `src/sheets/character/sheet.ts`, `src/sheets/npc/sheet.ts`, `templates/actor/character/features.hbs`, `styles/actor/character.scss`, `lang/en.json`, `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `characterPointLedgerFor`, `DEFAULT_CHARACTER_POINT_POOL`, `DISADVANTAGE_REFUND_CAP` (Task 2); `DropCheckInput` fields, `TraitItemView`, `CharacterSheetContext.traits` (Task 7).
- Produces: a working Traits panel on the PC Features tab, hard-blocking trait drops, a `removeTrait` action, an NPC-sheet trait-drop rejection.

Foundry layer: typecheck/lint gated; dev-world verified at Task 10 (except the lang-coverage test, which is unit-tested).

- [ ] **Step 1: Lang first (failing test)**

Append to `tests/lang/en-coverage.test.ts` (it defines `resolve`):
```typescript
describe("lang/en.json — SP8 Plan 8c trait strings", () => {
  it("resolves every ADND2E.sheet.traits.* and trait drop key the sheet layer references", () => {
    for (const key of [
      "ADND2E.sheet.drop.duplicateTrait",
      "ADND2E.sheet.drop.insufficientCp",
      "ADND2E.sheet.drop.traitsDisabled",
      "ADND2E.sheet.drop.traitsPcOnly",
      "ADND2E.sheet.traits.title",
      "ADND2E.sheet.traits.pool",
      "ADND2E.sheet.traits.poolGmOnly",
      "ADND2E.sheet.traits.spent",
      "ADND2E.sheet.traits.available",
      "ADND2E.sheet.traits.overspent",
      "ADND2E.sheet.traits.refundCapped",
      "ADND2E.sheet.traits.refundCappedToast",
      "ADND2E.sheet.traits.none",
      "ADND2E.sheet.traits.remove",
      "ADND2E.sheet.traits.removeBlockedWarning",
      "ADND2E.sheet.traits.mode.melee",
      "ADND2E.sheet.traits.mode.ranged",
      "ADND2E.sheet.traits.track.weapon",
      "ADND2E.sheet.traits.track.nonweapon",
      "ADND2E.sheet.traits.target.hp",
      "ADND2E.sheet.traits.target.none",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run `npx vitest run tests/lang 2>&1 | tail -15` — FAIL. Then in `lang/en.json`: add to the existing `ADND2E.sheet.drop` object
```json
        "duplicateTrait": "You already have that trait.",
        "insufficientCp": "Not enough character points for that trait.",
        "traitsDisabled": "Traits are only used while the Skills & Powers character-point build rule is on.",
        "traitsPcOnly": "Traits can only be added to a player character's sheet."
```
(mind the comma after the previous last entry) and add a sibling `traits` object inside `ADND2E.sheet` (next to `subAbilities`):
```json
      "traits": {
        "title": "Character Points & Traits",
        "pool": "Pool",
        "poolGmOnly": "Only the GM can change the character-point pool.",
        "spent": "Spent",
        "available": "Available",
        "overspent": "Overspent — remove a trait or raise the pool. Existing traits are never removed automatically.",
        "refundCapped": "Disadvantage refunds are capped at 10 character points in total.",
        "refundCappedToast": "That disadvantage refunds only part of its cost (the total refund cap is 10 character points).",
        "none": "No traits yet — drag one from the Traits compendium.",
        "remove": "Remove",
        "removeBlockedWarning": "That trait can't be removed.",
        "mode": { "melee": "melee to-hit", "ranged": "ranged to-hit" },
        "track": { "weapon": "weapon proficiency slots", "nonweapon": "non-weapon proficiency slots" },
        "target": { "hp": "hit points", "none": "no effect" }
      },
```
Re-run the lang tests — pass.

- [ ] **Step 2: `trait-actions.ts`**

Create `src/sheets/character/trait-actions.ts`:
```typescript
import { characterPointLedgerFor, DEFAULT_CHARACTER_POINT_POOL, DISADVANTAGE_REFUND_CAP } from "../../core/skills/character-points";
import type { AbilityKey } from "../../core/types";
import { getOptionalRules } from "../../settings";
import type { DropCheckInput } from "./drop-rules";

/* ---------------------------------------------------------------------------
 * trait-actions — SP8 Plan 8c.
 *
 * Foundry-coupled glue for the PC sheet's trait drop check and remove button —
 * not unit-tested, verified in a linked dev world. The math and the gate are the
 * pure `characterPointLedgerFor` / `validateItemDrop`; this file only reads the
 * actor's CURRENT authored state at drop time (never rendered UI state) and
 * deletes an embedded item the user already owns.
 * ------------------------------------------------------------------------- */

interface TraitItemLike {
  type: string;
  system: { traitId?: string; cost?: number };
}

interface TraitActor {
  _source: {
    system: {
      abilities: Partial<Record<AbilityKey, { sub?: { a: number | null; b: number | null } | null }>>;
      options?: { skillsAndPowers?: { characterPoints?: { pool?: number } } };
    };
  };
  items: Iterable<TraitItemLike> & { get(id: string): (TraitItemLike & { delete(): Promise<unknown> }) | undefined };
}

export type TraitDropInputs = Pick<
  DropCheckInput,
  "dropTraitCost" | "dropTraitId" | "ownedTraitIds" | "availableCp" | "refundedSoFar"
>;

/** The trait-drop inputs for `validateItemDrop`, re-derived from the actor's current authored state and settings. */
export function traitDropInputs(actor: TraitActor, dropped: { system: { traitId?: string; cost?: number } }): TraitDropInputs {
  const owned = [...actor.items].filter((i) => i.type === "trait");
  const ledger = characterPointLedgerFor(getOptionalRules(), {
    pool: actor._source.system.options?.skillsAndPowers?.characterPoints?.pool ?? DEFAULT_CHARACTER_POINT_POOL,
    abilities: actor._source.system.abilities,
    traitCosts: owned.map((i) => i.system.cost ?? 0),
  });
  return {
    dropTraitCost: dropped.system.cost ?? 0,
    dropTraitId: dropped.system.traitId ?? "",
    ownedTraitIds: owned.map((i) => i.system.traitId ?? ""),
    availableCp: ledger ? ledger.available : null,
    refundedSoFar: ledger ? ledger.refund : 0,
  };
}

/** True when the cap will return less than this disadvantage's face value (computed from the PRE-drop inputs). */
export function traitRefundCapped(inputs: TraitDropInputs): boolean {
  const cost = inputs.dropTraitCost ?? 0;
  return cost < 0 && -cost > DISADVANTAGE_REFUND_CAP - (inputs.refundedSoFar ?? 0);
}

/** Deletes an owned trait item (its CP is refunded automatically — spent CP is derived). No-ops with a warning for anything that is not an owned trait. */
export async function removeTrait(actor: TraitActor, itemId: string): Promise<void> {
  const item = actor.items.get(itemId);
  if (!item || item.type !== "trait") {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.traits.removeBlockedWarning"));
    return;
  }
  await item.delete();
}
```

- [ ] **Step 3: PC sheet wiring (`src/sheets/character/sheet.ts`)**

1. Imports: add `TraitItemView` to the `./context-types` type import; add `import { removeTrait, traitDropInputs, traitRefundCapped, type TraitDropInputs } from "./trait-actions";` and `import type { RawTraitEffect } from "../../core/skills/traits";`.
2. Add (next to `toFeatureView`):
```typescript
export function toTraitView(it: RawItem): TraitItemView {
  const s = it.system as { traitId: string; cost: number; effect: RawTraitEffect };
  return { id: it.id, name: it.name, img: it.img, traitId: s.traitId, cost: s.cost, effect: { ...s.effect } };
}
```
3. Actions: add `removeTrait: Adnd2eCharacterSheet.#onRemoveTrait,` to `actions` and, next to `#onSeedSubAbilities`:
```typescript
  static async #onRemoveTrait(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const itemId = target.dataset.itemId;
    if (itemId && this.isEditable) await removeTrait(this.document as never, itemId);
  }
```
4. `#buildInput`: declare `const traitItems: TraitItemView[] = [];`, add `case "trait": traitItems.push(toTraitView(it)); break;` to the item `switch`, and add `traitItems,` to the returned input object.
5. `_onDropItem`: after the `dropped` const and BEFORE `let dropSlotCost`, insert
```typescript
    const isNewDrop =
      (item as unknown as { parent?: { uuid?: string } }).parent?.uuid !==
      (this.document as unknown as { uuid: string }).uuid;
    // Re-sorting an already-owned trait is not a purchase — never validated.
    if (dropped.type === "trait" && !isNewDrop) return super._onDropItem(event, item);
    // Re-derived from the actor's CURRENT authored state + settings at drop time.
    const traitInputs: Partial<TraitDropInputs> =
      dropped.type === "trait" ? traitDropInputs(this.document as never, dropped as never) : {};
```
change the `validateItemDrop({` call to end with `...traitInputs,` (after `availableSlots,`), and DELETE the later `const isNewDrop = …` declaration (it is now declared above; keep the `if (result && isNewDrop && dropSlotCost !== undefined && …)` block unchanged). After that block and before `return result;` add
```typescript
    if (result && isNewDrop && dropped.type === "trait" && traitRefundCapped(traitInputs)) {
      ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.traits.refundCappedToast"));
    }
```
(`dropped.system` is typed with `chassisId/slotCost/group`; cast `dropped as never` at the `traitDropInputs` call as shown.)

- [ ] **Step 4: NPC guard (`src/sheets/npc/sheet.ts`)**

In `_onDropItem`, directly after the `const dropped = item as unknown as {…};` statement, insert:
```typescript
    // SP8 Plan 8c: traits are PC-sheet-only (spec §7). The shared derive would
    // apply a dropped trait's effects invisibly on this streamlined sheet, so refuse it.
    if (dropped.type === "trait") {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.drop.traitsPcOnly"));
      return null;
    }
```
(`dropped`'s declared type has `type: string`; no other change.)

- [ ] **Step 5: Template + styles**

In `templates/actor/character/features.hbs`, insert this block between the `feature-groups` panel and the `racial-abilities` panel:
```hbs
  {{#if adnd2e.traits.enabled}}
  <div class="traits panel">
    <h3>{{localize 'ADND2E.sheet.traits.title'}}</h3>
    <div class="cp-ledger">
      <label>
        {{localize 'ADND2E.sheet.traits.pool'}}
        <input type="number" min="0" step="1" name="system.options.skillsAndPowers.characterPoints.pool" value="{{adnd2e.traits.pool}}"{{#unless adnd2e.traits.canEditPool}} disabled title="{{localize 'ADND2E.sheet.traits.poolGmOnly'}}"{{/unless}} />
      </label>
      <span class="cp-spent">{{localize 'ADND2E.sheet.traits.spent'}}: {{adnd2e.traits.ledger.spent}}</span>
      <span class="cp-available{{#if adnd2e.traits.ledger.overspent}} overspent{{/if}}">{{localize 'ADND2E.sheet.traits.available'}}: {{adnd2e.traits.ledger.available}}</span>
    </div>
    {{#if adnd2e.traits.ledger.overspent}}<p class="warning">{{localize 'ADND2E.sheet.traits.overspent'}}</p>{{/if}}
    {{#if adnd2e.traits.refundCapped}}<p class="hint">{{localize 'ADND2E.sheet.traits.refundCapped'}}</p>{{/if}}
    {{#each adnd2e.traits.rows as |row|}}
      <div class="trait-row{{#unless row.active}} inert{{/unless}}" data-item-id="{{row.id}}">
        <span class="name">{{row.name}}</span>
        <span class="cost">{{row.cost}}</span>
        <span class="effect">{{row.summaryAmount}} {{localize row.summaryTargetKey}}</span>
        {{#if row.canRemove}}<button type="button" data-action="removeTrait" data-item-id="{{row.id}}">{{localize 'ADND2E.sheet.traits.remove'}}</button>{{/if}}
      </div>
    {{else}}
      <p class="placeholder">{{localize 'ADND2E.sheet.traits.none'}}</p>
    {{/each}}
  </div>
  {{/if}}
```
(Inside `{{#each … as |row|}}` only `row.*` is referenced — no root reference; `row.canRemove` is precomputed for exactly that reason.) In `styles/actor/character.scss` add, following the file's existing nesting conventions (find the block that scopes `.tab.features`/`.feature-groups`, or add a sibling block using the file's existing CSS variables such as `--adnd2e-accent`):
```scss
.traits {
  .cp-ledger {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;

    input[type="number"] {
      width: 4.5rem;
    }

    .overspent {
      font-weight: 700;
      color: var(--adnd2e-accent);
    }
  }

  .warning {
    color: var(--adnd2e-accent);
  }

  .trait-row {
    display: grid;
    grid-template-columns: 1fr 3rem 1fr auto;
    gap: 0.5rem;
    align-items: center;

    &.inert {
      opacity: 0.6;
    }
  }
}
```

- [ ] **Step 6: Verify**

Run typecheck, lint, `npm run test:coverage` (exit 0) and `npx vitest run tests/lang 2>&1 | tail -10`. Do NOT run `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add src/sheets templates styles lang tests/lang
git commit -m "feat(sp8c): PC Features-tab Traits panel, trait drop check and remove action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Whole-branch review

**MANDATORY regardless of how clean every per-task review was.** Every plan in Sub-project 7 (7a-7d) had a real Critical/Important bug caught ONLY here; Plan 8a's found one Important (a setting that needed `requiresReload`); Plan 8b's was clean. Treat it as the primary safety net.

- [ ] Dispatch a whole-branch review on the most capable available model over the full range from this branch's base to HEAD. Point it at this plan's Global Constraints, "Locked design decisions", and spec §2/§4.3/§5/§7. Ask it to check, specifically:
  - **Gate stated once.** `grep` the diff and `src/` for `characterPointBuild` / `skillsAndPowersEnabled`: outside `options.ts`, `registry.ts`, `sub-abilities.ts` (8a), `weapon-relation.ts` (8b), `character-points.ts` (`characterPointBuildEnabled`) and tests, nothing restates the `&&`, and nothing reads `rules.characterPointBuild` directly. `deriveCharacter`, `prepareBaseData`, the sheet context and the drop handler must all reach the gate only through `resolveTraitTotals` / `characterPointLedgerFor`.
  - **Rule-off byte-for-byte.** With the rule off (each of the three off combinations) the prepared ability scores, `hpMax`, THAC0, saves and proficiency blocks are identical to pre-8c; `abilityScoreWithBonus(score, 0)` returns the score untouched; `applyTraitEffects` with zero totals returns equal values (watch `-0`, and `&&` null arms for class-less actors).
  - **Ability-bonus double counting / ordering.** Ability traits are applied exactly once (in `prepareBaseData`, after `applyRacialAdjustment`, after `applySubAbilityScores`); `applyTraitEffects` ignores `abilityBonus`; the snapshot's `abilities` therefore already include them; nothing writes the bonus to `_source`; a second prepare cycle does not ratchet. Check the interplay with ActiveEffects on ability scores (they apply after `prepareBaseData`) and with `racialDelta` display on the sheet (the trait bonus will show inside "racial" delta — confirm this is cosmetic-only and note it if it misleads).
  - **Prepare-time reload.** `characterPointBuild` has `requiresReload: true`; the registry test pins the exact reload set.
  - **A mutation the acting non-GM user may not be permitted to make.** The drop handler creates an embedded item on the actor the user owns (allowed) and shows toasts only; `removeTrait` deletes an embedded item on an owned actor (allowed for OWNER); the pool input is `disabled` for non-GMs (so a player's submit can never write it) — verify `FormDataExtended` really excludes disabled fields and no other field writes `options.skillsAndPowers`; no code writes to a DIFFERENT actor or to a document a player lacks OWNER on; toasts never precede the user-visible result.
  - **Template context binding:** the Traits block references only `row.*` inside `{{#each}}` (and `adnd2e.traits.*` outside it); any root reference inside an `{{#each}}` needs `@root.`; the shared `partials/ability-row.hbs` was NOT touched.
  - **Shared-partial / NPC isolation.** The NPC sheet renders no Traits UI, rejects trait drops, and `buildCharacterSheetContext`'s new `traits` key is harmless for NPC inputs (no `traitItems`). Creature model/derive untouched.
  - **Schema pruning / migration.** `system.options.skillsAndPowers` changed from `ObjectField` to a typed `SchemaField`: confirm nothing else stored under that key (nothing in `src/` wrote it) so pruning loses no data, the stored `{}` cleans to `{characterPoints:{pool:60}}` (Task 6's cited source evidence), no rename/removal elsewhere, `system.json`/`package.json` versions unchanged, no migration needed.
  - **Pack `_key` gotcha + compiled count.** All 14 docs have 16-char `[A-Za-z0-9]` unique `_id`s and `_key: "!items!<_id>"`; the pack is in `system.json` `packs` (7 total) AND a `packFolders` entry; drift tests actually round-trip each doc through `toTraitEffect` against `TRAITS` (not vacuous); no rules prose (`description: ""`); `_MANIFEST.md` present.
  - **Derive-layer purity and coverage.** `src/data/derive/**` and `src/core/skills/**` import nothing from Foundry; coverage/typecheck/lint green (re-run independently); `snapshotActor` supplies `traits` via `toTraitEntries` (no second interpretation of trait effects anywhere).
  - **Trait effect semantics.** Save bonus raises `rollModifier` and lowers `effectiveTarget` (verify `rollSave` in `combat-rolls.ts` and the save card read `rollModifier`), attack bonus lowers THAC0 (verify the attack roll reads `system.attributes.thac0.melee/ranged`), slot bonuses adjust `total`/`available` and the drop handler's `availableSlots` reads the adjusted `available`, `bonusHp` floors as decided.
  - **Drop rule.** Rule off ⇒ rejected; duplicate id ⇒ rejected (blank id never); unaffordable advantage ⇒ rejected; disadvantage always allowed; a re-sort of an owned trait is not validated; the PC-sheet `isNewDrop` refactor did not change the existing race/class/proficiency behavior (read the diff of `_onDropItem` line by line).
  - **Ledger semantics.** Null sub-scores cost 0; sub-scores count only when `subAbilityScores` is also on; refund cap applies to trait disadvantages only; negative `spent` is tolerated end to end (context, template).
- [ ] Fix every Critical/Important finding via the standard fix-round process (the controller never fixes findings directly); one scoped re-review of the fix wave.
- [ ] Once clean, run `npm run typecheck && npm run lint && npm run test:coverage` and confirm green before Task 10.

---

### Task 10: GATED dev-world smoke check

**REQUIRED — never deferred, never skipped, and it MUST include a non-GM player seat.** Confirm with the user that Foundry is fully closed before `npm run build` (this is where the new `traits` pack is first really compiled — look for `build-packs: traits  14/14 documents OK` and `compiled 7 pack(s)`), then `npm run link`, then have the user restart Foundry. Toggling `characterPointBuild` or the master switch prompts a world reload (both are `requiresReload`) — accept it each time.

Setup: a single-class **fighter** PC with hit-point rolls entered (Roll HP on the sheet — `bonusHp` only adjusts an already-rolled maximum), a second **Player-role** user account (private/incognito window) that owns that PC, an NPC, and the world settings ready to flip. Use console commands only when a check needs one; give them as plain text.

- [ ] **Pack present:** the compendium sidebar shows "Traits" (in the "Skills & Powers" folder) with 14 items; the build log said `traits  14/14 documents OK`.
- [ ] **Rule off = nothing changes:** with the rule OFF (test each of: everything off / master only / character-point toggle only), the Features tab shows NO Traits panel; dragging "Hardy" onto the PC shows the "Traits are only used while the … rule is on" toast and creates nothing. An existing PC's HP max / THAC0 / saves / proficiency totals are unchanged after enabling the rule on a character with no traits.
- [ ] **Rule on:** master + character-point toggle ON (accept reloads). The Features tab shows the Traits panel: pool 60, spent 0, available 60. The GM can change the pool (persists after re-render/refresh); a value below the spent total shows the overspend warning and removes nothing.
- [ ] **Advantages apply and refund:** drag "Hardy" (cost 6) → row appears, spent 6 / available 54, HP max +4; Remove → spent 0, HP back. Then check each effect: "Iron Will" (spell save modifier +1 on the Main tab saves), "Brawler" (melee THAC0 −1), "Steady Aim" (ranged −1), "Quick Study" (+2 non-weapon slots on the Skills tab), "Weapon Drill" (+1 weapon slot), "Powerful" (STR score/effective +1 and its derived mods follow), "Sturdy" (CON +1 → HP adjustment follows if applicable).
- [ ] **Disadvantages:** "Frail" (−4) → available +4 and HP max −3; "Nervous", "Poor Aim", "Slow Learner", "Feeble" all apply their negative effects. Take enough disadvantages to exceed 10 CP total: the "refunds are capped at 10" hint appears, the drop that crosses the cap shows the info toast, and available reflects only 10 refunded.
- [ ] **Hard blocks:** drop "Hardy" twice → duplicate toast, one copy. Set the pool low (GM) and drop "Steady Aim" (8) without enough available → "Not enough character points" toast, nothing created; a disadvantage still drops. Re-order/re-drop an owned trait within the same sheet → no toast.
- [ ] **Sub-scores in the ledger:** with `subAbilityScores` ALSO on, authored sub-scores change spent CP (e.g. STR sub-scores 18 and 14 → +17); with `subAbilityScores` off (reload) the ledger counts traits only.
- [ ] **Rule-off effects vanish:** turn `characterPointBuild` OFF (reload): the Traits panel disappears, the owned trait items remain in the actor, and their effects (HP, saves, THAC0, slots, ability scores) are gone.
- [ ] **NPC:** dragging "Hardy" onto an NPC's own sheet shows the "Traits can only be added to a player character's sheet" toast and creates nothing.
- [ ] **NON-GM PLAYER SEAT:** as the Player (private window) owning the PC: the Traits panel is visible; the pool input is DISABLED (cannot be edited); dragging "Hardy" from the Traits compendium onto their own sheet works (no permission error) and Remove works; an unaffordable advantage is blocked with the toast; attacks/saves on their sheet reflect trait effects (e.g. "Brawler" lowers melee THAC0); they cannot change the world settings.
- [ ] Report each item PASS/FAIL to the user via `AskUserQuestion`, following this project's established pattern; distinguish a genuine code defect from a test-design mistake or setup gap (HP not rolled yet, wrong actor, settings/reload not applied, the item dragged from a different compendium) before concluding a FAIL. Fix real defects via the standard fix-round process, never directly.

---

## After this plan lands

Update `README.md` (controller wrap-up): Sub-project table row 8 → `✅ Complete` with the full scope (toggles, sub-abilities, expanded proficiencies, the character-point build: 14 traits + CP ledger); "Compendium content" now lists seven Item packs (add `traits`); and the "Known backlog items" section gains: the parked custom-class builder / character kits / per-level CP awards (spec §7); the three not-selected expanded-proficiency items (larger non-weapon list, secondary-ability checks, wiring `weaponProficienciesUsed`/`nonweaponProficienciesUsed`); sub-scores and traits are invisible on the NPC's own sheet even though the shared derivation applies them (the "hand-set NPC sub-scores" quirk, generalised); sub-score CP refunds (a sub-score ≤ 9) are uncapped exactly as specced; a trait dropped on a creature sheet is inert; and the trait bonus shows inside the "racial" delta on the ability row. Follow this project's established finishing default: push and create a pull request without asking. Sub-project 9 (Player's Option: Spells & Magic) is next — it needs its own brainstorm.
