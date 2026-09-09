# AD&D 2E — Plan 1c.3b: The deriveCharacter Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill §5.6 pipeline steps 3–10 of the pure `deriveCharacter` contract — class levels, HP max, THAC0, AC, saving throws, spell slots, proficiency slots, encumbrance — for a **single-class** character, and relocate racial ability adjustment to `prepareBaseData` so ActiveEffects can target it.

**Architecture:** Eight small pure step functions in `src/data/derive/character/` (each 100% Vitest-covered), orchestrated by `deriveCharacter` in §5.6 order. `CharacterModel`/`NpcModel` gain a `prepareBaseData` that applies the racial delta to `system.abilities.<k>.score`; `snapshotActor` then reads the already-adjusted scores. A shared `deriveAndCache` helper on the actor base ends the `character.ts`/`npc.ts` duplication.

**Tech Stack:** TypeScript 5 strict, `fvtt-types` v13-beta, Vite 8 lib build, Vitest 5, ESLint 10 flat config, Foundry VTT **system**.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §5.1 (`character` derived list + `system.*` paths), §5.6 (derived-data ordering + the two-pass problem), §4.1 (layer contract).

## Global Constraints

- **`src/core/**`, `src/data/derive/**`, `src/data/item/{subtypes,choices}.ts`, `src/data/actor/subtypes.ts`, and their tests import NOTHING from `foundry` / `fvtt-types` / `game` / `CONFIG` / `Hooks` / the DOM.** They MAY import from `src/core/**` and (within `src/data/derive/**`) each other. Enforced by `tsconfig.core.json` (`types: []`) + the ESLint block.
- **The DataModel classes, `src/data/actor/{snapshot,base-actor}.ts`, `src/documents/**`** are Foundry-layer — base `tsconfig.json` only.
- **`defineSchema()` bodies contain no logic** — literals, hoisted-factory calls, fragment spreads, field constructors only.
- **`deriveCharacter` and every step function are pure** — no `game.settings`, no `Roll`, no globals. The `OptionalRules` bag is a parameter.
- **`core/` is math only** — the caller passes resolved numbers (spec §4.1); each engine domain takes already-derived adjustments (e.g. `saveTarget` takes `wisMagicalDefenseAdj: number`, not a WIS score).
- **No rulebook prose.** HTML fields ship empty.
- Coverage gate: **100%** lines/statements/functions, **≥90%** branches on `src/core/**` + `src/config.ts` + `src/settings/registry.ts` + `src/data/derive/**` + `src/data/item/{subtypes,choices}.ts` + `src/data/actor/subtypes.ts`.
- Full gate = `npm run typecheck && npm run lint && npm run test:coverage && npm run build`.
- **Do NOT run `npm install` / `npm run format` / `prettier`.** Vitest cache flake → `rm -rf node_modules/.vite node_modules/.vitest node_modules/.cache`.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Foundry compatibility: `minimum: "13"`, `verified: "14"`.

## Rulings carried from brainstorming

- **S1 — 1c.3b is single-class.** The caster / THAC0 / save / proficiency steps use `snapshot.classes[0]`. `deriveCharacter` still lists every class's `{chassisId, level, canLevelUp}` in `derived.classes` and sets `multiclassPending = snapshot.classes.length > 1`. Full aggregation (best-of THAC0/saves, averaged HP) is Plan 1c.3c, which also builds `resolveMulticlass` / `resolveDualClass` (they do not exist in `core/`). The `creature` derive path + the `ActiveEffect` `adnd2e` subtype + the two-pass affects-base/affects-derived split are Plan 1c.3d. Recorded as a scope boundary; the spec doc is unchanged.
- **HP1 — un-rolled levels contribute 0.** `characterHpMax` sums the entered `hpRolls` + CON adjustment per rolled level + the flat post-name-level bonus for rolled levels past the cutoff. A level with no `hpRolls` entry adds nothing; `canLevelUp` already surfaces "you owe a roll".
- **SLOT1 — `used` is computed now.** `slots[i].used` = count of `memorized` entries with `spellLevel === i`. `MemorizedEntry = { spellItemId: string; spellLevel: number }` (1–9).
- **CASTER1 — 1c.3b handles the two full-caster progressions only.** `deriveSpellSlots` covers `casterType: "wizard"` (Mage + specialist wizards → `wizardSpellSlots`) and `casterType: "priest"` (Cleric, Druid → `priestSpellSlots`). Paladin / Ranger / Bard limited-caster slots (`spellProgressionId` `"paladin"` / `"ranger"` / `"bard"`) return `null` here — a small follow-up (their engine functions already exist in `core/magic/class-slots.ts`). Cost if wrong: a paladin sheet shows no spell slots until the follow-up; paladins first cast at level 9 anyway.
- **F3 — racial ability adjustment moves to `prepareBaseData`.** Was applied inside `deriveCharacter`; spec §5.6 puts it before ActiveEffects so a "+1 STR" item stacks on the adjusted score. `deriveCharacter` now receives already-adjusted scores.
- **SCH1 — derived containers get schema fields.** Every `system.*` path §5.1 lists as derived (`attributes.thac0`, `attributes.ac`, `saves.<k>`, `proficiencies.*`, `attributes.encumbrance`, `attributes.movement`, `languagesKnown`, `classes`, `spellcasting.*.slots`) gets a `SchemaField` with sane initials, so a sheet (Plan 1c.4) or a pre-`prepareDerivedData` read never hits `undefined`.

---

## Engine functions this plan calls (all exist on `master`)

| Function | Signature | Returns |
|---|---|---|
| `getChassis(id)` | `(ClassId) => ClassChassis` | the chassis (`group`, `casterType`, `spellProgressionId`, `conBonusCutoffLevel`, `hitDie`, `hpAfterNameLevel`, `weaponProficiencies`, `nonweaponProficiencies` …) |
| `hitDice(chassis, level)` | `(ClassChassis, number) => { count, dieType, bonus }` | `bonus` = flat hp for levels past `conBonusCutoffLevel` |
| `classItemLevel(chassisId, xp)` / `classItemCanLevelUp(chassisId, xp, hpRollsLength)` | 1c.2 helpers | number / boolean |
| `thac0(group, level)` | `(ClassGroup, number) => number` | base THAC0 |
| `armorClass(input)` | `ArmorClassInput => ArmorClassResult` | `{ value, raw, breakdown }`; input `{ baseArmorAc, shieldBonus?, dexDefensiveAdj?, magicBonus?, situationalModifier?, denyDexBonus?, denyShield? }` |
| `saveTarget(input)` | `SaveTargetInput => SaveTargetResult` | `{ target, rollModifier, effectiveTarget, breakdown }`; input `{ group, level, category, race, con, wisMagicalDefenseAdj, dexDefensiveAdj, tags?, situationalModifier? }` |
| `wizardSpellSlots(input)` | `{ wizardLevel, maxSpellLevelKnown, specialist? } => SpellSlots` | `.perLevel` length 9 |
| `priestSpellSlots(input)` | `{ priestLevel, wisdomScore, wisdomBonusSpells } => SpellSlots` | `.perLevel` length 7 |
| `weaponProficiencySlots(chassis, level)` / `nonweaponProficiencySlots(chassis, level)` | `(ClassChassis, number) => number` | slot total |
| `encumbranceCategory(input)` | `{ carried, strengthScore, weightAllowance, maxPress } => EncumbranceCategory` | one of the 6 |
| `modifiedMovementRate(input)` | `{ baseMove, carried, strengthScore, weightAllowance, maxPress, rule } => { rate, category }` | use `rule: "category"` |
| `encumbrancePenalty(input)` | `{ baseMove, currentMove } => { attackRoll, armorClass }` | penalties |
| `applyRacialDeltas(raw, race)` | `(AbilityScores, Race) => AbilityScores` | additive racial deltas, no clamp |

`DerivedAbilities` fields used: `str.hitProb`, `str.weightAllowance`, `str.maxPress`, `dex.missileAttackAdj`, `dex.defensiveAdj`, `con.hpAdjustment`, `wis.magicalDefenseAdj`, `wis.bonusPriestSpells`, `int.maxSpellLevel`, `int.bonusLanguages`.

---

## File Structure

