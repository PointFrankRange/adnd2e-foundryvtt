# AD&D 2E — Plan 1c.2: Item DataModels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the nine Foundry Item DataModels for the adnd2e system — thin `TypeDataModel` subclasses whose every computation delegates to pure, 100%-tested helpers — and register them on `CONFIG.Item.dataModels`.

**Architecture:** `class` and `race` items reference the engine by id (`chassisId` / `raceId`) and carry only what the engine lacks plus instance fields; the other seven carry their full authored schema (spec §5.4). All real logic lives in pure `src/data/derive/**` + `src/data/item/{choices,subtypes}.ts`, which join `src/core/`'s Foundry-free + 100%-Vitest zone. The `defineSchema()` bodies are purely declarative (no logic) and verified in a linked dev world.

**Tech Stack:** TypeScript 5 strict, `fvtt-types` v13-beta, Vite 8 lib build, Vitest 5, ESLint 10 flat config, Foundry VTT **system** (`foundry.abstract.TypeDataModel`, `foundry.data.fields`).

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §5.4 (Item schemas), §5.5 (ActiveEffect — not in this plan), §4 + §4.1 (two-layer architecture + layer contract). The `class`/`race` schemas below **deviate** from §5.4's full-copy form (see Ruling D1).

## Global Constraints

- **`src/core/**`, `src/data/derive/**`, `src/data/item/choices.ts`, `src/data/item/subtypes.ts`, and their tests import NOTHING from `foundry` / `fvtt-types` / `game` / `CONFIG` / `Hooks` / the DOM.** They MAY import from `src/core/**`. Enforced by `tsconfig.core.json` (`types: []`) in `npm run typecheck` and by the ESLint `no-restricted-globals` / `no-restricted-imports` block.
- **The Item DataModel classes (`src/data/item/*.ts` except `choices.ts`/`subtypes.ts`) and `src/data/common/**`** are Foundry-layer — they use `foundry.data.fields` and are checked only by the base `tsconfig.json`.
- **`defineSchema()` bodies contain no logic** — every choice list comes from `src/data/item/choices.ts`, every fragment from `src/data/common/`. No conditionals, no loops, no computed values.
- **`core/` never reads `game.settings`**; DataModels never construct a `Roll` (spec §4.1). Neither applies directly here (no derived data needs the toggle bag yet) but holds.
- **No rulebook prose / spell text / stat blocks.** `spell.description` and `classFeature.description` ship empty.
- Coverage gate (`npm run test:coverage`): **100%** lines/statements/functions and **≥90%** branches on `src/core/**` + `src/config.ts` + `src/settings/registry.ts` + `src/data/derive/**` + `src/data/item/choices.ts` + `src/data/item/subtypes.ts`.
- Full gate = `npm run typecheck && npm run lint && npm run test:coverage && npm run build` (mirrors `.github/workflows/ci.yml`).
- **Do NOT run `npm install` or `npm run format` or any `prettier` command.** Hand-format to satisfy the linter. Vitest cache flake → `rm -rf node_modules/.vite node_modules/.vitest node_modules/.cache` and retry.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Foundry compatibility: `minimum: "13"`, `verified: "14"`.

## Rulings carried from brainstorming

- **D1 — `class` and `race` items reference the engine by id.** `class` carries `chassisId: ClassId`, `specialistSchool: WizardSchool | null`, `kit: string | null`, `grantedFeatures: string[]`, and the instance fields `xp` / `hpRolls` / `dualClassState`. `race` carries `raceId: Race`, `size`, `baseMovement`, `infravision`, `classLevelLimits`, `allowedClasses`, `allowedMulticlass`, `bonusLanguages`, `grantedFeatures`. Neither copies a field the engine already holds (`group`, `hitDie`, `xpThresholds`, `armorAllowed`, ability adjustments, thief adjustments, save bonuses …). This supersedes spec §5.4's full-copy `class`/`race` schemas and its `TableRef` fields — recorded as a spec deviation, spec doc unchanged.
- **D2 — Item DataModels are thin.** Only item-local derived data (no actor context): `physical-item` total weight, `armor` AC contribution, `class`-item level from its own `xp`, and the `weapon` → `WeaponData` projection. Every one is a pure `src/data/derive/` function. THAC0 / AC total / saves / slots / encumbrance category are actor-context — Plan 1c.3.
- **D3 — no custom `Item` document subclass.** `TypeDataModel.prepareDerivedData()` runs without one. `src/documents/item.ts` (getRollData, use()) lands in 1c.3 with `documents/actor.ts`.
- **D4 — loose schema typing is acceptable.** Per-model strict `Schema` types are NOT required; `foundry.abstract.TypeDataModel` with a loose schema is fine for 1c.2 (sheets are stubs until 1c.4 / SP2). The acceptance criterion for the model tasks is `npm run typecheck && npm run lint && npm run build` all green.

---

## File Structure

**Created — pure (join the Foundry-free + coverage gate):**
- `src/data/item/subtypes.ts` — `ITEM_SUBTYPES: readonly ItemSubtype[]` (the 9 machine names) + `type ItemSubtype`.
- `src/data/item/choices.ts` — the field-choice arrays (`CLASS_IDS`, `RACE_IDS`, `WIZARD_SCHOOLS`, `SPELL_SCHOOLS`, `SPHERE_NAMES`, `ABILITY_KEYS`, `DAMAGE_TYPES`, `WEAPON_SIZES`, `WEAPON_CATEGORIES`, `NONWEAPON_GROUPS`, `CREATURE_SIZES`, `CASTER_CLASSES`, `SAVING_THROW_KINDS`, `DUAL_CLASS_STATES`, `FEATURE_SOURCE_TYPES`, `FEATURE_ACTIVATIONS`) — each a `readonly string[]` drift-checked against its `core/types.ts` union.
- `src/data/derive/physical-item.ts` — `totalWeight({ weight, quantity })`.
- `src/data/derive/armor.ts` — `armorAcContribution({ baseAc, magicBonus, isShield, shieldAcBonus })`.
- `src/data/derive/class-item.ts` — `classItemLevel(chassisId, xp)`, `classItemCanLevelUp(chassisId, xp, hpRollsLength)`.
- `src/data/derive/weapon.ts` — `toWeaponData(source)` → the engine's `WeaponData` shape.

