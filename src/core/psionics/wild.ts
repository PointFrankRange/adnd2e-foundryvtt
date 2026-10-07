/* Wild talent acquisition and power determination (PHBR5 pp.18-21, Tables 12-13). Foundry-free. */

import { type Discipline } from "./tables";

/** Chance to manifest a wild talent (1-100, a percentage). Base 1; +1/+2/+3 for Wis/Con/Int at 16/17/18 (prepared scores); +1 for level 5-8, +2 for level 9+; halved for mage, cleric or non-human. */
export function wildTalentChance(i: { wis: number; con: number; int: number; level: number; halved: boolean }): number {
  let total = 1;
  // Each ability: 18 -> +3, 17 -> +2, 16 -> +1, else 0
  if (i.wis >= 18) total += 3;
  else if (i.wis === 17) total += 2;
  else if (i.wis === 16) total += 1;

  if (i.con >= 18) total += 3;
  else if (i.con === 17) total += 2;
  else if (i.con === 16) total += 1;

  if (i.int >= 18) total += 3;
  else if (i.int === 17) total += 2;
  else if (i.int === 16) total += 1;

  // Level 5-8 -> +1, 9+ -> +2
  if (i.level >= 9) total += 2;
  else if (i.level >= 5) total += 1;

  // Halved for mage, cleric or non-human
  if (i.halved) total = Math.ceil(total / 2);

  return total;
}

/** True when the wild talent chance is halved: any class is mage or cleric, or race is not human. */
export function isHalved(i: { classIds: readonly string[]; raceId: string }): boolean {
  const hasHalvingClass = i.classIds.some((id) => id === "mage" || id === "cleric");
  const isNonHuman = i.raceId !== "human";
  return hasHalvingClass || isNonHuman;
}

export interface DireOutcome {
  roll: number;
  ability: "wis" | "int" | "con" | "all";
  savePenalty: 0 | -5;
}

/** Dire consequences from the wild talent test (roll 97-100 before or after surgeon modifier). Roll 97 -> Wis -1d6, 98 -> Int -1d6, 99 -> Con -1d6, 100 ("00") -> all abilities -> 3, all at save vs death penalty; below 97 -> null. */
export function direOutcome(roll: number): DireOutcome | null {
  if (roll === 97) return { roll, ability: "wis", savePenalty: 0 };
  if (roll === 98) return { roll, ability: "int", savePenalty: 0 };
  if (roll === 99) return { roll, ability: "con", savePenalty: 0 };
  if (roll === 100) return { roll, ability: "all", savePenalty: -5 };
  return null;
}

export interface WildTestResult {
  talent: boolean;
  effectiveRoll: number;
  dire: DireOutcome | null;
}

/** Test for a wild talent (PHBR5 p.19). effectiveRoll = roll - (surgeon ? 2 : 0); talent = effectiveRoll <= chance; dire is from the ROLLED d100, not the surgeon-modified one. */
export function testWildTalent(chance: number, roll: number, surgeon: boolean): WildTestResult {
  const effectiveRoll = roll - (surgeon ? 2 : 0);
  const talent = effectiveRoll <= chance;
  const dire = direOutcome(roll); // Dire uses the rolled number, not the surgeon-adjusted one
  return { talent, effectiveRoll, dire };
}

export type WildResult =
  | { kind: "power"; name: string }
  | { kind: "choose"; discipline: Discipline; powerKinds: ("science" | "devotion")[] }
  | { kind: "roll"; times: number }
  | { kind: "chooseAny"; sciences: number; devotions: number }
  | { kind: "table13" }
  | { kind: "chooseThenTable13" };

export interface WildTableEntry {
  from: number;
  to: number;
  result: WildResult;
}

