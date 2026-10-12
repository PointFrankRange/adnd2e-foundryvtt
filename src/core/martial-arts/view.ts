// The PC sheet's Martial Arts panel view. Pure: Foundry glue passes plain item data in.
import { resolveActiveStyleId, styleStats, type StyleForm, type StyleMethod } from "./style";

export interface StyleItemLike {
  id: string;
  name: string;
  img: string;
  type: string;
  system: { form?: string; principalMethod?: string; slotsInvested?: number };
}

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
}): MartialArtsView {
  const owned = [...input.items].filter((i) => i.type === "martialStyle");
  const activeId = resolveActiveStyleId(owned.map((i) => i.id), input.storedActiveId);
  const styles = owned.map((i): StyleRow => {
    const form = i.system.form as StyleForm;
    const method = i.system.principalMethod as StyleMethod;
    const stats = styleStats(form, method);
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