**Created — Foundry layer (base `tsconfig.json` only):**
- `src/data/common/fields.ts` — `htmlField()`, `identifierField()`, `currencySchema()`.
- `src/data/common/physical-item.ts` — `physicalItemSchema()`.
- `src/data/item/base-item.ts` — `abstract class Adnd2eItemModel extends foundry.abstract.TypeDataModel`.
- `src/data/item/equipment.ts` `class.ts` `race.ts` `weapon.ts` `armor.ts` `spell.ts` `weapon-proficiency.ts` `nonweapon-proficiency.ts` `class-feature.ts` — one `TypeDataModel` subclass each.
- `src/data/item/index.ts` — `ITEM_DATA_MODELS: Record<ItemSubtype, typeof Adnd2eItemModel>`.

**Created — tests:**
- `tests/data/subtypes.test.ts`, `tests/data/choices.test.ts`
- `tests/data/derive/physical-item.test.ts`, `armor.test.ts`, `class-item.test.ts`, `weapon.test.ts`

**Modified:**
- `src/system.ts` — init hook: `CONFIG.Item.dataModels = ITEM_DATA_MODELS`.
- `src/types/global.d.ts` — augment `DataModelConfig` with `Item: { … }`.
- `tsconfig.core.json` — `include` gains `src/data/derive`, `src/data/item/subtypes.ts`, `src/data/item/choices.ts`.
- `vitest.config.ts` — `coverage.include` gains the same three.
- `eslint.config.js` — the Foundry-globals `ignores` array and the pure-zone `files` array both gain `src/data/derive/**`, `src/data/item/subtypes.ts`, `src/data/item/choices.ts`, `tests/data/**`.

---

## Task 1: Pure enum modules — `subtypes.ts` + `choices.ts`

**Files:**
- Create: `src/data/item/subtypes.ts`, `src/data/item/choices.ts`
- Create: `tests/data/subtypes.test.ts`, `tests/data/choices.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js`

**Interfaces:**
- Consumes: `ClassId`, `Race`, `AbilityKey`, `ClassGroup`, `SphereName`, `SpellSchool`, `WizardSchool`, `CreatureSize`, `NonweaponGroup` from `src/core/types.ts`; `DamageType`, `WeaponSize`, `WeaponCategory` from `src/core/weapons/data.ts`.
- Produces:
  - `type ItemSubtype = "class" | "race" | "weapon" | "armor" | "equipment" | "spell" | "weaponProficiency" | "nonweaponProficiency" | "classFeature"`
  - `const ITEM_SUBTYPES: readonly ItemSubtype[]`
  - the choice arrays listed under Step 3 (each `readonly string[]`)

- [ ] **Step 1: Write the failing tests**

`tests/data/subtypes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import manifest from "../../system.json";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";

describe("ITEM_SUBTYPES", () => {
  it("matches system.json documentTypes.Item exactly", () => {
    const declared = Object.keys(
      (manifest as unknown as { documentTypes: { Item: Record<string, unknown> } }).documentTypes.Item,
    ).sort();
    expect([...ITEM_SUBTYPES].sort()).toEqual(declared);
  });

  it("has no duplicates", () => {
    expect(new Set(ITEM_SUBTYPES).size).toBe(ITEM_SUBTYPES.length);
  });
});
```

`tests/data/choices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CLASS_IDS, RACE_IDS, ABILITY_KEYS, SPHERE_NAMES, SPELL_SCHOOLS, WIZARD_SCHOOLS,
  DAMAGE_TYPES, WEAPON_SIZES, WEAPON_CATEGORIES, NONWEAPON_GROUPS, CREATURE_SIZES,
  CASTER_CLASSES, SAVING_THROW_KINDS, DUAL_CLASS_STATES, FEATURE_SOURCE_TYPES, FEATURE_ACTIVATIONS,
} from "../../src/data/item/choices";

describe("item schema choice arrays match the engine unions", () => {
  it("CLASS_IDS = the 8 ClassId", () => {
    expect([...CLASS_IDS].sort()).toEqual(
      ["bard", "cleric", "druid", "fighter", "mage", "paladin", "ranger", "thief"],
    );
  });
  it("RACE_IDS = the 6 Race", () => {
    expect([...RACE_IDS].sort()).toEqual(["dwarf", "elf", "gnome", "half-elf", "halfling", "human"]);
  });
  it("ABILITY_KEYS", () => {
    expect([...ABILITY_KEYS].sort()).toEqual(["cha", "con", "dex", "int", "str", "wis"]);
  });
  it("SPHERE_NAMES has all 16", () => {
    expect(SPHERE_NAMES).toHaveLength(16);
    expect(SPHERE_NAMES).toContain("all");
    expect(SPHERE_NAMES).toContain("necromantic");
  });
  it("SPELL_SCHOOLS = 8 specialist schools + lesser-divination + wild (10)", () => {
    expect([...SPELL_SCHOOLS].sort()).toEqual(
      ["abjuration", "alteration", "conjuration", "divination", "enchantment",
       "illusion", "invocation", "lesser-divination", "necromancy", "wild"].sort(),
    );
  });
  it("WIZARD_SCHOOLS = the 8 specialist schools", () => {
    expect(WIZARD_SCHOOLS).toHaveLength(8);
    expect(WIZARD_SCHOOLS).not.toContain("wild");
  });
  it("DAMAGE_TYPES matches the weapon DamageType union", () => {
    expect([...DAMAGE_TYPES].sort()).toEqual(
      ["bludgeoning", "piercing", "piercing-bludgeoning", "piercing-slashing", "slashing"].sort(),
    );
  });
  it("WEAPON_SIZES / WEAPON_CATEGORIES", () => {
    expect(WEAPON_SIZES).toEqual(["S", "M", "L"]);
    expect([...WEAPON_CATEGORIES].sort()).toEqual(["bow", "crossbow", "melee", "thrown"]);
  });
  it("NONWEAPON_GROUPS", () => {
    expect([...NONWEAPON_GROUPS].sort()).toEqual(["general", "priest", "rogue", "warrior", "wizard"]);
  });
  it("CREATURE_SIZES", () => {
    expect(CREATURE_SIZES).toEqual(["tiny", "small", "medium", "large", "huge", "gargantuan"]);
  });
  it("small fixed lists", () => {
    expect([...CASTER_CLASSES].sort()).toEqual(["priest", "wizard"]);
    expect([...SAVING_THROW_KINDS].sort()).toEqual(["half", "negates", "none", "special"]);
    expect([...DUAL_CLASS_STATES].sort()).toEqual(["active", "primary", "suppressed"]);
    expect([...FEATURE_SOURCE_TYPES].sort()).toEqual(["class", "kit", "other", "race"]);
    expect([...FEATURE_ACTIVATIONS].sort()).toEqual(["action", "daily", "passive"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data/subtypes.test.ts tests/data/choices.test.ts`
Expected: FAIL — `Cannot find module '../../src/data/item/subtypes'`.

- [ ] **Step 3: Create `src/data/item/subtypes.ts`**

