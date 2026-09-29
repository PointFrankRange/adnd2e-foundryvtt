# Bow/Crossbow Ammunition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give bows and crossbows real damage by modeling ammunition as its own item type (arrows, bolts) that a PC selects per weapon, that carries the S-M/L damage dice and damage type, and that is consumed one unit per attack — hit or miss.

**Architecture:** A new `ammo` Item subtype carries the damage the PHB puts on the ammunition rather than the launcher. A pure `src/combat/ammo.ts` module owns the matching rule (which owned ammo fits a given launcher, and which one a weapon's selector defaults to). The PC sheet context (`context.ts`/`context-types.ts`) surfaces a per-weapon ammo dropdown and an ammo-aware damage-note string; `combat-rolls.ts`'s `rollAttack()` validates the chosen ammo before rolling, decrements its quantity once the to-hit roll has actually happened, and threads which ammo item was used into the attack chat card's `damageContext`; `chat-listeners.ts`'s `onRollDamage()` reads that ammo item's dice instead of the (still-null) launcher dice. Monster NPCs are untouched — this is scoped to PCs only.

**Tech Stack:** TypeScript, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-28-adnd2e-ammunition-design.md`

## Global Constraints

- **Foundry v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app`) is authoritative — never `fvtt-types`.
- **Two-layer contract:** `src/combat/ammo.ts` and the ammo-aware parts of `src/sheets/character/{context,context-types}.ts` are pure/typed zones with unit tests (this project's coverage gate: `src/combat/**` and `src/sheets/character/context*.ts` require 100% line/statement/function, ≥90% branch coverage). `src/data/item/*.ts` (DataModel schemas), `combat-rolls.ts`, `chat-listeners.ts`, `sheet.ts`, templates, and lang stay Foundry glue — typecheck/lint gated and dev-world verified, per this codebase's existing convention for those exact files (their own header comments already say so).
- **Scope: PCs only.** Monster NPC ranged attacks keep using `monsterWeaponDamageFormula`/`monster-gear.ts` unchanged. The `ammo` item type is **not** added to `MONSTER_ITEM_TYPES` — dropping one on a Monster NPC sheet is rejected like any other unsupported type.
- **Schema change, no data migration:** a new item subtype and two new nullable weapon fields (`ammoType`, `selectedAmmoId`) are additive; no existing item data is reshaped.
- Melee/thrown weapon behavior is unchanged end-to-end: their `ammoType`/`selectedAmmoId` stay `null`, so `rollAttack()`/`onRollDamage()` take the pre-existing code path.
- **`toWeaponData()`/`WeaponData`/`WeaponItemModel.prepareDerivedData()` are untouched** — confirmed during plan-writing to be a pure, actor-less field mapper whose output (`system.weaponData`) is never read anywhere at runtime. Ammo resolution happens at the three real call sites (context, combat-rolls, chat-listeners), reading raw schema fields the same way weapon fields already are.
- No `npm run format`/`prettier`/`npm install`/`npm update`; don't touch package files. `npm run build` needs Foundry closed — the controller builds before Task 9, not individual task implementers.
- Vitest via `npx vitest run <path>` with output inspected directly (never pipe through `| grep`); rerun 2-3× on a first-run flake. Working copies are CRLF.
- Mandatory whole-branch review (Task 8); GATED dev-world check (Task 9).

---

### Task 1: Ammo item schema, subtype registration, weapon ammo fields

**Files:**
- Create: `src/data/item/ammo.ts`
- Modify: `src/data/item/subtypes.ts`, `src/data/item/index.ts`, `src/data/item/weapon.ts`, `system.json`, `lang/en.json`
- Test: `tests/data/subtypes.test.ts` (existing — no code change, used as a red/green check)

**Interfaces — Produces:** `AmmoItemModel` (registered under `ITEM_DATA_MODELS.ammo`), item schema fields `ammoType: string`, `damageVsSM: string`, `damageVsL: string`, `damageType: DamageType` (plus the inherited physical-item fields: `quantity`, `weight`, `cost`, `location`, `identified`, `equipped`, `magicBonus`). `WeaponItemModel` gains `ammoType: string | null` and `selectedAmmoId: string | null` (both `null` unless `category` is `"bow"`/`"crossbow"`).

- [ ] **Step 1: Add the subtype to `system.json` first, so the existing parity test fails**

In `system.json`, inside `documentTypes.Item`, add `"ammo": {}` right after `"equipment": {}`:
```json
    "Item": {
      "class": {},
      "race": {},
      "weapon": {},
      "armor": {},
      "equipment": {},
      "ammo": {},
      "spell": {},
```

- [ ] **Step 2: Run the subtype-parity test and confirm it fails**

Run: `npx vitest run tests/data/subtypes.test.ts`
Expected: FAIL — `ITEM_SUBTYPES` (missing `"ammo"`) no longer matches `system.json`'s declared types.

- [ ] **Step 3: Add `"ammo"` to `ITEM_SUBTYPES`**

In `src/data/item/subtypes.ts`, add `"ammo"` to both the `ItemSubtype` union and the `ITEM_SUBTYPES` array, right after `"equipment"`:
```typescript
export type ItemSubtype =
  | "class"
  | "race"
  | "weapon"
  | "armor"
  | "equipment"
  | "ammo"
  | "spell"
  | "weaponProficiency"
  | "nonweaponProficiency"
  | "classFeature"
  | "condition"
  | "trait";

export const ITEM_SUBTYPES: readonly ItemSubtype[] = [
  "class",
  "race",
  "weapon",
  "armor",
  "equipment",
  "ammo",
  "spell",
  "weaponProficiency",
  "nonweaponProficiency",
  "classFeature",
  "condition",
  "trait",
];
```

- [ ] **Step 4: Run the subtype-parity test and confirm it passes**

Run: `npx vitest run tests/data/subtypes.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the `AmmoItemModel` schema**

Create `src/data/item/ammo.ts`:
```typescript
// The `ammo` item subtype: arrows, bolts and quarrels — the S-M/L damage
// dice and damage type the PHB puts on the ammunition, not the bow/crossbow
// that fires it (docs/superpowers/specs/2026-09-28-adnd2e-ammunition-design.md).
import { DAMAGE_TYPES } from "./choices";
import { physicalItemSchema } from "../common/physical-item";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField } = foundry.data.fields;

