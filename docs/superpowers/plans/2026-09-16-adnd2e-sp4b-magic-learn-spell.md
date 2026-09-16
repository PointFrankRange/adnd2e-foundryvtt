# Sub-project 4b: Magic — Learn Spell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `core/magic/spellbook.ts` engine into a real wizard-only "Learn Spell" workflow on the character sheet — a percentage roll against a computed chance that, on success, adds a known spell item to the wizard's spellbook.

**Architecture:** Same two-layer split as Plan 4a: a new pure `src/magic/learn-spell-card.ts` chat-card content builder (alongside the existing `cast-card.ts`/`priest-sphere-access.ts` in the already-gated `src/magic/` directory) feeding a Foundry-shell `learnSpell` action added to the existing `spell-actions.ts`, wired through the existing `Adnd2eCharacterSheet` action pattern and the existing pure `context.ts`/`context-types.ts` render layer (which already computes per-spell `memorized`/`expended`/`canMemorize`/`canCast` from Plan 4a — this plan adds a fifth field, `canLearn`).

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`ApplicationV2`, `Roll`, `ChatMessage`), Handlebars.

**Spec:** `docs/superpowers/specs/2026-09-15-adnd2e-sp4-magic-design.md` — this plan implements ONLY §4.2 ("Plan 4b"), the parts of §7 (scope boundary) and §5 (error handling) that apply to Learn Spell, and the "Plan 4b dev-world checklist" in §6. §4.1/Plan 4a (memorize/forget/cast/rest/apply) is **already complete and merged** (PR #22) — `src/magic/{card-types,cast-card,priest-sphere-access}.ts`, `src/sheets/character/spell-actions.ts` (with `memorizeSpell`/`forgetSpell`/`castSpell`/`restSpellcasting` already in it), the `memorized[].expended` schema field, and the cast chat-card flow all already exist in this repo — read the real files, don't treat any of it as still-to-build.

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`) — never `fvtt-types` (a wrong v13-beta).
- **Two-layer contract:** `src/magic/learn-spell-card.ts` and the `context.ts`/`context-types.ts` changes must import nothing from `foundry`/`game`/`CONFIG`/DOM. **`src/magic/**` and `tests/magic/**` are ALREADY in the gated-zone config triad** (added in Plan 4a) — confirmed by reading the current `tsconfig.core.json`/`vitest.config.ts`/`eslint.config.js`; **no new triad entries are needed for this plan**, the new file just needs to exist under a path those configs already cover. **100% Vitest coverage** (branch ≥ 90) still applies to every pure file touched.
- **Content policy:** mechanical/UI data only. Chat-card templates carry labels via `{{localize}}` keys, never 2E rules prose.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check is GATED** (Task 5) — the user runs it before `finishing-a-development-branch`, never a deferred checklist item.
- **Priests get NO Learn Spell step.** Sphere access (already fully wired in Plan 4a) is their only gate. The Learn Spell action/button must only ever be computed/shown for `casterClass === "wizard"` spell items not already in `spellbookItemIds`.
- **v1 simplification, explicit and intentional:** a spell's `schools` field is an array (the schema allows multiple), but `core/magic/spellbook.ts`'s `canLearnSpell` takes a single `spellSchool: WizardSchool`. This plan resolves that by using the FIRST school in the item's `schools` array that is a recognized `WizardSchool` (one of the 8 specialist schools — `WIZARD_SCHOOLS` in `src/data/item/choices.ts`). A spell whose `schools` contains only non-`WizardSchool` tags (`"lesser-divination"`/`"wild"`, which have no specialist table entry) cannot be Learn-attempted at all — this is a pre-existing gap in the underlying `core/magic` engine's modeling (not something this plan's scope covers fixing), and real spell content is expected to be authored with exactly one school in the overwhelming majority of cases.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Pure learn-spell chat-card builder

**Files:**
- Modify: `src/magic/card-types.ts` — add `LearnSpellCardInput`/`LearnSpellCardContext`
- Create: `src/magic/learn-spell-card.ts`
- Test: `tests/magic/learn-spell-card.test.ts`

**Interfaces:**
- Consumes: `CanLearnResult`/`LearnRejection` (already exported from `src/core/magic/spellbook.ts`, Plan 1b.5 — do not modify that file).
- Produces: `buildLearnSpellCardContext(input: LearnSpellCardInput): LearnSpellCardContext` — Task 3's `spell-actions.ts` calls this from a new `learnSpell` function.

No triad config edits are needed for this task — verify this yourself first by running the two greps below; both should show `src/magic`/`tests/magic` already present.

- [ ] **Step 0: Confirm the gated-zone triad already covers `src/magic/`**

Run: `grep -n "src/magic" tsconfig.core.json vitest.config.ts eslint.config.js`
Expected: all three files already list `src/magic` (and `tests/magic`) in their respective include/coverage/lint arrays. If any file is MISSING an entry, stop and report — do not silently add one; that would mean a false assumption in this plan and needs a ruling, not a silent fix.

- [ ] **Step 1: Add the new types to `src/magic/card-types.ts`**

Add this import at the very top of the file (the file currently has no imports — this is the first one):

```ts
import type { CanLearnResult } from "../core/magic/spellbook";
```

Then append these two interfaces at the end of the file (after the existing `CastCardContext` interface):

```ts

export interface LearnSpellCardInput {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  result: CanLearnResult;
  /** null when result.allowed is false — a rejected attempt never rolls */
  roll: { d100: number; success: boolean } | null;
}

