import { buildAttackCardContext } from "../../combat/attack-card";
import { enchantmentCharmSaveBonus, poisonSaveAdjustment } from "../../core/saves/racial";
import { normalizeSubrace } from "../../core/races/subrace";
import { buildSaveCardContext } from "../../combat/save-card";
import { matchingAmmo, defaultAmmoSelection } from "../../combat/ammo";
import type { AmmoStock } from "../../combat/ammo";
import {
  blindedAttackPenalty,
  canAct,
  entangledAttackPenalty,
  fatigueArmorClassPenalty,
  fatigueAttackPenalty,
  frightenedAttackPenalty,
  heldAttackBonus,
  invisibleTargetPenalty,
  isHelpless,
  proneArmorClassPenalty,
} from "../../combat/condition-effects";
import { getChassis } from "../../core/classes/chassis";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { weaponAttackPenalty } from "../../core/proficiencies/weapon";
import { expandedProficienciesEnabled, isRelatedGroup, weaponProficiencyMode } from "../../core/proficiencies/weapon-relation";
import { weaponMasteryEffect } from "../../core/proficiencies/weapon-mastery";
import { canBackstab } from "../../core/weapons/backstab";
import { backstabMultiplier } from "../../core/proficiencies/thief-skills";
import { classItemLevel } from "../../data/derive/class-item";
import { abilityScoresOf, actorLevelRulesFor } from "../../data/derive/character/kits";
import { criticalSeverity, fumbleSeverity } from "../../combat/critical";
import { toArmorGroup, weaponVsArmorModifier } from "../../combat/weapon-vs-armor";
import { getOptionalRules } from "../../settings";
import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { MANEUVERS, resolveManeuverOutcome } from "../../core/combat/maneuvers";
import type { ManeuverId } from "../../core/combat/maneuvers";
import type { ArmorType, ClassId, SaveCategory } from "../../core/types";
import { requestApply } from "../../relay/relay-client";
import type { EffectTarget } from "../../relay/apply-effect";
import type { RelayConditionId } from "../../combat/apply-relay";

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
 *  no equipped body-armor item at all. A `creature`-type target (Monster
 *  NPC) ALWAYS resolves to "none" here regardless of what it has equipped —
 *  the Monster NPC inventory design's locked ruling (decision 6) is that a
 *  monster's worn armor is mechanically inert: its AC is the authored stat
 *  block, full stop, so this modifier must never see a monster's equipped
 *  armor Item at all (the Monster NPC inventory plan's Task 3 added the
 *  ability to equip an `armor`-type item on a `creature` actor, which made
 *  this function's PRE-EXISTING "creature has no armor Item concept" premise
 *  false — this early return keeps that premise true in effect). Shields are
 *  ALSO `armor`-type Items in this schema (see data/item/armor.ts's
 *  `isShield` field) with their own armorType (usually "none"), so they must
 *  be excluded here or an equipped shield found before the target's equipped
 *  body armor would silently zero this modifier — mirrors
 *  proficiency-actions.ts's `resolveWornArmorType`, which already solves
 *  this exact problem for the thief-skill-armor feature. Exported for
 *  creature/combat-rolls.ts to reuse unchanged — the creature-target "none"
 *  early return already gives the correct answer for a Monster NPC attacker
 *  too, so there's no reason to re-implement this a second time. */
export function resolveTargetArmorType(
  targetActor: {
    type: string;
    items: Iterable<{ type: string; system: { armorType?: string; equipped?: boolean; isShield?: boolean } }>;
  },
): ArmorType {
  if (targetActor.type === "creature") return "none";
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
    category: string; proficiencyGroup: string; baseWeaponName: string; materialToHit: number; magicBonus: number;
    damageType: string | null;
    /** bow/crossbow only — null for melee/thrown */
    ammoType: string | null;
    selectedAmmoId: string | null;
  };
}
/** Minimal shape needed to find the actor's class chassis and weapon-proficiency
 *  items without a dedicated Item subtype per iteration entry — also used to
 *  find the actor's owned `ammo` items for a bow/crossbow attack. */
