# Character Kit Engine, Plan A (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owned `kit` item that modifies a character's class: qualifications, an XP-per-level modifier, typed effects, armor/weapon restriction overrides, forbidden weapon proficiencies and linked features, plus real enforcement of the base class equipment restrictions.

**Architecture:** A pure `src/core/kits/` module (qualifications, equipment rules and normalizer, XP scaling). A `kit` item DataModel and `kits` compendium. Kit effects feed the existing trait-totals reducer (ungated), the XP modifier scales a class's thresholds through an optional parameter, drops are hard-blocked through `validateItemDrop`, and equipment restrictions warn through an `updateItem` hook plus a row flag.

**Tech Stack:** TypeScript, Foundry VTT v14 (DataModels, ApplicationV2 sheets), Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-adnd2e-sp11a-kit-engine-design.md`

## Global Constraints

- A kit is an owned `kit` Item. Not an ActiveEffect, not a field on the class item. One kit per class chassis per actor.
- Equipment restrictions **warn and still equip** (toast + "not permitted" row flag). Unequipped items are never flagged. Kit **qualifications hard-block the drop** with a reason toast.
- Kit effects reuse the trait effect kinds (`abilityBonus`, `saveBonus`, `attackBonus`, `proficiencySlots`, `bonusHp`) and the existing `traitEffectTotals` reducer. Kit effects apply regardless of the SP8 character-point rule (traits stay gated by it).
- A kit's effects and XP modifier apply only while the actor owns a class item with the kit's chassis.
- `src/core/**`, `src/data/derive/**`, `src/data/item/choices.ts`, `src/combat/**` and `src/sheets/character/drop-rules.ts` stay Foundry-free (`npm run typecheck` proves it). `src/core/kits/` must not import another core domain at runtime (types only).
- Name collision to avoid: `src/sheets/kit/` and `src/sheets/kit-*.ts` are the sheet **theme** kit. Character-kit code goes in `src/core/kits/`, `src/data/derive/character/kits.ts`, `src/data/derive/character/equipment-rules.ts`. Do not touch the theme-kit files.
- Content policy: sample kits carry mechanical data only, own-design names beginning "Sample", no rulebook prose.
- Character NPC sheet rejects kit drops (like traits). Kit UI is PC-sheet only.
- Run `npm test` and `npm run typecheck` before every commit. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/adnd2e-sp11a-kit-engine` (created; spec committed).
- Out of scope: parametrized powers (Plan B), base-class overrides (Plan C), required/auto-granted proficiencies, race kits, bespoke kit mini-mechanics.

---

## File Structure

- Create `src/core/kits/qualifications.ts`, `equipment.ts`, `xp.ts`, `index.ts`; modify `src/core/index.ts`.
- Create `tests/core/kits/qualifications.test.ts`, `equipment.test.ts`, `xp.test.ts`.
- Create `src/data/item/kit.ts`; modify `src/data/item/{subtypes,index,choices}.ts`, `system.json`, `lang/en.json`.
- Create `packs/kits/_source/` (manifest + 3 docs); modify `tests/packs/content.test.ts`.
- Create `src/data/derive/character/kits.ts`, `src/data/derive/character/equipment-rules.ts`; modify `src/data/derive/character/{traits,derive,snapshot,levels}.ts`, `src/data/derive/class-item.ts`, `src/data/item/class.ts`, `src/data/actor/{snapshot,base-actor}.ts`, `src/sheets/character/{xp,context,context-types,combat-rolls,sheet}.ts`.
- Create `tests/data/derive/kits.test.ts`, `tests/data/derive/equipment-rules.test.ts`.
- Modify `src/sheets/character/drop-rules.ts`, `src/sheets/npc/sheet.ts`, `src/sheets/character/sheet.ts` (drop handler, rows, Features panel), `templates/actor/pc/partials/pc-item-table.hbs`, `templates/actor/pc/partials/pc-feature-panels.hbs`.
- Create `src/hooks/equipment-hooks.ts`; modify `src/system.ts`.
- Modify `README.md`.

---

### Task 1: Kits rules core

**Files:**
- Create: `src/core/kits/qualifications.ts`, `src/core/kits/equipment.ts`, `src/core/kits/xp.ts`, `src/core/kits/index.ts`
- Modify: `src/core/index.ts`
- Test: `tests/core/kits/qualifications.test.ts`, `tests/core/kits/equipment.test.ts`, `tests/core/kits/xp.test.ts`

**Interfaces (produced, consumed by Tasks 2-6):**
- `KitQualifications { abilityMinimums: Record<AbilityKey, number>; races: readonly Race[]; alignments: readonly Alignment[] }`
- `KitQualifyActor { abilities: Record<AbilityKey, number>; race: Race | null; alignment: Alignment | null }`
- `type KitQualifyVerdict = { ok: true } | { ok: false; reason: string }`
- `kitQualifies(q, actor): KitQualifyVerdict` (reasons `ADND2E.sheet.drop.kitAbility` / `kitRace` / `kitAlignment`)
- `kitForbidsProficiency(forbidden: readonly string[], weaponOrGroup: string): boolean`
- `EQUIPMENT_MODES`, `type EquipmentMode`, `ARMOR_TYPE_IDS`, `type ArmorRule`, `type WeaponRule`, `interface EquipmentOverride { mode: EquipmentMode; names: readonly string[] }`
- `armorRuleFromNames`, `baseArmorRule`, `weaponRuleFromNames`, `baseWeaponRule`, `resolveArmorRule`, `resolveWeaponRule`, `armorPermitted`, `weaponPermitted`, `armorPermittedByAny`, `weaponPermittedByAny`
- `kitXpPercentFor(kits, chassisId): number`, `scaleThreshold(base, percent): number`, `scaleChassisXp(chassis, percent): ClassChassis`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/kits/qualifications.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { kitForbidsProficiency, kitQualifies } from "../../../src/core/kits";

const none = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const scores = { str: 10, dex: 14, con: 12, int: 9, wis: 9, cha: 9 };
const actor = { abilities: scores, race: "human" as const, alignment: "lawful-good" as const };

describe("kitQualifies", () => {
  it("passes with no requirements", () => {
    expect(kitQualifies({ abilityMinimums: none, races: [], alignments: [] }, actor)).toEqual({ ok: true });
  });
  it("passes when every minimum is met (equal counts)", () => {
    expect(kitQualifies({ abilityMinimums: { ...none, dex: 14, con: 12 }, races: [], alignments: [] }, actor)).toEqual({ ok: true });
  });
  it("fails an unmet ability minimum", () => {
    expect(kitQualifies({ abilityMinimums: { ...none, dex: 15 }, races: [], alignments: [] }, actor)).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.kitAbility",
    });
  });
  it("a zero minimum is no requirement", () => {
    expect(kitQualifies({ abilityMinimums: { ...none, str: 0 }, races: [], alignments: [] }, { ...actor, abilities: { ...scores, str: 3 } })).toEqual({ ok: true });
  });
  it("fails a race gate, including a race-less actor", () => {
    const q = { abilityMinimums: none, races: ["elf" as const], alignments: [] };
    expect(kitQualifies(q, actor)).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitRace" });
    expect(kitQualifies(q, { ...actor, race: null })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitRace" });
    expect(kitQualifies(q, { ...actor, race: "elf" })).toEqual({ ok: true });
  });
  it("fails an alignment gate", () => {
    const q = { abilityMinimums: none, races: [], alignments: ["chaotic-evil" as const] };
    expect(kitQualifies(q, actor)).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitAlignment" });
  });
});

describe("kitForbidsProficiency", () => {
  it("matches names and groups case-insensitively", () => {
    expect(kitForbidsProficiency(["Long Bow", "Blades"], "long bow")).toBe(true);
    expect(kitForbidsProficiency(["Long Bow", "Blades"], " BLADES ")).toBe(true);
    expect(kitForbidsProficiency(["Long Bow"], "Short Bow")).toBe(false);
    expect(kitForbidsProficiency([], "Long Bow")).toBe(false);
  });
});
```

Create `tests/core/kits/equipment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ARMOR_TYPE_IDS, armorPermitted, armorPermittedByAny, baseArmorRule, baseWeaponRule, resolveArmorRule,
  resolveWeaponRule, weaponPermitted, weaponPermittedByAny,
} from "../../../src/core/kits";
import { getChassis } from "../../../src/core/classes/chassis";
import { ARMOR_TYPES, CLASS_IDS } from "../../../src/data/item/choices";

describe("ARMOR_TYPE_IDS", () => {
  it("equals the item schema's ARMOR_TYPES", () => {
    expect([...ARMOR_TYPE_IDS]).toEqual([...ARMOR_TYPES]);
  });
});

describe("chassis restriction data normalizes", () => {
  it("every armor name maps to an item armor type except the two the item schema has no id for", () => {
    const unmapped = CLASS_IDS.flatMap((id) => baseArmorRule(getChassis(id).armorAllowed).unmapped);
    expect([...new Set(unmapped)].sort()).toEqual(["brigandine", "hide"]);
  });
  it("every weapon category is the one the normalizer understands (blunt)", () => {
    for (const id of CLASS_IDS) {
      const allowed = getChassis(id).weaponsAllowed;
      expect(baseWeaponRule(allowed).unmappedCategories, id).toEqual([]);
    }
  });
});

describe("baseArmorRule / armorPermitted", () => {
  it("any permits everything", () => {
    const { rule } = baseArmorRule("any");
    expect(armorPermitted(rule, { armorType: "full-plate", isShield: false })).toBe(true);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(true);
  });
  it("none permits no armor and no shield, but bare skin (type none) is fine", () => {
    const { rule } = baseArmorRule("none");
    expect(armorPermitted(rule, { armorType: "leather", isShield: false })).toBe(false);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(false);
    expect(armorPermitted(rule, { armorType: "none", isShield: false })).toBe(true);
  });
  it("a name list maps names to ids (studded leather, elven chain) and ignores unknown names", () => {
    const { rule, unmapped } = baseArmorRule(["leather", "studded leather", "padded", "elven chain", "hide"]);
    expect(unmapped).toEqual(["hide"]);
    expect(armorPermitted(rule, { armorType: "studded-leather", isShield: false })).toBe(true);
    expect(armorPermitted(rule, { armorType: "elven-chain", isShield: false })).toBe(true);
    expect(armorPermitted(rule, { armorType: "chain-mail", isShield: false })).toBe(false);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(false);
  });
  it('"shield" in a list permits shields', () => {
    const { rule } = baseArmorRule(["leather", "shield"]);
    expect(armorPermitted(rule, { armorType: "none", isShield: true })).toBe(true);
  });
});

describe("baseWeaponRule / weaponPermitted", () => {
  const mage = baseWeaponRule({ names: ["dagger", "staff"] }).rule;
  const blunt = baseWeaponRule({ categories: ["blunt"] }).rule;
  it("matches a name case-insensitively, preferring the base weapon name", () => {
    expect(weaponPermitted(mage, { name: "Dagger", baseWeaponName: "", damageType: "piercing" })).toBe(true);
    expect(weaponPermitted(mage, { name: "Frostbite", baseWeaponName: "Dagger", damageType: "piercing" })).toBe(true);
    expect(weaponPermitted(mage, { name: "Long Sword", baseWeaponName: "", damageType: "slashing" })).toBe(false);
  });
  it("blunt permits any bludgeoning or piercing-bludgeoning weapon", () => {
    expect(weaponPermitted(blunt, { name: "Mace", baseWeaponName: "", damageType: "bludgeoning" })).toBe(true);
    expect(weaponPermitted(blunt, { name: "Flail", baseWeaponName: "", damageType: "piercing-bludgeoning" })).toBe(true);
    expect(weaponPermitted(blunt, { name: "Sword", baseWeaponName: "", damageType: "slashing" })).toBe(false);
    expect(weaponPermitted(blunt, { name: "Rock", baseWeaponName: "", damageType: null })).toBe(false);
  });
  it("any permits everything", () => {
    expect(weaponPermitted(baseWeaponRule("any").rule, { name: "x", baseWeaponName: "", damageType: null })).toBe(true);
  });
});

describe("kit overrides", () => {
  const mageArmor = baseArmorRule("none").rule;
  it("inherit keeps the base rule", () => {
    expect(resolveArmorRule(mageArmor, { mode: "inherit", names: ["leather"] })).toBe(mageArmor);
  });
  it("replace swaps the rule, even from any", () => {
    const r = resolveArmorRule(baseArmorRule("any").rule, { mode: "replace", names: ["leather"] });
    expect(armorPermitted(r, { armorType: "leather", isShield: false })).toBe(true);
    expect(armorPermitted(r, { armorType: "chain-mail", isShield: false })).toBe(false);
  });
  it("extend adds to a restricted base and leaves any alone", () => {
    const r = resolveArmorRule(mageArmor, { mode: "extend", names: ["leather"] });
    expect(armorPermitted(r, { armorType: "leather", isShield: false })).toBe(true);
    const any = baseArmorRule("any").rule;
    expect(resolveArmorRule(any, { mode: "extend", names: ["leather"] })).toBe(any);
  });
  it("weapon extend unions names and the blunt flag", () => {
    const base = baseWeaponRule({ names: ["dagger"] }).rule;
    const r = resolveWeaponRule(base, { mode: "extend", names: ["Short Sword", "blunt"] });
    expect(weaponPermitted(r, { name: "Dagger", baseWeaponName: "", damageType: null })).toBe(true);
    expect(weaponPermitted(r, { name: "Short Sword", baseWeaponName: "", damageType: null })).toBe(true);
    expect(weaponPermitted(r, { name: "Mace", baseWeaponName: "", damageType: "bludgeoning" })).toBe(true);
  });
});

describe("permittedByAny (multiclass)", () => {
  const cleric = baseArmorRule("any").rule;
  const mage = baseArmorRule("none").rule;
  it("no classes means no restriction", () => {
    expect(armorPermittedByAny([], { armorType: "plate-mail", isShield: false })).toBe(true);
    expect(weaponPermittedByAny([], { name: "x", baseWeaponName: "", damageType: null })).toBe(true);
  });
  it("is permitted if any class permits it", () => {
    expect(armorPermittedByAny([mage, cleric], { armorType: "plate-mail", isShield: false })).toBe(true);
    expect(armorPermittedByAny([mage], { armorType: "plate-mail", isShield: false })).toBe(false);
  });
});
```

Create `tests/core/kits/xp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { kitXpPercentFor, scaleChassisXp, scaleThreshold } from "../../../src/core/kits";
import { getChassis } from "../../../src/core/classes/chassis";
import { levelForXp } from "../../../src/core/classes/progression";

describe("scaleThreshold", () => {
  it("scales by percent, flooring", () => {
    expect(scaleThreshold(2000, 25)).toBe(2500);
    expect(scaleThreshold(2000, -10)).toBe(1800);
    expect(scaleThreshold(1, 10)).toBe(1);
    expect(scaleThreshold(0, 25)).toBe(0);
    expect(scaleThreshold(2000, 0)).toBe(2000);
  });
});

describe("kitXpPercentFor", () => {
  it("returns the matching kit's percent, else 0", () => {
    const kits = [{ chassisId: "fighter", xpModifierPercent: 25 }];
    expect(kitXpPercentFor(kits, "fighter")).toBe(25);
    expect(kitXpPercentFor(kits, "mage")).toBe(0);
    expect(kitXpPercentFor([], "fighter")).toBe(0);
  });
});

describe("scaleChassisXp", () => {
  const fighter = getChassis("fighter");
  it("returns the same chassis for 0%", () => {
    expect(scaleChassisXp(fighter, 0)).toBe(fighter);
  });
  it("raises every threshold, so a level is reached later", () => {
    const scaled = scaleChassisXp(fighter, 25);
    const level2 = fighter.xpThresholds[1]!;
    expect(levelForXp(fighter, level2)).toBe(2);
    expect(levelForXp(scaled, level2)).toBe(1);
    expect(levelForXp(scaled, scaleThreshold(level2, 25))).toBe(2);
    expect(scaled.xpThresholds[0]).toBe(0);
    expect(scaled.xpPerLevelBeyond20).toBe(scaleThreshold(fighter.xpPerLevelBeyond20, 25));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/kits`
Expected: FAIL (cannot resolve `src/core/kits`).

- [ ] **Step 3: Implement**

Create `src/core/kits/qualifications.ts`:

```ts
import type { AbilityKey, Alignment, Race } from "../types";

/* Character-kit qualifications (SP11 Plan A). Pure. */

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export interface KitQualifications {
  /** per-ability minimum score; 0 = no minimum */
  abilityMinimums: Record<AbilityKey, number>;
  /** empty = any race */
  races: readonly Race[];
  /** empty = any alignment */
  alignments: readonly Alignment[];
}

