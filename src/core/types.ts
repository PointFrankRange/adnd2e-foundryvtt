export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type ClassGroup = "warrior" | "wizard" | "priest" | "rogue";

export interface StrengthModifiers {
  hitProb: number;
  damageAdj: number;
  weightAllowance: number;
  maxPress: number;
  openDoors: number;
  openDoorsMagical: number | null;
  bendBarsLiftGates: number;
}

export interface DexterityModifiers {
  reactionAdj: number;
  missileAttackAdj: number;
  defensiveAdj: number;
}

export interface ConstitutionModifiers {
  hpAdjustment: number;
  systemShock: number;
  resurrectionSurvival: number;
  poisonSave: number;
  regeneration: string;
  hitDieMinimumRoll: number;
}

export interface IntelligenceModifiers {
  bonusLanguages: number;
  maxSpellLevel: number | null;
  learnSpellChance: number | null;
  maxSpellsPerLevel: number | null;
  illusionImmunityLevel: number | null;
}

export interface WisdomModifiers {
  magicalDefenseAdj: number;
  bonusPriestSpells: readonly number[];
  spellFailureChance: number;
  spellImmunityFromScore: number | null;
}

export interface CharismaModifiers {
  maxHenchmen: number;
  loyaltyBase: number;
  reactionAdj: number;
}

export interface DerivedAbilities {
  scores: AbilityScores;
  str: StrengthModifiers;
  dex: DexterityModifiers;
  con: ConstitutionModifiers;
  int: IntelligenceModifiers;
  wis: WisdomModifiers;
  cha: CharismaModifiers;
}

export type ClassId = "fighter" | "mage" | "cleric" | "thief";

export type SaveCategory = "ppd" | "rsw" | "pp" | "bw" | "spell";

export interface ProficiencySlotProgression {
  /** slots held at level 1 */
  initial: number;
  /** a new slot is gained at every level evenly divisible by this number */
  levelsPerSlot: number;
}

export interface HitDice {
  /** number of dice rolled */
  count: number;
  /** die size (4, 6, 8, 10) */
  dieType: number;
  /** flat hit points added after the Hit-Die cutoff level (no CON bonus) */
  bonus: number;
}

export interface ClassChassis {
  id: ClassId;
  name: string;
  group: ClassGroup;
  hitDie: 4 | 6 | 8 | 10;
  /** flat hp per level gained after `conBonusCutoffLevel` */
  hpAfterNameLevel: number;
  /** highest level that grants a rolled Hit Die and a CON hp bonus */
  conBonusCutoffLevel: number;
  primeRequisites: readonly AbilityKey[];
  abilityMinimums: Partial<Record<AbilityKey, number>>;
  /** cumulative XP to REACH each level; index 0 = level 1 (0 XP), index 19 = level 20 */
  xpThresholds: readonly number[];
  /** XP added per level beyond 20 */
  xpPerLevelBeyond20: number;
  weaponProficiencies: ProficiencySlotProgression;
  nonweaponProficiencies: ProficiencySlotProgression;
  /** attack-roll penalty for using a non-proficient weapon (negative) */
  nonProficiencyPenalty: number;
  casterType: "wizard" | "priest" | null;
  /** allowed armor categories; `["none"]` means no armor */
  armorAllowed: readonly string[];
  /** `"any"` or an explicit allow-list of weapon names */
  weaponsAllowed: "any" | readonly string[];
  weaponSpecializationAllowed: boolean;
  /**
   * Race id -> maximum attainable level (`null` = unlimited).
   * Placeholder for Plan 1b.2 — populated by the race plan. Currently `{}`.
   */
  raceLevelLimits: Readonly<Record<string, number | null>>;
}