export interface LearnSpellCardContext {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  allowed: boolean;
  chance: number;
  /** i18n key for the rejection reason; null when allowed is true */
  reasonLabel: string | null;
  roll: { d100: number; success: boolean } | null;
}
```

- [ ] **Step 2: Write `tests/magic/learn-spell-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildLearnSpellCardContext } from "../../src/magic/learn-spell-card";
import type { LearnSpellCardInput } from "../../src/magic/card-types";

function input(over: Partial<LearnSpellCardInput> = {}): LearnSpellCardInput {
  return {
    actorName: "Aldric",
    actorImg: "icons/svg/mystery-man.svg",
    spellName: "Magic Missile",
    spellLevel: 1,
    result: { allowed: true, chance: 55, reason: null },
    roll: { d100: 42, success: true },
    ...over,
  };
}

describe("buildLearnSpellCardContext", () => {
  it("allowed + successful roll passes through chance/roll and has no reasonLabel", () => {
    const c = buildLearnSpellCardContext(input());
    expect(c.allowed).toBe(true);
    expect(c.chance).toBe(55);
    expect(c.reasonLabel).toBeNull();
    expect(c.roll).toEqual({ d100: 42, success: true });
  });

  it("allowed + failed roll still has no reasonLabel", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: true, chance: 20, reason: null }, roll: { d100: 87, success: false } }),
    );
    expect(c.allowed).toBe(true);
    expect(c.roll).toEqual({ d100: 87, success: false });
    expect(c.reasonLabel).toBeNull();
  });

  it("rejected: int-too-low", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "int-too-low" }, roll: null }),
    );
    expect(c.allowed).toBe(false);
    expect(c.roll).toBeNull();
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.intTooLow");
  });

  it("rejected: spell-level-exceeds-int", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "spell-level-exceeds-int" }, roll: null }),
    );
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.spellLevelExceedsInt");
  });

  it("rejected: opposition-school", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "opposition-school" }, roll: null }),
    );
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.oppositionSchool");
  });

  it("rejected: per-level-cap-reached", () => {
    const c = buildLearnSpellCardContext(
      input({ result: { allowed: false, chance: 0, reason: "per-level-cap-reached" }, roll: null }),
    );
    expect(c.reasonLabel).toBe("ADND2E.chat.learnSpell.rejection.perLevelCapReached");
  });

  it("passes actor/spell display fields through unchanged", () => {
    const c = buildLearnSpellCardContext(input({ spellName: "Fireball", spellLevel: 3 }));
    expect(c.spellName).toBe("Fireball");
    expect(c.spellLevel).toBe(3);
    expect(c.actorName).toBe("Aldric");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/magic/learn-spell-card.test.ts 2>&1 | tail -30`
Expected: FAIL — `Cannot find module '../../src/magic/learn-spell-card'`.

- [ ] **Step 4: Write `src/magic/learn-spell-card.ts`**

```ts
import type { LearnRejection } from "../core/magic/spellbook";
import type { LearnSpellCardContext, LearnSpellCardInput } from "./card-types";

const REJECTION_LABELS: Record<LearnRejection, string> = {
  "int-too-low": "ADND2E.chat.learnSpell.rejection.intTooLow",
  "spell-level-exceeds-int": "ADND2E.chat.learnSpell.rejection.spellLevelExceedsInt",
  "opposition-school": "ADND2E.chat.learnSpell.rejection.oppositionSchool",
  "per-level-cap-reached": "ADND2E.chat.learnSpell.rejection.perLevelCapReached",
};

/** Turn a resolved (or rejected) Learn Spell attempt into the chat-card's
 *  display data. `roll` is null when `result.allowed` is false — a rejected
 *  attempt never gets a d100 roll. */
export function buildLearnSpellCardContext(input: LearnSpellCardInput): LearnSpellCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    spellName: input.spellName,
    spellLevel: input.spellLevel,
    allowed: input.result.allowed,
    chance: input.result.chance,
    reasonLabel: input.result.reason ? REJECTION_LABELS[input.result.reason] : null,
    roll: input.roll,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/magic/learn-spell-card.test.ts 2>&1 | tail -30`
Expected: PASS (7 tests).

- [ ] **Step 6: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% statement/line/function coverage (branch ≥ 90%) on `src/magic/**`.

- [ ] **Step 7: Commit**

```bash
git add src/magic/card-types.ts src/magic/learn-spell-card.ts tests/magic/learn-spell-card.test.ts
git commit -m "$(cat <<'EOF'
feat(sp4b): pure learn-spell chat-card builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Learn-eligibility wiring into the render-context layer

**Files:**
- Modify: `src/sheets/character/context-types.ts` — `CharacterSheetInput` gains `optionalRules`; `SpellItemView` gains `canLearn`
- Modify: `src/sheets/character/context.ts` — `buildSpells`/`buildSpellRow` compute `canLearn` for wizard spells
- Modify: `src/sheets/character/sheet.ts` — `#buildInput` supplies `optionalRules`; `toSpellView`'s placeholder object gains `canLearn: false`
- Modify: `tests/sheets/character/context.test.ts` — fixture updates + new eligibility test cases

**Interfaces:**
- Consumes: `canLearnSpell(input: CanLearnInput): CanLearnResult` from `src/core/magic/spellbook.ts` (already exists, Plan 1b.5); `WIZARD_SCHOOLS: readonly WizardSchool[]` from `src/data/item/choices.ts` (already exists); `getOptionalRules(): OptionalRules` from `src/settings/index.ts` (already exists, used elsewhere in the Foundry shell e.g. `src/documents/combatant.ts`).
- Produces: `SpellItemView.canLearn: boolean` — Task 3's `spells.hbs` reads this to show/hide the Learn Spell button. `CharacterSheetInput.optionalRules: OptionalRules` — available to any future context.ts logic that needs an optional-rule flag.

Before editing, read the CURRENT real content of `src/sheets/character/context.ts`'s `buildSpells`/`buildSpellRow` functions and `src/sheets/character/context-types.ts`'s `CharacterSheetInput`/`SpellItemView` — these already exist from Plan 4a with `memorized`/`expended`/`canMemorize`/`canCast`/`orphaned` wired in; this task extends that same code, it does not recreate it.

- [ ] **Step 1: Add `optionalRules` to `CharacterSheetInput` and `canLearn` to `SpellItemView`**

In `src/sheets/character/context-types.ts`, find the top import block:

```ts
import type {
  CharismaModifiers, ConstitutionModifiers, DexterityModifiers, IntelligenceModifiers,
  StrengthModifiers, WisdomModifiers,
} from "../../core/types";
```

Replace with (adds one new import line):

```ts
import type {
  CharismaModifiers, ConstitutionModifiers, DexterityModifiers, IntelligenceModifiers,
  StrengthModifiers, WisdomModifiers,
} from "../../core/types";
import type { OptionalRules } from "../../core/options";
```

Find:

```ts
export interface CharacterSheetInput {
  name: string;
  img: string;
  /** document._source.system — authored values, for <input> binding */
  source: Record<string, unknown>;
  /** the prepared system.* — derived/cached values */
  derived: CharacterDerivedView;
  classItems: ClassItemView[];
  raceItem: RaceItemView | null;
  physicalItems: PhysicalItemView[];
  proficiencyItems: { weapon: WeaponProfView[]; nonweapon: NwpView[] };
  spellItems: SpellItemView[];
  featureItems: FeatureItemView[];
  /** CONFIG.ADND2E — label maps only */
  config: Adnd2eConfigView;
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}
```

Replace with (adds `optionalRules`):

```ts
export interface CharacterSheetInput {
  name: string;
  img: string;
  /** document._source.system — authored values, for <input> binding */
  source: Record<string, unknown>;
  /** the prepared system.* — derived/cached values */
  derived: CharacterDerivedView;
  classItems: ClassItemView[];
  raceItem: RaceItemView | null;
  physicalItems: PhysicalItemView[];
  proficiencyItems: { weapon: WeaponProfView[]; nonweapon: NwpView[] };
  spellItems: SpellItemView[];
  featureItems: FeatureItemView[];
  /** CONFIG.ADND2E — label maps only */
  config: Adnd2eConfigView;
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
  /** the 8-key core optional-rules bag (game.settings, read once by sheet.ts) —
   *  only `maxSpellsPerLevel` is consumed so far (Learn Spell's per-level cap) */
  optionalRules: OptionalRules;
}
```

Find:

```ts
export interface SpellItemView {
  id: string; name: string; img: string; casterClass: string; level: number;
  schools: string[]; spheres: string[]; range: string; castingTime: string; savingThrow: string;
  inSpellbook: boolean;
  /** filled by buildSpells (context.ts) — sheet.ts's toSpellView sets placeholders,
   *  same pattern as NwpView's governingAbilityLabel/checkTarget. */
  memorized: boolean;
  expended: boolean;
  canMemorize: boolean;
  canCast: boolean;
}
```

Replace with (adds `canLearn`):

```ts
export interface SpellItemView {
  id: string; name: string; img: string; casterClass: string; level: number;
  schools: string[]; spheres: string[]; range: string; castingTime: string; savingThrow: string;
  inSpellbook: boolean;
  /** filled by buildSpells (context.ts) — sheet.ts's toSpellView sets placeholders,
   *  same pattern as NwpView's governingAbilityLabel/checkTarget. */
  memorized: boolean;
  expended: boolean;
  canMemorize: boolean;
  canCast: boolean;
  /** wizard-only: true when this spell is NOT yet in the spellbook and
   *  core/magic/spellbook.ts's canLearnSpell allows attempting to learn it */
  canLearn: boolean;
}
```

- [ ] **Step 2: Run typecheck to confirm the type changes compile in isolation**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: FAIL — `context.ts`'s `buildSpellRow` doesn't return `canLearn`, and `sheet.ts`'s `toSpellView`/`#buildInput` don't yet satisfy the two widened interfaces, and `context.test.ts`'s fixtures are missing `optionalRules`. All expected; fixed in the next steps.

- [ ] **Step 3: Extend `context.ts`'s spell-building logic**

In `src/sheets/character/context.ts`, find the top import block:

```ts
import type { ClassId, DexterityModifiers, SphereName } from "../../core/types";
import type {
  AbilityRow,
  CharacterDerivedView,
  CharacterSheetContext,
  CharacterSheetInput,
  ClassRow,
  EncumbranceGauge,
  FeatureItemView,
  NwpView,
  OrphanedSpellRow,
  PhysicalItemView,
  SaveRow,
  SlotRow,
  SpellItemView,
  TabDescriptor,
} from "./context-types";
import { getChassis } from "../../core/classes/chassis";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import { groupInventory } from "./grouping";
```

Replace with (adds `IntelligenceModifiers`/`WizardSchool` to the first type import, adds `canLearnSpell` and `WIZARD_SCHOOLS` imports):

```ts
import type { ClassId, DexterityModifiers, IntelligenceModifiers, SphereName, WizardSchool } from "../../core/types";
import type {
  AbilityRow,
  CharacterDerivedView,
  CharacterSheetContext,
  CharacterSheetInput,
  ClassRow,
  EncumbranceGauge,
  FeatureItemView,
  NwpView,
  OrphanedSpellRow,
  PhysicalItemView,
  SaveRow,
  SlotRow,
  SpellItemView,
  TabDescriptor,
} from "./context-types";
import { getChassis } from "../../core/classes/chassis";
import { canLearnSpell } from "../../core/magic/spellbook";
import { WIZARD_SCHOOLS } from "../../data/item/choices";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import { groupInventory } from "./grouping";
```

Find (this is the current `buildSpells` function):

```ts
function buildSpells(input: CharacterSheetInput): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const school = sc.wizard.specialistSchool;
  const priestChassisId =
    input.classItems.find((c) => getChassis(c.chassisId as ClassId).spellProgressionId === "priest")
      ?.chassisId ?? null;
  const sphereAccessOverride = sc.priest.sphereAccessOverride as SphereName[] | null;

  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const items = input.spellItems
      .filter((s) => s.level === level)
      .map((s) => buildSpellRow(s, sc, priestChassisId, sphereAccessOverride));
    if (items.length > 0) known.push({ level, items });
  }
  return {
    wizardSlots: toSlotRows(sc.wizard.slots),
    priestSlots: toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
    orphaned: buildOrphanedSpells(input, sc),
  };
}
```

Replace with:

```ts
function buildSpells(input: CharacterSheetInput): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const school = sc.wizard.specialistSchool;
  const priestChassisId =
    input.classItems.find((c) => getChassis(c.chassisId as ClassId).spellProgressionId === "priest")
      ?.chassisId ?? null;
  const sphereAccessOverride = sc.priest.sphereAccessOverride as SphereName[] | null;
  const int = input.derived.abilities.int.mods as IntelligenceModifiers;
  const specialistSchool = school as WizardSchool | null;

  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const levelItems = input.spellItems.filter((s) => s.level === level);
    const knownAtThisLevel = levelItems.filter((s) => s.casterClass === "wizard" && s.inSpellbook).length;
    const learnCtx: LearnEligibilityContext = { int, specialistSchool, knownAtThisLevel, optionalRules: input.optionalRules };
    const items = levelItems.map((s) => buildSpellRow(s, sc, priestChassisId, sphereAccessOverride, learnCtx));
    if (items.length > 0) known.push({ level, items });
  }
  return {
    wizardSlots: toSlotRows(sc.wizard.slots),
    priestSlots: toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
    orphaned: buildOrphanedSpells(input, sc),
  };
}

/** The wizard-specific inputs `canLearnForRow` needs, bundled so `buildSpellRow`
 *  doesn't grow an unwieldy positional-parameter list. `knownAtThisLevel` is
 *  computed once per level by `buildSpells` (counting spellbook-member wizard
 *  spells at that level), not per-row, since it's the same for every spell at
 *  a given level. */
interface LearnEligibilityContext {
  int: IntelligenceModifiers;
  specialistSchool: WizardSchool | null;
  knownAtThisLevel: number;
  optionalRules: CharacterSheetInput["optionalRules"];
}
```

Find (this is the current `buildSpellRow` function):

```ts
/** Enriches a raw SpellItemView with memorize/cast eligibility, computed from
 *  the actor's memorized list, its slot state, and (for a priest spell) sphere
 *  access. sheet.ts's toSpellView leaves these four fields as placeholders. */
function buildSpellRow(
  item: SpellItemView,
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;

  const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
  const slotRow = slots[item.level];
  const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    canCast: memorized && !expended,
  };
}
```

Replace with:

```ts
/** Enriches a raw SpellItemView with memorize/cast/learn eligibility, computed
 *  from the actor's memorized list, its slot state, (for a priest spell)
 *  sphere access, and (for a wizard spell not yet in the spellbook) whether
 *  it can be Learn-attempted. sheet.ts's toSpellView leaves these five fields
 *  as placeholders. */
function buildSpellRow(
  item: SpellItemView,
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
  learnCtx: LearnEligibilityContext,
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;

  const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
  const slotRow = slots[item.level];
  const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    canCast: memorized && !expended,
    canLearn: isWizard && !item.inSpellbook && canLearnForRow(item, learnCtx),
  };
}

/** Whether a wizard spell not yet in the spellbook can be Learn-attempted.
 *  Only the FIRST school in the item's `schools` array that is a recognized
 *  `WizardSchool` is consulted — see this plan's Global Constraints for why
 *  (canLearnSpell takes a single WizardSchool, not an array). A spell with no
 *  such school (e.g. tagged only "lesser-divination"/"wild") can never be
 *  Learn-attempted. */
function canLearnForRow(item: SpellItemView, ctx: LearnEligibilityContext): boolean {
  const wizardSchool = item.schools.find((s): s is WizardSchool =>
    (WIZARD_SCHOOLS as readonly string[]).includes(s),
  );
  if (!wizardSchool) return false;
  return canLearnSpell({
    int: ctx.int,
    spellLevel: item.level,
    spellSchool: wizardSchool,
    specialistSchool: ctx.specialistSchool,
    knownAtThisLevel: ctx.knownAtThisLevel,
    options: ctx.optionalRules,
  }).allowed;
}
```

- [ ] **Step 4: Update `sheet.ts`'s `toSpellView` placeholder and `#buildInput`**

In `src/sheets/character/sheet.ts`, find:

```ts
    inSpellbook: spellbookIds.has(it.id),
    // Placeholders — buildSpells (context.ts) recomputes all four from the
    // actor's memorized list + slot state + spellbook/sphere-access eligibility.
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
  };
}
```

Replace with:

```ts
    inSpellbook: spellbookIds.has(it.id),
    // Placeholders — buildSpells (context.ts) recomputes all five from the
    // actor's memorized list + slot state + spellbook/sphere-access/learn eligibility.
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
    canLearn: false,
  };
}
```

Add this import near the top of the file, alongside the other relative imports (e.g. right after the `import { rollAttack, rollSave } from "./combat-rolls";` line):

```ts
import { getOptionalRules } from "../../settings";
```

Find, inside `#buildInput`'s returned object:

```ts
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
    };
  }
```

Replace with:

```ts
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
      optionalRules: getOptionalRules(),
    };
  }
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: still FAIL — only `context.test.ts`'s fixtures remain to be fixed (Step 6).

- [ ] **Step 6: Update `tests/sheets/character/context.test.ts`'s base fixture**

Add this import near the top of the file, alongside the existing `import type {...} from "../../../src/sheets/character/context-types"` block:

```ts
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
```

Find, at the end of the base `input()` helper's returned object literal:

```ts
    perms: { isGM: true, isOwner: true, editable: true },
  };
  return { ...base, ...over };
}
```

Replace with:

```ts
    perms: { isGM: true, isOwner: true, editable: true },
    optionalRules: DEFAULT_OPTIONAL_RULES,
  };
  return { ...base, ...over };
}
```

(`{...base, ...over}` is a shallow merge, so every test that doesn't explicitly override `optionalRules` gets this real default `OptionalRules` bag — matching the same shallow-merge behavior every other base-fixture field already relies on.)

- [ ] **Step 7: Run tests to confirm the existing suite is green again**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -40`
Expected: PASS, no failures.

