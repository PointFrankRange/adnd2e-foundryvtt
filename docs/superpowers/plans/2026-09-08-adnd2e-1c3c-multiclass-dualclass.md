# AD&D 2E — Multiclass & Dual-Class Resolution (Plan 1c.3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve multi-class and dual-class characters correctly in `deriveCharacter` — HP, THAC0, saves, proficiency slots, and spell slots — via two new pure `core/` functions and a thin data-layer adapter.

**Architecture:** A new pure `src/core/classes/multiclass.ts` does the classes-domain aggregation (argmin THAC0, argmax proficiency class, HP average/max, dual-class suppressed/surpassed state machine). A new `saveTargetBest` in `src/core/saves/composer.ts` does best-of-save-base per category. `src/data/derive/character/multiclass.ts` maps the `ActorSnapshot` class list into those calls (running the existing single-class `characterHpMax` per class). `deriveCharacter` branches on arrangement mode; everything stays Foundry-free and 100%-covered except the `base-actor.ts` glue.

**Tech Stack:** TypeScript 5 strict, Vitest, the existing `src/core/**` engine (`getChassis`, `thac0`, `weaponProficiencySlots`/`nonweaponProficiencySlots`, `saveBaseTarget`, `constitution`, `wizardSpellSlots`/`priestSpellSlots`), Foundry DataModels (`base-actor.ts`).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §5.6 (derived-data ordering; step 1 is `resolveMulticlass` / `resolveDualClass`), §5.1 (derived list + `system.*` paths), §4.1 (two-layer architecture).

**Predecessors:** 1c.3a (Actor plumbing, PR #11) and 1c.3b (single-class `deriveCharacter` §5.6 steps 2–10, PR #12) are merged. This is the **third of four** 1c.3 slices. 1c.3d = creature derive path + ActiveEffect `adnd2e` subtype + two-pass affects-base/affects-derived split.

## Global Constraints

- **Purity / gated zone:** `src/core/**`, `src/data/derive/**`, and `src/data/item/{subtypes,choices}.ts` (plus their tests) import **nothing** from `foundry` / `fvtt-types` / `game` / `CONFIG` / DOM. `tsc -p tsconfig.core.json --noEmit` (second half of `npm run typecheck`) proves it. Their `include` globs already cover `src/core/**` and `src/data/derive/**` — no `tsconfig.core.json` edit is needed for the new files.
- **Coverage gate:** `npm run test:coverage` enforces **100%** lines / statements / functions / **branches** on `src/core/**` + `src/config.ts` + `src/settings/registry.ts` + `src/data/derive/**` + `src/data/item/{subtypes,choices}.ts` + `src/data/actor/subtypes.ts`. Every new pure function and every new branch must be exercised by a test in this plan.
- **`base-actor.ts` / `src/data/actor/snapshot.ts` are the Foundry layer:** typecheck + build gated, **no unit tests** (`defineSchema()` / `prepareData()` cannot run without a live Foundry — spec §9).
- **`defineSchema()` bodies contain no logic:** hoisted-factory calls, literals, field constructors, and fragment spreads only.
- **Do NOT run** `npm run format`, `prettier`, or `npm install`. If Vitest flakes at import with a `config` error, clear `node_modules/.vite`, `node_modules/.vitest`, `node_modules/.cache` and retry.
- **Full gate** (mirrors `.github/workflows/ci.yml`): `npm run typecheck && npm run lint && npm run test:coverage && npm run build`.
- **Engine is the authority:** if a hand-computed test value in this plan is red for a reason other than "not implemented yet" — i.e. an engine function genuinely returns a different number — correct the assertion, add a one-line comment, and note it in the report. Never bend a function to match a plan number.
- **No copyrighted prose / stat blocks / spell text** — mechanical values only.
- **Commit trailer:** every commit message ends with
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **PR body trailer:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## Scope boundary (recorded — NOT built here)

- **1c.3d:** creature derive path, `ActiveEffect.adnd2e` subtype + `CONFIG.ActiveEffect.dataModels`, the two-pass affects-base / affects-derived split.
- **Caster-in-armor spell failure** and the dual-class **"earn no XP for an adventure where you used a dormant class's abilities"** rule — both are roll-flow / sheet concerns (Sub-project 3). This plan only *exposes* `multiclass.dualClass.dormantChassisId`.
- **Limited-caster (paladin / ranger / bard) spell slots** — 1c.3b's `deriveSpellSlots` returns `{}` for them (Ruling CASTER1); a multiclassed ranger still gets no slots here. Unchanged.
- **Race / class combo legality** (a gnome may not be a Fighter/Mage/Cleric) — the derive layer resolves whatever class items are present; the character creator / sheet (1c.4+) enforces `race.allowedMulticlass`. Nothing is exposed on `system.multiclass`.
- **I4 — proficiency-slot progression off-by-one** (`initial + floor(level / N)` vs `floor((level − 1) / N)`) — a separate open game-rules decision from the 1c.3b review. `src/core/classes/progression.ts` and `tests/data/derive/character/proficiencies.test.ts` are **not** touched by this plan except for the mechanical signature change in Task 4.

## AD&D 2E rules reference (mechanical facts only — PHB pp. 44–45)

- **Multi-class** (demihumans): 2–3 classes advance simultaneously; each class has its own XP and its own level. Combat: use the **best** THAC0 among the classes; saves: use the **best** save in each of the five categories. HP: roll each class's Hit Die, apply the Constitution hp adjustment **per die**, then **divide the total by the number of classes, rounding down**. Non-warrior classes are capped at a **+2** Constitution hp bonus even when multiclassed with a warrior; a warrior class in the mix still gets its full (up to +3 / +4…) bonus on its own dice. Proficiency slots: gained at the **most favourable** class's rate. Each spellcasting class gets its **own full** spell progression at its own level.
- **Dual-class** (humans): advance in class A, stop, then start class B at level 1 with fresh XP. **While B's level ≤ A's level** ("suppressed"): use B's Hit Dice / THAC0 / saves only; **gain no hit points** (HP stays frozen at A's total); A's class abilities are dormant. **Once B's level > A's level** ("surpassed"): both classes' abilities are usable; THAC0 and saves become best-of-both; HP is A's frozen total plus B's Hit Dice for levels **above** A's level.
- **Constitution hp adjustment** (`src/core/abilities/constitution.ts`, PHB Table 3): non-warrior column caps at +2 (scores 16–25); warrior column is +2 @16, +3 @17, +4 @18, +5 @19–20, … `constitution(score, isWarrior)` returns the right column.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/core/types.ts` | add `GroupLevel` (a `{ group, level }` pair — the unit of a best-of lookup) | 1 |
| `src/core/saves/composer.ts` | add `saveTargetBest({ groups, category, … })`; `saveTarget` delegates to it | 1 |
| `tests/core/saves/composer.test.ts` | `saveTargetBest` best-of + single-group-equals-`saveTarget` cases | 1 |
| `src/core/classes/multiclass.ts` | **new** — `ClassArrangement`, `ClassMember`, `ArrangementResolution`, `DualClassResolution`, `resolveMulticlass`, `resolveDualClass` | 2 |
| `tests/core/classes/multiclass.test.ts` | **new** — 100% of the above | 2 |
| `src/data/derive/character/snapshot.ts` | replace `memorized` with `wizardMemorized` + `priestMemorized` | 3 |
| `src/data/derive/character/slots.ts` | `SpellSlotInput` takes both memorized lists; each branch counts from its own | 3 |
| `src/data/actor/snapshot.ts` | build the two memorized lists separately (no longer flattened) | 3 |
| `src/data/derive/character/derive.ts` (single call site) | pass both memorized lists | 3 |
| `tests/data/derive/character/slots.test.ts` | update call shape; add a cross-list-isolation case | 3 |
| `src/data/derive/character/saves.ts` | `SavesInput` takes `groups: GroupLevel[]`; loops via `saveTargetBest` | 4 |
| `src/data/derive/character/proficiencies.ts` | `deriveProficiencySlots` takes a weapon source + a nonweapon source | 4 |
| `tests/data/derive/character/{saves,proficiencies}.test.ts` | update to the new shapes; keep asserted values | 4 |
| `src/data/derive/character/multiclass.ts` | **new** — `classifyArrangement`, `resolveMulticlassArrangement`, `resolveDualClassArrangement` | 5 |
| `tests/data/derive/character/multiclass.test.ts` | **new** — 100% of the above | 5 |
| `src/data/derive/character/derive.ts` | branch on mode; `CharacterDerived` gains `multiclass`, drops `multiclassPending` | 6 |
| `src/data/derive/character/index.ts` | `export * from "./multiclass"` | 6 |
| `src/data/actor/base-actor.ts` (`deriveAndCache`) | write `system.multiclass`; drop the `multiclassPending` write | 6 |
| `tests/data/derive/character/derive.test.ts` | multiclass + dual-class e2e; drop `multiclassPending` asserts | 6 |
| `src/data/item/choices.ts` | `MULTICLASS_MODES` | 7 |
| `tests/data/choices.test.ts` | `MULTICLASS_MODES` drift test | 7 |
| `src/data/actor/base-actor.ts` (`actorCommonSchema`) | `multiclassSchema()` helper; remove the `multiclassPending` field | 7 |
| `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` | §5.6 step 1 + §5.1 derived list | 8 |

---

## Task 1: `saveTargetBest` — best-of-base saving throws

**Files:**
- Modify: `src/core/types.ts` (add `GroupLevel`)
- Modify: `src/core/saves/composer.ts`
- Test: `tests/core/saves/composer.test.ts`

**Interfaces:**
- Consumes: `saveBaseTarget(group, level, category)` and `racialSaveBonus(race, category, con, tags)` (both already in `src/core/saves`), `ClassGroup` / `SaveCategory` / `SaveEffectTag` / `Race` from `src/core/types`.
- Produces:
  - `interface GroupLevel { group: ClassGroup; level: number }` in `src/core/types.ts`
  - `function saveTargetBest(input: SaveTargetBestInput): SaveTargetResult` in `src/core/saves/composer.ts`
  - `SaveTargetBestInput = { groups: readonly GroupLevel[]; category: SaveCategory; race: Race; con: number; wisMagicalDefenseAdj: number; dexDefensiveAdj: number; tags?: readonly SaveEffectTag[]; situationalModifier?: number }`
  - `saveTarget(input: SaveTargetInput)` keeps its exact current signature and return, now implemented by delegating to `saveTargetBest` with a one-element `groups`.

- [ ] **Step 1: Write the failing test** — `tests/core/saves/composer.test.ts`

If the file already exists, append the `describe` block; otherwise create it with this content.

```ts
import { describe, expect, it } from "vitest";
import { saveTarget, saveTargetBest } from "../../../src/core/saves/composer";

