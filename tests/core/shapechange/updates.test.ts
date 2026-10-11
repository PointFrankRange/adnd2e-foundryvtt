import { describe, expect, it } from "vitest";
import { newDayUpdate, planShift, returnUpdate, type FormSnapshot } from "../../../src/core/shapechange";

const snap: FormSnapshot = {
  name: "Brown Bear", img: "b.png", category: "mammal", ac: 6,
  movement: { land: 12, burrow: 0, climb: 0, fly: 0, swim: 0, flyManeuverability: "" },
  attacks: [],
};

describe("planShift", () => {
  it("heals d6 x 10% of the damage taken and writes counters, form and hp in one payload", () => {
    const plan = planShift({ usedToday: 1, categoriesUsed: ["bird"] }, snap, { value: 5, max: 20 }, 3);
    expect(plan.healed).toBe(4);
    expect(plan.update).toEqual({
      "system.shapechange.usedToday": 2,
      "system.shapechange.categoriesUsed": ["bird", "mammal"],
      "system.shapechange.form": snap,
      "system.attributes.hp.value": 9,
    });
  });
  it("never heals above max or when undamaged", () => {
    expect(planShift({ usedToday: 0, categoriesUsed: [] }, snap, { value: 20, max: 20 }, 6).update["system.attributes.hp.value"]).toBe(20);
    expect(planShift({ usedToday: 0, categoriesUsed: [] }, snap, { value: 25, max: 20 }, 6).healed).toBe(0);
  });
});

describe("returnUpdate / newDayUpdate", () => {
  it("return nulls the form only", () => {
    expect(returnUpdate()).toEqual({ "system.shapechange.form": null });
  });
  it("new day zeroes the counters and leaves the form", () => {
    expect(newDayUpdate()).toEqual({ "system.shapechange.usedToday": 0, "system.shapechange.categoriesUsed": [] });
  });
});
