import { getChassis } from "../../core/classes/chassis";
import { nonweaponCheck } from "../../core/proficiencies/nonweapon";
import { canWeaponSpecialize } from "../../core/proficiencies/weapon";
import { weaponMasteryTierCost } from "../../core/proficiencies/weapon-mastery";
import { bardSkillCheck, classifyThiefArmor, thiefSkillCheck, thiefSkillPerSkillCap } from "../../core/proficiencies/thief-skills";
import type { AbilityKey, ArmorType, BardSkill, ClassId, Race, ThiefSkill } from "../../core/types";
import { buildNonweaponCheckCardContext } from "../../combat/nonweapon-check-card";
import { buildThiefSkillCardContext } from "../../combat/thief-skill-card";
import { classItemLevel } from "../../data/derive/class-item";
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
  system: { weaponOrGroup: string; isGroup: boolean; slotsInvested: number; masteryTier: 0 | 1 | 2 | 3 };
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

/** Advances a weapon proficiency's mastery tier by exactly 1 (never jumping
 *  tiers): re-derives the SAME eligibility context.ts's `buildWeaponProfRow`
 *  used to decide whether to show the Advance Mastery button (not a group, a
 *  resolved category, the actor's first-class chassis allows specialization,
 *  single-classed, below tier 3, enough available slots for the NEXT tier),
 *  spends that tier's slot-cost delta, and increments `masteryTier`. No-ops
 *  with a toast on any failed re-check — a defensive guard against a stale
 *  button click, not the primary gate. Eligibility re-checks
 *  `canWeaponSpecialize` at EVERY tier advance, not just the first (spec §2's
 *  "Weapon mastery tier model": "no new class-eligibility rule" — the same
 *  gate governs every step of the ladder). */
export async function advanceWeaponMastery(actor: ProficiencyActor, weaponProfItemId: string): Promise<void> {
  const item = actor.items.get(weaponProfItemId);
  const prof = item as (WeaponProfItemHandle & GenericProficiencyActorItem) | undefined;
  if (!prof || prof.type !== "weaponProficiency" || prof.system.masteryTier >= 3) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.advanceMasteryBlockedWarning"));
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
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.advanceMasteryBlockedWarning"));
    return;
  }
  const nextTier = (prof.system.masteryTier + 1) as 1 | 2 | 3;
  const cost = Math.max(0, weaponMasteryTierCost(nextTier, category) - prof.system.slotsInvested);
  if (actor.system.proficiencies.weapon.available < cost) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.advanceMasteryBlockedWarning"));
    return;
  }
  await prof.update({
    "system.masteryTier": nextTier,
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

/** Points added/removed per click of the +/− allocation buttons. Not a PHB
 *  rule (the book has no fixed increment) — a locked plan decision for a
 *  usable UI. A click near either boundary (the remaining pool, or a
 *  thief's per-skill cap) adds/removes only the amount that still fits,
 *  rather than jumping past it or being blocked entirely. */
const THIEF_SKILL_ALLOCATION_STEP = 5;

interface ThiefSkillAllocation { skill: ThiefSkill; allocatedPoints: number }
interface ThiefSkillsActor extends ProficiencyActor {
  system: ProficiencyActor["system"] & {
    thiefSkills: { total: number; spent: number; available: number; allocations: ThiefSkillAllocation[] };
    abilities: ProficiencyActor["system"]["abilities"] & { dex: { score: number } };
  };
}

/** Scans ALL of the actor's class items for a thief-or-bard match, thief
 *  always taking priority over bard regardless of array order — mirrors
 *  `deriveThiefSkillPoints`'s exact priority rule (data/derive/character/
 *  thief-skills.ts), NOT `firstClassChassisId`'s "literal first class,
 *  any class" rule (which `advanceWeaponMastery` still needs unchanged). */
function firstThiefOrBardChassisId(actor: ThiefSkillsActor): "thief" | "bard" | null {
  let bardFallback: "bard" | null = null;
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId === "thief") return "thief";
    if (chassisId === "bard" && !bardFallback) bardFallback = "bard";
  }
  return bardFallback;
}

/** Resolves whether `actor`'s thief-or-bard class (by `firstThiefOrBardChassisId`'s
 *  priority rule) has thief-skill access and, if so, its `thiefSkillAccess`
 *  list — null for any other class (no access at all). */
function thiefOrBardAccess(actor: ThiefSkillsActor): { isThief: boolean; access: readonly ThiefSkill[] } | null {
  const chassisId = firstThiefOrBardChassisId(actor);
  if (!chassisId) return null;
  const access = getChassis(chassisId).thiefSkillAccess;
  return access ? { isThief: chassisId === "thief", access } : null;
}

/** Resolves the actor's currently worn (non-shield) armor's `armorType`. */
function resolveWornArmorType(actor: ThiefSkillsActor): ArmorType {
  for (const item of actor.items) {
    if (item.type !== "armor") continue;
    const s = item.system as { equipped?: boolean; isShield?: boolean; armorType?: ArmorType };
    if (s.equipped && !s.isShield) return s.armorType ?? "none";
  }
  return "none";
}

