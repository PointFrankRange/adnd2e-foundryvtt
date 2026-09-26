# Monster NPC Inventory, Weapon Attacks & Spells — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Monster NPC (`creature`) sheet a gear list (weapons/armor/equipment), an attack row for each equipped weapon (monster THAC0 + weapon magic, weapon damage by target size), and a Spells panel with Cast — accepting gear and spell drops and rejecting class/race/proficiency/trait/feature items.

**Architecture:** A pure `src/combat/monster-gear.ts` owns the weapon attack type, the weapon damage formula/label and the drop verdict. The pure Monster NPC sheet context gains `gear`, `weaponAttacks` and `spells` sections. Foundry glue refactors `src/sheets/creature/combat-rolls.ts` so stat-block and weapon attacks share one attack routine (stat-block behavior byte-identical), adds sheet actions and an `_onDropItem` guard, and casts spells through the existing SP9 `rollSpellAutomation` + `postCastCard`.

**Tech Stack:** TypeScript, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-26-adnd2e-monster-npc-inventory-design.md`

## Global Constraints

- **Foundry v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app`) is authoritative — never `fvtt-types`.
- **Two-layer contract:** `src/combat/**` and `src/sheets/creature/{context,context-types}.ts` are pure zones (no Foundry imports, 100% line/statement/function coverage, branches ≥ 90). `src/sheets/creature/{sheet,combat-rolls}.ts`, templates, SCSS, lang are Foundry glue — typecheck/lint gated, dev-world verified.
- **No schema change, no migration:** items are ordinary embedded Items; `CreatureModel` is untouched.
- **Stat-block attacks, saves and every PC / Character NPC sheet are behavior-identical** — this plan only touches the `creature` sheet, its combat-rolls, the pure creature context, and adds new pure/lang/template files.
- No `npm run format`/`prettier`/`npm install`/`npm update`; don't touch package files. Implementers never run `npm run build`/`build:packs`; the controller builds at Task 6 after re-confirming Foundry is closed.
- Vitest via `tail`/redirect, never `| grep`; rerun 2-3× on a first-run flake. Working copies are CRLF — scripted edits must split on `/\r?\n/`; `lang/en.json` stays valid JSON.
- Mandatory whole-branch review (Task 5); GATED dev-world check (Task 6).

## Locked design decisions

1. **Accepted drop types:** `weapon`, `armor`, `equipment`, `spell`. Everything else is rejected with `ADND2E.sheet.drop.monsterRejects` (a re-sort/re-drop of an already-owned item is always an accepted type, so it passes).
2. **Weapon attack type:** `melee` category → `"melee"`; `thrown`, `bow`, `crossbow` → `"ranged"`.
3. **Weapon to-hit:** the monster's THAC0 (`system.attributes.thac0.value`), with the weapon's `magicBonus` as `weaponMagicBonus` in the existing `attackModifiers` (so it shows in the card breakdown) plus the same situational terms as stat-block attacks (`blindedAttackPenalty`, `heldAttackBonus`, prone target AC).
4. **Weapon damage:** `pickDamageDice({damageVsSM, damageVsL}, targetSize)` then `damageFormula(dice, magicBonus)`; `targetSize` is the single target's size from `resolveTargetCombatInfo`, else `null` (→ the S-M die). No dice → the attack card is posted and no damage roll happens.
5. **Only equipped weapons** produce attack rows; unequipping (checkbox, ✎ sheet, or a disarm) removes the row.
6. **Armor has no effect** on AC. **Quantity is shown, not edited inline** (edit via ✎).
7. **Spells:** grouped by level; **Cast** = `rollSpellAutomation(spell)` then `postCastCard(actor, spell, rolled)` — no memorized/slot bookkeeping, no casting-time flow.
8. **Equipped toggle:** a checkbox with `data-action="toggleEquipped" data-item-id` (no `name`, so the sheet form never submits it); the handler flips `system.equipped` on the owned item.

