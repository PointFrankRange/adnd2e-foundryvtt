import { physicalItemSchema } from "../common/physical-item";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField, SchemaField } = foundry.data.fields;

export class EquipmentItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      category: new StringField({ required: true, blank: true, initial: "" }),
      charges: new SchemaField(
        {
          value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        },
        { required: true, nullable: true, initial: null },
      ),
      consumable: new BooleanField({ required: true, initial: false }),
      container: new BooleanField({ required: true, initial: false }),
      capacity: new NumberField({ required: true, nullable: true, min: 0, initial: null }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as { weight: number; quantity: number; totalWeight?: number };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
  }
}