export interface KitQualifyActor {
  abilities: Record<AbilityKey, number>;
  race: Race | null;
  alignment: Alignment | null;
}

export type KitQualifyVerdict = { ok: true } | { ok: false; reason: string };

/** The first unmet qualification as an i18n reason key, or ok. */
export function kitQualifies(q: KitQualifications, actor: KitQualifyActor): KitQualifyVerdict {
  for (const key of ABILITY_KEYS) {
    const min = q.abilityMinimums[key];
    if (min > 0 && actor.abilities[key] < min) return { ok: false, reason: "ADND2E.sheet.drop.kitAbility" };
  }
  if (q.races.length > 0 && (actor.race === null || !q.races.includes(actor.race))) {
    return { ok: false, reason: "ADND2E.sheet.drop.kitRace" };
  }
  if (q.alignments.length > 0 && (actor.alignment === null || !q.alignments.includes(actor.alignment))) {
    return { ok: false, reason: "ADND2E.sheet.drop.kitAlignment" };
  }
  return { ok: true };
}

/** True when a kit's forbidden list names this weapon proficiency (a weapon name or a group), case-insensitively. */
export function kitForbidsProficiency(forbidden: readonly string[], weaponOrGroup: string): boolean {
  const key = weaponOrGroup.trim().toLowerCase();
  return forbidden.some((f) => f.trim().toLowerCase() === key);
}
```

Create `src/core/kits/equipment.ts`:

```ts
import type { ArmorType } from "../types";

