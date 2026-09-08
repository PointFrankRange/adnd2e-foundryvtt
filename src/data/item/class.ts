import { CLASS_IDS, DUAL_CLASS_STATES, WIZARD_SCHOOLS } from "./choices";
import { classItemCanLevelUp, classItemLevel } from "../derive/class-item";
import { Adnd2eItemModel } from "./base-item";
import type { ClassId } from "../../core/types";

const { StringField, NumberField, ArrayField } = foundry.data.fields;

export class ClassItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      chassisId: new StringField({ required: true, blank: false, initial: "fighter", choices: CLASS_IDS }),
      specialistSchool: new StringField({ required: true, nullable: true, initial: null, choices: WIZARD_SCHOOLS }),
      kit: new StringField({ required: true, nullable: true, initial: null }),
      grantedFeatures: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
      xp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      hpRolls: new ArrayField(new NumberField({ required: true, integer: true, min: 0 }), { required: true, initial: [] }),
      dualClassState: new StringField({ required: true, nullable: true, initial: null, choices: DUAL_CLASS_STATES }),
    };
  }

  override prepareDerivedData(): void {
    const sys = this as unknown as {
      chassisId: ClassId;
      xp: number;
      hpRolls: number[];
      level?: number;
      canLevelUp?: boolean;
    };
    sys.level = classItemLevel(sys.chassisId, sys.xp);
    sys.canLevelUp = classItemCanLevelUp(sys.chassisId, sys.xp, sys.hpRolls.length);
  }
}
