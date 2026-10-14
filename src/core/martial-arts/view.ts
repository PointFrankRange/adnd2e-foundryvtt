// The PC sheet's Martial Arts panel view. Pure: Foundry glue passes plain item data in.
import { resolveActiveStyleId, styleStats, type StyleForm, type StyleMethod } from "./style";
import { MANEUVERS, learnability, type ManeuverCost, type ManeuverDef } from "./maneuvers";
import { chiRank, chiRankLabelKey } from "../enchantment";
import { ironskinAcMod, knownManeuverIds } from "./skills";

export interface StyleItemLike {
  id: string;
  name: string;
  img: string;
  type: string;
  system: {
    form?: string;
    principalMethod?: string;
    slotsInvested?: number;
    availableManeuvers?: { list: string; difficulties: number[] }[];
    knownManeuvers?: { id: string; level: number }[];
  };
}

export interface ManeuverRow {
  id: string;
  nameKey: string;
  listKey: string;
  difficulty: number;
  costKey: string;
  kind: ManeuverDef["kind"];
  state: "known" | "learnable" | "locked";
  /** why a locked maneuver cannot be learned (i18n key); blank otherwise */
  reasonKey: string;
  /** known, on the active style, and the character can act */
  usable: boolean;
  /** i18n key of the maneuver's effect text */
  effectKey: string;
}

const COST_KEY: Readonly<Record<string, string>> = { "0": "none", "1": "one", "2": "two", round: "round" };
const costKey = (cost: ManeuverCost): string => `ADND2E.martialManeuverCosts.${COST_KEY[String(cost)]}`;

export interface StyleRow {
  id: string;
  name: string;
  img: string;
  formKey: string;
  methodKey: string;
  attackFormKey: string;
  acMod: number;
  /** null for a weapon-method style (its weapon's own damage) */
  damageDie: string | null;
  slots: number;
  active: boolean;
  maneuvers: ManeuverRow[];
  /** the learned subset of `maneuvers`, same order */
  knownManeuvers: ManeuverRow[];
  /** known maneuvers that are used (not passive); passives list once in the constants summary */
  usableManeuvers: ManeuverRow[];
}

/** The always-on abilities known on any owned style. */
export interface MartialConstants {
  allAroundSight: boolean;
  mentalResistance: boolean;
  blindFighting: boolean;
  ironskin: boolean;
  /** -2 while Ironskin is known and no body armor is worn; else 0 */
  ironskinAcMod: number;
  /** Ch'i Attacks (mental:4) is known on any owned style */
  chiKnown: boolean;
  /** the unarmed enchantment rank at the character's level; 0 when Ch'i is unknown */
  chiRank: number;
  summary: { nameKey: string; effectKey: string; detailKey?: string }[];
}

export interface MartialArtsView {
  visible: boolean;
  knowsBasics: boolean;
  canAct: boolean;
  canAttack: boolean;
  styles: StyleRow[];
  active: StyleRow | null;
  constants: MartialConstants;
}

export function buildMartialArtsView(input: {
  enabled: boolean;
  items: Iterable<StyleItemLike>;
  knowsBasics: boolean;
  storedActiveId: string;
  canAct: boolean;
  level?: number;
  freeSlots?: number;
  wearingBodyArmor?: boolean;
}): MartialArtsView {
  const owned = [...input.items].filter((i) => i.type === "martialStyle");
  const activeId = resolveActiveStyleId(owned.map((i) => i.id), input.storedActiveId);
  const styles = owned.map((i): StyleRow => {
    const form = i.system.form as StyleForm;
    const method = i.system.principalMethod as StyleMethod;
    const stats = styleStats(form, method);
    const offered = i.system.availableManeuvers ?? [];
    const known = i.system.knownManeuvers ?? [];
    const knownIds = new Set(known.map((k) => k.id));
    const isActive = i.id === activeId;
    const maneuvers = MANEUVERS.filter((m) => knownIds.has(m.id) || offered.some((o) => o.list === m.list && o.difficulties.includes(m.difficulty))).map(
      (m): ManeuverRow => {
        const verdict = learnability({ maneuverId: m.id, offered, known, freeSlots: input.freeSlots ?? 0, level: input.level ?? 0 });
        const isKnown = knownIds.has(m.id);
        return {
          id: m.id,
          nameKey: `ADND2E.martialManeuvers.${m.slug}`,
          listKey: `ADND2E.martialManeuverLists.${m.list}`,
          difficulty: m.difficulty,
          costKey: costKey(m.cost),
          kind: m.kind,
          state: isKnown ? "known" : verdict.ok ? "learnable" : "locked",
          reasonKey: isKnown || verdict.ok ? "" : `ADND2E.sheet.martialArts.locked.${verdict.reason}`,
          effectKey: `ADND2E.martialManeuverEffects.${m.slug}`,
          usable: isKnown && isActive && input.canAct && m.kind !== "passive",
        };
      },
    );
    return {
      id: i.id,
      name: i.name,
      img: i.img,
      formKey: `ADND2E.martialForms.${form}`,
      methodKey: `ADND2E.martialMethods.${method}`,
      attackFormKey: `ADND2E.martialAttackForms.${stats.principalAttack}`,
      acMod: stats.acMod,
      damageDie: stats.damageDie,
      slots: i.system.slotsInvested ?? 1,
      active: i.id === activeId,
      maneuvers,
      knownManeuvers: maneuvers.filter((m) => m.state === "known"),
      usableManeuvers: maneuvers.filter((m) => m.state === "known" && m.kind !== "passive"),
    };
  });
  const active = styles.find((s) => s.active) ?? null;
  const knownIds = knownManeuverIds(owned.map((i) => ({ knownManeuvers: i.system.knownManeuvers })));
  const ironskin = knownIds.has("mental:6");
  const chiKnown = knownIds.has("mental:4");
  const chi = chiKnown ? chiRank(input.level ?? 0) : 0;
  const constants: MartialConstants = {
    allAroundSight: knownIds.has("mental:2"),
    mentalResistance: knownIds.has("mental:3"),
    blindFighting: knownIds.has("mental:5"),
    ironskin,
    ironskinAcMod: ironskinAcMod(ironskin, input.wearingBodyArmor ?? false),
    chiKnown,
    chiRank: chi,
    summary: MANEUVERS.filter((m) => m.kind === "passive" && knownIds.has(m.id)).map((m) => ({
      nameKey: `ADND2E.martialManeuvers.${m.slug}`,
      effectKey: `ADND2E.martialManeuverEffects.${m.slug}`,
      ...(m.slug === "chiAttacks" ? { detailKey: chiRankLabelKey(chi) } : {}),
    })),
  };
  return {
    visible: input.enabled,
    knowsBasics: input.knowsBasics,
    canAct: input.canAct,
    canAttack: input.canAct && active !== null,
    styles,
    active,
    constants,
  };
}
