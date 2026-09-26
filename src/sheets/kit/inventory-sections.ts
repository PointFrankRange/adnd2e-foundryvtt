// Inventory item-table sections (sheet redesign R1): loose weapons, armor and
// equipment, then one section per container (the container itself first, then
// its contents), each row marked favorite or not. Pure.
import type { ContainerGroup, PhysicalItemView } from "../character/context-types";

export interface InventoryRow {
  item: PhysicalItemView;
  favorite: boolean;
}

export interface InventorySection {
  id: string;
  /** i18n key for the three type sections; null for a container (use `label`) */
  labelKey: string | null;
  label: string | null;
  containerId: string | null;
  capacity: { used: number; max: number | null; over: boolean } | null;
  rows: InventoryRow[];
}

export function buildInventorySections(
  inv: { containers: readonly ContainerGroup[]; loose: readonly PhysicalItemView[] },
  isFav: (id: string) => boolean,
): InventorySection[] {
  const row = (item: PhysicalItemView): InventoryRow => ({ item, favorite: isFav(item.id) });
  const typed = (id: "weapons" | "armor" | "equipment", type: PhysicalItemView["type"]): InventorySection => ({
    id,
    labelKey: `ADND2E.sheet.kit.sections.${id}`,
    label: null,
    containerId: null,
    capacity: null,
    rows: inv.loose.filter((i) => i.type === type).map(row),
  });
  return [
    typed("weapons", "weapon"),
    typed("armor", "armor"),
    typed("equipment", "equipment"),
    ...inv.containers.map((c) => ({
      id: `container-${c.item.id}`,
      labelKey: null,
      label: c.item.name,
      containerId: c.item.id,
      capacity: { used: c.usedWeight, max: c.capacity, over: c.overCapacity },
      rows: [row(c.item), ...c.contents.map(row)],
    })),
  ];
}
