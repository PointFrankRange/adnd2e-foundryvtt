# AD&D 2E for Foundry VTT — Ammunition for bows and crossbows

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-28
**Author:** Joshua Frank + Claude
**Context:** README backlog item ("Ammunition isn't modeled, so bows and crossbows deal no damage" — README.md line 99). Per the PHB a bow or crossbow has no damage of its own; the arrow, bolt or quarrel carries the S-M/L damage dice and type. Launchers currently have `damageVsSM`/`damageVsL` hard-coded to `null` (`src/core/weapons/data.ts:28-36`), so a PC's ranged attack posts a hit/miss card with no damage roll.

## 1. Problem

`selectDamageDice()`/`toWeaponData()` (`src/core/weapons/data.ts`) return `null` damage dice for any weapon with `category: "bow"|"crossbow"` (`src/data/item/weapon.ts:11-35`), by design — the rulebook puts the damage on the ammunition, which this system has never modeled. `onRollDamage()` (`src/chat/chat-listeners.ts:42-46`) already special-cases this: if `pickDamageDice()` returns `null` dice it silently skips the damage roll. There is also no prior art anywhere in `src/` for decrementing an item's `quantity` on use — every existing physical-item field (`quantity`, `charges`) is read-only outside manual sheet edits.

## 2. Decisions (locked in brainstorming)

| Decision | Value |
|---|---|
| Scope | **PCs only.** Monster NPC ranged attacks keep using `monsterWeaponDamageFormula`/`monster-gear.ts` unchanged — consistent with Monster NPC weapon attacks already being a deliberately simpler v1 path. The `ammo` item type is not added to `MONSTER_ITEM_TYPES`; dropping one on a Monster NPC sheet is rejected like any other unsupported type. |
| Ammo representation | A new **`ammo`** item subtype (not a repurposed `equipment` item), carrying its own `damageVsSM`/`damageVsL`/`damageType` and an `ammoType` tag. |
| Weapon↔ammo matching | **Explicit `ammoType` field on both.** The weapon (bow/crossbow only) declares what it fires (e.g. `"arrow"`, `"bolt"`); ammo items declare the same tag. The ammo dropdown for a weapon only lists ammo items whose `ammoType` matches — no hardcoded category-name matching, so variant ammo (silver arrows, flight arrows) or a future launcher category works without new code. |
| Consumption timing | **On the attack roll, hit or miss.** `rollAttack()` decrements the selected ammo item's `quantity` by 1 immediately, before/alongside posting the attack card — matches PHB reality (the arrow is loosed regardless of outcome) and keeps ammo count accurate even though damage is a separate, later button click. |
| No-ammo handling | **Block the roll.** If the weapon has no valid `selectedAmmoId`, or that item's `quantity` is 0, `rollAttack()` shows a warning toast and does not roll or post a card at all. |
| Selection persistence | **Sticky, stored on the weapon item** (`selectedAmmoId`). Survives sheet re-renders and reopening the sheet; updated whenever the player changes the dropdown. |

## 3. Global Constraints

- **Foundry v14.364** source is authoritative — never `fvtt-types`.
- **Two-layer contract:** pure logic — the ammo schema and ammo-matching helper (§4) — unit tested; Foundry glue (`combat-rolls.ts`, `chat-listeners.ts`, `context.ts`, sheet listeners, templates) stays typecheck/lint gated and dev-world verified, matching the existing convention for those files (spec §9 precedent: "Foundry-coupled, verified in a linked dev world").
- **Schema change, no data migration needed:** a new item subtype and two new nullable weapon fields are additive; no existing item data is reshaped.
- Existing melee/thrown weapon behavior is unchanged end-to-end (their `ammoType`/`selectedAmmoId` stay `null`, so `rollAttack()` takes the pre-existing code path).
- No `npm run format`/`prettier`/`npm install`/`npm update`; `npm run build` needs Foundry closed; vitest via `tail`/redirect, never `| grep`.
- Mandatory whole-branch review; GATED dev-world check (must include a non-GM player seat per standing project convention).

## 4. Architecture

- **Data model:**
  - New `src/data/item/ammo.ts`: extends the shared physical-item fields (`quantity`, `weight`, `cost`, `location`, `identified`) with `ammoType` (string), `damageVsSM`/`damageVsL` (required strings), `damageType` (required string).
  - Registered in `src/data/item/subtypes.ts` (`ITEM_SUBTYPES`) and `system.json` `documentTypes.Item`, following the existing weapon/armor/equipment pattern.
  - `src/data/item/weapon.ts`: two new nullable fields, populated only when `category` is `"bow"` or `"crossbow"`: `ammoType` (what it fires) and `selectedAmmoId` (id of the currently-selected ammo item on the same actor).
  - **Correction found while writing the plan:** `WeaponData`/`toWeaponData()` (`src/core/weapons/data.ts` / `src/data/derive/weapon.ts`) is a pure field-mapper with no actor context, and its output (`system.weaponData`, set in `WeaponItemModel.prepareDerivedData()`) is never read anywhere else in `src/` — `combat-rolls.ts`, `chat-listeners.ts` and `context.ts` all read a weapon's raw schema fields (`weapon.system.category`, `.damageVsSM`, etc.) directly. It has no way to look up an ammo item (no actor reference) and isn't wired into any runtime path, so it is **left untouched**; ammo resolution instead happens at the three real call sites below, reading the ammo item's own schema fields the same way weapon fields are read today.

