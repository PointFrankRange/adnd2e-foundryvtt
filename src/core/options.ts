/**
 * The optional-rules toggle bag passed into every `core/` function whose result
 * a rule switch can change. `data/` builds this from `game.settings`
 * (`getOptionalRules()`); `core/` only ever receives it as a parameter.
 *
 * `core`, `combatAndTactics`, `skillsAndPowers` and `spellsAndMagic` group toggles all live here
 * (Sub-projects 7, 8 and 9 wired those latter three). `spellsAndMagic.spellPoints` and `.channelers` are registered but not implemented (they come from *Player's Option: Spells & Magic*, which this system does not reference).
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
  /** Sub-project 7 master switch — every other combatAndTactics.* key is a
   *  no-op unless this is also true. */
  combatAndTacticsEnabled: boolean;
  /** Sub-project 7 Plan 7b: critical-hit/fumble severity tables. */
  criticalHits: boolean;
  /** Sub-project 7 Plan 7d: called shots. */
  calledShots: boolean;
  /** Sub-project 7 Plan 7d: the curated combat-maneuver set. */
  combatManeuvers: boolean;
  /** Sub-project 7 Plan 7b: weapon-damageType vs armor-type modifiers. */
  armorTypeVsWeaponType: boolean;
  /** Sub-project 7 Plan 7c: the weapon-mastery tier system. */
  weaponMastery: boolean;
  /** Sub-project 8 master switch — every other skillsAndPowers.* key is a
   *  no-op unless this is also true. */
  skillsAndPowersEnabled: boolean;
  /** Sub-project 8 Plan 8a: sub-ability scores (12 sub-scores average into the 6 main scores). */
  subAbilityScores: boolean;
  /** Sub-project 8 Plan 8c: the character-point build (sub-scores + traits). */
  characterPointBuild: boolean;
  /** Sub-project 8 Plan 8b: related-weapon proficiency penalty + specific-weapon proficiencies. */
  expandedProficiencies: boolean;
  /** Sub-project 9 master switch — every other spellsAndMagic.* key is a
   *  no-op unless this is also true. */
  spellsAndMagicEnabled: boolean;
  /** Sub-project 9 Plan 9a: PHB casting time + spell disruption (PHB p.86-87, p.95). */
  expandedCastingTime: boolean;
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
  combatAndTacticsEnabled: false,
  criticalHits: false,
  calledShots: false,
  combatManeuvers: false,
  armorTypeVsWeaponType: false,
  weaponMastery: false,
  skillsAndPowersEnabled: false,
  subAbilityScores: false,
  characterPointBuild: false,
  expandedProficiencies: false,
  spellsAndMagicEnabled: false,
  expandedCastingTime: false,
};
