# Wild talents and the Psionicist proficiency group (Sub-project 15, Plan D) - Design

Date: 2026-10-08. Source: *The Complete Psionics Handbook* (PHBR5) Chapter 1 "Wild Talents" pp.18-21 (read from the page images), Tables 11-13. Builds on SP15 Plans A-C. This is the last SP15 plan. Tracked under issue #83.

## Approved decisions

- **Gate by a world setting `wildTalents`, default OFF** (requires reload). Off: nothing wild-talent related is visible anywhere. On: every character sheet without an active psionicist class shows a small "Wild talent" panel with a **Test for wild talent** button. Psionics otherwise exists only for an actor with an active psionicist class (Plan A ruling); a found wild talent is the one other way in.
- **One test per character.** The button locks after the test; a GM can reset it (the book allows testing only at specific moments: creation, a new Wisdom high, the first psychic surgeon, psionics entering the campaign). A "psychic surgeon (-2)" checkbox on the test.
- **Dire consequences are applied through a confirmed button.** A roll of 97 or higher posts a card with the save versus death rolled and the loss rolled; the owner (or a GM) presses **Apply** (with a confirmation) to permanently reduce the base ability score. Nothing changes without the press.
- **Wild talents use the normal Psionics tab** (PSP bar, Use, rest, maintenance, contests) but cannot learn more powers by dragging or relearning: the powers are granted from Tables 12-13. A GM may add a power by hand (the drop refusal is for players).
- **A found talent is never retested.** A character whose wild talent is already FOUND is refused a retest even after a GM reset (a reset only unlocks a character who found nothing, because a retest could grant more powers).
- **Proficiencies:** add the "psionicist" non-weapon proficiency group, the four new proficiencies (Harness Subconscious, Hypnosis, Rejuvenation, Meditative Focus) and let the four shared ones (Gem Cutting, Musical Instrument, Reading/Writing, Religion) cost their Table 11 slots for a psionicist. Effects stay as the book's text (no automation of Harness Subconscious or Meditative Focus).

## Rules summary (PHBR5 pp.18-21)

