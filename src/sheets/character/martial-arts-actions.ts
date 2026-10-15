import { TEMPLATE_PATH } from "../../constants";
import {
  blindedAttackPenalty, canAct, entangledAttackPenalty, fatigueArmorClassPenalty, fatigueAttackPenalty, frightenedAttackPenalty,
  heldAttackBonus, invisibleTargetPenalty, isHelpless, proneArmorClassPenalty,
} from "../../combat/condition-effects";
import {
  armorGroupOf, conditionModifiers, buildMartialArtsView, buildMartialCardContext, buildManeuverCardContext, buildSkillCardContext,
  groupLearnability, learnability, maneuverById, offeredGroupIds, unlearnGroupUpdate, resolveLeap, resolveManeuverAttack, resolveMartialAttack, resolveSpeed, unlearnUpdate, type ArmorGroup, type MartialArtsView,
  type StyleItemLike,
} from "../../core/martial-arts";
import { attackRank, canHarm, requirementLabelKey } from "../../core/enchantment";
import { themedConfirm, themedPrompt } from "../../dialogs/themed-dialog-foundry";
import { getOptionalRules } from "../../settings";
import { resolveTargetArmorType, resolveTargetCombatInfo } from "./combat-rolls";

/* SP18 — Advanced Martial Arts. Foundry glue only; every decision lives in src/core/martial-arts.
 * Writes: the active style id (Plan A) and, when a maneuver is learned, that style item's knownManeuvers and
 * slotsInvested. An attack is a roll plus a chat card whose Apply Damage button reuses the generic applyDamage
 * chat action. */

type Statuses = ReadonlySet<string> | readonly string[];

type OwnedItem = StyleItemLike & { system: Record<string, unknown>; update?(data: Record<string, unknown>): Promise<unknown> };

