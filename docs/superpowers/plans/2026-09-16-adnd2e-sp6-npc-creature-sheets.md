# Sub-project 6: NPC / Creature Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `creature` actors a real, single-page stat-block sheet with rollable attacks/saves, and give `npc` actors a streamlined 3-tab sheet — replacing the SP1 raw-field stub (creature) and the full 7-tab PC sheet (npc) respectively.

**Architecture:** Two new, independent verticals following this codebase's established two-layer split. `creature` gets a genuinely new pure context layer (`src/sheets/creature/context.ts`) since `CreatureModel`'s schema is unrelated to `CharacterModel`'s, plus a new Foundry-shell roll-adapter that reuses SP3's existing `core/combat` math unchanged. `npc` gets NO new pure logic at all — it reuses `src/sheets/character/context.ts`'s existing `buildCharacterSheetContext` and existing action functions verbatim, just a leaner 3-tab template set.

**Tech Stack:** TypeScript, Vite, Foundry VTT v14.364 (`ApplicationV2`/`HandlebarsApplicationMixin`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-adnd2e-sp6-npc-creature-sheets-design.md`

**Two corrections to the spec, discovered during plan-authoring by reading the real current source (recorded here per this project's established practice of grounding a plan's task-level signatures against real source rather than carrying forward an unverified assumption):**
1. The spec's §4.2 proposed a new `templates/chat/creature-save-roll.hbs` because it assumed the existing PC save-roll card shows a `rollModifier` column that would need omitting for creatures. Reading the real `templates/chat/save-roll.hbs` shows it never displays a modifier at all (`{{formula}} = {{total}} ({{target}})` + success/failure) — it's already fully generic. **The plan reuses `SaveCardContext`/`buildSaveCardContext`/`save-roll.hbs` completely unchanged for creatures**, passing `rollModifier: 0`. No new save-related file is created.
2. The spec's §4.2 implied a full attack→damage two-step flow (mirroring the PC sheet's "Roll Attack" card with a separate "Roll Damage" button) might be needed for creatures. Reading `chat-listeners.ts`'s real `onRollDamage` shows it resolves the weapon via `actor.items.get(weaponItemId)` — an embedded-Item lookup that has no equivalent for a creature's `attacks[]` array (addressed by index, not by Item id). Since creature damage is already a single fixed formula string per attack (no S/M-vs-L dice split, no target-size dependency, unlike a PC weapon), **the plan rolls attack and (on hit) damage in one click, posting damage via Foundry's own default roll card (`roll.toMessage({flavor})`)** rather than a second custom template/button/`chat-listeners.ts` change. This keeps `chat-listeners.ts` completely untouched.

## Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` directly, never `fvtt-types` (pinned v13-beta, known wrong about several v14 APIs).
- **Two-layer contract:** `src/sheets/creature/context.ts`/`context-types.ts` import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). Every other new file (both sheet classes, the creature roll-adapter, all templates) is typecheck + build gated only, no unit tests, dev-world verified — matching every prior sub-project.
- **The gated-zone config triad needs GENUINELY NEW entries this time** (unlike SP5a/5b, where `src/combat/**` was already covered) — `src/sheets/creature/context.ts` and `src/sheets/creature/context-types.ts` must be added individually to `tsconfig.core.json`'s `include` array, `vitest.config.ts`'s `coverage.include` array, and BOTH arrays in `eslint.config.js` (`ignores` and `files`), following the EXACT one-file-per-line pattern already used for `src/sheets/character/{context.ts,context-types.ts,xp.ts,drop-rules.ts,grouping.ts}` in all three files (confirmed via direct read — those five character-sheet files are listed individually, not as a directory glob). `tests/sheets/creature/**` needs NO new entry in any of the three — confirmed via direct read that `tests/sheets` (tsconfig) and `tests/sheets/**`/`tests/sheets/**/*.ts` (vitest/eslint) are already bare-directory/glob entries covering any new subdirectory under `tests/sheets/`.
- **`Adnd2eNpcSheet` produces NO new pure code.** It calls the EXISTING `src/sheets/character/context.ts`'s `buildCharacterSheetContext` unchanged, and the EXISTING action functions from `src/sheets/character/{combat-rolls,spell-actions,proficiency-actions}.ts` unchanged. Do not fork, duplicate, or modify that pure layer for the NPC sheet.
- **Content policy:** mechanical/UI data only. No PHB/MM rules text, no copyrighted stat blocks, no flavor text. The "Bestiary" pack folder ships EMPTY — no monster data of any kind.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npx vitest run --coverage`. `npm run build` requires **Foundry closed** — re-confirm before EVERY build attempt in the live-test round-trip, not just once (a real, repeated gotcha across SP5a/5b).
- **Dev-world smoke check is GATED** — the user runs it before `finishing-a-development-branch`, never a deferred checklist item. Every sub-project this session that reached a live check found at least one real bug invisible to code review.
- **Actor/document resolution from chat-card data uses `.uuid` + `fromUuidSync`, never `.id` + `game.actors.get()`.**
- **A plan touching a shared interface must grep the WHOLE consuming file(s) for every literal of that shape**, not just the ones the current task is adding (the recurring SP4b/SP5a/SP5b lesson) — relevant here if any existing test fixture constructs an `AttackCardInput`/`SaveCardInput` literal by hand.
- **No `CreatureModel`/`NpcModel` schema changes anywhere in this plan.** Both models already have everything needed.
- **No `deriveCreature`/`deriveCharacter` changes anywhere in this plan.** Both new roll-adapters consume already-derived/cached values only.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Pure creature sheet context

**Files:**
- Create: `src/sheets/creature/context-types.ts`
- Create: `src/sheets/creature/context.ts`
- Create: `tests/sheets/creature/context.test.ts`
- Modify: `tsconfig.core.json`
- Modify: `vitest.config.ts`
- Modify: `eslint.config.js`

**Interfaces:**
- Consumes: nothing new — reads the already-derived `CreatureModel` fields directly (`hd`, `attributes.{hp,ac,thac0,movement}`, `attacks[]`, `saves.{mode,explicit,asClass,effective}`, `details.*`), all already fully specified in `src/data/actor/creature.ts` (Sub-project 1, unchanged by this plan).
- Produces: `CreatureSheetInput`, `CreatureSheetContext`, `buildCreatureSheetContext(input): CreatureSheetContext` — Task 3's `sheet.ts` constructs the input and calls this; Task 3's template renders the output.

Before writing anything, read the CURRENT real content of `src/data/actor/creature.ts` in full (its exact schema — this task's `CreatureSheetInput` must match every field path exactly) and `src/sheets/character/context.ts`'s general shape (as the established pure-context-builder STYLE template — same "one `build...` function per section, thin, no Foundry calls" pattern, not to be confused with reusing its actual code, which this task must not do).

- [ ] **Step 1: Add the gated-zone triad entries**

In `tsconfig.core.json`, find the `"include"` array (a single long line). Add `"src/sheets/creature/context-types.ts"` and `"src/sheets/creature/context.ts"` to it, following the exact style of the existing `"src/sheets/character/context-types.ts"`/`"src/sheets/character/context.ts"` entries already in that same array (comma-separated, no trailing glob).

In `vitest.config.ts`, find the `coverage.include` array. Add two new lines:
```ts
        "src/sheets/creature/context-types.ts", "src/sheets/creature/context.ts",