```ts
// The nine Item sub-types this system registers (must equal system.json
// documentTypes.Item — asserted in tests/data/subtypes.test.ts).
export type ItemSubtype =
  | "class"
  | "race"
  | "weapon"
  | "armor"
  | "equipment"
  | "spell"
  | "weaponProficiency"
  | "nonweaponProficiency"
  | "classFeature";

export const ITEM_SUBTYPES: readonly ItemSubtype[] = [
  "class",
  "race",
  "weapon",
  "armor",
  "equipment",
  "spell",
  "weaponProficiency",
  "nonweaponProficiency",
  "classFeature",
];
```

- [ ] **Step 4: Create `src/data/item/choices.ts`**

```ts
// The enumerations the Item DataModel schemas validate against. Kept here as
// plain arrays (not in the schema files) so they are unit-testable against the
// engine unions — defineSchema() imports these and stays logic-free.
import type { AbilityKey, ClassId, CreatureSize, NonweaponGroup, Race, SphereName, WizardSchool } from "../../core/types";
import type { DamageType, WeaponCategory, WeaponSize } from "../../core/weapons/data";

export const CLASS_IDS: readonly ClassId[] = [
  "fighter", "mage", "cleric", "thief", "paladin", "ranger", "druid", "bard",
];

export const RACE_IDS: readonly Race[] = [
  "human", "dwarf", "elf", "gnome", "half-elf", "halfling",
];

export const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const WIZARD_SCHOOLS: readonly WizardSchool[] = [
  "abjuration", "alteration", "conjuration", "divination",
  "enchantment", "illusion", "invocation", "necromancy",
];

/** The nine schools of magic + Wild (= core `SpellSchool`). */
export const SPELL_SCHOOLS: readonly string[] = [...WIZARD_SCHOOLS, "lesser-divination", "wild"];

export const SPHERE_NAMES: readonly SphereName[] = [
  "all", "animal", "astral", "charm", "combat", "creation", "divination", "elemental",
  "guardian", "healing", "necromantic", "plant", "protection", "summoning", "sun", "weather",
];

export const DAMAGE_TYPES: readonly DamageType[] = [
  "slashing", "piercing", "bludgeoning", "piercing-slashing", "piercing-bludgeoning",
];

export const WEAPON_SIZES: readonly WeaponSize[] = ["S", "M", "L"];

export const WEAPON_CATEGORIES: readonly WeaponCategory[] = ["melee", "thrown", "bow", "crossbow"];

export const NONWEAPON_GROUPS: readonly NonweaponGroup[] = [
  "general", "warrior", "wizard", "priest", "rogue",
];

export const CREATURE_SIZES: readonly CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];

export const CASTER_CLASSES: readonly string[] = ["wizard", "priest"];
export const SAVING_THROW_KINDS: readonly string[] = ["none", "negates", "half", "special"];
export const DUAL_CLASS_STATES: readonly string[] = ["primary", "suppressed", "active"];
export const FEATURE_SOURCE_TYPES: readonly string[] = ["class", "kit", "race", "other"];
export const FEATURE_ACTIVATIONS: readonly string[] = ["passive", "action", "daily"];
```

- [ ] **Step 5: Wire the pure zone**

`tsconfig.core.json` — add the two files that exist after this task (Task 2 adds `"src/data/derive"`):
```jsonc
  "include": ["src/core", "tests/core", "src/config.ts", "src/settings/registry.ts", "src/data/item/subtypes.ts", "src/data/item/choices.ts"]
```

`vitest.config.ts` — `coverage.include` becomes:
```ts
      include: [
        "src/core/**/*.ts", "src/config.ts", "src/settings/registry.ts",
        "src/data/item/subtypes.ts", "src/data/item/choices.ts",
      ],
```

`eslint.config.js` — in the block commented `// Foundry globals — available everywhere EXCEPT the framework-free engine.` add to `ignores`:
`"src/data/derive/**", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "tests/data/**"`
and in the block commented `// The engine must stay pure — no Foundry globals under core/.` add to `files`:
`"src/data/derive/**/*.ts", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "tests/data/**/*.ts"`

- [ ] **Step 6: Run tests + gate**

Run: `npx vitest run tests/data/` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green. `subtypes.ts` + `choices.ts` at 100% coverage (arrays execute on import; the spread in `SPELL_SCHOOLS` executes). `tsc -p tsconfig.core.json` proves both are Foundry-free.

- [ ] **Step 7: Commit**

```bash
git add src/data/item/subtypes.ts src/data/item/choices.ts tests/data/ tsconfig.core.json vitest.config.ts eslint.config.js
git commit -m "feat(data): item subtype + schema-choice enums, drift-checked against the engine"
```

---

## Task 2: Pure derive layer — `src/data/derive/**`

**Files:**
- Create: `src/data/derive/physical-item.ts`, `src/data/derive/armor.ts`, `src/data/derive/class-item.ts`, `src/data/derive/weapon.ts`
- Create: `tests/data/derive/physical-item.test.ts`, `armor.test.ts`, `class-item.test.ts`, `weapon.test.ts`
- Modify: `tsconfig.core.json`, `vitest.config.ts` (add `src/data/derive`)

**Interfaces:**
- Consumes: `getChassis` from `src/core/classes/chassis.ts`; `levelForXp` from `src/core/classes/progression.ts`; `WeaponData`, `WeaponCategory`, `WeaponSize`, `DamageType`, `WeaponRange` from `src/core/weapons/data.ts`; `ClassId` from `src/core/types.ts`.
- Produces:
  - `totalWeight(input: { weight: number; quantity: number }): number`
  - `armorAcContribution(input: { baseAc: number; magicBonus: number; isShield: boolean; shieldAcBonus: number }): { acBonus: number }`
  - `classItemLevel(chassisId: ClassId, xp: number): number`
  - `classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number): boolean`
  - `toWeaponData(source: WeaponSource): WeaponData` where `interface WeaponSource { name: string; category: WeaponCategory; damageVsSM: string | null; damageVsL: string | null; damageType: DamageType | null; speedFactor: number; weight: number; size: WeaponSize; rateOfFire: string | null; range: WeaponRange | null }`

- [ ] **Step 1: Write the failing tests**

`tests/data/derive/physical-item.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { totalWeight } from "../../../src/data/derive/physical-item";

describe("totalWeight", () => {
  it("multiplies weight by quantity", () => {
    expect(totalWeight({ weight: 3, quantity: 4 })).toBe(12);
    expect(totalWeight({ weight: 0.5, quantity: 2 })).toBe(1);
  });
  it("clamps negative weight or quantity to zero", () => {
    expect(totalWeight({ weight: -3, quantity: 4 })).toBe(0);
    expect(totalWeight({ weight: 3, quantity: -1 })).toBe(0);
  });
});
```

