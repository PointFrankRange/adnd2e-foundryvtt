import { buildDamageCardContext } from "../combat/damage-card";
import { pickDamageDice } from "../combat/damage-dice";
import { damageModifiers } from "../core/combat/damage";
import { damageFormula } from "../core/dice/formula";
import { TEMPLATE_PATH } from "../constants";

/* ---------------------------------------------------------------------------
 * chat-listeners — SP3 Task 6.
 *
 * Wires the "Roll Damage" / "Apply Damage" buttons rendered into SP3's chat
 * cards (templates/chat/*.hbs). Not unit-tested (spec §9), verified in a
 * linked dev world. All math and chat-card shaping is delegated to the pure
 * core/combat, core/dice, and combat/*-card modules; this file only reads
 * documents, rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

async function onRollDamage(button: HTMLButtonElement): Promise<void> {
  const { actorUuid, weaponItemId, targetSize, backstabMultiplier } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    targetSize?: string;
    backstabMultiplier?: string;
  };
  const actor = (fromUuidSync as (uuid: string) => unknown)(actorUuid ?? "") as {
    name: string;
    img: string;
    items: {
      get(id: string):
        | { name: string; system: { damageVsSM: string | null; damageVsL: string | null; magicBonus: number } }
        | undefined;
    };
  } | null;
  const weapon = actor?.items.get(weaponItemId ?? "");
  if (!actor || !weapon) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.sourceNotFoundWarning"));
    return;
  }
  const dice = pickDamageDice(
    { damageVsSM: weapon.system.damageVsSM, damageVsL: weapon.system.damageVsL },
    (targetSize as never) || null,
  );
  if (!dice) return; // no dice modeled (e.g. a ranged weapon with no ammo item — spec §7)

  const { total: damageBonus } = damageModifiers({ weaponMagicBonus: weapon.system.magicBonus });
  const formula = damageFormula(dice, damageBonus);
  const roll = await new Roll(formula).evaluate();
  const rolledBaseDamage = (roll.total ?? 0) - damageBonus;

  const context = buildDamageCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    weaponName: weapon.name,
    formula,
    rolledBaseDamage,
    damageBonus,
    backstabMultiplier: backstabMultiplier ? Number(backstabMultiplier) : null,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/damage-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content });
}

async function onApplyDamage(button: HTMLButtonElement): Promise<void> {
  const amount = Number(button.dataset.amount ?? 0);
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: unknown }> } }).user.targets];
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.noTargetsWarning"));
    return;
  }
  const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
  for (const t of targets) {
    const actor = t.actor as {
      isOwner: boolean;
      system: { attributes: { hp: { value: number; temp?: number } } };
      update(data: Record<string, unknown>): Promise<unknown>;
    } | null;
    if (!actor) continue;
    if (!isGM && !actor.isOwner) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.notOwnerWarning"));
      continue;
    }
    const hp = actor.system.attributes.hp;
    const temp = hp.temp ?? 0;
    const fromTemp = Math.min(temp, amount);
    const fromValue = amount - fromTemp;
    const update: Record<string, unknown> = { "system.attributes.hp.value": hp.value - fromValue };
    if ("temp" in hp) update["system.attributes.hp.temp"] = temp - fromTemp;
    await actor.update(update);
  }
}

/** Applies a cast spell's rolled damage or healing to every currently
 *  targeted token. A NEW, separate action from SP3's applyDamage (which
 *  always subtracts an unsigned amount and MUST NOT change behavior for
 *  chat cards already posted before this plan) — this handler branches on
 *  an explicit data-kind attribute instead of a signed amount. */
async function onApplyCastEffect(button: HTMLButtonElement): Promise<void> {
  const { amount, kind } = button.dataset as { amount?: string; kind?: string };
  const signedAmount = Number(amount ?? 0);
  const targets = [...(game as unknown as { user: { targets: Iterable<{ actor: unknown }> } }).user.targets];
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.noTargetsWarning"));
    return;
  }
  const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
  for (const t of targets) {
    const actor = t.actor as {
      isOwner: boolean;
      system: { attributes: { hp: { value: number; max: number; temp?: number } } };
      update(data: Record<string, unknown>): Promise<unknown>;
    } | null;
    if (!actor) continue;
    if (!isGM && !actor.isOwner) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.damage.notOwnerWarning"));
      continue;
    }
    const hp = actor.system.attributes.hp;
    if (kind === "healing") {
      await actor.update({ "system.attributes.hp.value": Math.min(hp.max, hp.value + signedAmount) });
      continue;
    }
    const temp = hp.temp ?? 0;
    const fromTemp = Math.min(temp, signedAmount);
    const fromValue = signedAmount - fromTemp;
    const update: Record<string, unknown> = { "system.attributes.hp.value": hp.value - fromValue };
    if ("temp" in hp) update["system.attributes.hp.temp"] = temp - fromTemp;
    await actor.update(update);
  }
}

/** Wires the "Roll Damage" / "Apply Damage" buttons on SP3's chat cards. Call
 *  once from the `ready` hook. */
export function registerChatListeners(): void {
  Hooks.on("renderChatMessageHTML", (_message: unknown, html: HTMLElement) => {
    html.querySelector<HTMLButtonElement>('[data-action="rollDamage"]')?.addEventListener("click", (ev) => {
      void onRollDamage(ev.currentTarget as HTMLButtonElement);
    });
    html.querySelector<HTMLButtonElement>('[data-action="applyDamage"]')?.addEventListener("click", (ev) => {
      void onApplyDamage(ev.currentTarget as HTMLButtonElement);
    });
    html.querySelector<HTMLButtonElement>('[data-action="applyCastEffect"]')?.addEventListener("click", (ev) => {
      void onApplyCastEffect(ev.currentTarget as HTMLButtonElement);
    });
  });
}
