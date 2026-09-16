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
  if (!chassisId) return false;
  const table = effectiveSphereAccess(chassisId, sphereAccessOverride);
  return spellSpheres.some((sphere) => canCastSphereSpell(resolveSphereAccess(table, sphere), spellLevel));
}
