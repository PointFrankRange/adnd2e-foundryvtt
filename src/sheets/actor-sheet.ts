import { RawFieldSheetMixin } from "./raw-field-sheet";

// The mixin returns `TBase & (new () => RawFieldSheet)`; extending that intersection
// directly trips TS2510 ("base constructors must all have the same return type"), so
// collapse it to a single constructor at the call site.
const Base = RawFieldSheetMixin(
  foundry.applications.sheets.ActorSheetV2 as unknown as abstract new (...args: never[]) => object,
) as unknown as new (...args: never[]) => object;

/** SP1 raw-field editor for Actors — applied over the v14 {@link foundry.applications.sheets.ActorSheetV2}. */
export class Adnd2eActorSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "raw-field-sheet"],
  };
}
