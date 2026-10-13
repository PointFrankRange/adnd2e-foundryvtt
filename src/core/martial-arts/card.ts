// Chat-card context for a martial arts attack (SP18). Pure.
import type { MartialAttackResult } from "./attack";
import type { ManeuverAttackResult } from "./maneuver-attack";
import { maneuverById } from "./maneuvers";

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
  /** always blank: a maneuver is the result, so the Table 16 blow line is not shown */
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
    formula: r.damageFormula ?? "",
    damage: r.hit && r.damageFormula !== null ? input.damageTotal : 0,
    stunTrigger: r.hit && r.stunTrigger,
    noStyleDie: def.kind === "attack" && def.ownDie === null && input.styleDieIsNull === true,
    blowKey: "",
    effects,
  };
}
