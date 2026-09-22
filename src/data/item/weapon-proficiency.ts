import { Adnd2eItemModel } from "./base-item";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class WeaponProficiencyItemModel extends Adnd2eItemModel {
  static override defineSchema(): foundry.data.fields.DataSchema {
    return {
      ...super.defineSchema(),
      weaponOrGroup: new StringField({ required: true, blank: true, initial: "" }),
      isGroup: new BooleanField({ required: true, initial: false }),
      slotsInvested: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      styleSpecialization: new StringField({ required: true, nullable: true, initial: null }),
      masteryTier: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
    };
  }

  /**
   * v14 GOTCHA (see src/data/migrations.ts's header comment): a field removed
   * from the schema is pruned from `_source` at DataModel construction, BEFORE
   * any `ready`-hook migration ever gets a chance to read it. `migrateData`
   * runs earlier than that pruning (Foundry's canonical hook for a schema
   * field rename — `DataField#clean` calls `_migrate` first, and only then
   * `_cleanType` prunes unknown keys: common/data/fields.mjs:234 vs :1075) —
   * this is what actually makes the specialized→masteryTier migration
   * observable, on every load, for actors, world Items, compendium Items, and
   * anything created via importContent. The `itemUpdate` entry in
   * src/data/migrations.ts is kept as a defense-in-depth DB-level write for
   * data that reaches storage without going through normal document
   * construction; in ordinary play it will usually find this already done.
   */
  static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
    if (source.specialized === true && !source.masteryTier) {
      source.masteryTier = 1;
    }
    return super.migrateData(source);
  }
}
