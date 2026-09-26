import type { ContainerGroup, PhysicalItemView } from "./context-types";

/**
 * Split a flat physical-item list into container groups + loose items.
 *
 * - Every `isContainer` item becomes a `ContainerGroup` (in input order), and is
 *   NOT also listed as loose.
 * - A non-container item whose `location` equals a container's id nests under
 *   that container; `usedWeight` is Σ of the contained items' `totalWeight`
 *   (before any weight multiplier — the multiplier affects encumbrance, not the
 *   displayed pack contents).
 * - `overCapacity` is `usedWeight > capacity` (capacity `null` → never over).
 * - An item whose `location` names no container is loose.
 * - Only one level of nesting is displayed: a container inside a container is
 *   still rendered as its own top-level group.
 */
export function groupInventory(
  items: readonly PhysicalItemView[],
): { containers: ContainerGroup[]; loose: PhysicalItemView[] } {
  const containerItems = items.filter((i) => i.isContainer);
  const containerIds = new Set(containerItems.map((i) => i.id));

  const containers: ContainerGroup[] = containerItems.map((item) => {
    const contents = items.filter((i) => i.id !== item.id && i.location === item.id);
    const usedWeight = contents.reduce((sum, i) => sum + i.totalWeight, 0);
    const overCapacity = item.capacity != null && usedWeight > item.capacity;
    return { item, contents, usedWeight, capacity: item.capacity, overCapacity };
  });

  const loose = items.filter(
    (i) => !i.isContainer && !(containerIds.has(i.location)),
  );

  return { containers, loose };
}

/**
 * The embedded-Item updates that move a deleted container's contents back to
 * loose (`location: ""`), so none of them is left pointing at an id that no
 * longer exists.
 */
export function containerContentsReset(
  items: readonly { id: string; location: string }[],
  containerId: string,
): { _id: string; "system.location": string }[] {
  return items
    .filter((i) => i.id !== containerId && i.location === containerId)
    .map((i) => ({ _id: i.id, "system.location": "" }));
}
