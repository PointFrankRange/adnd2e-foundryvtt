# SP21 Humanoid Player Races Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `raceId` becomes any slug (the race item is the source of truth, the six PHB code tables stay as defaults behind safe lookups), a nullable `naturalAc` follows the PHBR10 natural-armor rule, and thirty humanoid race items (PHBR10 Table 1 rows) ship in the `races` pack.

**Architecture:** Pure `src/core` changes first (type widening, effective lookup helpers, natural-AC rule, a census test that no code table is indexed directly by race), then the schema and derive wiring (`raceId` slug validation, `naturalAc`, the kit race list), then three batches of pack transcription from the PHBR10 page images, each verified against an independently keyed Table 1 in a pack test, then gates, headless proof, README and the manual checklist.

**Tech Stack:** TypeScript, Foundry VTT v14, vitest, the headless-Foundry harness, JSON pack sources.

**Spec:** `docs/superpowers/specs/2026-10-12-adnd2e-sp21-humanoid-races-design.md`

## Global Constraints

- Source: The Complete Book of Humanoids (PHBR10) `references/PHBR10 - The Complete Book of Humanoids.pdf` — a SCANNED PDF (no text layer; OCR/pdftotext is empty). Read pages as images: `pdftoppm -r 100 -f <pdf page> -l <pdf page> -png "<pdf>" "<scratch dir>/p"` then view the PNG. PDF page = printed page + 1. Render into the scratchpad directory only; commit no page images. **Content policy:** mechanical values only, no rulebook prose; `system.description` stays `""`; feature labels are terse own-wording labels (for example `Flight 36, maneuverability C`).
- Printed pages: Table 1 (level limits) p.9; how-to-read p.15 (natural AC rule); entries — Aarakocra 16, Alaghi 18, Beastman 19, Bugbear 21, Bullywug 22, Centaur 24, Fremlin 25, Giant-kin Firbolg 27, Voadkyn 29, Gnoll 31, Flind 32, Goblin 35, Hobgoblin 36, Kobold 38, Lizard Man 40, Minotaur 42, Mongrelman 43, Ogre/Half-Ogre 46, Ogre Mage 47, Orc/Half-Orc 49, Pixie 51, Satyr 53, Saurial 55, Swanmay 59, Wemic 60; Table 13 multi-class combinations p.119 (rotated page).
- The race ids (slugs) and item names (exact): `aarakocra` "Aarakocra"; `alaghi` "Alaghi"; `beastman` "Beastman"; `bugbear` "Bugbear"; `bullywug` "Bullywug"; `centaur` "Centaur"; `fremlin` "Fremlin"; `giant-kin-firbolg` "Giant-kin, Firbolg"; `giant-kin-voadkyn` "Giant-kin, Voadkyn"; `gnoll` "Gnoll"; `gnoll-flind` "Gnoll, Flind"; `goblin` "Goblin"; `hobgoblin` "Hobgoblin"; `kobold` "Kobold"; `lizard-man` "Lizard Man"; `minotaur` "Minotaur"; `mongrelman` "Mongrelman"; `ogre` "Ogre"; `half-ogre` "Ogre, Half-"; `ogre-mage` "Ogre Mage"; `orc` "Orc"; `half-orc` "Orc, Half-"; `pixie` "Pixie"; `satyr` "Satyr"; `saurial-bladeback` "Saurial, Bladeback"; `saurial-finback` "Saurial, Finback"; `saurial-flyer` "Saurial, Flyer"; `saurial-hornhead` "Saurial, Hornhead"; `swanmay` "Swanmay"; `wemic` "Wemic". Thirty items; the pack grows from 28 to 58.
- Natural AC rule (PHBR10 p.15, a ruling on top of the approved "natural AC" decision): `naturalAc === null` → the armor's AC; armor rated 10 or worse (none) → `naturalAc`; armor rated better than `naturalAc` (a lower number) → the armor's AC; otherwise (armor rated equal or worse, i.e. weaker protection) → `max(-10, naturalAc - 1)`. Book examples: a lizard man (natural AC 5) in studded leather (AC 7) is AC 4; in plate mail (AC 3) is AC 3. The result is the `baseArmorAc` fed to the existing `armorClass()`; Dexterity (not part of the natural AC), shield and magic bonuses apply on top as today.
- Unknown (non-PHB) race ids get safe defaults: no ability adjustments, ability ranges 3-18, zero thief adjustments, no Con-based save bonus, no sleep/charm resistance. A race item's `subrace` block is the race's own layer for a non-PHB `raceId` (abilityAdjustments, abilityRanges, xpModifierPercent, flatSaveBonus); `subrace.id` and `subrace.displayName` stay blank on humanoids.
- Class chassis ids are `fighter, mage, cleric, thief, paladin, ranger, druid, bard, psionicist` (illusionist and other specialists are mage specialists; Table 1 groups: Wr = fighter, ranger, paladin; Wz = mage; Pr = cleric, druid; Rg = thief, bard). **Priest deferral:** where a race's only priest option is a Chapter 3 kit (Shaman, Witch Doctor and the like), give it NO cleric/druid chassis and record the book's limit in `grantedFeatures` as `<Kit> (kit) max level <N>`. Multi-class combinations from Table 13 that contain shaman/witch doctor are dropped; the rest are kept as chassis-id arrays. A dual-class-only or "none" row yields `allowedMulticlass: []`.
- Race entry data to take, per race: ability adjustments; ability min/max for all six abilities; class restrictions table (a class with a number is allowed to that level, `—` is not allowed, `U` unlimited = `null`); natural AC; infravision; XP surcharge (any "experience point" multiplier/penalty stated in the entry, as an integer percent: x2 = +100; none stated = 0); land movement rate (if the entry states one, else 12); size from the stated height/length (small under 4 ft, medium 4-7 ft, large over 7 ft; record this rule in the manifest); languages (as slugs in `bonusLanguages`); special advantages and disadvantages as terse `grantedFeatures` labels (include flight/swim/burrow rates and natural attack damage as labels; not automated).
- Race items follow the shape of `packs/races/_source/elf.json` exactly (`_id`: 16 random alphanumeric characters unique across the pack, `_key`: `!items!<_id>`, `img`: a core `icons/svg/*.svg` path, `system.raceId` = the slug, `system.subrace` carrying the layer; see `packs/races/_source/duergar.json` for a populated layer and `src/data/item/race.ts` for the schema).
- New schema fields have initials and need no migration. Arrays/objects in `initial` MUST be functions (shared-literal gotcha).
- Files may be CRLF: check line endings before any scripted replacement (a `str.replace` on CRLF text silently no-ops); prefer the Edit tool. Write regex-bearing tests with Write/Edit, never a shell heredoc (a `\b` becomes a backspace); after writing run `grep -nP '[\x00-\x08]' <file>` and expect no output.
- Out of scope: Chapter 3 kits, Chapter 4-5 proficiencies, monstrous traits and superstitions, a natural-attack/flight/innate-spell engine, Table 2 humanoid bonus levels, per-race starting proficiency lists, Dark Sun.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Race type widening and the effective lookup helpers

