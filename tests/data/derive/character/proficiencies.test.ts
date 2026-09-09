import { describe, expect, it } from "vitest";
import { deriveProficiencySlots } from "../../../../src/data/derive/character/proficiencies";

const src = (chassisId: "fighter" | "mage", level: number) => ({ chassisId, level });

describe("deriveProficiencySlots", () => {
  it("single source used for both: fighter L7 totals from Table 34, minus spent", () => {
    const r = deriveProficiencySlots(src("fighter", 7), src("fighter", 7), 0, 2, 1);
    expect(r.weapon).toEqual({ total: 6, spent: 2, available: 4 });
    expect(r.nonweapon).toEqual({ total: 5, spent: 1, available: 4 });
    expect(r.languagesMax).toBe(0);
  });

  it("different weapon vs nonweapon sources", () => {
    // weapon from fighter L5 (4+floor(5/3)=5), nonweapon from mage L6 (4+floor(6/3)=6)
    const r = deriveProficiencySlots(src("fighter", 5), src("mage", 6), 0, 0, 0);
    expect(r.weapon.total).toBe(5);
    expect(r.nonweapon.total).toBe(6);
  });

  it("INT bonus languages add to languagesMax", () => {
    expect(deriveProficiencySlots(src("mage", 1), src("mage", 1), 4, 0, 0).languagesMax).toBe(4);
  });
});
