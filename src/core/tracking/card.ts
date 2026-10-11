// Chat-card context for a ranger tracking check (SP20). Pure.
import { canTrack, identificationInfo, movementLimit, resolveCheck, type ModifierRow } from "./rules";

export interface TrackingCardInput {
  actorName: string;
  actorImg: string;
  level: number;
  score: number;
  halved: boolean;
  breakdown: ModifierRow[];
  /** the tracking d20; null when tracking was impossible (no roll made) */
  roll: number | null;
  /** the identification d20; null when it was not attempted */
  identifyRoll: number | null;
}

export interface TrackingCardContext {
  actorName: string;
  actorImg: string;
  headlineKey: string;
  score: number;
  halved: boolean;
  breakdown: ModifierRow[];
  possible: boolean;
  roll: number | null;
  success: boolean;
  resultKey: string;
  movementKey: string;
  identification: null | { roll: number; success: boolean; resultKey: string; infoKeys: string[] };
}

export function buildTrackingCardContext(input: TrackingCardInput): TrackingCardContext {
  const possible = canTrack(input.score);
  const success = possible && input.roll !== null && resolveCheck(input.roll, input.score);
  const limit = possible ? movementLimit(input.score) : null;
  let identification: TrackingCardContext["identification"] = null;
  if (input.identifyRoll !== null) {
    const identified = resolveCheck(input.identifyRoll, input.score);
    identification = {
      roll: input.identifyRoll,
      success: identified,
      resultKey: identified ? "ADND2E.chat.tracking.identified" : "ADND2E.chat.tracking.notIdentified",
      infoKeys: identified ? identificationInfo(input.level).map((id) => `ADND2E.tracking.info.${id}`) : [],
    };
  }
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    headlineKey: "ADND2E.chat.tracking.title",
    score: input.score,
    halved: input.halved,
    breakdown: input.breakdown,
    possible,
    roll: input.roll,
    success,
    resultKey: !possible ? "ADND2E.chat.tracking.notPossible" : success ? "ADND2E.chat.tracking.found" : "ADND2E.chat.tracking.lost",
    movementKey: limit ? `ADND2E.tracking.movement.${limit}` : "",
    identification,
  };
}