interface GenericAttackerItem {
  id: string;
  type: string;
  system: Record<string, unknown>;
}

/** Resolves the attack-roll `proficiencyModifier` (per core/combat/attack.ts's
 *  AttackModifierInput doc comment) by matching `weapon` against the actor's
 *  weaponProficiency items — for a specific-weapon proficiency, by exact
 *  string against `weapon.system.baseWeaponName` (falling back to the item's
 *  own display `name` when that's blank, e.g. every weapon that predates this
 *  field), so a renamed/enchanted weapon ("Long Sword +1") still matches its
 *  "Long Sword" proficiency once its baseWeaponName is set back; or by
 *  `weaponOrGroup === weapon.system.proficiencyGroup` for a group
 *  proficiency (both -> "proficient", penalty 0). Only when neither matches AND
 *  the Skills & Powers expanded-proficiencies rule is on
 *  (`expandedProficienciesEnabled`), a held SPECIFIC-weapon proficiency in the
 *  same weapon group makes the weapon "related": half the non-proficiency
 *  penalty (`weaponAttackPenalty(p, "related")`), and no mastery bonus — mastery
 *  applies only in "proficient" mode. Uses the FIRST class item's chassis for
 *  the non-proficiency penalty and the mastery category-to-bonus lookup (a
 *  documented v1 simplification for multi-classed actors). Precedence:
 *  exact > group > related > non-proficient. Rule off -> exactly the pre-8b
 *  behavior. Tier 1 (Specialized) is the pre-existing, always-on mechanic;
 *  tiers 2-3 (Mastery/Grand Mastery) are gated behind the `weaponMastery`
 *  optional rule and capped back down to tier 1 when it's off. ROLL-time rule:
 *  `getOptionalRules()` is read fresh on every attack, so toggling a setting
 *  needs no reload. Returns both halves of `weaponMasteryEffect` — `damage`
 *  rides along in the attack card's `damageContext` for the separate "Roll
 *  Damage" button to apply later (README's tracked gap: this bonus was
 *  computed here but never carried anywhere). Grand Mastery's `extraAttacks`
 *  is deliberately still dropped — out of scope for this pass. */
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): { toHit: number; damage: number } {
  const rules = getOptionalRules();
  let exactMatch = false;
  let exactTier: 0 | 1 | 2 | 3 = 0;
  let groupMatch: { masteryTier?: 0 | 1 | 2 | 3 } | null = null;
  const heldSpecificGroups: string[] = [];
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as {
      weaponOrGroup?: string;
      isGroup?: boolean;
      masteryTier?: 0 | 1 | 2 | 3;
      proficiencyGroup?: string;
    };
    if (s.isGroup !== true && s.weaponOrGroup === (weapon.system.baseWeaponName || weapon.name)) {
      exactMatch = true;
      exactTier = s.masteryTier ?? 0;
      groupMatch = null;
      break;
    }
    if (s.isGroup === true && s.weaponOrGroup === weapon.system.proficiencyGroup && !groupMatch) {
      groupMatch = s;
    }
    if (s.isGroup !== true && s.proficiencyGroup) heldSpecificGroups.push(s.proficiencyGroup);
  }

  const relatedGroupMatch =
    expandedProficienciesEnabled(rules) && isRelatedGroup(weapon.system.proficiencyGroup, heldSpecificGroups);
  const mode = weaponProficiencyMode({ exactMatch, groupMatch: groupMatch !== null, relatedGroupMatch });
  const isProficient = mode === "proficient";
  const masteryTier = exactMatch ? exactTier : (groupMatch?.masteryTier ?? 0);

  let nonProficiencyPenalty = 0;
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) {
      nonProficiencyPenalty = getChassis(chassisId as ClassId).nonProficiencyPenalty;
      break;
    }
  }

  const base = weaponAttackPenalty(nonProficiencyPenalty, mode);
  // "related" and "non-proficient" never carry a mastery bonus.
  if (!isProficient || masteryTier === 0) return { toHit: base, damage: 0 };

  // Tier 1 (Specialized) is the pre-existing, always-on mechanic — it applies
  // regardless of the weaponMastery toggle, exactly like it did before this
  // plan. Tiers 2-3 are NEW behavior this plan adds, so they're capped back
  // down to tier 1 whenever the optional rule is off — a persisted
  // masteryTier of 2/3 doesn't silently keep granting its bonus after a GM
  // disables the rule (mirrors how criticalHits/armorTypeVsWeaponType are
  // both re-checked at roll time in this same file, not only at UI-render
  // time — spec §5's "not... rendered and then ignored server-side" applies
  // equally to a persisted tier as to an ephemeral per-roll UI choice).
  // `rules` is the single read at the top of the function.
  const masteryEnabled = rules.combatAndTacticsEnabled && rules.weaponMastery;
  const effectiveTier = masteryEnabled ? masteryTier : (Math.min(masteryTier, 1) as 0 | 1);

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  const effect = weaponMasteryEffect(effectiveTier, category);
  return { toHit: base + effect.toHit, damage: effect.damage };
}

