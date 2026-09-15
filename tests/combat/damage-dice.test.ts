import { describe, expect, it } from "vitest";
import { pickDamageDice } from "../../src/combat/damage-dice";

describe("pickDamageDice", () => {
  it("picks vsSM for a medium target", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "medium")).toBe("1d6");
  });
  it("picks vsSM for a small or tiny target", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "small")).toBe("1d6");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "tiny")).toBe("1d6");
  });
  it("picks vsL for large, huge, or gargantuan targets", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "large")).toBe("1d8");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "huge")).toBe("1d8");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, "gargantuan")).toBe("1d8");
  });
  it("defaults to vsSM (medium) when there is no target", () => {
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: "1d8" }, null)).toBe("1d6");
  });
  it("falls back to whichever die is defined when the other is null", () => {
    expect(pickDamageDice({ damageVsSM: null, damageVsL: "1d8" }, "medium")).toBe("1d8");
    expect(pickDamageDice({ damageVsSM: "1d6", damageVsL: null }, "large")).toBe("1d6");
  });
  it("returns null when neither die is defined (e.g. a bow with no ammo modeled)", () => {
    expect(pickDamageDice({ damageVsSM: null, damageVsL: null }, "medium")).toBeNull();
  });
});
