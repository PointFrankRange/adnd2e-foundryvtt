import { TEMPLATE_PATH } from "../../constants";
import {
  blindedAttackPenalty, canAct, entangledAttackPenalty, fatigueArmorClassPenalty, fatigueAttackPenalty, frightenedAttackPenalty,
  heldAttackBonus, invisibleTargetPenalty, isHelpless, proneArmorClassPenalty,
} from "../../combat/condition-effects";
import { buildMartialArtsView, buildMartialCardContext, resolveMartialAttack, type MartialArtsView, type StyleItemLike } from "../../core/martial-arts";
import { themedPrompt } from "../../dialogs/themed-dialog-foundry";
import { getOptionalRules } from "../../settings";
import { resolveTargetArmorType, resolveTargetCombatInfo } from "./combat-rolls";

/* SP18 Plan A — Advanced Martial Arts. Foundry glue only; every decision lives in src/core/martial-arts.
 * Nothing but the active style id is written to the actor: an attack is a roll plus a chat card whose
 * Apply Damage button reuses the generic applyDamage chat action. */

type Statuses = ReadonlySet<string> | readonly string[];

export interface MartialArtsActor {
  name: string;
  img: string;
  statuses: Statuses;
  system: {
    martialArts: { knowsBasics: boolean; activeStyleId: string };
    attributes?: { thac0?: { melee?: number } };
    abilities?: { str?: { mods?: { damageAdj?: number } } };
  };
  items: Iterable<StyleItemLike & { system: Record<string, unknown> }>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

export function martialArtsView(actor: MartialArtsActor): MartialArtsView {
  return buildMartialArtsView({
    enabled: getOptionalRules().advancedMartialArts,
    items: actor.items,
    knowsBasics: actor.system.martialArts.knowsBasics,
    storedActiveId: actor.system.martialArts.activeStyleId,
    canAct: canAct(actor.statuses),
  });
}

/** Choose the style used this round. */
export async function setActiveStyle(actor: MartialArtsActor, itemId: string): Promise<void> {
  if (![...actor.items].some((i) => i.type === "martialStyle" && i.id === itemId)) return;
  await actor.update({ "system.martialArts.activeStyleId": itemId });
}

/** The size ("S"/"M"/"L") of the weapon the target is wielding, or null. */
function wieldedWeaponSize(target: { items: Iterable<{ type: string; system: { equipped?: boolean; size?: string } }> }): string | null {
  const weapon = [...target.items].find((i) => i.type === "weapon" && i.system.equipped === true);
  return weapon?.system.size ?? null;
}

/** Rolls one unarmed attack with the active style against the targeted token (or a typed-in AC) and posts the card. */
export async function rollMartialArtsAttack(actor: MartialArtsActor): Promise<void> {
  const view = martialArtsView(actor);
  if (!view.visible) return;
  if (!view.active) return warn("ADND2E.sheet.martialArts.noActive");
  if (!view.canAct) return warn("ADND2E.chat.attack.cannotActWarning");

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let opponentWeaponSize: string | null = null;
  let targetStatuses: ReadonlySet<string> = new Set<string>();

  if (targets.length === 1) {
    const t = targets[0]!;
    const targetActor = t.actor as Parameters<typeof resolveTargetCombatInfo>[0] & { statuses?: ReadonlySet<string> };
    targetName = t.name;
    targetStatuses = targetActor.statuses ?? new Set<string>();
    targetAc = resolveTargetCombatInfo(targetActor).ac + proneArmorClassPenalty(targetStatuses) + fatigueArmorClassPenalty(targetStatuses);
    opponentWeaponSize = wieldedWeaponSize(targetActor as never);
  } else {
    const manualAc = await themedPrompt({
      window: { title: game.i18n!.localize("ADND2E.chat.attack.manualAcTitle") },
      content: `<p>${game.i18n!.localize(
        targets.length === 0 ? "ADND2E.chat.attack.noTargetHint" : "ADND2E.chat.attack.multiTargetHint",
      )}</p><input type="number" name="ac" value="10" step="1" autofocus>`,
      ok: {
        label: game.i18n!.localize("ADND2E.chat.attack.rollAttack"),
        callback: (_e: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
          const input = button.form?.elements.namedItem("ac");
          return input instanceof HTMLInputElement ? input.valueAsNumber : NaN;
        },
      },
    } as never);
    if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return;
    targetAc = manualAc;
  }

  const roll = await new Roll("1d20").evaluate();
  const result = resolveMartialAttack({
    naturalD20: roll.dice[0]?.total ?? roll.total ?? 1,
    thac0: actor.system.attributes?.thac0?.melee ?? 20,
    targetAc,
    attackerArmorType: resolveTargetArmorType(actor as never),
    opponentWeaponSize,
    situationalModifier:
      blindedAttackPenalty(actor.statuses) +
      fatigueAttackPenalty(actor.statuses) +
      entangledAttackPenalty(actor.statuses) +
      frightenedAttackPenalty(actor.statuses) +
      invisibleTargetPenalty(targetStatuses) +
      heldAttackBonus(targetStatuses),
    strengthDamageAdj: actor.system.abilities?.str?.mods?.damageAdj ?? 0,
    forcedHit: isHelpless(targetStatuses),
  });

  const context = buildMartialCardContext({
    actorName: actor.name, actorImg: actor.img, styleName: view.active.name, targetName, result,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/martial-arts-attack.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}