- [ ] **Step 8: Add new eligibility test cases**

Add this new `describe` block to the end of `tests/sheets/character/context.test.ts` (alongside the other `describe` blocks, not nested inside one):

```ts
describe("buildCharacterSheetContext — spell learn eligibility", () => {
  const wizardSpell = (over: Partial<SpellItemView>): SpellItemView => ({
    id: "mm",
    name: "Magic Missile",
    img: "",
    casterClass: "wizard",
    level: 1,
    schools: ["evocation"],
    spheres: [],
    range: "",
    castingTime: "",
    savingThrow: "none",
    inSpellbook: false,
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
    canLearn: false,
    ...over,
  });
  const fullInt = {
    bonusLanguages: 0, maxSpellLevel: 9, learnSpellChance: 70,
    maxSpellsPerLevel: null, illusionImmunityLevel: null,
  };

  it("wizard spell not in spellbook, INT allows it → canLearn true", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
        },
        spellItems: [wizardSpell({ inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(true);
  });

  it("wizard spell already in spellbook → canLearn false (nothing to learn)", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
        },
        spellItems: [wizardSpell({ inSpellbook: true })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });

  it("wizard spell in the specialist's own opposition school → canLearn false", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 15, mods: fullInt as never } },
          spellcasting: {
            wizard: { specialistSchool: "abjuration", slots: {}, memorized: [] },
            priest: { slots: {}, memorized: [], sphereAccessOverride: null },
          },
        },
        spellItems: [wizardSpell({ schools: ["illusion"], inSpellbook: false })],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });

  it("priest spell → canLearn always false regardless of INT", () => {
    const c = buildCharacterSheetContext(
      input({
        derived: {
          ...input().derived,
          abilities: { ...input().derived.abilities, int: { score: 18, mods: fullInt as never } },
        },
        spellItems: [
          wizardSpell({ casterClass: "priest", schools: [], spheres: ["healing"], inSpellbook: false }),
        ],
      }),
    );
    expect(c.spells.known[0]!.items[0]!.canLearn).toBe(false);
  });
});
```