/* Class + kit equipment restrictions (SP11 Plan A). Pure. The chassis data
 * (`armorAllowed` / `weaponsAllowed`) uses names ("studded leather") and a
 * "blunt" weapon category that don't match item data (armor type ids; weapon
 * damage types), so everything is normalized into ArmorRule / WeaponRule first. */

export const EQUIPMENT_MODES = ["inherit", "replace", "extend"] as const;
export type EquipmentMode = (typeof EQUIPMENT_MODES)[number];

/** Mirrors the item schema's ARMOR_TYPES (drift-tested). */
export const ARMOR_TYPE_IDS: readonly ArmorType[] = [
  "none", "padded", "leather", "studded-leather", "ring-mail", "scale-mail",
  "chain-mail", "elven-chain", "splint-mail", "banded-mail", "plate-mail",
  "field-plate", "full-plate",
];

export type RestrictedArmorRule = { any: false; types: readonly ArmorType[]; shield: boolean };
export type ArmorRule = { any: true } | RestrictedArmorRule;
export type RestrictedWeaponRule = { any: false; names: readonly string[]; blunt: boolean };
export type WeaponRule = { any: true } | RestrictedWeaponRule;

export interface EquipmentOverride {
  mode: EquipmentMode;
  names: readonly string[];
}

const slug = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, "-");

/** Names -> a restricted armor rule. "shield" permits shields; a name with no armor type id is returned in `unmapped`. */
export function armorRuleFromNames(names: readonly string[]): { rule: RestrictedArmorRule; unmapped: string[] } {
  const types: ArmorType[] = [];
  const unmapped: string[] = [];
  let shield = false;
  for (const name of names) {
    const id = slug(name);
    if (id === "shield") shield = true;
    else if ((ARMOR_TYPE_IDS as readonly string[]).includes(id)) {
      if (!types.includes(id as ArmorType)) types.push(id as ArmorType);
    } else unmapped.push(name);
  }
  return { rule: { any: false, types, shield }, unmapped };
}

export function baseArmorRule(allowed: "any" | "none" | readonly string[]): { rule: ArmorRule; unmapped: string[] } {
  if (allowed === "any") return { rule: { any: true }, unmapped: [] };
  if (allowed === "none") return { rule: { any: false, types: [], shield: false }, unmapped: [] };
  return armorRuleFromNames(allowed);
}

/** Names -> a restricted weapon rule. The token "blunt" sets the blunt flag; every other token is a weapon name. */
export function weaponRuleFromNames(names: readonly string[]): RestrictedWeaponRule {
  const out: string[] = [];
  let blunt = false;
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (key === "blunt") blunt = true;
    else if (key) out.push(key);
  }
  return { any: false, names: out, blunt };
}

export type BaseWeaponsAllowed =
  | "any"
  | { readonly categories?: readonly string[]; readonly names?: readonly string[] };

export function baseWeaponRule(allowed: BaseWeaponsAllowed): { rule: WeaponRule; unmappedCategories: string[] } {
  if (allowed === "any") return { rule: { any: true }, unmappedCategories: [] };
  const categories = (allowed.categories ?? []).map((c) => c.toLowerCase());
  return {
    rule: { any: false, names: (allowed.names ?? []).map((n) => n.trim().toLowerCase()), blunt: categories.includes("blunt") },
    unmappedCategories: categories.filter((c) => c !== "blunt"),
  };
}

export function resolveArmorRule(base: ArmorRule, override: EquipmentOverride): ArmorRule {
  if (override.mode === "inherit") return base;
  const kit = armorRuleFromNames(override.names).rule;
  if (override.mode === "replace") return kit;
  if (base.any) return base;
  return { any: false, types: [...new Set([...base.types, ...kit.types])], shield: base.shield || kit.shield };
}

export function resolveWeaponRule(base: WeaponRule, override: EquipmentOverride): WeaponRule {
  if (override.mode === "inherit") return base;
  const kit = weaponRuleFromNames(override.names);
  if (override.mode === "replace") return kit;
  if (base.any) return base;
  return { any: false, names: [...new Set([...base.names, ...kit.names])], blunt: base.blunt || kit.blunt };
}

export function armorPermitted(rule: ArmorRule, armor: { armorType: ArmorType; isShield: boolean }): boolean {
  if (rule.any) return true;
  if (armor.isShield) return rule.shield;
  if (armor.armorType === "none") return true;
  return rule.types.includes(armor.armorType);
}

export function weaponPermitted(
  rule: WeaponRule,
  weapon: { name: string; baseWeaponName: string; damageType: string | null },
): boolean {
  if (rule.any) return true;
  const key = (weapon.baseWeaponName || weapon.name).trim().toLowerCase();
  if (rule.names.includes(key)) return true;
  return rule.blunt && (weapon.damageType?.includes("bludgeoning") ?? false);
}

/** Multiclass: permitted when any of the actor's class rules permits it. No classes = no restriction. */
export function armorPermittedByAny(rules: readonly ArmorRule[], armor: { armorType: ArmorType; isShield: boolean }): boolean {
  return rules.length === 0 || rules.some((r) => armorPermitted(r, armor));
}

export function weaponPermittedByAny(
  rules: readonly WeaponRule[],
  weapon: { name: string; baseWeaponName: string; damageType: string | null },
): boolean {
  return rules.length === 0 || rules.some((r) => weaponPermitted(r, weapon));
}
```

Create `src/core/kits/xp.ts`:

```ts
import type { ClassChassis } from "../types";

/* Kit XP-per-level modifier (SP11 Plan A). Pure. */

/** The XP modifier percent of the kit modifying this chassis, or 0. */
export function kitXpPercentFor(
  kits: readonly { chassisId: string; xpModifierPercent: number }[],
  chassisId: string,
): number {
  return kits.find((k) => k.chassisId === chassisId)?.xpModifierPercent ?? 0;
}

/** `base` scaled by `percent` (+25 = 25% more), floored. */
export function scaleThreshold(base: number, percent: number): number {
  return Math.floor((base * (100 + percent)) / 100);
}

/** The chassis with its XP thresholds (and per-level step beyond 20) scaled. 0% returns the same object. */
export function scaleChassisXp(chassis: ClassChassis, percent: number): ClassChassis {
  if (percent === 0) return chassis;
  return {
    ...chassis,
    xpThresholds: chassis.xpThresholds.map((t) => scaleThreshold(t, percent)),
    xpPerLevelBeyond20: scaleThreshold(chassis.xpPerLevelBeyond20, percent),
  };
}
```

Create `src/core/kits/index.ts`:

```ts
export * from "./qualifications";
export * from "./equipment";
export * from "./xp";
```

Append to `src/core/index.ts`: `export * from "./kits";`

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/core/kits && npm run typecheck`
Expected: PASS. If the chassis-census test reports different unmapped armor names than `["brigandine", "hide"]`, read `src/core/classes/chassis.ts` and update only the expected list to exactly what the data contains (a new unmappable name must be a conscious decision; note it in the commit message).

- [ ] **Step 5: Commit**

```bash
git add src/core/kits src/core/index.ts tests/core/kits
git commit -m "feat(kits): kit rules core (qualifications, equipment rules, XP scaling)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The `kit` item type, schema, and sample compendium

**Files:**
- Create: `src/data/item/kit.ts`, `packs/kits/_source/_MANIFEST.md`, `packs/kits/_source/sample-duelist.json`, `packs/kits/_source/sample-hedge-mage.json`, `packs/kits/_source/sample-zealot.json`
- Modify: `src/data/item/subtypes.ts`, `src/data/item/index.ts`, `src/data/item/choices.ts`, `system.json`, `lang/en.json`, `tests/packs/content.test.ts`, plus any test or source that enumerates item types (see Step 3)

**Interfaces:**
- Consumes: `EQUIPMENT_MODES` from `src/core/kits` (Task 1); existing trait choices in `choices.ts`.
- Produces: item subtype `"kit"` with `system`: `chassisId: ClassId`, `qualifications: { abilityMinimums: Record<AbilityKey, number>; races: Race[]; alignments: Alignment[] }`, `xpModifierPercent: number`, `effects: RawTraitEffect[]`, `equipment: { armor: { mode; names: string[] }; weapons: { mode; names: string[] } }`, `forbiddenWeaponProficiencies: string[]`, `grantedFeatures: string[]`; `KIT_EQUIPMENT_MODES` in choices; a `kits` compendium.

- [ ] **Step 1: Write the failing tests**

Add to `tests/packs/content.test.ts` (extend the imports with `EQUIPMENT_MODES` from `../../src/core/kits`; `CLASS_IDS`, `RACE_IDS`, `ALIGNMENTS`, `ABILITY_KEYS` are available from `../../src/data/item/choices` — add the ones missing from its import list; `toTraitEffect`/`RawTraitEffect` are already imported):

```ts
describe("kits pack content", () => {
  const items = docs("kits");

  it("has three uniquely named and identified kit Items", () => {
    expect(items).toHaveLength(3);
    expect(new Set(items.map((d) => d._id)).size).toBe(3);
    expect(new Set(items.map((d) => d.name)).size).toBe(3);
    for (const d of items) {
      expect(d.type, String(d.name)).toBe("kit");
      expect(String(d._id)).toHaveLength(16);
      expect(String(d._key)).toBe(`!items!${String(d._id)}`);
      expect(String(d.name).startsWith("Sample"), String(d.name)).toBe(true);
    }
  });

  it("every kit is well-formed against the schema vocabularies", () => {
    for (const d of items) {
      const s = sys(d) as {
        chassisId: string;
        qualifications: { abilityMinimums: Record<string, number>; races: string[]; alignments: string[] };
        xpModifierPercent: number;
        effects: RawTraitEffect[];
        equipment: { armor: { mode: string; names: string[] }; weapons: { mode: string; names: string[] } };
      };
      expect(CLASS_IDS as readonly string[], String(d.name)).toContain(s.chassisId);
      expect(Object.keys(s.qualifications.abilityMinimums).sort()).toEqual([...ABILITY_KEYS].sort());
      for (const r of s.qualifications.races) expect(RACE_IDS as readonly string[]).toContain(r);
      for (const a of s.qualifications.alignments) expect(ALIGNMENTS as readonly string[]).toContain(a);
      expect(Number.isInteger(s.xpModifierPercent)).toBe(true);
      for (const e of s.effects) expect(toTraitEffect(e), String(d.name)).not.toBeNull();
      expect(EQUIPMENT_MODES as readonly string[]).toContain(s.equipment.armor.mode);
      expect(EQUIPMENT_MODES as readonly string[]).toContain(s.equipment.weapons.mode);
    }
  });
});
```

Also run `grep -rn '"trait"' tests src templates system.json scripts | grep -v "tests/packs\|derive/character/traits\|data/item/trait.ts"` and note every place that enumerates item types (not trait-specific logic) — Step 3 adds `kit` to each. Add `"kit"` to any test's expected item-type list now (e.g. `tests/data/subtypes.test.ts`, the en-coverage test's `TYPES.Item` check) so those tests fail first too.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/packs/content.test.ts tests/data`
Expected: FAIL (the pack directory and item type do not exist).

