import { describe, expect, it } from "vitest";
import { armorAttackPenalty, weaponSizePenalty } from "../../../src/core/martial-arts";

describe("armorAttackPenalty — PHB Table 57", () => {
  it.each([
    ["none", 0], ["padded", 0], ["leather", 0], ["studded-leather", -1], ["ring-mail", -2], ["scale-mail", -2], ["chain-mail", -2],
    ["elven-chain", -2], ["splint-mail", -5], ["banded-mail", -5], ["plate-mail", -5], ["field-plate", -8], ["full-plate", -10],
  ])("%s → %i", (type, penalty) => expect(armorAttackPenalty(type)).toBe(penalty));
  it("an unknown or prototype key is 0", () => {
    expect(armorAttackPenalty("mystery")).toBe(0);
    expect(armorAttackPenalty("constructor")).toBe(0);
  });
});

describe("weaponSizePenalty — Table 22", () => {
  it.each([["S", -1], ["M", -2], ["L", -4], ["G", -3], ["H", -1]])("%s → %i", (size, p) => expect(weaponSizePenalty(size)).toBe(p));
  it("no weapon or an unknown size is 0", () => {
    expect(weaponSizePenalty(null)).toBe(0);
    expect(weaponSizePenalty("X")).toBe(0);
    expect(weaponSizePenalty("toString")).toBe(0);
  });
});
