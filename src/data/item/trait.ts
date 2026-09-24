import { Adnd2eItemModel } from "./base-item";
import {
  ABILITY_KEYS, TRAIT_ATTACK_MODES, TRAIT_EFFECT_KINDS, TRAIT_PROFICIENCY_TRACKS, TRAIT_SAVE_CATEGORIES,
} from "./choices";

const { StringField, NumberField, SchemaField } = foundry.data.fields;

/** A blank-able choice string: real v14.364 `StringField#_validateSpecial` accepts "" before it consults `choices` (common/data/fields.mjs:1707-1723). */
const choice = (choices: readonly string[]) =>
  new StringField({ required: true, blank: true, initial: "", choices });

/**
 * SP8 Plan 8c: a purchasable (cost > 0) or refunding (cost < 0) character trait
 * whose effect is one entry of the closed typed set. The members of `effect`
 * that a `kind` does not use stay "" — the pure `toTraitEffect` picks the ones
 * it needs and treats anything malformed as inert.
 */
export class TraitItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      traitId: new StringField({ required: true, blank: true, initial: "" }),
      cost: new NumberField({ required: true, integer: true, initial: 0 }),
      effect: new SchemaField({
        kind: choice(TRAIT_EFFECT_KINDS),
        ability: choice(ABILITY_KEYS),
        save: choice(TRAIT_SAVE_CATEGORIES),
        mode: choice(TRAIT_ATTACK_MODES),
        track: choice(TRAIT_PROFICIENCY_TRACKS),
        amount: new NumberField({ required: true, integer: true, initial: 0 }),
      }),
    };
  }
}
