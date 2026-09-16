# Sub-project 5a: Proficiencies — Weapon Proficiency + Non-Weapon Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire weapon-proficiency attack penalties and specialization purchase into the existing attack roll, add a real non-weapon proficiency check roll, and close two pre-existing gaps (unvalidated proficiency-item drops, an under-counting check-target display).

**Architecture:** Same established two-layer split as SP3/SP4: a new pure `src/combat/nonweapon-check-card.ts` chat-card builder (weapon proficiency needs no new card — SP3 already reserved and wired the display slot for it); the existing pure `context.ts`/`context-types.ts`/`drop-rules.ts` gain new pure eligibility/validation logic; the Foundry shell extends `combat-rolls.ts`'s `rollAttack` and adds a new `proficiency-actions.ts` (mirroring `spell-actions.ts`'s shape) for the two new sheet actions.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`ApplicationV2`, `Roll`, `ChatMessage`), Handlebars.

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp5-proficiencies-skills-design.md` — this plan implements: §4.2 (weapon proficiency in the attack flow), the specialization-purchase decision from §2, §4.4's non-weapon check (not the thief/bard-skill parts), and both gaps from §1.2. **Plan 5b** (a SEPARATE follow-up plan, not part of this one) covers thief/bard skill points + rolls, the `ARMOR_TYPES` schema change, and backstab.

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`) — never `fvtt-types` (a wrong v13-beta).
- **Two-layer contract:** `src/combat/nonweapon-check-card.ts` and the `context.ts`/`context-types.ts`/`drop-rules.ts` changes must import nothing from `foundry`/`game`/`CONFIG`/DOM. **`src/combat/**`/`tests/combat/**` are ALREADY in the gated-zone triad** (added in SP3) — confirmed by reading the current `tsconfig.core.json`/`vitest.config.ts`/`eslint.config.js`; **no new triad entries are needed**, the new file just needs to exist under a path those configs already cover. **100% Vitest coverage** (branch ≥ 90) still applies to every pure file touched.
- **Content policy:** mechanical/UI data only. Chat-card templates carry labels via `{{localize}}` keys, never 2E rules prose.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check is GATED** (Task 6) — the user runs it before `finishing-a-development-branch`, never a deferred checklist item.
- **No "related weapon" proficiency mode.** Only `"proficient"`/`"non-proficient"` are resolved — 2E's optional "related weapon" allowance isn't modeled by any data in this codebase (no table maps which weapons are "related" to which), so it's out of scope; `weaponAttackPenalty`'s `"related"` mode is simply never invoked by this plan.
- **Multi-class weapon-proficiency-penalty simplification:** for a multi-classed actor, the FIRST class item's chassis supplies `nonProficiencyPenalty` — matching the existing "first-member-wins" tie-break convention already used elsewhere in this codebase for other multi-class ambiguities (e.g. `core/classes/multiclass.ts`). Not a fully RAW-faithful "best of all classes" rule; documented here as a known v1 simplification, not silently invented.
- **`nonweaponSlotCost` gets a real caller for the first time.** It was defined in Plan 1b.6 but has had zero callers anywhere in the codebase until this plan. A dropped `nonweaponProficiency` item's own `slotCost` field is treated as the Table-37 BASE cost; the actual slots deducted are `nonweaponSlotCost(item.system.slotCost, item.system.group, classId)` (the FIRST class item, same simplification as above) — not the item's raw `slotCost` value directly.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Pure non-weapon check chat-card builder

**Files:**
- Modify: `src/combat/card-types.ts` — add `NonweaponCheckCardInput`/`NonweaponCheckCardContext`
- Create: `src/combat/nonweapon-check-card.ts`
- Test: `tests/combat/nonweapon-check-card.test.ts`

**Interfaces:**
- Consumes: `NonweaponCheckResult` (already exported from `src/core/proficiencies/nonweapon.ts`, Plan 1b.6 — do not modify that file).
- Produces: `buildNonweaponCheckCardContext(input: NonweaponCheckCardInput): NonweaponCheckCardContext` — Task 5's `proficiency-actions.ts` calls this from a new `rollNonweaponCheck` function.

No triad config edits are needed for this task — verify this yourself first.

- [ ] **Step 0: Confirm the gated-zone triad already covers `src/combat/`**

Run: `grep -n "src/combat" tsconfig.core.json vitest.config.ts eslint.config.js`
Expected: all three files already list `src/combat` (and `tests/combat`) in their respective include/coverage/lint arrays. If any file is MISSING an entry, stop and report — do not silently add one; that would mean a false assumption in this plan and needs a ruling, not a silent fix.

- [ ] **Step 1: Add the new types to `src/combat/card-types.ts`**

Append these two interfaces at the end of the file (after the existing `SaveCardContext` interface):

```ts

/* ---------- non-weapon proficiency check ---------- */

export interface NonweaponCheckCardInput {
  actorName: string;
  actorImg: string;
  proficiencyName: string;
  /** i18n key, e.g. config.abilities["dex"] */
  abilityLabel: string;
  formula: string;
  /** the 1d20 result actually rolled */
  roll: number;
  result: { success: boolean; autoFail: boolean; target: number };
}

export interface NonweaponCheckCardContext {
  actorName: string;
  actorImg: string;
  proficiencyName: string;
  abilityLabel: string;
  formula: string;
  roll: number;
  target: number;
  success: boolean;
  /** true only on a natural 20 — the card shows a distinct "fumble" line
   *  instead of the plain failure line when this is true (PHB p.55: a
   *  natural 20 always fails regardless of how high the target is) */
  autoFail: boolean;
}
```

- [ ] **Step 2: Write `tests/combat/nonweapon-check-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildNonweaponCheckCardContext } from "../../src/combat/nonweapon-check-card";
import type { NonweaponCheckCardInput } from "../../src/combat/card-types";

function input(over: Partial<NonweaponCheckCardInput> = {}): NonweaponCheckCardInput {
  return {
    actorName: "Aldric",
    actorImg: "icons/svg/mystery-man.svg",
    proficiencyName: "Herbalism",
    abilityLabel: "ADND2E.abilities.int",
    formula: "1d20",
    roll: 10,
    result: { success: true, autoFail: false, target: 14 },
    ...over,
  };
}

describe("buildNonweaponCheckCardContext", () => {
  it("passes through actor/proficiency display fields unchanged", () => {
    const c = buildNonweaponCheckCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.proficiencyName).toBe("Herbalism");
    expect(c.abilityLabel).toBe("ADND2E.abilities.int");
    expect(c.formula).toBe("1d20");
  });

  it("a normal success carries success:true, autoFail:false", () => {
    const c = buildNonweaponCheckCardContext(
      input({ roll: 10, result: { success: true, autoFail: false, target: 14 } }),
    );
    expect(c.success).toBe(true);
    expect(c.autoFail).toBe(false);
    expect(c.roll).toBe(10);
    expect(c.target).toBe(14);
  });

  it("a normal failure (roll above target, not a 20) carries success:false, autoFail:false", () => {
    const c = buildNonweaponCheckCardContext(
      input({ roll: 18, result: { success: false, autoFail: false, target: 14 } }),
    );
    expect(c.success).toBe(false);
    expect(c.autoFail).toBe(false);
  });

  it("a natural 20 always carries success:false, autoFail:true, even against a high target", () => {
    const c = buildNonweaponCheckCardContext(
      input({ roll: 20, result: { success: false, autoFail: true, target: 19 } }),
    );
    expect(c.success).toBe(false);
    expect(c.autoFail).toBe(true);
    expect(c.roll).toBe(20);
    expect(c.target).toBe(19);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/combat/nonweapon-check-card.test.ts 2>&1 | tail -30`
