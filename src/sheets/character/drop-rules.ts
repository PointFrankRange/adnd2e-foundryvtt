export interface DropCheckInput {
  /** the dropped item's `type` */
  dropType: string;
  /** the dropped item's `system.chassisId` when `dropType === "class"` */
  dropChassisId?: string | null;
  /** does the actor already have a `race` item */
  hasRace: boolean;
  /** `system.chassisId` of every `class` item already on the actor */
  existingChassisIds: readonly string[];
  /** slots the dropped item would cost, when `dropType` is `weaponProficiency`/
   *  `nonweaponProficiency` — defaults to 1 if omitted (a fresh weapon
   *  proficiency always costs exactly 1 slot at drop time; specialization is
   *  a separate later purchase). */
  dropSlotCost?: number;
  /** slots currently available in the matching category (weapon or
   *  nonweapon) — defaults to 0 if omitted, so an un-supplied value rejects
   *  rather than silently allowing an unbounded drop. */
  availableSlots?: number;
}

export interface DropVerdict {
  ok: boolean;
  /** i18n key for the rejection toast */
  reason?: string;
}

/** Which compendium/world items a character sheet accepts on drop, and why not. */
export function validateItemDrop(input: DropCheckInput): DropVerdict {
  if (input.dropType === "race") {
    return input.hasRace ? { ok: false, reason: "ADND2E.sheet.drop.duplicateRace" } : { ok: true };
  }
  if (input.dropType === "class") {
    const dup = input.dropChassisId != null && input.existingChassisIds.includes(input.dropChassisId);
    return dup ? { ok: false, reason: "ADND2E.sheet.drop.duplicateClass" } : { ok: true };
  }
  if (input.dropType === "weaponProficiency" || input.dropType === "nonweaponProficiency") {
    const cost = input.dropSlotCost ?? 1;
    const available = input.availableSlots ?? 0;
    return cost > available ? { ok: false, reason: "ADND2E.sheet.drop.insufficientSlots" } : { ok: true };
  }
  return { ok: true };
}
