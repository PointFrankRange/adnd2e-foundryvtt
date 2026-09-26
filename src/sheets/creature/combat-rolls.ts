import { resolveTargetCombatInfo } from "../character/combat-rolls";
import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { blindedAttackPenalty, canAct, heldAttackBonus, proneArmorClassPenalty } from "../../combat/condition-effects";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { criticalSeverity, fumbleSeverity } from "../../combat/critical";
import { monsterWeaponDamageFormula } from "../../combat/monster-gear";
import { getOptionalRules } from "../../settings";
import { TEMPLATE_PATH } from "../../constants";
import type { CreatureSize, SaveCategory } from "../../core/types";

/* ---------------------------------------------------------------------------
 * combat-rolls — SP6, creature-shaped.
 *
 * Foundry-coupled Roll Attack / Roll Save glue for the creature sheet — not
 * unit-tested (matches src/sheets/character/combat-rolls.ts's established
 * convention), verified in a linked dev world. Reuses the SAME core/combat
 * math and the SAME chat-card builders/templates the PC sheet already uses —
 * a creature attacker/saver produces the identical AttackCardContext/
 * SaveCardContext shapes, just assembled from CreatureModel's flat fields
 * instead of a weapon Item + class/proficiency lookups.
 * ------------------------------------------------------------------------- */

interface CreatureAttack {
  name: string;
  count: number;
  damage: string;
  thac0Override: number | null;
  type: "melee" | "ranged";
  special: string;
}

interface CreatureActor {
  name: string; img: string; uuid: string;
  statuses: ReadonlySet<string>;
  system: {
    attributes: { thac0: { value: number } };
    attacks: CreatureAttack[];
    saves: { effective: Record<SaveCategory, number> };
  };
}

/** Applies the world's current chat-message visibility mode (Public/Private
 *  GM Roll/Blind Roll/Self Roll) to a chat-message data object, the same way
 *  `Roll#toMessage()` does internally before creating its ChatMessage.
 *  Verified against real v14.364 source: `client/dice/roll.mjs`'s
 *  `Roll#toMessage` does `messageMode ||= game.settings.get("core",
 *  "messageMode"); ... msg.applyMode(messageMode)`, and
 *  `client/documents/chat-message.mjs`'s INSTANCE `applyMode(mode)` is a
 *  thin wrapper (`this.constructor.applyMode(this.toObject(), mode)`) around
 *  the STATIC `ChatMessage.applyMode(chatData, mode)` used here directly
 *  (the shape this file already has — a plain data object, not yet a
 *  ChatMessage instance). The OLDER `ChatMessage.applyRollMode`/
 *  `"core.rollMode"` pair (still what fvtt-types' pinned v13-beta snapshot
 *  types, hence the casts below) now only exist as a one-time-warning
 *  compatibility shim that delegates to these same two v14 real APIs. */
function applyMessageMode(chatData: Record<string, unknown>): Record<string, unknown> {
  const mode = (game as unknown as { settings: { get(namespace: string, key: string): string } }).settings.get(
    "core",
    "messageMode",
  );
  return (
    ChatMessage as unknown as {
      applyMode(data: Record<string, unknown>, mode: string): Record<string, unknown>;
    }
  ).applyMode(chatData, mode);
}

interface AttackSource {
  name: string;
  thac0: number;
  /** 0 for stat-block attacks; the weapon's magic bonus for weapon attacks */
  weaponMagicBonus: number;
  /** the damage formula for a hit against a target of this size (null = none to roll) */
  damageFormula(targetSize: CreatureSize | null): string | null;
}

/** Roll one attack from `attacks[attackIndex]` against the current token
 *  target(s) (or a manually-entered AC, via DialogV2, when zero or more than
 *  one is targeted — mirrors the PC sheet's rollAttack exactly). Delegates to
 *  `rollCreatureAttack` (Monster NPC inventory plan Task 3) with the
 *  stat-block's own THAC0 (no weapon magic bonus, no target-size dependency
 *  in its damage) — behavior-identical to the pre-Task-3 inline version. */
