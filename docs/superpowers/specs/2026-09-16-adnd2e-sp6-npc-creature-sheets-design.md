# AD&D 2E for Foundry VTT — Sub-project 6: NPC / Creature Sheets

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-16
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-09-adnd2e-sp2-character-sheet-design.md` (Sub-project 2 — PC Character Sheet), `docs/superpowers/specs/2026-09-14-adnd2e-sp3-core-combat-design.md` (Sub-project 3 — Core Combat), `docs/superpowers/specs/2026-09-16-adnd2e-sp5-proficiencies-skills-design.md` (Sub-project 5 — Proficiencies & Skills)

---

## 1. Context

Per the parent spec's sub-project table: "Streamlined stat-block sheet, item templates for user-owned content."

Both non-PC actor types already have real, complete DataModels from Sub-project 1 — this sub-project is a sheet-and-rolling-adapter project, not a data-model project:

- **`CreatureModel`** (`src/data/actor/creature.ts`) already has a genuinely monster-stat-block-shaped schema: `hd` (count/dieType/bonus/fixedHp), `attributes` (hp/ac/thac0/movement — a single `ac.value`, not the PC sheet's multi-component breakdown), a structured `attacks` array (`name`/`count`/`damage`/`thac0Override`/`type`/`special`), `saves` (explicit-per-category OR as-a-class-and-level, with a cached `effective` block), and `details` (size/alignment/intelligence/morale/magicResistance/treasureType/numberAppearing/xpValue/specialAttacks/specialDefenses/description). `deriveCreature` (`src/data/derive/creature/`) already computes `hpMax`/`thac0`/`saves.effective.*` from this. **`details.xpValue` is author-entered only — nothing derives it.**
- **`NpcModel`** (`src/data/actor/npc.ts`) is literally `{ ...actorCommonSchema() }` (the exact same shared schema `CharacterModel` uses — full ability scores, classes, spellcasting, proficiencies, encumbrance, inventory) plus one extra `npc: {morale, xpValue, disposition}` block. It runs the identical `deriveCharacter` pipeline PCs use. There is no NPC-specific derive logic anywhere.
- **Sheet registration today** (`src/sheets/index.ts`): `Adnd2eCharacterSheet` (built in SP2) is registered `makeDefault: true` for **both** `character` and `npc` — identical sheet, zero internal `actor.type` branching. `creature` has no type-specific registration at all and falls through to `Adnd2eActorSheet`, the SP1 raw-field stub (`RawFieldSheetMixin`) — every field as a generic input/select, no combat rolling, no stat-block layout.
- **Combat integration already exists and is already actor-type-agnostic where it matters**: `combat-rolls.ts`'s `resolveTargetCombatInfo` already branches on `targetActor.type === "creature"` to read `system.attributes.ac.value`/`system.details.size` (vs. `character`/`npc`'s `system.attributes.ac.normal` + race-item size) — so a `creature` has already been a valid **attack target** since SP3. What's missing is a creature/NPC-side sheet that lets a GM **originate** an attack/save roll from that actor, not just be targeted by one.
- **`CONFIG.statusEffects`/conditions wiring** was flagged as a carry-forward for "SP3" back in Sub-project 1 (1c.4a's hotfix notes) — confirmed via direct source read that SP3 never picked it up; `src/conditions.ts`'s `CONDITIONS` array and the `packs/conditions/` compendium both still exist unwired, and `conditions` is still absent from `system.json`'s `packs` array (blocked by a real v14.364 manifest-installer constraint: `"type": "ActiveEffect"` compendiums fail the server-side installer, per 1c.4a's hotfix #16). **Still deferred — this sub-project does not pick it up** (see §7).

### 1.1 Platform

Foundry VTT **v14.364**. `fvtt-types` is a wrong v13-beta — **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source for every Foundry-layer API.** Carried forward from SP3/SP4/SP5: any actor/document resolved from data baked into a chat-card button's dataset uses `.uuid` + `fromUuidSync()`, never `.id` + `game.actors.get()`.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| NPC sheet scope | A real, separate streamlined sheet for `npc` (not left on the full PC sheet). |
| Creature attacks | **Rollable** — a "Roll Attack" button per `attacks[]` entry, reusing SP3's existing `core/combat` math via a new creature-shaped adapter (not touching the PC-shaped `combat-rolls.ts`). |
| XP value | **Stays manual entry** on both `CreatureModel.details.xpValue` and `NpcModel.npc.xpValue` — the real DMG p.85 formula (tiered HD-base + per-special-ability bonus points) is its own substantial mini-subsystem, out of scope here. |
| Conditions / `CONFIG.statusEffects` wiring | **Stays deferred** — not this sub-project's concern; re-recorded as an unclaimed carry-forward (see §7) so it isn't silently dropped a third time. |
| Bestiary scaffolding | An empty **"Bestiary" pack folder** stub in `system.json` (mirroring the existing empty "Equipment"/"Spells" folders) + a short doc pointing at the already-existing generic `game.system.api.importContent` (SP1c.4b) for bulk JSON import. No new import code, no shipped monster data (content policy). |
| Sheet architecture | **Two separate new sheet classes** — `Adnd2eCreatureSheet` (new pure context layer, since `CreatureModel`'s schema is unrelated to `CharacterModel`'s) and `Adnd2eNpcSheet` (a leaner template reusing the PC sheet's *existing* pure `buildCharacterSheetContext` unchanged — no new business logic). `Adnd2eCharacterSheet` itself is untouched and stays manually selectable per-actor via Foundry's native sheet picker (drops `npc` from its default `types`, keeps `character`). |
| Layout style | Creature: **single-page** stat-block layout (matches 2E's own stat-block convention — everything visible without tab-clicking). NPC: **a small tab set** (3 tabs — see below), not single-page, since an NPC can carry more (inventory, a real spell list) than a typical monster. |
| NPC tab split | **Overview** (identity/abilities/vitals/combat/a compact skills summary, roll-only — no live point-allocation UI) / **Spells** (reused verbatim from the PC sheet's existing partial, already handles the no-caster-classes empty state gracefully) / **Details** (inventory + features + biography folded together). |
| Multi-attack (`attacks[].count`) | **Display-only** in v1 (shown as "×N" next to the attack name) — Roll Attack always rolls one iteration per click, matching the PC sheet's own un-automated multi-attack granularity. |

---

## 3. Global Constraints

Copied forward from the parent + sibling specs; every task's requirements implicitly include this section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — never `fvtt-types`.
- **Two-layer contract:** new pure files (`src/sheets/creature/context.ts`/`context-types.ts`) import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). The Foundry shell (both new sheet classes, both new roll-adapter files, all new templates) is typecheck + build gated only, no unit tests, dev-world verified — matching every prior sub-project's established split.
- **The gated-zone config triad** — the new `src/sheets/creature/context.ts`/`context-types.ts` pair needs NEW entries in all three of `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (both the `ignores` array and the `files` array) — unlike SP5a/5b, this is a genuinely new directory, not an already-covered one; verify against the real current config content before assuming otherwise.
- **`Adnd2eNpcSheet` produces NO new pure code** — it consumes `src/sheets/character/context.ts`'s existing `buildCharacterSheetContext`/`CharacterSheetContext` unchanged. Do not fork or duplicate that pure layer for the NPC sheet.
- **Content policy:** mechanical/UI data only. No PHB/MM rules text, no copyrighted stat blocks, no flavor text. The "Bestiary" pack folder ships EMPTY (a `packs: []` folder entry in `system.json`, same as the existing "Equipment"/"Spells" folders) — no monster data of any kind.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npx vitest run --coverage`. `npm run build` requires **Foundry closed** — re-confirm before EVERY build attempt in any live-test round-trip, not just once (a real, repeated gotcha across SP5a/5b).
- **Dev-world smoke check is GATED** — the user runs it before `finishing-a-development-branch`, never a deferred checklist item. Every sub-project this session that skipped straight from code review to merge without live-testing shipped at least one real bug that only live testing caught.
- **Actor/document resolution from chat-card data uses `.uuid` + `fromUuidSync`, never `.id` + `game.actors.get()`** — applies to both new roll-adapter files' chat-card button handlers.
- **A plan touching a shared interface must grep the WHOLE consuming file(s) for every literal of that shape**, not just the ones the current task is adding (the recurring SP4b/SP5a/SP5b lesson).
- **The established "duplicate re-validation" pattern is available but likely NOT needed here** — unlike SP4/SP5, there's no render-layer-vs-action-layer eligibility split for this sub-project's rolling actions (a creature/NPC's attacks and saves don't have an "eligibility" gate the way spell-memorization or proficiency-allocation do — every listed attack/save is always rollable). Don't force the pattern where it doesn't apply.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## 4. Code architecture

New / changed files (illustrative — the implementation plan nails exact signatures against real source, per this project's established practice):

```
src/sheets/creature/
  context-types.ts        NEW (pure) — CreatureSheetInput / CreatureSheetContext
  context.ts               NEW (pure) — buildCreatureSheetContext(input): CreatureSheetContext
  sheet.ts                 NEW (Foundry shell) — Adnd2eCreatureSheet extends
                            HandlebarsApplicationMixin(ActorSheetV2); wires rollAttack/rollSave actions
  combat-rolls.ts           NEW (Foundry shell) — creature-shaped rollAttack/rollSave, reusing
                            core/combat's existing attackModifiers/hitResult/damageModifiers/
                            core/saves' saveTarget-equivalent math via CreatureModel's already-
                            cached attributes.thac0.value / saves.effective.*

