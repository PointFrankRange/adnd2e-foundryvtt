// Mechanical consequences of the 4 curated status effects this sub-project
// automates (spec §2 "Condition mechanics scope"). The other 11 shipped
// conditions (src/conditions.ts) stay flavor-only markers with no consumer
// here — a GM interprets them by hand until a future sub-project extends this
// list. All numeric values are this project's own design (content policy) —
// not transcribed from any rulebook table.

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

/** Stunned or held: the actor cannot take an attack action this round.
 *  Scoped to attack rolls only (a deliberate v1 simplification) — saving
 *  throws are NOT gated by this, since resisting something happening to you
 *  is treated as still possible while stunned/held. */
export function canAct(actorStatuses: StatusSet): boolean {
  return !has(actorStatuses, "stunned") && !has(actorStatuses, "held");
}
