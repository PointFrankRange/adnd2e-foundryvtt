// PHBR15 Table 13 (pp.32-33): the melee tight groups. Pure. Missile and throwing groups are not melee style weapons and are omitted.
// Weapons the book marks "not part of a tight group" (lasso, net, gunsen, siangkam, dart, tetsu-bishi) are omitted.

import { MAX_MANEUVERS_PER_LEVEL, type LearnVerdict } from "./maneuvers";

export interface WeaponGroupDef {
  id: string;
  /** the English name as written on the shipped styles' `weaponGroups` */
  label: string;
  /** normalized weapon names (slash-separated book entries are listed as separate names) */
  members: readonly string[];
}

export const WEAPON_GROUPS: readonly WeaponGroupDef[] = [
  { id: "fencingBlades", label: "Fencing Blades", members: ["dagger", "dirk", "knife", "stiletto", "main gauche", "rapier", "sabre"] },
  { id: "longBlades", label: "Long Blades", members: ["bastard sword", "no daichi", "tetsu to", "two handed sword"] },
  { id: "mediumBlades", label: "Medium Blades", members: ["broad sword", "cutlass", "katana", "bokken", "khopesh", "long sword", "ninja to", "scimitar"] },
  { id: "orientalBlades", label: "Oriental Blades", members: ["katana", "bokken", "ninja to", "no daichi", "tetsu to", "tanto", "yoroi toshi", "wakizashi"] },
  {
    id: "shortBlades",
    label: "Short Blades",
    members: ["chopsticks", "dagger", "dirk", "gaff", "hook", "knife", "stiletto", "main gauche", "parang", "short sword", "shuriken", "nekode", "tanto", "yoroi toshi", "wakizashi"],
  },
  { id: "chainWeapons", label: "Chain Weapons", members: ["kau sin ke", "kusarigama", "manriki gusari", "three section staff"] },
  { id: "lashWeapons", label: "Lash Weapons", members: ["scourge", "whip"] },
  { id: "ropeWeapons", label: "Rope Weapons", members: ["bola", "kawanaga", "kyogetsu shogi"] },
  { id: "axes", label: "Axes", members: ["battle axe", "hand axe", "throwing axe"] },
  {
    id: "clubbingWeapons",
    label: "Clubbing Weapons",
    members: ["club", "footmans mace", "hanbo", "horsemans mace", "jo", "kiseru", "morning star", "tonfa", "war hammer"],
  },
  { id: "flails", label: "Flails", members: ["footmans flail", "horsemans flail"] },
  { id: "karateWeapons", label: "Karate Weapons", members: ["kama", "nunchaku", "quarterstaff", "bo", "sai", "jitte", "tonfa"] },
  { id: "picks", label: "Picks", members: ["fang", "footmans pick", "horsemans pick"] },
  { id: "sickles", label: "Sickles", members: ["kama", "sickle", "scythe"] },
  { id: "staves", label: "Staves", members: ["kumade", "lajatang", "quarterstaff", "bo", "tetsu bo"] },
  {
    id: "bladedPoles",
    label: "Bladed Poles",
    members: [
      "bardiche", "bec de corbin", "bill guisarme", "fauchard", "fauchard fork", "glaive", "glaive guisarme", "guisarme", "guisarme voulge", "halberd",
      "hook fauchard", "lajatang", "lucern hammer", "man catcher", "military fork", "nagimaki", "naginata", "partisan", "ranseur", "sang kauw", "sode garami",
    ],
  },
  { id: "poleSpears", label: "Pole Spears", members: ["spetum", "trident", "voulge"] },
  { id: "lances", label: "Lances", members: ["heavy horse lance", "light horse lance", "jousting lance", "medium horse lance"] },
  { id: "spears", label: "Spears", members: ["awl pike", "chijiriki", "harpoon", "javelin", "long spear", "shakujo yari", "spear", "trident", "uchi ne"] },
];

export const WEAPON_GROUP_IDS: readonly string[] = WEAPON_GROUPS.map((g) => g.id);

const ANY_MELEE = "any tight group of melee weapons";

/** Lowercase, drop parentheses and magic bonuses, turn punctuation into spaces and drop apostrophes. */
export function normalizeWeaponName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[+-]\s*\d+/g, " ")
    .replace(/'/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The tight groups containing a weapon; each given name is tried (put the base weapon name first). */
export function weaponGroupIdsFor(...names: string[]): string[] {
  const wanted = names.map(normalizeWeaponName).filter((n) => n !== "");
  const out: string[] = [];
  for (const g of WEAPON_GROUPS) if (wanted.some((n) => g.members.includes(n))) out.push(g.id);
  return out;
}

/** A style's offered tight-group ids from its `weaponGroups` names (registry order, unknown names dropped). */
export function offeredGroupIds(weaponGroups: readonly string[]): string[] {
  const names = weaponGroups.map((n) => n.trim().toLowerCase());
  if (names.includes(ANY_MELEE)) return [...WEAPON_GROUP_IDS];
  return WEAPON_GROUPS.filter((g) => names.includes(g.label.toLowerCase())).map((g) => g.id);
}

export const weaponGroupLabelKey = (id: string): string => `ADND2E.martialWeaponGroups.${id}`;

/** Whether a style may buy a tight group now. The two-per-level cap is shared with maneuvers. */
export function groupLearnability(input: {
  groupId: string;
  offered: readonly string[];
  knownGroups: readonly { id: string; level: number }[];
  /** maneuvers already learned at the current level on this style */
  maneuversAtLevel: number;
  freeSlots: number;
  level: number;
}): LearnVerdict {
  if (!input.offered.includes(input.groupId)) return { ok: false, reason: "notOffered" };
  if (input.knownGroups.some((g) => g.id === input.groupId)) return { ok: false, reason: "known" };
  if (input.freeSlots < 1) return { ok: false, reason: "noSlot" };
  const groupsAtLevel = input.knownGroups.filter((g) => g.level === input.level).length;
  if (input.maneuversAtLevel + groupsAtLevel >= MAX_MANEUVERS_PER_LEVEL) return { ok: false, reason: "levelCap" };
  return { ok: true };
}

/** Removes one bought group and refunds its slot (never below the style's first slot); null when it is not known. */
export function unlearnGroupUpdate(input: {
  known: readonly { id: string; level: number }[];
  groupId: string;
  slotsInvested: number;
}): { knownWeaponGroups: { id: string; level: number }[]; slotsInvested: number } | null {
  if (!input.known.some((g) => g.id === input.groupId)) return null;
  return {
    knownWeaponGroups: input.known.filter((g) => g.id !== input.groupId).map((g) => ({ id: g.id, level: g.level })),
    slotsInvested: Math.max(1, input.slotsInvested - 1),
  };
}
