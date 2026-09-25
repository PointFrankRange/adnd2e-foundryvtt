import { spellDeletionUpdate, type SpellcastingSource } from "../magic/spell-cleanup";
import { disruptCasting } from "./character/casting-actions";
import { containerContentsReset } from "./character/grouping";

/* ---------------------------------------------------------------------------
 * item-row-actions — the ✎ / 🗑 controls on every owned-item row of the PC and
 * NPC sheets.
 *
 * Foundry-coupled glue, dev-world verified. Edit opens the embedded item's own
 * registered sheet (the raw-field editor); Foundry's own permissions make it
 * editable for an owner and read-only for anyone else. Delete asks for
 * confirmation, then cleans up anything that points at the item:
 *  - a spell: dropped from the spellbook / memorized lists (pure
 *    `spellDeletionUpdate`); an in-progress cast of it is cancelled through
 *    `disruptCasting` (silently), which also clears the combatant's pending
 *    casting-time initiative flag;
 *  - a container: its contents move back to loose (pure `containerContentsReset`).
 * Every write targets the actor whose sheet the user is editing (the handlers
 * require `isEditable`) or that actor's own combatant.
 * ------------------------------------------------------------------------- */

interface OwnedItem {
  id: string;
  name: string;
  type: string;
  system: { location?: string };
  sheet: { render(options?: { force?: boolean }): unknown } | null;
  delete(): Promise<unknown>;
}

interface ItemOwner {
  system: unknown;
  items: { get(id: string): OwnedItem | undefined } & Iterable<OwnedItem>;
  update(data: Record<string, unknown>): Promise<unknown>;
  updateEmbeddedDocuments(type: "Item", updates: Record<string, unknown>[]): Promise<unknown>;
}

const CASTING_KEY = "system.options.spellsAndMagic.casting";

/** Opens the owned item's sheet. */
export function editOwnedItem(actor: ItemOwner, itemId: string): void {
  actor.items.get(itemId)?.sheet?.render({ force: true });
}

/** Confirms, cleans up references to the item, then deletes it. */
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
    const cancelCast = CASTING_KEY in update;
    delete update[CASTING_KEY];
    if (Object.keys(update).length > 0) await actor.update(update);
    if (cancelCast) await disruptCasting(actor as never, { announce: false });
  }

  const contents = containerContentsReset(
    [...actor.items].map((i) => ({ id: i.id, location: i.system.location ?? "" })),
    item.id,
  );
  if (contents.length > 0) await actor.updateEmbeddedDocuments("Item", contents);

  await item.delete();
}