---

### Task 1: Pure monster-gear module

**Files:** Create `src/combat/monster-gear.ts`, `tests/combat/monster-gear.test.ts`

**Interfaces — Produces:** `MONSTER_ITEM_TYPES`, `monsterDropVerdict(type: string): { ok: true } | { ok: false; reason: string }`, `MonsterWeapon` (`{ category: string; magicBonus: number; damageVsSM: string | null; damageVsL: string | null }`), `monsterWeaponAttackType(category: string): "melee" | "ranged"`, `monsterWeaponDamageFormula(weapon: MonsterWeapon, targetSize: CreatureSize | null): string | null`, `monsterWeaponDamageLabel(weapon: MonsterWeapon): string`.

- [ ] **Step 1: Failing tests** — `tests/combat/monster-gear.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  MONSTER_ITEM_TYPES,
  monsterDropVerdict,
  monsterWeaponAttackType,
  monsterWeaponDamageFormula,
  monsterWeaponDamageLabel,
} from "../../src/combat/monster-gear";

const sword = { category: "melee", magicBonus: 0, damageVsSM: "1d8", damageVsL: "1d12" };

describe("monsterDropVerdict", () => {
  it("accepts gear and spells", () => {
    expect([...MONSTER_ITEM_TYPES]).toEqual(["weapon", "armor", "equipment", "spell"]);
    for (const t of MONSTER_ITEM_TYPES) expect(monsterDropVerdict(t)).toEqual({ ok: true });
  });
  it.each(["class", "race", "weaponProficiency", "nonweaponProficiency", "trait", "classFeature", "condition", "bogus"])(
    "rejects %s",
    (t) => {
      expect(monsterDropVerdict(t)).toEqual({ ok: false, reason: "ADND2E.sheet.drop.monsterRejects" });
    },
  );
});

describe("monsterWeaponAttackType", () => {
  it("is melee for melee weapons and ranged for thrown, bow and crossbow", () => {
    expect(monsterWeaponAttackType("melee")).toBe("melee");
    expect(monsterWeaponAttackType("thrown")).toBe("ranged");
    expect(monsterWeaponAttackType("bow")).toBe("ranged");
    expect(monsterWeaponAttackType("crossbow")).toBe("ranged");
  });
});

describe("monsterWeaponDamageFormula", () => {
  it("uses the S-M die for small/medium/unknown targets and the L die for large and up", () => {
    expect(monsterWeaponDamageFormula(sword, null)).toBe("1d8");
    expect(monsterWeaponDamageFormula(sword, "medium")).toBe("1d8");
    expect(monsterWeaponDamageFormula(sword, "large")).toBe("1d12");
    expect(monsterWeaponDamageFormula(sword, "gargantuan")).toBe("1d12");
  });
  it("adds the magic bonus", () => {
    expect(monsterWeaponDamageFormula({ ...sword, magicBonus: 2 }, null)).toBe("1d8 + 2");
    expect(monsterWeaponDamageFormula({ ...sword, magicBonus: -1 }, "huge")).toBe("1d12 - 1");
  });
  it("falls back to the other die, or null when neither is modeled", () => {
    expect(monsterWeaponDamageFormula({ ...sword, damageVsL: null }, "large")).toBe("1d8");
    expect(monsterWeaponDamageFormula({ ...sword, damageVsSM: null, damageVsL: null }, null)).toBeNull();
  });
});

describe("monsterWeaponDamageLabel", () => {
  it("shows S-M / L dice and a signed magic bonus", () => {
    expect(monsterWeaponDamageLabel(sword)).toBe("1d8 / 1d12");
    expect(monsterWeaponDamageLabel({ ...sword, magicBonus: 1 })).toBe("1d8 / 1d12 +1");
    expect(monsterWeaponDamageLabel({ ...sword, magicBonus: -2, damageVsL: null })).toBe("1d8 / — -2");
    expect(monsterWeaponDamageLabel({ ...sword, damageVsSM: null, damageVsL: null })).toBe("— / —");
  });
});
```
NOTE: `damageFormula` in `src/core/dice/formula.ts` renders the bonus via its own `signedTerm`; run the test once and, if its spacing differs from `"1d8 + 2"` / `"1d12 - 1"`, change ONLY those two expected strings to what `damageFormula` actually produces (it is the existing, already-tested formatter) and say so in the report.

