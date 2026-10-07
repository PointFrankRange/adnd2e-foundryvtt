import { buildDamageCardContext } from "../combat/damage-card";
import { pickDamageDice } from "../combat/damage-dice";
import { damageModifiers } from "../core/combat/damage";
import { damageFormula } from "../core/dice/formula";
import { SYSTEM_ID, TEMPLATE_PATH } from "../constants";
import { requestApply } from "../relay/relay-client";
import { rerenderContestCards, rerenderWildCards } from "../hooks/psionic-hooks";
import { applyContestTangents, recordButtonState, rollDefense, type ContestFlag } from "../sheets/character/psionic-combat";
import { applyDire, type WildFlag } from "../sheets/character/psionic-wild";
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
  const attacker = foundry.utils.fromUuidSync(contest.attackerActorUuid) as { isOwner?: boolean; getFlag(s: string, k: string): unknown } | null;
  const applied = (attacker?.getFlag(SYSTEM_ID, "psionicApplied") as string[] | undefined) ?? [];
  const state = recordButtonState(contest, applied, attacker !== null && (isGm || Boolean(attacker.isOwner)));
  if (state !== "button") recordButton?.remove();
  if (state === "recorded") {
    const line = document.createElement("p");
    line.className = "hint recorded";
    line.textContent = game.i18n!.localize("ADND2E.chat.psionicContest.recorded");
    html.querySelector(".psionic-contest")?.append(line);
  }
  if (state === "button") {
    recordButton?.addEventListener("click", () => {
      void applyContestTangents(contest).then((wrote) => {
        if (!wrote) ui.notifications?.info(game.i18n!.localize("ADND2E.chat.psionicContest.alreadyRecorded"));
        rerenderContestCards(contest.attackerActorUuid);
      });
    });
  }
}

/** Wild-talent cards (SP15 Plan D): the Apply button is hidden from anyone who is neither the
 *  character's owner nor a GM and from an already-applied card (which shows "Applied." instead);
 *  applyDire re-checks and is authoritative. */
function wildApplyState(flag: WildFlag, applied: string[], viewerMayApply: boolean): "button" | "applied" | "none" {
  if (flag.dire === null) return "none";
  if (applied.includes(flag.id)) return "applied";
  return viewerMayApply ? "button" : "none";
}

function wireWildTalent(message: { id: string; getFlag(s: string, k: string): unknown }, html: HTMLElement): void {
  const flag = message.getFlag(SYSTEM_ID, "wildTalent") as WildFlag | undefined;
  if (!flag) return;
  const button = html.querySelector<HTMLButtonElement>('[data-action="wildApplyDire"]');
  const actor = foundry.utils.fromUuidSync(flag.actorUuid) as { isOwner?: boolean; getFlag(s: string, k: string): unknown } | null;
  const applied = (actor?.getFlag(SYSTEM_ID, "wildApplied") as string[] | undefined) ?? [];
  const state = wildApplyState(flag, applied, actor !== null && (Boolean(game.user?.isGM) || Boolean(actor.isOwner)));
  if (state !== "button") button?.remove();
  if (state === "applied") {
    const line = document.createElement("p");
    line.className = "hint applied";
    line.textContent = game.i18n!.localize("ADND2E.chat.wildTalent.applied");
    html.querySelector(".wild-talent")?.append(line);
  }
  if (state === "button") {
    button?.addEventListener("click", () => {
      button.disabled = true;
      void applyDire(message.id).then(() => rerenderWildCards(flag.actorUuid));
    });
  }
}

/** Wires the "Roll Damage" / "Apply Damage" buttons on SP3's chat cards. Call
 *  once from the `ready` hook. */
export function registerChatListeners(): void {
  Hooks.on("renderChatMessageHTML", (message: unknown, html: HTMLElement) => {
    wirePsionicContest(message as { id: string; getFlag(s: string, k: string): unknown }, html);
    wireWildTalent(message as { id: string; getFlag(s: string, k: string): unknown }, html);
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
