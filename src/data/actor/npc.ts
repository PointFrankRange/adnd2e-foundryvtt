import { DISPOSITIONS } from "../item/choices";
import { actorCommonSchema, Adnd2eActorModel, applyRacialAdjustment, deriveAndCache } from "./base-actor";

const { StringField, NumberField, SchemaField } = foundry.data.fields;

export class NpcModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...actorCommonSchema(),
      npc: new SchemaField({
        morale: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        xpValue: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        disposition: new StringField({ required: true, blank: false, initial: "neutral", choices: DISPOSITIONS }),
      }),
    };
  }

  override prepareBaseData(): void {
    applyRacialAdjustment(this);
  }

  override prepareDerivedData(): void {
    deriveAndCache(this);
  }
}
