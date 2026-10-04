import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  canAffordMemorize,
  magickCost,
  spellPointsEnabled,
  spellPointsSpent,
  spellsMemorizedAtLevel,
  wizardBaseSpellPoints,
  wizardMaxPerLevel,
  wizardMaxSpellLevel,
  wizardSpellPointTotal,
} from "../../../src/core/magic/spell-points";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("spellPointsEnabled (the one gate)", () => {
  it("needs the master switch AND the spell-points toggle", () => {
    expect(spellPointsEnabled(rules())).toBe(false);
    expect(spellPointsEnabled(rules({ spellsAndMagicEnabled: true }))).toBe(false);
    expect(spellPointsEnabled(rules({ spellPoints: true }))).toBe(false);
    expect(spellPointsEnabled(rules({ spellsAndMagicEnabled: true, spellPoints: true }))).toBe(true);
  });
});

describe("wizardMaxSpellLevel (Table 17)", () => {
  it.each([
    [1, 1], [2, 1], [3, 2], [6, 3], [12, 6], [18, 9], [20, 9],
  ])("wizard level %i -> max spell level %i", (level, expected) => {
    expect(wizardMaxSpellLevel(level)).toBe(expected);
  });

  it("level 21+ freezes at the level-20 max spell level", () => {
    expect(wizardMaxSpellLevel(21)).toBe(9);
    expect(wizardMaxSpellLevel(30)).toBe(9);
  });

  it("rejects a bad level", () => {
    expect(() => wizardMaxSpellLevel(0)).toThrow(RangeError);
  });
});

describe("wizardMaxPerLevel (Table 17, flat cap)", () => {
  it.each([
    [1, false, 2], [1, true, 3],
    [6, false, 4], [6, true, 6],
    [13, false, 6], [13, true, 7],
    [19, false, 7], [19, true, 9],
    [20, false, 7], [20, true, 9],
  ])("wizard level %i, specialist=%s -> cap %i", (level, specialist, expected) => {
    expect(wizardMaxPerLevel(level, specialist)).toBe(expected);
  });

  it("level 21+ freezes the flat cap at the level-20 row", () => {
    expect(wizardMaxPerLevel(25, false)).toBe(7);
    expect(wizardMaxPerLevel(25, true)).toBe(9);
  });
});

describe("wizardSpellPointTotal (Table 17 SP + specialist bonus + Table 19 Int bonus)", () => {
  it("level 1, non-specialist, Int 8 (below bonus threshold): base SP only", () => {
    expect(wizardSpellPointTotal(1, 8, false)).toBe(4);
  });
  it("level 1, non-specialist, Int 9: +2 bonus", () => {
    expect(wizardSpellPointTotal(1, 9, false)).toBe(6);
  });
  it("level 6, specialist, Int 18: base 55 + specialist bonus 20 + Int bonus 7", () => {
    expect(wizardSpellPointTotal(6, 18, true)).toBe(82);
  });
  it("level 21+, non-specialist, Int 10: 800 base + 100/level over 20, + Int bonus 2", () => {
    expect(wizardSpellPointTotal(21, 10, false)).toBe(902);
  });
  it("level 21+ gives no further specialist SP bonus (Table 17's own '(0)')", () => {
    expect(wizardSpellPointTotal(21, 10, true)).toBe(wizardSpellPointTotal(21, 10, false));
  });
  it.each([
    [8, 0], [9, 2], [11, 2], [12, 3], [13, 3], [14, 4], [15, 4],
    [16, 5], [17, 6], [18, 7], [19, 8], [20, 9], [25, 9],
  ])("Table 19 boundary: Int %i -> bonus %i", (intScore, bonus) => {
    expect(wizardSpellPointTotal(1, intScore, false) - wizardSpellPointTotal(1, 1, false)).toBe(bonus);
  });
});

describe("magickCost (Table 18)", () => {
  it.each([
    [1, "fixed", 4], [1, "free", 8],
    [5, "fixed", 22], [5, "free", 44],
    [9, "fixed", 60], [9, "free", 120],
  ] as const)("spell level %i, %s -> %i SP", (level, type, expected) => {
    expect(magickCost(level, type)).toBe(expected);
  });

  it("rejects an out-of-range spell level", () => {
    expect(() => magickCost(0, "fixed")).toThrow(RangeError);
    expect(() => magickCost(10, "fixed")).toThrow(RangeError);
  });
});

describe("spellPointsSpent", () => {
  it("is 0 for an empty list", () => {
    expect(spellPointsSpent([])).toBe(0);
  });
  it("sums mixed fixed/free entries", () => {
    expect(spellPointsSpent([
      { spellLevel: 1, magickType: "fixed" },
      { spellLevel: 2, magickType: "free" },
    ])).toBe(4 + 12);
  });
  it("treats an entry with no magickType as fixed", () => {
    expect(spellPointsSpent([{ spellLevel: 3 }])).toBe(10);
  });
  it("counts an expended entry the same as a fresh one (occupancy, not availability)", () => {
    expect(spellPointsSpent([{ spellLevel: 1, magickType: "fixed", expended: true } as never])).toBe(4);
  });
});

describe("spellsMemorizedAtLevel", () => {
  it("counts entries at the given level only", () => {
    const memorized = [{ spellLevel: 1 }, { spellLevel: 1 }, { spellLevel: 2 }];
    expect(spellsMemorizedAtLevel(memorized, 1)).toBe(2);
    expect(spellsMemorizedAtLevel(memorized, 2)).toBe(1);
    expect(spellsMemorizedAtLevel(memorized, 3)).toBe(0);
  });
});

describe("canAffordMemorize", () => {
  it("allows exactly up to the total", () => {
    expect(canAffordMemorize(40, 36, 1, "fixed")).toBe(true); // 36 + 4 = 40
  });
  it("blocks one point over", () => {
    expect(canAffordMemorize(40, 37, 1, "fixed")).toBe(false); // 37 + 4 = 41
  });
});

describe("wizardBaseSpellPoints (Table 17 base + specialist bonus, no Int)", () => {
  it("matches Table 17's own numbers with no Intelligence term", () => {
    expect(wizardBaseSpellPoints(1, false)).toBe(4);
    expect(wizardBaseSpellPoints(6, true)).toBe(75); // 55 base + 20 specialist bonus
  });
  it("wizardSpellPointTotal equals wizardBaseSpellPoints plus the Table 19 Int bonus, always", () => {
    expect(wizardSpellPointTotal(6, 18, true)).toBe(wizardBaseSpellPoints(6, true) + 7); // Int 18 -> +7
  });
});

describe("spellsMemorizedAtLevel (per-level occupancy for the flat cap)", () => {
  it("is 0 for an empty list", () => {
    expect(spellsMemorizedAtLevel([], 2)).toBe(0);
  });
  it("counts two level-2 entries and one level-3 entry per level", () => {
    const memorized = [{ spellLevel: 2 }, { spellLevel: 2 }, { spellLevel: 3 }];
    expect(spellsMemorizedAtLevel(memorized, 2)).toBe(2);
    expect(spellsMemorizedAtLevel(memorized, 3)).toBe(1);
  });
  it("does not count an entry at another level", () => {
    expect(spellsMemorizedAtLevel([{ spellLevel: 4 }], 2)).toBe(0);
  });
});