export class AmmoItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      ammoType: new StringField({ required: true, blank: false, initial: "arrow" }),
      damageVsSM: new StringField({ required: true, blank: false, initial: "1d6" }),
      damageVsL: new StringField({ required: true, blank: false, initial: "1d6" }),
      damageType: new StringField({ required: true, blank: false, initial: "piercing", choices: DAMAGE_TYPES }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as { weight: number; quantity: number; totalWeight?: number };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
  }
}
```

- [ ] **Step 6: Register `AmmoItemModel`**

In `src/data/item/index.ts`, add the import, export, and `ITEM_DATA_MODELS` entry (mirroring every other entry):
```typescript
import { AmmoItemModel } from "./ammo";
```
(placed after the `EquipmentItemModel` import), add `AmmoItemModel` to the `export { ... }` list (after `EquipmentItemModel`), and add `ammo: AmmoItemModel,` to `ITEM_DATA_MODELS` (after `equipment: EquipmentItemModel,`).

- [ ] **Step 7: Add `ammoType`/`selectedAmmoId` to the weapon schema**

In `src/data/item/weapon.ts`, in `defineSchema()`, add two fields right after `styleGroup`:
```typescript
      styleGroup: new StringField({ required: true, blank: true, initial: "" }),
      ammoType: new StringField({ required: true, nullable: true, initial: null }),
      selectedAmmoId: new StringField({ required: true, nullable: true, initial: null }),
```
(`prepareDerivedData()` is untouched — see Global Constraints.)

- [ ] **Step 8: Add the `TYPES.Item.ammo` label**

In `lang/en.json`, in `TYPES.Item`, add `"ammo": "Ammunition"` right after `"equipment": "Equipment"`.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/data/item/ammo.ts src/data/item/subtypes.ts src/data/item/index.ts src/data/item/weapon.ts system.json lang/en.json
git commit -m "feat(items): add the ammo item subtype and weapon ammoType/selectedAmmoId fields"
```

---

### Task 2: Pure ammo-matching helper

**Files:**
- Create: `src/combat/ammo.ts`
- Test: `tests/combat/ammo.test.ts`
- Modify: `tests/combat/monster-gear.test.ts` (confirm `ammo` is rejected like any other unsupported Monster NPC drop)

**Interfaces:**
- Consumes: nothing (pure, no dependency on Task 1's Foundry-coupled schema — callers project item data into this shape themselves).
- Produces: `AmmoStock { id: string; ammoType: string; quantity: number }`, `matchingAmmo(ammo: readonly AmmoStock[], ammoType: string): AmmoStock[]`, `defaultAmmoSelection(candidates: readonly AmmoStock[], selectedAmmoId: string | null): AmmoStock | null`. Used by Task 4 (`context.ts`) and Task 5 (`combat-rolls.ts`).

- [ ] **Step 1: Write the failing tests**

Create `tests/combat/ammo.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { matchingAmmo, defaultAmmoSelection } from "../../src/combat/ammo";
import type { AmmoStock } from "../../src/combat/ammo";

const arrow: AmmoStock = { id: "a1", ammoType: "arrow", quantity: 12 };
const flightArrow: AmmoStock = { id: "a2", ammoType: "arrow", quantity: 3 };
const bolt: AmmoStock = { id: "a3", ammoType: "bolt", quantity: 20 };
const emptyArrows: AmmoStock = { id: "a4", ammoType: "arrow", quantity: 0 };

describe("matchingAmmo", () => {
  it("returns only items whose ammoType matches and quantity is above zero", () => {
    expect(matchingAmmo([arrow, flightArrow, bolt, emptyArrows], "arrow")).toEqual([arrow, flightArrow]);
  });
  it("excludes ammo of a different type entirely", () => {
    expect(matchingAmmo([bolt], "arrow")).toEqual([]);
  });
  it("excludes ammo with zero quantity even when the type matches", () => {
    expect(matchingAmmo([emptyArrows], "arrow")).toEqual([]);
  });
  it("returns an empty array when there is no ammo at all", () => {
    expect(matchingAmmo([], "arrow")).toEqual([]);
  });
});

describe("defaultAmmoSelection", () => {
  it("keeps the persisted selection when it is still a valid candidate", () => {
    expect(defaultAmmoSelection([arrow, flightArrow], "a2")).toEqual(flightArrow);
  });
  it("falls back to the first candidate when the persisted selection isn't a candidate", () => {
    expect(defaultAmmoSelection([arrow, flightArrow], "a3")).toEqual(arrow);
  });
  it("falls back to the first candidate when there is no persisted selection", () => {
    expect(defaultAmmoSelection([arrow, flightArrow], null)).toEqual(arrow);
  });
  it("returns null when there are no candidates at all", () => {
    expect(defaultAmmoSelection([], "a1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/combat/ammo.test.ts`
Expected: FAIL with "Cannot find module '../../src/combat/ammo'".

- [ ] **Step 3: Implement `src/combat/ammo.ts`**

```typescript
// Bow/crossbow ammunition matching (docs/superpowers/specs/2026-09-28-
// adnd2e-ammunition-design.md): which owned ammo items a launcher can use,
// and which one its selector defaults to. Pure — no actor/Foundry access;
// call sites (sheets/character/context.ts, sheets/character/combat-rolls.ts)
// project the actor's items into AmmoStock first.
export interface AmmoStock {
  id: string;
  ammoType: string;
  quantity: number;
}

/** Ammo usable with a launcher whose ammoType is `ammoType`: same tag, still in stock. */
export function matchingAmmo(ammo: readonly AmmoStock[], ammoType: string): AmmoStock[] {
  return ammo.filter((a) => a.ammoType === ammoType && a.quantity > 0);
}

/** The candidate a weapon's ammo selector defaults to: the persisted choice
 *  if it's still a valid candidate, else the first candidate, else none. */
export function defaultAmmoSelection(
  candidates: readonly AmmoStock[],
  selectedAmmoId: string | null,
): AmmoStock | null {
  return candidates.find((a) => a.id === selectedAmmoId) ?? candidates[0] ?? null;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/combat/ammo.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Add the Monster NPC rejection case**

In `tests/combat/monster-gear.test.ts`, add `"ammo"` to the existing rejected-types list (this codebase's `ammo` subtype is real as of Task 1, so this closes the loop on the spec's "PCs only" decision):
```typescript
  it.each(["class", "race", "weaponProficiency", "nonweaponProficiency", "trait", "classFeature", "condition", "ammo", "bogus"])(
```
(replacing the existing `it.each([...])` line that lists `"bogus"` last).

- [ ] **Step 6: Run monster-gear tests and confirm they pass**

Run: `npx vitest run tests/combat/monster-gear.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/combat/ammo.ts tests/combat/ammo.test.ts tests/combat/monster-gear.test.ts
git commit -m "feat(combat): add the pure ammo-matching/default-selection helper"
```

---

### Task 3: Attack card carries which ammo item was used

**Files:**
- Modify: `src/combat/card-types.ts`, `templates/chat/attack-roll.hbs`
- Test: `tests/combat/attack-card.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AttackCardInput["damageContext"]` and `AttackCardContext["damageContext"]` both gain `ammoItemId: string | null`. Task 5 sets it; Task 6 reads it.

- [ ] **Step 1: Add `ammoItemId` to both `damageContext` type literals first**

Vitest transpiles TypeScript via esbuild here and does not type-check, so the red/green signal for this type-only change is `tsc`, not `vitest`. Change the type first so the existing test fixture (which doesn't have `ammoItemId` yet) becomes the "red" state.

In `src/combat/card-types.ts`, update both occurrences (line ~30, `AttackCardInput`, and line ~50, `AttackCardContext`) from:
```typescript
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null; backstabMultiplier: number | null; critMultiplier: number | null; critFlatBonus: number } | null;
```
to:
```typescript
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null; ammoItemId: string | null; backstabMultiplier: number | null; critMultiplier: number | null; critFlatBonus: number } | null;
```

- [ ] **Step 2: Run typecheck and confirm it fails**

Run: `npm run typecheck`
Expected: FAIL — `tests/combat/attack-card.test.ts`'s `input()` helper's `damageContext` fixture (line 12) is now missing the required `ammoItemId` property.

- [ ] **Step 3: Fix the fixture**

In `tests/combat/attack-card.test.ts`, the `input()` helper's default `damageContext` (line 12) needs the new field:
```typescript
    damageContext: { weaponItemId: "w1", actorUuid: "Actor.a1", targetSize: "small", ammoItemId: null, backstabMultiplier: null, critMultiplier: null, critFlatBonus: 0 },