```
placed as a new line following the same style as the existing `"src/sheets/character/context-types.ts", "src/sheets/character/xp.ts",` line.

In `eslint.config.js`, find BOTH the `ignores` array and the `files` array (two separate array literals in two separate config blocks). Add `"src/sheets/creature/context-types.ts", "src/sheets/creature/context.ts"` to the `ignores` array (matching the existing `src/sheets/character/*.ts` entries' style), and `"src/sheets/creature/context-types.ts", "src/sheets/creature/context.ts"` to the `files` array (same style, no `/*.ts` suffix since these are individual-file entries, not a directory glob — matching how `src/sheets/character/context.ts` is listed there today).

- [ ] **Step 2: Run typecheck to confirm the config change alone doesn't break anything**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean (no new files reference the new config entries yet, so nothing should break).

- [ ] **Step 3: Write the failing tests for `buildCreatureSheetContext`**

Create `tests/sheets/creature/context.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCreatureSheetContext } from "../../../src/sheets/creature/context";
import type { CreatureSheetInput } from "../../../src/sheets/creature/context-types";

function input(over: Partial<CreatureSheetInput> = {}): CreatureSheetInput {
  return {
    name: "Owlbear",
    img: "icons/creature.webp",
    hd: { count: 5, dieType: 8, bonus: 2 },
    attributes: {
      hp: { value: 30, max: 30 },
      ac: { value: 5 },
      thac0: { value: 15 },
      movement: { land: 12, burrow: 0, climb: 0, fly: 0, swim: 0, flyManeuverability: "" },
    },
    attacks: [
      { name: "Claw", count: 2, damage: "1d6+1", thac0Override: null, type: "melee", special: "" },
      { name: "Bite", count: 1, damage: "1d8", thac0Override: null, type: "melee", special: "hug on both claws" },
    ],
    saves: {
      mode: "explicit",
      explicit: { ppd: 13, rsw: 14, pp: 15, bw: 16, spell: 17 },
      effective: { ppd: 13, rsw: 14, pp: 15, bw: 16, spell: 17 },
    },
    details: {
      size: "large", alignment: "true-neutral", intelligence: "animal", morale: 15,
      magicResistance: 0, treasureType: "C", numberAppearing: "1d4", xpValue: 175,
      specialAttacks: "", specialDefenses: "", description: "",
    },
    perms: { isGM: true, isOwner: true, editable: true },
    ...over,
  };
}

describe("buildCreatureSheetContext", () => {
  it("passes identity, HP, AC, THAC0 through", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.identity.name).toBe("Owlbear");
    expect(c.identity.img).toBe("icons/creature.webp");
    expect(c.vitals.hp).toEqual({ value: 30, max: 30 });
    expect(c.vitals.ac).toBe(5);
    expect(c.vitals.thac0).toBe(15);
  });

  it("builds a movement summary omitting zero-value modes", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.vitals.movementSummary).toBe("12");
  });

  it("includes every non-zero movement mode in the summary, land first", () => {
    const c = buildCreatureSheetContext(
      input({
        attributes: {
          ...input().attributes,
          movement: { land: 6, burrow: 0, climb: 3, fly: 18, swim: 0, flyManeuverability: "C" },
        },
      }),
    );
    expect(c.vitals.movementSummary).toBe("6, climb 3, fly 18 (C)");
  });

  it("maps each attacks[] entry to a row with the array index as id", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.attacks).toHaveLength(2);
    expect(c.attacks[0]).toEqual({
      index: 0, name: "Claw", count: 2, damage: "1d6+1", type: "melee", special: "",
    });
    expect(c.attacks[1]!.name).toBe("Bite");
    expect(c.attacks[1]!.special).toBe("hug on both claws");
  });

  it("shows each save category's effective target", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.saves).toEqual([
      { category: "ppd", label: "ADND2E.saves.ppd", target: 13 },
      { category: "rsw", label: "ADND2E.saves.rsw", target: 14 },
      { category: "pp", label: "ADND2E.saves.pp", target: 15 },
      { category: "bw", label: "ADND2E.saves.bw", target: 16 },
      { category: "spell", label: "ADND2E.saves.spell", target: 17 },
    ]);
  });

  it("passes details fields through, including nullable xpValue", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.details.size).toBe("large");
    expect(c.details.alignment).toBe("true-neutral");
    expect(c.details.morale).toBe(15);
    expect(c.details.magicResistance).toBe(0);
    expect(c.details.xpValue).toBe(175);
  });

  it("passes a null xpValue through unchanged (not yet assigned)", () => {
    const c = buildCreatureSheetContext(input({ details: { ...input().details, xpValue: null } }));
    expect(c.details.xpValue).toBeNull();
  });

  it("passes perms through unchanged", () => {
    const c = buildCreatureSheetContext(input({ perms: { isGM: false, isOwner: true, editable: false } }));
    expect(c.perms).toEqual({ isGM: false, isOwner: true, editable: false });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run tests/sheets/creature/context.test.ts 2>&1 | tail -60`
Expected: FAIL — `src/sheets/creature/context.ts`/`context-types.ts` don't exist yet.

- [ ] **Step 5: Write `src/sheets/creature/context-types.ts`**

```ts
import type { ClassGroup, SaveCategory } from "../../core/types";

export interface CreatureAttackEntry {
  name: string;
  count: number;
  damage: string;
  thac0Override: number | null;
  type: "melee" | "ranged";
  special: string;
}

export interface CreatureSheetInput {
  name: string;
  img: string;
  hd: { count: number; dieType: number; bonus: number };
  attributes: {
    hp: { value: number; max: number };
    ac: { value: number };
    thac0: { value: number };
    movement: { land: number; burrow: number; climb: number; fly: number; swim: number; flyManeuverability: string };
  };
  attacks: CreatureAttackEntry[];
  saves: {
    mode: "explicit" | "asClass";
    explicit: Record<SaveCategory, number>;
    /** already-derived by deriveCreature — this is what the sheet always displays,
     *  regardless of `mode` (mode only matters to prepareDerivedData's own computation). */
    effective: Record<SaveCategory, number>;
  };
  details: {
    size: string;
    alignment: string;
    intelligence: string;
    morale: number;
    magicResistance: number;
    treasureType: string;
    numberAppearing: string;
    xpValue: number | null;
    specialAttacks: string;
    specialDefenses: string;
    description: string;
  };
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}

export interface CreatureSheetContext {
  identity: { name: string; img: string; size: string; alignment: string };
  vitals: {
    hp: { value: number; max: number };
    ac: number;
    thac0: number;
    /** e.g. "12, climb 3, fly 18 (C)" — zero-value modes omitted, land always first (unlabeled) */
    movementSummary: string;
  };
  attacks: { index: number; name: string; count: number; damage: string; type: "melee" | "ranged"; special: string }[];
  saves: { category: SaveCategory; label: string; target: number }[];
  details: {
    intelligence: string;
    morale: number;
    magicResistance: number;
    treasureType: string;
    numberAppearing: string;
    xpValue: number | null;
    specialAttacks: string;
    specialDefenses: string;
    description: string;
  };
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}

