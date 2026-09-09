import { RawFieldSheetMixin } from "./raw-field-sheet";

// See actor-sheet.ts — collapse the mixin's intersection return to one constructor (TS2510).
const Base = RawFieldSheetMixin(
  foundry.applications.sheets.ItemSheetV2 as unknown as abstract new (...args: never[]) => object,
) as unknown as new (...args: never[]) => object;

/** SP1 raw-field editor for Items — applied over the v14 {@link foundry.applications.sheets.ItemSheetV2}. */
export class Adnd2eItemSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "item", "raw-field-sheet"],
  };
}
