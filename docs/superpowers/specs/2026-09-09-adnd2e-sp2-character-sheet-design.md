# AD&D 2E for Foundry VTT — Sub-project 2: PC Character Sheet

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-09
**Author:** Joshua Frank + Claude
**Parent spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` (Sub-project 1 — Foundation; complete, merged through PR #19)

---

## 1. Context

Sub-project 1 delivered the whole data foundation: the framework-free `core/`
rules engine, every Actor/Item/ActiveEffect DataModel, the
`deriveCharacter` / `deriveCreature` pipeline that caches all computed values
onto `system.*` each prepare cycle, the ActiveEffect two-pass, four compendium
packs, the `importContent` API, the migration framework, and a **stub
raw-field sheet** (`src/sheets/raw-field-sheet.ts`) that dumps the schema as
one input per field.

This sub-project replaces that stub with a real, designed **PC character
sheet**. Per the parent spec's sub-project table, SP2 delivers: "ApplicationV2
sheet, tabs, editable fields, class/race as droppable items, multi-/dual-class
handling, XP→level, HP rolling."

### 1.1 Scope decision — shell, not automation

Several later sub-projects wire behaviour *into* the character sheet:

- **SP3 (Core combat)** — attack rolls vs AC, damage, saving throws, initiative
- **SP4 (Magic)** — spellbook, sphere access, memorization slots, cast-from-chat
- **SP5 (Proficiencies & skills)** — weapon specialization, non-weapon
  proficiency checks

**SP2 builds the sheet shell and every passive surface**: all tabs, all
derived/authored display, live authored-field editing, and drag-and-drop
management of race / class / inventory / proficiency / spell / feature items.
**SP2 executes no rolls** — no attack, damage, save, ability-check, or
proficiency-check buttons, and no spell memorization or casting UI. SP3/4/5 add
their controls into the tabs SP2 ships. The Skills and Spells tabs ship as
display-only shells for those sub-projects to fill in.

The one dice roll SP2 *does* perform is **hit-point rolling on level-up**,
which is a data-entry mechanic (roll a hit die, record the result), not a
combat roll.

### 1.2 Platform

Foundry VTT **v14.364** is the installed and verified target. `fvtt-types` pins
a v13-beta and is wrong about several `foundry.applications.*` APIs. **Read
`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`
source for every Foundry-layer API**, never fvtt-types. This is the same rule
the parent spec adopted after 1c.3d; it is a Global Constraint here.

---

## 2. Global Constraints

Copied from the parent spec; every task's requirements implicitly include this
section.

- **Foundry target:** `system.json` stays `minimum: "13"`, `verified: "14"`.
  All Foundry-layer code is written against **v14.364** source. The v13 arm of
  `Adnd2eActor` is code-review-only (parent Ruling FR-3) — SP2 does not add v13
  branches.
- **Two-layer contract:** framework-free logic (here: the render-context
  builder + its helpers) lives in the gated pure zone — no imports from
  `foundry`, `game`, `CONFIG`, or the DOM; gated by `tsc -p tsconfig.core.json`;
  ESLint pure-zone; **100% Vitest coverage**. The Foundry shell (the sheet
  class, templates, drag-drop, Roll wiring) is typecheck + build gated, no unit
  tests, verified in a linked dev world (parent §9).
- **The gated-zone config triad:** any new pure file is added to
  `tsconfig.core.json` `include` **and** `vitest.config.ts` `coverage.include`
  **and** `eslint.config.js` (both the Foundry-globals `ignores` array and the
  pure-zone `files` array).
- **Content policy:** mechanical/factual data only. No rulebook prose, stat
  blocks, spell text, or magic-item text in the repo. Templates carry UI
  labels, not 2E rules text.
- **Do NOT run** `npm run format` / `prettier` / `npm install`. The lint gate
  does not include Prettier.
- **Vitest output:** read with `tail` / `head` / redirect, never `| grep`
  (SIGPIPE → false "no tests"). After clearing `node_modules/.vite` +
  `.vitest` + `.cache`, the first run can genuinely flake "no tests" — rerun
  2–3×.
- **`references/`** (PHB/DMG/MM PDFs) is gitignored — never committed. SP2 needs
  no new table transcription; all mechanics are already in `core/`.
- **Dev-world smoke check** is a GATED step the user runs (the controller
  cannot run Foundry) **before** `finishing-a-development-branch`, never a
  deferred checklist item (parent lesson from 1c.3d / 1c.4a).

---

## 3. Decisions locked in brainstorming

| Decision | Value |
|---|---|
| Sheet scope | Shell + display + item management only. No roll execution; no memorization/casting UI; no proficiency-check UI. |
| Sheet framework | Hand-rolled `ActorSheetV2` + `HandlebarsApplicationMixin` (v14). No sheet helper library. |
| Editing model | Live — `submitOnChange: true`. No Save button. |
| Authored vs derived binding | Authored `<input>`s bind to `document._source`; derived values render from the prepared model (parent 1c.4c "C1" lesson). |
| XP / level | Editable `system.xp` per embedded `class` item; "Award XP" splits evenly across the character's class items. Level + `canLevelUp` come from the engine. |
| HP rolling | Per-class "Roll HP" when `canLevelUp` — real Foundry `Roll` of `1d<hitDie>`, chat message with CON breakdown, raw die result appended to `class` item `hpRolls`. "Take average" alternative. Manual edit of `hpRolls` entries stays possible. |
| Multiclass / dual-class | Engine auto-classifies (`system.multiclass.mode`); sheet shows a badge. One authored toggle marks a 2-class pair as dual-class (sets `dualClassState` `"primary"`/`"active"`; clearing → `null` → multiclass). |
| Containers | No new item type. `equipment.container` + `capacity`; items nest by `location == containerId`. One schema addition: `equipment.contentsWeightMultiplier: number` (default `1`). |
| NPC sheet | The PC sheet is registered for `npc` too (identical schema). SP6 replaces it with the condensed layout. |
| Stub sheet | `RawFieldSheet` stays registered as a selectable, non-default "Raw Fields (debug)" sheet for all types. |
| Tabs | Main / Combat / Inventory / Skills / Spells / Features / Biography (7). |

---

## 4. Code architecture

New / changed files:

```
src/sheets/
  index.ts                  MODIFY — register Adnd2eCharacterSheet as default for
                            character + npc; demote RawFieldSheet to a selectable
                            non-default sheet (relabel "Raw Fields (debug)").
  handlebars.ts             NEW (Foundry shell) — registerSheetPartials() +
                            a small set of Handlebars helpers; called from a
                            `setup` hook in system.ts.
  character/
    context.ts              NEW (PURE, gated) — buildCharacterSheetContext(input)
    context-types.ts        NEW (PURE, gated) — the input + output interfaces
    grouping.ts             NEW (PURE, gated) — item grouping / container nesting
    xp.ts                   NEW (PURE, gated) — xpToNext(), awardXpSplit()
    sheet.ts                NEW (Foundry shell) — Adnd2eCharacterSheet class
    drop.ts                 NEW (Foundry shell) — _onDropItem validation helper
    hp-roll.ts              NEW (Foundry shell) — rollHitPoints(classItem)

