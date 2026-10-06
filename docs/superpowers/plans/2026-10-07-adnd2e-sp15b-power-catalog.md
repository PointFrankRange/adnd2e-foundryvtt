# Sub-project 15 Plan B: The Power Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add every remaining science and devotion of *The Complete Psionics Handbook* (PHBR5) to the `powers` pack (about 100 in total with the 23 already shipped), model power prerequisites (other powers and a minimum level) and enforce them in the learning rules, and add an "Adjust PSPs" control for variable costs.

**Architecture:** The `power` item gains `prerequisites` (names of other powers) and `minLevel`. The pure `canLearn` rule gains two problems, `prerequisite` and `min-level`. The pack gains the rest of the catalog from the book's "Summary of Powers" (pp.125-127, PDF pages 127-130, which gives score, cost, maintenance, range, preparation and area for every power) plus each power's stat block in chapters 3-8 (prerequisites, and the effect text each description is paraphrased from). A small `adjustPsp` action covers variable costs.

**Spec:** `docs/superpowers/specs/2026-10-07-adnd2e-sp15-psionics-design.md` (Plan B section) and the Plan A plan `docs/superpowers/plans/2026-10-07-adnd2e-sp15a-psionics-foundation.md`. This plan is the bounded Plan B design approved in chat on 2026-10-07: full catalog, prerequisites (names + min level), variable costs kept as a note, an Adjust PSPs control.

## Global Constraints

- Every implementer runs `npm run typecheck` (both tsc passes), `npm run lint` and `npm run test:coverage` (100% statements/lines/functions on `src/core/**` and `src/data/derive/**`) before reporting; the controller runs `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR. If the pack build fails on a LevelDB LOCK (Foundry open), say so; never kill Foundry.
- Preserve each file's line endings; plain ASCII only (no em dashes or curly quotes) in source, data and descriptions; valid UTF-8.
- **No object or array literal `initial`** on Foundry fields (use `initial: () => []`).
- Every new user-visible string goes in `lang/en.json` and is asserted in `tests/lang/en-coverage.test.ts`.
- **Descriptions are ONE original sentence in your own words** summarizing the power's effect; never copy or closely paraphrase the book's sentences. No rule numbers that the book does not state.
- Book data comes from the PAGE IMAGES and the PyMuPDF block text (`import pymupdf`; `pdftoppm` is not installed): render with `pymupdf.open(path)[i].get_pixmap(dpi=130).save(...)`. The pre-extracted `references/psionics_full.txt` is column-garbled and must not be used for numbers. PDF page = book page + 3 (book p.125 = PDF page 128 for the Summary of Powers' first page; the Summary spans PDF pages 128-130).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Prerequisites, the learning rules and the Adjust PSPs control

**Files:** `src/data/item/power.ts`, `src/core/psionics/learning.ts`, `src/sheets/character/{psionic-actions.ts,drop-rules.ts,context.ts,context-types.ts,sheet.ts}`, `templates/actor/pc/partials/pc-psionics-panels.hbs`, `lang/en.json`; tests `tests/core/psionics/learning.test.ts`, `tests/sheets/character/{psionic-actions,drop-rules,context}.test.ts`, `tests/data/power-model.test.ts`, `tests/lang/en-coverage.test.ts`, `tests/templates/pc-sheet-bindings.test.ts`.

**Interfaces (Produces):**
- `PowerItemModel` gains `prerequisites: ArrayField(StringField({required:true, blank:false}), {required:true, initial: () => []})` and `minLevel: NumberField({required:true, integer:true, min:0, initial:0})` (0 = no level requirement). Update the source-pinned `power-model` test accordingly.
- `KnownPower` (core) gains `name: string`. `canLearn(known, candidate: { discipline; kind; prerequisites?: readonly string[]; minLevel?: number }, level)` first refuses `min-level` when `minLevel > level`, then `prerequisite` when any listed prerequisite name (case-insensitive, trimmed) is not the name of a known power (defense modes count as known powers by name); the existing checks follow unchanged. `LearnProblem` gains `"prerequisite" | "min-level"`. `canRelearn` is unchanged.
- `drop-rules.ts` `checkPowerDrop` builds `KnownPower` with `name` and passes the candidate's `prerequisites` and `minLevel` (read leniently: a non-array is `[]`, a non-number is 0); `psionic-actions.ts` `knownPowers` and `context.ts` build `KnownPower` with `name` too. New lang keys `ADND2E.sheet.psionics.learn.prerequisite` ("You must know the prerequisite powers first.") and `ADND2E.sheet.psionics.learn.min-level` ("You are not a high enough level for this power.").
- `adjustPsp(actor: PsionicActor, delta: number): Promise<void>` in `psionic-actions.ts`: requires a psionicist (same refusal as the other actions); a non-integer or 0 delta is ignored; a positive delta adds PSPs clamped to `max` (writing `psp: null` when the result reaches the max, as `rest` does); a negative delta spends: refused with a warn toast `ADND2E.sheet.psionics.notEnoughPsp` (existing key) when the effective current pool is below the amount, else writes the new number. One `actor.update`, own data only. Sheet action `adjustPsionicPsp` reads an integer input `[data-psionic-adjust]` (no `name=`, like the rest controls) and calls it; the panel gets a row "Adjust PSPs: [number input] [button]" with new lang keys `ADND2E.sheet.psionics.adjust` ("Adjust PSPs") and `ADND2E.sheet.psionics.adjustHint` ("Enter a positive number to gain PSPs or a negative number to spend them."). Register the action and keep the bindings test passing.

- [ ] **Step 1: Tests first.** `learning.test.ts`: a power with prerequisites `["Telekinesis"]` is refused with `prerequisite` until a known power named "telekinesis" (case/whitespace variants) exists, then allowed; two prerequisites need both (the refusal names no specific one); `minLevel: 5` at level 4 is refused `min-level`, at level 5 allowed; a prerequisite satisfied by a defense mode name; `min-level` is reported before `prerequisite`; defaults (no fields) behave exactly as before. `drop-rules.test.ts`: the drop maps the new reasons to `ADND2E.sheet.psionics.learn.<reason>` and reads prerequisites/minLevel leniently. `psionic-actions.test.ts` for `adjustPsp` with exact writes: gain below max (e.g. psp 20 max 40 +10 -> 30), gain to/over max (-> `null`), spend (30 -10 -> 20), spend more than the pool refused with no write, 0 / 1.5 / NaN ignored, non-psionicist refused. `context.test.ts`: the view still builds with `name` on known powers. Bindings test: `adjustPsionicPsp` is registered and appears in the panel.
- [ ] **Step 2: Implement** as specified; **Step 3:** `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`; **Step 4: Commit** "feat(psionics): power prerequisites in the learning rules and an Adjust PSPs control (SP15 Plan B)".

---

### Task 2: Author the catalog data (one discipline per dispatch; output to a scratch folder, not the repo)

Six dispatches, one per discipline, run one after another (clairsentience, psychokinesis, psychometabolism, psychoportation, telepathy, metapsionics). Each reads the Summary of Powers page images (PDF pages 128-130) for ITS discipline and the discipline's chapter stat blocks, and writes `C:/Users/Apera/AppData/Local/Temp/claude/c--Users-Apera-OneDrive-Dev-foundry/22c20087-b60f-4e25-b73c-4b032bfc06fe/scratchpad/catalog/<discipline>.json`: an array of objects, in the book's order, for EVERY science and devotion of the discipline that is NOT already in `packs/powers/_source` (check by name; the 23 existing are listed there), with exactly these keys:

```json
{ "name": "Aura Sight", "kind": "science", "abilityKey": "wis", "abilityModifier": -5,
  "initialCost": 9, "costNote": "", "maintenanceCost": 9, "maintenanceUnit": "round",
  "range": "50 yds.", "preparation": "0", "areaOfEffect": "personal",
  "prerequisites": [], "minLevel": 0, "description": "One original sentence." }
