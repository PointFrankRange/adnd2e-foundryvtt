# AD&D 2E for Foundry VTT — Sub-project 8: Player's Option: Skills & Powers

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-23
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-16-adnd2e-sp5-proficiencies-skills-design.md` (Sub-project 5 — Proficiencies & Skills), `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` (Sub-project 7 — the structural precedent for this spec: settings master-gate, sliced plans, Item-subtype + Item-typed pack, mandatory whole-branch review)

---

## 1. Context

Per the parent spec's sub-project table: "Trait/sub-ability character-point buy, expanded proficiencies." This sub-project is sliced into **three sequential plans** under this one spec: **8a** sub-ability scores, **8b** expanded proficiencies, **8c** the character-point build.

### 1.1 What already exists (verified against real current source during brainstorming)

- **The `skillsAndPowers` settings group already reserves 4 toggles** (`src/settings/registry.ts`), all with `optionalRulesKey: null` and none consumed by any code: `skillsAndPowersEnabled`, `subAbilityScores`, `characterPointBuild`, `expandedProficiencies`. Their lang hints currently end "Requires Sub-project 8." `src/core/options.ts`'s `OptionalRules` bag does not yet contain them.
- **Ability scores** are stored as `system.abilities.<k>.score` (integer ≥ 1) plus `exceptional`; `applyRacialAdjustment` (`src/data/actor/base-actor.ts`, called from `prepareBaseData` of the character and npc models) writes the racially-adjusted score back onto `score`. `deriveAbilities` (`src/core/abilities/index.ts`) and `assertAbilityScore` (`src/core/errors.ts`) constrain every score to an integer in **[1, 25]**. Every derived value (hit/damage/defensive adjustments, spell bonuses, saves, encumbrance) reads the main score.
- **`system.skillsAndPowers`** is already reserved as an untyped `ObjectField` (`initial: {}`) on the actor schema (`base-actor.ts`), unused.
- **Weapon proficiency** (`WeaponProficiencyItemModel`): `weaponOrGroup`, `isGroup`, `slotsInvested`, `styleSpecialization`, `masteryTier`. `resolveProficiencyModifier` (`src/sheets/character/combat-rolls.ts`) resolves only "proficient" (exact-name match, or group match via `weapon.system.proficiencyGroup`) or "non-proficient"; `WeaponProficiencyMode` in `core/types.ts` and `weaponAttackPenalty(penalty, mode)` in `core/proficiencies/weapon.ts` already define and compute a **`"related"` mode (half the non-proficiency penalty, rounded up) that no caller ever resolves.** Weapon items carry `proficiencyGroup`. Only the 8 group items ship as a compendium (`packs/weapon-proficiency-groups`, `isGroup: true`); there is no specific-weapon proficiency pack.
- **The drop-validation pattern** is pure and already extensible: `validateItemDrop(input: DropCheckInput): DropVerdict` (`src/sheets/character/drop-rules.ts`) rejects duplicate race/class and unaffordable weapon/non-weapon proficiency drops via an i18n `reason` key.
- **The Item-subtype + Item-typed-pack pattern** was established in Sub-project 7 Plan 7a (`condition` subtype, `packs/conditions`, `CONFIG`-independent runtime use) because v14.364's installer rejects `ActiveEffect`-typed compendiums.

### 1.2 Platform

Foundry **v14.364** is the installed/verified target; `fvtt-types` pins v13-beta and is wrong about several v14 APIs — any Foundry-layer question is answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Plan decomposition | **3 sequential plans under this one spec**: **8a** sub-ability scores (+ wiring all 4 toggles into `OptionalRules`). **8b** expanded proficiencies. **8c** the character-point build. |
| Settings gating | `skillsAndPowersEnabled` is a **master AND-gate** — every check in code is `optionalRules.skillsAndPowersEnabled && optionalRules.<specific>`. All 4 move from `optionalRulesKey: null` to real `OptionalRules` fields in Plan 8a (as SP7a did for its 6), so 8b/8c only consume them. |
| Sub-ability depth | **Authored sub-scores feed the main score; no new mechanics of their own.** 12 sub-scores (2 per ability). When on, each main ability score is the rounded average of its two effective sub-scores, so every existing table and derive step is untouched. |
| Sub-score storage | `abilities.<k>.sub: { a, b }`, both **nullable**; a `null` sub-score falls back to that ability's authored `score`. Enabling the rule never changes an existing character; disabling it restores their authored scores. |
| Racial adjustment | Unchanged and applied **after** averaging (to the main score), so `applyRacialDeltas`/racial limits are untouched. |
| Expanded-proficiency scope | **Only** the related-weapon penalty and a specific-weapon proficiency compendium pack. A larger non-weapon list, secondary-ability checks, and wiring the two `*ProficienciesUsed` toggles were offered and **explicitly not selected** (§7). |
| Character-point build model | **Point-buy pool over the 8 existing fixed classes.** CP is a creation budget spent on sub-scores and a curated set of **traits** (new `trait` Item subtype). No class-chassis refactor, no custom-class builder, no kits. |
| Trait effects | **A closed typed effect set, interpreted by pure derive code** (not ActiveEffects): ability bonus, save bonus, attack bonus, extra proficiency slots, flat bonus HP. |
| CP budget | **Creation budget only**: one authored pool per character (GM-editable); no per-level awards. Spent CP is **derived** (sub-score cost curve + owned traits), so removing a trait refunds it automatically. |
| CP enforcement | **Hard** for trait drops (a pure drop rule blocks an unaffordable/duplicate trait, mirroring the proficiency-slot drop rule); **soft** for sub-score and pool edits (an overspend warning on the sheet, never a blocked input). |
| Scope of sheet UI | **PC sheet only** for sub-score inputs and the CP ledger/trait UI. The NPC sheet shows none of it; the shared derivation still applies to NPCs (null sub-scores fall back to the main score, so an NPC is unaffected unless someone sets sub-scores by hand). |

---

## 3. Global Constraints

Copied forward from the parent + sibling specs; every task's requirements implicitly include this section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — never `fvtt-types`.
- **Two-layer contract:** every plan's new pure logic (sub-score averaging/fallback, the related-weapon mode resolver, the CP cost curve, trait-effect application, the trait drop rule) lives in `src/core/**` or an equivalently gated pure directory — no `foundry`/`game`/`CONFIG`/DOM imports, gated by `tsconfig.core.json` + the ESLint pure-zone + **100% Vitest coverage** (branch ≥ 90). The Foundry shell (DataModel schema, sheet UI, item sheets, compendium packs, `prepareBaseData` wiring) is typecheck + build gated only, dev-world verified.
- **Content policy:** mechanical/factual values only. The CP cost curve, the trait list and every trait's cost/effect, and the sub-score names' mechanics are this project's OWN designed numbers (not transcribed from the Skills & Powers book's tables or trait descriptions). The twelve sub-ability names and the PHB weapon names (with their group assignment) are game vocabulary, not prose. No copyrighted table or rules text is reproduced anywhere.
- **v14 data gotchas from SP7c apply here:** removing or renaming a schema field prunes it from `_source` at construction (`migrateData` on the DataModel is the only hook that can still see it); adding a field with an `initial` needs no migration. This sub-project's schema changes are **additive** (`sub`, `proficiencyGroup`, a typed `skillsAndPowers`, the `trait` subtype) and are expected to need **no migration and no version bump** — each plan must confirm that against the real model before finishing.
- **Duplicate re-validation pattern:** every purchase/drop/roll-time action re-derives its own eligibility server-side from the actor's current state and current settings — never trusts client-side UI state (the SP7c and SP7d whole-branch reviews each caught a gate that two files stated differently; write any shared gating expression once in the plan text and reuse it verbatim).
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; `npm run build` requires Foundry fully closed (re-confirm before every build attempt, every plan).
- **Never pipe vitest output through `grep`** — read via `tail`/`head`/redirect; a cache-clear's first run can genuinely flake, rerun 2-3× before concluding something is wrong.
- **Each plan ends with a mandatory whole-branch review, then a GATED dev-world smoke check** — never deferred, never skipped. The dev-world check must include a **non-GM player seat** (a second Player-role account in a private window) for any flow where a player edits, drops onto, or mutates a document — every prior sub-project's Critical bugs were invisible from the GM seat.

---

## 4. Code architecture

### 4.1 Plan 8a — Sub-ability scores (+ settings wiring)

**Settings wiring.** `OptionalRules` gains `skillsAndPowersEnabled`, `subAbilityScores`, `characterPointBuild`, `expandedProficiencies` (all default `false`); the 4 registry descriptors move from `optionalRulesKey: null` to their own key; lang hints drop "Requires Sub-project 8." wording (each plan updates only its own toggle's hint; 8a updates the master + `subAbilityScores` hints and leaves the other two "not yet enforced" until their plan). The registry/lang/`SettingConfig`/drift tests (`tests/config/settings-augmentation.test.ts`, `tests/settings/registry.test.ts`, `tests/lang/en-coverage.test.ts`) all move together.

**Pure core.** New `src/core/abilities/sub-abilities.ts`: the `SUB_ABILITIES` table (per `AbilityKey`, its two sub-ability ids/labels — Str: muscle/stamina, Dex: aim/balance, Con: health/fitness, Int: reason/knowledge, Wis: intuition/willpower, Cha: leadership/appearance); `effectiveSubScore(sub: number | null, mainScore: number): number` (null → main); `mainScoreFromSubs(a: number | null, b: number | null, mainScore: number): number` = `Math.round((effA + effB) / 2)` clamped to [1, 25]. Rounding is half-up via `Math.round`; the plan pins the exact tie-break with a test.

**Schema + derivation.** `abilities.<k>` gains `sub: SchemaField({ a, b })`, each a nullable integer in [1, 25] (`initial: null`) — additive, no migration. `prepareBaseData` (character + npc models), when `skillsAndPowersEnabled && subAbilityScores`, sets `score = mainScoreFromSubs(sub.a, sub.b, authoredScore)` **before** `applyRacialAdjustment` runs, reading the authored score from `_source` (the same authored-vs-prepared split the sheets already rely on) so the write is idempotent across prepare cycles. Off → no read of `sub`, `score` stays authored.

**Sheet.** The PC abilities panel renders two sub-score inputs per ability when the rule is on; the main score renders read-only/derived. A "seed sub-scores from main" action writes the authored score into any `null` sub-score for existing characters. Context building (`context.ts`/`context-types.ts`, pure) gains the per-ability sub-score rows and their labels; the NPC sheet is unchanged.

### 4.2 Plan 8b — Expanded proficiencies

Gates on `optionalRules.skillsAndPowersEnabled && optionalRules.expandedProficiencies`.

**Related-weapon penalty.** `WeaponProficiencyItemModel` gains `proficiencyGroup: StringField` (`blank: true, initial: ""` — additive, no migration): the weapon group a **specific**-weapon proficiency belongs to. A new pure resolver (e.g. `weaponProficiencyMode` in `src/core/proficiencies/`) takes `{ exactMatch, groupMatch, relatedGroupMatch }` and returns `"proficient" | "related" | "non-proficient"`; `resolveProficiencyModifier` computes the three inputs from the actor's items and passes the result to the **existing** `weaponAttackPenalty(nonProficiencyPenalty, mode)`. `relatedGroupMatch` is true when the actor holds any specific-weapon proficiency (`isGroup === false`) whose non-empty `proficiencyGroup` equals the attacked weapon's `system.proficiencyGroup`. A related weapon never inherits the other proficiency's mastery tier, and the rule off preserves today's behavior exactly (proficient or non-proficient only).

**Specific-weapon proficiency pack.** A new Item-typed compendium `packs/weapon-proficiencies` (registered in `system.json`, compiled by `build:packs`, drift-tested like the others): one `weaponProficiency` item per PHB weapon name, `isGroup: false`, `proficiencyGroup` set to one of the 8 existing group names, `slotsInvested: 0`. Names and group assignment only — no weapon statistics. The plan enumerates the list from the PHB weapon table and adds a drift test that every item's `proficiencyGroup` names a real group in `packs/weapon-proficiency-groups`.

### 4.3 Plan 8c — Character-point build

Gates on `optionalRules.skillsAndPowersEnabled && optionalRules.characterPointBuild`.

**Trait Item subtype.** New `src/data/item/trait.ts` (`TraitItemModel extends Adnd2eItemModel`): `traitId` (string), `cost` (integer, negative for a disadvantage), and `effect: SchemaField` with `kind` (choices: `abilityBonus | saveBonus | attackBonus | proficiencySlots | bonusHp`) plus the fields each kind needs (`ability`, `save`, `mode`, `track`, `amount`), all validated against `choices.ts` enums. New `trait` in `system.json`'s `documentTypes.Item`, `ITEM_DATA_MODELS`, `subtypes.ts`, and lang `TYPES`. New Item-typed pack `packs/traits` with **14 designed traits** (§4.3.1), drift-tested against a pure `TRAITS` table like `CONDITIONS`.

**Pure core** (new `src/core/skills/character-points.ts` or equivalent under `src/core/**`):
- `subScoreCpCost(score: number): number` — the designed cost curve: score ≤ 6 → −4 (maximum refund); 7–9 → −(10 − score); 10 → 0; 11–14 → score − 10; 15–17 → 4 + 2×(score − 14); 18–25 → 10 + 3×(score − 17). (Baseline 10; reaching 25 costs 34.) Total sub-score spend = Σ `subScoreCpCost` over the **authored (non-null)** sub-scores only — a `null` sub-score is uncommitted and costs 0, even though the derivation falls back to the main score for it. This keeps an existing character with authored main scores from showing a false overspend when the rules are enabled.
- `traitEffectTotals(effects): { abilityBonus, saveBonus, attackBonus, proficiencySlots, bonusHp }` — a pure reducer over the owned traits' typed effects.
- `characterPointLedger({ pool, subScores, traitCosts })` → `{ spent, available, overspent }`.
- `DISADVANTAGE_REFUND_CAP = 10`: total CP refunded by disadvantage traits is capped at 10 (a disadvantage beyond the cap still applies its effect but refunds nothing further).
- `canAffordTrait({ traitCost, traitId, ownedTraitIds, available, refundedSoFar })` → verdict with an i18n `reason` — rejects a duplicate `traitId`, an advantage costing more than `available`, and (for a disadvantage) still allows it while clamping the refund at the cap.

**Schema.** `system.skillsAndPowers` changes from an untyped `ObjectField` to a typed `SchemaField` holding `characterPoints: { pool: integer, default 60 }` (authored, GM-editable). Existing data (`{}`) cleans to the initials — additive, no migration.

**Derive layer.** `ActorSnapshot` gains `traits` (each owned `trait` item's `effect`, plus `traitId`/`cost`); a new `src/data/derive/character/traits.ts` adapter applies `traitEffectTotals`: ability bonuses after racial adjustment and clamped to [1, 25], save bonuses to the matching save target, attack bonuses to the cached THAC0, proficiency slots to the weapon/non-weapon totals, bonus HP to `hpMax`. When the rule is off the adapter is skipped entirely (owned traits stay but do nothing).

**Drop rule.** `validateItemDrop` gains a `trait` branch (inputs `dropTraitCost`, `dropTraitId`, `ownedTraitIds`, `availableCp`, `refundedSoFar`) using `canAffordTrait`; both the PC sheet's `_onDropItem` and its existing validation path call it. NPC sheets are out of scope for traits.

**Sheet.** The PC Features tab gains a Traits section (owned traits with cost and effect summary, remove action) and the CP ledger (pool input, spent, available, overspend warning). Sub-score cost feeds the ledger when `subAbilityScores` is also on; with it off, the ledger counts traits only.

#### 4.3.1 The 14 designed traits (this project's own values; the plan copies this table verbatim)

| Trait | Cost | Effect |
|---|---|---|
| Hardy | 6 | bonusHp +4 |
| Iron Will | 5 | saveBonus spell +1 |
| Resilient | 5 | saveBonus ppd +1 |
| Steady Aim | 8 | attackBonus ranged +1 |
| Brawler | 8 | attackBonus melee +1 |
| Quick Study | 4 | proficiencySlots nonweapon +2 |
| Weapon Drill | 4 | proficiencySlots weapon +1 |
| Powerful | 7 | abilityBonus str +1 |
| Sturdy | 7 | abilityBonus con +1 |
| Frail | −4 | bonusHp −3 |
| Nervous | −4 | saveBonus spell −1 |
| Poor Aim | −5 | attackBonus ranged −1 |
| Slow Learner | −3 | proficiencySlots nonweapon −1 |
| Feeble | −5 | abilityBonus str −1 |

(Save categories are the existing five: `ppd`, `rsw`, `pp`, `bw`, `spell`.)

---

## 5. Error handling

- A sub-score outside [1, 25] is rejected by the schema (integer, min/max), never reaching `assertAbilityScore`; a derived main score is clamped to [1, 25] before it is written.
- Every gated action (trait drop, related-weapon resolution, sub-score-derived main score) re-checks its own toggle server-side; a control that a disabled rule would make meaningless is **not rendered** rather than rendered-then-ignored.
- An overspent character (sub-score/pool edits after the fact, or a GM lowering the pool) is a visible warning, never a blocked write and never silent data loss; existing traits are never auto-removed.
- A trait drop that fails validation shows the rejection `reason` toast and creates nothing.
- Sub-abilities/CP UI is PC-sheet-only; the derivation path tolerates NPCs (null sub-scores → unchanged main score).

---

## 6. Testing

Pure-zone code is unit-tested to the 100% gate: sub-score fallback and averaging (including the rounding tie-break and clamps), the related-mode resolver's truth table, every branch of `subScoreCpCost` (each range boundary), `traitEffectTotals`, `characterPointLedger`, `canAffordTrait` (duplicate, unaffordable, disadvantage refund cap), the extended `validateItemDrop`, and the `TRAITS`/pack drift tests. The Foundry shell is dev-world verified per plan: each plan's gated check covers its toggle on/off in both directions, the master gate independently, an existing character with authored scores/proficiencies unchanged by enabling the rules, and a **non-GM player seat**.

---

## 7. Out of scope

- A custom-class builder / class chassis refactor, character kits, per-level CP awards, or any change to the 8 fixed class chassis.
- A larger non-weapon proficiency list, secondary-ability checks, and wiring `weaponProficienciesUsed`/`nonweaponProficienciesUsed` — offered during brainstorming, explicitly not selected; remain parked backlog.
- Sub-ability-specific mechanics beyond feeding the main score.
- Trait/CP UI on the NPC or creature sheets.
- The existing parked items: weapon specialization/mastery damage bonus never wired into damage rolls; conditions have no duration/expiry; non-GM players cannot apply damage/maneuver effects to GM-owned targets.

## 8. Deliverables checklist

- [ ] Plan 8a: 4 toggles wired into `OptionalRules`; pure `sub-abilities.ts`; `abilities.<k>.sub` schema; `prepareBaseData` derivation ahead of racial adjustment; PC sheet sub-score inputs + seed action; whole-branch review; gated check incl. non-GM seat.
- [ ] Plan 8b: `weaponProficiency.proficiencyGroup`; pure related-mode resolver wired into `resolveProficiencyModifier`; `packs/weapon-proficiencies` + drift test; whole-branch review; gated check incl. non-GM seat.
- [ ] Plan 8c: `trait` Item subtype + `packs/traits` (14 traits); pure character-point module; typed `skillsAndPowers` schema; snapshot/derive trait adapter; extended drop rule; PC Features-tab Traits section + CP ledger; whole-branch review; gated check incl. non-GM seat.
- [ ] README's sub-project table updated (row 8 ✅ Complete) and "Known backlog items" gains the parked custom-class-builder/per-level-CP and the not-selected expanded-proficiency items.
