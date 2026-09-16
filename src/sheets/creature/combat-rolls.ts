import { resolveTargetCombatInfo } from "../character/combat-rolls";
import { buildAttackCardContext } from "../../combat/attack-card";
import { buildSaveCardContext } from "../../combat/save-card";
import { attackModifiers, hitResult } from "../../core/combat/attack";
import { attackFormula } from "../../core/dice/formula";
import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";

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
  system: {
    attributes: { thac0: { value: number } };
    attacks: CreatureAttack[];
    saves: { effective: Record<SaveCategory, number> };
  };
}

/** Roll one attack from `attacks[attackIndex]` against the current token
 *  target(s) (or a manually-entered AC, via DialogV2, when zero or more than
 *  one is targeted — mirrors the PC sheet's rollAttack exactly). On a hit,
 *  ALSO immediately rolls `attack.damage` and posts it as a second message
 *  using Foundry's own default roll card (no custom template) — a creature's
 *  damage is already one fixed formula with no target-size dependency, so
 *  there's no need for the PC sheet's separate "Roll Damage" button/step. */
export async function rollAttack(actor: CreatureActor, attackIndex: number): Promise<void> {
  const attack = actor.system.attacks[attackIndex];
  if (!attack) return;

  const targets = [...(game as unknown as { user: { targets: Iterable<{ name: string; actor: unknown }> } }).user.targets];
  let targetName: string | null = null;
  let targetAc: number;

  if (targets.length === 1) {
    const t = targets[0]!;
    targetName = t.name;
    targetAc = resolveTargetCombatInfo(t.actor as Parameters<typeof resolveTargetCombatInfo>[0]).ac;
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

  const thac0 = attack.thac0Override ?? actor.system.attributes.thac0.value;
  // A monster's THAC0 already bakes in every modifier PHB combat tables would
  // otherwise apply separately — no strength/proficiency/range term is
  // modeled here, matching how a 2E stat block is authored (spec §7).
  const { total: attackBonus, breakdown } = attackModifiers({});
  const formula = attackFormula(attackBonus);
  const roll = await new Roll(formula).evaluate();
  const naturalD20 = roll.dice[0]?.total ?? 0;
  const hit = hitResult({ naturalD20, attackBonus, thac0, targetAc });

  const context = buildAttackCardContext({
    actorName: actor.name, actorImg: actor.img,
    weaponName: attack.name, targetName,
    formula, naturalD20, hit, backstab: false, modifierBreakdown: breakdown,
    damageContext: null,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/attack-roll.hbs"), context as unknown as Record<string, unknown>,
  );
  await roll.toMessage(
    { speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as unknown as Roll.MessageData,
  );

  if (hit.hit) {
    const damageRoll = await new Roll(attack.damage).evaluate();
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor as never }),
      flavor: game.i18n!.format("ADND2E.chat.creature.damageFlavor", { name: attack.name }),
    } as unknown as Roll.MessageData);
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