// re-exported so context.ts doesn't need a second import line for a type it only forwards
export type { ClassGroup };
```

- [ ] **Step 6: Write `src/sheets/creature/context.ts`**

```ts
import type { CreatureSheetContext, CreatureSheetInput } from "./context-types";
import type { SaveCategory } from "../../core/types";

const SAVE_CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];
const MOVEMENT_LABELS: Record<"burrow" | "climb" | "fly" | "swim", string> = {
  burrow: "burrow", climb: "climb", fly: "fly", swim: "swim",
};

/** "12, climb 3, fly 18 (C)" — land is always shown first (unlabeled, even if 0),
 *  every other mode is omitted when it's 0. `flyManeuverability` (a bare class
 *  letter/number like "C") is appended in parens only when fly > 0. */
function buildMovementSummary(m: CreatureSheetInput["attributes"]["movement"]): string {
  const parts = [String(m.land)];
  for (const mode of ["burrow", "climb", "fly", "swim"] as const) {
    const value = m[mode];
    if (value <= 0) continue;
    const suffix = mode === "fly" && m.flyManeuverability ? ` (${m.flyManeuverability})` : "";
    parts.push(`${MOVEMENT_LABELS[mode]} ${value}${suffix}`);
  }
  return parts.join(", ");
}

/** Pure sheet-context builder for the `creature` actor type — mirrors the
 *  established `buildCharacterSheetContext` pattern (thin, section-by-section,
 *  no Foundry calls) but is a wholly separate function, since CreatureModel's
 *  schema shares nothing with CharacterModel's. */
