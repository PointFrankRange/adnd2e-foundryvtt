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
  /** prepare-time-derivation rules need a world reload to take effect (Foundry prompts the GM to reload every client) */
  readonly requiresReload?: boolean;
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
  { key: "racialLevelLimits", group: "core", default: true, config: true, optionalRulesKey: "racialLevelLimits", requiresReload: true },
  { key: "primeRequisiteBonusLevels", group: "core", default: false, config: true, optionalRulesKey: "primeRequisiteBonusLevels", requiresReload: true },
  // --- combatAndTactics: Sub-project 7 ---
  { key: "combatAndTacticsEnabled", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "combatAndTacticsEnabled" },
  { key: "criticalHits", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "criticalHits" },
  { key: "calledShots", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "calledShots" },
  { key: "combatManeuvers", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "combatManeuvers" },
  { key: "armorTypeVsWeaponType", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "armorTypeVsWeaponType" },
  { key: "weaponMastery", group: "combatAndTactics", default: false, config: true, optionalRulesKey: "weaponMastery" },
  // --- skillsAndPowers: Sub-project 8 ---
  { key: "skillsAndPowersEnabled", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "skillsAndPowersEnabled", requiresReload: true },
  { key: "subAbilityScores", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "subAbilityScores", requiresReload: true },
  { key: "characterPointBuild", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "characterPointBuild", requiresReload: true },
  { key: "expandedProficiencies", group: "skillsAndPowers", default: false, config: true, optionalRulesKey: "expandedProficiencies" },
  // --- spellsAndMagic: Sub-project 9 ---
  { key: "spellsAndMagicEnabled", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "spellsAndMagicEnabled", requiresReload: true },
  { key: "spellPoints", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "spellPoints", requiresReload: true },
  { key: "expandedCastingTime", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "expandedCastingTime", requiresReload: true },
  { key: "channelers", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "channelers", requiresReload: true },
  { key: "channellerFatigue", group: "spellsAndMagic", default: false, config: true, optionalRulesKey: "channellerFatigue", requiresReload: true },
];

/** SP13: the exceedLevelLimits choice setting (a String choice, registered separately in src/settings/index.ts like playerAppliedEffects). */
export const EXCEED_LEVEL_LIMIT_CHOICES = ["off", "x2", "x3", "x4"] as const;
const EXCEED_MULTIPLIERS: Readonly<Record<(typeof EXCEED_LEVEL_LIMIT_CHOICES)[number], 0 | 2 | 3 | 4>> = { off: 0, x2: 2, x3: 3, x4: 4 };

/**
 * Build the typed `OptionalRules` bag from a raw getter (setting key -> stored
 * value, or `undefined` when unset). A stored value that is not a boolean falls
 * back to the descriptor default, so a corrupt or half-migrated world is safe.
 */
export function readOptionalRules(
  get: (key: string) => unknown,
  descriptors: readonly SettingDescriptor[] = SETTING_DESCRIPTORS,
): OptionalRules {
  const bag: OptionalRules = { ...DEFAULT_OPTIONAL_RULES };
  for (const d of descriptors) {
    if (d.optionalRulesKey === null) continue;
    const raw = get(d.key);
    const key = d.optionalRulesKey as keyof Omit<OptionalRules, "exceedLevelLimits">;
    (bag[key] as unknown) = typeof raw === "boolean" ? raw : d.default;
  }
  const exceed = get("exceedLevelLimits");
  bag.exceedLevelLimits =
    typeof exceed === "string" && Object.prototype.hasOwnProperty.call(EXCEED_MULTIPLIERS, exceed)
      ? EXCEED_MULTIPLIERS[exceed as keyof typeof EXCEED_MULTIPLIERS]
      : 0;
  return bag;
}
