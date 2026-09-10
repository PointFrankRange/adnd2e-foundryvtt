import { describe, expect, it } from "vitest";
import { groupInventory } from "../../../src/sheets/character/grouping";
import type { PhysicalItemView } from "../../../src/sheets/character/context-types";

function item(over: Partial<PhysicalItemView>): PhysicalItemView {
  return {
    id: "x", name: "x", img: "", type: "equipment",
    quantity: 1, weight: 0, totalWeight: 0,
    location: "", equipped: false, identified: true, magicBonus: 0,
    isContainer: false, capacity: null, contentsWeightMultiplier: 1,
    ...over,
  };
}

describe("groupInventory", () => {
  it("nests items whose location is a container id; leaves the rest loose", () => {
    const pack = item({ id: "pack", name: "Backpack", isContainer: true, capacity: 50, totalWeight: 2 });
    const rope = item({ id: "rope", name: "Rope", location: "pack", totalWeight: 20 });
    const torch = item({ id: "torch", name: "Torch", totalWeight: 1 });
    const r = groupInventory([pack, rope, torch]);
    expect(r.containers).toHaveLength(1);
    expect(r.containers[0].item.id).toBe("pack");
    expect(r.containers[0].contents.map((i) => i.id)).toEqual(["rope"]);
    expect(r.containers[0].usedWeight).toBe(20);
    expect(r.containers[0].overCapacity).toBe(false);
    expect(r.loose.map((i) => i.id)).toEqual(["torch"]); // the container itself is NOT loose
  });

  it("flags over-capacity", () => {
    const pack = item({ id: "pack", isContainer: true, capacity: 10 });
    const rock = item({ id: "rock", location: "pack", totalWeight: 40 });
    const r = groupInventory([pack, rock]);
    expect(r.containers[0].overCapacity).toBe(true);
  });

  it("capacity null means no limit", () => {
    const pack = item({ id: "pack", isContainer: true, capacity: null });
    const rock = item({ id: "rock", location: "pack", totalWeight: 999 });
    expect(groupInventory([pack, rock]).containers[0].overCapacity).toBe(false);
  });

  it("an item pointing at a missing/non-container location falls back to loose", () => {
    const ghost = item({ id: "g", location: "nonexistent" });
    const r = groupInventory([ghost]);
    expect(r.containers).toHaveLength(0);
    expect(r.loose.map((i) => i.id)).toEqual(["g"]);
  });

  it("containers sort before loose is irrelevant — each list preserves input order", () => {
    const b = item({ id: "b", isContainer: true, capacity: null });
    const a = item({ id: "a", isContainer: true, capacity: null });
    expect(groupInventory([b, a]).containers.map((c) => c.item.id)).toEqual(["b", "a"]);
  });

  it("a container nested in another container still renders as its own group (one level of display)", () => {
    const outer = item({ id: "outer", isContainer: true, capacity: null });
    const inner = item({ id: "inner", isContainer: true, capacity: null, location: "outer", totalWeight: 3 });
    const r = groupInventory([outer, inner]);
    expect(r.containers.map((c) => c.item.id)).toEqual(["outer", "inner"]);
    expect(r.containers.find((c) => c.item.id === "outer")!.contents.map((i) => i.id)).toEqual(["inner"]);
  });
});
