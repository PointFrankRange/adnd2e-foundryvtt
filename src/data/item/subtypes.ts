// The nine Item sub-types this system registers (must equal system.json
// documentTypes.Item — asserted in tests/data/subtypes.test.ts).
export type ItemSubtype =
  | "class"
  | "race"
  | "weapon"
  | "armor"
  | "equipment"
  | "spell"
  | "weaponProficiency"
  | "nonweaponProficiency"
  | "classFeature";

export const ITEM_SUBTYPES: readonly ItemSubtype[] = [
  "class",
  "race",
  "weapon",
  "armor",
  "equipment",
  "spell",
  "weaponProficiency",
  "nonweaponProficiency",
  "classFeature",
];