`tests/data/derive/armor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { armorAcContribution } from "../../../src/data/derive/armor";

describe("armorAcContribution", () => {
  it("body armor: baseAc minus the magic bonus (magic lowers AC)", () => {
    expect(armorAcContribution({ baseAc: 5, magicBonus: 0, isShield: false, shieldAcBonus: 0 }).acBonus).toBe(5);
    expect(armorAcContribution({ baseAc: 3, magicBonus: 1, isShield: false, shieldAcBonus: 0 }).acBonus).toBe(2);
  });
  it("shield: contributes minus (shieldAcBonus + magicBonus), AC-signed", () => {
    expect(armorAcContribution({ baseAc: 0, magicBonus: 0, isShield: true, shieldAcBonus: 1 }).acBonus).toBe(-1);
    expect(armorAcContribution({ baseAc: 0, magicBonus: 2, isShield: true, shieldAcBonus: 1 }).acBonus).toBe(-3);
  });
});
```

`tests/data/derive/class-item.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classItemLevel, classItemCanLevelUp } from "../../../src/data/derive/class-item";

describe("classItemLevel", () => {
  it("resolves the engine level for the class's own XP", () => {
    expect(classItemLevel("fighter", 0)).toBe(1);
    expect(classItemLevel("fighter", 4000)).toBe(3);
    expect(classItemLevel("mage", 250000)).toBe(10);
  });
  it("honours the class's intrinsic level cap", () => {
    expect(classItemLevel("druid", 999_000_000)).toBe(14);
  });
});

describe("classItemCanLevelUp", () => {
  it("true when the resolved level exceeds the number of HD rolls recorded", () => {
    expect(classItemCanLevelUp("fighter", 4000, 2)).toBe(true); // level 3, 2 rolls
    expect(classItemCanLevelUp("fighter", 4000, 3)).toBe(false); // level 3, 3 rolls
    expect(classItemCanLevelUp("fighter", 0, 0)).toBe(true); // level 1, 0 rolls
  });
});
```

`tests/data/derive/weapon.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toWeaponData } from "../../../src/data/derive/weapon";

const longSword = {
  name: "Long Sword",
  category: "melee" as const,
  damageVsSM: "1d8",
  damageVsL: "1d12",
  damageType: "slashing" as const,
  speedFactor: 5,
  weight: 4,
  size: "M" as const,
  rateOfFire: null,
  range: null,
};

describe("toWeaponData", () => {
  it("projects a weapon item's fields into the engine WeaponData shape", () => {
    expect(toWeaponData(longSword)).toEqual({
      name: "Long Sword",
      category: "melee",
      damageVsSM: "1d8",
      damageVsL: "1d12",
      damageType: "slashing",
      speedFactor: 5,
      weight: 4,
      size: "M",
      rateOfFire: null,
      range: null,
    });
  });
  it("carries a range object through unchanged", () => {
    const bow = { ...longSword, category: "bow" as const, damageVsSM: null, damageVsL: null, damageType: null,
      range: { short: 50, medium: 100, long: 150 } };
    expect(toWeaponData(bow).range).toEqual({ short: 50, medium: 100, long: 150 });
    expect(toWeaponData(bow).damageVsSM).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data/derive/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create the derive modules**

`src/data/derive/physical-item.ts`:

```ts
/** Total carried weight of a stack: unit weight × quantity, junk input clamped to 0. */
export function totalWeight(input: { weight: number; quantity: number }): number {
  return Math.max(0, input.weight) * Math.max(0, input.quantity);
}
```

`src/data/derive/armor.ts`:

```ts
export interface ArmorAcInput {
  /** AC value the armor grants (e.g. plate = 3); ignored for a shield */
  baseAc: number;
  /** enchantment bonus (+1 armor, +2 shield …) */
  magicBonus: number;
  isShield: boolean;
  /** AC improvement a shield gives (usually 1) */
  shieldAcBonus: number;
}

/**
 * This item's contribution to the wearer's AC, already AC-signed so Plan 1c.3
 * can sum contributions. Body armor: `baseAc − magicBonus` (a better AC is a
 * lower number, so magic subtracts). Shield: `−(shieldAcBonus + magicBonus)`.
 */
export function armorAcContribution(input: ArmorAcInput): { acBonus: number } {
  if (input.isShield) {
    return { acBonus: -(input.shieldAcBonus + input.magicBonus) };
  }
  return { acBonus: input.baseAc - input.magicBonus };
}
```

`src/data/derive/class-item.ts`:

```ts
import { getChassis } from "../../core/classes/chassis";
import { levelForXp } from "../../core/classes/progression";
import type { ClassId } from "../../core/types";

/** The class level this embedded `class` item has reached on its own XP total. */
export function classItemLevel(chassisId: ClassId, xp: number): number {
  return levelForXp(getChassis(chassisId), xp);
}

/** True when the class has advanced past the last recorded Hit-Die roll and owes one. */
export function classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number): boolean {
  return classItemLevel(chassisId, xp) > hpRollsLength;
}
```

`src/data/derive/weapon.ts`:

```ts
import type { WeaponData, WeaponCategory, WeaponSize, DamageType, WeaponRange } from "../../core/weapons/data";

export interface WeaponSource {
  name: string;
  category: WeaponCategory;
  damageVsSM: string | null;
  damageVsL: string | null;
  damageType: DamageType | null;
  speedFactor: number;
  weight: number;
  size: WeaponSize;
  rateOfFire: string | null;
  range: WeaponRange | null;
}

/**
 * Project a `weapon` item's authored fields into the engine's `WeaponData`
 * view. Pure field mapping — no actor context; Plan 1c.3 / Sub-project 3 feed
 * the result to `resolveWeaponAttackInputs` / `selectDamageDice`.
 */
