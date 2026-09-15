# AD&D 2E for Foundry VTT — Sub-project 3: Core Combat

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-14
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling spec:** `docs/superpowers/specs/2026-09-09-adnd2e-sp2-character-sheet-design.md` (Sub-project 2 — PC Character Sheet)

---

## 1. Context

Sub-projects 1 and 2 delivered the whole data foundation and a real, editable character sheet — but nothing on the sheet *executes* a roll. Per the parent spec's decomposition (§1) and SP2's explicit scope boundary (§10): "No roll execution — no attack, damage, saving-throw, ability-check, or proficiency-check rolls or chat cards." Every number SP2 shows (THAC0, AC, saves, weapon damage dice) is display-only.

This sub-project wires those numbers into real Foundry `Roll`s, chat cards, and initiative. Per the parent spec's sub-project table: "THAC0 attack rolls vs. AC, damage, 5 saving-throw categories, initiative (individual + weapon speed + casting time), combat-tracker override."

### 1.1 What already exists (SP3 mostly *wires*, doesn't invent math)

The `core/combat/` engine (Plan 1b.4) already has every formula SP3 needs:

- `src/core/combat/attack.ts` — `attackModifiers(input): AttackModifierResult`, `toHitNumber(thac0, targetAc): number`, `hitResult(input: HitInput): HitResult` (natural-20-always-hits / natural-1-always-misses, gated on the natural die per PHB p.92).
- `src/core/combat/damage.ts` — `damageModifiers(input): DamageModifierResult`, `damageResult(rolledBaseDamage, damageBonus): number` (floors at 1).
- `src/core/combat/armor-class.ts` — `armorClass(input)` (already consumed by SP1's derive pipeline; SP3 doesn't call this directly — `targetAc` comes from the target actor's already-cached `system.attributes.ac.*`).
- `src/core/saves/composer.ts` — `saveTargetBest(input): SaveTargetResult` (`{target, rollModifier, effectiveTarget}`; already consumed by SP1's derive pipeline — SP3 reads the cached `system.saves.<k>.*`, doesn't call this directly either).
- `src/core/dice/formula.ts` — `signedTerm`, `attackFormula(attackBonus)`, `damageFormula(baseDice, damageBonus)` — formula **strings**, never a `Roll`. SP3 adds `initiativeFormula` alongside these.

**Nothing in `core/` constructs a Foundry `Roll`, a `ChatMessage`, or touches `game`/`canvas`/tokens** (parent spec §4.1, unchanged rule). SP3's new work is: (a) a small amount of new pure math (initiative modifiers, damage-dice selection by target size), and (b) the Foundry-layer wiring — real `Roll`s, chat cards with interactive buttons, token targeting, and the `Combatant`/`Combat` document overrides initiative needs.

### 1.2 Platform

Foundry VTT **v14.364**. `fvtt-types` is a wrong v13-beta — **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source for every Foundry-layer API.** Confirmed this session: `Combatant#_getInitiativeFormula()` (protected instance method, default `String(CONFIG.Combat.initiative.formula || game.system.initiative)`) and `Combat#_sortCombatants(a, b)` (protected instance method, default `(ib - ia) || tiebreak` — descending) are the exact override points for initiative and tracker sort order.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Damage application | Manual, via a chat-card "Apply to Targeted Token(s)" button — nothing changes HP without a deliberate click. |
| Attack targeting | Foundry's native token targeting (`game.user.targets`); manual AC entry only when nothing is targeted or more than one token is targeted. |
| Initiative scope | Individual initiative = `1d10` + DEX reaction adjustment (always) + weapon speed factor (when the `weaponSpeedInitiative` optional rule is on, read from the actor's currently-equipped melee weapon) + a manual per-round modifier field (covers spell casting time by hand — SP4 doesn't exist yet to wire it automatically). No "declare your action" UI. |
| Damage-dice pick (vs SM/L) | Auto-detected from the targeted token's creature size; a manual S/M-vs-L toggle in the damage dialog when nothing is targeted. |
| Group initiative | Out of scope — individual only (parent spec reserves "expanded initiative" for Sub-project 7). |
| Saving throws | A roll button per save category on the Main tab; no "apply consequence" automation — a save's chat card reports pass/fail only. |
| Combat-tracker sort | 2E is low-goes-first; Foundry's default is high-first descending. Override `Combat#_sortCombatants` so the tracker displays natural, positive initiative numbers in the correct ascending order. |

---

## 3. Global Constraints

Copied forward from the parent + sibling specs; every task's requirements implicitly include this section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — never `fvtt-types`.
- **Two-layer contract:** new pure files (`src/core/combat/initiative.ts`, `src/combat/*.ts`) import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). The Foundry shell (`documents/combatant.ts`, the new `Combat` override, chat-card templates, sheet action handlers) is typecheck + build gated only, no unit tests, dev-world verified (spec §9 of the parent).
- **The gated-zone config triad** — every new pure file goes in ALL THREE of `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (both the Foundry-globals `ignores` array and the pure-zone `files` array).
- **Content policy:** mechanical/UI data only. Chat-card templates carry labels via `{{localize}}` keys, never 2E rules prose.
- **Do NOT run** `npm run format` / `prettier` / `npm install`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests").
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check is GATED** — the user runs it before `finishing-a-development-branch`, never a deferred checklist item.
- **Authored vs derived binding** (carried from SP2): a roll reads the actor's already-derived, cached `system.*` values (THAC0, AC, saves, weapon dice) — it never re-derives them itself. Attack/save rolls are read-only against the acting actor except for the deliberate, explicit "Apply Damage" HP write.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## 4. Code architecture

New / changed files:

```
src/core/combat/
  initiative.ts            NEW (pure) — initiativeModifiers()
