import type { AbilityKey, Alignment, Race } from "../types";

/* Character-kit qualifications (SP11 Plan A). Pure. */

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export interface KitQualifications {
  /** per-ability minimum score; 0 = no minimum */
  abilityMinimums: Record<AbilityKey, number>;
  /** empty = any race */
  races: readonly Race[];
  /** empty = any alignment */
  alignments: readonly Alignment[];
}

export interface KitQualifyActor {
  abilities: Record<AbilityKey, number>;
  race: Race | null;
  alignment: Alignment | null;
}

export type KitQualifyVerdict = { ok: true } | { ok: false; reason: string };

/** The first unmet qualification as an i18n reason key, or ok. */
export function kitQualifies(q: KitQualifications, actor: KitQualifyActor): KitQualifyVerdict {
  for (const key of ABILITY_KEYS) {
    const min = q.abilityMinimums[key];
    if (min > 0 && actor.abilities[key] < min) return { ok: false, reason: "ADND2E.sheet.drop.kitAbility" };
  }
  if (q.races.length > 0 && (actor.race === null || !q.races.includes(actor.race))) {
    return { ok: false, reason: "ADND2E.sheet.drop.kitRace" };
  }
  if (q.alignments.length > 0 && (actor.alignment === null || !q.alignments.includes(actor.alignment))) {
    return { ok: false, reason: "ADND2E.sheet.drop.kitAlignment" };
  }
  return { ok: true };
}

/** True when a kit's forbidden list names this weapon proficiency (a weapon name or a group), case-insensitively. */
export function kitForbidsProficiency(forbidden: readonly string[], weaponOrGroup: string): boolean {
  const key = weaponOrGroup.trim().toLowerCase();
  return forbidden.some((f) => f.trim().toLowerCase() === key);
}