src/sheets/npc/
  sheet.ts                  NEW (Foundry shell) — Adnd2eNpcSheet extends
                            HandlebarsApplicationMixin(ActorSheetV2); calls the EXISTING
                            src/sheets/character/context.ts buildCharacterSheetContext unchanged;
                            reuses the EXISTING src/sheets/character/{combat-rolls,spell-actions,
                            proficiency-actions}.ts action functions unchanged

src/sheets/index.ts          MODIFY — register Adnd2eCreatureSheet for "creature", register
                            Adnd2eNpcSheet for "npc"; Adnd2eCharacterSheet's own registration
                            drops "npc" from its types array (keeps "character")

templates/actor/creature/
  sheet.hbs                  NEW — single-page stat-block layout

templates/actor/npc/
  main.hbs                   NEW — Overview tab (identity/abilities/vitals/combat/skills summary)
  spells.hbs                  NEW — thin wrapper reusing the PC sheet's existing spells partial content
  details.hbs                 NEW — inventory + features + biography folded together

templates/chat/
  creature-save-roll.hbs      NEW — creature save-roll card (no situational rollModifier column,
                              unlike the PC save-roll card)

system.json                  MODIFY — += an empty "Bestiary" pack folder entry (packs: [])

docs/
  bestiary-content.md          NEW — short doc: how a GM builds/imports their own creature
                              compendium via game.system.api.importContent

