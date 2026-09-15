import { describe, expect, it } from "vitest";
import { containerAdjustedCarriedWeight } from "../../../src/data/derive/character/container-weight";

type WI = Parameters<typeof containerAdjustedCarriedWeight>[0][number];
const wi = (o: Partial<WI>): WI => ({
  id: "x", type: "equipment", totalWeight: 0, location: "", isContainer: false, contentsWeightMultiplier: 1, ...o,
});

describe("containerAdjustedCarriedWeight", () => {
  it("sums every weapon/armor/equipment weight when nothing is containerised", () => {
    expect(containerAdjustedCarriedWeight([
      wi({ totalWeight: 10, type: "weapon" }),
      wi({ totalWeight: 5, type: "armor" }),
      wi({ totalWeight: 2, type: "equipment" }),
    ])).toBe(17);
  });

  it("multiplies an item's weight by its container's multiplier", () => {
    const bag = wi({ id: "bag", isContainer: true, totalWeight: 15, contentsWeightMultiplier: 0 });
    const rock = wi({ id: "rock", location: "bag", totalWeight: 100 });
    // bag itself 15 + (rock 100 * 0) = 15
    expect(containerAdjustedCarriedWeight([bag, rock])).toBe(15);
  });

  it("a non-zero multiplier scales proportionally", () => {
    const bag = wi({ id: "bag", isContainer: true, totalWeight: 5, contentsWeightMultiplier: 0.5 });
    const gear = wi({ id: "g", location: "bag", totalWeight: 40 });
    expect(containerAdjustedCarriedWeight([bag, gear])).toBe(5 + 20);
  });

  it("ignores non-physical item types", () => {
    expect(containerAdjustedCarriedWeight([
      wi({ totalWeight: 3, type: "spell" }),
      wi({ totalWeight: 4, type: "class" }),
      wi({ totalWeight: 7, type: "equipment" }),
    ])).toBe(7);
  });

  it("an item in a missing container is counted at full weight", () => {
    expect(containerAdjustedCarriedWeight([wi({ totalWeight: 9, location: "ghost" })])).toBe(9);
  });
});
