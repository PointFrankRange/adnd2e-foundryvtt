// The `adnd2e` ActiveEffect sub-type (spec §5.5). Carries the metadata the
// magic-item / spell-effect / condition systems key on; the two-pass base/derived
// split and suppressWhenUnequipped enforcement live on Adnd2eActor.
import { SPELL_SCHOOLS } from "../item/choices";

const { StringField, BooleanField } = foundry.data.fields;

export class Adnd2eActiveEffectModel extends foundry.abstract.TypeDataModel<
  foundry.data.fields.DataSchema,
  ActiveEffect.Implementation
> {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      conditionId: new StringField({ required: true, nullable: true, blank: false, initial: null }),
      isCondition: new BooleanField({ required: true, initial: false }),
      suppressWhenUnequipped: new BooleanField({ required: true, initial: false }),
      schoolTag: new StringField({
        required: true,
        nullable: true,
        blank: false,
        initial: null,
        choices: SPELL_SCHOOLS,
      }),
    };
  }
}
