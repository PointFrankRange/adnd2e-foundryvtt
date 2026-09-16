import {
  bardSkillPointsAvailable, thiefSkillPointsAvailable,
} from "../../../core/proficiencies/thief-skills";
import type { ClassId, ThiefSkill } from "../../../core/types";

export interface ThiefSkillPointBlock { total: number; spent: number; available: number }
export interface ThiefSkillAllocation { skill: ThiefSkill; allocatedPoints: number }

/** §5.6-equivalent step for SP5b — the cumulative thief/bard skill-point
 *  budget and how much of it is already spent. Scans `classes` for the
 *  FIRST entry whose `chassisId` is "thief" or "bard" (same first-match-wins
 *  multiclass simplification used elsewhere in this plan and in SP5a's
 *  `resolveProficiencyModifier`) — every other class gets a zeroed block,
 *  since only thief/bard have any thief-skill access at all
 *  (`ClassChassis.thiefSkillAccess`). `spent` sums every allocation
 *  regardless of which skills the class can actually access — an
 *  allocation for an inaccessible skill should never exist in practice
 *  (the action layer gates on `thiefSkillAccess`), but summing
 *  unconditionally keeps this function simple and total. */
export function deriveThiefSkillPoints(
  classes: readonly { chassisId: ClassId; level: number }[],
  allocations: readonly ThiefSkillAllocation[],
): ThiefSkillPointBlock {
  const spent = allocations.reduce((s, a) => s + a.allocatedPoints, 0);

  const thief = classes.find((c) => c.chassisId === "thief");
  if (thief) {
    const total = thiefSkillPointsAvailable(thief.level);
    return { total, spent, available: total - spent };
  }
  const bard = classes.find((c) => c.chassisId === "bard");
  if (bard) {
    const total = bardSkillPointsAvailable(bard.level);
    return { total, spent, available: total - spent };
  }
  return { total: 0, spent: 0, available: 0 };
}
