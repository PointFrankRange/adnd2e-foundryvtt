import { deriveCharacter } from "../derive/character";
import { getOptionalRules } from "../../settings";
import { ABILITY_KEYS } from "../item/choices";
import { actorCommonSchema, Adnd2eActorModel } from "./base-actor";
import { snapshotActor } from "./snapshot";

export class CharacterModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { ...actorCommonSchema() };
  }

  override prepareDerivedData(): void {
    const derived = deriveCharacter(snapshotActor(this.parent), getOptionalRules());
    const abil = this as unknown as {
      abilities: Record<string, { score: number; mods?: unknown }>;
    };
    for (const k of ABILITY_KEYS) {
      abil.abilities[k as keyof typeof abil.abilities].mods = derived.abilities[k];
    }
  }
}
