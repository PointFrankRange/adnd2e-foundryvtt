// Sub-project 14 — spell points. Wizard spell points (Player's Option:
// Spells & Magic Table 17, Plan A) and priest spell points (Tables 26-29,
// remainder). Only wizard- and priest-progression casters get a result;
// spell-point-less chassis get none. Table 17's own max-spell-level is
// intersected with the Intelligence-based cap, exactly as classic
// `wizardSpellSlots` already does for the level 21+ formula.
import { getChassis } from "../../../core/classes/chassis";
import {
  spellPointsSpent, wizardMaxPerLevel, wizardMaxSpellLevel, wizardSpellPointTotal,
} from "../../../core/magic/spell-points";
import {
  priestMaxPerLevel, priestMaxSpellLevel, priestSpellPointTotal, priestTheurgyCost,
  type TheurgyScope,
} from "../../../core/magic/priest-spell-points";
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
  /** priest class level for the priest branch */
  priestLevel: number;
  wisScore: number;
  conHpAdjustment: number;
  priestMemorized: readonly MemorizedEntry[];
}

export function deriveSpellPoints(input: SpellPointsInput): { wizard?: SpellPointsRecord; priest?: SpellPointsRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType === "priest" && chassis.spellProgressionId === "priest") {
    const sp = priestSpellPointTotal(input.priestLevel, input.wisScore, input.conHpAdjustment);
    // Ruling 3: a legacy entry with no magickType is fixed, and with no theurgyScope is major.
    const spent = input.priestMemorized.reduce(
      (sum, m) => sum + priestTheurgyCost(m.spellLevel, m.magickType ?? "fixed", (m.theurgyScope ?? "major") as TheurgyScope),
      0,
    );
    return {
      priest: {
        maxSpellLevel: priestMaxSpellLevel(input.priestLevel),
        maxPerLevel: priestMaxPerLevel(input.priestLevel),
        sp, spent, remaining: sp - spent,
      },
    };
  }
  if (chassis.casterType !== "wizard" || chassis.spellProgressionId !== "wizard") return {};
  const maxSpellLevel = Math.min(wizardMaxSpellLevel(input.level), input.maxSpellLevelKnown ?? 1);
  const maxPerLevel = wizardMaxPerLevel(input.level, input.specialist);
  const sp = wizardSpellPointTotal(input.level, input.intScore, input.specialist);
  const spent = spellPointsSpent(input.wizardMemorized);
  return { wizard: { maxSpellLevel, maxPerLevel, sp, spent, remaining: sp - spent } };
}
