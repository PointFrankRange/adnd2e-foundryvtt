import { applyRacialDeltas } from "../../core/abilities";
import type { Race } from "../../core/types";
import { actorCommonSchema, Adnd2eActorModel, deriveAndCache } from "./base-actor";

export class CharacterModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { ...actorCommonSchema() };
  }

  override prepareBaseData(): void {
    const sys = this as unknown as {
      abilities: Record<string, { score: number }>;
      parent: { items: Iterable<{ type: string; system: { raceId?: Race } }> };
    };
    const raceItem = [...sys.parent.items].find((i) => i.type === "race");
    if (!raceItem) return;
    const raw = {
      str: sys.abilities.str.score, dex: sys.abilities.dex.score, con: sys.abilities.con.score,
      int: sys.abilities.int.score, wis: sys.abilities.wis.score, cha: sys.abilities.cha.score,
    };
    const adj = applyRacialDeltas(raw, raceItem.system.raceId as Race);
    for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) sys.abilities[k].score = adj[k];
  }

  override prepareDerivedData(): void {
    deriveAndCache(this);
  }
}