(`abjuration`'s opposition schools are `["alteration", "illusion"]` per `SPECIALIST_SCHOOLS` in `src/core/magic/tables.ts` — read that file yourself to confirm before trusting this fixture, matching the same "verify against real source" rigor Plan 4a's priest-sphere tests used.)

- [ ] **Step 9: Run the full context test file**

Run: `npx vitest run tests/sheets/character/context.test.ts 2>&1 | tail -60`
Expected: PASS, all tests (existing + the 4 new ones) green.

- [ ] **Step 10: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, 100% coverage maintained on `src/sheets/character/context.ts`.

- [ ] **Step 11: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts \
  src/sheets/character/sheet.ts tests/sheets/character/context.test.ts
git commit -m "$(cat <<'EOF'
feat(sp4b): per-spell learn eligibility in the render-context layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Learn Spell action — sheet wiring

**Files:**
- Modify: `src/sheets/character/spell-actions.ts` — add `learnSpell`, extend `SpellItemHandle`/`GenericItemHandle`/`SpellcasterActor`
- Modify: `src/sheets/character/sheet.ts` — wire the `learnSpell` action
- Modify: `templates/actor/character/spells.hbs` — Learn Spell button on eligible wizard spells
- Modify: `lang/en.json` — `ADND2E.sheet.spells.{learn,learnBlockedWarning}`

