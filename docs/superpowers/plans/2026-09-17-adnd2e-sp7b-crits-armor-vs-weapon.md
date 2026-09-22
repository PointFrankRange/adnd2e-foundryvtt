# SP7b — Critical Hits/Fumbles + Armor-vs-Weapon-Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add critical-hit/fumble severity tables (natural 20/1 attack rolls) and an armor-type-vs-weapon-type attack modifier, both gated behind the `combatAndTacticsEnabled` master switch and their own specific `OptionalRules` toggle wired by Plan 7a.

**Architecture:** Two small new pure modules (`src/combat/critical.ts`, `src/combat/weapon-vs-armor.ts`) hook into the existing attack/damage-roll flow at the exact points Plan 7a already established a precedent for (condition modifiers feeding `attackModifiers()`'s `situationalModifier`, a nullable multiplier feeding the damage-card flow like the existing `backstabMultiplier`). No new UI, no new templates beyond small additions to the two existing chat-card templates.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364.

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` §4.2 (and §2's locked decisions, §3's Global Constraints)

## Global Constraints

- Foundry v14.364 is the real target; `fvtt-types` is a wrong v13-beta — read real `resources/app/client` source for any Foundry-layer API question.
- Two-layer contract: `src/combat/**` is already a fully pure/gated directory (confirmed by reading the real current `tsconfig.core.json`/`vitest.config.ts`/`eslint.config.js` during planning — all three still list `src/combat` as a directory-level wildcard). **New pure files in this plan (`critical.ts`, `weapon-vs-armor.ts`) need NO new triad entries** — they're automatically covered. Learn from Plan 7a's own mistake: if a task's file needs Foundry globals (`game`, `CONFIG`, DOM), it must NOT go in `src/combat/**` at all — put Foundry-shell additions directly into the existing `src/sheets/{character,creature}/combat-rolls.ts` or `src/chat/chat-listeners.ts` files instead, never a new file under `src/combat/`.
- 100% Vitest coverage (branch ≥ 90) on every new/changed pure file.
- Content policy: the crit/fumble severity tables and the armor-vs-weapon-type modifier table are this project's own designed numbers, not transcribed from any rulebook's actual table.
- **Locked design decision (this plan, not previously in the spec): backstab and critical hits do NOT stack.** A backstab attack's own auto-hit + `backstabMultiplier` logic takes priority; the natural-20 crit severity roll only fires for a non-backstab attack. This avoids an undefined multiplier-stacking interaction the spec never addressed.
- **Locked design decision: armor-vs-weapon-type only applies to the PC-sheet attack path** (`src/sheets/character/combat-rolls.ts`), not creature attacks — `CreatureAttack` has no `damageType` field (a creature's THAC0 already "bakes in everything" per the SP6 design principle), so there is no weapon side of the pairing to key off for a creature attacker. A creature or NPC as the TARGET (not attacker) still gets a real armor-group lookup when hit by a PC's weapon — creatures default to the `"unarmored"` group (no `armorType` field exists on `CreatureModel`), which is a safe no-op given this plan's table returns 0 for `"unarmored"` on every damage type.
- Do NOT run `npm run format`/`prettier`/`npm install`/`npm update`. `npm run build` requires Foundry fully closed — re-confirm before every build attempt.
- Never pipe vitest output through `grep` — read via `tail`/`head`/redirect; a cache-clear's first run can genuinely flake, rerun 2-3× before concluding something is wrong.
- The gated dev-world smoke check (final task) is REQUIRED — never deferred, never skipped. A whole-branch review (most capable available model) is REQUIRED after all implementation tasks and BEFORE that check — make this an explicit task, not an afterthought (Plan 7a's own whole-branch review caught 1 Critical + 2 Important issues no per-task review found; do not treat this step as optional).

---

### Task 1: Pure critical-hit/fumble severity module

**Files:**
- Create: `src/combat/critical.ts`
- Test: `tests/combat/critical.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `criticalSeverity(d10: number): CriticalHitResult`, `fumbleSeverity(d10: number): FumbleResult` — Task 3 calls both.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/combat/critical.test.ts
import { describe, expect, it } from "vitest";
import { criticalSeverity, fumbleSeverity } from "../../src/combat/critical";

describe("criticalSeverity", () => {
  it("d10 1-5 is a solid hit: x2 damage, no flat bonus", () => {
    for (const d10 of [1, 5]) {
      expect(criticalSeverity(d10)).toEqual({ tier: "solid", damageMultiplier: 2, flatBonus: 0 });
    }
  });
  it("d10 6-9 is a devastating hit: x3 damage, no flat bonus", () => {
    for (const d10 of [6, 9]) {
      expect(criticalSeverity(d10)).toEqual({ tier: "devastating", damageMultiplier: 3, flatBonus: 0 });
    }
  });
  it("d10 10 is a brutal hit: x3 damage + flat +3", () => {
    expect(criticalSeverity(10)).toEqual({ tier: "brutal", damageMultiplier: 3, flatBonus: 3 });
  });
});

describe("fumbleSeverity", () => {
  it("d10 1-5 is just a miss: no effect", () => {
    for (const d10 of [1, 5]) {
      expect(fumbleSeverity(d10)).toEqual({ tier: "miss", effect: "none", selfInjuryDice: null });
    }
  });
  it("d10 6-8 drops the weapon", () => {
    for (const d10 of [6, 8]) {
      expect(fumbleSeverity(d10)).toEqual({ tier: "weaponDrops", effect: "weaponDrops", selfInjuryDice: null });
    }
  });
  it("d10 9-10 causes minor self-injury (1d3)", () => {
    for (const d10 of [9, 10]) {
      expect(fumbleSeverity(d10)).toEqual({ tier: "selfInjury", effect: "selfInjury", selfInjuryDice: "1d3" });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/combat/critical.test.ts 2>&1 | tail -30`
Expected: FAIL — `src/combat/critical.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/combat/critical.ts`**

```ts
// This project's own designed severity tables for natural-20/natural-1
// attack rolls (spec §2 "Critical hits/fumbles" — full severity tables, not
// a single toggleable formula). Content policy: mechanical values only, not
// transcribed from any rulebook's actual crit/fumble table.

export type CriticalTier = "solid" | "devastating" | "brutal";

export interface CriticalHitResult {
  tier: CriticalTier;
  /** multiplies the floored damage total, same mechanism as the existing
   *  backstabMultiplier (combat/card-types.ts) */
  damageMultiplier: number;
  /** added on top of the multiplied total */
  flatBonus: number;
}

