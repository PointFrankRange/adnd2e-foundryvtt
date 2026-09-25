// PHB optional casting-time and spell-disruption rules (Sub-project 9 Plan 9a):
// a bare-number casting time adds to the caster's initiative; a spell of a
// round or more takes effect at the end of its last round (PHB p.87, p.95,
// Table 56); a caster who is hit or fails a save before the spell takes effect
// loses it, and gains no Dexterity AC bonus while casting (PHB p.86). Pure.
import type { OptionalRules } from "../options";

/**
 * THE one place the casting-time gate is written (master AND-gate). Every
 * consumer — derive, the sheet, the cast routing, the GM hooks, the combatant
 * initiative formula — calls this; never restate the expression.
 */
export function expandedCastingTimeEnabled(
  rules: Pick<OptionalRules, "spellsAndMagicEnabled" | "expandedCastingTime">,
): boolean {
  return rules.spellsAndMagicEnabled && rules.expandedCastingTime;
}

export type CastingTime =
  | { kind: "segments"; value: number }
  | { kind: "rounds"; value: number }
  | { kind: "unknown" };

const ROUNDS_PER_TURN = 10;

/** Reads a spell item's free-text `castingTime`. Anything it does not recognise is "unknown" (cast immediately). */
export function parseCastingTime(text: string): CastingTime {
  const t = text.trim().toLowerCase();
  if (/^\d+$/.test(t)) return { kind: "segments", value: Number(t) };
  const rounds = /^(\d+)\s*rounds?$/.exec(t);
  if (rounds && Number(rounds[1]) >= 1) return { kind: "rounds", value: Number(rounds[1]) };
  const turns = /^(\d+)\s*turns?$/.exec(t);
  if (turns && Number(turns[1]) >= 1) return { kind: "rounds", value: Number(turns[1]) * ROUNDS_PER_TURN };
  return { kind: "unknown" };
}

export type CastingPlan =
  | { mode: "immediate" }
  | { mode: "segments"; initiativeAdd: number }
  | { mode: "rounds"; completeRound: number };

/** How a cast begun in `currentRound` resolves. The start round counts as the first round of casting. */
export function castingPlan(ct: CastingTime, currentRound: number): CastingPlan {
  switch (ct.kind) {
    case "segments":
      return { mode: "segments", initiativeAdd: ct.value };
    case "rounds":
      return { mode: "rounds", completeRound: currentRound + ct.value - 1 };
    default:
      return { mode: "immediate" };
  }
}

/** The in-progress cast stored on the actor at `system.options.spellsAndMagic.casting`. */
export interface CastingState {
  spellItemId: string;
  casterKey: "wizard" | "priest";
  combatId: string;
  startRound: number;
  /** round spells: the round at whose end the spell takes effect; null for segment spells */
  completeRound: number | null;
  /** segment spells: the initiative addition; null for round spells */
  segments: number | null;
  /** hit points when the cast began (raised by healing); a drop below this disrupts */
  hp: number;
}

/** Whether the caster may complete the cast now. */
export function canCompleteCasting(
  state: Pick<CastingState, "startRound" | "completeRound">,
  now: { combatRound: number; isCasterTurn: boolean },
): boolean {
  if (state.completeRound !== null) return now.combatRound >= state.completeRound;
  return now.combatRound > state.startRound || (now.combatRound === state.startRound && now.isCasterTurn);
}

/** A cast is disrupted when hit points fall below the recorded value (PHB p.86: struck before the spell is cast). */
export function hpChangeDisrupts(recordedHp: number, newHp: number): boolean {
  return newHp < recordedHp;
}

/**
 * The Dexterity defensive adjustment used for AC (AC-signed: negative = better).
 * While casting, a beneficial adjustment is dropped (PHB p.86); a penalty stays.
 */
export function acDexAdjWhileCasting(dexDefensiveAdj: number, casting: boolean): number {
  return casting ? Math.max(0, dexDefensiveAdj) : dexDefensiveAdj;
}
