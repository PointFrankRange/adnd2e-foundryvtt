# AD&D 2E for Foundry VTT — Sub-project 4: Magic

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-15
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-09-adnd2e-sp2-character-sheet-design.md` (Sub-project 2 — PC Character Sheet), `docs/superpowers/specs/2026-09-14-adnd2e-sp3-core-combat-design.md` (Sub-project 3 — Core Combat)

---

## 1. Context

SP2's Spells tab renders wizard/priest spell slots and a known-spells list, but is display-only: `{{! SP4 wires memorization + casting here }}`. SP3 wired combat rolls but deliberately excluded spell casting (§7 of the SP3 spec: "No spell casting, no slot decrement, no memorization management. (SP4.)"). This sub-project closes that gap. Per the parent spec's sub-project table: "Spell items, schools/spheres, wizard spellbook + priest sphere access, memorization slot tables, cast-from-chat with slot tracking."

### 1.1 What already exists (SP4 mostly *wires*, doesn't invent math)

- `src/core/magic/` (Plan 1b.5) — `wizardSpellSlots`/`priestSpellSlots` (return `SpellSlots {perLevel, base, bonus, suppressed}`), `spellbookLimits`/`specialistLearnModifier`/`canLearnSpell`/`learnSpellRoll`, `resolveSphereAccess`/`sphereSpellLevelCap`/`canCastSphereSpell`, `PRIEST_SPHERES`/`CLERIC_SPHERE_ACCESS`/`DRUID_SPHERE_ACCESS`/`SPECIALIST_SCHOOLS` tables.
- `src/data/item/spell.ts` (1c.2) — the `spell` Item DataModel: `casterClass` ("wizard"|"priest"), `level` (1-9), `schools`/`spheres`, `range`/`components`/`materialComponent`/`duration`/`castingTime`/`areaOfEffect`, `savingThrow`, `reversible`/`isReversedForm`, and an `automation: {damage, healing, effectRefs, targetType}` block that nothing has read yet.
- `src/data/actor/base-actor.ts` — `spellcasting.{wizard,priest}` schema: `specialistSchool`/`opposedSchools`/`spellbookItemIds` (wizard only), `sphereAccessOverride` (priest only), `memorized` (shared `{spellItemId, spellLevel}[]` schema), `slots` (derived, `Record<level, {max, used}>` — `used` is DERIVED from `memorized.length` per level, see §1.2).
- `src/data/derive/character/slots.ts` (1c.3b/1c.3c) — `deriveSpellSlots` populates `spellcasting.wizard.slots` for `casterType==="wizard"&&spellProgressionId==="wizard"` (Mage) and `spellcasting.priest.slots` for `casterType==="priest"&&spellProgressionId==="priest"` (Cleric/Druid). **Paladin/Ranger/Bard return `{}` — no slots derived for them today** (see §7).
- `src/sheets/character/context.ts` `buildSpells` + `templates/actor/character/spells.hbs` (SP2) — already render `wizardSlots`/`priestSlots` rows, `specialistSchoolLabel`, and the known-spells list grouped by level with `inSpellbook` badges. SP4 adds the interactive actions; the display scaffolding is not rebuilt.
- `core/dice/formula.ts`'s `signedTerm`/`damageFormula`-style string-building pattern (SP3) is the template SP4 follows for `automation.damage`/`automation.healing` formula strings — a spell's automation field is already a bare dice-formula string (e.g. `"3d6"`), not something requiring a new formula-string builder.

**Nothing in `core/` constructs a Foundry `Roll`, a `ChatMessage`, or touches `game`/`canvas`/tokens** (parent spec §4.1, unchanged rule, carried through SP2/SP3). SP4's new work is: (a) a small amount of new pure math/logic (learn-spell and cast/memorize chat-card content builders, mirroring SP3's `src/combat/*-card.ts`), and (b) the Foundry-layer wiring — memorize/forget/cast/rest/learn sheet actions, real `Roll`s for the automation damage/healing formulas, and an Apply button reusing SP3's damage-application mechanics generalized to healing.

### 1.2 The `used` slot count is derived from `memorized`, not from a "cast today" counter

`toRecord` (`src/data/derive/character/slots.ts`) computes `used: memorized.filter(m => m.spellLevel === spellLevel).length` — i.e. a slot is "used" the moment a spell occupies it via memorization, independent of whether it has been cast yet. There is no day/rest-cycle tracking anywhere in this codebase. SP4 adds one boolean, `expended`, to each `memorized` entry (§2) so a cast spell can be distinguished from a still-ready one without changing this derivation.

### 1.3 Platform

Foundry VTT **v14.364**. `fvtt-types` is a wrong v13-beta — **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source for every Foundry-layer API** (`Roll`, `ChatMessage`, `Item`, any `ActiveEffect`-adjacent timing question). A confirmed SP3 lesson that applies directly here: **any actor/document resolved from data baked into a chat-card button's dataset must be carried by `.uuid` and resolved with `fromUuidSync(uuid)`, never by `.id` via `game.actors.get()`/`game.items.get()`** — an unlinked token's synthetic actor shares its linked actor's `.id` but not its live (memorized/spellbook) data, so an id-based lookup silently reads the wrong actor's spell list.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Cast automation | Casting a memorized spell auto-rolls `automation.damage`/`automation.healing` (if the item sets one) and posts the result on the same cast chat card — no separate "Roll Damage" click. `automation.effectRefs` (ActiveEffect application) stays fully manual/unread by SP4. |
| Apply step | Matches SP3 exactly: rolled damage/healing sits on the chat card behind a separate **Apply** button (owner/GM-gated), which resolves against `game.user.targets` at click-time. Healing adds to `value` (capped at `hp.max`); damage subtracts, temp-HP-first, same as SP3's Apply Damage. |
| Cast consumption | Casting marks the `memorized` entry `expended: true` (kept in the list, still counts toward `used`, Cast button disabled) rather than removing it. A new **Rest** sheet action clears all `expended` flags (both casters) back to `false`, without altering which spells are memorized. |
| Learn Spell | In scope (4b). Wizard-only (priests have no "learn" step — sphere access + level cap is the only gate). A "Learn Spell" action on a known, not-yet-in-spellbook wizard spell rolls d100 against `canLearnSpell`'s chance and, on success, adds the item id to `spellbookItemIds`. No retry cooldown tracked. |
| Memorize/Forget | In scope (4a). Sheet actions on each known spell: **Memorize** (validated against slot availability + spellbook membership for wizards / sphere-access level cap for priests) and **Forget** (removes a memorized entry regardless of `expended` state, no penalty modeled). |
| Plan slicing | One spec, two sequential SDD plans/PRs, mirroring SP1's 1a→1c.4c precedent for oversized scope: **4a** = memorize/forget/cast/rest/apply (the load-bearing flow, mirrors SP3's task shape); **4b** = learn-spell, built on top of 4a. |

---

## 3. Global Constraints

Copied forward from the parent + sibling specs; every task's requirements implicitly include this section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — never `fvtt-types`.
- **Two-layer contract:** new pure files (`src/magic/*.ts`) import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). The Foundry shell (sheet action handlers, chat-card templates, chat listeners) is typecheck + build gated only, no unit tests, dev-world verified.
- **The gated-zone config triad** — every new pure file goes in ALL THREE of `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (both the Foundry-globals `ignores` array and the pure-zone `files` array).
- **Content policy:** mechanical/UI data only. Chat-card templates carry labels via `{{localize}}` keys, never 2E rules prose. Spell names/descriptions are user-authored `spell` items, not shipped content — SP4 ships no spell compendium pack.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json`/`package-lock.json`/`node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check is GATED** for each plan (4a and 4b each get their own) — the user runs it before that plan's `finishing-a-development-branch`, never a deferred checklist item.
- **Actor/document resolution from chat-card data uses `.uuid` + `fromUuidSync`, never `.id` + `game.actors.get()`** (§1.3) — applies to every new chat-card button SP4 adds (Cast's Apply button, Learn Spell's result card if it ever needs to re-resolve the actor).
- **Authored vs derived binding** (carried from SP2/SP3): a roll/action reads the actor's already-derived, cached `system.*` values — it never re-derives them itself. Memorize/Forget/Cast/Rest/Learn write only to `system.spellcasting.{wizard,priest}.{memorized,spellbookItemIds}` and, for Apply, `system.attributes.hp.*` on the target(s) — never to any other derived field.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## 4. Code architecture

### 4.1 Plan 4a — Memorize / Forget / Cast / Rest / Apply

```
src/data/actor/base-actor.ts   MODIFY — memorizedSchema() += expended: BooleanField (initial false)

src/magic/
  cast-card.ts                 NEW (pure) — buildCastCardContext()
  card-types.ts                NEW (pure) — shared magic card-context interfaces

src/sheets/character/
  spell-actions.ts              NEW (shell) — memorizeSpell/forgetSpell/castSpell/restSpellcasting,
                                the Roll-construction + ChatMessage.create glue
  sheet.ts                      MODIFY (shell) — memorizeSpell/forgetSpell/castSpell/restSpellcasting
                                actions, wired into DEFAULT_OPTIONS.actions
  context.ts                    MODIFY — buildSpells: expose expended + memorize/forget eligibility
                                per known spell (slot availability, spellbook/sphere-access gates)
  context-types.ts              MODIFY — SpellItemView += expended/memorized/canMemorize fields

src/chat/
  chat-listeners.ts             MODIFY — add a NEW `applyCastEffect` action handler (distinct from
                                SP3's existing `applyDamage` action, which stays untouched — its
                                dataset shape and always-subtract semantics must not change retroactively
                                for buttons on already-posted SP3 chat cards). The new handler reads an
                                explicit `data-kind="damage"|"healing"` alongside `data-amount` (always
                                a positive number) instead of relying on the amount's sign.

templates/chat/
  cast-roll.hbs                  NEW

templates/actor/character/
  spells.hbs                     MODIFY — Memorize/Forget/Cast buttons per known spell, a Rest button

src/system.ts                   MODIFY — no new document classes; chat-listener registration already
                                exists from SP3, this plan only adds a query selector inside it

lang/en.json                    MODIFY — ADND2E.chat.cast.* / ADND2E.sheet.spells.{memorize,forget,rest}.*

tsconfig.core.json              MODIFY — include src/magic/**
vitest.config.ts                MODIFY — coverage.include src/magic/**
eslint.config.js                MODIFY — ignores[]/files[] src/magic/**

tests/magic/
  cast-card.test.ts              NEW
tests/lang/en-coverage.test.ts   MODIFY — drift block for the new lang keys
```

**`src/magic/card-types.ts`**

```ts
export interface CastCardContext {
  actorName: string; actorImg: string;
  spellName: string; spellLevel: number;
  range: string; duration: string; castingTime: string; savingThrow: string;
  components: { v: boolean; s: boolean; m: boolean };
  /** null when the spell's automation.damage/healing is unset — no roll section on the card */
  rollResult: { kind: "damage" | "healing"; formula: string; total: number } | null;
  /** carried into the Apply button's dataset; null when rollResult is null (nothing to apply) */
  applyContext: { actorUuid: string; amount: number; kind: "damage" | "healing" } | null;
}
```

**`src/magic/cast-card.ts`** — `buildCastCardContext(input): CastCardContext`, a pure transform from the spell item's already-read fields + an optional pre-rolled `{kind, formula, total}` into the display context. Test-first, 100% covered, same rigor as SP3's `attack-card.ts`. `applyContext.amount` is always the positive rolled `total`; `applyContext.kind` (`"damage"|"healing"`) tells the `applyCastEffect` handler (§4.1's `chat-listeners.ts` entry) which direction to apply it — damage spills into `value` after temp is exhausted (per SP3), healing simply adds to `value`, capped at `hp.max`, with no temp-HP interaction.

**`src/sheets/character/spell-actions.ts`**

- `memorizeSpell(actor, spellItemId, spellLevel): Promise<void>` — re-validates slot availability and spellbook/sphere-access eligibility against the actor's current derived state (never trusts stale button data), then pushes `{spellItemId, spellLevel, expended: false}` onto the right caster's `memorized` array via `actor.update`.
- `forgetSpell(actor, spellItemId, spellLevel): Promise<void>` — removes the matching entry (by `spellItemId` + `spellLevel`) from the right caster's `memorized` array.
- `castSpell(actor, spellItemId): Promise<void>` — finds the memorized (non-expended) entry, sets `expended: true`, reads the spell item's `automation.damage`/`automation.healing`, rolls whichever is set (`damage` takes priority if — defensively — both were somehow set; a spell should set at most one per the schema's intent), builds the context via `buildCastCardContext`, posts `templates/chat/cast-roll.hbs`.
- `restSpellcasting(actor): Promise<void>` — one `actor.update` setting `expended: false` on every entry in both `wizard.memorized` and `priest.memorized`.

**`src/chat/chat-listeners.ts`** — generalize the existing `onApplyDamage` into an `onApply` that reads a signed `amount` (and `kind` for the button's own label/flavor text only — the HP math is amount-sign-driven, not kind-driven) instead of always subtracting; SP3's `applyDamage` action name and dataset shape stay for backward compatibility with existing chat history, `cast-roll.hbs`'s button uses the same `data-action="applyDamage"` with a signed `data-amount`.

### 4.2 Plan 4b — Learn Spell (builds on 4a)

```
src/magic/
  learn-spell-card.ts            NEW (pure) — buildLearnSpellCardContext()
  card-types.ts                  MODIFY — += LearnSpellCardContext

