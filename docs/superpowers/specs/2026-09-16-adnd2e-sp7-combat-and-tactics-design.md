# AD&D 2E for Foundry VTT — Sub-project 7: Player's Option: Combat & Tactics

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-16
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-14-adnd2e-sp3-core-combat-design.md` (Sub-project 3 — Core Combat), `docs/superpowers/specs/2026-09-16-adnd2e-sp5-proficiencies-skills-design.md` (Sub-project 5 — Proficiencies & Skills), `docs/superpowers/specs/2026-09-16-adnd2e-sp6-npc-creature-sheets-design.md` (Sub-project 6 — NPC/Creature Sheets)

---

## 1. Context

Per the parent spec's sub-project table: "Maneuvers, critical-hit tables, called shots, expanded initiative." This is the largest sub-project of the nine — verified against real current source (not assumed) during brainstorming, it actually spans **seven** mechanical areas across the settings registry, not the four the one-line description names, and is sliced into **four sequential plans** under this one spec (matching the SP4a/4b and SP5a/5b precedent, extended one plan further given the size).

### 1.1 What already exists

- **The `combatAndTactics` settings group already reserves 6 toggles** (`src/settings/registry.ts`), none wired into `OptionalRules` yet (`optionalRulesKey: null` on all 6): `combatAndTacticsEnabled`, `criticalHits`, `calledShots`, `combatManeuvers`, `armorTypeVsWeaponType`, `weaponMastery`. This sub-project wires all 6.
- **Individual initiative is fully built** (SP3): `src/core/combat/initiative.ts`'s pure `initiativeModifiers({weaponSpeedFactor, reactionAdj, situationalModifier})`, wired in `src/documents/combatant.ts`'s `_getInitiativeFormula()`. The `situationalModifier` term already reads a per-combatant flag (`getFlag(SYSTEM_ID, "initiativeModifier")`) — **but nothing anywhere in the codebase ever calls `setFlag` to set it.** The entire gap is a missing UI affordance, not missing logic.
- **Attack/damage resolution is fully built** (SP3, reused unchanged by SP6): `hitResult()` (`src/core/combat/attack.ts`) returns `autoHit`/`autoMiss` off the natural d20 (20/1). `attackModifiers()` already accepts a `situationalModifier` parameter that **no caller populates today** — the natural seam for called-shot/maneuver attack-roll penalties and armor-vs-weapon-type modifiers alike. `rollAttack` (`src/sheets/character/combat-rolls.ts`, mirrored in `src/sheets/creature/combat-rolls.ts`) is the single call site that resolves target AC, rolls, and calls `hitResult`; `buildAttackCardContext`/`buildDamageCardContext` (`src/combat/{attack-card,damage-card}.ts`) shape the two chat cards; `chat-listeners.ts` wires the Roll Damage/Apply Damage buttons via a `data-action` delegated-listener pattern.
- **Weapon specialization is fully built** (SP5a): `src/core/proficiencies/weapon.ts`'s `weaponSpecializationSlotCost`/`weaponSpecializationEffect`/`canWeaponSpecialize`, wired through `specializeWeapon` (`src/sheets/character/proficiency-actions.ts`) and `resolveProficiencyModifier` (`combat-rolls.ts`). **Two dead weapon-mastery scaffolds already exist and are unused by any code**: `WeaponProficiencyItemModel.masteryTier` (`NumberField`, min 0, initial 0) on the proficiency item, and a duplicate `WeaponItemModel.specialization.{isMastery,...}` sub-object on the weapon item itself. This sub-project adopts the first, deletes the second.
- **Weapon and armor items have no per-weapon-type/armor-type modifier hook today.** `WeaponItemModel` classifies weapons by broad `category` (melee/thrown/bow/crossbow) and `damageType` (slashing/piercing/bludgeoning/piercing-slashing/piercing-bludgeoning) — no per-weapon-name granularity. `ArmorItemModel.armorType` is a real 13-member enum (`ARMOR_TYPES`, `src/data/item/choices.ts`). `armor-class.ts` has no weapon-type awareness at all. Armor-vs-weapon-type is a genuinely new mechanic, not an extension of a partial one.
- **`CONFIG.statusEffects`/conditions wiring has been deferred twice already** (1c.4a, then again at SP6) and is picked up for real here. `src/conditions.ts`'s 15 `CONDITIONS` and the `packs/conditions/_source/` JSON docs already exist, but every condition's `system.changes` is empty (no mechanical effect), and the compendium itself is unshippable as-is: **v14.364's server-side manifest installer rejects `"type": "ActiveEffect"` compendium packs outright** (confirmed via git history — PR #16 reverted an earlier attempt at exactly this for exactly this reason). `Adnd2eActiveEffectModel` (`src/data/active-effect/adnd2e.ts`, subtype `"adnd2e"`) is the real, working ActiveEffect DataModel this sub-project's HUD-created effects will use — it is not being replaced, only finally driven from `CONFIG.statusEffects`.
- **No dedicated "declare a choice before rolling" UI component exists**, but two real, established patterns cover it completely: (a) an inline per-weapon-row control read from the DOM at click time (the existing `.backstab-toggle` checkbox, `templates/actor/character/combat.hbs` + `sheet.ts`'s `#onRollAttack`), and (b) a `foundry.applications.api.DialogV2.prompt` raw-HTML modal for a single value with no natural per-row home (Award XP, manual target AC). Every dialog in this codebase today is (b)'s single-field shape; nothing here needs a new pattern.