export function toWeaponData(source: WeaponSource): WeaponData {
  return {
    name: source.name,
    category: source.category,
    damageVsSM: source.damageVsSM,
    damageVsL: source.damageVsL,
    damageType: source.damageType,
    speedFactor: source.speedFactor,
    weight: source.weight,
    size: source.size,
    rateOfFire: source.rateOfFire,
    range: source.range,
  };
}
```

(If `WeaponData` has fields beyond these ten, `toWeaponData` will fail to type-check — add the missing field to `WeaponSource` and the projection, sourced from the `weapon` item schema in Task 4. Re-read `src/core/weapons/data.ts` `interface WeaponData` and match it exactly.)

- [ ] **Step 4: Extend the pure zone for `src/data/derive`**

`tsconfig.core.json` `include`: add `"src/data/derive"`.
`vitest.config.ts` `coverage.include`: add `"src/data/derive/**/*.ts"`.

- [ ] **Step 5: Run tests + gate**

Run: `npx vitest run tests/data/derive/` → PASS
Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green; `src/data/derive/**` at 100% (the `isShield` branch in `armor.ts` and both comparison arms in `class-item.ts` are covered by the tests above).

- [ ] **Step 6: Commit**

```bash
git add src/data/derive tests/data/derive tsconfig.core.json vitest.config.ts
git commit -m "feat(data): pure item-local derive helpers (weight, armor AC, class level, weapon projection)"
```

---

## Task 3: `data/common/` + `base-item.ts` + the `equipment` model (establish the pattern)

**Files:**
- Create: `src/data/common/fields.ts`, `src/data/common/physical-item.ts`
- Create: `src/data/item/base-item.ts`, `src/data/item/equipment.ts`

**Interfaces:**
- Consumes: `foundry.data.fields` (global); `totalWeight` from `src/data/derive/physical-item.ts`.
- Produces:
  - `htmlField(): foundry.data.fields.HTMLField` — a blank-allowed HTML field
  - `identifierField(): foundry.data.fields.StringField` — required, trimmed, blank-allowed string
  - `currencySchema(): foundry.data.fields.SchemaField` — `{ value: NumberField(≥0, init 0), currency: StringField(choices ["pp","gp","ep","sp","cp"], init "gp") }`
  - `physicalItemSchema(): Record<string, foundry.data.fields.DataField>` — `{ quantity, weight, cost, location, identified, equipped, magicBonus }`
  - `abstract class Adnd2eItemModel extends foundry.abstract.TypeDataModel` — base with a `description` HTML field and a no-op `prepareDerivedData()`
  - `class EquipmentItemModel extends Adnd2eItemModel`

This task establishes the fvtt-types generic form and the `foundry.data.fields` call style. Later tasks copy it.

- [ ] **Step 1: Create `src/data/common/fields.ts`**

```ts
// Reusable SchemaField fragments and field factories. Foundry-layer (uses
// `foundry.data.fields`); no logic — pure field construction.
const { StringField, NumberField, SchemaField, HTMLField } = foundry.data.fields;

/** Rich-text field, empty by default. Used for descriptions and GM notes. */
export function htmlField(): InstanceType<typeof HTMLField> {
  return new HTMLField({ required: true, blank: true, initial: "" });
}

/** A required, trimmed free-text identifier / name-like string. */
export function identifierField(): InstanceType<typeof StringField> {
  return new StringField({ required: true, blank: true, trim: true, initial: "" });
}

/** `{ value, currency }` money sub-object (PHB coin denominations). */
export function currencySchema(): InstanceType<typeof SchemaField> {
  return new SchemaField({
    value: new NumberField({ required: true, min: 0, initial: 0 }),
    currency: new StringField({
      required: true,
      blank: false,
      initial: "gp",
      choices: ["pp", "gp", "ep", "sp", "cp"],
    }),
  });
}
```

- [ ] **Step 2: Create `src/data/common/physical-item.ts`**

```ts
// The shared "physical item" schema fragment (spec §5.4): things a weapon,
// armor, or equipment item all carry. Spread into each of those schemas.
import { currencySchema } from "./fields";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export function physicalItemSchema(): Record<string, foundry.data.fields.DataField.Any> {
  return {
    quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    weight: new NumberField({ required: true, min: 0, initial: 0 }),
    cost: currencySchema(),
    location: new StringField({ required: true, blank: true, initial: "" }),
    identified: new BooleanField({ required: true, initial: true }),
    equipped: new BooleanField({ required: true, initial: false }),
    magicBonus: new NumberField({ required: true, integer: true, initial: 0 }),
  };
}
```

- [ ] **Step 3: Create `src/data/item/base-item.ts`**

```ts
// Abstract base for every adnd2e Item DataModel. Adds the shared `description`
// field and a no-op derived-data hook the subclasses override. Thin by design
// (Ruling D2) — item-local derived data only, delegated to src/data/derive/.
import { htmlField } from "../common/fields";

export abstract class Adnd2eItemModel<
  Schema extends foundry.data.fields.DataSchema = foundry.data.fields.DataSchema,
> extends foundry.abstract.TypeDataModel<Schema, Item.Implementation> {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { description: htmlField() };
  }

  override prepareDerivedData(): void {
    // Subclasses override; base contributes nothing.
  }
}
```

If the `<Schema extends …>` parameter or `Item.Implementation` is not the form
`fvtt-types` v13-beta accepts, simplify to
`extends foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, Item.Implementation>`
or the minimal `foundry.abstract.TypeDataModel` — **acceptance criterion is
`npm run typecheck` + `npm run lint` + `npm run build` all green**, and a
subclass's `defineSchema()` return being accepted.

- [ ] **Step 4: Create `src/data/item/equipment.ts`**

```ts
import { physicalItemSchema } from "../common/physical-item";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField, SchemaField } = foundry.data.fields;

export class EquipmentItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      category: new StringField({ required: true, blank: true, initial: "" }),
      charges: new SchemaField(
        {
          value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        },
        { required: true, nullable: true, initial: null },
      ),
      consumable: new BooleanField({ required: true, initial: false }),
      container: new BooleanField({ required: true, initial: false }),
      capacity: new NumberField({ required: true, nullable: true, min: 0, initial: null }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as { weight: number; quantity: number; totalWeight?: number };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
  }
}
```

(The `this as unknown as {…}` shim is the loose-typing concession of Ruling D4 — with a strict `Schema` type `this.weight` / `this.quantity` would be typed and the assignment to a derived `totalWeight` would be too. If the implementer chooses to write the strict `Schema` type for `equipment`, drop the shim. Either is acceptable; do NOT spend more than one attempt making the strict form compile.)

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. No new unit tests (a `defineSchema()` body cannot be exercised without a Foundry runtime — spec §9). `npm run build` confirms Vite bundles the new modules; `tsc` confirms the fvtt-types generics resolve.

- [ ] **Step 6: Commit**

```bash
git add src/data/common src/data/item/base-item.ts src/data/item/equipment.ts
git commit -m "feat(data): item DataModel base + common fragments + equipment model"
```

---

## Task 4: The remaining eight Item models

**Files:**
- Create: `src/data/item/class.ts`, `race.ts`, `weapon.ts`, `armor.ts`, `spell.ts`, `weapon-proficiency.ts`, `nonweapon-proficiency.ts`, `class-feature.ts`

**Interfaces:**
- Consumes: the Task 1 choice arrays; `physicalItemSchema` (Task 3); `Adnd2eItemModel` (Task 3); `totalWeight`, `armorAcContribution`, `classItemLevel`, `classItemCanLevelUp`, `toWeaponData` (Task 2).
- Produces: `ClassItemModel`, `RaceItemModel`, `WeaponItemModel`, `ArmorItemModel`, `SpellItemModel`, `WeaponProficiencyItemModel`, `NonweaponProficiencyItemModel`, `ClassFeatureItemModel` — all `extends Adnd2eItemModel`.

Follow Task 3's pattern exactly: `static override defineSchema()` spreads `super.defineSchema()` then declares fields from `choices.ts` arrays and `physicalItemSchema()`; `override prepareDerivedData()` calls the Task 2 helpers or is omitted (inherits the base no-op).

- [ ] **Step 1: `src/data/item/class.ts`** (reference model — Ruling D1)

```ts
import { CLASS_IDS, DUAL_CLASS_STATES, WIZARD_SCHOOLS } from "./choices";
import { classItemCanLevelUp, classItemLevel } from "../derive/class-item";
import { Adnd2eItemModel } from "./base-item";
import type { ClassId } from "../../core/types";