Run `npx vitest run tests/combat/monster-gear.test.ts > "$TEMP/mg.log" 2>&1; tail -8 "$TEMP/mg.log"` → FAIL.

- [ ] **Step 2: Implement** — `src/combat/monster-gear.ts`:
```typescript
// Monster NPC (the `creature` actor type) gear rules (post-SP9): which items a
// Monster NPC accepts, and how an equipped weapon becomes an attack — the
// monster's own THAC0 with the weapon's magic bonus, the weapon's S-M / L damage
// by target size. Pure.
import { damageFormula } from "../core/dice/formula";
import type { CreatureSize } from "../core/types";
import { pickDamageDice } from "./damage-dice";

export const MONSTER_ITEM_TYPES = ["weapon", "armor", "equipment", "spell"] as const;

export function monsterDropVerdict(type: string): { ok: true } | { ok: false; reason: string } {
  return (MONSTER_ITEM_TYPES as readonly string[]).includes(type)
    ? { ok: true }
    : { ok: false, reason: "ADND2E.sheet.drop.monsterRejects" };
}

export interface MonsterWeapon {
  category: string;
  magicBonus: number;
  damageVsSM: string | null;
  damageVsL: string | null;
}

export function monsterWeaponAttackType(category: string): "melee" | "ranged" {
  return category === "melee" ? "melee" : "ranged";
}

/** The weapon's damage roll against a target of `targetSize` (null = unknown → S-M die), or null when no die is modeled. */
export function monsterWeaponDamageFormula(weapon: MonsterWeapon, targetSize: CreatureSize | null): string | null {
  const dice = pickDamageDice(weapon, targetSize);
  return dice ? damageFormula(dice, weapon.magicBonus) : null;
}

/** "1d8 / 1d12 +1" — S-M / L dice ("—" when missing) and a signed magic bonus when non-zero. */
export function monsterWeaponDamageLabel(weapon: MonsterWeapon): string {
  const dice = `${weapon.damageVsSM ?? "—"} / ${weapon.damageVsL ?? "—"}`;
  if (weapon.magicBonus === 0) return dice;
  return `${dice} ${weapon.magicBonus > 0 ? "+" : ""}${weapon.magicBonus}`;
}
```
- [ ] **Step 3: Verify** — focused test passes; typecheck, lint, `npm run test:coverage` (redirected to `$TEMP`, read with `tail`) exit 0; `monster-gear.ts` at 100%.
- [ ] **Step 4: Commit** — `git add src/combat/monster-gear.ts tests/combat/monster-gear.test.ts` then `git commit -m "feat(monster): pure gear drop rule and weapon attack helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.

---

### Task 2: Monster NPC sheet context — gear, weapon attacks, spells

**Files:** Modify `src/sheets/creature/context-types.ts`, `src/sheets/creature/context.ts`, `tests/sheets/creature/context.test.ts`

**Interfaces — Consumes:** `monsterWeaponAttackType`, `monsterWeaponDamageLabel` (Task 1). **Produces:** input `gear?: CreatureGearView[]`, `spells?: CreatureSpellView[]`; output `gear`, `weaponAttacks`, `spells` (shapes below).

- [ ] **Step 1: Failing tests** — append to `tests/sheets/creature/context.test.ts` (uses its `input()` factory):
```typescript
describe("buildCreatureSheetContext — gear, weapon attacks, spells", () => {
  const w = (over: Partial<CreatureGearView> = {}): CreatureGearView => ({
    id: "w1", name: "Long Sword", img: "", type: "weapon", quantity: 1, equipped: true,
    weapon: { category: "melee", magicBonus: 1, damageVsSM: "1d8", damageVsL: "1d12" },
    ...over,
  });

  it("is empty when the monster carries nothing", () => {
    const c = buildCreatureSheetContext(input());
    expect(c.gear).toEqual([]);
    expect(c.weaponAttacks).toEqual([]);
    expect(c.spells).toEqual([]);
  });

  it("lists all gear, but only EQUIPPED weapons become attack rows", () => {
    const c = buildCreatureSheetContext(
      input({
        gear: [
          w(),
          w({ id: "w2", name: "Short Bow", equipped: false, weapon: { category: "bow", magicBonus: 0, damageVsSM: null, damageVsL: null } }),
          w({ id: "w3", name: "Javelin", weapon: { category: "thrown", magicBonus: 0, damageVsSM: "1d6", damageVsL: "1d6" } }),
          { id: "a1", name: "Chain Mail", img: "", type: "armor", quantity: 1, equipped: true },
          { id: "e1", name: "Rope", img: "", type: "equipment", quantity: 2, equipped: false },
        ],
      }),
    );
    expect(c.gear.map((g) => [g.id, g.type, g.quantity, g.equipped])).toEqual([
      ["w1", "weapon", 1, true],
      ["w2", "weapon", 1, false],
      ["w3", "weapon", 1, true],
      ["a1", "armor", 1, true],
      ["e1", "equipment", 2, false],
    ]);
    expect(c.weaponAttacks).toEqual([
      { id: "w1", name: "Long Sword", damage: "1d8 / 1d12 +1", type: "melee" },
      { id: "w3", name: "Javelin", damage: "1d6 / 1d6", type: "ranged" },
    ]);
  });

  it("an equipped weapon item with no weapon data yields no attack row", () => {
    const c = buildCreatureSheetContext(input({ gear: [w({ weapon: undefined })] }));
    expect(c.weaponAttacks).toEqual([]);
  });

  it("groups spells by level, ascending", () => {
    const c = buildCreatureSheetContext(
      input({
        spells: [
          { id: "s3", name: "Fireball", img: "", level: 3 },
          { id: "s1", name: "Magic Missile", img: "", level: 1 },
          { id: "s1b", name: "Sleep", img: "", level: 1 },
        ],
      }),
    );
    expect(c.spells).toEqual([
      { level: 1, items: [{ id: "s1", name: "Magic Missile", img: "" }, { id: "s1b", name: "Sleep", img: "" }] },
      { level: 3, items: [{ id: "s3", name: "Fireball", img: "" }] },
    ]);
  });
});
```
(add `CreatureGearView` to the file's type import from `context-types`). Run → FAIL.

- [ ] **Step 2: Implement** — `context-types.ts`: add
```typescript
export interface CreatureGearView {
  id: string; name: string; img: string;
  type: "weapon" | "armor" | "equipment";
  quantity: number; equipped: boolean;
  /** weapons only */
  weapon?: { category: string; magicBonus: number; damageVsSM: string | null; damageVsL: string | null };
}
export interface CreatureSpellView { id: string; name: string; img: string; level: number }
```
add to `CreatureSheetInput`: `gear?: CreatureGearView[];` and `spells?: CreatureSpellView[];`; add to `CreatureSheetContext`:
```typescript
  gear: { id: string; name: string; img: string; type: "weapon" | "armor" | "equipment"; quantity: number; equipped: boolean }[];
  /** one row per EQUIPPED weapon */
  weaponAttacks: { id: string; name: string; damage: string; type: "melee" | "ranged" }[];
  spells: { level: number; items: { id: string; name: string; img: string }[] }[];
