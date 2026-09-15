import { getChassis } from "../../core/classes/chassis";
import type { ClassId, SphereName } from "../../core/types";
import { buildCastCardContext } from "../../magic/cast-card";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
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
    spheres: string[];
    range: string;
    duration: string;
    castingTime: string;
    savingThrow: string;
    components: { v: boolean; s: boolean; m: boolean };
    automation: { damage: string | null; healing: string | null };
  };
}

/** Minimal shape spell-actions needs from a non-spell embedded item — just
 *  enough to find the priest-progression class item (see
 *  `findPriestChassisId`). */
interface GenericItemHandle {
  type: string;
  system: Record<string, unknown>;
}

interface SpellcasterActor {
  name: string;
  img: string;
  system: {
    spellcasting: {
      wizard: {
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        spellbookItemIds: string[];
      };
      priest: {
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        sphereAccessOverride: string[] | null;
      };
    };
  };
  items: { get(id: string): SpellItemHandle | undefined } & Iterable<GenericItemHandle>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

function casterKey(spell: SpellItemHandle): "wizard" | "priest" {
  return spell.system.casterClass === "priest" ? "priest" : "wizard";
}

/** Finds the actor's priest-progression class item (if any) and returns its
 *  chassisId. Mirrors context.ts's `buildSpells` lookup exactly (same
 *  "iterate class items, ask getChassis().spellProgressionId" pattern) so
 *  this re-validation can't drift from what the render-context layer already
 *  showed the user. Returns null when the actor has no priest-progression
 *  class (canMemorizePriestSpell always returns false for a null chassisId). */
function findPriestChassisId(actor: SpellcasterActor): ClassId | null {
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = item.system.chassisId as ClassId | undefined;
    if (chassisId && getChassis(chassisId).spellProgressionId === "priest") return chassisId;
  }
  return null;
}

/** Re-derives the same eligibility context.ts's `buildSpellRow` already
 *  computed for the render layer (already memorized / free slot at the
 *  spell's level / in-spellbook or sphere-access eligible), so memorizeSpell
 *  can defensively re-check a stale or raced click without its logic ever
 *  diverging from what the Memorize button's visibility was based on. */
function canReMemorize(actor: SpellcasterActor, spell: SpellItemHandle): boolean {
  const key = casterKey(spell);
  const sc = actor.system.spellcasting[key];
  if (sc.memorized.some((m) => m.spellItemId === spell.id)) return false;

  const slotRow = sc.slots[spell.system.level];
  const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
  if (!hasFreeSlot) return false;

  if (key === "wizard") {
    return actor.system.spellcasting.wizard.spellbookItemIds.includes(spell.id);
  }
  const priestChassisId = findPriestChassisId(actor);
  const sphereAccessOverride = actor.system.spellcasting.priest.sphereAccessOverride as SphereName[] | null;
  return canMemorizePriestSpell(
    priestChassisId,
    sphereAccessOverride,
    spell.system.spheres as SphereName[],
    spell.system.level,
  );
}

/** Adds `spellItemId` to the actor's memorized list for its own caster type
 *  and spell level, if it isn't already memorized, there's a free slot at
 *  its level, and it's still eligible (in spellbook / sphere access allows
 *  it) — re-derived via `canReMemorize`, the same logic the render layer
 *  used to decide whether to show the Memorize button at all. This is a
 *  defensive re-check against a stale button click or a fast double-click
 *  race, not the primary gate; when it fails, no write happens and the user
 *  gets a toast instead of silence. */
export async function memorizeSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell || !canReMemorize(actor, spell)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.memorizeBlockedWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const updated: MemorizedEntry[] = [...list, { spellItemId, spellLevel: spell.system.level, expended: false }];
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
}

/** Removes `spellItemId` from the actor's memorized list, regardless of its
 *  expended state. Searches BOTH the wizard and priest memorized lists
 *  (rather than deriving the list from the spell Item's casterClass) so an
 *  orphaned entry — one whose underlying spell Item was deleted from the
 *  actor while still memorized — can still be forgotten; there is no other
 *  way to reclaim that slot once the item is gone. No-ops (no write) only
 *  when the id isn't found in either list — a silent no-op here is fine,
 *  the sheet only shows Forget when the spell is memorized. */
export async function forgetSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  for (const key of ["wizard", "priest"] as const) {
    const list = actor.system.spellcasting[key].memorized;
    if (!list.some((m) => m.spellItemId === spellItemId)) continue;
    const updated = list.filter((m) => m.spellItemId !== spellItemId);
    await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
    return;
  }
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

/** Casts a memorized, non-expended spell: rolls its automation.damage/
 *  healing formula if set (damage takes priority if a spell somehow set both
 *  — the schema doesn't prevent it, but no v1 content should), marks it
 *  expended only once that roll has succeeded, and posts a cast chat card
 *  with an Apply button when there was a roll.
 *
 *  Roll-then-mark (rather than mark-then-roll) is deliberate: `automation.
 *  damage`/`automation.healing` are free-form author-entered strings with no
 *  format validation, so `new Roll(formula).evaluate()` can throw on a typo
 *  (e.g. "2d6+"). Evaluating the roll first means a malformed formula never
 *  burns the spell with no chat card and no feedback — it's caught below and
 *  the user gets a toast instead. This doesn't reopen a double-cast race:
 *  `Roll.evaluate()` here is local dice math, not a network round trip —
 *  the only network step is the `actor.update` that marks the entry
 *  expended, and that fires at the same point in the sequence (just after
 *  the roll now succeeds) whichever order it's in.
 *
 *  No-ops if the spell is missing, not memorized, or already expended (same
 *  defensive-re-check role as memorizeSpell) — with a toast in every no-op
 *  case, since a double-clicked stale Cast button should never be silent. */
export async function castSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const entry = list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }

  let roll: Awaited<ReturnType<InstanceType<typeof Roll>["evaluate"]>> | null = null;
  let rollResult: { kind: "damage" | "healing"; formula: string; total: number } | null = null;
  const { damage, healing } = spell.system.automation;
  const formula = damage || healing;
  if (formula) {
    try {
      roll = await new Roll(formula).evaluate();
    } catch {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castRollFailedWarning"));
      return;
    }
    rollResult = { kind: damage ? "damage" : "healing", formula, total: roll.total ?? 0 };
  }

  const updated = list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m));
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });

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
  const speaker = ChatMessage.getSpeaker({ actor: actor as never });
  if (roll) {
    await roll.toMessage({ speaker, content } as unknown as Roll.MessageData);
  } else {
    await ChatMessage.create({ speaker, content } as unknown as ChatMessage.CreateData);
  }
}
