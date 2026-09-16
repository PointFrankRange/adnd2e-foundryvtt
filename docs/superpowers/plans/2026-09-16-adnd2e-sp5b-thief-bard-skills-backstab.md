# Sub-project 5, Plan 5b: Thief/Bard Skills + Backstab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire thief/bard thieving skills (percentage-based, point-allocation, armor-gated) and backstab (auto-hit + damage multiplier folded into the existing attack/damage flow) into the character sheet, completing Sub-project 5 (Proficiencies & Skills).

**Architecture:** Same two-layer split as every prior sub-project this session: new pure math (`core/proficiencies/thief-skills.ts` additions, a new `core/weapons/backstab.ts`, a new `data/derive/character/thief-skills.ts`) feeds a pure chat-card builder (`combat/thief-skill-card.ts`) and the pure sheet-context builder (`context.ts`/`context-types.ts`), all 100%-covered and gated; a thin Foundry shell (`proficiency-actions.ts` additions, `combat-rolls.ts`/`chat-listeners.ts` extensions, `sheet.ts` wiring, templates, lang) does the actual dice-rolling and chat-posting, untested, dev-world verified.

**Tech Stack:** TypeScript, Vite, Foundry VTT v14.364 (`ApplicationV2`/`HandlebarsApplicationMixin`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp5-proficiencies-skills-design.md` (also implemented by the already-merged Plan 5a — PR #24; this plan is the remainder: spec §4.1's `classifyThiefArmor`/`thiefSkillPerSkillCap`, §4.3's backstab, §4.4's thief/bard-skill half — non-weapon checks are already done).

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` directly, never `fvtt-types` (pinned v13-beta, known wrong about several v14 APIs).
- **Two-layer contract:** new pure files import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). The Foundry shell is typecheck + build gated only, no unit tests, dev-world verified.
- **The gated-zone config triad** — every new pure file goes in ALL THREE of `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (both the `ignores` array and the `files` array). Confirmed already covered, no new entries needed: `src/core/**` (Task 1's `core/proficiencies/thief-skills.ts` additions, `core/types.ts`, new `core/weapons/backstab.ts`), `tests/core/**`, `src/combat/**`/`tests/combat/**` (Task 3's `thief-skill-card.ts`), `src/data/derive/**` (Task 2's new `data/derive/character/thief-skills.ts`), `src/sheets/character/context.ts`/`context-types.ts` (Task 4). **Confirmed NOT already covered, and NOT needed either** — `src/data/item/**` (Task 1's `armor.ts`/`choices.ts` edits) is Foundry-shell/config-data, matching `weapon-proficiency.ts`'s own precedent of staying outside the pure zone.
- **Content policy:** mechanical/UI data only — `ARMOR_TYPES`' 2E armor-type NAMES are factual/mechanical data (same class as `WEAPON_CATEGORIES`), not rulebook prose. No PHB rules text, no flavor text. Chat-card templates carry labels via `{{localize}}` keys.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npx vitest run --coverage`. `npm run build` requires **Foundry closed** — re-confirm before EVERY build attempt in this plan's live-test round-trip (Task 7), not just once; Foundry's open/closed state changes multiple times within a single live-testing session (build → link → user tests live → controller dispatches a fix → build again), a real gotcha hit during Plan 5a's own live testing.
- **Dev-world smoke check is GATED** — the user runs it before `finishing-a-development-branch`, never a deferred checklist item. This plan's own smoke check (Task 7) covers spec §6 steps 5-8 ONLY — steps 1-4 already passed under Plan 5a's own smoke check and must not be re-run as part of this plan's gate.
- **Actor/document resolution from chat-card data uses `.uuid` + `fromUuidSync`, never `.id` + `game.actors.get()`.**
- **A plan touching a shared interface must grep the WHOLE consuming file(s) for every literal of that shape**, not just the ones the current task is adding (the SP4b/SP5a lesson). Task 4 explicitly calls this out for `context.test.ts`'s `PhysicalItemView`-shaped and `CharacterSheetContext["combat"]["weapons"]`-shaped literals.
- **The "duplicate re-validation" pattern is DELIBERATE and established**: the render layer (`context.ts`) and the action layer (`proficiency-actions.ts`/`combat-rolls.ts`) each independently re-derive eligibility from scratch, never trusting a client-side boolean blindly. Do not flag this as scope creep or DRY violation in any task's pre-flight scan or review.
- **Vite does NOT statically validate Handlebars template path strings** — a missing/not-yet-wired `.hbs` referenced via `TEMPLATE_PATH(...)` does not fail the build, only a runtime Foundry error. Every task below that references a template expects the build to succeed regardless of wiring order.
- **Real signatures already verified against source, use them exactly** (see each task for the specific ones it needs) — `thiefSkillBaseScore`/`resolveThiefSkill`/`backstabMultiplier`/`thiefSkillPointsAvailable`/`THIEF_SKILL_POINT_RULES`/`bardSkillBaseScore`/`bardSkillPointsAvailable`/`BARD_SKILL_POINT_RULES`/`THIEF_SKILLS`/`ThiefArmor`/`ThiefSkill`/`BardSkill` all already exist in `src/core/proficiencies/thief-skills.ts` + `src/core/types.ts` (1b.2b/1b.6) — read the real files before editing, this plan extends them, does not recreate them. `ClassChassis.thiefSkillAccess` (THIEF = all 8 `ThiefSkill`s, BARD = the 4-member `BardSkill` subset, all else `null`) already exists in `src/core/classes/chassis.ts`. `classItemLevel(chassisId: ClassId, xp: number): number` already exists in `src/data/derive/class-item.ts`. Plan 5a already shipped `src/sheets/character/proficiency-actions.ts` (`specializeWeapon`/`rollNonweaponCheck`) and `src/combat/nonweapon-check-card.ts` + `card-types.ts`'s `NonweaponCheckCardInput`/`Context` — this plan ADDS to those same files, does not recreate them. The real checkTarget formula and weapon-specialization eligibility in `context.ts` (Plan 5a) are UNCHANGED by this plan.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Pure math — armor classification, per-skill cap, thief-skill check, backstab eligibility

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/proficiencies/thief-skills.ts`
- Create: `src/core/weapons/backstab.ts`
- Modify: `tests/core/proficiencies/thief-skills.test.ts`
- Create: `tests/core/weapons/backstab.test.ts`

**Interfaces:**
- Consumes: nothing new — `ThiefArmor`/`ThiefSkill`/`Race`/`THIEF_ARMOR_ADJUSTMENTS`/`THIEF_SKILL_POINT_RULES`/`resolveThiefSkill` all already exist.
- Produces: `ArmorType` (13-member union), `ThiefArmorClassification` (discriminated union), `classifyThiefArmor(armorType): ThiefArmorClassification`, `thiefSkillPerSkillCap(level): number`, `thiefSkillCheck(skill, input): {success, target, roll}` — Task 2's derive layer and Task 4's context layer consume `classifyThiefArmor`/`thiefSkillPerSkillCap`; Task 5's `proficiency-actions.ts` consumes `thiefSkillCheck`. `canBackstab(weapon): boolean` — Task 4's `context.ts` and Task 5's `combat-rolls.ts` both consume it (the established duplicate-re-validation pattern: Task 4 uses it for display, Task 5 re-derives it for the actual roll).

Before editing, read the CURRENT real content of `src/core/proficiencies/thief-skills.ts` and the `ThiefArmor`/`ThiefSkill`/`BardSkill`/`Race` type block in `src/core/types.ts` (around line 248-277) — this task extends both, does not recreate them.

- [ ] **Step 1: Add `ArmorType` and `ThiefArmorClassification` to `src/core/types.ts`**

Find the existing `ThiefArmor` type at the end of the file:

```ts
/**
 * Armor category for the thief-skill armor adjustment (PHB Table 29).
 * "leather" is the thief's default and applies no adjustment; "none" is used
 * for an unarmoured thief or one relying on bracers/cloak magic.
 */
export type ThiefArmor = "none" | "leather" | "elven-chain" | "padded-studded";
```

Add immediately after it:

```ts

/**
 * The full 2E PHB armor-type list (mechanical names only — armor Item's
 * `armorType` field). A superset of `ThiefArmor`: several of these map to
 * "thief skills disabled entirely" rather than to a Table 29 category.
 */
export type ArmorType =
  | "none" | "padded" | "leather" | "studded-leather" | "ring-mail" | "scale-mail"
  | "chain-mail" | "elven-chain" | "splint-mail" | "banded-mail" | "plate-mail"
  | "field-plate" | "full-plate";

/** The result of classifying an `ArmorType` for thief-skill purposes. */
export type ThiefArmorClassification =
  | { disabled: false; category: ThiefArmor }
  | { disabled: true };
```

- [ ] **Step 2: Write the failing tests for `classifyThiefArmor`/`thiefSkillPerSkillCap`/`thiefSkillCheck`**

Append to `tests/core/proficiencies/thief-skills.test.ts` (a new `describe` block at the end of the file, alongside the existing ones — read the file first to confirm its existing import list, then add any new imports this block needs to the top):

```ts
describe("classifyThiefArmor", () => {
  it("maps the four Table 29 categories to disabled:false", () => {
    expect(classifyThiefArmor("none")).toEqual({ disabled: false, category: "none" });
    expect(classifyThiefArmor("leather")).toEqual({ disabled: false, category: "leather" });
    expect(classifyThiefArmor("elven-chain")).toEqual({ disabled: false, category: "elven-chain" });
  });

  it("maps both padded and studded-leather to the combined padded-studded row", () => {
    expect(classifyThiefArmor("padded")).toEqual({ disabled: false, category: "padded-studded" });
    expect(classifyThiefArmor("studded-leather")).toEqual({ disabled: false, category: "padded-studded" });
  });

  it("disables thief skills entirely for every armor heavier than padded/studded/elven-chain", () => {
    for (const heavy of [
      "ring-mail", "scale-mail", "chain-mail", "splint-mail",
      "banded-mail", "plate-mail", "field-plate", "full-plate",
    ] as const) {
      expect(classifyThiefArmor(heavy)).toEqual({ disabled: true });
    }
  });
});

describe("thiefSkillPerSkillCap", () => {
  it("is 30 at level 1", () => {
    expect(thiefSkillPerSkillCap(1)).toBe(30);
  });

  it("adds 15 per level after 1st, cumulatively", () => {
    expect(thiefSkillPerSkillCap(2)).toBe(45);
    expect(thiefSkillPerSkillCap(5)).toBe(90);
  });

  it("rejects level 0", () => {
    expect(() => thiefSkillPerSkillCap(0)).toThrow();
  });
});

