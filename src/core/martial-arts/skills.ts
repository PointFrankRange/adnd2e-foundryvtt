// PHBR15 Movement/Mental skills and the constant abilities that change numbers. Pure.
import { hitResult } from "../combat/attack";

export interface LeapResult {
  hit: boolean;
  naturalD20: number;
  needed: number;
  total: number;
  /** from a standing start (costs one attack) */
  standing: { up: number; forward: number };
  /** from a running start (needs a 10 ft run-up) */
  running: { up: number; forward: number };
}

/** The leap: a normal attack roll against AC 10 to land safely; distances grow 1 foot per level. */
export function resolveLeap(input: { naturalD20: number; thac0: number; situationalModifier: number; level: number }): LeapResult {
  const base = hitResult({
    naturalD20: input.naturalD20, attackBonus: input.situationalModifier, thac0: input.thac0, targetAc: 10,
  });
  return {
    hit: base.hit,
    naturalD20: input.naturalD20,
    needed: base.needed,
    total: base.total,
    standing: { up: 4 + input.level, forward: 3 + input.level },
    running: { up: 8 + input.level, forward: 10 + input.level },
  };
}

export interface SpeedResult {
  success: boolean;
  naturalD20: number;
  dexterity: number;
  extraAttacks: number;
  /** turns of rest owed afterwards: one per extra attack */
  restTurns: number;
}

/** Speed: a Dexterity check; one extra attack per 4 points made (rounded to the nearest), for one round. */
export function resolveSpeed(input: { naturalD20: number; dexterity: number }): SpeedResult {
  const success = input.naturalD20 <= input.dexterity;
  const extraAttacks = success ? Math.round((input.dexterity - input.naturalD20) / 4) : 0;
  return { success, naturalD20: input.naturalD20, dexterity: input.dexterity, extraAttacks, restTurns: extraAttacks };
}

/** Levitation: floats 5 ft per round for a number of rounds equal to the level. */
export function levitationInfo(level: number): { rounds: number; feetPerRound: 5 } {
  return { rounds: level, feetPerRound: 5 };
}

/** Ironskin: AC improves by 2 while the character wears no body armor (a shield does not count). */
export function ironskinAcMod(known: boolean, wearingBodyArmor: boolean): number {
  return known && !wearingBodyArmor ? -2 : 0;
}

/** Blind Fighting: a darkness/blinded/invisible-opponent penalty never exceeds -1. */
export function blindFightingPenalty(penalty: number): number {
  return Math.max(penalty, -1);
}

/** Every maneuver id known on any of the given styles (constant abilities are not limited to the active style). */
export function knownManeuverIds(styles: readonly { knownManeuvers?: readonly { id: string }[] }[]): Set<string> {
  return new Set(styles.flatMap((s) => (s.knownManeuvers ?? []).map((k) => k.id)));
}
