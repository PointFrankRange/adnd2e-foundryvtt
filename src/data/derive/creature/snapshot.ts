// The plain-data view of a creature the engine derives from. snapshotCreature
// (src/data/actor/creature.ts) builds this from the Foundry Actor; deriveCreature
// consumes only this.
import type { SaveCategory } from "../../../core/types";

export interface CreatureSnapshot {
  hd: { count: number; dieType: number; bonus: number; fixedHp: number | null };
  /** attributes.thac0.asFighterLevel — null unless the monster fights on the warrior table */
  thac0AsFighterLevel: number | null;
  /** attributes.thac0.value — the fallback when asFighterLevel is null */
  authoredThac0: number;
  saveMode: "explicit" | "asClass";
  explicitSaves: Record<SaveCategory, number>;
  /**
   * used only when saveMode === "asClass"; group "" means "not configured".
   * Typed `string` (not `ClassGroup`) because the value can reach here
   * unvalidated (imported JSON, an old actor); deriveCreature guards it.
   */
  asClassSave: { group: string; level: number };
}

export interface CreatureDerived {
  hpMax: number;
  thac0: number;
  /** the five effective saving-throw targets → system.saves.effective.* */
  saves: Record<SaveCategory, number>;
}
