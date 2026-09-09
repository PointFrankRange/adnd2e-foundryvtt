import { actorCommonSchema, Adnd2eActorModel, applyRacialAdjustment, deriveAndCache } from "./base-actor";

export class CharacterModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { ...actorCommonSchema() };
  }

  override prepareBaseData(): void {
    applyRacialAdjustment(this);
  }

  override prepareDerivedData(): void {
    deriveAndCache(this);
  }
}
