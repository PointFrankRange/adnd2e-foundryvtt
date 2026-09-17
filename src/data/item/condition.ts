import { Adnd2eItemModel } from "./base-item";

const { StringField } = foundry.data.fields;

export class ConditionItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      conditionId: new StringField({ required: true, blank: true, initial: "" }),
    };
  }
}
