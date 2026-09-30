// Sub-project 14 Plan A — wizard spell points (Player's Option: Spells & Magic
// Table 17). Only wizard-progression casters get a result; priest spell
// points are out of scope (spec §7). Table 17's own max-spell-level is
// intersected with the Intelligence-based cap, exactly as classic
// `wizardSpellSlots` already does for the level 21+ formula.
import { getChassis } from "../../../core/classes/chassis";
import {
  spellPointsSpent, wizardMaxPerLevel, wizardMaxSpellLevel, wizardSpellPointTotal,
} from "../../../core/magic/spell-points";
import type { ClassId } from "../../../core/types";
import type { MemorizedEntry } from "./snapshot";

export interface SpellPointsRecord {
  maxSpellLevel: number;
  maxPerLevel: number;
  sp: number;
  spent: number;
  remaining: number;
}

export interface SpellPointsInput {
  chassisId: ClassId;
  level: number;
  intScore: number;
  /** intelligence(int).maxSpellLevel — null for a non-wizard; intersected with Table 17's own cap */
  maxSpellLevelKnown: number | null;
  specialist: boolean;
  wizardMemorized: readonly MemorizedEntry[];
}

export function deriveSpellPoints(input: SpellPointsInput): { wizard?: SpellPointsRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType !== "wizard" || chassis.spellProgressionId !== "wizard") return {};
  const maxSpellLevel = Math.min(wizardMaxSpellLevel(input.level), input.maxSpellLevelKnown ?? 1);
  const maxPerLevel = wizardMaxPerLevel(input.level, input.specialist);
  const sp = wizardSpellPointTotal(input.level, input.intScore, input.specialist);
  const spent = spellPointsSpent(input.wizardMemorized);
  return { wizard: { maxSpellLevel, maxPerLevel, sp, spent, remaining: sp - spent } };
}