describe("saveTargetBest", () => {
  it("takes the lowest (best) base target across the class groups, per category", () => {
    // warrior L5 band = [ppd 11, rsw 13, pp 12, bw 13, spell 14]
    // wizard  L6 band = [ppd 13, rsw  9, pp 11, bw 13, spell 10]
    const rsw = saveTargetBest({
      groups: [{ group: "warrior", level: 5 }, { group: "wizard", level: 6 }],
      category: "rsw", race: "human", con: 12, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(rsw.target).toBe(9); // wizard wins rsw
    const ppd = saveTargetBest({
      groups: [{ group: "warrior", level: 5 }, { group: "wizard", level: 6 }],
      category: "ppd", race: "human", con: 12, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(ppd.target).toBe(11); // warrior wins ppd
  });

  it("still layers the character-level modifiers onto the winning base", () => {
    // dwarf CON 16 -> +4 racial bonus on rsw (Table 9 CON 14-17 band); breath weapon gets the DEX defensive adj
    const r = saveTargetBest({
      groups: [{ group: "warrior", level: 3 }],
      category: "rsw", race: "dwarf", con: 16, wisMagicalDefenseAdj: 0, dexDefensiveAdj: -2,
    });
    expect(r.rollModifier).toBe(3);
    expect(r.effectiveTarget).toBe(r.target - 3);
    const bw = saveTargetBest({
      groups: [{ group: "warrior", level: 3 }],
      category: "bw", race: "human", con: 12, wisMagicalDefenseAdj: 0, dexDefensiveAdj: -2,
    });
    expect(bw.rollModifier).toBe(2); // -(-2)
  });

  it("saveTarget delegates to saveTargetBest with one group (identical result)", () => {
    const viaTarget = saveTarget({
      group: "priest", level: 9, category: "spell", race: "gnome", con: 15,
      wisMagicalDefenseAdj: 1, dexDefensiveAdj: 0, tags: ["mind-affecting"],
    });
    const viaBest = saveTargetBest({
      groups: [{ group: "priest", level: 9 }], category: "spell", race: "gnome", con: 15,
      wisMagicalDefenseAdj: 1, dexDefensiveAdj: 0, tags: ["mind-affecting"],
    });
    expect(viaTarget).toEqual(viaBest);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `npx vitest run tests/core/saves/composer.test.ts`
Expected: FAIL — `saveTargetBest` is not exported.

- [ ] **Step 3: Add `GroupLevel` to `src/core/types.ts`**

Find the `ClassGroup` type declaration and add directly below it:

```ts
/** A class group paired with a level — the unit of a best-of THAC0 / save lookup. */
export interface GroupLevel {
  group: ClassGroup;
  level: number;
}
```

- [ ] **Step 4: Rewrite `src/core/saves/composer.ts`**

Replace the whole file with:

```ts
// Layers the racial / ability / situational modifiers onto the raw class-group
// saving-throw target from Plan 1b.2. `saveTargetBest` takes the lowest base
// among several class groups (multi-class / dual-class best-of, PHB p.44); every
// modifier below is character-level, not class-level, so it is layered once on
// the winning base. See references/research-notes.md §"PLAN 1b.3".
import type { ClassGroup, GroupLevel, Race, SaveCategory, SaveEffectTag } from "../types";
import { saveBaseTarget } from "./index";
import { racialSaveBonus } from "./racial";

export interface SaveTargetInput {
  group: ClassGroup;
  level: number;
  category: SaveCategory;
  race: Race;
  /** adjusted CON score (post racial adjustment) — for the Table 9 lookup */
  con: number;
  /** wisdom(wis).magicalDefenseAdj — already a roll bonus */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-style (negative = agile); negated here for the save */
  dexDefensiveAdj: number;
  tags?: readonly SaveEffectTag[];
  situationalModifier?: number;
}

export interface SaveTargetBestInput {
  /** one entry for a single class; several for multi-class / dual-class best-of */
  groups: readonly GroupLevel[];
  category: SaveCategory;
  race: Race;
  con: number;
  wisMagicalDefenseAdj: number;
  dexDefensiveAdj: number;
  tags?: readonly SaveEffectTag[];
  situationalModifier?: number;
}

export interface SaveTargetResult {
  /** raw d20 target from the class table (best across the groups) */
  target: number;
  /** total bonus added to the d20 roll */
  rollModifier: number;
  /** target - rollModifier: what the die alone must show */
  effectiveTarget: number;
  breakdown: {
    base: number;
    racialConBonus: number;
    wisdomMagicalDefense: number;
    dexterityDefensive: number;
    situational: number;
  };
}

/**
 * The saving-throw target and its modifier breakdown, taking the best (lowest)
 * base target across `input.groups`. A save succeeds when
 * `d20Roll + result.rollModifier >= result.target`.
 */
export function saveTargetBest(input: SaveTargetBestInput): SaveTargetResult {
  const tags = input.tags ?? [];
  const base = Math.min(
    ...input.groups.map((g) => saveBaseTarget(g.group, g.level, input.category)),
  );
  const racialConBonus = racialSaveBonus(input.race, input.category, input.con, tags);
  const wisdomMagicalDefense = tags.includes("mind-affecting") ? input.wisMagicalDefenseAdj : 0;
  const dexterityDefensive =
    tags.includes("dodgeable") || input.category === "bw" ? -input.dexDefensiveAdj : 0;
  const situational = input.situationalModifier ?? 0;

  const rollModifier = racialConBonus + wisdomMagicalDefense + dexterityDefensive + situational;
  return {
    target: base,
    rollModifier,
    effectiveTarget: base - rollModifier,
    breakdown: { base, racialConBonus, wisdomMagicalDefense, dexterityDefensive, situational },
  };
}

/**
 * Single-class saving-throw target. A succeeds when
 * `d20Roll + result.rollModifier >= result.target`.
 */
export function saveTarget(input: SaveTargetInput): SaveTargetResult {
  return saveTargetBest({
    groups: [{ group: input.group, level: input.level }],
    category: input.category,
    race: input.race,
    con: input.con,
    wisMagicalDefenseAdj: input.wisMagicalDefenseAdj,
    dexDefensiveAdj: input.dexDefensiveAdj,
    tags: input.tags,
    situationalModifier: input.situationalModifier,
  });
}
```

- [ ] **Step 5: Run the new test + the existing saves suite — expect PASS**

Run: `npx vitest run tests/core/saves/`
Expected: PASS — `saveTargetBest` cases green, and every existing `saveTarget` / `composer` / `saves` test unchanged and green (the delegation preserves behaviour exactly).

- [ ] **Step 6: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green; `src/core/saves/composer.ts` still 100% (both `saveTargetBest` branches — `dodgeable`/`bw` true and false, `mind-affecting` true and false — are hit by the new + existing tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/saves/composer.ts tests/core/saves/composer.test.ts
git commit -m "feat(core): saveTargetBest — best-of-base saving throws across class groups

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `core/classes/multiclass.ts` — the resolution primitives

**Files:**
- Create: `src/core/classes/multiclass.ts`
- Test: `tests/core/classes/multiclass.test.ts`

**Interfaces:**
- Consumes: `getChassis(id)` (`src/core/classes/chassis.ts`), `thac0(group, level)` (`src/core/classes/thac0.ts`), `weaponProficiencySlots(chassis, level)` / `nonweaponProficiencySlots(chassis, level)` (`src/core/classes/progression.ts`), `ClassGroup` / `ClassId` / `WizardSchool` / `GroupLevel` (`src/core/types.ts`).
- Produces:
  - `type ClassArrangement = "single" | "multiclass" | "dualclass"`
  - `interface ClassMember { chassisId: ClassId; level: number; specialistSchool: WizardSchool | null }`
  - `interface ArrangementResolution { bestThac0: GroupLevel; saveGroups: GroupLevel[]; weaponProfSource: { chassisId: ClassId; level: number }; nonweaponProfSource: { chassisId: ClassId; level: number }; casters: ClassMember[]; hpMax: number }`
  - `interface DualClassResolution extends ArrangementResolution { surpassed: boolean; dormantChassisId: ClassId; activeChassisId: ClassId }`
  - `function resolveMulticlass(members: readonly ClassMember[], input: { perClassHp: readonly number[]; averageHp: boolean }): ArrangementResolution`
  - `function resolveDualClass(input: { primary: ClassMember; active: ClassMember; primaryFrozenHp: number; activeHpAbovePrimary: number }): DualClassResolution`

**Rules embodied (PHB p.44–45):**
- `bestThac0` = the `{group, level}` that minimises `thac0(group, level)`. When two tie, the earlier member wins.
- `weaponProfSource` / `nonweaponProfSource` = the member that maximises `weaponProficiencySlots` / `nonweaponProficiencySlots` respectively (they can be different classes). Ties → earlier member.
- `casters` = members whose chassis has `casterType !== null` (the data-layer `deriveSpellSlots` filters further to full-progression casters; limited casters produce `{}`).
- `hpMax` (multiclass): `averageHp` → `floor(Σ perClassHp / members.length)`; else `max(perClassHp)`. `perClassHp[i]` is `characterHpMax(...)` for `members[i]`, already computed by the caller (Task 5) so this module never touches HP dice or CON.
- `resolveDualClass`: `surpassed = active.level > primary.level`.
  - suppressed → THAC0 / saves / prof from the **active** class only; `hpMax = primaryFrozenHp`.
  - surpassed → best-of both for THAC0 / saves / prof; `hpMax = primaryFrozenHp + activeHpAbovePrimary`.
  - `casters` follows the same set (active only while suppressed; both once surpassed).

- [ ] **Step 1: Write the failing test** — `tests/core/classes/multiclass.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { resolveDualClass, resolveMulticlass, type ClassMember } from "../../../src/core/classes/multiclass";

const fighter = (level: number): ClassMember => ({ chassisId: "fighter", level, specialistSchool: null });
const mage = (level: number): ClassMember => ({ chassisId: "mage", level, specialistSchool: null });
const cleric = (level: number): ClassMember => ({ chassisId: "cleric", level, specialistSchool: null });

describe("resolveMulticlass", () => {
  it("elf Fighter 5 / Mage 6: best THAC0 is the fighter table, saves list both", () => {
    const r = resolveMulticlass([fighter(5), mage(6)], { perClassHp: [49, 26], averageHp: true });
    // thac0("warrior",5)=16  vs  thac0("wizard",6)=19  -> fighter wins
    expect(r.bestThac0).toEqual({ group: "warrior", level: 5 });
    expect(r.saveGroups).toEqual([
      { group: "warrior", level: 5 },
      { group: "wizard", level: 6 },
    ]);
    // weapon: fighter 4+floor(5/3)=5  vs  mage 1+floor(6/6)=2  -> fighter
    expect(r.weaponProfSource).toEqual({ chassisId: "fighter", level: 5 });
    // nonweapon: fighter 3+floor(5/3)=4  vs  mage 4+floor(6/3)=6  -> mage
    expect(r.nonweaponProfSource).toEqual({ chassisId: "mage", level: 6 });
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
    expect(r.hpMax).toBe(37); // floor((49+26)/2)
  });

  it("averageHp false -> the single highest class HP total", () => {
    const r = resolveMulticlass([fighter(5), mage(6)], { perClassHp: [49, 26], averageHp: false });
    expect(r.hpMax).toBe(49);
  });

  it("Fighter/Mage/Cleric: two casters, first-wins tie-break on nonweapon", () => {
    const r = resolveMulticlass([fighter(4), mage(4), cleric(4)], { perClassHp: [38, 17, 33], averageHp: true });
    expect(r.bestThac0).toEqual({ group: "warrior", level: 4 }); // 17 < 19 (wiz) , 18 (priest)
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage", "cleric"]);
    expect(r.hpMax).toBe(29); // floor(88/3)
    // nonweapon: fighter 4, mage 5, cleric 5 -> mage (earlier of the tie)
    expect(r.nonweaponProfSource.chassisId).toBe("mage");
    // weapon: fighter 5, mage 1, cleric 3 -> fighter
    expect(r.weaponProfSource.chassisId).toBe("fighter");
  });

  it("best THAC0 / prof can be a later member (loop covers the 'not index 0' branch)", () => {
    const r = resolveMulticlass([mage(6), fighter(5)], { perClassHp: [26, 49], averageHp: true });
    expect(r.bestThac0).toEqual({ group: "warrior", level: 5 });
    expect(r.weaponProfSource.chassisId).toBe("fighter");
  });
});

describe("resolveDualClass", () => {
  it("suppressed (active <= primary): active class only, HP frozen", () => {
    const r = resolveDualClass({
      primary: fighter(6),
      active: mage(3),
      primaryFrozenHp: 64,
      activeHpAbovePrimary: 0,
    });
    expect(r.surpassed).toBe(false);
    expect(r.dormantChassisId).toBe("fighter");
    expect(r.activeChassisId).toBe("mage");
    expect(r.bestThac0).toEqual({ group: "wizard", level: 3 });
    expect(r.saveGroups).toEqual([{ group: "wizard", level: 3 }]);
    expect(r.weaponProfSource).toEqual({ chassisId: "mage", level: 3 });
    expect(r.nonweaponProfSource).toEqual({ chassisId: "mage", level: 3 });
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
    expect(r.hpMax).toBe(64);
  });

  it("surpassed (active > primary): best-of both, HP = frozen + active above primary", () => {
    const r = resolveDualClass({
      primary: fighter(6),
      active: mage(7),
      primaryFrozenHp: 64,
      activeHpAbovePrimary: 5,
    });
    expect(r.surpassed).toBe(true);
    // thac0("warrior",6)=15  vs  thac0("wizard",7)=18  -> fighter
    expect(r.bestThac0).toEqual({ group: "warrior", level: 6 });
    expect(r.saveGroups).toEqual([
      { group: "warrior", level: 6 },
      { group: "wizard", level: 7 },
    ]);
    // weapon: fighter 6 vs mage 2 -> fighter ; nonweapon: fighter 5 vs mage 6 -> mage
    expect(r.weaponProfSource).toEqual({ chassisId: "fighter", level: 6 });
    expect(r.nonweaponProfSource).toEqual({ chassisId: "mage", level: 7 });
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
    expect(r.hpMax).toBe(69);
  });

  it("surpassed, non-caster active + caster primary: primary re-enters the caster set", () => {
    const r = resolveDualClass({
      primary: mage(4),
      active: fighter(5),
      primaryFrozenHp: 20,
      activeHpAbovePrimary: 12,
    });
    expect(r.surpassed).toBe(true);
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `npx vitest run tests/core/classes/multiclass.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/core/classes/multiclass.ts`**

```ts
// PHB pp.44-45: multi-class (demihuman, simultaneous) and dual-class (human,
// sequential) advancement. Pure — argmin over the THAC0 table, argmax over the
// proficiency progressions, and the dual-class suppressed/surpassed state
// machine. HP composition is the caller's job (it owns characterHpMax); this
// module only picks and averages the numbers it is handed.
import { getChassis } from "./chassis";
import { nonweaponProficiencySlots, weaponProficiencySlots } from "./progression";
import { thac0 } from "./thac0";
import type { ClassGroup, ClassId, GroupLevel, WizardSchool } from "../types";

export type ClassArrangement = "single" | "multiclass" | "dualclass";

export interface ClassMember {
  chassisId: ClassId;
  level: number;
  specialistSchool: WizardSchool | null;
}

export interface ArrangementResolution {
  /** the class table that yields the lowest (best) THAC0 */
  bestThac0: GroupLevel;
  /** every considered class's (group, level) — the caller runs the per-category best-of */
  saveGroups: GroupLevel[];
  /** the class with the most weapon proficiency slots */
  weaponProfSource: { chassisId: ClassId; level: number };
  /** the class with the most non-weapon proficiency slots */
  nonweaponProfSource: { chassisId: ClassId; level: number };
  /** members whose chassis can cast (deriveSpellSlots filters to full casters) */
  casters: ClassMember[];
  hpMax: number;
}

export interface DualClassResolution extends ArrangementResolution {
  /** the new class's level exceeds the abandoned class's — both are fully usable */
  surpassed: boolean;
  /** the abandoned ("primary") class */
  dormantChassisId: ClassId;
  /** the class currently being advanced */
  activeChassisId: ClassId;
}

function groupOf(id: ClassId): ClassGroup {
  return getChassis(id).group;
}

function toGroupLevel(m: ClassMember): GroupLevel {
  return { group: groupOf(m.chassisId), level: m.level };
}

function bestThac0Of(levels: readonly GroupLevel[]): GroupLevel {
  let best = levels[0];
  for (const gl of levels) {
    if (thac0(gl.group, gl.level) < thac0(best.group, best.level)) best = gl;
  }
  return best;
}

function maxBy(
  members: readonly ClassMember[],
  slots: (id: ClassId, level: number) => number,
): { chassisId: ClassId; level: number } {
  let best = members[0];
  for (const m of members) {
    if (slots(m.chassisId, m.level) > slots(best.chassisId, best.level)) best = m;
  }
  return { chassisId: best.chassisId, level: best.level };
}

const weaponSlotsOf = (id: ClassId, level: number): number =>
  weaponProficiencySlots(getChassis(id), level);
const nonweaponSlotsOf = (id: ClassId, level: number): number =>
  nonweaponProficiencySlots(getChassis(id), level);

function castersOf(members: readonly ClassMember[]): ClassMember[] {
  return members.filter((m) => getChassis(m.chassisId).casterType !== null);
}

export function resolveMulticlass(
  members: readonly ClassMember[],
  input: { perClassHp: readonly number[]; averageHp: boolean },
): ArrangementResolution {
  const saveGroups = members.map(toGroupLevel);
  const total = input.perClassHp.reduce((a, b) => a + b, 0);
  const hpMax = input.averageHp
    ? Math.floor(total / members.length)
    : Math.max(...input.perClassHp);
  return {
    bestThac0: bestThac0Of(saveGroups),
    saveGroups,
    weaponProfSource: maxBy(members, weaponSlotsOf),
    nonweaponProfSource: maxBy(members, nonweaponSlotsOf),
    casters: castersOf(members),
    hpMax,
  };
}

export function resolveDualClass(input: {
  primary: ClassMember;
  active: ClassMember;
  /** primary class's frozen HP total (caller ran characterHpMax at primary.level) */
  primaryFrozenHp: number;
  /** HP the active class contributes for levels ABOVE primary.level (0 while suppressed) */
  activeHpAbovePrimary: number;
}): DualClassResolution {
  const { primary, active } = input;
  const surpassed = active.level > primary.level;
  const considered = surpassed ? [primary, active] : [active];
  const saveGroups = considered.map(toGroupLevel);
  return {
    surpassed,
    dormantChassisId: primary.chassisId,
    activeChassisId: active.chassisId,
    bestThac0: bestThac0Of(saveGroups),
    saveGroups,
    weaponProfSource: maxBy(considered, weaponSlotsOf),
    nonweaponProfSource: maxBy(considered, nonweaponSlotsOf),
    casters: castersOf(considered),
    hpMax: input.primaryFrozenHp + (surpassed ? input.activeHpAbovePrimary : 0),
  };
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run tests/core/classes/multiclass.test.ts`
Expected: PASS. If any hand-computed value disagrees with the engine (e.g. a `thac0` or proficiency-slot number), the engine wins — fix the assertion, comment it, note it in the report.

- [ ] **Step 5: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green; `src/core/classes/multiclass.ts` at 100% — the tests cover `averageHp` true/false, `bestThac0Of` picking index 0 vs a later index, `maxBy` picking index 0 vs later, `surpassed` true/false, and `castersOf` including/excluding a member.

- [ ] **Step 6: Commit**

```bash
git add src/core/classes/multiclass.ts tests/core/classes/multiclass.test.ts
git commit -m "feat(core): resolveMulticlass / resolveDualClass resolution primitives

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: split `memorized` into wizard / priest lists (folds in 1c.3b finding M3)

**Why:** 1c.3b's `snapshotActor` flattened `spellcasting.wizard.memorized` and `spellcasting.priest.memorized` into one list, and `deriveSpellSlots.toRecord` counts "used" slots by `spellLevel` alone. A single-class caster is only ever one of wizard/priest so it was harmless — but a Fighter/Mage/Cleric (Task 6) would have a level-1 priest spell inflate the wizard slot's `used` count and vice-versa. Fix it now, before multi-caster resolution lands.

**Files:**
- Modify: `src/data/derive/character/snapshot.ts` — `ActorSnapshot`
- Modify: `src/data/derive/character/slots.ts` — `SpellSlotInput`, both branches
- Modify: `src/data/actor/snapshot.ts` — build the two lists
- Modify: `src/data/derive/character/derive.ts` — the single-class `deriveSpellSlots` call (line ~99)
- Test: `tests/data/derive/character/slots.test.ts`, `tests/data/derive/character/derive.test.ts` (fixture shape only)

**Interfaces:**
- `ActorSnapshot` loses `memorized: readonly MemorizedEntry[]`, gains `wizardMemorized: readonly MemorizedEntry[]` and `priestMemorized: readonly MemorizedEntry[]`.
- `SpellSlotInput` loses `memorized`, gains `wizardMemorized: readonly MemorizedEntry[]` and `priestMemorized: readonly MemorizedEntry[]`. The wizard branch counts from `wizardMemorized`, the priest branch from `priestMemorized`.

- [ ] **Step 1: Update `tests/data/derive/character/slots.test.ts` first (failing)**

Replace every `memorized: [...]` in a `deriveSpellSlots({...})` call with the two-list shape. Full new file:

```ts
import { describe, expect, it } from "vitest";
import { deriveSpellSlots } from "../../../../src/data/derive/character/slots";

const noMemo = { wizardMemorized: [], priestMemorized: [] };

describe("deriveSpellSlots", () => {
  it("mage L5, maxSpellLevelKnown null (INT cap 1): wizard record capped at level 1", () => {
    const r = deriveSpellSlots({
      chassisId: "mage", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false,
      wizardMemorized: [{ spellItemId: "a", spellLevel: 1 }, { spellItemId: "b", spellLevel: 1 }],
      priestMemorized: [],
    });
    expect(r.wizard![1]).toEqual({ max: 4, used: 2 });
    expect(r.wizard![2].max).toBe(0);
    expect(r.priest).toBeUndefined();
  });

  it("wizard 'used' counts ONLY wizardMemorized — a priest spell of the same level does not leak", () => {
    const r = deriveSpellSlots({
      chassisId: "mage", level: 5, maxSpellLevelKnown: 9, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false,
      wizardMemorized: [{ spellItemId: "w", spellLevel: 1 }],
      priestMemorized: [{ spellItemId: "p", spellLevel: 1 }],
    });
    expect(r.wizard![1].used).toBe(1);
  });

  it("cleric L3, WIS 15: priest record, used from priestMemorized only", () => {
    const r = deriveSpellSlots({
      chassisId: "cleric", level: 3, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false,
      wizardMemorized: [{ spellItemId: "w", spellLevel: 1 }],
      priestMemorized: [{ spellItemId: "p", spellLevel: 1 }],
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.priest![1].used).toBe(1);
    expect(r.wizard).toBeUndefined();
  });

  it("fighter -> neither", () => {
    const r = deriveSpellSlots({
      chassisId: "fighter", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, ...noMemo,
    });
    expect(r).toEqual({});
  });

  it("paladin -> {} (Ruling CASTER1)", () => {
    const r = deriveSpellSlots({
      chassisId: "paladin", level: 9, maxSpellLevelKnown: null, wisdomScore: 14,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false, ...noMemo,
    });
    expect(r).toEqual({});
  });

  it("bard L6 -> {}", () => {
    const r = deriveSpellSlots({
      chassisId: "bard", level: 6, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, ...noMemo,
    });
    expect(r).toEqual({});
  });

  it("druid L5, WIS 15: priest record", () => {
    const r = deriveSpellSlots({
      chassisId: "druid", level: 5, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 1, 0, 0, 0, 0, 0], specialist: false, ...noMemo,
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.wizard).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/data/derive/character/slots.test.ts`) — type error: `wizardMemorized` not on `SpellSlotInput`.

- [ ] **Step 3: Update `src/data/derive/character/slots.ts`**

Change the interface and the two `toRecord` calls:

```ts
export interface SpellSlotInput {
  chassisId: ClassId;
  level: number;
  /** intelligence(int).maxSpellLevel — null for a non-wizard */
  maxSpellLevelKnown: number | null;
  wisdomScore: number;
  /** wisdom(wis).bonusPriestSpells (length 7) */
  wisdomBonusSpells: readonly number[];
  specialist: boolean;
  wizardMemorized: readonly MemorizedEntry[];
  priestMemorized: readonly MemorizedEntry[];
}
```

In `deriveSpellSlots`, the wizard branch: `return { wizard: toRecord(slots.perLevel, input.wizardMemorized) };`
The priest branch: `return { priest: toRecord(slots.perLevel, input.priestMemorized) };`

- [ ] **Step 4: Update `src/data/derive/character/snapshot.ts`**

In `ActorSnapshot`, replace the `memorized` line:

```ts
  /** memorized wizard spells — an entry per filled slot */
  wizardMemorized: readonly MemorizedEntry[];
  /** memorized priest spells — an entry per filled slot */
  priestMemorized: readonly MemorizedEntry[];
```

- [ ] **Step 5: Update `src/data/actor/snapshot.ts`**

Replace the `memorized` block (the `[...wizard.memorized, ...priest.memorized]` flatten) with two direct reads, and update the returned object:

```ts
  const wizardMemorized: MemorizedEntry[] = [...doc.system.spellcasting.wizard.memorized];
  const priestMemorized: MemorizedEntry[] = [...doc.system.spellcasting.priest.memorized];
```

and in the returned object literal replace `memorized,` with `wizardMemorized,` and `priestMemorized,`.

- [ ] **Step 6: Update the single-class call in `src/data/derive/character/derive.ts`**

In the `deriveSpellSlots({ ... })` call, replace `memorized: snapshot.memorized,` with:

```ts
        wizardMemorized: snapshot.wizardMemorized,
        priestMemorized: snapshot.priestMemorized,
```

- [ ] **Step 7: Update `tests/data/derive/character/derive.test.ts` fixtures**

In the `base` fixture and the `fighter7` fixture, replace `memorized: [],` with:

```ts
  wizardMemorized: [],
  priestMemorized: [],
```

(Do **not** touch the assertions in this task — Task 6 rewrites the multiclass-related ones.)

- [ ] **Step 8: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `slots.ts` stays 100% (the new "leak" test plus the existing branch tests cover both `toRecord` call sites and every `deriveSpellSlots` branch).

- [ ] **Step 9: Commit**

```bash
git add src/data/derive/character/snapshot.ts src/data/derive/character/slots.ts src/data/actor/snapshot.ts src/data/derive/character/derive.ts tests/data/derive/character/slots.test.ts tests/data/derive/character/derive.test.ts
git commit -m "refactor(data): split memorized into wizard/priest lists (1c.3b finding M3)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: generalise `deriveSaves` and `deriveProficiencySlots` to N class sources

**Files:**
- Modify: `src/data/derive/character/saves.ts`
- Modify: `src/data/derive/character/proficiencies.ts`
- Test: `tests/data/derive/character/saves.test.ts`, `tests/data/derive/character/proficiencies.test.ts`

**Interfaces:**
- `deriveSaves(input: { groups: readonly GroupLevel[]; race: Race; con: number; wisMagicalDefenseAdj: number; dexDefensiveAdj: number })` — was `{ group, level, race, con, … }`. One entry in `groups` = today's single-class behaviour.
- `deriveProficiencySlots(weaponSource: ProfSource, nonweaponSource: ProfSource, intBonusLanguages: number, spentWeapon: number, spentNonweapon: number)` where `interface ProfSource { chassisId: ClassId; level: number }` — was `(chassisId, level, intBonusLanguages, spentWeapon, spentNonweapon)`. Passing the same `ProfSource` twice = today's single-class behaviour.

- [ ] **Step 1: Update `tests/data/derive/character/saves.test.ts` (failing)**

```ts
import { describe, expect, it } from "vitest";
import { deriveSaves } from "../../../../src/data/derive/character/saves";

describe("deriveSaves", () => {
  it("single group: target/rollModifier/effectiveTarget per category", () => {
    const s = deriveSaves({
      groups: [{ group: "warrior", level: 7 }], race: "human", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(Object.keys(s).sort()).toEqual(["bw", "pp", "ppd", "rsw", "spell"]);
    expect(s.bw.target).toBe(12); // warrior band minLevel 7
    expect(s.bw.effectiveTarget).toBe(s.bw.target - s.bw.rollModifier);
  });

  it("dwarf CON 16 gets the +4 racial bonus vs rod/staff/wand", () => {
    const s = deriveSaves({
      groups: [{ group: "warrior", level: 1 }], race: "dwarf", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(s.rsw.rollModifier).toBeGreaterThan(0);
  });

  it("two groups: each category takes the better (lower) base", () => {
    // warrior L5 band = [ppd 11, rsw 13, pp 12, bw 13, spell 14]
    // wizard  L6 band = [ppd 13, rsw  9, pp 11, bw 13, spell 10]
    const s = deriveSaves({
      groups: [{ group: "warrior", level: 5 }, { group: "wizard", level: 6 }],
      race: "elf", con: 14, wisMagicalDefenseAdj: 0, dexDefensiveAdj: -2,
    });
    expect(s.ppd.target).toBe(11);
    expect(s.rsw.target).toBe(9);
    expect(s.pp.target).toBe(11);
    expect(s.spell.target).toBe(10);
    expect(s.bw.target).toBe(13);
    expect(s.bw.rollModifier).toBe(2); // breath weapon: -(-2)
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/data/derive/character/saves.test.ts`).

- [ ] **Step 3: Rewrite `src/data/derive/character/saves.ts`**

```ts
import { saveTargetBest } from "../../../core/saves/composer";
import type { GroupLevel, Race, SaveCategory } from "../../../core/types";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

export interface SavesInput {
  /** one entry for a single class; several for multi-class / dual-class best-of */
  groups: readonly GroupLevel[];
  race: Race;
  /** adjusted CON score (for the racial Table 9 bonus) */
  con: number;
  /** wisdom(wis).magicalDefenseAdj */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-signed */
  dexDefensiveAdj: number;
}

/**
 * §5.6 step 7 — all five saving throws, taking the best base among `groups` per
 * category. The cached block is the UNTAGGED baseline: `wisMagicalDefenseAdj`
 * only moves `mind-affecting` saves, which need a tag the roll flow adds later.
 */
export function deriveSaves(
  input: SavesInput,
): Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }> {
  const out = {} as Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }>;
  for (const category of CATEGORIES) {
    const r = saveTargetBest({
      groups: input.groups,
      category,
      race: input.race,
      con: input.con,
      wisMagicalDefenseAdj: input.wisMagicalDefenseAdj,
      dexDefensiveAdj: input.dexDefensiveAdj,
    });
    out[category] = { target: r.target, rollModifier: r.rollModifier, effectiveTarget: r.effectiveTarget };
  }
  return out;
}
```

- [ ] **Step 4: Update `tests/data/derive/character/proficiencies.test.ts` (failing)**

```ts
import { describe, expect, it } from "vitest";
import { deriveProficiencySlots } from "../../../../src/data/derive/character/proficiencies";

const src = (chassisId: "fighter" | "mage", level: number) => ({ chassisId, level });

describe("deriveProficiencySlots", () => {
  it("single source used for both: fighter L7 totals from Table 34, minus spent", () => {
    const r = deriveProficiencySlots(src("fighter", 7), src("fighter", 7), 0, 2, 1);
    expect(r.weapon).toEqual({ total: 6, spent: 2, available: 4 });
    expect(r.nonweapon).toEqual({ total: 5, spent: 1, available: 4 });
    expect(r.languagesMax).toBe(0);
  });

  it("different weapon vs nonweapon sources", () => {
    // weapon from fighter L5 (4+floor(5/3)=5), nonweapon from mage L6 (4+floor(6/3)=6)
    const r = deriveProficiencySlots(src("fighter", 5), src("mage", 6), 0, 0, 0);
    expect(r.weapon.total).toBe(5);
    expect(r.nonweapon.total).toBe(6);
  });

  it("INT bonus languages add to languagesMax", () => {
    expect(deriveProficiencySlots(src("mage", 1), src("mage", 1), 4, 0, 0).languagesMax).toBe(4);
  });
});
```

- [ ] **Step 5: Rewrite `src/data/derive/character/proficiencies.ts`**

```ts
import { getChassis } from "../../../core/classes/chassis";
import { nonweaponProficiencySlots, weaponProficiencySlots } from "../../../core/classes/progression";
import type { ClassId } from "../../../core/types";

export type SlotBlock = { total: number; spent: number; available: number };
export interface ProfSource {
  chassisId: ClassId;
  level: number;
}

/** §5.6 step 9 — weapon + non-weapon proficiency slot totals and the language cap. */
export function deriveProficiencySlots(
  weaponSource: ProfSource,
  nonweaponSource: ProfSource,
  intBonusLanguages: number,
  spentWeapon: number,
  spentNonweapon: number,
): { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } {
  const wTotal = weaponProficiencySlots(getChassis(weaponSource.chassisId), weaponSource.level);
  const nTotal = nonweaponProficiencySlots(getChassis(nonweaponSource.chassisId), nonweaponSource.level);
  return {
    weapon: { total: wTotal, spent: spentWeapon, available: wTotal - spentWeapon },
    nonweapon: { total: nTotal, spent: spentNonweapon, available: nTotal - spentNonweapon },
    languagesMax: intBonusLanguages,
  };
}
```

- [ ] **Step 6: Update the single-class call sites in `src/data/derive/character/derive.ts`**

The single-class `deriveSaves` call becomes:

```ts
      ? deriveSaves({
          groups: [{ group: primaryChassis.group, level: classes[0].level }],
          race: snapshot.race ?? "human",
          con: snapshot.abilities.con,
          wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
          dexDefensiveAdj: abilities.dex.defensiveAdj,
        })
```

The single-class `deriveProficiencySlots` call becomes:

```ts
      ? deriveProficiencySlots(
          { chassisId: primary.chassisId, level: classes[0].level },
          { chassisId: primary.chassisId, level: classes[0].level },
          abilities.int.bonusLanguages,
          snapshot.spentWeaponSlots,
          snapshot.spentNonweaponSlots,
        )
```

(These call sites are replaced wholesale in Task 6; do the minimal edit here so the gate stays green.)

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `saves.ts` and `proficiencies.ts` at 100%. The `derive.test.ts` single-class assertions (`d.saves!.bw.target === 12`, `d.proficiencies!.weapon`) still pass — the resolved values are identical for a one-element `groups` / repeated `ProfSource`.

- [ ] **Step 8: Commit**

```bash
git add src/data/derive/character/saves.ts src/data/derive/character/proficiencies.ts src/data/derive/character/derive.ts tests/data/derive/character/saves.test.ts tests/data/derive/character/proficiencies.test.ts
git commit -m "refactor(data): deriveSaves/deriveProficiencySlots take N class sources

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `data/derive/character/multiclass.ts` — the snapshot → resolver adapter

**Files:**
- Create: `src/data/derive/character/multiclass.ts`
- Test: `tests/data/derive/character/multiclass.test.ts`

**Interfaces:**
- Consumes: `constitution(score, isWarrior)` (`src/core/abilities`), `getChassis` (`src/core/classes/chassis`), `resolveMulticlass` / `resolveDualClass` / `ArrangementResolution` / `DualClassResolution` / `ClassMember` / `ClassArrangement` (`src/core/classes/multiclass`, Task 2), `characterHpMax` (`./hp`), `ClassEntry` (`./snapshot`).
- Produces:
  - `function classifyArrangement(classes: readonly ClassEntry[]): ClassArrangement`
  - `function resolveMulticlassArrangement(classes: readonly ClassEntry[], levels: readonly number[], conScore: number, averageHp: boolean): ArrangementResolution`
  - `function resolveDualClassArrangement(classes: readonly ClassEntry[], levels: readonly number[], conScore: number): DualClassResolution`
  - `levels[i]` is `deriveClassLevels(classes)[i].level` — aligned by index with `classes`.

**Rules:**
- `classifyArrangement`: `≤ 1` class → `"single"`; exactly 2 classes with exactly one `dualClassState === "primary"` and exactly one `=== "active"` → `"dualclass"`; anything else with `≥ 2` classes → `"multiclass"` (a malformed dual-class set — stray or missing markers — is treated as multi-class, not an error).
- Per-class CON hp adjustment: warrior-group members use `constitution(conScore, true).hpAdjustment`, everyone else `constitution(conScore, false).hpAdjustment` (PHB p.44 — non-warriors capped at +2 even in a warrior multiclass).
- Dual-class `activeHpAbovePrimary` = `characterHpMax(active, activeLevel, activeRolls, adj) − characterHpMax(active, primaryLevel, activeRolls.slice(0, primaryLevel), adj)`. When `activeLevel ≤ primaryLevel` this is `0` (the slice keeps every active roll and both calls sum the same dice), so the value is correct whether or not the character has surpassed.

- [ ] **Step 1: Write the failing test** — `tests/data/derive/character/multiclass.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  classifyArrangement,
  resolveDualClassArrangement,
  resolveMulticlassArrangement,
} from "../../../../src/data/derive/character/multiclass";
import type { ClassEntry } from "../../../../src/data/derive/character/snapshot";

const entry = (over: Partial<ClassEntry> & Pick<ClassEntry, "chassisId">): ClassEntry => ({
  specialistSchool: null, xp: 0, hpRolls: [], dualClassState: null, level: 1, ...over,
});

describe("classifyArrangement", () => {
  it("0 or 1 class -> single", () => {
    expect(classifyArrangement([])).toBe("single");
    expect(classifyArrangement([entry({ chassisId: "fighter" })])).toBe("single");
  });
  it("2+ plain classes -> multiclass", () => {
    expect(classifyArrangement([entry({ chassisId: "fighter" }), entry({ chassisId: "mage" })])).toBe("multiclass");
    expect(
      classifyArrangement([entry({ chassisId: "fighter" }), entry({ chassisId: "mage" }), entry({ chassisId: "thief" })]),
    ).toBe("multiclass");
  });
  it("exactly one primary + one active -> dualclass", () => {
    expect(
      classifyArrangement([
        entry({ chassisId: "fighter", dualClassState: "primary" }),
        entry({ chassisId: "mage", dualClassState: "active" }),
      ]),
    ).toBe("dualclass");
  });
  it("malformed dual-class markers fall back to multiclass", () => {
    expect(
      classifyArrangement([
        entry({ chassisId: "fighter", dualClassState: "primary" }),
        entry({ chassisId: "mage", dualClassState: null }),
      ]),
    ).toBe("multiclass");
  });
});

describe("resolveMulticlassArrangement", () => {
  it("elf Fighter 5 / Mage 6, CON 15, averaging on", () => {
    const classes = [
      entry({ chassisId: "fighter", hpRolls: [10, 9, 8, 10, 7], level: 5 }),
      entry({ chassisId: "mage", hpRolls: [4, 3, 4, 2, 3, 4], level: 6 }),
    ];
    const r = resolveMulticlassArrangement(classes, [5, 6], 15, true);
    // characterHpMax(fighter,5,[...],+1)=44+5=49 ; characterHpMax(mage,6,[...],+1)=20+6=26
    expect(r.hpMax).toBe(37); // floor(75/2)
    expect(r.bestThac0).toEqual({ group: "warrior", level: 5 });
    expect(r.weaponProfSource.chassisId).toBe("fighter");
    expect(r.nonweaponProfSource.chassisId).toBe("mage");
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
  });

  it("CON 17: warrior member gets +3/die, non-warrior capped at +2/die", () => {
    const classes = [
      entry({ chassisId: "fighter", hpRolls: [1, 1], level: 2 }),
      entry({ chassisId: "mage", hpRolls: [1, 1], level: 2 }),
    ];
    // fighter: (1+3)+(1+3)=8 ; mage: (1+2)+(1+2)=6 ; floor(14/2)=7
    const r = resolveMulticlassArrangement(classes, [2, 2], 17, true);
    expect(r.hpMax).toBe(7);
  });

  it("averaging off -> the single highest class total", () => {
    const classes = [
      entry({ chassisId: "fighter", hpRolls: [1, 1], level: 2 }),
      entry({ chassisId: "mage", hpRolls: [1, 1], level: 2 }),
    ];
    const r = resolveMulticlassArrangement(classes, [2, 2], 17, false);
    expect(r.hpMax).toBe(8); // max(8, 6)
  });
});

describe("resolveDualClassArrangement", () => {
  const dualFighterToMage = (mageLevel: number, mageRolls: number[]) => [
    entry({ chassisId: "fighter", dualClassState: "primary", hpRolls: [10, 8, 9, 10, 7, 8], level: 6 }),
    entry({ chassisId: "mage", dualClassState: "active", hpRolls: mageRolls, level: mageLevel }),
  ];

  it("suppressed: HP frozen at the fighter total, active class only", () => {
    const classes = dualFighterToMage(3, [4, 3, 4]);
    const r = resolveDualClassArrangement(classes, [6, 3], 16);
    // characterHpMax(fighter,6,[...],+2) = 52 + 12 = 64
    expect(r.hpMax).toBe(64);
    expect(r.surpassed).toBe(false);
    expect(r.bestThac0).toEqual({ group: "wizard", level: 3 });
    expect(r.dormantChassisId).toBe("fighter");
  });

  it("surpassed: frozen fighter HP + the mage's level-7 die", () => {
    const classes = dualFighterToMage(7, [4, 3, 4, 2, 3, 4, 3]);
    const r = resolveDualClassArrangement(classes, [6, 7], 16);
    // 64 + (characterHpMax(mage,7,[7 rolls],+2) - characterHpMax(mage,6,[6 rolls],+2))
    //    = 64 + ((23 + 14) - (20 + 12)) = 64 + 5 = 69
    expect(r.hpMax).toBe(69);
    expect(r.surpassed).toBe(true);
    expect(r.bestThac0).toEqual({ group: "warrior", level: 6 });
    expect(r.saveGroups).toEqual([
      { group: "warrior", level: 6 },
      { group: "wizard", level: 7 },
    ]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/data/derive/character/multiclass.test.ts`).

- [ ] **Step 3: Create `src/data/derive/character/multiclass.ts`**

```ts
// Maps the ActorSnapshot class list onto the pure core resolvers. Runs
// characterHpMax per class here (it needs the per-class Constitution column) and
// hands core the resulting HP array — core does the averaging and the best-of.
import { constitution } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import {
  resolveDualClass,
  resolveMulticlass,
  type ArrangementResolution,
  type ClassArrangement,
  type ClassMember,
  type DualClassResolution,
} from "../../../core/classes/multiclass";
import { characterHpMax } from "./hp";
import type { ClassEntry } from "./snapshot";

export type { ClassArrangement };

/** Which advancement arrangement the embedded `class` items represent. */
export function classifyArrangement(classes: readonly ClassEntry[]): ClassArrangement {
  if (classes.length <= 1) return "single";
  const primary = classes.filter((c) => c.dualClassState === "primary").length;
  const active = classes.filter((c) => c.dualClassState === "active").length;
  if (classes.length === 2 && primary === 1 && active === 1) return "dualclass";
  return "multiclass";
}

function member(entry: ClassEntry, level: number): ClassMember {
  return { chassisId: entry.chassisId, level, specialistSchool: entry.specialistSchool };
}

/** Per-class CON hp adjustment — warrior members use the higher warrior column. */
function conAdjFor(chassisId: ClassEntry["chassisId"], conScore: number): number {
  return constitution(conScore, getChassis(chassisId).group === "warrior").hpAdjustment;
}

function hpFor(entry: ClassEntry, level: number, conScore: number): number {
  return characterHpMax(entry.chassisId, level, entry.hpRolls, conAdjFor(entry.chassisId, conScore));
}

export function resolveMulticlassArrangement(
  classes: readonly ClassEntry[],
  levels: readonly number[],
  conScore: number,
  averageHp: boolean,
): ArrangementResolution {
  const members = classes.map((c, i) => member(c, levels[i]));
  const perClassHp = classes.map((c, i) => hpFor(c, levels[i], conScore));
  return resolveMulticlass(members, { perClassHp, averageHp });
}

export function resolveDualClassArrangement(
  classes: readonly ClassEntry[],
  levels: readonly number[],
  conScore: number,
): DualClassResolution {
  const pIdx = classes.findIndex((c) => c.dualClassState === "primary");
  const aIdx = classes.findIndex((c) => c.dualClassState === "active");
  const primaryEntry = classes[pIdx];
  const activeEntry = classes[aIdx];
  const primaryLevel = levels[pIdx];
  const activeLevel = levels[aIdx];
  const conAdj = conAdjFor(activeEntry.chassisId, conScore);

  const activeFull = characterHpMax(activeEntry.chassisId, activeLevel, activeEntry.hpRolls, conAdj);
  const activeAtPrimary = characterHpMax(
    activeEntry.chassisId,
    primaryLevel,
    activeEntry.hpRolls.slice(0, primaryLevel),
    conAdj,
  );

  return resolveDualClass({
    primary: member(primaryEntry, primaryLevel),
    active: member(activeEntry, activeLevel),
    primaryFrozenHp: hpFor(primaryEntry, primaryLevel, conScore),
    activeHpAbovePrimary: activeFull - activeAtPrimary,
  });
}
```

- [ ] **Step 4: Run — expect PASS.** Engine wins any disagreement (fix + comment + note).

- [ ] **Step 5: Full gate.** `src/data/derive/character/multiclass.ts` at 100% — the tests cover `classifyArrangement`'s four branches, both CON columns, `averageHp` on/off, and dual-class suppressed/surpassed.

- [ ] **Step 6: Commit**

```bash
git add src/data/derive/character/multiclass.ts tests/data/derive/character/multiclass.test.ts
git commit -m "feat(data): snapshot -> core multiclass/dualclass resolver adapter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `deriveCharacter` orchestration + `CharacterDerived` + `deriveAndCache`

**Files:**
- Modify: `src/data/derive/character/derive.ts`
- Modify: `src/data/derive/character/index.ts` (one `export *` line)
- Modify: `src/data/actor/base-actor.ts` — `deriveAndCache` only (schema is Task 7)
- Test: `tests/data/derive/character/derive.test.ts`

**Interfaces:**
- `CharacterDerived` **loses** `multiclassPending: boolean`, **gains**
  ```ts
  multiclass: {
    mode: ClassArrangement;
    dualClass: { dormantChassisId: ClassId | null; activeChassisId: ClassId | null; surpassed: boolean };
    hpAveraged: boolean;
  };
  ```
  `hpMax` / `thac0` / `saves` / `spellSlots` / `proficiencies` keep their existing shapes; their **values** are now mode-correct. `spellSlots` may carry **both** `wizard` and `priest`.
- `deriveAndCache` writes `sys.multiclass = derived.multiclass` where it wrote `sys.multiclassPending`.

- [ ] **Step 1: Rewrite the multiclass assertions in `tests/data/derive/character/derive.test.ts`**

Delete the test `"two classes -> derives from the first + flags multiclassPending"` entirely. In the two tests that assert `expect(d.multiclassPending).toBe(false)` (the `"levels, HP, THAC0, …"` case and the `"a 0-class actor"` case), replace that line with `expect(d.multiclass.mode).toBe("single")`.

Then append this `describe` block:

```ts
describe("deriveCharacter — multiclass (§5.6 step 1)", () => {
  const elfFM: ActorSnapshot = {
    abilities: { str: 13, dex: 16, con: 15, int: 15, wis: 10, cha: 10 },
    exceptionalStrengthPercentile: null,
    race: "elf",
    classes: [
      { chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [10, 9, 8, 10, 7], dualClassState: null, level: 5 },
      { chassisId: "mage", specialistSchool: null, xp: 0, hpRolls: [4, 3, 4, 2, 3, 4], dualClassState: null, level: 6 },
    ],
    equippedArmor: null,
    equippedShield: null,
    carriedWeight: 0,
    wizardMemorized: [],
    priestMemorized: [],
    spentWeaponSlots: 0,
    spentNonweaponSlots: 0,
    baseMovement: 12,
  };

  it("Fighter 5 / Mage 6: averaged HP, best THAC0, best-of saves, split prof classes", () => {
    const d = deriveCharacter(elfFM, DEFAULT_OPTIONAL_RULES);
    expect(d.multiclass.mode).toBe("multiclass");
    expect(d.multiclass.hpAveraged).toBe(true);
    expect(d.hpMax).toBe(37);
    // best THAC0 = warrior L5 = 16 ; STR 13 hitProb 0 ; DEX 16 missile +1
    expect(d.thac0).toEqual({ base: 16, melee: 16, ranged: 15 });
    // saves: rsw wins from wizard (9), ppd from warrior (11)
    expect(d.saves!.rsw.target).toBe(9);
    expect(d.saves!.ppd.target).toBe(11);
    // weapon from fighter (5), nonweapon from mage (6)
    expect(d.proficiencies!.weapon.total).toBe(5);
    expect(d.proficiencies!.nonweapon.total).toBe(6);
    // only the mage casts
    expect(d.spellSlots.wizard).toBeDefined();
    expect(d.spellSlots.priest).toBeUndefined();
    expect(d.multiclass.dualClass).toEqual({ dormantChassisId: null, activeChassisId: null, surpassed: false });
  });

  it("multiclassHpAveraging off -> highest single class HP", () => {
    const d = deriveCharacter(elfFM, { ...DEFAULT_OPTIONAL_RULES, multiclassHpAveraging: false });
    expect(d.hpMax).toBe(49); // characterHpMax(fighter,5,...,+1)
    expect(d.multiclass.hpAveraged).toBe(false);
  });

  it("half-elf Fighter/Mage/Cleric: both spell records populated", () => {
    const fmc: ActorSnapshot = {
      ...elfFM,
      race: "half-elf",
      abilities: { str: 13, dex: 12, con: 15, int: 12, wis: 15, cha: 10 },
      classes: [
        { chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [10, 8, 9, 7], dualClassState: null, level: 4 },
        { chassisId: "mage", specialistSchool: null, xp: 0, hpRolls: [4, 3, 4, 2], dualClassState: null, level: 4 },
        { chassisId: "cleric", specialistSchool: null, xp: 0, hpRolls: [8, 6, 7, 8], dualClassState: null, level: 4 },
      ],
    };
    const d = deriveCharacter(fmc, DEFAULT_OPTIONAL_RULES);
    expect(d.hpMax).toBe(29); // floor((38+17+33)/3)
    expect(d.spellSlots.wizard).toBeDefined();
    expect(d.spellSlots.priest).toBeDefined();
    expect(d.thac0!.base).toBe(17); // warrior L4
  });
});

describe("deriveCharacter — dual-class (§5.6 step 1)", () => {
  const humanFtoM = (mageLevel: number, mageRolls: number[]): ActorSnapshot => ({
    abilities: { str: 15, dex: 12, con: 16, int: 15, wis: 10, cha: 10 },
    exceptionalStrengthPercentile: null,
    race: "human",
    classes: [
      { chassisId: "fighter", specialistSchool: null, xp: 0, hpRolls: [10, 8, 9, 10, 7, 8], dualClassState: "primary", level: 6 },
      { chassisId: "mage", specialistSchool: null, xp: 0, hpRolls: mageRolls, dualClassState: "active", level: mageLevel },
    ],
    equippedArmor: null,
    equippedShield: null,
    carriedWeight: 0,
    wizardMemorized: [],
    priestMemorized: [],
    spentWeaponSlots: 0,
    spentNonweaponSlots: 0,
    baseMovement: 12,
  });

  it("suppressed (mage 3 <= fighter 6): mage THAC0/saves, HP frozen, mage spells", () => {
    const d = deriveCharacter(humanFtoM(3, [4, 3, 4]), DEFAULT_OPTIONAL_RULES);
    expect(d.multiclass.mode).toBe("dualclass");
    expect(d.multiclass.dualClass).toEqual({ dormantChassisId: "fighter", activeChassisId: "mage", surpassed: false });
    expect(d.hpMax).toBe(64); // frozen fighter L6 total (CON 16 -> +2)
    expect(d.thac0!.base).toBe(20); // thac0("wizard",3)
    expect(d.saves!.spell.target).toBe(12); // wizard band minLevel 1
    expect(d.spellSlots.wizard).toBeDefined();
  });

  it("surpassed (mage 7 > fighter 6): best-of THAC0 & saves, HP frozen + mage L7 die", () => {
    const d = deriveCharacter(humanFtoM(7, [4, 3, 4, 2, 3, 4, 3]), DEFAULT_OPTIONAL_RULES);
    expect(d.multiclass.dualClass.surpassed).toBe(true);
    expect(d.hpMax).toBe(69);
    expect(d.thac0!.base).toBe(15); // best of warrior L6 (15) vs wizard L7 (18)
    expect(d.saves!.rsw.target).toBe(9); // wizard L7 band
    expect(d.saves!.ppd.target).toBe(11); // warrior band minLevel 5
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/data/derive/character/derive.test.ts`).

- [ ] **Step 3: Rewrite `src/data/derive/character/derive.ts`**

```ts
// The character derived-data pipeline (spec §5.6). Pure — takes a snapshot + the
// optional-rules bag, returns the object CharacterModel caches onto system.*.
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type {
  ClassId, DerivedAbilities, EncumbranceCategory, SaveCategory, WizardSchool,
} from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import type {
  ArrangementResolution, ClassArrangement, ClassMember, DualClassResolution,
} from "../../../core/classes/multiclass";
import type { ActorSnapshot } from "./snapshot";
import { deriveClassLevels } from "./levels";
import { characterHpMax } from "./hp";
import { deriveThac0 } from "./thac0";
import { deriveAc } from "./ac";
import { deriveSaves } from "./saves";
import { deriveSpellSlots, type SlotRecord } from "./slots";
import { deriveProficiencySlots, type SlotBlock } from "./proficiencies";
import { deriveEncumbrance } from "./encumbrance";
import {
  classifyArrangement, resolveDualClassArrangement, resolveMulticlassArrangement,
} from "./multiclass";

export interface CharacterDerived {
  abilities: DerivedAbilities;
  classes: { chassisId: ClassId; level: number; canLevelUp: boolean }[];
  hpMax: number;
  thac0: { base: number; melee: number; ranged: number } | null;
  ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
  saves: Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }> | null;
  spellSlots: { wizard?: SlotRecord; priest?: SlotRecord };
  proficiencies: { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } | null;
  encumbrance: {
    carried: number;
    category: EncumbranceCategory;
    movementRate: number;
    penalty: { attackRoll: number; armorClass: number };
    baseMove: number;
  };
  multiclass: {
    mode: ClassArrangement;
    dualClass: { dormantChassisId: ClassId | null; activeChassisId: ClassId | null; surpassed: boolean };
    hpAveraged: boolean;
  };
}

const NO_DUAL_CLASS = {
  dormantChassisId: null as ClassId | null,
  activeChassisId: null as ClassId | null,
  surpassed: false,
};

function spellInput(
  m: ClassMember,
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
) {
  return {
    chassisId: m.chassisId,
    level: m.level,
    maxSpellLevelKnown: abilities.int.maxSpellLevel,
    wisdomScore: snapshot.abilities.wis,
    wisdomBonusSpells: abilities.wis.bonusPriestSpells,
    specialist: m.specialistSchool !== null,
    wizardMemorized: snapshot.wizardMemorized,
    priestMemorized: snapshot.priestMemorized,
  };
}

function mergeCasterSlots(
  casters: readonly ClassMember[],
  snapshot: ActorSnapshot,
  abilities: DerivedAbilities,
): { wizard?: SlotRecord; priest?: SlotRecord } {
  let out: { wizard?: SlotRecord; priest?: SlotRecord } = {};
  for (const c of casters) {
    out = { ...out, ...deriveSpellSlots(spellInput(c, snapshot, abilities)) };
  }
  return out;
}

export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");

  // §5.6 step 2 — ability modifiers. Scores are already racially adjusted
  // (CharacterModel.prepareBaseData). race:"human" makes deriveAbilities' own
  // applyRacialDeltas a no-op; the halfling exceptional-Strength ban is kept by
  // pre-nulling the percentile.
  const percentile = snapshot.race === "halfling" ? null : snapshot.exceptionalStrengthPercentile;
  const abilities = deriveAbilities(snapshot.abilities, {
    race: "human", isWarrior, options, exceptionalStrengthPercentile: percentile,
  });

  const classLevels = deriveClassLevels(snapshot.classes);
  const levels = classLevels.map((c) => c.level);
  const mode = classifyArrangement(snapshot.classes);
  const race = snapshot.race ?? "human";

  // §5.6 step 6 — AC (class-independent).
  const ac = deriveAc({
    equippedArmor: snapshot.equippedArmor,
    equippedShield: snapshot.equippedShield,
    dexDefensiveAdj: abilities.dex.defensiveAdj,
  });

  // §5.6 step 10 — encumbrance (class-independent).
  const encumbrance = deriveEncumbrance({
    carried: snapshot.carriedWeight,
    strengthScore: snapshot.abilities.str,
    weightAllowance: abilities.str.weightAllowance,
    maxPress: abilities.str.maxPress,
    baseMove: snapshot.baseMovement,
  });

  if (mode === "single") {
    const primary = snapshot.classes[0] ?? null;
    const chassis = primary ? getChassis(primary.chassisId) : null;
    const level = primary ? levels[0] : 0;
    const primaryMember: ClassMember | null = primary
      ? { chassisId: primary.chassisId, level, specialistSchool: primary.specialistSchool }
      : null;
    return {
      abilities,
      classes: classLevels,
      hpMax: primary
        ? characterHpMax(primary.chassisId, level, primary.hpRolls, abilities.con.hpAdjustment)
        : 0,
      thac0: chassis
        ? deriveThac0(chassis.group, level, abilities.str.hitProb, abilities.dex.missileAttackAdj)
        : null,
      ac,
      saves: chassis
        ? deriveSaves({
            groups: [{ group: chassis.group, level }],
            race,
            con: snapshot.abilities.con,
            wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
            dexDefensiveAdj: abilities.dex.defensiveAdj,
          })
        : null,
      spellSlots: primaryMember ? mergeCasterSlots([primaryMember], snapshot, abilities) : {},
      proficiencies: primary
        ? deriveProficiencySlots(
            { chassisId: primary.chassisId, level },
            { chassisId: primary.chassisId, level },
            abilities.int.bonusLanguages,
            snapshot.spentWeaponSlots,
            snapshot.spentNonweaponSlots,
          )
        : null,
      encumbrance,
      multiclass: { mode, dualClass: NO_DUAL_CLASS, hpAveraged: false },
    };
  }

  const resolution: ArrangementResolution =
    mode === "dualclass"
      ? resolveDualClassArrangement(snapshot.classes, levels, snapshot.abilities.con)
      : resolveMulticlassArrangement(
          snapshot.classes, levels, snapshot.abilities.con, options.multiclassHpAveraging,
        );

  const dualClass =
    mode === "dualclass"
      ? {
          dormantChassisId: (resolution as DualClassResolution).dormantChassisId,
          activeChassisId: (resolution as DualClassResolution).activeChassisId,
          surpassed: (resolution as DualClassResolution).surpassed,
        }
      : NO_DUAL_CLASS;

  return {
    abilities,
    classes: classLevels,
    hpMax: resolution.hpMax,
    thac0: deriveThac0(
      resolution.bestThac0.group,
      resolution.bestThac0.level,
      abilities.str.hitProb,
      abilities.dex.missileAttackAdj,
    ),
    ac,
    saves: deriveSaves({
      groups: resolution.saveGroups,
      race,
      con: snapshot.abilities.con,
      wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
      dexDefensiveAdj: abilities.dex.defensiveAdj,
    }),
    spellSlots: mergeCasterSlots(resolution.casters, snapshot, abilities),
    proficiencies: deriveProficiencySlots(
      resolution.weaponProfSource,
      resolution.nonweaponProfSource,
      abilities.int.bonusLanguages,
      snapshot.spentWeaponSlots,
      snapshot.spentNonweaponSlots,
    ),
    encumbrance,
    multiclass: {
      mode,
      dualClass,
      hpAveraged: mode === "multiclass" && options.multiclassHpAveraging,
    },
  };
}
```

Note the unused import guard: `WizardSchool` is only needed if a helper references it; if `tsc` flags it as unused, remove it from the import list.

- [ ] **Step 4: Add the barrel export** — `src/data/derive/character/index.ts`, append:

```ts
export * from "./multiclass";
```

- [ ] **Step 5: Update `deriveAndCache` in `src/data/actor/base-actor.ts`**

In the `DerivedWriteSurface` interface, replace `multiclassPending: boolean;` with `multiclass: unknown;`.
In `deriveAndCache`, replace `sys.multiclassPending = derived.multiclassPending;` with `sys.multiclass = derived.multiclass;`.
(The `multiclassPending` schema field stays for now — it becomes a harmless unwritten field until Task 7 removes it.)

- [ ] **Step 6: Run — expect PASS**

Run: `npx vitest run tests/data/derive/character/`
Expected: PASS. Any e2e number that disagrees with the engine → engine wins (fix assertion + comment + report note). Pay attention to `d.thac0` (STR/DEX adjustments), `d.saves.*.target` (band boundaries), and `d.hpMax`.

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `derive.ts` at 100% — `mode === "single"` with and without a class, `mode === "multiclass"`, `mode === "dualclass"`, `hpAveraged` true and false, `mergeCasterSlots` with 0 / 1 / 2 casters, and `dualClass` populated vs `NO_DUAL_CLASS` are all exercised by the suite.

- [ ] **Step 8: Commit**

```bash
git add src/data/derive/character/derive.ts src/data/derive/character/index.ts src/data/actor/base-actor.ts tests/data/derive/character/derive.test.ts
git commit -m "feat(data): deriveCharacter resolves multiclass & dual-class (spec §5.6 step 1)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `system.multiclass` schema + `MULTICLASS_MODES` + drop `multiclassPending`

**Files:**
- Modify: `src/data/item/choices.ts`
- Modify: `tests/data/choices.test.ts`
- Modify: `src/data/actor/base-actor.ts` — `actorCommonSchema()` only

**Interfaces:**
- `MULTICLASS_MODES: readonly ClassArrangement[]` in `choices.ts` — `["single", "multiclass", "dualclass"]`, drift-tested.
- `system.multiclass` on `character` + `npc`: `{ mode, dualClass: { dormantChassisId, activeChassisId, surpassed }, hpAveraged }` with pre-derive-safe initials (`"single"`, `null`, `null`, `false`, `false`).
- `system.multiclassPending` is **removed** from the schema.

- [ ] **Step 1: Add `MULTICLASS_MODES` to `src/data/item/choices.ts`**

Add to the imports at the top: `ClassArrangement` from the derive-character barrel —

```ts
import type { ClassArrangement } from "../derive/character/multiclass";
```

and, near the other small fixed lists:

```ts
/** Character advancement arrangement (= `ClassArrangement`). */
export const MULTICLASS_MODES: readonly ClassArrangement[] = ["single", "multiclass", "dualclass"];
```

- [ ] **Step 2: Add the drift test** — `tests/data/choices.test.ts`

Add `MULTICLASS_MODES` to the import list, and add inside the `describe("actor schema choice arrays", …)` block:

```ts
  it("MULTICLASS_MODES = the three ClassArrangement members", () => {
    expect([...MULTICLASS_MODES].sort()).toEqual(["dualclass", "multiclass", "single"]);
  });
```

- [ ] **Step 3: Run — expect PASS** (`npx vitest run tests/data/choices.test.ts`).

- [ ] **Step 4: Add `multiclassSchema()` to `src/data/actor/base-actor.ts`**

Add `MULTICLASS_MODES` to the `import { … } from "../item/choices"` line. Add this hoisted helper next to the other derived-container schema helpers (after `movementSchema()`):

```ts
/** Derived multi-class / dual-class summary; initials are safe pre-derive values. */
function multiclassSchema() {
  return new SchemaField({
    mode: new StringField({ required: true, blank: false, initial: "single", choices: MULTICLASS_MODES }),
    dualClass: new SchemaField({
      dormantChassisId: new StringField({ required: true, nullable: true, initial: null, choices: CLASS_IDS }),
      activeChassisId: new StringField({ required: true, nullable: true, initial: null, choices: CLASS_IDS }),
      surpassed: new BooleanField({ required: true, initial: false }),
    }),
    hpAveraged: new BooleanField({ required: true, initial: false }),
  });
}
```

- [ ] **Step 5: Wire it into `actorCommonSchema()` and remove `multiclassPending`**

In the object returned by `actorCommonSchema()`, replace the line

```ts
    multiclassPending: new BooleanField({ required: true, initial: false }),
```

with

```ts
    multiclass: multiclassSchema(),
```

- [ ] **Step 6: Clean the `DerivedWriteSurface` comment**

Confirm `DerivedWriteSurface` now reads `multiclass: unknown;` (set in Task 6) and no longer mentions `multiclassPending`. No code change if Task 6 was done correctly — just verify.

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `choices.ts` stays 100% (the new constant is a plain array; the drift test reads it). `base-actor.ts` is typecheck+build gated only.

- [ ] **Step 8: Commit**

```bash
git add src/data/item/choices.ts tests/data/choices.test.ts src/data/actor/base-actor.ts
git commit -m "feat(data): system.multiclass schema; drop the multiclassPending placeholder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: reconcile the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md`

- [ ] **Step 1: §5.6 — rewrite step 1 of the `prepareDerivedData` list**

Replace the current line:

```
  1. `resolveMulticlass` / `resolveDualClass` → `effectiveLevels`, HP averaging rule, active/suppressed abilities
```

with:

```
  1. **Arrangement** — classify the embedded `class` items as single / multi-class
     / dual-class. Multi-class: each class keeps its own level; combat uses the
     best THAC0 and best-of-five saves; HP is `characterHpMax` per class then
     `floor(Σ / n)` (or `max` when the *Average Multi-Class Hit Points* rule is
     off), with non-warrior classes capped at +2 CON hp/die; proficiency slots
     come from the most favourable class per track; each full-caster class gets
     its own progression. Dual-class: while the new class's level ≤ the old
     class's, use the new class only and freeze HP at the old total; once it
     exceeds, THAC0/saves become best-of-both and HP gains the new class's dice
     for levels above the old level. Cached as `system.multiclass`.
```

- [ ] **Step 2: §5.1 — update the "Derived (cached on `system`)" list**

- Change the `classes` bullet to note the sibling:
  ```
  - `classes`: per-class array `{ chassisId, level, canLevelUp }[]`, plus
    `multiclass`: `{ mode: "single"|"multiclass"|"dualclass",
    dualClass: { dormantChassisId: string|null, activeChassisId: string|null,
    surpassed: boolean }, hpAveraged: boolean }` — the arrangement summary.
  ```
- Add a parenthetical to `attributes.hp.max`, `attributes.thac0`, and
  `saves.<…>`: "(best-of across classes for a multi-class / surpassed dual-class
  character)".
- Add to `spellcasting.wizard.slots` / `.priest.slots`: "both are populated for a
  multi-class character with a wizard and a priest class."

- [ ] **Step 3: Verify no stale `multiclassPending` reference**

Run: `grep -rn "multiclassPending" docs/ src/` — expect **no matches** (Task 6 + Task 7 removed the code; the spec never named it).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md
git commit -m "docs(spec): §5.6 step 1 + §5.1 — multiclass/dualclass resolution

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final verification (controller, before the whole-branch review)

- [ ] `npm run typecheck && npm run lint && npm run test:coverage && npm run build` — all green from a cleared cache.
- [ ] Coverage: 100% lines / statements / functions / **branches** across the gated zone; the new `src/core/classes/multiclass.ts` and `src/data/derive/character/multiclass.ts` at 100%.
- [ ] `grep -rn "multiclassPending" src/ docs/` returns nothing.
- [ ] `grep -rn "\.memorized\b" src/data` returns only `wizardMemorized` / `priestMemorized` / the schema `memorizedSchema()` field names (the flattened `snapshot.memorized` is gone).
- [ ] Dev-world smoke check (record for the PR, run before merge — `defineSchema` needs a live Foundry):
  - Elf Fighter/Mage (two `class` items, `xp` for L5 / L6, `hpRolls` filled) → console-verify `system.multiclass.mode === "multiclass"`, `system.attributes.hp.max` is the averaged value, `system.attributes.thac0.base` is the fighter-table value, `system.spellcasting.wizard.slots` populated and `system.spellcasting.priest.slots` empty.
  - Human dual-class Fighter (`dualClassState: "primary"`) → Mage (`dualClassState: "active"`), mage below then above fighter level → `system.multiclass.dualClass.surpassed` flips, `system.attributes.hp.max` frozen then grows.

---

## Self-Review (completed by plan author)

**1. Spec coverage.** §5.6 step 1 → Tasks 2, 5, 6, 8. §5.1 `system.multiclass` → Tasks 6, 7, 8. §5.1 best-of HP/THAC0/saves → Tasks 1, 2, 6. §4.1 two-layer split → every task keeps `core/**` + `data/derive/**` Foundry-free; only `base-actor.ts` touches Foundry. The 1c.3b finding **M3** (merged memorized lists) → Task 3. No spec requirement is left without a task.

**2. Placeholder scan.** No "TBD" / "handle edge cases" / "similar to Task N" — every code step carries the full code. The one soft spot is "engine is the authority" on hand-computed test numbers; that is a deliberate, bounded instruction (correct the assertion, comment, report), not a placeholder.

**3. Type consistency.** `GroupLevel` (Task 1) is consumed by `saveTargetBest` (Task 1), `ArrangementResolution.bestThac0` / `saveGroups` (Task 2), and `SavesInput.groups` (Task 4) — same shape throughout. `ClassMember` (Task 2) is produced by the adapter (Task 5) and consumed by `mergeCasterSlots` (Task 6). `ClassArrangement` (Task 2) is re-exported by the adapter (Task 5), used by `CharacterDerived.multiclass.mode` (Task 6) and `MULTICLASS_MODES` (Task 7). `ProfSource` (Task 4) is what `resolution.weaponProfSource` / `nonweaponProfSource` (Task 2) structurally satisfy — both are `{ chassisId: ClassId; level: number }`. `deriveSpellSlots`'s `wizardMemorized` / `priestMemorized` (Task 3) match `ActorSnapshot`'s fields (Task 3) and `spellInput` (Task 6). No name drift found.

**4. Ordering / gate-green between tasks.** Task 3 changes `ActorSnapshot` and updates every reader in the same commit. Task 4's minimal `derive.ts` edits keep it compiling before Task 6 replaces the file. Task 6 changes `CharacterDerived` and the `deriveAndCache` write together; the dead `multiclassPending` schema field is harmless until Task 7 removes it. Task 7's `choices.ts` → `derive/character/multiclass` import is within the pure zone (both are in `tsconfig.core.json`'s globs).
