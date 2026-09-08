import { CLASS_IDS, CREATURE_SIZES, RACE_IDS } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, ArrayField, ObjectField } = foundry.data.fields;

export class RaceItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      raceId: new StringField({ required: true, blank: false, initial: "human", choices: RACE_IDS }),
      size: new StringField({ required: true, blank: false, initial: "medium", choices: CREATURE_SIZES }),
      baseMovement: new NumberField({ required: true, integer: true, min: 0, initial: 12 }),
      infravision: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** PHB Table 7 — raceId+classId -> max level (or null = unlimited). Free-form object. */
      classLevelLimits: new ObjectField({ required: true, initial: {} }),
      allowedClasses: new ArrayField(new StringField({ required: true, blank: false, choices: CLASS_IDS }), { required: true, initial: [] }),
      allowedMulticlass: new ArrayField(
        new ArrayField(new StringField({ required: true, blank: false, choices: CLASS_IDS })),
        { required: true, initial: [] },
      ),
      bonusLanguages: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
      grantedFeatures: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
    };
  }
}
