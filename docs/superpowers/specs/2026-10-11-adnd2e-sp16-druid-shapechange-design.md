# Sub-project 16: Druid shapechanging — design

Date: 2026-10-11 · Issue: #84 · Branch: `feat/sp16-shapechange` · Source: The Complete Druid's Handbook (PHBR13) Druid Characters ch. pp.6-8 and the branch entries (desert p.13, mountain p.17, swamp p.18); the Player's Handbook p.37 baseline.

## Background

Druids (and most druidic branches) shapechange into animals from 7th level. The handbook's rules:

- A limited number of shifts a day, set by the branch; the branch usually restricts the types of forms. The base (PH) rule: 3 times a day, each of reptile, bird and mammal once a day (some branches say "once per form per day", habitat-bound, and no giant forms).
- Shifting takes one round, during which the druid cannot act. The new form lasts indefinitely, until the druid reverts or takes another form, and the druid may change directly from one form to another.
- On assuming a new form the druid heals 10-60% (1d6 × 10%) of all damage taken, fractions rounded down (worked example: 15 damage, roll 3, regain 4.5 hp rounded to 4).
- Forms are normal real-world animals from bullfrog or small bird to black bear (giant forms only where noted). In animal form the druid takes all the beast's physical characteristics (movement rate, abilities, AC, number of attacks, damage per attack) and retains original hit points and saving throws.
- Clothes and one item per hand become part of the new body and reappear on reverting; a shapechanged druid radiates strong Alteration magic.

The system has no animal stat blocks (docs/bestiary-content.md: the GM authors their own bestiary), a Monster NPC creature actor type with `attributes.ac`, `attributes.movement` and an `attacks[]` list, and a kit engine (SP11) whose tracked, parametrized powers already provide per-day counters (`system.kitPowers`, `src/core/kits/powers.ts`) and a "new day" action that resets them.

## Decisions (made with the user)

- **Forms are the GM's own Monster NPC actors**, tagged as shapechange forms. Nothing copyrighted ships.
- **Scope A:** the Player's Handbook core mechanic for the base druid, plus branch parameters through the kit engine, plus three sample branch kits transcribed from PHBR13: desert, mountain, swamp.
- **The shifted druid** takes the form's AC, movement and attacks with their damage; keeps hit points, saving throws and THAC0 (the handbook lists physical characteristics and does not list THAC0, so the druid hits as a druid). The user confirmed this reading.
- **Form data is snapshotted** onto the druid at shift time (no live link to the source actor).

## Design

### 1. Pure rules — `src/core/shapechange/` (Foundry-free, in the coverage gate)

- `shapechangeAvailable(druidLevel, spec)`: true when the druid's level meets the spec's gate (base: 7).
- `ShapechangeSpec` — `{ minLevel, uses, per: "day", categories: ("reptile"|"bird"|"mammal")[], oncePerCategory: boolean, habitats: string[], allowGiant: boolean }`. `baseShapechangeSpec()` is the PH rule (minLevel 7, 3 uses a day, all three categories, once per category, no habitat restriction, no giants). `resolveShapechangeSpec(kitPower | null)` reads a kit's `shapechange` power leniently: `uses`/`per`/`usesByLevel` give frequency and gate; params `habitats` (comma-separated), `categories` (comma-separated), `oncePerCategory` ("true"/"false"), `giant` ("true"/"false"); a malformed value falls back to the base value.
- `formEligible(form, spec)`: a form (`{ category, habitats, giant }`) is legal when its category is one of `spec.categories`, it is not giant unless `spec.allowGiant`, and, when `spec.habitats` is non-empty, it shares at least one habitat tag.
- `canShift(state, spec, form)`: returns `{ ok: true }` or a reason (`noUsesLeft`, `categoryUsed`, `notEligible`). Uses left is `spec.uses - state.usedToday`; the category is unavailable when `oncePerCategory` and it is in `state.categoriesUsed`.
- `healOnShift(damageTaken, d6)`: `Math.floor(damageTaken * d6 * 10 / 100)`, never negative, zero when no damage (worked example: damage 15, d6 3 gives 4).
- `shiftedStats(form, characterThac0)`: returns the overlay `{ ac, movement, attacks[] }` (each attack `{ name, count, damage, type }`) the sheet and derive use while shifted; THAC0 is the druid's own.

### 2. Form data on Monster NPCs

`details.shapechange` (a new SchemaField on the creature model): `category` (`""` | `"reptile"` | `"bird"` | `"mammal"`; `""` means not a shapechange form), `habitats` (multi-select from a fixed list: desert, forest, mountains, plains, swamp, arctic, jungle, ocean, underground), `giant` (boolean). Shown on the Monster NPC sheet in a small "Shapechange form" panel (locked view shows the values, unlocked edits them), using the existing choice and multi-select patterns. No migration (new fields with initials). Size is not enforced; the GM tags only legal bullfrog-to-black-bear animals. A short note goes in `docs/bestiary-content.md`.

### 3. Actor state (PC)

`system.shapechange` on the character model: `usedToday: number`, `categoriesUsed: string[]`, and `form: null | { name, img, ac, movement, attacks[] }` (the snapshot; null when in normal form). No migration. Written only by the acting actor's own update (an owner can shift), like `kitPowers`.

### 4. The shifted state

