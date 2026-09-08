// PHB p.33: a priest has major, minor, or no access to each sphere of
// influence. Major access can (eventually) cast every spell level in the
// sphere; minor access is limited to 1st-, 2nd-, and 3rd-level spells.
// Sphere access gates which spells fill a slot; it never changes slot counts.
import type { SphereAccess, SphereName } from "../types";

const HIGHEST_PRIEST_SPELL_LEVEL = 7;
const MINOR_ACCESS_CAP = 3;

/** The priest's access to `sphere`, defaulting to "none" for an absent entry. */
export function resolveSphereAccess(
  table: Partial<Record<SphereName, SphereAccess>>,
  sphere: SphereName,
): SphereAccess {
  return table[sphere] ?? "none";
}

/** Highest spell level castable from a sphere at the given access level. */
export function sphereSpellLevelCap(access: SphereAccess): number {
  if (access === "major") return HIGHEST_PRIEST_SPELL_LEVEL;
  if (access === "minor") return MINOR_ACCESS_CAP;
  return 0;
}

/** Whether a priest with `access` to a sphere can cast a spell of `spellLevel` from it. */
export function canCastSphereSpell(access: SphereAccess, spellLevel: number): boolean {
  return spellLevel >= 1 && spellLevel <= sphereSpellLevelCap(access);
}
