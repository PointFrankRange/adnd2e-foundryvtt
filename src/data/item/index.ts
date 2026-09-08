import type { ItemSubtype } from "./subtypes";
import { ClassItemModel } from "./class";
import { RaceItemModel } from "./race";
import { WeaponItemModel } from "./weapon";
import { ArmorItemModel } from "./armor";
import { EquipmentItemModel } from "./equipment";
import { SpellItemModel } from "./spell";
import { WeaponProficiencyItemModel } from "./weapon-proficiency";
import { NonweaponProficiencyItemModel } from "./nonweapon-proficiency";
import { ClassFeatureItemModel } from "./class-feature";

export {
  ClassItemModel,
  RaceItemModel,
  WeaponItemModel,
  ArmorItemModel,
  EquipmentItemModel,
  SpellItemModel,
  WeaponProficiencyItemModel,
  NonweaponProficiencyItemModel,
  ClassFeatureItemModel,
};

/** Registered on `CONFIG.Item.dataModels` in the init hook. Keys ≡ `ITEM_SUBTYPES`. */
export const ITEM_DATA_MODELS: Record<
  ItemSubtype,
  typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, Item.Implementation>
> = {
  class: ClassItemModel,
  race: RaceItemModel,
  weapon: WeaponItemModel,
  armor: ArmorItemModel,
  equipment: EquipmentItemModel,
  spell: SpellItemModel,
  weaponProficiency: WeaponProficiencyItemModel,
  nonweaponProficiency: NonweaponProficiencyItemModel,
  classFeature: ClassFeatureItemModel,
};
