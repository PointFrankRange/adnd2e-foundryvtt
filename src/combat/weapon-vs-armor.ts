import type { ArmorType } from "../core/types";
import type { DamageType } from "../core/weapons/data";

// This project's own designed weapon-vs-armor modifier table (spec §2
// "Armor-vs-weapon-type key" — damageType × a collapsed 4-bucket armor
// grouping, not all 13 individual ArmorType values, since this system's
// weapons only classify by broad damageType, not per-weapon-name granularity
// the way 2E's own actual table does). Content policy: mechanical values
// only, not transcribed from any rulebook's actual table.

export type ArmorGroup = "unarmored" | "padded-leather-studded" | "ring-scale-chain" | "splint-banded-plate";

const ARMOR_TYPE_TO_GROUP: Readonly<Record<ArmorType, ArmorGroup>> = {
  none: "unarmored",
  padded: "padded-leather-studded",
  leather: "padded-leather-studded",
  "studded-leather": "padded-leather-studded",
  "ring-mail": "ring-scale-chain",
  "scale-mail": "ring-scale-chain",
  "chain-mail": "ring-scale-chain",
  "elven-chain": "ring-scale-chain",
  "splint-mail": "splint-banded-plate",
  "banded-mail": "splint-banded-plate",
  "plate-mail": "splint-banded-plate",
  "field-plate": "splint-banded-plate",
  "full-plate": "splint-banded-plate",
};

/** Classifies a real 13-member ArmorType into one of the 4 collapsed groups
 *  this plan's modifier table keys against — mirrors the exact pattern
 *  `classifyThiefArmor` (core/proficiencies/thief-skills.ts) already
 *  established for the same 13-member enum. */
export function toArmorGroup(armorType: ArmorType): ArmorGroup {
  return ARMOR_TYPE_TO_GROUP[armorType];
}

const WEAPON_VS_ARMOR_TABLE: Readonly<Record<DamageType, Readonly<Record<ArmorGroup, number>>>> = {
  slashing: { unarmored: 0, "padded-leather-studded": 0, "ring-scale-chain": -1, "splint-banded-plate": -2 },
  piercing: { unarmored: 0, "padded-leather-studded": 1, "ring-scale-chain": 0, "splint-banded-plate": -1 },
  bludgeoning: { unarmored: 0, "padded-leather-studded": -1, "ring-scale-chain": 1, "splint-banded-plate": 2 },
  "piercing-slashing": { unarmored: 0, "padded-leather-studded": 0, "ring-scale-chain": -1, "splint-banded-plate": -1 },
  "piercing-bludgeoning": { unarmored: 0, "padded-leather-studded": 0, "ring-scale-chain": 0, "splint-banded-plate": 0 },
};

/** Positive = easier to hit (added directly to attackModifiers()'s
 *  situationalModifier, same sign convention as every other term there). */
export function weaponVsArmorModifier(damageType: DamageType, armorGroup: ArmorGroup): number {
  return WEAPON_VS_ARMOR_TABLE[damageType][armorGroup];
}
