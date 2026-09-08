// Abstract base for every adnd2e Item DataModel. Adds the shared `description`
// field and a no-op derived-data hook the subclasses override. Thin by design
// (Ruling D2) — item-local derived data only, delegated to src/data/derive/.
import { htmlField } from "../common/fields";

export abstract class Adnd2eItemModel<
  Schema extends foundry.data.fields.DataSchema = foundry.data.fields.DataSchema,
> extends foundry.abstract.TypeDataModel<Schema, Item.Implementation> {
  static defineSchema(): foundry.data.fields.DataSchema {
    return { description: htmlField() };
  }

  override prepareDerivedData(): void {
    // Subclasses override; base contributes nothing.
  }
}
