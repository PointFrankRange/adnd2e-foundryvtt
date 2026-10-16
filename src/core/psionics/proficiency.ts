/* Issue #180: the Psionicist-group non-weapon proficiencies that change the numbers (PHBR5 p.17-18). Pure. */

export const HARNESS_SUBCONSCIOUS = "Harness Subconscious";
export const MEDITATIVE_FOCUS = "Meditative Focus";
export const REJUVENATION = "Rejuvenation";

/** Harness Subconscious lasts 72 hours, Meditative Focus 24 (world-time seconds). */
export const HARNESS_SECONDS = 72 * 3600;
export const FOCUS_SECONDS = 24 * 3600;

/** The PSPs Harness Subconscious adds: 20% of the usual maximum, rounded up. */
export function harnessBonusPsp(baseMax: number): number {
  return Math.ceil(baseMax * 0.2);
}

/** When the boost ends the character loses as many points as it gave, never dropping below 0. */
export function harnessEndPool(current: number, bonus: number): number {
  return Math.max(0, current - bonus);
}

/** Meditative Focus: +2 to the chosen discipline's power scores, -1 to every other; nothing once the pool is empty or no focus is held. */
export function focusModifier(focus: string, discipline: string, psp: number): number {
  if (focus === "" || psp <= 0) return 0;
  return discipline === focus ? 2 : -1;
}

/** True when a stored expiry (world-time seconds, null = none) has been reached. */
export function proficiencyExpired(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && now >= expiresAt;
}

/** Which of the three owned proficiencies are present (by name). */
export function knownPsionicProficiencies(names: Iterable<string>): { harness: boolean; focus: boolean; rejuvenation: boolean } {
  const set = new Set(names);
  return { harness: set.has(HARNESS_SUBCONSCIOUS), focus: set.has(MEDITATIVE_FOCUS), rejuvenation: set.has(REJUVENATION) };
}
