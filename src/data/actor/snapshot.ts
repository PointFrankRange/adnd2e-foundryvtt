// Thin Foundry adapter: builds the pure ActorSnapshot from a character/npc Actor.
// Not unit-tested (spec §9) — dev-world verified. All logic lives in deriveCharacter.
// Task 4 ships this minimal working version; Task 5 hardens it (race/class-walk
// edge cases, the Schema-cast fallback from Ruling S2).
import type { ActorSnapshot, ClassEntry, DualClassState } from "../derive/character";
import type { ClassId, Race, WizardSchool } from "../../core/types";

interface ClassItemSystem {
  chassisId: ClassId;
  specialistSchool: WizardSchool | null;
  xp: number;
  hpRolls: readonly number[];
  dualClassState: DualClassState | null;
}
interface RaceItemSystem {
  raceId: Race;
}

export function snapshotActor(actor: Actor.Implementation): ActorSnapshot {
  // Ruling S2 shim — named actor Schema types land in Plan 1c.3b; until then the
  // Foundry Actor's `system` is `UnknownSystem`. Task 5 hardens the walk below.
  const doc = actor as unknown as {
    system: { abilities: Record<string, { score: number; exceptional: number | null }> };
    items: Iterable<{ type: string; system: unknown }>;
  };
  const items = [...doc.items];
  const raceItem = items.find((i) => i.type === "race");
  const classes: ClassEntry[] = items
    .filter((i) => i.type === "class")
    .map((i) => {
      const s = i.system as ClassItemSystem;
      return {
        chassisId: s.chassisId,
        specialistSchool: s.specialistSchool,
        xp: s.xp,
        hpRolls: s.hpRolls,
        dualClassState: s.dualClassState,
      };
    });
  const a = doc.system.abilities;
  return {
    abilities: {
      str: a.str.score, dex: a.dex.score, con: a.con.score,
      int: a.int.score, wis: a.wis.score, cha: a.cha.score,
    },
    exceptionalStrengthPercentile: a.str.exceptional,
    race: raceItem ? (raceItem.system as RaceItemSystem).raceId : null,
    classes,
  };
}
