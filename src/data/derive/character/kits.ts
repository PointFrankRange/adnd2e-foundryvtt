import { normalizePowers, type EquipmentOverride, type KitPower, type KitQualifications, type RawPower } from "../../../core/kits";
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
