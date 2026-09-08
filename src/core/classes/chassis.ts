// PHB Chapter 3 class descriptions + Table 13 (p.25), Table 14 (p.26),
// Table 20 (p.30), Table 23 (p.33), Table 25 (p.38), Table 34 (p.51).
import type { ClassChassis, ClassId } from "../types";

// prettier-ignore
const FIGHTER_XP: readonly number[] = [
  0, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000,
  750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000, 2750000, 3000000,
];
// prettier-ignore
const MAGE_XP: readonly number[] = [
  0, 2500, 5000, 10000, 20000, 40000, 60000, 90000, 135000, 250000,
  375000, 750000, 1125000, 1500000, 1875000, 2250000, 2625000, 3000000, 3375000, 3750000,
];
// prettier-ignore
const CLERIC_XP: readonly number[] = [
  0, 1500, 3000, 6000, 13000, 27500, 55000, 110000, 225000, 450000,
  675000, 900000, 1125000, 1350000, 1575000, 1800000, 2025000, 2250000, 2475000, 2700000,
];
// prettier-ignore
const THIEF_XP: readonly number[] = [
  0, 1250, 2500, 5000, 10000, 20000, 40000, 70000, 110000, 160000,
  220000, 440000, 660000, 880000, 1100000, 1320000, 1540000, 1760000, 1980000, 2200000,
];

const MAGE_WEAPONS = ["dagger", "staff", "dart", "knife", "sling"] as const;
const THIEF_WEAPONS = [
  "club", "dagger", "dart", "hand crossbow", "knife", "lasso", "short bow", "sling",
  "broad sword", "long sword", "short sword", "staff",
] as const;

export const FIGHTER: ClassChassis = {
  id: "fighter",
  name: "Fighter",
  group: "warrior",
  hitDie: 10,
  hpAfterNameLevel: 3,
  conBonusCutoffLevel: 9,
  primeRequisites: ["str"],
  abilityMinimums: { str: 9 },
  xpThresholds: FIGHTER_XP,
  xpPerLevelBeyond20: 250000,
  weaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
  nonProficiencyPenalty: -2,
  casterType: null,
  armorAllowed: ["any"],
  weaponsAllowed: "any",
  weaponSpecializationAllowed: true,
  raceLevelLimits: {},
};

export const MAGE: ClassChassis = {
  id: "mage",
  name: "Mage",
  group: "wizard",
  hitDie: 4,
  hpAfterNameLevel: 1,
  conBonusCutoffLevel: 10,
  primeRequisites: ["int"],
  abilityMinimums: { int: 9 },
  xpThresholds: MAGE_XP,
  xpPerLevelBeyond20: 375000,
  weaponProficiencies: { initial: 1, levelsPerSlot: 6 },
  nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonProficiencyPenalty: -5,
  casterType: "wizard",
  armorAllowed: ["none"],
  weaponsAllowed: [...MAGE_WEAPONS],
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
};

export const CLERIC: ClassChassis = {
  id: "cleric",
  name: "Cleric",
  group: "priest",
  hitDie: 8,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 9,
  primeRequisites: ["wis"],
  abilityMinimums: { wis: 9 },
  xpThresholds: CLERIC_XP,
  xpPerLevelBeyond20: 225000,
  weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
  nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonProficiencyPenalty: -3,
  casterType: "priest",
  armorAllowed: ["any"],
  weaponsAllowed: ["blunt"],
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
};

export const THIEF: ClassChassis = {
  id: "thief",
  name: "Thief",
  group: "rogue",
  hitDie: 6,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 10,
  primeRequisites: ["dex"],
  abilityMinimums: { dex: 9 },
  xpThresholds: THIEF_XP,
  xpPerLevelBeyond20: 220000,
  weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 4 },
  nonProficiencyPenalty: -3,
  casterType: null,
  armorAllowed: ["leather", "studded leather", "padded", "elven chain"],
  weaponsAllowed: [...THIEF_WEAPONS],
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
};

const BY_ID: Record<ClassId, ClassChassis> = {
  fighter: FIGHTER,
  mage: MAGE,
  cleric: CLERIC,
  thief: THIEF,
};

export function getChassis(id: ClassId): ClassChassis {
  return BY_ID[id];
}
