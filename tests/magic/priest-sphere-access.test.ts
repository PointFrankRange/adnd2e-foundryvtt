import { describe, expect, it } from "vitest";
import { canMemorizePriestSpell, priestAccessScope, priestFreeCastEligible, priestHasMajorAccessAtLevel } from "../../src/magic/priest-sphere-access";
import type { SphereName } from "../../src/core/types";

describe("priestFreeCastEligible", () => {
  const healing2 = { casterClass: "priest", level: 2, spheres: ["healing"] };
  const elemental2 = { casterClass: "priest", level: 2, spheres: ["elemental"] };
  const major = { scope: "major" as const, chassisId: "cleric", sphereAccessOverride: null };
  const universal = { scope: "universal" as const, chassisId: "cleric", sphereAccessOverride: null };

  it("major scope: a priest spell with major access at the level is eligible", () => {
    expect(priestFreeCastEligible(major, healing2, 2)).toBe(true);
  });

  it("major scope: a minor-access spell (elemental at 2nd level) is not eligible", () => {
    expect(priestFreeCastEligible(major, elemental2, 2)).toBe(false);
  });

  it("universal scope: any priest spell of the level is eligible, with no access check", () => {
    expect(priestFreeCastEligible(universal, elemental2, 2)).toBe(true);
    expect(priestFreeCastEligible(universal, healing2, 2)).toBe(true);
  });

  it("rejects a spell of another level, or a non-priest spell", () => {
    expect(priestFreeCastEligible(universal, healing2, 3)).toBe(false);
    expect(priestFreeCastEligible(major, { ...healing2, casterClass: "wizard" }, 2)).toBe(false);
  });

  it("major scope with no priest class (null chassis) is never eligible", () => {
    expect(priestFreeCastEligible({ ...major, chassisId: null }, healing2, 2)).toBe(false);
  });
});

describe("priestAccessScope", () => {
  it("returns major when any sphere is major at this level", () => {
    expect(priestAccessScope("cleric", null, ["healing"], 5)).toBe("major");
  });

  it("returns minor for a minor-only sphere ('elemental') capped at 3rd level", () => {
    // CLERIC_SPHERE_ACCESS: elemental is the only minor sphere for a cleric.
    expect(priestAccessScope("cleric", null, ["elemental"], 3)).toBe("minor");
    expect(priestAccessScope("cleric", null, ["elemental"], 4)).toBeNull();
  });

  it("returns null when no sphere grants access", () => {
    expect(priestAccessScope(null, null, ["healing"], 1)).toBeNull();
  });

});

describe("priestAccessScope — major beats minor", () => {
  it("a spell listing a minor-access sphere and a major-access sphere at the same level is priced major", () => {
    expect(priestAccessScope("cleric", null, ["elemental", "healing"], 2)).toBe("major");
  });

  it("the sphere order does not change the result", () => {
    expect(priestAccessScope("cleric", null, ["healing", "elemental"], 2)).toBe("major");
  });
});

