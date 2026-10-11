import { describe, expect, it } from "vitest";
import {
  BASE_SHAPECHANGE_SPEC, afterNewDay, afterShift, canShift, formArmorClass, formEligible, healOnShift,
  isShapechanged, resolveShapechangeSpec, shapechangeAvailable, snapshotForm, usesLeft, type ShapechangeSpec,
} from "../../../src/core/shapechange";

const base = BASE_SHAPECHANGE_SPEC;
const power = (over: Partial<{ uses: number; per: string; params: { key: string; value: string }[] }> = {}) => ({
  id: "shapechange", uses: 0, per: "day", params: [], ...over,
});

describe("base spec", () => {
  it("is the Player's Handbook rule", () => {
    expect(base).toMatchObject({ minLevel: 7, uses: 3, oncePerCategory: true, habitats: [], allowGiant: false });
    expect([...base.categories]).toEqual(["reptile", "bird", "mammal"]);
  });
});

describe("resolveShapechangeSpec", () => {
  it("falls back to the base spec with no power", () => {
    expect(resolveShapechangeSpec(null)).toEqual(base);
    expect(resolveShapechangeSpec(undefined)).toEqual(base);
  });
  it("reads uses (day only) and params", () => {
    const spec = resolveShapechangeSpec(power({
      uses: 2,
      params: [
        { key: "minLevel", value: "5" }, { key: "habitats", value: " Desert, FOREST ,volcano" },
        { key: "categories", value: "bird, mammal, fish" }, { key: "oncePerCategory", value: "false" }, { key: "giant", value: "true" },
      ],
    }));
    expect(spec).toEqual({ minLevel: 5, uses: 2, categories: ["bird", "mammal"], oncePerCategory: false, habitats: ["desert", "forest"], allowGiant: true });
  });
  it("ignores a non-day frequency and a zero use count", () => {
    expect(resolveShapechangeSpec(power({ uses: 9, per: "week" })).uses).toBe(3);
    expect(resolveShapechangeSpec(power({ uses: 0 })).uses).toBe(3);
  });
  it("falls back on malformed params and ignores unknown param keys", () => {
    const spec = resolveShapechangeSpec(power({ params: [
      { key: "minLevel", value: "zero" }, { key: "categories", value: "fish" }, { key: "habitats", value: "" },
      { key: "oncePerCategory", value: "maybe" }, { key: "giant", value: "yes" }, { key: "other", value: "x" },
    ] }));
    expect(spec).toEqual(base);
  });
  it("fails closed on habitats: an all-unknown list matches no form, a mixed list keeps the known ids", () => {
    const typo = resolveShapechangeSpec(power({ params: [{ key: "habitats", value: "forests" }] }));
    expect(typo.habitats).toEqual(["forests"]);
    expect(formEligible({ category: "mammal", habitats: ["forest"], giant: false }, typo)).toBe(false);
    expect(resolveShapechangeSpec(power({ params: [{ key: "habitats", value: "desert, Forests" }] })).habitats).toEqual(["desert"]);
  });
  it("tolerates a missing params array and padded or capitalised booleans", () => {
    expect(resolveShapechangeSpec({ id: "shapechange", uses: 0, per: "day" })).toEqual(base);
    const spec = resolveShapechangeSpec(power({ params: [{ key: "oncePerCategory", value: "False" }, { key: "giant", value: " true " }] }));
    expect(spec.oncePerCategory).toBe(false);
    expect(spec.allowGiant).toBe(true);
  });
  it("requires an integer use count", () => {
    expect(resolveShapechangeSpec(power({ uses: 2.5 })).uses).toBe(3);
  });
  it("honours usesByLevel brackets", () => {
    const scaled = { ...power({ uses: 0 }), usesByLevel: [{ minLevel: 7, uses: 2 }, { minLevel: 11, uses: 4 }] };
    expect(resolveShapechangeSpec(scaled, 7).uses).toBe(2);
    expect(resolveShapechangeSpec(scaled, 11).uses).toBe(4);
    expect(resolveShapechangeSpec(scaled, 3).uses).toBe(3);
  });
  it("rejects a non-positive or fractional minLevel", () => {
    expect(resolveShapechangeSpec(power({ params: [{ key: "minLevel", value: "0" }] })).minLevel).toBe(7);
    expect(resolveShapechangeSpec(power({ params: [{ key: "minLevel", value: "7.5" }] })).minLevel).toBe(7);
  });
  it("does not share arrays with the base spec", () => {
    const spec = resolveShapechangeSpec(null);
    spec.categories.push("bird");
    expect(base.categories).toHaveLength(3);
  });
});

describe("isShapechanged", () => {
  it("is true only with a form set", () => {
    expect(isShapechanged({ system: { shapechange: { form: { name: "Bear" } } } })).toBe(true);
    expect(isShapechanged({ system: { shapechange: { form: null } } })).toBe(false);
    expect(isShapechanged({ system: {} })).toBe(false);
    expect(isShapechanged({})).toBe(false);
  });
});

describe("shapechangeAvailable", () => {
  it("needs the spec's level", () => {
    expect(shapechangeAvailable(6, base)).toBe(false);
    expect(shapechangeAvailable(7, base)).toBe(true);
    expect(shapechangeAvailable(0, base)).toBe(false);
  });
});

