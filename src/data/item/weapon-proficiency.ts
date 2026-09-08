import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class WeaponProficiencyItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      weaponOrGroup: new StringField({ required: true, blank: true, initial: "" }),
      isGroup: new BooleanField({ required: true, initial: false }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      specialized: new BooleanField({ required: true, initial: false }),
      styleSpecialization: new StringField({ required: true, nullable: true, initial: null }),
      masteryTier: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    };
  }
}
