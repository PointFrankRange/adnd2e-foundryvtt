import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { blindedAttackPenalty, canAct, heldAttackBonus, proneArmorClassPenalty } from "../../combat/condition-effects";
import { getChassis } from "../../core/classes/chassis";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { weaponAttackPenalty, weaponSpecializationEffect } from "../../core/proficiencies/weapon";
import { canBackstab } from "../../core/weapons/backstab";
import { backstabMultiplier } from "../../core/proficiencies/thief-skills";
import { classItemLevel } from "../../data/derive/class-item";
import { TEMPLATE_PATH } from "../../constants";
import type { ClassId, SaveCategory } from "../../core/types";

/* ---------------------------------------------------------------------------
 * combat-rolls — SP3 Task 5.
 *
 * Foundry-coupled Roll Attack / Roll Save glue for the character sheet — not
 * unit-tested (spec §9), verified in a linked dev world. All math and chat-
 * card shaping is delegated to the pure `core/combat`, `core/dice`, and
 * `combat/*-card` modules from Tasks 1-4; this file only reads documents,
 * rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

/** Resolve an ANY-type target actor's AC (context-appropriate) and creature
 *  size — character/npc and creature store both under different paths and
 *  shapes (§4.1's "Reference facts" — confirmed by reading both DataModels). */
export function resolveTargetCombatInfo(
  targetActor: { type: string; system: Record<string, unknown>; items: Iterable<{ type: string; system: { size?: string } }> },
): { ac: number; size: string | null } {
  if (targetActor.type === "creature") {
    const sys = targetActor.system as { attributes?: { ac?: { value?: number } }; details?: { size?: string } };
    return { ac: sys.attributes?.ac?.value ?? 10, size: sys.details?.size ?? "medium" };
  }
  const sys = targetActor.system as { attributes?: { ac?: { normal?: number } } };
  const raceItem = [...targetActor.items].find((i) => i.type === "race");
  return { ac: sys.attributes?.ac?.normal ?? 10, size: raceItem?.system.size ?? "medium" };
}

interface AttackerActor {
  name: string; img: string; uuid: string;
  statuses: ReadonlySet<string>;
  system: { attributes?: { thac0?: { melee?: number; ranged?: number } } };
  items: { get(id: string): WeaponItemHandle | undefined } & Iterable<GenericAttackerItem>;
}
interface WeaponItemHandle {
  id: string; name: string;
  system: {
    category: string; proficiencyGroup: string; materialToHit: number; magicBonus: number;
    damageType: string | null;
  };
}
/** Minimal shape needed to find the actor's class chassis and weapon-proficiency
 *  items without a dedicated Item subtype per iteration entry. */
interface GenericAttackerItem {
  type: string;
  system: Record<string, unknown>;
}

/** Resolves the attack-roll `proficiencyModifier` (per core/combat/attack.ts's
 *  AttackModifierInput doc comment: "0 if proficient; class non-proficiency
 *  penalty if not; +1 if specialized") by matching `weapon` against the
 *  actor's weaponProficiency items — by exact name for a specific-weapon
 *  proficiency, or by `weaponOrGroup === weapon.system.proficiencyGroup` for
 *  a group proficiency. Uses the FIRST class item's chassis for the
 *  non-proficiency penalty and the specialization category-to-bonus lookup
 *  (a documented v1 simplification for multi-classed actors — see this
 *  plan's Global Constraints). Only "proficient"/"non-proficient" are ever
 *  resolved; "related" weapon proficiency isn't modeled anywhere in this
 *  codebase. */
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): number {
  let isProficient = false;
  let specialized = false;
  let groupMatch: { specialized?: boolean } | null = null;
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as { weaponOrGroup?: string; isGroup?: boolean; specialized?: boolean };
    if (s.isGroup !== true && s.weaponOrGroup === weapon.name) {
      isProficient = true;
      specialized = Boolean(s.specialized);
      groupMatch = null;
      break;
    }
    if (s.isGroup === true && s.weaponOrGroup === weapon.system.proficiencyGroup && !groupMatch) {
      groupMatch = s;
    }
  }
  if (!isProficient && groupMatch) {
    isProficient = true;
    specialized = Boolean(groupMatch.specialized);
  }

  let nonProficiencyPenalty = 0;
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) {
      nonProficiencyPenalty = getChassis(chassisId as ClassId).nonProficiencyPenalty;
      break;
    }
  }

  const base = weaponAttackPenalty(nonProficiencyPenalty, isProficient ? "proficient" : "non-proficient");
  if (!isProficient || !specialized) return base;

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  return base + weaponSpecializationEffect(category).toHit;
}

