# AD&D 2E for Foundry VTT — Sub-project 5: Proficiencies & Skills

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-16
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation)
**Sibling specs:** `docs/superpowers/specs/2026-09-09-adnd2e-sp2-character-sheet-design.md` (Sub-project 2 — PC Character Sheet), `docs/superpowers/specs/2026-09-14-adnd2e-sp3-core-combat-design.md` (Sub-project 3 — Core Combat), `docs/superpowers/specs/2026-09-15-adnd2e-sp4-magic-design.md` (Sub-project 4 — Magic)

---

## 1. Context

SP2's Skills tab renders weapon and non-weapon proficiency lists (slots, specialization flag, a simplified check-target number) but is entirely display-only — both `templates/actor/character/skills.hbs`'s panels carry an explicit `{{! SP5 wires the check buttons here }}` seam comment, and `NwpView.checkTarget`'s own doc comment says "display only (checks are SP5)." SP3's `combat-rolls.ts` deliberately left the attack roll's `proficiency` modifier at a hardcoded `0`, noting in its carry-forward: "Proficiency/STR/DEX modifiers are intentionally NOT wired in SP3 — they require the weapon-proficiency-item lookup and ability-mod plumbing SP5 owns." Thief and bard thieving skills (pick pockets, open locks, backstab, etc.) are **completely unwired** — the PHB math (Tables 26-30, 33) exists and is unit-tested in `core/proficiencies/thief-skills.ts`, but nothing anywhere (derive pipeline, actor schema, sheet, chat) reads any of it; there isn't even an actor schema field to hold allocated skill points.

Per the parent spec's sub-project table: "Weapon proficiency slots + specialization, non-weapon proficiency checks."

### 1.1 What already exists (SP5 mostly *wires*, doesn't invent math)

