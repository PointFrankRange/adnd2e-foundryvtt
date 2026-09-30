import { getChassis } from "../../core/classes/chassis";
import { canAffordCast, channellersEnabled, recoverSp, spendCastSp, type ChannellerActivity } from "../../core/magic/channellers";
import { canAffordMemorize, spellPointsEnabled, spellsMemorizedAtLevel } from "../../core/magic/spell-points";
import { canLearnSpell, learnSpellRoll } from "../../core/magic/spellbook";
import type { ClassId, IntelligenceModifiers, SphereName, WizardSchool } from "../../core/types";
import { WIZARD_SCHOOLS } from "../../data/item/choices";
import { buildCastCardContext } from "../../magic/cast-card";
import { buildLearnSpellCardContext } from "../../magic/learn-spell-card";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import { TEMPLATE_PATH } from "../../constants";
import { getOptionalRules } from "../../settings";

/* ---------------------------------------------------------------------------
 * spell-actions — SP4a.
 *
 * Foundry-coupled memorize/forget/cast/rest glue for the character sheet's
 * Spells tab — not unit-tested (spec §9-equivalent for this plan), verified
 * in a linked dev world. All chat-card shaping is delegated to the pure
 * magic/cast-card module; this file only reads documents, writes the
 * memorized array, rolls dice, and posts chat messages.
 * ------------------------------------------------------------------------- */

export interface MemorizedEntry {
  spellItemId: string | null;
  spellLevel: number;
  expended: boolean;
  /** Sub-project 14 Plan A; absent means fixed magick (or the rule has never been on for this entry) */
  magickType?: "fixed" | "free";
}

export interface SpellItemHandle {
  id: string;
  name: string;
  system: {
    casterClass: string;
    level: number;
    schools: string[];
    spheres: string[];
    range: string;
    duration: string;
    castingTime: string;
    savingThrow: string;
    components: { v: boolean; s: boolean; m: boolean };
    automation: { damage: string | null; healing: string | null };
  };
}

/** Minimal shape spell-actions needs from any embedded item — enough to find
 *  the priest-progression class item (see `findPriestChassisId`) and to
 *  count spellbook-member wizard spells at a level (see `learnSpell`'s
 *  `knownAtThisLevel`). */
interface GenericItemHandle {
  id: string;
  type: string;
  system: Record<string, unknown>;
}

