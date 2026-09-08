import { ABILITY_KEYS, NONWEAPON_GROUPS } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class NonweaponProficiencyItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      governingAbility: new StringField({ required: true, blank: false, initial: "str", choices: ABILITY_KEYS }),
      modifier: new NumberField({ required: true, integer: true, initial: 0 }),
      slotCost: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      group: new StringField({ required: true, blank: false, initial: "general", choices: NONWEAPON_GROUPS }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      isRacial: new BooleanField({ required: true, initial: false }),
      checkPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
    };
  }
}
