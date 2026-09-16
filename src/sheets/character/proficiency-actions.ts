import { getChassis } from "../../core/classes/chassis";
import { nonweaponCheck } from "../../core/proficiencies/nonweapon";
import { canWeaponSpecialize, weaponSpecializationSlotCost } from "../../core/proficiencies/weapon";
import type { AbilityKey, ClassId } from "../../core/types";
import { buildNonweaponCheckCardContext } from "../../combat/nonweapon-check-card";
import { TEMPLATE_PATH } from "../../constants";

/* ---------------------------------------------------------------------------
 * proficiency-actions — SP5a.
 *
 * Foundry-coupled weapon-specialization-purchase / non-weapon-check glue for
 * the character sheet's Skills tab — not unit-tested (spec §9-equivalent for
 * this plan), verified in a linked dev world. All math and chat-card shaping
 * is delegated to the pure core/proficiencies and combat/nonweapon-check-card
 * modules; this file only reads documents, writes slot/specialization state,
 * rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

interface WeaponProfItemHandle {
  id: string;
  system: { weaponOrGroup: string; isGroup: boolean; slotsInvested: number; specialized: boolean };
}
interface NwpItemHandle {
  id: string; name: string;
  system: { governingAbility: string; modifier: number; slotCost: number; group: string; slotsInvested: number };
}
interface WeaponItemHandle2 {
  system: { category: string; proficiencyGroup: string };
}
/** Minimal shape needed to find the actor's class chassis and its owned
 *  weapon Items (for resolving a weapon proficiency's specialization
 *  category) without a dedicated Item subtype per iteration entry. Every
 *  real embedded Item document has its own `.update()` — declaring it here
 *  means `actor.items.get(id)` results can be written back directly, no
 *  extra cast needed. */
interface GenericProficiencyActorItem {
  id: string; name: string; type: string; system: Record<string, unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

interface ProficiencyActor {
  name: string; img: string;
  system: {
    abilities: Record<AbilityKey, { score: number }>;
    proficiencies: { weapon: { available: number }; nonweapon: { available: number } };
  };
  items: {
    get(id: string): (WeaponProfItemHandle | NwpItemHandle) & GenericProficiencyActorItem | undefined;
  } & Iterable<GenericProficiencyActorItem>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Finds the actor's FIRST class item's chassisId — matches the same
 *  first-member-wins simplification used in combat-rolls.ts's
 *  resolveProficiencyModifier, for consistency across this plan's two
 *  multi-class-ambiguous call sites. */
function firstClassChassisId(actor: ProficiencyActor): ClassId | null {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) return chassisId as ClassId;
  }
  return null;
}

/** Resolves a weapon proficiency item's specialization category by matching
 *  its `weaponOrGroup` name against the actor's owned weapon Items — null
 *  for a group proficiency or no matching weapon. Thrown weapons map to
 *  "melee" (locked brainstorming decision). */
function resolveCategory(actor: ProficiencyActor, prof: WeaponProfItemHandle): "melee" | "crossbow" | "bow" | null {
  if (prof.system.isGroup) return null;
  for (const item of actor.items) {
    if (item.type !== "weapon" || item.name !== prof.system.weaponOrGroup) continue;
    const cat = (item as unknown as WeaponItemHandle2).system.category;
    if (cat === "bow") return "bow";
    if (cat === "crossbow") return "crossbow";
    return "melee";
  }
  return null;
}

/** Purchases specialization on a weapon proficiency: re-derives the same
 *  eligibility context.ts's `buildWeaponProfRow` used to decide whether to
 *  show the Specialize button (not a group, a resolved category, the
 *  actor's first-class chassis allows it, single-classed, not already
 *  specialized, enough available slots), spends the category's slot cost,
 *  and sets `specialized: true`. No-ops with a toast on any failed
 *  re-check — a defensive guard against a stale button click, not the
 *  primary gate. */
export async function specializeWeapon(actor: ProficiencyActor, weaponProfItemId: string): Promise<void> {
  const item = actor.items.get(weaponProfItemId);
  const prof = item as (WeaponProfItemHandle & GenericProficiencyActorItem) | undefined;
  if (!prof || prof.type !== "weaponProficiency" || prof.system.specialized) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.specializeBlockedWarning"));
    return;
  }
  const category = resolveCategory(actor, prof);
  const chassisId = firstClassChassisId(actor);
  const classCount = [...actor.items].filter((i) => i.type === "class").length;
  if (
    !category ||
    !chassisId ||
    !canWeaponSpecialize({
      specializationAllowed: getChassis(chassisId).weaponSpecializationAllowed,
      isSingleClass: classCount === 1,
    })
  ) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.specializeBlockedWarning"));
    return;
  }
  const cost = Math.max(0, weaponSpecializationSlotCost(category) - prof.system.slotsInvested);
  if (actor.system.proficiencies.weapon.available < cost) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.specializeBlockedWarning"));
    return;
  }
  await prof.update({
    "system.specialized": true,
    "system.slotsInvested": prof.system.slotsInvested + cost,
  });
}

/** Rolls a 1d20 non-weapon proficiency check for `nwpItemId` against the
 *  actor's cached ability score, the proficiency's own modifier, and its
 *  invested slots — situational modifier is always 0 for v1 (no manual
 *  prompt, matching saving throws' simplicity rather than attack rolls'
 *  manual-AC dialog). Always posts a chat card. */
export async function rollNonweaponCheck(actor: ProficiencyActor, nwpItemId: string): Promise<void> {
  const item = actor.items.get(nwpItemId);
  const nwp = item as (NwpItemHandle & GenericProficiencyActorItem) | undefined;
  if (!nwp || nwp.type !== "nonweaponProficiency") {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.checkBlockedWarning"));
    return;
  }
  const ability = nwp.system.governingAbility as AbilityKey;
  const abilityScore = actor.system.abilities[ability]?.score ?? 0;
  const roll = await new Roll("1d20").evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  let result: ReturnType<typeof nonweaponCheck>;
  try {
    result = nonweaponCheck({
      ability,
      abilityScore,
      checkModifier: nwp.system.modifier,
      slotsInvested: nwp.system.slotsInvested,
      situationalModifier: 0,
      roll: naturalD20,
    });
  } catch {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.checkBlockedWarning"));
    return;
  }
  const context = buildNonweaponCheckCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    proficiencyName: nwp.name,
    abilityLabel: `ADND2E.abilities.${ability}`,
    formula: "1d20",
    roll: naturalD20,
    result,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/nonweapon-check-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as Roll.MessageData);
}
