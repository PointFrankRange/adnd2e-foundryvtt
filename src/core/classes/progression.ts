// PHB Tables 14/20/23/25 (XP + Hit Dice), Table 15 (warrior attacks), Table 34 (proficiency slots).
import { assertLevel, assertXp } from "../errors";
import type { ClassChassis, HitDice } from "../types";

const TABLE_MAX_LEVEL = 20;

export function xpForLevel(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  if (level <= TABLE_MAX_LEVEL) {
    return chassis.xpThresholds[level - 1];
  }
  return chassis.xpThresholds[TABLE_MAX_LEVEL - 1] + (level - TABLE_MAX_LEVEL) * chassis.xpPerLevelBeyond20;
}

export function levelForXp(chassis: ClassChassis, xp: number): number {
  assertXp(xp);
  const top = chassis.xpThresholds[TABLE_MAX_LEVEL - 1];
  if (xp >= top) {
    return TABLE_MAX_LEVEL + Math.floor((xp - top) / chassis.xpPerLevelBeyond20);
  }
  // highest table level whose threshold is <= xp
  let level = 1;
  for (let i = 1; i < TABLE_MAX_LEVEL; i++) {
    if (xp >= chassis.xpThresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export function hitDice(chassis: ClassChassis, level: number): HitDice {
  assertLevel(level, "class level");
  const cutoff = chassis.conBonusCutoffLevel;
  if (level <= cutoff) {
    return { count: level, dieType: chassis.hitDie, bonus: 0 };
  }
  return {
    count: cutoff,
    dieType: chassis.hitDie,
    bonus: (level - cutoff) * chassis.hpAfterNameLevel,
  };
}

export function warriorAttacksPerRound(level: number): { attacks: number; rounds: number } {
  assertLevel(level, "class level");
  if (level <= 6) return { attacks: 1, rounds: 1 };
  if (level <= 12) return { attacks: 3, rounds: 2 };
  return { attacks: 2, rounds: 1 };
}

export function weaponProficiencySlots(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  const { initial, levelsPerSlot } = chassis.weaponProficiencies;
  return initial + Math.floor(level / levelsPerSlot);
}

export function nonweaponProficiencySlots(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  const { initial, levelsPerSlot } = chassis.nonweaponProficiencies;
  return initial + Math.floor(level / levelsPerSlot);
}
