// Mechanical consequences of the 4 curated status effects this sub-project
// automates (spec §2 "Condition mechanics scope"). Beyond the 4 curated ones, unconscious / paralyzed / sleeping (helpless), incapacitated, dead, invisible, entangled and frightened gained effects in #94; deafened, poisoned and charmed remain flavor-only markers a GM interprets by hand. All numeric values are this project's own design (content policy) — not transcribed from any rulebook table.

import { FATIGUE_ATTACK_PENALTY, FATIGUE_AC_PENALTY, FATIGUE_CONDITION_ID } from "../core/magic/channeller-fatigue";

export type ManagedConditionId = "prone" | "blinded" | "stunned" | "held";

export const MANAGED_CONDITIONS: readonly ManagedConditionId[] = ["prone", "blinded", "stunned", "held"];

type StatusSet = ReadonlySet<string> | readonly string[];

function has(statuses: StatusSet, id: string): boolean {
  if (Array.isArray(statuses)) {
    return statuses.includes(id);
  }
  return (statuses as ReadonlySet<string>).has(id);
}

/** Blinded: the blinded actor's OWN attack rolls suffer a flat penalty. */
export function blindedAttackPenalty(actorStatuses: StatusSet): number {
  return has(actorStatuses, "blinded") ? -4 : 0;
}

/** Prone: the prone actor's AC worsens by a flat amount, uniformly regardless
 *  of the attacker's range (a deliberate v1 simplification — PHB has a
 *  melee/missile split this system does not model). Positive = worse AC,
 *  matching core/combat/armor-class.ts's ArmorClassInput.situationalModifier
 *  sign convention. */
export function proneArmorClassPenalty(targetStatuses: StatusSet): number {
  return has(targetStatuses, "prone") ? 2 : 0;
}

/** Held: an attacker gets a flat to-hit bonus against a held target. */
export function heldAttackBonus(targetStatuses: StatusSet): number {
  return has(targetStatuses, "held") ? 4 : 0;
}

/** Sub-project 14 Plan C: a fatigued actor's own attack-roll penalty (p.83).
 *  At most one fatigue tier is ever present on an actor (mutually exclusive). */
export function fatigueAttackPenalty(actorStatuses: StatusSet): number {
  for (const [tier, id] of Object.entries(FATIGUE_CONDITION_ID)) {
    if (has(actorStatuses, id)) return FATIGUE_ATTACK_PENALTY[tier as keyof typeof FATIGUE_ATTACK_PENALTY];
  }
  return 0;
}

/** Sub-project 14 Plan C: a fatigued actor's own Armor Class penalty (p.83),
 *  same sign convention as proneArmorClassPenalty. */
export function fatigueArmorClassPenalty(actorStatuses: StatusSet): number {
  for (const [tier, id] of Object.entries(FATIGUE_CONDITION_ID)) {
    if (has(actorStatuses, id)) return FATIGUE_AC_PENALTY[tier as keyof typeof FATIGUE_AC_PENALTY];
  }
  return 0;
}

/** Conditions that leave an actor unable to take any action; `held` and `stunned` are listed separately in the two
 *  gates below because a held actor may still try to break free. */
const INCAPACITATING: readonly string[] = ["unconscious", "paralyzed", "sleeping", "incapacitated", "dead", "mortalFatigue"];

function anyOf(statuses: StatusSet, ids: readonly string[]): boolean {
  return ids.some((id) => has(statuses, id));
}

/** #94: a target the attacker simply cannot miss — unconscious, paralyzed or asleep. Dead is deliberately not helpless
 *  (there is nothing left to hit). */
export function isHelpless(targetStatuses: StatusSet): boolean {
  return anyOf(targetStatuses, ["unconscious", "paralyzed", "sleeping"]);
}

/** #94: attackers suffer a flat penalty against an invisible target (no see-invisible logic). */
export function invisibleTargetPenalty(targetStatuses: StatusSet): number {
  return has(targetStatuses, "invisible") ? -4 : 0;
}

/** #94: an entangled actor's OWN attack rolls suffer a flat penalty. */
export function entangledAttackPenalty(actorStatuses: StatusSet): number {
  return has(actorStatuses, "entangled") ? -2 : 0;
}

/** #94: a frightened actor's OWN attack rolls suffer a flat penalty. */
export function frightenedAttackPenalty(actorStatuses: StatusSet): number {
  return has(actorStatuses, "frightened") ? -2 : 0;
}

/** Stunned, held or incapacitated (unconscious, paralyzed, sleeping, incapacitated, dead, mortally fatigued): the actor
 *  cannot take an attack action this round. Scoped to attack rolls only (a deliberate v1 simplification) — saving
 *  throws are NOT gated by this, since resisting something happening to you is treated as still possible. */
export function canAct(actorStatuses: StatusSet): boolean {
  return !has(actorStatuses, "stunned") && !has(actorStatuses, "held") && !anyOf(actorStatuses, INCAPACITATING);
}

/** Wrestling follow-ups (SP7e): a holder acts like anyone else, but a HELD character may still try to break free
 *  (being held is what breaking free is for); stunned or any incapacitating condition still rules it out. */
export function contestAllowed(kind: string, actorStatuses: StatusSet): boolean {
  if (kind !== "breakFree") return canAct(actorStatuses);
  return !has(actorStatuses, "stunned") && !anyOf(actorStatuses, INCAPACITATING);
}

/** #94: how many rounds each system-applied condition lasts. Only stunned (a called-shot-to-the-head result this
 *  project defines itself, 1 round: its own design value) is timed. Prone and held are PERSISTENT because Combat &
 *  Tactics gives them no timer: standing up from prone is a full-move action (C&T p.30, the sheet Stand Up button) and a
 *  grapple holds until the victim escapes (C&T p.12). Turned, fatigue and anything applied by hand are indefinite too. */
export const CONDITION_DURATION_ROUNDS: Readonly<Record<string, number>> = { stunned: 1 };

/** The ActiveEffect `duration` data for a freshly applied condition, or null when it has none. The effect should run
 *  through the target's next turn(s): a target yet to act this round loses the rest of this round, so it expires at the
 *  START of its turn N rounds on; one that has already acted (or is acting now) carries it through that turn, so it expires
 *  at that turn's END. */
export function conditionDuration(
  conditionId: string,
  targetHasActed: boolean,
): { value: number; units: "rounds"; expiry: "turnStart" | "turnEnd" } | null {
  const value = CONDITION_DURATION_ROUNDS[conditionId];
  if (value === undefined) return null;
  return { value, units: "rounds", expiry: targetHasActed ? "turnEnd" : "turnStart" };
}
