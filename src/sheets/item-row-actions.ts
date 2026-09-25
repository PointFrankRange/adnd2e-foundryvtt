import { spellDeletionUpdate, type SpellcastingSource } from "../magic/spell-cleanup";

/* ---------------------------------------------------------------------------
 * item-row-actions — the ✎ / 🗑 controls on every owned-item row of the PC and
 * NPC sheets.
 *
 * Foundry-coupled glue, dev-world verified. Edit opens the embedded item's own
 * registered sheet (the raw-field editor); Foundry's own permissions make it
 * editable for an owner and read-only for anyone else. Delete asks for
 * confirmation, and for a spell first removes it from the spellbook/memorized
 * lists and clears an in-progress cast (pure `spellDeletionUpdate`), so no
 * orphaned spellcasting state survives the delete. Every write targets the
 * actor whose sheet the user is editing (the handlers require `isEditable`).
 * ------------------------------------------------------------------------- */

interface OwnedItem {
  id: string;
  name: string;
  type: string;
  sheet: { render(options?: { force?: boolean }): unknown } | null;
  delete(): Promise<unknown>;
}

interface ItemOwner {
  system: unknown;
  items: { get(id: string): OwnedItem | undefined };
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Opens the owned item's sheet. */
export function editOwnedItem(actor: ItemOwner, itemId: string): void {
  actor.items.get(itemId)?.sheet?.render({ force: true });
}

/** Confirms, cleans up spellcasting state for a spell, then deletes the owned item. */
export async function deleteOwnedItem(actor: ItemOwner, itemId: string): Promise<void> {
  const item = actor.items.get(itemId);
  if (!item) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n!.localize("ADND2E.sheet.itemControls.deleteTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheet.itemControls.deleteConfirm", {
      name: foundry.utils.escapeHTML(item.name),
    })}</p>`,
  } as never);
  if (confirmed !== true) return;
  if (item.type === "spell") {
    const update = spellDeletionUpdate(actor.system as SpellcastingSource, item.id);
    if (Object.keys(update).length > 0) await actor.update(update);
  }
  await item.delete();
}
