# AD&D 2E for Foundry VTT — Sub-project 9: Spells & Magic (Casting Time & Disruption)

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-24
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-15-adnd2e-sp4-magic-design.md` (SP4 magic: memorize/cast/rest), `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` (initiative modifier, statuses), `docs/superpowers/specs/2026-09-23-adnd2e-sp8-skills-and-powers-design.md` (structural precedent: master AND-gate helper, `requiresReload`, typed `system.options.*` field)

---

## 1. Context

The parent spec's table names Sub-project 9 "Player's Option: Spells & Magic — spell points, expanded casting rules". During brainstorming we confirmed that **spell points and channelers come from the *Player's Option: Spells & Magic* supplement, which is not in this project's `references/`** (only the PHB, DMG and Monstrous Manual are). The user chose to **ground Sub-project 9 in the PHB/DMG only**: it implements the PHB's optional casting-time and spell-disruption rules; spell points and channelers stay parked.

This is **one plan (9a)**.

### 1.1 Rules source (PHB/DMG, verified in `references/` during brainstorming)

- **Casting time (PHB p.87 "Casting Time", p.95 "Spellcasting and Initiative", Table 56; DMG's matching initiative section).** When a spell's casting time is a bare number, that number is added to the caster's initiative roll. When it is a round or more, no normal initiative roll is made; a 1-round spell takes effect at the end of the current round, and a longer one at the very end of its last round. The PHB presents this as an optional rule.
- **Disruption (PHB p.86).** If the caster is struck by a weapon or fails a saving throw before the spell is cast, the spell is lost and wiped from memory until re-memorized. While casting, the caster gains no AC benefit from Dexterity.

### 1.2 What already exists (verified against real current source)

- `src/settings/registry.ts` reserves `spellsAndMagicEnabled`, `spellPoints`, `expandedCastingTime`, `channelers` (group `spellsAndMagic`, all `optionalRulesKey: null`, hints end "Requires Sub-project 9."). `OptionalRules` (`src/core/options.ts`) does not contain them.
- `system.options.spellsAndMagic` is a reserved untyped `ObjectField` (`initial: {}`) on the actor schema (`src/data/actor/base-actor.ts`); nothing reads or writes it.
- Spell items (`src/data/item/spell.ts`) store `castingTime` as free text (`StringField`, blank allowed). There is no spell compendium; spells are authored per world.
- Casting (`src/sheets/character/spell-actions.ts` `castSpell`, shared by the PC and NPC sheets): requires a memorized, non-expended entry; marks it `expended`; posts the cast card (`src/magic/cast-card.ts`). Rest clears `expended`.
- Initiative (`src/documents/combatant.ts`): per-round individual initiative, formula from `initiativeModifiers({ weaponSpeedFactor, reactionAdj, situationalModifier })` where the situational modifier is the combatant flag `adnd2e.initiativeModifier` (SP7a). The Combat document sorts ascending (`src/documents/combat.ts`).
- Saves: `rollSave` (`src/sheets/character/combat-rolls.ts`) posts a save card with a success/failure result.
- AC: `deriveAc({ equippedArmor, equippedShield, dexDefensiveAdj })` (`src/data/derive/character/ac.ts`), called from `deriveCharacter`.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Scope | **PHB/DMG-grounded only:** casting time + initiative + disruption + no Dex AC while casting. **Spell points and channelers are NOT implemented** (not in `references/`); their toggles stay registered and visible with an updated "not implemented" hint. One plan, 9a. |
| Gating | `spellsAndMagicEnabled` is a master AND-gate. `expandedCastingTimeEnabled(rules) = rules.spellsAndMagicEnabled && rules.expandedCastingTime`, written once in a pure helper; every consumer calls it. |
| Reload | Both `spellsAndMagicEnabled` and `expandedCastingTime` get `requiresReload: true` (the Dex-AC rule changes prepare-time derived AC). |
| Casting time source | A pure parser over the existing free-text `castingTime` — no spell-schema change, no migration. Unparseable text falls back to today's immediate cast. |
| Combat flow | **Begin → complete.** In an active combat the Cast button becomes "Begin casting" (spell committed, memorized entry expended); a "Complete casting" action posts the real cast card when the casting time has elapsed. Out of combat, casting is exactly today's flow. |
| Disruption | **Automatic, per PHB:** losing hit points or failing a system save roll while casting disrupts the spell (it stays lost; card posted). Detected on the active GM's client only. The GM can also disrupt/cancel by hand. |
| Casting state | Stored on the **actor** (typed `system.options.spellsAndMagic.casting`), not a combatant flag — the Dex-AC derive and the disruption hook both key off the actor. |
| Extras | **No Dex AC while casting** (PHB p.86): selected. Table 56 innate/magic-item modifiers and hiding the parked toggles: not selected. |

---

## 3. Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`; all Foundry-layer code is written against **v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}`) — never `fvtt-types`.
- **Two-layer contract:** new pure logic (the parser, the casting-progress/disruption predicates, the gate helper, the AC rule, card shaping) lives in `src/core/**` or an equivalently gated pure file — no Foundry imports, **100% Vitest line/statement/function coverage** (branches ≥ 90). Foundry glue (sheet actions, hooks, combatant writes, templates) is typecheck/lint gated and dev-world verified.
- **Content policy:** mechanical values only; no rules prose, no copied tables. Page citations in code comments are fine.
- **Additive schema only — no migration, no version bump:** `system.options.spellsAndMagic` changes from an untyped `ObjectField` to a typed `SchemaField` whose leaf is a nullable `casting` object with `initial: null`. The plan must confirm against real v14.364 source that stored `{}` cleans to `{ casting: null }` (the 8c precedent).
- **Single gate helper; every action re-derives eligibility** from the actor's current state and current settings (never rendered UI state).
- **Permissions:** Begin/Complete write only to the acting user's own actor and that actor's combatant — the plan must verify from v14 source that a non-GM owner of an actor may update its combatant's `initiative`; if not, the initiative write is skipped with a notice (never a thrown error before the user-visible card). Disruption writes run only on the active GM's client.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; `npm run build` requires Foundry closed (re-confirm every time); vitest output read via `tail`/redirect, never `| grep`.
- **Mandatory whole-branch review, then a GATED dev-world check that includes a non-GM player seat.**

---

## 4. Code architecture (Plan 9a)

### 4.1 Settings wiring

`OptionalRules` gains `spellsAndMagicEnabled` and `expandedCastingTime` (default `false`); their registry descriptors bind to those keys with `requiresReload: true`. `spellPoints` and `channelers` stay `optionalRulesKey: null`; their hints become "Not implemented — this rule comes from *Player's Option: Spells & Magic*, which this system does not reference." The master and `expandedCastingTime` hints get real wording. The registry/lang/drift tests move together.

### 4.2 Pure core (new `src/core/magic/casting-time.ts`)

- `expandedCastingTimeEnabled(rules)` — THE gate.
- `parseCastingTime(text: string): CastingTime` where `CastingTime = { kind: "segments"; value: number } | { kind: "rounds"; value: number } | { kind: "unknown" }`. Accepts (case-insensitive, trimmed): a bare non-negative integer → segments; `"<n> round(s)"` → rounds n; `"<n> turn(s)"` → rounds 10n; anything else (blank, "special", hours, fractions) → unknown. `n` must be a positive integer for rounds/turns.
- `castingPlan(ct, currentRound)` → `{ mode: "immediate" }` for unknown; `{ mode: "segments"; initiativeAdd: value }`; `{ mode: "rounds"; completeRound: currentRound + value - 1 }`.
- `canCompleteCasting(state, { combatRound, casterHasActed })` — segments: when it is (or was) the caster's turn in `startRound`; rounds: when `combatRound >= completeRound`. (Exact "turn reached" definition pinned by the plan.)
- `isDisruptingEvent({ hpBefore, hpAfter } | { saveFailed })` — hp decrease (> 0 lost) or a failed save.
- `acDexAdjWhileCasting(dexDefensiveAdj, casting: boolean)` — returns `max(0, dexDefensiveAdj)` while casting (a beneficial adjustment is negative on the AC scale and is dropped; a penalty stays), else unchanged.

### 4.3 Schema

`system.options.spellsAndMagic` → `SchemaField({ casting: SchemaField({ spellItemId, casterKey ("wizard"|"priest"), combatId, startRound, completeRound (nullable), segments (nullable) }, { nullable: true, initial: null }) })`. Additive; existing `{}` cleans to `{ casting: null }`.

### 4.4 Derive

`ActorSnapshot` gains `isCasting: boolean` (true when `casting !== null`); `deriveCharacter` passes `acDexAdjWhileCasting(dexDefensiveAdj, isCasting && expandedCastingTimeEnabled(rules))` into `deriveAc`. Rule off / not casting → byte-identical AC.

### 4.5 Actions (Foundry glue, `spell-actions.ts` + a new `casting-actions.ts`)

- **Cast** routes: rule off, OR no active combat containing the actor's combatant, OR parsed time `unknown` → today's `castSpell` unchanged. Otherwise → **Begin casting**: re-validate (prepared, not expended, no `casting` already), mark the memorized entry `expended`, write `casting`, apply the initiative addition for segment spells (add to the combatant's current initiative if already rolled this round, else stash it so the next initiative roll includes it — the plan picks the mechanism after reading `combatant.ts`), post a "begins casting" card.
- **Complete casting** (button on the Spells tab while `casting` is set and `canCompleteCasting` is true): post the normal cast card for that spell, clear `casting`.
- **Disrupt / Cancel** (GM-only buttons): clear `casting`, post a "spell lost" card (disrupt) or nothing (cancel — the memorized entry stays expended either way, matching the PHB).
- **Automatic disruption:** an `updateActor` hook running only on the active GM's client (`game.users.activeGM?.isSelf`) compares prior vs new `system.attributes.hp.value` for an actor with `casting` set; a decrease disrupts. `rollSave` reports a failed save for an actor with `casting` set to the same disruption routine (via a GM-routed path if the roller is not the GM — the plan decides: socket, or a chat-message flag the GM client observes).
- **Combat end / deletion** clears any `casting` whose `combatId` matches (GM client).

### 4.6 Sheet

The PC Spells tab (and the NPC sheet's spells section, which shares the cast flow) shows a "Casting: <spell> — completes end of round N / on your turn" panel with Complete (owner) and Disrupt/Cancel (GM) buttons; Cast buttons are disabled while casting. A "Casting" badge appears near AC. All row flags are precomputed in the pure context (no `@root.` inside `{{#each}}`).

---

## 5. Error handling

- Unparseable casting time → immediate cast (no automation), never an error.
- Begin casting with a stale UI (already casting, spell no longer prepared) → warning toast, no writes.
- A player lacking permission for the combatant initiative write → the casting still begins; a notice says the GM must adjust initiative (no thrown error before the card).
- Disruption and combat-end cleanup never run on a player's client.
- Rule turned off mid-cast (after reload): any stored `casting` is ignored by derive and UI; a GM "Cancel" clears it.

## 6. Testing

Pure: the parser (every accepted form, rejections, case/whitespace), `castingPlan`, `canCompleteCasting`, `isDisruptingEvent`, `acDexAdjWhileCasting` (both signs, zero, rule off), the gate helper, the new context fields, and card shaping — 100% coverage. Dev world: rule off = today; master/toggle gates; a segment spell's initiative addition; a 1-round and a 2-round spell completing at the right round; disruption by damage (applied by GM, and by a player via Apply Damage on a player-owned caster) and by a failed save; Dex AC dropped only while casting; combat end clears state; **non-GM player seat** begins and completes a cast on their own character.

## 7. Out of scope

- Spell points and channelers (*Player's Option: Spells & Magic*, not in `references/`) — parked; README backlog.
- Spell mishaps; Table 56 innate-ability / magic-item initiative modifiers; casting time for creature stat blocks; structured casting-time fields on spell items (the parser covers existing text).
- Existing parked items (condition expiry, non-GM apply-damage to GM-owned targets, etc.).

## 8. Deliverables checklist

- [ ] Plan 9a: 2 toggles wired + hints; pure `casting-time.ts`; typed `options.spellsAndMagic.casting`; derive Dex-AC rule; Begin/Complete/Disrupt/Cancel actions; GM-client disruption + combat-end cleanup; Spells-tab casting panel + AC badge; whole-branch review; gated dev-world check incl. non-GM seat.
- [ ] README: row 9 → ✅ Complete with the PHB-grounded scope; backlog gains spell points/channelers (need the S&M book) and the out-of-scope items.
