# AD&D 2E for Foundry VTT — Monster NPC inventory, weapon attacks & spells

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-26
**Author:** Joshua Frank + Claude
**Context:** post-Sub-project-9 backlog ("Monster NPC inventory", decided 2026-09-26). The `creature` actor type is displayed **Monster NPC** (PR #37).

## 1. Problem

A Monster NPC is a Monstrous-Manual stat block: Hit Dice, flat THAC0/AC/saves and a hand-typed `system.attacks[]` list (`src/data/actor/creature.ts`). The Monster NPC sheet (`src/sheets/creature/**`, `templates/actor/creature/sheet.hbs`) has no item handling at all, so a monster cannot carry gear, wield a real weapon (a disarm has nothing to unequip — README backlog note), or cast a spell item.

## 2. Decisions (locked in brainstorming)

| Decision | Value |
|---|---|
| Items accepted | **Weapons, armor, equipment and spells.** Rejected with a toast: `class`, `race`, `weaponProficiency`, `nonweaponProficiency`, `trait`, `classFeature` (and `condition`). |
| Gear UI | A simple **Gear** panel: weapons, armor, equipment with quantity, an **Equipped** checkbox and the ✎/🗑 controls. No weight, containers, locations or encumbrance. |
| Equipped armor | **No mechanical effect** — the stat-block AC stays as authored (the GM edits it by hand). |
| Equipped weapon | Becomes an **extra attack row** beside the stat-block attacks. To-hit = the monster's THAC0 with the weapon's magic bonus as an attack bonus (no Strength, no proficiency); melee vs ranged from the weapon's category (`melee` → melee, `thrown`/`bow`/`crossbow` → ranged); same situational modifiers as stat-block attacks (blinded, held target, prone target AC). On a hit, damage auto-rolls: the weapon's S-M or L dice by the target's size (the existing `pickDamageDice`), plus the magic bonus, posted on the Monster NPC damage card with its Apply button (crits included). |
| Disarm | Unequipping the weapon removes its attack row — a disarm (local or relayed) now genuinely disarms a Monster NPC. |
| Spells | A **Spells** panel lists spell items by level with a **Cast** button that posts the normal cast card (range/duration/save, damage/healing roll + Apply). No memorization, slots or casting-time flow; the GM tracks "N/day". |
| Non-GM seat | Players rarely own monsters; the player seat is exercised only by a relayed disarm. |

## 3. Global Constraints

- **Foundry v14.364** source is authoritative — never `fvtt-types`.
- **Two-layer contract:** pure logic — the monster weapon-attack profile (to-hit bonus, attack type, damage dice + bonus by target size), the drop rule, and the Monster NPC sheet context (`src/sheets/creature/context*.ts`, already a pure zone) — at 100% line/statement/function coverage; Foundry glue (sheet, actions, templates) typecheck/lint gated and dev-world verified.
- **No schema change / no migration:** items are ordinary embedded Items (every Foundry actor already holds them); the creature DataModel is unchanged.
- **Existing stat-block attacks and saves are unchanged** (behavior-identical).
- No `npm run format`/`prettier`/`npm install`/`npm update`; `npm run build` needs Foundry closed (re-confirm); vitest via `tail`/redirect, never `| grep`.
- Mandatory whole-branch review; GATED dev-world check.

## 4. Architecture

- **Pure** `src/combat/monster-weapon.ts`: `monsterWeaponAttack({ category, magicBonus, damageVsSM, damageVsL }, targetSize)` → `{ attackType: "melee" | "ranged"; attackBonus: number; damageDice: string | null; damageBonus: number }`, reusing `pickDamageDice` and `damageModifiers` from the existing combat code; `monsterDropVerdict(itemType)` → `{ ok } | { ok: false, reason }`.
- **Context** (`src/sheets/creature/context.ts` / `context-types.ts`): new input `gear` (weapon/armor/equipment views) and `spells` (spell views); output `gear` rows (id, name, img, type, quantity, equipped, canEdit/canDelete precomputed), `weaponAttacks` rows (from EQUIPPED weapons: id, name, damage label, attackType) and `spells` grouped by level.
- **Glue** (`src/sheets/creature/sheet.ts`): builds the new inputs from `actor.items`; actions `rollWeaponAttack` (item id), `castMonsterSpell` (item id), `toggleEquipped`, `editItem`/`deleteItem` (reuse `src/sheets/item-row-actions.ts`), and an `_onDropItem` override applying `monsterDropVerdict`. `src/sheets/creature/combat-rolls.ts` gains `rollWeaponAttack(actor, itemId)` sharing the stat-block attack's target/AC/crit/fumble/card flow; the damage step uses the weapon profile. Spells cast via the existing `rollSpellAutomation` + `postCastCard` (SP9 refactor of `spell-actions.ts`) — no memorized-entry bookkeeping.
- **Templates:** `templates/actor/creature/sheet.hbs` gains the weapon attack rows (inside the Attacks panel, after the stat-block rows), a Gear panel and a Spells panel, using the shared `adnd2e.item-controls` partial with `deletable=@root.editable`.
- **README:** the Monster NPC inventory backlog entry and the creature-disarm-log note are resolved.

## 5. Error handling

A weapon with no damage dice for the target size (e.g. a bow with no modeled ammo) posts the attack card and no damage (same as PC `onRollDamage`). A cast with an unrollable automation formula shows the existing `castRollFailedWarning`. Rejected drops show `ADND2E.sheet.drop.monsterRejects` and create nothing.

## 6. Testing

Pure: every weapon category → attack type; magic bonus to-hit/damage; S-M vs L dice by size; null dice; every item type through the drop rule; the new context rows (equipped-only weapon attacks, gear permissions, spell grouping). Dev world: drop gear/spell, rejected class drop, equip a weapon → attack row → roll to a hit → damage + Apply; unequip hides the row; cast a spell; player-seat relayed disarm removes the row.

## 7. Out of scope

Armor affecting AC; encumbrance/containers for monsters; monster spell slots, uses/day, casting time or disruption; ammunition tracking; multiple attacks per round for weapon rows.