Expected: FAIL — `Cannot find module '../../src/combat/nonweapon-check-card'`.

- [ ] **Step 4: Write `src/combat/nonweapon-check-card.ts`**

```ts
import type { NonweaponCheckCardContext, NonweaponCheckCardInput } from "./card-types";

/** Turn a resolved non-weapon proficiency check into the chat-card's display
 *  data. Pure passthrough/flattening — `nonweaponCheck` (core/proficiencies/
 *  nonweapon.ts) already did all the real math; this just reshapes its
 *  result alongside the actor/proficiency display fields. */
export function buildNonweaponCheckCardContext(input: NonweaponCheckCardInput): NonweaponCheckCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    proficiencyName: input.proficiencyName,
    abilityLabel: input.abilityLabel,
    formula: input.formula,
    roll: input.roll,
    target: input.result.target,
    success: input.result.success,
    autoFail: input.result.autoFail,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/combat/nonweapon-check-card.test.ts 2>&1 | tail -30`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% statement/line/function coverage (branch ≥ 90%) on `src/combat/**`.

- [ ] **Step 7: Commit**

```bash
git add src/combat/card-types.ts src/combat/nonweapon-check-card.ts tests/combat/nonweapon-check-card.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5a): pure non-weapon check chat-card builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Slot-cost validation on proficiency-item drop

**Files:**
- Modify: `src/sheets/character/drop-rules.ts`
- Modify: `tests/sheets/character/drop-rules.test.ts`

**Interfaces:**
- Consumes: nothing new — this task adds two optional fields to the already-existing `DropCheckInput`/`validateItemDrop`.
- Produces: `validateItemDrop` now rejects a `weaponProficiency`/`nonweaponProficiency` drop that would exceed available slots. Task 5's `sheet.ts` `_onDropItem` extension calls this with the new fields populated.

- [ ] **Step 1: Read the current file**

Read `src/sheets/character/drop-rules.ts` in full (it's short — `DropCheckInput`, `DropVerdict`, and `validateItemDrop`) before editing. This task extends it, not rewrites it.

- [ ] **Step 2: Write the new failing tests**

In `tests/sheets/character/drop-rules.test.ts`, find:

```ts
  it("allows any other item type unconditionally", () => {
    for (const t of ["weapon", "armor", "equipment", "spell", "weaponProficiency", "nonweaponProficiency", "classFeature"]) {
      expect(validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] }))
        .toEqual({ ok: true });
    }
  });
