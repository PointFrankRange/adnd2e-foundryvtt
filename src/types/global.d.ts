import type { Adnd2eConfig } from "../config";

export {};

declare global {
  interface CONFIG {
    ADND2E: Adnd2eConfig;
  }

  interface SettingConfig {
    // core — wired into OptionalRules
    "adnd2e.exceptionalStrength": boolean;
    "adnd2e.maxSpellsPerLevel": boolean;
    "adnd2e.weaponSpeedInitiative": boolean;
    "adnd2e.spellFailureFromWisdom": boolean;
    "adnd2e.trainingRequiredToLevel": boolean;
    "adnd2e.nonweaponProficienciesUsed": boolean;
    "adnd2e.weaponProficienciesUsed": boolean;
    "adnd2e.multiclassHpAveraging": boolean;
    // combatAndTactics — reserved for Sub-project 7
    "adnd2e.combatAndTacticsEnabled": boolean;
    "adnd2e.criticalHits": boolean;
    "adnd2e.calledShots": boolean;
    "adnd2e.combatManeuvers": boolean;
    "adnd2e.armorTypeVsWeaponType": boolean;
    "adnd2e.weaponMastery": boolean;
    // skillsAndPowers — reserved for Sub-project 8
    "adnd2e.skillsAndPowersEnabled": boolean;
    "adnd2e.subAbilityScores": boolean;
    "adnd2e.characterPointBuild": boolean;
    "adnd2e.expandedProficiencies": boolean;
    // spellsAndMagic — reserved for Sub-project 9
    "adnd2e.spellsAndMagicEnabled": boolean;
    "adnd2e.spellPoints": boolean;
    "adnd2e.expandedCastingTime": boolean;
    "adnd2e.channelers": boolean;
  }
}
