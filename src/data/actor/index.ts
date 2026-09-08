import type { ActorSubtype } from "./subtypes";
import { CharacterModel } from "./character";
import { NpcModel } from "./npc";
import { CreatureModel } from "./creature";

export { CharacterModel, NpcModel, CreatureModel };

export const ACTOR_DATA_MODELS: Record<
  ActorSubtype,
  typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, Actor.Implementation>
> = {
  character: CharacterModel,
  npc: NpcModel,
  creature: CreatureModel,
};
