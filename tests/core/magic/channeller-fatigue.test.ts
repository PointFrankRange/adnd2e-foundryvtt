import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  applyExistingFatigueStacking,
  baseFatigueTier,
  channellerFatigueEnabled,
  escalateForHp,
  escalateForSp,
  FATIGUE_AC_PENALTY,
  FATIGUE_ATTACK_PENALTY,
  FATIGUE_CONDITION_ID,
  FATIGUE_RECOVERY_INTERVAL,
  fatigueMovementRate,
  nextTierDown,
  resolveCastFatigue,
  tierForConditionId,
  type FatigueTier,
} from "../../../src/core/magic/channeller-fatigue";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("channellerFatigueEnabled (nested gate)", () => {
  it("needs channellersEnabled AND the channellerFatigue toggle", () => {
    expect(channellerFatigueEnabled(rules())).toBe(false);
    expect(
      channellerFatigueEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true, channelers: true })),
    ).toBe(false);
    expect(
      channellerFatigueEnabled(
        rules({ spellsAndMagicEnabled: true, spellPoints: true, channelers: true, channellerFatigue: true }),
      ),
    ).toBe(true);
    // channellerFatigue true but channelers false -> still false (nested gate)
    expect(
      channellerFatigueEnabled(
        rules({ spellsAndMagicEnabled: true, spellPoints: true, channellerFatigue: true }),
      ),
    ).toBe(false);
  });
});

describe("baseFatigueTier (Table 21)", () => {
  it("a 1st- or 2nd-level wizard: only heavy/severe/mortal are reachable (cantrip cells unreachable)", () => {
    expect(baseFatigueTier(1, 1)).toBe("heavy");
    expect(baseFatigueTier(2, 2)).toBe("severe");
    expect(baseFatigueTier(1, 3)).toBe("mortal");
    expect(baseFatigueTier(2, 9)).toBe("mortal");
  });
  it("a 7th/8th-level wizard matches the book's own worked examples (p.83): 1st=light, 2nd=moderate", () => {
    expect(baseFatigueTier(8, 1)).toBe("light");
    expect(baseFatigueTier(8, 2)).toBe("moderate");
    expect(baseFatigueTier(7, 3)).toBe("moderate");
    expect(baseFatigueTier(8, 4)).toBe("heavy");
    expect(baseFatigueTier(7, 5)).toBe("severe");
    expect(baseFatigueTier(8, 6)).toBe("mortal");
  });
  it("a 5th/6th-level wizard: fireball (3rd level) is heavy", () => {
    expect(baseFatigueTier(5, 3)).toBe("heavy");
  });
  it("the highest bands (26+) never reach heavy/severe/mortal", () => {
    expect(baseFatigueTier(30, 1)).toBe("light");
    expect(baseFatigueTier(30, 6)).toBe("light");
    expect(baseFatigueTier(30, 7)).toBe("moderate");
    expect(baseFatigueTier(30, 9)).toBe("moderate");
  });
  it("rejects an out-of-range spell level", () => {
    expect(() => baseFatigueTier(5, 0)).toThrow(RangeError);
    expect(() => baseFatigueTier(5, 10)).toThrow(RangeError);
  });
});

describe("escalateForHp (p.82-83)", () => {
  it("the book's own worked example: a 5th-level wizard (16 max HP) casting fireball (base: heavy)", () => {
    expect(escalateForHp("heavy", 16, 16)).toBe("heavy"); // full HP, no escalation
    expect(escalateForHp("heavy", 8, 16)).toBe("severe"); // exactly 50% -> +1
    expect(escalateForHp("heavy", 4, 16)).toBe("mortal"); // exactly 25% -> +2
  });
  it("clamps at mortal rather than overshooting", () => {
    expect(escalateForHp("severe", 1, 16)).toBe("mortal"); // +2 from severe would overshoot; clamp
  });
});

describe("escalateForSp (p.83)", () => {
  it("below 50% spent: no escalation", () => {
    expect(escalateForSp("moderate", 51, 100)).toBe("moderate"); // 49% spent
  });
  it("exactly 50% spent -> +1 tier", () => {
    expect(escalateForSp("moderate", 50, 100)).toBe("heavy");
  });
  it("just over 50% spent -> +1 tier (same band as exactly 50%)", () => {
    expect(escalateForSp("moderate", 49, 100)).toBe("heavy"); // 51% spent
  });
  it("exactly 75% spent -> +2 tiers", () => {
    expect(escalateForSp("moderate", 25, 100)).toBe("severe");
  });
  it("90% spent -> +2 tiers (same band as exactly 75%)", () => {
    expect(escalateForSp("light", 10, 100)).toBe("heavy"); // light shifted by 2 = heavy
  });
});

