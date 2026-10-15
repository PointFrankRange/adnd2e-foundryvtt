import { describe, expect, it } from "vitest";
import { psionicArmorPenalty, worstArmorPenalty } from "../../../src/core/psionics";

describe("psionicArmorPenalty (Table 9)", () => {
  it("matches the table", () => {
    expect(["none", "padded", "leather", "studded-leather"].map((t) => psionicArmorPenalty(t as never))).toEqual([0, 0, 0, 0]);
    expect(["ring-mail", "scale-mail", "splint-mail"].map((t) => psionicArmorPenalty(t as never))).toEqual([-1, -1, -1]);
    expect(["chain-mail", "banded-mail", "elven-chain"].map((t) => psionicArmorPenalty(t as never))).toEqual([-2, -2, -2]);
    expect(psionicArmorPenalty("plate-mail")).toBe(-3);
    expect(psionicArmorPenalty("field-plate")).toBe(-5);
    expect(psionicArmorPenalty("full-plate")).toBe(-7);
  });
  it("an unknown type costs nothing", () => {
    expect(psionicArmorPenalty("mithril" as never)).toBe(0);
  });
});

describe("worstArmorPenalty", () => {
  it("is zero with nothing worn", () => {
    expect(worstArmorPenalty([])).toEqual({ penalty: 0, armor: null });
  });
  it("ignores shields", () => {
    expect(worstArmorPenalty([{ armorType: "plate-mail", isShield: true }])).toEqual({ penalty: 0, armor: null });
  });
  it("takes the worst body armor", () => {
    const worn = [
      { armorType: "chain-mail", isShield: false },
      { armorType: "field-plate", isShield: false },
      { armorType: "plate-mail", isShield: false },
    ] as const;
    expect(worstArmorPenalty(worn)).toEqual({ penalty: -5, armor: 1 });
  });
  it("a zero-penalty armor is not an offender", () => {
    expect(worstArmorPenalty([{ armorType: "leather", isShield: false }])).toEqual({ penalty: 0, armor: null });
  });
});
