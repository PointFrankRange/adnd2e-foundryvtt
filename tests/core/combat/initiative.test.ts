import { describe, expect, it } from "vitest";
import { initiativeModifiers } from "../../../src/core/combat/initiative";

describe("initiativeModifiers", () => {
  it("sums weapon speed, reaction, and situational with no defaults given", () => {
    const r = initiativeModifiers({});
    expect(r).toEqual({ total: 0, breakdown: { weaponSpeed: 0, reaction: 0, situational: 0 } });
  });

  it("adds a positive weapon speed factor (slower weapon, worse initiative)", () => {
    const r = initiativeModifiers({ weaponSpeedFactor: 7 });
    expect(r.total).toBe(7);
    expect(r.breakdown.weaponSpeed).toBe(7);
  });

  it("adds a negative reaction adjustment (high DEX, better initiative)", () => {
    const r = initiativeModifiers({ reactionAdj: -2 });
    expect(r.total).toBe(-2);
    expect(r.breakdown.reaction).toBe(-2);
  });

  it("combines all three terms, including a manual situational modifier", () => {
    const r = initiativeModifiers({ weaponSpeedFactor: 5, reactionAdj: -1, situationalModifier: 3 });
    expect(r.total).toBe(7);
    expect(r.breakdown).toEqual({ weaponSpeed: 5, reaction: -1, situational: 3 });
  });
});
