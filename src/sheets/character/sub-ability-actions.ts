import { subAbilitiesEnabled, subScoreSeedUpdate } from "../../core/abilities/sub-abilities";
import type { SubScoreSource } from "../../core/abilities/sub-abilities";
import type { AbilityKey } from "../../core/types";
import { getOptionalRules } from "../../settings";

/* ---------------------------------------------------------------------------
 * sub-ability-actions — SP8 Plan 8a.
 *
 * Foundry-coupled glue for the PC sheet's "Seed Sub-Scores From Main" button —
 * not unit-tested, verified in a linked dev world. The math (which sub-scores
 * to seed, with what value) is the pure `subScoreSeedUpdate`; this file only
 * re-checks the gate, reads the AUTHORED scores off `_source`, and writes the
 * update to the actor the user already owns (no cross-actor mutation).
 * ------------------------------------------------------------------------- */

interface SubAbilityActor {
  _source: { system: { abilities: Record<AbilityKey, SubScoreSource> } };
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Writes each null sub-score's ability's authored main score into it. Re-derives
 *  eligibility server-side (rule on, something to seed) — never trusts the button
 *  having been rendered — and no-ops with a toast otherwise. */
export async function seedSubAbilities(actor: SubAbilityActor): Promise<void> {
  const update = subAbilitiesEnabled(getOptionalRules()) ? subScoreSeedUpdate(actor._source.system.abilities) : {};
  if (Object.keys(update).length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.subAbilities.seedBlockedWarning"));
    return;
  }
  await actor.update(update);
}
