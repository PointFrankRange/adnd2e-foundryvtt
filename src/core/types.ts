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
