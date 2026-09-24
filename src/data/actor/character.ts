import {
  actorCommonSchema, Adnd2eActorModel, applyRacialAdjustment, applySubAbilityScores, applyTraitAbilityBonuses, deriveAndCache,
} from "./base-actor";

export class CharacterModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { ...actorCommonSchema() };
  }

  override prepareBaseData(): void {
    applySubAbilityScores(this);
    applyRacialAdjustment(this);
    applyTraitAbilityBonuses(this);
  }

  override prepareDerivedData(): void {
    deriveAndCache(this);
  }
}