/** Resolves whether `actor` is a thief and, if so, its thief-class level
 *  (for `backstabMultiplier`) — mirrors `proficiency-actions.ts`'s
 *  `primaryClassLevel`, kept as an independent re-derivation per this
 *  plan's established duplicate-re-validation pattern. */
function resolveThiefBackstabInfo(actor: AttackerActor): { isThief: boolean; thiefLevel: number } {
  const { xpPercent, rules } = actorLevelRulesFor(actor.items, "thief", getOptionalRules(), abilityScoresOf((actor as unknown as { system?: never }).system));
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const s = item.system as { chassisId?: string; xp?: number };
    if (s.chassisId === "thief") {
      return { isThief: true, thiefLevel: classItemLevel("thief", s.xp ?? 0, xpPercent, rules) };
    }
  }
  return { isThief: false, thiefLevel: 0 };
}

/** Sets a weapon Item to unequipped — the "weapon knocked away" operation
 *  used by a fumble's weaponDrops outcome, on the ATTACKER's own weapon. A
 *  disarm maneuver/called-shot's unequip outcome on the TARGET's weapon is a
 *  DIFFERENT actor's write (see the relay comment below) and goes through
 *  `applyEffectLocally`'s own "unequip" case (relay/apply-effect.ts) instead,
 *  which finds the target's first equipped weapon itself. */
