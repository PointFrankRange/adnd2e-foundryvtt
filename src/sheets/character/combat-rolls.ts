import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { blindedAttackPenalty, canAct, heldAttackBonus, proneArmorClassPenalty } from "../../combat/condition-effects";
import { getChassis } from "../../core/classes/chassis";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { weaponAttackPenalty } from "../../core/proficiencies/weapon";
import { weaponMasteryEffect } from "../../core/proficiencies/weapon-mastery";
import { canBackstab } from "../../core/weapons/backstab";
import { backstabMultiplier } from "../../core/proficiencies/thief-skills";
import { classItemLevel } from "../../data/derive/class-item";
import { criticalSeverity, fumbleSeverity } from "../../combat/critical";
import { toArmorGroup, weaponVsArmorModifier } from "../../combat/weapon-vs-armor";
import { getOptionalRules } from "../../settings";
import { TEMPLATE_PATH } from "../../constants";
import { MANEUVERS, resolveManeuverOutcome } from "../../core/combat/maneuvers";
import type { ManeuverId } from "../../core/combat/maneuvers";
import type { ArmorType, ClassId, SaveCategory } from "../../core/types";

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

/** Finds the target's equipped, non-shield `armor`-type item and reads its
 *  armorType, defaulting to "none" (the unarmored group) when the target has
 *  no equipped body-armor item at all — including every `creature`-type
 *  target, which has no armor Item concept (a safe no-op, since this plan's
 *  weaponVsArmorModifier table returns 0 for "unarmored" on every
 *  damage type). Shields are ALSO `armor`-type Items in this schema (see
 *  data/item/armor.ts's `isShield` field) with their own armorType (usually
 *  "none"), so they must be excluded here or an equipped shield found before
 *  the target's equipped body armor would silently zero this modifier —
 *  mirrors proficiency-actions.ts's `resolveWornArmorType`, which already
 *  solves this exact problem for the thief-skill-armor feature. */
