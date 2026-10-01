# AD&D 2E for Foundry VTT — Sub-project 14 Plan C: Player's Option: Spells & Magic — Channellers Fatigue

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-30
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-30-adnd2e-sp14b-channellers-design.md` (Plan B: the persisted spend-per-cast SP pool and Recover action this plan hangs fatigue off of), `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` (the `CONFIG.statusEffects`/conditions framework and `src/combat/condition-effects.ts`'s roll-time-penalty pattern this plan extends directly), `docs/superpowers/specs/2026-09-24-adnd2e-sp9-casting-time-design.md` (precedent for an auto-applied, non-manual condition/state machine driven by game actions rather than Token HUD clicks)

---

## 1. Context

Plan B (PR #55, merged 2026-09-30) shipped the core Channellers mechanic: a persisted, spend-per-cast spell-point pool with no fatigue consequence — "a complete, playable resource loop (cast, deplete, recover) with no downside yet." Its own spec explicitly deferred Table 21 fatigue as "Plan C... the risk layer that makes Channellers dangerous." This spec covers that risk layer.

### 1.1 Rules source (*Player's Option: Spells & Magic* pp.82-84 — Ch.6, "Using the Fatigue Chart" through "Recovering from Fatigue"; re-verified via the same clean page-image read Plan B's brainstorming used, not the initial OCR pass)

**Table 21: Spell Fatigue** (p.82) — row = the *caster's* level band, columns = which *spell* level causes each fatigue tier. Transcribed verbatim, then re-expressed in §4.2 as an explicit per-spell-level (1-9) lookup per band, since this project's spell schema has no level 0 and every "cantrip"-only cell is therefore unreachable (consistent with how Plans A and B already exclude cantrips):

| Caster Lvl | Light | Moderate | Heavy | Severe | Mortal |
|---|---|---|---|---|---|
| 1-2 | — | cantrip | 1st | 2nd | 3rd or higher |
| 3-4 | cantrip | 1st | 2nd | 3rd | 4th or higher |
| 5-6 | cantrip | 1st, 2nd | 3rd | 4th | 5th or higher |
| 7-8 | 1st | 2nd, 3rd | 4th | 5th | 6th or higher |
| 9-11 | ≤2nd | 3rd, 4th | 5th | 6th | 7th or higher |
| 12-13 | ≤3rd | 4th, 5th | 6th | 7th | 8th or higher |
| 14-15 | ≤4th | 5th, 6th | 7th | 8th | 9th or higher |
| 16-17 | ≤5th | 6th, 7th | 8th | 9th | — |
| 18-19 | ≤5th | 6th, 7th | 8th, 9th | — | — |
| 20-22 | ≤5th | 6th-8th | 9th | — | — |
| 23-25 | ≤6th | 7th-8th | 9th | — | — |
| 26+ | ≤6th | 7th-9th | — | — | — |

**Using the chart** (p.82): "find the row that matches the caster's level and then read across until you find the level of the spell. The column it appears in indicates the fatigue caused by the spell."

**Loss of Hit Points** (p.82-83): "If a character has been reduced to 50% or less of his maximum unwounded hit point total, the fatigue rating of the spell increases by one. If a character has been reduced to 25% or less of his normal hit point total, the fatigue rating increases by two categories."

**Loss of Spell Points** (p.83): "a character who has depleted his magical energy is more susceptible to fatigue, too. The same rules apply for reduced spell point totals. Always count the character's spell points *before* the spell is cast... Again, a loss of 50% increases fatigue by one category, and a loss of 75% increases it by two."

**Existing Fatigue** (p.83): "If a fatigued character casts another spell, increase the fatigue category of the new spell by one level if he is moderately fatigued, two levels if he is heavily fatigued, or three levels if he is severely fatigued. The character then acquires the new fatigue level of the spell he just cast, or stays where he was, whichever is worse."

**Effects of Fatigue** (p.83): *Lightly fatigued* — "no combat penalties... movement rate is reduced to three-quarters normal." *Moderately fatigued* — "a -1 penalty to attack rolls and have their movement rates halved." *Heavily fatigued* — "an attack penalty of -2, and an Armor Class penalty of +1... movement is reduced to one-quarter normal." *Severely fatigued* — "a -4 penalty to all attacks and a +3 penalty to their Armor Class... movement rate is reduced to 1." *Mortally fatigued* — "incapable of attacking or effectively defending themselves and collapse into a trembling heap immediately. The character must attempt a saving throw vs. paralyzation; if he fails, the strain proves too much and he perishes. If he passes, he remains unconscious for 1d6 hours before awaking severely fatigued." (No numeric AC penalty is given for the mortal tier beyond "collapse" — §4.1 does not invent one, per this project's content policy.)

**Recovering from Fatigue** (p.83): "In order for a wizard to 'lose' one step of fatigue, he must make a successful saving throw vs. paralyzation. Lightly or moderately fatigued characters can attempt a saving throw for each round of resting. Heavily fatigued spellcasters can attempt a saving throw for each turn of resting. Severely fatigued wizards can attempt a saving throw for each full hour of resting... Each extra round, turn, or hour spent resting gives the character a cumulative +1 bonus on his saving throw."

### 1.2 What already exists (verified against real current source)

- `src/conditions.ts` — pure `CONDITIONS: readonly Condition[]` (15 entries today: blinded, deafened, prone, stunned, unconscious, paralyzed, poisoned, held, entangled, invisible, sleeping, charmed, frightened, incapacitated, dead) + `buildStatusEffects()`, which maps each to a `CONFIG.statusEffects` entry. Each is also an ActiveEffect document in the `conditions` compendium, drift-tested against this list. This plan adds 5 new entries.
- `src/combat/condition-effects.ts` (Sub-project 7) — the exact precedent this plan's fatigue penalties follow: pure, Foundry-free functions (`blindedAttackPenalty`, `proneArmorClassPenalty`, `heldAttackBonus`, `canAct`) that take a `StatusSet` (an actor's live `.statuses`) and return a flat modifier or boolean. Consumed **at roll time**, not through the cached derive pipeline — `src/sheets/character/combat-rolls.ts:193,329` and `src/sheets/creature/combat-rolls.ts:193` sum these directly into `attackModifiers({ situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + ... })`, and both files' attack actions gate on `canAct(actor.statuses)` before rolling at all (`combat-rolls.ts:238`, creature `combat-rolls.ts:143`). `proneArmorClassPenalty` is applied to the *target's* AC (`combat-rolls.ts:281`). This plan's `fatigueAttackPenalty`/`fatigueArmorClassPenalty` are new siblings in the same file, summed into the same expressions; `canAct` itself gains one more excluded status (mortal fatigue).
- `src/relay/apply-effect.ts:27` — `await actor.toggleStatusEffect(request.conditionId, { active: true })`: this project's existing, real precedent for **programmatically** applying a condition from game logic (a maneuver's effect), not just a Token HUD click. Fatigue is simpler than that call site — the caster always owns their own actor (a self-effect), so none of `apply-effect.ts`'s GM-relay-for-a-target-you-don't-own machinery is needed; `toggleStatusEffect` is called directly from the casting glue.
- `src/core/saves/tables.ts` — `SAVE_MATRICES`'s `band(minLevel, ppd, rsw, pp, bw, spell)` convention ("a band applies from minLevel up to but not including the next band's minLevel") is the precedent `FATIGUE_BANDS` (§4.2) copies exactly, for the same reason: Table 21's rows are level bands, not one row per level.
- `src/sheets/character/combat-rolls.ts:460` `rollSave(actor, category)` — the existing **player-facing** saving-throw action: rolls `1d20 + rollModifier`, posts a chat card, and stores the pass/fail in a chat-message flag for OTHER systems (SP9a's disruption hook) to react to *asynchronously*. This plan's two save-driven mechanics (mortal-fatigue save-or-die, fatigue-recovery save) both need the pass/fail result **synchronously**, to decide the very next state change (apply `dead`, or drop a tier) in the same function call — mirroring how `castSpell`'s `rollSpellAutomation` already awaits a roll's `.total` directly rather than going through a hook. This plan adds its own small, direct roll-and-return-boolean helper rather than reusing `rollSave`'s fire-and-flag shape; it still posts a chat card for the same transparency every other roll in this project has.
- `src/data/actor/base-actor.ts`'s `channelling: { current, max }` SchemaField (Plan B) is the direct precedent for this plan's one new persisted field, `fatigueSaveBonus` (§4.3) — a small integer counter, persisted exactly like `channelling.current`, never touched by `prepareDerivedData`.
- Gate-function precedent: `channellersEnabled(rules)` (`src/core/magic/channellers.ts:17`) is the master-AND-gate this plan's own `channellerFatigueEnabled(rules)` nests under one level further (§2).

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Scope | **Wizard-only**, matching Plan B exactly — priest spell points/channelling still don't exist. PC and Character NPC sheets only (the two sheets Plan B wired); Monster NPCs don't support Channellers at all. |
| Gating | `channellerFatigueEnabled(rules) = channellersEnabled(rules) && rules.channellerFatigue` — a new leaf toggle nested one level under Plan B's own gate, mirroring the `spellPointsEnabled` → `channellersEnabled` nesting precedent exactly. A GM can run Channellers without the fatigue risk layer (e.g., while this plan is new) by leaving the leaf off. |
| Condition representation | 5 new mutually-exclusive boolean conditions (`lightFatigue`/`moderateFatigue`/`heavyFatigue`/`severeFatigue`/`mortalFatigue`) in `CONDITIONS`. Setting a new tier always clears every other fatigue condition first (at most one is ever active). |
| Combat-penalty wiring | Attack/AC penalties are computed **at roll time** by new pure functions in `src/combat/condition-effects.ts`, reading `actor.statuses` exactly like the existing SP7 conditions — not cached in `prepareDerivedData`. `canAct()` gains the mortal-fatigue exclusion. Movement is the one display-only exception: threaded through the sheet context (like `castingStatus` already is) and applied on top of the already-derived, encumbrance-adjusted movement rate in `buildVitals`. |
| Fatigue computation timing | Computed once, synchronously, immediately after a channelling cast succeeds (inside `castSpell`'s and `castFreeMagick`'s existing channelling branches, and `castOrBegin`'s channelling begin-branch — the same three call sites Plan B's own final-review fix wave already touched). HP/SP percentages are read **before** this cast's own cost is deducted, exactly as the book specifies ("always count...before the spell is cast"). |
| Mortal-fatigue death | On a failed save: `actor.update({"system.attributes.hp.value": 0})` + `actor.toggleStatusEffect("dead", {active: true})` — reusing the condition this system already ships, rather than inventing new death-state handling (this project has no other automated death mechanic to hook into yet). On a successful save: apply `unconscious` + set fatigue to `severeFatigue` immediately (the book's "awaking severely fatigued" is modeled as being severely fatigued *while* unconscious too, since fatigue has no mechanical effect on an already-unconscious actor — this is inert, not wrong). `unconscious`'s 1d6-hour duration is GM-cleared by hand, same as every other duration-less condition in this project today (an already-recorded README limitation, not a new one). |
| Fatigue recovery UX | A new "Recover from Fatigue" sheet action: one click = one saving-throw attempt, using a persisted `fatigueSaveBonus` counter (not a count of elapsed rest units the system verifies). Success: drop one tier (or clear fatigue entirely from `lightFatigue`), reset the counter to 0. Failure: increment the counter by 1 for next time. The tier-specific rest-interval text (round/turn/hour) is shown as a hint only — the player is trusted to only click it after resting that long, the same honor-system precedent already recorded for SP9a's round-spell completion. |
| Existing-fatigue stacking | Computed exactly per the book: shift the new cast's base tier up by 1 (moderate)/2 (heavy)/3 (severe) bands if already fatigued at that level, then take the worse of the shifted value and the character's current tier. A mortally-fatigued character never casts again until recovered (mortal fatigue already blocks all action via `canAct`). |
| Table 21 cantrip cells | Omitted — unreachable with no level-0 spell in this schema, exactly like Plans A/B already treat cantrips. Every band is re-expressed as a complete, literal 9-entry (spell levels 1-9) tier lookup in §4.2, not a range-matching function, since the full table is small enough to transcribe directly and this avoids "or higher"/open-range parsing bugs entirely. |

---

## 3. Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`; all Foundry-layer code is written against **v14.364** source — never `fvtt-types`.
- **Two-layer contract:** pure logic (the fatigue-tier lookup, HP/SP escalation, stacking math, the per-tier penalty/movement-multiplier tables) lives in `src/core/magic/channeller-fatigue.ts` — no Foundry imports, **100% Vitest line/statement/function coverage** (branches ≥ 90). The two new combat-penalty functions added to `src/combat/condition-effects.ts` follow that file's own existing precedent (pure, 100%-covered). Foundry glue (condition toggling, the two save-driven state machines, the Recover-from-Fatigue dialog, sheet wiring) is typecheck/lint gated and dev-world verified.
- **Content policy:** mechanical values only (Table 21's tier-per-level-per-band lookup, the escalation thresholds, the per-tier penalties, the recovery-interval-per-tier mapping) — no rules prose beyond short page citations in comments. The mortal tier's AC is deliberately left unmodeled (§1.1 — the book gives none).
- **Additive schema only — no migration, no version bump:** one new persisted integer field (`fatigueSaveBonus`), one new sibling of `CONDITIONS`'s existing 15 entries (5 new ids). No existing field's shape changes.
- **Single gate helper; every consumer re-derives eligibility** from the actor's current state and current settings — `channellerFatigueEnabled(rules)` is written exactly once.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; `npm run build` requires Foundry closed (re-confirm every time); vitest output read via `tail`/redirect, never `| grep`.
- **Mandatory whole-branch review, then a gated dev-world check** — per Plan B's own experience, budget for the dev-world check to surface at least one real integration gap no amount of per-task review caught (it found 3 for Plan B: two cross-cutting bugs the final review caught, one schema-presence-signal bug only live Foundry data could reveal). This plan's highest-risk analogous spot is the SAME one Plan B's final review found a bug in: the `castOrBegin`/Expanded-Casting-Time combat flow — the dev-world check must include casting (and fatiguing) a channelling wizard inside a started combat with that rule also on.

---

## 4. Code architecture (Plan C)

### 4.1 Settings wiring

`OptionalRules` gains `channellerFatigue: boolean` (default `false`). A new `channellerFatigue` descriptor in `src/settings/registry.ts`, group `spellsAndMagic`, `optionalRulesKey: "channellerFatigue"`, `requiresReload: true` (it changes prepare-time-adjacent eligibility the same way every other `spellsAndMagic` leaf does — strictly, fatigue's penalties are roll-time not derive-time, but the toggle still needs a reload to safely re-evaluate the sheet's Recover-from-Fatigue control and condition set, matching this project's existing convention of reloading on any `spellsAndMagic` leaf). `lang/en.json` gets a real hint.

### 4.2 Pure core (new `src/core/magic/channeller-fatigue.ts`)

- `channellerFatigueEnabled(rules): boolean` — `channellersEnabled(rules) && rules.channellerFatigue`.
- `export type FatigueTier = "light" | "moderate" | "heavy" | "severe" | "mortal";`
- `FATIGUE_BANDS: readonly { minLevel: number; tiers: readonly FatigueTier[] }[]` — one row per Table 21 caster-level band, `tiers[spellLevel - 1]` for spell levels 1-9, transcribed directly from §1.1 (12 bands: 1, 3, 5, 7, 9, 12, 14, 16, 18, 20, 23, 26 — same `band(minLevel, ...)`-lookup shape as `SAVE_MATRICES`).
- `baseFatigueTier(casterLevel: number, spellLevel: number): FatigueTier` — band lookup (mirrors `saveBaseTarget`'s own band-walk), then `tiers[spellLevel - 1]`.
- `TIER_ORDER: readonly FatigueTier[] = ["light", "moderate", "heavy", "severe", "mortal"]` (index = severity, for shifting/comparing).
- `escalateForHp(tier: FatigueTier, currentHp: number, maxHp: number): FatigueTier` — ≤50% → shift +1, ≤25% → shift +2 (clamped at `"mortal"`).
- `escalateForSp(tier: FatigueTier, currentSp: number, maxSp: number): FatigueTier` — spent fraction `1 - currentSp/maxSp` (counted **before** this cast's own cost is deducted — the caller passes pre-cast `current`); ≥50% spent → shift +1, ≥75% spent → shift +2 (clamped at `"mortal"`).
- `applyExistingFatigueStacking(newTier: FatigueTier, currentTier: FatigueTier | null): FatigueTier` — if `currentTier` is `"moderate"`/`"heavy"`/`"severe"`, shift `newTier` up by 1/2/3 respectively (clamped at `"mortal"`), then return whichever of the shifted `newTier` and `currentTier` is worse (`null`/`"light"` current never shifts anything).
- `resolveCastFatigue(input: { casterLevel, spellLevel, currentHp, maxHp, currentSp, maxSp, currentTier }): FatigueTier` — composes the four functions above in the book's own order (base → HP → SP → existing-fatigue stacking) into the single tier a cast resolves to.
- Per-tier combat data: `FATIGUE_ATTACK_PENALTY: Readonly<Record<FatigueTier, number>>` (`{light:0, moderate:-1, heavy:-2, severe:-4, mortal:0}` — mortal is handled by `canAct` blocking the roll entirely, not a numeric penalty) and `FATIGUE_AC_PENALTY: Readonly<Record<FatigueTier, number>>` (`{light:0, moderate:0, heavy:1, severe:3, mortal:0}`, same sign convention as `proneArmorClassPenalty`).
- `fatigueMovementRate(tier: FatigueTier, currentRate: number): number` — light/moderate/heavy apply a multiplier (`0.75`/`0.5`/`0.25`, floored, matching `CATEGORY_RATE`'s own `Math.floor` convention in `core/encumbrance/movement.ts`); severe returns the flat rate `1` regardless of `currentRate` (the book's own wording — not a multiplier of the input); mortal returns `0`. A function rather than a lookup table precisely because severe/mortal are flat overrides, not multipliers.
- `FATIGUE_RECOVERY_INTERVAL: Readonly<Record<FatigueTier, "round" | "turn" | "hour">>` (`{light:"round", moderate:"round", heavy:"turn", severe:"hour", mortal:"hour"}` — mortal has no recovery path of its own per the book, this entry exists only so the type is total; the Recover action is never offered while mortally fatigued, since that tier resolves immediately via the save-or-die, not a rest cycle) — used only for the hint text (§2's honor-system decision), not for any timing enforcement.
- `nextTierDown(tier: FatigueTier): FatigueTier | null` — `null` means "fatigue clears entirely" (dropping below `"light"`).

### 4.3 Schema

`base-actor.ts`'s `wizard` spellcasting SchemaField gains one new sibling field, alongside `channelling`:
```
fatigueSaveBonus: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
```
Persisted exactly like `channelling.current` — never touched by `prepareDerivedData`; reset to 0 on a successful recovery save, incremented by 1 on a failed one.

`src/conditions.ts`'s `CONDITIONS` array gains 5 entries, each a bundled Foundry `icons/svg/*` path (same convention as every existing entry — reuse across entries is already accepted practice here, e.g. `held`/`entangled` both already use `net.svg`):

| id | name | img |
|---|---|---|
| `lightFatigue` | Lightly Fatigued | `icons/svg/degen.svg` |
| `moderateFatigue` | Moderately Fatigued | `icons/svg/downgrade.svg` |
| `heavyFatigue` | Heavily Fatigued | `icons/svg/stoned.svg` |
| `severeFatigue` | Severely Fatigued | `icons/svg/frozen.svg` |
| `mortalFatigue` | Mortally Fatigued | `icons/svg/death-hand.svg` |

The `conditions` compendium pack gains 5 matching source documents, drift-tested against the array exactly as the existing 15 already are.

### 4.4 Combat-penalty wiring (`src/combat/condition-effects.ts`)

Two new exported functions, same shape as the file's existing four:
```typescript
export function fatigueAttackPenalty(actorStatuses: StatusSet): number { ... }
export function fatigueArmorClassPenalty(actorStatuses: StatusSet): number { ... }
```
Each walks the 5 fatigue status ids (at most one is ever present) and looks up `FATIGUE_ATTACK_PENALTY`/`FATIGUE_AC_PENALTY`. `canAct` gains `!has(actorStatuses, "mortalFatigue")` as a third exclusion. Both `src/sheets/character/combat-rolls.ts` and `src/sheets/creature/combat-rolls.ts`'s existing `situationalModifier` sums gain `+ fatigueAttackPenalty(actor.statuses)`; `proneArmorClassPenalty`'s call sites (reading the *target's* AC) are joined by `+ fatigueArmorClassPenalty(targetStatuses)`. Both files get the wiring even though only PC/Character-NPC wizards can ever *become* fatigued through gameplay (§2) — this matches the existing, already-established precedent that every condition's mechanical effect is universal across actor types (a GM can manually toggle any condition, including a new fatigue tier, onto any token via the Token HUD, and `blinded`/`prone`/`held`/`stunned` already apply their penalties identically regardless of sheet type), not something this plan invents just for fatigue.

### 4.5 Cast-time fatigue application (`spell-actions.ts` / `casting-actions.ts`)

A new helper, co-located with Task 4's existing `tryChannellingSpend` in `spell-actions.ts`:
```typescript
export async function applyCastFatigue(actor: SpellcasterActor & CastingActorLike, spellLevel: number): Promise<void>
```
reads `channellerFatigueEnabled(getOptionalRules())`, the actor's current HP/max, current/max SP (**before** this cast's cost was deducted — called with the pre-deduction values the three cast-site call sites already have in scope), caster level, and current fatigue tier (from `actor.statuses`); calls `resolveCastFatigue`; if the result differs from the current tier, clears every other fatigue status and applies the new one via `toggleStatusEffect`. If the resolved tier is `"mortal"`, immediately rolls the save-or-die (§4.6) instead of just toggling the condition. Called from `castSpell`, `castFreeMagick`, and `castOrBegin`'s begin-branch, right after each one's existing `tryChannellingSpend`/pool-write succeeds — the same three sites Plan B's final-review fix wave already touched for the analogous reason.

### 4.6 Save-driven state machines (new `src/sheets/character/fatigue-actions.ts`)

- `rollParalyzationSave(actor, bonus: number): Promise<boolean>` — a small, direct helper (not `combat-rolls.ts`'s `rollSave`, per §1.2): rolls `1d20 + bonus` against the actor's cached `system.saves.ppd.target`, posts a chat card for transparency, and **returns the boolean result synchronously** to its caller.
- `resolveMortalFatigue(actor): Promise<void>` — called by `applyCastFatigue` when the resolved tier is `"mortal"`: rolls the save (bonus 0, per the book — no bonus is specified for this roll), and on failure sets HP to 0 + applies `dead`; on success applies `unconscious` + sets the condition to `severeFatigue` (not `mortalFatigue`).
- `recoverFromFatigue(actor): Promise<void>` — the Recover-from-Fatigue sheet action: no-ops with a warning if not currently fatigued or the rule is off; otherwise rolls `rollParalyzationSave(actor, actor.system.spellcasting.wizard.fatigueSaveBonus)`; on success, drops to `nextTierDown(currentTier)` (clearing the condition entirely if that's `null`) and resets `fatigueSaveBonus` to 0; on failure, increments `fatigueSaveBonus` by 1.

### 4.7 Sheet

`sheet.ts` reads the actor's current fatigue tier (if any) from `actor.statuses` and threads it into `CharacterSheetInput` as `fatigueTier: FatigueTier | null`, the same pattern `castingStatus` already uses. `context.ts`'s `buildVitals` applies `fatigueMovementRate(tier, a.movement.current)` on top of the existing (encumbrance-adjusted) rate when `fatigueTier` is non-null, and exposes a `fatigue: { tier, recoveryIntervalLabel } | null` block the template renders as a small badge near the existing casting/HP badges, with a "Recover from Fatigue" button (`data-action="recoverFromFatigue"`) shown only while fatigued and `channellerFatigueEnabled`.

---

## 5. Error handling

- Casting while `channellerFatigueEnabled` is false → `applyCastFatigue` no-ops entirely (no condition ever applied) — a GM can disable the risk layer without touching Plan B's own cast/spend logic.
- Clicking Recover-from-Fatigue while not fatigued, or while the rule is off → warning toast, no roll, no state change.
- A failed mortal-fatigue save → HP forced to 0 and `dead` applied even if the actor somehow already has other conditions (e.g., already prone) — those are left untouched; fatigue only ever manages the 5 fatigue-tier ids and, on the mortal path, `dead`/`unconscious`.
- Two different cast call sites resolving fatigue "simultaneously" is not a real race in this single-player-action model — exactly as Plan B's own `castSpell`/`castOrBegin` are never both in flight for the same actor at once (SP9's `readCasting` busy-check already prevents a second cast beginning while one is pending).

## 6. Testing

**Pure:** `baseFatigueTier` across every one of the 12 bands' full 9-spell-level mapping (transcribed in §4.2, re-derived independently from the book's table during test-writing, not copy-pasted from the implementation); `escalateForHp`/`escalateForSp` at both their 50%/25% (HP) and 50%/75% (SP) boundaries, including the "the shift cannot exceed mortal" clamp; `applyExistingFatigueStacking` for all 4 meaningful current-tier inputs (light/moderate/heavy/severe) crossed with a shift that would and wouldn't exceed the character's current tier (verifying "whichever is worse"); `resolveCastFatigue` end-to-end against the book's own Kerian/8th-level-wizard worked examples (p.83); `fatigueMovementRate`/`FATIGUE_ATTACK_PENALTY`/`FATIGUE_AC_PENALTY` at every tier; `nextTierDown` across all 5 tiers including the "drops below light" `null` case; the gate helper's full on/off matrix — 100% coverage.

**Dev world:** rule off = Channellers behaves exactly like Plan B alone, no conditions ever appear; a cast whose base tier plus HP/SP escalation reaches each of the 5 tiers in turn, confirming the correct condition is shown and the correct to-hit/AC/movement penalties apply; existing-fatigue stacking (cast again while already fatigued, confirm the worse-of rule); a mortal-fatigue cast's save — both outcomes (death: HP0+dead; survival: unconscious+severeFatigue); Recover-from-Fatigue across several attempts (confirm the banked bonus increments on failure and resets on success, and the tier actually drops); the Expanded-Casting-Time combat-flow interaction specifically (§3's called-out highest-risk spot, matching the exact gap Plan B's final review found in the sibling mechanic); a Character NPC channeller fatiguing and recovering the same way a PC does; a non-channelling actor (classic wizard, or any non-wizard) never gets a fatigue condition under any circumstance.

## 7. Out of scope

- Priest spell points/channelling/fatigue — depends on priest spell points, not yet built.
- Warlocks and Witches' own fatigue interactions — out of scope since the base system itself is out of scope (Plan B §7).
- A numeric AC penalty for the mortal tier — the book gives none; narrated as "collapsed, defenseless" rather than invented as a number.
- Automatic duration/expiry for the `unconscious` condition applied on a survived mortal-fatigue save — matches this project's existing, already-recorded limitation that all conditions are manually GM-cleared (README "Known backlog items").
- A real-time or turn-counted enforcement of the recovery interval (round/turn/hour) — honor-system, per §2's locked decision.

## 8. Deliverables checklist

- [ ] Plan C: `channellerFatigue` wired into `OptionalRules` + real hint text; pure `channeller-fatigue.ts` (Table 21 bands, escalation, stacking, per-tier penalty/movement/recovery-interval tables, 100% coverage); 5 new `CONDITIONS` entries + compendium pack docs; `fatigueAttackPenalty`/`fatigueArmorClassPenalty` + `canAct`'s mortal exclusion in `condition-effects.ts`; `fatigueSaveBonus` persisted schema field; cast-time fatigue application wired into all 3 cast-site call sites; the two save-driven state machines (mortal save-or-die, Recover-from-Fatigue); sheet badge + Recover button + movement-rate adjustment; whole-branch review; gated dev-world check (including the Expanded Casting Time interaction).
- [ ] README: Sub-project 14 row updated to note Plan C (fatigue) complete; Sub-project 14 now fully done pending only priest spell points/channelling (a separate, not-yet-scoped future plan).