/** Resolves the actor's race for the thief-skill racial adjustment table —
 *  mirrors context.ts's `buildThiefSkills` (`input.raceItem?.raceId ?? "human"`),
 *  which reads it off the actor's embedded `race`-type Item, not a plain
 *  actor field. This is a defensive re-derivation, so it must reach the
 *  SAME value the display layer used. */
function resolveActorRace(actor: ThiefSkillsActor): Race {
  for (const item of actor.items) {
    if (item.type !== "race") continue;
    const raceId = (item.system as { raceId?: string }).raceId;
    if (raceId) return raceId as Race;
  }
  return "human";
}

/** Resolves the actor's level in its primary thief/bard class, for the
 *  per-skill cap and (thief only) backstab multiplier. */
function primaryClassLevel(actor: ThiefSkillsActor): number {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const s = item.system as { chassisId?: string; xp?: number };
    if (s.chassisId === "thief" || s.chassisId === "bard") {
      return classItemLevel(s.chassisId as ClassId, s.xp ?? 0);
    }
  }
  return 0;
}

/** Adds up to `THIEF_SKILL_ALLOCATION_STEP` points to `skill`, clamped to
 *  whatever still fits in the remaining pool and (thief only) the
 *  per-skill cap. Re-derives the SAME eligibility `context.ts`'s
 *  `buildThiefSkills` used to decide whether to show the "+" button — a
 *  defensive re-check against a stale button click, not the primary gate.
 *  No-ops with a toast when nothing can be added. */
export async function allocateThiefSkillPoint(actor: ThiefSkillsActor, skill: ThiefSkill): Promise<void> {
  const info = thiefOrBardAccess(actor);
  if (!info || !info.access.includes(skill)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const allocations = actor.system.thiefSkills.allocations;
  const current = allocations.find((a) => a.skill === skill)?.allocatedPoints ?? 0;
  const poolRoom = actor.system.thiefSkills.available;
  const capRoom = info.isThief ? thiefSkillPerSkillCap(primaryClassLevel(actor)) - current : Infinity;
  const amount = Math.min(THIEF_SKILL_ALLOCATION_STEP, poolRoom, capRoom);
  if (amount <= 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const updated = allocations.some((a) => a.skill === skill)
    ? allocations.map((a) => (a.skill === skill ? { ...a, allocatedPoints: a.allocatedPoints + amount } : a))
    : [...allocations, { skill, allocatedPoints: amount }];
  await actor.update({ "system.thiefSkills.allocations": updated });
}

/** Removes up to `THIEF_SKILL_ALLOCATION_STEP` points from `skill`, floored
 *  at 0. No-ops with a toast when nothing is allocated to remove. */
export async function deallocateThiefSkillPoint(actor: ThiefSkillsActor, skill: ThiefSkill): Promise<void> {
  const allocations = actor.system.thiefSkills.allocations;
  const entry = allocations.find((a) => a.skill === skill);
  if (!entry || entry.allocatedPoints <= 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const amount = Math.min(THIEF_SKILL_ALLOCATION_STEP, entry.allocatedPoints);
  const updated = allocations.map((a) =>
    a.skill === skill ? { ...a, allocatedPoints: a.allocatedPoints - amount } : a,
  );
  await actor.update({ "system.thiefSkills.allocations": updated });
}

/** Rolls a d100 thief/bard-skill check for `skill` and posts a chat card.
 *  No-ops with a toast if the actor has no access to `skill` or thief
 *  skills are disabled by worn armor (`classifyThiefArmor`). */
export async function rollThiefSkill(actor: ThiefSkillsActor, skill: ThiefSkill): Promise<void> {
  const info = thiefOrBardAccess(actor);
  if (!info || !info.access.includes(skill)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefAllocateBlockedWarning"));
    return;
  }
  const classification = classifyThiefArmor(resolveWornArmorType(actor));
  if (classification.disabled) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefArmorDisabledWarning"));
    return;
  }
  if (skill === "read-languages" && info.isThief && primaryClassLevel(actor) < 4) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.skills.thiefSkillNotUsableWarning"));
    return;
  }
  const allocated = actor.system.thiefSkills.allocations.find((a) => a.skill === skill)?.allocatedPoints ?? 0;
  const roll = await new Roll("1d100").evaluate();
  const naturalD100 = roll.dice[0]?.total ?? 0;
  const checkInput = {
    race: resolveActorRace(actor),
    dexterity: actor.system.abilities.dex.score,
    armor: classification.category,
    allocatedPoints: allocated,
    roll: naturalD100,
  };
  const result = info.isThief
    ? thiefSkillCheck(skill, checkInput)
    : bardSkillCheck(skill as BardSkill, checkInput);
  const context = buildThiefSkillCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    skillLabel: `ADND2E.chat.thiefSkill.skills.${skill}`,
    formula: "1d100",
    roll: naturalD100,
    result,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/thief-skill-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as Roll.MessageData);
}
