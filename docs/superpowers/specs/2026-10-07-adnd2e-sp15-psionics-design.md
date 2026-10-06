# Psionics (Sub-project 15) — Design

Date: 2026-10-07. Source: *The Complete Psionics Handbook* (PHBR5), chapters 1-8 and Tables 1-14 (the book's OCR text is in `references/psionics_full.txt`; its tables are garbled there, so each plan reads the page images for the tables it uses). Tracked as GitHub issue #83. *The Will and the Way* (Dark Sun psionics) is in `references/` but is **out of scope**: it belongs to the Dark Sun work (issue #90). Background: `docs/mechanics-review-2026-09.md` (Psionics entry).

## Approved decisions

- **Four plans, four PRs.** Plan A (foundation), Plan B (the power catalog), Plan C (psionic combat), Plan D (wild talents and psionic proficiencies). This spec fixes the architecture of all four and the detail of Plan A; Plans B-D get their own detailed plans when they are built.
- **No world setting.** Psionics is available only to an actor that has the Psionicist class item. Everything psionic (the Psionics tab, the PSP panel, rolls, compendium entries) is hidden or inert for any actor without it. (Plan D's wild talents for non-psionicists need a different gate; it is decided in Plan D.)
- **Automate the economy, not the effects.** A power's check, PSP cost, maintenance and chat card are automated. A power's effect (damage, healing, detection, movement...) stays descriptive text, as spells do today.
- **Maintained powers are tracked** per character with a manual "advance maintenance" drain (not tied to the Foundry game clock).
- **Characters only.** PCs, and Character NPCs where the shared sheet makes it free. Psionic monsters (Monstrous Manual stat blocks with PSPs) are a later issue.
- **Racial level limits and multiclass/dual-class** follow the book (Table 1 as race data enforced by the SP13 engine; multiclass and dual-class as the book states), nothing more.

## Rules summary (what the book provides)

- **Psionic Strength Points (PSPs):** a pool spent when a power is used and recovered by rest. The maximum is the character's *inherent potential* (from Wisdom, with Intelligence and Constitution modifiers; Table 5) developed by experience level (Table 4).
- **Power score:** each power is tied to an ability with a modifier (for example "Intelligence -3"); the score is the character's ability score plus the modifier.
- **Power check:** d20 at or below the power score succeeds and costs the full PSP cost; above it fails and costs half the cost, rounded up. A natural 1 always succeeds (minimum success), a natural 20 always fails. The optional skill-score rule: a roll equal to the score gives a special result.
- **Disciplines, sciences, devotions:** six disciplines (clairsentience, psychokinesis, psychometabolism, psychoportation, telepathy, metapsionics). A power is a science (major) or a devotion (minor). Table 4 gives how many disciplines, sciences and devotions a psionicist has at each level. Rules: within a discipline the devotions known must be at least twice the sciences; the first discipline is the primary discipline, and the character can never know as many sciences or devotions in another discipline as in the primary; instead of a new power a character may raise a known power's score by one.
- **Maintained powers:** some powers run continuously, costing PSPs per turn or hour; a character spending PSPs to maintain a power recovers none that hour.
- **Recovery (Table 6):** by activity (hard exertion none; walking and riding; sitting, resting or reading; rejuvenating or sleeping, at higher rates). The OCR of this table is garbled, so the exact per-hour numbers are read from the page image when Plan A is written; nothing in this spec depends on them.

## Plan A: foundation (detailed)

### The class

`psionicist` is added to the class id list and given a chassis in `src/core/classes/chassis.ts`: Wisdom prime requisite and ability requirements, experience table (Table 2) and hit dice, THAC0 and saving-throw groups (Tables 7 and 8), armor limits (Table 9) and weapon/proficiency data (Tables 10-11). The races' `classLevelLimits` gain a `psionicist` entry (Table 1) so SP13's enforcement applies; multiclass and dual-class permissions follow the book. A `psionicist` class item ships in the classes pack.

### Pure rules: `src/core/psionics/`

- `inherentPotential(wis, int, con)`: Table 5 (Wisdom base plus the Intelligence and Constitution modifiers).
- `psionicStrength(potential, level)`: the PSP maximum from Table 4.
- `powerScore(abilityScore, modifier)` and `psionicCheck(roll, score)` returning `{ success, minimum, failure }` (natural 1 success, natural 20 failure), and `checkCost(cost, success)` (full cost, or half rounded up).
- `recoveryRate(activity)`: Table 6.
- `learningRules(known, level)`: validates a proposed new power or score increase against Table 4's discipline access, the 2:1 devotion rule and the primary-discipline cap; returns a typed violation.
- All Foundry-free and covered at 100%.

### Data

- New item type `power`: discipline, kind (science or devotion), power-score ability and modifier, initial cost, maintenance cost and its unit (turn, hour or none), prerequisites, range, preparation time, area, saving throw text, and a description. Effects are text.
- The owned power also carries `scoreBonus` (the "raised score" increments earned by relearning) as an integer on the owned item.
- Actor state: `system.psionics = { psp: number, maintained: [{ powerId, since }] }`. The maximum is derived, never stored as authority. Fields use factory initials where an object or array is needed.
- `OptionalRules` is unchanged (no setting).

### Derive

`deriveCharacter` gains a psionics block derived only when a psionicist class item exists: PSP maximum (from the prepared Wisdom, Intelligence, Constitution scores and the psionicist's level, honoring SP13 level rules), and a score for each owned power. The block is cleared or absent for any actor without the class.

### Learning and the check (sheet glue)

- Drop rules (a hard block with a toast, like kit qualifications): the power's discipline must be accessible at the character's level, the 2:1 devotion rule, and the primary-discipline cap. The first power chosen sets the primary discipline.
- A "relearn" action raises a known power's score by one in place of a new power, within the same level budget.
- A **Use** button per power row runs the check: d20 against the power score. The chat card shows the roll, the result (success, failure, minimum success on a 1, automatic failure on a 20), the cost paid, and the remaining PSPs; the optional skill-score special result is noted when the roll equals the score. The use is refused with a toast when the pool is below the cost. Success of a maintained power adds it to the maintained list.
- **Rest** buttons on the PSP panel apply Table 6 recovery for a chosen activity and duration. **Advance maintenance** applies the per-turn or per-hour drain for every maintained power and ends any the pool cannot sustain; a power can also be ended by hand. While maintaining, recovery that hour is refused, per the book.

### Sheet

A Psionics tab, rendered only when the actor has the psionicist class: the PSP bar (current/max), rest and maintenance controls, the maintained list, and the powers grouped by discipline with kind, score, cost and the Use button, plus the learning-rule warnings. The tab uses the existing sheet kit. A Character NPC with the class sees the same tab only where the shared template already supports it.

### Starter content

The powers pack ships a small starter set (several powers per discipline, including at least one science and its prerequisite devotions per discipline) so the rules can be exercised before Plan B fills the catalog.

## Plans B-D (architecture)

- **Plan B, the catalog:** all of the book's powers (about 100+ across the six discipline chapters, plus the appendix summary) as `power` items in a compendium pack, authored from the page images; a drift and census test pins the pack against the book's index and Table 4's rules.
- **Plan C, psionic combat:** psychic contests as a pure function over the attack mode versus defense mode matrix (Table 14), tangents, psychic lock and the contest's PSP flow; a chat-card flow on the PC sheet. Mirrors the called-shot and critical work from Sub-project 7.
- **Plan D, wild talents and psionic proficiencies:** Wild Devotions and Wild Sciences (Tables 12-13), rolled for characters who are not psionicists, and the psionic proficiencies; needs its own availability gate, decided in that plan.

## Out of scope

- Per-power effect automation (damage, healing, buffs); psionic items; psionic monsters and Monstrous Manual stat blocks (a later issue); Dark Sun psionics (*The Will and the Way*); training time with a mentor (an optional rule in the book).

## Testing (Plan A)

- Pure tests for every `src/core/psionics/` function at the table boundaries (Table 5 ability ranges, Table 4 levels 1-20, the 1 and 20 results and the half-cost rounding, every Table 6 activity, each learning rule including the primary-discipline example from the book: 3 sciences and 7 devotions in the primary leaves at most 2 sciences or 6 devotions elsewhere).
- Derive tests (psionicist versus a non-psionicist actor; level changes; SP13 caps), schema and census tests (no object or array literal `initial`; every new string in `lang/en.json`), registry and pack-drift tests for the class and the starter powers.
- Headless proof (the repo's Foundry-in-Node harness): real schema validation of the item and actor data, the real derive and the real check and recovery flow, and the sheet template rendered with a stubbed `localize`.
- Manual dev-world check (the user; the character must have a Psionicist class item): PSP maximum for a stated set of ability scores, a successful and a failed check with the exact PSP deducted, a natural 1 and 20 (by seeded dice or the debug roll), the learning-rule blocks, rest recovery and maintenance drain, an actor without the class showing no psionics anywhere, and a non-GM seat.
