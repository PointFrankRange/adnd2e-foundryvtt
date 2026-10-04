import type { TurnCardContext, TurnCardInput } from "./card-types";

/** Flatten a resolved turning attempt into the chat card's display data. */
export function buildTurnCardContext(input: TurnCardInput): TurnCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    formula: "1d20",
    naturalD20: input.naturalD20,
    level: input.level,
    cap: input.cap,
    bonusCap: input.bonusCap,
    rows: input.rows.map((r) => ({ ...r, statusLabel: `ADND2E.chat.turn.status.${r.status}` })),
  };
}
