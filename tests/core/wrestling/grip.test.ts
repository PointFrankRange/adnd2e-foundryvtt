import { describe, expect, it } from "vitest";
import { gripOutcome, temporaryDamage } from "../../../src/core/wrestling";

const g = (action: "hold" | "improve" | "holdOn" | "breakFree", rung: "free" | "held" | "locked", winner: "holder" | "held" | "none", critical = false) =>
  gripOutcome({ action, rung, winner, critical });

describe("hold (the first check after a hit)", () => {
  it("the holder winning establishes a hold and hurts the held character", () => {
    expect(g("hold", "free", "holder")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: "held", repeatLock: false });
  });
  it("anything else drives the attacker back: the grapple is over", () => {
    expect(g("hold", "free", "held")).toMatchObject({ rung: "free", damageTo: null });
    expect(g("hold", "free", "none")).toMatchObject({ rung: "free", damageTo: null });
  });
});

describe("improve grip", () => {
  it("holder wins: the rung rises to locked, a lock is pending, the held character is hurt", () => {
    expect(g("improve", "held", "holder")).toEqual({ rung: "locked", swap: false, lockPending: true, damageTo: "held", repeatLock: false });
    expect(g("improve", "locked", "holder")).toMatchObject({ rung: "locked", lockPending: true });
  });
  it("held wins: the holder is hurt and the rung falls", () => {
    expect(g("improve", "locked", "held")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: "holder", repeatLock: false });
    expect(g("improve", "held", "held")).toMatchObject({ rung: "free", damageTo: "holder" });
  });
  it("held wins with a critical: roles swap, the old held character locks the old holder", () => {
    expect(g("improve", "held", "held", true)).toEqual({ rung: "locked", swap: true, lockPending: true, damageTo: "holder", repeatLock: false });
  });
  it("no winner: nothing changes", () => {
    expect(g("improve", "held", "none")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: null, repeatLock: false });
  });
});

describe("hold on", () => {
  it("holder wins at held: still held and hurt; at locked: still locked and the last lock repeats", () => {
    expect(g("holdOn", "held", "holder")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: "held", repeatLock: false });
    expect(g("holdOn", "locked", "holder")).toEqual({ rung: "locked", swap: false, lockPending: false, damageTo: null, repeatLock: true });
  });
  it("held wins: the rung falls one place, with no damage and no critical swap", () => {
    expect(g("holdOn", "locked", "held", true)).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: null, repeatLock: false });
    expect(g("holdOn", "held", "held")).toMatchObject({ rung: "free" });
  });
  it("no winner: no change and no damage", () => {
    expect(g("holdOn", "locked", "none")).toEqual({ rung: "locked", swap: false, lockPending: false, damageTo: null, repeatLock: false });
  });
});

describe("break free", () => {
  it("held wins: the holder is hurt and the rung falls; a critical swaps roles", () => {
    expect(g("breakFree", "held", "held")).toEqual({ rung: "free", swap: false, lockPending: false, damageTo: "holder", repeatLock: false });
    expect(g("breakFree", "locked", "held")).toMatchObject({ rung: "held", damageTo: "holder" });
    expect(g("breakFree", "locked", "held", true)).toEqual({ rung: "locked", swap: true, lockPending: true, damageTo: "holder", repeatLock: false });
  });
  it("holder wins: no change, but a critical gives the holder a lock", () => {
    expect(g("breakFree", "held", "holder")).toEqual({ rung: "held", swap: false, lockPending: false, damageTo: null, repeatLock: false });
    expect(g("breakFree", "held", "holder", true)).toEqual({ rung: "locked", swap: false, lockPending: true, damageTo: null, repeatLock: false });
  });
  it("no winner: no change", () => {
    expect(g("breakFree", "locked", "none")).toMatchObject({ rung: "locked", damageTo: null });
  });
});

describe("temporaryDamage", () => {
  it("lowers HP, raises nonlethal by the same amount and flags unconsciousness at 0 or below", () => {
    expect(temporaryDamage({ value: 14, nonlethal: 0 }, 3)).toEqual({ value: 11, nonlethal: 3, unconscious: false });
    expect(temporaryDamage({ value: 5, nonlethal: 8 }, 5)).toEqual({ value: 0, nonlethal: 13, unconscious: true });
    expect(temporaryDamage({ value: 2, nonlethal: 0 }, 7)).toEqual({ value: -5, nonlethal: 7, unconscious: true });
  });
  it("ignores a non-positive amount", () => {
    expect(temporaryDamage({ value: 5, nonlethal: 1 }, 0)).toEqual({ value: 5, nonlethal: 1, unconscious: false });
  });
});
