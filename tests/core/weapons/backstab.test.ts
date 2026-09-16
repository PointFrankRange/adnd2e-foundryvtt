import { describe, expect, it } from "vitest";
import { canBackstab } from "../../../src/core/weapons/backstab";

describe("canBackstab", () => {
  it("allows a melee piercing weapon (e.g. a dagger)", () => {
    expect(canBackstab({ category: "melee", damageType: "piercing" })).toBe(true);
  });

  it("allows a melee slashing weapon (e.g. a short sword)", () => {
    expect(canBackstab({ category: "melee", damageType: "slashing" })).toBe(true);
  });

  it("allows a melee piercing-slashing weapon", () => {
    expect(canBackstab({ category: "melee", damageType: "piercing-slashing" })).toBe(true);
  });

  it("rejects a melee bludgeoning weapon (e.g. a mace)", () => {
    expect(canBackstab({ category: "melee", damageType: "bludgeoning" })).toBe(false);
  });

  it("rejects a melee weapon with no damage type set", () => {
    expect(canBackstab({ category: "melee", damageType: null })).toBe(false);
  });

  it("rejects a thrown weapon regardless of damage type", () => {
    expect(canBackstab({ category: "thrown", damageType: "piercing" })).toBe(false);
  });

  it("rejects a bow", () => {
    expect(canBackstab({ category: "bow", damageType: "piercing" })).toBe(false);
  });

  it("rejects a crossbow", () => {
    expect(canBackstab({ category: "crossbow", damageType: "piercing" })).toBe(false);
  });
});
