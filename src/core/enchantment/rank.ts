// Weapon enchantment ranks: what a physical attack can harm. Pure.
//   rank 0 = nonmagical / bare fists, 1 = "magical" (ch'i at levels 1-4), 2 = +1, ... 6 = +5.

export const HIT_REQUIREMENTS = ["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"] as const;
export type HitRequirement = (typeof HIT_REQUIREMENTS)[number];

/** The rank a creature's "hit only by" requirement needs; unknown ids need nothing. */
export function requirementRank(requirement: string): number {
  const i = (HIT_REQUIREMENTS as readonly string[]).indexOf(requirement);
  return i === -1 ? 0 : i;
}

/** A +N weapon (N >= 1) has rank N + 1; +0 and nonmagical weapons have rank 0. */
export function weaponRank(magicBonus: number): number {
  return magicBonus >= 1 ? magicBonus + 1 : 0;
}

/** PHBR15 Table 20: unarmed martial arts hits by character level (magical, +1, +2, +3, +4). */
export function chiRank(level: number): number {
  if (level < 1) return 0;
  if (level <= 4) return 1;
  if (level <= 9) return 2;
  if (level <= 14) return 3;
  if (level <= 19) return 4;
  return 5;
}

/** The best of the wielded weapon, the ammunition (missile attacks) and ch'i (unarmed attacks, when a level is given). */
export function attackRank(input: { weaponMagicBonus?: number; ammoMagicBonus?: number; chiLevel?: number | null }): number {
  const ranks = [weaponRank(input.weaponMagicBonus ?? 0)];
  if (input.ammoMagicBonus !== undefined) ranks.push(weaponRank(input.ammoMagicBonus));
  if (input.chiLevel !== undefined && input.chiLevel !== null) ranks.push(chiRank(input.chiLevel));
  return Math.max(...ranks);
}

export function canHarm(attackRankValue: number, requirement: string): boolean {
  return attackRankValue >= requirementRank(requirement);
}

export function requirementLabelKey(requirement: string): string {
  return `ADND2E.hitRequirements.${requirement === "" ? "none" : requirement}`;
}

export function chiRankLabelKey(rank: number): string {
  return `ADND2E.martialChi.rank${rank}`;
}
