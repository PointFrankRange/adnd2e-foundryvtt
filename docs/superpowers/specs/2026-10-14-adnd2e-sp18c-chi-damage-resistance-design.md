# SP18 Plan C — Damage resistance by enchantment, and Ch'i Attacks (PHBR15 Table 20)

Issue: #86. Source: PHBR15 ch.4 (Ch'i Attacks, Table 20, pp.58-59); the DMG/Monstrous Manual convention "hit only by magical / +N or better weapons". Builds on SP18 Plans A, B1-B3 (martial arts styles, maneuver registry, constants summary, the `mental:4` placeholder).

## Scope (option A, decided)
1. A **damage-resistance hook**: a Monster NPC can require a minimum weapon enchantment to be harmed; physical attacks below it cannot harm it.
2. **Ch'i Attacks** (`mental:4`) stops being a placeholder: unarmed martial arts hits count as a magical weapon by level (Table 20).

Out of scope: spells, breath weapons and psionics (no weapon enchantment); materials such as silver and cold iron (the unused `materialToHit` weapon field); Mental Resistance and All-Around Sight as numbers; Character NPCs and player characters as defenders; creatures as attackers.

## Rules

### Enchantment rank (pure, `src/core/enchantment/`)
| Rank | Requirement / source |
|---|---|
| 0 | none required / a nonmagical weapon (magicBonus <= 0) or bare fists |
| 1 | "magical weapons" / ch'i at levels 1-4 |
| 2 | +1 or better / a +1 weapon / ch'i levels 5-9 |
| 3 | +2 / ch'i 10-14 |
| 4 | +3 / ch'i 15-19 |
| 5 | +4 / ch'i 20+ |
| 6 | +5 or better |

- `requirementRank(req)`: `""`->0, `magical`->1, `plus1`..`plus5`->2..6.
- `weaponRank(magicBonus)`: `magicBonus >= 1 ? magicBonus + 1 : 0`.
- `chiRank(level)`: 1-4 -> 1, 5-9 -> 2, 10-14 -> 3, 15-19 -> 4, 20+ -> 5; level < 1 -> 0.
- `attackRank({ weaponMagicBonus, ammoMagicBonus?, chiLevel? })` = the maximum of `weaponRank(weaponMagicBonus)`, `weaponRank(ammoMagicBonus)` when ammunition is used, and `chiRank(chiLevel)` when ch'i applies (unarmed martial arts attacks only).
- `canHarm(attackRank, requirement)` = `attackRank >= requirementRank(requirement)`.
- `requirementLabelKey(req)` for display, and `HIT_REQUIREMENTS = ["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"]`.

### Effect
- The attack still rolls to hit normally. When it **hits** but cannot harm the target, the card says so and offers nothing to apply: no Roll Damage button (weapon attacks), no damage, no Apply Damage, no condition effects, no stun prompt (martial arts cards).
- A **miss** is just a miss. No target token (typed-in AC) means no requirement.
- Crit/fumble bookkeeping is unchanged.

### Ch'i
- Known when `mental:4` is in `knownManeuvers` of ANY owned style (like the other constants). Only the unarmed martial arts attack and maneuver cards use the ch'i rank, at the character's highest class level. A wielded weapon attack uses the weapon's rank only.
- The "Always in effect" summary lists Ch'i Attacks (order: mental:2, 3, 4, 5, 6) with the current result, e.g. "Ch'i Attacks - at level 10 your unarmed hits count as a +2 magical weapon". `martialManeuverEffects.chiAttacks` is reworded to describe the rule (no longer "a reminder").

## Data and UI
- `CreatureModel.details.hitRequirement`: StringField, `choices: HIT_REQUIREMENTS`, `blank: true`, initial `""` (defaults only, no migration).
- Monster NPC sheet (`templates/actor/creature/left.hbs`, beside Magic Resistance): editable select "Hit only by" when unlocked, a read-only line when locked (a dash for none). Context types/builders in `src/sheets/creature/context*.ts` carry the value.
- `resolveTargetCombatInfo` (src/sheets/character/combat-rolls.ts) also returns `hitRequirement` (creature: `details.hitRequirement`; everything else: `""`).
- Lang: `ADND2E.hitRequirements.{none, magical, plus1..plus5}` labels ("None", "Magical weapons", "+1 or better", ...), `ADND2E.sheet.creature.hitRequirement` ("Hit only by"), `ADND2E.chat.attack.noEffect` ("No effect: this creature can only be hit by {requirement}.") and `ADND2E.chat.martialArts.noEffect` (same copy), `ADND2E.martialChi.rank0..rank5` for the summary result ("no magical power" for 0 is never shown).

## Architecture
- `src/core/enchantment/{index,rank}.ts` pure + tests; exported from `src/core/index.ts`.
- Weapon attacks: `rollAttack` in src/sheets/character/combat-rolls.ts computes the attack rank (weapon + ammo item when a launcher), checks the target's requirement, and passes `ineffective: { requirementKey }` to `buildAttackCardContext`; `damageContext` is dropped and the template shows the no-effect line instead of the Roll Damage button.
- Martial arts: `martial-arts-actions.ts` computes the ch'i rank from `view.constants` and level, checks the target requirement in `resolveTarget()`'s result, and passes `ineffective` into the three card builders (plain attack, maneuver, skill unaffected); the card context drops damage/effects/stun when set.
- View: `constants.chi: { known: boolean; rank: number; labelKey: string }` and the summary gains the Ch'i row with its result key.

## Testing and verification
Unit tests: ranks at every Table 20 boundary (4/5, 9/10, 14/15, 19/20, 0 and negative levels), `weaponRank`, `canHarm` matrix (every requirement against ranks 0..6), `attackRank` taking the maximum (launcher vs ammo vs ch'i), card ineffective paths (weapon card and both martial arts cards), the view's chi constants and summary order, the creature schema pin and sheet bindings, lang keys. A headless proof for the real Foundry schema (creature `hitRequirement` validates, a bad value is rejected) and card rendering. CI sequence including coverage 100% and a build check per task; a dev-world checklist (a "+1 or better" Monster NPC; plain sword no effect; +1 sword works; a magical-only creature vs a level-3 ch'i monk; a +2-only creature vs a level-9 monk fails and a level-10 monk works).
