// The `adnd2e` ActiveEffect sub-type (spec §5.5). Its schema defines the core
// `changes` ArrayField itself (v14 requires every AE TypeDataModel to do so,
// preserving `type` / `phase` / `priority` — see `Game##verifyActiveEffectModels`
// in `client/game.mjs`), then adds the metadata the magic-item / spell-effect /
// condition systems key on, plus the native `isSuppressed` hook for
// suppressWhenUnequipped.
//
// The class extends bare `TypeDataModel` rather than `ActiveEffectTypeDataModel`:
// fvtt-types (v13-beta) does not model the latter, and putting a `typeof`-based
// runtime value in the `extends` clause makes `ActiveEffect.Implementation`
// (which resolves through `CONFIG.ActiveEffect.dataModels` back to this class)
// circular. Ruling S2. We do NOT reach for `foundry.data.ActiveEffectTypeDataModel`
// at `defineSchema()` time: it is not reliably present on the `foundry.data`
// namespace when `Localization` first reads `.schema` during `Game.initialize`
// (`Cannot read properties of undefined (reading 'defineSchema')`), so the
// `changes` fields are spelled out here instead — a faithful copy of
// `common/data/active-effect.mjs`.
import { SPELL_SCHOOLS } from "../item/choices";

const { StringField, BooleanField, NumberField, SchemaField, ArrayField } = foundry.data.fields;
const AnyField = (foundry.data.fields as unknown as { AnyField: typeof StringField }).AnyField;

/** Validate an `EffectChangeData#type` string — mirrors the private
 *  `ActiveEffectTypeDataModel.#validateType` (`common/data/active-effect.mjs`):
 *  either dot-delimited alphanumeric substrings, or `custom.{number}`. */
function validateChangeType(type: string): true {
  if (type.length < 3) throw new Error("must be at least three characters long");
  if (!/^custom\.-?\d+$/.test(type) && !type.split(".").every((s) => /^[a-z0-9]+$/i.test(s))) {
    throw new Error(
      'A change type must either be a sequence of dot-delimited, alpha-numeric substrings or of the form "custom.{number}"',
    );
  }
  return true;
}

/** The core ActiveEffect `changes` ArrayField, defined locally (Ruling S2). */
function changesField(): InstanceType<typeof ArrayField> {
  return new ArrayField(
    new SchemaField({
      key: new StringField({ required: true }),
      type: new StringField({
        required: true,
        blank: false,
        initial: "add",
        validate: validateChangeType,
      }),
      value: new AnyField({ required: true, nullable: true, serializable: true, initial: "" }),
      phase: new StringField({ required: true, blank: false, initial: "initial" }),
      priority: new NumberField(),
    }),
  );
}

export class Adnd2eActiveEffectModel extends foundry.abstract.TypeDataModel<
  foundry.data.fields.DataSchema,
  ActiveEffect.Implementation
> {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      changes: changesField(),
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
