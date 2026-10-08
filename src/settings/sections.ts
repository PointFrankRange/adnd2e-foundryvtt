// Pure layout of the Configure Settings panel: which section each setting sits in
// and whether that section is Core or Optional. `src/settings/sections-ui.ts`
// applies this to Foundry's rendered form; nothing here touches stored values.
export type SectionKind = "core" | "optional" | "table";

export interface SettingSection {
  readonly id: string;
  /** i18n leaf: `ADND2E.settings.sections.<id>` */
  readonly kind: SectionKind;
  /** setting keys, in display order */
  readonly keys: readonly string[];
}

export const SETTING_SECTIONS: readonly SettingSection[] = [
  {
    id: "coreRules", kind: "core",
    keys: [
      "exceptionalStrength", "maxSpellsPerLevel", "weaponSpeedInitiative", "spellFailureFromWisdom",
      "trainingRequiredToLevel", "nonweaponProficienciesUsed", "weaponProficienciesUsed", "multiclassHpAveraging",
      "enforceRaceClassRestrictions", "primeRequisiteXpBonus", "racialLevelLimits",
    ],
  },
  { id: "racesAndLevels", kind: "optional", keys: ["exceedLevelLimits", "primeRequisiteBonusLevels"] },
  {
    id: "combatAndTactics", kind: "optional",
    keys: ["combatAndTacticsEnabled", "criticalHits", "calledShots", "combatManeuvers", "armorTypeVsWeaponType", "weaponMastery", "wrestling"],
  },
  {
    id: "skillsAndPowers", kind: "optional",
    keys: ["skillsAndPowersEnabled", "subAbilityScores", "characterPointBuild", "expandedProficiencies"],
  },
  {
    id: "spellsAndMagic", kind: "optional",
    keys: ["spellsAndMagicEnabled", "spellPoints", "expandedCastingTime", "channelers", "channellerFatigue"],
  },
  { id: "psionics", kind: "optional", keys: ["wildTalents"] },
  { id: "tableAndPlay", kind: "table", keys: ["playerAppliedEffects"] },
];

/** The section holding a setting key, or undefined for one that is not laid out. */
export function sectionOf(key: string): SettingSection | undefined {
  return SETTING_SECTIONS.find((s) => s.keys.includes(key));
}