```

Replace with (removes `weaponProficiency`/`nonweaponProficiency` from the unconditional list — they now have their own rules below):

```ts
  it("allows any other item type unconditionally", () => {
    for (const t of ["weapon", "armor", "equipment", "spell", "classFeature"]) {
      expect(validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] }))
        .toEqual({ ok: true });
    }
  });

  it("allows a weaponProficiency/nonweaponProficiency drop with no cost/available info supplied (default cost 1, default available 0 — rejected)", () => {
    for (const t of ["weaponProficiency", "nonweaponProficiency"] as const) {
      const r = validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("ADND2E.sheet.drop.insufficientSlots");
    }
  });

  it("allows a weaponProficiency drop when available slots cover its cost", () => {
    expect(validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 2,
    })).toEqual({ ok: true });
  });

  it("rejects a weaponProficiency drop when available slots don't cover its cost", () => {
    const r = validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.insufficientSlots");
  });

  it("allows a nonweaponProficiency drop when available slots exactly cover its cost", () => {
    expect(validateItemDrop({
      dropType: "nonweaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 2, availableSlots: 2,
    })).toEqual({ ok: true });
  });

  it("rejects a nonweaponProficiency drop when available slots fall short by one", () => {
    const r = validateItemDrop({
      dropType: "nonweaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 3, availableSlots: 2,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.insufficientSlots");
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/sheets/character/drop-rules.test.ts 2>&1 | tail -40`
Expected: the 5 new/changed cases FAIL (the old unconditional behavior still applies — `dropSlotCost`/`availableSlots` aren't read yet).

- [ ] **Step 4: Extend `DropCheckInput` and `validateItemDrop`**

Find:

```ts
export interface DropCheckInput {
  /** the dropped item's `type` */
  dropType: string;
  /** the dropped item's `system.chassisId` when `dropType === "class"` */
  dropChassisId?: string | null;
  /** does the actor already have a `race` item */
  hasRace: boolean;
  /** `system.chassisId` of every `class` item already on the actor */
  existingChassisIds: readonly string[];
}
```

Replace with:

```ts
export interface DropCheckInput {
  /** the dropped item's `type` */
  dropType: string;
  /** the dropped item's `system.chassisId` when `dropType === "class"` */
  dropChassisId?: string | null;
  /** does the actor already have a `race` item */
  hasRace: boolean;
  /** `system.chassisId` of every `class` item already on the actor */
  existingChassisIds: readonly string[];
  /** slots the dropped item would cost, when `dropType` is `weaponProficiency`/
   *  `nonweaponProficiency` — defaults to 1 if omitted (a fresh weapon
   *  proficiency always costs exactly 1 slot at drop time; specialization is
   *  a separate later purchase). */
  dropSlotCost?: number;
  /** slots currently available in the matching category (weapon or
   *  nonweapon) — defaults to 0 if omitted, so an un-supplied value rejects
   *  rather than silently allowing an unbounded drop. */
  availableSlots?: number;
}
```

Find:

```ts
/** Which compendium/world items a character sheet accepts on drop, and why not. */
export function validateItemDrop(input: DropCheckInput): DropVerdict {
  if (input.dropType === "race") {
    return input.hasRace ? { ok: false, reason: "ADND2E.sheet.drop.duplicateRace" } : { ok: true };
  }
  if (input.dropType === "class") {
    const dup = input.dropChassisId != null && input.existingChassisIds.includes(input.dropChassisId);
    return dup ? { ok: false, reason: "ADND2E.sheet.drop.duplicateClass" } : { ok: true };
  }
  return { ok: true };
}
```

Replace with:

```ts
/** Which compendium/world items a character sheet accepts on drop, and why not. */
export function validateItemDrop(input: DropCheckInput): DropVerdict {
  if (input.dropType === "race") {
    return input.hasRace ? { ok: false, reason: "ADND2E.sheet.drop.duplicateRace" } : { ok: true };
  }
  if (input.dropType === "class") {
    const dup = input.dropChassisId != null && input.existingChassisIds.includes(input.dropChassisId);
    return dup ? { ok: false, reason: "ADND2E.sheet.drop.duplicateClass" } : { ok: true };
  }
  if (input.dropType === "weaponProficiency" || input.dropType === "nonweaponProficiency") {
    const cost = input.dropSlotCost ?? 1;
    const available = input.availableSlots ?? 0;
    return cost > available ? { ok: false, reason: "ADND2E.sheet.drop.insufficientSlots" } : { ok: true };
  }
  return { ok: true };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/sheets/character/drop-rules.test.ts 2>&1 | tail -40`
Expected: PASS, all cases including the 5 new/changed ones.

- [ ] **Step 6: Add the new lang key**

In `lang/en.json`, find the `"drop"` block under `"sheet"` (it currently has `duplicateRace`/`duplicateClass`):

```json
      "drop": {
        "duplicateRace": "...",
        "duplicateClass": "..."
      },
```

(Read the file first to see the exact current strings — do not guess them.) Add `"insufficientSlots": "Not enough proficiency slots available for that."` as a new sibling key inside the same `"drop"` block, adjusting commas so the JSON stays valid.

- [ ] **Step 7: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage maintained on `drop-rules.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/sheets/character/drop-rules.ts tests/sheets/character/drop-rules.test.ts lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp5a): validate proficiency-item drops against available slots

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Real check-target formula + weapon specialization eligibility

**Files:**
- Modify: `src/sheets/character/context-types.ts` — `NwpView`/`WeaponProfView` gain new fields; `PhysicalItemView.weapon` gains `category`
- Modify: `src/sheets/character/context.ts` — real `checkTarget`; new `buildWeaponProfRow`
- Modify: `src/sheets/character/sheet.ts` — `toPhysicalView`'s weapon sub-object gains `category`
- Modify: `tests/sheets/character/context.test.ts` — fixture updates + new test cases

**Interfaces:**
- Consumes: `nonweaponCheck`'s real formula shape (already established, Task 1 consumes the roll RESULT — this task fixes the sheet's pre-roll DISPLAY estimate, which is a simpler `ability + modifier + (slotsInvested-1)` with no roll/situational term yet); `canWeaponSpecialize`/`weaponSpecializationSlotCost` from `src/core/proficiencies/weapon.ts` (already exists, Plan 1b.6).
- Produces: `WeaponProfView.canSpecialize: boolean` and `WeaponProfView.category: "melee"|"crossbow"|"bow"|null` — Task 5's `specializeWeapon` action and `skills.hbs`'s Specialize button both read these. `NwpView.checkTarget` now includes the `(slotsInvested-1)` term it was missing.

Before editing, read the CURRENT real content of `src/sheets/character/context.ts`'s `buildSkills`/`buildNwpRow` and `src/sheets/character/context-types.ts`'s `WeaponProfView`/`NwpView`/`PhysicalItemView` — this task extends that same code, it does not recreate it.

- [ ] **Step 1: Add `category` to `PhysicalItemView.weapon` and the new fields to `WeaponProfView`/`NwpView`**

In `src/sheets/character/context-types.ts`, find:

```ts
export interface PhysicalItemView {
  id: string; name: string; img: string; type: "weapon" | "armor" | "equipment";
  quantity: number; weight: number; totalWeight: number;
  location: string; equipped: boolean; identified: boolean; magicBonus: number;
  /** equipment only */
  isContainer: boolean; capacity: number | null; contentsWeightMultiplier: number;
  /** weapon only — pre-derived display strings */
  weapon?: { damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number };
}
```

Replace with (adds `category` to the `weapon` sub-object):

```ts
export interface PhysicalItemView {
  id: string; name: string; img: string; type: "weapon" | "armor" | "equipment";
  quantity: number; weight: number; totalWeight: number;
  location: string; equipped: boolean; identified: boolean; magicBonus: number;
  /** equipment only */
  isContainer: boolean; capacity: number | null; contentsWeightMultiplier: number;
  /** weapon only — pre-derived display strings */
  weapon?: {
    damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null;
    category: "melee" | "thrown" | "bow" | "crossbow";
  };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number };
}
```

Find:

```ts
export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  slotsInvested: number; specialized: boolean;
}
```

Replace with:

```ts
export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  slotsInvested: number; specialized: boolean;
  /** filled by context.ts's buildWeaponProfRow — sheet.ts's toWeaponProfView
   *  placeholder is null/false until then, same pattern as NwpView's
   *  governingAbilityLabel/checkTarget. The weapon-category this proficiency
   *  resolves to (by matching `weaponOrGroup` against the actor's owned
   *  weapon Items by name) — null when it's a group proficiency (groups are
   *  never specialization-eligible) or no matching weapon Item is found. */
  category: "melee" | "crossbow" | "bow" | null;
  /** true when this proficiency can be specialized right now: not a group,
   *  a resolved category exists, the actor's (first) class allows
   *  specialization, the actor is single-classed, it isn't already
   *  specialized, and enough weapon slots are available. */
  canSpecialize: boolean;
}
```

Find:

```ts
export interface NwpView {
  id: string; name: string; governingAbility: string; modifier: number;
  slotCost: number; slotsInvested: number; isRacial: boolean;
  /** i18n key for governingAbility — filled by buildNwpRow; "" until then */
  governingAbilityLabel: string;
  /** governing ability score + modifier — display only (checks are SP5) */
  checkTarget: number | null;
}
```

Replace with (updates the stale doc comment now that SP5 is the one filling this in, and clarifies the formula the display now reflects):

```ts
export interface NwpView {
  id: string; name: string; governingAbility: string; modifier: number;
  slotCost: number; slotsInvested: number; isRacial: boolean;
  /** i18n key for governingAbility — filled by buildNwpRow; "" until then */
  governingAbilityLabel: string;
  /** ability score + modifier + (slotsInvested-1) — the real pre-roll
   *  target (situational modifier isn't known until Roll time, so it's
   *  never part of this display value). */
  checkTarget: number | null;
}
```

- [ ] **Step 2: Run typecheck to confirm the type changes compile in isolation**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: FAIL — `context.ts`'s `buildWeaponProfRow` doesn't exist yet, `sheet.ts`'s `toPhysicalView`/`toWeaponProfView` don't yet satisfy the widened interfaces, and `context.test.ts`'s fixtures are missing the new fields. All expected; fixed in the next steps.

- [ ] **Step 3: Add `category` to `sheet.ts`'s `toPhysicalView`**

In `src/sheets/character/sheet.ts`, find:

```ts
  if (type === "weapon") {
    view.weapon = {
      damageVsSM: (s.damageVsSM as string | null) ?? null,
      damageVsL: (s.damageVsL as string | null) ?? null,
      speedFactor: Number(s.speedFactor ?? 0),
      range: rangeToString(s.range),
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
    };
  }
```

- [ ] **Step 4: Add `category`/`canSpecialize` placeholders to `sheet.ts`'s `toWeaponProfView`**

Find:

```ts
function toWeaponProfView(it: RawItem): WeaponProfView {
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
  };
}
```

Replace with:

```ts
function toWeaponProfView(it: RawItem): WeaponProfView {
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
    // Placeholders — buildWeaponProfRow (context.ts) recomputes both from
    // the actor's owned weapon Items + class chassis + available slots.
    category: null,
    canSpecialize: false,
  };
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: still FAIL — only `context.ts`'s missing `buildWeaponProfRow`/real `checkTarget` and `context.test.ts`'s fixtures remain. Fixed next.

- [ ] **Step 6: Write `buildWeaponProfRow` and fix `buildNwpRow`'s `checkTarget` in `context.ts`**

Add this import near the top of `src/sheets/character/context.ts`, alongside the existing `import { getChassis } from "../../core/classes/chassis";` line:

```ts
import { canWeaponSpecialize, weaponSpecializationSlotCost } from "../../core/proficiencies/weapon";
```

Find the current `/* ---------- skills ---------- */` block:

```ts
/* ---------- skills ---------- */

function buildSkills(input: CharacterSheetInput): CharacterSheetContext["skills"] {
  const p = input.derived.proficiencies;
  return {
    weapon: { ...p.weapon, items: input.proficiencyItems.weapon },
    nonweapon: {
      ...p.nonweapon,
      items: input.proficiencyItems.nonweapon.map((n) => buildNwpRow(n, input)),
    },
  };
}

function buildNwpRow(n: NwpView, input: CharacterSheetInput): NwpView {
  const ability = input.derived.abilities[n.governingAbility as AbilityKey];
  return {
    ...n,
    governingAbilityLabel: input.config.abilities[n.governingAbility] ?? n.governingAbility,
    checkTarget: ability.score + n.modifier,
  };
}
```

Replace with:

```ts
/* ---------- skills ---------- */

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

function buildNwpRow(n: NwpView, input: CharacterSheetInput): NwpView {
  const ability = input.derived.abilities[n.governingAbility as AbilityKey];
  return {
    ...n,
    governingAbilityLabel: input.config.abilities[n.governingAbility] ?? n.governingAbility,
    checkTarget: ability.score + n.modifier + (n.slotsInvested - 1),
  };
}

/** Resolves a weapon proficiency's specialization category by matching its
 *  `weaponOrGroup` name against the actor's owned weapon Items — null for a
 *  group proficiency (never specialization-eligible) or when no matching
 *  weapon Item is found. Thrown weapons map to "melee" (a locked
 *  brainstorming decision — PHB treats thrown-weapon specialization under
 *  the melee rule). */
function resolveWeaponCategory(prof: WeaponProfView, physicalItems: PhysicalItemView[]): "melee" | "crossbow" | "bow" | null {
  if (prof.isGroup) return null;
  const weapon = physicalItems.find((p) => p.type === "weapon" && p.name === prof.weaponOrGroup);
  if (!weapon?.weapon) return null;
  if (weapon.weapon.category === "bow") return "bow";
  if (weapon.weapon.category === "crossbow") return "crossbow";
  return "melee";
}

/** Enriches a raw WeaponProfView with its resolved specialization category
 *  and whether Specialize can be purchased right now. Mirrors the
 *  established "buildXRow re-derives eligibility for both display AND the
 *  action's own re-check" pattern (e.g. SP4a's buildSpellRow/canReMemorize). */
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
    weaponSlotsAvailable >= weaponSpecializationSlotCost(category);
  return { ...prof, category, canSpecialize: eligible };
}
```

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: still FAIL on `context.test.ts`'s fixtures (Step 5's failure persists on that one file). `context.ts`/`context-types.ts`/`sheet.ts` should now be clean; fix those first if they are not.

- [ ] **Step 8: Fix `tests/sheets/character/context.test.ts`'s existing fixtures**

Grep the WHOLE file for every `PhysicalItemView`-shaped and `WeaponProfView`-shaped literal — not just ones inside a "skills" describe block, since a weapon fixture could exist anywhere the file builds inventory data. For each `weapon: {...}` object literal found (matching `PhysicalItemView.weapon`'s shape — look for `damageVsSM`/`speedFactor` as the identifying fields), add `category: "melee"` (or whatever category makes sense for that specific fixture — read its surrounding context; default to `"melee"` if the test doesn't care). For each `WeaponProfView`-shaped literal (identifying fields: `weaponOrGroup`/`isGroup`/`slotsInvested`/`specialized`), add `category: null, canSpecialize: false` as defaults unless the specific test is about specialization eligibility (Step 10 adds dedicated new tests for that; existing fixtures elsewhere in the file should stay inert with these two false/null defaults).

Run `npm run typecheck 2>&1 | tail -60` after each fix and keep going until `context.test.ts` is the ONLY remaining error source, then keep fixing until it's clean too.

- [ ] **Step 9: Run the full context test file to confirm the existing suite is green again**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -60`
Expected: PASS, no failures (existing tests didn't assert on the new fields, only on things unaffected by this change — the `checkTarget` formula change is the one exception: if any EXISTING test asserted a specific `checkTarget` value with `slotsInvested !== 1`, that assertion's expected number needs updating to include the new `+(slotsInvested-1)` term; search for existing `checkTarget` assertions and verify each one by hand against the corrected formula).

- [ ] **Step 10: Add new test cases for `buildWeaponProfRow` and the real `checkTarget`**

Add this new `describe` block to the end of `tests/sheets/character/context.test.ts` (alongside the other `describe` blocks, not nested inside one):

```ts
describe("buildCharacterSheetContext — weapon specialization eligibility + real checkTarget", () => {
  const weaponItem = (over: Partial<PhysicalItemView> = {}): PhysicalItemView => ({
    id: "w1", name: "Long Sword", img: "", type: "weapon",
    quantity: 1, weight: 4, totalWeight: 4, location: "", equipped: true, identified: true, magicBonus: 0,
    isContainer: false, capacity: null, contentsWeightMultiplier: 1,
    weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee" },
    ...over,
  });
  const weaponProf = (over: Partial<WeaponProfView> = {}): WeaponProfView => ({
    id: "wp1", name: "Long Sword Proficiency", weaponOrGroup: "Long Sword", isGroup: false,
    slotsInvested: 1, specialized: false, category: null, canSpecialize: false,
    ...over,
  });
  const fighterClass = {
    id: "c1", name: "Fighter", img: "", chassisId: "fighter", hitDie: 10,
    xp: 0, level: 1, canLevelUp: false, dualClassState: null, specialistSchool: null,
  };

  it("single-classed fighter, matching owned weapon, enough slots → canSpecialize true, category resolved", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.category).toBe("melee");
    expect(row.canSpecialize).toBe(true);
  });

  it("not enough available slots → canSpecialize false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 3, available: 1 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canSpecialize).toBe(false);
  });

  it("already specialized → canSpecialize false", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ specialized: true })], nonweapon: [] },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canSpecialize).toBe(false);
  });

  it("a group proficiency is never specialization-eligible (category null)", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [fighterClass],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf({ isGroup: true, weaponOrGroup: "Blades" })], nonweapon: [] },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    const row = c.skills.weapon.items[0]!;
    expect(row.category).toBeNull();
    expect(row.canSpecialize).toBe(false);
  });

  it("a non-fighter class (specializationAllowed false) → canSpecialize false even with slots to spare", () => {
    const c = buildCharacterSheetContext(
      input({
        classItems: [{ ...fighterClass, chassisId: "mage" }],
        physicalItems: [weaponItem()],
        proficiencyItems: { weapon: [weaponProf()], nonweapon: [] },
        derived: {
          ...input().derived,
          proficiencies: { weapon: { total: 4, spent: 1, available: 3 }, nonweapon: { total: 3, spent: 0, available: 3 } },
        },
      }),
    );
    expect(c.skills.weapon.items[0]!.canSpecialize).toBe(false);
  });

  it("checkTarget includes the (slotsInvested-1) bonus", () => {
    const c = buildCharacterSheetContext(
      input({
        proficiencyItems: {
          weapon: [],
          nonweapon: [{
            id: "n1", name: "Herbalism", governingAbility: "int", modifier: 0,
            slotCost: 1, slotsInvested: 3, isRacial: false, governingAbilityLabel: "", checkTarget: null,
          }],
        },
      }),
    );
    // base fixture's INT score is 10 (see the base input() helper) — target = 10 + 0 + (3-1) = 12
    expect(c.skills.nonweapon.items[0]!.checkTarget).toBe(12);
  });
});
```

(Verify the base `input()` fixture's `derived.abilities.int.score` is really `10` before trusting the `12` expectation above — read the file's base fixture first; adjust the expected number to match whatever it actually is if different.)

- [ ] **Step 11: Run the full context test file**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -80`
Expected: PASS, all tests (existing + the 6 new ones) green.

- [ ] **Step 12: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage maintained on `context.ts`.

- [ ] **Step 13: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts \
  src/sheets/character/sheet.ts tests/sheets/character/context.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5a): real non-weapon checkTarget + weapon specialization eligibility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Weapon proficiency in the attack roll

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts` — `rollAttack` resolves and applies the proficiency modifier

**Interfaces:**
- Consumes: `weaponAttackPenalty`/`weaponSpecializationEffect` (`src/core/proficiencies/weapon.ts`, already exists); `ClassChassis.nonProficiencyPenalty`/`getChassis` (already used elsewhere in this file's sibling `sheet.ts`).
- Produces: nothing new for later tasks — `AttackCardContext.modifierBreakdown.proficiency` (already exists, SP3) now carries a real, non-zero value for the first time. No changes needed to `attack-card.ts`/`card-types.ts` — the existing generic zero-filtering + label lookup already handles any non-zero `proficiency` value correctly.

Before writing anything, read the CURRENT real content of `src/sheets/character/combat-rolls.ts` in full — it already has `rollAttack`/`rollSave`/`resolveTargetCombatInfo`. This task extends `rollAttack` only.

- [ ] **Step 1: Extend `AttackerActor`/`WeaponItemHandle` and add the proficiency resolution helper**

Find:

```ts
interface AttackerActor {
  name: string; img: string; uuid: string;
  system: { attributes?: { thac0?: { melee?: number; ranged?: number } } };
  items: { get(id: string): WeaponItemHandle | undefined };
}
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
  };
}
```

Replace with (adds `items` iteration for weaponProficiency lookup and a `classes` list for chassis resolution):

```ts
interface AttackerActor {
  name: string; img: string; uuid: string;
  system: { attributes?: { thac0?: { melee?: number; ranged?: number } } };
  items: { get(id: string): WeaponItemHandle | undefined } & Iterable<GenericAttackerItem>;
}
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
  };
}
/** Minimal shape needed to find the actor's class chassis and weapon-proficiency
 *  items without a dedicated Item subtype per iteration entry. */
interface GenericAttackerItem {
  type: string;
  system: Record<string, unknown>;
}

/** Resolves the attack-roll `proficiencyModifier` (per core/combat/attack.ts's
 *  AttackModifierInput doc comment: "0 if proficient; class non-proficiency
 *  penalty if not; +1 if specialized") by matching `weapon` against the
 *  actor's weaponProficiency items — by exact name for a specific-weapon
 *  proficiency, or by `weaponOrGroup === weapon.system.proficiencyGroup` for
 *  a group proficiency. Uses the FIRST class item's chassis for the
 *  non-proficiency penalty and the specialization category-to-bonus lookup
 *  (a documented v1 simplification for multi-classed actors — see this
 *  plan's Global Constraints). Only "proficient"/"non-proficient" are ever
 *  resolved; "related" weapon proficiency isn't modeled anywhere in this
 *  codebase. */
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): number {
  let isProficient = false;
  let specialized = false;
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as { weaponOrGroup?: string; isGroup?: boolean; specialized?: boolean };
    const matches = s.isGroup
      ? s.weaponOrGroup === weapon.system.proficiencyGroup
      : s.weaponOrGroup === weapon.name;
    if (matches) {
      isProficient = true;
      specialized = Boolean(s.specialized);
      break;
    }
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
  if (!isProficient || !specialized) return base;

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  return base + weaponSpecializationEffect(category).toHit;
}
```

- [ ] **Step 2: Add the new imports**

Find:

```ts
import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";
```

Replace with:

```ts
import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { getChassis } from "../../core/classes/chassis";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { weaponAttackPenalty, weaponSpecializationEffect } from "../../core/proficiencies/weapon";
import { TEMPLATE_PATH } from "../../constants";
import type { ClassId, SaveCategory } from "../../core/types";
```

- [ ] **Step 3: Wire the new modifier into `rollAttack`**

Find:

```ts
  const isRanged = weapon.system.category !== "melee";
  const thac0 = isRanged ? (actor.system.attributes?.thac0?.ranged ?? 20) : (actor.system.attributes?.thac0?.melee ?? 20);
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    // Proficiency/STR/DEX modifiers are intentionally NOT wired in SP3 — they
    // require the weaponProficiency-item lookup and ability-mod plumbing SP5
    // owns; a bare weapon-magic-only bonus is the honest v1 (spec §7 boundary).
  });
```

Replace with:

```ts
  const isRanged = weapon.system.category !== "melee";
  const thac0 = isRanged ? (actor.system.attributes?.thac0?.ranged ?? 20) : (actor.system.attributes?.thac0?.melee ?? 20);
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    proficiencyModifier: resolveProficiencyModifier(actor, weapon),
    // STR/DEX modifiers remain out of scope (parent spec §7 boundary,
    // unchanged by this sub-project).
  });
```

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, same count as Task 3's end state (no new tests — this task has no pure-zone changes).

- [ ] **Step 6: Attempt a build**

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (Foundry closed).

- [ ] **Step 7: Commit**

```bash
git add src/sheets/character/combat-rolls.ts
git commit -m "$(cat <<'EOF'
feat(sp5a): weapon proficiency + specialization in the attack roll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Specialize + Check actions, sheet wiring, chat card

**Files:**
- Create: `src/sheets/character/proficiency-actions.ts`
- Modify: `src/sheets/character/sheet.ts` — action wiring + `_onDropItem` slot-cost check
- Modify: `templates/actor/character/skills.hbs` — Specialize + Check buttons
- Create: `templates/chat/nonweapon-check-roll.hbs`
- Modify: `lang/en.json` — new sheet + chat keys

**Interfaces:**
- Consumes: `buildNonweaponCheckCardContext` from Task 1; `WeaponProfView.canSpecialize`/`category` and the real `NwpView.checkTarget` from Task 3; `weaponSpecializationSlotCost`/`nonweaponSlotCost` (already exists, Plan 1b.6, `nonweaponSlotCost` gets its first real caller here).
- Produces: `specializeWeapon(actor, weaponProfItemId): Promise<void>` and `rollNonweaponCheck(actor, nwpItemId): Promise<void>` in `proficiency-actions.ts`.

Before writing anything, read `src/sheets/character/spell-actions.ts` in full (already in this codebase) — it is the direct style template for this task (same "Foundry-coupled glue, no unit tests, dev-world verified" header comment, same defensive-re-check-with-toast pattern for every action).

- [ ] **Step 1: Write `src/sheets/character/proficiency-actions.ts`**

```ts
import { getChassis } from "../../core/classes/chassis";
import { nonweaponCheck, nonweaponSlotCost } from "../../core/proficiencies/nonweapon";
import { canWeaponSpecialize, weaponSpecializationSlotCost } from "../../core/proficiencies/weapon";
import type { AbilityKey, ClassId, NonweaponGroup } from "../../core/types";
import { buildNonweaponCheckCardContext } from "../../combat/nonweapon-check-card";
import { TEMPLATE_PATH } from "../../constants";

/* ---------------------------------------------------------------------------
 * proficiency-actions — SP5a.
 *
 * Foundry-coupled weapon-specialization-purchase / non-weapon-check glue for
 * the character sheet's Skills tab — not unit-tested (spec §9-equivalent for
 * this plan), verified in a linked dev world. All math and chat-card shaping
 * is delegated to the pure core/proficiencies and combat/nonweapon-check-card
 * modules; this file only reads documents, writes slot/specialization state,
 * rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

interface WeaponProfItemHandle {
  id: string;
  system: { weaponOrGroup: string; isGroup: boolean; slotsInvested: number; specialized: boolean };
}
interface NwpItemHandle {
  id: string; name: string;
  system: { governingAbility: string; modifier: number; slotCost: number; group: string; slotsInvested: number };
}
interface WeaponItemHandle2 {
  system: { category: string; proficiencyGroup: string };
}
/** Minimal shape needed to find the actor's class chassis and its owned
 *  weapon Items (for resolving a weapon proficiency's specialization
 *  category) without a dedicated Item subtype per iteration entry. Every
 *  real embedded Item document has its own `.update()` — declaring it here
 *  means `actor.items.get(id)` results can be written back directly, no
 *  extra cast needed. */
interface GenericProficiencyActorItem {
  id: string; name: string; type: string; system: Record<string, unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

interface ProficiencyActor {
  name: string; img: string;
  system: {
    abilities: Record<AbilityKey, { score: number }>;
    proficiencies: { weapon: { available: number }; nonweapon: { available: number } };
  };
  items: {
    get(id: string): (WeaponProfItemHandle | NwpItemHandle) & GenericProficiencyActorItem | undefined;
  } & Iterable<GenericProficiencyActorItem>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Finds the actor's FIRST class item's chassisId — matches the same
 *  first-member-wins simplification used in combat-rolls.ts's
 *  resolveProficiencyModifier, for consistency across this plan's two
 *  multi-class-ambiguous call sites. */
function firstClassChassisId(actor: ProficiencyActor): ClassId | null {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) return chassisId as ClassId;
  }
  return null;
}

/** Resolves a weapon proficiency item's specialization category by matching
 *  its `weaponOrGroup` name against the actor's owned weapon Items — null
 *  for a group proficiency or no matching weapon. Thrown weapons map to
 *  "melee" (locked brainstorming decision). */
function resolveCategory(actor: ProficiencyActor, prof: WeaponProfItemHandle): "melee" | "crossbow" | "bow" | null {
  if (prof.system.isGroup) return null;
  for (const item of actor.items) {
    if (item.type !== "weapon" || item.name !== prof.system.weaponOrGroup) continue;
    const cat = (item as unknown as WeaponItemHandle2).system.category;
    if (cat === "bow") return "bow";
    if (cat === "crossbow") return "crossbow";
    return "melee";
  }
  return null;
}

/** Purchases specialization on a weapon proficiency: re-derives the same
 *  eligibility context.ts's `buildWeaponProfRow` used to decide whether to
 *  show the Specialize button (not a group, a resolved category, the
 *  actor's first-class chassis allows it, single-classed, not already
 *  specialized, enough available slots), spends the category's slot cost,
 *  and sets `specialized: true`. No-ops with a toast on any failed
 *  re-check — a defensive guard against a stale button click, not the
 *  primary gate. */
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
  const cost = weaponSpecializationSlotCost(category);
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

(`prof` — the object `actor.items.get(weaponProfItemId)` returns — is the real embedded `Item` document, and `GenericProficiencyActorItem` declares its `.update()` directly, so this write needs no extra cast: `weaponProficiency` proficiencies are embedded Items on the actor, and the update targets the ITEM document, not the actor.)

- [ ] **Step 2: Add `rollNonweaponCheck` to the same file**

Append this to the end of `src/sheets/character/proficiency-actions.ts`:

```ts

/** Rolls a 1d20 non-weapon proficiency check for `nwpItemId` against the
 *  actor's cached ability score, the proficiency's own modifier, and its
 *  invested slots — situational modifier is always 0 for v1 (no manual
 *  prompt, matching saving throws' simplicity rather than attack rolls'
 *  manual-AC dialog). Always posts a chat card. */
export async function rollNonweaponCheck(actor: ProficiencyActor, nwpItemId: string): Promise<void> {
  const item = actor.items.get(nwpItemId);
  const nwp = item as (NwpItemHandle & GenericProficiencyActorItem) | undefined;
  if (!nwp || nwp.type !== "nonweaponProficiency") {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.checkBlockedWarning"));
    return;
  }
  const ability = nwp.system.governingAbility as AbilityKey;
  const abilityScore = actor.system.abilities[ability]?.score ?? 0;
  const roll = await new Roll("1d20").evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const result = nonweaponCheck({
    ability,
    abilityScore,
    checkModifier: nwp.system.modifier,
    slotsInvested: nwp.system.slotsInvested,
    situationalModifier: 0,
    roll: naturalD20,
  });
  const context = buildNonweaponCheckCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    proficiencyName: nwp.name,
    abilityLabel: `ADND2E.abilities.${ability}`,
    formula: "1d20",
    roll: naturalD20,
    result,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/nonweapon-check-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as Roll.MessageData);
}
```

(`nonweaponSlotCost` is imported at the top of this file per Step 1's import line but is not yet called anywhere in this task — it is wired in as part of Task 2's drop-cost computation in `sheet.ts`'s `_onDropItem`, Step 4 below, which lives in a different file. If your editor/linter flags it as an unused import in THIS file at this point, move the import to `sheet.ts` instead, where it is actually used — see Step 4.)

- [ ] **Step 3: Wire both actions into `sheet.ts`**

In `src/sheets/character/sheet.ts`, find:

```ts
import { castSpell, forgetSpell, learnSpell, memorizeSpell, restSpellcasting } from "./spell-actions";
```

Replace with (adds the new import):

```ts
import { castSpell, forgetSpell, learnSpell, memorizeSpell, restSpellcasting } from "./spell-actions";
import { rollNonweaponCheck, specializeWeapon } from "./proficiency-actions";
```

Find the `DEFAULT_OPTIONS.actions` block:

```ts
      learnSpell: Adnd2eCharacterSheet.#onLearnSpell,
    },
  };
```

Replace with:

```ts
      learnSpell: Adnd2eCharacterSheet.#onLearnSpell,
      specializeWeapon: Adnd2eCharacterSheet.#onSpecializeWeapon,
      rollNonweaponCheck: Adnd2eCharacterSheet.#onRollNonweaponCheck,
    },
  };
```

Find the end of the class (the `#onLearnSpell` static method, right before the closing `}` of `Adnd2eCharacterSheet`):

```ts
  static async #onLearnSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await learnSpell(this.document as never, spellItemId);
  }
}
```

Replace with:

```ts
  static async #onLearnSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await learnSpell(this.document as never, spellItemId);
  }

  // Interaction handlers — SP5a.
  static async #onSpecializeWeapon(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponProfItemId = target.dataset.itemId;
    if (weaponProfItemId) await specializeWeapon(this.document as never, weaponProfItemId);
  }

  static async #onRollNonweaponCheck(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const nwpItemId = target.dataset.itemId;
    if (nwpItemId) await rollNonweaponCheck(this.document as never, nwpItemId);
  }
}
```

- [ ] **Step 4: Wire the drop-slot-cost check into `sheet.ts`'s `_onDropItem`**

Add this import near the top of `sheet.ts`, alongside the other relative imports:

```ts
import { getChassis } from "../../core/classes/chassis"; // (already imported at the top of this file — merge, don't duplicate)
import { nonweaponSlotCost } from "../../core/proficiencies/nonweapon";
import type { NonweaponGroup } from "../../core/types"; // merge into the existing `import type { ClassId, SaveCategory } from "../../core/types";` line
```

(The `getChassis` line above is a reminder, not a new import — `sheet.ts` already imports it. Only actually ADD the `nonweaponSlotCost` import and merge `NonweaponGroup` into the existing type-only import line.)

Find:

```ts
  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const existing = [
      ...(this.document as unknown as { items: Iterable<{ type: string; system: { chassisId?: string | null } }> })
        .items,
    ];
    const dropped = item as unknown as { type: string; system: { chassisId?: string | null } };
    const verdict = validateItemDrop({
      dropType: dropped.type,
      dropChassisId: dropped.system?.chassisId ?? null,
      hasRace: existing.some((i) => i.type === "race"),
      existingChassisIds: existing
        .filter((i) => i.type === "class")
        .map((i) => i.system.chassisId ?? "")
        .filter(Boolean),
    });
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason!));
      return null;
    }
    return super._onDropItem(event, item);
  }
```

Replace with:

```ts
  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const actor = this.document as unknown as {
      system: { proficiencies: { weapon: { available: number }; nonweapon: { available: number } } };
      items: Iterable<{
        type: string;
        system: { chassisId?: string | null; slotCost?: number; group?: NonweaponGroup };
      }>;
    };
    const existing = [...actor.items];
    const dropped = item as unknown as {
      type: string;
      system: { chassisId?: string | null; slotCost?: number; group?: NonweaponGroup };
    };

    let dropSlotCost: number | undefined;
    let availableSlots: number | undefined;
    if (dropped.type === "weaponProficiency") {
      dropSlotCost = 1;
      availableSlots = actor.system.proficiencies.weapon.available;
    } else if (dropped.type === "nonweaponProficiency") {
      const firstClassId = existing.find((i) => i.type === "class")?.system.chassisId ?? null;
      dropSlotCost = firstClassId
        ? nonweaponSlotCost(dropped.system.slotCost ?? 1, dropped.system.group ?? "general", firstClassId as never)
        : (dropped.system.slotCost ?? 1);
      availableSlots = actor.system.proficiencies.nonweapon.available;
    }

    const verdict = validateItemDrop({
      dropType: dropped.type,
      dropChassisId: dropped.system?.chassisId ?? null,
      hasRace: existing.some((i) => i.type === "race"),
      existingChassisIds: existing
        .filter((i) => i.type === "class")
        .map((i) => i.system.chassisId ?? "")
        .filter(Boolean),
      dropSlotCost,
      availableSlots,
    });
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason!));
      return null;
    }
    return super._onDropItem(event, item);
  }
```

- [ ] **Step 5: Add the Specialize / Check buttons to `skills.hbs`**

In `templates/actor/character/skills.hbs`, find:

```hbs
          <span class="slots">{{w.slotsInvested}}</span>
          {{#if w.specialized}}
            <span class="specialized" title="{{localize 'ADND2E.sheet.skills.specialized'}}">★</span>
          {{/if}}
          {{! SP5 wires the check buttons here }}
        </div>
```

Replace with:

```hbs
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
```

Find:

```hbs
          <span class="target" title="{{localize 'ADND2E.sheet.skills.checkTarget'}}">{{n.checkTarget}}</span>
          {{! SP5 wires the check buttons here }}
        </div>
```

Replace with:

```hbs
          <span class="target" title="{{localize 'ADND2E.sheet.skills.checkTarget'}}">{{n.checkTarget}}</span>
          <button type="button" data-action="rollNonweaponCheck" data-item-id="{{n.id}}">
            {{localize 'ADND2E.sheet.skills.check'}}
          </button>
        </div>
```

- [ ] **Step 6: Write `templates/chat/nonweapon-check-roll.hbs`**

Read `templates/chat/save-roll.hbs` first (already exists, same shape — a single d20 roll vs. a target) as the direct style template, then write:

```hbs
<div class="adnd2e chat-card nonweapon-check-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{proficiencyName}} ({{localize abilityLabel}})</h3>
  </header>
  <p class="formula">{{formula}} = <strong>{{roll}}</strong> ({{localize 'ADND2E.sheet.skills.checkTarget'}}: {{target}})</p>
  {{#if autoFail}}
    <p class="result fail">{{localize 'ADND2E.chat.nwpCheck.autoFail'}}</p>
  {{else if success}}
    <p class="result success">{{localize 'ADND2E.chat.nwpCheck.success'}}</p>
  {{else}}
    <p class="result fail">{{localize 'ADND2E.chat.nwpCheck.failure'}}</p>
  {{/if}}
</div>
```

- [ ] **Step 7: Add the new `lang/en.json` keys**

In `lang/en.json`, find the `"skills"` block under `"sheet"` (read the file first for its exact current contents — it has `weapon`/`nonweapon`/`slots`/`checkTarget`/`group`/`specialized`/`racial`/`none`). Add these new keys as siblings inside the same block:

```json
        "specialize": "Specialize",
        "check": "Check",
        "specializeBlockedWarning": "That weapon can no longer be specialized — refresh the sheet.",
        "checkBlockedWarning": "That proficiency can't be checked right now — refresh the sheet."
```

Find the `"chat"` block's structure (it has `attack`/`damage`/`save`/`cast`/`learnSpell` sibling blocks by now). Add a new sibling block:

```json
      "nwpCheck": {
        "success": "Success",
        "failure": "Failure",
        "autoFail": "Natural 20 — automatic failure"
      }
```

(Adjust commas so the JSON stays valid — read the real current file structure before editing, do not guess the exact surrounding punctuation.)

- [ ] **Step 8: Add the drift-test block**

In `tests/lang/en-coverage.test.ts`, find the end of the existing SP4b `describe` block (its closing `});`), and add this new block immediately after it:

```ts
describe("lang/en.json — SP5a proficiency strings", () => {
  it("resolves every ADND2E.sheet.skills.{specialize,check,specializeBlockedWarning,checkBlockedWarning} + ADND2E.sheet.drop.insufficientSlots + ADND2E.chat.nwpCheck.* key the proficiency-actions layer references", () => {
    for (const key of [
      "ADND2E.sheet.skills.specialize",
      "ADND2E.sheet.skills.check",
      "ADND2E.sheet.skills.specializeBlockedWarning",
      "ADND2E.sheet.skills.checkBlockedWarning",
      "ADND2E.sheet.drop.insufficientSlots",
      "ADND2E.chat.nwpCheck.success",
      "ADND2E.chat.nwpCheck.failure",
      "ADND2E.chat.nwpCheck.autoFail",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 9: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean. (If `nonweaponSlotCost` in `proficiency-actions.ts` is flagged unused, remove that import from `proficiency-actions.ts` — it is genuinely only used in `sheet.ts` per Step 4's note.)

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass — one more than Task 3's end state (the new lang drift test), coverage unchanged on the pure zone (this task touches no pure files besides the drift test).

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (Foundry closed). Confirm `dist/templates/chat/nonweapon-check-roll.hbs` exists.

- [ ] **Step 10: Commit**

```bash
git add src/sheets/character/proficiency-actions.ts src/sheets/character/sheet.ts \
  templates/actor/character/skills.hbs templates/chat/nonweapon-check-roll.hbs \
  lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp5a): weapon specialization purchase + non-weapon check actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: GATED dev-world smoke check (Plan 5a)

**Files:** none — this task is verification only, run by the user in a live linked Foundry v14.364 world.

**Interfaces:**
- Consumes: the fully built system from Tasks 1-5.
- Produces: PASS/FAIL confirmation for each step below, required before `finishing-a-development-branch`.

This step is REQUIRED before finishing the branch — never deferred, never skipped, per this repo's standing rule.

- [ ] **Step 1: Build and link, ask the user to test in their world**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world and walk through spec §6's steps 1-4 (steps 5-8 belong to Plan 5b):

1. A fighter with a proficient weapon (drag a `weaponProficiency` item, `weaponOrGroup` matching an owned weapon's exact name) vs. a non-proficient one (no matching proficiency item): confirm the attack roll's `proficiency` modifier line shows `0` for the proficient weapon and the class's non-proficiency penalty for the other.
2. Specialize the fighter's proficient weapon: confirm slots deduct correctly (`slotsInvested` increases by the category's cost), the `+1`/`+2` bonus appears on the NEXT attack roll with that weapon, and the Specialize button disappears once used (and never appears for a non-fighter or multi-classed character).
3. Drop a `weaponProficiency`/`nonweaponProficiency` item onto a sheet with 0 available slots left: confirm it's rejected with a toast, not silently added.
4. Click Check on a non-weapon proficiency: confirm the posted target matches `ability score + modifier + (slotsInvested-1)`, and a natural 20 always shows as a failure even when the target is high.

- [ ] **Step 2: Record the result**

If any step fails, diagnose (console errors, direct document inspection as needed — same debugging pattern established in SP3/4a/4b) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 4 steps PASS.

---

After Task 6 passes: use **superpowers:finishing-a-development-branch**. After merge: Plan 5a complete — Plan 5b (thief/bard skills, backstab) is the next plan under the same spec.
