// Sub-project 14 Plan B — Channellers (Player's Option: Spells & Magic
// pp.80-82). Only wizard-progression casters get a result; priest channelling
// is out of scope (design spec §2). The caller gates this on
// channellersEnabled(rules) — this module takes no rules bag, mirroring
// deriveSpellPoints's own precedent (spell-points.ts, Plan A).
import { getChassis } from "../../../core/classes/chassis";
import { channellerMaxSp } from "../../../core/magic/channellers";
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
}

export function deriveChannelling(input: ChannellingInput): { wizard?: ChannellingRecord } {
  const chassis = getChassis(input.chassisId);
  if (chassis.casterType !== "wizard" || chassis.spellProgressionId !== "wizard") return {};
  return {
    wizard: { max: channellerMaxSp(input.level, input.specialist, input.conHpAdjustment, input.wisMagicalDefenseAdj) },
  };
}
