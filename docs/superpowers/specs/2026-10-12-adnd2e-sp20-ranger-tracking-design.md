# Sub-project 20: Ranger tracking — design

Date: 2026-10-12 · Issue: #88 · Branch: `feat/sp20-ranger-tracking` · Source: The Complete Ranger's Handbook (PHBR11), Ranger Abilities ch. — Tracking (pp.14-17), Tables 14-19; primary terrain (pp.12-13).

## Background

Rangers are expert trackers. The handbook gives a score-based check: the base Tracking score is the ranger's Wisdom, modified by terrain (Table 15), illumination (Table 16) and special situations (Table 17); the ranger rolls 1d20 and succeeds on a roll no greater than the modified score (a natural 20 always fails); a modified score of zero or less means no tracking is possible. While tracking, movement is capped by the modified score (Table 18). After a successful tracking check the ranger may attempt a second check, the Identification check, with the same score and modifiers; its success yields information that is cumulative by ranger level (Table 19). Interruptions (moving too fast, changed terrain or light, a crossed trail, a distraction) lose the trail; finding it again takes an hour and a new check at the new modifiers, and a failure loses it for good. A ranger who moves at half rate hides his own trail (others track him at −5, or −7 when he is a terrain-specialized ranger in his primary terrain). An optional rule lets a ranger specialize in his one primary terrain (nine terrains, Table 14), which affects tracking in the ways listed below.

The system has a ranger class chassis and the Tracking non-weapon proficiency item, but nothing implements the tracking check, its tables or primary terrain.

## Decisions (made with the user)

