// PHBR15 ch.4 each maneuver's "Weapons Allowed" line as data, and the armed-use assessment. Pure.
// "(using shaft)" qualifiers in the book are not enforced; only group membership is.
import { weaponGroupIdsFor } from "./weapon-groups";

export type WeaponUse = "none" | "any" | readonly string[];

const CHAIN_ROPE_LASH = ["chainWeapons", "ropeWeapons", "lashWeapons"] as const;

export const MANEUVER_WEAPONS: Readonly<Record<string, WeaponUse>> = {
  "block:1": "any", "block:2": "any", "block:3": "any", "block:4": "any",
  "kick:1": "none", "kick:2": "none", "kick:3": "none",
  "strike:1": "any", "strike:2": "none", "strike:3": "none",
  "lock:1": [...CHAIN_ROPE_LASH, "axes", "clubbingWeapons", "flails", "karateWeapons", "picks", "sickles", "staves", "bladedPoles", "spears"],
  "lock:2": ["mediumBlades", "orientalBlades", "shortBlades", ...CHAIN_ROPE_LASH, "axes", "clubbingWeapons", "flails", "karateWeapons", "picks", "sickles", "staves", "spears"],
  "lock:3": [...CHAIN_ROPE_LASH, "clubbingWeapons", "karateWeapons", "staves", "spears"],
  "lock:4": [...CHAIN_ROPE_LASH],
  "push:1": ["clubbingWeapons", "staves", "bladedPoles", "poleSpears", "spears"],
  "push:2": "none", "push:3": "none",
  "throw:1": "any", "throw:2": "any", "throw:3": "none",
  "throw:4": [...CHAIN_ROPE_LASH, "staves", "bladedPoles", "poleSpears", "spears"],
  "vitalArea:1": ["clubbingWeapons"], "vitalArea:2": ["clubbingWeapons"], "vitalArea:3": ["clubbingWeapons"], "vitalArea:4": "none",
  "movement:1": "any", "movement:2": "any", "movement:3": "any", "movement:4": "any", "movement:5": "any", "movement:6": "none",
  "weapon:1": "any", "weapon:2": ["ropeWeapons"],
  "mental:1": "none", "mental:2": "none", "mental:3": "none", "mental:4": "none", "mental:5": "none", "mental:6": "none", "mental:7": "none",
};

/** +2 to hit when the matching weapon (by name or by group) is wielded and its group is learned. */
export const WEAPON_HIT_BONUS: Readonly<Record<string, { amount: number; names?: readonly string[]; groups?: readonly string[] }>> = {
  "block:1": { amount: 2, names: ["sai", "jitte"] },
  "block:2": { amount: 2, names: ["sai", "jitte"] },
  "lock:2": { amount: 2, names: ["sai", "jitte"] },
  "block:3": { amount: 2, groups: ["chainWeapons", "ropeWeapons"] },
};

export type WeaponUseState = "unarmed" | "ok" | "uncovered" | "notAllowed" | "needsStyleWeapon";

export interface WeaponUseAssessment {
  state: WeaponUseState;
  weaponName: string | null;
  /** the wielded weapon belongs to a group bought on the active style */
  covered: boolean;
  hitBonus: number;
}

export interface WieldedWeapon {
  name: string;
  /** the weapon item's base weapon name, tried before its own name */
  baseName?: string;
}

const outcome = (state: WeaponUseState, weaponName: string | null, covered = false, hitBonus = 0): WeaponUseAssessment => ({ state, weaponName, covered, hitBonus });

function bonusFor(maneuverId: string, weapon: WieldedWeapon, groups: readonly string[]): number {
  const def = WEAPON_HIT_BONUS[maneuverId];
  if (!def) return 0;
  const lower = [weapon.name, weapon.baseName ?? ""].map((n) => n.toLowerCase());
  const byName = (def.names ?? []).some((n) => lower.some((l) => l.split(/[^a-z]+/).includes(n)));
  const byGroup = (def.groups ?? []).some((g) => groups.includes(g));
  return byName || byGroup ? def.amount : 0;
}

/** How the equipped weapons relate to a maneuver on the active style: hints and the book's +2 bonuses, never damage. */
export function assessWeaponUse(input: { maneuverId: string; knownGroups: readonly string[]; weapons: readonly WieldedWeapon[] }): WeaponUseAssessment {
  const policy: WeaponUse = MANEUVER_WEAPONS[input.maneuverId] ?? "any";
  const known = new Set(input.knownGroups);
  const rows = input.weapons.map((w) => ({ weapon: w, groups: weaponGroupIdsFor(w.baseName ?? "", w.name) }));
  if (input.maneuverId === "weapon:1") {
    const style = rows.find((r) => r.groups.some((g) => known.has(g)));
    return style ? outcome("ok", style.weapon.name, true) : outcome("needsStyleWeapon", rows[0]?.weapon.name ?? null);
  }
  if (rows.length === 0) return outcome("unarmed", null);
  if (policy === "none") return outcome("notAllowed", rows[0].weapon.name);
  const permitted: readonly string[] | null = policy === "any" ? null : policy;
  const inPermitted = (groups: string[]): boolean => permitted === null || groups.some((g) => permitted.includes(g));
  const usable = rows.find((r) => permitted === null || r.groups.some((g) => known.has(g) && permitted.includes(g)));
  if (!usable) {
    const wrongGroup = rows.find((r) => inPermitted(r.groups));
    return wrongGroup ? outcome("uncovered", wrongGroup.weapon.name) : outcome("notAllowed", rows[0].weapon.name);
  }
  const covered = usable.groups.some((g) => known.has(g));
  return outcome("ok", usable.weapon.name, covered, covered ? bonusFor(input.maneuverId, usable.weapon, usable.groups) : 0);
}
