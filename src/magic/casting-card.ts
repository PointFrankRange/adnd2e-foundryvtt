import type { CastingNoticeContext, CastingNoticeInput } from "./card-types";

/** The "begins casting" / "spell lost" chat card's display data. */
export function buildCastingNoticeContext(input: CastingNoticeInput): CastingNoticeContext {
  const identity = {
    actorName: input.actorName,
    actorImg: input.actorImg,
    spellName: input.spellName,
    spellLevel: input.spellLevel,
  };
  if (input.kind === "lost") {
    return { ...identity, headlineKey: "ADND2E.chat.casting.lost", detailKey: null, detailValue: null, lost: true };
  }
  let detailKey: string | null = null;
  let detailValue: number | null = null;
  if (input.completeRound !== null) {
    detailKey = "ADND2E.chat.casting.completesRound";
    detailValue = input.completeRound;
  } else if (input.initiativeAdd !== null && input.initiativeAdd > 0) {
    detailKey = "ADND2E.chat.casting.initiativeAdded";
    detailValue = input.initiativeAdd;
  }
  return { ...identity, headlineKey: "ADND2E.chat.casting.begin", detailKey, detailValue, lost: false };
}
