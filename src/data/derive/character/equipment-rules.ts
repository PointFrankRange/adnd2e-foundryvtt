import { getChassis } from "../../../core/classes/chassis";
import {
  armorPermittedByAny, baseArmorRule, baseWeaponRule, resolveArmorRule, resolveWeaponRule, weaponPermittedByAny,
  type ArmorRule, type WeaponRule,
} from "../../../core/kits";
import type { ArmorType, ClassId } from "../../../core/types";
import { activeKitEntries } from "./kits";

/* SP11 Plan A: the actor's class (plus kit) armor and weapon rules, one per class. Pure. */

type ItemLike = { id?: string; name?: string; type: string; system: unknown };

export function actorEquipmentRules(items: Iterable<ItemLike>): { armor: ArmorRule[]; weapons: WeaponRule[] } {
  const all = [...items];
  const kits = activeKitEntries(all);
  const armor: ArmorRule[] = [];
  const weapons: WeaponRule[] = [];
  for (const item of all) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId: ClassId }).chassisId;
    const chassis = getChassis(chassisId);
    const kit = kits.find((k) => k.chassisId === chassisId);
    const baseArmor = baseArmorRule(chassis.armorAllowed).rule;
    const baseWeapons = baseWeaponRule(chassis.weaponsAllowed).rule;
    armor.push(kit ? resolveArmorRule(baseArmor, kit.equipment.armor) : baseArmor);
    weapons.push(kit ? resolveWeaponRule(baseWeapons, kit.equipment.weapons) : baseWeapons);
  }
  return { armor, weapons };
}

/** True only for a weapon or armor item the rules do not permit (the caller decides whether it matters: equipped only). */
export function itemNotPermitted(
  rules: { armor: readonly ArmorRule[]; weapons: readonly WeaponRule[] },
  item: { name?: string; type: string; system: unknown },
): boolean {
  if (item.type === "armor") {
    const s = item.system as { armorType: ArmorType; isShield: boolean };
    return !armorPermittedByAny(rules.armor, { armorType: s.armorType, isShield: s.isShield });
  }
  if (item.type === "weapon") {
    const s = item.system as { baseWeaponName: string; damageType: string | null };
    return !weaponPermittedByAny(rules.weapons, { name: item.name ?? "", baseWeaponName: s.baseWeaponName, damageType: s.damageType });
  }
  return false;
}