- [ ] **Step 3: Implement**

`src/data/item/choices.ts` — add near the other re-exports:

```ts
export { EQUIPMENT_MODES as KIT_EQUIPMENT_MODES } from "../../core/kits";
```

Create `src/data/item/kit.ts`:

```ts
import { Adnd2eItemModel } from "./base-item";
import {
  ABILITY_KEYS, ALIGNMENTS, CLASS_IDS, KIT_EQUIPMENT_MODES, RACE_IDS, TRAIT_ATTACK_MODES, TRAIT_EFFECT_KINDS,
  TRAIT_PROFICIENCY_TRACKS, TRAIT_SAVE_CATEGORIES,
} from "./choices";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

/** A blank-able choice string (same reasoning as the trait model's `choice`). */
const choice = (choices: readonly string[]) =>
  new StringField({ required: true, blank: true, initial: "", choices });

const names = () => new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] });

const equipmentOverride = () =>
  new SchemaField({
    mode: new StringField({ required: true, blank: false, initial: "inherit", choices: KIT_EQUIPMENT_MODES }),
    names: names(),
  });

/**
 * SP11 Plan A: a character kit. Modifies the class with the same chassis.
 * `effects` uses the trait effect shape (`toTraitEffect` interprets it; a
 * malformed effect is inert). Equipment overrides: `inherit` keeps the class
 * rule, `replace` swaps it, `extend` adds to it; armor names are armor type
 * names ("studded leather", "shield"), weapon names are weapon names plus the
 * token "blunt".
 */
export class KitItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      chassisId: new StringField({ required: true, blank: false, initial: "fighter", choices: CLASS_IDS }),
      qualifications: new SchemaField({
        abilityMinimums: new SchemaField(
          Object.fromEntries(
            ABILITY_KEYS.map((k) => [k, new NumberField({ required: true, integer: true, min: 0, max: 25, initial: 0 })]),
          ),
        ),
        races: new ArrayField(new StringField({ required: true, blank: false, choices: RACE_IDS }), { required: true, initial: [] }),
        alignments: new ArrayField(new StringField({ required: true, blank: false, choices: ALIGNMENTS }), { required: true, initial: [] }),
      }),
      xpModifierPercent: new NumberField({ required: true, integer: true, min: -90, initial: 0 }),
      effects: new ArrayField(
        new SchemaField({
          kind: choice(TRAIT_EFFECT_KINDS),
          ability: choice(ABILITY_KEYS),
          save: choice(TRAIT_SAVE_CATEGORIES),
          mode: choice(TRAIT_ATTACK_MODES),
          track: choice(TRAIT_PROFICIENCY_TRACKS),
          amount: new NumberField({ required: true, integer: true, initial: 0 }),
        }),
        { required: true, initial: [] },
      ),
      equipment: new SchemaField({ armor: equipmentOverride(), weapons: equipmentOverride() }),
      forbiddenWeaponProficiencies: names(),
      grantedFeatures: names(),
    };
  }
}
```

`src/data/item/subtypes.ts`: add `| "kit"` to `ItemSubtype`, `"kit"` to `ITEM_SUBTYPES`, and change the header comment from "twelve" to "thirteen" (it already lists more than twelve; make the comment say "thirteen"). `src/data/item/index.ts`: `import { KitItemModel } from "./kit";`, add to the export list and `ITEM_DATA_MODELS` (`kit: KitItemModel`).

`system.json`: in `documentTypes.Item` add `"kit": {}`; add to `packs`:

```json
    { "name": "kits", "label": "Kits", "path": "packs/kits", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } }
```

and change the "Classes & Races" folder to `"packs": ["classes", "races", "kits"]`.

`lang/en.json` — add `"kit": "Kit"` to `TYPES.Item` (beside `"trait"`).

Apply `kit` to every other place the Step 1 grep found that enumerates item types.

Create `packs/kits/_source/_MANIFEST.md`:

```markdown
# `kits` pack — source manifest

Three SAMPLE character kits that exercise the kit engine (SP11 Plan A). They are this project's own design, mechanical data only (content policy: no rulebook prose). Real kit content is user-authored through the importer.

| id | name | chassis | shows off |
|----|------|---------|-----------|
| kSampleDuelist01 | Sample Duelist | fighter | ability minimum, XP modifier, an attack effect, armor `replace` |
| kSampleHedgeMg02 | Sample Hedge Mage | mage | a save effect, armor and weapon `extend`, a forbidden proficiency |
| kSampleZealot003 | Sample Zealot | cleric | race and alignment gates, bonus HP, weapon `extend` |
```

Create `packs/kits/_source/sample-duelist.json`:

```json
{
  "_id": "kSampleDuelist01",
  "_key": "!items!kSampleDuelist01",
  "name": "Sample Duelist",
  "type": "kit",
  "img": "icons/svg/upgrade.svg",
  "system": {
    "description": "",
    "chassisId": "fighter",
    "qualifications": {
      "abilityMinimums": { "str": 0, "dex": 14, "con": 0, "int": 0, "wis": 0, "cha": 0 },
      "races": [],
      "alignments": []
    },
    "xpModifierPercent": 10,
    "effects": [
      { "kind": "attackBonus", "ability": "", "save": "", "mode": "melee", "track": "", "amount": 1 }
    ],
    "equipment": {
      "armor": { "mode": "replace", "names": ["padded", "leather", "studded leather"] },
      "weapons": { "mode": "inherit", "names": [] }
    },
    "forbiddenWeaponProficiencies": [],
    "grantedFeatures": ["Sample Duelist Stance"]
  }
}
```

Create `packs/kits/_source/sample-hedge-mage.json`:

```json
{
  "_id": "kSampleHedgeMg02",
  "_key": "!items!kSampleHedgeMg02",
  "name": "Sample Hedge Mage",
  "type": "kit",
  "img": "icons/svg/upgrade.svg",
  "system": {
    "description": "",
    "chassisId": "mage",
    "qualifications": {
      "abilityMinimums": { "str": 0, "dex": 0, "con": 12, "int": 0, "wis": 0, "cha": 0 },
      "races": [],
      "alignments": []
    },
    "xpModifierPercent": 0,
    "effects": [
      { "kind": "saveBonus", "ability": "", "save": "spell", "mode": "", "track": "", "amount": 1 }
    ],
    "equipment": {
      "armor": { "mode": "extend", "names": ["leather"] },
      "weapons": { "mode": "extend", "names": ["short sword"] }
    },
    "forbiddenWeaponProficiencies": ["Long Bow"],
    "grantedFeatures": []
  }
}
```

Create `packs/kits/_source/sample-zealot.json`:

```json
{
  "_id": "kSampleZealot003",
  "_key": "!items!kSampleZealot003",
  "name": "Sample Zealot",
  "type": "kit",
  "img": "icons/svg/upgrade.svg",
  "system": {
    "description": "",
    "chassisId": "cleric",
    "qualifications": {
      "abilityMinimums": { "str": 0, "dex": 0, "con": 0, "int": 0, "wis": 13, "cha": 0 },
      "races": ["human", "half-elf"],
      "alignments": ["lawful-good", "neutral-good"]
    },
    "xpModifierPercent": 20,
    "effects": [
      { "kind": "bonusHp", "ability": "", "save": "", "mode": "", "track": "", "amount": 2 }
    ],
    "equipment": {
      "armor": { "mode": "inherit", "names": [] },
      "weapons": { "mode": "extend", "names": ["spear"] }
    },
    "forbiddenWeaponProficiencies": [],
    "grantedFeatures": []
  }
}
```