```

- [ ] **Step 4: Wire the attribute into the chat template**

In `templates/chat/attack-roll.hbs`, add `data-ammo-item-id` to the "Roll Damage" button:
```hbs
    <button type="button" data-action="rollDamage"
      data-actor-uuid="{{damageContext.actorUuid}}" data-weapon-item-id="{{damageContext.weaponItemId}}"
      data-ammo-item-id="{{damageContext.ammoItemId}}"
      data-target-size="{{damageContext.targetSize}}" data-backstab-multiplier="{{damageContext.backstabMultiplier}}"
      data-crit-multiplier="{{damageContext.critMultiplier}}" data-crit-flat-bonus="{{damageContext.critFlatBonus}}">
```

- [ ] **Step 5: Run typecheck and the attack-card test, confirm both pass**

Run: `npm run typecheck`
Run: `npx vitest run tests/combat/attack-card.test.ts`
Expected: both PASS. (`buildAttackCardContext` needs no code change — it already passes `damageContext` through opaquely.)

- [ ] **Step 6: Commit**

```bash
git add src/combat/card-types.ts templates/chat/attack-roll.hbs tests/combat/attack-card.test.ts
git commit -m "feat(combat): thread the consumed ammo item id through the attack card"
```

---

### Task 4: Sheet context & display — ammo-aware weapon rows

**Files:**
- Modify: `src/sheets/character/context-types.ts`, `src/sheets/character/context.ts`, `src/sheets/character/sheet.ts`
- Test: `tests/sheets/character/context.test.ts`

**Interfaces:**
- Consumes: `AmmoStock`, `matchingAmmo`, `defaultAmmoSelection` (Task 2).
- Produces: `PhysicalItemView.type` includes `"ammo"`; `PhysicalItemView.weapon` gains `ammoType: string | null` and `selectedAmmoId: string | null`; new `PhysicalItemView.ammo?: { ammoType: string; damageVsSM: string; damageVsL: string; damageType: DamageTypeUnion }`. `CharacterSheetContext["combat"].weapons[]` rows gain `ammoType: string | null` and `ammoOptions: { value: string; label: string; selected: boolean }[]`. Task 5 reads `w.ammoType`/`w.ammoOptions` from the rendered template; the template also gets a new `data-field="selectedAmmoId"` select.

- [ ] **Step 1: Update `PhysicalItemView` (types first, so the test literals below fail loudly if mistyped)**

In `src/sheets/character/context-types.ts`, replace:
```typescript
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
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning" | null;
  };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number; armorType: ArmorType };
}
```
with:
```typescript
export interface PhysicalItemView {
  id: string; name: string; img: string; type: "weapon" | "armor" | "equipment" | "ammo";
  quantity: number; weight: number; totalWeight: number;
  location: string; equipped: boolean; identified: boolean; magicBonus: number;
  /** equipment only */
  isContainer: boolean; capacity: number | null; contentsWeightMultiplier: number;
  /** weapon only — pre-derived display strings */
  weapon?: {
    damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null;
    category: "melee" | "thrown" | "bow" | "crossbow";
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning" | null;
    /** bow/crossbow only — what ammo this weapon takes, and the actor's currently-selected ammo item id */
    ammoType: string | null;
    selectedAmmoId: string | null;
  };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number; armorType: ArmorType };
  /** ammo only */
  ammo?: {
    ammoType: string;
    damageVsSM: string; damageVsL: string;
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning";
  };
}
```

- [ ] **Step 2: Extend the `combat.weapons` row type**

In `src/sheets/character/context-types.ts`, in `CharacterSheetContext`, replace:
```typescript
    weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null; canBackstab: boolean; favorite: boolean }[];