export async function rollAttack(actor: CreatureActor, attackIndex: number): Promise<void> {
  const attack = actor.system.attacks[attackIndex];
  if (!attack) return;
  await rollCreatureAttack(actor, {
    name: attack.name,
    thac0: attack.thac0Override ?? actor.system.attributes.thac0.value,
    weaponMagicBonus: 0,
    damageFormula: () => attack.damage,
  });
}

/** Attack with an EQUIPPED weapon item: monster THAC0 + the weapon's magic bonus,
 *  the weapon's S-M / L damage by target size (Monster NPC gear design). */
export async function rollWeaponAttack(actor: CreatureActor & { items: { get(id: string): unknown } }, itemId: string): Promise<void> {
  const item = actor.items.get(itemId) as
    | { name: string; type: string; system: { equipped?: boolean; category: string; magicBonus: number; damageVsSM: string | null; damageVsL: string | null } }
    | undefined;
  if (!item || item.type !== "weapon" || !item.system.equipped) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.creature.weaponAttackBlockedWarning"));
    return;
  }
  const weapon = { category: item.system.category, magicBonus: item.system.magicBonus ?? 0, damageVsSM: item.system.damageVsSM, damageVsL: item.system.damageVsL };
  await rollCreatureAttack(actor, {
    name: item.name,
    thac0: actor.system.attributes.thac0.value,
    weaponMagicBonus: weapon.magicBonus,
    damageFormula: (size) => monsterWeaponDamageFormula(weapon, size),
  });
}

/** Shared Roll Attack routine for both a stat-block attack (`rollAttack`) and
 *  an equipped-weapon attack (`rollWeaponAttack`) — on a hit, ALSO
 *  immediately rolls the source's damage formula and posts it as a second
 *  message using templates/chat/creature-damage.hbs — a creature's damage is
 *  already one fixed formula (or, for a weapon, resolved by target size)
 *  with no separate roll step, so there's no need for the PC sheet's
 *  separate "Roll Damage" button/step; the card carries its own "Apply to
 *  Targeted Token(s)" button (chat-listeners.ts's `applyDamage`, routed
 *  through the relay) instead. */
