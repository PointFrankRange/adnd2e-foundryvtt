import { describe, expect, it } from "vitest";
import { canLearn, canRelearn, primaryDiscipline, type KnownPower } from "../../../src/core/psionics";

let n = 0;
const p = (discipline: KnownPower["discipline"], kind: KnownPower["kind"], scoreBonus = 0): KnownPower => ({ id: `p${n++}`, discipline, kind, scoreBonus });
const many = (count: number, d: KnownPower["discipline"], k: KnownPower["kind"]) => Array.from({ length: count }, () => p(d, k));

describe("primaryDiscipline", () => {
  it("is the discipline of the first science or devotion; defense modes never set it", () => {
    expect(primaryDiscipline([])).toBeNull();
    expect(primaryDiscipline([p("telepathy", "defense"), p("clairsentience", "devotion"), p("psychokinesis", "science")])).toBe("clairsentience");
  });
});

describe("canLearn", () => {
  it("level 1 starts with one science and three devotions in a single discipline (devotions first)", () => {
    let known: KnownPower[] = [];
    for (let i = 0; i < 3; i++) { expect(canLearn(known, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: true }); known = [...known, p("clairsentience", "devotion")]; }
    expect(canLearn(known, { discipline: "clairsentience", kind: "science" }, 1)).toEqual({ ok: true });
    expect(canLearn(known, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: false, reason: "devotion-limit" });
  });
  it("a science needs devotions >= 2 x (sciences + 1) in its discipline (the book's Lena example)", () => {
    // 3 sciences, 7 devotions in the primary (level 9: table 5/14, 3 disciplines)
    const known = [...many(3, "clairsentience", "science"), ...many(7, "clairsentience", "devotion")];
    expect(canLearn(known, { discipline: "clairsentience", kind: "science" }, 9)).toEqual({ ok: false, reason: "devotion-ratio" });
    const eight = [...known, p("clairsentience", "devotion")];
    expect(canLearn(eight, { discipline: "clairsentience", kind: "science" }, 9)).toEqual({ ok: true });
  });
  it("another discipline can never reach the primary's counts (Lena: at most 2 sciences or 6 devotions elsewhere)", () => {
    const known = [...many(3, "clairsentience", "science"), ...many(7, "clairsentience", "devotion")];
    const other = (k: KnownPower["kind"], c: number) => many(c, "psychokinesis", k);
    expect(canLearn([...known, ...other("science", 1)], { discipline: "psychokinesis", kind: "science" }, 9)).toEqual({ ok: false, reason: "devotion-ratio" });
    expect(canLearn([...known, ...other("devotion", 6)], { discipline: "psychokinesis", kind: "devotion" }, 12)).toEqual({ ok: false, reason: "primary-cap" });
    expect(canLearn([...known, ...other("devotion", 5)], { discipline: "psychokinesis", kind: "devotion" }, 12)).toEqual({ ok: true });
  });
  it("discipline access: a new discipline beyond the level's count is refused; defense modes use their own limit", () => {
    const known = many(3, "clairsentience", "devotion");
    expect(canLearn(known, { discipline: "psychokinesis", kind: "devotion" }, 1)).toEqual({ ok: false, reason: "discipline-access" });
    expect(canLearn(known, { discipline: "psychokinesis", kind: "devotion" }, 2)).toEqual({ ok: true });
    expect(canLearn([p("telepathy", "defense")], { discipline: "telepathy", kind: "defense" }, 1)).toEqual({ ok: false, reason: "defense-limit" });
    expect(canLearn([p("telepathy", "defense")], { discipline: "telepathy", kind: "defense" }, 3)).toEqual({ ok: true });
    expect(canLearn([], { discipline: "telepathy", kind: "defense" }, 1)).toEqual({ ok: true });
  });
  it("totals: the science limit is reported when sciences are full", () => {
    const known = [...many(1, "clairsentience", "science"), ...many(5, "clairsentience", "devotion")];
    expect(canLearn(known, { discipline: "clairsentience", kind: "science" }, 2)).toEqual({ ok: false, reason: "science-limit" });
  });
});

