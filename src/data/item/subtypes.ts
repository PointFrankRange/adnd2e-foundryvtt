// The thirteen Item sub-types this system registers (must equal system.json
// documentTypes.Item — asserted in tests/data/subtypes.test.ts).
export type ItemSubtype =
  | "class"
  | "race"
  | "weapon"
  | "armor"
  | "equipment"
  | "ammo"
  | "spell"
  | "weaponProficiency"
  | "nonweaponProficiency"
  | "classFeature"
  | "condition"
  | "trait"
  | "kit";

export const ITEM_SUBTYPES: readonly ItemSubtype[] = [
  "class",
  "race",
  "weapon",
  "armor",
  "equipment",
  "ammo",
  "spell",
  "weaponProficiency",
  "nonweaponProficiency",
  "classFeature",
  "condition",
  "trait",
  "kit",
];
