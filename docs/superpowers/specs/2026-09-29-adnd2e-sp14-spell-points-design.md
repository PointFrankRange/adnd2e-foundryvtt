# AD&D 2E for Foundry VTT — Sub-project 14: Player's Option: Spells & Magic — Wizard Spell Points

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-29
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-15-adnd2e-sp4-magic-design.md` (SP4 magic: the memorize/cast/rest baseline this spec extends), `docs/superpowers/specs/2026-09-24-adnd2e-sp9-casting-time-design.md` (structural precedent: master AND-gate helper, `requiresReload`, the "spec vs plan re-verifies exact numbers" pattern), `docs/superpowers/specs/2026-09-16-adnd2e-sp7-combat-and-tactics-design.md` (tiered-investment precedent for the future Channellers plan)

---

## 1. Context

The 2026-09 reference survey (`docs/mechanics-review-2026-09.md`) covered 16 sourcebooks added to `references/` on 2026-09-26, including *Player's Option: Spells & Magic* — the book Sub-project 9 explicitly could not use ("spell points and channelers come from *Player's Option: Spells & Magic*, which is not in this project's `references/`"). With the book now available, the user chose Spell Points & Channellers as the next sub-project (README row 14).

**Scope decided in brainstorming:** this spec covers **Plan A: Wizard Spell Points only** — the SP pool, fixed/free magick memorization, and the Intelligence bonus-SP table. Priest spell points, overcharging, exceeding the spell-level limit, the three power/time/condition discounts, and Channellers are explicitly deferred (see §7); Channellers becomes **Plan B**, a later plan in this same sub-project, once Plan A's SP pool exists to build on.

### 1.1 Rules source (*Player's Option: Spells & Magic*, pp.70-90, verified in `references/` during brainstorming)

- **The SP pool is additive, not a replacement.** Each wizard gets a total spell-point allowance by level (Table 17: Wizard Spell Point Progression). The classic "max spells of each level that can be memorized" cap stays in force alongside it: *"a 5th-level mage can't memorize more than four spells of any given level... regardless of how many spell points he has available."* Spell points are a second, independent constraint on top of the existing per-level cap, not a substitute for it.
- **Memorizing** a spell spends points from the pool as either a **fixed magick** (locked to one specific spell, the cheaper option) or a **free magick** (reserves a spell *level* rather than a spell; the wizard picks which known spell of that level to cast at the moment of casting; costs more — Table 18: Spell Cost by Level (Wizard)).
- **Casting still wipes the entry from memory**, exactly like the classic rule: *"once the free magick has been used to cast a spell, it is wiped from the wizard's memory, just like a fixed magick."* This is the same behavior this project's existing `expended` flag + rest cycle already models. Spell points change what happens at **memorization** (a cost gate) and, for free magick, add a spell-choice step at **cast** time — they do not change the expend/rest cycle itself.
- **Bonus SP for high Intelligence** (Table 19: Bonus Spell Points for Intelligence) — an Int-keyed additive bonus to a wizard's SP pool, mechanically parallel to the already-implemented Wisdom bonus-spells table for priests.
- **Cantrips** are explicitly "free magicks by definition," costing 1 SP each — out of scope: the current spell schema has no level-0 spells (§7).
- **Overcharging** ("Casting Spells for Greater Effect"), **exceeding the spell-level limit**, and the **three power/time/condition discounts** (reduced power / prolonged casting time / special casting condition) are separate optional add-ons layered on the base spell-point system — out of scope (§7).

### 1.2 What already exists (verified against real current source)

- `src/settings/registry.ts` (lines 45-49) already reserves a `spellPoints` toggle (group `spellsAndMagic`, `optionalRulesKey: null`, currently a no-op) and a `channelers` toggle (same shape). `OptionalRules` (`src/core/options.ts`) does not contain either field yet. Its file-header comment (line 7) currently reads *"`spellsAndMagic.spellPoints` and `.channelers` are registered but not implemented... because this system does not reference [Spells & Magic]"* — that premise is now false; this spec corrects the comment for `spellPoints` (`channelers` stays accurate until Plan B).
- `lang/en.json` (~lines 707-718) hint text for both toggles currently reads "Not implemented — ... this system does not reference" — needs real wording for `spellPoints` once Plan A ships.
- The classic memorize/cast/rest cycle (`src/sheets/character/spell-actions.ts`):
  - `MemorizedEntry` (line 21): `{ spellItemId, spellLevel, expended }`. Two other declarations of the same conceptual shape exist, each exposing only what that layer consumes:
    - DataModel schema (`src/data/actor/base-actor.ts`, `memorizedSchema()`, lines 30-43): `ArrayField<SchemaField{ spellItemId, spellLevel (1-9), expended }>`, with an existing doc comment: *"the slot stays occupied... regardless of expended"* — occupancy (and, from this plan on, SP cost) is driven by presence in the list, not by the `expended` flag.
    - Derive-layer snapshot (`src/data/derive/character/snapshot.ts`, lines 20-24): `{ spellItemId, spellLevel }` only — narrower because `toRecord()` only needs to count occupied slots; a real entry structurally satisfies this on assignment.
  - `memorizeSpell(actor, spellItemId)` (line 131) and `canReMemorize()` (line 101) gate on: not already memorized, a free slot at that level (from the derived `SlotRecord`), and spellbook eligibility.
  - `castSpell(actor, spellItemId)` (line 241): finds the non-expended entry, rolls `automation.damage`/`.healing` (`rollSpellAutomation`, line 176), flips `expended: true`, posts a cast card (`postCastCard`, line 192; `src/magic/cast-card.ts`).
  - `restSpellcasting(actor)` (line 163): clears every `expended` flag; the memorized list itself is untouched.
  - `forgetSpell(actor, spellItemId)` (line 151): removes an entry outright.
- Slot math: `wizardSpellSlots(input: WizardSlotInput): SpellSlots` (`src/core/magic/wizard-slots.ts`, line 22) takes `{ wizardLevel, maxSpellLevelKnown, specialist? }`, returns `{ perLevel, base, bonus, suppressed }` — `perLevel[level].max` is the existing PHB Table 21 per-level cap this plan reuses unchanged as the SP system's count ceiling.
- `deriveSpellSlots(input): { wizard?: SlotRecord; priest?: SlotRecord }` (`src/data/derive/character/slots.ts`, line 37) calls `wizardSpellSlots`/`priestSpellSlots`, then folds `MemorizedEntry[]` into `used` counts via `toRecord()` (lines 22-29) — the natural place a parallel `deriveSpellPoints()` sits alongside.
- Spell item schema (`src/data/item/spell.ts`, lines 7-34): `casterClass, level (1-9), schools, spheres, range, components{v,s,m}, materialComponent, duration, castingTime, areaOfEffect, savingThrow, reversible, automation{damage, healing, effectRefs, targetType}`. No per-spell cost field — spell-point cost is a function of (spell level, magick type), a lookup, not a property of the spell item, so no item-schema change is needed.
- Gate-function precedent: `expandedCastingTimeEnabled(rules)` (`src/core/magic/casting-time.ts`, line 13) is the master-AND-gate pattern (`spellsAndMagicEnabled && expandedCastingTime`) this spec's `spellPointsEnabled(rules)` mirrors exactly.
- Sheet: `templates/actor/pc/spells.hbs` has a wizard-slots panel (lines 3-15, via the `adnd2e.slot-table` partial) and a known-spells panel (lines 26-82) with per-row `learnSpell`/`memorizeSpell`/`forgetSpell`/`castSpell` action buttons, built by `buildSpells()`/`buildSpellRow()` (`src/sheets/character/context.ts`, lines 624/721).

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Scope | Plan A (this spec): **wizard spell points only** — SP pool, fixed/free magick memorization, Intelligence bonus SP. Priest spell points, overcharging, exceed-spell-level-limit, the three discounts, and cantrips are **out of scope** (§7), tracked as backlog. |
| Relationship to existing slots | **Additive, not a replacement.** The existing per-level `SlotRecord.max` (from `wizardSpellSlots`) stays the hard ceiling on how many spells of a level can be memorized; the SP pool is a second, independent constraint `memorizeSpell` must also satisfy. `wizardSpellSlots` itself is unchanged. |
| SP pool storage | **Derived, not persisted.** No new "current SP" field on the actor. Remaining SP = `maxSP(level, intScore) − spentSP(memorized)`, computed the same way `SlotRecord.used` already is — by folding `MemorizedEntry[]` at derive time. "Spent" means "currently committed to memorized entries," mirroring how slot occupancy already ignores `expended`. |
| Casting behavior | **Unchanged.** Casting still flips `expended`; rest still just clears it. Spell points change what happens at *memorization* (a cost gate) and, for free magick, add a spell-choice step at *cast* time — the expend/rest cycle itself does not change. |
| Fixed vs free magick | `MemorizedEntry` gains an optional `magickType: "fixed" \| "free"`. Fixed magick: `spellItemId` set, as today. Free magick: `spellItemId` starts unset; the wizard picks a known spell of that level at the moment of casting (a new choice step inside `castSpell`), and only that resolved choice drives automation/the cast card. Once cast, a free-magick entry is wiped via `expended` the same as any other. |
| Gating | `spellPointsEnabled(rules) = rules.spellsAndMagicEnabled && rules.spellPoints`, a pure helper mirroring `expandedCastingTimeEnabled`. `spellPoints`'s registry descriptor gets a real `optionalRulesKey` (currently `null`) and a field in `OptionalRules`. |
| Reload | `spellPoints` gets `requiresReload: true` (same as `expandedCastingTime`) — it changes prepare-time derived data that feeds sheet display and memorize validation. |
| Toggling mid-campaign | **No migration, no conversion.** Existing `MemorizedEntry` rows have no `magickType`. Once the toggle is on, an entry with no `magickType` is treated as implicitly `"fixed"` for SP-cost purposes. This matches every other `OptionalRules` toggle in this project — none are designed to be flipped mid-session without a GM's deliberate reload. |
| Channellers | **Not in this plan.** Plan B (a later plan in this sub-project, with its own follow-up spec) reuses this plan's `MemorizedEntry`/SP-pool foundation: casting *re-spends* SP instead of expending the entry (capped at 9 casts/level/day per the book) and applies an escalating 5-tier fatigue condition through the existing `CONDITIONS`/`CONFIG.statusEffects` framework (`src/conditions.ts`, the Sub-project 7 pattern). |

---

## 3. Global Constraints

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`; all Foundry-layer code is written against **v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}`) — never `fvtt-types`.
- **Two-layer contract:** new pure logic (the SP tables, cost lookup, `spellPointsSpent`, affordability checks, the gate helper) lives in `src/core/magic/spell-points.ts` — no Foundry imports, **100% Vitest line/statement/function coverage** (branches ≥ 90). Foundry glue (sheet actions, the free-magick cast-time picker, templates) is typecheck/lint gated and dev-world verified.
- **Content policy:** mechanical values only (SP totals by level, costs by spell level, the Int bonus table) — no rules prose, no copied tables beyond the numbers themselves. Page citations in code comments are fine.
- **Table transcription must be re-verified.** The pp.70-90 text layer of the *Spells & Magic* PDF is OCR-degraded in places (poppler's `pdftoppm` isn't installed in this environment; extraction fell back to `pdftotext`, which garbled several digits in Tables 17-19). **The plan must re-verify every SP-table number against a clean read (page-image OCR, or a manual page-by-page check) before transcribing — no number from this spec or `docs/mechanics-review-2026-09.md` may be carried forward unchecked.**
- **Additive schema only — no migration, no version bump:** `memorizedSchema()` gains one new optional field; existing stored entries remain valid as-is (a missing `magickType` reads as `undefined`, treated as fixed per §2).
- **Single gate helper; every consumer re-derives eligibility** from the actor's current state and current settings.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; `npm run build` requires Foundry closed (re-confirm every time); vitest output read via `tail`/redirect, never `| grep`.
- **Mandatory whole-branch review, then a gated dev-world check.**

---

## 4. Code architecture (Plan A)

### 4.1 Settings wiring

`OptionalRules` gains `spellPoints: boolean` (default `false`). The `spellPoints` descriptor in `src/settings/registry.ts` gets `optionalRulesKey: "spellPoints"` and `requiresReload: true` (currently `null`). `lang/en.json`'s hint becomes real (e.g. "Wizards spend a spell-point pool to memorize fixed or free magicks instead of filling flat per-level slots for free."). `src/core/options.ts`'s file-header comment is corrected for `spellPoints`; `channelers` keeps its "not implemented" wording until Plan B.

### 4.2 Pure core (new `src/core/magic/spell-points.ts`)

- `spellPointsEnabled(rules): boolean` — the gate: `rules.spellsAndMagicEnabled && rules.spellPoints`.
- `WIZARD_SPELL_POINT_TABLE: Readonly<Record<number, number>>` — max SP by wizard level (Table 17). *Numbers transcribed by the plan, re-verified per §3.*
- `WIZARD_BONUS_SP_TABLE: Readonly<Record<number, number>>` — additive Intelligence-keyed SP bonus (Table 19), same shape as the existing Wisdom bonus-spells table for priests.
- `MAGICK_COST_TABLE: Readonly<Record<number, { fixed: number; free: number }>>` — cost by spell level (Table 18).
- `wizardSpellPointTotal(wizardLevel, intScore): number` — table lookup plus Int bonus.
- `magickCost(spellLevel, magickType: "fixed" | "free"): number` — table lookup.
- `spellPointsSpent(memorized: readonly { spellLevel: number; magickType?: "fixed" | "free" }[]): number` — sums `magickCost(entry.spellLevel, entry.magickType ?? "fixed")` over every entry, mirroring `toRecord()`'s "count regardless of `expended`."
- `canAffordMemorize(totalSp, spentSp, spellLevel, magickType): boolean`.

### 4.3 Schema

`memorizedSchema()` (`src/data/actor/base-actor.ts`) gains `magickType: new StringField({ required: false, nullable: true, choices: ["fixed", "free"], initial: null })`. Free magick needs "no spell chosen yet" to be representable; the plan decides between a `nullable` `spellItemId` and a documented empty-string sentinel, whichever real v14 `StringField`/`SchemaField` behavior makes cleaner (verified against v14.364 source, not assumed).

### 4.4 Derive

A new `deriveSpellPoints(input: { wizardLevel, intScore, wizardMemorized }): { max: number; spent: number; remaining: number } | undefined` sits alongside `deriveSpellSlots` (`undefined` for a non-wizard actor or when `spellPointsEnabled(rules)` is false — in which case the sheet shows the classic slots panel exactly as today).

### 4.5 Actions (Foundry glue, `spell-actions.ts`)

- `memorizeSpell()`: when the rule is on, additionally checks `canAffordMemorize`; on failure, the same warning-toast pattern used today for "no free slot" now also covers "not enough spell points." Memorizing free magick prompts for a spell **level**, not a spell — a lightweight dialog or an inline picker, whichever fits the sheet's existing interaction pattern (the plan decides).
- `castSpell()`: for an entry with `magickType === "free"` and no spell chosen yet, a spell-choice step (scoped to the wizard's spellbook at that entry's level) runs before `rollSpellAutomation`; the resolved choice drives the cast card and automation. The entry does not need to persist the chosen spell afterward — "once cast, wiped" applies exactly as it does today.

### 4.6 Sheet

`templates/actor/pc/spells.hbs` gains an SP bar (current/max) beside the existing wizard-slots panel, shown only when `spellPointsEnabled`. Free-magick memorized rows display "(any {level}th-level spell)" in place of a spell name until cast. The memorize action for a wizard row gains a fixed/free choice when the rule is active.

---

## 5. Error handling

- Not enough SP to memorize → warning toast, no writes (same shape as today's "no free slot" case).
- Free-magick cast with no eligible known spell of that level left in the spellbook → block the cast with a warning toast; the entry stays memorized (nothing was actually cast, so nothing is wiped).
- Rule turned off after entries exist with `magickType` set → `deriveSpellPoints` returns `undefined`; the classic per-level `SlotRecord` path runs unchanged (a `magickType`/unset-`spellItemId` free-magick entry is simply inert data until the rule is back on).
- An entry with `magickType` unset while the rule is on → treated as fixed magick (§2), never an error.

## 6. Testing

**Pure:** every SP table lookup (boundary levels, an out-of-range level), `spellPointsSpent` (empty list, mixed fixed/free, entries with no `magickType`), `canAffordMemorize` (exact boundary, insufficient), the gate helper (all four on/off combinations of the two settings) — 100% coverage.

**Dev world:** rule off = today's classic slots unchanged; toggling on shows the SP bar; memorizing fixed vs. free magick debits the pool correctly; a free-magick cast prompts a spell choice scoped to the spellbook at that level and posts the right cast card; running out of SP blocks a further memorize even with the level-cap still open; rest clears `expended` without touching the pool or the memorized list.

## 7. Out of scope

- Priest spell points, the minor-sphere cost shift, and orisons (priest cantrips) — a later plan/sub-project.
- Overcharging ("Casting Spells for Greater Effect"), exceeding the spell-level limit, and the three power/time/condition discounts (reduced power / prolonged casting time / special casting condition).
- Cantrips (level-0 spells) — the current spell schema has no level 0; would need its own schema change.
- Channellers (Plan B, later in this sub-project — §2).
- Existing parked items unrelated to this sub-project (condition expiry, etc. — README backlog).

## 8. Deliverables checklist

- [ ] Plan A: `spellPoints` wired into `OptionalRules` + real hint text; pure `spell-points.ts` (tables re-verified against a clean page read, gate, cost/afford functions); `magickType` schema field; `deriveSpellPoints`; memorize/cast action changes (afford check, free-magick level picker, free-magick cast-time spell choice); SP bar + free-magick row display on the PC sheet; whole-branch review; gated dev-world check.
- [ ] README: row 14 → ✅ Complete (Plan A scope) once shipped; Plan B (Channellers) stays tracked separately until its own spec.