- **Chance to be a wild talent** (percent): base 1; +1/+2/+3 for EACH of Wisdom, Constitution, Intelligence at 16/17/18 (prepared scores); +1 for character level 5-8; +2 for level 9 or higher; then multiplied by 1/2, rounded up, for a mage, a cleric or a non-human (applied once). Roll d100, minus 2 when under the guidance of a psychic surgeon; at or below the chance = a wild talent. A roll of 97 or higher (before or after the surgeon's modifier as rolled) is a dire consequence: 97 save vs death or Wisdom -1d6 permanently; 98 save vs death or Intelligence -1d6; 99 save vs death or Constitution -1d6; 00 save vs death at -5 or Wisdom, Intelligence and Constitution all become 3, permanently. (The talent test is made first; the dire result is checked independently on the same roll.)
- **Determining powers:** roll d100 on **Table 12 (wild devotions)**; results include "choose any <discipline> devotion", "roll two/three times", "choose any two devotions", "91-99 roll on Table 13 (wild sciences)" and "00 choose any devotion, then roll again on Table 13". Table 13 results include "choose any <discipline> science or devotion", "roll two/three times", "choose any science or devotion", "any science and two/three devotions" and "any two sciences and four devotions". A power's prerequisites are granted too.
- **PSPs:** the minimum to use each granted power once, plus enough to pay a maintainable power's maintenance four times; then +4 per experience level gained after the talent was found (no bonus for levels already held).

### Table 12: wild devotions (d100)

01 All-Round Vision; 02 Combat Mind; 03 Danger Sense; 04 Feel Light; 05 Feel Sound; 06 Hear Light; 07 Know Direction; 08 Know Location; 09 Poison Sense; 10 Radial Navigation; 11 See Sound; 12 Spirit Sense; 13-14 choose any clairsentient devotion.
15 Animate Object; 16 Animate Shadow; 17 Ballistic Attack; 18 Control Body; 19 Control Flames; 20 Control Light; 21 Control Sound; 22 choose any psychokinetic devotion.
23 Absorb Disease; 24 Adrenalin Control; 25 Aging; 26 Biofeedback; 27 Body Control; 28 Body Equilibrium; 29 Body Weaponry; 30 Catfall; 31 Cause Decay; 32 Cell Adjustment; 33 Chameleon Power; 34 Chemical Simulation; 35 Displacement; 36 Double Pain; 37 Enhanced Strength; 38 Ectoplasmic Form; 39 Expansion; 40 Flesh Armor; 41 Graft Weapon; 42 Heightened Senses; 43 Immovability; 44 Lend Health; 45 Mind Over Body; 46 Reduction; 47 Share Strength; 48 Suspend Animation; 49 choose any psychometabolic devotion.
50 Attraction; 51 Aversion; 52 Awe; 53 Conceal Thoughts; 54 Daydream; 55 Empathy; 56 ESP; 57 False Sensory Input; 58 Identity Penetration; 59 Incarnation Awareness; 60 Inflict Pain; 61 Invincible Foes; 62 Invisibility; 63 Life Detection; 64 Mind Bar; 65 Phobia Amplification; 66 Post-Hypnotic Suggestion; 67 Psychic Impersonation; 68 Psychic Messenger; 69 Repugnance; 70 Send Thoughts; 71 Sight Link; 72 Sound Link; 73 Synaptic Static; 74 Taste Link; 75 Telempathic Projection; 76 Truehear; 77-78 choose any telepathic devotion.
79 Astral Projection; 80 Dimensional Door; 81 Dimension Walk; 82 Dream Travel; 83 Time Shift; 84 Time/Space Anchor; 85 choose any psychoportive devotion.
86-87 roll two times; 88-89 roll three times; 90 choose any two devotions; 91-99 roll on Table 13; 00 choose any devotion, then roll again and consult Table 13.

### Table 13: wild sciences (d100)

Clairsentient: 01-02 Aura Sight; 03-04 Clairaudience; 05-06 Clairvoyance; 07-08 Object Reading; 09-10 Precognition; 11-12 Sensitivity to Psychic Impressions; 13-16 choose any clairsentient science or devotion.
Psychokinetic: 17-18 Detonate; 19-20 Disintegrate; 21-22 Molecular Rearrangement; 23-24 Project Force; 25-26 Telekinesis; 27-30 choose any psychokinetic science or devotion.
Psychometabolic: 31-32 Animal Affinity; 33-34 Complete Healing; 35-36 Death Field; 37-38 Energy Containment; 39-40 Life Draining; 41-42 Metamorphosis; 43-44 Shadow-form; 45-48 choose any psychometabolic science or devotion.
Telepathic: 49-50 Domination; 51-52 Fate Link; 53-54 Mass Domination; 55-56 Mindwipe; 57-58 Probe; 59-60 Superior Invisibility; 61-62 Switch Personality; 63-64 Mindlink; 65-68 choose any telepathic science or devotion.
Psychoportive: 69-70 Banishment; 71-72 Probability Travel; 73-74 Summon Planar Creature; 75-76 Teleport; 77-78 Teleport Other; 79-82 choose any psychoportive science or devotion.
83-85 roll two times; 86-88 roll three times; 89-92 choose any science or devotion; 93-96 choose any science and two devotions; 97-99 choose any science and three devotions; 00 choose any two sciences and four devotions.

(Wild talents never receive metapsionic powers; "roll two/three times" re-rolls on the same table; a "choose" result is picked by the owning player from a dialog listing the eligible powers of that kind (for Table 12 "choose any <discipline> devotion above" only the devotions Table 12 itself lists for that discipline, e.g. the 7 psychokinetic ones, not Levitation; Table 13 and the "any devotion/science" rows are unrestricted); a power the character already holds is skipped.)

## Pure rules: `src/core/psionics/wild.ts`

- `wildTalentChance(input: { wis; con; int; level; halved: boolean }): number` (the percent, an integer; the halving rounds up and applies once).
- `isHalved(input: { classIds: readonly string[]; raceId: string }): boolean` (a mage or cleric chassis, or a race other than human).
- `testWildTalent(chance, roll, surgeon): { talent: boolean; effectiveRoll: number; dire: DireResult | null }` where `effectiveRoll = roll - (surgeon ? 2 : 0)`, `talent = effectiveRoll <= chance`, and `dire` from the rolled d100 (97, 98, 99, 100 as "00").
- `DIRE_TABLE`; `direOutcome(roll)`: `{ roll, ability: "wis" | "int" | "con" | "all", savePenalty: 0 | -5 }`; loss rule `loseD6` or `setTo3`.
- `TABLE_12`, `TABLE_13` (range tables as data) and `lookupWild(table, roll)` returning `{ kind: "power", name } | { kind: "choose", discipline, powerKinds } | { kind: "roll", times, table } | { kind: "chooseAny", sciences, devotions } | { kind: "table13" } | { kind: "chooseThenTable13" }` with the 01-00 convention (a roll of 100 is "00").
- `wildPsp(powers: { initialCost; maintenanceCost; wildMinimum? }[], levelsGained: number): number` = sum of each power's `wildMinimum` (when non-null) or (`initialCost` + 4 x `maintenanceCost`), + 4 x `levelsGained`. `wildMinimum` is an optional power-item field (null = computed) holding the book's stated minimum for powers whose real cost is only in `costNote` (Contact 7, Enhanced Strength 6, Mind Over Body 40, Reduction 5, Domination 30, Mass Domination 14, Switch Personality 30, Post-Hypnotic Suggestion 1); Ejection's cost is twice the opponent's contact power score, so it has none.
- Foundry-free, 100% covered; every table range tested at its boundaries and the book's worked example (a 3rd-level dwarf cleric, Wis 17, Int 9, Con 16: chance = (1 + 2 + 1) x 0.5 = 2).

## Data and gating

- `system.wildTalent = { tested: boolean, found: boolean, levelAtDiscovery: int >= 0 }` on the actor (defaults false/false/0; no migration).
- The derived psionics block gains `wild: boolean`. For a wild talent `psionics.level` is the character's highest class level (so the existing `level > 0` gates all pass) and `max` is `wildPsp(...)` over the owned power items plus `+4` per level gained since `levelAtDiscovery`. A real psionicist is unaffected (`wild` false). A psionicist who is also a wild talent is simply a psionicist.
- Wild talents: `checkPowerDrop` refuses a dragged power for players (key `ADND2E.sheet.psionics.wildNoLearn`) but allows a GM; relearning is refused; the Table 4 budget warnings are not shown.

## Actions (Foundry glue)

- `testWildTalent(actor, { surgeon })`: refuses when the setting is off, the actor is a psionicist, or `wildTalent.tested`; rolls d100, computes the chance from the prepared scores, the class levels and the race, posts a card (chance, roll, the surgeon modifier, the result). On a talent: determines the powers from Tables 12/13 (rolling, a choose dialog for "choose" results, skipping powers already held), copies each power (and every prerequisite, by name, from the `powers` pack) onto the actor, sets `wildTalent { tested, found, levelAtDiscovery }` in one update with the card. On a dire roll: the card shows the save and the loss and an Apply button.
- `applyDire(actor, outcome)`: owner or GM, behind a confirmation dialog, rolls/uses the recorded loss and lowers the BASE ability score(s) (never below 3), one update on the actor's own data; idempotent per card (an applied marker).
- `resetWildTest(actor)`: GM only; clears `tested` (and does not remove granted powers).
- Chat buttons follow the Plan C pattern (`renderChatMessageHTML` in `chat-listeners.ts`).

## Sheet and settings

- Setting `wildTalents` (boolean, default false, `requiresReload`) in `OptionalRules` and the registry (core group), lang name/hint.
- A "Wild talent" panel on the Features tab for non-psionicists when the setting is on: the test button and surgeon checkbox (before the test), the result summary after (the chance and found/not found), and a GM-only Reset button. After a talent is found the Psionics tab appears (the Plan A gate) with a "Wild talent" tag and without the learning controls.

## Non-weapon proficiencies

- `NonweaponGroup` gains `"psionicist"`; `NONWEAPON_GROUPS` and the class map gain it (`psionicist: ["psionicist", "general"]`).
- Four new items in the nonweapon-proficiencies pack, group `psionicist`: Harness Subconscious (2 slots, Wis -1), Hypnosis (1, Cha -2), Rejuvenation (1, Wis -1), Meditative Focus (1, Wis +1), each with an original one-sentence description. The four shared proficiencies (Gem Cutting 2/Dex -2, Musical Instrument 1/Dex -1, Reading/Writing 1/Int +1, Religion 1/Wis +0) gain an optional `alsoGroups: ["psionicist"]` so a psionicist pays the Table 11 cost; the slot-cost rule treats an item as in-group when its group or any `alsoGroups` entry is one of the class's groups.

## Out of scope

Automating Harness Subconscious (+20% PSPs for 72 hours), Meditative Focus (discipline score shifts), Hypnosis and Rejuvenation effects; the psychic surgeon NPC; NPC and monster wild talents; granting wild talents outside the test button.

## Testing

Pure tests for the chance formula (each modifier, the halving, the book's example), the d100 tables at every range boundary, the dire table, `wildPsp`, `testWildTalent`; schema defaults; derive tests (wild PSP with levels gained; a psionicist unaffected; no talent: null); action tests with fakes and exact numbers (chance, roll, powers granted incl. prerequisites, a skipped duplicate, `levelAtDiscovery`, refusals: setting off, psionicist, already tested; the dire apply lowering the base ability, floor 3, idempotence; GM reset); the proficiency items and cost rule (psionicist pays the Table 11 costs, others pay +1 for the new group); lang, bindings and pack census tests. Headless proof (real schema and derive, the real powers pack for the granted powers, rendered panel and cards). Manual dev-world check (the user): with the setting on, a non-psionicist character with stated scores shows the chance, a forced low roll finds a talent and the powers appear with the right PSP maximum, a forced 97+ shows the dire card and Apply lowers the ability, the button locks, the GM reset works, the setting off hides everything, and a non-GM seat.
