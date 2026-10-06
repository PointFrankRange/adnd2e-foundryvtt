import { powerProgression } from "./psp";
import type { Discipline, PowerKind } from "./tables";

export interface KnownPower {
  id: string;
  /** the power's name, matched (case-insensitively) against other powers' prerequisites */
  name: string;
  discipline: Discipline;
  kind: PowerKind;
  /** points added by relearning (each spends one slot of its kind) */
  scoreBonus: number;
}

export type LearnProblem =
  | "discipline-access"
  | "science-limit"
  | "devotion-limit"
  | "defense-limit"
  | "devotion-ratio"
  | "primary-cap"
  | "no-budget"
  | "prerequisite"
  | "min-level";

export type LearnResult = { ok: true } | { ok: false; reason: LearnProblem };

const OK: LearnResult = { ok: true };
const no = (reason: LearnProblem): LearnResult => ({ ok: false, reason });

const countOf = (known: readonly KnownPower[], discipline: Discipline, kind: PowerKind): number =>
  known.filter((k) => k.discipline === discipline && k.kind === kind).length;

const slotsUsed = (known: readonly KnownPower[], kind: PowerKind): number =>
  known.filter((k) => k.kind === kind).reduce((n, k) => n + 1 + k.scoreBonus, 0);

/** The first science or devotion learned fixes the primary discipline; defense modes never do (p.12). */
export function primaryDiscipline(known: readonly KnownPower[]): Discipline | null {
  return known.find((k) => k.kind !== "defense")?.discipline ?? null;
}

/** Checks a power's own level and prerequisite requirements, the Table 4 totals and the two learning rules (p.12) for adding one power. A science is added only after the devotions for it exist. */
export function canLearn(
  known: readonly KnownPower[],
  candidate: { discipline: Discipline; kind: PowerKind; prerequisites?: readonly string[]; minLevel?: number },
  level: number,
): LearnResult {
  const row = powerProgression(level);
  const { discipline, kind } = candidate;
  if ((candidate.minLevel ?? 0) > level) return no("min-level");
  const knownNames = new Set(known.map((k) => k.name.trim().toLowerCase()));
  if ((candidate.prerequisites ?? []).some((p) => !knownNames.has(p.trim().toLowerCase()))) return no("prerequisite");
  if (kind === "defense") return slotsUsed(known, "defense") + 1 > row.defenseModes ? no("defense-limit") : OK;
  const heldDisciplines = new Set(known.filter((k) => k.kind !== "defense").map((k) => k.discipline));
  if (!heldDisciplines.has(discipline) && heldDisciplines.size + 1 > row.disciplines) return no("discipline-access");
  if (kind === "science" && slotsUsed(known, "science") + 1 > row.sciences) return no("science-limit");
  if (kind === "devotion" && slotsUsed(known, "devotion") + 1 > row.devotions) return no("devotion-limit");
  if (kind === "science" && countOf(known, discipline, "devotion") < 2 * (countOf(known, discipline, "science") + 1)) return no("devotion-ratio");
  const primary = primaryDiscipline(known);
  if (primary !== null && discipline !== primary && countOf(known, discipline, kind) + 1 >= countOf(known, primary, kind)) return no("primary-cap");
  return OK;
}

/** Relearning raises one known power's score by 1 and spends one slot of its kind from the Table 4 budget. */
export function canRelearn(known: readonly KnownPower[], id: string, level: number): LearnResult {
  const power = known.find((k) => k.id === id);
  if (!power || power.kind === "defense") return no("no-budget"); // only sciences and devotions can be relearned
  const row = powerProgression(level);
  const allowed = power.kind === "science" ? row.sciences : row.devotions;
  return slotsUsed(known, power.kind) + 1 > allowed ? no("no-budget") : OK;
}
