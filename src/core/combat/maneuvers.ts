// Player's Option: Combat & Tactics called shots + curated combat maneuvers
// (SP7 Plan 7d). Both are unified into ONE mechanic per spec §2: an attack
// roll vs AC (rollAttack unchanged) with a location/maneuver-specific
// attack-roll penalty, and a specific effect applied on a hit. The 3 called-
// shot locations and 4 curated maneuvers below are all listed in ONE table
// (`category` distinguishes them for independent settings-gating) rather
// than two separate tables, matching the spec's own "unified as one
// mechanic" framing. Every penalty and effect here is this project's OWN
// designed value (content policy) — not transcribed from the Combat &
// Tactics book's actual tables. The full C&T maneuver list beyond these 4
// is explicitly parked for a future revisit (spec §7).
import type { ManagedConditionId } from "../../combat/condition-effects";

export type ManeuverId =
  | "calledShotHead"
  | "calledShotHand"
  | "calledShotLeg"
  | "disarm"
  | "tripKnockDown"
  | "grapple"
  | "bullRush";

export type ManeuverCategory = "calledShot" | "maneuver";

/**
 * The outcome a hit produces. `condition` applies one of this system's real
 * managed conditions (Plan 7a) to the target. `unequip` sets the target's
 * currently-equipped weapon Item to unequipped — the SAME operation as
 * Plan 7b's fumble `weaponDrops` outcome, just aimed at the target instead of
 * the attacker (Task 2 shares one small helper for both). `push` has no
 * persisted state change: this codebase has no token-position/movement
 * automation anywhere, so a successful bull rush is a distinct chat-card
 * outcome line only — a deliberate, minimal scope choice, not an oversight.
 */
export type ManeuverEffect =
  | { kind: "condition"; conditionId: ManagedConditionId }
  | { kind: "unequip" }
  | { kind: "push" };

export interface ManeuverDescriptor {
  attackPenalty: number;
  effect: ManeuverEffect;
  category: ManeuverCategory;
}

export const MANEUVERS: Record<ManeuverId, ManeuverDescriptor> = {
  calledShotHead: { attackPenalty: -8, category: "calledShot", effect: { kind: "condition", conditionId: "stunned" } },
  calledShotHand: { attackPenalty: -6, category: "calledShot", effect: { kind: "unequip" } },
  calledShotLeg: { attackPenalty: -4, category: "calledShot", effect: { kind: "condition", conditionId: "prone" } },
  disarm: { attackPenalty: -2, category: "maneuver", effect: { kind: "unequip" } },
  tripKnockDown: { attackPenalty: -2, category: "maneuver", effect: { kind: "condition", conditionId: "prone" } },
  grapple: { attackPenalty: -2, category: "maneuver", effect: { kind: "condition", conditionId: "held" } },
  bullRush: { attackPenalty: -2, category: "maneuver", effect: { kind: "push" } },
};

/**
 * The effect a selected maneuver/called-shot produces, given whether the
 * attack hit. `null` when no maneuver was selected, or the attack missed —
 * a maneuver's effect only ever applies on a genuine hit.
 */
export function resolveManeuverOutcome(maneuverId: ManeuverId | null, hit: boolean): ManeuverEffect | null {
  if (!maneuverId || !hit) return null;
  return MANEUVERS[maneuverId].effect;
}