src/core/dice/
  formula.ts                MODIFY (pure) — add initiativeFormula()
src/combat/
  damage-dice.ts            NEW (pure) — pickDamageDice()
  attack-card.ts            NEW (pure) — buildAttackCardContext()
  damage-card.ts            NEW (pure) — buildDamageCardContext()
  save-card.ts               NEW (pure) — buildSaveCardContext()
  card-types.ts              NEW (pure) — shared card-context interfaces

src/documents/
  combatant.ts               NEW (shell) — Adnd2eCombatant, initiative formula override
  combat.ts                  NEW (shell) — Adnd2eCombat, ascending _sortCombatants override
  index.ts                   MODIFY — export the two new classes

src/sheets/character/
  sheet.ts                   MODIFY (shell) — rollAttack / rollDamage / rollSave actions,
                             target-resolution helpers
  combat-rolls.ts             NEW (shell) — the Roll-construction + ChatMessage.create glue
                             consumed by sheet.ts's action handlers

src/chat/
  chat-listeners.ts           NEW (shell) — renderChatMessageHTML hook: wires the
                             "Roll Damage" / "Apply Damage" chat-card buttons

templates/chat/
  attack-roll.hbs             NEW
  damage-roll.hbs             NEW
  save-roll.hbs                NEW

templates/actor/character/
  main.hbs                    MODIFY — add a Roll button to each save row
  combat.hbs                  MODIFY — add a Roll Attack button per weapon,
                             wire the initiative-modifier field (if shown here vs. the tracker)

src/system.ts                 MODIFY — CONFIG.Combatant.documentClass / CONFIG.Combat.documentClass,
                             register the chat-listener hook

lang/en.json                  MODIFY — ADND2E.chat.* / ADND2E.combat.* tree

tsconfig.core.json            MODIFY — include the new pure files/dirs
vitest.config.ts              MODIFY — coverage.include the new pure files/dirs
eslint.config.js              MODIFY — ignores[]/files[] the new pure files/dirs

tests/core/combat/
  initiative.test.ts           NEW
tests/combat/
  damage-dice.test.ts          NEW
  attack-card.test.ts          NEW
  damage-card.test.ts          NEW
  save-card.test.ts             NEW
