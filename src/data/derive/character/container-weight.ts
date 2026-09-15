const PHYSICAL_TYPES = new Set(["weapon", "armor", "equipment"]);

export interface WeightedItem {
  id: string;
  type: string;
  /** the item's own derived total weight (weight * quantity), pounds */
  totalWeight: number;
  /** `system.location` — a container item's id, or "" */
  location: string;
  /** `system.container` (equipment only; false for weapon/armor) */
  isContainer: boolean;
  /** `system.contentsWeightMultiplier` (equipment only; 1 for weapon/armor) */
  contentsWeightMultiplier: number;
}

/**
 * §5.6 step 10 input: total carried weight, with each item's weight scaled by
 * the `contentsWeightMultiplier` of the container it sits in (1 when loose or in
 * a normal container; 0 for a bag-of-holding-type item). The container's own
 * weight is always counted in full.
 */
export function containerAdjustedCarriedWeight(items: readonly WeightedItem[]): number {
  const multiplierByContainerId = new Map<string, number>();
  for (const i of items) {
    if (i.isContainer) multiplierByContainerId.set(i.id, i.contentsWeightMultiplier);
  }
  let total = 0;
  for (const i of items) {
    if (!PHYSICAL_TYPES.has(i.type)) continue;
    const scale = i.location && multiplierByContainerId.has(i.location)
      ? multiplierByContainerId.get(i.location)!
      : 1;
    total += i.totalWeight * scale;
  }
  return total;
}