- [ ] **Step 4: Run the full suite, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS; the build prints `build-packs: kits  3/3 documents OK`. Fix any remaining place that enumerates item types if a test names it.

- [ ] **Step 5: Commit**

```bash
git add src packs system.json lang tests
git commit -m "feat(kits): kit item type, schema and three sample kits

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Kit effects and XP modifier in the derive layer

**Files:**
- Create: `src/data/derive/character/kits.ts`
- Modify: `src/data/derive/character/traits.ts`, `derive.ts`, `snapshot.ts`, `levels.ts`, `src/data/derive/class-item.ts`, `src/data/item/class.ts`, `src/data/actor/snapshot.ts`, `src/data/actor/base-actor.ts`, `src/sheets/character/xp.ts`, `src/sheets/character/context.ts`, `src/sheets/character/context-types.ts`, `src/sheets/character/combat-rolls.ts`, `src/sheets/character/sheet.ts`
- Test: `tests/data/derive/kits.test.ts`

**Interfaces:**
- Consumes: `kitXpPercentFor`, `scaleChassisXp` (Task 1); the `kit` item (Task 2); existing `toTraitEffect`, `traitEffectTotals`.
- Produces:
  - `interface KitEntry { id: string; name: string; chassisId: string; xpModifierPercent: number; effects: TraitEffect[]; qualifications: KitQualifications; equipment: { armor: EquipmentOverride; weapons: EquipmentOverride }; forbiddenWeaponProficiencies: string[]; grantedFeatures: string[] }`
  - `toKitEntries(items: Iterable<{ id?: string; name?: string; type: string; system: unknown }>): KitEntry[]` (every `kit` item; malformed effects dropped)
  - `activeKitEntries(items): KitEntry[]` (only kits whose chassis the actor has a `class` item for)
  - `resolveTraitTotals(traits, rules, kitEffects?: readonly TraitEffect[])` — kit effects added ungated
  - `classItemLevel(chassisId, xp, xpModifierPercent = 0)`, `classItemCanLevelUp(chassisId, xp, hpRollsLength, xpModifierPercent = 0)`, `xpToNext(chassisId, xp, xpModifierPercent = 0)`
  - `ClassEntry.xpModifierPercent?: number`, `ActorSnapshot.kitEffects?: readonly TraitEffect[]`

- [ ] **Step 1: Write the failing test**

Create `tests/data/derive/kits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activeKitEntries, toKitEntries } from "../../../src/data/derive/character/kits";
import { resolveTraitTotals } from "../../../src/data/derive/character/traits";
import { deriveClassLevels } from "../../../src/data/derive/character/levels";
import { classItemCanLevelUp, classItemLevel } from "../../../src/data/derive/class-item";
import { getChassis } from "../../../src/core/classes/chassis";
import { scaleThreshold } from "../../../src/core/kits";

const blankEffect = { ability: "", save: "", mode: "", track: "" };
const kitItem = (over: Record<string, unknown> = {}) => ({
  id: "k1",
  name: "Test Kit",
  type: "kit",
  system: {
    chassisId: "fighter",
    qualifications: { abilityMinimums: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, races: [], alignments: [] },
    xpModifierPercent: 25,
    effects: [
      { ...blankEffect, kind: "attackBonus", mode: "melee", amount: 2 },
      { ...blankEffect, kind: "bogus", amount: 1 },
    ],
    equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
    forbiddenWeaponProficiencies: [],
    grantedFeatures: ["Stance"],
    ...over,
  },
});
const classItem = (chassisId: string) => ({ type: "class", system: { chassisId } });
const rulesOff = { skillsAndPowersEnabled: false, characterPointBuild: false };

describe("toKitEntries / activeKitEntries", () => {
  it("reads kit items and drops malformed effects", () => {
    const [k] = toKitEntries([kitItem(), { type: "weapon", system: {} }]);
    expect(k!.id).toBe("k1");
    expect(k!.chassisId).toBe("fighter");
    expect(k!.xpModifierPercent).toBe(25);
    expect(k!.effects).toEqual([{ kind: "attackBonus", mode: "melee", amount: 2 }]);
    expect(k!.grantedFeatures).toEqual(["Stance"]);
  });
  it("only kits whose class the actor owns are active", () => {
    expect(activeKitEntries([kitItem(), classItem("fighter")])).toHaveLength(1);
    expect(activeKitEntries([kitItem(), classItem("mage")])).toHaveLength(0);
    expect(activeKitEntries([kitItem()])).toHaveLength(0);
  });
});

describe("kit effects feed the trait totals ungated", () => {
  it("applies while the character-point rule is off", () => {
    const [k] = toKitEntries([kitItem()]);
    const totals = resolveTraitTotals([], rulesOff, k!.effects);
    expect(totals.attackBonus.melee).toBe(2);
  });
  it("is unchanged without kit effects", () => {
    expect(resolveTraitTotals([], rulesOff).attackBonus.melee).toBe(0);
  });
});