**Interfaces:**
- Consumes: `buildLearnSpellCardContext` from Task 1 (`src/magic/learn-spell-card.ts`); `SpellItemView.canLearn` from Task 2 (rendered by `spells.hbs`); `canLearnSpell`/`learnSpellRoll` from `src/core/magic/spellbook.ts` (already exists); the existing `memorizeSpell`/`forgetSpell`/`castSpell`/`restSpellcasting` action pattern in `spell-actions.ts`/`sheet.ts` (Plan 4a, already merged) as the direct style template.
- Produces: `learnSpell(actor, spellItemId): Promise<void>` in `spell-actions.ts`. `learnSpell` renders `templates/chat/learn-spell-roll.hbs`, which Task 4 creates — **this task's `npm run build` will succeed anyway** (confirmed during Plan 4a: this repo's Vite build never statically validates Handlebars template path strings, so a missing runtime-loaded template is not a build-time error — do not expect or investigate a build failure here).

Before writing anything, read the CURRENT real content of `src/sheets/character/spell-actions.ts` in full — it already has `memorizeSpell`/`forgetSpell`/`castSpell`/`restSpellcasting`, `casterKey`, `findPriestChassisId`, and `canReMemorize` from Plan 4a. This task extends that same file.

- [ ] **Step 1: Extend `spell-actions.ts`'s imports and type interfaces**