```
with:
```typescript
    weapons: {
      id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string;
      speedFactor: number; range: string | null; canBackstab: boolean; favorite: boolean;
      /** bow/crossbow only — null for melee/thrown, which render no ammo selector */
      ammoType: string | null;
      ammoOptions: { value: string; label: string; selected: boolean }[];
    }[];
```

- [ ] **Step 3: Make `toPhysicalView`/the item loop in `sheet.ts` aware of `ammo`**

In `src/sheets/character/sheet.ts`, in `toPhysicalView()`, add an `ammo` branch after the existing `armor` branch:
```typescript
  if (type === "ammo") {
    view.ammo = {
      ammoType: String(s.ammoType ?? ""),
      damageVsSM: String(s.damageVsSM ?? ""),
      damageVsL: String(s.damageVsL ?? ""),
      damageType: (s.damageType as PhysicalItemView["ammo"] extends undefined ? never : NonNullable<PhysicalItemView["ammo"]>["damageType"]) ?? "piercing",
    };
  }
```
and extend the `weapon` branch with the two new fields:
```typescript
  if (type === "weapon") {
    view.weapon = {
      damageVsSM: (s.damageVsSM as string | null) ?? null,
      damageVsL: (s.damageVsL as string | null) ?? null,
      speedFactor: Number(s.speedFactor ?? 0),
      range: rangeToString(s.range),
      category: (s.category as "melee" | "thrown" | "bow" | "crossbow" | undefined) ?? "melee",
      damageType: (s.damageType as PhysicalItemView["weapon"] extends undefined ? never : NonNullable<PhysicalItemView["weapon"]>["damageType"]) ?? null,
      ammoType: (s.ammoType as string | null) ?? null,
      selectedAmmoId: (s.selectedAmmoId as string | null) ?? null,
    };
  }
```
Then in the actor's item-categorizing loop (the `switch (it.type)` a bit further down), add `case "ammo":` alongside the existing physical-item cases:
```typescript
        case "weapon":
        case "armor":
        case "equipment":
        case "ammo":
          physicalItems.push(toPhysicalView(it));
          break;
```

- [ ] **Step 4: Update the 10 existing weapon-view test literals in `tests/sheets/character/context.test.ts`**

Every inline `weapon: { damageVsSM: ..., damageVsL: ..., speedFactor: ..., range: ..., category: ..., damageType: ... }` object literal must now also include `ammoType: null, selectedAmmoId: null` (melee/thrown weapons in every existing test) or TypeScript will reject the object as missing required properties. Six edits cover all ten occurrences (three groups share identical text):

Edit A — appears 3× (lines ~1723, 1738, 1792), use a single find-and-replace-all:
```typescript
// old:
weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing" },
// new:
weapon: { damageVsSM: "1d4", damageVsL: "1d3", speedFactor: 2, range: null, category: "melee", damageType: "piercing", ammoType: null, selectedAmmoId: null },
```

Edit B — appears 3× (lines ~567, 1308, 2109), single find-and-replace-all:
```typescript
// old:
weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", damageType: "slashing" },
// new:
weapon: { damageVsSM: "1d8", damageVsL: "1d12", speedFactor: 5, range: null, category: "melee", damageType: "slashing", ammoType: null, selectedAmmoId: null },
```

Edit C — line ~573 (Dagger, unique):
```typescript
// old:
weapon: { damageVsSM: "1d4", damageVsL: null, speedFactor: 2, range: "10/20/30", category: "melee", damageType: "piercing" },
// new:
weapon: { damageVsSM: "1d4", damageVsL: null, speedFactor: 2, range: "10/20/30", category: "melee", damageType: "piercing", ammoType: null, selectedAmmoId: null },
```

Edit D — line ~1569 (bow, `resolveWeaponCategory` test, unique):
```typescript
// old:
weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: "70/140/210", category: "bow", damageType: "piercing" },
// new:
weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: "70/140/210", category: "bow", damageType: "piercing", ammoType: null, selectedAmmoId: null },
```

Edit E — line ~1593 (crossbow, unique):
```typescript
// old:
weapon: { damageVsSM: "1d4", damageVsL: "1d4", speedFactor: 8, range: "60/120/180", category: "crossbow", damageType: "piercing" },
// new:
weapon: { damageVsSM: "1d4", damageVsL: "1d4", speedFactor: 8, range: "60/120/180", category: "crossbow", damageType: "piercing", ammoType: null, selectedAmmoId: null },
```

Edit F — line ~1753 (unique):
```typescript
// old:
weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: null, category: "melee", damageType: "bludgeoning" },
// new:
weapon: { damageVsSM: "1d6", damageVsL: "1d6", speedFactor: 7, range: null, category: "melee", damageType: "bludgeoning", ammoType: null, selectedAmmoId: null },
```

(These 6 are strictly `ammoType: null, selectedAmmoId: null` because none of them are bow/crossbow rows *used in an ammo test* — D and E are `resolveWeaponCategory` fixtures unrelated to ammo selection, so they stay `null`/`null` too.)

- [ ] **Step 5: Update the existing `combat.weapons` expectation**

In `tests/sheets/character/context.test.ts`, the `"weapons become display rows..."` test's `expect(c.combat.weapons).toEqual([...])` (around line 578) needs both new fields added to each expected row:
```typescript
    expect(c.combat.weapons).toEqual([
      {
        id: "w1",
        name: "Long Sword",
        equipped: true,
        toHitNote: "",
        damageNote: "1d8 / 1d12",
        speedFactor: 5,
        range: null,
        canBackstab: false,
        favorite: false,
        ammoType: null,
        ammoOptions: [],
      },
      {
        id: "w2",
        name: "Dagger",
        equipped: false,
        toHitNote: "",
        damageNote: "1d4",
        speedFactor: 2,
        range: "10/20/30",
        canBackstab: false,
        favorite: false,
        ammoType: null,
        ammoOptions: [],
      },
    ]);
