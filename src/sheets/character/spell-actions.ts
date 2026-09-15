import { buildCastCardContext } from "../../magic/cast-card";
import { TEMPLATE_PATH } from "../../constants";

/* ---------------------------------------------------------------------------
 * spell-actions — SP4a.
 *
 * Foundry-coupled memorize/forget/cast/rest glue for the character sheet's
 * Spells tab — not unit-tested (spec §9-equivalent for this plan), verified
 * in a linked dev world. All chat-card shaping is delegated to the pure
 * magic/cast-card module; this file only reads documents, writes the
 * memorized array, rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

interface MemorizedEntry {
  spellItemId: string;
  spellLevel: number;
  expended: boolean;
}

interface SpellItemHandle {
  id: string;
  name: string;
  system: {
    casterClass: string;
    level: number;
    range: string;
    duration: string;
    castingTime: string;
    savingThrow: string;
    components: { v: boolean; s: boolean; m: boolean };
    automation: { damage: string | null; healing: string | null };
  };
}

interface SpellcasterActor {
  name: string;
  img: string;
  system: {
    spellcasting: {
      wizard: { memorized: MemorizedEntry[] };
      priest: { memorized: MemorizedEntry[] };
    };
  };
  items: { get(id: string): SpellItemHandle | undefined };
  update(data: Record<string, unknown>): Promise<unknown>;
}

function casterKey(spell: SpellItemHandle): "wizard" | "priest" {
  return spell.system.casterClass === "priest" ? "priest" : "wizard";
}

/** Adds `spellItemId` to the actor's memorized list for its own caster type
 *  and spell level, if it isn't already memorized. No-ops (does not write)
 *  if the spell is missing or already memorized — the sheet only shows the
 *  Memorize button when `SpellItemView.canMemorize` is true, so this is a
 *  defensive re-check against a stale button click, not the primary gate. */
export async function memorizeSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) return;
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  if (list.some((m) => m.spellItemId === spellItemId)) return;
  const updated: MemorizedEntry[] = [...list, { spellItemId, spellLevel: spell.system.level, expended: false }];
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
}

/** Removes `spellItemId` from the actor's memorized list, regardless of its
 *  expended state. No-ops if the spell isn't memorized. */
export async function forgetSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) return;
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const updated = list.filter((m) => m.spellItemId !== spellItemId);
  if (updated.length === list.length) return;
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
}

/** Clears every memorized entry's `expended` flag on both casters, without
 *  changing which spells are memorized. */
export async function restSpellcasting(actor: SpellcasterActor): Promise<void> {
  const wizard = actor.system.spellcasting.wizard.memorized.map((m) => ({ ...m, expended: false }));
  const priest = actor.system.spellcasting.priest.memorized.map((m) => ({ ...m, expended: false }));
  await actor.update({
    "system.spellcasting.wizard.memorized": wizard,
    "system.spellcasting.priest.memorized": priest,
  });
}

/** Casts a memorized, non-expended spell: marks it expended, rolls its
 *  automation.damage/healing formula if set (damage takes priority if a
 *  spell somehow set both — the schema doesn't prevent it, but no v1 content
 *  should), and posts a cast chat card with an Apply button when there was a
 *  roll. No-ops if the spell is missing, not memorized, or already expended
 *  (same defensive-re-check role as memorizeSpell). */
export async function castSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) return;
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const entry = list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) return;

  const updated = list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m));
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });

  let rollResult: { kind: "damage" | "healing"; formula: string; total: number } | null = null;
  const { damage, healing } = spell.system.automation;
  if (damage) {
    const roll = await new Roll(damage).evaluate();
    rollResult = { kind: "damage", formula: damage, total: roll.total ?? 0 };
  } else if (healing) {
    const roll = await new Roll(healing).evaluate();
    rollResult = { kind: "healing", formula: healing, total: roll.total ?? 0 };
  }

  const context = buildCastCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell.name,
    spellLevel: spell.system.level,
    range: spell.system.range,
    duration: spell.system.duration,
    castingTime: spell.system.castingTime,
    savingThrow: spell.system.savingThrow,
    components: spell.system.components,
    rollResult,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/cast-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as ChatMessage.CreateData);
}
