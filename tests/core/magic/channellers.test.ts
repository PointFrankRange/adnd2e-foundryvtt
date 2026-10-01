import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  canAffordCast,
  channellerMaxSp,
  channellersEnabled,
  recoverSp,
  spendCastSp,
} from "../../../src/core/magic/channellers";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("channellersEnabled (nested gate)", () => {
  it("needs spellPointsEnabled AND the channelers toggle", () => {
    expect(channellersEnabled(rules())).toBe(false);
    expect(channellersEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true }))).toBe(false);
    expect(channellersEnabled(rules({ spellsAndMagicEnabled: true, channelers: true }))).toBe(false);
    expect(channellersEnabled(rules({ spellPoints: true, channelers: true }))).toBe(false); // master switch still off
    expect(
      channellersEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true, channelers: true })),
    ).toBe(true);
  });
});

describe("channellerMaxSp (Table 17 base, Con/Wis substituted for Int)", () => {
  it("level 6 specialist, Con hpAdjustment +1, Wis magicalDefenseAdj +1: 55 base + 20 specialist bonus + 1 + 1", () => {
    expect(channellerMaxSp(6, true, 1, 1)).toBe(77);
  });
  it("level 6 non-specialist, Con +2, Wis +4: 55 base + 2 + 4", () => {
    expect(channellerMaxSp(6, false, 2, 4)).toBe(61);
  });
  it("floors at 4 when Con/Wis adjustments would push a level-1 wizard below it", () => {
    expect(channellerMaxSp(1, false, -2, -3)).toBe(4); // 4 base - 2 - 3 = -1, floored
  });
  it("does not floor when the raw total is already >= 4", () => {
    expect(channellerMaxSp(1, false, 0, 0)).toBe(4); // 4 base exactly, floor is a no-op here
  });
});

describe("canAffordCast / spendCastSp (reuse magickCost, Table 18)", () => {
  it("allows exactly enough and blocks one short", () => {
    expect(canAffordCast(4, 1, "fixed")).toBe(true);
    expect(canAffordCast(3, 1, "fixed")).toBe(false);
  });
  it("spends the correct Table 18 amount", () => {
    expect(spendCastSp(10, 1, "fixed")).toBe(6);
    expect(spendCastSp(20, 2, "free")).toBe(8);
  });
});

describe("recoverSp (Table 20)", () => {
  it("hard exertion recovers nothing regardless of hours", () => {
    expect(recoverSp(0, 100, "hardExertion", 5)).toBe(0);
  });
  it("the book's own worked example: a 55-max pool sleeping recovers 8/hr (flat beats the 5.5-rounds-to-6 percentage)", () => {
    expect(recoverSp(0, 55, "sleeping", 1)).toBe(8);
  });
  it("walking/riding: flat and percent tie at max=100", () => {
    expect(recoverSp(0, 100, "walkingRiding", 5)).toBe(10); // 2/hr * 5
  });
  it("sitting/resting at max=25: percent (1.25 -> rounds to 1) loses to the flat rate of 4", () => {
    expect(recoverSp(0, 25, "sittingResting", 3)).toBe(12); // 4/hr * 3
  });
  it("crossover point: at max=85 sleeping, the percentage (8.5 -> rounds to 9) beats the flat rate of 8", () => {
    expect(recoverSp(0, 85, "sleeping", 1)).toBe(9);
  });
  it("clamps at max", () => {
    expect(recoverSp(80, 85, "sleeping", 1)).toBe(85); // 80 + 9 would be 89, clamped
  });
});
