import { getChassis } from "../../../core/classes/chassis";
import { nonweaponProficiencySlots, weaponProficiencySlots } from "../../../core/classes/progression";
import type { ClassId } from "../../../core/types";

export type SlotBlock = { total: number; spent: number; available: number };
export interface ProfSource {
  chassisId: ClassId;
  level: number;
}

/** §5.6 step 9 — weapon + non-weapon proficiency slot totals and the language cap. */
export function deriveProficiencySlots(
  weaponSource: ProfSource,
  nonweaponSource: ProfSource,
  intBonusLanguages: number,
  spentWeapon: number,
  spentNonweapon: number,
): { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } {
  const wTotal = weaponProficiencySlots(getChassis(weaponSource.chassisId), weaponSource.level);
  const nTotal = nonweaponProficiencySlots(getChassis(nonweaponSource.chassisId), nonweaponSource.level);
  return {
    weapon: { total: wTotal, spent: spentWeapon, available: wTotal - spentWeapon },
    nonweapon: { total: nTotal, spent: spentNonweapon, available: nTotal - spentNonweapon },
    languagesMax: intBonusLanguages,
  };
}