```
`context.ts`: import `monsterWeaponAttackType, monsterWeaponDamageLabel` from `"../../combat/monster-gear"` and add to the returned object:
```typescript
    gear: (input.gear ?? []).map((g) => ({
      id: g.id, name: g.name, img: g.img, type: g.type, quantity: g.quantity, equipped: g.equipped,
    })),
    weaponAttacks: (input.gear ?? [])
      .filter((g) => g.type === "weapon" && g.equipped && g.weapon)
      .map((g) => ({
        id: g.id,
        name: g.name,
        damage: monsterWeaponDamageLabel(g.weapon!),
        type: monsterWeaponAttackType(g.weapon!.category),
      })),
    spells: buildSpellGroups(input.spells ?? []),
```
with, above `buildCreatureSheetContext`:
```typescript
function buildSpellGroups(spells: readonly CreatureSpellView[]): CreatureSheetContext["spells"] {
  const levels = [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b);
  return levels.map((level) => ({
    level,
    items: spells.filter((s) => s.level === level).map((s) => ({ id: s.id, name: s.name, img: s.img })),
  }));
}
```
(import `CreatureSpellView` type). If a whole-object `toEqual` in an existing creature context test now fails because of the three new keys, add `gear: [], weaponAttacks: [], spells: []` to that expectation and note it in the report.
- [ ] **Step 3: Verify** — creature context tests pass; typecheck/lint/coverage exit 0; `context.ts` 100% line/stmt/func.
- [ ] **Step 4: Commit** — `feat(monster): gear, weapon attack and spell rows in the Monster NPC sheet context` (+ Co-Authored-By trailer).

---

### Task 3: Glue — sheet, attacks, casting, drops, templates, lang

**Files:** Modify `src/sheets/creature/combat-rolls.ts`, `src/sheets/creature/sheet.ts`, `templates/actor/creature/sheet.hbs`, `styles/actor/creature.scss`, `lang/en.json`, `tests/lang/en-coverage.test.ts`

**Interfaces — Consumes:** Task 1 `monsterDropVerdict`, `monsterWeaponDamageFormula`; Task 2 context fields; `rollSpellAutomation`, `postCastCard` (`src/sheets/character/spell-actions.ts`); `editOwnedItem`, `deleteOwnedItem` (`src/sheets/item-row-actions.ts`); partial `adnd2e.item-controls`.

- [ ] **Step 1: Lang (failing test first)** — append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — Monster NPC gear & spells", () => {
  it("resolves every new Monster NPC key", () => {
    for (const key of [
      "ADND2E.sheet.drop.monsterRejects",
      "ADND2E.sheet.creature.gear",
      "ADND2E.sheet.creature.noGear",
      "ADND2E.sheet.creature.equipped",
      "ADND2E.sheet.creature.quantity",
      "ADND2E.sheet.creature.weaponAttacks",
      "ADND2E.sheet.creature.spells",
      "ADND2E.sheet.creature.noSpells",
      "ADND2E.sheet.creature.cast",
      "ADND2E.sheet.creature.weaponAttackBlockedWarning",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
FAIL, then add to `ADND2E.sheet.drop`: `"monsterRejects": "A Monster NPC can carry weapons, armor, equipment and spells — not classes, races, proficiencies, traits or class features."` and to `ADND2E.sheet.creature`: `"gear": "Gear"`, `"noGear": "No gear"`, `"equipped": "Equipped"`, `"quantity": "Qty"`, `"weaponAttacks": "Weapon Attacks"`, `"spells": "Spells"`, `"noSpells": "No spells"`, `"cast": "Cast"`, `"weaponAttackBlockedWarning": "That weapon isn't equipped any more — refresh the sheet."`. Re-run → pass.

- [ ] **Step 2: One shared attack routine** — in `src/sheets/creature/combat-rolls.ts`, move the whole body of `rollAttack` after the `attack` lookup into a new internal function, parameterized by an attack *source*, WITHOUT changing any stat-block behavior:
```typescript
interface AttackSource {
  name: string;
  thac0: number;
  /** 0 for stat-block attacks; the weapon's magic bonus for weapon attacks */
  weaponMagicBonus: number;
  /** the damage formula for a hit against a target of this size (null = none to roll) */
  damageFormula(targetSize: CreatureSize | null): string | null;
}
```
- `rollAttack(actor, attackIndex)` becomes: look up the attack (return if missing), then `await rollCreatureAttack(actor, { name: attack.name, thac0: attack.thac0Override ?? actor.system.attributes.thac0.value, weaponMagicBonus: 0, damageFormula: () => attack.damage })`.
- In `rollCreatureAttack`: the existing flow, with these three edits only — (a) keep a `let targetSize: CreatureSize | null = null;` and set it from `resolveTargetCombatInfo(...).size` in the single-target branch (cast to `CreatureSize | null`); (b) `attackModifiers({ weaponMagicBonus: source.weaponMagicBonus, situationalModifier: … })` (for stat-block attacks the bonus is 0, so the total and the breakdown values are unchanged); (c) the damage step: `const formula = source.damageFormula(targetSize); if (hit.hit && formula) { const damageRoll = await new Roll(formula).evaluate(); … }` with `name: source.name` in the flavor and `weaponName: source.name` on the attack card. For stat-block attacks `damageFormula` returns the authored `attack.damage` string exactly as before (including an empty string, which `if (formula)` now skips instead of throwing inside `new Roll("")` — note this in the report as the one intentional behavior difference, or keep `formula !== null` if you find the old path handled `""` differently; report which).
- Add:
```typescript
/** Attack with an EQUIPPED weapon item: monster THAC0 + the weapon's magic bonus,
 *  the weapon's S-M / L damage by target size (Monster NPC gear design). */
