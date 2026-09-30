// Sub-project 14 Plan A: small DialogV2 prompts for free magick — picking a
// spell LEVEL to memorize (any spell of that level, chosen later) and picking
// which known spell to cast a memorized free magick as (the choice happens at
// cast time, not at memorization — spec §1.1). Mirrors the existing
// combat/initiative-modifier-dialog.ts DialogV2.prompt pattern.
export interface FreeMagickCastActor {
  system: { spellcasting: { wizard: { spellbookItemIds: string[] } } };
  items: Iterable<{ id: string; name: string; type: string; system: { casterClass?: string; level?: number } }>;
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

/** Prompts for which known wizard spell of `spellLevel` to cast a free magick
 *  as. Returns null (and shows a warning) if the spellbook has no eligible
 *  spell at that level, or the dialog is cancelled. */
export async function promptFreeMagickSpell(actor: FreeMagickCastActor, spellLevel: number): Promise<string | null> {
  const eligible = [...actor.items].filter(
    (i) =>
      i.type === "spell" &&
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