export interface SpellcasterActor {
  name: string;
  img: string;
  system: {
    abilities: { int: { mods: IntelligenceModifiers } };
    spellcasting: {
      wizard: {
        specialistSchool: string | null;
        memorized: MemorizedEntry[];
        slots: Record<string, { max: number; used: number }>;
        spellPoints: { maxSpellLevel?: number; maxPerLevel?: number; sp?: number; spent?: number; remaining?: number };
        channelling: { current?: number; max?: number };
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

export function casterKey(spell: SpellItemHandle): "wizard" | "priest" {
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

/** Table-17-based eligibility for a wizard spell-points memorize (fixed or
 *  free magick): the spell's level must be within the wizard's cached Table
 *  17/Intelligence max, there must be room under the flat per-level cap, and
 *  enough spell points left. `sp.maxSpellLevel` is absent (cached as `{}`)
 *  when the rule is off or the actor has no wizard levels. */
function canMemorizeWizardSpellPoints(actor: SpellcasterActor, spellLevel: number, magickType: "fixed" | "free"): boolean {
  const sp = actor.system.spellcasting.wizard.spellPoints;
  if (typeof sp.maxSpellLevel !== "number") return false;
  if (spellLevel > sp.maxSpellLevel) return false;
  const atLevel = spellsMemorizedAtLevel(actor.system.spellcasting.wizard.memorized, spellLevel);
  if (atLevel >= (sp.maxPerLevel ?? 0)) return false;
  // Sub-project 14 Plan B: a channeller's slate selection costs nothing from
  // the pool (design spec §1.1) — only the Table 17 caps above still gate it.
  if (channellersEnabled(getOptionalRules())) return true;
  return canAffordMemorize(sp.sp ?? 0, sp.spent ?? 0, spellLevel, magickType);
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

  if (key === "wizard" && spellPointsEnabled(getOptionalRules())) {
    if (!canMemorizeWizardSpellPoints(actor, spell.system.level, "fixed")) return false;
  } else {
    const slotRow = sc.slots[spell.system.level];
    const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
    if (!hasFreeSlot) return false;
  }

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
  const magickType: "fixed" | undefined = key === "wizard" && spellPointsEnabled(getOptionalRules()) ? "fixed" : undefined;
  const updated: MemorizedEntry[] = [...list, { spellItemId, spellLevel: spell.system.level, expended: false, magickType }];
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

export type SpellRoll = Awaited<ReturnType<InstanceType<typeof Roll>["evaluate"]>>;
export type SpellRollResult = { kind: "damage" | "healing"; formula: string; total: number };

/** Rolls the spell's automation formula (damage wins over healing). `null` means the formula failed to roll — a toast was shown. */
export async function rollSpellAutomation(
  spell: SpellItemHandle,
): Promise<{ roll: SpellRoll | null; rollResult: SpellRollResult | null } | null> {
  const { damage, healing } = spell.system.automation;
  const formula = damage || healing;
  if (!formula) return { roll: null, rollResult: null };
  try {
    const roll = await new Roll(formula).evaluate();
    return { roll, rollResult: { kind: damage ? "damage" : "healing", formula, total: roll.total ?? 0 } };
  } catch {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castRollFailedWarning"));
    return null;
  }
}

/** Posts the normal cast chat card (with an Apply button when there was a roll). */
export async function postCastCard(
  actor: SpellcasterActor,
  spell: SpellItemHandle,
  rolled: { roll: SpellRoll | null; rollResult: SpellRollResult | null },
): Promise<void> {
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
    rollResult: rolled.rollResult,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/cast-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  const speaker = ChatMessage.getSpeaker({ actor: actor as never });
  if (rolled.roll) {
    await rolled.roll.toMessage({ speaker, content } as unknown as Roll.MessageData);
  } else {
    await ChatMessage.create({ speaker, content } as unknown as ChatMessage.CreateData);
  }
}

/** Sub-project 14 Plan B: shared per-cast afford-check for a channelling
 *  wizard, used by castSpell, castFreeMagick, and castOrBegin's begin-path
 *  (casting-actions.ts) so every cast entry point spends from the same pool
 *  the same way. Shows the blocked-cast warning and returns null if the pool
 *  can't afford it; otherwise returns the new (not-yet-persisted) current
 *  value for the caller to write via actor.update. */
export function tryChannellingSpend(
  actor: SpellcasterActor,
  spellLevel: number,
  magickType: "fixed" | "free",
): number | null {
  const current = actor.system.spellcasting.wizard.channelling.current ?? 0;
  if (!canAffordCast(current, spellLevel, magickType)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return null;
  }
  return spendCastSp(current, spellLevel, magickType);
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
 *  case, since a double-clicked stale Cast button should never be silent.
 *
 *  Sub-project 14 Plan B: for a channelling wizard, the entry is NEVER marked
 *  expended — casting instead spends from `channelling.current` via the
 *  shared `tryChannellingSpend` helper above (afford-checked before rolling,
 *  persisted only once the roll succeeds, same ordering as the classic path). */
export async function castSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (!spell) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  const key = casterKey(spell);
  const list = actor.system.spellcasting[key].memorized;
  const channelling = key === "wizard" && channellersEnabled(getOptionalRules());
  // A channelling entry is never expended (spec §2) — any match is castable
  // subject to affordability, checked below; the classic path still requires
  // a non-expended entry.
  const entry = channelling
    ? list.find((m) => m.spellItemId === spellItemId)
    : list.find((m) => m.spellItemId === spellItemId && !m.expended);
  if (!entry) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  if (channelling) {
    const spent = tryChannellingSpend(actor, entry.spellLevel, entry.magickType ?? "fixed");
    if (spent === null) return;
    const rolled = await rollSpellAutomation(spell);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spent,
    });
    await postCastCard(actor, spell, rolled);
    return;
  }
  const rolled = await rollSpellAutomation(spell);
  if (!rolled) return;
  const updated = list.map((m) => (m.spellItemId === spellItemId ? { ...m, expended: true } : m));
  await actor.update({ [`system.spellcasting.${key}.memorized`]: updated });
  await postCastCard(actor, spell, rolled);
}

/** Attempts to learn a wizard spell not yet in the spellbook: re-derives the
 *  same eligibility context.ts's `buildSpellRow` used to decide whether to
 *  show the Learn Spell button (not a priest spell, not already in the
 *  spellbook, has a recognizable WizardSchool tag among its `schools`,
 *  `canLearnSpell` allows it), then rolls 1d100 against the computed chance.
 *  Always posts a chat card — showing the rejection reason when
 *  `canLearnSpell` disallows it, or the roll and pass/fail outcome
 *  otherwise. On success, adds the item id to `spellbookItemIds`. No
 *  cooldown/retry-limit is tracked (spec §2's Learn Spell decision row). */
export async function learnSpell(actor: SpellcasterActor, spellItemId: string): Promise<void> {
  const spell = actor.items.get(spellItemId);
  if (
    !spell ||
    spell.system.casterClass !== "wizard" ||
    actor.system.spellcasting.wizard.spellbookItemIds.includes(spellItemId) ||
    (actor.system.spellcasting.wizard.slots[spell.system.level]?.max ?? 0) === 0
  ) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.learnBlockedWarning"));
    return;
  }

  const wizardSchool = spell.system.schools.find((s): s is WizardSchool =>
    (WIZARD_SCHOOLS as readonly string[]).includes(s),
  );
  if (!wizardSchool) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.learnBlockedWarning"));
    return;
  }

  const knownAtThisLevel = [...actor.items].filter((i) => {
    if (i.type !== "spell") return false;
    const s = i.system as { casterClass?: string; level?: number };
    return (
      s.casterClass === "wizard" &&
      s.level === spell.system.level &&
      actor.system.spellcasting.wizard.spellbookItemIds.includes(i.id)
    );
  }).length;

  const result = canLearnSpell({
    int: actor.system.abilities.int.mods,
    spellLevel: spell.system.level,
    spellSchool: wizardSchool,
    specialistSchool: actor.system.spellcasting.wizard.specialistSchool as WizardSchool | null,
    knownAtThisLevel,
    options: getOptionalRules(),
  });

  let roll: { d100: number; success: boolean } | null = null;
  if (result.allowed) {
    const d100Roll = await new Roll("1d100").evaluate();
    const d100 = d100Roll.total ?? 0;
    const success = learnSpellRoll(d100, result.chance);
    roll = { d100, success };
    if (success) {
      const updated = [...actor.system.spellcasting.wizard.spellbookItemIds, spellItemId];
      await actor.update({ "system.spellcasting.wizard.spellbookItemIds": updated });
    }
  }

  const context = buildLearnSpellCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    spellName: spell.name,
    spellLevel: spell.system.level,
    result,
    roll,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/learn-spell-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as ChatMessage.CreateData);
}

/** Sub-project 14 Plan A: memorizes a free magick — reserves a spell LEVEL
 *  rather than a specific spell; the actual spell is chosen when it's cast
 *  (see castFreeMagick). Wizard-only. A no-op with a warning when the rule is
 *  off, or the wizard can't fit/afford another entry at that level. */
export async function memorizeFreeMagick(actor: SpellcasterActor, spellLevel: number): Promise<void> {
  if (!spellPointsEnabled(getOptionalRules()) || !canMemorizeWizardSpellPoints(actor, spellLevel, "free")) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.memorizeBlockedWarning"));
    return;
  }
  const list = actor.system.spellcasting.wizard.memorized;
  const updated: MemorizedEntry[] = [
    ...list,
    { spellItemId: null, spellLevel, expended: false, magickType: "free" },
  ];
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
}