describe("the XP modifier delays levels", () => {
  const level2 = getChassis("fighter").xpThresholds[1]!;
  it("classItemLevel and classItemCanLevelUp honour the percent (default 0)", () => {
    expect(classItemLevel("fighter", level2)).toBe(2);
    expect(classItemLevel("fighter", level2, 25)).toBe(1);
    expect(classItemLevel("fighter", scaleThreshold(level2, 25), 25)).toBe(2);
    expect(classItemCanLevelUp("fighter", level2, 1)).toBe(true);
    expect(classItemCanLevelUp("fighter", level2, 1, 25)).toBe(false);
  });
  it("deriveClassLevels reads each class entry's percent", () => {
    const entry = { chassisId: "fighter" as const, specialistSchool: null, xp: level2, hpRolls: [1], dualClassState: null, level: 1 };
    expect(deriveClassLevels([{ ...entry, xpModifierPercent: 25 }])[0]).toEqual({ chassisId: "fighter", level: 1, canLevelUp: false });
    expect(deriveClassLevels([entry])[0]).toEqual({ chassisId: "fighter", level: 2, canLevelUp: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/data/derive/kits.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure layer**

Create `src/data/derive/character/kits.ts`:

```ts
import type { EquipmentOverride, KitQualifications } from "../../../core/kits";
import { toTraitEffect, type RawTraitEffect, type TraitEffect } from "../../../core/skills/traits";

/* SP11 Plan A: the owned `kit` items as plain entries. Pure. */

export interface KitEntry {
  id: string;
  name: string;
  chassisId: string;
  xpModifierPercent: number;
  effects: TraitEffect[];
  qualifications: KitQualifications;
  equipment: { armor: EquipmentOverride; weapons: EquipmentOverride };
  forbiddenWeaponProficiencies: string[];
  grantedFeatures: string[];
}

interface KitSystem {
  chassisId: string;
  qualifications: KitQualifications;
  xpModifierPercent: number;
  effects: RawTraitEffect[];
  equipment: { armor: EquipmentOverride; weapons: EquipmentOverride };
  forbiddenWeaponProficiencies: string[];
  grantedFeatures: string[];
}

type ItemLike = { id?: string; name?: string; type: string; system: unknown };

/** Every `kit` item as an entry, in item order; a malformed effect is dropped (inert). */
export function toKitEntries(items: Iterable<ItemLike>): KitEntry[] {
  const out: KitEntry[] = [];
  for (const item of items) {
    if (item.type !== "kit") continue;
    const s = item.system as KitSystem;
    const effects: TraitEffect[] = [];
    for (const raw of s.effects) {
      const e = toTraitEffect(raw);
      if (e) effects.push(e);
    }
    out.push({
      id: item.id ?? "",
      name: item.name ?? "",
      chassisId: s.chassisId,
      xpModifierPercent: s.xpModifierPercent,
      effects,
      qualifications: s.qualifications,
      equipment: s.equipment,
      forbiddenWeaponProficiencies: [...s.forbiddenWeaponProficiencies],
      grantedFeatures: [...s.grantedFeatures],
    });
  }
  return out;
}

/** The kits that currently apply: those whose class chassis the actor owns a `class` item for. */
export function activeKitEntries(items: Iterable<ItemLike>): KitEntry[] {
  const all = [...items];
  const chassisIds = new Set(
    all.filter((i) => i.type === "class").map((i) => (i.system as { chassisId: string }).chassisId),
  );
  return toKitEntries(all).filter((k) => chassisIds.has(k.chassisId));
}
```

`src/data/derive/character/traits.ts` — change `resolveTraitTotals`:

```ts
/** THE derive-side gate for traits: all-zero trait totals while the rule is off. Kit effects (SP11) are NOT gated and are always added. */
export function resolveTraitTotals(
  traits: readonly TraitEntry[],
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "characterPointBuild">,
  kitEffects: readonly TraitEffect[] = [],
): TraitTotals {
  const gated = characterPointBuildEnabled(rules) ? traits.map((t) => t.effect) : [];
  return traitEffectTotals([...gated, ...kitEffects]);
}
```

(import `type TraitEffect` from `core/skills/traits` alongside the existing import).

`src/data/derive/character/snapshot.ts` — import `TraitEffect` already present; add to `ClassEntry`: `/** SP11: the owning kit's XP modifier percent (absent = 0) */ xpModifierPercent?: number;` and to `ActorSnapshot`: `/** SP11: the effects of every active kit — applied regardless of the character-point rule (absent = none) */ kitEffects?: readonly TraitEffect[];`

`src/data/derive/character/derive.ts` line ~293: pass `snapshot.kitEffects ?? []` as the third argument of `resolveTraitTotals`.

`src/data/derive/class-item.ts`:

```ts
import { scaleChassisXp } from "../../core/kits";
...
/** The class level this embedded `class` item has reached on its own XP total (a kit's XP modifier percent, default 0, scales the thresholds). */
export function classItemLevel(chassisId: ClassId, xp: number, xpModifierPercent = 0): number {
  return levelForXp(scaleChassisXp(getChassis(chassisId), xpModifierPercent), xp);
}

export function classItemCanLevelUp(chassisId: ClassId, xp: number, hpRollsLength: number, xpModifierPercent = 0): boolean {
  return classItemLevel(chassisId, xp, xpModifierPercent) > hpRollsLength;
}
```

`src/data/derive/character/levels.ts`: pass `c.xpModifierPercent ?? 0` to both calls.

`src/sheets/character/xp.ts`: `xpToNext(chassisId, xp, xpModifierPercent = 0)` — build `const chassis = scaleChassisXp(getChassis(chassisId), xpModifierPercent);` (import from `../../core/kits`); everything else unchanged.

- [ ] **Step 4: Wire the Foundry-side call sites**

- `src/data/item/class.ts` `prepareDerivedData`: compute the percent from the owning actor's kits and pass it:

```ts
    const actor = (this as unknown as { parent?: { parent?: { items?: Iterable<{ type: string; system: unknown }> } } }).parent?.parent;
    const percent = kitXpPercentFor(activeKitEntries(actor?.items ?? []), sys.chassisId);
    sys.level = classItemLevel(sys.chassisId, sys.xp, percent);
    sys.canLevelUp = classItemCanLevelUp(sys.chassisId, sys.xp, sys.hpRolls.length, percent);
```

  (imports: `kitXpPercentFor` from `../../core/kits`, `activeKitEntries` from `../derive/character/kits`; check there is no import cycle with `npm run typecheck` and a test run).
- `src/data/actor/snapshot.ts`: `const kitEntries = activeKitEntries(items);` before building `classes`; in each class entry add `xpModifierPercent: kitXpPercentFor(kitEntries, s.chassisId)`; in the returned object add `kitEffects: kitEntries.flatMap((k) => k.effects)`.
- `src/data/actor/base-actor.ts` `applyTraitAbilityBonuses`: `const items = [...sys.parent.items];` then `resolveTraitTotals(toTraitEntries(items), getOptionalRules(), activeKitEntries(items).flatMap((k) => k.effects))` (import `activeKitEntries` from `../derive/character/kits`).
- `src/sheets/character/context-types.ts`: add `xpModifierPercent?: number` to the class item view used by `buildCharacterSheetInput` (the type behind `input.classItems`); `src/sheets/character/sheet.ts` `#buildInput`: populate it with `kitXpPercentFor(activeKitEntries(items), chassisId)` where it builds the class item views; `context.ts` ~line 320: `xpToNext(c.chassisId as ClassId, c.xp, c.xpModifierPercent ?? 0)` and ~line 773: `classItemLevel(priestClass.chassisId as ClassId, priestClass.xp, priestClass.xpModifierPercent ?? 0)`.
- `src/sheets/character/combat-rolls.ts` ~line 215: the thief level lookup uses the actor's items already; compute `const percent = kitXpPercentFor(activeKitEntries(actor.items), "thief");` (use the iterable of items that function already has in scope) and pass it as the third argument to `classItemLevel`.

- [ ] **Step 5: Run the full suite, typecheck, lint; commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. Then:

```bash
git add src tests
git commit -m "feat(kits): kit effects and XP modifier in the derive layer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Kit drops and forbidden proficiencies

**Files:**
- Modify: `src/sheets/character/drop-rules.ts`, `src/sheets/character/sheet.ts` (`_onDropItem`), `src/sheets/npc/sheet.ts` (`_onDropItem`), `lang/en.json`
- Test: the existing drop-rules test file (`grep -rl validateItemDrop tests`) — append the cases below

**Interfaces:**
- Consumes: `kitQualifies`, `kitForbidsProficiency`, `KitQualifyVerdict` (Task 1); `activeKitEntries`, `toKitEntries`, `KitEntry` (Task 3).
- Produces: `DropCheckInput` gains `dropKitChassisId?: string`, `existingKitChassisIds?: readonly string[]`, `kitQualifies?: KitQualifyVerdict`, `kitForbidsProficiency?: boolean`; reasons `ADND2E.sheet.drop.kitNoClass`, `kitDuplicate`, `kitForbiddenProficiency`, `kitsPcOnly`.

- [ ] **Step 1: Write the failing tests**

Append to the drop-rules test file (reuse its existing import of `validateItemDrop`; use the same base-input conventions the file already uses — the minimal valid input is `{ dropType, hasRace: false, existingChassisIds: [] }`):

```ts
describe("kit drops (SP11)", () => {
  const base = { hasRace: true, existingChassisIds: ["fighter"], dropType: "kit", dropKitChassisId: "fighter" };
  it("accepts a qualifying kit for an owned class", () => {
    expect(validateItemDrop({ ...base, existingKitChassisIds: [], kitQualifies: { ok: true } })).toEqual({ ok: true });
  });
  it("rejects a kit whose class the actor does not have", () => {
    expect(validateItemDrop({ ...base, dropKitChassisId: "mage" })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitNoClass" });
  });
  it("rejects a second kit for the same class", () => {
    expect(validateItemDrop({ ...base, existingKitChassisIds: ["fighter"], kitQualifies: { ok: true } })).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.kitDuplicate",
    });
  });
  it("rejects unmet qualifications with that reason", () => {
    expect(validateItemDrop({ ...base, existingKitChassisIds: [], kitQualifies: { ok: false, reason: "ADND2E.sheet.drop.kitAbility" } })).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.kitAbility",
    });
  });
});

describe("kit-forbidden weapon proficiencies (SP11)", () => {
  it("rejects a forbidden proficiency before slot checks", () => {
    expect(
      validateItemDrop({
        dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["mage"], dropWeaponOrGroup: "Long Bow",
        dropIsGroup: false, dropSlotCost: 1, availableSlots: 5, kitForbidsProficiency: true,
      }),
    ).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitForbiddenProficiency" });
  });
  it("is unaffected when no kit forbids it", () => {
    expect(
      validateItemDrop({
        dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["mage"], dropWeaponOrGroup: "Dagger",
        dropIsGroup: false, dropSlotCost: 1, availableSlots: 5,
      }),
    ).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run <the drop-rules test file>`
Expected: FAIL.

- [ ] **Step 3: Implement the pure rules**

In `src/sheets/character/drop-rules.ts` add to `DropCheckInput` (import `type KitQualifyVerdict` from `../../core/kits`):

```ts
  /** kit drops: the kit's class chassis */
  dropKitChassisId?: string;
  /** chassis of every `kit` item already on the actor */
  existingKitChassisIds?: readonly string[];
  /** kit drops: the pure qualification verdict, computed by the sheet */
  kitQualifies?: KitQualifyVerdict;
  /** weaponProficiency drops: true when an owned kit forbids the dropped proficiency */
  kitForbidsProficiency?: boolean;
```

In `validateItemDrop`, add before the `weaponProficiency` branch's duplicate check (as its first statement): `if (input.kitForbidsProficiency) return { ok: false, reason: "ADND2E.sheet.drop.kitForbiddenProficiency" };` and add a branch before the final `return { ok: true }`:

```ts
  if (input.dropType === "kit") {
    const chassis = input.dropKitChassisId ?? "";
    if (!input.existingChassisIds.includes(chassis)) return { ok: false, reason: "ADND2E.sheet.drop.kitNoClass" };
    if ((input.existingKitChassisIds ?? []).includes(chassis)) return { ok: false, reason: "ADND2E.sheet.drop.kitDuplicate" };
    if (input.kitQualifies && !input.kitQualifies.ok) return { ok: false, reason: input.kitQualifies.reason };
    return { ok: true };
  }
```

- [ ] **Step 4: Wire the sheets and lang**

`src/sheets/character/sheet.ts` `_onDropItem`:
- After the existing trait early-return line add: `if (dropped.type === "kit" && !isNewDrop) return super._onDropItem(event, item);` (re-sorting an owned kit is never validated).
- Build the kit inputs before `validateItemDrop`. Use `activeKitEntries(existing)` / `toKitEntries(existing)` (the `existing` array of items is already in scope; pass items that expose `type`/`system`/`id`/`name`), `dropped.system` for the dropped kit's `chassisId` and `qualifications`, the actor's prepared ability scores (`this.document.system.abilities[k].score`), the race item's `system.raceId` (or null) and `this.document.system.details.alignment`:

```ts
    let kitInputs: Partial<DropCheckInput> = {};
    if (dropped.type === "kit") {
      const sys = dropped.system as unknown as { chassisId: string; qualifications: KitQualifications };
      const a = this.document as unknown as {
        system: { abilities: Record<AbilityKey, { score: number }>; details: { alignment: Alignment } };
      };
      const raceItem = existing.find((i) => i.type === "race");
      kitInputs = {
        dropKitChassisId: sys.chassisId,
        existingKitChassisIds: toKitEntries(others).map((k) => k.chassisId),
        kitQualifies: kitQualifies(sys.qualifications, {
          abilities: Object.fromEntries(ABILITY_KEYS.map((k) => [k, a.system.abilities[k].score])) as Record<AbilityKey, number>,
          race: ((raceItem?.system as unknown as { raceId?: Race } | undefined)?.raceId ?? null) as Race | null,
          alignment: a.system.details.alignment,
        }),
      };
    } else if (dropped.type === "weaponProficiency") {
      kitInputs = {
        kitForbidsProficiency: activeKitEntries(existing).some((k) =>
          kitForbidsProficiency(k.forbiddenWeaponProficiencies, dropped.system?.weaponOrGroup ?? ""),
        ),
      };
    }
```

  and spread `...kitInputs` into the `validateItemDrop({...})` call. Add the needed imports (`DropCheckInput` type from `./drop-rules`, `kitQualifies`, `kitForbidsProficiency`, `type KitQualifications` from `../../core/kits`, `activeKitEntries`, `toKitEntries` from `../../data/derive/character/kits`, `ABILITY_KEYS` from `../../data/item/choices`, and the `AbilityKey`/`Alignment`/`Race` types from `../../core/types`). The `existing`/`others` arrays are typed narrowly in that function — widen their element type with `id`/`name`/`type`/`system` as needed rather than casting to `never`.

`src/sheets/npc/sheet.ts` `_onDropItem`: after the trait refusal block add

```ts
    if (dropped.type === "kit") {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.drop.kitsPcOnly"));
      return null;
    }
```

`lang/en.json` — in `ADND2E.sheet.drop` add:

```json
        "kitNoClass": "This kit modifies a class the character doesn't have.",
        "kitDuplicate": "That class already has a kit.",
        "kitAbility": "The character doesn't meet this kit's ability score minimums.",
        "kitRace": "The character's race doesn't qualify for this kit.",
        "kitAlignment": "The character's alignment doesn't qualify for this kit.",
        "kitForbiddenProficiency": "A kit this character has forbids that weapon proficiency.",
        "kitsPcOnly": "Kits can only be added to a player character sheet."
```

- [ ] **Step 5: Run the suite, typecheck, lint; commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (extend `tests/templates/npc-sheet-bindings.test.ts` only if it fails).

```bash
git add src lang tests
git commit -m "feat(kits): kit drop validation and kit-forbidden weapon proficiencies

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Equipment restrictions (warning on equip and row flag)

**Files:**
- Create: `src/data/derive/character/equipment-rules.ts`, `src/hooks/equipment-hooks.ts`
- Modify: `src/system.ts`, `src/sheets/character/context-types.ts` (`PhysicalItemView`), `src/sheets/character/sheet.ts` (row build), `templates/actor/pc/partials/pc-item-table.hbs`, `lang/en.json`
- Test: `tests/data/derive/equipment-rules.test.ts`

**Interfaces:**
- Consumes: `baseArmorRule`, `baseWeaponRule`, `resolveArmorRule`, `resolveWeaponRule`, `armorPermittedByAny`, `weaponPermittedByAny`, `ArmorRule`, `WeaponRule` (Task 1); `activeKitEntries` (Task 3); `getChassis`.
- Produces: `actorEquipmentRules(items): { armor: ArmorRule[]; weapons: WeaponRule[] }`, `itemNotPermitted(rules, item): boolean` (true only for a weapon or armor item that the rules do not permit), `registerEquipmentHooks()`, `PhysicalItemView.restricted?: boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/data/derive/equipment-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { actorEquipmentRules, itemNotPermitted } from "../../../src/data/derive/character/equipment-rules";

const cls = (chassisId: string) => ({ type: "class", system: { chassisId } });
const kit = (chassisId: string, armor: { mode: string; names: string[] }, weapons = { mode: "inherit", names: [] as string[] }) => ({
  id: "k", name: "K", type: "kit",
  system: {
    chassisId,
    qualifications: { abilityMinimums: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, races: [], alignments: [] },
    xpModifierPercent: 0, effects: [], equipment: { armor, weapons }, forbiddenWeaponProficiencies: [], grantedFeatures: [],
  },
});
const armor = (armorType: string, isShield = false) => ({ type: "armor", system: { armorType, isShield } });
const weapon = (name: string, damageType: string | null = null, baseWeaponName = "") => ({ type: "weapon", name, system: { baseWeaponName, damageType } });

describe("actorEquipmentRules / itemNotPermitted", () => {
  it("a classless actor has no restriction", () => {
    const rules = actorEquipmentRules([]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(false);
  });
  it("a mage cannot wear leather, but a kit can extend the rule", () => {
    const plain = actorEquipmentRules([cls("mage")]);
    expect(itemNotPermitted(plain, armor("leather"))).toBe(true);
    const withKit = actorEquipmentRules([cls("mage"), kit("mage", { mode: "extend", names: ["leather"] })]);
    expect(itemNotPermitted(withKit, armor("leather"))).toBe(false);
    expect(itemNotPermitted(withKit, armor("chain-mail"))).toBe(true);
  });
  it("a kit for a class the actor lacks is ignored", () => {
    const rules = actorEquipmentRules([cls("mage"), kit("fighter", { mode: "replace", names: ["plate-mail"] })]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(true);
  });
  it("weapons: cleric blunt rule, and a mage kit extending a name", () => {
    const cleric = actorEquipmentRules([cls("cleric")]);
    expect(itemNotPermitted(cleric, weapon("Mace", "bludgeoning"))).toBe(false);
    expect(itemNotPermitted(cleric, weapon("Long Sword", "slashing"))).toBe(true);
    const mage = actorEquipmentRules([cls("mage"), kit("mage", { mode: "inherit", names: [] }, { mode: "extend", names: ["short sword"] })]);
    expect(itemNotPermitted(mage, weapon("Short Sword"))).toBe(false);
    expect(itemNotPermitted(mage, weapon("Long Sword"))).toBe(true);
  });
  it("multiclass: permitted when any class permits it", () => {
    const rules = actorEquipmentRules([cls("mage"), cls("fighter")]);
    expect(itemNotPermitted(rules, armor("plate-mail"))).toBe(false);
  });
  it("only weapons and armor can be not-permitted", () => {
    const rules = actorEquipmentRules([cls("mage")]);
    expect(itemNotPermitted(rules, { type: "equipment", system: {} })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/data/derive/equipment-rules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the pure helper**

Create `src/data/derive/character/equipment-rules.ts`:

```ts
import { getChassis } from "../../../core/classes/chassis";
import {
  armorPermittedByAny, baseArmorRule, baseWeaponRule, resolveArmorRule, resolveWeaponRule, weaponPermittedByAny,
  type ArmorRule, type WeaponRule,
} from "../../../core/kits";
import type { ArmorType, ClassId } from "../../../core/types";
import { activeKitEntries } from "./kits";

/* SP11 Plan A: the actor's class (plus kit) armor and weapon rules, one per class. Pure. */

type ItemLike = { id?: string; name?: string; type: string; system: unknown };

export function actorEquipmentRules(items: Iterable<ItemLike>): { armor: ArmorRule[]; weapons: WeaponRule[] } {
  const all = [...items];
  const kits = activeKitEntries(all);
  const armor: ArmorRule[] = [];
  const weapons: WeaponRule[] = [];
  for (const item of all) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId: ClassId }).chassisId;
    const chassis = getChassis(chassisId);
    const kit = kits.find((k) => k.chassisId === chassisId);
    const baseArmor = baseArmorRule(chassis.armorAllowed).rule;
    const baseWeapons = baseWeaponRule(chassis.weaponsAllowed).rule;
    armor.push(kit ? resolveArmorRule(baseArmor, kit.equipment.armor) : baseArmor);
    weapons.push(kit ? resolveWeaponRule(baseWeapons, kit.equipment.weapons) : baseWeapons);
  }
  return { armor, weapons };
}

/** True only for a weapon or armor item the rules do not permit (the caller decides whether it matters: equipped only). */
export function itemNotPermitted(
  rules: { armor: readonly ArmorRule[]; weapons: readonly WeaponRule[] },
  item: { name?: string; type: string; system: unknown },
): boolean {
  if (item.type === "armor") {
    const s = item.system as { armorType: ArmorType; isShield: boolean };
    return !armorPermittedByAny(rules.armor, { armorType: s.armorType, isShield: s.isShield });
  }
  if (item.type === "weapon") {
    const s = item.system as { baseWeaponName: string; damageType: string | null };
    return !weaponPermittedByAny(rules.weapons, { name: item.name ?? "", baseWeaponName: s.baseWeaponName, damageType: s.damageType });
  }
  return false;
}
```

- [ ] **Step 4: Run the test; then wire the hook, row flag and lang**

Run: `npx vitest run tests/data/derive/equipment-rules.test.ts` — Expected: PASS.

Create `src/hooks/equipment-hooks.ts`:

```ts
import { actorEquipmentRules, itemNotPermitted } from "../data/derive/character/equipment-rules";

/* SP11 Plan A: equipping a weapon or armor the character's class (plus kit) does
 * not permit warns the user who equipped it. It still equips — the GM rules. Runs
 * only on the client that made the update. Registered once from the `ready` hook. */

export function registerEquipmentHooks(): void {
  Hooks.on("updateItem", (item: unknown, changed: unknown, _options: unknown, userId: string) => {
    if (userId !== game.user?.id) return;
    const doc = item as { type: string; name: string; system: unknown; parent: { type: string; items: Iterable<{ type: string; system: unknown }> } | null };
    if (doc.type !== "weapon" && doc.type !== "armor") return;
    if (foundry.utils.getProperty(changed as object, "system.equipped") !== true) return;
    const actor = doc.parent;
    if (!actor || actor.type !== "character") return;
    if (itemNotPermitted(actorEquipmentRules(actor.items), doc)) {
      ui.notifications?.warn(game.i18n!.format("ADND2E.sheet.equipment.notPermitted", { item: doc.name }));
    }
  });
}
```

`src/system.ts`: import `registerEquipmentHooks` next to `registerCastingHooks` and call it on the next line in the `ready` hook.

`src/sheets/character/context-types.ts` `PhysicalItemView`: add `/** SP11: equipped but not permitted by the class or kit — shows a warning mark (never set on unequipped items) */ restricted?: boolean;`

`src/sheets/character/sheet.ts` where `physicalItems.push(toPhysicalView(it))` (~line 450): compute `const equipmentRules = actorEquipmentRules(items)` once before the loop (use the same items iterable the loop walks) and push `{ ...toPhysicalView(it), restricted: Boolean((it.system as { equipped?: boolean }).equipped) && itemNotPermitted(equipmentRules, it) }` (import both helpers from `../../data/derive/character/equipment-rules`; keep the existing physical-view shape otherwise).

`templates/actor/pc/partials/pc-item-table.hbs` — in the `kit-name` span, after `{{r.item.name}}` add: `{{#if r.item.restricted}} <span class="kit-warn" title="{{localize 'ADND2E.sheet.equipment.notPermittedTip'}}">⚠</span>{{/if}}`

`lang/en.json` — in `ADND2E.sheet` add:

```json
      "equipment": {
        "notPermitted": "{item} isn't permitted for this character's class or kit. It still equips — the GM decides.",
        "notPermittedTip": "Not permitted for this character's class or kit"
      },
```

- [ ] **Step 5: Run the suite, typecheck, lint; commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (extend `tests/templates/pc-sheet-bindings.test.ts` only if it enumerates row bindings and fails).

```bash
git add src templates lang tests
git commit -m "feat(kits): class and kit equipment restrictions warn on equip, with a row flag

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Kit display on the PC sheet, README, dev-world checklist

**Files:**
- Modify: `src/sheets/character/sheet.ts` (context), `templates/actor/pc/partials/pc-feature-panels.hbs`, `lang/en.json`, `README.md`

**Interfaces:**
- Consumes: `toKitEntries`, `KitEntry` (Task 3); the kit item (Task 2).
- Produces: `context.kits: { id; name; chassisId; xpModifierPercent; effects: { kindKey; target; amount }[]; grantedFeatures: string[] }[]` and a "Kits" panel in the PC Features tab.

- [ ] **Step 1: Build the kit rows and render the panel**

In `src/sheets/character/sheet.ts` `_prepareContext`, after `context.turning = ...` add:

```ts
    context.kits = toKitEntries(
      (this.document as unknown as { items: Iterable<{ id: string; name: string; type: string; system: unknown }> }).items,
    ).map((k) => ({
      id: k.id,
      name: k.name,
      chassisId: k.chassisId,
      xpModifierPercent: k.xpModifierPercent,
      effects: k.effects.map((e) => ({
        kindKey: `ADND2E.sheet.kits.effectKinds.${e.kind}`,
        target: "ability" in e ? e.ability.toUpperCase() : "save" in e ? e.save.toUpperCase() : "mode" in e ? e.mode : "track" in e ? e.track : "",
        amount: e.amount > 0 ? `+${e.amount}` : String(e.amount),
      })),
      grantedFeatures: k.grantedFeatures,
    }));
```

(import `toKitEntries` from `../../data/derive/character/kits`; if the file does not already declare `context.turning`, place this after `context.pcActions = true;`.)

In `templates/actor/pc/partials/pc-feature-panels.hbs`, inside the `{{#if @root.pcActions}}` block, before the traits panel, add:

```hbs
  {{#if @root.kits.length}}
  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.kits.title'}}</div>
    <div class="kit-body">
      {{#each @root.kits as |k|}}
        <div class="trait-row" data-item-id="{{k.id}}">
          <span class="name">{{k.name}}</span>
          <span class="cost">{{k.chassisId}}</span>
          <span class="effect">{{#if k.xpModifierPercent}}{{localize 'ADND2E.sheet.kits.xp'}} {{k.xpModifierPercent}}%{{/if}}</span>
          {{#each k.effects as |e|}}<span class="effect">{{localize e.kindKey}} {{e.target}} {{e.amount}}</span>{{/each}}
          {{#if k.grantedFeatures.length}}<span class="effect">{{localize 'ADND2E.sheet.kits.features'}}: {{#each k.grantedFeatures}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</span>{{/if}}
          {{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=k.id deletable=true}}{{/if}}
        </div>
      {{/each}}
    </div>
  </section>
  {{/if}}
```

`lang/en.json` — in `ADND2E.sheet` add:

```json
      "kits": {
        "title": "Kits",
        "xp": "XP per level",
        "features": "Granted features",
        "effectKinds": {
          "abilityBonus": "Ability",
          "saveBonus": "Save",
          "attackBonus": "To-hit",
          "proficiencySlots": "Proficiency slots",
          "bonusHp": "Bonus HP"
        }
      },
```

- [ ] **Step 2: README**

In `README.md`, change the Sub-project 11 row's status cell to `🚧 Plan A complete (foundation); Plans B-C not started` and its description to: "A generic character-kit engine. **Plan A (foundation):** an owned `kit` item for a class (one per class): ability/race/alignment qualifications (a failing kit drop is hard-blocked), an XP-per-level percentage that delays that class's levels, typed effects reusing the trait effect set (ability, save, to-hit, proficiency slots, bonus HP — applied regardless of the character-point rule), armor and weapon overrides (`inherit`/`replace`/`extend`), forbidden weapon proficiencies, linked granted features, and a `kits` compendium of three sample kits. The class chassis armor and weapon restrictions, previously unread data, are now enforced as warnings: equipping a disallowed item shows a toast and a ⚠ row mark but still equips. Parametrized granted powers (Plan B) and base-class ability overrides (Plan C) are not implemented." Add to Known backlog items: "**Kit engine limits.** Kit effects author as a JSON list on the item sheet (no per-type item layout yet); armor names `brigandine` and `hide` have no matching item armor type so they never match; a druid's wooden shield isn't modelled so a shield flags as not permitted for druids; kits are PC-sheet only."

- [ ] **Step 3: Run the suite, typecheck, lint, build; commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS. Then:

```bash
git add src templates lang README.md
git commit -m "feat(kits): kits panel on the PC Features tab, README

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Dev-world verification (gated, hand-run, after merge-ready review)**

Not part of CI. In the linked dev world with a GM seat and a non-GM player seat:

1. Open the `Kits` compendium (Classes & Races folder): three sample kits exist. Open one on its item sheet: ability minimums, race/alignment multi-selects, equipment modes and the effects JSON all render and save.
2. A level-1 fighter with Dex 14+: drop **Sample Duelist**. It attaches; Features tab shows it with "XP per level 10%" and "To-hit MELEE +1"; THAC0 improves by 1. A second kit on the fighter is refused.
3. A fighter with Dex 13: the Duelist drop is refused with the ability toast. A mage: refused (no fighter class). A fighter with no race/mage with Con 11: **Sample Hedge Mage** refused; with Con 12 accepted, spell save improves by 1.
4. **Sample Zealot** on a cleric: refused for a dwarf or neutral-evil cleric; accepted for a lawful-good human with Wis 13; max HP +2.
5. XP modifier: give the Duelist fighter exactly the base level-2 XP threshold: still level 1; give 10% more: level 2. Remove the kit: level returns to 2.
6. Equip (as the non-GM player, on a player-owned character): a mage equips leather armor — warning toast, ⚠ on the row, still equipped; the Hedge Mage kit removes the warning for leather but not chain mail. A cleric equips a sword: warning; a mace: no warning. Unequip: the ⚠ disappears.
7. Forbidden proficiency: with Hedge Mage, dropping a "Long Bow" weapon proficiency is refused; "Dagger" is fine.
8. Multiclass fighter/mage: plate armor is not flagged.
9. A Character NPC sheet refuses a kit drop with the PC-only toast.
10. Delete the class item of a kitted character: the kit's effects and XP modifier stop applying (the kit stays on the sheet).
