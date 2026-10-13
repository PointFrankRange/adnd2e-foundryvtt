// Chat-card context for a martial arts attack (SP18). Pure.
import type { MartialAttackResult } from "./attack";
import type { ManeuverAttackResult } from "./maneuver-attack";
import { maneuverById } from "./maneuvers";
import { levitationInfo, type LeapResult, type SpeedResult } from "./skills";

export interface MartialCardInput {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  result: MartialAttackResult;
}

export interface MartialCardContext {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  natural: number;
  total: number;
  needed: number;
  hit: boolean;
  breakdown: { labelKey: string; amount: number }[];
  resultKey: string;
  blowKey: string;
  damage: number;
  stunTrigger: boolean;
}

export function buildMartialCardContext(input: MartialCardInput): MartialCardContext {
  const r = input.result;
  const rows: [string, number][] = [
    ["ADND2E.chat.martialArts.mod.armor", r.penalties.armor],
    ["ADND2E.chat.martialArts.mod.weaponSize", r.penalties.weaponSize],
    ["ADND2E.chat.martialArts.mod.situational", r.penalties.situational],
  ];
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    styleName: input.styleName,
    targetName: input.targetName,
    natural: r.naturalD20,
    total: r.total,
    needed: r.needed,
    hit: r.hit,
    breakdown: rows.filter(([, amount]) => amount !== 0).map(([labelKey, amount]) => ({ labelKey, amount })),
    resultKey: r.hit ? "ADND2E.chat.martialArts.hit" : "ADND2E.chat.martialArts.miss",
    blowKey: r.blow ? `ADND2E.martialBlows.${r.blow}` : "",
    damage: r.damage,
    stunTrigger: r.hit && r.stunTrigger,
  };
}

export interface CardEffect {
  id: string;
  labelKey: string;
  saveKey: string;
  saveMod: string;
  condition: string | null;
  rounds: string | null;
  damage: number | null;
  /** applied later (e.g. when a hold ends), not on the hit */
  deferred: boolean;
}

export interface ManeuverCardInput {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  result: ManeuverAttackResult;
  /** the rolled damage total, floored at 0 by the caller; 0 when there is no damage */
  damageTotal: number;
  /** true when the active style has no damage die (weapon-method style); default false */
  styleDieIsNull?: boolean;
  /** the rolled total of the Double Damage alternative, floored at 0 by the caller */
  doubleDamageTotal?: number;
}

export interface ManeuverCardContext {
  actorName: string;
  actorImg: string;
  styleName: string;
  targetName: string | null;
  maneuverKey: string;
  costKey: string;
  natural: number;
  total: number;
  needed: number;
  hit: boolean;
  breakdown: { labelKey: string; amount: number }[];
  resultKey: string;
  outcomeKey: string;
  formula: string;
  damage: number;
  stunTrigger: boolean;
  /** an attack that uses the style die was rolled on a style with none, so the die counted as 0 */
  noStyleDie: boolean;
  /** blank unless the maneuver is a basic attack (Feint), which shows its Table 16 blow */
  blowKey: string;
  /** the effects a hit offers, each with its save line and apply data; empty on a miss or parry */
  effects: CardEffect[];
}

const COST_KEY: Readonly<Record<string, string>> = { "0": "none", "1": "one", "2": "two", round: "round" };