**Files:**
- Modify: `src/core/types.ts` (the `Race` type, ~line 20)
- Modify: `src/core/abilities/racial-adjustments.ts`, `src/core/proficiencies/thief-skills.ts`, `src/core/saves/racial.ts`, `src/core/encumbrance/movement.ts`, `src/core/races/subrace.ts`
- Modify: `src/data/item/choices.ts` (`RACE_IDS` → `PHB_RACE_IDS`), `src/data/item/kit.ts` (the `races` field loses `choices`), `src/data/item/race.ts` (import rename only in this task; `raceId` loses `choices` in Task 2)
- Create: `tests/core/races/effective.test.ts`, `tests/core/races/census.test.ts`
- Modify: tests that import the renamed constant (`tests/data/choices.test.ts`, `tests/packs/content.test.ts`, others found by `npm run typecheck`)

**Interfaces — produces:**
```ts
// src/core/types.ts
export type PhbRace = "human" | "dwarf" | "elf" | "gnome" | "half-elf" | "halfling";
export type Race = string;
// src/core/abilities/racial-adjustments.ts
export function racialAbilityAdjustments(race: Race): Partial<Record<AbilityKey, number>>;   // {} for an unknown race
export function racialAbilityRanges(race: Race): Record<AbilityKey, [number, number]>;       // 3-18 each for an unknown race
// src/core/proficiencies/thief-skills.ts
export function racialThiefAdjustments(race: Race): Readonly<Record<ThiefSkill, number>>;   // all zero for an unknown race
// src/core/saves/racial.ts
export function racialSaveCategories(race: Race): ReadonlySet<SaveCategory | "poison">;      // empty for an unknown race
// src/core/races/slug.ts
export function isRaceSlug(value: unknown): value is string;  // /^[a-z0-9]+(-[a-z0-9]+)*$/, length 1..40
```
The six code tables stay exported (typed `Record<PhbRace, …>`), and `RACE_IDS` becomes `PHB_RACE_IDS: readonly PhbRace[]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/core/races/effective.test.ts` covering, with exact expected values:
- `racialAbilityAdjustments("dwarf")` equals `{ con: 1, cha: -1 }`; `racialAbilityAdjustments("aarakocra")` equals `{}`; and the prototype-name slugs `"constructor"`, `"__proto__"`, `"toString"` also return `{}` (the helper must use an own-property check, not `in`).
- `racialAbilityRanges("elf").dex` equals `[6, 18]`; `racialAbilityRanges("aarakocra")` has every ability `[3, 18]`; prototype-name slugs return the open ranges.
- `racialThiefAdjustments("dwarf")` equals the existing `THIEF_RACIAL_ADJUSTMENTS.dwarf`; an unknown race returns zero for all eight thief skills (`THIEF_SKILLS`).
- `racialSaveCategories("gnome")` equals a set `{rsw, spell}`; `"dwarf"` has `rsw, spell, poison`; an unknown race has size 0.
- `sleepCharmResistance("elf") === 90`, `"half-elf" === 30`, `"ogre-mage" === 0`.
- `effectiveAbilityAdjustments("aarakocra", null)` equals `{}`, `effectiveAbilityAdjustments("aarakocra", { abilityAdjustments: { dex: 1, str: -1 } … })` returns the layer's table (build the layer with `normalizeSubrace`), and `effectiveAbilityRanges("aarakocra", null)` is open 3-18; `effectiveThiefAdjustments("aarakocra", null)` is all zero.
- `applyRacialDeltas({str:10,dex:10,con:10,int:10,wis:10,cha:10}, "aarakocra")` returns the input unchanged; `applyRacialAdjustments(…, "dwarf")` is unchanged from before (copy an existing assertion from `tests/core/abilities/racial-adjustments.test.ts`).
- `isRaceSlug`: true for `"human"`, `"giant-kin-firbolg"`, `"a1"`; false for `""`, `"Half-Ogre"`, `"half_ogre"`, `"-a"`, `"a-"`, `"a--b"`, `" a"`, a 41-character string, `42`, `null`.

