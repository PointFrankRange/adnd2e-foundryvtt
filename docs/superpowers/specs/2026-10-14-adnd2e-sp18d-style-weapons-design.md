# SP18 Plan D - Style weapons (PHBR15 ch.4)

Issue: #86. Source: *The Complete Ninja's Handbook* ch.4 ("Weapons Allowed", Table 13 weapon groups, Table 17 styles, the maneuver descriptions).
Table values and each maneuver's "Weapons Allowed" line are read from the page images, not the OCR.

## Rules summary

- A style's Table 17 row lists "Weapons Allowed" (tight groups). To use a weapon with that style's special maneuvers the character spends **one weapon proficiency slot per tight group** from that list, and must also be proficient with the specific weapon.
- Once a group is bought, any weapon the character knows from it can be used with any special maneuver that permits weapons.
- Each special maneuver states its own "Weapons Allowed": none, any, or specific tight groups.
- The slot comes out of the style's two-per-experience-level cap shared with maneuvers.

## Decisions (made with the user, 2026-10-14)

- Scope: purchase + tracking **and** armed maneuvers (option B).
- Armed damage: the weapon's own damage (by target size) + Strength + its magic bonus **replace** the style die / Table 16 blow. The maneuver's other effects (saves, conditions, penalties, Table 21 armor-group modifier) are unchanged.
- The weapon's magic bonus feeds the Plan C enchantment rank.
- A weapon the style does not cover gets a card hint, not a hard block; a weapon the character is not proficient with takes the usual non-proficiency penalty.

## Data

- `martialStyle.system.knownWeaponGroups: string[]` (tight-group ids bought on this style), default `[]` via `initial: () => []`. No migration. The existing `weaponGroups` keeps meaning "what this style offers"; names are normalized to group ids ("Any Tight Group of Melee Weapons" = every group).
- Maneuver registry: each `ManeuverDef` gains `weapons: "none" | "any" | string[]` authored from the book.

## Architecture

- `src/core/martial-arts/weapon-groups.ts` (pure): Table 13 tight groups as data (id, label key, member weapon names, overlaps allowed, "not part of a tight group" items excluded); `weaponTightGroups(name, baseName)` (base name first, `+N` and case stripped); `offeredGroupIds(style.weaponGroups)`; `canLearnGroup`/learn/unlearn updates sharing the maneuver slot rules (free slot, 2-per-level cap, refund).
- Armed resolution in `src/core/martial-arts/`: `isArmedManeuver({maneuver, knownGroups, weapon})` and an armed damage helper; the card builders take an optional `armed` block (weapon name, damage dice, magic bonus, proficiency flag) and drop the stun trigger when armed.
- Glue: `martial-arts-actions.ts` reads the equipped melee weapon, passes the armed block, and feeds the weapon's magic bonus to `attackRank`.
- UI: Features management view gets a "Weapon groups" block per style (Learn/Unlearn, locked reasons reuse the maneuver reasons); Main lists a style's learned groups under its maneuvers; chat card shows the armed line and hints.

## Testing

- Pure unit tests at 100% coverage: registry matching (names, `+1`, overlaps, ungrouped items), learn/unlearn with the shared cap and refund.
- Census: every registry maneuver has `weapons`; every group a shipped style names resolves.
- Card tests: armed damage replaces the blow, enchantment rank, no stun trigger, hints.
- Headless proof: pack import of all 8 styles, schema default with no shared leak, template render.
- Manual dev-world checklist with stated prerequisites (a PC with Jujutsu and a Fighter class, a proficient Oriental Blades weapon, a Monster NPC needing +1) and a non-GM seat.

## Risks

- About 40 hand-read per-maneuver weapon lines; unreadable ones are flagged to the user.
- Name-based matching shares the existing exact-name limitation for renamed weapons; documented.
- Kung Fu ("any tight group") and Karate ("Karate Weapons") need explicit handling.

## Out of scope

Weapon Breaker's own rules, the Weapon principal method's damage-by-weapon path, ninja-only weapon proficiency costs (Table 11 broad groups), and weapon specialization on groups.