tests/lang/en-coverage.test.ts  MODIFY — drift block for the new lang keys
```

### 4.1 Pure layer

**`src/core/combat/initiative.ts`**

```ts
export interface InitiativeModifierInput {
  /** weapon speed factor of the currently equipped melee weapon; 0 if unarmed/none/toggle off */
  weaponSpeedFactor?: number;
  /** dexterity(dex).reactionAdj — already roll-signed (negative = better) */
  reactionAdj?: number;
  /** manual per-round entry (e.g. a spell's casting time) */
  situationalModifier?: number;
}

export interface InitiativeModifierResult {
  total: number;
  breakdown: { weaponSpeed: number; reaction: number; situational: number };
}

export function initiativeModifiers(input: InitiativeModifierInput): InitiativeModifierResult;
```

Pure addition (no subtraction/floor logic — 2E initiative is a straight sum: lower total acts first, and the individual terms may each be negative already).

**`src/core/dice/formula.ts`** — add:

```ts
/** A 1d10 initiative roll with its total modifier (2E is ascending: lower acts first). */
export function initiativeFormula(modifier: number): string {
  return `1d10${signedTerm(modifier)}`;
}
```

**`src/combat/damage-dice.ts`**

```ts
import type { CreatureSize } from "../core/types";

export interface WeaponDamageDice {
  damageVsSM: string | null;
  damageVsL: string | null;
}

/** Small/Medium creatures use damageVsSM; Large and up use damageVsL. Falls back to
 *  whichever die is non-null when the weapon only defines one (e.g. most ranged weapons'
 *  ammo carries damage, not the launcher — the caller resolves the right item first). */
export function pickDamageDice(weapon: WeaponDamageDice, targetSize: CreatureSize | null): string | null;
```

**`src/combat/card-types.ts`** — the render-context shape for each chat card (mirrors SP2's `context-types.ts` pattern):

```ts
export interface AttackCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  targetName: string | null;
  formula: string; naturalD20: number; total: number;
  needed: number; margin: number;
  hit: boolean; autoHit: boolean; autoMiss: boolean;
  modifierBreakdown: { label: string; value: number }[];
  /** carried into the "Roll Damage" button's dataset so damage knows what die to use */
  damageContext: { weaponItemId: string; actorId: string; targetSize: string | null } | null;
}

export interface DamageCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string; rolled: number; bonus: number; total: number;
  targetIds: string[]; // resolved at apply-time from game.user.targets, NOT baked in here
}

