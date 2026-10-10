import { RawFieldSheetMixin } from "./raw-field-sheet";
import {
  createItemEffect,
  deleteItemEffect,
  editItemEffect,
  toggleItemEffect,
  toggleItemEffectTransfer,
} from "./item-effects-actions";

type EffectSheet = { document: unknown; isEditable: boolean };

// See actor-sheet.ts — collapse the mixin's intersection return to one constructor (TS2510).
const Base = RawFieldSheetMixin(
  foundry.applications.sheets.ItemSheetV2 as unknown as abstract new (...args: never[]) => object,
) as unknown as new (...args: never[]) => object;

/** SP1 raw-field editor for Items — applied over the v14 {@link foundry.applications.sheets.ItemSheetV2}. */
export class Adnd2eItemSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "item", "raw-field-sheet"],
    actions: {
      createItemEffect: Adnd2eItemSheet.#onCreateItemEffect,
      toggleItemEffect: Adnd2eItemSheet.#onToggleItemEffect,
      toggleItemEffectTransfer: Adnd2eItemSheet.#onToggleItemEffectTransfer,
      editItemEffect: Adnd2eItemSheet.#onEditItemEffect,
      deleteItemEffect: Adnd2eItemSheet.#onDeleteItemEffect,
    },
  };

  static async #onCreateItemEffect(this: Adnd2eItemSheet): Promise<void> {
    const sheet = this as unknown as EffectSheet;
    if (sheet.isEditable) await createItemEffect(sheet.document);
  }

  static async #onToggleItemEffect(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const sheet = this as unknown as EffectSheet;
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) await toggleItemEffect(sheet.document, id);
  }

  static async #onToggleItemEffectTransfer(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const sheet = this as unknown as EffectSheet;
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) await toggleItemEffectTransfer(sheet.document, id);
  }

  static #onEditItemEffect(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): void {
    const sheet = this as unknown as EffectSheet;
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) editItemEffect(sheet.document, id);
  }

  static async #onDeleteItemEffect(this: Adnd2eItemSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const sheet = this as unknown as EffectSheet;
    const id = target.dataset.effectId;
    if (id && sheet.isEditable) await deleteItemEffect(sheet.document, id);
  }
}

// pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>) survives minification
Object.defineProperty(Adnd2eItemSheet, "name", { value: "Adnd2eItemSheet", configurable: true });