export async function rollWeaponAttack(actor: CreatureActor & { items: { get(id: string): unknown } }, itemId: string): Promise<void> {
  const item = actor.items.get(itemId) as
    | { name: string; type: string; system: { equipped?: boolean; category: string; magicBonus: number; damageVsSM: string | null; damageVsL: string | null } }
    | undefined;
  if (!item || item.type !== "weapon" || !item.system.equipped) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.creature.weaponAttackBlockedWarning"));
    return;
  }
  const weapon = { category: item.system.category, magicBonus: item.system.magicBonus ?? 0, damageVsSM: item.system.damageVsSM, damageVsL: item.system.damageVsL };
  await rollCreatureAttack(actor, {
    name: item.name,
    thac0: actor.system.attributes.thac0.value,
    weaponMagicBonus: weapon.magicBonus,
    damageFormula: (size) => monsterWeaponDamageFormula(weapon, size),
  });
}
```
(import `monsterWeaponDamageFormula` from `"../../combat/monster-gear"` and `type CreatureSize` from `"../../core/types"`).

- [ ] **Step 3: Sheet** — in `src/sheets/creature/sheet.ts`:
  1. Add `_onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown>;` to the `Base` member list, and override it:
  ```typescript
  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const verdict = monsterDropVerdict((item as unknown as { type: string }).type);
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason));
      return null;
    }
    return super._onDropItem(event, item);
  }
  ```
  2. In `#buildInput`, read `actor.items` (type it as `Iterable<{ id: string; name: string; img: string; type: string; system: Record<string, unknown> }>`) and add:
  ```typescript
      gear: items
        .filter((i) => i.type === "weapon" || i.type === "armor" || i.type === "equipment")
        .map((i) => ({
          id: i.id, name: i.name, img: i.img,
          type: i.type as "weapon" | "armor" | "equipment",
          quantity: Number(i.system.quantity ?? 1),
          equipped: Boolean(i.system.equipped),
          weapon: i.type === "weapon"
            ? {
                category: String(i.system.category ?? "melee"),
                magicBonus: Number(i.system.magicBonus ?? 0),
                damageVsSM: (i.system.damageVsSM as string | null) ?? null,
                damageVsL: (i.system.damageVsL as string | null) ?? null,
              }
            : undefined,
        })),
      spells: items
        .filter((i) => i.type === "spell")
        .map((i) => ({ id: i.id, name: i.name, img: i.img, level: Number(i.system.level ?? 1) })),
  ```
  3. Actions (add to `DEFAULT_OPTIONS.actions` with handlers): `rollWeaponAttack` (→ `rollWeaponAttack(this.document as never, target.dataset.itemId)`), `castMonsterSpell` (look up the spell item; `const rolled = await rollSpellAutomation(spell as never); if (rolled) await postCastCard(this.document as never, spell as never, rolled);`), `toggleEquipped` (only when `this.isEditable`: `item.update({ "system.equipped": !item.system.equipped })`), `editItem` (`editOwnedItem`), `deleteItem` (`deleteOwnedItem`, only when `this.isEditable`).

