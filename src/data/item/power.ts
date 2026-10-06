import { Adnd2eItemModel } from "./base-item";
import { ABILITY_KEYS, POWER_DISCIPLINES, POWER_KINDS, POWER_MAINTENANCE_UNITS } from "./choices";

const { StringField, NumberField, ArrayField } = foundry.data.fields;

/** SP15 Plan A: a psionic power (PHBR5 "Summary of Powers"). The check, cost and maintenance are automated; the effect is descriptive text. */
export class PowerItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      discipline: new StringField({ required: true, blank: false, initial: "clairsentience", choices: POWER_DISCIPLINES }),
      kind: new StringField({ required: true, blank: false, initial: "devotion", choices: POWER_KINDS }),
      abilityKey: new StringField({ required: true, blank: false, initial: "wis", choices: ABILITY_KEYS }),
      abilityModifier: new NumberField({ required: true, integer: true, initial: 0 }),
      initialCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      costNote: new StringField({ required: true, blank: true, initial: "" }),
      maintenanceCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      maintenanceUnit: new StringField({ required: true, blank: false, initial: "none", choices: POWER_MAINTENANCE_UNITS }),
      range: new StringField({ required: true, blank: true, initial: "" }),
      preparation: new StringField({ required: true, blank: true, initial: "" }),
      areaOfEffect: new StringField({ required: true, blank: true, initial: "" }),
      prerequisites: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: () => [] }),
      minLevel: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      scoreBonus: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    };
  }
}