```

- [ ] **Step 6: Run the context tests and confirm they fail**

Run: `npx vitest run tests/sheets/character/context.test.ts`
Expected: FAIL — `buildCombat()` doesn't produce `ammoType`/`ammoOptions` yet.

- [ ] **Step 7: Implement the ammo-aware `buildCombat()`**

In `src/sheets/character/context.ts`, add imports (near the existing `canBackstab` import):
```typescript
import { matchingAmmo, defaultAmmoSelection } from "../../combat/ammo";
import type { AmmoStock } from "../../combat/ammo";
```
Replace `buildCombat()`'s weapon-mapping section:
```typescript
function buildCombat(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["combat"] {
  const isThief = input.classItems.some((c) => c.chassisId === "thief");
  const ammoItems = input.physicalItems.filter((i) => i.type === "ammo");
  const ammoStock: AmmoStock[] = ammoItems.map((i) => ({
    id: i.id,
    ammoType: i.ammo!.ammoType,
    quantity: i.quantity,
  }));

  const weapons = input.physicalItems
    .filter((i) => i.type === "weapon")
    .map((i) => {
      const w = i.weapon as NonNullable<PhysicalItemView["weapon"]>;
      const ammoCandidates = w.ammoType ? matchingAmmo(ammoStock, w.ammoType) : [];
      const selected = w.ammoType ? defaultAmmoSelection(ammoCandidates, w.selectedAmmoId) : null;
      const selectedAmmoItem = selected ? ammoItems.find((a) => a.id === selected.id) : undefined;
      const damageNote = w.ammoType
        ? [selectedAmmoItem?.ammo?.damageVsSM, selectedAmmoItem?.ammo?.damageVsL].filter(Boolean).join(" / ")
        : [w.damageVsSM, w.damageVsL].filter(Boolean).join(" / ");
      return {
        id: i.id,
        name: i.name,
        equipped: i.equipped,
        toHitNote: "",
        damageNote,
        speedFactor: w.speedFactor,
        range: w.range,
        canBackstab: isThief && canBackstab({ category: w.category, damageType: w.damageType }),
        favorite: fav("item", i.id),
        ammoType: w.ammoType,
        ammoOptions: ammoCandidates.map((a) => ({
          value: a.id,
          label: `${ammoItems.find((it) => it.id === a.id)!.name} (${a.quantity})`,
          selected: selected?.id === a.id,
        })),
      };
    });
```
(The rest of `buildCombat()` — armor/AC breakdown/maneuver options — is unchanged.)

- [ ] **Step 8: Run the context tests and confirm they pass**

Run: `npx vitest run tests/sheets/character/context.test.ts`
Expected: PASS.

- [ ] **Step 9: Add new ammo-specific test cases**

In `tests/sheets/character/context.test.ts`, add three new `it(...)` blocks right after the `"weapons become display rows..."` test (inside the same `describe("buildCharacterSheetContext — inventory / combat / skills"...)` block):
```typescript
  it("a bow's ammo select lists matching, in-stock ammo and defaults to the first match", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "bow1", name: "Short Bow", type: "weapon", equipped: true,
            weapon: {
              damageVsSM: null, damageVsL: null, speedFactor: 7, range: "50/100/150", category: "bow", damageType: null,
              ammoType: "arrow", selectedAmmoId: null,
            },
          }),
          physItem({
            id: "ammo1", name: "Arrow", type: "ammo", quantity: 12,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
          physItem({
            id: "ammo2", name: "Bolt", type: "ammo", quantity: 5,
            ammo: { ammoType: "bolt", damageVsSM: "1d4", damageVsL: "1d4", damageType: "piercing" },
          }),
        ],
      }),
    );
    const bowRow = c.combat.weapons.find((w) => w.id === "bow1")!;
    expect(bowRow.ammoType).toBe("arrow");
    expect(bowRow.ammoOptions).toEqual([{ value: "ammo1", label: "Arrow (12)", selected: true }]);
    expect(bowRow.damageNote).toBe("1d6 / 1d6");
  });

  it("keeps a persisted selectedAmmoId as the default when it's still a valid candidate", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "bow1", name: "Short Bow", type: "weapon", equipped: true,
            weapon: {
              damageVsSM: null, damageVsL: null, speedFactor: 7, range: "50/100/150", category: "bow", damageType: null,
              ammoType: "arrow", selectedAmmoId: "ammo2",
            },
          }),
          physItem({
            id: "ammo1", name: "Arrow", type: "ammo", quantity: 12,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
          physItem({
            id: "ammo2", name: "Flight Arrow", type: "ammo", quantity: 4,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
        ],
      }),
    );
    const bowRow = c.combat.weapons.find((w) => w.id === "bow1")!;
    expect(bowRow.ammoOptions.map((o) => o.value)).toEqual(["ammo1", "ammo2"]);
    expect(bowRow.ammoOptions.find((o) => o.value === "ammo2")!.selected).toBe(true);
    expect(bowRow.ammoOptions.find((o) => o.value === "ammo1")!.selected).toBe(false);
  });

  it("excludes out-of-stock ammo from the options; damageNote is blank with none in stock", () => {
    const c = buildCharacterSheetContext(
      input({
        physicalItems: [
          physItem({
            id: "bow1", name: "Short Bow", type: "weapon", equipped: true,
            weapon: {
              damageVsSM: null, damageVsL: null, speedFactor: 7, range: "50/100/150", category: "bow", damageType: null,
              ammoType: "arrow", selectedAmmoId: null,
            },
          }),
          physItem({
            id: "ammo1", name: "Arrow", type: "ammo", quantity: 0,
            ammo: { ammoType: "arrow", damageVsSM: "1d6", damageVsL: "1d6", damageType: "piercing" },
          }),
        ],
      }),
    );
    const bowRow = c.combat.weapons.find((w) => w.id === "bow1")!;
    expect(bowRow.ammoOptions).toEqual([]);
    expect(bowRow.damageNote).toBe("");
  });
```

- [ ] **Step 10: Run the full context test file and confirm everything passes**

Run: `npx vitest run tests/sheets/character/context.test.ts`
Expected: PASS (all cases, old and new).

- [ ] **Step 11: Run coverage for the pure zone**

Run: `npm run test:coverage`
Expected: `src/combat/ammo.ts` and `src/sheets/character/context.ts` still meet the 100%/100%/100%/90% gate. If a branch is missed (e.g. the `selectedAmmoItem?.ammo?` optional chain), add a covering case before moving on.

- [ ] **Step 12: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add src/sheets/character/context-types.ts src/sheets/character/context.ts src/sheets/character/sheet.ts tests/sheets/character/context.test.ts
git commit -m "feat(sheet): PC sheet weapon rows gain ammo-aware damage notes and ammo options"
```