**Created — pure (Foundry-free + 100% coverage; `src/data/derive/**` glob already covers them):**
- `src/data/derive/character/levels.ts` — `deriveClassLevels`
- `src/data/derive/character/hp.ts` — `characterHpMax`
- `src/data/derive/character/thac0.ts` — `deriveThac0`
- `src/data/derive/character/ac.ts` — `deriveAc`
- `src/data/derive/character/saves.ts` — `deriveSaves`
- `src/data/derive/character/slots.ts` — `deriveSpellSlots`
- `src/data/derive/character/proficiencies.ts` — `deriveProficiencySlots`
- `src/data/derive/character/encumbrance.ts` — `deriveEncumbrance`

**Modified — pure:**
- `src/data/derive/character/snapshot.ts` — grow `ActorSnapshot` + `ClassEntry`; add `MemorizedEntry`, `EquippedArmor`, `EquippedShield`.
- `src/data/derive/character/derive.ts` — grow `CharacterDerived`; orchestrate steps 3–10; drop the F3 racial delta.
- `src/data/derive/character/index.ts` — export the 8 new modules.

**Modified — Foundry layer:**
- `src/data/actor/base-actor.ts` — `memorized` schema fields; the derived container schema fields (SCH1); a shared `deriveAndCache(model)` helper.
- `src/data/actor/character.ts`, `src/data/actor/npc.ts` — `prepareBaseData` (F3) + `prepareDerivedData` → `deriveAndCache(this)`.
- `src/data/actor/snapshot.ts` — extract the new `ActorSnapshot` fields.

**Modified — tests:**
- `tests/data/derive/character/derive.test.ts` — rewrite the racial-delta cases for F3; add the e2e cases.
- `tests/data/derive/character/{levels,hp,thac0,ac,saves,slots,proficiencies,encumbrance}.test.ts` — new.

---

## Task 1: F3 — relocate racial adjustment; fold the actor `prepareDerivedData`; `memorized` schema

**Files:**
- Modify: `src/data/derive/character/derive.ts`, `src/data/derive/character/snapshot.ts`
- Modify: `src/data/actor/base-actor.ts`, `src/data/actor/character.ts`, `src/data/actor/npc.ts`
- Modify: `tests/data/derive/character/derive.test.ts`

**Interfaces:**
- Produces: `deriveCharacter(snapshot, options)` unchanged signature but `snapshot.abilities` is now the **post-racial-adjustment** scores; `deriveCharacter` no longer calls `applyRacialDeltas`. `deriveAndCache(model: Adnd2eActorModel): void` on `base-actor.ts`.

- [ ] **Step 1: Rewrite the racial-delta test cases** — `tests/data/derive/character/derive.test.ts`

Replace the two cases that currently assert `deriveCharacter` applies the dwarf delta with cases that assert it does **not** (scores pass through untouched):

```ts
  it("takes ability scores as-is — racial adjustment is prepareBaseData's job now (F3)", () => {
    const d = deriveCharacter({ ...base, race: "dwarf", abilities: { ...base.abilities, con: 15, cha: 13 } }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores.con).toBe(15); // no further delta
    expect(d.abilities.scores.cha).toBe(13);
  });
  it("no race still derives cleanly", () => {
    const d = deriveCharacter({ ...base, race: null }, DEFAULT_OPTIONAL_RULES);
    expect(d.abilities.scores).toEqual(base.abilities);
  });
```

