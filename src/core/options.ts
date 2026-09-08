/**
 * The optional-rules toggle bag passed into every `core/` function whose result
 * a rule switch can change. `data/` builds this from `game.settings`
 * (`getOptionalRules()`); `core/` only ever receives it as a parameter.
 *
 * Only the `core`-group toggles live here. `combatAndTactics.*` /
 * `skillsAndPowers.*` / `spellsAndMagic.*` settings are registered but are not
 * part of this bag until their sub-project wires the branches (spec §6.2).
 */
export interface OptionalRules {
  /** PHB p.18: warriors roll d100 for exceptional Strength at STR 18. */
  exceptionalStrength: boolean;
  /** PHB p.17: cap on spells known per level from Intelligence (Table 4). */
  maxSpellsPerLevel: boolean;
  /** PHB p.79 / DMG: weapon speed factors modify initiative. Branch is Sub-project 3. */
  weaponSpeedInitiative: boolean;
  /** PHB Table 5: a priest's chance of spell failure from low Wisdom. */
  spellFailureFromWisdom: boolean;
  /** DMG optional: a character must train (time + money) before gaining a level. */
  trainingRequiredToLevel: boolean;
  /** PHB p.51: the non-weapon proficiency system is in use. */
  nonweaponProficienciesUsed: boolean;
  /** PHB p.51: the weapon proficiency system is in use. */
  weaponProficienciesUsed: boolean;
  /** PHB p.44: a multi-class character's hit points are the averaged roll. */
  multiclassHpAveraging: boolean;
}

export const DEFAULT_OPTIONAL_RULES: OptionalRules = {
  exceptionalStrength: true,
  maxSpellsPerLevel: false,
  weaponSpeedInitiative: false,
  spellFailureFromWisdom: true,
  trainingRequiredToLevel: false,
  nonweaponProficienciesUsed: true,
  weaponProficienciesUsed: true,
  multiclassHpAveraging: true,
};
