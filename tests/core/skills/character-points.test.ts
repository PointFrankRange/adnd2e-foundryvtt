import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONAL_RULES } from "../../../src/core/options";
import {
  DEFAULT_CHARACTER_POINT_POOL,
  DISADVANTAGE_REFUND_CAP,
  authoredSubScores,
  canAffordTrait,
  characterPointBuildEnabled,
  characterPointLedger,
  characterPointLedgerFor,
  disadvantageRefund,
  subScoreCpCost,
} from "../../../src/core/skills/character-points";

const rules = (over: Partial<typeof DEFAULT_OPTIONAL_RULES> = {}) => ({ ...DEFAULT_OPTIONAL_RULES, ...over });

describe("constants", () => {
  it("pins the refund cap and the default pool", () => {
    expect(DISADVANTAGE_REFUND_CAP).toBe(10);
    expect(DEFAULT_CHARACTER_POINT_POOL).toBe(60);
  });
});

describe("characterPointBuildEnabled (the one gate)", () => {
  it("needs the master switch AND the character-point toggle", () => {
    expect(characterPointBuildEnabled(rules())).toBe(false);
    expect(characterPointBuildEnabled(rules({ skillsAndPowersEnabled: true }))).toBe(false);
    expect(characterPointBuildEnabled(rules({ characterPointBuild: true }))).toBe(false);
    expect(characterPointBuildEnabled(rules({ skillsAndPowersEnabled: true, characterPointBuild: true }))).toBe(true);
  });
});

describe("subScoreCpCost — every range boundary", () => {
  it.each([
    [1, -4], [5, -4], [6, -4],
    [7, -3], [8, -2], [9, -1], [10, 0],
    [11, 1], [12, 2], [13, 3], [14, 4],
    [15, 6], [16, 8], [17, 10],
    [18, 13], [19, 16], [24, 31], [25, 34],
  ])("score %i costs %i", (score, cost) => {
    expect(subScoreCpCost(score)).toBe(cost);
  });
});

describe("disadvantageRefund", () => {
  it("sums the negative costs and caps the total at DISADVANTAGE_REFUND_CAP", () => {
    expect(disadvantageRefund([])).toBe(0);
    expect(disadvantageRefund([6, 8])).toBe(0);
    expect(disadvantageRefund([-4])).toBe(4);
    expect(disadvantageRefund([-4, -5, 6])).toBe(9);
    expect(disadvantageRefund([-4, -4, -5])).toBe(10);
    expect(disadvantageRefund([-10])).toBe(10);
  });
});

describe("characterPointLedger", () => {
  it("an untouched character has the whole pool available", () => {
    expect(characterPointLedger({ pool: 60, subScores: [], traitCosts: [] })).toEqual({
      pool: 60, subSpent: 0, traitSpent: 0, refund: 0, refundUncapped: 0, spent: 0, available: 60, overspent: false,
    });
  });

  it("sub-scores cost by the curve; null sub-scores are uncommitted and cost nothing", () => {
    const l = characterPointLedger({ pool: 60, subScores: [18, 10, null, 6], traitCosts: [] });
    expect(l.subSpent).toBe(9); // 13 + 0 + (-4)
    expect(l.spent).toBe(9);
    expect(l.available).toBe(51);
  });

  it("advantages add, cost-0 traits add nothing, disadvantages refund up to the cap", () => {
    const l = characterPointLedger({ pool: 60, subScores: [], traitCosts: [6, 8, 0, -4, -5, -3] });
    expect(l.traitSpent).toBe(14);
    expect(l.refundUncapped).toBe(12);
    expect(l.refund).toBe(10);
    expect(l.spent).toBe(4); // 14 - 10
    expect(l.available).toBe(56);
  });

  it("spent can be negative (uncapped sub-score refunds) and available exceeds the pool", () => {
    const l = characterPointLedger({ pool: 60, subScores: Array(12).fill(6), traitCosts: [] });
    expect(l.spent).toBe(-48);
    expect(l.available).toBe(108);
    expect(l.overspent).toBe(false);
  });

  it("is overspent only when available drops below zero", () => {
    expect(characterPointLedger({ pool: 8, subScores: [], traitCosts: [8] }).overspent).toBe(false);
    const over = characterPointLedger({ pool: 5, subScores: [], traitCosts: [8] });
    expect(over.available).toBe(-3);
    expect(over.overspent).toBe(true);
  });
});