Keep the exceptional-Strength and warrior-CON-band cases (they don't depend on racial adjustment).

- [ ] **Step 2: Run — verify the old cases fail**

Run: `npx vitest run tests/data/derive/character/derive.test.ts`
Expected: FAIL on the rewritten cases (deriveCharacter still applies the delta).

- [ ] **Step 3: Drop the F3 delta from `src/data/derive/character/derive.ts`**

`deriveAbilities` always calls `applyRacialDeltas(scores, opts.race)` internally
(the engine has no skip flag). Since the scores now arrive **already** racially
adjusted from `prepareBaseData`, `deriveCharacter` must pass `race: "human"` so
that internal call is a no-op (`RACIAL_ABILITY_ADJUSTMENTS.human` is `{}`).

The one thing lost by passing `"human"` is `deriveAbilities`'s halfling
"no exceptional Strength" guard (`opts.race !== "halfling"`). Preserve it by
pre-nulling the percentile for a halfling:

```ts
export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");
  // Scores are already racially adjusted (CharacterModel.prepareBaseData). Pass
  // race:"human" so deriveAbilities' own applyRacialDeltas is a no-op; halflings
  // never get exceptional Strength (PHB p.19), enforced here since we drop the
  // race hint the engine used for that check.
  const percentile = snapshot.race === "halfling" ? null : snapshot.exceptionalStrengthPercentile;
  const abilities = deriveAbilities(snapshot.abilities, {
    race: "human",
    isWarrior,
    options,
    exceptionalStrengthPercentile: percentile,
  });
  // … steps 3-10 added in Task 4 …
  return { abilities /* + fields from Task 4 */ };
}
```

Add a test case: a halfling warrior snapshot with `str: 18` and
`exceptionalStrengthPercentile: 100` → `d.abilities.str.hitProb` is `1` (the
STR 18 row), **not** the exceptional row's `3`.

- [ ] **Step 4: Run — verify green**

Run: `npx vitest run tests/data/derive/character/derive.test.ts` → PASS.

- [ ] **Step 5: Add the `deriveAndCache` helper + `memorized` schema + derived schema stubs to `src/data/actor/base-actor.ts`**

Add near the top (after the field-class destructure):

```ts
import { ABILITY_KEYS } from "../item/choices";
import { deriveCharacter } from "../derive/character";
import type { MemorizedEntry } from "../derive/character";
import { getOptionalRules } from "../../settings";
import { snapshotActor } from "./snapshot";

/** One `memorized` sub-object: an embedded `spell` item id + the slot level it occupies. */
function memorizedSchema() {
  return new ArrayField(
    new SchemaField({
      spellItemId: new StringField({ required: true, blank: false }),
      spellLevel: new NumberField({ required: true, integer: true, min: 1, max: 9 }),
    }),
    { required: true, initial: [] },
  );
}

/** A derived save target sub-object; initials are safe pre-derive values. */
function saveEntrySchema() {
  return new SchemaField({
    target: new NumberField({ required: true, integer: true, initial: 20 }),
    rollModifier: new NumberField({ required: true, integer: true, initial: 0 }),
    effectiveTarget: new NumberField({ required: true, integer: true, initial: 20 }),
  });
}

/** Runs the character pipeline and writes every derived value onto `system.*` (spec §5.1 paths). */
export function deriveAndCache(model: foundry.abstract.TypeDataModel.Any): void {
  const parent = (model as unknown as { parent: Actor.Implementation }).parent;
  const derived = deriveCharacter(snapshotActor(parent), getOptionalRules());
  const sys = model as unknown as Record<string, any>;

  for (const k of ABILITY_KEYS) sys.abilities[k].mods = derived.abilities[k];
  sys.classes = derived.classes;
  sys.attributes.hp.max = derived.hpMax;
  sys.attributes.thac0 = derived.thac0;
  sys.attributes.ac = derived.ac;
  for (const k of ["ppd", "rsw", "pp", "bw", "spell"] as const) sys.saves[k] = derived.saves[k];
  sys.proficiencies = { weapon: derived.proficiencies.weapon, nonweapon: derived.proficiencies.nonweapon };
  sys.languagesKnown = { max: derived.proficiencies.languagesMax };
  sys.attributes.encumbrance = derived.encumbrance;
  sys.attributes.movement = {
    base: derived.encumbrance.baseMove,
    current: derived.encumbrance.movementRate,
    encumbranceCategory: derived.encumbrance.category,
  };
  if (derived.spellSlots.wizard) sys.spellcasting.wizard.slots = derived.spellSlots.wizard;
  if (derived.spellSlots.priest) sys.spellcasting.priest.slots = derived.spellSlots.priest;
  sys.multiclassPending = derived.multiclassPending;
}
```

In `actorCommonSchema()`:
- add `memorized: memorizedSchema()` to `spellcasting.wizard` and `spellcasting.priest`.
- add `slots: new ObjectField({ required: true, initial: {} })` to each of `spellcasting.wizard` / `spellcasting.priest`.
- add these to the returned schema object:

```ts
    classes: new ArrayField(
      new SchemaField({
        chassisId: new StringField({ required: true, blank: false, choices: CLASS_IDS }),
        level: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
        canLevelUp: new BooleanField({ required: true, initial: false }),
      }),
      { required: true, initial: [] },
    ),
    multiclassPending: new BooleanField({ required: true, initial: false }),
    languagesKnown: new SchemaField({ max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }) }),
    proficiencies: new SchemaField({
      weapon: proficiencyBlockSchema(),
      nonweapon: proficiencyBlockSchema(),
    }),
```

with the `attributes` SchemaField gaining `thac0` / `ac` / `encumbrance` / `movement` sub-schemas and `saves` gaining the five `saveEntrySchema()` entries. Add hoisted helpers `proficiencyBlockSchema()` (`{ total, spent, available }` NumberFields, initial 0), `thac0Schema()` (`{ base, melee, ranged }` initial 20), `acSchema()` (`{ normal, rearAttack, surprised, shieldless }` initial 10), `encumbranceSchema()` (`{ carried: 0, category: "unencumbered", penalty: { attackRoll: 0, armorClass: 0 }, baseMove: 12, movementRate: 12 }` — `category` a `StringField` with `choices` from a new `choices.ts` `ENCUMBRANCE_CATEGORIES` array), `movementSchema()` (`{ base: 12, current: 12, encumbranceCategory: "unencumbered" }`). Import `CLASS_IDS`, `BooleanField`, `ObjectField`. Add `ENCUMBRANCE_CATEGORIES` to `choices.ts` drift-checked against `core/types.ts` `EncumbranceCategory` (with a test).

- [ ] **Step 6: `prepareBaseData` + fold in `character.ts` and `npc.ts`**

Both files' body becomes:

```ts
import { applyRacialDeltas } from "../../core/abilities";
import type { Race } from "../../core/types";
import { actorCommonSchema, Adnd2eActorModel, deriveAndCache } from "./base-actor";
// (npc.ts also keeps its `npc` SchemaField import + DISPOSITIONS)

export class CharacterModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { ...actorCommonSchema() };   // npc.ts: { ...actorCommonSchema(), npc: … }
  }

  override prepareBaseData(): void {
    const sys = this as unknown as {
      abilities: Record<string, { score: number }>;
      parent: { items: Iterable<{ type: string; system: { raceId?: Race } }> };
    };
    const raceItem = [...sys.parent.items].find((i) => i.type === "race");
    if (!raceItem) return;
    const raw = {
      str: sys.abilities.str.score, dex: sys.abilities.dex.score, con: sys.abilities.con.score,
      int: sys.abilities.int.score, wis: sys.abilities.wis.score, cha: sys.abilities.cha.score,
    };
    const adj = applyRacialDeltas(raw, raceItem.system.raceId as Race);
    for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) sys.abilities[k].score = adj[k];
  }

  override prepareDerivedData(): void {
    deriveAndCache(this);
  }
}
```

Delete the per-file ability-loop bodies. `snapshotActor` needs no change for F3 (it already reads `actor.system.abilities.<k>.score`, which is now the adjusted value after `prepareBaseData`).

- [ ] **Step 7: Gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `derive.ts` still 100% (the `race === "halfling"` ternary — one test with a halfling snapshot covers both arms; add it if missing). `choices.ts` `ENCUMBRANCE_CATEGORIES` test passes.

**Note:** `deriveAndCache` writes `derived.classes` / `derived.thac0` / etc. which do not exist on `CharacterDerived` until Task 4. To keep this task's gate green, `deriveAndCache` in this task writes **only** `abilities.<k>.mods` (the 1c.3a behaviour) with the other assignments added in Task 5. Write the helper minimal now; Task 5 fills it. Adjust Step 5's helper body accordingly — this task ships `deriveAndCache` doing the ability-mods loop plus the `memorized`/derived-container schema additions.

- [ ] **Step 8: Commit**

```bash
git add src/data/derive/character src/data/actor tests/data/derive/character/derive.test.ts src/data/item/choices.ts tests/data/choices.test.ts
git commit -m "refactor(data): move racial adjustment to prepareBaseData (F3); fold actor prepareDerivedData; memorized + derived-container schema"
```

---

## Task 2: Grow `ActorSnapshot` + extend `snapshotActor`

**Files:**
- Modify: `src/data/derive/character/snapshot.ts`
- Modify: `src/data/actor/snapshot.ts`
- Modify: `tests/data/derive/character/derive.test.ts` (fixture shape)

**Interfaces:**
- Produces:
  - `interface MemorizedEntry { spellItemId: string; spellLevel: number }`
  - `interface EquippedArmor { baseArmorAc: number; magicBonus: number }`
  - `interface EquippedShield { shieldBonus: number; magicBonus: number }`
  - `ClassEntry` gains `level: number`
  - `ActorSnapshot` gains `equippedArmor: EquippedArmor | null`, `equippedShield: EquippedShield | null`, `carriedWeight: number`, `memorized: readonly MemorizedEntry[]`, `spentWeaponSlots: number`, `spentNonweaponSlots: number`, `baseMovement: number`

- [ ] **Step 1: Extend `src/data/derive/character/snapshot.ts`**

```ts
export type DualClassState = "primary" | "suppressed" | "active";

export interface ClassEntry {
  chassisId: ClassId;
  specialistSchool: WizardSchool | null;
  xp: number;
  hpRolls: readonly number[];
  dualClassState: DualClassState | null;
  /** the class item's own derived level (`system.level`) */
  level: number;
}

export interface MemorizedEntry {
  spellItemId: string;
  /** 1–9 */
  spellLevel: number;
}

export interface EquippedArmor {
  /** the armor's AC rating (10 none .. 1 plate) */
  baseArmorAc: number;
  magicBonus: number;
}

export interface EquippedShield {
  /** positive magnitude the shield lowers AC by */
  shieldBonus: number;
  magicBonus: number;
}

export interface ActorSnapshot {
  /** post-racial-adjustment ability scores (CharacterModel.prepareBaseData applies the delta) */
  abilities: AbilityScores;
  exceptionalStrengthPercentile: number | null;
  race: Race | null;
  classes: readonly ClassEntry[];
  equippedArmor: EquippedArmor | null;
  equippedShield: EquippedShield | null;
  /** Σ totalWeight of every carried weapon/armor/equipment item, pounds */
  carriedWeight: number;
  memorized: readonly MemorizedEntry[];
  spentWeaponSlots: number;
  spentNonweaponSlots: number;
  /** race item baseMovement, default 12 */
  baseMovement: number;
}
```

- [ ] **Step 2: Extend `src/data/actor/snapshot.ts`**

```ts
import type {
  ActorSnapshot, ClassEntry, DualClassState, EquippedArmor, EquippedShield, MemorizedEntry,
} from "../derive/character";
import type { ClassId, Race, WizardSchool } from "../../core/types";

interface ClassItemSystem {
  chassisId: ClassId; specialistSchool: WizardSchool | null; xp: number;
  hpRolls: readonly number[]; dualClassState: DualClassState | null; level?: number;
}
interface RaceItemSystem { raceId: Race; baseMovement?: number }
interface ArmorItemSystem {
  isShield: boolean; equipped: boolean; baseAc: number; shieldAcBonus: number; magicBonus: number;
}
interface PhysicalItemSystem { totalWeight?: number; equipped?: boolean }
interface ProfItemSystem { slotsInvested: number }
interface SpellcastingSystem {
  wizard: { memorized: readonly MemorizedEntry[] };
  priest: { memorized: readonly MemorizedEntry[] };
}

export function snapshotActor(actor: Actor.Implementation): ActorSnapshot {
  const doc = actor as unknown as {
    system: {
      abilities: Record<string, { score: number; exceptional: number | null }>;
      spellcasting: SpellcastingSystem;
    };
    items: Iterable<{ type: string; system: unknown }>;
  };
  const items = [...doc.items];
  const raceItem = items.find((i) => i.type === "race");

  const classes: ClassEntry[] = items
    .filter((i) => i.type === "class")
    .map((i) => {
      const s = i.system as ClassItemSystem;
      return {
        chassisId: s.chassisId, specialistSchool: s.specialistSchool, xp: s.xp,
        hpRolls: s.hpRolls, dualClassState: s.dualClassState, level: s.level ?? 1,
      };
    });

  const armorItems = items.filter((i) => i.type === "armor").map((i) => i.system as ArmorItemSystem);
  const bodyArmor = armorItems.find((a) => !a.isShield && a.equipped) ?? null;
  const shield = armorItems.find((a) => a.isShield && a.equipped) ?? null;
  const equippedArmor: EquippedArmor | null = bodyArmor
    ? { baseArmorAc: bodyArmor.baseAc, magicBonus: bodyArmor.magicBonus }
    : null;
  const equippedShield: EquippedShield | null = shield
    ? { shieldBonus: shield.shieldAcBonus, magicBonus: shield.magicBonus }
    : null;

  const carriedWeight = items
    .filter((i) => i.type === "weapon" || i.type === "armor" || i.type === "equipment")
    .reduce((sum, i) => sum + ((i.system as PhysicalItemSystem).totalWeight ?? 0), 0);

  const spentWeaponSlots = items
    .filter((i) => i.type === "weaponProficiency")
    .reduce((s, i) => s + (i.system as ProfItemSystem).slotsInvested, 0);
  const spentNonweaponSlots = items
    .filter((i) => i.type === "nonweaponProficiency")
    .reduce((s, i) => s + (i.system as ProfItemSystem).slotsInvested, 0);

  const memorized: MemorizedEntry[] = [
    ...doc.system.spellcasting.wizard.memorized,
    ...doc.system.spellcasting.priest.memorized,
  ];

  const a = doc.system.abilities;
  return {
    abilities: {
      str: a.str.score, dex: a.dex.score, con: a.con.score,
      int: a.int.score, wis: a.wis.score, cha: a.cha.score,
    },
    exceptionalStrengthPercentile: a.str.exceptional,
    race: raceItem ? (raceItem.system as RaceItemSystem).raceId : null,
    classes,
    equippedArmor,
    equippedShield,
    carriedWeight,
    memorized,
    spentWeaponSlots,
    spentNonweaponSlots,
    baseMovement: raceItem ? ((raceItem.system as RaceItemSystem).baseMovement ?? 12) : 12,
  };
}
```

- [ ] **Step 3: Update the `derive.test.ts` fixture**

The `base` snapshot and `fighterClass` fixtures need the new required fields:

```ts
const base: ActorSnapshot = {
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  exceptionalStrengthPercentile: null,
  race: null,
  classes: [],
  equippedArmor: null,
  equippedShield: null,
  carriedWeight: 0,
  memorized: [],
  spentWeaponSlots: 0,
  spentNonweaponSlots: 0,
  baseMovement: 12,
};
const fighterClass = {
  chassisId: "fighter" as const, specialistSchool: null, xp: 0,
  hpRolls: [] as number[], dualClassState: null, level: 1,
};
```

- [ ] **Step 4: Gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green (the 1c.3a `deriveCharacter` tests still pass with the widened fixture; `snapshot.ts` type-only additions add no coverage surface).

- [ ] **Step 5: Commit**

```bash
git add src/data/derive/character/snapshot.ts src/data/actor/snapshot.ts tests/data/derive/character/derive.test.ts
git commit -m "feat(data): grow ActorSnapshot for the pipeline (equipped armor, weight, memorized, prof slots)"
```

---

## Task 3: The eight pure step functions

**Files:**
- Create: `src/data/derive/character/{levels,hp,thac0,ac,saves,slots,proficiencies,encumbrance}.ts`
- Create: `tests/data/derive/character/{levels,hp,thac0,ac,saves,slots,proficiencies,encumbrance}.test.ts`
- Modify: `src/data/derive/character/index.ts`

**Interfaces:**
- Consumes: the engine functions in the table above; `ClassChassis`, `ClassGroup`, `ClassId`, `SaveCategory`, `EncumbranceCategory`, `DerivedAbilities` from `src/core/types`; `getChassis` from `src/core/classes/chassis`; `ClassEntry`, `MemorizedEntry`, `EquippedArmor`, `EquippedShield` from `./snapshot`.
- Produces (all pure functions):
  - `deriveClassLevels(classes: readonly ClassEntry[]): { chassisId: ClassId; level: number; canLevelUp: boolean }[]`
  - `characterHpMax(chassisId: ClassId, level: number, hpRolls: readonly number[], conHpAdjustment: number): number`
  - `deriveThac0(group: ClassGroup, level: number, strHitProb: number, dexMissileAdj: number): { base: number; melee: number; ranged: number }`
  - `deriveAc(input: { equippedArmor: EquippedArmor | null; equippedShield: EquippedShield | null; dexDefensiveAdj: number }): { normal: number; rearAttack: number; surprised: number; shieldless: number }`
  - `deriveSaves(input: { group: ClassGroup; level: number; race: Race; con: number; wisMagicalDefenseAdj: number; dexDefensiveAdj: number }): Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }>`
  - `deriveSpellSlots(input: { chassisId: ClassId; level: number; maxSpellLevelKnown: number | null; wisdomScore: number; wisdomBonusSpells: readonly number[]; specialist: boolean; memorized: readonly MemorizedEntry[] }): { wizard?: SlotRecord; priest?: SlotRecord }` where `type SlotRecord = Record<number, { max: number; used: number }>`
  - `deriveProficiencySlots(chassisId: ClassId, level: number, intBonusLanguages: number, spentWeapon: number, spentNonweapon: number): { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number }` where `type SlotBlock = { total: number; spent: number; available: number }`
  - `deriveEncumbrance(input: { carried: number; strengthScore: number; weightAllowance: number; maxPress: number; baseMove: number }): { carried: number; category: EncumbranceCategory; movementRate: number; penalty: { attackRoll: number; armorClass: number }; baseMove: number }`

- [ ] **Step 1: `levels.ts` + test**

```ts
// tests/data/derive/character/levels.test.ts
import { describe, expect, it } from "vitest";
import { deriveClassLevels } from "../../../../src/data/derive/character/levels";

const entry = (chassisId: any, xp: number, hpRolls: number[]) => ({
  chassisId, specialistSchool: null, xp, hpRolls, dualClassState: null, level: 0,
});

describe("deriveClassLevels", () => {
  it("resolves level + canLevelUp per class from XP and hp-roll count", () => {
    expect(deriveClassLevels([entry("fighter", 4000, [8, 6])])).toEqual([
      { chassisId: "fighter", level: 3, canLevelUp: true }, // level 3, only 2 rolls
    ]);
    expect(deriveClassLevels([entry("fighter", 4000, [8, 6, 7])])).toEqual([
      { chassisId: "fighter", level: 3, canLevelUp: false },
    ]);
  });
  it("empty class list -> empty", () => {
    expect(deriveClassLevels([])).toEqual([]);
  });
});
```

```ts
// src/data/derive/character/levels.ts
import { classItemCanLevelUp, classItemLevel } from "../class-item";
import type { ClassEntry } from "./snapshot";
import type { ClassId } from "../../../core/types";

/** §5.6 step 3 — per-class level + "owes a Hit-Die roll" flag, from the class item's own XP. */
export function deriveClassLevels(
  classes: readonly ClassEntry[],
): { chassisId: ClassId; level: number; canLevelUp: boolean }[] {
  return classes.map((c) => {
    const level = classItemLevel(c.chassisId, c.xp);
    return { chassisId: c.chassisId, level, canLevelUp: classItemCanLevelUp(c.chassisId, c.xp, c.hpRolls.length) };
  });
}
```

- [ ] **Step 2: `hp.ts` + test**

```ts
// tests/data/derive/character/hp.test.ts
import { describe, expect, it } from "vitest";
import { characterHpMax } from "../../../../src/data/derive/character/hp";

describe("characterHpMax", () => {
  it("sums entered rolls + CON adjustment per rolled level", () => {
    // fighter L3, CON adj +2, rolls [8,6,7] -> (8+6+7) + 3*2 = 27
    expect(characterHpMax("fighter", 3, [8, 6, 7], 2)).toBe(27);
  });
  it("un-rolled levels contribute 0 (Ruling HP1)", () => {
    // fighter L3, only 2 rolls entered -> (8+6) + 2*2 = 18
    expect(characterHpMax("fighter", 3, [8, 6], 2)).toBe(18);
  });
  it("adds the flat post-name-level bonus for rolled levels past the CON cutoff", () => {
    // fighter cutoff 9, hpAfterNameLevel 3; L11 with 11 rolls of 1 + CON adj 0
    // = Σrolls(11) + 9*0 (CON only to cutoff) + 2*3 (levels 10,11 flat) = 11 + 6 = 17
    expect(characterHpMax("fighter", 11, Array(11).fill(1), 0)).toBe(17);
  });
  it("CON adjustment only applies up to the cutoff level", () => {
    // fighter cutoff 9, L10, 10 rolls of 5, CON adj +2 -> Σ(50) + 9*2 + 1*3 = 50 + 18 + 3 = 71
    expect(characterHpMax("fighter", 10, Array(10).fill(5), 2)).toBe(71);
  });
});
```

```ts
// src/data/derive/character/hp.ts
import { getChassis } from "../../../core/classes/chassis";
import type { ClassId } from "../../../core/types";

/**
 * §5.6 step 4 — single-class HP maximum (PHB p.19, 47). Un-rolled levels add 0
 * (Ruling HP1). The CON hp adjustment applies once per rolled level up to
 * `conBonusCutoffLevel`; each rolled level PAST the cutoff instead adds the
 * class's flat `hpAfterNameLevel` (a positive per-level value on the chassis).
 */
export function characterHpMax(
  chassisId: ClassId,
  level: number,
  hpRolls: readonly number[],
  conHpAdjustment: number,
): number {
  const chassis = getChassis(chassisId);
  const rolledLevels = Math.min(hpRolls.length, level);
  const rolledSum = hpRolls.slice(0, rolledLevels).reduce((sum, roll) => sum + roll, 0);
  const conLevels = Math.min(rolledLevels, chassis.conBonusCutoffLevel);
  const flatLevels = Math.max(0, rolledLevels - chassis.conBonusCutoffLevel);
  return rolledSum + conLevels * conHpAdjustment + flatLevels * chassis.hpAfterNameLevel;
}
```

- [ ] **Step 3: `thac0.ts` + test**

```ts
// tests/data/derive/character/thac0.test.ts
import { describe, expect, it } from "vitest";
import { deriveThac0 } from "../../../../src/data/derive/character/thac0";

describe("deriveThac0", () => {
  it("base from the class table; melee subtracts STR hit prob, ranged subtracts DEX missile adj", () => {
    // warrior L7 base = 20 - 1*floor(6/1) = 14; STR 17 hitProb 1; DEX 16 missileAdj 1
    expect(deriveThac0("warrior", 7, 1, 1)).toEqual({ base: 14, melee: 13, ranged: 13 });
  });
  it("no ability bonuses -> melee == ranged == base", () => {
    expect(deriveThac0("wizard", 1, 0, 0)).toEqual({ base: 20, melee: 20, ranged: 20 });
  });
});
```

```ts
// src/data/derive/character/thac0.ts
import { thac0 } from "../../../core/classes/thac0";
import type { ClassGroup } from "../../../core/types";

/** §5.6 step 5 — THAC0. A positive to-hit modifier LOWERS THAC0 (descending scale). */
export function deriveThac0(
  group: ClassGroup,
  level: number,
  strHitProb: number,
  dexMissileAdj: number,
): { base: number; melee: number; ranged: number } {
  const base = thac0(group, level);
  return { base, melee: base - strHitProb, ranged: base - dexMissileAdj };
}
```

- [ ] **Step 4: `ac.ts` + test**

```ts
// tests/data/derive/character/ac.test.ts
import { describe, expect, it } from "vitest";
import { deriveAc } from "../../../../src/data/derive/character/ac";

describe("deriveAc", () => {
  it("chain (AC 5) + shield (1) + DEX 16 (defensiveAdj -1)", () => {
    const ac = deriveAc({
      equippedArmor: { baseArmorAc: 5, magicBonus: 0 },
      equippedShield: { shieldBonus: 1, magicBonus: 0 },
      dexDefensiveAdj: -1,
    });
    // normal: 5 - 1(shield) - 1(dex) = 3
    expect(ac.normal).toBe(3);
    // shieldless: 5 - 1(dex) = 4
    expect(ac.shieldless).toBe(4);
    // surprised (deny DEX): 5 - 1(shield) = 4
    expect(ac.surprised).toBe(4);
    // rearAttack (deny shield + deny beneficial DEX): 5
    expect(ac.rearAttack).toBe(5);
  });
  it("no armor -> AC 10 base", () => {
    const ac = deriveAc({ equippedArmor: null, equippedShield: null, dexDefensiveAdj: 0 });
    expect(ac.normal).toBe(10);
  });
});
```

```ts
// src/data/derive/character/ac.ts
import { armorClass } from "../../../core/combat/armor-class";
import type { EquippedArmor, EquippedShield } from "./snapshot";

export interface AcInput {
  equippedArmor: EquippedArmor | null;
  equippedShield: EquippedShield | null;
  /** dexterity(dex).defensiveAdj — AC-signed (negative = agile) */
  dexDefensiveAdj: number;
}

/** §5.6 step 6 — AC in four attack contexts (spec §5.1). */
export function deriveAc(input: AcInput): {
  normal: number;
  rearAttack: number;
  surprised: number;
  shieldless: number;
} {
  const baseArmorAc = input.equippedArmor?.baseArmorAc ?? 10;
  const shieldBonus = input.equippedShield?.shieldBonus ?? 0;
  const magicBonus = (input.equippedArmor?.magicBonus ?? 0) + (input.equippedShield?.magicBonus ?? 0);
  const common = { baseArmorAc, shieldBonus, dexDefensiveAdj: input.dexDefensiveAdj, magicBonus };
  return {
    normal: armorClass(common).value,
    shieldless: armorClass({ ...common, denyShield: true }).value,
    surprised: armorClass({ ...common, denyDexBonus: true }).value,
    rearAttack: armorClass({ ...common, denyShield: true, denyDexBonus: true }).value,
  };
}
```

- [ ] **Step 5: `saves.ts` + test**

```ts
// tests/data/derive/character/saves.test.ts
import { describe, expect, it } from "vitest";
import { deriveSaves } from "../../../../src/data/derive/character/saves";

describe("deriveSaves", () => {
  it("returns a target/rollModifier/effectiveTarget per category", () => {
    const s = deriveSaves({
      group: "warrior", level: 7, race: "human", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(Object.keys(s).sort()).toEqual(["bw", "pp", "ppd", "rsw", "spell"]);
    // warrior L7 breath-weapon base save = 12 (SAVE_MATRICES warrior band minLevel 7)
    expect(s.bw.target).toBe(12);
    expect(s.bw.effectiveTarget).toBe(s.bw.target - s.bw.rollModifier);
  });
  it("dwarf CON 16 gets the +3 racial bonus vs rod/staff/wand and spell", () => {
    const s = deriveSaves({
      group: "warrior", level: 1, race: "dwarf", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(s.rsw.rollModifier).toBeGreaterThan(0);
  });
});
```

```ts
// src/data/derive/character/saves.ts
import { saveTarget } from "../../../core/saves/composer";
import type { ClassGroup, Race, SaveCategory } from "../../../core/types";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

export interface SavesInput {
  group: ClassGroup;
  level: number;
  race: Race;
  /** adjusted CON score (for the racial Table 9 bonus) */
  con: number;
  /** wisdom(wis).magicalDefenseAdj */
  wisMagicalDefenseAdj: number;
  /** dexterity(dex).defensiveAdj — AC-signed */
  dexDefensiveAdj: number;
}

/** §5.6 step 7 — all five saving throws with the racial / ability layers. */
export function deriveSaves(
  input: SavesInput,
): Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }> {
  const out = {} as Record<SaveCategory, { target: number; rollModifier: number; effectiveTarget: number }>;
  for (const category of CATEGORIES) {
    const r = saveTarget({
      group: input.group,
      level: input.level,
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

- [ ] **Step 6: `slots.ts` + test**

```ts
// tests/data/derive/character/slots.test.ts
import { describe, expect, it } from "vitest";
import { deriveSpellSlots } from "../../../../src/data/derive/character/slots";

describe("deriveSpellSlots", () => {
  it("mage L5, INT 16 (maxSpellLevel 5): wizard record with max/used per level", () => {
    const r = deriveSpellSlots({
      chassisId: "mage", level: 5, maxSpellLevelKnown: 5, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false,
      memorized: [{ spellItemId: "a", spellLevel: 1 }, { spellItemId: "b", spellLevel: 1 }],
    });
    // PHB Table 21 wizard L5 = 4/2/1/0/0 …
    expect(r.wizard![1]).toEqual({ max: 4, used: 2 });
    expect(r.wizard![2]).toEqual({ max: 2, used: 0 });
    expect(r.priest).toBeUndefined();
  });
  it("cleric L3, WIS 15: priest record", () => {
    const r = deriveSpellSlots({
      chassisId: "cleric", level: 3, maxSpellLevelKnown: null, wisdomScore: 15,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false, memorized: [],
    });
    expect(r.priest![1].max).toBeGreaterThan(0);
    expect(r.wizard).toBeUndefined();
  });
  it("fighter -> neither", () => {
    const r = deriveSpellSlots({
      chassisId: "fighter", level: 5, maxSpellLevelKnown: null, wisdomScore: 10,
      wisdomBonusSpells: [], specialist: false, memorized: [],
    });
    expect(r).toEqual({});
  });
  it("paladin -> null (limited casters are a 1c.3b follow-up, Ruling CASTER1)", () => {
    const r = deriveSpellSlots({
      chassisId: "paladin", level: 9, maxSpellLevelKnown: null, wisdomScore: 14,
      wisdomBonusSpells: [1, 0, 0, 0, 0, 0, 0], specialist: false, memorized: [],
    });
    expect(r).toEqual({});
  });
});
```

```ts
// src/data/derive/character/slots.ts
import { getChassis } from "../../../core/classes/chassis";
import { priestSpellSlots } from "../../../core/magic/priest-slots";
import { wizardSpellSlots } from "../../../core/magic/wizard-slots";
import type { ClassId } from "../../../core/types";
import type { MemorizedEntry } from "./snapshot";

export type SlotRecord = Record<number, { max: number; used: number }>;

export interface SpellSlotInput {
  chassisId: ClassId;
  level: number;
  /** intelligence(int).maxSpellLevel — null for a non-wizard */
  maxSpellLevelKnown: number | null;
  wisdomScore: number;
  /** wisdom(wis).bonusPriestSpells (length 7) */
  wisdomBonusSpells: readonly number[];
  specialist: boolean;
  memorized: readonly MemorizedEntry[];
}

function toRecord(perLevel: readonly number[], memorized: readonly MemorizedEntry[]): SlotRecord {
  const out: SlotRecord = {};
  perLevel.forEach((max, i) => {
    const spellLevel = i + 1;
    out[spellLevel] = { max, used: memorized.filter((m) => m.spellLevel === spellLevel).length };
  });
  return out;
}

/**
 * §5.6 step 8 — spell slots for the two full-caster progressions (Ruling CASTER1).
 * Wizard: `casterType === "wizard"`. Priest: `casterType === "priest"` AND the
 * class uses the full priest table (`spellProgressionId === "priest"`, i.e.
 * Cleric / Druid). Paladin / Ranger / Bard return `{}`.
 */
export function deriveSpellSlots(input: SpellSlotInput): { wizard?: SlotRecord; priest?: SlotRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType === "wizard") {
    const slots = wizardSpellSlots({
      wizardLevel: input.level,
      maxSpellLevelKnown: input.maxSpellLevelKnown ?? 1,
      specialist: input.specialist,
    });
    return { wizard: toRecord(slots.perLevel, input.memorized) };
  }
  if (chassis.casterType === "priest" && chassis.spellProgressionId === "priest") {
    const slots = priestSpellSlots({
      priestLevel: input.level,
      wisdomScore: input.wisdomScore,
      wisdomBonusSpells: input.wisdomBonusSpells,
    });
    return { priest: toRecord(slots.perLevel, input.memorized) };
  }
  return {};
}
```

- [ ] **Step 7: `proficiencies.ts` + test**

```ts
// tests/data/derive/character/proficiencies.test.ts
import { describe, expect, it } from "vitest";
import { deriveProficiencySlots } from "../../../../src/data/derive/character/proficiencies";

