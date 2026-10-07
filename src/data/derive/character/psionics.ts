import { powerProgression, psionicStrength, type PowerProgressionRow } from "../../../core/psionics";
import { wildPsp } from "../../../core/psionics/wild";

export interface DerivedPsionics {
  max: number;
  level: number;
  row: PowerProgressionRow;
  /** SP15 Plan D: true when this is a wild talent's pool rather than a psionicist's */
  wild: boolean;
}

/** SP15: the psionic block for an actor with a psionicist class entry; SP15 Plan D: or, for a non-psionicist with a found wild talent, the wild-talent block (null otherwise). */
export function derivePsionics(input: {
  classes: readonly { chassisId: string; level: number }[];
  scores: { wis: number; int: number; con: number };
  wild?: { found: boolean; levelAtDiscovery: number; powers: readonly { initialCost: number; maintenanceCost: number }[] };
}): DerivedPsionics | null {
  const entry = input.classes.find((c) => c.chassisId === "psionicist");
  if (entry) {
    const { wis, int, con } = input.scores;
    return { max: psionicStrength(wis, int, con, entry.level), level: entry.level, row: powerProgression(entry.level), wild: false };
  }
  if (!input.wild?.found || input.classes.length === 0) return null;
  const level = Math.max(...input.classes.map((c) => c.level));
  return { max: wildPsp(input.wild.powers, Math.max(0, level - input.wild.levelAtDiscovery)), level, row: powerProgression(level), wild: true };
}