export interface MartialArtsActor {
  name: string;
  img: string;
  statuses: Statuses;
  system: {
    martialArts: { knowsBasics: boolean; activeStyleId: string };
    attributes?: { thac0?: { melee?: number } };
    abilities?: { str?: { mods?: { damageAdj?: number } }; dex?: { score?: number } };
    /** derived class entries (Plan B1: the character's level is the highest) */
    classes?: { level: number }[];
    proficiencies?: { weapon?: { available?: number } };
  };
  items: Iterable<OwnedItem>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

const characterLevel = (actor: MartialArtsActor): number => Math.max(0, ...(actor.system.classes ?? []).map((c) => c.level));
const freeWeaponSlots = (actor: MartialArtsActor): number => actor.system.proficiencies?.weapon?.available ?? 0;

export function martialArtsView(actor: MartialArtsActor): MartialArtsView {
  return buildMartialArtsView({
    enabled: getOptionalRules().advancedMartialArts,
    items: actor.items,
    knowsBasics: actor.system.martialArts.knowsBasics,
    storedActiveId: actor.system.martialArts.activeStyleId,
    canAct: canAct(actor.statuses),
    level: characterLevel(actor),
    freeSlots: freeWeaponSlots(actor),
    wearingBodyArmor: [...actor.items].some((i) => i.type === "armor" && i.system.equipped === true && i.system.isShield !== true),
  });
}

/** Choose the style used this round. */
export async function setActiveStyle(actor: MartialArtsActor, itemId: string): Promise<void> {
  if (![...actor.items].some((i) => i.type === "martialStyle" && i.id === itemId)) return;
  await actor.update({ "system.martialArts.activeStyleId": itemId });
}

/** Learn a special maneuver on an owned style: re-validated here (the DOM is never trusted), then 1 slot is spent. */
export async function learnManeuver(actor: MartialArtsActor, styleId: string, maneuverId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as {
    availableManeuvers?: { list: string; difficulties: number[] }[];
    knownManeuvers?: { id: string; level: number }[];
    knownWeaponGroups?: { id: string; level: number }[];
    slotsInvested?: number;
  };
  const known = sys.knownManeuvers ?? [];
  const level = characterLevel(actor);
  if (level < 1) return warn("ADND2E.sheet.martialArts.locked.noLevel");
  const verdict = learnability({ maneuverId, offered: sys.availableManeuvers ?? [], known, freeSlots: freeWeaponSlots(actor), level,
    groupsAtLevel: (sys.knownWeaponGroups ?? []).filter((g) => g.level === level).length,
  });
  if (!verdict.ok) return warn(`ADND2E.sheet.martialArts.locked.${verdict.reason}`);
  await item.update({
    "system.knownManeuvers": [...known.map((k) => ({ id: k.id, level: k.level })), { id: maneuverId, level }],
    "system.slotsInvested": (sys.slotsInvested ?? 1) + 1,
  });
}

/** Unlearn a known maneuver on an owned style after a confirmation; the weapon proficiency slot is refunded. */
export async function unlearnManeuver(actor: MartialArtsActor, styleId: string, maneuverId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as { knownManeuvers?: { id: string; level: number }[]; slotsInvested?: number };
  const change = unlearnUpdate({ known: sys.knownManeuvers ?? [], maneuverId, slotsInvested: sys.slotsInvested ?? 1 });
  if (!change) return;
  const slug = maneuverById(maneuverId)?.slug ?? "";
  const confirmed = await themedConfirm({
    window: { title: game.i18n!.localize("ADND2E.sheet.martialArts.unlearnTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheet.martialArts.unlearnConfirm", {
      name: foundry.utils.escapeHTML(game.i18n!.localize(`ADND2E.martialManeuvers.${slug}`)),
    })}</p>`,
  } as never);
  if (confirmed !== true) return;
  await item.update({ "system.knownManeuvers": change.knownManeuvers, "system.slotsInvested": change.slotsInvested });
}

/** The size ("S"/"M"/"L") of the weapon the target is wielding, or null (a missing size means no penalty). */
function wieldedWeaponSize(target: { items: Iterable<{ type: string; system: { equipped?: boolean; size?: string } }> }): string | null {
  const weapon = [...target.items].find((i) => i.type === "weapon" && i.system.equipped === true);
  return weapon?.system.size ?? null;
}

interface TargetInfo {
  targetName: string | null;
  targetAc: number;
  opponentWeaponSize: string | null;
  targetStatuses: ReadonlySet<string>;
  targetArmorGroup: ArmorGroup;
  /** the target's enchantment requirement id; "" when none */
  hitRequirement: string;
}

/** The "no effect" marker for a hit below the target's requirement. Unarmed rank comes from Ch'i only. */
function ineffectiveFor(target: TargetInfo, chiLevel: number | null, hit: boolean): { requirementKey: string } | null {
  return hit && !canHarm(attackRank({ chiLevel }), target.hitRequirement) ? { requirementKey: requirementLabelKey(target.hitRequirement) } : null;
}

/** The targeted token's numbers, or a typed-in AC when zero or several tokens are targeted; null when cancelled. */
async function resolveTarget(): Promise<TargetInfo | null> {
  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  if (targets.length === 1) {
    const t = targets[0]!;
    const targetActor = t.actor as Parameters<typeof resolveTargetCombatInfo>[0] & { statuses?: ReadonlySet<string> };
    const targetStatuses = targetActor.statuses ?? new Set<string>();
    const info = resolveTargetCombatInfo(targetActor);
    // Table 21's "monsters": a creature with AC 7 or better has a tough hide
    const toughMonster = targetActor.type === "creature" && info.ac <= 7;
    return {
      targetName: t.name,
      targetAc: info.ac + proneArmorClassPenalty(targetStatuses) + fatigueArmorClassPenalty(targetStatuses),
      opponentWeaponSize: wieldedWeaponSize(targetActor as never),
      targetStatuses,
      targetArmorGroup: armorGroupOf(resolveTargetArmorType(targetActor as never), toughMonster),
      hitRequirement: info.hitRequirement,
    };
  }
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
  if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return null;
  return { targetName: null, targetAc: manualAc, opponentWeaponSize: null, targetStatuses: new Set<string>(), targetArmorGroup: "none", hitRequirement: "" };
}

/** The condition modifiers on the attack roll (the same set the weapon attack uses), itemized for the card. */
function situational(actor: MartialArtsActor, targetStatuses: ReadonlySet<string>, blindFighting = false): { total: number; rows: { labelKey: string; amount: number }[] } {
  return conditionModifiers({
    blinded: blindedAttackPenalty(actor.statuses),
    invisibleTarget: invisibleTargetPenalty(targetStatuses),
    fatigue: fatigueAttackPenalty(actor.statuses),
    entangled: entangledAttackPenalty(actor.statuses),
    frightened: frightenedAttackPenalty(actor.statuses),
    heldTarget: heldAttackBonus(targetStatuses),
    blindFighting,
  });
}

async function postCard(actor: MartialArtsActor, roll: Roll, template: string, context: object): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH(template), context as unknown as Record<string, unknown>);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}

/** Rolls one unarmed attack with the active style against the targeted token (or a typed-in AC) and posts the card. */
export async function rollMartialArtsAttack(actor: MartialArtsActor): Promise<void> {
  const view = martialArtsView(actor);
  if (!view.visible) return;
  if (!view.active) return warn("ADND2E.sheet.martialArts.noActive");
  if (!view.canAct) return warn("ADND2E.chat.attack.cannotActWarning");
  const target = await resolveTarget();
  if (!target) return;

  const roll = await new Roll("1d20").evaluate();
  const cond = situational(actor, target.targetStatuses, view.constants.blindFighting);
  const result = resolveMartialAttack({
    naturalD20: roll.dice[0]?.total ?? roll.total ?? 1,
    thac0: actor.system.attributes?.thac0?.melee ?? 20,
    targetAc: target.targetAc,
    attackerArmorType: resolveTargetArmorType(actor as never),
    opponentWeaponSize: target.opponentWeaponSize,
    situationalModifier: cond.total,
    strengthDamageAdj: actor.system.abilities?.str?.mods?.damageAdj ?? 0,
    forcedHit: isHelpless(target.targetStatuses),
  });
  const chiLevel = view.constants.chiKnown ? characterLevel(actor) : null;
  const context = buildMartialCardContext({
    actorName: actor.name, actorImg: actor.img, styleName: view.active.name, targetName: target.targetName, result, situationalRows: cond.rows,
    ineffective: ineffectiveFor(target, chiLevel, result.hit),
  });
  await postCard(actor, roll, "chat/martial-arts-attack.hbs", context);
}

/** Uses a known maneuver of the active style: one d20 against the target, a damage roll on a hit, one card. */
export async function useManeuver(actor: MartialArtsActor, maneuverId: string): Promise<void> {
  const view = martialArtsView(actor);
  if (!view.visible) return;
  if (!view.active) return warn("ADND2E.sheet.martialArts.noActive");
  if (!view.canAct) return warn("ADND2E.chat.attack.cannotActWarning");
  const row = view.active.maneuvers.find((m) => m.id === maneuverId);
  if (!maneuverById(maneuverId) || row?.state !== "known") return warn("ADND2E.sheet.martialArts.notKnown");
  if (row.kind === "passive") return warn("ADND2E.sheet.martialArts.passive");
  const def = maneuverById(maneuverId)!;
  if (def.kind === "utility") {
    const card = buildSkillCardContext({
      actorName: actor.name, actorImg: actor.img, styleName: view.active.name, maneuverId, skill: "levitation", level: characterLevel(actor),
    });
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/martial-arts-attack.hbs"), card as unknown as Record<string, unknown>);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
    return;
  }
  if (def.kind === "skill") {
    const skillRoll = await new Roll("1d20").evaluate();
    const natural = skillRoll.dice[0]?.total ?? skillRoll.total ?? 1;
    const leapCond = situational(actor, new Set<string>(), view.constants.blindFighting);
    const card =
      def.slug === "leap"
        ? buildSkillCardContext({
            actorName: actor.name, actorImg: actor.img, styleName: view.active.name, maneuverId, skill: "leap",
            result: resolveLeap({
              naturalD20: natural, thac0: actor.system.attributes?.thac0?.melee ?? 20,
              situationalModifier: leapCond.total, level: characterLevel(actor),
            }),
            situationalRows: leapCond.rows,
          })
        : buildSkillCardContext({
            actorName: actor.name, actorImg: actor.img, styleName: view.active.name, maneuverId, skill: "speed",
            result: resolveSpeed({ naturalD20: natural, dexterity: actor.system.abilities?.dex?.score ?? 10 }),
          });
    await postCard(actor, skillRoll, "chat/martial-arts-attack.hbs", card);
    return;
  }
  const target = await resolveTarget();
  if (!target) return;

  const roll = await new Roll("1d20").evaluate();
  const cond = situational(actor, target.targetStatuses, view.constants.blindFighting);
  const result = resolveManeuverAttack({
    maneuverId,
    naturalD20: roll.dice[0]?.total ?? roll.total ?? 1,
    thac0: actor.system.attributes?.thac0?.melee ?? 20,
    targetAc: target.targetAc,
    attackerArmorType: resolveTargetArmorType(actor as never),
    opponentWeaponSize: target.opponentWeaponSize,
    situationalModifier: cond.total,
    targetArmorGroup: target.targetArmorGroup,
    styleDie: view.active.damageDie,
    level: characterLevel(actor),
    strengthAdj: actor.system.abilities?.str?.mods?.damageAdj ?? 0,
    forcedHit: isHelpless(target.targetStatuses),
  });
  let damageTotal = 0;
  if (result.damageFormula) damageTotal = Math.max(0, (await new Roll(result.damageFormula).evaluate()).total ?? 0);
  let doubleDamageTotal = 0;
  if (result.doubleDamageFormula) doubleDamageTotal = Math.max(0, (await new Roll(result.doubleDamageFormula).evaluate()).total ?? 0);
  const chiLevel = view.constants.chiKnown ? characterLevel(actor) : null;
  const context = buildManeuverCardContext({
    actorName: actor.name, actorImg: actor.img, styleName: view.active.name, targetName: target.targetName, result, damageTotal,
    doubleDamageTotal, situationalRows: cond.rows,
    styleDieIsNull: view.active.damageDie === null,
    ineffective: ineffectiveFor(target, chiLevel, result.hit),
  });
  await postCard(actor, roll, "chat/martial-arts-attack.hbs", context);
}

/** Buy a weapon group on an owned style: re-validated here, then 1 slot is spent. */
export async function learnWeaponGroup(actor: MartialArtsActor, styleId: string, groupId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as {
    weaponGroups?: string[];
    knownManeuvers?: { id: string; level: number }[];
    knownWeaponGroups?: { id: string; level: number }[];
    slotsInvested?: number;
  };
  const level = characterLevel(actor);
  if (level < 1) return warn("ADND2E.sheet.martialArts.locked.noLevel");
  const knownGroups = sys.knownWeaponGroups ?? [];
  const verdict = groupLearnability({
    groupId,
    offered: offeredGroupIds(sys.weaponGroups ?? []),
    knownGroups,
    maneuversAtLevel: (sys.knownManeuvers ?? []).filter((k) => k.level === level).length,
    freeSlots: freeWeaponSlots(actor),
    level,
  });
  if (!verdict.ok) return warn(`ADND2E.sheet.martialArts.locked.${verdict.reason}`);
  await item.update({
    "system.knownWeaponGroups": [...knownGroups.map((g) => ({ id: g.id, level: g.level })), { id: groupId, level }],
    "system.slotsInvested": (sys.slotsInvested ?? 1) + 1,
  });
}

/** Unlearn a bought weapon group after a confirmation; the weapon proficiency slot is refunded. */
export async function unlearnWeaponGroup(actor: MartialArtsActor, styleId: string, groupId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as { knownWeaponGroups?: { id: string; level: number }[]; slotsInvested?: number };
  const change = unlearnGroupUpdate({ known: sys.knownWeaponGroups ?? [], groupId, slotsInvested: sys.slotsInvested ?? 1 });
  if (!change) return;
  const confirmed = await themedConfirm({
    window: { title: game.i18n!.localize("ADND2E.sheet.martialArts.unlearnTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheet.martialArts.unlearnGroupConfirm", {
      name: foundry.utils.escapeHTML(game.i18n!.localize(`ADND2E.martialWeaponGroups.${groupId}`)),
    })}</p>`,
  } as never);
  if (confirmed !== true) return;
  await item.update({ "system.knownWeaponGroups": change.knownWeaponGroups, "system.slotsInvested": change.slotsInvested });
}