Find the top of `src/sheets/character/spell-actions.ts`:

```ts
import { getChassis } from "../../core/classes/chassis";
import type { ClassId, SphereName } from "../../core/types";
import { buildCastCardContext } from "../../magic/cast-card";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import { TEMPLATE_PATH } from "../../constants";
```

Replace with:

```ts
import { getChassis } from "../../core/classes/chassis";
import { canLearnSpell, learnSpellRoll } from "../../core/magic/spellbook";
import type { ClassId, IntelligenceModifiers, SphereName, WizardSchool } from "../../core/types";
import { WIZARD_SCHOOLS } from "../../data/item/choices";
import { buildCastCardContext } from "../../magic/cast-card";
import { buildLearnSpellCardContext } from "../../magic/learn-spell-card";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import { TEMPLATE_PATH } from "../../constants";
import { getOptionalRules } from "../../settings";
```

Find:

```ts
interface SpellItemHandle {
  id: string;
  name: string;
  system: {
    casterClass: string;
    level: number;
    spheres: string[];
    range: string;
    duration: string;
    castingTime: string;
    savingThrow: string;
    components: { v: boolean; s: boolean; m: boolean };
    automation: { damage: string | null; healing: string | null };
  };
}
```

Replace with (adds `schools: string[];`):

```ts
interface SpellItemHandle {
  id: string;
  name: string;
  system: {
    casterClass: string;
    level: number;
    schools: string[];
    spheres: string[];
    range: string;
    duration: string;
    castingTime: string;
    savingThrow: string;
    components: { v: boolean; s: boolean; m: boolean };
    automation: { damage: string | null; healing: string | null };
  };
}
```

Find:

```ts
/** Minimal shape spell-actions needs from a non-spell embedded item — just
 *  enough to find the priest-progression class item (see
 *  `findPriestChassisId`). */
interface GenericItemHandle {
  type: string;
  system: Record<string, unknown>;
}
```

Replace with:

```ts
/** Minimal shape spell-actions needs from any embedded item — enough to find
 *  the priest-progression class item (see `findPriestChassisId`) and to
 *  count spellbook-member wizard spells at a level (see `learnSpell`'s
 *  `knownAtThisLevel`). */
interface GenericItemHandle {
  id: string;
  type: string;
  system: Record<string, unknown>;
}
```

Find:

```ts
interface SpellcasterActor {
  name: string;
  img: string;
  system: {
    spellcasting: {
      wizard: {
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        spellbookItemIds: string[];
      };
      priest: {
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        sphereAccessOverride: string[] | null;
      };
    };
  };
  items: { get(id: string): SpellItemHandle | undefined } & Iterable<GenericItemHandle>;
  update(data: Record<string, unknown>): Promise<unknown>;
}
```

Replace with (adds `abilities.int.mods` and `wizard.specialistSchool`):

```ts
interface SpellcasterActor {
  name: string;
  img: string;
  system: {
    abilities: { int: { mods: IntelligenceModifiers } };
    spellcasting: {
      wizard: {
        specialistSchool: string | null;
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        spellbookItemIds: string[];
      };
      priest: {
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        sphereAccessOverride: string[] | null;
      };
    };
  };
  items: { get(id: string): SpellItemHandle | undefined } & Iterable<GenericItemHandle>;
  update(data: Record<string, unknown>): Promise<unknown>;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean — these are additive interface fields, nothing in the file's existing `memorizeSpell`/`forgetSpell`/`castSpell`/`restSpellcasting`/`canReMemorize`/`findPriestChassisId` reads them yet, so nothing should break.

- [ ] **Step 3: Append `learnSpell` to `spell-actions.ts`**

Add this new exported function at the END of the file (after the existing `castSpell` function's closing brace — it is currently the last thing in the file):

```ts

/** Attempts to learn a wizard spell not yet in the spellbook: re-derives the
 *  same eligibility context.ts's `buildSpellRow` used to decide whether to
 *  show the Learn Spell button (not a priest spell, not already in the
 *  spellbook, has a recognizable WizardSchool tag among its `schools`,
 *  `canLearnSpell` allows it), then rolls 1d100 against the computed chance.
 *  Always posts a chat card — showing the rejection reason when
 *  `canLearnSpell` disallows it, or the roll and pass/fail outcome
 *  otherwise. On success, adds the item id to `spellbookItemIds`. No
 *  cooldown/retry-limit is tracked (spec §2's Learn Spell decision row). */
