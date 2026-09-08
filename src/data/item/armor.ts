import { physicalItemSchema } from "../common/physical-item";
import { armorAcContribution } from "../derive/armor";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class ArmorItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      baseAc: new NumberField({ required: true, integer: true, initial: 10 }),
      armorType: new StringField({ required: true, blank: true, initial: "" }),
      isShield: new BooleanField({ required: true, initial: false }),
      shieldAcBonus: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      movementPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
      checkPenalty: new NumberField({ required: true, integer: true, initial: 0 }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as {
      baseAc: number;
      magicBonus: number;
      isShield: boolean;
      shieldAcBonus: number;
      weight: number;
      quantity: number;
      totalWeight?: number;
      acContribution?: unknown;
    };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
    sys.acContribution = armorAcContribution({
      baseAc: sys.baseAc,
      magicBonus: sys.magicBonus,
      isShield: sys.isShield,
      shieldAcBonus: sys.shieldAcBonus,
    });
  }
}