describe("thiefSkillCheck", () => {
  const ctx = { race: "human", dexterity: 12, armor: "leather" } as const;

  it("succeeds when the roll is at or under the effective skill percentage", () => {
    // pick-pockets base 15 (Table 26) + 0 racial (human) + 0 dex (12) + 0 armor (leather) = 15; +40 allocated = 55
    const r = thiefSkillCheck("pick-pockets", { ...ctx, allocatedPoints: 40, roll: 55 });
    expect(r).toEqual({ success: true, target: 55, roll: 55 });
  });

  it("fails when the roll exceeds the effective skill percentage", () => {
    const r = thiefSkillCheck("pick-pockets", { ...ctx, allocatedPoints: 40, roll: 56 });
    expect(r).toEqual({ success: false, target: 55, roll: 56 });
  });

  it("caps the effective percentage at 95 even with excess allocated points", () => {
    // climb-walls base 60 + 200 allocated would be 260 uncapped, but resolveThiefSkill caps at 95
    const r = thiefSkillCheck("climb-walls", { ...ctx, allocatedPoints: 200, roll: 95 });
    expect(r.target).toBe(95);
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/core/proficiencies/thief-skills.test.ts 2>&1 | tail -40`
Expected: FAIL — `classifyThiefArmor`/`thiefSkillPerSkillCap`/`thiefSkillCheck` don't exist yet.

- [ ] **Step 4: Implement `classifyThiefArmor`/`thiefSkillPerSkillCap`/`thiefSkillCheck` in `src/core/proficiencies/thief-skills.ts`**

Add this import to the top of the file (extend the existing `import type { BardSkill, Race, ThiefArmor, ThiefSkill } from "../types";` line):

```ts
import type { ArmorType, BardSkill, Race, ThiefArmor, ThiefArmorClassification, ThiefSkill } from "../types";
```

Append to the end of the file:

```ts

/** PHB Table 29 armor categories, keyed by the full `ArmorType` list — `null`
 *  means thief skills are unusable entirely in that armor (heavier than
 *  leather/elven-chain/padded/studded, PHB p.38). */
const ARMOR_TYPE_TO_THIEF_ARMOR: Readonly<Record<ArmorType, ThiefArmor | null>> = {
  none: "none",
  padded: "padded-studded",
  leather: "leather",
  "studded-leather": "padded-studded",
  "ring-mail": null,
  "scale-mail": null,
  "chain-mail": null,
  "elven-chain": "elven-chain",
  "splint-mail": null,
  "banded-mail": null,
  "plate-mail": null,
  "field-plate": null,
  "full-plate": null,
};

/** Maps a worn armor type to its Table 29 category, or flags that thief
 *  skills are unusable in it entirely (PHB p.38: a thief in armor heavier
 *  than leather/elven chain/padded/studded loses all thieving abilities). */
export function classifyThiefArmor(armorType: ArmorType): ThiefArmorClassification {
  const category = ARMOR_TYPE_TO_THIEF_ARMOR[armorType];
  return category === null ? { disabled: true } : { disabled: false, category };
}

/** The cumulative cap on points allocated to ONE thief skill by `level`
 *  (30 at level 1, +15/level after — PHB p.39, not enforced by
 *  `resolveThiefSkill` itself — the allocation action is the caller). */
export function thiefSkillPerSkillCap(level: number): number {
  assertLevel(level, "thief level");
  return (
    THIEF_SKILL_POINT_RULES.level1PerSkillCap +
    (level - 1) * THIEF_SKILL_POINT_RULES.perLevelPerSkillCap
  );
}

export interface ThiefSkillCheckResult {
  success: boolean;
  /** the resolved skill percentage the roll needed to be at or under */
  target: number;
  roll: number;
}

/** Resolves a d100 thief/bard-skill check: success if `roll` is at or under
 *  the character's effective skill percentage (`resolveThiefSkill`). No
 *  natural-roll special case (unlike `nonweaponCheck`'s natural-20 auto-fail)
 *  — 2E PHB thief-skill checks have no such rule. */
export function thiefSkillCheck(
  skill: ThiefSkill,
  input: ThiefSkillContext & { allocatedPoints: number; roll: number },
): ThiefSkillCheckResult {
  const target = resolveThiefSkill(skill, input);
  return { success: input.roll <= target, target, roll: input.roll };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/core/proficiencies/thief-skills.test.ts 2>&1 | tail -40`
Expected: PASS, all cases.

- [ ] **Step 6: Write the failing test for `canBackstab`**

Create `tests/core/weapons/backstab.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canBackstab } from "../../../src/core/weapons/backstab";

describe("canBackstab", () => {
  it("allows a melee piercing weapon (e.g. a dagger)", () => {
    expect(canBackstab({ category: "melee", damageType: "piercing" })).toBe(true);
  });

  it("allows a melee slashing weapon (e.g. a short sword)", () => {
    expect(canBackstab({ category: "melee", damageType: "slashing" })).toBe(true);
  });

  it("allows a melee piercing-slashing weapon", () => {
    expect(canBackstab({ category: "melee", damageType: "piercing-slashing" })).toBe(true);
  });

  it("rejects a melee bludgeoning weapon (e.g. a mace)", () => {
    expect(canBackstab({ category: "melee", damageType: "bludgeoning" })).toBe(false);
  });

  it("rejects a melee weapon with no damage type set", () => {
    expect(canBackstab({ category: "melee", damageType: null })).toBe(false);
  });

  it("rejects a thrown weapon regardless of damage type", () => {
    expect(canBackstab({ category: "thrown", damageType: "piercing" })).toBe(false);
  });

  it("rejects a bow", () => {
    expect(canBackstab({ category: "bow", damageType: "piercing" })).toBe(false);
  });

  it("rejects a crossbow", () => {
    expect(canBackstab({ category: "crossbow", damageType: "piercing" })).toBe(false);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run tests/core/weapons/backstab.test.ts 2>&1 | tail -30`
Expected: FAIL — `src/core/weapons/backstab.ts` doesn't exist yet.

- [ ] **Step 8: Implement `canBackstab` in `src/core/weapons/backstab.ts`**

```ts
import type { DamageType, WeaponCategory } from "./data";

/**
 * Whether a weapon is backstab-eligible: a melee weapon dealing piercing
 * and/or slashing damage (PHB p.40 — thrown/missile weapons and blunt
 * (bludgeoning-only) weapons cannot be used to backstab).
 */
export function canBackstab(weapon: { category: WeaponCategory; damageType: DamageType | null }): boolean {
  return weapon.category === "melee" && weapon.damageType !== null && weapon.damageType !== "bludgeoning";
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/core/weapons/backstab.test.ts 2>&1 | tail -30`
Expected: PASS, all 8 cases.

- [ ] **Step 10: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage on `src/core/proficiencies/thief-skills.ts` and the new `src/core/weapons/backstab.ts`.

- [ ] **Step 11: Commit**

```bash
git add src/core/types.ts src/core/proficiencies/thief-skills.ts src/core/weapons/backstab.ts \
  tests/core/proficiencies/thief-skills.test.ts tests/core/weapons/backstab.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): thief-armor classification, per-skill cap, skill-check, backstab eligibility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Actor schema + pure derivation for allocated thief/bard skill points

**Files:**
- Modify: `src/data/actor/base-actor.ts`
- Create: `src/data/derive/character/thief-skills.ts`
- Modify: `src/data/derive/character/derive.ts`
- Modify: `tests/data/derive/character/thief-skills.test.ts` (create — no existing file for this new derive module)

**Interfaces:**
- Consumes: `thiefSkillPointsAvailable`/`bardSkillPointsAvailable`/`THIEF_SKILL_POINT_RULES`/`BARD_SKILL_POINT_RULES` (already exist, `core/proficiencies/thief-skills.ts`); `ThiefSkill`/`ClassId` (already exist, `core/types.ts`).
- Produces: `system.thiefSkills.{total,spent,available}` (derived, cached) + `system.thiefSkills.allocations: {skill, allocatedPoints}[]` (authored) on the actor. `deriveThiefSkillPoints(classes, allocations): {total, spent, available}` — Task 4's `context.ts` consumes the cached `system.thiefSkills.*` via `CharacterDerivedView`; Task 5's `proficiency-actions.ts` reads/writes `system.thiefSkills.allocations` directly (mirrors `spell-actions.ts`'s `memorizeSpell`/`forgetSpell` array-splice-and-`actor.update()` pattern).

Before editing, read the CURRENT real content of `src/data/actor/base-actor.ts` in full (it has a `memorizedSchema()` helper and a `proficiencyBlockSchema()` helper this task's new schema block should mirror) and `src/data/derive/character/derive.ts` in full (it has `deriveProficiencySlots`'s exact call-site pattern, called once per branch of a `mode === "single"` if/else, that this task's new call mirrors).

- [ ] **Step 1: Add the `thiefSkills` schema block to `base-actor.ts`**

Find the existing `proficiencies` schema block:

```ts
    proficiencies: new SchemaField({
      weapon: proficiencyBlockSchema(),
      nonweapon: proficiencyBlockSchema(),
    }),
```

Replace with (adds a new sibling block — `proficiencyBlockSchema()` is reused verbatim for the derived tally, plus a new authored `allocations` array modeled directly on the file's own `memorizedSchema()` pattern):

```ts
    proficiencies: new SchemaField({
      weapon: proficiencyBlockSchema(),
      nonweapon: proficiencyBlockSchema(),
    }),
    thiefSkills: new SchemaField({
      total: new NumberField({ required: true, integer: true, initial: 0 }),
      spent: new NumberField({ required: true, integer: true, initial: 0 }),
      available: new NumberField({ required: true, integer: true, initial: 0 }),
      /** one entry per skill the player has put points into — thief skills
       *  are percentage-based, not slot-based, so this is an allocation
       *  ledger, not an owned-item list like weapon/nonweapon proficiencies. */
      allocations: new ArrayField(
        new SchemaField({
          skill: new StringField({ required: true, blank: false, choices: THIEF_SKILLS }),
          allocatedPoints: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        }),
        { required: true, initial: [] },
      ),
    }),
```

Add this import near the top of the file, alongside the other relative imports (read the file to find its exact current import block and merge this in — do not duplicate an existing import line):

```ts
import { THIEF_SKILLS } from "../../core/proficiencies/thief-skills";
```

- [ ] **Step 2: Run typecheck to confirm the schema change compiles in isolation**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean (the schema change alone doesn't break anything yet — `derive.ts`'s `CharacterDerived` interface doesn't need `thiefSkills` until Step 5, and nothing reads `system.thiefSkills` until Task 4).

- [ ] **Step 3: Write the failing tests for `deriveThiefSkillPoints`**

Create `tests/data/derive/character/thief-skills.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveThiefSkillPoints } from "../../../../src/data/derive/character/thief-skills";

describe("deriveThiefSkillPoints", () => {
  it("returns a full thief budget when a thief class is present", () => {
    const r = deriveThiefSkillPoints([{ chassisId: "thief", level: 3 }], []);
    // thiefSkillPointsAvailable(3) = 60 + 2*30 = 120
    expect(r).toEqual({ total: 120, spent: 0, available: 120 });
  });

  it("returns a bard budget when a bard class is present", () => {
    const r = deriveThiefSkillPoints([{ chassisId: "bard", level: 2 }], []);
    // bardSkillPointsAvailable(2) = 20 + 1*15 = 35
    expect(r).toEqual({ total: 35, spent: 0, available: 35 });
  });

  it("subtracts every allocation's points from available, summed across all skills", () => {
    const r = deriveThiefSkillPoints(
      [{ chassisId: "thief", level: 1 }],
      [
        { skill: "pick-pockets", allocatedPoints: 20 },
        { skill: "open-locks", allocatedPoints: 15 },
      ],
    );
    // thiefSkillPointsAvailable(1) = 60
    expect(r).toEqual({ total: 60, spent: 35, available: 25 });
  });

  it("returns a zeroed block for a class with no thief-skill access", () => {
    const r = deriveThiefSkillPoints([{ chassisId: "fighter", level: 5 }], []);
    expect(r).toEqual({ total: 0, spent: 0, available: 0 });
  });

  it("returns a zeroed block for a class-less actor", () => {
    const r = deriveThiefSkillPoints([], []);
    expect(r).toEqual({ total: 0, spent: 0, available: 0 });
  });

  it("prefers the FIRST thief/bard class found when multiple classes are present (multiclass simplification)", () => {
    const r = deriveThiefSkillPoints(
      [{ chassisId: "fighter", level: 5 }, { chassisId: "thief", level: 5 }],
      [],
    );
    // thiefSkillPointsAvailable(5) = 60 + 4*30 = 180 — the thief entry is found despite not being first
    expect(r.total).toBe(180);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/data/derive/character/thief-skills.test.ts 2>&1 | tail -40`
Expected: FAIL — `src/data/derive/character/thief-skills.ts` doesn't exist yet.

- [ ] **Step 5: Implement `deriveThiefSkillPoints` in `src/data/derive/character/thief-skills.ts`**

```ts
import {
  bardSkillPointsAvailable, thiefSkillPointsAvailable,
} from "../../../core/proficiencies/thief-skills";
import type { ClassId, ThiefSkill } from "../../../core/types";

export interface ThiefSkillPointBlock { total: number; spent: number; available: number }
export interface ThiefSkillAllocation { skill: ThiefSkill; allocatedPoints: number }

/** §5.6-equivalent step for SP5b — the cumulative thief/bard skill-point
 *  budget and how much of it is already spent. Scans `classes` for the
 *  FIRST entry whose `chassisId` is "thief" or "bard" (same first-match-wins
 *  multiclass simplification used elsewhere in this plan and in SP5a's
 *  `resolveProficiencyModifier`) — every other class gets a zeroed block,
 *  since only thief/bard have any thief-skill access at all
 *  (`ClassChassis.thiefSkillAccess`). `spent` sums every allocation
 *  regardless of which skills the class can actually access — an
 *  allocation for an inaccessible skill should never exist in practice
 *  (the action layer gates on `thiefSkillAccess`), but summing
 *  unconditionally keeps this function simple and total. */
export function deriveThiefSkillPoints(
  classes: readonly { chassisId: ClassId; level: number }[],
  allocations: readonly ThiefSkillAllocation[],
): ThiefSkillPointBlock {
  const spent = allocations.reduce((s, a) => s + a.allocatedPoints, 0);

  const thief = classes.find((c) => c.chassisId === "thief");
  if (thief) {
    const total = thiefSkillPointsAvailable(thief.level);
    return { total, spent, available: total - spent };
  }
  const bard = classes.find((c) => c.chassisId === "bard");
  if (bard) {
    const total = bardSkillPointsAvailable(bard.level);
    return { total, spent, available: total - spent };
  }
  return { total: 0, spent: 0, available: 0 };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/data/derive/character/thief-skills.test.ts 2>&1 | tail -40`
Expected: PASS, all 6 cases.

- [ ] **Step 7: Wire `deriveThiefSkillPoints` into the `deriveCharacter` orchestrator**

In `src/data/derive/character/derive.ts`, find the import block:

```ts
import { deriveProficiencySlots, type SlotBlock } from "./proficiencies";
```

Add immediately after it:

```ts
import { deriveThiefSkillPoints, type ThiefSkillPointBlock } from "./thief-skills";
```

Find the `CharacterDerived` interface's `proficiencies` field:

```ts
  proficiencies: { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } | null;
```

Add immediately after it:

```ts
  thiefSkills: ThiefSkillPointBlock;
```

Find, in `deriveCharacter`'s body, the line that computes `classLevels`:

```ts
  const classLevels = deriveClassLevels(snapshot.classes);
```

Add immediately after it (computed ONCE, before the `mode === "single"` branch, since it applies identically regardless of single/multi/dual-class arrangement — thief-skill access isn't affected by which class "wins" THAC0/saves):

```ts
  const thiefSkills = deriveThiefSkillPoints(snapshot.classes, snapshot.thiefSkillAllocations);
```

Find the `mode === "single"` branch's returned object (it has a `proficiencies:` field) and add `thiefSkills,` as a new sibling property immediately after the `proficiencies:` block closes (i.e. after its closing `: null,` — read the exact current object literal to place this correctly, since the `proficiencies` ternary spans several lines). Do the SAME for the second (multiclass/dualclass) returned object later in the same function, which also has a `proficiencies: deriveProficiencySlots(...)` field — add `thiefSkills,` as a sibling there too.

- [ ] **Step 8: Add `thiefSkillAllocations` to `ActorSnapshot` and wire it from the real actor**

Read `src/data/derive/character/snapshot.ts` in full (it defines the `ActorSnapshot` interface `deriveCharacter` consumes and is populated by `src/data/actor/snapshot.ts`'s `snapshotActor` adapter — the SAME two-file split `spentWeaponSlots`/`spentNonweaponSlots` already use, per that file's own established pattern). Add a new field to `ActorSnapshot`:

```ts
  thiefSkillAllocations: readonly { skill: ThiefSkill; allocatedPoints: number }[];
```

(Add the `ThiefSkill` type import to this file's existing type-only import line from `../../../core/types` if not already present.)

In `src/data/actor/snapshot.ts` (the adapter that builds an `ActorSnapshot` from a real `CharacterModel`/`NpcModel` instance), find where `spentWeaponSlots`/`spentNonweaponSlots` are read off `doc.system.proficiencies` or similar (read the file to find the exact real property path this actor model exposes for `system.thiefSkills.allocations` — it will be `doc.system.thiefSkills.allocations` per this task's Step 1 schema, mirroring how `doc.system.spellcasting.wizard.memorized` is read elsewhere in the same file for `wizardMemorized`). Add:

```ts
  const thiefSkillAllocations = [...doc.system.thiefSkills.allocations];
```

And add `thiefSkillAllocations,` to the returned `ActorSnapshot` object literal.

- [ ] **Step 9: Wire `deriveAndCache`'s write-back for `thiefSkills`**

In `src/data/derive/character/derive.ts` (or wherever `deriveAndCache` lives — it may be in this file or a sibling; read to confirm), find the block that writes `derived.proficiencies` onto `sys.proficiencies`:

```ts
  if (derived.proficiencies) {
    sys.proficiencies = {
      weapon: derived.proficiencies.weapon,
      nonweapon: derived.proficiencies.nonweapon,
    };
    sys.languagesKnown = { max: derived.proficiencies.languagesMax };
  }
```

Add immediately after this block (NOT inside the `if`, since `thiefSkills` is never null — it's always a real, possibly-zeroed, block per Step 5's design):

```ts
  sys.thiefSkills = {
    total: derived.thiefSkills.total,
    spent: derived.thiefSkills.spent,
    available: derived.thiefSkills.available,
    allocations: sys.thiefSkills.allocations,
  };
```

(This preserves the AUTHORED `allocations` array — which `deriveAndCache` never computes, only reads — while overwriting the DERIVED `total`/`spent`/`available` tally, exactly mirroring how `proficiencies.weapon`/`.nonweapon` are cache-only while `spellcasting.wizard.memorized` stays untouched by any derive step.)

- [ ] **Step 10: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage on `src/data/derive/character/thief-skills.ts`. Existing `derive.ts`/`snapshot.ts` tests may need their fixtures extended with a `thiefSkillAllocations: []` field wherever they construct a raw `ActorSnapshot` object literal by hand — grep BOTH test files for every such literal (the SP4b/SP5a lesson: a widened shared interface breaks pre-existing fixtures the task's own new tests don't cover) and add the empty-array default to each.

- [ ] **Step 11: Commit**

```bash
git add src/data/actor/base-actor.ts src/data/derive/character/thief-skills.ts \
  src/data/derive/character/derive.ts src/data/derive/character/snapshot.ts src/data/actor/snapshot.ts \
  tests/data/derive/character/thief-skills.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): actor schema + derivation for allocated thief/bard skill points

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pure chat-card builders — thief-skill roll + damage-card backstab display

**Files:**
- Modify: `src/combat/card-types.ts`
- Create: `src/combat/thief-skill-card.ts`
- Modify: `src/combat/damage-card.ts`
- Create: `tests/combat/thief-skill-card.test.ts`
- Modify: `tests/combat/damage-card.test.ts`

**Interfaces:**
- Consumes: `ThiefSkillCheckResult` (Task 1's `thiefSkillCheck` return shape); `damageResult` (already exists, `core/combat/damage.ts`, unchanged).
- Produces: `ThiefSkillCardInput`/`Context`, `buildThiefSkillCardContext(input): ThiefSkillCardContext` — Task 5's `proficiency-actions.ts`'s `rollThiefSkill` consumes it. `DamageCardInput`/`Context` gain an optional `backstabMultiplier: number | null` — Task 5's `combat-rolls.ts`/`chat-listeners.ts` produce the input value, Task 6's `damage-roll.hbs` consumes the context's display fields.

Before editing, read the CURRENT real content of `src/combat/card-types.ts`'s `NonweaponCheckCardInput`/`Context` (the direct style template for `ThiefSkillCardInput`/`Context` — same shape family, different roll type) and `src/combat/damage-card.ts`/`nonweapon-check-card.ts` in full.

- [ ] **Step 1: Add `ThiefSkillCardInput`/`Context` to `card-types.ts`**

Find the end of the file (the `NonweaponCheckCardInput`/`Context` block). Append:

```ts

/* ---------- thief/bard skill check ---------- */

export interface ThiefSkillCardInput {
  actorName: string;
  actorImg: string;
  /** i18n key, e.g. "ADND2E.chat.thiefSkill.skills.pickPockets" */
  skillLabel: string;
  formula: string;
  /** the d100 result actually rolled */
  roll: number;
  result: { success: boolean; target: number };
}

export interface ThiefSkillCardContext {
  actorName: string;
  actorImg: string;
  skillLabel: string;
  formula: string;
  roll: number;
  target: number;
  success: boolean;
}
```

- [ ] **Step 2: Write the failing tests for `buildThiefSkillCardContext`**

Create `tests/combat/thief-skill-card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildThiefSkillCardContext } from "../../src/combat/thief-skill-card";

describe("buildThiefSkillCardContext", () => {
  const base = {
    actorName: "Sly", actorImg: "img.webp",
    skillLabel: "ADND2E.chat.thiefSkill.skills.pickPockets",
    formula: "1d100",
  };

  it("passes actor/formula/label fields through unchanged", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 40, result: { success: true, target: 55 } });
    expect(c.actorName).toBe("Sly");
    expect(c.actorImg).toBe("img.webp");
    expect(c.skillLabel).toBe(base.skillLabel);
    expect(c.formula).toBe("1d100");
  });

  it("flattens a successful result", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 40, result: { success: true, target: 55 } });
    expect(c.roll).toBe(40);
    expect(c.target).toBe(55);
    expect(c.success).toBe(true);
  });

  it("flattens a failed result", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 80, result: { success: false, target: 55 } });
    expect(c.roll).toBe(80);
    expect(c.target).toBe(55);
    expect(c.success).toBe(false);
  });

  it("a roll exactly equal to the target is a success (at-or-under rule)", () => {
    const c = buildThiefSkillCardContext({ ...base, roll: 55, result: { success: true, target: 55 } });
    expect(c.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/combat/thief-skill-card.test.ts 2>&1 | tail -30`
Expected: FAIL — `src/combat/thief-skill-card.ts` doesn't exist yet.

- [ ] **Step 4: Implement `buildThiefSkillCardContext` in `src/combat/thief-skill-card.ts`**

```ts
import type { ThiefSkillCardContext, ThiefSkillCardInput } from "./card-types";

/** Turn a resolved thief/bard-skill check into the chat-card's display data.
 *  Pure passthrough/flatten — `target`/`success` are pulled out of
 *  `input.result` directly onto the context, mirroring
 *  `buildNonweaponCheckCardContext`. */
export function buildThiefSkillCardContext(input: ThiefSkillCardInput): ThiefSkillCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    skillLabel: input.skillLabel,
    formula: input.formula,
    roll: input.roll,
    target: input.result.target,
    success: input.result.success,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/combat/thief-skill-card.test.ts 2>&1 | tail -30`
Expected: PASS, all 4 cases.

- [ ] **Step 6: Add `backstabMultiplier` to `DamageCardInput`/`Context`**

In `src/combat/card-types.ts`, find:

```ts
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
```

Replace with:

```ts
export interface DamageCardInput {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string;
  rolledBaseDamage: number;
  /** from core/combat/damage.ts damageModifiers().total */
  damageBonus: number;
  /** set only for a backstab attack — the pre-floor total (rolled + bonus,
   *  floored at 1 by damageResult) is multiplied by this before display.
   *  null for a normal (non-backstab) damage roll. */
  backstabMultiplier: number | null;
}

export interface DamageCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string; rolled: number; bonus: number; total: number;
  /** null for a normal roll — the template shows a "×N backstab!" line only
   *  when this is non-null. */
  backstabMultiplier: number | null;
}
```

- [ ] **Step 7: Write the failing test for `buildDamageCardContext`'s backstab branch**

Read `tests/combat/damage-card.test.ts` in full first (it already has tests for the normal, no-backstab case — this task extends it, not replaces it; every EXISTING test-fixture object literal shaped like `DamageCardInput` needs `backstabMultiplier: null` added to keep typechecking, per this plan's Global Constraints' shared-interface-widening rule — grep the whole file, not just where you're adding new tests). Append two new cases:

```ts
  it("multiplies the floored total by backstabMultiplier when set", () => {
    // rolled 4 + bonus 2 = 6 (already >= 1, no floor kicks in), ×3 backstab = 18
    const c = buildDamageCardContext({
      actorName: "Sly", actorImg: "img.webp", weaponName: "Dagger",
      formula: "1d4 + 2", rolledBaseDamage: 4, damageBonus: 2, backstabMultiplier: 3,
    });
    expect(c.total).toBe(18);
    expect(c.backstabMultiplier).toBe(3);
  });

  it("applies the damageResult floor-at-1 rule BEFORE multiplying", () => {
    // rolled 0 + bonus -5 = -5, floored to 1 by damageResult, THEN ×2 backstab = 2
    const c = buildDamageCardContext({
      actorName: "Sly", actorImg: "img.webp", weaponName: "Dagger",
      formula: "1d4 - 5", rolledBaseDamage: 0, damageBonus: -5, backstabMultiplier: 2,
    });
    expect(c.total).toBe(2);
  });
```

- [ ] **Step 8: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/combat/damage-card.test.ts 2>&1 | tail -40`
Expected: the 2 new cases FAIL (backstabMultiplier isn't read yet); the pre-existing cases FAIL TO COMPILE until their fixtures get `backstabMultiplier: null` added (fix now, in the same step, before running again).

- [ ] **Step 9: Update `buildDamageCardContext` in `src/combat/damage-card.ts`**

Find:

```ts
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

Replace with:

```ts
export function buildDamageCardContext(input: DamageCardInput): DamageCardContext {
  const flooredTotal = damageResult(input.rolledBaseDamage, input.damageBonus);
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    weaponName: input.weaponName,
    formula: input.formula,
    rolled: input.rolledBaseDamage,
    bonus: input.damageBonus,
    total: input.backstabMultiplier ? flooredTotal * input.backstabMultiplier : flooredTotal,
    backstabMultiplier: input.backstabMultiplier,
  };
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run tests/combat/damage-card.test.ts 2>&1 | tail -40`
Expected: PASS, all cases (existing + 2 new).

- [ ] **Step 11: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage on `src/combat/thief-skill-card.ts` and `src/combat/damage-card.ts`.

- [ ] **Step 12: Commit**

```bash
git add src/combat/card-types.ts src/combat/thief-skill-card.ts src/combat/damage-card.ts \
  tests/combat/thief-skill-card.test.ts tests/combat/damage-card.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): pure thief-skill chat-card builder + damage-card backstab multiplier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sheet context — thief/bard skill rows + combat backstab eligibility display

**Files:**
- Modify: `src/sheets/character/context-types.ts`
- Modify: `src/sheets/character/context.ts`
- Modify: `src/sheets/character/sheet.ts`
- Modify: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `classifyThiefArmor`/`thiefSkillPerSkillCap`/`thiefSkillBaseScore`/`resolveThiefSkill`/`bardSkillBaseScore` (Task 1 + pre-existing); `canBackstab` (Task 1); `CharacterDerivedView.proficiencies`-sibling `thiefSkills` tally (Task 2, threaded through `sheet.ts`'s already-existing derived-view mapper — read it to find where `proficiencies` gets copied from the prepared actor model into `CharacterDerivedView`, and mirror that for `thiefSkills`); `ClassChassis.thiefSkillAccess` (pre-existing, `core/classes/chassis.ts`).
- Produces: `ThiefSkillRow` type + `CharacterSheetContext["skills"]["thief"]` — Task 5's `proficiency-actions.ts` re-derives the SAME eligibility for its own defensive re-check (the established duplicate-re-validation pattern), Task 6's `skills.hbs` renders it. `combat.weapons[].canBackstab: boolean` — Task 5's `combat-rolls.ts` re-derives it, Task 6's `combat.hbs` renders the checkbox gated on it.

Before editing, read the CURRENT real content of `src/sheets/character/context.ts`'s `buildSkills`/`buildCombat` functions and `context-types.ts`'s `CharacterSheetInput`/`CharacterSheetContext`/`PhysicalItemView`/`CharacterDerivedView` interfaces (all quoted in this plan's research, but the file may have shifted — read it fresh) — this task extends that same code, it does not recreate it.

- [ ] **Step 1: Add `damageType` to `PhysicalItemView.weapon` and thread it from `sheet.ts`**

In `src/sheets/character/context-types.ts`, find:

```ts
  /** weapon only — pre-derived display strings */
  weapon?: {
    damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null;
    category: "melee" | "thrown" | "bow" | "crossbow";
  };
```

Replace with:

```ts
  /** weapon only — pre-derived display strings */
  weapon?: {
    damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null;
    category: "melee" | "thrown" | "bow" | "crossbow";
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning" | null;
  };
```

In `src/sheets/character/sheet.ts`, find the `toPhysicalView` weapon sub-object (it currently sets `category` — this task adds `damageType` alongside it):

```ts
  if (type === "weapon") {
    view.weapon = {
      damageVsSM: (s.damageVsSM as string | null) ?? null,
      damageVsL: (s.damageVsL as string | null) ?? null,
      speedFactor: Number(s.speedFactor ?? 0),
      range: rangeToString(s.range),
      category: (s.category as "melee" | "thrown" | "bow" | "crossbow" | undefined) ?? "melee",
    };
  }
```

Replace with:

```ts
  if (type === "weapon") {
    view.weapon = {
      damageVsSM: (s.damageVsSM as string | null) ?? null,
      damageVsL: (s.damageVsL as string | null) ?? null,
      speedFactor: Number(s.speedFactor ?? 0),
      range: rangeToString(s.range),
      category: (s.category as "melee" | "thrown" | "bow" | "crossbow" | undefined) ?? "melee",
      damageType: (s.damageType as PhysicalItemView["weapon"] extends undefined ? never : NonNullable<PhysicalItemView["weapon"]>["damageType"]) ?? null,
    };
  }
```

- [ ] **Step 2: Add `thiefSkills` to `CharacterDerivedView.proficiencies`-sibling block and add `ThiefSkillRow`**

In `context-types.ts`, find:

```ts
  proficiencies: {
    weapon: { total: number; spent: number; available: number };
    nonweapon: { total: number; spent: number; available: number };
  };
  languagesKnown: { max: number };
```

Replace with:

```ts
  proficiencies: {
    weapon: { total: number; spent: number; available: number };
    nonweapon: { total: number; spent: number; available: number };
  };
  thiefSkills: { total: number; spent: number; available: number };
  languagesKnown: { max: number };
```

Add this import to the file's existing type-only import from `../../core/types` (merge into the existing line rather than duplicating it):

```ts
import type { ThiefSkill } from "../../core/types";
```

Find the `WeaponProfView`/`NwpView` interface block and add a new interface immediately after `NwpView`:

```ts

export interface ThiefSkillRow {
  skill: ThiefSkill;
  /** i18n key, e.g. "ADND2E.chat.thiefSkill.skills.pickPockets" */
  label: string;
  /** thiefSkillBaseScore/bardSkillBaseScore — before allocated points */
  base: number;
  allocated: number;
  /** resolveThiefSkill's result — base + allocated, capped at 95 */
  effective: number;
  /** available pool > 0 AND (thief only) per-skill cap not yet reached */
  canAllocate: boolean;
  canDeallocate: boolean;
}
```

- [ ] **Step 3: Widen `CharacterSheetInput.proficiencyItems` and `CharacterSheetContext["skills"]`/`["combat"]["weapons"]`**

Find:

```ts
  proficiencyItems: { weapon: WeaponProfView[]; nonweapon: NwpView[] };
```

Replace with:

```ts
  proficiencyItems: { weapon: WeaponProfView[]; nonweapon: NwpView[] };
  /** raw allocation entries read straight off the actor — not item-backed,
   *  unlike weapon/nonweapon proficiencies (thief skills are percentage
   *  allocations, not owned Items). */
  thiefSkillAllocations: { skill: ThiefSkill; allocatedPoints: number }[];
```

Find:

```ts
  skills: {
    weapon: { total: number; spent: number; available: number; items: WeaponProfView[] };
    nonweapon: { total: number; spent: number; available: number; items: NwpView[] };
  };
```

Replace with:

```ts
  skills: {
    weapon: { total: number; spent: number; available: number; items: WeaponProfView[] };
    nonweapon: { total: number; spent: number; available: number; items: NwpView[] };
    /** null when the actor's class has no thief-skill access at all
     *  (`ClassChassis.thiefSkillAccess` is null) — the whole section is
     *  hidden/shows a placeholder in that case. */
    thief: {
      total: number; spent: number; available: number;
      /** true when the actor's worn armor disables thief skills entirely
       *  (classifyThiefArmor) — the whole section still renders (so the
       *  explanatory message has somewhere to live) but every roll/allocate
       *  button is hidden. */
      armorDisabled: boolean;
      items: ThiefSkillRow[];
    } | null;
  };
```

Find, in `CharacterSheetContext["combat"]["weapons"]`'s row type:

```ts
    weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null }[];
```

Replace with:

```ts
    weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null; canBackstab: boolean }[];
```

- [ ] **Step 4: Run typecheck to confirm the type changes compile in isolation**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: FAIL — `context.ts`'s `buildSkills`/`buildCombat` don't yet satisfy the widened interfaces, `sheet.ts`'s call site that constructs `CharacterSheetInput` doesn't yet supply `thiefSkillAllocations`, and `context.test.ts`'s fixtures are missing new fields. All expected; fixed in the next steps.

- [ ] **Step 5: Thread `thiefSkillAllocations` and the derived `thiefSkills` tally through `sheet.ts`**

Read `sheet.ts`'s function that constructs the `CharacterSheetInput` object passed into `buildCharacterSheetContext` (it already builds `proficiencyItems: {weapon: [...], nonweapon: [...]}` by mapping the actor's embedded Items — this task adds a sibling `thiefSkillAllocations` field read directly off `actor.system.thiefSkills.allocations`, no Item mapping needed since these aren't Items). Add:

```ts
    thiefSkillAllocations: [...(actor.system as { thiefSkills: { allocations: { skill: ThiefSkill; allocatedPoints: number }[] } }).thiefSkills.allocations],
```

(Adjust the exact cast style to match whatever pattern this function already uses for reading other `system.*` sub-objects — read it first.)

Also find wherever `sheet.ts` maps the prepared actor's `system.proficiencies` into `CharacterDerivedView.proficiencies` (the function that builds the `derived:` field of `CharacterSheetInput` — it reads `actor.system.proficiencies.weapon`/`.nonweapon` directly, since those are already fully derived/cached on the actor by `prepareDerivedData`). Add a sibling line reading `actor.system.thiefSkills` the same way:

```ts
    thiefSkills: (actor.system as { thiefSkills: { total: number; spent: number; available: number } }).thiefSkills,
```

- [ ] **Step 6: Add `buildThiefSkills` to `context.ts` and wire it into `buildSkills`**

Add this import near the top of `context.ts`, alongside the existing imports from `../../core/proficiencies/thief-skills`-style paths (there may not be one yet — add fresh):

```ts
import { bardSkillBaseScore, classifyThiefArmor, resolveThiefSkill, thiefSkillBaseScore, thiefSkillPerSkillCap, THIEF_SKILLS } from "../../core/proficiencies/thief-skills";
import type { ArmorType, ThiefSkill } from "../../core/types";
```

Find `buildSkills`:

```ts
function buildSkills(input: CharacterSheetInput): CharacterSheetContext["skills"] {
  const p = input.derived.proficiencies;
  return {
    weapon: {
      ...p.weapon,
      items: input.proficiencyItems.weapon.map((w) => buildWeaponProfRow(w, input, p.weapon.available)),
    },
    nonweapon: {
      ...p.nonweapon,
      items: input.proficiencyItems.nonweapon.map((n) => buildNwpRow(n, input)),
    },
  };
}
```

Replace with:

```ts
function buildSkills(input: CharacterSheetInput): CharacterSheetContext["skills"] {
  const p = input.derived.proficiencies;
  return {
    weapon: {
      ...p.weapon,
      items: input.proficiencyItems.weapon.map((w) => buildWeaponProfRow(w, input, p.weapon.available)),
    },
    nonweapon: {
      ...p.nonweapon,
      items: input.proficiencyItems.nonweapon.map((n) => buildNwpRow(n, input)),
    },
    thief: buildThiefSkills(input),
  };
}

/** Resolves the actor's worn (non-shield) armor's `armorType`, or "none" if
 *  nothing is equipped — mirrors the same "find equipped, non-shield armor"
 *  scan `buildCombat` already does for the AC breakdown. */
function resolveWornArmorType(physicalItems: PhysicalItemView[]): ArmorType {
  const worn = physicalItems.find((i) => i.type === "armor" && i.equipped && !i.armor!.isShield);
  return (worn?.armor as { armorType?: ArmorType } | undefined)?.armorType ?? "none";
}

/** Builds the thief/bard skills section — null when the actor's (first)
 *  class has no thief-skill access at all. Every row's `base`/`effective`
 *  score is computed the same way `thiefSkillCheck` (Task 1) will re-derive
 *  it at Roll time; `canAllocate`/`canDeallocate` mirror the SAME
 *  eligibility `proficiency-actions.ts`'s allocate/deallocate actions
 *  independently re-check (the established duplicate-re-validation pattern). */
function buildThiefSkills(input: CharacterSheetInput): CharacterSheetContext["skills"]["thief"] {
  const primaryChassis = input.classItems[0] ? getChassis(input.classItems[0].chassisId as ClassId) : null;
  const access = primaryChassis?.thiefSkillAccess ?? null;
  if (!access) return null;

  const t = input.derived.thiefSkills;
  const armorType = resolveWornArmorType(input.physicalItems);
  const classification = classifyThiefArmor(armorType);
  const armorDisabled = classification.disabled;
  const armorCategory = classification.disabled ? "none" : classification.category;

  const isThiefClass = input.classItems[0]?.chassisId === "thief";
  const race = input.raceItem?.raceId ?? "human";
  const dexScore = input.derived.abilities.dex.score;
  const perSkillCap = isThiefClass ? thiefSkillPerSkillCap(input.classItems[0]!.level) : Infinity;

  const items: ThiefSkillRow[] = access.map((skill) => {
    const allocation = input.thiefSkillAllocations.find((a) => a.skill === skill);
    const allocated = allocation?.allocatedPoints ?? 0;
    const ctx = { race, dexterity: dexScore, armor: armorCategory as never };
    const base = isThiefClass ? thiefSkillBaseScore(skill, ctx) : bardSkillBaseScore(skill, ctx);
    const effective = resolveThiefSkill(skill, { ...ctx, allocatedPoints: allocated });
    return {
      skill,
      label: `ADND2E.chat.thiefSkill.skills.${skill}`,
      base,
      allocated,
      effective,
      canAllocate: t.available > 0 && (!isThiefClass || allocated < perSkillCap),
      canDeallocate: allocated > 0,
    };
  });

  return { total: t.total, spent: t.spent, available: t.available, armorDisabled, items };
}
```

(`THIEF_SKILLS` is imported but not directly used here — `access` already provides the correct per-class skill subset via `ClassChassis.thiefSkillAccess`; if your linter flags `THIEF_SKILLS` as an unused import, drop it from this file's import line — it is not actually needed in `context.ts`.)

- [ ] **Step 7: Add `canBackstab` to `buildCombat`'s weapon rows**

Find, inside `buildCombat`:

```ts
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
      };
    });
```

Replace with (adds `canBackstab`, gated on the actor's PRIMARY class being a thief — bards don't backstab per 2E RAW — and the weapon itself being eligible):

```ts
  const isThief = input.classItems[0]?.chassisId === "thief";
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
```

Add this import near the top of `context.ts`:

```ts
import { canBackstab } from "../../core/weapons/backstab";
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: still FAIL on `context.test.ts`'s fixtures only. `context.ts`/`context-types.ts`/`sheet.ts` should now be clean; fix those first if they are not.

- [ ] **Step 9: Fix `tests/sheets/character/context.test.ts`'s existing fixtures**

Grep the WHOLE file for:
- every base `CharacterSheetInput`-shaped fixture builder (likely a helper function named `input(...)`) — add `thiefSkillAllocations: []` as a default field.
- every `CharacterDerivedView`-shaped fixture with a `proficiencies` field — add a sibling `thiefSkills: { total: 0, spent: 0, available: 0 }` default.
- every `PhysicalItemView.weapon`-shaped literal (fields `damageVsSM`/`speedFactor`/`category`) — add `damageType: null` (or a specific value if the surrounding test is about weapon damage type — read context; default to `null` if the test doesn't care).
- every `CharacterSheetContext["combat"]["weapons"]`-row-shaped literal used in an assertion (`toEqual`/`toMatchObject` comparing against the FULL row shape, fields `id`/`name`/`equipped`/`toHitNote`/`damageNote`/`speedFactor`/`range`) — add `canBackstab: false` (or the correct expected value per that specific test's setup).

Run `npm run typecheck 2>&1 | tail -60` after each fix and keep going until `context.test.ts` is the ONLY remaining error source, then keep fixing until it's clean too.

- [ ] **Step 10: Run the full context test file to confirm the existing suite is green again**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -80`
Expected: PASS, no failures.

- [ ] **Step 11: Add new test cases for `buildThiefSkills` and `canBackstab` wiring**

Add this new `describe` block to the end of `tests/sheets/character/context.test.ts` (alongside the other `describe` blocks, not nested inside one — read the file's existing `weaponItem`/`weaponProf`/`fighterClass`-style fixture helpers from Plan 5a's own added tests and reuse/extend that style rather than inventing a new one):

```ts
describe("buildCharacterSheetContext — thief/bard skills + backstab eligibility", () => {
  const thiefClass = {
    id: "c1", name: "Thief", img: "", chassisId: "thief", hitDie: 6,
    xp: 0, level: 1, canLevelUp: false, dualClassState: null, specialistSchool: null,
  };
  const bardClass = { ...thiefClass, name: "Bard", chassisId: "bard" };
  const fighterClass = { ...thiefClass, name: "Fighter", chassisId: "fighter" };

  it("thief with no armor gets all 8 skills, unallocated, armor not disabled", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, dex: { score: 12, mods: input().derived.abilities.dex.mods } },
          thiefSkills: { total: 60, spent: 0, available: 60 },
        },
      }),
    );
    expect(c.skills.thief).not.toBeNull();
    expect(c.skills.thief!.items).toHaveLength(8);
    expect(c.skills.thief!.armorDisabled).toBe(false);
    // pick-pockets base 15, DEX 12 gives 0 adjustment (Table 28), leather-default armor gives 0 — base 15
    const pp = c.skills.thief!.items.find((r) => r.skill === "pick-pockets")!;
    expect(pp.base).toBe(15);
    expect(pp.allocated).toBe(0);
    expect(pp.effective).toBe(15);
  });

  it("bard gets exactly the 4-skill subset, and no per-skill cap blocks a large single allocation", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [bardClass],
        thiefSkillAllocations: [{ skill: "climb-walls", allocatedPoints: 40 }],
        derived: {
          ...input().derived,
          thiefSkills: { total: 35, spent: 40, available: -5 },
        },
      }),
    );
    expect(c.skills.thief!.items).toHaveLength(4);
    expect(c.skills.thief!.items.map((r) => r.skill).sort()).toEqual(
      ["climb-walls", "detect-noise", "pick-pockets", "read-languages"].sort(),
    );
    const cw = c.skills.thief!.items.find((r) => r.skill === "climb-walls")!;
    // no per-skill cap for bards — canAllocate is false here only because available (-5) is not > 0
    expect(cw.canAllocate).toBe(false);
    expect(cw.canDeallocate).toBe(true);
  });

  it("a class with no thief-skill access gets a null thief section", () => {
    const c = buildCharacterSheetContext(input({ classItems: [fighterClass] }));
    expect(c.skills.thief).toBeNull();
  });

  it("heavy armor (e.g. chain mail) disables the whole thief-skills section", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [{
          id: "a1", name: "Chain Mail", img: "", type: "armor",
          quantity: 1, weight: 40, totalWeight: 40, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          armor: { baseAc: 5, isShield: false, shieldAcBonus: 0, armorType: "chain-mail" } as never,
        }],
      }),
    );
    expect(c.skills.thief!.armorDisabled).toBe(true);
  });

  it("canAllocate respects the thief per-skill cap even with plenty of pool available", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        thiefSkillAllocations: [{ skill: "pick-pockets", allocatedPoints: 30 }],
        derived: {
          ...input().derived,
          thiefSkills: { total: 60, spent: 30, available: 30 },
        },
      }),
    );
    // thiefSkillPerSkillCap(1) = 30 — already at the cap, so canAllocate is false despite 30 available
    const pp = c.skills.thief!.items.find((r) => r.skill === "pick-pockets")!;
    expect(pp.canAllocate).toBe(false);
  });

  it("a thief with a backstab-eligible weapon gets canBackstab true on that weapon's combat row", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [{
          id: "w1", name: "Dagger", img: "", type: "weapon",
          quantity: 1, weight: 1, totalWeight: 1, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing" },
        }],
      }),
    );
    expect(c.combat.weapons[0]!.canBackstab).toBe(true);
  });

  it("a fighter (not a thief) with the SAME eligible weapon gets canBackstab false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [{
          id: "w1", name: "Dagger", img: "", type: "weapon",
          quantity: 1, weight: 1, totalWeight: 1, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing" },
        }],
      }),
    );
    expect(c.combat.weapons[0]!.canBackstab).toBe(false);
  });

  it("a thief with a non-eligible weapon (bludgeoning) gets canBackstab false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [thiefClass],
        physicalItems: [{
          id: "w1", name: "Mace", img: "", type: "weapon",
          quantity: 1, weight: 6, totalWeight: 6, location: "", equipped: true, identified: true, magicBonus: 0,
          isContainer: false, capacity: null, contentsWeightMultiplier: 1,
          weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: null, category: "melee", damageType: "bludgeoning" },
        }],
      }),
    );
    expect(c.combat.weapons[0]!.canBackstab).toBe(false);
  });
});
```

(Verify the base `input()` fixture's `raceItem`/`derived.abilities.dex.score` defaults before trusting the exact numbers above — read the file's base fixture first; adjust any expected number to match whatever it actually is if different, exactly as Plan 5a's own Task 3 required.)

- [ ] **Step 12: Run the full context test file**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -100`
Expected: PASS, all tests (existing + the 8 new ones) green.

- [ ] **Step 13: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage maintained on `context.ts`.

- [ ] **Step 14: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts \
  src/sheets/character/sheet.ts tests/sheets/character/context.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): thief/bard skill rows + weapon backstab eligibility in sheet context

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `ARMOR_TYPES` schema change

**Files:**
- Modify: `src/data/item/choices.ts`
- Modify: `src/data/item/armor.ts`

**Interfaces:**
- Consumes: `ArmorType` (Task 1, `core/types.ts`).
- Produces: `ARMOR_TYPES: readonly ArmorType[]` — Task 4's `context.ts` (via the `armor.armorType` field it now reads as a real typed value, no change needed there since Task 4 already casts it) and any future armor-authoring UI.

This is a small, standalone, low-risk task — kept separate from Task 1 (which is 100%-covered pure code) because `armor.ts`/`choices.ts` are Foundry-shell/schema-declaration files with no unit tests of their own, matching this codebase's established split between pure-zone tasks and shell/schema tasks.

Before editing, read the CURRENT real content of `src/data/item/armor.ts` and `src/data/item/choices.ts` in full.

- [ ] **Step 1: Add `ARMOR_TYPES` to `choices.ts`**

Find:

```ts
import type { AbilityKey, Alignment, ClassGroup, ClassId, CreatureSize, EncumbranceCategory, MovementMode, NonweaponGroup, Race, SpellSchool, SphereName, WizardSchool } from "../../core/types";
```

Replace with (adds `ArmorType` to the existing type-only import):

```ts
import type { AbilityKey, Alignment, ArmorType, ClassGroup, ClassId, CreatureSize, EncumbranceCategory, MovementMode, NonweaponGroup, Race, SpellSchool, SphereName, WizardSchool } from "../../core/types";
```

Find the `WEAPON_CATEGORIES` constant (or any nearby line) and add a new constant near it:

```ts

/** The full 2E PHB armor-type list (mechanical names only). */
export const ARMOR_TYPES: readonly ArmorType[] = [
  "none", "padded", "leather", "studded-leather", "ring-mail", "scale-mail",
  "chain-mail", "elven-chain", "splint-mail", "banded-mail", "plate-mail",
  "field-plate", "full-plate",
];
```

- [ ] **Step 2: Change `armor.ts`'s `armorType` field to a real enum**

Find:

```ts
      armorType: new StringField({ required: true, blank: true, initial: "" }),
```

Replace with:

```ts
      armorType: new StringField({ required: true, blank: false, initial: "none", choices: ARMOR_TYPES }),
```

Add this import to the top of the file:

```ts
import { ARMOR_TYPES } from "./choices";
```

(This is a real behavior change: existing armor Items authored with a blank `armorType` — including any created by hand in a dev world before this branch — will have their stored value cleaned to `"none"` by Foundry's `StringField` validation on next load, since `""` is no longer a valid choice. No compendium pack currently ships armor Items (confirmed by reading `packs/` — only `classes`/`races`/`nonweapon-proficiencies`/`weapon-proficiency-groups` exist), so this affects only hand-created dev-world test data, not any shipped content. Flag this explicitly during Task 7's dev-world check if any pre-existing armor item's category looks wrong after rebuilding.)

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, same count as Task 4's end state (this task has no pure-zone changes — `choices.ts` and `armor.ts` are both outside the 100%-coverage gate, per this plan's Global Constraints).

- [ ] **Step 5: Attempt a build**

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (confirm Foundry is closed first).

- [ ] **Step 6: Commit**

```bash
git add src/data/item/choices.ts src/data/item/armor.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): constrain armor.armorType to the real 2E PHB armor-type enum

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Foundry-shell actions — allocate/deallocate/roll thief skill, backstab flow

**Files:**
- Modify: `src/sheets/character/proficiency-actions.ts`
- Modify: `src/sheets/character/combat-rolls.ts`
- Modify: `src/sheets/character/sheet.ts`
- Modify: `src/chat/chat-listeners.ts`
- Modify: `src/combat/attack-card.ts`
- Modify: `src/combat/card-types.ts`

**Interfaces:**
- Consumes: `thiefSkillPerSkillCap`/`thiefSkillCheck`/`classifyThiefArmor` (Task 1); `canBackstab`/`backstabMultiplier` (Task 1 + pre-existing); `buildThiefSkillCardContext` (Task 3); `system.thiefSkills.{allocations,available}` (Task 2); `ThiefSkillRow`-equivalent eligibility already computed for display in Task 4 (independently re-derived here, not trusted).
- Produces: `allocateThiefSkillPoint(actor, skill): Promise<void>`, `deallocateThiefSkillPoint(actor, skill): Promise<void>`, `rollThiefSkill(actor, skill): Promise<void>` in `proficiency-actions.ts`. `rollAttack`'s signature gains a `backstab: boolean` parameter — Task 7's dev-world check exercises it end-to-end.

Before editing, read the CURRENT real content of `src/sheets/character/proficiency-actions.ts` (Plan 5a's `specializeWeapon`/`rollNonweaponCheck` are the direct style template — same header comment, same defensive-re-check-with-toast pattern) and `src/sheets/character/combat-rolls.ts`'s `rollAttack`/`resolveProficiencyModifier` in full.

- [ ] **Step 1: Add the allocation step constant + `allocateThiefSkillPoint`/`deallocateThiefSkillPoint` to `proficiency-actions.ts`**

Add these imports to the top of the file, alongside the existing ones:

```ts
import { classifyThiefArmor, thiefSkillCheck, thiefSkillPerSkillCap } from "../../core/proficiencies/thief-skills";
import { buildThiefSkillCardContext } from "../../combat/thief-skill-card";
import type { ArmorType, ThiefSkill } from "../../core/types";
```

Append to the end of the file:

```ts

/** Points added/removed per click of the +/− allocation buttons. Not a PHB
 *  rule (the book has no fixed increment) — a locked plan decision for a
 *  usable UI. A click near either boundary (the remaining pool, or a
 *  thief's per-skill cap) adds/removes only the amount that still fits,
 *  rather than jumping past it or being blocked entirely. */
const THIEF_SKILL_ALLOCATION_STEP = 5;

interface ThiefSkillAllocation { skill: ThiefSkill; allocatedPoints: number }
interface ThiefSkillsActor extends ProficiencyActor {
  system: ProficiencyActor["system"] & {
    thiefSkills: { total: number; spent: number; available: number; allocations: ThiefSkillAllocation[] };
    abilities: ProficiencyActor["system"]["abilities"] & { dex: { score: number } };
  };
  race?: string;
}

/** Resolves whether `actor`'s primary class is "thief" or "bard" and, if so,
 *  its `thiefSkillAccess` list — null for any other class (no access at
 *  all). Mirrors `firstClassChassisId`'s first-class-wins simplification. */
function thiefOrBardAccess(actor: ThiefSkillsActor): { isThief: boolean; access: readonly ThiefSkill[] } | null {
  const chassisId = firstClassChassisId(actor);
  if (chassisId !== "thief" && chassisId !== "bard") return null;
  const access = getChassis(chassisId).thiefSkillAccess;
  return access ? { isThief: chassisId === "thief", access } : null;
}

/** Resolves the actor's currently worn (non-shield) armor's `armorType`. */
function resolveWornArmorType(actor: ThiefSkillsActor): ArmorType {
  for (const item of actor.items) {
    if (item.type !== "armor") continue;
    const s = item.system as { equipped?: boolean; isShield?: boolean; armorType?: ArmorType };
    if (s.equipped && !s.isShield) return s.armorType ?? "none";
  }
  return "none";
}

/** Resolves the actor's level in its primary thief/bard class, for the
 *  per-skill cap and (thief only) backstab multiplier. */
function primaryClassLevel(actor: ThiefSkillsActor): number {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const s = item.system as { chassisId?: string; xp?: number };
    if (s.chassisId === "thief" || s.chassisId === "bard") {
      return classItemLevel(s.chassisId as ClassId, s.xp ?? 0);
    }
  }
  return 0;
}

/** Adds up to `THIEF_SKILL_ALLOCATION_STEP` points to `skill`, clamped to
 *  whatever still fits in the remaining pool and (thief only) the
 *  per-skill cap. Re-derives the SAME eligibility `context.ts`'s
 *  `buildThiefSkills` used to decide whether to show the "+" button — a
 *  defensive re-check against a stale button click, not the primary gate.
 *  No-ops with a toast when nothing can be added. */
export async function allocateThiefSkillPoint(actor: ThiefSkillsActor, skill: ThiefSkill): Promise<void> {
  const info = thiefOrBardAccess(actor);
  if (!info || !info.access.includes(skill)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const allocations = actor.system.thiefSkills.allocations;
  const current = allocations.find((a) => a.skill === skill)?.allocatedPoints ?? 0;
  const poolRoom = actor.system.thiefSkills.available;
  const capRoom = info.isThief ? thiefSkillPerSkillCap(primaryClassLevel(actor)) - current : Infinity;
  const amount = Math.min(THIEF_SKILL_ALLOCATION_STEP, poolRoom, capRoom);
  if (amount <= 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const updated = allocations.some((a) => a.skill === skill)
    ? allocations.map((a) => (a.skill === skill ? { ...a, allocatedPoints: a.allocatedPoints + amount } : a))
    : [...allocations, { skill, allocatedPoints: amount }];
  await actor.update({ "system.thiefSkills.allocations": updated });
}

/** Removes up to `THIEF_SKILL_ALLOCATION_STEP` points from `skill`, floored
 *  at 0. No-ops with a toast when nothing is allocated to remove. */
export async function deallocateThiefSkillPoint(actor: ThiefSkillsActor, skill: ThiefSkill): Promise<void> {
  const allocations = actor.system.thiefSkills.allocations;
  const entry = allocations.find((a) => a.skill === skill);
  if (!entry || entry.allocatedPoints <= 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const amount = Math.min(THIEF_SKILL_ALLOCATION_STEP, entry.allocatedPoints);
  const updated = allocations.map((a) =>
    a.skill === skill ? { ...a, allocatedPoints: a.allocatedPoints - amount } : a,
  );
  await actor.update({ "system.thiefSkills.allocations": updated });
}

/** Rolls a d100 thief/bard-skill check for `skill` and posts a chat card.
 *  No-ops with a toast if the actor has no access to `skill` or thief
 *  skills are disabled by worn armor (`classifyThiefArmor`). */
export async function rollThiefSkill(actor: ThiefSkillsActor, skill: ThiefSkill): Promise<void> {
  const info = thiefOrBardAccess(actor);
  if (!info || !info.access.includes(skill)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const classification = classifyThiefArmor(resolveWornArmorType(actor));
  if (classification.disabled) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefArmorDisabledWarning"));
    return;
  }
  const allocated = actor.system.thiefSkills.allocations.find((a) => a.skill === skill)?.allocatedPoints ?? 0;
  const roll = await new Roll("1d100").evaluate();
  const naturalD100 = roll.dice[0]?.total ?? 0;
  const result = thiefSkillCheck(skill, {
    race: (actor.race as never) ?? "human",
    dexterity: actor.system.abilities.dex.score,
    armor: classification.category,
    allocatedPoints: allocated,
    roll: naturalD100,
  });
  const context = buildThiefSkillCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    skillLabel: `ADND2E.chat.thiefSkill.skills.${skill}`,
    formula: "1d100",
    roll: naturalD100,
    result,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/thief-skill-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as Roll.MessageData);
}
```

(`classItemLevel` needs a new import: `import { classItemLevel } from "../../data/derive/class-item";`. `ClassId` needs adding to this file's existing `import type { AbilityKey, ClassId, NonweaponGroup } from "../../core/types";` line if not already present — it already is, per the file's Plan-5a content. `actor.race` on `ThiefSkillsActor`: the real actor object's race is read from an embedded `race` Item, not a plain `system.race` string — read `context.ts`'s own `buildThiefSkills` from Task 4 for how it resolves race, and mirror the SAME resolution here rather than inventing a different path; adjust `ThiefSkillsActor`'s shape and this function's race-reading line to match whatever `input.raceItem?.raceId` actually threads through to on the real actor object, since this is a defensive re-derivation that must reach the identical value the display layer used.)

- [ ] **Step 2: Add backstab support to `combat-rolls.ts`'s `rollAttack`**

Add these imports to the top of `combat-rolls.ts`:

```ts
import { canBackstab } from "../../core/weapons/backstab";
import { backstabMultiplier } from "../../core/proficiencies/thief-skills";
import { classItemLevel } from "../../data/derive/class-item";
```

Find the `WeaponItemHandle` interface:

```ts
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
  };
}
```

Replace with (adds `damageType`, needed for `canBackstab`):

```ts
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
    damageType: string | null;
  };
}
```

Add a new helper function, near `resolveProficiencyModifier`:

```ts
/** Resolves whether `actor` is a thief and, if so, its thief-class level
 *  (for `backstabMultiplier`) — mirrors `proficiency-actions.ts`'s
 *  `primaryClassLevel`, kept as an independent re-derivation per this
 *  plan's established duplicate-re-validation pattern. */
function resolveThiefBackstabInfo(actor: AttackerActor): { isThief: boolean; thiefLevel: number } {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const s = item.system as { chassisId?: string; xp?: number };
    if (s.chassisId === "thief") {
      return { isThief: true, thiefLevel: classItemLevel("thief", s.xp ?? 0) };
    }
  }
  return { isThief: false, thiefLevel: 0 };
}
```

Find `rollAttack`'s signature:

```ts
export async function rollAttack(actor: AttackerActor, weaponItemId: string): Promise<void> {
```

Replace with:

```ts
export async function rollAttack(actor: AttackerActor, weaponItemId: string, backstab = false): Promise<void> {
```

Find, inside `rollAttack`, the `hitResult` call and the `damageContext` construction:

```ts
  const hit = hitResult({ naturalD20, attackBonus, thac0, targetAc });

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    damageContext: hit.hit ? { weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize } : null,
  });
```

Replace with (a backstab re-check mirrors `context.ts`'s display-layer eligibility: thief class + a canBackstab-eligible weapon; only when BOTH the caller requested it AND the re-check agrees does the attack force-hit and the damage context carry a multiplier):

```ts
  const { isThief, thiefLevel } = resolveThiefBackstabInfo(actor);
  const backstabEligible = isThief && canBackstab({ category: weapon.system.category as never, damageType: weapon.system.damageType as never });
  const backstabActive = backstab && backstabEligible;

  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  const hit = backstabActive ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
        }
      : null,
  });
```

- [ ] **Step 3: Add `backstabMultiplier` to `AttackCardInput`/`Context.damageContext` in `card-types.ts`**

Find (there are two occurrences — one in `AttackCardInput`, one in `AttackCardContext`, both with the identical `damageContext` shape):

```ts
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null } | null;
```

Replace BOTH occurrences with:

```ts
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null; backstabMultiplier: number | null } | null;
```

`src/combat/attack-card.ts`'s `buildAttackCardContext` already does `damageContext: input.damageContext` verbatim (no per-field mapping) — confirm this by reading the file; no change needed there beyond the type widening above.

- [ ] **Step 4: Wire the new actions + `backstab` checkbox reading into `sheet.ts`**

Find:

```ts
import { rollNonweaponCheck, specializeWeapon } from "./proficiency-actions";
```

Replace with:

```ts
import { allocateThiefSkillPoint, deallocateThiefSkillPoint, rollNonweaponCheck, rollThiefSkill, specializeWeapon } from "./proficiency-actions";
```

Find the `DEFAULT_OPTIONS.actions` block's `rollNonweaponCheck` entry and add three new sibling entries immediately after it:

```ts
      rollNonweaponCheck: Adnd2eCharacterSheet.#onRollNonweaponCheck,
      allocateThiefSkillPoint: Adnd2eCharacterSheet.#onAllocateThiefSkillPoint,
      deallocateThiefSkillPoint: Adnd2eCharacterSheet.#onDeallocateThiefSkillPoint,
      rollThiefSkill: Adnd2eCharacterSheet.#onRollThiefSkill,
```

Find the `#onRollAttack` static handler:

```ts
  static async #onRollAttack(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (weaponItemId) await rollAttack(this.document as never, weaponItemId);
  }
```

Replace with (reads a sibling checkbox's checked state from within the same weapon row):

```ts
  static async #onRollAttack(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (!weaponItemId) return;
    const backstabCheckbox = target.closest(".weapon-row")?.querySelector<HTMLInputElement>(".backstab-toggle");
    await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false);
  }
```

Find the `#onRollNonweaponCheck` static handler (the end of the class from Plan 5a) and add three new sibling handlers immediately after it, before the class's closing `}`:

```ts
  static async #onAllocateThiefSkillPoint(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await allocateThiefSkillPoint(this.document as never, skill as never);
  }

  static async #onDeallocateThiefSkillPoint(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await deallocateThiefSkillPoint(this.document as never, skill as never);
  }

  static async #onRollThiefSkill(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await rollThiefSkill(this.document as never, skill as never);
  }
```

- [ ] **Step 5: Wire the backstab-multiplier dataset attribute through `chat-listeners.ts`'s `onRollDamage`**

Find:

```ts
  const { actorUuid, weaponItemId, targetSize } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    targetSize?: string;
  };
```

Replace with:

```ts
  const { actorUuid, weaponItemId, targetSize, backstabMultiplier } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    targetSize?: string;
    backstabMultiplier?: string;
  };
```

Find:

```ts
  const context = buildDamageCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    weaponName: weapon.name,
    formula,
    rolledBaseDamage,
    damageBonus,
  });
```

Replace with:

```ts
  const context = buildDamageCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    weaponName: weapon.name,
    formula,
    rolledBaseDamage,
    damageBonus,
    backstabMultiplier: backstabMultiplier ? Number(backstabMultiplier) : null,
  });
```

- [ ] **Step 6: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -40`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, same count as Task 5's end state (this task has no pure-zone changes).

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (confirm Foundry is closed first — re-confirm even if you checked earlier in this session, per this plan's Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add src/sheets/character/proficiency-actions.ts src/sheets/character/combat-rolls.ts \
  src/sheets/character/sheet.ts src/chat/chat-listeners.ts src/combat/attack-card.ts src/combat/card-types.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): thief-skill allocate/deallocate/roll actions + backstab attack/damage flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Templates, lang keys, dev-world smoke check (spec §6 steps 5-8)

**Files:**
- Modify: `templates/actor/character/skills.hbs`
- Modify: `templates/actor/character/combat.hbs`
- Modify: `templates/chat/attack-roll.hbs`
- Modify: `templates/chat/damage-roll.hbs`
- Create: `templates/chat/thief-skill-roll.hbs`
- Modify: `lang/en.json`
- Modify: `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `CharacterSheetContext["skills"]["thief"]`/`["combat"]["weapons"][].canBackstab` (Task 4); `ThiefSkillCardContext` (Task 3); `DamageCardContext.backstabMultiplier` (Task 3); `allocateThiefSkillPoint`/`deallocateThiefSkillPoint`/`rollThiefSkill`/`rollAttack(..., backstab)` (Task 6).
- Produces: nothing further — this is the final task.

Before editing, read the CURRENT real content of `templates/actor/character/skills.hbs`, `templates/actor/character/combat.hbs`, and `templates/chat/damage-roll.hbs` in full, and `templates/chat/save-roll.hbs` as the direct style template for the new `thief-skill-roll.hbs` (same shape as Plan 5a's `nonweapon-check-roll.hbs` — a single roll vs. a target).

- [ ] **Step 1: Add the thief/bard skills section to `skills.hbs`**

Find the end of the `.nonweapon-profs` panel's closing `</div>`, immediately before the closing `</section>`:

```hbs
  </div>

</section>
```

Replace with (adds a third panel with its own `#if`/`#each` structure, following the existing two panels' exact skeleton):

```hbs
  </div>

  {{#if adnd2e.skills.thief}}
  <div class="thief-skills panel">
    <h3>{{localize 'ADND2E.sheet.skills.thief'}}</h3>
    <p class="totals">
      {{localize 'ADND2E.sheet.skills.slots' spent=adnd2e.skills.thief.spent total=adnd2e.skills.thief.total}}
    </p>
    {{#if adnd2e.skills.thief.armorDisabled}}
      <p class="placeholder">{{localize 'ADND2E.sheet.skills.thiefArmorDisabled'}}</p>
    {{else}}
      <div class="prof-list">
        {{#each adnd2e.skills.thief.items as |t|}}
          <div class="prof-row" data-skill="{{t.skill}}">
            <span class="name">{{localize t.label}}</span>
            <span class="base">{{t.base}}</span>
            <span class="allocated">{{t.allocated}}</span>
            <span class="effective">{{t.effective}}%</span>
            {{#if t.canDeallocate}}
              <button type="button" data-action="deallocateThiefSkillPoint" data-skill="{{t.skill}}">−</button>
            {{/if}}
            {{#if t.canAllocate}}
              <button type="button" data-action="allocateThiefSkillPoint" data-skill="{{t.skill}}">+</button>
            {{/if}}
            <button type="button" data-action="rollThiefSkill" data-skill="{{t.skill}}">
              {{localize 'ADND2E.sheet.skills.check'}}
            </button>
          </div>
        {{/each}}
      </div>
    {{/if}}
  </div>
  {{/if}}

</section>
```

- [ ] **Step 2: Add the backstab checkbox to `combat.hbs`**

Find:

```hbs
          {{#if w.equipped}}
            <button type="button" data-action="rollAttack" data-item-id="{{w.id}}">
              {{localize 'ADND2E.sheet.combat.rollAttack'}}
            </button>
          {{/if}}
```

Replace with:

```hbs
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
```

- [ ] **Step 3: Carry `backstabMultiplier` onto the "Roll Damage" button's dataset in `attack-roll.hbs`**

`card-types.ts`'s `AttackCardContext.damageContext` already carries `backstabMultiplier` as of Task 6, Step 3 — but nothing yet puts it on the DOM so `chat-listeners.ts`'s `onRollDamage` (wired in Task 6, Step 5, to read `button.dataset.backstabMultiplier`) has anything to read. Find:

```hbs
  {{#if (and hit damageContext)}}
    <button type="button" data-action="rollDamage"
      data-actor-uuid="{{damageContext.actorUuid}}" data-weapon-item-id="{{damageContext.weaponItemId}}"
      data-target-size="{{damageContext.targetSize}}">
      {{localize 'ADND2E.chat.attack.rollDamage'}}
    </button>
  {{/if}}
```

Replace with:

```hbs
  {{#if (and hit damageContext)}}
    <button type="button" data-action="rollDamage"
      data-actor-uuid="{{damageContext.actorUuid}}" data-weapon-item-id="{{damageContext.weaponItemId}}"
      data-target-size="{{damageContext.targetSize}}" data-backstab-multiplier="{{damageContext.backstabMultiplier}}">
      {{localize 'ADND2E.chat.attack.rollDamage'}}
    </button>
  {{/if}}
```

(Handlebars renders a `null` `backstabMultiplier` as an empty string, so `data-backstab-multiplier=""` — `chat-listeners.ts`'s `backstabMultiplier ? Number(backstabMultiplier) : null` already treats an empty string as falsy, correctly resolving to `null` for a normal, non-backstab attack.)

- [ ] **Step 4: Add the backstab display line to `damage-roll.hbs`**

Read the file's current full content first. Find its closing result/total line (the exact markup varies — locate where `{{total}}` is shown) and add, immediately after that line, still inside the card's outer `<div>`:

```hbs
  {{#if backstabMultiplier}}
    <p class="backstab">{{localize 'ADND2E.sheet.combat.backstabApplied' multiplier=backstabMultiplier}}</p>
  {{/if}}
```

- [ ] **Step 5: Write `templates/chat/thief-skill-roll.hbs`**

Read `templates/chat/save-roll.hbs` first as the direct style template, then write:

```hbs
<div class="adnd2e chat-card thief-skill-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{localize skillLabel}}</h3>
  </header>
  <p class="formula">{{formula}} = <strong>{{roll}}</strong> ({{localize 'ADND2E.sheet.skills.checkTarget'}}: {{target}})</p>
  {{#if success}}
    <p class="result success">{{localize 'ADND2E.chat.thiefSkill.success'}}</p>
  {{else}}
    <p class="result fail">{{localize 'ADND2E.chat.thiefSkill.failure'}}</p>
  {{/if}}
</div>
```

- [ ] **Step 6: Add the new `lang/en.json` keys**

In `lang/en.json`, find the `"skills"` block under `"sheet"` (read the file first — it currently ends `"specializeBlockedWarning"`/`"checkBlockedWarning"`). Add these new sibling keys:

```json
        "thief": "Thieving Skills",
        "thiefArmorDisabled": "Thieving skills are unusable in this armor.",
        "thiefAllocateBlockedWarning": "That skill point allocation isn't available right now — refresh the sheet.",
        "thiefArmorDisabledWarning": "Thieving skills can't be used in this armor."
```

In the `"combat"` block under `"sheet"` (read the file first for its exact current keys — it has `rollAttack`/`equipped`/`notEquipped`/etc.), add:

```json
        "backstab": "Backstab",
        "backstabApplied": "×{multiplier} backstab!"
```

Find the `"chat"` block's `nwpCheck` child (the last child before `"chat"`'s own closing `}`). Add a new sibling block immediately after it, remembering to add a trailing comma to `nwpCheck`'s closing `}`:

```json
      "thiefSkill": {
        "success": "Success",
        "failure": "Failure",
        "skills": {
          "pickPockets": "Pick Pockets",
          "openLocks": "Open Locks",
          "findRemoveTraps": "Find/Remove Traps",
          "moveSilently": "Move Silently",
          "hideInShadows": "Hide in Shadows",
          "detectNoise": "Detect Noise",
          "climbWalls": "Climb Walls",
          "readLanguages": "Read Languages"
        }
      }
```

(Adjust surrounding commas so the JSON stays valid — read the real current file structure before editing, do not guess the exact punctuation, matching this plan's Global Constraints and Plan 5a's own established practice.)

- [ ] **Step 7: Add the drift-test block**

In `tests/lang/en-coverage.test.ts`, find the end of the existing SP5a `describe` block (its closing `});`), and add this new block immediately after it:

```ts
describe("lang/en.json — SP5b thief/bard-skill + backstab strings", () => {
  it("resolves every ADND2E.sheet.skills.thief* + ADND2E.sheet.combat.backstab* + ADND2E.chat.thiefSkill.* key the proficiency-actions/combat-rolls layer references", () => {
    for (const key of [
      "ADND2E.sheet.skills.thief",
      "ADND2E.sheet.skills.thiefArmorDisabled",
      "ADND2E.sheet.skills.thiefAllocateBlockedWarning",
      "ADND2E.sheet.skills.thiefArmorDisabledWarning",
      "ADND2E.sheet.combat.backstab",
      "ADND2E.sheet.combat.backstabApplied",
      "ADND2E.chat.thiefSkill.success",
      "ADND2E.chat.thiefSkill.failure",
      "ADND2E.chat.thiefSkill.skills.pickPockets",
      "ADND2E.chat.thiefSkill.skills.openLocks",
      "ADND2E.chat.thiefSkill.skills.findRemoveTraps",
      "ADND2E.chat.thiefSkill.skills.moveSilently",
      "ADND2E.chat.thiefSkill.skills.hideInShadows",
      "ADND2E.chat.thiefSkill.skills.detectNoise",
      "ADND2E.chat.thiefSkill.skills.climbWalls",
      "ADND2E.chat.thiefSkill.skills.readLanguages",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 8: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run --coverage 2>&1 | tail -80`
Expected: all tests pass — one more than Task 6's end state (the new lang drift test), coverage unchanged on the pure zone.

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (confirm Foundry is closed). Confirm `dist/templates/chat/thief-skill-roll.hbs` exists.

- [ ] **Step 9: Commit**

```bash
git add templates/actor/character/skills.hbs templates/actor/character/combat.hbs \
  templates/chat/damage-roll.hbs templates/chat/thief-skill-roll.hbs \
  lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5b): thief/bard-skills UI, backstab checkbox, thief-skill chat card, lang keys

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: GATED dev-world smoke check — build, link, ask the user to test**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world and walk through spec §6's steps 5-8 (steps 1-4 already passed under Plan 5a's own smoke check — do not re-run them):

1. On a thief character: allocate skill points up to the per-skill cap, confirm the next `+` is blocked; allocate up to the total pool, confirm all `+`s are blocked; roll a skill and confirm the percentage matches `resolveThiefSkill`'s real computation (base + racial + DEX + armor + allocated, capped at 95).
2. On a bard character: confirm only the 4-skill subset shows, confirm no per-skill cap blocks a large single allocation (only the total pool does).
3. Equip the thief in leather → confirm normal thief-skill access; equip in chain mail (or similar heavy armor) → confirm the thief-skills section shows the disabled state and no rolls/allocations are possible.
4. A thief attacking a backstab-eligible target with the toggle checked: confirm auto-hit and the damage total is multiplied correctly for the thief's level; confirm the toggle doesn't appear for a non-thief or an ineligible weapon (e.g. a bludgeoning weapon, or a bow).

- [ ] **Step 11: Record the result**

If any step fails, diagnose (console errors, direct document inspection as needed — the same debugging pattern established in SP3/4a/4b/5a) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 4 steps PASS.

---

After Task 7 passes: use **superpowers:finishing-a-development-branch**. After merge: **Sub-project 5 (Proficiencies & Skills) is fully COMPLETE** — both Plan 5a and Plan 5b merged.
