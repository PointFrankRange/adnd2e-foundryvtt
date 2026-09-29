import { describe, expect, it } from "vitest";
import { matchingAmmo, defaultAmmoSelection } from "../../src/combat/ammo";
import type { AmmoStock } from "../../src/combat/ammo";

const arrow: AmmoStock = { id: "a1", ammoType: "arrow", quantity: 12 };
const flightArrow: AmmoStock = { id: "a2", ammoType: "arrow", quantity: 3 };
const bolt: AmmoStock = { id: "a3", ammoType: "bolt", quantity: 20 };
const emptyArrows: AmmoStock = { id: "a4", ammoType: "arrow", quantity: 0 };

describe("matchingAmmo", () => {
  it("returns only items whose ammoType matches and quantity is above zero", () => {
    expect(matchingAmmo([arrow, flightArrow, bolt, emptyArrows], "arrow")).toEqual([arrow, flightArrow]);
  });
  it("excludes ammo of a different type entirely", () => {
    expect(matchingAmmo([bolt], "arrow")).toEqual([]);
  });
  it("excludes ammo with zero quantity even when the type matches", () => {
    expect(matchingAmmo([emptyArrows], "arrow")).toEqual([]);
  });
  it("returns an empty array when there is no ammo at all", () => {
    expect(matchingAmmo([], "arrow")).toEqual([]);
  });
});

describe("defaultAmmoSelection", () => {
  it("keeps the persisted selection when it is still a valid candidate", () => {
    expect(defaultAmmoSelection([arrow, flightArrow], "a2")).toEqual(flightArrow);
  });
  it("falls back to the first candidate when the persisted selection isn't a candidate", () => {
    expect(defaultAmmoSelection([arrow, flightArrow], "a3")).toEqual(arrow);
  });
  it("falls back to the first candidate when there is no persisted selection", () => {
    expect(defaultAmmoSelection([arrow, flightArrow], null)).toEqual(arrow);
  });
  it("returns null when there are no candidates at all", () => {
    expect(defaultAmmoSelection([], "a1")).toBeNull();
  });
});