Create `tests/core/races/census.test.ts` (use `readdirSync`/`readFileSync` over `src/**/*.ts`, recursively): for each of `RACIAL_ABILITY_ADJUSTMENTS`, `RACIAL_ABILITY_LIMITS`, `THIEF_RACIAL_ADJUSTMENTS`, `RACIAL_SAVE_CATEGORIES`, `BASE_MOVEMENT`, find every occurrence of `<NAME>[` (index access); assert each occurs in exactly one file — the file that defines the helper for it (`racial-adjustments.ts` for the first two, `thief-skills.ts`, `saves/racial.ts`, and `encumbrance/movement.ts` — or no occurrence for `BASE_MOVEMENT`, which is not indexed anywhere) — and exactly once there (inside the helper). The test's failure message names the offending file. Also assert `src/data/item/race.ts` and `src/data/item/kit.ts` do not contain `RACE_IDS` (the old closed list).

Run `npx vitest run tests/core/races` → FAIL.

- [ ] **Step 2: Implement**

`src/core/types.ts`: replace the `Race` union with the two lines above (keep the original doc comment on `PhbRace`; add `/** any race slug: the six PHB races have code tables, every other race carries its own layer (SP21) */` above `Race`).

`src/core/abilities/racial-adjustments.ts`: change the table types to `Record<PhbRace, …>` (import `PhbRace`), then add after `RACIAL_ABILITY_LIMITS`:

```ts
const OPEN_RANGES: Record<AbilityKey, [number, number]> = Object.freeze({
  str: [3, 18], dex: [3, 18], con: [3, 18], int: [3, 18], wis: [3, 18], cha: [3, 18],
}) as Record<AbilityKey, [number, number]>;

const isPhbRace = (race: string): race is PhbRace => Object.prototype.hasOwnProperty.call(RACIAL_ABILITY_ADJUSTMENTS, race);

/** The code-table adjustments of a PHB race; every other race has none of its own (its layer supplies them). */
export function racialAbilityAdjustments(race: Race): Partial<Record<AbilityKey, number>> {
  return isPhbRace(race) ? RACIAL_ABILITY_ADJUSTMENTS[race] : {};
}

/** The code-table min/max of a PHB race; every other race is open 3-18 unless its layer says otherwise. */
export function racialAbilityRanges(race: Race): Record<AbilityKey, [number, number]> {
  return isPhbRace(race) ? RACIAL_ABILITY_LIMITS[race] : OPEN_RANGES;
}
```
and change the two default parameters `RACIAL_ABILITY_ADJUSTMENTS[race]` / `RACIAL_ABILITY_LIMITS[race]` to `racialAbilityAdjustments(race)` / `racialAbilityRanges(race)`.

`src/core/proficiencies/thief-skills.ts`: type `THIEF_RACIAL_ADJUSTMENTS` as `Readonly<Record<PhbRace, …>>`; add `export function racialThiefAdjustments(race: Race)` returning `Object.prototype.hasOwnProperty.call(THIEF_RACIAL_ADJUSTMENTS, race) ? THIEF_RACIAL_ADJUSTMENTS[race as PhbRace] : ZERO_THIEF_ADJUSTMENTS` (a frozen `skillRow(0,0,0,0,0,0,0,0)` constant defined next to the table); replace both `THIEF_RACIAL_ADJUSTMENTS[input.race]` (lines ~128 and ~223) with `racialThiefAdjustments(input.race)`.

`src/core/saves/racial.ts`: type `RACIAL_SAVE_CATEGORIES` as `Record<PhbRace, …>`; add `racialSaveCategories(race: Race)` returning the own-property entry or a shared empty `ReadonlySet`; in `racialSaveBonus` replace `RACIAL_SAVE_CATEGORIES[race]` with `racialSaveCategories(race)`. `sleepCharmResistance` already returns 0 for others — leave it.

