import { describe, expect, it } from "vitest";
import { noteInitiation, roundUpkeep } from "../../../src/core/psionics";

describe("noteInitiation (one power per round)", () => {
  it("the first power of a round is tallied without a warning", () => {
    expect(noteInitiation(null, "c1", 3, true)).toEqual({ next: { combatId: "c1", round: 3, count: 1 }, second: false });
  });
  it("a second counted power in the same round warns and increments", () => {
    const first = noteInitiation(null, "c1", 3, true).next;
    expect(noteInitiation(first, "c1", 3, true)).toEqual({ next: { combatId: "c1", round: 3, count: 2 }, second: true });
  });
  it("a new round or a different combat starts over", () => {
    const prev = { combatId: "c1", round: 3, count: 2 };
    expect(noteInitiation(prev, "c1", 4, true)).toEqual({ next: { combatId: "c1", round: 4, count: 1 }, second: false });
    expect(noteInitiation(prev, "c2", 3, true)).toEqual({ next: { combatId: "c2", round: 3, count: 1 }, second: false });
  });
  it("a defense mode never counts and never warns", () => {
    const prev = { combatId: "c1", round: 3, count: 1 };
    expect(noteInitiation(prev, "c1", 3, false)).toEqual({ next: prev, second: false });
    expect(noteInitiation(null, "c1", 3, false)).toEqual({ next: null, second: false });
  });
});

describe("roundUpkeep", () => {
  const m = (powerId: string, cost: number, unit = "round") => ({ powerId, name: powerId, cost, unit });
  it("pays per-round powers in order and the tangent PSP", () => {
    expect(roundUpkeep({ pool: 10, maintained: [m("a", 2), m("b", 3)], partialTangents: true })).toEqual({ pool: 4, paid: 6, ended: [], tangentsBroken: false });
  });
  it("leaves per-turn and per-hour powers alone", () => {
    expect(roundUpkeep({ pool: 10, maintained: [m("a", 2, "turn"), m("b", 3, "hour"), m("c", 1)], partialTangents: false })).toEqual({ pool: 9, paid: 1, ended: [], tangentsBroken: false });
  });
  it("a power that cannot be paid ends and later cheaper ones are still paid", () => {
    expect(roundUpkeep({ pool: 3, maintained: [m("a", 5), m("b", 2)], partialTangents: false })).toEqual({ pool: 1, paid: 2, ended: [{ powerId: "a", name: "a" }], tangentsBroken: false });
  });
  it("tangents break when no PSP is left, and are free without partial tangents", () => {
    expect(roundUpkeep({ pool: 0, maintained: [], partialTangents: true })).toEqual({ pool: 0, paid: 0, ended: [], tangentsBroken: true });
    expect(roundUpkeep({ pool: 0, maintained: [], partialTangents: false })).toEqual({ pool: 0, paid: 0, ended: [], tangentsBroken: false });
  });
});
