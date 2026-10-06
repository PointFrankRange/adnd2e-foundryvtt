import { THIEF_SKILLS } from "../../core/proficiencies/thief-skills";
import { ABILITY_KEYS, CLASS_IDS, CREATURE_SIZES, RACE_IDS } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, ArrayField, ObjectField, SchemaField } = foundry.data.fields;

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
      /** SP12 Plan A: a subrace layer over `raceId` (the base PHB race). Every nullable field defaults to null = inherit the base race's table; existing race items need no migration. */
      subrace: new SchemaField({
        id: new StringField({ required: true, blank: true, initial: "" }),
        abilityAdjustments: new SchemaField(
          Object.fromEntries(ABILITY_KEYS.map((k) => [k, new NumberField({ required: true, integer: true, initial: 0 })])),
          { required: true, nullable: true, initial: null },
        ),
        abilityRanges: new SchemaField(
          Object.fromEntries(
            ABILITY_KEYS.map((k) => [
              k,
              new SchemaField({
                min: new NumberField({ required: true, integer: true, min: 0, max: 25, initial: 3 }),
                max: new NumberField({ required: true, integer: true, min: 0, max: 25, initial: 18 }),
              }),
            ]),
          ),
          { required: true, nullable: true, initial: null },
        ),
        thiefAdjustments: new SchemaField(
          Object.fromEntries(THIEF_SKILLS.map((s) => [s, new NumberField({ required: true, integer: true, initial: 0 })])),
          { required: true, nullable: true, initial: null },
        ),
        conSaveBonusAdjustment: new NumberField({ required: true, integer: true, initial: 0 }),
        xpModifierPercent: new NumberField({ required: true, integer: true, min: -90, initial: 0 }),
      }),
    };
  }
}