const { StringField, NumberField, ArrayField } = foundry.data.fields;

export class ClassItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      chassisId: new StringField({ required: true, blank: false, initial: "fighter", choices: CLASS_IDS }),
      specialistSchool: new StringField({ required: true, nullable: true, initial: null, choices: WIZARD_SCHOOLS }),
      kit: new StringField({ required: true, nullable: true, initial: null }),
      grantedFeatures: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
      xp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      hpRolls: new ArrayField(new NumberField({ required: true, integer: true, min: 0 }), { required: true, initial: [] }),
      dualClassState: new StringField({ required: true, nullable: true, initial: null, choices: DUAL_CLASS_STATES }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as {
      chassisId: ClassId; xp: number; hpRolls: number[];
      level?: number; canLevelUp?: boolean;
    };
    sys.level = classItemLevel(sys.chassisId, sys.xp);
    sys.canLevelUp = classItemCanLevelUp(sys.chassisId, sys.xp, sys.hpRolls.length);
  }
}
```

- [ ] **Step 2: `src/data/item/race.ts`** (reference model — Ruling D1)

```ts
import { CLASS_IDS, CREATURE_SIZES, RACE_IDS } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField, ArrayField, ObjectField } = foundry.data.fields;

export class RaceItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      raceId: new StringField({ required: true, blank: false, initial: "human", choices: RACE_IDS }),
      size: new StringField({ required: true, blank: false, initial: "medium", choices: CREATURE_SIZES }),
      baseMovement: new NumberField({ required: true, integer: true, min: 0, initial: 12 }),
      infravision: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** PHB Table 7 — raceId+classId -> max level (or null = unlimited). Free-form object. */
      classLevelLimits: new ObjectField({ required: true, initial: {} }),
      allowedClasses: new ArrayField(new StringField({ required: true, blank: false, choices: CLASS_IDS }), { required: true, initial: [] }),
      allowedMulticlass: new ArrayField(
        new ArrayField(new StringField({ required: true, blank: false, choices: CLASS_IDS })),
        { required: true, initial: [] },
      ),
      bonusLanguages: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
      grantedFeatures: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
    };
  }
}
```

- [ ] **Step 3: `src/data/item/weapon.ts`**

```ts
import { DAMAGE_TYPES, WEAPON_CATEGORIES, WEAPON_SIZES } from "./choices";
import { physicalItemSchema } from "../common/physical-item";
import { toWeaponData, type WeaponSource } from "../derive/weapon";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, SchemaField } = foundry.data.fields;

export class WeaponItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      category: new StringField({ required: true, blank: false, initial: "melee", choices: WEAPON_CATEGORIES }),
      damageVsSM: new StringField({ required: true, nullable: true, initial: null }),
      damageVsL: new StringField({ required: true, nullable: true, initial: null }),
      damageType: new StringField({ required: true, nullable: true, initial: null, choices: DAMAGE_TYPES }),
      speedFactor: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      size: new StringField({ required: true, blank: false, initial: "M", choices: WEAPON_SIZES }),
      rateOfFire: new StringField({ required: true, nullable: true, initial: null }),
      range: new SchemaField(
        {
          short: new NumberField({ required: true, min: 0, initial: 0 }),
          medium: new NumberField({ required: true, min: 0, initial: 0 }),
          long: new NumberField({ required: true, min: 0, initial: 0 }),
        },
        { required: true, nullable: true, initial: null },
      ),
      proficiencyGroup: new StringField({ required: true, blank: true, initial: "" }),
      handsRequired: new NumberField({ required: true, integer: true, choices: [1, 2], initial: 1 }),
      materialToHit: new NumberField({ required: true, integer: true, initial: 0 }),
      styleGroup: new StringField({ required: true, blank: true, initial: "" }),
      specialization: new SchemaField({
        profSlotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        isSpecialized: new foundry.data.fields.BooleanField({ required: true, initial: false }),
        isMastery: new foundry.data.fields.BooleanField({ required: true, initial: false }),
      }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as WeaponSource & {
      weight: number; quantity: number; totalWeight?: number; weaponData?: unknown;
    };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
    sys.weaponData = toWeaponData(sys);
  }
}
```

- [ ] **Step 4: `src/data/item/armor.ts`**

```ts
import { physicalItemSchema } from "../common/physical-item";
import { armorAcContribution } from "../derive/armor";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class ArmorItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      baseAc: new NumberField({ required: true, integer: true, initial: 10 }),
      armorType: new StringField({ required: true, blank: true, initial: "" }),
      isShield: new BooleanField({ required: true, initial: false }),
      shieldAcBonus: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      movementPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
      checkPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as {
      baseAc: number; magicBonus: number; isShield: boolean; shieldAcBonus: number;
      weight: number; quantity: number; totalWeight?: number; acContribution?: unknown;
    };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
    sys.acContribution = armorAcContribution({
      baseAc: sys.baseAc, magicBonus: sys.magicBonus, isShield: sys.isShield, shieldAcBonus: sys.shieldAcBonus,
    });
  }
}
```

- [ ] **Step 5: `src/data/item/spell.ts`**

```ts
import { CASTER_CLASSES, SAVING_THROW_KINDS, SPELL_SCHOOLS, SPHERE_NAMES } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;

