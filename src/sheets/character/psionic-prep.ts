import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { canCompletePrep, prepCompleteRound, preparationRounds } from "../../core/psionics";
import { getOptionalRules } from "../../settings";
import { currentPsp, findPower, info, requirePsionicist, usePower, warn, type PsionicActor, type PsionicItem } from "./psionic-actions";
import { noteInitiation, startedCombatFor } from "./psionic-round";

/* Issue #179: power preparation times in combat (optional rule `psionicPrepTimes`). A power with a preparation time of
 * one or more rounds, used in a started combat, is PREPARED over those rounds; it is rolled and paid for when it is
 * completed, and being hurt or failing a save meanwhile loses the time at no PSP cost (PHBR5 p.20). Writes target the
 * acting actor's own `system.psionics.preparing`. */

export interface Preparing {
  powerId: string;
  combatId: string;
  completeRound: number | null;
  hp: number;
}

export type PrepActor = PsionicActor & {
  id: string;
  system: PsionicActor["system"] & {
    attributes?: { hp?: { value: number } };
    psionics: PsionicActor["system"]["psionics"] & { preparing?: Preparing };
  };
};

const EMPTY: Preparing = { powerId: "", combatId: "", completeRound: null, hp: 0 };

/** The preparation in progress, or null. */
export function readPreparing(actor: { system?: { psionics?: { preparing?: Preparing } } }): Preparing | null {
  const p = actor.system?.psionics?.preparing;
  return p && p.powerId !== "" ? p : null;
}

async function postNotice(actor: PrepActor, powerName: string, key: "begin" | "disrupted" | "cancelled", round: number | null): Promise<void> {
  const text = game.i18n!.format(`ADND2E.chat.psionicPrep.${key}`, { power: powerName, round: String(round ?? "") });
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/psionic-prep.hbs"), {
    actorName: actor.name,
    actorImg: actor.img,
    powerName,
    text,
  });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content, flags: { [SYSTEM_ID]: { psionicPrep: key } } } as never);
}

const hpOf = (actor: PrepActor): number => actor.system.attributes?.hp?.value ?? 0;
const nameOf = (actor: PrepActor, powerId: string): string => findPower(actor, powerId)?.name ?? "-";

/**
 * Uses a power from the sheet. With the rule on, a power that takes one or more rounds to prepare, used in a
 * started combat, begins a preparation instead of resolving; everything else is the ordinary use.
 */
export async function useWithPreparation(actor: PrepActor, powerId: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const power = findPower(actor, powerId);
  if (!power) return;
  const isDefense = power.system.kind === "defense";
  if (!isDefense && readPreparing(actor)) {
    warn("ADND2E.sheet.psionics.prep.already");
    return;
  }
  const rounds = getOptionalRules().psionicPrepTimes && !isDefense ? preparationRounds(String(power.system.preparation ?? "")) : null;
  const found = rounds === null ? null : startedCombatFor(actor);
  if (rounds === null || !found) {
    await usePower(actor, powerId);
    return;
  }
  if (currentPsp(actor) < Number(power.system.initialCost ?? 0)) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  await noteInitiation(actor, power as PsionicItem);
  const completeRound = prepCompleteRound(rounds, found.combat.round);
  await actor.update({ "system.psionics.preparing": { powerId, combatId: found.combat.id, completeRound, hp: hpOf(actor) } });
  await postNotice(actor, power.name, "begin", completeRound);
}

/** Completes the preparation once its last round has been reached: the ordinary check and cost happen now. */
export async function completePreparation(actor: PrepActor): Promise<void> {
  const prep = readPreparing(actor);
  if (!prep) return;
  const found = startedCombatFor(actor);
  if (!found || found.combat.id !== prep.combatId) {
    await actor.update({ "system.psionics.preparing": EMPTY });
    warn("ADND2E.sheet.psionics.prep.gone");
    return;
  }
  if (!canCompletePrep(prep.completeRound, found.combat.round)) {
    info("ADND2E.sheet.psionics.prep.notYet", { round: prep.completeRound ?? 0 });
    return;
  }
  const power = findPower(actor, prep.powerId);
  if (power && currentPsp(actor) < Number(power.system.initialCost ?? 0)) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  await actor.update({ "system.psionics.preparing": EMPTY });
  if (power) await usePower(actor, prep.powerId, undefined, false); // already tallied when it began
}

/** The user gives the preparation up: nothing is spent. */
export async function cancelPreparation(actor: PrepActor): Promise<void> {
  const prep = readPreparing(actor);
  if (!prep) return;
  await actor.update({ "system.psionics.preparing": EMPTY });
  await postNotice(actor, nameOf(actor, prep.powerId), "cancelled", null);
}

const disrupting = new Set<string>();

/** Hit or a failed save while preparing: the time invested is lost and no PSPs are spent (an in-flight guard keeps two simultaneous causes to one notice). */
export async function disruptPreparation(actor: PrepActor, opts: { announce: boolean }): Promise<void> {
  const prep = readPreparing(actor);
  if (!prep || disrupting.has(actor.id)) return;
  disrupting.add(actor.id);
  try {
    await actor.update({ "system.psionics.preparing": EMPTY });
    if (opts.announce) await postNotice(actor, nameOf(actor, prep.powerId), "disrupted", null);
  } finally {
    disrupting.delete(actor.id);
  }
}