---

### Task 5: Attack roll — validate, consume, and select ammo

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts`, `src/sheets/character/sheet.ts`, `templates/actor/pc/partials/pc-main-panels.hbs`, `lang/en.json`
- Test: `tests/lang/en-coverage.test.ts` (existing convention: one new `describe` block per feature's new keys)

**Interfaces:**
- Consumes: `matchingAmmo`, `AmmoStock` (Task 2); `AttackCardInput["damageContext"].ammoItemId` (Task 3); `w.ammoType`/`w.ammoOptions` (Task 4).
- Produces: `rollAttack(actor, weaponItemId, backstab, maneuverId, ammoItemId)` — a new 5th parameter, `ammoItemId: string | null = null`.

This task is Foundry-coupled glue (`combat-rolls.ts`/`sheet.ts`/templates are not unit-tested per this codebase's established convention — see their own header comments) — verified in Task 9's dev-world check instead of a unit test.

- [ ] **Step 1: Extend `WeaponItemHandle`/`GenericAttackerItem`**

In `src/sheets/character/combat-rolls.ts`, update:
```typescript
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
    damageType: string | null;
  };
}
/** Minimal shape needed to find the actor's class chassis and weapon-proficiency
 *  items without a dedicated Item subtype per iteration entry. */
interface GenericAttackerItem {
  type: string;
  system: Record<string, unknown>;
}
```
to:
```typescript
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
    damageType: string | null;
    /** bow/crossbow only — null for melee/thrown */
    ammoType: string | null;
  };
}
/** Minimal shape needed to find the actor's class chassis and weapon-proficiency
 *  items without a dedicated Item subtype per iteration entry — also used to
 *  find the actor's owned `ammo` items for a bow/crossbow attack. */
interface GenericAttackerItem {
  id: string;
  type: string;
  system: Record<string, unknown>;
}
```

- [ ] **Step 2: Import the ammo helper**

Add near the top of `src/sheets/character/combat-rolls.ts` (after the `buildSaveCardContext` import):
```typescript
import { matchingAmmo } from "../../combat/ammo";
import type { AmmoStock } from "../../combat/ammo";
```

- [ ] **Step 3: Add the `ammoItemId` parameter**

Change the `rollAttack` signature:
```typescript
export async function rollAttack(
  actor: AttackerActor,
  weaponItemId: string,
  backstab = false,
  maneuverId: ManeuverId | null = null,
  ammoItemId: string | null = null,
): Promise<void> {
```

- [ ] **Step 4: Validate ammo before doing anything else (right after the `canAct` check)**

Insert immediately after the existing:
```typescript
  if (!canAct(actor.statuses)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.cannotActWarning"));
    return;
  }
```
this new block:
```typescript
  // A bow/crossbow deals no damage of its own — it must have a valid,
  // in-stock ammo item selected before anything else happens, checked here
  // (before the target/manual-AC prompt) so there's nothing to loose and
  // nothing to roll for damage without one.
  const weaponAmmoType = weapon.system.ammoType;
  let ammoToConsume: { id: string; quantity: number; update(d: Record<string, unknown>): Promise<unknown> } | null = null;
  if (weaponAmmoType) {
    const ammoItems = [...actor.items].filter((i) => i.type === "ammo");
    const stock: AmmoStock[] = ammoItems.map((i) => ({
      id: i.id,
      ammoType: String((i.system as { ammoType?: string }).ammoType ?? ""),
      quantity: Number((i.system as { quantity?: number }).quantity ?? 0),
    }));
    const chosen = ammoItemId ? matchingAmmo(stock, weaponAmmoType).find((a) => a.id === ammoItemId) : undefined;
    if (!chosen) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.noAmmoWarning"));
      return;
    }
    const handle = ammoItems.find((i) => i.id === chosen.id)! as unknown as {
      id: string; update(d: Record<string, unknown>): Promise<unknown>;
    };
    ammoToConsume = { id: handle.id, quantity: chosen.quantity, update: handle.update.bind(handle) };
  }
```

- [ ] **Step 5: Consume the ammo once the to-hit roll has actually happened**

Right after the existing:
```typescript
  const roll = await new Roll(formula).evaluate();
```
insert:
```typescript
  // Consumed here — hit or miss — and only after every earlier return point
  // (canAct, ammo validation, the manual-AC prompt) has passed, so cancelling
  // that prompt never costs an arrow.
  if (ammoToConsume) {
    await ammoToConsume.update({ "system.quantity": ammoToConsume.quantity - 1 });
  }
```

- [ ] **Step 6: Thread `ammoItemId` into the attack card's `damageContext`**

Change:
```typescript
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
          critMultiplier: crit?.damageMultiplier ?? null,
          critFlatBonus: crit?.flatBonus ?? 0,
        }
      : null,
```
to:
```typescript
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          ammoItemId: ammoToConsume?.id ?? null,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
          critMultiplier: crit?.damageMultiplier ?? null,
          critFlatBonus: crit?.flatBonus ?? 0,
        }
      : null,
```

- [ ] **Step 7: Read the ammo select in `sheet.ts`'s `#onRollAttack`**

In `src/sheets/character/sheet.ts`, change:
```typescript
  static async #onRollAttack(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (!weaponItemId) return;
    const weaponRow = target.closest(".weapon-row");
    const backstabCheckbox = weaponRow?.querySelector<HTMLInputElement>(".backstab-toggle");
    const maneuverSelect = weaponRow?.querySelector<HTMLSelectElement>(".maneuver-select");
    const maneuverId = (maneuverSelect?.value || null) as ManeuverId | null;
    await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false, maneuverId);
  }
```
to:
```typescript
  static async #onRollAttack(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (!weaponItemId) return;
    const weaponRow = target.closest(".weapon-row");
    const backstabCheckbox = weaponRow?.querySelector<HTMLInputElement>(".backstab-toggle");
    const maneuverSelect = weaponRow?.querySelector<HTMLSelectElement>(".maneuver-select");
    const maneuverId = (maneuverSelect?.value || null) as ManeuverId | null;
    const ammoSelect = weaponRow?.querySelector<HTMLSelectElement>(".ammo-select");
    const ammoItemId = ammoSelect?.value || null;
    await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false, maneuverId, ammoItemId);
  }
```
(Persistence needs no new listener: the select gets `data-field="selectedAmmoId"` in Step 8, and `_onRender`'s existing generic `[data-item-id][data-field]` change-listener loop — `src/sheets/character/sheet.ts`'s `#onItemFieldChange` — already persists any such field via `item.update({"system.<field>": value})`.)

