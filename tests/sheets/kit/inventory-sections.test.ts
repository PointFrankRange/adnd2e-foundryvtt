import { describe, expect, it } from "vitest";
import { buildInventorySections } from "../../../src/sheets/kit/inventory-sections";
import type { PhysicalItemView } from "../../../src/sheets/character/context-types";

function item(over: Partial<PhysicalItemView>): PhysicalItemView {
  return {
    id: "x", name: "x", img: "", type: "equipment", quantity: 1, weight: 1, totalWeight: 1,
    location: "", equipped: false, identified: true, magicBonus: 0, descriptionHtml: "",
    isContainer: false, capacity: null, contentsWeightMultiplier: 1,
    ...over,
  };
}

describe("buildInventorySections", () => {
  const sword = item({ id: "w1", name: "Sword", type: "weapon" });
  const mail = item({ id: "a1", name: "Mail", type: "armor" });
  const rope = item({ id: "e1", name: "Rope" });
  const arrow = item({ id: "am1", name: "Arrows", type: "ammo" });
  const pack = item({ id: "c1", name: "Backpack", isContainer: true, capacity: 30 });
  const torch = item({ id: "e2", name: "Torch", location: "c1" });

  it("groups loose items by type, then one section per container (container row first), marking favorites", () => {
    const sections = buildInventorySections(
      {
        loose: [sword, mail, rope, arrow],
        containers: [{ item: pack, contents: [torch], usedWeight: 1, capacity: 30, overCapacity: false }],
      },
      (id) => id === "w1" || id === "e2",
    );
    expect(sections).toEqual([
      { id: "weapons", labelKey: "ADND2E.sheet.kit.sections.weapons", label: null, containerId: null, capacity: null, rows: [{ item: sword, favorite: true }] },
      { id: "armor", labelKey: "ADND2E.sheet.kit.sections.armor", label: null, containerId: null, capacity: null, rows: [{ item: mail, favorite: false }] },
      { id: "equipment", labelKey: "ADND2E.sheet.kit.sections.equipment", label: null, containerId: null, capacity: null, rows: [{ item: rope, favorite: false }] },
      { id: "ammo", labelKey: "ADND2E.sheet.kit.sections.ammo", label: null, containerId: null, capacity: null, rows: [{ item: arrow, favorite: false }] },
      {
        id: "container-c1", labelKey: null, label: "Backpack", containerId: "c1",
        capacity: { used: 1, max: 30, over: false },
        rows: [{ item: pack, favorite: false }, { item: torch, favorite: true }],
      },
    ]);
  });

  it("keeps the four type sections even when empty", () => {
    const sections = buildInventorySections({ loose: [], containers: [] }, () => false);
    expect(sections.map((s) => [s.id, s.rows.length])).toEqual([["weapons", 0], ["armor", 0], ["equipment", 0], ["ammo", 0]]);
  });
});
