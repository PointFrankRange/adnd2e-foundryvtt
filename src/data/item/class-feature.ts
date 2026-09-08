import { FEATURE_ACTIVATIONS, FEATURE_SOURCE_TYPES } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

export class ClassFeatureItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      sourceType: new StringField({ required: true, blank: false, initial: "class", choices: FEATURE_SOURCE_TYPES }),
      activation: new StringField({ required: true, blank: false, initial: "passive", choices: FEATURE_ACTIVATIONS }),
      uses: new SchemaField(
        {
          value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          per: new StringField({ required: true, blank: true, initial: "" }),
        },
        { required: true, nullable: true, initial: null },
      ),
      effectRefs: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
    };
  }
}