describe("canMemorizePriestSpell", () => {
  it("null chassisId (no priest-progression class on the actor) → always false", () => {
    expect(canMemorizePriestSpell(null, null, ["healing"], 1)).toBe(false);
  });

  it("cleric, major-access sphere, level within cap (7) → true", () => {
    expect(canMemorizePriestSpell("cleric", null, ["healing"], 7)).toBe(true);
  });

  it("cleric, minor-access sphere ('elemental'), level within the minor cap (3) → true", () => {
    expect(canMemorizePriestSpell("cleric", null, ["elemental"], 3)).toBe(true);
  });

  it("cleric, minor-access sphere ('elemental'), level above the minor cap (4) → false", () => {
    expect(canMemorizePriestSpell("cleric", null, ["elemental"], 4)).toBe(false);
  });

  it("cleric, no-access sphere ('animal') → false at any level", () => {
    expect(canMemorizePriestSpell("cleric", null, ["animal"], 1)).toBe(false);
  });

  it("multi-sphere spell is memorizable if ANY listed sphere is accessible", () => {
    // "animal" is none for a cleric, "healing" is major — the spell should still be allowed.
    expect(canMemorizePriestSpell("cleric", null, ["animal", "healing"], 5)).toBe(true);
  });

  it("druid, major-access sphere ('plant') → true", () => {
    expect(canMemorizePriestSpell("druid", null, ["plant"], 6)).toBe(true);
  });

  it("druid, sphere the druid table omits ('astral') → false", () => {
    expect(canMemorizePriestSpell("druid", null, ["astral"], 1)).toBe(false);
  });

  it("non-priest chassis id (e.g. a fighter's chassisId leaking in) → false", () => {
    expect(canMemorizePriestSpell("fighter", null, ["healing"], 1)).toBe(false);
  });

  it("sphereAccessOverride replaces the chassis table entirely — listed spheres become major", () => {
    const override: SphereName[] = ["charm"];
    // "charm" is major for a cleric anyway — pick a sphere the cleric table has as "none"
    // ('animal') to prove the override, not the base table, is what's being consulted.
    expect(canMemorizePriestSpell("cleric", ["animal"] as SphereName[], ["animal"], 7)).toBe(true);
    expect(canMemorizePriestSpell("cleric", ["animal"] as SphereName[], ["healing"], 1)).toBe(false);
    void override;
  });
});

describe("priestHasMajorAccessAtLevel", () => {
  it("cleric has major access at level 5 (within the 7th-level major cap) → true", () => {
    expect(priestHasMajorAccessAtLevel("cleric", null, 5)).toBe(true);
  });

  it("cleric has no major access at level 8 (above the major cap) → false", () => {
    expect(priestHasMajorAccessAtLevel("cleric", null, 8)).toBe(false);
  });

  it("no priest-progression class (null chassis) → false", () => {
    expect(priestHasMajorAccessAtLevel(null, null, 1)).toBe(false);
  });

  it("an empty sphere override grants no major sphere → false", () => {
    expect(priestHasMajorAccessAtLevel("cleric", [], 1)).toBe(false);
  });

  it("an override listing a major sphere grants major access up to the cap → true", () => {
    expect(priestHasMajorAccessAtLevel("cleric", ["healing"], 7)).toBe(true);
  });
});

describe("paladin and ranger sphere access (major access)", () => {
  it("paladin: healing (major) memorizable at level 4 (the 4th-level cap is not blocked)", () => {
    expect(canMemorizePriestSpell("paladin", null, ["healing"], 4)).toBe(true);
  });

  it("paladin: plant spell is not memorizable (no access)", () => {
    expect(canMemorizePriestSpell("paladin", null, ["plant"], 1)).toBe(false);
  });

  it("paladin: combat, divination and protection are priced major", () => {
    expect(priestAccessScope("paladin", null, ["combat"], 2)).toBe("major");
    expect(priestAccessScope("paladin", null, ["divination"], 2)).toBe("major");
    expect(priestAccessScope("paladin", null, ["protection"], 2)).toBe("major");
  });

  it("ranger: animal spell memorizable at level 3", () => {
    expect(canMemorizePriestSpell("ranger", null, ["animal"], 3)).toBe(true);
  });

  it("ranger: combat spell is not memorizable (no access)", () => {
    expect(canMemorizePriestSpell("ranger", null, ["combat"], 1)).toBe(false);
  });

  it("paladin and ranger tables: a sphere outside the table grants no access", () => {
    expect(canMemorizePriestSpell("ranger", null, ["healing"], 1)).toBe(false);
    expect(canMemorizePriestSpell("paladin", null, ["animal"], 1)).toBe(false);
  });

  it("cleric results are unchanged by the new tables", () => {
    expect(canMemorizePriestSpell("cleric", null, ["plant"], 1)).toBe(false);
    expect(canMemorizePriestSpell("cleric", null, ["healing"], 4)).toBe(true);
    expect(priestAccessScope("cleric", null, ["elemental"], 3)).toBe("minor");
  });
});