- [ ] **Step 8: Add the ammo select to the weapon row template**

In `templates/actor/pc/partials/pc-main-panels.hbs`, inside `{{#if w.equipped}}`, insert the ammo select before the maneuver select:
```hbs
          {{#if w.equipped}}
            {{#if w.canBackstab}}<label class="backstab-label"><input type="checkbox" class="backstab-toggle" data-item-id="{{w.id}}"> {{localize 'ADND2E.sheet.combat.backstab'}}</label>{{/if}}
            {{#if w.ammoType}}
              <select class="ammo-select" data-item-id="{{w.id}}" data-field="selectedAmmoId">
                {{#if w.ammoOptions.length}}
                  {{#each w.ammoOptions as |opt|}}<option value="{{opt.value}}" {{#if opt.selected}}selected{{/if}}>{{opt.label}}</option>{{/each}}
                {{else}}
                  <option value="" disabled selected>{{localize 'ADND2E.sheet.combat.noAmmo'}}</option>
                {{/if}}
              </select>
            {{/if}}
            {{#if @root.adnd2e.combat.maneuverOptions.length}}
              <select class="maneuver-select" data-item-id="{{w.id}}">
                <option value="">{{localize 'ADND2E.sheet.combat.maneuverNone'}}</option>
                {{#each @root.adnd2e.combat.maneuverOptions as |opt|}}<option value="{{opt.value}}">{{localize opt.label}}</option>{{/each}}
              </select>
            {{/if}}
            <button type="button" class="kit-roll" data-action="rollAttack" data-item-id="{{w.id}}">{{localize 'ADND2E.sheet.combat.rollAttack'}}</button>
          {{/if}}
```

- [ ] **Step 9: Add the two new lang keys**

In `lang/en.json`:
- In `ADND2E.chat.attack`, add `"noAmmoWarning": "No matching ammunition is equipped for this weapon."` right after `"cannotActWarning"`.
- In `ADND2E.sheet.combat`, add `"noAmmo": "No ammo"` right after `"maneuverNone"`.

- [ ] **Step 10: Add the lang-coverage test block**

