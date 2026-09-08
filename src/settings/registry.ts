// The optional-rules settings registry (spec §6.2). Pure data + a pure reader:
// `src/settings/index.ts` turns SETTING_DESCRIPTORS into game.settings.register
// calls, and wraps readOptionalRules() as getOptionalRules().
import type { OptionalRules } from "../core/options";
import { DEFAULT_OPTIONAL_RULES } from "../core/options";

export type SettingGroup = "core" | "combatAndTactics" | "skillsAndPowers" | "spellsAndMagic";

export interface SettingDescriptor {
  /** unique, dot-free key; the Foundry setting name and the i18n leaf (`ADND2E.settings.<key>.{name,hint}`) */
  readonly key: string;
  readonly group: SettingGroup;
  readonly default: boolean;
  /** shown in Foundry's Configure Settings UI */
  readonly config: boolean;
  /** the `OptionalRules` field this key populates (core group only); `null` for a reserved key */
  readonly optionalRulesKey: keyof OptionalRules | null;
}

/** Every setting is `scope: "world"`, `type: Boolean` — constants, not per-row fields. */
export const SETTING_DESCRIPTORS: readonly SettingDescriptor[] = [
  // --- core: wired into OptionalRules ---
  { key: "exceptionalStrength", group: "core", default: true, config: true, optionalRulesKey: "exceptionalStrength" },
  { key: "maxSpellsPerLevel", group: "core", default: false, config: true, optionalRulesKey: "maxSpellsPerLevel" },
  { key: "weaponSpeedInitiative", group: "core", default: false, config: true, optionalRulesKey: "weaponSpeedInitiative" },
  { key: "spellFailureFromWisdom", group: "core", default: true, config: true, optionalRulesKey: "spellFailureFromWisdom" },
  { key: "trainingRequiredToLevel", group: "core", default: false, config: true, optionalRulesKey: "trainingRequiredToLevel" },
  { key: "nonweaponProficienciesUsed", group: "core", default: true, config: true, optionalRulesKey: "nonweaponProficienciesUsed" },
  { key: "weaponProficienciesUsed", group: "core", default: true, config: true, optionalRulesKey: "weaponProficienciesUsed" },
  { key: "multiclassHpAveraging", group: "core", default: true, config: true, optionalRulesKey: "multiclassHpAveraging" },
  // --- combatAndTactics: reserved for Sub-project 7 ---
  { key: "combatAndTacticsEnabled", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "criticalHits", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "calledShots", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "combatManeuvers", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "armorTypeVsWeaponType", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  { key: "weaponMastery", group: "combatAndTactics", default: false, config: true, optionalRulesKey: null },
  // --- skillsAndPowers: reserved for Sub-project 8 ---
  { key: "skillsAndPowersEnabled", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  { key: "subAbilityScores", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  { key: "characterPointBuild", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  { key: "expandedProficiencies", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: null },
  // --- spellsAndMagic: reserved for Sub-project 9 ---
  { key: "spellsAndMagicEnabled", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "spellPoints", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "expandedCastingTime", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
  { key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: null },
];

/**
 * Build the typed `OptionalRules` bag from a raw getter (setting key -> stored
 * value, or `undefined` when unset). A stored value that is not a boolean falls
 * back to the descriptor default, so a corrupt or half-migrated world is safe.
 */
export function readOptionalRules(get: (key: string) => unknown): OptionalRules {
  const bag: OptionalRules = { ...DEFAULT_OPTIONAL_RULES };
  for (const d of SETTING_DESCRIPTORS) {
    if (d.optionalRulesKey === null) continue;
    const raw = get(d.key);
    bag[d.optionalRulesKey] = typeof raw === "boolean" ? raw : d.default;
  }
  return bag;
}