`src/core/encumbrance/movement.ts`: type `BASE_MOVEMENT` as `Readonly<Record<PhbRace, number>>` (import `PhbRace`; it is not indexed anywhere).

`src/core/races/subrace.ts`: `effectiveAbilityAdjustments` → `layer?.abilityAdjustments ?? racialAbilityAdjustments(race)`; `effectiveAbilityRanges` → `layer?.abilityRanges ?? racialAbilityRanges(race)`; `effectiveThiefAdjustments` → `layer?.thiefAdjustments ?? racialThiefAdjustments(race)`; update the imports (drop the table imports).

Create `src/core/races/slug.ts`:
```ts
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A race id: lowercase words joined by single hyphens, 1-40 characters. */
export function isRaceSlug(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 40 && SLUG.test(value);
}
```
and `export * from "./slug";` in `src/core/races/index.ts`.

`src/data/item/choices.ts`: rename `RACE_IDS` → `PHB_RACE_IDS` typed `readonly PhbRace[]` (import `PhbRace`). `src/data/item/kit.ts`: remove `RACE_IDS` from the import and drop `choices: RACE_IDS` from `qualifications.races` (keep `blank: false`). `src/data/item/race.ts`: remove `RACE_IDS` from its import now (the `raceId` field keeps a temporary `choices: PHB_RACE_IDS` until Task 2). Fix every other reference reported by `npm run typecheck` / `grep -rn RACE_IDS src tests`; in `tests/data/choices.test.ts` the test becomes `"PHB_RACE_IDS = the 6 PHB races"`; in `tests/packs/content.test.ts` lines ~48 and ~408 import `PHB_RACE_IDS` (the line ~48 assertion that the races pack ids EQUAL the six stays correct until Task 3 changes it; line ~408 (kit qualification races) becomes a slug check using `isRaceSlug`).

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green; 100% statement coverage including `slug.ts` and the new helpers.

```bash
git add -A src tests
git commit -m "feat(races): data-driven race ids with safe effective lookups (#89)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema, kit race slugs, and the natural AC rule

**Files:**
- Modify: `src/data/item/race.ts` (`raceId` slug validation; new `naturalAc`)
- Modify: `src/data/derive/character/snapshot.ts` (`ActorSnapshot.naturalAc`), `src/data/actor/snapshot.ts` (read it from the race item; `RaceItemSystem`), `src/data/derive/character/ac.ts`, `src/data/derive/character/derive.ts` (pass it to `deriveAc`)
- Create: `src/core/combat/natural-ac.ts` + `tests/core/combat/natural-ac.test.ts`; re-export from the `src/core/combat` barrel (check `src/core/combat/index.ts`)
- Modify: the PC sheet AC display (see Step 3) and `lang/en.json`
- Create: `tests/data/derive/natural-ac.test.ts`

**Interfaces:**
- Consumes: Task 1 `isRaceSlug`.
- Produces:
```ts
// src/core/combat/natural-ac.ts
export function effectiveBaseArmorAc(armorAc: number, naturalAc: number | null): number;
// ActorSnapshot (derive/character/snapshot.ts): naturalAc?: number | null   (race item's naturalAc; absent/null = none)
// AcInput (derive/character/ac.ts): naturalAc?: number | null
// RaceItemModel.system.naturalAc: number | null  (integer -10..10, null = none)
```

- [ ] **Step 1: Failing tests**

`tests/core/combat/natural-ac.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { effectiveBaseArmorAc } from "../../../src/core/combat";

describe("effectiveBaseArmorAc (PHBR10 p.15)", () => {
  it("is the armor's AC when the race has no natural AC", () => {
    expect(effectiveBaseArmorAc(7, null)).toBe(7);
    expect(effectiveBaseArmorAc(10, null)).toBe(10);
  });
  it("is the natural AC when no armor is worn", () => {
    expect(effectiveBaseArmorAc(10, 5)).toBe(5);
  });
  it("is the armor's AC when the armor is rated better than the natural AC", () => {
    expect(effectiveBaseArmorAc(3, 5)).toBe(3); // lizard man in plate mail
    expect(effectiveBaseArmorAc(4, 5)).toBe(4);
  });
  it("gives +1 protection when the armor is rated equal or worse than the natural AC", () => {
    expect(effectiveBaseArmorAc(7, 5)).toBe(4); // lizard man in studded leather
    expect(effectiveBaseArmorAc(5, 5)).toBe(4);
  });
  it("never goes below -10", () => {
    expect(effectiveBaseArmorAc(9, -10)).toBe(-10);
  });
});
```
`tests/data/derive/natural-ac.test.ts`: use `deriveAc` directly — natural AC 5, no armor, Dex adj 0 → `normal` 5; natural 5 + studded leather (baseArmorAc 7, magic 0) → 4; plate (3) → 3; natural 5, no armor, `dexDefensiveAdj: -2` → 3; natural 5, no armor, shield bonus 1 → 4 `normal` but `shieldless` 5; natural 5 + armor magic +1 on armor rated 7 → `4 - 1 = 3`; no `naturalAc` field → identical to today's results (copy one assertion from `tests/data/derive/ac.test.ts`). Also add a `deriveCharacter`-level case if an existing test builds a whole snapshot (grep `tests/data/derive` for `naturalAc`-free `deriveCharacter` callers): a snapshot with `naturalAc: 7` and no armor gives `ac.normal === 7`.

- [ ] **Step 2: Implement**

`src/core/combat/natural-ac.ts`:
```ts
// PHBR10 p.15: a race's natural armor class. Armor rated better than it sets the AC; armor rated equal or worse still adds +1 protection.
const AC_BEST = -10;
const NO_ARMOR_AC = 10;