- `src/core/proficiencies/weapon.ts` — `weaponAttackPenalty(nonProficiencyPenalty, mode)`, `weaponSpecializationSlotCost(category)`, `weaponSpecializationEffect(category)` → `{toHit, damage, pointBlankAttackBonus}`, `canWeaponSpecialize({specializationAllowed, isSingleClass})`.
- `src/core/proficiencies/nonweapon.ts` — `CLASS_PROFICIENCY_GROUPS`, `nonweaponSlotCost(baseCost, group, classId)`, `nonweaponCheck(input): {success, autoFail, target, roll}` (target = ability score + check modifier + `(slotsInvested-1)` + situational modifier; natural 20 always auto-fails regardless of target).
- `src/core/proficiencies/thief-skills.ts` — `THIEF_SKILLS`/`THIEF_SKILL_BASE`/`THIEF_RACIAL_ADJUSTMENTS`/`THIEF_DEXTERITY_ADJUSTMENTS`/`THIEF_ARMOR_ADJUSTMENTS` (Tables 26-29), `THIEF_SKILL_POINT_RULES` (`{level1Points:60, pointsPerLevelAfter:30, level1PerSkillCap:30, perLevelPerSkillCap:15, hardCap:95}`), `thiefSkillPointsAvailable(level)`, `thiefSkillBaseScore(skill, {race,dexterity,armor})`, `resolveThiefSkill(skill, {race,dexterity,armor,allocatedPoints})`, `backstabMultiplier(thiefLevel)` (Table 30: ×2/×3/×4/×5), `pickPocketsDetectionThreshold` (GM-only, out of scope — see §7), `BARD_SKILL_BASE`/`BARD_SKILL_POINT_RULES` (`{level1Points:20, pointsPerLevelAfter:15, hardCap:95}` — **no per-skill cap for bards, unlike thieves**), `bardSkillPointsAvailable(level)`, `bardSkillBaseScore(skill, {race,dexterity,armor})`.
- `core/classes/chassis.ts` — `THIEF.thiefSkillAccess` = all 8 `ThiefSkill`s; `BARD.thiefSkillAccess` = the 4-member `BardSkill` subset (`pick-pockets`/`climb-walls`/`detect-noise`/`read-languages`); all 6 other classes `null`. `FIGHTER.weaponSpecializationAllowed = true`; all others `false` (matches `canWeaponSpecialize`'s single-class-fighter-only rule).
- `core/combat/attack.ts`'s `AttackModifierInput.proficiencyModifier` doc comment already specifies the exact contract SP5 fills: *"0 if proficient; class non-proficiency penalty if not; +1 if specialized"* — i.e. `weaponAttackPenalty(...)` result plus `weaponSpecializationEffect(category).toHit` when specialized, summed into one number. `AttackCardContext.modifierBreakdown.proficiency` (in `src/combat/card-types.ts`) is the display slot SP3 already reserved for it.
- `weaponProficiency`/`nonweaponProficiency` Item DataModels (`src/data/item/{weapon-proficiency,nonweapon-proficiency}.ts`) already have `slotsInvested`/`specialized`/`isRacial`/`group`/`modifier`/`governingAbility`. Three schema fields are defined but currently dead (no consumer anywhere): `styleSpecialization`, `masteryTier` (weapon prof), `checkPenalty` (nonweapon prof) — SP5 does not invent behavior for these; they stay dead unless a future sub-project needs them.
- `system.proficiencies.{weapon,nonweapon}.{total,spent,available}` is already derived and cached on the actor (1c.3b). **No per-item derived data exists** (no cached check targets, no specialization gating, no thief-skill percentages).

**Nothing in `core/` constructs a Foundry `Roll`, a `ChatMessage`, or touches `game`/`canvas`/tokens** (parent spec §4.1, unchanged rule). SP5's new work is: (a) a modest amount of new pure math (thief-armor classification, a per-skill allocation-cap check), and (b) the Foundry-layer wiring — real `Roll`s and chat cards for non-weapon checks and thief/bard skill checks, specialization-purchase and skill-point-allocation actions, weapon-proficiency/specialization folded into SP3's existing attack roll, and backstab folded into SP3's existing attack/damage flow.

### 1.2 Two pre-existing gaps this sub-project also closes

1. **Proficiency-item drop has no slot-cost validation.** `src/sheets/character/drop-rules.ts` (SP2) validates only race/class uniqueness — dropping any number of `weaponProficiency`/`nonweaponProficiency` items onto a sheet is currently unlimited, regardless of available slots. SP5 extends drop validation to block a drop that would exceed `system.proficiencies.{weapon,nonweapon}.available`.
2. **`NwpView.checkTarget` under-counts.** The sheet's current display is `ability.score + n.modifier` only — it omits the `(slotsInvested-1)` bonus `nonweaponCheck` actually applies. SP5 fixes the display to match the real formula (situational modifier defaults to 0 for display, since no roll has happened yet).

### 1.3 Platform

Foundry VTT **v14.364**. `fvtt-types` is a wrong v13-beta — **read `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs` source for every Foundry-layer API.** Carried forward from SP3/SP4: any actor/document resolved from data baked into a chat-card button's dataset uses `.uuid` + `fromUuidSync()`, never `.id` + `game.actors.get()`.

---

## 2. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Thrown-weapon specialization | Thrown weapons (`category: "thrown"`) specialize under the melee rule: 2 slots, `+1` to-hit / `+2` damage — matches PHB's actual treatment; `weaponSpecializationEffect`'s existing `"melee"` category is reused for both `"melee"` and `"thrown"` weapon categories. |
| Backstab | In scope. A checkbox/toggle on the attack roll, shown only for a thief-class attacker using a backstab-eligible weapon, that treats the attack as an automatic hit (surprised-target assumption) and multiplies the rolled damage total by `backstabMultiplier(thiefLevel)`. Folds into SP3's existing `rollAttack`/damage-apply flow rather than becoming a new standalone feature. |
| Thief/bard skill-point caps | Thief: BOTH the total budget (`thiefSkillPointsAvailable`) AND the documented per-skill cap (`30` at level 1, `+15`/level after — cumulative, not path-dependent) are enforced. Bard: only the total budget + the flat `95` hard cap — PHB defines no per-skill cap for bards, so none is invented. |
| Skill-point allocation UI | Discrete `+`/`−` action buttons per skill (mirrors SP4a's Memorize/Forget pattern) — the action function re-validates against the remaining pool AND the per-skill cap server-side and toast-warns on a blocked attempt, rather than a raw editable number input with only soft/visual validation. |
| Non-weapon check UI | A "Check" button per proficiency, mirroring SP3's saving-throw roll (no manual-modifier dialog — situational modifier defaults to `0`, matching saves' simplicity rather than attacks' manual-AC-dialog complexity). |
| Thief armor category | **Auto-detected**, not a manual dropdown. `armor` Item's `armorType` field (currently a blank-allowed free string) becomes a real `choices`-constrained enum (`ARMOR_TYPES`, the full 2E PHB armor list — mechanical names only, no rules prose). A new pure classifier maps each `armorType` to either a `ThiefArmor` category or "thief skills disabled." |
| Heavy-armor handling | **True RAW**: `leather`→`leather`, `elven-chain`→`elven-chain`, `padded`/`studded-leather`→the combined `padded-studded` Table 29 row, `none`→`none`; every other (heavier) armor type **disables thief skills entirely** for that character while worn — not just a worse penalty row. This is a real new UI state (Roll buttons disabled, skills shown as unusable), not a fallback table lookup. |

---

## 3. Global Constraints

Copied forward from the parent + sibling specs; every task's requirements implicitly include this section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`. All Foundry-layer code is written against **v14.364** source — never `fvtt-types`.
- **Two-layer contract:** new pure files (`core/proficiencies/*.ts` additions, new `src/combat/*-card.ts` files) import nothing from `foundry`/`game`/`CONFIG`/DOM; gated by `tsconfig.core.json`; ESLint pure-zone; **100% Vitest coverage** (branch ≥ 90). The Foundry shell (sheet action handlers, chat-card templates, `combat-rolls.ts` extensions) is typecheck + build gated only, no unit tests, dev-world verified.
- **The gated-zone config triad** — every new pure file goes in ALL THREE of `tsconfig.core.json` `include`, `vitest.config.ts` `coverage.include`, `eslint.config.js` (both the Foundry-globals `ignores` array and the pure-zone `files` array). `src/combat/**`/`tests/combat/**` are already covered by SP3 — a new file under that same directory needs no NEW triad entries (verify against the real current config content, don't assume).
- **Content policy:** mechanical/UI data only — `ARMOR_TYPES`' 2E armor-type NAMES are factual/mechanical data (same class as `WEAPON_CATEGORIES`), not rulebook prose. No PHB rules text, no flavor text. Chat-card templates carry labels via `{{localize}}` keys.
- **Do NOT run** `npm run format` / `prettier` / `npm install` / `npm update`, and do not touch `package.json` / `package-lock.json` / `node_modules`.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep` (SIGPIPE → false "no tests"). First run after a cache-clear can genuinely flake — rerun 2-3×.
- **Full gate before every commit:** `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run build` requires **Foundry closed**.
- **Dev-world smoke check is GATED** — the user runs it before `finishing-a-development-branch`, never a deferred checklist item.
- **Actor/document resolution from chat-card data uses `.uuid` + `fromUuidSync`, never `.id` + `game.actors.get()`** — applies to every new chat-card button this sub-project adds.
- **A plan touching a shared interface must grep the WHOLE consuming file(s) for every literal of that shape**, not just the ones the current task is adding (lesson from SP4b: a widened `SpellItemView` broke pre-existing test fixtures the task's own brief hadn't anticipated).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## 4. Code architecture

New / changed files (illustrative — the implementation plan nails exact signatures against real source, per this project's established practice):

```
src/core/proficiencies/
  thief-skills.ts           MODIFY (pure) — += ARMOR_TYPES-to-ThiefArmor classifier,
                             += a per-skill allocation-cap check for thieves

src/data/item/
  armor.ts                   MODIFY — armorType becomes choices:-constrained
  choices.ts                 MODIFY — += ARMOR_TYPES (full 2E PHB armor list)

src/data/actor/
  base-actor.ts               MODIFY — new schema: per-character allocated thief/bard
                              skill points (one entry per accessible skill)

src/combat/
  nonweapon-check-card.ts     NEW (pure) — buildNonweaponCheckCardContext()
  thief-skill-card.ts          NEW (pure) — buildThiefSkillCardContext()
  card-types.ts                MODIFY — += the two new card Input/Context shapes;
                              damage-card.ts's Context gains an optional backstab
                              multiplier display field

src/sheets/character/
  combat-rolls.ts              MODIFY — rollAttack folds in weaponAttackPenalty +
                              specialization to-hit bonus (fills the reserved
                              `proficiency` modifier slot); backstab toggle threads
                              through to auto-hit + damage multiplier
  proficiency-actions.ts        NEW — specializeWeapon, rollNonweaponCheck,
                              allocateThiefSkillPoint / deallocateThiefSkillPoint,
                              rollThiefSkill (mirrors spell-actions.ts's shape)
  sheet.ts                     MODIFY — new actions wired; toWeaponProfView/toNwpView
                              placeholder updates
  context.ts / context-types.ts MODIFY — real checkTarget formula; specialization
                              eligibility; thief/bard skill rows (base score,
                              allocated points, remaining pool, roll eligibility,
                              armor-disabled state)
  drop-rules.ts                MODIFY — slot-cost validation on proficiency-item drop

src/chat/
  chat-listeners.ts             MODIFY — no new hook registration needed (existing
                              renderChatMessageHTML hook), but may gain a button
                              handler if any new chat card needs a post-roll action
                              (none currently anticipated — non-weapon/thief-skill
                              checks are single-roll, no follow-up button)

templates/chat/
  nonweapon-check-roll.hbs      NEW
  thief-skill-roll.hbs           NEW

templates/actor/character/
  skills.hbs                    MODIFY — fills both `{{! SP5 wires ... }}` seams,
                              adds a new thief/bard-skills section
  combat.hbs                    MODIFY — backstab toggle on the attack-roll row

lang/en.json                   MODIFY — ADND2E.sheet.skills.* / ADND2E.chat.nwpCheck.* /
                              ADND2E.chat.thiefSkill.* trees

tests/core/proficiencies/
  thief-skills.test.ts          MODIFY — new classifier + allocation-cap coverage
tests/combat/
  nonweapon-check-card.test.ts   NEW
  thief-skill-card.test.ts        NEW
```

### 4.1 Pure layer additions

**Thief-armor classification** (`core/proficiencies/thief-skills.ts`):

```ts
export type ArmorType =
  | "none" | "padded" | "leather" | "studded-leather" | "ring-mail" | "scale-mail"
  | "chain-mail" | "elven-chain" | "splint-mail" | "banded-mail" | "plate-mail"
  | "field-plate" | "full-plate";

export type ThiefArmorClassification =
  | { disabled: false; category: ThiefArmor }
  | { disabled: true };

/** Maps a worn armor type to its Table 29 category, or flags that thief skills
 *  are unusable in it entirely (PHB p.38: a thief in armor heavier than
 *  leather/elven chain/padded/studded loses all thieving abilities). */
export function classifyThiefArmor(armorType: ArmorType): ThiefArmorClassification;
```

**Per-skill allocation cap** (thief only — bard has none per §2):

```ts
/** The cumulative cap on points allocated to ONE thief skill by `level`
 *  (30 at level 1, +15/level after — PHB p.39, not enforced by
 *  `resolveThiefSkill` itself). */
export function thiefSkillPerSkillCap(level: number): number;
```

### 4.2 Foundry shell — weapon proficiency in the attack flow

`combat-rolls.ts`'s `rollAttack` currently calls `attackModifiers({weaponMagicBonus: ...})` only. SP5 resolves the attacking weapon's proficiency mode (proficient/related/non-proficient — by matching the weapon against the actor's `weaponProficiency` items, by name or group membership) and specialization state, then passes `proficiencyModifier: weaponAttackPenalty(chassis.nonProficiencyPenalty, mode) + (specialized ? weaponSpecializationEffect(category).toHit : 0)`. The existing `AttackCardContext.modifierBreakdown.proficiency` display slot lights up with a real, non-zero value for the first time.

### 4.3 Foundry shell — backstab

A checkbox on the attack-roll UI (thief attacker + eligible weapon only — 2E restricts backstab to piercing/edged melee weapons, matching the weapon's existing `category`). When checked: the attack roll auto-succeeds (no d20 needed, matching the surprised-target assumption), and the subsequent damage roll's total is multiplied by `backstabMultiplier(thiefLevel)` before display/apply — `damage-card.ts`'s context gains an optional `backstabMultiplier: number | null` field purely for display ("×3 backstab!").

### 4.4 Foundry shell — non-weapon checks & thief/bard skills

Both follow the same `buildXCardContext` → `renderTemplate` → `roll.toMessage` pattern as every prior chat-card roll in this codebase. Thief/bard skill rows additionally carry: base score (`thiefSkillBaseScore`/`bardSkillBaseScore`), allocated points, remaining pool, the armor-disabled state (from `classifyThiefArmor`), and whether the skill is usable yet (`read-languages` requires thief level ≥ 4 per an existing code comment in `thief-skills.ts` — a caller-side gate, not modeled in the pure function itself).

---

## 5. Error handling

- **Specializing an ineligible weapon proficiency** (non-fighter, multi-classed, already specialized, insufficient slots) — the Specialize button is hidden/disabled when ineligible; the action function re-validates and no-ops with a toast if called anyway (stale-button race), matching SP4a's established pattern.
- **Dropping a proficiency item that would exceed available slots** — the drop is rejected with a toast (matching `drop-rules.ts`'s existing race/class rejection UX), not silently truncated.
- **Allocating a thief/bard skill point past the remaining pool or the per-skill cap** — the `+` button is hidden/disabled at either boundary; the action function re-validates and toast-warns on a stale-button race.
- **Rolling a thief skill while armor-disabled** — the Roll button (and the `+`/`−` allocation buttons) are hidden for the whole thief-skills section when `classifyThiefArmor` reports `disabled: true`; a short explanatory line replaces the section ("Thieving skills are unusable in this armor").
- **Backstab on a non-eligible weapon or non-thief attacker** — the checkbox simply doesn't render; no error state needed since it's never reachable.
- **Non-weapon check with no `weaponProficiency`/`nonweaponProficiency` items** — the panel shows the existing empty-state message (already implemented, `ADND2E.sheet.skills.none`), not a new error.

---

## 6. Testing strategy

- **Pure zone** — `classifyThiefArmor` (every `ArmorType`, all 3 boundary categories + the disabled set), `thiefSkillPerSkillCap` (level boundaries), `buildNonweaponCheckCardContext`/`buildThiefSkillCardContext` (success/autoFail/failure branches, armor-disabled display state). 100% coverage, test-first, added to the gated triad.
- **Foundry shell** — no unit tests (parent §9). Manual dev-world exercise, gated before the finish menu:
  1. A fighter with a proficient weapon vs. a non-proficient one: confirm the attack roll's `proficiency` modifier line matches the class's non-proficiency penalty (0 for proficient).
  2. Specialize a fighter's weapon: confirm slots deduct correctly, the `+1`/`+2` (or point-blank `+2`) bonus appears on subsequent attack rolls, and specialization is blocked once already used or on a multi-classed/non-fighter character.
  3. Drop a proficiency item past available slots: confirm it's rejected.
  4. Roll a non-weapon check: confirm the posted target matches `ability + modifier + (slotsInvested-1)`, and a natural 20 always shows as a failure even when the target is high.
  5. On a thief character: allocate skill points up to the per-skill cap, confirm the next `+` is blocked; allocate up to the total pool, confirm all `+`s are blocked; roll a skill and confirm the percentage matches `resolveThiefSkill`'s real computation (base + racial + DEX + armor + allocated, capped at 95).
  6. On a bard character: confirm only the 4-skill subset shows, confirm no per-skill cap blocks a large single allocation (only the total pool does).
  7. Equip the thief in leather → confirm normal thief-skill access; equip in chain mail (or similar heavy armor) → confirm the thief-skills section shows the disabled state and no rolls/allocations are possible.
  8. A thief attacking a backstab-eligible target with the toggle checked: confirm auto-hit and the damage total is multiplied correctly for the thief's level; confirm the toggle doesn't appear for a non-thief or an ineligible weapon.

---

## 7. Scope boundary — what SP5 does NOT include

- **No pick-pockets DETECTION automation.** `pickPocketsDetectionThreshold` is a GM-facing, situational number (whether the victim notices) — it's not a player-facing roll button, and SP5 doesn't build GM-side tooling for it. A GM can still compute it manually via the console/existing pure function.
- **No consequences beyond the roll result.** A failed thief-skill check, a failed non-weapon check, or a caught pickpocket attempt doesn't trigger any automated in-game effect (no forced combat, no alarm, no item loss) — that's narrative/GM territory.
- **No proficiency compendium pack.** The ~70-entry PHB Table 37 non-weapon proficiency master list and any weapon-name-to-category master data remain hand-authored/drag-and-drop, same as SP4's spells — a future content sub-project's job.
- **No ability checks beyond what's already modeled** (`nonweaponCheck` is the only new check type; general open-ended ability checks aren't part of the 2E ruleset this system models).
- **No Combat & Tactics weapon-mastery tiers.** The `weaponProficiency` Item's `masteryTier`/`styleSpecialization` fields stay dead — that's Sub-project 7's territory (Player's Option: Combat & Tactics), not invented here.
- **No multi-weapon-style specialization edge cases** (e.g. specializing in "all daggers" as a group) — specialization requires a single named weapon, matching 2E RAW; group-type weapon proficiencies (`isGroup: true`) are never specialization-eligible.

---

## 8. Deliverables checklist

1. `core/proficiencies/thief-skills.ts` additions (`classifyThiefArmor`, `thiefSkillPerSkillCap`) — pure, 100% tested.
2. `src/combat/{nonweapon-check-card,thief-skill-card}.ts` + `card-types.ts` additions — pure, 100% tested.
3. `armor.ts`/`choices.ts` `ARMOR_TYPES` schema change.
4. New actor schema for allocated thief/bard skill points.
5. `combat-rolls.ts` weapon-proficiency + backstab integration.
6. `proficiency-actions.ts` (specialize/check/allocate/roll) + `sheet.ts` wiring + `skills.hbs`/`combat.hbs` UI + `drop-rules.ts` slot-cost validation.
7. `templates/chat/{nonweapon-check-roll,thief-skill-roll}.hbs` + `lang/en.json` + drift test.
8. Gated dev-world smoke check (§6 above), all steps PASS.

After merge: SP5 complete.