/** Forgets one free-magick entry at spellLevel matching `expended` — the
 *  Forget button on each row now passes its own row's expended state
 *  (`data-expended`) so it can only ever remove the specific entry it was
 *  clicked from, not an arbitrary same-level entry with a different expended
 *  state (e.g. clicking Forget on a used entry no longer risks deleting an
 *  unused one instead — see this plan's whole-branch review Finding 1).
 *  Silent no-op if none exist (mirrors forgetSpell — the sheet only shows
 *  Forget when one exists). */
export async function forgetFreeMagick(actor: SpellcasterActor, spellLevel: number, expended: boolean): Promise<void> {
  const list = actor.system.spellcasting.wizard.memorized;
  const index = list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel && m.expended === expended);
  if (index === -1) return;
  const updated = [...list.slice(0, index), ...list.slice(index + 1)];
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
}

/** Casts a free magick: rolls the CHOSEN spell's automation (the spell is
 *  picked at cast time, not at memorization — spec §1.1), then expends one
 *  matching non-expended free-magick entry at spellLevel. Does NOT route
 *  through the SP9 Begin/Complete casting-time flow (castOrBegin) — a
 *  free-magick cast is always immediate in this plan (Locked design decision
 *  3; extending CastingState to a null-spellItemId state is a follow-up).
 *
 *  Sub-project 14 Plan B: for a channelling wizard, NO entry is ever marked
 *  expended — casting instead spends from `channelling.current` via the
 *  shared `tryChannellingSpend` helper, afford-checked before rolling and
 *  persisted only once the roll succeeds. */
