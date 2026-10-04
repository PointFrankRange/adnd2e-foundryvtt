// Sub-project 14 Plan B — Channellers (Player's Option: Spells & Magic
// pp.80-82). Wizard-progression casters get a wizard result; priest-pool casters
// (clerics, druids) get a priest result (Sub-project 14 priest channelling). The caller gates this on
// channellersEnabled(rules) — this module takes no rules bag, mirroring
// deriveSpellPoints's own precedent (spell-points.ts, Plan A).
import { getChassis } from "../../../core/classes/chassis";
import { channellerMaxSp } from "../../../core/magic/channellers";
import { isPriestPoolProgression } from "../../../core/magic/class-slots";
import { priestSpellPointTotal } from "../../../core/magic/priest-spell-points";
import type { ClassId } from "../../../core/types";

export interface ChannellingRecord {
  max: number;
}

export interface ChannellingInput {
  chassisId: ClassId;
  level: number;
  specialist: boolean;
  conHpAdjustment: number;
  wisMagicalDefenseAdj: number;
  priestLevel: number;
  wisScore: number;
}

export function deriveChannelling(input: ChannellingInput): { wizard?: ChannellingRecord; priest?: ChannellingRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType === "wizard" && chassis.spellProgressionId === "wizard") {
    return {
      wizard: { max: channellerMaxSp(input.level, input.specialist, input.conHpAdjustment, input.wisMagicalDefenseAdj) },
    };
  }
  if (chassis.casterType === "priest" && isPriestPoolProgression(chassis.spellProgressionId)) {
    return {
      priest: { max: priestSpellPointTotal(input.priestLevel, input.wisScore, input.conHpAdjustment) },
    };
  }
  return {};
}