export class SpellItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      casterClass: new StringField({ required: true, blank: false, initial: "wizard", choices: CASTER_CLASSES }),
      level: new NumberField({ required: true, integer: true, min: 1, max: 9, initial: 1 }),
      schools: new ArrayField(new StringField({ required: true, blank: false, choices: SPELL_SCHOOLS }), { required: true, initial: [] }),
      spheres: new ArrayField(new StringField({ required: true, blank: false, choices: SPHERE_NAMES }), { required: true, initial: [] }),
      range: new StringField({ required: true, blank: true, initial: "" }),
      components: new SchemaField({
        v: new BooleanField({ required: true, initial: false }),
        s: new BooleanField({ required: true, initial: false }),
        m: new BooleanField({ required: true, initial: false }),
      }),
      materialComponent: new StringField({ required: true, blank: true, initial: "" }),
      duration: new StringField({ required: true, blank: true, initial: "" }),
      castingTime: new StringField({ required: true, blank: true, initial: "" }),
      areaOfEffect: new StringField({ required: true, blank: true, initial: "" }),
      savingThrow: new StringField({ required: true, blank: false, initial: "none", choices: SAVING_THROW_KINDS }),
      reversible: new BooleanField({ required: true, initial: false }),
      isReversedForm: new BooleanField({ required: true, initial: false }),
      automation: new SchemaField({
        damage: new StringField({ required: true, nullable: true, initial: null }),
        healing: new StringField({ required: true, nullable: true, initial: null }),
        effectRefs: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
        targetType: new StringField({ required: true, blank: true, initial: "" }),
      }),
    };
  }
}
```

- [ ] **Step 6: `src/data/item/weapon-proficiency.ts`**

```ts
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class WeaponProficiencyItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      weaponOrGroup: new StringField({ required: true, blank: true, initial: "" }),
      isGroup: new BooleanField({ required: true, initial: false }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      specialized: new BooleanField({ required: true, initial: false }),
      styleSpecialization: new StringField({ required: true, nullable: true, initial: null }),
      masteryTier: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    };
  }
}
```

- [ ] **Step 7: `src/data/item/nonweapon-proficiency.ts`**

```ts
import { ABILITY_KEYS, NONWEAPON_GROUPS } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class NonweaponProficiencyItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      governingAbility: new StringField({ required: true, blank: false, initial: "str", choices: ABILITY_KEYS }),
      modifier: new NumberField({ required: true, integer: true, initial: 0 }),
      slotCost: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      group: new StringField({ required: true, blank: false, initial: "general", choices: NONWEAPON_GROUPS }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      isRacial: new BooleanField({ required: true, initial: false }),
      checkPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
    };
  }
}
```

- [ ] **Step 8: `src/data/item/class-feature.ts`**

```ts
import { FEATURE_ACTIVATIONS, FEATURE_SOURCE_TYPES } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

export class ClassFeatureItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      sourceType: new StringField({ required: true, blank: false, initial: "class", choices: FEATURE_SOURCE_TYPES }),
      activation: new StringField({ required: true, blank: false, initial: "passive", choices: FEATURE_ACTIVATIONS }),
      uses: new SchemaField(
        {
          value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          per: new StringField({ required: true, blank: true, initial: "" }),
        },
        { required: true, nullable: true, initial: null },
      ),
      effectRefs: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
    };
  }
}
```

- [ ] **Step 9: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: green. If `tsc` rejects a `choices:` array (`readonly string[]` vs the field's expected `readonly string[] | Record<…>`), cast at the call site: `choices: CLASS_IDS as readonly string[]` — do not change `choices.ts`. If a `defineSchema` return type complains, widen the annotation to `foundry.data.fields.DataSchema` (already used) or drop it.

- [ ] **Step 10: Commit**

```bash
git add src/data/item
git commit -m "feat(data): the remaining eight Item DataModels (class/race reference the engine)"
```

---

## Task 5: Registration + type augmentation

**Files:**
- Create: `src/data/item/index.ts`
- Modify: `src/system.ts`, `src/types/global.d.ts`

**Interfaces:**
- Consumes: all nine model classes; `ITEM_SUBTYPES` / `ItemSubtype` (Task 1).
- Produces: `ITEM_DATA_MODELS: Record<ItemSubtype, …>` — consumed by `src/system.ts` and by Plan 1c.3 (actor code that reads embedded item `system`).

- [ ] **Step 1: Create `src/data/item/index.ts`**

```ts
import type { ItemSubtype } from "./subtypes";
import { ClassItemModel } from "./class";
import { RaceItemModel } from "./race";
import { WeaponItemModel } from "./weapon";
import { ArmorItemModel } from "./armor";
import { EquipmentItemModel } from "./equipment";
import { SpellItemModel } from "./spell";
import { WeaponProficiencyItemModel } from "./weapon-proficiency";
import { NonweaponProficiencyItemModel } from "./nonweapon-proficiency";
import { ClassFeatureItemModel } from "./class-feature";

export {
  ClassItemModel, RaceItemModel, WeaponItemModel, ArmorItemModel, EquipmentItemModel,
  SpellItemModel, WeaponProficiencyItemModel, NonweaponProficiencyItemModel, ClassFeatureItemModel,
};

/** Registered on `CONFIG.Item.dataModels` in the init hook. Keys ≡ `ITEM_SUBTYPES`. */
export const ITEM_DATA_MODELS: Record<ItemSubtype, typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, Item.Implementation>> = {
  class: ClassItemModel,
  race: RaceItemModel,
  weapon: WeaponItemModel,
  armor: ArmorItemModel,
  equipment: EquipmentItemModel,
  spell: SpellItemModel,
  weaponProficiency: WeaponProficiencyItemModel,
  nonweaponProficiency: NonweaponProficiencyItemModel,
  classFeature: ClassFeatureItemModel,
};
```

The `Record<ItemSubtype, …>` annotation makes `tsc` reject the object if a key
is missing, extra, or misspelled — that is the drift guard for
`ITEM_DATA_MODELS` ↔ `ITEM_SUBTYPES` (and, transitively via Task 1's test,
`system.json`). If the value type `typeof foundry.abstract.TypeDataModel<…>`
does not accept the concrete model classes, widen it to
`typeof foundry.abstract.TypeDataModel<any, any>` or
`Record<ItemSubtype, ConstructorOf<foundry.abstract.TypeDataModel.Any>>` —
whichever `fvtt-types` v13-beta accepts; keep the `Record<ItemSubtype, …>` key
constraint.

- [ ] **Step 2: Wire registration into `src/system.ts`**

Add the import and the assignment in the `init` hook (after the existing `CONFIG.ADND2E` line):

```ts
import { ITEM_DATA_MODELS } from "./data/item";
// …
Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  CONFIG.Item.dataModels = ITEM_DATA_MODELS;
  registerSettings();
});
```

If `tsc` complains that `CONFIG.Item.dataModels`'s expected type does not match,
cast the RHS: `CONFIG.Item.dataModels = ITEM_DATA_MODELS as typeof CONFIG.Item.dataModels;`.

- [ ] **Step 3: Augment `src/types/global.d.ts`**

Add to the `declare global` block:

```ts
  interface DataModelConfig {
    Item: {
      class: typeof import("../data/item/class").ClassItemModel;
      race: typeof import("../data/item/race").RaceItemModel;
      weapon: typeof import("../data/item/weapon").WeaponItemModel;
      armor: typeof import("../data/item/armor").ArmorItemModel;
      equipment: typeof import("../data/item/equipment").EquipmentItemModel;
      spell: typeof import("../data/item/spell").SpellItemModel;
      weaponProficiency: typeof import("../data/item/weapon-proficiency").WeaponProficiencyItemModel;
      nonweaponProficiency: typeof import("../data/item/nonweapon-proficiency").NonweaponProficiencyItemModel;
      classFeature: typeof import("../data/item/class-feature").ClassFeatureItemModel;
    };
  }
