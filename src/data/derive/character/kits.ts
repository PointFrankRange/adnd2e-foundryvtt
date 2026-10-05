import { normalizeOverrides, normalizePowers, type KitOverrides, type RawOverrides, type EquipmentOverride, type KitPower, type KitQualifications, type RawPower } from "../../../core/kits";
import { getChassis } from "../../../core/classes/chassis";
import type { ClassId } from "../../../core/types";
import { toTraitEffect, type RawTraitEffect, type TraitEffect } from "../../../core/skills/traits";

/* SP11 Plan A: the owned `kit` items as plain entries. Pure. */

export interface KitEntry {
  id: string;
  name: string;
  chassisId: string;
  xpModifierPercent: number;
  effects: TraitEffect[];
  qualifications: KitQualifications;
  equipment: { armor: EquipmentOverride; weapons: EquipmentOverride };
  forbiddenWeaponProficiencies: string[];
  grantedFeatures: string[];
  powers: KitPower[];
  overrides: KitOverrides;
}

interface KitSystem {
  chassisId: string;
  qualifications: KitQualifications;
  xpModifierPercent: number;
  effects: RawTraitEffect[];
  equipment: { armor: EquipmentOverride; weapons: EquipmentOverride };
  forbiddenWeaponProficiencies: string[];
  grantedFeatures: string[];
  powers?: RawPower[];
  overrides?: RawOverrides;
}

type ItemLike = { id?: string; name?: string; type: string; system: unknown };

/** Every `kit` item as an entry, in item order; a malformed effect is dropped (inert). */
export function toKitEntries(items: Iterable<ItemLike>): KitEntry[] {
  const out: KitEntry[] = [];
  for (const item of items) {
    if (item.type !== "kit") continue;
    const s = item.system as KitSystem;
    const effects: TraitEffect[] = [];
    for (const raw of s.effects) {
      const e = toTraitEffect(raw);
      if (e) effects.push(e);
    }
    out.push({
      id: item.id ?? "",
      name: item.name ?? "",
      chassisId: s.chassisId,
      xpModifierPercent: s.xpModifierPercent,
      effects,
      qualifications: s.qualifications,
      equipment: s.equipment,
      forbiddenWeaponProficiencies: [...s.forbiddenWeaponProficiencies],
      grantedFeatures: [...s.grantedFeatures],
      powers: normalizePowers(s.powers ?? []),
      overrides: normalizeOverrides(s.overrides),
    });
  }
  return out;
}

/** The kits that currently apply: those whose class chassis the actor owns a `class` item for. */
export function activeKitEntries(items: Iterable<ItemLike>): KitEntry[] {
  const all = [...items];
  const chassisIds = new Set(
    all.filter((i) => i.type === "class").map((i) => (i.system as { chassisId: string }).chassisId),
  );
  return toKitEntries(all).filter((k) => chassisIds.has(k.chassisId));
}

/** SP11 Plan C: which caster types a kit has switched off. A type is off when the actor has at least one class of that caster type and every such class has `castingDisabled`. */
export function casterTypesDisabled(
  classes: readonly { chassisId: string; castingDisabled?: boolean }[],
): { wizard: boolean; priest: boolean } {
  const result = { wizard: false, priest: false };
  for (const type of ["wizard", "priest"] as const) {
    const ofType = classes.filter((c) => getChassis(c.chassisId as ClassId).casterType === type);
    result[type] = ofType.length > 0 && ofType.every((c) => c.castingDisabled === true);
  }
  return result;
}
