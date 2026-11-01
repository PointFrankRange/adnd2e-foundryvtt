import type { Contact } from "../../core/psionics/combat";
import { knownPsionicProficiencies } from "../../core/psionics/proficiency";
import { equippedArmorPenalty } from "../../data/derive/character/psionics";
import type { PsionicPowerItem, PsionicsInput } from "./context-types";
import { adjustPsp, endPower, payMaintenance, relearnPower, rest as psionicRest, usePower as usePsionicPower } from "./psionic-actions";
import { endFocus, endHarness, harnessSubconscious, meditativeFocus } from "./psionic-proficiencies";
import { attackMode, dropDefense, endContactAction, payUpkeep, raiseDefense } from "./psionic-combat";

/* Issue #177: the Psionics tab wiring shared by the PC sheet and the Character NPC sheet,
 * so the two cannot drift (the input builder and the action handlers live here once). */

type ActorLike = {
  system: {
    psionics?: { psp: number | null; max: number; level: number; wild?: boolean; maintained: { powerId: string }[]; activeDefense?: string; contacts?: Contact[]; harness?: { bonus: number }; focus?: { discipline: string } };
    abilities: Record<string, { score: number }>;
  };
};
type ItemLike = { id: string; name: string; type: string; system: unknown };

/** True while the derived psionic level is above 0 (an active psionicist class, or a found wild talent). */
export function hasPsionics(actor: ActorLike): boolean {
  return (actor.system.psionics?.level ?? 0) > 0;
}

/** The Psionics tab's input, or null when the actor has no psionics. `armorRuleOn` is the Table 9 setting. */
export function buildPsionicsInput(actor: ActorLike, items: readonly ItemLike[], armorRuleOn: boolean): PsionicsInput | null {
  const p = actor.system.psionics;
  if (!p || !hasPsionics(actor)) return null;
  return {
    psp: p.psp,
    max: p.max,
    level: p.level,
    wild: p.wild ?? false,
    maintained: p.maintained,
    activeDefense: p.activeDefense ?? "",
    contacts: p.contacts ?? [],
    abilityScores: Object.fromEntries(Object.entries(actor.system.abilities).map(([k, v]) => [k, v.score])),
    armorPenalty: equippedArmorPenalty(items, armorRuleOn && !p.wild),
    focusDiscipline: p.focus?.discipline ?? "",
    harnessBonus: p.harness?.bonus ?? 0,
    proficiencies: knownPsionicProficiencies(items.filter((i) => i.type === "nonweaponProficiency").map((i) => i.name)),
    powers: items.filter((i) => i.type === "power").map((i) => ({ id: i.id, name: i.name, ...(i.system as Omit<PsionicPowerItem, "id" | "name">) })),
  };
}

/** What a sheet must expose for the action handlers (structural, so this module needs no DOM lib). */
export interface PsionicSheet {
  document: unknown;
  element: { querySelector(selector: string): { value: string } | null };
  isEditable: boolean;
}

/** The clicked control: only its data-* attributes are read. */
type Target = { dataset: Record<string, string | undefined> };

type Handler = (sheet: PsionicSheet, target: Target) => Promise<void>;

const actor = (s: PsionicSheet): never => s.document as never;

/** The psionic action ids (data-action values) -> handlers; both sheets register these verbatim. Wild-talent actions stay PC-only. */
export const PSIONIC_ACTIONS: Record<string, Handler> = {
  usePsionicPower: async (s, t) => {
    const { powerId } = t.dataset;
    if (powerId && s.isEditable) await usePsionicPower(actor(s), powerId);
  },
  relearnPsionicPower: async (s, t) => {
    const { powerId } = t.dataset;
    if (powerId && s.isEditable) await relearnPower(actor(s), powerId);
  },
  psionicRest: async (s) => {
    if (!s.isEditable) return;
    const activity = s.element.querySelector("[data-psionic-activity]")?.value ?? "rest";
    const hours = Math.max(0, Math.floor(Number(s.element.querySelector("[data-psionic-hours]")?.value) || 0));
    if (hours > 0) await psionicRest(actor(s), activity as never, hours);
  },
  adjustPsionicPsp: async (s) => {
    if (!s.isEditable) return;
    const input = s.element.querySelector("[data-psionic-adjust]");
    const delta = Number(input?.value);
    if (Number.isInteger(delta) && delta !== 0) {
      await adjustPsp(actor(s), delta);
      if (input) input.value = "";
    }
  },
  payPsionicMaintenance: async (s, t) => {
    // no data-power-id = pay every maintained power
    if (s.isEditable) await payMaintenance(actor(s), t.dataset.powerId ?? null);
  },
  endPsionicPower: async (s, t) => {
    const { powerId } = t.dataset;
    if (powerId && s.isEditable) await endPower(actor(s), powerId);
  },
  psionicRaiseDefense: async (s) => {
    if (!s.isEditable) return;
    const id = s.element.querySelector("[data-psionic-defense]")?.value;
    if (id) await raiseDefense(actor(s), id);
  },
  psionicDropDefense: async (s) => {
    if (s.isEditable) await dropDefense(actor(s));
  },
  psionicAttack: async (s, t) => {
    const { powerId } = t.dataset;
    if (powerId && s.isEditable) await attackMode(actor(s), powerId);
  },
  psionicPayUpkeep: async (s) => {
    if (s.isEditable) await payUpkeep(actor(s));
  },
  psionicHarness: async (s) => {
    if (s.isEditable) await harnessSubconscious(actor(s));
  },
  psionicEndHarness: async (s) => {
    if (s.isEditable) await endHarness(actor(s));
  },
  psionicFocus: async (s) => {
    if (!s.isEditable) return;
    const discipline = s.element.querySelector("[data-psionic-focus]")?.value;
    if (discipline) await meditativeFocus(actor(s), discipline);
  },
  psionicEndFocus: async (s) => {
    if (s.isEditable) await endFocus(actor(s));
  },
  psionicEndContact: async (s, t) => {
    const { target: contact } = t.dataset;
    if (contact && s.isEditable) await endContactAction(actor(s), contact);
  },
};

/** The `actions` entries for ApplicationV2: each handler runs with `this` = the sheet. */
export function psionicActionHandlers(): Record<string, (this: PsionicSheet, event: unknown, target: Target) => Promise<void>> {
  return Object.fromEntries(
    Object.entries(PSIONIC_ACTIONS).map(([id, handler]) => [
      id,
      function (this: PsionicSheet, _event: unknown, target: Target): Promise<void> {
        return handler(this, target);
      },
    ]),
  );
}