export function effectiveBaseArmorAc(armorAc: number, naturalAc: number | null): number {
  if (naturalAc === null) return armorAc;
  if (armorAc >= NO_ARMOR_AC) return naturalAc;
  if (armorAc < naturalAc) return armorAc;
  return Math.max(AC_BEST, naturalAc - 1);
}
```
`ac.ts`: `const armorAc = input.equippedArmor?.baseArmorAc ?? 10; const baseArmorAc = effectiveBaseArmorAc(armorAc, input.naturalAc ?? null);` and add `naturalAc?: number | null` to `AcInput`. `snapshot.ts` (derive): add `naturalAc?: number | null` to `ActorSnapshot` with a doc comment; `src/data/actor/snapshot.ts`: add `naturalAc?: number | null` to the local `RaceItemSystem` and `naturalAc: raceItem ? ((raceItem.system as RaceItemSystem).naturalAc ?? null) : null` to the returned snapshot; `derive.ts` (~line 185): pass `naturalAc: snapshot.naturalAc ?? null` into `deriveAc({...})`.

`src/data/item/race.ts`: `raceId: new StringField({ required: true, blank: false, initial: "human", validate: (value) => isRaceSlug(value) })` — read `foundry.data.fields.StringField` options in the installed Foundry v14 source (`resources/app/common/data/fields.mjs`, the base `DataField` constructor) to confirm a `validate` option exists and what a boolean-returning function means (a `false` return raises a validation error; `undefined` is treated as pass) and use the form that source documents; remove `choices` and the `PHB_RACE_IDS` import. Add after `infravision`:

```ts
      /** SP21 (PHBR10 p.15): the race's natural armor class; null = none (the PHB races). See effectiveBaseArmorAc. */
      naturalAc: new NumberField({ required: true, nullable: true, integer: true, min: -10, max: 10, initial: null }),
