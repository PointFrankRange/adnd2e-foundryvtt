// Sub-project 14 Plan A: small DialogV2 prompts for free magick — picking a
// spell LEVEL to memorize (any spell of that level, chosen later) and picking
// which known spell to cast a memorized free magick as (the choice happens at
// cast time, not at memorization — spec §1.1). Mirrors the existing
// combat/initiative-modifier-dialog.ts DialogV2.prompt pattern.
import type { ClassId, SphereName } from "../../core/types";
import { priestAccessScope } from "../../magic/priest-sphere-access";
import type { TheurgyScope } from "../../core/magic/priest-spell-points";

export interface FreeMagickCastActor {
  system: { spellcasting: { wizard: { spellbookItemIds: string[] } } };
  items: Iterable<{
    id: string;
    name: string;
    type: string;
    system: { casterClass?: string; level?: number; spheres?: string[] };
  }>;
}

/** The priest free-theurgy filter: the Table 29 column being cast, plus what
 *  the priest's sphere access is computed from (see priestAccessScope). */
export interface PriestFreeMagickFilter {
  scope: Exclude<TheurgyScope, "minor">;
  chassisId: ClassId | null;
  sphereAccessOverride: readonly SphereName[] | null;
}

/** Whether a priest spell may be cast as a free theurgy of this column at
 *  this spell level. Universal free: any priest spell of the level. Major
 *  free: the spell must be major-access for this priest at that level. Shared
 *  by the cast prompt's filter and castFreeTheurgy's post-prompt re-check. */
export function priestFreeCastEligible(
  filter: PriestFreeMagickFilter,
  spell: { system: { casterClass?: string; level?: number; spheres?: string[] } },
  spellLevel: number,
): boolean {
  if (spell.system.casterClass !== "priest" || spell.system.level !== spellLevel) return false;
  if (filter.scope === "universal") return true;
  const access = priestAccessScope(
    filter.chassisId,
    filter.sphereAccessOverride,
    (spell.system.spheres ?? []) as SphereName[],
    spellLevel,
  );
  return access === "major";
}

/** Prompts for a spell level (1..maxSpellLevel) to memorize as a free magick. Returns null if cancelled. */
export async function promptFreeMagickLevel(maxSpellLevel: number): Promise<number | null> {
  const options = Array.from({ length: maxSpellLevel }, (_, i) => i + 1)
    .map((lvl) => `<option value="${lvl}">${lvl}</option>`)
    .join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.sheet.spells.freeMagickLevelTitle") },
    content: `<p>${game.i18n!.localize("ADND2E.sheet.spells.freeMagickLevelHint")}</p>
      <select name="level" autofocus>${options}</select>`,
    ok: {
      label: game.i18n!.localize("ADND2E.sheet.spells.memorizeFreeMagick"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const select = button.form?.elements.namedItem("level");
        return select instanceof HTMLSelectElement ? Number(select.value) : null;
      },
    },
  });
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Prompts for which spell of `spellLevel` to cast a free magick as. Wizard
 *  (no `priest` filter): a known spellbook spell. Priest (`priest` given): a
 *  priest spell passing priestFreeCastEligible for the cast column. Returns
 *  null (and shows a warning) if nothing is eligible at that level, or the
 *  dialog is cancelled. */
export async function promptFreeMagickSpell(
  actor: FreeMagickCastActor,
  spellLevel: number,
  priest?: PriestFreeMagickFilter,
): Promise<string | null> {
  const eligible = [...actor.items].filter((i) =>
    priest
      ? i.type === "spell" && priestFreeCastEligible(priest, i, spellLevel)
      : i.type === "spell" &&
        i.system.casterClass === "wizard" &&
        i.system.level === spellLevel &&
        actor.system.spellcasting.wizard.spellbookItemIds.includes(i.id),
  );
  if (eligible.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
    return null;
  }
  const options = eligible.map((s) => `<option value="${s.id}">${foundry.utils.escapeHTML(s.name)}</option>`).join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n!.localize("ADND2E.sheet.spells.freeMagickCastTitle") },
    content: `<select name="spell" autofocus>${options}</select>`,
    ok: {
      label: game.i18n!.localize("ADND2E.sheet.spells.cast"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const select = button.form?.elements.namedItem("spell");
        return select instanceof HTMLSelectElement ? select.value : null;
      },
    },
  });
  return typeof value === "string" ? value : null;
}
