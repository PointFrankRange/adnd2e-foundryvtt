import { abilityRangeProblems, effectiveAbilityAdjustments, effectiveAbilityRanges, normalizeSubrace, type RawSubrace } from "../../core/races";
import { applyRacialDeltas } from "../../core/abilities/racial-adjustments";
import { ABILITY_KEYS } from "../../data/item/choices";
import type { AbilityKey, AbilityScores, Race } from "../../core/types";

/** Warns (never blocks) when a newly dropped subrace's own ability ranges don't fit the actor's adjusted scores
 *  (SP12 Plan A). Shared by the PC and Character NPC sheets' race drops (#115a). Plain PHB races carry no ranges and stay silent. */
export function warnSubraceRange(
  actor: { system: { abilities: Record<AbilityKey, { score: number }> } },
  dropped: { type: string; system: unknown },
  isNewDrop: boolean,
): void {
  if (dropped.type !== "race" || !isNewDrop) return;
  const layer = normalizeSubrace((dropped.system as { subrace?: RawSubrace }).subrace);
  if (!layer.abilityRanges) return;
  const raceId = ((dropped.system as { raceId?: Race }).raceId ?? "human") as Race;
  const raw = Object.fromEntries(ABILITY_KEYS.map((k) => [k, actor.system.abilities[k].score])) as unknown as AbilityScores;
  const adjusted = applyRacialDeltas(raw, raceId, effectiveAbilityAdjustments(raceId, layer));
  // Approximation: this uses the prepared ability scores, which may already include trait/effect modifiers. It only warns, never blocks.
  const problems = abilityRangeProblems(adjusted, effectiveAbilityRanges(raceId, layer));
  if (problems.length === 0) return;
  const labels = (CONFIG as unknown as { ADND2E: { abilities: Record<string, string> } }).ADND2E.abilities;
  ui.notifications?.warn(
    game.i18n!.format("ADND2E.sheet.drop.subraceRangeWarning", {
      abilities: problems.map((k) => game.i18n!.localize(labels[k]!)).join(", "),
    }),
  );
}