/** d10 1-5: solid hit (x2). d10 6-9: devastating hit (x3). d10 10: brutal hit
 *  (x3 + flat +3). Backstab and critical hits do not stack — the caller only
 *  invokes this for a non-backstab natural 20 (a locked plan decision, see
 *  this plan's Global Constraints). */
export function criticalSeverity(d10: number): CriticalHitResult {
  if (d10 <= 5) return { tier: "solid", damageMultiplier: 2, flatBonus: 0 };
  if (d10 <= 9) return { tier: "devastating", damageMultiplier: 3, flatBonus: 0 };
  return { tier: "brutal", damageMultiplier: 3, flatBonus: 3 };
}

export type FumbleTier = "miss" | "weaponDrops" | "selfInjury";
export type FumbleEffect = "none" | "weaponDrops" | "selfInjury";

export interface FumbleResult {
  tier: FumbleTier;
  effect: FumbleEffect;
  /** a dice formula string for the caller to roll, or null when there is
   *  no self-injury roll for this tier */
  selfInjuryDice: string | null;
}

/** d10 1-5: just a miss, no extra effect. d10 6-8: the weapon drops (caller
 *  unequips it). d10 9-10: minor self-injury, roll 1d3 against the attacker. */
export function fumbleSeverity(d10: number): FumbleResult {
  if (d10 <= 5) return { tier: "miss", effect: "none", selfInjuryDice: null };
  if (d10 <= 8) return { tier: "weaponDrops", effect: "weaponDrops", selfInjuryDice: null };
  return { tier: "selfInjury", effect: "selfInjury", selfInjuryDice: "1d3" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/combat/critical.test.ts 2>&1 | tail -30`
Expected: PASS, all 6 assertions.

- [ ] **Step 5: Run coverage**

Run: `npm run test:coverage 2>&1 | tail -60`
Expected: `src/combat/critical.ts` at 100% statements/functions/lines, branches ≥ 90 (all 3 tiers of each function are exercised at both boundary values).

- [ ] **Step 6: Commit**

```bash
git add src/combat/critical.ts tests/combat/critical.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7b): pure critical-hit/fumble severity tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Pure armor-vs-weapon-type module

**Files:**
- Create: `src/combat/weapon-vs-armor.ts`
- Test: `tests/combat/weapon-vs-armor.test.ts`

**Interfaces:**
- Consumes: `ArmorType` (`src/core/types.ts`, the real 13-member type already used by `ARMOR_TYPES`), `DamageType` (`src/core/weapons/data.ts`, the real 5-member type already used by `DAMAGE_TYPES`).
- Produces: `ArmorGroup` (a new exported union type), `toArmorGroup(armorType: ArmorType): ArmorGroup`, `weaponVsArmorModifier(damageType: DamageType, armorGroup: ArmorGroup): number` — Task 4 calls both.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/combat/weapon-vs-armor.test.ts
import { describe, expect, it } from "vitest";
import { toArmorGroup, weaponVsArmorModifier } from "../../src/combat/weapon-vs-armor";
import { ARMOR_TYPES } from "../../src/data/item/choices";
import { DAMAGE_TYPES } from "../../src/data/item/choices";

describe("toArmorGroup", () => {
  it("classifies every one of the 13 real armor types into exactly one of the 4 groups", () => {
    const expected: Record<string, string> = {
      none: "unarmored",
      padded: "padded-leather-studded",
      leather: "padded-leather-studded",
      "studded-leather": "padded-leather-studded",
      "ring-mail": "ring-scale-chain",
      "scale-mail": "ring-scale-chain",
      "chain-mail": "ring-scale-chain",
      "elven-chain": "ring-scale-chain",
      "splint-mail": "splint-banded-plate",
      "banded-mail": "splint-banded-plate",
      "plate-mail": "splint-banded-plate",
      "field-plate": "splint-banded-plate",
      "full-plate": "splint-banded-plate",
    };
    for (const armorType of ARMOR_TYPES) {
      expect(toArmorGroup(armorType)).toBe(expected[armorType]);
    }
  });
});

describe("weaponVsArmorModifier", () => {
  it("is 0 for every damage type against unarmored", () => {
    for (const damageType of DAMAGE_TYPES) {
      expect(weaponVsArmorModifier(damageType, "unarmored")).toBe(0);
    }
  });
  it("slashing worsens against heavier armor groups", () => {
    expect(weaponVsArmorModifier("slashing", "padded-leather-studded")).toBe(0);
    expect(weaponVsArmorModifier("slashing", "ring-scale-chain")).toBe(-1);
    expect(weaponVsArmorModifier("slashing", "splint-banded-plate")).toBe(-2);
  });
  it("piercing is better against light armor, worse against plate", () => {
    expect(weaponVsArmorModifier("piercing", "padded-leather-studded")).toBe(1);
    expect(weaponVsArmorModifier("piercing", "ring-scale-chain")).toBe(0);
    expect(weaponVsArmorModifier("piercing", "splint-banded-plate")).toBe(-1);
  });
  it("bludgeoning is better against heavier armor groups", () => {
    expect(weaponVsArmorModifier("bludgeoning", "padded-leather-studded")).toBe(-1);
    expect(weaponVsArmorModifier("bludgeoning", "ring-scale-chain")).toBe(1);
    expect(weaponVsArmorModifier("bludgeoning", "splint-banded-plate")).toBe(2);
  });
  it("mixed piercing-slashing is mildly worse against heavier armor", () => {
    expect(weaponVsArmorModifier("piercing-slashing", "padded-leather-studded")).toBe(0);
    expect(weaponVsArmorModifier("piercing-slashing", "ring-scale-chain")).toBe(-1);
    expect(weaponVsArmorModifier("piercing-slashing", "splint-banded-plate")).toBe(-1);
  });
  it("mixed piercing-bludgeoning is always neutral", () => {
    expect(weaponVsArmorModifier("piercing-bludgeoning", "padded-leather-studded")).toBe(0);
    expect(weaponVsArmorModifier("piercing-bludgeoning", "ring-scale-chain")).toBe(0);
    expect(weaponVsArmorModifier("piercing-bludgeoning", "splint-banded-plate")).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/combat/weapon-vs-armor.test.ts 2>&1 | tail -30`
Expected: FAIL — `src/combat/weapon-vs-armor.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/combat/weapon-vs-armor.ts`**

```ts
import type { ArmorType } from "../core/types";
import type { DamageType } from "../core/weapons/data";

// This project's own designed weapon-vs-armor modifier table (spec §2
// "Armor-vs-weapon-type key" — damageType × a collapsed 4-bucket armor
// grouping, not all 13 individual ArmorType values, since this system's
// weapons only classify by broad damageType, not per-weapon-name granularity
// the way 2E's own actual table does). Content policy: mechanical values
// only, not transcribed from any rulebook's actual table.

export type ArmorGroup = "unarmored" | "padded-leather-studded" | "ring-scale-chain" | "splint-banded-plate";

const ARMOR_TYPE_TO_GROUP: Readonly<Record<ArmorType, ArmorGroup>> = {
  none: "unarmored",
  padded: "padded-leather-studded",
  leather: "padded-leather-studded",
  "studded-leather": "padded-leather-studded",
  "ring-mail": "ring-scale-chain",
  "scale-mail": "ring-scale-chain",
  "chain-mail": "ring-scale-chain",
  "elven-chain": "ring-scale-chain",
  "splint-mail": "splint-banded-plate",
  "banded-mail": "splint-banded-plate",
  "plate-mail": "splint-banded-plate",
  "field-plate": "splint-banded-plate",
  "full-plate": "splint-banded-plate",
};

/** Classifies a real 13-member ArmorType into one of the 4 collapsed groups
 *  this plan's modifier table keys against — mirrors the exact pattern
 *  `classifyThiefArmor` (core/proficiencies/thief-skills.ts) already
 *  established for the same 13-member enum. */
export function toArmorGroup(armorType: ArmorType): ArmorGroup {
  return ARMOR_TYPE_TO_GROUP[armorType];
}

const WEAPON_VS_ARMOR_TABLE: Readonly<Record<DamageType, Readonly<Record<ArmorGroup, number>>>> = {
  slashing: { unarmored: 0, "padded-leather-studded": 0, "ring-scale-chain": -1, "splint-banded-plate": -2 },
  piercing: { unarmored: 0, "padded-leather-studded": 1, "ring-scale-chain": 0, "splint-banded-plate": -1 },
  bludgeoning: { unarmored: 0, "padded-leather-studded": -1, "ring-scale-chain": 1, "splint-banded-plate": 2 },
  "piercing-slashing": { unarmored: 0, "padded-leather-studded": 0, "ring-scale-chain": -1, "splint-banded-plate": -1 },
  "piercing-bludgeoning": { unarmored: 0, "padded-leather-studded": 0, "ring-scale-chain": 0, "splint-banded-plate": 0 },
};

/** Positive = easier to hit (added directly to attackModifiers()'s
 *  situationalModifier, same sign convention as every other term there). */
export function weaponVsArmorModifier(damageType: DamageType, armorGroup: ArmorGroup): number {
  return WEAPON_VS_ARMOR_TABLE[damageType][armorGroup];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/combat/weapon-vs-armor.test.ts 2>&1 | tail -30`
Expected: PASS, all assertions (13-armor-type loop + 6 weaponVsArmorModifier describe blocks).

- [ ] **Step 5: Run coverage**

Run: `npm run test:coverage 2>&1 | tail -60`
Expected: `src/combat/weapon-vs-armor.ts` at 100% statements/functions/lines, branches ≥ 90.

- [ ] **Step 6: Commit**

```bash
git add src/combat/weapon-vs-armor.ts tests/combat/weapon-vs-armor.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7b): pure armor-vs-weapon-type modifier table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire critical hits/fumbles into both attack-roll paths + damage flow

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts`, `src/sheets/creature/combat-rolls.ts`, `src/combat/card-types.ts`, `src/combat/attack-card.ts`, `src/combat/damage-card.ts`, `src/chat/chat-listeners.ts`, `templates/chat/attack-roll.hbs`, `templates/chat/damage-roll.hbs`, `lang/en.json`, `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: `criticalSeverity`/`fumbleSeverity` (Task 1, `src/combat/critical.ts`); `getOptionalRules` (`src/settings/index.ts`, unchanged, already exported).
- Produces: `AttackCardContext.critLabel: string | null`, `AttackCardContext.fumbleLabel: string | null`, `DamageCardInput.critMultiplier`/`DamageCardContext.critMultiplier` (mirrors `backstabMultiplier` exactly) — no later task in this plan consumes these directly, but keep the naming consistent for future plans.

- [ ] **Step 1: Add `critMultiplier`/`critFlatBonus` to the damage-card types**

`src/combat/card-types.ts` — add two fields to `DamageCardInput` and `DamageCardContext`, alongside the existing `backstabMultiplier`:

```ts
export interface DamageCardInput {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string;
  rolledBaseDamage: number;
  damageBonus: number;
  backstabMultiplier: number | null;
  /** set only for a critical hit (never together with backstabMultiplier —
   *  backstab and crits do not stack, see this plan's Global Constraints).
   *  Multiplies the floored total the same way backstabMultiplier does. */
  critMultiplier: number | null;
  /** a crit's flat bonus, added AFTER the multiplier (brutal-tier crits
   *  only; 0 for every other case). */
  critFlatBonus: number;
}

export interface DamageCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string; rolled: number; bonus: number; total: number;
  backstabMultiplier: number | null;
  critMultiplier: number | null;
}
```

Also add two fields to `AttackCardInput`/`AttackCardContext` for the crit/fumble display labels:

```ts
export interface AttackCardInput {
  // ...(existing fields unchanged)...
  /** an i18n key naming the crit tier ("solid"/"devastating"/"brutal"), or
   *  null when this hit was not a (non-backstab) natural 20. */
  critLabel: string | null;
  /** an i18n key naming the fumble tier ("miss"/"weaponDrops"/"selfInjury"),
   *  or null when this attack was not a natural 1. */
  fumbleLabel: string | null;
}

export interface AttackCardContext {
  // ...(existing fields unchanged)...
  critLabel: string | null;
  fumbleLabel: string | null;
}
```

- [ ] **Step 2: Thread the new fields through `buildAttackCardContext`/`buildDamageCardContext`**

`src/combat/attack-card.ts` — add the two pass-through lines to the returned object:

```ts
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
    backstab: input.backstab,
    critLabel: input.critLabel,
    fumbleLabel: input.fumbleLabel,
    modifierBreakdown,
    damageContext: input.damageContext,
  };
```

`src/combat/damage-card.ts` — add `critMultiplier` to both the multiplication and the returned object (crit and backstab never coexist per this plan's locked decision, so at most one of the two multipliers is ever non-null at once — but write this defensively as "multiply by whichever is set" rather than assuming the caller enforces exclusivity, since a defensive pure function is cheap and correct either way):

```ts
export function buildDamageCardContext(input: DamageCardInput): DamageCardContext {
  const flooredTotal = damageResult(input.rolledBaseDamage, input.damageBonus);
  const multiplier = input.backstabMultiplier ?? input.critMultiplier ?? 1;
  const total = flooredTotal * multiplier + (input.critMultiplier ? input.critFlatBonus : 0);
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    weaponName: input.weaponName,
    formula: input.formula,
    rolled: input.rolledBaseDamage,
    bonus: input.damageBonus,
    total,
    backstabMultiplier: input.backstabMultiplier,
    critMultiplier: input.critMultiplier,
  };
}
```

- [ ] **Step 3: Wire crit/fumble severity into `src/sheets/character/combat-rolls.ts`'s `rollAttack`**

Import `criticalSeverity`/`fumbleSeverity` and `getOptionalRules`:

```ts
import { criticalSeverity, fumbleSeverity } from "../../combat/critical";
import { getOptionalRules } from "../../settings";
```

After `const baseHit = hitResult(...)` and the existing backstab-hit override, add the crit/fumble resolution (crit only fires for a NON-backstab natural 20; fumble fires for any natural 1 regardless of backstab, since a backstab attempt can still fumble):

```ts
  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  const hit = backstabActive ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const critEnabled = getOptionalRules().combatAndTacticsEnabled && getOptionalRules().criticalHits;
  const crit = critEnabled && baseHit.autoHit && !backstabActive ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  const fumble = critEnabled && baseHit.autoMiss ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;

  if (fumble?.effect === "weaponDrops") {
    await (weapon as unknown as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.equipped": false });
  }
  if (fumble?.effect === "selfInjury" && fumble.selfInjuryDice) {
    const selfRoll = await new Roll(fumble.selfInjuryDice).evaluate();
    await selfRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.localize("ADND2E.chat.attack.fumbleSelfInjury"),
    } as unknown as Roll.MessageData);
  }
```

**Real-source note for the implementer:** `Math.ceil(Math.random() * 10)` is a plain JS random 1-10 roll, not a Foundry `Roll` — this is DELIBERATE (crit/fumble severity is an instantaneous internal branch, not something a player needs to see rolled/animated; only the self-injury damage, which IS meaningful game state, uses a real `Roll`). Do not "fix" this to a `Roll` — it's correct as specified.

Update the `attackModifiers()`'s call to gate armor-vs-weapon-type is Task 4's job, not this task's — do not add it here.

Update the `buildAttackCardContext` call to pass the two new fields:

```ts
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
```

This means `damageContext`'s own type (`AttackCardInput.damageContext`, in `card-types.ts`) needs 2 more fields too — go back and add them:

```ts
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null; backstabMultiplier: number | null; critMultiplier: number | null; critFlatBonus: number } | null;
```

(Apply this same 2-field addition to BOTH the `AttackCardInput.damageContext` type AND the `AttackCardContext.damageContext` type in `card-types.ts` — they currently share the identical inline shape, keep them identical.)

- [ ] **Step 4: Apply the identical crit/fumble wiring to `src/sheets/creature/combat-rolls.ts`'s `rollAttack`**

Creature attacks don't use the `damageContext`/Roll-Damage-button flow (they roll damage immediately inline) — so the crit multiplier applies directly to the inline damage roll instead of through `damageContext`:

```ts
import { criticalSeverity, fumbleSeverity } from "../../combat/critical";
import { getOptionalRules } from "../../settings";

// ...inside rollAttack, after `const hit = hitResult(...)`:
  const critEnabled = getOptionalRules().combatAndTacticsEnabled && getOptionalRules().criticalHits;
  const crit = critEnabled && hit.autoHit ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  const fumble = critEnabled && hit.autoMiss ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;

  if (fumble?.effect === "selfInjury" && fumble.selfInjuryDice) {
    const selfRoll = await new Roll(fumble.selfInjuryDice).evaluate();
    await selfRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.localize("ADND2E.chat.attack.fumbleSelfInjury"),
    } as unknown as Roll.MessageData);
  }
  // Creature attacks have no weapon Item to unequip on a "weapon drops"
  // fumble (attacks[] is a flat array, not an embedded Item) — this outcome
  // is a no-op for a creature attacker, a deliberate v1 scope boundary.
```

Update `buildAttackCardContext`'s call with `critLabel`/`fumbleLabel` the same way as Task 3 Step 3. Then update the inline damage-roll block (after `if (hit.hit) { ... }`) to apply the crit multiplier ONLY when a crit is actually active — the existing non-crit path (`damageRoll.toMessage({flavor})`, Foundry's own default roll card) is UNCHANGED and must stay the common case, since it is already live, tested, dev-world-verified behavior from SP6:

```ts
  if (hit.hit) {
    const damageRoll = await new Roll(attack.damage).evaluate();
    if (!crit) {
      await damageRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor as never }),
        flavor: game.i18n!.format("ADND2E.chat.creature.damageFlavor", { name: attack.name }),
      } as unknown as Roll.MessageData);
    } else {
      // A crit multiplies/boosts the total, which Roll#toMessage() cannot
      // display while keeping the real evaluated roll attached (it always
      // shows the roll's own unmodified total) — this branch ONLY runs for
      // an active crit, never for a normal hit.
      const finalDamageTotal = (damageRoll.total ?? 0) * crit.damageMultiplier + crit.flatBonus;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor as never }),
        content: `${damageRoll.formula} = <strong>${finalDamageTotal}</strong>`,
        flavor: game.i18n!.format("ADND2E.chat.creature.damageFlavor", { name: attack.name }),
        rolls: [damageRoll],
      } as unknown as Record<string, unknown>);
    }
  }
```

**Real-source note:** read the real v14.364 `ChatMessage.create`/`Roll#toMessage` source (`client/documents/chat-message.mjs`) to confirm this `ChatMessage.create` call with an explicit `rolls` array is a valid way to post a roll-backed message with custom `content` overriding the default roll card, for the crit-only branch. If this doesn't work as expected against real source, use whatever the correct real v14.364 mechanism is and document the correction in your report — do not silently guess. Whatever you find, the non-crit branch above must remain byte-for-byte the original `damageRoll.toMessage({flavor})` call — do not touch it.

- [ ] **Step 5: Add a `unequipWeapon` reusability note (no new helper needed yet)**

The weapon-unequip logic in Step 3 (`weapon.update({"system.equipped": false})`) is inline, not yet extracted into a shared helper, because only ONE call site needs it in this plan. **Do not extract a separate `unequipWeapon()` function file for this plan** — Plan 7d (not part of this plan) will need the identical operation for its own disarm-maneuver outcome, and per spec §4.2's sequencing note, Plan 7d is responsible for extracting this into a shared helper AT THAT TIME (when there are genuinely two call sites, not one) — extracting now for a single caller would be premature. Leave a comment at the inline call site noting this:

```ts
  if (fumble?.effect === "weaponDrops") {
    // Inline for now — a future plan (SP7 Plan 7d, combat maneuvers) will
    // need the identical "unequip a weapon Item" operation for its own
    // disarm-maneuver outcome; extract this into a shared helper THEN, when
    // there are genuinely two call sites, not preemptively for one.
    await (weapon as unknown as { update(d: Record<string, unknown>): Promise<unknown> }).update({ "system.equipped": false });
  }
```

- [ ] **Step 6: Add the new lang keys**

In `lang/en.json`, add a new nested block under the existing `ADND2E.chat.attack` object (locate it — it already has `manualAcTitle`/`hit`/`miss`/`rollAttack`/etc.):

```json
        "crit": {
          "solid": "Critical hit!",
          "devastating": "Devastating critical hit!",
          "brutal": "Brutal critical hit!"
        },
        "fumble": {
          "miss": "Fumble!",
          "weaponDrops": "Fumble — weapon drops!",
          "selfInjury": "Fumble — minor self-injury!"
        },
        "fumbleSelfInjury": "Self-injury from a fumble"
```

Add drift-test coverage for these 7 new keys in `tests/lang/en-coverage.test.ts`, following the file's established per-block pattern (locate the existing `ADND2E.chat.attack.*` coverage block and extend it).

Also update the 2 hint texts this plan makes true — in `lang/en.json`, change:

```json
      "criticalHits": {
        "name": "Combat & Tactics: Critical Hits",
        "hint": "Natural 20 confirms for extra damage (Combat & Tactics)."
      },
```

(remove the `(not yet enforced — lands in a later Combat & Tactics plan)` suffix — this plan is what enforces it now). Leave `armorTypeVsWeaponType`'s hint alone for now — that's Task 4's job, not this task's.

- [ ] **Step 7: Update the 2 chat-card templates**

`templates/chat/attack-roll.hbs` — add the crit/fumble label display, right after the existing `{{#if backstab}}...{{/if}}` hit/miss result block:

```hbs
  {{#if critLabel}}<p class="result crit">{{localize critLabel}}</p>{{/if}}
  {{#if fumbleLabel}}<p class="result fumble">{{localize fumbleLabel}}</p>{{/if}}
```

`templates/chat/damage-roll.hbs` — add a crit display line alongside the existing backstab one:

```hbs
  {{#if critMultiplier}}
    <p class="crit">{{localize 'ADND2E.chat.attack.critApplied' multiplier=critMultiplier}}</p>
  {{/if}}
```

Add the new `ADND2E.chat.attack.critApplied` key (`"Critical hit! Damage ×{multiplier}"` or similar, mirroring the existing `ADND2E.sheet.combat.backstabApplied` key's exact wording style — read that key's real current text first and match its phrasing) to `lang/en.json` with drift-test coverage.

- [ ] **Step 8: Wire `chat-listeners.ts`'s `onRollDamage` to read the new dataset attributes**

`src/chat/chat-listeners.ts` — add `critMultiplier`/`critFlatBonus` to the destructured `button.dataset` read and pass them into `buildDamageCardContext`:

```ts
  const { actorUuid, weaponItemId, targetSize, backstabMultiplier, critMultiplier, critFlatBonus } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    targetSize?: string;
    backstabMultiplier?: string;
    critMultiplier?: string;
    critFlatBonus?: string;
  };
  // ...
  const context = buildDamageCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    weaponName: weapon.name,
    formula,
    rolledBaseDamage,
    damageBonus,
    backstabMultiplier: backstabMultiplier ? Number(backstabMultiplier) : null,
    critMultiplier: critMultiplier ? Number(critMultiplier) : null,
    critFlatBonus: critFlatBonus ? Number(critFlatBonus) : 0,
  });
```

And `templates/chat/attack-roll.hbs`'s "Roll Damage" button needs the 2 new dataset attributes added:

```hbs
    <button type="button" data-action="rollDamage"
      data-actor-uuid="{{damageContext.actorUuid}}" data-weapon-item-id="{{damageContext.weaponItemId}}"
      data-target-size="{{damageContext.targetSize}}" data-backstab-multiplier="{{damageContext.backstabMultiplier}}"
      data-crit-multiplier="{{damageContext.critMultiplier}}" data-crit-flat-bonus="{{damageContext.critFlatBonus}}">
      {{localize 'ADND2E.chat.attack.rollDamage'}}
    </button>
```

- [ ] **Step 9: Run the full verification gate**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.
Run: `npx vitest run 2>&1 | tail -60` — expect PASS, no regressions.
Run: `npm run test:coverage 2>&1 | tail -60` — expect 100% pure-zone coverage maintained.

- [ ] **Step 10: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/sheets/creature/combat-rolls.ts src/combat/card-types.ts src/combat/attack-card.ts src/combat/damage-card.ts src/chat/chat-listeners.ts templates/chat/attack-roll.hbs templates/chat/damage-roll.hbs lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp7b): wire critical hits/fumbles into both attack-roll paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire armor-vs-weapon-type into the PC attack-roll path

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts`, `lang/en.json`

**Interfaces:**
- Consumes: `toArmorGroup`/`weaponVsArmorModifier` (Task 2, `src/combat/weapon-vs-armor.ts`).
- Produces: nothing consumed by later tasks — a leaf integration.

Per this plan's Global Constraints, this modifier applies ONLY to the PC-sheet attack path (creature attacks have no `damageType` to key off) and ONLY in the single-target auto-resolved branch (consistent with Plan 7a's `heldAttackBonus`/`proneArmorClassPenalty` scope boundary).

- [ ] **Step 1: Add a target-armor-type resolver**

In `src/sheets/character/combat-rolls.ts`, add a small helper near `resolveTargetCombatInfo` (read that function's real current code first — this new helper follows the identical "read the target actor's items" pattern). Task 3 (dispatched before this task, already merged into this branch by the time you start) already added an `import { getOptionalRules } from "../../settings";` line to this same file for its own crit/fumble gating — do NOT add a second, duplicate import of it; reuse the existing one.

```ts
import type { ArmorType } from "../../core/types";
import { toArmorGroup, weaponVsArmorModifier } from "../../combat/weapon-vs-armor";

/** Finds the target's equipped `armor`-type item and reads its armorType,
 *  defaulting to "none" (the unarmored group) when the target has no
 *  equipped armor item at all — including every `creature`-type target,
 *  which has no armor Item concept (a safe no-op, since this plan's
 *  weaponVsArmorModifier table returns 0 for "unarmored" on every
 *  damage type). */
function resolveTargetArmorType(
  targetActor: { items: Iterable<{ type: string; system: { armorType?: string; equipped?: boolean } }> },
): ArmorType {
  const armorItem = [...targetActor.items].find((i) => i.type === "armor" && i.system.equipped);
  return (armorItem?.system.armorType as ArmorType | undefined) ?? "none";
}
```

- [ ] **Step 2: Wire it into `rollAttack`'s single-target branch**

Inside the `if (targets.length === 1) { ... }` block, alongside the existing `proneArmorClassPenalty`/`targetStatuses` resolution, add a new `armorVsWeaponModifier` local:

```ts
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
    // ...(unchanged manual-AC dialog block)
  }
```

Then fold `armorVsWeaponModifier` into the existing `situationalModifier` sum:

```ts
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    proficiencyModifier: resolveProficiencyModifier(actor, weapon),
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + armorVsWeaponModifier,
  });
```

(`weapon.system.damageType` is already typed `string | null` on `WeaponItemHandle` — the `if (... && weapon.system.damageType)` guard skips the modifier entirely for a weapon with no damage type modeled, e.g. a bow with no ammo item, matching this codebase's existing "no dice modeled" precedent in `chat-listeners.ts`'s `onRollDamage`.)

- [ ] **Step 3: Update the `armorTypeVsWeaponType` hint text**

In `lang/en.json`, remove the "not yet enforced" caveat from this one setting's hint (the other 3 still-unimplemented ones — `calledShots`/`combatManeuvers`/`weaponMastery` — keep their caveat, only this plan's own 2 settings, `criticalHits` from Task 3 and `armorTypeVsWeaponType` here, lose it):

```json
      "armorTypeVsWeaponType": {
        "name": "Combat & Tactics: Armor vs. Weapon Type",
        "hint": "Weapon-type modifiers versus armor type (Combat & Tactics)."
      },
```

- [ ] **Step 4: Run the full verification gate**

Run: `npm run typecheck 2>&1 | tail -30` — expect clean.
Run: `npm run lint 2>&1 | tail -30` — expect clean.
Run: `npx vitest run 2>&1 | tail -60` — expect PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/character/combat-rolls.ts lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp7b): wire armor-vs-weapon-type into the PC attack-roll path

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Whole-branch review

**Files:** none — review only.

- [ ] **Step 1: Generate the review package for the full branch diff**

Run the subagent-driven-development skill's `scripts/review-package` against `BASE` = this plan's starting commit (`master` at the time Task 1 was dispatched) and `HEAD` = Task 4's commit.

- [ ] **Step 2: Dispatch a whole-branch review on the most capable available model**

Explicitly ask the reviewer to check, beyond the standard full review: (a) that a backstab attack which also rolls a natural 20 genuinely never also gets a crit multiplier (trace the actual `!backstabActive` guard in the real committed code, not just the plan text); (b) that a creature attacker's fumble "weapon drops" outcome is genuinely a no-op with no error (creature attacks have no weapon Item — confirm nothing tries to call `.update()` on something that doesn't exist in that file); (c) that the armor-vs-weapon-type modifier is genuinely gated behind BOTH `combatAndTacticsEnabled` AND `armorTypeVsWeaponType` (not just one), and genuinely does nothing when either is off; (d) that `Math.random()`-based severity rolls (not a Foundry `Roll`) were used exactly where the plan specified and nowhere else it shouldn't be; (e) independently verify the real Foundry v14.364 mechanism Task 3 Step 4 used for posting a custom-content roll-backed chat message (`ChatMessage.create` with an explicit `rolls` array) actually behaves as intended, since this is a new pattern not used anywhere else in the codebase before this plan.

- [ ] **Step 3: Handle findings**

Per the skill's own process: one fix dispatch for any findings, one scoped re-review, adjudicate residuals. Record every finding and its resolution in the plan's SDD ledger.

---

### Task 6: GATED dev-world smoke check

**Files:** none — verification only, run by the user in a live linked Foundry v14.364 world.

This step is REQUIRED before `finishing-a-development-branch` — never deferred, never skipped, per this repo's standing rule.

- [ ] **Step 1: Enable the settings, build and link, ask the user to test**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world, enable BOTH `combatAndTacticsEnabled` and `criticalHits` in Configure Settings, and:

1. Roll attacks repeatedly (or manually force a natural 20 via console if the real UI doesn't expose a way to guarantee one) until a critical hit occurs — confirm a crit tier label appears in the chat card, and the eventual damage roll shows the correct multiplied (and, for a "brutal" result, +3 flat-bonus) total.
2. Roll attacks until a natural 1 (fumble) occurs — confirm a fumble tier label appears; specifically look for a "weapon drops" result and confirm the weapon's `equipped` checkbox on the sheet actually unchecks itself; separately look for a "self-injury" result and confirm a small 1d3 damage roll posts against the attacker.
3. Enable `armorTypeVsWeaponType`, equip a target in at least 2 different armor types from 2 different groups (e.g. leather = padded-leather-studded, plate-mail = splint-banded-plate), and attack with weapons of at least 2 different damage types (e.g. a slashing weapon and a bludgeoning weapon) — confirm the "Hit/Miss: N" needed-number shifts appropriately between the combinations (bludgeoning should get relatively BETTER against plate than slashing does, per this plan's own table).
4. Turn `criticalHits` and `armorTypeVsWeaponType` back OFF — confirm normal attacks show no crit/fumble labels and the armor-vs-weapon-type modifier no longer shifts the needed-number.

- [ ] **Step 2: Record the result**

If any step fails, diagnose (console errors, direct document inspection as needed) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 4 steps PASS.

---

After Task 6 passes: use **superpowers:finishing-a-development-branch**. After merge: **Plan 7b is complete — Plan 7c (Weapon mastery) is next.**
