// PHBR10 p.15: a race's natural armor class. Armor rated better than it sets the AC; armor rated equal or worse still adds +1 protection.
const AC_BEST = -10;
const NO_ARMOR_AC = 10;

export function effectiveBaseArmorAc(armorAc: number, naturalAc: number | null): number {
  if (naturalAc === null) return armorAc;
  if (armorAc >= NO_ARMOR_AC) return naturalAc;
  if (armorAc < naturalAc) return armorAc;
  return Math.max(AC_BEST, naturalAc - 1);
}
