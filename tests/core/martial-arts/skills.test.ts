import { describe, expect, it } from "vitest";
import {
  blindFightingPenalty, blindFightingTotal, ironskinAcMod, knownManeuverIds, levitationInfo, resolveLeap, resolveSpeed,
} from "../../../src/core/martial-arts";

describe("resolveLeap", () => {
  it("level 10: standing 14 up / 13 forward, running 18 / 20 (the book's 10th-level example)", () => {
    const r = resolveLeap({ naturalD20: 12, thac0: 11, situationalModifier: 0, level: 10 });
    expect(r.standing).toEqual({ up: 14, forward: 13 });
    expect(r.running).toEqual({ up: 18, forward: 20 });
  });
  it("is a THAC0 attack roll against AC 10", () => {
    // needed = 20 - 10 = 10
    expect(resolveLeap({ naturalD20: 10, thac0: 20, situationalModifier: 0, level: 1 })).toMatchObject({ needed: 10, total: 10, hit: true });
    expect(resolveLeap({ naturalD20: 9, thac0: 20, situationalModifier: 0, level: 1 }).hit).toBe(false);
    expect(resolveLeap({ naturalD20: 9, thac0: 20, situationalModifier: 1, level: 1 }).hit).toBe(true);
  });
  it("a natural 20 lands and a natural 1 does not", () => {
    expect(resolveLeap({ naturalD20: 20, thac0: 25, situationalModifier: -5, level: 1 }).hit).toBe(true);
    expect(resolveLeap({ naturalD20: 1, thac0: 5, situationalModifier: 5, level: 1 }).hit).toBe(false);
  });
});

describe("resolveSpeed", () => {
  it("the book's example: Dex 13, roll 4 -> 9 under, 2 extra attacks (2.25 rounds to 2)", () => {
    expect(resolveSpeed({ naturalD20: 4, dexterity: 13 })).toEqual({ success: true, naturalD20: 4, dexterity: 13, extraAttacks: 2, restTurns: 2 });
  });
  it.each([
    [13, 13, 0, true], [13, 12, 0, true], [13, 11, 1, true], [13, 10, 1, true], [13, 9, 1, true], [13, 8, 1, true], [13, 7, 2, true],
  ])("Dex %i roll %i -> %i extra", (dexterity, naturalD20, extra, success) => {
    expect(resolveSpeed({ naturalD20, dexterity })).toMatchObject({ success, extraAttacks: extra });
  });
  it("a roll over Dexterity fails with no extra attacks", () => {
    expect(resolveSpeed({ naturalD20: 14, dexterity: 13 })).toMatchObject({ success: false, extraAttacks: 0, restTurns: 0 });
  });
});

describe("levitationInfo", () => {
  it("lasts level rounds at 5 ft per round", () => {
    expect(levitationInfo(7)).toEqual({ rounds: 7, feetPerRound: 5 });
  });
});

describe("constant abilities", () => {
  it("Ironskin is -2 only when known and wearing no body armor", () => {
    expect(ironskinAcMod(true, false)).toBe(-2);
    expect(ironskinAcMod(true, true)).toBe(0);
    expect(ironskinAcMod(false, false)).toBe(0);
  });
  it("Blind Fighting caps a penalty at -1 and leaves smaller ones alone", () => {
    expect(blindFightingPenalty(-4)).toBe(-1);
    expect(blindFightingPenalty(-1)).toBe(-1);
    expect(blindFightingPenalty(0)).toBe(0);
  });
  it("knownManeuverIds unions the known ids across every style", () => {
    const ids = knownManeuverIds([{ knownManeuvers: [{ id: "mental:6" }] }, { knownManeuvers: [{ id: "kick:1" }, { id: "mental:6" }] }, {}]);
    expect([...ids].sort()).toEqual(["kick:1", "mental:6"]);
  });
});

describe("blindFightingTotal", () => {
  it("caps the combined blinded + invisible penalty once when known", () => {
    expect(blindFightingTotal(-4, -4, true)).toBe(-1);
    expect(blindFightingTotal(-4, 0, true)).toBe(-1);
    expect(blindFightingTotal(0, 0, true)).toBe(0);
  });
  it("sums the penalties when not known", () => {
    expect(blindFightingTotal(-4, -4, false)).toBe(-8);
  });
});