export function buildCreatureSheetContext(input: CreatureSheetInput): CreatureSheetContext {
  return {
    identity: {
      name: input.name,
      img: input.img,
      size: input.details.size,
      alignment: input.details.alignment,
    },
    vitals: {
      hp: { ...input.attributes.hp },
      ac: input.attributes.ac.value,
      thac0: input.attributes.thac0.value,
      movementSummary: buildMovementSummary(input.attributes.movement),
    },
    attacks: input.attacks.map((a, index) => ({
      index, name: a.name, count: a.count, damage: a.damage, type: a.type, special: a.special,
    })),
    saves: SAVE_CATEGORIES.map((category) => ({
      category,
      label: `ADND2E.saves.${category}`,
      target: input.saves.effective[category],
    })),
    details: {
      intelligence: input.details.intelligence,
      morale: input.details.morale,
      magicResistance: input.details.magicResistance,
      treasureType: input.details.treasureType,
      numberAppearing: input.details.numberAppearing,
      xpValue: input.details.xpValue,
      specialAttacks: input.details.specialAttacks,
      specialDefenses: input.details.specialDefenses,
      description: input.details.description,
    },
    perms: { ...input.perms },
  };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/sheets/creature/context.test.ts 2>&1 | tail -60`
Expected: PASS, all 8 cases.

- [ ] **Step 8: Run the full pure-zone gate**

Run: `npm run typecheck 2>&1 | tail -30 && npm run lint 2>&1 | tail -30`
Expected: both clean.

Run: `npx vitest run --coverage 2>&1 | tail -80`
Expected: all tests pass, 100% coverage on both new files.

- [ ] **Step 9: Commit**

```bash
git add tsconfig.core.json vitest.config.ts eslint.config.js \
  src/sheets/creature/context-types.ts src/sheets/creature/context.ts \
  tests/sheets/creature/context.test.ts
git commit -m "$(cat <<'EOF'
feat(sp6): pure creature sheet context builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Creature attack/save roll adapters

**Files:**
- Create: `src/sheets/creature/combat-rolls.ts`

**Interfaces:**
- Consumes: `attackModifiers`/`hitResult` (`core/combat/attack.ts`, unchanged), `attackFormula` (`core/dice/formula.ts`, unchanged), `buildAttackCardContext` (`combat/attack-card.ts`, unchanged), `buildSaveCardContext` (`combat/save-card.ts`, unchanged), `resolveTargetCombatInfo` (imported from the EXISTING `src/sheets/character/combat-rolls.ts`, unchanged — already actor-type-agnostic on the target side).
- Produces: `rollAttack(actor, attackIndex: number): Promise<void>`, `rollSave(actor, category: SaveCategory): Promise<void>` — Task 3's `sheet.ts` wires both as sheet actions.

This is a Foundry-shell file — no unit tests (matches the established no-test convention for `combat-rolls.ts`-style files). Before writing, read `src/sheets/character/combat-rolls.ts` in full (the direct style template — same header-comment convention, same `roll.toMessage`-not-`ChatMessage.create` pattern for a real evaluated Roll) and confirm the real, current export signature of `resolveTargetCombatInfo` (already confirmed: `resolveTargetCombatInfo(targetActor: {type, system, items}): {ac: number, size: string | null}`).

- [ ] **Step 1: Write `src/sheets/creature/combat-rolls.ts`**

```ts
import { resolveTargetCombatInfo } from "../character/combat-rolls";
import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";

/* ---------------------------------------------------------------------------
 * combat-rolls — SP6, creature-shaped.
 *
 * Foundry-coupled Roll Attack / Roll Save glue for the creature sheet — not
 * unit-tested (matches src/sheets/character/combat-rolls.ts's established
 * convention), verified in a linked dev world. Reuses the SAME core/combat
 * math and the SAME chat-card builders/templates the PC sheet already uses —
 * a creature attacker/saver produces the identical AttackCardContext/
 * SaveCardContext shapes, just assembled from CreatureModel's flat fields
 * instead of a weapon Item + class/proficiency lookups.
 * ------------------------------------------------------------------------- */

interface CreatureAttack {
  name: string;
  count: number;
  damage: string;
  thac0Override: number | null;
  type: "melee" | "ranged";
  special: string;
}

interface CreatureActor {
  name: string; img: string; uuid: string;
  system: {
    attributes: { thac0: { value: number } };
    attacks: CreatureAttack[];
    saves: { effective: Record<SaveCategory, number> };
  };
}

/** Roll one attack from `attacks[attackIndex]` against the current token
 *  target(s) (or a manually-entered AC, via DialogV2, when zero or more than
 *  one is targeted — mirrors the PC sheet's rollAttack exactly). On a hit,
 *  ALSO immediately rolls `attack.damage` and posts it as a second message
 *  using Foundry's own default roll card (no custom template) — a creature's
 *  damage is already one fixed formula with no target-size dependency, so
 *  there's no need for the PC sheet's separate "Roll Damage" button/step. */
export async function rollAttack(actor: CreatureActor, attackIndex: number): Promise<void> {
  const attack = actor.system.attacks[attackIndex];
  if (!attack) return;

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    targetAc = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]).ac;
  } else {
    const manualAc = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n!.localize("ADND2E.chat.attack.manualAcTitle") },
      content: `<p>${game.i18n!.localize(
        targets.length === 0 ? "ADND2E.chat.attack.noTargetHint" : "ADND2E.chat.attack.multiTargetHint",
      )}</p><input type="number" name="ac" value="10" step="1" autofocus>`,
      ok: {
        label: game.i18n!.localize("ADND2E.chat.attack.rollAttack"),
        callback: (_e: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
          const input = button.form?.elements.namedItem("ac");
          return input instanceof HTMLInputElement ? input.valueAsNumber : NaN;
        },
      },
    });
    if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return;
    targetAc = manualAc;
  }

  const thac0 = attack.thac0Override ?? actor.system.attributes.thac0.value;
  // A monster's THAC0 already bakes in every modifier PHB combat tables would
  // otherwise apply separately — no strength/proficiency/range term is
  // modeled here, matching how a 2E stat block is authored (spec §7).
  const { total: attackBonus, breakdown } = attackModifiers({});
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const hit = hitResult({ naturalD20, attackBonus, thac0, targetAc });

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: attack.name, targetName,
    formula, naturalD20, hit, backstab: false, modifierBreakdown: breakdown,
    damageContext: null,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage(
    { speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as unknown as Roll.MessageData,
  );

  if (hit.hit) {
    const damageRoll = await new Roll(attack.damage).evaluate();
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.format("ADND2E.chat.creature.damageFlavor", { name: attack.name }),
    } as unknown as Roll.MessageData);
  }
}

/** Roll one of the 5 saving-throw categories against the actor's already-
 *  derived system.saves.effective.<category> — no separate rollModifier
 *  concept exists for a creature (unlike a PC's race/class/level-composed
 *  save), so this always rolls a flat 1d20 and reuses buildSaveCardContext/
 *  save-roll.hbs UNCHANGED with rollModifier fixed at 0. */
export async function rollSave(actor: CreatureActor, category: SaveCategory): Promise<void> {
  const target = actor.system.saves.effective[category];
  const roll = await new Roll("1d20").evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: `ADND2E.saves.${category}`,
    formula: roll.formula, naturalD20, rollModifier: 0, target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content });
}
```

- [ ] **Step 2: Add the new lang key**

In `lang/en.json`, find the `"chat"` block. It already has `attack`/`damage`/`save`/`cast`/`learnSpell`/`nwpCheck`/`thiefSkill` children. Add a new sibling block (read the file first for the exact current structure/commas — do not guess punctuation):

```json
      "creature": {
        "damageFlavor": "{name} damage"
      }
```

- [ ] **Step 3: Add the drift-test block**

In `tests/lang/en-coverage.test.ts`, find the end of the existing SP5b `describe` block (its closing `});`), and add this new block immediately after it:

```ts
describe("lang/en.json — SP6 creature damage-roll flavor", () => {
  it("resolves ADND2E.chat.creature.damageFlavor", () => {
    const resolved = resolve("ADND2E.chat.creature.damageFlavor");
    expect(typeof resolved).toBe("string");
    expect((resolved as string).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run --coverage 2>&1 | tail -60`
Expected: all tests pass — one more than Task 1's end state (the new lang drift test), coverage unchanged on the pure zone.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/creature/combat-rolls.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(sp6): creature attack/save roll adapters, reusing SP3's combat math unchanged

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Creature sheet class, template, registration

**Files:**
- Create: `src/sheets/creature/sheet.ts`
- Create: `templates/actor/creature/sheet.hbs`
- Modify: `src/sheets/index.ts`

**Interfaces:**
- Consumes: `buildCreatureSheetContext` (Task 1), `rollAttack`/`rollSave` (Task 2).
- Produces: `Adnd2eCreatureSheet` — registered as the default sheet for `creature`.

Before writing, read `src/sheets/character/sheet.ts`'s class structure (imports, `DEFAULT_OPTIONS`, `PARTS`, the `_prepareContext`-equivalent method, the static action-handler pattern) as the style template — this creature sheet is much smaller (single page, no `TABS`), but should follow the SAME `HandlebarsApplicationMixin(ActorSheetV2)` pattern, the same private-`#`-method-for-static-actions convention, and the same `data-action`/`data-item-id`-or-similar dataset-attribute wiring style.

- [ ] **Step 1: Write `src/sheets/creature/sheet.ts`**

```ts
import { buildCreatureSheetContext } from "./context";
import type { CreatureSheetInput } from "./context-types";
import { rollAttack, rollSave } from "./combat-rolls";
import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";

const T = (p: string): string => TEMPLATE_PATH("actor/creature", p);

type ApplicationV2Ctor = new (...args: never[]) => {
  document: unknown;
  isEditable: boolean;
  element: HTMLElement;
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;
  _onRender(context: unknown, options: unknown): Promise<void>;
};

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) as unknown as ApplicationV2Ctor;

/** SP6 — the real creature sheet: a single-page stat-block, replacing the
 *  SP1 raw-field stub. No tabs (spec §2 "layout style" decision — matches
 *  2E's own single-block stat-block convention). */
export class Adnd2eCreatureSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "creature"],
    position: { width: 560, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttack: Adnd2eCreatureSheet.#onRollAttack,
      rollSave: Adnd2eCreatureSheet.#onRollSave,
    },
  };

  static PARTS = {
    sheet: { template: T("sheet.hbs"), scrollable: [""] },
  };

  #buildInput(): CreatureSheetInput {
    const actor = this.document as unknown as {
      name: string; img: string; isOwner: boolean;
      system: {
        hd: CreatureSheetInput["hd"];
        attributes: CreatureSheetInput["attributes"];
        attacks: CreatureSheetInput["attacks"];
        saves: CreatureSheetInput["saves"];
        details: CreatureSheetInput["details"];
      };
    };
    return {
      name: actor.name,
      img: actor.img,
      hd: actor.system.hd,
      attributes: actor.system.attributes,
      attacks: actor.system.attacks,
      saves: actor.system.saves,
      details: actor.system.details,
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
    };
  }

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCreatureSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
    // matches src/sheets/character/sheet.ts's own _prepareContext exactly —
    // `context.source` (the actor's `_source`) is already provided by
    // super._prepareContext(options) (DocumentSheetV2's own base behavior);
    // do not set it again here.
    context.systemFields = (this.document as unknown as {
      system: { schema: { fields: Record<string, unknown> } };
    }).system.schema.fields;
    return context;
  }

  static async #onRollAttack(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const index = target.dataset.attackIndex;
    if (index !== undefined) await rollAttack(this.document as never, Number(index));
  }

  static async #onRollSave(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const category = target.dataset.save as SaveCategory | undefined;
    if (category) await rollSave(this.document as never, category);
  }
}

Object.defineProperty(Adnd2eCreatureSheet, "name", { value: "Adnd2eCreatureSheet", configurable: true });
```

(Read the real current `src/sheets/character/sheet.ts`'s `_prepareContext`-equivalent — or whatever the actual v14 ApplicationV2 context-preparation hook is named in this codebase's existing PC sheet — before finalizing this step; the exact override name/signature and the exact `source`/`adnd2e` context-key convention must match what the PC sheet already does, since `_prepareContext` above is written from the general ApplicationV2 pattern, not independently re-verified against `Adnd2eCharacterSheet`'s own real override in this step's authoring. Adjust the cast style in the middle of the method — the `sys.hd as CreatureSheetInput["hd"]`-style casts — to whatever minimal-structural-type convention `sheet.ts`'s own `#buildInput()` already uses, rather than the placeholder casts shown here.)

- [ ] **Step 2: Write `templates/actor/creature/sheet.hbs`**

Read `templates/actor/character/combat.hbs` and `templates/actor/character/main.hbs` first (already-read style templates — panel/section structure, `{{#each}}`/`{{else}}` empty-state convention, `data-action`/dataset-attribute wiring), then write:

```hbs
<div class="adnd2e sheet creature">

  <header class="creature-header">
    <img src="{{adnd2e.identity.img}}" alt="{{adnd2e.identity.name}}">
    <div>
      <h1><input type="text" name="name" value="{{adnd2e.identity.name}}"></h1>
      <p class="subtitle">{{adnd2e.identity.size}} — {{adnd2e.identity.alignment}}</p>
    </div>
  </header>

  <div class="vitals panel">
    <span>{{localize 'ADND2E.sheet.vitals.ac'}}: {{adnd2e.vitals.ac}}</span>
    <span>{{localize 'ADND2E.sheet.vitals.movement'}}: {{adnd2e.vitals.movementSummary}}</span>
    <span>{{localize 'ADND2E.sheet.creature.hd'}}: <input type="number" name="system.hd.count" value="{{source.system.hd.count}}"> d<input type="number" name="system.hd.dieType" value="{{source.system.hd.dieType}}"></span>
    <span>{{localize 'ADND2E.sheet.vitals.hp'}}: <input type="number" name="system.attributes.hp.value" value="{{adnd2e.vitals.hp.value}}"> / {{adnd2e.vitals.hp.max}}</span>
    <span>{{localize 'ADND2E.sheet.vitals.thac0'}}: {{adnd2e.vitals.thac0}}</span>
  </div>

  <div class="attacks panel">
    <h3>{{localize 'ADND2E.sheet.creature.attacks'}}</h3>
    <div class="attack-list">
      {{#each adnd2e.attacks as |a|}}
        <div class="attack-row">
          <span class="name">{{a.name}}{{#if (gt a.count 1)}} ×{{a.count}}{{/if}}</span>
          <span class="damage">{{a.damage}}</span>
          {{#if a.special}}<span class="special">{{a.special}}</span>{{/if}}
          <button type="button" data-action="rollAttack" data-attack-index="{{a.index}}">
            {{localize 'ADND2E.sheet.combat.rollAttack'}}
          </button>
        </div>
      {{else}}
        <p class="placeholder">{{localize 'ADND2E.sheet.creature.noAttacks'}}</p>
      {{/each}}
    </div>
  </div>

  <table class="saves panel">
    <caption>{{localize 'ADND2E.sheet.vitals.saves'}}</caption>
    <tbody>
      {{#each adnd2e.saves as |row|}}
        <tr>
          <th scope="row">{{localize row.label}}</th>
          <td>{{row.target}}</td>
          <td>
            <button type="button" data-action="rollSave" data-save="{{row.category}}">
              {{localize 'ADND2E.sheet.combat.rollSave'}}
            </button>
          </td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="details panel">
    <span>{{localize 'ADND2E.sheet.creature.morale'}}: <input type="number" name="system.details.morale" value="{{adnd2e.details.morale}}"></span>
    <span>{{localize 'ADND2E.sheet.creature.magicResistance'}}: <input type="number" name="system.details.magicResistance" value="{{adnd2e.details.magicResistance}}">%</span>
    <span>{{localize 'ADND2E.sheet.creature.treasureType'}}: <input type="text" name="system.details.treasureType" value="{{adnd2e.details.treasureType}}"></span>
    <span>{{localize 'ADND2E.sheet.creature.numberAppearing'}}: <input type="text" name="system.details.numberAppearing" value="{{adnd2e.details.numberAppearing}}"></span>
    <span>{{localize 'ADND2E.sheet.creature.xpValue'}}: <input type="number" name="system.details.xpValue" value="{{adnd2e.details.xpValue}}"></span>
  </div>

  <div class="text-fields panel">
    <h3>{{localize 'ADND2E.sheet.creature.specialAttacks'}}</h3>
    {{formInput systemFields.details.fields.specialAttacks value=source.system.details.specialAttacks name="system.details.specialAttacks" disabled=notEditable}}
    <h3>{{localize 'ADND2E.sheet.creature.specialDefenses'}}</h3>
    {{formInput systemFields.details.fields.specialDefenses value=source.system.details.specialDefenses name="system.details.specialDefenses" disabled=notEditable}}
    <h3>{{localize 'ADND2E.sheet.creature.description'}}</h3>
    {{formInput systemFields.details.fields.description value=source.system.details.description name="system.details.description" disabled=notEditable}}
  </div>

</div>
```

(`gt` is a Handlebars helper for "greater than" — read `templates/actor/character/*.hbs`/`src/sheets/handlebars.ts` to confirm whether this codebase already registers a `gt` helper or an equivalent; if not, either register one alongside the existing `adnd2ePct`/`adnd2eSigned` helpers in `src/sheets/handlebars.ts`, or move the `count > 1` check into `context.ts`'s `buildCreatureSheetContext` as a precomputed boolean field on each attack row instead — the established "precompute booleans/labels in the pure layer, don't invent template helper logic" convention this codebase has followed since SP3's chat cards. Prefer the precomputed-boolean approach; only add a new Handlebars helper if there's already established precedent for simple comparison helpers in this codebase.)

`systemFields.details.fields.*` mirrors the EXISTING PC `biography.hbs`'s `{{formInput systemFields.details.fields.campaignNotes ...}}` pattern for HTML-field editing — read that file's real current usage (already quoted in this plan's research) to confirm `systemFields` is already populated as a context key by the ApplicationV2 base class machinery (it should be — `DocumentSheetV2` provides `context.systemFields` automatically) rather than something this task's `_prepareContext` needs to add manually.

- [ ] **Step 3: Register `Adnd2eCreatureSheet` in `src/sheets/index.ts`**

Find:

```ts
import { Adnd2eCharacterSheet } from "./character/sheet";
```

Add immediately after it:

```ts
import { Adnd2eCreatureSheet } from "./creature/sheet";
```

Find the existing `DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCharacterSheet, {...})` call block. Add a new registration call immediately after it (before the `Adnd2eActorSheet` fallback registration):

```ts
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCreatureSheet, {
    makeDefault: true,
    types: ["creature"],
    label: "ADND2E.sheet.creatureTitle",
  });
```

Update the file's header comment (currently claims the raw fallback is the default "for every document type" and the inline comment on the character-sheet registration that says "`creature` has no `types` entry here so it keeps the raw sheet (SP6 gives it a real one)") to reflect that `creature` now has its own real sheet — read the current exact comment text first and edit it precisely rather than leaving a now-false claim in place.

- [ ] **Step 4: Add the new lang keys**

In `lang/en.json`, find `"sheet"."title"` (the existing PC/NPC sheet title key). Add a sibling `"creatureTitle": "Creature"` key. Find the `"sheet"` block's existing sub-sections (e.g. `"vitals"`, `"combat"`) and add a new `"creature"` sibling block:

```json
      "creature": {
        "hd": "Hit Dice",
        "attacks": "Attacks",
        "noAttacks": "No attacks defined",
        "morale": "Morale",
        "magicResistance": "Magic Resistance",
        "treasureType": "Treasure Type",
        "numberAppearing": "Number Appearing",
        "xpValue": "XP Value",
        "specialAttacks": "Special Attacks",
        "specialDefenses": "Special Defenses",
        "description": "Description"
      }
```

(Read the real current `lang/en.json` structure first — do not guess exact punctuation/nesting; place this new block at the same nesting depth as the existing `"combat"`/`"skills"` blocks under `"sheet"`.)

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run typecheck 2>&1 | tail -40`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, same count as Task 2's end state (this task has no pure-zone changes).

- [ ] **Step 7: Attempt a build**

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (confirm Foundry is closed first).

- [ ] **Step 8: Commit**

```bash
git add src/sheets/creature/sheet.ts templates/actor/creature/sheet.hbs src/sheets/index.ts lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp6): creature sheet — single-page stat block, registered as the creature default

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: NPC sheet class, templates, registration

**Files:**
- Modify: `src/sheets/character/sheet.ts` — export the existing item-mapper helper functions (mechanical, additive-only)
- Create: `src/sheets/npc/sheet.ts`
- Create: `templates/actor/npc/main.hbs`
- Create: `templates/actor/npc/spells.hbs`
- Create: `templates/actor/npc/details.hbs`
- Modify: `src/sheets/index.ts`

**Interfaces:**
- Consumes: the EXISTING `buildCharacterSheetContext` (`src/sheets/character/context.ts`, unchanged), the EXISTING action functions (`rollAttack`/`rollSave` from `combat-rolls.ts`, `memorizeSpell`/`forgetSpell`/`castSpell`/`restSpellcasting`/`learnSpell` from `spell-actions.ts`, `specializeWeapon`/`rollNonweaponCheck`/`allocateThiefSkillPoint`/`deallocateThiefSkillPoint`/`rollThiefSkill` from `proficiency-actions.ts`), and the newly-exported item-mapper functions from `sheet.ts` (this task's own Step 1).
- Produces: `Adnd2eNpcSheet` — registered as the default sheet for `npc`.

Before writing, read `src/sheets/character/sheet.ts` in full (already read this session's research — reuse those exact facts: the 7 mapper functions at lines 75-257, `rangeToString` at line 120, `#buildInput()` at lines 356-441, `DEFAULT_OPTIONS`/`PARTS`/`TABS` at lines 262-321).

- [ ] **Step 1: Export `sheet.ts`'s existing item-mapper helper functions**

In `src/sheets/character/sheet.ts`, find each of these existing function declarations (currently module-private, no `export` keyword) and add `export` to each — a purely additive, zero-logic-change edit:

```ts
function toClassView(it: RawItem): ClassItemView {
```
```ts
function toRaceView(it: RawItem): RaceItemView {
```
```ts
function toPhysicalView(it: RawItem): PhysicalItemView {
```
```ts
function toWeaponProfView(it: RawItem): WeaponProfView {
```
```ts
function toNwpView(it: RawItem): NwpView {
```
```ts
function toSpellView(it: RawItem, spellbookIds: Set<string>): SpellItemView {
```
```ts
function toFeatureView(it: RawItem): FeatureItemView {
```
```ts
function rangeToString(range: unknown): string | null {
```

Change each to its `export function ...` equivalent (add the `export` keyword; change nothing else about the signature or body — read the real current file first, since exact line numbers/surrounding context may have shifted since this plan was authored, and confirm the `RawItem`/view-type imports these functions depend on are already exported from wherever they're defined, or export them too if not).

- [ ] **Step 2: Run typecheck to confirm the export-only change is behavior-neutral**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean — adding `export` to a function never used outside its own file changes nothing about how TypeScript checks the file itself.

Run: `npx vitest run 2>&1 | tail -40`
Expected: PASS, no change in count — this step touches no pure/gated file.

- [ ] **Step 3: Write `src/sheets/npc/sheet.ts`**

Read `src/sheets/character/sheet.ts`'s full `#buildInput()` method (already quoted in this plan's research — the exact switch statement over `it.type`, the `spellbookIds` computation, the `config`/`perms`/`optionalRules` assembly) and reproduce its exact assembly logic here, but as a plain method on the new class (not private — doesn't need to be, since nothing outside this class calls it either) that calls the NOW-EXPORTED mapper functions from `../character/sheet` instead of redefining them:

```ts
import {
  toClassView, toRaceView, toPhysicalView, toWeaponProfView, toNwpView, toSpellView, toFeatureView,
} from "../character/sheet";
import { buildCharacterSheetContext } from "../character/context";
import type { CharacterSheetInput } from "../character/context-types";
import { rollAttack, rollSave } from "../character/combat-rolls";
import { castSpell, forgetSpell, learnSpell, memorizeSpell, restSpellcasting } from "../character/spell-actions";
import { allocateThiefSkillPoint, deallocateThiefSkillPoint, rollNonweaponCheck, rollThiefSkill, specializeWeapon } from "../character/proficiency-actions";
import { getOptionalRules } from "../../settings";
import { TEMPLATE_PATH } from "../../constants";
import type { ThiefSkill } from "../../core/types";

const T = (p: string): string => TEMPLATE_PATH("actor/npc", p);

type ApplicationV2Ctor = new (...args: never[]) => {
  document: unknown;
  isEditable: boolean;
  element: HTMLElement;
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;
};

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) as unknown as ApplicationV2Ctor;

/** SP6 — a streamlined 3-tab sheet for `npc` actors. Zero new pure logic:
 *  builds the SAME CharacterSheetInput the PC sheet builds (reusing its now-
 *  exported item-mapper functions), calls the SAME buildCharacterSheetContext,
 *  and wires the SAME action functions — only the template set differs. */
export class Adnd2eNpcSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "npc"],
    position: { width: 640, height: 680 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttack: Adnd2eNpcSheet.#onRollAttack,
      rollSave: Adnd2eNpcSheet.#onRollSave,
      memorizeSpell: Adnd2eNpcSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eNpcSheet.#onForgetSpell,
      castSpell: Adnd2eNpcSheet.#onCastSpell,
      restSpellcasting: Adnd2eNpcSheet.#onRestSpellcasting,
      learnSpell: Adnd2eNpcSheet.#onLearnSpell,
      specializeWeapon: Adnd2eNpcSheet.#onSpecializeWeapon,
      rollNonweaponCheck: Adnd2eNpcSheet.#onRollNonweaponCheck,
      allocateThiefSkillPoint: Adnd2eNpcSheet.#onAllocateThiefSkillPoint,
      deallocateThiefSkillPoint: Adnd2eNpcSheet.#onDeallocateThiefSkillPoint,
      rollThiefSkill: Adnd2eNpcSheet.#onRollThiefSkill,
    },
  };

  static PARTS = {
    header: { template: T("header.hbs") },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: T("main.hbs"), scrollable: [""] },
    spells: { template: T("spells.hbs"), scrollable: [""] },
    details: { template: T("details.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "main",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "details", icon: "fa-solid fa-box-open" },
      ],
    },
  };

  #buildInput(): CharacterSheetInput {
    const actor = this.document as unknown as {
      name: string; img: string;
      _source: Record<string, unknown>;
      system: Record<string, unknown>;
      isOwner: boolean;
      items: Iterable<Parameters<typeof toClassView>[0]>;
    };
    const items = [...actor.items];
    const cfg = (CONFIG as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;
    const spellbookIds = new Set(
      (actor.system as { spellcasting?: { wizard?: { spellbookItemIds?: string[] } } }).spellcasting
        ?.wizard?.spellbookItemIds ?? [],
    );

    const classItems: ReturnType<typeof toClassView>[] = [];
    let raceItem: ReturnType<typeof toRaceView> | null = null;
    const physicalItems: ReturnType<typeof toPhysicalView>[] = [];
    const weaponProfs: ReturnType<typeof toWeaponProfView>[] = [];
    const nonweaponProfs: ReturnType<typeof toNwpView>[] = [];
    const spellItems: ReturnType<typeof toSpellView>[] = [];
    const featureItems: ReturnType<typeof toFeatureView>[] = [];

    for (const it of items) {
      switch (it.type) {
        case "class": classItems.push(toClassView(it)); break;
        case "race": raceItem ??= toRaceView(it); break;
        case "weapon": case "armor": case "equipment": physicalItems.push(toPhysicalView(it)); break;
        case "weaponProficiency": weaponProfs.push(toWeaponProfView(it)); break;
        case "nonweaponProficiency": nonweaponProfs.push(toNwpView(it)); break;
        case "spell": spellItems.push(toSpellView(it, spellbookIds)); break;
        case "classFeature": featureItems.push(toFeatureView(it)); break;
        default: break;
      }
    }

    return {
      name: actor.name,
      img: actor.img,
      source: actor._source,
      derived: actor.system as never,
      classItems,
      raceItem,
      physicalItems,
      proficiencyItems: { weapon: weaponProfs, nonweapon: nonweaponProfs },
      thiefSkillAllocations: [
        ...(actor.system as { thiefSkills: { allocations: { skill: ThiefSkill; allocatedPoints: number }[] } })
          .thiefSkills.allocations,
      ],
      spellItems,
      featureItems,
      config: {
        abilities: cfg.abilities, saves: cfg.saves, alignments: cfg.alignments,
        encumbranceCategories: cfg.encumbranceCategories, classGroups: cfg.classGroups,
        schools: cfg.schools, spheres: cfg.spheres,
      },
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
      optionalRules: getOptionalRules(),
    };
  }

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCharacterSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
    // matches src/sheets/character/sheet.ts's own _prepareContext exactly —
    // `context.source` is already provided by super._prepareContext(options);
    // do not set it again here.
    context.systemFields = (this.document as unknown as {
      system: { schema: { fields: Record<string, unknown> } };
    }).system.schema.fields;
    context.alignments = (
      CONFIG as unknown as { ADND2E: { alignments: Record<string, string> } }
    ).ADND2E.alignments;
    return context;
  }

  override async _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: unknown,
  ): Promise<Record<string, unknown>> {
    const ctx = await super._preparePartContext(partId, context, options);
    const tabs = ctx.tabs as Record<string, unknown> | undefined;
    if (tabs && partId in tabs) ctx.tab = tabs[partId];
    return ctx;
  }

  static async #onRollAttack(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await rollAttack(this.document as never, id);
  }
  static async #onRollSave(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const category = target.dataset.save;
    if (category) await rollSave(this.document as never, category as never);
  }
  static async #onMemorizeSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await memorizeSpell(this.document as never, id);
  }
  static async #onForgetSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await forgetSpell(this.document as never, id);
  }
  static async #onCastSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await castSpell(this.document as never, id);
  }
  static async #onRestSpellcasting(this: Adnd2eNpcSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }
  static async #onLearnSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await learnSpell(this.document as never, id);
  }
  static async #onSpecializeWeapon(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await specializeWeapon(this.document as never, id);
  }
  static async #onRollNonweaponCheck(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await rollNonweaponCheck(this.document as never, id);
  }
  static async #onAllocateThiefSkillPoint(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await allocateThiefSkillPoint(this.document as never, skill as never);
  }
  static async #onDeallocateThiefSkillPoint(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await deallocateThiefSkillPoint(this.document as never, skill as never);
  }
  static async #onRollThiefSkill(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await rollThiefSkill(this.document as never, skill as never);
  }
}

Object.defineProperty(Adnd2eNpcSheet, "name", { value: "Adnd2eNpcSheet", configurable: true });
```

(Verify the exact real import paths for `getOptionalRules`, and the real `header.hbs`/`generic/tab-navigation.hbs` template paths the PC sheet's own `PARTS` already reference — reuse those same shared partials unchanged, do not create new ones. Verify `rollAttack`'s and `rollSave`'s real current parameter names/order against `src/sheets/character/combat-rolls.ts` directly, since this task calls the PC-shaped versions, not Task 2's creature-shaped ones.)

- [ ] **Step 4: Write `templates/actor/npc/main.hbs`**

Read `templates/actor/character/main.hbs` and `templates/actor/character/combat.hbs` in full (already quoted in this plan's research) as the direct content source — this tab folds the PC sheet's Main tab (identity/abilities/vitals/saves) and Combat tab (weapons/AC breakdown/armor) together into one, reusing the SAME partials (`{{> adnd2e.ability-row row=row}}`, `{{> adnd2e.save-row row=row}}`, `{{> adnd2e.class-row c=c}}`) and the SAME `adnd2e.combat.*`/`adnd2e.abilities`/`adnd2e.vitals`/`adnd2e.classes` context fields `buildCharacterSheetContext` already produces (confirmed unchanged by this plan). Write the file by combining those two existing templates' panel markup under one `<section>`, dropping nothing — every field/button that exists on the PC sheet's Main+Combat tabs must still be reachable here, just consolidated into fewer clicks. Also fold in a compact proficiency-skills summary panel reusing the EXISTING `adnd2e.skills.weapon`/`adnd2e.skills.nonweapon`/`adnd2e.skills.thief` context fields and their EXISTING roll-action buttons (`rollNonweaponCheck`/`rollThiefSkill`/`specializeWeapon`) — read `templates/actor/character/skills.hbs` for the exact existing markup to reuse, but DROP the `allocateThiefSkillPoint`/`deallocateThiefSkillPoint` `+`/`−` buttons per the spec's explicit "roll-only, no live point-allocation UI" decision for the Overview tab.

- [ ] **Step 5: Write `templates/actor/npc/spells.hbs`**

Read `templates/actor/character/spells.hbs` in full and reproduce it verbatim, unchanged (same `adnd2e.spells.*` context fields, same action buttons, same empty-state handling for a non-caster NPC) — this tab is a direct, unmodified copy since the spec calls for reusing the PC sheet's spells partial "verbatim."

- [ ] **Step 6: Write `templates/actor/npc/details.hbs`**

Read `templates/actor/character/{inventory,features,biography}.hbs` in full and fold their panel markup together under one `<section>` (same `adnd2e.inventory.*`/`adnd2e.features.*`/`adnd2e.biography.*` context fields, same partials/buttons, same drop-item handling via the sheet's existing `_onDropItem` override — confirm `Adnd2eNpcSheet` needs its OWN `_onDropItem` override mirroring the PC sheet's `drop-rules.ts`-backed one, or whether it can be omitted for v1 and revisited later; read `src/sheets/character/sheet.ts`'s real `_onDropItem` override and `src/sheets/character/drop-rules.ts` before deciding — if omitted, item drops silently do nothing beyond Foundry's own default embedded-item-creation behavior, which may be an acceptable v1 gap for a streamlined NPC sheet or may need the same validation the PC sheet has; make an explicit ruling here and record it, don't silently drop validation without a decision).

- [ ] **Step 7: Register `Adnd2eNpcSheet` and drop `npc` from `Adnd2eCharacterSheet`'s types**

In `src/sheets/index.ts`, find:

```ts
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCharacterSheet, {
    makeDefault: true,
    types: ["character", "npc"],
    label: "ADND2E.sheet.title",
  });
```

Replace with:

```ts
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCharacterSheet, {
    makeDefault: true,
    types: ["character"],
    label: "ADND2E.sheet.title",
  });
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eNpcSheet, {
    makeDefault: true,
    types: ["npc"],
    label: "ADND2E.sheet.npcTitle",
  });
```

Add the import:

```ts
import { Adnd2eNpcSheet } from "./npc/sheet";
```

Note: `Adnd2eCharacterSheet` remains registered for `character` only now, but per Foundry's `DocumentSheetConfig` behavior, a sheet registered for one type is still selectable by a user on a DIFFERENT type's document via the sheet-picker UI as long as it's registered at all (not type-restricted at the picker level, only at the "which is the DEFAULT for this type" level) — verify this against the real v14.364 `DocumentSheetConfig` source (`resources/app/client/applications/apps/document-sheet-config.mjs`, already read once this session for a different sub-project) before relying on it; if v14 actually DOES restrict the picker to type-matching sheets only, the spec's "GM can still manually pick the full PC sheet for an npc" claim needs revisiting as a real gap, not silently assumed true.

- [ ] **Step 8: Add the `npcTitle` lang key**

In `lang/en.json`, add `"npcTitle": "NPC"` as a sibling of the existing `"sheet"."title"`/(Task 3's new)`"creatureTitle"` keys.

- [ ] **Step 9: Run the full gate**

Run: `npm run typecheck 2>&1 | tail -40`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean.

Run: `npx vitest run --coverage 2>&1 | tail -80`
Expected: all tests pass, same count as Task 3's end state.

Run: `npm run build 2>&1 | tail -60`
Expected: a clean full build (confirm Foundry is closed).

- [ ] **Step 10: Commit**

```bash
git add src/sheets/character/sheet.ts src/sheets/npc/sheet.ts \
  templates/actor/npc/main.hbs templates/actor/npc/spells.hbs templates/actor/npc/details.hbs \
  src/sheets/index.ts lang/en.json
git commit -m "$(cat <<'EOF'
feat(sp6): streamlined 3-tab NPC sheet, registered as the npc default

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Bestiary pack-folder stub + docs

**Files:**
- Modify: `system.json`
- Create: `docs/bestiary-content.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing further consumed by this plan — a pure content/config addition.

- [ ] **Step 1: Add the empty "Bestiary" pack folder**

In `system.json`, find the `packFolders` array's `folders` sub-array (currently `"Classes & Races"`, `"Proficiencies"`, `"Equipment"`, `"Spells"`). Add a new entry immediately after `"Spells"`:

```json
      { "name": "Bestiary", "sorting": "a", "packs": [] }
```

(Read the real current file first to confirm exact bracket/comma placement — the array is on a few lines, don't guess.)

- [ ] **Step 2: Write `docs/bestiary-content.md`**

```markdown
# Building your own bestiary

This system ships no monster stat blocks — only mechanical tooling. To build
your own creature compendium:

1. Create `creature`-type actors using the new Creature sheet (Sub-project 6).
2. Fill in HD, attacks, saves, and the free-text special-attacks/defenses/
   description fields yourself, from whatever source you're legally entitled
   to use (your own notes, a licensed digital tool's export, etc.).
3. Drag your finished actors into a Compendium pack (right-click the
   Compendium sidebar tab → Create Compendium, choose type "Actor"), or use
   Foundry's own compendium-export tooling on a folder of actors.
4. For bulk import from a JSON file, use the system's generic import API from
   the console or a macro:

   ```js
   const json = await fetch("path/to/your-creatures.json").then(r => r.json());
   await game.system.api.importContent(json, { folderName: "My Bestiary" });
   ```

   See `docs/importing-content.md` for the exact JSON envelope format
   (Sub-project 1c.4b).

The empty "Bestiary" folder in this system's own compendium sidebar is where
a GM's own creature packs are expected to live, mirroring the existing
"Equipment"/"Spells" folders — it ships empty and stays that way.
```

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: clean.

Run: `npm run lint 2>&1 | tail -30`
Expected: clean (a `system.json` edit could in principle trip the `tests/config/system-json.test.ts` drift test — run the full suite next to confirm).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -60`
Expected: PASS. If `tests/config/system-json.test.ts` fails on an assertion about the exact `packFolders`/`folders` array shape (e.g. an exact-length check), read that test file and update its expected structure to include the new "Bestiary" entry — this is expected, not a bug in either the test or this change.

- [ ] **Step 5: Commit**

```bash
git add system.json docs/bestiary-content.md tests/config/system-json.test.ts
git commit -m "$(cat <<'EOF'
feat(sp6): empty Bestiary pack folder + bestiary-content doc

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Only `git add` `tests/config/system-json.test.ts` if Step 4 actually required touching it.)

---

### Task 6: GATED dev-world smoke check (spec §6)

**Files:** none — this task is verification only, run by the user in a live linked Foundry v14.364 world.

**Interfaces:**
- Consumes: the fully built system from Tasks 1-5.
- Produces: PASS/FAIL confirmation for each step below, required before `finishing-a-development-branch`.

This step is REQUIRED before finishing the branch — never deferred, never skipped, per this repo's standing rule.

- [ ] **Step 1: Build and link, ask the user to test**

Confirm Foundry is closed, then run `npm run build && npm run link`. Ask the user to open their dev world and walk through spec §6's 6 steps:

1. Create a `creature` actor, fill in HD/attacks/saves: confirm the single-page sheet renders every field, confirm HP max / THAC0 / saves are correctly derived-and-displayed.
2. Roll an attack from the creature sheet against a targeted PC: confirm hit/miss resolution and the chat card match SP3's existing attack-card behavior; on a hit, confirm the damage roll posts automatically as a second message with the correct formula (`attacks[].damage`), no button click needed.
3. Roll a save from the creature sheet: confirm the target matches `saves.effective.<category>` with no spurious modifier line.
4. Create an `npc` actor with a class item (e.g. a 3rd-level fighter): confirm the 3-tab layout renders, weapon rolling works identically to the PC sheet, the Spells tab shows the correct empty/non-empty state, inventory/features/biography all round-trip.
5. Confirm `Adnd2eCharacterSheet` is still manually selectable for `npc` via Foundry's sheet picker (confirms Task 4 Step 7's registration change didn't remove the option, only the default) — or, if Step 7's research found the picker restricts by type, confirm and report that finding instead.
6. Confirm the `system.json` "Bestiary" pack folder appears (empty) in the Compendium sidebar.

- [ ] **Step 2: Record the result**

If any step fails, diagnose (console errors, direct document inspection as needed — the same debugging pattern established in SP3/4a/4b/5a/5b) and fix before proceeding. Do not proceed to `finishing-a-development-branch` until all 6 steps PASS.

---

After Task 6 passes: use **superpowers:finishing-a-development-branch**. After merge: **Sub-project 6 (NPC / Creature Sheets) is COMPLETE.**
