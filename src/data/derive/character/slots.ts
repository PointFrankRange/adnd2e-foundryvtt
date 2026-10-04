import { getChassis } from "../../../core/classes/chassis";
import { paladinSpellSlots, rangerSpellSlots } from "../../../core/magic/class-slots";
import { priestSpellSlots } from "../../../core/magic/priest-slots";
import { wizardSpellSlots } from "../../../core/magic/wizard-slots";
import type { ClassId } from "../../../core/types";
import type { MemorizedEntry } from "./snapshot";

export type SlotRecord = Record<number, { max: number; used: number }>;

export interface SpellSlotInput {
  chassisId: ClassId;
  level: number;
  /** intelligence(int).maxSpellLevel — null for a non-wizard */
  maxSpellLevelKnown: number | null;
  wisdomScore: number;
  /** wisdom(wis).bonusPriestSpells (length 7) */
  wisdomBonusSpells: readonly number[];
  specialist: boolean;
  wizardMemorized: readonly MemorizedEntry[];
  priestMemorized: readonly MemorizedEntry[];
}

function toRecord(perLevel: readonly number[], memorized: readonly MemorizedEntry[]): SlotRecord {
  const out: SlotRecord = {};
  perLevel.forEach((max, i) => {
    const spellLevel = i + 1;
    out[spellLevel] = { max, used: memorized.filter((m) => m.spellLevel === spellLevel).length };
  });
  return out;
}

/**
 * §5.6 step 8 — spell slots for the two full-caster progressions (Ruling CASTER1).
 * Wizard: `casterType === "wizard"` AND `spellProgressionId === "wizard"`.
 * Priest: `casterType === "priest"` AND `spellProgressionId === "priest"` (i.e.
 * Cleric / Druid). Paladin / Ranger (Table 17 / 18) take the same `priest` record,
 * with no Wisdom bonus. Bard returns `{}`.
 */
export function deriveSpellSlots(input: SpellSlotInput): { wizard?: SlotRecord; priest?: SlotRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType === "wizard" && chassis.spellProgressionId === "wizard") {
    const slots = wizardSpellSlots({
      wizardLevel: input.level,
      maxSpellLevelKnown: input.maxSpellLevelKnown ?? 1,
      specialist: input.specialist,
    });
    return { wizard: toRecord(slots.perLevel, input.wizardMemorized) };
  }
  if (chassis.casterType === "priest" && chassis.spellProgressionId === "priest") {
    const slots = priestSpellSlots({
      priestLevel: input.level,
      wisdomScore: input.wisdomScore,
      wisdomBonusSpells: input.wisdomBonusSpells,
    });
    return { priest: toRecord(slots.perLevel, input.priestMemorized) };
  }
  if (chassis.casterType === "priest" && chassis.spellProgressionId === "paladin") {
    return { priest: toRecord(paladinSpellSlots(input.level), input.priestMemorized) };
  }
  if (chassis.casterType === "priest" && chassis.spellProgressionId === "ranger") {
    return { priest: toRecord(rangerSpellSlots(input.level), input.priestMemorized) };
  }
  return {};
}
