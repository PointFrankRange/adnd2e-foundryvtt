import type { ArmorType } from "../types";

/* Class + kit equipment restrictions (SP11 Plan A). Pure. The chassis data
 * (`armorAllowed` / `weaponsAllowed`) uses names ("studded leather") and a
 * "blunt" weapon category that don't match item data (armor type ids; weapon
 * damage types), so everything is normalized into ArmorRule / WeaponRule first. */

export const EQUIPMENT_MODES = ["inherit", "replace", "extend"] as const;
export type EquipmentMode = (typeof EQUIPMENT_MODES)[number];

/** Mirrors the item schema's ARMOR_TYPES (drift-tested). */
export const ARMOR_TYPE_IDS: readonly ArmorType[] = [
  "none", "padded", "leather", "studded-leather", "ring-mail", "scale-mail",
  "chain-mail", "elven-chain", "splint-mail", "banded-mail", "plate-mail",
  "field-plate", "full-plate",
];

export type RestrictedArmorRule = { any: false; types: readonly ArmorType[]; shield: boolean };
export type ArmorRule = { any: true } | RestrictedArmorRule;
export type RestrictedWeaponRule = { any: false; names: readonly string[]; blunt: boolean };
export type WeaponRule = { any: true } | RestrictedWeaponRule;

export interface EquipmentOverride {
  mode: EquipmentMode;
  names: readonly string[];
}

const slug = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, "-");

/** Names -> a restricted armor rule. "shield" permits shields; a name with no armor type id is returned in `unmapped`. */
export function armorRuleFromNames(names: readonly string[]): { rule: RestrictedArmorRule; unmapped: string[] } {
  const types: ArmorType[] = [];
  const unmapped: string[] = [];
  let shield = false;
  for (const name of names) {
    const id = slug(name);
    if (id === "shield") shield = true;
    else if ((ARMOR_TYPE_IDS as readonly string[]).includes(id)) {
      if (!types.includes(id as ArmorType)) types.push(id as ArmorType);
    } else unmapped.push(name);
  }
  return { rule: { any: false, types, shield }, unmapped };
}

export function baseArmorRule(allowed: "any" | "none" | readonly string[]): { rule: ArmorRule; unmapped: string[] } {
  if (allowed === "any") return { rule: { any: true }, unmapped: [] };
  if (allowed === "none") return { rule: { any: false, types: [], shield: false }, unmapped: [] };
  return armorRuleFromNames(allowed);
}

/** "staff" and "quarterstaff" are the same weapon (the chassis data says staff, the items say Quarterstaff). */
function expandWeaponName(key: string): string[] {
  return key === "staff" || key === "quarterstaff" ? ["staff", "quarterstaff"] : [key];
}

/** Names -> a restricted weapon rule. The token "blunt" sets the blunt flag; every other token is a weapon name. */
export function weaponRuleFromNames(names: readonly string[]): RestrictedWeaponRule {
  const out: string[] = [];
  let blunt = false;
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (key === "blunt") blunt = true;
    else if (key) out.push(...expandWeaponName(key));
  }
  return { any: false, names: out, blunt };
}

export type BaseWeaponsAllowed =
  | "any"
  | { readonly categories?: readonly string[]; readonly names?: readonly string[] };

export function baseWeaponRule(allowed: BaseWeaponsAllowed): { rule: WeaponRule; unmappedCategories: string[] } {
  if (allowed === "any") return { rule: { any: true }, unmappedCategories: [] };
  const categories = (allowed.categories ?? []).map((c) => c.toLowerCase());
  return {
    rule: { any: false, names: (allowed.names ?? []).flatMap((n) => expandWeaponName(n.trim().toLowerCase())), blunt: categories.includes("blunt") },
    unmappedCategories: categories.filter((c) => c !== "blunt"),
  };
}

export function resolveArmorRule(base: ArmorRule, override: EquipmentOverride): ArmorRule {
  if (override.mode === "inherit") return base;
  const kit = armorRuleFromNames(override.names).rule;
  if (override.mode === "replace") return kit;
  if (base.any) return base;
  return { any: false, types: [...new Set([...base.types, ...kit.types])], shield: base.shield || kit.shield };
}

export function resolveWeaponRule(base: WeaponRule, override: EquipmentOverride): WeaponRule {
  if (override.mode === "inherit") return base;
  const kit = weaponRuleFromNames(override.names);
  if (override.mode === "replace") return kit;
  if (base.any) return base;
  return { any: false, names: [...new Set([...base.names, ...kit.names])], blunt: base.blunt || kit.blunt };
}

export function armorPermitted(rule: ArmorRule, armor: { armorType: ArmorType; isShield: boolean }): boolean {
  if (rule.any) return true;
  if (armor.isShield) return rule.shield;
  if (armor.armorType === "none") return true;
  return rule.types.includes(armor.armorType);
}

export function weaponPermitted(
  rule: WeaponRule,
  weapon: { name: string; baseWeaponName: string; damageType: string | null },
): boolean {
  if (rule.any) return true;
  const key = (weapon.baseWeaponName || weapon.name).trim().toLowerCase();
  if (rule.names.includes(key)) return true;
  // A null damage type is unknown (never set): permit it under the blunt rule rather than warn.
  return rule.blunt && (weapon.damageType === null || weapon.damageType.includes("bludgeoning"));
}

/** Multiclass: permitted when any of the actor's class rules permits it. No classes = no restriction. */
export function armorPermittedByAny(rules: readonly ArmorRule[], armor: { armorType: ArmorType; isShield: boolean }): boolean {
  return rules.length === 0 || rules.some((r) => armorPermitted(r, armor));
}

export function weaponPermittedByAny(
  rules: readonly WeaponRule[],
  weapon: { name: string; baseWeaponName: string; damageType: string | null },
): boolean {
  return rules.length === 0 || rules.some((r) => weaponPermitted(r, weapon));
}