describe("applyExistingFatigueStacking (p.83) — the book's own worked example", () => {
  it("already moderately fatigued, casts a 2nd-level spell at level 7-8 (base moderate) -> becomes heavy", () => {
    expect(applyExistingFatigueStacking("moderate", "moderate")).toBe("heavy");
  });
  it("already moderately fatigued, casts a 1st-level spell at level 7-8 (base light) -> remains moderate", () => {
    expect(applyExistingFatigueStacking("light", "moderate")).toBe("moderate");
  });
  it("not currently fatigued (null) -> no shift, new tier used as-is", () => {
    expect(applyExistingFatigueStacking("heavy", null)).toBe("heavy");
  });
  it("heavily fatigued shifts the new cast's tier by 2", () => {
    expect(applyExistingFatigueStacking("light", "heavy")).toBe("heavy"); // light+2=heavy, worse-of(heavy,heavy)=heavy
  });
  it("severely fatigued shifts the new cast's tier by 3, clamped at mortal when it would overshoot", () => {
    expect(applyExistingFatigueStacking("heavy", "severe")).toBe("mortal"); // heavy+3 overshoots past mortal -> clamped
  });
});

describe("resolveCastFatigue — end to end against the book's own worked examples", () => {
  it("5th-level wizard, fireball (3rd level), at 50% HP, not previously fatigued -> severe", () => {
    expect(
      resolveCastFatigue({
        casterLevel: 5, spellLevel: 3, currentHp: 8, maxHp: 16, currentSp: 40, maxSp: 40, currentTier: null,
      }),
    ).toBe("severe");
  });
  it("same cast at 25% HP -> mortal", () => {
    expect(
      resolveCastFatigue({
        casterLevel: 5, spellLevel: 3, currentHp: 4, maxHp: 16, currentSp: 40, maxSp: 40, currentTier: null,
      }),
    ).toBe("mortal");
  });
});

describe("per-tier combat/movement/recovery data", () => {
  it("FATIGUE_ATTACK_PENALTY matches the book exactly", () => {
    expect(FATIGUE_ATTACK_PENALTY).toEqual({ light: 0, moderate: -1, heavy: -2, severe: -4, mortal: 0 });
  });
  it("FATIGUE_AC_PENALTY matches the book exactly (positive = worse AC)", () => {
    expect(FATIGUE_AC_PENALTY).toEqual({ light: 0, moderate: 0, heavy: 1, severe: 3, mortal: 0 });
  });
  it("fatigueMovementRate: light/moderate/heavy multiply and floor, severe is a flat 1, mortal is 0", () => {
    expect(fatigueMovementRate("light", 12)).toBe(9); // floor(12*0.75)
    expect(fatigueMovementRate("moderate", 12)).toBe(6);
    expect(fatigueMovementRate("heavy", 12)).toBe(3);
    expect(fatigueMovementRate("severe", 12)).toBe(1);
    expect(fatigueMovementRate("severe", 1)).toBe(1);
    expect(fatigueMovementRate("mortal", 12)).toBe(0);
  });
  it("FATIGUE_RECOVERY_INTERVAL matches the book", () => {
    expect(FATIGUE_RECOVERY_INTERVAL).toEqual({
      light: "round", moderate: "round", heavy: "turn", severe: "hour", mortal: "hour",
    });
  });
});

describe("FATIGUE_CONDITION_ID / tierForConditionId", () => {
  it("round-trips every tier through its condition id", () => {
    const tiers: FatigueTier[] = ["light", "moderate", "heavy", "severe", "mortal"];
    for (const t of tiers) expect(tierForConditionId(FATIGUE_CONDITION_ID[t])).toBe(t);
  });
  it("returns null for a non-fatigue status id", () => {
    expect(tierForConditionId("prone")).toBeNull();
  });
});

describe("nextTierDown", () => {
  it("steps down the ladder, null below light", () => {
    expect(nextTierDown("mortal")).toBe("severe");
    expect(nextTierDown("severe")).toBe("heavy");
    expect(nextTierDown("heavy")).toBe("moderate");
    expect(nextTierDown("moderate")).toBe("light");
    expect(nextTierDown("light")).toBeNull();
  });
});