describe("deriveProficiencySlots", () => {
  it("fighter L7: weapon/nonweapon totals from Table 34, minus spent", () => {
    // fighter weaponProficiencies {initial:4, levelsPerSlot:3}: 4 + floor(7/3) = 6
    // fighter nonweaponProficiencies {initial:3, levelsPerSlot:3}: 3 + floor(7/3) = 5
    const r = deriveProficiencySlots("fighter", 7, 0, 2, 1);
    expect(r.weapon).toEqual({ total: 6, spent: 2, available: 4 });
    expect(r.nonweapon).toEqual({ total: 5, spent: 1, available: 4 });
    expect(r.languagesMax).toBe(0);
  });
  it("INT bonus languages add to languagesMax", () => {
    expect(deriveProficiencySlots("mage", 1, 4, 0, 0).languagesMax).toBe(4);
  });
});
```

```ts
// src/data/derive/character/proficiencies.ts
import { getChassis } from "../../../core/classes/chassis";
import { nonweaponProficiencySlots, weaponProficiencySlots } from "../../../core/classes/progression";
import type { ClassId } from "../../../core/types";

export type SlotBlock = { total: number; spent: number; available: number };

/** §5.6 step 9 — weapon + non-weapon proficiency slot totals and the language cap. */
export function deriveProficiencySlots(
  chassisId: ClassId,
  level: number,
  intBonusLanguages: number,
  spentWeapon: number,
  spentNonweapon: number,
): { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } {
  const chassis = getChassis(chassisId);
  const wTotal = weaponProficiencySlots(chassis, level);
  const nTotal = nonweaponProficiencySlots(chassis, level);
  return {
    weapon: { total: wTotal, spent: spentWeapon, available: wTotal - spentWeapon },
    nonweapon: { total: nTotal, spent: spentNonweapon, available: nTotal - spentNonweapon },
    languagesMax: intBonusLanguages,
  };
}
```

- [ ] **Step 8: `encumbrance.ts` + test**

```ts
// tests/data/derive/character/encumbrance.test.ts
import { describe, expect, it } from "vitest";
import { deriveEncumbrance } from "../../../../src/data/derive/character/encumbrance";

