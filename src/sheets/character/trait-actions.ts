import { characterPointLedgerFor, DEFAULT_CHARACTER_POINT_POOL, DISADVANTAGE_REFUND_CAP } from "../../core/skills/character-points";
import type { AbilityKey } from "../../core/types";
import { getOptionalRules } from "../../settings";
import type { DropCheckInput } from "./drop-rules";

/* ---------------------------------------------------------------------------
 * trait-actions — SP8 Plan 8c.
 *
 * Foundry-coupled glue for the PC sheet's trait drop check and remove button —
 * not unit-tested, verified in a linked dev world. The math and the gate are the
 * pure `characterPointLedgerFor` / `validateItemDrop`; this file only reads the
 * actor's CURRENT authored state at drop time (never rendered UI state) and
 * deletes an embedded item the user already owns.
 * ------------------------------------------------------------------------- */

interface TraitItemLike {
  type: string;
  system: { traitId?: string; cost?: number };
}

interface TraitActor {
  _source: {
    system: {
      abilities: Partial<Record<AbilityKey, { sub?: { a: number | null; b: number | null } | null }>>;
      options?: { skillsAndPowers?: { characterPoints?: { pool?: number } } };
    };
  };
  items: Iterable<TraitItemLike> & { get(id: string): (TraitItemLike & { delete(): Promise<unknown> }) | undefined };
}

export type TraitDropInputs = Pick<
  DropCheckInput,
  "dropTraitCost" | "dropTraitId" | "ownedTraitIds" | "availableCp" | "refundedSoFar"
>;

/** The trait-drop inputs for `validateItemDrop`, re-derived from the actor's current authored state and settings. */
export function traitDropInputs(actor: TraitActor, dropped: { system: { traitId?: string; cost?: number } }): TraitDropInputs {
  const owned = [...actor.items].filter((i) => i.type === "trait");
  const ledger = characterPointLedgerFor(getOptionalRules(), {
    pool: actor._source.system.options?.skillsAndPowers?.characterPoints?.pool ?? DEFAULT_CHARACTER_POINT_POOL,
    abilities: actor._source.system.abilities,
    traitCosts: owned.map((i) => i.system.cost ?? 0),
  });
  return {
    dropTraitCost: dropped.system.cost ?? 0,
    dropTraitId: dropped.system.traitId ?? "",
    ownedTraitIds: owned.map((i) => i.system.traitId ?? ""),
    availableCp: ledger ? ledger.available : null,
    refundedSoFar: ledger ? ledger.refund : 0,
  };
}

/** True when the cap will return less than this disadvantage's face value (computed from the PRE-drop inputs). */
export function traitRefundCapped(inputs: TraitDropInputs): boolean {
  const cost = inputs.dropTraitCost ?? 0;
  return cost < 0 && -cost > DISADVANTAGE_REFUND_CAP - (inputs.refundedSoFar ?? 0);
}

/** Deletes an owned trait item (its CP is refunded automatically — spent CP is derived). No-ops with a warning for anything that is not an owned trait. */
export async function removeTrait(actor: TraitActor, itemId: string): Promise<void> {
  const item = actor.items.get(itemId);
  if (!item || item.type !== "trait") {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.traits.removeBlockedWarning"));
    return;
  }
  await item.delete();
}