```
Import `isRaceSlug` from `../../core/races/slug` (the file already imports from `../../core/proficiencies/thief-skills`).

- [ ] **Step 3: Sheet display and lang**

Find where the PC/NPC sheets render the Armor Class box (`grep -rn "armor-class\|attributes.ac\|\.ac\." templates/actor/pc templates/actor/character`). Pass a `naturalAcApplies` boolean (the race has a natural AC AND the current base AC came from it, computed in the sheet context from `snapshot`-equivalent data: the race item's `naturalAc !== null`) into the context and, when true, add `title="{{localize 'ADND2E.sheet.ac.natural'}}"` (lang: `"natural": "Includes the race's natural armor class"` under `ADND2E.sheet.ac`, creating `ac` if absent) to the AC box. Keep it minimal: if the box has an existing `title`/tooltip structure, extend that instead. A binding test (or extend an existing sheet binding test) asserts the template contains the lang key and the lang key exists.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add -A src tests templates lang
git commit -m "feat(races): naturalAc on the race item with the PHBR10 armor rule (#89)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pack scaffolding, the Table 1 test, and transcription batch 1

**Batch 1 races (10):** aarakocra, alaghi, beastman, bugbear, bullywug, centaur, fremlin, giant-kin-firbolg, giant-kin-voadkyn, gnoll.

**Files:**
- Create: `tests/packs/humanoid-races.test.ts` (the independently keyed Table 1 and all checks; the test reads items from `packs/races/_source/*.json`)
- Create: ten `packs/races/_source/<slug>.json` items
- Modify: `packs/races/_source/_MANIFEST.md` (PHBR10 page table, the size rule, the class-mapping and priest-deferral notes, the multi-class table note)
- Modify: `tests/packs/content.test.ts` (the races-pack tests: the raceId set is now PHB six plus the humanoid slugs present; the pack count)

**Interfaces — the test file (create first, in this task, complete):**
```ts
// Independently keyed PHBR10 Table 1 (p.9): Wr Wz Pr Rg; "-" = no class of the group, "U" = unlimited
const TABLE_1: Record<string, [string, string, string, string]> = {
  aarakocra: ["11", "-", "7", "11"], alaghi: ["12", "-", "11", "-"], beastman: ["12", "-", "-", "10"],
  bugbear: ["12", "-", "8", "9"], bullywug: ["10", "-", "7", "9"], centaur: ["12", "12", "14", "12"],
  fremlin: ["-", "10", "-", "11"], "giant-kin-firbolg": ["12", "-", "7", "-"], "giant-kin-voadkyn": ["11", "8", "7", "10"],
  gnoll: ["11", "-", "9", "11"], "gnoll-flind": ["12", "-", "9", "11"], goblin: ["10", "-", "9", "12"],
  hobgoblin: ["11", "-", "9", "11"], kobold: ["8", "-", "9", "12"], "lizard-man": ["12", "-", "7", "9"],
  minotaur: ["12", "8", "7", "10"], mongrelman: ["10", "10", "10", "12"], ogre: ["12", "-", "3", "-"],
  "half-ogre": ["12", "-", "4", "-"], "ogre-mage": ["9", "8", "7", "8"], orc: ["10", "-", "9", "11"],
  "half-orc": ["10", "-", "4", "8"], pixie: ["7", "-", "-", "12"], satyr: ["11", "-", "-", "11"],
  "saurial-bladeback": ["9", "9", "U", "9"], "saurial-finback": ["U", "9", "9", "9"],
  "saurial-flyer": ["9", "9", "9", "U"], "saurial-hornhead": ["9", "U", "9", "9"],
  swanmay: ["14", "-", "12", "-"], wemic: ["12", "-", "7", "10"],
};
```
(That is 30 rows. The ogre/half-ogre/half-orc Wr entries marked `*` in the book point at Table 2 bonus levels and keep their printed numbers 12/12/10.) Tests (each guarded with `it.runIf(item)` so only shipped items are checked; the "all thirty exist" assertion is added in Task 5):
1. each shipped humanoid item validates structurally: `system.raceId` equals its slug and the slug passes `isRaceSlug`; `name` equals the name in Global Constraints (keep a `NAMES` map in the test); keys are unique `_id`s; `system.description === ""`; `size ∈ small|medium|large`; `baseMovement` integer 1-30; `infravision` integer >= 0; `naturalAc` null or integer -10..10; `subrace.id === ""` and `subrace.displayName === ""`; `abilityRanges` has all six abilities with `min <= max` within 3-25; `abilityAdjustments` is an object with only the six ability keys; `xpModifierPercent` integer >= -90; every `allowedClasses` entry is in `CLASS_IDS`; every `allowedMulticlass` entry is an array of >= 2 distinct chassis ids each also in `allowedClasses`; every key of `classLevelLimits` is in `allowedClasses` and its value `null` or an integer 1-30; `allowedClasses` equals the keys of `classLevelLimits` as a set.
2. Table 1 agreement: for each group (Wr: fighter, ranger, paladin; Wz: mage; Pr: cleric, druid; Rg: thief, bard) the item's group value is `-` when no class of the group is allowed, `U` when any allowed class of the group has limit `null`, else the maximum of the group's limits; it must equal the TABLE_1 cell, EXCEPT the Pr cell of a race listed in `DEFERRED_PRIEST` (a `string[]` in the test, maintained by the transcribers): for those races the item has no cleric/druid and `grantedFeatures` contains at least one string matching `/\(kit\) max level \d+/`.
3. Chassis-limit sanity: a race's `classLevelLimits` never lists `psionicist` (no humanoid psionicist data in this task) unless the entry explicitly lists Psionicist (then allowed with its limit).
4. Hit-dice/priest deferral negative: no shipped humanoid's `allowedClasses` contains a chassis that has no limit entry; no item names a kit as a class id.

Run `npx vitest run tests/packs/humanoid-races.test.ts` → the structure tests pass vacuously until items exist (this is expected for Step 1); the manifest and content-test edits are made in Step 3.

- [ ] **Step 1: Write the test file** exactly as specified above (use the Write tool; run the control-character grep afterwards).

- [ ] **Step 2: Read the sources and transcribe batch 1**

Render and view each page from the printed-page list in Global Constraints (PDF = printed + 1; render at 100 dpi into `<scratchpad>/h10/`, view with the Read tool). Read Table 1 (p.9) and Table 13 (p.119, rotated: rendering is sideways, rotate mentally or with `pdftoppm -r 100 ... ` then view; the table lists each race's multi-class combinations). For each batch-1 race create `packs/races/_source/<slug>.json` following the elf item shape, taking every field named under "Race entry data to take" in Global Constraints; take `allowedMulticlass` from Table 13 (drop combinations containing shaman or witch doctor; a combination such as `fighter/cleric/thief` becomes `["fighter","cleric","thief"]`; drop a combination whose chassis the race may not take; the race's own priest deferral decides whether cleric combinations survive). Record in the `DEFERRED_PRIEST` array of the test every batch-1 race whose only priest option is a Chapter 3 kit. Where the book is ambiguous or a value is illegible, make the most conservative reading and list it in the report under "Judgement calls" with the printed page. Do not invent values the book does not give: a field the entry does not state takes its documented default (movement 12, XP surcharge 0, natural AC null, bonusLanguages as listed).

- [ ] **Step 3: Manifest and census**

Append to `_MANIFEST.md`: a "PHBR10 humanoid races" section containing the source table (printed page, PDF page, what was read) for every page actually used, the size rule (small under 4 ft, medium 4-7 ft, large over 7 ft), the class-group mapping (Wr/Wz/Pr/Rg to chassis ids), the Chapter 3 priest-kit deferral and the races it affects so far, the Table 13 note (combinations containing shamans or witch doctors are dropped), and a per-race "judgement calls" list. Update `tests/packs/content.test.ts` so the races-pack tests stay correct with the new items present: the raceId-set assertion expects `PHB_RACE_IDS` plus the shipped humanoid slugs (import the slugs from the humanoid test's `TABLE_1` keys is NOT allowed — keep an independent literal list, or assert `PHB_RACE_IDS ⊆ ids` and `ids \ PHB_RACE_IDS` ⊆ the humanoid slug literal list); the subrace-count and naming tests must filter on `subrace.id !== ""` so the humanoids (blank id) do not break them; note any other pack test whose item count changes.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add -A packs tests
git commit -m "feat(races): PHBR10 humanoid races, batch 1 of 3 (#89)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Transcription batch 2

**Batch 2 races (10):** gnoll-flind, goblin, hobgoblin, kobold, lizard-man, minotaur, mongrelman, ogre, half-ogre, ogre-mage.

**Files:**
- Create: ten `packs/races/_source/<slug>.json` items
- Modify: `packs/races/_source/_MANIFEST.md` (extend the PHBR10 section: the pages read and the judgement calls for this batch)
- Modify: `tests/packs/humanoid-races.test.ts` (`DEFERRED_PRIEST` additions only; the TABLE_1 data and checks are NOT edited — if a check fails because the book disagrees with the test's Table 1, STOP and report the discrepancy with the printed page instead of editing the table)
- Modify: `tests/packs/content.test.ts` if a race count/literal list needs the new slugs

- [ ] **Step 1: Transcribe batch 2** exactly as in Task 3 Step 2 (same sources, same rules, same field list, same judgement-call reporting). The Ogre and Half-Ogre entry share printed page 46; Ogre Mage is p.47. Lizard Man's natural AC is 5 (PHBR10 p.15 example) — verify against the entry.

- [ ] **Step 2: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add -A packs tests
git commit -m "feat(races): PHBR10 humanoid races, batch 2 of 3 (#89)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Transcription batch 3 and the full-pack assertions

**Batch 3 races (10):** orc, half-orc, pixie, satyr, saurial-bladeback, saurial-finback, saurial-flyer, saurial-hornhead, swanmay, wemic.

**Files:**
- Create: ten `packs/races/_source/<slug>.json` items
- Modify: `packs/races/_source/_MANIFEST.md` (extend the section; add the final judgement-call list and the deferred-priest race list)
- Modify: `tests/packs/humanoid-races.test.ts` (`DEFERRED_PRIEST` additions; ADD the full-pack assertions below; the TABLE_1 data is not edited)
- Modify: `tests/packs/content.test.ts` (the races pack count 28 → 58 and the final slug literal list)

- [ ] **Step 1: Transcribe batch 3** as in Task 3 Step 2. Orc and Half-Orc share printed page 49; Saurial (all four types) starts on p.55 and runs several pages; the four saurial types are separate items. The Swanmay entry notes only swanmays benefit from raise dead — that is out of scope (not even a label needed). Dual-class-only races (saurial) get `allowedMulticlass: []`; swanmay "none" likewise.

- [ ] **Step 2: Full-pack assertions** — add to `tests/packs/humanoid-races.test.ts` (Write/Edit tool; control-character grep afterwards): all thirty `TABLE_1` slugs have an item (the `it.runIf` guards stay for the per-race tests, but this new test asserts `items.length === 30`); no two humanoids share a name; the races pack contains exactly the six PHB races + the 22 subraces + 30 humanoids (58 items); every `DEFERRED_PRIEST` race has no cleric/druid; every race NOT in `DEFERRED_PRIEST` whose TABLE_1 Pr cell is not `-` has at least one of cleric/druid; every item's `allowedMulticlass` combinations only name classes in its `allowedClasses` (already per race; keep).

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`
Expected: green.

```bash
git add -A packs tests
git commit -m "feat(races): PHBR10 humanoid races, batch 3 of 3; full-pack checks (#89)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Gates, headless proof, README and the manual checklist

**Files:**
- Modify: `README.md` (find the SP21 / "Humanoid" row: `grep -n "SP21\|Humanoid" -i README.md`; mark it `✅ Complete` with a one-paragraph scope in the style of the SP16/SP20 rows)
- Scratch (git-ignored, do NOT commit): `.superpowers/proof/humanoid-races.proof.ts`

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage && npx vite build --outDir "<scratchpad>/build-final"`
Expected: green; 100% statement coverage.

- [ ] **Step 2: Headless proof (best effort)**

Recipe: memory note `foundry-headless-proof-harness`; copy the setup from `.superpowers/proof/gnome-halfling.proof.ts` (it loads real shipped race pack data). Prove with the REAL data models and shipped race JSON:
1. Every one of the 30 humanoid items validates against the real `RaceItemModel.schema` (`raceId` slug validator accepts all 30 slugs and rejects `"Half-Ogre"` and `""`; `naturalAc` null and integers; a bad `naturalAc: 11` is rejected).
2. A character with an aarakocra: real ability-adjustment path (`applyRacialAdjustment`-equivalent via the model) gives Dex +1, Str -1, Con -1; the ability-range warning (`subrace-warning`) fires for an out-of-range score and is silent in range; the level limit for a fighter is 11 (SP13 engine: XP beyond the limit stays capped; with the exceed setting x2 the next level needs twice the gap).
3. Natural AC through the real derive: a lizard man (natural AC 5) unarmored AC 5; studded leather (7) AC 4; plate mail (3) AC 3; with Dex adj and a shield the numbers add as in the unit tests; a PHB elf unchanged (AC 10 unarmored).
4. An unknown homebrew race item (slug `test-race`, a layer with `abilityAdjustments` and `abilityRanges`) loads and derives with no code-table lookups failing (no Con save bonus, no sleep/charm, zero thief adjustments).
5. A kit with `qualifications.races: ["aarakocra"]` drops on an aarakocra character and is refused for a human (the kit qualification path).
6. Render the PC sheet AC box template for a natural-AC race and a PHB race (the title attribute present only for the former).
Report proven and not proven (the real compendium import in a world, real drops, the non-GM seat).

- [ ] **Step 3: README and commit**

```bash
git add README.md
git commit -m "docs: SP21 humanoid races complete (#89)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch (the races compendium rebuilt: it should list 58 items). Offer a console script that creates test characters (a fighter with Strength 16 and a Fighter class item, each given a different humanoid race from the compendium). Reset any setting you change (exceed level limits, racial level limits).
1. The Races compendium lists the PHB races, the 22 subraces and 30 humanoids, sorted sensibly (Aarakocra … Wemic; "Giant-kin, Firbolg", "Saurial, Bladeback" and so on).
2. Drop an Aarakocra on a fighter character: the race shows, Dex +1 / Str -1 / Con -1 adjustments are applied to the ability scores, infravision/size/movement show; an out-of-range score (for example Strength 17) gives the non-blocking range warning toast.
3. Level limit: the Aarakocra fighter's class row is tagged with its limit of 11; give XP beyond the limit: level stays 11; set "exceed level limits" to x2 and see the next level need double the gap; reset the setting.
4. Natural AC: drop a Lizard Man: unarmored AC is 5; equip studded leather: AC 4; equip plate mail: AC 3; the AC box tooltip mentions the natural AC. Equip a shield and check Dex effects add on top.
5. A Satyr (or Pixie) character: a class the race may not take shows the existing class-eligibility warning/refusal (rogue-only and warrior-only races).
6. A kit whose qualifications list a humanoid race: drop it on an eligible and an ineligible character (the existing refusal path).
7. A homebrew race: duplicate a humanoid race item, change its `raceId` slug to a new word (for example `test-race`) and ability adjustments: it works on a character with no errors; entering an invalid slug (`Bad Race`) is refused by the item sheet.
8. A Character NPC and a Monster NPC sheet are unchanged; the PC, NPC and item sheets look normal in both Foundry themes; non-GM seat: repeat 2-4 on an owned character.
9. The races that have no priest class yet (see the manifest) correctly refuse a Cleric/Druid class drop and show the existing restriction message.

---

## Self-Review

- **Spec coverage:** §1 data-driven race identity (type widening, effective lookups with safe defaults, slug validation, kit race list, census) → Tasks 1 and 2; §2 race data and natural AC (the `naturalAc` field, the book rule, all entry fields, class mapping, priest deferral, saves, movement labels) → Tasks 2-5; §3 pack and surface (30 items, names, manifest with page table, census 28 → 58, AC tooltip, lang) → Tasks 2-5; §4 out of scope respected; Testing: effective lookups with unknown races and prototype-name slugs, slug validator, `effectiveBaseArmorAc` cases, census, derive tests, pack tests with an independently keyed Table 1, headless proof, gates and the manual checklist with a non-GM seat → Tasks 1-6. Risks: transcription verified by the independent Table 1 test and per-batch judgement-call reports; the `Race` change is enforced by typecheck plus the census; XP surcharge normalization recorded in the manifest.
- **Ruling recorded:** the natural AC rule follows PHBR10 p.15 (armor rated equal or worse than the natural AC still gives +1) rather than "better of the two"; the spec was updated before this plan.
- **Placeholders:** none in Tasks 1-2's code; Tasks 3-5 are transcription work specified by field list, page list, test table and shape reference, because the values come from page images.
- **Consistency:** `PhbRace`, `Race`, `racialAbilityAdjustments`, `racialAbilityRanges`, `racialThiefAdjustments`, `racialSaveCategories`, `isRaceSlug`, `effectiveBaseArmorAc`, `PHB_RACE_IDS`, the `naturalAc` field name and the thirty slugs match across tasks and the test table.