describe("authoredSubScores", () => {
  it("flattens the twelve sub-scores in ability order (str a,b then dex a,b ...)", () => {
    const abilities = {
      str: { sub: { a: 1, b: 2 } },
      dex: { sub: { a: 3, b: 4 } },
      con: { sub: { a: 5, b: 6 } },
      int: { sub: { a: 7, b: 8 } },
      wis: { sub: { a: 9, b: 10 } },
      cha: { sub: { a: 11, b: 12 } },
    };
    expect(authoredSubScores(abilities)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("treats a missing ability, a missing/null sub object and null members as null", () => {
    expect(
      authoredSubScores({ str: { sub: { a: 14, b: null } }, dex: { sub: null }, con: {} }),
    ).toEqual([14, null, null, null, null, null, null, null, null, null, null, null]);
  });
});

describe("characterPointLedgerFor", () => {
  const abilities = { str: { sub: { a: 18, b: 14 } } };
  const input = { pool: 60, abilities, traitCosts: [6] };

  it("is null while the rule is off, in any of its three off combinations", () => {
    expect(characterPointLedgerFor(rules(), input)).toBeNull();
    expect(characterPointLedgerFor(rules({ skillsAndPowersEnabled: true }), input)).toBeNull();
    expect(characterPointLedgerFor(rules({ characterPointBuild: true, subAbilityScores: true }), input)).toBeNull();
  });

  it("counts traits only when sub-ability scores are not also on", () => {
    const l = characterPointLedgerFor(rules({ skillsAndPowersEnabled: true, characterPointBuild: true }), input)!;
    expect(l.subSpent).toBe(0);
    expect(l.spent).toBe(6);
  });

  it("counts the authored sub-scores when sub-ability scores are also on", () => {
    const l = characterPointLedgerFor(
      rules({ skillsAndPowersEnabled: true, characterPointBuild: true, subAbilityScores: true }),
      input,
    )!;
    expect(l.subSpent).toBe(17); // 13 (18) + 4 (14)
    expect(l.spent).toBe(23);
    expect(l.available).toBe(37);
  });
});

describe("canAffordTrait", () => {
  const base = { traitCost: 6, traitId: "hardy", ownedTraitIds: [] as string[], available: 10, refundedSoFar: 0 };

  it("rejects a trait the actor already owns", () => {
    expect(canAffordTrait({ ...base, ownedTraitIds: ["hardy"] })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.duplicateTrait" });
  });

  it("never treats a blank traitId (a hand-made custom trait) as a duplicate", () => {
    expect(canAffordTrait({ ...base, traitId: "", ownedTraitIds: [""] })).toEqual({ ok: true, refund: 0 });
  });

  it("allows an advantage costing exactly what is available, rejects one costing more", () => {
    expect(canAffordTrait({ ...base, traitCost: 10 })).toEqual({ ok: true, refund: 0 });
    expect(canAffordTrait({ ...base, traitCost: 11 })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.insufficientCp" });
  });

  it("always allows a free trait, even when the ledger is already overspent", () => {
    expect(canAffordTrait({ ...base, traitCost: 0, available: -3 })).toEqual({ ok: true, refund: 0 });
  });

  it("allows a disadvantage with its full refund while under the cap", () => {
    expect(canAffordTrait({ ...base, traitCost: -4, refundedSoFar: 3 })).toEqual({ ok: true, refund: 4 });
  });

  it("allows a disadvantage but clamps its refund at the remaining cap", () => {
    expect(canAffordTrait({ ...base, traitCost: -8, refundedSoFar: 5 })).toEqual({ ok: true, refund: 5 });
  });

  it("still allows a disadvantage once the cap is spent, refunding nothing", () => {
    expect(canAffordTrait({ ...base, traitCost: -4, refundedSoFar: 10 })).toEqual({ ok: true, refund: 0 });
    expect(canAffordTrait({ ...base, traitCost: -4, refundedSoFar: 12 })).toEqual({ ok: true, refund: 0 });
  });

  it("allows a disadvantage even when the ledger is overspent", () => {
    expect(canAffordTrait({ ...base, traitCost: -4, available: -9 })).toEqual({ ok: true, refund: 4 });
  });
});
