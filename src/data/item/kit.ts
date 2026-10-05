import { Adnd2eItemModel } from "./base-item";
import {
  ABILITY_KEYS, ALIGNMENTS, CLASS_IDS, KIT_EQUIPMENT_MODES, RACE_IDS, TRAIT_ATTACK_MODES, TRAIT_EFFECT_KINDS,
  TRAIT_PROFICIENCY_TRACKS, TRAIT_SAVE_CATEGORIES,
} from "./choices";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

/** A blank-able choice string (same reasoning as the trait model's `choice`). */
const choice = (choices: readonly string[]) =>
  new StringField({ required: true, blank: true, initial: "", choices });

const names = () => new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] });

const equipmentOverride = () =>
  new SchemaField({
    mode: new StringField({ required: true, blank: false, initial: "inherit", choices: KIT_EQUIPMENT_MODES }),
    names: names(),
  });

/**
 * SP11 Plan A: a character kit. Modifies the class with the same chassis.
 * `effects` uses the trait effect shape (`toTraitEffect` interprets it; a
 * malformed effect is inert). Equipment overrides: `inherit` keeps the class
 * rule, `replace` swaps it, `extend` adds to it; armor names are armor type
 * names ("studded leather", "shield"), weapon names are weapon names plus the
 * token "blunt".
 */
export class KitItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      chassisId: new StringField({ required: true, blank: false, initial: "fighter", choices: CLASS_IDS }),
      qualifications: new SchemaField({
        abilityMinimums: new SchemaField(
          Object.fromEntries(
            ABILITY_KEYS.map((k) => [k, new NumberField({ required: true, integer: true, min: 0, max: 25, initial: 0 })]),
          ),
        ),
        races: new ArrayField(new StringField({ required: true, blank: false, choices: RACE_IDS }), { required: true, initial: [] }),
        alignments: new ArrayField(new StringField({ required: true, blank: false, choices: ALIGNMENTS }), { required: true, initial: [] }),
      }),
      xpModifierPercent: new NumberField({ required: true, integer: true, min: -90, initial: 0 }),
      effects: new ArrayField(
        new SchemaField({
          kind: choice(TRAIT_EFFECT_KINDS),
          ability: choice(ABILITY_KEYS),
          save: choice(TRAIT_SAVE_CATEGORIES),
          mode: choice(TRAIT_ATTACK_MODES),
          track: choice(TRAIT_PROFICIENCY_TRACKS),
          amount: new NumberField({ required: true, integer: true, initial: 0 }),
        }),
        { required: true, initial: [] },
      ),
      equipment: new SchemaField({ armor: equipmentOverride(), weapons: equipmentOverride() }),
      forbiddenWeaponProficiencies: names(),
      grantedFeatures: names(),
    };
  }
}
