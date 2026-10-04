import { canCastSphereSpell, resolveSphereAccess } from "../core/magic/spheres";
import { CLERIC_SPHERE_ACCESS, DRUID_SPHERE_ACCESS } from "../core/magic/tables";
import type { SphereAccess, SphereName } from "../core/types";

function priestSphereTableFor(chassisId: string): Partial<Record<SphereName, SphereAccess>> {
  if (chassisId === "cleric") return CLERIC_SPHERE_ACCESS;
  if (chassisId === "druid") return DRUID_SPHERE_ACCESS;
  return {};
}

function effectiveSphereAccess(
  chassisId: string,
  sphereAccessOverride: readonly SphereName[] | null,
): Partial<Record<SphereName, SphereAccess>> {
  if (!sphereAccessOverride) return priestSphereTableFor(chassisId);
  const out: Partial<Record<SphereName, SphereAccess>> = {};
  for (const s of sphereAccessOverride) out[s] = "major";
  return out;
}

/**
 * Whether a priest can memorize a spell belonging to `spellSpheres` at `spellLevel`.
 * A spell is memorizable if ANY of its listed spheres is accessible at a level the
 * access allows (PHB's multi-sphere quantifier — a spell is castable if the priest
 * has access to ANY of its spheres, same rule already established for the wizard's
 * multi-school opposition check).
 *
 * `chassisId` is the priest-progression class item's chassisId on the actor (e.g.
 * "cleric"/"druid"), or null when the actor has no priest-progression class — always
 * returns false in that case. `sphereAccessOverride`, when non-null, REPLACES the
 * chassis table entirely: every listed sphere becomes "major" access, everything
 * else "none" (matches `system.spellcasting.priest.sphereAccessOverride`'s schema
 * shape — a plain list of accessible sphere names, src/data/actor/base-actor.ts).
 */
export function canMemorizePriestSpell(
  chassisId: string | null,
  sphereAccessOverride: readonly SphereName[] | null,
  spellSpheres: readonly SphereName[],
  spellLevel: number,
): boolean {
  return priestAccessScope(chassisId, sphereAccessOverride, spellSpheres, spellLevel) !== null;
}

/** The Table 29 column a memorize of this spell is priced under: "major" when a
 *  listed sphere grants major access at this level, "minor" when only minor
 *  access applies, null when none does. Same override/chassis rules as
 *  canMemorizePriestSpell. */
export function priestAccessScope(
  chassisId: string | null,
  sphereAccessOverride: readonly SphereName[] | null,
  spellSpheres: readonly SphereName[],
  spellLevel: number,
): "major" | "minor" | null {
  if (!chassisId) return null;
  const table = effectiveSphereAccess(chassisId, sphereAccessOverride);
  let best: "major" | "minor" | null = null;
  for (const sphere of spellSpheres) {
    const access = resolveSphereAccess(table, sphere);
    if (access === "major" && canCastSphereSpell(access, spellLevel)) return "major";
    if (access === "minor" && canCastSphereSpell(access, spellLevel)) best = "minor";
  }
  return best;
}

/** Whether the priest holds major access to at least one sphere at
 *  `spellLevel`. Gates a major free theurgy at memorize time: the book allows
 *  free theurgies only from major access, and minor access allows none. Same
 *  override/chassis rules as canMemorizePriestSpell; false when the actor has
 *  no priest-progression class. */
export function priestHasMajorAccessAtLevel(
  chassisId: string | null,
  sphereAccessOverride: readonly SphereName[] | null,
  spellLevel: number,
): boolean {
  if (!chassisId) return false;
  const table = effectiveSphereAccess(chassisId, sphereAccessOverride);
  return Object.values(table).some((access) => access === "major") && canCastSphereSpell("major", spellLevel);
}

/** The priest free-theurgy filter: the Table 29 column being cast, plus what
 *  the priest's sphere access is computed from (see priestAccessScope). */
export interface PriestFreeMagickFilter {
  scope: "major" | "universal";
  chassisId: string | null;
  sphereAccessOverride: readonly SphereName[] | null;
}

/** The spell fields the free-theurgy eligibility test reads. Both the Foundry
 *  item's `system` and the sheet's SpellItemView satisfy it. */
export interface PriestTheurgyCandidate {
  casterClass?: string;
  level?: number;
  spheres?: readonly string[];
}

/** Whether a priest spell may be cast as a free theurgy of this column at
 *  this spell level. Universal free: any priest spell of the level. Major
 *  free: the spell must be major-access for this priest at that level. The
 *  single source of truth for the cast prompt, castFreeTheurgy's re-check, and
 *  the sheet's Cast-button flag. */
export function priestFreeCastEligible(
  filter: PriestFreeMagickFilter,
  spell: PriestTheurgyCandidate,
  spellLevel: number,
): boolean {
  if (spell.casterClass !== "priest" || spell.level !== spellLevel) return false;
  if (filter.scope === "universal") return true;
  return priestAccessScope(filter.chassisId, filter.sphereAccessOverride, (spell.spheres ?? []) as SphereName[], spellLevel) === "major";
}