describe("deriveEncumbrance", () => {
  it("STR 12 (allowance 40, maxPress 115), carrying 30 -> unencumbered, full move", () => {
    const r = deriveEncumbrance({ carried: 30, strengthScore: 12, weightAllowance: 40, maxPress: 115, baseMove: 12 });
    expect(r.category).toBe("unencumbered");
    expect(r.movementRate).toBe(12);
    expect(r.penalty).toEqual({ attackRoll: 0, armorClass: 0 });
  });
  it("carrying past the allowance -> a lighter category + reduced move + penalties", () => {
    const r = deriveEncumbrance({ carried: 60, strengthScore: 12, weightAllowance: 40, maxPress: 115, baseMove: 12 });
    expect(r.category).not.toBe("unencumbered");
    expect(r.movementRate).toBeLessThan(12);
  });
  it("carries baseMove through for the sheet", () => {
    expect(deriveEncumbrance({ carried: 0, strengthScore: 12, weightAllowance: 40, maxPress: 115, baseMove: 9 }).baseMove).toBe(9);
  });
});
```

```ts
// src/data/derive/character/encumbrance.ts
import { encumbranceCategory } from "../../../core/encumbrance/weight-allowance";
import { encumbrancePenalty, modifiedMovementRate } from "../../../core/encumbrance/movement";
import type { EncumbranceCategory } from "../../../core/types";

