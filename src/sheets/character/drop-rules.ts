import type { KitQualifyVerdict } from "../../core/kits";
import { canAffordTrait } from "../../core/skills/character-points";

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
  /** weaponProficiency drops: the dropped item's own `(weaponOrGroup, isGroup)` */
  dropWeaponOrGroup?: string;
  dropIsGroup?: boolean;
  /** `(weaponOrGroup, isGroup)` of every weaponProficiency item already on the actor */
  existingWeaponProfs?: readonly { weaponOrGroup: string; isGroup: boolean }[];
  /** nonweaponProficiency drops: the dropped item's own name (there's no
   *  dedicated id field — every pack entry, and any sane hand-made one, is
   *  uniquely named, e.g. "Swimming") */
  dropNonweaponName?: string;
  /** `name` of every nonweaponProficiency item already on the actor */
  existingNonweaponNames?: readonly string[];
  /** trait drops: the dropped trait's CP cost (negative = a disadvantage) */
  dropTraitCost?: number;
  /** trait drops: the dropped trait's `system.traitId` ("" for a hand-made custom trait) */
  dropTraitId?: string;
  /** `system.traitId` of every `trait` item already on the actor */
  ownedTraitIds?: readonly string[];
  /** CP currently available — `null`/absent means the character-point build rule is off
   *  (the ledger was null), which rejects every trait drop */
  availableCp?: number | null;
  /** disadvantage refund already counted against the cap */
  refundedSoFar?: number;
  /** kit drops: the kit's class chassis */
  dropKitChassisId?: string;
  /** chassis of every `kit` item already on the actor */
  existingKitChassisIds?: readonly string[];
  /** kit drops: the pure qualification verdict, computed by the sheet */
  kitQualifies?: KitQualifyVerdict;
  /** weaponProficiency drops: true when an owned kit forbids the dropped proficiency */
  kitForbidsProficiency?: boolean;
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
  if (input.dropType === "weaponProficiency") {
    if (input.kitForbidsProficiency) return { ok: false, reason: "ADND2E.sheet.drop.kitForbiddenProficiency" };
    const dup = (input.existingWeaponProfs ?? []).some(
      (p) => p.weaponOrGroup === input.dropWeaponOrGroup && p.isGroup === (input.dropIsGroup ?? false),
    );
    if (dup) return { ok: false, reason: "ADND2E.sheet.drop.duplicateWeaponProficiency" };
    const cost = input.dropSlotCost ?? 1;
    const available = input.availableSlots ?? 0;
    return cost > available ? { ok: false, reason: "ADND2E.sheet.drop.insufficientSlots" } : { ok: true };
  }
  if (input.dropType === "nonweaponProficiency") {
    if ((input.existingNonweaponNames ?? []).includes(input.dropNonweaponName ?? "")) {
      return { ok: false, reason: "ADND2E.sheet.drop.duplicateNonweaponProficiency" };
    }
    const cost = input.dropSlotCost ?? 1;
    const available = input.availableSlots ?? 0;
    return cost > available ? { ok: false, reason: "ADND2E.sheet.drop.insufficientSlots" } : { ok: true };
  }
  if (input.dropType === "trait") {
    if (input.availableCp == null) return { ok: false, reason: "ADND2E.sheet.drop.traitsDisabled" };
    const verdict = canAffordTrait({
      traitCost: input.dropTraitCost ?? 0,
      traitId: input.dropTraitId ?? "",
      ownedTraitIds: input.ownedTraitIds ?? [],
      available: input.availableCp,
      refundedSoFar: input.refundedSoFar ?? 0,
    });
    return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
  }
  if (input.dropType === "kit") {
    const chassis = input.dropKitChassisId ?? "";
    if (!input.existingChassisIds.includes(chassis)) return { ok: false, reason: "ADND2E.sheet.drop.kitNoClass" };
    if ((input.existingKitChassisIds ?? []).includes(chassis)) return { ok: false, reason: "ADND2E.sheet.drop.kitDuplicate" };
    if (input.kitQualifies && !input.kitQualifies.ok) return { ok: false, reason: input.kitQualifies.reason };
    return { ok: true };
  }
  return { ok: true };
}