tests/sheets/creature/
  context.test.ts              NEW — 100% coverage of buildCreatureSheetContext
```

### 4.1 Pure layer — `src/sheets/creature/context.ts`

Mirrors `src/sheets/character/context.ts`'s established shape (a `CharacterSheetInput → CharacterSheetContext` pure mapper), but simpler — `CreatureModel` has no items-derived rows (no embedded weapon/armor/proficiency Items to map), no multi-class resolution, no encumbrance. `CreatureSheetInput` is built directly from the prepared actor's `system.*` (already-derived `hd`/`attributes`/`attacks`/`saves`/`details`) plus `perms`/`config` (matching the PC sheet's existing `perms: {isGM, isOwner, editable}` pattern). `CreatureSheetContext` adds only display-derived fields the raw schema doesn't already carry directly (e.g. a `movementSummary` string built from the `movement.{land,burrow,climb,fly,swim}` block, omitting zero-value modes — mirrors `AttackCardContext`'s "zero-value modifiers are omitted" established pattern).

### 4.2 Foundry shell — `src/sheets/creature/combat-rolls.ts`

`rollAttack(actor, attackIndex: number)`: reads `actor.system.attacks[attackIndex]`, resolves `thac0 = attack.thac0Override ?? actor.system.attributes.thac0.value` (already-derived), resolves the target via the EXISTING `resolveTargetCombatInfo` (imported from `src/sheets/character/combat-rolls.ts`, unchanged — it's already actor-shape-agnostic on both sides), builds the roll via the EXISTING `core/combat/attack.ts`'s `attackModifiers`/`hitResult` (no new core math), posts via the EXISTING `combat/attack-card.ts`'s `buildAttackCardContext`/`templates/chat/attack-roll.hbs` (unchanged — the chat card doesn't care which sheet originated the roll). On hit, damage rolls `attack.damage` directly (`new Roll(attack.damage)`) — no `pickDamageDice`/target-size split, since a creature's damage is already one fixed formula string per attack entry, unlike a PC weapon's S/M-vs-L pair.

`rollSave(actor, category: SaveCategory)`: reads `actor.system.saves.effective[category]` (already-derived, a plain number), builds a `1d20` roll with `rollModifier` fixed at `0` (no situational-adjustment concept modeled for creatures), posts via a NEW `buildCreatureSaveCardContext`/`templates/chat/creature-save-roll.hbs` (can't reuse the PC's `SaveCardContext` as-is since it always shows a `rollModifier` line the creature case never has — confirm this against real source before deciding whether a shared context with an optional field is cleaner than two types).

### 4.3 Foundry shell — `src/sheets/npc/sheet.ts`

The thinnest file in this sub-project. Builds a `CharacterSheetInput` exactly the way `Adnd2eCharacterSheet` already does (same `#buildInput()`-equivalent logic — the plan should determine whether this warrants extracting a shared helper `src/sheets/character/build-input.ts` both sheets call, rather than duplicating that construction code between two classes; YAGNI-check this against the actual size of that logic before deciding), calls the unchanged `buildCharacterSheetContext`, and renders a 3-tab `PARTS` set instead of the PC sheet's 7. Action wiring (`DEFAULT_OPTIONS.actions`) reuses the EXISTING imported functions from `src/sheets/character/{combat-rolls,spell-actions,proficiency-actions}.ts` — no new action functions.