/** Table 12: wild devotions (d100, roll 1-100 where 100 = "00"). */
// prettier-ignore
export const WILD_TABLE_12: readonly WildTableEntry[] = [
  { from: 1, to: 1, result: { kind: "power", name: "All-Round Vision" } },
  { from: 2, to: 2, result: { kind: "power", name: "Combat Mind" } },
  { from: 3, to: 3, result: { kind: "power", name: "Danger Sense" } },
  { from: 4, to: 4, result: { kind: "power", name: "Feel Light" } },
  { from: 5, to: 5, result: { kind: "power", name: "Feel Sound" } },
  { from: 6, to: 6, result: { kind: "power", name: "Hear Light" } },
  { from: 7, to: 7, result: { kind: "power", name: "Know Direction" } },
  { from: 8, to: 8, result: { kind: "power", name: "Know Location" } },
  { from: 9, to: 9, result: { kind: "power", name: "Poison Sense" } },
  { from: 10, to: 10, result: { kind: "power", name: "Radial Navigation" } },
  { from: 11, to: 11, result: { kind: "power", name: "See Sound" } },
  { from: 12, to: 12, result: { kind: "power", name: "Spirit Sense" } },
  { from: 13, to: 14, result: { kind: "choose", discipline: "clairsentience", powerKinds: ["devotion"] } },
  { from: 15, to: 15, result: { kind: "power", name: "Animate Object" } },
  { from: 16, to: 16, result: { kind: "power", name: "Animate Shadow" } },
  { from: 17, to: 17, result: { kind: "power", name: "Ballistic Attack" } },
  { from: 18, to: 18, result: { kind: "power", name: "Control Body" } },
  { from: 19, to: 19, result: { kind: "power", name: "Control Flames" } },
  { from: 20, to: 20, result: { kind: "power", name: "Control Light" } },
  { from: 21, to: 21, result: { kind: "power", name: "Control Sound" } },
  { from: 22, to: 22, result: { kind: "choose", discipline: "psychokinesis", powerKinds: ["devotion"] } },
  { from: 23, to: 23, result: { kind: "power", name: "Absorb Disease" } },
  { from: 24, to: 24, result: { kind: "power", name: "Adrenalin Control" } },
  { from: 25, to: 25, result: { kind: "power", name: "Aging" } },
  { from: 26, to: 26, result: { kind: "power", name: "Biofeedback" } },
  { from: 27, to: 27, result: { kind: "power", name: "Body Control" } },
  { from: 28, to: 28, result: { kind: "power", name: "Body Equilibrium" } },
  { from: 29, to: 29, result: { kind: "power", name: "Body Weaponry" } },
  { from: 30, to: 30, result: { kind: "power", name: "Catfall" } },
  { from: 31, to: 31, result: { kind: "power", name: "Cause Decay" } },
  { from: 32, to: 32, result: { kind: "power", name: "Cell Adjustment" } },
  { from: 33, to: 33, result: { kind: "power", name: "Chameleon Power" } },
  { from: 34, to: 34, result: { kind: "power", name: "Chemical Simulation" } },
  { from: 35, to: 35, result: { kind: "power", name: "Displacement" } },
  { from: 36, to: 36, result: { kind: "power", name: "Double Pain" } },
  { from: 37, to: 37, result: { kind: "power", name: "Enhanced Strength" } },
  { from: 38, to: 38, result: { kind: "power", name: "Ectoplasmic Form" } },
  { from: 39, to: 39, result: { kind: "power", name: "Expansion" } },
  { from: 40, to: 40, result: { kind: "power", name: "Flesh Armor" } },
  { from: 41, to: 41, result: { kind: "power", name: "Graft Weapon" } },
  { from: 42, to: 42, result: { kind: "power", name: "Heightened Senses" } },
  { from: 43, to: 43, result: { kind: "power", name: "Immovability" } },
  { from: 44, to: 44, result: { kind: "power", name: "Lend Health" } },
  { from: 45, to: 45, result: { kind: "power", name: "Mind Over Body" } },
  { from: 46, to: 46, result: { kind: "power", name: "Reduction" } },
  { from: 47, to: 47, result: { kind: "power", name: "Share Strength" } },
  { from: 48, to: 48, result: { kind: "power", name: "Suspend Animation" } },
  { from: 49, to: 49, result: { kind: "choose", discipline: "psychometabolism", powerKinds: ["devotion"] } },
  { from: 50, to: 50, result: { kind: "power", name: "Attraction" } },
  { from: 51, to: 51, result: { kind: "power", name: "Aversion" } },
  { from: 52, to: 52, result: { kind: "power", name: "Awe" } },
  { from: 53, to: 53, result: { kind: "power", name: "Conceal Thoughts" } },
  { from: 54, to: 54, result: { kind: "power", name: "Daydream" } },
  { from: 55, to: 55, result: { kind: "power", name: "Empathy" } },
  { from: 56, to: 56, result: { kind: "power", name: "ESP" } },
  { from: 57, to: 57, result: { kind: "power", name: "False Sensory Input" } },
  { from: 58, to: 58, result: { kind: "power", name: "Identity Penetration" } },
  { from: 59, to: 59, result: { kind: "power", name: "Incarnation Awareness" } },
  { from: 60, to: 60, result: { kind: "power", name: "Inflict Pain" } },
  { from: 61, to: 61, result: { kind: "power", name: "Invincible Foes" } },
  { from: 62, to: 62, result: { kind: "power", name: "Invisibility" } },
  { from: 63, to: 63, result: { kind: "power", name: "Life Detection" } },
  { from: 64, to: 64, result: { kind: "power", name: "Mind Bar" } },
  { from: 65, to: 65, result: { kind: "power", name: "Phobia Amplification" } },
  { from: 66, to: 66, result: { kind: "power", name: "Post-Hypnotic Suggestion" } },
  { from: 67, to: 67, result: { kind: "power", name: "Psychic Impersonation" } },
  { from: 68, to: 68, result: { kind: "power", name: "Psychic Messenger" } },
  { from: 69, to: 69, result: { kind: "power", name: "Repugnance" } },
  { from: 70, to: 70, result: { kind: "power", name: "Send Thoughts" } },
  { from: 71, to: 71, result: { kind: "power", name: "Sight Link" } },
  { from: 72, to: 72, result: { kind: "power", name: "Sound Link" } },
  { from: 73, to: 73, result: { kind: "power", name: "Synaptic Static" } },
  { from: 74, to: 74, result: { kind: "power", name: "Taste Link" } },
  { from: 75, to: 75, result: { kind: "power", name: "Telempathic Projection" } },
  { from: 76, to: 76, result: { kind: "power", name: "Truehear" } },
  { from: 77, to: 78, result: { kind: "choose", discipline: "telepathy", powerKinds: ["devotion"] } },
  { from: 79, to: 79, result: { kind: "power", name: "Astral Projection" } },
  { from: 80, to: 80, result: { kind: "power", name: "Dimensional Door" } },
  { from: 81, to: 81, result: { kind: "power", name: "Dimension Walk" } },
  { from: 82, to: 82, result: { kind: "power", name: "Dream Travel" } },
  { from: 83, to: 83, result: { kind: "power", name: "Time Shift" } },
  { from: 84, to: 84, result: { kind: "power", name: "Time/Space Anchor" } },
  { from: 85, to: 85, result: { kind: "choose", discipline: "psychoportation", powerKinds: ["devotion"] } },
  { from: 86, to: 87, result: { kind: "roll", times: 2 } },
  { from: 88, to: 89, result: { kind: "roll", times: 3 } },
  { from: 90, to: 90, result: { kind: "chooseAny", sciences: 0, devotions: 2 } },
  { from: 91, to: 99, result: { kind: "table13" } },
  { from: 100, to: 100, result: { kind: "chooseThenTable13" } },
];

