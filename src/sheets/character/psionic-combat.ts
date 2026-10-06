import { breakTangents, endContact, isDefenseMode, upkeepDue } from "../../core/psionics/combat";
import { currentPsp, findPower, info, requirePsionicist, warn, type PsionicActor } from "./psionic-actions";

/* SP15 Plan C - psionic combat state actions (active defense, upkeep, contacts).
 * Foundry glue only; every write targets the acting actor's own `system.psionics`. */

/** Raises a defense mode: pays its initial cost and marks it active. */
export async function raiseDefense(actor: PsionicActor, powerId: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const power = findPower(actor, powerId);
  if (!power || power.system.kind !== "defense" || !isDefenseMode(power.name)) return;
  if (actor.system.psionics.activeDefense === powerId) {
    info("ADND2E.sheet.psionics.combat.alreadyRaised");
    return;
  }
  const cost = Number(power.system.initialCost ?? 0);
  const pool = currentPsp(actor);
  if (pool < cost) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  await actor.update({ "system.psionics.psp": pool - cost, "system.psionics.activeDefense": powerId });
}

/** Drops the raised defense mode (no cost). */
export async function dropDefense(actor: PsionicActor): Promise<void> {
  if (!requirePsionicist(actor)) return;
  if (actor.system.psionics.activeDefense === "") return;
  await actor.update({ "system.psionics.activeDefense": "" });
}

/** Pays one PSP to hold the partial tangents for a round; with none to spend they break. */
export async function payUpkeep(actor: PsionicActor): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const contacts = actor.system.psionics.contacts;
  if (upkeepDue(contacts) === 0) {
    info("ADND2E.sheet.psionics.combat.noUpkeep");
    return;
  }
  const pool = currentPsp(actor);
  if (pool >= 1) {
    await actor.update({ "system.psionics.psp": pool - 1 });
    return;
  }
  warn("ADND2E.sheet.psionics.combat.tangentsBroken");
  await actor.update({ "system.psionics.contacts": breakTangents(contacts) });
}

/** Ends the contact with one target. */
export async function endContactAction(actor: PsionicActor, target: string): Promise<void> {
  if (!requirePsionicist(actor)) return;
  await actor.update({ "system.psionics.contacts": endContact(actor.system.psionics.contacts, target) });
}