### 1.2 Platform

Foundry VTT **v14.364**. `fvtt-types` is a wrong v13-beta — **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source for every Foundry-layer API**, most importantly `CONFIG.statusEffects`'s real shape/defaults and `Actor#toggleStatusEffect`, neither of which has been read yet as of this spec — Plan 7a's first task must do so before writing any status-effect code. Carried forward from SP3/SP4/SP5/SP6: any actor/document resolved from data baked into a chat-card button's dataset uses `.uuid` + `fromUuidSync()`, never `.id` + `game.actors.get()`.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Plan decomposition | **4 sequential plans under this one spec**: **7a** Status-effect foundation + initiative UI. **7b** Critical hits/fumbles + armor-vs-weapon-type. **7c** Weapon mastery. **7d** Called shots + combat maneuvers. |
| Initiative depth | **Close the loop on SP3's existing system only** — a small UI affordance to set the already-wired `initiativeModifier` flag. No segment-based initiative overhaul. |
| Critical hits/fumbles | **Full severity tables** (not a single toggleable formula) — a d10 severity roll on both a crit and a fumble table, each with several tiers. |
| Called shots & maneuvers automation | **Fully automated outcomes**, including persisted status effects (blinded, prone, held, etc.) where the outcome calls for one — this is *why* Plan 7a must finally wire real status effects, rather than leaving that deferred a third time. |
| Maneuver list scope | **A curated core set of 4** — disarm, knock down/trip, grapple, bull rush. The full Combat & Tactics maneuver list is explicitly parked for a later revisit (see §7). |
| Extra reserved toggles (`armorTypeVsWeaponType`, `weaponMastery`) | **Included in SP7**, not parked — both get a full plan/section rather than staying unwired. |
| Condition mechanics scope | **Only what SP7's own maneuvers/called-shots need get real mechanical effects**: prone, blinded, stunned, held. The other 11 of the 15 existing conditions stay flavor-only markers (a GM interprets them by hand) until a future sub-project gives them mechanics. |
| Conditions compendium pack type | **`Item`-typed** (a new `condition` Item subtype), not `ActiveEffect`-typed — the only shape v14.364's installer accepts for a shippable compendium. `CONFIG.statusEffects` is populated **programmatically at `init`** from the same condition data, independent of the pack; a HUD toggle creates a real `adnd2e`-subtype `ActiveEffect` document. |
| Armor-vs-weapon-type key | **`damageType` (5 values) × a collapsed 4-bucket armor grouping** (Unarmored / Padded-Leather-Studded / Ring-Scale-Chain / Splint-Banded-Plate), not all 13 individual `ArmorType` values — keeps the table ~20 cells instead of ~65, and matches this system's existing weapon classification granularity (no per-weapon-name table is possible without adding weapon-name granularity the schema doesn't have). |
| Weapon mastery tier model | **Collapse the existing `specialized: boolean` into tier 1 of a single `masteryTier` NumberField scale**: 0 = proficient only, 1 = Specialized (today's existing mechanic, unchanged), 2 = Mastery (+2 to-hit/+3 damage), 3 = Grand Mastery (+3 to-hit/+3 damage, +1 attack/round with that weapon). The book's separate "High Mastery" tier is skipped to keep the ladder to 4 steps. Eligibility is unchanged from today's Specialization gate (`canWeaponSpecialize`'s `specializationAllowed`/`isSingleClass`) — no new class-eligibility rule. |
| Called shots & maneuver mechanic | **Unified as one mechanic**: an attack roll vs. AC (reusing `rollAttack` unchanged) with a maneuver/called-shot-specific attack-roll penalty populating the existing unused `situationalModifier` parameter, and a specific effect applied on a hit. A deliberate simplification of RAW's more varied per-maneuver mechanics (some of which are opposed ability checks in the book) — flagged here as the single biggest judgment call in this spec. |
| Called shot/maneuver UI | **An inline dropdown next to each weapon row**, exactly mirroring the existing `.backstab-toggle` checkbox pattern — no new dialog. |
| Settings gating | `combatAndTacticsEnabled` is a **master AND-gate** over the 5 specific toggles — every check in code is `optionalRules.combatAndTacticsEnabled && optionalRules.<specific>`. All 6 move from `optionalRulesKey: null` to real `OptionalRules` fields. |

