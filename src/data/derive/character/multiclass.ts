// Maps the ActorSnapshot class list onto the pure core resolvers. Runs
// characterHpMax per class here (it needs the per-class Constitution column) and
// hands core the resulting HP array — core does the averaging and the best-of.
import { constitution } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import {
  resolveDualClass,
  resolveMulticlass,
  type ArrangementResolution,
  type ClassArrangement,
  type ClassMember,
  type DualClassResolution,
} from "../../../core/classes/multiclass";
import { characterHpMax } from "./hp";
import type { ClassEntry } from "./snapshot";

export type { ClassArrangement };

/** Which advancement arrangement the embedded `class` items represent. */
export function classifyArrangement(classes: readonly ClassEntry[]): ClassArrangement {
  if (classes.length <= 1) return "single";
  const primary = classes.filter((c) => c.dualClassState === "primary").length;
  const active = classes.filter((c) => c.dualClassState === "active").length;
  if (classes.length === 2 && primary === 1 && active === 1) return "dualclass";
  return "multiclass";
}

function member(entry: ClassEntry, level: number): ClassMember {
  return { chassisId: entry.chassisId, level, specialistSchool: entry.specialistSchool };
}

/** Per-class CON hp adjustment — warrior members use the higher warrior column. */
function conAdjFor(chassisId: ClassEntry["chassisId"], conScore: number): number {
  return constitution(conScore, getChassis(chassisId).group === "warrior").hpAdjustment;
}

function hpFor(entry: ClassEntry, level: number, conScore: number): number {
  return characterHpMax(entry.chassisId, level, entry.hpRolls, conAdjFor(entry.chassisId, conScore));
}

export function resolveMulticlassArrangement(
  classes: readonly ClassEntry[],
  levels: readonly number[],
  conScore: number,
  averageHp: boolean,
): ArrangementResolution {
  const members = classes.map((c, i) => member(c, levels[i]));
  const perClassHp = classes.map((c, i) => hpFor(c, levels[i], conScore));
  return resolveMulticlass(members, { perClassHp, averageHp });
}

/**
 * Precondition: `classes` is exactly one `dualClassState:"primary"` + one
 * `"active"` (i.e. `classifyArrangement(classes) === "dualclass"`). The
 * `findIndex` lookups below assume both are present.
 */
export function resolveDualClassArrangement(
  classes: readonly ClassEntry[],
  levels: readonly number[],
  conScore: number,
): DualClassResolution {
  const pIdx = classes.findIndex((c) => c.dualClassState === "primary");
  const aIdx = classes.findIndex((c) => c.dualClassState === "active");
  const primaryEntry = classes[pIdx];
  const activeEntry = classes[aIdx];
  const primaryLevel = levels[pIdx];
  const activeLevel = levels[aIdx];
  const conAdj = conAdjFor(activeEntry.chassisId, conScore);

  const activeFull = characterHpMax(activeEntry.chassisId, activeLevel, activeEntry.hpRolls, conAdj);
  const activeAtPrimary = characterHpMax(
    activeEntry.chassisId,
    primaryLevel,
    activeEntry.hpRolls.slice(0, primaryLevel),
    conAdj,
  );

  return resolveDualClass({
    primary: member(primaryEntry, primaryLevel),
    active: member(activeEntry, activeLevel),
    primaryFrozenHp: hpFor(primaryEntry, primaryLevel, conScore),
    activeHpAbovePrimary: activeFull - activeAtPrimary,
  });
}
