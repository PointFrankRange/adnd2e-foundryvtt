# AD&D 2E for Foundry VTT — Sub-project 14 Plan B: Player's Option: Spells & Magic — Channellers (core mechanic)

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-30
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-29-adnd2e-sp14-spell-points-design.md` (Plan A: the wizard spell-point pool, `MemorizedEntry`, and `magickType` this plan builds on directly), `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` (precedent for splitting one large subsystem across sibling plans, and for the conditions/`CONFIG.statusEffects` framework the future Plan C will use)

---

## 1. Context

Plan A (PR #54, merged 2026-09-30) shipped the wizard spell-point pool: `spellPoints` toggle, Tables 17-19, `magickType: "fixed" | "free"` on `MemorizedEntry`, and the classic memorize/cast/rest cycle re-gated on spell points instead of flat slots. Its own spec explicitly deferred Channellers as "Plan B, a later plan in this same sub-project, once Plan A's SP pool exists to build on" — that foundation now exists.

**Re-verified via a clean page-image read of *Player's Option: Spells & Magic* pp.80-84 (Chapter 6, "Channellers" and "Warlocks and Witches"), not the initial OCR/paraphrase pass** — two corrections to the prior (pre-spec) notes on this feature:

1. **No "9 casts of one level per day" cap for Channellers.** That cap ("the warlock may never cast more than nine spells of any one level in the course of a single day," p.84) is stated for the separate **Warlocks and Witches** optional system, which layers *additional* restrictions (and a corruption mechanic) on top of base Channellers. Plan A's spec §2 conflated the two when scoping ahead; this spec corrects that. Warlocks/Witches are out of scope (§7).
2. **The resource model is not derived-only like Plan A.** For a channeller, the initial spell selection (fixed/free magick) costs nothing from the pool — "while the character may have some spell points 'allocated' or 'tied up' in various fixed and free magicks, this actually makes no difference for a channeller... The initial selection of spells is simply used to create a slate of spell powers that the character can access and to define the cost in spell points for making use of these powers" (p.81). The pool only depletes when a spell is actually **cast**, and recovers gradually over time (Table 20), not via the existing all-at-once `expended`-clearing rest cycle. This requires a genuinely **persisted, stateful current-SP field** — architecturally different from Plan A's `deriveSpellPoints`, which stores nothing (remaining SP is recomputed every prepare from the memorized list).

### 1.1 Rules source (pp.80-82; Tables 17-18 reused unchanged from Plan A, cited here p.78)

**The Channellers mechanic (p.80-81):**
- The wizard gains spell points exactly as in Plan A (Table 17, §1.1 of the Plan A spec), allocates them to fixed or free magicks, and selects specific spells for fixed magicks — "since the wizard takes the time to impress these spells in his mind, it's easier for him to energize them with channelled magic, and thus the spell point cost is lower than free magicks" (p.80, restating Table 18's existing fixed < free cost split — no new cost table).
- "The character may cast any spell that he has available through either a fixed or free magick, except that the magick does not vanish from his memory once he's cast the spell. Instead, the character deducts the number of spell points required to energize the spell from his spell point total. For example, if a mage with 40 spell points has a magic missile memorized, he can cast that magic missile four times if he wants to!" (p.81) — the per-cast cost is the **same** Table 18 number (`magickCost(spellLevel, magickType)`) that Plan A already uses at memorize time; Channellers just moves *when* it's charged.
- **SP-total formula changes** (p.82): "the wizard modifies his spell point total based on his Wisdom and Constitution scores; he may not gain bonus spell points for his Intelligence. The character's hit point adjustment for Constitution and his magical attack adjustment for Wisdom are added to or subtracted from his spell point total. If this lowers a 1st-level character to less than 4 spell points, he ignores the adjustments; all wizards have at least 4 spell points."
  - **Rules ambiguity, resolved in brainstorming:** "magical attack adjustment for Wisdom" is not a table defined anywhere in this sourcebook (confirmed — its table-of-tables lists no such table, and the one other place the phrase appears, p.91, treats it as an already-known quantity rather than defining it). This codebase's only existing Wisdom-derived modifier is `magicalDefenseAdj` (PHB Table 5, `src/core/abilities/wisdom.ts:38`). **Decision: reuse `magicalDefenseAdj` as this term.**
  - Confirmed the floor ("all wizards have at least 4 spell points") is a blanket floor, not a level-1-only special case, by parallel construction with the priest-channeller paragraph (p.93): "If this lowers a 1st-level priest to less than 4 spell points, he ignores the adjustments; all priests have at least 4 spell points" — same "all Xs have at least 4" close in both.
- Recovering spell points: "Since spell points in this system represent magic potential or stamina... expended spell points are naturally recovered as the character's fatigue fades and his strength returns" (p.81) — via Table 20 (§4.4 below), not the existing `restSpellcasting`'s all-at-once `expended` clear.
- **Table 21 (Spell Fatigue) and the fatigue-effects rules that follow it (pp.82-84) are explicitly out of scope for this plan** — a channelling wizard in this plan casts and recovers SP with no fatigue penalty yet. Plan C adds that risk layer (§7).

### 1.2 What already exists (verified against real current source)

- `src/settings/registry.ts:49` — `{ key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null }`, currently a no-op (only `requiresReload` is missing to complete the descriptor).
- `src/core/options.ts:7` — file-header comment: *"`spellsAndMagic.channelers` is registered but not implemented (a later plan in this sub-project — see the Spell Points design spec)"* — this plan corrects it.
- `src/core/magic/spell-points.ts` — Plan A's pure module, all reused unchanged by this plan:
  - `spellPointsEnabled(rules)` (line 20) — the existing master gate this plan's own gate nests under.
  - `wizardRow(wizardLevel)` (line 60, not exported) / `wizardMaxSpellLevel` (line 72) / `wizardMaxPerLevel` (line 78) — Table 17 lookups; a channeller's repertoire caps are unchanged from Plan A (exceeding the spell-level limit is a further optional add-on, p.81, explicitly out of scope here too — §7).
  - `magickCost(spellLevel, magickType)` (line 122) — Table 18; this plan's per-*cast* cost function is this same lookup, called at a new point in the code.
  - `wizardSpellPointTotal(wizardLevel, intScore, specialist)` (line 101) — the Plan A total (Table 17 + specialist bonus + Int bonus). This plan does **not** call this function for a channeller; it computes SP total via a new sibling function with the Con/Wis substitution (§4.2).
- `src/core/abilities/constitution.ts:35-47` — `constitution(score, isWarrior): ConstitutionModifiers` returns `hpAdjustment` (PHB Table 3, already warrior/non-warrior split) — the Constitution term this plan needs is `hpAdjustment` computed with `isWarrior: false` (a wizard is never the warrior HP column).
- `src/core/abilities/wisdom.ts:35-43` — `wisdom(score): WisdomModifiers` returns `magicalDefenseAdj` (PHB Table 5) — the term §1.1 resolves "magical attack adjustment" to.
- `src/data/actor/base-actor.ts`:
  - `memorizedSchema()` (lines 31-45) — `MemorizedEntry`'s schema, unchanged by this plan; a channelling wizard's memorized entries use the same shape (`spellItemId`, `spellLevel`, `expended`, `magickType`) as Plan A. `expended` simply never gets set `true` for a channeller's entries (§4.3).
  - `attributes.hp` schema (lines 137-143): `{ value: NumberField (persisted, initial 0), max: NumberField (initial 0), rolls, temp, nonlethal }` — the exact precedent this plan's new `channelling` schema block follows: `value`/`current` is genuinely persisted and only ever changed by explicit `actor.update` calls (never touched by `prepareDerivedData`); `max` is overwritten every prepare cycle from derived data (line 343: `sys.attributes.hp.max = derived.hpMax`, guarded on `derived.classes.length` — the analogous guard for this plan's `channelling.max` is `channellersEnabled(rules)` for a wizard-progression actor).
  - `spellcasting.wizard.spellPoints: new ObjectField({ required: true, initial: {} })` (line 205) — Plan A's fully-derived, overwritten-every-prepare cache (`applyDerivedFields` line ~375: `sys.spellcasting.wizard.spellPoints = derived.spellPoints.wizard`). This plan's new `channelling.current` is explicitly **not** modeled this way — it must survive `prepareDerivedData` untouched, like `hp.value`.
- `src/sheets/character/spell-actions.ts` — Plan A's Foundry-glue actions, all touched by this plan:
  - `canMemorizeWizardSpellPoints` (line 105) — gates a memorize on Table 17 caps **and** `canAffordMemorize` (the pool-cost check). For a channeller, the pool-cost check must be skipped (§1.1: memorizing costs nothing from the pool) while the Table 17 cap checks stay.
  - `memorizeSpell` (line 153) / `memorizeFreeMagick` (line 366) — write a new `MemorizedEntry`; unchanged in shape, but the eligibility check they call (`canReMemorize` / `canMemorizeWizardSpellPoints`) changes per the point above.
  - `castSpell` (line 264) / `castFreeMagick` (line 401) — currently: find a non-expended entry, roll automation, mark `expended: true`, post the cast card. This plan adds a channelling branch: find *any* matching entry (expended is meaningless for a channeller — never set), check affordability against the *persisted* pool, roll automation, deduct SP via `actor.update`, post the cast card — no `expended` write.
  - `restSpellcasting` (line 186) — clears every `expended` flag; explicitly **unchanged** by this plan (§4.5) — it remains a no-op for a channeller's entries (never expended) and is not how Channellers recover SP.
- Gate-function precedent: `spellPointsEnabled(rules)` (`src/core/magic/spell-points.ts:20`) is the nested master-AND-gate pattern this plan's `channellersEnabled(rules)` extends by one more level: `spellPointsEnabled(rules) && rules.channelers`.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Scope | **Wizard-only.** Priest channelling (p.93) depends on priest spell points, which Plan A didn't build; deferred to a future plan once priest SP exists. Warlocks/Witches (p.83-84, a further layer with its own corruption mechanic) are a separate optional system, out of scope. |
| Plan split | This spec covers **Plan B: the core mechanic only** — toggle, persisted SP pool, spend-per-cast, Table 20 recovery. **Table 21 fatigue (tiers as real conditions, combat penalties, HP/SP-loss escalation, existing-fatigue stacking, save-based fatigue recovery) is Plan C**, a later plan with its own spec, once Plan B's pool exists to hang fatigue off of — same incremental relationship Plan A had to this plan. |
| Correction: no daily cast cap | The "nine spells of one level per day" cap (p.84) is a Warlocks/Witches-only restriction, not a base-Channellers rule (§1.1). Plan A's spec §2 is superseded by this correction. |
| SP-total formula | `channellerMaxSp(wizardLevel, specialist, conHpAdjustment, wisMagicalDefenseAdj)` = Table 17 base + specialist bonus (unchanged from Plan A's `wizardSpellPointTotal`, minus its Intelligence-bonus term) + `conHpAdjustment` (Constitution, `isWarrior: false`) + `wisMagicalDefenseAdj` (Wisdom), floored at 4. |
| "Magical attack adjustment for Wisdom" | Resolved to this codebase's existing `magicalDefenseAdj` (PHB Table 5, `wisdom.ts`) — the only Wisdom-derived modifier that exists here, and the sourcebook defines no separate table for the term it uses (§1.1). |
| Resource model | **Persisted, not derived** — `system.spellcasting.wizard.channelling: { current, max }`, mirroring the existing `hp: { value, max }` pattern exactly. `current` changes only via explicit casts/Recover; `max` is recomputed every `prepareDerivedData` from `channellerMaxSp(...)` and is never itself directly edited by game actions (a GM can still hand-edit it on the sheet the same way `hp.max` is editable, understanding it's overwritten on next prepare). |
| Memorizing cost | **Free.** A channelling wizard's memorize/free-magick-memorize actions skip the pool-affordability check entirely; only the Table 17 max-spell-level/max-per-level caps still gate what can be memorized. |
| Casting cost | Each cast of a memorized entry deducts `magickCost(spellLevel, magickType)` (the same Table 18 number Plan A already computes) from `channelling.current`; the entry is **never** marked `expended`. |
| Recovery | A new "Recover Spell Points" sheet action (shown only when Channellers is active): the player picks an activity type (hard exertion / walking-riding / sitting-resting / sleeping — Table 20) and a duration in hours; SP recovered = `max(flatRatePerHour, round(percentRate × max))` per hour × hours, added to `current`, clamped at `max`. The existing `Rest` action is unchanged — it clears `expended` flags and is a no-op for a channeller's entries. |
| Gating | `channellersEnabled(rules) = spellPointsEnabled(rules) && rules.channelers` — a nested master-AND-gate, one level under Plan A's own gate. `channelers`'s registry descriptor gains `optionalRulesKey: "channelers"` and `requiresReload: true` (currently `null`/absent). |
| Toggling mid-campaign | **No migration.** `channelling.current`/`.max` are new additive schema fields; a pre-existing actor simply gets the schema's `initial` values (`current: 0`, `max: 0` until next prepare recomputes `max`). No conversion between the classic spell-points allocation model and the channelling spend-per-cast model is attempted — flipping the toggle mid-campaign just changes which rules the existing `MemorizedEntry` list is interpreted under, same as every other `OptionalRules` toggle in this project. |

---

## 3. Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`; all Foundry-layer code is written against **v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}`) — never `fvtt-types`.
- **Two-layer contract:** new pure logic (`channellerMaxSp`, `canAffordCast`, the cast-cost deduction arithmetic, `recoverSp`) lives in `src/core/magic/channellers.ts` — no Foundry imports, **100% Vitest line/statement/function coverage** (branches ≥ 90). Foundry glue (the channelling branch in `castSpell`/`castFreeMagick`, the Recover action, the eligibility change in `canMemorizeWizardSpellPoints`, templates) is typecheck/lint gated and dev-world verified.
- **Content policy:** mechanical values only (the Con/Wis SP-total substitution, the floor of 4, Table 20's four activity rates) — no rules prose, no copied tables beyond the numbers themselves. Page citations in code comments are fine.
- **Table data is verified, not OCR-derived.** §1.1's rules text and Table 20's rates (transcribed in §4.4) were re-read directly from rendered page images (pp.80-82) after the project's standing "OCR-degraded first pass" caution (Plan A spec §3) — the plan may transcribe them as given here without re-verification. Table 17-18 numbers are unchanged from Plan A and are not re-verified here.
- **Additive schema only — no migration, no version bump:** `spellcasting.wizard` gains one new nested schema object (`channelling: { current, max }`); no existing field's shape changes. `MemorizedEntry` is untouched (§2).
- **Single gate helper; every consumer re-derives eligibility** from the actor's current state and current settings.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; `npm run build` requires Foundry closed (re-confirm every time); vitest output read via `tail`/redirect, never `| grep`.
- **Mandatory whole-branch review, then a gated dev-world check.**

---

## 4. Code architecture (Plan B)

### 4.1 Settings wiring

`OptionalRules` gains `channelers: boolean` (default `false`). The `channelers` descriptor in `src/settings/registry.ts` gets `optionalRulesKey: "channelers"` and `requiresReload: true` (currently `null`). `lang/en.json`'s hint (currently "Not implemented...") becomes real (e.g. "Wizards spend spell points at the moment they cast, keeping memorized spells indefinitely instead of losing them, but must recover their pool through rest."). `src/core/options.ts`'s file-header comment is corrected: `channelers` moves from "registered but not implemented" to describing Plan B, noting fatigue (Plan C) is still pending.

### 4.2 Pure core (new `src/core/magic/channellers.ts`)

- `channellersEnabled(rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "spellPoints" | "channelers">): boolean` — `spellPointsEnabled(rules) && rules.channelers`.
- `channellerMaxSp(wizardLevel: number, specialist: boolean, conHpAdjustment: number, wisMagicalDefenseAdj: number): number` — Table 17 base + specialist bonus (reusing the same row lookup Plan A's `wizardSpellPointTotal` uses, minus its Intelligence-bonus term) + `conHpAdjustment` + `wisMagicalDefenseAdj`, floored at 4 (`Math.max(4, total)`).
- `canAffordCast(current: number, spellLevel: number, magickType: MagickType): boolean` — `magickCost(spellLevel, magickType) <= current` (imported from `spell-points.ts`, not redefined).
- `spendCastSp(current: number, spellLevel: number, magickType: MagickType): number` — `current - magickCost(spellLevel, magickType)`.
- `ACTIVITY_RECOVERY_RATES: Readonly<Record<ChannellerActivity, { flatPerHour: number; percentPerHour: number }>>` — Table 20: hard exertion `{0, 0}`, walking/riding `{2, 2}`, sitting/resting `{4, 5}`, sleeping `{8, 10}`.
- `recoverSp(current: number, max: number, activity: ChannellerActivity, hours: number): number` — per-hour rate = `Math.max(rates.flatPerHour, Math.round((rates.percentPerHour / 100) * max))`; returns `Math.min(max, current + rate * hours)`.

### 4.3 Schema

`base-actor.ts`'s `spellcasting.wizard` SchemaField gains:

```
channelling: new SchemaField({
  current: new NumberField({ required: true, integer: true, initial: 0 }),
  max: new NumberField({ required: true, integer: true, initial: 0 }),
})
```

`current` is persisted exactly like `hp.value` — never written by `prepareDerivedData`. `max` is overwritten every prepare from derived data, exactly like `hp.max`. `memorizedSchema()` is unchanged (§2).

### 4.4 Derive

`deriveSpellPoints` (Plan A, `src/data/derive/character/...`) or a new sibling function computes `channelling.max` via `channellerMaxSp(...)` whenever `channellersEnabled(rules)` is true for a wizard-progression actor; `applyDerivedFields` writes it to `sys.spellcasting.wizard.channelling.max`, the same assignment pattern as `sys.hp.max` and Plan A's `sys.spellcasting.wizard.spellPoints`. When the rule is off, `max` is simply not recomputed (stays at its last-derived or schema-initial value; the sheet doesn't render the channelling panel in that case, per §4.6, so a stale `max` is inert).

### 4.5 Actions (Foundry glue, `spell-actions.ts`)

- `canMemorizeWizardSpellPoints`: when `channellersEnabled(rules)` is true, skip the `canAffordMemorize` call entirely — only the Table 17 max-spell-level/max-per-level checks apply.
- `castSpell` / `castFreeMagick`: when `channellersEnabled(rules)` is true for the acting wizard, branch to a channelling path — find the matching memorized entry regardless of `expended` (it's never set for a channeller), check `canAffordCast(channelling.current, ...)` (warn-toast + no-op if it fails, same pattern as every other affordability check in this file), roll automation via the existing `rollSpellAutomation`, write `channelling.current` via `spendCastSp`, post the cast card via the existing `postCastCard` — no `expended` write, no removal from the memorized list.
- `restSpellcasting`: unchanged (§2) — continues to clear `expended` flags on both casters; explicitly not the Channellers recovery path.
- New `recoverChannellerSp(actor, activity: ChannellerActivity, hours: number): Promise<void>` — reads `channelling.current`/`.max`, calls `recoverSp`, writes the result back via `actor.update`. No-op with a warning toast if the rule isn't active for this actor (defensive re-check, matching this file's existing pattern).

### 4.6 Sheet

`templates/actor/pc/spells.hbs` gains a channelling SP bar (current/max) in place of Plan A's SP bar when `channellersEnabled` is true (mutually exclusive with Plan A's derived spell-points bar, which continues to show for a `spellPoints`-only, non-channelling wizard). A "Recover" control (activity-type select + hours input + button) appears alongside it. Memorized rows for a channelling wizard show no "expended/cast" visual state change on cast (since the entry never expends) — casting only moves the SP bar.

---

## 5. Error handling

- Casting a channellingly-memorized spell with insufficient `current` SP → blocked with a warning toast, no writes, exactly like every other affordability check in `spell-actions.ts`.
- Memorizing beyond the Table 17 per-level cap or max spell level → blocked exactly as Plan A blocks it today (unchanged — only the *pool*-cost gate is skipped for a channeller, not the repertoire-size gates).
- Recovering with the rule inactive, or for a non-wizard/non-caster actor → no-op with a warning toast.
- Recovering past `max` → clamped, never an error.
- Rule turned off after `channelling.current`/`.max` hold nonzero values → the sheet stops rendering the channelling panel and reverts to Plan A's (or classic slot-based) display; the stored values simply go unused until the rule is back on (same "inert data" story Plan A already established for `magickType` when `spellPoints` is off).

## 6. Testing

**Pure:** `channellerMaxSp` across specialist/non-specialist, every sign of Con/Wis adjustment (positive, negative, zero), and the floor-of-4 boundary (a combination that would drop below 4, and one that lands exactly at 4); `canAffordCast`/`spendCastSp` reusing `magickCost` at each spell level and both magick types; `recoverSp` across all four activity rates, the flat-vs-percent crossover point (verify against the book's own worked example: a 55-max pool sleeping recovers 8/hr, not 5.5 or 6), and the clamp-at-max case; the gate helper (`channellersEnabled`) across all combinations of its three constituent flags — 100% coverage.

**Dev world:** rule off = Plan A's classic spell-points behavior unchanged; toggling `channelers` on (with `spellPoints` already on) shows the channelling SP bar in place of Plan A's bar; memorizing a fixed or free magick costs nothing from the pool (only the Table 17 caps still block); casting the same memorized spell twice in a row correctly drains the pool by `magickCost` each time and the entry stays memorized and castable a third time if SP remains; casting with insufficient SP is blocked with a toast and no state change; the Recover action with each activity type and a range of hours adds the expected amount and clamps at max; turning `channelers` off (leaving `spellPoints` on) reverts the sheet to Plan A's panel with the classic memorize-costs-SP/cast-expends-the-entry behavior.

## 7. Out of scope

- Table 21 fatigue (tiers, combat penalties, HP/SP-loss escalation, existing-fatigue stacking, save-based fatigue recovery) — **Plan C**, a later plan in this sub-project.
- Priest channelling (p.93) — depends on priest spell points, not yet built (a separate future plan).
- Warlocks and Witches (pp.83-84) — a distinct optional system with its own corruption/patron mechanic, layered on top of base Channellers.
- Exceeding the normal spell-level limit and casting for greater effect ("overcharging") when channelling — both explicitly noted in the book (p.81) as further optional add-ons on top of base Channellers, already out of scope for Plan A's classic spell points and staying out of scope here.
- Cantrips (level-0 spells) — unchanged from Plan A's scope note; the spell schema has no level 0.
- Existing parked items unrelated to this sub-project (condition expiry, the specific-weapon-proficiency exact-name-match gap, etc. — README backlog).

## 8. Deliverables checklist

- [ ] Plan B: `channelers` wired into `OptionalRules` + real hint text; pure `channellers.ts` (`channellersEnabled`, `channellerMaxSp`, `canAffordCast`, `spendCastSp`, Table 20 rates, `recoverSp`); `channelling: { current, max }` schema addition; derive wiring for `.max`; memorize/cast action changes (skip pool-cost gate at memorize, spend-without-expending at cast); new Recover action + sheet control; whole-branch review; gated dev-world check.
- [ ] README: Sub-project 14 row updated to note Plan B (core Channellers) complete, Plan C (fatigue) still pending, priest spell points/channelling still pending.