- [ ] **Step 4: Template** — in `templates/actor/creature/sheet.hbs`:
  - inside the Attacks panel, directly after the stat-block `{{#each}}…{{/each}}` attack list (before the Add Attack button), add:
  ```hbs
      {{#if adnd2e.weaponAttacks.length}}
        <h4>{{localize 'ADND2E.sheet.creature.weaponAttacks'}}</h4>
        {{#each adnd2e.weaponAttacks as |wa|}}
          <div class="attack-row weapon-attack" data-item-id="{{wa.id}}">
            <span class="name">{{wa.name}}</span>
            <span class="damage">{{wa.damage}}</span>
            <span class="type">{{localize (concat 'ADND2E.attackTypes.' wa.type)}}</span>
            <button type="button" data-action="rollWeaponAttack" data-item-id="{{wa.id}}">{{localize 'ADND2E.sheet.combat.rollAttack'}}</button>
          </div>
        {{/each}}
      {{/if}}
  ```
  (verified during planning: `CONFIG.ADND2E.attackTypes` maps to `ADND2E.attackTypes.melee` / `.ranged` (src/config.ts:222), and v14 registers the `concat` Handlebars helper (client/applications/handlebars.mjs:124).)
  - after the Attacks panel, add the Gear and Spells panels:
  ```hbs
    <div class="gear panel">
      <h3>{{localize 'ADND2E.sheet.creature.gear'}}</h3>
      {{#each adnd2e.gear as |g|}}
        <div class="gear-row" data-item-id="{{g.id}}">
          <span class="name">{{g.name}}</span>
          <span class="quantity" title="{{localize 'ADND2E.sheet.creature.quantity'}}">×{{g.quantity}}</span>
          <label class="equipped">
            <input type="checkbox" data-action="toggleEquipped" data-item-id="{{g.id}}" {{checked g.equipped}} {{#unless @root.editable}}disabled{{/unless}}>
            {{localize 'ADND2E.sheet.creature.equipped'}}
          </label>
          {{> adnd2e.item-controls id=g.id deletable=@root.editable}}
        </div>
      {{else}}
        <p class="placeholder">{{localize 'ADND2E.sheet.creature.noGear'}}</p>
      {{/each}}
    </div>

    <div class="spells panel">
      <h3>{{localize 'ADND2E.sheet.creature.spells'}}</h3>
      {{#each adnd2e.spells as |grp|}}
        <h4>{{localize 'ADND2E.sheet.spells.level' level=grp.level}}</h4>
        {{#each grp.items as |s|}}
          <div class="spell-row" data-item-id="{{s.id}}">
            <span class="name">{{s.name}}</span>
            <button type="button" data-action="castMonsterSpell" data-item-id="{{s.id}}">{{localize 'ADND2E.sheet.creature.cast'}}</button>
            {{> adnd2e.item-controls id=s.id deletable=@root.editable}}
          </div>
        {{/each}}
      {{else}}
        <p class="placeholder">{{localize 'ADND2E.sheet.creature.noSpells'}}</p>
      {{/each}}
    </div>
  ```
  - `styles/actor/creature.scss`: add minimal row layout for `.gear-row`, `.spell-row`, `.weapon-attack` (flex, gap 0.5rem, align-items center), following that file's existing nesting and variables.

