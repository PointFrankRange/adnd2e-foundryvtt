import { buildDamageCardContext } from "../combat/damage-card";
import { pickDamageDice } from "../combat/damage-dice";
import { damageModifiers } from "../core/combat/damage";
import { damageFormula } from "../core/dice/formula";
import { SYSTEM_ID, TEMPLATE_PATH } from "../constants";
import { requestApply } from "../relay/relay-client";
import { applyContestTangents, rollDefense, type ContestFlag } from "../sheets/character/psionic-combat";
import type { EffectTarget } from "../relay/apply-effect";

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
  const { actorUuid, weaponItemId, ammoItemId, targetSize, backstabMultiplier, critMultiplier, critFlatBonus, specializationBonus } = button.dataset as {
    actorUuid?: string;
    weaponItemId?: string;
    ammoItemId?: string;
    targetSize?: string;
    backstabMultiplier?: string;
    critMultiplier?: string;
    critFlatBonus?: string;
    specializationBonus?: string;
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
  // A bow/crossbow's own damage dice are null — the ammo item consumed for
  // this shot (attack card's damageContext.ammoItemId, Task 5) carries the
  // real dice instead. Melee/thrown weapons have no ammoItemId and are
  // unaffected (docs/superpowers/specs/2026-09-28-adnd2e-ammunition-design.md).
  const ammo = ammoItemId ? actor.items.get(ammoItemId) : undefined;
  const diceSource = ammo ?? weapon;
  const dice = pickDamageDice(
    { damageVsSM: diceSource.system.damageVsSM, damageVsL: diceSource.system.damageVsL },
    (targetSize as never) || null,
  );
  if (!dice) return; // no dice modeled (no ammo item resolved for a bow/crossbow)

  const { total: damageBonus } = damageModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    specializationBonus: specializationBonus ? Number(specializationBonus) : 0,
  });
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
    critMultiplier: critMultiplier ? Number(critMultiplier) : null,
    critFlatBonus: critFlatBonus ? Number(critFlatBonus) : 0,
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
  for (const t of targets) {
    const actor = t.actor as (EffectTarget & { uuid: string; isOwner: boolean }) | null;
    if (!actor) continue;
    await requestApply(actor, { kind: "damage", targetUuid: actor.uuid, amount });
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
  for (const t of targets) {
    const actor = t.actor as (EffectTarget & { uuid: string; isOwner: boolean }) | null;
    if (!actor) continue;
    await requestApply(actor, { kind: kind === "healing" ? "healing" : "damage", targetUuid: actor.uuid, amount: signedAmount });
  }
}

/** Psionic contest cards (SP15 Plan C): the defender's Roll defense button is hidden from
 *  anyone who is not a GM or an owner of the target actor (rollDefense re-checks and is
 *  authoritative); the Record tangent button is hidden from non-owners of the attacker. */
function wirePsionicContest(message: { id: string; getFlag(s: string, k: string): unknown }, html: HTMLElement): void {
  const contest = message.getFlag(SYSTEM_ID, "psionicContest") as ContestFlag | undefined;
  if (!contest) return;
  const isGm = Boolean(game.user?.isGM);
  const isOwner = (uuid: string): boolean => Boolean((foundry.utils.fromUuidSync(uuid) as { isOwner?: boolean } | null)?.isOwner);
  const rollButton = html.querySelector<HTMLButtonElement>('[data-action="psionicRollDefense"]');
  if (rollButton) {
    if (isGm || isOwner(contest.targetActorUuid)) rollButton.addEventListener("click", () => {
        rollButton.disabled = true;
        void rollDefense(message.id);
      });
    else rollButton.remove();
  }
  const recordButton = html.querySelector<HTMLButtonElement>('[data-action="psionicRecordTangent"]');
  if (recordButton) {
    if (isGm || isOwner(contest.attackerActorUuid)) {
      recordButton.addEventListener("click", () => {
        void applyContestTangents(contest).then((wrote) => {
          if (!wrote) ui.notifications?.info(game.i18n!.localize("ADND2E.chat.psionicContest.alreadyRecorded"));
        });
      });
    } else recordButton.remove();
  }
}

/** Wires the "Roll Damage" / "Apply Damage" buttons on SP3's chat cards. Call
 *  once from the `ready` hook. */
export function registerChatListeners(): void {
  Hooks.on("renderChatMessageHTML", (message: unknown, html: HTMLElement) => {
    wirePsionicContest(message as { id: string; getFlag(s: string, k: string): unknown }, html);
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