```

Rules for the fields, from the Summary of Powers row and the stat block:
- `abilityKey` is the lowercase ability (`str dex con int wis cha`) and `abilityModifier` the signed integer (a row with no modifier is 0; a row printed "Wis" alone is wis, 0).
- `initialCost`: the printed integer. For a cost printed "contact": 0 with `costNote` "contact" (the Contact devotion must first be established). For "varies": 0 with note "varies". For "10+" / "20+" / "3+": the integer with the note kept as printed (e.g. `10`, note "10+"). For "45/90" or "1/25 miles": the first integer with the full printed text as the note. For "na": 0 and note "na" is NOT used; use 0 with an empty note only if the book prints a cost, else 0 with note "none". Never invent a number.
- Maintenance: "na"/"-" or none printed -> `maintenanceCost` 0 and `maintenanceUnit` "none". "6/rnd." -> 6, "round"; "/turn" -> "turn"; "/hr."/"/hour" -> "hour"; a printed unit that is not round/turn/hour (e.g. "/day", "1/increase", "2 x maint.", "per hit die"...) -> `maintenanceCost` 0, unit "none", and say so in the power's `costNote` (append, e.g. "maint. 10/day").
- `range`, `preparation`, `areaOfEffect`: the printed strings (trim; use "0" or "na" as printed).
- `prerequisites`: the names of the other powers the stat block lists, spelled exactly like the catalog power names (lowercase in the book; use the catalog's capitalization), as an array; "none"/"0"/blank -> `[]`. `minLevel`: an integer when the stat block lists a character level ("5th level" -> 5), else 0. READ THE PAGE IMAGE for every power whose stat block is not "none" (the OCR is unreliable for prerequisites) and for any value you are unsure of.
- `description`: ONE original sentence (see Global Constraints).
- ALSO write `<discipline>-prereqs-existing.json`: prerequisites/minLevel corrections for the ALREADY-SHIPPED powers of this discipline (`[{ "name": "Aura Alteration", "prerequisites": ["psychic surgery"?...], "minLevel": 0 }]`; include an entry for each shipped power of the discipline, `[]`/0 when none), read from the book the same way.

Each dispatch returns the count of powers authored, a list of any value it could not read with certainty (with the page number), and nothing else. The controller checks every discipline file's counts against the Summary of Powers (see Task 3).

---

### Task 3: Write the pack, the census tests and the verification

**Files:** `packs/powers/_source/*.json` (new files + prerequisite/minLevel added to the 23 existing), `tests/packs/content.test.ts` (the `powers pack content` block), `tests/config/*` if it pins the pack's document count, `tests/data/power-model.test.ts` (already covers the new schema fields from Task 1), `README.md`.

- [ ] **Step 1:** A one-off generator (not committed) merges the six scratch catalogs into pack documents: each `{ _id, _key: "!items!<_id>", name, type: "power", img: "icons/svg/aura.svg", system: {...} }` with `system` carrying every key of the catalog row (`description`, `discipline`, `kind`, `abilityKey`, `abilityModifier`, `initialCost`, `costNote`, `maintenanceCost`, `maintenanceUnit`, `range`, `preparation`, `areaOfEffect`, `prerequisites`, `minLevel`) plus `scoreBonus: 0`. `_id` is exactly 16 alphanumeric characters: `kPwr` + the first 9 letters of the name (letters only, first letter capitalized, padded with `0`) + a 3-digit counter that keeps every id unique; keep the existing 23 documents' ids. File name = the name slugified (`aura-sight.json`). Apply the `-prereqs-existing` corrections to the existing 23 documents (add `prerequisites` and `minLevel`, keep everything else byte-identical apart from those two keys). Match the line endings of the existing pack files.
- [ ] **Step 2: Census tests** (`powers pack content`): the document count equals the number of powers in the book's Summary of Powers (the controller states the exact number when dispatching: count the rows of the three Summary pages and add the 5 defense modes if the Summary lists them separately; the implementer must reconcile and report the count); unique names, ids (16 chars) and `_key`s; every power well-formed against the vocabularies; every `prerequisites` entry resolves to the exact name of another power in the pack (case-insensitive) and never to itself; no prerequisite cycles; every `minLevel` is 0..20; every non-defense discipline has at least 1 science and 2 devotions; exactly 5 defense powers, all telepathy; `maintenanceCost === 0` iff `maintenanceUnit === "none"`; the Table 4 sanity: for each discipline the number of devotions is at least twice the number of sciences OR the test documents the book's counts (compute from the pack and assert the exact per-discipline counts of sciences and devotions); spot-pins for at least 12 powers across all six disciplines, asserting their full numbers (Clairvoyance, Disintegrate with prerequisites ["telekinesis","soften"], Ego Whip, Psychic Crush with ["mindlink","contact"], Complete Healing, Teleport Other with ["teleport"], Death Field, Aura Alteration, a minLevel power such as Cannibalize or Intensify read from the data, and the five defense modes untouched).
- [ ] **Step 3:** `npx vitest run && npm run typecheck && npm run lint && npm run test:coverage`, `npm run build:packs` (pack count equals the census), README SP15 row updated to "Plans A-B complete (foundation, catalog); C-D not started" with a short sentence for Plan B, then commit "feat(psionics): the full power catalog with prerequisites (SP15 Plan B)".

---

### Task 4: Verification gates (no new feature code unless a gate fails)

- [ ] Full CI sequence; whole-branch review (most capable model) with a **data accuracy audit**: a random sample of at least 25 powers across all six disciplines checked against the Summary of Powers page images and their stat-block prerequisites (the reviewer reports mismatches with page numbers); descriptions are original (no copied book sentences) and ASCII; prerequisite names resolve; the learning rule tests; the Adjust PSPs behavior and its non-psionicist refusal.
- [ ] Headless proof (controller): re-run `psionics.proof.ts` against the full catalog (every pack document validates against the real `PowerItemModel` schema, including `prerequisites` as an array with a factory initial and clean defaults for an old power without the new keys); a real learning-flow proof with real prerequisites (Disintegrate refused until Telekinesis and Soften are known, `min-level` for a level-gated power); the real `adjustPsp` writes through real `updateSource`; the panel renders the new control and no raw lang keys.
- [ ] Rebuild the installed system if Foundry is closed; push; open the PR; hand the user a manual checklist WITH PREREQUISITES AND EXACT NUMBERS (a Psionicist class item; level and ability scores stated; which powers to drop in which order to show the prerequisite refusal and acceptance; Adjust PSPs +10 / -10 on a known pool; a non-psionicist refusal).

---

## Self-review notes

- Coverage of the approved design: catalog (Tasks 2-3), prerequisites + min level in schema and rules (Task 1), variable costs as notes (Task 2 rules), Adjust PSPs (Task 1), testing and data audit (Tasks 3-4).
- The pack count is deliberately reconciled against the Summary of Powers in Task 3 instead of being asserted here, because the book's table is the source of truth.