async function rollCreatureAttack(actor: CreatureActor, source: AttackSource): Promise<void> {
  if (!canAct(actor.statuses)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.cannotActWarning"));
    return;
  }

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;
  let targetSize: CreatureSize | null = null;
  let targetStatuses: ReadonlySet<string> = new Set<string>();

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    targetStatuses = (t.actor as { statuses?: ReadonlySet<string> }).statuses ?? new Set<string>();
    const info = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]);
    targetAc = info.ac + proneArmorClassPenalty(targetStatuses);
    targetSize = info.size as CreatureSize | null;
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

  const thac0 = source.thac0;
  // A monster's THAC0 already bakes in every modifier PHB combat tables would
  // otherwise apply separately — no strength/proficiency/range term is
  // modeled here, matching how a 2E stat block is authored (spec §7). The
  // weapon's magic bonus (0 for a stat-block attack) is the only addition an
  // equipped weapon contributes here.
  const { total: attackBonus, breakdown } = attackModifiers({
    weaponMagicBonus: source.weaponMagicBonus,
    situationalModifier: blindedAttackPenalty(actor.statuses) + heldAttackBonus(targetStatuses),
  });
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const hit = hitResult({ naturalD20, attackBonus, thac0, targetAc });

  const critEnabled = getOptionalRules().combatAndTacticsEnabled && getOptionalRules().criticalHits;
  const crit = critEnabled && hit.autoHit ? criticalSeverity(Math.ceil(Math.random() * 10)) : null;
  const fumble = critEnabled && hit.autoMiss ? fumbleSeverity(Math.ceil(Math.random() * 10)) : null;

  if (fumble?.effect === "selfInjury" && fumble.selfInjuryDice) {
    const selfRoll = await new Roll(fumble.selfInjuryDice).evaluate();
    await selfRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.localize("ADND2E.chat.attack.fumbleSelfInjury"),
    } as unknown as Roll.MessageData);
  }
  // Neither a stat-block attack nor an equipped-weapon attack unequips
  // anything on a "weapon drops" fumble here: attacks[] is a flat array with
  // no weapon Item to unequip, and an equipped weapon's own drop-on-fumble
  // outcome is out of this plan's v1 scope (matches the PC sheet's Task 1-4
  // boundary being about DAMAGE, not fumble effects) — a deliberate v1 scope
  // boundary carried over unchanged from the pre-Task-3 rollAttack.

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: source.name, targetName,
    formula, naturalD20, hit, backstab: false, modifierBreakdown: breakdown,
    critLabel: crit ? `ADND2E.chat.attack.crit.${crit.tier}` : null,
    fumbleLabel: fumble ? `ADND2E.chat.attack.fumble.${fumble.tier}` : null,
    maneuverLabel: null,
    damageContext: null,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage(
    { speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as unknown as Roll.MessageData,
  );

  if (hit.hit) {
    const damageFormula = source.damageFormula(targetSize);
    // `damageFormula` is falsy both for `null` (no die modeled — a weapon
    // with no S-M/L dice authored) and for `""` (a stat-block attack whose
    // `damage` field was left blank) — skipping the roll in both cases,
    // rather than calling `new Roll("")`, is this refactor's one intentional
    // behavior change from the pre-Task-3 code; see the Task 3 report.
    if (damageFormula) {
      const damageRoll = await new Roll(damageFormula).evaluate();
      const flavor = game.i18n!.format("ADND2E.chat.creature.damageFlavor", { name: source.name });
      const renderDamage = (total: number, crit: boolean) =>
        foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/creature-damage.hbs"), {
          formula: damageRoll.formula,
          total,
          crit,
        });
      if (!crit) {
        await damageRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: actor as never }),
          flavor,
          content: await renderDamage(damageRoll.total ?? 0, false),
        } as unknown as Roll.MessageData);
      } else {
        // A crit multiplies/boosts the total, which Roll#toMessage() cannot
        // display while keeping the real evaluated roll attached (it always
        // shows the roll's own unmodified total) — this branch ONLY runs for
        // an active crit, never for a normal hit. Verified against real
        // v14.364 source (client/dice/roll.mjs Roll#toMessage,
        // client/documents/chat-message.mjs #renderRollContent): this mirrors
        // exactly what Roll#toMessage() itself does internally
        // (`messageData.rolls = [this]; ChatMessage.create(...)`), and a
        // custom `content` containing at least one HTML element is preserved
        // rather than overwritten by the default roll card. Also mirrors
        // Roll#toMessage()'s OWN roll-mode application step, via
        // `applyMessageMode` below, so a crit doesn't bypass the world's
        // Private GM Roll / Blind Roll / Self Roll setting the way a bare
        // ChatMessage.create() call would.
        const finalDamageTotal = (damageRoll.total ?? 0) * crit.damageMultiplier + crit.flatBonus;
        const messageData = applyMessageMode({
          speaker: ChatMessage.getSpeaker({ actor: actor as never }),
          content: await renderDamage(finalDamageTotal, true),
          flavor,
          rolls: [damageRoll],
        });
        await ChatMessage.create(messageData as unknown as Record<string, unknown>);
      }
    }
  }
}

/** Roll one of the 5 saving-throw categories against the actor's already-
 *  derived system.saves.effective.<category> — no separate rollModifier
 *  concept exists for a creature (unlike a PC's race/class/level-composed
 *  save), so this always rolls a flat 1d20 and reuses buildSaveCardContext/
 *  save-roll.hbs UNCHANGED with rollModifier fixed at 0. */
export async function rollSave(actor: CreatureActor, category: SaveCategory): Promise<void> {
  const target = actor.system.saves.effective[category];
  const roll = await new Roll("1d20").evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const context = buildSaveCardContext({
    actorName: actor.name, actorImg: actor.img,
    categoryLabel: `ADND2E.saves.${category}`,
    formula: roll.formula, naturalD20, rollModifier: 0, target,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/save-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content });
}
