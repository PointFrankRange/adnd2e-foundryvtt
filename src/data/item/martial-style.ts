import { Adnd2eItemModel } from "./base-item";
import { MARTIAL_STYLE_FORMS, MARTIAL_STYLE_METHODS } from "./choices";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

/**
 * SP18 Plan A: a martial arts style (PHBR15 ch.4). AC mod, damage die and principal attack DERIVE from `form` and
 * `principalMethod` (core/martial-arts `styleStats`); only the choices are stored. `availableManeuvers` and
 * `weaponGroups` are data-only in Plan A (Table 17's lists, used by Plan B). `knownManeuvers` (Plan B1) records the
 * special maneuvers learned and the level each was learned at.
 */
export class MartialStyleItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      form: new StringField({ required: true, blank: false, initial: "hard", choices: MARTIAL_STYLE_FORMS }),
      principalMethod: new StringField({ required: true, blank: false, initial: "strike", choices: MARTIAL_STYLE_METHODS }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      availableManeuvers: new ArrayField(
        new SchemaField({
          list: new StringField({ required: true, blank: false }),
          difficulties: new ArrayField(new NumberField({ required: true, integer: true, min: 1 }), { required: true, initial: () => [] }),
        }),
        { required: true, initial: () => [] },
      ),
      weaponGroups: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: () => [] }),
      /** SP18 Plan B1: the special maneuvers this character has learned on this style ({ id: "<list>:<difficulty>", level learned at }). */
      knownManeuvers: new ArrayField(
        new SchemaField({
          id: new StringField({ required: true, blank: false }),
          level: new NumberField({ required: true, integer: true, min: 1 }),
        }),
        { required: true, initial: () => [] },
      ),
      /** SP18 Plan D: the weapon tight groups bought on this style ({ id: group id, level bought at }); one slot each. */
      knownWeaponGroups: new ArrayField(
        new SchemaField({
          id: new StringField({ required: true, blank: false }),
          level: new NumberField({ required: true, integer: true, min: 1 }),
        }),
        { required: true, initial: () => [] },
      ),
    };
  }
}