```

Try `interface DataModelConfig` inside `declare global` first. If `fvtt-types`
v13-beta wants the module form, use:
```ts
declare module "fvtt-types/configuration" {
  interface DataModelConfig { Item: { /* …same map… */ } }
}
```
**Acceptance criterion (behavioural):** `npm run typecheck` exits 0, and in a
scratch check `item.system` for an `Item` of subtype `"weapon"` is typed with
the weapon fields (not `never` / `any`). Remove any scratch file before commit.

- [ ] **Step 4: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: all green. `npm run build` emits `dist/system.js` containing the nine models; `dist/` is not committed.

- [ ] **Step 5: Commit**

```bash
git add src/data/item/index.ts src/system.ts src/types/global.d.ts
git commit -m "feat(data): register Item DataModels on CONFIG.Item.dataModels + type augmentation"
```

---

## Self-Review

**1. Spec coverage.**

| Spec §5.4 item | Task | Notes |
|---|---|---|
| `physical-item` fragment | Task 3 (`physicalItemSchema`) | quantity/weight/cost/location/identified/equipped/magicBonus |
| `class` | Task 4 Step 1 | **Ruling D1** — `chassisId` reference, not full copy; `TableRef` fields dropped |
| `race` | Task 4 Step 2 | **Ruling D1** — `raceId` reference; `naturalThief`/ability-adj fields dropped (engine holds them) |
| `weapon` | Task 4 Step 3 | full authored; `damage.{vsSM,vsL}` → `damageVsSM`/`damageVsL` (+`damageType`, matching the engine `WeaponData` field names) |
| `armor` | Task 4 Step 4 | full authored; `movementPenalty`/`checkPenalty` reserved (no consumer — 1b.7 carry-forward) |
| `equipment` | Task 3 Step 4 | full authored |
| `spell` | Task 4 Step 5 | full authored; `description` ships empty (no spell text) |
| `weaponProficiency` | Task 4 Step 6 | full authored; `masteryTier` reserved C&T |
| `nonweaponProficiency` | Task 4 Step 7 | full authored |
| `classFeature` | Task 4 Step 8 | full authored |
| §5.4 "EmbeddedFeatureRef[]" | `grantedFeatures: string[]` on class/race, `effectRefs: string[]` on classFeature | resolved to items when added to an actor — Plan 1c.3/1c.4 |
| §4 `CONFIG.Item.dataModels` registration | Task 5 | |
| §4 `src/types/global.d.ts` augmentation | Task 5 Step 3 | |
| §9 pure-core testing, no Foundry mocks | Tasks 1–2 (100% gate); Tasks 3–5 typecheck + dev-world | |

Gaps: `ActiveEffect` DataModel (§5.5) is explicitly out of scope — it lands with actor derived-data (1c.3) where two-pass effects matter. `documents/item.ts` — Ruling D3, deferred to 1c.3.

**2. Placeholder scan.** No "TBD"/"handle edge cases"/"similar to Task N". Every schema is written out in full. The fvtt-types-generic fallbacks are concrete alternatives with a stated behavioural acceptance criterion, not "adjust as needed".

**3. Type consistency.**
- `ItemSubtype` / `ITEM_SUBTYPES` — 9 names identical in Task 1 (definition), Task 5 (`Record<ItemSubtype>` + the `index.ts` keys), and `system.json` (Task 1's test asserts equality).
- Choice arrays — Task 1 defines; Task 4 consumes by the exact names (`CLASS_IDS`, `WIZARD_SCHOOLS`, `SPELL_SCHOOLS`, `SPHERE_NAMES`, `DAMAGE_TYPES`, `WEAPON_SIZES`, `WEAPON_CATEGORIES`, `NONWEAPON_GROUPS`, `CREATURE_SIZES`, `CASTER_CLASSES`, `SAVING_THROW_KINDS`, `DUAL_CLASS_STATES`, `FEATURE_SOURCE_TYPES`, `FEATURE_ACTIVATIONS`).
- Derive functions — Task 2 signatures (`totalWeight`, `armorAcContribution`, `classItemLevel`, `classItemCanLevelUp`, `toWeaponData` + `WeaponSource`) match Task 3/4 call sites exactly.
- `WeaponSource` (Task 2) field set === the `weapon` schema's projected fields (Task 4 Step 3): name, category, damageVsSM, damageVsL, damageType, speedFactor, weight, size, rateOfFire, range. The Task 2 note tells the implementer to reconcile against the real `WeaponData` interface.
- `Adnd2eItemModel` — defined Task 3, extended by all nine (Task 3 `equipment`, Task 4 the rest).
- `ITEM_DATA_MODELS` — Task 5 `index.ts`; consumed by Task 5 `system.ts`.

**4. Execution-order note.** Task 1 → 2 (derive is in the pure zone Task 1 wires; Task 2 extends it with `src/data/derive`). Tasks 3 → 4 (pattern first). Task 5 last (needs all nine classes). Tasks 3–5 have no unit tests — their gate is `typecheck + lint + build` + the dev-world smoke check below. Tasks 3+4 may be a single implementer if the fvtt-types pattern lands cleanly in Task 3; keep Task 3 separate if the generics need iteration.

**5. Dev-world smoke check (manual, at merge time — no automated coverage for `defineSchema`).** In a linked world: create one Item of each of the nine subtypes; confirm each opens (raw-field sheet, since designed sheets are 1c.4/SP2) with no console error; confirm a `class` item shows a derived `system.level` and a `weapon`/`armor`/`equipment` item shows `system.totalWeight`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-adnd2e-1c2-item-datamodels.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — tasks in this session with checkpoints.

**Which approach?**