export interface SaveCardContext {
  actorName: string; actorImg: string;
  categoryLabel: string; // i18n key
  formula: string; naturalD20: number; total: number;
  target: number; success: boolean;
}
```

**`src/combat/attack-card.ts` / `damage-card.ts` / `save-card.ts`** — `buildAttackCardContext(input): AttackCardContext` etc., pure transforms from `{HitResult, AttackModifierResult, ...}` (the already-existing `core/combat` outputs) into the display context. 100% covered, test-first, same rigor as SP2's `context.ts`.

### 4.2 Foundry shell

**`src/documents/combatant.ts`**

```ts
export class Adnd2eCombatant extends Combatant {
  override _getInitiativeFormula(): string {
    const actor = this.actor;
    if (!actor) return super._getInitiativeFormula();
    const reactionAdj = /* actor.system.abilities.dex.mods.reactionAdj ?? 0, character/npc only */;
    const weaponSpeedOn = /* getOptionalRules().weaponSpeedInitiative */;
    const weaponSpeedFactor = weaponSpeedOn ? /* equipped melee weapon's speedFactor, else 0 */ 0 : 0;
    const situationalModifier = /* this.getFlag(SYSTEM_ID, "initiativeModifier") ?? 0 — a small per-combatant field the Combat Tracker UI exposes */ 0;
    const { total } = initiativeModifiers({ weaponSpeedFactor, reactionAdj, situationalModifier });
    return initiativeFormula(total);
  }
}
```
(Implementer verifies the exact `Actor`/`Combatant` typing and the "currently equipped melee weapon" resolution — reuse the same item-partition logic `src/sheets/character/sheet.ts` already has for the Combat tab's weapon list.)

**`src/documents/combat.ts`**

```ts
export class Adnd2eCombat extends Combat {
  override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
    const ia = Number.isFinite(a.initiative as number) ? (a.initiative as number) : Infinity;
    const ib = Number.isFinite(b.initiative as number) ? (b.initiative as number) : Infinity;
    return (ia - ib) || (a.id! > b.id! ? 1 : -1);
  }
}
```
(Ascending instead of the core default's descending; ties still break by id for determinism. `Infinity` instead of core's `-Infinity` for a not-yet-rolled combatant, so "hasn't gone yet" sorts to the END under ascending order, matching how core's descending default puts it at the end too.)

Both registered in `system.ts`'s `init` hook: `CONFIG.Combatant.documentClass = Adnd2eCombatant; CONFIG.Combat.documentClass = Adnd2eCombat;`.

**`src/sheets/character/combat-rolls.ts`** — the Roll-construction glue, called from `sheet.ts`'s new actions:

- `rollAttack(actor, weaponItemId): Promise<void>` — resolves `game.user.targets` (0/1/many → manual-AC dialog via `DialogV2` when 0 or >1), reads the acting actor's `system.attributes.thac0`, the weapon's derived to-hit inputs, builds `attackFormula`, evaluates a `Roll`, runs `hitResult`, posts via `buildAttackCardContext` + `templates/chat/attack-roll.hbs`.
- `rollDamage(actorId, weaponItemId, targetSize): Promise<void>` — invoked from the chat-card button (see below), not directly off the sheet.
- `rollSave(actor, category): Promise<void>` — reads `system.saves.<category>`, builds via `buildSaveCardContext`, posts `templates/chat/save-roll.hbs`.

**`src/chat/chat-listeners.ts`** — one hook registered in `system.ts`:
```ts
Hooks.on("renderChatMessageHTML", (message, html) => {
  html.querySelector('[data-action="rollDamage"]')?.addEventListener("click", () => { /* reads message.flags for actorId/weaponItemId/targetSize, calls rollDamage */ });
  html.querySelector('[data-action="applyDamage"]')?.addEventListener("click", () => { /* reads message.flags for the rolled total, applies to game.user.targets */ });
});
```
(Implementer confirms the exact v14 hook name — `renderChatMessageHTML` vs the legacy `renderChatMessage` — against `resources/app/client/applications/sidebar/tabs/chat-log.mjs` or wherever v14 fires it.) Roll/damage state needed by the buttons (weapon id, actor id, resolved target size) is stored in the `ChatMessage`'s own `flags.adnd2e.*`, not re-derived from the DOM.

**Apply-damage HP write**: `temp` absorbs first (`Math.max(0, damage - temp)` spills into `value`), one `actor.update({"system.attributes.hp.temp": ..., "system.attributes.hp.value": ...})` per targeted actor, gated on `actor.isOwner || game.user.isGM`.

### 4.3 Templates & lang

Three chat-card templates, each a compact card: actor portrait+name, the roll formula + result, a pass/fail or hit/miss line, and (attack card only) the "Roll Damage" button; (damage card only) the "Apply to Targeted Token(s)" button. `ADND2E.chat.*` lang keys for every label; `ADND2E.combat.*` for the sheet-side button labels ("Attack", "Save").

---

## 5. Error handling

- **No thac0/saves cached yet** (a 0-class fresh character) — the roll buttons are hidden or disabled when the underlying derived value is `null` (saves) or the default (`thac0.melee` still renders a number even at 0 classes per SP1's derive contract — an attack roll against an unrealistic THAC0 20 is harmless, not blocked).
- **Zero or multiple targets on attack** — the manual-AC dialog, not a silent guess.
- **"Apply Damage" with zero current targets** — a toast telling the user to target something first; no silent no-op.
- **A non-owner clicking "Apply Damage"** — the button is hidden/disabled unless `game.user.isGM` or the clicker owns every currently-targeted actor.
- **Weapon deleted between attack and damage roll** — the damage-roll handler re-reads the weapon item by id from the chat message's flags; if it's gone, a toast + no roll, rather than a crash.

---

## 6. Testing strategy

- **Pure zone** (`initiative.ts`, `damage-dice.ts`, the three card builders) — Vitest, test-first, **100% coverage**, added to the gated triad. Representative cases: `initiativeModifiers` with/without weapon speed, positive/negative reaction adj; `pickDamageDice` SM vs L vs null-target vs one-die-only weapons; each card builder's hit/miss/auto-hit/auto-miss and pass/fail branches.
- **Foundry shell** — no unit tests (parent §9). Manual dev-world exercise, gated before the finish menu:
  1. Two tokens on a scene (an attacker character, a target with known AC). Target the defender, click Roll Attack on an equipped weapon — chat card shows the right formula/hit-or-miss.
  2. Click Roll Damage on a hit — chat card shows the right die (S/M vs L) for the target's size; click Apply — the target's HP (and temp HP, if any) updates correctly.
  3. No target selected → manual AC dialog appears and the roll still resolves.
  4. Click Roll on each of the 5 saves — chat card matches the cached `system.saves.<k>` numbers.
  5. Add 3 combatants to a Combat encounter with different DEX/weapon-speed setups; roll initiative for all (`weaponSpeedInitiative` on) → Combat Tracker order is ascending (lowest total first), numbers shown are positive/natural, not negative.
  6. Toggle `weaponSpeedInitiative` off, re-roll → weapon speed no longer affects the total (DEX reaction adj still does).
  7. A GM applies damage that exceeds a target's temp HP → temp zeroes, the remainder comes off `value`.

---

## 7. Scope boundary — what SP3 does NOT include

- **No ability checks, no non-weapon-proficiency checks, no weapon-specialization slot spending UI.** (SP5.)
- **No spell casting, no slot decrement, no memorization management.** (SP4.) Casting time only enters initiative as a manually-typed number.
- **No critical-hit tables, called shots, or other Combat & Tactics maneuvers.** (SP7.)
- **No group initiative.** (Reserved for SP7's "expanded initiative," per the parent spec.)
- **No monster/creature attack automation** — a `creature` actor still has the SP1 raw stub sheet (SP6 gives it a real one); SP3's roll buttons live on `Adnd2eCharacterSheet` (`character`/`npc`) only. A GM can still manually roll a creature's numbers via the console/chat, just not from a designed sheet button.
- **No damage-type resistance/immunity automation.** Damage is a flat number; type-based mitigation is a later concern (spell/monster-ability automation, not core combat).
- **No automated saving-throw-for-half or on-hit secondary effects** (poison, disease). Those pair a save with an effect source that doesn't exist yet.
- **No ammunition items, so bow/crossbow/sling "Roll Damage" has nothing to roll.** Per SP1c.2 (Ruling PF1), a ranged weapon's own `damageVsSM`/`damageVsL` are `null` — the ammunition was meant to carry damage, and no ammo item type exists yet. Self-contained melee/thrown weapons (sword, axe, dagger) work fully. `pickDamageDice` returning `null` for a ranged weapon with no resolvable dice is a real, expected v1 result — the "Roll Damage" button is disabled with a tooltip explaining why, not a broken roll. Ammunition is a future-sub-project item-type addition, not part of SP3.

---

## 8. Deliverables checklist

1. `src/core/combat/initiative.ts` + `src/core/dice/formula.ts` addition — pure, 100% tested.
2. `src/combat/{damage-dice,attack-card,damage-card,save-card,card-types}.ts` — pure, 100% tested.
3. `src/documents/{combatant,combat}.ts` — Foundry shell, registered in `system.ts`.
4. `src/sheets/character/combat-rolls.ts` + `sheet.ts` action wiring (Roll Attack / Roll Save) + `combat.hbs`/`main.hbs` button markup.
5. `src/chat/chat-listeners.ts` + the 3 chat-card templates + the Roll Damage / Apply Damage flow.
6. `lang/en.json` `ADND2E.chat.*` / `ADND2E.combat.*` + drift test.
7. Gated dev-world smoke check (§6 above), all steps PASS.

After merge: SP3 complete.
