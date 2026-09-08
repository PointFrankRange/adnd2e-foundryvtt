import { CASTER_CLASSES, SAVING_THROW_KINDS, SPELL_SCHOOLS, SPHERE_NAMES } from "./choices";
import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;

export class SpellItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      casterClass: new StringField({ required: true, blank: false, initial: "wizard", choices: CASTER_CLASSES }),
      level: new NumberField({ required: true, integer: true, min: 1, max: 9, initial: 1 }),
      schools: new ArrayField(new StringField({ required: true, blank: false, choices: SPELL_SCHOOLS }), { required: true, initial: [] }),
      spheres: new ArrayField(new StringField({ required: true, blank: false, choices: SPHERE_NAMES }), { required: true, initial: [] }),
      range: new StringField({ required: true, blank: true, initial: "" }),
      components: new SchemaField({
        v: new BooleanField({ required: true, initial: false }),
        s: new BooleanField({ required: true, initial: false }),
        m: new BooleanField({ required: true, initial: false }),
      }),
      materialComponent: new StringField({ required: true, blank: true, initial: "" }),
      duration: new StringField({ required: true, blank: true, initial: "" }),
      castingTime: new StringField({ required: true, blank: true, initial: "" }),
      areaOfEffect: new StringField({ required: true, blank: true, initial: "" }),
      savingThrow: new StringField({ required: true, blank: false, initial: "none", choices: SAVING_THROW_KINDS }),
      reversible: new BooleanField({ required: true, initial: false }),
      isReversedForm: new BooleanField({ required: true, initial: false }),
      automation: new SchemaField({
        damage: new StringField({ required: true, nullable: true, initial: null }),
        healing: new StringField({ required: true, nullable: true, initial: null }),
        effectRefs: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
        targetType: new StringField({ required: true, blank: true, initial: "" }),
      }),
    };
  }
}