- **Derive:** the character derive takes the optional snapshot and, when present, substitutes AC (all four values equal the form's AC: no Dexterity or rear-attack variation, no shield) and the land movement rate (and shows the other movement modes the form has). Hit points, saves and THAC0 are untouched. Pure helper in `src/core/shapechange/` plus the one substitution call site in `src/data/derive/character/`.
- **Attacks:** while shifted, the PC sheet's combat attack panel lists the form's attacks (name, count, damage) instead of weapons. A new `rollShapechangeAttack` rolls with the druid's THAC0, the form attack's damage, and the existing attack-card pipeline (target AC lookup, the condition modifiers from #142 such as invisible, helpless and blinded, crit/fumble tables when enabled) using the creature-attack code path; damage posts the existing creature-damage card with its apply button.
- **Banner:** a "Shapechanged: <form>" banner with a "Return to normal form" button on the PC sheet header while shifted.
- **Equipment:** worn gear does not affect AC while shifted (the form's AC replaces it). No other equipment rule is enforced.
- **Return:** "Return to normal form" clears `form` and costs no use.

### 5. The Shift action and chat

- A Shapechange panel on the PC Features tab, shown only for characters with a druid class (`chassisId: "druid"`) whose level meets the resolved spec's gate. It shows uses left today, the categories used, and a "Shift…" button.
- "Shift…" opens a themed dialog (`themedPrompt`) listing the eligible forms: Monster NPC actors in the world that the user can observe, tagged with a category, passing `formEligible` against the druid's resolved spec, and for which `canShift` allows a shift (forms in a used category are shown disabled with the reason). Choosing one runs the shift: spend a use and mark the category (one atomic actor update), roll 1d6 for the heal, apply the heal to the druid's hit points (not above max), store the snapshot, post a chat card.
- Chat card: the form, the d6 and healing, uses left, the reminder that the shift took one round; styled with the existing `.adnd2e.chat-card` vocabulary (`formula`, `result`, `hint`), a new `shapechange-use.hbs` template plus its class in the census.
- Shifting from one form to another uses a use and may heal again, as the rules say.
- The existing "new day" action (which resets kit powers) also resets `usedToday` and `categoriesUsed` (the form stays until reverted).
- Shift and return are blocked while the druid has a condition that stops acting (`canAct` false), matching the attack gate from #142.

### 6. Branch kits and samples

- A kit's `powers` list may contain a power with `id: "shapechange"`; `resolveShapechangeSpec` reads it. A druid with no such power uses the base spec.
- Three sample kits in the `kits` pack, `chassisId: "druid"`, content transcribed from PHBR13 with page citations in a MANIFEST note: **Desert druid** (p.13): 3/day at 7th level, one each of mammal, reptile, bird, forms limited to desert habitats; **Mountain druid** (p.17): 3/day at 7th level, reptile, bird or mammal, each form once a day, no giants, mountain habitats; **Swamp druid** (p.18): 3/day at 7th level, real-world creatures of swamps and wetlands, each category once. Their other granted powers (languages, infallible identification, resistances, insect plague) are narrated text in `grantedFeatures`, not automated. The pack manifest and a census test are updated.

### 7. Out of scope

Character NPC druids (the Shapechange panel is PC-sheet only, as other PC-only panels are); equipment merging or protective-device rules; spell-casting restrictions while shifted; special attacks of forms beyond the free-text note; other druidic branches and the Hierophant progression; size enforcement; Dark Sun.

## Testing

- Unit tests for every pure function, including the worked heal example, rounding, zero damage, per-day and per-category limits, habitat and giant gating, lenient spec parsing (malformed params fall back), and the overlay.
- Schema tests (data model, the headless harness) for `details.shapechange` and `system.shapechange` defaults and a snapshot round trip.
- Template/binding tests for the new panel and actions; a chat-card census update; lang coverage; the guard test (the dialog uses `themedPrompt`).
- Headless proof: the shift flow against the real models (spend, categorize, heal, snapshot, derive overlay, return, new-day reset) and the kit spec resolution from the three sample kits.
- Gates before the PR: `npm run lint`, `npm run typecheck` (including `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Manual dev-world checklist, including a **non-GM player seat**: a druid at level 7, a Monster NPC bestiary of a few animals tagged by the GM (with Observer permission on the animal folder), shift (uses, category, heal), the shifted AC/movement/attacks on the sheet, an attack from the form, return, the per-category limit message, rest reset, a branch kit habitat filter, and a player who cannot observe an animal not seeing it in the picker.

## Risks

- **Permissions:** a player reading a form's stat block needs at least Observer permission on that actor. The picker lists only actors the user can observe; the docs and checklist tell GMs to set a folder default.
- **Attack path reuse:** the creature attack code takes a creature actor; the shifted attack should reuse its target, condition and crit logic through a shared helper rather than a fork, and the implementation plan must read both attack paths before choosing (both PC and creature paths wire modifiers separately, as #142 showed).
- **Derive substitution:** AC and movement are derived in several places (sheet, targeting, wrestling AC 10 rules, the creature lookups of a target's AC for attacks against a shifted druid — `resolveTargetCombatInfo`); every reader of a character's AC must see the form's AC while shifted, or attacks against the druid would use the human AC.
- **Snapshot staleness** is intended: editing the source animal after the shift does not change an active form.
