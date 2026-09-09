import { getChassis } from "../../../core/classes/chassis";
import { nonweaponProficiencySlots, weaponProficiencySlots } from "../../../core/classes/progression";
import type { ClassId } from "../../../core/types";

export type SlotBlock = { total: number; spent: number; available: number };

/** §5.6 step 9 — weapon + non-weapon proficiency slot totals and the language cap. */
export function deriveProficiencySlots(
  chassisId: ClassId,
  level: number,
  intBonusLanguages: number,
  spentWeapon: number,
  spentNonweapon: number,
): { weapon: SlotBlock; nonweapon: SlotBlock; languagesMax: number } {
  const chassis = getChassis(chassisId);
  const wTotal = weaponProficiencySlots(chassis, level);
  const nTotal = nonweaponProficiencySlots(chassis, level);
  return {
    weapon: { total: wTotal, spent: spentWeapon, available: wTotal - spentWeapon },
    nonweapon: { total: nTotal, spent: spentNonweapon, available: nTotal - spentNonweapon },
    languagesMax: intBonusLanguages,
  };
}