async function unequipWeapon(weaponItem: { update(d: Record<string, unknown>): Promise<unknown> }): Promise<void> {
  await weaponItem.update({ "system.equipped": false });
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
  ammoItemId: string | null = null,
): Promise<void> {
  const weapon = actor.items.get(weaponItemId);
  if (!weapon) return;

  if (!canAct(actor.statuses)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.cannotActWarning"));
    return;
  }

  // A bow/crossbow deals no damage of its own — it must have a valid,
  // in-stock ammo item selected before anything else happens, checked here
  // (before the target/manual-AC prompt) so there's nothing to loose and
  // nothing to roll for damage without one.
  const weaponAmmoType = weapon.system.ammoType;
  let ammoToConsume: { id: string; quantity: number; update(d: Record<string, unknown>): Promise<unknown> } | null = null;
  if (weaponAmmoType) {
    const ammoItems = [...actor.items].filter((i) => i.type === "ammo");
    const stock: AmmoStock[] = ammoItems.map((i) => ({
      id: i.id,
      ammoType: String((i.system as { ammoType?: string }).ammoType ?? ""),
      quantity: Number((i.system as { quantity?: number }).quantity ?? 0),
    }));
    const candidates = matchingAmmo(stock, weaponAmmoType);
    const chosen = ammoItemId
      ? candidates.find((a) => a.id === ammoItemId)
      : defaultAmmoSelection(candidates, weapon.system.selectedAmmoId);
    if (!chosen) {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.noAmmoWarning"));
      return;
    }
    const handle = ammoItems.find((i) => i.id === chosen.id)! as unknown as {
      id: string; update(d: Record<string, unknown>): Promise<unknown>;
    };
    ammoToConsume = { id: handle.id, quantity: chosen.quantity, update: handle.update.bind(handle) };
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
    targetAc =
      info.ac +
      proneArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>()) +
      fatigueArmorClassPenalty((t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>());
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
  // `maneuverId` reaches us from a DOM <select>'s value, cast with
  // `as ManeuverId | null` in the sheet-layer caller — a compile-time
  // assertion, not a runtime guarantee. Look the descriptor up first and treat
  // an unknown id exactly like "no maneuver selected", so the plan's
  // never-trust-the-dropdown, always-re-validate-server-side rule is total and
  // an out-of-range id can't throw a TypeError mid-attack.
  const maneuverDescriptor = maneuverId ? MANEUVERS[maneuverId] : undefined;
  const maneuverAllowed =
    maneuverDescriptor !== undefined &&
    rules.combatAndTacticsEnabled &&
    (maneuverDescriptor.category === "calledShot" ? rules.calledShots : rules.combatManeuvers) &&
    !(maneuverId === "grapple" && rules.wrestling);
  const effectiveManeuverId = maneuverAllowed ? maneuverId : null;
  const maneuverPenalty = maneuverAllowed ? (maneuverDescriptor?.attackPenalty ?? 0) : 0;
  const proficiencyEffect = resolveProficiencyModifier(actor, weapon);
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: weapon.system.magicBonus,
    proficiencyModifier: proficiencyEffect.toHit,
    // STR/DEX modifiers remain out of scope (parent spec §7 boundary,
    // unchanged by this sub-project).
    situationalModifier:
      blindedAttackPenalty(actor.statuses) +
      fatigueAttackPenalty(actor.statuses) +
      entangledAttackPenalty(actor.statuses) +
      frightenedAttackPenalty(actor.statuses) +
      invisibleTargetPenalty(targetStatuses) +
      heldAttackBonus(targetStatuses) +
      armorVsWeaponModifier +
      maneuverPenalty,
  });
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  // Consumed here — hit or miss — and only after every earlier return point
  // (canAct, ammo validation, the manual-AC prompt) has passed, so cancelling
  // that prompt never costs an arrow.
  if (ammoToConsume) {
    await ammoToConsume.update({ "system.quantity": ammoToConsume.quantity - 1 });
  }
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const { isThief, thiefLevel } = resolveThiefBackstabInfo(actor);
  const backstabEligible = isThief && canBackstab({ category: weapon.system.category as never, damageType: weapon.system.damageType as never });
  const backstabActive = backstab && backstabEligible;

  const baseHit = hitResult({ naturalD20, attackBonus, thac0, targetAc });
  // #94: a helpless target (unconscious / paralyzed / sleeping) is a forced hit, like a backstab. targetStatuses is
  // empty on the manual-AC path, so nothing is helpless there. The d20 is still rolled so a natural 20 can crit.
  const helpless = isHelpless(targetStatuses);
  const hit = backstabActive || helpless ? { ...baseHit, hit: true, autoHit: true, autoMiss: false } : baseHit;

  const critEnabled = getOptionalRules().combatAndTacticsEnabled && getOptionalRules().criticalHits;
  const crit = critEnabled && baseHit.autoHit && !backstabActive ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  // A backstab's own forced-hit outcome (hit:true/autoHit:true, applied to
  // `hit` above) and its own backstabMultiplier mechanic are a complete,
  // self-contained resolution — fumble severity must never be checked for an
  // active backstab attempt, matching crit's existing non-stacking rule
  // above, or a natural-1 backstab roll would produce an incoherent chat
  // card claiming both "automatic hit" and "weapon drops" and genuinely
  // unequip the weapon on an attack just declared a guaranteed hit.
  // A helpless target cannot dodge or parry, so a natural 1 never fumbles against one either.
  const fumble = critEnabled && baseHit.autoMiss && !backstabActive && !helpless ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;

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

  // Resolved against `baseHit`, NOT the backstab-overridden `hit`: a backstab's
  // forced hit is its own complete, self-contained resolution (see the fumble
  // comment above), so it must not also hand a piggy-backed maneuver a
  // guaranteed stun/disarm on a roll that genuinely missed. A roll that hits on
  // its own merits still applies its maneuver effect whether or not backstab is
  // also active — backstab's damage multiplier is just a separate bonus on top.
  // Pure lookup, no side effects: safe to compute here, since the card's
  // maneuverLabel depends on it. The actual target mutation happens after the
  // chat card has posted (below).
  // A helpless target is hit automatically, so a piggy-backed maneuver lands too (unlike backstab, which is deliberately excluded).
  const maneuverEffect = resolveManeuverOutcome(effectiveManeuverId, baseHit.hit || helpless);

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: weapon.name, targetName,
    formula, naturalD20, hit, modifierBreakdown: breakdown,
    backstab: backstabActive,
    helpless,
    critLabel: crit ? `ADND2E.chat.attack.crit.${crit.tier}` : null,
    fumbleLabel: fumble ? `ADND2E.chat.attack.fumble.${fumble.tier}` : null,
    maneuverLabel: effectiveManeuverId && maneuverEffect ? `ADND2E.chat.attack.maneuverLabel.${effectiveManeuverId}` : null,
    damageContext: hit.hit
      ? {
          weaponItemId, actorUuid: (actor as unknown as { uuid: string }).uuid, targetSize,
          ammoItemId: ammoToConsume?.id ?? null,
          backstabMultiplier: backstabActive ? backstabMultiplier(thiefLevel) : null,
          critMultiplier: crit?.damageMultiplier ?? null,
          critFlatBonus: crit?.flatBonus ?? 0,
          specializationBonus: proficiencyEffect.damage,
        }
      : null,
  });

  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  const message = await roll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      content,
      flags: { adnd2e: { card: "attack", ...context.damageContext } },
    } as unknown as Roll.MessageData,
  );

  // A maneuver's effect MUTATES THE TARGET actor — `toggleStatusEffect` writes
  // an ActiveEffect on it, the "unequip" outcome updates an Item embedded in
  // it — and both need OWNER permission on that actor, which a player
  // attacking a GM-owned monster does not have. So this deliberately runs
  // AFTER `roll.toMessage()` and never rethrows: whatever goes wrong here (a
  // rejected write, a since-deleted actor, a future Foundry API change), the
  // dice the player already rolled must always reach chat. The effect now
  // relays through the active GM when the attacker doesn't own the target
  // (relay/relay-client.ts's `requestApply`), instead of being skipped with a
  // "the GM must apply this by hand" warning. A "push" (bull rush) outcome
  // is narrative-only — no persisted state change at all; the card's
  // maneuverLabel line alone communicates it.
  if (maneuverEffect && maneuverEffect.kind !== "push") {
    const maneuverTarget = (targets.length === 1 ? targets[0]!.actor : null) as
      | (EffectTarget & { uuid: string; isOwner: boolean })
      | null;
    if (maneuverTarget) {
      try {
        const changed = await requestApply(
          maneuverTarget,
          maneuverEffect.kind === "condition"
            ? { kind: "condition", targetUuid: maneuverTarget.uuid, conditionId: maneuverEffect.conditionId as RelayConditionId }
            : { kind: "unequip", targetUuid: maneuverTarget.uuid },
        );
        // An "unequip" outcome (disarm / called-shot weapon-hand) against an
        // already-unarmed target is the one maneuver effect that can silently
        // do nothing — requestApply's info toast alone isn't a durable
        // record, so the ALREADY-POSTED card's "Disarm succeeds!" line (which
        // had to be written before this relay round-trip resolved — see the
        // comment above) gets corrected in place, the same way a crit's
        // damage total is patched onto an already-posted roll elsewhere in
        // this codebase (creature/combat-rolls.ts's applyMessageMode path).
        if (!changed && maneuverEffect.kind === "unequip" && message) {
          const correctedContent = await foundry.applications.handlebars.renderTemplate(
            TEMPLATE_PATH("chat/attack-roll.hbs"),
            { ...context, maneuverLabel: "ADND2E.chat.attack.maneuverNoEffectUnequip" } as unknown as Record<string, unknown>,
          );
          await message.update({ content: correctedContent } as never);
        }
      } catch (err) {
        console.error(`${SYSTEM_ID} | failed to apply maneuver effect to the target`, err);
        ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.maneuverEffectFailedWarning"));
      }
    }
  }
}

