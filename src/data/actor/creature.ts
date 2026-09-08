import { htmlField } from "../common/fields";
import { ALIGNMENTS, ATTACK_TYPES, CREATURE_SIZES, MOVEMENT_MODES, SAVE_MODES } from "../item/choices";
import { Adnd2eActorModel } from "./base-actor";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

export class CreatureModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      hd: new SchemaField({
        count: new NumberField({ required: true, min: 0, initial: 1 }),
        dieType: new NumberField({ required: true, integer: true, initial: 8 }),
        bonus: new NumberField({ required: true, integer: true, initial: 0 }),
        fixedHp: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
      }),
      attributes: new SchemaField({
        hp: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        }),
        ac: new SchemaField({ value: new NumberField({ required: true, integer: true, initial: 10 }) }),
        thac0: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 20 }),
          asFighterLevel: new NumberField({ required: true, nullable: true, integer: true, min: 1, initial: null }),
        }),
        movement: new SchemaField(
          Object.fromEntries(MOVEMENT_MODES.map((m) => [m, new NumberField({ required: true, integer: true, min: 0, initial: m === "land" ? 12 : 0 })])),
        ),
        flyManeuverability: new StringField({ required: true, blank: true, initial: "" }),
      }),
      attacks: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true, blank: true, initial: "" }),
          count: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
          damage: new StringField({ required: true, blank: true, initial: "" }),
          thac0Override: new NumberField({ required: true, nullable: true, integer: true, initial: null }),
          type: new StringField({ required: true, blank: false, initial: "melee", choices: ATTACK_TYPES }),
          special: new StringField({ required: true, blank: true, initial: "" }),
        }),
        { required: true, initial: [] },
      ),
      saves: new SchemaField({
        mode: new StringField({ required: true, blank: false, initial: "explicit", choices: SAVE_MODES }),
        explicit: new SchemaField({
          ppd: new NumberField({ required: true, integer: true, initial: 20 }),
          rsw: new NumberField({ required: true, integer: true, initial: 20 }),
          pp: new NumberField({ required: true, integer: true, initial: 20 }),
          bw: new NumberField({ required: true, integer: true, initial: 20 }),
          spell: new NumberField({ required: true, integer: true, initial: 20 }),
        }),
        asClass: new SchemaField({
          group: new StringField({ required: true, blank: true, initial: "" }),
          level: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
        }),
      }),
      details: new SchemaField({
        size: new StringField({ required: true, blank: false, initial: "medium", choices: CREATURE_SIZES }),
        alignment: new StringField({ required: true, blank: false, initial: "true-neutral", choices: ALIGNMENTS }),
        intelligence: new StringField({ required: true, blank: true, initial: "" }),
        morale: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        magicResistance: new NumberField({ required: true, integer: true, min: 0, max: 100, initial: 0 }),
        treasureType: new StringField({ required: true, blank: true, initial: "" }),
        numberAppearing: new StringField({ required: true, blank: true, initial: "" }),
        xpValue: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
        specialAttacks: htmlField(),
        specialDefenses: htmlField(),
        description: htmlField(),
      }),
      biography: htmlField(),
    };
  }
  // NO prepareDerivedData — the creature derive path is Plan 1c.3d.
}