/** Table 13: wild sciences (d100, roll 1-100 where 100 = "00"). */
// prettier-ignore
export const WILD_TABLE_13: readonly WildTableEntry[] = [
  { from: 1, to: 2, result: { kind: "power", name: "Aura Sight" } },
  { from: 3, to: 4, result: { kind: "power", name: "Clairaudience" } },
  { from: 5, to: 6, result: { kind: "power", name: "Clairvoyance" } },
  { from: 7, to: 8, result: { kind: "power", name: "Object Reading" } },
  { from: 9, to: 10, result: { kind: "power", name: "Precognition" } },
  { from: 11, to: 12, result: { kind: "power", name: "Sensitivity to Psychic Impressions" } },
  { from: 13, to: 16, result: { kind: "choose", discipline: "clairsentience", powerKinds: ["science", "devotion"] } },
  { from: 17, to: 18, result: { kind: "power", name: "Detonate" } },
  { from: 19, to: 20, result: { kind: "power", name: "Disintegrate" } },
  { from: 21, to: 22, result: { kind: "power", name: "Molecular Rearrangement" } },
  { from: 23, to: 24, result: { kind: "power", name: "Project Force" } },
  { from: 25, to: 26, result: { kind: "power", name: "Telekinesis" } },
  { from: 27, to: 30, result: { kind: "choose", discipline: "psychokinesis", powerKinds: ["science", "devotion"] } },
  { from: 31, to: 32, result: { kind: "power", name: "Animal Affinity" } },
  { from: 33, to: 34, result: { kind: "power", name: "Complete Healing" } },
  { from: 35, to: 36, result: { kind: "power", name: "Death Field" } },
  { from: 37, to: 38, result: { kind: "power", name: "Energy Containment" } },
  { from: 39, to: 40, result: { kind: "power", name: "Life Draining" } },
  { from: 41, to: 42, result: { kind: "power", name: "Metamorphosis" } },
  { from: 43, to: 44, result: { kind: "power", name: "Shadow-form" } },
  { from: 45, to: 48, result: { kind: "choose", discipline: "psychometabolism", powerKinds: ["science", "devotion"] } },
  { from: 49, to: 50, result: { kind: "power", name: "Domination" } },
  { from: 51, to: 52, result: { kind: "power", name: "Fate Link" } },
  { from: 53, to: 54, result: { kind: "power", name: "Mass Domination" } },
  { from: 55, to: 56, result: { kind: "power", name: "Mindwipe" } },
  { from: 57, to: 58, result: { kind: "power", name: "Probe" } },
  { from: 59, to: 60, result: { kind: "power", name: "Superior Invisibility" } },
  { from: 61, to: 62, result: { kind: "power", name: "Switch Personality" } },
  { from: 63, to: 64, result: { kind: "power", name: "Mindlink" } },
  { from: 65, to: 68, result: { kind: "choose", discipline: "telepathy", powerKinds: ["science", "devotion"] } },
  { from: 69, to: 70, result: { kind: "power", name: "Banishment" } },
  { from: 71, to: 72, result: { kind: "power", name: "Probability Travel" } },
  { from: 73, to: 74, result: { kind: "power", name: "Summon Planar Creature" } },
  { from: 75, to: 76, result: { kind: "power", name: "Teleport" } },
  { from: 77, to: 78, result: { kind: "power", name: "Teleport Other" } },
  { from: 79, to: 82, result: { kind: "choose", discipline: "psychoportation", powerKinds: ["science", "devotion"] } },
  { from: 83, to: 85, result: { kind: "roll", times: 2 } },
  { from: 86, to: 88, result: { kind: "roll", times: 3 } },
  { from: 89, to: 92, result: { kind: "chooseAny", sciences: 1, devotions: 0 } },
  { from: 93, to: 96, result: { kind: "chooseAny", sciences: 1, devotions: 2 } },
  { from: 97, to: 99, result: { kind: "chooseAny", sciences: 1, devotions: 3 } },
  { from: 100, to: 100, result: { kind: "chooseAny", sciences: 2, devotions: 4 } },
];

/** Look up a wild talent result from Table 12 or 13. Roll 1-100 (100 = "00"); throws for out of range. */
export function lookupWild(table: 12 | 13, roll: number): WildResult {
  if (roll < 1 || roll > 100) throw new Error(`lookupWild: roll must be 1-100, got ${roll}`);

  const entries = table === 12 ? WILD_TABLE_12 : WILD_TABLE_13;
  const entry = entries.find((e) => e.from <= roll && roll <= e.to)!;
  return entry.result;
}

/** PSP maximum for a wild talent: sum of (initialCost + 4 * maintenanceCost) for each power, plus 4 * levelsGained. */
export function wildPsp(powers: readonly { initialCost: number; maintenanceCost: number }[], levelsGained: number): number {
  let total = 0;
  for (const power of powers) {
    total += power.initialCost + 4 * power.maintenanceCost;
  }
  total += 4 * levelsGained;
  return total;
}
