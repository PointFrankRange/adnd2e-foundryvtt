// Which item-sheet choice fields have a label map (#111). Pure: the sheet engine resolves the key against the
// localization table and falls back to the raw value when the key does not exist.

/** document path of an item enum field -> the CONFIG.ADND2E / lang map holding its labels */
export const CHOICE_LABEL_MAPS: Readonly<Record<string, string>> = {
  "system.armorType": "armorTypes",
  "system.damageType": "weaponDamageTypes",
  "system.category": "weaponCategories",
  "system.size": "weaponSizes",
  "system.schools": "schools",
  "system.spheres": "spheres",
};

/** The localization key for `value` of the field at `path`, or null when the field has no label map. */
export function choiceLabelKey(path: string, value: string): string | null {
  const map = CHOICE_LABEL_MAPS[path];
  return map ? `ADND2E.${map}.${value}` : null;
}
