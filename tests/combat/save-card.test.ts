import { describe, expect, it } from "vitest";
import { buildSaveCardContext } from "../../src/combat/save-card";
import type { SaveCardInput } from "../../src/combat/card-types";

function input(over: Partial<SaveCardInput> = {}): SaveCardInput {
  return {
    actorName: "Aldric", actorImg: "icons/svg/mystery-man.svg",
    categoryLabel: "ADND2E.saves.ppd",
    formula: "1d20 + 1", naturalD20: 14, rollModifier: 1, target: 12,
    ...over,
  };
}

describe("buildSaveCardContext", () => {
  it("succeeds when natural + modifier meets the target", () => {
    const c = buildSaveCardContext(input());
    expect(c.total).toBe(15);
    expect(c.success).toBe(true);
  });

  it("succeeds exactly at the target (>=, not >)", () => {
    const c = buildSaveCardContext(input({ naturalD20: 11, rollModifier: 1, target: 12 }));
    expect(c.total).toBe(12);
    expect(c.success).toBe(true);
  });

  it("fails when below the target", () => {
    const c = buildSaveCardContext(input({ naturalD20: 5, rollModifier: 1, target: 12 }));
    expect(c.total).toBe(6);
    expect(c.success).toBe(false);
  });

  it("a negative rollModifier can push a save below the target", () => {
    const c = buildSaveCardContext(input({ naturalD20: 12, rollModifier: -1, target: 12 }));
    expect(c.total).toBe(11);
    expect(c.success).toBe(false);
  });

  it("passes actor identity, category label, and formula through unchanged", () => {
    const c = buildSaveCardContext(input());
    expect(c.actorName).toBe("Aldric");
    expect(c.categoryLabel).toBe("ADND2E.saves.ppd");
    expect(c.formula).toBe("1d20 + 1");
  });
});