Append to the end of `tests/lang/en-coverage.test.ts` (after the file's final `});`):
```typescript

describe("lang/en.json — bow/crossbow ammunition strings", () => {
  it("resolves the ammo-select and no-ammo-warning keys", () => {
    for (const key of ["ADND2E.sheet.combat.noAmmo", "ADND2E.chat.attack.noAmmoWarning"]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 11: Run the lang-coverage test**

Run: `npx vitest run tests/lang/en-coverage.test.ts`
Expected: PASS.

- [ ] **Step 12: Typecheck and lint**

Run: `npm run typecheck`
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/sheets/character/sheet.ts templates/actor/pc/partials/pc-main-panels.hbs lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(combat): validate, consume, and select ammo when rolling a bow/crossbow attack"
```

---

### Task 6: Damage roll sources dice from the consumed ammo

**Files:**
- Modify: `src/chat/chat-listeners.ts`

**Interfaces:**
- Consumes: `AttackCardInput["damageContext"].ammoItemId` (Task 3, set by Task 5).
- Produces: nothing new — `onRollDamage()`'s behavior for melee/thrown weapons is unchanged; for a bow/crossbow it now resolves real dice instead of silently skipping the roll.

Foundry-coupled glue (no unit test — see `chat-listeners.ts`'s own header comment), verified in Task 9.

- [ ] **Step 1: Read `ammoItemId` and source dice from it when present**

In `src/chat/chat-listeners.ts`, change:
```typescript
async function onRollDamage(button: HTMLButtonElement): Promise<void> {
  const { actorUuid, weaponItemId, targetSize, backstabMultiplier, critMultiplier, critFlatBonus } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    targetSize?: string;
    backstabMultiplier?: string;
    critMultiplier?: string;
    critFlatBonus?: string;
  };
  const actor = (fromUuidSync as (uuid: string) => unknown)(actorUuid ?? "") as {
    name: string;
    img: string;
    items: {
      get(id: string):
        | { name: string; system: { damageVsSM: string | null; damageVsL: string | null; magicBonus: number } }
        | undefined;
    };
  } | null;
  const weapon = actor?.items.get(weaponItemId ?? "");
  if (!actor || !weapon) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.sourceNotFoundWarning"));
    return;
  }
  const dice = pickDamageDice(
    { damageVsSM: weapon.system.damageVsSM, damageVsL: weapon.system.damageVsL },
    (targetSize as never) || null,
  );
  if (!dice) return; // no dice modeled (e.g. a ranged weapon with no ammo item — spec §7)
```
to:
```typescript
async function onRollDamage(button: HTMLButtonElement): Promise<void> {
  const { actorUuid, weaponItemId, ammoItemId, targetSize, backstabMultiplier, critMultiplier, critFlatBonus } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    ammoItemId?: string;
    targetSize?: string;
    backstabMultiplier?: string;
    critMultiplier?: string;
    critFlatBonus?: string;
  };
  const actor = (fromUuidSync as (uuid: string) => unknown)(actorUuid ?? "") as {
    name: string;
    img: string;
    items: {
      get(id: string):
        | { name: string; system: { damageVsSM: string | null; damageVsL: string | null; magicBonus: number } }
        | undefined;
    };
  } | null;
  const weapon = actor?.items.get(weaponItemId ?? "");
  if (!actor || !weapon) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.sourceNotFoundWarning"));
    return;
  }
  // A bow/crossbow's own damage dice are null — the ammo item consumed for
  // this shot (attack card's damageContext.ammoItemId, Task 5) carries the
  // real dice instead. Melee/thrown weapons have no ammoItemId and are
  // unaffected (docs/superpowers/specs/2026-09-28-adnd2e-ammunition-design.md).
  const ammo = ammoItemId ? actor.items.get(ammoItemId) : undefined;
  const diceSource = ammo ?? weapon;
  const dice = pickDamageDice(
    { damageVsSM: diceSource.system.damageVsSM, damageVsL: diceSource.system.damageVsL },
    (targetSize as never) || null,
  );
  if (!dice) return; // no dice modeled (no ammo item resolved for a bow/crossbow)
```
(The rest of the function — damage bonus from `weapon.system.magicBonus`, formula, roll, card — is unchanged: the weapon stays the source for name and magic bonus; only the dice source changes.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the existing `items.get()` return shape already has `damageVsSM`/`damageVsL`, which every ammo item also carries via the inherited physical-item + ammo schema fields, so no type change is needed here).

- [ ] **Step 3: Commit**

```bash
git add src/chat/chat-listeners.ts
git commit -m "feat(combat): roll bow/crossbow damage from the consumed ammo item's dice"
```

---

### Task 7: README (controller may do directly)

In `README.md`, replace the backlog bullet:
> - **Ammunition isn't modeled, so bows and crossbows deal no damage.** Per the PHB a bow or crossbow has no damage of its own — the arrow, bolt or quarrel does. Launchers here have empty damage dice, so their attacks (PC and Monster NPC alike) post a hit/miss card with no damage roll. Proper fix: ammunition items that carry the damage (S-M / L), selected or equipped with the launcher and consumed on use.

with:
> - **Monster NPC bows and crossbows still deal no damage.** Ammunition is now modeled for PCs (arrow/bolt items, S-M / L damage, selected per weapon and consumed on every shot, hit or miss) but Monster NPC ranged attacks keep using the existing flat weapon-damage formula, unaffected — a deliberate v1 scope boundary, matching how Monster NPC weapon attacks are already simpler than PC ones elsewhere.

Commit: `docs: bow/crossbow ammunition backlog item resolved for PCs`.

---

### Task 8: Whole-branch review (MANDATORY)

Most capable model over `base..HEAD` with this plan, the spec, and this risk list:
- **Ammo validation happens before the manual-AC prompt** (Task 5 Step 4 is before target resolution) — cancelling that prompt must never consume an arrow; consumption itself (Step 5) is after the to-hit roll evaluates, on every remaining code path (hit, miss, crit, fumble, backstab).
- **Never trust the dropdown's value** — `rollAttack()` re-validates `ammoItemId` against the actor's real owned ammo (type, `ammoType` match, `quantity > 0`) rather than assuming the DOM value is honest, mirroring the existing `maneuverId` re-validation pattern in the same function.
- **Melee/thrown weapons are byte-identical** — `ammoType`/`selectedAmmoId` stay `null`, so `weaponAmmoType` is falsy and the entire ammo branch in `rollAttack()`/`onRollDamage()` is skipped; the ammo select never renders for them.
- **`toWeaponData()`/`weaponData` genuinely untouched** — confirm no task accidentally routed ammo resolution through it after all.
- **Monster NPC path untouched**: `monster-gear.ts`, `src/sheets/creature/*` have zero diff; `ammo` correctly rejected by `monsterDropVerdict`.
- **Quantity never goes negative**: confirm there's no double-decrement path (e.g. a re-render re-triggering the change listener) and that `ammoToConsume.quantity - 1` uses the value captured before the write, not a stale closure across an `await`.
- **`damageContext.ammoItemId` freezes the shot's ammo** — switching the dropdown after an attack card posts, before clicking "Roll Damage", must not change what that already-posted card rolls.
- **Pure-zone coverage**: `src/combat/ammo.ts` and the new branches in `src/sheets/character/context.ts` hit 100%/100%/100%/≥90%; re-run `npm run test:coverage`.
- **Lang/typecheck/lint** all clean; `tests/data/subtypes.test.ts` and `tests/lang/en-coverage.test.ts`'s `TYPES.Item` checks pass with `ammo` included.

One fix wave + scoped re-review for Critical/Important findings.

---

### Task 9: GATED dev-world smoke check

Confirm Foundry closed → `npm run build` → `npm run link` → restart. Setup: a PC with a Short Bow (`ammoType: "arrow"`) and a Light Crossbow (`ammoType: "bolt"`), an Arrow item (qty 3, `damageVsSM`/`damageVsL`: "1d6"), a Flight Arrow item (qty 2, same `ammoType: "arrow"`), a Bolt item (qty 1), and a target token.

- [ ] **Ammo select appears** on both ranged weapon rows once equipped, listing only same-`ammoType` in-stock ammo with remaining counts; a melee weapon (e.g. a Long Sword) shows no ammo select at all.
- [ ] **Shoot the bow, hit:** attack card posts normally; Arrow quantity drops from 3 to 2; "Roll Damage" rolls `1d6` (or `1d6`/L die if a Large target). Repeat to a miss: Arrow quantity still drops (2 → 1) even though no damage is rolled.
- [ ] **Switch to Flight Arrow** via the dropdown, shoot once: Flight Arrow's quantity drops instead of Arrow's; reopening the sheet keeps Flight Arrow selected (persistence survives a re-render).
- [ ] **Shoot the bow to 0 ammo:** with Arrow and Flight Arrow both at 0, the dropdown shows "No ammo" (disabled); clicking Roll Attack shows the warning toast and posts no card.
- [ ] **Cancel the manual-AC prompt** (no token targeted) on a valid-ammo bow shot: confirm the ammo quantity is unchanged (the prompt cancel must not consume an arrow).
- [ ] **Crossbow uses Bolt independently** of the bow's Arrow stock; a Bolt with `ammoType` not matching (e.g. mislabeled) does not appear in the bow's list.
- [ ] **Monster NPC rejection:** dragging the Arrow item onto a Monster NPC sheet shows the existing "type rejected" toast and creates nothing.
- [ ] **Melee weapon unaffected:** the Long Sword still attacks and rolls damage exactly as before this branch.
- [ ] Report PASS/FAIL via `AskUserQuestion`.

## After this plan lands

Push + PR (standing default); update memory; ask what's next.