export async function learnSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (
    !spell ||
    spell.system.casterClass !== "wizard" ||
    actor.system.spellcasting.wizard.spellbookItemIds.includes(spellItemId)
  ) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.learnBlockedWarning"));
    return;
  }

  const wizardSchool = spell.system.schools.find((s): s is WizardSchool =>
    (WIZARD_SCHOOLS as readonly string[]).includes(s),
  );
  if (!wizardSchool) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.learnBlockedWarning"));
    return;
  }

  const knownAtThisLevel = [...actor.items].filter((i) => {
    if (i.type !== "spell") return false;
    const s = i.system as { casterClass?: string; level?: number };
    return (
      s.casterClass === "wizard" &&
      s.level === spell.system.level &&
      actor.system.spellcasting.wizard.spellbookItemIds.includes(i.id)
    );
  }).length;

  const result = canLearnSpell({
    int: actor.system.abilities.int.mods,
    spellLevel: spell.system.level,
    spellSchool: wizardSchool,
    specialistSchool: actor.system.spellcasting.wizard.specialistSchool as WizardSchool | null,
    knownAtThisLevel,
    options: getOptionalRules(),
  });

  let roll: { d100: number; success: boolean } | null = null;
  if (result.allowed) {
    const d100Roll = await new Roll("1d100").evaluate();
    const d100 = d100Roll.total ?? 0;
    const success = learnSpellRoll(d100, result.chance);
    roll = { d100, success };
    if (success) {
      const updated = [...actor.system.spellcasting.wizard.spellbookItemIds, spellItemId];
      await actor.update({ "system.spellcasting.wizard.spellbookItemIds": updated });
    }
  }

  const context = buildLearnSpellCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell.name,
    spellLevel: spell.system.level,
    result,
    roll,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/learn-spell-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as ChatMessage.CreateData);
}
```

- [ ] **Step 4: Wire the `learnSpell` action into `sheet.ts`**

In `src/sheets/character/sheet.ts`, find:

```ts
import { castSpell, forgetSpell, memorizeSpell, restSpellcasting } from "./spell-actions";
```

Replace with:

```ts
import { castSpell, forgetSpell, learnSpell, memorizeSpell, restSpellcasting } from "./spell-actions";
```

Find the `DEFAULT_OPTIONS.actions` block:

```ts
      memorizeSpell: Adnd2eCharacterSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eCharacterSheet.#onForgetSpell,
      castSpell: Adnd2eCharacterSheet.#onCastSpell,
      restSpellcasting: Adnd2eCharacterSheet.#onRestSpellcasting,
    },
```

Replace with:

```ts
      memorizeSpell: Adnd2eCharacterSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eCharacterSheet.#onForgetSpell,
      castSpell: Adnd2eCharacterSheet.#onCastSpell,
      restSpellcasting: Adnd2eCharacterSheet.#onRestSpellcasting,
      learnSpell: Adnd2eCharacterSheet.#onLearnSpell,
    },
```

Find the end of the class (the `#onRestSpellcasting` static method, right before the closing `}` of `Adnd2eCharacterSheet`):

```ts
  static async #onRestSpellcasting(this: Adnd2eCharacterSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }
}
```

Replace with:

