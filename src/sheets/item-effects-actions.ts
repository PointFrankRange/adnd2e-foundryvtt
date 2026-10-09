// Item Effects-section glue for the gear item sheets (#146). Foundry-coupled — verified in the dev world. Maps an item's
// own ActiveEffect documents to the pure view model and implements the five section actions. Every action acts only on
// the item's OWN effects collection, and the sheet handlers gate on isEditable before calling in. `disabled` and
// `transfer` live on the effect document (not in `system`), so they are updated directly, never through form data.
import { buildItemEffectsView, type ItemEffectRecord, type ItemEffectsView } from "./effects/item-view";

interface ItemEffectDoc {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  transfer: boolean;
  isSuppressed: boolean;
  isTemporary: boolean;
  duration: { label?: string };
  system: { suppressWhenUnequipped?: boolean };
  sheet: { render(options?: { force?: boolean }): unknown } | null;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

interface EffectItem {
  effects: Iterable<ItemEffectDoc> & { get(id: string): ItemEffectDoc | undefined };
  createEmbeddedDocuments(type: "ActiveEffect", data: Record<string, unknown>[]): Promise<ItemEffectDoc[]>;
}

function recordOf(effect: ItemEffectDoc): ItemEffectRecord {
  return {
    id: effect.id,
    name: effect.name,
    img: effect.img,
    disabled: effect.disabled,
    transfer: effect.transfer,
    suppressWhenUnequipped: !!effect.system.suppressWhenUnequipped,
    suppressed: effect.isSuppressed,
    // core reports the word "None" for an indefinite duration — only label genuinely timed effects
    durationLabel: effect.isTemporary ? (effect.duration.label ?? "") : "",
  };
}

/** The Effects section's view model: the item's own effects (not transferred ones from elsewhere). */
export function itemEffectsContext(item: unknown, editable: boolean): ItemEffectsView {
  return buildItemEffectsView([...(item as EffectItem).effects].map(recordOf), editable);
}

/** "New effect": a blank adnd2e effect that transfers to the owner and is suppressed while the gear is unequipped,
 *  opened in the existing raw-field editor. */
export async function createItemEffect(item: unknown): Promise<void> {
  const [created] = await (item as EffectItem).createEmbeddedDocuments("ActiveEffect", [
    {
      name: game.i18n!.localize("ADND2E.sheets.effects.newName"),
      img: "icons/svg/aura.svg",
      type: "adnd2e",
      transfer: true,
      system: { suppressWhenUnequipped: true },
    },
  ]);
  created?.sheet?.render({ force: true });
}

export async function toggleItemEffect(item: unknown, effectId: string): Promise<void> {
  const effect = (item as EffectItem).effects.get(effectId);
  if (effect) await effect.update({ disabled: !effect.disabled });
}

/** Whether the effect applies to the item's owner (core `transfer`; the raw editor cannot edit it). */
export async function toggleItemEffectTransfer(item: unknown, effectId: string): Promise<void> {
  const effect = (item as EffectItem).effects.get(effectId);
  if (effect) await effect.update({ transfer: !effect.transfer });
}

export function editItemEffect(item: unknown, effectId: string): void {
  (item as EffectItem).effects.get(effectId)?.sheet?.render({ force: true });
}

/** Delete after confirmation. */
export async function deleteItemEffect(item: unknown, effectId: string): Promise<void> {
  const effect = (item as EffectItem).effects.get(effectId);
  if (!effect) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n!.localize("ADND2E.sheets.effects.deleteTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheets.effects.deleteConfirm", {
      name: foundry.utils.escapeHTML(effect.name),
    })}</p>`,
  } as never);
  if (confirmed) await effect.delete();
}
