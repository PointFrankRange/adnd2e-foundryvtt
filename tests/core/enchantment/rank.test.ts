import { describe, expect, it } from "vitest";
import {
  HIT_REQUIREMENTS, attackRank, canHarm, chiRank, chiRankLabelKey, requirementLabelKey, requirementRank, weaponRank,
} from "../../../src/core/enchantment";

describe("requirementRank", () => {
  it.each([["", 0], ["magical", 1], ["plus1", 2], ["plus2", 3], ["plus3", 4], ["plus4", 5], ["plus5", 6], ["bogus", 0]])(
    "%s -> %i", (req, rank) => expect(requirementRank(req)).toBe(rank),
  );
  it("lists the seven requirement ids in order", () => {
    expect([...HIT_REQUIREMENTS]).toEqual(["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"]);
  });
});

describe("weaponRank", () => {
  it.each([[-1, 0], [0, 0], [1, 2], [2, 3], [3, 4], [5, 6]])("+%i weapon -> rank %i", (bonus, rank) => {
    expect(weaponRank(bonus)).toBe(rank);
  });
});

describe("chiRank - PHBR15 Table 20", () => {
  it.each([
    [0, 0], [-3, 0], [1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4], [20, 5], [27, 5],
  ])("level %i -> rank %i", (level, rank) => expect(chiRank(level)).toBe(rank));
});

describe("attackRank", () => {
  it("is the best of weapon, ammunition and ch'i", () => {
    expect(attackRank({})).toBe(0);
    expect(attackRank({ weaponMagicBonus: 1 })).toBe(2);
    expect(attackRank({ weaponMagicBonus: 1, ammoMagicBonus: 3 })).toBe(4);
    expect(attackRank({ weaponMagicBonus: 3, ammoMagicBonus: 0 })).toBe(4);
    expect(attackRank({ weaponMagicBonus: 0, chiLevel: 10 })).toBe(3);
    expect(attackRank({ weaponMagicBonus: 4, chiLevel: 5 })).toBe(5);
  });
  it("ignores ch'i when no ch'i level is given", () => {
    expect(attackRank({ weaponMagicBonus: 0, chiLevel: null })).toBe(0);
  });
});

describe("canHarm", () => {
  const reqs = ["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"];
  it("an attack harms exactly the requirements at or below its rank", () => {
    for (let rank = 0; rank <= 6; rank++) {
      reqs.forEach((req, i) => expect(canHarm(rank, req), `rank ${rank} vs ${req || "none"}`).toBe(rank >= i));
    }
  });
  it("a plain sword cannot harm a magical-only creature; a +1 sword can; a level 3 ch'i fist can too", () => {
    expect(canHarm(attackRank({ weaponMagicBonus: 0 }), "magical")).toBe(false);
    expect(canHarm(attackRank({ weaponMagicBonus: 1 }), "magical")).toBe(true);
    expect(canHarm(attackRank({ chiLevel: 3 }), "magical")).toBe(true);
    expect(canHarm(attackRank({ chiLevel: 3 }), "plus1")).toBe(false);
    expect(canHarm(attackRank({ chiLevel: 9 }), "plus2")).toBe(false);
    expect(canHarm(attackRank({ chiLevel: 10 }), "plus2")).toBe(true);
  });
});

describe("label keys", () => {
  it("maps requirements and ch'i ranks to lang keys", () => {
    expect(requirementLabelKey("")).toBe("ADND2E.hitRequirements.none");
    expect(requirementLabelKey("magical")).toBe("ADND2E.hitRequirements.magical");
    expect(requirementLabelKey("plus3")).toBe("ADND2E.hitRequirements.plus3");
    expect(chiRankLabelKey(0)).toBe("ADND2E.martialChi.rank0");
    expect(chiRankLabelKey(5)).toBe("ADND2E.martialChi.rank5");
  });
});