describe("formEligible", () => {
  const tags = (over = {}) => ({ category: "mammal" as const, habitats: ["forest"], giant: false, ...over });
  it("needs a category the spec allows", () => {
    expect(formEligible(tags({ category: "" }), base)).toBe(false);
    expect(formEligible(tags({ category: "bird" }), { ...base, categories: ["mammal"] })).toBe(false);
    expect(formEligible(tags(), base)).toBe(true);
  });
  it("excludes giants unless allowed", () => {
    expect(formEligible(tags({ giant: true }), base)).toBe(false);
    expect(formEligible(tags({ giant: true }), { ...base, allowGiant: true })).toBe(true);
  });
  it("enforces habitats only when the spec lists some", () => {
    expect(formEligible(tags({ habitats: [] }), base)).toBe(true);
    expect(formEligible(tags({ habitats: ["desert"] }), { ...base, habitats: ["forest"] })).toBe(false);
    expect(formEligible(tags({ habitats: ["desert", "forest"] }), { ...base, habitats: ["forest"] })).toBe(true);
    expect(formEligible(tags({ habitats: [] }), { ...base, habitats: ["forest"] })).toBe(false);
  });
});

describe("limits", () => {
  const state = { usedToday: 0, categoriesUsed: [] as string[] };
  const form = { category: "bird" as const, habitats: [], giant: false };
  it("usesLeft counts down and never goes negative", () => {
    expect(usesLeft(state, base)).toBe(3);
    expect(usesLeft({ usedToday: 5, categoriesUsed: [] }, base)).toBe(0);
  });
  it("blocks with the first applicable reason", () => {
    expect(canShift(state, base, form)).toEqual({ ok: true });
    expect(canShift({ usedToday: 3, categoriesUsed: [] }, base, form)).toEqual({ ok: false, reason: "noUsesLeft" });
    expect(canShift({ usedToday: 1, categoriesUsed: ["bird"] }, base, form)).toEqual({ ok: false, reason: "categoryUsed" });
    expect(canShift(state, base, { ...form, giant: true })).toEqual({ ok: false, reason: "notEligible" });
  });
  it("the same category may repeat when oncePerCategory is off", () => {
    const spec: ShapechangeSpec = { ...base, oncePerCategory: false };
    expect(canShift({ usedToday: 1, categoriesUsed: ["bird"] }, spec, form)).toEqual({ ok: true });
  });
  it("afterShift spends one use and records the category once", () => {
    const s1 = afterShift(state, "bird");
    expect(s1).toEqual({ usedToday: 1, categoriesUsed: ["bird"] });
    expect(afterShift(s1, "bird")).toEqual({ usedToday: 2, categoriesUsed: ["bird"] });
    expect(state).toEqual({ usedToday: 0, categoriesUsed: [] });
  });
  it("afterNewDay clears both counters", () => {
    expect(afterNewDay()).toEqual({ usedToday: 0, categoriesUsed: [] });
  });
});

describe("healOnShift", () => {
  it("matches the handbook's worked example (15 damage, d6 3 -> 4)", () => {
    expect(healOnShift(15, 3)).toBe(4);
  });
  it("is 10% to 60% of the damage, fractions rounded down", () => {
    expect(healOnShift(10, 1)).toBe(1);
    expect(healOnShift(10, 6)).toBe(6);
    expect(healOnShift(7, 1)).toBe(0);
    expect(healOnShift(19, 6)).toBe(11);
  });
  it("is zero with no damage and never negative", () => {
    expect(healOnShift(0, 6)).toBe(0);
    expect(healOnShift(-5, 6)).toBe(0);
  });
  it("is zero when an argument is not finite", () => {
    expect(healOnShift(Number.NaN, 3)).toBe(0);
    expect(healOnShift(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("snapshotForm and formArmorClass", () => {
  const source = {
    name: "Brown Bear", img: "bear.png",
    system: {
      attributes: { ac: { value: 6 }, movement: { land: 12, swim: 6 } },
      attacks: [{ name: "Claw", count: 2, damage: "1d6", type: "melee" }, { name: "Bite", damage: "1d8" }],
      details: { shapechange: { category: "mammal" } },
    },
  };
  it("copies the stat block and fills missing movement and attack fields", () => {
    expect(snapshotForm(source)).toEqual({
      name: "Brown Bear", img: "bear.png", category: "mammal", ac: 6,
      movement: { land: 12, burrow: 0, climb: 0, fly: 0, swim: 6, flyManeuverability: "" },
      attacks: [{ name: "Claw", count: 2, damage: "1d6", type: "melee" }, { name: "Bite", count: 1, damage: "1d8", type: "melee" }],
    });
  });
  it("is null for an untagged source", () => {
    expect(snapshotForm({ ...source, system: { ...source.system, details: { shapechange: { category: "" } } } })).toBeNull();
  });
  it("does not alias the source's attack objects", () => {
    const snap = snapshotForm(source)!;
    snap.attacks[0]!.name = "changed";
    expect(source.system.attacks[0]!.name).toBe("Claw");
  });
  it("the form's AC applies to every AC context", () => {
    expect(formArmorClass({ ac: 6 })).toEqual({ normal: 6, rearAttack: 6, surprised: 6, shieldless: 6 });
  });
});

describe("canShift priority", () => {
  it("reports notEligible before noUsesLeft when both apply", () => {
    const verdict = canShift({ usedToday: 3, categoriesUsed: [] }, base, { category: "mammal", habitats: [], giant: true });
    expect(verdict).toEqual({ ok: false, reason: "notEligible" });
  });
});