describe("canRelearn", () => {
  it("spends one slot of the same kind from the table budget (devotions)", () => {
    const known = [...many(2, "clairsentience", "devotion")];
    expect(canRelearn(known, known[0]!.id, 1)).toEqual({ ok: true }); // 2 known of 3 allowed
    const full = [...many(3, "clairsentience", "devotion")];
    expect(canRelearn(full, full[0]!.id, 1)).toEqual({ ok: false, reason: "no-budget" });
    const bonus = [p("clairsentience", "devotion", 1), p("clairsentience", "devotion"), p("clairsentience", "devotion")];
    expect(canRelearn(bonus, bonus[1]!.id, 1)).toEqual({ ok: false, reason: "no-budget" }); // 3 known + 1 relearn > 3
  });
  it("spends one slot of the same kind from the table budget (sciences)", () => {
    const science = [p("clairsentience", "science")];
    expect(canRelearn(science, science[0]!.id, 3)).toEqual({ ok: true }); // 1 known of 2 allowed at level 3
    const two = [...many(2, "clairsentience", "science"), ...many(7, "clairsentience", "devotion")];
    expect(canRelearn(two, two[0]!.id, 3)).toEqual({ ok: false, reason: "no-budget" }); // 2 known of 2 allowed at level 3
  });
  it("relearned points count against the budget (known 2 + 1 relearned = 3 slots used at level 1)", () => {
    const known = [p("clairsentience", "devotion", 1), p("clairsentience", "devotion")];
    expect(canRelearn(known, known[1]!.id, 1)).toEqual({ ok: false, reason: "no-budget" });
    expect(canLearn(known, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: false, reason: "devotion-limit" });
    const none = [p("clairsentience", "devotion"), p("clairsentience", "devotion")];
    expect(canRelearn(none, none[1]!.id, 1)).toEqual({ ok: true });
    expect(canLearn(none, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: true });
  });
  it("defense modes do not hold a discipline slot or use science or devotion slots", () => {
    const known = [p("telepathy", "defense")];
    expect(canLearn(known, { discipline: "clairsentience", kind: "devotion" }, 1)).toEqual({ ok: true });
    const full = [...many(3, "clairsentience", "devotion"), p("telepathy", "defense")];
    expect(canLearn(full, { discipline: "clairsentience", kind: "science" }, 1)).toEqual({ ok: true });
  });
  it("another discipline can hold at most (primary - 1) sciences (primary 3 sciences, 7 devotions)", () => {
    const primary = [...many(3, "clairsentience", "science"), ...many(7, "clairsentience", "devotion")];
    const two = [...many(1, "psychokinesis", "science"), ...many(5, "psychokinesis", "devotion")];
    expect(canLearn([...primary, ...two], { discipline: "psychokinesis", kind: "science" }, 12)).toEqual({ ok: true }); // 2nd science, 5 devotions >= 4
    const three = [...many(2, "psychokinesis", "science"), ...many(7, "psychokinesis", "devotion")];
    expect(canLearn([...primary, ...three], { discipline: "psychokinesis", kind: "science" }, 18)).toEqual({ ok: false, reason: "primary-cap" });
  });
  it("an unknown id is refused", () => {
    expect(canRelearn([], "nope", 1)).toEqual({ ok: false, reason: "no-budget" });
  });
  it("handles relearning defense modes", () => {
    const known = [p("telepathy", "defense")];
    expect(canRelearn(known, known[0]!.id, 5)).toEqual({ ok: true }); // 1 known of 5 allowed
    const full = [...many(5, "telepathy", "defense")];
    expect(canRelearn(full, full[0]!.id, 5)).toEqual({ ok: false, reason: "no-budget" }); // 5 known of 5 allowed
  });
});
