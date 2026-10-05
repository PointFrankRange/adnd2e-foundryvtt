# Character kit engine, Plan A (foundation) — Design

Date: 2026-10-04. Source: the 2026-09 mechanics review, Tier 0 ("Generic character-kit engine", `docs/mechanics-review-2026-09.md`); the Complete Handbooks (PHBR1-15) for the shape of kits. Sub-project 11 of the review, Plan A of three.

## Approved decisions

- Sub-project 11 is delivered in three plans. **Plan A (this spec):** the engine foundation. **Plan B (later):** parametrized granted powers. **Plan C (later):** base-class ability overrides (the Ghosthunter case).
- A kit is an owned `kit` Item, like `trait` and `race`. It is not an ActiveEffect and not a field on the class item. This follows SP8's rule: a closed typed set, interpreted by pure derive code.
- Equipment restrictions **warn and still equip** (toast plus a "not permitted" flag on the row). Kit qualifications **hard-block the drop** with a reason toast.
- The base class restrictions already in the chassis data (`armorAllowed`, `weaponsAllowed`) become real in this plan, so kits have something to override.
- Content policy holds: only mechanical data ships, no rulebook prose. Kit content is user-authored through the importer, plus two or three tiny sample kits.

## Kit item

A `kit` Item stores:

- `chassisId`: the class chassis it modifies. A kit attaches to an actor that has a class item with this chassis.
- `qualifications`: ability minimums (per ability), allowed races (empty = any), allowed alignments (empty = any).
- `xpModifierPercent`: an integer percentage added to the XP needed per level for that class (0 = none, +25 = 25% more XP per level).
- `effects`: an array of typed effects using the existing trait kinds (`abilityBonus`, `saveBonus`, `attackBonus`, `proficiencySlots`, `bonusHp`). A kit can list several; a trait holds one.
- `equipment`: for armor and for weapons, a mode (`inherit` / `replace` / `extend`) and a list. `inherit` keeps the class rule; `replace` swaps it; `extend` adds to it.
- `forbiddenWeaponProficiencies`: names or groups the kit cannot take.
- `grantedFeatures`: names of linked `classFeature` items, shown on the sheet (the same pattern `class` and `race` items already use).

## Rules core (pure, unit-tested): `src/core/kits/`

- `kitQualifies(kit, actor)`: checks ability minimums against the actor's scores, race, and alignment. Returns `{ ok, reason }` with an i18n reason key for the first failure.
- `kitEffectTotals(effects)`: reduces a kit's effects to the same totals shape traits produce. The trait reducer is refactored into one shared function that both traits and kits call, so the interpretation lives in one place.
- `resolveEquipmentRule(base, override)`: combines the class chassis rule with a kit's `inherit`/`replace`/`extend`.
- `armorPermitted(rule, armor)` and `weaponPermitted(rule, weapon)`: yes or no for an armor or weapon item.
- `kitXpThreshold(baseThreshold, percent)`: the scaled XP needed per level (floor of the base × (100 + percent) / 100).
- The chassis restriction data uses names that don't match item data: armor lists use names such as "studded leather" and "elven chain" (items use ids such as `studded-leather`), and weapon rules use a category "blunt" (items use `melee`/`thrown`/`bow`/`crossbow` plus a `damageType`). A pure normalizer maps both vocabularies. A test asserts every existing chassis entry resolves, so an unmappable name fails loudly.

## Base-class restrictions

- Equipping an armor or weapon item that the actor's class (plus kit) does not permit shows a warning toast and sets a "not permitted" flag on the row. The item still equips.
- Unequipped items are never flagged, and carrying is never restricted.
- Multiclass: an item is permitted if any of the actor's classes permits it, and each class resolves its own kit. This is the repo's usual best-of rule; the plan verifies it against how multiclass is handled elsewhere.

## Attaching a kit

- Dropping a kit on a character sheet is hard-blocked, with a reason toast, if: the actor has no class item with the kit's chassis; that class already has a kit; or `kitQualifies` fails. A Character NPC accepts the drop like the PC sheet only if the plan confirms that sheet accepts kit drops cleanly; otherwise it rejects them as it rejects traits.
- Kit effect totals fold into the derived values beside the trait totals. They apply regardless of the SP8 character-point rule (traits are gated by it; kits are not).
- `xpModifierPercent` scales that class's XP thresholds in the level and level-up derivation.
- The Features tab lists the kit with its effects and linked features. The free-text `details.kit` and the `class.kit` string remain as display text and are not used by the engine.
- Forbidden weapon proficiencies are checked on weapon-proficiency drops, using the same hard-block as the other drop rules.

## Content and tooling

- A new `kits` compendium with two or three tiny sample kits (mechanical data only, to prove the engine end to end).
- The existing content importer accepts `kit` items; the import envelope and its tests are extended if they enumerate item types.

## Out of scope

- Parametrized granted powers (Plan B) and base-class overrides (Plan C).
- Required or auto-granted proficiencies and equipment; only forbidden proficiencies are enforced.
- Race-based kits and subraces (Sub-project 12).
- Bespoke kit mini-mechanics (the Wizard Slayer and similar situational combat rules).

## Testing

- Pure tests: qualification pass and every failure reason, effect totals including a multi-effect kit, `inherit`/`replace`/`extend`, XP threshold scaling (including 0%), the normalizer against every chassis restriction entry, and armor/weapon permission cases.
- Schema, drift and lang tests: the `kit` item subtype is registered, the drift tests and en-coverage pass, and the pack builds.
- Dev-world, including a **non-GM player seat**: drop a qualifying kit; drop one that fails each qualification; a second kit on the same class; equip a disallowed armor and weapon (warning, still equips); a kit effect visible in derived values; the XP modifier visible in the level threshold; a forbidden weapon proficiency refused; a multiclass character.
