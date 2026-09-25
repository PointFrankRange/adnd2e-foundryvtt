import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  acDexAdjWhileCasting,
  canCompleteCasting,
  castingPlan,
  expandedCastingTimeEnabled,
  hpChangeDisrupts,
  parseCastingTime,
} from "../../../src/core/magic/casting-time";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("expandedCastingTimeEnabled (the one gate)", () => {
  it("needs the master switch AND the casting-time toggle", () => {
    expect(expandedCastingTimeEnabled(rules())).toBe(false);
    expect(expandedCastingTimeEnabled(rules({ spellsAndMagicEnabled: true }))).toBe(false);
    expect(expandedCastingTimeEnabled(rules({ expandedCastingTime: true }))).toBe(false);
    expect(expandedCastingTimeEnabled(rules({ spellsAndMagicEnabled: true, expandedCastingTime: true }))).toBe(true);
  });
});

describe("parseCastingTime", () => {
  it.each([
    ["3", { kind: "segments", value: 3 }],
    ["0", { kind: "segments", value: 0 }],
    [" 12 ", { kind: "segments", value: 12 }],
    ["1 round", { kind: "rounds", value: 1 }],
    ["2 rounds", { kind: "rounds", value: 2 }],
    ["2 Rounds", { kind: "rounds", value: 2 }],
    ["3rounds", { kind: "rounds", value: 3 }],
    ["1 turn", { kind: "rounds", value: 10 }],
    ["2 TURNS", { kind: "rounds", value: 20 }],
  ])("%j -> %j", (text, expected) => {
    expect(parseCastingTime(text)).toEqual(expected);
  });

  it.each(["", "   ", "special", "1 hour", "1/2", "3 segments", "0 rounds", "0 turns", "-1", "1.5", "round"])(
    "%j is unknown",
    (text) => {
      expect(parseCastingTime(text)).toEqual({ kind: "unknown" });
    },
  );
});

describe("castingPlan", () => {
  it("casts an unknown time immediately", () => {
    expect(castingPlan({ kind: "unknown" }, 4)).toEqual({ mode: "immediate" });
  });
  it("adds segments to initiative", () => {
    expect(castingPlan({ kind: "segments", value: 5 }, 4)).toEqual({ mode: "segments", initiativeAdd: 5 });
  });
  it("completes a round spell at the end of its last round (start round counts as the first)", () => {
    expect(castingPlan({ kind: "rounds", value: 1 }, 4)).toEqual({ mode: "rounds", completeRound: 4 });
    expect(castingPlan({ kind: "rounds", value: 3 }, 4)).toEqual({ mode: "rounds", completeRound: 6 });
  });
});

describe("canCompleteCasting", () => {
  it("round spells complete from their complete round on", () => {
    const s = { startRound: 2, completeRound: 3 };
    expect(canCompleteCasting(s, { combatRound: 2, isCasterTurn: true })).toBe(false);
    expect(canCompleteCasting(s, { combatRound: 3, isCasterTurn: false })).toBe(true);
    expect(canCompleteCasting(s, { combatRound: 5, isCasterTurn: false })).toBe(true);
  });
  it("segment spells complete on the caster's turn in the start round, or any later round", () => {
    const s = { startRound: 2, completeRound: null };
    expect(canCompleteCasting(s, { combatRound: 2, isCasterTurn: false })).toBe(false);
    expect(canCompleteCasting(s, { combatRound: 2, isCasterTurn: true })).toBe(true);
    expect(canCompleteCasting(s, { combatRound: 3, isCasterTurn: false })).toBe(true);
    expect(canCompleteCasting(s, { combatRound: 1, isCasterTurn: true })).toBe(false);
  });
});

describe("hpChangeDisrupts", () => {
  it("is true only when hit points fall below the recorded value", () => {
    expect(hpChangeDisrupts(20, 19)).toBe(true);
    expect(hpChangeDisrupts(20, -3)).toBe(true);
    expect(hpChangeDisrupts(20, 20)).toBe(false);
    expect(hpChangeDisrupts(20, 25)).toBe(false);
  });
});

describe("acDexAdjWhileCasting", () => {
  it("is unchanged when not casting", () => {
    expect(acDexAdjWhileCasting(-3, false)).toBe(-3);
    expect(acDexAdjWhileCasting(2, false)).toBe(2);
    expect(acDexAdjWhileCasting(0, false)).toBe(0);
  });
  it("drops a beneficial (negative) adjustment but keeps a penalty while casting", () => {
    expect(acDexAdjWhileCasting(-3, true)).toBe(0);
    expect(acDexAdjWhileCasting(2, true)).toBe(2);
    expect(acDexAdjWhileCasting(0, true)).toBe(0);
  });
});
