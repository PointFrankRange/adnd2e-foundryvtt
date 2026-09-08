import { describe, expect, it } from "vitest";
import { signedTerm, attackFormula, damageFormula } from "../../../src/core/dice/formula";

describe("signedTerm", () => {
  it("formats a modifier as a formula suffix", () => {
    expect(signedTerm(0)).toBe("");
    expect(signedTerm(3)).toBe(" + 3");
    expect(signedTerm(1)).toBe(" + 1");
    expect(signedTerm(-2)).toBe(" - 2");
    expect(signedTerm(-1)).toBe(" - 1");
  });
});

describe("attackFormula", () => {
  it("builds a d20 attack string", () => {
    expect(attackFormula(0)).toBe("1d20");
    expect(attackFormula(5)).toBe("1d20 + 5");
    expect(attackFormula(-3)).toBe("1d20 - 3");
  });
});

describe("damageFormula", () => {
  it("appends the damage bonus to the weapon dice", () => {
    expect(damageFormula("1d8", 0)).toBe("1d8");
    expect(damageFormula("1d8", 3)).toBe("1d8 + 3");
    expect(damageFormula("2d4", -1)).toBe("2d4 - 1");
    expect(damageFormula("1d6+1", 2)).toBe("1d6+1 + 2"); // baseDice passed through verbatim
  });
});