export function buildManeuverCardContext(input: ManeuverCardInput): ManeuverCardContext {
  const r = input.result;
  const def = maneuverById(r.maneuverId)!;
  const rows: [string, number][] = [
    ["ADND2E.chat.martialArts.mod.armor", r.penalties.armor],
    ["ADND2E.chat.martialArts.mod.weaponSize", r.penalties.weaponSize],
    ["ADND2E.chat.martialArts.mod.situational", r.penalties.situational],
    ["ADND2E.chat.martialArts.mod.table21", r.penalties.table21],
    ["ADND2E.chat.martialArts.mod.maneuver", r.maneuverBonus],
  ];
  const parry = def.kind === "parry";
  const effects: CardEffect[] = r.hit
    ? (def.effects ?? []).map((e) => ({
        id: e.id,
        labelKey: `ADND2E.martialEffects.${e.id}`,
        saveKey: e.save === null ? "" : e.save === 0 ? "ADND2E.chat.martialArts.save" : "ADND2E.chat.martialArts.saveAt",
        saveMod: e.save === null || e.save === 0 ? "" : String(e.save),
        condition: e.condition,
        rounds: e.rounds,
        damage: e.doubleDamage === true ? (input.doubleDamageTotal ?? 0) : null,
        deferred: e.deferred === true,
      }))
    : [];
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    styleName: input.styleName,
    targetName: input.targetName,
    maneuverKey: `ADND2E.martialManeuvers.${def.slug}`,
    costKey: `ADND2E.martialManeuverCosts.${COST_KEY[String(def.cost)]}`,
    natural: r.naturalD20,
    total: r.total,
    needed: r.needed,
    hit: r.hit,
    breakdown: rows.filter(([, amount]) => amount !== 0).map(([labelKey, amount]) => ({ labelKey, amount })),
    resultKey: parry
      ? r.hit ? "ADND2E.chat.martialArts.parried" : "ADND2E.chat.martialArts.notParried"
      : r.hit ? "ADND2E.chat.martialArts.hit" : "ADND2E.chat.martialArts.miss",
    outcomeKey: `${r.hit ? "ADND2E.martialManeuverEffects" : "ADND2E.martialManeuverFailures"}.${def.slug}`,
    formula: r.blow ? "" : (r.damageFormula ?? ""),
    damage: r.hit && r.damageFormula !== null ? input.damageTotal : 0,
    stunTrigger: r.hit && r.stunTrigger,
    noStyleDie: def.kind === "attack" && def.ownDie === null && input.styleDieIsNull === true,
    blowKey: r.blow ? `ADND2E.martialBlows.${r.blow}` : "",
    effects,
  };
}

export interface CardLine {
  key: string;
  n1?: number;
  n2?: number;
}

export interface SkillCardContext extends ManeuverCardContext {
  /** extra explanatory lines, rendered as hints with up to two numeric parameters */
  lines: CardLine[];
  /** no d20 was rolled (Levitation): the template hides the roll and result lines */
  noRoll: boolean;
}

export type SkillCardInput = { actorName: string; actorImg: string; styleName: string; maneuverId: string } & (
  | { skill: "leap"; result: LeapResult }
  | { skill: "speed"; result: SpeedResult }
  | { skill: "levitation"; level: number }
);

const PRONE_EFFECT: CardEffect = {
  id: "prone", labelKey: "ADND2E.martialEffects.prone", saveKey: "", saveMod: "", condition: "prone", rounds: null, damage: null, deferred: false,
};

export function buildSkillCardContext(input: SkillCardInput): SkillCardContext {
  const def = maneuverById(input.maneuverId)!;
  const base: SkillCardContext = {
    actorName: input.actorName,
    actorImg: input.actorImg,
    styleName: input.styleName,
    targetName: null,
    maneuverKey: `ADND2E.martialManeuvers.${def.slug}`,
    costKey: `ADND2E.martialManeuverCosts.${COST_KEY[String(def.cost)]}`,
    natural: 0,
    total: 0,
    needed: 0,
    hit: true,
    breakdown: [],
    resultKey: "",
    outcomeKey: "",
    formula: "",
    damage: 0,
    stunTrigger: false,
    noStyleDie: false,
    blowKey: "",
    effects: [],
    lines: [],
    noRoll: false,
  };
  if (input.skill === "leap") {
    const r = input.result;
    return {
      ...base,
      natural: r.naturalD20,
      total: r.total,
      needed: r.needed,
      hit: r.hit,
      resultKey: r.hit ? "ADND2E.chat.martialArts.landed" : "ADND2E.chat.martialArts.fell",
      effects: r.hit ? [] : [PRONE_EFFECT],
      lines: [
        { key: "ADND2E.chat.martialArts.leapStanding", n1: r.standing.up, n2: r.standing.forward },
        { key: "ADND2E.chat.martialArts.leapRunning", n1: r.running.up, n2: r.running.forward },
      ],
    };
  }
  if (input.skill === "speed") {
    const r = input.result;
    return {
      ...base,
      natural: r.naturalD20,
      total: r.naturalD20,
      needed: r.dexterity,
      hit: r.success,
      resultKey: r.success ? "ADND2E.chat.martialArts.speedYes" : "ADND2E.chat.martialArts.speedNo",
      lines: [
        ...(r.success ? [{ key: "ADND2E.chat.martialArts.speedExtra", n1: r.extraAttacks }] : []),
        { key: "ADND2E.chat.martialArts.speedOnce" },
      ],
    };
  }
  const info = levitationInfo(input.level);
  return {
    ...base,
    noRoll: true,
    lines: [
      { key: "ADND2E.chat.martialArts.levitationRate", n1: info.feetPerRound },
      { key: "ADND2E.chat.martialArts.levitationDuration", n1: info.rounds },
      { key: "ADND2E.chat.martialArts.levitationRules" },
    ],
  };
}
