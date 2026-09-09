// PHB pp.44-45: multi-class (demihuman, simultaneous) and dual-class (human,
// sequential) advancement. Pure — argmin over the THAC0 table, argmax over the
// proficiency progressions, and the dual-class suppressed/surpassed state
// machine. HP composition is the caller's job (it owns characterHpMax); this
// module only picks and averages the numbers it is handed.
import { getChassis } from "./chassis";
import { nonweaponProficiencySlots, weaponProficiencySlots } from "./progression";
import { thac0 } from "./thac0";
import type { ClassGroup, ClassId, GroupLevel, WizardSchool } from "../types";

export type ClassArrangement = "single" | "multiclass" | "dualclass";

export interface ClassMember {
  chassisId: ClassId;
  level: number;
  specialistSchool: WizardSchool | null;
}

export interface ArrangementResolution {
  /** the class table that yields the lowest (best) THAC0 */
  bestThac0: GroupLevel;
  /** every considered class's (group, level) — the caller runs the per-category best-of */
  saveGroups: GroupLevel[];
  /** the class with the most weapon proficiency slots */
  weaponProfSource: { chassisId: ClassId; level: number };
  /** the class with the most non-weapon proficiency slots */
  nonweaponProfSource: { chassisId: ClassId; level: number };
  /** members whose chassis can cast (deriveSpellSlots filters to full casters) */
  casters: ClassMember[];
  hpMax: number;
}

export interface DualClassResolution extends ArrangementResolution {
  /** the new class's level exceeds the abandoned class's — both are fully usable */
  surpassed: boolean;
  /** the abandoned ("primary") class */
  dormantChassisId: ClassId;
  /** the class currently being advanced */
  activeChassisId: ClassId;
}

function groupOf(id: ClassId): ClassGroup {
  return getChassis(id).group;
}

function toGroupLevel(m: ClassMember): GroupLevel {
  return { group: groupOf(m.chassisId), level: m.level };
}

function bestThac0Of(levels: readonly GroupLevel[]): GroupLevel {
  let best = levels[0];
  for (const gl of levels) {
    if (thac0(gl.group, gl.level) < thac0(best.group, best.level)) best = gl;
  }
  return best;
}

function maxBy(
  members: readonly ClassMember[],
  slots: (id: ClassId, level: number) => number,
): { chassisId: ClassId; level: number } {
  let best = members[0];
  for (const m of members) {
    if (slots(m.chassisId, m.level) > slots(best.chassisId, best.level)) best = m;
  }
  return { chassisId: best.chassisId, level: best.level };
}

const weaponSlotsOf = (id: ClassId, level: number): number =>
  weaponProficiencySlots(getChassis(id), level);
const nonweaponSlotsOf = (id: ClassId, level: number): number =>
  nonweaponProficiencySlots(getChassis(id), level);

function castersOf(members: readonly ClassMember[]): ClassMember[] {
  return members.filter((m) => getChassis(m.chassisId).casterType !== null);
}

export function resolveMulticlass(
  members: readonly ClassMember[],
  input: { perClassHp: readonly number[]; averageHp: boolean },
): ArrangementResolution {
  const saveGroups = members.map(toGroupLevel);
  const total = input.perClassHp.reduce((a, b) => a + b, 0);
  const hpMax = input.averageHp
    ? Math.floor(total / members.length)
    : Math.max(...input.perClassHp);
  return {
    bestThac0: bestThac0Of(saveGroups),
    saveGroups,
    weaponProfSource: maxBy(members, weaponSlotsOf),
    nonweaponProfSource: maxBy(members, nonweaponSlotsOf),
    casters: castersOf(members),
    hpMax,
  };
}

export function resolveDualClass(input: {
  primary: ClassMember;
  active: ClassMember;
  /** primary class's frozen HP total (caller ran characterHpMax at primary.level) */
  primaryFrozenHp: number;
  /** HP the active class contributes for levels ABOVE primary.level (0 while suppressed) */
  activeHpAbovePrimary: number;
}): DualClassResolution {
  const { primary, active } = input;
  const surpassed = active.level > primary.level;
  const considered = surpassed ? [primary, active] : [active];
  const saveGroups = considered.map(toGroupLevel);
  return {
    surpassed,
    dormantChassisId: primary.chassisId,
    activeChassisId: active.chassisId,
    bestThac0: bestThac0Of(saveGroups),
    saveGroups,
    weaponProfSource: maxBy(considered, weaponSlotsOf),
    nonweaponProfSource: maxBy(considered, nonweaponSlotsOf),
    casters: castersOf(considered),
    hpMax: input.primaryFrozenHp + (surpassed ? input.activeHpAbovePrimary : 0),
  };
}
