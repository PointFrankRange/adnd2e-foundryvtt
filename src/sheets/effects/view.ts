// Pure view model for the actor sheets' Effects tab (#128). No Foundry imports — the Foundry-coupled mapping from real
// ActiveEffect documents lives in src/sheets/effects-actions.ts.

export interface EffectRecord {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  suppressed: boolean;
  isCondition: boolean;
  conditionId: string | null;
  /** "" when the effect has no temporary duration. */
  durationLabel: string;
  /** the owning Item, when the effect lives on one (a transferred item effect). */
  source: { id: string; name: string } | null;
}

export interface EffectRowView {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  suppressed: boolean;
  durationLabel: string;
  sourceId: string;
  sourceName: string;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRemove: boolean;
  canOpenSource: boolean;
}

export type EffectGroupKey = "conditions" | "custom" | "items";

export interface EffectGroupView {
  key: EffectGroupKey;
  labelKey: string;
  rows: EffectRowView[];
}

export interface EffectsView {
  groups: EffectGroupView[];
  canCreate: boolean;
  isEmpty: boolean;
}

const GROUP_ORDER: readonly EffectGroupKey[] = ["conditions", "custom", "items"];

/** An effect on an item is "From items"; otherwise a condition effect is "Conditions"; everything else is "Custom". */
function groupOf(r: EffectRecord): EffectGroupKey {
  if (r.source) return "items";
  return r.isCondition ? "conditions" : "custom";
}

function rowOf(r: EffectRecord, group: EffectGroupKey, editable: boolean): EffectRowView {
  return {
    id: r.id,
    name: r.name,
    img: r.img,
    disabled: r.disabled,
    suppressed: r.suppressed,
    durationLabel: r.durationLabel,
    sourceId: r.source?.id ?? "",
    sourceName: r.source?.name ?? "",
    canToggle: editable && group === "custom",
    canEdit: editable && group === "custom",
    canDelete: editable && group === "custom",
    canRemove: editable && group === "conditions",
    canOpenSource: group === "items",
  };
}

/** Group, order and annotate an actor's effects for the Effects tab. */
export function buildEffectsView(records: readonly EffectRecord[], editable: boolean): EffectsView {
  const groups: EffectGroupView[] = [];
  for (const key of GROUP_ORDER) {
    const rows = records.filter((r) => groupOf(r) === key).map((r) => rowOf(r, key, editable));
    if (rows.length) groups.push({ key, labelKey: `ADND2E.sheet.effects.groups.${key}`, rows });
  }
  return { groups, canCreate: editable, isEmpty: groups.length === 0 };
}