function resolveTargetArmorType(
  targetActor: {
    items: Iterable<{ type: string; system: { armorType?: string; equipped?: boolean; isShield?: boolean } }>;
  },
): ArmorType {
  const armorItem = [...targetActor.items].find(
    (i) => i.type === "armor" && i.system.equipped && !i.system.isShield,
  );
  return (armorItem?.system.armorType as ArmorType | undefined) ?? "none";
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
 *  penalty if not; tiered mastery bonus if specialized/mastered") by matching
 *  `weapon` against the actor's weaponProficiency items — by exact name for a
 *  specific-weapon proficiency, or by `weaponOrGroup === weapon.system.proficiencyGroup`
 *  for a group proficiency. Uses the FIRST class item's chassis for the
 *  non-proficiency penalty and the mastery category-to-bonus lookup (a
 *  documented v1 simplification for multi-classed actors — see this plan's
 *  Global Constraints). Only "proficient"/"non-proficient" are ever resolved;
 *  "related" weapon proficiency isn't modeled anywhere in this codebase.
 *  Tier 1 (Specialized) is the pre-existing, always-on mechanic; tiers 2-3
 *  (Mastery/Grand Mastery) are gated behind the `weaponMastery` optional rule
 *  and capped back down to tier 1 when it's off. */
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): number {
  let isProficient = false;
  let masteryTier: 0 | 1 | 2 | 3 = 0;
  let groupMatch: { masteryTier?: 0 | 1 | 2 | 3 } | null = null;
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as { weaponOrGroup?: string; isGroup?: boolean; masteryTier?: 0 | 1 | 2 | 3 };
    if (s.isGroup !== true && s.weaponOrGroup === weapon.name) {
      isProficient = true;
      masteryTier = s.masteryTier ?? 0;
      groupMatch = null;
      break;
    }
    if (s.isGroup === true && s.weaponOrGroup === weapon.system.proficiencyGroup && !groupMatch) {
      groupMatch = s;
    }
  }
  if (!isProficient && groupMatch) {
    isProficient = true;
    masteryTier = groupMatch.masteryTier ?? 0;
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
  if (!isProficient || masteryTier === 0) return base;

  // Tier 1 (Specialized) is the pre-existing, always-on mechanic — it applies
  // regardless of the weaponMastery toggle, exactly like it did before this
  // plan. Tiers 2-3 are NEW behavior this plan adds, so they're capped back
  // down to tier 1 whenever the optional rule is off — a persisted
  // masteryTier of 2/3 doesn't silently keep granting its bonus after a GM
  // disables the rule (mirrors how criticalHits/armorTypeVsWeaponType are
  // both re-checked at roll time in this same file, not only at UI-render
  // time — spec §5's "not... rendered and then ignored server-side" applies
  // equally to a persisted tier as to an ephemeral per-roll UI choice).
  const rules = getOptionalRules();
  const masteryEnabled = rules.combatAndTacticsEnabled && rules.weaponMastery;
  const effectiveTier = masteryEnabled ? masteryTier : (Math.min(masteryTier, 1) as 0 | 1);

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  return base + weaponMasteryEffect(effectiveTier, category).toHit;
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

/** Sets a weapon Item to unequipped — the "weapon knocked away" operation
 *  shared by a fumble's weaponDrops outcome (on the ATTACKER's own weapon)
 *  and a disarm maneuver/called-shot's unequip outcome (on the TARGET's
 *  weapon, resolved by `resolveTargetEquippedWeapon`) — same operation,
 *  different whose-weapon the caller decides. */
async function unequipWeapon(weaponItem: { update(d: Record<string, unknown>): Promise<unknown> }): Promise<void> {
  await weaponItem.update({ "system.equipped": false });
}

/** Finds the target actor's FIRST equipped weapon Item (first-member-wins,
 *  matching this codebase's established multi-match tie-break convention —
 *  see e.g. proficiency-actions.ts's `firstClassChassisId`). Returns `null`
 *  for an unarmed target — a maneuver's `unequip` outcome is then correctly
 *  a no-op (spec §5), not an error. */
function resolveTargetEquippedWeapon(
  targetActor: { items: Iterable<{ id: string; type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }> },
): { update(d: Record<string, unknown>): Promise<unknown> } | null {
  for (const item of targetActor.items) {
    if (item.type === "weapon" && item.system.equipped) return item;
  }
  return null;
}

/** Roll one attack for `weaponItemId` against the current token target(s) (or
 *  a manually-entered AC, via DialogV2, when zero or more than one is
 *  targeted). Posts an attack-roll chat card; a hit exposes a "Roll Damage"
 *  button (chat/chat-listeners.ts). */
export async function rollAttack(
  actor: AttackerActor,
  weaponItemId: string,
  backstab = false,
  maneuverId: ManeuverId | null = null,
): Promise<void> {
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
  let armorVsWeaponModifier = 0;

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    const info = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]);
    targetAc = info.ac + proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>());
    targetSize = info.size;
    targetStatuses = (t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>();
    const rules = getOptionalRules();
    if (rules.combatAndTacticsEnabled && rules.armorTypeVsWeaponType && weapon.system.damageType) {
      const targetArmorType = resolveTargetArmorType(t.actor as Parameters<typeof resolveTargetArmorType>[0]);
      armorVsWeaponModifier = weaponVsArmorModifier(weapon.system.damageType as never, toArmorGroup(targetArmorType));
    }
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
  const rules = getOptionalRules();
  const maneuverAllowed =
    maneuverId !== null &&
    rules.combatAndTacticsEnabled &&
    (MANEUVERS[maneuverId].category === "calledShot" ? rules.calledShots : rules.combatManeuvers);
  const effectiveManeuverId = maneuverAllowed ? maneuverId : null;
  const maneuverPenalty = effectiveManeuverId ? MANEUVERS[effectiveManeuverId].attackPenalty : 0;
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    proficiencyModifier: resolveProficiencyModifier(actor, weapon),
    // STR/DEX modifiers remain out of scope (parent spec §7 boundary,
    // unchanged by this sub-project).
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses) + armorVsWeaponModifier + maneuverPenalty,
  });
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const { isThief, thiefLevel } = resolveThiefBackstabInfo(actor);
  const backstabEligible = isThief && canBackstab({ category: weapon.system.category as never, damageType: weapon.system.damageType as never });
  const backstabActive = backstab && backstabEligible;

  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  const hit = backstabActive ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const critEnabled = getOptionalRules().combatAndTacticsEnabled && getOptionalRules().criticalHits;
  const crit = critEnabled && baseHit.autoHit && !backstabActive ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  // A backstab's own forced-hit outcome (hit:true/autoHit:true, applied to
  // `hit` above) and its own backstabMultiplier mechanic are a complete,
  // self-contained resolution — fumble severity must never be checked for an
  // active backstab attempt, matching crit's existing non-stacking rule
  // above, or a natural-1 backstab roll would produce an incoherent chat
  // card claiming both "automatic hit" and "weapon drops" and genuinely
  // unequip the weapon on an attack just declared a guaranteed hit.
  const fumble = critEnabled && baseHit.autoMiss && !backstabActive ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;

  if (fumble?.effect === "weaponDrops") {
    await unequipWeapon(weapon as unknown as { update(d: Record<string, unknown>): Promise<unknown> });
  }
  if (fumble?.effect === "selfInjury" && fumble.selfInjuryDice) {
    const selfRoll = await new Roll(fumble.selfInjuryDice).evaluate();
    await selfRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.localize("ADND2E.chat.attack.fumbleSelfInjury"),
    } as unknown as Roll.MessageData);
  }

  const maneuverEffect = resolveManeuverOutcome(effectiveManeuverId, hit.hit);
  if (maneuverEffect && targets.length === 1) {
    const targetActor = targets[0]!.actor as {
      toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
      items: Iterable<{ id: string; type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }>;
    };
    if (maneuverEffect.kind === "condition") {
      await targetActor.toggleStatusEffect(maneuverEffect.conditionId, { active: true });
    } else if (maneuverEffect.kind === "unequip") {
      const targetWeapon = resolveTargetEquippedWeapon(targetActor);
      if (targetWeapon) await unequipWeapon(targetWeapon);
    }
    // "push" (bull rush): narrative-only — no persisted state change. The
    // card's maneuverLabel line below already communicates the outcome.
  }

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    backstab: backstabActive,
    critLabel: crit ? `ADND2E.chat.attack.crit.${crit.tier}` : null,
    fumbleLabel: fumble ? `ADND2E.chat.attack.fumble.${fumble.tier}` : null,
    maneuverLabel: effectiveManeuverId && maneuverEffect ? `ADND2E.chat.attack.maneuverLabel.${effectiveManeuverId}` : null,
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
          critMultiplier: crit?.damageMultiplier ?? null,
          critFlatBonus: crit?.flatBonus ?? 0,
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
