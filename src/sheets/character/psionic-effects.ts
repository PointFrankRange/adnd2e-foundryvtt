import { TEMPLATE_PATH } from "../../constants";
import { checkCost, powerScore, rollPowerCheck } from "../../core/psionics";
import { effectLines, effectPlan, failureNote, type EffectOutcome } from "../../core/psionics/effects";
import { armorPenaltyOf, currentPsp, warn, type PsionicActor, type PsionicItem, type PsionicRoll } from "./psionic-actions";
import { noteInitiation } from "./psionic-round";

/* Issue #180: an attack mode against a mind the attacker already holds FULL contact with. The mind is open, so there is
 * no defense to resist: one power check at the full cost, and a success has the mode's effect on the target (PHBR5 ch.7).
 * Nothing is applied to the target here - the card states the result; the GM or owner applies it. */

export interface EffectTarget {
  uuid: string;
  name: string;
  actor: {
    items: Iterable<PsionicItem>;
    system: { attributes?: { hp?: { value: number } }; saves?: { ppd?: { rollModifier?: number } } };
  };
}

export interface EffectDeps {
  roll: PsionicRoll;
  /** rolls a dice formula (e.g. "2d6") and returns the total */
  rollDice: (formula: string) => Promise<number>;
  /** rolls the target's save vs paralyzation/poison/death and returns whether it succeeded; null = the target has no save to roll */
  rollSave: (target: EffectTarget["actor"]) => Promise<boolean | null>;
  /** the attacker's PSP write (serialized with the contacts writes by the caller) */
  writePsp: (remaining: number) => Promise<unknown>;
}

export const defaultRollDice = async (formula: string): Promise<number> => (await new Roll(formula).evaluate()).total;

export const defaultRollSave = async (target: EffectTarget["actor"]): Promise<boolean | null> => {
  if (typeof target.system.saves?.ppd?.rollModifier !== "number") return null;
  const { rollSave } = await import("./combat-rolls");
  return rollSave(target as never, "ppd");
};

export async function contactedAttack(actor: PsionicActor, power: PsionicItem, target: EffectTarget, deps: EffectDeps): Promise<void> {
  const cost = Number(power.system.initialCost ?? 0);
  const pool = currentPsp(actor);
  if (pool < cost) {
    warn("ADND2E.sheet.psionics.notEnoughPsp");
    return;
  }
  await noteInitiation(actor, power);
  const score = powerScore(
    actor.system.abilities[String(power.system.abilityKey)]?.score ?? 0,
    Number(power.system.abilityModifier ?? 0) + Number(power.system.scoreBonus ?? 0) + armorPenaltyOf(actor),
  );
  const natural = await deps.roll();
  const check = rollPowerCheck(natural, score);
  const paid = checkCost(cost, check.success);
  const remaining = pool - paid;
  await deps.writePsp(remaining);

  const i18n = game.i18n!;
  const plan = effectPlan(power.name, { success: check.success, special: check.special, natural20: natural === 20 });
  const lines: string[] = [];
  if (plan) {
    const outcome: EffectOutcome = { saveFailed: null, duration: null, damage: null, lostPower: null, hp: target.actor.system.attributes?.hp?.value ?? null };
    if (plan.save) {
      if (plan.save.autoFail) outcome.saveFailed = true;
      else {
        const saved = await deps.rollSave(target.actor);
        outcome.saveFailed = saved === null ? null : !saved;
      }
    }
    const rollsDamage = plan.kind === "crush" && outcome.saveFailed === true;
    if (plan.duration) outcome.duration = await deps.rollDice(plan.duration.dice);
    if (rollsDamage && plan.damageDice) outcome.damage = await deps.rollDice(plan.damageDice);
    if (plan.kind === "losePower") {
      const powers = [...target.actor.items].filter((i) => i.type === "power");
      if (powers.length > 0) outcome.lostPower = powers[(await deps.rollDice(`1d${powers.length}`)) - 1]?.name ?? null;
    }
    for (const l of effectLines(plan, outcome)) lines.push(i18n.format(`ADND2E.chat.psionicEffect.${l.key}`, Object.fromEntries(Object.entries(l.params).map(([k, v]) => [k, String(v)]))));
  }
  const noteKey = failureNote(power.name, natural === 20);
  const context = {
    attackerName: actor.name,
    attackerImg: actor.img,
    targetName: target.name,
    powerName: power.name,
    roll: natural,
    score,
    resultKey: `ADND2E.chat.psionic.result.${check.result}`,
    success: check.success,
    lines,
    note: noteKey ? i18n.localize(`ADND2E.chat.psionicEffect.${noteKey}`) : "",
    paid,
    remaining,
    max: actor.system.psionics.max,
  };
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/psionic-effect.hbs"), context);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}