---

## 3. Global Constraints

Copied forward from the parent + sibling specs; every task's requirements implicitly include this section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — never `fvtt-types`. `CONFIG.statusEffects`'s real default shape and `Actor#toggleStatusEffect` MUST be read from real source before Plan 7a's first status-effect task is written, not assumed from general Foundry knowledge.
- **Two-layer contract:** every plan's new pure logic (critical/fumble severity tables, armor-vs-weapon-type lookup, weapon-mastery tier effects, the called-shot/maneuver lookup table, any new condition-mechanics helpers) lives in `src/core/**` or an equivalently gated pure directory — no `foundry`/`game`/`CONFIG`/DOM imports, gated by `tsconfig.core.json` + the ESLint pure-zone + **100% Vitest coverage** (branch ≥ 90). The Foundry shell (sheet UI, chat cards, status-effect/`CONFIG` registration, combat-tracker UI, item DataModel changes) is typecheck + build gated only, no unit tests, dev-world verified — matching every prior sub-project's established split.
- **Content policy:** mechanical/factual values only. The crit/fumble severity tables, the armor-vs-weapon-type modifier table, and the weapon-mastery bonus progression are this project's OWN designed numbers (not transcribed from the Combat & Tactics book's actual tables) — see §2's explicit simplifications. No copyrighted table/rules prose is reproduced anywhere.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; `npm run build` requires Foundry fully closed (re-confirm before every build attempt, every plan).
- **Never pipe vitest output through `grep`** — read via `tail`/`head`/redirect; a cache-clear's first run can genuinely flake, rerun 2-3× before concluding something is wrong.
- **The gated dev-world smoke check is REQUIRED at the end of each of the 4 plans** — never deferred, never skipped, and never silently left out of a plan document (SP6's own whole-branch review found and had to insert a review step its plan omitted; this spec calls out explicitly that all 4 plans must include their own gated check AND a whole-branch review before it, learning from that).

---

## 4. Code architecture

### 4.1 Plan 7a — Status-effect foundation + initiative UI

**Conditions as an Item subtype.** New `src/data/item/condition.ts` (`ConditionItemModel extends Adnd2eItemModel`) with a schema mirroring `src/conditions.ts`'s existing `Condition` shape (`conditionId`, `name`/`img` via the standard Item fields) plus room for the mechanical fields the curated 4 conditions need (see below). New `condition` entry in `system.json`'s `documentTypes.Item` and a new `packs/conditions` **`Item`-typed** compendium (converting the existing 15 `_source/*.json` docs from `ActiveEffect`-shaped to `Item`-shaped). `src/conditions.ts`'s pure `CONDITIONS` list stays as the drift-tested source of truth the pack is checked against, same convention as every other compendium.

**`CONFIG.statusEffects` wiring.** A new Foundry-shell module (e.g. `src/combat/status-effects.ts`) builds the real `CONFIG.statusEffects` array at `init` from `CONDITIONS`, deciding per-condition whether to adopt one of Foundry core's own default status-effect ids (where semantics genuinely match — verified against real v14.364 `client/config.mjs` source, not assumed) or register a fully custom `adnd2e.<conditionId>` entry, and sets any applicable `CONFIG.specialStatusEffects` slot (e.g. `BLIND`). Toggling a token's HUD icon creates a real `ActiveEffect` of the existing `adnd2e` subtype (`Adnd2eActiveEffectModel`) with `system.conditionId` set — no change to that model itself.

**Condition mechanics (curated 4 only: prone, blinded, stunned, held).** Pure `src/core/combat/condition-effects.ts` (or similar) encodes the actual numeric consequence of each — e.g. blinded = attack-roll penalty, prone = AC/attack penalty, stunned/held = cannot act — as plain functions the relevant roll flow calls, mirroring how every other modifier in this codebase is a pure function taking explicit inputs. The other 11 shipped conditions get a `system.changes: []` no-op DataModel entry (as today) and are flavor markers only — a GM interprets them.

**Initiative UI.** A small Combat Tracker affordance (a context-menu entry on each combatant row, or an inline small `<input>` — decided by reading real `client/applications/sidebar/tabs/combat-tracker.mjs` at task time for the cleanest v14.364 extension point) that calls `combatant.setFlag(SYSTEM_ID, "initiativeModifier", n)`. No change to `initiative.ts`'s pure math or `combatant.ts`'s existing read side — both already correct and already tested.

### 4.2 Plan 7b — Critical hits/fumbles + armor-vs-weapon-type

**Critical hits & fumbles.** Pure `src/core/combat/critical.ts` exports something like `criticalSeverity(d10: number): {damageMultiplier, flatBonus, label}` and `fumbleSeverity(d10: number): {effect: "none"|"disarm"|"selfInjury", selfInjuryDice: string|null, label}` — concrete tier tables (this project's own numbers, per §3's content-policy note). Hooked into both `rollAttack` implementations (character + creature) immediately after `hitResult()` returns: on `autoHit`, roll the crit severity die and thread the result into `AttackCardContext`/`DamageCardContext` (new `critMultiplier`/`critFlatBonus`/`critLabel` fields, following the exact precedent `backstabMultiplier` already set); on `autoMiss`, roll the fumble severity die and apply its effect. A `disarm` result needs a weapon-unequip helper — Plan 7b builds a small standalone `unequipWeapon(actor, itemId)` shell helper for its own use (sequencing: 7b comes before 7d, so it cannot depend on anything 7d builds); Plan 7d then reuses this same helper for its own disarm-maneuver outcome rather than writing a second copy.

**Armor-vs-weapon-type.** Pure `src/core/combat/weapon-vs-armor.ts` exports a lookup `weaponVsArmorModifier(damageType, armorGroup): number` over the `damageType` (5) × collapsed armor-group (4) table from §2. A pure `toArmorGroup(armorType: ArmorType): ArmorGroup` classifier maps the real 13-member enum down to the 4 groups (mirrors SP5b's `classifyThiefArmor` precedent exactly — same shape, same repo). Wired into `attackModifiers()`'s existing `situationalModifier` input at the same `rollAttack` call sites.

Both features gate on `optionalRules.combatAndTacticsEnabled && optionalRules.criticalHits` / `...armorTypeVsWeaponType` respectively.

### 4.3 Plan 7c — Weapon mastery

Schema change: delete `WeaponItemModel.specialization` (the dead duplicate sub-object — zero references anywhere, confirmed). `WeaponProficiencyItemModel.specialized: boolean` is deprecated in favor of reading `masteryTier >= 1`; a data-migration entry (`src/data/migrations.ts`) sets `masteryTier: 1` for any existing item where `specialized === true`, then the `specialized` field itself is dropped from the schema (matching this codebase's established migration-framework precedent from 1c.4b).

New pure `src/core/proficiencies/weapon-mastery.ts`: `weaponMasteryEffect(tier: 0|1|2|3): {toHit, damage, extraAttacks}` (tier 1's values identical to today's `weaponSpecializationEffect`, so this can wrap/replace it directly) and `weaponMasteryTierCost(tier, category): number` (the per-tier slot-cost progression, extending `weaponSpecializationSlotCost`'s existing per-category shape). `specializeWeapon` (`proficiency-actions.ts`) becomes `advanceWeaponMastery(actor, weaponProfItemId)` — same re-derive-eligibility-then-`update()` shape, now incrementing `masteryTier` by 1 per purchase instead of setting a boolean. `resolveProficiencyModifier` (`combat-rolls.ts`) switches from checking `specialized` to calling `weaponMasteryEffect(prof.masteryTier)`. Tier 3's extra attack integrates with whatever multi-attack-per-round mechanism `warriorAttacksPerRound` already models (read `src/core/classes/progression.ts` at task time to confirm the exact integration point before writing this task's code).

Gates on `optionalRules.combatAndTacticsEnabled && optionalRules.weaponMastery`.

### 4.4 Plan 7d — Called shots & combat maneuvers

Pure `src/core/combat/maneuvers.ts` exports the §2 lookup table as data (`MANEUVERS: Record<ManeuverId, {attackPenalty: number, effect: ManeuverEffect}>` covering the 3 called-shot locations + 4 curated maneuvers) plus a `resolveManeuverOutcome(maneuverId, hit: boolean): ManeuverEffect | null` pure function. `ManeuverEffect` is a small discriminated union (`{kind: "condition", conditionId} | {kind: "unequip"} | {kind: "push"}` etc.) that the Foundry-shell caller pattern-matches to apply (via `Actor#toggleStatusEffect` for `condition` outcomes — reusing Plan 7a's now-real status effects; a small `unequipWeapon(actor, itemId)` shell helper for `unequip`, shared with Plan 7b's fumble-disarm outcome per §4.2's sequencing note).

Foundry shell: a new `<select>` (options: none + 3 called-shot locations + 4 maneuvers) added next to each weapon row in `combat.hbs` (and mirrored in the npc/creature templates that reuse it, matching how the backstab checkbox was propagated in SP5b/SP6), read via the identical `target.closest(".weapon-row")?.querySelector(...)` pattern the backstab checkbox already uses, passed as an extra parameter into `rollAttack`. `rollAttack` populates `attackModifiers().situationalModifier` from `MANEUVERS[selected].attackPenalty` before rolling, and calls `resolveManeuverOutcome` after `hitResult()` to apply the effect.

Gates on `optionalRules.combatAndTacticsEnabled && optionalRules.calledShots` (called-shot options) / `...combatManeuvers` (maneuver options) independently — a GM can enable one without the other.

---

## 5. Error handling

- Every new roll-time action re-checks its own eligibility server-side before acting (matches the established convention from every prior sub-project) — e.g. `advanceWeaponMastery` re-derives slot availability and current tier the same way `specializeWeapon` does today, never trusting client-side UI state alone.
- A maneuver/called-shot's `situationalModifier` and a crit/fumble severity roll are both **additive, never silently dropped** — if `combatAndTacticsEnabled` (or the specific toggle) is off, the UI control simply isn't rendered/read, rather than being rendered and then ignored server-side (avoids a confusing "I picked disarm and nothing happened" state).
- `CONFIG.statusEffects` registration happens once at `init` and must not throw on an already-initialized `CONFIG` (defensive check, matching the `Object.defineProperty(Cls, "name", ...)` idempotence pattern already used for sheet class registration).
- A maneuver `unequip` outcome on an actor with no equipped weapon (e.g. unarmed) is a no-op, not an error — checked before attempting the update.

## 6. Testing strategy

Per plan, matching every prior sub-project's established gated rhythm:

1. Pure-layer unit tests (100% coverage) for that plan's new `src/core/**` additions, written test-first.
2. Foundry-shell wiring (no unit tests) implemented and self-reviewed by the task's own implementer.
3. Full per-task review loop (spec compliance + code quality) exactly as established.
4. A **whole-branch review** after that plan's own implementation tasks, before its own gated dev-world check — explicitly required per §3, not left to the plan document to remember.
5. A **GATED dev-world smoke check** at the end of each plan (7a-7d each get their own — this sub-project does NOT defer all four plans' live testing to one check at the very end, since each plan's own mechanics need to work correctly before the next plan builds on it).

## 7. Scope boundary — what SP7 does NOT include

- The full Combat & Tactics maneuver list beyond the curated 4 (disarm, knock down/trip, grapple, bull rush) — explicitly parked for a future revisit.
- The book's full segment-based initiative overhaul (declared actions before rolling, per-action segment timing) — SP7 only closes the gap on SP3's existing DEX-reaction + weapon-speed-factor system.
- Mechanical effects for the 11 shipped conditions beyond prone/blinded/stunned/held — they stay flavor-only markers.
- Any new weapon-vs-armor granularity beyond the collapsed `damageType` × 4-armor-group table (e.g. no per-specific-weapon-name table).
- "High Mastery" as a distinct 5th weapon-mastery tier — collapsed into Grand Mastery per §2.
- Opposed-ability-check maneuver resolution (RAW's actual mechanic for some C&T maneuvers) — SP7 unifies everything into the attack-roll-vs-AC model per §2's explicit simplification.

## 8. Deliverables checklist

- [ ] Plan 7a: `condition` Item subtype + Item-typed `packs/conditions` compendium; `CONFIG.statusEffects`/`specialStatusEffects` wiring; mechanical effects for prone/blinded/stunned/held; Combat Tracker initiative-modifier UI; `combatAndTacticsEnabled` + `criticalHits`/`calledShots`/`combatManeuvers`/`armorTypeVsWeaponType`/`weaponMastery` all wired into `OptionalRules`.
- [ ] Plan 7b: critical-hit + fumble severity tables wired into both `rollAttack` paths and both chat cards; armor-vs-weapon-type modifier wired into `attackModifiers()`.
- [ ] Plan 7c: unified `masteryTier` scale replacing `specialized`; dead weapon-item mastery scaffold deleted; a migration for existing `specialized: true` items; `advanceWeaponMastery` action; Grand Mastery extra-attack integration.
- [ ] Plan 7d: called-shot + curated-maneuver lookup table and outcome resolver; weapon-row dropdown UI; wired into `rollAttack`'s existing flow.
- [ ] README's sub-project table updated, "Known backlog items" gains the parked full-maneuver-list and 11-unmechanized-conditions entries.
