import { DAMAGE_TYPES, WEAPON_CATEGORIES, WEAPON_SIZES } from "./choices";
import { physicalItemSchema } from "../common/physical-item";
import { toWeaponData } from "../derive/weapon";
import { totalWeight } from "../derive/physical-item";
import { Adnd2eItemModel } from "./base-item";
import type { DamageType, WeaponCategory, WeaponData, WeaponRange, WeaponSize } from "../../core/weapons/data";

const { StringField, NumberField, BooleanField, SchemaField } = foundry.data.fields;

export class WeaponItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      ...physicalItemSchema(),
      category: new StringField({ required: true, blank: false, initial: "melee", choices: WEAPON_CATEGORIES }),
      damageVsSM: new StringField({ required: true, nullable: true, initial: null }),
      damageVsL: new StringField({ required: true, nullable: true, initial: null }),
      damageType: new StringField({ required: true, nullable: true, initial: null, choices: DAMAGE_TYPES }),
      speedFactor: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      size: new StringField({ required: true, blank: false, initial: "M", choices: WEAPON_SIZES }),
      rateOfFire: new StringField({ required: true, nullable: true, initial: null }),
      range: new SchemaField(
        {
          short: new NumberField({ required: true, min: 0, initial: 0 }),
          medium: new NumberField({ required: true, min: 0, initial: 0 }),
          long: new NumberField({ required: true, min: 0, initial: 0 }),
        },
        { required: true, nullable: true, initial: null },
      ),
      proficiencyGroup: new StringField({ required: true, blank: true, initial: "" }),
      handsRequired: new NumberField({ required: true, integer: true, choices: [1, 2], initial: 1 }),
      materialToHit: new NumberField({ required: true, integer: true, initial: 0 }),
      styleGroup: new StringField({ required: true, blank: true, initial: "" }),
      specialization: new SchemaField({
        profSlotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        isSpecialized: new BooleanField({ required: true, initial: false }),
        isMastery: new BooleanField({ required: true, initial: false }),
      }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as {
      category: WeaponCategory;
      damageVsSM: string | null;
      damageVsL: string | null;
      damageType: DamageType | null;
      speedFactor: number;
      weight: number;
      size: WeaponSize;
      rateOfFire: string | null;
      range: WeaponRange | null;
      proficiencyGroup: string;
      handsRequired: 1 | 2;
      quantity: number;
      totalWeight?: number;
      weaponData?: WeaponData;
    };
    const name = (this.parent as { name?: string } | undefined)?.name ?? "";
    sys.totalWeight = totalWeight({ weight: sys.weight, quantity: sys.quantity });
    sys.weaponData = toWeaponData({
      name,
      category: sys.category,
      damageVsSM: sys.damageVsSM,
      damageVsL: sys.damageVsL,
      damageType: sys.damageType,
      speedFactor: sys.speedFactor,
      weight: sys.weight,
      size: sys.size,
      rateOfFire: sys.rateOfFire,
      range: sys.range,
      proficiencyGroup: sys.proficiencyGroup,
      handsRequired: sys.handsRequired,
    });
  }
}