/** Resolves whether `actor` is a thief and, if so, its thief-class level
 *  (for `backstabMultiplier`) — mirrors `proficiency-actions.ts`'s
 *  `primaryClassLevel`, kept as an independent re-derivation per this
 *  plan's established duplicate-re-validation pattern. */
function resolveThiefBackstabInfo(actor: AttackerActor): { isThief: boolean; thiefLevel: number } {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const s = item.system as { chassisId?: string; xp?: number };
    if (s.chassisId === "thief") {
      return { isThief: true, thiefLevel: classItemLevel("thief", s.xp ?? 0) };
    }
  }
  return { isThief: false, thiefLevel: 0 };
}

/** Roll one attack for `weaponItemId` against the current token target(s) (or
 *  a manually-entered AC, via DialogV2, when zero or more than one is
 *  targeted). Posts an attack-roll chat card; a hit exposes a "Roll Damage"
 *  button (chat/chat-listeners.ts). */
export async function rollAttack(actor: AttackerActor, weaponItemId: string, backstab = false): Promise<void> {
  const weapon = actor.items.get(weaponItemId);
  if (!weapon) return;

  if (!canAct(actor.statuses)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.cannotActWarning"));
    return;
  }

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let targetSize: string | null = null;
  let targetStatuses: ReadonlySet<string> = new Set<string>();

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    const info = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]);
    targetAc = info.ac + proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>());
    targetSize = info.size;
    targetStatuses = (t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>();
  } else {
    const manualAc = await foundry.applications.api.DialogV2.prompt({
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
    });
    if (typeof manualAc !== "number" || !Number.isFinite(manualAc)) return;
    targetAc = manualAc;
  }

  const isRanged = weapon.system.category !== "melee";
  const thac0 = isRanged ? (actor.system.attributes?.thac0?.ranged ?? 20) : (actor.system.attributes?.thac0?.melee ?? 20);
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    proficiencyModifier: resolveProficiencyModifier(actor, weapon),
    // STR/DEX modifiers remain out of scope (parent spec §7 boundary,
    // unchanged by this sub-project).
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses),
  });
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const { isThief, thiefLevel } = resolveThiefBackstabInfo(actor);
  const backstabEligible = isThief && canBackstab({ category: weapon.system.category as never, damageType: weapon.system.damageType as never });
  const backstabActive = backstab && backstabEligible;

  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  const hit = backstabActive ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    backstab: backstabActive,
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
        }
      : null,
  });

  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      content,
      flags: { adnd2e: { card: "attack", ...context.damageContext } },
    } as unknown as Roll.MessageData,
  );
}

/** Roll one of the 5 saving-throw categories using the actor's already-cached
 *  system.saves.<category>. */
export async function rollSave(
  actor: { name: string; img: string; system: { saves: Record<SaveCategory, { target: number; rollModifier: number }> } },
  category: SaveCategory,
): Promise<void> {
  const save = actor.system.saves[category];
  const roll = await new Roll(`1d20${save.rollModifier ? (save.rollModifier > 0 ? ` + ${save.rollModifier}` : ` - ${Math.abs(save.rollModifier)}`) : ""}`).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: `ADND2E.saves.${category}`,
    formula: roll.formula, naturalD20, rollModifier: save.rollModifier, target: save.target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content });
}
