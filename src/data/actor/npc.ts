import { deriveCharacter } from "../derive/character";
import { getOptionalRules } from "../../settings";
import { DISPOSITIONS } from "../item/choices";
import { actorCommonSchema, Adnd2eActorModel } from "./base-actor";
import { snapshotActor } from "./snapshot";

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

  override prepareDerivedData(): void {
    const derived = deriveCharacter(snapshotActor(this.parent), getOptionalRules());
    const abil = this as unknown as {
      abilities: Record<string, { score: number; mods?: unknown }>;
    };
    for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      abil.abilities[k].mods = derived.abilities[k];
    }
  }
}
