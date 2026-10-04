import { describe, expect, it } from "vitest";
import { canMemorizePriestSpell, priestAccessScope, priestHasMajorAccessAtLevel } from "../../src/magic/priest-sphere-access";
import type { SphereName } from "../../src/core/types";

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