/** Asks a yes/no question about the save being rolled; null = the dialog was dismissed. */
async function askSaveQuestion(titleKey: string, promptKey: string): Promise<boolean | null> {
  const answer = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n!.localize(titleKey) },
    content: `<p>${game.i18n!.localize(promptKey)}</p>`,
    rejectClose: false,
  });
  return answer === null || answer === undefined ? null : Boolean(answer);
}

/** Roll one of the 5 saving-throw categories using the actor's already-cached
 *  system.saves.<category>. `opts.penalty` (SP15 Plan D, e.g. -5) adds to the
 *  roll modifier. `opts.promptTags` (the sheet's save button) asks the
 *  circumstance questions no roll carries a tag for: whether a paralysis/poison
 *  save is against poison when the race's flat bonus differs for poison (Deep
 *  Gnome, #105), and whether a psionicist's save is against enchantment/charm
 *  (+2, #117). Resolves to whether the save succeeded (false if a prompt was
 *  dismissed — no roll is made). */
export async function rollSave(
  actor: {
    name: string; img: string; uuid: string;
    system: { saves: Record<SaveCategory, { target: number; rollModifier: number }> };
    items?: Iterable<{ type: string; system: unknown }>;
  },
  category: SaveCategory,
  opts: { penalty?: number; promptTags?: boolean } = {},
): Promise<boolean> {
  const save = actor.system.saves[category];
  let tagAdjustment = 0;
  if (opts.promptTags) {
    const items = [...(actor.items ?? [])];
    if (category === "ppd") {
      const raceItem = items.find((i) => i.type === "race");
      const delta = poisonSaveAdjustment(
        raceItem ? normalizeSubrace((raceItem.system as { subrace?: never }).subrace).flatSaveBonus : null,
      );
      if (delta !== 0) {
        const isPoison = await askSaveQuestion("ADND2E.chat.save.poisonPromptTitle", "ADND2E.chat.save.poisonPrompt");
        if (isPoison === null) return false;
        if (isPoison) tagAdjustment += delta;
      }
    }
    const charmBonus = enchantmentCharmSaveBonus(
      items.filter((i) => i.type === "class").map((i) => (i.system as { chassisId: string }).chassisId),
    );
    if (charmBonus !== 0) {
      const isCharm = await askSaveQuestion("ADND2E.chat.save.charmPromptTitle", "ADND2E.chat.save.charmPrompt");
      if (isCharm === null) return false;
      if (isCharm) tagAdjustment += charmBonus;
    }
  }
  const modifier = save.rollModifier + tagAdjustment + (opts.penalty ?? 0);
  const roll = await new Roll(`1d20${modifier ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ""}`).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: `ADND2E.saves.${category}`,
    formula: roll.formula, naturalD20, rollModifier: modifier, target: save.target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
    // SP9a: lets the active GM's client disrupt a cast on a failed save (PHB p.86)
    flags: { [SYSTEM_ID]: { save: { actorUuid: actor.uuid, success: context.success } } },
  } as never);
  return context.success;
}
