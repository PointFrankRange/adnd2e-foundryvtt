# SP18 Plan D - Style weapons (PHBR15 ch.4)

Issue: #86. Source: *The Complete Ninja's Handbook* ch.4 pp.30-33 (Table 13 weapon groups), pp.44-59 (Table 17, "Weapons Allowed", each maneuver's "Weapons Allowed" line). All values below were read from the page images.

## Rules summary

- A style's Table 17 row lists "Weapons Allowed" (tight groups). To use a weapon with a style's special maneuvers the character spends **one weapon proficiency slot per tight group** from that list, and must also be proficient with the specific weapon.
- Once a group is bought, any weapon the character knows from it can be used with any special maneuver that permits weapons.
- Each special maneuver states its own "Weapons Allowed": none, any, or specific tight groups ("using shafts" qualifiers noted in data only).
- The slot comes out of the style's two-per-experience-level cap shared with maneuvers.
- Real mechanical hooks: sai/jitte give +2 to hit with Basic Parry, Parry All and Locking Block; chain or rope weapons +2 with Grappling Block; Weapon Breaker requires wielding "a martial arts weapon" (a weapon from a bought group).

## Decisions (user, 2026-10-14)

- Scope B: purchase + tracking **and** armed use, **book-faithful**: armed use is a gate, a bonus and card hints. **Damage is never replaced by the weapon's dice** (no attack maneuver in the book says so; the weapon lists mostly enable gripping/trapping maneuvers). The earlier "weapon dice replace" idea was dropped after reading every maneuver line.
- A weapon the style does not cover gets a card hint, not a hard block, except Weapon Breaker which needs a style weapon.
- Shield +2 on Arrow Parry is out of scope (shields are armor items, not weapons).

## Data

- `martialStyle.system.knownWeaponGroups: { id: string, level: number }[]` (tight-group ids bought on this style and the level bought), default `[]` via `initial: () => []`; same shape as `knownManeuvers`. No migration. `slotsInvested` rises by 1 per group. A fresh/dropped style resets it with the other fresh fields.
- The existing `weaponGroups` (names) keeps meaning "what this style offers"; names map to ids ("Any Tight Group of Melee Weapons" = every melee group).
- Per-maneuver permissions and hit bonuses are data tables beside the maneuver registry (a census test asserts every registry maneuver has an entry).

## Architecture

- `src/core/martial-arts/weapon-groups.ts` (pure): Table 13 melee tight groups, name normalization (strips `+N`, case, punctuation), `weaponGroupIdsFor`, `offeredGroupIds`, `groupLearnability`, `unlearnGroupUpdate`.
- `src/core/martial-arts/weapon-use.ts` (pure): `MANEUVER_WEAPONS`, `WEAPON_HIT_BONUS`, `assessWeaponUse` returning `unarmed | ok | uncovered | notAllowed | needsStyleWeapon`, `covered`, `hitBonus`.
- `learnability` counts bought groups toward the 2-per-level cap.
- View: each style row carries its offered groups with state and the known groups; Features lists them with Learn/Unlearn, Main shows the known groups per style.
- Glue: learn/unlearn actions (re-validated, 1 slot, themedConfirm on unlearn); `useManeuver` reads equipped melee weapons, adds a +2 weapon-bonus row, posts the hint, and refuses Weapon Breaker without a style weapon.

## Testing

Pure unit tests at 100% coverage; census tests (every maneuver has a weapons entry, every shipped style's weaponGroups resolve to known ids); card/template binding tests; headless proof (schema default, pack import of 8 styles, template render); manual dev-world checklist with stated prerequisites and a non-GM seat.

## Risks / out of scope

- Name-based matching has the existing exact-name limitation for renamed weapons (documented).
- Out of scope: weapon-by-weapon "shaft only" enforcement, shield +2, Steel Cloth cloth-as-spear, ninja Table 11 broad-group costs, specialization on groups, missile/throwing groups.
