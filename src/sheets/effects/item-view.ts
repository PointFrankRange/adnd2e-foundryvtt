// Pure view model for the Effects section of the gear item sheets (#146). No Foundry imports — the Foundry-coupled
// mapping from real ActiveEffect documents lives in src/sheets/item-effects-actions.ts.

export interface ItemEffectRecord {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  /** core `transfer`: whether the effect applies to the item's owner */
  transfer: boolean;
  suppressWhenUnequipped: boolean;
  /** the effect's own `isSuppressed` (e.g. its gear item is unequipped) */
  suppressed: boolean;
  /** "" when the effect has no temporary duration */
  durationLabel: string;
}

export interface ItemEffectRowView extends ItemEffectRecord {
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canTransfer: boolean;
}

export interface ItemEffectsView {
  rows: ItemEffectRowView[];
  canCreate: boolean;
  isEmpty: boolean;
}

/** Annotate an item's own effects with the controls the viewer may use (all of them when editable, none otherwise). */
export function buildItemEffectsView(records: readonly ItemEffectRecord[], editable: boolean): ItemEffectsView {
  const rows = records.map((r) => ({
    ...r,
    canToggle: editable,
    canEdit: editable,
    canDelete: editable,
    canTransfer: editable,
  }));
  return { rows, canCreate: editable, isEmpty: rows.length === 0 };
}