- [ ] **Step 5: Verify** — typecheck, lint, `npm run test:coverage` exit 0; lang test passes. In the report, walk `rollAttack` (stat-block) before vs after and confirm identical rolls, card data and damage flow (and state what happens for an empty `damage` string before vs after).
- [ ] **Step 6: Commit** — `feat(monster): gear panel, equipped-weapon attacks, spell casting and drop guard on the Monster NPC sheet` (+ trailer).

---

### Task 4: README (controller may do directly)

Remove the "Monster NPC inventory (designed, next pass)" backlog entry; reword the creature-disarm-log entry to: a relayed disarm against an **unarmed** Monster NPC logs "applied a disarm" though nothing changed. Update the Sub-project 6 row / Table settings to mention the Monster NPC gear, weapon attacks and spells. Commit `docs: Monster NPC gear, weapon attacks and spells`.

---

### Task 5: Whole-branch review (MANDATORY)

Most capable model over base..HEAD with this plan, the spec and this risk list:
- **Stat-block attacks byte-identical** (walk the `rollAttack` refactor: THAC0/override, situational modifiers, crit/fumble, card, damage roll, message mode, Apply button); the empty-damage-string case.
- **Equipped-only weapon rows**; unequip (checkbox, ✎, relayed disarm) removes the row; `rollWeaponAttack` re-checks equipped state server-side.
- **Weapon math:** THAC0 + magic bonus to-hit shows in the breakdown; ranged categories; S-M vs L by the single target's size; null dice → no damage roll; magic bonus in damage.
- **Drops:** rejected types toast and create nothing; accepted types unchanged; re-sort of owned items unaffected; PC/Character NPC sheets untouched.
- **Spells:** cast needs no memorized entry and writes nothing on the actor; automation failure toasts.
- **Templates:** `@root.editable` inside `{{#each}}`; checkbox never submitted by the form; helpers used exist in v14.
- **Permissions:** only the monster's owner/GM can toggle/delete (sheet `isEditable`); nothing else writes.
- **Pure zone** 100%; re-run typecheck/lint/test:coverage.
One fix wave + scoped re-review for Critical/Important.

