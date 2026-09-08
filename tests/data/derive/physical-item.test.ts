import { describe, expect, it } from "vitest";
import { totalWeight } from "../../../src/data/derive/physical-item";

describe("totalWeight", () => {
  it("multiplies weight by quantity", () => {
    expect(totalWeight({ weight: 3, quantity: 4 })).toBe(12);
    expect(totalWeight({ weight: 0.5, quantity: 2 })).toBe(1);
  });
  it("clamps negative weight or quantity to zero", () => {
    expect(totalWeight({ weight: -3, quantity: 4 })).toBe(0);
    expect(totalWeight({ weight: 3, quantity: -1 })).toBe(0);
  });
});
