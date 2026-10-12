// PHBR15 ch.4, Table 18: a martial arts style's basics derive from its form and principal method. Pure.
export const STYLE_FORMS = ["hard", "soft", "hardSoft"] as const;
export type StyleForm = (typeof STYLE_FORMS)[number];

export const STYLE_METHODS = ["block", "kick", "lock", "movement", "push", "strike", "throw", "vitalArea", "weapon"] as const;
export type StyleMethod = (typeof STYLE_METHODS)[number];

export type PrincipalAttack = "hand" | "foot" | "body" | "legs" | "handFoot" | "handArm";

const FORM_AC: Readonly<Record<StyleForm, number>> = { hard: -1, soft: -3, hardSoft: -2 };
const FORM_DAMAGE: Readonly<Record<StyleForm, number>> = { hard: 2, soft: 0, hardSoft: 1 };
/** null = "by weapon" (the weapon's own damage). */
const METHOD_DAMAGE: Readonly<Record<StyleMethod, number | null>> = {
  block: 1, kick: 2, lock: 1, movement: 1, push: 1, strike: 2, throw: 1, vitalArea: 2, weapon: null,
};
const METHOD_ATTACK: Readonly<Record<StyleMethod, PrincipalAttack>> = {
  block: "hand", kick: "foot", lock: "body", movement: "legs", push: "hand", strike: "hand", throw: "body", vitalArea: "handFoot", weapon: "handArm",
};

/** Die sizes used in the game; 1 means a flat 1 hp. A Dmg Mod total rounds UP to the nearest. */
const DIE_SIZES = [1, 2, 3, 4, 6, 8, 10, 12, 20] as const;

export function damageDieFor(total: number): string {
  const size = DIE_SIZES.find((s) => s >= total) ?? 20;
  return size === 1 ? "1" : `1d${size}`;
}

export interface StyleStats {
  /** every style adds exactly one attack per round, only while unarmed */
  extraAttacks: 1;
  /** added to the character's AC, worn armor or not (negative = better) */
  acMod: number;
  damageMod: number | null;
  /** the style's basic unarmed damage die; null for a weapon-method style */
  damageDie: string | null;
  principalAttack: PrincipalAttack;
}

export function styleStats(form: StyleForm, method: StyleMethod): StyleStats {
  const methodDamage = METHOD_DAMAGE[method];
  const damageMod = methodDamage === null ? null : FORM_DAMAGE[form] + methodDamage;
  return {
    extraAttacks: 1,
    acMod: FORM_AC[form],
    damageMod,
    damageDie: damageMod === null ? null : damageDieFor(damageMod),
    principalAttack: METHOD_ATTACK[method],
  };
}

/** The style used this round: the stored id when still owned, else the first owned style, else "". */
export function resolveActiveStyleId(ids: readonly string[], stored: string): string {
  return ids.includes(stored) ? stored : (ids[0] ?? "");
}
