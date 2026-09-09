// The `adnd2e` ActiveEffect sub-type (spec §5.5). Its schema spreads the core
// ActiveEffectTypeDataModel schema so the `changes` array (with its `phase` field
// on v14, and the core `type` validator) is preserved; adds the metadata the
// magic-item / spell-effect / condition systems key on, plus the native
// `isSuppressed` hook for suppressWhenUnequipped.
//
// The class extends bare `TypeDataModel` rather than `ActiveEffectTypeDataModel`:
// fvtt-types (v13-beta) does not model the latter, and putting a `typeof`-based
// runtime value in the `extends` clause makes `ActiveEffect.Implementation`
// (which resolves through `CONFIG.ActiveEffect.dataModels` back to this class)
// circular. `ActiveEffectTypeDataModel` adds no instance behaviour — only
// `defineSchema()` — so spreading that schema is runtime-equivalent. Ruling S2.
import { SPELL_SCHOOLS } from "../item/choices";

const { StringField, BooleanField } = foundry.data.fields;

/** Runtime handle on the core ActiveEffect type model's schema (the `changes`
 *  ArrayField, with `phase`). Not surfaced by fvtt-types. Ruling S2. */
function coreActiveEffectSchema(): foundry.data.fields.DataSchema {
  return (
    foundry.data as unknown as {
      ActiveEffectTypeDataModel: { defineSchema(): foundry.data.fields.DataSchema };
    }
  ).ActiveEffectTypeDataModel.defineSchema();
}

export class Adnd2eActiveEffectModel extends foundry.abstract.TypeDataModel<
  foundry.data.fields.DataSchema,
  ActiveEffect.Implementation
> {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...coreActiveEffectSchema(),
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

  /**
   * Native suppression hook (consulted by `ActiveEffect#isSuppressed`). Returns
   * `true` only when this is an effect on an unequipped weapon/armor/equipment
   * item AND `suppressWhenUnequipped` is set; otherwise `undefined` so Foundry
   * falls through to `duration.expired`.
   */
  get isSuppressed(): true | undefined {
    const owner = (this as unknown as { parent?: { parent?: unknown } }).parent?.parent;
    const suppress =
      (this as unknown as { suppressWhenUnequipped: boolean }).suppressWhenUnequipped &&
      owner instanceof Item &&
      ["weapon", "armor", "equipment"].includes(owner.type) &&
      !(owner.system as { equipped?: boolean }).equipped;
    return suppress || undefined;
  }
}