---

## 5. Error handling

- **Rolling an attack/save on a creature with no matching data** (e.g. `attacks[]` is empty) — the Roll Attack button simply doesn't render for a non-existent index; no error state needed since it's never reachable (matches this codebase's established "ineligible action's button doesn't render" convention).
- **An NPC with no caster class** — the Spells tab renders using the exact same graceful-empty-state markup the PC sheet's spells partial already has for `wizardSlots: null, priestSlots: null` (already built and tested in SP4) — no new empty-state handling needed.
- **A GM manually switches an `npc`/`character` actor's sheet away from the new default** — Foundry's native per-document sheet picker already handles this; no code needed.

---

## 6. Testing strategy

- **Pure zone** — `buildCreatureSheetContext` (every branch: HD-with-fixedHp vs computed, thac0Override present/absent per attack, explicit vs as-class saves, the movement-summary zero-omission logic). 100% coverage, test-first, added to a NEW gated triad entry (`src/sheets/creature/**`/`tests/sheets/creature/**`).
- **Foundry shell** — no unit tests (parent §9 convention). Manual dev-world exercise, GATED before the finish menu:
  1. Create a `creature` actor, fill in HD/attacks/saves: confirm the single-page sheet renders every field, confirm HP max / THAC0 / saves.effective are correctly derived-and-displayed (already-existing `deriveCreature` math — this step confirms the SHEET reads it correctly, not the math itself).
  2. Roll an attack from the creature sheet against a targeted PC: confirm hit/miss resolution and the chat card match SP3's existing attack-card behavior; roll damage, confirm the posted formula is exactly `attacks[].damage`.
  3. Roll a save from the creature sheet: confirm the target matches `saves.effective.<category>` with no spurious modifier line.
  4. Create an `npc` actor with a class item (e.g. a 3rd-level fighter): confirm the 3-tab layout renders, weapon rolling works identically to the PC sheet, the Spells tab shows the correct empty/non-empty state, inventory/features/biography all round-trip.
  5. Confirm `Adnd2eCharacterSheet` is still manually selectable for both `character` (unchanged) and `npc` (via Foundry's sheet picker, now that it's no longer the `npc` default) — confirms the registration change didn't remove the option, only the default.
  6. Confirm the `system.json` "Bestiary" pack folder appears (empty) in the Compendium sidebar.

---

## 7. Scope boundary — what SP6 does NOT include

- **No 2E DMG XP-value formula.** Both `CreatureModel.details.xpValue` and `NpcModel.npc.xpValue` stay manual-entry number fields, exactly as today.
- **No `CONFIG.statusEffects`/Token HUD conditions wiring.** `src/conditions.ts`'s `CONDITIONS` array and the `packs/conditions/` compendium remain unwired and unshipped in `system.json`'s `packs` array — **still an open carry-forward with no owning sub-project**, now flagged a third time (originally SP1c.4a → deferred to "SP3" → SP3 never picked it up → this spec explicitly declines it too). A future sub-project (most naturally Sub-project 7, Combat & Tactics, or a dedicated hardening pass) should either wire it or make a documented decision to drop it.
- **No monster/NPC compendium content of any kind** — the "Bestiary" pack folder ships empty; content policy forbids shipping copyrighted stat blocks, and building a large library of user's-own-legally-sourced content is explicitly the GM's job via the existing generic import API, not this sub-project's.
- **No multi-attack-per-round automation.** `attacks[].count` stays a display-only annotation.
- **No `CreatureModel`/`NpcModel` schema changes.** Both models already have everything this sub-project's sheets need.
- **No changes to `deriveCreature`/`deriveCharacter`** beyond nothing — this is a sheet-and-rolling-adapter sub-project; the two new roll-adapter files consume already-derived/cached values, they don't derive anything new.
- **No group/legion/horde tooling** (e.g. bulk-rolling initiative or attacks for many identical creatures at once) — out of scope, a Combat & Tactics-era concern if ever built at all.

---