```ts
  static async #onRestSpellcasting(this: Adnd2eCharacterSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }

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

- [ ] **Step 5: Add the Learn Spell button to `spells.hbs`**

In `templates/actor/character/spells.hbs`, find:

```hbs
            {{#if s.canMemorize}}
              <button type="button" data-action="memorizeSpell" data-item-id="{{s.id}}">
                {{localize 'ADND2E.sheet.spells.memorize'}}
              </button>
            {{/if}}
```

Replace with (adds the Learn Spell button right before Memorize):

```hbs
            {{#if s.canLearn}}
              <button type="button" data-action="learnSpell" data-item-id="{{s.id}}">
                {{localize 'ADND2E.sheet.spells.learn'}}
              </button>
            {{/if}}
            {{#if s.canMemorize}}
              <button type="button" data-action="memorizeSpell" data-item-id="{{s.id}}">
                {{localize 'ADND2E.sheet.spells.memorize'}}
              </button>
            {{/if}}
```

- [ ] **Step 6: Add the new `lang/en.json` keys this step references**

In `lang/en.json`, find the `"spells"` block under `"sheet"`:

```json
        "expended": "Cast today — expended until Rest",
        "orphaned": "Orphaned Memorized Spells",
        "orphanedEntry": "Level {level} spell (item no longer exists)",
        "memorizeBlockedWarning": "That spell can no longer be memorized — refresh the sheet.",
        "castBlockedWarning": "That spell can't be cast right now — refresh the sheet.",
        "castRollFailedWarning": "This spell's damage/healing formula couldn't be rolled — check the item's Automation fields."
      },
```

Replace with:

```json
        "expended": "Cast today — expended until Rest",
        "orphaned": "Orphaned Memorized Spells",
        "orphanedEntry": "Level {level} spell (item no longer exists)",
        "memorizeBlockedWarning": "That spell can no longer be memorized — refresh the sheet.",
        "castBlockedWarning": "That spell can't be cast right now — refresh the sheet.",
        "castRollFailedWarning": "This spell's damage/healing formula couldn't be rolled — check the item's Automation fields.",
        "learn": "Learn Spell",
        "learnBlockedWarning": "That spell can no longer be learned — refresh the sheet."
      },
```

- [ ] **Step 7: Run typecheck and lint**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, same count as Task 2's end state (no new tests — this task has no pure-zone changes).

- [ ] **Step 9: Build (should succeed — see this task's own note above about why)**

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build. If Foundry is open on this machine, this fails with an EPERM on `dist/packs` — that is an environment issue (ask for Foundry to be closed), not a defect in this step's code; re-attempt once Foundry is confirmed closed rather than debugging the code.

- [ ] **Step 10: Commit**

```bash
git add src/sheets/character/spell-actions.ts src/sheets/character/sheet.ts \
  templates/actor/character/spells.hbs lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp4b): Learn Spell action on the character sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Learn Spell chat card

**Files:**
- Create: `templates/chat/learn-spell-roll.hbs`
- Modify: `lang/en.json` — `ADND2E.chat.learnSpell.*` keys
- Modify: `tests/lang/en-coverage.test.ts` — drift block for the new keys

**Interfaces:**
- Consumes: `LearnSpellCardContext` shape from Task 1 (`allowed`/`chance`/`reasonLabel`/`roll.{d100,success}`) — this task's template renders exactly those fields.
- Produces: nothing new for later tasks — this is the last implementation task before the dev-world check.

Before writing anything, read `templates/chat/cast-roll.hbs` (already exists from Plan 4a) — it is the direct style template for this task's chat card (same header/img/name layout, same "no helper beyond `{{#if}}`/`{{localize}}`" discipline).

- [ ] **Step 1: Write `templates/chat/learn-spell-roll.hbs`**

```hbs
<div class="adnd2e chat-card learn-spell-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{spellName}} ({{localize 'ADND2E.sheet.spells.level' level=spellLevel}})</h3>
  </header>
  {{#if allowed}}
    <p class="chance">{{localize 'ADND2E.chat.learnSpell.chance'}}: {{chance}}%</p>
    <p class="formula">1d100 = <strong>{{roll.d100}}</strong></p>
    {{#if roll.success}}
      <p class="result success">{{localize 'ADND2E.chat.learnSpell.success'}}</p>
    {{else}}
      <p class="result failure">{{localize 'ADND2E.chat.learnSpell.failure'}}</p>
    {{/if}}
  {{else}}
    <p class="result rejected">{{localize reasonLabel}}</p>
  {{/if}}
</div>
```

- [ ] **Step 2: Add the `ADND2E.chat.learnSpell.*` lang keys**

In `lang/en.json`, find the end of the existing `"cast"` block (right after `"healingRoll": "Healing"`, before that block's own closing `}`):

```json
      "cast": {
        "range": "Range",
        "duration": "Duration",
        "castingTime": "Casting Time",
        "savingThrow": "Saving Throw",
        "damageRoll": "Damage",
        "healingRoll": "Healing"
      }
```

Replace with:

```json
      "cast": {
        "range": "Range",
        "duration": "Duration",
        "castingTime": "Casting Time",
        "savingThrow": "Saving Throw",
        "damageRoll": "Damage",
        "healingRoll": "Healing"
      },
      "learnSpell": {
        "chance": "Chance to learn",
        "success": "Learned!",
        "failure": "Not learned",
        "rejection": {
          "intTooLow": "Intelligence too low to learn any wizard spells.",
          "spellLevelExceedsInt": "This spell's level exceeds what your Intelligence allows.",
          "oppositionSchool": "This spell belongs to a school opposed to your specialty — it can never be learned.",
          "perLevelCapReached": "You already know the maximum number of spells allowed at this level."
        }
      }
```

(If `"cast"` is no longer the last block inside its parent object by the time you make this edit — i.e. something else was added after it on this branch — find the real `"cast": { ... }` block instead and add `"learnSpell": { ... }` as a new sibling immediately after it, adjusting commas so the JSON stays valid.)

- [ ] **Step 3: Add the drift-test block**

In `tests/lang/en-coverage.test.ts`, find the end of the existing `describe("lang/en.json — SP4a spell memorize/cast strings", ...)` block (its closing `});`), and add this new block immediately after it:

```ts
describe("lang/en.json — SP4b learn-spell strings", () => {
  it("resolves every ADND2E.sheet.spells.{learn,learnBlockedWarning} + ADND2E.chat.learnSpell.* key the learn-spell layer references", () => {
    for (const key of [
      "ADND2E.sheet.spells.learn",
      "ADND2E.sheet.spells.learnBlockedWarning",
      "ADND2E.chat.learnSpell.chance",
      "ADND2E.chat.learnSpell.success",
      "ADND2E.chat.learnSpell.failure",
      "ADND2E.chat.learnSpell.rejection.intTooLow",
      "ADND2E.chat.learnSpell.rejection.spellLevelExceedsInt",
      "ADND2E.chat.learnSpell.rejection.oppositionSchool",
      "ADND2E.chat.learnSpell.rejection.perLevelCapReached",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 4: Run the lang drift test**

Run: `npx vitest run tests/lang/en-coverage.test.ts 2>&1 | tail -40`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass, coverage unchanged from Task 2's end state on the pure zone (this task touches no pure files).

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (Foundry closed). Confirm `dist/templates/chat/learn-spell-roll.hbs` exists after the build.

- [ ] **Step 6: Commit**

```bash
git add templates/chat/learn-spell-roll.hbs lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp4b): Learn Spell chat card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: GATED dev-world smoke check (Plan 4b)

**Files:** none — this task is verification only, run by the user in a live linked Foundry v14.364 world.

**Interfaces:**
- Consumes: the fully built system from Tasks 1-4.
- Produces: PASS/FAIL confirmation for each step below, required before `finishing-a-development-branch`.

This step is REQUIRED before finishing the branch — never deferred, never skipped, per this repo's standing rule.

- [ ] **Step 1: Build and link, ask the user to test in their world**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world and walk through spec §6's "Plan 4b dev-world checklist":

1. A wizard spell not yet in the spellbook: click Learn Spell, confirm the chat card shows the computed chance and the 1d100 roll result.
2. On a success (retry a few times if the first attempt fails — nothing is consumed on failure): confirm the spell becomes `inSpellbook: true` (its 📖 badge appears) and is now memorizable.
3. A spell whose school matches the character's specialist school: confirm the chance reflects the specialist +15% bonus (compare the chance shown on this spell's card against a non-specialist-school spell's card, on the same character).
4. A spell whose school is the specialist's opposition school: confirm Learn Spell is unavailable (no button) for that spell.
5. On a priest character (Cleric or Druid): confirm no Learn Spell action ever appears anywhere on the Spells tab.

- [ ] **Step 2: Record the result**

If any step fails, diagnose (console errors, direct document inspection as needed — same debugging pattern established in SP3/4a) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 5 steps PASS.

---

After Task 5 passes: use **superpowers:finishing-a-development-branch**. After merge: Plan 4b complete — Sub-project 4 (Magic) is fully complete.
