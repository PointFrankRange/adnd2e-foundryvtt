// The character derived-data pipeline (spec §5.6). Pure — takes a snapshot + the
// optional-rules bag, returns the object CharacterModel caches onto system.*.
// 1c.3a implements step 2 only; the numbered slots below are Plan 1c.3b/1c.3c.
import { deriveAbilities } from "../../../core/abilities";
import { getChassis } from "../../../core/classes/chassis";
import type { DerivedAbilities } from "../../../core/types";
import type { OptionalRules } from "../../../core/options";
import type { ActorSnapshot } from "./snapshot";

export interface CharacterDerived {
  abilities: DerivedAbilities;
}

export function deriveCharacter(snapshot: ActorSnapshot, options: OptionalRules): CharacterDerived {
  const isWarrior = snapshot.classes.some((c) => getChassis(c.chassisId).group === "warrior");

  // §5.6 step 1 — resolveMulticlass / resolveDualClass — Plan 1c.3c
  // §5.6 step 2 — ability modifiers
  // Scores are already racially adjusted (CharacterModel.prepareBaseData). Pass
  // race:"human" so deriveAbilities' own applyRacialDeltas is a no-op; halflings
  // never get exceptional Strength (PHB p.19), enforced here since we drop the
  // race hint the engine used for that check.
  const percentile = snapshot.race === "halfling" ? null : snapshot.exceptionalStrengthPercentile;
  const abilities = deriveAbilities(snapshot.abilities, {
    race: "human",
    isWarrior,
    options,
    exceptionalStrengthPercentile: percentile,
  });
  // §5.6 step 3 — levelForXp per class -> canLevelUp — Plan 1c.3b
  // §5.6 step 4 — HP max — Plan 1c.3b
  // §5.6 step 5 — THAC0 — Plan 1c.3b
  // §5.6 step 6 — AC — Plan 1c.3b
  // §5.6 step 7 — saves — Plan 1c.3b
  // §5.6 step 8 — spell slots — Plan 1c.3b
  // §5.6 step 9 — proficiency slots — Plan 1c.3b
  // §5.6 step 10 — encumbrance — Plan 1c.3b

  return { abilities };
}