export interface EncumbranceInput {
  carried: number;
  strengthScore: number;
  /** strength(str).weightAllowance */
  weightAllowance: number;
  /** strength(str).maxPress */
  maxPress: number;
  baseMove: number;
}

/** §5.6 step 10 — carried-weight category, resulting movement rate, and the penalties. */
export function deriveEncumbrance(input: EncumbranceInput): {
  carried: number;
  category: EncumbranceCategory;
  movementRate: number;
  penalty: { attackRoll: number; armorClass: number };
  baseMove: number;
} {
  const category = encumbranceCategory({
    carried: input.carried,
    strengthScore: input.strengthScore,
    weightAllowance: input.weightAllowance,
    maxPress: input.maxPress,
  });
  const { rate } = modifiedMovementRate({
    baseMove: input.baseMove,
    carried: input.carried,
    strengthScore: input.strengthScore,
    weightAllowance: input.weightAllowance,
    maxPress: input.maxPress,
    rule: "category",
  });
  const penalty = encumbrancePenalty({ baseMove: input.baseMove, currentMove: rate });
  return { carried: input.carried, category, movementRate: rate, penalty, baseMove: input.baseMove };
}
```

- [ ] **Step 9: extend `src/data/derive/character/index.ts`**

```ts
export * from "./snapshot";
export * from "./derive";
export * from "./levels";
export * from "./hp";
export * from "./thac0";
export * from "./ac";
export * from "./saves";
export * from "./slots";
export * from "./proficiencies";
export * from "./encumbrance";
```

- [ ] **Step 10: Run all eight tests + gate**

Run: `npx vitest run tests/data/derive/character/` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green; each step file 100% (the tests above exercise every branch — the `casterType` switch in `slots.ts` has wizard / priest / neither / limited-caster cases; `deriveAc`'s `?? 10` / `?? 0` fallbacks have the "no armor" case).

- [ ] **Step 11: Commit**

```bash
git add src/data/derive/character tests/data/derive/character
git commit -m "feat(data): the eight character pipeline step functions (levels/hp/thac0/ac/saves/slots/prof/encumbrance)"
```

---

## Task 4: Orchestrate — grow `deriveCharacter`

**Files:**
- Modify: `src/data/derive/character/derive.ts`
- Modify: `tests/data/derive/character/derive.test.ts`

**Interfaces:**
- Consumes: the eight step functions (Task 3); `getChassis` (already imported); `strength`/`dexterity` etc. via `derived.abilities`.
- Produces: `CharacterDerived` gains `classes`, `hpMax`, `thac0`, `ac`, `saves`, `spellSlots`, `proficiencies`, `encumbrance`, `multiclassPending`.

- [ ] **Step 1: Write the e2e test cases** — append to `tests/data/derive/character/derive.test.ts`

```ts
describe("deriveCharacter — full single-class pipeline (§5.6 steps 3-10)", () => {
  const fighter7: ActorSnapshot = {
    abilities: { str: 17, dex: 16, con: 16, int: 10, wis: 10, cha: 10 }, // post-racial (human)
    exceptionalStrengthPercentile: null,
    race: "human",
    classes: [{ chassisId: "fighter", specialistSchool: null, xp: 70000, hpRolls: [10, 8, 9, 7, 10, 6, 8], dualClassState: null, level: 7 }],
    equippedArmor: { baseArmorAc: 5, magicBonus: 0 }, // chain
    equippedShield: { shieldBonus: 1, magicBonus: 0 },
    carriedWeight: 60,
    memorized: [],
    spentWeaponSlots: 3,
    spentNonweaponSlots: 2,
    baseMovement: 12,
  };

  it("levels, HP, THAC0, AC, saves, proficiencies, encumbrance", () => {
    const d = deriveCharacter(fighter7, DEFAULT_OPTIONAL_RULES);
    expect(d.classes).toEqual([{ chassisId: "fighter", level: 7, canLevelUp: false }]);
    // HP: Σ[10,8,9,7,10,6,8]=58 + 7*(CON16 warrior adj +2) = 58 + 14 = 72
    expect(d.hpMax).toBe(72);
    // THAC0: warrior L7 base 14; STR 17 hitProb 1; DEX 16 missile +1
    expect(d.thac0).toEqual({ base: 14, melee: 13, ranged: 13 });
    // AC normal: chain 5 - shield 1 - DEX16 defensiveAdj 1 = 3
    expect(d.ac.normal).toBe(3);
    // warrior L7 breath-weapon save target (SAVE_MATRICES warrior band minLevel 7)
    expect(d.saves.bw.target).toBe(12);
    // weapon slots: 4 + floor(7/3) = 6; spent 3 -> available 3
    expect(d.proficiencies.weapon).toEqual({ total: 6, spent: 3, available: 3 });
    // 60 lb vs STR 17 allowance -> a category; movementRate <= 12
    expect(d.encumbrance.movementRate).toBeLessThanOrEqual(12);
    expect(d.multiclassPending).toBe(false);
  });

  it("a 0-class actor: level-dependent blocks are null", () => {
    const d = deriveCharacter({ ...fighter7, classes: [] }, DEFAULT_OPTIONAL_RULES);
    expect(d.classes).toEqual([]);
    expect(d.thac0).toBeNull();
    expect(d.saves).toBeNull();
    expect(d.spellSlots).toEqual({});
    expect(d.hpMax).toBe(0);
    expect(d.multiclassPending).toBe(false);
  });

  it("mage L5 INT 16 -> wizard spell slots", () => {
    const mage: ActorSnapshot = {
      ...fighter7,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      classes: [{ chassisId: "mage", specialistSchool: null, xp: 40000, hpRolls: [4, 3, 4, 2, 3], dualClassState: null, level: 5 }],
      equippedArmor: null, equippedShield: null,
    };
    const d = deriveCharacter(mage, DEFAULT_OPTIONAL_RULES);
    expect(d.spellSlots.wizard![1].max).toBe(4);
  });

  it("two classes -> derives from the first + flags multiclassPending", () => {
    const d = deriveCharacter({
      ...fighter7,
      classes: [
        { chassisId: "fighter", specialistSchool: null, xp: 70000, hpRolls: [10], dualClassState: null, level: 7 },
        { chassisId: "mage", specialistSchool: null, xp: 40000, hpRolls: [4], dualClassState: null, level: 5 },
      ],
    }, DEFAULT_OPTIONAL_RULES);
    expect(d.multiclassPending).toBe(true);
    expect(d.classes).toHaveLength(2);
    expect(d.thac0!.base).toBe(14); // fighter (classes[0]) table
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/data/derive/character/derive.test.ts`
Expected: FAIL — `CharacterDerived` has no `classes` / `hpMax` / etc.

- [ ] **Step 3: Grow `src/data/derive/character/derive.ts`**

```ts
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type { ClassId, DerivedAbilities, EncumbranceCategory, SaveCategory } from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import type { ActorSnapshot } from "./snapshot";
import { deriveClassLevels } from "./levels";
import { characterHpMax } from "./hp";
import { deriveThac0 } from "./thac0";
import { deriveAc } from "./ac";
import { deriveSaves } from "./saves";
import { deriveSpellSlots, type SlotRecord } from "./slots";
import { deriveProficiencySlots, type SlotBlock } from "./proficiencies";
import { deriveEncumbrance } from "./encumbrance";

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
    carried: number; category: EncumbranceCategory; movementRate: number;
    penalty: { attackRoll: number; armorClass: number }; baseMove: number;
  };
  multiclassPending: boolean;
}

export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");
  // scores are already racially adjusted (prepareBaseData); race:"human" makes
  // deriveAbilities' internal applyRacialDeltas a no-op; halflings get no
  // exceptional Strength (enforced here since the race hint is dropped).
  const percentile = snapshot.race === "halfling" ? null : snapshot.exceptionalStrengthPercentile;
  const abilities = deriveAbilities(snapshot.abilities, {
    race: "human",
    isWarrior,
    options,
    exceptionalStrengthPercentile: percentile,
  });

  const classes = deriveClassLevels(snapshot.classes);
  const primary = snapshot.classes[0] ?? null;
  const primaryChassis = primary ? getChassis(primary.chassisId) : null;

  const hpMax = primary
    ? characterHpMax(primary.chassisId, classes[0].level, primary.hpRolls, abilities.con.hpAdjustment)
    : 0;

  const thac0 = primaryChassis
    ? deriveThac0(primaryChassis.group, classes[0].level, abilities.str.hitProb, abilities.dex.missileAttackAdj)
    : null;

  const ac = deriveAc({
    equippedArmor: snapshot.equippedArmor,
    equippedShield: snapshot.equippedShield,
    dexDefensiveAdj: abilities.dex.defensiveAdj,
  });

  const saves = primaryChassis
    ? deriveSaves({
        group: primaryChassis.group,
        level: classes[0].level,
        race: snapshot.race ?? "human",
        con: snapshot.abilities.con,
        wisMagicalDefenseAdj: abilities.wis.magicalDefenseAdj,
        dexDefensiveAdj: abilities.dex.defensiveAdj,
      })
    : null;

  const spellSlots = primary
    ? deriveSpellSlots({
        chassisId: primary.chassisId,
        level: classes[0].level,
        maxSpellLevelKnown: abilities.int.maxSpellLevel,
        wisdomScore: snapshot.abilities.wis,
        wisdomBonusSpells: abilities.wis.bonusPriestSpells,
        specialist: primary.specialistSchool !== null,
        memorized: snapshot.memorized,
      })
    : {};

  const proficiencies = primary
    ? deriveProficiencySlots(
        primary.chassisId, classes[0].level, abilities.int.bonusLanguages,
        snapshot.spentWeaponSlots, snapshot.spentNonweaponSlots,
      )
    : null;

  const encumbrance = deriveEncumbrance({
    carried: snapshot.carriedWeight,
    strengthScore: snapshot.abilities.str,
    weightAllowance: abilities.str.weightAllowance,
    maxPress: abilities.str.maxPress,
    baseMove: snapshot.baseMovement,
  });

  return {
    abilities,
    classes,
    hpMax,
    thac0,
    ac,
    saves,
    spellSlots,
    proficiencies,
    encumbrance,
    multiclassPending: snapshot.classes.length > 1,
  };
}
```

- [ ] **Step 4: Run — verify green + full coverage**

Run: `npx vitest run tests/data/derive/character/derive.test.ts` → PASS
Run: `npm run test:coverage`
Expected: `derive.ts` 100% — the `primary ? … : null/0/{}` ternaries all have both arms hit (the fighter-7, 0-class, mage, and two-class cases); `race === "halfling"` — **add a one-line halfling case** if not already present (a `{ ...fighter7, race: "halfling" }` assertion on `abilities.scores` suffices).

- [ ] **Step 5: Commit**

```bash
git add src/data/derive/character/derive.ts tests/data/derive/character/derive.test.ts
git commit -m "feat(data): deriveCharacter orchestrates §5.6 steps 3-10 (single-class)"
```

---

## Task 5: Write the derived values through to `system.*`

**Files:**
- Modify: `src/data/actor/base-actor.ts` (the `deriveAndCache` helper — fill the assignments Task 1 stubbed)

**Interfaces:**
- Consumes: `CharacterDerived` (Task 4, now complete).

- [ ] **Step 1: Fill `deriveAndCache` in `src/data/actor/base-actor.ts`**

Replace the minimal (ability-mods-only) body from Task 1 with the full write-through shown in Task 1 Step 5 — every `sys.*` assignment. Guard the caster writes (`if (derived.spellSlots.wizard) …`), the `thac0` / `saves` / `proficiencies` writes (`if (derived.thac0) …`), and leave the schema-initialised defaults in place when a block is `null`.

- [ ] **Step 2: Gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. `deriveAndCache` is Foundry-layer (not coverage-gated); `npm run build` bundles it; the pure `deriveCharacter` + step tests carry the correctness.

- [ ] **Step 3: Commit**

```bash
git add src/data/actor/base-actor.ts
git commit -m "feat(data): cache the full character pipeline onto system.* (spec §5.1 paths)"
```

---

## Self-Review

**1. Spec coverage.**

| §5.6 step / §5.1 derived field | Task |
|---|---|
| step 2 ability mods (unchanged) | Task 1 (F3 keeps it) |
| step 3 `classes` summary + `canLevelUp` | Task 3 `levels.ts` → Task 4 |
| step 4 `attributes.hp.max` | Task 3 `hp.ts` → Task 4/5 |
| step 5 `attributes.thac0` `{base,melee,ranged}` | Task 3 `thac0.ts` → Task 4/5 |
| step 6 `attributes.ac` `{normal,rearAttack,surprised,shieldless}` | Task 3 `ac.ts` → Task 4/5 |
| step 7 `saves.<k>` | Task 3 `saves.ts` → Task 4/5 |
| step 8 `spellcasting.{wizard,priest}.slots` | Task 3 `slots.ts` → Task 4/5 (CASTER1: full casters only) |
| step 9 `proficiencies.*` + `languagesKnown.max` | Task 3 `proficiencies.ts` → Task 4/5 |
| step 10 `attributes.encumbrance` + `attributes.movement` | Task 3 `encumbrance.ts` → Task 4/5 |
| §5.6 racial adjustment in `prepareBaseData` (F3) | Task 1 |
| §5.1 `spellcasting.*.memorized` | Task 1 (schema) |
| §5.6 step 1 `resolveMulticlass` / full aggregation | **Plan 1c.3c** (Ruling S1) |
| `creature` derive path, `ActiveEffect` `adnd2e` subtype, two-pass split | **Plan 1c.3d** (Ruling S1) |

Gaps: Paladin/Ranger/Bard spell slots (Ruling CASTER1 — a follow-up); `attributes.hp.max` for a warrior CON cap at exactly 18 relies on `constitution(score, isWarrior)` which the engine already caps — `characterHpMax` just multiplies the returned `hpAdjustment`, correct.

**2. Placeholder scan.** No "TBD"/"handle edge cases". `hp.ts` Step 2 has a "clean this up" note with the exact simplification (`chassis.hpAfterNameLevel` is the per-level value; drop the `hitDice` call) — the four tests are the binding contract, so this is a guided simplification, not a placeholder.

**3. Type consistency.**
- `ActorSnapshot` fields — Task 2 defines; Task 3 step functions and Task 4 `deriveCharacter` consume by exact name (`equippedArmor`, `equippedShield`, `carriedWeight`, `memorized`, `spentWeaponSlots`, `spentNonweaponSlots`, `baseMovement`); Task 2's `snapshotActor` produces them.
- `ClassEntry.level` — Task 2 adds it; Task 4 reads `classes[0].level` from the `deriveClassLevels` result (not the snapshot's `.level`, which is the class item's own — used only as the schema-cached value).
- `SlotRecord` / `SlotBlock` — Task 3 `slots.ts` / `proficiencies.ts` define; Task 4 `CharacterDerived` imports them; Task 5 writes them.
- `deriveSaves` takes the **unadjusted-for-derive** `con` = `snapshot.abilities.con` (the post-*racial* score, which is what `racialSaveBonus`'s Table 9 wants) — consistent between Task 3 (`SavesInput.con` doc) and Task 4 (passes `snapshot.abilities.con`).
- `deriveAndCache` write paths match spec §5.1 exactly and the SCH1 schema fields Task 1 adds.

**4. Execution order.** Task 1 (F3 + schema + minimal `deriveAndCache`) → Task 2 (`ActorSnapshot`) → Task 3 (step functions, need the grown snapshot types) → Task 4 (`deriveCharacter` orchestration, needs the step functions) → Task 5 (fill `deriveAndCache`, needs the grown `CharacterDerived`). Strictly linear; each task's gate is green standalone.

**5. Dev-world smoke check (at merge — the Foundry layer has no unit tests).** Link the world. Create a `character`, add a `race` (dwarf), a `class` (fighter, set `xp` to ~70000 and enter 7 `hpRolls`), an `armor` (chain, equipped), an `armor` with `isShield` (equipped). Console:
`const s = game.actors.getName("…").system;`
- `s.abilities.con.score` — 14 → **15** (dwarf +1, from `prepareBaseData`).
- `s.attributes.hp.max` — Σ rolls + 7×CON-adj.
- `s.attributes.thac0.melee` / `.ranged` — ≤ `.base`.
- `s.attributes.ac.normal` — chain 5 − shield 1 − DEX adj.
- `s.saves.spell.target` — a number ~13.
- `s.proficiencies.weapon.total` — 6.
- `s.attributes.encumbrance.category` / `s.attributes.movement.current`.
Swap the class to a `mage` (level 5, INT 16) → `s.spellcasting.wizard.slots[1].max` is 4.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-adnd2e-1c3b-derive-pipeline.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — tasks in this session with checkpoints.

**Which approach?**