- **A tracking dialog on the ranger sheet that does the number work.** Whether the trail is currently found or lost is not stored; a re-find is just another Track with the new conditions. The narrative pre-conditions and interruption triggers stay with the DM.
- **Primary terrain is stored on the ranger** with a specialization flag; the dialog offers the "trail is in my primary terrain" bonus only for a specialized ranger.
- Tables 15-19 are published mechanical values transcribed with page citations (this project's convention for PHB/DMG-style tables); labels are short own-wording names, not book prose.

## Design

### 1. Pure rules — `src/core/tracking/` (Foundry-free, in the coverage gate)

- **Tables:**
  - Terrain (Table 15, use one): fresh snow +6; soft or muddy ground / loose dirt floor +4; thick brush or dense jungle +3; forests, fields, dusty indoor area +2; normal ground / wood floor / sparse plains 0; desert or dry sand −2; swamp −5; rocky terrain, solid ice, stone floors or shallow water −10.
  - Illumination (Table 16, use one): good light (sunny day, continual light or equivalent indoors) 0; twilight, light fog, snow or a single torch in a dark interior −3; night with full moon or day with moderate fog −6; overcast night with no moon, dense fog, blizzard or blowing sand −10.
  - Movement limit (Table 18): modified score 1-6 → 1/4 of normal; 7-14 → 1/2; 15 or more → 3/4.
  - Identification by ranger level (Table 19, cumulative): 1-2 general type of creature; 3-4 specific type and heading; 5-6 probable number of creatures; 7 approximate size or age; 8 pace; 9 how recent the trail is; 10+ special conditions (wounded, mounts, and so on).
- **`trackingScore(input)`** computes the modified score and returns it with the ordered modifier breakdown. Input: `wisdom`, `level`, `terrain` (one id or none), `illumination` (one id or none), `creaturesTracked`, `assistingTrackers`, `animalFollower`, `trailInPrimaryTerrain`, `hoursSinceMade`, `rainHours`, `quarryHidesTrail`, `quarryIsSpecializedHiding`, `nonNatural`. Special modifiers (Table 17, all applicable): +1 per two creatures tracked (floor); +1 per three ranger levels (floor); +1 per assisting tracker, total assistance capped at the level bonus; +1 for an animal follower assisting; +2 for a trail in a specialized ranger's primary terrain; −1 per 12 full hours since the trail was made; −5 per hour of rain, snow or sleet since; −5 when the quarry hides its trail; −2 more when the quarry is a specialized ranger hiding in his primary terrain. Non-natural surroundings halve the final modified score (rounded down). Counts are clamped to non-negative integers.
- **`canTrack(score)`** is true when the modified score is greater than zero.
- **`resolveCheck(roll, score)`** returns success when `roll <= score` and `roll !== 20`.
- **`movementLimit(score)`** returns `"quarter" | "half" | "threeQuarters"` for the Table 18 bands (null below 1).
- **`identificationInfo(level)`** returns the cumulative ordered list of information-type ids a ranger of that level receives.

### 2. Data

`system.tracking` on the actor common schema: `primaryTerrain` (blank or one of aquatic, arctic, desert, forest, hill, jungle, mountain, plain, swamp) and `specialized` (boolean). Defaults only, no migration. Edited on the Tracking panel when the sheet is unlocked, shown as text when locked.

### 3. The Tracking panel and Track dialog (PC sheet only)

- A Tracking panel on the Features tab, shown only for characters with a ranger class entry. It shows the primary terrain and specialized fields and a **Track…** button (disabled when the character cannot act, matching the #142 attack gate).
- The dialog is a `themedPrompt` form: terrain select (one), illumination select (one), number inputs for creatures tracked, assisting trackers, hours since the trail was made and rain hours; checkboxes for animal follower, non-natural surroundings, quarry hides its trail, and "quarry is a specialized ranger hiding in his primary terrain"; the "trail is in my primary terrain" checkbox only when the ranger is specialized; and "Also attempt the identification check" (on by default). It displays the live modified score, whether tracking is possible and the movement limit as inputs change.
- The result is computed by the pure functions; the glue only reads the form, rolls and posts.

### 4. The roll and the chat card

- On OK: roll 1d20 for tracking (nothing is rolled when the score is zero or less; the card says tracking is not possible). On success and with identification ticked, roll a second 1d20 against the same score. Natural 20 always fails.
- One chat card, `templates/chat/ranger-tracking.hbs`, built from a pure context builder in `src/core/tracking/card.ts`: the modifier breakdown list (existing `.modifiers` style), the modified score, each roll with a hit or miss result line (existing `.result.hit` / `.result.miss`), the movement limit, and on an identification success the information types received (cumulative by level). It uses only existing chat classes, so the stylesheet census needs no new rule; the chat template count assertion goes 16 → 17.
- A re-find of a lost trail is another Track; whether the trail is found or lost is not stored.

### 5. Out of scope

Persistent tracking state; the pre-condition and interruption triggers (DM adjudicates); Character NPC rangers (the panel is PC-sheet only); the random primary terrain table (Table 14); other primary-terrain features (animal training and so on); the Player's Handbook Tracking proficiency for non-rangers; covering one's own movement beyond the −5/−7 modifiers the quarry-hides options already model.

## Testing

- Unit tests for every table row, each special modifier, the assistant cap, the halving and its rounding, the zero-or-negative score, `resolveCheck` including a natural 20 and a roll equal to the score, all three movement bands and the below-1 case, and every identification level boundary (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15).
- Schema defaults and the card builder tested; template binding tests for the panel and its actions, lang coverage, the chat-card census count, and the `themedPrompt` guard.
- A headless proof against the real data models: `system.tracking` defaults and round trip, the dialog's pure resolution end to end for several scenarios (worked examples below), template renders of the panel for a ranger, a non-ranger and a specialized ranger, and the chat template for a success, a failure, an impossible track and an identification success.
- Worked examples used as tests: a level 7 ranger with Wisdom 15 on normal ground in good light has 15 + 2 (level) = 17; the same ranger tracking 4 creatures through fresh snow (+6) at twilight (−3) 24 hours after they passed (−2) has 15 + 2 + 2 (group) + 6 − 3 − 2 = 20; in rocky terrain at night with a full moon (−10, −6) the score is 15 + 2 − 10 − 6 = 1, quarter movement.
- Gates before the PR: `npm run lint`, `npm run typecheck` (including `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Manual dev-world checklist including a non-GM seat: a ranger and a specialized ranger, the panel fields, several dialog combinations against the worked examples, success and failure, the identification flow at levels 2, 5 and 10, and the card in both Foundry themes.

## Risks

- **Halving order:** the book says "the Tracking chances are halved" in non-natural surroundings without saying before or after the modifiers; this design halves the final modified score. It is a stated, tested choice.
- **Assisting-tracker rule:** "use the score of the best tracker" is a table note; this design takes the assistance count as input and caps the bonus (+1 per 3 ranger levels); the helper's own score is not modelled.
- Table 19 rows are cumulative: a level 6 ranger gets every type up to level 6, not only the 5-6 row.
