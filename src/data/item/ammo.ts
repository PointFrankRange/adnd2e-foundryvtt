// The `ammo` item subtype: arrows, bolts and quarrels — the S-M/L damage
// dice and damage type the PHB puts on the ammunition, not the bow/crossbow
// that fires it (docs/superpowers/specs/2026-09-28-adnd2e-ammunition-design.md).
import { DAMAGE_TYPES } from "./choices";
import { physicalItemSchema } from "../common/physical-item";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";

const { StringField } = foundry.data.fields;

export class AmmoItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      ammoType: new StringField({ required: true, blank: false, initial: "arrow" }),
      damageVsSM: new StringField({ required: true, blank: false, initial: "1d6" }),
      damageVsL: new StringField({ required: true, blank: false, initial: "1d6" }),
      damageType: new StringField({ required: true, blank: false, initial: "piercing", choices: DAMAGE_TYPES }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as { weight: number; quantity: number; totalWeight?: number };
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
  }
}