src/sheets/character/
  spell-actions.ts                MODIFY — learnSpell(actor, spellItemId): Promise<void>
  sheet.ts                        MODIFY — learnSpell action wired
  context.ts / context-types.ts   MODIFY — expose per-spell learn eligibility + chance (wizard only)

templates/chat/
  learn-spell-roll.hbs             NEW

templates/actor/character/
  spells.hbs                       MODIFY — Learn Spell button on eligible wizard spells

lang/en.json                      MODIFY — ADND2E.chat.learnSpell.* / ADND2E.sheet.spells.learn.*

tests/magic/
  learn-spell-card.test.ts         NEW
tests/lang/en-coverage.test.ts     MODIFY — drift block
```

**`src/magic/learn-spell-card.ts`** — `buildLearnSpellCardContext(input): LearnSpellCardContext`, pure transform from a `CanLearnResult` (already produced by `core/magic/spellbook.ts`'s `canLearnSpell`) + the d100 roll + `learnSpellRoll`'s boolean into a display context (chance shown, roll shown, success/failure, rejection reason localized when `allowed: false`).

**`spell-actions.ts`'s `learnSpell`** — reads the spell item's `schools`/`level`, the actor's derived INT modifiers (already cached on `system.abilities.int.mods`) and `specialistSchool`, calls `canLearnSpell`; if `allowed`, rolls `1d100`, calls `learnSpellRoll`; on success, pushes the item id onto `spellbookItemIds` via `actor.update`. Posts the chat card regardless of outcome.

---

## 5. Error handling

- **Memorize with no free slot at that level** — the Memorize button is hidden/disabled when `used >= max`; `memorizeSpell` re-checks server-side (re-derives from current actor state) and no-ops with a toast if the button state was stale.
- **Memorize a wizard spell not in the spellbook** — button hidden/disabled; same re-check.
- **Memorize a priest spell above the caster's sphere-access level cap** — button hidden/disabled (uses `canCastSphereSpell`); same re-check.
- **Cast an expended or unmemorized spell** — Cast button only renders for a memorized, non-expended entry; `castSpell` no-ops with a toast if it can't find one (covers a stale-button double-click race).
- **Cast a spell with no `automation.damage`/`automation.healing`** — the cast card posts with no roll section and no Apply button (informational only), not an error.
- **Apply with zero current targets** — reuses SP3's existing toast ("target something first"); no silent no-op.
- **A non-owner clicking Apply** — reuses SP3's existing owner/GM gate.
- **Spell item deleted between memorize and cast** — `castSpell` re-reads the item by id; if it's gone, a toast + the `memorized` entry is left as-is (the player can Forget it manually) rather than silently discarding data.
- **Learn Spell on a spell already in the spellbook** — button hidden (nothing to learn); `learnSpell` no-ops with a toast if called anyway (stale-button race).
- **Learn Spell when `canLearnSpell` returns `allowed: false`** (INT too low, spell level exceeds INT cap, opposition school) — the button itself is hidden for these cases (computed the same way server-side and client-side, so no separate re-check dialog is needed); if the underlying condition changes between render and click (e.g. INT drain from an unrelated effect), `learnSpell` re-checks and posts a card explaining the rejection rather than rolling anyway.

---

## 6. Testing strategy

- **Pure zone** (`cast-card.ts`, `learn-spell-card.ts`) — Vitest, test-first, **100% coverage**, added to the gated triad. Representative cases: `buildCastCardContext` with no automation (no roll section), with damage, with healing; `buildLearnSpellCardContext` for every `LearnRejection` value plus a success and a failure roll.
- **Foundry shell** — no unit tests (parent §9). Manual dev-world exercise, gated before each plan's finish menu.

**Plan 4a dev-world checklist:**
1. A wizard character with a known, spellbook-eligible spell and a free slot at its level: Memorize it, confirm it appears in the memorized list and the level's `used` count increments.
2. Cast it: confirm the entry becomes `expended` (Cast button disables), the chat card posts with the spell's info.
3. A spell with `automation.damage` set: casting it rolls and shows the damage total on the card with an Apply button; clicking Apply (with a token targeted) reduces the target's HP correctly (temp-first, same as SP3).
4. A spell with `automation.healing` set: casting it rolls and shows the healing total; Apply increases the target's `value`, capped at `hp.max`.
5. Forget a memorized (non-expended) spell: it disappears from the memorized list, the slot's `used` count decrements, it's memorizable again.
6. Click Rest: every `expended` flag clears across both casters; memorized selections are unchanged.
7. A priest character: confirm sphere-access level-capped spells above the cap cannot be memorized (button absent), and within-cap ones can — with no spellbook/Learn-Spell step involved at all.
8. Attempt to memorize past a level's slot cap: button is absent once `used === max`.

**Plan 4b dev-world checklist:**
1. A wizard spell not yet in the spellbook: click Learn Spell, confirm the chat card shows the computed chance and the roll result.
2. On a success (or by repeating until one occurs): confirm the spell becomes `inSpellbook: true` and is now memorizable.
3. A spell in the specialist's own school: confirm the chance reflects the +15% modifier (compare against a non-specialist-school spell's chance on the same character).
4. A spell in the specialist's opposition school: confirm Learn Spell is unavailable (or, if shown, the card reports "opposition-school" rejection rather than rolling).
5. A priest character's Spells tab: confirm no Learn Spell action appears anywhere.

---

## 7. Scope boundary — what SP4 does NOT include

- **No spellcasting UI for Paladin/Ranger/Bard.** `deriveSpellSlots` (1c.3b/1c.3c) only populates `spellcasting.{wizard,priest}.slots` for the Mage and Cleric/Druid progressions — Paladin/Ranger/Bard's `spellcasting.*.slots` stays empty (`{}`), a pre-existing derive-layer gap SP4 does not fix. Their Spells tab shows no memorize/cast controls until a future sub-project extends `deriveSpellSlots` for the bare-array progressions.
- **No creature spellcasting.** `CreatureModel` has no `spellcasting` schema at all (consistent with SP3 excluding creature combat); SP4's actions live on `Adnd2eCharacterSheet` (`character`/`npc`) only.
- **No ActiveEffect application from `automation.effectRefs`.** A spell's listed effect references stay inert data — applying buffs/debuffs/conditions from a cast is a future sub-project's concern (likely alongside a real conditions/status-effect system, deferred from SP1c.4a).
- **No damage-type resistance/immunity automation**, matching SP3's boundary — a spell's damage is a flat rolled number.
- **No area-of-effect targeting, no multi-target Apply beyond what `game.user.targets` already gives for free** (Apply already iterates every currently-targeted token, same as SP3's damage-apply — a fireball's area is the caster's job to target manually with Foundry's native tools, not something SP4 automates).
- **No true daily/rest-cycle tracking.** Rest is a single manual button clearing `expended` flags — no in-game-time gating, no forced full re-memorization, no long-rest/short-rest distinction.
- **No `spellFailureFromWisdom` optional-rule wiring** — stays unimplemented since 1c.1 ("not yet enforced"), out of scope here too.
- **No reversed-spell UI** — the `spell` item's `reversible`/`isReversedForm` fields exist but SP4 doesn't add a toggle or duplicate-casting flow for them; a reversed spell is authored as its own separate `spell` item if a user wants one, same as today.
- **No spell compendium pack.** Spell content is entirely user-authored `spell` items, per the content policy (no PHB spell text shipped).

---

## 8. Deliverables checklist

**Plan 4a:**
1. `memorizedSchema()` += `expended` field.
2. `src/magic/{cast-card,card-types}.ts` — pure, 100% tested.
3. `src/sheets/character/spell-actions.ts` (memorize/forget/cast/rest) + `sheet.ts` action wiring + `spells.hbs` UI.
4. `src/chat/chat-listeners.ts` generalized Apply handler + `templates/chat/cast-roll.hbs`.
5. `lang/en.json` additions + drift test.
6. Gated dev-world smoke check (§6 Plan 4a checklist), all steps PASS.

**Plan 4b:**
1. `src/magic/learn-spell-card.ts` — pure, 100% tested.
2. `spell-actions.ts` `learnSpell` + `sheet.ts` action wiring + `spells.hbs` UI addition.
3. `templates/chat/learn-spell-roll.hbs`.
4. `lang/en.json` additions + drift test.
5. Gated dev-world smoke check (§6 Plan 4b checklist), all steps PASS.

After both plans merge: SP4 complete.
