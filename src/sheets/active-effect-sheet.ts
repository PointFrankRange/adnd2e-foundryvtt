import { RawFieldSheetMixin } from "./raw-field-sheet";

// See actor-sheet.ts — collapse the mixin's intersection return to one constructor (TS2510).
const Base = RawFieldSheetMixin(
  foundry.applications.api.DocumentSheetV2 as unknown as abstract new (...args: never[]) => object,
) as unknown as new (...args: never[]) => object;

/**
 * SP1 raw-field editor for the system's `adnd2e` ActiveEffect subtype.
 *
 * Built on the generic {@link foundry.applications.api.DocumentSheetV2} rather than
 * core's {@link foundry.applications.sheets.ActiveEffectConfig}: that class already
 * has `HandlebarsApplicationMixin` applied (our mixin would apply it a second time)
 * and its `static TABS` / `_preparePartContext` assume its own `details` / `duration`
 * / `changes` PARTS — all of which our mixin replaces wholesale with a single `body`
 * part. `DocumentSheetV2` is the clean base for a from-scratch raw editor; it is
 * registered for `types: ["adnd2e"]` only, so core effects keep `ActiveEffectConfig`.
 */
export class Adnd2eActiveEffectConfig extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "active-effect", "raw-field-sheet"],
  };
}

// pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>) survives minification
Object.defineProperty(Adnd2eActiveEffectConfig, "name", {
  value: "Adnd2eActiveEffectConfig",
  configurable: true,
});
