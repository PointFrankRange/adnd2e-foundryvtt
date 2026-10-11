import { describe, expect, it } from "vitest";
import { applyShapechangeOverlay } from "../../../src/data/derive/character/shapechange";

const derived = {
  ac: { normal: 4, rearAttack: 8, surprised: 6, shieldless: 6 },
  movement: { base: 12, current: 9, encumbranceCategory: "light" },
};
const form = {
  name: "Wolf", img: "w.png", category: "mammal" as const, ac: 7,
  movement: { land: 18, burrow: 0, climb: 0, fly: 0, swim: 0, flyManeuverability: "" },
  attacks: [{ name: "Bite", count: 1, damage: "1d4+1", type: "melee" }],
};

describe("applyShapechangeOverlay", () => {
  it("returns the derived values untouched in normal form", () => {
    expect(applyShapechangeOverlay(derived, null)).toEqual(derived);
  });
  it("substitutes the form's AC for every context and its land movement for the current rate", () => {
    const out = applyShapechangeOverlay(derived, form);
    expect(out.ac).toEqual({ normal: 7, rearAttack: 7, surprised: 7, shieldless: 7 });
    expect(out.movement).toEqual({ base: 12, current: 18, encumbranceCategory: "light" });
  });
  it("does not mutate its input", () => {
    applyShapechangeOverlay(derived, form);
    expect(derived.ac.normal).toBe(4);
    expect(derived.movement.current).toBe(9);
  });
});