export async function castFreeMagick(
  actor: SpellcasterActor,
  spellLevel: number,
  chosenSpellItemId: string,
): Promise<void> {
  const list = actor.system.spellcasting.wizard.memorized;
  const channelling = channellersEnabled(getOptionalRules());
  const index = channelling
    ? list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel)
    : list.findIndex((m) => m.magickType === "free" && m.spellLevel === spellLevel && !m.expended);
  const chosen = actor.items.get(chosenSpellItemId);
  const eligible =
    Boolean(chosen) &&
    chosen!.system.casterClass === "wizard" &&
    chosen!.system.level === spellLevel &&
    actor.system.spellcasting.wizard.spellbookItemIds.includes(chosenSpellItemId);
  if (index === -1 || !eligible || !chosen) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return;
  }
  if (channelling) {
    const spent = tryChannellingSpend(actor, spellLevel, "free");
    if (spent === null) return;
    const rolled = await rollSpellAutomation(chosen);
    if (!rolled) return;
    await actor.update({
      "system.spellcasting.wizard.channelling.current": spent,
    });
    await postCastCard(actor, chosen, rolled);
    return;
  }
  const rolled = await rollSpellAutomation(chosen);
  if (!rolled) return;
  const updated = list.map((m, i) => (i === index ? { ...m, expended: true } : m));
  await actor.update({ "system.spellcasting.wizard.memorized": updated });
  await postCastCard(actor, chosen, rolled);
}

/** Sub-project 14 Plan B: Table 20 recovery. No-op with a warning if
 *  Channellers isn't active for this actor (defensive re-check, matching
 *  every other action in this file). */
export async function recoverChannellerSp(
  actor: SpellcasterActor,
  activity: ChannellerActivity,
  hours: number,
): Promise<void> {
  if (!channellersEnabled(getOptionalRules())) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.channellingBlockedWarning"));
    return;
  }
  const { current, max } = actor.system.spellcasting.wizard.channelling;
  await actor.update({
    "system.spellcasting.wizard.channelling.current": recoverSp(current ?? 0, max ?? 0, activity, hours),
  });
}
