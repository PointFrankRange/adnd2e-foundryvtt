import { powerProgression, psionicStrength, type PowerProgressionRow } from "../../../core/psionics";

export interface DerivedPsionics {
  max: number;
  level: number;
  row: PowerProgressionRow;
}

/** SP15: the psionic block for an actor with a psionicist class entry (null otherwise). */
export function derivePsionics(input: {
  classes: readonly { chassisId: string; level: number }[];
  scores: { wis: number; int: number; con: number };
}): DerivedPsionics | null {
  const entry = input.classes.find((c) => c.chassisId === "psionicist");
  if (!entry) return null;
  const { wis, int, con } = input.scores;
  return { max: psionicStrength(wis, int, con, entry.level), level: entry.level, row: powerProgression(entry.level) };
}
