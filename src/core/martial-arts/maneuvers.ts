// PHBR15 Table 19 / Table 21 special maneuvers (Plan B1: Block, Kick, Strike). Pure.

export const MANEUVER_LISTS = ["block", "kick", "strike"] as const;
export type ManeuverList = (typeof MANEUVER_LISTS)[number];

/** Attacks a maneuver costs: 0 = none extra, "round" = the only action of the round. */
export type ManeuverCost = 0 | 1 | 2 | "round";
export type ArmorGroup = "none" | "light" | "mail" | "plate";

export interface ManeuverDef {
  /** `<list>:<difficulty>`, the key stored in a style's knownManeuvers */
  id: string;
  /** i18n leaf under ADND2E.martialManeuvers / martialManeuverEffects / martialManeuverFailures */
  slug: string;
  list: ManeuverList;
  difficulty: number;
  kind: "parry" | "attack";
  cost: ManeuverCost;
  /** a die added to the style's damage die */
  extraDie: string | null;
  /** a die used instead of the style's damage die */
  ownDie: string | null;
  addsStrength: boolean;
  /** adds half the character's level, rounded down */
  halfLevelBonus: boolean;
  /** Table 21 attack modifier by the target's armor group (negative = harder) */
  table21: { light: number; mail: number; plate: number };
}

const NONE = { light: 0, mail: 0, plate: 0 } as const;

export const MANEUVERS: readonly ManeuverDef[] = [
  { id: "block:1", slug: "basicParry", list: "block", difficulty: 1, kind: "parry", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "block:2", slug: "parryAll", list: "block", difficulty: 2, kind: "parry", cost: 2, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "block:3", slug: "grapplingBlock", list: "block", difficulty: 3, kind: "parry", cost: 1, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "block:4", slug: "arrowParry", list: "block", difficulty: 4, kind: "parry", cost: 2, extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: false, table21: NONE },
  { id: "kick:1", slug: "circleKick", list: "kick", difficulty: 1, kind: "attack", cost: 1, extraDie: "1d2", ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: 0, mail: -1, plate: -3 } },
  { id: "kick:2", slug: "flyingKick", list: "kick", difficulty: 2, kind: "attack", cost: 1, extraDie: "1d4", ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: -1, mail: -2, plate: -3 } },
  { id: "kick:3", slug: "backwardKick", list: "kick", difficulty: 3, kind: "attack", cost: 1, extraDie: null, ownDie: null, addsStrength: true, halfLevelBonus: false, table21: { light: 0, mail: -1, plate: -3 } },
  { id: "strike:1", slug: "ironFist", list: "strike", difficulty: 1, kind: "attack", cost: 0, extraDie: null, ownDie: "1d6", addsStrength: true, halfLevelBonus: false, table21: { light: 0, mail: 0, plate: -2 } },
  { id: "strike:2", slug: "crushingBlow", list: "strike", difficulty: 2, kind: "attack", cost: "round", extraDie: null, ownDie: null, addsStrength: false, halfLevelBonus: true, table21: { light: -1, mail: -2, plate: -3 } },
  { id: "strike:3", slug: "eagleClaw", list: "strike", difficulty: 3, kind: "attack", cost: "round", extraDie: null, ownDie: "1d8", addsStrength: true, halfLevelBonus: false, table21: { light: -2, mail: -3, plate: -4 } },
];

export function maneuverById(id: string): ManeuverDef | undefined {
  return MANEUVERS.find((m) => m.id === id);
}

const LIGHT = new Set(["leather", "padded", "studded-leather"]);
const MAIL = new Set(["ring-mail", "scale-mail", "chain-mail", "elven-chain", "splint-mail", "banded-mail", "plate-mail"]);
const PLATE = new Set(["field-plate", "full-plate"]);

/** The Table 21 column for a target: a tough-hided monster (a creature with AC 7 or better) uses the light column. */
export function armorGroupOf(armorType: string, toughMonster: boolean): ArmorGroup {
  if (toughMonster) return "light";
  if (LIGHT.has(armorType)) return "light";
  if (MAIL.has(armorType)) return "mail";
  if (PLATE.has(armorType)) return "plate";
  return "none";
}

export function table21Modifier(def: ManeuverDef, group: ArmorGroup): number {
  return group === "none" ? 0 : def.table21[group];
}

/**
 * The damage dice expression for a hit, or null for a parry. Dice terms are joined with "+", flat terms are
 * summed; a style die of "1" is a flat 1 hp and a null style die (a weapon-method style) counts as 0.
 * With no dice the result is a flat number floored at 0; the caller floors a rolled total at 0 too.
 */
export function maneuverDamageFormula(
  def: ManeuverDef,
  ctx: { styleDie: string | null; level: number; strengthAdj: number },
): string | null {
  if (def.kind === "parry") return null;
  const dice: string[] = [];
  let flat = 0;
  const base = def.ownDie ?? ctx.styleDie;
  if (base !== null) {
    if (base === "1") flat += 1;
    else dice.push(base);
  }
  if (def.extraDie !== null) dice.push(def.extraDie);
  if (def.halfLevelBonus) flat += Math.floor(ctx.level / 2);
  if (def.addsStrength) flat += ctx.strengthAdj;
  if (dice.length === 0) return String(Math.max(0, flat));
  return dice.join("+") + (flat > 0 ? `+${flat}` : flat < 0 ? `${flat}` : "");
}

export const MAX_MANEUVERS_PER_LEVEL = 2;

export type LearnReason = "notOffered" | "known" | "order" | "noSlot" | "levelCap";
export type LearnVerdict = { ok: true } | { ok: false; reason: LearnReason };

export function learnability(input: {
  maneuverId: string;
  offered: readonly { list: string; difficulties: readonly number[] }[];
  known: readonly { id: string; level: number }[];
  freeSlots: number;
  level: number;
}): LearnVerdict {
  const def = maneuverById(input.maneuverId);
  const offeredDifficulties = def ? (input.offered.find((o) => o.list === def.list)?.difficulties ?? []) : [];
  if (!def || !offeredDifficulties.includes(def.difficulty)) return { ok: false, reason: "notOffered" };
  const knownIds = new Set(input.known.map((k) => k.id));
  if (knownIds.has(def.id)) return { ok: false, reason: "known" };
  const skipped = offeredDifficulties.some((d) => d < def.difficulty && !knownIds.has(`${def.list}:${d}`));
  if (skipped) return { ok: false, reason: "order" };
  if (input.freeSlots < 1) return { ok: false, reason: "noSlot" };
  if (input.known.filter((k) => k.level === input.level).length >= MAX_MANEUVERS_PER_LEVEL) return { ok: false, reason: "levelCap" };
  return { ok: true };
}