- **Attack/consumption flow:**
  - `rollAttack()` (`src/sheets/character/combat-rolls.ts`): for a bow/crossbow, before rolling to-hit, look up the weapon's `selectedAmmoId` on the actor. Missing item or `quantity <= 0` → warning toast, abort (no roll, no card). Otherwise proceed with the existing to-hit flow, and decrement the ammo item's `quantity` by 1 via `item.update()` (same shape as the existing `unequipWeapon()` call at `combat-rolls.ts:201-203`, applied to the ammo item).
  - The attack card's `damageContext` flags gain `ammoItemId`, capturing which ammo item was actually used for *this* shot — so a later ammo-type switch before clicking "Roll Damage" can't retroactively change what a past shot's damage card rolls.
  - `onRollDamage()` (`src/chat/chat-listeners.ts`): for a bow/crossbow, resolves `damageContext.ammoItemId` and builds `pickDamageDice()`'s input from that ammo item's `damageVsSM`/`damageVsL`/`damageType`; melee/thrown weapons keep reading their own fields as today. `pickDamageDice()` itself is unchanged (dice-source-agnostic).
  - Monster NPC path (`monster-gear.ts`, `src/sheets/creature/combat-rolls.ts`) is untouched.

- **Sheet UI:**
  - `templates/actor/pc/partials/pc-main-panels.hbs`: in `.weapon-row`, a new `<select class="ammo-select" data-item-id="{{w.id}}">` rendered only for bow/crossbow rows, next to the existing `.maneuver-select`. Options are every owned ammo item with matching `ammoType` and `quantity > 0`, labeled with name + remaining count. If none match, a single disabled "No ammo" option renders instead of an empty list. Selected option defaults to `selectedAmmoId` when still valid, else the first match.
  - `src/sheets/character/context.ts` (`buildCombat()`) computes the matching-ammo list and current selection per weapon row; typed via `CharacterSheetContext["combat"].weapons` (`context-types.ts:341`).
  - `src/sheets/character/sheet.ts` (`#onRollAttack`, ~line 708-720): reads `.ammo-select`'s value the same way `.maneuver-select` is read today, and passes it into `rollAttack()`. A `change` listener on `.ammo-select` persists the pick to `selectedAmmoId` via `item.update()`.
  - Inventory table and favorites panel need no changes: ammo items appear in the inventory table like any other physical item, and favoriting a bow still resolves ammo internally when its favorite Roll Attack action fires.

## 5. Error handling

- No selection / selected ammo item deleted / `quantity` at 0 at click time: `rollAttack()` re-validates live (not the possibly-stale row data) and toasts a warning without posting a card.
- `quantity` reaches exactly 0 after a shot: next render shows the "No ammo" disabled option; `selectedAmmoId` is left pointing at the now-empty item rather than reassigned, so manually restocking that same item makes the prior selection valid again with no extra bookkeeping.
- A dangling `selectedAmmoId` (its ammo item was deleted) is treated identically to "no valid selection" — a toast, not a crash — consistent with how the codebase already tolerates dangling ids elsewhere rather than adding cleanup logic.
- Melee/thrown weapons: no behavior change, since their ammo fields stay `null` throughout.
- README backlog line 99 is removed once this ships.

## 6. Testing

- `tests/data/subtypes.test.ts`: extend for the new `ammo` subtype.
- New `tests/data/item/ammo.test.ts`: ammo schema defaults and required fields.
- New pure ammo-matching helper (e.g. `src/combat/ammo.ts`, used by both `context.ts` and `combat-rolls.ts`): unit tested for matching-by-`ammoType`, excluding zero-`quantity` stock, and resolving/validating a `selectedAmmoId`.
- `tests/combat/damage-dice.test.ts`: existing null-dice case stays valid (a bow with no ammo resolved); add a case where ammo-sourced dice flow through `pickDamageDice()` normally (no code change to `pickDamageDice()` itself — it already takes any `{damageVsSM, damageVsL}` source).
- `tests/combat/monster-gear.test.ts`: add a case confirming `monsterDropVerdict("ammo")` is rejected.
- `combat-rolls.ts`/`chat-listeners.ts` stay dev-world verified only, per existing convention. Manual checklist for the plan: shoot with ammo selected (hit and miss, confirm quantity drops both times); shoot to 0 and confirm block + toast; switch ammo type mid-session and confirm the pick persists across a re-render; drop an ammo item on a Monster NPC sheet and confirm it's rejected like other unsupported types.

## 7. Out of scope

Ammo tracking/consumption for Monster NPCs; ammo recovery (retrieving spent arrows after combat); slings/bullets or any non-bow/crossbow launcher; automatic reassignment of `selectedAmmoId` when a stack empties; encumbrance interactions beyond ammo already being an ordinary weighed physical item.
