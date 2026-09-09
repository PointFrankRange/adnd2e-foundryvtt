import type { Adnd2eConfig } from "../config";

export {};

declare global {
  interface CONFIG {
    ADND2E: Adnd2eConfig;
  }

  interface DocumentClassConfig {
    Actor: typeof import("../documents/actor").Adnd2eActor;
    Item: typeof import("../documents/item").Adnd2eItem;
    ActiveEffect: typeof import("../documents/active-effect").Adnd2eActiveEffect;
  }

  interface DataModelConfig {
    Actor: {
      character: typeof import("../data/actor/character").CharacterModel;
      npc: typeof import("../data/actor/npc").NpcModel;
      creature: typeof import("../data/actor/creature").CreatureModel;
    };
    Item: {
      class: typeof import("../data/item/class").ClassItemModel;
      race: typeof import("../data/item/race").RaceItemModel;
      weapon: typeof import("../data/item/weapon").WeaponItemModel;
      armor: typeof import("../data/item/armor").ArmorItemModel;
      equipment: typeof import("../data/item/equipment").EquipmentItemModel;
      spell: typeof import("../data/item/spell").SpellItemModel;
      weaponProficiency: typeof import("../data/item/weapon-proficiency").WeaponProficiencyItemModel;
      nonweaponProficiency: typeof import("../data/item/nonweapon-proficiency").NonweaponProficiencyItemModel;
      classFeature: typeof import("../data/item/class-feature").ClassFeatureItemModel;
    };
    ActiveEffect: {
      adnd2e: typeof import("../data/active-effect/adnd2e").Adnd2eActiveEffectModel;
    };
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