src/data/item/
  equipment.ts              MODIFY — add contentsWeightMultiplier: NumberField
                            (required, min 0, initial 1)

src/data/derive/character/
  encumbrance.ts            MODIFY — apply a container's contentsWeightMultiplier
                            to the weight of items located in it
src/data/actor/snapshot.ts  MODIFY — carriedWeight computation honours the
                            multiplier (feeds the existing encumbrance step)

templates/actor/character/
  sheet.hbs  main.hbs  combat.hbs  inventory.hbs  skills.hbs  spells.hbs
  features.hbs  biography.hbs                          NEW
templates/actor/character/partials/
  ability-row.hbs  save-row.hbs  class-row.hbs  item-row.hbs
  slot-table.hbs  encumbrance-gauge.hbs                NEW

styles/
  system.scss               MODIFY — @use "actor/character"
  actor/character.scss       NEW

lang/en.json                 MODIFY — ADND2E.sheet.* label tree (tabs, section
                            headings, button labels, tooltips, dialog strings)

tests/sheets/character/
  context.test.ts  grouping.test.ts  xp.test.ts        NEW

tests/lang/en-coverage.test.ts   MODIFY — drift block for ADND2E.sheet.*
```

### 4.1 The pure render-context layer

`buildCharacterSheetContext(input: CharacterSheetInput): CharacterSheetContext`

**Input** (assembled by `sheet.ts`, all plain data — no Documents):

```ts
interface CharacterSheetInput {
  source: CharacterSource;      // document._source.system + name/img — authored
  derived: CharacterDerivedView; // the prepared system.* — computed values
  classItems: ClassItemView[];   // { id, name, img, chassisId, xp, level,
                                 //   canLevelUp, hitDie, dualClassState,
                                 //   specialistSchool }
  raceItem: RaceItemView | null;
  physicalItems: PhysicalItemView[]; // weapon | armor | equipment, incl.
                                     // container flag, capacity, location,
                                     // totalWeight, equipped, contentsWeightMultiplier
  proficiencyItems: { weapon: ProfView[]; nonweapon: ProfView[] };
  spellItems: SpellItemView[];
  featureItems: FeatureItemView[];
  config: Adnd2eConfig;          // CONFIG.ADND2E — labels only
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}
```

**Output** — one field per template need, already formatted:

```ts
interface CharacterSheetContext {
  identity: {
    classLine: string;          // "Fighter 7 / Mage 6"  |  "Fighter 4 → Mage 5"
    arrangementBadge: string | null; // "multi-class" | "dual-class · Fighter dormant"
    alignmentLabel: string;
    // + raw authored refs for the <input>s (bound to source, not this)
  };
  abilities: AbilityRow[];       // { key, label, score, racialDelta, effectiveScore,
                                 //   exceptional, mods: {label,value}[] }
  vitals: {
    hp: { value: number; max: number; temp: number; nonlethal: number };
    thac0: { base: number; melee: number; ranged: number };
    ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
    saves: SaveRow[];            // { key, label, target, rollModifier, effectiveTarget }
    movement: { base: number; current: number; encumbranceCategory: string };
  };
  classes: ClassRow[];           // { id, name, level, xp, xpToNext, pctToNext,
                                 //   canLevelUp, hitDie, isDualPrimary, isDualActive }
  dualClassToggle: { available: boolean; on: boolean } | null;
  inventory: {
    containers: ContainerGroup[]; // { item, contents: PhysicalItemView[],
                                  //   usedWeight, capacity, overCapacity }
    loose: PhysicalItemView[];
    encumbrance: EncumbranceGauge; // { carried, thresholds, category, pct, penalty }
    currency: { pp; gp; ep; sp; cp };
  };
  combat: { weapons: WeaponLine[]; acBreakdown: AcComponent[] };
  skills: { weapon: ProfBlock; nonweapon: NwpRow[] };
  spells: {
    wizardSlots: SlotRow[] | null; // [{ level, max, used }]
    priestSlots: SlotRow[] | null;
    known: SpellGroup[];           // grouped by level; display + drop only
    specialistSchool: string | null;
  };
  features: { items: FeatureItemView[]; languages: string[]; resources: {...} };
  biography: { html: string; details: DetailRow[]; gmNotesVisible: boolean };
  tabs: TabDescriptor[];          // { id, label, icon, cssClass }
}
```

`grouping.ts` owns container nesting: given the flat `physicalItems`, produce
`containers[]` + `loose[]`, compute each container's `usedWeight`
(`Σ contents.totalWeight`, *before* the multiplier — the multiplier affects
encumbrance, not the displayed pack contents), and flag `overCapacity` when
`usedWeight > capacity` (capacity `null` → no limit).

`xp.ts`:
- `xpToNext(chassisId, xp): { level, next: number | null, pct: number }` — wraps
  `core/classes/progression` `xpForLevel`; `next` is `null` at a class's max
  level.
- `awardXpSplit(total: number, classCount: number): number` — `Math.floor(total
  / classCount)` (2E divides an award evenly among a multiclass character's
  classes; remainder dropped).

All three pure files are Foundry-free and 100%-covered.

### 4.2 The Foundry shell

**`Adnd2eCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2)`**

- `DEFAULT_OPTIONS`: `classes: ["adnd2e", "sheet", "actor", "character"]`,
  `position: { width: 720, height: 800 }`, `window: { resizable: true }`,
  `form: { submitOnChange: true, closeOnSubmit: false }`,
  `actions: { rollHp, awardXp, toggleDualClass, editImage, ... }`.
- `PARTS`: `header` + `tabs` (nav) + one part per tab, each
  `template: "systems/adnd2e/templates/actor/character/<tab>.hbs"`,
  `scrollable: [""]`.
- `static TABS` — the v14 tab-group descriptor (read
  `resources/app/client/applications/api/*.mjs` for the exact
  `_prepareTabs` / `tabGroups` contract; `DocumentSheetV2` handles the nav
  wiring when `TABS` is declared).
- `_prepareContext(options)`:
  1. `const context = await super._prepareContext(options)` — gives
     `context.source`, `context.editable`, `context.document`.
  2. Build `CharacterSheetInput` from `this.document` (prepared, for `derived`),
     `this.document._source` (for `source`), `this.document.items` partitioned
     by `type`, and `CONFIG.ADND2E`.
  3. `context.adnd2e = buildCharacterSheetContext(input)`.
  4. Return.
- `_preparePartContext(partId, context)` — attach the active-tab flag; the tab
  parts read from the single shared `context.adnd2e`.
- **Authored `<input>`s** use `name="system.<path>"` and (for the racially
  adjusted ability score) render `context.source` values, exactly as the SP1
  stub learned to. Derived numbers are plain text from `context.adnd2e`.
- **`_onRender`** — bind the `DragDrop` handler (core `ActorSheetV2._onRender`
  already does this; SP2 keeps `dragSelector: "[data-drag]"` / drop on the
  sheet root), and wire any non-`action` listeners (e.g. the XP inline field
  commit).

**`drop.ts` — `validateItemDrop(actor, item): { ok: boolean; reason?: string }`**
(pure-ish; takes plain data, no I/O): `race` → reject if `actor.items` already
has a `race`; `class` → reject if a `class` item with the same `chassisId`
exists; everything else → allow. `sheet.ts`'s `_onDropItem` calls it, toasts
`reason` on reject, else falls through to the default create.

**`hp-roll.ts` — `rollHitPoints(classItem, { average = false })`**:
- `hitDie` from `getChassis(classItem.system.chassisId).hitDie`.
- `average` → `Math.floor(hitDie / 2) + 1`; else
  `await new Roll("1d" + hitDie).evaluate()`.
- Post a chat message (`ChatMessage.create`) showing the die result and the
  CON hp-adjustment that `characterHpMax` will add (read from
  `actor.system.abilities.con.mods` — display only; the stored value is the
  raw die).
- `await classItem.update({ "system.hpRolls": [...classItem.system.hpRolls, dieResult] })`.
- Guard: only when `classItem.system.canLevelUp`.

**`awardXp` action** — `DialogV2` prompt for an integer; on submit,
`awardXpSplit(amount, classCount)` and `Promise.all` of
`classItem.update({ "system.xp": xp + share })` for each `class` item.

**`toggleDualClass` action** — available only when the actor has exactly 2
`class` items and neither currently has a `dualClassState`. On: set the
**higher-level (abandoned)** class `dualClassState: "primary"`, the
**lower-level (new)** class `"active"` — this matches
`core/classes/multiclass.ts`'s `resolveDualClass` contract exactly:
`primary` is "the abandoned class" (`dormantChassisId: primary.chassisId`)
and `surpassed = active.level > primary.level`, so assigning `primary` to
the lower-level class would make `surpassed` true immediately and resolve
THAC0/saves/HP from the wrong class. Off: set both to `null`. The engine
re-derives the arrangement.

### 4.3 Templates & styles

- `sheet.hbs` — the frame: `<header>` (portrait, name, class line, arrangement
  badge, HP/AC/THAC0 quick strip) + `<nav>` tabs + `<section>` per tab part.
- Per-tab templates consume `context.adnd2e.<section>`; partials
  (`ability-row`, `save-row`, `class-row`, `item-row`, `slot-table`,
  `encumbrance-gauge`) are registered by `registerSheetPartials()` and used
  with `{{> ...}}`.
- Helpers in `handlebars.ts`: keep to a minimum — Foundry v14 ships `eq`,
  `concat`, `numberFormat`, etc. (verify in
  `resources/app/client/applications/handlebars.mjs`). Add only what is missing
  (likely a `pct` bar-width helper and a `signed` number helper).
- `styles/actor/character.scss` — CSS grid; the header strip, a two-column Main
  tab, list rows for the other tabs. Uses `--adnd2e-accent`. No hard-coded
  colours outside a small token block; respects Foundry's light/dark themes.

### 4.4 Schema change — `equipment.contentsWeightMultiplier`

`src/data/item/equipment.ts` gains:

```ts
contentsWeightMultiplier: new NumberField({
  required: true, min: 0, initial: 1,
}),
```

`1` = contents weigh normally (default; every existing item is unaffected —
`initial` fills it). `0` = weightless contents (bag of holding). The
encumbrance path (`snapshot.ts` `carriedWeight` → `core/encumbrance`) multiplies
each item's `totalWeight` by its container's multiplier when the item's
`location` names a container item. Items not in a container use `1`.

No migration entry is required — `MIGRATIONS` stays `[]`; the DataModel
`initial` supplies the field for every pre-existing equipment item on load
(parent §8; the v14 unknown-key pruning gotcha does not apply to *added*
fields).

---

## 5. Data flow

```
user edits an authored field
  → submitOnChange writes document._source.system.<path>
  → Actor#prepareData: prepareBaseData (racial adj) → applyActiveEffects
    → prepareDerivedData → deriveCharacter(snapshotActor(actor)) caches system.*
    → (v14) applyActiveEffects("final")
  → sheet re-renders
  → _prepareContext rebuilds CharacterSheetInput from _source + prepared model
  → buildCharacterSheetContext → context.adnd2e
  → templates render
```

XP / HP / dual-class edits go through `class` **item** updates, which trigger
the same actor re-derive (embedded-document change → parent re-prepare).

---

## 6. Tabs — content specification

### 6.1 Main
Identity block (name, portrait, race name, class line + arrangement badge,
alignment [select], kit, deity, homeland — authored). Ability scores: six rows,
each showing the authored score `<input>`, the racial delta, the effective
score, exceptional-STR percentile `<input>` when `str == 18` and the
`core.exceptionalStrength` toggle is on, and the full `mods` record as read-only
chips. Per-class rows: name, level, `xp` `<input>`, XP-to-next progress bar,
"Roll HP" button (when `canLevelUp`), hit die. Dual-class toggle when
applicable. Derived vitals panel: HP (`value` / `max` / `temp` / `nonlethal`,
`value` and `temp` authored), THAC0 (base/melee/ranged), AC (normal / rear /
surprised / shieldless), the five saves (`effectiveTarget` prominent,
`target` + `rollModifier` secondary), movement + encumbrance category.

### 6.2 Combat
Weapons the character carries: name, proficiency status (proficient / specialist
/ penalty — from matching `weaponProficiency` items), derived to-hit and damage
strings from `toWeaponData` + the character's STR/DEX mods (display only — the
roll buttons are SP3), speed factor, range. AC breakdown: base armour + shield +
magic + DEX, itemised. Armour: each `armor` item with an "equipped" toggle
(authored `system.equipped`); only equipped body armour + shield feed AC.

### 6.3 Inventory
All `weapon` / `armor` / `equipment` items. Containers (`equipment.container`)
render as collapsible groups; items with `location == container.id` nest inside,
with a used-weight / capacity bar and an over-capacity warning. Loose items
listed below. Each row: name, quantity `<input>`, weight, location `<select>`
(none / each container), equipped toggle, magic-bonus badge, identified flag
(GM). Encumbrance gauge: carried weight vs the STR-derived thresholds, current
category, the movement/attack/AC penalties. Currency: five `<input>`s.

### 6.4 Skills (display-only shell — SP5 wires interaction)
Weapon proficiencies: slot totals (`total` / `spent` / `available` from
`system.proficiencies.weapon`), then each `weaponProficiency` item —
weapon-or-group, slots invested, specialized flag. Non-weapon proficiencies:
slot totals, then each `nonweaponProficiency` item — name, governing ability,
modifier, computed check target (`ability score + modifier`, display only),
slots invested. Drag-drop of proficiency items works; **no check buttons**.

### 6.5 Spells (display-only shell — SP4 wires memorization & casting)
Wizard and/or priest slot tables (`system.spellcasting.wizard.slots` /
`.priest.slots` — `{ level: { max, used } }`), rendered when the character has
the corresponding caster class. Specialist school shown when set. Known spells:
`spell` items grouped by `level`, each showing school/sphere, range, casting
time, save. Spellbook membership (`spellcasting.wizard.spellbookItemIds`) shown
as a flag. Drag-drop of `spell` items works; **no memorize / cast buttons, no
slot editing** — SP4 owns all of that.

### 6.6 Features
`classFeature` items grouped by `sourceType` (class / kit / race / other), each
with its description (HTML, may be empty), activation, uses. Racial special
abilities (from the `race` item's `grantedFeatures` / `specialAbilities`).
Languages known (`languagesKnown.max` + a free-text list — authored).
Resources: reputation, henchmen, followers (`system.resources.*` — authored
free text for SP2).

### 6.7 Biography
`system.biography` (HTML editor). `details.*` free-text fields (age, sex,
height, weight, hair/eyes). `details.campaignNotes` (HTML). `details.gmNotes`
(HTML, rendered only when `game.user.isGM`).

---

## 7. Error handling

- **Illegal drop** — `validateItemDrop` rejects; `ui.notifications.warn` names
  the reason (`ADND2E.sheet.drop.duplicateRace` / `.duplicateClass`); no
  document is created.
- **Roll HP when not eligible** — the button is not rendered; the action
  handler also re-checks `canLevelUp` and no-ops with a debug log if somehow
  invoked.
- **Award XP with no class items** — the action is disabled; handler guards.
- **Over-capacity container** — a non-blocking visual warning only; 2E does not
  forbid overpacking, and encumbrance already accounts for the weight.
- **Missing chassis / bad `chassisId`** — the DataModel `choices` constraint
  already prevents this at the source; the context builder treats an unknown
  `chassisId` as a rendering error (empty class row + console warning), never a
  throw.
- **`_source` vs prepared drift** — authored inputs always bind to
  `context.source`; if a derived key and an authored key collide (e.g.
  `system.classes` is derived output, not input), only the authored side is
  ever given an `<input>`. The context builder is the single place this
  separation is enforced.

---

## 8. Testing strategy

- **Pure zone (`context.ts`, `grouping.ts`, `xp.ts`, `context-types.ts`)** —
  Vitest, test-first, **100% coverage**, added to the gated triad. Representative
  assertions:
  - `buildCharacterSheetContext` on a single-class F7 → `identity.classLine ===
    "Fighter 7"`, `vitals.thac0.melee` matches the derived input, seven
    ability rows, five save rows.
  - multiclass F7/M6 → `classLine === "Fighter 7 / Mage 6"`,
    `arrangementBadge` names multi-class, both slot tables present.
  - dual-class F4→M5 → badge names the dormant class; `dualClassToggle.on`.
  - `grouping` — three items, one in a container → one `ContainerGroup` with
    one member + `loose.length === 2`; `overCapacity` true when
    `Σ weight > capacity`.
  - `xpToNext("fighter", 0)` → `{ level: 1, next: 2000, pct: 0 }`;
    at max level → `next: null`.
  - `awardXpSplit(3000, 2) === 1500`; `awardXpSplit(3001, 2) === 1500`.
- **Foundry shell** — no unit tests (parent §9). Manual dev-world exercise,
  gated before the finish menu (§9 below).
- **Lang drift** — `tests/lang/en-coverage.test.ts` gains a block asserting
  every `ADND2E.sheet.*` key the templates reference resolves to a non-empty
  string.
- **CI** unchanged: `typecheck && lint && test && build`.

---

## 9. Dev-world smoke check (GATED — user runs before finishing)

`npm run build && npm run link`, launch v14.364, open a test world.

1. Create a `character`. The new sheet opens as default; all 7 tabs render; no
   console error.
2. Drop **Dwarf** (races pack). Main tab: race shows "Dwarf", CON row shows
   `+1` racial delta, effective score updated, save rows reflect the dwarven
   bonus.
3. Drop **Fighter** (classes pack). Class row appears: "Fighter 1", XP `0`,
   hit die d10, "can level up" badge (0 recorded rolls). THAC0 20, saves at
   L1.
4. Edit `system.abilities.str.score` to `17` inline → mods chips + THAC0 melee
   update live, no reload.
5. Set the Fighter's XP to `16000` (L6). Level updates to 6; THAC0/saves/prof
   slots recompute; "can level up" still set (5 rolls owed).
6. Click **Roll HP** five times (or once per owed level). Each posts a chat
   message with die + CON. `hp.max` climbs to a plausible L6 fighter total.
7. **Award XP** → enter `12000` → Fighter XP becomes `28000` (single class,
   full award).
8. Drop **Mage** (classes pack), set its XP so both classes are plausible.
   Main tab badge shows "multi-class"; class line "Fighter 6 / Mage N"; both
   slot tables appear on the Spells tab; HP is the multiclass average.
9. Toggle **dual-class** on (with exactly the 2 classes) → badge switches to
   "dual-class", one class marked dormant; toggle off → back to multi-class.
10. Drop a **weapon** and an **armor** item; equip the armor → AC updates.
    Inventory: create an `equipment` item, set `container: true` and a
    `capacity`; set the weapon's `location` to that container → it nests, the
    capacity bar reflects its weight.
11. Set the container's `contentsWeightMultiplier` to `0` → encumbrance
    "carried" drops by the contained weight; category/penalty update.
12. Drop a **non-weapon proficiency** and a **spell** item → they list on the
    Skills / Spells tabs (no action buttons). Drop a **second Dwarf** → rejected
    with a toast.
13. Biography tab: `gmNotes` visible as GM; confirm it is absent for a
    non-GM (a second client or a temporary permission downgrade).

Any FAIL becomes a fix before the branch finishes.

---

## 10. Scope boundary — what SP2 does NOT include

- **No roll execution** — no attack, damage, saving-throw, ability-check, or
  proficiency-check rolls or chat cards. The Combat / Skills tabs display
  derived numbers only. (SP3, SP5.)
- **No spell memorization or casting UI, no sphere-access editor, no slot
  editing** — the Spells tab is display + `spell`-item drag/drop only. (SP4.)
- **No initiative, no combat-tracker integration.** (SP3.)
- **No condensed NPC sheet** — the PC sheet serves `npc` verbatim in the
  interim. (SP6.)
- **No Player's Option fields** — `options.combatAndTactics` /
  `skillsAndPowers` / `spellsAndMagic` sub-objects stay unrendered. (SP7–9.)
- **No new `container` item type** — the `equipment.container` flag covers it.
- **No character generator / point-buy / level-up wizard** — editing is
  field-by-field; "Award XP" and "Roll HP" are the only guided actions.
- **No compendium prose.** Feature/spell descriptions render whatever HTML the
  item carries (empty by default for packaged content).

---

## 11. Deliverables checklist

1. `src/sheets/character/` — the pure context layer (`context.ts`,
   `context-types.ts`, `grouping.ts`, `xp.ts`) with Vitest suites at 100%.
2. `src/sheets/character/` — the Foundry shell (`sheet.ts`, `drop.ts`,
   `hp-roll.ts`).
3. `src/sheets/handlebars.ts` + `setup`-hook registration.
4. `src/sheets/index.ts` — register `Adnd2eCharacterSheet` default for
   `character` + `npc`; demote `RawFieldSheet`.
5. `templates/actor/character/**` — frame + 7 tab templates + 6 partials.
6. `styles/actor/character.scss` + `system.scss` wiring.
7. `src/data/item/equipment.ts` — `contentsWeightMultiplier`; encumbrance path
   honours it.
8. `lang/en.json` — `ADND2E.sheet.*` tree; drift test.
9. Gated dev-world smoke check (§9), all steps PASS.

After merge: SP2 complete; the raw stub is no longer any actor's default sheet.