---

### Task 6: GATED dev-world smoke check

Confirm Foundry closed → build → link → restart. Setup: a Monster NPC (e.g. an orc) with THAC0 19 and a stat-block attack; world items: a Long Sword (+1), a Short Bow, Chain Mail, a Rope, a damage spell (e.g. Magic Missile with automation damage); a Large target and a Medium target; the Player in a private window with Combat & Tactics maneuvers on.

- [ ] **Drops:** sword, bow, chain mail, rope and the spell drop fine; a class/race/proficiency/trait drop shows the rejection toast and creates nothing.
- [ ] **Gear panel:** all four items listed with quantity; Equipped toggles; ✎ opens the item; 🗑 confirms and deletes.
- [ ] **Weapon attacks:** equipping the sword adds a "Weapon Attacks" row (1d8 / 1d12 +1, melee); the bow row shows ranged; unequipped weapons have no row. Roll the sword vs the Medium target to a hit → card shows the +1 in the breakdown, damage 1d8+1 with Apply; vs the Large target → 1d12+1.
- [ ] **Stat-block attack unchanged:** roll it → same card and damage as before.
- [ ] **Armor:** equipping chain mail does not change AC.
- [ ] **Spells:** the spell appears under its level; Cast posts the cast card with the damage roll + Apply.
- [ ] **Relayed disarm (player seat):** the player's PC lands a disarm on the armed Monster NPC → the sword is unequipped and its attack row disappears (GM log whisper appears).
- [ ] Report PASS/FAIL via `AskUserQuestion`.

## After this plan lands

Push + PR (standing default); update memory; ask what's next.
