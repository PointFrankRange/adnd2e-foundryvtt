// The PC sheet's Martial Arts panel view. Pure: Foundry glue passes plain item data in.
import { resolveActiveStyleId, styleStats, type StyleForm, type StyleMethod } from "./style";
import { MANEUVERS, learnability, type ManeuverCost, type ManeuverDef } from "./maneuvers";

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
}

export interface MartialArtsView {
  visible: boolean;
  knowsBasics: boolean;
  canAct: boolean;
  canAttack: boolean;
  styles: StyleRow[];
  active: StyleRow | null;
}

export function buildMartialArtsView(input: {
  enabled: boolean;
  items: Iterable<StyleItemLike>;
  knowsBasics: boolean;
  storedActiveId: string;
  canAct: boolean;
  level?: number;
  freeSlots?: number;
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
    };
  });
  const active = styles.find((s) => s.active) ?? null;
  return {
    visible: input.enabled,
    knowsBasics: input.knowsBasics,
    canAct: input.canAct,
    canAttack: input.canAct && active !== null,
    styles,
    active,
  };
}
